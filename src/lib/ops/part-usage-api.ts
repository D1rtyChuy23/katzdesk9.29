/**
 * Part usage (Chuy, 10/28): which tickets used each part on the Parts list, read from what KatzDesk and QuickBooks
 * billed. Reading only: nothing here writes.
 *
 * A use is one ticket and one part. It comes from:
 *  1. a service or TLC ticket's Charges;
 *  2. the approved invoice of a PM, install, rebuild or deal;
 *  3. a part logged on a PM's machines (a PM billed on a ticket counts on that ticket);
 *  4. the QuickBooks history work orders (2024–2026); one attached to a KatzDesk ticket counts on that ticket.
 * A ticket written up in more than one of these (logged on the PM and billed on its invoice, or billed in KatzDesk and
 * in QuickBooks) counts once, from the first in that order. A line names a part by its NetSuite item or SKU
 * (QuickBooks lines by SKU, as the history import matches them); trip and labor aren't parts. Duplicate and
 * cancelled tickets, and removed installs, rebuilds and deals, don't count. A QuickBooks line with no quantity is one
 * piece; one with a negative quantity takes pieces off its own ticket, and a ticket left at none doesn't count.
 */
import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import {
  USAGE_GROUPS,
  USAGE_PERIODS,
  USAGE_SORTS,
  USAGE_TYPES,
  USAGE_TYPE_LABEL,
  USAGE_PERIOD_LABEL,
  bucketLabel,
  usageRange,
  usageReport,
  usageTotals,
  type PartUse,
  type UsageBucket,
  type UsageGroup,
  type UsagePeriod,
  type UsageReportRow,
  type UsageSort,
  type UsageTotals,
  type UsageType,
} from "@/lib/ops/part-usage";

type Query = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

/**
 * The uses, one row per ticket and part, as `part_uses (part_id, ticket_key, type, ref_id, history_id, used_on,
 * customer, label, qty)`. A `with` list with no parameters, so another query can start with it.
 */
export const PART_USES_CTE = `
part_keys as (
  -- A line names a part by its NetSuite item ("PARTS : EVER104120") or its SKU; the item wins.
  select distinct on (k) k, part_id from (
    select lower(btrim(item)) as k, id as part_id, 1 as pref from billing_items where kind not in ('trip', 'labor')
    union all
    select lower(btrim(sku)), id, 2 from billing_items where kind not in ('trip', 'labor')
  ) x
  where k <> ''
  order by k, pref, part_id
),
sku_keys as (
  select lower(btrim(sku)) as k, id as part_id from billing_items where kind not in ('trip', 'labor') and btrim(sku) <> ''
),
uses_all as (
  -- 1. Service and TLC tickets: their Charges.
  select pk.part_id, j.kind as type, j.id as ref_id, null::int as history_id, j.kind || ':' || j.id as ticket_key,
         coalesce(j.completed_at, j.scheduled, j.received) as used_on, j.customer,
         nullif(concat_ws(' · ', nullif(btrim(j.call_id), ''), nullif(btrim(j.wo), '')), '') as label,
         c.qty::numeric as qty, 1 as rank
    from ticket_charges c
    join service_jobs j on j.id = c.job_id
    join part_keys pk on pk.k = lower(btrim(c.item))
   where j.duplicate_of is null and j.status <> 'Cancelled'
  union all
  -- 2. PMs, installs, rebuilds and deals: the lines of their approved invoice.
  select pk.part_id, i.entity_type, i.entity_id, null::int, i.entity_type || ':' || i.entity_id,
         coalesce(p.completed_at, ins.completed_at, ins.install_date, r.actual_complete, d.date_of_deal, (i.approved_at at time zone 'America/Chicago')::date),
         i.customer,
         coalesce(nullif(btrim(p.wo), ''), nullif(btrim(ins.wo), ''), nullif(btrim(r.title), ''), nullif(btrim(d.equipment), '')),
         l.qty::numeric, 1
    from invoice_lines l
    join invoices i on i.id = l.invoice_id
    join part_keys pk on pk.k = lower(btrim(l.item))
    left join pm_jobs p on i.entity_type = 'pm' and p.id = i.entity_id
    left join installs ins on i.entity_type = 'install' and ins.id = i.entity_id
    left join rebuilds r on i.entity_type = 'rebuild' and r.id = i.entity_id
    left join deals d on i.entity_type = 'deal' and d.id = i.entity_id
   where i.approved_at is not null and i.entity_type in ('pm', 'install', 'rebuild', 'deal')
     and coalesce(p.status, '') <> 'Cancelled'
     and not coalesce(ins.archived, false) and ins.duplicate_of is null
     and not coalesce(r.archived, false) and not coalesce(d.archived, false)
  union all
  -- 3. Parts logged on a PM's machines. A PM billed on a ticket counts on that ticket.
  select coalesce(b.id, pk.part_id), coalesce(sj.kind, 'pm'), coalesce(sj.id, p.id), null::int,
         case when sj.id is not null then sj.kind || ':' || sj.id else 'pm:' || p.id end,
         case when sj.id is not null then coalesce(sj.completed_at, sj.scheduled, sj.received)
              else coalesce(p.completed_at, (m.added_at at time zone 'America/Chicago')::date) end,
         p.customer,
         case when sj.id is not null then nullif(concat_ws(' · ', nullif(btrim(sj.call_id), ''), nullif(btrim(sj.wo), '')), '')
              else nullif(btrim(p.wo), '') end,
         m.qty::numeric, 2
    from machine_parts m
    join pm_jobs p on p.id = m.pm_job_id
    left join service_jobs sj on sj.id = p.stacked_job_id
    left join billing_items b on b.id = m.billing_item_id and b.kind not in ('trip', 'labor')
    left join part_keys pk on m.billing_item_id is null and pk.k = lower(btrim(m.item))
   where m.removed_at is null and p.status <> 'Cancelled' and coalesce(b.id, pk.part_id) is not null
  union all
  -- 4. QuickBooks history, matched by SKU. One attached to a KatzDesk ticket counts on that ticket.
  select sk.part_id, coalesce(sj.kind, 'quickbooks'), coalesce(sj.id, h.id), h.id,
         case when sj.id is not null then sj.kind || ':' || sj.id else 'qb:' || h.id end,
         coalesce(h.completed::date, h.invoice_date, l.invoice_date), h.customer, nullif(btrim(h.wo), ''),
         coalesce(nullif(l.qty, 0), 1)::numeric, 3
    from wo_history_lines l
    join wo_history h on h.id = l.history_id
    join sku_keys sk on sk.k = lower(btrim(l.item_code))
    left join service_jobs sj on sj.id = h.job_id
   where l.kind not in ('labor', 'trip', 'discount')
),
uses_best as (
  select u.*, min(u.rank) over (partition by u.ticket_key, u.part_id) as best from uses_all u
),
part_uses as (
  select part_id, ticket_key, min(type) as type, min(ref_id) as ref_id, max(history_id) as history_id,
         max(used_on) as used_on, max(customer) as customer, max(label) as label, sum(qty) as qty
    from uses_best
   where rank = best
   group by part_id, ticket_key
  having sum(qty) > 0
)`;

export type UseFilter = {
  from?: string | null;
  to?: string | null;
  types?: UsageType[] | null;
  partIds?: number[] | null;
  /** Only parts on the list (not hidden), in this class and matching this search. */
  listed?: { itemClass?: string; q?: string } | null;
};

const num = (v: unknown) => (v == null ? 0 : Number(v));
const day = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

/** The uses that pass the filter, newest first. */
export async function loadPartUses(sql: Query, f: UseFilter = {}): Promise<PartUse[]> {
  const q = (f.listed?.q ?? "").trim();
  const rows = await sql.query<Record<string, unknown>>(
    `with ${PART_USES_CTE}
     select part_id, ticket_key, type, ref_id, history_id, used_on::text as used_on, customer, label, qty::float8 as qty
       from part_uses u
      where ($1::date is null or u.used_on >= $1::date)
        and ($2::date is null or u.used_on <= $2::date)
        and ($3::text[] is null or u.type = any($3::text[]))
        and ($4::int[] is null or u.part_id = any($4::int[]))
        and (not $5::boolean or u.part_id in (
              select id from billing_items
               where active and hidden_at is null and kind not in ('trip', 'labor')
                 and ($6::text = '' or coalesce(item_class, '') = $6::text)
                 and ($7::text = '' or item ilike $8 or sku ilike $8 or description ilike $8 or mfr_part ilike $8)))
      order by u.used_on desc nulls last, u.ticket_key`,
    [
      f.from ?? null,
      f.to ?? null,
      f.types?.length ? f.types : null,
      f.partIds ? f.partIds : null,
      !!f.listed,
      f.listed?.itemClass ?? "",
      q,
      `%${q}%`,
    ],
  );
  return rows.map((r) => ({
    partId: Number(r.part_id),
    ticketKey: String(r.ticket_key),
    type: (USAGE_TYPES as readonly string[]).includes(String(r.type)) ? (String(r.type) as UsageType) : "service",
    refId: Number(r.ref_id),
    historyId: r.history_id == null ? null : Number(r.history_id),
    usedOn: day(r.used_on),
    customer: r.customer == null ? null : String(r.customer),
    label: r.label == null ? null : String(r.label),
    pieces: Math.round(num(r.qty) * 100) / 100,
  }));
}

/** All-time totals for these parts (the Parts list's line on each part); a part never used reads 0. */
export async function partUsageCounts(sql: Query, ids: number[]): Promise<Record<number, UsageTotals>> {
  if (!ids.length) return {};
  const rows = await sql.query<Record<string, unknown>>(
    `with ${PART_USES_CTE}
     select part_id, count(*)::int as tickets, sum(qty)::float8 as pieces, min(used_on)::text as first_used, max(used_on)::text as last_used
       from part_uses where part_id = any($1::int[]) group by part_id`,
    [ids],
  );
  const out: Record<number, UsageTotals> = Object.fromEntries(ids.map((id) => [id, { tickets: 0, pieces: 0, firstUsed: null, lastUsed: null }]));
  for (const r of rows) {
    out[Number(r.part_id)] = { tickets: Number(r.tickets), pieces: Math.round(num(r.pieces) * 100) / 100, firstUsed: day(r.first_used), lastUsed: day(r.last_used) };
  }
  return out;
}

export type UsagePart = {
  id: number;
  sku: string;
  item: string;
  description: string | null;
  mpn: string | null;
  itemClass: string | null;
  hasImage: boolean;
  imageVersion: string | null;
};

async function partsById(sql: Query, ids: number[]): Promise<Map<number, UsagePart>> {
  if (!ids.length) return new Map();
  const rows = await sql.query<Record<string, unknown>>(
    `select id, sku, item, description, mfr_part, item_class, (image is not null) as has_image,
            case when image is null then null else extract(epoch from image_updated_at)::bigint::text end as image_version
       from billing_items where id = any($1::int[])`,
    [ids],
  );
  return new Map(
    rows.map((r) => [
      Number(r.id),
      {
        id: Number(r.id),
        sku: String(r.sku ?? ""),
        item: String(r.item ?? ""),
        description: r.description == null ? null : String(r.description),
        mpn: r.mfr_part == null ? null : String(r.mfr_part),
        itemClass: r.item_class == null ? null : String(r.item_class),
        hasImage: r.has_image === true,
        imageVersion: r.image_version == null ? null : String(r.image_version),
      },
    ]),
  );
}

const reportInput = z.object({
  period: z.enum(USAGE_PERIODS),
  types: z.array(z.enum(USAGE_TYPES)).max(USAGE_TYPES.length).optional(),
  group: z.enum(USAGE_GROUPS),
  sort: z.enum(USAGE_SORTS).optional(),
  itemClass: z.string().max(120).optional(),
  q: z.string().max(120).optional(),
  offset: z.number().int().min(0).max(100000).optional(),
});
export type UsageReportInput = z.input<typeof reportInput>;

export type UsageReportPage = {
  range: { from: string | null; to: string | null };
  buckets: UsageBucket[];
  stats: { parts: number; tickets: number; pieces: number };
  rows: (UsageReportRow & { part: UsagePart | null })[];
  /** Parts used in all; `rows` is one page of them. */
  total: number;
};

const PAGE = 50;

/** The Most-used report: every used part on the list, ranked, with its tickets and pieces in each period. */
export async function partUsageReportFor(sql: Query, input: UsageReportInput, today: string): Promise<UsageReportPage> {
  const d = reportInput.parse(input);
  const range = usageRange(d.period, today);
  const uses = await loadPartUses(sql, { ...range, types: d.types ?? null, listed: { itemClass: d.itemClass, q: d.q } });
  const report = usageReport(uses, d.group, range, d.sort ?? "tickets");
  const offset = d.offset ?? 0;
  const page = report.rows.slice(offset, offset + PAGE);
  const parts = await partsById(sql, page.map((r) => r.partId));
  return {
    range,
    buckets: report.buckets,
    stats: report.stats,
    rows: page.map((r) => ({ ...r, part: parts.get(r.partId) ?? null })),
    total: report.rows.length,
  };
}

export type UsageExportFile = { filename: string; mime: string; base64: string; rows: number };

const typeText = (t: UsageType) => USAGE_TYPE_LABEL[t];

/**
 * The report as an Excel workbook: "Parts" (each used part, ranked, with tickets per period, then pieces per period)
 * and "Tickets" (every use, newest first). Part numbers and SKUs are text cells.
 */
export async function partUsageWorkbook(sql: Query, input: UsageReportInput, today: string): Promise<UsageExportFile> {
  const d = reportInput.parse(input);
  const range = usageRange(d.period, today);
  const uses = await loadPartUses(sql, { ...range, types: d.types ?? null, listed: { itemClass: d.itemClass, q: d.q } });
  const report = usageReport(uses, d.group, range, d.sort ?? "tickets");
  const parts = await partsById(sql, report.rows.map((r) => r.partId));
  const labels = report.buckets.map((b) => b.label);
  const head = ["Rank", "Part Name", "Part # (MPN)", "SKU", "Class", "Tickets", "Pieces", "First Used", "Last Used", ...labels.map((l) => `Tickets ${l}`), ...labels.map((l) => `Pieces ${l}`)];
  const partRows = report.rows.map((r, i) => {
    const p = parts.get(r.partId);
    return [i + 1, p?.description ?? p?.item ?? "", p?.mpn ?? "", p?.sku ?? "", p?.itemClass ?? "", r.tickets, r.pieces, r.firstUsed ?? "", r.lastUsed ?? "", ...r.byBucket, ...r.piecesByBucket];
  });
  const useHead = ["Date", "Part Name", "Part # (MPN)", "SKU", "Type", "Ticket", "Account", "Pieces"];
  const useRows = uses.map((u) => {
    const p = parts.get(u.partId);
    return [u.usedOn ?? "", p?.description ?? p?.item ?? "", p?.mpn ?? "", p?.sku ?? "", typeText(u.type), u.label ?? "", u.customer ?? "", u.pieces];
  });
  const book = XLSX.utils.book_new();
  const text = (sheet: XLSX.WorkSheet, cols: number[], count: number) => {
    for (const c of cols) {
      for (let r = 1; r <= count; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        if (cell) {
          cell.t = "s";
          cell.v = String(cell.v ?? "");
          cell.z = "@";
        }
      }
    }
  };
  const partsSheet = XLSX.utils.aoa_to_sheet([head, ...partRows]);
  text(partsSheet, [2, 3], partRows.length);
  partsSheet["!cols"] = head.map((h, i) => ({ wch: i === 1 ? 40 : i < 5 ? 18 : Math.max(10, h.length + 2) }));
  partsSheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: partRows.length, c: head.length - 1 } }) };
  XLSX.utils.book_append_sheet(book, partsSheet, "Parts");
  const usesSheet = XLSX.utils.aoa_to_sheet([useHead, ...useRows]);
  text(usesSheet, [2, 3], useRows.length);
  usesSheet["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 36 }, { wch: 8 }];
  usesSheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: useRows.length, c: useHead.length - 1 } }) };
  XLSX.utils.book_append_sheet(book, usesSheet, "Tickets");
  const period = USAGE_PERIOD_LABEL[d.period].toLowerCase().replace(/\s+/g, "-");
  return {
    filename: `KatzDesk_Parts_Usage_${period}_${today}.xlsx`,
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: XLSX.write(book, { type: "base64", bookType: "xlsx" }) as string,
    rows: partRows.length,
  };
}

export type PartUsageDetail = { totals: UsageTotals; uses: PartUse[] };

/** One part's every use, newest first, with its totals. */
export async function partUsageFor(sql: Query, partId: number): Promise<PartUsageDetail> {
  const uses = await loadPartUses(sql, { partIds: [partId] });
  return { totals: usageTotals(uses), uses };
}

/* ------------------------------------------------------------------ server functions */

export const getPartUsageCounts = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[] }) => z.object({ ids: z.array(z.number().int().positive()).max(10000) }).parse(d))
  .handler(async ({ data }): Promise<Record<number, UsageTotals>> => partUsageCounts(await ready(), data.ids));

export const getPartUsage = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<PartUsageDetail> => partUsageFor(await ready(), data.id));

export const getPartUsageReport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: UsageReportInput) => reportInput.parse(d))
  .handler(async ({ data }): Promise<UsageReportPage> => partUsageReportFor(await ready(), data, todayChicago()));

export const exportPartUsage = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: UsageReportInput) => reportInput.parse(d))
  .handler(async ({ data }): Promise<UsageExportFile> => partUsageWorkbook(await ready(), data, todayChicago()));

export { bucketLabel, type UsageGroup, type UsagePeriod, type UsageSort };
