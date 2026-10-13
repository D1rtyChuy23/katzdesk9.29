/**
 * Repair Quote: parts and labor quoted on a service ticket or a rebuild project. A rebuild linked to a ticket
 * shares that ticket's quote, so there is one sheet and the cost shows on the project.
 * Pure: no server imports, safe for node --test.
 */
import { checkCharges, kindForItem, lineAmount, round2, type ChargeKind } from "./charges.ts";

export const QUOTE_STATUSES = ["Draft", "Sent", "Approved", "Declined"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const isQuoteStatus = (v: unknown): v is QuoteStatus => (QUOTE_STATUSES as readonly string[]).includes(String(v));

export type QuoteLine = { item: string; description: string; qty: number; rate: number; kind: ChargeKind };

export type QuoteTotals = { parts: number; labor: number; total: number };

/** Labor is the labor hour (and a trip, if one is quoted). Everything else is a part. */
export const isLaborKind = (kind: ChargeKind) => kind === "labor" || kind === "trip";

export function quoteTotals(lines: Pick<QuoteLine, "qty" | "rate" | "kind">[]): QuoteTotals {
  let parts = 0;
  let labor = 0;
  for (const l of lines) {
    if (isLaborKind(l.kind)) labor += lineAmount(l);
    else parts += lineAmount(l);
  }
  parts = round2(parts);
  labor = round2(labor);
  return { parts, labor, total: round2(parts + labor) };
}

/** A decided quote is not edited in place: set it back to Draft or Sent to change a line. */
export const quoteLocked = (status: string | null | undefined) => status === "Approved" || status === "Declined";

/** The first thing wrong with the lines, or null. Same checks as ticket charges. */
export function quoteError(lines: { item: string; qty: unknown; rate: unknown }[]): string | null {
  const problems = checkCharges(lines);
  return problems.length ? `Line ${problems[0].index + 1}: ${problems[0].message}` : null;
}

export const lineKind = (item: string): ChargeKind => kindForItem(item);

export type QuoteRef = { id: number; jobId: number | null; rebuildId: number | null };

/**
 * The one quote a rebuild uses: its own, else the quote on the ticket it is linked to. A rebuild never gets a
 * second sheet while its ticket already has one.
 */
export function quoteForRebuild<Q extends QuoteRef>(rebuild: { id: number; jobId: number | null }, quotes: Q[]): Q | null {
  return quotes.find((q) => q.rebuildId === rebuild.id) ?? (rebuild.jobId != null ? (quotes.find((q) => q.jobId === rebuild.jobId) ?? null) : null);
}

/** The one quote a ticket uses: its own, else the quote on the rebuild project linked to it. */
export function quoteForJob<Q extends QuoteRef>(jobId: number, linkedRebuildId: number | null, quotes: Q[]): Q | null {
  return quotes.find((q) => q.jobId === jobId) ?? (linkedRebuildId != null ? (quotes.find((q) => q.rebuildId === linkedRebuildId) ?? null) : null);
}

export type QuoteCost = QuoteTotals & { status: QuoteStatus; lines: number };

/** "$1,240.00 · Approved" for a rebuild row; "No quote" when there is none. */
export function costGlance(cost: QuoteCost | null | undefined): string {
  if (!cost) return "No quote";
  return `${money(cost.total)} · ${cost.status}`;
}

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
