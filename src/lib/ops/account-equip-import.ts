import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { normalizeHeader } from "@/lib/ops/corrigo";
import { catalogNames, takeUnitOffOpenInstalls } from "@/lib/ops/inspection-api";
import { assertUnitUnlocked } from "@/lib/ops/equipment-lock";
import { installMachines, serializeMachines } from "@/lib/ops/machines";
import {
  isWalkIn,
  mapOwnership,
  matchAccount,
  matchCatalogModel,
  matchExistingUnit,
  OWNERSHIP_VALUES,
  parseInstallDate,
  parseSerial,
  sameCatalogModel,
  serialKey,
  type ExistingUnit,
} from "@/lib/ops/account-equip";

export type AccountEquipRow = {
  id: number;
  customer: string;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  serialKey: string | null;
  installDate: string | null;
  electrical: string | null;
  ownership: string | null;
  updatedAt: string;
  /** Locked by the owner: Remove and Merge are off until it is unlocked. */
  lockedAt: string | null;
  lockedBy: string | null;
};

export type EquipPreviewRow = {
  key: string;
  fileCustomer: string;
  customer: string | null;
  customerId: number | null;
  customerStatus: "matched" | "walk-in" | "unmatched" | "ambiguous";
  equipmentName: string;
  fileModel: string;
  catalogModel: string | null;
  addCatalog: boolean;
  modelStatus: "matched" | "unmatched" | "ambiguous";
  modelCandidates: string[];
  serial: string | null;
  installDate: string | null;
  electrical: string | null;
  ownership: string | null;
  ownershipRaw: string;
  action: "add" | "update" | "review" | "skip";
  existingId: number | null;
  foreignAccount: string | null;
  reviewReasons: string[];
};

export type EquipPreview = {
  addCount: number;
  updateCount: number;
  reviewCount: number;
  skipped: number;
  rows: EquipPreviewRow[];
};

export type EquipApplyResult = {
  added: number;
  updated: number;
  skipped: number;
  catalogAdded: number;
};

const HEADER_KEYS: Record<string, EquipCol> = {
  "customer name": "customer",
  customer: "customer",
  account: "customer",
  "account name": "customer",
  "equipment name": "equipmentName",
  equipment: "equipmentName",
  "equip name": "equipmentName",
  name: "equipmentName",
  model: "model",
  "model name": "model",
  "model no": "model",
  "model number": "model",
  serial: "serial",
  "serial no": "serial",
  "serial number": "serial",
  "installation date": "installDate",
  "install date": "installDate",
  "date installed": "installDate",
  installed: "installDate",
  "electrical configuration": "electrical",
  electrical: "electrical",
  configuration: "electrical",
  config: "electrical",
  ownership: "ownership",
  owned: "ownership",
  owner: "ownership",
};

type EquipCol =
  | "customer"
  | "equipmentName"
  | "model"
  | "serial"
  | "installDate"
  | "electrical"
  | "ownership";

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

function stringifyCell(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v)) return String(v);
    const rounded = Math.round(v);
    if (Math.abs(v - rounded) < 1e-6) return String(rounded);
  }
  const s = String(v);
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
  return s;
}

function fileToMatrix(base64: string): string[][] {
  const wb = XLSX.read(base64, { type: "base64", cellDates: true, raw: false });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("The file has no sheets.");
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error("The file has no sheets.");
  const matrix = XLSX.utils.sheet_to_json<(unknown[] | null)[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  return matrix.map((row) => (row ?? []).map(stringifyCell));
}

function mapRow(headers: EquipCol[], cells: string[]) {
  const rec: Record<EquipCol, string> = {
    customer: "",
    equipmentName: "",
    model: "",
    serial: "",
    installDate: "",
    electrical: "",
    ownership: "",
  };
  headers.forEach((col, i) => {
    if (!col) return;
    const v = (cells[i] ?? "").trim();
    if (v && !rec[col]) rec[col] = v;
  });
  return rec;
}

function parseMatrix(matrix: string[][]) {
  let headerIdx = 0;
  let mapped: EquipCol[] = [];
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const cols = (matrix[i] ?? []).map((h) => HEADER_KEYS[normalizeHeader(h)] ?? null);
    const hits = cols.filter(Boolean).length;
    if (hits >= 3 && cols.includes("customer") && (cols.includes("model") || cols.includes("equipmentName"))) {
      headerIdx = i;
      mapped = cols.map((c) => c as EquipCol);
      break;
    }
  }
  if (!mapped.length) {
    throw new Error(
      "Could not find Customer Name, Equipment Name / Model columns. Check the header row.",
    );
  }
  const records = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const rec = mapRow(mapped, matrix[i] ?? []);
    if (!rec.customer && !rec.equipmentName && !rec.model && !rec.serial) {
      skipped += 1;
      continue;
    }
    records.push(rec);
  }
  return { records, skipped };
}

function mapDbUnit(r: {
  id: number;
  customer: string;
  catalog_model: string;
  equipment_name: string;
  serial: string | null;
  serial_key: string | null;
  install_date: string | null;
  electrical: string | null;
  ownership: string | null;
  updated_at: string;
  locked_at?: unknown;
  locked_by?: string | null;
}): AccountEquipRow {
  const lockedAt = r.locked_at instanceof Date ? r.locked_at.toISOString() : r.locked_at ? String(r.locked_at) : null;
  return {
    lockedAt,
    lockedBy: lockedAt ? r.locked_by || "the owner" : null,
    id: r.id,
    customer: r.customer,
    catalogModel: r.catalog_model,
    equipmentName: r.equipment_name,
    serial: r.serial,
    serialKey: r.serial_key,
    installDate: r.install_date,
    electrical: r.electrical,
    ownership: r.ownership,
    updatedAt: String(r.updated_at ?? ""),
  };
}

async function loadCatalog(sql: Awaited<ReturnType<typeof getSql>>): Promise<string[]> {
  const rows = await sql.query<{ name: string }>(
    `select name from directory_equipment where archived = false and coalesce(name,'') <> '' order by lower(name)`,
  );
  return rows.map((r) => r.name);
}

async function loadAccounts(sql: Awaited<ReturnType<typeof getSql>>) {
  return sql.query<{ id: number; name: string }>(
    `select id, name from directory_customers where archived = false and coalesce(name,'') <> '' order by lower(name)`,
  );
}

async function loadExisting(sql: Awaited<ReturnType<typeof getSql>>): Promise<ExistingUnit[]> {
  const rows = await sql
    .query<{
      id: number;
      customer: string;
      catalog_model: string;
      equipment_name: string;
      serial: string | null;
      serial_key: string | null;
      locked_at: unknown;
      locked_by: string | null;
    }>(
      `select id, customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by from account_equipment`,
    )
    .catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    customer: r.customer,
    catalogModel: r.catalog_model,
    equipmentName: r.equipment_name,
    serial: r.serial,
    serialKey: r.serial_key,
    lockedBy: r.locked_at ? r.locked_by || "the owner" : null,
  }));
}

function buildPreviewRow(
  rec: Record<EquipCol, string>,
  index: number,
  accounts: { id: number; name: string }[],
  catalog: string[],
  existing: ExistingUnit[],
): EquipPreviewRow {
  const account = matchAccount(rec.customer, accounts);
  const catalogHit = matchCatalogModel(rec.equipmentName, rec.model, catalog);
  const serial = parseSerial(rec.serial);
  const installDate = parseInstallDate(rec.installDate);
  const owned = mapOwnership(rec.ownership);
  const reviewReasons: string[] = [];
  if (account.status === "walk-in") reviewReasons.push("Walk-In — pick a KatzDesk account");
  if (account.status === "unmatched") reviewReasons.push("No matching account");
  if (account.status === "ambiguous") reviewReasons.push("Several accounts match");
  if (catalogHit.status === "unmatched") reviewReasons.push("No catalog model");
  if (catalogHit.status === "ambiguous") reviewReasons.push("Several catalog models match");

  let action: EquipPreviewRow["action"] = "add";
  let existingId: number | null = null;
  let foreignAccount: string | null = null;
  const customerName = account.account?.name ?? null;
  const catalogModel = catalogHit.catalogModel;
  if (customerName && catalogModel && !reviewReasons.length) {
    const unit = matchExistingUnit({
      customer: customerName,
      catalogModel,
      equipmentName: rec.equipmentName.trim() || rec.model.trim() || catalogModel,
      serial,
      existing,
    });
    action = unit.action === "review" ? "review" : unit.action;
    existingId = unit.existingId;
    foreignAccount = unit.foreignAccount;
    if (unit.foreignAccount) reviewReasons.push(`Serial already on ${unit.foreignAccount}`);
    const locked = existing.find((e) => e.id === unit.existingId)?.lockedBy;
    if (locked) {
      action = "review";
      reviewReasons.push(`Locked by ${locked}. Only the owner can unlock it.`);
    }
  } else {
    action = "review";
  }

  const equipmentName = rec.equipmentName.trim() || rec.model.trim();
  return {
    key: `r${index}`,
    fileCustomer: rec.customer.trim(),
    customer: customerName,
    customerId: account.account?.id ?? null,
    customerStatus: account.status,
    equipmentName,
    fileModel: rec.model.trim(),
    catalogModel,
    addCatalog: false,
    modelStatus: catalogHit.status,
    modelCandidates: catalogHit.candidates,
    serial,
    installDate,
    electrical: rec.electrical.trim() || null,
    ownership: owned.value,
    ownershipRaw: owned.raw,
    action,
    existingId,
    foreignAccount,
    reviewReasons,
  };
}

const fileInput = z.object({
  filename: z.string(),
  base64: z.string().min(8),
});

export const previewAccountEquipImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof fileInput>) => fileInput.parse(d))
  .handler(async ({ data }): Promise<EquipPreview> => {
    if (data.base64.length > 16_000_000) throw new Error("That file is too large.");
    const matrix = fileToMatrix(data.base64);
    const parsed = parseMatrix(matrix);
    const sql = await ready();
    const [accounts, catalog, existing] = await Promise.all([
      loadAccounts(sql),
      loadCatalog(sql),
      loadExisting(sql),
    ]);
    const rows = parsed.records.map((rec, i) => buildPreviewRow(rec, i, accounts, catalog, existing));
    return {
      addCount: rows.filter((r) => r.action === "add").length,
      updateCount: rows.filter((r) => r.action === "update").length,
      reviewCount: rows.filter((r) => r.action === "review").length,
      skipped: parsed.skipped,
      rows,
    };
  });

const applyRow = z.object({
  key: z.string(),
  fileCustomer: z.string(),
  customer: z.string().nullable(),
  customerId: z.number().nullable().optional(),
  customerStatus: z.enum(["matched", "walk-in", "unmatched", "ambiguous"]).optional(),
  equipmentName: z.string(),
  fileModel: z.string().optional(),
  catalogModel: z.string().nullable(),
  addCatalog: z.boolean().optional(),
  modelStatus: z.enum(["matched", "unmatched", "ambiguous"]).optional(),
  modelCandidates: z.array(z.string()).optional(),
  serial: z.string().nullable(),
  installDate: z.string().nullable(),
  electrical: z.string().nullable().optional(),
  ownership: z.string().nullable(),
  ownershipRaw: z.string().optional(),
  action: z.enum(["add", "update", "review", "skip"]),
  existingId: z.number().nullable().optional(),
  foreignAccount: z.string().nullable().optional(),
  reviewReasons: z.array(z.string()).optional(),
});

const applyInput = z.object({
  rows: z.array(applyRow),
});

async function ensureCatalogModel(
  sql: Awaited<ReturnType<typeof getSql>>,
  name: string,
): Promise<{ name: string; created: boolean }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Catalog model is empty");
  const existing = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from directory_equipment where lower(name) = lower($1) limit 1`,
    [trimmed],
  );
  if (existing[0]) {
    if (existing[0].archived) {
      await sql.query(`update directory_equipment set archived = false, updated_at = now() where id = $1`, [
        existing[0].id,
      ]);
    }
    return { name: existing[0].name, created: false };
  }
  const inserted = await sql.query<{ name: string }>(
    `insert into directory_equipment (name) values ($1) returning name`,
    [trimmed],
  );
  return { name: inserted[0]?.name ?? trimmed, created: true };
}

export const applyAccountEquipImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof applyInput>) => applyInput.parse(d))
  .handler(async ({ data }): Promise<EquipApplyResult> => {
    const sql = await ready();
    const accounts = await loadAccounts(sql);
    const accountByKey = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
    const catalog = await loadCatalog(sql);
    const catalogByKey = new Map(catalog.map((n) => [n.toLowerCase(), n]));
    let existing = await loadExisting(sql);
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let catalogAdded = 0;
    const inserts: (string | number | null)[][] = [];

    for (const row of data.rows) {
      if (row.action === "skip" || row.action === "review") {
        skipped += 1;
        continue;
      }
      const customerName = (row.customer ?? "").trim();
      if (!customerName || isWalkIn(customerName)) {
        skipped += 1;
        continue;
      }
      const account = accountByKey.get(customerName.toLowerCase());
      if (!account) {
        skipped += 1;
        continue;
      }
      let catalogModel = (row.catalogModel ?? "").trim();
      if (!catalogModel) {
        skipped += 1;
        continue;
      }
      const known = catalogByKey.get(catalogModel.toLowerCase());
      if (known) {
        catalogModel = known;
      } else if (row.addCatalog) {
        const made = await ensureCatalogModel(sql, catalogModel);
        catalogModel = made.name;
        catalogByKey.set(catalogModel.toLowerCase(), catalogModel);
        if (made.created) catalogAdded += 1;
      } else {
        skipped += 1;
        continue;
      }

      const serial = parseSerial(row.serial);
      const equipmentName = row.equipmentName.trim() || catalogModel;
      const unit = matchExistingUnit({
        customer: account.name,
        catalogModel,
        equipmentName,
        serial,
        existing,
      });
      // A locked unit is left as it is: only the owner changes it.
      if (unit.foreignAccount || existing.find((e) => e.id === unit.existingId)?.lockedBy) {
        skipped += 1;
        continue;
      }
      const ownership = OWNERSHIP_VALUES.includes(row.ownership as (typeof OWNERSHIP_VALUES)[number])
        ? row.ownership
        : mapOwnership(row.ownership).value;
      const installDate = parseInstallDate(row.installDate);
      const electrical = row.electrical?.trim() || null;
      const key = serialKey(serial) || null;

      if (unit.action === "update" && unit.existingId) {
        if (unit.existingId < 0) {
          const idx = -unit.existingId - 1;
          if (inserts[idx]) {
            inserts[idx] = [
              account.name,
              catalogModel,
              equipmentName,
              serial,
              key,
              installDate,
              electrical,
              ownership,
            ];
            existing = existing.map((e) =>
              e.id === unit.existingId
                ? { ...e, catalogModel, equipmentName, serial, serialKey: key }
                : e,
            );
          }
          continue;
        }
        await sql.query(
          `update account_equipment set
              catalog_model = $2,
              equipment_name = $3,
              serial = $4,
              serial_key = $5,
              install_date = $6,
              electrical = coalesce($7, electrical),
              ownership = coalesce($8, ownership),
              updated_at = now()
            where id = $1`,
          [unit.existingId, catalogModel, equipmentName, serial, key, installDate, electrical, ownership],
        );
        existing = existing.map((e) =>
          e.id === unit.existingId
            ? { ...e, catalogModel, equipmentName, serial, serialKey: key }
            : e,
        );
        updated += 1;
        continue;
      }

      const tempId = -(inserts.length + 1);
      inserts.push([
        account.name,
        catalogModel,
        equipmentName,
        serial,
        key,
        installDate,
        electrical,
        ownership,
      ]);
      existing.push({
        id: tempId,
        customer: account.name,
        catalogModel,
        equipmentName,
        serial,
        serialKey: key,
      });
      added += 1;
    }

    const chunk = 50;
    for (let i = 0; i < inserts.length; i += chunk) {
      const slice = inserts.slice(i, i + chunk);
      const values: (string | number | null)[] = [];
      const placeholders = slice.map((row, idx) => {
        const b = idx * 8;
        values.push(...row);
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
      });
      await sql.query(
        `insert into account_equipment
            (customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership)
           values ${placeholders.join(",")}`,
        values,
      );
    }

    return { added, updated, skipped, catalogAdded };
  });

const listInput = z.object({
  customer: z.string().optional(),
});

export const listAccountEquipment = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof listInput>) => listInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<AccountEquipRow[]> => {
    const sql = await ready();
    const customer = data.customer?.trim();
    const rows = customer
      ? await sql.query<{
          id: number;
          customer: string;
          catalog_model: string;
          equipment_name: string;
          serial: string | null;
          serial_key: string | null;
          install_date: string | null;
          electrical: string | null;
          ownership: string | null;
          updated_at: string;
        }>(
          `select id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, updated_at, locked_at, locked_by
             from account_equipment
            where lower(customer) = lower($1)
            order by lower(catalog_model), id`,
          [customer],
        )
      : await sql.query<{
          id: number;
          customer: string;
          catalog_model: string;
          equipment_name: string;
          serial: string | null;
          serial_key: string | null;
          install_date: string | null;
          electrical: string | null;
          ownership: string | null;
          updated_at: string;
        }>(
          `select id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, updated_at, locked_at, locked_by
             from account_equipment
            order by lower(customer), lower(catalog_model), id`,
        );
    return rows.map(mapDbUnit);
  });

async function dropEquipmentLinks(sql: Awaited<ReturnType<typeof ready>>, id: number) {
  await sql.query("delete from install_inspection_units where equipment_id = $1", [id]);
  await sql.query("delete from install_inspection_photos where equipment_id = $1", [id]);
  await sql.query("delete from pm_runbook_unit_links where account_equipment_id = $1", [id]);
}

/**
 * Take one equipment row off the account. Does not guess which duplicate is real. An open install whose visit has the
 * unit loses that machine from its equipment list too; left on the list, the next load made the unit again.
 */
export async function removeEquipmentUnit(sql: Sql, id: number): Promise<{ id: number }> {
  const row = (await sql.query<{ id: number }>("select id from account_equipment where id = $1", [id]))[0];
  if (!row) throw new Error("That unit is not on the account.");
  const mod = (await sql.query<{ module_id: string }>("select module_id from modules where assigned_unit_id = $1 limit 1", [id]))[0];
  if (mod) throw new Error(`Eversys module ${mod.module_id} is still on this unit. Swap it or return it first.`);
  await assertUnitUnlocked(sql, id);
  await takeUnitOffOpenInstalls(sql, id);
  await dropEquipmentLinks(sql, id);
  await sql.query("delete from account_equipment where id = $1", [id]);
  return { id };
}

export const removeAccountEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => removeEquipmentUnit(await ready(), data.id));

/**
 * Keep one account unit and drop the other. A short leftover serial (such as "L") is replaced by the longer one.
 * Inspection links move onto the unit that stays.
 */
export async function mergeEquipmentUnits(sql: Sql, keepId: number, dropId: number): Promise<{ keepId: number; serial: string }> {
  if (keepId === dropId) throw new Error("Pick two different units.");
  const rows = await sql.query<{
    id: number;
    customer: string;
    catalog_model: string;
    equipment_name: string;
    serial: string | null;
    electrical: string | null;
  }>("select id, customer, catalog_model, equipment_name, serial, electrical from account_equipment where id = any($1::int[])", [
    [keepId, dropId],
  ]);
  const keep = rows.find((r) => r.id === keepId);
  const drop = rows.find((r) => r.id === dropId);
  if (!keep || !drop) throw new Error("Those units are not both on an account.");
  // A locked unit is neither dropped nor rewritten.
  await assertUnitUnlocked(sql, dropId);
  await assertUnitUnlocked(sql, keepId);
  if (keep.customer.trim().toLowerCase() !== drop.customer.trim().toLowerCase()) {
    throw new Error("Those units are on different accounts.");
  }
  const keepSerial = (keep.serial ?? "").trim();
  const dropSerial = (drop.serial ?? "").trim();
  const serial = dropSerial && keepSerial.length <= 2 && dropSerial.length > keepSerial.length ? dropSerial : keepSerial || dropSerial;
  const electrical = (keep.electrical ?? "").trim() || (drop.electrical ?? "").trim() || null;
  if (serial !== keepSerial || electrical !== (keep.electrical ?? "").trim()) {
    await sql.query(
      "update account_equipment set serial = $2, serial_key = $3, electrical = $4, updated_at = now() where id = $1",
      [keep.id, serial || null, serial ? serialKey(serial) : null, electrical],
    );
  }
  // An install that lists the dropped unit takes the kept serial on that machine. Otherwise its next load matches
  // no unit (a machine with no serial never takes a unit that has one) and adds the dropped unit back.
  const key = serialKey(serial);
  const dropKey = serialKey(dropSerial);
  const linked = key
    ? await sql.query<{ id: number; equipment: string | null; serial: string | null; power_voltage: string | null; machines: string | null }>(
        `select i.id, i.equipment, i.serial, i.power_voltage, i.machines from installs i
          where exists (select 1 from install_inspection_units u where u.install_id = i.id and u.equipment_id = $1)`,
        [drop.id],
      )
    : [];
  const catalog = linked.length ? await catalogNames(sql) : [];
  const lists = linked.flatMap((row) => {
    const { machines, typed } = installMachines(row, catalog);
    if (machines.some((m) => serialKey(m.serial) === key)) return [];
    const at = machines.findIndex((m) =>
      dropKey
        ? serialKey(m.serial) === dropKey
        : !serialKey(m.serial) && (sameCatalogModel(drop.catalog_model, m.equipment) || sameCatalogModel(drop.equipment_name, m.equipment)),
    );
    if (at < 0) return [];
    machines[at] = { ...machines[at]!, serial };
    const packed = serializeMachines(machines);
    return [{ id: row.id, equipment: typed ? row.equipment : packed.equipment, machines: packed.machines, serial: packed.serial, power: packed.powerVoltage }];
  });
  // The rest of what the dropped unit carries moves too, or deleting it below erases it: its pre-inspection checks
  // (the kept unit's own answer wins), the note and answers on its visit, and an Eversys module assigned to it.
  await sql.query(
    `with items as (
       update install_inspection_items d set equipment_id = $1
        where d.equipment_id = $2
          and not exists (
            select 1 from install_inspection_items k
             where k.install_id = d.install_id and k.equipment_id = $1 and k.category = d.category
          )
     ), answered as (
       -- A kept check that was never answered takes the dropped unit's answer, notes joined.
       update install_inspection_items k
          set status = d.status,
              notes = nullif(concat_ws(' / ', nullif(btrim(k.notes), ''), nullif(btrim(d.notes), '')), ''),
              updated_at = now()
         from install_inspection_items d
        where k.equipment_id = $1 and d.equipment_id = $2
          and k.install_id = d.install_id and k.category = d.category
          and k.status = 'Not inspected' and d.status <> 'Not inspected'
     ), links as (
       update install_inspection_units k
          set note = coalesce(k.note, d.note),
              core_needed = coalesce(k.core_needed, d.core_needed),
              visit_kind = coalesce(k.visit_kind, d.visit_kind),
              reqs_same = case when k.visit_kind is null then d.reqs_same else k.reqs_same end,
              copied_from_install = case when k.visit_kind is null then d.copied_from_install else k.copied_from_install end,
              copied_from_equipment = case when k.visit_kind is null then d.copied_from_equipment else k.copied_from_equipment end,
              core_model = case when k.visit_kind is null then d.core_model else k.core_model end
         from install_inspection_units d
        where k.equipment_id = $1 and d.equipment_id = $2 and d.install_id = k.install_id
     ), lists as (
       update installs i
          set equipment = f.equipment, machines = f.machines, serial = f.serial, power_voltage = f.power_voltage, updated_at = now()
         from unnest($3::int[], $4::text[], $5::text[], $6::text[], $7::text[]) as f(id, equipment, machines, serial, power_voltage)
        where i.id = f.id
     ), mods as (
       update modules set assigned_unit_id = $1 where assigned_unit_id = $2
     )
     select 1`,
    [
      keep.id,
      drop.id,
      lists.map((l) => l.id),
      lists.map((l) => l.equipment),
      lists.map((l) => l.machines),
      lists.map((l) => l.serial),
      lists.map((l) => l.power),
    ],
  );
  await sql.query(
    `delete from install_inspection_units d
      where d.equipment_id = $2
        and exists (
          select 1 from install_inspection_units k
           where k.install_id = d.install_id and k.equipment_id = $1
        )`,
    [keep.id, drop.id],
  );
  await sql.query("update install_inspection_units set equipment_id = $1 where equipment_id = $2", [keep.id, drop.id]);
  await sql.query("update install_inspection_photos set equipment_id = $1 where equipment_id = $2", [keep.id, drop.id]);
  await sql.query(
    `delete from pm_runbook_unit_links d
      where d.account_equipment_id = $2
        and exists (
          select 1 from pm_runbook_unit_links k
           where k.pm_job_id = d.pm_job_id and k.piece_key = d.piece_key and k.account_equipment_id = $1
        )`,
    [keep.id, drop.id],
  );
  await sql.query("update pm_runbook_unit_links set account_equipment_id = $1 where account_equipment_id = $2", [keep.id, drop.id]);
  await sql.query("delete from account_equipment where id = $1", [drop.id]);
  return { keepId: keep.id, serial };
}

export const mergeAccountEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { keepId: number; dropId: number }) =>
    z.object({ keepId: z.number().int().positive(), dropId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) => mergeEquipmentUnits(await ready(), data.keepId, data.dropId));
