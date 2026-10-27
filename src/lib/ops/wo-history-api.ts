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
  historyInvoice,
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
  type WoCounts,
  type WoLine,
  type WoOrder,
  type WoPlanInput,
  type WoPlanLine,
} from "@/lib/ops/wo-history";

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
  const accounts: PlanAccount[] = (await sql.query<{ id: number; name: string; archived: boolean }>("select id, name, archived from directory_customers")).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    archived: r.archived === true,
  }));
  const activeTechs = (await sql.query<{ name: string }>("select name from desk_techs where active = true order by sort_order, id").catch(() => [])).map((r) => r.name);
  const refs = orders.map((o) => o.ref.toLowerCase());
  const savedRefs = new Set(
    (await sql.query<{ history_ref: string }>("select history_ref from wo_history where lower(history_ref) = any($1::text[])", [refs])).map((r) => r.history_ref),
  );
  const wos = [...new Set(orders.map((o) => nameKey(o.wo)).filter(Boolean))];
  const tickets: PlanTicket[] = (
    await sql.query<Record<string, unknown>>(
      `select id, wo, customer, received::text as received, updated_at::text as updated_at, work_done, completed_at::text as completed_at, duplicate_of
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
  }));
  const linkedJobs = new Set(
    (await sql.query<{ job_id: number }>("select job_id from wo_history where job_id = any($1::int[])", [tickets.map((t) => t.id)])).map((r) => Number(r.job_id)),
  );
  return { accounts, activeTechs, savedRefs, tickets, linkedJobs };
}

export async function planOrders(sql: Query, orders: WoPlanInput[]): Promise<WoPlanLine[]> {
  return planWoHistory(orders, await loadPlanContext(sql, orders));
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

/**
 * One batch, one statement: it saves whole or not at all.
 * - Only ticked rows the plan (run again now) can save: create, attach, or removed.
 * - Attach: the ticket must still read as it did in the preview (updated_at); if it changed, the row is skipped.
 *   Only its blank Work Done and Completed are filled, and what was filled is kept so Undo can clear it.
 * - A History Ref already saved is skipped.
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
  returning id, history_ref, job_id, filled_work_done, filled_completed
), fill as (
  update service_jobs j
     set work_done = coalesce(ins.filled_work_done, j.work_done),
         completed_at = coalesce(j.completed_at, ins.filled_completed),
         updated_at = now()
    from ins
   where j.id = ins.job_id and (ins.filled_work_done is not null or ins.filled_completed is not null)
  returning j.id
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
), run as (
  update wo_history_runs
     set created = created + (select count(*) from ins where job_id is null),
         attached = attached + (select count(*) from ins where job_id is not null),
         lines = lines + (select count(*) from lined)
   where id = $42::int and undone_at is null
  returning id
)
select (select count(*) from ins where job_id is null)::int as created,
       (select count(*) from ins where job_id is not null)::int as attached,
       (select count(*) from fill)::int as filled,
       (select count(*) from lined where kind <> 'discount')::int as lines,
       (select count(*) from lined where kind = 'discount')::int as discount_lines,
       (select count(*) from lined where kind not in ('discount', 'labor', 'trip'))::int as part_lines,
       (select count(*) from lined l where l.kind not in ('discount', 'labor', 'trip') and exists (
          select 1 from billing_items b where lower(btrim(b.sku)) = lower(btrim(l.item_code))))::int as part_matched,
       (select count(*) from act)::int as logged,
       (select count(*) from run)::int as run_ok`;

export type SaveBatchResult = {
  created: number;
  attached: number;
  /** Tickets whose blank Work Done or Completed date were filled. */
  filled: number;
  /** Item lines saved: every QuickBooks line except Discount lines. */
  lines: number;
  /** Discount lines saved. They're stored with their work order and added up into its invoice's one discount; the invoice doesn't list them as lines. */
  discountLines: number;
  /** Lines that aren't labor or trip (parts, filters, equipment, fees). */
  partLines: number;
  /** Of those, the ones whose Item Code is a part # on the Parts list; the rest show as text. */
  partMatched: number;
  /** Ticked rows that weren't saved: the ticket changed since the preview, or the plan changed. */
  notSaved: { ref: string; why: string }[];
  /** Ticked rows already saved by an earlier batch or run. */
  alreadySaved: number;
};

export async function saveBatch(
  sql: Sql,
  input: { runId: number; orders: WoOrder[]; lines: WoLine[]; include: string[]; seen: Record<string, string>; who: string },
): Promise<SaveBatchResult> {
  const run = (await sql.query<{ undone_at: unknown }>("select undone_at from wo_history_runs where id = $1", [input.runId]))[0];
  if (!run) throw new Error("That import run isn't on the list. Start the save again.");
  if (run.undone_at) throw new Error("That import run was undone. Start the save again.");
  const wanted = new Set(input.include.map((r) => r.toLowerCase()));
  const chosen = input.orders.filter((o) => wanted.has(o.ref.toLowerCase()));
  const plan = await planOrders(sql, chosen);
  const notSaved: SaveBatchResult["notSaved"] = [];
  let alreadySaved = 0;
  const rows: { o: WoOrder; p: WoPlanLine; inv: HistoryInvoice }[] = [];
  const byRef = new Map<string, WoLine[]>();
  for (const l of input.lines) byRef.set(l.ref.toLowerCase(), [...(byRef.get(l.ref.toLowerCase()) ?? []), l]);
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
    if (p.status === "attach" && seen && seen !== p.seen) {
      notSaved.push({ ref: o.ref, why: `Ticket #${p.jobId} changed after the preview. Read the files again to pick it up.` });
      return;
    }
    rows.push({ o, p, inv: historyInvoice(byRef.get(o.ref.toLowerCase()) ?? []) });
  });
  if (!rows.length) return { created: 0, attached: 0, filled: 0, lines: 0, discountLines: 0, partLines: 0, partMatched: 0, notSaved, alreadySaved };
  const col = <T>(f: (r: (typeof rows)[number]) => T) => rows.map(f);
  const lineRows = rows.flatMap((r) =>
    (byRef.get(r.o.ref.toLowerCase()) ?? []).map((l, i) => ({ ref: r.o.ref, sort: i, l, kind: LINE_KIND[l.lineType] ?? "other" })),
  );
  const lcol = <T>(f: (r: (typeof lineRows)[number]) => T) => lineRows.map(f);
  const hasLines = (r: (typeof rows)[number]) => (byRef.get(r.o.ref.toLowerCase()) ?? []).length > 0;
  const res = await sql.query<Record<string, number>>(SAVE_SQL, [
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
  ]);
  const out = res[0] ?? {};
  if (!Number(out.run_ok)) throw new Error("That import run was undone while saving. Nothing in this batch was saved.");
  const created = Number(out.created ?? 0);
  const attached = Number(out.attached ?? 0);
  // Attach rows the statement skipped: their ticket changed between planning and saving.
  const savedCount = created + attached;
  if (savedCount < rows.length) {
    const saved = new Set(
      (await sql.query<{ history_ref: string }>("select history_ref from wo_history where lower(history_ref) = any($1::text[])", [rows.map((r) => r.o.ref.toLowerCase())])).map((r) =>
        r.history_ref.toLowerCase(),
      ),
    );
    for (const r of rows) if (!saved.has(r.o.ref.toLowerCase())) notSaved.push({ ref: r.o.ref, why: `Ticket #${r.p.jobId} changed while saving. Read the files again to pick it up.` });
  }
  return { created, attached, filled: Number(out.filled ?? 0), lines: Number(out.lines ?? 0), discountLines: Number(out.discount_lines ?? 0), partLines: Number(out.part_lines ?? 0), partMatched: Number(out.part_matched ?? 0), notSaved, alreadySaved };
}

export async function finishRun(sql: Query, runId: number) {
  await sql.query("update wo_history_runs set finished_at = now() where id = $1", [runId]);
}

export type WoHistoryRun = {
  id: number;
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
};

export async function recentRuns(sql: Query, limit = 10): Promise<WoHistoryRun[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select r.*, (select count(*) from wo_history h where h.run_id = r.id)::int as current, c.item_lines, c.discount_lines
       from wo_history_runs r
       left join lateral (
         select count(*) filter (where l.kind <> 'discount')::int as item_lines,
                count(*) filter (where l.kind = 'discount')::int as discount_lines
           from wo_history h join wo_history_lines l on l.history_id = h.id
          where h.run_id = r.id
       ) c on true
      order by r.created_at desc, r.id desc limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
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
  }));
}

/**
 * Undo a run: its history rows and their lines are deleted, and on attached tickets only the fields the run filled
 * are cleared, and only while they still hold what the run wrote. Renames are separate and stay.
 */
export async function undoRun(sql: Query, input: { runId: number; who: string }) {
  const res = await sql.query<{ removed: number; restored: number; ok: number }>(
    `with h as (
       select * from wo_history where run_id = $1
     ), restore as (
       update service_jobs j
          set work_done = case when h.filled_work_done is not null and j.work_done = h.filled_work_done then null else j.work_done end,
              completed_at = case when h.filled_completed is not null and j.completed_at = h.filled_completed then null else j.completed_at end,
              updated_at = now()
         from h
        where j.id = h.job_id and (h.filled_work_done is not null or h.filled_completed is not null)
       returning j.id
     ), act as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'service', h.job_id, $2::text, 'updated', 'Work order history from QuickBooks removed (' || h.history_ref || ', undo)'
         from h where h.job_id is not null
       returning id
     ), gone as (
       delete from wo_history where run_id = $1 returning id
     ), run as (
       update wo_history_runs set undone_at = now(), undone_by = $2 where id = $1 and undone_at is null returning id
     )
     select (select count(*) from gone)::int as removed, (select count(*) from restore)::int as restored,
            (select count(*) from run)::int as ok, (select count(*) from act)::int as logged`,
    [input.runId, input.who],
  );
  const r = res[0];
  if (!r || !Number(r.ok)) throw new Error("That run isn't on the list or was already undone.");
  return { removed: Number(r.removed), restored: Number(r.restored) };
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
};

const SUMMARY_COLS = `h.id, h.history_ref, h.wo, h.completed::text as completed, h.technician, h.original_tech, h.call_category,
  left(h.problem, 240) as problem, h.invoice_total, h.lines_total, h.invoice_date::text as invoice_date, h.job_id, h.location_needed,
  (select count(*) from wo_history_lines l where l.history_id = h.id and l.kind <> 'discount')::int as line_count`;

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

export async function accountHistory(sql: Query, customer: string): Promise<WoHistorySummary[]> {
  const name = customer.trim();
  if (!name) return [];
  const rows = await sql.query<Record<string, unknown>>(
    `select ${SUMMARY_COLS} from wo_history h where lower(btrim(h.customer)) = lower(btrim($1)) order by h.completed desc nulls last, h.id desc`,
    [name],
  );
  return rows.map(summary);
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
  invoice: { parts: number; labor: number; subtotal: number; discount: number; total: number; invoiceDate: string | null; differs: boolean } | null;
};

export async function historyDetail(sql: Query, id: number): Promise<WoHistoryDetail> {
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
    lines: all.filter((l) => l.kind !== "discount"),
    invoice: inv
      ? {
          parts: inv.parts,
          labor: inv.labor,
          subtotal: inv.subtotal,
          discount: inv.discount,
          total: inv.total,
          invoiceDate: inv.invoiceDate,
          differs: totalsDiffer(inv.total, base.invoiceTotal),
        }
      : null,
  };
}

// ── Server functions ─────────────────────────────────────────────────────────────────────────────────────────────────

const MAX_PLAN_ROWS = 3000;
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
  .validator((d: { orders: WoPlanInput[] }) => z.object({ orders: z.array(planRow).max(MAX_PLAN_ROWS) }).parse(d))
  .handler(async ({ data, context }): Promise<WoPlanLine[]> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    await ensureRoster(sql);
    return planOrders(sql, data.orders);
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
    return undoRun(sql, { runId: data.runId, who: await actor(sql, context.userId) });
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
  .validator((d: { customer: string }) => z.object({ customer: short(300) }).parse(d))
  .handler(async ({ data }): Promise<WoHistorySummary[]> => accountHistory(await ready(), data.customer));

export const listJobWoHistory = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<WoHistorySummary[]> => jobHistory(await ready(), data.jobId));

export const getWoHistory = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<WoHistoryDetail> => historyDetail(await ready(), data.id));

