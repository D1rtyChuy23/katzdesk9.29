/**
 * Billing Backfill (NetSuite) — Admin only, preview first, one statement on confirm. The rules are in
 * billing-backfill.ts; this reads the files, loads the tickets, and writes the plan.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { isDiscountKind, type Discount } from "@/lib/ops/discount";
import {
  backfillCounts,
  backfillHash,
  backfillLogLine,
  planBackfill,
  readBackfillSheets,
  type BackfillContext,
  type BackfillPlan,
  type BackfillRead,
  type BackfillTicket,
} from "@/lib/ops/billing-backfill";
import { storeInvoicedProfit } from "@/lib/ops/charges-api";
import { LIVE_INVOICE_SQL, loadInvoices } from "@/lib/ops/ticket-billing-api";
import { INSTALL_WOS_SQL } from "@/lib/ops/wo-search";

type Q = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

export type BackfillFile = { name: string; base64: string };

export type BackfillPreview = {
  files: string[];
  sheets: BackfillRead["sheets"];
  ignored: string[];
  skippedRows: number;
  counts: ReturnType<typeof backfillCounts>;
  plans: BackfillPlan[];
  hash: string;
  /** After a confirm: what was written. */
  applied?: { tickets: number; lines: number; invoices: number };
};

/** Every sheet of each file, as rows of text. */
export function readBackfillFiles(files: BackfillFile[]): BackfillRead {
  return readBackfillSheets(
    files.map((f) => {
      if (f.base64.length > 14_000_000) throw new Error(`${f.name} is too large.`);
      const wb = XLSX.read(f.base64, { type: "base64", raw: true, cellText: true });
      return {
        file: f.name,
        sheets: wb.SheetNames.map((name) => ({
          name,
          matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: false, raw: false }),
        })),
      };
    }),
  );
}

const WO_KEY = (col: string) => `ltrim(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), '0')`;
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

/** The tickets (and the PM and Install boards) for the WOs in the files. */
export async function loadBackfillContext(sql: Q, keys: string[]): Promise<BackfillContext> {
  if (!keys.length) return { tickets: [], otherBoards: new Map() };
  const rows = await sql.query<{
    id: number;
    kind: string;
    wo: string | null;
    customer: string | null;
    technician: string | null;
    duplicate_of: number | null;
    merged_install_id: number | null;
    received: string | null;
    completed: string | null;
    ns_so: string | null;
    billed_on: string | null;
    discount_kind: string | null;
    discount_value: string | null;
    corrigo_net: string | null;
    seen: string;
  }>(
    `select j.id, j.kind, j.wo, j.customer, j.technician, j.duplicate_of, j.merged_install_id,
            to_char(j.received, 'YYYY-MM-DD') as received, to_char(j.completed_at, 'YYYY-MM-DD') as completed,
            j.ns_so, to_char(j.billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as billed_on,
            j.discount_kind, j.discount_value::text as discount_value, j.corrigo_net::text as corrigo_net, j.updated_at::text as seen
       from service_jobs j
      where ${WO_KEY("j.wo")} = any($1::text[])
      order by j.id`,
    [keys],
  );
  const ids = rows.map((r) => Number(r.id));
  const lines = ids.length
    ? await sql.query<{ job_id: number; item: string; description: string | null; qty: string; rate: string }>(
        "select job_id, item, description, qty::text as qty, rate::text as rate from ticket_charges where job_id = any($1::int[]) order by job_id, sort, id",
        [ids],
      )
    : [];
  const invoices = await loadInvoices(sql, ids.length ? ids : [0]);
  const tickets: BackfillTicket[] = rows.map((r) => {
    const id = Number(r.id);
    const discount: Discount | null =
      isDiscountKind(r.discount_kind) && Number(r.discount_value) > 0 ? { kind: r.discount_kind, value: Number(r.discount_value) } : null;
    return {
      id,
      kind: r.kind === "tlc" ? "tlc" : "service",
      wo: r.wo,
      customer: r.customer,
      technician: r.technician,
      duplicateOf: r.duplicate_of ?? null,
      mergedInstallId: r.merged_install_id == null ? null : Number(r.merged_install_id),
      received: r.received,
      completed: r.completed,
      so: r.ns_so?.trim() || null,
      billedOn: r.billed_on,
      discount,
      corrigoNet: num(r.corrigo_net),
      seen: r.seen,
      lines: lines
        .filter((l) => Number(l.job_id) === id)
        .map((l) => ({ item: l.item, description: l.description ?? "", qty: Number(l.qty), rate: Number(l.rate) })),
      invoices: (invoices.get(id) ?? []).map((i) => ({
        invoice: i.invoice,
        so: i.so,
        date: i.date,
        status: i.status,
        total: i.total,
        remaining: i.remaining,
        location: i.location ?? null,
      })),
    };
  });
  const otherBoards = new Map<string, ("pm" | "install")[]>();
  const add = (key: string, board: "pm" | "install") => {
    const list = otherBoards.get(key) ?? [];
    if (!list.includes(board)) list.push(board);
    otherBoards.set(key, list);
  };
  for (const r of await sql.query<{ k: string }>(`select distinct ${WO_KEY("wo")} as k from pm_jobs where ${WO_KEY("wo")} = any($1::text[])`, [keys])) add(r.k, "pm");
  for (const r of await sql.query<{ k: string }>(
    `select distinct ${WO_KEY("w.wo")} as k from installs i join ${INSTALL_WOS_SQL} w on w.install_id = i.id
      where i.archived = false and ${WO_KEY("w.wo")} = any($1::text[])`,
    [keys],
  )) {
    add(r.k, "install");
  }
  return { tickets, otherBoards };
}

async function requireAdmin(sql: Q, userId: string): Promise<string> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error("Only an Admin can run Billing Backfill.");
  return (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
}

/** Admin: read the files and plan every WO. Writes nothing. */
export async function previewBillingBackfillFor(sql: Q, files: BackfillFile[], userId: string): Promise<BackfillPreview> {
  await requireAdmin(sql, userId);
  return planFiles(sql, files);
}

async function planFiles(sql: Q, files: BackfillFile[]): Promise<BackfillPreview> {
  const read = readBackfillFiles(files);
  if (!read.lines.length && !read.invoices.length) {
    throw new Error(
      read.ignored.length
        ? `No WO column with charges or invoices in ${read.ignored.join(", ")}.`
        : "No rows with a WO under the header.",
    );
  }
  const keys = [...new Set([...read.lines, ...read.invoices].map((r) => r.key))];
  if (keys.length > 5000) throw new Error("Up to 5,000 WOs at a time.");
  const plans = planBackfill(read, await loadBackfillContext(sql, keys));
  return {
    files: files.map((f) => f.name),
    sheets: read.sheets,
    ignored: read.ignored,
    skippedRows: read.skipped,
    counts: backfillCounts(plans),
    plans,
    hash: backfillHash(plans),
  };
}

/**
 * One statement for the whole confirm, or nothing: every ticket is locked and must be as the plan saw it (updated_at,
 * and a ticket planned unlocked still has no live invoice). Not locked: charges, discount, Sales Order and billed
 * date, then the invoices. Locked: the invoices only. Every ticket written gets a history line.
 */
const APPLY_BACKFILL_SQL = `
with plan as (
  select * from jsonb_to_recordset($1::jsonb)
    as p(job_id int, seen text, locked boolean, write_charges boolean, dk text, dv numeric, set_so boolean, so text, billed_on date, log text)
), j as (
  select s.id, s.kind
    from service_jobs s
    join plan p on p.job_id = s.id
   where s.updated_at::text = p.seen
     and s.duplicate_of is null
     and (p.locked or not ${LIVE_INVOICE_SQL("s.id")})
     for update of s
), ok as (
  select (select count(*) from j) = (select count(*) from plan) as go
), lines as (
  select * from jsonb_to_recordset($2::jsonb) as l(job_id int, item text, description text, qty numeric, rate numeric, kind text, ord int)
), d as (
  delete from ticket_charges c
   using plan p, ok
   where ok.go and p.write_charges and not p.locked and c.job_id = p.job_id
  returning c.id
), ins as (
  insert into ticket_charges (job_id, item, description, qty, rate, kind, sort)
  select l.job_id, l.item, nullif(l.description, ''), l.qty, l.rate, l.kind, l.ord
    from lines l
    join plan p on p.job_id = l.job_id and p.write_charges and not p.locked
   cross join ok
   where ok.go
  returning id
), jobs as (
  -- Every ticket written is touched, the locked ones (invoices only) too: a save or merge that is waiting on the row,
  -- or checks updated_at, sees that it changed and writes nothing (10/28 review).
  update service_jobs s
     set discount_kind = case when p.write_charges and not p.locked then p.dk else s.discount_kind end,
         discount_value = case when p.write_charges and not p.locked then p.dv else s.discount_value end,
         ns_so = case when p.set_so and not p.locked then p.so else s.ns_so end,
         billed_at = case
           when not p.set_so or p.locked then s.billed_at
           when p.billed_on is not null then (p.billed_on)::timestamp at time zone 'America/Chicago'
           else coalesce(s.billed_at, now())
         end,
         updated_at = now()
    from plan p, ok
   where ok.go and s.id = p.job_id
  returning s.id
), invs as (
  select * from jsonb_to_recordset($3::jsonb)
    as i(job_id int, ns_invoice text, ns_so text, invoice_date date, status text, total numeric, amount_remaining numeric, source text, location text)
), up as (
  insert into ticket_invoices (job_id, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source, location, added_by)
  select i.job_id, i.ns_invoice, i.ns_so, i.invoice_date, i.status, i.total, i.amount_remaining, i.source, i.location, $4
    from invs i
   cross join ok
   where ok.go
  on conflict (job_id, (lower(btrim(ns_invoice)))) do update
     set ns_so = excluded.ns_so,
         invoice_date = excluded.invoice_date,
         status = excluded.status,
         total = excluded.total,
         amount_remaining = excluded.amount_remaining,
         source = excluded.source,
         location = coalesce(excluded.location, ticket_invoices.location),
         updated_at = now()
  returning id
), act as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select case when j.kind = 'tlc' then 'tlc' else 'service' end, p.job_id, $4, 'updated', p.log
    from plan p
    join j on j.id = p.job_id
   cross join ok
   where ok.go
  returning id
)
select (select go from ok) as go,
       (select count(*)::int from ins) as lines,
       (select count(*)::int from jobs) as jobs,
       (select count(*)::int from up) as invoices,
       (select count(*)::int from act) as logged`;

/** Admin: plan the files again and, when nothing changed since the preview, write it in one statement. */
export async function applyBillingBackfillFor(
  sql: Q,
  files: BackfillFile[],
  userId: string,
  opts: { hash: string; skip: string[] },
): Promise<BackfillPreview> {
  const actor = await requireAdmin(sql, userId);
  const before = await planFiles(sql, files);
  if (before.hash !== opts.hash) {
    throw new Error("Something changed since the preview (a ticket was edited, or another import ran). Preview the files again.");
  }
  const skip = new Set(opts.skip);
  const go = before.plans.filter((p) => (p.status === "write" || p.status === "invoices") && p.jobId != null && !skip.has(p.key));
  let applied = { tickets: 0, lines: 0, invoices: 0 };
  if (go.length) {
    const plan = go.map((p) => ({
      job_id: p.jobId,
      seen: p.seen,
      locked: p.locked,
      write_charges: !p.locked && p.charges.change && !!p.charges.next,
      dk: p.charges.nextDiscount?.kind ?? null,
      dv: p.charges.nextDiscount?.value ?? null,
      set_so: !p.locked && p.so.change && !!p.so.next,
      so: p.so.next,
      billed_on: p.so.billedOn,
      log: backfillLogLine(p),
    }));
    const lines = go.flatMap((p) =>
      !p.locked && p.charges.change && p.charges.next
        ? p.charges.next.map((l, i) => ({ job_id: p.jobId, item: l.item, description: l.description, qty: l.qty, rate: l.rate, kind: l.kind, ord: i + 1 }))
        : [],
    );
    const invoices = go.flatMap((p) =>
      p.invoices
        .filter((i) => i.change !== "same")
        .map((i) => ({
          job_id: p.jobId,
          ns_invoice: i.invoice,
          ns_so: i.so,
          invoice_date: i.date,
          status: i.status,
          total: i.total,
          amount_remaining: i.remaining,
          source: i.source,
          location: i.location,
        })),
    );
    const r = (
      await sql.query<{ go: boolean; lines: number; jobs: number; invoices: number; logged: number }>(APPLY_BACKFILL_SQL, [
        JSON.stringify(plan),
        JSON.stringify(lines),
        JSON.stringify(invoices),
        actor,
      ])
    )[0];
    if (!r?.go) throw new Error("A ticket changed while saving. Nothing was written. Preview the files again.");
    applied = { tickets: Number(r.logged), lines: Number(r.lines), invoices: Number(r.invoices) };
    // Billed tickets keep each part line's cost and margin as of now (what Mark Billed does). Worked out live otherwise.
    for (const p of go) {
      if (!p.locked && p.charges.change) await storeInvoicedProfit(sql as Sql, p.jobId!, true).catch(() => undefined);
    }
  }
  const after = await planFiles(sql, files);
  return { ...after, applied };
}

const fileInput = z.object({ name: z.string().max(300), base64: z.string().min(4).max(14_000_000) });

export const previewBillingBackfill = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { files: BackfillFile[] }) => z.object({ files: z.array(fileInput).min(1).max(2) }).parse(d))
  .handler(async ({ data, context }): Promise<BackfillPreview> => previewBillingBackfillFor(await ready(), data.files, context.userId));

export const applyBillingBackfill = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { files: BackfillFile[]; hash: string; skip: string[] }) =>
    z
      .object({
        files: z.array(fileInput).min(1).max(2),
        hash: z.string().regex(/^[0-9a-f]{16}$/),
        skip: z.array(z.string().regex(/^\d+$/)).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<BackfillPreview> =>
    applyBillingBackfillFor(await ready(), data.files, context.userId, { hash: data.hash, skip: data.skip }),
  );
