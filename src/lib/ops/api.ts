/* eslint-disable @typescript-eslint/ban-ts-comment -- legacy file, typed at its call sites */
// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { canReviewNames, deskMiddleware, salesRepScope } from "@/lib/ops/access";
import { CLOSED_CALL, CLOSED_PM } from "./lookups";
import { DEFAULT_PM_STYLE } from "./pm-runbook";
import { loadPmRunbookPlan, pmCompletionRefusal, recordCompletedRunbook, stampMachineParts } from "./pm-runbook-api";
import { stackCustomerRefusal } from "./pm-stack";
import { formatAddress } from "./netsuite-customers";
import { removeCustomersFor } from "./customer-remove-api";
import { isClosedCall, isOpenCall, isClosedPm, isOpenPm } from "./ticket-status";
import { canonicalTechName, sameTech } from "./tech-match";
import { boardLocked, cleanTime, type BoardType } from "./day-board";
import { namesMatchUser } from "./lookups";
import { techRequestPing } from "./tech-request";
import {
  addDays,
  diffDays,
  formatWeekLabel,
  installFlag,
  pmFlag,
  serviceFlag,
  todayChicago,
  weekBounds,
  isInstalled,
  isOpenInstall,
} from "./clock";
import { isoDayOrNull as isoDate } from "./iso";
import { findWoEverywhere, searchTicketText, woBoardName, woSearchKey, type WoBoardHit } from "./wo-search";
import { INSTALLED_KEPT, canMarkInstalled, listEditRefusal, loadInspectionSummaries, syncInstallUnits, unitsDroppedBy, withInspections } from "./inspection-api";
import { emptyInspection } from "./pre-inspection";
import type {
  Asset,
  ComingDueRow,
  CustomerHistory,
  CustomerRecord,
  Dashboard,
  Deal,
  DirectoryEntry,
  DirectoryKind,
  HandoffFeed,
  Install,
  ModuleRow,
  PmJob,
  Recipe,
  SearchHit,
  ServiceJob,
} from "./types";
export type { DirectoryKind };
import { specsFromInstall, parseMachinesJson, serializeMachines, type MachineSpec } from "./machines";
import { CONTACT_PHONE_MAX, SITE_CONTACT_MAX, contactText, installTypeLabel, installTypeOf, machinesBeforeSave } from "./install-form";
import { backfillAssignedSerialsOnce } from "./serial-backfill";
import { clearWarehouseSerial, placeWarehouseSerial } from "./warehouse-serial";
import { assertUnlocked, canLockEquipment } from "./equipment-lock";
import { MANUAL_PIN_MATCH, pinQuality, pinSourceLabel } from "./account-pin";
import { LOCKED_BY_ASSIGNED, LOCKED_BY_SOLD } from "./equipment-lock-rules";
import { boardRow, cleanMachine, confirmError, continuable, dropReleased, keepTies, lockConfirmed, placeRows, projectLabel, projectStatus, releasedUids } from "./deal-board";
import { listedEquipment, matchModel, catalogModels, savedMachineName } from "./equipment";
import {
  BACK_PALLETS,
  BARN_EQUIP_CAPACITY,
  FRONT_PALLETS,
  LEVELS,
  bayFor,
  isBarn,
  isValidBay,
  rackBayError,
  needsBay,
  siteLabel,
  slotId,
} from "./warehouse";
import { renameOrMergeEquipment, renameCustomerFor, previewCustomerRenameFor } from "./customer-identity";
import type { RenamePlan, RenameResult } from "./customer-rename";
import { lockedNameFor } from "./clean-names-api";
import { canonicalRepName, isNoRep, PRODUCER_INITIALS } from "./rep-match";
import { loadAccountMarks, upsertAccountMarks, isAviKatz, accountRepFor, accountNumberFor } from "./reps";
import { woMatchKey } from "./corrigo";
import { BILLED_ON_INSTALL } from "./merged-ticket";
import { mergeServiceJobs } from "./wo-duplicates";
import { INSTALL_WOS_SQL, assertWoFree, setPrimaryWo, withWorkOrders } from "./install-work-orders";
import { assertCustomerChangeAllowed, moveInstallUnits } from "./install-projects";
import { parseMentions } from "./mentions";
import { deliverPings } from "./notify";

const INITIALS_TO_PRODUCER = Object.fromEntries(Object.entries(PRODUCER_INITIALS).map(([name, initials]) => [initials.toLowerCase(), name]));
function salesName(owners: any) {
	if (!owners) return null;
	const producer = owners.producer?.trim();
	if (producer) return producer;
	const rep = owners.accountRep?.trim();
	if (!rep) return null;
	const fromInitials = INITIALS_TO_PRODUCER[rep.toLowerCase()];
	return fromInitials ? `${fromInitials} (${rep})` : rep;
}
function noteOwner(c: any, owners: any) {
	if (c.authorId) return {
		label: c.authorName?.trim() || "Teammate",
		canClaim: false,
		kind: "user"
	};
	const sales = salesName(owners);
	if (c.entityType === "deal" && sales) return {
		label: sales,
		canClaim: true,
		kind: "sales"
	};
	if (c.entityType === "service" || c.entityType === "tlc" || c.entityType === "pm" || c.entityType === "install" || c.askTeam === "service") return {
		label: "Service",
		canClaim: true,
		kind: "service"
	};
	if (sales) return {
		label: sales,
		canClaim: true,
		kind: "sales"
	};
	return {
		label: "Unclaimed",
		canClaim: true,
		kind: "unclaimed"
	};
}
//#endregion
async function ready() {
	const { ensureSeeded } = await import("./seed.server");
	await ensureSeeded();
	return getSql();
}
async function deskUsername(sql: any, userId: any) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}
async function logActivity(sql: any, userId: any, entityType: any, entityId: any, action: any, detail: any) {
	await sql`
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    values (${entityType}, ${entityId}, ${await deskUsername(sql, userId)}, ${action}, ${detail ?? null})`;
}
function changed(label: any, before: any, after: any) {
	const a = before == null || before === "" ? "" : String(before);
	const b = after == null || after === "" ? "" : String(after);
	if (a === b) return null;
	if (label === "technician" || label === "producer" || label === "account rep") return b ? `assigned ${b}` : `cleared ${label}`;
	if (label === "status") return `${a || "—"} → ${b || "—"}`;
	if (!b) return `cleared ${label}`;
	return `${label}: ${b.slice(0, 72)}`;
}
function summarize(parts: any) {
	const hits = parts.filter((x: any) => !!x);
	return hits.length ? hits.slice(0, 4).join(" · ") : null;
}
async function loadEquipCatalog(sql: any) {
	const dir = await sql`
    select name from directory_equipment where archived = false and coalesce(name, '') <> ''`;
	const assets = await sql`
    select distinct model from assets where kind = 'equip' and coalesce(model, '') <> ''`;
	return catalogModels([...dir.map((r: any) => r.name), ...assets.map((r: any) => r.model)]);
}
function num(v: any) {
	if (v === null || v === undefined || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}
function jobSibling(r: any) {
	return {
		id: r.id,
		callId: r.callId,
		customer: r.customer,
		kind: r.kind,
		status: r.status,
		wo: r.wo
	};
}
function attachJobSiblings(jobs: any) {
	const groups = new Map();
	for (const j of jobs) {
		if (j.duplicateOf) continue;
		const key = woMatchKey(j.wo ?? "");
		if (!key) continue;
		const list = groups.get(key) ?? [];
		list.push(j);
		groups.set(key, list);
	}
	return jobs.map((j: any) => {
		const key = woMatchKey(j.wo ?? "");
		const group = key ? groups.get(key) ?? [] : [];
		return {
			...j,
			siblings: group.filter((o: any) => o.id !== j.id).map(jobSibling)
		};
	});
}
function mapJob(r: any, today: any) {
	const received = isoDate(r.received);
	const scheduled = isoDate(r.scheduled);
	return {
		id: r.id,
		kind: r.kind,
		callId: r.call_id,
		contact: r.contact,
		phone: r.phone,
		received,
		customer: r.customer,
		equipment: r.equipment,
		issue: r.issue,
		callType: r.call_type,
		phoneResolved: !!r.phone_resolved,
		status: r.status,
		technician: r.technician,
		secondaryTech: r.technician2 ?? null,
		wo: r.wo,
		scheduled,
		scheduledTime: cleanTime(r.sched_time),
		notes: r.notes,
		workDone: r.work_done ?? null,
		completedAt: isoDate(r.completed_at),
		done: !!r.done,
		updatedAt: String(r.updated_at),
		urgency: r.urgency || "Normal",
		duplicateOf: r.duplicate_of ?? null,
		mergedInstallId: r.merged_install_id == null ? null : Number(r.merged_install_id),
		mergedInstallAt: r.merged_install_at ? (r.merged_install_at instanceof Date ? r.merged_install_at.toISOString() : String(r.merged_install_at)) : null,
		mergedInstallBy: r.merged_install_by ?? null,
		// A ticket merged into an install as billed (10/30): what on, from the merge log when read with it (getJob), else
		// its Sales Order (no SO goes on after a merge). Billed on NetSuite invoices alone, only the log has it.
		mergedBilledOn: r.merged_install_id != null ? String(r.merged_billed_on ?? "").trim() || String(r.ns_so ?? "").trim() || null : null,
		siblings: [],
		serialNotice: r.serial_notice ?? null,
		aviKatz: false,
		flag: serviceFlag({
			kind: r.kind,
			status: r.status,
			done: !!r.done,
			received,
			scheduled
		}, today),
		ageDays: received ? diffDays(received, today) : null
	};
}
function mapPm(r: any, today: any) {
	const projected = isoDate(r.projected);
	return {
		id: r.id,
		customer: r.customer,
		received: isoDate(r.received),
		equipment: r.equipment,
		style: r.style,
		projected,
		scheduledTime: cleanTime(r.sched_time),
		partsStatus: r.parts_status,
		status: r.status,
		technician: r.technician,
		notes: r.notes,
		wo: r.wo ?? null,
		workDone: r.work_done ?? null,
		completedAt: isoDate(r.completed_at),
		done: !!r.done,
		updatedAt: String(r.updated_at),
		flag: pmFlag({
			status: r.status,
			done: !!r.done,
			projected
		}, today),
		aviKatz: false,
		stackedJobId: r.stacked_job_id == null ? null : Number(r.stacked_job_id)
	};
}
function mapInstall(r: any, today: any, week: any, catalog: any[] = []) {
	const installDate = isoDate(r.install_date);
	return {
		id: r.id,
		received: isoDate(r.received),
		customer: r.customer,
		equipment: r.equipment,
		equipStatus: r.equip_status,
		installDate,
		scheduledTime: cleanTime(r.sched_time),
		technician: r.technician,
		wo: r.wo,
		// Filled by withWorkOrders.
		workOrders: [],
		customerLockedAt: r.customer_locked_at ? String(r.customer_locked_at instanceof Date ? r.customer_locked_at.toISOString() : r.customer_locked_at) : null,
		customerLockedBy: r.customer_locked_by ?? null,
		reqsReady: r.reqs_ready,
		notes: r.notes,
		workDone: r.work_done ?? null,
		completedAt: isoDate(r.completed_at),
		accountRep: r.account_rep,
		paymentStatus: r.payment_status,
		serial: r.serial ?? null,
		powerVoltage: r.power_voltage ?? null,
		machines: specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, catalog),
		serialNotice: r.serial_notice ?? null,
		complete: !!r.complete,
		trfIssued: !!r.trf_issued,
		installType: installTypeOf(r.install_type),
		siteContact: r.site_contact ?? null,
		contactPhone: r.contact_phone ?? null,
		dealId: r.deal_id,
		duplicateOf: r.duplicate_of ?? null,
		updatedAt: String(r.updated_at),
		flag: installFlag({
			equipStatus: r.equip_status,
			installDate,
			reqsReady: r.reqs_ready,
			complete: !!r.complete
		}, today, week),
		daysOut: installDate ? diffDays(today, installDate) : null,
		aviKatz: false,
		noRep: isNoRep(r.account_rep)
	};
}
function mapDeal(r: any, marks: any) {
	const customer = String(r.customer);
	// A deal with no rep of its own shows the rep saved on the customer account.
	const producer = (String(r.producer ?? "").trim() ? r.producer : null) ?? (marks ? accountRepFor(marks, customer) : null);
	return {
		id: r.id,
		customer,
		producer,
		accountType: r.account_type ?? null,
		dateOfDeal: isoDate(r.date_of_deal),
		equipment: r.equipment ?? null,
		accountNumber: marks ? accountNumberFor(marks, customer) : null,
		machines: parseMachinesJson(r.machines ?? null),
		amount: num(r.amount),
		goodToOrder: !!r.good_to_order,
		ordered: !!r.ordered,
		eta: r.eta ?? null,
		terms: r.terms ?? null,
		invoice: r.invoice ?? null,
		completion: r.completion ?? null,
		notes: r.notes ?? null,
		handedOff: !!r.handed_off,
		projects: [],
		updatedAt: String(r.updated_at),
		aviKatz: marks ? isAviKatz(marks, customer) : false,
		noRep: isNoRep(producer)
	};
}
function applyMarks(rows: any, marks: any) {
	for (const r of rows) {
		r.aviKatz = isAviKatz(marks, r.customer ?? null);
		r.accountNumber = accountNumberFor(marks, r.customer ?? null);
		// Installs without their own rep show the rep saved on the customer account.
		if ("accountRep" in r && !String(r.accountRep ?? "").trim()) {
			const rep = accountRepFor(marks, r.customer ?? null);
			if (rep) {
				r.accountRep = rep;
				r.noRep = isNoRep(rep);
			}
		}
	}
	return rows;
}
function mapModule(r: any) {
	return {
		id: r.id,
		moduleId: String(r.module_id),
		platform: r.platform ?? null,
		moduleType: r.module_type ?? null,
		status: String(r.status),
		wo: r.wo ?? null,
		location: r.location ?? null,
		dateIn: isoDate(r.date_in),
		dateReady: isoDate(r.date_ready),
		technician: r.technician ?? null,
		notes: r.notes ?? null,
		updatedAt: String(r.updated_at),
		assignedCustomer: r.assigned_customer ?? null,
		assignedUnitId: r.assigned_unit_id ?? null,
		assignedUnitLabel: r.assigned_unit_label ?? null,
		assignedAt: r.assigned_at ? String(r.assigned_at) : null,
		returnPending: !!r.return_pending,
		returnBy: r.return_by ?? null,
		returnByName: r.return_by_name ?? null
	};
}
function mapComment(r: any, owners: any) {
	const base = {
		id: r.id,
		entityType: String(r.entity_type),
		entityId: r.entity_id,
		authorId: r.author_id ?? null,
		authorName: r.author_id ? r.author_name ?? null : null,
		body: String(r.body),
		askTeam: r.ask_team ?? null,
		resolved: !!r.resolved,
		createdAt: String(r.created_at),
		pingedAt: r.pinged_at ? String(r.pinged_at) : null
	};
	const owner = noteOwner(base, owners);
	return {
		...base,
		ownerLabel: owner.label,
		canClaim: owner.canClaim
	};
}
function mapAsset(r: any) {
	const pallet = r.pallet;
	const level = num(r.level);
	const lineNo = num(r.line_no);
	const bayNeeded = needsBay(r.site, pallet);
	return {
		id: r.id,
		kind: r.kind,
		model: r.model,
		serial: r.serial,
		qty: num(r.qty) ?? 1,
		customerOwned: r.customer_owned,
		site: r.site,
		pallet,
		level,
		lineNo,
		purpose: r.purpose,
		status: r.status,
		soldTo: r.sold_to,
		soldAt: isoDate(r.sold_at),
		installId: r.install_id,
		jobId: r.job_id ?? null,
		notes: r.notes,
		updatedAt: String(r.updated_at),
		bay: bayFor(r.site, pallet),
		slotLabel: bayNeeded ? "Needs bay" : pallet && level ? slotId(pallet, level, lineNo) : siteLabel(r.site),
		missingSerial: r.kind === "equip" && !r.serial,
		needsBay: bayNeeded,
		reviewStatus: r.review_status === "pending" || r.review_status === "approved" || r.review_status === "rejected" ? r.review_status : null,
		reviewNote: r.review_note ?? null,
		shopTest: r.shop_test === "tested" || r.shop_test === "needs-test" ? r.shop_test : null,
		shopTestNote: r.shop_test_note ?? null,
		shopTestBy: r.shop_test_by ?? null,
		shopTestAt: r.shop_test_at ? String(r.shop_test_at) : null,
		stockHold: r.stock_hold === "remove" || r.stock_hold === "assign" ? r.stock_hold : null,
		stockHoldCustomer: r.stock_hold_customer ?? null,
		stockHoldReason: r.stock_hold_reason ?? null,
		stockHoldBy: r.stock_hold_by ?? null,
		lockedAt: r.locked_at ? (r.locked_at instanceof Date ? r.locked_at.toISOString() : String(r.locked_at)) : null,
		lockedBy: r.locked_at ? r.locked_by ?? null : null
	};
}
function mapRecipe(r: any) {
	return {
		id: r.id,
		name: r.name ?? null,
		equipmentModel: String(r.equipment_model),
		customer: r.customer ?? null,
		installId: num(r.install_id),
		copiedFrom: num(r.copied_from),
		isTemplate: Boolean(r.is_template),
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
		updatedAt: String(r.updated_at)
	};
}
export const getDashboard = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Dashboard> => {
	const sql = await ready();
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const marks = await loadAccountMarks(sql);
	const jobs = applyMarks(attachJobSiblings((await sql`select * from service_jobs`).map((r: any) => mapJob(r, today))).filter((j: any) => !j.duplicateOf), marks);
	const pms = applyMarks((await sql`select * from pm_jobs`).map((r: any) => mapPm(r, today)), marks);
	const installs = await withInspections(sql, applyMarks((await sql`select * from installs where archived = false`).map((r: any) => mapInstall(r, today, week, catalog)), marks));
	const deals = (await sql`select * from deals where archived = false`).map((r: any) => mapDeal(r, marks));
	const svc = jobs.filter((j: any) => j.kind === "service");
	const tlc = jobs.filter((j: any) => j.kind === "tlc");
	const svcActive = svc.filter((j: any) => isOpenCall(j));
	const tlcActive = tlc.filter((j: any) => isOpenCall(j));
	const pmActive = pms.filter((p: any) => isOpenPm(p));
	const flaggedSvc = svc.filter((j: any) => j.flag).sort((a: any, b: any) => a.flag.rank - b.flag.rank || (a.ageDays ?? 0) - (b.ageDays ?? 0) || a.id - b.id);
	const flaggedTlc = tlc.filter((j: any) => j.flag).sort((a: any, b: any) => (a.received ?? "").localeCompare(b.received ?? ""));
	const flaggedPm = pms.filter((p: any) => p.flag);
	const toFlag = (j: any, type: any) => ({
		id: j.id,
		entityType: type,
		customer: j.customer ?? "Untitled",
		flag: j.flag,
		status: j.status,
		received: j.received,
		scheduled: j.scheduled,
		technician: j.technician,
		detail: j.wo,
		kind: j.kind
	});
	const comingDue: ComingDueRow[] = [];
	const laterHorizon = addDays(week.end, 21);
	const pushDue = (row: ComingDueRow) => {
		comingDue.push(row);
	};
	for (const j of jobs) {
		if (isClosedCall(j) || !j.scheduled) continue;
		if (j.scheduled > laterHorizon) continue;
		const accountRep = accountRepFor(marks, j.customer);
		pushDue({
			daysOut: diffDays(today, j.scheduled),
			source: j.kind === "tlc" ? "TLC + Factor" : "Service Tracker",
			kind: j.kind,
			customer: j.customer ?? "Untitled",
			equipment: j.equipment,
			status: j.status,
			scheduled: j.scheduled,
			technician: j.technician,
			accountRep,
			detail: j.wo ?? j.callId,
			wo: j.wo,
			entityType: j.kind,
			id: j.id,
			aviKatz: j.aviKatz,
			noRep: isNoRep(accountRep)
		});
	}
	for (const p of pms) {
		if (isClosedPm(p) || !p.projected) continue;
		if (p.projected > laterHorizon) continue;
		const accountRep = accountRepFor(marks, p.customer);
		pushDue({
			daysOut: diffDays(today, p.projected),
			source: "PM Tracker",
			kind: "pm",
			customer: p.customer,
			equipment: p.equipment,
			status: p.status,
			scheduled: p.projected,
			technician: p.technician,
			accountRep,
			detail: p.style ?? p.wo,
			wo: p.wo,
			entityType: "pm",
			id: p.id,
			aviKatz: p.aviKatz,
			noRep: isNoRep(accountRep)
		});
	}
	for (const i of installs) {
		if (isInstalled(i) || !i.installDate) continue;
		if (i.installDate > laterHorizon) continue;
		pushDue({
			daysOut: diffDays(today, i.installDate),
			source: "Installs",
			kind: "install",
			customer: i.customer,
			equipment: i.equipment,
			status: i.equipStatus ?? "",
			scheduled: i.installDate,
			technician: i.technician,
			accountRep: i.accountRep,
			detail: i.wo ?? i.equipment,
			wo: i.wo,
			entityType: "install",
			id: i.id,
			aviKatz: i.aviKatz,
			noRep: i.noRep,
			inspectionStatus: i.inspection?.overall ?? "Not started",
			failedItems: i.inspection?.failedItems?.length ? i.inspection.failedItems.join(", ") : null
		});
	}
	comingDue.sort((a, b) => a.daysOut - b.daysOut || a.customer.localeCompare(b.customer));
	const statusBreakdown = [
		"Open",
		"Dispatched",
		"In Progress",
		"Follow-up Needed",
		"Phone Resolved",
		"Completed",
		"Cancelled"
	].map((status) => ({
		status,
		service: svc.filter((j) => j.status === status).length,
		tlc: tlc.filter((j) => j.status === status).length
	}));
	const { loadTechs } = await import("./roster");
	const roster = await loadTechs(sql);
	const activeNames = roster.filter((t) => t.active).map((t) => t.name);
	const assigned = [...new Set(jobs.map((j) => j.technician).filter((n) => !!n))];
	const techNames = [...activeNames];
	for (const n of assigned) {
		if (techNames.some((x) => sameTech(x, n))) continue;
		if (jobs.some((j) => j.technician === n && isOpenCall(j))) techNames.push(n);
	}
	const techLoad = techNames.map((tech) => {
		const all = jobs.filter((j) => sameTech(j.technician, tech));
		const row = roster.find((t) => sameTech(t.name, tech));
		return {
			tech: row && !row.active ? `${tech} (inactive)` : tech,
			active: all.filter((j) => isOpenCall(j)).length,
			completed: all.filter((j) => j.status === "Completed" || j.done).length
		};
	});
	const comments = await sql`
      select * from comments order by created_at desc limit 12`;
	const recentHandoff = [];
	for (const c of comments) {
		const ctx = await entityContext(sql, String(c.entity_type), Number(c.entity_id));
		const mapped = mapComment(c, ctx);
		recentHandoff.push({
			...mapped,
			customer: ctx.customer
		});
	}
	const openAsks = await sql`
      select count(*)::int as c from comments where ask_team is not null and resolved = false`;
	const pendingHandoffs = uniquePendingHandoffs(deals);
	const installQueue = installs.filter((i) => isOpenInstall(i));
	const installAtRisk = installQueue.filter((i) => i.flag).length;
	const installReadyRows = installQueue.filter((i) => i.equipStatus === "Ready" && i.inspection?.overall === "Passed");
	const installReadyByEquip = (() => {
		const map = new Map();
		for (const i of installReadyRows) {
			const names = (i.machines ?? []).map((m) => m.equipment).filter(Boolean);
			const keys = names.length ? names : listedEquipment(i.equipment, catalog);
			const used = keys.length ? keys : ["Unspecified"];
			for (const name of used) map.set(name, (map.get(name) ?? 0) + 1);
		}
		return [...map.entries()].map(([name, count]) => ({
			name,
			count
		})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 12);
	})();
	const barnReady = await sql`
      select coalesce(sum(qty), 0)::int as c from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'`;
	const barnLines = await sql`
      select count(*)::int as c from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'`;
	const barnReadyByModel = await sql`
      select model as name, coalesce(sum(qty), 0)::int as count
      from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'
      group by model
      order by count desc, name
      limit 12`;
	const modulesReadyByType = await sql`
      select coalesce(nullif(trim(module_type), ''), 'Unspecified') as name, count(*)::int as count
      from modules
      where status = 'Ready'
      group by 1
      order by count desc, name`;
	const modulesReady = modulesReadyByType.reduce((n, r) => n + Number(r.count), 0);
	const liveDeals = deals.filter((d) => d.completion !== "fell");
	const openDeals = liveDeals.filter((d) => d.completion !== "complete");
	const doneDeals = liveDeals.filter((d) => d.completion === "complete");
	const comingDueBuckets = Array.from({ length: 15 }, (_, day) => ({
		label: day === 0 ? "Today" : `${day}d`,
		day,
		count: comingDue.filter((r) => r.daysOut === day).length
	}));
	const comingDueCounts = {
		overdue: comingDue.filter((r) => r.daysOut < 0).length,
		today: comingDue.filter((r) => r.daysOut === 0).length,
		thisWeek: comingDue.filter((r) => r.daysOut > 0 && r.scheduled <= week.end).length,
		later: comingDue.filter((r) => r.daysOut > 0 && r.scheduled > week.end).length
	};
	const { loadRebuilds } = await import("./rebuilds");
	const rebuilds = await loadRebuilds(sql, today).catch(() => []);
	const rebuildAlerts = rebuilds.filter((r) => r.clockFlag).map((r) => ({
		id: r.id,
		entityType: "rebuild",
		customer: r.account,
		flag: {
			code: r.clockFlag === "overdue" ? "rebuild_overdue" : "rebuild_waiting",
			label: r.clockFlag === "overdue" ? "Rebuild overdue" : "Waiting 5+ days",
			level: r.clockFlag === "overdue" ? "danger" : "warn",
			rank: r.clockFlag === "overdue" ? 6 : 16
		},
		status: r.status,
		received: r.createdAt.slice(0, 10),
		scheduled: r.targetComplete,
		technician: r.owner,
		detail: r.title,
		kind: "rebuild"
	}));
	return {
		today,
		weekLabel: formatWeekLabel(week.start, week.end),
		nextWeekLabel: formatWeekLabel(week.nextStart, week.nextEnd),
		kpis: {
			svcFlags: flaggedSvc.length,
			tlcFlags: flaggedTlc.length,
			pmFlags: flaggedPm.length,
			activeCalls: svcActive.length + tlcActive.length,
			pmsActive: pmActive.length,
			comingDue: comingDueCounts.overdue + comingDueCounts.today + comingDueCounts.thisWeek,
			installQueue: installQueue.length,
			installAtRisk,
			openAsks: openAsks[0]?.c ?? 0,
			barnReady: barnReady[0]?.c ?? 0,
			barnOpen: Math.max(0, BARN_EQUIP_CAPACITY - (barnLines[0]?.c ?? 0)),
			modulesReady,
			installReady: installReadyRows.length,
			rebuildOverdue: rebuilds.filter((r) => r.health === "overdue").length,
			rebuildWaiting: rebuilds.filter((r) => r.status === "Waiting").length
		},
		statusBreakdown,
		techLoad,
		flagged: {
			service: flaggedSvc.slice(0, 12).map((j) => toFlag(j, "service")),
			tlc: flaggedTlc.slice(0, 12).map((j) => toFlag(j, "tlc")),
			pm: flaggedPm.slice(0, 12).map((p) => ({
				id: p.id,
				entityType: "pm",
				customer: p.customer,
				flag: p.flag,
				status: p.status,
				received: p.received,
				scheduled: p.projected,
				technician: p.technician,
				detail: p.style
			}))
		},
		comingDue,
		comingDueBuckets,
		comingDueCounts,
		rebuildAlerts,
		recentHandoff,
		pendingHandoffs,
		barnReadyByModel,
		modulesReadyByType,
		installReadyByEquip,
		installStatus: [
			{
				name: "Ready",
				count: installReadyRows.length
			},
			{
				name: "Not ready",
				count: installQueue.filter((i) => i.equipStatus !== "Ready").length
			},
			{
				name: "Installed",
				count: installs.filter((i) => isInstalled(i)).length
			}
		],
		pipelineSnap: {
			openCount: openDeals.length,
			openValue: openDeals.reduce((n, d) => n + (d.amount ?? 0), 0),
			goodToOrder: openDeals.filter((d) => d.goodToOrder && !d.ordered).length,
			ordered: openDeals.filter((d) => d.ordered).length,
			completeCount: doneDeals.length,
			completeValue: doneDeals.reduce((n, d) => n + (d.amount ?? 0), 0)
		}
	};
});
async function entityContext(sql: any, type: any, id: any) {
	const empty = {
		customer: null,
		technician: null,
		producer: null,
		accountRep: null
	};
	if (type === "service" || type === "tlc") {
		const r = await sql`
      select customer, technician from service_jobs where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			technician: r[0]?.technician ?? null
		};
	}
	if (type === "pm") {
		const r = await sql`
      select customer, technician from pm_jobs where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			technician: r[0]?.technician ?? null
		};
	}
	if (type === "install") {
		const r = await sql`
      select customer, technician, account_rep from installs where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			technician: r[0]?.technician ?? null,
			accountRep: r[0]?.account_rep ?? null
		};
	}
	if (type === "deal") {
		const r = await sql`
      select customer, producer from deals where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.customer ?? null,
			producer: r[0]?.producer ?? null
		};
	}
	if (type === "module") {
		const r = await sql`
      select location, module_id, technician from modules where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.location ?? r[0]?.module_id ?? null,
			technician: r[0]?.technician ?? null
		};
	}
	if (type === "rebuild") {
		const r = await sql`
      select account, owner from rebuilds where id = ${id}`;
		return {
			...empty,
			customer: r[0]?.account ?? null,
			technician: r[0]?.owner ?? null
		};
	}
	return empty;
}
export const listJobs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { kind: "service" | "tlc" }) => d).handler(async ({ data, context }: any): Promise<ServiceJob[]> => {
	const sql = await ready();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	// A sales rep sees only the accounts assigned to them.
	const scope = await salesRepScope(sql, context.userId);
	return applyMarks(attachJobSiblings((await sql`select * from service_jobs order by received desc nulls last, id desc`).map((r) => mapJob(r, today))), marks).filter((j) => j.kind === data.kind && (!scope || scope(accountRepFor(marks, j.customer ?? null))));
});
export const getJob = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { id: number }) => d).handler(async ({ data, context }: any): Promise<ServiceJob | null> => {
	const sql = await ready();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	// With what a ticket merged into an install as billed was billed on (10/30), for its banner.
	const rows = await sql.query(`select j.*, ${BILLED_ON_INSTALL("j.id")} as merged_billed_on from service_jobs j where j.id = $1`, [data.id]);
	if (!rows[0]) return null;
	const scope = await salesRepScope(sql, context.userId);
	if (scope && !scope(accountRepFor(marks, rows[0].customer ?? null))) return null;
	const others = await sql`
      select * from service_jobs where coalesce(wo, '') <> ''`;
	return applyMarks(attachJobSiblings([rows[0], ...others.filter((r) => r.id !== rows[0].id)].map((r) => mapJob(r, today))), marks).find((j) => j.id === data.id) ?? null;
});
const jobPatch = z.object({
	id: z.number(),
	contact: z.string().nullable().optional(),
	phone: z.string().nullable().optional(),
	received: z.string().nullable().optional(),
	customer: z.string().nullable().optional(),
	equipment: z.string().nullable().optional(),
	issue: z.string().nullable().optional(),
	callType: z.string().nullable().optional(),
	phoneResolved: z.boolean().optional(),
	status: z.string().optional(),
	technician: z.string().nullable().optional(),
	secondaryTech: z.string().nullable().optional(),
	wo: z.string().nullable().optional(),
	scheduled: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	workDone: z.string().nullable().optional(),
	completedAt: z.string().nullable().optional(),
	done: z.boolean().optional(),
	urgency: z.string().optional()
});
export const updateJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: z.infer<typeof jobPatch>) => jobPatch.parse(d)).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`select * from service_jobs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Job not found");
	// A ticket merged into an install is hidden; its work is on the install now (10/30).
	if (cur[0].merged_install_id) throw new Error(`This ticket was merged into install #${cur[0].merged_install_id}. Open the install to keep working.`);
	if (data.customer !== undefined) {
		const partners = await sql`select id, customer from pm_jobs where stacked_job_id = ${data.id}`;
		const refusal = stackCustomerRefusal(cur[0].customer, data.customer, partners.map((p: { id: number; customer: string | null }) => ({ id: Number(p.id), customer: p.customer })), "ticket");
		if (refusal) throw new Error(refusal);
	}
	const next = {
		contact: data.contact ?? cur[0].contact,
		phone: data.phone ?? cur[0].phone,
		received: data.received === undefined ? cur[0].received : data.received,
		customer: data.customer ?? cur[0].customer,
		equipment: data.equipment ?? cur[0].equipment,
		issue: data.issue ?? cur[0].issue,
		call_type: data.callType === undefined ? cur[0].call_type : data.callType,
		phone_resolved: data.phoneResolved === undefined ? cur[0].phone_resolved : data.phoneResolved,
		status: data.status ?? cur[0].status,
		technician: data.technician === undefined ? cur[0].technician : data.technician,
		technician2: data.secondaryTech === undefined ? cur[0].technician2 ?? null : data.secondaryTech || null,
		wo: data.wo === undefined ? cur[0].wo : data.wo,
		scheduled: data.scheduled === undefined ? cur[0].scheduled : data.scheduled,
		notes: data.notes === undefined ? cur[0].notes : data.notes,
		work_done: data.workDone === undefined ? cur[0].work_done : data.workDone,
		completed_at: data.completedAt === undefined ? cur[0].completed_at : data.completedAt,
		done: data.done === undefined ? cur[0].done : data.done,
		urgency: data.urgency ?? cur[0].urgency ?? "Normal"
	};
	if (CLOSED_CALL.has(next.status)) next.done = true;
	else if (data.status) next.done = false;
	// The secondary is a different person from the primary; with no primary, the secondary becomes the primary.
	if (next.technician2 && sameTech(next.technician2, next.technician)) next.technician2 = null;
	if (next.technician2 && !next.technician) {
		next.technician = next.technician2;
		next.technician2 = null;
	}
	if (next.status === "Phone Resolved") next.phone_resolved = true;
	else if (data.status && next.status !== "Phone Resolved") next.phone_resolved = false;
	const written = await sql`
      update service_jobs set
        contact = ${next.contact},
        phone = ${next.phone},
        received = ${next.received},
        customer = ${next.customer},
        equipment = ${next.equipment},
        issue = ${next.issue},
        call_type = ${next.call_type},
        phone_resolved = ${next.phone_resolved},
        status = ${next.status},
        technician = ${next.technician},
        technician2 = ${next.technician2},
        wo = ${next.wo},
        scheduled = ${next.scheduled},
        notes = ${next.notes},
        work_done = ${next.work_done},
        completed_at = ${next.completed_at},
        done = ${next.done},
        urgency = ${next.urgency},
        updated_at = now()
      where id = ${data.id} and merged_install_id is null
      returning id`;
	if (!written[0]) {
		// Merged into an install after the read above (10/30): nothing is written onto the hidden ticket.
		const now = (await sql`select merged_install_id from service_jobs where id = ${data.id}`)[0];
		throw new Error(now?.merged_install_id ? `This ticket was merged into install #${now.merged_install_id}. Open the install to keep working.` : "Job not found");
	}
	if (data.status && data.status !== cur[0].status) await logActivity(sql, context.userId, cur[0].kind, data.id, "status", `${cur[0].status} → ${data.status}`);
	const extra = summarize([
		changed("customer", cur[0].customer, next.customer),
		changed("technician", cur[0].technician, next.technician),
		changed("secondary tech", cur[0].technician2 ?? null, next.technician2),
		changed("equipment", cur[0].equipment, next.equipment),
		changed("issue", cur[0].issue, next.issue),
		changed("urgency", cur[0].urgency, next.urgency),
		changed("scheduled", cur[0].scheduled, next.scheduled)
	]);
	if (extra) await logActivity(sql, context.userId, cur[0].kind, data.id, "updated", extra);
	return getJob({ data: { id: data.id } });
});
const mergeInput = z.object({ keeperId: z.number().int().positive(), extraId: z.number().int().positive() });
export const mergeServiceTickets = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: z.input<typeof mergeInput>) => mergeInput.parse(d)).handler(async ({ data, context }: any): Promise<ServiceJob | null> => {
	const sql = await ready();
	if (data.keeperId === data.extraId) throw new Error("Pick a different ticket to merge into.");
	const actor = await deskUsername(sql, context.userId);
	const result = await mergeServiceJobs(sql, data.keeperId, data.extraId, actor);
	if (!result) throw new Error("Could not merge those tickets.");
	if ("refused" in result) throw new Error(result.refused);
	return getJob({ data: { id: result.keeperId } });
});
export const createJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { kind: "service" | "tlc"; customer: string; issue?: string; equipment?: string; contact?: string; phone?: string; received?: string; callType?: string; technician?: string; urgency?: string }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const received = data.received || todayChicago();
	const prefix = `SC-${received.replace(/-/g, "").slice(0, 6)}-`;
	const last = await sql`
      select call_id from service_jobs
      where call_id like ${prefix + "%"}
      order by call_id desc limit 1`;
	let seq = 1;
	if (last[0]) {
		const n = Number(last[0].call_id.slice(-3));
		if (Number.isFinite(n)) seq = n + 1;
	}
	const callId = `${prefix}${String(seq).padStart(3, "0")}`;
	const urgency = data.urgency || "Normal";
	const rows = await sql`
      insert into service_jobs (kind, call_id, customer, issue, equipment, contact, phone, received, call_type, technician, status, urgency)
      values (${data.kind}, ${callId}, ${data.customer}, ${data.issue ?? null}, ${data.equipment ?? null}, ${data.contact ?? null}, ${data.phone ?? null}, ${received}, ${data.callType ?? "Field Service"}, ${data.technician ?? null}, ${"Open"}, ${urgency})
      returning id`;
	await logActivity(sql, context.userId, data.kind, rows[0].id, "opened", [data.customer, data.issue].filter(Boolean).join(" · ") || null);
	return getJob({ data: { id: rows[0].id } });
});
/**
 * A tech was assigned to an install: tell the rep on the account they are good to issue the Tech Request Form.
 * The ping opens that install. The Tech Request Form box is never ticked here — Sales ticks it.
 */
async function pingRepTechAssigned(sql: any, fromUserId: string, v: { id: number; customer: string; before: string | null; after: string | null; rep: string | null }) {
	const tech = (v.after ?? "").trim();
	if (!tech || sameTech(v.before, tech)) return;
	try {
		const marks = await loadAccountMarks(sql);
		const rep = (v.rep ?? "").trim() || accountRepFor(marks, v.customer);
		if (!rep || isNoRep(rep)) return;
		// The rep's own Desk sign-in: matched on their name, the way My View matches it.
		const accounts = (await sql.query("select user_id, username, approved from desk_accounts")) as any[];
		const to = accounts.filter((a) => (a.approved === true || a.approved === "true" || a.approved === 1) && namesMatchUser({ displayName: null, primaryEmail: null, username: a.username }, rep)).map((a) => String(a.user_id));
		if (!to.length) return;
		const body = techRequestPing(canonicalTechName(tech) ?? tech, v.customer);
		await deliverPings(sql, { fromUserId, body, entityType: "install", entityId: v.id, toUserIds: to });
	} catch {
		// A ping that cannot be sent never blocks assigning the tech.
	}
}
/**
 * Planner day board: a block dropped on another time or another tech. Sets the day, the time of day and the
 * assigned tech in one write. Completed and cancelled work is refused — it stays where it was done.
 */
export const moveBoardBlock = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { type: BoardType; id: number; date: string; time: string | null; technician: string | null }) => z.object({
	type: z.enum(["service", "tlc", "pm", "install"]),
	id: z.number().int().positive(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	time: z.string().nullable(),
	technician: z.string().trim().max(80).nullable()
}).parse(d)).handler(async ({ data, context }: any) => moveBoardBlockFor(await ready(), data, context));
/** The body of moveBoardBlock. */
export async function moveBoardBlockFor(sql: any, data: { type: BoardType; id: number; date: string; time: string | null; technician: string | null }, context: { userId: string }): Promise<{ ok: true; date: string; time: string | null; technician: string | null }> {
	const time = data.time == null ? null : cleanTime(data.time);
	if (data.time != null && !time) throw new Error("That is not a time of day.");
	const tech = data.technician ? canonicalTechName(data.technician) ?? data.technician : null;
	const table = data.type === "pm" ? "pm_jobs" : data.type === "install" ? "installs" : "service_jobs";
	const dateCol = data.type === "pm" ? "projected" : data.type === "install" ? "install_date" : "scheduled";
	const cur = (await sql.query(`select * from ${table} where id = $1`, [data.id]))[0] as any;
	if (!cur) throw new Error("That work is no longer on the Desk.");
	// A ticket merged into an install (10/30) is planned on the install now: a board opened before the merge is refused.
	const mergedInto = (id: unknown) => `This ticket was merged into install #${id}. Plan the install instead.`;
	if (table === "service_jobs" && cur.merged_install_id) throw new Error(mergedInto(cur.merged_install_id));
	const locked = data.type === "install" ? isInstalled({ complete: cur.complete, equipStatus: cur.equip_status }) : boardLocked({ status: cur.status, done: cur.done });
	if (locked) throw new Error("Completed and cancelled work does not move.");
	const moved = await sql.query(
		`update ${table} set ${dateCol} = $2, sched_time = $3, technician = $4, updated_at = now() where id = $1${table === "service_jobs" ? " and merged_install_id is null" : ""} returning id`,
		[data.id, data.date, time, tech]
	);
	if (!moved[0]) {
		const into = table === "service_jobs" ? (await sql.query("select merged_install_id from service_jobs where id = $1", [data.id]))[0]?.merged_install_id : null;
		throw new Error(into ? mergedInto(into) : "That work is no longer on the Desk.");
	}
	if (data.type === "install") await pingRepTechAssigned(sql, context.userId, { id: data.id, customer: String(cur.customer), before: cur.technician, after: tech, rep: cur.account_rep });
	// The new primary cannot also be the ticket's secondary.
	if (table === "service_jobs" && tech && sameTech(cur.technician2, tech)) await sql.query("update service_jobs set technician2 = null where id = $1", [data.id]);
	const was = isoDate(cur[dateCol]);
	const extra = summarize([
		changed("scheduled", [was, cleanTime(cur.sched_time)].filter(Boolean).join(" ") || null, [data.date, time].filter(Boolean).join(" ")),
		changed("technician", cur.technician, tech)
	]);
	if (extra) await logActivity(sql, context.userId, data.type === "service" || data.type === "tlc" ? cur.kind : data.type, data.id, "updated", extra);
	return { ok: true, date: data.date, time, technician: tech };
}
export const listPms = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async ({ context }: any): Promise<PmJob[]> => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	// A sales rep sees only the accounts assigned to them.
	const scope = await salesRepScope(sql, context.userId);
	return applyMarks((await sql`select * from pm_jobs order by received desc nulls last, id desc`).map((r) => mapPm(r, todayChicago())), marks).filter((p: any) => !scope || scope(accountRepFor(marks, p.customer ?? null)));
});
export const getPm = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d)).handler(async ({ data, context }: any): Promise<PmJob | null> => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	const rows = await sql`select * from pm_jobs where id = ${data.id}`;
	if (!rows[0]) return null;
	const scope = await salesRepScope(sql, context.userId);
	const [pm] = applyMarks([mapPm(rows[0], todayChicago())], marks);
	if (scope && !scope(accountRepFor(marks, pm.customer ?? null))) return null;
	return pm;
});
export const updatePm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; customer?: string; equipment?: string | null; style?: string | null; projected?: string | null; partsStatus?: string | null; status?: string; technician?: string | null; notes?: string | null; workDone?: string | null; completedAt?: string | null; done?: boolean; wo?: string | null }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`select * from pm_jobs where id = ${data.id}`;
	if (!cur[0]) throw new Error("PM not found");
	if (data.customer !== undefined && cur[0].stacked_job_id) {
		const partners = await sql`select id, customer from service_jobs where id = ${cur[0].stacked_job_id}`;
		const refusal = stackCustomerRefusal(
			cur[0].customer,
			data.customer,
			partners.map((p: { id: number; customer: string | null }) => ({ id: Number(p.id), customer: p.customer })),
			"pm",
		);
		if (refusal) throw new Error(refusal);
	}
	const c = cur[0];
	const status = data.status ?? c.status;
	const done = data.done === undefined ? data.status === undefined ? c.done : CLOSED_PM.has(status) : data.done;
	const completedAt = data.completedAt === undefined ? c.completed_at : data.completedAt;
	const completing =
		(status === "Completed" && c.status !== "Completed") ||
		(done === true && !c.done && status !== "Cancelled") ||
		(!!completedAt && !c.completed_at);
	let completionPlan: Awaited<ReturnType<typeof loadPmRunbookPlan>> | null = null;
	if (completing) {
		completionPlan = await loadPmRunbookPlan(
			sql,
			String(data.customer ?? c.customer ?? ""),
			data.equipment === undefined ? c.equipment : data.equipment,
			data.id,
		);
		const refusal = pmCompletionRefusal(completionPlan.planned);
		if (refusal) throw new Error(refusal);
	}
	await sql`
      update pm_jobs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === undefined ? c.equipment : data.equipment},
        style = ${data.style === undefined ? c.style : data.style},
        projected = ${data.projected === undefined ? c.projected : data.projected},
        parts_status = ${data.partsStatus === undefined ? c.parts_status : data.partsStatus},
        status = ${status},
        technician = ${data.technician === undefined ? c.technician : data.technician},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        wo = ${data.wo === undefined ? c.wo : data.wo},
        work_done = ${data.workDone === undefined ? c.work_done : data.workDone},
        completed_at = ${data.completedAt === undefined ? c.completed_at : data.completedAt},
        done = ${done},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.status, status),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("technician", c.technician, data.technician === undefined ? c.technician : data.technician),
		changed("equipment", c.equipment, data.equipment === undefined ? c.equipment : data.equipment)
	]);
	if (extra) await logActivity(sql, context.userId, "pm", data.id, "updated", extra);
	if (completing && completionPlan) {
		await stampMachineParts(sql, data.id, completionPlan.machines);
		await recordCompletedRunbook(sql, data.id, context.userId, completionPlan.planned, data.style === undefined ? c.style : data.style);
	}
	return mapPm((await sql`select * from pm_jobs where id = ${data.id}`)[0], todayChicago());
});
export const createPm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { customer: string; equipment?: string; style?: string }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const rows = await sql`
      insert into pm_jobs (customer, equipment, style, received, status)
      values (${data.customer}, ${data.equipment ?? null}, ${data.style ?? DEFAULT_PM_STYLE}, ${todayChicago()}, ${"Pending Scheduling"})
      returning id`;
	await logActivity(sql, context.userId, "pm", rows[0].id, "opened", data.customer);
	return mapPm((await sql`select * from pm_jobs where id = ${rows[0].id}`)[0], todayChicago());
});
export const listModules = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<ModuleRow[]> => {
	const sql = await ready();
	const { ensureModuleSchema } = await import("./module-assign");
	await ensureModuleSchema(sql);
	return (await sql`select * from modules order by module_id`).map(mapModule);
});
export const updateModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; status?: string; wo?: string | null; location?: string | null; dateIn?: string | null; dateReady?: string | null; technician?: string | null; notes?: string | null; platform?: string | null; moduleType?: string | null }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`select * from modules where id = ${data.id}`;
	if (!cur[0]) throw new Error("Module not found");
	if (cur[0].assigned_customer) {
		// Assigned modules leave a café only through Return to warehouse (admin approval for Warehouse).
		const moving = (data.status !== undefined && data.status !== cur[0].status) || (data.location !== undefined && (data.location ?? null) !== (cur[0].location ?? null));
		if (moving) throw new Error(`This module is assigned to ${cur[0].assigned_customer}. Use Return To Warehouse to bring it back.`);
	}
	const c = cur[0];
	await sql`
      update modules set
        status = ${data.status ?? c.status},
        wo = ${data.wo === undefined ? c.wo : data.wo},
        location = ${data.location === undefined ? c.location : data.location},
        date_in = ${data.dateIn === undefined ? c.date_in : data.dateIn},
        date_ready = ${data.dateReady === undefined ? c.date_ready : data.dateReady},
        technician = ${data.technician === undefined ? c.technician : data.technician},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        platform = ${data.platform === undefined ? c.platform : data.platform},
        module_type = ${data.moduleType === undefined ? c.module_type : data.moduleType},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.status, data.status ?? c.status),
		changed("technician", c.technician, data.technician === undefined ? c.technician : data.technician),
		changed("location", c.location, data.location === undefined ? c.location : data.location)
	]);
	if (extra) await logActivity(sql, context.userId, "module", data.id, "updated", extra);
	// A location typed on the record is a stop on the module's trail too; the earlier one stays.
	const nextLocation = data.location === undefined ? c.location : data.location;
	if ((c.location ?? "").trim() !== (nextLocation ?? "").trim()) {
		await sql.query("insert into module_stops (module_id, kind, from_place, to_place, by_name) values ($1, 'moved', $2, $3, $4)", [data.id, c.location ?? null, nextLocation ?? null, await deskUsername(sql, context.userId)]);
	}
	return mapModule((await sql`select * from modules where id = ${data.id}`)[0]);
});
export const createModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { moduleId: string; platform?: string; moduleType?: string }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	// One module serial = one record: ignore case and stray spaces when checking.
	const moduleId = String(data.moduleId ?? "").trim().replace(/\s+/g, "").toUpperCase();
	if (!moduleId) throw new Error("Enter the module serial.");
	const dup = await sql.query("select id, module_id from modules where upper(regexp_replace(module_id, '\\s', '', 'g')) = $1 limit 1", [moduleId]);
	if (dup[0]) throw new Error(`Module ${dup[0].module_id} is already on the list. Open it instead of adding a second record.`);
	const rows = await sql`
      insert into modules (module_id, platform, module_type, status, location)
      values (${moduleId}, ${data.platform ?? "Cameo"}, ${data.moduleType ?? "Brew Module"}, ${"Not Started"}, ${"SHELF"})
      returning *`;
	await logActivity(sql, context.userId, "module", rows[0].id, "opened", moduleId);
	return mapModule(rows[0]);
});
/** Ties a deal row to the board row it becomes. Short, random, never shown. */
function newMachineUid() {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
/** Every board card that is still on the list, with the machine rows it holds and where it stands. */
async function loadBoardProjects(sql: any, catalog: any[] = []) {
	const rows = await sql`select id, deal_id, customer, equipment, equip_status, complete, serial, power_voltage, machines from installs where archived = false order by id`;
	const summaries = await loadInspectionSummaries(sql, rows.map((r: any) => r.id));
	return rows.map((r: any) => {
		const installed = isInstalled({ complete: !!r.complete, equipStatus: r.equip_status });
		return {
			id: r.id,
			dealId: r.deal_id ?? null,
			customer: String(r.customer ?? ""),
			installed,
			equipment: r.equipment ?? null,
			machines: specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, catalog),
			status: projectStatus({ installed, equipStatus: r.equip_status, overall: summaries.get(r.id)?.overall ?? null })
		};
	});
}
/** Says, for each machine on the deal, which board project holds it now, and lists the projects a new one can join. */
function attachBoard(deal: any, projects: any[]) {
	const placed = placeRows(deal.machines, projects, { id: deal.id, handedOff: deal.handedOff });
	deal.machines = deal.machines.map((m: any, i: number) => ({ ...m, boardId: placed[i] }));
	const mine = projects.filter((p) => p.dealId === deal.id);
	const loose = continuable({ id: deal.id, customer: deal.customer }, projects).filter((p) => p.dealId == null);
	deal.projects = [...mine, ...loose].map((p) => ({
		id: p.id,
		label: p.dealId === deal.id ? projectLabel(mine.indexOf(p) + 1, mine.length) : "Open install on this account",
		status: p.status,
		machineCount: p.machines.length,
		equipment: p.equipment,
		open: !p.installed,
		ownDeal: p.dealId === deal.id
	}));
	return deal;
}
/**
 * Confirm machines on a deal: each one becomes a row on a board project (an install card) for prep, with
 * everything set on the deal: Sold, Loan or Lease, serial, volts, plug, water and recipe. "continue" adds to an
 * open project so it stays one card; "new" opens another card. The deal rows are saved as the window has them.
 */
export const confirmDealMachines = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { dealId: number; machines: MachineSpec[]; indexes: number[]; project: { mode: "new" } | { mode: "continue"; installId: number } }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const deal = (await sql`select * from deals where id = ${data.dealId} and archived = false`)[0];
	if (!deal) throw new Error("Deal not found");
	if (deal.completion === "fell") throw new Error("This deal fell through. Set it back to open before confirming a machine.");
	const catalog = await loadEquipCatalog(sql);
	const rows = (Array.isArray(data.machines) ? data.machines : []).map((m: any) => cleanMachine({
		...m,
		equipment: String(m?.equipment ?? ""),
		serial: String(m?.serial ?? ""),
		powerVoltage: String(m?.powerVoltage ?? "")
	}));
	const projects = await loadBoardProjects(sql, catalog);
	const placed = placeRows(rows, projects, { id: deal.id, handedOff: !!deal.handed_off });
	const picks = [...new Set((Array.isArray(data.indexes) ? data.indexes : []).map(Number))].filter((i) => Number.isInteger(i) && rows[i]);
	if (!picks.length) throw new Error("Pick a machine to confirm.");
	for (const i of picks) {
		const problem = confirmError(rows[i]);
		if (problem) throw new Error(problem);
		if (placed[i] != null) throw new Error(`${rows[i].equipment} is already on the Board.`);
	}
	const today = todayChicago();
	const stamped = picks.map((i) => ({ i, uid: newMachineUid() }));
	// The Board keeps models under their catalog name, so the deal row and the board row are saved the same way.
	for (const i of picks) rows[i] = { ...rows[i], equipment: matchModel(rows[i].equipment, catalog) };
	const incoming = stamped.map(({ i, uid }) => boardRow(rows[i], uid));
	const continuing = data.project?.mode === "continue";
	let installId: number;
	if (continuing) {
		const target = continuable({ id: deal.id, customer: deal.customer }, projects).find((p) => p.id === Number(data.project.installId));
		if (!target) throw new Error("That project is no longer open on the Board. Start a new project, or pick another.");
		const packed = serializeMachines([...target.machines, ...incoming]);
		await sql`
      update installs set
        equipment = ${packed.equipment},
        machines = ${packed.machines},
        serial = ${packed.serial},
        power_voltage = ${packed.powerVoltage},
        deal_id = coalesce(deal_id, ${deal.id}),
        updated_at = now()
      where id = ${target.id}`;
		installId = target.id;
		await syncInstallUnits(sql, installId, { prune: true });
	} else {
		const packed = serializeMachines(incoming);
		const made = await sql`
      insert into installs (received, customer, equipment, equip_status, account_rep, payment_status, deal_id, machines, serial, power_voltage)
      values (
        ${today},
        ${deal.customer},
        ${packed.equipment},
        ${"Not Ready"},
        ${canonicalRepName(String(deal.producer ?? "")) ?? null},
        ${deal.terms ?? null},
        ${deal.id},
        ${packed.machines},
        ${packed.serial},
        ${packed.powerVoltage}
      )
      returning id`;
		installId = made[0].id;
		await syncInstallUnits(sql, installId);
	}
	for (const { i, uid } of stamped) rows[i] = { ...rows[i], uid, confirmedAt: today };
	const packedDeal = serializeMachines(rows);
	await sql`update deals set machines = ${packedDeal.machines}, equipment = ${packedDeal.equipment}, updated_at = now() where id = ${deal.id}`;
	const names = incoming.map((m) => `${m.equipment} (${m.ownership})`).join(", ");
	await logActivity(sql, context.userId, "deal", deal.id, "updated", `confirmed ${names}: on the Board`);
	await logActivity(sql, context.userId, "install", installId, continuing ? "updated" : "opened", continuing ? `added ${names} from the deal` : `${deal.customer} · ${names} from the deal`);
	const marks = await loadAccountMarks(sql);
	return {
		installId,
		deal: attachBoard(mapDeal((await sql`select * from deals where id = ${deal.id}`)[0], marks), await loadBoardProjects(sql, catalog))
	};
});
export const listDeals = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Deal[]> => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	const projects = await loadBoardProjects(sql, await loadEquipCatalog(sql));
	return (await sql`select * from deals where archived = false order by id`).map((r) => attachBoard(mapDeal(r, marks), projects));
});
export const updateDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; customer?: string; producer?: string | null; accountType?: string | null; equipment?: string | null; machines?: MachineSpec[] | null; amount?: number | null; goodToOrder?: boolean; ordered?: boolean; eta?: string | null; terms?: string | null; invoice?: string | null; completion?: string | null; notes?: string | null; aviKatz?: boolean; releaseUids?: string[] }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`select * from deals where id = ${data.id}`;
	if (!cur[0]) throw new Error("Deal not found");
	// The owner may take a confirmed machine off the deal: its tie is released, so the stored row is not put back.
	const release = new Set<string>(Array.isArray(data.releaseUids) ? data.releaseUids.filter((u: unknown) => typeof u === "string" && u) : []);
	if (release.size) {
		const { canLockEquipment } = await import("./equipment-lock");
		if (!(await canLockEquipment(sql, context.userId))) throw new Error("Only the owner can take a confirmed machine off a deal.");
	}
	const c = cur[0];
	const producer = data.producer === undefined ? c.producer : canonicalRepName(data.producer);
	const completion = data.completion === undefined ? c.completion : data.completion;
	// The machine rows are the equipment list: equipment is kept as the joined models so lists and search still read it.
	let machinesJson = c.machines ?? null;
	// Every tie the owner ever released on this deal: a window opened before the release still sends that row.
	const released = releasedUids(c.released_uids, release);
	if (release.size) await sql`update deals set released_uids = ${JSON.stringify([...released])} where id = ${data.id}`;
	if (data.machines !== undefined) {
		const stored = parseMachinesJson(c.machines ?? null);
		// Confirmed machines are changed on the Board: the deal keeps them as stored.
		const onBoard = new Set<string>((await loadBoardProjects(sql)).flatMap((p: any) => p.machines.map((m: any) => m.uid)).filter((u: string) => u && !released.has(u)));
		const kept = stored.filter((m) => !m.uid || !released.has(m.uid));
		const incoming = dropReleased(Array.isArray(data.machines) ? data.machines : [], released);
		const packed = serializeMachines(lockConfirmed(keepTies(incoming, kept), kept, onBoard));
		machinesJson = packed.machines;
		data.equipment = packed.equipment;
	}
	await sql`
      update deals set
        machines = ${machinesJson},
        customer = ${data.customer ?? c.customer},
        producer = ${producer},
        account_type = ${data.accountType === undefined ? c.account_type : data.accountType},
        equipment = ${data.equipment === undefined ? c.equipment : data.equipment},
        amount = ${data.amount === undefined ? c.amount : data.amount},
        good_to_order = ${data.goodToOrder === undefined ? c.good_to_order : data.goodToOrder},
        ordered = ${data.ordered === undefined ? c.ordered : data.ordered},
        eta = ${data.eta === undefined ? c.eta : data.eta},
        terms = ${data.terms === undefined ? c.terms : data.terms},
        invoice = ${data.invoice === undefined ? c.invoice : data.invoice},
        completion = ${completion},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        updated_at = now()
      where id = ${data.id}`;
	if (completion === "complete") await maybeHandoffInstall(sql, data.id);
	// Order pings: Good To Order tells the Admin; Ordered tells the deal's sales rep.
	{
		const { notifyDealOrderStep } = await import("@/lib/ops/notify");
		const dealRef = { id: Number(c.id), customer: String(data.customer ?? c.customer), rep: producer ?? null };
		if (data.goodToOrder === true && !c.good_to_order) await notifyDealOrderStep(sql, context.userId, dealRef, "gto");
		if (data.ordered === true && !c.ordered) await notifyDealOrderStep(sql, context.userId, dealRef, "ordered");
	}
	const extra = summarize([
		changed("status", c.completion, completion),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("producer", c.producer, producer),
		changed("equipment", c.equipment, data.equipment === undefined ? c.equipment : data.equipment)
	]);
	if (extra) await logActivity(sql, context.userId, "deal", data.id, "updated", extra);
	const customerName = String(data.customer ?? c.customer);
	if (data.aviKatz !== undefined || data.producer !== undefined) await upsertAccountMarks(sql, customerName, {
		aviKatz: data.aviKatz,
		accountRep: data.producer === undefined ? undefined : producer
	});
	const marks = await loadAccountMarks(sql);
	return attachBoard(mapDeal((await sql`select * from deals where id = ${data.id}`)[0], marks), await loadBoardProjects(sql, await loadEquipCatalog(sql)));
});
export const createDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { customer: string; producer?: string; equipment?: string; machines?: MachineSpec[]; amount?: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const producer = canonicalRepName(data.producer);
	// One row per machine, each marked Sold, Loan or Lease; equipment stays the joined models so lists and search read it.
	const packed = Array.isArray(data.machines) && data.machines.length ? serializeMachines(data.machines.map((m: any) => cleanMachine({ ...m, equipment: String(m?.equipment ?? ""), serial: String(m?.serial ?? ""), powerVoltage: String(m?.powerVoltage ?? "") }))) : null;
	const rows = await sql`
      insert into deals (customer, producer, equipment, machines, amount, date_of_deal)
      values (${data.customer}, ${producer}, ${packed?.equipment ?? data.equipment ?? null}, ${packed?.machines ?? null}, ${data.amount ?? null}, ${todayChicago()})
      returning *`;
	await logActivity(sql, context.userId, "deal", rows[0].id, "opened", data.customer);
	if (producer) await upsertAccountMarks(sql, data.customer, { accountRep: producer });
	const marks = await loadAccountMarks(sql);
	return attachBoard(mapDeal(rows[0], marks), await loadBoardProjects(sql, await loadEquipCatalog(sql)));
});
export const archiveDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`
      select id, customer from deals where id = ${data.id} and archived = false`;
	if (!cur[0]) throw new Error("Deal not found");
	await sql`update deals set archived = true, updated_at = now() where id = ${data.id}`;
	await logActivity(sql, context.userId, "deal", data.id, "removed", cur[0].customer);
	return { ok: true };
});
function uniquePendingHandoffs(deals: any) {
	const pending = deals.filter((d) => d.completion === "complete" && !d.handedOff);
	const byCustomer = new Map();
	for (const d of pending) {
		const key = d.customer.trim().toLowerCase();
		const prev = byCustomer.get(key);
		if (!prev || d.id > prev.id) byCustomer.set(key, d);
	}
	return [...byCustomer.values()].map((d) => ({
		dealId: d.id,
		customer: d.customer,
		equipment: d.equipment,
		producer: d.producer
	}));
}
async function maybeHandoffInstall(sql: any, dealId: any) {
	const deal = (await sql`select * from deals where id = ${dealId}`)[0];
	if (!deal || deal.archived) return;
	await sql`update deals set handed_off = true, updated_at = now() where id = ${dealId}`;
	if ((await sql`
    select id from installs where deal_id = ${dealId} and archived = false limit 1`)[0]) return;
	const existing = await sql`
    select id, deal_id from installs
    where archived = false and lower(customer) = ${String(deal.customer).trim().toLowerCase()}
    order by id desc
    limit 1`;
	if (existing[0]) {
		if (existing[0].deal_id == null) await sql`update installs set deal_id = ${dealId}, updated_at = now() where id = ${existing[0].id}`;
		return;
	}
	const initials = canonicalRepName(String(deal.producer ?? "")) ?? null;
	// Every machine row on the deal goes to the install, so pre-inspection gets each unit with its serial and voltage.
	const today = todayChicago();
	const tied = parseMachinesJson(deal.machines ?? null).map((m) => ({ ...m, uid: m.uid || newMachineUid(), confirmedAt: m.confirmedAt ?? today }));
	const packed = serializeMachines(tied.map((m) => boardRow(m, m.uid)));
	if (tied.length) await sql`update deals set machines = ${serializeMachines(tied).machines} where id = ${dealId}`;
	await sql`
    insert into installs (received, customer, equipment, account_rep, payment_status, deal_id, machines, serial, power_voltage)
    values (
      ${todayChicago()},
      ${deal.customer},
      ${packed.equipment ?? deal.equipment ?? null},
      ${initials},
      ${deal.terms ?? null},
      ${dealId},
      ${packed.machines},
      ${packed.serial},
      ${packed.powerVoltage}
    )`;
}
export const listInstalls = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Install[]> => {
	const sql = await ready();
	await backfillAssignedSerialsOnce(sql);
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const marks = await loadAccountMarks(sql);
	const installs = (await sql`select * from installs where archived = false order by id`).map((r) => mapInstall(r, today, week, catalog));
	for (const i of installs) {
		if (i.dealId == null) continue;
		const same = installs.filter((x) => x.dealId === i.dealId);
		i.project = { n: same.indexOf(i) + 1, of: same.length };
	}
	return withWorkOrders(sql, await withInspections(sql, applyMarks(installs, marks)));
});
type UpdateInstallInput = { id: number; customer?: string; equipment?: string | null; equipStatus?: string | null; installDate?: string | null; technician?: string | null; wo?: string | null; reqsReady?: string | null; notes?: string | null; accountRep?: string | null; paymentStatus?: string | null; serial?: string | null; powerVoltage?: string | null; machines?: MachineSpec[] | string | null; complete?: boolean; workDone?: string | null; completedAt?: string | null; duplicateOf?: number | null; aviKatz?: boolean; trfIssued?: boolean;
	/** New account ("new") or Update ("update"), picked on the Details tab. Blank or null clears it. */
	installType?: string | null;
	/** Who to ask for on site, and their phone, typed on the Details tab. Blank or null clears them. */
	siteContact?: string | null;
	contactPhone?: string | null;
	/** The list as the saving window last saw it on the server. With it, what changed on the server since is kept (mergeStaleList). */
	machinesBase?: MachineSpec[] | string | null;
	/** The notes the saving window's text was typed on. With it, a merged ticket's text the window never had is kept, and unchanged notes stay as stored (notes_after_window_save). */
	notesBase?: string | null };

/**
 * A window's list saved over a newer one: what the server's list gained since the window last saw it (a machine added or
 * removed on the Pre-inspection tab, a serial or model fixed there, another window's save) is kept, unless this window
 * changed the same row or field. Without it, a window left open saved its old list back: a machine added elsewhere was
 * dropped (and its unit pruned), one removed came back, and a fixed serial went back to the old one.
 */
function mergeStaleList(data: UpdateInstallInput, c: any, catalog: string[]): void {
	if (data.machinesBase == null || data.machines === undefined) return;
	const asText = (v: MachineSpec[] | string) => (typeof v === "string" ? v : JSON.stringify(v));
	// The last row taken off sends no list at all: that is an empty list, and what the server gained since still stays.
	const sent = data.machines == null ? [] : parseMachinesJson(asText(data.machines));
	const base = parseMachinesJson(asText(data.machinesBase));
	const stored = specsFromInstall(c.equipment, c.serial, c.power_voltage, c.machines, catalog);
	const merged = machinesBeforeSave(sent, base, stored);
	if (JSON.stringify(merged) === JSON.stringify(sent)) return;
	const packed = serializeMachines(merged);
	data.machines = packed.machines;
	data.equipment = packed.equipment;
	data.serial = packed.serial;
	data.powerVoltage = packed.powerVoltage;
}
export const updateInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: UpdateInstallInput) => d).handler(async ({ data, context }: any) => updateInstallFor(await ready(), data, context));
export async function updateInstallFor(sql: any, data: UpdateInstallInput, context: { userId: string }): Promise<Install> {
	const cur = await sql`select * from installs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Install not found");
	const c = cur[0];
	// Checked before anything is written: the Tech Request Form tick below saves on its own.
	if (data.installType != null && data.installType !== "" && !installTypeOf(data.installType)) throw new Error("Install type is New account or Update.");
	const siteContact = data.siteContact === undefined ? undefined : contactText(data.siteContact);
	const contactPhone = data.contactPhone === undefined ? undefined : contactText(data.contactPhone);
	if (siteContact && siteContact.length > SITE_CONTACT_MAX) throw new Error(`The site contact is too long: ${SITE_CONTACT_MAX} characters at most.`);
	if (contactPhone && contactPhone.length > CONTACT_PHONE_MAX) throw new Error(`The contact phone is too long: ${CONTACT_PHONE_MAX} characters at most.`);
	// The owner's lock on the customer: anyone else's change is refused, the same message as the equipment lock.
	await assertCustomerChangeAllowed(sql, c, data.customer);
	if (data.customer !== undefined) data.customer = data.customer.trim() || c.customer;
	// The WO # field follows Add WO's rule: another open install's WO means merging the installs.
	if (data.wo !== undefined && data.wo && woMatchKey(data.wo) !== woMatchKey(c.wo ?? "")) await assertWoFree(sql, data.id, data.wo);
	// Tech Request Form issued: a person ticks it, and only Sales or an admin may.
	if (data.trfIssued !== undefined && !!data.trfIssued !== !!c.trf_issued) {
		const me = (await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [context.userId]))[0] as any;
		if (!me || !(me.is_admin === true || me.is_admin === "true" || me.is_admin === 1 || me.desk_role === "sales")) throw new Error("Only Sales can mark the Tech Request Form as issued.");
		await sql.query("update installs set trf_issued = $2, trf_issued_by = $3, trf_issued_at = case when $2 then now() else null end where id = $1", [data.id, !!data.trfIssued, data.trfIssued ? me.username || null : null]);
		await logActivity(sql, context.userId, "install", data.id, "updated", data.trfIssued ? "Tech Request Form issued" : "Tech Request Form unmarked");
	}
	const installType = data.installType === undefined ? installTypeOf(c.install_type) : installTypeOf(data.installType);
	const equipStatus = data.equipStatus === undefined ? c.equip_status : data.equipStatus;
	const complete = data.complete === undefined ? data.equipStatus === undefined ? c.complete : isInstalled({ equipStatus }) : data.complete;
	const wasInstalled = isInstalled({ complete: c.complete, equipStatus: c.equip_status });
	const nowInstalled = isInstalled({ complete, equipStatus });
	if (!wasInstalled && nowInstalled) {
		const summary = (await loadInspectionSummaries(sql, [data.id])).get(data.id) ?? emptyInspection();
		if (!canMarkInstalled(summary)) {
			throw new Error("Pre-inspection must be Passed, or add an override reason, before marking this installed.");
		}
	}
	const catalog = await loadEquipCatalog(sql);
	mergeStaleList(data, c, catalog);
	const machinesJson = data.machines === undefined ? c.machines : data.machines == null ? null : (() => {
		const raw = typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
		const parsed = parseMachinesJson(raw);
		if (!parsed.length) return raw;
		return JSON.stringify(parsed.map((s) => ({
			...s,
			equipment: savedMachineName(s.equipment, catalog)
		})));
	})();
	const nextList = {
		equipment: data.equipment === undefined ? c.equipment : data.equipment,
		serial: data.serial === undefined ? c.serial : data.serial,
		power_voltage: data.powerVoltage === undefined ? c.power_voltage : data.powerVoltage,
		machines: machinesJson
	};
	const listEdited = data.equipment !== undefined || data.machines !== undefined || data.serial !== undefined || data.powerVoltage !== undefined;
	// An installed project keeps its pre-inspection as it was, so only the owner may drop a machine the visit has.
	if (wasInstalled && nowInstalled && listEdited && (await unitsDroppedBy(sql, data.id, nextList)).length && !(await canLockEquipment(sql, context.userId))) {
		throw new Error(INSTALLED_KEPT);
	}
	// The list and the pre-inspection mirror each other: a save that would leave them apart is refused before it is stored.
	if (listEdited) {
		const refusal = await listEditRefusal(sql, data.id, nextList);
		if (refusal) throw new Error(refusal);
	}
	await sql`
      update installs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === undefined ? c.equipment : data.equipment},
        equip_status = ${equipStatus},
        install_date = ${data.installDate === undefined ? c.install_date : data.installDate},
        technician = ${data.technician === undefined ? c.technician : data.technician},
        wo = ${data.wo === undefined ? c.wo : data.wo},
        reqs_ready = ${data.reqsReady === undefined ? c.reqs_ready : data.reqsReady},
        -- Worked out on the row this writes: a save that sends no notes leaves them, and a window opened before a ticket
        -- was merged into this install (10/30) keeps the ticket's text under them.
        notes = case
          when ${data.notes === undefined}::boolean then notes
          when ${data.notesBase !== undefined}::boolean
            then notes_after_window_save(id, notes, ${data.notesBase ?? null}::text, ${data.notes ?? null}::text)
          else ${data.notes ?? null}::text
        end,
        work_done = ${data.workDone === undefined ? c.work_done : data.workDone},
        completed_at = ${data.completedAt === undefined ? c.completed_at : data.completedAt},
        account_rep = ${data.accountRep === undefined ? c.account_rep : canonicalRepName(data.accountRep) ?? (data.accountRep || null)},
        payment_status = ${data.paymentStatus === undefined ? c.payment_status : data.paymentStatus},
        serial = ${data.serial === undefined ? c.serial : data.serial},
        power_voltage = ${data.powerVoltage === undefined ? c.power_voltage : data.powerVoltage},
        machines = ${machinesJson},
        complete = ${complete},
        duplicate_of = ${data.duplicateOf === undefined ? c.duplicate_of : data.duplicateOf},
        install_type = ${installType},
        site_contact = ${siteContact === undefined ? c.site_contact ?? null : siteContact},
        contact_phone = ${contactPhone === undefined ? c.contact_phone ?? null : contactPhone},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.equip_status, equipStatus),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("technician", c.technician, data.technician === undefined ? c.technician : data.technician),
		changed("equipment", c.equipment, data.equipment === undefined ? c.equipment : data.equipment),
		changed("account rep", c.account_rep, data.accountRep === undefined ? c.account_rep : data.accountRep),
		changed("install type", installTypeLabel(installTypeOf(c.install_type)), installTypeLabel(installType)),
		changed("site contact", c.site_contact, siteContact === undefined ? c.site_contact : siteContact),
		changed("contact phone", c.contact_phone, contactPhone === undefined ? c.contact_phone : contactPhone),
		data.duplicateOf === null && c.duplicate_of ? "cleared duplicate flag" : data.duplicateOf && data.duplicateOf !== c.duplicate_of ? `flagged duplicate of #${data.duplicateOf}` : null
	]);
	if (extra) await logActivity(sql, context.userId, "install", data.id, "updated", extra);
	// installs.wo is the project's first WO: its work-order row follows it.
	if (data.wo !== undefined) await setPrimaryWo(sql, data.id, c.wo, data.wo, await deskUsername(sql, context.userId));
	// The install's own account units go with it to the new customer (not a locked one, nor one on another visit).
	const unitsMoved = data.customer !== undefined && data.customer !== c.customer ? await moveInstallUnits(sql, data.id, c.customer, data.customer) : null;
	if (unitsMoved?.moved.length || unitsMoved?.stayed.length) {
		await logActivity(sql, context.userId, "install", data.id, "updated", [unitsMoved.moved.length ? `moved to ${data.customer}: ${unitsMoved.moved.join(", ")}` : null, unitsMoved.stayed.length ? `stayed on ${c.customer}: ${unitsMoved.stayed.join(", ")}` : null].filter(Boolean).join(" · "));
	}
	const customerName = String(data.customer ?? c.customer);
	if (data.technician !== undefined) await pingRepTechAssigned(sql, context.userId, { id: data.id, customer: customerName, before: c.technician, after: data.technician, rep: data.accountRep === undefined ? c.account_rep : data.accountRep });
	if (data.aviKatz !== undefined || data.accountRep !== undefined) await upsertAccountMarks(sql, customerName, {
		aviKatz: data.aviKatz,
		accountRep: data.accountRep === undefined ? undefined : canonicalRepName(data.accountRep) ?? (data.accountRep || null)
	});
	if (data.equipment !== undefined || data.machines !== undefined || data.serial !== undefined || data.powerVoltage !== undefined) {
		// The list as stored before this save: only a serial changed in this save is written onto the row's unit.
		await syncInstallUnits(sql, data.id, { prune: true, before: { equipment: c.equipment, serial: c.serial, power_voltage: c.power_voltage, machines: c.machines } });
	}
	const today = todayChicago();
	const week = weekBounds(today);
	const marks = await loadAccountMarks(sql);
	const saved = (await withWorkOrders(sql, await withInspections(sql, applyMarks([mapInstall((await sql`select * from installs where id = ${data.id}`)[0], today, week, catalog)], marks))))[0];
	return { ...saved, unitsMoved };
}
export const createInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { customer: string; equipment?: string; technician?: string; serial?: string; powerVoltage?: string; machines?: MachineSpec[] | string | null }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const catalog = await loadEquipCatalog(sql);
	const machinesJsonRaw = data.machines == null ? null : typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
	const parsed = parseMachinesJson(machinesJsonRaw);
	const machinesJson = parsed.length ? JSON.stringify(parsed.map((s) => ({
		...s,
		equipment: savedMachineName(s.equipment, catalog)
	}))) : machinesJsonRaw;
	const name = data.customer.trim();
	const duplicateOf = (await sql`
      select id from installs
      where archived = false and lower(customer) = ${name.toLowerCase()}
      order by id desc`)[0]?.id ?? null;
	const rows = await sql`
      insert into installs (received, customer, equipment, technician, equip_status, serial, power_voltage, machines, duplicate_of)
      values (
        ${todayChicago()},
        ${name},
        ${data.equipment ?? null},
        ${data.technician ?? null},
        ${"Not Ready"},
        ${data.serial?.trim() || null},
        ${data.powerVoltage?.trim() || null},
        ${machinesJson},
        ${duplicateOf}
      )
      returning *`;
	await logActivity(sql, context.userId, "install", rows[0].id, "opened", duplicateOf ? `${name} · possible duplicate of #${duplicateOf}` : name);
	await syncInstallUnits(sql, rows[0].id);
	return (await withWorkOrders(sql, [mapInstall(rows[0], todayChicago(), weekBounds(todayChicago()), catalog)]))[0];
});
export const archiveInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`
      select id, customer from installs where id = ${data.id} and archived = false`;
	if (!cur[0]) throw new Error("Install not found");
	await sql`update installs set archived = true, updated_at = now() where id = ${data.id}`;
	await logActivity(sql, context.userId, "install", data.id, "removed", cur[0].customer);
	return { ok: true };
});
export const listComments = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { entityType: string; entityId: number }) => d).handler(async ({ data }: any) => {
	const sql = await ready();
	const rows = await sql`
      select * from comments
      where entity_type = ${data.entityType} and entity_id = ${data.entityId}
      order by created_at asc`;
	const ctx = await entityContext(sql, data.entityType, data.entityId);
	return rows.map((r) => mapComment(r, ctx));
});
export const listActivity = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { entityType: string; entityId: number }) => d).handler(async ({ data }: any): Promise<{ id: number; entityType: string; entityId: number; actorName: string | null; action: string; detail: string | null; createdAt: string }[]> => {
	return (await (await ready())`
      select id, entity_type, entity_id, actor_name, action, detail, created_at
      from activity
      where entity_type = ${data.entityType} and entity_id = ${data.entityId}
      order by created_at desc
      limit 40`).map((r) => ({
		id: r.id,
		entityType: r.entity_type,
		entityId: r.entity_id,
		actorName: r.actor_name,
		action: r.action,
		detail: r.detail,
		createdAt: String(r.created_at)
	}));
});
export const addComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { entityType: string; entityId: number; body: string; askTeam?: string | null; authorName?: string | null }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const body = data.body.trim();
	if (!body) throw new Error("Message is empty");
	// A ticket merged into an install (10/30): its Ping notes are on the install now, and a new one goes there too.
	if (data.entityType === "service" || data.entityType === "tlc") {
		const into = (await sql.query("select merged_install_id from service_jobs where id = $1", [data.entityId]))[0]?.merged_install_id;
		if (into) throw new Error(`This ticket was merged into install #${into}. Add the note on the install.`);
	}
	const authorName = (await sql.query("select username from desk_accounts where user_id = $1", [context.userId]))[0]?.username || "Teammate";
	const rows = await sql`
      insert into comments (entity_type, entity_id, author_id, author_name, body, ask_team)
      values (${data.entityType}, ${data.entityId}, ${context.userId}, ${authorName}, ${body}, ${data.askTeam ?? null})
      returning *`;
	await logActivity(sql, context.userId, data.entityType, data.entityId, "note", body.slice(0, 80));
	const commentId = Number(rows[0].id);
	if (parseMentions(body).length) try {
		await deliverPings(sql, {
			fromUserId: context.userId,
			body,
			entityType: data.entityType,
			entityId: data.entityId,
			commentId,
			usernames: parseMentions(body)
		});
	} catch {
		/* mention notices are best-effort; the comment itself is already saved */
	}
	return mapComment((await sql`select * from comments where id = ${commentId}`)[0] ?? rows[0], await entityContext(sql, data.entityType, data.entityId));
});
export const claimComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`
      select id, author_id, entity_type, entity_id from comments where id = ${data.id}`;
	if (!cur[0]) throw new Error("Note not found");
	if (cur[0].author_id) throw new Error("That note already has an owner");
	const name = await deskUsername(sql, context.userId);
	const row = (await sql`
      update comments
      set author_id = ${context.userId}, author_name = ${name}
      where id = ${data.id} and author_id is null
      returning *`)[0];
	if (!row) throw new Error("That note already has an owner");
	await logActivity(sql, context.userId, cur[0].entity_type, cur[0].entity_id, "note", `claimed this note`);
	return mapComment(row, await entityContext(sql, cur[0].entity_type, cur[0].entity_id));
});
export const resolveComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; resolved: boolean }) => d).handler(async ({ data }: any) => {
	await (await ready())`update comments set resolved = ${data.resolved} where id = ${data.id}`;
	return { ok: true };
});
export const getHandoff = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<HandoffFeed> => {
	const sql = await ready();
	const askRows = await sql`
      select * from comments
      where ask_team is not null and resolved = false
      order by created_at desc`;
	const recentRows = await sql`
      select * from comments order by created_at desc limit 30`;
	const asks = [];
	for (const r of askRows) {
		const ctx = await entityContext(sql, String(r.entity_type), Number(r.entity_id));
		const c = mapComment(r, ctx);
		asks.push({
			...c,
			customer: ctx.customer,
			status: c.askTeam,
			technician: ctx.technician,
			producer: ctx.producer,
			accountRep: ctx.accountRep
		});
	}
	const recent = [];
	for (const r of recentRows) {
		const ctx = await entityContext(sql, String(r.entity_type), Number(r.entity_id));
		const c = mapComment(r, ctx);
		recent.push({
			...c,
			customer: ctx.customer,
			technician: ctx.technician,
			producer: ctx.producer,
			accountRep: ctx.accountRep
		});
	}
	const marks = await loadAccountMarks(sql);
	const liveDeals = (await sql`select * from deals where archived = false`).map((r: any) => mapDeal(r, marks));
	return {
		asks,
		recent,
		pendingHandoffs: uniquePendingHandoffs(liveDeals)
	};
});
/** A sales rep's test for a ticket's customer, as listJobs and listPms use it; null when this person sees every account. */
async function repCustomerScope(sql: any, userId: string): Promise<((customer: string | null) => boolean) | null> {
	const scope = await salesRepScope(sql, userId);
	if (!scope) return null;
	const marks = await loadAccountMarks(sql);
	return (customer) => scope(accountRepFor(marks, customer));
}
export const searchAll = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { q: string }) => d).handler(async ({ data, context }: any): Promise<SearchHit[]> => searchAllFor(await ready(), data, context));
/** The top search. A WO number finds its install by any of the project's work orders. */
export async function searchAllFor(sql: any, data: { q: string }, context: { userId: string }): Promise<SearchHit[]> {
	const q = data.q.trim();
	if (q.length < 2) return [];
	const like = `%${q.replace(/%/g, "")}%`;
	const hits: SearchHit[] = [];
	// A WO number finds its ticket on every board, in any status, ahead of the text matches.
	const woKey = woSearchKey(q);
	// A sales rep sees only their accounts' tickets, TLCs and PMs here too, in the WO block and the text matches.
	const inScope = await repCustomerScope(sql, context.userId);
	if (woKey) for (const w of await findWoEverywhere(sql, woKey, inScope)) hits.push({
		entityType: w.entityType,
		id: w.id,
		title: w.customer ?? w.wo,
		subtitle: `${w.wo} · ${woBoardName(w.entityType)} · ${w.status}`,
		status: w.status
	});
	const { jobs, pms } = await searchTicketText(sql, like, inScope);
	for (const j of jobs) hits.push({
		entityType: j.kind,
		id: j.id,
		title: j.customer ?? j.call_id,
		subtitle: `${j.call_id}${j.wo ? " · " + j.wo : ""} · ${j.status}`,
		status: j.status
	});
	for (const p of pms) hits.push({
		entityType: "pm",
		id: p.id,
		title: p.customer,
		subtitle: `${p.wo || p.equipment || "PM"} · ${p.status}`,
		status: p.status
	});
	const ins = await sql.query(
		`select i.id, i.customer, i.equip_status, i.complete, i.wo from installs i
      where i.archived = false and (i.customer ilike $1 or exists (select 1 from ${INSTALL_WOS_SQL} w where w.install_id = i.id and w.wo ilike $1))
      limit 5`,
		[like]
	);
	for (const i of ins) {
		const status = isInstalled({ complete: !!i.complete, equipStatus: i.equip_status }) ? "Installed" : i.equip_status || "Not Ready";
		hits.push({
			entityType: "install",
			id: i.id,
			title: i.customer,
			subtitle: `${i.wo || "Install"} · ${status}`,
			status
		});
	}
	const deals = await sql`
      select id, customer, producer, completion from deals
      where archived = false and customer ilike ${like}
      limit 5`;
	for (const d of deals) hits.push({
		entityType: "deal",
		id: d.id,
		title: d.customer,
		subtitle: d.producer ?? "Deal",
		status: d.completion === "complete" ? "Complete" : d.completion === "fell" ? "Fell through" : "Open"
	});
	const mods = await sql`
      select id, module_id, status, location from modules
      where module_id ilike ${like} or coalesce(location,'') ilike ${like} limit 5`;
	for (const m of mods) hits.push({
		entityType: "module",
		id: m.id,
		title: m.module_id,
		subtitle: m.location ?? "Module",
		status: m.status
	});
	const assets = await sql`
      select id, model, serial, site, status from assets
      where model ilike ${like} or coalesce(serial,'') ilike ${like} or coalesce(sold_to,'') ilike ${like}
      limit 8`;
	for (const a of assets) hits.push({
		// Same rule as pings: a unit on a barn rack opens in Warehouse; anywhere else it opens in Locations.
		entityType: a.site === "barn-back" || a.site === "barn-front" ? "asset" : "location",
		id: a.id,
		title: a.model,
		subtitle: [a.serial, siteLabel(a.site)].filter(Boolean).join(" · "),
		status: a.status
	});
	const recs = await sql`
      select id, equipment_model, customer, is_template from recipes
      where equipment_model ilike ${like} or coalesce(customer, '') ilike ${like}
      limit 8`;
	for (const r of recs) hits.push({
		entityType: "recipe",
		id: r.id,
		title: r.equipment_model,
		subtitle: r.customer ?? (r.is_template ? "House template" : "Recipe"),
		status: r.customer ? "Account" : "House"
	});
	const accounts = await sql`
      select id, name from directory_customers
      where archived = false and name ilike ${like}
      order by lower(name)
      limit 8`;
	for (const a of accounts) hits.push({
		entityType: "customer",
		id: a.id,
		title: a.name,
		subtitle: "Account history",
		status: null
	});
	const seen = new Set<string>();
	return hits.filter((h) => {
		const k = `${h.entityType}:${h.id}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	}).slice(0, 28);
}
/** Every ticket with this WO number, on any board and in any status (the Tickets page's "also on" line). */
export const findWoTickets = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { q: string }) => z.object({ q: z.string().max(100) }).parse(d)).handler(async ({ data, context }: any): Promise<WoBoardHit[]> => {
	const key = woSearchKey(data.q);
	if (!key) return [];
	const sql = await ready();
	return findWoEverywhere(sql, key, await repCustomerScope(sql, context.userId));
});
export const handoffDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { dealId: number }) => d).handler(async ({ data }: any) => {
	await maybeHandoffInstall(await ready(), data.dealId);
	return { ok: true };
});
async function nextLine(sql: any, site: any, pallet: any, level: any, exceptId?: number) {
	const letter = String(pallet).toUpperCase();
	const taken = await sql`
    select id, line_no from assets
    where site = ${site} and upper(pallet) = ${letter} and level = ${level}
      and status in ('ready', 'deployed') and line_no is not null`;
	const used = new Set(taken.filter((t: { id: number }) => t.id !== exceptId).map((t: { line_no: number }) => t.line_no));
	for (let n = 1; n <= 12; n++) if (!used.has(n)) return n;
	return null;
}
async function findOpenBarnSlot(sql: any, preferred: any) {
	const taken = await sql`
    select site, pallet, level, line_no from assets
    where status in ('ready', 'deployed')
      and pallet is not null and level is not null and line_no is not null`;
	const used = new Set(taken.map((t) => `${t.site}|${t.pallet}|${t.level}|${t.line_no}`));
	const firstLine = (site: any, pallet: any, level: any) => {
		for (let n = 1; n <= 12; n++) if (!used.has(`${site}|${pallet}|${level}|${n}`)) return n;
		return null;
	};
	const tries: any[] = [];
	const push = (site: any, pallet: any, level: any) => {
		if (site !== "barn-back" && site !== "barn-front") return;
		if (!isValidBay(pallet)) return;
		tries.push({
			site,
			pallet,
			level
		});
	};
	if (preferred?.site && preferred.pallet && preferred.level != null) push(preferred.site, preferred.pallet, preferred.level);
	const siteOrder = [];
	if (preferred?.site === "barn-front") siteOrder.push("barn-front", "barn-back");
	else siteOrder.push("barn-back", "barn-front");
	for (const site of siteOrder) {
		const pallets = site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
		const palletOrder = preferred?.pallet && pallets.includes(preferred.pallet) ? [preferred.pallet, ...pallets.filter((p) => p !== preferred.pallet)] : [...pallets];
		for (const pallet of palletOrder) for (const level of LEVELS) {
			if (preferred?.site === site && preferred.pallet === pallet && preferred.level === level) continue;
			push(site, pallet, level);
		}
	}
	for (const t of tries) {
		const line = firstLine(t.site, t.pallet, t.level);
		if (line != null) return {
			...t,
			line
		};
	}
	throw new Error("Barn is full — return this unit from the warehouse page");
}
export const listAssets = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Asset[]> => {
	return (await (await ready())`select * from assets order by id`).map(mapAsset);
});
export const createAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { kind?: "equip" | "dispenser" | "module"; model: string; serial?: string | null; qty?: number; customerOwned?: string | null; site: string; pallet?: string | null; level?: number | null; purpose?: string | null; notes?: string | null }) => d).handler(async ({ data, context }: any): Promise<Asset> => {
	const sql = await ready();
	const kind = data.kind ?? "equip";
	const site = data.site;
	let pallet = data.pallet ?? null;
	const level = data.level ?? null;
	let line = null;
	const barn = isBarn(site);
	if (barn) {
		if (!pallet || !level) throw new Error("Pick a bay and a level");
		const letter = String(pallet).trim().toUpperCase();
		const bayErr = rackBayError(site, letter);
		if (bayErr) throw new Error(bayErr);
		pallet = letter;
		line = await nextLine(sql, site, letter, Number(level));
		if (line == null) {
			const { sectionFullMessage } = await import("@/lib/ops/warehouse");
			throw new Error(sectionFullMessage(site, letter, Number(level)));
		}
	}
	const role = await (await import("@/lib/ops/rack-stock")).requireStock(sql, context.userId);
	const serialRaw = String(data.serial || "").trim();
	if (serialRaw) {
		const { serialKey } = await import("@/lib/ops/account-equip");
		const key = serialKey(serialRaw);
		if (key) {
			const rows = await sql.query("select id, serial, status, sold_to from assets where serial is not null");
			const hit = rows.find((r) => serialKey(r.serial) === key);
			if (hit) {
				if (hit.status === "sold" || hit.sold_to) {
					throw new Error(`That serial is already allocated${hit.sold_to ? ` to ${hit.sold_to}` : ""}.`);
				}
				throw new Error(`${serialRaw} is already on the desk. Select the slot and confirm the move — one serial stays one record.`);
			}
		}
	}
	const status = barn ? "ready" : "deployed";
	const pending = barn && role.warehouse && !role.admin;
	const shop = barn ? "needs-test" : null;
	const row = mapAsset((await sql`
      insert into assets (kind, model, serial, qty, customer_owned, site, pallet, level, line_no, purpose, status, notes, shop_test, review_status, review_actor, review_origin)
      values (
        ${kind}, ${data.model}, ${serialRaw || null}, ${data.qty ?? 1},
        ${data.customerOwned || null}, ${site}, ${pallet}, ${level}, ${line},
        ${data.purpose || null}, ${status}, ${data.notes || null},
        ${shop}, ${pending ? "pending" : null}, ${pending ? context.userId : null}, ${pending ? "created" : null}
      )
      returning *`)[0]);
	if (pending && pallet && level) {
		const { notifyAdminsRackReview } = await import("@/lib/ops/notify");
		const { slotId } = await import("@/lib/ops/warehouse");
		await notifyAdminsRackReview(sql, context.userId, {
			id: row.id,
			model: row.model,
			serial: row.serial,
			slot: slotId(String(pallet).toUpperCase(), Number(level)),
		});
	}
	return row;
});
export async function updateAssetFor(sql: any, data: { id: number; model?: string; serial?: string | null; qty?: number; customerOwned?: string | null; purpose?: string | null; notes?: string | null; pallet?: string | null; level?: number | null; site?: string }, context: { userId?: string } | null): Promise<Asset> {
	const cur = await sql`select * from assets where id = ${data.id}`;
	if (!cur[0]) throw new Error("Asset not found");
	const c = cur[0];
	let pallet = data.pallet === undefined ? c.pallet : data.pallet;
	const level = data.level === undefined ? c.level : data.level;
	let line = c.line_no;
	const site = data.site === undefined ? c.site : data.site;
	// A locked unit keeps its place, model, serial, quantity, owner and purpose until the owner unlocks it. Notes stay open.
	const same = (a: unknown, b: unknown) => String(a ?? "").trim() === String(b ?? "").trim();
	const recordChanged =
		(data.model !== undefined && !same(data.model, c.model)) ||
		(data.serial !== undefined && !same(data.serial, c.serial)) ||
		(data.qty !== undefined && Number(data.qty) !== Number(c.qty ?? 1)) ||
		(data.customerOwned !== undefined && !same(data.customerOwned, c.customer_owned)) ||
		(data.purpose !== undefined && !same(data.purpose, c.purpose));
	if (recordChanged || site !== c.site || String(pallet ?? "") !== String(c.pallet ?? "") || Number(level ?? 0) !== Number(c.level ?? 0)) await assertUnlocked(sql, c);
	if (isBarn(site) && pallet && !isValidBay(String(pallet))) {
		throw new Error("Pick a bay A through P");
	}
	if (isBarn(site) && (pallet !== c.pallet || Number(level) !== Number(c.level) || site !== c.site) && pallet && level) {
		const letter = String(pallet).trim().toUpperCase();
		const { requireStock } = await import("@/lib/ops/rack-stock");
		const { assertNotHeld } = await import("@/lib/ops/stock-actions");
		if (context?.userId) await requireStock(sql, context.userId);
		await assertNotHeld(sql, data.id);
		const next = await nextLine(sql, site, letter, Number(level), data.id);
		if (next == null) {
			const { sectionFullMessage } = await import("@/lib/ops/warehouse");
			throw new Error(sectionFullMessage(site, letter, Number(level)));
		}
		pallet = letter;
		line = next;
	}
	const movedToRack = isBarn(site) && pallet && level && (String(pallet) !== String(c.pallet ?? "") || Number(level) !== Number(c.level) || site !== c.site);
	await sql`
      update assets set
        model = ${data.model ?? c.model},
        serial = ${data.serial === undefined ? c.serial : data.serial},
        qty = ${data.qty === undefined ? c.qty : data.qty},
        customer_owned = ${data.customerOwned === undefined ? c.customer_owned : data.customerOwned},
        purpose = ${data.purpose === undefined ? c.purpose : data.purpose},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        site = ${site},
        pallet = ${pallet},
        level = ${level},
        line_no = ${line},
        updated_at = now()
      where id = ${data.id}`;
	if (movedToRack && context?.userId) {
		const { flagRackArrival } = await import("@/lib/ops/rack-stock");
		await flagRackArrival(sql, context.userId, data.id, {
			site: c.site,
			pallet: c.pallet,
			level: c.level,
			line_no: c.line_no,
			status: c.status,
		});
	}
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
}
export const updateAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; model?: string; serial?: string | null; qty?: number; customerOwned?: string | null; purpose?: string | null; notes?: string | null; pallet?: string | null; level?: number | null; site?: string }) => d).handler(async ({ data, context }: any): Promise<Asset> => updateAssetFor(await ready(), data, context));
/** Copy or clear a warehouse serial on a record that stores machine rows. Service jobs have none, so that path no-ops. */
async function stampWarehouseSerial(sql: any, table: "installs" | "deals" | "service_jobs", id: number, unit: { model: string; serial: string | null }, mode: "place" | "clear", addRow: boolean) {
	if (table === "service_jobs") {
		const has = await sql`select 1 as ok from information_schema.columns where table_name = 'service_jobs' and column_name = 'machines' limit 1`;
		if (!has[0]) return null;
	}
	const row = table === "installs"
		? (await sql`select id, deal_id, equipment, serial, power_voltage, machines from installs where id = ${id}`)[0]
		: table === "deals"
			? (await sql`select id, equipment, machines from deals where id = ${id}`)[0]
			: (await sql`select id, equipment, machines from service_jobs where id = ${id}`)[0];
	if (!row) return null;
	// The window's rows, split with the equipment catalog. Without it a saved name such as 'Bunn ITCB-DV, 29" w/Flip Tray' read
	// as two machines, and the pulled unit went on a row of its own.
	const catalog = await loadEquipCatalog(sql);
	const specs = table === "installs"
		? specsFromInstall(row.equipment, row.serial, row.power_voltage, row.machines, catalog)
		: parseMachinesJson(row.machines).length
			? parseMachinesJson(row.machines)
			: specsFromInstall(row.equipment, null, null, row.machines, catalog);
	const result = mode === "place" ? placeWarehouseSerial(specs, unit, { addRow, catalog }) : clearWarehouseSerial(specs, unit);
	if (result.changed) {
		const packed = serializeMachines(result.rows);
		if (table === "installs") {
			await sql`
        update installs set
          equipment = ${packed.equipment},
          machines = ${packed.machines},
          serial = ${packed.serial},
          power_voltage = ${packed.powerVoltage},
          updated_at = now()
        where id = ${id}`;
		} else if (table === "deals") {
			await sql`update deals set equipment = ${packed.equipment}, machines = ${packed.machines}, updated_at = now() where id = ${id}`;
		} else {
			await sql`update service_jobs set equipment = ${packed.equipment}, machines = ${packed.machines}, updated_at = now() where id = ${id}`;
		}
	}
	return row.deal_id ?? null;
}
export async function assignAssetToInstallFor(sql: any, data: { assetId: number; installId: number }, context: { userId: string }) {
	await backfillAssignedSerialsOnce(sql);
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
	if (asset.status === "sold") throw new Error("Already sold");
	const inst = (await sql`
      select id, customer from installs where id = ${data.installId}`)[0];
	if (asset.status !== "assigned") await assertUnlocked(sql, asset);
	if (!inst) throw new Error("Install not found");
	// Locked: a unit already assigned to an account is an asset at that site until it is returned.
	if (asset.status === "assigned") {
		if (asset.install_id === inst.id) {
			const unit = { model: String(asset.model ?? ""), serial: asset.serial ?? null };
			const dealId = await stampWarehouseSerial(sql, "installs", inst.id, unit, "place", true);
			if (dealId) await stampWarehouseSerial(sql, "deals", Number(dealId), unit, "place", true);
			return mapAsset(asset);
		}
		throw new Error(`That unit is already assigned to ${asset.sold_to || "another account"}. Return it to the barn before assigning it again.`);
	}
	const originSite = asset.origin_site ?? asset.site;
	const originPallet = asset.origin_pallet ?? asset.pallet;
	const originLevel = asset.origin_level ?? asset.level;
	await sql`
      update assets set
        status = 'assigned',
        site = 'field',
        pallet = null,
        level = null,
        line_no = null,
        install_id = ${inst.id},
        job_id = null,
        sold_to = ${inst.customer},
        origin_site = ${originSite},
        origin_pallet = ${originPallet},
        origin_level = ${originLevel},
        purpose = ${asset.customer_owned ? "Customer-owned / loaner" : "Install"},
        locked_at = now(),
        locked_by = ${LOCKED_BY_ASSIGNED},
        updated_at = now()
      where id = ${data.assetId}`;
	const unit = { model: String(asset.model ?? ""), serial: asset.serial ?? null };
	const dealId = await stampWarehouseSerial(sql, "installs", inst.id, unit, "place", true);
	if (dealId) await stampWarehouseSerial(sql, "deals", Number(dealId), unit, "place", true);
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)}.`;
	await logActivity(sql, context.userId, "install", inst.id, "assigned-asset", detail);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
}
export const assignAssetToInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number; installId: number }) => d).handler(async ({ data, context }: any) => assignAssetToInstallFor(await ready(), data, context));
export async function unassignAssetFromInstallFor(sql: any, data: { assetId: number; installId: number }, context: { userId: string }) {
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.install_id !== data.installId) throw new Error("That unit is not on this install");
	await assertUnlocked(sql, asset, { release: true });
	const unit = { model: String(asset.model ?? ""), serial: asset.serial ?? null };
	const dealId = await stampWarehouseSerial(sql, "installs", data.installId, unit, "clear", false);
	if (dealId) await stampWarehouseSerial(sql, "deals", Number(dealId), unit, "clear", false);
	const slot = await findOpenBarnSlot(sql, {
		site: asset.origin_site ?? null,
		pallet: asset.origin_pallet ?? null,
		level: num(asset.origin_level)
	});
	await sql`
      update assets set
        status = 'ready',
        site = ${slot.site},
        pallet = ${slot.pallet},
        level = ${slot.level},
        line_no = ${slot.line},
        install_id = null,
        job_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        locked_at = null,
        locked_by = null,
        updated_at = now()
      where id = ${data.assetId}`;
	await logActivity(sql, context.userId, "install", data.installId, "unassigned-asset", asset.model);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
}
export const unassignAssetFromInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number; installId: number }) => d).handler(async ({ data, context }: any) => unassignAssetFromInstallFor(await ready(), data, context));
export const assignAssetToService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number; customer: string; jobId?: number | null }) => d).handler(async ({ data, context }: any) => assignAssetToServiceFor(await ready(), data, context));
/** Pull for service: the unit goes to the account, on its newest open ticket that isn't hidden (merged), if it has one. */
export async function assignAssetToServiceFor(sql: any, data: { assetId: number; customer: string; jobId?: number | null }, context: { userId: string }) {
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer");
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
	if (asset.status === "sold") throw new Error("Already sold");
	if (asset.status !== "ready") throw new Error("That unit is already off the rack");
	await assertUnlocked(sql, asset);
	const acct = (await sql`
        select name from directory_customers
        where archived = false and lower(name) = lower(${customer})
        limit 1`)[0];
	if (!acct) throw new Error("Pick an account already on the customer list");
	const name = acct.name;
	const job = (await sql`
        select id, kind from service_jobs
        where lower(customer) = lower(${name})
          and done = false
          and status not in ('Complete', 'Completed', 'Closed', 'Cancelled')
          and duplicate_of is null
        order by updated_at desc
        limit 1`)[0];
	const originSite = asset.origin_site ?? asset.site;
	const originPallet = asset.origin_pallet ?? asset.pallet;
	const originLevel = asset.origin_level ?? asset.level;
	await sql`
      update assets set
        status = 'assigned',
        site = 'field',
        pallet = null,
        level = null,
        line_no = null,
        install_id = null,
        job_id = ${job?.id ?? null},
        sold_to = ${name},
        origin_site = ${originSite},
        origin_pallet = ${originPallet},
        origin_level = ${originLevel},
        purpose = ${asset.customer_owned ? "Customer-owned / service loaner" : "Service"},
        locked_at = now(),
        locked_by = ${LOCKED_BY_ASSIGNED},
        updated_at = now()
      where id = ${data.assetId}`;
	const unit = { model: String(asset.model ?? ""), serial: asset.serial ?? null };
	if (job?.id) await stampWarehouseSerial(sql, "service_jobs", job.id, unit, "place", true);
	const openDeals = await sql`
      select id from deals
      where archived = false and lower(customer) = lower(${name}) and coalesce(completion, '') <> 'fell'`;
	for (const d of openDeals) await stampWarehouseSerial(sql, "deals", d.id, unit, "place", false);
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)} for ${name}.`;
	await logActivity(sql, context.userId, "asset", data.assetId, "assigned-service", detail);
	if (job) await logActivity(sql, context.userId, job.kind, job.id, "assigned-asset", detail);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
}
export const unassignAssetFromService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.status !== "assigned" || asset.install_id) throw new Error("That unit is not pulled for service");
	await assertUnlocked(sql, asset, { release: true });
	const slot = await findOpenBarnSlot(sql, {
		site: asset.origin_site ?? null,
		pallet: asset.origin_pallet ?? null,
		level: num(asset.origin_level)
	});
	const jobId = asset.job_id;
	const jobKind = jobId ? (await sql`select kind from service_jobs where id = ${jobId}`)[0]?.kind : null;
	const unit = { model: String(asset.model ?? ""), serial: asset.serial ?? null };
	if (jobId) await stampWarehouseSerial(sql, "service_jobs", jobId, unit, "clear", false);
	if (asset.sold_to) {
		const openDeals = await sql`
        select id from deals
        where archived = false and lower(customer) = lower(${asset.sold_to})`;
		for (const d of openDeals) await stampWarehouseSerial(sql, "deals", d.id, unit, "clear", false);
	}
	await sql`
      update assets set
        status = 'ready',
        site = ${slot.site},
        pallet = ${slot.pallet},
        level = ${slot.level},
        line_no = ${slot.line},
        install_id = null,
        job_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        locked_at = null,
        locked_by = null,
        updated_at = now()
      where id = ${data.assetId}`;
	await logActivity(sql, context.userId, "asset", data.assetId, "unassigned-service", asset.model);
	if (jobId && jobKind) await logActivity(sql, context.userId, jobKind, jobId, "unassigned-asset", asset.model);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
export async function returnAssetToWarehouseFor(sql: any, data: { id: number; site: "barn-back" | "barn-front"; pallet: string; level: number }, context: { userId: string }): Promise<Asset> {
	const prev = (await sql`select * from assets where id = ${data.id}`)[0];
	if (!prev) throw new Error("Asset not found");
	if (prev.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
	// A sold unit, or one a person locked, waits for the owner to unlock it. An assignment's own lock comes off here.
	await assertUnlocked(sql, prev, { release: true });
	const pallet = String(data.pallet || "").trim().toUpperCase();
	if (data.site !== "barn-back" && data.site !== "barn-front") throw new Error("Pick a rack");
	const bayErr = rackBayError(data.site, pallet);
	if (bayErr) throw new Error(bayErr);
	if (!LEVELS.includes(data.level)) throw new Error("Pick a level");
	const line = await nextLine(sql, data.site, pallet, data.level, data.id);
	if (line == null) {
		const { sectionFullMessage } = await import("@/lib/ops/warehouse");
		throw new Error(sectionFullMessage(data.site, pallet, data.level));
	}
	const unit = { model: String(prev.model ?? ""), serial: prev.serial ?? null };
	if (prev.install_id) {
		const dealId = await stampWarehouseSerial(sql, "installs", prev.install_id, unit, "clear", false);
		if (dealId) await stampWarehouseSerial(sql, "deals", Number(dealId), unit, "clear", false);
	}
	if (prev.job_id) await stampWarehouseSerial(sql, "service_jobs", prev.job_id, unit, "clear", false);
	await sql`
      update assets set
        status = 'ready',
        site = ${data.site},
        pallet = ${pallet},
        level = ${data.level},
        line_no = ${line},
        install_id = null,
        job_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        locked_at = null,
        locked_by = null,
        updated_at = now()
      where id = ${data.id}`;
	await logActivity(sql, context.userId, "asset", data.id, "returned", `${data.pallet}-L${data.level}`);
	const { flagRackArrival } = await import("@/lib/ops/rack-stock");
	await flagRackArrival(sql, context.userId, data.id, {
		site: prev.site,
		pallet: prev.pallet,
		level: prev.level,
		line_no: prev.line_no,
		status: prev.status,
	});
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
}
export const returnAssetToWarehouse = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; site: "barn-back" | "barn-front"; pallet: string; level: number }) => d).handler(async ({ data, context }: any): Promise<Asset> => returnAssetToWarehouseFor(await ready(), data, context));
export async function markAssetSoldFor(sql: any, data: { id: number; soldTo: string }, context: { userId: string }) {
	const cur = (await sql`select * from assets where id = ${data.id}`)[0];
	if (!cur) throw new Error("Asset not found");
	if (cur.customer_owned) throw new Error("Customer-owned unit — return it, don’t sell it");
	await assertUnlocked(sql, cur, { release: true });
	await sql`
      update assets set
        status = 'sold',
        site = 'sold',
        pallet = null,
        level = null,
        line_no = null,
        sold_to = ${data.soldTo},
        sold_at = ${todayChicago()},
        locked_at = now(),
        locked_by = ${LOCKED_BY_SOLD},
        updated_at = now()
      where id = ${data.id}`;
	await logActivity(sql, context.userId, "asset", data.id, "sold", data.soldTo);
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
}
export const markAssetSold = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; soldTo: string }) => d).handler(async ({ data, context }: any) => markAssetSoldFor(await ready(), data, context));
export const listRecipes = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Recipe[]> => {
	return (await (await ready())`
      select * from recipes
      order by (customer is null) desc, customer, equipment_model`).map(mapRecipe);
});
export const listCustomers = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<string[]> => {
	return (await (await ready())`
      select name as customer from directory_customers
      where archived = false and coalesce(name, '') <> ''
      order by lower(name)`).map((r) => r.customer);
});
export const listCustomerRecords = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<CustomerRecord[]> => {
	const sql = await ready();
	const { ensureAccountMarks } = await import("./reps");
	await ensureAccountMarks(sql);
	return (await sql.query(`select
         d.id,
         d.name,
         d.avi_katz,
         d.account_rep,
         d.name_locked,
         d.removal_flag,
         d.account_number,
         d.inactive,
         coalesce(svc.n, 0)::int as calls,
         coalesce(svc.p, 0)::int as pending_calls,
         coalesce(tlc.n, 0)::int as tlcs,
         coalesce(tlc.p, 0)::int as pending_tlcs,
         coalesce(pm.n, 0)::int as pms,
         coalesce(pm.p, 0)::int as pending_pms,
         coalesce(inst.n, 0)::int as installs,
         coalesce(inst.p, 0)::int as pending_installs,
         coalesce(deal.n, 0)::int as deals,
         coalesce(rcp.n, 0)::int as recipes
       from directory_customers d
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not done and status not in ('Completed', 'Cancelled', 'Phone Resolved')
                )::int as p
         from service_jobs
         where coalesce(kind, 'service') = 'service' and coalesce(customer, '') <> ''
         group by 1
       ) svc on svc.k = lower(d.name)
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not done and status not in ('Completed', 'Cancelled', 'Phone Resolved')
                )::int as p
         from service_jobs
         where kind = 'tlc' and coalesce(customer, '') <> ''
         group by 1
       ) tlc on tlc.k = lower(d.name)
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not done and status not in ('Completed', 'Cancelled')
                )::int as p
         from pm_jobs
         where coalesce(customer, '') <> ''
         group by 1
       ) pm on pm.k = lower(d.name)
       left join (
         select lower(customer) as k,
                count(*)::int as n,
                count(*) filter (
                  where not complete and coalesce(equip_status, '') <> 'Installed'
                )::int as p
         from installs
         where archived = false and coalesce(customer, '') <> ''
         group by 1
       ) inst on inst.k = lower(d.name)
       left join (
         select lower(customer) as k, count(*)::int as n
         from deals
         where archived = false and coalesce(customer, '') <> ''
         group by 1
       ) deal on deal.k = lower(d.name)
       left join (
         select lower(customer) as k, count(*)::int as n
         from recipes
         where coalesce(customer, '') <> ''
         group by 1
       ) rcp on rcp.k = lower(d.name)
       where d.archived = false
       order by lower(d.name)`)).map((r) => ({
		id: r.id,
		name: r.name,
		calls: r.calls,
		tlcs: r.tlcs,
		pms: r.pms,
		installs: r.installs,
		deals: r.deals,
		recipes: r.recipes,
		pendingCalls: r.pending_calls,
		pendingTlcs: r.pending_tlcs,
		pendingPms: r.pending_pms,
		pendingInstalls: r.pending_installs,
		aviKatz: !!r.avi_katz,
		accountRep: r.account_rep,
		noRep: isNoRep(r.account_rep),
		nameLocked: r.name_locked === true,
		removalFlag: r.removal_flag === true,
		accountNumber: r.account_number ?? null,
		inactive: r.inactive === true
	}));
});
export const getCustomerHistory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { id: number }) => d).handler(async ({ data, context }: any): Promise<CustomerHistory | null> => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	const account = (await sql`
      select * from directory_customers where id = ${data.id} and archived = false`)[0];
	if (!account) return null;
	const name = account.name;
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const jobs = await sql`
      select * from service_jobs
      where lower(customer) = lower(${name})
      order by received desc nulls last, id desc`;
	const pms = await sql`
      select * from pm_jobs
      where lower(customer) = lower(${name})
      order by received desc nulls last, id desc`;
	const installs = await sql`
      select * from installs
      where archived = false and lower(customer) = lower(${name})
      order by install_date desc nulls last, id desc`;
	const deals = await sql`
      select * from deals
      where archived = false and lower(customer) = lower(${name})
      order by date_of_deal desc nulls last, id desc`;
	const recipes = await sql`
      select * from recipes
      where lower(customer) = lower(${name})
      order by equipment_model`;
	return {
		id: account.id,
		name,
		aviKatz: !!account.avi_katz,
		accountRep: account.account_rep ?? null,
		// The clean customer list: the name is locked; ID and address show to an Admin.
		nameLocked: account.name_locked === true,
		repFlag: account.rep_flag ?? null,
		accountNumber: account.account_number ?? null,
		canEditAccountNumber: await canReviewNames(sql, context.userId),
		// The saved map pin and where it came from; only an admin edits it (Account Details → Map pin).
		pin: account.latitude != null && account.longitude != null && account.latitude !== "" && account.longitude !== ""
			? { latitude: Number(account.latitude), longitude: Number(account.longitude), source: pinSourceLabel(account.geocode_match), manual: account.geocode_match === MANUAL_PIN_MATCH }
			: null,
		// Same rule as setAccountPin: a desk admin or the Admin role.
		canEditPin: await canReviewNames(sql, context.userId),
		salesReps: (await sql.query(
			"select rep_name, role, contribution_pct, is_primary from customer_sales_reps where customer_id = $1 order by is_primary desc, lower(rep_name), id",
			[account.id],
		)).map((r) => ({
			name: String(r.rep_name ?? ""),
			role: r.role ? String(r.role) : null,
			pct: r.contribution_pct === null || r.contribution_pct === undefined || r.contribution_pct === "" ? null : Number(r.contribution_pct),
			primary: r.is_primary === true || r.is_primary === "true",
		})),
		cleanList: (await canReviewNames(sql, context.userId))
			? { netsuiteId: account.name_locked === true ? account.netsuite_id ?? null : null, address: account.name_locked === true ? account.address ?? null : null }
			: null,
		// From the NetSuite customer import. Contact details show to everyone; the NetSuite ID and billing address to an Admin.
		netsuite: await (async () => {
			const admin = await canReviewNames(sql, context.userId);
			const text = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
			return {
				primaryContact: text(account.primary_contact),
				phone: text(account.phone),
				email: text(account.email),
				inactive: account.inactive === true,
				netsuiteId: admin ? text(account.netsuite_id) : null,
				billingAddress: admin
					? formatAddress({
							line1: text(account.billing_address1),
							line2: text(account.billing_address2),
							city: text(account.billing_city),
							state: text(account.billing_state),
							zip: text(account.billing_zip),
							country: text(account.billing_country),
						}) || null
					: null,
			};
		})(),
		jobs: applyMarks(attachJobSiblings(jobs.map((r) => mapJob(r, today))).filter((j) => !j.duplicateOf), marks),
		pms: applyMarks(pms.map((r) => mapPm(r, today)), marks),
		installs: await withWorkOrders(sql, await withInspections(sql, applyMarks(installs.map((r) => mapInstall(r, today, week, catalog)), marks))),
		deals: await (async () => {
			const projects = await loadBoardProjects(sql, catalog);
			return deals.map((r) => attachBoard(mapDeal(r, marks), projects));
		})(),
		recipes: recipes.map(mapRecipe)
	};
});
function directoryTable(kind: any) {
	if (kind === "customer") return "directory_customers";
	if (kind === "equipment") return "directory_equipment";
	throw new Error("Unknown directory");
}
export const listDirectory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { kind: DirectoryKind }) => d).handler(async ({ data }): Promise<DirectoryEntry[]> => {
	const sql = await ready();
	const table = directoryTable(data.kind);
	// Customers NetSuite marks Inactive aren't offered in pickers. A record that already names one keeps the name.
	const inactive = data.kind === "customer" ? " and inactive = false" : "";
	return await sql.query(`select id, name from ${table} where archived = false${inactive} order by lower(name)`);
});
/** The account's address (from the clean customer list), for tickets, PMs and installs. */
export type CustomerLocation = {
	latitude: number;
	longitude: number;
	match: "exact" | "close" | "approx" | null;
	matchedAddress: string | null;
	/** Entered by hand on Account Details (counts as exact). */
	manual?: boolean;
};
export const getCustomerAddress = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { name: string }) => d).handler(async ({ data }: any): Promise<{ address: string | null; location: CustomerLocation | null }> => {
	const sql = await ready();
	const name = String(data.name ?? "").trim();
	if (!name) return { address: null, location: null };
	const row = (await sql.query("select address, latitude, longitude, geocode_match, geocode_address from directory_customers where lower(name) = lower($1) and archived = false order by name_locked desc limit 1", [name]))[0];
	const location: CustomerLocation | null =
		row && row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined
			? {
					latitude: Number(row.latitude),
					longitude: Number(row.longitude),
					match: pinQuality(row.geocode_match),
					matchedAddress: row.geocode_address ? String(row.geocode_address) : null,
					manual: row.geocode_match === MANUAL_PIN_MATCH,
				}
			: null;
	return { address: row?.address ? String(row.address) : null, location };
});
/** One account's typed address and saved map pin, for the list rows. */
export type AccountAddress = {
	address: string | null;
	latitude: number | null;
	longitude: number | null;
	/** exact / close: the street was found. approx: only the ZIP code's center (never for directions). */
	match: "exact" | "close" | "approx" | null;
	/** The address the geocoder matched (Census, upper case). */
	geocodeAddress: string | null;
};
/**
 * Every saved account address and map pin, keyed by lower-case account name, for the list rows (one call, not one
 * per row). Accounts with an address or a pin are included. When two accounts share a name, one with a typed address
 * wins (as before, when only addressed rows were read), then name_locked desc, then id.
 */
export const listAccountAddresses = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Record<string, AccountAddress>> => {
	const sql = await ready();
	const rows = await sql.query(
		`select name, address, latitude, longitude, geocode_match, geocode_address
		   from directory_customers
		  where archived = false
		    and (coalesce(btrim(address), '') <> '' or (latitude is not null and longitude is not null))
		  order by (coalesce(btrim(address), '') = ''), name_locked desc, id`,
	);
	const coord = (v) => {
		if (v === null || v === undefined || v === "") return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	};
	const out: Record<string, AccountAddress> = {};
	for (const r of rows) {
		const key = String(r.name ?? "").trim().toLowerCase();
		if (!key || out[key]) continue;
		const latitude = coord(r.latitude);
		const longitude = coord(r.longitude);
		const pinned = latitude !== null && longitude !== null;
		const match = pinQuality(r.geocode_match);
		out[key] = {
			address: r.address ? String(r.address).trim() || null : null,
			latitude: pinned ? latitude : null,
			longitude: pinned ? longitude : null,
			match: pinned ? match : null,
			geocodeAddress: r.geocode_address ? String(r.geocode_address).trim() || null : null,
		};
	}
	return out;
});
export const updateCustomerAccount = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; aviKatz?: boolean; accountRep?: string | null }) => d).handler(async ({ data }: any) => {
	const sql = await ready();
	const dir = await sql`
      select id, name from directory_customers where id = ${data.id} and archived = false`;
	if (!dir[0]) throw new Error("Account not found");
	await upsertAccountMarks(sql, dir[0].name, {
		aviKatz: data.aviKatz,
		accountRep: data.accountRep
	});
	const marks = await loadAccountMarks(sql);
	return {
		id: dir[0].id,
		name: dir[0].name,
		aviKatz: isAviKatz(marks, dir[0].name),
		accountRep: accountRepFor(marks, dir[0].name)
	};
});
export const addDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { kind: DirectoryKind; name: string }) => d).handler(async ({ data }: any): Promise<DirectoryEntry> => {
	const sql = await ready();
	const name = data.name.trim();
	if (!name) throw new Error("Name is empty");
	const table = directoryTable(data.kind);
	if (data.kind === "customer") {
		// A new spelling of a locked clean-list name is that account, not a new one.
		const lockedName = await lockedNameFor(sql, name);
		if (lockedName) {
			const hit = (await sql.query(`select id, name from directory_customers where name = $1 limit 1`, [lockedName]))[0];
			if (hit) return { id: hit.id, name: hit.name };
		}
	}
	const existing = await sql.query(`select id, name, archived from ${table} where lower(name) = $1 limit 1`, [name.toLowerCase()]);
	if (existing[0]) {
		// Adding a removed name brings that account back, off Customers → Removed.
		if (existing[0].archived) {
			await sql.query(
				data.kind === "customer"
					? `update directory_customers set archived = false, removed_at = null, removed_by = null, updated_at = now() where id = $1`
					: `update ${table} set archived = false, updated_at = now() where id = $1`,
				[existing[0].id],
			);
		}
		return {
			id: existing[0].id,
			name: existing[0].name
		};
	}
	return (await sql.query(`insert into ${table} (name) values ($1) returning id, name`, [name]))[0];
});
export const archiveDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { kind: DirectoryKind; id: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	if (data.kind === "customer") {
		// Any account can be removed, with or without an Account Number (Chuy, 2026-10-26). Nothing is deleted, and
		// Customers → Removed can bring it back.
		await removeCustomersFor(sql, context.userId, [Number(data.id)]);
		return { ok: true, flagged: false };
	}
	const table = directoryTable(data.kind);
	await sql.query(`update ${table} set archived = true, updated_at = now() where id = $1`, [data.id]);
	return { ok: true, flagged: false };
});
export const renameCustomer = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; name: string; confirmMerge?: string | null }) => d).handler(async ({ data, context }: any): Promise<RenameResult> => {
	// A desk admin or the Admin role. A merge needs confirmMerge: the token of the merge question the window showed (customer-identity.ts).
	return renameCustomerFor(await ready(), context.userId, data.id, data.name, { confirmMerge: data.confirmMerge ?? null });
});
/** The rename window asks this first: a plain rename, or a merge and what it would move (nothing is saved). */
export const previewCustomerRename = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; name: string }) => d).handler(async ({ data, context }: any): Promise<RenamePlan> => {
	return previewCustomerRenameFor(await ready(), context.userId, data.id, data.name);
});
export const renameEquipment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; name: string }) => d).handler(async ({ data }: any) => {
	const sql = await ready();
	return renameOrMergeEquipment(sql, data.id, data.name);
});
async function findRecipeDup(sql: any, model: any, customer: any, exceptId: any = null, name: any = null) {
	const nameKey = (name ?? "").trim().toLowerCase();
	const hit = (customer ? await sql`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and lower(customer) = ${customer.toLowerCase()}
          and lower(coalesce(name, '')) = ${nameKey}` : await sql`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and customer is null
          and lower(coalesce(name, '')) = ${nameKey}`)[0];
	if (hit && hit.id !== exceptId) return hit;
	return null;
}
type RecipeInput = {
	id?: number;
	name?: string | null;
	equipmentModel: string;
	customer?: string | null;
	installId?: number | null;
	copiedFrom?: number | null;
	coffee1?: string | null;
	coffee2?: string | null;
	coffee3?: string | null;
	powder1?: string | null;
	powder2?: string | null;
	powder3?: string | null;
	americano1?: string | null;
	americano2?: string | null;
	americano3?: string | null;
	tea1?: string | null;
	tea2?: string | null;
	milk?: string | null;
	notes?: string | null;
};
export const upsertRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: RecipeInput) => d).handler(async ({ data }: any) => {
	const sql = await ready();
	const model = data.equipmentModel.trim();
	if (!model) throw new Error("Pick an equipment model");
	const customer = data.customer?.trim() || null;
	const isTemplate = !customer;
	// Editors that don't know about names (the Recipes page) keep whatever name the recipe has.
	const name = data.name === undefined
		? (data.id ? ((await sql`select name from recipes where id = ${data.id}`)[0]?.name ?? null) : null)
		: data.name?.trim() || null;
	let installId = data.installId ?? null;
	if (customer && installId == null) {
		const ins = await sql`
        select id from installs where lower(customer) = ${customer.toLowerCase()} limit 2`;
		if (ins.length === 1) installId = ins[0].id;
	}
	if (await findRecipeDup(sql, model, customer, data.id, name)) {
		const label = name ? `“${name}” ` : "";
		throw new Error(customer ? `A ${label}recipe for ${model} already exists on ${customer}${name ? "" : " — give this one a name"}` : `A ${label}house recipe for that model already exists${name ? "" : " — give this one a name"}`);
	}
	if (data.id) {
		await sql`
        update recipes set
          name = ${name},
          equipment_model = ${model},
          customer = ${customer},
          install_id = ${installId},
          copied_from = ${data.copiedFrom ?? null},
          is_template = ${isTemplate},
          coffee_1 = ${data.coffee1 ?? null},
          coffee_2 = ${data.coffee2 ?? null},
          coffee_3 = ${data.coffee3 ?? null},
          powder_1 = ${data.powder1 ?? null},
          powder_2 = ${data.powder2 ?? null},
          powder_3 = ${data.powder3 ?? null},
          americano_1 = ${data.americano1 ?? null},
          americano_2 = ${data.americano2 ?? null},
          americano_3 = ${data.americano3 ?? null},
          tea_1 = ${data.tea1 ?? null},
          tea_2 = ${data.tea2 ?? null},
          milk = ${data.milk ?? null},
          notes = ${data.notes ?? null},
          updated_at = now()
        where id = ${data.id}`;
		return mapRecipe((await sql`select * from recipes where id = ${data.id}`)[0]);
	}
	return mapRecipe((await sql`
      insert into recipes (
        name, equipment_model, customer, install_id, copied_from, is_template,
        coffee_1, coffee_2, coffee_3,
        powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
        tea_1, tea_2, milk, notes
      ) values (
        ${name}, ${model}, ${customer}, ${installId}, ${data.copiedFrom ?? null}, ${isTemplate},
        ${data.coffee1 ?? null}, ${data.coffee2 ?? null}, ${data.coffee3 ?? null},
        ${data.powder1 ?? null}, ${data.powder2 ?? null}, ${data.powder3 ?? null},
        ${data.americano1 ?? null}, ${data.americano2 ?? null}, ${data.americano3 ?? null},
        ${data.tea1 ?? null}, ${data.tea2 ?? null},
        ${data.milk ?? null}, ${data.notes ?? null}
      )
      returning *`)[0]);
});
export const copyRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { sourceId: number; customer: string; installId?: number | null }) => d).handler(async ({ data }: any) => {
	const sql = await ready();
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer to copy onto");
	const src = (await sql`select * from recipes where id = ${data.sourceId}`)[0];
	if (!src) throw new Error("Recipe not found");
	const model = String(src.equipment_model);
	if (await findRecipeDup(sql, model, customer)) throw new Error(`${customer} already has a ${model} recipe — open it instead`);
	let installId = data.installId ?? null;
	if (installId == null) {
		const ins = await sql`
        select id from installs where lower(customer) = ${customer.toLowerCase()} limit 2`;
		if (ins.length === 1) installId = ins[0].id;
	}
	return mapRecipe((await sql`
      insert into recipes (
        equipment_model, customer, install_id, copied_from, is_template,
        coffee_1, coffee_2, coffee_3,
        powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
        tea_1, tea_2, milk, notes
      ) values (
        ${model}, ${customer}, ${installId}, ${data.sourceId}, false,
        ${src.coffee_1 ?? null}, ${src.coffee_2 ?? null}, ${src.coffee_3 ?? null},
        ${src.powder_1 ?? null}, ${src.powder_2 ?? null}, ${src.powder_3 ?? null},
        ${src.americano_1 ?? null}, ${src.americano_2 ?? null}, ${src.americano_3 ?? null},
        ${src.tea_1 ?? null}, ${src.tea_2 ?? null},
        ${src.milk ?? null}, ${src.notes ?? null}
      )
      returning *`)[0]);
});

/** How many other machine rows (and copies) still point at this recipe. The open deal row can be left out. */
async function recipeUsedElsewhere(sql: any, id: number, exceptDealId: number | null, exceptIndex: number | null) {
	const re = new RegExp(`"recipeId"\\s*:\\s*${id}(?!\\d)`, "g");
	let n = 0;
	const deals = await sql`select id, machines from deals where archived = false and machines is not null`;
	for (const d of deals) {
		const text = String(d.machines ?? "");
		if (exceptDealId != null && Number(d.id) === Number(exceptDealId)) {
			try {
				const arr = JSON.parse(text);
				if (Array.isArray(arr)) {
					arr.forEach((m: any, i: number) => {
						if (exceptIndex != null && i === exceptIndex) return;
						if (Number(m?.recipeId) === id) n += 1;
					});
					continue;
				}
			} catch {
				/* fall through and count the text */
			}
		}
		n += (text.match(re) ?? []).length;
	}
	const installs = await sql`select machines from installs where archived = false and machines is not null`;
	for (const r of installs) n += (String(r.machines ?? "").match(re) ?? []).length;
	const copies = await sql`select count(*)::int as n from recipes where copied_from = ${id}`;
	n += Number(copies[0]?.n ?? 0);
	return n;
}

/** Remove a recipe from the list. Asks first only when some other machine still uses it. */
export const deleteRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; force?: boolean; exceptDealId?: number | null; exceptIndex?: number | null }) => d).handler(async ({ data }: any) => {
	const sql = await ready();
	const id = Number(data.id);
	const row = (await sql`select id from recipes where id = ${id}`)[0];
	if (!row) throw new Error("Recipe not found");
	const used = await recipeUsedElsewhere(sql, id, data.exceptDealId ?? null, data.exceptIndex ?? null);
	if (used > 0 && !data.force) return { deleted: false, needsConfirm: true, used };
	await sql`delete from recipes where id = ${id}`;
	return { deleted: true, needsConfirm: false, used: 0 };
});

