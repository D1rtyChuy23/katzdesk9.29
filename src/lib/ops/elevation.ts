/**
 * Elevation on the Map (Chuy, 11/26). Heights come from the open Terrain Tiles on AWS (Mapzen "terrarium" PNGs, built
 * from SRTM, USGS 3DEP and other public sources), read in the viewer's browser: no key and nothing stored. Each pixel
 * holds a height in meters as red × 256 + green + blue / 256 − 32768. Pure: safe for node --test and the screens.
 */

/** Tiles at this zoom are about 30 m a pixel in Texas: plenty for "how high is this place". */
export const ELEVATION_ZOOM = 13;
const TILE = 256;
const MAX_LAT = 85.0511287798066;

export const ELEVATION_SOURCE = "Elevation: Terrain Tiles on AWS (Mapzen; SRTM, USGS 3DEP and other public data).";

export function terrariumUrl(z: number, x: number, y: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

/** The tile holding a point, and the pixel in it. */
export function elevationPixel(lat: number, lng: number, z = ELEVATION_ZOOM): { z: number; x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const la = (Math.min(MAX_LAT, Math.max(-MAX_LAT, lat)) * Math.PI) / 180;
  const wx = (((lng + 180) / 360) % 1) * n * TILE;
  const wy = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n * TILE;
  const gx = ((wx % (n * TILE)) + n * TILE) % (n * TILE);
  const gy = Math.min(n * TILE - 1, Math.max(0, wy));
  const x = Math.floor(gx / TILE);
  const y = Math.floor(gy / TILE);
  return { z, x, y, px: Math.min(TILE - 1, Math.floor(gx - x * TILE)), py: Math.min(TILE - 1, Math.floor(gy - y * TILE)) };
}

/** A terrarium pixel's height in meters. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export const metersToFeet = (m: number) => m * 3.28084;

/** "About 52 ft (16 m)"; "About sea level" for anything within a few feet of it. */
export function elevationLabel(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "Not available";
  const ft = Math.round(metersToFeet(meters));
  if (Math.abs(ft) < 5) return "About sea level";
  return `About ${ft.toLocaleString("en-US")} ft (${Math.round(meters).toLocaleString("en-US")} m)`;
}
