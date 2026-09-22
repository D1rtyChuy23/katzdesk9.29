import { n as createServerFn, t as createMiddleware } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { r as getSql } from "./popup.server.mjs";
//#region src/lib/auth/middleware.ts
/**
* Auth middleware for server functions — the standard way to get the caller's
* verified user id. When deployed the session cookie is same-origin and rides
* along automatically. In the live preview the client also forwards the bearer
* token (partitioned cookies) via the `.client` hook below — call sites do not
* thread it themselves.
*
*   import { createServerFn } from "@tanstack/react-start";
*   import { getSql } from "@/lib/db";
*   import { authMiddleware } from "@/lib/auth/middleware";
*
*   export const listTodos = createServerFn({ method: "GET" })
*     .middleware([authMiddleware])
*     .handler(async ({ context }) => {
*       const sql = await getSql();
*       return sql`select * from todos where user_id = ${context.userId}`;
*     });
*
* Signed out (auth on — the default, including live preview) -> throws
* `UnauthorizedError` (see `verify.server.ts`). Only when auth is explicitly
* disabled (`VITE_AUTH_ENABLED=false`) does it resolve the shared dev user and
* never throw. Use it on every server function that touches per-user data, and
* scope every query by `context.userId`.
*/
var authMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
	const { getBearerToken } = await import("./client.mjs").then((n) => n.n);
	return next({ sendContext: { bearerToken: getBearerToken() ?? void 0 } });
}).server(async ({ next, context }) => {
	const { assertSameSiteRequest } = await import("./isolation.server.mjs");
	const { requireUserId } = await import("./verify.server.mjs");
	assertSameSiteRequest();
	return next({ context: { userId: await requireUserId(context.bearerToken) } });
});
//#endregion
//#region src/lib/ops/access.ts
var ACCESS_COLS = "user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied, desk_role";
function cleanUsername(raw) {
	return raw.trim().replace(/\s+/g, "");
}
function validUsername(raw) {
	return /^[a-zA-Z0-9._-]{3,32}$/.test(raw);
}
function validEmail(raw) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}
function normEmail(raw) {
	return (raw?.trim().toLowerCase() ?? "") || null;
}
/** Playwright / sandbox probe accounts — they must not steal the live owner's admin seat. */
function isSandboxQa(username) {
	return /^qa[._-]/i.test(username);
}
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
/** @deprecated use isLiveDeskOwner */
function isDeskOwner(username, name, email) {
	return isLiveDeskOwner(username, name, email);
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
async function loadUser(sql, userId) {
	const rows = await sql.query(`select name, email from "user" where id = $1 limit 1`, [userId]);
	return {
		name: rows[0]?.name ?? "user",
		email: rows[0]?.email ?? null
	};
}
function parseRole(value) {
	const v = String(value ?? "").trim().toLowerCase();
	if (v === "sales" || v === "service") return v;
	return null;
}
function flagOn(value) {
	return value === true || value === 1 || value === "t" || value === "true" || value === "1";
}
function mapAccess(row, canEditRoster = false) {
	const usernameChosen = flagOn(row.username_chosen);
	const isAdmin = flagOn(row.is_admin);
	return {
		userId: row.user_id,
		username: row.username,
		email: row.email,
		approved: flagOn(row.approved),
		isAdmin,
		canAddCustomers: isAdmin || flagOn(row.can_add_customers),
		canEditRoster,
		canAssignRoles: canEditRoster,
		role: parseRole(row.desk_role),
		usernameChosen,
		needsUsername: !usernameChosen,
		denied: flagOn(row.denied)
	};
}
function isUniqueUsernameError(e) {
	const msg = e instanceof Error ? e.message : String(e);
	return /unique|duplicate key/i.test(msg);
}
async function loadAccess(sql, userId) {
	return (await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [userId]))[0];
}
async function loadInviterName(sql, userId) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username ?? "admin";
}
function mapInvite(row, invitedBy) {
	return {
		id: Number(row.id),
		email: row.email,
		username: row.username,
		invitedBy,
		status: row.status,
		createdAt: String(row.created_at),
		canAddCustomers: !!row.can_add_customers
	};
}
async function findPendingInvite(sql, email, username) {
	const emailNorm = normEmail(email);
	const userNorm = username?.trim().toLowerCase() || null;
	if (!emailNorm && !userNorm) return void 0;
	return (await sql.query(`select id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers
     from desk_invites
     where status = 'pending'
       and (
         ($1::text is not null and email is not null and lower(email) = $1)
         or ($2::text is not null and username is not null and lower(username) = $2)
       )
     order by created_at asc
     limit 1`, [emailNorm, userNorm]))[0];
}
async function consumeInvite(sql, inviteId, userId) {
	await sql.query(`update desk_invites
     set status = 'accepted', accepted_user_id = $2, updated_at = now()
     where id = $1 and status = 'pending'`, [inviteId, userId]);
}
async function grantInviteAccess(sql, userId, invite) {
	await sql.query(`update desk_accounts
     set approved = true,
         denied = false,
         can_add_customers = can_add_customers or $2,
         updated_at = now()
     where user_id = $1`, [userId, !!invite.can_add_customers]);
	await consumeInvite(sql, invite.id, userId);
}
async function uniqueStubUsername(sql, raw) {
	let base = cleanUsername(raw).replace(/[^a-zA-Z0-9._-]/g, "");
	if (base.length > 32) base = base.slice(0, 32);
	if (base.length < 3) base = `user${base}`.slice(0, 32);
	if (!validUsername(base)) base = "user";
	for (let i = 0; i < 40; i++) {
		const suffix = i === 0 ? "" : String(i + 1);
		const name = `${base.slice(0, 32 - suffix.length)}${suffix}`;
		if (!(await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [name.toLowerCase()]))[0]) return name;
	}
	return `user${Date.now().toString(36)}`.slice(0, 32);
}
async function ensureDeskAccount(sql, userId) {
	const existing = await loadAccess(sql, userId);
	const profile = await loadUser(sql, userId);
	const email = normEmail(profile.email);
	if (existing) {
		if (email && !existing.email) await sql.query("update desk_accounts set email = $2, updated_at = now() where user_id = $1 and email is null", [userId, email]);
		await applyInviteIfAny(sql, userId, email ?? existing.email, existing.username);
		return await loadAccess(sql, userId) ?? existing;
	}
	const invite = await findPendingInvite(sql, email, null);
	const username = await uniqueStubUsername(sql, invite?.username || email?.split("@")[0] || profile.name || "user");
	const first = await shouldBootstrapAdmin(sql, username, profile.name, email);
	const invited = !!invite;
	const rows = await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied)
     values ($1, $2, $3, $4, $5, $6, false, false)
     on conflict (user_id) do update
       set email = coalesce(excluded.email, desk_accounts.email),
           approved = desk_accounts.approved or excluded.approved,
           is_admin = desk_accounts.is_admin or excluded.is_admin,
           can_add_customers = desk_accounts.can_add_customers or excluded.can_add_customers,
           updated_at = now()
     returning ${ACCESS_COLS}`, [
		userId,
		username,
		email,
		first || invited,
		first,
		true
	]);
	if (invite) await consumeInvite(sql, invite.id, userId);
	return rows[0];
}
async function adoptAuthUsers(sql) {
	const orphans = await sql.query(`select u.id
       from "user" u
       left join desk_accounts d on d.user_id = u.id
      where d.user_id is null`);
	for (const row of orphans) try {
		await ensureDeskAccount(sql, row.id);
	} catch {}
}
async function applyPendingInvites(sql) {
	const pending = await sql.query(`select id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers
     from desk_invites where status = 'pending'`);
	for (const inv of pending) {
		const matches = await sql.query(`select user_id from desk_accounts
       where (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )`, [normEmail(inv.email), inv.username?.trim().toLowerCase() || null]);
		for (const m of matches) await grantInviteAccess(sql, m.user_id, inv);
	}
}
async function applyInviteIfAny(sql, userId, email, username) {
	const invite = await findPendingInvite(sql, email, username);
	if (!invite) return false;
	await grantInviteAccess(sql, userId, invite);
	return true;
}
async function promoteAdmin(sql, userId, email) {
	const rows = await sql.query(`update desk_accounts
     set approved = true,
         is_admin = true,
         denied = false,
         email = coalesce($2, email),
         updated_at = now()
     where user_id = $1
     returning ${ACCESS_COLS}`, [userId, email ?? null]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
}
async function requireAdmin(sql, userId, message) {
	if (!flagOn((await sql.query("select is_admin from desk_accounts where user_id = $1", [userId]))[0]?.is_admin)) throw new Error(message ?? "Only an admin can review accounts.");
}
/** Reject unapproved sessions before any ops query. Used by deskMiddleware. */
async function assertApproved(userId) {
	const sql = await getSql();
	await ensureTable(sql);
	if (!flagOn((await loadAccess(sql, userId))?.approved)) throw new Error("This account is waiting for approval.");
}
/** Auth + approved desk account. Use on every ops/notify server function. */
var deskMiddleware = createMiddleware({ type: "function" }).middleware([authMiddleware]).server(async ({ next, context }) => {
	await assertApproved(context.userId);
	return next();
});
var checkUsername = createServerFn({ method: "POST" }).validator((d) => d).handler(async ({ data }) => {
	const username = cleanUsername(data.username);
	if (!validUsername(username)) return { available: false };
	const sql = await getSql();
	await ensureTable(sql);
	return { available: !(await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]))[0] };
});
var lookupSignIn = createServerFn({ method: "POST" }).validator((d) => d).handler(async ({ data }) => {
	const raw = data.username.trim();
	if (!raw) throw new Error("Enter your username or email");
	const sql = await getSql();
	await ensureTable(sql);
	const emailNorm = raw.includes("@") ? normEmail(raw) : null;
	const userNorm = emailNorm ? null : cleanUsername(raw).toLowerCase();
	const row = (await sql.query(`select email, approved, denied from desk_accounts
       where (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )
       limit 1`, [emailNorm, userNorm]))[0];
	if (row) {
		if (row.denied) throw new Error("This account was denied access.");
		if (!row.email) throw new Error("This account has no email on file. Ask an admin to invite you again.");
		return {
			email: row.email,
			waiting: !row.approved
		};
	}
	const invite = await findPendingInvite(sql, emailNorm ?? raw, userNorm);
	if (invite) return {
		email: invite.email || emailNorm || "",
		invited: true
	};
	throw new Error("Unknown username. Invited? Create an account with that email or username.");
});
var peekInvite = createServerFn({ method: "POST" }).validator((d) => d).handler(async ({ data }) => {
	const raw = data.identity.trim();
	const sql = await getSql();
	await ensureTable(sql);
	const emailNorm = raw.includes("@") ? normEmail(raw) : null;
	const userNorm = emailNorm ? null : cleanUsername(raw);
	const invite = await findPendingInvite(sql, emailNorm ?? raw, userNorm);
	if (!invite) return {
		invited: false,
		email: null,
		username: null
	};
	return {
		invited: true,
		email: invite.email,
		username: invite.username
	};
});
var getMyAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	const fresh = await ensureDeskAccount(sql, context.userId);
	const profile = await loadUser(sql, context.userId);
	if (await shouldBootstrapAdmin(sql, fresh.username, profile.name, profile.email ?? fresh.email) && (!fresh.approved || !fresh.is_admin)) {
		const promoted = await promoteAdmin(sql, context.userId, profile.email);
		const { canUserEditRoster } = await import("./roster.mjs").then((n) => n.a);
		const canEdit = await canUserEditRoster(sql, context.userId);
		return {
			...promoted,
			canEditRoster: canEdit,
			canAssignRoles: canEdit
		};
	}
	const mapped = mapAccess(await loadAccess(sql, context.userId) ?? fresh);
	const { canUserEditRoster } = await import("./roster.mjs").then((n) => n.a);
	const canEdit = await canUserEditRoster(sql, context.userId);
	return {
		...mapped,
		canEditRoster: canEdit,
		canAssignRoles: canEdit
	};
});
var registerAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const username = cleanUsername(data.username);
	if (!validUsername(username)) throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
	const sql = await getSql();
	await ensureTable(sql);
	const taken = await sql.query("select user_id from desk_accounts where lower(username) = $1 limit 1", [username.toLowerCase()]);
	if (taken[0] && taken[0].user_id !== context.userId) throw new Error("That username is already taken.");
	const profile = await loadUser(sql, context.userId);
	const email = normEmail(data.email) || normEmail(profile.email);
	const invite = await findPendingInvite(sql, email, username);
	const invited = !!invite;
	const first = await shouldBootstrapAdmin(sql, username, profile.name, email);
	const approved = first || invited;
	const canAdd = true;
	const existing = await loadAccess(sql, context.userId);
	try {
		let row;
		if (existing) row = (await sql.query(`update desk_accounts
           set username = $2,
               email = coalesce($3, email),
               username_chosen = true,
               approved = approved or $4,
               is_admin = is_admin or $5,
               can_add_customers = can_add_customers or $6,
               denied = case when $4 then false else denied end,
               updated_at = now()
           where user_id = $1
           returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			email,
			approved,
			first,
			canAdd
		]))[0] ?? {
			...existing,
			username,
			email: email ?? existing.email,
			username_chosen: true,
			approved: existing.approved || approved,
			is_admin: existing.is_admin || first,
			can_add_customers: existing.can_add_customers || canAdd
		};
		else row = (await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied)
           values ($1, $2, $3, $4, $5, $6, true, false)
           on conflict (user_id) do update
             set username = excluded.username,
                 email = coalesce(excluded.email, desk_accounts.email),
                 username_chosen = true,
                 approved = desk_accounts.approved or excluded.approved,
                 is_admin = desk_accounts.is_admin or excluded.is_admin,
                 can_add_customers = desk_accounts.can_add_customers or excluded.can_add_customers,
                 denied = case when excluded.approved then false else desk_accounts.denied end,
                 updated_at = now()
           returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			email,
			approved,
			first,
			canAdd
		]))[0];
		if (invite) await consumeInvite(sql, invite.id, context.userId);
		return mapAccess(row);
	} catch (e) {
		if (isUniqueUsernameError(e)) throw new Error("That username is already taken.");
		throw e;
	}
});
var listDeskAccounts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	await adoptAuthUsers(sql);
	await applyPendingInvites(sql);
	return (await sql.query(`select ${ACCESS_COLS}, created_at from desk_accounts order by created_at desc`)).map((r) => ({
		...mapAccess(r),
		createdAt: String(r.created_at)
	}));
});
var setAccountApproved = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	if (data.userId === context.userId && !data.approved) throw new Error("You cannot revoke your own access.");
	await sql.query(`update desk_accounts
       set approved = $2,
           denied = case when $2 then false else denied end,
           can_add_customers = case when $2 then true else can_add_customers end,
           updated_at = now()
       where user_id = $1`, [data.userId, data.approved]);
	const rows = await sql.query(`select ${ACCESS_COLS} from desk_accounts where user_id = $1`, [data.userId]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
});
var setAccountCanAddCustomers = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	const target = await loadAccess(sql, data.userId);
	if (!target) throw new Error("Account not found");
	if (target.is_admin && !data.canAddCustomers) throw new Error("Admins can always add customers.");
	const rows = await sql.query(`update desk_accounts
       set can_add_customers = $2, updated_at = now()
       where user_id = $1
       returning ${ACCESS_COLS}`, [data.userId, data.canAddCustomers]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
});
var setAccountRole = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	const { canUserEditRoster } = await import("./roster.mjs").then((n) => n.a);
	if (!await canUserEditRoster(sql, context.userId)) throw new Error("Only the desk owner can set a user’s role.");
	const role = data.role === "sales" || data.role === "service" ? data.role : null;
	const rows = await sql.query(`update desk_accounts
          set desk_role = $2, updated_at = now()
        where user_id = $1
        returning ${ACCESS_COLS}`, [data.userId, role]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0], true);
});
var grantAllCanAddCustomers = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	return { updated: (await sql.query(`update desk_accounts
       set can_add_customers = true, updated_at = now()
       where approved = true and denied = false and can_add_customers = false
       returning user_id`)).length };
});
var denyAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	if (data.userId === context.userId) throw new Error("You cannot deny your own access.");
	const target = await loadAccess(sql, data.userId);
	if (!target) throw new Error("Account not found");
	const rows = await sql.query(`update desk_accounts
       set approved = false, denied = true, updated_at = now()
       where user_id = $1
       returning ${ACCESS_COLS}`, [data.userId]);
	await sql.query(`update desk_invites
       set status = 'revoked', updated_at = now()
       where status = 'pending'
         and (
           (email is not null and $1::text is not null and lower(email) = $1)
           or (username is not null and lower(username) = $2)
         )`, [normEmail(target.email), target.username.toLowerCase()]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0]);
});
var listDeskInvites = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	await adoptAuthUsers(sql);
	await applyPendingInvites(sql);
	const rows = await sql.query(`select id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers
       from desk_invites
       where status = 'pending'
       order by created_at desc`);
	const names = /* @__PURE__ */ new Map();
	const out = [];
	for (const row of rows) {
		let name = names.get(row.invited_by);
		if (!name) {
			name = await loadInviterName(sql, row.invited_by);
			names.set(row.invited_by, name);
		}
		out.push(mapInvite(row, name));
	}
	return out;
});
var createInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	const email = data.email?.trim() ? normEmail(data.email) : null;
	const user = (data.username ? cleanUsername(data.username) : "") || null;
	const canAdd = !!data.canAddCustomers;
	if (!email && !user) throw new Error("Enter an email, a username, or both.");
	if (email && !validEmail(email)) throw new Error("Enter a valid email address.");
	if (user && !validUsername(user)) throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
	await adoptAuthUsers(sql);
	const already = await sql.query(`select username from desk_accounts
       where approved = true
         and (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )`, [normEmail(email), user?.toLowerCase() ?? null]);
	if (already[0]) throw new Error(`${already[0].username} already has access. Grant “add customers” on their account below.`);
	const dup = await findPendingInvite(sql, email, user);
	if (dup) {
		if (canAdd && !dup.can_add_customers) {
			await sql.query(`update desk_invites set can_add_customers = true, updated_at = now() where id = $1`, [dup.id]);
			dup.can_add_customers = true;
		}
		return {
			invite: mapInvite(dup, await loadInviterName(sql, dup.invited_by)),
			autoApproved: []
		};
	}
	const inviteRow = (await sql.query(`insert into desk_invites (email, username, invited_by, status, can_add_customers)
       values ($1, $2, $3, 'pending', $4)
       returning id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers`, [
		email,
		user,
		context.userId,
		canAdd
	]))[0];
	const waiting = await sql.query(`select user_id, username from desk_accounts
       where (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )`, [normEmail(email), user?.toLowerCase() ?? null]);
	const autoApproved = [];
	for (const w of waiting) {
		await grantInviteAccess(sql, w.user_id, inviteRow);
		autoApproved.push(w.username);
	}
	const invitedBy = await loadInviterName(sql, context.userId);
	return {
		invite: mapInvite(autoApproved.length ? {
			...inviteRow,
			status: "accepted",
			accepted_user_id: waiting[0]?.user_id ?? null
		} : inviteRow, invitedBy),
		autoApproved
	};
});
var revokeInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	if (!(await sql.query(`update desk_invites
       set status = 'revoked', updated_at = now()
       where id = $1 and status = 'pending'
       returning id`, [data.id]))[0]) throw new Error("Invite not found.");
	return { ok: true };
});
//#endregion
export { setAccountRole as _, getMyAccess as a, listDeskAccounts as c, peekInvite as d, registerAccount as f, setAccountCanAddCustomers as g, setAccountApproved as h, deskMiddleware as i, listDeskInvites as l, revokeInvite as m, createInvite as n, grantAllCanAddCustomers as o, requireAdmin as p, denyAccount as r, isLiveDeskOwner as s, checkUsername as t, lookupSignIn as u };
