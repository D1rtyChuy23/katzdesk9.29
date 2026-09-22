import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { i as canonicalRepName, o as isNoRep, r as PRODUCER_INITIALS } from "./rep-match-DCVeb4ID.mjs";
import { i as CLOSED_PM, r as CLOSED_CALL } from "./lookups-BkjR5sto.mjs";
import { c as installFlag, d as pmFlag, f as serviceFlag, m as weekBounds, n as diffDays, p as todayChicago, s as formatWeekLabel, t as addDays } from "./clock-CSFAgASg.mjs";
import { A as boolean, F as object, P as number, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { r as getSql } from "./db-DloSBs0E.mjs";
import { a as deskMiddleware, m as requireAdmin } from "./access-3Tz151bB.mjs";
import { r as parseMentions } from "./mentions-Cvlq5S1G.mjs";
import { t as deliverPings } from "./notify-CruvKMVL.mjs";
import { a as listedEquipment, o as matchModel, t as catalogModels } from "./equipment-BifqoJpR.mjs";
import { a as loadAccountMarks, l as upsertAccountMarks, n as customerKey, r as isAviKatz } from "./reps-B2EuoM-m.mjs";
import { i as specsFromInstall, n as parseMachinesJson } from "./machines-CQiZYEgz.mjs";
import { n as renameOrMergeEquipment, t as renameOrMergeCustomer } from "./customer-identity-Dua6E4FC.mjs";
import { u as woMatchKey } from "./corrigo-BiVK0F9F.mjs";
import { t as mergeServiceJobs } from "./wo-duplicates-DELFSke-.mjs";
import { c as bayFor, d as siteLabel, f as slotId, i as LEVELS, l as isBarn, n as BARN_EQUIP_CAPACITY, r as FRONT_PALLETS, t as BACK_PALLETS, u as palletsFor } from "./warehouse-B30B9_go.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-CVZ1snyg.js
var INITIALS_TO_PRODUCER = Object.fromEntries(Object.entries(PRODUCER_INITIALS).map(([name, initials]) => [initials.toLowerCase(), name]));
function salesName(owners) {
	if (!owners) return null;
	const producer = owners.producer?.trim();
	if (producer) return producer;
	const rep = owners.accountRep?.trim();
	if (!rep) return null;
	const fromInitials = INITIALS_TO_PRODUCER[rep.toLowerCase()];
	return fromInitials ? `${fromInitials} (${rep})` : rep;
}
function noteOwner(c, owners) {
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
async function ready() {
	const { ensureSeeded } = await import("./seed.server-qDRWEwJF.mjs");
	await ensureSeeded();
	return getSql();
}
async function deskUsername(sql, userId) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}
async function logActivity(sql, userId, entityType, entityId, action, detail) {
	await sql`
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    values (${entityType}, ${entityId}, ${await deskUsername(sql, userId)}, ${action}, ${detail ?? null})`;
}
function changed(label, before, after) {
	const a = before == null || before === "" ? "" : String(before);
	const b = after == null || after === "" ? "" : String(after);
	if (a === b) return null;
	if (label === "technician" || label === "producer" || label === "account rep") return b ? `assigned ${b}` : `cleared ${label}`;
	if (label === "status") return `${a || "—"} → ${b || "—"}`;
	if (!b) return `cleared ${label}`;
	return `${label}: ${b.slice(0, 72)}`;
}
function summarize(parts) {
	const hits = parts.filter((x) => !!x);
	return hits.length ? hits.slice(0, 4).join(" · ") : null;
}
async function loadEquipCatalog(sql) {
	const dir = await sql`
    select name from directory_equipment where archived = false and coalesce(name, '') <> ''`;
	const assets = await sql`
    select distinct model from assets where kind = 'equip' and coalesce(model, '') <> ''`;
	return catalogModels([...dir.map((r) => r.name), ...assets.map((r) => r.model)]);
}
function num(v) {
	if (v === null || v === void 0 || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}
function isoDate(v) {
	if (v === null || v === void 0 || v === "") return null;
	if (typeof v === "string") return v.slice(0, 10);
	return String(v).slice(0, 10);
}
function jobSibling(r) {
	return {
		id: r.id,
		callId: r.callId,
		customer: r.customer,
		kind: r.kind,
		status: r.status,
		wo: r.wo
	};
}
function attachJobSiblings(jobs) {
	const groups = /* @__PURE__ */ new Map();
	for (const j of jobs) {
		if (j.duplicateOf) continue;
		const key = woMatchKey(j.wo ?? "");
		if (!key) continue;
		const list = groups.get(key) ?? [];
		list.push(j);
		groups.set(key, list);
	}
	return jobs.map((j) => {
		const key = woMatchKey(j.wo ?? "");
		const group = key ? groups.get(key) ?? [] : [];
		return {
			...j,
			siblings: group.filter((o) => o.id !== j.id).map(jobSibling)
		};
	});
}
function mapJob(r, today) {
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
function mapPm(r, today) {
	const projected = isoDate(r.projected);
	return {
		id: r.id,
		customer: r.customer,
		received: isoDate(r.received),
		equipment: r.equipment,
		style: r.style,
		projected,
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
function mapInstall(r, today, week, catalog = []) {
	const installDate = isoDate(r.install_date);
	return {
		id: r.id,
		received: isoDate(r.received),
		customer: r.customer,
		equipment: r.equipment,
		equipStatus: r.equip_status,
		installDate,
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
function mapDeal(r, marks) {
	const customer = String(r.customer);
	const producer = r.producer ?? null;
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
function applyMarks(rows, marks) {
	for (const r of rows) r.aviKatz = isAviKatz(marks, r.customer ?? null);
	return rows;
}
function mapModule(r) {
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
		updatedAt: String(r.updated_at)
	};
}
function mapComment(r, owners) {
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
function mapAsset(r) {
	const pallet = r.pallet;
	const level = num(r.level);
	const lineNo = num(r.line_no);
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
		slotLabel: pallet && level ? slotId(pallet, level, lineNo) : siteLabel(r.site),
		missingSerial: r.kind === "equip" && !r.serial
	};
}
function mapRecipe(r) {
	return {
		id: r.id,
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
var getDashboard_createServerFn_handler = createServerRpc({
	id: "3b18cb7c79b3d2a3708e94af1b95e011080a0bb6c37961f6996b2819e381e376",
	name: "getDashboard",
	filename: "src/lib/ops/api.ts"
}, (opts) => getDashboard.__executeServer(opts));
var getDashboard = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(getDashboard_createServerFn_handler, async () => {
	const sql = await ready();
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const marks = await loadAccountMarks(sql);
	const jobs = applyMarks(attachJobSiblings((await sql`select * from service_jobs`).map((r) => mapJob(r, today))).filter((j) => !j.duplicateOf), marks);
	const pms = applyMarks((await sql`select * from pm_jobs`).map((r) => mapPm(r, today)), marks);
	const installs = applyMarks((await sql`select * from installs where archived = false`).map((r) => mapInstall(r, today, week, catalog)), marks);
	const deals = (await sql`select * from deals where archived = false`).map((r) => mapDeal(r, marks));
	const svc = jobs.filter((j) => j.kind === "service");
	const tlc = jobs.filter((j) => j.kind === "tlc");
	const svcActive = svc.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
	const tlcActive = tlc.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
	const pmActive = pms.filter((p) => !CLOSED_PM.has(p.status) && !p.done);
	const flaggedSvc = svc.filter((j) => j.flag).sort((a, b) => a.flag.rank - b.flag.rank || (a.ageDays ?? 0) - (b.ageDays ?? 0) || a.id - b.id);
	const flaggedTlc = tlc.filter((j) => j.flag).sort((a, b) => (a.received ?? "").localeCompare(b.received ?? ""));
	const flaggedPm = pms.filter((p) => p.flag);
	const toFlag = (j, type) => ({
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
	const comingDue = [];
	const laterHorizon = addDays(week.end, 21);
	const pushDue = (row) => {
		comingDue.push(row);
	};
	for (const j of jobs) {
		if (CLOSED_CALL.has(j.status) || j.done || !j.scheduled) continue;
		if (j.scheduled > laterHorizon) continue;
		const accountRep = marks.rep.get(customerKey(j.customer)) ?? null;
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
		if (CLOSED_PM.has(p.status) || p.done || !p.projected) continue;
		if (p.projected > laterHorizon) continue;
		const accountRep = marks.rep.get(customerKey(p.customer)) ?? null;
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
		if (i.complete || i.equipStatus === "Installed" || !i.installDate) continue;
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
			noRep: i.noRep
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
	const { loadTechs } = await import("./roster-CEJORJjG.mjs").then((n) => n.a).then((n) => n.a);
	const roster = await loadTechs(sql);
	const activeNames = roster.filter((t) => t.active).map((t) => t.name);
	const assigned = [...new Set(jobs.map((j) => j.technician).filter((n) => !!n))];
	const techNames = [...activeNames];
	for (const n of assigned) {
		if (techNames.some((x) => x.toLowerCase() === n.toLowerCase())) continue;
		if (jobs.some((j) => j.technician === n && !CLOSED_CALL.has(j.status) && !j.done)) techNames.push(n);
	}
	const techLoad = techNames.map((tech) => {
		const all = jobs.filter((j) => j.technician === tech);
		const row = roster.find((t) => t.name.toLowerCase() === tech.toLowerCase());
		return {
			tech: row && !row.active ? `${tech} (inactive)` : tech,
			active: all.filter((j) => !CLOSED_CALL.has(j.status) && !j.done).length,
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
	const installQueue = installs.filter((i) => !i.complete && i.equipStatus !== "Installed");
	const installAtRisk = installQueue.filter((i) => i.flag).length;
	const installReadyRows = installQueue.filter((i) => i.equipStatus === "Ready");
	const installReadyByEquip = (() => {
		const map = /* @__PURE__ */ new Map();
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
	const { loadRebuilds } = await import("./rebuilds-C-RRmTb-.mjs");
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
				count: installs.filter((i) => i.complete || i.equipStatus === "Installed").length
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
async function entityContext(sql, type, id) {
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
var listJobs_createServerFn_handler = createServerRpc({
	id: "dd497d0a20bc74fd3516a43287eaf1f59ba8ff78889d055ec0134cb3b8100557",
	name: "listJobs",
	filename: "src/lib/ops/api.ts"
}, (opts) => listJobs.__executeServer(opts));
var listJobs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(listJobs_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	return applyMarks(attachJobSiblings((await sql`select * from service_jobs order by received desc nulls last, id desc`).map((r) => mapJob(r, today))), marks).filter((j) => j.kind === data.kind);
});
var getJob_createServerFn_handler = createServerRpc({
	id: "7c7f50c54b853be302ab8dadb93d606276a3163565accc501df10cc4604d24fe",
	name: "getJob",
	filename: "src/lib/ops/api.ts"
}, (opts) => getJob.__executeServer(opts));
var getJob = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(getJob_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const today = todayChicago();
	const marks = await loadAccountMarks(sql);
	const rows = await sql`select * from service_jobs where id = ${data.id}`;
	if (!rows[0]) return null;
	const others = await sql`
      select * from service_jobs where coalesce(wo, '') <> ''`;
	return applyMarks(attachJobSiblings([rows[0], ...others.filter((r) => r.id !== rows[0].id)].map((r) => mapJob(r, today))), marks).find((j) => j.id === data.id) ?? null;
});
var jobPatch = object({
	id: number(),
	contact: string().nullable().optional(),
	phone: string().nullable().optional(),
	received: string().nullable().optional(),
	customer: string().nullable().optional(),
	equipment: string().nullable().optional(),
	issue: string().nullable().optional(),
	callType: string().nullable().optional(),
	phoneResolved: boolean().optional(),
	status: string().optional(),
	technician: string().nullable().optional(),
	wo: string().nullable().optional(),
	scheduled: string().nullable().optional(),
	notes: string().nullable().optional(),
	workDone: string().nullable().optional(),
	completedAt: string().nullable().optional(),
	done: boolean().optional(),
	urgency: string().optional()
});
var updateJob_createServerFn_handler = createServerRpc({
	id: "9c7c27f89aa4613cba7b0cc60709986234616c8f59c62126c823a868928946ec",
	name: "updateJob",
	filename: "src/lib/ops/api.ts"
}, (opts) => updateJob.__executeServer(opts));
var updateJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => jobPatch.parse(d)).handler(updateJob_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`select * from service_jobs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Job not found");
	const next = {
		contact: data.contact ?? cur[0].contact,
		phone: data.phone ?? cur[0].phone,
		received: data.received === void 0 ? cur[0].received : data.received,
		customer: data.customer ?? cur[0].customer,
		equipment: data.equipment ?? cur[0].equipment,
		issue: data.issue ?? cur[0].issue,
		call_type: data.callType === void 0 ? cur[0].call_type : data.callType,
		phone_resolved: data.phoneResolved === void 0 ? cur[0].phone_resolved : data.phoneResolved,
		status: data.status ?? cur[0].status,
		technician: data.technician === void 0 ? cur[0].technician : data.technician,
		wo: data.wo === void 0 ? cur[0].wo : data.wo,
		scheduled: data.scheduled === void 0 ? cur[0].scheduled : data.scheduled,
		notes: data.notes === void 0 ? cur[0].notes : data.notes,
		work_done: data.workDone === void 0 ? cur[0].work_done : data.workDone,
		completed_at: data.completedAt === void 0 ? cur[0].completed_at : data.completedAt,
		done: data.done === void 0 ? cur[0].done : data.done,
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
var mergeServiceTickets_createServerFn_handler = createServerRpc({
	id: "5185381881205a8fef6ae18a40613e887010ff017f2d63e1a073bbc7aeb44afb",
	name: "mergeServiceTickets",
	filename: "src/lib/ops/api.ts"
}, (opts) => mergeServiceTickets.__executeServer(opts));
var mergeServiceTickets = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(mergeServiceTickets_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	if (data.keeperId === data.extraId) throw new Error("Pick a different ticket to merge into.");
	const actor = await deskUsername(sql, context.userId);
	const result = await mergeServiceJobs(sql, data.keeperId, data.extraId, actor);
	if (!result) throw new Error("Could not merge those tickets.");
	return getJob({ data: { id: result.keeperId } });
});
var createJob_createServerFn_handler = createServerRpc({
	id: "33d624b110f3c458dc2c4420e1a7861c9781d7f6cfc29f1e17303ebbdacf5185",
	name: "createJob",
	filename: "src/lib/ops/api.ts"
}, (opts) => createJob.__executeServer(opts));
var createJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createJob_createServerFn_handler, async ({ data, context }) => {
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
var listPms_createServerFn_handler = createServerRpc({
	id: "b77061ca68bf02683e5808aff14e21ac7f7f4324c20c77e18ff63950e0f4c940",
	name: "listPms",
	filename: "src/lib/ops/api.ts"
}, (opts) => listPms.__executeServer(opts));
var listPms = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listPms_createServerFn_handler, async () => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	return applyMarks((await sql`select * from pm_jobs order by received desc nulls last, id desc`).map((r) => mapPm(r, todayChicago())), marks);
});
var updatePm_createServerFn_handler = createServerRpc({
	id: "1ae4b4e6892721617dfc78392d46516266eb655551d1a355b50347de340f48e6",
	name: "updatePm",
	filename: "src/lib/ops/api.ts"
}, (opts) => updatePm.__executeServer(opts));
var updatePm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(updatePm_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`select * from pm_jobs where id = ${data.id}`;
	if (!cur[0]) throw new Error("PM not found");
	const c = cur[0];
	const status = data.status ?? c.status;
	const done = data.done === void 0 ? data.status === void 0 ? c.done : CLOSED_PM.has(status) : data.done;
	await sql`
      update pm_jobs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === void 0 ? c.equipment : data.equipment},
        style = ${data.style === void 0 ? c.style : data.style},
        projected = ${data.projected === void 0 ? c.projected : data.projected},
        parts_status = ${data.partsStatus === void 0 ? c.parts_status : data.partsStatus},
        status = ${status},
        technician = ${data.technician === void 0 ? c.technician : data.technician},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        wo = ${data.wo === void 0 ? c.wo : data.wo},
        work_done = ${data.workDone === void 0 ? c.work_done : data.workDone},
        completed_at = ${data.completedAt === void 0 ? c.completed_at : data.completedAt},
        done = ${done},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.status, status),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("technician", c.technician, data.technician === void 0 ? c.technician : data.technician),
		changed("equipment", c.equipment, data.equipment === void 0 ? c.equipment : data.equipment)
	]);
	if (extra) await logActivity(sql, context.userId, "pm", data.id, "updated", extra);
	return mapPm((await sql`select * from pm_jobs where id = ${data.id}`)[0], todayChicago());
});
var createPm_createServerFn_handler = createServerRpc({
	id: "56e061229f5d68c835c12340d4d78410c3592f0cc65d60e8b992d2ee67e6bed5",
	name: "createPm",
	filename: "src/lib/ops/api.ts"
}, (opts) => createPm.__executeServer(opts));
var createPm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createPm_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const rows = await sql`
      insert into pm_jobs (customer, equipment, style, received, status)
      values (${data.customer}, ${data.equipment ?? null}, ${data.style ?? "12 month PM"}, ${todayChicago()}, ${"Pending Scheduling"})
      returning id`;
	await logActivity(sql, context.userId, "pm", rows[0].id, "opened", data.customer);
	return mapPm((await sql`select * from pm_jobs where id = ${rows[0].id}`)[0], todayChicago());
});
var listModules_createServerFn_handler = createServerRpc({
	id: "8dea21981ac1b7bcdcc5dba0c9279774b461bd56790f061f6b87e9fe846b8a1f",
	name: "listModules",
	filename: "src/lib/ops/api.ts"
}, (opts) => listModules.__executeServer(opts));
var listModules = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listModules_createServerFn_handler, async () => {
	return (await (await ready())`select * from modules order by module_id`).map(mapModule);
});
var updateModule_createServerFn_handler = createServerRpc({
	id: "a78a25b878a8eeb0571581d491679ee6d326c39db15f3f0853db09968b6e53d2",
	name: "updateModule",
	filename: "src/lib/ops/api.ts"
}, (opts) => updateModule.__executeServer(opts));
var updateModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(updateModule_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`select * from modules where id = ${data.id}`;
	if (!cur[0]) throw new Error("Module not found");
	const c = cur[0];
	await sql`
      update modules set
        status = ${data.status ?? c.status},
        wo = ${data.wo === void 0 ? c.wo : data.wo},
        location = ${data.location === void 0 ? c.location : data.location},
        date_in = ${data.dateIn === void 0 ? c.date_in : data.dateIn},
        date_ready = ${data.dateReady === void 0 ? c.date_ready : data.dateReady},
        technician = ${data.technician === void 0 ? c.technician : data.technician},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        platform = ${data.platform === void 0 ? c.platform : data.platform},
        module_type = ${data.moduleType === void 0 ? c.module_type : data.moduleType},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.status, data.status ?? c.status),
		changed("technician", c.technician, data.technician === void 0 ? c.technician : data.technician),
		changed("location", c.location, data.location === void 0 ? c.location : data.location)
	]);
	if (extra) await logActivity(sql, context.userId, "module", data.id, "updated", extra);
	return mapModule((await sql`select * from modules where id = ${data.id}`)[0]);
});
var createModule_createServerFn_handler = createServerRpc({
	id: "8a73f2c9525ecba2938f9d480d18743e0dd450638e5c52e2aef7b2e574bfafed",
	name: "createModule",
	filename: "src/lib/ops/api.ts"
}, (opts) => createModule.__executeServer(opts));
var createModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createModule_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const rows = await sql`
      insert into modules (module_id, platform, module_type, status, location)
      values (${data.moduleId}, ${data.platform ?? "Cameo"}, ${data.moduleType ?? "Brew Module"}, ${"Not Started"}, ${"SHELF"})
      returning *`;
	await logActivity(sql, context.userId, "module", rows[0].id, "opened", data.moduleId);
	return mapModule(rows[0]);
});
var listDeals_createServerFn_handler = createServerRpc({
	id: "c8fc4fe3d98eafc8771376a0d2ebec3bda02ebe075aeae0672deab4f6afdc960",
	name: "listDeals",
	filename: "src/lib/ops/api.ts"
}, (opts) => listDeals.__executeServer(opts));
var listDeals = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listDeals_createServerFn_handler, async () => {
	const sql = await ready();
	const marks = await loadAccountMarks(sql);
	return (await sql`select * from deals where archived = false order by id`).map((r) => mapDeal(r, marks));
});
var updateDeal_createServerFn_handler = createServerRpc({
	id: "5d3ec062dccd2364f8eadd0069f1e26d01565b58d8975d81fd41d7eb9fb5942a",
	name: "updateDeal",
	filename: "src/lib/ops/api.ts"
}, (opts) => updateDeal.__executeServer(opts));
var updateDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(updateDeal_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`select * from deals where id = ${data.id}`;
	if (!cur[0]) throw new Error("Deal not found");
	const c = cur[0];
	const producer = data.producer === void 0 ? c.producer : canonicalRepName(data.producer);
	const completion = data.completion === void 0 ? c.completion : data.completion;
	await sql`
      update deals set
        customer = ${data.customer ?? c.customer},
        producer = ${producer},
        account_type = ${data.accountType === void 0 ? c.account_type : data.accountType},
        equipment = ${data.equipment === void 0 ? c.equipment : data.equipment},
        amount = ${data.amount === void 0 ? c.amount : data.amount},
        good_to_order = ${data.goodToOrder === void 0 ? c.good_to_order : data.goodToOrder},
        ordered = ${data.ordered === void 0 ? c.ordered : data.ordered},
        eta = ${data.eta === void 0 ? c.eta : data.eta},
        terms = ${data.terms === void 0 ? c.terms : data.terms},
        invoice = ${data.invoice === void 0 ? c.invoice : data.invoice},
        completion = ${completion},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        updated_at = now()
      where id = ${data.id}`;
	if (completion === "complete") await maybeHandoffInstall(sql, data.id);
	const extra = summarize([
		changed("status", c.completion, completion),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("producer", c.producer, producer),
		changed("equipment", c.equipment, data.equipment === void 0 ? c.equipment : data.equipment)
	]);
	if (extra) await logActivity(sql, context.userId, "deal", data.id, "updated", extra);
	const customerName = String(data.customer ?? c.customer);
	if (data.aviKatz !== void 0 || data.producer !== void 0) await upsertAccountMarks(sql, customerName, {
		aviKatz: data.aviKatz,
		accountRep: data.producer === void 0 ? void 0 : producer
	});
	const marks = await loadAccountMarks(sql);
	return mapDeal((await sql`select * from deals where id = ${data.id}`)[0], marks);
});
var createDeal_createServerFn_handler = createServerRpc({
	id: "39bf7186ae5c8496b5fd07dadc19af7625bf4a0d78ac5dc625fb334957dd2da2",
	name: "createDeal",
	filename: "src/lib/ops/api.ts"
}, (opts) => createDeal.__executeServer(opts));
var createDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createDeal_createServerFn_handler, async ({ data, context }) => {
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
var archiveDeal_createServerFn_handler = createServerRpc({
	id: "e62d56561a7cdcb00f526b0789df917594449c611f745739262dca774fcffed5",
	name: "archiveDeal",
	filename: "src/lib/ops/api.ts"
}, (opts) => archiveDeal.__executeServer(opts));
var archiveDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(archiveDeal_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`
      select id, customer from deals where id = ${data.id} and archived = false`;
	if (!cur[0]) throw new Error("Deal not found");
	await sql`update deals set archived = true, updated_at = now() where id = ${data.id}`;
	await logActivity(sql, context.userId, "deal", data.id, "removed", cur[0].customer);
	return { ok: true };
});
function uniquePendingHandoffs(deals) {
	const pending = deals.filter((d) => d.completion === "complete" && !d.handedOff);
	const byCustomer = /* @__PURE__ */ new Map();
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
async function maybeHandoffInstall(sql, dealId) {
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
var listInstalls_createServerFn_handler = createServerRpc({
	id: "e864dd8c9b80dad5f2c776a83f842418fb498cb3e65c666915bc181d9ae09617",
	name: "listInstalls",
	filename: "src/lib/ops/api.ts"
}, (opts) => listInstalls.__executeServer(opts));
var listInstalls = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listInstalls_createServerFn_handler, async () => {
	const sql = await ready();
	const today = todayChicago();
	const week = weekBounds(today);
	const catalog = await loadEquipCatalog(sql);
	const marks = await loadAccountMarks(sql);
	return applyMarks((await sql`select * from installs where archived = false order by id`).map((r) => mapInstall(r, today, week, catalog)), marks);
});
var updateInstall_createServerFn_handler = createServerRpc({
	id: "39b0743581a7bf62de46488cabcf15c68c717461b0afaefa731f4fdda4a5b323",
	name: "updateInstall",
	filename: "src/lib/ops/api.ts"
}, (opts) => updateInstall.__executeServer(opts));
var updateInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(updateInstall_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`select * from installs where id = ${data.id}`;
	if (!cur[0]) throw new Error("Install not found");
	const c = cur[0];
	const equipStatus = data.equipStatus === void 0 ? c.equip_status : data.equipStatus;
	const complete = data.complete === void 0 ? data.equipStatus === void 0 ? c.complete : equipStatus === "Installed" : data.complete;
	const catalog = await loadEquipCatalog(sql);
	const machinesJson = data.machines === void 0 ? c.machines : data.machines == null ? null : (() => {
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
        equipment = ${data.equipment === void 0 ? c.equipment : data.equipment},
        equip_status = ${equipStatus},
        install_date = ${data.installDate === void 0 ? c.install_date : data.installDate},
        technician = ${data.technician === void 0 ? c.technician : data.technician},
        wo = ${data.wo === void 0 ? c.wo : data.wo},
        reqs_ready = ${data.reqsReady === void 0 ? c.reqs_ready : data.reqsReady},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        work_done = ${data.workDone === void 0 ? c.work_done : data.workDone},
        completed_at = ${data.completedAt === void 0 ? c.completed_at : data.completedAt},
        account_rep = ${data.accountRep === void 0 ? c.account_rep : canonicalRepName(data.accountRep) ?? (data.accountRep || null)},
        payment_status = ${data.paymentStatus === void 0 ? c.payment_status : data.paymentStatus},
        serial = ${data.serial === void 0 ? c.serial : data.serial},
        power_voltage = ${data.powerVoltage === void 0 ? c.power_voltage : data.powerVoltage},
        machines = ${machinesJson},
        complete = ${complete},
        duplicate_of = ${data.duplicateOf === void 0 ? c.duplicate_of : data.duplicateOf},
        updated_at = now()
      where id = ${data.id}`;
	const extra = summarize([
		changed("status", c.equip_status, equipStatus),
		changed("customer", c.customer, data.customer ?? c.customer),
		changed("technician", c.technician, data.technician === void 0 ? c.technician : data.technician),
		changed("equipment", c.equipment, data.equipment === void 0 ? c.equipment : data.equipment),
		changed("account rep", c.account_rep, data.accountRep === void 0 ? c.account_rep : data.accountRep),
		data.duplicateOf === null && c.duplicate_of ? "cleared duplicate flag" : data.duplicateOf && data.duplicateOf !== c.duplicate_of ? `flagged duplicate of #${data.duplicateOf}` : null
	]);
	if (extra) await logActivity(sql, context.userId, "install", data.id, "updated", extra);
	const customerName = String(data.customer ?? c.customer);
	if (data.aviKatz !== void 0 || data.accountRep !== void 0) await upsertAccountMarks(sql, customerName, {
		aviKatz: data.aviKatz,
		accountRep: data.accountRep === void 0 ? void 0 : canonicalRepName(data.accountRep) ?? (data.accountRep || null)
	});
	const today = todayChicago();
	const week = weekBounds(today);
	const marks = await loadAccountMarks(sql);
	return applyMarks([mapInstall((await sql`select * from installs where id = ${data.id}`)[0], today, week, catalog)], marks)[0];
});
var createInstall_createServerFn_handler = createServerRpc({
	id: "f3d500b4701c16e140b486b0f00720767b652e6dd3e1353b7c2367dbcc44d86a",
	name: "createInstall",
	filename: "src/lib/ops/api.ts"
}, (opts) => createInstall.__executeServer(opts));
var createInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createInstall_createServerFn_handler, async ({ data, context }) => {
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
	return mapInstall(rows[0], todayChicago(), weekBounds(todayChicago()), catalog);
});
var archiveInstall_createServerFn_handler = createServerRpc({
	id: "385f3e726aaef9adefa16c47f3a60e82af199dfba07c3b4c42b00ed68805f8b3",
	name: "archiveInstall",
	filename: "src/lib/ops/api.ts"
}, (opts) => archiveInstall.__executeServer(opts));
var archiveInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(archiveInstall_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const cur = await sql`
      select id, customer from installs where id = ${data.id} and archived = false`;
	if (!cur[0]) throw new Error("Install not found");
	await sql`update installs set archived = true, updated_at = now() where id = ${data.id}`;
	await logActivity(sql, context.userId, "install", data.id, "removed", cur[0].customer);
	return { ok: true };
});
var listComments_createServerFn_handler = createServerRpc({
	id: "4635ba032aed43ecf7bcf6ce29de400b651517a7fee7111213c11ac3740d7c53",
	name: "listComments",
	filename: "src/lib/ops/api.ts"
}, (opts) => listComments.__executeServer(opts));
var listComments = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(listComments_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const rows = await sql`
      select * from comments
      where entity_type = ${data.entityType} and entity_id = ${data.entityId}
      order by created_at asc`;
	const ctx = await entityContext(sql, data.entityType, data.entityId);
	return rows.map((r) => mapComment(r, ctx));
});
var listActivity_createServerFn_handler = createServerRpc({
	id: "fba13400f8c6e321ea705395de93864c9cc6795aeb9df4a67cfe7be7204c7886",
	name: "listActivity",
	filename: "src/lib/ops/api.ts"
}, (opts) => listActivity.__executeServer(opts));
var listActivity = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(listActivity_createServerFn_handler, async ({ data }) => {
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
var addComment_createServerFn_handler = createServerRpc({
	id: "6f738980065bf83aabf85ff9c0bb4c1676ebab4840efd9eab8bac748961d6812",
	name: "addComment",
	filename: "src/lib/ops/api.ts"
}, (opts) => addComment.__executeServer(opts));
var addComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(addComment_createServerFn_handler, async ({ data, context }) => {
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
	} catch {}
	return mapComment((await sql`select * from comments where id = ${commentId}`)[0] ?? rows[0]);
});
var claimComment_createServerFn_handler = createServerRpc({
	id: "f818c883ef291f66d478761b3eb1ba6b94f06c954b7e2b79a760dee774ec3b53",
	name: "claimComment",
	filename: "src/lib/ops/api.ts"
}, (opts) => claimComment.__executeServer(opts));
var claimComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(claimComment_createServerFn_handler, async ({ data, context }) => {
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
var resolveComment_createServerFn_handler = createServerRpc({
	id: "bd649af093753888caad62829610101a98a97fcfd3ebda7f1134c10f6803a31f",
	name: "resolveComment",
	filename: "src/lib/ops/api.ts"
}, (opts) => resolveComment.__executeServer(opts));
var resolveComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(resolveComment_createServerFn_handler, async ({ data }) => {
	await (await ready())`update comments set resolved = ${data.resolved} where id = ${data.id}`;
	return { ok: true };
});
var getHandoff_createServerFn_handler = createServerRpc({
	id: "f4edefbbe0a28284e851744c3220811add825e959937d13bcb55136bdffafb5c",
	name: "getHandoff",
	filename: "src/lib/ops/api.ts"
}, (opts) => getHandoff.__executeServer(opts));
var getHandoff = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(getHandoff_createServerFn_handler, async () => {
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
	return {
		asks,
		recent,
		pendingHandoffs: uniquePendingHandoffs((await sql`select * from deals where archived = false`).map((r) => mapDeal(r)))
	};
});
var searchAll_createServerFn_handler = createServerRpc({
	id: "bc07a2afcfdda5f33354b75fd397103613496c0ae0a38a79614caec91ba569d1",
	name: "searchAll",
	filename: "src/lib/ops/api.ts"
}, (opts) => searchAll.__executeServer(opts));
var searchAll = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(searchAll_createServerFn_handler, async ({ data }) => {
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
		entityType: a.status === "deployed" || a.site === "field" ? "location" : "asset",
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
var handoffDeal_createServerFn_handler = createServerRpc({
	id: "66d5f7130499f8b38df7162a2bc0d7acafb0c172702bd2241f68b2c76bf81dd5",
	name: "handoffDeal",
	filename: "src/lib/ops/api.ts"
}, (opts) => handoffDeal.__executeServer(opts));
var handoffDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(handoffDeal_createServerFn_handler, async ({ data }) => {
	await maybeHandoffInstall(await ready(), data.dealId);
	return { ok: true };
});
async function nextLine(sql, site, pallet, level) {
	const taken = await sql`
    select line_no from assets
    where site = ${site} and pallet = ${pallet} and level = ${level}
      and status in ('ready', 'deployed') and line_no is not null`;
	const used = new Set(taken.map((t) => t.line_no));
	for (let n = 1; n <= 12; n++) if (!used.has(n)) return n;
	return null;
}
async function findOpenBarnSlot(sql, preferred) {
	const taken = await sql`
    select site, pallet, level, line_no from assets
    where status in ('ready', 'deployed')
      and pallet is not null and level is not null and line_no is not null`;
	const used = new Set(taken.map((t) => `${t.site}|${t.pallet}|${t.level}|${t.line_no}`));
	const firstLine = (site, pallet, level) => {
		for (let n = 1; n <= 12; n++) if (!used.has(`${site}|${pallet}|${level}|${n}`)) return n;
		return null;
	};
	const tries = [];
	const push = (site, pallet, level) => {
		if (site !== "barn-back" && site !== "barn-front") return;
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
var listAssets_createServerFn_handler = createServerRpc({
	id: "a76f381d2caeca51254a208b811ee3a7058d68c1c43e253969f96eca6ae00fb0",
	name: "listAssets",
	filename: "src/lib/ops/api.ts"
}, (opts) => listAssets.__executeServer(opts));
var listAssets = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listAssets_createServerFn_handler, async () => {
	return (await (await ready())`select * from assets order by id`).map(mapAsset);
});
var createAsset_createServerFn_handler = createServerRpc({
	id: "cea062fe70e665c1d6153b5ed394cf90f7ed3f3b8e5ba2a80f14ffc114231996",
	name: "createAsset",
	filename: "src/lib/ops/api.ts"
}, (opts) => createAsset.__executeServer(opts));
var createAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createAsset_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const kind = data.kind ?? "equip";
	const site = data.site;
	let pallet = data.pallet ?? null;
	let level = data.level ?? null;
	let line = null;
	const barn = isBarn(site);
	if (barn) {
		if (!pallet || !level) throw new Error("Pick a pallet and level");
		if (!palletsFor(site).includes(pallet)) throw new Error("That pallet is not on this rack");
		line = await nextLine(sql, site, pallet, level);
		if (line == null) throw new Error("That slot is full (12 lines)");
	}
	const status = barn ? "ready" : "deployed";
	return mapAsset((await sql`
      insert into assets (kind, model, serial, qty, customer_owned, site, pallet, level, line_no, purpose, status, notes)
      values (
        ${kind}, ${data.model}, ${data.serial || null}, ${data.qty ?? 1},
        ${data.customerOwned || null}, ${site}, ${pallet}, ${level}, ${line},
        ${data.purpose || null}, ${status}, ${data.notes || null}
      )
      returning *`)[0]);
});
var updateAsset_createServerFn_handler = createServerRpc({
	id: "2582de1bfe6e7c6be8f3d00276438723a358e32a85e78329b73b0d7d21e9d1d2",
	name: "updateAsset",
	filename: "src/lib/ops/api.ts"
}, (opts) => updateAsset.__executeServer(opts));
var updateAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(updateAsset_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const cur = await sql`select * from assets where id = ${data.id}`;
	if (!cur[0]) throw new Error("Asset not found");
	const c = cur[0];
	let pallet = data.pallet === void 0 ? c.pallet : data.pallet;
	let level = data.level === void 0 ? c.level : data.level;
	let line = c.line_no;
	const site = data.site === void 0 ? c.site : data.site;
	if (isBarn(site) && (pallet !== c.pallet || level !== c.level || site !== c.site) && pallet && level) {
		line = await nextLine(sql, site, pallet, level);
		if (line == null) throw new Error("That slot is full");
	}
	await sql`
      update assets set
        model = ${data.model ?? c.model},
        serial = ${data.serial === void 0 ? c.serial : data.serial},
        qty = ${data.qty === void 0 ? c.qty : data.qty},
        customer_owned = ${data.customerOwned === void 0 ? c.customer_owned : data.customerOwned},
        purpose = ${data.purpose === void 0 ? c.purpose : data.purpose},
        notes = ${data.notes === void 0 ? c.notes : data.notes},
        site = ${site},
        pallet = ${pallet},
        level = ${level},
        line_no = ${line},
        updated_at = now()
      where id = ${data.id}`;
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
var assignAssetToInstall_createServerFn_handler = createServerRpc({
	id: "526601698722a8a88c929ec2b2bd22f0d7d0eb21efd3f1ee9090ef220a7ef449",
	name: "assignAssetToInstall",
	filename: "src/lib/ops/api.ts"
}, (opts) => assignAssetToInstall.__executeServer(opts));
var assignAssetToInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(assignAssetToInstall_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
	if (asset.status === "sold") throw new Error("Already sold");
	const inst = (await sql`
      select id, customer from installs where id = ${data.installId}`)[0];
	if (!inst) throw new Error("Install not found");
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
var unassignAssetFromInstall_createServerFn_handler = createServerRpc({
	id: "f3719f92ebca0f7fba68c57e4e6f1cfb9114315855feb08a7202f3310b8897b8",
	name: "unassignAssetFromInstall",
	filename: "src/lib/ops/api.ts"
}, (opts) => unassignAssetFromInstall.__executeServer(opts));
var unassignAssetFromInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(unassignAssetFromInstall_createServerFn_handler, async ({ data, context }) => {
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
var assignAssetToService_createServerFn_handler = createServerRpc({
	id: "0f1616336d82cdb378bdbca41e5fcf8cd1928d9b9bea529fac33b217f9d4777b",
	name: "assignAssetToService",
	filename: "src/lib/ops/api.ts"
}, (opts) => assignAssetToService.__executeServer(opts));
var assignAssetToService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(assignAssetToService_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const customer = data.customer.trim();
	if (!customer) throw new Error("Pick a customer");
	const asset = (await sql`select * from assets where id = ${data.assetId}`)[0];
	if (!asset) throw new Error("Asset not found");
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
var unassignAssetFromService_createServerFn_handler = createServerRpc({
	id: "3d6bd5686c9e2c59523c130a203368a03778b0e5137ce97d8af4fe9986cf09c9",
	name: "unassignAssetFromService",
	filename: "src/lib/ops/api.ts"
}, (opts) => unassignAssetFromService.__executeServer(opts));
var unassignAssetFromService = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(unassignAssetFromService_createServerFn_handler, async ({ data, context }) => {
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
var returnAssetToWarehouse_createServerFn_handler = createServerRpc({
	id: "8b50c2d8a8f85716a978d9f8629d110029ab352f813c0d0b69c28e2a1151b0f3",
	name: "returnAssetToWarehouse",
	filename: "src/lib/ops/api.ts"
}, (opts) => returnAssetToWarehouse.__executeServer(opts));
var returnAssetToWarehouse = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(returnAssetToWarehouse_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	if (!(await sql`select * from assets where id = ${data.id}`)[0]) throw new Error("Asset not found");
	if (!palletsFor(data.site).includes(data.pallet)) throw new Error("Pallet not on that rack");
	const line = await nextLine(sql, data.site, data.pallet, data.level);
	if (line == null) throw new Error("That slot is full");
	await sql`
      update assets set
        status = 'ready',
        site = ${data.site},
        pallet = ${data.pallet},
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
	return mapAsset((await sql`select * from assets where id = ${data.id}`)[0]);
});
var markAssetSold_createServerFn_handler = createServerRpc({
	id: "96afcaa3f0fed3b3115ee12547f530fd6e737399bfaeee48b5989e79d4732a7f",
	name: "markAssetSold",
	filename: "src/lib/ops/api.ts"
}, (opts) => markAssetSold.__executeServer(opts));
var markAssetSold = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(markAssetSold_createServerFn_handler, async ({ data, context }) => {
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
var listRecipes_createServerFn_handler = createServerRpc({
	id: "1200b5be72004e85f0bfcee1ed7fc4b89f856bb6c2e04dedd35aa46ed4833b05",
	name: "listRecipes",
	filename: "src/lib/ops/api.ts"
}, (opts) => listRecipes.__executeServer(opts));
var listRecipes = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listRecipes_createServerFn_handler, async () => {
	return (await (await ready())`
      select * from recipes
      order by (customer is null) desc, customer, equipment_model`).map(mapRecipe);
});
var listCustomers_createServerFn_handler = createServerRpc({
	id: "06fd80b5feb6d5cb8bbb9344a113508ac20a8fed29dbd5fc5c5cdab3f4ce7890",
	name: "listCustomers",
	filename: "src/lib/ops/api.ts"
}, (opts) => listCustomers.__executeServer(opts));
var listCustomers = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listCustomers_createServerFn_handler, async () => {
	return (await (await ready())`
      select name as customer from directory_customers
      where archived = false and coalesce(name, '') <> ''
      order by lower(name)`).map((r) => r.customer);
});
var listCustomerRecords_createServerFn_handler = createServerRpc({
	id: "76d7b51b3118ce3c755ac90dd0aa6c2d698a01daf5246936cb2098cdebafa7f2",
	name: "listCustomerRecords",
	filename: "src/lib/ops/api.ts"
}, (opts) => listCustomerRecords.__executeServer(opts));
var listCustomerRecords = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listCustomerRecords_createServerFn_handler, async () => {
	const sql = await ready();
	const { ensureAccountMarks } = await import("./reps-B2EuoM-m.mjs").then((n) => n.s).then((n) => n.s);
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
var getCustomerHistory_createServerFn_handler = createServerRpc({
	id: "be65e2e7f569d7642b6ee04880eb13cfb0d2dd5bb1a1d5bc7aa804dee30b2280",
	name: "getCustomerHistory",
	filename: "src/lib/ops/api.ts"
}, (opts) => getCustomerHistory.__executeServer(opts));
var getCustomerHistory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(getCustomerHistory_createServerFn_handler, async ({ data }) => {
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
		installs: applyMarks(installs.map((r) => mapInstall(r, today, week, catalog)), marks),
		deals: deals.map((r) => mapDeal(r, marks)),
		recipes: recipes.map(mapRecipe)
	};
});
function directoryTable(kind) {
	if (kind === "customer") return "directory_customers";
	if (kind === "equipment") return "directory_equipment";
	throw new Error("Unknown directory");
}
var listDirectory_createServerFn_handler = createServerRpc({
	id: "0163adac47649a0570c9a81c5541f36005e39618df4a4497c23d2dc78ffaa868",
	name: "listDirectory",
	filename: "src/lib/ops/api.ts"
}, (opts) => listDirectory.__executeServer(opts));
var listDirectory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(listDirectory_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const table = directoryTable(data.kind);
	return await sql.query(`select id, name from ${table} where archived = false order by lower(name)`);
});
var updateCustomerAccount_createServerFn_handler = createServerRpc({
	id: "8a09d9d7b24a86f0c775dbbaf1147644bdfffcbc6057d140eb48ee8ba6dc8a35",
	name: "updateCustomerAccount",
	filename: "src/lib/ops/api.ts"
}, (opts) => updateCustomerAccount.__executeServer(opts));
var updateCustomerAccount = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(updateCustomerAccount_createServerFn_handler, async ({ data }) => {
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
		accountRep: marks.rep.get(dir[0].name.trim().toLowerCase()) ?? null
	};
});
var addDirectoryEntry_createServerFn_handler = createServerRpc({
	id: "f92a32e6bcb066079e1169e5037175021271e828adda251fc4bd6c7eceab34f8",
	name: "addDirectoryEntry",
	filename: "src/lib/ops/api.ts"
}, (opts) => addDirectoryEntry.__executeServer(opts));
var addDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(addDirectoryEntry_createServerFn_handler, async ({ data }) => {
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
var archiveDirectoryEntry_createServerFn_handler = createServerRpc({
	id: "bbf684dab4be294977c8a135852746b46c064b5fe849356229cfe61bb158aad2",
	name: "archiveDirectoryEntry",
	filename: "src/lib/ops/api.ts"
}, (opts) => archiveDirectoryEntry.__executeServer(opts));
var archiveDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(archiveDirectoryEntry_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	if (data.kind === "customer") await requireAdmin(sql, context.userId, "Only an admin can add or remove customers.");
	const table = directoryTable(data.kind);
	await sql.query(`update ${table} set archived = true, updated_at = now() where id = $1`, [data.id]);
	return { ok: true };
});
var renameCustomer_createServerFn_handler = createServerRpc({
	id: "eeedbe6b03930fae6ba3c3db70a2afb562a9769026dd2db72fcf16a5dcbf9dac",
	name: "renameCustomer",
	filename: "src/lib/ops/api.ts"
}, (opts) => renameCustomer.__executeServer(opts));
var renameCustomer = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(renameCustomer_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireAdmin(sql, context.userId, "Only an admin can rename or merge customers.");
	return renameOrMergeCustomer(sql, data.id, data.name);
});
var renameEquipment_createServerFn_handler = createServerRpc({
	id: "3a3478acf53044fe7eab5aad067abd8b33c0b8558aad929a0d2b4ee08b583d71",
	name: "renameEquipment",
	filename: "src/lib/ops/api.ts"
}, (opts) => renameEquipment.__executeServer(opts));
var renameEquipment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(renameEquipment_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	return renameOrMergeEquipment(sql, data.id, data.name);
});
async function findRecipeDup(sql, model, customer, exceptId) {
	const hit = (customer ? await sql`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and lower(customer) = ${customer.toLowerCase()}` : await sql`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and customer is null`)[0];
	if (hit && hit.id !== exceptId) return hit;
	return null;
}
var upsertRecipe_createServerFn_handler = createServerRpc({
	id: "918e6d7f4bace1f6c78033b9037d1c6c24ab3094b0be582a97b47c01d0246dc3",
	name: "upsertRecipe",
	filename: "src/lib/ops/api.ts"
}, (opts) => upsertRecipe.__executeServer(opts));
var upsertRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(upsertRecipe_createServerFn_handler, async ({ data }) => {
	const sql = await ready();
	const model = data.equipmentModel.trim();
	if (!model) throw new Error("Pick an equipment model");
	const customer = data.customer?.trim() || null;
	const isTemplate = !customer;
	let installId = data.installId ?? null;
	if (customer && installId == null) {
		const ins = await sql`
        select id from installs where lower(customer) = ${customer.toLowerCase()} limit 2`;
		if (ins.length === 1) installId = ins[0].id;
	}
	if (await findRecipeDup(sql, model, customer, data.id)) throw new Error(customer ? `A recipe for ${model} already exists on ${customer}` : "A house recipe for that model already exists — open it from the list");
	if (data.id) {
		await sql`
        update recipes set
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
        equipment_model, customer, install_id, copied_from, is_template,
        coffee_1, coffee_2, coffee_3,
        powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
        tea_1, tea_2, milk, notes
      ) values (
        ${model}, ${customer}, ${installId}, ${data.copiedFrom ?? null}, ${isTemplate},
        ${data.coffee1 ?? null}, ${data.coffee2 ?? null}, ${data.coffee3 ?? null},
        ${data.powder1 ?? null}, ${data.powder2 ?? null}, ${data.powder3 ?? null},
        ${data.americano1 ?? null}, ${data.americano2 ?? null}, ${data.americano3 ?? null},
        ${data.tea1 ?? null}, ${data.tea2 ?? null},
        ${data.milk ?? null}, ${data.notes ?? null}
      )
      returning *`)[0]);
});
var copyRecipe_createServerFn_handler = createServerRpc({
	id: "af2770ffc7230f6441c2c90211140e8767fbb7f8fbe129f5b054493e873c7436",
	name: "copyRecipe",
	filename: "src/lib/ops/api.ts"
}, (opts) => copyRecipe.__executeServer(opts));
var copyRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(copyRecipe_createServerFn_handler, async ({ data }) => {
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
//#endregion
export { addComment_createServerFn_handler, addDirectoryEntry_createServerFn_handler, archiveDeal_createServerFn_handler, archiveDirectoryEntry_createServerFn_handler, archiveInstall_createServerFn_handler, assignAssetToInstall_createServerFn_handler, assignAssetToService_createServerFn_handler, claimComment_createServerFn_handler, copyRecipe_createServerFn_handler, createAsset_createServerFn_handler, createDeal_createServerFn_handler, createInstall_createServerFn_handler, createJob_createServerFn_handler, createModule_createServerFn_handler, createPm_createServerFn_handler, getCustomerHistory_createServerFn_handler, getDashboard_createServerFn_handler, getHandoff_createServerFn_handler, getJob_createServerFn_handler, handoffDeal_createServerFn_handler, listActivity_createServerFn_handler, listAssets_createServerFn_handler, listComments_createServerFn_handler, listCustomerRecords_createServerFn_handler, listCustomers_createServerFn_handler, listDeals_createServerFn_handler, listDirectory_createServerFn_handler, listInstalls_createServerFn_handler, listJobs_createServerFn_handler, listModules_createServerFn_handler, listPms_createServerFn_handler, listRecipes_createServerFn_handler, markAssetSold_createServerFn_handler, mergeServiceTickets_createServerFn_handler, renameCustomer_createServerFn_handler, renameEquipment_createServerFn_handler, resolveComment_createServerFn_handler, returnAssetToWarehouse_createServerFn_handler, searchAll_createServerFn_handler, unassignAssetFromInstall_createServerFn_handler, unassignAssetFromService_createServerFn_handler, updateAsset_createServerFn_handler, updateCustomerAccount_createServerFn_handler, updateDeal_createServerFn_handler, updateInstall_createServerFn_handler, updateJob_createServerFn_handler, updateModule_createServerFn_handler, updatePm_createServerFn_handler, upsertRecipe_createServerFn_handler };
