import { r as __exportAll } from "../_runtime.mjs";
import { hn as object, vn as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as createServerFn } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { r as getSql } from "./popup.server.mjs";
import { a as deskMiddleware, b as flagOn } from "./access.mjs";
import { t as normalizeName } from "./norm.mjs";
//#region src/lib/ops/rep-match.ts
/** Locked sales-rep list. Display as Name (IN). */
var DEFAULT_REPS = [
	{
		name: "Amanda Logg",
		initials: "AL",
		first: "Amanda"
	},
	{
		name: "Lizbeth Romero",
		initials: "LR",
		first: "Lizbeth"
	},
	{
		name: "Sean Marshall",
		initials: "SM",
		first: "Sean"
	},
	{
		name: "Lance Oden",
		initials: "LO",
		first: "Lance"
	},
	{
		name: "Bill McKinley",
		initials: "BM",
		first: "Bill"
	},
	{
		name: "Shannon Cafourek",
		initials: "SC",
		first: "Shannon"
	},
	{
		name: "Jesus Garcia",
		initials: "JG",
		first: "Jesus"
	},
	{
		name: "Melinda Warden",
		initials: "MW",
		first: "Melinda"
	}
];
var PRODUCERS = DEFAULT_REPS.map((r) => r.name);
var PRODUCER_INITIALS = Object.fromEntries(DEFAULT_REPS.map((r) => [r.name, r.initials]));
var ALIASES = {};
function addAlias(raw, canonical) {
	const k = normalizeName(raw);
	if (k) ALIASES[k] = canonical;
}
for (const r of DEFAULT_REPS) {
	addAlias(r.name, r.name);
	addAlias(r.first, r.name);
	addAlias(r.initials, r.name);
	addAlias(`${r.first} ${r.initials}`, r.name);
	addAlias(`${r.name} (${r.initials})`, r.name);
}
addAlias("McKinley", "Bill McKinley");
addAlias("McKinsley", "Bill McKinley");
addAlias("Bill McKinsley", "Bill McKinley");
addAlias("Bill McKinley", "Bill McKinley");
addAlias("Warden", "Melinda Warden");
function findRep(raw) {
	const n = normalizeName(raw);
	if (!n) return null;
	const mapped = ALIASES[n];
	if (mapped) return DEFAULT_REPS.find((r) => r.name === mapped) ?? null;
	const stripped = n.replace(/\s*\([a-z]{2}\)\s*$/, "").trim();
	if (stripped && stripped !== n) {
		const again = ALIASES[stripped];
		if (again) return DEFAULT_REPS.find((r) => r.name === again) ?? null;
	}
	for (const r of DEFAULT_REPS) if (normalizeName(r.name) === n || normalizeName(r.first) === n || r.initials.toLowerCase() === n) return r;
	return null;
}
function canonicalRepName(raw) {
	return findRep(raw)?.name ?? null;
}
function isNoRep(raw) {
	return !findRep(raw);
}
function formatRep(raw) {
	const r = findRep(raw);
	if (r) return `${r.name} (${r.initials})`;
	return (raw ?? "").trim() || "";
}
function sameRep(a, b) {
	const left = canonicalRepName(a);
	const right = canonicalRepName(b);
	if (left && right) return left === right;
	return normalizeName(a) !== "" && normalizeName(a) === normalizeName(b);
}
//#endregion
//#region src/lib/ops/reps.ts
var reps_exports = /* @__PURE__ */ __exportAll({
	addRep: () => addRep,
	customerKey: () => customerKey,
	ensureAccountMarks: () => ensureAccountMarks,
	ensureReps: () => ensureReps,
	isAviKatz: () => isAviKatz,
	listReps: () => listReps,
	loadAccountMarks: () => loadAccountMarks,
	loadReps: () => loadReps,
	remapStoredReps: () => remapStoredReps,
	setRepActive: () => setRepActive,
	upsertAccountMarks: () => upsertAccountMarks
});
async function ensureReps(sql) {
	await sql.query(`
    create table if not exists desk_reps (
      id serial primary key,
      name text not null,
      initials text not null,
      active boolean not null default true,
      sort_order int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
	try {
		await sql.query("create unique index if not exists desk_reps_name_lower_uidx on desk_reps (lower(name))");
	} catch {}
	const existing = await sql.query("select name, initials from desk_reps");
	if (!existing.length) {
		let order = 10;
		for (const r of DEFAULT_REPS) {
			await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
				r.name,
				r.initials,
				order
			]);
			order += 10;
		}
		return;
	}
	for (const r of DEFAULT_REPS) if (!existing.find((e) => normalizeName(e.name) === normalizeName(r.name) || normalizeName(e.initials) === normalizeName(r.initials))) {
		const max = await sql.query("select coalesce(max(sort_order), 0)::int as n from desk_reps");
		await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
			r.name,
			r.initials,
			(max[0]?.n ?? 0) + 10
		]);
	}
}
async function loadReps(sql) {
	await ensureReps(sql);
	const rows = await sql.query("select id, name, initials, active, sort_order from desk_reps order by sort_order, id");
	if (!rows.length) return DEFAULT_REPS.map((r, i) => ({
		id: i + 1,
		name: r.name,
		initials: r.initials,
		active: true,
		sortOrder: (i + 1) * 10
	}));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		initials: r.initials,
		active: flagOn(r.active),
		sortOrder: r.sort_order
	}));
}
async function remapStoredReps(sql) {
	await ensureReps(sql);
	const deals = await sql.query("select id, producer from deals");
	let dealN = 0;
	for (const d of deals) {
		const next = canonicalRepName(d.producer);
		if (next && next !== d.producer) {
			await sql.query("update deals set producer = $2, updated_at = now() where id = $1", [d.id, next]);
			dealN += 1;
		}
	}
	const installs = await sql.query("select id, account_rep from installs");
	let instN = 0;
	for (const i of installs) {
		const next = canonicalRepName(i.account_rep);
		if (next && next !== i.account_rep) {
			await sql.query("update installs set account_rep = $2, updated_at = now() where id = $1", [i.id, next]);
			instN += 1;
		}
	}
	const customers = await sql.query("select id, account_rep from directory_customers");
	let custN = 0;
	for (const c of customers) {
		const next = canonicalRepName(c.account_rep);
		if (next && next !== c.account_rep) {
			await sql.query("update directory_customers set account_rep = $2, updated_at = now() where id = $1", [c.id, next]);
			custN += 1;
		}
	}
	return {
		deals: dealN,
		installs: instN,
		customers: custN
	};
}
async function ensureAccountMarks(sql) {
	await sql.query("alter table directory_customers add column if not exists account_rep text");
	await sql.query("alter table directory_customers add column if not exists avi_katz boolean not null default false");
}
async function loadAccountMarks(sql) {
	await ensureAccountMarks(sql);
	const rows = await sql.query(`select name, avi_katz, account_rep from directory_customers where archived = false`);
	const ak = /* @__PURE__ */ new Set();
	const rep = /* @__PURE__ */ new Map();
	for (const r of rows) {
		const k = (r.name ?? "").trim().toLowerCase();
		if (!k) continue;
		if (flagOn(r.avi_katz)) ak.add(k);
		if (r.account_rep) rep.set(k, r.account_rep);
	}
	return {
		ak,
		rep
	};
}
function customerKey(name) {
	return (name ?? "").trim().toLowerCase();
}
function isAviKatz(marks, customer) {
	return marks.ak.has(customerKey(customer));
}
async function upsertAccountMarks(sql, customer, patch) {
	await ensureAccountMarks(sql);
	const name = customer.trim();
	if (!name) return;
	const existing = await sql.query("select id from directory_customers where lower(name) = $1 limit 1", [name.toLowerCase()]);
	const rep = patch.accountRep === void 0 ? void 0 : canonicalRepName(patch.accountRep);
	if (existing[0]) {
		if (patch.aviKatz !== void 0 && patch.accountRep !== void 0) await sql.query(`update directory_customers
            set avi_katz = $2, account_rep = $3, updated_at = now()
          where id = $1`, [
			existing[0].id,
			patch.aviKatz,
			rep ?? null
		]);
		else if (patch.aviKatz !== void 0) await sql.query(`update directory_customers set avi_katz = $2, updated_at = now() where id = $1`, [existing[0].id, patch.aviKatz]);
		else if (patch.accountRep !== void 0) await sql.query(`update directory_customers set account_rep = $2, updated_at = now() where id = $1`, [existing[0].id, rep ?? null]);
		return;
	}
	await sql.query(`insert into directory_customers (name, avi_katz, account_rep)
     values ($1, $2, $3)`, [
		name,
		patch.aviKatz ?? false,
		patch.accountRep === void 0 ? null : rep ?? null
	]);
}
var listReps = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	const { canUserEditRoster } = await import("./roster.mjs").then((n) => n.a);
	return {
		reps: await loadReps(sql),
		canEdit: await canUserEditRoster(sql, context.userId)
	};
});
var addRep = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	name: string().min(1),
	initials: string().min(1)
}).parse(d)).handler(async ({ context, data }) => {
	const sql = await getSql();
	const { requireRosterEditor } = await import("./roster.mjs").then((n) => n.a);
	await requireRosterEditor(sql, context.userId);
	const name = data.name.trim().replace(/\s+/g, " ");
	const initials = data.initials.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
	if (name.length < 2) throw new Error("Enter a full name.");
	if (initials.length < 2) throw new Error("Enter initials (two letters).");
	const found = await sql.query("select id from desk_reps where lower(name) = $1 or lower(initials) = $2 limit 1", [name, initials]);
	if (found[0]) await sql.query("update desk_reps set active = true, name = $2, initials = $3, updated_at = now() where id = $1", [
		found[0].id,
		name,
		initials
	]);
	else {
		const max = await sql.query("select coalesce(max(sort_order), 0)::int as n from desk_reps");
		await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
			name,
			initials,
			(max[0]?.n ?? 0) + 10
		]);
	}
	return {
		reps: await loadReps(sql),
		canEdit: true
	};
});
var setRepActive = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	const { requireRosterEditor } = await import("./roster.mjs").then((n) => n.a);
	await requireRosterEditor(sql, context.userId);
	await sql.query("update desk_reps set active = $2, updated_at = now() where id = $1", [data.id, data.active]);
	return {
		reps: await loadReps(sql),
		canEdit: true
	};
});
//#endregion
export { loadAccountMarks as a, upsertAccountMarks as c, PRODUCER_INITIALS as d, canonicalRepName as f, sameRep as h, listReps as i, DEFAULT_REPS as l, isNoRep as m, customerKey as n, reps_exports as o, formatRep as p, isAviKatz as r, setRepActive as s, addRep as t, PRODUCERS as u };
