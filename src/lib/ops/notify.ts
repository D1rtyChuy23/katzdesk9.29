import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";

export type Teammate = {
  userId: string;
  username: string;
  email: string | null;
};

export type DeskNotice = {
  id: number;
  fromName: string | null;
  body: string;
  entityType: string | null;
  entityId: number | null;
  read: boolean;
  createdAt: string;
};

async function ensureTable(sql: Sql) {
  await sql.query(`
    create table if not exists desk_notifications (
      id            serial primary key,
      user_id       text not null,
      from_user_id  text,
      from_name     text,
      body          text not null,
      entity_type   text,
      entity_id     int,
      read          boolean not null default false,
      created_at    timestamptz not null default now()
    )`);
  await sql.query(
    "create index if not exists desk_notifications_inbox_idx on desk_notifications (user_id, read, created_at desc)",
  );
}

export const listTeammates = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<Teammate[]> => {
    const sql = await getSql();
    await ensureTable(sql);
    const rows = await sql.query<{ user_id: string; username: string; email: string | null }>(
      `select user_id, username, email from desk_accounts
       where approved = true and user_id <> $1
       order by lower(username)`,
      [context.userId],
    );
    return rows.map((r) => ({ userId: r.user_id, username: r.username, email: r.email }));
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<DeskNotice[]> => {
    const sql = await getSql();
    await ensureTable(sql);
    const rows = await sql.query<{
      id: number;
      from_name: string | null;
      body: string;
      entity_type: string | null;
      entity_id: number | null;
      read: boolean;
      created_at: string;
    }>(
      `select id, from_name, body, entity_type, entity_id, read, created_at
       from desk_notifications
       where user_id = $1
       order by created_at desc
       limit 40`,
      [context.userId],
    );
    return rows.map((r) => ({
      id: r.id,
      fromName: r.from_name,
      body: r.body,
      entityType: r.entity_type,
      entityId: r.entity_id,
      read: !!r.read,
      createdAt: String(r.created_at),
    }));
  });

export const sendPing = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { toUserId: string; body: string; entityType?: string | null; entityId?: number | null }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const body = data.body.trim();
    if (!body) throw new Error("Write a short reminder.");
    if (data.toUserId === context.userId) throw new Error("You can’t ping yourself.");
    const sql = await getSql();
    await ensureTable(sql);
    const dest = await sql.query<{ user_id: string; username: string }>(
      "select user_id, username from desk_accounts where user_id = $1 and approved = true",
      [data.toUserId],
    );
    if (!dest[0]) throw new Error("That teammate isn’t on the desk yet.");
    const me = await sql.query<{ username: string | null; name: string | null }>(
      `select a.username, u.name
       from desk_accounts a
       left join "user" u on u.id = a.user_id
       where a.user_id = $1`,
      [context.userId],
    );
    const fromName = me[0]?.username || me[0]?.name || "Teammate";
    await sql.query(
      `insert into desk_notifications (user_id, from_user_id, from_name, body, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [data.toUserId, context.userId, fromName, body.slice(0, 400), data.entityType ?? null, data.entityId ?? null],
    );
    return { ok: true };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id?: number; all?: boolean }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    await ensureTable(sql);
    if (data.all) {
      await sql.query("update desk_notifications set read = true where user_id = $1 and read = false", [
        context.userId,
      ]);
    } else if (data.id != null) {
      await sql.query("update desk_notifications set read = true where id = $1 and user_id = $2", [
        data.id,
        context.userId,
      ]);
    }
    return { ok: true };
  });
