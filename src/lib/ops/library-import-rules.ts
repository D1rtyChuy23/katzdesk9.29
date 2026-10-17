/**
 * Decisions for the one-time Library import. Pure: no database and no downloads.
 *
 * The vendor list says where each PDF was planned. Manuals and parts are stored once on the family's main
 * chip (created as "Maker Family" when that book is missing). Spec sheets stay on the target book. A null
 * MPN is left blank. The manufacturer product page is not stored: a book has no column for it.
 */
import {
  copiesToVariations,
  customFileName,
  familyOf,
  fileExt,
  isMainChip,
  isManualType,
  mainChipFor,
  makerOf,
  MAX_FILE_BYTES,
  nameKey,
  type LibrarySection,
} from "./library-file-rules.ts";
import { cleanMpn, mpnKey, sameMpn } from "./mpn-rules.ts";

export const DUPLICATE_PHRASE = "Duplicate To Delete";
/** Another file on the Eversys Cameo book must contain this before file 50 is marked. */
export const CAMEO_REPLACEMENT = "5700105620";
/** File 50 is the Cameo file that waits for the replacement above. It is not its own replacement. */
export const CAMEO_MARK_ID = 50;

export type ImportAction = "OK" | "SKIP" | "FAIL" | "CONFLICT";

export type LibraryImportRow = {
  kind: "duplicate" | "upload" | "mpn";
  action: ImportAction;
  reason: string;
  url: string | null;
  bookId: number | null;
  fileId: number | null;
};

export type LibraryImportReport = {
  applied: boolean;
  limit: number;
  counts: Record<ImportAction, number>;
  rows: LibraryImportRow[];
};

export type ImportBook = { id: number; title: string; manufacturer: string; mpn: string | null };

export type StoredRef = {
  id: number;
  name: string;
  originalName: string | null;
  size: number;
  section: LibrarySection;
  bookId: number | null;
  sourceUrl: string | null;
};

export type ImportTarget = { bookId: number; section: string; docType: string | null; name: string };

export type PlannedStore = {
  kind: "store";
  /** 0 when the main chip still has to be created. */
  bookId: number;
  bookTitle: string;
  section: LibrarySection;
  docType: string | null;
  name: string;
  /** A book already in this family. Skip-checks use it before the main chip exists. */
  anchorBookId: number;
  /** Set when the main chip is not in the Library yet. apply=false does not create it. */
  createMain: { manufacturer: string; family: string; title: string } | null;
};

export type PlannedDest = PlannedStore | { kind: "conflict"; bookId: number | null; reason: string };

export function importCounts(rows: { action: ImportAction }[]): Record<ImportAction, number> {
  const counts = { OK: 0, SKIP: 0, FAIL: 0, CONFLICT: 0 };
  for (const row of rows) counts[row.action] += 1;
  return counts;
}

export function publicRow(row: LibraryImportRow): LibraryImportRow {
  return { kind: row.kind, action: row.action, reason: row.reason, url: row.url, bookId: row.bookId, fileId: row.fileId };
}

/** "Manual.pdf" → "Manual - Duplicate To Delete.pdf". A name that already has the phrase is unchanged. */
export function duplicateMarkedName(name: string): string {
  if (name.includes(DUPLICATE_PHRASE)) return name;
  const ext = fileExt(name);
  if (ext && name.toLowerCase().endsWith(`.${ext}`)) return `${name.slice(0, -(ext.length + 1))} - ${DUPLICATE_PHRASE}.${ext}`;
  return `${name} - ${DUPLICATE_PHRASE}`;
}

const tidy = (v: string) => v.replace(/\s+/g, " ").trim();
const normTitle = (v: string) => tidy(v).toLowerCase();

/** "Bunn" + "Axiom" → "Bunn Axiom". A model that already starts with the maker is not doubled. */
export function importBookTitle(manufacturer: string, model: string) {
  const maker = tidy(manufacturer);
  const modelName = tidy(model);
  return modelName.toLowerCase().startsWith(maker.toLowerCase() + " ") ? modelName : `${maker} ${modelName}`;
}

function withMaker(book: ImportBook): ImportBook {
  const manufacturer = tidy(book.manufacturer) || makerOf(book.title);
  return manufacturer === book.manufacturer ? book : { ...book, manufacturer };
}

function sameFamily(a: ImportBook, b: ImportBook) {
  const left = withMaker(a);
  const right = withMaker(b);
  return left.manufacturer.toLowerCase() === right.manufacturer.toLowerCase() && nameKey(familyOf(left.title, left.manufacturer)) === nameKey(familyOf(right.title, right.manufacturer));
}

function isCameoBook(book: ImportBook) {
  const made = withMaker(book);
  return made.manufacturer.toLowerCase() === "eversys" && nameKey(familyOf(made.title, made.manufacturer)) === "cameo";
}

/** True when some other file on an Eversys Cameo book already has 5700105620 in its name. */
export function cameoHasReplacement(books: ImportBook[], files: { id: number; name: string; originalName?: string | null; bookId: number | null }[], exceptFileId: number) {
  const cameo = new Set(books.filter(isCameoBook).map((b) => b.id));
  return files.some((f) => f.id !== exceptFileId && f.bookId != null && cameo.has(f.bookId) && `${f.name} ${f.originalName ?? ""}`.includes(CAMEO_REPLACEMENT));
}

export function planDuplicateMark(
  fileId: number,
  file: { id: number; name: string; bookId: number | null } | undefined,
  books: ImportBook[],
  files: { id: number; name: string; originalName?: string | null; bookId: number | null }[],
): LibraryImportRow {
  if (!file) return { kind: "duplicate", action: "FAIL", reason: `File #${fileId} is not in the Library.`, url: null, bookId: null, fileId };
  if (file.name.includes(DUPLICATE_PHRASE)) {
    return { kind: "duplicate", action: "SKIP", reason: "Already marked Duplicate To Delete.", url: null, bookId: file.bookId, fileId };
  }
  if (fileId === CAMEO_MARK_ID && !cameoHasReplacement(books, files, fileId)) {
    return {
      kind: "duplicate",
      action: "SKIP",
      reason: `Eversys Cameo does not have a file whose name contains ${CAMEO_REPLACEMENT} yet.`,
      url: null,
      bookId: file.bookId,
      fileId,
    };
  }
  const next = duplicateMarkedName(file.name);
  return { kind: "duplicate", action: "OK", reason: `Rename to "${next}".`, url: null, bookId: file.bookId, fileId };
}

function isSection(v: string): v is LibrarySection {
  return v === "spec" || v === "manuals" || v === "parts";
}

/** Swap the target book's title for the main chip's, so a shared file is not named after one variation. */
export function nameOnChip(chipTitle: string, targetBookTitle: string, targetName: string, fileName: string): string {
  const raw = tidy(targetName);
  const from = tidy(targetBookTitle);
  const swapped = raw.toLowerCase().startsWith(from.toLowerCase()) ? `${tidy(chipTitle)}${raw.slice(from.length)}` : raw;
  const named = customFileName(swapped, fileName);
  if ("name" in named) return named.name;
  const fallback = customFileName(targetName, fileName);
  if ("name" in fallback) return fallback.name;
  const ext = fileExt(fileName);
  return ext ? `${tidy(chipTitle)}.${ext}` : tidy(chipTitle);
}

/**
 * Where one vendor PDF goes. Manuals and parts collapse to one file per family. Spec sheets stay on each
 * target book. A target whose book is missing is a conflict and does not invent a book.
 */
export function uploadDestinations(fileName: string, targets: ImportTarget[], books: ImportBook[]): PlannedDest[] {
  const byId = new Map(books.map((b) => [b.id, withMaker(b)]));
  const out: PlannedDest[] = [];
  const groups = new Map<string, { section: LibrarySection; docType: string | null; targets: { book: ImportBook; name: string }[] }>();

  for (const target of targets) {
    if (!isSection(target.section)) {
      out.push({ kind: "conflict", bookId: target.bookId, reason: `Section "${target.section}" is not a Library section.` });
      continue;
    }
    const book = byId.get(target.bookId);
    if (!book) {
      out.push({ kind: "conflict", bookId: target.bookId, reason: `Book #${target.bookId} is not in the Library.` });
      continue;
    }
    if (target.section === "manuals" && !isManualType(target.docType)) {
      out.push({ kind: "conflict", bookId: book.id, reason: `No manual type for ${fileName}.` });
      continue;
    }
    if (target.section === "spec") {
      out.push({
        kind: "store",
        bookId: book.id,
        bookTitle: book.title,
        section: "spec",
        docType: null,
        name: nameOnChip(book.title, book.title, target.name, fileName),
        anchorBookId: book.id,
        createMain: null,
      });
      continue;
    }
    const docType = target.section === "manuals" ? tidy(target.docType ?? "") || null : null;
    const key = `${book.manufacturer.toLowerCase()}|${nameKey(familyOf(book.title, book.manufacturer))}|${target.section}|${docType ?? ""}`;
    const group = groups.get(key) ?? { section: target.section, docType, targets: [] };
    group.targets.push({ book, name: target.name });
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const sample = group.targets[0]!.book;
    const pool = [...byId.values()];
    const main = isMainChip(sample) ? sample : mainChipFor(sample, pool);
    const onMain = main ? group.targets.find((t) => t.book.id === main.id) : undefined;
    const source = onMain ?? group.targets[0]!;
    if (!main) {
      if (sample.manufacturer.trim().length < 2) {
        out.push({ kind: "conflict", bookId: sample.id, reason: `${sample.title} has no manufacturer, so a main chip cannot be added.` });
        continue;
      }
      const family = familyOf(sample.title, sample.manufacturer);
      const title = importBookTitle(sample.manufacturer, family);
      out.push({
        kind: "store",
        bookId: 0,
        bookTitle: title,
        section: group.section,
        docType: group.docType,
        name: nameOnChip(title, source.book.title, source.name, fileName),
        anchorBookId: sample.id,
        createMain: { manufacturer: sample.manufacturer, family, title },
      });
      continue;
    }
    out.push({
      kind: "store",
      bookId: main.id,
      bookTitle: main.title,
      section: group.section,
      docType: group.docType,
      name: nameOnChip(main.title, source.book.title, source.name, fileName),
      anchorBookId: main.id,
      createMain: null,
    });
  }
  return out;
}

function stemOf(fileName: string) {
  return fileName.replace(/\.[A-Za-z0-9]+$/, "");
}

function containsStem(hay: string, stem: string) {
  if (!hay || !stem) return false;
  const text = hay.toLowerCase();
  const needle = stem.toLowerCase();
  let at = 0;
  while ((at = text.indexOf(needle, at)) !== -1) {
    const before = at === 0 || !/[a-z0-9]/i.test(text[at - 1] ?? "");
    const after = at + needle.length >= text.length || !/[a-z0-9]/i.test(text[at + needle.length] ?? "");
    if (before && after) return true;
    at += 1;
  }
  return false;
}

function covers(fileBookId: number, destBookId: number, section: LibrarySection, books: ImportBook[]) {
  if (!copiesToVariations(section)) return fileBookId === destBookId;
  const dest = books.find((b) => b.id === destBookId);
  const home = books.find((b) => b.id === fileBookId);
  return !!dest && !!home && sameFamily(dest, home);
}

/**
 * A vendor file already in the Library: the same source URL, or the same size and the vendor file name,
 * on that spec book or anywhere in the manual/parts family. A different size is a different file.
 */
export function alreadyStored(url: string, fileName: string, dest: { bookId: number; section: LibrarySection }, size: number | null, books: ImportBook[], files: StoredRef[]): StoredRef | null {
  const stem = stemOf(fileName);
  for (const file of files) {
    if (file.section !== dest.section || file.bookId == null) continue;
    if (!covers(file.bookId, dest.bookId, dest.section, books)) continue;
    if (file.sourceUrl && file.sourceUrl === url) return file;
    if (size == null || file.size !== size) continue;
    const original = file.originalName ?? "";
    if (original.toLowerCase() === fileName.toLowerCase() || containsStem(original, stem) || containsStem(file.name, stem)) return file;
  }
  return null;
}

/** null when the bytes can be stored. Size wins over the header when the download is over 20 MB. */
export function pdfRejectReason(byteLength: number, header: string): string | null {
  if (byteLength > MAX_FILE_BYTES) return "File is over 20 MB.";
  if (byteLength < 5 || !header.startsWith("%PDF-")) return "File does not start with %PDF-.";
  return null;
}

/** "Name.pdf" stays; a taken name becomes "Name 2.pdf". Compared without the extension. */
export function uniqueStoredName(wanted: string, taken: string[]): string {
  const ext = fileExt(wanted);
  const stem = ext && wanted.toLowerCase().endsWith(`.${ext}`) ? wanted.slice(0, -(ext.length + 1)) : wanted;
  const used = new Set(
    taken.map((n) => {
      const e = fileExt(n);
      return (e && n.toLowerCase().endsWith(`.${e}`) ? n.slice(0, -(e.length + 1)) : n).toLowerCase();
    }),
  );
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? stem : `${stem} ${n}`;
    if (!used.has(candidate.toLowerCase())) return ext ? `${candidate}.${ext}` : candidate;
  }
}

export function vendorUrlError(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That vendor address is not a URL.";
  }
  if (url.protocol !== "https:") return "Only an https vendor file can be downloaded.";
  return null;
}

/**
 * Vendor URLs still to download. Ones already logged OK or SKIP are finished. FAIL and CONFLICT wait until the
 * new URLs are done, so one bad file does not sit at the front of every batch.
 */
export function uploadSlice<T extends { url: string }>(uploads: T[], logged: { url: string | null; action: ImportAction }[], limit: number): T[] {
  const byUrl = new Map<string, Set<ImportAction>>();
  for (const row of logged) {
    if (!row.url) continue;
    const set = byUrl.get(row.url) ?? new Set<ImportAction>();
    set.add(row.action);
    byUrl.set(row.url, set);
  }
  const finished = (url: string) => {
    const actions = byUrl.get(url);
    return !!actions && (actions.has("OK") || actions.has("SKIP"));
  };
  const fresh = uploads.filter((u) => !byUrl.has(u.url));
  const retry = uploads.filter((u) => byUrl.has(u.url) && !finished(u.url));
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return [...fresh, ...retry].slice(0, cap);
}

export function planMpn(
  row: { bookId: number; title: string; mpn: string | null },
  book: ImportBook | undefined,
  books: ImportBook[],
  tiedBookIds: Set<number>,
): LibraryImportRow & { mpn: string | null } {
  const base = { kind: "mpn" as const, url: null, bookId: row.bookId, fileId: null };
  const mpn = cleanMpn(row.mpn);
  if (!mpn) return { ...base, action: "SKIP", reason: "MPN left blank.", mpn: null };
  if (!book) return { ...base, action: "FAIL", reason: `Book #${row.bookId} is not in the Library.`, mpn: null };
  if (normTitle(book.title) !== normTitle(row.title)) {
    return { ...base, action: "CONFLICT", reason: `Book #${row.bookId} is "${book.title}", not "${tidy(row.title)}".`, mpn: null };
  }
  if (sameMpn(book.mpn, mpn)) return { ...base, action: "SKIP", reason: `MPN already ${book.mpn}.`, mpn: null };
  const key = mpnKey(mpn);
  const clash = books.find((b) => b.id !== book.id && mpnKey(b.mpn) === key);
  if (clash) return { ...base, action: "CONFLICT", reason: `MPN ${mpn} is already on ${clash.title}.`, mpn: null };
  if (book.mpn) {
    const tied = tiedBookIds.has(book.id) ? " Files are tied to it." : "";
    return { ...base, action: "CONFLICT", reason: `Book already has MPN ${book.mpn}.${tied}`, mpn: null };
  }
  return { ...base, action: "OK", reason: `Set MPN to ${mpn}.`, mpn };
}
