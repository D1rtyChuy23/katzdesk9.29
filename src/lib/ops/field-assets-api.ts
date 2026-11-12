import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
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
 * Every machine on a customer account, with the account it is on (11/12). Read only. An account name is unique
 * whatever its capitals, so each machine finds at most one account; a removed account's machines are listed, flagged.
 */
export async function readFieldAssets(sql: Sql): Promise<FieldAsset[]> {
  const rows = await sql.query<Row>(
    `select a.id, a.customer, c.id as customer_id, c.archived, c.address, a.catalog_model, a.equipment_name, a.serial,
            a.part_number, a.ownership, a.install_date::text as install_date, a.condition
       from account_equipment a
       left join directory_customers c on lower(c.name) = lower(a.customer)
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

/** Assets → In the Field: every machine at a customer, for any desk role. */
export const listFieldAssets = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<FieldAsset[]> => readFieldAssets(await ready()));
