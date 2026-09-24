import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { r as getSql } from "./db-B30u4tE3.mjs";
import { n as flagOn } from "./flag-D6I81eZh.mjs";
import { u as serialKey } from "./account-equip-DMHHRLhM.mjs";
import { o as deskMiddleware } from "./access-Bds4AN6g.mjs";
import { hn as object, mn as number, sn as _enum, un as boolean, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { i as LEVELS, m as slotId, r as FRONT_PALLETS, t as BACK_PALLETS, u as isValidBay } from "./warehouse-C-11YLmg.mjs";
import { a as notifyAdminsRackReview } from "./notify-BqzZpuR5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rack-stock-Bd4tLUT1.js
async function ready() {
	const { ensureSeeded } = await import("./seed.server-BYmYnsv0.mjs");
	await ensureSeeded();
	return getSql();
}
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
function rackOf(site) {
	if (site === "barn-front") return "barn-front";
	if (site === "barn-back" || site === "barn") return "barn-back";
	throw new Error("Pick a barn rack");
}
function levelOf(level) {
	if (!LEVELS.includes(level)) throw new Error("Pick a level");
	return level;
}
async function nextLine(sql, site, pallet, level, exceptId) {
	const taken = await sql.query(`select id, line_no from assets
      where site = $1 and pallet = $2 and level = $3
        and status in ('ready', 'deployed')
        and line_no is not null`, [
		site,
		pallet,
		level
	]);
	const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.line_no));
	for (let line = 1; line <= 12; line++) if (!used.has(line)) return line;
	throw new Error(`${slotId(pallet, level)} is full`);
}
async function findSerial(sql, serial) {
	const key = serialKey(serial);
	if (!key) return null;
	const hits = (await sql.query("select id, model, serial, status, site, pallet, level, line_no, notes, sold_to from assets where serial is not null")).filter((r) => serialKey(r.serial) === key);
	return hits.find((r) => r.status !== "sold") ?? hits[0] ?? null;
}
function withElectrical(notes, electrical) {
	const add = (electrical ?? "").trim();
	const base = (notes ?? "").trim();
	if (!add) return base || null;
	if (base.toLowerCase().includes(add.toLowerCase())) return base;
	return [base, add].filter(Boolean).join("\n");
}
async function placeExisting(sql, id, site, pallet, level, line, notes, actor, warehouse, prev) {
	await sql.query(`update assets set
       status = 'ready',
       site = $2,
       pallet = $3,
       level = $4,
       line_no = $5,
       notes = $6,
       install_id = null,
       job_id = null,
       shop_test = coalesce(shop_test, 'needs-test'),
       review_status = case when $7 then 'pending' else review_status end,
       review_note = case when $7 then null else review_note end,
       review_actor = case when $7 then $8 else review_actor end,
       review_origin = case when $7 then 'moved' else review_origin end,
       review_from_site = case when $7 then $9 else review_from_site end,
       review_from_pallet = case when $7 then $10 else review_from_pallet end,
       review_from_level = case when $7 then $11 else review_from_level end,
       review_from_line = case when $7 then $12 else review_from_line end,
       review_from_status = case when $7 then $13 else review_from_status end,
       updated_at = now()
     where id = $1`, [
		id,
		site,
		pallet,
		level,
		line,
		notes,
		warehouse,
		actor,
		prev.site,
		prev.pallet,
		prev.level,
		prev.line_no,
		prev.status
	]);
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
var addToRackSlot_createServerFn_handler = createServerRpc({
	id: "a323e74b17415964c1a79e3045d4d2b6b8edab157ec39dd84721e7883b6a73f1",
	name: "addToRackSlot",
	filename: "src/lib/ops/rack-stock.ts"
}, (opts) => addToRackSlot.__executeServer(opts));
var addToRackSlot = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addInput.parse(d)).handler(addToRackSlot_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const role = await requireStock(sql, context.userId);
	const site = rackOf(data.site);
	const pallet = data.pallet.trim().toUpperCase();
	const level = levelOf(data.level);
	const allowed = site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
	if (!isValidBay(pallet) || !allowed.includes(pallet)) throw new Error("Pick a bay A through P on this rack");
	const slot = slotId(pallet, level);
	const serial = data.serial?.trim() || "";
	const electrical = data.electrical?.trim() || null;
	const existing = serial ? await findSerial(sql, serial) : null;
	if (existing && (existing.status === "sold" || existing.sold_to)) throw new Error(`That serial is already allocated${existing.sold_to ? ` to ${existing.sold_to}` : ""}.`);
	if (existing) {
		if (existing.site === site && (existing.pallet ?? "").toUpperCase() === pallet && Number(existing.level) === level && existing.status === "ready") throw new Error(`${serial} is already in ${slot}.`);
		const current = existing.pallet && existing.level ? slotId(String(existing.pallet).toUpperCase(), Number(existing.level)) : existing.site;
		if (!data.confirm) return {
			id: existing.id,
			moved: false,
			needsConfirm: true,
			currentPlace: current,
			pendingReview: false
		};
		const line = await nextLine(sql, site, pallet, level, existing.id);
		await placeExisting(sql, existing.id, site, pallet, level, line, withElectrical(existing.notes, electrical), context.userId, role.warehouse && !role.admin, existing);
		const pendingReview = role.warehouse && !role.admin;
		if (pendingReview) await notifyAdminsRackReview(sql, context.userId, {
			id: existing.id,
			model: existing.model,
			serial,
			slot
		});
		return {
			id: existing.id,
			moved: true,
			needsConfirm: false,
			currentPlace: null,
			pendingReview
		};
	}
	const line = await nextLine(sql, site, pallet, level);
	const pending = role.warehouse && !role.admin;
	const id = (await sql.query(`insert into assets (
         kind, model, serial, qty, site, pallet, level, line_no, status, notes,
         shop_test, review_status, review_actor, review_origin
       ) values (
         'equip', $1, $2, 1, $3, $4, $5, $6, 'ready', $7,
         'needs-test', $8, $9, $10
       ) returning id`, [
		data.model.trim(),
		serial || null,
		site,
		pallet,
		level,
		line,
		withElectrical(null, electrical),
		pending ? "pending" : null,
		pending ? context.userId : null,
		pending ? "created" : null
	]))[0]?.id;
	if (!id) throw new Error("Could not add that unit");
	if (pending) await notifyAdminsRackReview(sql, context.userId, {
		id,
		model: data.model.trim(),
		serial: serial || null,
		slot
	});
	return {
		id,
		moved: false,
		needsConfirm: false,
		currentPlace: null,
		pendingReview: pending
	};
});
var reviewInput = object({
	id: number().int().positive(),
	decision: _enum(["approve", "reject"]),
	note: string().nullable().optional()
});
var reviewRackUnit_createServerFn_handler = createServerRpc({
	id: "9e94e2e91b43a57fed4c1b0f49e909f425a99a2362fe97499cd4a23e47cd989f",
	name: "reviewRackUnit",
	filename: "src/lib/ops/rack-stock.ts"
}, (opts) => reviewRackUnit.__executeServer(opts));
var reviewRackUnit = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => reviewInput.parse(d)).handler(reviewRackUnit_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const role = await roleOf(sql, context.userId);
	if (!role.admin) throw new Error("Only an admin can review a rack add.");
	const asset = (await sql.query(`select id, model, serial, review_status, review_actor, review_origin,
              review_from_site, review_from_pallet, review_from_level, review_from_line, review_from_status
         from assets where id = $1`, [data.id]))[0];
	if (!asset) throw new Error("Unit not found");
	if (asset.review_status !== "pending") throw new Error("This unit is not waiting for review.");
	if (data.decision === "approve") {
		await sql.query(`update assets set review_status = 'approved', review_note = null, updated_at = now() where id = $1`, [asset.id]);
		return { ok: true };
	}
	const note = (data.note ?? "").trim();
	if (!note) throw new Error("Reject needs a short note.");
	if (asset.review_origin === "created") await sql.query("delete from assets where id = $1", [asset.id]);
	else await sql.query(`update assets set
           review_status = 'rejected',
           review_note = $2,
           status = coalesce($3, status),
           site = coalesce($4, site),
           pallet = $5,
           level = $6,
           line_no = $7,
           updated_at = now()
         where id = $1`, [
		asset.id,
		note,
		asset.review_from_status,
		asset.review_from_site,
		asset.review_from_pallet,
		asset.review_from_level,
		asset.review_from_line
	]);
	if (asset.review_actor) {
		const serial = asset.serial ? ` SN ${asset.serial}` : "";
		await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, entity_type, entity_id)
         values ($1, $2, $3, $4, 'asset', $5)`, [
			asset.review_actor,
			context.userId,
			role.name,
			`Rejected ${asset.model}${serial}. ${note}`,
			asset.review_origin === "created" ? null : asset.id
		]);
	}
	return { ok: true };
});
var testInput = object({
	id: number().int().positive(),
	shopTest: _enum(["needs-test", "tested"]),
	note: string().nullable().optional()
});
var setShopTest_createServerFn_handler = createServerRpc({
	id: "a897fd5704cf2d93d3b6df8924c9e538522f63c4c16ebcacabb67b4c3f71411f",
	name: "setShopTest",
	filename: "src/lib/ops/rack-stock.ts"
}, (opts) => setShopTest.__executeServer(opts));
var setShopTest = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => testInput.parse(d)).handler(setShopTest_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const role = await requireStock(sql, context.userId);
	const note = (data.note ?? "").trim() || null;
	if (data.shopTest === "tested") await sql.query(`update assets set shop_test = 'tested', shop_test_note = $2, shop_test_by = $3, shop_test_at = now(), updated_at = now()
         where id = $1`, [
		data.id,
		note,
		role.name
	]);
	else await sql.query(`update assets set shop_test = 'needs-test', shop_test_note = $2, shop_test_by = null, shop_test_at = null, updated_at = now()
         where id = $1`, [data.id, note]);
	return { ok: true };
});
//#endregion
export { addToRackSlot_createServerFn_handler, reviewRackUnit_createServerFn_handler, setShopTest_createServerFn_handler };
