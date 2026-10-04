import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as createServerFn } from "./ssr.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, mn as number, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/module-assign-yoNW86uo.js
var module_assign_exports = /* @__PURE__ */ __exportAll({
	addEversysUnit: () => addEversysUnit,
	assignModule: () => assignModule,
	decideModuleReturn: () => decideModuleReturn,
	ensureModuleSchema: () => ensureModuleSchema,
	listEversysModels: () => listEversysModels,
	listEversysUnits: () => listEversysUnits,
	returnModule: () => returnModule
});
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
/** Eversys machines on one account (from its equipment list), with the modules already on each. */
var listEversysUnits = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ customer: string() }).parse(d)).handler(createSsrRpc("8440ebf91ba289568bca2d70bf896fe3d6ac37d423010b493bd201cb52fc8bfd"));
/** Eversys machine models from the equipment catalog (for adding a unit to an account first). */
var listEversysModels = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("9808091b7d88c9aaa0ea182e021098ea511e2b2129e3f7326d1f45fc088dd90e"));
var addUnitInput = object({
	customer: string().min(1),
	model: string().min(1),
	serial: string().nullable().optional()
});
/** Put an Eversys machine on an account's equipment list so a module can attach to it. */
var addEversysUnit = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addUnitInput.parse(d)).handler(createSsrRpc("88be35dcf0a2c1d3551c39b1be50a9cb7a322ff5171e96b8949ba2ed02af4295"));
var assignInput = object({
	id: number().int().positive(),
	customer: string().min(1),
	unitId: number().int().positive()
});
/** Attach a module to one Eversys unit on an account. It leaves HQ stock. */
var assignModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assignInput.parse(d)).handler(createSsrRpc("4fd496bf6f3b83f97ef52b606bd73a533c265292f27c685f1038aa91ca228095"));
/** Bring a module back to HQ. Admin: right away. Warehouse: waits for an admin, like warehouse removes. */
var returnModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(createSsrRpc("137d5ded2d7aa5bf5f98629cbfee951305bc859007c12a4dcd52b59675374475"));
/** Admin approves or rejects a Warehouse return. */
var decideModuleReturn = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number().int().positive(),
	decision: _enum(["approve", "reject"])
}).parse(d)).handler(createSsrRpc("318f2417021bd67d7153f1f67032773c35ae5961093958f08328a0f35bfa153e"));
//#endregion
export { listEversysUnits as a, listEversysModels as i, assignModule as n, module_assign_exports as o, decideModuleReturn as r, returnModule as s, addEversysUnit as t };
