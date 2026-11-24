import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { isWalkIn, normalizeCustomerKey } from "@/lib/ops/customer-key";

/**
 * Link Check (Phase 0 of "One Record Per Machine Plan", Chuy 11/24): a read-only look at how records point at customers
 * and machines today, before any customer id or machine record is added. Writes nothing. Admins only.
 */

export const LINK_CHECK_ADMIN_ONLY = "Link Check is for admins: sign in as an admin to see it.";

/** A table and the column that stores a customer by name. `rewritten`: rename and merge rewrite it today. */
export type NameLink = { table: string; column: string; label: string; rewritten: boolean };

export const NAME_LINKS: NameLink[] = [
  { table: "service_jobs", column: "customer", label: "Tickets", rewritten: true },
  { table: "pm_jobs", column: "customer", label: "PMs", rewritten: true },
  { table: "installs", column: "customer", label: "Installs", rewritten: true },
  { table: "deals", column: "customer", label: "Deals", rewritten: true },
  { table: "recipes", column: "customer", label: "Recipes", rewritten: true },
  { table: "account_equipment", column: "customer", label: "Account equipment", rewritten: true },
  { table: "account_equipment_retired", column: "customer", label: "Retired equipment", rewritten: true },
  { table: "assets", column: "customer_owned", label: "Warehouse: customer-owned", rewritten: true },
  { table: "assets", column: "sold_to", label: "Warehouse: sold to", rewritten: true },
  { table: "assets", column: "stock_hold_customer", label: "Warehouse: held for", rewritten: true },
  // Rename rewrites only the pending ones; decided ones keep the old name.
  { table: "asset_stock_actions", column: "customer", label: "Stock actions (pending only renamed)", rewritten: false },
  { table: "rebuilds", column: "account", label: "Rebuilds", rewritten: true },
  { table: "modules", column: "assigned_customer", label: "Modules", rewritten: true },
  { table: "modules", column: "location", label: "Modules: location", rewritten: true },
  { table: "directory_customers", column: "parent_account", label: "Accounts: parent account", rewritten: false },
  { table: "wo_history", column: "customer", label: "Work order history", rewritten: true },
  { table: "network_accounts", column: "customer", label: "Network accounts", rewritten: true },
  { table: "customer_providers", column: "customer", label: "Customer providers", rewritten: true },
  { table: "invoices", column: "customer", label: "Invoices: customer", rewritten: false },
  { table: "invoices", column: "bill_account", label: "Invoices: bill account", rewritten: false },
  { table: "invoices", column: "bill_name", label: "Invoices: bill name", rewritten: false },
  { table: "module_stops", column: "customer", label: "Module stops", rewritten: false },
  { table: "equipment_history", column: "customer", label: "Equipment history", rewritten: false },
  { table: "equipment_move_requests", column: "from_customer", label: "Move requests: from", rewritten: false },
  { table: "equipment_move_requests", column: "to_customer", label: "Move requests: to", rewritten: false },
  { table: "desk_notifications", column: "customer", label: "Notifications", rewritten: false },
];

/**
 * How a stored name finds its account, the way the app and a backfill would: accounts on the list (not archived) first.
 * - `exact`: one listed account with that very name;
 * - `case`: one listed account by name in other capitals (`lower(x) = lower(name)`, as rename and the lists match);
 * - `trimmed`: one listed account only once spaces at the ends are dropped (`lower(btrim(...))`, as some saves match);
 * - `several`: more than one listed account by either;
 * - `loose`: no listed account by those, but the desk's customer key (punctuation, spacing) finds one or more;
 * - `archivedOnly`: no listed account at all, but an archived one (removed, or merged away) has the name;
 * - `none`: no account; `walkin`, `blank`: not an account.
 */
export type NameMatch = "exact" | "case" | "trimmed" | "several" | "loose" | "archivedOnly" | "none" | "walkin" | "blank";

/** `archived`: off the list (removed, or merged away). `inactive`: NetSuite Inactive, or Retired when `retired`. */
export type Account = { id: number; name: string; archived: boolean; merged?: boolean; inactive?: boolean; retired?: boolean };

export type NameIndex = {
  exact: Map<string, Account[]>;
  lowered: Map<string, Account[]>;
  trimmed: Map<string, Account[]>;
  keyed: Map<string, Account[]>;
  archived: Map<string, Account[]>;
};

/** Postgres's btrim(x): spaces only, not tabs, newlines or no-break spaces. */
const btrim = (s: string) => s.replace(/^ +| +$/g, "");
const lower = (s: string) => s.toLowerCase();

export function indexAccounts(accounts: Account[]): NameIndex {
  const ix: NameIndex = { exact: new Map(), lowered: new Map(), trimmed: new Map(), keyed: new Map(), archived: new Map() };
  const add = (m: Map<string, Account[]>, k: string, a: Account) => {
    if (!k) return;
    const list = m.get(k);
    if (list) list.push(a);
    else m.set(k, [a]);
  };
  for (const a of accounts) {
    if (a.archived) {
      add(ix.archived, lower(btrim(a.name)), a);
      add(ix.archived, normalizeCustomerKey(a.name), a);
      continue;
    }
    add(ix.exact, a.name, a);
    add(ix.lowered, lower(a.name), a);
    add(ix.trimmed, lower(btrim(a.name)), a);
    add(ix.keyed, normalizeCustomerKey(a.name), a);
  }
  return ix;
}

export function matchName(name: string | null | undefined, ix: NameIndex): { match: NameMatch; accounts: Account[] } {
  const raw = String(name ?? "");
  if (!raw.trim()) return { match: "blank", accounts: [] };
  if (isWalkIn(raw)) return { match: "walkin", accounts: [] };
  const exact = ix.exact.get(raw) ?? [];
  if (exact.length === 1) return { match: "exact", accounts: exact };
  const lowered = ix.lowered.get(lower(raw)) ?? [];
  if (lowered.length === 1) return { match: "case", accounts: lowered };
  if (lowered.length > 1) return { match: "several", accounts: lowered };
  const trimmed = ix.trimmed.get(lower(btrim(raw))) ?? [];
  if (trimmed.length === 1) return { match: "trimmed", accounts: trimmed };
  if (trimmed.length > 1) return { match: "several", accounts: trimmed };
  const keyed = ix.keyed.get(normalizeCustomerKey(raw)) ?? [];
  if (keyed.length) return { match: "loose", accounts: keyed };
  const gone = ix.archived.get(lower(btrim(raw))) ?? ix.archived.get(normalizeCustomerKey(raw)) ?? [];
  if (gone.length) return { match: "archivedOnly", accounts: gone };
  return { match: "none", accounts: [] };
}

export type NameSample = { name: string; rows: number; accounts: { id: number; name: string; archived: boolean; inactive: boolean }[] };

export type NameLinkReport = {
  table: string;
  column: string;
  label: string;
  rewritten: boolean;
  /** False when this database has no such table or column. */
  present: boolean;
  rows: number;
  names: number;
  /** Rows (not names) by how their name finds an account. */
  byMatch: Record<NameMatch, number>;
  /** Rows whose one listed account is Inactive or Retired (they link, but the account takes no new work). */
  inactiveRows: number;
  /**
   * Tables linked by account id (phase C1 on): rows with an id, without one (a name that isn't blank or walk-in), and
   * rows whose id's account has another name than the row (after a rename these should be none).
   */
  /** `offRule`: rows whose id isn't what the rule gives for their name now (should be none). */
  ids?: { linked: number; unlinked: number; disagree: number; onRemoved: number; offRule: number };
  /** Up to 50 names each, most rows first. */
  samples: { none: NameSample[]; several: NameSample[]; loose: NameSample[]; archived: NameSample[]; trimmed: NameSample[] };
};

const emptyMatch = (): Record<NameMatch, number> => ({ exact: 0, case: 0, trimmed: 0, several: 0, loose: 0, archivedOnly: 0, none: 0, walkin: 0, blank: 0 });
const emptySamples = (): NameLinkReport["samples"] => ({ none: [], several: [], loose: [], archived: [], trimmed: [] });

export function reportNameLink(link: NameLink, counts: { name: string | null; n: number }[], ix: NameIndex): NameLinkReport {
  const byMatch = emptyMatch();
  const samples = emptySamples();
  let rows = 0;
  let names = 0;
  let inactiveRows = 0;
  const bucket: Partial<Record<NameMatch, keyof NameLinkReport["samples"]>> = { none: "none", several: "several", loose: "loose", archivedOnly: "archived", trimmed: "trimmed" };
  for (const c of [...counts].sort((a, b) => b.n - a.n)) {
    rows += c.n;
    if (c.name != null) names += 1;
    const m = matchName(c.name, ix);
    byMatch[m.match] += c.n;
    const key = bucket[m.match];
    if (key && samples[key].length < 50)
      samples[key].push({
        name: String(c.name ?? ""),
        rows: c.n,
        accounts: m.accounts.map((a) => ({ id: a.id, name: a.name, archived: !!a.archived, inactive: !!a.inactive })),
      });
    if ((m.match === "exact" || m.match === "case" || m.match === "trimmed") && m.accounts[0]!.inactive) inactiveRows += c.n;
  }
  return { ...link, present: true, rows, names, byMatch, inactiveRows, samples };
}

export type MachineReport = {
  accountUnits: { total: number; withSerial: number; noSerial: number; staleKey: number; locked: number };
  retiredUnits: number;
  /** Every kind of record (equipment, dispensers, modules). */
  warehouse: { total: number; withSerial: number; noSerial: number; bulk: number; byStatus: { status: string; n: number }[]; byKind: { kind: string; n: number }[] };
  /** Serials as one machine would be keyed (migration 0137's key; placeholders and short ones don't count). */
  serials: {
    distinct: number;
    accountOnly: number;
    warehouseOnly: number;
    /** On an account unit and an unsold warehouse record. Deployed is how a placed machine reads; ready or held is not. */
    bothActive: number;
    bothNotDeployed: number;
    /** On an account unit and only sold warehouse records. */
    bothSold: number;
    /** On more than one unsold warehouse record (old data, before 0137). */
    warehouseTwice: number;
    /** On more than one account unit (old data, before 0137). */
    accountTwice: number;
  };
  links: { rebuildMachinesNoAsset: number; rebuildMachinesMissingAsset: number; modulesMissingUnit: number; ticketUnits: number; inspectionUnits: number };
  /** Installs whose machine list has rows, and those rows without a unit id. */
  installLists: { installs: number; rows: number; rowsWithoutUnit: number; rowsDangling: number };
};

export type LinkCheck = {
  at: string;
  accounts: { total: number; listed: number; inactive: number; retired: number; archived: number; merged: number; withNetsuiteId: number; sameNameOtherCase: number };
  nameLinks: NameLinkReport[];
  machines: MachineReport;
  /** Row counts of the larger tables a backfill would touch (choice 7 in the plan). */
  tableRows: { table: string; rows: number }[];
};

const n = (v: unknown) => Number(v ?? 0) || 0;

async function columnsOf(sql: Sql): Promise<Set<string>> {
  const rows = await sql.query<{ t: string; c: string }>(
    "select table_name as t, column_name as c from information_schema.columns where table_schema = current_schema()",
  );
  return new Set(rows.map((r) => `${r.t}.${r.c}`));
}

async function count(sql: Sql, text: string, params: unknown[] = []): Promise<number> {
  return n((await sql.query<{ n: number }>(text, params))[0]?.n);
}

export async function linkCheckFor(sql: Sql, userId: string): Promise<LinkCheck> {
  if (!(await canReviewNames(sql, userId))) throw new Error(LINK_CHECK_ADMIN_ONLY);
  const cols = await columnsOf(sql);
  const has = (t: string, c: string) => cols.has(`${t}.${c}`);

  const col = (c: string, expr: string, otherwise = "false") => (has("directory_customers", c) ? expr : otherwise);
  const accountsRaw = await sql.query<{ id: number; name: string; archived: boolean; inactive: boolean; retired: boolean; netsuite: boolean }>(
    `select id, name,
            ${col("archived", "coalesce(archived, false)")} as archived,
            ${col("inactive", "coalesce(inactive, false)")} as inactive,
            ${col("retired_at", "retired_at is not null")} as retired,
            ${col("netsuite_id", "coalesce(btrim(netsuite_id::text), '') <> ''")} as netsuite
       from directory_customers`,
  );
  const accounts: Account[] = accountsRaw.map((a) => {
    const name = String(a.name ?? "");
    return { id: Number(a.id), name, archived: !!a.archived, merged: !!a.archived && / · merged \d+$/.test(name), inactive: !!a.inactive, retired: !!a.retired };
  });
  const ix = indexAccounts(accounts);
  const listed = accounts.filter((a) => !a.archived);
  const sameNameOtherCase = [...indexAccounts(listed).trimmed.values()].filter((l) => l.length > 1).reduce((s, l) => s + l.length, 0);

  const nameLinks: NameLinkReport[] = [];
  for (const link of NAME_LINKS) {
    if (!has(link.table, link.column)) {
      nameLinks.push({ ...link, present: false, rows: 0, names: 0, byMatch: emptyMatch(), inactiveRows: 0, samples: emptySamples() });
      continue;
    }
    const counts = await sql.query<{ name: string | null; n: number }>(
      `select ${link.column}::text as name, count(*)::int as n from ${link.table} group by 1`,
    );
    const report = reportNameLink(link, counts.map((c) => ({ name: c.name, n: n(c.n) })), ix);
    if (link.column === "customer" && has(link.table, "customer_id")) {
      const ids = (
        await sql.query<Record<string, number>>(
          `select count(*) filter (where t.customer_id is not null)::int as linked,
                  count(*) filter (where t.customer_id is null and coalesce(btrim(t.customer), '') <> ''
                                     and regexp_replace(lower(t.customer), '[^a-z0-9]+', '', 'g') <> 'walkin')::int as unlinked,
                  count(*) filter (where d.id is not null and lower(btrim(d.name)) <> lower(btrim(coalesce(t.customer, ''))))::int as disagree,
                  count(*) filter (where d.archived)::int as on_removed,
                  count(*) filter (where t.customer_id is distinct from katz_customer_id(t.customer))::int as off_rule
             from ${link.table} t left join directory_customers d on d.id = t.customer_id`,
        )
      )[0]!;
      report.ids = { linked: n(ids.linked), unlinked: n(ids.unlinked), disagree: n(ids.disagree), onRemoved: n(ids.on_removed), offRule: n(ids.off_rule) };
    }
    nameLinks.push(report);
  }

  // Machines. The serial key is migration 0137's (the desk's key); placeholders and short keys don't count.
  const counts1 = (
    await sql.query<Record<string, number>>(
      `select count(*)::int as total,
              count(*) filter (where katz_serial_counts(coalesce(nullif(serial_key, ''), katz_serial_key(serial))))::int as with_serial,
              count(*) filter (where coalesce(serial_key, '') <> '' and serial_key is distinct from katz_serial_key(serial))::int as stale_key,
              count(*) filter (where locked_at is not null)::int as locked
         from account_equipment`,
    )
  )[0]!;
  const retiredUnits = has("account_equipment_retired", "id") ? await count(sql, "select count(*)::int as n from account_equipment_retired") : 0;
  const wh = (
    await sql.query<Record<string, number>>(
      `select count(*)::int as total,
              count(*) filter (where katz_serial_counts(katz_serial_key(serial)))::int as with_serial,
              count(*) filter (where coalesce(qty, 1) > 1)::int as bulk
         from assets`,
    )
  )[0]!;
  const byStatus = (await sql.query<{ status: string; n: number }>("select coalesce(status, '') as status, count(*)::int as n from assets group by 1 order by 2 desc")).map((r) => ({
    status: r.status || "(none)",
    n: n(r.n),
  }));
  const byKind = (await sql.query<{ kind: string; n: number }>("select coalesce(kind, '') as kind, count(*)::int as n from assets group by 1 order by 2 desc")).map((r) => ({
    kind: r.kind || "(none)",
    n: n(r.n),
  }));
  const serials = (
    await sql.query<Record<string, number>>(
      `with acct as (
         select coalesce(nullif(serial_key, ''), katz_serial_key(serial)) as k, count(*) as units from account_equipment group by 1
       ), wh as (
         select katz_serial_key(serial) as k, count(*) filter (where status <> 'sold') as active,
                count(*) filter (where status not in ('sold', 'deployed')) as instock, count(*) as total from assets group by 1
       ), keys as (
         select coalesce(a.k, w.k) as k, coalesce(a.units, 0) as units, coalesce(w.active, 0) as active, coalesce(w.instock, 0) as instock,
                coalesce(w.total, 0) as wtotal
           from acct a full join wh w on w.k = a.k
       )
       select count(*)::int as distinct_keys,
              count(*) filter (where units > 0 and wtotal = 0)::int as account_only,
              count(*) filter (where units = 0 and wtotal > 0)::int as warehouse_only,
              count(*) filter (where units > 0 and active > 0)::int as both_active,
              count(*) filter (where units > 0 and instock > 0)::int as both_instock,
              count(*) filter (where units > 0 and wtotal > 0 and active = 0)::int as both_sold,
              count(*) filter (where active > 1)::int as warehouse_twice,
              count(*) filter (where units > 1)::int as account_twice
         from keys where katz_serial_counts(k)`,
    )
  )[0]!;
  const links = {
    rebuildMachinesNoAsset: has("rebuild_machines", "asset_id") ? await count(sql, "select count(*)::int as n from rebuild_machines where asset_id is null") : 0,
    rebuildMachinesMissingAsset: has("rebuild_machines", "asset_id")
      ? await count(sql, "select count(*)::int as n from rebuild_machines r where r.asset_id is not null and not exists (select 1 from assets a where a.id = r.asset_id)")
      : 0,
    modulesMissingUnit: has("modules", "assigned_unit_id")
      ? await count(
          sql,
          "select count(*)::int as n from modules m where m.assigned_unit_id is not null and not exists (select 1 from account_equipment u where u.id = m.assigned_unit_id)",
        )
      : 0,
    ticketUnits: has("ticket_units", "job_id") ? await count(sql, "select count(*)::int as n from ticket_units") : 0,
    inspectionUnits: has("install_inspection_units", "equipment_id") ? await count(sql, "select count(*)::int as n from install_inspection_units") : 0,
  };
  // Install lists as machines.ts reads them: rows with an equipment name; a unit link counts only when that unit exists.
  const listRows = await sql.query<{ machines: string | null }>("select machines from installs where coalesce(btrim(machines), '') not in ('', '[]')");
  const unitIds = new Set((await sql.query<{ id: number }>("select id from account_equipment")).map((r) => Number(r.id)));
  let listInstalls = 0;
  let rowsTotal = 0;
  let rowsWithoutUnit = 0;
  let rowsDangling = 0;
  for (const r of listRows) {
    let list: unknown;
    try {
      list = JSON.parse(String(r.machines));
    } catch {
      continue; // typed text, not a list
    }
    if (!Array.isArray(list)) continue;
    const real = list.filter((m) => m && typeof m === "object" && String((m as { equipment?: unknown }).equipment ?? "").trim());
    if (!real.length) continue;
    listInstalls += 1;
    for (const m of real) {
      rowsTotal += 1;
      const id = Number((m as { unitId?: unknown }).unitId);
      if (!(id > 0)) rowsWithoutUnit += 1;
      else if (!unitIds.has(id)) rowsDangling += 1;
    }
  }

  const tableRows: { table: string; rows: number }[] = [];
  for (const t of [...new Set(NAME_LINKS.map((l) => l.table))]) {
    if (!has(t, "id") && ![...cols].some((c) => c.startsWith(`${t}.`))) continue;
    tableRows.push({ table: t, rows: await count(sql, `select count(*)::int as n from ${t}`) });
  }
  tableRows.sort((a, b) => b.rows - a.rows);

  return {
    at: new Date().toISOString(),
    accounts: {
      total: accounts.length,
      listed: listed.length,
      inactive: listed.filter((a) => a.inactive && !a.retired).length,
      retired: listed.filter((a) => a.retired).length,
      archived: accounts.filter((a) => a.archived && !a.merged).length,
      merged: accounts.filter((a) => a.merged).length,
      withNetsuiteId: accountsRaw.filter((a) => a.netsuite).length,
      sameNameOtherCase,
    },
    nameLinks,
    machines: {
      accountUnits: { total: n(counts1.total), withSerial: n(counts1.with_serial), noSerial: n(counts1.total) - n(counts1.with_serial), staleKey: n(counts1.stale_key), locked: n(counts1.locked) },
      retiredUnits,
      warehouse: { total: n(wh.total), withSerial: n(wh.with_serial), noSerial: n(wh.total) - n(wh.with_serial), bulk: n(wh.bulk), byStatus, byKind },
      serials: {
        distinct: n(serials.distinct_keys),
        accountOnly: n(serials.account_only),
        warehouseOnly: n(serials.warehouse_only),
        bothActive: n(serials.both_active),
        bothNotDeployed: n(serials.both_instock),
        bothSold: n(serials.both_sold),
        warehouseTwice: n(serials.warehouse_twice),
        accountTwice: n(serials.account_twice),
      },
      links,
      installLists: { installs: listInstalls, rows: rowsTotal, rowsWithoutUnit, rowsDangling },
    },
    tableRows,
  };
}

async function ready() {
  return getSql();
}

export const getLinkCheck = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }) => linkCheckFor(await ready(), context.userId));
