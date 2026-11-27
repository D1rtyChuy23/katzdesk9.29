import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { isWalkIn } from "@/lib/ops/customer-key";
import { placeTile } from "@/lib/ops/market-api";
import { ELSEWHERE_MILES, indexByWord, lookupWord, webCheck, type WebCheck, type WebCheckRow, type WebStatus } from "@/lib/ops/account-web";
import { placeTileKey, PLACES_SOURCE, type Place } from "@/lib/ops/places";
import { milesBetween } from "@/lib/ops/geo";

/**
 * Web Check on the server (Chuy, 11/27): every account against the bundled business listings. Reads only; nothing on
 * an account changes here (an address is changed through the Address Report's Approve, by an editor).
 */

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

type AccountRow = { id: number; name: string; address: string | null; latitude: unknown; longitude: unknown; geocode_match: string | null };

const num = (v: unknown) => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The 1° squares within reach of a point: its own and the eight around it (25 miles is well under a square). */
function squaresAround(lat: number, lng: number): string[] {
  const out: string[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(placeTileKey(lat + dy, lng + dx));
  return out;
}

/** `tile` reads one square's listings (the bundled files by default; tests pass their own). */
export async function webChecksFor(
  accounts: readonly { id: number; name: string; address: string | null; lat: number | null; lng: number | null; approx: boolean }[],
  tile: (key: string) => Promise<Place[]> = placeTile,
): Promise<WebCheckRow[]> {
  const keys = new Set<string>();
  for (const a of accounts) if (a.lat != null && a.lng != null) for (const k of squaresAround(a.lat, a.lng)) keys.add(k);
  // Read square by square (each is parsed once and cached by the loader), then index all of them by name word.
  const places: Place[] = [];
  for (const k of keys) places.push(...(await tile(k)));
  const byWord = indexByWord(places);
  return accounts.map((a) => {
    const word = lookupWord(a.name);
    const near =
      a.lat == null || a.lng == null || !word
        ? []
        : (byWord.get(word) ?? []).filter((p) => milesBetween({ lat: a.lat!, lng: a.lng! }, p) <= ELSEWHERE_MILES);
    return { id: a.id, name: a.name, address: a.address, approx: a.approx, check: webCheck(a, near) };
  });
}

async function loadAccounts(sql: Sql, id?: number) {
  const rows = await sql.query<AccountRow & { archived?: unknown }>(
    `select id, name, address, latitude, longitude, geocode_match from directory_customers
      where archived = false ${id != null ? "and id = $1::int" : ""}
      order by id`,
    id != null ? [id] : [],
  );
  return rows
    .filter((r) => !isWalkIn(r.name))
    .map((r) => {
      const lat = num(r.latitude);
      const lng = num(r.longitude);
      return { id: Number(r.id), name: r.name, address: r.address, lat, lng, approx: r.geocode_match === "approx" };
    });
}

export type WebCheckReport = {
  rows: WebCheckRow[];
  counts: Record<WebStatus, number>;
  source: string;
  /** May approve a listed address (an Admin, as on the rest of the Address Report). */
  canEdit: boolean;
};

export async function listWebChecksFor(sql: Sql, tile?: (key: string) => Promise<Place[]>): Promise<WebCheckReport> {
  const rows = await webChecksFor(await loadAccounts(sql), tile);
  const counts: Record<WebStatus, number> = { same: 0, different: 0, closed: 0, elsewhere: 0, none: 0, nopin: 0 };
  for (const r of rows) counts[r.check.status] += 1;
  return { rows, counts, source: PLACES_SOURCE, canEdit: false };
}

export async function webCheckForAccount(sql: Sql, accountId: number, tile?: (key: string) => Promise<Place[]>): Promise<WebCheck | null> {
  const [a] = await loadAccounts(sql, accountId);
  if (!a) return null;
  return (await webChecksFor([a], tile))[0]!.check;
}

/** Every account's Web Check (the Address Report's Web Check tab). Any approved desk user can look. */
export const listWebChecks = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<WebCheckReport> => {
    const sql = await ready();
    return { ...(await listWebChecksFor(sql)), canEdit: await canReviewNames(sql, context.userId) };
  });

/** One account's Web Check and its web listing (the account cards). */
export const getAccountWebCheck = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(z.object({ accountId: z.number().int().positive() }))
  .handler(async ({ data }): Promise<WebCheck | null> => webCheckForAccount(await ready(), data.accountId));

/** Kept for the Address Report's Approve: the address a web listing offers for this account, if any. */
export async function webListingAddress(sql: Sql, accountId: number, tile?: (key: string) => Promise<Place[]>): Promise<string | null> {
  const c = await webCheckForAccount(sql, accountId, tile);
  return c && (c.status === "different" || c.status === "elsewhere") ? c.listedAddress : null;
}

