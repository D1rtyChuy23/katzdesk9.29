import { PHOTO_BACKGROUND, PHOTO_EDGE, centerOnSquare, flattenBackground, partBox } from "@/lib/ops/part-images";

/**
 * The same treatment for every part photo, wherever it comes from (a researched source or a phone): trim the
 * background border, put the part centered on a white square of one size, turn the leftover near-white
 * background into that same white, save as JPEG. Browser only.
 * Returns base64 without the data: prefix.
 */
export async function treatPartPhoto(blob: Blob): Promise<string> {
  if (blob.type && !blob.type.startsWith("image/")) throw new Error("That is not a photo.");
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) throw new Error("That photo could not be read.");
  // Read the pixels at a working size: big enough for a clean crop, small enough to scan quickly.
  const scan = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const sw = Math.max(1, Math.round(bitmap.width * scan));
  const sh = Math.max(1, Math.round(bitmap.height * scan));
  const work = document.createElement("canvas");
  work.width = sw;
  work.height = sh;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  if (!wctx) throw new Error("This browser cannot prepare photos.");
  wctx.drawImage(bitmap, 0, 0, sw, sh);
  bitmap.close?.();
  const box = partBox(wctx.getImageData(0, 0, sw, sh).data, sw, sh);
  const at = centerOnSquare(box);
  const out = document.createElement("canvas");
  out.width = PHOTO_EDGE;
  out.height = PHOTO_EDGE;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser cannot prepare photos.");
  ctx.fillStyle = PHOTO_BACKGROUND;
  ctx.fillRect(0, 0, PHOTO_EDGE, PHOTO_EDGE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(work, box.x, box.y, box.w, box.h, at.x, at.y, at.w, at.h);
  const pixels = ctx.getImageData(0, 0, PHOTO_EDGE, PHOTO_EDGE);
  if (flattenBackground(pixels.data)) ctx.putImageData(pixels, 0, 0);
  const url = out.toDataURL("image/jpeg", 0.86);
  return url.slice(url.indexOf(",") + 1);
}

/** Fetch one researched photo through the Desk (only that part's researched addresses) and treat it. */
export async function treatResearchedPhoto(partId: number, index: number): Promise<string> {
  const res = await fetch(`/api/part-photo-source/${partId}?i=${index}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Could not get that photo.");
  return treatPartPhoto(await res.blob());
}
