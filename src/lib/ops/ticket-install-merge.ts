/**
 * Merge into install (Grok through Chuy, 2026-10-30). A service or TLC ticket whose WO number is on an install can be
 * folded into that install by an Admin, after a confirm that names the install kept and what moves:
 *
 * - its charge lines go on the install's invoice, waiting for an Admin to approve them (the ticket keeps its copy). A
 *   ticket billed on a NetSuite Sales Order (Grok through Chuy, 10/30), or with no SO on NetSuite invoices that aren't
 *   Voided (Chuy, 10/30), keeps its charges billed there: they never go on the install's invoice, the install's Invoice
 *   window lists them as billed on that SO or those invoices, and the merge log keeps them;
 * - its Ping notes and its pings, the units pulled onto it, its WO part lines and its rebuilds go to the install;
 * - its own text (issue, equipment, work done, notes, P.O., contact, tech) is added under the install's notes, which
 *   are never overwritten;
 * - the ticket is marked merged (merged_install_id, done) and hidden: duplicate_of points at the ticket itself, so every
 *   list that leaves merged duplicates out leaves it out too.
 *
 * Nothing is deleted. Each merge is one guarded statement and is logged on both records and in ticket_install_merges.
 * A later Corrigo import puts the ticket's WO on the install, never on the ticket (corrigo-import.ts).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import type { ChargeKind } from "@/lib/ops/charges";
import { formatLongDate, todayChicago } from "@/lib/ops/clock";
import { customersCompatible, woMatchKey } from "@/lib/ops/corrigo";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { isDiscountKind, type Discount } from "@/lib/ops/discount";
import { invoiceTotals } from "@/lib/ops/invoice";
import { isInstalled } from "@/lib/ops/install-status";
import { billedCarryOver, nsInvoicesLabel } from "@/lib/ops/merged-ticket";
import { INSTALL_WOS_SQL } from "@/lib/ops/wo-search";

type Q = Pick<Sql, "query">;

const ready = async (): Promise<Sql> => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

export const ADMIN_ONLY = "Only an Admin can merge a ticket into an install.";
export const CHANGED_SINCE_OPENED = "The ticket, the install or its invoice changed since this window opened, so nothing was merged. Look it over again, then merge.";
/**
 * A billed ticket merged from a window opened before tickets billed like it could merge (10/30): on a Sales Order, or
 * on NetSuite invoices with no SO. `on` is what it is billed on.
 */
export const RELOAD_FOR_BILLED = (on: string) =>
  `This ticket is billed on ${on}, and this window is from before tickets billed like this could be merged, so nothing was merged. Reload the page, then merge.`;

/** WO numbers start over after 9999: a ticket and an install WO that came in more than this far apart are two jobs. */
const RUN_DAYS = 365;

/** Same run of WO numbers: came in within a year of each other, or one date is unknown. */
export function sameWoRun(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true;
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return true;
  return Math.abs(da - db) <= RUN_DAYS * 86_400_000;
}

/** A stored WO's digits without leading zeros, the way the other WO lookups read them in SQL. */
const woDigits = (wo: string | null | undefined) => String(wo ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "");

/** The day a ticket came in: received, else its first activity entry, else its completed date (as Corrigo dates it). */
const TICKET_CAME_IN = `coalesce(j.received,
  (select (min(a.created_at) at time zone 'America/Chicago')::date from activity a where a.entity_type = j.kind and a.entity_id = j.id),
  j.completed_at)`;

/** The day an install's WO came in: its own row's, else the install's (received, first activity, completed). */
const INSTALL_WO_CAME_IN = `coalesce((select x.received from install_work_orders x where x.install_id = i.id and x.wo = w.wo limit 1),
  i.received,
  (select (min(a.created_at) at time zone 'America/Chicago')::date from activity a where a.entity_type = 'install' and a.entity_id = i.id),
  i.completed_at)`;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const money = (n: number) => `$${n.toFixed(2)}`;

export function installStatusLabel(row: { complete: boolean | null; equip_status: string | null }): string {
  return isInstalled({ complete: !!row.complete, equipStatus: row.equip_status }) ? "Installed" : row.equip_status || "Not Ready";
}

// ── Which installs carry a ticket's WO ──────────────────────────────────────────────────────────────────────────────

/** One install a ticket's WO is on. */
export type InstallMatch = {
  installId: number;
  customer: string;
  status: string;
  completedAt: string | null;
  wo: string;
  /** The install is flagged as a possible duplicate of this install (the merge refuses until that is settled). */
  possibleDuplicateOf: number | null;
};

type InstallWoRow = {
  id: number;
  customer: string;
  equip_status: string | null;
  complete: boolean;
  completed_at: string | null;
  duplicate_of: number | null;
  wo: string;
  came_in: string | null;
};

/** Every WO a live (not archived) install carries, with the day it came in. `digits` narrows to those numbers. */
async function loadInstallWoRows(sql: Q, digits: string[] | null): Promise<InstallWoRow[]> {
  return sql.query<InstallWoRow>(
    `select i.id, i.customer, i.equip_status, i.complete, to_char(i.completed_at, 'YYYY-MM-DD') as completed_at,
            i.duplicate_of, w.wo, to_char(${INSTALL_WO_CAME_IN}, 'YYYY-MM-DD') as came_in
       from installs i join ${INSTALL_WOS_SQL} w on w.install_id = i.id
      where i.archived = false
        and ($1::text[] is null or ltrim(regexp_replace(w.wo, '[^0-9]', '', 'g'), '0') = any($1::text[]))
      order by i.id, w.wo`,
    [digits],
  );
}

/** The installs a ticket's WO is on, this run of numbers only, one entry per install. */
export function matchInstalls(ticket: { wo: string | null; came_in: string | null }, rows: InstallWoRow[]): InstallMatch[] {
  const key = woMatchKey(ticket.wo ?? "");
  if (!key) return [];
  const out: InstallMatch[] = [];
  for (const r of rows) {
    if (woMatchKey(r.wo) !== key || !sameWoRun(ticket.came_in, r.came_in)) continue;
    if (out.some((m) => m.installId === Number(r.id))) continue;
    out.push({
      installId: Number(r.id),
      customer: r.customer,
      status: installStatusLabel(r),
      completedAt: r.completed_at,
      wo: r.wo,
      possibleDuplicateOf: r.duplicate_of == null ? null : Number(r.duplicate_of),
    });
  }
  return out;
}

// ── The ticket and the install as the merge reads them ─────────────────────────────────────────────────────────────

type TicketRow = {
  id: number;
  kind: string;
  call_id: string;
  wo: string | null;
  customer: string | null;
  status: string;
  duplicate_of: number | null;
  merged_install_id: number | null;
  issue: string | null;
  equipment: string | null;
  work_done: string | null;
  notes: string | null;
  po: string | null;
  contact: string | null;
  phone: string | null;
  technician: string | null;
  technician2: string | null;
  ns_so: string | null;
  discount_kind: string | null;
  discount_value: string | null;
  received: string | null;
  came_in: string | null;
  stamp: string;
};

type InstallRow = {
  id: number;
  customer: string;
  archived: boolean;
  duplicate_of: number | null;
  equip_status: string | null;
  complete: boolean;
  completed_at: string | null;
  stamp: string;
};

type HeadRow = {
  id: number;
  approved_at: string | Date | null;
  approved_by: string | null;
  submitted_at: string | Date | null;
  discount_kind: string | null;
  discount_value: string | null;
  po: string | null;
  stamp: string;
};

type Linked = {
  notes: number;
  pings: number;
  part_lines: number;
  merged_tickets: number;
  wo_history: number;
  has_quote: boolean;
  ns_invoices: string | null;
  /** Its NetSuite invoices that aren't Voided: the ones a billed ticket names as its billing. */
  live_ns_invoices: string | null;
  stacked_pms: string | null;
  ticket_approved_at: string | Date | null;
  ticket_approved_by: string | null;
};

type MoneyLine = { qty: number; rate: number; kind: ChargeKind };

const TICKET_COLS = `j.id, j.kind, j.call_id, j.wo, j.customer, j.status, j.duplicate_of, j.merged_install_id,
  j.issue, j.equipment, j.work_done, j.notes, j.po, j.contact, j.phone, j.technician, j.technician2, j.ns_so,
  j.discount_kind, j.discount_value::text as discount_value,
  to_char(j.received, 'YYYY-MM-DD') as received, to_char(${TICKET_CAME_IN}, 'YYYY-MM-DD') as came_in,
  j.updated_at::text as stamp`;

async function loadTicket(sql: Q, jobId: number): Promise<TicketRow | null> {
  return (await sql.query<TicketRow>(`select ${TICKET_COLS} from service_jobs j where j.id = $1`, [jobId]))[0] ?? null;
}

const toDiscount = (kind: string | null, value: string | number | null): Discount | null =>
  isDiscountKind(kind) && Number(value) > 0 ? { kind, value: Number(value) } : null;

function discountText(d: Discount): string {
  return d.kind === "percent" ? `${Number(d.value.toFixed(2))}%` : money(d.value);
}

/** "SC-202610-901 (WO-4792)": how the confirm and the refusals name the ticket. */
export function ticketLabel(t: { call_id: string; wo: string | null; id: number }): string {
  const wo = String(t.wo ?? "").trim();
  const call = String(t.call_id ?? "").trim() || `Ticket #${t.id}`;
  return wo ? `${call} (${wo})` : call;
}

const field = (label: string, value: string | null | undefined) => {
  const v = String(value ?? "").trim();
  return v ? `${label}: ${v}` : null;
};

/**
 * The text added under the install's notes: the ticket's own words, never anything of the install's replaced. A billed
 * ticket (10/30) ends with what it was billed on (its SO, or its NetSuite invoices) and how its charges carry over.
 */
export function installMergeNote(
  t: Pick<TicketRow, "id" | "call_id" | "wo" | "issue" | "equipment" | "work_done" | "notes" | "po" | "contact" | "phone" | "technician" | "technician2">,
  actor: string,
  today: string,
  billed: { text: string } | null = null,
): string {
  const lines = [
    field("Issue", t.issue),
    field("Equipment", String(t.equipment ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).join(", ")),
    field("Work done", t.work_done),
    field("Notes", t.notes),
    field("P.O.", t.po),
    field("Contact", [t.contact, t.phone].map((s) => String(s ?? "").trim()).filter(Boolean).join(" · ")),
    field("Tech", [t.technician, t.technician2].map((s) => String(s ?? "").trim()).filter(Boolean).join(" + ")),
    billed ? billed.text : null,
  ].filter((l): l is string => !!l);
  const head = `From ticket ${ticketLabel(t)}, merged ${formatLongDate(today)} by ${actor}${lines.length ? ":" : ". The ticket had nothing written on it."}`;
  return [head, ...lines].join("\n");
}

/**
 * The discount the install's invoice has once the ticket's lines are on it, or why the two can't go together (the same
 * rule as merging two tickets): neither has one; both the same percent; or the invoice has no lines and no discount
 * yet, so it takes the ticket's.
 */
export function invoiceDiscountAfter(
  ticket: Discount | null,
  invoice: Discount | null,
  invoiceLines: number,
  names: { ticket: string; install: string },
): { discount: Discount | null } | { refusal: string } {
  if (!ticket && !invoice) return { discount: null };
  if (invoiceLines === 0 && !invoice) return { discount: ticket };
  if (ticket && invoice && ticket.kind === "percent" && invoice.kind === "percent" && ticket.value === invoice.value) return { discount: invoice };
  if (ticket && invoice) {
    return { refusal: `${names.ticket} has a ${discountText(ticket)} discount and ${names.install}'s invoice has ${discountText(invoice)}; merged, only one would apply. Make them match first.` };
  }
  return ticket
    ? { refusal: `${names.ticket} has a ${discountText(ticket)} discount that ${names.install}'s invoice doesn't. Make them match first.` }
    : { refusal: `${names.install}'s invoice has a ${discountText(invoice!)} discount that ${names.ticket} doesn't. Make them match first.` };
}

export type InstallMergePreview = {
  ticket: { id: number; kind: "service" | "tlc"; callId: string; wo: string | null; customer: string | null; status: string; received: string | null };
  install: { id: number; customer: string; status: string; completedAt: string | null; invoice: "none" | "waiting" | "approved" };
  moves: {
    chargeLines: number;
    /** The ticket's charges with its discount. */
    chargeTotal: number;
    /** The install's invoice total once the lines are on it. */
    invoiceTotal: number;
    notes: number;
    pings: number;
    units: string[];
    partLines: number;
    rebuilds: string[];
    /** Tickets merged into this one before, which go with it. */
    mergedTickets: number;
    /** The P.O. the install's invoice has once the charges are on it (the invoice's own, else the ticket's), or null. */
    invoicePo: string | null;
    /**
     * A billed ticket (10/30): its charges stay billed in NetSuite and never go on the install's invoice; the install
     * lists them as billed. `so`: its Sales Order, or null when it has none and is billed on NetSuite invoices alone.
     * `invoices`: its NetSuite invoices that aren't Voided. `on`: what it is billed on, the SO or "NetSuite invoice …";
     * the confirm sends it back. `text` is what the confirm says. Null for an unbilled ticket.
     */
    billed: { so: string | null; invoices: string | null; on: string; text: string } | null;
  };
  /** What stays with the ticket. */
  stays: string[];
  /** Added under the install's notes. */
  note: string;
  warnings: string[];
  refusal: string | null;
  /** Sent back with the merge: it goes ahead only on the ticket, install and invoice this window showed. */
  stamps: { job: string; install: string; head: string };
};

type Plan = {
  preview: InstallMergePreview | null;
  refusal: string | null;
  ticket: TicketRow | null;
  install: InstallRow | null;
  discount: Discount | null;
};

async function actorName(sql: Q, userId: string): Promise<string> {
  return (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

const unitLabel = (u: { model: string | null; serial: string | null }) => `${(u.model || "Unit").trim()}${u.serial?.trim() ? ` SN ${u.serial.trim()}` : ""}`;

/** Everything the confirm shows and the merge checks, read fresh. */
async function planMerge(sql: Q, jobId: number, installId: number, actor: string): Promise<Plan> {
  const none = (refusal: string, ticket: TicketRow | null = null, install: InstallRow | null = null): Plan => ({ preview: null, refusal, ticket, install, discount: null });
  const t = await loadTicket(sql, jobId);
  if (!t) return none("That ticket is no longer on the list.");
  const i = (
    await sql.query<InstallRow>(
      `select i.id, i.customer, i.archived, i.duplicate_of, i.equip_status, i.complete, to_char(i.completed_at, 'YYYY-MM-DD') as completed_at,
              i.updated_at::text as stamp
         from installs i where i.id = $1`,
      [installId],
    )
  )[0];
  if (!i) return none("That install is no longer on the list.", t);
  const label = ticketLabel(t);
  const installName = `Install #${i.id}`;
  const kind: "service" | "tlc" = t.kind === "tlc" ? "tlc" : "service";

  const charges = (
    await sql.query<{ id: number; qty: string; rate: string; kind: ChargeKind }>(
      "select id, qty::text as qty, rate::text as rate, kind from ticket_charges where job_id = $1 order by sort, id",
      [jobId],
    )
  ).map((c): MoneyLine => ({ qty: Number(c.qty), rate: Number(c.rate), kind: c.kind }));
  const head = (
    await sql.query<HeadRow>(
      `select v.id, v.approved_at, v.approved_by, v.submitted_at, v.discount_kind, v.discount_value::text as discount_value, v.po,
              coalesce(v.id::text, '') || ':' || coalesce(v.approved_at::text, '') || ':' || coalesce(v.submitted_at::text, '') as stamp
         from invoices v where v.entity_type = 'install' and v.entity_id = $1`,
      [installId],
    )
  )[0];
  const headLines = head
    ? (await sql.query<{ qty: string; rate: string; kind: ChargeKind }>("select qty::text as qty, rate::text as rate, kind from invoice_lines where invoice_id = $1", [head.id])).map(
        (l): MoneyLine => ({ qty: Number(l.qty), rate: Number(l.rate), kind: l.kind }),
      )
    : [];
  const linked = (
    await sql.query<Linked>(
      `select
         (select count(*)::int from comments c where c.entity_type in ('service', 'tlc') and c.entity_id = $1) as notes,
         (select count(*)::int from desk_notifications n where n.entity_type in ('service', 'tlc') and n.entity_id = $1) as pings,
         (select count(*)::int from ticket_part_lines p
           where p.job_id = $1 or p.job_id in (select s.id from service_jobs s where s.duplicate_of = $1 and s.id <> $1)) as part_lines,
         (select count(*)::int from service_jobs s where s.duplicate_of = $1 and s.id <> $1) as merged_tickets,
         (select count(*)::int from wo_history h
           where h.job_id = $1 or h.job_id in (select s.id from service_jobs s where s.duplicate_of = $1 and s.id <> $1)) as wo_history,
         exists (select 1 from repair_quotes q where q.job_id = $1) as has_quote,
         (select string_agg(ti.ns_invoice, ', ' order by ti.id) from ticket_invoices ti where ti.job_id = $1) as ns_invoices,
         (select string_agg(ti.ns_invoice, ', ' order by ti.id) from ticket_invoices ti
           where ti.job_id = $1 and lower(regexp_replace(ti.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')) as live_ns_invoices,
         (select string_agg(p.id::text, ',' order by p.id) from pm_jobs p where p.stacked_job_id = $1) as stacked_pms,
         (select v.approved_at from invoices v where v.entity_type in ('service', 'tlc') and v.entity_id = $1 order by v.id limit 1) as ticket_approved_at,
         (select v.approved_by from invoices v where v.entity_type in ('service', 'tlc') and v.entity_id = $1 order by v.id limit 1) as ticket_approved_by`,
      [jobId],
    )
  )[0]!;
  const units = await sql.query<{ model: string | null; serial: string | null }>("select model, serial from assets where job_id = $1 order by id", [jobId]);
  const rebuilds = await sql.query<{ id: number; title: string | null }>("select id, title from rebuilds where job_id = $1 order by id", [jobId]);
  const digits = woDigits(t.wo);
  const matches = digits ? matchInstalls(t, await loadInstallWoRows(sql, [digits])) : [];

  const ticketDiscount = toDiscount(t.discount_kind, t.discount_value);
  const headDiscount = head ? toDiscount(head.discount_kind, head.discount_value) : null;
  const headState: InstallMergePreview["install"]["invoice"] = !head ? "none" : head.approved_at ? "approved" : head.submitted_at ? "waiting" : "none";
  // Billed on a Sales Order (10/30): the charges stay billed there, so none go on the install's invoice and nothing
  // about that invoice (approved, its discount or P.O., its size) stops the merge. Its NetSuite invoices are the same
  // billing. With no SO, NetSuite invoices that aren't Voided are its billing the same way (Chuy, 10/30: they carry
  // over when they're for the same WO, and they are: the Billing Backfill puts an invoice only on a ticket with its WO,
  // and a ticket merges only into an install with that WO). Unbilled, the charges go on the invoice as before.
  const billedSo = t.ns_so?.trim() || null;
  const liveInvoices = linked.live_ns_invoices?.trim() || null;
  const billedOn = billedSo ?? (liveInvoices ? nsInvoicesLabel(liveInvoices) : null);
  const billed = billedOn
    ? { so: billedSo, invoices: liveInvoices, on: billedOn, text: billedCarryOver(billedOn, billedSo ? liveInvoices : null) }
    : null;
  const toInvoice = billed ? [] : charges;
  const after = toInvoice.length ? invoiceDiscountAfter(ticketDiscount, headDiscount, headLines.length, { ticket: label, install: installName }) : { discount: headDiscount };
  // One invoice takes one P.O. (10/30): the invoice's own, else the ticket's, which goes on it with the charges.
  const ticketPo = t.po?.trim() || null;
  const headPo = head?.po?.trim() || null;
  const poClash = !!(toInvoice.length && ticketPo && headPo && ticketPo.toLowerCase() !== headPo.toLowerCase());

  // The first reason wins.
  const refusal = ((): string | null => {
    if (t.merged_install_id) return `${label} was already merged into install #${t.merged_install_id}.`;
    if (t.duplicate_of) return `${label} was merged into ticket #${t.duplicate_of}. Merge that ticket into the install instead.`;
    if (!woMatchKey(t.wo ?? "")) return `${label} has no WO number.`;
    if (i.archived) return i.duplicate_of ? `${installName} was merged into install #${i.duplicate_of}. Merge into that one.` : `${installName} was archived.`;
    if (i.duplicate_of) return `${installName} is flagged as a possible duplicate of install #${i.duplicate_of}. Merge those installs or clear the flag first.`;
    if (!matches.some((m) => m.installId === i.id)) return `${installName} doesn't carry ${t.wo?.trim() || "this WO"} (this run of WO numbers).`;
    if (!customersCompatible(t.customer, i.customer)) {
      return `${label} is for ${t.customer?.trim()} and ${installName} is for ${i.customer.trim()}. If they're the same place, fix the ticket's customer first.`;
    }
    // NetSuite invoices, all Voided, and no Sales Order: it isn't billed, but it was. Still refused (one that stands
    // carries over as billed).
    if (linked.ns_invoices && !billed) return `${label} has NetSuite invoices (${linked.ns_invoices}), all Voided. An invoiced ticket stays as it is.`;
    if (linked.has_quote) return `${label} has a repair quote, and installs don't keep repair quotes. Finish or take off the quote first.`;
    if (linked.stacked_pms) return `PM #${linked.stacked_pms.split(",")[0]} is billed on ${label}. Unstack it first: installs don't carry PMs.`;
    // QuickBooks invoiced this WO: its charges may be billed already, so they don't go on the install's invoice.
    if (toInvoice.length && linked.wo_history) {
      return `${label} has QuickBooks history, so its charges may be billed already. Take its charges off the ticket first, or keep the ticket.`;
    }
    if (toInvoice.length && head?.approved_at) {
      return `${installName}'s invoice is already approved, so ${label}'s ${plural(toInvoice.length, "charge line")} can't go on it. Add them to the install's invoice by hand and take them off the ticket, then merge.`;
    }
    if ("refusal" in after) return after.refusal;
    if (poClash) return `${label} has P.O. ${ticketPo} and ${installName}'s invoice has P.O. ${headPo}. One invoice takes one P.O.: make them match first.`;
    if (headLines.length + toInvoice.length > 200) return `Together that's more than 200 lines on ${installName}'s invoice.`;
    return null;
  })();

  const warnings: string[] = [];
  if (toInvoice.length && linked.ticket_approved_at) {
    warnings.push(
      `${label}'s invoice was approved${linked.ticket_approved_by ? ` by ${linked.ticket_approved_by}` : ""} on ${formatLongDate(todayChicago(new Date(linked.ticket_approved_at)))}. On the install it waits for an Admin to approve it again.`,
    );
  }
  if (normalizeCustomerKey(t.customer) !== normalizeCustomerKey(i.customer)) {
    warnings.push(`The ticket is on ${t.customer?.trim() || "no customer"}; the install keeps ${i.customer.trim()}.`);
  }
  const stays: string[] = ["Its own record and history"];
  if (billed) stays.push(billed.so ? `Its Sales Order ${billed.so}${billed.invoices ? ` and ${nsInvoicesLabel(billed.invoices)}` : ""}` : `Its ${billed.on}`);
  if (charges.length) stays.push(billed ? `Its charge lines, billed on ${billed.on} (the install lists them as billed)` : "A copy of its charge lines (only the install's invoice is billed)");
  if (linked.wo_history) stays.push(plural(linked.wo_history, "QuickBooks history row"));

  const discount = "discount" in after ? after.discount : null;
  const preview: InstallMergePreview = {
    ticket: { id: t.id, kind, callId: t.call_id, wo: t.wo, customer: t.customer, status: t.status, received: t.received },
    install: { id: i.id, customer: i.customer, status: installStatusLabel(i), completedAt: i.completed_at, invoice: headState },
    moves: {
      chargeLines: charges.length,
      chargeTotal: invoiceTotals(charges, ticketDiscount).total,
      invoiceTotal: invoiceTotals([...headLines, ...toInvoice], discount).total,
      notes: Number(linked.notes) || 0,
      pings: Number(linked.pings) || 0,
      units: units.map(unitLabel),
      partLines: Number(linked.part_lines) || 0,
      rebuilds: rebuilds.map((r) => (r.title?.trim() ? `${r.title.trim()} (#${r.id})` : `Rebuild #${r.id}`)),
      mergedTickets: Number(linked.merged_tickets) || 0,
      invoicePo: toInvoice.length ? (headPo ?? ticketPo) : null,
      billed,
    },
    stays,
    note: installMergeNote(t, actor, todayChicago(), billed),
    warnings,
    refusal,
    stamps: { job: t.stamp, install: i.stamp, head: head?.stamp ?? "" },
  };
  return { preview, refusal, ticket: t, install: i, discount };
}

// ── The merge ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** "1 charge line" / "3 charge lines" from a CTE's rows, or null when it has none (concat_ws skips it). */
const counted = (cte: string, one: string, many: string) =>
  `case (select count(*) from ${cte}) when 0 then null when 1 then '1 ${one}' else (select count(*) from ${cte})::text || ' ${many}' end`;

const MOVED = `coalesce(' · moved ' || nullif(concat_ws(', ',
    ${counted("lines", "charge line (waiting for approval)", "charge lines (waiting for approval)")},
    ${counted("com", "Ping note", "Ping notes")},
    ${counted("pings", "ping", "pings")},
    ${counted("units", "unit", "units")},
    ${counted("parts", "part line", "part lines")},
    ${counted("reb", "rebuild", "rebuilds")},
    ${counted("kids", "ticket merged into it", "tickets merged into it")}), ''), ' · nothing else was on the ticket')`;

/** A billed ticket ($14, what it is billed on): its charges stay billed there (10/30). */
const BILLED = `case when $14::text <> '' then ' · its charges stay billed on ' || $14::text || ', not billed again' else '' end`;

/**
 * One statement: fold the ticket into the install, or write nothing. $1 ticket, $2 install, $3 who, $4 the ticket's
 * stamp, $5 the install's, $6 its invoice's ('' when it has none), all as the confirm read them; $7 the text added under
 * the install's notes; $8 the install invoice's total once the lines are on it, $9 and $10 its discount; $11 the
 * ticket's P.O., for an invoice that has none; $12 the Sales Order the ticket is billed on ('' when it isn't), as the
 * confirm read it; $13 its charges' total, billed there; $14 what it is billed on ('' when unbilled): the SO, or with
 * none "NetSuite invoice …" (10/30); $15 its NetSuite invoices that aren't Voided, as read ('' for none).
 *
 * Both rows and the install's invoice are locked, then checked as they are now: nothing is written when any of them
 * changed (its Sales Order too), the ticket is quoted, carries a PM or is already merged, or (unbilled) is invoiced in
 * NetSuite, or the install is archived or flagged as a duplicate, or its invoice is approved while an unbilled ticket
 * has charges. A billed ticket (10/30) puts nothing on the install's invoice: its charges stay billed on its SO, or on
 * its NetSuite invoices (which must still be the ones read), and the merge log keeps a copy of them with what they were
 * billed on. Zero rows means nothing was written.
 */
export function mergeTicketIntoInstallSql(): string {
  return `with lk_job as (
    select j.id, j.kind, j.call_id, j.wo, j.ns_so, j.duplicate_of, j.merged_install_id, j.updated_at::text as stamp
      from service_jobs j
     where j.id = $1::int
       for update
  ), lk_inst as (
    select i.id, i.customer, i.archived, i.duplicate_of, i.updated_at::text as stamp
      from installs i
     where i.id = $2::int
       for update
  ), lk_head as (
    select v.id, v.approved_at,
           coalesce(v.id::text, '') || ':' || coalesce(v.approved_at::text, '') || ':' || coalesce(v.submitted_at::text, '') as stamp
      from invoices v
     where v.entity_type = 'install' and v.entity_id = $2::int
       for update
  ), g as (
    -- charges: the lines that go on the install's invoice (none for a billed ticket).
    select j.id as job_id, j.kind, j.call_id, j.wo, i.id as install_id, i.customer as install_customer,
           case when $14::text = '' then (select count(*)::int from ticket_charges c where c.job_id = j.id) else 0 end as charges
      from lk_job j cross join lk_inst i
     where j.stamp = $4::text and i.stamp = $5::text
       -- The install's invoice as the confirm read it, for an unbilled ticket (a billed one puts nothing on it).
       and ($14::text <> '' or coalesce((select h.stamp from lk_head h), '') = $6::text)
       and j.duplicate_of is null and j.merged_install_id is null and j.kind in ('service', 'tlc')
       -- The Sales Order as the confirm read it, on the locked row: one entered or cleared since stops the merge.
       and coalesce(nullif(btrim(j.ns_so), ''), '') = $12::text
       -- Billed on its SO, billed on NetSuite invoices with no SO, or unbilled: never anything else.
       and ($12::text = '' or $14::text = $12::text)
       and ($12::text <> '' or $14::text = '' or $15::text <> '')
       -- Billed on NetSuite invoices alone: still those invoices, none Voided or added since, read fresh.
       and ($12::text <> '' or $14::text = '' or coalesce(ticket_live_ns_invoices(j.id), '') = $15::text)
       and i.archived = false and i.duplicate_of is null
       -- Read with a fresh snapshot: a PM stacked (or an invoice or quote added) while this waited for the locks counts.
       -- A billed ticket carries its NetSuite invoices over with its charges.
       and (case when $14::text = '' then not ticket_keeps_its_billing(j.id) else not ticket_has_quote_or_stacked_pm(j.id) end)
       and not (
         $14::text = ''
         and exists (select 1 from lk_head h where h.approved_at is not null)
         and exists (select 1 from ticket_charges c where c.job_id = j.id)
       )
       -- QuickBooks history (its own, or a ticket's merged into it), read the same way: its charges may be billed already.
       and not (
         $14::text = ''
         and exists (select 1 from ticket_charges c where c.job_id = j.id)
         and ticket_has_quickbooks_history(j.id)
       )
  ), head as (
    -- The charges go on the install's invoice, waiting for an Admin to approve them; never onto an approved one. The
    -- saved-for-approval stamp moves, so an Invoice window opened before this approves nothing until it reloads.
    -- The ticket's P.O. goes with the charges onto an invoice that has none (one that has one keeps it: the confirm
    -- refused a different one).
    insert into invoices (entity_type, entity_id, customer, discount_kind, discount_value, total, submitted_by, submitted_at, updated_at, po)
    select 'install', g.install_id, g.install_customer, $9::text, $10::numeric, $8::numeric, $3::text, now(), now(), $11::text
      from g
     where g.charges > 0
    on conflict (entity_type, entity_id) do update
       set discount_kind = excluded.discount_kind, discount_value = excluded.discount_value, total = excluded.total,
           submitted_by = excluded.submitted_by, submitted_at = excluded.submitted_at, updated_at = now(),
           po = coalesce(nullif(btrim(invoices.po), ''), excluded.po)
     -- Only the invoice the confirm read: one approved, or saved again, or made since, takes nothing.
     where invoices.approved_at is null
       and coalesce(invoices.id::text, '') || ':' || coalesce(invoices.approved_at::text, '') || ':' || coalesce(invoices.submitted_at::text, '') = $6::text
    returning id
  ), ok as (
    select g.* from g where g.charges = 0 or exists (select 1 from head)
  ), lines as (
    -- A copy of each charge line, after the invoice's own lines. The ticket keeps its lines; it is hidden and never billed.
    insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort)
    select head.id, c.item, c.description, c.qty, c.rate, c.kind,
           coalesce((select max(l.sort) from invoice_lines l where l.invoice_id = head.id), 0) + row_number() over (order by c.sort, c.id)
      from head
      cross join ok
      join ticket_charges c on c.job_id = ok.job_id
    returning id
  ), com as (
    update comments c set entity_type = 'install', entity_id = ok.install_id
      from ok
     where c.entity_type in ('service', 'tlc') and c.entity_id = ok.job_id
    returning c.id
  ), pings as (
    update desk_notifications n set entity_type = 'install', entity_id = ok.install_id
      from ok
     where n.entity_type in ('service', 'tlc') and n.entity_id = ok.job_id
    returning n.id
  ), units as (
    -- Units pulled onto the ticket are the install's now: the install lists them, and a service purpose becomes Install.
    update assets a
       set install_id = ok.install_id,
           job_id = null,
           purpose = case a.purpose when 'Service' then 'Install' when 'Customer-owned / service loaner' then 'Customer-owned / loaner' else a.purpose end,
           sold_to = case when a.status = 'assigned' then ok.install_customer else a.sold_to end,
           updated_at = now()
      from ok
     where a.job_id = ok.job_id
    returning a.id
  ), parts as (
    -- Its WO part lines, and those of tickets merged into it before (a ticket merge leaves them where they were).
    update ticket_part_lines p set install_id = ok.install_id, job_id = null
      from ok
     where p.job_id = ok.job_id
        or p.job_id in (select s.id from service_jobs s where s.duplicate_of = ok.job_id and s.id <> ok.job_id)
    returning p.id
  ), reb as (
    -- A rebuild already tied to an install keeps that install; it only leaves the ticket.
    update rebuilds r set install_id = coalesce(r.install_id, ok.install_id), job_id = null, updated_at = now()
      from ok
     where r.job_id = ok.job_id
    returning r.id
  ), inst as (
    -- Added under the install's notes, never in place of them.
    update installs i
       set notes = case
                     when nullif(btrim(i.notes, E' \\t\\r\\n'), '') is null then $7::text
                     else rtrim(i.notes, E' \\t\\r\\n') || E'\\n\\n' || $7::text
                   end,
           updated_at = now()
      from ok
     where i.id = ok.install_id
    returning i.id
  ), job as (
    update service_jobs s
       set duplicate_of = s.id, merged_install_id = ok.install_id, merged_install_at = now(), merged_install_by = $3::text,
           done = true, updated_at = now()
      from ok
     where s.id = ok.job_id
    returning s.id
  ), kids as (
    -- Tickets merged into this one before go with it: a later import of their WO finds the install too.
    update service_jobs s
       set merged_install_id = ok.install_id, merged_install_at = now(), merged_install_by = $3::text, updated_at = now()
      from ok
     where s.duplicate_of = ok.job_id and s.id <> ok.job_id and s.merged_install_id is null
    returning s.id
  ), logged as (
    insert into ticket_install_merges (job_id, install_id, merged_by, note, moved)
    select ok.job_id, ok.install_id, $3::text, $7::text,
           jsonb_build_object(
             'charges', coalesce((select jsonb_agg(c.id order by c.id) from ticket_charges c where c.job_id = ok.job_id), '[]'::jsonb),
             'invoiceId', (select head.id from head),
             'ticketPo', $11::text,
             -- Billed: what on (the SO, or with none its NetSuite invoices), the SO, its NetSuite invoices, and a copy of
             -- the charges billed there, which the install's Invoice window lists as billed (never on its invoice).
             'billedOn', nullif($14::text, ''),
             'billedSo', nullif($12::text, ''),
             'billedInvoices', case when $14::text = '' then null when $12::text = '' then $15::text else (
               select string_agg(ti.ns_invoice, ', ' order by ti.id) from ticket_invoices ti
                where ti.job_id = ok.job_id and lower(regexp_replace(ti.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')) end,
             'billedLines', case when $14::text <> '' then coalesce((
               select jsonb_agg(jsonb_build_object('item', c.item, 'description', c.description, 'qty', c.qty, 'rate', c.rate, 'kind', c.kind) order by c.sort, c.id)
                 from ticket_charges c where c.job_id = ok.job_id), '[]'::jsonb) end,
             'billedTotal', case when $14::text <> '' then $13::numeric end,
             'invoiceLines', coalesce((select jsonb_agg(x.id order by x.id) from lines x), '[]'::jsonb),
             'notes', coalesce((select jsonb_agg(x.id order by x.id) from com x), '[]'::jsonb),
             'pings', coalesce((select jsonb_agg(x.id order by x.id) from pings x), '[]'::jsonb),
             'units', coalesce((select jsonb_agg(x.id order by x.id) from units x), '[]'::jsonb),
             'partLines', coalesce((select jsonb_agg(x.id order by x.id) from parts x), '[]'::jsonb),
             'rebuilds', coalesce((select jsonb_agg(x.id order by x.id) from reb x), '[]'::jsonb),
             'tickets', coalesce((select jsonb_agg(x.id order by x.id) from kids x), '[]'::jsonb)
           )
      from ok
    returning id
  ), act as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select 'install', ok.install_id, $3::text, 'merged',
           'Merged ticket ' || ok.call_id || coalesce(' (' || nullif(btrim(ok.wo), '') || ')', '') || ' into this install' || ${BILLED} || ${MOVED}
      from ok
    union all
    select ok.kind, ok.job_id, $3::text, 'merged',
           'Merged into install #' || ok.install_id::text || ' (' || ok.install_customer || ')' || ${BILLED} || ${MOVED}
      from ok
    union all
    select 'asset', u.id, $3::text, 'merged',
           'Moved from ticket ' || ok.call_id || ' to install #' || ok.install_id::text || ' (the ticket was merged into it)'
      from units u cross join ok
    returning id
  )
  select ok.job_id, ok.install_id,
         (select count(*)::int from lines) as charge_lines,
         (select count(*)::int from com) as notes,
         (select count(*)::int from pings) as pings,
         (select count(*)::int from units) as units,
         (select count(*)::int from parts) as part_lines,
         (select count(*)::int from reb) as rebuilds,
         (select count(*)::int from kids) as merged_tickets,
         (select count(*)::int from inst) as installs_noted,
         (select count(*)::int from job) as jobs,
         (select count(*)::int from logged) as logged,
         (select count(*)::int from act) as activity
    from ok`;
}

export type TicketInstallMergeResult = {
  jobId: number;
  installId: number;
  chargeLines: number;
  notes: number;
  pings: number;
  units: number;
  partLines: number;
  rebuilds: number;
  mergedTickets: number;
  mergedBy: string;
  /**
   * What its charges stay billed on (10/30): the Sales Order, or with none "NetSuite invoice …"; null when they went on
   * the install's invoice.
   */
  billedOn: string | null;
};

const target = z.object({ jobId: z.number().int().positive(), installId: z.number().int().positive() });
const mergeInput = target.extend({
  stamps: z.object({ job: z.string().max(80), install: z.string().max(80), head: z.string().max(200) }),
  /**
   * The Sales Order the confirm showed the charges billed on ('' when it showed them going on the install's invoice).
   * Sent by the confirm from 10/30 on, outside the stamps, so a window from before that (which doesn't know billed
   * tickets and would say their charges go on the invoice) sends none, and a billed ticket isn't merged from it.
   */
  billedSo: z.string().max(80).optional(),
  /**
   * What the confirm showed the charges billed on ('' when unbilled): the SO, or "NetSuite invoice …" for a ticket with
   * none. Sent from 10/30 evening on: a window from before that refused such a ticket, so one that sends none doesn't
   * merge it.
   */
  billedOn: z.string().max(2000).optional(),
});

/** The confirm's content: what is kept, what moves, what stays, the note, and why it can't go ahead. Admins only. */
export async function previewTicketInstallMergeFor(sql: Q, userId: string, data: z.infer<typeof target>): Promise<InstallMergePreview> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error(ADMIN_ONLY);
  const plan = await planMerge(sql, data.jobId, data.installId, await actorName(sql, userId));
  if (!plan.preview) throw new Error(plan.refusal ?? "That ticket can't be merged.");
  return plan.preview;
}

/**
 * Merge the ticket into the install, as the confirm showed it ($stamps): Admins only. Refuses with the reason when it
 * can't go ahead, or when anything changed since the confirm was read.
 */
export async function mergeTicketIntoInstallFor(sql: Q, userId: string, data: z.infer<typeof mergeInput>): Promise<TicketInstallMergeResult> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error(ADMIN_ONLY);
  const actor = await actorName(sql, userId);
  const plan = await planMerge(sql, data.jobId, data.installId, actor);
  if (plan.refusal || !plan.preview || !plan.ticket || !plan.install) throw new Error(plan.refusal ?? "That ticket can't be merged.");
  const s = plan.preview.stamps;
  const billed = plan.preview.moves.billed;
  const so = billed?.so ?? "";
  const on = billed?.on ?? "";
  // A window from before billed tickets could merge: it showed the charges going on the invoice. Reload, then merge.
  if (so && data.billedSo === undefined) throw new Error(RELOAD_FOR_BILLED(so));
  // The same for a ticket billed on NetSuite invoices with no SO: a window from before 10/30 evening refused it.
  if (on && !so && data.billedOn === undefined) throw new Error(RELOAD_FOR_BILLED(on));
  // The install's invoice matters only to an unbilled ticket: a billed one puts nothing on it.
  const headChanged = !on && s.head !== data.stamps.head;
  // What it is billed on, as the confirm showed it (a window from before 10/30 evening sends only the SO).
  const shownOn = data.billedOn === undefined ? (data.billedSo ?? "") : data.billedOn;
  if (s.job !== data.stamps.job || s.install !== data.stamps.install || headChanged || so !== (data.billedSo ?? "") || on !== shownOn) {
    throw new Error(CHANGED_SINCE_OPENED);
  }
  const rows = await sql.query<{
    job_id: number;
    install_id: number;
    charge_lines: number;
    notes: number;
    pings: number;
    units: number;
    part_lines: number;
    rebuilds: number;
    merged_tickets: number;
  }>(mergeTicketIntoInstallSql(), [
    data.jobId,
    data.installId,
    actor,
    s.job,
    s.install,
    s.head,
    plan.preview.note,
    plan.preview.moves.invoiceTotal,
    plan.discount?.kind ?? null,
    plan.discount?.value ?? null,
    plan.ticket.po?.trim() || null,
    so,
    billed ? plan.preview.moves.chargeTotal : null,
    on,
    billed?.invoices ?? "",
  ]);
  const r = rows[0];
  if (!r) {
    // A check came true after the read above (a Sales Order, an approval, an edit): say which, if it is one of ours.
    const again = await planMerge(sql, data.jobId, data.installId, actor);
    throw new Error(again.refusal ?? CHANGED_SINCE_OPENED);
  }
  return {
    jobId: Number(r.job_id),
    installId: Number(r.install_id),
    chargeLines: Number(r.charge_lines),
    notes: Number(r.notes),
    pings: Number(r.pings),
    units: Number(r.units),
    partLines: Number(r.part_lines),
    rebuilds: Number(r.rebuilds),
    mergedTickets: Number(r.merged_tickets),
    mergedBy: actor,
    billedOn: on || null,
  };
}

/** The installs a ticket's WO is on, for its Merge into install button. Admins only; anyone else gets none. */
export async function ticketInstallMatchesFor(sql: Q, userId: string, jobId: number): Promise<InstallMatch[]> {
  if (!(await canReviewNames(sql as Sql, userId))) return [];
  const t = await loadTicket(sql, jobId);
  if (!t || t.duplicate_of || t.merged_install_id || !woMatchKey(t.wo ?? "")) return [];
  const digits = woDigits(t.wo);
  return digits ? matchInstalls(t, await loadInstallWoRows(sql, [digits])) : [];
}

// ── The Admin's list ────────────────────────────────────────────────────────────────────────────────────────────────

export type TicketInstallPair = {
  jobId: number;
  kind: "service" | "tlc";
  callId: string;
  wo: string;
  customer: string | null;
  status: string;
  received: string | null;
  install: InstallMatch;
};

export type RecentInstallMerge = {
  jobId: number;
  kind: "service" | "tlc";
  callId: string;
  wo: string | null;
  installId: number;
  installCustomer: string;
  mergedBy: string | null;
  mergedAt: string;
};

export type TicketInstallPairs = { admin: boolean; pairs: TicketInstallPair[]; merged: RecentInstallMerge[] };

/** Live tickets whose WO is on an install (this run of numbers), and the last merges. Admins only. */
export async function listTicketInstallPairsFor(sql: Q, userId: string, kind: "service" | "tlc" | null): Promise<TicketInstallPairs> {
  if (!(await canReviewNames(sql as Sql, userId))) return { admin: false, pairs: [], merged: [] };
  const installs = await loadInstallWoRows(sql, null);
  const digits = [...new Set(installs.map((r) => woDigits(r.wo)).filter(Boolean))];
  const tickets = digits.length
    ? await sql.query<TicketRow>(
        `select ${TICKET_COLS} from service_jobs j
          where j.duplicate_of is null and j.merged_install_id is null and coalesce(btrim(j.wo), '') <> ''
            and ($1::text is null or j.kind = $1)
            and ltrim(regexp_replace(j.wo, '[^0-9]', '', 'g'), '0') = any($2::text[])
          order by j.id`,
        [kind, digits],
      )
    : [];
  const pairs: TicketInstallPair[] = [];
  for (const t of tickets) {
    for (const m of matchInstalls(t, installs)) {
      pairs.push({
        jobId: Number(t.id),
        kind: t.kind === "tlc" ? "tlc" : "service",
        callId: t.call_id,
        wo: String(t.wo ?? "").trim(),
        customer: t.customer,
        status: t.status,
        received: t.received,
        install: m,
      });
    }
  }
  const merged = (
    await sql.query<{ job_id: number; kind: string; call_id: string; wo: string | null; install_id: number; customer: string; merged_by: string | null; merged_at: string | Date }>(
      `select m.job_id, j.kind, j.call_id, j.wo, m.install_id, i.customer, m.merged_by, m.merged_at
         from ticket_install_merges m join service_jobs j on j.id = m.job_id join installs i on i.id = m.install_id
        where ($1::text is null or j.kind = $1)
        order by m.merged_at desc, m.id desc
        limit 10`,
      [kind],
    )
  ).map((r) => ({
    jobId: Number(r.job_id),
    kind: (r.kind === "tlc" ? "tlc" : "service") as "service" | "tlc",
    callId: r.call_id,
    wo: r.wo,
    installId: Number(r.install_id),
    installCustomer: r.customer,
    mergedBy: r.merged_by,
    mergedAt: new Date(r.merged_at).toISOString(),
  }));
  return { admin: true, pairs, merged };
}

// ── After a merge: where a hidden ticket's work went ────────────────────────────────────────────────────────────────

/**
 * The install a ticket was merged into, and the live one its work is on now: the install itself, or the install it
 * went into later (liveInstallIds). liveInstallId is null when that ends archived. Null for a ticket not merged into one.
 */
export async function mergedInstallTarget(sql: Q, jobId: number): Promise<{ installId: number; liveInstallId: number | null } | null> {
  const r = (await sql.query<{ merged_install_id: number | null }>("select merged_install_id from service_jobs where id = $1", [jobId]))[0];
  if (r?.merged_install_id == null) return null;
  const installId = Number(r.merged_install_id);
  return { installId, liveInstallId: (await liveInstallIds(sql, [installId])).get(installId) ?? null };
}

/**
 * Each install's live one: itself, or, once it was merged into another, the install it went into, as many merges on as
 * it takes (20 at most, so a loop ends). Only through install merges: one removed while flagged as a possible duplicate
 * keeps the flag in duplicate_of too, but its work went nowhere. Install merges log "merged into install #N" on the
 * install they drop (mergeInstallsFor). An install removed, or whose chain ends removed, has none.
 */
export async function liveInstallIds(sql: Q, ids: number[]): Promise<Map<number, number>> {
  if (!ids.length) return new Map();
  const rows = await sql.query<{ start_id: number; id: number }>(
    `with recursive hop as (
       select i.id as start_id, i.id, i.archived, i.duplicate_of, 0 as depth
         from installs i
        where i.id = any($1::int[])
       union all
       select h.start_id, n.id, n.archived, n.duplicate_of, h.depth + 1
         from hop h
         join installs n on n.id = h.duplicate_of
        where h.archived and h.depth < 20
          and exists (
            select 1 from activity a
             where a.entity_type = 'install' and a.entity_id = h.id and a.action = 'merged'
               and a.detail = 'merged into install #' || h.duplicate_of::text
          )
     )
     select distinct on (start_id) start_id, id from hop where not archived order by start_id, depth`,
    [ids],
  );
  return new Map(rows.map((r) => [Number(r.start_id), Number(r.id)]));
}

// ── Server functions ────────────────────────────────────────────────────────────────────────────────────────────────

export const getTicketInstallMatches = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<InstallMatch[]> => ticketInstallMatchesFor(await ready(), context.userId, data.jobId));

export const previewTicketInstallMerge = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof target>) => target.parse(d))
  .handler(async ({ data, context }): Promise<InstallMergePreview> => previewTicketInstallMergeFor(await ready(), context.userId, data));

export const mergeTicketIntoInstall = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof mergeInput>) => mergeInput.parse(d))
  .handler(async ({ data, context }): Promise<TicketInstallMergeResult> => mergeTicketIntoInstallFor(await ready(), context.userId, data));

export const listTicketInstallPairs = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { kind: "service" | "tlc" }) => z.object({ kind: z.enum(["service", "tlc"]) }).parse(d))
  .handler(async ({ data, context }): Promise<TicketInstallPairs> => listTicketInstallPairsFor(await ready(), context.userId, data.kind));
