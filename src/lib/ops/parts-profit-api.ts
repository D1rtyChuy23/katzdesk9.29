import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { formatNowChicago, todayChicago } from "@/lib/ops/clock";
import { EXPORT_FORMATS, reportSheets, type ExportFormat } from "@/lib/ops/analytics";
import { invoicedPartLines } from "@/lib/ops/charges-api";
import { buildProfitReport, mpnKey, profitByMpn, profitFileName, profitTotals, type ProfitRow, type ProfitTotals } from "@/lib/ops/part-pricing";
import { loadDiscountRule } from "@/lib/ops/part-pricing-api";
import { ruleLabel } from "@/lib/ops/part-pricing";
import { reportDocx, reportPdf } from "@/lib/ops/report-files";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const filterInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  q: z.string().max(120).nullable().optional(),
});
type ProfitFilters = z.infer<typeof filterInput>;

export type PartsProfit = { rows: ProfitRow[]; totals: ProfitTotals; scope: string; live: number; rule: string };

const niceDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function load(sql: Sql, f: ProfitFilters): Promise<PartsProfit> {
  const { lines } = await invoicedPartLines(sql, { from: f.from ?? null, to: f.to ?? null });
  const needle = (f.q ?? "").trim().toLowerCase();
  const kept = needle
    ? lines.filter((l) => [l.mpn, l.sku, l.description].some((v) => v.toLowerCase().includes(needle)) || (mpnKey(needle) && mpnKey(l.mpn).includes(mpnKey(needle))))
    : lines;
  const rows = profitByMpn(kept);
  const totals = profitTotals(rows, kept.length);
  const live = kept.filter((l) => l.live).length;
  const range = f.from && f.to ? `${niceDay(f.from)} to ${niceDay(f.to)}` : f.from ? `From ${niceDay(f.from)}` : f.to ? `Through ${niceDay(f.to)}` : "All dates";
  const rule = ruleLabel(await loadDiscountRule(sql));
  const scope = `${range} · invoiced tickets · ${rows.length} MPN${rows.length === 1 ? "" : "s"}, ${kept.length} part line${kept.length === 1 ? "" : "s"} · Our Discount Rule: ${rule}${
    live ? ` · ${live} line${live === 1 ? "" : "s"} invoiced before costs were stored, priced from today's part and rule` : ""
  }${needle ? ` · matching "${f.q!.trim()}"` : ""}`;
  return { rows, totals, scope, live, rule };
}

async function requireAdmin(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Parts Profit shows cost and margin, so it is for Admin.");
}

/** Parts Profit: invoiced part lines per MPN with qty, cost, sell, discount and margin. Admin only. */
export const getPartsProfit = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: ProfitFilters) => filterInput.parse(d))
  .handler(async ({ data, context }): Promise<PartsProfit> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    return load(sql, data);
  });

export const downloadPartsProfit = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filters: ProfitFilters; format: ExportFormat }) => z.object({ filters: filterInput, format: z.enum(["pdf", "xlsx", "docx"]) }).parse(d))
  .handler(async ({ data, context }): Promise<{ filename: string; mime: string; base64: string; records: number }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    const p = await load(sql, data.filters);
    const report = buildProfitReport(p.rows, p.totals, { generated: formatNowChicago().stamp, scope: p.scope });
    const filename = profitFileName(todayChicago(), data.format);
    const mime = EXPORT_FORMATS.find((f) => f.format === data.format)!.mime;
    const records = report.records.rows.length;
    if (data.format === "pdf") return { filename, mime, base64: Buffer.from(reportPdf(report)).toString("base64"), records };
    if (data.format === "docx") {
      const { deflateRawSync } = await import("node:zlib");
      return { filename, mime, base64: Buffer.from(reportDocx(report, (d) => new Uint8Array(deflateRawSync(d)))).toString("base64"), records };
    }
    const wb = XLSX.utils.book_new();
    const tables = [report.summary, report.records];
    reportSheets(report).forEach((s, i) => {
      const ws = XLSX.utils.aoa_to_sheet(s.aoa);
      ws["!cols"] = tables[i]!.weights.map((w) => ({ wch: Math.max(8, Math.round(w / 4)) }));
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    });
    return { filename, mime, base64: XLSX.write(wb, { type: "base64", bookType: "xlsx", compression: true }), records };
  });
