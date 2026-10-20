import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { catalogNames, installMachines, readInspection, type InspectionView } from "@/lib/ops/inspection-api";
import { unitType } from "@/lib/ops/pre-inspection";
import { serialKey } from "@/lib/ops/account-equip";
import {
  accountIsNew,
  corrigoNotes,
  foldVisitUnits,
  groupFormRows,
  preInstallNotes,
  taskNotes,
  type FormUnit,
  type VisitMachine,
} from "@/lib/ops/install-form";
import { outletForModel, withSpecOutlet } from "@/lib/ops/spec-read";
import { loadSpecOutlets } from "@/lib/ops/spec-read-api";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

export type InstallFormPayload = {
  id: number;
  customer: string;
  phone: string;
  installDate: string;
  accountRep: string;
  address: string;
  accountType: "new" | "update";
  technician: string;
  wo: string;
  inspector: string;
  inspectedOn: string;
  rows: { equipment: string; notes: string; qty: number; outlet: string }[];
  pre: { label: string; notes: string }[];
  tasks: { label: string; notes: string }[];
  corrigo: { label: string; notes: string }[];
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

export const getInstallForm = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { installId: number }) => z.object({ installId: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<InstallFormPayload> => {
    const sql = await ready();
    const install = (
      await sql.query<{
        id: number;
        customer: string;
        install_date: string | null;
        account_rep: string | null;
        technician: string | null;
        wo: string | null;
        machines: string | null;
        equipment: string | null;
        serial: string | null;
        power_voltage: string | null;
      }>("select id, customer, install_date::text as install_date, account_rep, technician, wo, machines, equipment, serial, power_voltage from installs where id = $1 and archived = false", [
        data.installId,
      ])
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
    const priorInstalls = (
      await sql.query<{ n: number }>(
        "select count(*)::int as n from installs where archived = false and id <> $1 and lower(customer) = lower($2)",
        [install.id, customer],
      )
    )[0]?.n ?? 0;
    const linked = new Set((inspection?.machines ?? []).map((m) => m.equipmentId));
    const priorEquipment = (
      await sql.query<{ n: number }>(
        `select count(*)::int as n from account_equipment
          where lower(customer) = lower($1)
            and id <> all($2::int[])`,
        [customer, linked.size ? [...linked] : [0]],
      )
    )[0]?.n ?? 0;

    const folded = await formMachines(sql, install, inspection);
    const recipes = await sql.query<{ id: number; name: string | null; equipment_model: string | null }>(
      "select id, name, equipment_model from recipes where lower(customer) = lower($1) or coalesce(customer, '') = ''",
      [customer],
    );
    const recipeName = (id: number | null | undefined, model: string) => {
      const picked = id ? recipes.find((r) => r.id === id) : null;
      if (picked?.name) return picked.name;
      const hit = recipes.find((r) => r.equipment_model && r.equipment_model.toLowerCase() === model.toLowerCase() && r.name);
      return hit?.name ?? "";
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
          notes: machine?.note || recipeName(row.recipeId, row.equipment),
          voltage: row.powerVoltage,
          plug: row.plug ?? "",
        },
        outletForModel(row.equipment, outlets),
      );
    });
    const rows = groupFormRows(units);
    const items = (inspection?.machines ?? []).flatMap((m) => m.items);
    const of = (key: string) => items.filter((i) => i.category === key).map((i) => i.status);
    const photoCount = (inspection?.machines ?? []).reduce((n, m) => n + (m.photoCount || 0), 0);
    const coffee = units.filter((u) => unitType(u.model) !== "other");
    const recipesReady = coffee.length ? coffee.every((u) => !!u.notes.trim()) : null;
    const owned = folded.rows.filter((r) => r.ownership === "Sold" || r.ownership === "Loaned" || r.ownership === "Leased");
    const docs: "yes" | "pending" | "blank" = !folded.rows.length ? "blank" : owned.length === folded.rows.length ? "yes" : owned.length ? "pending" : "blank";
    const clean = (raw: string | null | undefined) => {
      const s = String(raw ?? "").trim();
      if (!s || /^not set$/i.test(s) || /^undefined$/i.test(s) || /^null$/i.test(s)) return "";
      return s;
    };
    const date = (install.install_date ?? "").slice(0, 10);
    return {
      id: install.id,
      customer: clean(customer),
      phone: clean(inspection?.siteContact),
      installDate: date,
      accountRep: clean(install.account_rep),
      address: clean(addressRow?.address),
      accountType: accountIsNew(priorInstalls, priorEquipment) ? "new" : "update",
      technician: clean(install.technician),
      wo: clean(install.wo),
      inspector: clean(inspection?.inspector),
      inspectedOn: (inspection?.inspectedOn ?? "").slice(0, 10),
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
  });
