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
  /** By Account's row (accountGroupOf). */
  accountKey: string;
  accountLabel: string;
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
  return order ? rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : rows.sort(bySell);
}

export const jobTypeLabel = (key: string) => JOB_TYPES.find((t) => t.key === key)?.label ?? key;

/**
 * The two customer tables (Chuy, 11/26: "Allow both reports"). By Account: each listed account on one row under its name
 * now, by the account's id. By Name Billed: each name as billed, as before (capitals, spaces and punctuation don't split a
 * name).
 */
export const CUSTOMER_GROUPINGS = [
  { id: "account", title: "By Account", first: "Account", sheet: "By Account" },
  { id: "name", title: "By Name Billed", first: "Name Billed", sheet: "By Name Billed" },
] as const;
export type CustomerGrouping = (typeof CUSTOMER_GROUPINGS)[number]["id"];

/**
 * A bill's By Account row: its listed account ("a:<id>", the account's name now), or, with none, its name as By Name
 * Billed groups it ("n:<customerKey>").
 */
export function accountGroupOf(accountId: number | null, customer: string, customerKey: string, names: ReadonlyMap<number, string>): { accountKey: string; accountLabel: string } {
  const name = accountId == null ? undefined : names.get(accountId);
  return name == null ? { accountKey: `n:${customerKey}`, accountLabel: customer } : { accountKey: `a:${accountId}`, accountLabel: name };
}

const bySell = <T extends { sell: number; key: string }>(a: T, b: T) => b.sell - a.sell || a.key.localeCompare(b.key);

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
  /** By Account's row (accountGroupOf). */
  accountKey: string;
  accountLabel: string;
  /** Before the discount. */
  sell: number;
  discount: number;
  /** Cost known (parts and equipment, and any other line the file costed). */
  cost: number;
  /** Some line that needs a cost has none: no profit, and its net goes to Uncosted Sell. */
  partial: boolean;
  /** Sell − discount − cost; null when partial. */
  profit: number | null;
};

/**
 * Like groupTotals: cost and profit add up the fully costed bills only, Margin % is profit over their net, and the
 * partial bills' net is Uncosted Sell.
 */
export type HistoryTotals = {
  bills: number;
  sell: number;
  discount: number;
  cost: number;
  profit: number;
  marginPct: number | null;
  uncostedSell: number;
  partialBills: number;
};

export type HistorySection = {
  byYear: (HistoryTotals & { key: string; label: string })[];
  /** By name billed. */
  byCustomer: (HistoryTotals & { key: string; label: string })[];
  byAccount: (HistoryTotals & { key: string; label: string })[];
  totals: HistoryTotals;
  /** Left out: Service Dept (internal), and work orders whose ticket already counts above as a billed ticket. */
  excluded: { serviceDept: number; billedTicket: number };
  /** Labor lines, and their share of each discount, left out (the person's labor switch is off). */
  laborHidden: boolean;
  note: string;
};

export function historyTotals(bills: HistoryBill[]): HistoryTotals {
  const sum = (list: HistoryBill[], f: (b: HistoryBill) => number) => round2(list.reduce((a, b) => a + f(b), 0));
  const costed = bills.filter((b) => !b.partial && b.profit != null);
  const partial = bills.filter((b) => b.partial || b.profit == null);
  const profit = sum(costed, (b) => b.profit ?? 0);
  const costedNet = sum(costed, (b) => b.sell - b.discount);
  return {
    bills: bills.length,
    sell: sum(bills, (b) => b.sell),
    discount: sum(bills, (b) => b.discount),
    cost: sum(costed, (b) => b.cost),
    profit,
    marginPct: costedNet > 0 ? round2((profit / costedNet) * 100) : null,
    uncostedSell: sum(partial, (b) => b.sell - b.discount),
    partialBills: partial.length,
  };
}

function historyGroup(bills: HistoryBill[], key: (b: HistoryBill) => string, label: (b: HistoryBill) => string) {
  const by = new Map<string, HistoryBill[]>();
  for (const b of bills) by.set(key(b), [...(by.get(key(b)) ?? []), b]);
  return [...by.entries()].map(([k, list]) => ({ key: k, label: label(list[0]!), ...historyTotals(list) }));
}

export function historySection(bills: HistoryBill[], excluded: { serviceDept: number; billedTicket: number }, opts: { laborHidden?: boolean } = {}): HistorySection {
  const partial = bills.filter((b) => b.partial || b.profit == null).length;
  const left = [
    opts.laborHidden ? "labor not shown" : null,
    partial ? `${partial} partial ${partial === 1 ? "bill" : "bills"}: ${partial === 1 ? "its" : "their"} sell is in Uncosted Sell` : null,
    excluded.serviceDept ? `${excluded.serviceDept} Service Dept left out (internal account)` : null,
    excluded.billedTicket ? `${excluded.billedTicket} left out: its ticket already counts above as a billed ticket` : null,
  ].filter(Boolean);
  return {
    laborHidden: !!opts.laborHidden,
    // Oldest year first; a work order with no date last.
    byYear: historyGroup(bills, (b) => b.year, (b) => b.year || "(no date)").sort((a, b) => (a.key || "9999").localeCompare(b.key || "9999")),
    byCustomer: historyGroup(bills, (b) => b.customerKey, (b) => b.customer).sort(bySell),
    byAccount: historyGroup(bills, (b) => b.accountKey, (b) => b.accountLabel).sort(bySell),
    totals: historyTotals(bills),
    excluded,
    note: [HISTORY_SECTION_NOTE, ...left].join(" · "),
  };
}

const HISTORY_COLUMNS = ["Bills", "Sell", "Discount", "Cost (Parts and Equipment)", "Profit After Discount (costed bills)", "Margin %", "Uncosted Sell", "Partial Bills"];
const HISTORY_WEIGHTS = [50, 80, 80, 80, 100, 60, 80, 60];

/** The history section as three download tables: by year (with the total), by account, and by name billed. */
export function historyReportTables(h: HistorySection) {
  const m = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const cells = (g: HistoryTotals) => [String(g.bills), m(g.sell), m(g.discount), m(g.cost), m(g.profit), g.marginPct == null ? "—" : `${g.marginPct}%`, m(g.uncostedSell), String(g.partialBills)];
  const customers = CUSTOMER_GROUPINGS.map((g) => ({
    title: `${HISTORY_SECTION_TITLE}: ${g.title}`,
    sheet: `QB History ${g.sheet}`,
    columns: [g.first, ...HISTORY_COLUMNS],
    weights: [140, ...HISTORY_WEIGHTS],
    rows: (g.id === "account" ? h.byAccount : h.byCustomer).map((r) => [r.label || "(none)", ...cells(r)]),
  }));
  return [
    { title: `${HISTORY_SECTION_TITLE}: By Year`, sheet: "QB History By Year", columns: ["Year", ...HISTORY_COLUMNS], weights: [60, ...HISTORY_WEIGHTS], rows: [...h.byYear.map((g) => [g.label, ...cells(g)]), ["Total", ...cells(h.totals)]] },
    ...customers,
  ];
}

type Groups = (GroupTotals & { key: string; label: string })[];

/**
 * One report for every download: a table by job type (with the total), then the customer tables by account and by name
 * billed, then the QuickBooks history's.
 */
export function buildProfitReportFile(r: { byType: (GroupTotals & { key: string })[]; byCustomer: Groups; byAccount: Groups; totals: GroupTotals; history?: HistorySection | null }, opts: { generated: string; scope: string }) {
  const m = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const cells = (g: GroupTotals) => [String(g.bills), m(g.sell), m(g.discount), m(g.cost), m(g.margin), g.marginPct == null ? "—" : `${g.marginPct}%`, m(g.uncostedSell), String(g.estimated)];
  const [account, name] = CUSTOMER_GROUPINGS.map((g) => ({
    title: g.title,
    columns: [g.first, ...COLUMNS],
    weights: [140, ...WEIGHTS],
    rows: (g.id === "account" ? r.byAccount : r.byCustomer).map((x) => [x.label || "(none)", ...cells(x)]),
  }));
  return {
    title: "Katz Desk Profit",
    generated: `Generated ${opts.generated}`,
    scope: opts.scope,
    summary: { title: "By Job Type", columns: ["Job Type", ...COLUMNS], weights: [80, ...WEIGHTS], rows: [...r.byType.map((g) => [jobTypeLabel(g.key), ...cells(g)]), ["Total", ...cells(r.totals)]] },
    records: account!,
    extra: [name!, ...(r.history ? historyReportTables(r.history) : [])],
  };
}

export const profitReportFileName = (date: string, format: string) => `KatzDesk-Profit-${date}.${format}`;
