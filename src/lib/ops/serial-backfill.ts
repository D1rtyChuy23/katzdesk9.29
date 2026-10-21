import type { Sql } from "@/lib/db";
import { parseMachinesJson, serializeMachines, specsFromInstall } from "./machines";
import { placeWarehouseSerial } from "./warehouse-serial";
import { catalogNames } from "./inspection-api";

/**
 * Installs that already have a warehouse unit assigned, but a blank serial on the matching machine row.
 * Fills only that blank serial. Does not add a row, and does not write volts, plug, or water.
 * Safe to run more than once.
 */
export async function backfillAssignedSerials(sql: Sql): Promise<number> {
  const assets = await sql.query<{
    install_id: number;
    model: string | null;
    serial: string | null;
    deal_id: number | null;
    equipment: string | null;
    install_serial: string | null;
    power_voltage: string | null;
    machines: string | null;
  }>(
    `select a.install_id, a.model, a.serial, i.deal_id,
            i.equipment, i.serial as install_serial, i.power_voltage, i.machines
       from assets a
       join installs i on i.id = a.install_id
      where a.status = 'assigned'
        and a.install_id is not null
        and nullif(btrim(coalesce(a.serial, '')), '') is not null`,
  );
  let n = 0;
  const catalog = assets.length ? await catalogNames(sql) : [];
  const deals = new Map<number, { model: string; serial: string }[]>();
  for (const a of assets) {
    const model = String(a.model ?? "").trim();
    const serial = String(a.serial ?? "").trim();
    if (!model || !serial) continue;
    const specs = specsFromInstall(a.equipment, a.install_serial, a.power_voltage, a.machines, catalog);
    const placed = placeWarehouseSerial(specs, { model, serial }, { addRow: false, catalog });
    if (placed.changed) {
      const packed = serializeMachines(placed.rows);
      await sql.query(
        `update installs set equipment = $2, machines = $3, serial = $4, power_voltage = $5, updated_at = now() where id = $1`,
        [a.install_id, packed.equipment, packed.machines, packed.serial, packed.powerVoltage],
      );
      n += 1;
    }
    if (a.deal_id) {
      const list = deals.get(a.deal_id) ?? [];
      list.push({ model, serial });
      deals.set(a.deal_id, list);
    }
  }
  for (const [dealId, units] of deals) {
    const row = (
      await sql.query<{ equipment: string | null; machines: string | null }>(
        "select equipment, machines from deals where id = $1",
        [dealId],
      )
    )[0];
    if (!row) continue;
    let specs = parseMachinesJson(row.machines);
    if (!specs.length && row.equipment) {
      specs = specsFromInstall(row.equipment, null, null, null, catalog);
    }
    let changed = false;
    for (const unit of units) {
      const placed = placeWarehouseSerial(specs, unit, { addRow: false, catalog });
      if (!placed.changed) continue;
      specs = placed.rows;
      changed = true;
    }
    if (!changed) continue;
    const packed = serializeMachines(specs);
    await sql.query(
      "update deals set equipment = $2, machines = $3, updated_at = now() where id = $1",
      [dealId, packed.equipment, packed.machines],
    );
  }
  return n;
}

let once: Promise<number> | null = null;

/** One pass per server process. Later calls wait for the same pass. */
export function backfillAssignedSerialsOnce(sql: Sql): Promise<number> {
  once ??= backfillAssignedSerials(sql).catch((err) => {
    once = null;
    console.error("[serial] assigned-serial backfill failed", err);
    return 0;
  });
  return once;
}
