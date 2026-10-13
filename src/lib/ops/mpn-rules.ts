/**
 * Equipment item codes in The Library are keyed by the manufacturer part number (MPN). An official spec sheet,
 * manual or parts book belongs to one MPN, and is tied to it only with a source. Pure — safe for node --test.
 */

export const NO_OFFICIAL_FILE = "No Official File For This MPN";

/** An MPN as typed: trimmed, inner spaces collapsed. Null when blank. Kept as typed otherwise (dots and dashes matter). */
export function cleanMpn(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.slice(0, 60);
}

/** The comparison form: upper case, letters and digits only. "52000.0305" and "52000-0305" are the same MPN. */
export function mpnKey(raw: unknown): string {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export const sameMpn = (a: unknown, b: unknown): boolean => {
  const ka = mpnKey(a);
  return !!ka && ka === mpnKey(b);
};

/** null when the URL can be kept as a source, otherwise a sentence. Only a web page or file address qualifies. */
export function sourceUrlError(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return "Paste the manufacturer's page or file address as the source.";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return "That source is not a web address.";
  }
  if (u.protocol !== "https:") return "The source has to be an https:// address.";
  if (!u.hostname.includes(".")) return "That source is not a web address.";
  return null;
}

export function cleanSourceUrl(raw: unknown): string {
  return new URL(String(raw).trim()).toString();
}

export type TieInput = {
  /** MPN of the variation the file is stored on. */
  bookMpn: string | null;
  /** The variation the file is stored on, and the one it is being tied for. */
  fileBookId: number | null;
  bookId: number;
  /** The MPN the file is already tied to, if any. */
  fileMpn: string | null;
  sourceUrl: string;
};

/**
 * Whether a stored file can be recorded as the official file for its variation's MPN. A file is tied on the
 * variation it sits on, never on a nearby model, and never to a second MPN.
 */
export function tieError(i: TieInput): string | null {
  if (!mpnKey(i.bookMpn)) return "Set this variation's MPN first.";
  if (i.fileBookId == null || i.fileBookId !== i.bookId) return "The file has to be stored on this variation to be tied to its MPN.";
  if (i.fileMpn && !sameMpn(i.fileMpn, i.bookMpn)) return `This file is already tied to MPN ${i.fileMpn}.`;
  return sourceUrlError(i.sourceUrl);
}

export type OfficialState = "no-mpn" | "official" | "flagged" | "pending";

export type OfficialStatus = {
  state: OfficialState;
  label: string;
  /** Sections that have a file tied to this MPN. */
  tied: ("spec" | "manuals" | "parts")[];
};

/**
 * Where a variation stands. "official" means a spec sheet is tied to its MPN. "flagged" means the manufacturer
 * has no file for this exact MPN. Files for a different model are never counted.
 */
export function officialStatus(
  book: { mpn: string | null; noOfficialFile: boolean },
  files: { section: "spec" | "manuals" | "parts"; mpn: string | null }[],
): OfficialStatus {
  if (!mpnKey(book.mpn)) return { state: "no-mpn", label: "No MPN yet", tied: [] };
  const tied = [...new Set(files.filter((f) => sameMpn(f.mpn, book.mpn)).map((f) => f.section))];
  if (tied.includes("spec")) return { state: "official", label: "Official spec sheet tied to this MPN", tied };
  if (book.noOfficialFile) return { state: "flagged", label: NO_OFFICIAL_FILE, tied };
  return { state: "pending", label: "Official file not matched yet", tied };
}

/** Advisory only: does the file name or its source mention the MPN? Official files often do not. */
export function mpnMentioned(mpn: string | null, ...texts: (string | null | undefined)[]): boolean {
  const key = mpnKey(mpn);
  if (!key) return false;
  return texts.some((t) => mpnKey(t).includes(key));
}

// ---- Equipment-code worklist ---------------------------------------------------------------------------

/** A Bunn catalog number: 5 digits, a dot, 4 digits (52000.0305). Used only to suggest, never to decide. */
const BUNN_CATALOG = /(?<![0-9.])(\d{5}\.\d{4})(?![0-9])/;

/**
 * An MPN the item code itself spells out, so it can be offered for confirmation. Null when the code is only a
 * Katz name for the machine (BUNNAXIOMAPS, BBESPRECIOUS22) — those need the manufacturer's number from the
 * manufacturer, not a guess.
 */
export function candidateMpn(itemCode: string, vendor: string | null | undefined): string | null {
  const v = String(vendor ?? "").toLowerCase();
  const code = String(itemCode ?? "");
  if (/bunn/.test(v) || /^bunn/i.test(code)) {
    const m = BUNN_CATALOG.exec(code);
    if (m) return m[1]!;
  }
  return null;
}

export type WorklistStatus = "confirm-mpn" | "needs-mpn";

export const WORKLIST_STATUS_LABEL: Record<WorklistStatus, string> = {
  "confirm-mpn": "MPN suggested from the item code - confirm on the manufacturer page",
  "needs-mpn": "MPN needed - not in the NetSuite export",
};
