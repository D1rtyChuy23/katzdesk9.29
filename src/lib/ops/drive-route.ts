/**
 * Live driving times from OSRM (OpenStreetMap). Nothing here is written to the database:
 * the planner asks for a route, uses the answer, and drops it. If the service fails, the
 * planner keeps the straight-line order.
 */
import type { LatLng } from "./geo.ts";

export type DrivePoint = { lat: number; lng: number };

const MILES = 1609.344;

export function pointKey(p: LatLng): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

export function pairKey(from: LatLng | null, to: LatLng): string {
  return `${from ? pointKey(from) : "start"}>${pointKey(to)}`;
}

/** OSRM table: durations in seconds, distances in meters, same order as `points`. */
export function parseOsrmTable(body: unknown, n: number): { seconds: number[][]; meters: number[][] } | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { code?: string; durations?: unknown; distances?: unknown };
  if (row.code && row.code !== "Ok") return null;
  const seconds = matrix(row.durations, n);
  const meters = matrix(row.distances, n);
  if (!seconds || !meters) return null;
  return { seconds, meters };
}

function matrix(raw: unknown, n: number): number[][] | null {
  if (!Array.isArray(raw) || raw.length !== n) return null;
  const out: number[][] = [];
  for (const line of raw) {
    if (!Array.isArray(line) || line.length !== n) return null;
    const nums = line.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN));
    if (nums.some((v) => Number.isNaN(v))) return null;
    out.push(nums);
  }
  return out;
}

/** OSRM route geometry (GeoJSON [lng, lat]) as map points. */
export function parseOsrmRoute(body: unknown): LatLng[] | null {
  if (!body || typeof body !== "object") return null;
  const routes = (body as { routes?: { geometry?: { coordinates?: unknown } }[] }).routes;
  const coords = routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;
  const out: LatLng[] = [];
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) continue;
    const lng = Number(c[0]);
    const lat = Number(c[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
  }
  return out.length >= 2 ? out : null;
}

export type DriveLeg = { minutes: number; miles: number };

/** Pair lookup from one OSRM table. `points[0]` may be the start. */
export function legsFromTable(points: readonly LatLng[], table: { seconds: number[][]; meters: number[][] }): Map<string, DriveLeg> {
  const legs = new Map<string, DriveLeg>();
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const from = points[i]!;
      const to = points[j]!;
      legs.set(pairKey(from, to), { minutes: table.seconds[i]![j]! / 60, miles: table.meters[i]![j]! / MILES });
    }
  }
  return legs;
}

export function driveBetween(legs: ReadonlyMap<string, DriveLeg>, from: LatLng | null, to: LatLng): DriveLeg | null {
  if (!from) return null;
  return legs.get(pairKey(from, to)) ?? null;
}

/** Includes each stop, so a table from another day is not reused when the tech and status match. */
export function driveTableStamp(
  groups: readonly { tech: string; points: readonly LatLng[] }[],
  states: readonly ("ok" | "err" | "wait")[],
): string {
  return groups
    .map((g, i) => `${g.tech}:${g.points.map((p) => pointKey(p)).join(",")}:${states[i] ?? "wait"}`)
    .join("|");
}
