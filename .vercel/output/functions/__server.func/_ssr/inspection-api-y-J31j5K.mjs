import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { r as getSql } from "./db-B30u4tE3.mjs";
import { a as matchCatalogModel, l as sameCatalogModel, u as serialKey } from "./account-equip-DMHHRLhM.mjs";
import { o as deskMiddleware } from "./access-Bds4AN6g.mjs";
import { hn as object, mn as number, sn as _enum, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { s as parseMachinesJson } from "./machines-kdzfuS7z.mjs";
import { S as spacePassError, _ as itemSaveError, c as categoryLabel, f as inspectionOverall, g as isSavableCategory, h as isInspectionItemStatus, i as INSPECTION_CATEGORIES, m as isInspectionCategory, n as CORE_HOLE_LABEL, p as isCoreHoleAnswer, s as categoryHint, t as CORE_HOLE_CATEGORY, u as failedItemLabels, y as rollupSite } from "./pre-inspection-C3xoeIXB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/inspection-api-y-J31j5K.js
var MAX_PHOTO = 18e5;
async function ready() {
	const { ensureSeeded } = await import("./seed.server-BYmYnsv0.mjs");
	await ensureSeeded();
	return getSql();
}
async function deskUsername(sql, userId) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}
function stamp(v) {
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
	return v == null ? "" : String(v);
}
function day(v) {
	if (v == null || v === "") return null;
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : null;
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
function piecesFrom(row) {
	const machines = parseMachinesJson(text(row.machines) || null);
	if (machines.length) return machines;
	const named = text(row.equipment).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
	return named.map((equipment) => ({
		equipment,
		serial: named.length === 1 ? text(row.serial) : "",
		powerVoltage: named.length === 1 ? text(row.power_voltage) : ""
	}));
}
function matchExisting(account, piece, used) {
	const key = serialKey(piece.serial);
	if (key) {
		const byBoth = account.find((a) => !used.has(a.id) && a.serial_key === key && sameCatalogModel(a.catalog_model, piece.equipment));
		if (byBoth) return byBoth;
		const bySerial = account.find((a) => !used.has(a.id) && a.serial_key === key);
		if (bySerial) return bySerial;
	}
	return account.find((a) => !used.has(a.id) && sameCatalogModel(a.catalog_model, piece.equipment) && !serialKey(a.serial) && !key);
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
async function ensureUnits(sql, installId) {
	if ((await sql.query("select equipment_id from install_inspection_units where install_id = $1", [installId])).length) return;
	const row = (await sql.query("select customer, equipment, serial, power_voltage, machines from installs where id = $1", [installId]))[0];
	if (!row) return;
	const pieces = piecesFrom(row);
	if (!pieces.length) return;
	const account = await sql.query(`select id, catalog_model, equipment_name, serial, serial_key, electrical
       from account_equipment where lower(customer) = lower($1) order by id`, [row.customer]);
	const used = /* @__PURE__ */ new Set();
	let first = null;
	for (const piece of pieces) {
		let id = matchExisting(account, piece, used)?.id;
		if (!id) {
			id = await insertEquipment(sql, row.customer, piece.equipment, piece.serial || null, piece.powerVoltage || null);
			account.push({
				id,
				catalog_model: piece.equipment,
				equipment_name: piece.equipment,
				serial: piece.serial || null,
				serial_key: serialKey(piece.serial) || null,
				electrical: piece.powerVoltage || null
			});
		}
		used.add(id);
		if (!first) first = id;
		await linkUnit(sql, installId, id);
	}
	if (first) {
		await sql.query(`update install_inspection_items set equipment_id = $1 where install_id = $2 and equipment_id is null`, [first, installId]);
		await sql.query(`update install_inspection_photos set equipment_id = $1 where install_id = $2 and equipment_id is null`, [first, installId]);
	}
}
async function ensureHead(sql, installId) {
	await sql.query(`insert into install_inspections (install_id) values ($1) on conflict (install_id) do nothing`, [installId]);
}
function mapPhoto(r) {
	const category = String(r.category ?? "");
	if (!isSavableCategory(category) || !r.equipment_id || !r.id) return null;
	return {
		id: Number(r.id),
		equipmentId: r.equipment_id,
		category,
		caption: r.caption ?? null,
		dataUrl: String(r.data_url ?? ""),
		uploadedBy: r.uploaded_by ?? null,
		uploadedAt: stamp(r.uploaded_at)
	};
}
async function readInspection(sql, installId) {
	const install = await sql.query("select id, customer from installs where id = $1 and archived = false", [installId]);
	if (!install[0]) return null;
	await ensureUnits(sql, installId);
	const [head, units, items, photos] = await Promise.all([
		sql.query(`select inspector, inspected_on, site_contact, notes, override_reason, override_by
         from install_inspections where install_id = $1`, [installId]),
		sql.query(`select u.equipment_id, a.catalog_model, a.equipment_name, a.serial, a.electrical, u.core_needed
         from install_inspection_units u
         join account_equipment a on a.id = u.equipment_id
        where u.install_id = $1
        order by a.id`, [installId]),
		sql.query(`select install_id, equipment_id, category, status, notes
         from install_inspection_items where install_id = $1`, [installId]),
		sql.query(`select id, install_id, equipment_id, category, caption, data_url, uploaded_by, uploaded_at
         from install_inspection_photos where install_id = $1 order by uploaded_at, id`, [installId])
	]);
	const mapped = photos.map(mapPhoto).filter((p) => !!p);
	const h = head[0];
	const machines = units.map((u) => {
		const unitItems = items.filter((i) => i.equipment_id === u.equipment_id);
		const unitPhotos = mapped.filter((p) => p.equipmentId === u.equipment_id);
		const inputs = unitItems.map((i) => ({
			category: i.category,
			status: i.status
		}));
		const coreNeeded = isCoreHoleAnswer(u.core_needed) ? u.core_needed : null;
		const overall = inspectionOverall(inputs, coreNeeded);
		const model = u.equipment_name || u.catalog_model;
		const coreRow = unitItems.find((i) => i.category === CORE_HOLE_CATEGORY);
		const coreStatus = isInspectionItemStatus(coreRow?.status) ? coreRow.status : "Not inspected";
		return {
			equipmentId: u.equipment_id,
			name: model,
			model: u.catalog_model || model,
			serial: u.serial,
			electrical: u.electrical,
			overall,
			failedItems: failedItemLabels(inputs, coreNeeded),
			photoCount: unitPhotos.length,
			thumb: unitPhotos[0]?.dataUrl ?? null,
			coreNeeded,
			core: {
				category: CORE_HOLE_CATEGORY,
				label: CORE_HOLE_LABEL,
				hint: categoryHint(CORE_HOLE_CATEGORY, {
					model,
					electrical: u.electrical
				}),
				status: coreStatus,
				notes: coreRow?.notes ?? null,
				photos: unitPhotos.filter((p) => p.category === CORE_HOLE_CATEGORY)
			},
			items: INSPECTION_CATEGORIES.map((c) => {
				const row = unitItems.find((i) => i.category === c.key);
				const status = isInspectionItemStatus(row?.status) ? row.status : "Not inspected";
				return {
					category: c.key,
					label: c.label,
					hint: categoryHint(c.key, {
						model,
						electrical: u.electrical
					}),
					status,
					notes: row?.notes ?? null,
					photos: unitPhotos.filter((p) => p.category === c.key)
				};
			})
		};
	});
	const summary = rollupSite(machines.map((m) => ({
		items: items.filter((i) => i.equipment_id === m.equipmentId).map((i) => ({
			category: i.category,
			status: i.status
		})),
		photoCount: m.photoCount,
		coreNeeded: m.coreNeeded
	})), h?.override_reason);
	return {
		installId,
		customer: install[0].customer,
		...summary,
		inspector: h?.inspector ?? null,
		inspectedOn: day(h?.inspected_on),
		siteContact: h?.site_contact ?? null,
		notes: h?.notes ?? null,
		overrideBy: h?.override_by ?? null,
		machines
	};
}
async function requireInstall(sql, installId) {
	const install = await sql.query("select id, customer from installs where id = $1 and archived = false", [installId]);
	if (!install[0]) throw new Error("Install not found");
	return install[0];
}
async function requireUnit(sql, installId, equipmentId) {
	if (!(await sql.query("select equipment_id from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, equipmentId]))[0]) throw new Error("That machine is not on this visit.");
}
var idInput = object({ installId: number().int().positive() });
var getInstallInspection_createServerFn_handler = createServerRpc({
	id: "fcb138be46c36e675d38a8db2afca32e3042714b5000e9bc32de5c509085767b",
	name: "getInstallInspection",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => getInstallInspection.__executeServer(opts));
var getInstallInspection = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => idInput.parse(d)).handler(getInstallInspection_createServerFn_handler, async ({ data }) => {
	const view = await readInspection(await ready(), data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
var itemInput = object({
	installId: number().int().positive(),
	equipmentId: number().int().positive(),
	category: string(),
	status: string(),
	notes: string().nullable().optional()
});
var saveInspectionItem_createServerFn_handler = createServerRpc({
	id: "c13bfcc95ed39debfc612bd0dba5fa7e126c458587511dad745dd410bf38e1a7",
	name: "saveInspectionItem",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => saveInspectionItem.__executeServer(opts));
var saveInspectionItem = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => itemInput.parse(d)).handler(saveInspectionItem_createServerFn_handler, async ({ data }) => {
	if (!isSavableCategory(data.category)) throw new Error("Unknown checklist item.");
	if (!isInspectionItemStatus(data.status)) throw new Error("Pick a status.");
	const sql = await ready();
	await requireInstall(sql, data.installId);
	await ensureUnits(sql, data.installId);
	await requireUnit(sql, data.installId, data.equipmentId);
	const photos = await sql.query(`select count(*)::int as n from install_inspection_photos
        where install_id = $1 and equipment_id = $2 and category = $3`, [
		data.installId,
		data.equipmentId,
		data.category
	]);
	const notes = data.notes ?? null;
	const photoCount = Number(photos[0]?.n) || 0;
	if (data.category === "space") {
		const unit = await sql.query(`select core_needed from install_inspection_units where install_id = $1 and equipment_id = $2`, [data.installId, data.equipmentId]);
		const err = spacePassError({
			status: data.status,
			notes,
			photoCount,
			coreNeeded: unit[0]?.core_needed
		});
		if (err) throw new Error(err);
	} else {
		const err = itemSaveError({
			status: data.status,
			notes,
			photoCount
		});
		if (err) throw new Error(err);
	}
	await ensureHead(sql, data.installId);
	await sql.query(`insert into install_inspection_items (install_id, equipment_id, category, status, notes)
       values ($1, $2, $3, $4, $5)
       on conflict (install_id, equipment_id, category)
       do update set status = excluded.status, notes = excluded.notes, updated_at = now()`, [
		data.installId,
		data.equipmentId,
		data.category,
		data.status,
		notes?.trim() || null
	]);
	const view = await readInspection(sql, data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
var coreInput = object({
	installId: number().int().positive(),
	equipmentId: number().int().positive(),
	answer: _enum(["yes", "no"])
});
var saveInspectionCoreHole_createServerFn_handler = createServerRpc({
	id: "5597bebbc43b46780ed9ca5b57e6d0f058593df21c38153c1acbab0be9c16df9",
	name: "saveInspectionCoreHole",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => saveInspectionCoreHole.__executeServer(opts));
var saveInspectionCoreHole = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => coreInput.parse(d)).handler(saveInspectionCoreHole_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	await requireInstall(sql, data.installId);
	await ensureUnits(sql, data.installId);
	await requireUnit(sql, data.installId, data.equipmentId);
	await sql.query(`update install_inspection_units set core_needed = $3 where install_id = $1 and equipment_id = $2`, [
		data.installId,
		data.equipmentId,
		data.answer
	]);
	const view = await readInspection(sql, data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
var metaInput = object({
	installId: number().int().positive(),
	inspector: string().nullable().optional(),
	inspectedOn: string().nullable().optional(),
	siteContact: string().nullable().optional(),
	notes: string().nullable().optional(),
	overrideReason: string().nullable().optional()
});
var saveInspectionMeta_createServerFn_handler = createServerRpc({
	id: "aa2f27e21b6668b54a08d0b363a1afedf084a49b1c7d7a195f72b08b68443e3c",
	name: "saveInspectionMeta",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => saveInspectionMeta.__executeServer(opts));
var saveInspectionMeta = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => metaInput.parse(d)).handler(saveInspectionMeta_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireInstall(sql, data.installId);
	await ensureHead(sql, data.installId);
	const sets = [];
	const params = [];
	const add = (col, value) => {
		params.push(value);
		sets.push(`${col} = $${params.length}`);
	};
	if (data.inspector !== void 0) add("inspector", data.inspector?.trim() || null);
	if (data.inspectedOn !== void 0) add("inspected_on", day(data.inspectedOn));
	if (data.siteContact !== void 0) add("site_contact", data.siteContact?.trim() || null);
	if (data.notes !== void 0) add("notes", data.notes?.trim() || null);
	if (data.overrideReason !== void 0) {
		const reason = data.overrideReason?.trim() || null;
		add("override_reason", reason);
		add("override_by", reason ? await deskUsername(sql, context.userId) : null);
	}
	if (sets.length) {
		params.push(data.installId);
		await sql.query(`update install_inspections set ${sets.join(", ")}, updated_at = now() where install_id = $${params.length}`, params);
	}
	const view = await readInspection(sql, data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
var photoInput = object({
	installId: number().int().positive(),
	equipmentId: number().int().positive(),
	category: string(),
	dataUrl: string().min(32),
	caption: string().nullable().optional()
});
var addInspectionPhoto_createServerFn_handler = createServerRpc({
	id: "50f3a51424d20b683e48516f64c52262e309494e96d5785291293467940eabb2",
	name: "addInspectionPhoto",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => addInspectionPhoto.__executeServer(opts));
var addInspectionPhoto = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => photoInput.parse(d)).handler(addInspectionPhoto_createServerFn_handler, async ({ data, context }) => {
	if (!isSavableCategory(data.category)) throw new Error("Unknown checklist item.");
	if (!data.dataUrl.startsWith("data:image/")) throw new Error("Upload a photo.");
	if (data.dataUrl.length > MAX_PHOTO) throw new Error("Photo is too large. Try a smaller image.");
	const sql = await ready();
	await requireInstall(sql, data.installId);
	await ensureUnits(sql, data.installId);
	await requireUnit(sql, data.installId, data.equipmentId);
	const count = await sql.query(`select count(*)::int as n from install_inspection_photos
        where install_id = $1 and equipment_id = $2 and category = $3`, [
		data.installId,
		data.equipmentId,
		data.category
	]);
	if ((Number(count[0]?.n) || 0) >= 12) throw new Error(`12 photos is the limit for ${categoryLabel(data.category)}.`);
	await ensureHead(sql, data.installId);
	const mime = data.dataUrl.slice(5, data.dataUrl.indexOf(";")) || "image/jpeg";
	await sql.query(`insert into install_inspection_photos
         (install_id, equipment_id, category, caption, mime, data_url, uploaded_by)
       values ($1, $2, $3, $4, $5, $6, $7)`, [
		data.installId,
		data.equipmentId,
		data.category,
		data.caption?.trim() || null,
		mime,
		data.dataUrl,
		await deskUsername(sql, context.userId)
	]);
	const view = await readInspection(sql, data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
var removePhotoInput = object({
	installId: number().int().positive(),
	photoId: number().int().positive()
});
var removeInspectionPhoto_createServerFn_handler = createServerRpc({
	id: "6957c78daf68c70212899a817926938689d7e458753829416708268b48c06912",
	name: "removeInspectionPhoto",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => removeInspectionPhoto.__executeServer(opts));
var removeInspectionPhoto = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => removePhotoInput.parse(d)).handler(removeInspectionPhoto_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	await sql.query("delete from install_inspection_photos where id = $1 and install_id = $2", [data.photoId, data.installId]);
	const view = await readInspection(sql, data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
var addEquipInput = object({
	installId: number().int().positive(),
	model: string().min(1),
	serial: string().nullable().optional(),
	electrical: string().nullable().optional()
});
var addInspectionEquipment_createServerFn_handler = createServerRpc({
	id: "7a8456958e7ee0d6d9527aacfe902ec05a25a65ea1e0fefa3fb86f4e03876368",
	name: "addInspectionEquipment",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => addInspectionEquipment.__executeServer(opts));
var addInspectionEquipment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => addEquipInput.parse(d)).handler(addInspectionEquipment_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const install = await requireInstall(sql, data.installId);
	await ensureUnits(sql, data.installId);
	const key = serialKey(data.serial);
	if (key) {
		const existing = await sql.query(`select id from account_equipment where lower(customer) = lower($1) and serial_key = $2`, [install.customer, key]);
		if (existing[0]) {
			if ((await sql.query("select equipment_id from install_inspection_units where install_id = $1 and equipment_id = $2", [data.installId, existing[0].id]))[0]) throw new Error("That serial is already on this visit.");
			await linkUnit(sql, data.installId, existing[0].id);
			const view = await readInspection(sql, data.installId);
			if (!view) throw new Error("Install not found");
			return view;
		}
	}
	const id = await insertEquipment(sql, install.customer, data.model, data.serial ?? null, data.electrical ?? null);
	await linkUnit(sql, data.installId, id);
	const view = await readInspection(sql, data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
var copyInput = object({
	installId: number().int().positive(),
	fromEquipmentId: number().int().positive(),
	toEquipmentId: number().int().positive()
});
var copyInspectionNa_createServerFn_handler = createServerRpc({
	id: "a773af33364aab76381bdb9f1f9d43c0da1e5ced63832aff930685d90c1eb96d",
	name: "copyInspectionNa",
	filename: "src/lib/ops/inspection-api.ts"
}, (opts) => copyInspectionNa.__executeServer(opts));
var copyInspectionNa = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => copyInput.parse(d)).handler(copyInspectionNa_createServerFn_handler, async ({ data }) => {
	if (data.fromEquipmentId === data.toEquipmentId) throw new Error("Pick a different machine.");
	const sql = await ready();
	await requireInstall(sql, data.installId);
	await requireUnit(sql, data.installId, data.fromEquipmentId);
	await requireUnit(sql, data.installId, data.toEquipmentId);
	const source = await sql.query(`select category, status, notes from install_inspection_items
        where install_id = $1 and equipment_id = $2 and status = 'N/A'`, [data.installId, data.fromEquipmentId]);
	if (!source.length) throw new Error("That machine has no N/A lines to copy.");
	const target = await sql.query(`select category, status from install_inspection_items where install_id = $1 and equipment_id = $2`, [data.installId, data.toEquipmentId]);
	await ensureHead(sql, data.installId);
	for (const row of source) {
		if (row.category === "core") continue;
		if (!isInspectionCategory(row.category)) continue;
		const current = target.find((t) => t.category === row.category);
		if (current && current.status !== "Not inspected") continue;
		await sql.query(`insert into install_inspection_items (install_id, equipment_id, category, status, notes)
         values ($1, $2, $3, 'N/A', $4)
         on conflict (install_id, equipment_id, category)
         do update set status = 'N/A', notes = excluded.notes, updated_at = now()
         where install_inspection_items.status = 'Not inspected'`, [
			data.installId,
			data.toEquipmentId,
			row.category,
			row.notes
		]);
	}
	const view = await readInspection(sql, data.installId);
	if (!view) throw new Error("Install not found");
	return view;
});
//#endregion
export { addInspectionEquipment_createServerFn_handler, addInspectionPhoto_createServerFn_handler, copyInspectionNa_createServerFn_handler, getInstallInspection_createServerFn_handler, removeInspectionPhoto_createServerFn_handler, saveInspectionCoreHole_createServerFn_handler, saveInspectionItem_createServerFn_handler, saveInspectionMeta_createServerFn_handler };
