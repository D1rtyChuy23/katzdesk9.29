import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { CLOSED_REBUILD } from "@/lib/ops/rebuild-model";
import type { OpenRebuild, StockUnit, WarehouseAssets } from "@/lib/ops/warehouse-assets";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

type UnitRow = {
  id: number;
  kind: string;
  model: string;
  serial: string | null;
  qty: number | null;
  site: string;
  pallet: string | null;
  level: number | null;
  line_no: number | null;
  shop_test: string | null;
  stock_hold: string | null;
  stock_hold_customer: string | null;
  customer_owned: string | null;
};

const UNIT_COLS = `id, kind, model, serial, qty, site, pallet, level, line_no, shop_test, stock_hold, stock_hold_customer, customer_owned`;

const unit = (r: UnitRow): StockUnit => ({
  id: Number(r.id),
  kind: r.kind,
  model: r.model,
  serial: r.serial?.trim() || null,
  qty: Number(r.qty ?? 1) || 1,
  site: r.site,
  pallet: r.pallet,
  level: r.level == null ? null : Number(r.level),
  lineNo: r.line_no == null ? null : Number(r.line_no),
  shopTest: r.shop_test,
  stockHold: r.stock_hold,
  stockHoldCustomer: r.stock_hold_customer,
  customerOwned: r.customer_owned,
});

/**
 * The barn's stock for Assets → Warehouse (11/12), read only.
 * - available: ready on a barn rack and on no install, the same rule as the install and service pickers. A unit with a
 *   remove or assign request waiting is listed with it, as spoken for.
 * - staging: what a completed refurb put in staging, waiting for its shop test and a rack.
 * - rebuilds: refurbs not completed, cancelled or archived, with their machines.
 */
export async function readWarehouseAssets(sql: Sql): Promise<WarehouseAssets> {
  const [available, staging, rebuilds, machines] = await Promise.all([
    sql.query<UnitRow>(
      `select ${UNIT_COLS} from assets
        where status = 'ready' and site in ('barn-back', 'barn-front') and install_id is null
        order by lower(model), site, pallet, level desc, line_no, id`,
    ),
    sql.query<UnitRow>(`select ${UNIT_COLS} from assets where site = 'staging' order by lower(model), id`),
    sql.query<{ id: number; title: string; account: string; status: string; target_complete: string | null }>(
      `select id, title, account, status, target_complete::text as target_complete
         from rebuilds
        where coalesce(archived, false) = false and not (status = any($1::text[]))
        order by target_complete nulls last, id`,
      [[...CLOSED_REBUILD]],
    ),
    sql.query<{ rebuild_id: number; model: string; serial: string | null }>(
      `select m.rebuild_id, m.model, m.serial
         from rebuild_machines m join rebuilds r on r.id = m.rebuild_id
        where coalesce(r.archived, false) = false and not (r.status = any($1::text[]))
        order by m.rebuild_id, m.id`,
      [[...CLOSED_REBUILD]],
    ),
  ]);
  const byRebuild = new Map<number, { model: string; serial: string | null }[]>();
  for (const m of machines) {
    const id = Number(m.rebuild_id);
    byRebuild.set(id, [...(byRebuild.get(id) ?? []), { model: m.model, serial: m.serial?.trim() || null }]);
  }
  return {
    available: available.map(unit),
    staging: staging.map(unit),
    rebuilds: rebuilds.map(
      (r): OpenRebuild => ({
        id: Number(r.id),
        title: r.title,
        account: r.account,
        status: r.status,
        targetComplete: r.target_complete,
        machines: byRebuild.get(Number(r.id)) ?? [],
      }),
    ),
  };
}

export const WAREHOUSE_ASSETS_KEY = ["warehouse-assets"] as const;

/** Assets → Warehouse: any desk role, the Warehouse role included. */
export const listWarehouseAssets = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<WarehouseAssets> => readWarehouseAssets(await ready()));
