import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { isLocked, lockedBy, lockedMessage, releasedByReturn } from "@/lib/ops/equipment-lock-rules";

/** Only the desk owner locks and unlocks equipment: the same person who edits the technician roster. */
export async function canLockEquipment(sql: Sql, userId: string): Promise<boolean> {
  const { canUserEditRoster } = await import("@/lib/ops/roster");
  return canUserEditRoster(sql, userId);
}

/** The owner's username for the lock message, or null when there is none ("the owner"). */
export async function lockOwnerName(sql: Sql): Promise<string | null> {
  const { rosterAdminUserId } = await import("@/lib/ops/roster");
  const id = await rosterAdminUserId(sql).catch(() => null);
  if (!id) return null;
  const rows = await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [id]);
  return rows[0]?.username || null;
}

type Lockable = { status?: string | null; locked_at?: unknown; locked_by?: string | null };

/**
 * Refuse a change to a locked unit: "Locked by X. Only <owner> can unlock it." `release` is Return, Unassign or
 * Sold, which an assignment's own lock lets through (it comes off with the return).
 */
export async function assertUnlocked(sql: Sql, row: Lockable | null | undefined, opts?: { release?: boolean }): Promise<void> {
  if (!row || !isLocked(row)) return;
  if (opts?.release && releasedByReturn(row)) return;
  throw new Error(lockedMessage(lockedBy(row), await lockOwnerName(sql)));
}

export async function assertUnitUnlocked(sql: Sql, id: number): Promise<void> {
  const rows = await sql.query<Lockable>("select locked_at, locked_by from account_equipment where id = $1", [id]);
  await assertUnlocked(sql, rows[0]);
}

export async function assertAssetUnlocked(sql: Sql, id: number, opts?: { release?: boolean }): Promise<void> {
  const rows = await sql.query<Lockable>("select status, locked_at, locked_by from assets where id = $1", [id]);
  await assertUnlocked(sql, rows[0], opts);
}

/** The account unit with this serial: a unit locked on an account keeps its place in the barn records too. */
export async function accountLockOfSerial(sql: Sql, serial: string | null | undefined): Promise<Lockable | null> {
  const key = (serial ?? "").trim().replace(/[#\s]/g, "").toLowerCase();
  if (!key) return null;
  const rows = await sql.query<Lockable>(
    "select locked_at, locked_by from account_equipment where serial_key = $1 and locked_at is not null limit 1",
    [key],
  );
  return rows[0] ?? null;
}

/** Refuse a place change for a serial whose account unit is locked. */
export async function assertSerialUnlocked(sql: Sql, serial: string | null | undefined): Promise<void> {
  await assertUnlocked(sql, await accountLockOfSerial(sql, serial));
}

const lockInput = z.object({
  kind: z.enum(["unit", "asset"]),
  id: z.number().int().positive(),
  locked: z.boolean(),
});

/** Lock or unlock one account unit or warehouse asset. Owner only; the change is written to the activity log. */
export async function setLock(sql: Sql, userId: string, data: z.infer<typeof lockInput>): Promise<{ lockedAt: string | null; lockedBy: string | null }> {
  if (!(await canLockEquipment(sql, userId))) throw new Error("Only the owner can lock or unlock equipment.");
  const table = data.kind === "unit" ? "account_equipment" : "assets";
  const who =
    (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Owner";
  const rows = await sql.query<{ id: number; locked_at: unknown; locked_by: string | null; label: string | null; customer: string | null }>(
    data.kind === "unit"
      ? `update account_equipment set locked_at = case when $2 then now() else null end, locked_by = case when $2 then $3 else null end, updated_at = now()
          where id = $1 returning id, locked_at, locked_by, coalesce(nullif(equipment_name, ''), catalog_model) || coalesce(' · SN ' || serial, '') as label, customer`
      : `update assets set locked_at = case when $2 then now() else null end, locked_by = case when $2 then $3 else null end, updated_at = now()
          where id = $1 returning id, locked_at, locked_by, coalesce(model, 'Unit') || coalesce(' · SN ' || serial, '') as label, sold_to as customer`,
    [data.id, data.locked, who],
  );
  const row = rows[0];
  if (!row) throw new Error(data.kind === "unit" ? "That unit is not on the account." : "Asset not found");
  const detail = `${data.locked ? "locked" : "unlocked"} ${row.label ?? table}`;
  const acct =
    data.kind === "unit" && row.customer
      ? (await sql.query<{ id: number }>("select id from directory_customers where archived = false and lower(name) = lower($1) limit 1", [row.customer]))[0]
      : undefined;
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ($1, $2, $3, $4, $5)", [
      data.kind === "asset" ? "asset" : acct ? "customer" : "equipment",
      data.kind === "asset" ? data.id : (acct?.id ?? data.id),
      who,
      data.locked ? "locked" : "unlocked",
      detail,
    ])
    .catch(() => undefined);
  const at = row.locked_at instanceof Date ? row.locked_at.toISOString() : row.locked_at ? String(row.locked_at) : null;
  return { lockedAt: at, lockedBy: row.locked_by };
}

export const setEquipmentLock = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof lockInput>) => lockInput.parse(d))
  .handler(async ({ data, context }) => {
    const { ensureSeeded } = await import("@/lib/ops/seed.server");
    await ensureSeeded();
    return setLock(await getSql(), context.userId, data);
  });
