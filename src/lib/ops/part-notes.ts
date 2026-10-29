/**
 * Import Part Notes (CSV) (Grok's request through Chuy, 2026-10-29): Parts → Import, Admin only. Each row adds one note
 * to a part's note (the field the merge file writes too). A row finds its part by id, else by its exact SKU (case and
 * spaces around it don't matter); never by name. The note goes on a new line under what the part already has, which is
 * never changed. A note the part already has (or one an earlier row of the file adds) is skipped, so the same file
 * run twice changes nothing. Hidden parts and parts merged into another are skipped and listed.
 *
 * Pure: no server imports, safe for node --test. Reading the file and writing are in part-notes-api.ts.
 */
import { blankRow, headerKey } from "./part-pricing.ts";

/** Most rows one file takes. */
export const NOTE_ROWS_MAX = 5000;
/** Longest note one row adds. */
export const NOTE_MAX = 1000;

type Field = "id" | "sku" | "note";

const NOTE_HEADERS: Record<string, Field> = {
  id: "id",
  "part id": "id",
  sku: "sku",
  note: "note",
  notes: "note",
};

/**
 * One row of the file, as typed: its id and SKU (either may be blank), and its note on one line. `overflow` is set when
 * the row has text past the header's last column: a note with commas that isn't in quotes splits into more cells.
 */
export type NoteFileRow = { line: number; idRaw: string; sku: string; note: string; overflow?: boolean };

/** A note as one line: runs of spaces, tabs and line breaks become one space, and the ends are trimmed. */
export const cleanNoteText = (raw: unknown): string => String(raw ?? "").replace(/\s+/g, " ").trim();

/** The comparison form of a SKU, as the parts table keeps it unique: no spaces around it, any case. */
export const skuKey = (raw: unknown): string => String(raw ?? "").trim().toLowerCase();

/**
 * The text of a CSV file from its bytes: UTF-8 (a byte-order mark is dropped), or, when the bytes aren't UTF-8, the
 * Windows code page Excel saves a plain "CSV" in, so "Café – Ø58" reads right either way.
 */
export function csvTextFromBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/**
 * The rows of a notes file: a header row (in the first five) with note and id or sku ("Part ID", "SKU", "Notes" read
 * the same), then one row per note. A row with nothing in it is skipped. `line` is the row's line in the file, so the
 * matrix must keep blank rows.
 */
export function noteRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): NoteFileRow[] {
  const rows: NoteFileRow[] = [];
  let readable = 0;
  for (const sheet of sheets) {
    let head = -1;
    let cols: Partial<Record<Field, number>> = {};
    for (let i = 0; i < Math.min(sheet.matrix.length, 5); i++) {
      const found: Partial<Record<Field, number>> = {};
      (sheet.matrix[i] ?? []).forEach((c, idx) => {
        const key = NOTE_HEADERS[headerKey(c)];
        if (key && found[key] == null) found[key] = idx;
      });
      if (found.note != null && (found.id != null || found.sku != null)) {
        head = i;
        cols = found;
        break;
      }
    }
    if (head < 0) continue;
    readable += 1;
    const raw = (r: unknown[], f: Field) => (cols[f] != null ? String(r[cols[f]!] ?? "") : "");
    // Cells past the header's last named column hold text only when a row split where it shouldn't have.
    const width = (sheet.matrix[head] ?? []).reduce<number>((w, c, idx) => (String(c ?? "").trim() ? idx + 1 : w), 0);
    for (let i = head + 1; i < sheet.matrix.length; i++) {
      const r = sheet.matrix[i] ?? [];
      if (blankRow(r)) continue;
      const overflow = r.slice(width).some((c) => String(c ?? "").trim() !== "");
      rows.push({ line: i + 1, idRaw: raw(r, "id").trim(), sku: raw(r, "sku").trim(), note: cleanNoteText(raw(r, "note")), ...(overflow ? { overflow } : {}) });
    }
  }
  if (!readable) throw new Error("Could not find the note column and an id or sku column. The first row needs headers like sku, note (or id, note).");
  return rows;
}

/** A part as the notes import reads it. `note` is exactly as stored. */
export type NotePart = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  kind: string;
  note: string | null;
  hidden: boolean;
  mergedInto: number | null;
};

/** What happens to a row. */
export type NoteStatus = "add" | "already" | "not_found" | "ambiguous" | "hidden" | "merged" | "invalid" | "changed";

export type NotePlanLine = {
  line: number;
  /** The id and SKU as the file has them. */
  idRaw: string;
  sku: string;
  /** The note this row adds, on one line. */
  note: string;
  status: NoteStatus;
  /** Why, for anything but add. */
  reason: string | null;
  /** The part the row names: its id, SKU and the name the Parts page shows (its description, else its NetSuite name). */
  part: { id: number; sku: string; name: string } | null;
  /** The part's note before this import, as stored. */
  currentNote: string | null;
};

/** The note's lines as compared: each on one line, trimmed; blank lines left out. */
function noteLines(note: string | null): string[] {
  return String(note ?? "")
    .split(/\r\n|\r|\n/)
    .map(cleanNoteText)
    .filter(Boolean);
}

const NOT_PARTS = new Set(["trip", "labor"]);

/**
 * Each row's part and what happens to it, in file order. The id wins when the row has one; a row whose id and SKU
 * name different parts is ambiguous and changes nothing.
 */
export function planPartNotes(rows: NoteFileRow[], parts: NotePart[]): NotePlanLine[] {
  const byId = new Map<number, NotePart>();
  const bySku = new Map<string, NotePart[]>();
  for (const p of parts) {
    if (NOT_PARTS.has(p.kind)) continue;
    byId.set(p.id, p);
    const k = skuKey(p.sku);
    if (k) bySku.set(k, [...(bySku.get(k) ?? []), p]);
  }
  const skuOf = new Map(parts.map((p) => [p.id, p.sku]));
  // The notes each part has, and gets from earlier rows of this file.
  const has = new Map<number, Set<string>>();
  return rows.map((r): NotePlanLine => {
    const base = { line: r.line, idRaw: r.idRaw, sku: r.sku, note: r.note, part: null, currentNote: null };
    const stop = (status: NoteStatus, reason: string, part: NotePart | null = null): NotePlanLine => ({
      ...base,
      status,
      reason,
      part: part ? { id: part.id, sku: part.sku, name: part.description?.trim() || part.item } : null,
      currentNote: part?.note ?? null,
    });
    if (r.overflow) return stop("invalid", "The row has more cells than the header: a note with commas needs quotes around it");
    let part: NotePart | null = null;
    if (r.idRaw) {
      if (!/^\d{1,9}$/.test(r.idRaw)) return stop("invalid", `Can't read the id "${r.idRaw}"`);
      part = byId.get(Number(r.idRaw)) ?? null;
      if (!part) return stop("not_found", `No part has id ${Number(r.idRaw)}`);
      if (r.sku && skuKey(r.sku) !== skuKey(part.sku)) return stop("ambiguous", `Id ${part.id} is SKU ${part.sku}, not ${r.sku}`, part);
    } else if (r.sku) {
      const found = bySku.get(skuKey(r.sku)) ?? [];
      if (!found.length) return stop("not_found", `No part has SKU ${r.sku}`);
      if (found.length > 1) return stop("ambiguous", `${found.length} parts have SKU ${r.sku}`);
      part = found[0]!;
    } else {
      return stop("invalid", "No sku or id");
    }
    if (!r.note) return stop("invalid", "No note", part);
    if (r.note.length > NOTE_MAX) return stop("invalid", `The note is longer than ${NOTE_MAX.toLocaleString("en-US")} characters`, part);
    if (part.mergedInto != null) {
      const into = skuOf.get(part.mergedInto);
      return stop("merged", into ? `Merged into ${into}` : "Merged into another part", part);
    }
    if (part.hidden) return stop("hidden", "The part is hidden", part);
    const seen = has.get(part.id) ?? new Set(noteLines(part.note));
    has.set(part.id, seen);
    if (seen.has(r.note)) {
      return stop("already", noteLines(part.note).includes(r.note) ? "Already in the part's note" : "The same note is on an earlier row", part);
    }
    seen.add(r.note);
    return { ...stop("add", "", part), reason: null };
  });
}

/**
 * The part's note with these notes added: what it has, exactly as stored, then each new note on its own line. A note
 * that is only blank space is replaced.
 */
export function noteWithAdded(current: string | null, added: string[]): string {
  const extra = added.join("\n");
  if (!current || !current.trim()) return extra;
  return /[\r\n]$/.test(current) ? `${current}${extra}` : `${current}\n${extra}`;
}

/** One write per part: its note as read (the write checks it is still that) and its note after. */
export type NoteWrite = { id: number; before: string | null; after: string; notes: number };

export function noteWrites(lines: NotePlanLine[]): NoteWrite[] {
  const per = new Map<number, { before: string | null; notes: string[] }>();
  for (const l of lines) {
    if (l.status !== "add" || !l.part) continue;
    const w = per.get(l.part.id) ?? { before: l.currentNote, notes: [] };
    w.notes.push(l.note);
    per.set(l.part.id, w);
  }
  return [...per].map(([id, w]) => ({ id, before: w.before, after: noteWithAdded(w.before, w.notes), notes: w.notes.length }));
}

export type NoteCounts = {
  rows: number;
  add: number;
  /** Parts that get a note. */
  parts: number;
  already: number;
  notFound: number;
  ambiguous: number;
  hidden: number;
  merged: number;
  invalid: number;
  /** Changed since the preview, so not written (after Confirm only). */
  changed: number;
  /** Everything not added and not "not found", as the import log counts it. */
  skipped: number;
};

export function noteCounts(lines: NotePlanLine[]): NoteCounts {
  const n = (s: NoteStatus) => lines.filter((l) => l.status === s).length;
  const add = n("add");
  const notFound = n("not_found");
  return {
    rows: lines.length,
    add,
    parts: new Set(lines.filter((l) => l.status === "add").map((l) => l.part!.id)).size,
    already: n("already"),
    notFound,
    ambiguous: n("ambiguous"),
    hidden: n("hidden"),
    merged: n("merged"),
    invalid: n("invalid"),
    changed: n("changed"),
    skipped: lines.length - add - notFound,
  };
}
