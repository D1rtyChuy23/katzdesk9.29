/**
 * The Library — choosing the equipment photo from a spec sheet PDF. Pure: no DOM, safe for node --test.
 *
 * A sheet's first pages hold a machine photo plus a lot of things that are NOT the machine:
 * warning/caution triangles, logos, barcodes, certification marks and dimension drawings.
 * "Largest image wins" picked the warning triangle, so every image is classified first:
 *   icon     – symbols, logos, barcodes, small or flat one/two-colour art  → never used
 *   diagram  – line art on white paper (dimension drawing)                 → secondary image only
 *   photo    – many tones and shading (the real machine)                   → primary image
 * If no photo qualifies the primary stays empty; a wrong picture is worse than none.
 */

export type ImageKind = "icon" | "diagram" | "photo";

export type PixelStats = {
  /** Near-white share. */
  white: number;
  /** Near-black share (lum < 60). */
  dark: number;
  /** Mid-tone share (lum 40–215). */
  mid: number;
  /** Visibly coloured share (channel spread > 40). */
  colorful: number;
  /** Saturated yellow / orange / red share — the colours of warning signs. */
  warning: number;
  /** Distinct colours after quantising to 4 bits per channel. */
  bins: number;
  /** Share of pixels covered by the three most common colours. */
  top3: number;
  /** Brightness levels (of 32) that each hold at least 0.3% of the pixels — tonal range. */
  tones: number;
};

/** Smallest side, in pixels, an image needs to be a candidate at all. */
export const MIN_SIDE = 150;

/** Stats from RGBA pixels (any size; the caller downsamples to ~96×96). */
export function pixelStats(pixels: Uint8ClampedArray | Uint8Array | number[]): PixelStats {
  const n = Math.floor(pixels.length / 4);
  if (!n) return { white: 0, dark: 0, mid: 0, colorful: 0, warning: 0, bins: 0, top3: 0, tones: 0 };
  const levels = new Array<number>(32).fill(0);
  const counts = new Map<number, number>();
  let white = 0;
  let dark = 0;
  let mid = 0;
  let colorful = 0;
  let warning = 0;
  for (let i = 0; i < n * 4; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (r > 235 && g > 235 && b > 235) white++;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    levels[Math.min(31, Math.floor(lum / 8))]!++;
    if (lum < 60) dark++;
    if (lum > 40 && lum < 215) mid++;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colorful++;
    // Safety yellow / orange / red: strong red channel, little blue, clearly saturated.
    if (r > 170 && b < 110 && r - b > 90 && (g > 120 || g < 90)) warning++;
  }
  const top = [...counts.values()].sort((a, b) => b - a);
  const top3 = ((top[0] ?? 0) + (top[1] ?? 0) + (top[2] ?? 0)) / n;
  const tones = levels.filter((c) => c / n >= 0.003).length;
  return { white: white / n, dark: dark / n, mid: mid / n, colorful: colorful / n, warning: warning / n, bins: counts.size, top3, tones };
}

/** Classify one embedded image from its pixel size and stats. */
export function classifyImage(width: number, height: number, s: PixelStats): ImageKind {
  if (!width || !height) return "icon";
  if (Math.min(width, height) < MIN_SIDE) return "icon"; // icons, bullets, small logos
  const ratio = width / height;
  if (ratio > 4 || ratio < 0.25) return "icon"; // banners, rules, strips

  // Warning / caution signs: a big block of safety yellow, orange or red with few other tones.
  if (s.warning >= 0.18 && s.bins < 90) return "icon";

  // Flat art: a handful of colours cover almost everything (logos, barcodes, symbols, line drawings).
  const flat = s.top3 >= 0.9 || s.bins <= 14;
  // Line art on paper: mostly white, thin dark strokes, no colour, almost no mid-tones.
  // (Thin strokes: little solid black. A black machine on white has far more dark area than a drawing.)
  const lineArt = s.white >= 0.75 && s.dark <= 0.08 && s.colorful < 0.05 && s.mid < 0.15;
  if (lineArt) return Math.min(width, height) >= 250 ? "diagram" : "icon";
  if (flat) return "icon";

  // A photo has real tonal range: shading, reflections, many colours — even a black machine on white.
  if (s.bins >= 24 || s.tones >= 12) return "photo";
  return "icon";
}

export type ImageCandidate = {
  id: string;
  /** 1-based page number. */
  page: number;
  width: number;
  height: number;
  kind: ImageKind;
  /** How many pages this same image is painted on (logos and footers repeat). */
  pages: number;
  /** Centre on the page, in page points (origin bottom-left), when known. */
  cx?: number;
  cy?: number;
};

export type TitleAnchor = { page: number; x: number; y: number };

export type ImagePick = {
  primary: ImageCandidate | null;
  diagram: ImageCandidate | null;
  /** Why each rejected candidate was skipped — shown when nothing qualified. */
  rejected: { id: string; reason: string }[];
};

/**
 * Primary = the largest photo that doesn't repeat across pages; when two are close in size,
 * the one nearest the model name / title. Diagram = the largest line drawing. Either can be null.
 */
export function pickImages(candidates: ImageCandidate[], title?: TitleAnchor | null): ImagePick {
  const rejected: { id: string; reason: string }[] = [];
  const usable: ImageCandidate[] = [];
  for (const c of candidates) {
    if (c.pages >= 2) rejected.push({ id: c.id, reason: "repeats across pages (logo or footer)" });
    else if (c.kind === "icon") rejected.push({ id: c.id, reason: "icon, symbol, logo or barcode" });
    else usable.push(c);
  }
  const area = (c: ImageCandidate) => c.width * c.height;
  const photos = usable.filter((c) => c.kind === "photo").sort((a, b) => area(b) - area(a) || a.page - b.page);
  const diagrams = usable.filter((c) => c.kind === "diagram").sort((a, b) => area(b) - area(a) || a.page - b.page);

  let primary: ImageCandidate | null = photos[0] ?? null;
  if (primary && title) {
    // Several photos of similar size: take the one nearest the title.
    const close = photos.filter((p) => area(p) >= area(primary!) * 0.6);
    if (close.length > 1) {
      const dist = (p: ImageCandidate) => {
        const pagePenalty = Math.abs(p.page - title.page) * 2000;
        if (p.cx == null || p.cy == null) return pagePenalty + 1500;
        return pagePenalty + Math.hypot(p.cx - title.x, p.cy - title.y);
      };
      primary = [...close].sort((a, b) => dist(a) - dist(b))[0] ?? primary;
    }
  }
  for (const d of diagrams) rejected.push({ id: d.id, reason: "line drawing (dimension diagram), not a photo" });
  return { primary, diagram: diagrams[0] ?? null, rejected };
}
