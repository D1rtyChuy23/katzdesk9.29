/* eslint-disable @typescript-eslint/ban-ts-comment -- legacy file, typed at its call sites */
// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { deskMiddleware, requireAdmin } from "@/lib/ops/access";
import { CLOSED_CALL, CLOSED_PM } from "./lookups";
import { isClosedCall, isOpenCall, isClosedPm, isOpenPm } from "./ticket-status";
import { canonicalTechName, sameTech } from "./tech-match";
import { boardLocked, cleanTime, type BoardType } from "./day-board";
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
import { canMarkInstalled, loadInspectionSummaries, syncInstallUnits, withInspections } from "./inspection-api";
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
import { specsFromInstall, parseMachinesJson, type MachineSpec } from "./machines";
import { listedEquipment, matchModel, catalogModels } from "./equipment";
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
import { renameOrMergeEquipment, renameOrMergeCustomer } from "./customer-identity";
import { canonicalRepName, isNoRep, PRODUCER_INITIALS } from "./rep-match";
import { loadAccountMarks, upsertAccountMarks, isAviKatz, accountRepFor } from "./reps";
import { woMatchKey } from "./corrigo";
import { mergeServiceJobs } from "./wo-duplicates";
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
		aviKatz: false
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
		amount: num(r.amount),
		goodToOrder: !!r.good_to_order,
		ordered: !!r.ordered,
		eta: r.eta ?? null,
		terms: r.terms ?? null,
		invoice: r.invoice ?? null,
		completion: r.completion ?? null,
		notes: r.notes ?? null,
		handedOff: !!r.handed_off,
		updatedAt: String(r.updated_at),
		aviKatz: marks ? isAviKatz(marks, customer) : false,
		noRep: isNoRep(producer)
	};
}
function applyMarks(rows: any, marks: any) {
	for (const r of rows) {
		r.aviKatz = isAviKatz(marks, r.customer ?? null);
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
		stockHoldBy: r.stock_hold_by ?? null
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
export const listJobs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { kind: "service" | "tlc" }) => d).handler(async ({ data }): Promise<ServiceJob[]> => {
	const sql = await ready();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	return applyMarks(attachJobSiblings((await sql`select * from service_jobs order by received desc nulls last, id desc`).map((r) => mapJob(r, today))), marks).filter((j) => j.kind === data.kind);
});
export const getJob = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { id: number }) => d).handler(async ({ data }): Promise<ServiceJob | null> => {
	const sql = await ready();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	const rows = await sql`select * from service_jobs where id = ${data.id}`;
	if (!rows[0]) return null;
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
	if (next.status === "Phone Resolved") next.phone_resolved = true;
	else if (data.status && next.status !== "Phone Resolved") next.phone_resolved = false;
	await sql`
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
        wo = ${next.wo},
        scheduled = ${next.scheduled},
        notes = ${next.notes},
        work_done = ${next.work_done},
        completed_at = ${next.completed_at},
        done = ${next.done},
        urgency = ${next.urgency},
        updated_at = now()
      where id = ${data.id}`;
	if (data.status && data.status !== cur[0].status) await logActivity(sql, context.userId, cur[0].kind, data.id, "status", `${cur[0].status} → ${data.status}`);
	const extra = summarize([
		changed("customer", cur[0].customer, next.customer),
		changed("technician", cur[0].technician, next.technician),
		changed("equipment", cur[0].equipment, next.equipment),
		changed("issue", cur[0].issue, next.issue),
		changed("urgency", cur[0].urgency, next.urgency),
		changed("scheduled", cur[0].scheduled, next.scheduled)
	]);
	if (extra) await logActivity(sql, context.userId, cur[0].kind, data.id, "updated", extra);
	return getJob({ data: { id: data.id } });
});
export const mergeServiceTickets = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { keeperId: number; extraId: number }) => d).handler(async ({ data, context }: any): Promise<ServiceJob | null> => {
	const sql = await ready();
	if (data.keeperId === data.extraId) throw new Error("Pick a different ticket to merge into.");
	const actor = await deskUsername(sql, context.userId);
	const result = await mergeServiceJobs(sql, data.keeperId, data.extraId, actor);
	if (!result) throw new Error("Could not merge those tickets.");
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
 * Planner day board: a block dropped on another time or another tech. Sets the day, the time of day and the
 * assigned tech in one write. Completed and cancelled work is refused — it stays where it was done.
 */
export const moveBoardBlock = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { type: BoardType; id: number; date: string; time: string | null; technician: string | null }) => z.object({
	type: z.enum(["service", "tlc", "pm", "install"]),
	id: z.number().int().positive(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	time: z.string().nullable(),
	technician: z.string().trim().max(80).nullable()
}).parse(d)).handler(async ({ data, context }: any): Promise<{ ok: true; date: string; time: string | null; technician: string | null }> => {
	const sql = await ready();
	const time = data.time == null ? null : cleanTime(data.time);
	if (data.time != null && !time) throw new Error("That is not a time of day.");
	const tech = data.technician ? canonicalTechName(data.technician) ?? data.technician : null;
	const table = data.type === "pm" ? "pm_jobs" : data.type === "install" ? "installs" : "service_jobs";
	const dateCol = data.type === "pm" ? "projected" : data.type === "install" ? "install_date" : "scheduled";
	const cur = (await sql.query(`select * from ${table} where id = $1`, [data.id]))[0] as any;
	if (!cur) throw new Error("That work is no longer on the Desk.");
	const locked = data.type === "install" ? isInstalled({ complete: cur.complete, equipStatus: cur.equip_status }) : boardLocked({ status: cur.status, done: cur.done });
	if (locked) throw new Error("Completed and cancelled work does not move.");
	await sql.query(`update ${table} set ${dateCol} = $2, sched_time = $3, technician = $4, updated_at = now() where id = $1`, [data.id, data.date, time, tech]);
	const was = isoDate(cur[dateCol]);
	const extra = summarize([
		changed("scheduled", [was, cleanTime(cur.sched_time)].filter(Boolean).join(" ") || null, [data.date, time].filter(Boolean).join(" ")),
		changed("technician", cur.technician, tech)
	]);
	if (extra) await logActivity(sql, context.userId, data.type === "service" || data.type === "tlc" ? cur.kind : data.type, data.id, "updated", extra);
	return { ok: true, date: data.date, time, technician: tech };
});
export const listPms = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<PmJob[]> => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	return applyMarks((await sql`select * from pm_jobs order by received desc nulls last, id desc`).map((r) => mapPm(r, todayChicago())), marks);
});
export const updatePm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; customer?: string; equipment?: string | null; style?: string | null; projected?: string | null; partsStatus?: string | null; status?: string; technician?: string | null; notes?: string | null; workDone?: string | null; completedAt?: string | null; done?: boolean; wo?: string | null }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`select * from pm_jobs where id = ${data.id}`;
	if (!cur[0]) throw new Error("PM not found");
	const c = cur[0];
	const status = data.status ?? c.status;
	const done = data.done === undefined ? data.status === undefined ? c.done : CLOSED_PM.has(status) : data.done;
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
	return mapPm((await sql`select * from pm_jobs where id = ${data.id}`)[0], todayChicago());
});
export const createPm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { customer: string; equipment?: string; style?: string }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const rows = await sql`
      insert into pm_jobs (customer, equipment, style, received, status)
      values (${data.customer}, ${data.equipment ?? null}, ${data.style ?? "12 month PM"}, ${todayChicago()}, ${"Pending Scheduling"})
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
export const listDeals = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Deal[]> => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	return (await sql`select * from deals where archived = false order by id`).map((r) => mapDeal(r, marks));
});
export const updateDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; customer?: string; producer?: string | null; accountType?: string | null; equipment?: string | null; amount?: number | null; goodToOrder?: boolean; ordered?: boolean; eta?: string | null; terms?: string | null; invoice?: string | null; completion?: string | null; notes?: string | null; aviKatz?: boolean }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`select * from deals where id = ${data.id}`;
	if (!cur[0]) throw new Error("Deal not found");
	const c = cur[0];
	const producer = data.producer === undefined ? c.producer : canonicalRepName(data.producer);
	const completion = data.completion === undefined ? c.completion : data.completion;
	await sql`
      update deals set
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
	return mapDeal((await sql`select * from deals where id = ${data.id}`)[0], marks);
});
export const createDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { customer: string; producer?: string; equipment?: string; amount?: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const producer = canonicalRepName(data.producer);
	const rows = await sql`
      insert into deals (customer, producer, equipment, amount, date_of_deal)
      values (${data.customer}, ${producer}, ${data.equipment ?? null}, ${data.amount ?? null}, ${todayChicago()})
      returning *`;
	await logActivity(sql, context.userId, "deal", rows[0].id, "opened", data.customer);
	if (producer) await upsertAccountMarks(sql, data.customer, { accountRep: producer });
	const marks = await loadAccountMarks(sql);
	return mapDeal(rows[0], marks);
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
	await sql`
    insert into installs (received, customer, equipment, account_rep, payment_status, deal_id)
    values (
      ${todayChicago()},
      ${deal.customer},
      ${deal.equipment ?? null},
      ${initials},
      ${deal.terms ?? null},
      ${dealId}
    )`;
}
export const listInstalls = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async (): Promise<Install[]> => {
	const sql = await ready();
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const marks = await loadAccountMarks(sql);
	return withInspections(sql, applyMarks((await sql`select * from installs where archived = false order by id`).map((r) => mapInstall(r, today, week, catalog)), marks));
});
export const updateInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; customer?: string; equipment?: string | null; equipStatus?: string | null; installDate?: string | null; technician?: string | null; wo?: string | null; reqsReady?: string | null; notes?: string | null; accountRep?: string | null; paymentStatus?: string | null; serial?: string | null; powerVoltage?: string | null; machines?: MachineSpec[] | string | null; complete?: boolean; workDone?: string | null; completedAt?: string | null; duplicateOf?: number | null; aviKatz?: boolean }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = await sql`select * from installs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Install not found");
	const c = cur[0];
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
	const machinesJson = data.machines === undefined ? c.machines : data.machines == null ? null : (() => {
		const raw = typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
		const parsed = parseMachinesJson(raw);
		if (!parsed.length) return raw;
		return JSON.stringify(parsed.map((s) => ({
			...s,
			equipment: matchModel(s.equipment, catalog)
		})));
	})();
	await sql`
      update installs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === undefined ? c.equipment : data.equipment},
        equip_status = ${equipStatus},
        install_date = ${data.installDate === undefined ? c.install_date : data.installDate},
        technician = ${data.technician === undefined ? c.technician : data.technician},
        wo = ${data.wo === undefined ? c.wo : data.wo},
        reqs_ready = ${data.reqsReady === undefined ? c.reqs_ready : data.reqsReady},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        work_done = ${data.workDone === undefined ? c.work_done : data.workDone},
        completed_at = ${data.completedAt === undefined ? c.completed_at : data.completedAt},
        account_rep = ${data.accountRep === undefined ? c.account_rep : canonicalRepName(data.accountRep) ?? (data.accountRep || null)},
        payment_status = ${data.paymentStatus === undefined ? c.payment_status : data.paymentStatus},
        serial = ${data.serial === undefined ? c.serial : data.serial},
        power_voltage = ${data.powerVoltage === undefined ? c.power_voltage : data.powerVoltage},
        machines = ${machinesJson},
        complete = ${complete},
        duplicate_of = ${data.duplicateOf === undefined ? c.duplicate_of : data.duplicateOf},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.equip_status, equipStatus),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("technician", c.technician, data.technician === undefined ? c.technician : data.technician),
		changed("equipment", c.equipment, data.equipment === undefined ? c.equipment : data.equipment),
		changed("account rep", c.account_rep, data.accountRep === undefined ? c.account_rep : data.accountRep),
		data.duplicateOf === null && c.duplicate_of ? "cleared duplicate flag" : data.duplicateOf && data.duplicateOf !== c.duplicate_of ? `flagged duplicate of #${data.duplicateOf}` : null
	]);
	if (extra) await logActivity(sql, context.userId, "install", data.id, "updated", extra);
	const customerName = String(data.customer ?? c.customer);
	if (data.aviKatz !== undefined || data.accountRep !== undefined) await upsertAccountMarks(sql, customerName, {
		aviKatz: data.aviKatz,
		accountRep: data.accountRep === undefined ? undefined : canonicalRepName(data.accountRep) ?? (data.accountRep || null)
	});
	if (data.equipment !== undefined || data.machines !== undefined || data.serial !== undefined || data.powerVoltage !== undefined) {
		await syncInstallUnits(sql, data.id, { prune: true });
	}
	const today = todayChicago();
	const week = weekBounds(today);
	const marks = await loadAccountMarks(sql);
	return (await withInspections(sql, applyMarks([mapInstall((await sql`select * from installs where id = ${data.id}`)[0], today, week, catalog)], marks)))[0];
});
export const createInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { customer: string; equipment?: string; technician?: string; serial?: string; powerVoltage?: string; machines?: MachineSpec[] | string | null }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const catalog = await loadEquipCatalog(sql);
	const machinesJsonRaw = data.machines == null ? null : typeof data.machines === "string" ? data.machines : JSON.stringify(data.machines);
	const parsed = parseMachinesJson(machinesJsonRaw);
	const machinesJson = parsed.length ? JSON.stringify(parsed.map((s) => ({
		...s,
		equipment: matchModel(s.equipment, catalog)
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
	return mapInstall(rows[0], todayChicago(), weekBounds(todayChicago()), catalog);
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
export const searchAll = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { q: string }) => d).handler(async ({ data }): Promise<SearchHit[]> => {
	const sql = await ready();
	const q = data.q.trim();
	if (q.length < 2) return [];
	const like = `%${q.replace(/%/g, "")}%`;
	const hits = [];
	const jobs = await sql`
      select id, kind, customer, call_id, status, wo from service_jobs
      where customer ilike ${like} or call_id ilike ${like} or coalesce(wo,'') ilike ${like} or coalesce(issue,'') ilike ${like}
      order by received desc nulls last limit 8`;
	for (const j of jobs) hits.push({
		entityType: j.kind,
		id: j.id,
		title: j.customer ?? j.call_id,
		subtitle: `${j.call_id}${j.wo ? " · " + j.wo : ""}`,
		status: j.status
	});
	const pms = await sql`
      select id, customer, status, equipment from pm_jobs where customer ilike ${like} limit 5`;
	for (const p of pms) hits.push({
		entityType: "pm",
		id: p.id,
		title: p.customer,
		subtitle: p.equipment ?? "PM",
		status: p.status
	});
	const ins = await sql`
      select id, customer, equip_status, wo from installs
      where archived = false and (customer ilike ${like} or coalesce(wo,'') ilike ${like})
      limit 5`;
	for (const i of ins) hits.push({
		entityType: "install",
		id: i.id,
		title: i.customer,
		subtitle: i.wo ?? "Install",
		status: i.equip_status
	});
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
	return hits.slice(0, 28);
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
export const updateAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; model?: string; serial?: string | null; qty?: number; customerOwned?: string | null; purpose?: string | null; notes?: string | null; pallet?: string | null; level?: number | null; site?: string }) => d).handler(async ({ data, context }: any): Promise<Asset> => {
	const sql = await ready();
	const cur = await sql`select * from assets where id = ${data.id}`;
	if (!cur[0]) throw new Error("Asset not found");
	const c = cur[0];
	let pallet = data.pallet === undefined ? c.pallet : data.pallet;
	const level = data.level === undefined ? c.level : data.level;
	let line = c.line_no;
	const site = data.site === undefined ? c.site : data.site;
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
});
export const assignAssetToInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number; installId: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
	if (asset.status === "sold") throw new Error("Already sold");
	const inst = (await sql`
      select id, customer from installs where id = ${data.installId}`)[0];
	if (!inst) throw new Error("Install not found");
	// Locked: a unit already assigned to an account is an asset at that site until it is returned.
	if (asset.status === "assigned") {
		if (asset.install_id === inst.id) return mapAsset(asset);
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
        updated_at = now()
      where id = ${data.assetId}`;
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)}.`;
	await logActivity(sql, context.userId, "install", inst.id, "assigned-asset", detail);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
export const unassignAssetFromInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number; installId: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.install_id !== data.installId) throw new Error("That unit is not on this install");
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
        updated_at = now()
      where id = ${data.assetId}`;
	await logActivity(sql, context.userId, "install", data.installId, "unassigned-asset", asset.model);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
export const assignAssetToService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number; customer: string; jobId?: number | null }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer");
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
	if (asset.status === "sold") throw new Error("Already sold");
	if (asset.status !== "ready") throw new Error("That unit is already off the rack");
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
        updated_at = now()
      where id = ${data.assetId}`;
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)} for ${name}.`;
	await logActivity(sql, context.userId, "asset", data.assetId, "assigned-service", detail);
	if (job) await logActivity(sql, context.userId, job.kind, job.id, "assigned-asset", detail);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
export const unassignAssetFromService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { assetId: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.status !== "assigned" || asset.install_id) throw new Error("That unit is not pulled for service");
	const slot = await findOpenBarnSlot(sql, {
		site: asset.origin_site ?? null,
		pallet: asset.origin_pallet ?? null,
		level: num(asset.origin_level)
	});
	const jobId = asset.job_id;
	const jobKind = jobId ? (await sql`select kind from service_jobs where id = ${jobId}`)[0]?.kind : null;
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
        updated_at = now()
      where id = ${data.assetId}`;
	await logActivity(sql, context.userId, "asset", data.assetId, "unassigned-service", asset.model);
	if (jobId && jobKind) await logActivity(sql, context.userId, jobKind, jobId, "unassigned-asset", asset.model);
	return mapAsset((await sql`select * from assets where id = ${data.assetId}`)[0]);
});
export const returnAssetToWarehouse = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; site: "barn-back" | "barn-front"; pallet: string; level: number }) => d).handler(async ({ data, context }: any): Promise<Asset> => {
	const sql = await ready();
	const prev = (await sql`select * from assets where id = ${data.id}`)[0];
	if (!prev) throw new Error("Asset not found");
	if (prev.stock_hold) throw new Error("This unit is waiting on approval. The slot stays until then.");
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
});
export const markAssetSold = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; soldTo: string }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	const cur = (await sql`select * from assets where id = ${data.id}`)[0];
	if (!cur) throw new Error("Asset not found");
	if (cur.customer_owned) throw new Error("Customer-owned unit — return it, don’t sell it");
	await sql`
      update assets set
        status = 'sold',
        site = 'sold',
        pallet = null,
        level = null,
        line_no = null,
        sold_to = ${data.soldTo},
        sold_at = ${todayChicago()},
        updated_at = now()
      where id = ${data.id}`;
	await logActivity(sql, context.userId, "asset", data.id, "sold", data.soldTo);
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
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
		noRep: isNoRep(r.account_rep)
	}));
});
export const getCustomerHistory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d: { id: number }) => d).handler(async ({ data }: any): Promise<CustomerHistory | null> => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	const account = (await sql`
      select id, name, avi_katz, account_rep from directory_customers where id = ${data.id} and archived = false`)[0];
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
		jobs: applyMarks(attachJobSiblings(jobs.map((r) => mapJob(r, today))).filter((j) => !j.duplicateOf), marks),
		pms: applyMarks(pms.map((r) => mapPm(r, today)), marks),
		installs: await withInspections(sql, applyMarks(installs.map((r) => mapInstall(r, today, week, catalog)), marks)),
		deals: deals.map((r) => mapDeal(r, marks)),
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
	return await sql.query(`select id, name from ${table} where archived = false order by lower(name)`);
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
	const existing = await sql.query(`select id, name, archived from ${table} where lower(name) = $1 limit 1`, [name.toLowerCase()]);
	if (existing[0]) {
		if (existing[0].archived) await sql.query(`update ${table} set archived = false, updated_at = now() where id = $1`, [existing[0].id]);
		return {
			id: existing[0].id,
			name: existing[0].name
		};
	}
	return (await sql.query(`insert into ${table} (name) values ($1) returning id, name`, [name]))[0];
});
export const archiveDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { kind: DirectoryKind; id: number }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	if (data.kind === "customer") await requireAdmin(sql, context.userId, "Only an admin can add or remove customers.");
	const table = directoryTable(data.kind);
	await sql.query(`update ${table} set archived = true, updated_at = now() where id = $1`, [data.id]);
	return { ok: true };
});
export const renameCustomer = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d: { id: number; name: string }) => d).handler(async ({ data, context }: any) => {
	const sql = await ready();
	await requireAdmin(sql, context.userId, "Only an admin can rename or merge customers.");
	return renameOrMergeCustomer(sql, data.id, data.name);
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

