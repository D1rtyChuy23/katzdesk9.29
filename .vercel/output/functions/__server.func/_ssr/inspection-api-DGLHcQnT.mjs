import { n as createServerFn } from "./ssr.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { a as matchCatalogModel, l as sameCatalogModel, u as serialKey } from "./account-equip-pqzlCVTH.mjs";
import { hn as object, mn as number, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { i as listedEquipment, s as parseMachinesJson } from "./machines-DhXaCUhX.mjs";
import { b as rollupSite, f as inspectionOverall, g as isInspectionItemStatus, l as emptyInspection, m as isCoreHoleAnswer, t as CORE_HOLE_CATEGORY } from "./pre-inspection-XP9-2z1S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/inspection-api-DGLHcQnT.js
function idList(ids) {
	return [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))].join(",");
}
function text(v) {
	if (v == null) return "";
	if (typeof v === "string") return v;
	try {
		return JSON.stringify(v);
	} catch {
		return "";
	}
}
/**
* One piece per machine, split the same way the install's Equipment section splits it
* (catalog-aware), so "Linea / Swift / Axiom-APS" on one line is three machines, not one.
*/
function piecesFrom(row, catalog = []) {
	const machines = parseMachinesJson(text(row.machines) || null);
	if (machines.length) return machines;
	const named = listedEquipment(text(row.equipment), catalog);
	return named.map((equipment) => ({
		equipment,
		serial: named.length === 1 ? text(row.serial) : "",
		powerVoltage: named.length === 1 ? text(row.power_voltage) : ""
	}));
}
async function catalogNames(sql) {
	return (await sql.query(`select name from directory_equipment where archived = false and coalesce(name, '') <> ''`).catch(() => [])).map((r) => r.name);
}
async function insertEquipment(sql, customer, model, serial, electrical) {
	const names = await catalogNames(sql);
	const catalogModel = matchCatalogModel(model, model, names).catalogModel || model.trim();
	const key = serialKey(serial) || null;
	const id = (await sql.query(`insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, electrical)
     values ($1, $2, $3, $4, $5, $6)
     returning id`, [
		customer,
		catalogModel,
		model.trim() || catalogModel,
		serial?.trim() || null,
		key,
		electrical?.trim() || null
	]))[0]?.id;
	if (!id) throw new Error("Could not add equipment");
	return id;
}
async function linkUnit(sql, installId, equipmentId) {
	await sql.query(`insert into install_inspection_units (install_id, equipment_id) values ($1, $2) on conflict do nothing`, [installId, equipmentId]);
}
async function writePieceFields(sql, hit, piece) {
	const serial = piece.serial.trim();
	const power = piece.powerVoltage.trim();
	let nextSerial = hit.serial;
	let nextKey = hit.serial_key;
	if (serial && !serialKey(hit.serial)) {
		const key = serialKey(serial);
		const clash = key ? await sql.query("select id from account_equipment where serial_key = $1 and id <> $2 limit 1", [key, hit.id]) : [];
		if (key && !clash[0]) {
			nextSerial = serial;
			nextKey = key;
		}
	}
	const nextPower = power || hit.electrical;
	const serialChanged = (nextSerial ?? null) !== (hit.serial ?? null);
	const powerChanged = !!power && power !== (hit.electrical ?? "");
	if (!serialChanged && !powerChanged) return;
	await sql.query("update account_equipment set serial = $2, serial_key = $3, electrical = $4 where id = $1", [
		hit.id,
		nextSerial,
		nextKey,
		nextPower
	]);
	hit.serial = nextSerial;
	hit.serial_key = nextKey;
	hit.electrical = nextPower;
}
function claimUnit(piece, pools, used) {
	const key = serialKey(piece.serial);
	if (key) for (const pool of pools) {
		const hit = pool.find((a) => !used.has(a.id) && a.serial_key === key);
		if (hit) return hit;
	}
	for (const pool of pools) {
		const hit = pool.find((a) => !used.has(a.id) && sameCatalogModel(a.catalog_model, piece.equipment) && !serialKey(a.serial));
		if (hit) return hit;
	}
}
async function unitPassed(sql, installId, equipmentId) {
	const [items, unit] = await Promise.all([sql.query("select category, status from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, equipmentId]), sql.query("select core_needed from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, equipmentId])]);
	return inspectionOverall(items, unit[0]?.core_needed) === "Passed";
}
/** Add install machines to pre-inspection. Prune only when the install equipment list was saved. */
async function syncInstallUnits(sql, installId, opts) {
	const row = (await sql.query("select customer, equipment, serial, power_voltage, machines from installs where id = $1", [installId]))[0];
	if (!row) return;
	const catalog = await catalogNames(sql);
	const pieces = piecesFrom(row, catalog);
	/** A unit saved under the whole one-line list ("Linea / Swift / Axiom") before machines were split. */
	const combined = (a) => listedEquipment(a.equipment_name, catalog).length > 1;
	const account = await sql.query(`select id, catalog_model, equipment_name, serial, serial_key, electrical
       from account_equipment where lower(customer) = lower($1) order by id`, [row.customer]);
	const links = await sql.query("select equipment_id from install_inspection_units where install_id = $1", [installId]);
	const linkedIds = new Set(links.map((l) => l.equipment_id));
	const linkedRows = account.filter((a) => linkedIds.has(a.id));
	const used = /* @__PURE__ */ new Set();
	const keep = /* @__PURE__ */ new Set();
	let first = null;
	for (const piece of pieces) {
		let hit = claimUnit(piece, [linkedRows, account], used);
		if (!hit) {
			const old = linkedRows.find((a) => !used.has(a.id) && combined(a) && listedEquipment(a.equipment_name, catalog).some((n) => sameCatalogModel(n, piece.equipment)));
			if (old) {
				old.catalog_model = matchCatalogModel(piece.equipment, piece.equipment, catalog).catalogModel || piece.equipment;
				old.equipment_name = piece.equipment;
				await sql.query("update account_equipment set catalog_model = $2, equipment_name = $3 where id = $1", [
					old.id,
					old.catalog_model,
					old.equipment_name
				]);
				hit = old;
			}
		}
		if (hit && combined(hit)) {
			hit.equipment_name = piece.equipment;
			await sql.query("update account_equipment set equipment_name = $2 where id = $1", [hit.id, piece.equipment]);
		}
		let id = hit?.id;
		if (!id) {
			id = await insertEquipment(sql, row.customer, piece.equipment, piece.serial || null, piece.powerVoltage || null);
			hit = {
				id,
				catalog_model: piece.equipment,
				equipment_name: piece.equipment,
				serial: piece.serial || null,
				serial_key: serialKey(piece.serial) || null,
				electrical: piece.powerVoltage || null
			};
			account.push(hit);
		} else if (hit) await writePieceFields(sql, hit, piece);
		used.add(id);
		keep.add(id);
		if (!first) first = id;
		await linkUnit(sql, installId, id);
	}
	if (first) {
		await sql.query(`update install_inspection_items set equipment_id = $1 where install_id = $2 and equipment_id is null`, [first, installId]);
		await sql.query(`update install_inspection_photos set equipment_id = $1 where install_id = $2 and equipment_id is null`, [first, installId]);
	}
	for (const a of linkedRows) {
		if (keep.has(a.id) || !combined(a) || serialKey(a.serial)) continue;
		if ((await sql.query(`select 1 from install_inspection_items where install_id = $2 and equipment_id = $1 and (status <> 'Not inspected' or coalesce(notes, '') <> '')
       union all select 1 from install_inspection_photos where install_id = $2 and equipment_id = $1 limit 1`, [a.id, installId])).length) continue;
		await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, a.id]);
		await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, a.id]);
		linkedIds.delete(a.id);
	}
	if (!opts?.prune) return;
	for (const id of linkedIds) {
		if (keep.has(id)) continue;
		if (await unitPassed(sql, installId, id)) continue;
		await sql.query("delete from install_inspection_photos where install_id = $1 and equipment_id = $2", [installId, id]);
		await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, id]);
		await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, id]);
	}
}
async function ensureUnits(sql, installId) {
	await syncInstallUnits(sql, installId);
}
function machineGroups(items) {
	const map = /* @__PURE__ */ new Map();
	for (const row of items) {
		if (!row.equipment_id) continue;
		const key = `${row.install_id}:${row.equipment_id}`;
		const list = map.get(key) ?? [];
		list.push(row);
		map.set(key, list);
	}
	return map;
}
async function loadInspectionSummaries(sql, ids) {
	const map = /* @__PURE__ */ new Map();
	const list = idList(ids);
	if (!list) return map;
	const linked = await sql.query(`select distinct install_id from install_inspection_units where install_id in (${list})`).catch(() => []);
	const have = new Set(linked.map((r) => r.install_id));
	for (const id of ids) if (!have.has(id)) await ensureUnits(sql, id).catch(() => void 0);
	const [units, items, photos, heads] = await Promise.all([
		sql.query(`select install_id, equipment_id, core_needed from install_inspection_units where install_id in (${list})`),
		sql.query(`select install_id, equipment_id, category, status from install_inspection_items where install_id in (${list})`),
		sql.query(`select install_id, equipment_id, count(*)::int as n
         from install_inspection_photos where install_id in (${list})
        group by install_id, equipment_id`),
		sql.query(`select install_id, override_reason from install_inspections where install_id in (${list})`)
	]);
	const grouped = machineGroups(items);
	const photoByUnit = new Map(photos.map((p) => [`${p.install_id}:${p.equipment_id}`, Number(p.n) || 0]));
	const overrides = new Map(heads.map((h) => [h.install_id, h.override_reason]));
	const byInstall = /* @__PURE__ */ new Map();
	for (const unit of units) {
		const key = `${unit.install_id}:${unit.equipment_id}`;
		const listItems = (grouped.get(key) ?? []).map((i) => ({
			category: i.category,
			status: i.status
		}));
		const machines = byInstall.get(unit.install_id) ?? [];
		machines.push({
			items: listItems,
			photoCount: photoByUnit.get(key) ?? 0,
			coreNeeded: isCoreHoleAnswer(unit.core_needed) ? unit.core_needed : null
		});
		byInstall.set(unit.install_id, machines);
	}
	for (const id of /* @__PURE__ */ new Set([...byInstall.keys(), ...overrides.keys()])) map.set(id, rollupSite(byInstall.get(id) ?? [], overrides.get(id)));
	return map;
}
async function loadInspectionUnits(sql, ids) {
	const list = idList(ids);
	if (!list) return [];
	await loadInspectionSummaries(sql, ids);
	const [units, items, photos] = await Promise.all([
		sql.query(`select u.install_id, u.equipment_id, a.catalog_model, a.equipment_name, a.serial, a.electrical, u.core_needed
         from install_inspection_units u
         join account_equipment a on a.id = u.equipment_id
        where u.install_id in (${list})
        order by u.install_id, a.id`),
		sql.query(`select install_id, equipment_id, category, status from install_inspection_items where install_id in (${list})`),
		sql.query(`select install_id, equipment_id, count(*)::int as n
         from install_inspection_photos where install_id in (${list})
        group by install_id, equipment_id`)
	]);
	const grouped = machineGroups(items);
	const photoByUnit = new Map(photos.map((p) => [`${p.install_id}:${p.equipment_id}`, Number(p.n) || 0]));
	return units.map((u) => {
		const key = `${u.install_id}:${u.equipment_id}`;
		const rows = grouped.get(key) ?? [];
		const unitItems = rows.map((i) => ({
			category: i.category,
			status: i.status
		}));
		const coreNeeded = isCoreHoleAnswer(u.core_needed) ? u.core_needed : null;
		const summary = rollupSite([{
			items: unitItems,
			photoCount: photoByUnit.get(key) ?? 0,
			coreNeeded
		}], null);
		const one = summary.machineCount ? inspectionOverall(unitItems, coreNeeded) : "Not started";
		const coreRow = rows.find((i) => i.category === CORE_HOLE_CATEGORY);
		return {
			installId: u.install_id,
			equipmentId: u.equipment_id,
			model: u.equipment_name || u.catalog_model,
			serial: u.serial,
			electrical: u.electrical,
			overall: one,
			failedItems: summary.failedItems,
			photoCount: photoByUnit.get(key) ?? 0,
			coreNeeded,
			coreStatus: coreNeeded === "yes" ? isInspectionItemStatus(coreRow?.status) ? coreRow.status : "Not inspected" : null
		};
	});
}
async function withInspections(sql, rows) {
	const map = await loadInspectionSummaries(sql, rows.map((r) => r.id));
	return rows.map((r) => ({
		...r,
		inspection: map.get(r.id) ?? emptyInspection()
	}));
}
var idInput = object({ installId: number().int().positive() });
var getInstallInspection = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => idInput.parse(d)).handler(createSsrRpc("fcb138be46c36e675d38a8db2afca32e3042714b5000e9bc32de5c509085767b"));
var itemInput = object({
	installId: number().int().positive(),
	equipmentId: number().int().positive(),
	category: string(),
	status: string(),
	notes: string().nullable().optional()
});
var saveInspectionItem = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => itemInput.parse(d)).handler(createSsrRpc("c13bfcc95ed39debfc612bd0dba5fa7e126c458587511dad745dd410bf38e1a7"));
var coreInput = object({
	installId: number().int().positive(),
	equipmentId: number().int().positive(),
	answer: _enum(["yes", "no"])
});
var saveInspectionCoreHole = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => coreInput.parse(d)).handler(createSsrRpc("5597bebbc43b46780ed9ca5b57e6d0f058593df21c38153c1acbab0be9c16df9"));
var metaInput = object({
	installId: number().int().positive(),
	inspector: string().nullable().optional(),
	inspectedOn: string().nullable().optional(),
	siteContact: string().nullable().optional(),
	notes: string().nullable().optional(),
	overrideReason: string().nullable().optional()
});
var saveInspectionMeta = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => metaInput.parse(d)).handler(createSsrRpc("aa2f27e21b6668b54a08d0b363a1afedf084a49b1c7d7a195f72b08b68443e3c"));
var photoInput = object({
	installId: number().int().positive(),
	equipmentId: number().int().positive(),
	category: string(),
	dataUrl: string().min(32),
	caption: string().nullable().optional()
});
var addInspectionPhoto = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => photoInput.parse(d)).handler(createSsrRpc("50f3a51424d20b683e48516f64c52262e309494e96d5785291293467940eabb2"));
var removePhotoInput = object({
	installId: number().int().positive(),
	photoId: number().int().positive()
});
var removeInspectionPhoto = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => removePhotoInput.parse(d)).handler(createSsrRpc("6957c78daf68c70212899a817926938689d7e458753829416708268b48c06912"));
var addEquipInput = object({
	installId: number().int().positive(),
	model: string().min(1),
	serial: string().nullable().optional(),
	electrical: string().nullable().optional()
});
var addInspectionEquipment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addEquipInput.parse(d)).handler(createSsrRpc("7a8456958e7ee0d6d9527aacfe902ec05a25a65ea1e0fefa3fb86f4e03876368"));
var copyInput = object({
	installId: number().int().positive(),
	fromEquipmentId: number().int().positive(),
	toEquipmentId: number().int().positive()
});
var copyInspectionNa = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => copyInput.parse(d)).handler(createSsrRpc("a773af33364aab76381bdb9f1f9d43c0da1e5ced63832aff930685d90c1eb96d"));
//#endregion
export { loadInspectionSummaries as a, saveInspectionCoreHole as c, syncInstallUnits as d, withInspections as f, getInstallInspection as i, saveInspectionItem as l, addInspectionPhoto as n, loadInspectionUnits as o, copyInspectionNa as r, removeInspectionPhoto as s, addInspectionEquipment as t, saveInspectionMeta as u };
