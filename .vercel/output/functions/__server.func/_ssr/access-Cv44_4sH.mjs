import { n as createMiddleware, r as createServerFn } from "./ssr.mjs";
import { r as getSql } from "./db-CoHNpeUg.mjs";
import { t as authMiddleware } from "./middleware-Dbe77ZMg.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-Cv44_4sH.js
var ACCESS_COLS = "user_id, username, email, approved, is_admin";
/** Playwright / sandbox probe accounts — they must not steal the live owner's admin seat. */
/** Live desk owner (Chuy). Always an admin, even if a qa.* account claimed first. */
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
async function loadAccess(sql, userId) {
	return (await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [userId]))[0];
}
/** Reject unapproved sessions before any ops query. Used by deskMiddleware. */
async function assertApproved(userId) {
	const sql = await getSql();
	await ensureTable(sql);
	if (!(await loadAccess(sql, userId))?.approved) throw new Error("This account is waiting for approval.");
}
/** Auth + approved desk account. Use on every ops/notify server function. */
var deskMiddleware = createMiddleware({ type: "function" }).middleware([authMiddleware]).server(async ({ next, context }) => {
	await assertApproved(context.userId);
	return next();
});
var checkUsername = createServerFn({ method: "POST" }).validator((d) => d).handler(createSsrRpc("8c8f06038c8723897ebcecc99628566e6111d4f176e232f91206b26908879e6e"));
var lookupSignIn = createServerFn({ method: "POST" }).validator((d) => d).handler(createSsrRpc("700b799cf439db04647221adfa8f61295144daa74c6da21aec2fae852db466e2"));
var getMyAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("1e76910bf98a3daeaebec03779f138bb00c8e750fd47ea60c7b94abbc3536e90"));
var registerAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("7f22f350550d2ff3b78203194b7c195944e4345e647c9bf227847d8e91ac717c"));
var listDeskAccounts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("a9beaf65084fe0c4d1a91b561db0f7dfe13c0479920eca4f2cac3d82af365079"));
var setAccountApproved = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("01a5a11fc715677325945efd317365c2105db9f8ba9b5d8045dcf90b9a0432cf"));
//#endregion
export { lookupSignIn as a, listDeskAccounts as i, deskMiddleware as n, registerAccount as o, getMyAccess as r, setAccountApproved as s, checkUsername as t };
