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

export const MANUAL_TYPES = ["Operating / Installation Manual", "Cleaning Manual", "Programming Manual", "User Manual", "Service And Repair Manual"] as const;
export type ManualType = (typeof MANUAL_TYPES)[number];
export const isManualType = (v: unknown): v is ManualType => MANUAL_TYPES.includes(v as ManualType);
// Parts files are not a manual type: they only go in the Parts drop zone. A manual is never filed as a parts book.

const TYPE_WORDS: [ManualType, RegExp][] = [
  ["Cleaning Manual", /\bclean(ing)?\b|\bsanitiz|\bdescal/],
  ["Programming Manual", /\bprogram(ming)?\b/],
  ["Operating / Installation Manual", /\binstall(ation)?\b|\boperat(ing|ion|ions|or|ors)\b/],
  ["User Manual", /\busers?\b|\bowners?\b/],
  ["Service And Repair Manual", /\bservic(e|ing)\b|\brepairs?\b|\btroubleshoot(ing)?\b/],
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
 * The family a model sits under: its first word, up to the first dash or space.
 * "Axiom-DV-APS" → "Axiom"; "G9-2T HD Stainless" → "G9"; "ITCB-DV" → "ITCB"; "Nitron" → "Nitron".
 */
export function familyOf(title: string, maker: string): string {
  const model = modelLabel(title, maker);
  return model.split(/[\s\-–_]+/).filter(Boolean)[0] ?? model;
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
