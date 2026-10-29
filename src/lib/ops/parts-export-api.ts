/**
 * Parts → Export CSV, the server side (Grok's request through Chuy, 2026-10-29). Admin only and read only: nothing
 * here writes. The file is the parts on the Parts page, its list and Show Hidden together, one row each in id order.
 * Each part's counts are read once, first; then the parts are read 500 at a time by id and streamed, so the whole
 * list (about 7,200 parts) is never one query result or one string on the server.
 *
 *  - wo_part_line_count: the WO part lines imported for the part (Parts → Import → Import WO Part Lines), Corrigo's
 *    and NetSuite's, as they are stored.
 *  - ticket_count: the tickets that used the part, the number on its row on Parts (Parts usage).
 *  - equipment_link_count: the machines the part is logged on in a PM's machine parts, each machine once (by its serial,
 *    else its account unit, else its spot on that PM). A removed line or a cancelled PM doesn't count.
 * All three follow merges, as Parts usage does: a part folded into another reads 0, and the part it went into counts
 * its lines, tickets and machines.
 */
import type { Sql } from "@/lib/db";
import { canReviewNames } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { binSearchCode } from "@/lib/ops/part-bins";
import { partSearchSql } from "@/lib/ops/parts-api";
import { PART_USES_CTE } from "@/lib/ops/part-usage-api";
import {
  PARTS_EXPORT_HEAD,
  partExportLine,
  partsExportFileName,
  parsePartsExportQuery,
  type PartExportCounts,
  type PartExportRow,
  type PartsExportFilter,
} from "@/lib/ops/parts-export";

type Query = Pick<Sql, "query">;

/** Parts read per query while the file streams. */
export const PARTS_EXPORT_PAGE = 500;

/**
 * SQL and its values for the parts in the file ($1 to $4). The Parts list is the active parts that aren't hidden and
 * Show Hidden is every hidden part, so the file is both. Trip and labor aren't parts. With Filtered only, the class
 * and the search the page has (the same search as the list); the hidden parts that match stay in.
 */
export function partsExportWhere(f: PartsExportFilter): { where: string; args: unknown[] } {
  const q = f.filtered ? f.q.trim() : "";
  const itemClass = f.filtered ? f.itemClass.trim() : "";
  return {
    where: `kind not in ('trip', 'labor') and (hidden_at is not null or active)
      and ($1 = '' or coalesce(item_class, '') = $1)
      and ${partSearchSql("$2", "$3", "$4")}`,
    args: [itemClass, q, `%${q}%`, `%${binSearchCode(q)}%`],
  };
}

/** How many parts the file has. */
export async function partsExportTotal(sql: Query, f: PartsExportFilter): Promise<number> {
  const { where, args } = partsExportWhere(f);
  const rows = await sql.query<{ n: number }>(`select count(*)::int as n from billing_items where ${where}`, args);
  return Number(rows[0]?.n ?? 0);
}

/** Each part's WO part lines, tickets and machines, by part id, in one query. A part with none isn't in the map. */
export async function partsExportCounts(sql: Query): Promise<Map<number, PartExportCounts>> {
  const rows = await sql.query<{ part_id: number; wo_lines: number; tickets: number; links: number }>(
    `with ${PART_USES_CTE},
     ticket_n as (select part_id, count(*)::int as n from part_uses group by part_id),
     line_n as (
       select tk.part_id, count(*)::int as n from ticket_part_lines pl join tail_keys tk on tk.k = pl.sku group by tk.part_id
     ),
     link_n as (
       -- One machine, however a line names it: by serial (the line's, else its account unit's), else by the account
       -- unit, else by its spot on that PM. A PM's machine history matches the same way: same unit or same serial.
       select coalesce(b.merged_into, b.id, pk.part_id) as part_id,
              count(distinct coalesce(
                'serial:' || coalesce(nullif(lower(btrim(m.serial_key)), ''), nullif(lower(btrim(ae.serial_key)), '')),
                'unit:' || m.account_equipment_id,
                'pm:' || m.pm_job_id || ':' || m.piece_key))::int as n
         from machine_parts m
         join pm_jobs p on p.id = m.pm_job_id
         left join account_equipment ae on ae.id = m.account_equipment_id
         left join billing_items b on b.id = m.billing_item_id and b.kind not in ('trip', 'labor')
         left join part_keys pk on m.billing_item_id is null and pk.k = lower(btrim(m.item))
        where m.removed_at is null and p.status <> 'Cancelled' and coalesce(b.id, pk.part_id) is not null
        group by 1
     )
     select ids.part_id, coalesce(l.n, 0) as wo_lines, coalesce(t.n, 0) as tickets, coalesce(e.n, 0) as links
       from (select part_id from ticket_n union select part_id from line_n union select part_id from link_n) ids
       left join ticket_n t on t.part_id = ids.part_id
       left join line_n l on l.part_id = ids.part_id
       left join link_n e on e.part_id = ids.part_id`,
  );
  const out = new Map<number, PartExportCounts>();
  for (const r of rows) {
    out.set(Number(r.part_id), { woPartLines: Number(r.wo_lines), tickets: Number(r.tickets), equipmentLinks: Number(r.links) });
  }
  return out;
}

type PageRaw = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mfr_part: string | null;
  item_class: string | null;
  bin_rack: string | null;
  bin_shelf: string | null;
  bin_bin: string | null;
  hidden: boolean;
  has_image: boolean;
  image_version: string | null;
  merged_into: number | null;
  updated_at: string | Date | null;
};

/** A time as ISO 8601 in UTC, to the second ("2026-10-29T14:03:11Z"). */
function isoSecond(v: string | Date | null): string | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** The next parts after `afterId`, in id order. */
export async function partsExportPage(sql: Query, f: PartsExportFilter, afterId: number, limit = PARTS_EXPORT_PAGE): Promise<PartExportRow[]> {
  const { where, args } = partsExportWhere(f);
  const rows = await sql.query<PageRaw>(
    `select id, sku, item, description, mfr_part, item_class, bin_rack, bin_shelf, bin_bin,
            (hidden_at is not null) as hidden, (image is not null) as has_image,
            case when image is null then null else extract(epoch from image_updated_at)::bigint::text end as image_version,
            merged_into, updated_at
       from billing_items
      where ${where} and id > $5
      order by id
      limit $6`,
    [...args, afterId, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    sku: r.sku,
    item: r.item,
    description: r.description,
    mfrPart: r.mfr_part,
    itemClass: r.item_class,
    binRack: r.bin_rack,
    binShelf: r.bin_shelf,
    binBin: r.bin_bin,
    hidden: !!r.hidden,
    hasPhoto: !!r.has_image,
    imageVersion: r.image_version,
    mergedInto: r.merged_into == null ? null : Number(r.merged_into),
    updatedAt: isoSecond(r.updated_at),
  }));
}

/** The file as a stream: the byte-order mark and header, then the parts, a page per read, each line ending CRLF. */
export function partsExportBody(sql: Query, f: PartsExportFilter, counts: Map<number, PartExportCounts>, origin: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let afterId = 0;
  let started = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        controller.enqueue(enc.encode(PARTS_EXPORT_HEAD));
        return;
      }
      let rows: PartExportRow[];
      try {
        rows = await partsExportPage(sql, f, afterId);
      } catch (e) {
        // The download stops here; the Parts page says so.
        console.error("[parts-export] reading parts after id", afterId, e);
        controller.error(e);
        return;
      }
      if (rows.length) {
        afterId = rows[rows.length - 1]!.id;
        controller.enqueue(enc.encode(rows.map((r) => `${partExportLine(r, counts.get(r.id), origin)}\r\n`).join("")));
      }
      if (rows.length < PARTS_EXPORT_PAGE) controller.close();
    },
  });
}

export type PartsExportResult =
  | { ok: false; status: 403; error: string }
  | { ok: true; fileName: string; total: number; body: ReadableStream<Uint8Array> };

/**
 * The file for an Admin, from the address bar's choice (filtered=1, class, q). Anyone else is refused before a part is
 * read. The counts and the number of parts are read before the first byte, so a failure there is an error, not half
 * a file.
 */
export async function partsExportFor(sql: Sql, userId: string, params: URLSearchParams, origin: string, day = todayChicago()): Promise<PartsExportResult> {
  if (!(await canReviewNames(sql, userId))) return { ok: false, status: 403, error: "Only an Admin can export the parts." };
  const filter = parsePartsExportQuery(params);
  const counts = await partsExportCounts(sql);
  const total = await partsExportTotal(sql, filter);
  return { ok: true, fileName: partsExportFileName(day), total, body: partsExportBody(sql, filter, counts, origin) };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

/** Same-origin, a direct address-bar visit, or a non-browser client; never another site's script. */
export function sameSiteOk(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return true;
  return request.headers.get("sec-fetch-mode") === "navigate" && request.method === "GET";
}

/**
 * The site's address for the photo links: the public address the site is set up with (BETTER_AUTH_URL, which sign-in
 * uses too) when there is one, else the address the request came to (local and preview).
 */
export function exportOrigin(requestUrl: string, configured?: string | null): string {
  const set = configured?.trim();
  if (set) {
    try {
      const u = new URL(set);
      if (u.protocol === "https:" || u.protocol === "http:") return u.origin;
    } catch {
      // Not an address: use the request's.
    }
  }
  return new URL(requestUrl).origin;
}

export type PartsExportDeps = {
  /** Who is signed in, from the request's cookies; null when nobody is. */
  session: (headers: Headers) => Promise<{ user?: { id: string } | null } | null>;
  /** The database, seeded and ready. */
  ready: () => Promise<Sql>;
  /** The site's public address, when it is set up with one. */
  publicUrl?: string | null;
  /** The day in the file name; today in Chicago when left out. */
  day?: string;
};

/**
 * GET /api/admin/parts-export, all of it: another site's script is refused (403), then a visitor who isn't signed in
 * (401), then anyone who isn't an Admin (403), before any part is read. A failure before the first byte is a 500 with a
 * sentence the Parts page shows.
 */
export async function partsExportResponse(request: Request, deps: PartsExportDeps): Promise<Response> {
  if (!sameSiteOk(request)) return json({ error: "Cross-site request refused." }, 403);
  const session = await deps.session(request.headers).catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return json({ error: "Sign in first." }, 401);
  try {
    const sql = await deps.ready();
    const url = new URL(request.url);
    const out = await partsExportFor(sql, userId, url.searchParams, exportOrigin(request.url, deps.publicUrl), deps.day);
    if (!out.ok) return json({ error: out.error }, out.status);
    return new Response(out.body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${out.fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Parts-Count": String(out.total),
      },
    });
  } catch (e) {
    console.error("[parts-export]", e);
    return json({ error: "Could not build the parts file. Try again." }, 500);
  }
}
