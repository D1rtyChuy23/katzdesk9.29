import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, isWarehouseOnly } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { readFieldAssets } from "@/lib/ops/field-assets-api";
import { buildEquipmentAnalytics, type EquipmentAnalytics, type PmUnitTie, type Visit } from "@/lib/ops/equipment-analytics";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

type VisitRow = { kind: string; id: number; customer: string | null; day: string | null; equipment: string | null; serial_text: string | null; stacked: boolean | null };

/**
 * Completed visits: PMs, and service and TLC tickets, each with the day it was done. With no completion day (marking a
 * ticket Completed doesn't stamp one) it is the day it was scheduled (or received), but never after the day it was last
 * saved, so a PM closed early isn't dated in the future. Cancelled ones, tickets resolved by phone and duplicates are
 * left out.
 */
export async function readVisits(sql: Sql): Promise<Visit[]> {
  const rows = await sql.query<VisitRow>(
    `select s.kind, s.id, s.customer, coalesce(s.completed_at, least(coalesce(s.scheduled, s.received), s.updated_at::date))::text as day,
            s.equipment, concat_ws(' ', s.equipment, s.work_done, s.serial_notice) as serial_text, false as stacked
       from service_jobs s
      where s.duplicate_of is null
        and (s.completed_at is not null or s.status = 'Completed')
        and s.status not in ('Cancelled', 'Phone Resolved')
     union all
     select 'pm', p.id, p.customer, coalesce(p.completed_at, least(coalesce(p.projected, p.received), p.updated_at::date))::text,
            p.equipment, p.equipment, p.stacked_job_id is not null
       from pm_jobs p
      where (p.completed_at is not null or p.status = 'Completed') and p.status <> 'Cancelled'`,
  );
  return rows
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(String(r.day ?? "").slice(0, 10)))
    .map((r) => ({
      kind: r.kind === "pm" ? "pm" : r.kind === "tlc" ? "tlc" : "service",
      id: Number(r.id),
      customer: r.customer ?? "",
      date: String(r.day).slice(0, 10),
      equipment: r.equipment ?? "",
      serialText: r.serial_text ?? "",
      stacked: r.stacked === true,
    }));
}

/** The PMs logged on a machine: its runbook unit (by serial or account unit), a unit link, or a part logged on it. */
export async function readPmUnitTies(sql: Sql): Promise<PmUnitTie[]> {
  const rows = await sql.query<{ pm_id: number; unit_id: number }>(
    `select r.pm_job_id as pm_id, a.id as unit_id
       from pm_runbook_units r join account_equipment a on a.serial_key = r.serial_key
      where coalesce(r.serial_key, '') <> ''
     union
     select r.pm_job_id, a.id
       from pm_runbook_units r join account_equipment a on r.unit_key = 'acct:' || a.id::text
     union
     select pm_job_id, account_equipment_id from pm_runbook_unit_links
     union
     select pm_job_id, account_equipment_id from machine_parts where account_equipment_id is not null and removed_at is null`,
  );
  return rows.map((r) => ({ pmId: Number(r.pm_id), unitId: Number(r.unit_id) }));
}

/** The fleet's counts, service load, ownership and the machines not serviced in over a year, as of `today`. */
export async function readEquipmentAnalytics(sql: Sql, today = todayChicago()): Promise<EquipmentAnalytics> {
  const machines = await readFieldAssets(sql);
  const visits = await readVisits(sql);
  const ties = await readPmUnitTies(sql);
  return buildEquipmentAnalytics(machines, visits, ties, today);
}

export const EQUIPMENT_ANALYTICS_KEY = ["equipment-analytics"] as const;

/** Assets → Analytics, for any desk role but Warehouse. */
export const getEquipmentAnalytics = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<EquipmentAnalytics> => {
    const sql = await ready();
    if (await isWarehouseOnly(sql, context.userId)) throw new Error("Warehouse has the Assets → Warehouse section.");
    return readEquipmentAnalytics(sql);
  });
