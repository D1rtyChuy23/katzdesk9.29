import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { cleanBounds, parseZipStats, zipsIn, ZIP_LIMIT, ZIP_SOURCE, type ZipStat } from "@/lib/ops/market-map";
import { isPlaceCategory, parsePlaceTile, placesIn, placeTilesFor, PLACES_LIMIT, PLACES_SOURCE, type Place, type PlaceCategory } from "@/lib/ops/places";

/**
 * The Map's market layers (Population and Places) are for Admin and Sales (Chuy, 11/26). The data is public, but the
 * layers are sales tools, so Service and Warehouse don't get them. The owner flag counts as Admin.
 */
export async function canUseMarketLayers(sql: Sql, userId: string): Promise<boolean> {
  const row = (
    await sql.query<{ is_admin: unknown; desk_role: string | null; approved: unknown }>("select is_admin, desk_role, approved from desk_accounts where user_id = $1", [userId])
  )[0];
  if (!row || !flagOn(row.approved)) return false;
  const role = String(row.desk_role ?? "").trim().toLowerCase();
  return flagOn(row.is_admin) || role === "admin" || role === "sales";
}

export const MARKET_REFUSAL = "The Population and Places layers are for Admin and Sales.";

let stats: Promise<ZipStat[]> | null = null;
/** Every ZIP area, read once per server (the file is bundled in; about 34,000 lines). */
function zipStats(): Promise<ZipStat[]> {
  stats ??= import("./census/zip-stats.txt?raw").then((m) => parseZipStats(m.default)).catch((e: unknown) => {
    stats = null;
    throw e;
  });
  return stats;
}

export type ZipStatsResult = { zips: ZipStat[]; truncated: boolean; source: string };

export async function listZipStatsFor(sql: Sql, userId: string, box: unknown, all?: ZipStat[], limit = ZIP_LIMIT): Promise<ZipStatsResult> {
  if (!(await canUseMarketLayers(sql, userId))) throw new Error(MARKET_REFUSAL);
  const b = cleanBounds(box as Parameters<typeof cleanBounds>[0]);
  if (!b) throw new Error("That part of the map could not be read.");
  const { zips, truncated } = zipsIn(all ?? (await zipStats()), b, Math.max(1, Math.min(ZIP_LIMIT, Math.floor(limit))));
  return { zips, truncated, source: ZIP_SOURCE };
}

const boundsInput = z.object({ south: z.number(), west: z.number(), north: z.number(), east: z.number(), limit: z.number().int().min(1).max(ZIP_LIMIT).optional() });

/** ZIP areas in the box on screen, most people first (Admin and Sales). */
export const listZipStats = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(boundsInput)
  .handler(async ({ data, context }): Promise<ZipStatsResult> => listZipStatsFor(await getSql(), context.userId, data, undefined, data.limit));

// ---------------------------------------------------------------------------------------------------------------------
// Prospects

/**
 * Each 1° square's file, bundled as its own chunk and read only when asked for. Inside a function: Vite fills in the
 * glob when it builds, and node --test (which loads this file without Vite) never calls it.
 */
let placeFiles: Record<string, () => Promise<string>> | null = null;
function placeFileLoaders(): Record<string, () => Promise<string>> {
  placeFiles ??= import.meta.glob("./places-tiles/*.tsv", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;
  return placeFiles;
}
const placeTiles = new Map<string, Promise<Place[]>>();
/** Squares kept parsed per server, the most recently used: about the busiest metro areas, a few dozen MB. */
const PLACE_TILES_KEPT = 16;

/** One square's places, read once and kept while it is in use; a square with no file (outside Texas) is empty. */
function placeTile(key: string): Promise<Place[]> {
  const hit = placeTiles.get(key);
  if (hit) {
    placeTiles.delete(key);
    placeTiles.set(key, hit);
    return hit;
  }
  const load = placeFileLoaders()[`./places-tiles/${key}.tsv`];
  const p = load ? load().then(parsePlaceTile) : Promise.resolve([]);
  p.catch(() => placeTiles.delete(key));
  placeTiles.set(key, p);
  while (placeTiles.size > PLACE_TILES_KEPT) placeTiles.delete(placeTiles.keys().next().value!);
  return p;
}

export type PlacesResult = { places: Place[]; total: number; truncated: boolean; source: string };

/** `tile` reads one square's places (the bundled files by default; tests pass their own). */
export async function listPlacesFor(
  sql: Sql,
  userId: string,
  input: { south: number; west: number; north: number; east: number; categories: readonly string[]; limit?: number; q?: string },
  tile: (key: string) => Promise<Place[]> = placeTile,
): Promise<PlacesResult> {
  if (!(await canUseMarketLayers(sql, userId))) throw new Error(MARKET_REFUSAL);
  const b = cleanBounds(input);
  if (!b) throw new Error("That part of the map could not be read.");
  const categories = input.categories.filter(isPlaceCategory) as PlaceCategory[];
  if (!categories.length) return { places: [], total: 0, truncated: false, source: PLACES_SOURCE };
  const { keys, capped } = placeTilesFor(b);
  const all = (await Promise.all(keys.map(tile))).flat();
  const limit = Math.max(1, Math.min(PLACES_LIMIT, Math.floor(input.limit ?? PLACES_LIMIT)));
  const { places, total } = placesIn(all, b, categories, limit, input.q ?? "");
  return { places, total, truncated: capped || total > places.length, source: PLACES_SOURCE };
}

const placesInput = z.object({
  south: z.number(),
  west: z.number(),
  north: z.number(),
  east: z.number(),
  categories: z.array(z.string().max(20)).max(20),
  limit: z.number().int().min(1).max(PLACES_LIMIT).optional(),
  q: z.string().max(100).optional(),
});

/** Prospect places of the picked types in the box on screen, the surest first (Admin and Sales). */
export const listPlaces = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(placesInput)
  .handler(async ({ data, context }): Promise<PlacesResult> => listPlacesFor(await getSql(), context.userId, data));
