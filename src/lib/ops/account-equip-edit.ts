/**
 * Add equipment and Edit on an account's Equipment tab (Chuy, 11/9). A machine goes on the account with its model,
 * serial, Part #, ownership and install date; Edit changes the Part #, ownership and install date. The model and
 * serial stay as they are here: they tie the unit to its installs, inspections and PM runbooks.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import {
  checkUnitFields,
  isWalkIn,
  parseSerial,
  serialInKatzStock,
  serialKey,
  serialOnAccount,
  serialOnThisAccount,
  UNIT_CHANGED,
} from "@/lib/ops/account-equip";
import { ensureCatalogModel, readAccountUnit, type AccountEquipRow } from "@/lib/ops/account-equip-import";
import { assertUnitUnlocked } from "@/lib/ops/equipment-lock";
import { SITE_LABEL } from "@/lib/ops/warehouse";

export type AddUnitInput = { model: string; serial?: string | null; partNumber?: string | null; ownership?: string | null; installDate?: string | null };
export type EditUnitInput = { seen: string; partNumber?: string | null; ownership?: string | null; installDate?: string | null };

/** An asset's serial the way serialKey() reads one: no spaces or #, any case. */
const ASSET_KEY = "lower(regexp_replace(btrim(coalesce(a.serial, '')), '[#[:space:]]', '', 'g'))";
/** Katz still has it: on the barn's racks, or placed at a Katz site (11/9). */
const IN_STOCK = "a.status in ('ready', 'deployed')";

async function accountName(sql: Sql, customer: string): Promise<string> {
  const typed = customer.trim();
  if (!typed) throw new Error("Pick an account first.");
  if (isWalkIn(typed)) throw new Error("A walk-in has no account to add equipment to.");
  const row = (
    await sql.query<{ name: string }>(
      "select name from directory_customers where lower(name) = lower($1) and archived = false order by name_locked desc, id limit 1",
      [typed],
    )
  )[0];
  if (!row) throw new Error(`${typed} isn't an account in the directory.`);
  return row.name;
}

/** Why this serial can't go on the account, or null when it can. */
async function serialRefusal(sql: Sql, account: string, serial: string, key: string): Promise<string | null> {
  const on = await sql.query<{ customer: string }>(
    "select customer from account_equipment where serial_key = $1 order by (lower(customer) = lower($2)) desc, id limit 1",
    [key, account],
  );
  if (on[0]) return on[0].customer.trim().toLowerCase() === account.toLowerCase() ? serialOnThisAccount(serial) : serialOnAccount(serial, on[0].customer);
  const stock = await sql.query<{ site: string }>(`select a.site from assets a where ${IN_STOCK} and ${ASSET_KEY} = $1 order by a.id limit 1`, [key]);
  if (stock[0]) return serialInKatzStock(serial, stock[0].site, SITE_LABEL[stock[0].site] ?? stock[0].site);
  return null;
}

/**
 * Put a machine on the account. Refused, with nothing written, when the serial is already on this account or
 * another, or in Katz stock. A model not on the equipment list is added to it, as the Equipment import does.
 */
export async function addEquipmentUnit(sql: Sql, customer: string, input: AddUnitInput): Promise<AccountEquipRow> {
  const checked = checkUnitFields(input);
  if ("error" in checked) throw new Error(checked.error);
  const typedModel = String(input.model ?? "").replace(/\s+/g, " ").trim();
  if (!typedModel) throw new Error("Pick or type the model.");
  const account = await accountName(sql, customer);
  const serial = parseSerial(input.serial);
  const key = serialKey(serial) || null;
  if (serial && key) {
    const why = await serialRefusal(sql, account, serial, key);
    if (why) throw new Error(why);
  }
  const model = (await ensureCatalogModel(sql, typedModel)).name;
  const { partNumber, ownership, installDate } = checked.fields;
  // The serial is checked again as the unit is written, so two people adding the same machine at once add it once.
  const rows = await sql.query<{ id: number }>(
    `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, install_date, ownership, part_number)
     select $1, $2, $2, $3, $4, $5::date, $6, $7
      where $4::text is null
         or (not exists (select 1 from account_equipment e where e.serial_key = $4)
             and not exists (select 1 from assets a where ${IN_STOCK} and ${ASSET_KEY} = $4))
     returning id`,
    [account, model, serial, key, installDate, ownership, partNumber],
  );
  if (!rows[0]) throw new Error((serial && key && (await serialRefusal(sql, account, serial, key))) || "That unit could not be added. Try again.");
  const row = await readAccountUnit(sql, rows[0].id);
  if (!row) throw new Error("That unit could not be added. Try again.");
  return row;
}

/** Change a unit's Part #, ownership and install date. A locked unit, or one changed since the window opened, is refused. */
export async function editEquipmentUnit(sql: Sql, id: number, input: EditUnitInput): Promise<AccountEquipRow> {
  const unit = await readAccountUnit(sql, id);
  if (!unit) throw new Error("That unit is not on the account.");
  // An ownership from before today's list keeps saving as it is.
  const checked = checkUnitFields(input, { keepOwnership: unit.ownership });
  if ("error" in checked) throw new Error(checked.error);
  await assertUnitUnlocked(sql, id);
  const { partNumber, ownership, installDate } = checked.fields;
  const rows = await sql.query<{ id: number }>(
    `update account_equipment set part_number = $2, ownership = $3, install_date = $4::date, updated_at = now()
      where id = $1 and locked_at is null and updated_at::text = $5
      returning id`,
    [id, partNumber, ownership, installDate, input.seen],
  );
  if (!rows[0]) {
    if (!(await readAccountUnit(sql, id))) throw new Error("That unit is not on the account.");
    await assertUnitUnlocked(sql, id);
    throw new Error(UNIT_CHANGED);
  }
  const row = await readAccountUnit(sql, id);
  if (!row) throw new Error("That unit is not on the account.");
  return row;
}

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

const fields = {
  partNumber: z.string().max(200).nullable().optional(),
  ownership: z.string().max(200).nullable().optional(),
  installDate: z.string().max(40).nullable().optional(),
};

export const addAccountEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string } & AddUnitInput) =>
    z.object({ customer: z.string().min(1).max(300), model: z.string().max(300), serial: z.string().max(200).nullable().optional(), ...fields }).parse(d),
  )
  .handler(async ({ data }) => {
    const { customer, ...input } = data;
    return addEquipmentUnit(await ready(), customer, input);
  });

export const editAccountEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number } & EditUnitInput) => z.object({ id: z.number().int().positive(), seen: z.string().max(100), ...fields }).parse(d))
  .handler(async ({ data }) => {
    const { id, ...input } = data;
    return editEquipmentUnit(await ready(), id, input);
  });
