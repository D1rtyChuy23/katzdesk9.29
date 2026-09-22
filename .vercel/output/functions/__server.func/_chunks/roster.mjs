import { r as __exportAll } from "../_runtime.mjs";
import { A as boolean, F as object, P as number, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as createServerFn } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { r as getSql } from "./popup.server.mjs";
import { i as deskMiddleware, s as isLiveDeskOwner } from "./access.mjs";
import { r as PRODUCER_INITIALS, t as DEFAULT_REPS } from "./rep-match.mjs";
//#region src/lib/ops/lookups.ts
var TECHNICIANS = [
	"Ryan",
	"Oliver",
	"Josh",
	"Charles",
	"Bill",
	"Lance",
	"Jesus",
	"3rd Party"
];
var CALL_STATUSES = [
	"Open",
	"Dispatched",
	"In Progress",
	"Follow-up Needed",
	"Phone Resolved",
	"Completed",
	"Cancelled"
];
var CALL_TYPES = [
	"Field Service",
	"In-House Rebuild",
	"Installation"
];
var PM_STATUSES = [
	"Pending Scheduling",
	"Scheduled",
	"Awaiting Parts",
	"Ready to Dispatch",
	"In Progress",
	"Completed",
	"Cancelled"
];
var PM_STYLES = [
	"6 month PM",
	"12 month PM",
	"36 month PM",
	"Grinder PM"
];
var PARTS_STATUSES = [
	"Yes - All Available",
	"Partial",
	"No - Awaiting Parts",
	"On Order",
	"TBD / Check Inventory"
];
var EQUIP_STATUSES = [
	"Ready",
	"Not Ready",
	"Installed"
];
var REQS_READY = ["Ready", "Not Ready"];
var PAYMENT_TERMS = [
	"Payment Plan",
	"50% Down + 50% upon install/30 days after",
	"50% Down / 50% at Install or Net 30",
	"Lease",
	"Paid in Full",
	"No Purchased Equipment"
];
var MODULE_PLATFORMS = [
	"Cameo",
	"Enigma / e'Line",
	"Legacy"
];
var MODULE_TYPES = [
	"Brew Module",
	"Medium Brew Module",
	"Large Brew Module",
	"Steam S Module",
	"Steam M Module",
	"Hydraulic Module",
	"Grinder Module",
	"Milk Module",
	"Pump Module",
	"Powder Module"
];
var MODULE_STATUSES = [
	"Not Started",
	"In Progress",
	"Waiting on Parts",
	"Ready",
	"Ship to Eversys (Core Swap)",
	"At Eversys - Awaiting Return",
	"Installed at Account",
	"Retired / Scrapped"
];
var URGENCIES = [
	"Emergency",
	"High",
	"Normal",
	"Low"
];
var URGENCY_RANK = {
	Emergency: 0,
	High: 1,
	Normal: 2,
	Low: 3
};
var CLOSED_CALL = /* @__PURE__ */ new Set([
	"Completed",
	"Cancelled",
	"Phone Resolved"
]);
var CLOSED_PM = /* @__PURE__ */ new Set(["Completed", "Cancelled"]);
var PRODUCER_INITIAL_VALUES = new Set(Object.values(PRODUCER_INITIALS).map((s) => s.toLowerCase()));
function normalizeName(s) {
	return s.trim().toLowerCase().replace(/['’]/g, "");
}
function nameTokens(raw) {
	if (!raw) return [];
	const n = normalizeName(raw);
	if (!n) return [];
	return [n, ...n.split(/[\s@._+\-]+/).filter(Boolean)];
}
/** Keys used to decide whether a handoff item belongs to the signed-in person. */
function userMatchKeys(user) {
	const keys = /* @__PURE__ */ new Set();
	if (!user) return keys;
	const add = (raw) => {
		for (const t of nameTokens(raw)) if (t.length >= 3 || t.length === 2 && PRODUCER_INITIAL_VALUES.has(t)) keys.add(t);
	};
	add(user.displayName);
	add(user.primaryEmail);
	add(user.username);
	const parts = (user.displayName ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		const initials = (parts[0][0] + parts[1][0]).toLowerCase();
		if (PRODUCER_INITIAL_VALUES.has(initials)) keys.add(initials);
	}
	for (const rep of DEFAULT_REPS) {
		const first = rep.first.toLowerCase();
		const full = rep.name.toLowerCase();
		const ini = rep.initials.toLowerCase();
		if (keys.has(first) || keys.has(full) || keys.has(ini) || keys.has(rep.name.split(" ")[1]?.toLowerCase() ?? "")) {
			keys.add(first);
			keys.add(full);
			keys.add(ini);
			for (const t of nameTokens(rep.name)) keys.add(t);
		}
	}
	return keys;
}
function namesMatchUser(user, ...names) {
	const keys = userMatchKeys(user);
	if (!keys.size) return false;
	for (const name of names) for (const t of nameTokens(name)) if (keys.has(t)) return true;
	return false;
}
//#endregion
//#region src/lib/ops/roster.ts
var roster_exports = /* @__PURE__ */ __exportAll({
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
function cleanTechName(raw) {
	return raw.trim().replace(/\s+/g, " ");
}
var listTechs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async ({ context }) => {
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
var listRosterCandidates = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await requireRosterEditor(sql, context.userId);
	if (await ownerAccount(sql)) return [];
	return (await loadAccounts(sql)).filter((a) => !isQa(a.username)).map((a) => ({
		userId: a.user_id,
		username: a.username
	}));
});
var addTech = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ name: string().min(1) }).parse(d)).handler(async ({ context, data }) => {
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
var setTechActive = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number(),
	active: boolean()
}).parse(d)).handler(async ({ context, data }) => {
	const sql = await getSql();
	await requireRosterEditor(sql, context.userId);
	if (!(await sql.query("update desk_techs set active = $2, updated_at = now() where id = $1 returning id", [data.id, data.active]))[0]) throw new Error("Technician not found.");
	return listTechs();
});
var setRosterAdmin = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ userId: string().min(1) }).parse(d)).handler(async ({ context, data }) => {
	const sql = await getSql();
	await requireRosterEditor(sql, context.userId);
	if (await ownerAccount(sql)) throw new Error("The desk owner already holds the roster lock.");
	if (!(await sql.query("select user_id from desk_accounts where user_id = $1 and approved = true", [data.userId]))[0]) throw new Error("That account is not on the desk.");
	await setSetting(sql, "roster_admin_user_id", data.userId);
	return listTechs();
});
function techLabel(name, activeNames) {
	if (!name) return "";
	if (activeNames.has(name)) return name;
	const hit = [...activeNames].find((n) => n.toLowerCase() === name.toLowerCase());
	if (hit) return hit;
	return `${name} (inactive)`;
}
//#endregion
export { URGENCIES as C, TECHNICIANS as S, namesMatchUser as T, PARTS_STATUSES as _, roster_exports as a, PM_STYLES as b, techLabel as c, CLOSED_CALL as d, CLOSED_PM as f, MODULE_TYPES as g, MODULE_STATUSES as h, loadTechs as i, CALL_STATUSES as l, MODULE_PLATFORMS as m, listRosterCandidates as n, setRosterAdmin as o, EQUIP_STATUSES as p, listTechs as r, setTechActive as s, addTech as t, CALL_TYPES as u, PAYMENT_TERMS as v, URGENCY_RANK as w, REQS_READY as x, PM_STATUSES as y };
