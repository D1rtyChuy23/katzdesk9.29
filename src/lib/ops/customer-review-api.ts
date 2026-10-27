/**
 * Customers → Export and Customers → Possible Duplicates: both Admin-only and read-only, except Not a Duplicate, which
 * only records that a pair was checked (customer_dupe_dismissals) so it stops showing. No account is changed here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import {
  CUSTOMER_EXPORT_COLUMNS,
  TEXT_COLUMNS,
  customerExportName,
  customerExportRows,
  toCsv,
  type ExportAccount,
} from "@/lib/ops/customer-export";
import { findPossibleDuplicates, type DupeAccount, type DupeLevel, type DupePair } from "@/lib/ops/customer-dupes";

type Query = Pick<Sql, "query">;

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireAdmin(sql: Sql, userId: string, what: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error(`Only an Admin can ${what}.`);
}

const str = (v: unknown) => (v == null || v === "" ? null : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? "" : String(v));

/** Every account, removed ones too, with the history line written when it was added (if there is one). */
export async function loadExportAccounts(sql: Query): Promise<ExportAccount[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `with added as (
       select distinct on (entity_id) entity_id, created_at, actor_name, detail
         from activity
        where entity_type = 'customer' and action = 'added'
        order by entity_id, created_at, id
     )
     select d.id, d.name, d.netsuite_id, d.account_number, d.address, d.billing_address1, d.billing_address2, d.billing_city,
            d.billing_state, d.billing_zip, d.billing_country, d.phone, d.email, d.account_rep, d.archived, d.inactive,
            d.removal_flag, d.walk_in, a.created_at as added_at, a.actor_name as added_by, a.detail as added_detail
       from directory_customers d
       left join added a on a.entity_id = d.id`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    netsuiteId: str(r.netsuite_id),
    accountNumber: str(r.account_number),
    address: str(r.address),
    billing: {
      line1: str(r.billing_address1),
      line2: str(r.billing_address2),
      city: str(r.billing_city),
      state: str(r.billing_state),
      zip: str(r.billing_zip),
      country: str(r.billing_country),
    },
    phone: str(r.phone),
    email: str(r.email),
    rep: str(r.account_rep),
    archived: r.archived === true,
    inactive: r.inactive === true,
    removalFlag: r.removal_flag === true,
    walkIn: r.walk_in === true,
    added: r.added_at ? { at: iso(r.added_at), by: str(r.added_by), detail: str(r.added_detail) } : null,
  }));
}

export type CustomerExportFile = { filename: string; mime: string; base64: string; rows: number };

/** The export as CSV text or an Excel workbook. In the workbook, IDs, account numbers, ZIPs and phones are text cells. */
export function customerExportFile(accounts: ExportAccount[], format: "csv" | "xlsx", day: string): CustomerExportFile {
  const rows = customerExportRows(accounts);
  if (format === "csv") {
    // The byte-order mark makes Excel read the file as UTF-8, so accented names stay right.
    return {
      filename: customerExportName(day, "csv"),
      mime: "text/csv",
      base64: Buffer.from("\uFEFF" + toCsv(CUSTOMER_EXPORT_COLUMNS, rows), "utf8").toString("base64"),
      rows: rows.length,
    };
  }
  const sheet = XLSX.utils.aoa_to_sheet([[...CUSTOMER_EXPORT_COLUMNS], ...rows]);
  // aoa_to_sheet already writes strings as text; these columns also get the Text format, so a number typed into
  // them later stays as typed.
  CUSTOMER_EXPORT_COLUMNS.forEach((col, c) => {
    if (!TEXT_COLUMNS.has(col)) return;
    for (let r = 1; r <= rows.length; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (cell) cell.z = "@";
    }
  });
  sheet["!cols"] = CUSTOMER_EXPORT_COLUMNS.map((col) => ({ wch: col === "Name" || col.startsWith("Site Address") || col === "Billing Address" ? 36 : 16 }));
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: CUSTOMER_EXPORT_COLUMNS.length - 1 } }) };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Customers");
  return {
    filename: customerExportName(day, "xlsx"),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: XLSX.write(book, { type: "base64", bookType: "xlsx" }) as string,
    rows: rows.length,
  };
}

export const exportCustomers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { format: "csv" | "xlsx" }) => z.object({ format: z.enum(["csv", "xlsx"]) }).parse(d))
  .handler(async ({ data, context }): Promise<CustomerExportFile> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId, "export the customer list");
    return customerExportFile(await loadExportAccounts(sql), data.format, todayChicago());
  });

/* ------------------------------------------------------------------ possible duplicates */

export type DupeRun = { id: number; createdAt: string; filename: string | null; created: number; createdBy: string | null };

/** NetSuite imports that added accounts, newest first. */
export async function dupeRuns(sql: Query): Promise<DupeRun[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select id, created_at, filename, created, created_by from customer_import_runs
      where source = 'netsuite' and created > 0
      order by created_at desc, id desc limit 20`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    createdAt: iso(r.created_at),
    filename: str(r.filename),
    created: Number(r.created ?? 0),
    createdBy: str(r.created_by),
  }));
}

/**
 * The accounts a run added: their "Added by the NetSuite import" history lines, written in the same statement as the
 * run's log (so at the same moment; a few seconds' leeway all the same).
 */
export async function accountsAddedByRun(sql: Query, runId: number): Promise<number[]> {
  const rows = await sql.query<{ id: number }>(
    `select distinct a.entity_id as id
       from activity a
       join customer_import_runs r on r.id = $1
      where a.entity_type = 'customer' and a.action = 'added'
        and a.detail like 'Added by the NetSuite import%'
        and a.created_at between r.created_at - interval '5 seconds' and r.created_at + interval '5 seconds'`,
    [runId],
  );
  return rows.map((r) => Number(r.id));
}

/** Every account still on the list, with how much history it has (calls, TLCs, PMs, installs, deals). */
export async function loadDupeAccounts(sql: Query): Promise<DupeAccount[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `with h as (
       select lower(customer) as k, count(*)::int as n from service_jobs where coalesce(customer, '') <> '' group by 1
       union all
       select lower(customer), count(*)::int from pm_jobs where coalesce(customer, '') <> '' group by 1
       union all
       select lower(customer), count(*)::int from installs where archived = false and coalesce(customer, '') <> '' group by 1
       union all
       select lower(customer), count(*)::int from deals where archived = false and coalesce(customer, '') <> '' group by 1
     ), t as (select k, sum(n)::int as n from h group by k)
     select d.id, d.name, d.address, d.phone, d.email, d.netsuite_id, d.account_number, d.inactive, d.walk_in, coalesce(t.n, 0)::int as history
       from directory_customers d
       left join t on t.k = lower(d.name)
      where d.archived = false`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    address: str(r.address),
    phone: str(r.phone),
    email: str(r.email),
    netsuiteId: str(r.netsuite_id),
    accountNumber: str(r.account_number),
    inactive: r.inactive === true,
    walkIn: r.walk_in === true,
    history: Number(r.history ?? 0),
  }));
}

/** A pair marked Not a Duplicate: who checked it, and when. */
export type DismissedPair = DupePair & { dismissedBy: string | null; dismissedAt: string };

export type DupeReport = {
  runs: DupeRun[];
  run: DupeRun | null;
  /** Accounts the run added that are still on the list. */
  added: number;
  /** Pairs still to check: the ones marked Not a Duplicate are in `dismissed` instead. */
  pairs: DupePair[];
  counts: Record<DupeLevel, number>;
  dismissed: DismissedPair[];
};

/** The two account ids of a pair, lower first: how a dismissal is stored. */
export const pairIds = (a: number, b: number): [number, number] => (a < b ? [a, b] : [b, a]);

export async function possibleDuplicatesFor(sql: Query, runId?: number | null): Promise<DupeReport> {
  const runs = await dupeRuns(sql);
  const run = (runId ? runs.find((r) => r.id === runId) : runs[0]) ?? null;
  const empty: DupeReport = { runs, run, added: 0, pairs: [], counts: { high: 0, medium: 0, low: 0 }, dismissed: [] };
  if (!run) return empty;
  const accounts = await loadDupeAccounts(sql);
  const onList = new Set(accounts.map((a) => a.id));
  const added = new Set((await accountsAddedByRun(sql, run.id)).filter((id) => onList.has(id)));
  const marks = new Map(
    (
      await sql.query<{ low_id: number; high_id: number; dismissed_by: string | null; dismissed_at: unknown }>(
        "select low_id, high_id, dismissed_by, dismissed_at from customer_dupe_dismissals",
      )
    ).map((r) => [`${Number(r.low_id)}:${Number(r.high_id)}`, { dismissedBy: str(r.dismissed_by), dismissedAt: iso(r.dismissed_at) }]),
  );
  const pairs: DupePair[] = [];
  const dismissed: DismissedPair[] = [];
  for (const p of findPossibleDuplicates(added, accounts)) {
    const mark = marks.get(pairIds(p.added.id, p.other.id).join(":"));
    if (mark) dismissed.push({ ...p, ...mark });
    else pairs.push(p);
  }
  const counts = { high: 0, medium: 0, low: 0 };
  for (const p of pairs) counts[p.level] += 1;
  return { runs, run, added: added.size, pairs, counts, dismissed };
}

/** Not a Duplicate (dismissed: true) or Undo (false) on one pair. Neither account changes. */
export async function setDupeDismissedFor(sql: Sql, userId: string, data: { aId: number; bId: number; dismissed: boolean }): Promise<void> {
  await requireAdmin(sql, userId, "mark possible duplicates");
  if (data.aId === data.bId) throw new Error("A pair needs two accounts.");
  const [low, high] = pairIds(data.aId, data.bId);
  if (!data.dismissed) {
    await sql.query("delete from customer_dupe_dismissals where low_id = $1 and high_id = $2", [low, high]);
    return;
  }
  const who = (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
  const found = await sql.query<{ id: number }>("select id from directory_customers where id = any($1::int[]) and archived = false", [[low, high]]);
  if (found.length < 2) throw new Error("One of these accounts is no longer on the list.");
  await sql.query(
    `insert into customer_dupe_dismissals (low_id, high_id, dismissed_by) values ($1, $2, $3)
     on conflict (low_id, high_id) do nothing`,
    [low, high, who],
  );
}

export const setDuplicateDismissed = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { aId: number; bId: number; dismissed: boolean }) =>
    z.object({ aId: z.number().int().positive(), bId: z.number().int().positive(), dismissed: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<void> => {
    await setDupeDismissedFor(await ready(), context.userId, data);
  });

export const possibleDuplicates = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { runId?: number | null }) => z.object({ runId: z.number().int().positive().nullable().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<DupeReport> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId, "see possible duplicates");
    return possibleDuplicatesFor(sql, data.runId);
  });
