/**
 * Import Photo Research: Parts → Import → Import Photo Research (CSV). Admin only (the Admin role or a desk admin),
 * checked here. With apply false nothing is written: that is the preview. Save sends the file again, plans it again
 * against what is stored then, and adds the rows in one statement. A research row already there is never changed
 * (on conflict do nothing) or taken over (a part with research under either number is skipped), and a part's photo
 * is never touched: Pull Confirmed Photos still puts photos on parts.
 */
import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  RESEARCH_MAX_ROWS,
  planResearch,
  researchCounts,
  researchRowsFromSheets,
  siteOf,
  type ResearchCounts,
  type ResearchPart,
  type ResearchPlanLine,
  type ResearchPlanStatus,
} from "@/lib/ops/part-photo-research";

type Query = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

function readSheets(base64: string) {
  if (base64.length > 4_000_000) throw new Error("That file is too large.");
  const wb = XLSX.read(base64, { type: "base64", raw: true, cellText: true });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: false, raw: false }),
  }));
  if (!sheets.length) throw new Error("The file is empty.");
  return sheets;
}

const KEY_SQL = (col: string) => `regexp_replace(upper(coalesce(${col}, '')), '[^A-Z0-9]+', '', 'g')`;

/** The parts (not trip or labor) that any of these keys finds, by MPN or SKU, in SKU order. */
async function partsFor(sql: Query, keys: string[]): Promise<ResearchPart[]> {
  if (!keys.length) return [];
  const rows = await sql.query<Record<string, unknown>>(
    `select id, sku, description, mfr_part, (image is not null) as has_image, ${KEY_SQL("mfr_part")} as mpn_key, ${KEY_SQL("sku")} as sku_key
       from billing_items
      where kind not in ('trip', 'labor') and (${KEY_SQL("mfr_part")} = any($1::text[]) or ${KEY_SQL("sku")} = any($1::text[]))
      order by lower(sku), id`,
    [keys],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    sku: String(r.sku ?? ""),
    description: r.description == null ? null : String(r.description),
    mfrPart: r.mfr_part == null ? null : String(r.mfr_part),
    hasPhoto: r.has_image === true,
    mpnKey: String(r.mpn_key ?? ""),
    skuKey: String(r.sku_key ?? ""),
  }));
}

export type ResearchPreview = ResearchCounts & {
  filename: string;
  rowCount: number;
  lines: ResearchPlanLine[];
  /** Saved: the counts are what was written. */
  applied: boolean;
};

const ORDER: Record<ResearchPlanStatus, number> = { add: 0, duplicate: 1, no_match: 2, bad_url: 3, bad_status: 4, no_key: 5 };

const input = z.object({ filename: z.string().max(300), base64: z.string().min(4), apply: z.boolean() });

/** The body of importPhotoResearch, for one signed-in person. */
export async function importPhotoResearchFor(sql: Query, data: z.infer<typeof input>, userId: string): Promise<ResearchPreview> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error("Only an Admin can import photo research.");
  const { rows } = researchRowsFromSheets(readSheets(data.base64));
  if (!rows.length) throw new Error("No rows under the header.");
  if (rows.length > RESEARCH_MAX_ROWS) throw new Error(`Up to ${RESEARCH_MAX_ROWS} rows at a time; this file has ${rows.length.toLocaleString("en-US")}.`);
  const keys = [...new Set(rows.map((r) => r.key).filter(Boolean))];
  const parts = await partsFor(sql, keys);
  const partKeys = parts.flatMap((p) => [p.mpnKey, p.skuKey]).filter(Boolean);
  const researched = new Set(
    (await sql.query<{ mpn_key: string }>("select mpn_key from part_photo_research where mpn_key = any($1::text[])", [[...new Set([...keys, ...partKeys])]])).map(
      (r) => String(r.mpn_key),
    ),
  );
  const plan = planResearch(rows, parts, researched);
  const counts = researchCounts(plan);
  const preview: ResearchPreview = {
    filename: data.filename,
    rowCount: rows.length,
    ...counts,
    lines: [...plan].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.line - b.line),
    applied: false,
  };
  if (!data.apply) return preview;

  const add = plan.filter((l) => l.status === "add" && l.part);
  if (!add.length) return { ...preview, applied: true };
  const who = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
  const provenance = `Imported from ${data.filename} by ${who}.`;
  // The file's address goes in as the one candidate too: its page is the source the review links to.
  const inserted = await sql.query<{ mpn_key: string }>(
    `insert into part_photo_research (mpn_key, sku, mpn, verdict, reason, image_url, candidates)
     select k, s, m, v, r, i, c::jsonb
       from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) as u(k, s, m, v, r, i, c)
     on conflict (mpn_key) do nothing
     returning mpn_key`,
    [
      add.map((l) => l.key),
      add.map((l) => l.part!.sku),
      add.map((l) => l.partNumber ?? l.part!.mfrPart ?? null),
      add.map((l) => l.verdict),
      add.map((l) => (l.notes ? `${l.notes.slice(0, 1500)} (${provenance})` : provenance)),
      add.map((l) => l.image),
      add.map((l) =>
        JSON.stringify(l.image ? [{ imageUrl: l.image, pageUrl: l.page, site: siteOf(l.page ?? l.image), mpnShown: l.partNumber, watermark: null }] : []),
      ),
    ],
  );
  // Another import between the preview and Save may have added a key: it counts as a duplicate, untouched.
  const lost = add.length - inserted.length;
  return { ...preview, add: inserted.length, duplicate: preview.duplicate + lost, applied: true };
}

export const importPhotoResearch = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof input>) => input.parse(d))
  .handler(async ({ data, context }): Promise<ResearchPreview> => importPhotoResearchFor(await ready(), data, context.userId));
