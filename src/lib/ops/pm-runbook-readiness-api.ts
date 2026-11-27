/** PM runbook readiness report — read-only. Everyone with Desk access can read it. */
import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { matchRunbookPiece, matchRunbookSerial } from "@/lib/ops/runbooks";
import {
  buildReadiness,
  readinessSummary,
  type ReadinessAccountUnit,
  type ReadinessPm,
  type ReadinessRow,
} from "@/lib/ops/pm-runbook-readiness";
import { readsById } from "@/lib/ops/read-by-id";
import { splitEquipment } from "@/lib/ops/equipment";
import { notWalkInSql } from "@/lib/ops/walk-in-account";
import { openPmSql } from "@/lib/ops/ticket-status";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const matchPiece = matchRunbookPiece;

export type RunbookReadiness = {
  rows: ReadinessRow[];
  summary: ReturnType<typeof readinessSummary>;
  /** Open PMs (openPmSql) checked: the ones with a machine a runbook covers. */
  pmsChecked: number;
  /** Open Walk-In PMs, which Readiness leaves out (11/27: said beside the count). */
  walkInLeftOut: number;
};

export const getRunbookReadiness = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<RunbookReadiness> => {
    const sql = await ready();
    // By each PM's account id once PMs reads by id (phase C5, Link Check), as its runbook plans its units.
    const byId = await readsById(sql, "pms");
    // Open by the one rule every open-PM count uses (openPmSql); Walk-In is left out, and the page says how many.
    const all = await sql.query<{ id: number; customer: string; customer_id: number | null; equipment: string | null; status: string }>(
      `select p.id, p.customer, p.customer_id, p.equipment, p.status from pm_jobs p where ${openPmSql("p")} and ${notWalkInSql("p.customer")} order by p.id`,
    );
    const walkIn = await sql.query<{ n: number }>(`select count(*)::int as n from pm_jobs p where ${openPmSql("p")} and not (${notWalkInSql("p.customer")})`);
    const pms: ReadinessPm[] = all
      .filter((p) => splitEquipment(p.equipment).some((piece) => matchPiece(piece)))
      .map((p) => ({
        id: p.id,
        customer: p.customer,
        equipment: p.equipment,
        status: p.status,
        ...(byId && p.customer_id != null ? { customerId: Number(p.customer_id) } : {}),
      }));
    const names = [...new Set(pms.map((p) => p.customer.toLowerCase()))];
    const accountIds = [...new Set(pms.flatMap((p) => (p.customerId != null ? [p.customerId] : [])))];
    const units = names.length
      ? await sql.query<{
          id: number;
          customer: string;
          customer_id: number | null;
          listed: boolean;
          catalog_model: string;
          equipment_name: string;
          serial: string | null;
          install_date: string | null;
        }>(
          `select a.id, a.customer, a.customer_id,
                  exists (select 1 from directory_customers d where d.id = a.customer_id and d.archived = false) as listed,
                  a.catalog_model, a.equipment_name, a.serial, a.install_date::text as install_date
             from account_equipment a where lower(a.customer) = any($1::text[]) or a.customer_id = any($2::int[]) order by a.id`,
          [names, accountIds],
        )
      : [];
    const mapped: ReadinessAccountUnit[] = units.map((u) => ({
      id: u.id,
      customer: u.customer,
      customerId: u.customer_id == null ? null : Number(u.customer_id),
      listed: u.listed === true || String(u.listed) === "true",
      catalogModel: u.catalog_model,
      equipmentName: u.equipment_name,
      serial: u.serial,
      installDate: u.install_date,
    }));
    const ids = pms.map((p) => p.id);
    const links = ids.length
      ? await sql.query<{ pm_job_id: number; piece_key: string; account_equipment_id: number }>(
          "select pm_job_id, piece_key, account_equipment_id from pm_runbook_unit_links where pm_job_id = any($1::int[])",
          [ids],
        )
      : [];
    const pinsByPm: Record<number, Record<string, number>> = {};
    for (const link of links) {
      const bag = pinsByPm[link.pm_job_id] ?? (pinsByPm[link.pm_job_id] = {});
      bag[link.piece_key] = Number(link.account_equipment_id);
    }
    const rows = buildReadiness(pms, mapped, matchPiece, pinsByPm, matchRunbookSerial);
    return { rows, summary: readinessSummary(rows), pmsChecked: pms.length, walkInLeftOut: Number(walkIn[0]?.n ?? 0) };
  });
