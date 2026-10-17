/**
 * The Library — Manuals and Parts Diagrams: file rules. Pure: no DOM, safe for node --test.
 */
import { flagOn } from "./flag.ts";
export type LibrarySection = "spec" | "manuals" | "parts";
export const LIBRARY_SECTIONS: LibrarySection[] = ["spec", "manuals", "parts"];

/** Biggest single file. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/**
 * Files travel in pieces this size so each request stays small. 1 MB pieces (about 1.4 MB once base64-encoded)
 * were rejected with a 502 by the katzdesk.grok.me proxy; 512 KB pieces go through. A 20 MB file is 40 pieces,
 * inside the server's limit of 101 (seq 0-100).
 */
export const CHUNK_BYTES = 512 * 1024;

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(",");
export const ALLOWED_TEXT = "PDF, images (PNG, JPG, WebP, GIF) and Word (DOC, DOCX)";

/** Add Files and spec-sheet edits: the admin flag, the Admin desk role, or Sales. */
export function canEditFromRole(row: { is_admin?: unknown; desk_role?: string | null } | null | undefined): boolean {
  const admin = flagOn(row?.is_admin) || row?.desk_role === "admin";
  return admin || row?.desk_role === "sales";
}

export function fileExt(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}
/** Content type from the file name — the browser's own guess is often blank or wrong. */
export function mimeFor(name: string): string | null {
  return TYPES[fileExt(name)] ?? null;
}
/** PDFs and pictures open in the browser tab; Word files can only download. */
export function opensInline(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}

export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** null when the file is fine, otherwise a sentence to show the person. */
export function fileError(name: string, size: number): string | null {
  const clean = name.trim();
  if (!clean) return "That file has no name.";
  if (!mimeFor(clean)) return `${clean} can't be added — only ${ALLOWED_TEXT} are accepted.`;
  if (size <= 0) return `${clean} is empty.`;
  if (size > MAX_FILE_BYTES) return `${clean} is too big (${sizeText(size)}). The limit is ${sizeText(MAX_FILE_BYTES)} per file.`;
  return null;
}

/** A–Z by file name, ignoring case; "Manual 2" before "Manual 10". */
export function sortByName<T extends { name: string }>(files: T[]): T[] {
  // Compare without the extension so "Manual.pdf" comes before "Manual 2.pdf".
  const stem = (n: string) => n.replace(/\.[A-Za-z0-9]+$/, "");
  const cmp = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true });
  return [...files].sort((a, b) => cmp(stem(a.name), stem(b.name)) || cmp(a.name, b.name) || a.name.localeCompare(b.name));
}

/** Full link on the app's own domain; opens the document for anyone who has it. */
export function fileUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/api/library-file/${token}`;
}
export function emailHref(name: string, url: string): string {
  return `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(`${name}\n${url}`)}`;
}
/** "sms:?&body=" is the form both iPhone and Android accept. */
export function textHref(name: string, url: string): string {
  return `sms:?&body=${encodeURIComponent(`${name}: ${url}`)}`;
}

// ---- Books: one per equipment family ----

/** Shelf name inside a book, and the word used when a file is renamed "Family - Type". */
export const SHELF: Record<LibrarySection, { title: string; type: string }> = {
  spec: { title: "Spec Sheet", type: "Spec Sheet" },
  manuals: { title: "Manuals", type: "Manual" },
  parts: { title: "Parts Diagrams", type: "Parts Book" },
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Family name for a spec sheet: maker + the model's family word, without variant codes.
 * Bunn + "Axiom-DV-3" → "Bunn Axiom"; Fetco + "CBS-1252" → "Fetco CBS-1252"; La Marzocco + "Linea PB" → "La Marzocco Linea".
 */
export function familyTitle(manufacturer: string, model: string): string {
  const maker = clean(manufacturer);
  let m = clean(model);
  // "Bunn Axiom" typed as the model: don't repeat the maker.
  if (maker && m.toLowerCase().startsWith(maker.toLowerCase() + " ")) m = m.slice(maker.length + 1);
  const first = m.split(" ")[0] ?? "";
  const parts = first.split("-").filter(Boolean);
  let family = parts[0] ?? "";
  // A model number like CBS-1252 is the family itself; a word like Axiom-DV-3 drops its variant codes.
  if (parts[1] && /\d{3,}/.test(parts[1]) && !/\d/.test(parts[0]!)) family = `${parts[0]}-${parts[1]}`;
  return clean(`${maker} ${family}`);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The book for a spec sheet: maker + the full model name, variation included. Bunn + "Axiom DV-APS" → "Bunn Axiom DV-APS". */
export function variationTitle(manufacturer: string, model: string): string {
  const maker = clean(manufacturer);
  const m = clean(model);
  return maker && !m.toLowerCase().startsWith(maker.toLowerCase() + " ") && m.toLowerCase() !== maker.toLowerCase() ? clean(`${maker} ${m}`) : m;
}

export type BookRef = { id: number; title: string; manufacturer?: string };

const modelTokens = (b: { title: string; manufacturer?: string }) => {
  const maker = b.manufacturer || makerOf(b.title);
  return tokens(modelLabel(b.title, maker));
};

/**
 * Ways a book can be named in a file name: the whole title, or the whole model without the maker
 * ("Bunn Axiom DV-APS" or "Axiom DV-APS"). Never part of the model — "Axiom" alone is not DV-APS.
 */
export function bookKeys(title: string, manufacturer?: string): string[][] {
  const model = modelTokens({ title, manufacturer });
  const keys = [tokens(title)];
  if (model.join("").length >= 3 && model.length < keys[0]!.length) keys.push(model);
  return keys;
}

function keyLength(text: string, key: string[]): number {
  // Tokens may be joined or split by spaces, dashes, underscores ("CBS-1252", "cbs 1252", "CBS1252").
  const re = new RegExp(`(^|[^a-z0-9])${key.map(escapeRe).join("[^a-z0-9]*")}($|[^a-z])`, "i");
  return re.test(text.toLowerCase()) ? key.join("").length : 0;
}

const startsWithTokens = (long: string[], short: string[]) => long.length > short.length && short.every((t, i) => long[i] === t);

/**
 * Which book a file name belongs to. Returns the book only when exactly one fits best AND no other
 * variation of that same model exists that the name could also mean; otherwise null — the person picks.
 */
export function matchBook<T extends BookRef>(text: string, books: T[]): T | null {
  let best = 0;
  let hits: T[] = [];
  for (const b of books) {
    const score = Math.max(0, ...bookKeys(b.title, b.manufacturer).map((k) => keyLength(text, k)));
    if (!score) continue;
    if (score > best) {
      best = score;
      hits = [b];
    } else if (score === best) hits.push(b);
  }
  if (hits.length !== 1) return null;
  const hit = hits[0]!;
  // "Axiom manual.pdf" with Axiom, Axiom DV-APS and Axiom Twin on file: could be any of them.
  const mine = modelTokens(hit);
  if (books.some((b) => b.id !== hit.id && startsWithTokens(modelTokens(b), mine))) return null;
  return hit;
}

/** Books worth showing first in the picker: same maker or same first model word as the file name. */
export function likelyBooks<T extends BookRef>(text: string, books: T[]): T[] {
  const words = new Set(tokens(text));
  return books.filter((b) => {
    const first = modelTokens(b)[0];
    return !!first && first.length >= 3 && words.has(first);
  });
}

// ---- Manuals: named by what kind of manual they are ----

export const MANUAL_TYPES = ["Operating / Installation Manual", "Cleaning Manual", "Programming Manual", "User Manual", "Service And Repair Manual", "PM Guide"] as const;
export type ManualType = (typeof MANUAL_TYPES)[number];
export const isManualType = (v: unknown): v is ManualType => MANUAL_TYPES.includes(v as ManualType);
// Parts files are not a manual type: they only go in the Parts drop zone. A manual is never filed as a parts book.

const TYPE_WORDS: [ManualType, RegExp][] = [
  ["Cleaning Manual", /\bclean(ing)?\b|\bsanitiz|\bdescal/],
  ["Programming Manual", /\bprogram(ming)?\b/],
  ["Operating / Installation Manual", /\binstall(ation)?\b|\boperat(ing|ion|ions|or|ors)\b/],
  ["User Manual", /\busers?\b|\bowners?\b/],
  ["Service And Repair Manual", /\bservic(e|ing)\b|\brepairs?\b|\btroubleshoot(ing)?\b/],
  ["PM Guide", /\bpm\b|\bpreventi?(ve|ative)\b|\bmaintenance\b/],
];

/**
 * The manual type a file name spells out, or null when it names none or more than one — then the person picks.
 * "Axiom cleaning guide.pdf" → Cleaning Manual; "Axiom manual.pdf" → null; "Install and cleaning.pdf" → null.
 */
export function manualTypeFromName(name: string): ManualType | null {
  const text = name.replace(/\.[A-Za-z0-9]+$/, "").replace(/[_\-.]+/g, " ").replace(/'s\b/g, "s").toLowerCase();
  const hits = TYPE_WORDS.filter(([, re]) => re.test(text)).map(([t]) => t);
  return hits.length === 1 ? hits[0]! : null;
}

/** "Bunn Axiom - Manual.pdf"; a second one becomes "Bunn Axiom - Manual 2.pdf". A manual type replaces the word "Manual". */
export function shelfFileName(bookTitle: string, section: LibrarySection, originalName: string, taken: string[], type?: string | null): string {
  // A parts file keeps the name it was dropped with. It is never given a generated title.
  if (section === "parts") return clean(originalName);
  const ext = fileExt(originalName);
  const base = `${clean(bookTitle)} - ${type && isManualType(type) ? type : SHELF[section].type}`;
  // Compared without the extension, so a .png and a .pdf never share the name "Parts Book".
  const stem = (n: string) => n.replace(/\.[A-Za-z0-9]+$/, "").toLowerCase();
  const used = new Set(taken.map(stem));
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!used.has(name.toLowerCase())) return `${name}${ext ? `.${ext}` : ""}`;
  }
}

/**
 * A name typed by a person for a stored file. The file keeps its own extension; a typed extension is dropped.
 * Returns the full file name, or an error sentence.
 */
export function customFileName(typed: string, currentName: string): { name: string } | { error: string } {
  const ext = fileExt(currentName);
  // Characters a file name can't carry on Windows or in a download header become spaces.
  const safe = [...typed].map((ch) => (ch.charCodeAt(0) < 32 || '\\<>:"|?*'.includes(ch) ? " " : ch)).join("");
  let stem = clean(safe);
  if (ext && stem.toLowerCase().endsWith(`.${ext}`)) stem = stem.slice(0, -(ext.length + 1)).trim();
  if (stem.length < 2) return { error: "Type a name for the file." };
  if (stem.length > 120) return { error: "That name is too long. Keep it under 120 characters." };
  return { name: `${stem}${ext ? `.${ext}` : ""}` };
}

// ---- Manufacturer → model ----

/** Makers with more than one word, or that staff add by hand before any spec sheet exists. */
const KNOWN_MAKERS = [
  "La Marzocco", "Nuova Simonelli", "Victoria Arduino", "Wilbur Curtis", "La Cimbali", "La Spaziale", "Bunn", "Fetco", "Eversys",
  "Curtis", "Rancilio", "Franke", "Schaerer", "Mahlkonig", "Mazzer", "Ditting", "Slayer", "Synesso", "Baratza", "Astoria", "Faema", "Thermoplan",
];

/** The maker a book title starts with: the longest known maker, else the first word. */
export function makerOf(title: string, makers: string[] = []): string {
  const t = clean(title);
  const lower = t.toLowerCase();
  const hit = [...makers, ...KNOWN_MAKERS]
    .map(clean)
    .filter((m) => m && (lower === m.toLowerCase() || lower.startsWith(m.toLowerCase() + " ")))
    .sort((a, b) => b.length - a.length)[0];
  return hit ?? t.split(" ")[0] ?? t;
}

/** "Bunn Axiom" under Bunn → "Axiom". */
export function modelLabel(title: string, maker: string): string {
  const t = clean(title);
  const rest = t.toLowerCase().startsWith(maker.toLowerCase() + " ") ? t.slice(maker.length + 1) : t;
  return rest || t;
}

/** Inside a model the family is already on screen: "Bunn Axiom - Manual 2.pdf" → "Manual 2". */
export function shortDocName(name: string, bookTitle: string): string {
  const stem = name.replace(/\.[A-Za-z0-9]+$/, "");
  const prefix = `${clean(bookTitle)} - `;
  return stem.toLowerCase().startsWith(prefix.toLowerCase()) ? stem.slice(prefix.length) : stem;
}

// ---- Family → variation, and filing by the document's first word ----

/** "Axiom-DV-APS" and "axiom dv aps" are the same name. */
export const nameKey = (v: string) => v.toLowerCase().replace(/[\s_\-–]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * The family a model sits under.
 * A word model keeps its first word, up to the first dash or space:
 * "Axiom-DV-APS" → "Axiom"; "G9-2T HD Stainless" → "G9"; "GR-2.2" → "GR"; "ITCB-DV" → "ITCB".
 * A LETTERS-DIGITS model with 3 or more digits (CBS-1252, GRS-1201, MBS-1221) is a series.
 * The last digit is the variant, so CBS-1250, CBS-1251 and CBS-1252 share "CBS-125", and
 * CBS-1231 and CBS-1232 share "CBS-123". A code that is already 3 digits ("CBS-125") is the
 * family itself, so a main chip with that name stays the main chip. Two digits (Axiom-15-3)
 * are a variant code, not a series, and the family stays the first word.
 */
export function familyOf(title: string, maker: string): string {
  const model = modelLabel(title, maker);
  const head = model.split(/\s+/).filter(Boolean)[0] ?? model;
  const coded = /^([A-Za-z]+)[-–](\d{3,})/.exec(head);
  if (coded) {
    const letters = coded[1]!;
    const digits = coded[2]!;
    // Four or more digits: keep the first three (CBS-1252 → CBS-125). Three digits is already the family.
    const series = digits.length >= 4 ? digits.slice(0, 3) : digits;
    return `${letters}-${series}`;
  }
  return model.split(/[\s\-–_]+/).filter(Boolean)[0] ?? model;
}

/** Document number: the last token of a file name, extension removed. "IPB 55012.pdf" → "55012". */
export function docNumber(name: string): string {
  const stem = name.replace(/\.[A-Za-z0-9]+$/, "");
  const parts = stem.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Words that open a file name without naming a model. */
const NOT_A_MODEL = new Set([
  "manual", "manuals", "spec", "specs", "specification", "specifications", "sheet", "parts", "part", "user", "users", "owner", "owners", "cleaning", "installation",
  "install", "operating", "operation", "programming", "service", "repair", "guide", "the", "a", "an", "new", "copy", "scan", "scanned", "doc", "document", "final", "rev", "img", "image", "untitled",
]);

/**
 * The model variation a document names: its first word. A leading maker ("Bunn Axiom-DV-APS manual.pdf") is skipped.
 * Null when the first word is not a model name — a part number, a date, or a word like "Manual".
 */
export function docVariation(fileName: string, makers: string[] = []): { word: string; maker: string | null } | null {
  const stem = clean(fileName.replace(/\.[A-Za-z0-9]+$/, "").replace(/_+/g, " "));
  let rest = stem;
  let maker: string | null = null;
  const hit = [...makers, ...KNOWN_MAKERS]
    .map(clean)
    .filter((m) => m && (rest.toLowerCase() === m.toLowerCase() || rest.toLowerCase().startsWith(m.toLowerCase() + " ")))
    .sort((a, b) => b.length - a.length)[0];
  if (hit) {
    maker = makers.find((m) => clean(m).toLowerCase() === hit.toLowerCase()) ?? hit;
    rest = rest.slice(hit.length).trim();
  }
  const word = (rest.split(" ")[0] ?? "").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  if (word.length < 2 || !/[A-Za-z]/.test(word) || /^\d/.test(word) && !/[A-Za-z]{2}/.test(word)) return maker ? { word: "", maker } : null;
  if (NOT_A_MODEL.has(word.toLowerCase())) return maker ? { word: "", maker } : null;
  return { word, maker };
}

/**
 * The chip a document belongs to. The longest existing variation whose whole name opens the file name wins
 * ("G9-2T HD Stainless spec.pdf" → G9-2T HD Stainless); otherwise the variation named exactly by the first word.
 * Never a nearby model: "Axiom-35-3" does not fall into "Axiom" or "Axiom-15-3". Null → a new chip.
 */
export function chipForDoc<T extends BookRef>(fileName: string, books: T[], maker?: string | null): T | null {
  const doc = docVariation(fileName, books.map((b) => b.manufacturer ?? "").filter(Boolean));
  if (!doc || !doc.word) return null;
  const want = (maker ?? doc.maker ?? "").toLowerCase();
  const pool = want ? books.filter((b) => (b.manufacturer ?? makerOf(b.title)).toLowerCase() === want) : books;
  const stem = clean(fileName.replace(/\.[A-Za-z0-9]+$/, "").replace(/_+/g, " "));
  const text = nameKey(doc.maker && stem.toLowerCase().startsWith(doc.maker.toLowerCase()) ? stem.slice(doc.maker.length) : stem);
  const hits = pool
    .map((b) => ({ b, key: nameKey(modelLabel(b.title, b.manufacturer ?? makerOf(b.title))) }))
    // The whole chip name, ending where a word ends; and it must cover the whole first word.
    .filter(({ key }) => key && (text === key || text.startsWith(key + "-")) && key.length >= nameKey(doc.word).length)
    .sort((x, y) => y.key.length - x.key.length);
  if (!hits.length) return null;
  // Two makers with the same model name and no maker known: not decidable here.
  if (hits.length > 1 && hits[0]!.key === hits[1]!.key) return null;
  return hits[0]!.b;
}

// ---- Main chip: its manuals are copied onto every variation of the parent ----

type FamilyBook = { id: number; title: string; manufacturer: string };
const sameFamily = (a: FamilyBook, b: FamilyBook) =>
  a.manufacturer.toLowerCase() === b.manufacturer.toLowerCase() && nameKey(familyOf(a.title, a.manufacturer)) === nameKey(familyOf(b.title, b.manufacturer));

/** The main model chip is the variation named exactly like its parent, and only when another book is in that family. */
export function isMainChip(book: FamilyBook, books: readonly FamilyBook[]): boolean {
  if (nameKey(modelLabel(book.title, book.manufacturer)) !== nameKey(familyOf(book.title, book.manufacturer))) return false;
  return books.some((other) => other.id !== book.id && sameFamily(other, book));
}

/** The main chip a variation takes manuals from; null on the main chip itself and for a parent with no main chip. */
export function mainChipFor<T extends FamilyBook>(book: T, books: T[]): T | null {
  if (isMainChip(book, books)) return null;
  return books.find((b) => b.id !== book.id && sameFamily(b, book) && isMainChip(b, books)) ?? null;
}

/** Every other variation of the main chip's parent — where its manuals are copied to. */
export function variationsOf<T extends FamilyBook>(main: T, books: T[]): T[] {
  return isMainChip(main, books) ? books.filter((b) => b.id !== main.id && sameFamily(b, main)) : [];
}

/** `mpn` is set when the file is the official file for one MPN: such a file stays on its own variation. */
type FamilyFile = { id: number; section: LibrarySection; bookId: number | null; mpn?: string | null };
/** A file tied to one MPN is never shared; a shared manual (no MPN) still copies from the main chip. */
const isShared = (f: { section: LibrarySection; mpn?: string | null }) => COPIED.has(f.section) && !(f.mpn ?? "").trim();
/** What the main chip hands to every variation: manuals and parts files. A spec sheet stays on its own chip. */
const COPIED = new Set<LibrarySection>(["manuals", "parts"]);
export const copiesToVariations = (section: LibrarySection) => COPIED.has(section);
export type HiddenCopy = { fileId: number; bookId: number };

/**
 * Manuals and parts files a variation shows because they sit on its parent's main chip. Spec sheets do not copy:
 * they stay on the variation they were added to. A copy removed from this variation is left out; the main
 * file and the other variations are not touched.
 */
export function copiedManuals<F extends FamilyFile, T extends FamilyBook>(book: T, books: T[], files: F[], hidden: HiddenCopy[]): F[] {
  const main = mainChipFor(book, books);
  if (!main) return [];
  const gone = new Set(hidden.filter((h) => h.bookId === book.id).map((h) => h.fileId));
  return files.filter((f) => f.bookId === main.id && isShared(f) && !gone.has(f.id));
}

/** Copies this variation removed, so they can be put back. */
export function removedCopies<F extends FamilyFile, T extends FamilyBook>(book: T, books: T[], files: F[], hidden: HiddenCopy[]): F[] {
  const main = mainChipFor(book, books);
  if (!main) return [];
  const gone = new Set(hidden.filter((h) => h.bookId === book.id).map((h) => h.fileId));
  return files.filter((f) => f.bookId === main.id && isShared(f) && gone.has(f.id));
}

// ---- One copy of a manual or parts file per family ----

/** A stored manual or parts file that can be compared for a shared copy. `docName` is the name the document number is read from (the original name, when the shelf renamed it). */
export type ShareFile = {
  id: number;
  name: string;
  docName?: string | null;
  size: number;
  section: LibrarySection;
  bookId: number | null;
  mpn?: string | null;
};

const docKey = (name: string) => docNumber(name).toLowerCase();
const shareDocName = (f: { name: string; docName?: string | null }) => (f.docName?.trim() ? f.docName.trim() : f.name);

/**
 * Manuals or parts already stored on another book in the same family with the same byte size and the same
 * document number. Spec sheets are never duplicates. A file tied to one MPN stays on its own variation.
 * Uploading onto the main chip is already "store once", so that is not reported here.
 */
export function familyDuplicates<F extends ShareFile, B extends FamilyBook>(
  incoming: { name: string; size: number; section: LibrarySection; bookId: number },
  books: B[],
  files: F[],
): F[] {
  if (!copiesToVariations(incoming.section)) return [];
  const want = docKey(incoming.name);
  if (!want) return [];
  const book = books.find((b) => b.id === incoming.bookId);
  if (!book || isMainChip(book, books)) return [];
  return files.filter((f) => {
    if (!copiesToVariations(f.section) || (f.mpn ?? "").trim()) return false;
    if (f.bookId == null || f.bookId === incoming.bookId || f.size !== incoming.size) return false;
    if (docKey(shareDocName(f)) !== want) return false;
    const other = books.find((b) => b.id === f.bookId);
    return !!other && sameFamily(book, other);
  });
}

export type FamilyDuplicateGroup<F> = {
  manufacturer: string;
  family: string;
  size: number;
  /** The document number as it appears on the first file in the group. */
  docNumber: string;
  files: F[];
};

/**
 * Manuals and parts that share a byte size and a document number on more than one book in one family.
 * Spec sheets are left out. One group is one shared document.
 */
export function familyDuplicateGroups<F extends ShareFile, B extends FamilyBook>(books: B[], files: F[]): FamilyDuplicateGroup<F>[] {
  const byId = new Map(books.map((b) => [b.id, b]));
  const groups = new Map<string, FamilyDuplicateGroup<F> & { bookIds: Set<number> }>();
  for (const f of files) {
    if (!copiesToVariations(f.section) || (f.mpn ?? "").trim() || f.bookId == null) continue;
    const book = byId.get(f.bookId);
    if (!book) continue;
    const doc = docNumber(shareDocName(f));
    if (!doc) continue;
    const family = familyOf(book.title, book.manufacturer);
    const key = `${book.manufacturer.toLowerCase()}|${nameKey(family)}|${f.size}|${doc.toLowerCase()}`;
    const group = groups.get(key) ?? { manufacturer: book.manufacturer, family, size: f.size, docNumber: doc, files: [], bookIds: new Set<number>() };
    group.files.push(f);
    group.bookIds.add(f.bookId);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((g) => g.bookIds.size >= 2)
    .map((g) => ({ manufacturer: g.manufacturer, family: g.family, size: g.size, docNumber: g.docNumber, files: g.files }))
    .sort((a, b) => a.family.localeCompare(b.family, "en", { numeric: true }) || a.docNumber.localeCompare(b.docNumber, "en", { numeric: true }) || a.size - b.size);
}

/** Empty duplicate books the one-time cleanup may remove, and only when the title matches and the book has nothing in it. */
export const CLEANUP_BOOKS = [
  { id: 34, title: "BUNN AXIOM-15-3 (2U/1L)" },
  { id: 35, title: "BUNN AXIOM-15-3 (3 Lower)" },
] as const;

export type CleanupBookFacts = { id: number; title: string; files: number; sheets: number; fixes: number; notes: number };

/** Whether one of the known empty duplicate books can be removed. Anything else is left alone. */
export function cleanupBookDecision(expected: { id: number; title: string }, found: CleanupBookFacts | null): { action: "remove" | "skip" | "missing"; reason: string } {
  if (!found || found.id !== expected.id) return { action: "missing", reason: `Book #${expected.id} is not in The Library.` };
  if (found.title.trim() !== expected.title) return { action: "skip", reason: `Title is "${found.title}", not "${expected.title}". Left in place.` };
  if (found.files > 0) return { action: "skip", reason: `Has ${found.files} file${found.files === 1 ? "" : "s"}. Left in place.` };
  if (found.sheets > 0) return { action: "skip", reason: "Has a spec sheet. Left in place." };
  if (found.fixes > 0) return { action: "skip", reason: "Has troubleshoot notes. Left in place." };
  if (found.notes > 0) return { action: "skip", reason: "Has unofficial sources. Left in place." };
  return { action: "remove", reason: "Empty, and the title matches. It will be removed." };
}

// ---- Library import: share a file only when the whole family is in the upload ----

const IMPORT_NAME_SEP = " - ";

/** The stored name: the text before " - " is the variation, and becomes the main chip title. */
export function rewriteMainChipName(targetName: string, mainTitle: string): string {
  const at = targetName.indexOf(IMPORT_NAME_SEP);
  if (at < 0) return targetName;
  return `${mainTitle}${targetName.slice(at)}`;
}

export type ImportPlanTarget = {
  bookId: number;
  section: LibrarySection;
  docType: string | null;
  name: string;
};

export type CollapsedImportTarget = {
  bookId: number | null;
  bookTitle: string;
  manufacturer: string;
  section: LibrarySection;
  docType: string | null;
  name: string;
  /** Set when the target names a book that is not in The Library. No book is created for it. */
  missingBookId?: number;
};

export type ImportBook = { id: number; title: string; manufacturer: string };

/**
 * Where one upload's targets are stored.
 * Spec sheets stay on the book they name.
 * Manuals and parts go to the family's existing main chip only when the upload names every variation
 * (every book from variationsOf(main), and the main chip too when it is one of the targets) and there
 * are at least two targets. Otherwise each target stays on the book in the JSON, with its name unchanged.
 * A book is never created here. Two families in one upload are decided separately.
 */
export function collapseImportTargets(
  targets: ImportPlanTarget[],
  books: ImportBook[],
): CollapsedImportTarget[] {
  const byId = new Map(books.map((b) => [b.id, b]));
  const out: CollapsedImportTarget[] = [];
  const specSeen = new Set<string>();
  const groups = new Map<string, ImportPlanTarget[]>();

  for (const target of targets) {
    const book = byId.get(target.bookId);
    if (!book) {
      out.push({
        bookId: null,
        bookTitle: "",
        manufacturer: "",
        section: target.section,
        docType: target.docType,
        name: target.name,
        missingBookId: target.bookId,
      });
      continue;
    }
    if (!copiesToVariations(target.section)) {
      const key = `spec|${book.id}|${target.name.trim().toLowerCase()}`;
      if (specSeen.has(key)) continue;
      specSeen.add(key);
      out.push({
        bookId: book.id,
        bookTitle: book.title,
        manufacturer: book.manufacturer,
        section: target.section,
        docType: null,
        name: target.name,
      });
      continue;
    }
    const family = familyOf(book.title, book.manufacturer);
    const key = `${target.section}|${book.manufacturer.toLowerCase()}|${nameKey(family)}`;
    const group = groups.get(key) ?? [];
    if (!group.some((t) => t.bookId === target.bookId)) group.push(target);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const sample = byId.get(group[0]!.bookId);
    const main = sample ? (isMainChip(sample, books) ? sample : mainChipFor(sample, books)) : null;
    const ids = new Set(group.map((t) => t.bookId));
    const required = main ? variationsOf(main, books).map((b) => b.id) : [];
    if (main && ids.has(main.id)) required.push(main.id);
    const share = !!main && group.length >= 2 && required.length >= 2 && required.every((id) => ids.has(id));
    if (share && main) {
      const source = group.find((t) => t.bookId !== main.id) ?? group[0]!;
      out.push({
        bookId: main.id,
        bookTitle: main.title,
        manufacturer: main.manufacturer,
        section: source.section,
        docType: source.docType,
        name: rewriteMainChipName(source.name, main.title),
      });
      continue;
    }
    for (const target of group) {
      const book = byId.get(target.bookId)!;
      out.push({
        bookId: book.id,
        bookTitle: book.title,
        manufacturer: book.manufacturer,
        section: target.section,
        docType: target.docType,
        name: target.name,
      });
    }
  }
  return out;
}

export type ImportExistingFile = {
  name: string;
  size: number;
  section: LibrarySection;
  bookId: number | null;
  complete: boolean;
  /** The name the document number is read from when the shelf renamed the file. */
  docName?: string | null;
  mpn?: string | null;
};

/** Lowercased name with one trailing file extension removed. ".0000" is a document suffix, not an extension. */
export function libraryNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\.[a-z]{1,8}$/, "");
}

/** Insert the cleanup marker. A numeric suffix such as ".0000" stays where it is. */
export function withDuplicateMarker(name: string): string {
  if (name.includes("Duplicate To Delete")) return name;
  const ext = /(\.[A-Za-z]{1,8})$/.exec(name);
  if (!ext) return `${name} - Duplicate To Delete`;
  return `${name.slice(0, name.length - ext[1]!.length)} - Duplicate To Delete${ext[1]}`;
}

/**
 * Why this file should not be stored again, or null when it should.
 * Same final name on that book (extension ignored), or — manuals and parts only — the same size and a numbered document
 * anywhere in the family. A last word with no digit ("Guide", "PM", "Manual") is not a document number.
 * `size` is ignored for the name check. Pass the real byte size for the document-number check.
 */
export function importSkipReason(
  incoming: { name: string; size: number; section: LibrarySection; bookId: number },
  books: ImportBook[],
  files: ImportExistingFile[],
): string | null {
  const wantName = libraryNameKey(incoming.name);
  const sameName = files.some(
    (f) => f.complete && f.bookId === incoming.bookId && libraryNameKey(f.name) === wantName,
  );
  if (sameName) return "Already on this book with the same name.";
  if (!copiesToVariations(incoming.section)) return null;
  const book = books.find((b) => b.id === incoming.bookId);
  const wantDoc = docNumber(incoming.name);
  if (!book || !wantDoc || !/\d/.test(wantDoc)) return null;
  const wantKey = wantDoc.toLowerCase();
  const sameDoc = files.some((f) => {
    if (!f.complete || !copiesToVariations(f.section) || f.bookId == null || f.size !== incoming.size) return false;
    const other = books.find((b) => b.id === f.bookId);
    if (!other) return false;
    const same = other.manufacturer.toLowerCase() === book.manufacturer.toLowerCase()
      && nameKey(familyOf(other.title, other.manufacturer)) === nameKey(familyOf(book.title, book.manufacturer));
    if (!same) return false;
    const named = f.docName?.trim() ? f.docName.trim() : f.name;
    const otherDoc = docNumber(named);
    return /\d/.test(otherDoc) && otherDoc.toLowerCase() === wantKey;
  });
  return sameDoc ? "A manual or parts file in this family already has this size and document number." : null;
}

/**
 * A failed download is finished only when the file itself is unusable or the URL is gone.
 * A timeout, a network error, or a 5xx is not finished: the next run tries it again.
 */
export function importFailureSettled(reason: string): boolean {
  if (/will retry/i.test(reason)) return false;
  if (/not a pdf/i.test(reason)) return true;
  if (/larger than 20 mb/i.test(reason)) return true;
  return /\b404\b/.test(reason) || /\b410\b/.test(reason);
}

/** A run may keep downloading only while it is under 150 seconds. At 150000 ms and above, stop. */
export function shouldStartDownload(elapsedMs: number): boolean {
  return elapsedMs < 150_000;
}

export type ImportTwinFile = {
  id: number;
  name: string;
  size: number;
  section: string;
  bookId: number | null;
  fromImport: boolean;
};

export type ImportTwinPair = {
  bookId: number;
  section: string;
  size: number;
  oldId: number;
  oldName: string;
  newId: number;
  newName: string;
};

export type ImportSizeMismatch = {
  bookId: number;
  section: string;
  oldId: number;
  oldName: string;
  oldSize: number;
  newId: number;
  newName: string;
  newSize: number;
};

/**
 * Pairs an import-created file with the older file it repeated.
 * Same book, section, size, and name once the extension is removed. A different size is listed and not treated as a twin.
 */
export function classifyImportDuplicates(files: ImportTwinFile[]): { twins: ImportTwinPair[]; differentSize: ImportSizeMismatch[] } {
  const groups = new Map<string, ImportTwinFile[]>();
  for (const file of files) {
    if (file.bookId == null) continue;
    const key = `${file.bookId}|${file.section}|${libraryNameKey(file.name)}`;
    const group = groups.get(key) ?? [];
    group.push(file);
    groups.set(key, group);
  }
  const twins: ImportTwinPair[] = [];
  const differentSize: ImportSizeMismatch[] = [];
  for (const group of groups.values()) {
    const olds = group.filter((f) => !f.fromImport).sort((a, b) => a.id - b.id);
    const news = group.filter((f) => f.fromImport).sort((a, b) => a.id - b.id);
    if (!olds.length || !news.length) continue;
    const usedOld = new Set<number>();
    const usedNew = new Set<number>();
    for (const created of news) {
      const prior = olds.find((f) => !usedOld.has(f.id) && f.size === created.size);
      if (!prior || prior.bookId == null) continue;
      usedOld.add(prior.id);
      usedNew.add(created.id);
      twins.push({
        bookId: prior.bookId,
        section: prior.section,
        size: prior.size,
        oldId: prior.id,
        oldName: prior.name,
        newId: created.id,
        newName: created.name,
      });
    }
    const leftOld = olds.filter((f) => !usedOld.has(f.id));
    const leftNew = news.filter((f) => !usedNew.has(f.id));
    const count = Math.min(leftOld.length, leftNew.length);
    for (let i = 0; i < count; i += 1) {
      const prior = leftOld[i]!;
      const created = leftNew[i]!;
      if (prior.bookId == null || prior.size === created.size) continue;
      differentSize.push({
        bookId: prior.bookId,
        section: prior.section,
        oldId: prior.id,
        oldName: prior.name,
        oldSize: prior.size,
        newId: created.id,
        newName: created.name,
        newSize: created.size,
      });
    }
  }
  twins.sort((a, b) => a.oldId - b.oldId);
  differentSize.sort((a, b) => a.oldId - b.oldId);
  return { twins, differentSize };
}

