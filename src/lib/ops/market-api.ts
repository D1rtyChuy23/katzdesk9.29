import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { cleanBounds, parseZipStats, zipsIn, ZIP_LIMIT, ZIP_SOURCE, type ZipStat } from "@/lib/ops/market-map";

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

export async function listZipStatsFor(sql: Sql, userId: string, box: unknown, all?: ZipStat[]): Promise<ZipStatsResult> {
  if (!(await canUseMarketLayers(sql, userId))) throw new Error(MARKET_REFUSAL);
  const b = cleanBounds(box as Parameters<typeof cleanBounds>[0]);
  if (!b) throw new Error("That part of the map could not be read.");
  const { zips, truncated } = zipsIn(all ?? (await zipStats()), b, ZIP_LIMIT);
  return { zips, truncated, source: ZIP_SOURCE };
}

const boundsInput = z.object({ south: z.number(), west: z.number(), north: z.number(), east: z.number() });

/** ZIP areas in the box on screen, most people first (Admin and Sales). */
export const listZipStats = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(boundsInput)
  .handler(async ({ data, context }): Promise<ZipStatsResult> => listZipStatsFor(await getSql(), context.userId, data));
