/**
 * The Library — Manuals and Parts Diagrams: file rules. Pure: no DOM, safe for node --test.
 */
export type LibrarySection = "spec" | "manuals" | "parts";
export const LIBRARY_SECTIONS: LibrarySection[] = ["spec", "manuals", "parts"];

/** Biggest single file. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Files travel in pieces this size so each request stays small. */
export const CHUNK_BYTES = 1024 * 1024;

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

/** Ways a book can be named in a file name: "Bunn Axiom" and plain "Axiom" are the same book. */
export function bookKeys(title: string): string[][] {
  const t = tokens(title);
  const keys: string[][] = [];
  for (let i = 0; i < t.length; i++) {
    const rest = t.slice(i);
    if (rest.join("").length >= 4) keys.push(rest);
  }
  return keys;
}

function keyLength(text: string, key: string[]): number {
  // Tokens may be joined or split by spaces, dashes, underscores ("CBS-1252", "cbs 1252", "CBS1252").
  const re = new RegExp(`(^|[^a-z])${key.map(escapeRe).join("[^a-z0-9]*")}($|[^a-z])`, "i");
  return re.test(text.toLowerCase()) ? key.join("").length : 0;
}

export type BookRef = { id: number; title: string };

/**
 * Which book a file name (or maker + model) belongs to. Returns the book only when exactly one
 * fits best; otherwise null — the person picks. Never guesses.
 */
export function matchBook(text: string, books: BookRef[]): BookRef | null {
  let best = 0;
  let hits: BookRef[] = [];
  for (const b of books) {
    const score = Math.max(0, ...bookKeys(b.title).map((k) => keyLength(text, k)));
    if (!score) continue;
    if (score > best) {
      best = score;
      hits = [b];
    } else if (score === best) hits.push(b);
  }
  return hits.length === 1 ? hits[0]! : null;
}

/** "Bunn Axiom - Manual.pdf"; a second one becomes "Bunn Axiom - Manual 2.pdf". */
export function shelfFileName(bookTitle: string, section: LibrarySection, originalName: string, taken: string[]): string {
  const ext = fileExt(originalName);
  const base = `${clean(bookTitle)} - ${SHELF[section].type}`;
  const used = new Set(taken.map((n) => n.toLowerCase()));
  for (let n = 1; ; n++) {
    const name = `${n === 1 ? base : `${base} ${n}`}${ext ? `.${ext}` : ""}`;
    if (!used.has(name.toLowerCase())) return name;
  }
}
