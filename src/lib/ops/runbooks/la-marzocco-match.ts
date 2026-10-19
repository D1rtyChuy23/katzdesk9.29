/**
 * La Marzocco units in free text ("La Marzocco Linea PB 2AV", "LM Linea S 2AV", "Kb90 3av", "La Marz GS3").
 * Each matcher returns null when the piece is not that family, else the definition model id, or null for the
 * model when the text names the family but not the model (the tech picks). Pure: safe for node --test.
 */

type Hit<M extends string> = { model: M | null } | null;

const text = (piece: string | null | undefined) => (piece ?? "").trim();

/** Linea Classic, Linea Classic S, Linea PB (and PB X). Not Linea Mini or Linea Micra (home machines, no PM checklist). */
export function matchLmLinea(piece: string | null | undefined): Hit<"classic" | "classic-s" | "pb"> {
  const t = text(piece);
  if (!/\blinea\b/i.test(t)) return null;
  if (/\blinea\s+(mini|micra)\b/i.test(t)) return null;
  if (/\blinea\s+pb\b/i.test(t)) return { model: "pb" };
  if (/\blinea\s+(classic\s+)?s\b/i.test(t)) return { model: "classic-s" };
  if (/\blinea\s+classic\b/i.test(t)) return { model: "classic" };
  return { model: null };
}

/** Strada S and Strada X. Not the older Strada EP, AV, MP or EE (no PM checklist). "Strada XT" leaves the model to the tech. */
export function matchLmStrada(piece: string | null | undefined): Hit<"s" | "x"> {
  const t = text(piece);
  if (!/\bstrada\b/i.test(t)) return null;
  if (/\bstrada\s+s\b/i.test(t)) return { model: "s" };
  if (/\bstrada\s+x\b/i.test(t)) return { model: "x" };
  if (/\bstrada(?:\s+\d+)?\s*(?:group\s+)?(?:ep|av|mp|ee)\b/i.test(t)) return null;
  return { model: null };
}

export function matchLmKb90(piece: string | null | undefined): Hit<"kb90"> {
  return /\bkb[\s-]?90\b/i.test(text(piece)) ? { model: "kb90" } : null;
}

/** GB5 S, or a plain "GB5" / "GB/5" (original or S: the tech picks). */
export function matchLmGb5(piece: string | null | undefined): Hit<"gb5s" | "gb5"> {
  const t = text(piece);
  if (!/\bgb[\s/-]?5/i.test(t)) return null;
  if (!/\bgb[\s/-]?5(\s?s)?\b/i.test(t)) return null;
  if (/\bgb[\s/-]?5\s?s\b/i.test(t)) return { model: "gb5s" };
  return { model: null };
}

/** GS3 or GS/3, AV or MP when the text says which. */
export function matchLmGs3(piece: string | null | undefined): Hit<"av" | "mp"> {
  const t = text(piece);
  if (!/\bgs[\s/-]?3\b/i.test(t)) return null;
  if (/\bmp\b/i.test(t)) return { model: "mp" };
  if (/\bav\b/i.test(t)) return { model: "av" };
  return { model: null };
}
