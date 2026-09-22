import { r as __exportAll } from "../_runtime.mjs";
import { r as createServerFn, s as __exportAll$1 } from "./ssr.mjs";
import { m as TECHNICIANS } from "./lookups-BkjR5sto.mjs";
import { A as boolean, F as object, P as number, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { a as deskMiddleware, c as isLiveDeskOwner, r as createSsrRpc } from "./access-3Tz151bB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/roster-CEJORJjG.js
var roster_CEJORJjG_exports = /* @__PURE__ */ __exportAll({
	a: () => roster_exports,
	c: () => techLabel,
	i: () => loadTechs,
	n: () => listRosterCandidates,
	o: () => setRosterAdmin,
	r: () => listTechs,
	s: () => setTechActive,
	t: () => addTech
});
var roster_exports = /* @__PURE__ */ __exportAll$1({
	addTech: () => addTech,
	canUserEditRoster: () => canUserEditRoster,
	ensureRoster: () => ensureRoster,
	listRosterCandidates: () => listRosterCandidates,
	listTechs: () => listTechs,
	loadTechs: () => loadTechs,
	requireRosterEditor: () => requireRosterEditor,
	rosterAdminUserId: () => rosterAdminUserId,
	setRosterAdmin: () => setRosterAdmin,
	setTechActive: () => setTechActive,
	techLabel: () => techLabel
});
var DEFAULT_ROSTER = [
	{
		name: "Ryan",
		active: true
	},
	{
		name: "Oliver",
		active: true
	},
	{
		name: "Josh",
		active: true
	},
	{
		name: "Charles",
		active: true
	},
	{
		name: "Bill",
		active: true
	},
	{
		name: "Lance",
		active: true
	},
	{
		name: "Jesus",
		active: true
	},
	{
		name: "3rd Party",
		active: true
	},
	{
		name: "Elias",
		active: false
	}
];
function flagOn(value) {
	return value === true || value === 1 || value === "t" || value === "true" || value === "1";
}
async function ensureRoster(sql) {
	await sql.query(`
    create table if not exists desk_settings (
      key text primary key,
      value text,
      updated_at timestamptz not null default now()
    )`);
	await sql.query(`
    create table if not exists desk_techs (
      id serial primary key,
      name text not null,
      active boolean not null default true,
      sort_order int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
	try {
		await sql.query("create unique index if not exists desk_techs_name_lower_uidx on desk_techs (lower(name))");
	} catch {}
	const existing = await sql.query("select name, active from desk_techs");
	if (!existing.length) {
		let order = 10;
		for (const row of DEFAULT_ROSTER) {
			await sql.query(`insert into desk_techs (name, active, sort_order) values ($1, $2, $3)`, [
				row.name,
				row.active,
				order
			]);
			order += 10;
		}
		return;
	}
	await sql.query(`update desk_techs set active = false, updated_at = now()
      where lower(name) = 'elias' and active = true`);
	if (!existing.some((r) => r.name.trim().toLowerCase() === "jesus")) {
		const max = await sql.query("select coalesce(max(sort_order), 0)::int as n from desk_techs");
		await sql.query(`insert into desk_techs (name, active, sort_order) values ($1, true, $2)`, ["Jesus", (max[0]?.n ?? 0) + 10]);
	}
}
async function loadTechs(sql) {
	await ensureRoster(sql);
	const rows = await sql.query("select id, name, active, sort_order from desk_techs order by sort_order, id");
	if (!rows.length) return TECHNICIANS.map((name, i) => ({
		id: i + 1,
		name,
		active: true,
		sortOrder: (i + 1) * 10
	}));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		active: flagOn(r.active),
		sortOrder: r.sort_order
	}));
}
async function loadAccounts(sql) {
	return sql.query(`select user_id, username, email, is_admin, approved from desk_accounts
      where approved = true and denied = false
      order by created_at`);
}
function isQa(username) {
	return /^qa[._-]/i.test(username);
}
async function ownerAccount(sql) {
	return (await loadAccounts(sql)).find((a) => isLiveDeskOwner(a.username, null, a.email)) ?? null;
}
async function setting(sql, key) {
	return (await sql.query("select value from desk_settings where key = $1", [key]))[0]?.value ?? null;
}
async function setSetting(sql, key, value) {
	await sql.query(`insert into desk_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, value]);
}
async function rosterAdminUserId(sql) {
	await ensureRoster(sql);
	const owner = await ownerAccount(sql);
	if (owner) return owner.user_id;
	const stored = await setting(sql, "roster_admin_user_id");
	if (stored) {
		if ((await sql.query("select user_id from desk_accounts where user_id = $1 and approved = true", [stored]))[0]) return stored;
	}
	const accounts = await loadAccounts(sql);
	const pick = accounts.find((a) => flagOn(a.is_admin) && !isQa(a.username)) ?? accounts.find((a) => flagOn(a.is_admin)) ?? accounts[0] ?? null;
	if (pick) await setSetting(sql, "roster_admin_user_id", pick.user_id);
	return pick?.user_id ?? null;
}
async function canUserEditRoster(sql, userId) {
	await ensureRoster(sql);
	const me = await sql.query("select username, email from desk_accounts where user_id = $1", [userId]);
	if (me[0] && isLiveDeskOwner(me[0].username, null, me[0].email)) return true;
	const owner = await ownerAccount(sql);
	if (owner) return owner.user_id === userId;
	const admin = await rosterAdminUserId(sql);
	return !!admin && admin === userId;
}
async function requireRosterEditor(sql, userId) {
	if (!await canUserEditRoster(sql, userId)) throw new Error("Only the roster admin can add or remove technicians.");
}
var listTechs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("6a7975fdb5f66f49fa83d2d5d69689ac2584794af314076f3731b68a6ffe713c"));
var listRosterCandidates = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("4fb622c34d0f8a4c8000a6cacbcea16f8be53607038a90fb258d4781f34aeae0"));
var addTech = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ name: string().min(1) }).parse(d)).handler(createSsrRpc("91cf4a3d18addcef695415dfa07f0323e2ba222a842baa7b1cc9a5e27e896991"));
var setTechActive = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number(),
	active: boolean()
}).parse(d)).handler(createSsrRpc("9ab91de92323e50691c871ac4b1abdfc2406ecc69f8898bfc8570b2f3601a8f9"));
var setRosterAdmin = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ userId: string().min(1) }).parse(d)).handler(createSsrRpc("d4f3a4453af79228779d10db5c4c867e0d5772bb5e93b9b07018aa2b92416401"));
function techLabel(name, activeNames) {
	if (!name) return "";
	if (activeNames.has(name)) return name;
	const hit = [...activeNames].find((n) => n.toLowerCase() === name.toLowerCase());
	if (hit) return hit;
	return `${name} (inactive)`;
}
//#endregion
export { roster_CEJORJjG_exports as a, techLabel as c, loadTechs as i, listRosterCandidates as n, setRosterAdmin as o, listTechs as r, setTechActive as s, addTech as t };
