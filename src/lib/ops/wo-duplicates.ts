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

async function retargetThread(sql: SqlLike, keeper: ServiceDupRow, extra: ServiceDupRow): Promise<void> {
  await sql.query(
    `update comments
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`,
    [keeper.kind, keeper.id, extra.id],
  );
  await sql.query(
    `update activity
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`,
    [keeper.kind, keeper.id, extra.id],
  );
  await sql.query(
    `update desk_notifications
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`,
    [keeper.kind, keeper.id, extra.id],
  ).catch(() => undefined);
  await sql.query(`update assets set job_id = $1 where job_id = $2`, [keeper.id, extra.id]).catch(
    () => undefined,
  );
}

/** Fold extra onto keeper. Notes are kept (appended if both have text). */
export async function mergeServiceJobs(
  sql: SqlLike,
  keeperId: number,
  extraId: number,
  actor: string,
): Promise<{ keeperId: number; extraId: number } | null> {
  if (keeperId === extraId) return null;
  const keeper = await ultimateKeeper(sql, keeperId);
  const extra = await loadJob(sql, extraId);
  if (!keeper || !extra) return null;
  if (extra.id === keeper.id) return { keeperId: keeper.id, extraId };
  if (extra.duplicate_of === keeper.id) return { keeperId: keeper.id, extraId: extra.id };

  const next = mergeJobFields(keeper, extra);
  await sql.query(
    `update service_jobs set
        customer = $2, contact = $3, phone = $4, equipment = $5, issue = $6,
        call_type = $7, technician = $8, wo = $9, notes = $10, work_done = $11,
        completed_at = $12, scheduled = $13, received = $14, urgency = $15,
        updated_at = now()
      where id = $1`,
    [
      keeper.id,
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
    ],
  );
  await retargetThread(sql, keeper, extra);
  await sql.query(
    `update service_jobs set duplicate_of = $2, updated_at = now() where id = $1`,
    [extra.id, keeper.id],
  );
  await sql.query(
    `update service_jobs set duplicate_of = $2, updated_at = now()
      where duplicate_of = $1`,
    [extra.id, keeper.id],
  );
  await sql.query(
    `insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ($1, $2, $3, 'merged', $4)`,
    [
      keeper.kind,
      keeper.id,
      actor,
      `Merged #${extra.id} (${extra.call_id}) into this ticket · ${next.wo || extra.wo || ""}`.trim(),
    ],
  );
  return { keeperId: keeper.id, extraId: extra.id };
}

export async function tryMergeServiceDuplicate(
  sql: SqlLike,
  keeperId: number,
  extraId: number,
  actor: string,
): Promise<"merged" | "flagged" | "skipped"> {
  if (keeperId === extraId) return "skipped";
  const keeper = await ultimateKeeper(sql, keeperId);
  const extra = await loadJob(sql, extraId);
  if (!keeper || !extra || extra.id === keeper.id) return "skipped";
  if (extra.duplicate_of) {
    return extra.duplicate_of === keeper.id ? "merged" : "skipped";
  }
  if (customersCompatible(keeper.customer, extra.customer)) {
    await mergeServiceJobs(sql, keeper.id, extra.id, actor);
    return "merged";
  }
  return "flagged";
}

export async function reconcileServiceDuplicates(
  sql: SqlLike,
  actor: string,
): Promise<{ merged: number; flagged: number }> {
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
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const keeper = [...list].sort((a, b) => a.id - b.id)[0]!;
    for (const extra of list) {
      if (extra.id === keeper.id) continue;
      const result = await tryMergeServiceDuplicate(sql, keeper.id, extra.id, actor);
      if (result === "merged") merged += 1;
      else if (result === "flagged") flagged += 1;
    }
  }
  return { merged, flagged };
}
