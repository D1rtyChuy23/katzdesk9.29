import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { serialKey } from "@/lib/ops/account-equip";
import { isWalkIn } from "@/lib/ops/customer-key";
import { eversysFamily, isEversysMachine, moduleAccount } from "@/lib/ops/eversys";
import { flagOn } from "@/lib/ops/flag";
import { notifyAdminsModuleReturn } from "@/lib/ops/notify";

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
        status: string;
        location: string | null;
        assigned_customer: string | null;
        return_pending: boolean;
      }>("select id, module_id, status, location, assigned_customer, return_pending from modules where id = $1", [data.id])
    )[0];
    if (!mod) throw new Error("Module not found");
    const current = moduleAccount({ status: mod.status, assignedCustomer: mod.assigned_customer, location: mod.location });
    if (current) throw new Error(`Module ${mod.module_id} is already on ${current}. Return it to the warehouse first.`);
    if (flagOn(mod.return_pending)) throw new Error("This module is waiting on a return approval.");
    const unit = (await unitsFor(sql, customer)).find((u) => u.id === data.unitId);
    if (!unit) throw new Error("Pick an Eversys unit on that account.");
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
      await finishReturn(sql, mod.id);
      await log(sql, who.name, mod.id, "returned", `Back at HQ from ${customer ?? "an account"}`);
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
    await finishReturn(sql, mod.id);
    await log(sql, who.name, mod.id, "returned", `Approved · back at HQ from ${mod.assigned_customer ?? mod.location ?? "an account"}`);
    return { ok: true };
  });
