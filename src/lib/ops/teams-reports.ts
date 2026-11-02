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
import { addDays, formatNowChicago, isInstalled, moneyExact, monthBounds, pmFlag, serviceFlag, todayChicago, weekBounds } from "@/lib/ops/clock";
import { woMatchKey } from "@/lib/ops/corrigo";
import { cleanTime, timeLabel } from "@/lib/ops/day-board";
import { INSTALL_WOS_SQL } from "@/lib/ops/wo-search";
import { flagOn } from "@/lib/ops/flag";
import { planGetReady, type ReadyInstall, type ReadyUnit } from "@/lib/ops/get-ready";
import { catalogNames, unitChecks } from "@/lib/ops/inspection-api";
import { machineNotesMissing, picturesNeeded, type PictureUnit } from "@/lib/ops/install-needs";
import { parseMachinesJson, specsFromInstall } from "@/lib/ops/machines";
import { profitByMpn, profitTotals } from "@/lib/ops/part-pricing";
import { loadPartUses } from "@/lib/ops/part-usage-api";
import { chicagoClock, countsForPo, partLabel, partMaker, piecesByPart, poReportWeek, pullChanges, type LedgerUse } from "@/lib/ops/po-report";
import { isPreInspected, unitKind } from "@/lib/ops/pre-inspection";
import { accountRepFor, loadAccountMarks, type AccountMarks } from "@/lib/ops/reps";
import { isOpenCall } from "@/lib/ops/ticket-status";
import { unitPlaceLabel } from "@/lib/ops/unit-place-rules";
import {
  TEAMS_CHATS,
  TEAMS_FEEDS,
  collapseDuplicateWorkOrders,
  draftAll,
  draftTeamsChat,
  serviceRegion,
  type AttentionLine,
  type DealStage,
  type OpenCall,
  type OpenInstall,
  type PipelineDeal,
  type PoPart,
  type PoReport,
  type ServicedLine,
  type TeamsChat,
  type TeamsDraft,
  type TeamsFeed,
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

async function requireTeamsAdmin(sql: Sql, userId: string, what = "approve a Teams note"): Promise<string> {
  const rows = await sql.query<{ is_admin: unknown; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const isAdmin = flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin";
  if (!isAdmin) throw new Error(`Only an admin can ${what}.`);
  return rows[0]?.username?.trim() || "Admin";
}

/** The chats from teams_chats. The built-in list stands in only while that table is empty. */
export async function loadTeamsChats(sql: Sql): Promise<TeamsChat[]> {
  const rows = await sql.query<{ id: string; name: string; grp: string; kind: "group" | "dm"; about: string; feed: TeamsFeed; target: string | null }>(
    "select id, name, grp, kind, about, feed, target from teams_chats order by sort, name, id",
  );
  if (!rows.length) return TEAMS_CHATS;
  return rows.map((r) => ({ id: r.id, name: r.name, group: r.grp, kind: r.kind, about: r.about, feed: r.feed, target: r.target }));
}

function thisMonth(today: string): AnalyticsFilters {
  const bounds = monthBounds(today);
  return { from: bounds.start, to: bounds.end, types: null, rep: null, q: null };
}

const flat = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
/** ISO days or times in order, blanks last. */
const blankLast = (a: string, b: string) => (a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? -1 : 1);


/** A saved weekly pull, as the note shows it. */
async function savedPull(sql: Sql, to: string): Promise<PoReport | null> {
  const rows = await sql.query<{ week_from: string; week_to: string; pulled_at: string; report: unknown }>(
    `select week_from::text, week_to::text, to_char(pulled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as pulled_at, report
       from teams_po_pulls where week_to = $1::date`,
    [to],
  );
  const hit = rows[0];
  if (!hit) return null;
  const report = (typeof hit.report === "string" ? JSON.parse(hit.report) : hit.report) as PoPart[];
  return { from: hit.week_from.slice(0, 10), to: hit.week_to.slice(0, 10), pulledAt: hit.pulled_at, parts: Array.isArray(report) ? report : [] };
}

/**
 * The weekly Purchase Order report (Chuy, 11/2): the parts and water filters used, by manufacturer, as pulled once a
 * week. The first look after Friday 5 PM pulls that week and saves it, so Monday morning reads exactly what was pulled
 * and an approved report stays approved. Uses are counted the way Parts → Usage counts a part's uses (tickets,
 * approved invoices, PM machine parts and WO part lines, a merged part as the part it went into), dated through that
 * Friday. Each pull keeps what it reported for each ticket and part, so the next one has only what is new since: a use
 * entered late or back-dated, a use whose date moved, and pieces added or taken off a ticket are each counted once.
 * The first pull ever covers its own week; the next ones go back to that week's Saturday.
 */
async function loadPoReport(sql: Sql, now: Date): Promise<PoReport> {
  const { date, hour } = chicagoClock(now);
  const week = poReportWeek(date, hour);
  const saved = await savedPull(sql, week.to);
  if (saved) return saved;
  const earlier = await sql.query<{ week_from: string; uses: unknown }>(
    "select week_from::text, uses from teams_po_pulls where week_to < $1::date order by week_to",
    [week.to],
  );
  const start = earlier.length ? earlier.map((r) => r.week_from.slice(0, 10)).sort()[0]! : week.from;
  const reported: LedgerUse[] = earlier.flatMap((r) => {
    const list = (typeof r.uses === "string" ? JSON.parse(r.uses) : r.uses) as LedgerUse[];
    return Array.isArray(list) ? list : [];
  });
  const merged = new Map(
    (await sql.query<{ id: number; merged_into: number }>("select id, merged_into from billing_items where merged_into is not null")).map((r) => [
      Number(r.id),
      Number(r.merged_into),
    ]),
  );
  const uses: LedgerUse[] = (await loadPartUses(sql, { from: start, to: week.to })).map((u) => ({ k: u.ticketKey, p: u.partId, q: u.pieces }));
  const changes = pullChanges(uses, reported, merged);
  const pieces = piecesByPart(changes);
  const ids = [...pieces.keys()];
  const rows = ids.length
    ? await sql.query<{ id: number; sku: string; parent: string | null; item: string; description: string | null; item_class: string | null; kind: string }>(
        "select id, sku, parent, item, description, item_class, kind from billing_items where id = any($1::int[]) order by id",
        [ids],
      )
    : [];
  const parts: PoPart[] = [];
  for (const r of rows) {
    const n = pieces.get(Number(r.id)) ?? 0;
    if (!n || !countsForPo({ itemClass: r.item_class, kind: r.kind })) continue;
    const maker = partMaker(r);
    parts.push({ maker, sku: flat(r.sku), label: flat(partLabel(r, maker)), pieces: n });
  }
  // One pull per week: when two looks pull at once, the first saved is the week's.
  await sql.query(
    `insert into teams_po_pulls (week_to, week_from, pulled_at, uses, report)
     values ($1::date, $2::date, $3::timestamptz, $4::jsonb, $5::jsonb)
     on conflict (week_to) do nothing`,
    [week.to, week.from, now.toISOString(), JSON.stringify(changes), JSON.stringify(parts)],
  );
  return (await savedPull(sql, week.to)) ?? { ...week, pulledAt: now.toISOString(), parts };
}

/**
 * Each rep chat's Serviced list starts on the day of its last note before today: an approved note is the one the
 * Teams login sends, so the next one picks up from there, that day included. Today's own approval doesn't move it,
 * so a note approved this morning stays approved. A chat with no earlier note looks back a week.
 */
async function servicedWindows(sql: Sql, chats: TeamsChat[], today: string): Promise<{ from: Record<string, string>; fallback: string; earliest: string }> {
  const rows = await sql.query<{ chat: string; day: string }>(
    `select chat, max((approved_at at time zone 'America/Chicago')::date)::text as day
       from teams_drafts
      where (approved_at at time zone 'America/Chicago')::date < $1::date
      group by chat`,
    [today],
  );
  const reps = new Set(chats.filter((c) => c.feed === "rep").map((c) => c.id));
  const from: Record<string, string> = {};
  for (const r of rows) if (reps.has(r.chat)) from[r.chat] = r.day.slice(0, 10);
  const fallback = addDays(today, -7);
  const earliest = [fallback, ...Object.values(from)].sort()[0]!;
  return { from, fallback, earliest };
}

/**
 * Service calls (not TLC) and PMs finished from `from` through today. A PM billed on a ticket is that ticket's visit.
 * The day is the completed date when one was typed or imported; else the day its status was set to Completed (or
 * Phone Resolved), from its history; else its scheduled (PM: projected) day, else the day it came in.
 */
async function loadServiced(sql: Sql, marks: AccountMarks, from: string, today: string): Promise<ServicedLine[]> {
  const jobs = await sql.query<{
    customer: string | null;
    status: string | null;
    technician: string | null;
    technician2: string | null;
    wo: string | null;
    call_id: string | null;
    issue: string | null;
    work_done: string | null;
    day: string;
  }>(
    `select customer, status, technician, technician2, wo, call_id, issue, work_done, day::text as day
       from (
         select j.*, coalesce(
                  j.completed_at,
                  (select (a.created_at at time zone 'America/Chicago')::date from activity a
                    where a.entity_type = j.kind and a.entity_id = j.id and a.action = 'status'
                      and (position('→ Completed' in a.detail) > 0 or position('→ Phone Resolved' in a.detail) > 0)
                    order by a.id desc limit 1),
                  j.scheduled, j.received) as day
           from service_jobs j
          where j.kind = 'service' and j.duplicate_of is null and coalesce(j.status, '') <> 'Cancelled'
            and (j.done or j.status in ('Completed', 'Phone Resolved'))
       ) x
      where day between $1::date and $2::date
      order by id`,
    [from, today],
  );
  const pms = await sql.query<{ customer: string | null; technician: string | null; wo: string | null; work_done: string | null; day: string }>(
    `select customer, technician, wo, work_done, day::text as day
       from (
         select p.*, coalesce(
                  p.completed_at,
                  (select (a.created_at at time zone 'America/Chicago')::date from activity a
                    where a.entity_type = 'pm' and a.entity_id = p.id and position('→ Completed' in coalesce(a.detail, '')) > 0
                    order by a.id desc limit 1),
                  p.projected, p.received) as day
           from pm_jobs p
          where coalesce(p.status, '') <> 'Cancelled' and (p.done or p.status = 'Completed') and p.stacked_job_id is null
       ) x
      where day between $1::date and $2::date
      order by id`,
    [from, today],
  );
  const rep = (customer: string) => accountRepFor(marks, customer) || "";
  return [
    ...jobs.map((j) => {
      const customer = flat(j.customer);
      return {
        customer,
        rep: rep(customer),
        kind: j.status === "Phone Resolved" ? "Phone Resolved" : "Service call",
        date: j.day.slice(0, 10),
        ref: flat(j.wo) || flat(j.call_id),
        tech: [flat(j.technician), flat(j.technician2)].filter(Boolean).join(" & "),
        what: flat(j.work_done) || flat(j.issue),
      };
    }),
    ...pms.map((p) => {
      const customer = flat(p.customer);
      return { customer, rep: rep(customer), kind: "PM", date: p.day.slice(0, 10), ref: flat(p.wo), tech: flat(p.technician), what: flat(p.work_done) };
    }),
  ];
}

/** Open deals on the Pipeline (not complete, not fell through), newest first, with the Pipeline's own stage. */
async function loadDeals(sql: Sql, marks: AccountMarks): Promise<PipelineDeal[]> {
  const rows = await sql.query<{
    customer: string;
    producer: string | null;
    equipment: string | null;
    machines: string | null;
    good_to_order: boolean;
    ordered: boolean;
    eta: string | null;
  }>(
    `select customer, producer, equipment, machines, good_to_order, ordered, eta
       from deals
      where archived = false and coalesce(completion, '') not in ('complete', 'fell')
      order by date_of_deal desc nulls last, id desc`,
  );
  return rows.map((d) => {
    const customer = flat(d.customer);
    const listed = parseMachinesJson(d.machines).map((m) => m.equipment);
    const stage: DealStage = flagOn(d.ordered) ? "Ordered" : flagOn(d.good_to_order) ? "Good to order" : "Needs good to order";
    return {
      customer,
      // A deal with no rep of its own is the rep saved on the account, as the Pipeline shows it.
      rep: flat(d.producer) || accountRepFor(marks, customer) || "",
      equipment: listed.length ? listed.join(", ") : flat(String(d.equipment ?? "").replace(/\r?\n/g, ", ")),
      stage,
      eta: flat(d.eta),
    };
  });
}

type InstallRow = {
  id: number;
  customer: string;
  account_rep: string | null;
  install_date: string | null;
  sched_time: string | null;
  equipment: string | null;
  serial: string | null;
  power_voltage: string | null;
  machines: string | null;
  equip_status: string | null;
  complete: boolean;
};

/**
 * Read only: what each install's pre-inspection still needs pictures for, and its units that are equipment already at
 * the site (marked existing, or on the account with an install date and serial, and not marked new or replace).
 */
async function loadPictureNeeds(
  sql: Sql,
  rows: { id: number; machines: number }[],
): Promise<{ pictures: Map<number, OpenInstall["pictures"]>; onSite: Map<number, Set<number>> }> {
  const ids = rows.map((r) => r.id);
  const out = new Map<number, OpenInstall["pictures"]>();
  const onSite = new Map<number, Set<number>>();
  if (!ids.length) return { pictures: out, onSite };
  const [units, items, photos, heads] = await Promise.all([
    sql.query<{ install_id: number; equipment_id: number; core_needed: string | null; visit_kind: string | null; catalog_model: string | null; equipment_name: string | null; installed: boolean }>(
      `select u.install_id, u.equipment_id, u.core_needed, u.visit_kind, a.catalog_model, a.equipment_name,
              (a.install_date is not null and coalesce(a.serial_key, '') <> '') as installed
         from install_inspection_units u join account_equipment a on a.id = u.equipment_id
        where u.install_id = any($1::int[])
        order by u.install_id, a.id`,
      [ids],
    ),
    sql.query<{ install_id: number; equipment_id: number; category: string; status: string }>(
      `select install_id, equipment_id, category, status from install_inspection_items where install_id = any($1::int[]) and equipment_id is not null`,
      [ids],
    ),
    sql.query<{ install_id: number; equipment_id: number; category: string; n: number }>(
      `select install_id, equipment_id, category, count(*)::int as n
         from install_inspection_photos where install_id = any($1::int[]) and equipment_id is not null
        group by install_id, equipment_id, category`,
      [ids],
    ),
    sql.query<{ install_id: number; override_reason: string | null }>(
      `select install_id, override_reason from install_inspections where install_id = any($1::int[])`,
      [ids],
    ),
  ]);
  const key = (i: number, e: number) => `${i}:${e}`;
  const statuses = new Map<string, Record<string, string>>();
  for (const r of items) statuses.set(key(r.install_id, r.equipment_id), { ...statuses.get(key(r.install_id, r.equipment_id)), [r.category]: r.status });
  const shots = new Map<string, Record<string, number>>();
  for (const r of photos) shots.set(key(r.install_id, r.equipment_id), { ...shots.get(key(r.install_id, r.equipment_id)), [r.category]: Number(r.n) || 0 });
  const overridden = new Set(heads.filter((h) => flat(h.override_reason)).map((h) => h.install_id));
  const byInstall = new Map<number, PictureUnit[]>();
  for (const u of units) {
    if (u.visit_kind === "existing" || (!u.visit_kind && u.installed)) onSite.set(u.install_id, (onSite.get(u.install_id) ?? new Set()).add(Number(u.equipment_id)));
    const list = byInstall.get(u.install_id) ?? [];
    list.push({
      model: flat(u.catalog_model) || flat(u.equipment_name),
      preInspected: isPreInspected(unitKind(u.visit_kind, !!u.installed)),
      categories: unitChecks(u),
      coreNeeded: u.core_needed,
      statuses: statuses.get(key(u.install_id, u.equipment_id)) ?? {},
      photos: shots.get(key(u.install_id, u.equipment_id)) ?? {},
    });
    byInstall.set(u.install_id, list);
  }
  for (const r of rows) out.set(r.id, picturesNeeded(byInstall.get(r.id) ?? [], { hasMachines: r.machines > 0, overridden: overridden.has(r.id) }));
  return { pictures: out, onSite };
}

/**
 * The installs still open on the Board, with what each needs (Chuy, 11/2), and the get-ready list for the ones this
 * week and next: each machine, and whether it is pulled, where to pull it from, or that none is in stock.
 */
async function loadInstalls(sql: Sql, marks: AccountMarks, today: string): Promise<{ open: OpenInstall[]; getReady: TeamsSnapshot["getReady"] }> {
  const catalog = await catalogNames(sql);
  const rows = (
    await sql.query<InstallRow>(
      // As the Board lists them: an install flagged "Possible duplicate" is still open there.
      `select id, customer, account_rep, install_date::text as install_date, sched_time, equipment, serial, power_voltage, machines, equip_status, complete
         from installs where archived = false order by id`,
    )
  ).filter((r) => !isInstalled({ complete: flagOn(r.complete), equipStatus: r.equip_status }));
  const specs = new Map(rows.map((r) => [r.id, specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, catalog)]));
  const { pictures, onSite } = await loadPictureNeeds(sql, rows.map((r) => ({ id: r.id, machines: specs.get(r.id)?.length ?? 0 })));
  const open: OpenInstall[] = rows
    .map((r) => {
      const customer = flat(r.customer);
      const machines = specs.get(r.id) ?? [];
      const { power, water } = machineNotesMissing(machines);
      return {
        customer,
        // An install with no rep of its own is the rep saved on the account, as the Board shows it.
        rep: flat(r.account_rep) || accountRepFor(marks, customer) || "",
        date: (r.install_date ?? "").slice(0, 10),
        machines: machines.length,
        power,
        water,
        pictures: pictures.get(r.id) ?? { needed: false, machines: [] },
      };
    })
    .sort((a, b) => blankLast(a.date, b.date) || a.customer.localeCompare(b.customer));

  const last = weekBounds(today).nextEnd;
  const soon = rows.filter((r) => r.install_date && r.install_date.slice(0, 10) >= today && r.install_date.slice(0, 10) <= last);
  if (!soon.length) return { open, getReady: [] };
  const pulledRows = await sql.query<{ id: number; install_id: number; model: string; serial: string | null; qty: number | null; shop_test: string | null; origin_site: string | null; origin_pallet: string | null; origin_level: number | null }>(
    `select id, install_id, model, serial, qty, shop_test, origin_site, origin_pallet, origin_level from assets where install_id = any($1::int[]) order by id`,
    [soon.map((r) => r.id)],
  );
  const stockRows = await sql.query<{ id: number; model: string; serial: string | null; qty: number | null; site: string; pallet: string | null; level: number | null; shop_test: string | null }>(
    // In the barn and free: ready, on no install, ticket or account, not held for approval, not a customer's own unit.
    `select id, model, serial, qty, site, pallet, level, shop_test from assets
      where kind in ('equip', 'dispenser') and status = 'ready' and site in ('barn-back', 'barn-front')
        and install_id is null and job_id is null and coalesce(btrim(sold_to), '') = '' and stock_hold is null
        and coalesce(btrim(customer_owned), '') = ''
      order by id`,
  );
  // A row with a quantity of 2 is two units, as the Warehouse's Ready Models totals count it.
  const units = (a: { id: number; model: string; serial: string | null; qty: number | null; shop_test: string | null }, where: string): ReadyUnit[] =>
    Array.from({ length: Math.max(1, Math.floor(Number(a.qty) || 1)) }, () => ({
      id: Number(a.id),
      model: flat(a.model),
      serial: flat(a.serial),
      where,
      tested: a.shop_test === "tested",
      needsTest: a.shop_test === "needs-test",
    }));
  const installs: ReadyInstall[] = soon.map((r) => ({
    id: r.id,
    date: r.install_date!.slice(0, 10),
    time: timeLabel(cleanTime(r.sched_time)),
    at: cleanTime(r.sched_time) ?? "",
    customer: flat(r.customer),
    // Equipment already at the site has nothing to pull.
    machines: (specs.get(r.id) ?? []).filter((m) => !(m.unitId && onSite.get(r.id)?.has(m.unitId))).map((m) => ({ model: m.equipment, serial: m.serial })),
    pulled: pulledRows
      .filter((a) => Number(a.install_id) === r.id)
      .flatMap((a) => units(a, a.origin_site ? unitPlaceLabel({ site: a.origin_site, pallet: a.origin_pallet, level: a.origin_level }) : "")),
  }));
  const stock = stockRows.flatMap((a) => units(a, unitPlaceLabel({ site: a.site, pallet: a.pallet, level: a.level })));
  return { open, getReady: planGetReady(installs, stock, catalog) };
}

async function loadSnapshot(sql: Sql, chats: TeamsChat[], now: Date = new Date()): Promise<TeamsSnapshot> {
  const today = todayChicago(now);
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
      where duplicate_of is null and done = false
      order by id`,
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
    `select id, customer, status, technician, wo, projected::text, done from pm_jobs where done = false order by id`,
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
    // Every work order an open install project carries.
    `select i.id, i.customer, w.wo from installs i join ${INSTALL_WOS_SQL} w on w.install_id = i.id
      where i.archived = false and i.complete = false and coalesce(btrim(w.wo), '') <> ''
      order by i.id, w.wo`,
  );
  const duplicateWo = collapseDuplicateWorkOrders(
    [
      ...dupRows,
      // One line per install and number: "WO-0855" and "855" on one install are one WO.
      ...installs
        .filter((r, i, all) => all.findIndex((x) => x.id === r.id && woMatchKey(x.wo || "") === woMatchKey(r.wo || "")) === i)
        .map((r) => ({ board: "Install", id: r.id, wo: r.wo || "", customer: r.customer })),
    ].map((row) => ({
      key: woMatchKey(row.wo),
      wo: row.wo,
      where: `${row.board} #${Number(row.id)}${row.customer?.trim() ? ` ${row.customer.trim()}` : ""}`,
    })),
  );

  const calls: OpenCall[] = jobs
    // Open as the Service board reads it: not done, and not Completed, Cancelled or Phone Resolved.
    .filter((j) => j.kind !== "tlc" && isOpenCall(j))
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
    })
    .sort((a, b) => blankLast(a.when, b.when) || a.customer.localeCompare(b.customer) || a.ref.localeCompare(b.ref));

  const windows = await servicedWindows(sql, chats, today);
  const { open, getReady } = await loadInstalls(sql, marks, today);

  const filters = thisMonth(today);
  const rows = filterRows(await loadAnalyticsRows(sql), filters);
  const { lines } = await invoicedPartLines(sql, { from: filters.from ?? null, to: filters.to ?? null });
  const totals = profitTotals(profitByMpn(lines), lines.length);
  return {
    when: formatNowChicago().stamp,
    attention,
    duplicateWo,
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
    po: await loadPoReport(sql, now),
    serviced: await loadServiced(sql, marks, windows.earliest, today),
    servicedFrom: windows.from,
    servicedDefault: windows.fallback,
    deals: await loadDeals(sql, marks),
    installs: open,
    getReady,
  };
}

export type TeamsChatCard = TeamsDraft & {
  feed: TeamsFeed;
  target: string | null;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
};

/** `now` is for tests: the clock the notes are drafted at. */
export async function chatCards(sql: Sql, now?: Date): Promise<TeamsChatCard[]> {
  await ensureDrafts(sql);
  const chats = await loadTeamsChats(sql);
  const drafts = draftAll(await loadSnapshot(sql, chats, now), chats);
  const approvals = await sql.query<{ chat: string; body: string; approved_by: string; approved_at: string }>(
    `select distinct on (chat) chat, body, approved_by, approved_at::text
       from teams_drafts
      order by chat, id desc`,
  );
  const latest = new Map(approvals.map((r) => [r.chat, r]));
  return drafts.map((draft, i) => {
    const hit = latest.get(draft.id);
    const approved = !!hit && hit.body === draft.text;
    const { feed, target } = chats[i]!;
    return { ...draft, feed, target, approved, approvedAt: approved ? hit!.approved_at : null, approvedBy: approved ? hit!.approved_by : null };
  });
}

export async function approveChat(sql: Sql, userId: string, chatId: string, text: string, now?: Date): Promise<{ name: string; approvedAt: string }> {
  const who = await requireTeamsAdmin(sql, userId);
  const chats = await loadTeamsChats(sql);
  const chat = chats.find((c) => c.id === chatId);
  if (!chat) throw new Error("That chat is not on the list.");
  if (chat.feed === "none") throw new Error("This chat has no automatic note, so there is nothing to approve.");
  await ensureDrafts(sql);
  const draft = draftTeamsChat(chat, await loadSnapshot(sql, chats, now));
  if (draft.text !== text) throw new Error("The desk changed. Read the new text and approve that.");
  const saved = await sql.query<{ approved_at: string }>(
    `insert into teams_drafts (chat, body, approved_by) values ($1, $2, $3) returning approved_at::text`,
    [chat.id, draft.text, who],
  );
  return { name: chat.name, approvedAt: saved[0]?.approved_at || "" };
}

export type NewTeamsChat = { name: string; group: string; kind: string; about?: string; feed: string; target?: string | null };
export type TeamsChatEdit = NewTeamsChat & { id: string };

function oneLine(raw: string | null | undefined, max: number): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The add and edit forms share these checks. A typed group reuses an existing group with the same letters, ignoring capitals. */
async function cleanChat(sql: Sql, input: NewTeamsChat, id = "") {
  const name = oneLine(input.name, 80);
  if (!name) throw new Error("Give the chat a name.");
  let group = oneLine(input.group, 40);
  if (!group) throw new Error("Pick a group for the chat.");
  if (input.kind !== "group" && input.kind !== "dm") throw new Error("Pick group chat or DM.");
  const feed = TEAMS_FEEDS.find((f) => f === input.feed);
  if (!feed) throw new Error("Pick what the chat shows.");
  let target: string | null = null;
  if (feed === "rep" || feed === "tech") {
    target = oneLine(input.target, 80);
    if (!target) throw new Error(feed === "rep" ? "Type the rep's name." : "Type the tech's name.");
  } else if (feed === "region") {
    target = oneLine(input.target, 10).toLowerCase();
    if (target !== "dfw" && target !== "sa-atx" && target !== "other") throw new Error("Pick DFW, SA/ATX or Other.");
  }
  const same = await sql.query<{ grp: string }>("select grp from teams_chats where lower(grp) = lower($1) and id <> $2 order by sort, id limit 1", [group, id]);
  if (same[0]) group = same[0].grp;
  return { name, group, kind: input.kind, about: oneLine(input.about, 200), feed, target };
}

export async function addChat(sql: Sql, userId: string, input: NewTeamsChat): Promise<{ id: string; name: string }> {
  const who = await requireTeamsAdmin(sql, userId, "add or remove a Teams chat");
  const { name, group, kind, about, feed, target } = await cleanChat(sql, input);
  await ensureDrafts(sql);
  // A removed chat's approvals stay in teams_drafts, so a new chat never reuses its id.
  const base = name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "") || "chat";
  let id = base;
  for (let n = 2; ; n += 1) {
    const taken = await sql.query("select 1 from teams_chats where id = $1 union all select 1 from teams_drafts where chat = $1 limit 1", [id]);
    if (!taken.length) break;
    id = `${base}-${n}`;
  }
  const saved = await sql.query<{ id: string }>(
    `insert into teams_chats (id, name, grp, kind, about, feed, target, sort, created_by)
     select $1, $2, $3, $4, $5, $6, $7, coalesce(max(sort), 0) + 10, $8 from teams_chats
     on conflict (id) do nothing
     returning id`,
    [id, name, group, kind, about, feed, target, who],
  );
  if (!saved.length) throw new Error("Someone just added a chat with that name. Try again.");
  return { id, name };
}

/** Same id, so the chat's approvals in teams_drafts stay linked. A note whose text changes needs approving again. */
export async function updateChat(sql: Sql, userId: string, input: TeamsChatEdit): Promise<{ id: string; name: string }> {
  await requireTeamsAdmin(sql, userId, "edit a Teams chat");
  const id = String(input.id ?? "");
  const known = await sql.query("select 1 from teams_chats where id = $1", [id]);
  if (!known.length) throw new Error("That chat is not on the list.");
  const { name, group, kind, about, feed, target } = await cleanChat(sql, input, id);
  const saved = await sql.query<{ id: string }>(
    "update teams_chats set name = $2, grp = $3, kind = $4, about = $5, feed = $6, target = $7 where id = $1 returning id",
    [id, name, group, kind, about, feed, target],
  );
  if (!saved.length) throw new Error("That chat is not on the list.");
  return { id, name };
}

export async function removeChat(sql: Sql, userId: string, id: string): Promise<{ name: string }> {
  await requireTeamsAdmin(sql, userId, "add or remove a Teams chat");
  const hit = (
    await sql.query<{ name: string; total: number }>("select name, (select count(*)::int from teams_chats) as total from teams_chats where id = $1", [id])
  )[0];
  if (!hit) throw new Error("That chat is not on the list.");
  if (hit.total <= 1) throw new Error("This is the last chat. Add another before you remove it.");
  // Only the chat goes. Its approved notes stay in teams_drafts.
  await sql.query("delete from teams_chats where id = $1", [id]);
  return { name: hit.name };
}

export const teamsChatBoard = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<TeamsChatCard[]> => {
    const sql = await ready();
    await requireTeamsAdmin(sql, context.userId);
    return chatCards(sql);
  });

export const approveTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { chat: string; text: string }) => z.object({ chat: z.string(), text: z.string().max(20_000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ name: string; approvedAt: string }> => approveChat(await ready(), context.userId, data.chat, data.text));

const chatFields = z.object({
  name: z.string().max(500),
  group: z.string().max(500),
  kind: z.string().max(20),
  about: z.string().max(1000).optional(),
  feed: z.string().max(40),
  target: z.string().max(500).nullable().optional(),
});

export const addTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: NewTeamsChat) => chatFields.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; name: string }> => addChat(await ready(), context.userId, data));

export const updateTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: TeamsChatEdit) => chatFields.extend({ id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; name: string }> => updateChat(await ready(), context.userId, data));

export const removeTeamsChat = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: string }) => z.object({ id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ name: string }> => removeChat(await ready(), context.userId, data.id));
