/**
 * Ticket-to-machine links (Chuy, 11/21: several machines per ticket, optional). A service or TLC ticket names any of
 * its account's units, on its Equipment tab; each unit's window lists its Service History.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, isWarehouseOnly } from "@/lib/ops/access";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

/** elsewhere: the account the unit is on now, when that isn't the ticket's (it moved after the ticket named it). */
export type TicketUnit = { id: number; model: string; name: string; serial: string | null; elsewhere?: string | null };
export type TicketUnits = { linked: TicketUnit[]; options: TicketUnit[]; canEdit: boolean; customer: string; hidden: string | null };
export type ServiceVisit = {
  jobId: number;
  callId: string | null;
  kind: string;
  status: string | null;
  received: string | null;
  completed: string | null;
  workDone: string | null;
  issue: string | null;
  /** Merged into an install as billed: the visit stays in the machine's history, labelled. */
  mergedInstall: number | null;
};

const WALK_IN = /^walk[\s-]*in$/i;
const UNIT_COLS = "a.id, a.catalog_model as model, a.equipment_name as name, a.serial, a.customer";
type UnitRow = { id: number; model: string | null; name: string | null; serial: string | null; customer: string | null };
const toUnit = (r: UnitRow, ticketCustomer?: string): TicketUnit => ({
  id: Number(r.id),
  model: r.model ?? "",
  name: r.name ?? "",
  serial: r.serial ?? null,
  elsewhere: ticketCustomer != null && (r.customer ?? "").trim().toLowerCase() !== ticketCustomer.trim().toLowerCase() ? (r.customer ?? "").trim() : null,
});

async function ticketOf(sql: Sql, jobId: number) {
  const j = (
    await sql.query<{ id: number; customer: string | null; kind: string; merged_install_id: number | null; duplicate_of: number | null }>(
      "select id, customer, kind, merged_install_id, duplicate_of from service_jobs where id = $1",
      [jobId],
    )
  )[0];
  if (!j) throw new Error("Job not found");
  // Merged away: its machines are on the install or the ticket it went into.
  const hidden = j.merged_install_id ? `This ticket was merged into install #${j.merged_install_id}.` : j.duplicate_of && Number(j.duplicate_of) !== Number(j.id) ? "This ticket was merged into another ticket." : null;
  return { ...j, customer: (j.customer ?? "").trim(), hidden };
}

/** The units a ticket names, and the account's units it could name (on the account by name, any case). */
export async function ticketUnitsFor(sql: Sql, jobId: number, userId: string): Promise<TicketUnits> {
  const j = await ticketOf(sql, jobId);
  const linked = await sql.query<UnitRow>(
    `select ${UNIT_COLS} from ticket_units t join account_equipment a on a.id = t.account_equipment_id where t.job_id = $1 order by a.catalog_model, a.serial nulls last, a.id`,
    [jobId],
  );
  const options = j.customer && !WALK_IN.test(j.customer)
    ? await sql.query<UnitRow>(
        `select ${UNIT_COLS} from account_equipment a where lower(btrim(a.customer)) = lower(btrim($1)) order by a.catalog_model, a.serial nulls last, a.id`,
        [j.customer],
      )
    : [];
  return {
    linked: linked.map((u) => toUnit(u, j.customer)),
    options: options.map((u) => toUnit(u)),
    canEdit: !j.hidden && !(await isWarehouseOnly(sql, userId)) && (options.length > 0 || linked.length > 0),
    customer: j.customer,
    hidden: j.hidden,
  };
}

/** Set the units a ticket names (all of them at once). Each must be on the ticket's account. */
export async function setTicketUnitsFor(sql: Sql, data: { jobId: number; unitIds: number[] }, userId: string): Promise<TicketUnits> {
  if (await isWarehouseOnly(sql, userId)) throw new Error("Warehouse doesn't edit tickets.");
  const j = await ticketOf(sql, data.jobId);
  if (j.hidden) throw new Error(`${j.hidden} Name its machines there.`);
  if (!j.customer || WALK_IN.test(j.customer)) throw new Error("A Walk-In ticket has no account, so it has no machines to name.");
  const ids = [...new Set(data.unitIds.map(Number))];
  // Only a machine newly picked must be on the account: one it named before that moved away since can stay or go.
  const had = new Set((await sql.query<{ id: number }>("select account_equipment_id as id from ticket_units where job_id = $1", [data.jobId])).map((r) => Number(r.id)));
  const added = ids.filter((id) => !had.has(id));
  if (added.length) {
    const ok = await sql.query<{ id: number }>("select id from account_equipment where id = any($1::int[]) and lower(btrim(customer)) = lower(btrim($2))", [added, j.customer]);
    if (ok.length !== added.length) throw new Error(`A machine picked isn't on ${j.customer} (any more). Reopen the ticket and pick again.`);
  }
  const who = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username ?? null;
  await sql.query(
    `with gone as (delete from ticket_units where job_id = $1 and not (account_equipment_id = any($2::int[])))
     insert into ticket_units (job_id, account_equipment_id, linked_by)
     select $1, u, $3 from unnest($2::int[]) u
     on conflict do nothing`,
    [data.jobId, ids, who],
  );
  return ticketUnitsFor(sql, data.jobId, userId);
}

/** The tickets that name a unit, newest first. */
export async function unitServiceHistoryFor(sql: Sql, unitId: number, _userId: string): Promise<ServiceVisit[]> {
  const rows = await sql.query<{ id: number; call_id: string | null; kind: string; status: string | null; received: string | null; completed: string | null; work_done: string | null; issue: string | null; merged_install_id: number | null }>(
    `select j.id, j.call_id, j.kind, j.status, to_char(j.received, 'YYYY-MM-DD') as received, to_char(j.completed_at, 'YYYY-MM-DD') as completed, j.work_done, j.issue, j.merged_install_id
       from ticket_units t join service_jobs j on j.id = t.job_id
      where t.account_equipment_id = $1
      order by coalesce(j.completed_at, j.received) desc nulls last, j.id desc`,
    [unitId],
  );
  return rows.map((r) => ({ jobId: Number(r.id), callId: r.call_id, kind: r.kind, status: r.status, received: r.received, completed: r.completed, workDone: r.work_done, issue: r.issue, mergedInstall: r.merged_install_id == null ? null : Number(r.merged_install_id) }));
}

export const getTicketUnits = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number }) => z.object({ jobId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => ticketUnitsFor(await ready(), data.jobId, context.userId));

export const setTicketUnits = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { jobId: number; unitIds: number[] }) => z.object({ jobId: z.number().int().positive(), unitIds: z.array(z.number().int().positive()).max(100) }).parse(d))
  .handler(async ({ data, context }) => setTicketUnitsFor(await ready(), data, context.userId));

export const getUnitServiceHistory = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { unitId: number }) => z.object({ unitId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => unitServiceHistoryFor(await ready(), data.unitId, context.userId));
