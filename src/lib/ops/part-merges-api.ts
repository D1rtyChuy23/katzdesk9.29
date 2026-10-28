/**
 * Clean Up Import Copies and Import Part Merges (CSV): Parts → Import, Admin only (the Admin role or a desk admin),
 * checked here. With apply false nothing is written: that is the preview. Confirm plans again against what is stored
 * then and writes it in one statement, so every change lands or none does. Nothing is deleted: a folded row is hidden
 * with merged_into set. Text on tickets, invoices, repair quotes and the QuickBooks history is left as it is; Parts
 * usage counts it on the kept part. The planning is in part-merges.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import {
  MERGE_MAX_ROWS,
  copyCounts,
  mergeCounts,
  mergeRowsFromSheets,
  noteAfter,
  planImportCopies,
  planPartMerges,
  previousNumbersAfter,
  textArray,
  type CopyCounts,
  type CopyPlanLine,
  type MergeCounts,
  type MergeFacts,
  type MergePart,
  type MergePlanLine,
} from "@/lib/ops/part-merges";

type Query = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

/** The Admin's name for hidden_by, or an error for anyone else. */
async function requireAdmin(sql: Query, userId: string, what: string): Promise<string> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error(`Only an Admin can ${what}.`);
  const row = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0];
  return row?.username?.trim() || "Admin";
}

const text = (v: unknown) => (v == null || v === "" ? null : String(v));
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

/** Every row of the parts table, as the planners read it. */
export async function loadMergeParts(sql: Query): Promise<MergePart[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `select id, sku, item, mfr_part, description, kind, item_class, (image is not null) as has_image, bin_rack, bin_shelf, bin_bin,
            list_price, rate, cost, (hidden_at is not null) as hidden, merged_into, previous_numbers, note
       from billing_items
      order by id`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    sku: String(r.sku ?? ""),
    item: String(r.item ?? ""),
    mpn: text(r.mfr_part),
    description: text(r.description),
    kind: String(r.kind ?? "part"),
    itemClass: text(r.item_class),
    hasImage: flagOn(r.has_image),
    binRack: text(r.bin_rack),
    binShelf: text(r.bin_shelf),
    binBin: text(r.bin_bin),
    listPrice: num(r.list_price),
    rate: num(r.rate),
    cost: num(r.cost),
    hidden: flagOn(r.hidden),
    mergedInto: r.merged_into == null ? null : Number(r.merged_into),
    previousNumbers: textArray(r.previous_numbers),
    note: text(r.note),
  }));
}

async function loadFacts(sql: Query): Promise<MergeFacts> {
  const mp = await sql.query<{ id: number; n: number }>(
    "select billing_item_id as id, count(*)::int as n from machine_parts where billing_item_id is not null group by billing_item_id",
  );
  const rk = await sql.query<{ k: string }>("select mpn_key as k from part_photo_research");
  return { machineParts: new Map(mp.map((r) => [Number(r.id), Number(r.n)])), researchKeys: new Set(rk.map((r) => String(r.k))) };
}

/** A part number as photo research keys it (normalizePartNo in SQL). */
const KEY = (col: string) => `regexp_replace(upper(coalesce(${col}, '')), '[^A-Z0-9]+', '', 'g')`;
const NO_BIN = (a: string) => `coalesce(nullif(btrim(${a}.bin_rack), ''), nullif(btrim(${a}.bin_shelf), ''), nullif(btrim(${a}.bin_bin), '')) is null`;

// ------------------------------------------------------------------------------------------ Part A: import copies

export type CopiesResult = { folded: number; fixed: number; filled: number; moved: number; research: number };

export type CopiesPreview = {
  counts: CopyCounts;
  /** Every copy to fold or fix and every ambiguous one; up to 300 already folded. */
  lines: CopyPlanLine[];
  applied: boolean;
  result: CopiesResult | null;
};

const DONE_SHOWN = 300;

function copiesPreview(lines: CopyPlanLine[], applied: boolean, result: CopiesResult | null): CopiesPreview {
  const done = lines.filter((l) => l.status === "done");
  return { counts: copyCounts(lines), lines: [...lines.filter((l) => l.status !== "done"), ...done.slice(0, DONE_SHOWN)], applied, result };
}

/**
 * Folds each copy into its original, and gives each copy with no original its bare number, in one statement.
 * $1 copy ids and $2 their originals (in copy id order), $3 who, $4 copies to fix, $5 their new SKU, $6 their parent.
 * Each pair is checked again as it is written: the copy not folded yet, the original not merged.
 */
const APPLY_COPIES_SQL = `
with pairs as (
  select * from unnest($1::int[], $2::int[]) with ordinality as p(copy_id, orig_id, ord)
), live as (
  select p.copy_id, p.orig_id, p.ord
    from pairs p
    join billing_items c on c.id = p.copy_id and c.merged_into is null
    join billing_items o on o.id = p.orig_id and o.merged_into is null
   where p.copy_id <> p.orig_id
), src as (
  -- The first copy (in copy id order) with a value fills each blank.
  select l.orig_id,
         (array_agg(c.description order by l.ord) filter (where nullif(btrim(c.description), '') is not null))[1] as description,
         (array_agg(c.list_price order by l.ord) filter (where c.list_price is not null))[1] as list_price,
         (array_agg(c.rate order by l.ord) filter (where c.rate is not null))[1] as rate,
         (array_agg(c.cost order by l.ord) filter (where c.cost is not null))[1] as cost
    from live l
    join billing_items c on c.id = l.copy_id
   group by l.orig_id
), filled as (
  update billing_items o set
         description = case when nullif(btrim(o.description), '') is null and s.description is not null then s.description else o.description end,
         list_price = coalesce(o.list_price, s.list_price),
         rate = coalesce(o.rate, s.rate),
         cost = coalesce(o.cost, s.cost),
         updated_at = now()
    from src s
   where o.id = s.orig_id
     and ((nullif(btrim(o.description), '') is null and s.description is not null)
          or (o.list_price is null and s.list_price is not null)
          or (o.rate is null and s.rate is not null)
          or (o.cost is null and s.cost is not null))
  returning o.id
), moved as (
  update machine_parts m set billing_item_id = l.orig_id
    from live l
   where m.billing_item_id = l.copy_id
  returning m.id
), research as (
  -- The copy's photo research, filed under the original's number, when the original has none.
  insert into part_photo_research (mpn_key, sku, mpn, verdict, reason, image_url, candidates, researched_at)
  select distinct on (x.okey) x.okey, x.osku, x.ompn, r.verdict, r.reason, r.image_url, r.candidates, r.researched_at
    from (
      select l.ord, o.sku as osku, o.mfr_part as ompn,
             coalesce(nullif(${KEY("o.mfr_part")}, ''), ${KEY("o.sku")}) as okey,
             nullif(${KEY("o.mfr_part")}, '') as ok1, nullif(${KEY("o.sku")}, '') as ok2,
             nullif(${KEY("c.mfr_part")}, '') as ck1, nullif(${KEY("c.sku")}, '') as ck2
        from live l
        join billing_items c on c.id = l.copy_id
        join billing_items o on o.id = l.orig_id
    ) x
    join lateral (
      select pr.* from part_photo_research pr
       where pr.mpn_key in (x.ck1, x.ck2)
       order by (pr.mpn_key = x.ck1) desc
       limit 1
    ) r on true
   where x.okey <> ''
     and not exists (select 1 from part_photo_research e where e.mpn_key in (x.ok1, x.ok2))
   order by x.okey, x.ord
  on conflict (mpn_key) do nothing
  returning mpn_key
), folded as (
  update billing_items c set
         merged_into = l.orig_id,
         hidden_at = coalesce(c.hidden_at, now()),
         hidden_by = case when c.hidden_at is null then $3::text else c.hidden_by end,
         hidden_reason = case when c.hidden_at is null then 'Import copy of ' || o.item else c.hidden_reason end,
         updated_at = now()
    from live l
    join billing_items o on o.id = l.orig_id
   where c.id = l.copy_id
  returning c.id
), fixed as (
  update billing_items b set
         sku = f.sku,
         mfr_part = f.sku,
         parent = coalesce(nullif(btrim(b.parent), ''), f.parent),
         updated_at = now()
    from unnest($4::int[], $5::text[], $6::text[]) as f(id, sku, parent)
   where b.id = f.id
     and b.merged_into is null
     and not exists (select 1 from billing_items x where x.id <> b.id and lower(btrim(x.sku)) = lower(btrim(f.sku)))
  returning b.id
)
select (select count(*)::int from folded) as folded, (select count(*)::int from fixed) as fixed, (select count(*)::int from filled) as filled,
       (select count(*)::int from moved) as moved, (select count(*)::int from research) as research`;

const copiesInput = z.object({ apply: z.boolean() });

/** Clean Up Import Copies. The preview needs no file: it reads the parts as they are. */
export const cleanUpImportCopies = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof copiesInput>) => copiesInput.parse(d))
  .handler(async ({ data, context }): Promise<CopiesPreview> => cleanUpImportCopiesFor(await ready(), data, context.userId));

/** The body of cleanUpImportCopies. */
export async function cleanUpImportCopiesFor(sql: Query, data: z.infer<typeof copiesInput>, userId: string): Promise<CopiesPreview> {
  const who = await requireAdmin(sql, userId, "clean up import copies");
  const lines = planImportCopies(await loadMergeParts(sql), await loadFacts(sql));
  if (!data.apply) return copiesPreview(lines, false, null);
  const fold = lines.filter((l) => l.status === "fold");
  const fix = lines.filter((l) => l.status === "fix");
  let result: CopiesResult = { folded: 0, fixed: 0, filled: 0, moved: 0, research: 0 };
  if (fold.length || fix.length) {
    const r = (
      await sql.query<Record<string, unknown>>(APPLY_COPIES_SQL, [
        fold.map((l) => l.copy.id),
        fold.map((l) => l.original!.id),
        who,
        fix.map((l) => l.copy.id),
        fix.map((l) => l.fixedSku),
        fix.map((l) => l.parent),
      ])
    )[0];
    result = { folded: Number(r?.folded ?? 0), fixed: Number(r?.fixed ?? 0), filled: Number(r?.filled ?? 0), moved: Number(r?.moved ?? 0), research: Number(r?.research ?? 0) };
  }
  // The plan again after the write: what is left (ambiguous copies) and what is done.
  return copiesPreview(planImportCopies(await loadMergeParts(sql), await loadFacts(sql)), true, result);
}

// ------------------------------------------------------------------------------------------ Part B: merge file

function readSheets(base64: string) {
  if (base64.length > 4_000_000) throw new Error("That file is too large.");
  const wb = XLSX.read(base64, { type: "base64", raw: true, cellText: true });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: false, raw: false }),
  }));
  if (!sheets.length) throw new Error("The file is empty.");
  return sheets;
}

export type MergesResult = { merged: number; keepers: number; moved: number; research: number; repointed: number };

export type MergesPreview = {
  filename: string;
  counts: MergeCounts;
  lines: MergePlanLine[];
  applied: boolean;
  result: MergesResult | null;
};

/**
 * Folds each old part into its keeper, in one statement. $1 old ids, $2 keeper ids, $3 notes, $4 file rows, $5 who,
 * $6 each keeper's previous numbers and note after the merge (worked out in part-merges.ts). Each pair is checked
 * again as it is written: the old part not merged, the keeper on the list and not merged. Rows already folded into an
 * old part (import copies) are pointed at its keeper, so merged_into never chains.
 */
const APPLY_MERGES_SQL = `
with pairs as (
  select * from unnest($1::int[], $2::int[], $3::text[], $4::int[]) as p(old_id, keeper_id, note, ord)
), live as (
  select p.old_id, p.keeper_id, nullif(btrim(p.note), '') as note, p.ord
    from pairs p
    join billing_items o on o.id = p.old_id and o.merged_into is null and o.kind not in ('trip', 'labor')
    join billing_items k on k.id = p.keeper_id and k.merged_into is null and k.hidden_at is null and k.kind not in ('trip', 'labor')
   where p.old_id <> p.keeper_id
), src as (
  -- The first old part (in file order) with a value fills each blank on its keeper.
  select l.keeper_id,
         (array_agg(o.mfr_part order by l.ord) filter (where nullif(btrim(o.mfr_part), '') is not null))[1] as mpn,
         (array_agg(o.description order by l.ord) filter (where nullif(btrim(o.description), '') is not null))[1] as description,
         (array_agg(o.id order by l.ord) filter (where o.image is not null))[1] as photo_id,
         (array_agg(o.id order by l.ord) filter (where not (${NO_BIN("o")})))[1] as bin_id,
         (array_agg(o.list_price order by l.ord) filter (where o.list_price is not null))[1] as list_price
    from live l
    join billing_items o on o.id = l.old_id
   group by l.keeper_id
), kept as (
  update billing_items k set
         mfr_part = case when nullif(btrim(k.mfr_part), '') is null and s.mpn is not null then s.mpn else k.mfr_part end,
         description = case when nullif(btrim(k.description), '') is null and s.description is not null then s.description else k.description end,
         image = case when k.image is null and ph.id is not null then ph.image else k.image end,
         image_mime = case when k.image is null and ph.id is not null then ph.image_mime else k.image_mime end,
         image_updated_at = case when k.image is null and ph.id is not null then now() else k.image_updated_at end,
         photo_status = case when k.image is null and ph.id is not null then ph.photo_status else k.photo_status end,
         photo_source_url = case when k.image is null and ph.id is not null then ph.photo_source_url else k.photo_source_url end,
         photo_confirmed_by = case when k.image is null and ph.id is not null then ph.photo_confirmed_by else k.photo_confirmed_by end,
         photo_confirmed_at = case when k.image is null and ph.id is not null then ph.photo_confirmed_at else k.photo_confirmed_at end,
         bin_rack = case when ${NO_BIN("k")} and bn.id is not null then bn.bin_rack else k.bin_rack end,
         bin_shelf = case when ${NO_BIN("k")} and bn.id is not null then bn.bin_shelf else k.bin_shelf end,
         bin_bin = case when ${NO_BIN("k")} and bn.id is not null then bn.bin_bin else k.bin_bin end,
         bin_updated_at = case when ${NO_BIN("k")} and bn.id is not null then now() else k.bin_updated_at end,
         bin_updated_by = case when ${NO_BIN("k")} and bn.id is not null then $5::text else k.bin_updated_by end,
         list_price = coalesce(k.list_price, s.list_price),
         previous_numbers = array(select e from jsonb_array_elements_text(n.numbers) with ordinality as t(e, i) order by i),
         note = n.note,
         updated_at = now()
    from src s
    join jsonb_to_recordset($6::jsonb) as n(id int, numbers jsonb, note text) on n.id = s.keeper_id
    left join billing_items ph on ph.id = s.photo_id
    left join billing_items bn on bn.id = s.bin_id
   where k.id = s.keeper_id
  returning k.id
), moved as (
  update machine_parts m set billing_item_id = l.keeper_id
    from live l
   where m.billing_item_id = l.old_id
  returning m.id
), research as (
  -- The old part's photo research, filed under the keeper's number, when the keeper has none.
  insert into part_photo_research (mpn_key, sku, mpn, verdict, reason, image_url, candidates, researched_at)
  select distinct on (x.kkey) x.kkey, x.ksku, x.kmpn, r.verdict, r.reason, r.image_url, r.candidates, r.researched_at
    from (
      select l.ord, k.sku as ksku, k.mfr_part as kmpn,
             coalesce(nullif(${KEY("k.mfr_part")}, ''), ${KEY("k.sku")}) as kkey,
             nullif(${KEY("k.mfr_part")}, '') as kk1, nullif(${KEY("k.sku")}, '') as kk2,
             nullif(${KEY("o.mfr_part")}, '') as ok1, nullif(${KEY("o.sku")}, '') as ok2
        from live l
        join billing_items o on o.id = l.old_id
        join billing_items k on k.id = l.keeper_id
    ) x
    join lateral (
      select pr.* from part_photo_research pr
       where pr.mpn_key in (x.ok1, x.ok2)
       order by (pr.mpn_key = x.ok1) desc
       limit 1
    ) r on true
   where x.kkey <> ''
     and not exists (select 1 from part_photo_research e where e.mpn_key in (x.kk1, x.kk2))
   order by x.kkey, x.ord
  on conflict (mpn_key) do nothing
  returning mpn_key
), repointed as (
  update billing_items c set merged_into = l.keeper_id, updated_at = now()
    from live l
   where c.merged_into = l.old_id
  returning c.id
), merged as (
  update billing_items o set
         merged_into = l.keeper_id,
         hidden_at = coalesce(o.hidden_at, now()),
         hidden_by = case when o.hidden_at is null then $5::text else o.hidden_by end,
         hidden_reason = case when o.hidden_at is null then coalesce(l.note, 'Merged into ' || k.sku) else o.hidden_reason end,
         updated_at = now()
    from live l
    join billing_items k on k.id = l.keeper_id
   where o.id = l.old_id
  returning o.id
)
select (select count(*)::int from merged) as merged, (select count(*)::int from kept) as keepers, (select count(*)::int from moved) as moved,
       (select count(*)::int from research) as research, (select count(*)::int from repointed) as repointed`;

const mergesInput = z.object({ filename: z.string().max(300), base64: z.string().min(4), apply: z.boolean() });

/** Import Part Merges (CSV): old_sku, new_sku, note. Confirm sends the file again; it is planned again then. */
export const importPartMerges = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof mergesInput>) => mergesInput.parse(d))
  .handler(async ({ data, context }): Promise<MergesPreview> => importPartMergesFor(await ready(), data, context.userId));

/** The body of importPartMerges. */
export async function importPartMergesFor(sql: Query, data: z.infer<typeof mergesInput>, userId: string): Promise<MergesPreview> {
  const who = await requireAdmin(sql, userId, "merge parts");
  const rows = mergeRowsFromSheets(readSheets(data.base64));
  if (!rows.length) throw new Error("No rows under the header.");
  if (rows.length > MERGE_MAX_ROWS) throw new Error(`Up to ${MERGE_MAX_ROWS.toLocaleString("en-US")} rows at a time.`);
  const parts = await loadMergeParts(sql);
  const lines = planPartMerges(rows, parts, await loadFacts(sql));
  const preview: MergesPreview = { filename: data.filename, counts: mergeCounts(lines), lines, applied: false, result: null };
  if (!data.apply) return preview;

  const merging = lines.filter((l) => l.status === "merge");
  let result: MergesResult = { merged: 0, keepers: 0, moved: 0, research: 0, repointed: 0 };
  if (merging.length) {
    const byId = new Map(parts.map((p) => [p.id, p]));
    const perKeeper = new Map<number, { olds: MergePart[]; notes: (string | null)[] }>();
    for (const l of merging) {
      const k = perKeeper.get(l.keeper!.id) ?? { olds: [], notes: [] };
      k.olds.push(byId.get(l.old!.id)!);
      k.notes.push(l.note);
      perKeeper.set(l.keeper!.id, k);
    }
    const after = [...perKeeper].map(([id, k]) => {
      const keeper = byId.get(id)!;
      return { id, numbers: previousNumbersAfter(keeper, k.olds), note: noteAfter(keeper.note, k.notes) };
    });
    const r = (
      await sql.query<Record<string, unknown>>(APPLY_MERGES_SQL, [
        merging.map((l) => l.old!.id),
        merging.map((l) => l.keeper!.id),
        merging.map((l) => l.note),
        merging.map((l) => l.line),
        who,
        JSON.stringify(after),
      ])
    )[0];
    result = { merged: Number(r?.merged ?? 0), keepers: Number(r?.keepers ?? 0), moved: Number(r?.moved ?? 0), research: Number(r?.research ?? 0), repointed: Number(r?.repointed ?? 0) };
  }
  // The same file planned again after the write: each merged row now reads Done.
  const again = planPartMerges(rows, await loadMergeParts(sql), await loadFacts(sql));
  return { filename: data.filename, counts: mergeCounts(again), lines: again, applied: true, result };
}
