import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn, t as authMiddleware } from "./flag-DVQH6hUb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access--HZYvlgN.js
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
async function adminCount(sql) {
	const rows = await sql.query("select count(*)::int as n from desk_accounts where approved = true and is_admin = true");
	return Number(rows[0]?.n ?? 0);
}
async function realAdminCount(sql) {
	return (await sql.query("select username from desk_accounts where approved = true and is_admin = true")).filter((r) => !isSandboxQa(r.username)).length;
}
async function shouldBootstrapAdmin(sql, username) {
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
	if (v === "sales" || v === "service" || v === "warehouse") return v;
	return null;
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
var INVITE_COLS = "id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers, token, expires_at, display_name";
function inviteExpiry() {
	return new Date(Date.now() + 12096e5);
}
function inviteExpired(row) {
	if (row.status === "revoked") return true;
	if (!row.expires_at) return false;
	return new Date(row.expires_at).getTime() < Date.now();
}
function inviteState(row) {
	if (row.status === "accepted") return "active";
	if (inviteExpired(row)) return "expired";
	return "invited";
}
function slugUsername(raw) {
	return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 32);
}
function newInviteToken() {
	const bytes = /* @__PURE__ */ new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
		canAddCustomers: !!row.can_add_customers,
		token: row.token ?? "",
		expiresAt: row.expires_at ? String(row.expires_at) : null,
		displayName: row.display_name ?? null,
		state: inviteState(row)
	};
}
async function findPendingInvite(sql, email, username) {
	const emailNorm = normEmail(email);
	const userNorm = username?.trim().toLowerCase() || null;
	if (!emailNorm && !userNorm) return void 0;
	return (await sql.query(`select ${INVITE_COLS}
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
	if (!(await sql.query(`update desk_accounts
     set approved = true,
         denied = false,
         email = coalesce(email, $3),
         can_add_customers = can_add_customers or $2,
         desk_role = case
           when is_admin then desk_role
           when desk_role is null or btrim(desk_role) = '' then 'service'
           else desk_role
         end,
         updated_at = now()
     where user_id = $1
     returning user_id`, [
		userId,
		!!invite.can_add_customers,
		normEmail(invite.email)
	]))[0]) return false;
	await consumeInvite(sql, invite.id, userId);
	return true;
}
async function accountsForInvite(sql, email, username) {
	return sql.query(`select d.user_id, d.username
       from desk_accounts d
       left join "user" u on u.id = d.user_id
      where (
        ($1::text is not null and (
          (d.email is not null and lower(d.email) = $1)
          or (u.email is not null and lower(u.email) = $1)
        ))
        or ($2::text is not null and lower(d.username) = $2)
      )`, [normEmail(email), username?.trim().toLowerCase() || null]);
}
async function findInviteByToken(sql, token) {
	const row = (await sql.query(`select ${INVITE_COLS} from desk_invites where token = $1 limit 1`, [token]))[0];
	if (!row || row.status !== "pending") return void 0;
	if (inviteExpired(row)) throw new Error("This invite expired. Ask an admin to resend it.");
	return row;
}
/** Whoever holds the invite link gets in, even if Google/X email does not match. */
async function claimInviteToken(sql, userId, token) {
	const invite = await findInviteByToken(sql, token);
	if (!invite) return false;
	const me = await loadAccess(sql, userId);
	if (!me) return false;
	if (flagOn(me.approved) && !flagOn(me.denied)) {
		const email = normEmail(me.email);
		if (!(!!invite.email && !!email && normEmail(invite.email) === email || !!invite.username && invite.username.toLowerCase() === me.username.toLowerCase())) return false;
	}
	if (!await grantInviteAccess(sql, userId, invite)) return false;
	const name = invite.username ? cleanUsername(invite.username) : "";
	if (validUsername(name) && !flagOn(me.username_chosen)) {
		if (!(await sql.query("select user_id from desk_accounts where lower(username) = $1 and user_id <> $2 limit 1", [name.toLowerCase(), userId]))[0]) await sql.query(`update desk_accounts
         set username = $2, username_chosen = true, updated_at = now()
         where user_id = $1`, [userId, name]);
	}
	return true;
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
	const first = await shouldBootstrapAdmin(sql, username);
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
	const pending = await sql.query(`select ${INVITE_COLS} from desk_invites where status = 'pending'`);
	for (const inv of pending) {
		if (inviteExpired(inv)) continue;
		const matches = await accountsForInvite(sql, inv.email, inv.username);
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
	const me = await sql.query("select is_admin from desk_accounts where user_id = $1", [userId]);
	if (!flagOn(me[0]?.is_admin)) throw new Error(message ?? "Only an admin can review accounts.");
}
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
	const raw = data.username.trim();
	if (!raw) throw new Error("Enter your username or email");
	const sql = await getSql();
	await ensureTable(sql);
	const emailNorm = raw.includes("@") ? normEmail(raw) : null;
	const userNorm = emailNorm ? null : cleanUsername(raw).toLowerCase();
	const row = (await sql.query(`select d.user_id, d.email, u.email as auth_email, d.approved, d.denied
         from desk_accounts d
         left join "user" u on u.id = d.user_id
       where (
           ($1::text is not null and (
             (d.email is not null and lower(d.email) = $1) or (u.email is not null and lower(u.email) = $1)
           ))
           or ($2::text is not null and lower(d.username) = $2)
         )
       limit 1`, [emailNorm, userNorm]))[0];
	if (row) {
		if (row.denied) {
			if (!await findPendingInvite(sql, emailNorm ?? raw, userNorm)) throw new Error("This account was denied access.");
		}
		const email = row.auth_email ?? row.email;
		if (!email) throw new Error("This account has no email on file. Ask an admin to invite you again.");
		const methods = (await sql.query(`select distinct "providerId" from "account" where "userId" = $1`, [row.user_id])).map((l) => l.providerId === "credential" ? "password" : l.providerId.toLowerCase());
		return {
			email,
			waiting: !row.approved && !row.denied,
			methods
		};
	}
	const invite = await findPendingInvite(sql, emailNorm ?? raw, userNorm);
	if (invite) return {
		email: invite.email || emailNorm || "",
		invited: true
	};
	throw new Error("Unknown username. Invited? Create an account with that email or username.");
});
var peekInvite_createServerFn_handler = createServerRpc({
	id: "e05fae23059afc9524cd7006566d3660d6e4e2f8e952866a6a0056267e182f6a",
	name: "peekInvite",
	filename: "src/lib/ops/access.ts"
}, (opts) => peekInvite.__executeServer(opts));
var peekInvite = createServerFn({ method: "POST" }).validator((d) => d).handler(peekInvite_createServerFn_handler, async ({ data }) => {
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
var getMyAccess_createServerFn_handler = createServerRpc({
	id: "1e76910bf98a3daeaebec03779f138bb00c8e750fd47ea60c7b94abbc3536e90",
	name: "getMyAccess",
	filename: "src/lib/ops/access.ts"
}, (opts) => getMyAccess.__executeServer(opts));
var getMyAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getMyAccess_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	const fresh = await ensureDeskAccount(sql, context.userId);
	const profile = await loadUser(sql, context.userId);
	if (await shouldBootstrapAdmin(sql, fresh.username) && (!fresh.approved || !fresh.is_admin)) {
		const promoted = await promoteAdmin(sql, context.userId, profile.email);
		const { canUserEditRoster } = await import("./roster-B3a8030i.mjs").then((n) => n.a);
		const canEdit = await canUserEditRoster(sql, context.userId);
		return {
			...promoted,
			canEditRoster: canEdit,
			canAssignRoles: canEdit
		};
	}
	const mapped = mapAccess(await loadAccess(sql, context.userId) ?? fresh);
	const { canUserEditRoster } = await import("./roster-B3a8030i.mjs").then((n) => n.a);
	const canEdit = await canUserEditRoster(sql, context.userId);
	return {
		...mapped,
		canEditRoster: canEdit,
		canAssignRoles: canEdit
	};
});
var claimInvite_createServerFn_handler = createServerRpc({
	id: "63f131a91c65df7c685474b7274437f0a38d7ecc2e8a5fda7460a20345e3664c",
	name: "claimInvite",
	filename: "src/lib/ops/access.ts"
}, (opts) => claimInvite.__executeServer(opts));
var claimInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(claimInvite_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await ensureDeskAccount(sql, context.userId);
	const token = data.token?.trim() || "";
	if (token) await claimInviteToken(sql, context.userId, token);
	const fresh = await loadAccess(sql, context.userId);
	if (!fresh) throw new Error("Account not found");
	return mapAccess(fresh);
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
	const email = normEmail(data.email) || normEmail(profile.email);
	const token = data.token?.trim() || "";
	const invite = (token ? await findInviteByToken(sql, token) : void 0) ?? await findPendingInvite(sql, email, username);
	const invited = !!invite;
	const first = await shouldBootstrapAdmin(sql, username);
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
               desk_role = case
                 when is_admin or $5 then desk_role
                 when $4 and (desk_role is null or btrim(desk_role) = '') then 'service'
                 else desk_role
               end,
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
		else row = (await sql.query(`insert into desk_accounts (user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied, desk_role)
           values ($1, $2, $3, $4, $5, $6, true, false, $7)
           on conflict (user_id) do update
             set username = excluded.username,
                 email = coalesce(excluded.email, desk_accounts.email),
                 username_chosen = true,
                 approved = desk_accounts.approved or excluded.approved,
                 is_admin = desk_accounts.is_admin or excluded.is_admin,
                 can_add_customers = desk_accounts.can_add_customers or excluded.can_add_customers,
                 denied = case when excluded.approved then false else desk_accounts.denied end,
                 desk_role = case
                   when desk_accounts.is_admin or excluded.is_admin then desk_accounts.desk_role
                   when excluded.approved and (desk_accounts.desk_role is null or btrim(desk_accounts.desk_role) = '') then 'service'
                   else desk_accounts.desk_role
                 end,
                 updated_at = now()
           returning ${ACCESS_COLS}`, [
			context.userId,
			username,
			email,
			approved,
			first,
			canAdd,
			approved && !first ? "service" : null
		]))[0];
		if (invite) await consumeInvite(sql, invite.id, context.userId);
		return mapAccess(row);
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
	await requireAdmin(sql, context.userId);
	await adoptAuthUsers(sql);
	await applyPendingInvites(sql);
	return (await sql.query(`select ${ACCESS_COLS}, created_at from desk_accounts order by created_at desc`)).map((r) => ({
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
var setAccountCanAddCustomers_createServerFn_handler = createServerRpc({
	id: "312d37f1589d16ecdcbdf5b204dbcbdc26d40c2ab5050689f9e097526c238a7f",
	name: "setAccountCanAddCustomers",
	filename: "src/lib/ops/access.ts"
}, (opts) => setAccountCanAddCustomers.__executeServer(opts));
var setAccountCanAddCustomers = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(setAccountCanAddCustomers_createServerFn_handler, async ({ context, data }) => {
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
var setAccountRole_createServerFn_handler = createServerRpc({
	id: "12a794f25eedc091fcc01b69c8afc2fa2556f959485701d3426296bd1de6f841",
	name: "setAccountRole",
	filename: "src/lib/ops/access.ts"
}, (opts) => setAccountRole.__executeServer(opts));
var setAccountRole = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(setAccountRole_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	const { canUserEditRoster } = await import("./roster-B3a8030i.mjs").then((n) => n.a);
	if (!await canUserEditRoster(sql, context.userId)) throw new Error("Only the desk owner can set a user’s role.");
	const role = data.role === "sales" || data.role === "service" || data.role === "warehouse" ? data.role : null;
	const rows = await sql.query(`update desk_accounts
          set desk_role = $2, updated_at = now()
        where user_id = $1
        returning ${ACCESS_COLS}`, [data.userId, role]);
	if (!rows[0]) throw new Error("Account not found");
	return mapAccess(rows[0], true);
});
var grantAllCanAddCustomers_createServerFn_handler = createServerRpc({
	id: "5d5dd28faae9fab46aaaf3d96465e9b2b1524240b1cdfcf1959debccb5bceea6",
	name: "grantAllCanAddCustomers",
	filename: "src/lib/ops/access.ts"
}, (opts) => grantAllCanAddCustomers.__executeServer(opts));
var grantAllCanAddCustomers = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(grantAllCanAddCustomers_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	return { updated: (await sql.query(`update desk_accounts
       set can_add_customers = true, updated_at = now()
       where approved = true and denied = false and can_add_customers = false
       returning user_id`)).length };
});
var denyAccount_createServerFn_handler = createServerRpc({
	id: "bcbd53d274f00bf8475319f64be83a5f2836af89d7875c42409365ad7d02d632",
	name: "denyAccount",
	filename: "src/lib/ops/access.ts"
}, (opts) => denyAccount.__executeServer(opts));
var denyAccount = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(denyAccount_createServerFn_handler, async ({ context, data }) => {
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
var listDeskInvites_createServerFn_handler = createServerRpc({
	id: "96b964ccada664131e89643fc6b11b1706175dac83156dd8dca0563b06a07e5c",
	name: "listDeskInvites",
	filename: "src/lib/ops/access.ts"
}, (opts) => listDeskInvites.__executeServer(opts));
var listDeskInvites = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listDeskInvites_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	await adoptAuthUsers(sql);
	await applyPendingInvites(sql);
	const rows = await sql.query(`select ${INVITE_COLS}
       from desk_invites
       where status in ('pending', 'revoked')
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
var createInvite_createServerFn_handler = createServerRpc({
	id: "d0a57fc171437e25225eb204997c8dfd57ffe636970a048a22ff3ac09d0ecf93",
	name: "createInvite",
	filename: "src/lib/ops/access.ts"
}, (opts) => createInvite.__executeServer(opts));
var createInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createInvite_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	const email = data.email?.trim() ? normEmail(data.email) : null;
	const rawName = (data.username ?? "").trim();
	const displayName = rawName || null;
	const user = (rawName ? validUsername(rawName) ? cleanUsername(rawName) : slugUsername(rawName) : "") || null;
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
	if (!dup && displayName) {
		const byName = await sql.query(`select ${INVITE_COLS} from desk_invites
         where status = 'pending'
           and (
             lower(coalesce(display_name, '')) = lower($1)
             or replace(lower(coalesce(username, '')), '.', '') = $2
           )
         order by created_at asc
         limit 1`, [displayName, displayName.toLowerCase().replace(/[^a-z0-9]/g, "")]);
		if (byName[0] && !inviteExpired(byName[0])) {
			const invitedBy = await loadInviterName(sql, byName[0].invited_by);
			return {
				invite: mapInvite(byName[0], invitedBy),
				autoApproved: []
			};
		}
	}
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
	const inviteRow = (await sql.query(`insert into desk_invites (email, username, invited_by, status, can_add_customers, token, expires_at, display_name)
       values ($1, $2, $3, 'pending', $4, $5, $6, $7)
       returning ${INVITE_COLS}`, [
		email,
		user,
		context.userId,
		canAdd,
		newInviteToken(),
		inviteExpiry().toISOString(),
		displayName
	]))[0];
	const waiting = await accountsForInvite(sql, email, user);
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
var resendInvite_createServerFn_handler = createServerRpc({
	id: "9c292e35364419fb8a3cdeb3000743a246026d456d7c0ed4089a6f7e578a24f6",
	name: "resendInvite",
	filename: "src/lib/ops/access.ts"
}, (opts) => resendInvite.__executeServer(opts));
var resendInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(resendInvite_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	await requireAdmin(sql, context.userId);
	const rows = await sql.query(`update desk_invites
       set status = 'pending',
           token = $2,
           expires_at = $3,
           accepted_user_id = null,
           updated_at = now()
       where id = $1 and status in ('pending', 'revoked')
       returning ${INVITE_COLS}`, [
		data.id,
		newInviteToken(),
		inviteExpiry().toISOString()
	]);
	if (!rows[0]) throw new Error("Invite not found.");
	const invitedBy = await loadInviterName(sql, rows[0].invited_by);
	return mapInvite(rows[0], invitedBy);
});
var revokeInvite_createServerFn_handler = createServerRpc({
	id: "a604085f737e13d9d322b581973ce524189981a7225ef787326d594c0df45acf",
	name: "revokeInvite",
	filename: "src/lib/ops/access.ts"
}, (opts) => revokeInvite.__executeServer(opts));
var revokeInvite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(revokeInvite_createServerFn_handler, async ({ context, data }) => {
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
export { checkUsername_createServerFn_handler, claimInvite_createServerFn_handler, createInvite_createServerFn_handler, denyAccount_createServerFn_handler, getMyAccess_createServerFn_handler, grantAllCanAddCustomers_createServerFn_handler, listDeskAccounts_createServerFn_handler, listDeskInvites_createServerFn_handler, lookupSignIn_createServerFn_handler, peekInvite_createServerFn_handler, registerAccount_createServerFn_handler, resendInvite_createServerFn_handler, revokeInvite_createServerFn_handler, setAccountApproved_createServerFn_handler, setAccountCanAddCustomers_createServerFn_handler, setAccountRole_createServerFn_handler };
