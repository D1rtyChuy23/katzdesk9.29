import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { flagOn } from "./flag";

export type DeskRole = "sales" | "service" | null;

export type DeskAccess = {
  userId: string;
  username: string;
  email: string | null;
  approved: boolean;
  isAdmin: boolean;
  canAddCustomers: boolean;
  canEditRoster: boolean;
  canAssignRoles: boolean;
  role: DeskRole;
  usernameChosen: boolean;
  needsUsername: boolean;
  denied: boolean;
};


export type DeskAccountRow = DeskAccess & {
  createdAt: string;
};

export type DeskInvite = {
  id: number;
  email: string | null;
  username: string | null;
  invitedBy: string;
  status: string;
  createdAt: string;
  canAddCustomers: boolean;
};

export type InviteResult = {
  invite: DeskInvite;
  autoApproved: string[];
};

const ACCESS_COLS =
  "user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied, desk_role";


function cleanUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function validUsername(raw: string): boolean {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(raw);
}

function validEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function normEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? "";
  return v || null;
}

/** Playwright / sandbox probe accounts — they must not steal the live owner's admin seat. */
function isSandboxQa(username: string): boolean {
  return /^qa[._-]/i.test(username);
}

/** Live desk owner (Chuy). Always an admin, even if a qa.* account claimed first. */
export function isLiveDeskOwner(username: string, name?: string | null, email?: string | null): boolean {
  const u = (username ?? "").toLowerCase();
  const n = (name ?? "").trim().toLowerCase();
  const e = (email ?? "").toLowerCase();
  if (u.includes("d1rtychuy") || n.includes("d1rtychuy") || e.includes("d1rtychuy")) return true;
  if (u === "chuy" || n === "chuy") return true;
  if (/^chuy([._-]|$)/.test(u)) return true;
  return false;
}

/** @deprecated use isLiveDeskOwner */
function isDeskOwner(username: string, name?: string | null, email?: string | null): boolean {
  return isLiveDeskOwner(username, name, email);
}

async function ensureTable(sql: Sql) {
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
  await sql.query(
    "alter table desk_accounts add column if not exists username_chosen boolean not null default false",
  );
  await sql.query(
    "alter table desk_accounts add column if not exists denied boolean not null default false",
  );
  await sql.query(
    "alter table desk_accounts add column if not exists can_add_customers boolean not null default true",
  );
  await sql.query("alter table desk_accounts add column if not exists desk_role text");
  try {
    await sql.query("alter table desk_accounts alter column can_add_customers set default true");
  } catch {
    /* PGlite may already have the default */
  }

  await sql.query(`
    create table if not exists desk_access_flags (
      key text primary key,
      set_at timestamptz not null default now()
    )`);
  const granted = await sql.query<{ key: string }>(
    "select key from desk_access_flags where key = 'add_customers_on' limit 1",
  );
  if (!granted[0]) {
    await sql.query(
      "update desk_accounts set can_add_customers = true where approved = true",
    );
    await sql.query(
      "insert into desk_access_flags (key) values ('add_customers_on') on conflict (key) do nothing",
    );
  }
  await sql.query(
    "create unique index if not exists desk_accounts_username_uidx on desk_accounts (lower(username))",
  );
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
  await sql.query(
    "create index if not exists desk_invites_status_idx on desk_invites (status, created_at desc)",
  );
  await sql.query(
    "create index if not exists desk_invites_email_idx on desk_invites (lower(email))",
  );
  await sql.query(
    "create index if not exists desk_invites_username_idx on desk_invites (lower(username))",
  );
  await sql.query(
    "alter table desk_invites add column if not exists can_add_customers boolean not null default true",
  );
}

async function adminCount(sql: Sql): Promise<number> {
  const rows = await sql.query<{ n: number | string }>(
    "select count(*)::int as n from desk_accounts where approved = true and is_admin = true",
  );
  return Number(rows[0]?.n ?? 0);
}

async function realAdminCount(sql: Sql): Promise<number> {
  const rows = await sql.query<{ username: string }>(
    "select username from desk_accounts where approved = true and is_admin = true",
  );
  return rows.filter((r) => !isSandboxQa(r.username)).length;
}

async function shouldBootstrapAdmin(
  sql: Sql,
  username: string,
  name?: string | null,
  email?: string | null,
): Promise<boolean> {
  if (isDeskOwner(username, name, email)) return true;
  if (isSandboxQa(username)) return (await adminCount(sql)) === 0;
  return (await realAdminCount(sql)) === 0;
}

async function loadUser(sql: Sql, userId: string): Promise<{ name: string; email: string | null }> {
  const rows = await sql.query<{ name: string; email: string | null }>(
    `select name, email from "user" where id = $1 limit 1`,
    [userId],
  );
  return { name: rows[0]?.name ?? "user", email: rows[0]?.email ?? null };
}

type AccessRow = {
  user_id: string;
  username: string;
  email: string | null;
  approved: boolean;
  is_admin: boolean;
  can_add_customers?: boolean;
  username_chosen?: boolean;
  denied?: boolean;
  desk_role?: string | null;
};

function parseRole(value: unknown): DeskRole {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "sales" || v === "service") return v;
  return null;
}

function mapAccess(row: AccessRow, canEditRoster = false): DeskAccess {
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
    denied: flagOn(row.denied),
  };
}


function isUniqueUsernameError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /unique|duplicate key/i.test(msg);
}

async function loadAccess(sql: Sql, userId: string): Promise<AccessRow | undefined> {
  const rows = await sql.query<AccessRow>(
    `select ${ACCESS_COLS} from desk_accounts where user_id = $1`,
    [userId],
  );
  return rows[0];
}

type InviteRow = {
  id: number;
  email: string | null;
  username: string | null;
  invited_by: string;
  status: string;
  accepted_user_id: string | null;
  created_at: string;
  can_add_customers?: boolean;
};

async function loadInviterName(sql: Sql, userId: string): Promise<string> {
  const rows = await sql.query<{ username: string }>(
    "select username from desk_accounts where user_id = $1",
    [userId],
  );
  return rows[0]?.username ?? "admin";
}

function mapInvite(row: InviteRow, invitedBy: string): DeskInvite {
  return {
    id: Number(row.id),
    email: row.email,
    username: row.username,
    invitedBy,
    status: row.status,
    createdAt: String(row.created_at),
    canAddCustomers: !!row.can_add_customers,
  };
}

async function findPendingInvite(
  sql: Sql,
  email: string | null,
  username: string | null,
): Promise<InviteRow | undefined> {
  const emailNorm = normEmail(email);
  const userNorm = username?.trim().toLowerCase() || null;
  if (!emailNorm && !userNorm) return undefined;
  const rows = await sql.query<InviteRow>(
    `select id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers
     from desk_invites
     where status = 'pending'
       and (
         ($1::text is not null and email is not null and lower(email) = $1)
         or ($2::text is not null and username is not null and lower(username) = $2)
       )
     order by created_at asc
     limit 1`,
    [emailNorm, userNorm],
  );
  return rows[0];
}

async function consumeInvite(sql: Sql, inviteId: number, userId: string): Promise<void> {
  await sql.query(
    `update desk_invites
     set status = 'accepted', accepted_user_id = $2, updated_at = now()
     where id = $1 and status = 'pending'`,
    [inviteId, userId],
  );
}

async function grantInviteAccess(sql: Sql, userId: string, invite: InviteRow): Promise<void> {
  await sql.query(
    `update desk_accounts
     set approved = true,
         denied = false,
         can_add_customers = can_add_customers or $2,
         updated_at = now()
     where user_id = $1`,
    [userId, !!invite.can_add_customers],
  );
  await consumeInvite(sql, invite.id, userId);
}

async function uniqueStubUsername(sql: Sql, raw: string): Promise<string> {
  let base = cleanUsername(raw).replace(/[^a-zA-Z0-9._-]/g, "");
  if (base.length > 32) base = base.slice(0, 32);
  if (base.length < 3) base = `user${base}`.slice(0, 32);
  if (!validUsername(base)) base = "user";
  for (let i = 0; i < 40; i++) {
    const suffix = i === 0 ? "" : String(i + 1);
    const name = `${base.slice(0, 32 - suffix.length)}${suffix}`;
    const rows = await sql.query<{ user_id: string }>(
      "select user_id from desk_accounts where lower(username) = $1 limit 1",
      [name.toLowerCase()],
    );
    if (!rows[0]) return name;
  }
  return `user${Date.now().toString(36)}`.slice(0, 32);
}

async function ensureDeskAccount(sql: Sql, userId: string): Promise<AccessRow> {
  const existing = await loadAccess(sql, userId);
  const profile = await loadUser(sql, userId);
  const email = normEmail(profile.email);
  if (existing) {
    if (email && !existing.email) {
      await sql.query(
        "update desk_accounts set email = $2, updated_at = now() where user_id = $1 and email is null",
        [userId, email],
      );
    }
    await applyInviteIfAny(sql, userId, email ?? existing.email, existing.username);
    return (await loadAccess(sql, userId)) ?? existing;
  }
  const invite = await findPendingInvite(sql, email, null);
  const base = invite?.username || email?.split("@")[0] || profile.name || "user";
  const username = await uniqueStubUsername(sql, base);
  const first = await shouldBootstrapAdmin(sql, username, profile.name, email);
  const invited = !!invite;
  const canAdd = true;
  const rows = await sql.query<AccessRow>(
    `insert into desk_accounts (user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied)
     values ($1, $2, $3, $4, $5, $6, false, false)
     on conflict (user_id) do update
       set email = coalesce(excluded.email, desk_accounts.email),
           approved = desk_accounts.approved or excluded.approved,
           is_admin = desk_accounts.is_admin or excluded.is_admin,
           can_add_customers = desk_accounts.can_add_customers or excluded.can_add_customers,
           updated_at = now()
     returning ${ACCESS_COLS}`,
    [userId, username, email, first || invited, first, canAdd],
  );
  if (invite) await consumeInvite(sql, invite.id, userId);
  return rows[0]!;
}

async function adoptAuthUsers(sql: Sql): Promise<void> {
  const orphans = await sql.query<{ id: string }>(
    `select u.id
       from "user" u
       left join desk_accounts d on d.user_id = u.id
      where d.user_id is null`,
  );
  for (const row of orphans) {
    try {
      await ensureDeskAccount(sql, row.id);
    } catch {
      /* username collision on a stub — skip this pass */
    }
  }
}

async function applyPendingInvites(sql: Sql): Promise<void> {
  const pending = await sql.query<InviteRow>(
    `select id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers
     from desk_invites where status = 'pending'`,
  );
  for (const inv of pending) {
    const matches = await sql.query<{ user_id: string }>(
      `select user_id from desk_accounts
       where (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )`,
      [normEmail(inv.email), inv.username?.trim().toLowerCase() || null],
    );
    for (const m of matches) {
      await grantInviteAccess(sql, m.user_id, inv);
    }
  }
}

async function applyInviteIfAny(
  sql: Sql,
  userId: string,
  email: string | null,
  username: string | null,
): Promise<boolean> {
  const invite = await findPendingInvite(sql, email, username);
  if (!invite) return false;
  await grantInviteAccess(sql, userId, invite);
  return true;
}

async function promoteAdmin(sql: Sql, userId: string, email?: string | null): Promise<DeskAccess> {
  const rows = await sql.query<AccessRow>(
    `update desk_accounts
     set approved = true,
         is_admin = true,
         denied = false,
         email = coalesce($2, email),
         updated_at = now()
     where user_id = $1
     returning ${ACCESS_COLS}`,
    [userId, email ?? null],
  );
  if (!rows[0]) throw new Error("Account not found");
  return mapAccess(rows[0]);
}

async function requireAdmin(sql: Sql, userId: string, message?: string): Promise<void> {
  const me = await sql.query<{ is_admin: boolean }>(
    "select is_admin from desk_accounts where user_id = $1",
    [userId],
  );
  if (!flagOn(me[0]?.is_admin)) throw new Error(message ?? "Only an admin can review accounts.");
}

export async function requireCanAddCustomers(sql: Sql, userId: string): Promise<void> {
  const me = await sql.query<{
    approved: boolean;
    is_admin: boolean;
    can_add_customers: boolean;
  }>(
    "select approved, is_admin, can_add_customers from desk_accounts where user_id = $1",
    [userId],
  );
  if (!me[0] || !flagOn(me[0].approved)) {
    throw new Error("This account is waiting for approval.");
  }
  if (flagOn(me[0].is_admin) || flagOn(me[0].can_add_customers)) return;
  throw new Error("You don’t have permission to add customers. Ask an admin.");
}

export { requireAdmin };

/** Reject unapproved sessions before any ops query. Used by deskMiddleware. */
export async function assertApproved(userId: string): Promise<void> {
  const sql = await getSql();
  await ensureTable(sql);
  const existing = await loadAccess(sql, userId);
  if (!flagOn(existing?.approved)) {
    throw new Error("This account is waiting for approval.");
  }
}

/** Auth + approved desk account. Use on every ops/notify server function. */
export const deskMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    await assertApproved(context.userId);
    return next();
  });

export const checkUsername = createServerFn({ method: "POST" })
  .validator((d: { username: string }) => d)
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    const username = cleanUsername(data.username);
    if (!validUsername(username)) return { available: false };
    const sql = await getSql();
    await ensureTable(sql);
    const rows = await sql.query<{ user_id: string }>(
      "select user_id from desk_accounts where lower(username) = $1 limit 1",
      [username.toLowerCase()],
    );
    return { available: !rows[0] };
  });

export const lookupSignIn = createServerFn({ method: "POST" })
  .validator((d: { username: string }) => d)
  .handler(async ({ data }): Promise<{ email: string; waiting?: boolean; invited?: boolean }> => {
    const raw = data.username.trim();
    if (!raw) throw new Error("Enter your username or email");
    const sql = await getSql();
    await ensureTable(sql);
    const emailNorm = raw.includes("@") ? normEmail(raw) : null;
    const userNorm = emailNorm ? null : cleanUsername(raw).toLowerCase();
    const rows = await sql.query<{ email: string | null; approved: boolean; denied: boolean }>(
      `select email, approved, denied from desk_accounts
       where (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )
       limit 1`,
      [emailNorm, userNorm],
    );
    const row = rows[0];
    if (row) {
      if (row.denied) throw new Error("This account was denied access.");
      if (!row.email) throw new Error("This account has no email on file. Ask an admin to invite you again.");
      return { email: row.email, waiting: !row.approved };
    }
    const invite = await findPendingInvite(sql, emailNorm ?? raw, userNorm);
    if (invite) {
      return {
        email: invite.email || emailNorm || "",
        invited: true,
      };
    }
    throw new Error("Unknown username. Invited? Create an account with that email or username.");
  });

export const peekInvite = createServerFn({ method: "POST" })
  .validator((d: { identity: string }) => d)
  .handler(async ({ data }): Promise<{ invited: boolean; email: string | null; username: string | null }> => {
    const raw = data.identity.trim();
    const sql = await getSql();
    await ensureTable(sql);
    const emailNorm = raw.includes("@") ? normEmail(raw) : null;
    const userNorm = emailNorm ? null : cleanUsername(raw);
    const invite = await findPendingInvite(sql, emailNorm ?? raw, userNorm);
    if (!invite) return { invited: false, email: null, username: null };
    return { invited: true, email: invite.email, username: invite.username };
  });

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskAccess> => {
    const sql = await getSql();
    await ensureTable(sql);
    const fresh = await ensureDeskAccount(sql, context.userId);
    const profile = await loadUser(sql, context.userId);
    const admin = await shouldBootstrapAdmin(
      sql,
      fresh.username,
      profile.name,
      profile.email ?? fresh.email,
    );
    if (admin && (!fresh.approved || !fresh.is_admin)) {
      const promoted = await promoteAdmin(sql, context.userId, profile.email);
      const { canUserEditRoster } = await import("@/lib/ops/roster");
      const canEdit = await canUserEditRoster(sql, context.userId);
      return { ...promoted, canEditRoster: canEdit, canAssignRoles: canEdit };
    }
    const mapped = mapAccess((await loadAccess(sql, context.userId)) ?? fresh);
    const { canUserEditRoster } = await import("@/lib/ops/roster");
    const canEdit = await canUserEditRoster(sql, context.userId);
    return { ...mapped, canEditRoster: canEdit, canAssignRoles: canEdit };
  });

export const registerAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { username: string; email?: string | null }) => d)
  .handler(async ({ context, data }): Promise<DeskAccess> => {
    const username = cleanUsername(data.username);
    if (!validUsername(username)) {
      throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
    }
    const sql = await getSql();
    await ensureTable(sql);
    const taken = await sql.query<{ user_id: string }>(
      "select user_id from desk_accounts where lower(username) = $1 limit 1",
      [username.toLowerCase()],
    );
    if (taken[0] && taken[0].user_id !== context.userId) {
      throw new Error("That username is already taken.");
    }
    const profile = await loadUser(sql, context.userId);
    const email = normEmail(data.email) || normEmail(profile.email);
    const invite = await findPendingInvite(sql, email, username);
    const invited = !!invite;
    const first = await shouldBootstrapAdmin(sql, username, profile.name, email);
    const approved = first || invited;
    const canAdd = true;
    const existing = await loadAccess(sql, context.userId);
    try {
      let row: AccessRow | undefined;
      if (existing) {
        const rows = await sql.query<AccessRow>(
          `update desk_accounts
           set username = $2,
               email = coalesce($3, email),
               username_chosen = true,
               approved = approved or $4,
               is_admin = is_admin or $5,
               can_add_customers = can_add_customers or $6,
               denied = case when $4 then false else denied end,
               updated_at = now()
           where user_id = $1
           returning ${ACCESS_COLS}`,
          [context.userId, username, email, approved, first, canAdd],
        );
        row = rows[0] ?? {
          ...existing,
          username,
          email: email ?? existing.email,
          username_chosen: true,
          approved: existing.approved || approved,
          is_admin: existing.is_admin || first,
          can_add_customers: existing.can_add_customers || canAdd,
        };
      } else {
        const rows = await sql.query<AccessRow>(
          `insert into desk_accounts (user_id, username, email, approved, is_admin, can_add_customers, username_chosen, denied)
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
           returning ${ACCESS_COLS}`,
          [context.userId, username, email, approved, first, canAdd],
        );
        row = rows[0]!;
      }
      if (invite) await consumeInvite(sql, invite.id, context.userId);
      return mapAccess(row);
    } catch (e) {
      if (isUniqueUsernameError(e)) throw new Error("That username is already taken.");
      throw e;
    }
  });

export const listDeskAccounts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskAccountRow[]> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    await adoptAuthUsers(sql);
    await applyPendingInvites(sql);
    const rows = await sql.query<AccessRow & { created_at: string }>(
      `select ${ACCESS_COLS}, created_at from desk_accounts order by created_at desc`,
    );
    return rows.map((r) => ({
      ...mapAccess(r),
      createdAt: String(r.created_at),
    }));
  });

export const setAccountApproved = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; approved: boolean }) => d)
  .handler(async ({ context, data }): Promise<DeskAccess> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    if (data.userId === context.userId && !data.approved) {
      throw new Error("You cannot revoke your own access.");
    }
    await sql.query(
      `update desk_accounts
       set approved = $2,
           denied = case when $2 then false else denied end,
           can_add_customers = case when $2 then true else can_add_customers end,
           updated_at = now()
       where user_id = $1`,
      [data.userId, data.approved],
    );
    const rows = await sql.query<AccessRow>(
      `select ${ACCESS_COLS} from desk_accounts where user_id = $1`,
      [data.userId],
    );
    if (!rows[0]) throw new Error("Account not found");
    return mapAccess(rows[0]);
  });

export const setAccountCanAddCustomers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; canAddCustomers: boolean }) => d)
  .handler(async ({ context, data }): Promise<DeskAccess> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    const target = await loadAccess(sql, data.userId);
    if (!target) throw new Error("Account not found");
    if (target.is_admin && !data.canAddCustomers) {
      throw new Error("Admins can always add customers.");
    }
    const rows = await sql.query<AccessRow>(
      `update desk_accounts
       set can_add_customers = $2, updated_at = now()
       where user_id = $1
       returning ${ACCESS_COLS}`,
      [data.userId, data.canAddCustomers],
    );
    if (!rows[0]) throw new Error("Account not found");
    return mapAccess(rows[0]);
  });

export const setAccountRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; role: "sales" | "service" | null }) => d)
  .handler(async ({ context, data }): Promise<DeskAccess> => {
    const sql = await getSql();
    await ensureTable(sql);
    const { canUserEditRoster } = await import("@/lib/ops/roster");
    if (!(await canUserEditRoster(sql, context.userId))) {
      throw new Error("Only the desk owner can set a user’s role.");
    }
    const role = data.role === "sales" || data.role === "service" ? data.role : null;
    const rows = await sql.query<AccessRow>(
      `update desk_accounts
          set desk_role = $2, updated_at = now()
        where user_id = $1
        returning ${ACCESS_COLS}`,
      [data.userId, role],
    );
    if (!rows[0]) throw new Error("Account not found");
    return mapAccess(rows[0], true);
  });

export const grantAllCanAddCustomers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ updated: number }> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    const rows = await sql.query<{ user_id: string }>(
      `update desk_accounts
       set can_add_customers = true, updated_at = now()
       where approved = true and denied = false and can_add_customers = false
       returning user_id`,
    );
    return { updated: rows.length };
  });

export const denyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string }) => d)
  .handler(async ({ context, data }): Promise<DeskAccess> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot deny your own access.");
    const target = await loadAccess(sql, data.userId);
    if (!target) throw new Error("Account not found");
    const rows = await sql.query<AccessRow>(
      `update desk_accounts
       set approved = false, denied = true, updated_at = now()
       where user_id = $1
       returning ${ACCESS_COLS}`,
      [data.userId],
    );
    await sql.query(
      `update desk_invites
       set status = 'revoked', updated_at = now()
       where status = 'pending'
         and (
           (email is not null and $1::text is not null and lower(email) = $1)
           or (username is not null and lower(username) = $2)
         )`,
      [normEmail(target.email), target.username.toLowerCase()],
    );
    if (!rows[0]) throw new Error("Account not found");
    return mapAccess(rows[0]);
  });

export const listDeskInvites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskInvite[]> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    await adoptAuthUsers(sql);
    await applyPendingInvites(sql);
    const rows = await sql.query<InviteRow>(
      `select id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers
       from desk_invites
       where status = 'pending'
       order by created_at desc`,
    );
    const names = new Map<string, string>();
    const out: DeskInvite[] = [];
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

export const createInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { email?: string; username?: string; canAddCustomers?: boolean }) => d)
  .handler(async ({ context, data }): Promise<InviteResult> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    const email = data.email?.trim() ? normEmail(data.email) : null;
    const username = data.username ? cleanUsername(data.username) : "";
    const user = username || null;
    const canAdd = !!data.canAddCustomers;
    if (!email && !user) throw new Error("Enter an email, a username, or both.");
    if (email && !validEmail(email)) throw new Error("Enter a valid email address.");
    if (user && !validUsername(user)) {
      throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
    }

    await adoptAuthUsers(sql);

    const already = await sql.query<{ username: string }>(
      `select username from desk_accounts
       where approved = true
         and (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )`,
      [normEmail(email), user?.toLowerCase() ?? null],
    );
    if (already[0]) {
      throw new Error(
        `${already[0].username} already has access. Grant “add customers” on their account below.`,
      );
    }

    const dup = await findPendingInvite(sql, email, user);
    if (dup) {
      if (canAdd && !dup.can_add_customers) {
        await sql.query(
          `update desk_invites set can_add_customers = true, updated_at = now() where id = $1`,
          [dup.id],
        );
        dup.can_add_customers = true;
      }
      const invitedBy = await loadInviterName(sql, dup.invited_by);
      return { invite: mapInvite(dup, invitedBy), autoApproved: [] };
    }

    const inserted = await sql.query<InviteRow>(
      `insert into desk_invites (email, username, invited_by, status, can_add_customers)
       values ($1, $2, $3, 'pending', $4)
       returning id, email, username, invited_by, status, accepted_user_id, created_at, can_add_customers`,
      [email, user, context.userId, canAdd],
    );
    const inviteRow = inserted[0]!;

    const waiting = await sql.query<{ user_id: string; username: string }>(
      `select user_id, username from desk_accounts
       where (
           ($1::text is not null and email is not null and lower(email) = $1)
           or ($2::text is not null and lower(username) = $2)
         )`,
      [normEmail(email), user?.toLowerCase() ?? null],
    );
    const autoApproved: string[] = [];
    for (const w of waiting) {
      await grantInviteAccess(sql, w.user_id, inviteRow);
      autoApproved.push(w.username);
    }

    const invitedBy = await loadInviterName(sql, context.userId);
    const fresh = autoApproved.length
      ? {
          ...inviteRow,
          status: "accepted",
          accepted_user_id: waiting[0]?.user_id ?? null,
        }
      : inviteRow;
    return { invite: mapInvite(fresh, invitedBy), autoApproved };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await ensureTable(sql);
    await requireAdmin(sql, context.userId);
    const rows = await sql.query<{ id: number }>(
      `update desk_invites
       set status = 'revoked', updated_at = now()
       where id = $1 and status = 'pending'
       returning id`,
      [data.id],
    );
    if (!rows[0]) throw new Error("Invite not found.");
    return { ok: true };
  });
