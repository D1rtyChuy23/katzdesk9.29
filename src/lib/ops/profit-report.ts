/**
 * The Profit report's sums (Chuy, 11/20): every billed job as one bill, grouped by job type and by customer. Margin adds
 * up only bills with every cost known; the rest show as sell with no cost. Pure: safe on the server and in a screen.
 */
import { round2 } from "./charges.ts";

/** Before this date a bill counts as sell with no cost (Chuy, 11/20: "start from the beginning of this year"). */
export const COSTED_FROM = "2026-01-01";

export const JOB_TYPES = [
  { key: "service", label: "Service" },
  { key: "tlc", label: "TLC" },
  { key: "pm", label: "PM" },
  { key: "install", label: "Install" },
  { key: "rebuild", label: "Rebuild" },
  { key: "deal", label: "Deal" },
] as const;

export type ProfitBill = {
  type: string;
  customer: string;
  /** The customer as grouped: case, spaces and punctuation don't split a customer. */
  customerKey: string;
  /** YYYY-MM-DD: billed (tickets, NetSuite) or approved (invoices). */
  date: string;
  sell: number;
  discount: number;
  /** Known cost (partial while margin is null). */
  cost: number;
  /** Net less cost; null while any line has no cost, and before 2026. */
  margin: number | null;
  /** A line priced from today's cost or rate, not stored when billed. */
  estimated: boolean;
  before2026: boolean;
};

export type GroupTotals = {
  bills: number;
  sell: number;
  discount: number;
  cost: number;
  /** Cost and margin add up the bills with every cost known: Sell − Discount − Cost − Sell With No Cost = Margin. */
  margin: number;
  marginPct: number | null;
  /** Net sell of the bills whose margin can't be told. */
  uncostedSell: number;
  estimated: number;
  before2026: number;
};

export function groupTotals(bills: ProfitBill[]): GroupTotals {
  const sum = (f: (b: ProfitBill) => number) => round2(bills.reduce((a, b) => a + f(b), 0));
  const costed = bills.filter((b) => b.margin != null);
  const margin = round2(costed.reduce((a, b) => a + (b.margin ?? 0), 0));
  const costedNet = round2(costed.reduce((a, b) => a + b.sell - b.discount, 0));
  return {
    bills: bills.length,
    sell: sum((b) => b.sell),
    discount: sum((b) => b.discount),
    cost: round2(costed.reduce((a, b) => a + b.cost, 0)),
    margin,
    marginPct: costedNet > 0 ? round2((margin / costedNet) * 100) : null,
    uncostedSell: sum((b) => (b.margin == null ? b.sell - b.discount : 0)),
    estimated: bills.filter((b) => b.estimated).length,
    before2026: bills.filter((b) => b.before2026).length,
  };
}

/** Groups by `key`, biggest sell first (job types in their own order). */
export function groupBy(bills: ProfitBill[], key: (b: ProfitBill) => string, order?: readonly string[], label: (b: ProfitBill) => string = key): (GroupTotals & { key: string; label: string })[] {
  const by = new Map<string, ProfitBill[]>();
  for (const b of bills) by.set(key(b), [...(by.get(key(b)) ?? []), b]);
  const rows = [...by.entries()].map(([k, list]) => ({ key: k, label: label(list[0]!), ...groupTotals(list) }));
  return order ? rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : rows.sort((a, b) => b.sell - a.sell || a.key.localeCompare(b.key));
}

export const jobTypeLabel = (key: string) => JOB_TYPES.find((t) => t.key === key)?.label ?? key;

const COLUMNS = ["Bills", "Sell", "Discount", "Cost", "Margin", "Margin %", "Sell With No Cost", "Estimated"];
const WEIGHTS = [50, 80, 80, 80, 80, 60, 90, 60];

// ── QuickBooks history (Jesus, 11/24) ─────────────────────────────────────────────────────────────────────────────
// Work Order History invoices with the cost the line-cost import filled. Its own section: never in the job types, the
// totals above, or the COSTED_FROM rule. Cost is parts cost only (labor has none in this data).

export const HISTORY_SECTION_TITLE = "QuickBooks history (2024–2026)";
export const HISTORY_SECTION_NOTE = "Parts cost only; labor cost not included";

export type HistoryBill = {
  /** YYYY, or "" when the work order has no invoice or completed date. */
  year: string;
  customer: string;
  customerKey: string;
  /** Before the discount. */
  sell: number;
  discount: number;
  /** Parts cost known. */
  cost: number;
  /** Sell of part lines with no cost yet. */
  uncostedSell: number;
};

export type HistoryTotals = { bills: number; sell: number; discount: number; cost: number; profit: number; uncostedSell: number };

export type HistorySection = {
  byYear: (HistoryTotals & { key: string; label: string })[];
  byCustomer: (HistoryTotals & { key: string; label: string })[];
  totals: HistoryTotals;
  /** Left out: Service Dept (internal), and work orders whose ticket already counts above as a billed ticket. */
  excluded: { serviceDept: number; billedTicket: number };
  note: string;
};

export function historyTotals(bills: HistoryBill[]): HistoryTotals {
  const sum = (f: (b: HistoryBill) => number) => round2(bills.reduce((a, b) => a + f(b), 0));
  const sell = sum((b) => b.sell);
  const discount = sum((b) => b.discount);
  const cost = sum((b) => b.cost);
  return { bills: bills.length, sell, discount, cost, profit: round2(sell - discount - cost), uncostedSell: sum((b) => b.uncostedSell) };
}

function historyGroup(bills: HistoryBill[], key: (b: HistoryBill) => string, label: (b: HistoryBill) => string) {
  const by = new Map<string, HistoryBill[]>();
  for (const b of bills) by.set(key(b), [...(by.get(key(b)) ?? []), b]);
  return [...by.entries()].map(([k, list]) => ({ key: k, label: label(list[0]!), ...historyTotals(list) }));
}

export function historySection(bills: HistoryBill[], excluded: { serviceDept: number; billedTicket: number }): HistorySection {
  const left = [
    excluded.serviceDept ? `${excluded.serviceDept} Service Dept left out (internal account)` : null,
    excluded.billedTicket ? `${excluded.billedTicket} left out: its ticket already counts above as a billed ticket` : null,
  ].filter(Boolean);
  return {
    // Oldest year first; a work order with no date last.
    byYear: historyGroup(bills, (b) => b.year, (b) => b.year || "(no date)").sort((a, b) => (a.key || "9999").localeCompare(b.key || "9999")),
    byCustomer: historyGroup(bills, (b) => b.customerKey, (b) => b.customer).sort((a, b) => b.sell - a.sell || a.key.localeCompare(b.key)),
    totals: historyTotals(bills),
    excluded,
    note: [HISTORY_SECTION_NOTE, ...left].join(" · "),
  };
}

const HISTORY_COLUMNS = ["Bills", "Sell", "Discount", "Parts Cost", "Profit After Discount", "Uncosted Sell"];
const HISTORY_WEIGHTS = [50, 80, 80, 80, 90, 80];

/** The history section as two download tables: by year (with the total), and by customer. */
export function historyReportTables(h: HistorySection) {
  const m = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const cells = (g: HistoryTotals) => [String(g.bills), m(g.sell), m(g.discount), m(g.cost), m(g.profit), m(g.uncostedSell)];
  return [
    { title: `${HISTORY_SECTION_TITLE}: By Year`, sheet: "QB History By Year", columns: ["Year", ...HISTORY_COLUMNS], weights: [60, ...HISTORY_WEIGHTS], rows: [...h.byYear.map((g) => [g.label, ...cells(g)]), ["Total", ...cells(h.totals)]] },
    { title: `${HISTORY_SECTION_TITLE}: By Customer`, sheet: "QB History By Customer", columns: ["Customer", ...HISTORY_COLUMNS], weights: [140, ...HISTORY_WEIGHTS], rows: h.byCustomer.map((g) => [g.label || "(none)", ...cells(g)]) },
  ];
}

/** One report for every download: a table by job type (with the total), and one by customer. */
export function buildProfitReportFile(r: { byType: (GroupTotals & { key: string })[]; byCustomer: (GroupTotals & { key: string; label: string })[]; totals: GroupTotals; history?: HistorySection | null }, opts: { generated: string; scope: string }) {
  const m = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const cells = (g: GroupTotals) => [String(g.bills), m(g.sell), m(g.discount), m(g.cost), m(g.margin), g.marginPct == null ? "—" : `${g.marginPct}%`, m(g.uncostedSell), String(g.estimated)];
  return {
    title: "Katz Desk Profit",
    generated: `Generated ${opts.generated}`,
    scope: opts.scope,
    summary: { title: "By Job Type", columns: ["Job Type", ...COLUMNS], weights: [80, ...WEIGHTS], rows: [...r.byType.map((g) => [jobTypeLabel(g.key), ...cells(g)]), ["Total", ...cells(r.totals)]] },
    records: { title: "By Customer", columns: ["Customer", ...COLUMNS], weights: [140, ...WEIGHTS], rows: r.byCustomer.map((g) => [g.label || "(none)", ...cells(g)]) },
    extra: r.history ? historyReportTables(r.history) : [],
  };
}

export const profitReportFileName = (date: string, format: string) => `KatzDesk-Profit-${date}.${format}`;
