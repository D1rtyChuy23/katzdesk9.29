import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  billingCsv,
  billingState,
  checkCharges,
  chargesTotal,
  cleanQty,
  cleanRate,
  cleanSalesOrder,
  itemRowsFromSheets,
  kindForItem,
  normalizePartNo,
  priceChange,
  searchItems,
  type ItemImportColumns,
  type PriceChange,
  type BillingExportLine,
  type BillingItem,
  type PartRef,
  type BillingState,
  type ChargeKind,
  type ChargeLine,
} from "@/lib/ops/charges";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function actor(sql: Sql, userId: string) {
  return (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Desk";
}

/** One line on the ticket's history. Never blocks the save it describes. */
async function logJob(sql: Sql, jobId: number, userId: string, detail: string) {
  const kind = (await sql.query<{ kind: string }>("select kind from service_jobs where id = $1", [jobId]))[0]?.kind ?? "service";
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ($1, $2, $3, 'updated', $4)", [
      kind,
      jobId,
      await actor(sql, userId),
      detail,
    ])
    .catch(() => undefined);
}

type ItemRow = {
  id: number;
  sku: string;
  has_image: boolean;
  image_version: string | null;
  item: string;
  description: string | null;
  rate: string | null;
  kind: ChargeKind;
  mfr_part: string | null;
};

function toItem(r: ItemRow): BillingItem {
  return {
    item: r.item,
    description: r.description,
    rate: r.rate == null ? null : Number(r.rate),
    kind: r.kind,
    mfrPart: r.mfr_part,
    part: { id: Number(r.id), sku: r.sku, mpn: r.mfr_part, hasImage: !!r.has_image, imageVersion: r.image_version },
  };
}

/** Items to pick from, for something typed on a ticket. Exact part numbers come first. */
export const searchBillingItems = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { q: string }) => z.object({ q: z.string().max(120) }).parse(d))
  .handler(async ({ data }): Promise<BillingItem[]> => {
    const q = data.q.trim();
    if (!q) return [];
    const sql = await ready();
    const nq = normalizePartNo(q);
    const rows = await sql.query<ItemRow>(
      `select id, sku, item, description, rate, kind, mfr_part, (image is not null) as has_image,
                case when image is null then null else extract(epoch from image_updated_at)::bigint::text end as image_version
         from billing_items
        where active
          and (item ilike $1 or sku ilike $1 or description ilike $1 or mfr_part ilike $1
               or ($2 <> '' and (regexp_replace(upper(item), '[^A-Z0-9]', '', 'g') like '%' || $2 || '%'
                                 or regexp_replace(upper(coalesce(mfr_part, '')), '[^A-Z0-9]', '', 'g') like $2 || '%')))
        limit 300`,
      [`%${q}%`, nq],
    );
    return searchItems(q, rows.map(toItem), 12);
  });

export type TicketCharges = {
  jobId: number;
  po: string;
  nsSo: string | null;
  billedAt: string | null;
  /** Each line carries its part's photo reference when the item is on the item list. */
  lines: (ChargeLine & { part: PartRef | null })[];
  total: number;
  state: BillingState;
};

async function loadCharges(sql: Sql, jobId: number): Promise<TicketCharges> {
  const job = (await sql.query<{ po: string | null; ns_so: string | null; billed_at: string | null }>(
    "select po, ns_so, billed_at from service_jobs where id = $1",
    [jobId],
  ))[0];
  if (!job) throw new Error("That ticket is no longer on the list.");
  const rows = await sql.query<{
    item: string;
    description: string | null;
    qty: string;
    rate: string;
    kind: ChargeKind;
    pid: number | null;
    sku: string | null;
    mfr_part: string | null;
    has_image: boolean | null;
    image_version: string | null;
  }>(
    `select c.item, c.description, c.qty, c.rate, c.kind,
            p.id as pid, p.sku, p.mfr_part, (p.image is not null) as has_image,
            case when p.image is null then null else extract(epoch from p.image_updated_at)::bigint::text end as image_version
       from ticket_charges c
       left join lateral (
         select * from billing_items b
          where lower(btrim(b.item)) = lower(btrim(c.item)) or lower(btrim(b.sku)) = lower(btrim(c.item))
          order by (lower(btrim(b.item)) = lower(btrim(c.item))) desc
          limit 1
       ) p on true
      where c.job_id = $1
      order by c.sort, c.id`,
    [jobId],
  );
  const lines = rows.map((r) => ({
    item: r.item,
    description: r.description ?? "",
    qty: Number(r.qty),
    rate: Number(r.rate),
    kind: r.kind,
    part: r.pid == null ? null : { id: Number(r.pid), sku: r.sku ?? "", mpn: r.mfr_part, hasImage: !!r.has_image, imageVersion: r.image_version },
  }));
  return {
    jobId,
    po: job.po ?? "",
    nsSo: job.ns_so,
    billedAt: job.billed_at,
    lines,
    total: chargesTotal(lines),
    state: billingState({ lineCount: lines.length, nsSo: job.ns_so }),
  };
}

export const getTicketCharges = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<TicketCharges> => loadCharges(await ready(), data.jobId));

const lineSchema = z.object({
  item: z.string().max(200),
  description: z.string().max(500),
  qty: z.union([z.number(), z.string()]),
  rate: z.union([z.number(), z.string()]),
});

/** Replace the charge lines and P.O. on a ticket. A ticket that is already billed is not changed. */
export const saveTicketCharges = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number; po: string; lines: z.input<typeof lineSchema>[] }) =>
    z.object({ jobId: z.number().int().positive(), po: z.string().max(120), lines: z.array(lineSchema).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<TicketCharges> => {
    const sql = await ready();
    const cur = await loadCharges(sql, data.jobId);
    if (cur.state === "billed") throw new Error(`This ticket is already billed on ${cur.nsSo}. Clear the Sales Order number to change the charges.`);
    const problems = checkCharges(data.lines);
    if (problems.length) throw new Error(`Line ${problems[0].index + 1}: ${problems[0].message}`);

    const items = data.lines.map((l) => l.item.trim());
    const kinds = new Map<string, ChargeKind>();
    if (items.length) {
      const known = await sql.query<{ item: string; kind: ChargeKind }>(
        "select item, kind from billing_items where lower(btrim(item)) = any($1::text[])",
        [items.map((i) => i.toLowerCase())],
      );
      for (const k of known) kinds.set(k.item.trim().toLowerCase(), k.kind);
    }
    const lines = data.lines.map((l, i) => ({
      item: items[i],
      description: l.description.trim(),
      qty: cleanQty(l.qty)!,
      rate: cleanRate(l.rate)!,
      kind: kinds.get(items[i].toLowerCase()) ?? kindForItem(items[i]),
    }));

    // One statement: the old lines and the new ones change together or not at all.
    await sql.query(
      `with d as (delete from ticket_charges where job_id = $1)
       insert into ticket_charges (job_id, item, description, qty, rate, kind, sort)
       select $1, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, t.ord
         from unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::text[]) with ordinality
              as t(item, description, qty, rate, kind, ord)`,
      [data.jobId, lines.map((l) => l.item), lines.map((l) => l.description), lines.map((l) => l.qty), lines.map((l) => l.rate), lines.map((l) => l.kind)],
    );
    await sql.query("update service_jobs set po = $2, updated_at = now() where id = $1", [data.jobId, data.po.trim() || null]);
    await logJob(sql, data.jobId, context.userId, `charges: ${lines.length} line${lines.length === 1 ? "" : "s"}, $${chargesTotal(lines).toFixed(2)}`);
    return loadCharges(sql, data.jobId);
  });

/** Record the NetSuite Sales Order the billing script made for this ticket. Blank clears it. */
export const setTicketSalesOrder = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number; nsSo: string | null }) =>
    z.object({ jobId: z.number().int().positive(), nsSo: z.string().max(40).nullable() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<TicketCharges> => {
    const sql = await ready();
    const so = cleanSalesOrder(data.nsSo);
    await sql.query("update service_jobs set ns_so = $2, billed_at = case when $2::text is null then null else now() end, updated_at = now() where id = $1", [
      data.jobId,
      so,
    ]);
    await logJob(sql, data.jobId, context.userId, so ? `billed on ${so}` : "cleared Sales Order number");
    return loadCharges(sql, data.jobId);
  });

// ---- Item list and price import (Admin) ----------------------------------------------------------------

export type ItemImportStatus = "new" | "price" | "other" | "missing";

export type ItemImportPreview = {
  total: number;
  /** Items in the file that are not loaded yet and will be added. Only counted when the file has a Description column. */
  added: number;
  /** Items whose price changes. */
  priceChanged: number;
  /** Items whose price is the same but description, cost, part number, group or active state changes. */
  otherChanged: number;
  same: number;
  /** In a price-only file: SKUs that are not loaded. They are not created, so a typo cannot add an item. */
  notFound: number;
  /** Price moves of 50% or more, shown first for a second look. */
  checkCount: number;
  skipped: number;
  ignoredSheets: string[];
  columns: ItemImportColumns;
  sample: {
    sku: string;
    item: string;
    description: string | null;
    rate: number | null;
    oldRate: number | null;
    pct: number | null;
    check: boolean;
    status: ItemImportStatus;
  }[];
};

async function readItems(base64: string) {
  if (base64.length > 24_000_000) throw new Error("That file is too large.");
  const wb = XLSX.read(base64, { type: "base64", raw: true, cellText: true });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: false, raw: false }),
  }));
  if (!sheets.length) throw new Error("The file is empty.");
  const parsed = itemRowsFromSheets(sheets);
  if (!parsed.rows.length) throw new Error("No items under the header.");
  if (parsed.rows.length > 50_000) throw new Error("Up to 50,000 items at a time.");
  return parsed;
}

type StoredItem = {
  sku: string;
  parent: string | null;
  description: string | null;
  rate: string | null;
  cost: string | null;
  mfr_part: string | null;
  active: boolean;
};

const UNNEST_ITEMS = `unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[], $6::numeric[], $7::text[], $8::text[], $9::boolean[])
  as s(sku, parent, item, description, rate, cost, kind, mfr_part, active)`;

/**
 * Read a NetSuite item export or a price list (CSV or Excel, every sheet). With apply false nothing is saved, only
 * counted. Rows are matched on the SKU. A column that is not in the file, or a blank cell, never changes what is
 * stored, so a file of just Name and Base Price only moves prices. SKUs that are not loaded are added only when the
 * file carries a Description. Nothing is ever deleted: an item missing from the file stays loaded.
 */
export const importBillingItems = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string; apply: boolean }) =>
    z.object({ filename: z.string().max(300), base64: z.string().min(4), apply: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ItemImportPreview> => {
    const sql = await ready();
    if (!(await canReviewNames(sql, context.userId))) throw new Error("Only an Admin can import the item list.");
    const { rows, skipped, ignoredSheets, columns } = await readItems(data.base64);

    const have = new Map<string, StoredItem>();
    for (const r of await sql.query<StoredItem>("select sku, parent, description, rate, cost, mfr_part, active from billing_items")) {
      have.set(r.sku.trim().toLowerCase(), r);
    }

    type Planned = { row: (typeof rows)[number]; status: ItemImportStatus | "same"; change: PriceChange | null };
    const planned: Planned[] = rows.map((row) => {
      const e = have.get(row.sku.toLowerCase());
      if (!e) return { row, status: columns.description ? "new" : "missing", change: priceChange(null, row.rate) };
      const change = priceChange(e.rate == null ? null : Number(e.rate), row.rate);
      if (change) return { row, status: "price", change };
      const other =
        (row.cost != null && row.cost !== (e.cost == null ? null : Number(e.cost))) ||
        (row.description != null && row.description !== (e.description ?? "")) ||
        (row.mfrPart != null && row.mfrPart !== (e.mfr_part ?? "")) ||
        (row.parent != null && row.parent !== (e.parent ?? "")) ||
        (row.active != null && row.active !== e.active);
      return { row, status: other ? "other" : "same", change: null };
    });
    const n = (st: Planned["status"]) => planned.filter((p) => p.status === st).length;
    const order: Record<string, number> = { price: 1, new: 2, other: 3, missing: 4, same: 9 };
    const preview: ItemImportPreview = {
      total: rows.length,
      added: n("new"),
      priceChanged: n("price"),
      otherChanged: n("other"),
      same: n("same"),
      notFound: n("missing"),
      checkCount: planned.filter((p) => p.change?.check).length,
      skipped,
      ignoredSheets,
      columns,
      sample: planned
        .filter((p) => p.status !== "same")
        .sort((a, b) => Number(!!b.change?.check) - Number(!!a.change?.check) || order[a.status] - order[b.status])
        .slice(0, 200)
        .map((p) => ({
          sku: p.row.sku,
          item: p.row.item,
          description: p.row.description,
          rate: p.row.rate,
          oldRate: p.change?.from ?? null,
          pct: p.change?.pct ?? null,
          check: !!p.change?.check,
          status: p.status as ItemImportStatus,
        })),
    };
    if (!data.apply) return preview;

    const CHUNK = 500;
    const toUpdate = planned.filter((p) => p.status === "price" || p.status === "other").map((p) => p.row);
    const toAdd = planned.filter((p) => p.status === "new").map((p) => p.row);
    const arrays = (part: typeof rows, kindFrom: "file" | "name") => [
      part.map((r) => r.sku),
      part.map((r) => r.parent),
      part.map((r) => r.item),
      part.map((r) => r.description),
      part.map((r) => r.rate),
      part.map((r) => r.cost),
      // Only a file with a Class column says what kind an existing item is; otherwise it keeps the kind it has.
      // A new item always gets one: from the class when given, else from its name.
      part.map((r) => (kindFrom === "name" || columns.cls ? r.kind : null)),
      part.map((r) => r.mfrPart),
      part.map((r) => r.active),
    ];
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      await sql.query(
        `update billing_items b set
           parent = coalesce(s.parent, b.parent),
           item = case when s.parent is not null then s.item else b.item end,
           description = coalesce(s.description, b.description),
           rate = coalesce(s.rate, b.rate),
           cost = coalesce(s.cost, b.cost),
           kind = case when s.kind is null or b.kind in ('trip', 'labor') then b.kind else s.kind end,
           mfr_part = coalesce(s.mfr_part, b.mfr_part),
           active = coalesce(s.active, b.active),
           updated_at = now()
         from ${UNNEST_ITEMS}
        where lower(btrim(b.sku)) = lower(btrim(s.sku))`,
        arrays(toUpdate.slice(i, i + CHUNK), "file"),
      );
    }
    for (let i = 0; i < toAdd.length; i += CHUNK) {
      await sql.query(
        `insert into billing_items (sku, parent, item, description, rate, cost, kind, mfr_part, active)
         select s.sku, s.parent, s.item, s.description, s.rate, s.cost, coalesce(s.kind, 'part'), s.mfr_part, coalesce(s.active, true)
           from ${UNNEST_ITEMS}
          where not exists (select 1 from billing_items b where lower(btrim(b.sku)) = lower(btrim(s.sku)))`,
        arrays(toAdd.slice(i, i + CHUNK), "name"),
      );
    }
    return preview;
  });

// ---- Billing hand-off ----------------------------------------------------------------------------------

export type BillingExport = {
  csv: string;
  tickets: number;
  lines: number;
  total: number;
  /** Completed tickets in the window with nothing on them — usually a missed bill. */
  noCharges: { id: number; wo: string | null; customer: string | null }[];
};

/**
 * Charges ready to hand to the billing script, as one CSV. Only tickets with a completed date in the window,
 * with charges, and not yet billed (unless includeBilled).
 */
export const exportBilling = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { from: string; to: string; includeBilled?: boolean }) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        includeBilled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<BillingExport> => {
    const sql = await ready();
    const billed = data.includeBilled ? "" : "and j.ns_so is null";
    const rows = await sql.query<{
      id: number;
      wo: string | null;
      po: string | null;
      customer: string | null;
      technician: string | null;
      completed_at: string | null;
      work_done: string | null;
      account_number: string | null;
      netsuite_id: string | null;
      item: string;
      description: string | null;
      qty: string;
      rate: string;
    }>(
      `select j.id, j.wo, j.po, j.customer, j.technician, to_char(j.completed_at, 'YYYY-MM-DD') as completed_at, j.work_done,
              dc.account_number, dc.netsuite_id, c.item, c.description, c.qty, c.rate
         from service_jobs j
         join ticket_charges c on c.job_id = j.id
         left join directory_customers dc on dc.archived = false and lower(btrim(dc.name)) = lower(btrim(j.customer))
        where j.duplicate_of is null
          and j.completed_at between $1::date and $2::date
          ${billed}
        order by j.completed_at, j.id, c.sort, c.id`,
      [data.from, data.to],
    );
    const lines: BillingExportLine[] = rows.map((r) => ({
      wo: r.wo ?? "",
      po: r.po ?? "",
      customer: r.customer ?? "",
      accountNumber: r.account_number ?? "",
      netsuiteId: r.netsuite_id ?? "",
      technician: r.technician ?? "",
      completed: r.completed_at ?? "",
      item: r.item,
      description: r.description ?? "",
      qty: Number(r.qty),
      rate: Number(r.rate),
      workDone: r.work_done ?? "",
    }));
    const none = await sql.query<{ id: number; wo: string | null; customer: string | null }>(
      `select j.id, j.wo, j.customer
         from service_jobs j
        where j.duplicate_of is null and j.completed_at between $1::date and $2::date and j.ns_so is null
          and not exists (select 1 from ticket_charges c where c.job_id = j.id)
        order by j.completed_at, j.id
        limit 200`,
      [data.from, data.to],
    );
    return {
      csv: billingCsv(lines),
      tickets: new Set(rows.map((r) => r.id)).size,
      lines: lines.length,
      total: chargesTotal(lines),
      noCharges: none,
    };
  });
