/**
 * Stack and unstack a PM on a ticket. Service and Admin write. Anyone on the Desk can read the candidates.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { canWriteRunbook, type RunbookRole } from "@/lib/ops/pm-runbook";
import { stackCustomerRefusal, stackPmSql, stackRefusal, unstackPmSql, type StackPm, type StackTicket } from "@/lib/ops/pm-stack";
import { LIVE_INVOICE_SQL } from "@/lib/ops/billing-rules";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireWriter(sql: Sql, userId: string): Promise<string> {
  const r = (await sql.query<{ is_admin: unknown; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  ))[0];
  if (!canWriteRunbook((r?.desk_role ?? null) as RunbookRole, flagOn(r?.is_admin))) {
    throw new Error("Only Service and Admin can stack or unstack a PM.");
  }
  return r?.username || "Teammate";
}

async function loadStackPair(sql: Sql, pmId: number, jobId: number): Promise<{ pm: StackPm; ticket: StackTicket; stackedCount: number; pmInvoiceHasLines: boolean } | null> {
  const pm = (await sql.query<{ id: number; customer: string | null; status: string; stacked_job_id: number | null }>(
    "select id, customer, status, stacked_job_id from pm_jobs where id = $1",
    [pmId],
  ))[0];
  const ticket = (await sql.query<{ id: number; customer: string | null; status: string; ns_so: string | null; duplicate_of: number | null; phone_resolved: boolean; wo: string | null; call_id: string | null; invoiced: string | null }>(
    `select j.id, j.customer, j.status, j.ns_so, j.duplicate_of, j.phone_resolved, j.wo, j.call_id,
            (select ti.ns_invoice from ticket_invoices ti
              where ti.job_id = j.id and lower(regexp_replace(ti.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')
              order by ti.invoice_date desc nulls last, ti.id desc limit 1) as invoiced
       from service_jobs j where j.id = $1`,
    [jobId],
  ))[0];
  if (!pm || !ticket) return null;
  const count = (await sql.query<{ n: number }>("select count(*)::int as n from pm_jobs where stacked_job_id = $1", [jobId]))[0];
  const lines = (await sql.query<{ has: unknown }>(
    `select exists (
       select 1 from invoices i join invoice_lines l on l.invoice_id = i.id
        where i.entity_type = 'pm' and i.entity_id = $1
     ) as has`,
    [pmId],
  ))[0];
  return {
    pm: { id: Number(pm.id), customer: pm.customer, status: pm.status, stackedJobId: pm.stacked_job_id == null ? null : Number(pm.stacked_job_id) },
    ticket: {
      id: Number(ticket.id),
      customer: ticket.customer,
      status: ticket.status,
      nsSo: ticket.ns_so,
      duplicateOf: ticket.duplicate_of == null ? null : Number(ticket.duplicate_of),
      phoneResolved: !!ticket.phone_resolved,
      wo: ticket.wo,
      callId: ticket.call_id,
      invoiced: ticket.invoiced,
    },
    stackedCount: Number(count?.n ?? 0),
    pmInvoiceHasLines: flagOn(lines?.has),
  };
}

const pairInput = z.object({ pmId: z.number().int().positive(), jobId: z.number().int().positive() });

export const stackPmOnTicket = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof pairInput>) => pairInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const actor = await requireWriter(sql, context.userId);
    const saved = await sql.query<{ id: number }>(stackPmSql(), [data.pmId, data.jobId, actor]);
    if (!saved[0]) {
      const pair = await loadStackPair(sql, data.pmId, data.jobId);
      if (!pair) throw new Error("That PM or ticket is no longer on the list.");
      throw new Error(stackRefusal(pair.pm, pair.ticket, pair.stackedCount, pair.pmInvoiceHasLines) ?? "That PM could not be stacked.");
    }
    return { ok: true as const };
  });

const pmOnly = z.object({ pmId: z.number().int().positive() });

export const unstackPm = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof pmOnly>) => pmOnly.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const actor = await requireWriter(sql, context.userId);
    const saved = await sql.query<{ id: number }>(unstackPmSql(), [data.pmId, actor]);
    if (!saved[0]) throw new Error(await explainUnstack(sql, data.pmId));
    return { ok: true as const };
  });

export async function explainUnstack(sql: Sql, pmId: number): Promise<string> {
  const pm = (await sql.query<{ stacked_job_id: number | null }>("select stacked_job_id from pm_jobs where id = $1", [pmId]))[0];
  if (!pm?.stacked_job_id) return `PM #${pmId} is not on a ticket.`;
  const jobId = Number(pm.stacked_job_id);
  const blocked = (await sql.query<{ n: number }>(
    `select count(*)::int as n from ticket_charges c
      where c.job_id = $2
        and (
          (split_part(c.source_key, ':', 1) = 'pmkit' and split_part(c.source_key, ':', 2) = $1::int::text)
          or c.source_key in (select 'mp:' || m.id::text from machine_parts m where m.pm_job_id = $1::int)
        )`,
    [pmId, jobId],
  ))[0];
  if (Number(blocked?.n ?? 0) > 0) return `Take PM #${pmId}'s lines off ticket #${jobId} first.`;
  const ticket = (await sql.query<{ ns_so: string | null }>("select ns_so from service_jobs where id = $1", [jobId]))[0];
  const so = String(ticket?.ns_so ?? "").trim();
  if (so) return `Ticket #${jobId} is billed (${so}). Clear its Sales Order before unstacking PM #${pmId}.`;
  return `PM #${pmId} is not on a ticket.`;
}

export type StackedOn = {
  jobId: number;
  kind: string;
  wo: string | null;
  callId: string | null;
  customer: string;
  customerMatches: boolean;
  status: string;
};

export type StackedPmRow = {
  pmId: number;
  customer: string;
  status: string;
  equipment: string | null;
  customerMatches: boolean;
};

async function canStack(sql: Sql, userId: string): Promise<boolean> {
  const r = (await sql.query<{ is_admin: unknown; desk_role: string | null }>(
    "select is_admin, desk_role from desk_accounts where user_id = $1",
    [userId],
  ))[0];
  return canWriteRunbook((r?.desk_role ?? null) as RunbookRole, flagOn(r?.is_admin));
}

const listInput = z.union([z.object({ pmId: z.number().int().positive() }), z.object({ jobId: z.number().int().positive() })]);

/** Tickets a PM can stack on, or PMs a ticket can take. Read-only. Service and Admin get canWrite. */
export const listStackCandidates = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof listInput>) => listInput.parse(d))
  .handler(async ({ data, context }): Promise<
    | { stackedOn: StackedOn | null; candidates: StackedOn[]; canWrite: boolean }
    | { stacked: StackedPmRow[]; candidates: StackedPmRow[]; canWrite: boolean }
  > => {
    const sql = await ready();
    const canWrite = await canStack(sql, context.userId);
    if ("pmId" in data) return { ...(await listForPm(sql, data.pmId)), canWrite };
    return { ...(await listForJob(sql, data.jobId)), canWrite };
  });

const TICKET_WHERE = `
  and j.duplicate_of is null
  and nullif(btrim(j.ns_so), '') is null
  and not ${LIVE_INVOICE_SQL("j.id")}
  and j.status not in ('Cancelled', 'Phone Resolved')
  and coalesce(j.phone_resolved, false) = false
  and regexp_replace(lower(coalesce(j.customer, '')), '[^a-z0-9]+', '', 'g') = $1
`;

export async function listForPm(sql: Sql, pmId: number) {
  const pm = (await sql.query<{ customer: string | null; stacked_job_id: number | null }>("select customer, stacked_job_id from pm_jobs where id = $1", [pmId]))[0];
  if (!pm) return { stackedOn: null, candidates: [] as StackedOn[] };
  const key = normalizeCustomerKey(pm.customer);
  const stackedOn = pm.stacked_job_id
    ? await readTicket(sql, Number(pm.stacked_job_id), key)
    : null;
  const rows = key
    ? await sql.query<{ id: number; kind: string; wo: string | null; call_id: string | null; customer: string | null; status: string }>(
        `select j.id, j.kind, j.wo, j.call_id, j.customer, j.status
           from service_jobs j
          where true ${TICKET_WHERE}
            and j.id is distinct from $2
          order by coalesce(j.completed_at, j.scheduled, j.received) desc nulls last, j.id desc
          limit 20`,
        [key, pm.stacked_job_id ?? 0],
      )
    : [];
  return {
    stackedOn,
    candidates: rows.map((r) => toTicket(r, key)),
  };
}

async function readTicket(sql: Sql, jobId: number, pmKey: string): Promise<StackedOn | null> {
  const r = (await sql.query<{ id: number; kind: string; wo: string | null; call_id: string | null; customer: string | null; status: string }>(
    "select id, kind, wo, call_id, customer, status from service_jobs where id = $1",
    [jobId],
  ))[0];
  return r ? toTicket(r, pmKey) : null;
}

function toTicket(r: { id: number; kind: string; wo: string | null; call_id: string | null; customer: string | null; status: string }, pmKey: string): StackedOn {
  return {
    jobId: Number(r.id),
    kind: r.kind === "tlc" ? "tlc" : "service",
    wo: r.wo,
    callId: r.call_id,
    customer: (r.customer ?? "").trim(),
    customerMatches: normalizeCustomerKey(r.customer) === pmKey && pmKey !== "",
    status: r.status,
  };
}

export async function listForJob(sql: Sql, jobId: number) {
  const job = (await sql.query<{ customer: string | null }>("select customer from service_jobs where id = $1", [jobId]))[0];
  const key = normalizeCustomerKey(job?.customer);
  const stacked = await sql.query<{ id: number; customer: string | null; status: string; equipment: string | null }>(
    `select id, customer, status, equipment from pm_jobs where stacked_job_id = $1 order by id desc limit 10`,
    [jobId],
  );
  const candidates = key
    ? await sql.query<{ id: number; customer: string | null; status: string; equipment: string | null }>(
        `select p.id, p.customer, p.status, p.equipment
           from pm_jobs p
          where p.stacked_job_id is null
            and p.status <> 'Cancelled'
            and regexp_replace(lower(coalesce(p.customer, '')), '[^a-z0-9]+', '', 'g') = $1
            and not exists (
              select 1 from invoices i
              join invoice_lines l on l.invoice_id = i.id
             where i.entity_type = 'pm' and i.entity_id = p.id
            )
          order by coalesce(p.completed_at, p.projected, p.received) desc nulls last, p.id desc
          limit 20`,
        [key],
      )
    : [];
  const row = (r: { id: number; customer: string | null; status: string; equipment: string | null }): StackedPmRow => ({
    pmId: Number(r.id),
    customer: (r.customer ?? "").trim(),
    status: r.status,
    equipment: r.equipment,
    customerMatches: normalizeCustomerKey(r.customer) === key && key !== "",
  });
  return { stacked: stacked.map(row), candidates: candidates.map(row) };
}

export { stackCustomerRefusal };
