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
