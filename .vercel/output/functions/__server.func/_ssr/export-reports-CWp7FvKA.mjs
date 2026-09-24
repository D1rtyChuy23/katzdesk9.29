import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { r as getSql } from "./db-B30u4tE3.mjs";
import { l as sameCatalogModel, u as serialKey } from "./account-equip-DMHHRLhM.mjs";
import { o as deskMiddleware } from "./access-Bds4AN6g.mjs";
import { u as woMatchKey } from "./corrigo-D4iGSjgV.mjs";
import { hn as object, sn as _enum, un as boolean, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as utils, r as writeSync } from "../_libs/xlsx.mjs";
import { r as sameTech } from "./tech-match-BXt0nt9H.mjs";
import { O as todayChicago, _ as isInstalled, h as isClosedCall, l as formatNowChicago, x as isoDay } from "./clock-CnyB9j5S.mjs";
import { i as listedEquipment, r as findRecipeFor, s as parseMachinesJson, t as catalogModels } from "./machines-kdzfuS7z.mjs";
import { l as emptyInspection, v as photosCell, x as siteIsReady } from "./pre-inspection-C3xoeIXB.mjs";
import { a as loadInspectionSummaries, o as loadInspectionUnits } from "./inspection-api-hmdB78Mh.mjs";
import { a as loadAccountMarks, r as isAviKatz } from "./reps-0zusJ0Ep.mjs";
import { n as HEALTH_LABEL } from "./rebuild-model-DFutjdeg.mjs";
import { a as settingsFrom, n as SETTING_FIELDS } from "./recipe-fields-DqZtnvK8.mjs";
import { i as loadTechs } from "./roster-CTtWzCoL.mjs";
import { l as sortRebuildsForExport, o as loadRebuilds } from "./rebuilds-BpT4pkPF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/export-reports-CWp7FvKA.js
var REPORT_TYPES = [
	"pending",
	"pms",
	"modules",
	"tlc",
	"installs",
	"rebuilds"
];
var REPORT_LABELS = {
	pending: "Pending services",
	pms: "PMs",
	modules: "Modules",
	tlc: "TLC & Factors",
	installs: "Install readiness",
	rebuilds: "Rebuilds"
};
var REPORT_SLUG = {
	pending: "Pending-services",
	pms: "PMs",
	modules: "Modules",
	tlc: "TLC-Factors",
	installs: "Install-readiness",
	rebuilds: "Rebuilds"
};
var filterInput = object({
	dateFrom: string().nullable().optional(),
	dateTo: string().nullable().optional(),
	tech: string().nullable().optional(),
	customer: string().nullable().optional(),
	status: string().nullable().optional(),
	ak: boolean().nullable().optional()
});
var buildInput = object({
	type: _enum(REPORT_TYPES),
	format: _enum(["xlsx", "csv"]),
	filters: filterInput.optional()
});
function readySql() {
	return (async () => {
		const { ensureSeeded } = await import("./seed.server-BYmYnsv0.mjs");
		await ensureSeeded();
		return getSql();
	})();
}
function str(v) {
	if (v == null) return "";
	return String(v).trim();
}
function cellOrMissing(v) {
	const s = str(v);
	return s ? s : "missing";
}
var INSTALL_CORE_COLS = [
	"Account",
	"Install / scheduled date",
	"Equipment",
	"Serial number",
	"Electrical configuration",
	"Configuration"
];
var INSTALL_INSPECT_COLS = [
	"Pre-inspection status",
	"Failed items",
	"Photos",
	"Core hole needed",
	"Core hole status"
];
function inDateRange(value, from, to) {
	if (!from && !to) return true;
	const d = (value ?? "").slice(0, 10);
	if (!d) return false;
	if (from && d < from) return false;
	if (to && d > to) return false;
	return true;
}
function matchCustomer(name, needle) {
	const n = (needle ?? "").trim().toLowerCase();
	if (!n) return true;
	return (name ?? "").toLowerCase().includes(n);
}
function matchTech(name, needle) {
	const n = (needle ?? "").trim();
	if (!n) return true;
	return sameTech(name, n);
}
function matchStatus(status, needle) {
	const n = (needle ?? "").trim();
	if (!n) return true;
	return (status ?? "").trim().toLowerCase() === n.toLowerCase();
}
function akCell(marks, customer) {
	return isAviKatz(marks, customer) ? "AK" : "";
}
function matchAk(marks, customer, want) {
	if (!want) return true;
	return isAviKatz(marks, customer);
}
function pickInstallScheduled(opts) {
	return isoDay(opts.install) || isoDay(opts.scheduled) || isoDay(opts.due) || "";
}
function dateSortKey(d) {
	return isoDay(d) || "9999-12-31";
}
function sortAccountDateSt(rows, accountIdx, dateIdx, stIdx) {
	return [...rows].sort((a, b) => {
		const ac = (a[accountIdx] ?? "").localeCompare(b[accountIdx] ?? "", void 0, { sensitivity: "base" });
		if (ac) return ac;
		const dd = dateSortKey(a[dateIdx] ?? "").localeCompare(dateSortKey(b[dateIdx] ?? ""));
		if (dd) return dd;
		if (stIdx < 0) return 0;
		return (a[stIdx] ?? "").localeCompare(b[stIdx] ?? "", void 0, {
			numeric: true,
			sensitivity: "base"
		});
	});
}
function groupByAccount(rows, accountIdx = 0) {
	const out = [];
	let prev = null;
	for (const row of rows) {
		const acct = row[accountIdx] ?? "";
		if (prev != null && acct !== prev) out.push(row.map(() => ""));
		out.push(row);
		prev = acct;
	}
	return out;
}
function isBlankRow(row) {
	return row.every((c) => !c);
}
function techCell(name, inactive) {
	const n = str(name);
	if (!n) return "";
	if ([...inactive].some((i) => sameTech(i, n))) return `${n} (inactive)`;
	return n;
}
async function inactiveNames(sql) {
	const techs = await loadTechs(sql);
	return new Set(techs.filter((t) => !t.active).map((t) => t.name.toLowerCase()));
}
function extractPo(...fields) {
	for (const f of fields) {
		const text = f ?? "";
		const re = /\bP\.?\s*O\.?\s*(?:#|No\.?|Number)?\s*[:#-]?\s*([A-Z0-9][-A-Z0-9/]{1,24})/gi;
		let m;
		while (m = re.exec(text)) {
			const v = (m[1] ?? "").replace(/[.,;]+$/, "");
			if (!v || /^(tlc|factor|and)$/i.test(v)) continue;
			return v;
		}
	}
	return "";
}
function dedupeBySt(rows, stIdx) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const row of rows) {
		const raw = row[stIdx] ?? "";
		const key = woMatchKey(raw);
		if (!key) {
			out.push(row);
			continue;
		}
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(row);
	}
	return out;
}
function filterSummary(filters, count) {
	const bits = [];
	if (filters?.dateFrom || filters?.dateTo) bits.push(`Dates ${filters.dateFrom || "…"} to ${filters.dateTo || "…"}`);
	if (filters?.tech) bits.push(`Tech ${filters.tech}`);
	if (filters?.customer) bits.push(`Account ${filters.customer}`);
	if (filters?.status) bits.push(`Status ${filters.status}`);
	if (filters?.ak) bits.push("AK accounts");
	bits.push(`${count} row${count === 1 ? "" : "s"}`);
	return bits.join(" · ");
}
function tlcBlob(issue, callType, notes, workDone) {
	const blob = `${issue ?? ""} ${callType ?? ""} ${notes ?? ""} ${workDone ?? ""}`;
	return /\b(tlc|factor)\b/i.test(blob);
}
function mapRecipeRow(r) {
	return {
		id: Number(r.id),
		equipmentModel: String(r.equipment_model ?? ""),
		customer: r.customer ?? null,
		installId: r.install_id == null ? null : Number(r.install_id),
		copiedFrom: r.copied_from == null ? null : Number(r.copied_from),
		isTemplate: !!r.is_template,
		coffee1: r.coffee_1 ?? null,
		coffee2: r.coffee_2 ?? null,
		coffee3: r.coffee_3 ?? null,
		powder1: r.powder_1 ?? null,
		powder2: r.powder_2 ?? null,
		powder3: r.powder_3 ?? null,
		americano1: r.americano_1 ?? null,
		americano2: r.americano_2 ?? null,
		americano3: r.americano_3 ?? null,
		tea1: r.tea_1 ?? null,
		tea2: r.tea_2 ?? null,
		milk: r.milk ?? null,
		notes: r.notes ?? null,
		updatedAt: String(r.updated_at ?? "")
	};
}
function configForMachine(customer, installId, model, serial, voltage, recipes) {
	const bits = [];
	if (model) bits.push(model);
	if (serial) bits.push(`SN ${serial}`);
	if (voltage) bits.push(voltage);
	const { linked, house } = findRecipeFor(recipes, {
		customer,
		model,
		installId
	});
	const rec = linked ?? house;
	if (rec) {
		const settings = settingsFrom(rec);
		for (const f of SETTING_FIELDS) {
			const v = (settings[f.name] ?? "").trim();
			if (v) bits.push(`${f.label}: ${v.split("\n")[0].slice(0, 48)}`);
		}
		if (rec.notes?.trim()) bits.push(rec.notes.trim().split("\n")[0].slice(0, 80));
	}
	const hardware = !!(model || serial || voltage);
	if (!bits.length) return {
		text: "missing",
		missing: true
	};
	if (!hardware) return {
		text: bits.join(" · "),
		missing: true
	};
	return {
		text: bits.join(" · "),
		missing: false
	};
}
function blockingFor(row) {
	const bits = [];
	if (row.equip_status && row.equip_status !== "Ready") bits.push(row.equip_status);
	if (row.reqs_ready && row.reqs_ready !== "Ready") bits.push(`Site: ${row.reqs_ready}`);
	if (row.payment_status) bits.push(row.payment_status);
	if (row.notes?.trim()) bits.push(row.notes.trim());
	return bits.join(" · ");
}
async function buildPending(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, customer, status, technician, completed_at, issue, work_done, received, scheduled, done
       from service_jobs
      where kind = 'service' and duplicate_of is null
      order by customer, wo`);
	let rows = [];
	for (const j of jobs) {
		if (isClosedCall(j)) continue;
		if (j.status === "Cancelled" || j.status === "Completed") continue;
		if (!inDateRange(j.completed_at || j.scheduled || j.received, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.customer, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.customer, filters.ak)) continue;
		rows.push([
			str(j.wo),
			str(j.customer),
			pickInstallScheduled({ scheduled: j.scheduled }),
			str(j.status),
			techCell(j.technician, inactive),
			str(j.completed_at),
			str(j.issue),
			str(j.work_done),
			akCell(marks, j.customer)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "Pending services",
		columns: [
			"ST#",
			"Account",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date completed",
			"Problem / request",
			"Description of work",
			"AK"
		],
		rows
	};
}
async function buildPms(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, customer, status, technician, completed_at, equipment, work_done, style, parts_status, projected, received, done
       from pm_jobs order by customer, wo`);
	let rows = [];
	for (const j of jobs) {
		if (!inDateRange(j.completed_at || j.projected || j.received, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.customer, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.customer, filters.ak)) continue;
		rows.push([
			str(j.wo),
			str(j.customer),
			pickInstallScheduled({ due: j.projected }),
			str(j.status),
			techCell(j.technician, inactive),
			str(j.completed_at),
			str(j.equipment),
			str(j.work_done),
			str(j.style),
			str(j.parts_status),
			str(j.projected),
			akCell(marks, j.customer)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "PMs",
		columns: [
			"ST#",
			"Account",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date completed",
			"Equipment",
			"Description of work",
			"PM style",
			"Parts",
			"Projected",
			"AK"
		],
		rows
	};
}
async function buildModules(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, location, status, technician, date_ready, module_id, module_type, platform, date_in from modules order by location, wo`);
	let rows = [];
	for (const j of jobs) {
		if (!inDateRange(j.date_ready || j.date_in, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.location, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.location, filters.ak)) continue;
		rows.push([
			str(j.wo),
			str(j.location),
			"",
			str(j.status),
			techCell(j.technician, inactive),
			str(j.date_ready),
			str(j.module_id),
			str(j.module_type),
			str(j.platform),
			akCell(marks, j.location)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "Modules",
		columns: [
			"ST#",
			"Account / location",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date ready",
			"Module",
			"Type",
			"Platform",
			"AK"
		],
		rows
	};
}
async function buildTlc(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const jobs = await sql.query(`select wo, customer, status, technician, completed_at, issue, work_done, call_type, kind, received, scheduled, done, notes
       from service_jobs
      where duplicate_of is null
      order by customer, wo`);
	let rows = [];
	for (const j of jobs) {
		const po = extractPo(j.issue, j.notes, j.work_done, j.call_type);
		if (j.kind !== "tlc" && !tlcBlob(j.issue, j.call_type, j.notes, j.work_done) && !/\b(tlc|factor)\b/i.test(po)) continue;
		if (!inDateRange(j.completed_at || j.scheduled || j.received, filters.dateFrom, filters.dateTo)) continue;
		if (!matchTech(j.technician, filters.tech)) continue;
		if (!matchCustomer(j.customer, filters.customer)) continue;
		if (!matchStatus(j.status, filters.status)) continue;
		if (!matchAk(marks, j.customer, filters.ak)) continue;
		rows.push([
			str(j.wo),
			str(j.customer),
			pickInstallScheduled({ scheduled: j.scheduled }),
			str(j.status),
			techCell(j.technician, inactive),
			str(j.completed_at),
			str(j.issue),
			str(j.work_done),
			po,
			akCell(marks, j.customer)
		]);
	}
	rows = sortAccountDateSt(dedupeBySt(rows, 0), 1, 2, 0);
	return {
		name: "TLC & Factors",
		columns: [
			"ST#",
			"Account",
			"Install / scheduled date",
			"Status",
			"Tech",
			"Date completed",
			"Problem / request",
			"Description of work",
			"P.O. #",
			"AK"
		],
		rows
	};
}
async function buildInstalls(sql, filters, inactive) {
	const marks = await loadAccountMarks(sql);
	const installs = await sql.query(`select id, customer, equipment, equip_status, install_date, technician, notes, reqs_ready,
            payment_status, serial, power_voltage, machines, complete, account_rep, received, updated_at
       from installs
      where archived = false
      order by customer`);
	const recipes = (await sql.query(`select * from recipes`)).map(mapRecipeRow);
	const catalog = catalogModels([...installs.map((i) => i.equipment ?? ""), ...recipes.map((r) => r.equipmentModel)]);
	const accountSerials = await sql.query(`select customer, catalog_model, serial, serial_key from account_equipment
        where coalesce(serial,'') <> ''`).catch(() => []);
	const usedSerials = /* @__PURE__ */ new Set();
	const summaries = await loadInspectionSummaries(sql, installs.map((i) => i.id));
	const unitRows = await loadInspectionUnits(sql, installs.map((i) => i.id));
	const readyRows = [];
	const notReadyRows = [];
	for (const i of installs) {
		if (isInstalled({
			complete: i.complete,
			equipStatus: i.equip_status
		})) continue;
		if (!inDateRange(i.install_date || i.received || String(i.updated_at).slice(0, 10), filters.dateFrom, filters.dateTo)) continue;
		if (filters.tech && !matchTech(i.technician, filters.tech) && !matchTech(i.account_rep, filters.tech)) continue;
		if (!matchCustomer(i.customer, filters.customer)) continue;
		if (!matchAk(marks, i.customer, filters.ak)) continue;
		const summary = summaries.get(i.id) ?? emptyInspection();
		const isReady = siteIsReady(i.equip_status, summary.overall);
		const mine = unitRows.filter((u) => u.installId === i.id);
		const blockBits = [blockingFor(i)];
		if (summary.overall !== "Passed") {
			const failed = summary.failedItems.join(", ");
			blockBits.push(failed ? `Pre-inspection ${summary.overall}: ${failed}` : `Pre-inspection ${summary.overall}`);
		}
		const blocking = blockBits.filter(Boolean).join(" · ");
		if (filters.status) {
			const wantReady = filters.status.toLowerCase() === "ready";
			const wantNot = /not\s*ready/i.test(filters.status);
			if (wantReady && !isReady) continue;
			if (wantNot && isReady) continue;
			if (!wantReady && !wantNot && !matchStatus(i.equip_status, filters.status)) continue;
		}
		const machines = parseMachinesJson(i.machines);
		const names = listedEquipment(i.equipment, catalog);
		const pieces = mine.length ? mine.map((u) => ({
			equipment: u.model,
			serial: u.serial ?? "",
			powerVoltage: u.electrical ?? "",
			inspectStatus: u.overall,
			failedCell: u.failedItems.join(", "),
			photoCell: photosCell(u.photoCount),
			coreNeededCell: u.coreNeeded === "yes" ? "Yes" : u.coreNeeded === "no" ? "No" : "",
			coreStatusCell: u.coreNeeded === "yes" ? u.coreStatus || "Not inspected" : ""
		})) : (machines.length > 0 ? machines : names.length ? names.map((equipment) => ({
			equipment,
			serial: names.length === 1 ? str(i.serial) : "",
			powerVoltage: names.length === 1 ? str(i.power_voltage) : ""
		})) : [{
			equipment: str(i.equipment),
			serial: str(i.serial),
			powerVoltage: str(i.power_voltage)
		}]).map((piece) => ({
			...piece,
			inspectStatus: summary.overall,
			failedCell: summary.failedItems.join(", "),
			photoCell: photosCell(summary.photoCount),
			coreNeededCell: "",
			coreStatusCell: ""
		}));
		const owner = techCell(str(i.technician) || str(i.account_rep), inactive);
		const updated = isoDay(i.updated_at);
		for (const piece of pieces) {
			const model = piece.equipment || str(i.equipment);
			let serial = piece.serial;
			if (!serialKey(serial)) {
				const matches = accountSerials.filter((row) => {
					const key = row.serial_key || serialKey(row.serial);
					if (!key || usedSerials.has(key)) return false;
					if (row.customer.trim().toLowerCase() !== i.customer.trim().toLowerCase()) return false;
					return sameCatalogModel(row.catalog_model, model);
				});
				if (matches.length === 1) {
					serial = matches[0].serial ?? "";
					const key = matches[0].serial_key || serialKey(serial);
					if (key) usedSerials.add(key);
				}
			}
			const cfg = configForMachine(i.customer, i.id, model, serial, piece.powerVoltage, recipes);
			const serialCell = cellOrMissing(serial);
			const electricalCell = cellOrMissing(piece.powerVoltage);
			if (isReady) readyRows.push([
				str(i.customer),
				pickInstallScheduled({ install: i.install_date }),
				model,
				serialCell,
				electricalCell,
				cfg.missing ? "missing" : cfg.text,
				piece.inspectStatus,
				piece.failedCell,
				piece.photoCell,
				piece.coreNeededCell,
				piece.coreStatusCell,
				owner,
				akCell(marks, i.customer)
			]);
			else notReadyRows.push([
				str(i.customer),
				pickInstallScheduled({ install: i.install_date }),
				model,
				serialCell,
				electricalCell,
				cfg.missing ? "missing" : cfg.text,
				piece.inspectStatus,
				piece.failedCell,
				piece.photoCell,
				piece.coreNeededCell,
				piece.coreStatusCell,
				blocking,
				owner,
				updated,
				akCell(marks, i.customer)
			]);
		}
	}
	const notReadySorted = sortAccountDateSt(notReadyRows, 0, 1, -1);
	const readySorted = sortAccountDateSt(readyRows, 0, 1, -1);
	return {
		notReady: {
			name: "Not ready",
			columns: [
				...INSTALL_CORE_COLS,
				...INSTALL_INSPECT_COLS,
				"Blocking / not ready",
				"Tech / owner",
				"Last updated",
				"AK"
			],
			rows: groupByAccount(notReadySorted, 0)
		},
		ready: {
			name: "Ready",
			columns: [
				...INSTALL_CORE_COLS,
				...INSTALL_INSPECT_COLS,
				"Tech / owner",
				"AK"
			],
			rows: groupByAccount(readySorted, 0)
		},
		counts: {
			notReady: notReadySorted.length,
			ready: readySorted.length
		}
	};
}
function rosterOwner(name, active) {
	const raw = (name ?? "").trim();
	if (!raw) return "";
	const hit = active.find((t) => sameTech(t.name, raw));
	return hit ? hit.name : raw;
}
async function buildRebuilds(sql, filters) {
	const active = (await loadTechs(sql)).filter((t) => t.active);
	const rows = sortRebuildsForExport(await loadRebuilds(sql));
	const body = [];
	for (const r of rows) {
		if (!matchCustomer(r.account, filters.customer)) continue;
		if (!matchTech(r.owner, filters.tech)) continue;
		if (!matchStatus(r.status, filters.status)) continue;
		if (!inDateRange(r.targetComplete, filters.dateFrom, filters.dateTo) && (filters.dateFrom || filters.dateTo)) {
			if (!inDateRange(r.updatedAt.slice(0, 10), filters.dateFrom, filters.dateTo)) continue;
		}
		body.push([
			r.title,
			r.account,
			r.equipment ?? "",
			r.serial ?? "",
			rosterOwner(r.owner, active),
			r.status,
			r.status === "Waiting" ? r.reasonCode ?? "" : "",
			r.targetComplete ?? "",
			String(r.daysOpen),
			r.daysToTarget == null ? "" : String(r.daysToTarget),
			HEALTH_LABEL[r.health],
			isoDay(r.updatedAt)
		]);
	}
	return {
		name: "Rebuilds",
		columns: [
			"Project",
			"Account",
			"Equipment",
			"Serial",
			"Owner",
			"Status",
			"Reason delayed",
			"Target complete",
			"Days open",
			"Days to target",
			"Health",
			"Last update"
		],
		rows: body
	};
}
function fileNameFor(type, date, format) {
	return `KatzDesk-${REPORT_SLUG[type]}-${date}.${format}`;
}
async function buildReport(type, filters) {
	const sql = await readySql();
	const generated = formatNowChicago();
	const inactive = await inactiveNames(sql);
	let sheets = [];
	let counts;
	if (type === "pending") sheets = [await buildPending(sql, filters, inactive)];
	else if (type === "pms") sheets = [await buildPms(sql, filters, inactive)];
	else if (type === "modules") sheets = [await buildModules(sql, filters, inactive)];
	else if (type === "tlc") sheets = [await buildTlc(sql, filters, inactive)];
	else if (type === "rebuilds") sheets = [await buildRebuilds(sql, filters)];
	else {
		const inst = await buildInstalls(sql, filters, inactive);
		sheets = [inst.notReady, inst.ready];
		counts = inst.counts;
	}
	const rowCount = counts != null ? counts.notReady + counts.ready : sheets.reduce((n, s) => n + s.rows.filter((r) => !isBlankRow(r)).length, 0);
	return {
		type,
		label: REPORT_LABELS[type],
		generated: generated.stamp,
		filterSummary: filterSummary(filters, rowCount),
		filename: fileNameFor(type, generated.date, "xlsx"),
		sheets,
		counts
	};
}
function sheetWithHeader(report, sheet, extra) {
	const aoa = [
		[report.label],
		[`Generated ${report.generated}`],
		[report.filterSummary],
		extra ?? [],
		[],
		sheet.columns,
		...sheet.rows
	];
	return utils.aoa_to_sheet(aoa);
}
function toWorkbook(report) {
	const wb = utils.book_new();
	if (report.type === "installs" && report.counts) {
		const extra = [`${report.counts.notReady} not ready`, `${report.counts.ready} ready`];
		for (const sheet of report.sheets) utils.book_append_sheet(wb, sheetWithHeader(report, sheet, extra), sheet.name.slice(0, 31));
		return wb;
	}
	for (const sheet of report.sheets) utils.book_append_sheet(wb, sheetWithHeader(report, sheet), sheet.name.slice(0, 31));
	return wb;
}
function toCsv(report) {
	const lines = [];
	const esc = (v) => {
		if (/[",\n]/.test(v)) return `"${v.replace(/"/g, "\"\"")}"`;
		return v;
	};
	lines.push(esc(report.label));
	lines.push(esc(`Generated ${report.generated}`));
	lines.push(esc(report.filterSummary));
	if (report.counts) lines.push(esc(`${report.counts.notReady} not ready · ${report.counts.ready} ready`));
	lines.push("");
	if (report.type === "installs") {
		for (const sheet of report.sheets) {
			lines.push(esc(sheet.name));
			lines.push(sheet.columns.map(esc).join(","));
			for (const r of sheet.rows) {
				if (isBlankRow(r)) {
					lines.push("");
					continue;
				}
				lines.push(r.map((c) => esc(c ?? "")).join(","));
			}
			lines.push("");
		}
		return lines.join("\n");
	}
	const sheet = report.sheets[0];
	if (!sheet) return lines.join("\n");
	lines.push(sheet.columns.map(esc).join(","));
	for (const r of sheet.rows) lines.push(r.map((c) => esc(c ?? "")).join(","));
	return lines.join("\n");
}
var previewExport_createServerFn_handler = createServerRpc({
	id: "111aeb03d57088e20114c3b91137111583695de7837bf7cd602c0b77a80b8751",
	name: "previewExport",
	filename: "src/lib/ops/export-reports.ts"
}, (opts) => previewExport.__executeServer(opts));
var previewExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(previewExport_createServerFn_handler, async ({ data }) => {
	return buildReport(data.type, data.filters ?? {});
});
var downloadExport_createServerFn_handler = createServerRpc({
	id: "c4a7418688fc4b7cb7af59b7f9d2eff9d3caace06de75ab3a03f4a37b3217a06",
	name: "downloadExport",
	filename: "src/lib/ops/export-reports.ts"
}, (opts) => downloadExport.__executeServer(opts));
var downloadExport = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => buildInput.parse(d)).handler(downloadExport_createServerFn_handler, async ({ data }) => {
	const report = await buildReport(data.type, data.filters ?? {});
	const date = todayChicago();
	if (data.format === "csv") {
		const csv = toCsv(report);
		return {
			filename: fileNameFor(data.type, date, "csv"),
			mime: "text/csv",
			base64: Buffer.from(csv, "utf8").toString("base64"),
			report: {
				...report,
				filename: fileNameFor(data.type, date, "csv")
			}
		};
	}
	const wb = toWorkbook(report);
	const buf = writeSync(wb, {
		type: "base64",
		bookType: "xlsx"
	});
	return {
		filename: fileNameFor(data.type, date, "xlsx"),
		mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		base64: buf,
		report: {
			...report,
			filename: fileNameFor(data.type, date, "xlsx")
		}
	};
});
//#endregion
export { downloadExport_createServerFn_handler, previewExport_createServerFn_handler };
