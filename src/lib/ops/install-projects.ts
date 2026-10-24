/**
 * Install projects across work orders: merging two installs of one account, and the install's customer — changing it
 * (its own account units follow) and the owner's lock on it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { sameCatalogModel, serialKey } from "@/lib/ops/account-equip";
import { customersStrictlyMatch } from "@/lib/ops/clean-names";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { assertUnlocked, canLockEquipment, lockOwnerName } from "@/lib/ops/equipment-lock";
import { lockedMessage } from "@/lib/ops/equipment-lock-rules";
import { catalogNames, syncInstallUnits } from "@/lib/ops/inspection-api";
import { loadInstallWos } from "@/lib/ops/install-work-orders";
import { installMachines, serializeMachines, type MachineSpec } from "@/lib/ops/machines";

async function actorName(sql: Sql, userId: string): Promise<string> {
  return (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

async function log(sql: Sql, installId: number, actor: string, action: string, detail: string): Promise<void> {
  await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, $3, $4)", [
    installId,
    actor,
    action,
    detail,
  ]);
}

const unitLabel = (u: { equipment_name: string | null; catalog_model: string | null; serial: string | null }) =>
  `${(u.equipment_name || u.catalog_model || "Unit").trim()}${u.serial?.trim() ? ` SN ${u.serial.trim()}` : ""}`;

// ——— The install's customer ———

type CustomerRow = { customer: string; customer_locked_at: unknown; customer_locked_by: string | null };

/** Refuse a customer change while the owner has the install's customer locked. */
export async function assertCustomerChangeAllowed(sql: Sql, install: CustomerRow, next: string | null | undefined): Promise<void> {
  const to = (next ?? "").trim();
  if (!to || to === install.customer.trim()) return;
  if (install.customer_locked_at) throw new Error(lockedMessage(install.customer_locked_by, await lockOwnerName(sql)));
}

export type UnitsMoved = { moved: string[]; stayed: string[] };

/**
 * The install's customer changed: the account units this install's load made (created_by_install) go with it, unless
 * one is locked or on another install's visit — those stay on the old account. Nothing is deleted.
 */
export async function moveInstallUnits(sql: Sql, installId: number, from: string, to: string): Promise<UnitsMoved> {
  if (!to.trim() || from.trim().toLowerCase() === to.trim().toLowerCase()) return { moved: [], stayed: [] };
  const moved = await sql.query<{ equipment_name: string | null; catalog_model: string | null; serial: string | null }>(
    `update account_equipment a set customer = $3, updated_at = now()
      where a.created_by_install = $1 and lower(a.customer) = lower($2) and a.locked_at is null
        and not exists (select 1 from install_inspection_units u where u.equipment_id = a.id and u.install_id <> $1)
      returning a.equipment_name, a.catalog_model, a.serial`,
    [installId, from, to.trim()],
  );
  const stayed = await sql.query<{ equipment_name: string | null; catalog_model: string | null; serial: string | null }>(
    "select equipment_name, catalog_model, serial from account_equipment where created_by_install = $1 and lower(customer) = lower($2) order by id",
    [installId, from],
  );
  return { moved: moved.map(unitLabel), stayed: stayed.map(unitLabel) };
}

const lockInput = z.object({ id: z.number().int().positive(), locked: z.boolean() });

/** Lock or unlock an install's customer. The owner only (canLockEquipment); logged on the install. */
export async function setInstallCustomerLockFor(
  sql: Sql,
  userId: string,
  data: z.infer<typeof lockInput>,
): Promise<{ customerLockedAt: string | null; customerLockedBy: string | null }> {
  if (!(await canLockEquipment(sql, userId))) throw new Error("Only the owner can lock or unlock an install's customer.");
  const who = await actorName(sql, userId);
  const rows = await sql.query<{ customer: string; customer_locked_at: unknown; customer_locked_by: string | null }>(
    `update installs set customer_locked_at = case when $2 then now() else null end,
            customer_locked_by = case when $2 then $3 else null end, updated_at = now()
      where id = $1 returning customer, customer_locked_at, customer_locked_by`,
    [data.id, data.locked, who],
  );
  const row = rows[0];
  if (!row) throw new Error("Install not found");
  await log(sql, data.id, who, data.locked ? "locked" : "unlocked", `${data.locked ? "locked" : "unlocked"} the customer (${row.customer})`);
  const at = row.customer_locked_at instanceof Date ? row.customer_locked_at.toISOString() : row.customer_locked_at ? String(row.customer_locked_at) : null;
  return { customerLockedAt: at, customerLockedBy: row.customer_locked_by };
}

// ——— Merge ———

type InstallRow = {
  id: number;
  customer: string;
  archived: boolean;
  equipment: string | null;
  serial: string | null;
  power_voltage: string | null;
  machines: string | null;
  notes: string | null;
  wo: string | null;
  deal_id: number | null;
  received: string | null;
  customer_locked_at: unknown;
  customer_locked_by: string | null;
  updated: string;
};

type AccountUnit = {
  id: number;
  customer: string;
  catalog_model: string;
  equipment_name: string;
  serial: string | null;
  serial_key: string | null;
  locked_at: unknown;
  locked_by: string | null;
  created_by_install: number | null;
};

const sameModel = (a: { catalog_model: string; equipment_name: string }, b: { catalog_model: string; equipment_name: string }) =>
  sameCatalogModel(a.catalog_model, b.catalog_model) || sameCatalogModel(a.equipment_name, b.equipment_name);

/**
 * The keeper's machine list with the drop's rows it doesn't have added, each with all it carries. A drop row is the
 * keeper's when it is the same model and the same serial, or one of the two has none (that keeper row takes the
 * drop row's serial and voltage when it has none).
 */
export function mergedMachineList(keeper: MachineSpec[], drop: MachineSpec[]): { list: MachineSpec[]; added: MachineSpec[] } {
  const list = keeper.map((m) => ({ ...m }));
  const used = new Set<number>();
  const added: MachineSpec[] = [];
  for (const row of drop) {
    const key = serialKey(row.serial);
    const fits = (m: MachineSpec, i: number) => !used.has(i) && sameCatalogModel(m.equipment, row.equipment);
    let at = list.findIndex((m, i) => fits(m, i) && !!key && serialKey(m.serial) === key);
    if (at < 0) at = list.findIndex((m, i) => fits(m, i) && (!key || !serialKey(m.serial)));
    if (at < 0) {
      list.push({ ...row });
      used.add(list.length - 1);
      added.push(row);
      continue;
    }
    used.add(at);
    const m = list[at]!;
    if (!m.serial.trim() && row.serial.trim()) m.serial = row.serial;
    if (!m.powerVoltage.trim() && row.powerVoltage.trim()) m.powerVoltage = row.powerVoltage;
  }
  return { list, added };
}

const mergeInput = z.object({ keepId: z.number().int().positive(), dropId: z.number().int().positive() });

export type MergeInstallsResult = {
  keepId: number;
  dropId: number;
  workOrders: number;
  machines: number;
  units: number;
  unitsStayed: number;
  notes: boolean;
};

/**
 * Merge one install of an account into another (the same account: a strict name match): the drop's work orders (a
 * number the keeper has is skipped), the machine rows the keeper's list doesn't have, its notes, its deal, install date,
 * tech, install type, site contact and contact phone when the keeper has none, its recipes, warehouse units and rebuilds,
 * what a tech filled in on its Equipment Request Form (when the keeper's has nothing), its visit header (notes added), its
 * activity and Ping thread, and its visit units the keeper has no unit of the same model and serial for (with their
 * checks and photos). A drop unit whose twin is on the keeper gives the twin the checks and photos it has none of.
 * The rest stays on the drop, which is archived as a duplicate of the keeper. Nothing is deleted. Admins only.
 */
export async function mergeInstallsFor(sql: Sql, userId: string, data: z.infer<typeof mergeInput>): Promise<MergeInstallsResult> {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can merge installs.");
  const { keepId, dropId } = data;
  if (keepId === dropId) throw new Error("Pick another install to merge into.");
  const rows = await sql.query<InstallRow>(
    `select id, customer, archived, equipment, serial, power_voltage, machines, notes, wo, deal_id, customer_locked_at, customer_locked_by,
            to_char(received, 'YYYY-MM-DD') as received,
            updated_at::text as updated
       from installs where id = any($1::int[])`,
    [[keepId, dropId]],
  );
  const keep = rows.find((r) => r.id === keepId);
  const drop = rows.find((r) => r.id === dropId);
  if (!keep || !drop) throw new Error("Install not found");
  if (keep.archived || drop.archived) throw new Error("An archived install can't be merged.");
  if (!customersStrictlyMatch(keep.customer, drop.customer)) {
    throw new Error(`Install #${drop.id} (${drop.customer}) is on another account than #${keep.id} (${keep.customer}).`);
  }
  if (keep.deal_id && drop.deal_id && keep.deal_id !== drop.deal_id) {
    throw new Error(`Install #${keep.id} is from deal #${keep.deal_id} and #${drop.id} from deal #${drop.deal_id}: two projects, not one. They can't be merged.`);
  }
  // The drop's locked customer: its units would take the keeper's spelling, so only the same name merges.
  if (drop.customer_locked_at && keep.customer.trim().toLowerCase() !== drop.customer.trim().toLowerCase()) {
    throw new Error(lockedMessage(drop.customer_locked_by, await lockOwnerName(sql)));
  }
  // Warehouse units reserved, assigned or sold to the drop go to the keeper (same account; only the install changes).
  // The lock an assignment or a sale puts on by itself moves with them; a lock a person put on waits for the owner.
  const assets = await sql.query<{ id: number; status: string | null; locked_at: unknown; locked_by: string | null }>(
    "select id, status, locked_at, locked_by from assets where install_id = $1",
    [dropId],
  );
  for (const a of assets) if (!/^System \(/.test(a.locked_by ?? "")) await assertUnlocked(sql, a);
  const actor = await actorName(sql, userId);
  const catalog = await catalogNames(sql);

  // Visit units: the drop's go to the keeper unless the keeper has a unit of the same model and serial.
  const linked = await sql.query<AccountUnit & { install_id: number }>(
    `select u.install_id, a.id, a.customer, a.catalog_model, a.equipment_name, a.serial, a.serial_key, a.locked_at, a.locked_by, a.created_by_install
       from install_inspection_units u join account_equipment a on a.id = u.equipment_id
      where u.install_id = any($1::int[]) order by a.id`,
    [[keepId, dropId]],
  );
  const keeperUnits = linked.filter((u) => u.install_id === keepId);
  const dropUnits = linked.filter((u) => u.install_id === dropId);
  // Each drop unit's twin on the keeper, one to one in id order: a unit both visits share is its own twin, then the
  // same model and serial. A drop unit with no twin moves to the keeper.
  const taken = new Set<number>();
  const twinOf = new Map<number, number>();
  for (const u of dropUnits) {
    if (keeperUnits.some((k) => k.id === u.id)) {
      twinOf.set(u.id, u.id);
      taken.add(u.id);
    }
  }
  for (const u of dropUnits) {
    if (twinOf.has(u.id)) continue;
    const k = keeperUnits.find((k) => !taken.has(k.id) && sameModel(k, u) && (serialKey(k.serial) || "") === (serialKey(u.serial) || ""));
    if (!k) continue;
    twinOf.set(u.id, k.id);
    taken.add(k.id);
  }
  const moving = dropUnits.filter((u) => !twinOf.has(u.id));
  // A unit on the drop's spelling of the account moves to the keeper's: a locked one would have to change, so refuse.
  const recustomer = moving.filter((u) => normalizeCustomerKey(u.customer) !== normalizeCustomerKey(keep.customer));
  for (const u of recustomer) await assertUnlocked(sql, u);
  const stayed = twinOf.size;
  // Each staying drop unit and its twin: the twin gets the checks and photos it has none of.
  const twins = [...twinOf].map(([dropUnit, keepUnit]) => ({ drop: dropUnit, keep: keepUnit }));

  const { list, added } = mergedMachineList(installMachines(keep, catalog).machines, installMachines(drop, catalog).machines);
  const packed = serializeMachines(list);
  const dropWos = (await loadInstallWos(sql, [dropId])).get(dropId) ?? [];
  const keepWos = (await loadInstallWos(sql, [keepId])).get(keepId) ?? [];
  const newWos = dropWos.filter((w) => !keepWos.some((k) => k.matchKey === w.matchKey));
  const notes = [keep.notes?.trim(), drop.notes?.trim() ? `From install #${drop.id}: ${drop.notes.trim()}` : ""].filter(Boolean).join("\n\n") || null;
  const unitIds = moving.map((u) => u.id);
  const recustomerIds = recustomer.map((u) => u.id);
  const keepPrimary = keep.wo?.trim() || newWos[0]?.wo || null;
  const detail =
    `merged install #${drop.id}` +
    (newWos.length ? ` · ${newWos.map((w) => w.wo).join(", ")}` : "") +
    ` · ${added.length} machine row${added.length === 1 ? "" : "s"}, ${unitIds.length} visit unit${unitIds.length === 1 ? "" : "s"} moved` +
    (stayed ? ` · ${stayed} stayed on #${drop.id}` : "");

  // One guarded statement: nothing is written when either install changed or was archived since the reads above.
  const out = await sql.query<{ ok: number }>(
    `with lk as (
       -- Both installs locked, in id order, then checked as they are now.
       select id, archived, updated_at::text as updated
         from installs where id = any(array[$1::int, $2::int]) order by id for update
     ), g as (
       select k.id as keep_id, d.id as drop_id
         from lk k join lk d on d.id = $2::int
        where k.id = $1::int and k.archived = false and d.archived = false
          and k.updated = $3 and d.updated = $4
     ), keeper_keys as (
       select w.match_key from install_work_orders w join g on w.install_id = g.keep_id
     ), wo_move as (
       update install_work_orders w set install_id = g.keep_id, source = coalesce(w.source, 'merge')
         from g
        where w.install_id = g.drop_id and w.match_key not in (select match_key from keeper_keys)
       returning w.id
     ), wo_add as (
       -- The drop's primary had no row of its own (saved before the table): the keeper gets one.
       insert into install_work_orders (install_id, wo, match_key, status, completed_at, received, source, added_by)
       select g.keep_id, x.wo, x.match_key, x.status, x.completed_at::date, x.received::date, 'merge', $5
         from g, jsonb_to_recordset($6::jsonb) as x(wo text, match_key text, status text, completed_at text, received text)
        where not exists (select 1 from install_work_orders w where w.install_id = g.drop_id and w.match_key = x.match_key)
       on conflict (install_id, match_key) do nothing
       returning id
     ), keeper as (
       update installs k
          set equipment = $7, machines = $8, serial = $9, power_voltage = $10, notes = $11,
              wo = coalesce(nullif(btrim(k.wo), ''), $12),
              deal_id = coalesce(k.deal_id, d.deal_id),
              install_date = coalesce(k.install_date, d.install_date),
              technician = coalesce(nullif(btrim(k.technician), ''), d.technician),
              install_type = coalesce(k.install_type, d.install_type),
              site_contact = coalesce(nullif(btrim(k.site_contact), ''), d.site_contact),
              contact_phone = coalesce(nullif(btrim(k.contact_phone), ''), d.contact_phone),
              updated_at = now()
         from g join installs d on d.id = g.drop_id where k.id = g.keep_id
       returning k.id
     ), recipes_moved as (
       update recipes r set install_id = g.keep_id from g where r.install_id = g.drop_id returning r.id
     ), assets_moved as (
       update assets a set install_id = g.keep_id, updated_at = now() from g where a.install_id = g.drop_id returning a.id
     ), rebuilds_moved as (
       update rebuilds r set install_id = g.keep_id from g where r.install_id = g.drop_id returning r.id
     ), form_move as (
       -- What a tech filled in on the drop's Equipment Request Form goes with it when the keeper's form has nothing.
       update install_form_entries f set install_id = g.keep_id, updated_at = now()
         from g where f.install_id = g.drop_id and not exists (select 1 from install_form_entries k where k.install_id = g.keep_id)
       returning f.install_id
     ), head_move as (
       update install_inspections h set install_id = g.keep_id, updated_at = now()
         from g where h.install_id = g.drop_id and not exists (select 1 from install_inspections k where k.install_id = g.keep_id)
       returning h.install_id
     ), head_merge as (
       -- The keeper's header keeps what it has; the drop's fills the blanks and its notes are added.
       update install_inspections k
          set inspector = coalesce(nullif(btrim(k.inspector), ''), d.inspector),
              inspected_on = coalesce(k.inspected_on, d.inspected_on),
              site_contact = coalesce(nullif(btrim(k.site_contact), ''), d.site_contact),
              override_reason = coalesce(nullif(btrim(k.override_reason), ''), d.override_reason),
              override_by = case when nullif(btrim(k.override_reason), '') is null then d.override_by else k.override_by end,
              notes = case
                        when nullif(btrim(d.notes), '') is null then k.notes
                        when nullif(btrim(k.notes), '') is null then 'From install #' || g.drop_id::text || ': ' || btrim(d.notes)
                        else btrim(k.notes) || E'\n\nFrom install #' || g.drop_id::text || ': ' || btrim(d.notes)
                      end,
              updated_at = now()
         from g join install_inspections d on d.install_id = g.drop_id
        where k.install_id = g.keep_id
       returning k.install_id
     ), loose_photos as (
       update install_inspection_photos p set install_id = g.keep_id from g where p.install_id = g.drop_id and p.equipment_id is null returning p.id
     ), loose_items as (
       update install_inspection_items i set install_id = g.keep_id
         from g
        where i.install_id = g.drop_id and i.equipment_id is null
          and not exists (select 1 from install_inspection_items k where k.install_id = g.keep_id and k.equipment_id is null and k.category = i.category)
       returning i.id
     ), twin_items as (
       -- One drop check per keeper unit and category (the pairs are one to one; distinct on keeps it so).
       update install_inspection_items i set install_id = g.keep_id, equipment_id = x.k_eq
         from g, (
           select distinct on (t.k_eq, s.category) s.id, t.k_eq
             from install_inspection_items s join unnest($17::int[], $18::int[]) as t(d_eq, k_eq) on s.equipment_id = t.d_eq
            where s.install_id = $2::int
            order by t.k_eq, s.category, s.id
         ) x
        where i.id = x.id and i.install_id = g.drop_id
          and not exists (select 1 from install_inspection_items k where k.install_id = g.keep_id and k.equipment_id = x.k_eq and k.category = i.category)
       returning i.id
     ), twin_photos as (
       update install_inspection_photos p set install_id = g.keep_id, equipment_id = t.k_eq
         from g, unnest($17::int[], $18::int[]) as t(d_eq, k_eq)
        where p.install_id = g.drop_id and p.equipment_id = t.d_eq
          and not exists (select 1 from install_inspection_photos k where k.install_id = g.keep_id and k.equipment_id = t.k_eq and k.category = p.category)
       returning p.id
     ), units as (
       update install_inspection_units u set install_id = g.keep_id
         from g
        where u.install_id = g.drop_id and u.equipment_id = any($13::int[])
          and not exists (select 1 from install_inspection_units k where k.install_id = g.keep_id and k.equipment_id = u.equipment_id)
       returning u.equipment_id
     ), items as (
       update install_inspection_items i set install_id = g.keep_id
         from g
        where i.install_id = g.drop_id and i.equipment_id = any($13::int[])
          and not exists (select 1 from install_inspection_items k where k.install_id = g.keep_id and k.equipment_id = i.equipment_id and k.category = i.category)
       returning i.id
     ), photos as (
       update install_inspection_photos p set install_id = g.keep_id
         from g where p.install_id = g.drop_id and p.equipment_id = any($13::int[])
       returning p.id
     ), acct as (
       update account_equipment a
          set customer = case when a.id = any($14::int[]) then $15 else a.customer end,
              created_by_install = case when a.created_by_install = g.drop_id and a.locked_at is null then g.keep_id else a.created_by_install end,
              updated_at = now()
         from g where a.id = any($13::int[])
       returning a.id
     ), com as (
       update comments c set entity_id = g.keep_id from g where c.entity_type = 'install' and c.entity_id = g.drop_id returning c.id
     ), act as (
       update activity a set entity_id = g.keep_id from g where a.entity_type = 'install' and a.entity_id = g.drop_id returning a.id
     ), pings as (
       update desk_notifications n set entity_id = g.keep_id from g where n.entity_type = 'install' and n.entity_id = g.drop_id returning n.id
     ), dropped as (
       update installs d set archived = true, duplicate_of = g.keep_id, updated_at = now() from g where d.id = g.drop_id returning d.id
     ), logged as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'install', g.keep_id, $5, 'merged', $16 from g
       union all
       select 'install', g.drop_id, $5, 'merged', 'merged into install #' || g.keep_id::text from g
       returning id
     )
     select (select count(*)::int from g) as ok,
            (select count(*)::int from wo_move) + (select count(*)::int from wo_add) as wos,
            (select count(*)::int from keeper) + (select count(*)::int from recipes_moved) + (select count(*)::int from assets_moved)
              + (select count(*)::int from rebuilds_moved) + (select count(*)::int from form_move) + (select count(*)::int from head_move) + (select count(*)::int from head_merge)
              + (select count(*)::int from loose_photos) + (select count(*)::int from loose_items) + (select count(*)::int from twin_items)
              + (select count(*)::int from twin_photos) + (select count(*)::int from units) + (select count(*)::int from items)
              + (select count(*)::int from photos) + (select count(*)::int from acct) + (select count(*)::int from com)
              + (select count(*)::int from act) + (select count(*)::int from pings) + (select count(*)::int from dropped)
              + (select count(*)::int from logged) as touched`,
    [
      keepId,
      dropId,
      keep.updated,
      drop.updated,
      actor,
      // A primary with no row of its own is dated by the drop install.
      JSON.stringify(newWos.map((w) => ({ wo: w.wo, match_key: w.matchKey, status: w.status, completed_at: w.completedAt, received: w.received ?? drop.received }))),
      packed.equipment,
      packed.machines,
      packed.serial,
      packed.powerVoltage,
      notes,
      keepPrimary,
      unitIds,
      recustomerIds,
      keep.customer,
      detail,
      twins.map((t) => t.drop),
      twins.map((t) => t.keep),
    ],
  );
  if (!out[0]?.ok) throw new Error("One of the installs changed since this window opened. Open it again and retry.");
  // The keeper's visit reads its list again (the same load the window runs), without taking anything off.
  await syncInstallUnits(sql, keepId);
  return {
    keepId,
    dropId,
    workOrders: newWos.length,
    machines: added.length,
    units: unitIds.length,
    unitsStayed: stayed,
    notes: !!drop.notes?.trim(),
  };
}

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

export const mergeInstalls = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof mergeInput>) => mergeInput.parse(d))
  .handler(async ({ data, context }) => mergeInstallsFor(await ready(), context.userId, data));

export const setInstallCustomerLock = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof lockInput>) => lockInput.parse(d))
  .handler(async ({ data, context }) => setInstallCustomerLockFor(await ready(), context.userId, data));
