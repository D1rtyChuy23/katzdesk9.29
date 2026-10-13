/**
 * Parts inventory: the NetSuite item list with its photo and MPN. The invoice picker reads the same photo.
 * Anyone with Desk access can add or replace a photo; only Admin and Sales change an MPN.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { cleanMpn } from "@/lib/ops/mpn-rules";
import { partImageError, sniffImage, MAX_PART_IMAGE_BYTES } from "@/lib/ops/part-images";
import type { ChargeKind } from "@/lib/ops/charges";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function canEditMpn(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null }>("select is_admin, desk_role from desk_accounts where user_id = $1", [userId]);
  return flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "sales";
}

export type PartRow = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mpn: string | null;
  rate: number | null;
  kind: ChargeKind;
  hasImage: boolean;
  /** Changes when the photo does; part of the photo's address so a replaced photo is not stale. */
  imageVersion: string | null;
};

type Raw = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mfr_part: string | null;
  rate: string | null;
  kind: ChargeKind;
  has_image: boolean;
  image_version: string | null;
};

const COLS = `id, sku, item, description, mfr_part, rate, kind,
  (image is not null) as has_image,
  case when image is null then null else extract(epoch from image_updated_at)::bigint::text end as image_version`;

const toRow = (r: Raw): PartRow => ({
  id: Number(r.id),
  sku: r.sku,
  item: r.item,
  description: r.description,
  mpn: r.mfr_part,
  rate: r.rate == null ? null : Number(r.rate),
  kind: r.kind,
  hasImage: !!r.has_image,
  imageVersion: r.image_version,
});

export type PartsPage = { rows: PartRow[]; total: number; withPhoto: number; canEditMpn: boolean };

export const listParts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { q?: string; noPhoto?: boolean; offset?: number }) =>
    z.object({ q: z.string().max(120).optional(), noPhoto: z.boolean().optional(), offset: z.number().int().min(0).max(100000).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PartsPage> => {
    const sql = await ready();
    const q = (data.q ?? "").trim();
    const like = `%${q}%`;
    // Trip and labor are services, not parts: no photo, no MPN.
    const where = `active and kind not in ('trip', 'labor')
      and ($1 = '' or item ilike $2 or sku ilike $2 or description ilike $2 or mfr_part ilike $2)
      and (not $3 or image is null)`;
    const args = [q, like, !!data.noPhoto];
    const rows = await sql.query<Raw>(
      `select ${COLS} from billing_items where ${where} order by (image is null), lower(sku) limit 50 offset ${Number(data.offset ?? 0)}`,
      args,
    );
    const counts = (await sql.query<{ total: number; with_photo: number }>(
      `select count(*)::int as total, count(*) filter (where image is not null)::int as with_photo from billing_items where ${where}`,
      args,
    ))[0];
    return { rows: rows.map(toRow), total: counts?.total ?? 0, withPhoto: counts?.with_photo ?? 0, canEditMpn: await canEditMpn(sql, context.userId) };
  });

async function loadPart(sql: Sql, id: number): Promise<PartRow> {
  const r = (await sql.query<Raw>(`select ${COLS} from billing_items where id = $1`, [id]))[0];
  if (!r) throw new Error("That part is no longer on the list.");
  return toRow(r);
}

/** Add or replace the photo. The same photo shows on the invoice picker and on the invoice line. */
export const setPartImage = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; base64: string }) =>
    z
      .object({
        id: z.number().int().positive(),
        base64: z.string().min(8).max(Math.ceil((MAX_PART_IMAGE_BYTES * 4) / 3) + 16).regex(/^[A-Za-z0-9+/]+=*$/),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PartRow> => {
    const sql = await ready();
    const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
    const problem = partImageError(bytes);
    if (problem) throw new Error(problem);
    const mime = sniffImage(bytes)!;
    const rows = await sql.query(
      "update billing_items set image = decode($2, 'base64'), image_mime = $3, image_updated_at = now() where id = $1 returning id",
      [data.id, data.base64, mime],
    );
    if (!rows.length) throw new Error("That part is no longer on the list.");
    return loadPart(sql, data.id);
  });

export const clearPartImage = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<PartRow> => {
    const sql = await ready();
    await sql.query("update billing_items set image = null, image_mime = null, image_updated_at = null where id = $1", [data.id]);
    return loadPart(sql, data.id);
  });

/** Record the manufacturer part number for a part. Blank clears it. */
export const setPartMpn = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; mpn: string | null }) => z.object({ id: z.number().int().positive(), mpn: z.string().max(60).nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<PartRow> => {
    const sql = await ready();
    if (!(await canEditMpn(sql, context.userId))) throw new Error("Only Admin and Sales can change a part's MPN.");
    await sql.query("update billing_items set mfr_part = $2, updated_at = now() where id = $1", [data.id, cleanMpn(data.mpn)]);
    return loadPart(sql, data.id);
  });
