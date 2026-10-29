/**
 * Parts inventory: the NetSuite item list with its photo and MPN. The invoice picker reads the same photo.
 * Anyone with Desk access can add or replace a photo; only Admin and Sales change an MPN.
 * Hide is reversible and is not the `active` flag: the item import writes `active` and would undo a hide.
 * Remove is Admin only, and only when the part has never been on a charge or a quote.
 * The bin location (Rack, Shelf, Bin) and the Class are Admin only for now (Chuy, 10/28): on the part's row, in its
 * window, for several picked parts at once (Move Bin, Set Class), and the Bin Locations file. Everyone sees them, and
 * the Parts search finds a part by its bin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { cleanMpn } from "@/lib/ops/mpn-rules";
import { PART_CLASSES, isPartClass, type PartClass } from "@/lib/ops/part-pricing";
import { BIN_LABEL, BIN_MAX, BIN_PIECES, PARTS_PICK_MAX, binSearchCode, cleanBinValue, type BinValues } from "@/lib/ops/part-bins";
import { textArray } from "@/lib/ops/part-merges";
import { partImageError, sniffImage, MAX_PART_IMAGE_BYTES } from "@/lib/ops/part-images";
import { PART_USES_CTE } from "@/lib/ops/part-usage-api";
import { PART_NOTE_MAX, cleanPartNote } from "@/lib/ops/part-notes";
import type { ChargeKind } from "@/lib/ops/charges";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

type PartPowers = { canHide: boolean; canRemove: boolean; canEditMpn: boolean; canEditBins: boolean; canEditClass: boolean; canEditNote: boolean; name: string };

async function powers(sql: Sql, userId: string): Promise<PartPowers> {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const role = rows[0]?.desk_role ?? null;
  const admin = flagOn(rows[0]?.is_admin) || role === "admin";
  const canHide = admin || role === "sales";
  // The bin location and the Class are Admin only for now (Chuy, 10/28). The MPN, the part name and Hide stay Admin
  // and Sales.
  // The part's note (in its window) is Admin only too (Grok through Chuy, 10/29).
  return { canHide, canRemove: admin, canEditMpn: canHide, canEditBins: admin, canEditClass: admin, canEditNote: admin, name: rows[0]?.username?.trim() || "Desk" };
}

/**
 * Who may do what on Parts (the Bin Locations import uses it). canEditMpn covers the MPN and the part name;
 * canEditBins the bin location, canEditClass the Class and canEditNote the note (all three Admin only).
 */
export const partPowers = powers;

export type PartRow = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mpn: string | null;
  rate: number | null;
  /** Manufacturer price, from Update Part Pricing. */
  listPrice: number | null;
  kind: ChargeKind;
  hasImage: boolean;
  /** Changes when the photo does; part of the photo's address so a replaced photo is not stale. */
  imageVersion: string | null;
  hiddenAt: string | null;
  hiddenBy: string | null;
  hiddenReason: string | null;
  /** NetSuite Class as the item file has it. */
  itemClass: string | null;
  /** Marked to pull later. Does not change price or stock. */
  getLater: boolean;
  getLaterBy: string | null;
  /** "confirmed" once a photo was confirmed (same MPN on 3+ agreeing sources, or chosen by a person). */
  photoStatus: "confirmed" | null;
  photoSourceUrl: string | null;
  photoConfirmedBy: string | null;
  /** Photo research for this part number, when it has been researched. */
  research: PhotoResearch | null;
  /** Where the part sits in the stockroom; null pieces are not set. */
  binRack: string | null;
  binShelf: string | null;
  binBin: string | null;
  binUpdatedAt: string | null;
  binUpdatedBy: string | null;
  /** Old numbers merged into this part (10/28); searching one finds it. */
  previousNumbers: string[];
  /** The part's note, trimmed for showing: why parts were merged into it (the merge file), lines from Import Part Notes,
   * and what an Admin typed in its window. */
  mergeNote: string | null;
  /** The note exactly as stored. Saving an edit sends it back, so a line added meanwhile is never overwritten. */
  note: string | null;
  /** Set when this row was folded into another part (an import copy, or an old number): that part. */
  mergedInto: { id: number; sku: string } | null;
};

export type PhotoCandidate = { imageUrl: string; pageUrl: string | null; site: string | null; mpnShown: string | null; watermark?: boolean | null };
export type PhotoResearch = { verdict: "confirmed" | "review"; reason: string | null; imageUrl: string | null; candidates: PhotoCandidate[] };

type Raw = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mfr_part: string | null;
  rate: string | null;
  list_price: string | null;
  kind: ChargeKind;
  has_image: boolean;
  image_version: string | null;
  hidden_at: string | Date | null;
  hidden_by: string | null;
  hidden_reason: string | null;
  item_class: string | null;
  get_later: boolean | null;
  get_later_by: string | null;
  photo_status: string | null;
  photo_source_url: string | null;
  photo_confirmed_by: string | null;
  r_verdict: string | null;
  r_reason: string | null;
  r_image: string | null;
  r_candidates: unknown;
  bin_rack: string | null;
  bin_shelf: string | null;
  bin_bin: string | null;
  bin_updated_at: string | Date | null;
  bin_updated_by: string | null;
  previous_numbers: unknown;
  note: string | null;
  merged_into: number | null;
  merged_sku: string | null;
};

const COLS = `id, sku, item, description, mfr_part, rate, list_price, kind,
  (image is not null) as has_image,
  case when image is null then null else extract(epoch from image_updated_at)::bigint::text end as image_version,
  hidden_at, hidden_by, hidden_reason, item_class, get_later, get_later_by, photo_status, photo_source_url, photo_confirmed_by,
  r_verdict, r_reason, r_image, r_candidates, bin_rack, bin_shelf, bin_bin, bin_updated_at, bin_updated_by,
  previous_numbers, note, merged_into, (select mk.sku from billing_items mk where mk.id = billing_items.merged_into) as merged_sku`;

/** The part's photo research, found by its part number (MPN, else SKU) with case, spaces and punctuation removed. */
const FROM = `billing_items
  left join lateral (
    select pr.verdict as r_verdict, pr.reason as r_reason, pr.image_url as r_image, pr.candidates as r_candidates
      from part_photo_research pr
     where pr.mpn_key in (regexp_replace(upper(coalesce(billing_items.mfr_part, '')), '[^A-Z0-9]+', '', 'g'), regexp_replace(upper(billing_items.sku), '[^A-Z0-9]+', '', 'g'))
     order by (pr.mpn_key = regexp_replace(upper(coalesce(billing_items.mfr_part, '')), '[^A-Z0-9]+', '', 'g')) desc
     limit 1
  ) research on true`;

function candidatesOf(raw: unknown): PhotoCandidate[] {
  const list = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c.imageUrl === "string" && /^https:\/\//.test(c.imageUrl))
    .map((c) => ({ imageUrl: c.imageUrl, pageUrl: c.pageUrl ?? null, site: c.site ?? null, mpnShown: c.mpnShown ?? null, watermark: c.watermark ?? null }));
}

const whenHidden = (v: string | Date | null): string | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
};

const toRow = (r: Raw): PartRow => ({
  id: Number(r.id),
  sku: r.sku,
  item: r.item,
  description: r.description,
  mpn: r.mfr_part,
  rate: r.rate == null ? null : Number(r.rate),
  listPrice: r.list_price == null ? null : Number(r.list_price),
  kind: r.kind,
  hasImage: !!r.has_image,
  imageVersion: r.image_version,
  hiddenAt: whenHidden(r.hidden_at),
  hiddenBy: r.hidden_by,
  hiddenReason: r.hidden_reason,
  itemClass: r.item_class,
  getLater: !!r.get_later,
  getLaterBy: r.get_later_by,
  photoStatus: r.photo_status === "confirmed" && r.has_image ? "confirmed" : null,
  photoSourceUrl: r.photo_source_url,
  photoConfirmedBy: r.photo_confirmed_by,
  research:
    r.r_verdict === "confirmed" || r.r_verdict === "review"
      ? { verdict: r.r_verdict, reason: r.r_reason, imageUrl: r.r_image, candidates: candidatesOf(r.r_candidates) }
      : null,
  binRack: r.bin_rack,
  binShelf: r.bin_shelf,
  binBin: r.bin_bin,
  binUpdatedAt: whenHidden(r.bin_updated_at),
  binUpdatedBy: r.bin_updated_by,
  previousNumbers: textArray(r.previous_numbers),
  mergeNote: r.note?.trim() || null,
  note: r.note,
  mergedInto: r.merged_into == null ? null : { id: Number(r.merged_into), sku: r.merged_sku ?? "" },
});

export type PartsPage = {
  rows: PartRow[];
  total: number;
  withPhoto: number;
  hiddenCount: number;
  getLaterCount: number;
  /** Parts whose photo was confirmed by research and is ready to pull. */
  readyToPull: number;
  classes: string[];
  classCounts: Record<string, number>;
  canEditMpn: boolean;
  /** Change a part's bin location: Admin only for now. */
  canEditBins: boolean;
  /** Change a part's Class: Admin only for now. */
  canEditClass: boolean;
  /** Change a part's note in its window: Admin only. */
  canEditNote: boolean;
  canHide: boolean;
  canRemove: boolean;
};

const listInput = z.object({
  q: z.string().max(120).optional(),
  noPhoto: z.boolean().optional(),
  offset: z.number().int().min(0).max(100000).optional(),
  hidden: z.boolean().optional(),
  getLater: z.boolean().optional(),
  itemClass: z.string().max(120).optional(),
  /** "used": the parts on the most tickets first (all time), then the most pieces (Chuy, 10/28). */
  sort: z.enum(["sku", "used"]).optional(),
});

export const listParts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof listInput>) => listInput.parse(d))
  .handler(async ({ data, context }): Promise<PartsPage> => listPartsFor(await ready(), data, context.userId));

/**
 * SQL: the Parts search, by its placeholders: the typed text, `%text%`, and `%bin code%`. It finds a part by its part
 * number, name, description or MPN, its bin (A-03-12, or "Rack A"), or an old number merged into it. Export CSV reads
 * the same search (10/29).
 */
export function partSearchSql(q: string, like: string, binLike: string): string {
  return `(${q} = '' or item ilike ${like} or sku ilike ${like} or description ilike ${like} or mfr_part ilike ${like}
         or concat_ws('-', bin_rack, bin_shelf, bin_bin) ilike ${binLike}
         or concat_ws(' ', 'rack ' || bin_rack, 'shelf ' || bin_shelf, 'bin ' || bin_bin) ilike ${like}
         or exists (select 1 from unnest(previous_numbers) pn where pn ilike ${like}))`;
}

/** One page of the Parts list (the body of listParts). */
export async function listPartsFor(sql: Sql, data: z.infer<typeof listInput>, userId: string): Promise<PartsPage> {
  const q = (data.q ?? "").trim();
  const like = `%${q}%`;
  // Trip and labor are services, not parts. Hidden parts leave the normal list; Show Hidden lists only those.
  // The search finds a part by its bin too (10/28): A-03-12 (or A 03 12, A/03/12) is Rack A, Shelf 03, Bin 12, and
  // "Rack A" or "Shelf 03" finds every part there. An old number merged into a part finds that part.
  const where = `${data.hidden ? "" : "active and "}kind not in ('trip', 'labor')
    and hidden_at is ${data.hidden ? "not null" : "null"}
    and ${partSearchSql("$1", "$2", "$6")}
    and (not $3 or image is null)
    and (not $4 or get_later)
    and ($5 = '' or coalesce(item_class, '') = $5)`;
  const args = [q, like, !!data.noPhoto, !!data.getLater, data.itemClass ?? "", `%${binSearchCode(q)}%`];
  const used = data.sort === "used";
  const rows = await sql.query<Raw>(
    used
      ? `with ${PART_USES_CTE}
         select ${COLS} from ${FROM}
           left join (select part_id, count(*)::int as tickets, sum(qty) as pieces from part_uses group by part_id) uc
                  on uc.part_id = billing_items.id
          where ${where}
          order by coalesce(uc.tickets, 0) desc, coalesce(uc.pieces, 0) desc, lower(sku)
          limit 50 offset ${Number(data.offset ?? 0)}`
      : `select ${COLS} from ${FROM} where ${where} order by (image is null), lower(sku) limit 50 offset ${Number(data.offset ?? 0)}`,
    args,
  );
  const counts = (await sql.query<{ total: number; with_photo: number }>(
    `select count(*)::int as total, count(*) filter (where image is not null)::int as with_photo from billing_items where ${where}`,
    args,
  ))[0];
  const hiddenCount = (await sql.query<{ n: number }>(
    "select count(*)::int as n from billing_items where hidden_at is not null and kind not in ('trip', 'labor')",
  ))[0];
  const extra = (await sql.query<{ get_later: number; ready: number }>(
    `select count(*) filter (where get_later)::int as get_later,
            count(*) filter (where image is null and r_verdict = 'confirmed' and r_image is not null)::int as ready
       from ${FROM} where active and hidden_at is null and kind not in ('trip', 'labor')`,
  ))[0];
  // Only the five classes are ever offered; counts are the active, visible parts in each.
  const classRows = await sql.query<{ c: string; n: number }>(
    "select item_class as c, count(*)::int as n from billing_items where active and hidden_at is null and kind not in ('trip', 'labor') and item_class is not null group by 1",
  );
  const classCounts: Record<string, number> = Object.fromEntries(PART_CLASSES.map((c) => [c, classRows.find((r) => r.c === c)?.n ?? 0]));
  const classes: string[] = [...PART_CLASSES];
  const who = await powers(sql, userId);
  return {
    rows: rows.map(toRow),
    total: counts?.total ?? 0,
    withPhoto: counts?.with_photo ?? 0,
    hiddenCount: hiddenCount?.n ?? 0,
    getLaterCount: extra?.get_later ?? 0,
    readyToPull: extra?.ready ?? 0,
    classes,
    classCounts,
    canEditMpn: who.canEditMpn,
    canEditBins: who.canEditBins,
    canEditClass: who.canEditClass,
    canEditNote: who.canEditNote,
    canHide: who.canHide,
    canRemove: who.canRemove,
  };
}

async function findPart(sql: Sql, id: number): Promise<PartRow | null> {
  const r = (await sql.query<Raw>(`select ${COLS} from ${FROM} where id = $1`, [id]))[0];
  return r ? toRow(r) : null;
}

async function loadPart(sql: Sql, id: number): Promise<PartRow> {
  const part = await findPart(sql, id);
  if (!part) throw new Error("That part is no longer on the list.");
  return part;
}

const partIdInput = z.object({ id: z.number().int().positive() });

/** One part for its window on Parts (also a hidden one, so a link to it still opens). Null when it is gone. */
export const getPart = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof partIdInput>) => partIdInput.parse(d))
  .handler(async ({ data }): Promise<PartRow | null> => findPart(await ready(), data.id));

const binInput = z.object({
  id: z.number().int().positive(),
  rack: z.string().max(200).nullable(),
  shelf: z.string().max(200).nullable(),
  bin: z.string().max(200).nullable(),
});

/** Rack, Shelf and Bin as stored: each trimmed, blank is null, none longer than BIN_MAX. */
function binsTyped(data: { rack?: string | null; shelf?: string | null; bin?: string | null }): BinValues {
  const next: BinValues = { rack: cleanBinValue(data.rack), shelf: cleanBinValue(data.shelf), bin: cleanBinValue(data.bin) };
  for (const k of BIN_PIECES) {
    if ((next[k]?.length ?? 0) > BIN_MAX) throw new Error(`${BIN_LABEL[k]} can be up to ${BIN_MAX} characters.`);
  }
  return next;
}

/**
 * The part's bin location: Rack, Shelf and Bin, each trimmed; blank clears that piece. Admin only for now (Chuy,
 * 10/28). Who changed it and when is kept with it (only when something actually changed).
 */
export const setPartBin = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof binInput>) => binInput.parse(d))
  .handler(async ({ data, context }): Promise<PartRow> => setPartBinFor(await ready(), data, context.userId));

/** The body of setPartBin. */
export async function setPartBinFor(sql: Sql, data: z.infer<typeof binInput>, userId: string): Promise<PartRow> {
  const who = await powers(sql, userId);
  if (!who.canEditBins) throw new Error("Only an Admin can change a part's bin location.");
  const next = binsTyped(data);
  const rows = await sql.query(
    `update billing_items set
        bin_updated_at = case when (bin_rack, bin_shelf, bin_bin) is distinct from ($2::text, $3::text, $4::text) then now() else bin_updated_at end,
        bin_updated_by = case when (bin_rack, bin_shelf, bin_bin) is distinct from ($2::text, $3::text, $4::text) then $5 else bin_updated_by end,
        bin_rack = $2, bin_shelf = $3, bin_bin = $4, updated_at = now()
      where id = $1 returning id`,
    [data.id, next.rack, next.shelf, next.bin, who.name],
  );
  if (!rows.length) throw new Error("That part is no longer on the list.");
  return loadPart(sql, data.id);
}

const moveInput = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(PARTS_PICK_MAX),
  rack: z.string().max(200).nullable().optional(),
  shelf: z.string().max(200).nullable().optional(),
  bin: z.string().max(200).nullable().optional(),
});

export type BinMoveResult = {
  /** Parts whose bin changed. */
  moved: number;
  /** Parts already there: left exactly as they were. */
  same: number;
  /** Ids that are no longer parts (removed since they were picked). */
  missing: number;
};

/**
 * Move Bin for the parts picked on Parts (10/28): each piece typed goes on every part, and a blank piece keeps the
 * part's own (binsAfterMove), so a Rack alone moves a whole shelf to another rack. Admin only for now. One
 * statement, so every part moves or none does; a part already there keeps who changed it last.
 */
export const movePartBins = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof moveInput>) => moveInput.parse(d))
  .handler(async ({ data, context }): Promise<BinMoveResult> => movePartBinsFor(await ready(), data, context.userId));

/** The body of movePartBins. */
export async function movePartBinsFor(sql: Sql, data: z.infer<typeof moveInput>, userId: string): Promise<BinMoveResult> {
  const who = await powers(sql, userId);
  if (!who.canEditBins) throw new Error("Only an Admin can change bin locations.");
  const typed = binsTyped(data);
  if (!typed.rack && !typed.shelf && !typed.bin) throw new Error("Type the Rack, Shelf or Bin these parts move to.");
  const ids = [...new Set(data.ids)];
  const r = (
    await sql.query<{ found: number; moved: number }>(
      `with picked as (
         select id, bin_rack, bin_shelf, bin_bin from billing_items where id = any($1::int[]) and kind not in ('trip', 'labor')
       ), moved as (
         update billing_items b
            set bin_rack = coalesce($2::text, p.bin_rack), bin_shelf = coalesce($3::text, p.bin_shelf), bin_bin = coalesce($4::text, p.bin_bin),
                bin_updated_at = now(), bin_updated_by = $5, updated_at = now()
           from picked p
          where b.id = p.id
            and (coalesce($2::text, p.bin_rack), coalesce($3::text, p.bin_shelf), coalesce($4::text, p.bin_bin)) is distinct from (p.bin_rack, p.bin_shelf, p.bin_bin)
         returning b.id
       )
       select (select count(*)::int from picked) as found, (select count(*)::int from moved) as moved`,
      [ids, typed.rack, typed.shelf, typed.bin, who.name],
    )
  )[0];
  const found = Number(r?.found ?? 0);
  const moved = Number(r?.moved ?? 0);
  if (!found) throw new Error("Those parts are no longer on the list.");
  return { moved, same: found - moved, missing: ids.length - found };
}

/** A Class as stored: one of the five, or null for none. Anything else is refused. */
function classTyped(raw: string | null | undefined): PartClass | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (!isPartClass(v)) throw new Error(`The class must be one of ${PART_CLASSES.join(", ")}.`);
  return v;
}

const classInput = z.object({ id: z.number().int().positive(), itemClass: z.string().max(120).nullable() });

/**
 * The part's Class: one of the five, or none. Admin only for now, like the bin (Chuy, 10/28). A NetSuite item
 * import whose file gives a class still writes the file's class, and its preview lists that change before Save.
 */
export const setPartClass = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof classInput>) => classInput.parse(d))
  .handler(async ({ data, context }): Promise<PartRow> => setPartClassFor(await ready(), data, context.userId));

/** The body of setPartClass. */
export async function setPartClassFor(sql: Sql, data: z.infer<typeof classInput>, userId: string): Promise<PartRow> {
  if (!(await powers(sql, userId)).canEditClass) throw new Error("Only an Admin can change a part's class.");
  const next = classTyped(data.itemClass);
  const rows = await sql.query(
    "update billing_items set item_class = $2, updated_at = now() where id = $1 and kind not in ('trip', 'labor') returning id",
    [data.id, next],
  );
  if (!rows.length) throw new Error("That part is no longer on the list.");
  return loadPart(sql, data.id);
}

const classesInput = z.object({ ids: z.array(z.number().int().positive()).min(1).max(PARTS_PICK_MAX), itemClass: z.string().max(120).nullable() });

export type ClassSetResult = {
  /** Parts whose class changed. */
  changed: number;
  /** Parts that already had it. */
  same: number;
  /** Ids that are no longer parts. */
  missing: number;
};

/** Set Class for the parts picked on Parts (10/28). Admin only for now. One statement. */
export const setPartsClass = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof classesInput>) => classesInput.parse(d))
  .handler(async ({ data, context }): Promise<ClassSetResult> => setPartsClassFor(await ready(), data, context.userId));

/** The body of setPartsClass. */
export async function setPartsClassFor(sql: Sql, data: z.infer<typeof classesInput>, userId: string): Promise<ClassSetResult> {
  if (!(await powers(sql, userId)).canEditClass) throw new Error("Only an Admin can change a part's class.");
  const next = classTyped(data.itemClass);
  const ids = [...new Set(data.ids)];
  const r = (
    await sql.query<{ found: number; changed: number }>(
      `with picked as (
         select id, item_class from billing_items where id = any($1::int[]) and kind not in ('trip', 'labor')
       ), changed as (
         update billing_items b set item_class = $2::text, updated_at = now()
           from picked p
          where b.id = p.id and p.item_class is distinct from $2::text
         returning b.id
       )
       select (select count(*)::int from picked) as found, (select count(*)::int from changed) as changed`,
      [ids, next],
    )
  )[0];
  const found = Number(r?.found ?? 0);
  const changed = Number(r?.changed ?? 0);
  if (!found) throw new Error("Those parts are no longer on the list.");
  return { changed, same: found - changed, missing: ids.length - found };
}

/** Add or replace the photo. The same photo shows on the invoice picker and on the invoice line. */
export const setPartImage = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; base64: string; sourceUrl?: string | null }) =>
    z
      .object({
        id: z.number().int().positive(),
        base64: z.string().min(8).max(Math.ceil((MAX_PART_IMAGE_BYTES * 4) / 3) + 16).regex(/^[A-Za-z0-9+/]+=*$/),
        sourceUrl: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PartRow> => {
    const sql = await ready();
    const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
    const problem = partImageError(bytes);
    if (problem) throw new Error(problem);
    const mime = sniffImage(bytes)!;
    // A photo a person adds or picks is a confirmed photo; a researched one carries the address it came from.
    if (data.sourceUrl) {
      const known = await sql.query(
        `select 1 from billing_items b join part_photo_research pr
            on pr.mpn_key in (regexp_replace(upper(coalesce(b.mfr_part, '')), '[^A-Z0-9]+', '', 'g'), regexp_replace(upper(b.sku), '[^A-Z0-9]+', '', 'g'))
          where b.id = $1 and (pr.image_url = $2 or pr.candidates @> jsonb_build_array(jsonb_build_object('imageUrl', $2::text)))`,
        [data.id, data.sourceUrl],
      );
      if (!known.length) throw new Error("That photo is not one of this part's researched photos.");
    }
    const who = (await powers(sql, context.userId)).name;
    const rows = await sql.query(
      `update billing_items set image = decode($2, 'base64'), image_mime = $3, image_updated_at = now(),
              photo_status = 'confirmed', photo_source_url = $4, photo_confirmed_by = $5, photo_confirmed_at = now()
        where id = $1 returning id`,
      [data.id, data.base64, mime, data.sourceUrl ?? null, who],
    );
    if (!rows.length) throw new Error("That part is no longer on the list.");
    return loadPart(sql, data.id);
  });

/** Get Later: mark a part to pull later. It does not change price or stock. Anyone on the Desk. */
export const setPartGetLater = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; on: boolean }) => z.object({ id: z.number().int().positive(), on: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<PartRow> => {
    const sql = await ready();
    const who = (await powers(sql, context.userId)).name;
    const rows = await sql.query(
      "update billing_items set get_later = $2, get_later_at = case when $2 then now() else null end, get_later_by = case when $2 then $3 else null end where id = $1 returning id",
      [data.id, data.on, who],
    );
    if (!rows.length) throw new Error("That part is no longer on the list.");
    return loadPart(sql, data.id);
  });

export const clearPartImage = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<PartRow> => {
    const sql = await ready();
    await sql.query(
      "update billing_items set image = null, image_mime = null, image_updated_at = null, photo_status = null, photo_source_url = null, photo_confirmed_by = null, photo_confirmed_at = null where id = $1",
      [data.id],
    );
    return loadPart(sql, data.id);
  });

/**
 * The part's description, as typed on Parts. Blank clears it. Only what someone types is stored; nothing is filled
 * in for a part that has none. (A NetSuite item import with a Description column still writes its own.)
 */
export const setPartDescription = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; description: string | null }) => z.object({ id: z.number().int().positive(), description: z.string().max(500).nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<PartRow> => {
    const sql = await ready();
    if (!(await powers(sql, context.userId)).canEditMpn) throw new Error("Only Admin and Sales can change a part's description.");
    const text = (data.description ?? "").replace(/\s+/g, " ").trim();
    const rows = await sql.query("update billing_items set description = $2, updated_at = now() where id = $1 returning id", [data.id, text || null]);
    if (!rows.length) throw new Error("That part is no longer on the list.");
    return loadPart(sql, data.id);
  });

const noteInput = z.object({
  id: z.number().int().positive(),
  note: z.string().max(PART_NOTE_MAX * 2).nullable(),
  /** The note exactly as stored when the editor opened (PartRow.note). */
  before: z.string().max(200_000).nullable(),
});

/**
 * The part's note, as an Admin types it in the part's window (Grok through Chuy, 10/29). Admin only; everyone else
 * reads it. It writes the note and the part's updated time, nothing else, and only while the note still reads as it
 * did when the editor opened: a line an import added meanwhile is never overwritten (the save is refused instead).
 * Blank clears the note.
 */
export const setPartNote = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof noteInput>) => noteInput.parse(d))
  .handler(async ({ data, context }): Promise<PartRow> => setPartNoteFor(await ready(), data, context.userId));

/** The body of setPartNote. */
export async function setPartNoteFor(sql: Sql, data: z.infer<typeof noteInput>, userId: string): Promise<PartRow> {
  if (!(await powers(sql, userId)).canEditNote) throw new Error("Only an Admin can change a part's note.");
  const next = cleanPartNote(data.note);
  if (next && next.length > PART_NOTE_MAX) throw new Error(`A note can be up to ${PART_NOTE_MAX.toLocaleString("en-US")} characters.`);
  const gone = async () => !(await sql.query("select 1 from billing_items where id = $1 and kind not in ('trip', 'labor')", [data.id])).length;
  // The box holds the note it opened with (spaces aside): nothing to write, and the stored text keeps every character.
  if (next === cleanPartNote(data.before)) {
    if (await gone()) throw new Error("That part is no longer on the list.");
    return loadPart(sql, data.id);
  }
  const rows = await sql.query(
    `update billing_items set note = $2, updated_at = now()
      where id = $1 and kind not in ('trip', 'labor') and note is not distinct from $3
      returning id`,
    [data.id, next, data.before],
  );
  if (!rows.length) {
    if (await gone()) throw new Error("That part is no longer on the list.");
    throw new Error("The note changed while you were editing it (an import may have added a line), so nothing was saved. Copy your text, then Cancel and edit the note again.");
  }
  return loadPart(sql, data.id);
}

/** Record the manufacturer part number for a part. Blank clears it. */
export const setPartMpn = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; mpn: string | null }) => z.object({ id: z.number().int().positive(), mpn: z.string().max(60).nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<PartRow> => {
    const sql = await ready();
    if (!(await powers(sql, context.userId)).canEditMpn) throw new Error("Only Admin and Sales can change a part's MPN.");
    await sql.query("update billing_items set mfr_part = $2, updated_at = now() where id = $1", [data.id, cleanMpn(data.mpn)]);
    return loadPart(sql, data.id);
  });

const idsInput = z.object({
  // Select All Shown can pick every part on the list: up to PARTS_PICK_MAX at a time.
  ids: z.array(z.number().int().positive()).min(1).max(PARTS_PICK_MAX),
  reason: z.string().max(200).optional(),
});

/** Where this part is already written: a ticket charge, a repair quote, or a part logged on a PM machine. */
export async function partHistory(sql: Sql, part: { id?: number; item: string; sku: string }): Promise<string[]> {
  const textArgs = [part.item.trim().toLowerCase(), part.sku.trim().toLowerCase()];
  const machineArgs = [...textArgs, part.id ?? 0];
  const tickets = await sql.query<{ id: number; wo: string | null; customer: string | null }>(
    `select j.id, j.wo, j.customer
       from ticket_charges c
       join service_jobs j on j.id = c.job_id
      where lower(btrim(c.item)) = $1 or lower(btrim(c.item)) = $2
      group by j.id, j.wo, j.customer
      order by j.id
      limit 5`,
    textArgs,
  );
  const quotes = await sql.query<{ id: number; status: string; wo: string | null }>(
    `select q.id, q.status, j.wo
       from repair_quote_lines l
       join repair_quotes q on q.id = l.quote_id
       left join service_jobs j on j.id = q.job_id
      where lower(btrim(l.item)) = $1 or lower(btrim(l.item)) = $2
      group by q.id, q.status, j.wo
      order by q.id
      limit 5`,
    textArgs,
  );
  const machines = await sql.query<{ id: number; customer: string | null }>(
    `select p.id, p.customer
       from machine_parts m
       join pm_jobs p on p.id = m.pm_job_id
      where m.removed_at is null
        and (m.billing_item_id = $3 or lower(btrim(m.item)) = $1 or lower(btrim(m.item)) = $2)
      group by p.id, p.customer
      order by p.id
      limit 5`,
    machineArgs,
  );
  const lines = [
    ...tickets.map((t) => {
      const label = t.wo?.trim() ? `ticket ${t.wo.trim()}` : `ticket #${t.id}`;
      return t.customer?.trim() ? `${label} (${t.customer.trim()})` : label;
    }),
    ...quotes.map((q) => (q.wo?.trim() ? `repair quote on ticket ${q.wo.trim()} (${q.status})` : `repair quote #${q.id} (${q.status})`)),
    ...machines.map((p) => `PM #${p.id} (machine part)`),
  ];
  return lines;
}

function historyError(places: string[]): string {
  const shown = places.slice(0, 3).join(", ");
  const more = places.length > 3 ? `, and ${places.length - 3} more` : "";
  return `This part is on ${shown}${more}. It can only be hidden.`;
}

/** Hide parts from the normal list, search, and the invoice and quote pickers. The row stays. Admin and Sales. */
export const hideParts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[]; reason?: string }) => idsInput.parse(d))
  .handler(async ({ data, context }): Promise<{ hidden: number }> => {
    const sql = await ready();
    const who = await powers(sql, context.userId);
    if (!who.canHide) throw new Error("Only Admin and Sales can hide a part.");
    const reason = data.reason?.trim() || null;
    const rows = await sql.query<{ id: number }>(
      `update billing_items
          set hidden_at = now(), hidden_by = $2, hidden_reason = $3, updated_at = now()
        where id = any($1::int[]) and kind not in ('trip', 'labor')
        returning id`,
      [data.ids, who.name, reason],
    );
    if (!rows.length) throw new Error("Those parts are no longer on the list.");
    return { hidden: rows.length };
  });

/**
 * Put hidden parts back on the normal list. Admin and Sales. A part merged into another (an import copy, or an old
 * number) stays hidden: its uses and machine parts are on the part it went into.
 */
export const restoreParts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[] }) => z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }).parse(d))
  .handler(async ({ data, context }): Promise<{ restored: number }> => restorePartsFor(await ready(), data, context.userId));

/** The body of restoreParts. */
export async function restorePartsFor(sql: Sql, data: { ids: number[] }, userId: string): Promise<{ restored: number }> {
  const who = await powers(sql, userId);
  if (!who.canHide) throw new Error("Only Admin and Sales can restore a part.");
  const rows = await sql.query<{ id: number }>(
    `update billing_items
        set hidden_at = null, hidden_by = null, hidden_reason = null, updated_at = now()
      where id = any($1::int[]) and hidden_at is not null and merged_into is null
      returning id`,
    [data.ids],
  );
  if (!rows.length) {
    const merged = (await sql.query<{ sku: string }>(
      "select k.sku from billing_items b join billing_items k on k.id = b.merged_into where b.id = any($1::int[]) limit 1",
      [data.ids],
    ))[0];
    throw new Error(merged ? `That part was merged into ${merged.sku}. It stays hidden; use ${merged.sku}.` : "Those parts are not hidden.");
  }
  return { restored: rows.length };
}

/**
 * Delete a part that has never been used. Admin only. A part on any charge or quote line is refused:
 * hide it instead. The caller confirms first.
 */
export const removePart = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ removed: true }> => {
    const sql = await ready();
    const who = await powers(sql, context.userId);
    if (!who.canRemove) throw new Error("Only an Admin can remove a part.");
    const part = (await sql.query<{ id: number; sku: string; item: string; kind: string }>(
      "select id, sku, item, kind from billing_items where id = $1",
      [data.id],
    ))[0];
    if (!part) throw new Error("That part is no longer on the list.");
    if (part.kind === "trip" || part.kind === "labor") throw new Error("Trip and labor stay on the list. They can only be hidden.");
    // Merged rows are never deleted, and a part others were merged into keeps them.
    const merge = (await sql.query<{ merged: boolean; kept: number }>(
      "select (select merged_into is not null from billing_items where id = $1) as merged, (select count(*)::int from billing_items where merged_into = $1) as kept",
      [data.id],
    ))[0];
    if (merge?.merged) throw new Error("This part was merged into another one. It stays, hidden.");
    if (Number(merge?.kept ?? 0) > 0) throw new Error("Other parts were merged into this one. It can only be hidden.");
    const places = await partHistory(sql, part);
    if (places.length) throw new Error(historyError(places));
    const gone = await sql.query<{ id: number }>("delete from billing_items where id = $1 returning id", [data.id]);
    if (!gone.length) throw new Error("That part is no longer on the list.");
    return { removed: true };
  });
