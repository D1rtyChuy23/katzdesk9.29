import { r as __exportAll } from "../_runtime.mjs";
import { hn as object, mn as number, un as boolean, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as createServerFn } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { r as getSql } from "./db.mjs";
import { a as deskMiddleware } from "./access.mjs";
import { n as serialKey } from "./serial-pull.mjs";
import { i as loadTechs } from "./roster.mjs";
import { a as loadAccountMarks, r as isAviKatz, t as accountRepFor } from "./reps.mjs";
//#region src/lib/ops/ticket-status.ts
/** Terminal service / TLC statuses. */
var CLOSED_CALL = /* @__PURE__ */ new Set([
	"Completed",
	"Cancelled",
	"Phone Resolved"
]);
/** Terminal PM statuses. */
var CLOSED_PM = /* @__PURE__ */ new Set(["Completed", "Cancelled"]);
function isClosedCall(row) {
	return !!row.done || CLOSED_CALL.has(row.status ?? "");
}
function isOpenCall(row) {
	return !isClosedCall(row);
}
function isClosedPm(row) {
	return !!row.done || CLOSED_PM.has(row.status ?? "");
}
function isOpenPm(row) {
	return !isClosedPm(row);
}
//#endregion
//#region src/lib/ops/install-status.ts
/** Single source of truth for prep vs installed. */
function isInstalled(row) {
	return !!row.complete || row.equipStatus === "Installed";
}
function isOpenInstall(row) {
	return !isInstalled(row);
}
function installedPatch(row, today) {
	return {
		equipStatus: "Installed",
		complete: true,
		completedAt: today,
		installDate: row?.installDate || today
	};
}
//#endregion
//#region src/lib/ops/iso.ts
/** YYYY-MM-DD from a date-like value. Empty string when missing or unparseable. */
function isoDay(v) {
	if (v == null || v === "") return "";
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	const s = String(v).trim();
	const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
	if (m) return m[1];
	const t = Date.parse(s);
	if (Number.isFinite(t)) return new Date(t).toISOString().slice(0, 10);
	return "";
}
function isoDayOrNull(v) {
	return isoDay(v) || null;
}
function diffDays(fromIso, toIso) {
	const a = Date.parse(`${fromIso}T00:00:00Z`);
	const b = Date.parse(`${toIso}T00:00:00Z`);
	return Math.round((b - a) / 864e5);
}
//#endregion
//#region src/lib/ops/clock.ts
function todayChicago() {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(/* @__PURE__ */ new Date());
}
function addDays(iso, days) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function weekBounds(today) {
	const [y, m, d] = today.split("-").map(Number);
	const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	const start = addDays(today, dow === 0 ? -6 : 1 - dow);
	const end = addDays(start, 6);
	const nextStart = addDays(start, 7);
	return {
		start,
		end,
		nextStart,
		nextEnd: addDays(nextStart, 6)
	};
}
function monthBounds(iso) {
	const [y, m] = iso.split("-").map(Number);
	const year = y || 1970;
	const month = m || 1;
	const start = `${year}-${String(month).padStart(2, "0")}-01`;
	const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return {
		start,
		end: `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
		year,
		month
	};
}
function addMonths(iso, delta) {
	const [y, m] = iso.split("-").map(Number);
	const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1 + delta, 1));
	return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function formatMonthLabel(iso) {
	const { year, month } = monthBounds(iso);
	return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC"
	});
}
function formatWeekLabel(start, end) {
	const a = /* @__PURE__ */ new Date(`${start}T00:00:00`);
	const b = /* @__PURE__ */ new Date(`${end}T00:00:00`);
	const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
	return `${fmt(a)} – ${fmt(b)}`;
}
var WEEKDAYS = [
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun"
];
function serviceFlag(input, today) {
	if (isClosedCall(input)) return null;
	if (input.scheduled && input.scheduled < today) return {
		code: "past_due",
		label: "Past due — scheduled",
		level: "danger",
		rank: 10
	};
	if (input.received) {
		const days = diffDays(input.received, today);
		if (input.kind === "tlc") {
			if (days >= 14) return {
				code: "open_2w",
				label: "Open past 2 weeks",
				level: "danger",
				rank: 20
			};
			if (days >= 10) return {
				code: "open_10d",
				label: "Open 10–14 days",
				level: "warn",
				rank: 30
			};
		} else {
			if (days >= 2) return {
				code: "open_48",
				label: "Open past 48 hrs",
				level: "danger",
				rank: 20
			};
			if (days >= 1) return {
				code: "open_24",
				label: "Open 24–48 hrs",
				level: "warn",
				rank: 30
			};
		}
	}
	return null;
}
function pmFlag(input, today) {
	if (isClosedPm(input)) return null;
	if (!input.projected) return {
		code: "needs_date",
		label: "Needs PM date",
		level: "warn",
		rank: 15
	};
	const days = diffDays(today, input.projected);
	if (days < 0) {
		if (-days >= 14) return {
			code: "pm_late_2w",
			label: "2+ weeks past projected",
			level: "danger",
			rank: 5
		};
		return {
			code: "pm_overdue",
			label: "PM overdue",
			level: "danger",
			rank: 10
		};
	}
	if (days <= 14) return {
		code: "pm_due",
		label: "PM due within 14 days",
		level: "warn",
		rank: 25
	};
	return null;
}
function installFlag(input, today, week) {
	if (isInstalled(input)) return null;
	const date = input.installDate;
	const inWindow = !!date && date >= week.start && date <= week.nextEnd;
	const past = !!date && date < today;
	if (input.equipStatus === "Not Ready" && past) return {
		code: "past_not_ready",
		label: "Past due — not ready",
		level: "danger",
		rank: 8
	};
	if (input.equipStatus === "Not Ready" && inWindow) return {
		code: "equip_not_ready",
		label: "Equipment not ready",
		level: "danger",
		rank: 12
	};
	if (input.reqsReady === "Not Ready" && inWindow && input.equipStatus !== "Not Ready") return {
		code: "cust_not_ready",
		label: "Customer not ready",
		level: "warn",
		rank: 18
	};
	return null;
}
function formatPingTime(iso) {
	if (!iso) return "";
	const dt = new Date(iso);
	if (!Number.isFinite(dt.getTime())) return "";
	return dt.toLocaleString("en-US", {
		timeZone: "America/Chicago",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
}
function formatShortDate(iso) {
	if (!iso) return "—";
	const [y, m, d] = iso.split("-").map(Number);
	if (!y || !m || !d) return iso;
	return `${m}/${d}`;
}
function formatLongDate(iso) {
	if (!iso) return "—";
	return (/* @__PURE__ */ new Date(`${iso}T12:00:00`)).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric"
	});
}
function formatNowChicago() {
	const date = todayChicago();
	const time = new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Chicago",
		hour: "numeric",
		minute: "2-digit"
	}).format(/* @__PURE__ */ new Date());
	return {
		date,
		time,
		stamp: `${date} ${time} CT`
	};
}
function money(n) {
	if (n === null || n === void 0 || n === "") return "—";
	const v = typeof n === "number" ? n : Number(n);
	if (!Number.isFinite(v)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(v);
}
function moneyExact(n) {
	if (n === null || n === void 0 || n === "") return "—";
	const v = typeof n === "number" ? n : Number(n);
	if (!Number.isFinite(v)) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD"
	}).format(v);
}
//#endregion
//#region src/lib/ops/rebuild-model.ts
/** Pure rebuild project rules — no server imports. */
var REBUILD_STATUSES = [
	"Queued",
	"In progress",
	"Waiting",
	"Testing",
	"Ready",
	"Completed",
	"Cancelled"
];
var WAITING_REASONS = [
	"Parts on order",
	"Parts not available",
	"Waiting on decision",
	"Waiting on customer",
	"Tech / bench unavailable",
	"Scope changed",
	"Found additional failure",
	"Other"
];
var REBUILD_PRIORITIES = [
	"normal",
	"high",
	"committed-to-customer"
];
var SHOP_ACCOUNT = "Katz shop / stock";
var HEALTH_RANK = {
	overdue: 0,
	"at-risk": 1,
	"no-date": 2,
	"on-track": 3,
	done: 4
};
var HEALTH_LABEL = {
	overdue: "Overdue",
	"at-risk": "At risk",
	"no-date": "No date",
	"on-track": "On track",
	done: "Done"
};
var CLOSED_REBUILD = /* @__PURE__ */ new Set(["Completed", "Cancelled"]);
var NEEDS_TARGET = /* @__PURE__ */ new Set([
	"In progress",
	"Waiting",
	"Testing"
]);
function isRebuildStatus(v) {
	return !!v && REBUILD_STATUSES.includes(v);
}
function isWaitingReason(v) {
	return !!v && WAITING_REASONS.includes(v);
}
function isRebuildPriority(v) {
	return !!v && REBUILD_PRIORITIES.includes(v);
}
function computeRebuildMetrics(row, today) {
	const status = isRebuildStatus(row.status) ? row.status : "Queued";
	const created = isoDay(row.createdAt) || today;
	const started = isoDay(row.actualStart) || created;
	const target = isoDay(row.targetComplete);
	const doneOn = isoDay(row.actualComplete);
	const changed = isoDay(row.statusChangedAt) || created;
	const daysOpen = diffDays(started, today);
	const daysToTarget = target ? diffDays(today, target) : null;
	const daysInStatus = diffDays(changed, today);
	const daysLateEarly = doneOn && target ? diffDays(target, doneOn) : null;
	let health = "on-track";
	if (CLOSED_REBUILD.has(status)) health = "done";
	else if (NEEDS_TARGET.has(status) && !target) health = "no-date";
	else if (target && target < today) health = "overdue";
	else if (status === "Waiting") health = "at-risk";
	else if (target && daysToTarget != null && daysToTarget <= 3) health = "at-risk";
	else if (target) health = "on-track";
	else health = "on-track";
	let clockFlag = null;
	if (!CLOSED_REBUILD.has(status)) {
		if (health === "overdue") clockFlag = "overdue";
		else if (status === "Waiting" && daysInStatus > 5) clockFlag = "waiting-long";
	}
	return {
		health,
		daysOpen,
		daysToTarget,
		daysInStatus,
		daysLateEarly,
		clockFlag
	};
}
function validateRebuild(draft) {
	if (!draft.title.trim()) return "Give the rebuild a project name.";
	if (!draft.account.trim()) return "Pick an account, or Katz shop / stock.";
	if (!isRebuildStatus(draft.status)) return "Pick a status.";
	const status = draft.status;
	if (status === "Waiting") {
		if (!isWaitingReason(draft.reasonCode)) return "Waiting needs a reason delayed before save.";
		if (draft.reasonCode === "Other" && !draft.reasonDetail?.trim()) return "Spell out the other reason.";
	}
	if ((draft.prevStatus ?? "Queued") === "Queued" && status !== "Queued") {
		if (!draft.owner?.trim()) return "Assign an owner before leaving Queued.";
		if (!isoDay(draft.targetComplete)) return "Set a target complete date before leaving Queued.";
	}
	if (NEEDS_TARGET.has(status) && !isoDay(draft.targetComplete)) return "In progress, Waiting, and Testing need a target complete date.";
	if (NEEDS_TARGET.has(status) && !draft.owner?.trim() && status === "In progress") return "In progress needs an owner and a target date.";
	return null;
}
function priorityLabel(p) {
	if (p === "high") return "High";
	if (p === "committed-to-customer") return "Committed to customer";
	return "Normal";
}
//#endregion
//#region src/lib/ops/rebuilds.ts
var rebuilds_exports = /* @__PURE__ */ __exportAll({
	SHOP_ACCOUNT: () => SHOP_ACCOUNT,
	archiveRebuild: () => archiveRebuild,
	createRebuild: () => createRebuild,
	ensureRebuilds: () => ensureRebuilds,
	listRebuildLinks: () => listRebuildLinks,
	listRebuildOwners: () => listRebuildOwners,
	listRebuilds: () => listRebuilds,
	loadRebuilds: () => loadRebuilds,
	mapRebuild: () => mapRebuild,
	pullRebuildSerial: () => pullRebuildSerial,
	seedRebuilds: () => seedRebuilds,
	sortRebuildsForExport: () => sortRebuildsForExport,
	updateRebuild: () => updateRebuild
});
async function readySql() {
	const { ensureSeeded } = await import("./seed.server.mjs");
	await ensureSeeded();
	return getSql();
}
function stamp(v) {
	if (v == null) return "";
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
	return String(v);
}
function num(v) {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}
async function ensureRebuilds(sql) {
	await sql.query(`
    create table if not exists rebuilds (
      id serial primary key,
      title text not null,
      account text not null,
      equipment text,
      serial text,
      asset_id int,
      owner text,
      status text not null default 'Queued',
      reason_code text,
      reason_detail text,
      planned_start date,
      target_complete date,
      actual_start date,
      actual_complete date,
      priority text not null default 'normal',
      notes text,
      install_id int,
      job_id int,
      serial_notice text,
      status_changed_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
	await sql.query("create index if not exists rebuilds_status_idx on rebuilds (status)");
	await sql.query("create index if not exists rebuilds_owner_idx on rebuilds (owner)");
	await sql.query("create index if not exists rebuilds_account_idx on rebuilds (lower(account))");
	await sql.query("alter table rebuilds add column if not exists archived boolean not null default false");
	await sql.query("create index if not exists rebuilds_archived_idx on rebuilds (archived)");
}
function mapRebuild(r, today, accountRep = null, aviKatz = false) {
	const status = isRebuildStatus(r.status) ? r.status : "Queued";
	const priority = isRebuildPriority(r.priority) ? r.priority : "normal";
	const metrics = computeRebuildMetrics({
		status,
		owner: r.owner,
		targetComplete: isoDayOrNull(r.target_complete),
		actualStart: isoDayOrNull(r.actual_start),
		actualComplete: isoDayOrNull(r.actual_complete),
		createdAt: stamp(r.created_at),
		statusChangedAt: stamp(r.status_changed_at),
		reasonCode: r.reason_code
	}, today);
	return {
		id: Number(r.id),
		title: r.title,
		account: r.account,
		equipment: r.equipment,
		serial: r.serial,
		assetId: num(r.asset_id),
		owner: r.owner,
		status,
		reasonCode: r.reason_code,
		reasonDetail: r.reason_detail,
		plannedStart: isoDayOrNull(r.planned_start),
		targetComplete: isoDayOrNull(r.target_complete),
		actualStart: isoDayOrNull(r.actual_start),
		actualComplete: isoDayOrNull(r.actual_complete),
		priority,
		notes: r.notes,
		installId: num(r.install_id),
		jobId: num(r.job_id),
		serialNotice: r.serial_notice,
		statusChangedAt: stamp(r.status_changed_at),
		createdAt: stamp(r.created_at),
		updatedAt: stamp(r.updated_at),
		accountRep,
		aviKatz,
		...metrics
	};
}
async function loadRebuilds(sql, today = todayChicago()) {
	await ensureRebuilds(sql);
	await seedRebuilds(sql);
	const rows = await sql.query("select * from rebuilds where coalesce(archived, false) = false order by id desc");
	const marks = await loadAccountMarks(sql).catch(() => ({
		rep: /* @__PURE__ */ new Map(),
		repLoose: /* @__PURE__ */ new Map(),
		ak: /* @__PURE__ */ new Set()
	}));
	return rows.map((r) => mapRebuild(r, today, accountRepFor(marks, r.account), isAviKatz(marks, r.account)));
}
async function deskUsername(sql, userId) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}
async function logActivity(sql, userId, entityId, action, detail) {
	const actor = await deskUsername(sql, userId);
	await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ('rebuild', $1, $2, $3, $4)`, [
		entityId,
		actor,
		action,
		detail ?? null
	]);
}
async function loadAccessLite(sql, userId) {
	const r = (await sql.query("select desk_role, is_admin, username from desk_accounts where user_id = $1", [userId]))[0];
	return {
		role: r?.desk_role === "sales" || r?.desk_role === "service" ? r.desk_role : null,
		isAdmin: !!(r && (r.is_admin === true || String(r.is_admin) === "t" || String(r.is_admin) === "true")),
		username: r?.username || "Teammate"
	};
}
function canEditBench(access) {
	if (access.isAdmin) return true;
	return access.role !== "sales";
}
async function requireEditor(sql, userId) {
	const access = await loadAccessLite(sql, userId);
	if (!canEditBench(access)) throw new Error("Sales can view rebuilds on their accounts. Bench status is service-owned.");
	return access;
}
function emptyToNull(v) {
	return (v ?? "").trim() || null;
}
var patchSchema = object({
	id: number(),
	title: string().optional(),
	account: string().optional(),
	equipment: string().nullable().optional(),
	serial: string().nullable().optional(),
	owner: string().nullable().optional(),
	status: string().optional(),
	reasonCode: string().nullable().optional(),
	reasonDetail: string().nullable().optional(),
	plannedStart: string().nullable().optional(),
	targetComplete: string().nullable().optional(),
	actualStart: string().nullable().optional(),
	actualComplete: string().nullable().optional(),
	priority: string().optional(),
	notes: string().nullable().optional(),
	installId: number().nullable().optional(),
	jobId: number().nullable().optional()
});
var listRebuilds = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async ({ context }) => {
	const sql = await readySql();
	const access = await loadAccessLite(sql, context.userId);
	return {
		rows: await loadRebuilds(sql),
		canEdit: canEditBench(access)
	};
});
var listRebuildOwners = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async () => {
	const sql = await readySql();
	const techs = (await loadTechs(sql)).filter((t) => t.active);
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const t of techs) {
		const name = t.name.trim();
		const key = name.toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(name);
	}
	return out;
});
var listRebuildLinks = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ data }) => {
	const sql = await readySql();
	const account = (data.account ?? "").trim();
	const out = [];
	const inst = account ? await sql.query(`select id, customer, equipment, wo from installs
           where archived = false and complete = false
             and ($1 = '' or lower(customer) = lower($1))
           order by id desc limit 40`, [account]) : await sql.query(`select id, customer, equipment, wo from installs
           where archived = false and complete = false
           order by id desc limit 40`);
	for (const r of inst) out.push({
		kind: "install",
		id: Number(r.id),
		customer: r.customer,
		label: `Install · ${r.customer}${r.equipment ? " · " + r.equipment : ""}${r.wo ? " · " + r.wo : ""}`
	});
	const jobs = account ? await sql.query(`select id, kind, customer, call_id, wo from service_jobs
           where status not in ('Completed', 'Cancelled', 'Phone Resolved') and done = false
             and ($1 = '' or lower(coalesce(customer,'')) = lower($1))
           order by id desc limit 40`, [account]) : await sql.query(`select id, kind, customer, call_id, wo from service_jobs
           where status not in ('Completed', 'Cancelled', 'Phone Resolved') and done = false
           order by id desc limit 40`);
	for (const r of jobs) {
		const kind = r.kind === "tlc" ? "tlc" : "service";
		out.push({
			kind,
			id: Number(r.id),
			customer: r.customer ?? "",
			label: `${kind === "tlc" ? "TLC" : "Service"} · ${r.customer ?? "Untitled"}${r.wo ? " · " + r.wo : " · " + r.call_id}`
		});
	}
	return out;
});
var createSchema = object({
	title: string().min(1),
	account: string().min(1),
	equipment: string().nullable().optional(),
	serial: string().nullable().optional(),
	owner: string().nullable().optional(),
	status: string().optional(),
	reasonCode: string().nullable().optional(),
	reasonDetail: string().nullable().optional(),
	plannedStart: string().nullable().optional(),
	targetComplete: string().nullable().optional(),
	actualStart: string().nullable().optional(),
	priority: string().optional(),
	notes: string().nullable().optional(),
	installId: number().nullable().optional(),
	jobId: number().nullable().optional()
});
var createRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => createSchema.parse(d)).handler(async ({ data, context }) => {
	const sql = await readySql();
	await requireEditor(sql, context.userId);
	await ensureRebuilds(sql);
	const status = isRebuildStatus(data.status) ? data.status : "Queued";
	const err = validateRebuild({
		title: data.title,
		account: data.account,
		owner: emptyToNull(data.owner),
		status,
		reasonCode: emptyToNull(data.reasonCode),
		reasonDetail: emptyToNull(data.reasonDetail),
		targetComplete: emptyToNull(data.targetComplete),
		prevStatus: "Queued"
	});
	if (err) throw new Error(err);
	const waiting = status === "Waiting";
	const row = (await sql.query(`insert into rebuilds (
         title, account, equipment, serial, owner, status, reason_code, reason_detail,
         planned_start, target_complete, actual_start, priority, notes, install_id, job_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning *`, [
		data.title.trim(),
		data.account.trim() || "Katz shop / stock",
		emptyToNull(data.equipment),
		emptyToNull(data.serial),
		emptyToNull(data.owner),
		status,
		waiting ? emptyToNull(data.reasonCode) : null,
		waiting ? emptyToNull(data.reasonDetail) : null,
		isoDayOrNull(data.plannedStart),
		isoDayOrNull(data.targetComplete),
		isoDayOrNull(data.actualStart) || (status === "In progress" ? todayChicago() : null),
		isRebuildPriority(data.priority) ? data.priority : "normal",
		emptyToNull(data.notes),
		data.installId ?? null,
		data.jobId ?? null
	]))[0];
	await logActivity(sql, context.userId, Number(row.id), "opened", `${row.title} · ${row.account}`);
	return mapRebuild(row, todayChicago());
});
function changed(label, before, after) {
	const a = before == null || before === "" ? "" : String(before);
	const b = after == null || after === "" ? "" : String(after);
	if (a === b) return null;
	if (label === "status") return `${a || "—"} → ${b || "—"}`;
	if (label === "reason") return b ? `reason ${b}` : "cleared reason delayed";
	if (!b) return `cleared ${label}`;
	return `${label}: ${b.slice(0, 80)}`;
}
var updateRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => patchSchema.parse(d)).handler(async ({ data, context }) => {
	const sql = await readySql();
	await requireEditor(sql, context.userId);
	await ensureRebuilds(sql);
	const cur = (await sql.query("select * from rebuilds where id = $1", [data.id]))[0];
	if (!cur) throw new Error("Rebuild not found");
	const nextStatus = data.status != null ? data.status : cur.status;
	const nextOwner = data.owner !== void 0 ? emptyToNull(data.owner) : cur.owner;
	const nextTarget = data.targetComplete !== void 0 ? isoDayOrNull(data.targetComplete) : isoDayOrNull(cur.target_complete);
	const nextReason = data.reasonCode !== void 0 ? emptyToNull(data.reasonCode) : cur.reason_code;
	const nextDetail = data.reasonDetail !== void 0 ? emptyToNull(data.reasonDetail) : cur.reason_detail;
	const nextTitle = data.title != null ? data.title.trim() : cur.title;
	const nextAccount = data.account != null ? data.account.trim() : cur.account;
	const err = validateRebuild({
		title: nextTitle,
		account: nextAccount,
		owner: nextOwner,
		status: nextStatus,
		reasonCode: nextReason,
		reasonDetail: nextDetail,
		targetComplete: nextTarget,
		prevStatus: cur.status
	});
	if (err) throw new Error(err);
	const leavingWaiting = cur.status === "Waiting" && nextStatus !== "Waiting";
	const reasonCode = nextStatus === "Waiting" ? nextReason : leavingWaiting ? null : nextReason;
	const reasonDetail = nextStatus === "Waiting" ? nextDetail : leavingWaiting ? null : nextDetail;
	let actualStart = data.actualStart !== void 0 ? isoDayOrNull(data.actualStart) : isoDayOrNull(cur.actual_start);
	if (!actualStart && nextStatus === "In progress" && cur.status !== "In progress") actualStart = todayChicago();
	let actualComplete = data.actualComplete !== void 0 ? isoDayOrNull(data.actualComplete) : isoDayOrNull(cur.actual_complete);
	if (nextStatus === "Completed" && cur.status !== "Completed" && !actualComplete) actualComplete = todayChicago();
	if (CLOSED_REBUILD.has(nextStatus) === false && nextStatus !== "Completed") {
		if (data.actualComplete === null) actualComplete = null;
	}
	const statusChanged = nextStatus !== cur.status;
	const priority = data.priority != null && isRebuildPriority(data.priority) ? data.priority : cur.priority;
	const row = (await sql.query(`update rebuilds set
         title = $2,
         account = $3,
         equipment = $4,
         serial = $5,
         owner = $6,
         status = $7,
         reason_code = $8,
         reason_detail = $9,
         planned_start = $10,
         target_complete = $11,
         actual_start = $12,
         actual_complete = $13,
         priority = $14,
         notes = $15,
         install_id = $16,
         job_id = $17,
         status_changed_at = case when $18 then now() else status_changed_at end,
         updated_at = now()
       where id = $1
       returning *`, [
		data.id,
		nextTitle,
		nextAccount || "Katz shop / stock",
		data.equipment !== void 0 ? emptyToNull(data.equipment) : cur.equipment,
		data.serial !== void 0 ? emptyToNull(data.serial) : cur.serial,
		nextOwner,
		nextStatus,
		reasonCode,
		reasonDetail,
		data.plannedStart !== void 0 ? isoDayOrNull(data.plannedStart) : isoDayOrNull(cur.planned_start),
		nextTarget,
		actualStart,
		actualComplete,
		priority,
		data.notes !== void 0 ? emptyToNull(data.notes) : cur.notes,
		data.installId !== void 0 ? data.installId : cur.install_id,
		data.jobId !== void 0 ? data.jobId : cur.job_id,
		statusChanged
	]))[0];
	const parts = [
		changed("status", cur.status, nextStatus),
		leavingWaiting && cur.reason_code ? `kept last reason in history · ${cur.reason_code}` : null,
		changed("reason", cur.reason_code, reasonCode),
		changed("owner", cur.owner, nextOwner),
		changed("target", isoDayOrNull(cur.target_complete), nextTarget),
		changed("planned start", isoDayOrNull(cur.planned_start), data.plannedStart !== void 0 ? isoDayOrNull(data.plannedStart) : isoDayOrNull(cur.planned_start)),
		changed("actual start", isoDayOrNull(cur.actual_start), actualStart),
		changed("actual complete", isoDayOrNull(cur.actual_complete), actualComplete)
	].filter((x) => !!x);
	if (parts.length) {
		const action = statusChanged ? "status" : parts.some((p) => p.startsWith("reason") || p.startsWith("kept")) ? "reason" : "updated";
		await logActivity(sql, context.userId, data.id, action, parts.slice(0, 4).join(" · "));
	}
	return mapRebuild(row, todayChicago());
});
var archiveRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number() }).parse(d)).handler(async ({ data, context }) => {
	const sql = await readySql();
	await requireEditor(sql, context.userId);
	await ensureRebuilds(sql);
	const cur = (await sql.query("select * from rebuilds where id = $1", [data.id]))[0];
	if (!cur) throw new Error("Rebuild not found");
	await sql.query(`update rebuilds set archived = true, updated_at = now() where id = $1`, [data.id]);
	await logActivity(sql, context.userId, data.id, "removed", cur.title);
	return { ok: true };
});
async function findWarehouse(sql, serial) {
	const key = serialKey(serial);
	if (!key) return null;
	const hit = (await sql.query(`select id, model, serial, status, site, pallet, level, sold_to, install_id, job_id
     from assets where serial is not null and btrim(serial) <> ''`)).find((r) => serialKey(r.serial) === key);
	if (!hit) return null;
	const loc = hit.pallet && hit.level != null ? `${hit.pallet}-${hit.level}` : hit.site;
	const allocated = !!(hit.sold_to || hit.install_id || hit.job_id || hit.status === "assigned" || hit.status === "sold");
	return {
		assetId: Number(hit.id),
		serial: hit.serial ?? serial,
		model: hit.model,
		location: loc,
		status: hit.status,
		soldTo: hit.sold_to,
		available: !allocated && hit.status === "ready"
	};
}
var pullRebuildSerial = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number(),
	serial: string(),
	confirmReuse: boolean().optional()
}).parse(d)).handler(async ({ data, context }) => {
	const sql = await readySql();
	await requireEditor(sql, context.userId);
	const cur = (await sql.query("select * from rebuilds where id = $1", [data.id]))[0];
	if (!cur) throw new Error("Rebuild not found");
	const serial = data.serial.trim();
	if (!serialKey(serial)) {
		await sql.query(`update rebuilds set serial = $2, serial_notice = $3, updated_at = now() where id = $1`, [
			data.id,
			serial || null,
			serial ? `Serial ${serial} not found in warehouse.` : null
		]);
		const row = (await sql.query("select * from rebuilds where id = $1", [data.id]))[0];
		return mapRebuild(row, todayChicago());
	}
	const hit = await findWarehouse(sql, serial);
	if (!hit) {
		const notice = `Serial ${serial} not found in warehouse.`;
		await sql.query(`update rebuilds set serial = $2, asset_id = null, serial_notice = $3, updated_at = now() where id = $1`, [
			data.id,
			serial,
			notice
		]);
		await logActivity(sql, context.userId, data.id, "serial-miss", notice);
		const row = (await sql.query("select * from rebuilds where id = $1", [data.id]))[0];
		return mapRebuild(row, todayChicago());
	}
	const sameAccount = (hit.soldTo ?? "").trim().toLowerCase() === cur.account.trim().toLowerCase();
	if (!hit.available && !sameAccount && !data.confirmReuse) {
		const who = hit.soldTo || "another account";
		const notice = `Serial ${hit.serial} is already assigned to ${who}.`;
		await sql.query(`update rebuilds set serial_notice = $2, updated_at = now() where id = $1`, [data.id, notice]);
		throw new Error(`${notice} Confirm reuse or cancel.`);
	}
	await sql.query(`update assets set
         status = 'assigned',
         sold_to = $2,
         purpose = 'In-house rebuild',
         updated_at = now()
       where id = $1`, [hit.assetId, cur.account]);
	const extra = !hit.available && hit.soldTo && !sameAccount ? ` (was ${hit.soldTo})` : "";
	const notice = `Serial ${hit.serial} pulled from warehouse · ${hit.model} · ${hit.location}${extra}`;
	const equipment = cur.equipment?.trim() ? cur.equipment : hit.model;
	await sql.query(`update rebuilds set serial = $2, asset_id = $3, equipment = $4, serial_notice = $5, updated_at = now() where id = $1`, [
		data.id,
		hit.serial,
		hit.assetId,
		equipment,
		notice
	]);
	await logActivity(sql, context.userId, data.id, "assigned-asset", notice);
	const row = (await sql.query("select * from rebuilds where id = $1", [data.id]))[0];
	return mapRebuild(row, todayChicago());
});
async function seedRebuilds(sql) {
	await ensureRebuilds(sql);
	if ((await sql.query("select v from seed_meta where k = 'rebuilds'"))[0]?.v === "v1") return;
	if (((await sql.query("select count(*)::int as c from rebuilds"))[0]?.c ?? 0) > 0) {
		await sql.query(`insert into seed_meta (k, v) values ('rebuilds', 'v1') on conflict (k) do update set v = 'v1'`);
		return;
	}
	const today = todayChicago();
	const add = (days) => {
		const [y, m, d] = today.split("-").map(Number);
		return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
	};
	const rows = [
		{
			title: "Cameo steam block — stock",
			account: SHOP_ACCOUNT,
			equipment: "Eversys Cameo c'2m",
			serial: "0183330226105C0012",
			owner: "Ryan",
			status: "Queued",
			reason: null,
			detail: null,
			planned: add(3),
			target: add(21),
			actualStart: null,
			actualComplete: null,
			priority: "normal",
			notes: "Tear-down when the bench frees. Serial is on the rack.",
			changedDays: -1,
			createdDays: -2
		},
		{
			title: "Milton's brew group rebuild",
			account: "Milton's",
			equipment: "Eversys Cameo c'2s",
			serial: null,
			owner: "Oliver",
			status: "In progress",
			reason: null,
			detail: null,
			planned: add(-10),
			target: add(2),
			actualStart: add(-8),
			actualComplete: null,
			priority: "high",
			notes: "On the bench. Target this week so we do not miss the reopen.",
			changedDays: -8,
			createdDays: -12
		},
		{
			title: "Hyde Park ITCB — waiting on steam valve",
			account: "Hyde Park",
			equipment: "Bunn ITCB",
			serial: "ITCB077789",
			owner: "Josh",
			status: "Waiting",
			reason: "Parts on order",
			detail: "Steam valve ETA next Friday from Bunn.",
			planned: add(-20),
			target: add(-4),
			actualStart: add(-18),
			actualComplete: null,
			priority: "committed-to-customer",
			notes: "Do not dispatch until the valve lands. Customer already slipped once.",
			changedDays: -9,
			createdDays: -22
		},
		{
			title: "Shop e'4s leak — waiting on customer",
			account: SHOP_ACCOUNT,
			equipment: "Eversys e'4s",
			serial: "110700026103E0015",
			owner: "Charles",
			status: "Waiting",
			reason: "Waiting on customer",
			detail: "Need the original water-filter spec before we button it up.",
			planned: add(-6),
			target: add(6),
			actualStart: add(-5),
			actualComplete: null,
			priority: "normal",
			notes: "Internal stock unit. Hold for the spec sheet.",
			changedDays: -6,
			createdDays: -7
		},
		{
			title: "Tejas 2051e — test stand",
			account: "Tejas Choco & BBQ - Spring",
			equipment: "Fetco 2051e",
			serial: "470102071577",
			owner: "Ryan",
			status: "Testing",
			reason: null,
			detail: null,
			planned: add(-14),
			target: add(4),
			actualStart: add(-12),
			actualComplete: null,
			priority: "high",
			notes: "Brew cycle on the test stand. Confirm spray head before Ready.",
			changedDays: -2,
			createdDays: -16
		},
		{
			title: "Eurest Axiom — ready to ship",
			account: "Eurest USA",
			equipment: "Bunn Axiom-APS",
			serial: "AXAP048950",
			owner: "Lance",
			status: "Ready",
			reason: null,
			detail: null,
			planned: add(-21),
			target: add(-1),
			actualStart: add(-18),
			actualComplete: null,
			priority: "committed-to-customer",
			notes: "Passed test. Waiting on the truck, not the bench.",
			changedDays: -1,
			createdDays: -24
		},
		{
			title: "Southern Ice grinder — closed",
			account: "Southern Ice CO",
			equipment: "Bunn G9-2T",
			serial: "G951020201",
			owner: "Jesus",
			status: "Completed",
			reason: null,
			detail: null,
			planned: add(-30),
			target: add(-8),
			actualStart: add(-28),
			actualComplete: add(-9),
			priority: "normal",
			notes: "Finished a day early. Back on the account.",
			changedDays: -9,
			createdDays: -32
		},
		{
			title: "Cancelled — account bought new",
			account: "The Gathery",
			equipment: "Fetco 51H",
			serial: null,
			owner: "Bill",
			status: "Cancelled",
			reason: null,
			detail: null,
			planned: add(-12),
			target: add(10),
			actualStart: null,
			actualComplete: null,
			priority: "normal",
			notes: "They bought a new 51H. Do not rebuild the old one.",
			changedDays: -3,
			createdDays: -14
		},
		{
			title: "Cameo steam — no target on the card",
			account: SHOP_ACCOUNT,
			equipment: "Eversys Cameo c'2s",
			serial: null,
			owner: "Jesus",
			status: "In progress",
			reason: null,
			detail: null,
			planned: add(-4),
			target: null,
			actualStart: add(-3),
			actualComplete: null,
			priority: "normal",
			notes: "Already on the bench with no target. Clock should flag No date.",
			changedDays: -3,
			createdDays: -5
		},
		{
			title: "kol fac Linea — past target",
			account: "kol fac 118",
			equipment: "La Marzocco Linea 2EE",
			serial: "L042403",
			owner: "Bill",
			status: "In progress",
			reason: null,
			detail: null,
			planned: add(-25),
			target: add(-7),
			actualStart: add(-22),
			actualComplete: null,
			priority: "committed-to-customer",
			notes: "Past target. Group heads still leaking after the gasket kit.",
			changedDays: -7,
			createdDays: -26
		}
	];
	for (const s of rows) {
		const created = add(s.createdDays);
		const changedAt = add(s.changedDays);
		await sql.query(`insert into rebuilds (
         title, account, equipment, serial, owner, status, reason_code, reason_detail,
         planned_start, target_complete, actual_start, actual_complete, priority, notes,
         status_changed_at, created_at, updated_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
         $15::timestamptz, $16::timestamptz, now()
       )`, [
			s.title,
			s.account,
			s.equipment,
			s.serial,
			s.owner,
			s.status,
			s.reason,
			s.detail,
			s.planned,
			s.target,
			s.actualStart,
			s.actualComplete,
			s.priority,
			s.notes,
			`${changedAt}T12:00:00-05:00`,
			`${created}T09:00:00-05:00`
		]);
	}
	await sql.query(`insert into seed_meta (k, v) values ('rebuilds', 'v1') on conflict (k) do update set v = 'v1'`);
}
function sortRebuildsForExport(rows) {
	return [...rows].sort((a, b) => {
		const h = HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
		if (h) return h;
		const ta = a.targetComplete || "9999-12-31";
		const tb = b.targetComplete || "9999-12-31";
		if (ta !== tb) return ta.localeCompare(tb);
		return a.account.localeCompare(b.account, void 0, { sensitivity: "base" });
	});
}
//#endregion
export { pmFlag as A, CLOSED_CALL as B, formatPingTime as C, money as D, installFlag as E, isoDay as F, isOpenPm as G, isClosedCall as H, isoDayOrNull as I, installedPatch as L, todayChicago as M, weekBounds as N, moneyExact as O, diffDays as P, isInstalled as R, formatNowChicago as S, formatWeekLabel as T, isClosedPm as U, CLOSED_PM as V, isOpenCall as W, WEEKDAYS as _, listRebuilds as a, formatLongDate as b, rebuilds_exports as c, HEALTH_LABEL as d, REBUILD_PRIORITIES as f, priorityLabel as g, WAITING_REASONS as h, listRebuildOwners as i, serviceFlag as j, monthBounds as k, sortRebuildsForExport as l, SHOP_ACCOUNT as m, createRebuild as n, loadRebuilds as o, REBUILD_STATUSES as p, listRebuildLinks as r, pullRebuildSerial as s, archiveRebuild as t, updateRebuild as u, addDays as v, formatShortDate as w, formatMonthLabel as x, addMonths as y, isOpenInstall as z };
