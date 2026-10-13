import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { o as deskMiddleware } from "./access-CeCitFku.mjs";
import { t as isWalkIn } from "./customer-key-BKZJDViL.mjs";
import { u as serialKey } from "./account-equip-pqzlCVTH.mjs";
import { hn as object, mn as number, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { a as notifyAdminsModuleReturn } from "./notify-CxtUIjWw.mjs";
import { n as isEversysMachine, r as moduleAccount, t as eversysFamily } from "./eversys-Bk1Dg0we.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/module-assign-CHWQkLOq.js
async function ready() {
	const { ensureSeeded } = await import("./seed.server-2-fPCFoA.mjs");
	await ensureSeeded();
	const sql = await getSql();
	await ensureModuleSchema(sql);
	return sql;
}
/** Same columns as migrations/0035 — safe to re-run, keeps older previews working before a restart. */
async function ensureModuleSchema(sql) {
	for (const col of [
		"assigned_customer text",
		"assigned_unit_id int",
		"assigned_unit_label text",
		"assigned_at timestamptz",
		"assigned_by text",
		"return_pending boolean not null default false",
		"return_by text",
		"return_by_name text",
		"return_at timestamptz"
	]) await sql.query(`alter table modules add column if not exists ${col}`);
}
async function actorOf(sql, userId) {
	const row = await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [userId]);
	return {
		admin: flagOn(row[0]?.is_admin),
		warehouse: row[0]?.desk_role === "warehouse",
		name: row[0]?.username || "Teammate"
	};
}
async function log(sql, name, id, action, detail) {
	await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail) values ('module', $1, $2, $3, $4)`, [
		id,
		name,
		action,
		detail
	]).catch(() => void 0);
}
async function resolveAccount(sql, raw) {
	const name = raw.trim();
	if (!name) throw new Error("Pick an account.");
	if (isWalkIn(name)) throw new Error("Pick a real account. Walk-In is not a KatzDesk customer.");
	const rows = await sql.query("select name from directory_customers where archived = false and lower(name) = lower($1) limit 1", [name]);
	if (!rows[0]) throw new Error("Pick an account already on the customer list.");
	return rows[0].name;
}
function unitLabel(model, serial) {
	return `${model}${serial?.trim() ? ` · SN ${serial.trim()}` : ""}`;
}
async function unitsFor(sql, customer) {
	const units = (await sql.query(`select id, customer, catalog_model, equipment_name, serial
       from account_equipment
      where lower(customer) = lower($1)
      order by catalog_model, id`, [customer])).filter((r) => isEversysMachine(r.catalog_model) || isEversysMachine(r.equipment_name));
	if (!units.length) return [];
	const mods = await sql.query("select id, module_id, module_type, assigned_unit_id from modules where assigned_unit_id = any($1)", [units.map((u) => u.id)]);
	return units.map((u) => {
		const model = isEversysMachine(u.catalog_model) ? u.catalog_model : u.equipment_name;
		return {
			id: u.id,
			customer: u.customer,
			model,
			serial: u.serial,
			family: eversysFamily(model),
			label: unitLabel(model, u.serial),
			modules: mods.filter((m) => Number(m.assigned_unit_id) === u.id).map((m) => ({
				id: m.id,
				moduleId: m.module_id,
				moduleType: m.module_type
			}))
		};
	});
}
/** Eversys machines on one account (from its equipment list), with the modules already on each. */
var listEversysUnits_createServerFn_handler = createServerRpc({
	id: "8440ebf91ba289568bca2d70bf896fe3d6ac37d423010b493bd201cb52fc8bfd",
	name: "listEversysUnits",
	filename: "src/lib/ops/module-assign.ts"
}, (opts) => listEversysUnits.__executeServer(opts));
var listEversysUnits = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ customer: string() }).parse(d)).handler(listEversysUnits_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	if (!data.customer.trim()) return [];
	return unitsFor(sql, data.customer);
});
var listEversysModels_createServerFn_handler = createServerRpc({
	id: "9808091b7d88c9aaa0ea182e021098ea511e2b2129e3f7326d1f45fc088dd90e",
	name: "listEversysModels",
	filename: "src/lib/ops/module-assign.ts"
}, (opts) => listEversysModels.__executeServer(opts));
var listEversysModels = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listEversysModels_createServerFn_handler, async () => {
	return (await (await ready()).query("select name from directory_equipment where archived = false order by name")).map((r) => r.name).filter(isEversysMachine);
});
var addUnitInput = object({
	customer: string().min(1),
	model: string().min(1),
	serial: string().nullable().optional()
});
/** Put an Eversys machine on an account's equipment list so a module can attach to it. */
var addEversysUnit_createServerFn_handler = createServerRpc({
	id: "88be35dcf0a2c1d3551c39b1be50a9cb7a322ff5171e96b8949ba2ed02af4295",
	name: "addEversysUnit",
	filename: "src/lib/ops/module-assign.ts"
}, (opts) => addEversysUnit.__executeServer(opts));
var addEversysUnit = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addUnitInput.parse(d)).handler(addEversysUnit_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const customer = await resolveAccount(sql, data.customer);
	const model = data.model.trim();
	if (!isEversysMachine(model)) throw new Error("Pick an Eversys model (Cameo, Enigma, e'4, Legacy…).");
	const serial = data.serial?.trim() || null;
	const key = serial ? serialKey(serial) : null;
	if (key) {
		const dup = await sql.query("select customer from account_equipment where serial_key = $1 limit 1", [key]);
		if (dup[0]) throw new Error(`Serial ${serial} is already on ${dup[0].customer}.`);
	}
	const inserted = await sql.query(`insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key)
       values ($1, $2, $2, $3, $4) returning id`, [
		customer,
		model,
		serial,
		key
	]);
	const who = await actorOf(sql, context.userId);
	const acct = await sql.query("select id from directory_customers where archived = false and lower(name) = lower($1) limit 1", [customer]);
	if (acct[0]) await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, 'equipment added', $3)`, [
		acct[0].id,
		who.name,
		unitLabel(model, serial)
	]).catch(() => void 0);
	const unit = (await unitsFor(sql, customer)).find((u) => u.id === inserted[0].id);
	if (!unit) throw new Error("Could not add that unit");
	return unit;
});
var assignInput = object({
	id: number().int().positive(),
	customer: string().min(1),
	unitId: number().int().positive()
});
/** Attach a module to one Eversys unit on an account. It leaves HQ stock. */
var assignModule_createServerFn_handler = createServerRpc({
	id: "4fd496bf6f3b83f97ef52b606bd73a533c265292f27c685f1038aa91ca228095",
	name: "assignModule",
	filename: "src/lib/ops/module-assign.ts"
}, (opts) => assignModule.__executeServer(opts));
var assignModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assignInput.parse(d)).handler(assignModule_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const customer = await resolveAccount(sql, data.customer);
	const mod = (await sql.query("select id, module_id, status, location, assigned_customer, return_pending from modules where id = $1", [data.id]))[0];
	if (!mod) throw new Error("Module not found");
	const current = moduleAccount({
		status: mod.status,
		assignedCustomer: mod.assigned_customer,
		location: mod.location
	});
	if (current) throw new Error(`Module ${mod.module_id} is already on ${current}. Return it to the warehouse first.`);
	if (flagOn(mod.return_pending)) throw new Error("This module is waiting on a return approval.");
	const unit = (await unitsFor(sql, customer)).find((u) => u.id === data.unitId);
	if (!unit) throw new Error("Pick an Eversys unit on that account.");
	const who = await actorOf(sql, context.userId);
	await sql.query(`update modules set
          assigned_customer = $2,
          assigned_unit_id = $3,
          assigned_unit_label = $4,
          assigned_at = now(),
          assigned_by = $5,
          return_pending = false,
          status = 'Installed at Account',
          location = $2,
          updated_at = now()
        where id = $1`, [
		mod.id,
		customer,
		unit.id,
		unit.label,
		who.name
	]);
	await log(sql, who.name, mod.id, "assigned", `${customer} · ${unit.label}`);
	return {
		customer,
		unit: unit.label
	};
});
async function finishReturn(sql, id) {
	await sql.query(`update modules set
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
      where id = $1`, [id]);
}
/** Bring a module back to HQ. Admin: right away. Warehouse: waits for an admin, like warehouse removes. */
var returnModule_createServerFn_handler = createServerRpc({
	id: "137d5ded2d7aa5bf5f98629cbfee951305bc859007c12a4dcd52b59675374475",
	name: "returnModule",
	filename: "src/lib/ops/module-assign.ts"
}, (opts) => returnModule.__executeServer(opts));
var returnModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(returnModule_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const who = await actorOf(sql, context.userId);
	if (!who.admin && !who.warehouse) throw new Error("Only Admin or Warehouse can return a module to the warehouse.");
	const mod = (await sql.query("select id, module_id, module_type, status, location, assigned_customer, return_pending from modules where id = $1", [data.id]))[0];
	if (!mod) throw new Error("Module not found");
	const customer = moduleAccount({
		status: mod.status,
		assignedCustomer: mod.assigned_customer,
		location: mod.location
	});
	if (!customer && mod.status !== "Installed at Account") throw new Error("This module is already at HQ.");
	if (flagOn(mod.return_pending)) throw new Error("This module is already waiting on approval.");
	if (who.admin) {
		await finishReturn(sql, mod.id);
		await log(sql, who.name, mod.id, "returned", `Back at HQ from ${customer ?? "an account"}`);
		return { pending: false };
	}
	await sql.query(`update modules set return_pending = true, return_by = $2, return_by_name = $3, return_at = now(), updated_at = now()
        where id = $1`, [
		mod.id,
		context.userId,
		who.name
	]);
	await log(sql, who.name, mod.id, "return requested", `From ${customer ?? "an account"}`);
	await notifyAdminsModuleReturn(sql, context.userId, {
		id: mod.id,
		moduleId: mod.module_id,
		moduleType: mod.module_type,
		customer
	});
	return { pending: true };
});
var decideModuleReturn_createServerFn_handler = createServerRpc({
	id: "318f2417021bd67d7153f1f67032773c35ae5961093958f08328a0f35bfa153e",
	name: "decideModuleReturn",
	filename: "src/lib/ops/module-assign.ts"
}, (opts) => decideModuleReturn.__executeServer(opts));
var decideModuleReturn = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number().int().positive(),
	decision: _enum(["approve", "reject"])
}).parse(d)).handler(decideModuleReturn_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const who = await actorOf(sql, context.userId);
	if (!who.admin) throw new Error("Only an admin can approve this.");
	const mod = (await sql.query("select id, return_pending, return_by, assigned_customer, location from modules where id = $1", [data.id]))[0];
	if (!mod || !flagOn(mod.return_pending)) throw new Error("This module is not waiting on approval.");
	if (mod.return_by === context.userId) throw new Error("You can’t approve your own request.");
	if (data.decision === "reject") {
		await sql.query("update modules set return_pending = false, return_by = null, return_by_name = null, return_at = null, updated_at = now() where id = $1", [mod.id]);
		await log(sql, who.name, mod.id, "return rejected", "Stays on the account");
		return { ok: true };
	}
	await finishReturn(sql, mod.id);
	await log(sql, who.name, mod.id, "returned", `Approved · back at HQ from ${mod.assigned_customer ?? mod.location ?? "an account"}`);
	return { ok: true };
});
//#endregion
export { addEversysUnit_createServerFn_handler, assignModule_createServerFn_handler, decideModuleReturn_createServerFn_handler, listEversysModels_createServerFn_handler, listEversysUnits_createServerFn_handler, returnModule_createServerFn_handler };
