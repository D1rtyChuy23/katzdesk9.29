import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { NAME_LINKS } from "@/lib/ops/link-check";
import { BILLED_ON_INSTALL } from "@/lib/ops/merged-ticket";
import { notWalkInSql } from "@/lib/ops/walk-in-account";
import { openPmSql } from "@/lib/ops/ticket-status";

/**
 * Reading by id (phase C5 of "One Record Per Machine Plan", Chuy approved 11/24). Screens find an account's records by
 * its id instead of its name. Each area of the desk has its own switch on Link Check, and every area starts off.
 *
 * - With a switch on, a row belongs to the listed account its id names.
 * - A row with no id, or whose id names a removed account, still goes by its name, as every screen does today. So
 *   turning a switch on never hides a row the name finds, unless the row's id names another account on the list.
 * - Set ids comes first: every row gets the id its name finds now, as the account triggers would. A switch can't be
 *   turned on while any row's id isn't that.
 * - Link Check lists each area's lists by name and by id side by side, so the difference is seen before the switch.
 */

export const READ_BY_ID_KEY = "read_by_id";
export const READ_BY_ID_ADMIN_ONLY = "Reading by id is switched on Link Check: sign in as an admin to change it.";
/** Postgres's integer, the account id's type. */
export const ACCOUNT_ID_MAX = 2147483647;

export type ReadArea = "accounts" | "tickets" | "pms" | "map";

export const READ_AREAS: { area: ReadArea; label: string; covers: string }[] = [
  {
    area: "accounts",
    label: "Accounts",
    covers:
      "The Customers list's counts, and the account window: its tickets, PMs, installs, deals and recipes (the ticket window's account schedules read the same list), equipment and retired equipment, Out Of Network providers, work order history, invoices and install photos.",
  },
  {
    area: "tickets",
    label: "Tickets",
    covers:
      "The ticket window: the account it opens for its schedules (by the ticket's id), the account's equipment and retired equipment, its Out Of Network providers, and the Eversys modules under Asset History.",
  },
  {
    area: "pms",
    label: "PMs",
    covers:
      "The PM window's runbook: the PM account's units it plans and bills, and the account's earlier PMs it takes intervals from (by the PM's id); Runbook Readiness; the PMs a unit's model change re-pins; and the PM stack: the tickets a PM can stack on, the PMs a ticket can take, and their save checks (C6).",
  },
  {
    area: "map",
    label: "Map and Address Report",
    covers:
      "The Map and Nearby: each account's open calls, TLCs, past-due work, PMs, installs and its Out Of Network mark. The Address Report: the bill-to addresses on an account's invoices.",
  },
];

/** For a request: which area's switch a shared read follows (the account window's, or the ticket window's). */
export const READ_AREA_INPUT = z.enum(["accounts", "tickets"]);

type Query = Pick<Sql, "query">;

export type ReadSwitch = { at: string; by: string };
export type ReadSwitches = Partial<Record<ReadArea, ReadSwitch>>;

const isArea = (v: string): v is ReadArea => READ_AREAS.some((a) => a.area === v);

/**
 * The areas switched on. A setting that isn't there, or isn't JSON, reads as every area off (by name, as before C5). A
 * read that fails throws, as any other read on the screen would: it isn't taken for "off".
 */
export async function readSwitches(sql: Query): Promise<ReadSwitches> {
  const raw = (await sql.query<{ value: string | null }>("select value from desk_settings where key = $1", [READ_BY_ID_KEY]))[0]?.value;
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const out: ReadSwitches = {};
  if (!parsed || typeof parsed !== "object") return out;
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isArea(k) || !v || typeof v !== "object") continue;
    const at = (v as { at?: unknown }).at;
    const by = (v as { by?: unknown }).by;
    if (typeof at === "string" && at) out[k] = { at, by: typeof by === "string" ? by : "" };
  }
  return out;
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
 * The rows of one account, as a where clause. By id: the account's id, or the name as the screen matched it before when
 * the row's id names no listed account (none, or a removed one). Otherwise the name alone, as before C5. `name` and `id`
 * are the row's columns, qualified with its table's alias; `nameParam` and `idParam` are placeholders such as "$1".
 */
export function ofAccount(o: { name: string; id: string; match: NameMatch; byId: boolean; nameParam: string; idParam: string }): string {
  const byName = nameIs(o.name, o.nameParam, o.match);
  if (!o.byId) return byName;
  return `(${o.id} = ${o.idParam}::int or (${byName} and not exists (select 1 from directory_customers own where own.id = ${o.id} and own.archived = false)))`;
}

/**
 * One count per account, for a list that counts an account's rows (the Customers list, the Map), as a subquery to left
 * join to the accounts (`directory_customers d`, or `account`). By id, a row counts under the listed account its id
 * names, or else under the listed account its name finds. Otherwise under its name, as before C5. The name is matched
 * in any capitals, or with spaces at the ends dropped too (`match`). Columns in `where` and `counts` are on `t`, the
 * counted table (a table, or a parenthesised select with `customer` and `customer_id` columns).
 */
export function perAccountJoin(o: {
  table: string;
  alias: string;
  where: string;
  counts: string;
  byId: boolean;
  match?: NameMatch;
  account?: string;
}): string {
  const d = o.account ?? "d";
  const match = o.match ?? "lower";
  const key = (col: string) => (match === "trim" ? `lower(btrim(${col}))` : `lower(${col})`);
  return o.byId
    ? `left join (
         select coalesce(own.id, nm.id) as acct, ${o.counts}
           from ${o.table} t
           left join directory_customers own on own.id = t.customer_id and own.archived = false
           left join directory_customers nm on own.id is null and nm.archived = false and ${nameIs("nm.name", "t.customer", match)}
          where ${o.where}
          group by 1
       ) ${o.alias} on ${o.alias}.acct = ${d}.id`
    : `left join (
         select ${key("t.customer")} as k, ${o.counts}
           from ${o.table} t
          where ${o.where}
          group by 1
       ) ${o.alias} on ${o.alias}.k = ${key(`${d}.name`)}`;
}

/** A list an area reads per account, for the side-by-side on Link Check. */
export type AccountList = {
  key: string;
  label: string;
  table: string;
  match: NameMatch;
  where?: string;
  /** The row's name and id columns, when they aren't `customer` and `customer_id`. */
  name?: string;
  id?: string;
  /** The accounts the screen's name match looks in, as a condition on `dc` (directory_customers), when not every listed one. */
  nameAccounts?: string;
  /**
   * The whole set this list is part of (11/27: the open-PM rule), when the count should say what it leaves out: the rows
   * of `where` on no listed account, and the rows of `all` that `where` leaves out on purpose (`leftOutLabel`).
   */
  all?: string;
  leftOutLabel?: string;
};

/** A provider link whose provider is still on the network (getCustomerProviders). */
const PROVIDER_LIVE = "exists (select 1 from network_providers p where p.id = t.provider_id and p.archived = false)";

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
  { key: "providers", label: "Out Of Network providers", table: "customer_providers", match: "lower", where: PROVIDER_LIVE },
  { key: "woHistory", label: "Work order history", table: "wo_history", match: "trim" },
  // As the Invoices tab reads them (listAccountInvoicesFor): a merged ticket's own invoice is left out.
  {
    key: "invoices",
    label: "Invoices",
    table: "invoices",
    match: "trim",
    where: `(t.approved_at is not null or t.submitted_at is not null)
            and not (t.entity_type in ('service', 'tlc') and exists (select 1 from service_jobs j where j.id = t.entity_id and j.duplicate_of is not null))`,
  },
  {
    key: "chargedTickets",
    label: "Invoices tab: tickets with charges",
    table: "service_jobs",
    match: "trim",
    where: `exists (select 1 from ticket_charges c where c.job_id = t.id) and (t.duplicate_of is null or ${BILLED_ON_INSTALL("t.id")} is not null)`,
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
  /** Rows the name finds on an account whose id names another listed account (they move to that one). */
  onlyByName: number;
  /** Rows whose id names the account and whose name doesn't find it (a rename left the old name, or spaces at the ends). */
  onlyById: number;
  /** Up to 25 accounts that differ, most changed first. */
  samples: ListDiffAccount[];
  /** With `all` (11/27): rows of the list on no listed account, by name or id. */
  notOnAccount?: number;
  /** With `all`: rows of the whole set the list leaves out on purpose, and what they are. */
  leftOut?: number;
  leftOutLabel?: string;
};

/** What a count leaves out, to show beside it ("1 not on an account · 1 Walk-In left out"); "" when nothing. */
export function listGapText(l: { notOnAccount?: number; leftOut?: number; leftOutLabel?: string }): string {
  const parts = [
    l.notOnAccount ? `${l.notOnAccount} not on an account` : "",
    l.leftOut ? `${l.leftOut} ${l.leftOutLabel ?? "other"} left out` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

const SAMPLES = 25;
const num = (v: unknown) => Number(v ?? 0) || 0;

/** By name and by id, side by side, for each of the lists, by the same rules as ofAccount. */
export async function compareLists(
  sql: Query,
  lists: AccountList[],
  has: (table: string, column: string) => boolean,
  /** Comparisons already run for the same table and rules (another area's list), reused rather than run again. */
  seen: Map<string, ListDiff> = new Map(),
): Promise<ListDiff[]> {
  const out: ListDiff[] = [];
  for (const l of lists) {
    const base = { key: l.key, label: l.label };
    const same = JSON.stringify([l.table, l.match, l.where ?? "", l.name ?? "", l.id ?? "", l.nameAccounts ?? "", l.all ?? "", l.leftOutLabel ?? ""]);
    const earlier = seen.get(same);
    if (earlier) {
      out.push({ ...earlier, ...base });
      continue;
    }
    const before = out.length;
    const nameCol = l.name ?? "customer";
    const idCol = l.id ?? "customer_id";
    if (!has(l.table, nameCol) || !has(l.table, idCol)) {
      out.push({ ...base, present: false, byName: 0, byId: 0, accounts: 0, onlyByName: 0, onlyById: 0, samples: [] });
      continue;
    }
    // Tables and filters come from the lists above, never from a request. `d` is the listed accounts; `dn`, the ones the
    // screen's name match looks in (all listed, unless the list says otherwise).
    const where = l.where ?? "true";
    const match = nameIs(`t.${nameCol}`, "d.name", l.match);
    const matchN = nameIs(`t.${nameCol}`, "dn.name", l.match);
    const tid = `t.${idCol}`;
    const accounts = `d as (select id, name from directory_customers where archived = false),
            dn as (select id, name from directory_customers dc where dc.archived = false and ${l.nameAccounts ?? "true"})`;
    const totals = (
      await sql.query<{ by_name: number; by_id: number }>(
        `with ${accounts}
         select (select count(*) from ${l.table} t join dn on ${matchN} where ${where})::int as by_name,
                ((select count(*) from ${l.table} t join d on d.id = ${tid} where ${where})
                 + (select count(*) from ${l.table} t join dn on ${matchN}
                     where ${where} and not exists (select 1 from d o where o.id = ${tid})))::int as by_id`,
      )
    )[0];
    const rows = await sql.query<{ id: number; name: string; by_name: number; dropped: number; added: number }>(
      `with ${accounts},
            named as (select dn.id as acct, o.id as tid
                        from ${l.table} t join dn on ${matchN} left join d o on o.id = ${tid}
                       where ${where}),
            n as (select acct, count(*)::int as by_name, count(*) filter (where tid is not null and tid <> acct)::int as dropped
                    from named group by 1),
            a as (select ${tid} as acct, count(*)::int as added
                    from ${l.table} t join d on d.id = ${tid}
                   where ${where} and not coalesce(${match} and d.id in (select id from dn), false)
                   group by 1)
       select d.id, d.name, coalesce(n.by_name, 0)::int as by_name, coalesce(n.dropped, 0)::int as dropped, coalesce(a.added, 0)::int as added
         from d left join n on n.acct = d.id left join a on a.acct = d.id
        where coalesce(n.dropped, 0) > 0 or coalesce(a.added, 0) > 0
        order by coalesce(n.dropped, 0) + coalesce(a.added, 0) desc, lower(d.name)`,
    );
    // What the count leaves out, for a list that says (`all`): rows on no listed account, and the set's rows it skips.
    const gap = l.all
      ? (
          await sql.query<{ outside: number; left_out: number }>(
            `with ${accounts}
             select (select count(*) from ${l.table} t
                      where ${where} and not exists (select 1 from d o where o.id = ${tid}) and not exists (select 1 from dn where ${matchN}))::int as outside,
                    ((select count(*) from ${l.table} t where ${l.all}) - (select count(*) from ${l.table} t where (${l.all}) and (${where})))::int as left_out`,
          )
        )[0]
      : null;
    out.push({
      ...base,
      present: true,
      ...(gap ? { notOnAccount: num(gap.outside), leftOut: num(gap.left_out), ...(l.leftOutLabel ? { leftOutLabel: l.leftOutLabel } : {}) } : {}),
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
    if (out.length > before) seen.set(same, out[out.length - 1]!);
  }
  return out;
}

/** One id column: the rows Set ids would change (before) or changed (after). */
export type IdFix = { table: string; column: string; label: string; n: number };

/**
 * The rows whose id isn't what their name finds now, as migration 0145's katz_relink_customer_keys would set it, for
 * every name at once. A row that follows its account takes the id its name finds. A history row (it keeps its id through
 * a rename) only gets one when it has none. An id is never cleared: a row whose name finds no account keeps its id.
 */
function offIds(l: (typeof NAME_LINKS)[number]): { name: string; id: string; where: string } {
  const name = `"${l.column}"`;
  const id = `"${l.idColumn}"`;
  const rule = `katz_customer_id(${name})`;
  return { name, id, where: l.sticky ? `${id} is null and ${rule} is not null` : `${rule} is not null and ${id} is distinct from ${rule}` };
}

const idLinks = (has: (table: string, column: string) => boolean) => NAME_LINKS.filter((l) => l.idColumn && has(l.table, l.column) && has(l.table, l.idColumn));

/** What Set ids would change, per id column. */
export async function idsToSet(sql: Query, has: (table: string, column: string) => boolean): Promise<IdFix[]> {
  const out: IdFix[] = [];
  for (const l of idLinks(has)) {
    // Table and column names come from NAME_LINKS, never from a request.
    const { where } = offIds(l);
    const n = await sql.query<{ n: number }>(`select count(*)::int as n from ${l.table} where ${where}`);
    out.push({ table: l.table, column: l.idColumn!, label: l.label, n: num(n[0]?.n) });
  }
  return out;
}

/** Set ids: each update writes one id column, so no record trigger on a name fires. */
export async function sweepCustomerIds(sql: Query, has: (table: string, column: string) => boolean): Promise<IdFix[]> {
  const out: IdFix[] = [];
  for (const l of idLinks(has)) {
    const { name, id, where } = offIds(l);
    const n = await sql.query<{ n: number }>(
      `with u as (update ${l.table} set ${id} = katz_customer_id(${name}) where ${where} returning 1) select count(*)::int as n from u`,
    );
    out.push({ table: l.table, column: l.idColumn!, label: l.label, n: num(n[0]?.n) });
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
/** `toSet`: every id column, with the rows Set ids would change (a switch turns on only when they're all 0). */
export type ReadById = { toSet: IdFix[]; areas: ReadByIdArea[] };

/**
 * The Tickets area's lists. "Tickets" is the account each ticket opens for its schedules: by name, the listed account
 * (not Inactive) its name finds once spaces at the ends are dropped, as the ticket window matched it; by id, the
 * ticket's own, Inactive or not.
 */
export const TICKET_LISTS: AccountList[] = [
  // The ticket window's name match looked in the account picker's list, which leaves Inactive accounts out.
  { key: "ticketAccount", label: "Tickets: the account they open", table: "service_jobs", match: "trim", nameAccounts: "dc.inactive = false" },
  { key: "equipment", label: "Equipment", table: "account_equipment", match: "lower" },
  {
    key: "retired",
    label: "Retired equipment",
    table: "account_equipment_retired",
    match: "lower",
    where: "not exists (select 1 from account_equipment a where a.id = t.unit_id)",
  },
  { key: "providers", label: "Out Of Network providers", table: "customer_providers", match: "lower", where: PROVIDER_LIVE },
  { key: "modules", label: "Eversys modules (Asset History)", table: "modules", match: "trim", name: "assigned_customer", id: "assigned_customer_id" },
];

/**
 * The PMs area's lists: the units a PM's runbook plans (its account's equipment) and the earlier PMs it takes
 * intervals from (the account's completed PMs).
 */
export const PM_LISTS: AccountList[] = [
  { key: "runbookUnits", label: "Runbook units (the account's equipment)", table: "account_equipment", match: "lower" },
  { key: "earlierPms", label: "Earlier PMs (for intervals)", table: "pm_jobs", match: "lower", where: "(t.completed_at is not null or t.status = 'Completed')" },
  {
    key: "openPms",
    label: "Open PMs (Runbook Readiness)",
    table: "pm_jobs",
    match: "lower",
    where: `${openPmSql("t")} and ${notWalkInSql("t.customer")}`,
    all: openPmSql("t"),
    leftOutLabel: "Walk-In",
  },
];

/** The Map's and the Address Report's lists, with the filters they count by. */
export const MAP_LISTS: AccountList[] = [
  {
    key: "openTickets",
    label: "Open calls and TLCs",
    table: "service_jobs",
    match: "lower",
    where: "not t.done and t.status not in ('Completed', 'Cancelled', 'Phone Resolved') and t.duplicate_of is null",
  },
  { key: "openPms", label: "Open PMs", table: "pm_jobs", match: "lower", where: openPmSql("t"), all: openPmSql("t") },
  {
    key: "openInstalls",
    label: "Open installs",
    table: "installs",
    match: "lower",
    where: "t.archived = false and not t.complete and coalesce(t.equip_status, '') <> 'Installed'",
  },
  { key: "providers", label: "Out Of Network: providers", table: "customer_providers", match: "lower", where: PROVIDER_LIVE },
  { key: "networkAccounts", label: "Out Of Network: accounts list", table: "network_accounts", match: "lower" },
  { key: "billTo", label: "Address Report: invoice bill-to", table: "invoices", match: "trim", where: "coalesce(btrim(t.bill_address), '') <> ''" },
];

const LISTS_OF: Record<ReadArea, AccountList[]> = { accounts: ACCOUNT_LISTS, tickets: TICKET_LISTS, pms: PM_LISTS, map: MAP_LISTS };

export async function readByIdFor(sql: Sql, userId: string): Promise<ReadById> {
  if (!(await canReviewNames(sql, userId))) throw new Error(READ_BY_ID_ADMIN_ONLY);
  const has = await columnsOf(sql);
  const switches = await readSwitches(sql);
  const seen = new Map<string, ListDiff>();
  const areas: ReadByIdArea[] = [];
  for (const a of READ_AREAS) areas.push({ ...a, on: switches[a.area] ?? null, lists: await compareLists(sql, LISTS_OF[a.area], has, seen) });
  return { toSet: await idsToSet(sql, has), areas };
}

/** Set ids, from Link Check. Admins only. */
export async function sweepReadIdsFor(sql: Sql, userId: string): Promise<IdFix[]> {
  if (!(await canReviewNames(sql, userId))) throw new Error(READ_BY_ID_ADMIN_ONLY);
  return sweepCustomerIds(sql, await columnsOf(sql));
}

export const setIdsFirst = (n: number) =>
  `Set the ids first: ${n.toLocaleString("en-US")} ${n === 1 ? "record's id isn't" : "records' ids aren't"} what ${n === 1 ? "its name finds" : "their names find"} now.`;

export type SetReadByIdResult = { area: ReadArea; on: boolean };

/**
 * Turn an area on or off. Admins only, as Link Check. On waits for Set ids (no row's id may be off what its name finds);
 * an area already on is left as it was.
 */
export async function setReadByIdFor(sql: Sql, userId: string, data: { area: ReadArea; on: boolean }): Promise<SetReadByIdResult> {
  if (!(await canReviewNames(sql, userId))) throw new Error(READ_BY_ID_ADMIN_ONLY);
  const now = await readSwitches(sql);
  if (data.on === !!now[data.area]) return { area: data.area, on: data.on };
  if (data.on) {
    const left = (await idsToSet(sql, await columnsOf(sql))).reduce((n, c) => n + c.n, 0);
    if (left) throw new Error(setIdsFirst(left));
  }
  const by = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "an admin";
  const next: ReadSwitches = { ...now };
  if (data.on) next[data.area] = { at: new Date().toISOString(), by };
  else delete next[data.area];
  await sql.query(
    `insert into desk_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [READ_BY_ID_KEY, JSON.stringify(next)],
  );
  return { area: data.area, on: data.on };
}

/** Which areas read by id, for any signed-in desk user (a screen that picks the account itself needs it). */
export const getReadSwitches = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<Record<ReadArea, boolean>> => {
    const on = await readSwitches(await getSql());
    return Object.fromEntries(READ_AREAS.map((a) => [a.area, !!on[a.area]])) as Record<ReadArea, boolean>;
  });

export const getReadById = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }) => readByIdFor(await getSql(), context.userId));

export const sweepReadIds = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }) => sweepReadIdsFor(await getSql(), context.userId));

const setInput = z.object({ area: z.enum(READ_AREAS.map((a) => a.area) as [ReadArea, ...ReadArea[]]), on: z.boolean() });

export const setReadById = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof setInput>) => setInput.parse(d))
  .handler(async ({ data, context }) => setReadByIdFor(await getSql(), context.userId, data));
