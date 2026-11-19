/**
 * Normalize serials, once, Admin only (Chuy, 11/19). Account units written before serials were kept uppercase can hold
 * "Itcb154148", and an older row can be missing its key, which every lookup by key misses. The preview lists each unit
 * whose serial or key would change, from what to what, and any other account with the same serial; it writes nothing.
 * Apply writes only the previewed units whose serial is still what the preview read.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { parseSerial, serialKey } from "@/lib/ops/account-equip";
import { checked } from "@/lib/ops/checked-input";

export const NORMALIZE_ADMIN_ONLY = "Only an Admin can normalize serials.";

export type SerialNormalizeRow = {
  unitId: number;
  customer: string;
  equipment: string;
  oldSerial: string;
  newSerial: string;
  oldKey: string | null;
  newKey: string;
  locked: boolean;
  /** Other accounts with a unit of the same serial, once keyed: a duplicate to look at, not changed here. */
  alsoOn: string[];
};

async function assertAdmin(sql: Sql, userId: string): Promise<void> {
  if (!(await canReviewNames(sql, userId))) throw new Error(NORMALIZE_ADMIN_ONLY);
}

/** Every unit whose serial or key would change. Writes nothing. */
export async function previewSerialNormalizeFor(sql: Sql, userId: string): Promise<{ rows: SerialNormalizeRow[] }> {
  await assertAdmin(sql, userId);
  const units = await sql.query<{ id: number; customer: string; equipment: string; serial: string; serial_key: string | null; locked: boolean }>(
    `select id, customer, coalesce(nullif(btrim(equipment_name), ''), catalog_model) as equipment, serial, serial_key, locked_at is not null as locked
       from account_equipment where coalesce(btrim(serial), '') <> '' order by id`,
  );
  const byKey = new Map<string, Set<string>>();
  for (const u of units) {
    const k = parseSerial(u.serial) ? serialKey(u.serial) : "";
    if (!k) continue;
    byKey.set(k, (byKey.get(k) ?? new Set()).add(u.customer.trim()));
  }
  const rows: SerialNormalizeRow[] = [];
  for (const u of units) {
    // A placeholder ("N/A", "none") is no serial: never keyed, so it can't match another unit's.
    const parsed = parseSerial(u.serial);
    if (!parsed) continue;
    const newSerial = parsed;
    const newKey = serialKey(u.serial);
    if (newSerial === u.serial && newKey === u.serial_key) continue;
    rows.push({
      unitId: Number(u.id),
      customer: u.customer,
      equipment: u.equipment,
      oldSerial: u.serial,
      newSerial,
      oldKey: u.serial_key,
      newKey,
      locked: !!u.locked,
      alsoOn: [...(byKey.get(newKey) ?? [])].filter((c) => c.toLowerCase() !== u.customer.trim().toLowerCase()).sort(),
    });
  }
  return { rows };
}

/** Write the previewed units whose serial is still as the preview read it. Locked units are left. */
export async function applySerialNormalizeFor(
  sql: Sql,
  userId: string,
  data: { rows: { unitId: number; oldSerial: string }[] },
): Promise<{ written: number[] }> {
  await assertAdmin(sql, userId);
  const written: number[] = [];
  for (const r of data.rows) {
    const newSerial = parseSerial(r.oldSerial);
    if (!newSerial) continue;
    const out = await sql.query<{ id: number }>(
      `update account_equipment set serial = $3, serial_key = $4, updated_at = now()
        where id = $1 and serial = $2 and locked_at is null returning id`,
      [r.unitId, r.oldSerial, newSerial, serialKey(r.oldSerial) || null],
    );
    if (out[0]) written.push(Number(out[0].id));
  }
  return { written };
}

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

export const previewSerialNormalize = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }) => previewSerialNormalizeFor(await ready(), context.userId));

export const applySerialNormalize = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(checked(z.object({ rows: z.array(z.object({ unitId: z.number().int().positive(), oldSerial: z.string().max(2_000) })).max(50_000) })))
  .handler(async ({ data, context }) => applySerialNormalizeFor(await ready(), context.userId, data));
