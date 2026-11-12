import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { normalizeHeader } from "@/lib/ops/corrigo";
import { catalogNames, dropMergedRow, putUnitBackOnOpenInstalls, takeUnitOffOpenInstalls } from "@/lib/ops/inspection-api";
import { assertUnitUnlocked } from "@/lib/ops/equipment-lock";
import { installMachines, serializeMachines } from "@/lib/ops/machines";
import { dropRetiredRecord, listDuplicateSerials, listRetiredUnits, restoreRetiredUnit, retireUnitRecord, type RetiredBy } from "@/lib/ops/account-equip-retire";
import {
  cleanPartNumber,
  isWalkIn,
  mapOwnership,
  matchAccount,
  matchCatalogModel,
  matchExistingUnit,
  OWNERSHIP_VALUES,
  PART_NUMBER_MAX,
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
  /** Typed from the data plate or NetSuite, to tell variants of one model apart (Chuy, 11/9). */
  partNumber: string | null;
  updatedAt: string;
  /** updated_at as Postgres writes it: Edit sends it back, so a window opened before another save can't save over it. */
  seen: string;
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
  /** The file's Part #, tidied. Null when the file has none: the unit keeps its own. */
  partNumber: string | null;
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
  // "Part #" reads as "part": the header's # is dropped (11/9).
  part: "partNumber",
  "part number": "partNumber",
  "part no": "partNumber",
  "part num": "partNumber",
  pn: "partNumber",
};

type EquipCol =
  | "customer"
  | "equipmentName"
  | "model"
  | "serial"
  | "installDate"
  | "electrical"
  | "ownership"
  | "partNumber";

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

/**
 * A cell as the file writes it, where that is the same value (11/12): text as typed ("33200.0000" keeps its zeros,
 * which the number read drops), and a number shown with its zeros ("00123", "20201.1000"). A number shown another way
 * ("33,200", "$12.00", "50%", "1.23457E+11") and a date read as before.
 */
function asWritten(raw: unknown, shown: unknown): string {
  if (typeof raw === "string") return raw;
  const text = String(shown ?? "").trim();
  if (typeof raw === "number" && /^[-+]?\d+(\.\d+)?$/.test(text) && Number(text) === raw) return text;
  return stringifyCell(raw);
}

/** The file's cells, and the same cells as the file writes them: the Part # column reads the second (11/12). */
export function fileToMatrix(base64: string): { matrix: string[][]; shown: string[][] } {
  const wb = XLSX.read(base64, { type: "base64", cellDates: true, raw: false });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("The file has no sheets.");
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error("The file has no sheets.");
  const opts = { header: 1 as const, defval: "", blankrows: false };
  const raw = XLSX.utils.sheet_to_json<(unknown[] | null)[]>(sheet, opts);
  const shown = XLSX.utils.sheet_to_json<(unknown[] | null)[]>(sheet, { ...opts, raw: false });
  return {
    matrix: raw.map((row) => (row ?? []).map(stringifyCell)),
    shown: raw.map((row, r) => (row ?? []).map((v, c) => asWritten(v, shown[r]?.[c]))),
  };
}

function mapRow(headers: EquipCol[], cells: string[], shown?: string[]) {
  const rec: Record<EquipCol, string> = {
    customer: "",
    equipmentName: "",
    model: "",
    serial: "",
    installDate: "",
    electrical: "",
    ownership: "",
    partNumber: "",
  };
  headers.forEach((col, i) => {
    if (!col) return;
    const v = (col === "partNumber" && shown ? shown[i] ?? "" : cells[i] ?? "").trim();
    if (v && !rec[col]) rec[col] = v;
  });
  return rec;
}

/** The file's rows, by the columns its header row names. */
export function parseEquipMatrix(matrix: string[][], shown?: string[][]) {
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
    const rec = mapRow(mapped, matrix[i] ?? [], shown?.[i]);
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
  part_number?: string | null;
  updated_at: string;
  seen?: string;
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
    partNumber: r.part_number ?? null,
    updatedAt: String(r.updated_at ?? ""),
    seen: r.seen ?? "",
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

export function buildPreviewRow(
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
  const typedPart = cleanPartNumber(rec.partNumber);
  const partTooLong = !!typedPart && typedPart.length > PART_NUMBER_MAX;
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

  if (partTooLong) {
    action = "review";
    reviewReasons.push(`The part number is too long (${PART_NUMBER_MAX} characters at most).`);
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
    partNumber: partTooLong ? null : typedPart,
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
    const { matrix, shown } = fileToMatrix(data.base64);
    const parsed = parseEquipMatrix(matrix, shown);
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
  partNumber: z.string().nullable().optional(),
  action: z.enum(["add", "update", "review", "skip"]),
  existingId: z.number().nullable().optional(),
  foreignAccount: z.string().nullable().optional(),
  reviewReasons: z.array(z.string()).optional(),
});

const applyInput = z.object({
  rows: z.array(applyRow),
});

/** The equipment list's name for a model, adding it (or bringing an archived one back) when it isn't there. */
export async function ensureCatalogModel(
  sql: Sql,
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

/**
 * The import's update of a unit already on the account: $1 unit, $2 model, $3 name, $4 serial, $5 its key,
 * $6 install date, $7 electrical, $8 ownership, $9 Part #. A file with no install date, electrical, ownership or Part # leaves the
 * unit's own as it is (11/9: the date used to be blanked).
 */
export function importUpdateUnitSql(): string {
  return `update account_equipment set
              catalog_model = $2,
              equipment_name = $3,
              serial = $4,
              serial_key = $5,
              install_date = coalesce($6::date, install_date),
              electrical = coalesce($7, electrical),
              ownership = coalesce($8, ownership),
              part_number = coalesce($9, part_number),
              updated_at = now()
            where id = $1`;
}

/** The import's new units, `count` at a time: nine values each, in importUpdateUnitSql's order after the unit. */
export function importInsertUnitsSql(count: number): string {
  const rows = Array.from({ length: count }, (_, i) => `(${Array.from({ length: 9 }, (__, c) => `$${i * 9 + c + 1}`).join(", ")})`);
  return `insert into account_equipment
            (customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, part_number)
           values ${rows.join(",")}`;
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
      const typedPart = cleanPartNumber(row.partNumber);
      const partNumber = typedPart && typedPart.length <= PART_NUMBER_MAX ? typedPart : null;

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
              partNumber ?? inserts[idx][8],
            ];
            existing = existing.map((e) =>
              e.id === unit.existingId
                ? { ...e, catalogModel, equipmentName, serial, serialKey: key }
                : e,
            );
          }
          continue;
        }
        await sql.query(importUpdateUnitSql(), [unit.existingId, catalogModel, equipmentName, serial, key, installDate, electrical, ownership, partNumber]);
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
        partNumber,
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
      await sql.query(importInsertUnitsSql(slice.length), slice.flat());
    }

    return { added, updated, skipped, catalogAdded };
  });

const listInput = z.object({
  customer: z.string().optional(),
});

const UNIT_COLS = `id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, part_number,
              updated_at, updated_at::text as seen, locked_at, locked_by`;

type UnitDbRow = Parameters<typeof mapDbUnit>[0];

/** An account's units (or every account's), as the Equipment tab lists them. */
export async function readAccountUnits(sql: Sql, customer?: string | null): Promise<AccountEquipRow[]> {
  const name = customer?.trim();
  const rows = name
    ? await sql.query<UnitDbRow>(
        `select ${UNIT_COLS}
           from account_equipment
          where lower(customer) = lower($1)
          order by lower(catalog_model), id`,
        [name],
      )
    : await sql.query<UnitDbRow>(
        `select ${UNIT_COLS}
           from account_equipment
          order by lower(customer), lower(catalog_model), id`,
      );
  return rows.map(mapDbUnit);
}

/** One unit, as the Equipment tab lists it. */
export async function readAccountUnit(sql: Sql, id: number): Promise<AccountEquipRow | null> {
  const rows = await sql.query<UnitDbRow>(`select ${UNIT_COLS} from account_equipment where id = $1`, [id]);
  return rows[0] ? mapDbUnit(rows[0]) : null;
}

export const listAccountEquipment = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof listInput>) => listInput.parse(d ?? {}))
  .handler(async ({ data }): Promise<AccountEquipRow[]> => readAccountUnits(await ready(), data.customer));

async function dropEquipmentLinks(sql: Awaited<ReturnType<typeof ready>>, id: number) {
  await sql.query("delete from install_inspection_units where equipment_id = $1", [id]);
  await sql.query("delete from install_inspection_photos where equipment_id = $1", [id]);
  await sql.query("delete from pm_runbook_unit_links where account_equipment_id = $1", [id]);
}

/**
 * Take one equipment row off the account. Does not guess which duplicate is real. An open install whose visit has the
 * unit loses that machine from its equipment list too; left on the list, the next load made the unit again.
 */
export async function removeEquipmentUnit(sql: Sql, id: number, by?: RetiredBy | null): Promise<{ id: number }> {
  const row = (await sql.query<{ id: number }>("select id from account_equipment where id = $1", [id]))[0];
  if (!row) throw new Error("That unit is not on the account.");
  const mod = (await sql.query<{ module_id: string }>("select module_id from modules where assigned_unit_id = $1 limit 1", [id]))[0];
  if (mod) throw new Error(`Eversys module ${mod.module_id} is still on this unit. Swap it or return it first.`);
  await assertUnitUnlocked(sql, id);
  // Its record and its inspection and PM links are kept first (11/9): the machine is retired, not lost.
  const retired = await retireUnitRecord(sql, id, by);
  try {
    const offLists = await takeUnitOffOpenInstalls(sql, id);
    // The open installs whose list lost its row: Put back returns the row there, and nowhere else (11/12).
    if (retired != null && offLists.length) {
      await sql.query("update account_equipment_retired set links = links || jsonb_build_object('off_lists', $2::jsonb) where id = $1", [retired, JSON.stringify(offLists)]);
    }
    await dropEquipmentLinks(sql, id);
    await sql.query("delete from account_equipment where id = $1", [id]);
  } catch (e) {
    // Still on the account, so not retired.
    if (retired != null) await dropRetiredRecord(sql, retired).catch(() => undefined);
    throw e;
  }
  return { id };
}

/** Who a removal is recorded under. */
async function retiredBy(sql: Sql, userId: string | null | undefined): Promise<RetiredBy> {
  if (!userId) return { userId: null, name: null };
  const row = await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]);
  return { userId, name: row[0]?.username || "Teammate" };
}

export const removeAccountEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => removeEquipmentUnit(await ready(), data.id, await retiredBy(await ready(), context.userId)));

/** An account's retired machines (11/9). */
export const listRetiredEquipment = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string }) => z.object({ customer: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data }) => listRetiredUnits(await ready(), data.customer));

/** Put a retired machine back on its account, and on the lists of the open installs Remove took it off (11/12). */
export async function putBackEquipmentUnit(sql: Sql, retiredId: number): Promise<{ id: number }> {
  const off = (
    await sql.query<{ off: number[] | null }>("select links->'off_lists' as off from account_equipment_retired where id = $1", [retiredId])
  )[0]?.off;
  const back = await restoreRetiredUnit(sql, retiredId);
  if (Array.isArray(off) && off.length) await putUnitBackOnOpenInstalls(sql, back.id, off.map(Number));
  return back;
}

/** Put a retired machine back on its account. */
export const restoreAccountEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => putBackEquipmentUnit(await ready(), data.id));

/** Serials that are on more than one account unit. Read only. */
export const getDuplicateSerials = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async () => listDuplicateSerials(await ready()));

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
    part_number: string | null;
  }>("select id, customer, catalog_model, equipment_name, serial, electrical, part_number from account_equipment where id = any($1::int[])", [
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
  // The kept unit's Part #, or the other's when it has none (11/9).
  const keepPart = (keep.part_number ?? "").trim();
  const partNumber = keepPart || (drop.part_number ?? "").trim() || null;
  if (serial !== keepSerial || electrical !== (keep.electrical ?? "").trim() || (partNumber ?? "") !== keepPart) {
    await sql.query(
      "update account_equipment set serial = $2, serial_key = $3, electrical = $4, part_number = $5, updated_at = now() where id = $1",
      [keep.id, serial || null, serial ? serialKey(serial) : null, electrical, partNumber],
    );
  }
  // An open install whose visit has both units loses the dropped unit's row; one row is left for the kept unit.
  await dropMergedRow(sql, keep.id, drop.id);
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
    // The row that names the dropped unit by its id first; then by its serial, or a row of its model with none.
    const named = machines.findIndex((m) => m.unitId === drop.id);
    const at =
      named >= 0
        ? named
        : machines.findIndex((m) =>
            dropKey
              ? serialKey(m.serial) === dropKey
              : !serialKey(m.serial) && (sameCatalogModel(drop.catalog_model, m.equipment) || sameCatalogModel(drop.equipment_name, m.equipment)),
          );
    if (at < 0) return [];
    // The row names the kept unit now, by its serial and by its id.
    machines[at] = { ...machines[at]!, serial, ...(machines[at]!.unitId === drop.id ? { unitId: keep.id } : {}) };
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
  // PM runbook rows a PM keyed by the dropped record ('acct:<id>'): its units, ticks and options follow to the kept
  // record. Where the kept record has its own for that PM (or tick), the kept one stays.
  const [keepKey, dropKey2] = [`acct:${keep.id}`, `acct:${drop.id}`];
  await sql.query(
    `update pm_runbook_units d set unit_key = $1 where d.unit_key = $2
        and not exists (select 1 from pm_runbook_units k where k.pm_job_id = d.pm_job_id and k.unit_key = $1)`,
    [keepKey, dropKey2],
  );
  await sql.query(
    `update pm_runbook_checks d set unit_key = $1 where d.unit_key = $2
        and not exists (select 1 from pm_runbook_checks k where k.pm_job_id = d.pm_job_id and k.key = d.key and k.unit_key = $1)`,
    [keepKey, dropKey2],
  );
  await sql.query(
    "update unit_runbook_options d set unit_key = $1 where d.unit_key = $2 and not exists (select 1 from unit_runbook_options k where k.unit_key = $1)",
    [keepKey, dropKey2],
  );
  await sql.query("delete from account_equipment where id = $1", [drop.id]);
  return { keepId: keep.id, serial };
}

export const mergeAccountEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { keepId: number; dropId: number }) =>
    z.object({ keepId: z.number().int().positive(), dropId: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) => mergeEquipmentUnits(await ready(), data.keepId, data.dropId));
