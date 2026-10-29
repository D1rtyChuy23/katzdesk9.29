/**
 * The Invoices page, the Tickets list's billing filters, Tickets In Window and Location Check (Grok's billing request
 * through Chuy, 2026-10-28): the rows, how the filters read them, and their CSVs. Pure: no database here.
 */
import {
  BOARD_LABEL,
  invoiceStatusKey,
  locationKey,
  moneyText,
  stripServiceChannelId,
  toCsv,
  type BoardKey,
  type FilterRow,
} from "./billing-rules.ts";
import { nameKey } from "./wo-history.ts";

export type RowInvoice = {
  invoice: string;
  so: string | null;
  status: string;
  date: string | null;
  total: number | null;
  remaining: number | null;
  location: string | null;
};

/** One service or TLC ticket with its billing: a row on the Invoices page, and what the Tickets list filters read. */
export type TicketBillingRow = {
  id: number;
  board: "service" | "tlc";
  wo: string | null;
  callId: string;
  customer: string | null;
  technician: string | null;
  secondaryTech: string | null;
  status: string;
  received: string | null;
  completed: string | null;
  so: string | null;
  /** YYYY-MM-DD the Sales Order was recorded. */
  billedAt: string | null;
  invoices: RowInvoice[];
  chargeLines: number;
  /** The charges after the ticket's discount. */
  chargeNet: number;
  /** Invoices that aren't Voided, added up. */
  liveTotal: number;
  corrigoNet: number | null;
  doubleBill: boolean;
  mismatch: boolean;
  serviceLocation: string | null;
  /** Invoices billed from a warehouse the tech's rule doesn't allow. */
  locationWarnings: string[];
  /** Live invoice dates, else the billed date: what the "invoiced" date filter reads. */
  invoicedDates: string[];
};

const live = (i: { status: string }) => invoiceStatusKey(i.status) !== "voided";

/** What the filters read on a ticket with its billing (Invoices page). */
export function ticketFilterRow(r: TicketBillingRow): FilterRow {
  return {
    board: r.board,
    status: r.status,
    account: r.customer,
    techs: [r.technician, r.secondaryTech],
    received: r.received,
    completed: r.completed,
    invoiced: r.invoicedDates,
    so: r.so,
    invoiceStatuses: r.invoices.map((i) => i.status),
    doubleBill: r.doubleBill,
    mismatch: r.mismatch,
    words: [r.customer, r.wo, r.callId, r.so, r.technician, r.secondaryTech, ...r.invoices.flatMap((i) => [i.invoice, i.so])],
  };
}

/** What the filters read on a Tickets list row; its billing comes from the billing list (undefined while loading). */
export function jobFilterRow(
  j: {
    kind: string;
    status: string;
    customer: string | null;
    technician: string | null;
    secondaryTech: string | null;
    received: string | null;
    completedAt: string | null;
    wo: string | null;
    callId: string;
  },
  b: TicketBillingRow | undefined,
): FilterRow {
  return {
    board: j.kind === "tlc" ? "tlc" : "service",
    status: j.status,
    account: j.customer,
    techs: [j.technician, j.secondaryTech],
    received: j.received,
    completed: j.completedAt,
    invoiced: b?.invoicedDates ?? [],
    so: b?.so ?? null,
    invoiceStatuses: b?.invoices.map((i) => i.status) ?? [],
    doubleBill: !!b?.doubleBill,
    mismatch: !!b?.mismatch,
    words: [j.customer, j.wo, j.callId],
  };
}

const invoiceText = (i: RowInvoice) => `${i.invoice} (${i.status}${i.date ? `, ${i.date}` : ""}${i.total != null ? `, ${i.total.toFixed(2)}` : ""})`;

/** The Invoices page as a CSV: one row per ticket, its invoices in one cell. */
export function invoicesCsv(rows: TicketBillingRow[]): string {
  return toCsv(
    [
      "Board",
      "Ticket",
      "WO",
      "Account",
      "Tech",
      "Status",
      "Received",
      "Completed",
      "SO",
      "Billed On",
      "Invoices",
      "Invoice Status",
      "Invoice Dates",
      "Charges (after discount)",
      "Invoiced (not voided)",
      "Amount Remaining",
      "Corrigo Net",
      "Possible Double Bill",
      "Charges Don't Match Invoices",
      "Location Warning",
    ],
    rows.map((r) => [
      BOARD_LABEL[r.board],
      r.id,
      r.wo,
      r.customer,
      [r.technician, r.secondaryTech].filter(Boolean).join(" + "),
      r.status,
      r.received,
      r.completed,
      r.so,
      r.billedAt,
      r.invoices.map((i) => i.invoice).join("; "),
      r.invoices.map((i) => i.status).join("; "),
      r.invoices.map((i) => i.date ?? "").join("; "),
      moneyText(r.chargeNet),
      r.invoices.length ? moneyText(r.liveTotal) : "",
      r.invoices.some(live) ? moneyText(r.invoices.filter(live).reduce((s, i) => s + (i.remaining ?? 0), 0)) : "",
      moneyText(r.corrigoNet),
      r.doubleBill ? "Yes" : "",
      r.mismatch ? "Yes" : "",
      r.locationWarnings.join("; "),
    ]),
  );
}

/** The Tickets list as a CSV: what the list shows, plus the billing when the person can see it. */
export function ticketsCsv(
  rows: {
    id: number;
    kind: string;
    callId: string;
    wo: string | null;
    customer: string | null;
    technician: string | null;
    secondaryTech: string | null;
    status: string;
    urgency: string;
    received: string | null;
    scheduled: string | null;
    completedAt: string | null;
    issue: string | null;
  }[],
  billing: Map<number, TicketBillingRow> | null,
): string {
  const head = ["Ticket", "Call ID", "WO", "Account", "Tech", "Status", "Urgency", "Received", "Scheduled", "Completed", "Issue"];
  const extra = billing ? ["SO", "Invoices", "Invoice Status", "Charges (after discount)", "Invoiced (not voided)", "Possible Double Bill", "Charges Don't Match Invoices"] : [];
  return toCsv(
    [...head, ...extra],
    rows.map((j) => {
      const base = [
        j.id,
        j.callId,
        j.wo,
        j.customer,
        [j.technician, j.secondaryTech].filter(Boolean).join(" + "),
        j.status,
        j.urgency,
        j.received,
        j.scheduled,
        j.completedAt,
        j.issue,
      ];
      if (!billing) return base;
      const b = billing.get(j.id);
      return [
        ...base,
        b?.so ?? "",
        b?.invoices.map(invoiceText).join("; ") ?? "",
        b?.invoices.map((i) => i.status).join("; ") ?? "",
        b ? moneyText(b.chargeNet) : "",
        b?.invoices.length ? moneyText(b.liveTotal) : "",
        b?.doubleBill ? "Yes" : "",
        b?.mismatch ? "Yes" : "",
      ];
    }),
  );
}

// ── Tickets In Window ────────────────────────────────────────────────────────────────────────────────────────────────

/** One work order on any board, for "what was open, done or billed between these dates". */
export type WindowRow = {
  board: BoardKey;
  /** The ticket, PM or install id. */
  id: number;
  wo: string | null;
  customer: string | null;
  technician: string | null;
  status: string;
  received: string | null;
  completed: string | null;
  /** Service and TLC only. */
  so: string | null;
  invoices: { invoice: string; status: string; date: string | null }[];
  invoicedDates: string[];
  serviceLocation: string | null;
  /** A PM billed on a ticket, a merged ticket, an install's other WO: anything that explains the row. */
  note: string | null;
};

export function windowFilterRow(r: WindowRow): FilterRow {
  return {
    board: r.board,
    status: r.status,
    account: r.customer,
    techs: [r.technician],
    received: r.received,
    completed: r.completed,
    invoiced: r.invoicedDates,
    so: r.so,
    invoiceStatuses: r.invoices.map((i) => i.status),
    doubleBill: false,
    mismatch: false,
    words: [r.customer, r.wo, r.technician, r.so, ...r.invoices.map((i) => i.invoice)],
  };
}

export function windowCsv(rows: WindowRow[]): string {
  return toCsv(
    ["Board", "Id", "WO", "Account", "Tech", "Status", "Received", "Completed", "SO", "Invoices", "Service Location", "Note"],
    rows.map((r) => [
      BOARD_LABEL[r.board],
      r.id,
      r.wo,
      r.customer,
      r.technician,
      r.status,
      r.received,
      r.completed,
      r.so,
      r.invoices.map((i) => `${i.invoice} (${i.status})`).join("; "),
      r.serviceLocation,
      r.note,
    ]),
  );
}

/** A window's dates: YYYY-MM-DD, the "to" day included. Refuses a backwards or open-ended window over two years. */
export function windowRange(from: string | undefined, to: string | undefined): { from: string; to: string } | string {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !day.test(from) || !day.test(to)) return "Pick a From and a To date.";
  if (to < from) return "The To date is before the From date.";
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(span)) return "Pick a From and a To date.";
  if (span > 731) return "Pick a window of two years or less.";
  return { from, to };
}

// ── Location Check ───────────────────────────────────────────────────────────────────────────────────────────────────

export type LocationCheckRow = {
  kind: "account" | "warehouse";
  board: BoardKey;
  id: number;
  wo: string | null;
  customer: string | null;
  technician: string | null;
  /** Corrigo's service location, as stored. */
  serviceLocation: string | null;
  /** The KatzDesk account the service location names exactly, when it is not the ticket's account. */
  locationAccount: string | null;
  invoice: string | null;
  invoiceLocation: string | null;
  note: string;
};

/**
 * The account check for one ticket or PM: Corrigo's service location (ServiceChannel id stripped) against the account
 * on it. null when they agree or there's no location. `accounts` maps nameKey → the active account's name.
 */
export function accountLocationCheck(
  customer: string | null,
  serviceLocation: string | null,
  accounts: Map<string, string>,
): { locationAccount: string | null; note: string } | null {
  const loc = stripServiceChannelId(serviceLocation);
  if (!loc || nameKey(loc) === nameKey(customer)) return null;
  const other = accounts.get(nameKey(loc)) ?? null;
  if (other) return { locationAccount: other, note: `Corrigo's service location is the account ${other}, not ${customer?.trim() || "(no account)"}.` };
  return { locationAccount: null, note: `Corrigo's service location "${loc}" is not a KatzDesk account name.` };
}

export function locationCsv(rows: LocationCheckRow[]): string {
  return toCsv(
    ["Check", "Board", "Id", "WO", "Account", "Tech", "Service Location", "Location's Account", "Invoice", "Invoice Location", "Note"],
    rows.map((r) => [
      r.kind === "account" ? "Account vs service location" : "Warehouse rule",
      BOARD_LABEL[r.board],
      r.id,
      r.wo,
      r.customer,
      r.technician,
      r.serviceLocation,
      r.locationAccount,
      r.invoice,
      r.invoiceLocation,
      r.note,
    ]),
  );
}

/** Two invoice locations are the same warehouse ("San Antonio WH" vs "San Antonio - WH"). */
export const sameLocation = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && locationKey(a) === locationKey(b);
