/**
 * A map pin an admin enters by hand on Account Details: exact latitude and longitude. Saved on the account's own pin
 * (latitude, longitude) with geocode_match "manual" and the source "Manual (entered by user)". A manual pin is a street
 * pin everywhere (map, directions, address report). Pure: no DOM, no database.
 */
import type { PinQuality } from "./geo.ts";

/** geocode_match for a pin entered by hand. */
export const MANUAL_PIN_MATCH = "manual";
/** Where the pin came from, as Account Details and the activity log say it. */
export const MANUAL_PIN_SOURCE = "Manual (entered by user)";

/** Every Katz account is in the lower 48: a pin outside this box is a typo or swapped numbers. */
const BOX = { latMin: 24, latMax: 50, lngMin: -125, lngMax: -66 };

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Reads what was typed: a latitude and a longitude, or both in the first box ("29.9119, -95.7246", as Google Maps
 * copies them). Refuses anything that isn't a plain decimal number, a point outside the lower 48, and swapped numbers.
 */
export function parsePinInput(latRaw: string, lngRaw: string): { ok: true; lat: number; lng: number } | { ok: false; reason: string } {
  let a = String(latRaw ?? "").trim();
  let b = String(lngRaw ?? "").trim();
  if (a && !b && /[,\s]/.test(a)) {
    const parts = a.split(/\s*,\s*|\s+/).filter(Boolean);
    if (parts.length === 2) [a, b] = parts as [string, string];
  }
  if (!a || !b) return { ok: false, reason: "Enter both the latitude and the longitude." };
  if (!NUMBER.test(a) || !NUMBER.test(b)) return { ok: false, reason: "Use decimal numbers, like 29.911912 and -95.724617." };
  const lat = Number(a);
  const lng = Number(b);
  const inBox = (y: number, x: number) => y >= BOX.latMin && y <= BOX.latMax && x >= BOX.lngMin && x <= BOX.lngMax;
  // Swapped numbers first: "-95.7, 29.9" would otherwise read as a latitude out of range.
  if (!inBox(lat, lng) && inBox(lng, lat)) {
    return { ok: false, reason: "These look swapped: latitude comes first (about 29 to 33 in Texas), then longitude (a negative number)." };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, reason: "Latitude runs from -90 to 90 and longitude from -180 to 180." };
  }
  if (!inBox(lat, lng)) return { ok: false, reason: "That point is outside the continental US. Check the numbers: longitude is negative here." };
  return { ok: true, lat, lng };
}

/** How a saved pin counts on the map: a manual pin is a street pin (exact). Unknown values have no quality. */
export function pinQuality(match: string | null | undefined): PinQuality | null {
  if (match === MANUAL_PIN_MATCH) return "exact";
  return match === "exact" || match === "close" || match === "approx" ? match : null;
}

/** A pin's source in words, for Account Details. */
export function pinSourceLabel(match: string | null | undefined): string {
  if (match === MANUAL_PIN_MATCH) return MANUAL_PIN_SOURCE;
  if (match === "exact") return "Geocoded (exact street match)";
  if (match === "close") return "Geocoded (close match, check it)";
  if (match === "approx") return "ZIP area only (approximate)";
  return "Source not recorded";
}

/** "29.911912, -95.724617": six decimals is about 10 cm. */
export function pinText(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
