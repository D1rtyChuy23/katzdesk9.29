import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { serialKey } from "@/lib/ops/account-equip";
import { isWalkIn } from "@/lib/ops/customer-key";
import { flagOn } from "@/lib/ops/flag";
import { notifyAdminsStockRequest } from "@/lib/ops/notify";
import { requireStock } from "@/lib/ops/rack-stock";
import {
  customerLocationMessage,
  isWarehouseStockPlace,
  removeReasonError,
} from "@/lib/ops/stock-action-rules";
import { CUSTOMER_SITES, electricalFrom, unitPlaceLabel } from "@/lib/ops/unit-place-rules";
import { SITE_LABEL, SITE_PURPOSE } from "@/lib/ops/warehouse";

type Hold = "remove" | "assign";

type AssetRow = {
  id: number;
  model: string;
  serial: string | null;
  status: string;
  site: string;
  pallet: string | null;
  level: number | null;
  line_no: number | null;
  notes: string | null;
  purpose: string | null;
  sold_to: string | null;
  stock_hold: string | null;
};

type ActionRow = {
  id: number;
  asset_id: number;
  kind: Hold;
  status: string;
  reason: string | null;
  note: string | null;
  customer: string | null;
  place_site: string | null;
  serial: string | null;
  model: string | null;
  last_slot: string | null;
  asked_by: string;
  asked_name: string | null;
};

async function ready() {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  const sql = await getSql();
  await ensureStockSchema(sql);
  return sql;
}

export async function ensureStockSchema(sql: Sql) {
  await sql.query(`
    create table if not exists asset_stock_actions (
      id            serial primary key,
      asset_id      int not null,
      kind          text not null,
      status        text not null,
      reason        text,
      note          text,
      customer      text,
      place_site    text,
      serial        text,
      model         text,
      last_slot     text,
      last_site     text,
      last_pallet   text,
      last_level    int,
      last_line     int,
      asked_by      text not null,
      asked_name    text,
      asked_at      timestamptz not null default now(),
      decided_by    text,
      decided_name  text,
      decided_at    timestamptz
    )`);
  await sql.query("alter table assets add column if not exists stock_hold text");
  await sql.query("alter table assets add column if not exists stock_hold_customer text");
  await sql.query("alter table assets add column if not exists stock_hold_reason text");
  await sql.query("alter table assets add column if not exists stock_hold_note text");
  await sql.query("alter table assets add column if not exists stock_hold_by text");
}

async function actorOf(sql: Sql, userId: string) {
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

const ASSET_COLS = `id, model, serial, status, site, pallet, level, line_no, notes, purpose, sold_to, stock_hold`;

async function loadAsset(sql: Sql, id: number): Promise<AssetRow | null> {
  const rows = await sql.query<AssetRow>(`select ${ASSET_COLS} from assets where id = $1`, [id]);
  return rows[0] ?? null;
}

function slotOf(row: AssetRow): string {
  return unitPlaceLabel({
    site: row.site,
    pallet: row.pallet,
    level: row.level,
    status: row.status,
    soldTo: row.sold_to,
    purpose: row.purpose,
  });
}

function stamped(who: string): string {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  return `${who} · ${when}`;
}

function withLine(notes: string | null, line: string): string {
  const base = (notes ?? "").trim();
  return base ? `${base}\n${line}` : line;
}

/** A pending remove or assign stays in its slot until an admin decides. */
export async function assertNotHeld(sql: Sql, id: number) {
  await ensureStockSchema(sql);
  const rows = await sql.query<{ stock_hold: string | null }>(
    "select stock_hold from assets where id = $1",
    [id],
  );
  if (rows[0]?.stock_hold) {
    throw new Error("This unit is waiting on approval. The slot stays until then.");
  }
}

async function accountHolding(sql: Sql, row: AssetRow): Promise<string | null> {
  if ((CUSTOMER_SITES as readonly string[]).includes(row.site)) {
    return SITE_LABEL[row.site] ?? row.site;
  }
  if (row.status === "sold" || row.status === "assigned" || (row.sold_to && !isWarehouseStockPlace(row.site))) {
    return row.sold_to?.trim() || "a customer account";
  }
  const key = serialKey(row.serial);
  if (!key) return null;
  const listed = await sql.query<{ customer: string }>(
    "select customer from account_equipment where serial_key = $1 order by id limit 1",
    [key],
  );
  return listed[0]?.customer?.trim() || null;
}

async function assertRemovable(sql: Sql, row: AssetRow) {
  if (!isWarehouseStockPlace(row.site)) {
    const holding = await accountHolding(sql, row);
    if (holding) throw new Error(customerLocationMessage(holding));
    throw new Error("Remove is only for a unit on a rack, in staging, training, or the lobby.");
  }
  const holding = await accountHolding(sql, row);
  if (holding) throw new Error(customerLocationMessage(holding));
}

async function pendingFor(sql: Sql, assetId: number): Promise<ActionRow | null> {
  const rows = await sql.query<ActionRow>(
    `select id, asset_id, kind, status, reason, note, customer, place_site, serial, model, last_slot, asked_by, asked_name
       from asset_stock_actions
      where asset_id = $1 and status = 'pending'
      order by id desc
      limit 1`,
    [assetId],
  );
  return rows[0] ?? null;
}

async function clearHold(sql: Sql, id: number) {
  await sql.query(
    `update assets set
        stock_hold = null,
        stock_hold_customer = null,
        stock_hold_reason = null,
        stock_hold_note = null,
        stock_hold_by = null,
        updated_at = now()
      where id = $1`,
    [id],
  );
}

async function finalizeRemove(sql: Sql, row: AssetRow, reason: string, note: string, asked: string, approved: string) {
  const slot = slotOf(row);
  const extra = note ? ` · ${note}` : "";
  const line = `Removed from ${slot} · ${reason}${extra} · asked ${asked} · approved ${approved} · ${stamped(approved)}`;
  await sql.query(
    `update assets set
        status = 'removed',
        site = 'removed',
        pallet = null,
        level = null,
        line_no = null,
        notes = $2,
        stock_hold = null,
        stock_hold_customer = null,
        stock_hold_reason = null,
        stock_hold_note = null,
        stock_hold_by = null,
        updated_at = now()
      where id = $1`,
    [row.id, withLine(row.notes, line)],
  );
}

async function putOnAccount(sql: Sql, customer: string, model: string, serial: string | null, notes: string | null) {
  const key = serialKey(serial);
  const electrical = electricalFrom(notes);
  if (key) {
    const existing = await sql.query<{ id: number }>(
      "select id from account_equipment where serial_key = $1 order by id limit 1",
      [key],
    );
    if (existing[0]) {
      await sql.query(
        `update account_equipment set
            customer = $2,
            catalog_model = $3,
            equipment_name = $3,
            serial = $4,
            electrical = coalesce($5, electrical),
            updated_at = now()
          where id = $1`,
        [existing[0].id, customer, model, serial?.trim() || null, electrical],
      );
      return;
    }
  }
  await sql.query(
    `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, electrical)
     values ($1, $2, $2, $3, $4, $5)`,
    [customer, model, serial?.trim() || null, key || null, electrical],
  );
}

async function finalizeAssign(
  sql: Sql,
  row: AssetRow,
  customer: string,
  placeSite: string | null,
  asked: string,
  approved: string,
) {
  const slot = slotOf(row);
  const site = placeSite || "account";
  const status = placeSite ? "deployed" : "at-account";
  const purpose = placeSite ? SITE_PURPOSE[placeSite] ?? row.purpose : row.purpose;
  const where = placeSite ? SITE_LABEL[placeSite] ?? placeSite : "the account";
  const line = `Assigned to ${customer}${placeSite ? ` · ${where}` : ""} from ${slot} · asked ${asked} · approved ${approved} · ${stamped(approved)}`;
  await sql.query(
    `update assets set
        status = $2,
        site = $3,
        pallet = null,
        level = null,
        line_no = null,
        sold_to = $4,
        purpose = $5,
        notes = $6,
        stock_hold = null,
        stock_hold_customer = null,
        stock_hold_reason = null,
        stock_hold_note = null,
        stock_hold_by = null,
        updated_at = now()
      where id = $1`,
    [row.id, status, site, customer, purpose, withLine(row.notes, line)],
  );
  await putOnAccount(sql, customer, row.model, row.serial, row.notes);
}

async function resolveCustomer(sql: Sql, raw: string): Promise<string> {
  const name = raw.trim();
  if (!name) throw new Error("Pick an account.");
  if (isWalkIn(name)) {
    throw new Error("Pick a real account. Walk-In is not a KatzDesk customer. Add the café first.");
  }
  const rows = await sql.query<{ name: string }>(
    "select name from directory_customers where archived = false and lower(name) = lower($1) limit 1",
    [name],
  );
  if (!rows[0]) throw new Error("Pick an account already on the customer list.");
  return rows[0].name;
}

function resolveSite(site: string | null | undefined): string | null {
  const value = (site ?? "").trim();
  if (!value) return null;
  if (!(CUSTOMER_SITES as readonly string[]).includes(value)) {
    throw new Error("Pick a site from equipment by location, or leave it blank.");
  }
  return value;
}

async function insertAction(
  sql: Sql,
  row: AssetRow,
  kind: Hold,
  status: "pending" | "approved",
  fields: { reason?: string | null; note?: string | null; customer?: string | null; placeSite?: string | null },
  askedBy: string,
  askedName: string,
  decidedBy: string | null,
  decidedName: string | null,
) {
  const rows = await sql.query<{ id: number }>(
    `insert into asset_stock_actions (
        asset_id, kind, status, reason, note, customer, place_site, serial, model,
        last_slot, last_site, last_pallet, last_level, last_line,
        asked_by, asked_name, decided_by, decided_name, decided_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, case when $3 = 'approved' then now() else null end
      ) returning id`,
    [
      row.id,
      kind,
      status,
      fields.reason ?? null,
      fields.note ?? null,
      fields.customer ?? null,
      fields.placeSite ?? null,
      row.serial,
      row.model,
      slotOf(row),
      row.site,
      row.pallet,
      row.level,
      row.line_no,
      askedBy,
      askedName,
      decidedBy,
      decidedName,
    ],
  );
  return rows[0]?.id ?? null;
}

const removeInput = z.object({
  id: z.number().int().positive(),
  reason: z.string(),
  note: z.string().nullable().optional(),
});

export const requestStockRemove = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof removeInput>) => removeInput.parse(d))
  .handler(async ({ data, context }): Promise<{ pending: boolean }> => {
    const sql = await ready();
    const role = await requireStock(sql, context.userId);
    const who = await actorOf(sql, context.userId);
    const row = await loadAsset(sql, data.id);
    if (!row) throw new Error("Unit not found");
    if (row.stock_hold) throw new Error("This unit is already waiting on approval.");
    if (await pendingFor(sql, row.id)) throw new Error("This unit is already waiting on approval.");
    const note = (data.note ?? "").trim();
    const err = removeReasonError(data.reason, note);
    if (err) throw new Error(err);
    await assertRemovable(sql, row);
    const warehouse = role.warehouse && !role.admin;
    if (warehouse) {
      await insertAction(sql, row, "remove", "pending", { reason: data.reason, note: note || null }, context.userId, who.name, null, null);
      await sql.query(
        `update assets set
            stock_hold = 'remove',
            stock_hold_reason = $2,
            stock_hold_note = $3,
            stock_hold_by = $4,
            stock_hold_customer = null,
            updated_at = now()
          where id = $1`,
        [row.id, data.reason, note || null, context.userId],
      );
      await notifyAdminsStockRequest(sql, context.userId, {
        id: row.id,
        model: row.model,
        serial: row.serial,
        slot: slotOf(row),
        kind: "remove",
        reason: data.reason,
      });
      return { pending: true };
    }
    await insertAction(
      sql,
      row,
      "remove",
      "approved",
      { reason: data.reason, note: note || null },
      context.userId,
      who.name,
      context.userId,
      who.name,
    );
    await finalizeRemove(sql, row, data.reason, note, who.name, who.name);
    return { pending: false };
  });

const assignInput = z.object({
  id: z.number().int().positive(),
  customer: z.string().min(1),
  site: z.string().nullable().optional(),
});

export const requestStockAssign = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof assignInput>) => assignInput.parse(d))
  .handler(async ({ data, context }): Promise<{ pending: boolean; customer: string }> => {
    const sql = await ready();
    const role = await requireStock(sql, context.userId);
    const who = await actorOf(sql, context.userId);
    const row = await loadAsset(sql, data.id);
    if (!row) throw new Error("Unit not found");
    if (!isWarehouseStockPlace(row.site)) {
      throw new Error("Assign starts from a unit on a rack, in staging, training, or the lobby.");
    }
    if (row.stock_hold) throw new Error("This unit is already waiting on approval.");
    if (await pendingFor(sql, row.id)) throw new Error("This unit is already waiting on approval.");
    const customer = await resolveCustomer(sql, data.customer);
    const placeSite = resolveSite(data.site);
    const warehouse = role.warehouse && !role.admin;
    if (warehouse) {
      await insertAction(
        sql,
        row,
        "assign",
        "pending",
        { customer, placeSite },
        context.userId,
        who.name,
        null,
        null,
      );
      await sql.query(
        `update assets set
            stock_hold = 'assign',
            stock_hold_customer = $2,
            stock_hold_reason = null,
            stock_hold_note = null,
            stock_hold_by = $3,
            updated_at = now()
          where id = $1`,
        [row.id, customer, context.userId],
      );
      await notifyAdminsStockRequest(sql, context.userId, {
        id: row.id,
        model: row.model,
        serial: row.serial,
        slot: slotOf(row),
        kind: "assign",
        customer,
      });
      return { pending: true, customer };
    }
    await insertAction(
      sql,
      row,
      "assign",
      "approved",
      { customer, placeSite },
      context.userId,
      who.name,
      context.userId,
      who.name,
    );
    await finalizeAssign(sql, row, customer, placeSite, who.name, who.name);
    return { pending: false, customer };
  });

const decideInput = z.object({
  id: z.number().int().positive(),
  decision: z.enum(["approve", "reject"]),
});

export const decideStockAction = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof decideInput>) => decideInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    const who = await actorOf(sql, context.userId);
    if (!who.admin) throw new Error("Only an admin can approve this.");
    const action = await pendingFor(sql, data.id);
    if (!action) throw new Error("This unit is not waiting on approval.");
    if (action.asked_by === context.userId) throw new Error("You can’t approve your own request.");
    const row = await loadAsset(sql, data.id);
    if (!row) throw new Error("Unit not found");
    if (data.decision === "reject") {
      await sql.query(
        `update asset_stock_actions set
            status = 'rejected',
            decided_by = $2,
            decided_name = $3,
            decided_at = now()
          where id = $1`,
        [action.id, context.userId, who.name],
      );
      await clearHold(sql, row.id);
      return { ok: true };
    }
    if (action.kind === "remove") {
      await assertRemovable(sql, row);
      await finalizeRemove(sql, row, action.reason || "Removed", (action.note ?? "").trim(), action.asked_name || "Warehouse", who.name);
    } else {
      const customer = action.customer?.trim();
      if (!customer) throw new Error("That request has no account.");
      await finalizeAssign(sql, row, customer, action.place_site, action.asked_name || "Warehouse", who.name);
    }
    await sql.query(
      `update asset_stock_actions set
          status = 'approved',
          decided_by = $2,
          decided_name = $3,
          decided_at = now()
        where id = $1`,
      [action.id, context.userId, who.name],
    );
    return { ok: true };
  });
