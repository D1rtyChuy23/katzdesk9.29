/**
 * Analytics: installs, service, PMs, TLC and rebuilds in one list, with one report that every export format
 * (PDF, Excel, Word) is written from, so the three files always carry the same data.
 * Pure: no server imports, safe for node --test.
 */

export const ANALYTICS_TYPES = ["installs", "service", "pms", "tlc", "rebuilds"] as const;
export type AnalyticsType = (typeof ANALYTICS_TYPES)[number];
export const isAnalyticsType = (v: unknown): v is AnalyticsType => (ANALYTICS_TYPES as readonly string[]).includes(String(v));

export const ANALYTICS_LABEL: Record<AnalyticsType, string> = {
  installs: "Installs",
  service: "Service",
  pms: "PMs",
  tlc: "TLC",
  rebuilds: "Rebuilds",
};

/** One record, whatever page it came from. */
export type AnalyticsRow = {
  type: AnalyticsType;
  /** The record's own id, for opening it in the app. Not exported. */
  id: number;
  account: string;
  accountNumber: string;
  /** YYYY-MM-DD: the install date, the completed or scheduled date, or the day the record came in. */
  date: string;
  status: string;
  rep: string;
  tech: string;
  ref: string;
  detail: string;
};

export const ANALYTICS_COLUMNS = ["Type", "Account", "Account #", "Date", "Status", "Rep", "Tech / Owner", "Reference", "Detail"];
/** Relative column widths for the record table, in the same order as the columns. */
export const ANALYTICS_WEIGHTS = [44, 140, 50, 52, 76, 60, 80, 62, 156];
/** A long problem description is cut here for every format alike, so no file holds more than another. */
export const DETAIL_MAX = 160;

export const NO_REP = "__none__";

export type AnalyticsFilters = {
  from?: string | null;
  to?: string | null;
  /** Empty or missing means every type. */
  types?: AnalyticsType[] | null;
  /** A rep's name, or NO_REP for records with no rep. */
  rep?: string | null;
  /** Words typed in the search box: matched against the account, its number, status, rep, tech, reference and detail. */
  q?: string | null;
};

const day = (v: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}/.test(v ?? "") ? (v as string).slice(0, 10) : "");
const one = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

export function filterRows(rows: AnalyticsRow[], f: AnalyticsFilters): AnalyticsRow[] {
  const from = day(f.from);
  const to = day(f.to);
  const types = f.types?.length ? new Set<string>(f.types) : null;
  const rep = one(f.rep).toLowerCase();
  const needle = one(f.q).toLowerCase();
  return rows.filter((r) => {
    if (types && !types.has(r.type)) return false;
    if (needle && ![r.account, r.accountNumber, r.status, r.rep, r.tech, r.ref, r.detail].some((v) => one(v).toLowerCase().includes(needle))) return false;
    const d = day(r.date);
    if (from && (!d || d < from)) return false;
    if (to && (!d || d > to)) return false;
    if (rep === NO_REP) return !one(r.rep);
    if (rep && one(r.rep).toLowerCase() !== rep) return false;
    return true;
  });
}

/** Installs, service, PMs, TLC, rebuilds; newest first inside each; then account. */
export function sortRows(rows: AnalyticsRow[]): AnalyticsRow[] {
  const order = (t: AnalyticsType) => ANALYTICS_TYPES.indexOf(t);
  return [...rows].sort(
    (a, b) => order(a.type) - order(b.type) || day(b.date).localeCompare(day(a.date)) || a.account.localeCompare(b.account, "en", { sensitivity: "base" }) || a.id - b.id,
  );
}

export type TypeSummary = { type: AnalyticsType; label: string; total: number; statuses: { status: string; count: number }[] };

/** Every type is listed, even at zero, so a quiet month still shows all five. */
export function summarize(rows: AnalyticsRow[], types: readonly AnalyticsType[] = ANALYTICS_TYPES): TypeSummary[] {
  return types.map((type) => {
    const mine = rows.filter((r) => r.type === type);
    const counts = new Map<string, number>();
    for (const r of mine) counts.set(one(r.status) || "No status", (counts.get(one(r.status) || "No status") ?? 0) + 1);
    const statuses = [...counts.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
    return { type, label: ANALYTICS_LABEL[type], total: mine.length, statuses };
  });
}

export function repCounts(rows: AnalyticsRow[]): { rep: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(one(r.rep) || "No rep", (counts.get(one(r.rep) || "No rep") ?? 0) + 1);
  return [...counts.entries()].map(([rep, count]) => ({ rep, count })).sort((a, b) => b.count - a.count || a.rep.localeCompare(b.rep));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MonthCount = { month: string; label: string; total: number } & Record<AnalyticsType, number>;

/** Records per month, oldest first. A month with nothing between two busy ones is still shown. */
export function monthCounts(rows: AnalyticsRow[]): MonthCount[] {
  const keys = rows.map((r) => day(r.date).slice(0, 7)).filter(Boolean).sort();
  if (!keys.length) return [];
  const out: MonthCount[] = [];
  let [y, m] = keys[0]!.split("-").map(Number) as [number, number];
  const [endY, endM] = keys[keys.length - 1]!.split("-").map(Number) as [number, number];
  // Never more than ten years of months, however odd a date in the data is.
  for (let guard = 0; guard < 120 && (y < endY || (y === endY && m <= endM)); guard++) {
    const month = `${y}-${String(m).padStart(2, "0")}`;
    const mine = rows.filter((r) => day(r.date).startsWith(month));
    const row = { month, label: `${MONTHS[m - 1]} ${y}`, total: mine.length, installs: 0, service: 0, pms: 0, tlc: 0, rebuilds: 0 };
    for (const r of mine) row[r.type] += 1;
    out.push(row);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export type ReportTable = { title: string; columns: string[]; weights: number[]; rows: string[][] };

/** What every export is written from. PDF, Excel and Word each print exactly these lines and these two tables. */
export type AnalyticsReport = {
  title: string;
  generated: string;
  scope: string;
  summary: ReportTable;
  records: ReportTable;
};

function niceDay(d: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  return y && m && dd ? `${MONTHS[m - 1]} ${dd}, ${y}` : d;
}

export function scopeLine(f: AnalyticsFilters, count: number): string {
  const from = day(f.from);
  const to = day(f.to);
  const range = from && to ? `${niceDay(from)} to ${niceDay(to)}` : from ? `From ${niceDay(from)}` : to ? `Through ${niceDay(to)}` : "All dates";
  const types = f.types?.length ? ANALYTICS_TYPES.filter((t) => f.types!.includes(t)) : [...ANALYTICS_TYPES];
  const rep = one(f.rep) === NO_REP ? "No rep" : one(f.rep) || "All reps";
  const search = one(f.q) ? ` · Search "${one(f.q)}"` : "";
  return `${range} · ${types.map((t) => ANALYTICS_LABEL[t]).join(", ")} · ${rep}${search} · ${count} record${count === 1 ? "" : "s"}`;
}

export function rowCells(r: AnalyticsRow): string[] {
  const detail = one(r.detail);
  return [
    ANALYTICS_LABEL[r.type],
    one(r.account),
    one(r.accountNumber),
    day(r.date),
    one(r.status),
    one(r.rep),
    one(r.tech),
    one(r.ref),
    detail.length > DETAIL_MAX ? `${detail.slice(0, DETAIL_MAX - 1).trimEnd()}…` : detail,
  ];
}

/** Filters and sorts the records, then lays out the one report all three files are written from. */
export function buildReport(all: AnalyticsRow[], filters: AnalyticsFilters, generated: string): AnalyticsReport {
  const rows = sortRows(filterRows(all, filters));
  const types = filters.types?.length ? ANALYTICS_TYPES.filter((t) => filters.types!.includes(t)) : ANALYTICS_TYPES;
  const summary = summarize(rows, types);
  return {
    title: "Katz Desk Analytics",
    generated: `Generated ${generated}`,
    scope: scopeLine(filters, rows.length),
    summary: {
      title: "Summary",
      columns: ["Type", "Records", "By Status"],
      weights: [90, 60, 570],
      rows: [
        ...summary.map((s) => [s.label, String(s.total), s.statuses.map((x) => `${x.status} ${x.count}`).join(" · ")]),
        ["Total", String(rows.length), ""],
      ],
    },
    records: { title: "Records", columns: [...ANALYTICS_COLUMNS], weights: [...ANALYTICS_WEIGHTS], rows: rows.map(rowCells) },
  };
}

export type ExportFormat = "pdf" | "xlsx" | "docx";
export const EXPORT_FORMATS: { format: ExportFormat; label: string; mime: string }[] = [
  { format: "pdf", label: "PDF", mime: "application/pdf" },
  { format: "xlsx", label: "Excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { format: "docx", label: "Word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
];

export function reportFileName(date: string, format: ExportFormat): string {
  return `KatzDesk-Analytics-${date}.${format}`;
}

/** The Excel layout: a Summary sheet and a Records sheet, the same lines and tables as the PDF and Word files. */
export function reportSheets(report: AnalyticsReport): { name: string; aoa: string[][] }[] {
  const head = [[report.title], [report.generated], [report.scope], []];
  return [
    { name: report.summary.title, aoa: [...head, report.summary.columns, ...report.summary.rows] },
    { name: report.records.title, aoa: [...head, report.records.columns, ...report.records.rows] },
  ];
}
