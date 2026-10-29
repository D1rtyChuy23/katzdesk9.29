/**
 * One part for one number (10/28, Grok's request through Chuy). Two Admin tools on Parts → Import, both shown first
 * and written only on Confirm:
 *   * Clean Up Import Copies: a bad NetSuite import added about 2,450 rows whose SKU and MPN are the whole
 *     "CATEGORY : ITEM" name ("PARTS : EVER108340"). A copy with one original is folded into it; one with no original
 *     keeps its row and gets the bare number as its SKU and MPN; one that fits two or more parts is left and listed.
 *   * Import Part Merges (CSV): old_sku, new_sku, note. The old part is folded into the new one.
 * Folding fills only the kept part's blank fields, moves PM machine parts and photo research to it, and hides the
 * other row with merged_into set. Nothing is deleted; text on tickets, invoices, quotes and the QuickBooks history
 * stays as it is, and Parts usage counts it on the kept part.
 * Pure: no server imports, safe for node --test. The server side is part-merges-api.ts.
 */
import { normalizePartNo } from "./charges.ts";
import { binText } from "./part-bins.ts";
import { blankRow, headerKey } from "./part-pricing.ts";

/** A part as the planners read it. */
export type MergePart = {
  id: number;
  sku: string;
  item: string;
  mpn: string | null;
  description: string | null;
  kind: string;
  itemClass: string | null;
  hasImage: boolean;
  binRack: string | null;
  binShelf: string | null;
  binBin: string | null;
  listPrice: number | null;
  rate: number | null;
  cost: number | null;
  hidden: boolean;
  mergedInto: number | null;
  previousNumbers: string[];
  /** Why parts were merged into this one (from merge files). */
  note: string | null;
};

/** What the planners need besides the parts: PM machine parts per part, and the photo research keys on file. */
export type MergeFacts = {
  /** machine_parts rows per billing item id (removed ones too: they move with the rest). */
  machineParts: Map<number, number>;
  /** part_photo_research.mpn_key values. */
  researchKeys: Set<string>;
};

/** A part as the previews show it (kept small: the copy clean-up lists about 2,450 of them). */
export type PartBrief = { id: number; sku: string; description: string | null; hidden: boolean };

const brief = (p: MergePart): PartBrief => ({ id: p.id, sku: p.sku, description: p.description, hidden: p.hidden });
const blank = (v: unknown) => v == null || String(v).trim() === "";
const isServiceItem = (p: MergePart) => p.kind === "trip" || p.kind === "labor";
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** A text[] as a database driver gives it: an array, or Postgres' "{a,b}" text. */
export function textArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  const s = String(v ?? "").trim();
  if (!s || s === "{}") return [];
  const out: string[] = [];
  for (const m of s.replace(/^\{|\}$/g, "").matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)) {
    out.push(m[1] != null ? m[1].replace(/\\(.)/g, "$1") : m[2]!.trim());
  }
  return out;
}

// ------------------------------------------------------------------------------------------ numbers

const CATEGORY = /^(.*\S)\s+:\s+(\S.*)$/;

/** "PARTS : EVER108340" is EVER108340: the number after the last " : ". A number with no category is itself. */
export function stripCategory(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  const m = CATEGORY.exec(s);
  return m ? m[2]!.trim() : s;
}

/** The category in front of the number ("PARTS", or "BUNN : PARTS"), or null when there is none. */
export function categoryOf(raw: string | null | undefined): string | null {
  const m = CATEGORY.exec(String(raw ?? "").trim());
  return m ? m[1]!.trim() : null;
}

/** A number as matched: the category off, no spaces, capitals. */
export const numberKey = (raw: string | null | undefined): string => stripCategory(raw).replace(/\s+/g, "").toUpperCase();

/**
 * An import copy: its SKU and MPN are the same "CATEGORY : ITEM" text, and it has no class, photo or bin (the bad
 * import set none of them). Trip and labor never are.
 */
export function isImportCopy(p: MergePart): boolean {
  if (isServiceItem(p)) return false;
  const sku = p.sku.replace(/\s+/g, " ").trim();
  const mpn = (p.mpn ?? "").replace(/\s+/g, " ").trim();
  return (
    !!sku &&
    sku.toLowerCase() === mpn.toLowerCase() &&
    categoryOf(sku) != null &&
    blank(p.itemClass) &&
    !p.hasImage &&
    blank(p.binRack) &&
    blank(p.binShelf) &&
    blank(p.binBin)
  );
}

/** The part a row stands for: itself, or the part it was merged into (followed to the end, never in a loop). */
function rootOf(p: MergePart, byId: Map<number, MergePart>): MergePart {
  let cur = p;
  const seen = new Set<number>();
  while (cur.mergedInto != null && !seen.has(cur.id)) {
    seen.add(cur.id);
    const next = byId.get(cur.mergedInto);
    if (!next) break;
    cur = next;
  }
  return cur;
}

/** The photo research key that finds this part (its MPN's first, as the Parts list reads it), or null. */
export function researchKeyOf(p: Pick<MergePart, "mpn" | "sku">, keys: Set<string>): string | null {
  for (const k of [normalizePartNo(p.mpn), normalizePartNo(p.sku)]) if (k && keys.has(k)) return k;
  return null;
}

/** The key photo research copied to this part is filed under: its MPN, else its SKU. */
export const researchKeyFor = (p: Pick<MergePart, "mpn" | "sku">): string => normalizePartNo(p.mpn) || normalizePartNo(p.sku);

const list = (parts: MergePart[], max = 4) =>
  parts
    .slice(0, max)
    .map((p) => p.sku)
    .join(", ") + (parts.length > max ? ", …" : "");

// ------------------------------------------------------------------------------------------ Part A: import copies

export type CopyPlanStatus = "fold" | "fix" | "ambiguous" | "done";

export type PartFill = { field: string; label: string; value: string };

export type CopyPlanLine = {
  status: CopyPlanStatus;
  copy: PartBrief;
  /** The number after the copy's category. */
  number: string;
  /** Fold: the part it goes into. Done: the part it went into. */
  original: PartBrief | null;
  /** Fix: the SKU and MPN the copy gets (the bare number), and its category as the parent. */
  fixedSku: string | null;
  parent: string | null;
  /** Fold: the original's blank fields this copy fills (the first copy with a value fills it). */
  fills: PartFill[];
  /** Fold: PM machine parts moved to the original. */
  machineParts: number;
  /** Fold: the copy's photo research is copied to the original (it has none). */
  research: boolean;
  /** Ambiguous: why it is left. */
  reason: string | null;
  /** Ambiguous: the parts the number fits. */
  candidates: PartBrief[];
};

export type CopyCounts = {
  copies: number;
  fold: number;
  fix: number;
  ambiguous: number;
  done: number;
  /** Originals that get at least one blank field filled. */
  filled: number;
  machineParts: number;
  research: number;
};

const COPY_FILLS: { field: "description" | "listPrice" | "rate" | "cost"; label: string; show: (p: MergePart) => string }[] = [
  { field: "description", label: "Name", show: (p) => String(p.description ?? "").trim() },
  { field: "listPrice", label: "Mfr List Price", show: (p) => money(p.listPrice ?? 0) },
  { field: "rate", label: "Price", show: (p) => money(p.rate ?? 0) },
  { field: "cost", label: "Purchase Price", show: (p) => money(p.cost ?? 0) },
];

/**
 * What Clean Up Import Copies does with each copy. The copy's number (after its last " : ") is looked up in every
 * other part's item and SKU, each with its category taken off, ignoring case and spaces; import copies don't count,
 * and a part merged into another counts as that one.
 *   * One part: Fold. Its blank Name, Mfr List Price, Price and Purchase Price come from the copy, its PM machine parts
 *     and photo research (when it has none) too, and the copy is hidden with merged_into set.
 *   * No part: Fix. The copy stays on the list with the bare number as its SKU and MPN, unless another copy has the
 *     same number (then both are Ambiguous) or the number is another row's SKU.
 *   * Two or more: Ambiguous, left as it is and listed.
 * A copy already folded is Done. Copies are planned in id order, so the first copy with a value fills a blank.
 */
export function planImportCopies(parts: MergePart[], facts: MergeFacts): CopyPlanLine[] {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const copies = parts.filter(isImportCopy).sort((a, b) => a.id - b.id);
  const copyIds = new Set(copies.map((c) => c.id));
  const originals = new Map<string, Set<number>>();
  for (const p of parts) {
    if (copyIds.has(p.id) || isServiceItem(p)) continue;
    const root = rootOf(p, byId);
    if (copyIds.has(root.id)) continue;
    for (const k of new Set([numberKey(p.item), numberKey(p.sku)])) {
      if (!k) continue;
      const set = originals.get(k) ?? new Set<number>();
      set.add(root.id);
      originals.set(k, set);
    }
  }
  const skuOwner = new Map(parts.map((p) => [p.sku.trim().toLowerCase(), p]));
  const base = (c: MergePart) => ({
    copy: brief(c),
    number: stripCategory(c.sku),
    original: null,
    fixedSku: null,
    parent: null,
    fills: [] as PartFill[],
    machineParts: 0,
    research: false,
    reason: null,
    candidates: [] as PartBrief[],
  });
  const lines: CopyPlanLine[] = [];
  const filledBy = new Map<number, Set<string>>();
  const researchGiven = new Set<number>();
  const lonely = new Map<string, MergePart[]>();
  for (const c of copies) {
    if (c.mergedInto != null) {
      const into = byId.get(c.mergedInto);
      lines.push({ ...base(c), status: "done", original: into ? brief(rootOf(into, byId)) : null });
      continue;
    }
    const fits = [...(originals.get(numberKey(c.sku)) ?? [])].map((id) => byId.get(id)!).filter((p) => p && p.id !== c.id);
    if (fits.length > 1) {
      lines.push({ ...base(c), status: "ambiguous", reason: `Fits ${fits.length} parts: ${list(fits)}. Left as it is.`, candidates: fits.map(brief) });
      continue;
    }
    if (!fits.length) {
      const key = numberKey(c.sku);
      lonely.set(key, [...(lonely.get(key) ?? []), c]);
      continue;
    }
    const o = fits[0]!;
    const taken = filledBy.get(o.id) ?? new Set<string>();
    const fills: PartFill[] = [];
    for (const f of COPY_FILLS) {
      if (taken.has(f.field) || !blank(o[f.field]) || blank(c[f.field])) continue;
      taken.add(f.field);
      fills.push({ field: f.field, label: f.label, value: f.show(c) });
    }
    filledBy.set(o.id, taken);
    const research = !researchGiven.has(o.id) && researchKeyOf(c, facts.researchKeys) != null && researchKeyOf(o, facts.researchKeys) == null;
    if (research) researchGiven.add(o.id);
    lines.push({ ...base(c), status: "fold", original: brief(o), fills, machineParts: facts.machineParts.get(c.id) ?? 0, research });
  }
  for (const [, group] of lonely) {
    if (group.length > 1) {
      for (const c of group) {
        lines.push({ ...base(c), status: "ambiguous", reason: `${group.length} import copies have this number (${list(group)}) and no other part does. Left as they are.`, candidates: group.filter((g) => g.id !== c.id).map(brief) });
      }
      continue;
    }
    const c = group[0]!;
    const number = stripCategory(c.sku);
    const owner = skuOwner.get(number.toLowerCase());
    if (owner && owner.id !== c.id) {
      lines.push({ ...base(c), status: "ambiguous", reason: `SKU ${number} is already ${owner.sku}'s. Left as it is.`, candidates: [brief(owner)] });
      continue;
    }
    lines.push({ ...base(c), status: "fix", fixedSku: number, parent: categoryOf(c.sku) });
  }
  const order: Record<CopyPlanStatus, number> = { fold: 1, fix: 2, ambiguous: 3, done: 4 };
  return lines.sort((a, b) => order[a.status] - order[b.status] || a.copy.id - b.copy.id);
}

export function copyCounts(lines: CopyPlanLine[]): CopyCounts {
  const n = (s: CopyPlanStatus) => lines.filter((l) => l.status === s).length;
  const fold = lines.filter((l) => l.status === "fold");
  return {
    copies: lines.length,
    fold: n("fold"),
    fix: n("fix"),
    ambiguous: n("ambiguous"),
    done: n("done"),
    filled: new Set(fold.filter((l) => l.fills.length).map((l) => l.original!.id)).size,
    machineParts: fold.reduce((s, l) => s + l.machineParts, 0),
    research: fold.filter((l) => l.research).length,
  };
}

// ------------------------------------------------------------------------------------------ Part B: merge file

/** Most rows one merge file takes. */
export const MERGE_MAX_ROWS = 5000;
const NOTE_MAX = 500;

type MergeField = "old" | "new" | "note";

const MERGE_HEADERS: Record<string, MergeField> = {
  "old sku": "old",
  old: "old",
  "old number": "old",
  "old part": "old",
  "old part number": "old",
  "old item": "old",
  "new sku": "new",
  new: "new",
  "new number": "new",
  "new part": "new",
  "new part number": "new",
  "new item": "new",
  "keep sku": "new",
  keeper: "new",
  note: "note",
  notes: "note",
  reason: "note",
  comment: "note",
  comments: "note",
};

export type MergeFileRow = { line: number; sheet: string; oldSku: string; newSku: string; note: string | null };

/**
 * Rows of a merge file: old_sku, new_sku and note (CSV or Excel; the header may sit under a title row, and "Old SKU",
 * "New SKU", "Notes" read the same). A row with neither number is skipped; one with only one of them is kept, to show
 * as an error.
 */
export function mergeRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): MergeFileRow[] {
  const rows: MergeFileRow[] = [];
  let readable = 0;
  for (const sheet of sheets) {
    let head = -1;
    let cols: Partial<Record<MergeField, number>> = {};
    for (let i = 0; i < Math.min(sheet.matrix.length, 5); i++) {
      const found: Partial<Record<MergeField, number>> = {};
      (sheet.matrix[i] ?? []).forEach((c, idx) => {
        const key = MERGE_HEADERS[headerKey(c)];
        if (key && found[key] == null) found[key] = idx;
      });
      if (found.old != null && found.new != null) {
        head = i;
        cols = found;
        break;
      }
    }
    if (head < 0) continue;
    readable += 1;
    const cell = (r: unknown[], f: MergeField) => (cols[f] != null ? String(r[cols[f]!] ?? "").replace(/\s+/g, " ").trim() : "");
    for (let i = head + 1; i < sheet.matrix.length; i++) {
      const r = sheet.matrix[i] ?? [];
      if (blankRow(r)) continue;
      const oldSku = cell(r, "old");
      const newSku = cell(r, "new");
      if (!oldSku && !newSku) continue;
      rows.push({ line: i + 1, sheet: sheet.name, oldSku, newSku, note: cell(r, "note").slice(0, NOTE_MAX) || null });
    }
  }
  if (!readable) throw new Error("Could not find the old_sku and new_sku columns. The first row needs headers like old_sku, new_sku, note.");
  return rows;
}

export type MergePlanStatus = "merge" | "done" | "duplicate" | "error";
export type MergeError = "invalid" | "not_found" | "same" | "chained" | "keeper_hidden" | "keeper_merged" | "ambiguous" | "merged_elsewhere";

export type MergePlanLine = {
  status: MergePlanStatus;
  error: MergeError | null;
  line: number;
  oldSku: string;
  newSku: string;
  note: string | null;
  /** The part folded away (it may already be hidden). */
  old: PartBrief | null;
  /** The part kept. */
  keeper: PartBrief | null;
  /** The keeper's blank fields the old part fills (the first row with a value fills it). */
  fills: PartFill[];
  machineParts: number;
  /** The old part's photo research is copied to the keeper (it has none). */
  research: boolean;
  reason: string | null;
};

export type MergeCounts = {
  rows: number;
  merge: number;
  done: number;
  duplicate: number;
  errors: number;
  /** Keepers that get at least one blank field filled. */
  filled: number;
  machineParts: number;
  research: number;
};

const hasBin = (p: MergePart) => !blank(p.binRack) || !blank(p.binShelf) || !blank(p.binBin);

const MERGE_FILLS: { field: string; label: string; open: (k: MergePart) => boolean; has: (o: MergePart) => boolean; show: (o: MergePart) => string }[] = [
  { field: "mpn", label: "MPN", open: (k) => blank(k.mpn), has: (o) => !blank(o.mpn), show: (o) => String(o.mpn).trim() },
  { field: "description", label: "Name", open: (k) => blank(k.description), has: (o) => !blank(o.description), show: (o) => String(o.description).trim() },
  { field: "photo", label: "Photo", open: (k) => !k.hasImage, has: (o) => o.hasImage, show: () => "the old part's photo" },
  { field: "bins", label: "Bin", open: (k) => !hasBin(k), has: hasBin, show: (o) => binText({ rack: o.binRack, shelf: o.binShelf, bin: o.binBin }) ?? "" },
  { field: "listPrice", label: "Mfr List Price", open: (k) => k.listPrice == null, has: (o) => o.listPrice != null, show: (o) => money(o.listPrice ?? 0) },
];

/**
 * What a merge file does, row by row. Each number is matched with its category taken off ("PARTS : EVER100" is
 * EVER100), ignoring case and spaces, on a part's SKU or item:
 *   * new_sku: the part kept. It must be on the list (not hidden) and not merged into another part.
 *   * old_sku: the part folded into it. It may already be hidden, but not merged.
 * Two parts with one number are an error (Clean Up Import Copies first: a folded copy no longer counts). Also errors:
 * a number not found, both numbers on the same part, a part kept in one row and folded in another (merge into the
 * last part directly), and an old part already merged into a different part. An old part already merged into this
 * keeper is Done, so running the file again changes nothing; the same pair twice is a Duplicate.
 */
export function planPartMerges(rows: MergeFileRow[], parts: MergePart[], facts: MergeFacts): MergePlanLine[] {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const byKey = new Map<string, MergePart[]>();
  for (const p of parts) {
    if (isServiceItem(p)) continue;
    for (const k of new Set([numberKey(p.sku), numberKey(p.item)])) {
      if (k) byKey.set(k, [...(byKey.get(k) ?? []), p]);
    }
  }
  const lines: (MergePlanLine & { oldPart?: MergePart; keeperPart?: MergePart })[] = rows.map((r) => {
    const base = { line: r.line, oldSku: r.oldSku, newSku: r.newSku, note: r.note, old: null, keeper: null, fills: [], machineParts: 0, research: false };
    const fail = (error: MergeError, reason: string, extra: Partial<MergePlanLine> = {}): MergePlanLine => ({ ...base, ...extra, status: "error", error, reason });
    if (!r.oldSku || !r.newSku) return fail("invalid", r.oldSku ? "No new_sku on this row." : "No old_sku on this row.");

    const newAll = byKey.get(numberKey(r.newSku)) ?? [];
    const live = newAll.filter((p) => !p.hidden && p.mergedInto == null);
    let keeper: MergePart | null = null;
    if (live.length === 1 && isImportCopy(live[0]!)) {
      return fail("ambiguous", `${r.newSku} is only on an import copy (${live[0]!.sku}). Run Clean Up Import Copies first.`);
    } else if (live.length === 1) keeper = live[0]!;
    else if (live.length > 1) {
      const copies = live.some(isImportCopy) ? " Run Clean Up Import Copies first." : "";
      return fail("ambiguous", `${live.length} parts have ${r.newSku}: ${list(live)}.${copies}`);
    } else if (newAll.some((p) => p.mergedInto != null)) {
      const into = rootOf(newAll.find((p) => p.mergedInto != null)!, byId);
      return fail("keeper_merged", `${r.newSku} was merged into ${into.sku}. Merge into ${into.sku} instead.`);
    } else if (newAll.length) {
      return fail("keeper_hidden", `${r.newSku} is hidden. Restore it on Parts first, or merge into the part that replaced it.`);
    } else return fail("not_found", `No part has ${r.newSku}.`);

    const oldAll = byKey.get(numberKey(r.oldSku)) ?? [];
    const open = oldAll.filter((p) => p.mergedInto == null);
    const extra = { keeper: brief(keeper) };
    if (open.length > 1) {
      const copies = open.some(isImportCopy) ? " Run Clean Up Import Copies first." : "";
      return fail("ambiguous", `${open.length} parts have ${r.oldSku}: ${list(open)}.${copies}`, extra);
    }
    if (!open.length) {
      const merged = oldAll.filter((p) => p.mergedInto != null);
      if (!merged.length) return fail("not_found", `No part has ${r.oldSku}.`, extra);
      const into = rootOf(merged[0]!, byId);
      if (merged.every((p) => rootOf(p, byId).id === keeper!.id)) {
        return { ...base, ...extra, old: brief(merged[0]!), status: "done", error: null, reason: `Already merged into ${keeper.sku}.` };
      }
      return fail("merged_elsewhere", `${r.oldSku} was already merged into ${into.sku}.`, extra);
    }
    const old = open[0]!;
    if (old.id === keeper.id) return fail("same", `${r.oldSku} and ${r.newSku} are the same part.`, { ...extra, old: brief(old) });
    return { ...base, ...extra, old: brief(old), status: "merge", error: null, reason: null, oldPart: old, keeperPart: keeper };
  });

  // Chains: a part kept in one row and folded in another; one part folded into two. The first row of a pair counts.
  const merging = lines.filter((l) => l.status === "merge");
  const keptIn = new Map<number, number>();
  const foldedIn = new Map<number, number>();
  for (const l of merging) {
    if (!keptIn.has(l.keeper!.id)) keptIn.set(l.keeper!.id, l.line);
    if (!foldedIn.has(l.old!.id)) foldedIn.set(l.old!.id, l.line);
  }
  const firstPair = new Map<number, MergePlanLine>();
  for (const l of merging) {
    const asKeeper = keptIn.get(l.old!.id);
    const asOld = foldedIn.get(l.keeper!.id);
    if (asKeeper != null) Object.assign(l, { status: "error", error: "chained", reason: `${l.old!.sku} is the part kept in row ${asKeeper}. Merge both into the last part directly.` });
    else if (asOld != null) Object.assign(l, { status: "error", error: "chained", reason: `${l.keeper!.sku} is folded into another part in row ${asOld}. Merge into that part directly.` });
    else {
      const first = firstPair.get(l.old!.id);
      if (!first) firstPair.set(l.old!.id, l);
      else if (first.keeper!.id === l.keeper!.id) Object.assign(l, { status: "duplicate", reason: `Same merge as row ${first.line}.` });
      else Object.assign(l, { status: "error", error: "chained", reason: `${l.old!.sku} is also merged into ${first.keeper!.sku} in row ${first.line}.` });
    }
  }

  // What each merge fills on its keeper, in file order: the first old part with a value fills a blank.
  const taken = new Map<number, Set<string>>();
  const researchGiven = new Set<number>();
  for (const l of lines) {
    if (l.status !== "merge") continue;
    const o = l.oldPart!;
    const k = l.keeperPart!;
    const got = taken.get(k.id) ?? new Set<string>();
    for (const f of MERGE_FILLS) {
      if (got.has(f.field) || !f.open(k) || !f.has(o)) continue;
      got.add(f.field);
      l.fills.push({ field: f.field, label: f.label, value: f.show(o) });
    }
    taken.set(k.id, got);
    l.machineParts = facts.machineParts.get(o.id) ?? 0;
    l.research = !researchGiven.has(k.id) && researchKeyOf(o, facts.researchKeys) != null && researchKeyOf(k, facts.researchKeys) == null;
    if (l.research) researchGiven.add(k.id);
  }
  return lines.map(({ oldPart: _o, keeperPart: _k, ...l }) => l);
}

export function mergeCounts(lines: MergePlanLine[]): MergeCounts {
  const merging = lines.filter((l) => l.status === "merge");
  return {
    rows: lines.length,
    merge: merging.length,
    done: lines.filter((l) => l.status === "done").length,
    duplicate: lines.filter((l) => l.status === "duplicate").length,
    errors: lines.filter((l) => l.status === "error").length,
    filled: new Set(merging.filter((l) => l.fills.length).map((l) => l.keeper!.id)).size,
    machineParts: merging.reduce((s, l) => s + l.machineParts, 0),
    research: merging.filter((l) => l.research).length,
  };
}

/**
 * The numbers a keeper is found by after a merge: what it had, then each old part's SKU, its MPN when that is
 * another number, and the old part's own previous numbers. None twice (case, spaces and punctuation ignored), and
 * never the keeper's own SKU or MPN.
 */
export function previousNumbersAfter(keeper: Pick<MergePart, "sku" | "mpn" | "previousNumbers">, olds: Pick<MergePart, "sku" | "mpn" | "previousNumbers">[]): string[] {
  const seen = new Set([normalizePartNo(keeper.sku), normalizePartNo(keeper.mpn)].filter(Boolean));
  const out: string[] = [];
  const add = (v: string | null | undefined) => {
    const s = String(v ?? "").trim();
    const k = normalizePartNo(s);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  keeper.previousNumbers.forEach(add);
  for (const o of olds) {
    add(o.sku);
    add(o.mpn);
    o.previousNumbers.forEach(add);
  }
  return out;
}

/**
 * The lines a merge adds to its keeper's note: each note from the file on one line, in file order, none twice. The
 * write adds the ones the keeper's note doesn't already have, under the note as it is at that moment
 * (part-merges-api.ts), so a line saved in between (Import Part Notes) is never lost and the note's own text never
 * changes (Grok, 10/29).
 */
export function noteLinesToAdd(added: (string | null)[]): string[] {
  const out: string[] = [];
  for (const a of added) {
    const t = String(a ?? "").replace(/\s+/g, " ").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
