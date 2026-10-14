/** Part photos: what is accepted and how an empty slot is labeled. Pure — no DOM, safe for node --test. */

/** Biggest stored photo. The browser resizes before sending, so real photos are far smaller. */
export const MAX_PART_IMAGE_BYTES = 700 * 1024;

export type PartImageMime = "image/jpeg" | "image/png" | "image/webp";

/** The image type from the first bytes, or null. The file name and the browser's claim are not trusted. */
export function sniffImage(bytes: Uint8Array): PartImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** null when the bytes are a storable photo, otherwise a sentence for the person. */
export function partImageError(bytes: Uint8Array): string | null {
  if (!bytes.length) return "That file is empty.";
  if (bytes.length > MAX_PART_IMAGE_BYTES) return "That photo is too large. Try a smaller one.";
  if (!sniffImage(bytes)) return "Only JPG, PNG or WebP photos can be added.";
  return null;
}

/**
 * Text for the blank slot when a part has no photo. The slot is labeled with the part's MPN; when the MPN is not
 * recorded it says so instead of showing the SKU as if it were the MPN.
 */
export function slotLabel(part: { mpn?: string | null; sku?: string | null }): { main: string; sub: string | null } {
  const mpn = (part.mpn ?? "").trim();
  if (mpn) return { main: mpn, sub: "No photo yet" };
  const sku = (part.sku ?? "").trim();
  return { main: "MPN not set", sub: sku ? `SKU ${sku}` : null };
}

/** Where a part's photo is served from. The version changes when the photo does, so a replaced photo is not stale. */
export function partImageUrl(id: number, version: string | number | null | undefined): string {
  return `/api/part-image/${id}${version ? `?v=${encodeURIComponent(String(version))}` : ""}`;
}

// ---- The one photo treatment every part photo gets ------------------------------------------------------

/**
 * Every part photo: this size, square, the part centered on this light background, with this much margin.
 * White, because supplier photos are shot on white: the source background and the square then read as one.
 */
export const PHOTO_EDGE = 800;
export const PHOTO_BACKGROUND = "#ffffff";
export const PHOTO_MARGIN = 0.08;

/** A pixel that reads as background: near-white (or transparent). */
const isBackground = (r: number, g: number, b: number, a: number) => a < 16 || (r > 236 && g > 236 && b > 236);

/**
 * The box around the part in an RGBA pixel array: rows and columns that are not background. A photo with no
 * background border keeps its whole frame. Pure, so the crop is the same on every device.
 */
export function partBox(data: Uint8ClampedArray | number[], width: number, height: number): { x: number; y: number; w: number; h: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isBackground(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Where the cropped part sits on the square: scaled to fit inside the margin, centered both ways. */
export function centerOnSquare(box: { w: number; h: number }, edge = PHOTO_EDGE, margin = PHOTO_MARGIN): { x: number; y: number; w: number; h: number } {
  const room = edge * (1 - 2 * margin);
  const scale = Math.min(room / box.w, room / box.h);
  const w = Math.round(box.w * scale);
  const h = Math.round(box.h * scale);
  return { x: Math.round((edge - w) / 2), y: Math.round((edge - h) / 2), w, h };
}

/**
 * Near-white and see-through pixels become the one background white, so an off-white or faintly gray supplier
 * background does not show as a box on the square. Changes the array in place; returns how many pixels changed.
 */
export function flattenBackground(data: Uint8ClampedArray | number[]): number {
  let changed = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (!isBackground(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) continue;
    if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255 && data[i + 3] === 255) continue;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
    changed++;
  }
  return changed;
}
