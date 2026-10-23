import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { findRecipeFor } from "@/lib/ops/equipment";
import { catalogNames, readInspection, type InspectionView } from "@/lib/ops/inspection-api";
import { loadInstallWos } from "@/lib/ops/install-work-orders";
import { installMachines } from "@/lib/ops/machines";
import { unitType } from "@/lib/ops/pre-inspection";
import { serialKey } from "@/lib/ops/account-equip";
import {
  accountIsNew,
  corrigoNotes,
  foldVisitUnits,
  formClean,
  formDate,
  groupFormRows,
  installTypeOf,
  preInstallNotes,
  recipeNote,
  taskNotes,
  type CheckNote,
  type FormRow,
  type FormUnit,
  type InstallType,
  type VisitMachine,
} from "@/lib/ops/install-form";
import { outletForModel, withSpecOutlet } from "@/lib/ops/spec-read";
import { loadSpecOutlets } from "@/lib/ops/spec-read-api";
import type { Recipe } from "@/lib/ops/types";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

export type InstallFormPayload = {
  id: number;
  customer: string;
  /** The site contact on the pre-inspection. */
  siteContact: string;
  /** The site contact's phone. Blank until the install window collects it. */
  contactPhone: string;
  /** "Tue, Oct 20, 2026", or blank. */
  installDate: string;
  accountRep: string;
  address: string;
  /** The type picked on the Details tab; until one is picked, what the account's history suggests. */
  accountType: InstallType;
  technician: string;
  /** Every Corrigo WO on the install, the primary first. */
  workOrders: string[];
  inspector: string;
  /** "Oct 7, 2026", or blank. */
  inspectedOn: string;
  /** The day the install was completed, "Oct 22, 2026", or blank. */
  completedOn: string;
  rows: FormRow[];
  pre: CheckNote[];
  tasks: CheckNote[];
  corrigo: CheckNote[];
};

/**
 * The units on the form: the install's machines, split the way pre-inspection splits them so each unit there matches
 * the name it was made from, and any pre-inspection or barn unit not already on that list.
 */
export async function formMachines(
  sql: Sql,
  install: { id: number; equipment: string | null; serial: string | null; power_voltage: string | null; machines: string | null },
  inspection: InspectionView | null,
) {
  const assets = await sql.query<{ model: string | null; serial: string | null }>(
    "select model, serial from assets where install_id = $1",
    [install.id],
  );
  const base: VisitMachine[] = installMachines(install, await catalogNames(sql)).machines;
  const extras = [
    ...(inspection?.machines ?? []).map((m) => ({ model: m.name || m.model, serial: m.serial, electrical: m.electrical })),
    ...assets.map((a) => ({ model: a.model ?? "", serial: a.serial, electrical: null })),
  ];
  return foldVisitUnits(base, extras);
}

type RecipeRow = {
  id: number;
  name: string | null;
  equipment_model: string;
  customer: string | null;
  install_id: number | null;
  copied_from: number | null;
  is_template: boolean;
  coffee_1: string | null;
  coffee_2: string | null;
  coffee_3: string | null;
  powder_1: string | null;
  powder_2: string | null;
  powder_3: string | null;
  americano_1: string | null;
  americano_2: string | null;
  americano_3: string | null;
  tea_1: string | null;
  tea_2: string | null;
  milk: string | null;
  notes: string | null;
  updated_at: string;
};

const toRecipe = (r: RecipeRow): Recipe => ({
  id: r.id,
  name: r.name,
  equipmentModel: r.equipment_model,
  customer: r.customer,
  installId: r.install_id,
  copiedFrom: r.copied_from,
  isTemplate: r.is_template,
  coffee1: r.coffee_1,
  coffee2: r.coffee_2,
  coffee3: r.coffee_3,
  powder1: r.powder_1,
  powder2: r.powder_2,
  powder3: r.powder_3,
  americano1: r.americano_1,
  americano2: r.americano_2,
  americano3: r.americano_3,
  tea1: r.tea_1,
  tea2: r.tea_2,
  milk: r.milk,
  notes: r.notes,
  updatedAt: r.updated_at,
});

/**
 * What the account's history suggests while nobody has picked New account or Update: a new account when the customer
 * has no other install and no equipment besides this visit's own units.
 */
export async function accountTypeGuess(sql: Sql, installId: number): Promise<InstallType> {
  const row = (
    await sql.query<{ installs: number; equipment: number }>(
      `select (select count(*)::int from installs o
                where o.archived = false and o.id <> i.id and lower(o.customer) = lower(i.customer)) as installs,
              (select count(*)::int from account_equipment a
                where lower(a.customer) = lower(i.customer)
                  and a.id not in (select u.equipment_id from install_inspection_units u where u.install_id = i.id)) as equipment
         from installs i where i.id = $1`,
      [installId],
    )
  )[0];
  return accountIsNew(Number(row?.installs ?? 0), Number(row?.equipment ?? 0)) ? "new" : "update";
}

/** Everything the printed Equipment Request Form shows for one install. */
export async function installFormFor(sql: Sql, installId: number): Promise<InstallFormPayload> {
  const install = (
    await sql.query<{
      id: number;
      customer: string;
      install_date: string | null;
      completed_at: string | null;
      account_rep: string | null;
      technician: string | null;
      machines: string | null;
      equipment: string | null;
      serial: string | null;
      power_voltage: string | null;
      install_type: string | null;
    }>(
      `select id, customer, install_date::text as install_date, completed_at::text as completed_at, account_rep, technician,
              machines, equipment, serial, power_voltage, install_type
         from installs where id = $1 and archived = false`,
      [installId],
    )
  )[0];
  if (!install) throw new Error("Install not found");
  const customer = install.customer;
  const addressRow = (
    await sql.query<{ address: string | null }>(
      "select address from directory_customers where lower(name) = lower($1) and archived = false order by name_locked desc, id limit 1",
      [customer],
    )
  )[0];
  const inspection = await readInspection(sql, install.id);
  // Read after the pre-inspection, which lists this visit's own units: those never make the account an update.
  const accountType = installTypeOf(install.install_type) ?? (await accountTypeGuess(sql, install.id));

  const folded = await formMachines(sql, install, inspection);
  const picked = folded.rows.map((r) => r.recipeId).filter((id): id is number => !!id);
  const recipes = (
    await sql.query<RecipeRow>(
      `select id, name, equipment_model, customer, install_id, copied_from, is_template, coffee_1, coffee_2, coffee_3,
              powder_1, powder_2, powder_3, americano_1, americano_2, americano_3, tea_1, tea_2, milk, notes,
              updated_at::text as updated_at
         from recipes
        where lower(customer) = lower($1) or coalesce(customer, '') = '' or id = any($2::int[])`,
      [customer, picked.length ? picked : [0]],
    )
  ).map(toRecipe);
  // The recipe the equipment row shows: the one picked there, else this account's, else the house recipe.
  const recipeFor = (row: VisitMachine): Recipe | null => {
    if (row.recipeId) return recipes.find((r) => r.id === row.recipeId) ?? null;
    const fallback = findRecipeFor(recipes, { customer, model: row.equipment, installId: install.id });
    return fallback.linked ?? fallback.house;
  };
  const outlets = await loadSpecOutlets(sql).catch(() => []);
  const units: FormUnit[] = folded.rows.map((row) => {
    const machine = inspection?.machines.find(
      (m) => (m.serial && serialKey(m.serial) === serialKey(row.serial)) || (!row.serial && (m.model === row.equipment || m.name === row.equipment)),
    );
    return withSpecOutlet(
      {
        model: row.equipment,
        serial: row.serial,
        notes: formClean(machine?.note),
        voltage: row.powerVoltage,
        plug: row.plug ?? "",
        ownership: row.ownership,
        recipe: recipeNote(recipeFor(row)),
      },
      outletForModel(row.equipment, outlets),
    );
  });
  const rows = groupFormRows(units);
  const items = (inspection?.machines ?? []).flatMap((m) => m.items);
  const of = (key: string) => items.filter((i) => i.category === key).map((i) => i.status);
  const photoCount = (inspection?.machines ?? []).reduce((n, m) => n + (m.photoCount || 0), 0);
  const coffee = units.filter((u) => unitType(u.model) !== "other");
  const recipesReady = coffee.length ? coffee.every((u) => !!(u.notes || u.recipe)) : null;
  const owned = folded.rows.filter((r) => r.ownership === "Sold" || r.ownership === "Loaned" || r.ownership === "Leased");
  const docs: "yes" | "pending" | "blank" = !folded.rows.length ? "blank" : owned.length === folded.rows.length ? "yes" : owned.length ? "pending" : "blank";
  const date = (install.install_date ?? "").slice(0, 10);
  const workOrders = ((await loadInstallWos(sql, [install.id])).get(install.id) ?? []).map((w) => w.wo.trim()).filter(Boolean);
  return {
    id: install.id,
    customer: formClean(customer),
    siteContact: formClean(inspection?.siteContact),
    contactPhone: "",
    installDate: formDate(date, { weekday: true }),
    accountRep: formClean(install.account_rep),
    address: formClean(addressRow?.address),
    accountType,
    technician: formClean(install.technician),
    workOrders,
    inspector: formClean(inspection?.inspector),
    inspectedOn: formDate(inspection?.inspectedOn),
    completedOn: formDate(install.completed_at),
    rows,
    pre: preInstallNotes({
      inspector: inspection?.inspector ?? "",
      water: of("water"),
      power: of("power"),
      space: of("space"),
      photoCount,
      recipesReady,
      docs,
    }),
    tasks: taskNotes(photoCount),
    corrigo: corrigoNotes({ serialsLogged: units.length > 0 && units.every((u) => !!u.serial.trim()), installDate: date }),
  };
}

/** For the Details tab's Install type: what the form shows until someone picks one. */
export const getInstallTypeGuess = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { installId: number }) => z.object({ installId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<{ guess: InstallType }> => ({ guess: await accountTypeGuess(await ready(), data.installId) }));

export const getInstallForm = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { installId: number }) => z.object({ installId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<InstallFormPayload> => installFormFor(await ready(), data.installId));
