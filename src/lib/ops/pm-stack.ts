/**
 * Stack a PM on a service or TLC ticket so the visit bills once. Pure rules and the two write statements.
 * Safe for node --test. The customer key matches normalizeCustomerKey.
 */
import { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";
import { LIVE_INVOICE_SQL } from "./billing-rules.ts";

export type StackPm = {
  id: number;
  customer: string | null;
  status: string;
  stackedJobId: number | null;
};

export type StackTicket = {
  id: number;
  customer: string | null;
  status: string;
  nsSo: string | null;
  duplicateOf: number | null;
  phoneResolved: boolean;
  wo: string | null;
  callId: string | null;
  /** The NetSuite invoice that locks the ticket (one that isn't Voided), or null. */
  invoiced?: string | null;
};

const customerKeySql = (col: string) => `regexp_replace(lower(coalesce(${col}, '')), '[^a-z0-9]+', '', 'g')`;

/** Why this PM cannot stack on this ticket. The first reason wins. A completed PM can stack. */
export function stackRefusal(pm: StackPm, ticket: StackTicket, stackedCount: number, pmInvoiceHasLines: boolean): string | null {
  if (pm.status === "Cancelled") return `PM #${pm.id} is cancelled.`;
  if (ticket.status === "Cancelled") return `Ticket #${ticket.id} is cancelled.`;
  if (ticket.status === "Phone Resolved" || ticket.phoneResolved) {
    return `Ticket #${ticket.id} was phone resolved, so there is no visit to bill.`;
  }
  const so = String(ticket.nsSo ?? "").trim();
  if (so) return `Ticket #${ticket.id} is billed (${so}). Clear its Sales Order first.`;
  // Invoiced in NetSuite: its charges are locked, so a PM put on it could never be billed there (10/28 review).
  if (ticket.invoiced) return `Ticket #${ticket.id} is invoiced in NetSuite (${ticket.invoiced}). Bill the PM on its own.`;
  if (ticket.duplicateOf) return `Ticket #${ticket.id} was merged into #${ticket.duplicateOf}. Stack the PM there.`;
  if (pm.stackedJobId === ticket.id) return `PM #${pm.id} is already on this ticket.`;
  if (pm.stackedJobId != null) return `PM #${pm.id} is already on ticket #${pm.stackedJobId}. Unstack it first.`;
  const pmKey = normalizeCustomerKey(pm.customer);
  const ticketKey = normalizeCustomerKey(ticket.customer);
  if (!pmKey || !ticketKey || isWalkIn(pm.customer) || isWalkIn(ticket.customer)) {
    return "Only a PM and ticket for a real customer can be stacked.";
  }
  if (pmKey !== ticketKey) {
    return `PM #${pm.id} is for ${(pm.customer ?? "").trim()}, but ticket #${ticket.id} is for ${(ticket.customer ?? "").trim()}.`;
  }
  if (stackedCount >= 10) return `Ticket #${ticket.id} already carries 10 PMs.`;
  if (pmInvoiceHasLines) return `PM #${pm.id} already has its own approved invoice, so it stays billed there.`;
  return null;
}

/**
 * Null when the customer key is not changing, and when every stacked partner already has the new key.
 * Otherwise the sentence for the side that is being edited.
 */
export function stackCustomerRefusal(
  current: string | null | undefined,
  next: string | null | undefined,
  partners: { id: number; customer: string | null }[],
  side: "pm" | "ticket",
): string | null {
  if (normalizeCustomerKey(current) === normalizeCustomerKey(next)) return null;
  const nextKey = normalizeCustomerKey(next);
  if (partners.length > 0 && partners.every((p) => normalizeCustomerKey(p.customer) === nextKey)) return null;
  const bad = partners.find((p) => normalizeCustomerKey(p.customer) !== nextKey);
  if (!bad) return null;
  const name = (bad.customer ?? "").trim() || "another customer";
  if (side === "pm") return `This PM is stacked on ticket #${bad.id} (${name}). Unstack it first.`;
  return `PM #${bad.id} is stacked on this ticket (${name}). Unstack it first.`;
}

/**
 * One statement. Locks the ticket, stacks the PM when every rule holds, and writes both activity rows.
 * $1 pm id, $2 ticket id, $3 actor. 0 rows means the caller re-reads and throws stackRefusal.
 */
export function stackPmSql(): string {
  const pmKey = customerKeySql("pm.customer");
  const ticketKey = customerKeySql("ticket.customer");
  return `with ticket as (
       select j.id, j.kind, j.customer, j.status, j.ns_so, j.duplicate_of, j.phone_resolved, j.wo, j.call_id,
              (select count(*)::int from pm_jobs p where p.stacked_job_id = j.id) as stacked
         from service_jobs j
        where j.id = $2
        for update
     ), pm as (
       select p.id, p.customer, p.status, p.stacked_job_id
         from pm_jobs p
        where p.id = $1
        for update
     ), ok as (
       select pm.id, ticket.id as job_id, ticket.kind, ticket.wo, ticket.call_id
         from pm
         join ticket on true
        where pm.status <> 'Cancelled'
          and ticket.status <> 'Cancelled'
          and ticket.status <> 'Phone Resolved'
          and coalesce(ticket.phone_resolved, false) = false
          and nullif(btrim(ticket.ns_so), '') is null
          and not ${LIVE_INVOICE_SQL("ticket.id")}
          and ticket.duplicate_of is null
          and pm.stacked_job_id is null
          and ${pmKey} <> ''
          and ${pmKey} <> 'walkin'
          and ${ticketKey} <> ''
          and ${ticketKey} <> 'walkin'
          and ${pmKey} = ${ticketKey}
          and ticket.stacked < 10
          -- A volatile function reads with a fresh snapshot, so an own-invoice approve that committed while this
          -- statement waited for the PM lock is seen (a plain subquery here would use the statement's old snapshot).
          and not pm_own_invoice_has_lines(pm.id)
     ), upd as (
       update pm_jobs p
          set stacked_job_id = ok.job_id, updated_at = now()
         from ok
        where p.id = ok.id
       returning p.id, ok.job_id, ok.kind, ok.wo, ok.call_id
     ), act_pm as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'pm', upd.id, $3, 'stacked',
              'Stacked on ticket #' || upd.job_id::text
                || case
                     when nullif(btrim(upd.wo), '') is not null then ' (' || btrim(upd.wo) || ')'
                     when nullif(btrim(upd.call_id), '') is not null then ' (' || btrim(upd.call_id) || ')'
                     else ''
                   end
         from upd
       returning id
     ), act_job as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select upd.kind, upd.job_id, $3, 'stacked', 'PM #' || upd.id::text || ' stacked on this ticket'
         from upd
       returning id
     )
     select upd.id,
            (select count(*)::int from act_pm) as pm_notes,
            (select count(*)::int from act_job) as job_notes
       from upd`;
}

/**
 * Clear the stack only while the ticket is not billed and none of this PM's kit or part lines are on it.
 * $1 pm id, $2 actor.
 */
export function unstackPmSql(): string {
  return `with pm as (
       select p.id, p.stacked_job_id
         from pm_jobs p
        where p.id = $1
        for update
     ), ticket as (
       select j.id, j.kind, j.ns_so
         from service_jobs j
         join pm on j.id = pm.stacked_job_id
        for update of j
     ), ok as (
       select pm.id, ticket.id as job_id, ticket.kind
         from pm
         join ticket on true
        where nullif(btrim(ticket.ns_so), '') is null
          and not exists (
            select 1 from ticket_charges c
             where c.job_id = ticket.id
               and (
                 -- The id is its own colon-bounded field, so pmkit:32: never matches PM 3 or PM 320.
                 (split_part(c.source_key, ':', 1) = 'pmkit' and split_part(c.source_key, ':', 2) = pm.id::text)
                 or c.source_key in (select 'mp:' || m.id::text from machine_parts m where m.pm_job_id = pm.id)
               )
          )
     ), upd as (
       update pm_jobs p
          set stacked_job_id = null, updated_at = now()
         from ok
        where p.id = ok.id
       returning p.id, ok.job_id, ok.kind
     ), act_pm as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'pm', upd.id, $2, 'unstacked', 'Unstacked from ticket #' || upd.job_id::text
         from upd
       returning id
     ), act_job as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select upd.kind, upd.job_id, $2, 'unstacked', 'PM #' || upd.id::text || ' unstacked'
         from upd
       returning id
     )
     select upd.id,
            (select count(*)::int from act_pm) as pm_notes,
            (select count(*)::int from act_job) as job_notes
       from upd`;
}
