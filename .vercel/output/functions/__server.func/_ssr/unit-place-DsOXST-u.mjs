import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { o as deskMiddleware } from "./access-CeCitFku.mjs";
import { u as serialKey } from "./account-equip-pqzlCVTH.mjs";
import { hn as object, ln as array, mn as number, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { a as LOCATION_SITES, i as LEVELS, l as isBarn, m as sectionFullMessage, p as rackBayError, s as SITE_PURPOSE } from "./warehouse-DOAlNQ25.mjs";
import { r as requireStock } from "./rack-stock-BKENc6gb.mjs";
import { d as placeMove, f as resolvePlaceSite, p as unitPlaceLabel, s as electricalFrom } from "./unit-place-rules-C-2Ssj2C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/unit-place-DsOXST-u.js
function barnRack(site) {
	if (site === "barn-back") return "barn-back";
	if (site === "barn-front") return "barn-front";
	return null;
}
function requireLevel(level) {
	const n = Number(level);
	if (!LEVELS.includes(n)) throw new Error("Pick a level");
	return n;
}
function isLocationSite(site) {
	return LOCATION_SITES.includes(site) || site === "other" || site === "staging";
}
var ASSET_COLS = `id, model, serial, status, site, pallet, level, line_no, notes, purpose,
  customer_owned, sold_to, install_id, job_id`;
function withNote(notes, extra) {
	const add = (extra ?? "").trim();
	const base = (notes ?? "").trim();
	if (!add) return base || null;
	if (base.toLowerCase().includes(add.toLowerCase())) return base;
	return [base, add].filter(Boolean).join("\n");
}
async function ready() {
	const { ensureSeeded } = await import("./seed.server-2-fPCFoA.mjs");
	await ensureSeeded();
	return getSql();
}
async function deskUsername(sql, userId) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}
async function logMove(sql, userId, assetId, detail) {
	await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ('asset', $1, $2, 'moved', $3)`, [
		assetId,
		await deskUsername(sql, userId),
		detail
	]);
}
async function bySerial(sql, serial) {
	const key = serialKey(serial);
	if (!key) return null;
	const hits = (await sql.query(`select ${ASSET_COLS} from assets where serial is not null and btrim(serial) <> ''`)).filter((r) => serialKey(r.serial) === key);
	return hits.find((r) => r.status !== "sold") ?? hits[0] ?? null;
}
async function byId(sql, id) {
	return (await sql.query(`select ${ASSET_COLS} from assets where id = $1`, [id]))[0] ?? null;
}
function toPlace(row) {
	if (!row) return {
		found: false,
		assetId: null,
		model: null,
		serial: null,
		place: null,
		site: null,
		pallet: null,
		electrical: null,
		status: null
	};
	return {
		found: true,
		assetId: row.id,
		model: row.model,
		serial: row.serial,
		place: unitPlaceLabel({
			site: row.site,
			pallet: row.pallet,
			level: row.level,
			status: row.status,
			soldTo: row.sold_to,
			purpose: row.purpose
		}),
		site: row.site,
		pallet: row.pallet,
		electrical: electricalFrom(row.notes) || electricalFrom(row.purpose),
		status: row.status
	};
}
async function openLine(sql, site, pallet, level, exceptId) {
	const taken = await sql.query(`select id, line_no from assets
      where site = $1 and upper(pallet) = $2 and level = $3
        and status in ('ready', 'deployed')
        and line_no is not null`, [
		site,
		pallet,
		level
	]);
	const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.line_no));
	for (let line = 1; line <= 12; line++) if (!used.has(line)) return line;
	throw new Error(sectionFullMessage(site, pallet, level));
}
async function parkInBarn(sql, userId, row, pallet, level, fromLabel, rack = "barn-back") {
	if (placeMove(row) === "blocked") throw new Error(`That serial is already allocated${row.sold_to ? ` to ${row.sold_to}` : ""}.`);
	const letter = pallet.trim().toUpperCase();
	const bayErr = rackBayError(rack, letter);
	if (bayErr) throw new Error(bayErr);
	if (!LEVELS.includes(level)) throw new Error("Pick a level");
	if (row.site === rack && (row.pallet ?? "").toUpperCase() === letter && Number(row.level) === level && row.status === "ready") throw new Error(`Already at ${unitPlaceLabel({
		site: rack,
		pallet: letter,
		level,
		status: "ready"
	})}.`);
	const { assertNotHeld } = await import("./stock-actions--pD9Tc8c.mjs").then((n) => n.i);
	await assertNotHeld(sql, row.id);
	await requireStock(sql, userId);
	const line = await openLine(sql, rack, letter, level, row.id);
	const notice = await moveNotice(sql, userId, fromLabel, unitPlaceLabel({
		site: rack,
		pallet: letter,
		level,
		status: "ready"
	}));
	const notes = withNote(row.notes, notice);
	await sql.query(`update assets set
        status = 'ready',
        site = $2,
        pallet = $3,
        level = $4,
        line_no = $5,
        notes = $6,
        updated_at = now()
      where id = $1`, [
		row.id,
		rack,
		letter,
		level,
		line,
		notes
	]);
	await logMove(sql, userId, row.id, notice);
	const { flagRackArrival } = await import("./rack-stock-BKENc6gb.mjs").then((n) => n.n);
	await flagRackArrival(sql, userId, row.id, {
		site: row.site,
		pallet: row.pallet,
		level: row.level,
		line_no: row.line_no,
		status: row.status
	});
	return notice;
}
async function parkAtLocation(sql, userId, row, site, electrical, otherLabel) {
	const dest = resolvePlaceSite(site);
	if (!isLocationSite(dest)) throw new Error("Pick a location");
	if (placeMove(row) === "blocked") throw new Error(`That serial is already allocated${row.sold_to ? ` to ${row.sold_to}` : ""}.`);
	const label = (otherLabel ?? "").trim();
	if (dest === "other" && !label) throw new Error("Other needs a short label.");
	const { assertNotHeld } = await import("./stock-actions--pD9Tc8c.mjs").then((n) => n.i);
	await assertNotHeld(sql, row.id);
	const notice = await moveNotice(sql, userId, unitPlaceLabel({
		site: row.site,
		pallet: row.pallet,
		level: row.level,
		status: row.status,
		soldTo: row.sold_to,
		purpose: row.purpose
	}), unitPlaceLabel({
		site: dest,
		purpose: dest === "other" ? label : row.purpose,
		status: "deployed"
	}));
	const purpose = dest === "other" ? label : row.site === "other" ? SITE_PURPOSE[dest] ?? null : row.purpose?.trim() || SITE_PURPOSE[dest] || null;
	const notes = withNote(withNote(row.notes, electrical), notice);
	await sql.query(`update assets set
        status = 'deployed',
        site = $2,
        pallet = null,
        level = null,
        line_no = null,
        notes = $3,
        purpose = $4,
        updated_at = now()
      where id = $1`, [
		row.id,
		dest,
		notes,
		purpose
	]);
	await logMove(sql, userId, row.id, notice);
	return notice;
}
async function moveNotice(sql, userId, from, to) {
	return `Moved from ${from} to ${to} · ${await deskUsername(sql, userId)} · ${new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Chicago",
		dateStyle: "medium",
		timeStyle: "short"
	}).format(/* @__PURE__ */ new Date())}`;
}
var listBarnAvailable_createServerFn_handler = createServerRpc({
	id: "571fac36bc18acec68c60cff2be5821a9a1e35ff8e235b891419be6bf272213f",
	name: "listBarnAvailable",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => listBarnAvailable.__executeServer(opts));
var listBarnAvailable = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listBarnAvailable_createServerFn_handler, async () => {
	return (await (await ready()).query(`select ${ASSET_COLS} from assets
        where status = 'ready'
          and site in ('barn-back', 'barn-front')
          and install_id is null
          and job_id is null
          and coalesce(sold_to, '') = ''
          and coalesce(stock_hold, '') <> 'assign'
        order by lower(model), serial nulls last, id`)).map((r) => ({
		id: r.id,
		model: r.model,
		serial: r.serial,
		pallet: r.pallet,
		electrical: electricalFrom(r.notes) || electricalFrom(r.purpose),
		customerOwned: r.customer_owned,
		place: unitPlaceLabel({
			site: r.site,
			pallet: r.pallet,
			level: r.level,
			status: r.status,
			soldTo: r.sold_to
		})
	}));
});
var placeIdsInput = object({
	ids: array(number().int().positive()).min(1),
	site: string(),
	otherLabel: string().nullable().optional()
});
var placeAssetsAtLocation_createServerFn_handler = createServerRpc({
	id: "536e7b9decc803b49351d2954119f89c08eef35743c6f3d4736a487c9fdc519b",
	name: "placeAssetsAtLocation",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => placeAssetsAtLocation.__executeServer(opts));
var placeAssetsAtLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => placeIdsInput.parse(d)).handler(placeAssetsAtLocation_createServerFn_handler, async ({ data, context }) => {
	if (!isLocationSite(resolvePlaceSite(data.site))) throw new Error("Pick a location");
	const sql = await ready();
	const rows = await Promise.all(data.ids.map((id) => byId(sql, id)));
	for (const row of rows) {
		if (!row) throw new Error("That unit is not in the barn");
		if (!isBarn(row.site) || row.status !== "ready") throw new Error(`${row.model} is not available in the barn`);
	}
	for (const row of rows) {
		if (!row) continue;
		await parkAtLocation(sql, context.userId, row, data.site, null, data.otherLabel ?? null);
	}
	return { moved: rows.length };
});
var addInput = object({
	site: string(),
	model: string().min(1),
	serial: string().nullable().optional(),
	electrical: string().nullable().optional(),
	otherLabel: string().nullable().optional()
});
var addUnitToLocation_createServerFn_handler = createServerRpc({
	id: "48eb40870b815944061c950459cff57ae73cf005608d9f5407b0d6c358a44e06",
	name: "addUnitToLocation",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => addUnitToLocation.__executeServer(opts));
var addUnitToLocation = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addInput.parse(d)).handler(addUnitToLocation_createServerFn_handler, async ({ data, context }) => {
	if (!isLocationSite(resolvePlaceSite(data.site))) throw new Error("Pick a location");
	const sql = await ready();
	const serial = data.serial?.trim() || "";
	const electrical = data.electrical?.trim() || null;
	if (serial) {
		const existing = await bySerial(sql, serial);
		const action = placeMove(existing);
		if (action === "blocked" && existing) throw new Error(`That serial is already allocated${existing.sold_to ? ` to ${existing.sold_to}` : ""}.`);
		if (existing && action === "move") {
			await parkAtLocation(sql, context.userId, existing, data.site, electrical, data.otherLabel ?? null);
			return {
				assetId: existing.id,
				pulled: isBarn(existing.site)
			};
		}
	}
	const dest = resolvePlaceSite(data.site);
	const label = (data.otherLabel ?? "").trim();
	if (dest === "other" && !label) throw new Error("Other needs a short label.");
	const notes = withNote(null, electrical);
	const id = (await sql.query(`insert into assets (kind, model, serial, qty, site, purpose, status, notes)
       values ('equip', $1, $2, 1, $3, $4, 'deployed', $5)
       returning id`, [
		data.model.trim(),
		serial || null,
		dest,
		dest === "other" ? label : SITE_PURPOSE[dest] ?? null,
		notes
	]))[0]?.id;
	if (!id) throw new Error("Could not add that unit");
	return {
		assetId: id,
		pulled: false
	};
});
var barnInput = object({
	id: number().int().positive(),
	pallet: string().min(1),
	level: number().int()
});
var moveUnitToBarn_createServerFn_handler = createServerRpc({
	id: "0eb120547d7147cfacb70cc0bcc4463a916dcf139e3559e0108dacbfad17c4f9",
	name: "moveUnitToBarn",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => moveUnitToBarn.__executeServer(opts));
var moveUnitToBarn = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => barnInput.parse(d)).handler(moveUnitToBarn_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const row = await byId(sql, data.id);
	if (!row) throw new Error("Unit not found");
	if (isBarn(row.site) && row.status === "ready") throw new Error("That unit is already in the barn");
	const from = unitPlaceLabel({
		site: row.site,
		pallet: row.pallet,
		level: row.level,
		status: row.status,
		soldTo: row.sold_to,
		purpose: row.purpose
	});
	const level = requireLevel(data.level);
	const notice = await parkInBarn(sql, context.userId, row, data.pallet, level, from);
	return {
		place: unitPlaceLabel({
			site: "barn-back",
			pallet: data.pallet.trim().toUpperCase(),
			level,
			status: "ready"
		}),
		notice
	};
});
var lookupInput = object({ serial: string() });
var lookupUnitPlace_createServerFn_handler = createServerRpc({
	id: "c854c5e5b43313a3bb44ed47820775f74bd7c3c6bd1b5628eec146f2f3de3007",
	name: "lookupUnitPlace",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => lookupUnitPlace.__executeServer(opts));
var lookupUnitPlace = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => lookupInput.parse(d)).handler(lookupUnitPlace_createServerFn_handler, async ({ data }) => {
	return toPlace(await bySerial(await ready(), data.serial));
});
var setInput = object({
	serial: string().min(1),
	model: string().nullable().optional(),
	site: string(),
	pallet: string().nullable().optional(),
	level: number().int().nullable().optional(),
	otherLabel: string().nullable().optional()
});
var setUnitPlace_createServerFn_handler = createServerRpc({
	id: "e22ae01e87029011ee5e5e0575fd8972f4c4e2713dcb711e0ae981b0d3748276",
	name: "setUnitPlace",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => setUnitPlace.__executeServer(opts));
var setUnitPlace = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => setInput.parse(d)).handler(setUnitPlace_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const serial = data.serial.trim();
	if (!serialKey(serial)) throw new Error("Enter a serial so this stays one record.");
	const existing = await bySerial(sql, serial);
	if (placeMove(existing) === "blocked" && existing) throw new Error(`That serial is already allocated${existing.sold_to ? ` to ${existing.sold_to}` : ""}.`);
	if (data.site === "barn") throw new Error("Pick a rack.");
	const rack = barnRack(data.site);
	if (rack) {
		if (!data.pallet?.trim()) throw new Error("Pick a bay A through P");
		const level = requireLevel(data.level);
		if (existing) {
			await parkInBarn(sql, context.userId, existing, data.pallet, level, unitPlaceLabel({
				site: existing.site,
				pallet: existing.pallet,
				level: existing.level,
				status: existing.status,
				soldTo: existing.sold_to,
				purpose: existing.purpose
			}), rack);
			return toPlace(await byId(sql, existing.id));
		}
		const letter = data.pallet.trim().toUpperCase();
		const bayErr = rackBayError(rack, letter);
		if (bayErr) throw new Error(bayErr);
		await requireStock(sql, context.userId);
		const line = await openLine(sql, rack, letter, level);
		const id = (await sql.query(`insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status)
         values ('equip', $1, $2, 1, $3, $4, $5, $6, 'ready')
         returning id`, [
			data.model?.trim() || "Equipment",
			serial,
			rack,
			letter,
			level,
			line
		]))[0]?.id;
		if (!id) throw new Error("Could not add that unit");
		return toPlace(await byId(sql, id));
	}
	if (!isLocationSite(resolvePlaceSite(data.site))) throw new Error("Pick a location");
	if (existing) {
		await parkAtLocation(sql, context.userId, existing, data.site, null, data.otherLabel ?? null);
		return toPlace(await byId(sql, existing.id));
	}
	const dest = resolvePlaceSite(data.site);
	const label = (data.otherLabel ?? "").trim();
	if (dest === "other" && !label) throw new Error("Other needs a short label.");
	const id = (await sql.query(`insert into assets (kind, model, serial, qty, site, purpose, status)
       values ('equip', $1, $2, 1, $3, $4, 'deployed')
       returning id`, [
		data.model?.trim() || "Equipment",
		serial,
		dest,
		dest === "other" ? label : SITE_PURPOSE[dest] ?? null
	]))[0]?.id;
	if (!id) throw new Error("Could not add that unit");
	return toPlace(await byId(sql, id));
});
var assetPlaceInput = object({
	id: number().int().positive(),
	site: string(),
	pallet: string().nullable().optional(),
	level: number().int().nullable().optional(),
	otherLabel: string().nullable().optional(),
	swapWithId: number().int().positive().nullable().optional()
});
function statusAt(site, previous) {
	if (site === "barn-back" || site === "barn-front") return "ready";
	if (previous === "ready") return "deployed";
	return previous;
}
/** Exchange two units' places. Each serial stays its own record. */
async function swapAssetPlaces(sql, userId, mover, otherId, rack, pallet, level) {
	if (mover.id === otherId) throw new Error("Pick a different unit to swap.");
	const other = await byId(sql, otherId);
	const letter = pallet.trim().toUpperCase();
	if (!other || other.site !== rack || (other.pallet ?? "").toUpperCase() !== letter || Number(other.level) !== level) throw new Error("That unit is not in this section.");
	if (placeMove(mover) === "blocked") throw new Error(`That serial is already allocated${mover.sold_to ? ` to ${mover.sold_to}` : ""}.`);
	if (placeMove(other) === "blocked") throw new Error(`That serial is already allocated${other.sold_to ? ` to ${other.sold_to}` : ""}.`);
	const { assertNotHeld } = await import("./stock-actions--pD9Tc8c.mjs").then((n) => n.i);
	await assertNotHeld(sql, mover.id);
	await assertNotHeld(sql, other.id);
	await requireStock(sql, userId);
	const moverStatus = statusAt(other.site, other.status);
	const otherStatus = statusAt(mover.site, mover.status);
	await sql.query(`update assets set status = $2, site = $3, pallet = $4, level = $5, line_no = $6, updated_at = now() where id = $1`, [
		mover.id,
		moverStatus,
		other.site,
		other.pallet,
		other.level,
		other.line_no
	]);
	await sql.query(`update assets set status = $2, site = $3, pallet = $4, level = $5, line_no = $6, updated_at = now() where id = $1`, [
		other.id,
		otherStatus,
		mover.site,
		mover.pallet,
		mover.level,
		mover.line_no
	]);
	const moverFrom = unitPlaceLabel({
		site: mover.site,
		pallet: mover.pallet,
		level: mover.level,
		status: mover.status,
		soldTo: mover.sold_to,
		purpose: mover.purpose
	});
	const moverTo = unitPlaceLabel({
		site: other.site,
		pallet: other.pallet,
		level: other.level,
		status: moverStatus,
		soldTo: other.sold_to,
		purpose: other.purpose
	});
	const otherFrom = moverTo;
	const otherTo = unitPlaceLabel({
		site: mover.site,
		pallet: mover.pallet,
		level: mover.level,
		status: otherStatus,
		soldTo: mover.sold_to,
		purpose: mover.purpose
	});
	const moverNotice = await moveNotice(sql, userId, moverFrom, `${moverTo} (swapped with ${other.serial || other.model})`);
	const otherNotice = await moveNotice(sql, userId, otherFrom, `${otherTo} (swapped with ${mover.serial || mover.model})`);
	await sql.query("update assets set notes = $2 where id = $1", [mover.id, withNote(mover.notes, moverNotice)]);
	await sql.query("update assets set notes = $2 where id = $1", [other.id, withNote(other.notes, otherNotice)]);
	await logMove(sql, userId, mover.id, moverNotice);
	await logMove(sql, userId, other.id, otherNotice);
	const { flagRackArrival } = await import("./rack-stock-BKENc6gb.mjs").then((n) => n.n);
	if (isBarn(other.site)) await flagRackArrival(sql, userId, mover.id, {
		site: mover.site,
		pallet: mover.pallet,
		level: mover.level,
		line_no: mover.line_no,
		status: mover.status
	});
	if (isBarn(mover.site)) await flagRackArrival(sql, userId, other.id, {
		site: other.site,
		pallet: other.pallet,
		level: other.level,
		line_no: other.line_no,
		status: other.status
	});
}
var setAssetPlace_createServerFn_handler = createServerRpc({
	id: "423a323a5f7059e99afbe6a138fa5d75c7b349d28d8eb9eb974b9dae76a221ee",
	name: "setAssetPlace",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => setAssetPlace.__executeServer(opts));
var setAssetPlace = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assetPlaceInput.parse(d)).handler(setAssetPlace_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const row = await byId(sql, data.id);
	if (!row) throw new Error("Unit not found");
	if (data.site === "barn") throw new Error("Pick a rack.");
	const rack = barnRack(data.site);
	if (rack) {
		if (!data.pallet?.trim()) throw new Error("Pick a bay A through P");
		const level = requireLevel(data.level);
		if (data.swapWithId) {
			await swapAssetPlaces(sql, context.userId, row, data.swapWithId, rack, data.pallet, level);
			return toPlace(await byId(sql, row.id));
		}
		await parkInBarn(sql, context.userId, row, data.pallet, level, unitPlaceLabel({
			site: row.site,
			pallet: row.pallet,
			level: row.level,
			status: row.status,
			soldTo: row.sold_to,
			purpose: row.purpose
		}), rack);
		return toPlace(await byId(sql, row.id));
	}
	if (data.swapWithId) throw new Error("Replace/Swap is only for a rack section.");
	await parkAtLocation(sql, context.userId, row, data.site, null, data.otherLabel ?? null);
	return toPlace(await byId(sql, row.id));
});
var assetsPlaceInput = object({
	ids: array(number().int().positive()).min(1).max(60),
	site: string(),
	pallet: string().nullable().optional(),
	level: number().int().nullable().optional(),
	otherLabel: string().nullable().optional(),
	/** Units already in the destination section that trade places with the moved units. */
	swapIds: array(number().int().positive()).max(60).optional()
});
function placeLabelOf(row) {
	return unitPlaceLabel({
		site: row.site,
		pallet: row.pallet,
		level: row.level,
		status: row.status,
		soldTo: row.sold_to,
		purpose: row.purpose
	});
}
/**
* Move several units at once. With swapIds, the chosen units in the destination section
* go back to where the moved units came from: exact position trades first, then any
* extras park in the other section.
*/
var setAssetsPlace_createServerFn_handler = createServerRpc({
	id: "047cf99859b42ff4cc9bdc01d9166fea108de17835d6e325dd11bb9726bebf45",
	name: "setAssetsPlace",
	filename: "src/lib/ops/unit-place.ts"
}, (opts) => setAssetsPlace.__executeServer(opts));
var setAssetsPlace = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => assetsPlaceInput.parse(d)).handler(setAssetsPlace_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const ids = [...new Set(data.ids)];
	const swapIds = [...new Set(data.swapIds ?? [])].filter((id) => !ids.includes(id));
	const movers = [];
	for (const id of ids) {
		const row = await byId(sql, id);
		if (!row) throw new Error("One of the units was not found — refresh and try again.");
		movers.push(row);
	}
	if (data.site === "barn") throw new Error("Pick a rack.");
	const rack = barnRack(data.site);
	const failed = [];
	const name = (r) => r.serial || r.model;
	if (!rack) {
		if (swapIds.length) throw new Error("Replace/Swap is only for a rack section.");
		let moved = 0;
		for (const row of movers) try {
			await parkAtLocation(sql, context.userId, row, data.site, null, data.otherLabel ?? null);
			moved += 1;
		} catch (e) {
			failed.push(`${name(row)}: ${e instanceof Error ? e.message : "could not move"}`);
		}
		return {
			moved,
			swapped: 0,
			place: null,
			failed
		};
	}
	if (!data.pallet?.trim()) throw new Error("Pick a bay A through P");
	const level = requireLevel(data.level);
	const letter = data.pallet.trim().toUpperCase();
	const others = [];
	for (const id of swapIds) {
		const row = await byId(sql, id);
		if (!row || row.site !== rack || (row.pallet ?? "").toUpperCase() !== letter || Number(row.level) !== level) throw new Error("A unit picked to swap is no longer in that section — refresh and try again.");
		others.push(row);
	}
	if (others.length && !movers.some((m) => m.site === "barn-back" || m.site === "barn-front")) throw new Error("Swapped units need a rack to go back to. Move without Replace/Swap, or pick units that are on a rack.");
	let moved = 0;
	let swapped = 0;
	const pairs = Math.min(movers.length, others.length);
	for (let i = 0; i < pairs; i += 1) {
		const mover = movers[i];
		const other = others[i];
		try {
			if (mover.site !== "barn-back" && mover.site !== "barn-front") throw new Error("skip-pair");
			await swapAssetPlaces(sql, context.userId, mover, other.id, rack, letter, level);
			moved += 1;
			swapped += 1;
		} catch (e) {
			if (e instanceof Error && e.message === "skip-pair") continue;
			failed.push(`${name(mover)} ↔ ${name(other)}: ${e instanceof Error ? e.message : "could not swap"}`);
		}
	}
	const retry = [];
	const parkMover = async (id, lastTry) => {
		const fresh = await byId(sql, id);
		if (!fresh) return;
		if (fresh.site === rack && (fresh.pallet ?? "").toUpperCase() === letter && Number(fresh.level) === level) return;
		try {
			await parkInBarn(sql, context.userId, fresh, letter, level, placeLabelOf(fresh), rack);
			moved += 1;
		} catch (e) {
			const msg = e instanceof Error ? e.message : "could not move";
			if (!lastTry && /full/i.test(msg)) retry.push(id);
			else failed.push(`${name(fresh)}: ${msg}`);
		}
	};
	for (const mover of movers) await parkMover(mover.id, false);
	const home = movers.find((m) => m.site === "barn-back" || m.site === "barn-front");
	for (const other of others) {
		const fresh = await byId(sql, other.id);
		if (!fresh) continue;
		if (!(fresh.site === rack && (fresh.pallet ?? "").toUpperCase() === letter && Number(fresh.level) === level) || !home) continue;
		try {
			await parkInBarn(sql, context.userId, fresh, home.pallet ?? "", Number(home.level), placeLabelOf(fresh), home.site);
			swapped += 1;
		} catch (e) {
			failed.push(`${name(fresh)}: ${e instanceof Error ? e.message : "could not swap back"}`);
		}
	}
	for (const id of retry) await parkMover(id, true);
	const place = unitPlaceLabel({
		site: rack,
		pallet: letter,
		level,
		status: "ready"
	});
	return {
		moved,
		swapped,
		place,
		failed
	};
});
//#endregion
export { addUnitToLocation_createServerFn_handler, listBarnAvailable_createServerFn_handler, lookupUnitPlace_createServerFn_handler, moveUnitToBarn_createServerFn_handler, placeAssetsAtLocation_createServerFn_handler, setAssetPlace_createServerFn_handler, setAssetsPlace_createServerFn_handler, setUnitPlace_createServerFn_handler };
