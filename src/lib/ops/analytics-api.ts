/**
 * Analytics: installs, service, PMs, TLC and rebuilds in one list, and its export as PDF, Excel or Word.
 * The page and all three files are read from the same rows through the same report.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { formatNowChicago, isInstalled, todayChicago } from "@/lib/ops/clock";
import { isoDay } from "@/lib/ops/iso";
import { accountNumberFor, accountRepFor, loadAccountMarks } from "@/lib/ops/reps";
import { canonicalRepName } from "@/lib/ops/rep-match";
import { loadRebuilds } from "@/lib/ops/rebuilds";
import {
  ANALYTICS_TYPES,
  EXPORT_FORMATS,
  buildReport,
  filterRows,
  monthCounts,
  repCounts,
  reportFileName,
  reportSheets,
  scopeLine,
  sortRows,
  summarize,
  type AnalyticsFilters,
  type AnalyticsRow,
  type ExportFormat,
  type MonthCount,
  type TypeSummary,
} from "@/lib/ops/analytics";
import { reportDocx, reportPdf } from "@/lib/ops/report-files";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

const text = (v: unknown) => (v == null ? "" : String(v).trim());
/** Equipment is kept one model per line; a report cell reads better on one. */
const oneLine = (v: unknown) => text(v).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join(" · ");
const firstDay = (...values: unknown[]) => values.map(isoDay).find(Boolean) ?? "";

/** Every install, service ticket, PM, TLC ticket and rebuild still on its list, as one kind of row. */
export async function loadAnalyticsRows(sql: Sql): Promise<AnalyticsRow[]> {
  const marks = await loadAccountMarks(sql);
  // A record with no rep of its own shows the rep saved on the customer account, as the lists do.
  const rep = (own: unknown, customer: unknown) => {
    const raw = text(own) || accountRepFor(marks, text(customer)) || "";
    return canonicalRepName(raw) ?? raw;
  };
  const acct = (customer: unknown) => accountNumberFor(marks, text(customer)) ?? "";
  const out: AnalyticsRow[] = [];

  const installs = await sql.query<Record<string, unknown>>(
    "select id, customer, equipment, equip_status, complete, install_date, completed_at, received, updated_at, technician, wo, account_rep from installs where archived = false",
  );
  for (const r of installs) {
    out.push({
      type: "installs",
      id: Number(r.id),
      account: text(r.customer),
      accountNumber: acct(r.customer),
      date: firstDay(r.install_date, r.completed_at, r.received, r.updated_at),
      status: isInstalled({ complete: !!r.complete, equipStatus: r.equip_status as string | null }) ? "Installed" : text(r.equip_status) || "Not Ready",
      rep: rep(r.account_rep, r.customer),
      tech: text(r.technician),
      ref: text(r.wo),
      detail: oneLine(r.equipment),
    });
  }

  const jobs = await sql.query<Record<string, unknown>>(
    "select id, kind, customer, status, technician, technician2, wo, call_id, issue, equipment, received, scheduled, completed_at, updated_at from service_jobs where duplicate_of is null",
  );
  for (const r of jobs) {
    out.push({
      type: r.kind === "tlc" ? "tlc" : "service",
      id: Number(r.id),
      account: text(r.customer),
      accountNumber: acct(r.customer),
      date: firstDay(r.completed_at, r.scheduled, r.received, r.updated_at),
      status: text(r.status),
      rep: rep(null, r.customer),
      tech: [text(r.technician), text(r.technician2)].filter(Boolean).join(" / "),
      ref: text(r.wo) || text(r.call_id),
      detail: oneLine(r.issue) || oneLine(r.equipment),
    });
  }

  const pms = await sql.query<Record<string, unknown>>(
    "select id, customer, status, technician, wo, equipment, style, projected, completed_at, received, updated_at from pm_jobs",
  );
  for (const r of pms) {
    out.push({
      type: "pms",
      id: Number(r.id),
      account: text(r.customer),
      accountNumber: acct(r.customer),
      date: firstDay(r.completed_at, r.projected, r.received, r.updated_at),
      status: text(r.status),
      rep: rep(null, r.customer),
      tech: text(r.technician),
      ref: text(r.wo),
      detail: [text(r.style), oneLine(r.equipment)].filter(Boolean).join(" · "),
    });
  }

  for (const r of await loadRebuilds(sql)) {
    out.push({
      type: "rebuilds",
      id: r.id,
      account: r.account,
      accountNumber: acct(r.account),
      date: firstDay(r.actualComplete, r.targetComplete, r.createdAt),
      status: r.status,
      rep: rep(r.accountRep, r.account),
      tech: text(r.owner),
      ref: text(r.serial) ? `SN ${text(r.serial)}` : "",
      detail: [r.title, oneLine(r.equipment)].filter(Boolean).join(" · "),
    });
  }
  return out;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const filterInput = z.object({
  from: z.string().regex(DAY).nullable().optional(),
  to: z.string().regex(DAY).nullable().optional(),
  types: z.array(z.enum(ANALYTICS_TYPES)).max(ANALYTICS_TYPES.length).nullable().optional(),
  rep: z.string().max(80).nullable().optional(),
  q: z.string().max(120).nullable().optional(),
});

export type AnalyticsView = {
  /** The records in the range, sorted the way every export lists them. */
  rows: AnalyticsRow[];
  /** What the report covers, as the exports print it. */
  scope: string;
  /** All five types, counted over the range and rep, whichever types are switched on. */
  summary: TypeSummary[];
  months: MonthCount[];
  reps: { rep: string; count: number }[];
  /** Every rep that has a record, for the filter. */
  repOptions: string[];
};

export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: AnalyticsFilters) => filterInput.parse(d))
  .handler(async ({ data }): Promise<AnalyticsView> => {
    const sql = await ready();
    const all = await loadAnalyticsRows(sql);
    const rows = sortRows(filterRows(all, data));
    return {
      rows,
      scope: scopeLine(data, rows.length),
      summary: summarize(filterRows(all, { ...data, types: null })),
      months: monthCounts(rows),
      reps: repCounts(rows),
      repOptions: [...new Set(all.map((r) => r.rep).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    };
  });

export type AnalyticsFile = { filename: string; mime: string; base64: string; records: number };

/** The same report as a PDF, an Excel workbook or a Word document. */
export const downloadAnalytics = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filters: AnalyticsFilters; format: ExportFormat }) => z.object({ filters: filterInput, format: z.enum(["pdf", "xlsx", "docx"]) }).parse(d))
  .handler(async ({ data }): Promise<AnalyticsFile> => {
    const sql = await ready();
    const report = buildReport(await loadAnalyticsRows(sql), data.filters, formatNowChicago().stamp);
    const filename = reportFileName(todayChicago(), data.format);
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
