import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { NAME_LINKS } from "@/lib/ops/link-check";

/**
 * Reading by id (phase C5 of "One Record Per Machine Plan", Chuy approved 11/24). Screens find an account's records by
 * its id instead of its name. Each area of the desk has its own switch on Link Check, and every area starts off.
 *
 * - With a switch on, a row belongs to the account its id names.
 * - A row with no id still goes by its name, as every screen does today. So turning a switch on never hides a row the
 *   name finds, unless the row's id names another account.
 * - Turning a switch on first sweeps the ids: every row gets the id the rule gives, as the account triggers would.
 * - Link Check lists each area's lists by name and by id side by side, so the difference is seen before the switch.
 */

export const READ_BY_ID_KEY = "read_by_id";
export const READ_BY_ID_ADMIN_ONLY = "Reading by id is switched on Link Check: sign in as an admin to change it.";

export type ReadArea = "accounts";

export const READ_AREAS: { area: ReadArea; label: string; covers: string }[] = [
  {
    area: "accounts",
    label: "Accounts",
    covers:
      "The Customers list's counts, and the account window: its tickets, PMs, installs, deals and recipes (the ticket window's account schedules read the same list), equipment and retired equipment, work order history, invoices and install photos.",
  },
];

type Query = Pick<Sql, "query">;

export type ReadSwitch = { at: string; by: string };
export type ReadSwitches = Partial<Record<ReadArea, ReadSwitch>>;

const isArea = (v: string): v is ReadArea => READ_AREAS.some((a) => a.area === v);

/** The areas switched on. A missing or unreadable setting reads as every area off (by name, as before C5). */
export async function readSwitches(sql: Query): Promise<ReadSwitches> {
  let raw: string | null | undefined;
  try {
    raw = (await sql.query<{ value: string | null }>("select value from desk_settings where key = $1", [READ_BY_ID_KEY]))[0]?.value;
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: ReadSwitches = {};
    for (const [k, v] of Object.entries(parsed ?? {})) {
      if (!isArea(k) || !v || typeof v !== "object") continue;
      const at = (v as { at?: unknown }).at;
      const by = (v as { by?: unknown }).by;
      if (typeof at === "string" && at) out[k] = { at, by: typeof by === "string" ? by : "" };
    }
    return out;
  } catch {
    return {};
  }
}

export async function readsById(sql: Query, area: ReadArea): Promise<boolean> {
  return !!(await readSwitches(sql))[area];
}

/** How a screen matches a row's name to an account's today: in any capitals, or with spaces at the ends dropped too. */
export type NameMatch = "lower" | "trim";

export function nameIs(column: string, name: string, match: NameMatch): string {
  return match === "trim" ? `lower(btrim(${column})) = lower(btrim(${name}))` : `lower(${column}) = lower(${name})`;
}

/**
 * The rows of one account, as a where clause. By id: the account's id, or no id and the name as the screen matched it
 * before. Otherwise the name alone, as before C5. `nameParam` and `idParam` are placeholders such as "$1" and "$2".
 */
export function ofAccount(o: { name: string; id: string; match: NameMatch; byId: boolean; nameParam: string; idParam: string }): string {
  const byName = nameIs(o.name, o.nameParam, o.match);
  return o.byId ? `(${o.id} = ${o.idParam}::int or (${o.id} is null and ${byName}))` : byName;
}

/**
 * One count per account, for a list that counts an account's rows (the Customers list), as a subquery `x` to left join
 * to `directory_customers d`. By id, a row counts under its id's account, or with no id under the listed account its name
 * finds in any capitals. Otherwise under its name in any capitals, as before C5. Columns in `where` and `counts` are on
 * `t`, the counted table.
 */
export function perAccountJoin(o: { table: string; alias: string; where: string; counts: string; byId: boolean }): string {
  return o.byId
    ? `left join (
         select coalesce(t.customer_id, nm.id) as acct, ${o.counts}
           from ${o.table} t
           left join directory_customers nm on t.customer_id is null and nm.archived = false and lower(nm.name) = lower(t.customer)
          where ${o.where}
          group by 1
       ) ${o.alias} on ${o.alias}.acct = d.id`
    : `left join (
         select lower(t.customer) as k, ${o.counts}
           from ${o.table} t
          where ${o.where}
          group by 1
       ) ${o.alias} on ${o.alias}.k = lower(d.name)`;
}

/** A list an area reads per account, for the side-by-side on Link Check. Each table's name column is `customer`, its id `customer_id`. */
export type AccountList = { key: string; label: string; table: string; match: NameMatch; where?: string };

/** The Accounts area's lists, with the filters the account window and the Customers list use. */
export const ACCOUNT_LISTS: AccountList[] = [
  { key: "tickets", label: "Tickets (calls and TLCs)", table: "service_jobs", match: "lower" },
  { key: "pms", label: "PMs", table: "pm_jobs", match: "lower", where: "t.moved_job_id is null" },
  { key: "installs", label: "Installs (and their photos)", table: "installs", match: "lower", where: "t.archived = false" },
  { key: "deals", label: "Deals", table: "deals", match: "lower", where: "t.archived = false" },
  { key: "recipes", label: "Recipes", table: "recipes", match: "lower" },
  { key: "equipment", label: "Equipment", table: "account_equipment", match: "lower" },
  {
    key: "retired",
    label: "Retired equipment",
    table: "account_equipment_retired",
    match: "lower",
    where: "not exists (select 1 from account_equipment a where a.id = t.unit_id)",
  },
  { key: "woHistory", label: "Work order history", table: "wo_history", match: "trim" },
  { key: "invoices", label: "Invoices", table: "invoices", match: "trim", where: "(t.approved_at is not null or t.submitted_at is not null)" },
  {
    key: "chargedTickets",
    label: "Invoices tab: tickets with charges",
    table: "service_jobs",
    match: "trim",
    where: "exists (select 1 from ticket_charges c where c.job_id = t.id)",
  },
];

export type ListDiffAccount = { id: number; name: string; byName: number; byId: number };

export type ListDiff = {
  key: string;
  label: string;
  /** False when this database has no such table or id column. */
  present: boolean;
  /** Rows on a listed account, found by name (as before C5) and by id. */
  byName: number;
  byId: number;
  /** Accounts whose list isn't the same both ways. */
  accounts: number;
  /** Rows the name finds on an account whose id names another account (they move to that one). */
  onlyByName: number;
  /** Rows whose id names the account and whose name doesn't find it (a rename left the old name, or spaces at the ends). */
  onlyById: number;
  /** Up to 25 accounts that differ, most changed first. */
  samples: ListDiffAccount[];
};

const SAMPLES = 25;
const num = (v: unknown) => Number(v ?? 0) || 0;

/** By name and by id, side by side, for each of the lists. */
export async function compareLists(sql: Query, lists: AccountList[], has: (table: string, column: string) => boolean): Promise<ListDiff[]> {
  const out: ListDiff[] = [];
  for (const l of lists) {
    const base = { key: l.key, label: l.label };
    if (!has(l.table, "customer") || !has(l.table, "customer_id")) {
      out.push({ ...base, present: false, byName: 0, byId: 0, accounts: 0, onlyByName: 0, onlyById: 0, samples: [] });
      continue;
    }
    // Tables and filters come from ACCOUNT_LISTS above, never from a request.
    const where = l.where ?? "true";
    const match = nameIs("t.customer", "d.name", l.match);
    const totals = (
      await sql.query<{ by_name: number; by_id: number }>(
        `with d as (select id, name from directory_customers where archived = false)
         select (select count(*) from ${l.table} t join d on ${match} where ${where})::int as by_name,
                ((select count(*) from ${l.table} t join d on d.id = t.customer_id where ${where})
                 + (select count(*) from ${l.table} t join d on ${match} where ${where} and t.customer_id is null))::int as by_id`,
      )
    )[0];
    const rows = await sql.query<{ id: number; name: string; by_name: number; dropped: number; added: number }>(
      `with d as (select id, name from directory_customers where archived = false),
            named as (select d.id as acct, t.customer_id as tid from ${l.table} t join d on ${match} where ${where}),
            n as (select acct, count(*)::int as by_name, count(*) filter (where tid is not null and tid <> acct)::int as dropped
                    from named group by 1),
            a as (select t.customer_id as acct, count(*)::int as added
                    from ${l.table} t join d on d.id = t.customer_id
                   where ${where} and not coalesce(${match}, false)
                   group by 1)
       select d.id, d.name, coalesce(n.by_name, 0)::int as by_name, coalesce(n.dropped, 0)::int as dropped, coalesce(a.added, 0)::int as added
         from d left join n on n.acct = d.id left join a on a.acct = d.id
        where coalesce(n.dropped, 0) > 0 or coalesce(a.added, 0) > 0
        order by coalesce(n.dropped, 0) + coalesce(a.added, 0) desc, lower(d.name)`,
    );
    out.push({
      ...base,
      present: true,
      byName: num(totals?.by_name),
      byId: num(totals?.by_id),
      accounts: rows.length,
      onlyByName: rows.reduce((s, r) => s + num(r.dropped), 0),
      onlyById: rows.reduce((s, r) => s + num(r.added), 0),
      samples: rows.slice(0, SAMPLES).map((r) => ({
        id: Number(r.id),
        name: String(r.name ?? ""),
        byName: num(r.by_name),
        byId: num(r.by_name) - num(r.dropped) + num(r.added),
      })),
    });
  }
  return out;
}

export type SweptColumn = { table: string; column: string; label: string; fixed: number };

/**
 * Every row's account id, as the rule gives it for the row's name now (migration 0145's katz_relink_customer_keys, for
 * every name at once). A row that follows its account takes the rule's id, none included. A history row (it keeps its
 * id through a rename) only gets one when it has none. Each update writes one id column, so no record trigger fires.
 */
export async function sweepCustomerIds(sql: Query, has: (table: string, column: string) => boolean): Promise<SweptColumn[]> {
  const out: SweptColumn[] = [];
  for (const l of NAME_LINKS) {
    if (!l.idColumn || !has(l.table, l.column) || !has(l.table, l.idColumn)) continue;
    // Table and column names come from NAME_LINKS, never from a request.
    const name = `"${l.column}"`;
    const id = `"${l.idColumn}"`;
    const off = l.sticky
      ? `${id} is null and katz_customer_id(${name}) is not null`
      : `${id} is distinct from katz_customer_id(${name})`;
    const fixed = await sql.query<{ n: number }>(
      `with u as (update ${l.table} set ${id} = katz_customer_id(${name}) where ${off} returning 1) select count(*)::int as n from u`,
    );
    out.push({ table: l.table, column: l.idColumn, label: l.label, fixed: num(fixed[0]?.n) });
  }
  return out;
}

async function columnsOf(sql: Query): Promise<(table: string, column: string) => boolean> {
  const rows = await sql.query<{ t: string; c: string }>(
    "select table_name as t, column_name as c from information_schema.columns where table_schema = current_schema()",
  );
  const set = new Set(rows.map((r) => `${r.t}.${r.c}`));
  return (t, c) => set.has(`${t}.${c}`);
}

export type ReadByIdArea = { area: ReadArea; label: string; covers: string; on: ReadSwitch | null; lists: ListDiff[] };
export type ReadById = { areas: ReadByIdArea[] };

const LISTS_OF: Record<ReadArea, AccountList[]> = { accounts: ACCOUNT_LISTS };

export async function readByIdFor(sql: Sql, userId: string): Promise<ReadById> {
  if (!(await canReviewNames(sql, userId))) throw new Error(READ_BY_ID_ADMIN_ONLY);
  const has = await columnsOf(sql);
  const switches = await readSwitches(sql);
  const areas: ReadByIdArea[] = [];
  for (const a of READ_AREAS) areas.push({ ...a, on: switches[a.area] ?? null, lists: await compareLists(sql, LISTS_OF[a.area], has) });
  return { areas };
}

export type SetReadByIdResult = { area: ReadArea; on: boolean; swept: SweptColumn[] };

/** Turn an area on (after sweeping the ids) or off. Admins only, as Link Check. */
export async function setReadByIdFor(sql: Sql, userId: string, data: { area: ReadArea; on: boolean }): Promise<SetReadByIdResult> {
  if (!(await canReviewNames(sql, userId))) throw new Error(READ_BY_ID_ADMIN_ONLY);
  const swept = data.on ? await sweepCustomerIds(sql, await columnsOf(sql)) : [];
  const by = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "an admin";
  const next: ReadSwitches = { ...(await readSwitches(sql)) };
  if (data.on) next[data.area] = { at: new Date().toISOString(), by };
  else delete next[data.area];
  await sql.query(
    `insert into desk_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [READ_BY_ID_KEY, JSON.stringify(next)],
  );
  return { area: data.area, on: data.on, swept };
}

export const getReadById = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }) => readByIdFor(await getSql(), context.userId));

const setInput = z.object({ area: z.enum(READ_AREAS.map((a) => a.area) as [ReadArea, ...ReadArea[]]), on: z.boolean() });

export const setReadById = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof setInput>) => setInput.parse(d))
  .handler(async ({ data, context }) => setReadByIdFor(await getSql(), context.userId, data));
