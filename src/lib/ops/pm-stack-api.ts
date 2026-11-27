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
import { sameStackCustomer, stackCustomerRefusal, stackRowMatchesSql, stackPmSql, stackRefusal, unstackPmSql, type StackPm, type StackSide, type StackTicket } from "@/lib/ops/pm-stack";
import { LIVE_INVOICE_SQL } from "@/lib/ops/billing-rules";
import { listedAccountSql } from "@/lib/ops/bill-account";
import { readsById } from "@/lib/ops/read-by-id";
import type { PmDateKind, TicketDateKind } from "@/lib/ops/pm-stack-labels";

/** A PM's or ticket's listed account, as a select column, when PMs reads by id (C6); null otherwise. */
const accountColumn = (byId: boolean, alias: string) => (byId ? listedAccountSql(`${alias}.customer_id`, `${alias}.customer`) : "null::int");
const accountOf = (v: number | string | null | undefined, byId: boolean) => (byId ? (v == null ? null : Number(v)) : undefined);

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

/** The PM and ticket as the stack's refusal reads them; with their accounts when PMs reads by id. */
export async function loadStackPair(
  sql: Pick<Sql, "query">,
  pmId: number,
  jobId: number,
): Promise<{ pm: StackPm; ticket: StackTicket; stackedCount: number; pmInvoiceHasLines: boolean; pmNetSuite: string | null } | null> {
  const byId = await readsById(sql, "pms");
  const pm = (await sql.query<{ id: number; customer: string | null; account: number | null; status: string; stacked_job_id: number | null }>(
    `select p.id, p.customer, ${accountColumn(byId, "p")} as account, p.status, p.stacked_job_id from pm_jobs p where p.id = $1`,
    [pmId],
  ))[0];
  const ticket = (await sql.query<{ id: number; customer: string | null; account: number | null; status: string; ns_so: string | null; duplicate_of: number | null; merged_install_id: number | null; phone_resolved: boolean; wo: string | null; call_id: string | null; invoiced: string | null }>(
    `select j.id, j.customer, ${accountColumn(byId, "j")} as account, j.status, j.ns_so, j.duplicate_of, j.merged_install_id, j.phone_resolved, j.wo, j.call_id,
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
  // Billed in NetSuite on its own (the Billing Backfill, 11/5): its latest live invoice, else its Sales Order, else its lines.
  const ns = (await sql.query<{ billed: string | null }>(
    `select coalesce(
       (select x.ns_invoice from record_ns_invoices x
         where x.pm_id = $1 and lower(regexp_replace(x.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')
         order by x.invoice_date desc nulls last, x.id desc limit 1),
       (select btrim(b.ns_so) from record_ns_billing b where b.pm_id = $1 and nullif(btrim(b.ns_so), '') is not null order by b.id desc limit 1),
       (select 'lines from the Billing Backfill' from record_ns_billing b
         where b.pm_id = $1 and exists (select 1 from record_ns_charges c where c.billing_id = b.id) limit 1)
     ) as billed`,
    [pmId],
  ))[0];
  return {
    pm: { id: Number(pm.id), customer: pm.customer, account: accountOf(pm.account, byId), status: pm.status, stackedJobId: pm.stacked_job_id == null ? null : Number(pm.stacked_job_id) },
    ticket: {
      id: Number(ticket.id),
      customer: ticket.customer,
      account: accountOf(ticket.account, byId),
      status: ticket.status,
      nsSo: ticket.ns_so,
      duplicateOf: ticket.duplicate_of == null ? null : Number(ticket.duplicate_of),
      mergedInstallId: ticket.merged_install_id == null ? null : Number(ticket.merged_install_id),
      phoneResolved: !!ticket.phone_resolved,
      wo: ticket.wo,
      callId: ticket.call_id,
      invoiced: ticket.invoiced,
    },
    stackedCount: Number(count?.n ?? 0),
    pmInvoiceHasLines: flagOn(lines?.has),
    pmNetSuite: ns?.billed ?? null,
  };
}

const pairInput = z.object({ pmId: z.number().int().positive(), jobId: z.number().int().positive() });

export const stackPmOnTicket = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof pairInput>) => pairInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const actor = await requireWriter(sql, context.userId);
    const saved = await sql.query<{ id: number }>(stackPmSql(await readsById(sql, "pms")), [data.pmId, data.jobId, actor]);
    if (!saved[0]) {
      const pair = await loadStackPair(sql, data.pmId, data.jobId);
      if (!pair) throw new Error("That PM or ticket is no longer on the list.");
      throw new Error(stackRefusal(pair.pm, pair.ticket, pair.stackedCount, pair.pmInvoiceHasLines, pair.pmNetSuite) ?? "That PM could not be stacked.");
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
  /** YYYY-MM-DD: completed, else scheduled, else received (the list's order), and which it is (11/27). */
  date?: string | null;
  dateKind?: TicketDateKind | null;
};

export type StackedPmRow = {
  pmId: number;
  customer: string;
  status: string;
  equipment: string | null;
  customerMatches: boolean;
  /** YYYY-MM-DD: completed, else due (projected), else received (the list's order), and which it is (11/27). */
  date?: string | null;
  dateKind?: PmDateKind | null;
};

/** A ticket's date and which it is, as select columns on `j` (the stack list's sort order). */
const TICKET_DAY = `to_char(coalesce(j.completed_at, j.scheduled, j.received), 'YYYY-MM-DD') as day,
       case when j.completed_at is not null then 'completed' when j.scheduled is not null then 'scheduled'
            when j.received is not null then 'received' end as day_kind`;
/** A PM's date and which it is, as select columns on `p` (the stack list's sort order). */
const PM_DAY = `to_char(coalesce(p.completed_at, p.projected, p.received), 'YYYY-MM-DD') as day,
       case when p.completed_at is not null then 'completed' when p.projected is not null then 'due'
            when p.received is not null then 'received' end as day_kind`;

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
`;

/**
 * The tickets a PM can stack on: the PM's customer's open, unbilled tickets (sameStackCustomer: by account when PMs
 * reads by id, else by name).
 */
export async function listForPm(sql: Pick<Sql, "query">, pmId: number) {
  const byId = await readsById(sql, "pms");
  const pm = (await sql.query<{ customer: string | null; customer_id: number | null; account: number | null; stacked_job_id: number | null }>(
    `select p.customer, p.customer_id, ${accountColumn(byId, "p")} as account, p.stacked_job_id from pm_jobs p where p.id = $1`,
    [pmId],
  ))[0];
  if (!pm) return { stackedOn: null, candidates: [] as StackedOn[] };
  const key = normalizeCustomerKey(pm.customer);
  const side: StackSide = { customer: pm.customer, account: accountOf(pm.account, byId) };
  const stackedOn = pm.stacked_job_id ? await readTicket(sql, Number(pm.stacked_job_id), side, byId) : null;
  const rows = key
    ? await sql.query<TicketRow>(
        `select j.id, j.kind, j.wo, j.call_id, j.customer, ra.account, j.status, ${TICKET_DAY}
           from service_jobs j
          cross join lateral (select ${accountColumn(byId, "j")} as account) ra
          where true ${TICKET_WHERE}
            and ${stackRowMatchesSql({ name: "j.customer", account: "ra.account" }, { name: "$1::text", account: "$3::int" }, byId)}
            and j.id is distinct from $2
          order by coalesce(j.completed_at, j.scheduled, j.received) desc nulls last, j.id desc
          limit 20`,
        byId ? [pm.customer, pm.stacked_job_id ?? 0, side.account ?? null] : [pm.customer, pm.stacked_job_id ?? 0],
      )
    : [];
  return {
    stackedOn,
    candidates: rows.map((r) => toTicket(r, side, byId)),
  };
}

type TicketRow = {
  id: number;
  kind: string;
  wo: string | null;
  call_id: string | null;
  customer: string | null;
  account: number | null;
  status: string;
  day: string | null;
  day_kind: TicketDateKind | null;
};

async function readTicket(sql: Pick<Sql, "query">, jobId: number, pm: StackSide, byId: boolean): Promise<StackedOn | null> {
  const r = (await sql.query<TicketRow>(
    `select j.id, j.kind, j.wo, j.call_id, j.customer, ${accountColumn(byId, "j")} as account, j.status, ${TICKET_DAY} from service_jobs j where j.id = $1`,
    [jobId],
  ))[0];
  return r ? toTicket(r, pm, byId) : null;
}

function toTicket(r: TicketRow, pm: StackSide, byId: boolean): StackedOn {
  return {
    jobId: Number(r.id),
    kind: r.kind === "tlc" ? "tlc" : "service",
    wo: r.wo,
    callId: r.call_id,
    customer: (r.customer ?? "").trim(),
    customerMatches: normalizeCustomerKey(pm.customer) !== "" && sameStackCustomer({ customer: r.customer, account: accountOf(r.account, byId) }, pm),
    status: r.status,
    date: r.day,
    dateKind: r.day_kind,
  };
}

/** The PMs on a ticket, and the PMs it can take: the ticket's customer's open, unbilled PMs (as listForPm matches). */
export async function listForJob(sql: Pick<Sql, "query">, jobId: number) {
  const byId = await readsById(sql, "pms");
  const job = (await sql.query<{ customer: string | null; customer_id: number | null; account: number | null }>(
    `select j.customer, j.customer_id, ${accountColumn(byId, "j")} as account from service_jobs j where j.id = $1`,
    [jobId],
  ))[0];
  const key = normalizeCustomerKey(job?.customer);
  const side: StackSide = { customer: job?.customer ?? null, account: accountOf(job?.account, byId) };
  const stacked = await sql.query<PmRow>(
    `select p.id, p.customer, ${accountColumn(byId, "p")} as account, p.status, p.equipment, ${PM_DAY} from pm_jobs p where p.stacked_job_id = $1 order by p.id desc limit 10`,
    [jobId],
  );
  const candidates = key
    ? await sql.query<PmRow>(
        `select p.id, p.customer, ra.account, p.status, p.equipment, ${PM_DAY}
           from pm_jobs p
          cross join lateral (select ${accountColumn(byId, "p")} as account) ra
          where p.stacked_job_id is null
            and p.moved_job_id is null
            and p.status <> 'Cancelled'
            and ${stackRowMatchesSql({ name: "p.customer", account: "ra.account" }, { name: "$1::text", account: "$2::int" }, byId)}
            and not exists (
              select 1 from invoices i
              join invoice_lines l on l.invoice_id = i.id
             where i.entity_type = 'pm' and i.entity_id = p.id
            )
            -- Billed in NetSuite on its own (the Billing Backfill, 11/5).
            and not pm_netsuite_billed(p.id)
          order by coalesce(p.completed_at, p.projected, p.received) desc nulls last, p.id desc
          limit 20`,
        byId ? [job?.customer ?? null, side.account ?? null] : [job?.customer ?? null],
      )
    : [];
  const row = (r: PmRow): StackedPmRow => ({
    pmId: Number(r.id),
    customer: (r.customer ?? "").trim(),
    status: r.status,
    equipment: r.equipment,
    customerMatches: key !== "" && sameStackCustomer({ customer: r.customer, account: accountOf(r.account, byId) }, side),
    date: r.day,
    dateKind: r.day_kind,
  });
  return { stacked: stacked.map(row), candidates: candidates.map(row) };
}

type PmRow = { id: number; customer: string | null; account: number | null; status: string; equipment: string | null; day: string | null; day_kind: PmDateKind | null };

/**
 * Why a ticket (`side` "ticket") or PM ("pm") on a stack can't move to the customer `next`: stackCustomerRefusal over the
 * record, the name it would be saved under, and its stacked partners (a ticket's PMs, or the PM's ticket). When PMs reads
 * by id, by their accounts: the record's listed account, the account `next` finds (the same one when the name is
 * unchanged), and each partner's.
 */
export async function stackEditRefusal(sql: Pick<Sql, "query">, side: "ticket" | "pm", id: number, next: string | null | undefined): Promise<string | null> {
  const byId = await readsById(sql, "pms");
  const table = side === "ticket" ? "service_jobs" : "pm_jobs";
  const cur = (await sql.query<{ customer: string | null; account: number | null; stacked_job_id: number | null }>(
    `select r.customer, ${accountColumn(byId, "r")} as account, ${side === "pm" ? "r.stacked_job_id" : "null::int"} as stacked_job_id from ${table} r where r.id = $1`,
    [id],
  ))[0];
  if (!cur) return null;
  const partners = await sql.query<{ id: number; customer: string | null; account: number | null }>(
    side === "ticket"
      ? `select p.id, p.customer, ${accountColumn(byId, "p")} as account from pm_jobs p where p.stacked_job_id = $1`
      : `select j.id, j.customer, ${accountColumn(byId, "j")} as account from service_jobs j where j.id = $1`,
    [side === "ticket" ? id : (cur.stacked_job_id ?? 0)],
  );
  if (!partners.length) return null;
  const nextName = next ?? null;
  const same = (nextName ?? "").trim() === (cur.customer ?? "").trim();
  const nextAccount = !byId
    ? undefined
    : same
      ? accountOf(cur.account, byId)
      : accountOf((await sql.query<{ id: number | null }>("select katz_customer_id($1) as id", [nextName]))[0]?.id, byId);
  return stackCustomerRefusal(
    { customer: cur.customer, account: accountOf(cur.account, byId) },
    { customer: nextName, account: nextAccount },
    partners.map((p) => ({ id: Number(p.id), customer: p.customer, account: accountOf(p.account, byId) })),
    side,
  );
}

export { stackCustomerRefusal };
