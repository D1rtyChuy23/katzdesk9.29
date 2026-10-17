/**
 * Build the four channel notes from the desk, then post them.
 * Dispatch: blank or duplicated work orders, Needs Approval names, address-report accounts.
 * Parts: ticket lines with no MPN, bin values that look like Excel dates.
 * Handoff: unresolved asks.
 * Analytics: counts for the range on screen, or this month on the morning post. No cost or margin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { loadAnalyticsRows } from "@/lib/ops/analytics-api";
import { ANALYTICS_TYPES, filterRows, scopeLine, summarize, type AnalyticsFilters } from "@/lib/ops/analytics";
import { addDays, formatNowChicago, todayChicago } from "@/lib/ops/clock";
import { woMatchKey } from "@/lib/ops/corrigo";
import { flagOn } from "@/lib/ops/flag";
import { looksLikeExcelDate } from "@/lib/ops/part-bins";
import {
  TEAMS_CHANNELS,
  TEAMS_CHANNEL_LABEL,
  analyticsReport,
  collapseDuplicateWorkOrders,
  dispatchReport,
  handoffReport,
  partsReport,
  type AddressWait,
  type AnalyticsCount,
  type BlankWo,
  type DuplicateWo,
  type ExcelBin,
  type MissingMpn,
  type NameWait,
  type OpenAsk,
  type TeamsChannel,
  type TeamsNote,
} from "@/lib/ops/teams-message";
import { deliverTeamsReport, webhookUrl, type TeamsDelivery } from "@/lib/ops/teams-post";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const filtersInput = z
  .object({
    from: z.string().regex(DAY).nullable().optional(),
    to: z.string().regex(DAY).nullable().optional(),
    types: z.array(z.enum(ANALYTICS_TYPES)).max(ANALYTICS_TYPES.length).nullable().optional(),
    rep: z.string().max(80).nullable().optional(),
    q: z.string().max(120).nullable().optional(),
  })
  .optional();

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireTeamsAdmin(sql: Sql, userId: string): Promise<void> {
  const rows = await sql.query<{ is_admin: unknown; desk_role: string | null }>(
    "select is_admin, desk_role from desk_accounts where user_id = $1",
    [userId],
  );
  const isAdmin = flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin";
  if (!isAdmin) throw new Error("Only an admin can post a report to Teams.");
}

function thisMonth(): AnalyticsFilters {
  const today = todayChicago();
  const [y, m] = today.split("-");
  const next = `${Number(m) === 12 ? Number(y) + 1 : y}-${String((Number(m) % 12) + 1).padStart(2, "0")}-01`;
  return { from: `${y}-${m}-01`, to: addDays(next, -1), types: null, rep: null, q: null };
}

async function blankWorkOrders(sql: Sql): Promise<BlankWo[]> {
  const jobs = await sql.query<{ board: string; id: number; customer: string | null; ref: string | null }>(
    `select case when kind = 'tlc' then 'TLC' else 'Service' end as board, id, customer, call_id as ref
       from service_jobs
      where duplicate_of is null and done = false and coalesce(btrim(wo), '') = ''
      order by id desc
      limit 40`,
  );
  const pms = await sql.query<{ id: number; customer: string | null }>(
    `select id, customer from pm_jobs
      where done = false and coalesce(btrim(wo), '') = ''
      order by id desc
      limit 40`,
  );
  const installs = await sql.query<{ id: number; customer: string | null }>(
    `select id, customer from installs
      where archived = false and complete = false and coalesce(btrim(wo), '') = ''
      order by id desc
      limit 40`,
  );
  return [
    ...jobs.map((r) => ({ board: r.board, id: Number(r.id), customer: r.customer?.trim() || "", ref: r.ref?.trim() || "" })),
    ...pms.map((r) => ({ board: "PM", id: Number(r.id), customer: r.customer?.trim() || "", ref: "" })),
    ...installs.map((r) => ({ board: "Install", id: Number(r.id), customer: r.customer?.trim() || "", ref: "" })),
  ];
}

async function duplicateWorkOrders(sql: Sql): Promise<DuplicateWo[]> {
  const rows = await sql.query<{ board: string; id: number; wo: string; customer: string | null }>(
    `select 'Service' as board, id, wo, customer from service_jobs
      where duplicate_of is null and done = false and kind = 'service' and coalesce(btrim(wo), '') <> ''
     union all
     select 'TLC', id, wo, customer from service_jobs
      where duplicate_of is null and done = false and kind = 'tlc' and coalesce(btrim(wo), '') <> ''
     union all
     select 'PM', id, wo, customer from pm_jobs
      where done = false and coalesce(btrim(wo), '') <> ''
     union all
     select 'Install', id, wo, customer from installs
      where archived = false and complete = false and coalesce(btrim(wo), '') <> ''`,
  );
  return collapseDuplicateWorkOrders(
    rows.map((row) => ({
      key: woMatchKey(row.wo),
      wo: row.wo,
      where: `${row.board} #${Number(row.id)}${row.customer?.trim() ? ` ${row.customer.trim()}` : ""}`,
    })),
  );
}

async function namesWaiting(sql: Sql): Promise<NameWait[]> {
  const rows = await sql.query<{ katz: string | null; clean: string | null; reason: string | null }>(
    `select katz_name as katz, clean_name as clean, reason
       from customer_clean_items
      where run_id = (select max(id) from customer_clean_runs)
        and status = 'pending'
        and kind = 'similar'
      order by id
      limit 40`,
  );
  return rows.map((r) => ({ katz: r.katz?.trim() || "", clean: r.clean?.trim() || "", reason: r.reason?.trim() || "" }));
}

async function addressesWaiting(sql: Sql): Promise<AddressWait[]> {
  const rows = await sql.query<{ name: string; address: string | null; pin: string | null }>(
    `select d.name, d.address, d.geocode_address as pin
       from directory_customers d
       left join address_report_reviews r on r.customer_id = d.id
      where d.archived = false
        and not (d.latitude is not null and d.longitude is not null and d.geocode_match is distinct from 'approx')
        and coalesce(r.status, '') <> 'skipped'
        and not (r.status = 'approved' and coalesce(btrim(d.address), '') = coalesce(btrim(r.address), ''))
      order by d.name
      limit 40`,
  );
  return rows.map((r) => ({ name: r.name.trim(), address: r.address?.trim() || "", pin: r.pin?.trim() || "" }));
}

async function missingMpns(sql: Sql): Promise<MissingMpn[]> {
  const rows = await sql.query<{ call_id: string | null; customer: string | null; item: string }>(
    `select j.call_id, j.customer, c.item
       from ticket_charges c
       join service_jobs j on j.id = c.job_id
       left join lateral (
         select b.sku, b.mfr_part from billing_items b
          where lower(btrim(b.item)) = lower(btrim(c.item)) or lower(btrim(b.sku)) = lower(btrim(c.item))
          order by (lower(btrim(b.item)) = lower(btrim(c.item))) desc
          limit 1
       ) p on true
      where j.duplicate_of is null
        and j.done = false
        and c.kind not in ('trip', 'labor')
        and p.sku is not null
        and coalesce(btrim(c.mpn), '') = ''
        and coalesce(btrim(p.mfr_part), '') = ''
      order by j.id desc, c.id
      limit 40`,
  );
  return rows.map((r) => ({ callId: r.call_id?.trim() || "", customer: r.customer?.trim() || "", item: r.item.trim() }));
}

async function excelDateBins(sql: Sql): Promise<ExcelBin[]> {
  const rows = await sql.query<{ sku: string | null; item: string | null; bin_rack: string | null; bin_shelf: string | null; bin_bin: string | null }>(
    `select sku, item, bin_rack, bin_shelf, bin_bin
       from billing_items
      where bin_rack is not null or bin_shelf is not null or bin_bin is not null`,
  );
  const out: ExcelBin[] = [];
  for (const row of rows) {
    const sku = (row.sku || row.item || "Part").trim();
    const pieces: [string, string | null][] = [
      ["rack", row.bin_rack],
      ["shelf", row.bin_shelf],
      ["bin", row.bin_bin],
    ];
    for (const [piece, value] of pieces) {
      const text = value?.trim() || "";
      if (!looksLikeExcelDate(text)) continue;
      out.push({ sku, piece, value: text });
      if (out.length >= 40) return out;
    }
  }
  return out;
}

async function openAsks(sql: Sql): Promise<OpenAsk[]> {
  const rows = await sql.query<{ ask_team: string | null; body: string; entity_type: string; customer: string | null }>(
    `select c.ask_team, c.body, c.entity_type,
            coalesce(
              case when c.entity_type in ('service', 'tlc') then (select customer from service_jobs where id = c.entity_id) end,
              case when c.entity_type = 'pm' then (select customer from pm_jobs where id = c.entity_id) end,
              case when c.entity_type = 'install' then (select customer from installs where id = c.entity_id) end,
              case when c.entity_type = 'deal' then (select customer from deals where id = c.entity_id) end
            ) as customer
       from comments c
      where c.ask_team is not null and c.resolved = false
      order by c.created_at desc
      limit 40`,
  );
  return rows.map((r) => ({
    team: r.ask_team?.trim() || "",
    customer: r.customer?.trim() || "",
    body: r.body.replace(/\s+/g, " ").trim(),
  }));
}

async function analyticsCounts(sql: Sql, filters: AnalyticsFilters): Promise<{ scope: string; counts: AnalyticsCount[] }> {
  const rows = filterRows(await loadAnalyticsRows(sql), filters);
  return {
    scope: scopeLine(filters, rows.length),
    counts: summarize(rows).map((s) => ({
      label: s.label,
      total: s.total,
      top: s.statuses.slice(0, 3).map((x) => `${x.status} ${x.count}`).join(", "),
    })),
  };
}

async function noteFor(sql: Sql, channel: TeamsChannel, filters: AnalyticsFilters | undefined, when: string): Promise<TeamsNote> {
  if (channel === "dispatch") {
    const [blankWo, duplicateWo, names, addresses] = await Promise.all([
      blankWorkOrders(sql),
      duplicateWorkOrders(sql),
      namesWaiting(sql),
      addressesWaiting(sql),
    ]);
    return dispatchReport({ blankWo, duplicateWo, names, addresses }, when);
  }
  if (channel === "parts") {
    const [missingMpn, excelDates] = await Promise.all([missingMpns(sql), excelDateBins(sql)]);
    return partsReport({ missingMpn, excelDates }, when);
  }
  if (channel === "handoff") return handoffReport({ asks: await openAsks(sql) }, when);
  return analyticsReport(await analyticsCounts(sql, filters ?? thisMonth()), when);
}

async function postNote(note: TeamsNote): Promise<TeamsDelivery> {
  return deliverTeamsReport(note, process.env, async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    return { status: res.status };
  });
}

export type TeamsChannelState = { channel: TeamsChannel; label: string; ready: boolean };

export const teamsChannelStatus = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<TeamsChannelState[]> => {
    return TEAMS_CHANNELS.map((channel) => ({
      channel,
      label: TEAMS_CHANNEL_LABEL[channel],
      ready: !!webhookUrl(channel, process.env),
    }));
  });

export const postTeamsChannel = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { channel: TeamsChannel; filters?: AnalyticsFilters }) =>
    z.object({ channel: z.enum(TEAMS_CHANNELS), filters: filtersInput }).parse(d),
  )
  .handler(async ({ data, context }): Promise<TeamsDelivery> => {
    const sql = await ready();
    await requireTeamsAdmin(sql, context.userId);
    const note = await noteFor(sql, data.channel, data.filters, formatNowChicago().stamp);
    const result = await postNote(note);
    if (!result.posted) throw new Error(result.error || "Teams did not accept the note.");
    return result;
  });

export const postMorningReports = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ results: TeamsDelivery[] }> => {
    const sql = await ready();
    await requireTeamsAdmin(sql, context.userId);
    const when = formatNowChicago().stamp;
    const month = thisMonth();
    const results = await Promise.all(
      TEAMS_CHANNELS.map(async (channel) => {
        try {
          const note = await noteFor(sql, channel, channel === "analytics" ? month : undefined, when);
          return await postNote(note);
        } catch (e) {
          return {
            channel,
            label: TEAMS_CHANNEL_LABEL[channel],
            posted: false,
            ready: true,
            lines: 0,
            error: e instanceof Error ? e.message : "Could not build the note.",
          } satisfies TeamsDelivery;
        }
      }),
    );
    return { results };
  });
