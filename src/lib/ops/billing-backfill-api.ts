/**
 * Billing Backfill (NetSuite) — Admin only, preview first, one statement on confirm. The rules are in
 * billing-backfill.ts; this reads the files, loads the tickets, installs and PMs (11/5), and writes the plan. Each
 * Write is logged as a run (billing_backfill_runs), and every record it writes gets a history line.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { applyDiscount, discountFromRow, DISCOUNT_BASE_SQL, isDiscountKind, type Discount } from "@/lib/ops/discount";
import {
  backfillCounts,
  backfillHash,
  backfillLogLine,
  planBackfill,
  readBackfillSheets,
  writesInvoice,
  type BackfillCarried,
  type BackfillContext,
  type BackfillKind,
  type BackfillPlan,
  type BackfillRead,
  type BackfillRecord,
  type BackfillTicket,
} from "@/lib/ops/billing-backfill";
import { woMatchKey } from "@/lib/ops/corrigo";
import { storeInvoicedProfit } from "@/lib/ops/charges-api";
import { BILLED_ON_INSTALL, BILLED_ON_INSTALL_SO } from "@/lib/ops/merged-ticket";
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
  /** After a confirm: what was written (tickets, installs and PMs; charge lines; invoices). */
  applied?: { tickets: number; installs: number; pms: number; lines: number; invoices: number };
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

/**
 * The tickets, installs and PMs (11/5) for the WOs in the files, and where the files' NetSuite invoices are recorded
 * already (`invoiceKeys`: soKey'd numbers).
 */
export async function loadBackfillContext(sql: Q, keys: string[], invoiceKeys: string[] = []): Promise<BackfillContext> {
  if (!keys.length) return { tickets: [], records: [], otherBoards: new Map(), recordedAt: new Map() };
  const rows = await sql.query<{
    id: number;
    kind: string;
    wo: string | null;
    customer: string | null;
    technician: string | null;
    duplicate_of: number | null;
    merged_install_id: number | null;
    billed_on_install: string | null;
    billed_so_on_install: string | null;
    received: string | null;
    completed: string | null;
    ns_so: string | null;
    billed_on: string | null;
    discount_kind: string | null;
    discount_value: string | null;
    discount_scope: string | null;
    corrigo_net: string | null;
    seen: string;
  }>(
    `select j.id, j.kind, j.wo, j.customer, j.technician, j.duplicate_of, j.merged_install_id,
            ${BILLED_ON_INSTALL("j.id")} as billed_on_install, ${BILLED_ON_INSTALL_SO("j.id")} as billed_so_on_install,
            to_char(j.received, 'YYYY-MM-DD') as received, to_char(j.completed_at, 'YYYY-MM-DD') as completed,
            j.ns_so, to_char(j.billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as billed_on,
            j.discount_kind, j.discount_value::text as discount_value, j.discount_scope, j.corrigo_net::text as corrigo_net, j.updated_at::text as seen
       from service_jobs j
      where ${WO_KEY("j.wo")} = any($1::text[])
      order by j.id`,
    [keys],
  );
  const ids = rows.map((r) => Number(r.id));
  const lines = ids.length
    ? await sql.query<{ job_id: number; item: string; description: string | null; qty: string; rate: string; discount_chosen: boolean | null }>(
        "select job_id, item, description, qty::text as qty, rate::text as rate, discount_chosen from ticket_charges where job_id = any($1::int[]) order by job_id, sort, id",
        [ids],
      )
    : [];
  const invoices = await loadInvoices(sql, ids.length ? ids : [0]);
  const tickets: BackfillTicket[] = rows.map((r) => {
    const id = Number(r.id);
    const discount = discountFromRow(r.discount_kind, r.discount_value, r.discount_scope);
    return {
      id,
      kind: r.kind === "tlc" ? "tlc" : "service",
      wo: r.wo,
      customer: r.customer,
      technician: r.technician,
      duplicateOf: r.duplicate_of ?? null,
      mergedInstallId: r.merged_install_id == null ? null : Number(r.merged_install_id),
      billedOnInstall: r.billed_on_install?.trim() || null,
      billedSoOnInstall: r.billed_so_on_install?.trim() || null,
      received: r.received,
      completed: r.completed,
      so: r.ns_so?.trim() || null,
      billedOn: r.billed_on,
      discount,
      corrigoNet: num(r.corrigo_net),
      seen: r.seen,
      lines: lines
        .filter((l) => Number(l.job_id) === id)
        .map((l) => ({ item: l.item, description: l.description ?? "", qty: Number(l.qty), rate: Number(l.rate), discountChosen: l.discount_chosen === true })),
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
  const records = await loadBackfillRecords(sql, keys);
  // What the skips said before installs and PMs took billing (11/5): kept for callers that read it.
  const otherBoards = new Map<string, ("pm" | "install")[]>();
  for (const r of records) {
    const list = otherBoards.get(r.woKey) ?? [];
    if (!list.includes(r.kind)) list.push(r.kind);
    otherBoards.set(r.woKey, list);
  }
  return { tickets, records, otherBoards, recordedAt: await loadRecordedAt(sql, invoiceKeys) };
}

/** SQL: a NetSuite invoice number the way the backfill compares them (soKey): upper case, no spaces. */
const INVOICE_KEY = (col: string) => `upper(regexp_replace(${col}, '\\s+', '', 'g'))`;

/** Where each of these NetSuite invoices is recorded already: tickets, installs and PMs. */
async function loadRecordedAt(sql: Q, invoiceKeys: string[]): Promise<Map<string, { kind: BackfillKind; id: number }[]>> {
  const out = new Map<string, { kind: BackfillKind; id: number }[]>();
  if (!invoiceKeys.length) return out;
  const rows = await sql.query<{ k: string; kind: string; id: number }>(
    `select ${INVOICE_KEY("ti.ns_invoice")} as k, case when j.kind = 'tlc' then 'tlc' else 'service' end as kind, ti.job_id as id
       from ticket_invoices ti join service_jobs j on j.id = ti.job_id
      where ${INVOICE_KEY("ti.ns_invoice")} = any($1::text[])
     union all
     select ${INVOICE_KEY("x.ns_invoice")}, case when x.install_id is not null then 'install' else 'pm' end, coalesce(x.install_id, x.pm_id)
       from record_ns_invoices x
      where ${INVOICE_KEY("x.ns_invoice")} = any($1::text[])`,
    [invoiceKeys],
  );
  for (const r of rows) {
    const list = out.get(r.k) ?? [];
    list.push({ kind: r.kind as BackfillKind, id: Number(r.id) });
    out.set(r.k, list);
  }
  return out;
}

/**
 * The installs and PMs carrying the files' WOs (11/5), one per record and WO: their dates, whether they can take
 * billing, NetSuite's billing on them from earlier runs, their own invoice in KatzDesk, and (installs) the tickets
 * merged into them as billed.
 */
export async function loadBackfillRecords(sql: Q, keys: string[]): Promise<BackfillRecord[]> {
  if (!keys.length) return [];
  const wanted = new Set(keys);
  const installs = await sql.query<{
    id: number;
    customer: string | null;
    technician: string | null;
    archived: boolean | null;
    duplicate_of: number | null;
    seen: string;
    wo: string;
    received: string | null;
    completed: string | null;
    own_row: boolean;
  }>(
    // An install's WO row has its own dates; an install's own WO (or one not on a row) takes the install's.
    `select i.id, i.customer, i.technician, i.archived, i.duplicate_of, i.updated_at::text as seen, w.wo,
            to_char(coalesce(x.received, i.received), 'YYYY-MM-DD') as received,
            to_char(coalesce(x.completed_at, i.completed_at, i.install_date), 'YYYY-MM-DD') as completed,
            (x.id is not null) as own_row
       from installs i
       join ${INSTALL_WOS_SQL} w on w.install_id = i.id
       left join install_work_orders x on x.install_id = i.id and x.wo = w.wo
      where ${WO_KEY("w.wo")} = any($1::text[])
      order by i.id, own_row desc`,
    [keys],
  );
  const pms = await sql.query<{
    id: number;
    customer: string | null;
    technician: string | null;
    wo: string;
    stacked_job_id: number | null;
    seen: string;
    received: string | null;
    completed: string | null;
  }>(
    `select p.id, p.customer, p.technician, p.wo, p.stacked_job_id, p.updated_at::text as seen,
            to_char(p.received, 'YYYY-MM-DD') as received, to_char(p.completed_at, 'YYYY-MM-DD') as completed
       from pm_jobs p
      where ${WO_KEY("p.wo")} = any($1::text[])
      order by p.id`,
    [keys],
  );
  type Base = Omit<BackfillRecord, "so" | "billedOn" | "discount" | "lines" | "invoices" | "otherNet" | "katzdesk" | "carried">;
  const bases: Base[] = [];
  const have = new Set<string>();
  for (const r of installs) {
    const woKey = woMatchKey(r.wo);
    if (!wanted.has(woKey) || have.has(`install:${r.id}:${woKey}`)) continue;
    have.add(`install:${r.id}:${woKey}`);
    bases.push({
      id: Number(r.id),
      kind: "install",
      woKey,
      wo: r.wo,
      customer: r.customer,
      technician: r.technician,
      received: r.received,
      completed: r.completed,
      blocked: r.archived
        ? `Install #${r.id} was taken off the board.`
        : r.duplicate_of
          ? `Install #${r.id} was merged into install #${r.duplicate_of}.`
          : null,
      seen: r.seen,
    });
  }
  for (const r of pms) {
    const woKey = woMatchKey(r.wo);
    if (!wanted.has(woKey)) continue;
    bases.push({
      id: Number(r.id),
      kind: "pm",
      woKey,
      wo: r.wo,
      customer: r.customer,
      technician: r.technician,
      received: r.received,
      completed: r.completed,
      blocked: r.stacked_job_id ? `PM #${r.id} is stacked on ticket #${r.stacked_job_id} and bills on it: its billing is the ticket's.` : null,
      seen: r.seen,
    });
  }
  const installIds = [...new Set(bases.filter((b) => b.kind === "install").map((b) => b.id))];
  const pmIds = [...new Set(bases.filter((b) => b.kind === "pm").map((b) => b.id))];
  const billing = await loadRecordNsBilling(sql, installIds, pmIds);
  const own = await loadKatzDeskInvoiceNets(sql, installIds, pmIds);
  const carried = await loadCarried(sql, installIds);
  return bases.map((b) => {
    const rk = `${b.kind}:${b.id}`;
    const mine = billing.headers.filter((h) => h.record === rk);
    const here = mine.find((h) => h.woKey === b.woKey);
    return {
      ...b,
      so: here?.so ?? null,
      billedOn: here?.billedOn ?? null,
      discount: here?.discount ?? null,
      lines: here?.lines ?? [],
      invoices: billing.invoices.filter((i) => i.record === rk).map(({ record: _r, ...i }) => i),
      otherNet: Math.round(mine.filter((h) => h !== here).reduce((s, h) => s + h.net, 0) * 100) / 100,
      nsWos: mine.map((h) => ({ woKey: h.woKey, net: h.net, charges: h.lines.length > 0 || !!h.discount })),
      katzdesk: own.get(rk) ?? null,
      carried: b.kind === "install" ? (carried.get(b.id) ?? []) : [],
    };
  });
}

export type RecordNsHeader = {
  id: number;
  /** "install:12" / "pm:7". */
  record: string;
  wo: string;
  woKey: string;
  so: string | null;
  billedOn: string | null;
  discount: Discount | null;
  lines: { item: string; description: string; qty: number; rate: number }[];
  subtotal: number;
  off: number;
  /** The lines after the discount. */
  net: number;
};

export type RecordNsInvoice = {
  record: string;
  woKey: string | null;
  invoice: string;
  so: string | null;
  date: string | null;
  status: string;
  total: number | null;
  remaining: number | null;
  location: string | null;
};

/** NetSuite's billing on these installs and PMs: each WO's header with its lines, and their invoices. */
export async function loadRecordNsBilling(sql: Q, installIds: number[], pmIds: number[]): Promise<{ headers: RecordNsHeader[]; invoices: RecordNsInvoice[] }> {
  if (!installIds.length && !pmIds.length) return { headers: [], invoices: [] };
  const heads = await sql.query<{
    id: number;
    record_key: string;
    wo: string;
    wo_key: string;
    ns_so: string | null;
    billed_on: string | null;
    discount_kind: string | null;
    discount_value: string | null;
  }>(
    `select b.id, b.record_key, b.wo, b.wo_key, b.ns_so, to_char(b.billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as billed_on,
            b.discount_kind, b.discount_value::text as discount_value
       from record_ns_billing b
      where b.install_id = any($1::int[]) or b.pm_id = any($2::int[])
      -- An install's WOs in their order (WO-0831 before WO-0855), whichever was written first.
      order by b.record_key, length(b.wo_key), b.wo_key, b.id`,
    [installIds, pmIds],
  );
  const lines = heads.length
    ? await sql.query<{ billing_id: number; item: string; description: string | null; qty: string; rate: string }>(
        "select billing_id, item, description, qty::text as qty, rate::text as rate from record_ns_charges where billing_id = any($1::int[]) order by billing_id, sort, id",
        [heads.map((h) => Number(h.id))],
      )
    : [];
  const invoices = await sql.query<{
    record_key: string;
    wo_key: string | null;
    ns_invoice: string;
    ns_so: string | null;
    invoice_date: string | null;
    status: string;
    total: string | null;
    amount_remaining: string | null;
    location: string | null;
  }>(
    `select record_key, wo_key, ns_invoice, ns_so, to_char(invoice_date, 'YYYY-MM-DD') as invoice_date, status, total::text as total,
            amount_remaining::text as amount_remaining, location
       from record_ns_invoices
      where install_id = any($1::int[]) or pm_id = any($2::int[])
      order by record_key, invoice_date nulls last, id`,
    [installIds, pmIds],
  );
  return {
    headers: heads.map((h) => {
      const discount: Discount | null =
        isDiscountKind(h.discount_kind) && Number(h.discount_value) > 0 ? { kind: h.discount_kind, value: Number(h.discount_value) } : null;
      const mine = lines
        .filter((l) => Number(l.billing_id) === Number(h.id))
        .map((l) => ({ item: l.item, description: l.description ?? "", qty: Number(l.qty), rate: Number(l.rate) }));
      const t = applyDiscount(mine.reduce((s, l) => s + Math.round(l.qty * l.rate * 100) / 100, 0), discount);
      return {
        id: Number(h.id),
        record: h.record_key,
        wo: h.wo,
        woKey: h.wo_key,
        so: h.ns_so?.trim() || null,
        billedOn: h.billed_on,
        discount,
        lines: mine,
        subtotal: t.subtotal,
        off: t.off,
        net: t.total,
      };
    }),
    invoices: invoices.map((i) => ({
      record: i.record_key,
      woKey: i.wo_key,
      invoice: i.ns_invoice,
      so: i.ns_so,
      date: i.invoice_date,
      status: i.status,
      total: num(i.total),
      remaining: num(i.amount_remaining),
      location: i.location,
    })),
  };
}

/** Each install's and PM's own invoice in KatzDesk (the Invoice window), when it has lines: how many, and its total after its discount. */
export async function loadKatzDeskInvoiceNets(sql: Q, installIds: number[], pmIds: number[]): Promise<Map<string, { lines: number; net: number }>> {
  const out = new Map<string, { lines: number; net: number }>();
  if (!installIds.length && !pmIds.length) return out;
  const rows = await sql.query<{ entity_type: string; entity_id: number; discount_kind: string | null; discount_value: string | null; discount_scope: string | null; lines: number; subtotal: string; base: string }>(
    `select i.entity_type, i.entity_id, i.discount_kind, i.discount_value::text as discount_value, i.discount_scope, count(l.id)::int as lines,
            coalesce(sum(round(l.qty * l.rate, 2)), 0)::text as subtotal,
            ${DISCOUNT_BASE_SQL("l", "i.discount_scope")}::text as base
       from invoices i
       left join invoice_lines l on l.invoice_id = i.id
      where (i.entity_type = 'install' and i.entity_id = any($1::int[])) or (i.entity_type = 'pm' and i.entity_id = any($2::int[]))
      group by i.id`,
    [installIds, pmIds],
  );
  for (const r of rows) {
    if (!Number(r.lines)) continue;
    // Off the lines it comes off: on Chosen lines, the ticked ones (11/7).
    const discount = discountFromRow(r.discount_kind, r.discount_value, r.discount_scope);
    out.set(`${r.entity_type}:${Number(r.entity_id)}`, { lines: Number(r.lines), net: applyDiscount(Number(r.subtotal), discount, Number(r.base)).total });
  }
  return out;
}

/** The tickets merged into these installs as billed (10/30), by install: what their billing is on, and their invoices now. */
async function loadCarried(sql: Q, installIds: number[]): Promise<Map<number, BackfillCarried[]>> {
  const out = new Map<number, BackfillCarried[]>();
  if (!installIds.length) return out;
  const rows = await sql.query<{ job_id: number; install_id: number; so: string | null; named: string | null }>(
    `select j.id as job_id, j.merged_install_id as install_id, m.moved->>'billedSo' as so, m.moved->>'billedInvoices' as named
       from service_jobs j
       join lateral (
         select moved from ticket_install_merges m
          where m.job_id = j.id and coalesce(m.moved->>'billedOn', m.moved->>'billedSo') is not null
          order by m.id desc limit 1
       ) m on true
      where j.merged_install_id = any($1::int[])
      order by j.id`,
    [installIds],
  );
  if (!rows.length) return out;
  const invoices = await loadInvoices(sql, rows.map((r) => Number(r.job_id)));
  const key = (s: string | null | undefined) => String(s ?? "").toUpperCase().replace(/\s+/g, "");
  for (const r of rows) {
    const list = out.get(Number(r.install_id)) ?? [];
    list.push({
      jobId: Number(r.job_id),
      sos: r.so?.trim() ? [key(r.so)] : [],
      named: String(r.named ?? "").split(",").map(key).filter(Boolean),
      invoices: (invoices.get(Number(r.job_id)) ?? []).map((i) => ({
        invoice: i.invoice,
        so: i.so,
        date: i.date,
        status: i.status,
        total: i.total,
        remaining: i.remaining,
        location: i.location ?? null,
      })),
    });
    out.set(Number(r.install_id), list);
  }
  return out;
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
  const invoiceKeys = [...new Set(read.invoices.map((i) => i.invoice.toUpperCase().replace(/\s+/g, "")).filter(Boolean))];
  const plans = planBackfill(read, await loadBackfillContext(sql, keys, invoiceKeys));
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
 * One statement for the whole confirm, or nothing: every ticket, install and PM is locked and must be as the plan saw
 * it (updated_at; one planned unlocked still has no live invoice, an install is still on the board and unmerged, a PM
 * still unstacked). Not locked: charges, discount, Sales Order and billed date, then the invoices. Locked: the
 * invoices only. Every record written gets a history line, and the run is logged.
 *
 * Tickets ($1-$3): their charges are ticket_charges, their SO and billed date on service_jobs, their invoices in
 * ticket_invoices. Installs and PMs ($5-$7, 11/5): each WO's NetSuite billing in record_ns_billing with its lines in
 * record_ns_charges, and their invoices in record_ns_invoices. $4: who; $8: the run (files, WO count, preview counts).
 */
export const APPLY_BACKFILL_SQL = `
with plan as (
  select * from jsonb_to_recordset($1::jsonb)
    as p(job_id int, seen text, locked boolean, write_charges boolean, dk text, dv numeric, set_so boolean, so text, billed_on date, log text)
), rplan as (
  select * from jsonb_to_recordset($5::jsonb)
    as p(rtype text, rid int, seen text, locked boolean, wo text, wo_key text, write_charges boolean, dk text, dv numeric, set_so boolean, so text, billed_on date, log text)
), j as (
  select s.id, s.kind
    from service_jobs s
    join plan p on p.job_id = s.id
   where s.updated_at::text = p.seen
     -- A ticket merged into an install as billed, on its Sales Order or its NetSuite invoices, takes its invoices only
     -- (10/30).
     and (s.duplicate_of is null or (p.locked and ${BILLED_ON_INSTALL("s.id")} is not null))
     and (p.locked or not ${LIVE_INVOICE_SQL("s.id")})
     for update of s
), ri as (
  select i.id
    from installs i
    join rplan p on p.rtype = 'install' and p.rid = i.id
   where i.updated_at::text = p.seen
     and i.archived = false and i.duplicate_of is null
     for update of i
), rp as (
  select m.id
    from pm_jobs m
    join rplan p on p.rtype = 'pm' and p.rid = m.id
   where m.updated_at::text = p.seen
     and m.stacked_job_id is null
     for update of m
), ok as (
  select (select count(*) from j) = (select count(*) from plan)
     and (select count(*) from ri) + (select count(*) from rp) = (select count(*) from rplan) as go
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
         -- NetSuite's lines come in unticked, under its header discount: the Whole bill (11/7).
         discount_scope = case when p.write_charges and not p.locked then 'all' else s.discount_scope end,
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
), hdr as (
  -- One WO's NetSuite billing on an install or a PM, written whole: what the plan changes, else what it had (the record
  -- row is locked above, so the header read here is the one the plan saw).
  insert into record_ns_billing (install_id, pm_id, wo, wo_key, ns_so, billed_at, discount_kind, discount_value, updated_by)
  select case when p.rtype = 'install' then p.rid end,
         case when p.rtype = 'pm' then p.rid end,
         p.wo,
         p.wo_key,
         case when p.set_so then p.so else b.ns_so end,
         case
           when not p.set_so then b.billed_at
           when p.billed_on is not null then (p.billed_on)::timestamp at time zone 'America/Chicago'
           else coalesce(b.billed_at, now())
         end,
         case when p.write_charges then p.dk else b.discount_kind end,
         case when p.write_charges then p.dv else b.discount_value end,
         $4
    from rplan p
   cross join ok
    left join record_ns_billing b on b.record_key = p.rtype || ':' || p.rid::text and b.wo_key = p.wo_key
   where ok.go and not p.locked and (p.write_charges or p.set_so)
  on conflict (record_key, wo_key) do update
     set wo = excluded.wo,
         ns_so = excluded.ns_so,
         billed_at = excluded.billed_at,
         discount_kind = excluded.discount_kind,
         discount_value = excluded.discount_value,
         updated_by = excluded.updated_by,
         updated_at = now()
  returning id, record_key, wo_key
), rlines as (
  select * from jsonb_to_recordset($6::jsonb) as l(rtype text, rid int, wo_key text, item text, description text, qty numeric, rate numeric, kind text, ord int)
), rd as (
  delete from record_ns_charges c
   using record_ns_billing b, rplan p, ok
   where ok.go and p.write_charges and not p.locked
     and c.billing_id = b.id and b.record_key = p.rtype || ':' || p.rid::text and b.wo_key = p.wo_key
  returning c.id
), rins as (
  insert into record_ns_charges (billing_id, item, description, qty, rate, kind, sort)
  select h.id, l.item, nullif(l.description, ''), l.qty, l.rate, l.kind, l.ord
    from rlines l
    join rplan p on p.rtype = l.rtype and p.rid = l.rid and p.wo_key = l.wo_key and p.write_charges and not p.locked
    join hdr h on h.record_key = l.rtype || ':' || l.rid::text and h.wo_key = l.wo_key
  returning id
), rtouch_i as (
  -- Touched like tickets: a save that waits on the row, or checks updated_at, sees the change.
  update installs i set updated_at = now()
    from (select distinct rid from rplan where rtype = 'install') p, ok
   where ok.go and i.id = p.rid
  returning i.id
), rtouch_p as (
  update pm_jobs m set updated_at = now()
    from (select distinct rid from rplan where rtype = 'pm') p, ok
   where ok.go and m.id = p.rid
  returning m.id
), rinvs as (
  select * from jsonb_to_recordset($7::jsonb)
    as i(rtype text, rid int, wo_key text, ns_invoice text, ns_so text, invoice_date date, status text, total numeric, amount_remaining numeric, source text, location text)
), rup as (
  insert into record_ns_invoices (install_id, pm_id, wo_key, ns_invoice, ns_so, invoice_date, status, total, amount_remaining, source, location, added_by)
  select case when i.rtype = 'install' then i.rid end, case when i.rtype = 'pm' then i.rid end, i.wo_key,
         i.ns_invoice, i.ns_so, i.invoice_date, i.status, i.total, i.amount_remaining, i.source, i.location, $4
    from rinvs i
   cross join ok
   where ok.go
  on conflict (record_key, (lower(btrim(ns_invoice)))) do update
     set ns_so = excluded.ns_so,
         invoice_date = excluded.invoice_date,
         status = excluded.status,
         total = excluded.total,
         amount_remaining = excluded.amount_remaining,
         source = excluded.source,
         location = coalesce(excluded.location, record_ns_invoices.location),
         -- Refreshed where it is: an invoice that came in on another of the install's WOs stays under that one.
         wo_key = coalesce(record_ns_invoices.wo_key, excluded.wo_key),
         updated_at = now()
  returning id
), ract as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select p.rtype, p.rid, $4, 'updated', p.log
    from rplan p
   cross join ok
   where ok.go
  returning id
), run as (
  insert into billing_backfill_runs (run_by, files, wos, counts, written)
  select $4, $8::jsonb->>'files', ($8::jsonb->>'wos')::int, $8::jsonb->'counts',
         jsonb_build_object(
           'tickets', (select count(*) from act),
           'installs', (select count(*) from rtouch_i),
           'pms', (select count(*) from rtouch_p),
           'lines', (select count(*) from ins) + (select count(*) from rins),
           'invoices', (select count(*) from up) + (select count(*) from rup)
         )
    from ok
   where ok.go
  returning id
)
select (select go from ok) as go,
       (select count(*)::int from ins) as lines,
       (select count(*)::int from jobs) as jobs,
       (select count(*)::int from up) as invoices,
       (select count(*)::int from act) as logged,
       (select count(*)::int from rins) as record_lines,
       (select count(*)::int from rtouch_i) as installs,
       (select count(*)::int from rtouch_p) as pms,
       (select count(*)::int from rup) as record_invoices,
       (select count(*)::int from ract) as record_logged,
       (select id from run) as run_id`;

/** The record a plan writes, as the statement's rows name it. */
const recordOf = (p: BackfillPlan) => ({ rtype: p.kind as "install" | "pm", rid: p.recordId, wo_key: p.key });

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
    throw new Error("Something changed since the preview (a record was edited, or another import ran). Preview the files again.");
  }
  const skip = new Set(opts.skip);
  const go = before.plans.filter((p) => (p.status === "write" || p.status === "invoices") && p.recordId != null && !skip.has(p.key));
  const tickets = go.filter((p) => p.jobId != null);
  const records = go.filter((p) => p.jobId == null && (p.kind === "install" || p.kind === "pm"));
  let applied = { tickets: 0, installs: 0, pms: 0, lines: 0, invoices: 0 };
  if (tickets.length || records.length) {
    const plan = tickets.map((p) => ({
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
    const lines = tickets.flatMap((p) =>
      !p.locked && p.charges.change && p.charges.next
        ? p.charges.next.map((l, i) => ({ job_id: p.jobId, item: l.item, description: l.description, qty: l.qty, rate: l.rate, kind: l.kind, ord: i + 1 }))
        : [],
    );
    const invoices = tickets.flatMap((p) =>
      p.invoices.filter(writesInvoice).map((i) => ({
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
    const rplan = records.map((p) => ({
      ...recordOf(p),
      seen: p.seen,
      locked: p.locked,
      wo: p.wo,
      write_charges: !p.locked && p.charges.change && !!p.charges.next,
      dk: p.charges.nextDiscount?.kind ?? null,
      dv: p.charges.nextDiscount?.value ?? null,
      set_so: !p.locked && p.so.change && !!p.so.next,
      so: p.so.next,
      billed_on: p.so.billedOn,
      log: backfillLogLine(p),
    }));
    const rlines = records.flatMap((p) =>
      !p.locked && p.charges.change && p.charges.next
        ? p.charges.next.map((l, i) => ({ ...recordOf(p), item: l.item, description: l.description, qty: l.qty, rate: l.rate, kind: l.kind, ord: i + 1 }))
        : [],
    );
    const rinvoices = records.flatMap((p) =>
      p.invoices.filter(writesInvoice).map((i) => ({
        ...recordOf(p),
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
    const run = { files: files.map((f) => f.name).join(", "), wos: before.plans.length, counts: before.counts };
    const r = (
      await sql.query<{
        go: boolean;
        lines: number;
        invoices: number;
        logged: number;
        record_lines: number;
        installs: number;
        pms: number;
        record_invoices: number;
      }>(APPLY_BACKFILL_SQL, [
        JSON.stringify(plan),
        JSON.stringify(lines),
        JSON.stringify(invoices),
        actor,
        JSON.stringify(rplan),
        JSON.stringify(rlines),
        JSON.stringify(rinvoices),
        JSON.stringify(run),
      ])
    )[0];
    if (!r?.go) throw new Error("A record changed while saving. Nothing was written. Preview the files again.");
    applied = {
      tickets: Number(r.logged),
      installs: Number(r.installs),
      pms: Number(r.pms),
      lines: Number(r.lines) + Number(r.record_lines),
      invoices: Number(r.invoices) + Number(r.record_invoices),
    };
    // Billed tickets keep each part line's cost and margin as of now (what Mark Billed does). Worked out live otherwise.
    for (const p of tickets) {
      if (!p.locked && p.charges.change) await storeInvoicedProfit(sql as Sql, p.jobId!, true).catch(() => undefined);
    }
  }
  const after = await planFiles(sql, files);
  return { ...after, applied };
}

export type BackfillRun = {
  id: number;
  at: string;
  by: string | null;
  files: string | null;
  wos: number | null;
  written: { tickets: number; installs: number; pms: number; lines: number; invoices: number } | null;
};

/** Admin: the latest Billing Backfill runs (Writes), newest first. */
export async function listBackfillRunsFor(sql: Q, userId: string, limit = 10): Promise<BackfillRun[]> {
  await requireAdmin(sql, userId);
  const rows = await sql.query<{ id: number; run_at: unknown; run_by: string | null; files: string | null; wos: number | null; written: unknown }>(
    "select id, run_at, run_by, files, wos, written from billing_backfill_runs order by run_at desc, id desc limit $1",
    [limit],
  );
  return rows.map((r) => {
    const w = (typeof r.written === "string" ? JSON.parse(r.written) : r.written) as Record<string, unknown> | null;
    return {
      id: Number(r.id),
      at: r.run_at instanceof Date ? r.run_at.toISOString() : String(r.run_at),
      by: r.run_by,
      files: r.files,
      wos: r.wos == null ? null : Number(r.wos),
      written: w
        ? { tickets: Number(w.tickets) || 0, installs: Number(w.installs) || 0, pms: Number(w.pms) || 0, lines: Number(w.lines) || 0, invoices: Number(w.invoices) || 0 }
        : null,
    };
  });
}

const fileInput = z.object({ name: z.string().max(300), base64: z.string().min(4).max(14_000_000) });

export const previewBillingBackfill = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { files: BackfillFile[] }) => z.object({ files: z.array(fileInput).min(1).max(2) }).parse(d))
  .handler(async ({ data, context }): Promise<BackfillPreview> => previewBillingBackfillFor(await ready(), data.files, context.userId));

export const listBillingBackfillRuns = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<BackfillRun[]> => listBackfillRunsFor(await ready(), context.userId));

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
