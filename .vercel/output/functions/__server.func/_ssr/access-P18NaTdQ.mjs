import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { r as getSql } from "./db-CoHNpeUg.mjs";
import { t as authMiddleware } from "./middleware-Dbe77ZMg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-P18NaTdQ.js
var ACCESS_COLS = "user_id, username, email, approved, is_admin";
function cleanUsername(raw) {
	return raw.trim().replace(/\s+/g, "");
}
function slugUsername(raw) {
	const s = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 24);
	return s.length >= 3 ? s : `user${s}`.slice(0, 24) || "user";
}
function validUsername(raw) {
	return /^[a-zA-Z0-9._-]{3,32}$/.test(raw);
}
/** Playwright / sandbox probe accounts — they must not steal the live owner's admin seat. */
function isSandboxQa(username) {
	return /^qa[._-]/i.test(username);
}
/** Live desk owner (Chuy). Always an admin, even if a qa.* account claimed first. */
function isDeskOwner(username, name, email) {
	const blob = [
		username,
		name ?? "",
		email ?? ""
	].join(" ").toLowerCase();
	return /\bchuy\b/.test(blob) || blob.includes("d1rtychuy");
}
async function ensureTable(sql) {
	await sql.query(`
    create table if not exists desk_accounts (
      user_id    text primary key,
      username   text not null,
      email      text,
      approved   boolean not null default false,
      is_admin   boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
	await sql.query("create unique index if not exists desk_accounts_username_uidx on desk_accounts (lower(username))");
}
async function adminCount(sql) {
	const rows = await sql.query("select count(*)::int as n from desk_accounts where approved = true and is_admin = true");
	return Number(rows[0]?.n ?? 0);
}
async function realAdminCount(sql) {
	return (await sql.query("select username from desk_accounts where approved = true and is_admin = true")).filter((r) => !isSandboxQa(r.username)).length;
}
async function shouldBootstrapAdmin(sql, username, name, email) {
	if (isDeskOwner(username, name, email)) return true;
	if (isSandboxQa(username)) return await adminCount(sql) === 0;
	return await realAdminCount(sql) === 0;
}
async function uniqueUsername(sql, base, exceptUserId) {
	const root = slugUsername(cleanUsername(base)) || "user";
	let candidate = root;
	let n = 1;
	for (;;) {
		const rows = await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [candidate.toLowerCase()]);
		if (!rows[0] || rows[0].user_id === exceptUserId) return candidate;
		n += 1;
		if (n > 99) return `${root.slice(0, 16)}${Date.now().toString(36).slice(-6)}`;
		candidate = `${root.slice(0, 20)}${n}`;
	}
}
async function loadUser(sql, userId) {
	const rows = await sql.query(`select name, email from "user" where id = $1 limit 1`, [userId]);
	return {
		name: rows[0]?.name ?? "user",
		email: rows[0]?.email ?? null
	};
}
function mapAccess(row) {
	return {
		userId: row.user_id,
		username: row.username,
		email: row.email,
		approved: !!row.approved,
		isAdmin: !!row.is_admin
	};
}
function isUniqueUsernameError(e) {
	const msg = e instanceof Error ? e.message : String(e);
	return /unique|duplicate key/i.test(msg);
}
async function loadAccess(sql, userId) {
	return (await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [userId]))[0];
}
async function promoteAdmin(sql, userId, email) {
	const rows = await sql.query(`update desk_accounts
     set approved = true,
         is_admin = true,
         email = coalesce($2, email),
         updated_at = now()
     where user_id = $1
     returning ${ACCESS_COLS}`, [userId, email ?? null]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
}
/** Reject unapproved sessions before any ops query. Used by deskMiddleware. */
var checkUsername_createServerFn_handler = createServerRpc({
	id: "8c8f06038c8723897ebcecc99628566e6111d4f176e232f91206b26908879e6e",
	name: "checkUsername",
	filename: "src/lib/ops/access.ts"
}, (opts) => checkUsername.__executeServer(opts));
var checkUsername = createServerFn({ method: "POST" }).validator((d) => d).handler(checkUsername_createServerFn_handler, async ({ data }) => {
	const username = cleanUsername(data.username);
	if (!validUsername(username)) return { available: false };
	const sql = await getSql();
	await ensureTable(sql);
	return { available: !(await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]))[0] };
});
var lookupSignIn_createServerFn_handler = createServerRpc({
	id: "700b799cf439db04647221adfa8f61295144daa74c6da21aec2fae852db466e2",
	name: "lookupSignIn",
	filename: "src/lib/ops/access.ts"
}, (opts) => lookupSignIn.__executeServer(opts));
var lookupSignIn = createServerFn({ method: "POST" }).validator((d) => d).handler(lookupSignIn_createServerFn_handler, async ({ data }) => {
	const username = cleanUsername(data.username);
	if (!username) throw new Error("Enter your username");
	const sql = await getSql();
	await ensureTable(sql);
	const row = (await sql.query("select email, approved from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]))[0];
	if (!row?.email) throw new Error("Unknown username");
	if (!row.approved) throw new Error("This account is waiting for approval.");
	return { email: row.email };
});
var getMyAccess_createServerFn_handler = createServerRpc({
	id: "1e76910bf98a3daeaebec03779f138bb00c8e750fd47ea60c7b94abbc3536e90",
	name: "getMyAccess",
	filename: "src/lib/ops/access.ts"
}, (opts) => getMyAccess.__executeServer(opts));
var getMyAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getMyAccess_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	const existing = await loadAccess(sql, context.userId);
	const profile = await loadUser(sql, context.userId);
	if (existing) {
		if (await shouldBootstrapAdmin(sql, existing.username, profile.name, profile.email ?? existing.email) && (!existing.approved || !existing.is_admin)) return promoteAdmin(sql, context.userId, profile.email);
		return mapAccess(existing);
	}
	const username = await uniqueUsername(sql, profile.name || profile.email?.split("@")[0] || "user");
	const first = await shouldBootstrapAdmin(sql, username, profile.name, profile.email);
	try {
		return mapAccess((await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update
           set email = coalesce(excluded.email, desk_accounts.email),
               approved = desk_accounts.approved or excluded.approved,
               is_admin = desk_accounts.is_admin or excluded.is_admin,
               updated_at = now()
         returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			profile.email,
			first,
			first
		]))[0]);
	} catch (e) {
		if (isUniqueUsernameError(e)) {
			const retryName = await uniqueUsername(sql, username, context.userId);
			return mapAccess((await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin)
           values ($1, $2, $3, $4, $5)
           on conflict (user_id) do update
             set email = coalesce(excluded.email, desk_accounts.email),
                 approved = desk_accounts.approved or excluded.approved,
                 is_admin = desk_accounts.is_admin or excluded.is_admin,
                 updated_at = now()
           returning ${ACCESS_COLS}`, [
				context.userId,
				retryName,
				profile.email,
				first,
				first
			]))[0]);
		}
		throw e;
	}
});
var registerAccount_createServerFn_handler = createServerRpc({
	id: "7f22f350550d2ff3b78203194b7c195944e4345e647c9bf227847d8e91ac717c",
	name: "registerAccount",
	filename: "src/lib/ops/access.ts"
}, (opts) => registerAccount.__executeServer(opts));
var registerAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(registerAccount_createServerFn_handler, async ({ context, data }) => {
	const username = cleanUsername(data.username);
	if (!validUsername(username)) throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
	const sql = await getSql();
	await ensureTable(sql);
	const taken = await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]);
	if (taken[0] && taken[0].user_id !== context.userId) throw new Error("That username is already taken.");
	const profile = await loadUser(sql, context.userId);
	const email = data.email?.trim() || profile.email;
	const first = await shouldBootstrapAdmin(sql, username, profile.name, email);
	const existing = await loadAccess(sql, context.userId);
	try {
		if (existing) return mapAccess((await sql.query(`update desk_accounts
           set username = $2,
               email = coalesce($3, email),
               approved = approved or $4,
               is_admin = is_admin or $4,
               updated_at = now()
           where user_id = $1
           returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			email,
			first
		]))[0] ?? {
			...existing,
			username,
			email: email ?? existing.email
		});
		return mapAccess((await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update
           set username = excluded.username,
               email = coalesce(excluded.email, desk_accounts.email),
               approved = desk_accounts.approved or excluded.approved,
               is_admin = desk_accounts.is_admin or excluded.is_admin,
               updated_at = now()
         returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			email,
			first,
			first
		]))[0]);
	} catch (e) {
		if (isUniqueUsernameError(e)) throw new Error("That username is already taken.");
		throw e;
	}
});
var listDeskAccounts_createServerFn_handler = createServerRpc({
	id: "a9beaf65084fe0c4d1a91b561db0f7dfe13c0479920eca4f2cac3d82af365079",
	name: "listDeskAccounts",
	filename: "src/lib/ops/access.ts"
}, (opts) => listDeskAccounts.__executeServer(opts));
var listDeskAccounts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listDeskAccounts_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	if (!(await sql.query("select is_admin from desk_accounts where user_id = $1", [context.userId]))[0]?.is_admin) throw new Error("Only an admin can review accounts.");
	return (await sql.query("select user_id, username, email, approved, is_admin, created_at from desk_accounts order by created_at desc")).map((r) => ({
		...mapAccess(r),
		createdAt: String(r.created_at)
	}));
});
var setAccountApproved_createServerFn_handler = createServerRpc({
	id: "01a5a11fc715677325945efd317365c2105db9f8ba9b5d8045dcf90b9a0432cf",
	name: "setAccountApproved",
	filename: "src/lib/ops/access.ts"
}, (opts) => setAccountApproved.__executeServer(opts));
var setAccountApproved = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(setAccountApproved_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	if (!(await sql.query("select is_admin from desk_accounts where user_id = $1", [context.userId]))[0]?.is_admin) throw new Error("Only an admin can review accounts.");
	if (data.userId === context.userId && !data.approved) throw new Error("You cannot revoke your own access.");
	await sql.query("update desk_accounts set approved = $2, updated_at = now() where user_id = $1", [data.userId, data.approved]);
	const rows = await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [data.userId]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
});
//#endregion
export { checkUsername_createServerFn_handler, getMyAccess_createServerFn_handler, listDeskAccounts_createServerFn_handler, lookupSignIn_createServerFn_handler, registerAccount_createServerFn_handler, setAccountApproved_createServerFn_handler };
