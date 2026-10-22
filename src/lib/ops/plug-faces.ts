/**
 * Plug face pictures (public/nema/<code>P.png), cut from the provided NEMA configurations chart. Only codes we have a
 * real picture for get one: no generated art, and a 120 V plug never borrows the L6 twist-lock picture.
 * Pure: the spec sheet's Plug cell and the printed request form both use it.
 */
const NEMA_FACES = new Set([
  "5-15",
  "5-20",
  "6-20",
  "6-30",
  "6-50",
  "14-20",
  "14-30",
  "L5-15",
  "L5-20",
  "L6-20",
  "L6-30",
  "L14-20",
  "L14-30",
]);

export function hasPlugFace(nema: string | null | undefined): boolean {
  return !!nema && NEMA_FACES.has(nema);
}

export function plugImageSrc(nema: string): string {
  return `/nema/${nema}P.png`;
}

/**
 * The NEMA code of a plug as people type it, when we have its picture: "NEMA 5-15P", "5-15", "L6-30R", "l6 20p" and
 * "L620P" all read. Null for hardwire, a bare voltage, or a code with no picture.
 */
export function plugFaceCode(plug: string | null | undefined): string | null {
  const t = String(plug ?? "").toUpperCase();
  if (!t.trim() || /HARD\s*-?\s*WIRE/.test(t)) return null;
  const m = t.match(/\b(L?)(5|6|14|15)\s*-?\s*(15|20|30|50)\s*[PR]?\b/);
  const code = m ? `${m[1]}${m[2]}-${m[3]}` : null;
  return hasPlugFace(code) ? code : null;
}
