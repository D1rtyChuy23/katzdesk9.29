/**
 * Bin locations: where a part sits in the stockroom, as Rack, Shelf and Bin. Typed on the part's row or in its
 * window, given to several parts at once with Move Bin, or read from a Bin Locations file (CSV or Excel) and planned
 * here before anything is written. The Bin Template is the same columns, so a spreadsheet filled in from it imports
 * straight back. Changing a bin is Admin only for now (Chuy, 10/28); everyone sees it.
 * Pure: no server imports, safe for node --test.
 */
import { csvCell, splitItemName } from "./charges.ts";
import { blankRow, headerKey, mpnKey, PART_HEADERS } from "./part-pricing.ts";

/** Longest Rack, Shelf or Bin kept. */
export const BIN_MAX = 40;

export type BinValues = { rack: string | null; shelf: string | null; bin: string | null };
export const BIN_PIECES = ["rack", "shelf", "bin"] as const;
export const BIN_LABEL: Record<(typeof BIN_PIECES)[number], string> = { rack: "Rack", shelf: "Shelf", bin: "Bin" };

/**
 * One piece as stored: spaces collapsed and trimmed, blank is null. A leading apostrophe that a spreadsheet export
 * puts before = + - @ (so the cell is not run as a formula) is taken off again.
 */
export function cleanBinValue(raw: unknown): string | null {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'(?=[=+\-@])/, "");
  return s || null;
}

/** "Rack A · Shelf 3 · Bin 12", only the pieces that are set; null when none is. */
export function binText(v: { rack?: string | null; shelf?: string | null; bin?: string | null } | null | undefined): string | null {
  if (!v) return null;
  const parts = BIN_PIECES.filter((k) => v[k]).map((k) => `${BIN_LABEL[k]} ${v[k]}`);
  return parts.length ? parts.join(" · ") : null;
}

export const sameBins = (a: BinValues, b: BinValues) => a.rack === b.rack && a.shelf === b.shelf && a.bin === b.bin;

/** Most parts picked on Parts that one Move Bin, Set Class or Hide takes. */
export const PARTS_PICK_MAX = 500;

/**
 * Move Bin for several parts at once (10/28): each piece typed goes on every part, and a blank piece keeps the
 * part's own. A Rack alone moves a whole shelf's parts to another rack and keeps each part's shelf and bin.
 * `typed` is already cleaned (blank is null).
 */
export function binsAfterMove(old: BinValues, typed: BinValues): BinValues {
  return { rack: typed.rack ?? old.rack, shelf: typed.shelf ?? old.shelf, bin: typed.bin ?? old.bin };
}

/**
 * The Parts search read as a bin code: "A 03 12" and "A/03/12" become A-03-12, the way the three pieces are joined
 * for the search, so any of them finds the part in Rack A, Shelf 03, Bin 12.
 */
export function binSearchCode(q: string): string {
  return q.trim().replace(/\s*[-/]\s*|\s+/g, "-");
}

/** "A-03-12" or "A/3/12": three letters-or-digits pieces split by dashes or slashes. Anything else is not a code. */
export function splitBinCode(raw: string | null | undefined): BinValues | null {
  const m = /^([A-Za-z0-9]+)\s*[-/]\s*([A-Za-z0-9]+)\s*[-/]\s*([A-Za-z0-9]+)$/.exec(String(raw ?? "").trim());
  return m ? { rack: m[1]!, shelf: m[2]!, bin: m[3]! } : null;
}

const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";
const DATE_TEXT = [/^\d{1,2}\/\d{1,2}\/\d{2,4}$/, new RegExp(`^\\d{1,2}-${MONTH}(-\\d{2,4})?$`, "i"), new RegExp(`^${MONTH}-\\d{2,4}$`, "i")];

/**
 * True for what Excel makes of a bin typed like a date: 1-2-7 becomes 1/2/2007, 1-2 becomes 2-Jan. The import
 * reads an Excel date cell as m/d/yyyy whatever its format, so this catches those too.
 */
export function looksLikeExcelDate(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim();
  return DATE_TEXT.some((re) => re.test(s));
}

// ------------------------------------------------------------------------------------------ reading the file

type BinField = "mpn" | "sku" | "rack" | "shelf" | "bin" | "code";

/**
 * The part number columns the parts import already knows (MPN, Mfr Part, Name, SKU, Item and the rest), plus
 * Part # (the MPN, as Parts labels it) and the bin columns. "Bin Number", "Bin Location" and "Bin Code" are the
 * whole location, as is "Proposed Bin" (the Bin Code Review workbook, where Item Name is the part); a plain "Bin" is
 * the bin piece when the sheet has a Rack or Shelf column, else the whole location.
 */
const BIN_HEADERS: Record<string, BinField> = {
  ...Object.fromEntries(
    Object.entries(PART_HEADERS)
      .filter(([, f]) => f === "mpn" || f === "name")
      .map(([k, f]) => [k, f === "mpn" ? "mpn" : "sku"]),
  ),
  "part #": "mpn",
  "part number": "mpn",
  "part no": "mpn",
  "netsuite item": "sku",
  "netsuite name": "sku",
  "netsuite sku": "sku",
  rack: "rack",
  "rack #": "rack",
  "rack number": "rack",
  "rack no": "rack",
  shelf: "shelf",
  "shelf #": "shelf",
  "shelf number": "shelf",
  "shelf no": "shelf",
  bin: "bin",
  "bin #": "bin",
  "bin no": "bin",
  "bin number": "code",
  "bin location": "code",
  "bin code": "code",
  "proposed bin": "code",
};

export type BinFileRow = {
  line: number;
  sheet: string;
  /** From an MPN / Mfr Part / Part # column. */
  mpn: string | null;
  /** From a SKU / Name / Item column; "PARTS : EVER104120" is read as EVER104120. */
  sku: string | null;
  /** What the file gives; null is a blank cell and keeps what is stored (unless `whole`). */
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  /**
   * True when the value came from the whole-location column (Bin Location, or a Bin column with no Rack or Shelf
   * column): it replaces all three pieces, so "Overflow cage" clears a stored Rack and Shelf.
   */
  whole: boolean;
  /** True when one code (A-03-12) was split into rack, shelf and bin. */
  split: boolean;
  /** The code as the file has it ("A-03-12") when it was split; else null. */
  code: string | null;
  /** A value that looks like a date Excel made of a bin (1-2-7 becomes 1/2/2007). Not split, not applied. */
  date: string | null;
};

export type BinFileRead = { rows: BinFileRow[]; /** Rows with no part number. */ skipped: number };

function findBinHeader(matrix: unknown[][]): { head: number; cols: Partial<Record<BinField, number>> } | null {
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const cols: Partial<Record<BinField, number>> = {};
    (matrix[i] ?? []).forEach((c, idx) => {
      const key = BIN_HEADERS[headerKey(c)];
      if (key && cols[key] == null) cols[key] = idx;
    });
    const id = cols.mpn != null || cols.sku != null;
    const where = cols.rack != null || cols.shelf != null || cols.bin != null || cols.code != null;
    if (id && where) return { head: i, cols };
  }
  return null;
}

/**
 * Rows of a Bin Locations file. Needs a part number column (MPN, Part #, Mfr Part, SKU, Name or Item) and Rack /
 * Shelf / Bin, or one Bin Location column. A sheet with Rack or Shelf columns (the Bin Template is one) is read
 * piece by piece and never split. The whole-location column (Bin Location, or a Bin column with no Rack or Shelf
 * beside it) replaces all three: "A-03-12" or "A/3/12" is split into them, anything else is the Bin alone. A value
 * that looks like a date Excel made of a bin is flagged, never split. Every sheet with the columns is read.
 */
export function binRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): BinFileRead {
  const rows: BinFileRow[] = [];
  let skipped = 0;
  let readable = 0;
  for (const sheet of sheets) {
    const found = findBinHeader(sheet.matrix);
    if (!found) continue;
    readable += 1;
    const { head, cols } = found;
    const wholeField: BinField | null = cols.code != null ? "code" : cols.rack == null && cols.shelf == null && cols.bin != null ? "bin" : null;
    const cell = (r: unknown[], f: BinField) => (cols[f] != null ? String(r[cols[f]!] ?? "").replace(/\s+/g, " ").trim() : "");
    for (let i = head + 1; i < sheet.matrix.length; i++) {
      const r = sheet.matrix[i] ?? [];
      if (blankRow(r)) continue;
      const mpn = cell(r, "mpn");
      const rawSku = cell(r, "sku");
      const sku = rawSku ? splitItemName(rawSku).sku : "";
      if (!mpnKey(mpn) && !mpnKey(sku)) {
        skipped += 1;
        continue;
      }
      const pieces: BinValues = {
        rack: cleanBinValue(cell(r, "rack")),
        shelf: cleanBinValue(cell(r, "shelf")),
        bin: wholeField === "bin" ? null : cleanBinValue(cell(r, "bin")),
      };
      const whole = wholeField && !pieces.rack && !pieces.shelf && !pieces.bin ? cleanBinValue(cell(r, wholeField)) : null;
      const date = [pieces.rack, pieces.shelf, pieces.bin, whole].find((v) => looksLikeExcelDate(v)) ?? null;
      const split = whole && !date ? splitBinCode(whole) : null;
      const v = whole ? (split ?? { rack: null, shelf: null, bin: whole }) : pieces;
      rows.push({ line: i + 1, sheet: sheet.name, mpn: mpn || null, sku: sku || null, ...v, whole: !!whole, split: !!split, code: split ? whole : null, date });
    }
  }
  if (!readable) {
    throw new Error("Could not find a part number column and a bin column. The first row needs headers like MPN (or SKU) and Rack, Shelf, Bin, or one Bin Location column.");
  }
  return { rows, skipped };
}

// ------------------------------------------------------------------------------------------ planning

export type StoredBinPart = { id: number; sku: string; mpn: string | null; description: string | null } & BinValues;

export type BinPlanStatus = "update" | "same" | "unmatched" | "ambiguous" | "blank" | "duplicate" | "too_long" | "date";

export type BinPlanLine = {
  status: BinPlanStatus;
  line: number;
  sheet: string;
  /** The part number as the file has it (MPN, else SKU). */
  ref: string;
  partId: number | null;
  sku: string | null;
  mpn: string | null;
  description: string | null;
  /** What the file gives; null keeps what is stored. Written as is: the update keeps stored values for nulls. */
  file: BinValues;
  /** The file's value is the whole location: all three pieces are written, nulls included. */
  whole: boolean;
  /** Stored before, and after the save (blank cells keep the stored piece). Null when no single part matched. */
  old: BinValues | null;
  next: BinValues | null;
  reason: string | null;
};

function group<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

function uniqueParts<T extends { id: number }>(list: T[]): T[] {
  const seen = new Set<number>();
  return list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/**
 * What a Bin Locations file will do, row by row. A part is found the way the parts import finds one: the MPN with
 * case, spaces and punctuation ignored (a part with no MPN is found by its SKU), and a SKU column by the exact SKU,
 * else the same MPN match. When the row has both and they point at different parts it is Ambiguous, as is a
 * part number two parts share. A blank cell keeps what is stored, except from the whole-location column, which
 * replaces all three; a row with no bin values at all is Blank. The same part on two rows keeps the first.
 */
export function planBins(rows: BinFileRow[], stored: StoredBinPart[]): BinPlanLine[] {
  const byMpn = group(stored, (p) => mpnKey(p.mpn));
  const bySkuNoMpn = group(
    stored.filter((p) => !mpnKey(p.mpn)),
    (p) => mpnKey(p.sku),
  );
  const bySkuExact = group(stored, (p) => p.sku.trim().toLowerCase());
  const mpnMatches = (raw: string) => uniqueParts([...(byMpn.get(mpnKey(raw)) ?? []), ...(bySkuNoMpn.get(mpnKey(raw)) ?? [])]);
  const skuMatches = (raw: string) => {
    const exact = bySkuExact.get(raw.trim().toLowerCase()) ?? [];
    if (exact.length === 1) return exact;
    // NetSuite's Name column is the part number: when no SKU is an exact fit, match it as the parts import does,
    // on MPNs and the SKUs of parts with no MPN, so a number two parts carry comes out Ambiguous.
    return mpnMatches(raw);
  };
  const resolve = (row: BinFileRow): StoredBinPart[] => {
    const bySku = row.sku && mpnKey(row.sku) ? skuMatches(row.sku) : [];
    const byNumber = row.mpn && mpnKey(row.mpn) ? mpnMatches(row.mpn) : [];
    if (!bySku.length) return byNumber;
    if (!byNumber.length) return bySku;
    const both = bySku.filter((p) => byNumber.some((q) => q.id === p.id));
    return both.length ? both : uniqueParts([...bySku, ...byNumber]);
  };

  const used = new Set<number>();
  return rows.map((row): BinPlanLine => {
    const file: BinValues = { rack: row.rack, shelf: row.shelf, bin: row.bin };
    const base = { line: row.line, sheet: row.sheet, ref: row.mpn || row.sku || "", file, whole: row.whole };
    const none = { partId: null, sku: row.sku, mpn: row.mpn, description: null, old: null, next: null };
    if (!file.rack && !file.shelf && !file.bin) return { ...base, ...none, status: "blank", reason: "No rack, shelf or bin on this row." };
    const hits = resolve(row);
    if (!hits.length) return { ...base, ...none, status: "unmatched", reason: "No part on the Parts list has this part number." };
    if (hits.length > 1) {
      const skus = hits.slice(0, 5).map((p) => p.sku).join(", ");
      return { ...base, ...none, status: "ambiguous", reason: `Matches ${hits.length} parts (${skus}${hits.length > 5 ? ", …" : ""}). Use the SKU column to pick one.` };
    }
    const p = hits[0]!;
    const old: BinValues = { rack: p.rack, shelf: p.shelf, bin: p.bin };
    const found = { partId: p.id, sku: p.sku, mpn: p.mpn, description: p.description, old };
    const long = BIN_PIECES.find((k) => (file[k]?.length ?? 0) > BIN_MAX);
    if (long) return { ...base, ...found, next: null, status: "too_long", reason: `${BIN_LABEL[long]} is longer than ${BIN_MAX} characters.` };
    if (row.date) {
      return {
        ...base,
        ...found,
        next: null,
        status: "date",
        reason: `${row.date} looks like a date: Excel turns a bin typed like 1-2-7 into one. Format the column as Text in Excel, type the bin again and import again.`,
      };
    }
    if (used.has(p.id)) return { ...base, ...found, next: null, status: "duplicate", reason: "This part is on an earlier row of the file. The first row is used." };
    used.add(p.id);
    const next: BinValues = row.whole ? file : { rack: file.rack ?? old.rack, shelf: file.shelf ?? old.shelf, bin: file.bin ?? old.bin };
    // A bin typed whole as A-03-12 in the part's window is the same place as the file's A-03-12 split in three.
    const sameCode = row.code != null && !old.rack && !old.shelf && old.bin === row.code;
    return sameBins(old, next) || sameCode ? { ...base, ...found, next: old, status: "same", reason: null } : { ...base, ...found, next, status: "update", reason: null };
  });
}

/** Lines a Save writes: one matched part each, with a change. */
export const binsToApply = (plan: BinPlanLine[]) => plan.filter((l) => l.status === "update" && l.partId != null);

// ------------------------------------------------------------------------------------------ template

export const BIN_TEMPLATE_COLUMNS = ["MPN", "SKU", "Description", "Rack", "Shelf", "Bin"];

/**
 * The Bin Template: one row per part with its current bin, as CSV. Starts with a byte-order mark so Excel reads it
 * as UTF-8; a cell that could run as a formula gets a leading apostrophe, which the import takes off again.
 */
export function binTemplateCsv(parts: StoredBinPart[]): string {
  const lines = [BIN_TEMPLATE_COLUMNS.map(csvCell).join(",")];
  for (const p of parts) lines.push([p.mpn ?? "", p.sku, p.description ?? "", p.rack ?? "", p.shelf ?? "", p.bin ?? ""].map(csvCell).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function binTemplateFileName(date: string): string {
  return `KatzDesk-Bin-Template-${date}.csv`;
}
