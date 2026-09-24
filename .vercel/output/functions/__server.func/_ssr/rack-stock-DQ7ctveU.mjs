import { c as __exportAll, r as createServerFn } from "./ssr.mjs";
import { n as flagOn } from "./flag-D6I81eZh.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-Bds4AN6g.mjs";
import { hn as object, mn as number, sn as _enum, un as boolean, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { m as slotId } from "./warehouse-C-11YLmg.mjs";
import { a as notifyAdminsRackReview } from "./notify-BqzZpuR5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rack-stock-DQ7ctveU.js
var rack_stock_exports = /* @__PURE__ */ __exportAll({
	addToRackSlot: () => addToRackSlot,
	flagRackArrival: () => flagRackArrival,
	requireStock: () => requireStock,
	reviewRackUnit: () => reviewRackUnit,
	setShopTest: () => setShopTest
});
async function roleOf(sql, userId) {
	const row = await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [userId]);
	return {
		admin: flagOn(row[0]?.is_admin),
		warehouse: row[0]?.desk_role === "warehouse",
		name: row[0]?.username || "Teammate"
	};
}
async function requireStock(sql, userId) {
	const role = await roleOf(sql, userId);
	if (!role.admin && !role.warehouse) throw new Error("Only Admin or Warehouse can change rack stock.");
	return role;
}
var addInput = object({
	site: string(),
	pallet: string().min(1),
	level: number().int(),
	model: string().min(1),
	serial: string().nullable().optional(),
	electrical: string().nullable().optional(),
	confirm: boolean().optional()
});
var addToRackSlot = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addInput.parse(d)).handler(createSsrRpc("a323e74b17415964c1a79e3045d4d2b6b8edab157ec39dd84721e7883b6a73f1"));
/** Warehouse moves onto a rack through the existing place picker. */
async function flagRackArrival(sql, userId, assetId, prev) {
	const role = await roleOf(sql, userId);
	if (!role.warehouse || role.admin) return;
	const asset = (await sql.query("select id, model, serial, pallet, level from assets where id = $1", [assetId]))[0];
	if (!asset?.pallet || asset.level == null) return;
	await sql.query(`update assets set
       review_status = 'pending',
       review_note = null,
       review_actor = $2,
       review_origin = 'moved',
       review_from_site = $3,
       review_from_pallet = $4,
       review_from_level = $5,
       review_from_line = $6,
       review_from_status = $7,
       shop_test = coalesce(shop_test, 'needs-test')
     where id = $1`, [
		assetId,
		userId,
		prev.site,
		prev.pallet,
		prev.level,
		prev.line_no,
		prev.status
	]);
	await notifyAdminsRackReview(sql, userId, {
		id: asset.id,
		model: asset.model,
		serial: asset.serial,
		slot: slotId(String(asset.pallet).toUpperCase(), Number(asset.level))
	});
}
var reviewInput = object({
	id: number().int().positive(),
	decision: _enum(["approve", "reject"]),
	note: string().nullable().optional()
});
var reviewRackUnit = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => reviewInput.parse(d)).handler(createSsrRpc("9e94e2e91b43a57fed4c1b0f49e909f425a99a2362fe97499cd4a23e47cd989f"));
var testInput = object({
	id: number().int().positive(),
	shopTest: _enum(["needs-test", "tested"]),
	note: string().nullable().optional()
});
var setShopTest = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => testInput.parse(d)).handler(createSsrRpc("a897fd5704cf2d93d3b6df8924c9e538522f63c4c16ebcacabb67b4c3f71411f"));
//#endregion
export { setShopTest as i, rack_stock_exports as n, reviewRackUnit as r, addToRackSlot as t };
