/**
 * Draft the exact text for each Teams chat, and record an admin's approval of that text.
 * KatzDesk does not post. Group chats and DMs are sent by the Teams login, and only after this OK.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { loadAnalyticsRows } from "@/lib/ops/analytics-api";
import { filterRows, scopeLine, summarize, type AnalyticsFilters } from "@/lib/ops/analytics";
import { invoicedPartLines } from "@/lib/ops/charges-api";
import { formatNowChicago, moneyExact, monthBounds, pmFlag, serviceFlag, todayChicago } from "@/lib/ops/clock";
import { woMatchKey } from "@/lib/ops/corrigo";
import { flagOn } from "@/lib/ops/flag";
import { profitByMpn, profitTotals } from "@/lib/ops/part-pricing";
import { accountRepFor, loadAccountMarks } from "@/lib/ops/reps";
import {
  collapseDuplicateWorkOrders,
  draftAll,
  serviceRegion,
  teamsChat,
  type AttentionLine,
  type OpenCall,
  type OrderLine,
  type TeamsChatId,
  type TeamsDraft,
  type TeamsSnapshot,
} from "@/lib/ops/teams-message";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function ensureDrafts(sql: Sql) {
  await sql.query(`
    create table if not exists teams_drafts (
      id serial primary key,
      chat text not null,
      body text not null,
      approved_by text not null,
      approved_at timestamptz not null default now()
    )`);
}

async function requireTeamsAdmin(sql: Sql, userId: string): Promise<string> {
  const rows = await sql.query<{ is_admin: unknown; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const isAdmin = flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin";
  if (!isAdmin) throw new Error("Only an admin can approve a Teams note.");
  return rows[0]?.username?.trim() || "Admin";
}

function thisMonth(): AnalyticsFilters {
  const bounds = monthBounds(todayChicago());
  return { from: bounds.start, to: bounds.end, types: null, rep: null, q: null };
}

async function loadSnapshot(sql: Sql): Promise<TeamsSnapshot> {
  const today = todayChicago();
  const marks = await loadAccountMarks(sql);
  const addresses = await sql.query<{ name: string; address: string | null; pin: string | null }>(
    "select name, address, geocode_address as pin from directory_customers where archived = false",
  );
  const where = new Map<string, string>();
  for (const row of addresses) {
    const key = row.name.trim().toLowerCase();
    if (!key || where.has(key)) continue;
    where.set(key, [row.address, row.pin].filter(Boolean).join(" "));
  }

  const jobs = await sql.query<{
    id: number;
    kind: string;
    call_id: string | null;
    customer: string | null;
    status: string | null;
    technician: string | null;
    technician2: string | null;
    wo: string | null;
    issue: string | null;
    scheduled: string | null;
    received: string | null;
    done: boolean;
  }>(
    `select id, kind, call_id, customer, status, technician, technician2, wo, issue, scheduled::text, received::text, done
       from service_jobs
      where duplicate_of is null and done = false`,
  );
  const pms = await sql.query<{
    id: number;
    customer: string | null;
    status: string | null;
    technician: string | null;
    wo: string | null;
    projected: string | null;
    done: boolean;
  }>(
    `select id, customer, status, technician, wo, projected::text, done from pm_jobs where done = false`,
  );

  const attention: AttentionLine[] = [];
  for (const job of jobs) {
    const flag = serviceFlag(
      { kind: job.kind === "tlc" ? "tlc" : "service", status: job.status || "Open", done: !!job.done, received: job.received, scheduled: job.scheduled },
      today,
    );
    if (!flag) continue;
    attention.push({
      label: flag.label,
      board: job.kind === "tlc" ? "TLC" : "Service",
      customer: job.customer?.trim() || "",
      tech: job.technician?.trim() || "",
      ref: job.wo?.trim() || job.call_id?.trim() || "",
    });
  }
  for (const pm of pms) {
    const flag = pmFlag({ status: pm.status || "", done: !!pm.done, projected: pm.projected }, today);
    if (!flag) continue;
    attention.push({
      label: flag.label,
      board: "PM",
      customer: pm.customer?.trim() || "",
      tech: pm.technician?.trim() || "",
      ref: pm.wo?.trim() || "",
    });
  }
  attention.sort((a, b) => a.label.localeCompare(b.label) || a.customer.localeCompare(b.customer));

  const dupRows = [
    ...jobs.filter((j) => j.wo?.trim() && j.kind !== "tlc").map((j) => ({ board: "Service", id: j.id, wo: j.wo || "", customer: j.customer })),
    ...jobs.filter((j) => j.wo?.trim() && j.kind === "tlc").map((j) => ({ board: "TLC", id: j.id, wo: j.wo || "", customer: j.customer })),
    ...pms.filter((p) => p.wo?.trim()).map((p) => ({ board: "PM", id: p.id, wo: p.wo || "", customer: p.customer })),
  ];
  const installs = await sql.query<{ id: number; customer: string | null; wo: string | null }>(
    `select id, customer, wo from installs where archived = false and complete = false and coalesce(btrim(wo), '') <> ''`,
  );
  const duplicateWo = collapseDuplicateWorkOrders(
    [...dupRows, ...installs.map((r) => ({ board: "Install", id: r.id, wo: r.wo || "", customer: r.customer }))].map((row) => ({
      key: woMatchKey(row.wo),
      wo: row.wo,
      where: `${row.board} #${Number(row.id)}${row.customer?.trim() ? ` ${row.customer.trim()}` : ""}`,
    })),
  );

  const orderRows = await sql.query<{ call_id: string | null; customer: string | null; item: string; qty: string | null; kind: string; item_class: string | null }>(
    `select j.call_id, j.customer, c.item, c.qty::text, c.kind, p.item_class
       from ticket_charges c
       join service_jobs j on j.id = c.job_id
       left join lateral (
         select b.item_class from billing_items b
          where lower(btrim(b.item)) = lower(btrim(c.item)) or lower(btrim(b.sku)) = lower(btrim(c.item))
          order by (lower(btrim(b.item)) = lower(btrim(c.item))) desc
          limit 1
       ) p on true
      where j.duplicate_of is null
        and j.done = false
        and coalesce(btrim(j.po), '') = ''
        and c.kind not in ('trip', 'labor')
      order by j.id desc, c.id
      limit 80`,
  );
  const orders: OrderLine[] = orderRows.map((r) => ({
    callId: r.call_id?.trim() || "",
    customer: r.customer?.trim() || "",
    item: r.item.trim(),
    qty: r.qty != null && Number.isFinite(Number(r.qty)) ? String(Number(r.qty)) : "1",
    water: r.item_class === "Water Filters" || /water filter/i.test(r.item),
  }));

  const calls: OpenCall[] = jobs
    .filter((j) => j.kind !== "tlc")
    .map((j) => {
      const customer = j.customer?.trim() || "";
      return {
        customer,
        rep: accountRepFor(marks, customer) || "",
        tech: j.technician?.trim() || "",
        tech2: j.technician2?.trim() || "",
        region: serviceRegion(where.get(customer.toLowerCase()) || ""),
        status: j.status?.trim() || "Open",
        when: j.scheduled || "",
        issue: (j.issue || "").replace(/\s+/g, " ").trim(),
        ref: j.wo?.trim() || j.call_id?.trim() || "",
      };
    });

  const filters = thisMonth();
  const rows = filterRows(await loadAnalyticsRows(sql), filters);
  const { lines } = await invoicedPartLines(sql, { from: filters.from ?? null, to: filters.to ?? null });
  const totals = profitTotals(profitByMpn(lines), lines.length);
  return {
    when: formatNowChicago().stamp,
    attention,
    duplicateWo,
    orders,
    calls,
    kpiScope: scopeLine(filters, rows.length),
    kpi: summarize(rows).map((s) => ({
      label: s.label,
      total: s.total,
      top: s.statuses.slice(0, 3).map((x) => `${x.status} ${x.count}`).join(", "),
    })),
    finance: {
      scope: "This month, invoiced part lines.",
      sell: moneyExact(totals.sell),
      cost: moneyExact(totals.cost),
      margin: moneyExact(totals.margin),
    },
  };
}

export type TeamsChatCard = TeamsDraft & { approved: boolean; approvedAt: string | null; approvedBy: string | null };

async function cards(sql: Sql): Promise<TeamsChatCard[]> {
  await ensureDrafts(sql);
  const drafts = draftAll(await loadSnapshot(sql));
  const approvals = await sql.query<{ chat: string; body: string; approved_by: string; approved_at: string }>(
    `select distinct on (chat) chat, body, approved_by, approved_at::text
       from teams_drafts
      order by chat, id desc`,
  );
  const latest = new Map(approvals.map((r) => [r.chat, r]));
  return drafts.map((draft) => {
    const hit = latest.get(draft.id);
    const approved = !!hit && hit.body === draft.text;
    return { ...draft, approved, approvedAt: approved ? hit!.approved_at : null, approvedBy: approved ? hit!.approved_by : null };
  });
}

export const teamsChatBoard = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<TeamsChatCard[]> => {
    const sql = await ready();
    await requireTeamsAdmin(sql, context.userId);
    return cards(sql);
  });

export const approveTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { chat: TeamsChatId; text: string }) => z.object({ chat: z.string(), text: z.string().max(20_000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ name: string; approvedAt: string }> => {
    const chat = teamsChat(data.chat);
    if (!chat) throw new Error("That chat is not on the list.");
    const sql = await ready();
    const who = await requireTeamsAdmin(sql, context.userId);
    await ensureDrafts(sql);
    const draft = draftAll(await loadSnapshot(sql)).find((d) => d.id === chat.id);
    if (!draft || draft.text !== data.text) throw new Error("The desk changed. Read the new text and approve that.");
    const saved = await sql.query<{ approved_at: string }>(
      `insert into teams_drafts (chat, body, approved_by) values ($1, $2, $3) returning approved_at::text`,
      [chat.id, draft.text, who],
    );
    return { name: chat.name, approvedAt: saved[0]?.approved_at || "" };
  });
