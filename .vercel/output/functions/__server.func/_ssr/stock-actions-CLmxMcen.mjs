import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { o as deskMiddleware } from "./access-CeCitFku.mjs";
import { t as isWalkIn } from "./customer-key-BKZJDViL.mjs";
import { u as serialKey } from "./account-equip-pqzlCVTH.mjs";
import { hn as object, mn as number, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { o as SITE_LABEL, s as SITE_PURPOSE } from "./warehouse-DOAlNQ25.mjs";
import { s as notifyAdminsStockRequest } from "./notify-CxtUIjWw.mjs";
import { r as requireStock } from "./rack-stock-BKENc6gb.mjs";
import { i as removeReasonError, n as customerLocationMessage, r as isWarehouseStockPlace } from "./stock-action-rules-x6fOwQr_.mjs";
import { p as unitPlaceLabel, s as electricalFrom, t as CUSTOMER_SITES } from "./unit-place-rules-C-2Ssj2C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stock-actions-CLmxMcen.js
async function ready() {
	const { ensureSeeded } = await import("./seed.server-2-fPCFoA.mjs");
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
var requestStockRemove_createServerFn_handler = createServerRpc({
	id: "e22daf7fa7520295465ba09c97415667123484c7abe24eeb1d68fc4b017933d1",
	name: "requestStockRemove",
	filename: "src/lib/ops/stock-actions.ts"
}, (opts) => requestStockRemove.__executeServer(opts));
var requestStockRemove = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => removeInput.parse(d)).handler(requestStockRemove_createServerFn_handler, async ({ data, context }) => {
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
var requestStockAssign_createServerFn_handler = createServerRpc({
	id: "32a1b02ecd015c716ce62e648f18c5dba877301caaef715def457c76fb7882ad",
	name: "requestStockAssign",
	filename: "src/lib/ops/stock-actions.ts"
}, (opts) => requestStockAssign.__executeServer(opts));
var requestStockAssign = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assignInput.parse(d)).handler(requestStockAssign_createServerFn_handler, async ({ data, context }) => {
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
var decideStockAction_createServerFn_handler = createServerRpc({
	id: "e2b633ecf7be41a2429f12f5a3c5acb729d9ea365fa74fa060240071aaad4282",
	name: "decideStockAction",
	filename: "src/lib/ops/stock-actions.ts"
}, (opts) => decideStockAction.__executeServer(opts));
var decideStockAction = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => decideInput.parse(d)).handler(decideStockAction_createServerFn_handler, async ({ data, context }) => {
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
export { decideStockAction_createServerFn_handler, requestStockAssign_createServerFn_handler, requestStockRemove_createServerFn_handler };
