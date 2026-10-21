/**
 * Faema X20 and Bravilor Sego 12 in free text ("Faema X20 /Turbosteam", "X20", "Bravilor Sego 12 120V", "Sego12").
 * Each returns null when the piece is not that machine, else the definition model id. Pure: safe for node --test.
 */

const text = (piece: string | null | undefined) => (piece ?? "").trim();

/** Faema X20, or a Faema S20 (same CBM plan). Not the X30 (no runbook). */
export function matchFaemaX20(piece: string | null | undefined): { model: "x20" } | null {
  const t = text(piece);
  if (/\bx[\s-]?20\b/i.test(t)) return { model: "x20" };
  if (/\bfaema\b/i.test(t) && /\bs[\s-]?20\b/i.test(t)) return { model: "x20" };
  return null;
}

/** Bravilor Sego 12. Bare "Sego" counts: Katz has no other Sego. */
export function matchSego12(piece: string | null | undefined): { model: "sego12" } | null {
  return /\bsego(?:[\s-]*12)?\b|\bsego12\b/i.test(text(piece)) ? { model: "sego12" } : null;
}
