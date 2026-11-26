/**
 * Work Order History import, server side (Admin only). The browser reads and checks the two CSVs, then:
 *   1. Account renames: preview → Chuy ticks → apply. Nothing else happens until he says yes.
 *   2. Import preview, in batches. Saves nothing.
 *   3. Save, in batches of up to 250 work orders with their lines. Each batch is one statement, so it saves whole
 *      or not at all; batches already saved stay saved, and saving the same files again skips them (History Ref).
 *   4. Undo a run: its history rows and lines go, and the ticket fields it filled are cleared again.
 * See wo-history.ts for the rules.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import type { PartRef } from "@/lib/ops/charges";
import { renameOrMergeCustomer } from "@/lib/ops/customer-identity";
import { ensureRoster } from "@/lib/ops/roster";
import {
  HISTORY_FILL_FIELDS,
  historyInvoice,
  isNewRow,
  isSaveable,
  nameKey,
  planAccountRenames,
  planWoHistory,
  srvOf,
  techNote,
  totalsDiffer,
  LINE_KIND,
  type HistoryInvoice,
  type PlanAccount,
  type PlanTicket,
  type RenamePlanLine,
  type SavedHistory,
  type SavedTicket,
  type WoCounts,
  type WoLine,
  type WoOrder,
  type WoPlanInput,
  type WoPlanLine,
  historyInvoiceCost,
  isNoCostLineType,
  isRealDay,
  lineCostAddsUp,
  itemCodeKey,
  planLineCosts,
  HISTORY_COST_NOTE,
  COST_BASES,
  type LineCostCounts,
  type LineCostPlanLine,
  type LineCostRow,
  type SavedCostOrder,
} from "@/lib/ops/wo-history";
import { costView } from "@/lib/ops/cost-access";
import { discountShares } from "@/lib/ops/part-pricing";
import { isServiceDeptAccount } from "@/lib/ops/warehouse-invoice";
import { ofAccount, readsById } from "@/lib/ops/read-by-id";

type Query = Pick<Sql, "query">;

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireImporter(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can import work order history.");
}

async function actor(sql: Query, userId: string) {
  return (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
}

const str = (v: unknown) => (v == null || v === "" ? null : String(v));
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

// ── Account renames ──────────────────────────────────────────────────────────────────────────────────────────────────

export async function loadRenameAccounts(sql: Query) {
  const rows = await sql.query<{ id: number; name: string; archived: boolean; name_locked: boolean | null }>(
    "select id, name, archived, name_locked from directory_customers",
  );
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? ""), archived: r.archived === true, nameLocked: r.name_locked === true }));
}

export async function previewRenames(sql: Query, locations: string[]): Promise<RenamePlanLine[]> {
  return planAccountRenames(await loadRenameAccounts(sql), locations);
}

export type RenameResult = { renamed: { id: number; from: string; to: string }[]; held: { from: string; to: string; reason: string }[] };

/**
 * Rename the ticked accounts. Each is planned again first, and a rename whose new name is now taken is held, never
 * merged. The account keeps its calls, PMs and installs (the rename moves them), plus the parent it was billed under
 * and its Walk-In mark.
 */
export async function applyRenames(sql: Sql, input: { ids: number[]; locations: string[]; who: string }): Promise<RenameResult> {
  const plan = await previewRenames(sql, input.locations);
  const wanted = new Set(input.ids);
  const out: RenameResult = { renamed: [], held: [] };
  for (const r of plan.filter((p) => wanted.has(p.id))) {
    if (r.status !== "ok") {
      out.held.push({ from: r.from, to: r.to, reason: r.reason ?? "Held." });
      continue;
    }
    const taken = await sql.query<{ id: number }>("select id from directory_customers where lower(btrim(name)) = lower(btrim($1)) and id <> $2 limit 1", [r.to, r.id]);
    if (taken[0]) {
      out.held.push({ from: r.from, to: r.to, reason: `“${r.to}” became an account since the preview.` });
      continue;
    }
    const res = await renameOrMergeCustomer(sql, r.id, r.to, { force: true });
    if (res.merged) {
      // Can't happen after the check above; say so plainly if it ever does.
      out.held.push({ from: r.from, to: r.to, reason: "Merged into an existing account instead of renamed." });
      continue;
    }
    if (r.kind === "prefix") {
      await sql.query("update directory_customers set parent_account = $1, walk_in = $2, updated_at = now() where id = $3", [r.parent, r.walkIn, r.id]);
    }
    await sql
      .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, 'updated', $3)", [
        r.id,
        input.who,
        `Renamed from “${r.from}” for the Work Order History import${r.parent ? ` (billed under ${r.parent})` : ""}`,
      ])
      .catch(() => undefined);
    out.renamed.push({ id: r.id, from: r.from, to: r.to });
  }
  return out;
}

// ── Planning ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function loadPlanContext(sql: Query, orders: WoPlanInput[]) {
  const accounts: PlanAccount[] = (await sql.query<{ id: number; name: string; archived: boolean; inactive: boolean }>("select id, name, archived, inactive from directory_customers")).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    archived: r.archived === true,
    inactive: r.inactive === true,
  }));
  const activeTechs = (await sql.query<{ name: string }>("select name from desk_techs where active = true order by sort_order, id").catch(() => [])).map((r) => r.name);
  const refs = orders.map((o) => o.ref.toLowerCase());
  // Saved rows, matched on History Ref only: their fields and lines, so blanks fill and missing lines are added.
  const savedRows = await sql.query<Record<string, unknown>>(
    `select id, history_ref, job_id, customer, ${HISTORY_FILL_FIELDS.map((f) => (f.kind === "date" ? `${f.field}::text as ${f.field}` : f.field)).join(", ")}
       from wo_history where lower(history_ref) = any($1::text[])`,
    [refs],
  );
  const savedRefs = new Set(savedRows.map((r) => String(r.history_ref)));
  const savedLines = savedRows.length
    ? await sql.query<Record<string, unknown>>(
        `select history_id, line_type, item_code, description, qty, unit_price, amount, invoice_date::text as invoice_date
           from wo_history_lines where history_id = any($1::int[]) order by history_id, sort, id`,
        [savedRows.map((r) => Number(r.id))],
      )
    : [];
  const linesBy = new Map<number, SavedHistory["lines"]>();
  for (const l of savedLines) {
    const id = Number(l.history_id);
    linesBy.set(id, [
      ...(linesBy.get(id) ?? []),
      { lineType: String(l.line_type), itemCode: str(l.item_code) ?? "", description: str(l.description) ?? "", qty: num(l.qty), unitPrice: num(l.unit_price), amount: num(l.amount), invoiceDate: str(l.invoice_date) },
    ]);
  }
  const saved = new Map<string, SavedHistory>(
    savedRows.map((r) => {
      const values: SavedHistory["values"] = {};
      for (const f of HISTORY_FILL_FIELDS) values[f.field] = f.kind === "number" ? num(r[f.field]) : (r[f.field] as string | null);
      return [
        String(r.history_ref).toLowerCase(),
        { id: Number(r.id), ref: String(r.history_ref), jobId: num(r.job_id), customer: String(r.customer ?? ""), values, lines: linesBy.get(Number(r.id)) ?? [] },
      ];
    }),
  );
  const savedJobIds = [...new Set(savedRows.map((r) => num(r.job_id)).filter((v): v is number => v != null))];
  const savedTickets = new Map<number, SavedTicket>(
    (savedJobIds.length
      ? await sql.query<Record<string, unknown>>(
          "select id, updated_at::text as updated_at, technician, issue, work_done, completed_at::text as completed_at from service_jobs where id = any($1::int[])",
          [savedJobIds],
        )
      : []
    ).map((r) => [
      Number(r.id),
      { id: Number(r.id), updatedAt: String(r.updated_at ?? ""), technician: str(r.technician), issue: str(r.issue), workDone: str(r.work_done), completedAt: str(r.completed_at) },
    ]),
  );
  const wos = [...new Set(orders.map((o) => nameKey(o.wo)).filter(Boolean))];
  const tickets: PlanTicket[] = (
    await sql.query<Record<string, unknown>>(
      `select id, wo, customer, received::text as received, updated_at::text as updated_at, work_done, completed_at::text as completed_at, duplicate_of,
              technician, issue
         from service_jobs where kind = 'service' and lower(btrim(wo)) = any($1::text[])`,
      [wos],
    )
  ).map((r) => ({
    id: Number(r.id),
    wo: str(r.wo),
    customer: str(r.customer),
    received: str(r.received)?.slice(0, 10) ?? null,
    updatedAt: String(r.updated_at ?? ""),
    workDone: str(r.work_done),
    completedAt: str(r.completed_at),
    duplicateOf: num(r.duplicate_of),
    technician: str(r.technician),
    issue: str(r.issue),
  }));
  const linkedJobs = new Set(
    (await sql.query<{ job_id: number }>("select job_id from wo_history where job_id = any($1::int[])", [tickets.map((t) => t.id)])).map((r) => Number(r.job_id)),
  );
  return { accounts, activeTechs, savedRefs, saved, savedTickets, tickets, linkedJobs };
}

/** Plan rows against KatzDesk now. `lines` are the file's lines for these rows: missing ones on saved rows are listed. */
export async function planOrders(sql: Query, orders: WoPlanInput[], lines: WoLine[] = []): Promise<WoPlanLine[]> {
  return planWoHistory(orders, await loadPlanContext(sql, orders), lines);
}

// ── Saving ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function startRun(sql: Query, input: { filename: string; rowCount: number; counts: WoCounts; who: string }): Promise<number> {
  const r = await sql.query<{ id: number }>("insert into wo_history_runs (filename, row_count, counts, created_by) values ($1, $2, $3::jsonb, $4) returning id", [
    input.filename,
    input.rowCount,
    JSON.stringify(input.counts),
    input.who,
  ]);
  return Number(r[0]!.id);
}

const FILL_TYPE = { text: "text", number: "numeric", date: "date" } as const;
const H = HISTORY_FILL_FIELDS;
/** A history field is blank: text that is null or only spaces; a number or date that is null. A 0 is a value. */
const blankSql = (col: string, kind: string) => (kind === "text" ? `coalesce(btrim(${col}), '') = ''` : `${col} is null`);

/**
 * One batch, one statement: it saves whole or not at all.
 * - Only ticked rows the plan (run again now) can save.
 * - New rows (create, attach, retire-restore, removed): a History Ref already saved is skipped.
 *   Attach: the ticket must still read as it did in the preview (updated_at); if it changed, the row is skipped. Its
 *   blank Work Done and Completed are filled (kept on the row so Undo can clear them), and its blank tech and issue.
 * - Saved rows (Will Fill, Will Add Lines): only blank fields are filled, each recorded in wo_history_fills. Missing
 *   lines are added only while the row still has the lines the preview read, and its discount and line total are
 *   worked out again from all its lines. Its ticket's blank fields fill only while the ticket reads as previewed.
 * - Retire-restore: a removed account that a row in this batch saved onto is restored as Retired
 *   (archived = false, inactive = true), recorded in wo_history_retired, and logged.
 */
const SAVE_SQL = `
with input as (
  select * from unnest(
    $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::boolean[], $9::text[], $10::text[],
    $11::text[], $12::text[], $13::text[], $14::text[], $15::text[], $16::numeric[], $17::numeric[], $18::numeric[], $19::numeric[], $20::text[],
    $21::text[], $22::text[], $23::text[], $24::numeric[], $25::numeric[], $26::int[], $27::text[], $28::text[]
  ) as t(ref, wo, completed, customer, file_customer, service_location, location_source, location_needed, technician, original_tech,
         call_category, service_type, problem, work_done, parts_used, labor_hours, trip_charges, parts_amount, invoice_total, po,
         invoice_date, has_items, review_flags, discount, lines_total, job_id, seen, kind)
), lin as (
  select * from unnest(
    $29::text[], $30::int[], $31::text[], $32::text[], $33::text[], $34::text[], $35::text[], $36::text[], $37::numeric[], $38::numeric[],
    $39::numeric[], $40::text[], $41::text[]
  ) as t(ref, sort, line_type, kind, item_code, description, item_class, item_group, qty, unit_price, amount, invoice_date, invoice_customer)
), chk as (
  select i.ref, j.id as job_id,
         (coalesce(btrim(j.work_done), '') = '' and coalesce(btrim(i.work_done), '') <> '') as fill_work,
         (j.completed_at is null and i.completed is not null) as fill_done
    from input i join service_jobs j on j.id = i.job_id
   where i.kind = 'attach' and j.updated_at::text = i.seen
     for update of j
), ok as (
  select i.*, c.job_id as att_job, coalesce(c.fill_work, false) as fill_work, coalesce(c.fill_done, false) as fill_done
    from input i left join chk c on c.ref = i.ref
   where (i.kind <> 'attach' or c.ref is not null)
     and not exists (select 1 from wo_history h where lower(h.history_ref) = lower(i.ref))
), ins as (
  insert into wo_history (run_id, history_ref, wo, completed, customer, file_customer, service_location, location_source,
         location_needed, technician, original_tech, call_category, service_type, problem, work_done, parts_used, labor_hours,
         trip_charges, parts_amount, invoice_total, po, invoice_date, has_items, review_flags, discount, lines_total, job_id,
         filled_work_done, filled_completed)
  select $42::int, ref, nullif(wo, ''), nullif(completed, '')::timestamp, customer, nullif(file_customer, ''), nullif(service_location, ''),
         nullif(location_source, ''), location_needed, technician, nullif(original_tech, ''), nullif(call_category, ''),
         nullif(service_type, ''), nullif(problem, ''), nullif(work_done, ''), nullif(parts_used, ''), labor_hours, trip_charges,
         parts_amount, invoice_total, nullif(po, ''), nullif(invoice_date, '')::date, nullif(has_items, ''), nullif(review_flags, ''),
         discount, lines_total, att_job,
         case when fill_work then work_done end, case when fill_done then nullif(completed, '')::timestamp::date end
    from ok
  on conflict (history_ref) do nothing
  returning id, history_ref, customer, job_id, filled_work_done, filled_completed
), lined as (
  insert into wo_history_lines (history_id, sort, line_type, kind, item_code, description, item_class, item_group, qty, unit_price,
         amount, invoice_date, invoice_customer)
  select ins.id, l.sort, l.line_type, l.kind, nullif(l.item_code, ''), nullif(l.description, ''), nullif(l.item_class, ''),
         nullif(l.item_group, ''), l.qty, l.unit_price, l.amount, nullif(l.invoice_date, '')::date, nullif(l.invoice_customer, '')
    from lin l join ins on lower(ins.history_ref) = lower(l.ref)
  returning id, item_code, kind
), act as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select 'service', ins.job_id, $43::text, 'updated', 'Work order history from QuickBooks attached (' || ins.history_ref || ')'
    from ins where ins.job_id is not null
  returning id
),
-- Tickets: an attached ticket's blank fields, and the tickets of saved rows that still read as previewed. One update.
tf as (
  select * from jsonb_to_recordset($46::jsonb) as t(job int, seen text, ref text, attach boolean, technician text, issue text, work_done text, completed date)
), tix as (
  select distinct on (job) * from (
    select ins.job_id as job, ins.history_ref as ref, true as attach, ins.filled_work_done as work_done, ins.filled_completed as completed,
           t.technician, t.issue
      from ins left join tf t on t.job = ins.job_id and t.attach
     where ins.job_id is not null
    union all
    select t.job, t.ref, false, t.work_done, t.completed, t.technician, t.issue
      from tf t join service_jobs j on j.id = t.job
     where not t.attach and j.updated_at::text = t.seen
  ) x order by job, attach desc
), tset as (
  select x.*, j.technician as was_technician, j.issue as was_issue, j.work_done as was_work_done, j.completed_at::text as was_completed,
         (x.technician is not null and coalesce(btrim(j.technician), '') = '') as do_technician,
         (x.issue is not null and coalesce(btrim(j.issue), '') = '') as do_issue,
         (x.work_done is not null and coalesce(btrim(j.work_done), '') = '') as do_work_done,
         (x.completed is not null and j.completed_at is null) as do_completed
    from tix x join service_jobs j on j.id = x.job
), tupd as (
  update service_jobs j
     set technician = case when s.do_technician then s.technician else j.technician end,
         issue = case when s.do_issue then s.issue else j.issue end,
         work_done = case when s.do_work_done then s.work_done else j.work_done end,
         completed_at = case when s.do_completed then s.completed else j.completed_at end,
         updated_at = now()
    from tset s
   where j.id = s.job and (s.do_technician or s.do_issue or s.do_work_done or s.do_completed)
  returning j.id, j.technician, j.issue, j.work_done, j.completed_at::text as completed_at
), tlog as (
  insert into wo_history_fills (run_id, target, job_id, field, old_value, new_value)
  select $42::int, 'ticket', s.job, v.field, v.old, v.new
    from tset s join tupd u on u.id = s.job
   cross join lateral (values
     ('technician', s.was_technician, u.technician, s.do_technician),
     ('issue', s.was_issue, u.issue, s.do_issue),
     -- An attach's Work Done and Completed are kept on the history row (filled_*), as before.
     ('work_done', s.was_work_done, u.work_done, s.do_work_done and not s.attach),
     ('completed_at', s.was_completed, u.completed_at, s.do_completed and not s.attach)
   ) v(field, old, new, applied)
   where v.applied
  returning id
), tact as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select 'service', s.job, $43::text, 'updated', 'Blank fields filled from work order history (' || s.ref || ')'
    from tset s join tupd u on u.id = s.job where not s.attach
  returning id
),
-- Saved history rows: blank fields, missing lines, and the discount and line total worked out again.
hu as (
  select * from jsonb_to_recordset($44::jsonb) as u(hid int, ref text, seen_lines int, add_lines boolean,
    ${H.map((f) => `n_${f.field} ${FILL_TYPE[f.kind]}`).join(", ")}, n_discount numeric, n_lines_total numeric)
), hset as (
  select u.*, ${H.map((f) => `h.${f.field} as was_${f.field}`).join(", ")}, h.discount as was_discount, h.lines_total as was_lines_total,
         (u.add_lines and (select count(*) from wo_history_lines l where l.history_id = h.id) = u.seen_lines) as lines_ok,
         ${H.map((f) =>
           f.field === "original_tech"
             ? `(u.n_original_tech is not null and ${blankSql("h.original_tech", "text")} and ${blankSql("h.technician", "text")}) as do_original_tech`
             : `(u.n_${f.field} is not null and ${blankSql(`h.${f.field}`, f.kind)}) as do_${f.field}`,
         ).join(",\n         ")}
    from hu u join wo_history h on h.id = u.hid and lower(h.history_ref) = lower(u.ref)
     for update of h
), hupd as (
  update wo_history h
     set ${H.map((f) => `${f.field} = case when s.do_${f.field} then s.n_${f.field} else h.${f.field} end`).join(",\n         ")},
         discount = case when s.lines_ok then s.n_discount else h.discount end,
         lines_total = case when s.lines_ok then s.n_lines_total else h.lines_total end
    from hset s
   where h.id = s.hid and (s.lines_ok or ${H.map((f) => `s.do_${f.field}`).join(" or ")})
  returning h.id, ${H.map((f) => `h.${f.field}::text as r_${f.field}`).join(", ")}, h.discount::text as r_discount, h.lines_total::text as r_lines_total
), hlog as (
  insert into wo_history_fills (run_id, target, history_id, field, old_value, new_value)
  select $42::int, 'history', s.hid, v.field, v.old, v.new
    from hset s join hupd u on u.id = s.hid
   cross join lateral (values
     ${H.map((f) => `('${f.field}', s.was_${f.field}::text, u.r_${f.field}, s.do_${f.field})`).join(",\n     ")},
     ('discount', s.was_discount::text, u.r_discount, s.lines_ok),
     ('lines_total', s.was_lines_total::text, u.r_lines_total, s.lines_ok)
   ) v(field, old, new, applied)
   where v.applied
  returning history_id, field
), la as (
  select * from jsonb_to_recordset($45::jsonb) as a(hid int, sort int, line_type text, kind text, item_code text, description text,
    item_class text, item_group text, qty numeric, unit_price numeric, amount numeric, invoice_date date, invoice_customer text)
), added as (
  insert into wo_history_lines (history_id, run_id, sort, line_type, kind, item_code, description, item_class, item_group, qty, unit_price,
         amount, invoice_date, invoice_customer)
  select a.hid, $42::int, a.sort, a.line_type, a.kind, nullif(a.item_code, ''), nullif(a.description, ''), nullif(a.item_class, ''),
         nullif(a.item_group, ''), a.qty, a.unit_price, a.amount, a.invoice_date, nullif(a.invoice_customer, '')
    from la a join hset s on s.hid = a.hid and s.lines_ok
  returning id, kind
),
-- Removed accounts this batch saved history onto come back as Retired.
rpre as (
  select d.id, d.name, d.inactive from directory_customers d
   where d.archived = true
     and ((d.id = any($47::int[]) and exists (select 1 from ins where lower(btrim(ins.customer)) = lower(btrim(d.name))))
          or d.id = any($48::int[]))
), rupd as (
  update directory_customers d set archived = false, inactive = true, retired_at = now(), updated_at = now()
    from rpre where d.id = rpre.id
  returning d.id, d.name, d.retired_at
), rlog as (
  insert into wo_history_retired (run_id, customer_id, name, was_inactive, retired_at)
  select $42::int, r.id, r.name, p.inactive, r.retired_at from rupd r join rpre p on p.id = r.id
  returning id
), ract as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select 'customer', r.id, $43::text, 'updated',
         'Restored as Retired for the Work Order History import (it was removed). Retired accounts are hidden from pickers and lists and take no new tickets, installs or PMs.'
    from rupd r
  returning id
), run as (
  update wo_history_runs
     set created = created + (select count(*) from ins where job_id is null),
         attached = attached + (select count(*) from ins where job_id is not null),
         lines = lines + (select count(*) from lined) + (select count(*) from added)
   where id = $42::int and undone_at is null
  returning id
)
select (select count(*) from ins where job_id is null)::int as created,
       (select count(*) from ins where job_id is not null)::int as attached,
       (select count(*) from tupd)::int as filled,
       (select count(*) from lined where kind <> 'discount')::int as lines,
       (select count(*) from lined where kind = 'discount')::int as discount_lines,
       (select count(*) from lined where kind not in ('discount', 'labor', 'trip'))::int as part_lines,
       (select count(*) from lined l where l.kind not in ('discount', 'labor', 'trip') and exists (
          select 1 from billing_items b where lower(btrim(b.sku)) = lower(btrim(l.item_code))))::int as part_matched,
       (select count(distinct history_id) from hlog where field not in ('discount', 'lines_total'))::int as history_filled,
       (select count(*) from added where kind <> 'discount')::int as lines_added,
       (select count(*) from added where kind = 'discount')::int as discount_added,
       (select count(*) from rupd)::int as retired,
       (select coalesce(array_agg(ref), '{}') from hset where add_lines and not lines_ok) as lines_held,
       (select coalesce(array_agg(t.ref), '{}') from tf t where not t.attach and not exists (select 1 from tix x where x.job = t.job)) as tickets_held,
       (select count(*) from act)::int + (select count(*) from tact)::int + (select count(*) from ract)::int as logged,
       (select count(*) from tlog)::int as ticket_fills,
       (select count(*) from rlog)::int as retired_logged,
       (select count(*) from run)::int as run_ok`;

export type SaveBatchResult = {
  created: number;
  attached: number;
  /** Tickets whose blank fields (Work Done, Completed, tech, issue) were filled. */
  filled: number;
  /** Item lines saved with new work orders: every QuickBooks line except Discount lines. */
  lines: number;
  /** Discount lines saved. They're stored with their work order and added up into its invoice's one discount; the invoice doesn't list them as lines. */
  discountLines: number;
  /** Lines that aren't labor or trip (parts, filters, equipment, fees). */
  partLines: number;
  /** Of those, the ones whose Item Code is a part # on the Parts list; the rest show as text. */
  partMatched: number;
  /** Saved history work orders that had blank fields filled. */
  historyFilled: number;
  /** Missing item lines added to saved work orders, and missing Discount lines. */
  linesAdded: number;
  discountLinesAdded: number;
  /** Removed accounts restored as Retired. */
  retired: number;
  /** Ticked rows that weren't saved: the ticket changed since the preview, or the plan changed. */
  notSaved: { ref: string; why: string }[];
  /** Ticked rows already saved, with nothing left to fill or add. */
  alreadySaved: number;
};

const emptyResult = (): Omit<SaveBatchResult, "notSaved" | "alreadySaved"> => ({
  created: 0,
  attached: 0,
  filled: 0,
  lines: 0,
  discountLines: 0,
  partLines: 0,
  partMatched: 0,
  historyFilled: 0,
  linesAdded: 0,
  discountLinesAdded: 0,
  retired: 0,
});

export async function saveBatch(
  sql: Sql,
  input: { runId: number; orders: WoOrder[]; lines: WoLine[]; include: string[]; seen: Record<string, string>; who: string },
): Promise<SaveBatchResult> {
  const run = (await sql.query<{ undone_at: unknown }>("select undone_at from wo_history_runs where id = $1", [input.runId]))[0];
  if (!run) throw new Error("That import run isn't on the list. Start the save again.");
  if (run.undone_at) throw new Error("That import run was undone. Start the save again.");
  const wanted = new Set(input.include.map((r) => r.toLowerCase()));
  const chosen = input.orders.filter((o) => wanted.has(o.ref.toLowerCase()));
  const byRef = new Map<string, WoLine[]>();
  for (const l of input.lines) byRef.set(l.ref.toLowerCase(), [...(byRef.get(l.ref.toLowerCase()) ?? []), l]);
  const ctx = await loadPlanContext(sql, chosen);
  const plan = planWoHistory(chosen, ctx, chosen.flatMap((o) => byRef.get(o.ref.toLowerCase()) ?? []));
  const notSaved: SaveBatchResult["notSaved"] = [];
  let alreadySaved = 0;
  const rows: { o: WoOrder; p: WoPlanLine; inv: HistoryInvoice }[] = [];
  const updates: { o: WoOrder; p: WoPlanLine }[] = [];
  chosen.forEach((o, i) => {
    const p = plan[i]!;
    if (p.status === "same") {
      alreadySaved++;
      return;
    }
    if (!isSaveable(p.status) || !p.account) {
      notSaved.push({ ref: o.ref, why: p.reason ?? "Can't be saved." });
      return;
    }
    const seen = input.seen[o.ref];
    if (p.seen && seen && seen !== p.seen) {
      notSaved.push({ ref: o.ref, why: `Ticket #${p.jobId} changed after the preview. Read the files again to pick it up.` });
      return;
    }
    if (p.historyId == null && isNewRow(p.status)) rows.push({ o, p, inv: historyInvoice(byRef.get(o.ref.toLowerCase()) ?? []) });
    else updates.push({ o, p });
  });
  if (!rows.length && !updates.length) return { ...emptyResult(), notSaved, alreadySaved };
  const col = <T>(f: (r: (typeof rows)[number]) => T) => rows.map(f);
  const lineRows = rows.flatMap((r) =>
    (byRef.get(r.o.ref.toLowerCase()) ?? []).map((l, i) => ({ ref: r.o.ref, sort: i, l, kind: LINE_KIND[l.lineType] ?? "other" })),
  );
  const lcol = <T>(f: (r: (typeof lineRows)[number]) => T) => lineRows.map(f);
  const hasLines = (r: (typeof rows)[number]) => (byRef.get(r.o.ref.toLowerCase()) ?? []).length > 0;
  const fillOf = (p: WoPlanLine, target: "history" | "ticket", field: string) => p.fills.find((f) => f.target === target && f.field === field)?.value ?? null;
  // Saved rows: the blank fields to fill, and the lines to add with the totals they make.
  const historyUpdates = updates.map(({ p }) => {
    const saved = ctx.saved.get(p.ref.toLowerCase())!;
    return {
      hid: p.historyId,
      ref: p.ref,
      seen_lines: saved.lines.length,
      add_lines: p.newLines.length > 0,
      ...Object.fromEntries(HISTORY_FILL_FIELDS.map((f) => [`n_${f.field}`, fillOf(p, "history", f.field)])),
      n_discount: p.addLines ? p.addLines.discountTotal : null,
      n_lines_total: p.addLines ? p.addLines.total : null,
    };
  });
  const lineAdds = updates.flatMap(({ p }) => {
    const start = ctx.saved.get(p.ref.toLowerCase())!.lines.length;
    return p.newLines.map((l, i) => ({
      hid: p.historyId,
      sort: start + i,
      line_type: l.lineType,
      kind: LINE_KIND[l.lineType] ?? "other",
      item_code: l.itemCode,
      description: l.description,
      item_class: l.itemClass ?? "",
      item_group: l.itemGroup ?? "",
      qty: l.qty,
      unit_price: l.unitPrice,
      amount: l.amount,
      invoice_date: l.invoiceDate || null,
      invoice_customer: l.invoiceCustomer ?? "",
    }));
  });
  const ticketFills = [
    ...rows
      .filter((r) => r.p.status === "attach" && r.p.jobId != null)
      .map((r) => ({ job: r.p.jobId, seen: r.p.seen, ref: r.o.ref, attach: true, technician: fillOf(r.p, "ticket", "technician"), issue: fillOf(r.p, "ticket", "issue"), work_done: null, completed: null })),
    ...updates
      .filter(({ p }) => p.jobId != null && p.fills.some((f) => f.target === "ticket"))
      .map(({ p }) => ({
        job: p.jobId,
        seen: p.seen,
        ref: p.ref,
        attach: false,
        technician: fillOf(p, "ticket", "technician"),
        issue: fillOf(p, "ticket", "issue"),
        work_done: fillOf(p, "ticket", "work_done"),
        completed: fillOf(p, "ticket", "completed_at"),
      })),
  ];
  const retireIds = [...new Set(rows.filter((r) => r.p.status === "retire" && r.p.accountId != null).map((r) => r.p.accountId!))];
  // Saved rows on a removed account: it comes back as Retired too.
  const retireSavedIds = [...new Set(updates.filter(({ p }) => p.tags.includes("retire") && p.accountId != null).map(({ p }) => p.accountId!))];
  const res = await sql.query<Record<string, unknown>>(SAVE_SQL, [
    col((r) => r.o.ref),
    col((r) => r.o.wo),
    col((r) => r.o.completed),
    col((r) => r.p.account!),
    col((r) => r.o.customer),
    col((r) => r.o.serviceLocation),
    col((r) => r.o.locationSource),
    col((r) => r.p.locationNeeded),
    col((r) => r.p.technician),
    col((r) => r.p.originalTech ?? ""),
    col((r) => r.o.callCategory),
    col((r) => r.o.serviceType),
    col((r) => r.o.problem),
    col((r) => r.o.workDone),
    col((r) => r.o.partsUsed),
    col((r) => r.o.laborHours),
    col((r) => r.o.tripCharges),
    col((r) => r.o.partsAmount),
    col((r) => r.o.invoiceTotal),
    col((r) => r.o.po),
    col((r) => r.o.invoiceDate ?? ""),
    col((r) => r.o.hasItems),
    col((r) => r.o.reviewFlags),
    col((r) => (hasLines(r) ? r.inv.discount : null)),
    col((r) => (hasLines(r) ? r.inv.total : null)),
    col((r) => r.p.jobId),
    col((r) => r.p.seen ?? ""),
    col((r) => (r.p.status === "attach" ? "attach" : "create")),
    lcol((r) => r.ref),
    lcol((r) => r.sort),
    lcol((r) => r.l.lineType),
    lcol((r) => r.kind),
    lcol((r) => r.l.itemCode),
    lcol((r) => r.l.description),
    lcol((r) => r.l.itemClass),
    lcol((r) => r.l.itemGroup),
    lcol((r) => r.l.qty),
    lcol((r) => r.l.unitPrice),
    lcol((r) => r.l.amount),
    lcol((r) => r.l.invoiceDate ?? ""),
    lcol((r) => r.l.invoiceCustomer),
    input.runId,
    input.who,
    JSON.stringify(historyUpdates),
    JSON.stringify(lineAdds),
    JSON.stringify(ticketFills),
    retireIds,
    retireSavedIds,
  ]);
  const out = res[0] ?? {};
  if (!Number(out.run_ok)) throw new Error("That import run was undone while saving. Nothing in this batch was saved.");
  const created = Number(out.created ?? 0);
  const attached = Number(out.attached ?? 0);
  // Attach rows the statement skipped: their ticket changed between planning and saving.
  if (created + attached < rows.length) {
    const saved = new Set(
      (await sql.query<{ history_ref: string }>("select history_ref from wo_history where lower(history_ref) = any($1::text[])", [rows.map((r) => r.o.ref.toLowerCase())])).map((r) =>
        r.history_ref.toLowerCase(),
      ),
    );
    for (const r of rows) if (!saved.has(r.o.ref.toLowerCase())) notSaved.push({ ref: r.o.ref, why: `Ticket #${r.p.jobId} changed while saving. Read the files again to pick it up.` });
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : []);
  for (const ref of list(out.lines_held)) notSaved.push({ ref, why: "Its lines changed after the preview, so none were added. Read the files again to pick it up." });
  for (const ref of list(out.tickets_held)) notSaved.push({ ref, why: "Its ticket changed after the preview, so the ticket's blank fields weren't filled. Read the files again to pick it up." });
  return {
    created,
    attached,
    filled: Number(out.filled ?? 0),
    lines: Number(out.lines ?? 0),
    discountLines: Number(out.discount_lines ?? 0),
    partLines: Number(out.part_lines ?? 0),
    partMatched: Number(out.part_matched ?? 0),
    historyFilled: Number(out.history_filled ?? 0),
    linesAdded: Number(out.lines_added ?? 0),
    discountLinesAdded: Number(out.discount_added ?? 0),
    retired: Number(out.retired ?? 0),
    notSaved,
    alreadySaved,
  };
}

export async function finishRun(sql: Query, runId: number) {
  await sql.query("update wo_history_runs set finished_at = now() where id = $1", [runId]);
}

export type WoHistoryRun = {
  id: number;
  /** 'history' (work orders and their lines) or 'line_costs' (QuickBooks cost on saved lines, 11/24). */
  kind: "history" | "line_costs";
  /** A cost run: the lines that still hold the cost it wrote. */
  costLines: number;
  filename: string | null;
  rowCount: number;
  counts: WoCounts | null;
  created: number;
  attached: number;
  /** Every QuickBooks line the run saved, Discount lines included (the run's counter). */
  lines: number;
  /** The run's saved lines split as the Step 3 report counts them: item lines, and Discount lines. Null once undone. */
  itemLines: number | null;
  discountLines: number | null;
  createdBy: string | null;
  createdAt: string;
  finishedAt: string | null;
  undoneAt: string | null;
  undoneBy: string | null;
  /** History rows from this run still saved. */
  current: number;
  /** Saved work orders whose blank fields this run filled, lines it added to them, and accounts it restored as Retired. */
  rowsFilled: number;
  linesAdded: number;
  retired: string[];
};

export async function recentRuns(sql: Query, limit = 10): Promise<WoHistoryRun[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select r.*, (select count(*) from wo_history h where h.run_id = r.id)::int as current, c.item_lines, c.discount_lines,
            (select count(distinct f.history_id) from wo_history_fills f where f.run_id = r.id and f.target = 'history' and f.field not in ('discount', 'lines_total'))::int as rows_filled,
            (select count(*) from wo_history_lines l where l.run_id = r.id)::int as lines_added,
            (select count(*) from wo_history_lines l where l.cost_run_id = r.id)::int as cost_lines,
            (select coalesce(array_agg(x.name order by x.name), '{}') from wo_history_retired x where x.run_id = r.id and x.undone_at is null) as retired
       from wo_history_runs r
       left join lateral (
         select count(*) filter (where l.kind <> 'discount')::int as item_lines,
                count(*) filter (where l.kind = 'discount')::int as discount_lines
           from wo_history h join wo_history_lines l on l.history_id = h.id
          where h.run_id = r.id and l.run_id is null
       ) c on true
      -- The latest of each kind, so ten history runs never hide a cost run's Undo, or the reverse.
      where r.id in (select t.id from (select x.id, row_number() over (partition by x.kind order by x.created_at desc, x.id desc) as n
                                         from wo_history_runs x) t where t.n <= $1)
      order by r.created_at desc, r.id desc`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind === "line_costs" ? ("line_costs" as const) : ("history" as const),
    costLines: Number(r.cost_lines ?? 0),
    filename: str(r.filename),
    rowCount: Number(r.row_count ?? 0),
    counts: r.counts == null ? null : ((typeof r.counts === "string" ? JSON.parse(r.counts) : r.counts) as WoCounts),
    created: Number(r.created ?? 0),
    attached: Number(r.attached ?? 0),
    lines: Number(r.lines ?? 0),
    itemLines: r.undone_at ? null : Number(r.item_lines ?? 0),
    discountLines: r.undone_at ? null : Number(r.discount_lines ?? 0),
    createdBy: str(r.created_by),
    createdAt: iso(r.created_at) ?? "",
    finishedAt: iso(r.finished_at),
    undoneAt: iso(r.undone_at),
    undoneBy: str(r.undone_by),
    current: Number(r.current ?? 0),
    rowsFilled: r.undone_at ? 0 : Number(r.rows_filled ?? 0),
    linesAdded: Number(r.lines_added ?? 0),
    retired: Array.isArray(r.retired) ? r.retired.map(String) : typeof r.retired === "string" ? r.retired.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : [],
  }));
}

const TICKET_UNDO = [
  { field: "technician", type: "text" },
  { field: "issue", type: "text" },
  { field: "work_done", type: "text" },
  { field: "completed_at", type: "date" },
] as const;

/** Put a filled field back to what it was, but only while it still holds what the run wrote. */
const undoCol = (alias: string, fills: string, key: string, field: string, type: string) =>
  `${field} = case when exists (select 1 from ${fills} f where f.${key} = ${alias}.id and f.field = '${field}' and ${alias}.${field}::text is not distinct from f.new_value)
      then (select f.old_value from ${fills} f where f.${key} = ${alias}.id and f.field = '${field}' order by f.id limit 1)::${type} else ${alias}.${field} end`;

const UNDO_SQL = `
with live as (
  select id from wo_history_runs where id = $1 and undone_at is null and kind = 'history'
), h as (
  select * from wo_history where run_id = (select id from live)
), tfl as (
  select * from wo_history_fills where run_id = (select id from live) and target = 'ticket' and job_id is not null
), jobs as (
  select job_id as id from h where job_id is not null
  union
  select job_id from tfl
), tmatch as (
  select j.id,
         exists (select 1 from h where h.job_id = j.id and h.filled_work_done is not null and j.work_done = h.filled_work_done) as wd_attach,
         exists (select 1 from h where h.job_id = j.id and h.filled_completed is not null and j.completed_at = h.filled_completed) as ca_attach,
         ${TICKET_UNDO.map((c) => `exists (select 1 from tfl f where f.job_id = j.id and f.field = '${c.field}' and j.${c.field}::text is not distinct from f.new_value) as m_${c.field}`).join(",\n         ")},
         exists (select 1 from h where h.job_id = j.id) as attached
    from service_jobs j join jobs on jobs.id = j.id
), restore as (
  update service_jobs j
     set work_done = case when m.wd_attach then null when m.m_work_done then (select f.old_value from tfl f where f.job_id = j.id and f.field = 'work_done' order by f.id limit 1) else j.work_done end,
         completed_at = case when m.ca_attach then null when m.m_completed_at then (select f.old_value from tfl f where f.job_id = j.id and f.field = 'completed_at' order by f.id limit 1)::date else j.completed_at end,
         technician = case when m.m_technician then (select f.old_value from tfl f where f.job_id = j.id and f.field = 'technician' order by f.id limit 1) else j.technician end,
         issue = case when m.m_issue then (select f.old_value from tfl f where f.job_id = j.id and f.field = 'issue' order by f.id limit 1) else j.issue end,
         updated_at = now()
    from tmatch m
   where j.id = m.id and (m.wd_attach or m.ca_attach or m.m_work_done or m.m_completed_at or m.m_technician or m.m_issue)
  returning j.id
), act as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select 'service', m.id, $2::text, 'updated',
         case when m.attached then 'Work order history from QuickBooks removed (undo of import #' || $1::int || ')'
              else 'Blank fields filled from work order history put back (undo of import #' || $1::int || ')' end
    from tmatch m where m.attached or m.id in (select id from restore)
  returning id
),
-- Fields this run filled on work orders other runs saved (this run's own rows are deleted below).
hfl as (
  select * from wo_history_fills where run_id = (select id from live) and target = 'history' and history_id is not null
), hrev as (
  update wo_history w
     set ${HISTORY_FILL_FIELDS.map((f) => undoCol("w", "hfl", "history_id", f.field, FILL_TYPE[f.kind])).join(",\n         ")},
         -- Lines this run added are deleted: the discount and line total come from the lines left (later runs' too).
         discount = case when w.id in (select history_id from hfl where field = 'discount')
           then (select case when count(*) = 0 then null else round(coalesce(-sum(l.amount) filter (where l.kind = 'discount'), 0), 2) end
                   from wo_history_lines l where l.history_id = w.id and l.run_id is distinct from $1)
           else w.discount end,
         lines_total = case when w.id in (select history_id from hfl where field = 'lines_total')
           then (select case when count(*) = 0 then null
                        else round(coalesce(sum(l.amount) filter (where l.kind <> 'discount'), 0), 2) - round(coalesce(-sum(l.amount) filter (where l.kind = 'discount'), 0), 2) end
                   from wo_history_lines l where l.history_id = w.id and l.run_id is distinct from $1)
           else w.lines_total end
   where w.id in (select history_id from hfl) and w.run_id <> $1
  returning w.id
), lgone as (
  delete from wo_history_lines where run_id = (select id from live) and history_id in (select id from wo_history where run_id <> $1) returning id
), gone as (
  delete from wo_history where run_id = (select id from live) returning id
),
-- Accounts this run restored as Retired go back to removed, only while still Retired from this run, with nothing added since.
rr as (
  select r.* from wo_history_retired r where r.run_id = (select id from live) and r.undone_at is null
), rok as (
  select rr.* from rr join directory_customers d on d.id = rr.customer_id
   where d.archived = false and d.inactive = true and d.retired_at = rr.retired_at and d.name = rr.name
     -- This run's own ticket fills aren't something added since.
     and not exists (select 1 from service_jobs x where lower(btrim(x.customer)) = lower(btrim(rr.name)) and x.updated_at >= rr.retired_at
                       and x.id not in (select id from jobs))
     and not exists (select 1 from pm_jobs x where lower(btrim(x.customer)) = lower(btrim(rr.name)) and x.updated_at >= rr.retired_at)
     and not exists (select 1 from installs x where lower(btrim(x.customer)) = lower(btrim(rr.name)) and x.updated_at >= rr.retired_at)
     and not exists (select 1 from wo_history x where lower(btrim(x.customer)) = lower(btrim(rr.name)) and x.run_id <> $1 and x.created_at >= rr.retired_at)
), rback as (
  update directory_customers d set archived = true, inactive = rok.was_inactive, retired_at = null, updated_at = now()
    from rok where d.id = rok.customer_id
  returning d.id, d.name
), rdone as (
  update wo_history_retired r set undone_at = now() where r.id in (select id from rok) returning id
), ract as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select 'customer', b.id, $2::text, 'updated', 'Removed again: undo of Work Order History import #' || $1::int || ', which had restored it as Retired'
    from rback b
  returning id
), run as (
  update wo_history_runs set undone_at = now(), undone_by = $2 where id = $1 and undone_at is null and kind = 'history' returning id
)
select (select count(*) from gone)::int as removed, (select count(*) from restore)::int as restored,
       (select count(*) from lgone)::int as lines_removed, (select count(*) from hrev)::int as rows_cleared,
       (select coalesce(array_agg(name order by name), '{}') from rback) as accounts_back,
       (select coalesce(array_agg(rr.name order by rr.name), '{}') from rr where rr.id not in (select id from rok)) as accounts_kept,
       (select count(*) from run)::int as ok, (select count(*) from act)::int + (select count(*) from ract)::int + (select count(*) from rdone)::int as logged`;

export type UndoResult = {
  kind?: "history";
  /** History work orders this run saved, now deleted. */
  removed: number;
  /** Tickets whose filled fields were put back. */
  restored: number;
  /** Lines this run added to other runs' work orders, now deleted. */
  linesRemoved: number;
  /** Other runs' work orders whose blanks this run filled, put back. */
  rowsCleared: number;
  /** Accounts this run restored as Retired, removed again. */
  accountsBack: string[];
  /** Ones left Retired: something was added to them since, or they changed. */
  accountsKept: string[];
};

/**
 * Undo a run, removing only what it added: its history rows and their lines, the lines it added to other rows, the
 * blank fields it filled (only while they still hold what it wrote), and the accounts it restored as Retired (only while
 * still Retired from it with nothing added since). Renames are separate and stay.
 */
export async function undoRun(sql: Query, input: { runId: number; who: string }): Promise<UndoResult> {
  const res = await sql.query<Record<string, unknown>>(UNDO_SQL, [input.runId, input.who]);
  const r = res[0];
  if (!r || !Number(r.ok)) throw new Error("That run isn't on the list or was already undone.");
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.replace(/^\{|\}$/g, "").split(",").filter(Boolean) : []);
  return {
    removed: Number(r.removed),
    restored: Number(r.restored),
    linesRemoved: Number(r.lines_removed),
    rowsCleared: Number(r.rows_cleared),
    accountsBack: list(r.accounts_back),
    accountsKept: list(r.accounts_kept),
  };
}

// ── Line costs (Jesus, 11/24) ────────────────────────────────────────────────────────────────────────────────────────

/** The cost a line holds, as one text. The save stores it on the line, and Undo clears only while it still holds it. */
const costKeySql = (u: string, lc: string, basis: string, date: string, src: string, flag: string) =>
  `concat_ws('|', coalesce(to_char(${u}, 'FM9999999990.0000'), ''), coalesce(to_char(${lc}, 'FM9999999990.00'), ''),
             coalesce(${basis}, ''), coalesce(${date}::text, ''), coalesce(${src}, ''), coalesce(${flag}, ''))`;

/** The saved work orders for these History Refs, with their lines and whether their account is removed. */
export async function loadCostOrders(sql: Query, refs: string[]): Promise<Map<string, SavedCostOrder>> {
  const keys = [...new Set(refs.map((r) => r.toLowerCase()))];
  const out = new Map<string, SavedCostOrder>();
  if (!keys.length) return out;
  const rows = await sql.query<Record<string, unknown>>(
    `select h.id as history_id, lower(h.history_ref) as ref, h.customer,
            not exists (select 1 from directory_customers d where d.archived = false and lower(btrim(d.name)) = lower(btrim(h.customer))) as removed,
            l.id, l.sort, l.line_type, l.item_code, l.qty, l.amount, l.unit_cost, l.line_cost, l.cost_basis, l.cost_date::text as cost_date,
            l.cost_source, l.cost_flag
       from wo_history h left join wo_history_lines l on l.history_id = h.id
      where lower(h.history_ref) = any($1::text[])
      order by h.id, l.sort, l.id`,
    [keys],
  );
  for (const r of rows) {
    const ref = String(r.ref);
    let o = out.get(ref);
    if (!o) {
      o = { historyId: Number(r.history_id), customer: String(r.customer ?? ""), removed: r.removed === true, lines: [] };
      out.set(ref, o);
    }
    if (r.id == null) continue;
    o.lines.push({
      id: Number(r.id),
      sort: Number(r.sort),
      lineType: String(r.line_type),
      itemCode: str(r.item_code),
      qty: num(r.qty),
      amount: num(r.amount),
      unitCost: num(r.unit_cost),
      lineCost: num(r.line_cost),
      costBasis: str(r.cost_basis),
      costDate: str(r.cost_date),
      costSource: str(r.cost_source),
      costFlag: str(r.cost_flag),
    });
  }
  return out;
}

export async function previewLineCosts(sql: Query, rows: LineCostRow[]): Promise<LineCostPlanLine[]> {
  return planLineCosts(rows, await loadCostOrders(sql, rows.map((r) => r.ref)));
}

export async function startCostRun(sql: Query, input: { filename: string; rowCount: number; counts: LineCostCounts; who: string }): Promise<number> {
  const r = await sql.query<{ id: number }>(
    "insert into wo_history_runs (filename, row_count, counts, created_by, kind) values ($1, $2, $3::jsonb, $4, 'line_costs') returning id",
    [input.filename, input.rowCount, JSON.stringify(input.counts), input.who],
  );
  return Number(r[0]!.id);
}

export type CostSaveRow = Pick<LineCostRow, "ref" | "sort" | "lineType" | "itemCode" | "qty" | "amount" | "unitCost" | "lineCost" | "costBasis" | "costDate" | "costSource" | "costFlag"> & { lineId: number };

const COST_SAVE_SQL = `
with x as (
  select * from jsonb_to_recordset($2::jsonb) as x(
    line_id int, ref text, sort int, line_type text, item_key text, qty numeric, amount numeric,
    unit_cost numeric, line_cost numeric, cost_basis text, cost_date date, cost_source text, cost_flag text)
), run as (
  select id from wo_history_runs where id = $1 and kind = 'line_costs' and undone_at is null
)
update wo_history_lines l
   set unit_cost = round(x.unit_cost, 4), line_cost = round(x.line_cost, 2), cost_basis = x.cost_basis, cost_date = x.cost_date,
       cost_source = x.cost_source, cost_flag = x.cost_flag, cost_run_id = (select id from run),
       cost_run_values = ${costKeySql("round(x.unit_cost, 4)", "round(x.line_cost, 2)", "x.cost_basis", "x.cost_date", "x.cost_source", "x.cost_flag")}
  from x, wo_history h
 where exists (select 1 from run) and l.id = x.line_id
   -- The line belongs to the work order the file names, not just any line with that id (Jesus, 11/24).
   and h.id = l.history_id and lower(btrim(h.history_ref)) = lower(btrim(x.ref))
   -- Only a line with no cost at all, and still the line the preview matched (sort, type, item, qty and amount).
   and l.unit_cost is null and l.line_cost is null and l.cost_basis is null and l.cost_date is null and l.cost_source is null and l.cost_flag is null
   and l.sort = x.sort and lower(l.line_type) = lower(x.line_type) and l.kind not in ('discount', 'labor', 'trip')
   and lower(regexp_replace(coalesce(l.item_code, ''), '\\s+', '', 'g')) = x.item_key
   and l.qty is not distinct from round(x.qty, 2) and l.amount is not distinct from round(x.amount, 2)
returning l.id`;

/** The file's checks again on the server, for what the save is sent. Null when every row passes. */
export function checkCostSaveRows(rows: CostSaveRow[]): string | null {
  const seen = new Set<number>();
  for (const r of rows) {
    const at = `Line Sort ${r.sort} (${r.itemCode || "no item"})`;
    if (!String(r.ref ?? "").trim()) return `${at}: no History Ref.`;
    if (seen.has(r.lineId)) return `${at}: the same line is in the save twice.`;
    seen.add(r.lineId);
    if (isNoCostLineType(r.lineType)) return `${at}: a ${r.lineType} line doesn't take a cost.`;
    if (!(r.unitCost >= 0)) return `${at}: Unit Cost is below zero.`;
    if (!lineCostAddsUp(r.qty, r.unitCost, r.lineCost)) return `${at}: Line Cost ${r.lineCost} isn't Qty × Unit Cost.`;
    if (!(COST_BASES as readonly string[]).includes(r.costBasis)) return `${at}: Cost Basis ${r.costBasis} isn't known.`;
    if (r.costDate != null && !isRealDay(r.costDate)) return `${at}: Cost Date ${r.costDate} isn't a real day.`;
    if (r.costSource !== "quickbooks") return `${at}: Cost Source isn't quickbooks.`;
  }
  return null;
}

/** Fill the cost on these lines. A line that has any cost, or changed since the preview, is skipped. */
export async function saveCostBatch(sql: Query, input: { runId: number; rows: CostSaveRow[] }): Promise<{ filled: number; skipped: number }> {
  if (!input.rows.length) return { filled: 0, skipped: 0 };
  const payload = input.rows.map((r) => ({
    line_id: r.lineId,
    ref: r.ref,
    sort: r.sort,
    line_type: r.lineType,
    item_key: itemCodeKey(r.itemCode),
    qty: r.qty,
    amount: r.amount,
    unit_cost: r.unitCost,
    line_cost: r.lineCost,
    cost_basis: r.costBasis,
    cost_date: r.costDate,
    cost_source: r.costSource,
    cost_flag: r.costFlag,
  }));
  const done = await sql.query<{ id: number }>(COST_SAVE_SQL, [input.runId, JSON.stringify(payload)]);
  await sql.query("update wo_history_runs set lines = lines + $2 where id = $1", [input.runId, done.length]);
  return { filled: done.length, skipped: input.rows.length - done.length };
}

const COST_UNDO_SQL = `
with run as (
  update wo_history_runs set undone_at = now(), undone_by = $2
   where id = $1 and kind = 'line_costs' and undone_at is null
  returning id
), mine as (
  select l.id, l.cost_run_values is not distinct from ${costKeySql("l.unit_cost", "l.line_cost", "l.cost_basis", "l.cost_date", "l.cost_source", "l.cost_flag")} as unchanged
    from wo_history_lines l where l.cost_run_id = (select id from run)
), cleared as (
  update wo_history_lines l
     set unit_cost = null, line_cost = null, cost_basis = null, cost_date = null, cost_source = null, cost_flag = null,
         cost_run_id = null, cost_run_values = null
    from mine m where l.id = m.id and m.unchanged
  returning l.id
)
select (select count(*) from run)::int as ok, (select count(*) from cleared)::int as cleared,
       (select count(*) from mine where not unchanged)::int as kept`;

export type CostUndoResult = { kind: "line_costs"; cleared: number; kept: number };

/** Undo a cost run: clear the cost it wrote, only on lines that still hold exactly that. Nothing is deleted. */
export async function undoCostRun(sql: Query, input: { runId: number; who: string }): Promise<CostUndoResult> {
  const r = (await sql.query<{ ok: number; cleared: number; kept: number }>(COST_UNDO_SQL, [input.runId, input.who]))[0];
  if (!r || !Number(r.ok)) throw new Error("That run isn't on the list or was already undone.");
  return { kind: "line_costs", cleared: Number(r.cleared), kept: Number(r.kept) };
}

/** Undo any run: a history run as before, a cost run its own way. */
export async function undoAnyRun(sql: Query, input: { runId: number; who: string }): Promise<UndoResult | CostUndoResult> {
  const kind = (await sql.query<{ kind: string }>("select kind from wo_history_runs where id = $1", [input.runId]))[0]?.kind;
  if (kind === "line_costs") return undoCostRun(sql, input);
  return { kind: "history", ...(await undoRun(sql, input)) };
}

// ── Location Needed ──────────────────────────────────────────────────────────────────────────────────────────────────

export type LocationNeededRow = { id: number; ref: string; wo: string | null; completed: string | null; customer: string; po: string | null; srv: string | null; problem: string | null };

export async function locationNeeded(sql: Query): Promise<LocationNeededRow[]> {
  const rows = await sql.query<Record<string, unknown>>(
    "select id, history_ref, wo, completed::text as completed, customer, po, problem from wo_history where location_needed order by completed desc nulls last, id desc",
  );
  return rows.map((r) => ({
    id: Number(r.id),
    ref: String(r.history_ref),
    wo: str(r.wo),
    completed: str(r.completed),
    customer: String(r.customer ?? ""),
    po: str(r.po),
    srv: srvOf(str(r.po)),
    problem: str(r.problem)?.slice(0, 200) ?? null,
  }));
}

/** Put a Location Needed row on the account where the work was. Exact account name only. */
export async function setLocation(sql: Query, input: { id: number; account: string }) {
  const acct = (await sql.query<{ name: string }>("select name from directory_customers where archived = false and lower(btrim(name)) = lower(btrim($1)) limit 1", [input.account]))[0];
  if (!acct) throw new Error(`No account named “${input.account.trim()}”.`);
  const r = await sql.query<{ id: number }>(
    "update wo_history set customer = $1, service_location = $1, location_needed = false where id = $2 and location_needed returning id",
    [acct.name, input.id],
  );
  if (!r[0]) throw new Error("That row isn't on the Location Needed list any more.");
  return { account: acct.name };
}

// ── Reading history on an account ────────────────────────────────────────────────────────────────────────────────────

export type WoHistorySummary = {
  id: number;
  ref: string;
  wo: string | null;
  completed: string | null;
  technician: string | null;
  originalTech: string | null;
  callCategory: string | null;
  problem: string | null;
  invoiceTotal: number | null;
  /** Line total after the discount; null when there are no lines. */
  linesTotal: number | null;
  lineCount: number;
  invoiceDate: string | null;
  jobId: number | null;
  locationNeeded: boolean;
  /**
   * Only for cost viewers (Settings → Who Sees Cost and Margin, 11/24): the known QuickBooks parts cost and profit after
   * the discount. Profit is null on Katz Coffee Service Dept. (an internal account, left out of profit), with no lines, or
   * when partial: some line that needs a cost has none (Jesus, 11/24).
   */
  cost?: { cost: number; profit: number | null; costedLines: number; totalLines: number; partial: boolean; internal: boolean };
};

const SUMMARY_COLS = `h.id, h.history_ref, h.wo, h.completed::text as completed, h.technician, h.original_tech, h.call_category,
  left(h.problem, 240) as problem, h.invoice_total, h.lines_total, h.invoice_date::text as invoice_date, h.job_id, h.location_needed,
  (select count(*) from wo_history_lines l where l.history_id = h.id and l.kind <> 'discount')::int as line_count`;

/** The cost columns a summary reads, only when the caller may see cost. */
const COST_SUMMARY_COLS = `, (select coalesce(sum(l.line_cost), 0) from wo_history_lines l where l.history_id = h.id and l.kind not in ('discount', 'labor', 'trip')) as cost_known,
  (select count(*) from wo_history_lines l where l.history_id = h.id and l.kind not in ('discount', 'labor', 'trip') and l.line_cost is not null)::int as costed_lines,
  -- Counted as countsAsCostable does: parts, filters and equipment always; other non-labor lines once they hold a cost.
  (select count(*) from wo_history_lines l where l.history_id = h.id
      and (l.kind in ('part', 'filter', 'equipment') or (l.kind not in ('discount', 'labor', 'trip') and l.line_cost is not null)))::int as costable_lines,
  h.customer as cost_customer`;

function withCost(base: WoHistorySummary, r: Record<string, unknown>): WoHistorySummary {
  const cost = Math.round(Number(r.cost_known ?? 0) * 100) / 100;
  const internal = isServiceDeptAccount(str(r.cost_customer));
  const costedLines = Number(r.costed_lines ?? 0);
  const totalLines = Number(r.costable_lines ?? 0);
  // The same rule as historyInvoiceCost: a profit only when every line that needs a cost has one.
  const partial = costedLines < totalLines;
  const profit = internal || partial || base.linesTotal == null ? null : Math.round((base.linesTotal - cost) * 100) / 100;
  return { ...base, cost: { cost, profit, costedLines, totalLines, partial, internal } };
}

function summary(r: Record<string, unknown>): WoHistorySummary {
  return {
    id: Number(r.id),
    ref: String(r.history_ref),
    wo: str(r.wo),
    completed: str(r.completed),
    technician: str(r.technician),
    originalTech: str(r.original_tech),
    callCategory: str(r.call_category),
    problem: str(r.problem),
    invoiceTotal: num(r.invoice_total),
    linesTotal: num(r.lines_total),
    lineCount: Number(r.line_count ?? 0),
    invoiceDate: str(r.invoice_date),
    jobId: num(r.job_id),
    locationNeeded: r.location_needed === true,
  };
}

/**
 * An account's work orders. With `customerId` and the Accounts switch on (phase C5, Link Check), by the account's id (a
 * row with no id by its name); otherwise by its name, spaces at the ends dropped.
 */
export async function accountHistory(sql: Query, customer: string, opts: { showCost?: boolean; customerId?: number | null } = {}): Promise<WoHistorySummary[]> {
  const name = customer.trim();
  if (!name) return [];
  const byId = opts.customerId != null && (await readsById(sql, "accounts"));
  const where = ofAccount({ name: "h.customer", id: "h.customer_id", match: "trim", byId, nameParam: "$1", idParam: "$2" });
  const rows = await sql.query<Record<string, unknown>>(
    `select ${SUMMARY_COLS}${opts.showCost ? COST_SUMMARY_COLS : ""} from wo_history h where ${where} order by h.completed desc nulls last, h.id desc`,
    byId ? [name, opts.customerId] : [name],
  );
  return rows.map((r) => (opts.showCost ? withCost(summary(r), r) : summary(r)));
}

export async function jobHistory(sql: Query, jobId: number): Promise<WoHistorySummary[]> {
  const rows = await sql.query<Record<string, unknown>>(`select ${SUMMARY_COLS} from wo_history h where h.job_id = $1 order by h.id`, [jobId]);
  return rows.map(summary);
}

export type WoHistoryLineView = {
  id: number;
  lineType: string;
  kind: string;
  itemCode: string | null;
  description: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  invoiceDate: string | null;
  part: PartRef | null;
  /** Only for cost viewers (11/24): QuickBooks purchase cost, and this line's share of the invoice discount. */
  cost?: { unitCost: number | null; lineCost: number | null; costBasis: string | null; costDate: string | null; costFlag: string | null; discountShare: number; profit: number | null };
};

export type WoHistoryDetail = WoHistorySummary & {
  customer: string;
  fileCustomer: string | null;
  serviceLocation: string | null;
  locationSource: string | null;
  techNote: string | null;
  serviceType: string | null;
  problem: string | null;
  workDone: string | null;
  partsUsed: string | null;
  laborHours: number | null;
  tripCharges: number | null;
  partsAmount: number | null;
  po: string | null;
  srv: string | null;
  hasItems: string | null;
  reviewFlags: string | null;
  jobCallId: string | null;
  lines: WoHistoryLineView[];
  invoice: {
    parts: number;
    labor: number;
    subtotal: number;
    discount: number;
    total: number;
    invoiceDate: string | null;
    differs: boolean;
    /**
     * Only for cost viewers: known parts cost, lines costed, and profit after the discount (null on Service Dept.).
     * partial: some line that needs a cost has none, so profit and margin are null and uncostedSell is that sell.
     */
    cost?: { cost: number; costedLines: number; totalLines: number; partial: boolean; uncostedSell: number; profit: number | null; margin: number | null; internal: boolean; note: string };
  } | null;
};

export async function historyDetail(sql: Query, id: number, opts: { showCost?: boolean } = {}): Promise<WoHistoryDetail> {
  const h = (
    await sql.query<Record<string, unknown>>(
      `select ${SUMMARY_COLS}, h.problem as full_problem, h.customer, h.file_customer, h.service_location, h.location_source, h.service_type,
              h.work_done, h.parts_used, h.labor_hours, h.trip_charges, h.parts_amount, h.po, h.has_items, h.review_flags,
              j.call_id as job_call_id
         from wo_history h left join service_jobs j on j.id = h.job_id
        where h.id = $1`,
      [id],
    )
  )[0];
  if (!h) throw new Error("That history work order isn't on the list any more.");
  const lineRows = await sql.query<Record<string, unknown>>(
    `select l.id, l.line_type, l.kind, l.item_code, l.description, l.qty, l.unit_price, l.amount, l.invoice_date::text as invoice_date,
            ${opts.showCost ? "l.unit_cost, l.line_cost, l.cost_basis, l.cost_date::text as cost_date, l.cost_flag," : ""}
            p.id as pid, p.sku, p.mfr_part, (p.image is not null) as has_image,
            case when p.image is null then null else extract(epoch from p.image_updated_at)::bigint::text end as image_version
       from wo_history_lines l
       left join lateral (
         select * from billing_items b
          where l.item_code is not null and l.kind not in ('labor', 'trip', 'discount') and lower(btrim(b.sku)) = lower(btrim(l.item_code))
          limit 1
       ) p on true
      where l.history_id = $1
      order by l.sort, l.id`,
    [id],
  );
  const all = lineRows.map((r) => ({
    id: Number(r.id),
    lineType: String(r.line_type),
    kind: String(r.kind),
    itemCode: str(r.item_code),
    description: str(r.description),
    qty: num(r.qty),
    unitPrice: num(r.unit_price),
    amount: num(r.amount),
    invoiceDate: str(r.invoice_date),
    part:
      r.pid == null
        ? null
        : { id: Number(r.pid), sku: String(r.sku ?? ""), mpn: str(r.mfr_part), hasImage: r.has_image === true, imageVersion: str(r.image_version) },
  }));
  const inv = all.length
    ? historyInvoice(all.map((l) => ({ lineType: l.lineType, itemCode: l.itemCode ?? "", description: l.description ?? "", qty: l.qty, unitPrice: l.unitPrice, amount: l.amount, invoiceDate: l.invoiceDate })))
    : null;
  const base = summary(h);
  // Cost only for cost viewers; never in the data otherwise.
  const items = all.filter((l) => l.kind !== "discount");
  let lines: WoHistoryLineView[] = items;
  let costSummary: NonNullable<WoHistoryDetail["invoice"]>["cost"] | undefined;
  if (opts.showCost && inv) {
    const byId = new Map(lineRows.map((r) => [Number(r.id), r]));
    const shares = discountShares(items.map((l) => l.amount ?? 0), inv.discount);
    const internal = isServiceDeptAccount(str(h.customer));
    lines = items.map((l, i) => {
      const r = byId.get(l.id)!;
      const lineCost = num(r.line_cost);
      return {
        ...l,
        cost: {
          unitCost: num(r.unit_cost),
          lineCost,
          costBasis: str(r.cost_basis),
          costDate: str(r.cost_date),
          costFlag: str(r.cost_flag),
          discountShare: shares[i] ?? 0,
          profit: internal || lineCost == null ? null : Math.round(((l.amount ?? 0) - (shares[i] ?? 0) - lineCost) * 100) / 100,
        },
      };
    });
    const c = historyInvoiceCost(items.map((l) => ({ kind: l.kind, amount: l.amount, lineCost: num(byId.get(l.id)!.line_cost) })), inv.discount);
    const after = inv.subtotal - inv.discount;
    costSummary = {
      cost: c.cost,
      costedLines: c.costedLines,
      totalLines: c.totalLines,
      partial: c.partial,
      uncostedSell: c.uncostedSell,
      profit: internal ? null : c.profit,
      margin: internal || c.profit == null || !(after > 0) ? null : Math.round((c.profit / after) * 1000) / 10,
      internal,
      note: HISTORY_COST_NOTE,
    };
  }
  return {
    ...base,
    problem: str(h.full_problem),
    customer: String(h.customer ?? ""),
    fileCustomer: str(h.file_customer),
    serviceLocation: str(h.service_location),
    locationSource: str(h.location_source),
    techNote: techNote(base.originalTech),
    serviceType: str(h.service_type),
    workDone: str(h.work_done),
    partsUsed: str(h.parts_used),
    laborHours: num(h.labor_hours),
    tripCharges: num(h.trip_charges),
    partsAmount: num(h.parts_amount),
    po: str(h.po),
    srv: srvOf(str(h.po)),
    hasItems: str(h.has_items),
    reviewFlags: str(h.review_flags),
    jobCallId: str(h.job_call_id),
    lines,
    invoice: inv
      ? {
          parts: inv.parts,
          labor: inv.labor,
          subtotal: inv.subtotal,
          discount: inv.discount,
          total: inv.total,
          invoiceDate: inv.invoiceDate,
          differs: totalsDiffer(inv.total, base.invoiceTotal),
          ...(costSummary ? { cost: costSummary } : {}),
        }
      : null,
  };
}

// ── Server functions ─────────────────────────────────────────────────────────────────────────────────────────────────

const short = (n: number) => z.string().max(n);
const nnum = z.number().finite().nullable();

const planRow = z.object({
  ref: short(80).min(1),
  wo: short(80),
  completed: short(20),
  customer: short(300),
  serviceLocation: short(300),
  locationSource: short(60),
  tech: short(120),
});

const orderRow = planRow.extend({
  techStatus: short(60),
  callCategory: short(300),
  serviceType: short(300),
  problem: short(20_000),
  workDone: short(40_000),
  partsUsed: short(20_000),
  laborHours: nnum,
  tripCharges: nnum,
  partsAmount: nnum,
  invoiceTotal: nnum,
  po: short(200),
  invoiceDate: short(10).nullable(),
  hasItems: short(60),
  reviewFlags: short(2000),
});

const lineRow = z.object({
  ref: short(80).min(1),
  lineType: short(60),
  itemCode: short(300),
  description: short(2000),
  itemClass: short(120),
  itemGroup: short(300),
  qty: nnum,
  unitPrice: nnum,
  amount: nnum,
  invoiceDate: short(10).nullable(),
  invoiceCustomer: short(300),
});

export const previewWoHistoryRenames = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { locations: string[] }) => z.object({ locations: z.array(short(300)).max(20_000) }).parse(d))
  .handler(async ({ data, context }): Promise<RenamePlanLine[]> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return previewRenames(sql, data.locations);
  });

export const applyWoHistoryRenames = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[]; locations: string[] }) =>
    z.object({ ids: z.array(z.number().int().positive()).max(2000), locations: z.array(short(300)).max(20_000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RenameResult> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return applyRenames(sql, { ...data, who: await actor(sql, context.userId) });
  });

export const previewWoHistoryBatch = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  // The whole row and its lines, in the save's batches: a saved row's blanks and missing lines are compared with them.
  .validator((d: { orders: WoOrder[]; lines: WoLine[] }) => z.object({ orders: z.array(orderRow).max(300), lines: z.array(lineRow).max(20_000) }).parse(d))
  .handler(async ({ data, context }): Promise<WoPlanLine[]> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    await ensureRoster(sql);
    return planOrders(sql, data.orders, data.lines);
  });

const countsSchema = z.record(z.string(), z.number());

export const startWoHistoryRun = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; rowCount: number; counts: WoCounts }) =>
    z.object({ filename: short(400), rowCount: z.number().int().min(0), counts: countsSchema }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ runId: number }> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return { runId: await startRun(sql, { ...data, counts: data.counts as WoCounts, who: await actor(sql, context.userId) }) };
  });

export const saveWoHistoryBatch = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { runId: number; orders: WoOrder[]; lines: WoLine[]; include: string[]; seen: Record<string, string> }) =>
    z
      .object({
        runId: z.number().int().positive(),
        orders: z.array(orderRow).max(300),
        lines: z.array(lineRow).max(20_000),
        include: z.array(short(80)).max(300),
        seen: z.record(short(80), short(60)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SaveBatchResult> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    await ensureRoster(sql);
    return saveBatch(sql, { ...data, who: await actor(sql, context.userId) });
  });

export const finishWoHistoryRun = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { runId: number }) => z.object({ runId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    await finishRun(sql, data.runId);
    return { ok: true };
  });

export const listWoHistoryRuns = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<WoHistoryRun[]> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return recentRuns(sql);
  });

export const undoWoHistoryRun = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { runId: number }) => z.object({ runId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return undoAnyRun(sql, { runId: data.runId, who: await actor(sql, context.userId) });
  });

const costRow = z.object({
  line: z.number().int().nonnegative(),
  ref: short(80).min(1),
  sort: z.number().int().nonnegative(),
  lineType: short(60),
  itemCode: short(300),
  qty: nnum,
  unitPrice: nnum,
  amount: nnum,
  unitCost: z.number().finite().nonnegative(),
  lineCost: z.number().finite(),
  costBasis: z.enum(COST_BASES),
  costDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDay, "isn't a real day").nullable(),
  costSource: z.literal("quickbooks"),
  costFlag: short(300).nullable(),
});

/** Preview a slice of the line-cost file (Admin only). Writes nothing. */
export const previewHistoryLineCosts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { rows: LineCostRow[] }) => z.object({ rows: z.array(costRow).max(5000) }).parse(d))
  .handler(async ({ data, context }): Promise<LineCostPlanLine[]> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return previewLineCosts(sql, data.rows as LineCostRow[]);
  });

export const startHistoryCostRun = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; rowCount: number; counts: LineCostCounts }) =>
    z.object({ filename: short(300), rowCount: z.number().int().nonnegative(), counts: z.record(z.string(), z.number()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return { runId: await startCostRun(sql, { filename: data.filename, rowCount: data.rowCount, counts: data.counts as LineCostCounts, who: await actor(sql, context.userId) }) };
  });

export const saveHistoryCostBatch = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { runId: number; rows: CostSaveRow[] }) =>
    z
      .object({
        runId: z.number().int().positive(),
        rows: z.array(costRow.pick({ ref: true, sort: true, lineType: true, itemCode: true, qty: true, amount: true, unitCost: true, lineCost: true, costBasis: true, costDate: true, costSource: true, costFlag: true }).extend({ lineId: z.number().int().positive() })).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    const bad = checkCostSaveRows(data.rows as CostSaveRow[]);
    if (bad) throw new Error(bad);
    return saveCostBatch(sql, data as { runId: number; rows: CostSaveRow[] });
  });

export const listWoHistoryLocationNeeded = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<LocationNeededRow[]> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return locationNeeded(sql);
  });

export const setWoHistoryLocation = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; account: string }) => z.object({ id: z.number().int().positive(), account: short(300).min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return setLocation(sql, data);
  });

export const listAccountWoHistory = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string; customerId?: number }) => z.object({ customer: short(300), customerId: z.number().int().positive().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<WoHistorySummary[]> => {
    const sql = await ready();
    return accountHistory(sql, data.customer, { showCost: (await costView(sql, context.userId)).showCost, customerId: data.customerId ?? null });
  });

export const listJobWoHistory = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<WoHistorySummary[]> => jobHistory(await ready(), data.jobId));

export const getWoHistory = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<WoHistoryDetail> => {
    const sql = await ready();
    return historyDetail(sql, data.id, { showCost: (await costView(sql, context.userId)).showCost });
  });

