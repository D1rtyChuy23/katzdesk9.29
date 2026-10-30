/** A ticket's merged state as service_jobs stores it. */
export type MergedTicketRow = { duplicate_of: number | null; merged_install_id?: number | null };

/**
 * Why a write is refused on a merged ticket, or null when it isn't merged. One merged into an install (10/30) points
 * at the install; one merged into another ticket keeps its old wording, finished by `there` ("Add charges there.").
 */
export function mergedTicketRefusal(row: MergedTicketRow | null | undefined, there = ""): string | null {
  if (!row) return null;
  if (row.merged_install_id) return `This ticket was merged into install #${row.merged_install_id}. Its work is on the install now.`;
  if (row.duplicate_of) return `This ticket was merged into #${row.duplicate_of}.${there ? ` ${there}` : ""}`;
  return null;
}

/**
 * SQL: the Sales Order a ticket was billed on when it was merged into an install (10/30), from the merge log; null when
 * it wasn't merged as billed on one (unbilled, or billed on NetSuite invoices alone: see BILLED_ON_INSTALL). `job` is
 * the ticket's id column, e.g. "j.id".
 */
export const BILLED_ON_INSTALL_SO = (job: string) =>
  `(select m.moved->>'billedSo' from ticket_install_merges m where m.job_id = ${job} and m.moved->>'billedSo' is not null order by m.id desc limit 1)`;

/**
 * SQL: what a ticket merged into an install as billed was billed on, from the merge log: its Sales Order ("SO6266"), or
 * with none its NetSuite invoices ("NetSuite invoice INV1234", Chuy 10/30); null when it wasn't merged as billed. Its
 * charges stay billed there: they never went on the install's invoice, the install shows them as billed, and billing
 * lists keep them once. A merge from before 10/30 evening logged only `billedSo`.
 */
export const BILLED_ON_INSTALL = (job: string) =>
  `(select coalesce(m.moved->>'billedOn', m.moved->>'billedSo') from ticket_install_merges m
     where m.job_id = ${job} and coalesce(m.moved->>'billedOn', m.moved->>'billedSo') is not null order by m.id desc limit 1)`;

/** "NetSuite invoice INV1234" / "NetSuite invoices INV1, INV2". */
export const nsInvoicesLabel = (invoices: string) => `NetSuite ${invoices.includes(",") ? "invoices" : "invoice"} ${invoices}`;

/**
 * The confirm's and the install note's words for charges that stay billed in NetSuite. `on`: the Sales Order, or the
 * NetSuite invoices of a ticket with none; `invoices`: with a Sales Order, its NetSuite invoices.
 */
export const billedCarryOver = (on: string, invoices: string | null = null) =>
  `Billed on ${on}${invoices ? ` (${nsInvoicesLabel(invoices)})` : ""}: charges carry over as billed, not re-billed.`;
