/**
 * Parts inventory: the NetSuite item list with its photo and MPN. The invoice picker reads the same photo.
 * Anyone with Desk access can add or replace a photo; only Admin and Sales change an MPN.
 * Hide is reversible and is not the `active` flag: the item import writes `active` and would undo a hide.
 * Remove is Admin only, and only when the part has never been on a charge or a quote.
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

async function powers(sql: Sql, userId: string): Promise<{ canHide: boolean; canRemove: boolean; canEditMpn: boolean; name: string }> {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const role = rows[0]?.desk_role ?? null;
  const admin = flagOn(rows[0]?.is_admin) || role === "admin";
  const canHide = admin || role === "sales";
  return { canHide, canRemove: admin, canEditMpn: canHide, name: rows[0]?.username?.trim() || "Desk" };
}

export type PartRow = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mpn: string | null;
  rate: number | null;
  /** Manufacturer price, from Update Part Pricing. */
  listPrice: number | null;
  kind: ChargeKind;
  hasImage: boolean;
  /** Changes when the photo does; part of the photo's address so a replaced photo is not stale. */
  imageVersion: string | null;
  hiddenAt: string | null;
  hiddenBy: string | null;
  hiddenReason: string | null;
};

type Raw = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mfr_part: string | null;
  rate: string | null;
  list_price: string | null;
  kind: ChargeKind;
  has_image: boolean;
  image_version: string | null;
  hidden_at: string | Date | null;
  hidden_by: string | null;
  hidden_reason: string | null;
};

const COLS = `id, sku, item, description, mfr_part, rate, list_price, kind,
  (image is not null) as has_image,
  case when image is null then null else extract(epoch from image_updated_at)::bigint::text end as image_version,
  hidden_at, hidden_by, hidden_reason`;

const whenHidden = (v: string | Date | null): string | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
};

const toRow = (r: Raw): PartRow => ({
  id: Number(r.id),
  sku: r.sku,
  item: r.item,
  description: r.description,
  mpn: r.mfr_part,
  rate: r.rate == null ? null : Number(r.rate),
  listPrice: r.list_price == null ? null : Number(r.list_price),
  kind: r.kind,
  hasImage: !!r.has_image,
  imageVersion: r.image_version,
  hiddenAt: whenHidden(r.hidden_at),
  hiddenBy: r.hidden_by,
  hiddenReason: r.hidden_reason,
});

export type PartsPage = { rows: PartRow[]; total: number; withPhoto: number; hiddenCount: number; canEditMpn: boolean; canHide: boolean; canRemove: boolean };

export const listParts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { q?: string; noPhoto?: boolean; offset?: number; hidden?: boolean }) =>
    z.object({ q: z.string().max(120).optional(), noPhoto: z.boolean().optional(), offset: z.number().int().min(0).max(100000).optional(), hidden: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PartsPage> => {
    const sql = await ready();
    const q = (data.q ?? "").trim();
    const like = `%${q}%`;
    // Trip and labor are services, not parts. Hidden parts leave the normal list; Show Hidden lists only those.
    const where = `${data.hidden ? "" : "active and "}kind not in ('trip', 'labor')
      and hidden_at is ${data.hidden ? "not null" : "null"}
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
    const hiddenCount = (await sql.query<{ n: number }>(
      "select count(*)::int as n from billing_items where hidden_at is not null and kind not in ('trip', 'labor')",
    ))[0];
    const who = await powers(sql, context.userId);
    return {
      rows: rows.map(toRow),
      total: counts?.total ?? 0,
      withPhoto: counts?.with_photo ?? 0,
      hiddenCount: hiddenCount?.n ?? 0,
      canEditMpn: who.canEditMpn,
      canHide: who.canHide,
      canRemove: who.canRemove,
    };
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
    if (!(await powers(sql, context.userId)).canEditMpn) throw new Error("Only Admin and Sales can change a part's MPN.");
    await sql.query("update billing_items set mfr_part = $2, updated_at = now() where id = $1", [data.id, cleanMpn(data.mpn)]);
    return loadPart(sql, data.id);
  });

const idsInput = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  reason: z.string().max(200).optional(),
});

/** Where this part is already written on a ticket charge or a repair quote. History is the item text, not the row. */
async function partHistory(sql: Sql, part: { item: string; sku: string }): Promise<string[]> {
  const args = [part.item.trim().toLowerCase(), part.sku.trim().toLowerCase()];
  const tickets = await sql.query<{ id: number; wo: string | null; customer: string | null }>(
    `select j.id, j.wo, j.customer
       from ticket_charges c
       join service_jobs j on j.id = c.job_id
      where lower(btrim(c.item)) = $1 or lower(btrim(c.item)) = $2
      group by j.id, j.wo, j.customer
      order by j.id
      limit 5`,
    args,
  );
  const quotes = await sql.query<{ id: number; status: string; wo: string | null }>(
    `select q.id, q.status, j.wo
       from repair_quote_lines l
       join repair_quotes q on q.id = l.quote_id
       left join service_jobs j on j.id = q.job_id
      where lower(btrim(l.item)) = $1 or lower(btrim(l.item)) = $2
      group by q.id, q.status, j.wo
      order by q.id
      limit 5`,
    args,
  );
  const lines = [
    ...tickets.map((t) => {
      const label = t.wo?.trim() ? `ticket ${t.wo.trim()}` : `ticket #${t.id}`;
      return t.customer?.trim() ? `${label} (${t.customer.trim()})` : label;
    }),
    ...quotes.map((q) => (q.wo?.trim() ? `repair quote on ticket ${q.wo.trim()} (${q.status})` : `repair quote #${q.id} (${q.status})`)),
  ];
  return lines;
}

function historyError(places: string[]): string {
  const shown = places.slice(0, 3).join(", ");
  const more = places.length > 3 ? `, and ${places.length - 3} more` : "";
  return `This part is on ${shown}${more}. It can only be hidden.`;
}

/** Hide parts from the normal list, search, and the invoice and quote pickers. The row stays. Admin and Sales. */
export const hideParts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[]; reason?: string }) => idsInput.parse(d))
  .handler(async ({ data, context }): Promise<{ hidden: number }> => {
    const sql = await ready();
    const who = await powers(sql, context.userId);
    if (!who.canHide) throw new Error("Only Admin and Sales can hide a part.");
    const reason = data.reason?.trim() || null;
    const rows = await sql.query<{ id: number }>(
      `update billing_items
          set hidden_at = now(), hidden_by = $2, hidden_reason = $3, updated_at = now()
        where id = any($1::int[]) and kind not in ('trip', 'labor')
        returning id`,
      [data.ids, who.name, reason],
    );
    if (!rows.length) throw new Error("Those parts are no longer on the list.");
    return { hidden: rows.length };
  });

/** Put hidden parts back on the normal list. Admin and Sales. */
export const restoreParts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[] }) => z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }).parse(d))
  .handler(async ({ data, context }): Promise<{ restored: number }> => {
    const sql = await ready();
    const who = await powers(sql, context.userId);
    if (!who.canHide) throw new Error("Only Admin and Sales can restore a part.");
    const rows = await sql.query<{ id: number }>(
      `update billing_items
          set hidden_at = null, hidden_by = null, hidden_reason = null, updated_at = now()
        where id = any($1::int[]) and hidden_at is not null
        returning id`,
      [data.ids],
    );
    if (!rows.length) throw new Error("Those parts are not hidden.");
    return { restored: rows.length };
  });

/**
 * Delete a part that has never been used. Admin only. A part on any charge or quote line is refused:
 * hide it instead. The caller confirms first.
 */
export const removePart = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ removed: true }> => {
    const sql = await ready();
    const who = await powers(sql, context.userId);
    if (!who.canRemove) throw new Error("Only an Admin can remove a part.");
    const part = (await sql.query<{ id: number; sku: string; item: string; kind: string }>(
      "select id, sku, item, kind from billing_items where id = $1",
      [data.id],
    ))[0];
    if (!part) throw new Error("That part is no longer on the list.");
    if (part.kind === "trip" || part.kind === "labor") throw new Error("Trip and labor stay on the list. They can only be hidden.");
    const places = await partHistory(sql, part);
    if (places.length) throw new Error(historyError(places));
    const gone = await sql.query<{ id: number }>("delete from billing_items where id = $1 returning id", [data.id]);
    if (!gone.length) throw new Error("That part is no longer on the list.");
    return { removed: true };
  });
