/** PM runbook readiness report — read-only. Everyone with Desk access can read it. */
import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { RUNBOOKS } from "@/lib/ops/runbooks";
import {
  buildReadiness,
  readinessSummary,
  type ReadinessAccountUnit,
  type ReadinessRow,
} from "@/lib/ops/pm-runbook-readiness";
import { splitEquipment } from "@/lib/ops/equipment";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const matchPiece = (piece: string) => {
  for (const rb of RUNBOOKS) {
    const h = rb.matchPiece(piece);
    if (h) return { runbookId: rb.def.id, model: h.model };
  }
  return null;
};

export type RunbookReadiness = {
  rows: ReadinessRow[];
  summary: ReturnType<typeof readinessSummary>;
  /** Open PMs (not Completed or Cancelled) checked. */
  pmsChecked: number;
};

export const getRunbookReadiness = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<RunbookReadiness> => {
    const sql = await ready();
    const all = await sql.query<{ id: number; customer: string; equipment: string | null; status: string }>(
      "select id, customer, equipment, status from pm_jobs where status not in ('Completed', 'Cancelled') order by id",
    );
    const pms = all.filter((p) => splitEquipment(p.equipment).some((piece) => matchPiece(piece)));
    const names = [...new Set(pms.map((p) => p.customer.toLowerCase()))];
    const units = names.length
      ? await sql.query<{
          id: number;
          customer: string;
          catalog_model: string;
          equipment_name: string;
          serial: string | null;
          install_date: string | null;
        }>(
          `select id, customer, catalog_model, equipment_name, serial, install_date::text as install_date
             from account_equipment where lower(customer) = any($1::text[]) order by id`,
          [names],
        )
      : [];
    const mapped: ReadinessAccountUnit[] = units.map((u) => ({
      id: u.id,
      customer: u.customer,
      catalogModel: u.catalog_model,
      equipmentName: u.equipment_name,
      serial: u.serial,
      installDate: u.install_date,
    }));
    const rows = buildReadiness(pms, mapped, matchPiece);
    return { rows, summary: readinessSummary(rows), pmsChecked: pms.length };
  });
