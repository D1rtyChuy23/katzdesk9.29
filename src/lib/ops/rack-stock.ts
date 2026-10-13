import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { serialKey } from "@/lib/ops/account-equip";
import { notifyAdminsRackReview } from "@/lib/ops/notify";
import { LEVELS, rackBayError, sectionFullMessage, slotId } from "@/lib/ops/warehouse";

type Rack = "barn-back" | "barn-front";

async function ready() {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function roleOf(sql: Sql, userId: string): Promise<{ admin: boolean; warehouse: boolean; name: string }> {
  const row = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  return {
    admin: flagOn(row[0]?.is_admin),
    warehouse: row[0]?.desk_role === "warehouse",
    name: row[0]?.username || "Teammate",
  };
}

export async function requireStock(sql: Sql, userId: string) {
  const role = await roleOf(sql, userId);
  if (!role.admin && !role.warehouse) {
    throw new Error("Only Admin or Warehouse can change rack stock.");
  }
  return role;
}

async function nextLine(sql: Sql, site: string, pallet: string, level: number, exceptId?: number): Promise<number> {
  const taken = await sql.query<{ id: number; line_no: number }>(
    `select id, line_no from assets
      where site = $1 and upper(pallet) = $2 and level = $3
        and status in ('ready', 'deployed')
        and line_no is not null`,
    [site, pallet, level],
  );
  const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.line_no));
  for (let line = 1; line <= 12; line++) if (!used.has(line)) return line;
  throw new Error(sectionFullMessage(site, pallet, level));
}

function rackOf(site: string): Rack {
  if (site === "barn-front") return "barn-front";
  if (site === "barn-back" || site === "barn") return "barn-back";
  throw new Error("Pick a barn rack");
}

function levelOf(level: number): number {
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) throw new Error("Pick a level");
  return level;
}

async function findSerial(sql: Sql, serial: string) {
  const key = serialKey(serial);
  if (!key) return null;
  const rows = await sql.query<{
    id: number;
    model: string;
    serial: string | null;
    status: string;
    site: string;
    pallet: string | null;
    level: number | null;
    line_no: number | null;
    notes: string | null;
    sold_to: string | null;
  }>("select id, model, serial, status, site, pallet, level, line_no, notes, sold_to from assets where serial is not null");
  const hits = rows.filter((r) => serialKey(r.serial) === key);
  return hits.find((r) => r.status !== "sold") ?? hits[0] ?? null;
}

function withElectrical(notes: string | null, electrical: string | null): string | null {
  const add = (electrical ?? "").trim();
  const base = (notes ?? "").trim();
  if (!add) return base || null;
  if (base.toLowerCase().includes(add.toLowerCase())) return base;
  return [base, add].filter(Boolean).join("\n");
}

async function placeExisting(
  sql: Sql,
  id: number,
  site: Rack,
  pallet: string,
  level: number,
  line: number,
  notes: string | null,
  actor: string,
  warehouse: boolean,
  prev: { site: string; pallet: string | null; level: number | null; line_no: number | null; status: string },
) {
  await sql.query(
    `update assets set
       status = 'ready',
       site = $2,
       pallet = $3,
       level = $4,
       line_no = $5,
       notes = $6,
       install_id = null,
       job_id = null,
       shop_test = coalesce(shop_test, 'needs-test'),
       review_status = case when $7 then 'pending' else review_status end,
       review_note = case when $7 then null else review_note end,
       review_actor = case when $7 then $8 else review_actor end,
       review_origin = case when $7 then 'moved' else review_origin end,
       review_from_site = case when $7 then $9 else review_from_site end,
       review_from_pallet = case when $7 then $10 else review_from_pallet end,
       review_from_level = case when $7 then $11 else review_from_level end,
       review_from_line = case when $7 then $12 else review_from_line end,
       review_from_status = case when $7 then $13 else review_from_status end,
       updated_at = now()
     where id = $1`,
    [
      id,
      site,
      pallet,
      level,
      line,
      notes,
      warehouse,
      actor,
      prev.site,
      prev.pallet,
      prev.level,
      prev.line_no,
      prev.status,
    ],
  );
}

const addInput = z.object({
  site: z.string(),
  pallet: z.string().min(1),
  level: z.number().int(),
  model: z.string().min(1),
  serial: z.string().nullable().optional(),
  electrical: z.string().nullable().optional(),
  confirm: z.boolean().optional(),
});

export const addToRackSlot = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof addInput>) => addInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id: number; moved: boolean; needsConfirm: boolean; currentPlace: string | null; pendingReview: boolean }> => {
    const sql = await ready();
    const role = await requireStock(sql, context.userId);
    const site = rackOf(data.site);
    const pallet = data.pallet.trim().toUpperCase();
    const level = levelOf(data.level);
    const bayErr = rackBayError(site, pallet);
    if (bayErr) throw new Error(bayErr);
    const slot = slotId(pallet, level);
    const serial = data.serial?.trim() || "";
    const electrical = data.electrical?.trim() || null;
    const existing = serial ? await findSerial(sql, serial) : null;
    if (existing && (existing.status === "sold" || existing.sold_to)) {
      throw new Error(`That serial is already allocated${existing.sold_to ? ` to ${existing.sold_to}` : ""}.`);
    }
    if (existing) {
      const same =
        existing.site === site &&
        (existing.pallet ?? "").toUpperCase() === pallet &&
        Number(existing.level) === level &&
        existing.status === "ready";
      if (same) throw new Error(`${serial} is already in ${site === "barn-front" ? "Front" : "Back"} · ${slot}.`);
      const { assertNotHeld } = await import("@/lib/ops/stock-actions");
      await assertNotHeld(sql, existing.id);
      const current =
        existing.pallet && existing.level && (existing.site === "barn-front" || existing.site === "barn-back")
          ? `${existing.site === "barn-front" ? "Front" : "Back"} · ${slotId(String(existing.pallet).toUpperCase(), Number(existing.level))}`
          : existing.pallet && existing.level
            ? slotId(String(existing.pallet).toUpperCase(), Number(existing.level))
            : existing.site;
      if (!data.confirm) {
        return { id: existing.id, moved: false, needsConfirm: true, currentPlace: current, pendingReview: false };
      }
      const line = await nextLine(sql, site, pallet, level, existing.id);
      await placeExisting(
        sql,
        existing.id,
        site,
        pallet,
        level,
        line,
        withElectrical(existing.notes, electrical),
        context.userId,
        role.warehouse && !role.admin,
        existing,
      );
      const pendingReview = role.warehouse && !role.admin;
      if (pendingReview) {
        await notifyAdminsRackReview(sql, context.userId, {
          id: existing.id,
          model: existing.model,
          serial,
          slot,
        });
      }
      return { id: existing.id, moved: true, needsConfirm: false, currentPlace: null, pendingReview };
    }
    const line = await nextLine(sql, site, pallet, level);
    const pending = role.warehouse && !role.admin;
    const inserted = await sql.query<{ id: number }>(
      `insert into assets (
         kind, model, serial, qty, site, pallet, level, line_no, status, notes,
         shop_test, review_status, review_actor, review_origin
       ) values (
         'equip', $1, $2, 1, $3, $4, $5, $6, 'ready', $7,
         'needs-test', $8, $9, $10
       ) returning id`,
      [
        data.model.trim(),
        serial || null,
        site,
        pallet,
        level,
        line,
        withElectrical(null, electrical),
        pending ? "pending" : null,
        pending ? context.userId : null,
        pending ? "created" : null,
      ],
    );
    const id = inserted[0]?.id;
    if (!id) throw new Error("Could not add that unit");
    if (pending) {
      await notifyAdminsRackReview(sql, context.userId, { id, model: data.model.trim(), serial: serial || null, slot });
    }
    return { id, moved: false, needsConfirm: false, currentPlace: null, pendingReview: pending };
  });

/** Warehouse moves onto a rack through the existing place picker. */
export async function flagRackArrival(
  sql: Sql,
  userId: string,
  assetId: number,
  prev: { site: string; pallet: string | null; level: number | null; line_no: number | null; status: string },
): Promise<void> {
  const role = await roleOf(sql, userId);
  if (!role.warehouse || role.admin) return;
  const row = await sql.query<{ id: number; model: string; serial: string | null; pallet: string | null; level: number | null }>(
    "select id, model, serial, pallet, level from assets where id = $1",
    [assetId],
  );
  const asset = row[0];
  if (!asset?.pallet || asset.level == null) return;
  await sql.query(
    `update assets set
       review_status = 'pending',
       review_note = null,
       review_actor = $2,
       review_origin = 'moved',
       review_from_site = $3,
       review_from_pallet = $4,
       review_from_level = $5,
       review_from_line = $6,
       review_from_status = $7,
       shop_test = coalesce(shop_test, 'needs-test')
     where id = $1`,
    [assetId, userId, prev.site, prev.pallet, prev.level, prev.line_no, prev.status],
  );
  await notifyAdminsRackReview(sql, userId, {
    id: asset.id,
    model: asset.model,
    serial: asset.serial,
    slot: slotId(String(asset.pallet).toUpperCase(), Number(asset.level)),
  });
}

const reviewInput = z.object({
  id: z.number().int().positive(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().nullable().optional(),
});

export const reviewRackUnit = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof reviewInput>) => reviewInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    const role = await roleOf(sql, context.userId);
    if (!role.admin) throw new Error("Only an admin can review a rack add.");
    const rows = await sql.query<{
      id: number;
      model: string;
      serial: string | null;
      review_status: string | null;
      review_actor: string | null;
      review_origin: string | null;
      review_from_site: string | null;
      review_from_pallet: string | null;
      review_from_level: number | null;
      review_from_line: number | null;
      review_from_status: string | null;
    }>(
      `select id, model, serial, review_status, review_actor, review_origin,
              review_from_site, review_from_pallet, review_from_level, review_from_line, review_from_status
         from assets where id = $1`,
      [data.id],
    );
    const asset = rows[0];
    if (!asset) throw new Error("Unit not found");
    if (asset.review_status !== "pending") throw new Error("This unit is not waiting for review.");
    if (data.decision === "approve") {
      await sql.query(
        `update assets set review_status = 'approved', review_note = null, updated_at = now() where id = $1`,
        [asset.id],
      );
      return { ok: true };
    }
    const note = (data.note ?? "").trim();
    if (!note) throw new Error("Reject needs a short note.");
    if (asset.review_origin === "created") {
      await sql.query("delete from assets where id = $1", [asset.id]);
    } else {
      await sql.query(
        `update assets set
           review_status = 'rejected',
           review_note = $2,
           status = coalesce($3, status),
           site = coalesce($4, site),
           pallet = $5,
           level = $6,
           line_no = $7,
           updated_at = now()
         where id = $1`,
        [
          asset.id,
          note,
          asset.review_from_status,
          asset.review_from_site,
          asset.review_from_pallet,
          asset.review_from_level,
          asset.review_from_line,
        ],
      );
    }
    if (asset.review_actor) {
      const serial = asset.serial ? ` SN ${asset.serial}` : "";
      await sql.query(
        `insert into desk_notifications (user_id, from_user_id, from_name, body, entity_type, entity_id)
         values ($1, $2, $3, $4, 'asset', $5)`,
        [
          asset.review_actor,
          context.userId,
          role.name,
          `Rejected ${asset.model}${serial}. ${note}`,
          asset.review_origin === "created" ? null : asset.id,
        ],
      );
    }
    return { ok: true };
  });

const testInput = z.object({
  id: z.number().int().positive(),
  shopTest: z.enum(["needs-test", "tested"]),
  note: z.string().nullable().optional(),
});

export const setShopTest = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof testInput>) => testInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    const role = await requireStock(sql, context.userId);
    const note = (data.note ?? "").trim() || null;
    if (data.shopTest === "tested") {
      await sql.query(
        `update assets set shop_test = 'tested', shop_test_note = $2, shop_test_by = $3, shop_test_at = now(), updated_at = now()
         where id = $1`,
        [data.id, note, role.name],
      );
    } else {
      await sql.query(
        `update assets set shop_test = 'needs-test', shop_test_note = $2, shop_test_by = null, shop_test_at = null, updated_at = now()
         where id = $1`,
        [data.id, note],
      );
    }
    return { ok: true };
  });
