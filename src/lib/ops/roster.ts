import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, isLiveDeskOwner } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { DEFAULT_TECHS, canonicalTechName, sameTech } from "@/lib/ops/tech-match";

export type DeskTech = {
  id: number;
  name: string;
  active: boolean;
  sortOrder: number;
};

export type RosterState = {
  techs: DeskTech[];
  canEdit: boolean;
  ownerLocked: boolean;
  rosterAdminUsername: string | null;
};

const DEFAULT_ROSTER: { name: string; active: boolean }[] = [
  ...DEFAULT_TECHS.map((name) => ({ name, active: true })),
  { name: "Elias", active: false },
];

export async function ensureRoster(sql: Sql): Promise<void> {
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
    await sql.query(
      "create unique index if not exists desk_techs_name_lower_uidx on desk_techs (lower(name))",
    );
  } catch {
    /* PGlite may not support expression indexes */
  }
  const existing = await sql.query<{ name: string; active: boolean }>(
    "select name, active from desk_techs",
  );
  if (!existing.length) {
    let order = 10;
    for (const row of DEFAULT_ROSTER) {
      await sql.query(`insert into desk_techs (name, active, sort_order) values ($1, $2, $3)`, [
        row.name,
        row.active,
        order,
      ]);
      order += 10;
    }
    return;
  }

  const rows = await sql.query<{ id: number; name: string; active: boolean }>(
    "select id, name, active from desk_techs",
  );
  for (const row of rows) {
    const canon = canonicalTechName(row.name);
    if (!canon || canon === row.name) continue;
    const conflict = await sql.query<{ id: number }>(
      "select id from desk_techs where lower(name) = lower($1) and id <> $2 limit 1",
      [canon, row.id],
    );
    if (conflict[0]) {
      await sql.query("delete from desk_techs where id = $1", [row.id]);
    } else {
      await sql.query(
        "update desk_techs set name = $2, active = true, updated_at = now() where id = $1",
        [row.id, canon],
      );
    }
  }

  const after = await sql.query<{ name: string }>("select name from desk_techs");
  const have = new Set(after.map((r) => r.name.trim().toLowerCase()));
  let maxOrder = (
    await sql.query<{ n: number }>("select coalesce(max(sort_order), 0)::int as n from desk_techs")
  )[0]?.n ?? 0;
  for (const name of DEFAULT_TECHS) {
    if (have.has(name.toLowerCase())) {
      await sql.query(
        "update desk_techs set active = true, name = $2, updated_at = now() where lower(name) = lower($1)",
        [name, name],
      );
    } else {
      maxOrder += 10;
      await sql.query(`insert into desk_techs (name, active, sort_order) values ($1, true, $2)`, [
        name,
        maxOrder,
      ]);
      have.add(name.toLowerCase());
    }
  }
  await sql.query(
    `update desk_techs set active = false, updated_at = now()
      where lower(name) = 'elias' and active = true`,
  );
  let order = 10;
  for (const name of DEFAULT_TECHS) {
    await sql.query("update desk_techs set sort_order = $2 where lower(name) = lower($1)", [
      name,
      order,
    ]);
    order += 10;
  }
  await sql.query("update desk_techs set sort_order = $1 where lower(name) = 'elias'", [order + 40]);
}

export async function loadTechs(sql: Sql): Promise<DeskTech[]> {
  await ensureRoster(sql);
  const rows = await sql.query<{
    id: number;
    name: string;
    active: boolean;
    sort_order: number;
  }>("select id, name, active, sort_order from desk_techs order by sort_order, id");
  if (!rows.length) {
    return DEFAULT_TECHS.map((name, i) => ({
      id: i + 1,
      name,
      active: true,
      sortOrder: (i + 1) * 10,
    }));
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    active: flagOn(r.active),
    sortOrder: r.sort_order,
  }));
}

type AccountLite = {
  user_id: string;
  username: string;
  email: string | null;
  is_admin: boolean;
  approved: boolean;
};

async function loadAccounts(sql: Sql): Promise<AccountLite[]> {
  return sql.query<AccountLite>(
    `select user_id, username, email, is_admin, approved from desk_accounts
      where approved = true and denied = false
      order by created_at`,
  );
}

function isQa(username: string) {
  return /^qa[._-]/i.test(username);
}

async function ownerAccount(sql: Sql): Promise<AccountLite | null> {
  const rows = await loadAccounts(sql);
  return (
    rows.find((a) => flagOn(a.is_admin) && isLiveDeskOwner(a.username, null, a.email)) ??
    null
  );
}

async function setting(sql: Sql, key: string): Promise<string | null> {
  const rows = await sql.query<{ value: string | null }>(
    "select value from desk_settings where key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

async function setSetting(sql: Sql, key: string, value: string) {
  await sql.query(
    `insert into desk_settings (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value],
  );
}

export async function rosterAdminUserId(sql: Sql): Promise<string | null> {
  await ensureRoster(sql);
  const owner = await ownerAccount(sql);
  if (owner) return owner.user_id;
  const stored = await setting(sql, "roster_admin_user_id");
  if (stored) {
    const still = await sql.query<{ user_id: string }>(
      "select user_id from desk_accounts where user_id = $1 and approved = true",
      [stored],
    );
    if (still[0]) return stored;
  }
  const accounts = await loadAccounts(sql);
  const pick =
    accounts.find((a) => flagOn(a.is_admin) && !isQa(a.username)) ??
    accounts.find((a) => flagOn(a.is_admin)) ??
    accounts[0] ??
    null;
  if (pick) await setSetting(sql, "roster_admin_user_id", pick.user_id);
  return pick?.user_id ?? null;
}

export async function canUserEditRoster(sql: Sql, userId: string): Promise<boolean> {
  await ensureRoster(sql);
  const me = await sql.query<{ username: string; email: string | null; is_admin: boolean; approved: boolean }>(
    "select username, email, is_admin, approved from desk_accounts where user_id = $1",
    [userId],
  );
  // Name matching is only trusted for an approved admin — anyone can sign up as "chuy.x".
  if (me[0] && flagOn(me[0].approved) && flagOn(me[0].is_admin) && isLiveDeskOwner(me[0].username, null, me[0].email)) {
    return true;
  }
  const owner = await ownerAccount(sql);
  if (owner) return owner.user_id === userId;
  const admin = await rosterAdminUserId(sql);
  return !!admin && admin === userId;
}

export async function requireRosterEditor(sql: Sql, userId: string): Promise<void> {
  if (!(await canUserEditRoster(sql, userId))) {
    throw new Error("Only the roster admin can add or remove technicians.");
  }
}

function cleanTechName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export const listTechs = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<RosterState> => {
    const sql = await getSql();
    await ensureRoster(sql);
    const techs = await loadTechs(sql);
    const canEdit = await canUserEditRoster(sql, context.userId);
    const owner = await ownerAccount(sql);
    const adminId = await rosterAdminUserId(sql);
    const admin = adminId
      ? await sql.query<{ username: string }>(
          "select username from desk_accounts where user_id = $1",
          [adminId],
        )
      : [];
    return {
      techs,
      canEdit,
      ownerLocked: !!owner,
      rosterAdminUsername: admin[0]?.username ?? null,
    };
  });

export const listRosterCandidates = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ userId: string; username: string }[]> => {
    const sql = await getSql();
    await requireRosterEditor(sql, context.userId);
    const owner = await ownerAccount(sql);
    if (owner) return [];
    const rows = await loadAccounts(sql);
    return rows
      .filter((a) => !isQa(a.username))
      .map((a) => ({ userId: a.user_id, username: a.username }));
  });

export const addTech = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { name: string }) => z.object({ name: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }): Promise<RosterState> => {
    const sql = await getSql();
    await requireRosterEditor(sql, context.userId);
    const name = cleanTechName(data.name);
    if (!name) throw new Error("Enter a technician name.");
    if (name.length > 40) throw new Error("Keep the name under 40 characters.");
    const found = await sql.query<{ id: number }>(
      "select id from desk_techs where lower(name) = lower($1) limit 1",
      [name],
    );
    if (found[0]) {
      await sql.query(
        "update desk_techs set active = true, name = $2, updated_at = now() where id = $1",
        [found[0].id, name],
      );
    } else {
      const max = await sql.query<{ n: number }>(
        "select coalesce(max(sort_order), 0)::int as n from desk_techs",
      );
      await sql.query(`insert into desk_techs (name, active, sort_order) values ($1, true, $2)`, [
        name,
        (max[0]?.n ?? 0) + 10,
      ]);
    }
    return listTechs();
  });

export const setTechActive = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; active: boolean }) =>
    z.object({ id: z.number(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }): Promise<RosterState> => {
    const sql = await getSql();
    await requireRosterEditor(sql, context.userId);
    const rows = await sql.query<{ id: number }>(
      "update desk_techs set active = $2, updated_at = now() where id = $1 returning id",
      [data.id, data.active],
    );
    if (!rows[0]) throw new Error("Technician not found.");
    return listTechs();
  });

export const setRosterAdmin = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { userId: string }) => z.object({ userId: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }): Promise<RosterState> => {
    const sql = await getSql();
    await requireRosterEditor(sql, context.userId);
    const owner = await ownerAccount(sql);
    if (owner) throw new Error("The desk owner already holds the roster lock.");
    const target = await sql.query<{ user_id: string }>(
      "select user_id from desk_accounts where user_id = $1 and approved = true",
      [data.userId],
    );
    if (!target[0]) throw new Error("That account is not on the desk.");
    await setSetting(sql, "roster_admin_user_id", data.userId);
    return listTechs();
  });

export function techLabel(name: string, activeNames: Set<string>): string {
  if (!name) return "";
  const hit = [...activeNames].find((n) => sameTech(n, name));
  return hit ?? `${name} (inactive)`;
}

export function isTechActive(name: string, techs: DeskTech[]): boolean {
  const row = techs.find((t) => sameTech(t.name, name));
  if (row) return row.active;
  return DEFAULT_TECHS.some((t) => sameTech(t, name));
}

export { canonicalTechName, sameTech, DEFAULT_TECHS };
