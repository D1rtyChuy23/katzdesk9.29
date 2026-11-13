import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, isWarehouseOnly } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { readFieldAssets } from "@/lib/ops/field-assets-api";
import { buildEquipmentAnalytics, daysBetween, OVERDUE_DAYS, type EquipmentAnalytics, type PmUnitTie, type UnattachedPm, type Visit } from "@/lib/ops/equipment-analytics";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import type { FieldAsset } from "@/lib/ops/field-assets";
import { planMachines } from "@/lib/ops/pm-machines";
import type { AccountUnitRow } from "@/lib/ops/pm-runbook-units";
import { matchRunbookPiece, matchRunbookSerial } from "@/lib/ops/runbooks";

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

/**
 * The machines each completed PM covers, as the PM page plans them (11/13): each Equipment line matched to an account
 * machine by serial, the line's pin, or its model; plus the PMs logged on a machine. Also the completed PMs of the last
 * year that are attached to no machine, so the office can add them.
 */
export async function readPmMachineTies(
  sql: Sql,
  machines: readonly FieldAsset[],
  visits: readonly Visit[],
  today: string,
): Promise<{ ties: PmUnitTie[]; unattached: UnattachedPm[] }> {
  const logged = await readPmUnitTies(sql);
  const links = await sql.query<{ pm_job_id: number; piece_key: string; account_equipment_id: number }>(
    "select pm_job_id, piece_key, account_equipment_id from pm_runbook_unit_links",
  );
  const pins = new Map<number, Record<string, number>>();
  for (const l of links) {
    const bag = pins.get(Number(l.pm_job_id)) ?? {};
    bag[l.piece_key] = Number(l.account_equipment_id);
    pins.set(Number(l.pm_job_id), bag);
  }
  const rowsByAccount = new Map<string, AccountUnitRow[]>();
  for (const m of machines) {
    const k = normalizeCustomerKey(m.customer);
    if (!k) continue;
    const row: AccountUnitRow = { id: m.id, catalogModel: m.catalogModel, equipmentName: m.equipmentName, serial: m.serial, installDate: m.installDate };
    rowsByAccount.set(k, [...(rowsByAccount.get(k) ?? []), row]);
  }
  const ties: PmUnitTie[] = [...logged];
  const tiedPms = new Set(logged.map((t) => t.pmId));
  for (const v of visits) {
    if (v.kind !== "pm") continue;
    const rows = rowsByAccount.get(normalizeCustomerKey(v.customer)) ?? [];
    for (const p of planMachines(v.equipment, rows, matchRunbookPiece, pins.get(v.id), matchRunbookSerial)) {
      if (p.accountId == null) continue;
      ties.push({ pmId: v.id, unitId: p.accountId });
      tiedPms.add(v.id);
    }
  }
  const unattached: UnattachedPm[] = visits
    .filter((v) => v.kind === "pm" && !tiedPms.has(v.id))
    .filter((v) => {
      const age = daysBetween(v.date, today);
      return age >= 0 && age <= OVERDUE_DAYS;
    })
    .map((v) => ({ id: v.id, customer: v.customer, date: v.date, equipment: v.equipment }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id - b.id);
  return { ties, unattached };
}

/** The fleet's counts, service load, ownership and the machines not serviced in over a year, as of `today`. */
export async function readEquipmentAnalytics(sql: Sql, today = todayChicago()): Promise<EquipmentAnalytics> {
  const machines = await readFieldAssets(sql);
  const visits = await readVisits(sql);
  const { ties, unattached } = await readPmMachineTies(sql, machines, visits, today);
  return buildEquipmentAnalytics(machines, visits, ties, today, unattached);
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
