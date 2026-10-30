/**
 * NetSuite invoices on tickets and the invoice lock (Grok's billing request through Chuy, 2026-10-28).
 *
 * - A ticket's invoices are read-only here: they come in through the Admin's Billing Backfill.
 * - A ticket with an invoice that isn't Voided is locked for everyone: charges, P.O., discount and Sales Order.
 * - An Admin can unlock it with a reason. Who, when and why go on the ticket's history. Saving locks it again, and
 *   an unlock nobody saves ends by itself after UNLOCK_MINUTES.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  LIVE_INVOICE_SQL,
  chargesMismatch,
  cleanUnlockReason,
  liveInvoiceTotal,
  liveInvoices,
  lockingInvoice,
  locationWarning,
  possibleDoubleBill,
  stripServiceChannelId,
  unlockActive,
  UNLOCK_MINUTES,
  type InvoiceLite,
} from "@/lib/ops/billing-rules";
import { applyDiscount, isDiscountKind, type Discount } from "@/lib/ops/discount";
import { nameKey } from "@/lib/ops/wo-history";
import { mergedTicketRefusal, type MergedTicketRow } from "@/lib/ops/merged-ticket";

type Q = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

/** SQL: the ticket has a live NetSuite invoice (one that isn't Voided). Defined with the pure rules. */
export { LIVE_INVOICE_SQL };

/**
 * SQL: the ticket row is as this statement first read it. A lock check that reads ticket_invoices sees the statement's
 * snapshot, even after waiting for the row: an invoice the Billing Backfill commits meanwhile is missed. The backfill
 * touches every ticket it writes, so comparing the row (re-read after the wait) with the snapshot catches it, and the
 * write is skipped (10/28 review; tried on Postgres 16).
 */
export const UNCHANGED_SINCE_READ = (alias: string, idParam: string) =>
  `${alias}.updated_at = (select seen_row.updated_at from service_jobs seen_row where seen_row.id = ${idParam})`;

/** SQL: the Admin's unlock on this ticket row is still open. */
export const UNLOCKED_SQL = (alias: string) =>
  `(${alias}.billing_unlocked_at is not null and ${alias}.billing_unlocked_at > now() - interval '${UNLOCK_MINUTES} minutes')`;

export type StoredInvoice = InvoiceLite & {
  id: number;
  jobId: number;
  source: "so" | "standalone";
  addedBy: string | null;
  addedAt: string | null;
  updatedAt: string | null;
};

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const stamp = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

/** Each ticket's NetSuite invoices, oldest first. null: every ticket. */
export async function loadInvoices(sql: Q, jobIds: number[] | null): Promise<Map<number, StoredInvoice[]>> {
  const rows = await sql.query<{
    id: number;
    job_id: number;
    ns_invoice: string;
    ns_so: string | null;
    invoice_date: string | null;
    status: string;
    total: string | null;
    amount_remaining: string | null;
    source: string;
    location: string | null;
    added_by: string | null;
    added_at: unknown;
    updated_at: unknown;
  }>(
    `select id, job_id, ns_invoice, ns_so, to_char(invoice_date, 'YYYY-MM-DD') as invoice_date, status, total::text as total,
            amount_remaining::text as amount_remaining, source, location, added_by, added_at, updated_at
       from ticket_invoices
      where ($1::int[] is null or job_id = any($1::int[]))
      order by job_id, invoice_date nulls last, id`,
    [jobIds],
  );
  const out = new Map<number, StoredInvoice[]>();
  for (const r of rows) {
    const jobId = Number(r.job_id);
    const list = out.get(jobId) ?? [];
    list.push({
      id: Number(r.id),
      jobId,
      invoice: r.ns_invoice,
      so: r.ns_so,
      date: r.invoice_date,
      status: r.status,
      total: num(r.total),
      remaining: num(r.amount_remaining),
      source: r.source === "standalone" ? "standalone" : "so",
      location: r.location,
      addedBy: r.added_by,
      addedAt: stamp(r.added_at),
      updatedAt: stamp(r.updated_at),
    });
    out.set(jobId, list);
  }
  return out;
}

export type ChargeNet = { lines: number; subtotal: number; off: number; net: number; discount: Discount | null };

/** Each ticket's charge lines added up, its discount, and the total after the discount. null: every ticket. */
export async function loadChargeNets(sql: Q, jobIds: number[] | null): Promise<Map<number, ChargeNet>> {
  const rows = await sql.query<{ id: number; discount_kind: string | null; discount_value: string | null; lines: number; subtotal: string }>(
    `select j.id, j.discount_kind, j.discount_value::text as discount_value, count(c.id)::int as lines,
            coalesce(sum(round(c.qty * c.rate, 2)), 0)::text as subtotal
       from service_jobs j
       left join ticket_charges c on c.job_id = j.id
      where ($1::int[] is null or j.id = any($1::int[]))
      group by j.id`,
    [jobIds],
  );
  const out = new Map<number, ChargeNet>();
  for (const r of rows) {
    const discount: Discount | null =
      isDiscountKind(r.discount_kind) && Number(r.discount_value) > 0 ? { kind: r.discount_kind, value: Number(r.discount_value) } : null;
    const t = applyDiscount(Number(r.subtotal), discount);
    out.set(Number(r.id), { lines: Number(r.lines), subtotal: t.subtotal, off: t.off, net: t.total, discount });
  }
  return out;
}

/** What the lists and filters need about one ticket's billing. */
export type BillingSummary = {
  so: string | null;
  /** YYYY-MM-DD the Sales Order was recorded (or the invoice date the backfill gave it). */
  billedAt: string | null;
  chargeLines: number;
  /** The charges after the ticket's discount. */
  chargeNet: number;
  invoices: { invoice: string; so: string | null; status: string; date: string | null; total: number | null; remaining: number | null }[];
  /** Live invoices added up. */
  liveTotal: number;
  /** Has an invoice that isn't Voided. */
  locked: boolean;
  doubleBill: boolean;
  mismatch: boolean;
  /** Live invoice dates, else the billed date: what "invoiced" date filters read. */
  invoicedDates: string[];
};

export function summarizeBilling(
  job: { ns_so: string | null; billed_at: unknown },
  net: ChargeNet | undefined,
  invoices: InvoiceLite[],
): BillingSummary {
  const chargeNet = net?.net ?? 0;
  const live = liveInvoices(invoices);
  const billedAt = job.billed_at ? (stamp(job.billed_at) ?? "").slice(0, 10) || null : null;
  const dates = live.map((i) => i.date).filter((d): d is string => !!d);
  return {
    so: job.ns_so?.trim() || null,
    billedAt,
    chargeLines: net?.lines ?? 0,
    chargeNet,
    invoices: invoices.map((i) => ({ invoice: i.invoice, so: i.so, status: i.status, date: i.date, total: i.total, remaining: i.remaining })),
    liveTotal: liveInvoiceTotal(invoices),
    locked: live.length > 0,
    doubleBill: possibleDoubleBill(invoices, chargeNet),
    mismatch: chargesMismatch(invoices, chargeNet),
    invoicedDates: dates.length ? dates : billedAt ? [billedAt] : [],
  };
}

/** Every service and TLC ticket's billing summary, by ticket id. */
export async function loadBillingSummaries(sql: Q, jobIds: number[] | null = null): Promise<Map<number, BillingSummary>> {
  const [jobs, nets, invoices] = await Promise.all([
    sql.query<{ id: number; ns_so: string | null; billed_at: unknown }>(
      "select id, ns_so, billed_at from service_jobs where ($1::int[] is null or id = any($1::int[]))",
      [jobIds],
    ),
    loadChargeNets(sql, jobIds),
    loadInvoices(sql, jobIds),
  ]);
  const out = new Map<number, BillingSummary>();
  for (const j of jobs) out.set(Number(j.id), summarizeBilling(j, nets.get(Number(j.id)), invoices.get(Number(j.id)) ?? []));
  return out;
}

/** The KatzDesk account a Corrigo service location names exactly, when it isn't the ticket's own account. */
export async function locationAccountFor(sql: Q, customer: string | null, location: string | null): Promise<string | null> {
  const loc = stripServiceChannelId(location);
  if (!loc || nameKey(loc) === nameKey(customer)) return null;
  const hit = await sql.query<{ name: string }>(
    `select name from directory_customers
      where archived = false and lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = $1
      order by id limit 1`,
    [nameKey(loc)],
  );
  return hit[0] && nameKey(hit[0].name) !== nameKey(customer) ? hit[0].name : null;
}

export type TicketBillingView = {
  jobId: number;
  invoices: StoredInvoice[];
  liveTotal: number;
  chargeNet: number;
  doubleBill: boolean;
  mismatch: boolean;
  /** The live invoice that locks the ticket. */
  lockedBy: { invoice: string; status: string } | null;
  /** An Admin's open unlock. */
  unlock: { by: string | null; at: string; reason: string | null; until: string } | null;
  canUnlock: boolean;
  corrigoNet: number | null;
  technician: string | null;
  serviceLocation: string | null;
  /** The Corrigo service location is another KatzDesk account. */
  locationAccount: string | null;
  /** Invoices billed from a warehouse the tech's rule doesn't allow. */
  locationWarnings: string[];
};

export async function loadTicketBilling(sql: Q, jobId: number, canUnlock: boolean, now = new Date()): Promise<TicketBillingView> {
  const job = (
    await sql.query<{
      id: number;
      customer: string | null;
      technician: string | null;
      service_location: string | null;
      corrigo_net: string | null;
      ns_so: string | null;
      billed_at: unknown;
      billing_unlocked_at: unknown;
      billing_unlocked_by: string | null;
      billing_unlock_reason: string | null;
    }>(
      `select id, customer, technician, service_location, corrigo_net::text as corrigo_net, ns_so, billed_at,
              billing_unlocked_at, billing_unlocked_by, billing_unlock_reason
         from service_jobs where id = $1`,
      [jobId],
    )
  )[0];
  if (!job) throw new Error("That ticket is no longer on the list.");
  const invoices = (await loadInvoices(sql, [jobId])).get(jobId) ?? [];
  const net = (await loadChargeNets(sql, [jobId])).get(jobId);
  const sum = summarizeBilling(job, net, invoices);
  const by = lockingInvoice(invoices);
  const at = stamp(job.billing_unlocked_at);
  const open = !!by && unlockActive(at, now);
  return {
    jobId,
    invoices,
    liveTotal: sum.liveTotal,
    chargeNet: sum.chargeNet,
    doubleBill: sum.doubleBill,
    mismatch: sum.mismatch,
    lockedBy: by ? { invoice: by.invoice, status: by.status } : null,
    unlock: open && at
      ? {
          by: job.billing_unlocked_by,
          at,
          reason: job.billing_unlock_reason,
          until: new Date(Date.parse(at) + UNLOCK_MINUTES * 60_000).toISOString(),
        }
      : null,
    canUnlock,
    corrigoNet: num(job.corrigo_net),
    technician: job.technician,
    serviceLocation: job.service_location,
    locationAccount: await locationAccountFor(sql, job.customer, job.service_location),
    locationWarnings: [...new Set(invoices.map((i) => locationWarning(job.technician, i.location)).filter((w): w is string => !!w))],
  };
}

export const getTicketBilling = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<TicketBillingView> => {
    const sql = await ready();
    return loadTicketBilling(sql, data.jobId, await canReviewNames(sql, context.userId));
  });

async function actorName(sql: Q, userId: string): Promise<string> {
  return (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
}

/** The ticket's history line, under the board the ticket is on. */
async function logTicket(sql: Q, jobId: number, actor: string, detail: string) {
  await sql.query(
    `insert into activity (entity_type, entity_id, actor_name, action, detail)
     select case when kind = 'tlc' then 'tlc' else 'service' end, id, $2, 'updated', $3 from service_jobs where id = $1`,
    [jobId, actor, detail],
  );
}

/** Admin: open a locked (invoiced) ticket's charges for editing. The reason goes on the ticket's history. */
export async function unlockTicketBillingFor(sql: Q, jobId: number, userId: string, rawReason: string): Promise<void> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error("Only an Admin can unlock an invoiced ticket.");
  const reason = cleanUnlockReason(rawReason);
  if (!reason) throw new Error("Say why the charges need to change (a few words).");
  const actor = await actorName(sql, userId);
  const saved = await sql.query<{ id: number }>(
    `with t as (
       update service_jobs s
          set billing_unlocked_at = now(), billing_unlocked_by = $2, billing_unlock_reason = $3, updated_at = now()
        where s.id = $1 and s.duplicate_of is null and ${LIVE_INVOICE_SQL("s.id")}
       returning s.id, s.kind
     ), log as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select case when t.kind = 'tlc' then 'tlc' else 'service' end, t.id, $2, 'updated',
              'Unlocked the invoiced charges to edit for ${UNLOCK_MINUTES} minutes · why: ' || $3
         from t
       returning id
     )
     select t.id from t`,
    [jobId, actor, reason],
  );
  if (!saved[0]) {
    const row = (await sql.query<MergedTicketRow>("select duplicate_of, merged_install_id from service_jobs where id = $1", [jobId]))[0];
    if (!row) throw new Error("That ticket is no longer on the list.");
    const merged = mergedTicketRefusal(row);
    if (merged) throw new Error(merged);
    throw new Error("This ticket has no live NetSuite invoice, so it isn't locked.");
  }
}

/** Admin: lock an unlocked ticket again without saving anything. */
export async function relockTicketBillingFor(sql: Q, jobId: number, userId: string): Promise<void> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error("Only an Admin can lock it again.");
  const actor = await actorName(sql, userId);
  const done = await sql.query<{ id: number }>(
    `update service_jobs set billing_unlocked_at = null, billing_unlocked_by = null, billing_unlock_reason = null, updated_at = now()
      where id = $1 and billing_unlocked_at is not null
     returning id`,
    [jobId],
  );
  if (done[0]) await logTicket(sql, jobId, actor, "Locked the invoiced charges again, with no changes");
}

export const unlockTicketBilling = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number; reason: string }) => z.object({ jobId: z.number().int().positive(), reason: z.string().max(1000) }).parse(d))
  .handler(async ({ data, context }): Promise<TicketBillingView> => {
    const sql = await ready();
    await unlockTicketBillingFor(sql, data.jobId, context.userId, data.reason);
    return loadTicketBilling(sql, data.jobId, true);
  });

export const relockTicketBilling = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<TicketBillingView> => {
    const sql = await ready();
    await relockTicketBillingFor(sql, data.jobId, context.userId);
    return loadTicketBilling(sql, data.jobId, true);
  });
