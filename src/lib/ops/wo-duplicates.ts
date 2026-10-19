import { customersCompatible, isWalkIn, woCanonical, woMatchKey } from "./corrigo";

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

/**
 * Why these two tickets must not be folded together, or null when the money can move.
 * Checked again inside mergeTicketsSql so a Sales Order saved in between still stops the write.
 */
export function mergeMoneyRefusal(keeper: MergeMoney, extra: MergeMoney): string | null {
  const extraSo = salesOrder(extra.nsSo);
  if (extraSo) return `Ticket #${extra.id} is billed on ${extraSo}. Merge the other ticket into it instead.`;
  const keeperSo = salesOrder(keeper.nsSo);
  if (keeperSo && extra.lines > 0) {
    return `Ticket #${keeper.id} is billed on ${keeperSo}. Clear its Sales Order before merging charges into it.`;
  }
  if (keeper.hasQuote && extra.hasQuote) return "Both tickets have a repair quote. Combine them by hand first.";
  const extraDiscount = moneyDiscount(extra);
  const keeperDiscount = moneyDiscount(keeper);
  const discountDiffers =
    !!extraDiscount &&
    (!keeperDiscount || extraDiscount.kind !== keeperDiscount.kind || extraDiscount.value !== keeperDiscount.value);
  if (extra.lines > 0 && extraDiscount && discountDiffers && (keeper.lines > 0 || !!keeperDiscount)) {
    return `Ticket #${extra.id} has a ${discountPhrase(extraDiscount.kind, extraDiscount.value)} discount that ticket #${keeper.id} doesn't. Make the discounts match first.`;
  }
  if (keeper.lines + extra.lines > 200) return "Together these tickets would have more than 200 charge lines.";
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
  };
}

/** ns_so, po, discount, charge count, and whether a repair quote exists — both tickets, one select. */
async function loadMergeMoney(
  sql: SqlLike,
  keeperId: number,
  extraId: number,
): Promise<{ keeper: MergeMoney; extra: MergeMoney } | null> {
  const rows = await sql.query<MoneyRow>(
    `select j.id, j.ns_so, j.po, j.discount_kind, j.discount_value,
            (select count(*)::int from ticket_charges c where c.job_id = j.id) as lines,
            exists (select 1 from repair_quotes q where q.job_id = j.id) as has_quote
       from service_jobs j
      where j.id = any($1::int[])`,
    [[keeperId, extraId]],
  );
  const keeper = rows.find((row) => Number(row.id) === keeperId);
  const extra = rows.find((row) => Number(row.id) === extraId);
  if (!keeper || !extra) return null;
  return { keeper: toMoney(keeper), extra: toMoney(extra) };
}

const CHANGED_WHILE_MERGING = "Those tickets changed while merging. Try again.";

/**
 * One statement: move the extra ticket onto the keeper, or write nothing.
 * $1 keeper id, $2 extra id, $3 actor, $4 customer, $5 contact, $6 phone, $7 equipment,
 * $8 issue, $9 call type, $10 technician, $11 wo, $12 notes, $13 work done,
 * $14 completed, $15 scheduled, $16 received, $17 urgency.
 * The field values are mergeJobFields. P.O. and discount are taken from the rows inside the statement.
 * Zero rows means a refusal became true after the check (nothing was written).
 */
export function mergeTicketsSql(): string {
  return `with pair as (
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
      (select count(*)::int from ticket_charges c where c.job_id = k.id) as keeper_lines,
      (select count(*)::int from ticket_charges c where c.job_id = e.id) as extra_lines,
      exists (select 1 from repair_quotes q where q.job_id = k.id) as keeper_quote,
      exists (select 1 from repair_quotes q where q.job_id = e.id) as extra_quote
    from service_jobs k
    join service_jobs e on e.id = $2::int
    where k.id = $1::int
      and k.id <> e.id
  ), g as (
    select * from pair
     where nullif(btrim(extra_so), '') is null
       and not (nullif(btrim(keeper_so), '') is not null and extra_lines > 0)
       and not (keeper_quote and extra_quote)
       and not (
         extra_lines > 0
         and coalesce(extra_dk, '') in ('percent', 'amount')
         and coalesce(extra_dv, 0) > 0
         and (keeper_lines > 0 or coalesce(keeper_dk, '') in ('percent', 'amount'))
         and (
           coalesce(keeper_dk, '') is distinct from extra_dk
           or keeper_dv is distinct from extra_dv
         )
       )
       and keeper_lines + extra_lines <= 200
  ), chg as (
    update ticket_charges c
       set job_id = s.keeper_id,
           sort = s.new_sort
      from (
        select c2.id,
               g.keeper_id,
               coalesce((select max(t.sort) from ticket_charges t where t.job_id = g.keeper_id), 0)
                 + row_number() over (order by c2.sort, c2.id) as new_sort
          from ticket_charges c2
          join g on c2.job_id = g.extra_id
      ) s
     where c.id = s.id
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
           po = coalesce(nullif(btrim(k.po), ''), x.po),
           discount_kind = case when g.keeper_lines = 0 and g.keeper_dk is null then x.discount_kind else k.discount_kind end,
           discount_value = case when g.keeper_lines = 0 and g.keeper_dk is null then x.discount_value else k.discount_value end,
           updated_at = now()
      from g
      join service_jobs x on x.id = g.extra_id
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
           'Merged #' || g.extra_id::text || ' (' || coalesce(g.extra_call, '') || ') into this ticket · '
             || coalesce(nullif(btrim($11::text), ''), nullif(btrim(g.extra_wo), ''), '')
             || ' · moved ' || (select count(*)::text from chg) || ' charge lines'
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
         (select count(*)::int from job) as jobs,
         (select count(*)::int from com) as comments,
         (select count(*)::int from act_move) as activity_moved,
         (select count(*)::int from pings) as notifications,
         (select count(*)::int from ast) as assets,
         (select count(*)::int from dup) as duplicates,
         (select count(*)::int from merged) as noted
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

  const money = await loadMergeMoney(sql, keeper.id, extra.id);
  if (!money) return null;
  const reason = mergeMoneyRefusal(money.keeper, money.extra);
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
  ]);
  if (!rows[0]) {
    const again = await loadMergeMoney(sql, keeper.id, extra.id);
    const raced = again ? mergeMoneyRefusal(again.keeper, again.extra) : null;
    return { refused: raced ?? CHANGED_WHILE_MERGING };
  }
  return { keeperId: keeper.id, extraId: extra.id };
}

export type DuplicateMergeResult = "merged" | "flagged" | "skipped" | { result: "held"; reason: string };

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
    if (result && "refused" in result) return { result: "held", reason: result.refused };
    if (!result) return "skipped";
    return "merged";
  }
  return "flagged";
}

export type HeldMerge = { keeperId: number; extraId: number; reason: string };

export async function reconcileServiceDuplicates(
  sql: SqlLike,
  actor: string,
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
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const keeper = [...list].sort((a, b) => a.id - b.id)[0]!;
    for (const extra of list) {
      if (extra.id === keeper.id) continue;
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
