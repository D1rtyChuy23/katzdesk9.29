import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  countNetsuitePlan,
  netsuiteHistoryText,
  planNetsuiteCustomers,
  readNetsuiteMatrix,
  type NsAccount,
  type NsCounts,
  type NsPlanLine,
  type NsRead,
  type NsRow,
} from "@/lib/ops/netsuite-customers";
import { matrixFromBase64 } from "@/lib/ops/netsuite-customers-sheet";

type Query = Pick<Sql, "query">;

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** The NetSuite customer import is for an Admin (the Admin role or a desk admin), like the other customer imports. */
async function requireImporter(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can import NetSuite customers.");
}

async function actor(sql: Sql, userId: string) {
  return (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
}

/**
 * The host takes up to 4.5 MB each way. A 2,401-row export is 0.75 MB up and at most about 2 MB of preview back (when
 * every row is an update), so 4,000 rows keeps both well inside it.
 */
const MAX_BASE64 = 4_000_000;
const MAX_ROWS = 4_000;

function readFile(base64: string): NsRead {
  if (base64.length > MAX_BASE64) throw new Error("That file is too large (up to about 3 MB).");
  const read = readNetsuiteMatrix(matrixFromBase64(base64));
  if (!read.rows.length) throw new Error("No customer rows under the header.");
  if (read.rows.length > MAX_ROWS) throw new Error(`Up to ${MAX_ROWS.toLocaleString("en-US")} rows at a time. Split the export into smaller files.`);
  return read;
}

const str = (v: unknown) => (v == null || v === "" ? null : String(v));

/** Every account, removed ones too: a new account can't take a removed account's name. */
export async function loadNetsuiteAccounts(sql: Query): Promise<NsAccount[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select id, name, archived, updated_at::text as updated_at, netsuite_id, account_number, address,
            billing_address1, billing_address2, billing_city, billing_state, billing_zip, billing_country,
            primary_contact, phone, email, inactive
       from directory_customers`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    archived: r.archived === true,
    updatedAt: String(r.updated_at ?? ""),
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
    primaryContact: str(r.primary_contact),
    phone: str(r.phone),
    email: str(r.email),
    inactive: r.inactive === true,
  }));
}

export type NetsuitePreview = {
  filename: string;
  rowCount: number;
  lines: NsPlanLine[];
  counts: NsCounts;
  columns: NsRead["columns"];
  warnings: string[];
};

/** Read the file and show what saving it would do. Saves nothing. */
export async function previewNetsuitePlan(sql: Query, input: { filename: string; base64: string }): Promise<NetsuitePreview> {
  const read = readFile(input.base64);
  const lines = planNetsuiteCustomers(read.rows, await loadNetsuiteAccounts(sql));
  return {
    filename: input.filename,
    rowCount: read.rows.length,
    // What a save writes is worked out again when it saves; the preview only needs to show it.
    lines: lines.map((l) => ({ ...l, write: null, seenUpdatedAt: null })),
    counts: countNetsuitePlan(lines),
    columns: read.columns,
    warnings: read.warnings,
  };
}

export type NetsuiteApplyResult = {
  created: number;
  updated: number;
  /** Ticked rows that weren't saved: changed in KatzDesk since the plan, or taken by another account meanwhile. */
  notSaved: number;
  counts: NsCounts;
  runId: number;
};

/**
 * One statement adds the new accounts, updates the matched ones, writes a history line for each and logs the run, so
 * a failure saves nothing. An update is skipped when the account changed after it was read (updated_at differs).
 */
const APPLY_SQL = `
with input as (
  select * from unnest(
    $1::int[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[],
    $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[],
    $15::text[], $16::text[], $17::text[], $18::boolean[], $19::text[]
  ) as t(line, kind, account_id, seen, name, netsuite_id, account_number, address,
         b1, b2, bcity, bstate, bzip, bcountry, contact, phone, email, inactive, detail)
), ins as (
  insert into directory_customers (name, netsuite_id, account_number, address,
         billing_address1, billing_address2, billing_city, billing_state, billing_zip, billing_country,
         primary_contact, phone, email, inactive)
  select name, netsuite_id, account_number, address, b1, b2, bcity, bstate, bzip, bcountry, contact, phone, email, inactive
    from input where kind = 'create'
  on conflict do nothing
  returning id, name
), upd as (
  update directory_customers d
     set netsuite_id = i.netsuite_id, account_number = i.account_number, address = i.address,
         billing_address1 = i.b1, billing_address2 = i.b2, billing_city = i.bcity, billing_state = i.bstate,
         billing_zip = i.bzip, billing_country = i.bcountry, primary_contact = i.contact, phone = i.phone,
         email = i.email, inactive = i.inactive, updated_at = now()
    from input i
   where i.kind = 'update' and d.id = i.account_id and d.archived = false and d.updated_at = i.seen::timestamptz
  returning d.id
), act as (
  insert into activity (entity_type, entity_id, actor_name, action, detail)
  select 'customer', ins.id, $20::text, 'added', i.detail from ins join input i on i.kind = 'create' and i.name = ins.name
  union all
  select 'customer', upd.id, $20::text, 'updated', i.detail from upd join input i on i.kind = 'update' and i.account_id = upd.id
  returning id
), run as (
  insert into customer_import_runs (source, filename, row_count, will_create, will_update, no_change, conflict, skipped,
         excluded, created, updated, created_by)
  select 'netsuite', $21::text, $22::int, $23::int, $24::int, $25::int, $26::int, $27::int, $28::int,
         (select count(*) from ins)::int, (select count(*) from upd)::int, $20::text
  returning id
)
select (select count(*) from ins)::int as created, (select count(*) from upd)::int as updated,
       (select id from run) as run_id, (select count(*) from act)::int as logged`;

/** Save the ticked rows, after planning them again against the accounts as they are now. */
export async function applyNetsuitePlan(
  sql: Query,
  input: { rows: NsRow[]; include: number[]; filename: string; who: string },
): Promise<NetsuiteApplyResult> {
  const lines = planNetsuiteCustomers(input.rows, await loadNetsuiteAccounts(sql));
  const counts = countNetsuitePlan(lines);
  const wanted = new Set(input.include);
  const writable = lines.filter((l) => (l.status === "create" || l.status === "update") && l.write);
  const chosen = writable.filter((l) => wanted.has(l.line));
  if (!chosen.length) throw new Error("Nothing to save: tick at least one row under Will Create or Will Update.");
  const col = <T>(f: (l: NsPlanLine) => T) => chosen.map(f);
  const w = (l: NsPlanLine) => l.write!;
  const res = await sql.query<{ created: number; updated: number; run_id: number }>(APPLY_SQL, [
    col((l) => l.line),
    col((l) => l.status),
    col((l) => l.accountId),
    col((l) => l.seenUpdatedAt),
    col((l) => w(l).name),
    col((l) => w(l).netsuiteId),
    col((l) => w(l).accountNumber),
    col((l) => w(l).address),
    col((l) => w(l).billing.line1),
    col((l) => w(l).billing.line2),
    col((l) => w(l).billing.city),
    col((l) => w(l).billing.state),
    col((l) => w(l).billing.zip),
    col((l) => w(l).billing.country),
    col((l) => w(l).primaryContact),
    col((l) => w(l).phone),
    col((l) => w(l).email),
    col((l) => w(l).inactive),
    col((l) => netsuiteHistoryText(l)),
    input.who,
    input.filename,
    input.rows.length,
    counts.create,
    counts.update,
    counts.same,
    counts.conflict,
    counts.skipped,
    writable.length - chosen.length,
  ]);
  const created = Number(res[0]?.created ?? 0);
  const updated = Number(res[0]?.updated ?? 0);
  return { created, updated, notSaved: chosen.length - created - updated, counts, runId: Number(res[0]?.run_id ?? 0) };
}

const fileInput = z.object({ filename: z.string().max(300), base64: z.string().min(4).max(MAX_BASE64 + 10) });

export const previewNetsuiteCustomers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string }) => fileInput.parse(d))
  .handler(async ({ data, context }): Promise<NetsuitePreview> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return previewNetsuitePlan(sql, data);
  });

export const applyNetsuiteCustomers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string; include: number[] }) =>
    fileInput.extend({ include: z.array(z.number().int().positive()).max(MAX_ROWS) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<NetsuiteApplyResult> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    const read = readFile(data.base64);
    return applyNetsuitePlan(sql, { rows: read.rows, include: data.include, filename: data.filename, who: await actor(sql, context.userId) });
  });

export type NetsuiteImportRun = {
  id: number;
  filename: string | null;
  rowCount: number;
  created: number;
  updated: number;
  willCreate: number;
  willUpdate: number;
  noChange: number;
  conflict: number;
  skipped: number;
  excluded: number;
  createdBy: string | null;
  createdAt: string;
};

/** The last few imports that saved: who, when, and the counts. */
export async function recentNetsuiteRuns(sql: Query, limit = 8): Promise<NetsuiteImportRun[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select id, filename, row_count, created, updated, will_create, will_update, no_change, conflict, skipped, excluded,
            created_by, created_at
       from customer_import_runs where source = 'netsuite' order by created_at desc, id desc limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    filename: str(r.filename),
    rowCount: Number(r.row_count ?? 0),
    created: Number(r.created ?? 0),
    updated: Number(r.updated ?? 0),
    willCreate: Number(r.will_create ?? 0),
    willUpdate: Number(r.will_update ?? 0),
    noChange: Number(r.no_change ?? 0),
    conflict: Number(r.conflict ?? 0),
    skipped: Number(r.skipped ?? 0),
    excluded: Number(r.excluded ?? 0),
    createdBy: str(r.created_by),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
  }));
}

export const listNetsuiteImportRuns = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<NetsuiteImportRun[]> => {
    const sql = await ready();
    await requireImporter(sql, context.userId);
    return recentNetsuiteRuns(sql);
  });
