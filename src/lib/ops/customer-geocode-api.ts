import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { countGeocodes, geoRowsFromMatrix, planGeocodes, type GeoCounts, type GeoPlanLine, type GeoRow } from "@/lib/ops/customer-geocode";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** Locations are loaded by an Admin (the Admin role or a desk admin), same as account numbers. */
async function requireEditor(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can import customer locations.");
}

async function loadAccounts(sql: Sql) {
  const rows = await sql.query<{
    id: number;
    name: string;
    account_number: string | null;
    netsuite_id: string | null;
    latitude: number | null;
    longitude: number | null;
  }>("select id, name, account_number, netsuite_id, latitude, longitude from directory_customers where archived = false order by name_locked desc, id");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    accountNumber: r.account_number,
    netsuiteId: r.netsuite_id,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
  }));
}

export type GeocodePreview = { rows: GeoRow[]; lines: GeoPlanLine[]; counts: GeoCounts };

/** Read the geocoded CSV (or sheet) and show what would happen. Saves nothing. */
export const previewCustomerGeocodes = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string }) => z.object({ filename: z.string().max(300), base64: z.string().min(4) }).parse(d))
  .handler(async ({ data, context }): Promise<GeocodePreview> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    if (data.base64.length > 12_000_000) throw new Error("That file is too large.");
    // Every cell as text: account numbers keep leading zeros and coordinates keep every digit.
    const wb = XLSX.read(data.base64, { type: "base64", raw: true, cellText: true });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("The file is empty.");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
    const rows = geoRowsFromMatrix(matrix);
    if (!rows.length) throw new Error("No rows under the header.");
    if (rows.length > 10_000) throw new Error("Up to 10,000 rows at a time.");
    const lines = planGeocodes(rows, await loadAccounts(sql));
    return { rows, lines, counts: countGeocodes(lines) };
  });

const rowSchema = z.object({
  line: z.number().int(),
  account: z.string().max(100),
  internalId: z.string().max(100),
  name: z.string().max(300),
  address: z.string().max(600),
  result: z.string().max(60),
  matchType: z.string().max(60),
  matchedAddress: z.string().max(600),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

/**
 * Save the locations under Will Save, after planning them again against the accounts as they are now.
 * Only the location columns change; the account's name and address are left as they are.
 */
export const applyCustomerGeocodes = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { rows: GeoRow[] }) => z.object({ rows: z.array(rowSchema).max(10_000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ saved: number; counts: GeoCounts }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const lines = planGeocodes(data.rows, await loadAccounts(sql));
    const save = lines.filter((l) => l.status === "save" && l.accountId !== null && l.latitude !== null && l.longitude !== null);
    if (save.length) {
      await sql.query(
        `update directory_customers d
            set latitude = v.lat, longitude = v.lng, geocode_match = v.quality, geocode_address = nullif(v.matched, ''),
                geocoded_at = now(), updated_at = now()
           from (select unnest($1::int[]) as id, unnest($2::float8[]) as lat, unnest($3::float8[]) as lng,
                        unnest($4::text[]) as quality, unnest($5::text[]) as matched) v
          where d.id = v.id and d.archived = false`,
        [
          save.map((l) => l.accountId),
          save.map((l) => l.latitude),
          save.map((l) => l.longitude),
          save.map((l) => l.quality),
          save.map((l) => l.matchedAddress),
        ],
      );
    }
    return { saved: save.length, counts: countGeocodes(lines) };
  });
