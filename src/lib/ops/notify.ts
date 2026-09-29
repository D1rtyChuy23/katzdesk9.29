import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { parseMentions } from "@/lib/ops/mentions";

export type Teammate = {
  userId: string;
  username: string;
  email: string | null;
};

export type DeskNotice = {
  id: number;
  fromName: string | null;
  body: string;
  customer: string | null;
  entityType: string | null;
  entityId: number | null;
  commentId: number | null;
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
      comment_id    int,
      read          boolean not null default false,
      created_at    timestamptz not null default now()
    )`);
  await sql.query("alter table desk_notifications add column if not exists comment_id int");
  await sql.query("alter table desk_notifications add column if not exists customer text");
  await sql.query(
    "create index if not exists desk_notifications_inbox_idx on desk_notifications (user_id, read, created_at desc)",
  );

  await sql.query(`
    create unique index if not exists desk_notifications_comment_once_idx
    on desk_notifications (user_id, comment_id)
    where comment_id is not null
  `).catch(() => undefined);
}

async function loadFromName(sql: Sql, userId: string): Promise<string> {
  const me = await sql.query<{ username: string | null; name: string | null }>(
    `select a.username, u.name
     from desk_accounts a
     left join "user" u on u.id = a.user_id
     where a.user_id = $1`,
    [userId],
  );
  return me[0]?.username || me[0]?.name || "Teammate";
}

async function resolveCustomer(
  sql: Sql,
  entityType: string | null | undefined,
  entityId: number | null | undefined,
): Promise<string | null> {
  if (!entityType || entityId == null) return null;
  const type = entityType;
  const id = entityId;
  try {
    if (type === "service" || type === "tlc") {
      const r = await sql.query<{ customer: string | null }>(
        "select customer from service_jobs where id = $1",
        [id],
      );
      return r[0]?.customer ?? null;
    }
    if (type === "pm") {
      const r = await sql.query<{ customer: string | null }>(
        "select customer from pm_jobs where id = $1",
        [id],
      );
      return r[0]?.customer ?? null;
    }
    if (type === "install") {
      const r = await sql.query<{ customer: string | null }>(
        "select customer from installs where id = $1",
        [id],
      );
      return r[0]?.customer ?? null;
    }
    if (type === "deal") {
      const r = await sql.query<{ customer: string | null }>(
        "select customer from deals where id = $1",
        [id],
      );
      return r[0]?.customer ?? null;
    }
    if (type === "rebuild") {
      const r = await sql.query<{ account: string | null }>(
        "select account from rebuilds where id = $1",
        [id],
      );
      return r[0]?.account ?? "Katz shop / stock";
    }
    if (type === "handoff") {
      const r = await sql.query<{ entity_type: string; entity_id: number }>(
        "select entity_type, entity_id from comments where id = $1",
        [id],
      );
      if (r[0]) return resolveCustomer(sql, r[0].entity_type, r[0].entity_id);
    }
  } catch {
    return null;
  }
  return null;
}

/** Tell every admin that Warehouse put a unit on a rack slot. Admins are not notified about their own adds. */
export async function notifyAdminsRackReview(
  sql: Sql,
  fromUserId: string,
  asset: { id: number; model: string; serial: string | null; slot: string },
): Promise<void> {
  await ensureTable(sql);
  const me = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [fromUserId],
  );
  const row = me[0];
  if (!row || flagOn(row.is_admin) || row.desk_role !== "warehouse") return;
  const who = row.username || "Warehouse";
  const serial = asset.serial?.trim() ? ` SN ${asset.serial.trim()}` : "";
  const body = `Needs review. ${who} added ${asset.model}${serial} to ${asset.slot}.`;
  const admins = await sql.query<{ user_id: string; is_admin: boolean; approved: boolean }>(
    "select user_id, is_admin, approved from desk_accounts where user_id <> $1",
    [fromUserId],
  );
  for (const admin of admins) {
    if (!flagOn(admin.is_admin) || !flagOn(admin.approved)) continue;
    await sql.query(
      `insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, 'asset', $6)`,
      [admin.user_id, fromUserId, who, body, asset.slot, asset.id],
    );
  }
}

/** Tell every admin that Warehouse asked to remove a unit or send it to a customer. */
export async function notifyAdminsStockRequest(
  sql: Sql,
  fromUserId: string,
  asset: {
    id: number;
    model: string;
    serial: string | null;
    slot: string;
    kind: "remove" | "assign";
    reason?: string | null;
    customer?: string | null;
  },
): Promise<void> {
  await ensureTable(sql);
  const me = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [fromUserId],
  );
  const row = me[0];
  if (!row || flagOn(row.is_admin) || row.desk_role !== "warehouse") return;
  const who = row.username || "Warehouse";
  const serial = asset.serial?.trim() ? ` SN ${asset.serial.trim()}` : "";
  const body =
    asset.kind === "remove"
      ? `Pending removal. ${who} asked to remove ${asset.model}${serial} from ${asset.slot}. Reason: ${asset.reason || "—"}.`
      : `Pending customer assign. ${who} wants ${asset.model}${serial} from ${asset.slot} to go to ${asset.customer || "an account"}.`;
  const admins = await sql.query<{ user_id: string; is_admin: boolean; approved: boolean }>(
    "select user_id, is_admin, approved from desk_accounts where user_id <> $1",
    [fromUserId],
  );
  for (const admin of admins) {
    if (!flagOn(admin.is_admin) || !flagOn(admin.approved)) continue;
    await sql.query(
      `insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, 'asset', $6)`,
      [admin.user_id, fromUserId, who, body, asset.kind === "assign" ? asset.customer ?? asset.slot : asset.slot, asset.id],
    );
  }
}

function previewLine(body: string): string {
  const line = body
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s && !/^follow up:/i.test(s));
  return (line || body.trim()).slice(0, 160);
}


export async function deliverPings(
  sql: Sql,
  opts: {
    fromUserId: string;
    body: string;
    entityType?: string | null;
    entityId?: number | null;
    commentId?: number | null;
    toUserIds?: string[];
    usernames?: string[];
  },
): Promise<{ sent: string[]; already: boolean; pingedAt: string | null }> {
  await ensureTable(sql);
  const body = opts.body.trim();
  if (!body) throw new Error("Write a short reminder.");
  const commentId = opts.commentId ?? null;

  if (commentId) {
    const prior = await sql.query<{ pinged_at: string | null }>(
      "select pinged_at from comments where id = $1",
      [commentId],
    );
    if (prior[0]?.pinged_at) {
      return { sent: [], already: true, pingedAt: String(prior[0].pinged_at) };
    }
  }

  const destIds = new Set<string>(opts.toUserIds ?? []);
  const names = [...(opts.usernames ?? []), ...parseMentions(body)];
  if (names.length) {
    const lowered = [...new Set(names.map((n) => n.toLowerCase()))];
    const placeholders = lowered.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await sql.query<{ user_id: string; username: string }>(
      `select user_id, username from desk_accounts
       where approved = true and lower(username) in (${placeholders})`,
      lowered,
    );
    for (const r of rows) destIds.add(r.user_id);
  }
  destIds.delete(opts.fromUserId);
  if (!destIds.size) {
    throw new Error("Tag a teammate with @username, or pick someone to ping.");
  }

  if (commentId) {
    const existing = await sql.query<{ user_id: string }>(
      "select user_id from desk_notifications where comment_id = $1",
      [commentId],
    );
    if (existing.length) {
      const when = await sql.query<{ pinged_at: string | null }>(
        "select pinged_at from comments where id = $1",
        [commentId],
      );
      return { sent: [], already: true, pingedAt: when[0]?.pinged_at ? String(when[0].pinged_at) : null };
    }
  }

  const fromName = await loadFromName(sql, opts.fromUserId);
  const customer = await resolveCustomer(sql, opts.entityType, opts.entityId);
  const bodyPreview = previewLine(body);
  const sent: string[] = [];
  let pingedAt: string | null = null;
  for (const toUserId of destIds) {
    const dest = await sql.query<{ username: string }>(
      "select username from desk_accounts where user_id = $1 and approved = true",
      [toUserId],
    );
    if (!dest[0]) continue;
    const ins = await sql.query<{ created_at: string }>(
      `insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id, comment_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning created_at`,
      [
        toUserId,
        opts.fromUserId,
        fromName,
        bodyPreview.slice(0, 400),
        customer,
        opts.entityType ?? null,
        opts.entityId ?? null,
        commentId,
      ],
    );

    pingedAt = ins[0] ? String(ins[0].created_at) : pingedAt;
    sent.push(dest[0].username);
  }
  if (!sent.length) throw new Error("That teammate isn’t on the desk yet.");
  if (commentId) {
    const marked = await sql.query<{ pinged_at: string }>(
      `update comments
       set pinged_at = coalesce(pinged_at, now()), pinged_by = $2
       where id = $1
       returning pinged_at`,
      [commentId, fromName],
    );
    pingedAt = marked[0] ? String(marked[0].pinged_at) : pingedAt;
  }
  return { sent, already: false, pingedAt };
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
      customer: string | null;
      entity_type: string | null;
      entity_id: number | null;
      comment_id: number | null;
      read: boolean;
      created_at: string;
    }>(
      `select id, from_name, body, customer, entity_type, entity_id, comment_id, read, created_at
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
      customer: r.customer,
      entityType: r.entity_type,
      entityId: r.entity_id,
      commentId: r.comment_id,
      read: !!r.read,
      createdAt: String(r.created_at),
    }));
  });

export const sendPing = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(
    (d: {
      toUserId?: string;
      usernames?: string[];
      body: string;
      entityType?: string | null;
      entityId?: number | null;
      commentId?: number | null;
    }) => d,
  )
  .handler(async ({ context, data }): Promise<{ sent: string[]; already: boolean; pingedAt: string | null }> => {
    const sql = await getSql();
    return deliverPings(sql, {
      fromUserId: context.userId,
      body: data.body,
      entityType: data.entityType,
      entityId: data.entityId,
      commentId: data.commentId,
      toUserIds: data.toUserId ? [data.toUserId] : [],
      usernames: data.usernames,
    });
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
