import type { Sql } from "@/lib/db";
import { requireNameReviewer } from "./access";
import type { RenameCounts, RenameMergePlan, RenamePlan, RenameResult } from "./customer-rename";
import { catalogModels, listedEquipment, rewriteEquipmentName, samePiece } from "./equipment";
import { flagOn } from "./flag";
import { parseMachinesJson, serializeMachines } from "./machines";

/**
 * Links `to` already has (a provider, its network account, a recipe for the same model) are dropped from `from`, so
 * moving `from` onto `to` never doubles them: `to`'s links stay.
 */
async function dropLinksAlreadyOn(sql: Sql, from: string, to: string): Promise<void> {
  await sql.query(
    `delete from customer_providers a
     using customer_providers b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)
       and a.provider_id = b.provider_id`,
    [from, to],
  ).catch(() => undefined);

  await sql.query(
    `delete from network_accounts a
     using network_accounts b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)`,
    [from, to],
  ).catch(() => undefined);

  await sql.query(
    `delete from recipes a
     using recipes b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)
       and lower(a.equipment_model) = lower(b.equipment_model)`,
    [from, to],
  ).catch(() => undefined);
}

/**
 * Records filed under `name` in other capitals take these capitals. Do not rewrite directory_customers.name here:
 * names are unique in any capitals, so the account rows are renamed by the caller.
 */
async function setNameCase(sql: Sql, name: string): Promise<void> {
  await sql.query(`update service_jobs set customer = $1, updated_at = now() where lower(customer) = lower($1) and customer <> $1`, [name]);
  await sql.query(`update pm_jobs set customer = $1, updated_at = now() where lower(customer) = lower($1) and customer <> $1`, [name]);
  await sql.query(`update installs set customer = $1, updated_at = now() where lower(customer) = lower($1) and customer <> $1`, [name]);
  await sql.query(`update deals set customer = $1, updated_at = now() where lower(customer) = lower($1) and customer <> $1`, [name]);
  await sql.query(`update recipes set customer = $1 where lower(customer) = lower($1) and customer <> $1`, [name]).catch(() => undefined);
  await sql.query(`update network_accounts set customer = $1, updated_at = now() where lower(customer) = lower($1) and customer <> $1`, [name]).catch(() => undefined);
  await sql.query(`update customer_providers set customer = $1, updated_at = now() where lower(customer) = lower($1) and customer <> $1`, [name]).catch(() => undefined);
  await sql.query(`update assets set customer_owned = $1, updated_at = now() where lower(customer_owned) = lower($1) and customer_owned <> $1`, [name]).catch(() => undefined);
  await sql.query(`update assets set sold_to = $1, updated_at = now() where lower(sold_to) = lower($1) and sold_to <> $1`, [name]).catch(() => undefined);
  await sql.query(`update account_equipment set customer = $1, updated_at = now() where lower(customer) = lower($1) and customer <> $1`, [name]).catch(() => undefined);
  await sql.query(`update wo_history set customer = $1 where lower(customer) = lower($1) and customer <> $1`, [name]).catch(() => undefined);
}

/** Every table that stores a customer as a name string (the join key). */
export async function retargetCustomer(sql: Sql, fromRaw: string, toRaw: string): Promise<void> {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
    // Same customer, different capitalization: the records take the new capitals.
    if (from && to && from !== to) await setNameCase(sql, to);
    return;
  }

  await dropLinksAlreadyOn(sql, from, to);

  const sets: [string, string][] = [
    ["service_jobs", "customer"],
    ["pm_jobs", "customer"],
    ["installs", "customer"],
    ["deals", "customer"],
    ["recipes", "customer"],
  ];
  for (const [table, col] of sets) {
    await sql.query(
      `update ${table} set ${col} = $1${table === "recipes" ? "" : ", updated_at = now()"} where lower(${col}) = lower($2)`,
      [to, from],
    ).catch(async () => {
      await sql.query(`update ${table} set ${col} = $1 where lower(${col}) = lower($2)`, [to, from]);
    });
  }

  await sql.query(`update customer_providers set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update network_accounts set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update assets set customer_owned = $1, updated_at = now() where lower(coalesce(customer_owned,'')) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update assets set sold_to = $1, updated_at = now() where lower(coalesce(sold_to,'')) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update account_equipment set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
  // Work order history (QuickBooks) follows its account.
  await sql.query(`update wo_history set customer = $1 where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
}

type AccountRow = Record<string, unknown> & { id: number; name: string };

const BILLING = ["billing_address1", "billing_address2", "billing_city", "billing_state", "billing_zip", "billing_country"];
const PIN = ["latitude", "longitude", "geocode_match", "geocode_address", "geocoded_at"];
const filledIn = (r: AccountRow, col: string) => r[col] != null && String(r[col]).trim() !== "";

/**
 * Details a merge copies onto the kept account from the one that goes, only where the kept account has none (Grok,
 * 2026-10-27: "Fill only blank fields from the old record"). An address block or a pin goes whole, so two places are
 * never mixed. Columns are fixed here, never from input.
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

/** Calls, TLCs, PMs, installs, deals, equipment and QuickBooks work orders under a name (any capitals). */
async function recordsUnder(sql: Sql, name: string): Promise<RenameCounts> {
  const n = async (text: string) =>
    Number((await sql.query<{ n: number }>(text, [name]).catch(() => [] as { n: number }[]))[0]?.n ?? 0);
  return {
    calls: await n("select count(*)::int as n from service_jobs where lower(customer) = lower($1) and coalesce(kind, '') <> 'tlc'"),
    tlcs: await n("select count(*)::int as n from service_jobs where lower(customer) = lower($1) and kind = 'tlc'"),
    pms: await n("select count(*)::int as n from pm_jobs where lower(customer) = lower($1)"),
    installs: await n("select count(*)::int as n from installs where lower(customer) = lower($1) and archived = false"),
    deals: await n("select count(*)::int as n from deals where lower(customer) = lower($1) and archived = false"),
    equipment: await n("select count(*)::int as n from account_equipment where lower(customer) = lower($1)"),
    woHistory: await n("select count(*)::int as n from wo_history where lower(customer) = lower($1)"),
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

  // An old account off the list never wins over the live one being renamed. Two on the list: the one whose name is
  // typed is kept (Possible Duplicates: "rename the one you don't keep to the one you keep").
  const keep = !flagOn(row.archived) && flagOn(other.archived) ? "renamed" : "existing";
  const kept = keep === "renamed" ? row : other;
  const dropped = keep === "renamed" ? other : row;
  const lockedName = keep === "existing" && flagOn(other.name_locked) && !opts?.force && other.name !== next;
  const name = lockedName ? other.name : next;

  const filled: string[] = [];
  const notes: string[] = [];
  const cols: string[] = [];
  for (const f of FILLS) {
    if (f.has(kept) || !f.has(dropped)) continue;
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

  const moving = await recordsUnder(sql, dropped.name);
  const otherRecords = other === dropped ? moving : await recordsUnder(sql, other.name);
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
 * account; where both have the same link, the kept account's stays.
 */
export async function renameOrMergeCustomer(sql: Sql, id: number, nextRaw: string, opts?: { force?: boolean }): Promise<RenameResult> {
  const { row, plan, merge } = await planFor(sql, id, nextRaw, opts);
  if (plan.kind === "same") return { id: row.id, name: row.name, merged: false };
  if (plan.kind === "rename") {
    await retargetCustomer(sql, row.name, plan.name);
    await sql.query(`update directory_customers set name = $1, archived = false, updated_at = now() where id = $2`, [plan.name, id]);
    return { id, name: plan.name, merged: false };
  }

  const { kept, dropped, cols, moveReps } = merge!;
  if (kept.name.toLowerCase() !== dropped.name.toLowerCase()) await dropLinksAlreadyOn(sql, dropped.name, kept.name);
  await retargetCustomer(sql, kept.name, plan.name);
  await retargetCustomer(sql, dropped.name, plan.name);
  // Records filed under the name in other capitals ("test bakery - main") take the kept name's.
  await setNameCase(sql, plan.name);
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
 * Service and Warehouse can't. A merge is never silent: it needs `confirmMerge`, the id of the account the rename
 * window showed. Each change gets a history line on the accounts it touched.
 */
export async function renameCustomerFor(
  sql: Sql,
  userId: string,
  id: number,
  name: string,
  opts?: { confirmMerge?: number | null },
): Promise<RenameResult> {
  await requireNameReviewer(sql, userId, "Only an admin can rename or merge customers.");
  const { plan } = await planFor(sql, id, name);
  if (plan.kind === "merge" && opts?.confirmMerge !== plan.other.id) {
    throw new Error(
      `“${plan.other.name}” ${plan.other.archived ? "is an old account with that name" : "already has that name"}, so saving would merge the two. ` +
        "Reload the page and rename again to see what would move before you say yes.",
    );
  }
  const res = await renameOrMergeCustomer(sql, id, name);
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
