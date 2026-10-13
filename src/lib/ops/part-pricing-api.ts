import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { itemFullName } from "@/lib/ops/charges";
import {
  PRICE_TARGET_LABEL,
  cleanRule,
  partRowsFromSheets,
  planPartImport,
  planPricing,
  priceRowsFromSheets,
  pricingToApply,
  ruleLabel,
  type DiscountRule,
  type PartPlanStatus,
  type PricePlanLine,
  type PriceTarget,
  type StoredPart,
} from "@/lib/ops/part-pricing";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireAdmin(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can import parts or prices.");
  const row = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0];
  return row?.username || "Admin";
}

function readSheets(base64: string) {
  if (base64.length > 24_000_000) throw new Error("That file is too large.");
  const wb = XLSX.read(base64, { type: "base64", raw: true, cellText: true });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: false, raw: false }),
  }));
  if (!sheets.length) throw new Error("The file is empty.");
  return sheets;
}

async function storedParts(sql: Sql): Promise<StoredPart[]> {
  const rows = await sql.query<{ id: number; sku: string; item: string; mfr_part: string | null; description: string | null; rate: string | null; cost: string | null; list_price: string | null }>(
    "select id, sku, item, mfr_part, description, rate, cost, list_price from billing_items",
  );
  const n = (v: string | null) => (v == null ? null : Number(v));
  return rows.map((r) => ({ id: Number(r.id), sku: r.sku, item: r.item, mpn: r.mfr_part, description: r.description, rate: n(r.rate), cost: n(r.cost), listPrice: n(r.list_price) }));
}

const fileInput = { filename: z.string().max(300), base64: z.string().min(4), apply: z.boolean() };

// ------------------------------------------------------------------------------------------ parts import

export type PartsPreview = {
  filename: string;
  rowCount: number;
  added: number;
  updated: number;
  same: number;
  /** Lines shown and left out: an MPN two parts already share, or a new SKU another part already has. */
  notApplied: number;
  duplicatesInFile: number;
  skipped: number;
  applied: boolean;
  lines: { status: PartPlanStatus; mpn: string; sku: string; description: string | null; changes: string[]; reason: string | null }[];
};

/**
 * Import Parts (NetSuite): Excel, matched on MPN. An MPN already on a part updates that part; a new MPN adds a
 * part. Never a second part for the same MPN. With apply false nothing is written: that is the approval preview.
 */
export const importPartsNetsuite = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string; apply: boolean }) => z.object(fileInput).parse(d))
  .handler(async ({ data, context }): Promise<PartsPreview> => {
    const sql = await ready();
    const who = await requireAdmin(sql, context.userId);
    const read = partRowsFromSheets(readSheets(data.base64));
    if (!read.rows.length) throw new Error("No parts under the header.");
    if (read.rows.length > 50_000) throw new Error("Up to 50,000 parts at a time.");
    const plan = planPartImport(read.rows, await storedParts(sql));
    const count = (s: PartPlanStatus) => plan.filter((p) => p.status === s).length;
    const order: Record<PartPlanStatus, number> = { update: 1, new: 2, shared_mpn: 3, sku_taken: 4, same: 9 };
    const preview: PartsPreview = {
      filename: data.filename,
      rowCount: read.rows.length,
      added: count("new"),
      updated: count("update"),
      same: count("same"),
      notApplied: count("shared_mpn") + count("sku_taken"),
      duplicatesInFile: read.duplicates,
      skipped: read.skipped,
      applied: false,
      lines: plan
        .filter((p) => p.status !== "same")
        .sort((a, b) => order[a.status] - order[b.status])
        .slice(0, 500)
        .map((p) => ({ status: p.status, mpn: p.row.mpn, sku: p.row.sku ?? p.row.mpn, description: p.row.description, changes: p.changes, reason: p.reason })),
    };
    if (!data.apply) return preview;

    // Approved: the same plan, written. Blank cells keep what is stored.
    for (const p of plan) {
      const r = p.row;
      if (p.status === "update" && p.partId != null) {
        await sql.query(
          `update billing_items set
             mfr_part = $2,
             description = coalesce($3, description),
             rate = coalesce($4, rate),
             cost = coalesce($5, cost),
             updated_at = now()
           where id = $1`,
          [p.partId, r.mpn, r.description, r.rate, r.cost],
        );
      } else if (p.status === "new") {
        const sku = r.sku ?? r.mpn;
        await sql.query(
          `insert into billing_items (sku, parent, item, description, rate, cost, kind, mfr_part)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict do nothing`,
          [sku, r.parent, itemFullName(sku, r.parent), r.description, r.rate, r.cost, r.kind, r.mpn],
        );
      }
    }
    await sql.query(
      "insert into part_import_runs (kind, filename, row_count, added, updated, not_applied, approved_by) values ('parts', $1, $2, $3, $4, $5, $6)",
      [data.filename, preview.rowCount, preview.added, preview.updated, preview.notApplied, who],
    );
    return { ...preview, applied: true };
  });

// ------------------------------------------------------------------------------------------ pricing file

export type PricingPreview = {
  filename: string;
  target: PriceTarget;
  targetLabel: string;
  rowCount: number;
  changes: number;
  same: number;
  noMatch: number;
  sharedMpn: number;
  duplicatesInFile: number;
  skipped: number;
  applied: boolean;
  /** Every row: MPN, old price, new price. No Match rows stay here and are never written. */
  lines: PricePlanLine[];
};

/** Update Part Pricing: Excel with MPN and price, matched on MPN only. Nothing is written until Approve (apply true). */
export const importPartPricing = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string; apply: boolean; target: PriceTarget }) =>
    z.object({ ...fileInput, target: z.enum(["list", "sell"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PricingPreview> => {
    const sql = await ready();
    const who = await requireAdmin(sql, context.userId);
    const read = priceRowsFromSheets(readSheets(data.base64));
    if (!read.rows.length) throw new Error("No prices under the header.");
    if (read.rows.length > 50_000) throw new Error("Up to 50,000 prices at a time.");
    const plan = planPricing(read.rows, await storedParts(sql), data.target);
    const count = (s: PricePlanLine["status"]) => plan.filter((p) => p.status === s).length;
    const order: Record<PricePlanLine["status"], number> = { change: 1, no_match: 2, shared_mpn: 3, same: 4 };
    const preview: PricingPreview = {
      filename: data.filename,
      target: data.target,
      targetLabel: PRICE_TARGET_LABEL[data.target],
      rowCount: read.rows.length,
      changes: count("change"),
      same: count("same"),
      noMatch: count("no_match"),
      sharedMpn: count("shared_mpn"),
      duplicatesInFile: read.duplicates,
      skipped: read.skipped,
      applied: false,
      lines: [...plan].sort((a, b) => order[a.status] - order[b.status] || a.mpn.localeCompare(b.mpn)).slice(0, 5000),
    };
    if (!data.apply) return preview;

    const apply = pricingToApply(plan);
    const CHUNK = 500;
    for (let i = 0; i < apply.length; i += CHUNK) {
      const part = apply.slice(i, i + CHUNK);
      const ids = part.map((l) => l.partId!);
      const prices = part.map((l) => l.newPrice);
      const set = data.target === "list" ? "list_price = s.price, list_price_at = now()" : "rate = s.price";
      await sql.query(`update billing_items b set ${set}, updated_at = now() from unnest($1::int[], $2::numeric[]) as s(id, price) where b.id = s.id`, [ids, prices]);
    }
    await sql.query(
      "insert into part_import_runs (kind, filename, target, row_count, updated, not_applied, approved_by) values ('pricing', $1, $2, $3, $4, $5, $6)",
      [data.filename, data.target, preview.rowCount, apply.length, preview.noMatch + preview.sharedMpn, who],
    );
    return { ...preview, applied: true };
  });

// ------------------------------------------------------------------------------------------ discount rule

const RULE_KEY = "our_discount_rule";

export async function loadDiscountRule(sql: Sql): Promise<DiscountRule | null> {
  const row = (await sql.query<{ value: string | null }>("select value from desk_settings where key = $1", [RULE_KEY]))[0];
  if (!row?.value) return null;
  try {
    const r = cleanRule(JSON.parse(row.value));
    return "rule" in r ? r.rule : null;
  } catch {
    return null;
  }
}

export const getDiscountRule = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ rule: DiscountRule | null; label: string; canEdit: boolean }> => {
    const sql = await ready();
    const rule = await loadDiscountRule(sql);
    return { rule, label: ruleLabel(rule), canEdit: await canReviewNames(sql, context.userId) };
  });

/** Our Discount Rule: percent off the manufacturer price, or a fixed amount off it. Admin only. Blank clears it. */
export const setDiscountRule = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { mode: string; value: string | number; note?: string }) =>
    z.object({ mode: z.string().max(20), value: z.union([z.string().max(30), z.number()]), note: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ rule: DiscountRule | null; label: string; canEdit: boolean }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    const r = cleanRule(data);
    if ("error" in r) throw new Error(r.error);
    if (!r.rule) await sql.query("delete from desk_settings where key = $1", [RULE_KEY]);
    else {
      await sql.query(
        `insert into desk_settings (key, value, updated_at) values ($1, $2, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [RULE_KEY, JSON.stringify(r.rule)],
      );
    }
    return { rule: r.rule, label: ruleLabel(r.rule), canEdit: true };
  });
