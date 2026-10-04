import { r as __exportAll } from "../_runtime.mjs";
import { hn as object, mn as number, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as createServerFn } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { r as getSql } from "./db.mjs";
import { t as isWalkIn } from "./customer-key.mjs";
import { u as serialKey } from "./account-equip.mjs";
import { a as deskMiddleware, b as flagOn } from "./access.mjs";
import { s as notifyAdminsStockRequest } from "./notify.mjs";
import { a as LOCATION_SITES, g as slotId, h as siteLabel, o as SITE_LABEL, p as rackBayError, s as SITE_PURPOSE } from "./warehouse.mjs";
import { r as requireStock } from "./rack-stock.mjs";
//#region src/lib/ops/stock-action-rules.ts
var REMOVE_REASONS = [
	"Sold / left with customer",
	"Installed",
	"Sent to rebuild",
	"Scrap / beyond repair",
	"Returned to vendor",
	"Duplicate record",
	"Other"
];
var HOUSE_PLACES = /* @__PURE__ */ new Set([
	"barn-back",
	"barn-front",
	"staging",
	"training",
	"front-lobby"
]);
function isRemoveReason(value) {
	return REMOVE_REASONS.includes(value);
}
function removeReasonError(reason, note) {
	if (!isRemoveReason(reason)) return "Pick a reason.";
	if (reason === "Other" && !(note ?? "").trim()) return "Other needs a note.";
	return null;
}
/** Rack, staging, training, or lobby — not a customer site. */
function isWarehouseStockPlace(site) {
	return HOUSE_PLACES.has(site ?? "");
}
function customerLocationMessage(name) {
	return `This serial is still on ${name.trim() || "a customer account"}. Move it off the account first.`;
}
//#endregion
//#region src/lib/ops/unit-place-rules.ts
var HOUSE_TRAINING = "training";
var HOUSE_LOBBY = "front-lobby";
var HOUSE_STAGING = "staging";
var HOUSE_OTHER = "other";
var CUSTOMER_SITES = LOCATION_SITES.filter((s) => s !== "training" && s !== "front-lobby");
var PLACE_CHOICES = [
	{
		value: "barn-front",
		label: "Front rack"
	},
	{
		value: "barn-back",
		label: "Back rack"
	},
	{
		value: HOUSE_TRAINING,
		label: "Training"
	},
	{
		value: "lobby",
		label: "Lobby"
	},
	{
		value: HOUSE_STAGING,
		label: "Staging area"
	},
	{
		value: HOUSE_OTHER,
		label: "Other"
	},
	...CUSTOMER_SITES.map((s) => ({
		value: s,
		label: SITE_LABEL[s] ?? s
	}))
];
function electricalFrom(text) {
	if (!text) return null;
	const m = text.match(/\b(\d{2,3}\s*V(?:\s*\/\s*[^\s,;]+)?(?:\s*\/\s*\d{1,3}A)?)\b/i);
	return m ? m[1].replace(/\s+/g, " ") : null;
}
function resolvePlaceSite(value) {
	if (value === "lobby") return HOUSE_LOBBY;
	return value;
}
function isRackPlace(site) {
	return site === "barn-front" || site === "barn-back";
}
function unitPlaceLabel(row) {
	const pallet = row.pallet?.trim().toUpperCase();
	const level = row.level == null || Number.isNaN(Number(row.level)) ? null : Number(row.level);
	const rack = row.site === "barn-front" ? "Front" : row.site === "barn-back" ? "Back" : null;
	if (rack && pallet && level) return `${rack} · ${slotId(pallet, level)}`;
	if (rack && pallet) return `${rack} · ${pallet}`;
	if (rack) return rack === "Front" ? "Front rack" : "Back rack";
	if (row.site === "training") return "Training";
	if (row.site === "front-lobby") return "Lobby";
	if (row.site === "staging") return "Staging area";
	if (row.site === "other") return (row.purpose ?? "").trim() || "Other";
	if (row.site === "account") return row.soldTo?.trim() ? `On ${row.soldTo.trim()}` : "On the account";
	if (row.site === "removed" || row.status === "removed") return "Removed from stock";
	const site = siteLabel(row.site);
	if (row.soldTo?.trim() && (row.status === "assigned" || row.status === "sold")) return `${row.soldTo.trim()} / ${site}`;
	return site || SITE_LABEL[row.site] || row.site;
}
function lastMoveLine(notes) {
	const lines = (notes ?? "").split(/\n/).map((s) => s.trim()).filter((s) => /^Moved from /i.test(s));
	return lines.length ? lines[lines.length - 1] : null;
}
/**
* A unit assigned to an account, or sold, is locked: it is an asset at that site or customer.
* It can't be put on a rack, moved to another place, or given to another account until it is returned.
*/
function placeMove(existing) {
	if (!existing) return "create";
	if (existing.status === "sold" || existing.status === "assigned") return "blocked";
	return "move";
}
function placeDraftError(draft) {
	if (!draft.site || draft.site === "barn") return "Pick a rack.";
	if (isRackPlace(draft.site)) {
		const bay = rackBayError(draft.site, draft.pallet);
		if (bay) return bay.endsWith(".") ? bay : `${bay}.`;
	}
	if (isRackPlace(draft.site) && !draft.level) return "Pick a level.";
	if (draft.site === "other" && !(draft.otherLabel ?? "").trim()) return "Other needs a short label.";
	return null;
}
//#endregion
//#region src/lib/ops/stock-actions.ts
var stock_actions_exports = /* @__PURE__ */ __exportAll({
	assertNotHeld: () => assertNotHeld,
	decideStockAction: () => decideStockAction,
	ensureStockSchema: () => ensureStockSchema,
	requestStockAssign: () => requestStockAssign,
	requestStockRemove: () => requestStockRemove
});
async function ready() {
	const { ensureSeeded } = await import("./seed.server.mjs");
	await ensureSeeded();
	const sql = await getSql();
	await ensureStockSchema(sql);
	return sql;
}
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
async function actorOf(sql, userId) {
	const row = await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [userId]);
	return {
		admin: flagOn(row[0]?.is_admin),
		warehouse: row[0]?.desk_role === "warehouse",
		name: row[0]?.username || "Teammate"
	};
}
var ASSET_COLS = `id, model, serial, status, site, pallet, level, line_no, notes, purpose, sold_to, stock_hold`;
async function loadAsset(sql, id) {
	return (await sql.query(`select ${ASSET_COLS} from assets where id = $1`, [id]))[0] ?? null;
}
function slotOf(row) {
	return unitPlaceLabel({
		site: row.site,
		pallet: row.pallet,
		level: row.level,
		status: row.status,
		soldTo: row.sold_to,
		purpose: row.purpose
	});
}
function stamped(who) {
	return `${who} · ${new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Chicago",
		dateStyle: "medium",
		timeStyle: "short"
	}).format(/* @__PURE__ */ new Date())}`;
}
function withLine(notes, line) {
	const base = (notes ?? "").trim();
	return base ? `${base}\n${line}` : line;
}
/** A pending remove or assign stays in its slot until an admin decides. */
async function assertNotHeld(sql, id) {
	await ensureStockSchema(sql);
	if ((await sql.query("select stock_hold from assets where id = $1", [id]))[0]?.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
}
async function accountHolding(sql, row) {
	if (CUSTOMER_SITES.includes(row.site)) return SITE_LABEL[row.site] ?? row.site;
	if (row.status === "sold" || row.status === "assigned" || row.sold_to && !isWarehouseStockPlace(row.site)) return row.sold_to?.trim() || "a customer account";
	const key = serialKey(row.serial);
	if (!key) return null;
	return (await sql.query("select customer from account_equipment where serial_key = $1 order by id limit 1", [key]))[0]?.customer?.trim() || null;
}
async function assertRemovable(sql, row) {
	if (!isWarehouseStockPlace(row.site)) {
		const holding = await accountHolding(sql, row);
		if (holding) throw new Error(customerLocationMessage(holding));
		throw new Error("Remove is only for a unit on a rack, in staging, training, or the lobby.");
	}
	const holding = await accountHolding(sql, row);
	if (holding) throw new Error(customerLocationMessage(holding));
}
async function pendingFor(sql, assetId) {
	return (await sql.query(`select id, asset_id, kind, status, reason, note, customer, place_site, serial, model, last_slot, asked_by, asked_name
       from asset_stock_actions
      where asset_id = $1 and status = 'pending'
      order by id desc
      limit 1`, [assetId]))[0] ?? null;
}
async function clearHold(sql, id) {
	await sql.query(`update assets set
        stock_hold = null,
        stock_hold_customer = null,
        stock_hold_reason = null,
        stock_hold_note = null,
        stock_hold_by = null,
        updated_at = now()
      where id = $1`, [id]);
}
async function finalizeRemove(sql, row, reason, note, asked, approved) {
	const line = `Removed from ${slotOf(row)} · ${reason}${note ? ` · ${note}` : ""} · asked ${asked} · approved ${approved} · ${stamped(approved)}`;
	await sql.query(`update assets set
        status = 'removed',
        site = 'removed',
        pallet = null,
        level = null,
        line_no = null,
        notes = $2,
        stock_hold = null,
        stock_hold_customer = null,
        stock_hold_reason = null,
        stock_hold_note = null,
        stock_hold_by = null,
        updated_at = now()
      where id = $1`, [row.id, withLine(row.notes, line)]);
}
async function putOnAccount(sql, customer, model, serial, notes) {
	const key = serialKey(serial);
	const electrical = electricalFrom(notes);
	if (key) {
		const existing = await sql.query("select id from account_equipment where serial_key = $1 order by id limit 1", [key]);
		if (existing[0]) {
			await sql.query(`update account_equipment set
            customer = $2,
            catalog_model = $3,
            equipment_name = $3,
            serial = $4,
            electrical = coalesce($5, electrical),
            updated_at = now()
          where id = $1`, [
				existing[0].id,
				customer,
				model,
				serial?.trim() || null,
				electrical
			]);
			return;
		}
	}
	await sql.query(`insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, electrical)
     values ($1, $2, $2, $3, $4, $5)`, [
		customer,
		model,
		serial?.trim() || null,
		key || null,
		electrical
	]);
}
async function finalizeAssign(sql, row, customer, placeSite, asked, approved) {
	const slot = slotOf(row);
	const site = placeSite || "account";
	const status = placeSite ? "deployed" : "at-account";
	const purpose = placeSite ? SITE_PURPOSE[placeSite] ?? row.purpose : row.purpose;
	const where = placeSite ? SITE_LABEL[placeSite] ?? placeSite : "the account";
	const line = `Assigned to ${customer}${placeSite ? ` · ${where}` : ""} from ${slot} · asked ${asked} · approved ${approved} · ${stamped(approved)}`;
	await sql.query(`update assets set
        status = $2,
        site = $3,
        pallet = null,
        level = null,
        line_no = null,
        sold_to = $4,
        purpose = $5,
        notes = $6,
        stock_hold = null,
        stock_hold_customer = null,
        stock_hold_reason = null,
        stock_hold_note = null,
        stock_hold_by = null,
        updated_at = now()
      where id = $1`, [
		row.id,
		status,
		site,
		customer,
		purpose,
		withLine(row.notes, line)
	]);
	await putOnAccount(sql, customer, row.model, row.serial, row.notes);
}
async function resolveCustomer(sql, raw) {
	const name = raw.trim();
	if (!name) throw new Error("Pick an account.");
	if (isWalkIn(name)) throw new Error("Pick a real account. Walk-In is not a KatzDesk customer. Add the café first.");
	const rows = await sql.query("select name from directory_customers where archived = false and lower(name) = lower($1) limit 1", [name]);
	if (!rows[0]) throw new Error("Pick an account already on the customer list.");
	return rows[0].name;
}
function resolveSite(site) {
	const value = (site ?? "").trim();
	if (!value) return null;
	if (!CUSTOMER_SITES.includes(value)) throw new Error("Pick a site from equipment by location, or leave it blank.");
	return value;
}
async function insertAction(sql, row, kind, status, fields, askedBy, askedName, decidedBy, decidedName) {
	return (await sql.query(`insert into asset_stock_actions (
        asset_id, kind, status, reason, note, customer, place_site, serial, model,
        last_slot, last_site, last_pallet, last_level, last_line,
        asked_by, asked_name, decided_by, decided_name, decided_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, case when $3 = 'approved' then now() else null end
      ) returning id`, [
		row.id,
		kind,
		status,
		fields.reason ?? null,
		fields.note ?? null,
		fields.customer ?? null,
		fields.placeSite ?? null,
		row.serial,
		row.model,
		slotOf(row),
		row.site,
		row.pallet,
		row.level,
		row.line_no,
		askedBy,
		askedName,
		decidedBy,
		decidedName
	]))[0]?.id ?? null;
}
var removeInput = object({
	id: number().int().positive(),
	reason: string(),
	note: string().nullable().optional()
});
var requestStockRemove = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => removeInput.parse(d)).handler(async ({ data, context }) => {
	const sql = await ready();
	const role = await requireStock(sql, context.userId);
	const who = await actorOf(sql, context.userId);
	const row = await loadAsset(sql, data.id);
	if (!row) throw new Error("Unit not found");
	if (row.stock_hold) throw new Error("This unit is already waiting on approval.");
	if (await pendingFor(sql, row.id)) throw new Error("This unit is already waiting on approval.");
	const note = (data.note ?? "").trim();
	const err = removeReasonError(data.reason, note);
	if (err) throw new Error(err);
	await assertRemovable(sql, row);
	if (role.warehouse && !role.admin) {
		await insertAction(sql, row, "remove", "pending", {
			reason: data.reason,
			note: note || null
		}, context.userId, who.name, null, null);
		await sql.query(`update assets set
            stock_hold = 'remove',
            stock_hold_reason = $2,
            stock_hold_note = $3,
            stock_hold_by = $4,
            stock_hold_customer = null,
            updated_at = now()
          where id = $1`, [
			row.id,
			data.reason,
			note || null,
			context.userId
		]);
		await notifyAdminsStockRequest(sql, context.userId, {
			id: row.id,
			model: row.model,
			serial: row.serial,
			slot: slotOf(row),
			kind: "remove",
			reason: data.reason
		});
		return { pending: true };
	}
	await insertAction(sql, row, "remove", "approved", {
		reason: data.reason,
		note: note || null
	}, context.userId, who.name, context.userId, who.name);
	await finalizeRemove(sql, row, data.reason, note, who.name, who.name);
	return { pending: false };
});
var assignInput = object({
	id: number().int().positive(),
	customer: string().min(1),
	site: string().nullable().optional()
});
var requestStockAssign = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assignInput.parse(d)).handler(async ({ data, context }) => {
	const sql = await ready();
	const role = await requireStock(sql, context.userId);
	const who = await actorOf(sql, context.userId);
	const row = await loadAsset(sql, data.id);
	if (!row) throw new Error("Unit not found");
	if (!isWarehouseStockPlace(row.site)) throw new Error("Assign starts from a unit on a rack, in staging, training, or the lobby.");
	if (row.stock_hold) throw new Error("This unit is already waiting on approval.");
	if (await pendingFor(sql, row.id)) throw new Error("This unit is already waiting on approval.");
	const customer = await resolveCustomer(sql, data.customer);
	const placeSite = resolveSite(data.site);
	if (role.warehouse && !role.admin) {
		await insertAction(sql, row, "assign", "pending", {
			customer,
			placeSite
		}, context.userId, who.name, null, null);
		await sql.query(`update assets set
            stock_hold = 'assign',
            stock_hold_customer = $2,
            stock_hold_reason = null,
            stock_hold_note = null,
            stock_hold_by = $3,
            updated_at = now()
          where id = $1`, [
			row.id,
			customer,
			context.userId
		]);
		await notifyAdminsStockRequest(sql, context.userId, {
			id: row.id,
			model: row.model,
			serial: row.serial,
			slot: slotOf(row),
			kind: "assign",
			customer
		});
		return {
			pending: true,
			customer
		};
	}
	await insertAction(sql, row, "assign", "approved", {
		customer,
		placeSite
	}, context.userId, who.name, context.userId, who.name);
	await finalizeAssign(sql, row, customer, placeSite, who.name, who.name);
	return {
		pending: false,
		customer
	};
});
var decideInput = object({
	id: number().int().positive(),
	decision: _enum(["approve", "reject"])
});
var decideStockAction = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => decideInput.parse(d)).handler(async ({ data, context }) => {
	const sql = await ready();
	const who = await actorOf(sql, context.userId);
	if (!who.admin) throw new Error("Only an admin can approve this.");
	const action = await pendingFor(sql, data.id);
	if (!action) throw new Error("This unit is not waiting on approval.");
	if (action.asked_by === context.userId) throw new Error("You can’t approve your own request.");
	const row = await loadAsset(sql, data.id);
	if (!row) throw new Error("Unit not found");
	if (data.decision === "reject") {
		await sql.query(`update asset_stock_actions set
            status = 'rejected',
            decided_by = $2,
            decided_name = $3,
            decided_at = now()
          where id = $1`, [
			action.id,
			context.userId,
			who.name
		]);
		await clearHold(sql, row.id);
		return { ok: true };
	}
	if (action.kind === "remove") {
		await assertRemovable(sql, row);
		await finalizeRemove(sql, row, action.reason || "Removed", (action.note ?? "").trim(), action.asked_name || "Warehouse", who.name);
	} else {
		const customer = action.customer?.trim();
		if (!customer) throw new Error("That request has no account.");
		await finalizeAssign(sql, row, customer, action.place_site, action.asked_name || "Warehouse", who.name);
	}
	await sql.query(`update asset_stock_actions set
          status = 'approved',
          decided_by = $2,
          decided_name = $3,
          decided_at = now()
        where id = $1`, [
		action.id,
		context.userId,
		who.name
	]);
	return { ok: true };
});
//#endregion
export { unitPlaceLabel as _, CUSTOMER_SITES as a, removeReasonError as b, HOUSE_STAGING as c, electricalFrom as d, isRackPlace as f, resolvePlaceSite as g, placeMove as h, stock_actions_exports as i, HOUSE_TRAINING as l, placeDraftError as m, requestStockAssign as n, HOUSE_LOBBY as o, lastMoveLine as p, requestStockRemove as r, HOUSE_OTHER as s, decideStockAction as t, PLACE_CHOICES as u, REMOVE_REASONS as v, isWarehouseStockPlace as y };
