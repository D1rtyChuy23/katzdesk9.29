import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as createServerFn } from "./ssr.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, mn as number, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stock-actions--pD9Tc8c.js
var stock_actions_exports = /* @__PURE__ */ __exportAll({
	assertNotHeld: () => assertNotHeld,
	decideStockAction: () => decideStockAction,
	ensureStockSchema: () => ensureStockSchema,
	requestStockAssign: () => requestStockAssign,
	requestStockRemove: () => requestStockRemove
});
async function ensureStockSchema(sql) {
	await sql.query(`
    create table if not exists asset_stock_actions (
      id            serial primary key,
      asset_id      int not null,
      kind          text not null,
      status        text not null,
      reason        text,
      note          text,
      customer      text,
      place_site    text,
      serial        text,
      model         text,
      last_slot     text,
      last_site     text,
      last_pallet   text,
      last_level    int,
      last_line     int,
      asked_by      text not null,
      asked_name    text,
      asked_at      timestamptz not null default now(),
      decided_by    text,
      decided_name  text,
      decided_at    timestamptz
    )`);
	await sql.query("alter table assets add column if not exists stock_hold text");
	await sql.query("alter table assets add column if not exists stock_hold_customer text");
	await sql.query("alter table assets add column if not exists stock_hold_reason text");
	await sql.query("alter table assets add column if not exists stock_hold_note text");
	await sql.query("alter table assets add column if not exists stock_hold_by text");
}
/** A pending remove or assign stays in its slot until an admin decides. */
async function assertNotHeld(sql, id) {
	await ensureStockSchema(sql);
	if ((await sql.query("select stock_hold from assets where id = $1", [id]))[0]?.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
}
var removeInput = object({
	id: number().int().positive(),
	reason: string(),
	note: string().nullable().optional()
});
var requestStockRemove = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => removeInput.parse(d)).handler(createSsrRpc("e22daf7fa7520295465ba09c97415667123484c7abe24eeb1d68fc4b017933d1"));
var assignInput = object({
	id: number().int().positive(),
	customer: string().min(1),
	site: string().nullable().optional()
});
var requestStockAssign = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assignInput.parse(d)).handler(createSsrRpc("32a1b02ecd015c716ce62e648f18c5dba877301caaef715def457c76fb7882ad"));
var decideInput = object({
	id: number().int().positive(),
	decision: _enum(["approve", "reject"])
});
var decideStockAction = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => decideInput.parse(d)).handler(createSsrRpc("e2b633ecf7be41a2429f12f5a3c5acb729d9ea365fa74fa060240071aaad4282"));
//#endregion
export { stock_actions_exports as i, requestStockAssign as n, requestStockRemove as r, decideStockAction as t };
