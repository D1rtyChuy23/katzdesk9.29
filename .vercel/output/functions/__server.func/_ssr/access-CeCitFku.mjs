import { i as getServerFnById, n as createServerFn, r as TSS_SERVER_FUNCTION, t as createMiddleware } from "./ssr.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn, t as authMiddleware } from "./flag-DVQH6hUb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-CeCitFku.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var ACCESS_COLS = "user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied, desk_role";
/** Playwright / sandbox probe accounts — they must not steal the live owner's admin seat. */
/** Live desk owner (Chuy). Always an admin, even if a qa.* account claimed first. */
function isLiveDeskOwner(username, name, email) {
	const u = (username ?? "").toLowerCase();
	const n = (name ?? "").trim().toLowerCase();
	const e = (email ?? "").toLowerCase();
	if (u.includes("d1rtychuy") || n.includes("d1rtychuy") || e.includes("d1rtychuy")) return true;
	if (u === "chuy" || n === "chuy") return true;
	if (/^chuy([._-]|$)/.test(u)) return true;
	return false;
}
async function ensureTable(sql) {
	await sql.query(`
    create table if not exists desk_accounts (
      user_id    text primary key,
      username   text not null,
      email      text,
      approved   boolean not null default false,
      is_admin   boolean not null default false,
      username_chosen boolean not null default false,
      denied     boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
	await sql.query("alter table desk_accounts add column if not exists username_chosen boolean not null default false");
	await sql.query("alter table desk_accounts add column if not exists denied boolean not null default false");
	await sql.query("alter table desk_accounts add column if not exists can_add_customers boolean not null default true");
	await sql.query("alter table desk_accounts add column if not exists desk_role text");
	try {
		await sql.query("alter table desk_accounts alter column can_add_customers set default true");
	} catch {}
	await sql.query(`
    create table if not exists desk_access_flags (
      key text primary key,
      set_at timestamptz not null default now()
    )`);
	if (!(await sql.query("select key from desk_access_flags where key = 'add_customers_on' limit 1"))[0]) {
		await sql.query("update desk_accounts set can_add_customers = true where approved = true");
		await sql.query("insert into desk_access_flags (key) values ('add_customers_on') on conflict (key) do nothing");
	}
	await sql.query("create unique index if not exists desk_accounts_username_uidx on desk_accounts (lower(username))");
	await sql.query(`
    update desk_accounts
       set username_chosen = true
     where username_chosen = false
       and username is not null
       and length(trim(username)) >= 3`);
	await sql.query(`
    create table if not exists desk_invites (
      id               serial primary key,
      email            text,
      username         text,
      invited_by       text not null,
      status           text not null default 'pending',
      accepted_user_id text,
      created_at       timestamptz not null default now(),
      updated_at       timestamptz not null default now()
    )`);
	await sql.query("create index if not exists desk_invites_status_idx on desk_invites (status, created_at desc)");
	await sql.query("create index if not exists desk_invites_email_idx on desk_invites (lower(email))");
	await sql.query("create index if not exists desk_invites_username_idx on desk_invites (lower(username))");
	await sql.query("alter table desk_invites add column if not exists can_add_customers boolean not null default true");
	await sql.query("alter table desk_invites add column if not exists token text");
	await sql.query("alter table desk_invites add column if not exists expires_at timestamptz");
	await sql.query("alter table desk_invites add column if not exists display_name text");
	await sql.query("update desk_invites set expires_at = created_at + interval '14 days' where expires_at is null");
	const missingTokens = await sql.query("select id from desk_invites where token is null");
	for (const row of missingTokens) await sql.query("update desk_invites set token = $2 where id = $1 and token is null", [row.id, newInviteToken()]);
	await sql.query("create unique index if not exists desk_invites_token_idx on desk_invites (token)");
}
async function loadAccess(sql, userId) {
	return (await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [userId]))[0];
}
function newInviteToken() {
	const bytes = /* @__PURE__ */ new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
/** Whoever holds the invite link gets in, even if Google/X email does not match. */
async function requireAdmin(sql, userId, message) {
	const me = await sql.query("select is_admin from desk_accounts where user_id = $1", [userId]);
	if (!flagOn(me[0]?.is_admin)) throw new Error(message ?? "Only an admin can review accounts.");
}
/** Reject unapproved sessions before any ops query. Used by deskMiddleware. */
async function assertApproved(userId) {
	const sql = await getSql();
	await ensureTable(sql);
	const existing = await loadAccess(sql, userId);
	if (!flagOn(existing?.approved)) throw new Error("This account is waiting for approval.");
}
/** Auth + approved desk account. Use on every ops/notify server function. */
var deskMiddleware = createMiddleware({ type: "function" }).middleware([authMiddleware]).server(async ({ next, context }) => {
	await assertApproved(context.userId);
	return next();
});
var checkUsername = createServerFn({ method: "POST" }).validator((d) => d).handler(createSsrRpc("8c8f06038c8723897ebcecc99628566e6111d4f176e232f91206b26908879e6e"));
var lookupSignIn = createServerFn({ method: "POST" }).validator((d) => d).handler(createSsrRpc("700b799cf439db04647221adfa8f61295144daa74c6da21aec2fae852db466e2"));
var peekInvite = createServerFn({ method: "POST" }).validator((d) => d).handler(createSsrRpc("e05fae23059afc9524cd7006566d3660d6e4e2f8e952866a6a0056267e182f6a"));
var getMyAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("1e76910bf98a3daeaebec03779f138bb00c8e750fd47ea60c7b94abbc3536e90"));
var claimInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("63f131a91c65df7c685474b7274437f0a38d7ecc2e8a5fda7460a20345e3664c"));
var registerAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("7f22f350550d2ff3b78203194b7c195944e4345e647c9bf227847d8e91ac717c"));
var listDeskAccounts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("a9beaf65084fe0c4d1a91b561db0f7dfe13c0479920eca4f2cac3d82af365079"));
var setAccountApproved = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("01a5a11fc715677325945efd317365c2105db9f8ba9b5d8045dcf90b9a0432cf"));
var setAccountCanAddCustomers = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("312d37f1589d16ecdcbdf5b204dbcbdc26d40c2ab5050689f9e097526c238a7f"));
var setAccountRole = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("12a794f25eedc091fcc01b69c8afc2fa2556f959485701d3426296bd1de6f841"));
var grantAllCanAddCustomers = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("5d5dd28faae9fab46aaaf3d96465e9b2b1524240b1cdfcf1959debccb5bceea6"));
var denyAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("bcbd53d274f00bf8475319f64be83a5f2836af89d7875c42409365ad7d02d632"));
var listDeskInvites = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("96b964ccada664131e89643fc6b11b1706175dac83156dd8dca0563b06a07e5c"));
var createInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("d0a57fc171437e25225eb204997c8dfd57ffe636970a048a22ff3ac09d0ecf93"));
var resendInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("9c292e35364419fb8a3cdeb3000743a246026d456d7c0ed4089a6f7e578a24f6"));
var revokeInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("a604085f737e13d9d322b581973ce524189981a7225ef787326d594c0df45acf"));
//#endregion
export { revokeInvite as _, denyAccount as a, setAccountRole as b, grantAllCanAddCustomers as c, listDeskInvites as d, lookupSignIn as f, resendInvite as g, requireAdmin as h, createSsrRpc as i, isLiveDeskOwner as l, registerAccount as m, claimInvite as n, deskMiddleware as o, peekInvite as p, createInvite as r, getMyAccess as s, checkUsername as t, listDeskAccounts as u, setAccountApproved as v, setAccountCanAddCustomers as y };
