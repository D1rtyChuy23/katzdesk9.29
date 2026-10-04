import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { l as isLiveDeskOwner, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, mn as number, un as boolean, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as canonicalTechName, t as DEFAULT_TECHS } from "./tech-match-BXt0nt9H.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/roster-CS0yptG6.js
var DEFAULT_ROSTER = [...DEFAULT_TECHS.map((name) => ({
	name,
	active: true
})), {
	name: "Elias",
	active: false
}];
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
	if (!(await sql.query("select name, active from desk_techs")).length) {
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
	const rows = await sql.query("select id, name, active from desk_techs");
	for (const row of rows) {
		const canon = canonicalTechName(row.name);
		if (!canon || canon === row.name) continue;
		if ((await sql.query("select id from desk_techs where lower(name) = lower($1) and id <> $2 limit 1", [canon, row.id]))[0]) await sql.query("delete from desk_techs where id = $1", [row.id]);
		else await sql.query("update desk_techs set name = $2, active = true, updated_at = now() where id = $1", [row.id, canon]);
	}
	const after = await sql.query("select name from desk_techs");
	const have = new Set(after.map((r) => r.name.trim().toLowerCase()));
	let maxOrder = (await sql.query("select coalesce(max(sort_order), 0)::int as n from desk_techs"))[0]?.n ?? 0;
	for (const name of DEFAULT_TECHS) if (have.has(name.toLowerCase())) await sql.query("update desk_techs set active = true, name = $2, updated_at = now() where lower(name) = lower($1)", [name, name]);
	else {
		maxOrder += 10;
		await sql.query(`insert into desk_techs (name, active, sort_order) values ($1, true, $2)`, [name, maxOrder]);
		have.add(name.toLowerCase());
	}
	await sql.query(`update desk_techs set active = false, updated_at = now()
      where lower(name) = 'elias' and active = true`);
	let order = 10;
	for (const name of DEFAULT_TECHS) {
		await sql.query("update desk_techs set sort_order = $2 where lower(name) = lower($1)", [name, order]);
		order += 10;
	}
	await sql.query("update desk_techs set sort_order = $1 where lower(name) = 'elias'", [order + 40]);
}
async function loadTechs(sql) {
	await ensureRoster(sql);
	const rows = await sql.query("select id, name, active, sort_order from desk_techs order by sort_order, id");
	if (!rows.length) return DEFAULT_TECHS.map((name, i) => ({
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
	return (await loadAccounts(sql)).find((a) => flagOn(a.is_admin) && isLiveDeskOwner(a.username, null, a.email)) ?? null;
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
	const me = await sql.query("select username, email, is_admin, approved from desk_accounts where user_id = $1", [userId]);
	if (me[0] && flagOn(me[0].approved) && flagOn(me[0].is_admin) && isLiveDeskOwner(me[0].username, null, me[0].email)) return true;
	const owner = await ownerAccount(sql);
	if (owner) return owner.user_id === userId;
	const admin = await rosterAdminUserId(sql);
	return !!admin && admin === userId;
}
async function requireRosterEditor(sql, userId) {
	if (!await canUserEditRoster(sql, userId)) throw new Error("Only the roster admin can add or remove technicians.");
}
function cleanTechName(raw) {
	return raw.trim().replace(/\s+/g, " ");
}
var listTechs_createServerFn_handler = createServerRpc({
	id: "6a7975fdb5f66f49fa83d2d5d69689ac2584794af314076f3731b68a6ffe713c",
	name: "listTechs",
	filename: "src/lib/ops/roster.ts"
}, (opts) => listTechs.__executeServer(opts));
var listTechs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listTechs_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureRoster(sql);
	const techs = await loadTechs(sql);
	const canEdit = await canUserEditRoster(sql, context.userId);
	const owner = await ownerAccount(sql);
	const adminId = await rosterAdminUserId(sql);
	const admin = adminId ? await sql.query("select username from desk_accounts where user_id = $1", [adminId]) : [];
	return {
		techs,
		canEdit,
		ownerLocked: !!owner,
		rosterAdminUsername: admin[0]?.username ?? null
	};
});
var listRosterCandidates_createServerFn_handler = createServerRpc({
	id: "4fb622c34d0f8a4c8000a6cacbcea16f8be53607038a90fb258d4781f34aeae0",
	name: "listRosterCandidates",
	filename: "src/lib/ops/roster.ts"
}, (opts) => listRosterCandidates.__executeServer(opts));
var listRosterCandidates = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listRosterCandidates_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await requireRosterEditor(sql, context.userId);
	if (await ownerAccount(sql)) return [];
	return (await loadAccounts(sql)).filter((a) => !isQa(a.username)).map((a) => ({
		userId: a.user_id,
		username: a.username
	}));
});
var addTech_createServerFn_handler = createServerRpc({
	id: "91cf4a3d18addcef695415dfa07f0323e2ba222a842baa7b1cc9a5e27e896991",
	name: "addTech",
	filename: "src/lib/ops/roster.ts"
}, (opts) => addTech.__executeServer(opts));
var addTech = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ name: string().min(1) }).parse(d)).handler(addTech_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await requireRosterEditor(sql, context.userId);
	const name = cleanTechName(data.name);
	if (!name) throw new Error("Enter a technician name.");
	if (name.length > 40) throw new Error("Keep the name under 40 characters.");
	const found = await sql.query("select id from desk_techs where lower(name) = lower($1) limit 1", [name]);
	if (found[0]) await sql.query("update desk_techs set active = true, name = $2, updated_at = now() where id = $1", [found[0].id, name]);
	else {
		const max = await sql.query("select coalesce(max(sort_order), 0)::int as n from desk_techs");
		await sql.query(`insert into desk_techs (name, active, sort_order) values ($1, true, $2)`, [name, (max[0]?.n ?? 0) + 10]);
	}
	return listTechs();
});
var setTechActive_createServerFn_handler = createServerRpc({
	id: "9ab91de92323e50691c871ac4b1abdfc2406ecc69f8898bfc8570b2f3601a8f9",
	name: "setTechActive",
	filename: "src/lib/ops/roster.ts"
}, (opts) => setTechActive.__executeServer(opts));
var setTechActive = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number(),
	active: boolean()
}).parse(d)).handler(setTechActive_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await requireRosterEditor(sql, context.userId);
	if (!(await sql.query("update desk_techs set active = $2, updated_at = now() where id = $1 returning id", [data.id, data.active]))[0]) throw new Error("Technician not found.");
	return listTechs();
});
var setRosterAdmin_createServerFn_handler = createServerRpc({
	id: "d4f3a4453af79228779d10db5c4c867e0d5772bb5e93b9b07018aa2b92416401",
	name: "setRosterAdmin",
	filename: "src/lib/ops/roster.ts"
}, (opts) => setRosterAdmin.__executeServer(opts));
var setRosterAdmin = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ userId: string().min(1) }).parse(d)).handler(setRosterAdmin_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await requireRosterEditor(sql, context.userId);
	if (await ownerAccount(sql)) throw new Error("The desk owner already holds the roster lock.");
	if (!(await sql.query("select user_id from desk_accounts where user_id = $1 and approved = true", [data.userId]))[0]) throw new Error("That account is not on the desk.");
	await setSetting(sql, "roster_admin_user_id", data.userId);
	return listTechs();
});
//#endregion
export { addTech_createServerFn_handler, listRosterCandidates_createServerFn_handler, listTechs_createServerFn_handler, setRosterAdmin_createServerFn_handler, setTechActive_createServerFn_handler };
