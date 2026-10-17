import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { serialKey } from "@/lib/ops/account-equip";
import { isWalkIn } from "@/lib/ops/customer-key";
import { eversysFamily, isEversysMachine, moduleAccount, moduleAvailability } from "@/lib/ops/eversys";
import { flagOn } from "@/lib/ops/flag";
import { notifyAdminsModuleReturn } from "@/lib/ops/notify";
import { swapError, trail, workError, workTotals, type ModuleStop, type ModuleWork, type StopKind } from "@/lib/ops/module-history";
import { moduleAssignmentBlock, normalizeConfig } from "@/lib/ops/pm-runbook";
import { runbookForPiece } from "@/lib/ops/runbooks";

export type EversysUnit = {
  id: number;
  customer: string;
  model: string;
  serial: string | null;
  family: string | null;
  label: string;
  modules: { id: number; moduleId: string; moduleType: string | null }[];
};

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  const sql = await getSql();
  await ensureModuleSchema(sql);
  return sql;
}

/** Same columns as migrations/0035 — safe to re-run, keeps older previews working before a restart. */
export async function ensureModuleSchema(sql: Sql) {
  for (const col of [
    "assigned_customer text",
    "assigned_unit_id int",
    "assigned_unit_label text",
    "assigned_at timestamptz",
    "assigned_by text",
    "return_pending boolean not null default false",
    "return_by text",
    "return_by_name text",
    "return_at timestamptz",
  ]) {
    await sql.query(`alter table modules add column if not exists ${col}`);
  }
}

async function actorOf(sql: Sql, userId: string) {
  const row = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  return {
    admin: flagOn(row[0]?.is_admin),
    warehouse: row[0]?.desk_role === "warehouse",
    name: row[0]?.username || "Teammate",
  };
}

async function log(sql: Sql, name: string, id: number, action: string, detail: string) {
  await sql
    .query(`insert into activity (entity_type, entity_id, actor_name, action, detail) values ('module', $1, $2, $3, $4)`, [
      id,
      name,
      action,
      detail,
    ])
    .catch(() => undefined);
}

async function resolveAccount(sql: Sql, raw: string): Promise<string> {
  const name = raw.trim();
  if (!name) throw new Error("Pick an account.");
  if (isWalkIn(name)) throw new Error("Pick a real account. Walk-In is not a KatzDesk customer.");
  const rows = await sql.query<{ name: string }>(
    "select name from directory_customers where archived = false and lower(name) = lower($1) limit 1",
    [name],
  );
  if (!rows[0]) throw new Error("Pick an account already on the customer list.");
  return rows[0].name;
}

function unitLabel(model: string, serial: string | null) {
  return `${model}${serial?.trim() ? ` · SN ${serial.trim()}` : ""}`;
}

async function unitsFor(sql: Sql, customer: string): Promise<EversysUnit[]> {
  const rows = await sql.query<{ id: number; customer: string; catalog_model: string; equipment_name: string; serial: string | null }>(
    `select id, customer, catalog_model, equipment_name, serial
       from account_equipment
      where lower(customer) = lower($1)
      order by catalog_model, id`,
    [customer],
  );
  const units = rows.filter((r) => isEversysMachine(r.catalog_model) || isEversysMachine(r.equipment_name));
  if (!units.length) return [];
  const mods = await sql.query<{ id: number; module_id: string; module_type: string | null; assigned_unit_id: number }>(
    "select id, module_id, module_type, assigned_unit_id from modules where assigned_unit_id = any($1)",
    [units.map((u) => u.id)],
  );
  return units.map((u) => {
    const model = isEversysMachine(u.catalog_model) ? u.catalog_model : u.equipment_name;
    return {
      id: u.id,
      customer: u.customer,
      model,
      serial: u.serial,
      family: eversysFamily(model),
      label: unitLabel(model, u.serial),
      modules: mods
        .filter((m) => Number(m.assigned_unit_id) === u.id)
        .map((m) => ({ id: m.id, moduleId: m.module_id, moduleType: m.module_type })),
    };
  });
}

/** Eversys machines on one account (from its equipment list), with the modules already on each. */
export const listEversysUnits = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string }) => z.object({ customer: z.string() }).parse(d))
  .handler(async ({ data }): Promise<EversysUnit[]> => {
    const sql = await ready();
    if (!data.customer.trim()) return [];
    return unitsFor(sql, data.customer);
  });

/** Eversys machine models from the equipment catalog (for adding a unit to an account first). */
export const listEversysModels = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<string[]> => {
    const sql = await ready();
    const rows = await sql.query<{ name: string }>(
      "select name from directory_equipment where archived = false order by name",
    );
    return rows.map((r) => r.name).filter(isEversysMachine);
  });

const addUnitInput = z.object({
  customer: z.string().min(1),
  model: z.string().min(1),
  serial: z.string().nullable().optional(),
});

/** Put an Eversys machine on an account's equipment list so a module can attach to it. */
export const addEversysUnit = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof addUnitInput>) => addUnitInput.parse(d))
  .handler(async ({ data, context }): Promise<EversysUnit> => {
    const sql = await ready();
    const customer = await resolveAccount(sql, data.customer);
    const model = data.model.trim();
    if (!isEversysMachine(model)) throw new Error("Pick an Eversys model (Cameo, Enigma, e'4, Legacy…).");
    const serial = data.serial?.trim() || null;
    const key = serial ? serialKey(serial) : null;
    if (key) {
      const dup = await sql.query<{ customer: string }>(
        "select customer from account_equipment where serial_key = $1 limit 1",
        [key],
      );
      if (dup[0]) throw new Error(`Serial ${serial} is already on ${dup[0].customer}.`);
    }
    const inserted = await sql.query<{ id: number }>(
      `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key)
       values ($1, $2, $2, $3, $4) returning id`,
      [customer, model, serial, key],
    );
    const who = await actorOf(sql, context.userId);
    const acct = await sql.query<{ id: number }>(
      "select id from directory_customers where archived = false and lower(name) = lower($1) limit 1",
      [customer],
    );
    if (acct[0]) {
      await sql
        .query(
          `insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, 'equipment added', $3)`,
          [acct[0].id, who.name, unitLabel(model, serial)],
        )
        .catch(() => undefined);
    }
    const units = await unitsFor(sql, customer);
    const unit = units.find((u) => u.id === inserted[0]!.id);
    if (!unit) throw new Error("Could not add that unit");
    return unit;
  });

const assignInput = z.object({
  id: z.number().int().positive(),
  customer: z.string().min(1),
  unitId: z.number().int().positive(),
});

/** Attach a module to one Eversys unit on an account. It leaves HQ stock. */
export const assignModule = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof assignInput>) => assignInput.parse(d))
  .handler(async ({ data, context }): Promise<{ customer: string; unit: string }> => {
    const sql = await ready();
    const customer = await resolveAccount(sql, data.customer);
    const mod = (
      await sql.query<{
        id: number;
        module_id: string;
        module_type: string | null;
        platform: string | null;
        status: string;
        location: string | null;
        assigned_customer: string | null;
        return_pending: boolean;
      }>("select id, module_id, module_type, platform, status, location, assigned_customer, return_pending from modules where id = $1", [data.id])
    )[0];
    if (!mod) throw new Error("Module not found");
    const current = moduleAccount({ status: mod.status, assignedCustomer: mod.assigned_customer, location: mod.location });
    if (current) throw new Error(`Module ${mod.module_id} is already on ${current}. Return it to the warehouse first.`);
    if (flagOn(mod.return_pending)) throw new Error("This module is waiting on a return approval.");
    const unit = (await unitsFor(sql, customer)).find((u) => u.id === data.unitId);
    if (!unit) throw new Error("Pick an Eversys unit on that account.");
    const hit = runbookForPiece(unit.model);
    if (hit?.model) {
      const config = normalizeConfig(hit.runbook.def, { model: hit.model });
      const reason = moduleAssignmentBlock(hit.runbook.def, config, mod.module_type, mod.platform, hit.runbook.platforms);
      if (reason) throw new Error(reason);
    }
    const who = await actorOf(sql, context.userId);
    await sql.query(
      `update modules set
          assigned_customer = $2,
          assigned_unit_id = $3,
          assigned_unit_label = $4,
          assigned_at = now(),
          assigned_by = $5,
          return_pending = false,
          status = 'Installed at Account',
          location = $2,
          updated_at = now()
        where id = $1`,
      [mod.id, customer, unit.id, unit.label, who.name],
    );
    await log(sql, who.name, mod.id, "assigned", `${customer} · ${unit.label}`);
    await addStop(sql, mod.id, { kind: "assigned", customer, unitId: unit.id, unitLabel: unit.label, fromPlace: "HQ", toPlace: customer, byName: who.name });
    return { customer, unit: unit.label };
  });

async function finishReturn(sql: Sql, id: number) {
  await sql.query(
    `update modules set
        assigned_customer = null,
        assigned_unit_id = null,
        assigned_unit_label = null,
        assigned_at = null,
        assigned_by = null,
        return_pending = false,
        return_by = null,
        return_by_name = null,
        return_at = null,
        status = 'Ready',
        location = 'SHELF',
        updated_at = now()
      where id = $1`,
    [id],
  );
}

/** Bring a module back to HQ. Admin: right away. Warehouse: waits for an admin, like warehouse removes. */
export const returnModule = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ pending: boolean }> => {
    const sql = await ready();
    const who = await actorOf(sql, context.userId);
    if (!who.admin && !who.warehouse) throw new Error("Only Admin or Warehouse can return a module to the warehouse.");
    const mod = (
      await sql.query<{
        id: number;
        module_id: string;
        module_type: string | null;
        status: string;
        location: string | null;
        assigned_customer: string | null;
        return_pending: boolean;
      }>("select id, module_id, module_type, status, location, assigned_customer, return_pending from modules where id = $1", [
        data.id,
      ])
    )[0];
    if (!mod) throw new Error("Module not found");
    const customer = moduleAccount({ status: mod.status, assignedCustomer: mod.assigned_customer, location: mod.location });
    if (!customer && mod.status !== "Installed at Account") throw new Error("This module is already at HQ.");
    if (flagOn(mod.return_pending)) throw new Error("This module is already waiting on approval.");
    if (who.admin) {
      const unit = await unitOf(sql, mod.id);
      await finishReturn(sql, mod.id);
      await log(sql, who.name, mod.id, "returned", `Back at HQ from ${customer ?? "an account"}`);
      await addStop(sql, mod.id, { kind: "returned", customer, unitId: unit.id, unitLabel: unit.label, fromPlace: customer, toPlace: "HQ", byName: who.name });
      return { pending: false };
    }
    await sql.query(
      `update modules set return_pending = true, return_by = $2, return_by_name = $3, return_at = now(), updated_at = now()
        where id = $1`,
      [mod.id, context.userId, who.name],
    );
    await log(sql, who.name, mod.id, "return requested", `From ${customer ?? "an account"}`);
    await notifyAdminsModuleReturn(sql, context.userId, {
      id: mod.id,
      moduleId: mod.module_id,
      moduleType: mod.module_type,
      customer,
    });
    return { pending: true };
  });

/** Admin approves or rejects a Warehouse return. */
export const decideModuleReturn = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; decision: "approve" | "reject" }) =>
    z.object({ id: z.number().int().positive(), decision: z.enum(["approve", "reject"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    const who = await actorOf(sql, context.userId);
    if (!who.admin) throw new Error("Only an admin can approve this.");
    const mod = (
      await sql.query<{ id: number; return_pending: boolean; return_by: string | null; assigned_customer: string | null; location: string | null }>(
        "select id, return_pending, return_by, assigned_customer, location from modules where id = $1",
        [data.id],
      )
    )[0];
    if (!mod || !flagOn(mod.return_pending)) throw new Error("This module is not waiting on approval.");
    if (mod.return_by === context.userId) throw new Error("You can’t approve your own request.");
    if (data.decision === "reject") {
      await sql.query(
        "update modules set return_pending = false, return_by = null, return_by_name = null, return_at = null, updated_at = now() where id = $1",
        [mod.id],
      );
      await log(sql, who.name, mod.id, "return rejected", "Stays on the account");
      return { ok: true };
    }
    const unit = await unitOf(sql, mod.id);
    await finishReturn(sql, mod.id);
    await log(sql, who.name, mod.id, "returned", `Approved · back at HQ from ${mod.assigned_customer ?? mod.location ?? "an account"}`);
    const from = mod.assigned_customer ?? mod.location ?? null;
    await addStop(sql, mod.id, { kind: "returned", customer: from, unitId: unit.id, unitLabel: unit.label, fromPlace: from, toPlace: "HQ", byName: who.name, note: "Return approved" });
    return { ok: true };
  });

/** The unit a module sits on right now, read before it is cleared. */
async function unitOf(sql: Sql, id: number): Promise<{ id: number | null; label: string | null }> {
  const r = (await sql.query<{ assigned_unit_id: number | null; assigned_unit_label: string | null }>("select assigned_unit_id, assigned_unit_label from modules where id = $1", [id]))[0];
  return { id: r?.assigned_unit_id == null ? null : Number(r.assigned_unit_id), label: r?.assigned_unit_label ?? null };
}

type StopInput = {
  kind: StopKind;
  customer?: string | null;
  unitId?: number | null;
  unitLabel?: string | null;
  otherModule?: string | null;
  fromPlace?: string | null;
  toPlace?: string | null;
  byName?: string | null;
  note?: string | null;
};

/** Add one stop to a module's trail. Stops are only ever added, so the last account is never overwritten. */
export async function addStop(sql: Sql, moduleId: number, s: StopInput) {
  await sql.query(
    `insert into module_stops (module_id, kind, customer, unit_id, unit_label, other_module, from_place, to_place, by_name, note)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [moduleId, s.kind, s.customer ?? null, s.unitId ?? null, s.unitLabel ?? null, s.otherModule ?? null, s.fromPlace ?? null, s.toPlace ?? null, s.byName ?? null, s.note ?? null],
  );
}

export type ModuleRecord = {
  current: ModuleStop | null;
  past: ModuleStop[];
  work: ModuleWork[];
  totals: { parts: number; laborHours: number };
};

async function readRecord(sql: Sql, id: number): Promise<ModuleRecord> {
  const stops = (
    await sql.query<{
      id: number;
      kind: StopKind;
      customer: string | null;
      unit_label: string | null;
      other_module: string | null;
      from_place: string | null;
      to_place: string | null;
      happened_at: string | Date;
      by_name: string | null;
      note: string | null;
    }>("select id, kind, customer, unit_label, other_module, from_place, to_place, happened_at, by_name, note from module_stops where module_id = $1 order by happened_at, id", [id])
  ).map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    customer: r.customer,
    unitLabel: r.unit_label,
    otherModule: r.other_module,
    fromPlace: r.from_place,
    toPlace: r.to_place,
    happenedAt: new Date(r.happened_at).toISOString(),
    byName: r.by_name,
    note: r.note,
  }));
  const work = (
    await sql.query<{
      id: number;
      worked_on: string | Date;
      kind: "part" | "labor";
      item: string;
      description: string | null;
      qty: string;
      wo: string | null;
      technician: string | null;
      note: string | null;
      by_name: string | null;
    }>("select id, worked_on, kind, item, description, qty, wo, technician, note, by_name from module_work where module_id = $1 order by worked_on desc, id desc", [id])
  ).map((r) => ({
    id: Number(r.id),
    workedOn: r.worked_on instanceof Date ? r.worked_on.toISOString().slice(0, 10) : String(r.worked_on).slice(0, 10),
    kind: r.kind,
    item: r.item,
    description: r.description,
    qty: Number(r.qty),
    wo: r.wo,
    technician: r.technician,
    note: r.note,
    byName: r.by_name,
  }));
  return { ...trail(stops), work, totals: workTotals(work) };
}

/** A module's own record: where it is now, every past stop, and the parts and labor logged on it. */
export const getModuleRecord = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<ModuleRecord> => readRecord(await ready(), data.id));

const workInput = z.object({
  id: z.number().int().positive(),
  kind: z.enum(["part", "labor"]),
  item: z.string().max(200),
  description: z.string().max(500).nullable().optional(),
  qty: z.union([z.number(), z.string().max(20)]),
  workedOn: z.string().max(10).nullable().optional(),
  wo: z.string().max(60).nullable().optional(),
  technician: z.string().max(120).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

/** Log a part used or labor done on this module. Lines are added, never rewritten. */
export const addModuleWork = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof workInput>) => workInput.parse(d))
  .handler(async ({ data, context }): Promise<ModuleRecord> => {
    const sql = await ready();
    const problem = workError(data);
    if (problem) throw new Error(problem);
    const mod = (await sql.query<{ id: number; module_id: string }>("select id, module_id from modules where id = $1", [data.id]))[0];
    if (!mod) throw new Error("Module not found");
    const who = await actorOf(sql, context.userId);
    const qty = Math.round(Number(String(data.qty).trim()) * 100) / 100;
    await sql.query(
      `insert into module_work (module_id, worked_on, kind, item, description, qty, wo, technician, note, by_name)
       values ($1, coalesce($2::date, current_date), $3, $4, $5, $6, $7, $8, $9, $10)`,
      [mod.id, data.workedOn || null, data.kind, data.item.trim(), data.description?.trim() || null, qty, data.wo?.trim() || null, data.technician?.trim() || null, data.note?.trim() || null, who.name],
    );
    await log(sql, who.name, mod.id, "work logged", `${data.kind === "labor" ? `${qty} h labor` : `${qty} × part`}: ${data.item.trim()}`);
    return readRecord(sql, mod.id);
  });

type ModRow = {
  id: number;
  module_id: string;
  module_type: string | null;
  platform: string | null;
  status: string;
  location: string | null;
  assigned_customer: string | null;
  assigned_unit_id: number | null;
  assigned_unit_label: string | null;
  return_pending: boolean;
};

const swapSide = (m: ModRow) => ({
  id: Number(m.id),
  moduleId: m.module_id,
  moduleType: m.module_type,
  platform: m.platform,
  status: m.status,
  assignedCustomer: m.assigned_customer,
  assignedUnitId: m.assigned_unit_id == null ? null : Number(m.assigned_unit_id),
  returnPending: flagOn(m.return_pending),
});

/**
 * Swap the module on an account's unit for one of the same type from HQ. The incoming module goes on the same unit,
 * the outgoing one comes back to HQ (to be rebuilt), and both records get the stop: account, date, which unit it
 * left and which unit it went to, and the other module's serial.
 */
export const swapModule = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { outId: number; inId: number }) => z.object({ outId: z.number().int().positive(), inId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ customer: string; unit: string; out: string; in: string }> => {
    const sql = await ready();
    const who = await actorOf(sql, context.userId);
    const pick = async (id: number) =>
      (
        await sql.query<ModRow>(
          "select id, module_id, module_type, platform, status, location, assigned_customer, assigned_unit_id, assigned_unit_label, return_pending from modules where id = $1",
          [id],
        )
      )[0];
    const out = await pick(data.outId);
    const incoming = await pick(data.inId);
    if (!out || !incoming) throw new Error("Module not found");
    const problem = swapError(swapSide(out), swapSide(incoming), moduleAvailability({ status: incoming.status, assignedCustomer: incoming.assigned_customer }) === "hq");
    if (problem) throw new Error(problem);
    const customer = out.assigned_customer!;
    const unitId = Number(out.assigned_unit_id);
    const unitLabel = out.assigned_unit_label ?? "Eversys unit";
    // The incoming module takes the outgoing one's place on the unit.
    await sql.query(
      `update modules set
          assigned_customer = $2, assigned_unit_id = $3, assigned_unit_label = $4, assigned_at = now(), assigned_by = $5,
          return_pending = false, status = 'Installed at Account', location = $2, updated_at = now()
        where id = $1`,
      [incoming.id, customer, unitId, unitLabel, who.name],
    );
    // The outgoing module comes back to HQ for a rebuild.
    await sql.query(
      `update modules set
          assigned_customer = null, assigned_unit_id = null, assigned_unit_label = null, assigned_at = null, assigned_by = null,
          return_pending = false, return_by = null, return_by_name = null, return_at = null,
          status = 'Not Started', location = 'SHELF', updated_at = now()
        where id = $1`,
      [out.id],
    );
    await addStop(sql, out.id, { kind: "swap_out", customer, unitId, unitLabel, otherModule: incoming.module_id, fromPlace: customer, toPlace: "HQ", byName: who.name });
    await addStop(sql, incoming.id, { kind: "swap_in", customer, unitId, unitLabel, otherModule: out.module_id, fromPlace: "HQ", toPlace: customer, byName: who.name });
    await log(sql, who.name, out.id, "swapped out", `${customer} · ${unitLabel} · replaced by ${incoming.module_id}`);
    await log(sql, who.name, incoming.id, "swapped in", `${customer} · ${unitLabel} · replacing ${out.module_id}`);
    return { customer, unit: unitLabel, out: out.module_id, in: incoming.module_id };
  });
