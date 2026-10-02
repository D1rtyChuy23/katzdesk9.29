/**
 * The Library — Manuals and Parts Diagrams: file rules. Pure: no DOM, safe for node --test.
 */
export type LibrarySection = "manuals" | "parts";
export const LIBRARY_SECTIONS: LibrarySection[] = ["manuals", "parts"];

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
  return [...files].sort(
    (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true }) || a.name.localeCompare(b.name),
  );
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
