import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { normalizeHeader } from "@/lib/ops/corrigo";
import {
  isWalkIn,
  mapOwnership,
  matchAccount,
  matchCatalogModel,
  matchExistingUnit,
  OWNERSHIP_VALUES,
  parseInstallDate,
  parseSerial,
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
}): AccountEquipRow {
  return {
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
    }>(
      `select id, customer, catalog_model, equipment_name, serial, serial_key from account_equipment`,
    )
    .catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    customer: r.customer,
    catalogModel: r.catalog_model,
    equipmentName: r.equipment_name,
    serial: r.serial,
    serialKey: r.serial_key,
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
      if (unit.foreignAccount) {
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
          `select id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, updated_at
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
          `select id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, updated_at
             from account_equipment
            order by lower(customer), lower(catalog_model), id`,
        );
    return rows.map(mapDbUnit);
  });
