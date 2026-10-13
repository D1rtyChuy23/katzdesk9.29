import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as createServerFn } from "./ssr.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { n as normalizeCustomerKey } from "./customer-key-BKZJDViL.mjs";
import { hn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as normalizeName } from "./norm-_aMMQVT6.mjs";
import { i as canonicalRepName, t as DEFAULT_REPS } from "./rep-match-CXphEIs2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reps-DVL7lV7J.js
var reps_exports = /* @__PURE__ */ __exportAll({
	accountRepFor: () => accountRepFor,
	addRep: () => addRep,
	customerKey: () => customerKey,
	ensureAccountMarks: () => ensureAccountMarks,
	ensureReps: () => ensureReps,
	isAviKatz: () => isAviKatz,
	listReps: () => listReps,
	loadAccountMarks: () => loadAccountMarks,
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
	const repLoose = /* @__PURE__ */ new Map();
	for (const r of rows) {
		const k = (r.name ?? "").trim().toLowerCase();
		if (!k) continue;
		if (flagOn(r.avi_katz)) ak.add(k);
		if (r.account_rep) {
			rep.set(k, r.account_rep);
			const loose = normalizeCustomerKey(r.name);
			if (loose && !repLoose.has(loose)) repLoose.set(loose, r.account_rep);
		}
	}
	return {
		ak,
		rep,
		repLoose
	};
}
function customerKey(name) {
	return (name ?? "").trim().toLowerCase();
}
/** The sales rep saved on a customer account, matching the name loosely. */
function accountRepFor(marks, customer) {
	return marks.rep.get(customerKey(customer)) ?? marks.repLoose.get(normalizeCustomerKey(customer)) ?? null;
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
var listReps = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("d2f0c01fa586ab0280a9d2571d6e36996bd105984cf8317054ca9844291a521a"));
var addRep = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	name: string().min(1),
	initials: string().min(1)
}).parse(d)).handler(createSsrRpc("8dc5f4484e42250633d38357b1e51e8f9a79cf8765bdb03de157067e5e570a90"));
var setRepActive = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("87ac9452e7d2cfc8ff048a7f556a4cb201fe948dfb3c427d26b54fb0668828a5"));
//#endregion
export { loadAccountMarks as a, upsertAccountMarks as c, listReps as i, addRep as n, reps_exports as o, isAviKatz as r, setRepActive as s, accountRepFor as t };
