import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { p as todayChicago } from "./clock-CSFAgASg.mjs";
import { A as boolean, F as object, P as number, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { r as getSql } from "./db-DloSBs0E.mjs";
import { a as deskMiddleware } from "./access-3Tz151bB.mjs";
import { a as loadAccountMarks, n as customerKey, o as loadReps, r as isAviKatz } from "./reps-B2EuoM-m.mjs";
import { c as computeRebuildMetrics, f as validateRebuild, l as isRebuildPriority, o as SHOP_ACCOUNT, t as CLOSED_REBUILD, u as isRebuildStatus } from "./rebuild-model-DW2rlokp.mjs";
import { i as loadTechs } from "./roster-CEJORJjG.mjs";
import { n as serialKey } from "./serial-pull-CVHfaB5C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rebuilds-Bjhimag_.js
async function readySql() {
	const { ensureSeeded } = await import("./seed.server-qDRWEwJF.mjs");
	await ensureSeeded();
	return getSql();
}
function isoDay(v) {
	if (v == null || v === "") return null;
	if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : null;
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
}
function mapRebuild(r, today, accountRep = null, aviKatz = false) {
	const status = isRebuildStatus(r.status) ? r.status : "Queued";
	const priority = isRebuildPriority(r.priority) ? r.priority : "normal";
	const metrics = computeRebuildMetrics({
		status,
		owner: r.owner,
		targetComplete: isoDay(r.target_complete),
		actualStart: isoDay(r.actual_start),
		actualComplete: isoDay(r.actual_complete),
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
		plannedStart: isoDay(r.planned_start),
		targetComplete: isoDay(r.target_complete),
		actualStart: isoDay(r.actual_start),
		actualComplete: isoDay(r.actual_complete),
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
	const rows = await sql.query("select * from rebuilds order by id desc");
	const marks = await loadAccountMarks(sql).catch(() => ({
		rep: /* @__PURE__ */ new Map(),
		ak: /* @__PURE__ */ new Set()
	}));
	return rows.map((r) => mapRebuild(r, today, marks.rep.get(customerKey(r.account)) ?? null, isAviKatz(marks, r.account)));
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
var listRebuilds_createServerFn_handler = createServerRpc({
	id: "4eb4da6169db850b7984b635fca811e56b64d5fbeac765cd327e779c83c83dec",
	name: "listRebuilds",
	filename: "src/lib/ops/rebuilds.ts"
}, (opts) => listRebuilds.__executeServer(opts));
var listRebuilds = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listRebuilds_createServerFn_handler, async ({ context }) => {
	const sql = await readySql();
	const access = await loadAccessLite(sql, context.userId);
	return {
		rows: await loadRebuilds(sql),
		canEdit: canEditBench(access)
	};
});
var listRebuildOwners_createServerFn_handler = createServerRpc({
	id: "f15851b69a3e7b42b4e445c440d3feb4faef6714c2f17ed71907c717ceb1d406",
	name: "listRebuildOwners",
	filename: "src/lib/ops/rebuilds.ts"
}, (opts) => listRebuildOwners.__executeServer(opts));
var listRebuildOwners = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listRebuildOwners_createServerFn_handler, async () => {
	const sql = await readySql();
	const techs = (await loadTechs(sql)).filter((t) => t.active).map((t) => t.name);
	const reps = (await loadReps(sql)).filter((r) => r.active).map((r) => r.name);
	const users = await sql.query("select username from desk_accounts where approved = true and coalesce(username, '') <> '' order by lower(username)");
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const n of [
		...techs,
		...reps,
		...users.map((u) => u.username)
	]) {
		const key = n.trim().toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(n.trim());
	}
	return out;
});
var listRebuildLinks_createServerFn_handler = createServerRpc({
	id: "2b27f3c2732afa1ab10aff6dc4a21d97370572f26b12f33d9ea9293891c3d5a6",
	name: "listRebuildLinks",
	filename: "src/lib/ops/rebuilds.ts"
}, (opts) => listRebuildLinks.__executeServer(opts));
var listRebuildLinks = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(listRebuildLinks_createServerFn_handler, async ({ data }) => {
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
var createRebuild_createServerFn_handler = createServerRpc({
	id: "c02f4706c9c4fc709f0a0203fd50998028247f073559d9aa02e96d8112314336",
	name: "createRebuild",
	filename: "src/lib/ops/rebuilds.ts"
}, (opts) => createRebuild.__executeServer(opts));
var createRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => createSchema.parse(d)).handler(createRebuild_createServerFn_handler, async ({ data, context }) => {
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
		isoDay(data.plannedStart),
		isoDay(data.targetComplete),
		isoDay(data.actualStart) || (status === "In progress" ? todayChicago() : null),
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
var updateRebuild_createServerFn_handler = createServerRpc({
	id: "44e26914aa398f4aa37a17dfb87e8a7fb1db5fc93245c5a631ba44a5e8146a05",
	name: "updateRebuild",
	filename: "src/lib/ops/rebuilds.ts"
}, (opts) => updateRebuild.__executeServer(opts));
var updateRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => patchSchema.parse(d)).handler(updateRebuild_createServerFn_handler, async ({ data, context }) => {
	const sql = await readySql();
	await requireEditor(sql, context.userId);
	await ensureRebuilds(sql);
	const cur = (await sql.query("select * from rebuilds where id = $1", [data.id]))[0];
	if (!cur) throw new Error("Rebuild not found");
	const nextStatus = data.status != null ? data.status : cur.status;
	const nextOwner = data.owner !== void 0 ? emptyToNull(data.owner) : cur.owner;
	const nextTarget = data.targetComplete !== void 0 ? isoDay(data.targetComplete) : isoDay(cur.target_complete);
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
	let actualStart = data.actualStart !== void 0 ? isoDay(data.actualStart) : isoDay(cur.actual_start);
	if (!actualStart && nextStatus === "In progress" && cur.status !== "In progress") actualStart = todayChicago();
	let actualComplete = data.actualComplete !== void 0 ? isoDay(data.actualComplete) : isoDay(cur.actual_complete);
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
		data.plannedStart !== void 0 ? isoDay(data.plannedStart) : isoDay(cur.planned_start),
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
		changed("target", isoDay(cur.target_complete), nextTarget),
		changed("planned start", isoDay(cur.planned_start), data.plannedStart !== void 0 ? isoDay(data.plannedStart) : isoDay(cur.planned_start)),
		changed("actual start", isoDay(cur.actual_start), actualStart),
		changed("actual complete", isoDay(cur.actual_complete), actualComplete)
	].filter((x) => !!x);
	if (parts.length) {
		const action = statusChanged ? "status" : parts.some((p) => p.startsWith("reason") || p.startsWith("kept")) ? "reason" : "updated";
		await logActivity(sql, context.userId, data.id, action, parts.slice(0, 4).join(" · "));
	}
	return mapRebuild(row, todayChicago());
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
var pullRebuildSerial_createServerFn_handler = createServerRpc({
	id: "0aa2a8634edcbca3e8e386b99d9ca448fc1a1d0e54845323e6025f5ce6f5300f",
	name: "pullRebuildSerial",
	filename: "src/lib/ops/rebuilds.ts"
}, (opts) => pullRebuildSerial.__executeServer(opts));
var pullRebuildSerial = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number(),
	serial: string(),
	confirmReuse: boolean().optional()
}).parse(d)).handler(pullRebuildSerial_createServerFn_handler, async ({ data, context }) => {
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
//#endregion
export { createRebuild_createServerFn_handler, listRebuildLinks_createServerFn_handler, listRebuildOwners_createServerFn_handler, listRebuilds_createServerFn_handler, pullRebuildSerial_createServerFn_handler, updateRebuild_createServerFn_handler };
