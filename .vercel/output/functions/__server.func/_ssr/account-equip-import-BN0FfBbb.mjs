import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { r as getSql } from "./db-B30u4tE3.mjs";
import { t as isWalkIn } from "./customer-key-BKZJDViL.mjs";
import { a as matchCatalogModel, c as parseSerial, i as matchAccount, o as matchExistingUnit, r as mapOwnership, s as parseInstallDate, t as OWNERSHIP_VALUES, u as serialKey } from "./account-equip-DMHHRLhM.mjs";
import { o as deskMiddleware } from "./access-Bds4AN6g.mjs";
import { i as normalizeHeader } from "./corrigo-D4iGSjgV.mjs";
import { hn as object, ln as array, mn as number, sn as _enum, un as boolean, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as utils, t as readSync } from "../_libs/xlsx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/account-equip-import-BN0FfBbb.js
var HEADER_KEYS = {
	"customer name": "customer",
	customer: "customer",
	account: "customer",
	"account name": "customer",
	"equipment name": "equipmentName",
	equipment: "equipmentName",
	"equip name": "equipmentName",
	name: "equipmentName",
	model: "model",
	"model name": "model",
	"model no": "model",
	"model number": "model",
	serial: "serial",
	"serial no": "serial",
	"serial number": "serial",
	"installation date": "installDate",
	"install date": "installDate",
	"date installed": "installDate",
	installed: "installDate",
	"electrical configuration": "electrical",
	electrical: "electrical",
	configuration: "electrical",
	config: "electrical",
	ownership: "ownership",
	owned: "ownership",
	owner: "ownership"
};
var ready = async () => {
	const { ensureSeeded } = await import("./seed.server-BYmYnsv0.mjs");
	await ensureSeeded();
	return getSql();
};
function stringifyCell(v) {
	if (v == null || v === "") return "";
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	if (typeof v === "number" && Number.isFinite(v)) {
		if (Number.isInteger(v)) return String(v);
		const rounded = Math.round(v);
		if (Math.abs(v - rounded) < 1e-6) return String(rounded);
	}
	const s = String(v);
	if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
	return s;
}
function fileToMatrix(base64) {
	const wb = readSync(base64, {
		type: "base64",
		cellDates: true,
		raw: false
	});
	const name = wb.SheetNames[0];
	if (!name) throw new Error("The file has no sheets.");
	const sheet = wb.Sheets[name];
	if (!sheet) throw new Error("The file has no sheets.");
	return utils.sheet_to_json(sheet, {
		header: 1,
		defval: "",
		blankrows: false
	}).map((row) => (row ?? []).map(stringifyCell));
}
function mapRow(headers, cells) {
	const rec = {
		customer: "",
		equipmentName: "",
		model: "",
		serial: "",
		installDate: "",
		electrical: "",
		ownership: ""
	};
	headers.forEach((col, i) => {
		if (!col) return;
		const v = (cells[i] ?? "").trim();
		if (v && !rec[col]) rec[col] = v;
	});
	return rec;
}
function parseMatrix(matrix) {
	let headerIdx = 0;
	let mapped = [];
	for (let i = 0; i < Math.min(matrix.length, 8); i++) {
		const cols = (matrix[i] ?? []).map((h) => HEADER_KEYS[normalizeHeader(h)] ?? null);
		if (cols.filter(Boolean).length >= 3 && cols.includes("customer") && (cols.includes("model") || cols.includes("equipmentName"))) {
			headerIdx = i;
			mapped = cols.map((c) => c);
			break;
		}
	}
	if (!mapped.length) throw new Error("Could not find Customer Name, Equipment Name / Model columns. Check the header row.");
	const records = [];
	let skipped = 0;
	for (let i = headerIdx + 1; i < matrix.length; i++) {
		const rec = mapRow(mapped, matrix[i] ?? []);
		if (!rec.customer && !rec.equipmentName && !rec.model && !rec.serial) {
			skipped += 1;
			continue;
		}
		records.push(rec);
	}
	return {
		records,
		skipped
	};
}
function mapDbUnit(r) {
	return {
		id: r.id,
		customer: r.customer,
		catalogModel: r.catalog_model,
		equipmentName: r.equipment_name,
		serial: r.serial,
		serialKey: r.serial_key,
		installDate: r.install_date,
		electrical: r.electrical,
		ownership: r.ownership,
		updatedAt: String(r.updated_at ?? "")
	};
}
async function loadCatalog(sql) {
	return (await sql.query(`select name from directory_equipment where archived = false and coalesce(name,'') <> '' order by lower(name)`)).map((r) => r.name);
}
async function loadAccounts(sql) {
	return sql.query(`select id, name from directory_customers where archived = false and coalesce(name,'') <> '' order by lower(name)`);
}
async function loadExisting(sql) {
	return (await sql.query(`select id, customer, catalog_model, equipment_name, serial, serial_key from account_equipment`).catch(() => [])).map((r) => ({
		id: r.id,
		customer: r.customer,
		catalogModel: r.catalog_model,
		equipmentName: r.equipment_name,
		serial: r.serial,
		serialKey: r.serial_key
	}));
}
function buildPreviewRow(rec, index, accounts, catalog, existing) {
	const account = matchAccount(rec.customer, accounts);
	const catalogHit = matchCatalogModel(rec.equipmentName, rec.model, catalog);
	const serial = parseSerial(rec.serial);
	const installDate = parseInstallDate(rec.installDate);
	const owned = mapOwnership(rec.ownership);
	const reviewReasons = [];
	if (account.status === "walk-in") reviewReasons.push("Walk-In — pick a KatzDesk account");
	if (account.status === "unmatched") reviewReasons.push("No matching account");
	if (account.status === "ambiguous") reviewReasons.push("Several accounts match");
	if (catalogHit.status === "unmatched") reviewReasons.push("No catalog model");
	if (catalogHit.status === "ambiguous") reviewReasons.push("Several catalog models match");
	let action = "add";
	let existingId = null;
	let foreignAccount = null;
	const customerName = account.account?.name ?? null;
	const catalogModel = catalogHit.catalogModel;
	if (customerName && catalogModel && !reviewReasons.length) {
		const unit = matchExistingUnit({
			customer: customerName,
			catalogModel,
			equipmentName: rec.equipmentName.trim() || rec.model.trim() || catalogModel,
			serial,
			existing
		});
		action = unit.action === "review" ? "review" : unit.action;
		existingId = unit.existingId;
		foreignAccount = unit.foreignAccount;
		if (unit.foreignAccount) reviewReasons.push(`Serial already on ${unit.foreignAccount}`);
	} else action = "review";
	const equipmentName = rec.equipmentName.trim() || rec.model.trim();
	return {
		key: `r${index}`,
		fileCustomer: rec.customer.trim(),
		customer: customerName,
		customerId: account.account?.id ?? null,
		customerStatus: account.status,
		equipmentName,
		fileModel: rec.model.trim(),
		catalogModel,
		addCatalog: false,
		modelStatus: catalogHit.status,
		modelCandidates: catalogHit.candidates,
		serial,
		installDate,
		electrical: rec.electrical.trim() || null,
		ownership: owned.value,
		ownershipRaw: owned.raw,
		action,
		existingId,
		foreignAccount,
		reviewReasons
	};
}
var fileInput = object({
	filename: string(),
	base64: string().min(8)
});
var previewAccountEquipImport_createServerFn_handler = createServerRpc({
	id: "1192b411cbac542b1a78b65c18f38dc71612d7e014585e7842015736911393dd",
	name: "previewAccountEquipImport",
	filename: "src/lib/ops/account-equip-import.ts"
}, (opts) => previewAccountEquipImport.__executeServer(opts));
var previewAccountEquipImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => fileInput.parse(d)).handler(previewAccountEquipImport_createServerFn_handler, async ({ data }) => {
	if (data.base64.length > 16e6) throw new Error("That file is too large.");
	const parsed = parseMatrix(fileToMatrix(data.base64));
	const sql = await ready();
	const [accounts, catalog, existing] = await Promise.all([
		loadAccounts(sql),
		loadCatalog(sql),
		loadExisting(sql)
	]);
	const rows = parsed.records.map((rec, i) => buildPreviewRow(rec, i, accounts, catalog, existing));
	return {
		addCount: rows.filter((r) => r.action === "add").length,
		updateCount: rows.filter((r) => r.action === "update").length,
		reviewCount: rows.filter((r) => r.action === "review").length,
		skipped: parsed.skipped,
		rows
	};
});
var applyRow = object({
	key: string(),
	fileCustomer: string(),
	customer: string().nullable(),
	customerId: number().nullable().optional(),
	customerStatus: _enum([
		"matched",
		"walk-in",
		"unmatched",
		"ambiguous"
	]).optional(),
	equipmentName: string(),
	fileModel: string().optional(),
	catalogModel: string().nullable(),
	addCatalog: boolean().optional(),
	modelStatus: _enum([
		"matched",
		"unmatched",
		"ambiguous"
	]).optional(),
	modelCandidates: array(string()).optional(),
	serial: string().nullable(),
	installDate: string().nullable(),
	electrical: string().nullable().optional(),
	ownership: string().nullable(),
	ownershipRaw: string().optional(),
	action: _enum([
		"add",
		"update",
		"review",
		"skip"
	]),
	existingId: number().nullable().optional(),
	foreignAccount: string().nullable().optional(),
	reviewReasons: array(string()).optional()
});
var applyInput = object({ rows: array(applyRow) });
async function ensureCatalogModel(sql, name) {
	const trimmed = name.trim();
	if (!trimmed) throw new Error("Catalog model is empty");
	const existing = await sql.query(`select id, name, archived from directory_equipment where lower(name) = lower($1) limit 1`, [trimmed]);
	if (existing[0]) {
		if (existing[0].archived) await sql.query(`update directory_equipment set archived = false, updated_at = now() where id = $1`, [existing[0].id]);
		return {
			name: existing[0].name,
			created: false
		};
	}
	return {
		name: (await sql.query(`insert into directory_equipment (name) values ($1) returning name`, [trimmed]))[0]?.name ?? trimmed,
		created: true
	};
}
var applyAccountEquipImport_createServerFn_handler = createServerRpc({
	id: "a25b8ed80544e5f6ef47139dac789bdcbce30de91833be149a93e28a551ace8d",
	name: "applyAccountEquipImport",
	filename: "src/lib/ops/account-equip-import.ts"
}, (opts) => applyAccountEquipImport.__executeServer(opts));
var applyAccountEquipImport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => applyInput.parse(d)).handler(applyAccountEquipImport_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const accounts = await loadAccounts(sql);
	const accountByKey = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
	const catalog = await loadCatalog(sql);
	const catalogByKey = new Map(catalog.map((n) => [n.toLowerCase(), n]));
	let existing = await loadExisting(sql);
	let added = 0;
	let updated = 0;
	let skipped = 0;
	let catalogAdded = 0;
	const inserts = [];
	for (const row of data.rows) {
		if (row.action === "skip" || row.action === "review") {
			skipped += 1;
			continue;
		}
		const customerName = (row.customer ?? "").trim();
		if (!customerName || isWalkIn(customerName)) {
			skipped += 1;
			continue;
		}
		const account = accountByKey.get(customerName.toLowerCase());
		if (!account) {
			skipped += 1;
			continue;
		}
		let catalogModel = (row.catalogModel ?? "").trim();
		if (!catalogModel) {
			skipped += 1;
			continue;
		}
		const known = catalogByKey.get(catalogModel.toLowerCase());
		if (known) catalogModel = known;
		else if (row.addCatalog) {
			const made = await ensureCatalogModel(sql, catalogModel);
			catalogModel = made.name;
			catalogByKey.set(catalogModel.toLowerCase(), catalogModel);
			if (made.created) catalogAdded += 1;
		} else {
			skipped += 1;
			continue;
		}
		const serial = parseSerial(row.serial);
		const equipmentName = row.equipmentName.trim() || catalogModel;
		const unit = matchExistingUnit({
			customer: account.name,
			catalogModel,
			equipmentName,
			serial,
			existing
		});
		if (unit.foreignAccount) {
			skipped += 1;
			continue;
		}
		const ownership = OWNERSHIP_VALUES.includes(row.ownership) ? row.ownership : mapOwnership(row.ownership).value;
		const installDate = parseInstallDate(row.installDate);
		const electrical = row.electrical?.trim() || null;
		const key = serialKey(serial) || null;
		if (unit.action === "update" && unit.existingId) {
			if (unit.existingId < 0) {
				const idx = -unit.existingId - 1;
				if (inserts[idx]) {
					inserts[idx] = [
						account.name,
						catalogModel,
						equipmentName,
						serial,
						key,
						installDate,
						electrical,
						ownership
					];
					existing = existing.map((e) => e.id === unit.existingId ? {
						...e,
						catalogModel,
						equipmentName,
						serial,
						serialKey: key
					} : e);
				}
				continue;
			}
			await sql.query(`update account_equipment set
              catalog_model = $2,
              equipment_name = $3,
              serial = $4,
              serial_key = $5,
              install_date = $6,
              electrical = coalesce($7, electrical),
              ownership = coalesce($8, ownership),
              updated_at = now()
            where id = $1`, [
				unit.existingId,
				catalogModel,
				equipmentName,
				serial,
				key,
				installDate,
				electrical,
				ownership
			]);
			existing = existing.map((e) => e.id === unit.existingId ? {
				...e,
				catalogModel,
				equipmentName,
				serial,
				serialKey: key
			} : e);
			updated += 1;
			continue;
		}
		const tempId = -(inserts.length + 1);
		inserts.push([
			account.name,
			catalogModel,
			equipmentName,
			serial,
			key,
			installDate,
			electrical,
			ownership
		]);
		existing.push({
			id: tempId,
			customer: account.name,
			catalogModel,
			equipmentName,
			serial,
			serialKey: key
		});
		added += 1;
	}
	const chunk = 50;
	for (let i = 0; i < inserts.length; i += chunk) {
		const slice = inserts.slice(i, i + chunk);
		const values = [];
		const placeholders = slice.map((row, idx) => {
			const b = idx * 8;
			values.push(...row);
			return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
		});
		await sql.query(`insert into account_equipment
            (customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership)
           values ${placeholders.join(",")}`, values);
	}
	return {
		added,
		updated,
		skipped,
		catalogAdded
	};
});
var listInput = object({ customer: string().optional() });
var listAccountEquipment_createServerFn_handler = createServerRpc({
	id: "280698ca3a37048a952a0a60c6de4360d08267057edc403a8ffe38aee977b028",
	name: "listAccountEquipment",
	filename: "src/lib/ops/account-equip-import.ts"
}, (opts) => listAccountEquipment.__executeServer(opts));
var listAccountEquipment = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => listInput.parse(d ?? {})).handler(listAccountEquipment_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const customer = data.customer?.trim();
	return (customer ? await sql.query(`select id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, updated_at
             from account_equipment
            where lower(customer) = lower($1)
            order by lower(catalog_model), id`, [customer]) : await sql.query(`select id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, updated_at
             from account_equipment
            order by lower(customer), lower(catalog_model), id`)).map(mapDbUnit);
});
//#endregion
export { applyAccountEquipImport_createServerFn_handler, listAccountEquipment_createServerFn_handler, previewAccountEquipImport_createServerFn_handler };
