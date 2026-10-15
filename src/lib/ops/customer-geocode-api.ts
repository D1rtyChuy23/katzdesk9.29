import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  BLANK_ADDRESS_PATTERN,
  countGeocodes,
  geoRowsFromMatrix,
  planGeocodes,
  type GeoCounts,
  type GeoPlanLine,
  type GeoQuality,
  type GeoRow,
} from "@/lib/ops/customer-geocode";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** Locations are loaded by an Admin (the Admin role or a desk admin), same as account numbers. */
async function requireEditor(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can import customer locations.");
}

const savedQuality = (v: string | null): GeoQuality | null => (v === "exact" || v === "close" || v === "approx" ? v : null);

async function loadAccounts(sql: Sql) {
  const rows = await sql.query<{
    id: number;
    name: string;
    account_number: string | null;
    netsuite_id: string | null;
    latitude: number | null;
    longitude: number | null;
    geocode_match: string | null;
    address: string | null;
  }>(
    "select id, name, account_number, netsuite_id, latitude, longitude, geocode_match, address from directory_customers where archived = false order by name_locked desc, id",
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    accountNumber: r.account_number,
    netsuiteId: r.netsuite_id,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
    quality: savedQuality(r.geocode_match),
    address: r.address,
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
  // A preview read before this field existed never fills an address.
  addressFillable: z.boolean().default(false),
  result: z.string().max(60),
  matchType: z.string().max(60),
  matchedAddress: z.string().max(600),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

/** The name on activity rows, resolved the same way as everywhere else on the desk (username, else "Teammate"). */
async function actorName(sql: Sql, userId: string): Promise<string> {
  return (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

/**
 * Save the locations under Will Save, after planning them again against the accounts as they are now. Only the
 * location columns change, and the account's name never does. With `fillAddresses`, an account whose typed address is
 * blank also gets the address from its row (never over one that is set, checked again in the statement itself), with
 * one activity entry each. Locations, addresses and activity are written in one statement.
 */
export const applyCustomerGeocodes = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { rows: GeoRow[]; fillAddresses?: boolean }) =>
    z.object({ rows: z.array(rowSchema).max(10_000), fillAddresses: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ saved: number; filled: number; counts: GeoCounts }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const lines = planGeocodes(data.rows, await loadAccounts(sql));
    const save = lines.filter((l) => l.status === "save" && l.accountId !== null && l.latitude !== null && l.longitude !== null);
    const fill = data.fillAddresses ? lines.filter((l) => l.fillsAddress && l.accountId !== null) : [];
    if (!save.length && !fill.length) return { saved: 0, filled: 0, counts: countGeocodes(lines) };
    const who = fill.length ? await actorName(sql, context.userId) : "";
    // One UPDATE per account, even when it gets both a pin and an address: Postgres applies only one of two updates
    // of the same row in one statement, so the pin and address rows are joined first. `cur` locks the accounts and
    // records whether each address is blank right now (blank as the planner means it, $9), so an address typed since the
    // preview is never replaced.
    const res = await sql.query<{ saved: number; filled: number }>(
      `with v as (
         select coalesce(p.id, a.id) as id, p.id is not null as has_pin, p.lat, p.lng, p.quality, p.matched, a.address
           from (select unnest($1::int[]) as id, unnest($2::float8[]) as lat, unnest($3::float8[]) as lng,
                        unnest($4::text[]) as quality, unnest($5::text[]) as matched) p
           full join (select unnest($6::int[]) as id, unnest($7::text[]) as address) a on a.id = p.id
       ), cur as (
         select d.id, coalesce(d.address, '') ~ $9::text as blank
           from directory_customers d join v on v.id = d.id
          where d.archived = false
          for update of d
       ), upd as (
         update directory_customers d
            set latitude = case when v.has_pin then v.lat else d.latitude end,
                longitude = case when v.has_pin then v.lng else d.longitude end,
                geocode_match = case when v.has_pin then v.quality else d.geocode_match end,
                geocode_address = case when v.has_pin then nullif(v.matched, '') else d.geocode_address end,
                geocoded_at = case when v.has_pin then now() else d.geocoded_at end,
                address = case when v.address is not null and cur.blank then v.address else d.address end,
                updated_at = now()
           from v join cur on cur.id = v.id
          where d.id = v.id and (v.has_pin or (v.address is not null and cur.blank))
         returning d.id, v.has_pin, (v.address is not null and cur.blank) as filled, v.address
       ), act as (
         insert into activity (entity_type, entity_id, actor_name, action, detail)
         select 'customer', upd.id, $8::text, 'updated', 'Address filled from the Locations import: "' || upd.address || '"'
           from upd where upd.filled
         returning id
       )
       select (select count(*) from upd where has_pin)::int as saved, (select count(*) from upd where filled)::int as filled`,
      [
        save.map((l) => l.accountId),
        save.map((l) => l.latitude),
        save.map((l) => l.longitude),
        save.map((l) => l.quality),
        save.map((l) => l.matchedAddress),
        fill.map((l) => l.accountId),
        fill.map((l) => l.address.trim()),
        who,
        BLANK_ADDRESS_PATTERN,
      ],
    );
    return { saved: Number(res[0]?.saved ?? 0), filled: Number(res[0]?.filled ?? 0), counts: countGeocodes(lines) };
  });
