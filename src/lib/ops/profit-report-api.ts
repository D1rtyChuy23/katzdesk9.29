/**
 * The Profit report (Chuy, 11/20): revenue, cost and margin of every billed job, by job type and by customer, for a date
 * range, with downloads. For an Admin, or a role ticked in Settings → Who Sees Cost and Margin (labor only with its
 * switch on). Each bill counts once:
 *   * a ticket once its Sales Order or a NetSuite invoice is in, as Parts Profit counts it (a ticket merged into an
 *     install as billed counts on its own; one merged into another ticket doesn't);
 *   * a PM, install, rebuild or deal invoice once approved (a PM billed on a ticket has none; a rebuild billed on a ticket
 *     or install has its lines there);
 *   * an install's or PM's NetSuite lines from Billing Backfill, which stand in for its own approved invoice when it has
 *     both: they're what was billed.
 * Before 2026 a bill counts as sell with no cost; a 2026 line not stored when billed is priced live ("estimated").
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware, isWarehouseOnly } from "@/lib/ops/access";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { loadDiscountRule } from "@/lib/ops/discount-rule";
import { loadLaborRate } from "@/lib/ops/labor-cost";
import { formatNowChicago, todayChicago } from "@/lib/ops/clock";
import { EXPORT_FORMATS, reportSheets, type ExportFormat } from "@/lib/ops/analytics";
import { ticketProfitBills } from "@/lib/ops/charges-api";
import { costView } from "@/lib/ops/cost-access";
import { discountFromRow } from "@/lib/ops/discount";
import { billProfit, type LineCostTable } from "@/lib/ops/line-cost";
import { discountShares, type BillProfitTotals } from "@/lib/ops/part-pricing";
import { COSTED_FROM, JOB_TYPES, buildProfitReportFile, groupBy, groupTotals, historySection, profitReportFileName, type GroupTotals, type HistoryBill, type HistorySection, type ProfitBill } from "@/lib/ops/profit-report";
import { historyInvoiceCost } from "@/lib/ops/wo-history";
import { LIVE_INVOICE_SQL } from "@/lib/ops/billing-rules";
import { BILLED_ON_INSTALL } from "@/lib/ops/merged-ticket";
import { isServiceDeptAccount } from "@/lib/ops/warehouse-invoice";
import { reportDocx, reportPdf } from "@/lib/ops/report-files";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const filterInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
type Filters = z.infer<typeof filterInput>;

export type ProfitReport = {
  byType: (GroupTotals & { key: string })[];
  byCustomer: (GroupTotals & { key: string; label: string })[];
  totals: GroupTotals;
  scope: string;
  /** Labor is left out for this person (the labor switch is off). */
  laborHidden: boolean;
  /** QuickBooks history (2024–2026), its own section: never in byType, byCustomer or totals. */
  history: HistorySection;
};

export const REFUSED = "Profit shows cost and margin, so it's for Admins and the roles ticked in Settings → Who Sees Cost and Margin.";

/** Who gets the Profit reports: whoever sees cost, but never Warehouse, which doesn't read customers' billing. */
export async function costVisibilityFor(sql: Sql, userId: string): Promise<{ showCost: boolean; showReports: boolean }> {
  const v = await costView(sql, userId);
  return { showCost: v.showCost, showReports: v.showCost && !(await isWarehouseOnly(sql, userId)) };
}

async function viewOf(sql: Sql, userId: string) {
  if (!(await costVisibilityFor(sql, userId)).showReports) throw new Error(REFUSED);
  const v = await costView(sql, userId);
  return { admin: await canReviewNames(sql, userId), showLabor: v.showLabor };
}

function asBill(type: string, customer: string, date: string, t: BillProfitTotals, estimated: boolean): ProfitBill {
  const before2026 = date < COSTED_FROM;
  return {
    type,
    customer: customer.trim(),
    customerKey: normalizeCustomerKey(customer),
    date,
    sell: t.sell,
    discount: t.ticketDiscount,
    cost: before2026 ? 0 : t.cost,
    margin: before2026 ? null : t.margin,
    estimated: !before2026 && estimated,
    before2026,
  };
}

async function recordBills(sql: Sql, f: Filters, view: { admin: boolean; showLabor: boolean }): Promise<ProfitBill[]> {
  const range = [f.from ?? null, f.to ?? null];
  // An install's or PM's NetSuite lines, when it has any, stand in for its own invoice.
  const NS_HAS = `exists (select 1 from record_ns_billing b join record_ns_charges c on c.billing_id = b.id
                           where (v.entity_type = 'install' and b.install_id = v.entity_id) or (v.entity_type = 'pm' and b.pm_id = v.entity_id))`;
  const invoices = await sql.query<{ id: number; type: string; customer: string | null; day: string; dk: string | null; dv: string | null; ds: string | null }>(
    `select v.id, v.entity_type as type,
            -- The record's customer as it is now (a rename updates the records, not the invoice's copy).
            coalesce(nullif(btrim(case v.entity_type
                       when 'pm' then (select m.customer from pm_jobs m where m.id = v.entity_id)
                       when 'install' then (select i.customer from installs i where i.id = v.entity_id)
                       when 'deal' then (select d.customer from deals d where d.id = v.entity_id)
                       when 'rebuild' then (select r.account from rebuilds r where r.id = v.entity_id) end), ''),
                     nullif(btrim(v.customer), ''), nullif(btrim(v.bill_name), ''), '') as customer,
            to_char((v.approved_at at time zone 'America/Chicago')::date, 'YYYY-MM-DD') as day, v.discount_kind as dk, v.discount_value::text as dv, v.discount_scope as ds
       from invoices v
      where v.approved_at is not null and v.entity_type in ('pm', 'install', 'rebuild', 'deal')
        and exists (select 1 from invoice_lines l where l.invoice_id = v.id)
        and not ${NS_HAS}
        -- Merged into another install (archived with duplicate_of). An install only flagged as a possible duplicate counts.
        and not (v.entity_type = 'install' and exists (select 1 from installs i where i.id = v.entity_id and i.archived and i.duplicate_of is not null))
        and not (v.entity_type = 'pm' and exists (select 1 from pm_jobs m where m.id = v.entity_id and m.stacked_job_id is not null))
        and ($1::date is null or (v.approved_at at time zone 'America/Chicago')::date >= $1::date)
        and ($2::date is null or (v.approved_at at time zone 'America/Chicago')::date <= $2::date)
      order by v.id`,
    range,
  );
  const ns = await sql.query<{ id: number; type: string; customer: string | null; day: string | null; dk: string | null; dv: string | null }>(
    `select b.id, case when b.install_id is not null then 'install' else 'pm' end as type,
            coalesce(i.customer, m.customer, '') as customer,
            -- Billed, else its first NetSuite invoice, else when the backfill wrote it: every NetSuite bill has a day, so it
            -- never hides the record's own invoice and then drops out itself (review, 11/20).
            to_char(coalesce((b.billed_at at time zone 'America/Chicago')::date,
                             (select min(x.invoice_date) from record_ns_invoices x where x.wo_key = b.wo_key
                                 and ((b.install_id is not null and x.install_id = b.install_id) or (b.pm_id is not null and x.pm_id = b.pm_id))),
                             (b.updated_at at time zone 'America/Chicago')::date), 'YYYY-MM-DD') as day,
            b.discount_kind as dk, b.discount_value::text as dv
       from record_ns_billing b
       left join installs i on i.id = b.install_id
       left join pm_jobs m on m.id = b.pm_id
      where exists (select 1 from record_ns_charges c where c.billing_id = b.id)
        and (i.id is null or not (i.archived and i.duplicate_of is not null))
        and (m.id is null or m.stacked_job_id is null)
      order by b.id`,
  );
  const out: ProfitBill[] = [];
  const cache = { rule: await loadDiscountRule(sql), laborRate: await loadLaborRate(sql) };
  const add = async (table: LineCostTable, id: number, type: string, customer: string, day: string, d: ReturnType<typeof discountFromRow>) => {
    const p = await billProfit(sql, table, id, d, view.admin, view.showLabor, cache);
    out.push(asBill(type, customer, day, p.totals, p.profit.some((x) => x != null && !x.stored)));
  };
  for (const v of invoices) await add("invoice_lines", Number(v.id), v.type, v.customer ?? "", v.day, discountFromRow(v.dk, v.dv, v.ds));
  for (const b of ns) {
    if (!b.day) continue;
    if ((f.from && b.day < f.from) || (f.to && b.day > f.to)) continue;
    await add("record_ns_charges", Number(b.id), b.type, b.customer ?? "", b.day, discountFromRow(b.dk, b.dv));
  }
  return out;
}

/**
 * The QuickBooks history section (Jesus, 11/24): each Work Order History invoice in the range (its invoice date, else
 * completed), with the parts cost the line-cost import filled. Leaves out Service Dept, and any work order whose
 * ticket already counts in this report as a billed ticket, so nothing is counted twice.
 */
export async function historyProfitSection(sql: Sql, f: Filters, opts: { laborHidden?: boolean } = {}): Promise<HistorySection> {
  const DAY = "coalesce(h.invoice_date, h.completed::date)";
  // Tickets that count as billed tickets in this report on any dates (the same rule as ticketProfitBills, without the
  // range), so a work order and its ticket billed on either side of a range edge never both count (review, 11/24).
  const billed = await sql.query<{ id: number }>(
    `select j.id from service_jobs j
      where j.id in (select h.job_id from wo_history h where h.job_id is not null)
        and (j.ns_so is not null or ${LIVE_INVOICE_SQL("j.id")})
        and (j.duplicate_of is null or ${BILLED_ON_INSTALL("j.id")} is not null)
        and exists (select 1 from ticket_charges c where c.job_id = j.id)`,
  );
  const billedTickets = new Set(billed.map((r) => Number(r.id)));
  const rows = await sql.query<{ id: number; customer: string; job_id: number | null; day: string | null }>(
    `select h.id, h.customer, h.job_id, to_char(${DAY}, 'YYYY-MM-DD') as day
       from wo_history h
      where exists (select 1 from wo_history_lines l where l.history_id = h.id)
        and ($1::date is null or ${DAY} >= $1::date)
        and ($2::date is null or ${DAY} <= $2::date)
      order by h.id`,
    [f.from ?? null, f.to ?? null],
  );
  const lines = await sql.query<{ history_id: number; kind: string; amount: string | null; line_cost: string | null }>(
    `select l.history_id, l.kind, l.amount::text as amount, l.line_cost::text as line_cost
       from wo_history_lines l join wo_history h on h.id = l.history_id
      where ($1::date is null or ${DAY} >= $1::date)
        and ($2::date is null or ${DAY} <= $2::date)
      order by l.history_id, l.sort, l.id`,
    [f.from ?? null, f.to ?? null],
  );
  const num = (v: string | null) => (v == null ? null : Number(v));
  const byId = new Map<number, { kind: string; amount: number | null; lineCost: number | null }[]>();
  for (const l of lines) {
    const id = Number(l.history_id);
    byId.set(id, [...(byId.get(id) ?? []), { kind: l.kind, amount: num(l.amount), lineCost: num(l.line_cost) }]);
  }
  const bills: HistoryBill[] = [];
  const excluded = { serviceDept: 0, billedTicket: 0 };
  for (const r of rows) {
    if (isServiceDeptAccount(r.customer)) {
      excluded.serviceDept += 1;
      continue;
    }
    if (r.job_id != null && billedTickets.has(Number(r.job_id))) {
      excluded.billedTicket += 1;
      continue;
    }
    // The discount from its Discount lines, as the invoice panel shows it (a positive number).
    const own = byId.get(Number(r.id)) ?? [];
    let discount = Math.round(-own.filter((l) => l.kind === "discount").reduce((n, l) => n + (l.amount ?? 0), 0) * 100) / 100;
    let kept = own;
    if (opts.laborHidden) {
      // As billProfitTotals(..., hideLabor) does for tickets: labor's sell and its share of the discount come out, so
      // nothing about labor can be worked out. Trip lines stay, as there (it drops only kind labor).
      const items = own.filter((l) => l.kind !== "discount");
      const shares = discountShares(items.map((l) => l.amount ?? 0), discount);
      const laborOff = items.reduce((n, l, i) => n + (l.kind === "labor" ? (shares[i] ?? 0) : 0), 0);
      discount = Math.round((discount - laborOff) * 100) / 100;
      kept = own.filter((l) => l.kind !== "labor");
    }
    const c = historyInvoiceCost(kept, discount);
    bills.push({ year: r.day ? r.day.slice(0, 4) : "", customer: r.customer.trim(), customerKey: normalizeCustomerKey(r.customer), sell: c.subtotal, discount, cost: c.cost, partial: c.partial, profit: c.profit });
  }
  return historySection(bills, excluded, { laborHidden: opts.laborHidden });
}

const niceDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The body of getProfitReport. */
export async function profitReportFor(sql: Sql, f: Filters, userId: string): Promise<ProfitReport> {
  const view = await viewOf(sql, userId);
  const tickets = await ticketProfitBills(sql, { from: f.from ?? null, to: f.to ?? null }, { showCost: true, ...view });
  const bills = [...tickets.map((t) => asBill(t.kind === "tlc" ? "tlc" : "service", t.customer, t.date, t.totals, t.estimated)), ...(await recordBills(sql, f, view))];
  const totals = groupTotals(bills);
  const laborHidden = !view.admin && !view.showLabor;
  const range = f.from && f.to ? `${niceDay(f.from)} to ${niceDay(f.to)}` : f.from ? `From ${niceDay(f.from)}` : f.to ? `Through ${niceDay(f.to)}` : "All dates";
  const notes = [
    `${totals.bills} bill${totals.bills === 1 ? "" : "s"}`,
    totals.before2026 ? `${totals.before2026} before 2026 counted as sell with no cost` : null,
    totals.estimated ? `${totals.estimated} estimated: priced from today's cost and rate` : null,
    laborHidden ? "labor not shown" : null,
    "a PM billed on a ticket counts with the ticket",
  ].filter(Boolean);
  // The history section follows the same labor switch as the rest of Profit (Jesus, 11/24).
  const history = await historyProfitSection(sql, f, { laborHidden });
  return {
    byType: groupBy(bills, (b) => b.type, JOB_TYPES.map((t) => t.key)),
    byCustomer: groupBy(bills, (b) => b.customerKey, undefined, (b) => b.customer),
    totals,
    scope: `${range} · ${notes.join(" · ")}`,
    laborHidden,
    history,
  };
}

export const getProfitReport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: Filters) => filterInput.parse(d))
  .handler(async ({ data, context }): Promise<ProfitReport> => profitReportFor(await ready(), data, context.userId));

/** The body of downloadProfitReport: the same report as a PDF, Excel or Word file. */
export async function profitReportFileFor(sql: Sql, data: { filters: Filters; format: ExportFormat }, userId: string): Promise<{ filename: string; mime: string; base64: string; records: number }> {
  const r = await profitReportFor(sql, data.filters, userId);
  const report = buildProfitReportFile(r, { generated: formatNowChicago().stamp, scope: `${r.scope}. QuickBooks history: ${r.history.note}` });
  const filename = profitReportFileName(todayChicago(), data.format);
  const mime = EXPORT_FORMATS.find((x) => x.format === data.format)!.mime;
  const records = report.records.rows.length;
  if (data.format === "pdf") return { filename, mime, base64: Buffer.from(reportPdf(report)).toString("base64"), records };
  if (data.format === "docx") {
    const { deflateRawSync } = await import("node:zlib");
    return { filename, mime, base64: Buffer.from(reportDocx(report, (d) => new Uint8Array(deflateRawSync(d)))).toString("base64"), records };
  }
  const wb = XLSX.utils.book_new();
  for (const s of reportSheets(report)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name.slice(0, 31));
  return { filename, mime, base64: XLSX.write(wb, { type: "base64", bookType: "xlsx" }), records };
}

export const downloadProfitReport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filters: Filters; format: ExportFormat }) => z.object({ filters: filterInput, format: z.enum(["pdf", "xlsx", "docx"]) }).parse(d))
  .handler(async ({ data, context }) => profitReportFileFor(await ready(), data, context.userId));

/** Whether this person sees cost and margin, so Analytics knows to offer Profit and Parts Profit. */
export const getCostVisibility = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ showCost: boolean; showReports: boolean }> => costVisibilityFor(await ready(), context.userId));
