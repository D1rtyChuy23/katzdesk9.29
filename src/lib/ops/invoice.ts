/**
 * The Invoice window: one window for every customer record (service and TLC tickets, PMs, installs, rebuilds,
 * deals). Billing info comes from the account; lines are parts and labor; one discount; a total. Totals use the
 * same charge and discount math as the ticket Charges panel, nothing new.
 * Pure: no server imports, safe for node --test.
 */
import { chargesTotal, checkCharges, lineAmount, round2, type ChargeKind } from "./charges.ts";
import { applyDiscount, type Discount } from "./discount.ts";
import type { PinQuality } from "./geo.ts";

export const INVOICE_TARGETS = ["service", "tlc", "pm", "install", "rebuild", "deal"] as const;
export type InvoiceTarget = (typeof INVOICE_TARGETS)[number];
export const isInvoiceTarget = (v: unknown): v is InvoiceTarget => (INVOICE_TARGETS as readonly string[]).includes(String(v));

export const TARGET_LABEL: Record<InvoiceTarget, string> = {
  service: "Service Ticket",
  tlc: "TLC Ticket",
  pm: "PM",
  install: "Install",
  rebuild: "Rebuild",
  deal: "Deal",
};

/** Tickets keep their invoice in the ticket's own charge lines (the Charges panel); every other record has its own. */
export const usesTicketCharges = (t: InvoiceTarget) => t === "service" || t === "tlc";

/** Which invoices carry a P.O. of their own: an install's (10/30). A ticket's P.O. is on the ticket. */
export const carriesPo = (t: InvoiceTarget): boolean => t === "install";

export const PO_MAX = 120;

/** A P.O. as saved: trimmed, blank as none, 120 characters at most (as on a ticket). */
export function cleanPo(raw: string | null | undefined): { po: string | null } | { error: string } {
  const po = String(raw ?? "").trim();
  if (po.length > PO_MAX) return { error: `The P.O. is too long: ${PO_MAX} characters at most.` };
  return { po: po || null };
}

/** Labor is the labor hour and the trip charge; everything else on an invoice is a part. */
export const isLaborKind = (kind: ChargeKind) => kind === "labor" || kind === "trip";

export type InvoiceTotals = {
  parts: number;
  labor: number;
  /** Lines added up, before the discount. */
  subtotal: number;
  /** Dollars the discount takes off. */
  off: number;
  total: number;
};

/** Parts, labor, subtotal, discount and total: the ticket charges math, with labor and parts shown apart. */
export function invoiceTotals(lines: { qty: number; rate: number; kind: ChargeKind }[], discount: Discount | null): InvoiceTotals {
  let parts = 0;
  let labor = 0;
  for (const l of lines) {
    if (isLaborKind(l.kind)) labor += lineAmount(l);
    else parts += lineAmount(l);
  }
  const t = applyDiscount(chargesTotal(lines), discount);
  return { parts: round2(parts), labor: round2(labor), subtotal: t.subtotal, off: t.off, total: t.total };
}

/** The first thing wrong with the lines, as a sentence, or null. Same checks as ticket charges. */
export function invoiceError(lines: { item: string; qty: unknown; rate: unknown; sourceKey?: string | null }[]): string | null {
  const problems = checkCharges(lines);
  return problems.length ? `Line ${problems[0].index + 1}: ${problems[0].message}` : null;
}

/** A stacked PM's own invoice cannot take a second copy of the lines. */
export function stackedPmLock(ticket: { jobId: number; wo: string | null; callId: string | null }): string {
  const label = String(ticket.wo ?? "").trim() || String(ticket.callId ?? "").trim();
  return `This PM is billed on ticket #${ticket.jobId}${label ? ` (${label})` : ""}. Open the ticket's Invoicing tab.`;
}

export type BillTo = {
  /** The account name as the customer list has it (or as the record has it when the account is not on the list). */
  name: string;
  accountNumber: string | null;
  address: string | null;
  rep: string | null;
  netsuiteId: string | null;
  /** False when the record's customer is not on the KatzDesk customer list. */
  onList: boolean;
  /** The account's saved map pin, for directions to the exact spot (only when it is a street match). */
  latitude?: number | null;
  longitude?: number | null;
  geocodeMatch?: PinQuality | null;
};

/** What is missing from the billing info, so the window can say it plainly instead of asking for the customer. */
export function billToGaps(b: BillTo): string[] {
  const out: string[] = [];
  if (!b.onList) out.push("This customer is not on the customer list");
  if (!b.accountNumber) out.push("No account number");
  if (!b.address) out.push("No address");
  if (!b.rep) out.push("No rep");
  return out;
}

/** "Service Ticket WO-123", "Install #45", "Rebuild: Linea past target". */
export function targetTitle(t: InvoiceTarget, ref: { id: number; wo?: string | null; callId?: string | null; title?: string | null }): string {
  const wo = (ref.wo ?? "").trim();
  if (t === "service" || t === "tlc") return `${TARGET_LABEL[t]} ${wo ? (/^wo/i.test(wo) ? wo : `WO ${wo}`) : (ref.callId ?? `#${ref.id}`)}`;
  if (t === "pm") return `PM ${wo ? (/^wo/i.test(wo) ? wo : `WO ${wo}`) : `#${ref.id}`}`;
  if (t === "rebuild") return `Rebuild${ref.title ? `: ${ref.title}` : ` #${ref.id}`}`;
  return `${TARGET_LABEL[t]} #${ref.id}`;
}
