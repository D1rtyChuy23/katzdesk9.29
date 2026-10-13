/**
 * The Library: Legacy models and unofficial sources. Pure rules — no database, no DOM, safe for node --test.
 *
 * Legacy holds models their manufacturer lists as discontinued or obsolete. A model is moved there only with the
 * manufacturer source. A model that could not be confirmed either way stays where it is, flagged Confirm Legacy.
 */
import { sourceUrlError } from "./mpn-rules.ts";

export const LEGACY_LABEL = "Legacy";
export const CONFIRM_LEGACY = "Confirm Legacy";

/** null when the model can be moved to Legacy; otherwise the sentence to show. A source is always required. */
export function legacyMoveError(input: { sourceUrl: unknown }): string | null {
  const s = String(input.sourceUrl ?? "").trim();
  if (!s) return "Paste the manufacturer page that lists this model as discontinued or obsolete. A model is not moved to Legacy without a source.";
  return sourceUrlError(s);
}

/** A short note kept with the Legacy move or the Confirm Legacy flag. Blank → null. */
export function cleanLegacyNote(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 600) : null;
}

export type LegacyMark = { legacy: boolean; confirmLegacy: boolean };
export type LegacyState = "current" | "legacy" | "confirm";

export function legacyState(b: LegacyMark): LegacyState {
  if (b.legacy) return "legacy";
  return b.confirmLegacy ? "confirm" : "current";
}

/** Current models stay in the main row; Legacy models sit in their own row. Order inside each is kept. */
export function splitLegacy<T extends { legacy: boolean }>(books: T[]): { current: T[]; legacy: T[] } {
  return { current: books.filter((b) => !b.legacy), legacy: books.filter((b) => b.legacy) };
}

// ---- Unofficial sources --------------------------------------------------------------------------------

export const UNOFFICIAL_LABEL = "Unofficial";
/** Said once on the block, so a field tip is never read as a manufacturer procedure. */
export const UNOFFICIAL_NOTICE =
  "Field notes and outside links. Not the manufacturer's manual and not a manufacturer procedure. The official steps are above, from the files stored on this model.";

export type UnofficialInput = { url?: unknown; note?: unknown };
export type UnofficialClean = { url: string | null; note: string | null };

/** A link has to be a plain web address. Anything else (javascript:, data:, file:) is refused. */
export function unofficialUrlError(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return "That link is not a web address. Start it with https://";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Only a web link (https://) can be added.";
  if (!u.hostname.includes(".")) return "That link is not a web address.";
  return null;
}

/** A link, a note, or both. Returns the cleaned entry or an error sentence. */
export function cleanUnofficial(input: UnofficialInput): UnofficialClean | { error: string } {
  const rawUrl = String(input.url ?? "").trim();
  const note = String(input.note ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!rawUrl && !note) return { error: "Add a link, a note, or both." };
  const bad = unofficialUrlError(rawUrl);
  if (bad) return { error: bad };
  if (note.length > 1500) return { error: "Keep the note under 1,500 characters." };
  return { url: rawUrl ? new URL(rawUrl).toString() : null, note: note || null };
}

/** The site a link points at, for display: "www.example.com". Blank when the link cannot be read. */
export function linkHost(url: string | null | undefined): string {
  try {
    return new URL(String(url)).hostname;
  } catch {
    return "";
  }
}
