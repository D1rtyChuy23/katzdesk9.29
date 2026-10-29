/**
 * Reads for the Invoices page (Admin), the Tickets list's billing column and filters, Tickets In Window and Location
 * Check (Grok's billing request through Chuy, 2026-10-28). Read-only: nothing here writes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware, salesRepScope } from "@/lib/ops/access";
import { accountRepFor, loadAccountMarks } from "@/lib/ops/reps";
import { loadChargeNets, loadInvoices, summarizeBilling } from "@/lib/ops/ticket-billing-api";
import { locationWarning, matchesBillingFilters, type BoardKey, type DateBy } from "@/lib/ops/billing-rules";
import {
  accountLocationCheck,
  windowFilterRow,
  windowRange,
  type LocationCheckRow,
  type TicketBillingRow,
  type WindowRow,
} from "@/lib/ops/billing-report";
import { nameKey } from "@/lib/ops/wo-history";

type Q = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

type JobRow = {
  id: number;
  kind: string;
  call_id: string;
  wo: string | null;
  customer: string | null;
  technician: string | null;
  technician2: string | null;
  status: string;
  received: string | null;
  completed: string | null;
  ns_so: string | null;
  billed_on: string | null;
  corrigo_net: string | null;
  service_location: string | null;
  duplicate_of: number | null;
};

/** Dates as YYYY-MM-DD text, the billed date on Chicago's calendar. */
const JOB_SELECT = `select s.id, s.kind, s.call_id, s.wo, s.customer, s.technician, s.technician2, s.status,
       to_char(s.received, 'YYYY-MM-DD') as received, to_char(s.completed_at, 'YYYY-MM-DD') as completed,
       s.ns_so, to_char(s.billed_at at time zone 'America/Chicago', 'YYYY-MM-DD') as billed_on,
       s.corrigo_net::text as corrigo_net, s.service_location, s.duplicate_of
  from service_jobs s`;

/**
 * Service and TLC tickets with their billing. `kind`: one board. `merged`: keep tickets merged into another (the
 * Tickets list shows them under Flagged); the Invoices page leaves them out.
 */
export async function loadTicketBillingRows(sql: Q, opts: { kind?: "service" | "tlc"; merged?: boolean } = {}): Promise<TicketBillingRow[]> {
  const [jobs, nets, invoices] = await Promise.all([
    sql.query<JobRow>(
      `${JOB_SELECT}
        where ($1::text is null or s.kind = $1) and ($2::boolean or s.duplicate_of is null)
        order by s.completed_at desc nulls last, s.received desc nulls last, s.id desc`,
      [opts.kind ?? null, !!opts.merged],
    ),
    loadChargeNets(sql, null),
    loadInvoices(sql, null),
  ]);
  return jobs.map((j) => {
    const id = Number(j.id);
    const list = invoices.get(id) ?? [];
    const sum = summarizeBilling({ ns_so: j.ns_so, billed_at: j.billed_on }, nets.get(id), list);
    return {
      id,
      board: j.kind === "tlc" ? "tlc" : "service",
      wo: j.wo,
      callId: j.call_id,
      customer: j.customer,
      technician: j.technician,
      secondaryTech: j.technician2 ?? null,
      status: j.status,
      received: j.received,
      completed: j.completed,
      so: sum.so,
      billedAt: sum.billedAt,
      invoices: list.map((i) => ({
        invoice: i.invoice,
        so: i.so,
        status: i.status,
        date: i.date,
        total: i.total,
        remaining: i.remaining,
        location: i.location ?? null,
      })),
      chargeLines: sum.chargeLines,
      chargeNet: sum.chargeNet,
      liveTotal: sum.liveTotal,
      corrigoNet: num(j.corrigo_net),
      doubleBill: sum.doubleBill,
      mismatch: sum.mismatch,
      serviceLocation: j.service_location,
      locationWarnings: [...new Set(list.map((i) => locationWarning(j.technician, i.location)).filter((w): w is string => !!w))],
      invoicedDates: sum.invoicedDates,
    };
  });
}

/** A sales rep's test for a ticket's account; null when this person sees every account (as listJobs does). */
async function accountScope(sql: Sql, userId: string): Promise<((customer: string | null) => boolean) | null> {
  const scope = await salesRepScope(sql, userId);
  if (!scope) return null;
  const marks = await loadAccountMarks(sql);
  return (customer) => scope(accountRepFor(marks, customer));
}

/**
 * The Tickets list's billing: each ticket's Sales Order, NetSuite invoices and the double-bill / mismatch flags.
 * Whoever sees the list sees what the ticket's Invoicing tab already shows them; a sales rep only their accounts.
 */
export async function listTicketBillingFor(
  sql: Q,
  kind: "service" | "tlc",
  inScope: ((customer: string | null) => boolean) | null,
): Promise<TicketBillingRow[]> {
  const rows = await loadTicketBillingRows(sql, { kind, merged: true });
  return inScope ? rows.filter((r) => inScope(r.customer)) : rows;
}

export const listTicketBilling = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { kind: "service" | "tlc" }) => z.object({ kind: z.enum(["service", "tlc"]) }).parse(d))
  .handler(async ({ data, context }): Promise<TicketBillingRow[]> => {
    const sql = await ready();
    return listTicketBillingFor(sql, data.kind, await accountScope(sql, context.userId));
  });

export type AdminReport<T> = { forbidden: true; rows: [] } | { forbidden: false; rows: T };

/** The Invoices page: every service and TLC ticket with its billing (merged tickets left out). Admin only. */
export async function invoicesReportFor(sql: Q, userId: string): Promise<AdminReport<TicketBillingRow[]>> {
  if (!(await canReviewNames(sql as Sql, userId))) return { forbidden: true, rows: [] };
  return { forbidden: false, rows: await loadTicketBillingRows(sql) };
}

export const getInvoicesReport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<AdminReport<TicketBillingRow[]>> => invoicesReportFor(await ready(), context.userId));

// ── Tickets In Window ────────────────────────────────────────────────────────────────────────────────────────────────

export const WINDOW_BOARDS: BoardKey[] = ["service", "tlc", "pm", "install"];

export type WindowQuery = { from: string; to: string; dateBy?: DateBy; boards?: BoardKey[] };

/** Every work order on the boards asked for, with the dates, SO and invoices the window is read against. */
export async function loadWindowRows(sql: Q, boards: BoardKey[] = WINDOW_BOARDS): Promise<WindowRow[]> {
  const want = new Set(boards);
  const rows: WindowRow[] = [];
  const tickets = want.has("service") || want.has("tlc") || want.has("pm") ? await loadTicketBillingRows(sql, { merged: true }) : [];
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const merged = new Map(
    (await sql.query<{ id: number; duplicate_of: number | null }>("select id, duplicate_of from service_jobs where duplicate_of is not null")).map((r) => [
      Number(r.id),
      Number(r.duplicate_of),
    ]),
  );
  for (const t of tickets) {
    if (!want.has(t.board)) continue;
    const into = merged.get(t.id);
    rows.push({
      board: t.board,
      id: t.id,
      wo: t.wo,
      customer: t.customer,
      technician: [t.technician, t.secondaryTech].filter(Boolean).join(" + ") || null,
      status: t.status,
      received: t.received,
      completed: t.completed,
      so: t.so,
      invoices: t.invoices.map((i) => ({ invoice: i.invoice, status: i.status, date: i.date })),
      invoicedDates: t.invoicedDates,
      serviceLocation: t.serviceLocation,
      note: into ? `Merged into ticket #${into}` : null,
    });
  }
  if (want.has("pm")) {
    const pms = await sql.query<{
      id: number;
      wo: string | null;
      customer: string | null;
      technician: string | null;
      status: string;
      received: string | null;
      completed: string | null;
      service_location: string | null;
      stacked_job_id: number | null;
    }>(
      `select id, wo, customer, technician, status, to_char(received, 'YYYY-MM-DD') as received,
              to_char(completed_at, 'YYYY-MM-DD') as completed, service_location, stacked_job_id
         from pm_jobs order by completed_at desc nulls last, received desc nulls last, id desc`,
    );
    for (const p of pms) {
      // A PM stacked on a ticket bills on that ticket: its SO and invoices are the ticket's.
      const on = p.stacked_job_id ? byId.get(Number(p.stacked_job_id)) : undefined;
      rows.push({
        board: "pm",
        id: Number(p.id),
        wo: p.wo,
        customer: p.customer,
        technician: p.technician,
        status: p.status,
        received: p.received,
        completed: p.completed,
        so: on?.so ?? null,
        invoices: on ? on.invoices.map((i) => ({ invoice: i.invoice, status: i.status, date: i.date })) : [],
        invoicedDates: on?.invoicedDates ?? [],
        serviceLocation: p.service_location,
        note: p.stacked_job_id ? `Billed on ticket #${p.stacked_job_id}` : null,
      });
    }
  }
  if (want.has("install")) {
    // One row per Corrigo WO on a project; a project with no WO list yet is one row.
    const installs = await sql.query<{
      id: number;
      wo: string | null;
      customer: string | null;
      technician: string | null;
      status: string | null;
      received: string | null;
      completed: string | null;
      archived: boolean | null;
      wo_count: number;
      wo_index: number;
    }>(
      `select i.id, coalesce(w.wo, i.wo) as wo, i.customer, i.technician, coalesce(w.status, i.equip_status) as status,
              to_char(coalesce(w.received, i.received), 'YYYY-MM-DD') as received,
              to_char(coalesce(w.completed_at, i.completed_at), 'YYYY-MM-DD') as completed, i.archived,
              count(w.id) over (partition by i.id)::int as wo_count,
              row_number() over (partition by i.id order by w.id)::int as wo_index
         from installs i
         left join install_work_orders w on w.install_id = i.id
        where i.duplicate_of is null
        order by coalesce(w.completed_at, i.completed_at) desc nulls last, i.id desc, w.id`,
    );
    for (const i of installs) {
      const notes = [
        Number(i.wo_count) > 1 ? `WO ${i.wo_index} of ${i.wo_count} on this install` : null,
        i.archived ? "Archived install" : null,
      ].filter(Boolean);
      rows.push({
        board: "install",
        id: Number(i.id),
        wo: i.wo,
        customer: i.customer,
        technician: i.technician,
        status: i.status ?? "",
        received: i.received,
        completed: i.completed,
        so: null,
        invoices: [],
        invoicedDates: [],
        serviceLocation: null,
        note: notes.join(" · ") || null,
      });
    }
  }
  return rows;
}

/** The rows in the window: each board's received, completed or invoiced date (completed when not said) inside it. */
export async function ticketsInWindowFor(sql: Q, q: WindowQuery): Promise<{ rows: WindowRow[]; error: string | null }> {
  const range = windowRange(q.from, q.to);
  if (typeof range === "string") return { rows: [], error: range };
  const boards = (q.boards?.length ? q.boards : WINDOW_BOARDS).filter((b) => WINDOW_BOARDS.includes(b));
  const filters = { dateBy: q.dateBy ?? "completed", dateFrom: range.from, dateTo: range.to } as const;
  const rows = (await loadWindowRows(sql, boards)).filter((r) => matchesBillingFilters(windowFilterRow(r), filters));
  return { rows, error: null };
}

const windowSchema = z.object({
  from: z.string().max(10),
  to: z.string().max(10),
  dateBy: z.enum(["received", "completed", "invoiced"]).optional(),
  boards: z.array(z.enum(["service", "tlc", "pm", "install"])).max(4).optional(),
});

export type WindowReport = AdminReport<WindowRow[]> & { error?: string | null };

/** Tickets In Window for the page. Admin only. */
export async function windowReportFor(sql: Q, userId: string, q: WindowQuery): Promise<WindowReport> {
  if (!(await canReviewNames(sql as Sql, userId))) return { forbidden: true, rows: [] };
  const out = await ticketsInWindowFor(sql, q);
  return { forbidden: false, rows: out.rows, error: out.error };
}

export const getTicketsInWindow = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: WindowQuery) => windowSchema.parse(d))
  .handler(async ({ data, context }): Promise<WindowReport> => windowReportFor(await ready(), context.userId, data));

// ── Location Check ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tickets and PMs whose Corrigo service location isn't their account (it names another account exactly, or no
 * account at all), and invoices billed from a warehouse the tech's rule doesn't allow.
 */
export async function loadLocationCheck(sql: Q): Promise<LocationCheckRow[]> {
  const accounts = new Map<string, string>();
  for (const a of await sql.query<{ name: string }>("select name from directory_customers where archived = false order by id")) {
    const k = nameKey(a.name);
    if (k && !accounts.has(k)) accounts.set(k, a.name);
  }
  const out: LocationCheckRow[] = [];
  const located = await sql.query<{ board: string; id: number; wo: string | null; customer: string | null; technician: string | null; service_location: string }>(
    `select case when kind = 'tlc' then 'tlc' else 'service' end as board, id, wo, customer, technician, service_location
       from service_jobs where duplicate_of is null and nullif(btrim(service_location), '') is not null
     union all
     select 'pm', id, wo, customer, technician, service_location
       from pm_jobs where nullif(btrim(service_location), '') is not null
     order by 1, 2 desc`,
  );
  for (const r of located) {
    const check = accountLocationCheck(r.customer, r.service_location, accounts);
    if (!check) continue;
    out.push({
      kind: "account",
      board: r.board as BoardKey,
      id: Number(r.id),
      wo: r.wo,
      customer: r.customer,
      technician: r.technician,
      serviceLocation: r.service_location,
      locationAccount: check.locationAccount,
      invoice: null,
      invoiceLocation: null,
      note: check.note,
    });
  }
  const billed = await sql.query<{ board: string; id: number; wo: string | null; customer: string | null; technician: string | null; ns_invoice: string; location: string | null }>(
    `select case when s.kind = 'tlc' then 'tlc' else 'service' end as board, s.id, s.wo, s.customer, s.technician, i.ns_invoice, i.location
       from ticket_invoices i join service_jobs s on s.id = i.job_id
      where nullif(btrim(i.location), '') is not null
      order by s.id desc, i.id`,
  );
  for (const r of billed) {
    const warning = locationWarning(r.technician, r.location);
    if (!warning) continue;
    out.push({
      kind: "warehouse",
      board: r.board as BoardKey,
      id: Number(r.id),
      wo: r.wo,
      customer: r.customer,
      technician: r.technician,
      serviceLocation: null,
      locationAccount: null,
      invoice: r.ns_invoice,
      invoiceLocation: r.location,
      note: warning,
    });
  }
  return out;
}

/** Location Check for the page. Admin only. */
export async function locationCheckFor(sql: Q, userId: string): Promise<AdminReport<LocationCheckRow[]>> {
  if (!(await canReviewNames(sql as Sql, userId))) return { forbidden: true, rows: [] };
  return { forbidden: false, rows: await loadLocationCheck(sql) };
}

export const getLocationCheck = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<AdminReport<LocationCheckRow[]>> => locationCheckFor(await ready(), context.userId));
