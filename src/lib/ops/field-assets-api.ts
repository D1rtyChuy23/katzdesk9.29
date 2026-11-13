import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, isWarehouseOnly } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { brandOf, type FieldAsset } from "@/lib/ops/field-assets";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

type Row = {
  id: number;
  customer: string;
  customer_id: number | null;
  archived: unknown;
  address: string | null;
  catalog_model: string;
  equipment_name: string;
  serial: string | null;
  part_number: string | null;
  ownership: string | null;
  install_date: string | null;
  condition: string | null;
};

/**
 * Every machine on a customer account, with the account it is on (11/12). Read only. Each machine takes at most one
 * account, by name whatever its capitals and outer spaces: a live one before a removed one, then the oldest, so a
 * machine is never listed twice even if two accounts' names differ only in capitals. A removed account's machines are
 * listed, flagged.
 */
export async function readFieldAssets(sql: Sql): Promise<FieldAsset[]> {
  const rows = await sql.query<Row>(
    `with acct as (
       select distinct on (lower(btrim(name))) lower(btrim(name)) as k, id, archived, address
         from directory_customers
        order by lower(btrim(name)), coalesce(archived, false), id
     )
     select a.id, a.customer, c.id as customer_id, c.archived, c.address, a.catalog_model, a.equipment_name, a.serial,
            a.part_number, a.ownership, a.install_date::text as install_date, a.condition
       from account_equipment a
       left join acct c on c.k = lower(btrim(a.customer))
      order by lower(a.customer), lower(a.catalog_model), a.id`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    customer: r.customer,
    customerId: r.customer_id == null ? null : Number(r.customer_id),
    accountRemoved: r.customer_id != null && flagOn(r.archived),
    address: r.address?.trim() || null,
    catalogModel: r.catalog_model,
    equipmentName: r.equipment_name,
    brand: brandOf(r.catalog_model),
    serial: r.serial,
    partNumber: r.part_number,
    ownership: r.ownership,
    installDate: r.install_date,
    condition: r.condition,
  }));
}

export const FIELD_ASSETS_KEY = ["field-assets"] as const;

/** Assets → In the Field: every machine at a customer, for any desk role but Warehouse, which has the Warehouse section. */
export const listFieldAssets = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<FieldAsset[]> => {
    const sql = await ready();
    if (await isWarehouseOnly(sql, context.userId)) throw new Error("Warehouse has the Assets → Warehouse section.");
    return readFieldAssets(sql);
  });
