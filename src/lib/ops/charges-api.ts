import { isWalkIn } from "./customer-key";
import { applyDiscount, cleanDiscount, discountLabel, isDiscountKind, withHeaderDiscount, type Discount } from "./discount";
import { discountShares, lineProfit, ruleLabel, type DiscountRule, type LineProfit, type ProfitLine } from "./part-pricing";
import { textArray } from "./part-merges";
import { loadDiscountRule } from "./part-pricing-api";
import { liveInvoices, lockingInvoice, locationWarning, unlockActive, warehouseForTech } from "./billing-rules";
import { LIVE_INVOICE_SQL, UNCHANGED_SINCE_READ, UNLOCKED_SQL, loadInvoices } from "./ticket-billing-api";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
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
  round2,
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
  item_class: string | null;
  get_later: boolean | null;
  previous_numbers?: unknown;
};

function toItem(r: ItemRow): BillingItem {
  return {
    item: r.item,
    description: r.description,
    rate: r.rate == null ? null : Number(r.rate),
    kind: r.kind,
    mfrPart: r.mfr_part,
    part: { id: Number(r.id), sku: r.sku, mpn: r.mfr_part, hasImage: !!r.has_image, imageVersion: r.image_version },
    itemClass: r.item_class,
    getLater: !!r.get_later,
    previousNumbers: textArray(r.previous_numbers),
  };
}

/** Items to pick from, for something typed on a ticket. Exact part numbers come first. */
export const searchBillingItems = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { q: string }) => z.object({ q: z.string().max(120) }).parse(d))
  .handler(async ({ data }): Promise<BillingItem[]> => searchBillingItemsFor(await ready(), data.q));

/** The body of searchBillingItems: every part picker (tickets, quotes, invoices, PM machine parts) reads it. */
export async function searchBillingItemsFor(sql: Pick<Sql, "query">, raw: string): Promise<BillingItem[]> {
  const q = raw.trim();
  if (!q) return [];
  const nq = normalizePartNo(q);
  const rows = await sql.query<ItemRow>(
    `select id, sku, item, description, rate, kind, mfr_part, item_class, get_later, previous_numbers, (image is not null) as has_image,
            case when image is null then null else extract(epoch from image_updated_at)::bigint::text end as image_version
       from billing_items
      where active
        and hidden_at is null
        and (item ilike $1 or sku ilike $1 or description ilike $1 or mfr_part ilike $1
             or ($2 <> '' and (regexp_replace(upper(item), '[^A-Z0-9]', '', 'g') like '%' || $2 || '%'
                               or regexp_replace(upper(coalesce(mfr_part, '')), '[^A-Z0-9]', '', 'g') like $2 || '%'))
             -- An old number merged into a part finds that part (10/28).
             or exists (select 1 from unnest(previous_numbers) pn
                         where pn ilike $1 or ($2 <> '' and regexp_replace(upper(pn), '[^A-Z0-9]', '', 'g') like $2 || '%')))
      limit 300`,
    [`%${q}%`, nq],
  );
  return searchItems(q, rows.map(toItem), 12);
}

export type TicketCharges = {
  jobId: number;
  po: string;
  nsSo: string | null;
  billedAt: string | null;
  /** Each line carries its part's photo reference when the item is on the item list. */
  lines: (ChargeLine & { id: number; part: PartRef | null })[];
  /** The one discount on this ticket, or null. */
  discount: Discount | null;
  /** The lines added up, before the discount. */
  subtotal: number;
  /** Dollars the discount takes off. */
  off: number;
  /** The total after the discount. */
  total: number;
  state: BillingState;
  /**
   * Admin only: cost, sell, discount and margin on each line that has a part (same order as lines; null for trip,
   * labor and lines with no part). Stored when the ticket is invoiced; worked out live before that.
   */
  profit: (LineProfitView | null)[] | null;
  /** Our Discount Rule as it reads now, for the Admin's view. */
  ruleLabel: string | null;
  /** The NetSuite invoice (not Voided) that locks the charges, P.O., discount and Sales Order, or null. */
  invoiceLock: { invoice: string; status: string } | null;
  /** An Admin's open unlock: one save is allowed, then the ticket locks again. */
  unlock: { by: string | null; at: string; reason: string | null } | null;
  /** The caller is an Admin, so the lock can be opened. */
  canUnlock: boolean;
};

export type LineProfitView = LineProfit & { mpn: string | null; listPrice: number | null; stored: boolean };

type ChargeRow = {
  id: number;
  item: string;
  description: string | null;
  qty: string;
  rate: string;
  kind: ChargeKind;
  source_key: string | null;
  pid: number | null;
  sku: string | null;
  mfr_part: string | null;
  has_image: boolean | null;
  image_version: string | null;
  p_list: string | null;
  p_cost: string | null;
  s_mpn: string | null;
  s_list: string | null;
  s_unit_cost: string | null;
  s_source: string | null;
  s_our: string | null;
  s_ticket: string | null;
  s_margin: string | null;
  priced_at: string | null;
};

async function chargeRows(sql: Sql, jobId: number): Promise<ChargeRow[]> {
  return sql.query<ChargeRow>(
    `select c.id, c.item, c.description, c.qty, c.rate, c.kind, c.source_key,
            p.id as pid, p.sku, p.mfr_part, (p.image is not null) as has_image,
            case when p.image is null then null else extract(epoch from p.image_updated_at)::bigint::text end as image_version,
            p.list_price as p_list, p.cost as p_cost,
            c.mpn as s_mpn, c.list_price as s_list, c.unit_cost as s_unit_cost, c.cost_source as s_source,
            c.our_discount as s_our, c.ticket_discount as s_ticket, c.margin as s_margin, c.priced_at
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
}

const num = (v: string | null) => (v == null ? null : Number(v));
/** A ticket line "has a part" when its item is on the parts list and it is not trip or labor. */
const isPartLine = (r: Pick<ChargeRow, "pid" | "kind">) => r.pid != null && r.kind !== "trip" && r.kind !== "labor";

/** Cost, sell, discount and margin per part line: stored when invoiced, else worked out from the part and the rule. */
function profitFor(rows: ChargeRow[], off: number, rule: DiscountRule | null): (LineProfitView | null)[] {
  const shares = discountShares(rows.map((r) => round2(Number(r.qty) * Number(r.rate))), off);
  return rows.map((r, i) => {
    if (!isPartLine(r)) return null;
    const qty = Number(r.qty);
    if (r.priced_at) {
      const sell = round2(qty * Number(r.rate));
      const unit = num(r.s_unit_cost);
      const ticketDiscount = num(r.s_ticket) ?? 0;
      const margin = num(r.s_margin);
      const net = sell - ticketDiscount;
      return {
        qty,
        unitCost: unit,
        cost: unit == null ? null : round2(qty * unit),
        sell,
        ourDiscount: num(r.s_our),
        ticketDiscount,
        margin,
        marginPct: margin == null || net <= 0 ? null : round2((margin / net) * 100),
        source: (r.s_source as LineProfit["source"]) ?? "none",
        mpn: r.s_mpn,
        listPrice: num(r.s_list),
        stored: true,
      };
    }
    const p = lineProfit({ qty, rate: Number(r.rate) }, { listPrice: num(r.p_list), cost: num(r.p_cost) }, rule, shares[i] ?? 0);
    return { ...p, mpn: r.mfr_part, listPrice: num(r.p_list), stored: false };
  });
}

async function loadCharges(sql: Sql, jobId: number, showCost = false): Promise<TicketCharges> {
  const job = (await sql.query<{
    po: string | null;
    ns_so: string | null;
    billed_at: string | null;
    discount_kind: string | null;
    discount_value: string | null;
    billing_unlocked_at: unknown;
    billing_unlocked_by: string | null;
    billing_unlock_reason: string | null;
  }>(
    `select po, ns_so, billed_at, discount_kind, discount_value, billing_unlocked_at, billing_unlocked_by, billing_unlock_reason
       from service_jobs where id = $1`,
    [jobId],
  ))[0];
  if (!job) throw new Error("That ticket is no longer on the list.");
  const invoices = (await loadInvoices(sql, [jobId])).get(jobId) ?? [];
  const lockedBy = lockingInvoice(invoices);
  const unlockedAt = job.billing_unlocked_at instanceof Date ? job.billing_unlocked_at.toISOString() : job.billing_unlocked_at ? String(job.billing_unlocked_at) : null;
  const rows = await chargeRows(sql, jobId);
  const lines = rows.map((r) => ({
    id: Number(r.id),
    item: r.item,
    description: r.description ?? "",
    qty: Number(r.qty),
    rate: Number(r.rate),
    kind: r.kind,
    sourceKey: r.source_key,
    part: r.pid == null ? null : { id: Number(r.pid), sku: r.sku ?? "", mpn: r.mfr_part, hasImage: !!r.has_image, imageVersion: r.image_version },
  }));
  const discount: Discount | null =
    isDiscountKind(job.discount_kind) && Number(job.discount_value) > 0 ? { kind: job.discount_kind, value: Number(job.discount_value) } : null;
  const totals = applyDiscount(chargesTotal(lines), discount);
  const rule = showCost ? await loadDiscountRule(sql) : null;
  return {
    jobId,
    po: job.po ?? "",
    nsSo: job.ns_so,
    // A timestamp comes back as a Date from both drivers: send text.
    billedAt: (job.billed_at as unknown) instanceof Date ? (job.billed_at as unknown as Date).toISOString() : job.billed_at ? String(job.billed_at) : null,
    lines,
    discount,
    ...totals,
    state: billingState({ lineCount: lines.length, nsSo: job.ns_so, invoiced: liveInvoices(invoices).length > 0 }),
    profit: showCost ? profitFor(rows, totals.off, rule) : null,
    ruleLabel: showCost ? ruleLabel(rule) : null,
    invoiceLock: lockedBy ? { invoice: lockedBy.invoice, status: lockedBy.status } : null,
    unlock: lockedBy && unlockedAt && unlockActive(unlockedAt) ? { by: job.billing_unlocked_by, at: unlockedAt, reason: job.billing_unlock_reason } : null,
    canUnlock: showCost,
  };
}

/**
 * Every part line on invoiced tickets (a Sales Order number entered) billed in the range, with its cost, sell,
 * discount and margin. Lines invoiced before costs were stored are worked out from the part and the rule as they are
 * now, and counted as live.
 */
export async function invoicedPartLines(sql: Sql, range: { from: string | null; to: string | null }): Promise<{ lines: (ProfitLine & { live: boolean })[] }> {
  const jobs = await sql.query<{ id: number; discount_kind: string | null; discount_value: string | null }>(
    `select j.id, j.discount_kind, j.discount_value from service_jobs j
      where (j.ns_so is not null or ${LIVE_INVOICE_SQL("j.id")}) and j.duplicate_of is null
        and ($1::date is null or coalesce(j.billed_at::date, j.completed_at::date) >= $1::date)
        and ($2::date is null or coalesce(j.billed_at::date, j.completed_at::date) <= $2::date)
        and exists (select 1 from ticket_charges c where c.job_id = j.id)
      order by j.id`,
    [range.from || null, range.to || null],
  );
  const rule = await loadDiscountRule(sql);
  const out: (ProfitLine & { live: boolean })[] = [];
  for (const j of jobs) {
    const rows = await chargeRows(sql, Number(j.id));
    const lines = rows.map((r) => ({ qty: Number(r.qty), rate: Number(r.rate) }));
    const discount: Discount | null = isDiscountKind(j.discount_kind) && Number(j.discount_value) > 0 ? { kind: j.discount_kind, value: Number(j.discount_value) } : null;
    const off = applyDiscount(chargesTotal(lines), discount).off;
    const profit = profitFor(rows, off, rule);
    rows.forEach((r, i) => {
      const p = profit[i];
      if (!p) return;
      out.push({
        mpn: p.mpn ?? r.mfr_part ?? "",
        sku: r.sku ?? r.item,
        description: r.description ?? "",
        qty: p.qty,
        cost: p.cost,
        sell: p.sell,
        ourDiscount: p.ourDiscount,
        ticketDiscount: p.ticketDiscount,
        margin: p.margin,
        live: !p.stored,
      });
    });
  }
  return { lines: out };
}

/**
 * When a ticket is invoiced, store on each part line its MPN, manufacturer price, cost, our discount, its share of
 * the ticket discount and its margin, from the part and Our Discount Rule as they are now. Clearing the Sales
 * Order clears them, so a re-bill stores fresh ones.
 */
export async function storeInvoicedProfit(sql: Sql, jobId: number, invoiced: boolean) {
  if (!invoiced) {
    await sql.query(
      "update ticket_charges set mpn = null, list_price = null, unit_cost = null, cost_source = null, our_discount = null, ticket_discount = null, margin = null, priced_at = null where job_id = $1",
      [jobId],
    );
    return;
  }
  const cur = await loadCharges(sql, jobId);
  const rows = await chargeRows(sql, jobId);
  const fresh = rows.map((r) => ({ ...r, priced_at: null }));
  const profit = profitFor(fresh, cur.off, await loadDiscountRule(sql));
  for (let i = 0; i < rows.length; i++) {
    const p = profit[i];
    if (!p) continue;
    await sql.query(
      `update ticket_charges set mpn = $2, list_price = $3, unit_cost = $4, cost_source = $5, our_discount = $6, ticket_discount = $7, margin = $8, priced_at = now()
        where id = $1`,
      [rows[i].id, p.mpn, p.listPrice, p.unitCost, p.source, p.ourDiscount, p.ticketDiscount, p.margin],
    );
  }
}

export const getTicketCharges = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<TicketCharges> => {
    const sql = await ready();
    return loadCharges(sql, data.jobId, await canReviewNames(sql, context.userId));
  });

const lineSchema = z.object({
  item: z.string().max(200),
  description: z.string().max(500),
  qty: z.union([z.number(), z.string()]),
  rate: z.union([z.number(), z.string()]),
  sourceKey: z.string().max(400).regex(/^(pmkit|mp):/).nullable().optional(),
});

export type ChargeLinesInput = z.input<typeof lineSchema>[];
export type DiscountInput = { kind: string; value: string | number } | null | undefined;

/**
 * One statement: lock the ticket, replace its charge lines, and write the P.O. and discount together.
 * source_key rides in $12. There is no unique index on it — the delete and the insert are one statement,
 * and a second save of the same keys must succeed. Duplicate keys are refused in checkCharges instead.
 */
export function replaceTicketChargesSql(): string {
  return `with j as (
       select s.id
         from service_jobs s
        where s.id = $1
          and s.duplicate_of is null
          and nullif(btrim(s.ns_so), '') is null
          and not ${LIVE_INVOICE_SQL("s.id")}
          and ${UNCHANGED_SINCE_READ("s", "$1")}
          and ($7::boolean or coalesce((select array_agg(c.id order by c.id) from ticket_charges c where c.job_id = s.id), '{}') = $8::int[])
        for update
     ), d as (
       delete from ticket_charges c using j where c.job_id = j.id
     ), ins as (
       insert into ticket_charges (job_id, item, description, qty, rate, kind, source_key, sort)
       select j.id, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, nullif(btrim(t.source_key), ''), t.ord
         from j
         cross join unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::text[], $12::text[]) with ordinality
              as t(item, description, qty, rate, kind, source_key, ord)
       returning ticket_charges.id
     )
     update service_jobs s
        set po = $9, discount_kind = $10, discount_value = $11, updated_at = now()
       from j
      where s.id = j.id
     returning s.id`;
}

/**
 * The Admin's save on an unlocked, invoiced ticket: the same lines, P.O. and discount as replaceTicketChargesSql, plus
 * the Sales Order ($13) and its billed date ($14, else kept when the SO is unchanged, else now). The Sales Order is
 * kept, not cleared, so the lines change on a billed ticket. The unlock is cleared in the same statement, so saving
 * locks the ticket again. Nothing is written when the unlock has run out.
 */
export function replaceUnlockedChargesSql(): string {
  return `with j as (
       select s.id
         from service_jobs s
        where s.id = $1
          and s.duplicate_of is null
          and ${UNLOCKED_SQL("s")}
          and ($7::boolean or coalesce((select array_agg(c.id order by c.id) from ticket_charges c where c.job_id = s.id), '{}') = $8::int[])
        for update
     ), d as (
       delete from ticket_charges c using j where c.job_id = j.id
     ), ins as (
       insert into ticket_charges (job_id, item, description, qty, rate, kind, source_key, sort)
       select j.id, t.item, nullif(t.description, ''), t.qty, t.rate, t.kind, nullif(btrim(t.source_key), ''), t.ord
         from j
         cross join unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::text[], $12::text[]) with ordinality
              as t(item, description, qty, rate, kind, source_key, ord)
       returning ticket_charges.id
     )
     update service_jobs s
        set po = $9, discount_kind = $10, discount_value = $11,
            ns_so = $13::text,
            billed_at = case
              when $13::text is null then null
              when $14::date is not null then ($14::date)::timestamp at time zone 'America/Chicago'
              when nullif(btrim(s.ns_so), '') is not distinct from $13::text then s.billed_at
              else now()
            end,
            billing_unlocked_at = null, billing_unlocked_by = null, billing_unlock_reason = null,
            updated_at = now()
       from j
      where s.id = j.id
     returning s.id`;
}

/**
 * Replace a ticket's charge lines (and P.O. and discount when given). One path for the Charges panel and the
 * Invoice window, so both write the same lines the same way. A billed ticket is not changed.
 * po undefined keeps the stored P.O.; discount undefined keeps the stored discount, null clears it.
 */
export async function writeTicketCharges(
  sql: Sql,
  jobId: number,
  userId: string,
  input: {
    po?: string;
    lines: ChargeLinesInput;
    discount?: DiscountInput;
    lineIds?: number[];
    /**
     * The Admin's save on an unlocked, invoiced ticket (the caller checks the Admin): the Sales Order and its billed
     * date are saved with the lines, and the ticket locks again.
     */
    unlocked?: { nsSo: string | null; billedAt: string | null };
  },
): Promise<void> {
  const merged = (await sql.query<{ duplicate_of: number | null }>("select duplicate_of from service_jobs where id = $1", [jobId]))[0];
  if (merged?.duplicate_of) throw new Error(`This ticket was merged into #${merged.duplicate_of}. Add charges there.`);
  const cur = await loadCharges(sql, jobId);
  const unlocked = input.unlocked ?? null;
  if (unlocked) {
    if (!cur.invoiceLock) throw new Error("This ticket has no live NetSuite invoice, so it isn't locked. Save the charges as usual.");
    if (!cur.unlock) throw new Error("The unlock ran out or was closed. Unlock the ticket again to save.");
  } else {
    if (cur.invoiceLock) throw new Error(invoiceLockError(cur.invoiceLock));
    if (cur.state === "billed") throw new Error(`This ticket is already billed on ${cur.nsSo}. Clear the Sales Order number to change the charges.`);
  }
  const problems = checkCharges(input.lines);
  if (problems.length) throw new Error(`Line ${problems[0].index + 1}: ${problems[0].message}`);
  // Left out = keep what is saved. Null or blank = no discount. Stored as the choice, never as a discounted total.
  const typed = input.discount === undefined ? { discount: cur.discount } : input.discount === null ? { discount: null } : cleanDiscount(input.discount.kind, input.discount.value);
  if ("error" in typed) throw new Error(typed.error);

  const items = input.lines.map((l) => l.item.trim());
  const kinds = new Map<string, ChargeKind>();
  if (items.length) {
    const known = await sql.query<{ item: string; kind: ChargeKind }>(
      "select item, kind from billing_items where lower(btrim(item)) = any($1::text[])",
      [items.map((i) => i.toLowerCase())],
    );
    for (const k of known) kinds.set(k.item.trim().toLowerCase(), k.kind);
  }
  const lines = input.lines.map((l, i) => ({
    item: items[i],
    description: l.description.trim(),
    qty: cleanQty(l.qty)!,
    rate: cleanRate(l.rate)!,
    kind: kinds.get(items[i].toLowerCase()) ?? kindForItem(items[i]),
    sourceKey: String(l.sourceKey ?? "").trim(),
  }));
  const checkIds = input.lineIds != null;
  const lineIds = input.lineIds == null ? [] : [...input.lineIds].map(Number).sort((a, b) => a - b);
  const po = input.po === undefined ? cur.po.trim() || null : input.po.trim() || null;

  // One statement: the ticket is locked, and the old lines, the new lines, and the P.O. change together or not at all.
  const params = [
    jobId,
    lines.map((l) => l.item),
    lines.map((l) => l.description),
    lines.map((l) => l.qty),
    lines.map((l) => l.rate),
    lines.map((l) => l.kind),
    !checkIds,
    lineIds,
    po,
    typed.discount?.kind ?? null,
    typed.discount?.value ?? null,
    lines.map((l) => l.sourceKey),
  ];
  const so = unlocked ? cleanSalesOrder(unlocked.nsSo) : null;
  const saved = unlocked
    ? await sql.query<{ id: number }>(replaceUnlockedChargesSql(), [...params, so, unlocked.billedAt || null])
    : await sql.query<{ id: number }>(replaceTicketChargesSql(), params);
  if (!saved[0]) {
    const row = (await sql.query<{ duplicate_of: number | null; ns_so: string | null }>("select duplicate_of, ns_so from service_jobs where id = $1", [jobId]))[0];
    if (row?.duplicate_of) throw new Error(`This ticket was merged into #${row.duplicate_of}. Add charges there.`);
    const now = await loadCharges(sql, jobId);
    if (unlocked && !now.unlock) throw new Error("The unlock ran out or was closed. Unlock the ticket again to save.");
    if (!unlocked && now.invoiceLock) throw new Error(invoiceLockError(now.invoiceLock));
    const billedOn = String(row?.ns_so ?? "").trim();
    if (!unlocked && billedOn) throw new Error(`This ticket is already billed on ${billedOn}. Clear the Sales Order number to change the charges.`);
    throw new Error("These charges changed since you opened them. Reload and try again.");
  }
  const after = applyDiscount(chargesTotal(lines), typed.discount);
  const summary = `${lines.length} line${lines.length === 1 ? "" : "s"}, $${after.subtotal.toFixed(2)}${typed.discount ? `, ${discountLabel(typed.discount)} ($${after.off.toFixed(2)}), total $${after.total.toFixed(2)}` : ""}`;
  await logJob(
    sql,
    jobId,
    userId,
    unlocked
      ? `charges saved while unlocked (Admin): ${summary}${so ? ` · Sales Order ${so}` : " · no Sales Order"} · locked again`
      : `charges: ${summary}`,
  );
}

function invoiceLockError(lock: { invoice: string; status: string }): string {
  return `This ticket is invoiced on ${lock.invoice} (${lock.status}). Its charges, P.O., discount and Sales Order are locked. An Admin can unlock it.`;
}

/** A ticket's charges as the Invoice window reads them (no cost or margin). */
export async function loadTicketCharges(sql: Sql, jobId: number): Promise<TicketCharges> {
  return loadCharges(sql, jobId);
}

/** Replace the charge lines and P.O. on a ticket. A ticket that is already billed is not changed. */
export const saveTicketCharges = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number; po: string; lines: z.input<typeof lineSchema>[]; lineIds: number[]; discount?: { kind: string; value: string | number } | null }) =>
    z
      .object({
        jobId: z.number().int().positive(),
        po: z.string().max(120),
        lines: z.array(lineSchema).max(200),
        lineIds: z.array(z.number().int().positive()).max(200),
        discount: z.object({ kind: z.string().max(20), value: z.union([z.number(), z.string().max(40)]) }).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TicketCharges> => {
    const sql = await ready();
    await writeTicketCharges(sql, data.jobId, context.userId, { po: data.po, lines: data.lines, lineIds: data.lineIds, discount: data.discount });
    return loadCharges(sql, data.jobId, await canReviewNames(sql, context.userId));
  });

/**
 * The Admin's one save on an unlocked, invoiced ticket: lines, P.O., discount, Sales Order and its billed date
 * together, in one statement, and the ticket locks again.
 */
export const saveUnlockedBilling = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(
    (d: {
      jobId: number;
      po: string;
      lines: z.input<typeof lineSchema>[];
      lineIds: number[];
      discount?: { kind: string; value: string | number } | null;
      nsSo: string | null;
      billedAt?: string | null;
    }) =>
      z
        .object({
          jobId: z.number().int().positive(),
          po: z.string().max(120),
          lines: z.array(lineSchema).max(200),
          lineIds: z.array(z.number().int().positive()).max(200),
          discount: z.object({ kind: z.string().max(20), value: z.union([z.number(), z.string().max(40)]) }).nullable().optional(),
          nsSo: z.string().max(40).nullable(),
          billedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<TicketCharges> => {
    const sql = await ready();
    if (!(await canReviewNames(sql, context.userId))) throw new Error("Only an Admin can save an unlocked ticket.");
    await writeTicketCharges(sql, data.jobId, context.userId, {
      po: data.po,
      lines: data.lines,
      lineIds: data.lineIds,
      discount: data.discount,
      unlocked: { nsSo: data.nsSo, billedAt: data.billedAt ?? null },
    });
    // Still billed (its invoice stands), so the new lines get their cost and margin stored like any billed ticket.
    await storeInvoicedProfit(sql, data.jobId, true);
    return loadCharges(sql, data.jobId, true);
  });

/**
 * Record or clear the NetSuite Sales Order. Setting a number on a merged ticket is refused; clearing is allowed.
 * billedAt (YYYY-MM-DD, the SO or invoice date) dates it; without one it is dated now. A ticket with a live NetSuite
 * invoice is locked: its Sales Order changes only through an Admin's unlock.
 */
export async function recordTicketSalesOrder(sql: Sql, jobId: number, userId: string, nsSo: string | null, billedAt: string | null = null): Promise<void> {
  const so = cleanSalesOrder(nsSo);
  const saved = await sql.query<{ id: number }>(
    `update service_jobs
        set ns_so = $2,
            billed_at = case when $2::text is null then null
                             when $3::date is not null then ($3::date)::timestamp at time zone 'America/Chicago'
                             else now() end,
            updated_at = now()
      where id = $1 and ($2::text is null or duplicate_of is null)
        and not ${LIVE_INVOICE_SQL("service_jobs.id")}
        and ${UNCHANGED_SINCE_READ("service_jobs", "$1")}
      returning id`,
    [jobId, so, billedAt || null],
  );
  if (!saved[0]) {
    const dup = (await sql.query<{ duplicate_of: number | null }>("select duplicate_of from service_jobs where id = $1", [jobId]))[0];
    if (!dup) throw new Error("That ticket is no longer on the list.");
    if (so && dup.duplicate_of) throw new Error(`This ticket was merged into #${dup.duplicate_of}. Enter the Sales Order there.`);
    const lock = (await loadCharges(sql, jobId)).invoiceLock;
    if (lock) throw new Error(invoiceLockError(lock));
    throw new Error("The ticket changed while saving (another save or the Billing Backfill). Reload and try again.");
  }
  await logJob(sql, jobId, userId, so ? `billed on ${so}${billedAt ? ` (dated ${billedAt})` : ""}` : "cleared Sales Order number");
  await storeInvoicedProfit(sql, jobId, !!so);
}

/** Record the NetSuite Sales Order the billing script made for this ticket. Blank clears it. */
export const setTicketSalesOrder = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number; nsSo: string | null; billedAt?: string | null }) =>
    z
      .object({
        jobId: z.number().int().positive(),
        nsSo: z.string().max(40).nullable(),
        billedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<TicketCharges> => {
    const sql = await ready();
    await recordTicketSalesOrder(sql, data.jobId, context.userId, data.nsSo, data.billedAt ?? null);
    return loadCharges(sql, data.jobId, await canReviewNames(sql, context.userId));
  });

// ---- Item list and price import (Admin) ----------------------------------------------------------------

export type ItemImportStatus = "new" | "price" | "other" | "missing" | "hidden";

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
  /** Hidden parts in the file. They are not updated and not un-hidden. */
  hiddenSkipped: number;
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
  hidden: boolean;
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
    for (const r of await sql.query<StoredItem>("select sku, parent, description, rate, cost, mfr_part, active, (hidden_at is not null) as hidden from billing_items")) {
      have.set(r.sku.trim().toLowerCase(), { ...r, hidden: flagOn(r.hidden) });
    }

    type Planned = { row: (typeof rows)[number]; status: ItemImportStatus | "same"; change: PriceChange | null };
    const planned: Planned[] = rows.map((row) => {
      const e = have.get(row.sku.toLowerCase());
      if (!e) return { row, status: columns.description ? "new" : "missing", change: priceChange(null, row.rate) };
      if (e.hidden) return { row, status: "hidden", change: null };
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
    const order: Record<string, number> = { price: 1, new: 2, other: 3, hidden: 4, missing: 5, same: 9 };
    const preview: ItemImportPreview = {
      total: rows.length,
      added: n("new"),
      priceChanged: n("price"),
      otherChanged: n("other"),
      same: n("same"),
      notFound: n("missing"),
      hiddenSkipped: n("hidden"),
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
        where lower(btrim(b.sku)) = lower(btrim(s.sku)) and b.hidden_at is null`,
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
  /** The tickets' totals after their discounts. */
  total: number;
  includeBilled: boolean;
  /** Completed tickets in the window with nothing on them — usually a missed bill. Every one (the window pages them). */
  noCharges: { id: number; kind: string; wo: string | null; customer: string | null; completed: string | null; technician: string | null }[];
  /** Tickets in the file whose NetSuite location breaks the warehouse rule (Lance: San Antonio WH, Bill: Dallas WH). */
  locationWarnings: { id: number; wo: string | null; customer: string | null; warning: string }[];
  /** How many tickets in the file each warehouse rule sets the location for. */
  locationRules: { location: string; tickets: number }[];
  /** Tickets with charges left out of the file: on Walk-In or with no account, which is never a billing account. */
  noAccount: { id: number; wo: string | null; customer: string | null; completed: string | null }[];
};

/**
 * Charges ready to hand to billing, as one CSV. Only tickets with a completed date in the window and charges. Not yet
 * billed (no Sales Order and no live NetSuite invoice) unless includeBilled. The discount is NetSuite's header
 * discount on every row (Discount Item CLDSERVICE, Discount Rate at minus the dollars), never a discount line. Each
 * row also carries the ticket's SO, its NetSuite invoices, and the location it bills from (the location on its latest
 * invoice, else Lance's San Antonio WH or Bill's Dallas WH).
 */
export async function exportBillingFor(sql: Sql, data: { from: string; to: string; includeBilled?: boolean }): Promise<BillingExport> {
  const billed = data.includeBilled ? "" : `and nullif(btrim(j.ns_so), '') is null and not ${LIVE_INVOICE_SQL("j.id")}`;
  const found = await sql.query<{
    id: number;
    wo: string | null;
    po: string | null;
    ns_so: string | null;
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
    `select j.id, j.wo, j.po, j.ns_so, j.customer, j.technician, to_char(j.completed_at, 'YYYY-MM-DD') as completed_at, j.work_done,
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
  // Walk-In (or no account) is never a billing account: those tickets stay out of the file and are listed (10/28 review).
  const noAccount = new Map<number, { id: number; wo: string | null; customer: string | null; completed: string | null }>();
  const rows = found.filter((r) => {
    if (r.customer?.trim() && !isWalkIn(r.customer)) return true;
    const id = Number(r.id);
    if (!noAccount.has(id)) noAccount.set(id, { id, wo: r.wo, customer: r.customer, completed: r.completed_at });
    return false;
  });
  const ids = [...new Set(rows.map((r) => Number(r.id)))];
  const discounts = new Map<number, Discount>();
  if (ids.length) {
    for (const d of await sql.query<{ id: number; discount_kind: string | null; discount_value: string | null }>(
      "select id, discount_kind, discount_value from service_jobs where id = any($1::int[]) and discount_kind is not null",
      [ids],
    )) {
      if (isDiscountKind(d.discount_kind) && Number(d.discount_value) > 0) discounts.set(Number(d.id), { kind: d.discount_kind, value: Number(d.discount_value) });
    }
  }
  const invoices = await loadInvoices(sql, ids.length ? ids : [0]);
  const byJob = new Map<number, { so: string; invoices: string; location: string; warning: string | null }>();
  for (const r of rows) {
    const id = Number(r.id);
    if (byJob.has(id)) continue;
    const mine = invoices.get(id) ?? [];
    const recorded = [...liveInvoices(mine)].reverse().find((i) => i.location?.trim())?.location?.trim() ?? "";
    byJob.set(id, {
      so: r.ns_so?.trim() ?? "",
      invoices: mine.map((i) => `${i.invoice} ${i.status}`).join("; "),
      location: recorded || warehouseForTech(r.technician) || "",
      warning: recorded ? locationWarning(r.technician, recorded) : null,
    });
  }
  const lines: BillingExportLine[] = withHeaderDiscount(
    rows.map((r) => ({
      jobId: Number(r.id),
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
    })),
    discounts,
  ).map(({ jobId, discountLabel: _label, ...l }) => {
    const j = byJob.get(jobId)!;
    return { ...l, so: j.so, invoices: j.invoices, location: j.location };
  });
  const none = await sql.query<{ id: number; kind: string; wo: string | null; customer: string | null; completed: string | null; technician: string | null }>(
    `select j.id, j.kind, j.wo, j.customer, to_char(j.completed_at, 'YYYY-MM-DD') as completed, j.technician
       from service_jobs j
      where j.duplicate_of is null and j.completed_at between $1::date and $2::date
        and nullif(btrim(j.ns_so), '') is null and not ${LIVE_INVOICE_SQL("j.id")}
        and not exists (select 1 from ticket_charges c where c.job_id = j.id)
      order by j.completed_at, j.id`,
    [data.from, data.to],
  );
  const rules = new Map<string, number>();
  for (const id of byJob.keys()) {
    const tech = rows.find((r) => Number(r.id) === id)?.technician;
    const rule = warehouseForTech(tech);
    if (rule) rules.set(rule, (rules.get(rule) ?? 0) + 1);
  }
  // What will be billed: each ticket's lines after its discount.
  const net = ids.reduce((sum, id) => {
    const sub = chargesTotal(rows.filter((r) => Number(r.id) === id).map((r) => ({ qty: Number(r.qty), rate: Number(r.rate) })));
    return sum + applyDiscount(sub, discounts.get(id)).total;
  }, 0);
  return {
    csv: billingCsv(lines),
    tickets: ids.length,
    lines: lines.length,
    total: round2(net),
    includeBilled: !!data.includeBilled,
    noCharges: none.map((r) => ({ ...r, id: Number(r.id) })),
    locationWarnings: [...byJob]
      .filter(([, j]) => j.warning)
      .map(([id, j]) => {
        const r = rows.find((x) => Number(x.id) === id)!;
        return { id, wo: r.wo, customer: r.customer, warning: j.warning! };
      }),
    locationRules: [...rules].map(([location, tickets]) => ({ location, tickets })),
    noAccount: [...noAccount.values()],
  };
}

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
  .handler(async ({ data }): Promise<BillingExport> => exportBillingFor(await ready(), data));
