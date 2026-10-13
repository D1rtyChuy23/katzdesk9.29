/**
 * Shrink a photo in the browser before it is sent, so a phone picture (often 4-8 MB) becomes a few hundred KB.
 * Returns the JPEG as base64 without the data: prefix. Browser only.
 */
export async function resizeImageToBase64(file: File, maxEdge = 1000, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo (JPG, PNG or WebP).");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That photo could not be read.");
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize photos.");
  // A transparent PNG would turn black as a JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const url = canvas.toDataURL("image/jpeg", quality);
  const comma = url.indexOf(",");
  return comma >= 0 ? url.slice(comma + 1) : url;
}
