import { customersCompatible, isWalkIn, woCanonical, woMatchKey } from "./corrigo";
import { normalizeCustomerKey } from "./customer-key";

type SqlLike = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

export type ServiceDupRow = {
  id: number;
  kind: "service" | "tlc";
  call_id: string;
  customer: string | null;
  contact: string | null;
  phone: string | null;
  equipment: string | null;
  issue: string | null;
  call_type: string | null;
  technician: string | null;
  wo: string | null;
  status: string;
  notes: string | null;
  work_done: string | null;
  completed_at: string | null;
  scheduled: string | null;
  received: string | null;
  urgency: string | null;
  done: boolean;
  duplicate_of: number | null;
};

const DUP_COLS = `
  id, kind, call_id, customer, contact, phone, equipment, issue, call_type,
  technician, wo, status, notes, work_done, completed_at, scheduled, received,
  urgency, done, duplicate_of
`;

export function mergeNotes(keeper: string | null | undefined, extra: string | null | undefined): string | null {
  const a = String(keeper ?? "").trim();
  const b = String(extra ?? "").trim();
  if (!a) return b || null;
  if (!b) return a;
  if (a.includes(b) || b.includes(a)) return a.length >= b.length ? a : b;
  return `${a}\n\n${b}`;
}

function keepFilled(keeper: string | null | undefined, extra: string | null | undefined): string | null {
  const a = String(keeper ?? "").trim();
  if (a) return keeper ?? null;
  const b = String(extra ?? "").trim();
  return b ? extra ?? null : keeper ?? null;
}

export function preferCustomer(
  keeper: string | null | undefined,
  extra: string | null | undefined,
): string | null {
  const k = String(keeper ?? "").trim();
  const e = String(extra ?? "").trim();
  if (!k || isWalkIn(k)) return e || k || null;
  return k;
}

export function mergeJobFields(keeper: ServiceDupRow, extra: ServiceDupRow): {
  customer: string | null;
  contact: string | null;
  phone: string | null;
  equipment: string | null;
  issue: string | null;
  call_type: string | null;
  technician: string | null;
  wo: string | null;
  notes: string | null;
  work_done: string | null;
  completed_at: string | null;
  scheduled: string | null;
  received: string | null;
  urgency: string | null;
} {
  const woSource = keeper.wo || extra.wo || "";
  return {
    customer: preferCustomer(keeper.customer, extra.customer),
    contact: keepFilled(keeper.contact, extra.contact),
    phone: keepFilled(keeper.phone, extra.phone),
    equipment: keepFilled(keeper.equipment, extra.equipment),
    issue: keepFilled(keeper.issue, extra.issue),
    call_type: keepFilled(keeper.call_type, extra.call_type),
    technician: keepFilled(keeper.technician, extra.technician),
    wo: woCanonical(woSource) || keeper.wo || extra.wo,
    notes: mergeNotes(keeper.notes, extra.notes),
    work_done: keepFilled(keeper.work_done, extra.work_done),
    completed_at: keepFilled(keeper.completed_at, extra.completed_at),
    scheduled: keepFilled(keeper.scheduled, extra.scheduled),
    received: keepFilled(keeper.received, extra.received),
    urgency: keepFilled(keeper.urgency, extra.urgency) || "Normal",
  };
}

async function loadJob(sql: SqlLike, id: number): Promise<ServiceDupRow | null> {
  const rows = await sql.query<ServiceDupRow>(
    `select ${DUP_COLS} from service_jobs where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function ultimateKeeper(sql: SqlLike, id: number): Promise<ServiceDupRow | null> {
  const seen = new Set<number>();
  let row = await loadJob(sql, id);
  while (row?.duplicate_of && !seen.has(row.id)) {
    seen.add(row.id);
    row = await loadJob(sql, row.duplicate_of);
  }
  return row;
}

/** What a merge has to know about money on one ticket. */
export type MergeMoney = {
  id: number;
  nsSo: string | null;
  lines: number;
  hasQuote: boolean;
  discountKind: string | null;
  discountValue: number | null;
  /** YYYY-MM-DD, or null when the ticket is not completed. */
  completedAt: string | null;
  /** PMs stacked on this ticket. Omitted by older callers; treated as none. */
  stackedPms?: { id: number; customer: string | null }[];
};

function salesOrder(nsSo: string | null): string | null {
  const so = String(nsSo ?? "").trim();
  return so || null;
}

function moneyDiscount(row: MergeMoney): { kind: "percent" | "amount"; value: number } | null {
  if (row.discountKind !== "percent" && row.discountKind !== "amount") return null;
  const value = Number(row.discountValue);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { kind: row.discountKind, value };
}

function discountPhrase(kind: "percent" | "amount", value: number): string {
  if (kind === "percent") return `${Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)}%`;
  return `$${value.toFixed(2)}`;
}

function discountRefusal(keeper: MergeMoney, extra: MergeMoney): string | null {
  if (extra.lines <= 0) return null;
  const k = moneyDiscount(keeper);
  const e = moneyDiscount(extra);
  const neither = !k && !e;
  const bothPercent = k?.kind === "percent" && e?.kind === "percent" && k.value === e.value;
  const keeperTakesExtra = keeper.lines === 0 && !k;
  if (neither || bothPercent || keeperTakesExtra) return null;
  if (k && e) {
    return `Ticket #${keeper.id} has a ${discountPhrase(k.kind, k.value)} discount and ticket #${extra.id} has ${discountPhrase(e.kind, e.value)}; merged, only one would apply. Make the discounts match first.`;
  }
  const has = k ?? e;
  if (!has) return null;
  const hasId = k ? keeper.id : extra.id;
  const lacksId = k ? extra.id : keeper.id;
  return `Ticket #${hasId} has a ${discountPhrase(has.kind, has.value)} discount that ticket #${lacksId} doesn't. Make the discounts match first.`;
}

function completedPhrase(value: string | null): string {
  return value ? `completed ${value}` : "not completed yet";
}

/** A blank extra counts as a different date. Lines must not change which week they bill in. */
function completedRefusal(keeper: MergeMoney, extra: MergeMoney): string | null {
  const kd = keeper.completedAt || null;
  const ed = extra.completedAt || null;
  const moved =
    (extra.lines > 0 && kd != null && kd !== ed) || (keeper.lines > 0 && kd == null && ed != null);
  if (!moved) return null;
  return `Ticket #${extra.id} (${completedPhrase(ed)}) and #${keeper.id} (${completedPhrase(kd)}) would bill in different weeks. Make the completed dates match first.`;
}

/**
 * Why these two tickets must not be folded together, or null when the money can move.
 * Checked again inside mergeTicketsSql so a Sales Order saved in between still stops the write.
 * `mergedCustomer` is preferCustomer of the two tickets ($4). Existing callers may omit it.
 */
export function mergeMoneyRefusal(keeper: MergeMoney, extra: MergeMoney, mergedCustomer?: string | null): string | null {
  const extraSo = salesOrder(extra.nsSo);
  if (extraSo) return `Ticket #${extra.id} is billed on ${extraSo}. Merge the other ticket into it instead.`;
  const keeperSo = salesOrder(keeper.nsSo);
  const extraPms = [...(extra.stackedPms ?? [])].sort((a, b) => a.id - b.id);
  if (keeperSo && extraPms[0]) {
    return `Ticket #${keeper.id} is billed on ${keeperSo}. Unstack PM #${extraPms[0].id} from #${extra.id} before merging.`;
  }
  if (keeperSo && extra.lines > 0) {
    return `Ticket #${keeper.id} is billed on ${keeperSo}. Clear its Sales Order before merging charges into it.`;
  }
  if (keeper.hasQuote && extra.hasQuote) return "Both tickets have a repair quote. Combine them by hand first.";
  const discount = discountRefusal(keeper, extra);
  if (discount) return discount;
  const completed = completedRefusal(keeper, extra);
  if (completed) return completed;
  if (keeper.lines + extra.lines > 200) return "Together these tickets would have more than 200 charge lines.";
  const all = [...(keeper.stackedPms ?? []), ...extraPms];
  if (all.length > 10) return "Together these tickets carry more than 10 PMs. Unstack some first.";
  const mergedKey = normalizeCustomerKey(mergedCustomer);
  const mismatch = [...all].sort((a, b) => a.id - b.id).find((p) => normalizeCustomerKey(p.customer) !== mergedKey);
  if (mismatch) {
    const name = (mismatch.customer ?? "").trim() || "another customer";
    const mergedName = String(mergedCustomer ?? "").trim() || "the merged customer";
    return `PM #${mismatch.id} is for ${name}, not ${mergedName}. Unstack it before merging.`;
  }
  return null;
}

type MoneyRow = {
  id: number;
  ns_so: string | null;
  po: string | null;
  discount_kind: string | null;
  discount_value: string | number | null;
  lines: number | string;
  has_quote: boolean | string;
  completed_at: string | null;
  updated: string | null;
};

function toMoney(row: MoneyRow): MergeMoney {
  const kind = row.discount_kind;
  const raw = row.discount_value;
  const value = raw == null || raw === "" ? null : Number(raw);
  return {
    id: Number(row.id),
    nsSo: row.ns_so,
    lines: Number(row.lines) || 0,
    hasQuote: row.has_quote === true || row.has_quote === "t",
    discountKind: kind,
    discountValue: value != null && Number.isFinite(value) ? value : null,
    completedAt: row.completed_at || null,
  };
}

/** ns_so, po, discount, charge count, completed date, and whether a repair quote exists — both tickets, one select. */
async function loadMergeMoney(
  sql: SqlLike,
  keeperId: number,
  extraId: number,
): Promise<{ keeper: MergeMoney; extra: MergeMoney; keeperUpdated: string; extraUpdated: string } | null> {
  const rows = await sql.query<MoneyRow>(
    `select j.id, j.ns_so, j.po, j.discount_kind, j.discount_value,
            to_char(j.completed_at, 'YYYY-MM-DD') as completed_at,
            j.updated_at::text as updated,
            (select count(*)::int from ticket_charges c where c.job_id = j.id) as lines,
            exists (select 1 from repair_quotes q where q.job_id = j.id) as has_quote
       from service_jobs j
      where j.id = any($1::int[])`,
    [[keeperId, extraId]],
  );
  const keeper = rows.find((row) => Number(row.id) === keeperId);
  const extra = rows.find((row) => Number(row.id) === extraId);
  if (!keeper || !extra) return null;
  const pmRows = await sql.query<{ id: number; stacked_job_id: number; customer: string | null }>(
    `select id, stacked_job_id, customer from pm_jobs where stacked_job_id = any($1::int[]) order by id`,
    [[keeperId, extraId]],
  );
  const stacked = (jobId: number) =>
    pmRows
      .filter((p) => Number(p.stacked_job_id) === jobId)
      .map((p) => ({ id: Number(p.id), customer: p.customer }));
  return {
    keeper: { ...toMoney(keeper), stackedPms: stacked(keeperId) },
    extra: { ...toMoney(extra), stackedPms: stacked(extraId) },
    keeperUpdated: keeper.updated ?? "",
    extraUpdated: extra.updated ?? "",
  };
}

const CHANGED_WHILE_MERGING = "Those tickets changed while merging. Try again.";

/**
 * One statement: move the extra ticket onto the keeper, or write nothing.
 * $1 keeper id, $2 extra id, $3 actor, $4 customer, $5 contact, $6 phone, $7 equipment,
 * $8 issue, $9 call type, $10 technician, $11 wo, $12 notes, $13 work done,
 * $14 completed, $15 scheduled, $16 received, $17 urgency, $18 keeper updated_at text, $19 extra updated_at text.
 * The field values are mergeJobFields. P.O. and discount are copied from the locked rows in g, not read again.
 * Zero rows means a refusal became true after the check (nothing was written).
 */
export function mergeTicketsSql(): string {
  return `with lk as (
    select id, kind, ns_so, po, discount_kind, discount_value, call_id, wo, completed_at, duplicate_of,
           updated_at::text as updated
      from service_jobs
     where id = any(array[$1::int, $2::int])
     order by id
       for update
  ), pair as (
    select
      k.id as keeper_id,
      e.id as extra_id,
      k.kind as keeper_kind,
      k.ns_so as keeper_so,
      e.ns_so as extra_so,
      k.po as keeper_po,
      e.po as extra_po,
      k.discount_kind as keeper_dk,
      k.discount_value as keeper_dv,
      e.discount_kind as extra_dk,
      e.discount_value as extra_dv,
      e.call_id as extra_call,
      e.wo as extra_wo,
      k.completed_at as keeper_done,
      e.completed_at as extra_done,
      k.duplicate_of as keeper_dup,
      e.duplicate_of as extra_dup,
      k.updated as keeper_updated,
      e.updated as extra_updated,
      (select count(*)::int from ticket_charges c where c.job_id = k.id) as keeper_lines,
      (select count(*)::int from ticket_charges c where c.job_id = e.id) as extra_lines,
      exists (select 1 from repair_quotes q where q.job_id = k.id) as keeper_quote,
      exists (select 1 from repair_quotes q where q.job_id = e.id) as extra_quote
    from lk k
    join lk e on e.id = $2::int
    where k.id = $1::int
      and k.id <> e.id
  ), g as (
    select * from pair
     where nullif(btrim(extra_so), '') is null
       and not (nullif(btrim(keeper_so), '') is not null and extra_lines > 0)
       and not (keeper_quote and extra_quote)
       and not (
         extra_lines > 0
         and not (
           (
             not (coalesce(keeper_dk, '') in ('percent', 'amount') and coalesce(keeper_dv, 0) > 0)
             and not (coalesce(extra_dk, '') in ('percent', 'amount') and coalesce(extra_dv, 0) > 0)
           )
           or (
             keeper_dk = 'percent' and extra_dk = 'percent'
             and coalesce(keeper_dv, 0) > 0 and coalesce(extra_dv, 0) > 0
             and keeper_dv = extra_dv
           )
           or (
             keeper_lines = 0
             and not (coalesce(keeper_dk, '') in ('percent', 'amount') and coalesce(keeper_dv, 0) > 0)
           )
         )
       )
       and not (extra_lines > 0 and keeper_done is not null and keeper_done is distinct from extra_done)
       and not (keeper_lines > 0 and keeper_done is null and extra_done is not null)
       and keeper_dup is null
       and extra_dup is null
       and keeper_updated = $18
       and extra_updated = $19
       and keeper_lines + extra_lines <= 200
       and not (
         nullif(btrim(keeper_so), '') is not null
         and exists (select 1 from pm_jobs p where p.stacked_job_id = extra_id)
       )
       and (select count(*)::int from pm_jobs p where p.stacked_job_id in (keeper_id, extra_id)) <= 10
       and not exists (
         select 1 from pm_jobs p
          where p.stacked_job_id in (keeper_id, extra_id)
            and regexp_replace(lower(coalesce(p.customer, '')), '[^a-z0-9]+', '', 'g')
                is distinct from regexp_replace(lower(coalesce($4::text, '')), '[^a-z0-9]+', '', 'g')
       )
  ), chg as (
    update ticket_charges c
       set job_id = s.keeper_id,
           sort = s.new_sort
      from (
        select c2.id,
               g.keeper_id,
               g.extra_id,
               coalesce((select max(t.sort) from ticket_charges t where t.job_id = g.keeper_id), 0)
                 + row_number() over (order by c2.sort, c2.id) as new_sort
          from ticket_charges c2
          join g on c2.job_id = g.extra_id
      ) s
     where c.id = s.id and c.job_id = s.extra_id
    returning c.id
  ), quo as (
    update repair_quotes q
       set job_id = g.keeper_id
      from g
     where q.job_id = g.extra_id
    returning q.id
  ), reb as (
    update rebuilds r
       set job_id = g.keeper_id
      from g
     where r.job_id = g.extra_id
    returning r.id
  ), inv_del as (
    delete from invoices i
     using g
     where i.entity_id = g.extra_id
       and i.entity_type in ('service', 'tlc')
       and exists (
         select 1 from invoices k
          where k.entity_id = g.keeper_id
            and k.entity_type in ('service', 'tlc')
       )
    returning i.id
  ), inv_move as (
    update invoices i
       set entity_type = g.keeper_kind,
           entity_id = g.keeper_id,
           customer = $4
      from g
     where i.entity_id = g.extra_id
       and i.entity_type in ('service', 'tlc')
       and not exists (
         select 1 from invoices k
          where k.entity_id = g.keeper_id
            and k.entity_type in ('service', 'tlc')
       )
    returning i.id
  ), inv_cust as (
    update invoices i
       set customer = $4, updated_at = now()
      from g
     where i.entity_id = g.keeper_id
       and i.entity_type in ('service', 'tlc')
       and i.customer is distinct from $4
    returning i.id
  ), pms as (
    update pm_jobs p
       set stacked_job_id = g.keeper_id, updated_at = now()
      from g
     where p.stacked_job_id = g.extra_id
    returning p.id, g.keeper_id, g.extra_id
  ), pm_act as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select 'pm', pms.id, $3, 'stacked',
           'Moved to ticket #' || pms.keeper_id::text || '; ticket #' || pms.extra_id::text || ' was merged into it.'
      from pms
    returning id
  ), job as (
    update service_jobs k
       set customer = $4,
           contact = $5,
           phone = $6,
           equipment = $7,
           issue = $8,
           call_type = $9,
           technician = $10,
           wo = $11,
           notes = $12,
           work_done = $13,
           completed_at = $14,
           scheduled = $15,
           received = $16,
           urgency = $17,
           po = coalesce(nullif(btrim(k.po), ''), g.extra_po),
           discount_kind = case when g.keeper_lines = 0 and g.keeper_dk is null and g.extra_lines > 0 then g.extra_dk else k.discount_kind end,
           discount_value = case when g.keeper_lines = 0 and g.keeper_dk is null and g.extra_lines > 0 then g.extra_dv else k.discount_value end,
           updated_at = now()
      from g
     where k.id = g.keeper_id
    returning k.id
  ), com as (
    update comments c
       set entity_type = g.keeper_kind, entity_id = g.keeper_id
      from g
     where c.entity_id = g.extra_id and c.entity_type in ('service', 'tlc')
    returning c.id
  ), act_move as (
    update activity a
       set entity_type = g.keeper_kind, entity_id = g.keeper_id
      from g
     where a.entity_id = g.extra_id and a.entity_type in ('service', 'tlc')
    returning a.id
  ), pings as (
    update desk_notifications n
       set entity_type = g.keeper_kind, entity_id = g.keeper_id
      from g
     where n.entity_id = g.extra_id and n.entity_type in ('service', 'tlc')
    returning n.id
  ), ast as (
    update assets a
       set job_id = g.keeper_id
      from g
     where a.job_id = g.extra_id
    returning a.id
  ), dup as (
    update service_jobs s
       set duplicate_of = g.keeper_id, updated_at = now()
      from g
     where (s.id = g.extra_id or s.duplicate_of = g.extra_id)
       and s.id <> g.keeper_id
    returning s.id
  ), merged as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select g.keeper_kind, g.keeper_id, $3, 'merged',
           'Merged #' || g.extra_id::text || ' (' || coalesce(g.extra_call, '') || ') into this ticket'
             || case
                  when coalesce(nullif(btrim($11::text), ''), nullif(btrim(g.extra_wo), '')) is not null
                  then ' · ' || coalesce(nullif(btrim($11::text), ''), nullif(btrim(g.extra_wo), ''))
                  else ''
                end
             || ' · moved ' || (select count(*)::text from chg) || ' charge line'
             || case when (select count(*) from chg) = 1 then '' else 's' end
             || case when (select count(*) from quo) > 0 then ' and the repair quote' else '' end
             || case
                  when nullif(btrim(g.keeper_po), '') is not null
                   and nullif(btrim(g.extra_po), '') is not null
                   and btrim(g.keeper_po) <> btrim(g.extra_po)
                  then ' · extra P.O. ' || btrim(g.extra_po)
                  else ''
                end
      from g
    returning id
  )
  select g.keeper_id, g.extra_id,
         (select count(*)::int from chg) as charges,
         (select count(*)::int from quo) as quotes,
         (select count(*)::int from reb) as rebuilds,
         (select count(*)::int from inv_del) as invoices_deleted,
         (select count(*)::int from inv_move) as invoices_moved,
         (select count(*)::int from inv_cust) as invoices_customer,
         (select count(*)::int from job) as jobs,
         (select count(*)::int from com) as comments,
         (select count(*)::int from act_move) as activity_moved,
         (select count(*)::int from pings) as notifications,
         (select count(*)::int from ast) as assets,
         (select count(*)::int from dup) as duplicates,
         (select count(*)::int from merged) as noted,
         (select count(*)::int from pms) as pms_moved,
         (select count(*)::int from pm_act) as pms_noted
    from g`;
}

export type MergeOutcome = { keeperId: number; extraId: number } | { refused: string } | null;

/** Fold extra onto keeper. Notes are kept (appended if both have text). Charges, the quote, and the invoice move with it. */
export async function mergeServiceJobs(
  sql: SqlLike,
  keeperId: number,
  extraId: number,
  actor: string,
): Promise<MergeOutcome> {
  if (keeperId === extraId) return null;
  const keeper = await ultimateKeeper(sql, keeperId);
  const extra = await loadJob(sql, extraId);
  if (!keeper || !extra) return null;
  if (extra.id === keeper.id) return { keeperId: keeper.id, extraId };
  if (extra.duplicate_of === keeper.id) return { keeperId: keeper.id, extraId: extra.id };
  if (extra.duplicate_of) return { refused: `Ticket #${extra.id} was already merged into #${extra.duplicate_of}.` };

  const money = await loadMergeMoney(sql, keeper.id, extra.id);
  if (!money) return null;
  const mergedCustomer = preferCustomer(keeper.customer, extra.customer);
  const reason = mergeMoneyRefusal(money.keeper, money.extra, mergedCustomer);
  if (reason) return { refused: reason };

  const next = mergeJobFields(keeper, extra);
  const rows = await sql.query<{ keeper_id: number }>(mergeTicketsSql(), [
    keeper.id,
    extra.id,
    actor,
    next.customer,
    next.contact,
    next.phone,
    next.equipment,
    next.issue,
    next.call_type,
    next.technician,
    next.wo,
    next.notes,
    next.work_done,
    next.completed_at,
    next.scheduled,
    next.received,
    next.urgency,
    money.keeperUpdated,
    money.extraUpdated,
  ]);
  if (!rows[0]) {
    const againExtra = await loadJob(sql, extra.id);
    if (againExtra?.duplicate_of) return { refused: `Ticket #${extra.id} was already merged into #${againExtra.duplicate_of}.` };
    const again = await loadMergeMoney(sql, keeper.id, extra.id);
    const raced = again
      ? mergeMoneyRefusal(again.keeper, again.extra, preferCustomer(keeper.customer, againExtra?.customer ?? extra.customer))
      : null;
    return { refused: raced ?? CHANGED_WHILE_MERGING };
  }
  return { keeperId: keeper.id, extraId: extra.id };
}

export type DuplicateMergeResult =
  | "merged"
  | "flagged"
  | "skipped"
  | { result: "held"; reason: string; keeperId: number; extraId: number };

export async function tryMergeServiceDuplicate(
  sql: SqlLike,
  keeperId: number,
  extraId: number,
  actor: string,
): Promise<DuplicateMergeResult> {
  if (keeperId === extraId) return "skipped";
  const keeper = await ultimateKeeper(sql, keeperId);
  const extra = await loadJob(sql, extraId);
  if (!keeper || !extra || extra.id === keeper.id) return "skipped";
  if (extra.duplicate_of) {
    return extra.duplicate_of === keeper.id ? "merged" : "skipped";
  }
  if (customersCompatible(keeper.customer, extra.customer)) {
    const result = await mergeServiceJobs(sql, keeper.id, extra.id, actor);
    if (result && "refused" in result) return { result: "held", reason: result.refused, keeperId: keeper.id, extraId: extra.id };
    if (!result) return "skipped";
    return "merged";
  }
  return "flagged";
}

export type HeldMerge = { keeperId: number; extraId: number; reason: string };

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export type HeldReview = { keeperId: number; extraId: number; reason: string; perRowExtra: number };

export type HeldReviewTicket = {
  id: number;
  kind: string;
  wo: string | null;
  customer: string | null;
  status: string;
  technician: string | null;
  duplicate_of: number | null;
};

/** One review row per held pair, on the per-row extra. An importing ticket's open or wrap row is left alone. A pair with either ticket already merged is dropped. */
export function attachHeldReview<T extends { id: number; entityType: string; reason?: string; note?: string; wo?: string; customer?: string | null; status?: string; technician?: string | null }>(
  review: T[],
  holds: HeldReview[],
  tickets: HeldReviewTicket[],
): T[] {
  const byId = new Map(tickets.map((t) => [Number(t.id), t]));
  const out = review.map((row) => ({ ...row }));
  for (const hold of holds) {
    const keeper = byId.get(hold.keeperId);
    const extra = byId.get(hold.extraId);
    if (keeper?.duplicate_of || extra?.duplicate_of) continue;
    const row = byId.get(hold.perRowExtra);
    if (!row) continue;
    const entityType = row.kind === "tlc" ? "tlc" : "service";
    const cur = out.find((item) => item.entityType === entityType && Number(item.id) === Number(row.id));
    if (cur && (cur.reason === "open" || cur.reason === "wrap")) continue;
    if (cur) {
      if (cur.reason !== "merge") {
        cur.reason = "merge";
        cur.note = hold.reason;
      }
      continue;
    }
    out.push({
      id: Number(row.id),
      wo: row.wo ?? "",
      customer: row.customer,
      status: row.status,
      technician: row.technician,
      entityType,
      reason: "merge",
      note: hold.reason,
    } as T);
  }
  return out;
}

export async function reconcileServiceDuplicates(
  sql: SqlLike,
  actor: string,
  heldPairs?: { keeperId: number; extraId: number }[],
): Promise<{ merged: number; flagged: number; held: HeldMerge[] }> {
  const rows = await sql.query<ServiceDupRow>(
    `select ${DUP_COLS} from service_jobs
      where coalesce(wo, '') <> '' and duplicate_of is null
      order by id`,
  );
  const groups = new Map<string, ServiceDupRow[]>();
  for (const row of rows) {
    const key = woMatchKey(row.wo ?? "");
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  let merged = 0;
  let flagged = 0;
  const held: HeldMerge[] = [];
  const skip = new Set((heldPairs ?? []).map((p) => pairKey(p.keeperId, p.extraId)));
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const keeper = [...list].sort((a, b) => a.id - b.id)[0]!;
    for (const extra of list) {
      if (extra.id === keeper.id) continue;
      if (skip.has(pairKey(keeper.id, extra.id))) continue;
      const result = await tryMergeServiceDuplicate(sql, keeper.id, extra.id, actor);
      if (result === "merged") merged += 1;
      else if (result === "flagged") flagged += 1;
      else if (typeof result === "object" && result.result === "held" && held.length < 50) {
        held.push({ keeperId: keeper.id, extraId: extra.id, reason: result.reason });
      }
    }
  }
  return { merged, flagged, held };
}
