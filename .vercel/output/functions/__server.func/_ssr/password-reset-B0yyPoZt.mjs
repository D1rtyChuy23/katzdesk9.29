import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { t as authMiddleware } from "./flag-DVQH6hUb.mjs";
import { h as requireAdmin } from "./access-CeCitFku.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/password-reset-B0yyPoZt.js
/** Links stay good for two days and work once. */
var RESET_HOURS = 48;
var MIN_PASSWORD = 8;
function randomToken() {
	const bytes = /* @__PURE__ */ new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
/** Only a hash of the token is stored, so a copied database can't be used to reset anyone. */
async function sha256(text) {
	const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
function passwordProblem(pw) {
	if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
	if (pw.length > 128) return "That password is too long.";
	return null;
}
var createPasswordResetLink_createServerFn_handler = createServerRpc({
	id: "017a676e03a8482a954947e3d04a0c77aa8eeff662ebff5a1803e4c90feffb71",
	name: "createPasswordResetLink",
	filename: "src/lib/ops/password-reset.ts"
}, (opts) => createPasswordResetLink.__executeServer(opts));
var createPasswordResetLink = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createPasswordResetLink_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await requireAdmin(sql, context.userId, "Only an admin can reset someone's password.");
	const who = await sql.query("select username from desk_accounts where user_id = $1", [data.userId]);
	if (!who[0]) throw new Error("Account not found");
	await sql.query("delete from desk_password_resets where user_id = $1 and used_at is null", [data.userId]);
	const token = randomToken();
	const rows = await sql.query(`insert into desk_password_resets (user_id, token_hash, created_by, expires_at)
       values ($1, $2, $3, now() + ($4 || ' hours')::interval)
       returning expires_at`, [
		data.userId,
		await sha256(token),
		context.userId,
		String(RESET_HOURS)
	]);
	return {
		token,
		username: who[0].username,
		expiresAt: String(rows[0]?.expires_at ?? "")
	};
});
var peekPasswordReset_createServerFn_handler = createServerRpc({
	id: "a1eea0f261dbf54c8d5b860870221ef0914f3b36ea52c21af2422033a4d82c9a",
	name: "peekPasswordReset",
	filename: "src/lib/ops/password-reset.ts"
}, (opts) => peekPasswordReset.__executeServer(opts));
var peekPasswordReset = createServerFn({ method: "POST" }).validator((d) => d).handler(peekPasswordReset_createServerFn_handler, async ({ data }) => {
	const token = data.token?.trim();
	if (!token) return {
		ok: false,
		username: null
	};
	const rows = await (await getSql()).query(`select a.username
       from desk_password_resets r
       left join desk_accounts a on a.user_id = r.user_id
       where r.token_hash = $1 and r.used_at is null and r.expires_at > now()`, [await sha256(token)]);
	return rows[0] ? {
		ok: true,
		username: rows[0].username ?? null
	} : {
		ok: false,
		username: null
	};
});
var resetPasswordWithToken_createServerFn_handler = createServerRpc({
	id: "dc40380b82c74cdab678224c0f0313a897ae8fa2b1f75bcfc784e18f54a54492",
	name: "resetPasswordWithToken",
	filename: "src/lib/ops/password-reset.ts"
}, (opts) => resetPasswordWithToken.__executeServer(opts));
var resetPasswordWithToken = createServerFn({ method: "POST" }).validator((d) => d).handler(resetPasswordWithToken_createServerFn_handler, async ({ data }) => {
	const problem = passwordProblem(data.password ?? "");
	if (problem) throw new Error(problem);
	const sql = await getSql();
	const tokenHash = await sha256((data.token ?? "").trim());
	const hit = (await sql.query(`select id, user_id from desk_password_resets
       where token_hash = $1 and used_at is null and expires_at > now()`, [tokenHash]))[0];
	if (!hit) throw new Error("This reset link has expired or was already used. Ask an admin for a new one.");
	const { hashPassword } = await import("./crypto-QVkT-fgq.mjs").then((n) => n.t).then((n) => n.t);
	const hashed = await hashPassword(data.password);
	if (!(await sql.query(`update "account" set "password" = $2, "updatedAt" = now()
       where "userId" = $1 and "providerId" = 'credential'
       returning "id"`, [hit.user_id, hashed]))[0]) await sql.query(`insert into "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
         values ($1, $2, 'credential', $2, $3, now(), now())`, [
		randomToken().slice(0, 32),
		hit.user_id,
		hashed
	]);
	await sql.query("update desk_password_resets set used_at = now() where id = $1", [hit.id]);
	await sql.query(`delete from "session" where "userId" = $1`, [hit.user_id]);
	const who = await sql.query(`select d.username, u.email from "user" u left join desk_accounts d on d.user_id = u.id where u.id = $1`, [hit.user_id]);
	return {
		username: who[0]?.username ?? null,
		email: who[0]?.email ?? null
	};
});
//#endregion
export { createPasswordResetLink_createServerFn_handler, peekPasswordReset_createServerFn_handler, resetPasswordWithToken_createServerFn_handler };
