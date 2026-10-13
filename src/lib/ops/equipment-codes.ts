/**
 * Equipment item codes → Library variations. A row says which manufacturer and model an item code is, and,
 * when it is known, the MPN. Pure rules: reading the file and planning the result. No database here.
 */
import { cleanMpn, mpnKey } from "./mpn-rules.ts";
import { variationTitle } from "./library-file-rules.ts";

export type CodeRow = {
  line: number;
  itemCode: string;
  manufacturer: string;
  model: string;
  mpn: string | null;
};

const HEADERS: Record<string, "itemCode" | "manufacturer" | "model" | "mpn"> = {
  "item code": "itemCode",
  "netsuite item": "itemCode",
  item: "itemCode",
  name: "itemCode",
  manufacturer: "manufacturer",
  maker: "manufacturer",
  make: "manufacturer",
  model: "model",
  variation: "model",
  "model variation": "model",
  mpn: "mpn",
  "manufacturer part number": "mpn",
  "mfr part number": "mpn",
  "mfr part": "mpn",
  "part number": "mpn",
};

const key = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Rows from a worklist (header row first). Rows with no manufacturer or model are reported by the plan. */
export function codeRowsFromMatrix(matrix: unknown[][]): CodeRow[] {
  let head = -1;
  let cols: Partial<Record<"itemCode" | "manufacturer" | "model" | "mpn", number>> = {};
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const found: typeof cols = {};
    (matrix[i] ?? []).forEach((c, idx) => {
      const k = HEADERS[key(c)];
      if (k && found[k] == null) found[k] = idx;
    });
    if (found.manufacturer != null && found.model != null) {
      head = i;
      cols = found;
      break;
    }
  }
  if (head < 0) throw new Error("Could not find Manufacturer and Model columns in the first rows.");
  const out: CodeRow[] = [];
  for (let i = head + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    if (r.every((c) => !String(c ?? "").trim())) continue;
    const cell = (c: number | undefined) => (c == null ? "" : String(r[c] ?? "").replace(/\s+/g, " ").trim());
    out.push({
      line: i + 1,
      itemCode: cell(cols.itemCode),
      manufacturer: cell(cols.manufacturer),
      model: cell(cols.model),
      mpn: cleanMpn(cell(cols.mpn)),
    });
  }
  return out;
}

export type ExistingBook = { id: number; title: string; manufacturer: string; mpn: string | null };

export type CodePlanStatus =
  | "new" // a new variation will be added
  | "new-mpn" // a new variation, with its MPN
  | "exists" // already in the Library, nothing to change
  | "set-mpn" // already there, MPN will be recorded
  | "same" // already there with this MPN
  | "needs-mpn" // will be added (or exists) with no MPN; official files cannot be matched yet
  | "conflict" // not applied; reason says why
  | "invalid"; // missing manufacturer or model

export type CodePlanLine = CodeRow & {
  title: string;
  status: CodePlanStatus;
  reason: string | null;
  bookId: number | null;
};

/**
 * What importing would do, row by row. Nothing is guessed: an MPN is recorded only when the row has one, a
 * variation that already has a different MPN is left alone, and one MPN is never put on two variations.
 */
export function planCodes(rows: CodeRow[], books: ExistingBook[]): CodePlanLine[] {
  const byTitle = new Map(books.map((b) => [b.title.toLowerCase(), b]));
  const mpnOwner = new Map<string, string>();
  for (const b of books) if (mpnKey(b.mpn)) mpnOwner.set(mpnKey(b.mpn), b.title);
  const seenTitle = new Map<string, number>();

  return rows.map((r) => {
    const base = { ...r, title: "", bookId: null as number | null, reason: null as string | null };
    if (!r.manufacturer || !r.model) {
      return { ...base, status: "invalid" as const, reason: "Needs a manufacturer and a model." };
    }
    const title = variationTitle(r.manufacturer, r.model);
    const have = byTitle.get(title.toLowerCase()) ?? null;
    const line = { ...base, title, bookId: have?.id ?? null };
    const lower = title.toLowerCase();
    if (seenTitle.has(lower)) {
      return { ...line, status: "conflict" as const, reason: `Same model as line ${seenTitle.get(lower)} in this file.` };
    }
    seenTitle.set(lower, r.line);

    if (!r.mpn) {
      if (have) return { ...line, status: have.mpn ? ("exists" as const) : ("needs-mpn" as const), reason: have.mpn ? null : "No MPN yet." };
      return { ...line, status: "needs-mpn" as const, reason: "Added without an MPN. Official files cannot be matched until it is set." };
    }
    const k = mpnKey(r.mpn);
    const owner = mpnOwner.get(k);
    if (owner && owner.toLowerCase() !== lower) {
      return { ...line, status: "conflict" as const, reason: `MPN ${r.mpn} is already on ${owner}.` };
    }
    if (have && mpnKey(have.mpn) && mpnKey(have.mpn) !== k) {
      return { ...line, status: "conflict" as const, reason: `${have.title} already has MPN ${have.mpn}. Not changed.` };
    }
    mpnOwner.set(k, title);
    if (have) return { ...line, status: mpnKey(have.mpn) === k ? ("same" as const) : ("set-mpn" as const) };
    return { ...line, status: "new-mpn" as const };
  });
}

/** Rows the import will act on. */
export const WILL_WRITE: CodePlanStatus[] = ["new", "new-mpn", "needs-mpn", "set-mpn"];
