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
  /** YYYY-MM-DD: billed (tickets, NetSuite) or approved (invoices). */
  date: string;
  sell: number;
  discount: number;
  /** Known cost. */
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
  /** Over the bills with every cost known. */
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
    cost: sum((b) => b.cost),
    margin,
    marginPct: costedNet > 0 ? round2((margin / costedNet) * 100) : null,
    uncostedSell: sum((b) => (b.margin == null ? b.sell - b.discount : 0)),
    estimated: bills.filter((b) => b.estimated).length,
    before2026: bills.filter((b) => b.before2026).length,
  };
}

/** Groups by `key`, biggest sell first (job types in their own order). */
export function groupBy(bills: ProfitBill[], key: (b: ProfitBill) => string, order?: readonly string[]): (GroupTotals & { key: string })[] {
  const by = new Map<string, ProfitBill[]>();
  for (const b of bills) by.set(key(b), [...(by.get(key(b)) ?? []), b]);
  const rows = [...by.entries()].map(([k, list]) => ({ key: k, ...groupTotals(list) }));
  return order ? rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : rows.sort((a, b) => b.sell - a.sell || a.key.localeCompare(b.key));
}

export const jobTypeLabel = (key: string) => JOB_TYPES.find((t) => t.key === key)?.label ?? key;

const COLUMNS = ["Bills", "Sell", "Discount", "Cost", "Margin", "Margin %", "Sell With No Cost", "Estimated"];
const WEIGHTS = [50, 80, 80, 80, 80, 60, 90, 60];

/** One report for every download: a table by job type (with the total), and one by customer. */
export function buildProfitReportFile(r: { byType: (GroupTotals & { key: string })[]; byCustomer: (GroupTotals & { key: string })[]; totals: GroupTotals }, opts: { generated: string; scope: string }) {
  const m = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const cells = (g: GroupTotals) => [String(g.bills), m(g.sell), m(g.discount), m(g.cost), m(g.margin), g.marginPct == null ? "—" : `${g.marginPct}%`, m(g.uncostedSell), String(g.estimated)];
  return {
    title: "Katz Desk Profit",
    generated: `Generated ${opts.generated}`,
    scope: opts.scope,
    summary: { title: "By Job Type", columns: ["Job Type", ...COLUMNS], weights: [80, ...WEIGHTS], rows: [...r.byType.map((g) => [jobTypeLabel(g.key), ...cells(g)]), ["Total", ...cells(r.totals)]] },
    records: { title: "By Customer", columns: ["Customer", ...COLUMNS], weights: [140, ...WEIGHTS], rows: r.byCustomer.map((g) => [g.key || "(none)", ...cells(g)]) },
  };
}

export const profitReportFileName = (date: string, format: string) => `KatzDesk-Profit-${date}.${format}`;
