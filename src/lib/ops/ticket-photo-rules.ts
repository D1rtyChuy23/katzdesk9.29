/**
 * Photos on installs, service and TLC tickets, and PMs (Chuy, 11/4): "Lets add a section for customers to store the
 * install pictures in the install ticket that will carry under the customer profile. Also allow to store pictures for
 * tickets. Anything outside of installs lives in the ticket only it pertains to." Asked, he picked: service, TLC and PM
 * tickets besides installs; photos shrunk to about 2,000 px; each photo downloadable plus Download all; a photo removed
 * by whoever added it or an Admin.
 * Names (his words): installs "customer name - install - work order #", the others "customer name and work order number".
 * Pure: no server imports, safe for node --test and the screens.
 */

/** The record a photo is on. "job" is a service or TLC ticket. */
export type PhotoKind = "install" | "job" | "pm";

/** The longest side of a stored photo, and of its preview. */
export const PHOTO_MAX_EDGE = 2048;
export const THUMB_MAX_EDGE = 360;
/**
 * A stored photo and its preview, at most. One request carries both, and the site's proxy refuses a request much over
 * the Library's 512 KB pieces (1 MB pieces came back 502), so the two together stay under 512 KB.
 */
export const PHOTO_MAX_BYTES = 480 * 1024;
export const THUMB_MAX_BYTES = 32 * 1024;
/** Photos on one record, at most. */
export const PHOTOS_PER_RECORD = 100;

/** The words the screens and the server share. */
export const PHOTO_REMOVE_CONFIRM = "Remove this photo? It can't be put back.";
export const PHOTO_REMOVE_REFUSED = "Only the person who added a photo, or an Admin, can remove it.";
export const PHOTO_FULL = `This record has ${PHOTOS_PER_RECORD} photos, the most it can hold. Remove one to add another.`;
export const PHOTO_TOO_BIG = "That photo is too large to store. Try it again; the app shrinks each photo before it's sent.";
export const PHOTO_NOT_JPEG = "That photo couldn't be read. Try it again, or take it with the camera.";

/** A record as the names read it: its customer, its work order, and what stands in for a missing work order. */
export type PhotoRecordName = {
  kind: PhotoKind;
  customer: string | null;
  wo: string | null;
  /** In place of a missing WO: the install's "#45", the ticket's call ID, or "PM #12". */
  fallback: string;
};

/** What a file name can't hold on Windows, macOS or a phone: replaced by a dash; spaces run together. */
export function fileSafe(text: string): string {
  const printable = Array.from(String(text ?? ""), (ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("");
  return printable
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

/** The part of a name that says what the record is, before the photo's number. */
export function photoBaseName(r: PhotoRecordName): string {
  const customer = fileSafe(String(r.customer ?? "")) || "Untitled Account";
  const wo = fileSafe(String(r.wo ?? "")) || fileSafe(r.fallback);
  // A long account name is cut so the WO and the number always stay on the end.
  const head = customer.length > 90 ? customer.slice(0, 90).trimEnd() : customer;
  return r.kind === "install" ? `${head} - install - ${wo}` : `${head} - ${wo}`;
}

/** A photo's file name: "Test Cafe - install - WO-1234 (2).jpg", "Test Cafe - WO-5678 (1).jpg". n counts from 1. */
export function photoFileName(r: PhotoRecordName, n: number): string {
  return `${photoBaseName(r)} (${n}).jpg`;
}

/** Download all from a record: "Test Cafe - install - WO-1234.zip". */
export function recordZipName(r: PhotoRecordName): string {
  return `${photoBaseName(r)}.zip`;
}

/** Download all from the account's Photos tab: "Test Cafe - install photos.zip". */
export function accountZipName(customer: string): string {
  return `${fileSafe(customer) || "Untitled Account"} - install photos.zip`;
}

/** Each name once, for a .zip: a name already used gets " [2]", " [3]" … before its extension. */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let out = name;
    for (let i = 2; used.has(out.toLowerCase()); i += 1) out = `${stem} [${i}]${ext}`;
    used.add(out.toLowerCase());
    return out;
  });
}

/** Who may remove a photo: the person who added it, or an Admin. */
export function canRemovePhoto(viewer: { userId: string; admin: boolean }, photo: { addedBy: string }): boolean {
  return viewer.admin || (!!viewer.userId && viewer.userId === photo.addedBy);
}

/** The fit of a photo inside a box, keeping its shape: the size to draw it at, never larger than it is. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** JPEG bytes start with FF D8 FF. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * A photo is fetched by the desk's own pages, or opened straight from an address. Another site can't pull one in
 * (as an image, a script or a fetch), even with the person signed in. The same rule as Parts → Export CSV.
 */
export function photoRequestAllowed(headers: { get(name: string): string | null }, method: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return true;
  return headers.get("sec-fetch-mode") === "navigate" && method === "GET";
}

/** The photo's line under its picture: who added it and when (a date in Chicago time, like the rest of the desk). */
export function photoByline(addedByName: string | null, addedAt: string): string {
  const d = new Date(addedAt);
  const day = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
  return [addedByName?.trim() || "Teammate", day].filter(Boolean).join(" · ");
}
