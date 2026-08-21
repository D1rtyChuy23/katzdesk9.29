import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type DeskAccess = {
  userId: string;
  username: string;
  email: string | null;
  approved: boolean;
  isAdmin: boolean;
};

export type DeskAccountRow = DeskAccess & {
  createdAt: string;
};

const ACCESS_COLS = "user_id, username, email, approved, is_admin";

function cleanUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function slugUsername(raw: string): string {
  const s = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "")
    .slice(0, 24);
  return s.length >= 3 ? s : `user${s}`.slice(0, 24) || "user";
}

function validUsername(raw: string): boolean {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(raw);
}

/** Playwright / sandbox probe accounts — they must not steal the live owner's admin seat. */
function isSandboxQa(username: string): boolean {
  return /^qa[._-]/i.test(username);
}

/** Live desk owner (Chuy). Always an admin, even if a qa.* account claimed first. */
function isDeskOwner(username: string, name?: string | null, email?: string | null): boolean {
  const blob = [username, name ?? "", email ?? ""].join(" ").toLowerCase();
  return /\bchuy\b/.test(blob) || blob.includes("d1rtychuy");
}

async function ensureTable(sql: Sql) {
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
  await sql.query(
    "create unique index if not exists desk_accounts_username_uidx on desk_accounts (lower(username))",
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

async function uniqueUsername(sql: Sql, base: string, exceptUserId?: string): Promise<string> {
  const root = slugUsername(cleanUsername(base)) || "user";
  let candidate = root;
  let n = 1;
  for (;;) {
    const rows = await sql.query<{ user_id: string }>(
      "select user_id from desk_accounts where lower(username) = $1 limit 1",
      [candidate.toLowerCase()],
    );
    if (!rows[0] || rows[0].user_id === exceptUserId) return candidate;
    n += 1;
    if (n > 99) return `${root.slice(0, 16)}${Date.now().toString(36).slice(-6)}`;
    candidate = `${root.slice(0, 20)}${n}`;
  }
}

async function loadUser(sql: Sql, userId: string): Promise<{ name: string; email: string | null }> {
  const rows = await sql.query<{ name: string; email: string | null }>(
    `select name, email from "user" where id = $1 limit 1`,
    [userId],
  );
  return { name: rows[0]?.name ?? "user", email: rows[0]?.email ?? null };
}

function mapAccess(row: {
  user_id: string;
  username: string;
  email: string | null;
  approved: boolean;
  is_admin: boolean;
}): DeskAccess {
  return {
    userId: row.user_id,
    username: row.username,
    email: row.email,
    approved: !!row.approved,
    isAdmin: !!row.is_admin,
  };
}

type AccessRow = {
  user_id: string;
  username: string;
  email: string | null;
  approved: boolean;
  is_admin: boolean;
};

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

async function promoteAdmin(sql: Sql, userId: string, email?: string | null): Promise<DeskAccess> {
  const rows = await sql.query<AccessRow>(
    `update desk_accounts
     set approved = true,
         is_admin = true,
         email = coalesce($2, email),
         updated_at = now()
     where user_id = $1
     returning ${ACCESS_COLS}`,
    [userId, email ?? null],
  );
  if (!rows[0]) throw new Error("Account not found");
  return mapAccess(rows[0]);
}

/** Reject unapproved sessions before any ops query. Used by deskMiddleware. */
export async function assertApproved(userId: string): Promise<void> {
  const sql = await getSql();
  await ensureTable(sql);
  const existing = await loadAccess(sql, userId);
  if (!existing?.approved) {
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
  .handler(async ({ data }): Promise<{ email: string }> => {
    const username = cleanUsername(data.username);
    if (!username) throw new Error("Enter your username");
    const sql = await getSql();
    await ensureTable(sql);
    const rows = await sql.query<{ email: string | null; approved: boolean }>(
      "select email, approved from desk_accounts where lower(username) = $1 limit 1",
      [username.toLowerCase()],
    );
    const row = rows[0];
    if (!row?.email) throw new Error("Unknown username");
    if (!row.approved) throw new Error("This account is waiting for approval.");
    return { email: row.email };
  });

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<DeskAccess> => {
    const sql = await getSql();
    await ensureTable(sql);
    const existing = await loadAccess(sql, context.userId);
    const profile = await loadUser(sql, context.userId);
    if (existing) {
      const admin = await shouldBootstrapAdmin(
        sql,
        existing.username,
        profile.name,
        profile.email ?? existing.email,
      );
      if (admin && (!existing.approved || !existing.is_admin)) {
        return promoteAdmin(sql, context.userId, profile.email);
      }
      return mapAccess(existing);
    }
    const username = await uniqueUsername(sql, profile.name || profile.email?.split("@")[0] || "user");
    const first = await shouldBootstrapAdmin(sql, username, profile.name, profile.email);
    try {
      const rows = await sql.query<AccessRow>(
        `insert into desk_accounts (user_id, username, email, approved, is_admin)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update
           set email = coalesce(excluded.email, desk_accounts.email),
               approved = desk_accounts.approved or excluded.approved,
               is_admin = desk_accounts.is_admin or excluded.is_admin,
               updated_at = now()
         returning ${ACCESS_COLS}`,
        [context.userId, username, profile.email, first, first],
      );
      return mapAccess(rows[0]!);
    } catch (e) {
      if (isUniqueUsernameError(e)) {
        const retryName = await uniqueUsername(sql, username, context.userId);
        const rows = await sql.query<AccessRow>(
          `insert into desk_accounts (user_id, username, email, approved, is_admin)
           values ($1, $2, $3, $4, $5)
           on conflict (user_id) do update
             set email = coalesce(excluded.email, desk_accounts.email),
                 approved = desk_accounts.approved or excluded.approved,
                 is_admin = desk_accounts.is_admin or excluded.is_admin,
                 updated_at = now()
           returning ${ACCESS_COLS}`,
          [context.userId, retryName, profile.email, first, first],
        );
        return mapAccess(rows[0]!);
      }
      throw e;
    }
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
    const email = data.email?.trim() || profile.email;
    const first = await shouldBootstrapAdmin(sql, username, profile.name, email);
    const existing = await loadAccess(sql, context.userId);
    try {
      if (existing) {
        const rows = await sql.query<AccessRow>(
          `update desk_accounts
           set username = $2,
               email = coalesce($3, email),
               approved = approved or $4,
               is_admin = is_admin or $4,
               updated_at = now()
           where user_id = $1
           returning ${ACCESS_COLS}`,
          [context.userId, username, email, first],
        );
        return mapAccess(rows[0] ?? { ...existing, username, email: email ?? existing.email });
      }
      const rows = await sql.query<AccessRow>(
        `insert into desk_accounts (user_id, username, email, approved, is_admin)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id) do update
           set username = excluded.username,
               email = coalesce(excluded.email, desk_accounts.email),
               approved = desk_accounts.approved or excluded.approved,
               is_admin = desk_accounts.is_admin or excluded.is_admin,
               updated_at = now()
         returning ${ACCESS_COLS}`,
        [context.userId, username, email, first, first],
      );
      return mapAccess(rows[0]!);
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
    const me = await sql.query<{ is_admin: boolean }>(
      "select is_admin from desk_accounts where user_id = $1",
      [context.userId],
    );
    if (!me[0]?.is_admin) throw new Error("Only an admin can review accounts.");
    const rows = await sql.query<{
      user_id: string;
      username: string;
      email: string | null;
      approved: boolean;
      is_admin: boolean;
      created_at: string;
    }>("select user_id, username, email, approved, is_admin, created_at from desk_accounts order by created_at desc");
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
    const me = await sql.query<{ is_admin: boolean }>(
      "select is_admin from desk_accounts where user_id = $1",
      [context.userId],
    );
    if (!me[0]?.is_admin) throw new Error("Only an admin can review accounts.");
    if (data.userId === context.userId && !data.approved) {
      throw new Error("You cannot revoke your own access.");
    }
    await sql.query(
      "update desk_accounts set approved = $2, updated_at = now() where user_id = $1",
      [data.userId, data.approved],
    );
    const rows = await sql.query<AccessRow>(
      `select ${ACCESS_COLS} from desk_accounts where user_id = $1`,
      [data.userId],
    );
    if (!rows[0]) throw new Error("Account not found");
    return mapAccess(rows[0]);
  });
