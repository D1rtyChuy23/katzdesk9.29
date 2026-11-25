import type { Sql } from "@/lib/db";
import { requireNameReviewer } from "./access";
import { mergeToken, type RenameCounts, type RenameMergePlan, type RenamePlan, type RenameResult } from "./customer-rename";
import { catalogModels, listedEquipment, rewriteEquipmentName, samePiece } from "./equipment";
import { flagOn } from "./flag";
import { parseMachinesJson, serializeMachines } from "./machines";

/**
 * A rename passes over a table or column this database doesn't have (an older one). Any other failure stops it with
 * its error, before the account takes its new name, so renaming again finishes the job (11/9: every failure used to
 * be passed over, which left records on a name no account had).
 */
function missingOnly(e: unknown): undefined {
  const code = (e as { code?: string } | null)?.code;
  if (code === "42P01" || code === "42703") return undefined;
  throw e;
}

/**
 * Which rows are the account's (C4): the rows linked to it by id, and the rows with no id under its name in any
 * capitals (an account off the list, or a name the rule couldn't settle). Never a row linked to another account, so a
 * rename or merge doesn't take what the rule gives someone else, and a row linked by id whose name has spaces at the
 * ends moves with the rest. `x` is the row's alias; `name`/`id` its columns; `$name`/`$id` the parameters.
 */
const theAccounts = (x: string, name: string, id: string, $name: string, $id: string) =>
  // The lower(btrim(...)) test adds nothing to the match; it lets the name's key index (0138, 0141, 0145) find the rows.
  `(${x}.${id} = ${$id}::int or (${x}.${id} is null and lower(btrim(${x}.${name})) = lower(btrim(${$name})) and lower(${x}.${name}) = lower(${$name})))`;

/**
 * The rows that already hold `to` for the link checks (dropLinksAlreadyOn): on a merge (`toId` another account) the
 * kept account's rows; on a rename, rows under the new name that aren't the account's own. Parameters: $2 the new
 * name, $3 the account's id (rename) or $4 the kept account's id (merge).
 */
const holdersOf = (x: string, merge: boolean) =>
  merge
    ? theAccounts(x, "customer", "customer_id", "$2", "$4")
    : `(lower(${x}.customer) = lower($2) and ${x}.customer_id is distinct from $3::int)`;

/**
 * Links `to` already has (a provider, its Out Of Network details, a recipe with the same model and name) are dropped
 * from `from`, so moving `from` onto `to` never doubles them: `to`'s links stay. A recipe with another name moves.
 * `fromId` is the account whose rows move; `toId` the account they move to (the same one on a rename).
 */
async function dropLinksAlreadyOn(sql: Sql, from: string, to: string, fromId: number, toId: number): Promise<void> {
  const merge = toId !== fromId;
  const params = merge ? [from, to, fromId, toId] : [from, to, fromId];
  const mine = theAccounts("a", "customer", "customer_id", "$1", "$3");
  const theirs = holdersOf("b", merge);
  await sql.query(
    `delete from customer_providers a using customer_providers b
      where a.id <> b.id and ${mine} and ${theirs} and a.provider_id = b.provider_id`,
    params,
  ).catch(missingOnly);
  await sql.query(`delete from network_accounts a using network_accounts b where a.id <> b.id and ${mine} and ${theirs}`, params).catch(missingOnly);
  await sql.query(
    `delete from recipes a using recipes b
      where a.id <> b.id and ${mine} and ${theirs}
        and lower(a.equipment_model) = lower(b.equipment_model) and lower(coalesce(a.name, '')) = lower(coalesce(b.name, ''))`,
    params,
  ).catch(missingOnly);
}

/**
 * A name column that follows its account on a rename or merge (C1–C3), with the id column beside it. `stamp`: the
 * table has updated_at. `only`: which of the table's rows follow. `key`: the table's unique key beside the name
 * (lower(name) is unique within it), comparing rows `p` and `q`.
 * Not here: history rows (invoices, module stops, move requests, decided stock actions) keep the name they had
 * (choice 2); a merge moves only their id (HISTORY, below).
 */
type Follow = { table: string; name: string; id: string; stamp?: boolean; only?: (x: string) => string; key?: (p: string, q: string) => string };

const FOLLOW: Follow[] = [
  { table: "service_jobs", name: "customer", id: "customer_id", stamp: true },
  { table: "pm_jobs", name: "customer", id: "customer_id", stamp: true },
  { table: "installs", name: "customer", id: "customer_id", stamp: true },
  { table: "deals", name: "customer", id: "customer_id", stamp: true },
  {
    table: "recipes",
    name: "customer",
    id: "customer_id",
    key: (p, q) => `lower(${p}.equipment_model) = lower(${q}.equipment_model) and lower(coalesce(${p}.name, '')) = lower(coalesce(${q}.name, ''))`,
  },
  { table: "customer_providers", name: "customer", id: "customer_id", stamp: true, key: (p, q) => `${p}.provider_id = ${q}.provider_id` },
  { table: "network_accounts", name: "customer", id: "customer_id", stamp: true, key: () => "true" },
  { table: "assets", name: "customer_owned", id: "customer_owned_id", stamp: true },
  { table: "assets", name: "sold_to", id: "sold_to_id", stamp: true },
  { table: "account_equipment", name: "customer", id: "customer_id", stamp: true },
  // Work order history (QuickBooks) follows its account.
  { table: "wo_history", name: "customer", id: "customer_id" },
  // So do rebuilds (11/2 review: a pulled unit goes back to its account under the new name).
  { table: "rebuilds", name: "account", id: "account_id", stamp: true },
  // An Eversys module on one of the account's units (11/9).
  { table: "modules", name: "assigned_customer", id: "assigned_customer_id", stamp: true },
  // A unit Warehouse asked to send to the account, still waiting for an Admin: the hold and the request (11/9). A
  // request already decided is history and keeps the name it was decided under.
  { table: "assets", name: "stock_hold_customer", id: "stock_hold_customer_id", stamp: true },
  { table: "asset_stock_actions", name: "customer", id: "customer_id", only: (x) => `${x}.status = 'pending'` },
  // A machine retired from the account stays on its Retired list.
  { table: "account_equipment_retired", name: "customer", id: "customer_id" },
];

/**
 * Moves one column's rows from the account `fromId` (under `$2`) to `toId` under the name `$1`. Parameters: $1 the new
 * name, $2 the old, $3 fromId, $4 toId.
 *
 * Where the name is unique within a key (an Out Of Network row per account, a provider once per account, a recipe
 * name per model), one row per key moves: the one already under the new name, else the one under the old name in any
 * capitals, else the oldest. The others stay as they were (their id goes when the account takes its new name, so Link
 * Check lists them), and a row another account holds under the new name is never doubled: a rename never fails on it.
 *
 * The id is set with the name. When the row was already on `toId`, the record's trigger works the id out again from
 * the new name (0138), which no account has until the account itself is renamed last, or which another account has by
 * the rule's last step ("Zz B " for "Zz B"). So moveRecords sets it once more on the rows the trigger changed. It
 * returns each moved row's id and the id it ended with.
 */
function moveSql(f: Follow): string {
  const mine = (x: string) => theAccounts(x, f.name, f.id, "$2", "$3") + (f.only ? ` and ${f.only(x)}` : "");
  let text = `update ${f.table} t set ${f.name} = $1, ${f.id} = $4::int${f.stamp ? ", updated_at = now()" : ""}
     where ${mine("t")} and (t.${f.name} is distinct from $1 or t.${f.id} is distinct from $4::int)`;
  if (f.key) {
    text += `
       and t.id = (select c.id from ${f.table} c where ${mine("c")} and ${f.key("c", "t")}
                    order by (c.${f.name} = $1) desc, (lower(c.${f.name}) = lower($2)) desc, c.id limit 1)
       and not exists (select 1 from ${f.table} b
                        where b.id <> t.id and lower(b.${f.name}) = lower($1) and ${f.key("b", "t")} and not ${mine("b")})`;
  }
  return `${text}
     returning t.id, t.${f.id} as now_id`;
}

/**
 * A rebuild machine's record of its unit before the pull names accounts (whose the unit was, and whom the pull put it
 * on), so taking the machine off puts the unit back on the account under its new name. $1 the new name, $2 the old.
 * These names have no id.
 */
const ORIGIN_NAMES = `
  update rebuild_machines set
         origin = origin
           || case when lower(coalesce(origin->>'sold_to', '')) = lower($2) then jsonb_build_object('sold_to', $1::text) else '{}'::jsonb end
           || case when lower(coalesce(origin->>'pulled_to', '')) = lower($2) then jsonb_build_object('pulled_to', $1::text) else '{}'::jsonb end,
         updated_at = now()
   where origin is not null
     and ((lower(coalesce(origin->>'sold_to', '')) = lower($2) and origin->>'sold_to' is distinct from $1::text)
          or (lower(coalesce(origin->>'pulled_to', '')) = lower($2) and origin->>'pulled_to' is distinct from $1::text))`;

/** An Eversys module on one of the account's units: its place reads the account's name (a place, so no id). */
const MODULE_PLACE = `update modules set location = $1, updated_at = now() where assigned_unit_id is not null and lower(location) = lower($2) and location is distinct from $1`;

/** Every record that follows the account: the rows of `fromId` (see theAccounts) take `to` and the id `toId`. */
async function moveRecords(sql: Sql, from: string, to: string, fromId: number, toId: number): Promise<void> {
  for (const f of FOLLOW) {
    const moved = (await sql.query<{ id: number; now_id: number | null }>(moveSql(f), [to, from, fromId, toId]).catch(missingOnly)) ?? [];
    const off = moved.filter((r) => r.now_id == null || Number(r.now_id) !== toId).map((r) => Number(r.id));
    // Only the id column: no record trigger works it out again.
    if (off.length) await sql.query(`update ${f.table} set ${f.id} = $2::int where id = any($1::int[])`, [off, toId]);
  }
  await sql.query(ORIGIN_NAMES, [to, from]).catch(missingOnly);
  await sql.query(MODULE_PLACE, [to, from]).catch(missingOnly);
}

/**
 * History rows keep the name they had (choice 2), so a merge moves only their id: invoices, module stops, move
 * requests and stock actions on the merged-away account belong to the kept one (C4; C3 left them on it).
 */
const HISTORY: [string, string][] = [
  ["invoices", "customer_id"],
  ["module_stops", "customer_id"],
  ["equipment_move_requests", "from_customer_id"],
  ["equipment_move_requests", "to_customer_id"],
  ["asset_stock_actions", "customer_id"],
];
async function moveHistory(sql: Sql, droppedId: number, keptId: number): Promise<void> {
  for (const [table, col] of HISTORY) {
    await sql.query(`update ${table} set ${col} = $2::int where ${col} = $1::int`, [droppedId, keptId]).catch(missingOnly);
  }
}

/**
 * Every table that stores a customer as a name: the records of account `fromId` take the name `to` and the id `toId`
 * (the same account on a rename, the kept one on a merge). The same name in other capitals only changes the capitals.
 */
export async function retargetCustomer(sql: Sql, fromRaw: string, toRaw: string, fromId: number, toId: number): Promise<void> {
  // Without the ids no record linked to the account would be found (and nothing would say so).
  if (!Number.isInteger(fromId) || !Number.isInteger(toId)) throw new Error("retargetCustomer needs the account ids");
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from || !to) return;
  if (from.toLowerCase() !== to.toLowerCase()) await dropLinksAlreadyOn(sql, from, to, fromId, toId);
  await moveRecords(sql, from, to, fromId, toId);
}

type AccountRow = Record<string, unknown> & { id: number; name: string };

const BILLING = ["billing_address1", "billing_address2", "billing_city", "billing_state", "billing_zip", "billing_country"];
const PIN = ["latitude", "longitude", "geocode_match", "geocode_address", "geocoded_at"];
const filledIn = (r: AccountRow, col: string) => r[col] != null && String(r[col]).trim() !== "";
const addressKey = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Details a merge copies onto the kept account from the one that goes, only where the kept account has none (Grok,
 * 2026-10-27: "Fill only blank fields from the old record"). An address block or a pin goes whole, so two places are
 * never mixed, and a pin only comes with the address it goes with. Columns are fixed here, never from input.
 */
const FILLS: { label: string; cols: string[]; has: (r: AccountRow) => boolean }[] = [
  { label: "address", cols: ["address"], has: (r) => filledIn(r, "address") },
  { label: "billing address", cols: BILLING, has: (r) => BILLING.some((c) => filledIn(r, c)) },
  { label: "map pin", cols: PIN, has: (r) => r.latitude != null && r.longitude != null },
  { label: "primary sales rep", cols: ["account_rep", "rep_flag"], has: (r) => filledIn(r, "account_rep") },
  { label: "primary contact", cols: ["primary_contact"], has: (r) => filledIn(r, "primary_contact") },
  { label: "phone", cols: ["phone"], has: (r) => filledIn(r, "phone") },
  { label: "email", cols: ["email"], has: (r) => filledIn(r, "email") },
  { label: "Account #", cols: ["account_number"], has: (r) => filledIn(r, "account_number") },
  { label: "NetSuite ID", cols: ["netsuite_id"], has: (r) => filledIn(r, "netsuite_id") },
  { label: "parent account", cols: ["parent_account", "walk_in"], has: (r) => filledIn(r, "parent_account") },
];

/** The account's calls, TLCs, PMs, installs, deals, equipment and QuickBooks work orders (the rows a merge moves). */
async function recordsUnder(sql: Sql, name: string, id: number): Promise<RenameCounts> {
  const n = async (text: string) =>
    Number((await sql.query<{ n: number }>(text, [name, id]).catch(() => [] as { n: number }[]))[0]?.n ?? 0);
  const of = (x: string, nameCol = "customer", idCol = "customer_id") => theAccounts(x, nameCol, idCol, "$1", "$2");
  return {
    calls: await n(`select count(*)::int as n from service_jobs t where ${of("t")} and coalesce(kind, '') <> 'tlc'`),
    tlcs: await n(`select count(*)::int as n from service_jobs t where ${of("t")} and kind = 'tlc'`),
    pms: await n(`select count(*)::int as n from pm_jobs t where ${of("t")}`),
    installs: await n(`select count(*)::int as n from installs t where ${of("t")} and archived = false`),
    deals: await n(`select count(*)::int as n from deals t where ${of("t")} and archived = false`),
    equipment: await n(`select count(*)::int as n from account_equipment t where ${of("t")}`),
    woHistory: await n(`select count(*)::int as n from wo_history t where ${of("t")}`),
    rebuilds: await n(`select count(*)::int as n from rebuilds t where ${of("t", "account", "account_id")} and not coalesce(archived, false)`),
  };
}

const isoOf = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

/** A merged-away account's name: "… · merged <id>", the startup merge's mark (customer-remove-api.ts keeps it off Removed). */
const parkedName = (r: AccountRow) => (r.name.includes(" · merged ") ? r.name : `${r.name.slice(0, 140)} · merged ${r.id}`);

type Planned = {
  row: AccountRow;
  plan: RenamePlan;
  merge?: { plan: RenameMergePlan; kept: AccountRow; dropped: AccountRow; cols: string[]; moveReps: boolean };
};

/** What renaming account `id` to `nextRaw` would do. Nothing is written; renameOrMergeCustomer does exactly this. */
async function planFor(sql: Sql, id: number, nextRaw: string, opts?: { force?: boolean }): Promise<Planned> {
  const next = nextRaw.trim();
  if (!next) throw new Error("Customer name is empty");
  const row = (await sql.query<AccountRow>(`select * from directory_customers where id = $1`, [id]))[0];
  if (!row) throw new Error("Customer not found");
  if (row.name === next) return { row, plan: { kind: "same", id: row.id, name: row.name } };
  // A name applied from the clean customer list stays as it is until it is unlocked on the Clean Names review.
  if (flagOn(row.name_locked) && !opts?.force) {
    throw new Error(`“${row.name}” is locked from the clean customer list. Unlock it on the Clean Names review to change it.`);
  }

  // Another account with the name in any capitals; one on the list comes first.
  const other = (
    await sql.query<AccountRow>(`select * from directory_customers where lower(name) = lower($1) and id <> $2 order by archived, id limit 1`, [
      next,
      id,
    ])
  )[0];
  if (!other) {
    // Only the capitals change, or a new name nobody has.
    return { row, plan: { kind: "rename", id: row.id, from: row.name, name: next, caseOnly: row.name.toLowerCase() === next.toLowerCase() } };
  }

  // An old account off the list never wins over the one being renamed. One on the list is kept (Possible Duplicates:
  // "rename the one you don't keep to the one you keep").
  const keep = flagOn(other.archived) ? "renamed" : "existing";
  const kept = keep === "renamed" ? row : other;
  const dropped = keep === "renamed" ? other : row;
  const lockedName = keep === "existing" && flagOn(other.name_locked) && !opts?.force && other.name !== next;
  const name = lockedName ? other.name : next;
  // How the question names each side.
  const theirs = keep === "renamed" ? "The old account's" : "This account's";
  const ours = keep === "renamed" ? "this account" : `“${other.name}”`;

  if (flagOn(kept.archived) && filledIn(kept, "account_number")) {
    // The kept account comes back on the list, where Account Numbers are unique.
    const holder = (
      await sql.query<{ name: string }>(
        `select name from directory_customers
          where archived = false and id <> all($1::int[]) and lower(btrim(account_number)) = lower(btrim($2)) limit 1`,
        [[kept.id, dropped.id], String(kept.account_number)],
      )
    )[0];
    if (holder) throw new Error(`“${kept.name}” would come back on the list, but its Account # ${String(kept.account_number).trim()} is on “${holder.name}” now.`);
  }

  const filled: string[] = [];
  const notes: string[] = [];
  const cols: string[] = [];
  for (const f of FILLS) {
    if (f.has(kept) || !f.has(dropped)) continue;
    if (f.label === "map pin" && filledIn(kept, "address") && addressKey(kept.address) !== addressKey(dropped.address)) {
      notes.push(`${theirs} map pin isn't copied: it doesn't go with the address on ${ours}.`);
      continue;
    }
    if (f.label === "Account #") {
      // Account Numbers stay unique on the list.
      const holder = (
        await sql.query<{ name: string }>(
          `select name from directory_customers
            where archived = false and id <> all($1::int[]) and lower(btrim(account_number)) = lower(btrim($2)) limit 1`,
          [[kept.id, dropped.id], String(dropped.account_number)],
        )
      )[0];
      if (holder) {
        notes.push(`Account # ${String(dropped.account_number).trim()} isn't copied: “${holder.name}” has it.`);
        continue;
      }
    }
    filled.push(f.label);
    cols.push(...f.cols);
  }
  const reps = await sql
    .query<{ id: number; n: number }>(
      "select customer_id as id, count(*)::int as n from customer_sales_reps where customer_id = any($1::int[]) group by customer_id",
      [[kept.id, dropped.id]],
    )
    .catch(() => [] as { id: number; n: number }[]);
  const repsOn = (x: number) => Number(reps.find((r) => Number(r.id) === x)?.n ?? 0);
  const moveReps = repsOn(kept.id) === 0 && repsOn(dropped.id) > 0;
  if (moveReps) filled.push("assigned sales reps");

  // Links the kept account already has stay its own (dropLinksAlreadyOn); say what that leaves behind.
  if (kept.name.toLowerCase() !== dropped.name.toLowerCase()) {
    const count = async (text: string) =>
      Number((await sql.query<{ n: number }>(text, [dropped.name, kept.name, dropped.id, kept.id]).catch(() => [] as { n: number }[]))[0]?.n ?? 0);
    // The same rows dropLinksAlreadyOn compares: the merged-away account's, and the kept one's.
    const goes = theAccounts("a", "customer", "customer_id", "$1", "$3");
    const stays = holdersOf("b", true);
    if (await count(`select count(*)::int as n from network_accounts a, network_accounts b where a.id <> b.id and ${goes} and ${stays}`)) {
      notes.push(`${theirs} Out Of Network details aren't kept: ${ours} has its own.`);
    }
    const recipes = await count(
      `select count(*)::int as n from recipes a
        where ${goes} and exists (select 1 from recipes b
                                   where a.id <> b.id and ${stays} and lower(a.equipment_model) = lower(b.equipment_model)
                                     and lower(coalesce(a.name, '')) = lower(coalesce(b.name, '')))`,
    );
    if (recipes) {
      notes.push(
        `${recipes === 1 ? `1 recipe on ${keep === "renamed" ? "the old account" : "this account"} has` : `${recipes} recipes on ${keep === "renamed" ? "the old account" : "this account"} have`} the same model and name as one on ${ours}, so ${recipes === 1 ? "it isn't" : "they aren't"} kept.`,
      );
    }
  }

  const moving = await recordsUnder(sql, dropped.name, dropped.id);
  const otherRecords = other === dropped ? moving : await recordsUnder(sql, other.name, other.id);
  const otherHistory = otherRecords.calls + otherRecords.tlcs + otherRecords.pms + otherRecords.installs + otherRecords.deals + otherRecords.equipment;
  const removedAt = isoOf(other.removed_at);
  const plan: RenameMergePlan = {
    kind: "merge",
    id: row.id,
    from: row.name,
    name,
    keep,
    keptId: kept.id,
    droppedId: dropped.id,
    other: {
      id: other.id,
      name: other.name,
      archived: flagOn(other.archived),
      removedAt,
      removedBy: other.removed_by == null ? null : String(other.removed_by),
      // Same rule as Customers → Removed (customer-remove-api.ts).
      onRemovedList: flagOn(other.archived) && (removedAt != null || (!other.name.includes(" · merged ") && otherHistory > 0)),
    },
    lockedName,
    filled,
    notes,
    moving,
  };
  return { row, plan, merge: { plan, kept, dropped, cols, moveReps } };
}

/** What renaming would do, for the rename window: a plain rename, or a merge and what it moves. */
export async function planCustomerRename(sql: Sql, id: number, name: string, opts?: { force?: boolean }): Promise<RenamePlan> {
  return (await planFor(sql, id, name, opts)).plan;
}

/**
 * Renames a customer, or merges it with the account that already has the name (any capitals). Which account is kept
 * and what moves: customer-rename.ts. The kept account takes the name as planned, keeps its own details and fills only
 * blanks from the other. The account that goes is archived, parked as "… · merged <id>" and never listed under
 * Removed. Its calls, PMs, installs, deals, recipes, equipment, network links and QuickBooks history move to the kept
 * account; where both have the same link, the kept account's stays. Its invoices, module stops, move requests and
 * decided stock actions keep their names and move by id (C4). The records that move are the ones linked to the account
 * by id, and the ones with no id under its name in any capitals (theAccounts).
 */
export async function renameOrMergeCustomer(sql: Sql, id: number, nextRaw: string, opts?: { force?: boolean }): Promise<RenameResult> {
  return applyPlanned(sql, await planFor(sql, id, nextRaw, opts));
}

/** Does exactly what the plan says. Not one transaction: if it stops partway, renaming again finishes it. */
async function applyPlanned(sql: Sql, { row, plan, merge }: Planned): Promise<RenameResult> {
  const id = row.id;
  if (plan.kind === "same") return { id: row.id, name: row.name, merged: false };
  if (plan.kind === "rename") {
    await retargetCustomer(sql, row.name, plan.name, id, id);
    await sql.query(`update directory_customers set name = $1, archived = false, updated_at = now() where id = $2`, [plan.name, id]);
    return { id, name: plan.name, merged: false };
  }

  const { kept, dropped, cols, moveReps } = merge!;
  if (kept.name.toLowerCase() !== dropped.name.toLowerCase()) await dropLinksAlreadyOn(sql, dropped.name, kept.name, dropped.id, kept.id);
  await retargetCustomer(sql, kept.name, plan.name, kept.id, kept.id);
  await retargetCustomer(sql, dropped.name, plan.name, dropped.id, kept.id);
  // Records with no id filed under the name in other capitals ("test bakery - main") take the kept name's.
  await moveRecords(sql, plan.name, plan.name, kept.id, kept.id);
  // History rows keep their names and move by id.
  await moveHistory(sql, dropped.id, kept.id);
  // Parked first: names are unique in any capitals, and the kept account takes this one's name.
  await sql.query(
    `update directory_customers set name = $2, archived = true, removed_at = null, removed_by = null, updated_at = now() where id = $1`,
    [dropped.id, parkedName(dropped)],
  );
  await sql.query(
    `update directory_customers k
        set name = $2, archived = false,
            removed_at = case when k.archived then null else k.removed_at end,
            removed_by = case when k.archived then null else k.removed_by end,
            ${cols.map((c) => `${c} = d.${c}, `).join("")}updated_at = now()
       from directory_customers d
      where k.id = $1 and d.id = $3`,
    [kept.id, plan.name, dropped.id],
  );
  if (moveReps) await sql.query("update customer_sales_reps set customer_id = $1 where customer_id = $2", [kept.id, dropped.id]);
  return { id: kept.id, name: plan.name, merged: true, kept: plan.keep, filled: plan.filled };
}

/** The rename window's preview, for a desk admin or the Admin role. */
export async function previewCustomerRenameFor(sql: Sql, userId: string, id: number, name: string): Promise<RenamePlan> {
  await requireNameReviewer(sql, userId, "Only an admin can rename or merge customers.");
  return planCustomerRename(sql, id, name);
}

/**
 * Rename or merge a customer for a person: a desk admin or anyone with the Admin role (Chuy, 2026-10-27). Sales,
 * Service and Warehouse can't. A merge is never silent: it needs `confirmMerge`, the token of the merge question the
 * rename window showed (which account is kept, which goes). The plan checked here is the one carried out. Each change
 * gets a history line on the accounts it touched.
 */
export async function renameCustomerFor(
  sql: Sql,
  userId: string,
  id: number,
  name: string,
  opts?: { confirmMerge?: string | null },
): Promise<RenameResult> {
  await requireNameReviewer(sql, userId, "Only an admin can rename or merge customers.");
  const planned = await planFor(sql, id, name);
  const { plan } = planned;
  if (plan.kind === "merge" && opts?.confirmMerge !== mergeToken(plan)) {
    throw new Error(
      opts?.confirmMerge
        ? "These accounts changed since the merge question. Choose Back, then Save name again to see what would happen now."
        : `“${plan.other.name}” ${plan.other.archived ? "is an old account with that name" : "already has that name"}, so saving would merge the two. ` +
            "Reload the page and rename again to see what would move before you say yes.",
    );
  }
  const res = await applyPlanned(sql, planned);
  if (plan.kind === "same") return res;
  const who = (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
  const log = (entityId: number, action: string, detail: string) =>
    sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, $3, $4)", [
      entityId,
      who,
      action,
      detail,
    ]);
  if (plan.kind === "rename") {
    await log(id, "renamed", `Renamed from “${plan.from}” to “${plan.name}”`);
    return res;
  }
  const filled = plan.filled.length ? ` Filled in from it: ${plan.filled.join(", ")}.` : "";
  if (plan.keep === "renamed") {
    await log(plan.keptId, "merged", `Renamed from “${plan.from}” to “${plan.name}”; the old account “${plan.other.name}” (#${plan.other.id}) was merged into it.${filled}`);
  } else {
    await log(plan.keptId, "merged", `“${plan.from}” (#${plan.id}) was merged into this account.${filled}`);
  }
  await log(plan.droppedId, "merged", `Merged into “${plan.name}” (#${plan.keptId}).`);
  return res;
}

export async function retargetEquipment(sql: Sql, fromRaw: string, toRaw: string): Promise<void> {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from || !to) return;

  const dir = await sql.query<{ name: string }>(
    `select name from directory_equipment where archived = false and coalesce(name,'') <> ''`,
  );
  const catalog = catalogModels([...dir.map((r) => r.name), from, to]);

  const blobs: [string, string][] = [
    ["service_jobs", "equipment"],
    ["pm_jobs", "equipment"],
    ["deals", "equipment"],
    ["installs", "equipment"],
  ];
  for (const [table, col] of blobs) {
    const rows = await sql.query<{ id: number; blob: string }>(
      `select id, ${col} as blob from ${table}
       where ${col} is not null and ${col} <> ''
         and (lower(${col}) = lower($1) or ${col} ilike '%' || $1 || '%')`,
      [from],
    );
    for (const row of rows) {
      const next = rewriteEquipmentName(row.blob, from, to, catalog);
      if (next !== row.blob) {
        await sql.query(`update ${table} set ${col} = $1, updated_at = now() where id = $2`, [next, row.id]).catch(async () => {
          await sql.query(`update ${table} set ${col} = $1 where id = $2`, [next, row.id]);
        });
      }
    }
  }

  await sql.query(`update recipes set equipment_model = $1 where lower(equipment_model) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update assets set model = $1, updated_at = now() where lower(model) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update account_equipment set catalog_model = $1, updated_at = now() where lower(catalog_model) = lower($2)`, [to, from]).catch(() => undefined);

  const machineRows = await sql.query<{ id: number; machines: string; equipment: string | null }>(
    `select id, machines, equipment from installs where machines is not null and machines <> ''`,
  );
  for (const row of machineRows) {
    const specs = parseMachinesJson(row.machines);
    if (!specs.length) continue;
    let hit = false;
    const next = specs.map((s) => {
      if (!samePiece(s.equipment, from)) return s;
      hit = true;
      return { ...s, equipment: to };
    });
    if (!hit) continue;
    const names = listedEquipment(next.map((s) => s.equipment).join("\n"), catalog);
    const packed = serializeMachines(next.map((s, i) => ({ ...s, equipment: names[i] ?? s.equipment })));
    await sql.query(
      `update installs set machines = $1, equipment = $2, serial = $3, power_voltage = $4, updated_at = now() where id = $5`,
      [packed.machines, packed.equipment, packed.serial, packed.powerVoltage, row.id],
    ).catch(() => undefined);
  }
}

export async function renameOrMergeEquipment(
  sql: Sql,
  id: number,
  nextRaw: string,
): Promise<{ id: number; name: string; merged: boolean }> {
  const next = nextRaw.trim();
  if (!next) throw new Error("Equipment name is empty");
  const cur = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from directory_equipment where id = $1`,
    [id],
  );
  const row = cur[0];
  if (!row) throw new Error("Equipment not found");
  if (row.name === next) return { id: row.id, name: row.name, merged: false };

  const other = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from directory_equipment where lower(name) = lower($1) and id <> $2 limit 1`,
    [next, id],
  );
  if (other[0]) {
    const keep = other[0];
    await retargetEquipment(sql, row.name, keep.name);
    await sql.query(`update directory_equipment set archived = true, updated_at = now() where id = $1`, [id]);
    if (keep.archived) {
      await sql.query(`update directory_equipment set archived = false, name = $1, updated_at = now() where id = $2`, [
        keep.name,
        keep.id,
      ]);
    }
    return { id: keep.id, name: keep.name, merged: true };
  }

  await retargetEquipment(sql, row.name, next);
  await sql.query(`update directory_equipment set name = $1, archived = false, updated_at = now() where id = $2`, [
    next,
    id,
  ]);
  return { id, name: next, merged: false };
}

export async function renameOrMergeProvider(
  sql: Sql,
  id: number,
  nextRaw: string,
): Promise<{ id: number; name: string; merged: boolean }> {
  const next = nextRaw.trim();
  if (!next) throw new Error("Provider name is empty");
  const cur = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from network_providers where id = $1`,
    [id],
  );
  const row = cur[0];
  if (!row) throw new Error("Provider not found");
  if (row.name === next) return { id: row.id, name: row.name, merged: false };

  // A duplicate already merged into another provider (archived, merged_into set) is not a rename target: its name is
  // free to use again, and it must stay pointing at the provider it was merged into. An active provider comes first.
  const other = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from network_providers
      where lower(name) = lower($1) and id <> $2 and not (archived and merged_into is not null)
      order by archived, id limit 1`,
    [next, id],
  );
  if (other[0]) {
    const keep = other[0];
    await sql.query(
      `delete from customer_providers a
       using customer_providers b
       where a.provider_id = $1 and b.provider_id = $2 and lower(a.customer) = lower(b.customer)`,
      [id, keep.id],
    ).catch(() => undefined);
    await sql.query(`update customer_providers set provider_id = $1, updated_at = now() where provider_id = $2`, [
      keep.id,
      id,
    ]).catch(() => undefined);
    await sql.query(
      `delete from provider_locations a
       using provider_locations b
       where a.provider_id = $1 and b.provider_id = $2
         and a.state = b.state
         and coalesce(lower(a.city),'') = coalesce(lower(b.city),'')
         and coalesce(a.zip,'') = coalesce(b.zip,'')`,
      [id, keep.id],
    ).catch(() => undefined);
    await sql.query(`update provider_locations set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => undefined);
    await sql.query(`update provider_contacts set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => undefined);
    await sql.query(`update provider_addresses set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => undefined);
    // The merged provider points at the one that kept its customers, and so do the duplicates merged into it before.
    await sql.query(`update network_providers set archived = true, merged_into = $2, updated_at = now() where id = $1`, [id, keep.id]);
    await sql.query(`update network_providers set merged_into = $1 where merged_into = $2`, [keep.id, id]);
    if (keep.archived) {
      await sql.query(`update network_providers set archived = false, merged_into = null, name = $1, updated_at = now() where id = $2`, [
        keep.name,
        keep.id,
      ]);
    }
    return { id: keep.id, name: keep.name, merged: true };
  }

  await sql.query(
    `update network_providers set name = $1, archived = false, merged_into = null, last_updated = current_date, updated_at = now() where id = $2`,
    [next, id],
  );
  return { id, name: next, merged: false };
}
