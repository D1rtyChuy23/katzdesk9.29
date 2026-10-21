import type { Sql } from "@/lib/db";
import { matchExistingUnit, serialKey } from "@/lib/ops/account-equip";

/**
 * The unit already on this account that a machine with this serial is: the same serial whatever model it was saved
 * under, else a unit of that model with no serial yet. The same rule the account import uses (matchExistingUnit), so
 * putting a unit on an account fills the blank row instead of adding a second one. Null when it is a new unit.
 */
export async function accountUnitWithSerial(
  sql: Sql,
  customer: string,
  model: string,
  serial: string | null,
): Promise<{ id: number; serial: string | null } | null> {
  if (!serialKey(serial)) return null;
  const rows = await sql.query<{ id: number; customer: string; catalog_model: string; equipment_name: string; serial: string | null; serial_key: string | null }>(
    "select id, customer, catalog_model, equipment_name, serial, serial_key from account_equipment where lower(customer) = lower($1) order by id",
    [customer],
  );
  const unit = matchExistingUnit({
    customer,
    catalogModel: model,
    equipmentName: model,
    serial,
    existing: rows.map((r) => ({
      id: r.id,
      customer: r.customer,
      catalogModel: r.catalog_model,
      equipmentName: r.equipment_name,
      serial: r.serial,
      serialKey: r.serial_key,
    })),
  });
  const hit = unit.action === "update" ? rows.find((r) => r.id === unit.existingId) : undefined;
  return hit ? { id: hit.id, serial: hit.serial } : null;
}
