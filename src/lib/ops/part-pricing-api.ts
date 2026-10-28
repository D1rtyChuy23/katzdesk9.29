import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
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
import { binRowsFromSheets, binsToApply, binTemplateCsv, binTemplateFileName, planBins, type BinPlanLine, type BinPlanStatus, type StoredBinPart } from "@/lib/ops/part-bins";
import { partPowers } from "@/lib/ops/parts-api";

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

/**
 * Every sheet as rows of cell text. With `datesAsText`, a date cell reads as m/d/yyyy whatever its format, so the
 * Bin Locations import can tell a bin Excel turned into a date (1-2-7 becomes 1/2/2007) from a real code.
 */
function readSheets(base64: string, { datesAsText = false }: { datesAsText?: boolean } = {}) {
  if (base64.length > 24_000_000) throw new Error("That file is too large.");
  const wb = XLSX.read(base64, { type: "base64", raw: true, cellText: true, cellNF: datesAsText });
  if (datesAsText) {
    for (const ws of Object.values(wb.Sheets)) {
      for (const [addr, c] of Object.entries(ws)) {
        if (addr.startsWith("!") || !c || typeof c !== "object") continue;
        const cell = c as XLSX.CellObject;
        if (cell.t === "n" && typeof cell.v === "number" && typeof cell.z === "string" && XLSX.SSF.is_date(cell.z)) cell.w = XLSX.SSF.format("m/d/yyyy", cell.v);
      }
    }
  }
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: false, raw: false }),
  }));
  if (!sheets.length) throw new Error("The file is empty.");
  return sheets;
}

async function storedParts(sql: Sql): Promise<StoredPart[]> {
  const rows = await sql.query<{ id: number; sku: string; item: string; mfr_part: string | null; description: string | null; rate: string | null; cost: string | null; list_price: string | null; hidden: boolean; item_class: string | null; active: boolean; merged_sku: string | null }>(
    `select b.id, b.sku, b.item, b.mfr_part, b.description, b.rate, b.cost, b.list_price, (b.hidden_at is not null) as hidden, b.item_class, b.active,
            k.sku as merged_sku
       from billing_items b
       left join billing_items k on k.id = b.merged_into`,
  );
  const n = (v: string | null) => (v == null ? null : Number(v));
  return rows.map((r) => ({
    id: Number(r.id),
    sku: r.sku,
    item: r.item,
    mpn: r.mfr_part,
    description: r.description,
    rate: n(r.rate),
    cost: n(r.cost),
    listPrice: n(r.list_price),
    hidden: flagOn(r.hidden),
    itemClass: r.item_class,
    active: flagOn(r.active),
    mergedIntoSku: r.merged_sku,
  }));
}

const fileInput = { filename: z.string().max(300), base64: z.string().min(4), apply: z.boolean() };
// No zod max on the file: readSheets refuses one over 24,000,000 characters in plain English (a zod message would
// reach the toast as JSON).
const binFileInput = z.object(fileInput);

// ------------------------------------------------------------------------------------------ parts import

export type PartsPreview = {
  filename: string;
  rowCount: number;
  added: number;
  updated: number;
  same: number;
  /** Lines shown and left out: an MPN two parts already share, or a new SKU another part already has. */
  notApplied: number;
  /** Hidden parts in the file. They are not added, not updated, and not un-hidden. */
  hiddenSkipped: number;
  /** Rows whose class is not one of the five: not added; a part already listed is moved off the active list. */
  notKept: number;
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
    const order: Record<PartPlanStatus, number> = { update: 1, new: 2, not_kept: 3, hidden: 4, shared_mpn: 5, sku_taken: 6, same: 9 };
    const preview: PartsPreview = {
      filename: data.filename,
      rowCount: read.rows.length,
      added: count("new"),
      updated: count("update"),
      same: count("same"),
      notApplied: count("shared_mpn") + count("sku_taken"),
      hiddenSkipped: count("hidden"),
      notKept: count("not_kept"),
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

    // Approved: the same plan, written in batches. Blank cells keep what is stored; hidden parts stay as they are.
    const CHUNK = 500;
    const updates = plan.filter((p) => p.status === "update" && p.partId != null);
    for (let i = 0; i < updates.length; i += CHUNK) {
      const part = updates.slice(i, i + CHUNK);
      await sql.query(
        `update billing_items b set
           mfr_part = s.mpn,
           description = coalesce(s.description, b.description),
           rate = coalesce(s.rate, b.rate),
           cost = coalesce(s.cost, b.cost),
           item_class = coalesce(s.cls, b.item_class),
           source_class = coalesce(s.src, b.source_class),
           kind = case when s.cls is not null and b.kind not in ('trip', 'labor') then s.kind else b.kind end,
           active = coalesce(s.active, b.active),
           updated_at = now()
          from unnest($1::int[], $2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::text[], $7::text[], $8::boolean[], $9::text[])
               as s(id, mpn, description, rate, cost, cls, kind, active, src)
         where b.id = s.id and b.hidden_at is null`,
        [
          part.map((p) => p.partId),
          part.map((p) => p.row.mpn),
          part.map((p) => p.row.description),
          part.map((p) => p.row.rate),
          part.map((p) => p.row.cost),
          part.map((p) => p.row.cls),
          part.map((p) => p.row.kind),
          part.map((p) => p.row.active),
          part.map((p) => p.row.sourceClass),
        ],
      );
    }
    // A class outside the five: the part is moved off the active list (it stays on the record, MPN kept).
    const off = plan.filter((p) => p.status === "not_kept" && p.partId != null).map((p) => p.partId);
    for (let i = 0; i < off.length; i += CHUNK) {
      await sql.query("update billing_items set active = false, updated_at = now() where id = any($1::int[]) and hidden_at is null", [off.slice(i, i + CHUNK)]);
    }
    const adds = plan.filter((p) => p.status === "new");
    for (let i = 0; i < adds.length; i += CHUNK) {
      const part = adds.slice(i, i + CHUNK).map((p) => ({ ...p.row, sku: p.row.sku ?? p.row.mpn }));
      await sql.query(
        `insert into billing_items (sku, parent, item, description, rate, cost, kind, mfr_part, item_class, source_class, active)
         select s.sku, s.parent, s.item, s.description, s.rate, s.cost, s.kind, s.mpn, s.cls, s.src, coalesce(s.active, true)
           from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[], $6::numeric[], $7::text[], $8::text[], $9::text[], $10::boolean[], $11::text[])
                as s(sku, parent, item, description, rate, cost, kind, mpn, cls, active, src)
         on conflict do nothing`,
        [
          part.map((r) => r.sku),
          part.map((r) => r.parent),
          part.map((r) => itemFullName(r.sku, r.parent)),
          part.map((r) => r.description),
          part.map((r) => r.rate),
          part.map((r) => r.cost),
          part.map((r) => r.kind),
          part.map((r) => r.mpn),
          part.map((r) => r.cls),
          part.map((r) => r.active),
          part.map((r) => r.sourceClass),
        ],
      );
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
  /** Hidden parts in the file. Their price is not changed and they stay hidden. */
  hiddenSkipped: number;
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
    const order: Record<PricePlanLine["status"], number> = { change: 1, hidden: 2, no_match: 3, shared_mpn: 4, same: 5 };
    const preview: PricingPreview = {
      filename: data.filename,
      target: data.target,
      targetLabel: PRICE_TARGET_LABEL[data.target],
      rowCount: read.rows.length,
      changes: count("change"),
      same: count("same"),
      noMatch: count("no_match"),
      sharedMpn: count("shared_mpn"),
      hiddenSkipped: count("hidden"),
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
      await sql.query(`update billing_items b set ${set}, updated_at = now() from unnest($1::int[], $2::numeric[]) as s(id, price) where b.id = s.id and b.hidden_at is null`, [ids, prices]);
    }
    await sql.query(
      "insert into part_import_runs (kind, filename, target, row_count, updated, not_applied, approved_by) values ('pricing', $1, $2, $3, $4, $5, $6)",
      [data.filename, data.target, preview.rowCount, apply.length, preview.noMatch + preview.sharedMpn, who],
    );
    return { ...preview, applied: true };
  });

// ------------------------------------------------------------------------------------------ bin locations

/** Most parts the Bin Template lists. */
const BIN_TEMPLATE_MAX = 50_000;

/**
 * The parts a Bin Locations file can reach: the ones on the Parts list (active, not hidden, not trip or labor).
 * Matching reads them all (as the other imports do), so no part is missed and no shared MPN looks unique.
 */
async function storedBinParts(sql: Sql, limit: number | null = null): Promise<StoredBinPart[]> {
  const rows = await sql.query<{ id: number; sku: string; mfr_part: string | null; description: string | null; bin_rack: string | null; bin_shelf: string | null; bin_bin: string | null }>(
    `select id, sku, mfr_part, description, bin_rack, bin_shelf, bin_bin
       from billing_items
      where active and hidden_at is null and kind not in ('trip', 'labor')
      order by lower(sku)
      limit $1`,
    [limit],
  );
  return rows.map((r) => ({ id: Number(r.id), sku: r.sku, mpn: r.mfr_part, description: r.description, rack: r.bin_rack, shelf: r.bin_shelf, bin: r.bin_bin }));
}

export type BinsPreview = {
  filename: string;
  rowCount: number;
  update: number;
  same: number;
  unmatched: number;
  /** The part number fits two or more parts, or its MPN and SKU point at different parts. */
  ambiguous: number;
  /** Rows with no rack, shelf or bin. */
  blank: number;
  /** The same part on a later row: the first row is used. */
  duplicates: number;
  tooLong: number;
  /** Values that look like a date Excel made of a bin: not applied. */
  dates: number;
  /** Rows with no part number. */
  skipped: number;
  applied: boolean;
  /** Every row except Blank ones, changes first, up to 500. */
  lines: BinPlanLine[];
};

const BIN_ORDER: Record<BinPlanStatus, number> = { update: 1, ambiguous: 2, unmatched: 3, date: 4, too_long: 5, duplicate: 6, same: 7, blank: 8 };

/**
 * Bin Locations: a CSV or Excel file of part numbers and Rack / Shelf / Bin. With apply false nothing is written:
 * that is the preview. Save sends the file again; it is planned again against what is stored now and written in
 * one statement, so either every change lands or none does. Admin only for now (Chuy, 10/28), like every bin edit.
 */
export const importPartBins = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof binFileInput>) => binFileInput.parse(d))
  .handler(async ({ data, context }): Promise<BinsPreview> => importPartBinsFor(await ready(), data, context.userId));

/** The body of importPartBins. */
export async function importPartBinsFor(sql: Sql, data: z.infer<typeof binFileInput>, userId: string): Promise<BinsPreview> {
  const who = await partPowers(sql, userId);
  if (!who.canEditBins) throw new Error("Only an Admin can change bin locations.");
  const read = binRowsFromSheets(readSheets(data.base64, { datesAsText: true }));
  if (!read.rows.length) throw new Error("No part numbers under the header.");
  if (read.rows.length > 50_000) throw new Error("Up to 50,000 rows at a time.");
  const plan = planBins(read.rows, await storedBinParts(sql));
  const count = (st: BinPlanStatus) => plan.filter((l) => l.status === st).length;
  const preview: BinsPreview = {
    filename: data.filename,
    rowCount: read.rows.length,
    update: count("update"),
    same: count("same"),
    unmatched: count("unmatched"),
    ambiguous: count("ambiguous"),
    blank: count("blank"),
    duplicates: count("duplicate"),
    tooLong: count("too_long"),
    dates: count("date"),
    skipped: read.skipped,
    applied: false,
    lines: plan
      .filter((l) => l.status !== "blank")
      .sort((a, b) => BIN_ORDER[a.status] - BIN_ORDER[b.status] || a.line - b.line)
      .slice(0, 500),
  };
  if (!data.apply) return preview;

  // The file's own values go in; a blank piece (null) keeps what is stored at the moment of writing, except on a
  // whole-location row (s.whole), which writes all three pieces as they are.
  const apply = binsToApply(plan);
  const written = apply.length
    ? await sql.query<{ id: number }>(
        `update billing_items b
            set bin_rack = case when s.whole then s.rack else coalesce(s.rack, b.bin_rack) end,
                bin_shelf = case when s.whole then s.shelf else coalesce(s.shelf, b.bin_shelf) end,
                bin_bin = case when s.whole then s.bin else coalesce(s.bin, b.bin_bin) end,
                bin_updated_at = now(), bin_updated_by = $6, updated_at = now()
           from (select * from unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::boolean[]) as u(id, rack, shelf, bin, whole)) s
          where b.id = s.id and b.hidden_at is null
            and (case when s.whole then s.rack else coalesce(s.rack, b.bin_rack) end,
                 case when s.whole then s.shelf else coalesce(s.shelf, b.bin_shelf) end,
                 case when s.whole then s.bin else coalesce(s.bin, b.bin_bin) end) is distinct from (b.bin_rack, b.bin_shelf, b.bin_bin)
        returning b.id`,
        [apply.map((l) => l.partId), apply.map((l) => l.file.rack), apply.map((l) => l.file.shelf), apply.map((l) => l.file.bin), apply.map((l) => l.whole), who.name],
      )
    : [];
  return { ...preview, update: written.length, applied: true };
}

/**
 * The Bin Template: MPN, SKU, Description and the current Rack, Shelf and Bin of every part on the Parts list, up
 * to 50,000 by SKU (`more` says the list has more; the import still matches every part). Admin, like the import.
 */
export const partBinTemplate = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ filename: string; base64: string; rows: number; more: boolean }> => {
    const sql = await ready();
    if (!(await partPowers(sql, context.userId)).canEditBins) throw new Error("Only an Admin can download the Bin Template.");
    const all = await storedBinParts(sql, BIN_TEMPLATE_MAX + 1);
    const parts = all.slice(0, BIN_TEMPLATE_MAX);
    const csv = binTemplateCsv(parts);
    return { filename: binTemplateFileName(new Date().toISOString().slice(0, 10)), base64: Buffer.from(csv, "utf8").toString("base64"), rows: parts.length, more: all.length > parts.length };
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
