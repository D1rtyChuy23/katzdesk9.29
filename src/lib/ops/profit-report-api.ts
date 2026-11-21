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
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { formatNowChicago, todayChicago } from "@/lib/ops/clock";
import { EXPORT_FORMATS, reportSheets, type ExportFormat } from "@/lib/ops/analytics";
import { ticketProfitBills } from "@/lib/ops/charges-api";
import { costView } from "@/lib/ops/cost-access";
import { discountFromRow } from "@/lib/ops/discount";
import { billProfit, type LineCostTable } from "@/lib/ops/line-cost";
import type { BillProfitTotals } from "@/lib/ops/part-pricing";
import { COSTED_FROM, JOB_TYPES, buildProfitReportFile, groupBy, groupTotals, profitReportFileName, type GroupTotals, type ProfitBill } from "@/lib/ops/profit-report";
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
  byCustomer: (GroupTotals & { key: string })[];
  totals: GroupTotals;
  scope: string;
  /** Labor is left out for this person (the labor switch is off). */
  laborHidden: boolean;
};

export const REFUSED = "Profit shows cost and margin, so it's for Admins and the roles ticked in Settings → Who Sees Cost and Margin.";

async function viewOf(sql: Sql, userId: string) {
  const v = await costView(sql, userId);
  if (!v.showCost) throw new Error(REFUSED);
  return { admin: await canReviewNames(sql, userId), showLabor: v.showLabor };
}

function asBill(type: string, customer: string, date: string, t: BillProfitTotals, estimated: boolean): ProfitBill {
  const before2026 = date < COSTED_FROM;
  return {
    type,
    customer: customer.trim(),
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
    `select v.id, v.entity_type as type, coalesce(nullif(btrim(v.customer), ''), nullif(btrim(v.bill_name), ''), '') as customer,
            to_char(v.approved_at::date, 'YYYY-MM-DD') as day, v.discount_kind as dk, v.discount_value::text as dv, v.discount_scope as ds
       from invoices v
      where v.approved_at is not null and v.entity_type in ('pm', 'install', 'rebuild', 'deal')
        and exists (select 1 from invoice_lines l where l.invoice_id = v.id)
        and not ${NS_HAS}
        and not (v.entity_type = 'install' and exists (select 1 from installs i where i.id = v.entity_id and i.duplicate_of is not null))
        and not (v.entity_type = 'pm' and exists (select 1 from pm_jobs m where m.id = v.entity_id and m.stacked_job_id is not null))
        and ($1::date is null or v.approved_at::date >= $1::date)
        and ($2::date is null or v.approved_at::date <= $2::date)
      order by v.id`,
    range,
  );
  const ns = await sql.query<{ id: number; type: string; customer: string | null; day: string | null; dk: string | null; dv: string | null }>(
    `select b.id, case when b.install_id is not null then 'install' else 'pm' end as type,
            coalesce(i.customer, m.customer, '') as customer,
            to_char(coalesce(b.billed_at, (select min(x.invoice_date) from record_ns_invoices x where x.wo_key = b.wo_key
                       and ((b.install_id is not null and x.install_id = b.install_id) or (b.pm_id is not null and x.pm_id = b.pm_id))))::date, 'YYYY-MM-DD') as day,
            b.discount_kind as dk, b.discount_value::text as dv
       from record_ns_billing b
       left join installs i on i.id = b.install_id
       left join pm_jobs m on m.id = b.pm_id
      where exists (select 1 from record_ns_charges c where c.billing_id = b.id)
        and (i.id is null or i.duplicate_of is null)
        and (m.id is null or m.stacked_job_id is null)
      order by b.id`,
  );
  const out: ProfitBill[] = [];
  const add = async (table: LineCostTable, id: number, type: string, customer: string, day: string, d: ReturnType<typeof discountFromRow>) => {
    const p = await billProfit(sql, table, id, d, view.admin, view.showLabor);
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
  ].filter(Boolean);
  return {
    byType: groupBy(bills, (b) => b.type, JOB_TYPES.map((t) => t.key)),
    byCustomer: groupBy(bills, (b) => b.customer),
    totals,
    scope: `${range} · ${notes.join(" · ")}`,
    laborHidden,
  };
}

export const getProfitReport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: Filters) => filterInput.parse(d))
  .handler(async ({ data, context }): Promise<ProfitReport> => profitReportFor(await ready(), data, context.userId));

/** The body of downloadProfitReport: the same report as a PDF, Excel or Word file. */
export async function profitReportFileFor(sql: Sql, data: { filters: Filters; format: ExportFormat }, userId: string): Promise<{ filename: string; mime: string; base64: string; records: number }> {
  const r = await profitReportFor(sql, data.filters, userId);
  const report = buildProfitReportFile(r, { generated: formatNowChicago().stamp, scope: r.scope });
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
  .handler(async ({ context }): Promise<{ showCost: boolean }> => ({ showCost: (await costView(await ready(), context.userId)).showCost }));
