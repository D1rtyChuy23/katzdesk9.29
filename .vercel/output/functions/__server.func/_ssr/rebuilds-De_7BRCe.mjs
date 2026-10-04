import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as createServerFn } from "./ssr.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, mn as number, un as boolean, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { O as todayChicago, S as isoDayOrNull } from "./clock-CnyB9j5S.mjs";
import { a as loadAccountMarks, r as isAviKatz, t as accountRepFor } from "./reps-DVL7lV7J.mjs";
import { c as computeRebuildMetrics, l as isRebuildPriority, o as SHOP_ACCOUNT, r as HEALTH_RANK, u as isRebuildStatus } from "./rebuild-model-DFutjdeg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rebuilds-De_7BRCe.js
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
var listRebuilds = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("4eb4da6169db850b7984b635fca811e56b64d5fbeac765cd327e779c83c83dec"));
var listRebuildOwners = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("f15851b69a3e7b42b4e445c440d3feb4faef6714c2f17ed71907c717ceb1d406"));
var listRebuildLinks = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("2b27f3c2732afa1ab10aff6dc4a21d97370572f26b12f33d9ea9293891c3d5a6"));
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
var createRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => createSchema.parse(d)).handler(createSsrRpc("c02f4706c9c4fc709f0a0203fd50998028247f073559d9aa02e96d8112314336"));
var updateRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => patchSchema.parse(d)).handler(createSsrRpc("44e26914aa398f4aa37a17dfb87e8a7fb1db5fc93245c5a631ba44a5e8146a05"));
var archiveRebuild = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number() }).parse(d)).handler(createSsrRpc("b0a96f3bcf56e0746e12be9396d2f1437288961130d2412e9767e869b615c426"));
var pullRebuildSerial = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number(),
	serial: string(),
	confirmReuse: boolean().optional()
}).parse(d)).handler(createSsrRpc("0aa2a8634edcbca3e8e386b99d9ca448fc1a1d0e54845323e6025f5ce6f5300f"));
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
export { listRebuilds as a, rebuilds_exports as c, listRebuildOwners as i, sortRebuildsForExport as l, createRebuild as n, loadRebuilds as o, listRebuildLinks as r, pullRebuildSerial as s, archiveRebuild as t, updateRebuild as u };
