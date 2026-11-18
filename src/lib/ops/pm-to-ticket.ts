/**
 * Move a PM to a service ticket, and back (Chuy, 11/18). For a repair that came in as a PM: WO-1107, PM #171,
 * Halcyon - Southtown, a Mazzer hopper repair.
 *
 * Move: a new Field Service ticket on the same account, with the PM's WO, tech, status (mapped), received and
 * scheduled dates, sched time, completed date, work done, notes, equipment, P.O.s, Corrigo id and service location.
 * The PM is kept as a closed record ("Moved To Ticket") that points at the ticket. Its WO, Corrigo id and completed
 * date move to the ticket, so the Corrigo import, the Billing Backfill and WO search find the ticket and never both.
 * Its WO part lines go with it. Its photos, Ping notes and runbook checks stay on the PM, which the ticket links to.
 * PMs keep no Corrigo net, so the ticket's comes with the next Corrigo import of the WO.
 *
 * Move back: the PM takes the ticket's work as it is now (the same fields, status mapped back) and opens again; the
 * ticket is closed as Cancelled, with a note saying where its work went, and gives up its WO and Corrigo id. Nothing is deleted. The log
 * (pm_ticket_moves) keeps the PM as it was before the move and the ticket as it was before the move back.
 *
 * Refused: a PM stacked on a ticket (it is billed there), already moved, or with billing on it (a KatzDesk invoice
 * with lines, or NetSuite lines or invoices from the Billing Backfill). Moving back is refused once the ticket has
 * charges, a Sales Order, an invoice, a stacked PM, or was merged. Admins only, both ways.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { nextCallId } from "@/lib/ops/call-id";
import { checked } from "@/lib/ops/checked-input";

export const ADMIN_ONLY = "Only an Admin can move a PM to a service ticket, or back.";
export const MOVED_STATUS = "Moved To Ticket";
export const CHANGED = "The PM changed since this window opened, so nothing was moved. Look it over again, then move it.";
export const TICKET_CHANGED = "The ticket changed since this window opened, so nothing was moved back. Look it over again.";

/** PM status → ticket status. */
export const PM_TO_TICKET_STATUS: Record<string, string> = {
  "Pending Scheduling": "Open",
  Scheduled: "Dispatched",
  "Awaiting Parts": "Follow-up Needed",
  "Ready to Dispatch": "Dispatched",
  "In Progress": "In Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
};
/** Ticket status → PM status, for Move back. */
export const TICKET_TO_PM_STATUS: Record<string, string> = {
  Open: "Pending Scheduling",
  Dispatched: "Scheduled",
  "In Progress": "In Progress",
  "Follow-up Needed": "Awaiting Parts",
  "Phone Resolved": "Completed",
  Completed: "Completed",
  Cancelled: "Cancelled",
};
const caseSql = (map: Record<string, string>, col: string, fallback: string) =>
  `case ${col} ${Object.entries(map)
    .map(([a, b]) => `when '${a.replace(/'/g, "''")}' then '${b.replace(/'/g, "''")}'`)
    .join(" ")} else '${fallback}' end`;
const CLOSED_TICKET = "('Completed', 'Cancelled', 'Phone Resolved')";

/** Why a PM can't move, read from its row and its billing; null when it can. */
export const PM_MOVE_REFUSAL_SQL = (p: string) => `case
    when ${p}.moved_job_id is not null then 'This PM was moved to a service ticket already.'
    when ${p}.stacked_job_id is not null then 'This PM is stacked on a ticket and billed there. Take it off that ticket first.'
    -- Volatile functions read fresh, so an invoice approved while the move waited for the PM's lock is seen (as in pm-stack.ts).
    when pm_own_invoice_has_lines(${p}.id) then 'This PM has an invoice with lines in KatzDesk. Bill it as a PM, or take the lines off first.'
    when pm_netsuite_billed(${p}.id) then 'NetSuite billing from the Billing Backfill is on this PM. It stays a PM.'
    else null end`;

export type PmMovePreview = {
  pmId: number;
  customer: string;
  wo: string | null;
  stamp: string;
  pmStatus: string;
  ticketStatus: string;
  technician: string | null;
  /** What stays with the PM (the ticket links to it). */
  stays: string[];
  refusal: string | null;
};

async function actorName(sql: Sql, userId: string): Promise<string> {
  return (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

async function log(sql: Sql, type: "pm" | "service", id: number, actor: string, action: string, detail: string): Promise<void> {
  await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ($1, $2, $3, $4, $5)", [type, id, actor, action, detail]);
}

export async function previewPmMoveFor(sql: Sql, userId: string, pmId: number): Promise<PmMovePreview> {
  if (!(await canReviewNames(sql, userId))) throw new Error(ADMIN_ONLY);
  const r = (
    await sql.query<{
      id: number;
      customer: string;
      wo: string | null;
      status: string;
      technician: string | null;
      stamp: string;
      refusal: string | null;
      photos: number;
      notes: number;
      checks: number;
      parts: number;
    }>(
      `select p.id, p.customer, p.wo, p.status, p.technician, p.updated_at::text as stamp, ${PM_MOVE_REFUSAL_SQL("p")} as refusal,
              (select count(*)::int from ticket_photos f where f.pm_id = p.id) as photos,
              (select count(*)::int from comments c where c.entity_type = 'pm' and c.entity_id = p.id) as notes,
              (select count(*)::int from pm_runbook_checks k where k.pm_job_id = p.id) as checks,
              (select count(*)::int from ticket_part_lines w where w.pm_id = p.id) as parts
         from pm_jobs p where p.id = $1`,
      [pmId],
    )
  )[0];
  if (!r) throw new Error("PM not found");
  const stays = [
    r.photos ? `${r.photos} photo${r.photos === 1 ? "" : "s"}` : null,
    r.notes ? `${r.notes} Ping note${r.notes === 1 ? "" : "s"}` : null,
    r.checks ? `${r.checks} runbook check${r.checks === 1 ? "" : "s"}` : null,
  ].filter((s): s is string => !!s);
  return {
    pmId: Number(r.id),
    customer: r.customer,
    wo: r.wo,
    stamp: r.stamp,
    pmStatus: r.status,
    ticketStatus: PM_TO_TICKET_STATUS[r.status] ?? "Open",
    technician: r.technician,
    stays,
    refusal: r.refusal,
  };
}

/**
 * One statement: the ticket is made, the PM closed and pointed at it, and the log written, or nothing is. $1 the PM,
 * $2 its stamp as the window read it, $3 the new call id, $4 who.
 */
export function movePmSql(): string {
  return `with lk as (
    select p.*, p.updated_at::text as stamp from pm_jobs p where p.id = $1::int for update
  ), ok as (
    select lk.* from lk where lk.stamp = $2::text and ${PM_MOVE_REFUSAL_SQL("lk")} is null
  ), job as (
    insert into service_jobs (kind, call_id, customer, received, equipment, issue, call_type, status, technician, wo, scheduled,
                              sched_time, notes, done, work_done, completed_at, po, vendor_po, corrigo_id, service_location,
                              urgency, moved_from_pm_id)
    select 'service', $3::text, ok.customer, ok.received, ok.equipment, 'Moved from PM #' || ok.id, 'Field Service',
           ${caseSql(PM_TO_TICKET_STATUS, "ok.status", "Open")}, ok.technician, ok.wo, ok.projected, ok.sched_time, ok.notes,
           ${caseSql(PM_TO_TICKET_STATUS, "ok.status", "Open")} in ${CLOSED_TICKET}, ok.work_done, ok.completed_at, ok.po, ok.vendor_po,
           ok.corrigo_id, ok.service_location, 'Normal', ok.id
      from ok
    returning id, call_id
  ), pm as (
    update pm_jobs p
       set moved_job_id = (select id from job), status = '${MOVED_STATUS}', done = true, wo = null, corrigo_id = null,
           completed_at = null, updated_at = now()
      from ok where p.id = ok.id
    returning p.id
  ), lines as (
    -- WO part lines go with the work, so Parts usage and a re-import see them on the ticket.
    update ticket_part_lines l set pm_id = null, job_id = (select id from job) from ok where l.pm_id = ok.id
    returning l.id
  ), logged as (
    insert into pm_ticket_moves (pm_id, job_id, moved_by, pm_before)
    select ok.id, (select id from job), $4::text, to_jsonb(ok) - 'stamp' from ok
    returning id
  )
  select (select id from job) as job_id, (select call_id from job) as call_id, (select id from pm) as pm_id, (select id from logged) as move_id`;
}

export type PmMoveResult = { jobId: number; callId: string; pmId: number };

export async function movePmToTicketFor(sql: Sql, userId: string, data: { pmId: number; stamp: string }): Promise<PmMoveResult> {
  const plan = await previewPmMoveFor(sql, userId, data.pmId);
  if (plan.refusal) throw new Error(plan.refusal);
  if (plan.stamp !== data.stamp) throw new Error(CHANGED);
  const actor = await actorName(sql, userId);
  const received = (await sql.query<{ d: string }>("select coalesce(received, current_date)::text as d from pm_jobs where id = $1", [data.pmId]))[0]!.d;
  for (let attempt = 0; ; attempt += 1) {
    const callId = await nextCallId(sql, received);
    let rows: { job_id: number | null; call_id: string | null; pm_id: number | null }[];
    try {
      rows = await sql.query(movePmSql(), [data.pmId, data.stamp, callId, actor]);
    } catch (e) {
      // The call number was taken between the read and the write: take the next.
      if ((e as { code?: string })?.code === "23505" && attempt < 5) continue;
      throw e;
    }
    const r = rows[0];
    if (!r?.job_id || !r.pm_id) {
      const again = await previewPmMoveFor(sql, userId, data.pmId);
      throw new Error(again.refusal ?? CHANGED);
    }
    const what = `PM #${data.pmId}${plan.wo ? ` (${plan.wo})` : ""} → ticket ${r.call_id}`;
    await log(sql, "pm", data.pmId, actor, "moved-to-ticket", `Moved to service ticket ${r.call_id} by ${actor}`);
    await log(sql, "service", Number(r.job_id), actor, "moved-from-pm", `Moved from ${what} by ${actor}. Status ${plan.pmStatus} → ${plan.ticketStatus}.`);
    return { jobId: Number(r.job_id), callId: String(r.call_id), pmId: data.pmId };
  }
}

/** Why a moved ticket can't go back to its PM; null when it can. */
const UNDO_REFUSAL_SQL = (j: string) => `case
    when ${j}.duplicate_of is not null or ${j}.merged_install_id is not null then 'This ticket was merged or hidden, so it can''t go back to its PM.'
    when exists (select 1 from ticket_charges c where c.job_id = ${j}.id) then 'This ticket has charges now. Take them off before moving it back to a PM.'
    when nullif(btrim(coalesce(${j}.ns_so, '')), '') is not null or ${j}.billed_at is not null then 'This ticket is billed. It stays a ticket.'
    when exists (select 1 from ticket_invoices t where t.job_id = ${j}.id) then 'NetSuite invoices are on this ticket. It stays a ticket.'
    when exists (select 1 from invoices v where v.entity_type = ${j}.kind and v.entity_id = ${j}.id) then 'This ticket has an invoice. It stays a ticket.'
    when exists (select 1 from pm_jobs s where s.stacked_job_id = ${j}.id) then 'A PM is stacked on this ticket. Take it off first.'
    else null end`;

export type PmMoveInfo = {
  pmId: number;
  movedAt: string;
  movedBy: string | null;
  stamp: string;
  refusal: string | null;
};

/** A ticket made from a PM: which PM, when, by whom, and whether it can go back. Null for any other ticket. */
export async function pmMoveInfoFor(sql: Sql, jobId: number): Promise<PmMoveInfo | null> {
  const r = (
    await sql.query<{ pm_id: number; moved_at: string; moved_by: string | null; stamp: string; refusal: string | null }>(
      `select m.pm_id, to_char(m.moved_at at time zone 'America/Chicago', 'YYYY-MM-DD') as moved_at, m.moved_by,
              j.updated_at::text as stamp,
              case when not exists (select 1 from pm_jobs p where p.id = m.pm_id and p.moved_job_id = j.id)
                   then 'The PM no longer points at this ticket.' else ${UNDO_REFUSAL_SQL("j")} end as refusal
         from pm_ticket_moves m join service_jobs j on j.id = m.job_id
        where m.job_id = $1 and m.undone_at is null
        order by m.id desc limit 1`,
      [jobId],
    )
  )[0];
  return r ? { pmId: Number(r.pm_id), movedAt: r.moved_at, movedBy: r.moved_by, stamp: r.stamp, refusal: r.refusal } : null;
}

/** One statement: the PM takes the ticket's work back and opens; the ticket is closed as Cancelled; the log notes it. $1 ticket, $2 stamp, $3 who. */
export function undoPmMoveSql(): string {
  return `with lk_job as (
    select j.*, j.updated_at::text as stamp from service_jobs j where j.id = $1::int for update
  ), mv as (
    select m.id, m.pm_id from pm_ticket_moves m where m.job_id = $1::int and m.undone_at is null order by m.id desc limit 1
  ), lk_pm as (
    select p.id from pm_jobs p where p.id = (select pm_id from mv) and p.moved_job_id = $1::int for update
  ), ok as (
    select lk_job.* from lk_job where lk_job.stamp = $2::text and exists (select 1 from lk_pm) and ${UNDO_REFUSAL_SQL("lk_job")} is null
  ), pm as (
    update pm_jobs p
       set moved_job_id = null, status = ${caseSql(TICKET_TO_PM_STATUS, "ok.status", "Pending Scheduling")},
           done = ${caseSql(TICKET_TO_PM_STATUS, "ok.status", "Pending Scheduling")} in ('Completed', 'Cancelled'),
           -- A PM never goes on Walk - In: one moved back from a Walk - In ticket keeps its own account.
           customer = case when regexp_replace(lower(btrim(coalesce(ok.customer, ''))), '[^a-z0-9]+', '', 'g') in ('', 'walkin') then p.customer else ok.customer end,
           equipment = ok.equipment, technician = ok.technician, wo = ok.wo, projected = ok.scheduled,
           sched_time = ok.sched_time, notes = ok.notes, work_done = ok.work_done, completed_at = ok.completed_at, po = ok.po,
           vendor_po = ok.vendor_po, corrigo_id = ok.corrigo_id, service_location = ok.service_location, updated_at = now()
      from ok where p.id = (select id from lk_pm)
    returning p.id, p.status
  ), lines as (
    update ticket_part_lines l set job_id = null, pm_id = (select id from lk_pm) from ok where l.job_id = ok.id
    returning l.id
  ), job as (
    update service_jobs j
       set status = 'Cancelled', done = true, wo = null, corrigo_id = null,
           notes = concat_ws(E'\n\n', nullif(btrim(coalesce(j.notes, '')), ''), 'Moved back to PM #' || (select id from lk_pm) || ' by ' || $3::text || '.'),
           updated_at = now()
      from ok where j.id = ok.id
    returning j.id
  ), logged as (
    update pm_ticket_moves m set undone_at = now(), undone_by = $3::text, job_before_undo = to_jsonb(ok) - 'stamp'
      from ok where m.id = (select id from mv)
    returning m.id
  )
  select (select id from pm) as pm_id, (select status from pm) as status, (select id from job) as job_id, (select id from logged) as move_id`;
}

export async function undoPmMoveFor(sql: Sql, userId: string, data: { jobId: number; stamp: string }): Promise<{ pmId: number; status: string }> {
  if (!(await canReviewNames(sql, userId))) throw new Error(ADMIN_ONLY);
  const info = await pmMoveInfoFor(sql, data.jobId);
  if (!info) throw new Error("This ticket wasn't moved from a PM.");
  if (info.refusal) throw new Error(info.refusal);
  if (info.stamp !== data.stamp) throw new Error(TICKET_CHANGED);
  const actor = await actorName(sql, userId);
  const r = (await sql.query<{ pm_id: number | null; status: string | null; job_id: number | null }>(undoPmMoveSql(), [data.jobId, data.stamp, actor]))[0];
  if (!r?.pm_id || !r.job_id) {
    const again = await pmMoveInfoFor(sql, data.jobId);
    throw new Error(again?.refusal ?? TICKET_CHANGED);
  }
  const call = (await sql.query<{ call_id: string }>("select call_id from service_jobs where id = $1", [data.jobId]))[0]?.call_id ?? `#${data.jobId}`;
  await log(sql, "pm", Number(r.pm_id), actor, "moved-back-from-ticket", `Moved back from service ticket ${call} by ${actor}. Status ${r.status}.`);
  await log(sql, "service", data.jobId, actor, "moved-back-to-pm", `Moved back to PM #${r.pm_id} by ${actor}. This ticket is Cancelled; its work is on the PM.`);
  return { pmId: Number(r.pm_id), status: String(r.status) };
}

const pmIdInput = checked(z.object({ pmId: z.number().int().positive() }));
const moveInput = checked(z.object({ pmId: z.number().int().positive(), stamp: z.string().min(1).max(100) }));
const jobIdInput = checked(z.object({ jobId: z.number().int().positive() }));
const undoInput = checked(z.object({ jobId: z.number().int().positive(), stamp: z.string().min(1).max(100) }));

export const previewPmMove = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(pmIdInput)
  .handler(async ({ data, context }) => previewPmMoveFor(await getSql(), context.userId, data.pmId));
export const movePmToTicket = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(moveInput)
  .handler(async ({ data, context }) => movePmToTicketFor(await getSql(), context.userId, data));
export const getPmMoveInfo = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(jobIdInput)
  .handler(async ({ data }) => pmMoveInfoFor(await getSql(), data.jobId));
export const undoPmMove = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(undoInput)
  .handler(async ({ data, context }) => undoPmMoveFor(await getSql(), context.userId, data));
