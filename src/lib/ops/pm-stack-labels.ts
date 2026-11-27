/**
 * How the PM stack's lists name a ticket or a PM (11/27, from Chuy's check of f640892): enough to pick one from. Both of
 * a ticket's numbers, a date (completed, else scheduled, else received, as the list sorts), and the customer only when
 * it differs from the other side's. Pure, for the panel and its tests.
 */
import { formatLongDate } from "./clock.ts";

/** The PM-side list's empty state: unbilled tickets are offered, Completed ones included (99a123e). */
export const NO_UNBILLED_TICKETS = "No unbilled tickets for this customer.";

export type TicketDateKind = "completed" | "scheduled" | "received";
export type PmDateKind = "completed" | "due" | "received";

/** A ticket's WO # and call number, both when it has both, each once. */
export function ticketNumbers(t: { wo: string | null; callId: string | null }): string {
  const wo = (t.wo ?? "").trim();
  const call = (t.callId ?? "").trim();
  if (wo && call && wo.toLowerCase() !== call.toLowerCase()) return `${wo} · ${call}`;
  return wo || call;
}

const dated = (kind: string | null | undefined, date: string | null | undefined) => (date && kind ? `${kind} ${formatLongDate(date)}` : "");
const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");

/** A ticket a PM can stack on, or is on. */
export function stackTicketText(t: {
  jobId: number;
  wo: string | null;
  callId: string | null;
  status: string;
  customer: string;
  customerMatches: boolean;
  date?: string | null;
  dateKind?: TicketDateKind | null;
}): string {
  return join(`Ticket #${t.jobId}`, ticketNumbers(t), t.status, dated(t.dateKind, t.date), t.customerMatches ? "" : t.customer);
}

/** A PM a ticket can take, or carries. */
export function stackPmText(p: { pmId: number; customer: string; status: string; date?: string | null; dateKind?: PmDateKind | null }): string {
  return join(`PM #${p.pmId}`, p.customer, p.status, dated(p.dateKind, p.date));
}
