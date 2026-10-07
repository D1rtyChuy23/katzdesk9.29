import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { matchCatalogModel, sameCatalogModel, serialKey } from "@/lib/ops/account-equip";
import { listedEquipment } from "@/lib/ops/equipment";
import { parseMachinesJson } from "@/lib/ops/machines";
import {
  CORE_HOLE_CATEGORY,
  CORE_HOLE_LABEL,
  INSPECTION_CATEGORIES,
  categoryHint,
  categoryLabel,
  emptyInspection,
  failedItemLabels,
  inspectionOverall,
  isCoreHoleAnswer,
  isInspectionCategory,
  isInspectionItemStatus,
  isPreInspected,
  isSavableCategory,
  unitKind,
  itemSaveError,
  rollupSite,
  spacePassError,
  type CoreHoleAnswer,
  type InspectionCategory,
  type InspectionItemStatus,
  type InspectionOverall,
  type InspectionSummary,
  type VisitKind,
} from "@/lib/ops/pre-inspection";

export type {
  InspectionCategory,
  InspectionItemStatus,
  InspectionOverall,
  InspectionSummary,
} from "@/lib/ops/pre-inspection";
export {
  INSPECTION_CATEGORIES,
  canMarkInstalled,
  categoryHint,
  emptyInspection,
  inspectionGlance,
  photosCell,
  siteIsReady,
} from "@/lib/ops/pre-inspection";

export type InspectionPhoto = {
  id: number;
  equipmentId: number;
  category: InspectionCategory | typeof CORE_HOLE_CATEGORY;
  caption: string | null;
  dataUrl: string;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type InspectionItem = {
  category: InspectionCategory | typeof CORE_HOLE_CATEGORY;
  label: string;
  hint: string;
  status: InspectionItemStatus;
  notes: string | null;
  photos: InspectionPhoto[];
};

export type InspectionMachine = {
  equipmentId: number;
  name: string;
  model: string;
  serial: string | null;
  electrical: string | null;
  overall: InspectionOverall;
  failedItems: string[];
  photoCount: number;
  thumb: string | null;
  items: InspectionItem[];
  coreNeeded: CoreHoleAnswer | null;
  core: InspectionItem;
  /** New install, replacing equipment already on the account, or existing equipment that is staying. */
  visitKind: VisitKind;
  /** Existing equipment on the account: already pre-inspected, nothing to re-shoot. */
  preInspected: boolean;
  /** A note on the unit itself; optional. */
  note: string | null;
  /** Replacing only: are the site requirements the same? Null until answered. */
  reqsSame: boolean | null;
  /** The existing unit whose results were copied here, e.g. "Bunn Axiom DV-APS · SN 123". */
  copiedFrom: string | null;
  /** The model whose core hole is already in the counter (the unit being replaced). */
  coreModel: string | null;
};

/** An existing unit on the same account with pre-inspection results that can be copied. */
export type ReplaceSource = {
  installId: number;
  equipmentId: number;
  name: string;
  serial: string | null;
  overall: InspectionOverall;
  photoCount: number;
};

export type InspectionView = InspectionSummary & {
  installId: number;
  customer: string;
  inspector: string | null;
  inspectedOn: string | null;
  siteContact: string | null;
  notes: string | null;
  overrideBy: string | null;
  machines: InspectionMachine[];
};

export type InspectionUnitRow = {
  installId: number;
  equipmentId: number;
  model: string;
  serial: string | null;
  electrical: string | null;
  overall: InspectionOverall;
  failedItems: string[];
  photoCount: number;
  coreNeeded: CoreHoleAnswer | null;
  coreStatus: string | null;
  preInspected: boolean;
};

const MAX_PHOTO = 1_800_000;

async function ready() {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function deskUsername(sql: Sql, userId: string): Promise<string> {
  const row = await sql.query<{ username: string | null }>(
    "select username from desk_accounts where user_id = $1",
    [userId],
  );
  return row[0]?.username || "Teammate";
}

function idList(ids: number[]): string {
  return [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))].join(",");
}

function stamp(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  return v == null ? "" : String(v);
}

function day(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

type Piece = { equipment: string; serial: string; powerVoltage: string };

/**
 * One piece per machine, split the same way the install's Equipment section splits it
 * (catalog-aware), so "Linea / Swift / Axiom-APS" on one line is three machines, not one.
 */
function piecesFrom(
  row: {
    equipment?: string | null;
    serial?: string | null;
    power_voltage?: string | null;
    machines?: unknown;
  },
  catalog: string[] = [],
): Piece[] {
  const machines = parseMachinesJson(text(row.machines) || null);
  if (machines.length) return machines;
  const named = listedEquipment(text(row.equipment), catalog);
  return named.map((equipment) => ({
    equipment,
    serial: named.length === 1 ? text(row.serial) : "",
    powerVoltage: named.length === 1 ? text(row.power_voltage) : "",
  }));
}

type AcctUnit = {
  id: number;
  catalog_model: string;
  equipment_name: string;
  serial: string | null;
  serial_key: string | null;
  electrical: string | null;
};

async function catalogNames(sql: Sql): Promise<string[]> {
  const rows = await sql
    .query<{ name: string }>(
      `select name from directory_equipment where archived = false and coalesce(name, '') <> ''`,
    )
    .catch(() => []);
  return rows.map((r) => r.name);
}

async function insertEquipment(
  sql: Sql,
  customer: string,
  model: string,
  serial: string | null,
  electrical: string | null,
): Promise<number> {
  const names = await catalogNames(sql);
  const matched = matchCatalogModel(model, model, names);
  const catalogModel = matched.catalogModel || model.trim();
  const key = serialKey(serial) || null;
  const rows = await sql.query<{ id: number }>(
    `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, electrical)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [customer, catalogModel, model.trim() || catalogModel, serial?.trim() || null, key, electrical?.trim() || null],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Could not add equipment");
  return id;
}

async function linkUnit(sql: Sql, installId: number, equipmentId: number): Promise<void> {
  await sql.query(
    `insert into install_inspection_units (install_id, equipment_id) values ($1, $2) on conflict do nothing`,
    [installId, equipmentId],
  );
}

async function writePieceFields(sql: Sql, hit: AcctUnit, piece: Piece): Promise<void> {
  const serial = piece.serial.trim();
  const power = piece.powerVoltage.trim();
  let nextSerial = hit.serial;
  let nextKey = hit.serial_key;
  if (serial && !serialKey(hit.serial)) {
    const key = serialKey(serial);
    const clash = key
      ? await sql.query<{ id: number }>(
          "select id from account_equipment where serial_key = $1 and id <> $2 limit 1",
          [key, hit.id],
        )
      : [];
    if (key && !clash[0]) {
      nextSerial = serial;
      nextKey = key;
    }
  }
  const nextPower = power || hit.electrical;
  const serialChanged = (nextSerial ?? null) !== (hit.serial ?? null);
  const powerChanged = !!power && power !== (hit.electrical ?? "");
  if (!serialChanged && !powerChanged) return;
  await sql.query(
    "update account_equipment set serial = $2, serial_key = $3, electrical = $4 where id = $1",
    [hit.id, nextSerial, nextKey, nextPower],
  );
  hit.serial = nextSerial;
  hit.serial_key = nextKey;
  hit.electrical = nextPower;
}

function claimUnit(piece: Piece, pools: AcctUnit[][], used: Set<number>): AcctUnit | undefined {
  const key = serialKey(piece.serial);
  if (key) {
    for (const pool of pools) {
      const hit = pool.find((a) => !used.has(a.id) && a.serial_key === key);
      if (hit) return hit;
    }
  }
  for (const pool of pools) {
    const hit = pool.find(
      (a) => !used.has(a.id) && sameCatalogModel(a.catalog_model, piece.equipment) && !serialKey(a.serial),
    );
    if (hit) return hit;
  }
  return undefined;
}

async function unitPassed(sql: Sql, installId: number, equipmentId: number): Promise<boolean> {
  const [items, unit] = await Promise.all([
    sql.query<{ category: string; status: string }>(
      "select category, status from install_inspection_items where install_id = $1 and equipment_id = $2",
      [installId, equipmentId],
    ),
    sql.query<{ core_needed: string | null; visit_kind: string | null; install_date: unknown }>(
      `select u.core_needed, u.visit_kind, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as install_date from install_inspection_units u
         join account_equipment a on a.id = u.equipment_id where u.install_id = $1 and u.equipment_id = $2`,
      [installId, equipmentId],
    ),
  ]);
  if (unit[0] && isPreInspected(unitKind(unit[0].visit_kind, !!unit[0].install_date))) return true;
  return inspectionOverall(items, unit[0]?.core_needed) === "Passed";
}

/** Add install machines to pre-inspection. Prune only when the install equipment list was saved. */
export async function syncInstallUnits(sql: Sql, installId: number, opts?: { prune?: boolean }): Promise<void> {
  const install = await sql.query<{
    customer: string;
    equipment: string | null;
    serial: string | null;
    power_voltage: string | null;
    machines: string | null;
  }>("select customer, equipment, serial, power_voltage, machines from installs where id = $1", [installId]);
  const row = install[0];
  if (!row) return;
  const catalog = await catalogNames(sql);
  const pieces = piecesFrom(row, catalog);
  /** A unit saved under the whole one-line list ("Linea / Swift / Axiom") before machines were split. */
  const combined = (a: AcctUnit) => listedEquipment(a.equipment_name, catalog).length > 1;
  const account = await sql.query<AcctUnit>(
    `select id, catalog_model, equipment_name, serial, serial_key, electrical
       from account_equipment where lower(customer) = lower($1) order by id`,
    [row.customer],
  );
  const links = await sql.query<{ equipment_id: number }>(
    "select equipment_id from install_inspection_units where install_id = $1",
    [installId],
  );
  const linkedIds = new Set(links.map((l) => l.equipment_id));
  const linkedRows = account.filter((a) => linkedIds.has(a.id));
  const used = new Set<number>();
  const keep = new Set<number>();
  let first: number | null = null;
  for (const piece of pieces) {
    let hit = claimUnit(piece, [linkedRows, account], used);
    if (!hit) {
      // An older combined unit that names this machine becomes this machine: its checks and photos stay with it.
      const old = linkedRows.find(
        (a) => !used.has(a.id) && combined(a) && listedEquipment(a.equipment_name, catalog).some((n) => sameCatalogModel(n, piece.equipment)),
      );
      if (old) {
        const matched = matchCatalogModel(piece.equipment, piece.equipment, catalog);
        old.catalog_model = matched.catalogModel || piece.equipment;
        old.equipment_name = piece.equipment;
        await sql.query("update account_equipment set catalog_model = $2, equipment_name = $3 where id = $1", [old.id, old.catalog_model, old.equipment_name]);
        hit = old;
      }
    }
    if (hit && combined(hit)) {
      // Matched by model but still labelled with the whole list: show just this machine's name.
      hit.equipment_name = piece.equipment;
      await sql.query("update account_equipment set equipment_name = $2 where id = $1", [hit.id, piece.equipment]);
    }
    let id = hit?.id;
    if (!id) {
      id = await insertEquipment(sql, row.customer, piece.equipment, piece.serial || null, piece.powerVoltage || null);
      hit = {
        id,
        catalog_model: piece.equipment,
        equipment_name: piece.equipment,
        serial: piece.serial || null,
        serial_key: serialKey(piece.serial) || null,
        electrical: piece.powerVoltage || null,
      };
      account.push(hit);
    } else if (hit) {
      await writePieceFields(sql, hit, piece);
    }
    used.add(id);
    keep.add(id);
    if (!first) first = id;
    await linkUnit(sql, installId, id);
  }
  if (first) {
    await sql.query(
      `update install_inspection_items set equipment_id = $1 where install_id = $2 and equipment_id is null`,
      [first, installId],
    );
    await sql.query(
      `update install_inspection_photos set equipment_id = $1 where install_id = $2 and equipment_id is null`,
      [first, installId],
    );
  }
  // Leftover combined units nobody inspected are dropped; anything with a check, note or photo is kept.
  for (const a of linkedRows) {
    if (keep.has(a.id) || !combined(a) || serialKey(a.serial)) continue;
    const touched = await sql.query(
      `select 1 from install_inspection_items where install_id = $2 and equipment_id = $1 and (status <> 'Not inspected' or coalesce(notes, '') <> '')
       union all select 1 from install_inspection_photos where install_id = $2 and equipment_id = $1 limit 1`,
      [a.id, installId],
    );
    if (touched.length) continue;
    // Taken off this install's inspection only; the account's equipment record is left alone.
    await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, a.id]);
    await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, a.id]);
    linkedIds.delete(a.id);
  }
  if (!opts?.prune) return;
  for (const id of linkedIds) {
    if (keep.has(id)) continue;
    if (await unitPassed(sql, installId, id)) continue;
    await sql.query("delete from install_inspection_photos where install_id = $1 and equipment_id = $2", [installId, id]);
    await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, id]);
    await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, id]);
  }
}

async function ensureUnits(sql: Sql, installId: number): Promise<void> {
  await syncInstallUnits(sql, installId);
}

type ItemRow = { install_id: number; equipment_id: number | null; category: string; status: string; notes?: string | null };
type PhotoRow = {
  install_id: number;
  equipment_id: number | null;
  id?: number;
  category: string;
  caption?: string | null;
  data_url?: string;
  uploaded_by?: string | null;
  uploaded_at?: unknown;
};

function machineGroups(items: ItemRow[]): Map<string, ItemRow[]> {
  const map = new Map<string, ItemRow[]>();
  for (const row of items) {
    if (!row.equipment_id) continue;
    const key = `${row.install_id}:${row.equipment_id}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

export async function loadInspectionSummaries(
  sql: Sql,
  ids: number[],
): Promise<Map<number, InspectionSummary>> {
  const map = new Map<number, InspectionSummary>();
  const list = idList(ids);
  if (!list) return map;
  const linked = await sql
    .query<{ install_id: number }>(
      `select distinct install_id from install_inspection_units where install_id in (${list})`,
    )
    .catch(() => []);
  const have = new Set(linked.map((r) => r.install_id));
  for (const id of ids) {
    if (!have.has(id)) await ensureUnits(sql, id).catch(() => undefined);
  }
  const [units, items, photos, heads] = await Promise.all([
    sql.query<{ install_id: number; equipment_id: number; core_needed: string | null; visit_kind: string | null; install_date: unknown }>(
      `select u.install_id, u.equipment_id, u.core_needed, u.visit_kind, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as install_date
         from install_inspection_units u join account_equipment a on a.id = u.equipment_id
        where u.install_id in (${list})`,
    ),
    sql.query<ItemRow>(
      `select install_id, equipment_id, category, status from install_inspection_items where install_id in (${list})`,
    ),
    sql.query<{ install_id: number; equipment_id: number | null; n: number }>(
      `select install_id, equipment_id, count(*)::int as n
         from install_inspection_photos where install_id in (${list})
        group by install_id, equipment_id`,
    ),
    sql.query<{ install_id: number; override_reason: string | null }>(
      `select install_id, override_reason from install_inspections where install_id in (${list})`,
    ),
  ]);
  const grouped = machineGroups(items);
  const photoByUnit = new Map(photos.map((p) => [`${p.install_id}:${p.equipment_id}`, Number(p.n) || 0]));
  const overrides = new Map(heads.map((h) => [h.install_id, h.override_reason]));
  const byInstall = new Map<number, { items: { category: string; status: string }[]; photoCount: number; coreNeeded: string | null; preInspected: boolean }[]>();
  for (const unit of units) {
    const key = `${unit.install_id}:${unit.equipment_id}`;
    const listItems = (grouped.get(key) ?? []).map((i) => ({ category: i.category, status: i.status }));
    const machines = byInstall.get(unit.install_id) ?? [];
    machines.push({
      items: listItems,
      photoCount: photoByUnit.get(key) ?? 0,
      coreNeeded: isCoreHoleAnswer(unit.core_needed) ? unit.core_needed : null,
      preInspected: isPreInspected(unitKind(unit.visit_kind, !!unit.install_date)),
    });
    byInstall.set(unit.install_id, machines);
  }
  for (const id of new Set<number>([...byInstall.keys(), ...overrides.keys()])) {
    map.set(id, rollupSite(byInstall.get(id) ?? [], overrides.get(id)));
  }
  return map;
}

export async function loadInspectionUnits(sql: Sql, ids: number[]): Promise<InspectionUnitRow[]> {
  const list = idList(ids);
  if (!list) return [];
  await loadInspectionSummaries(sql, ids);
  const [units, items, photos] = await Promise.all([
    sql.query<{
      install_id: number;
      equipment_id: number;
      catalog_model: string;
      equipment_name: string;
      serial: string | null;
      electrical: string | null;
      core_needed: string | null;
    }>(
      `select u.install_id, u.equipment_id, a.catalog_model, a.equipment_name, a.serial, a.electrical, u.core_needed, u.visit_kind, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as install_date
         from install_inspection_units u
         join account_equipment a on a.id = u.equipment_id
        where u.install_id in (${list})
        order by u.install_id, a.id`,
    ),
    sql.query<ItemRow>(
      `select install_id, equipment_id, category, status from install_inspection_items where install_id in (${list})`,
    ),
    sql.query<{ install_id: number; equipment_id: number | null; n: number }>(
      `select install_id, equipment_id, count(*)::int as n
         from install_inspection_photos where install_id in (${list})
        group by install_id, equipment_id`,
    ),
  ]);
  const grouped = machineGroups(items);
  const photoByUnit = new Map(photos.map((p) => [`${p.install_id}:${p.equipment_id}`, Number(p.n) || 0]));
  return units.map((u) => {
    const key = `${u.install_id}:${u.equipment_id}`;
    const rows = grouped.get(key) ?? [];
    const unitItems = rows.map((i) => ({ category: i.category, status: i.status }));
    const coreNeeded = isCoreHoleAnswer(u.core_needed) ? u.core_needed : null;
    const preInspected = isPreInspected(unitKind((u as { visit_kind?: string | null }).visit_kind, !!(u as { install_date?: unknown }).install_date));
    const summary = rollupSite([{ items: unitItems, photoCount: photoByUnit.get(key) ?? 0, coreNeeded, preInspected }], null);
    const one = preInspected ? "Passed" : summary.machineCount ? inspectionOverall(unitItems, coreNeeded) : "Not started";
    const coreRow = rows.find((i) => i.category === CORE_HOLE_CATEGORY);
    return {
      installId: u.install_id,
      equipmentId: u.equipment_id,
      model: u.equipment_name || u.catalog_model,
      serial: u.serial,
      electrical: u.electrical,
      overall: one,
      failedItems: summary.failedItems,
      photoCount: photoByUnit.get(key) ?? 0,
      coreNeeded,
      coreStatus: coreNeeded === "yes" ? (isInspectionItemStatus(coreRow?.status) ? coreRow.status : "Not inspected") : null,
      preInspected,
    };
  });
}

export async function withInspections<T extends { id: number }>(
  sql: Sql,
  rows: T[],
): Promise<(T & { inspection: InspectionSummary })[]> {
  const map = await loadInspectionSummaries(
    sql,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({ ...r, inspection: map.get(r.id) ?? emptyInspection() }));
}

async function ensureHead(sql: Sql, installId: number): Promise<void> {
  await sql.query(
    `insert into install_inspections (install_id) values ($1) on conflict (install_id) do nothing`,
    [installId],
  );
}

function mapPhoto(r: PhotoRow): InspectionPhoto | null {
  const category = String(r.category ?? "");
  if (!isSavableCategory(category) || !r.equipment_id || !r.id) return null;
  return {
    id: Number(r.id),
    equipmentId: r.equipment_id,
    category,
    caption: r.caption ?? null,
    dataUrl: String(r.data_url ?? ""),
    uploadedBy: r.uploaded_by ?? null,
    uploadedAt: stamp(r.uploaded_at),
  };
}

export async function readInspection(sql: Sql, installId: number): Promise<InspectionView | null> {
  const install = await sql.query<{ id: number; customer: string }>(
    "select id, customer from installs where id = $1 and archived = false",
    [installId],
  );
  if (!install[0]) return null;
  await ensureUnits(sql, installId);
  const [head, units, items, photos] = await Promise.all([
    sql.query<{
      inspector: string | null;
      inspected_on: string | null;
      site_contact: string | null;
      notes: string | null;
      override_reason: string | null;
      override_by: string | null;
    }>(
      `select inspector, inspected_on, site_contact, notes, override_reason, override_by
         from install_inspections where install_id = $1`,
      [installId],
    ),
    sql.query<{
      equipment_id: number;
      catalog_model: string;
      equipment_name: string;
      serial: string | null;
      electrical: string | null;
      core_needed: string | null;
      visit_kind: string | null;
      reqs_same: boolean | null;
      core_model: string | null;
      from_name: string | null;
      from_serial: string | null;
      note: string | null;
      install_date: unknown;
    }>(
      `select u.equipment_id, a.catalog_model, a.equipment_name, a.serial, a.electrical, u.core_needed, u.note, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as install_date,
              u.visit_kind, u.reqs_same, u.core_model, f.equipment_name as from_name, f.serial as from_serial
         from install_inspection_units u
         join account_equipment a on a.id = u.equipment_id
         left join account_equipment f on f.id = u.copied_from_equipment
        where u.install_id = $1
        order by a.id`,
      [installId],
    ),
    sql.query<ItemRow>(
      `select install_id, equipment_id, category, status, notes
         from install_inspection_items where install_id = $1`,
      [installId],
    ),
    sql.query<PhotoRow>(
      `select id, install_id, equipment_id, category, caption, data_url, uploaded_by, uploaded_at
         from install_inspection_photos where install_id = $1 order by uploaded_at, id`,
      [installId],
    ),
  ]);
  const mapped = photos.map(mapPhoto).filter((p): p is InspectionPhoto => !!p);
  const h = head[0];
  const machines: InspectionMachine[] = units.map((u) => {
    const unitItems = items.filter((i) => i.equipment_id === u.equipment_id);
    const unitPhotos = mapped.filter((p) => p.equipmentId === u.equipment_id);
    const inputs = unitItems.map((i) => ({ category: i.category, status: i.status }));
    const coreNeeded = isCoreHoleAnswer(u.core_needed) ? u.core_needed : null;
    const visitKind = unitKind(u.visit_kind, !!u.install_date);
    const preInspected = isPreInspected(visitKind);
    const overall = preInspected ? "Passed" : inspectionOverall(inputs, coreNeeded);
    const model = u.equipment_name || u.catalog_model;
    const coreRow = unitItems.find((i) => i.category === CORE_HOLE_CATEGORY);
    const coreStatus = isInspectionItemStatus(coreRow?.status) ? coreRow.status : "Not inspected";
    return {
      equipmentId: u.equipment_id,
      name: model,
      model: u.catalog_model || model,
      serial: u.serial,
      electrical: u.electrical,
      overall,
      failedItems: preInspected ? [] : failedItemLabels(inputs, coreNeeded),
      photoCount: unitPhotos.length,
      thumb: unitPhotos[0]?.dataUrl ?? null,
      visitKind,
      preInspected,
      note: u.note ?? null,
      reqsSame: u.visit_kind === "replace" && u.reqs_same != null ? !!u.reqs_same : null,
      copiedFrom: u.from_name ? [u.from_name, u.from_serial ? `SN ${u.from_serial}` : null].filter(Boolean).join(" · ") : null,
      coreModel: u.core_model ?? null,
      coreNeeded,
      core: {
        category: CORE_HOLE_CATEGORY,
        label: CORE_HOLE_LABEL,
        hint: categoryHint(CORE_HOLE_CATEGORY, { model, electrical: u.electrical }),
        status: coreStatus,
        notes: coreRow?.notes ?? null,
        photos: unitPhotos.filter((p) => p.category === CORE_HOLE_CATEGORY),
      },
      items: INSPECTION_CATEGORIES.map((c) => {
        const row = unitItems.find((i) => i.category === c.key);
        const status = isInspectionItemStatus(row?.status) ? row.status : "Not inspected";
        return {
          category: c.key,
          label: c.label,
          hint: categoryHint(c.key, { model, electrical: u.electrical }),
          status,
          notes: row?.notes ?? null,
          photos: unitPhotos.filter((p) => p.category === c.key),
        };
      }),
    };
  });
  const summary = rollupSite(
    machines.map((m) => ({
      items: items
        .filter((i) => i.equipment_id === m.equipmentId)
        .map((i) => ({ category: i.category, status: i.status })),
      photoCount: m.photoCount,
      coreNeeded: m.coreNeeded,
      preInspected: m.preInspected,
    })),
    h?.override_reason,
  );
  return {
    installId,
    customer: install[0].customer,
    ...summary,
    inspector: h?.inspector ?? null,
    inspectedOn: day(h?.inspected_on),
    siteContact: h?.site_contact ?? null,
    notes: h?.notes ?? null,
    overrideBy: h?.override_by ?? null,
    machines,
  };
}

async function requireInstall(sql: Sql, installId: number): Promise<{ id: number; customer: string }> {
  const install = await sql.query<{ id: number; customer: string }>(
    "select id, customer from installs where id = $1 and archived = false",
    [installId],
  );
  if (!install[0]) throw new Error("Install not found");
  return install[0];
}

async function requireUnit(sql: Sql, installId: number, equipmentId: number): Promise<void> {
  const row = await sql.query<{ equipment_id: number }>(
    "select equipment_id from install_inspection_units where install_id = $1 and equipment_id = $2",
    [installId, equipmentId],
  );
  if (!row[0]) throw new Error("That machine is not on this visit.");
}

const idInput = z.object({ installId: z.number().int().positive() });

export const getInstallInspection = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof idInput>) => idInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    const sql = await ready();
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const itemInput = z.object({
  installId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
  category: z.string(),
  status: z.string(),
  notes: z.string().nullable().optional(),
});

export const saveInspectionItem = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof itemInput>) => itemInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    if (!isSavableCategory(data.category)) throw new Error("Unknown checklist item.");
    if (!isInspectionItemStatus(data.status)) throw new Error("Pick a status.");
    const sql = await ready();
    await requireInstall(sql, data.installId);
    await ensureUnits(sql, data.installId);
    await requireUnit(sql, data.installId, data.equipmentId);
    const photos = await sql.query<{ n: number }>(
      `select count(*)::int as n from install_inspection_photos
        where install_id = $1 and equipment_id = $2 and category = $3`,
      [data.installId, data.equipmentId, data.category],
    );
    const notes = data.notes ?? null;
    const photoCount = Number(photos[0]?.n) || 0;
    if (data.category === "space") {
      const unit = await sql.query<{ core_needed: string | null }>(
        `select core_needed from install_inspection_units where install_id = $1 and equipment_id = $2`,
        [data.installId, data.equipmentId],
      );
      const err = spacePassError({
        status: data.status,
        notes,
        photoCount,
        coreNeeded: unit[0]?.core_needed,
      });
      if (err) throw new Error(err);
    } else {
      const err = itemSaveError({ status: data.status, notes, photoCount });
      if (err) throw new Error(err);
    }
    await ensureHead(sql, data.installId);
    await sql.query(
      `insert into install_inspection_items (install_id, equipment_id, category, status, notes)
       values ($1, $2, $3, $4, $5)
       on conflict (install_id, equipment_id, category)
       do update set status = excluded.status, notes = excluded.notes, updated_at = now()`,
      [data.installId, data.equipmentId, data.category, data.status, notes?.trim() || null],
    );
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const coreInput = z.object({
  installId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
  answer: z.enum(["yes", "no"]),
});

export const saveInspectionCoreHole = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof coreInput>) => coreInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    const sql = await ready();
    await requireInstall(sql, data.installId);
    await ensureUnits(sql, data.installId);
    await requireUnit(sql, data.installId, data.equipmentId);
    await sql.query(
      `update install_inspection_units set core_needed = $3 where install_id = $1 and equipment_id = $2`,
      [data.installId, data.equipmentId, data.answer],
    );
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const metaInput = z.object({
  installId: z.number().int().positive(),
  inspector: z.string().nullable().optional(),
  inspectedOn: z.string().nullable().optional(),
  siteContact: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  overrideReason: z.string().nullable().optional(),
});

export const saveInspectionMeta = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof metaInput>) => metaInput.parse(d))
  .handler(async ({ data, context }): Promise<InspectionView> => {
    const sql = await ready();
    await requireInstall(sql, data.installId);
    await ensureHead(sql, data.installId);
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (data.inspector !== undefined) add("inspector", data.inspector?.trim() || null);
    if (data.inspectedOn !== undefined) add("inspected_on", day(data.inspectedOn));
    if (data.siteContact !== undefined) add("site_contact", data.siteContact?.trim() || null);
    if (data.notes !== undefined) add("notes", data.notes?.trim() || null);
    if (data.overrideReason !== undefined) {
      const reason = data.overrideReason?.trim() || null;
      add("override_reason", reason);
      add("override_by", reason ? await deskUsername(sql, context.userId) : null);
    }
    if (sets.length) {
      params.push(data.installId);
      await sql.query(
        `update install_inspections set ${sets.join(", ")}, updated_at = now() where install_id = $${params.length}`,
        params,
      );
    }
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const photoInput = z.object({
  installId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
  category: z.string(),
  dataUrl: z.string().min(32),
  caption: z.string().nullable().optional(),
});

export const addInspectionPhoto = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof photoInput>) => photoInput.parse(d))
  .handler(async ({ data, context }): Promise<InspectionView> => {
    if (!isSavableCategory(data.category)) throw new Error("Unknown checklist item.");
    if (!data.dataUrl.startsWith("data:image/")) throw new Error("Upload a photo.");
    if (data.dataUrl.length > MAX_PHOTO) throw new Error("Photo is too large. Try a smaller image.");
    const sql = await ready();
    await requireInstall(sql, data.installId);
    await ensureUnits(sql, data.installId);
    await requireUnit(sql, data.installId, data.equipmentId);
    const count = await sql.query<{ n: number }>(
      `select count(*)::int as n from install_inspection_photos
        where install_id = $1 and equipment_id = $2 and category = $3`,
      [data.installId, data.equipmentId, data.category],
    );
    if ((Number(count[0]?.n) || 0) >= 12) throw new Error(`12 photos is the limit for ${categoryLabel(data.category)}.`);
    await ensureHead(sql, data.installId);
    const mime = data.dataUrl.slice(5, data.dataUrl.indexOf(";")) || "image/jpeg";
    await sql.query(
      `insert into install_inspection_photos
         (install_id, equipment_id, category, caption, mime, data_url, uploaded_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.installId,
        data.equipmentId,
        data.category,
        data.caption?.trim() || null,
        mime,
        data.dataUrl,
        await deskUsername(sql, context.userId),
      ],
    );
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const removePhotoInput = z.object({
  installId: z.number().int().positive(),
  photoId: z.number().int().positive(),
});

export const removeInspectionPhoto = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof removePhotoInput>) => removePhotoInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    const sql = await ready();
    await sql.query("delete from install_inspection_photos where id = $1 and install_id = $2", [
      data.photoId,
      data.installId,
    ]);
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const addEquipInput = z.object({
  installId: z.number().int().positive(),
  model: z.string().min(1),
  serial: z.string().nullable().optional(),
  electrical: z.string().nullable().optional(),
});

export const addInspectionEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof addEquipInput>) => addEquipInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    const sql = await ready();
    const install = await requireInstall(sql, data.installId);
    await ensureUnits(sql, data.installId);
    const key = serialKey(data.serial);
    if (key) {
      const existing = await sql.query<{ id: number }>(
        `select id from account_equipment where lower(customer) = lower($1) and serial_key = $2`,
        [install.customer, key],
      );
      if (existing[0]) {
        const linked = await sql.query(
          "select equipment_id from install_inspection_units where install_id = $1 and equipment_id = $2",
          [data.installId, existing[0].id],
        );
        if (linked[0]) throw new Error("That serial is already on this visit.");
        await linkUnit(sql, data.installId, existing[0].id);
        const view = await readInspection(sql, data.installId);
        if (!view) throw new Error("Install not found");
        return view;
      }
    }
    const id = await insertEquipment(sql, install.customer, data.model, data.serial ?? null, data.electrical ?? null);
    await linkUnit(sql, data.installId, id);
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const copyInput = z.object({
  installId: z.number().int().positive(),
  fromEquipmentId: z.number().int().positive(),
  toEquipmentId: z.number().int().positive(),
});

export const copyInspectionNa = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof copyInput>) => copyInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    if (data.fromEquipmentId === data.toEquipmentId) throw new Error("Pick a different machine.");
    const sql = await ready();
    await requireInstall(sql, data.installId);
    await requireUnit(sql, data.installId, data.fromEquipmentId);
    await requireUnit(sql, data.installId, data.toEquipmentId);
    const source = await sql.query<{ category: string; status: string; notes: string | null }>(
      `select category, status, notes from install_inspection_items
        where install_id = $1 and equipment_id = $2 and status = 'N/A'`,
      [data.installId, data.fromEquipmentId],
    );
    if (!source.length) throw new Error("That machine has no N/A lines to copy.");
    const target = await sql.query<{ category: string; status: string }>(
      `select category, status from install_inspection_items where install_id = $1 and equipment_id = $2`,
      [data.installId, data.toEquipmentId],
    );
    await ensureHead(sql, data.installId);
    for (const row of source) {
      if (row.category === CORE_HOLE_CATEGORY) continue;
      if (!isInspectionCategory(row.category)) continue;
      const current = target.find((t) => t.category === row.category);
      if (current && current.status !== "Not inspected") continue;
      await sql.query(
        `insert into install_inspection_items (install_id, equipment_id, category, status, notes)
         values ($1, $2, $3, 'N/A', $4)
         on conflict (install_id, equipment_id, category)
         do update set status = 'N/A', notes = excluded.notes, updated_at = now()
         where install_inspection_items.status = 'Not inspected'`,
      [data.installId, data.toEquipmentId, row.category, row.notes],
      );
    }
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const visitInput = z.object({
  installId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
  kind: z.enum(["new", "replace", "existing"]),
  /** Replacing only. false = requirements differ: the normal form opens and nothing is copied. */
  reqsSame: z.boolean().nullable().optional(),
});

/** New install or replacing existing equipment. Results already saved on the unit are never removed. */
export const setInspectionVisit = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof visitInput>) => visitInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    const sql = await ready();
    await requireInstall(sql, data.installId);
    await ensureUnits(sql, data.installId);
    await requireUnit(sql, data.installId, data.equipmentId);
    await sql.query(
      `update install_inspection_units set visit_kind = $3, reqs_same = $4 where install_id = $1 and equipment_id = $2`,
      // "replace" from an older screen is saved as existing: the two are one choice.
      [data.installId, data.equipmentId, data.kind === "replace" ? "existing" : data.kind, null],
    );
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

const unitInput = z.object({ installId: z.number().int().positive(), equipmentId: z.number().int().positive() });

const noteInput = z.object({ installId: z.number().int().positive(), equipmentId: z.number().int().positive(), note: z.string().max(2000).nullable() });

// Existing equipment is recognised on its own only when the account already holds that exact unit: a serial and an
// install date. A unit with no serial is never assumed to be existing — someone picks Existing Equipment for it.

/** An optional note on the unit itself — the only thing to fill in for existing equipment. */
export const saveInspectionUnitNote = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof noteInput>) => noteInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    const sql = await ready();
    await requireInstall(sql, data.installId);
    await requireUnit(sql, data.installId, data.equipmentId);
    await sql.query("update install_inspection_units set note = $3 where install_id = $1 and equipment_id = $2", [data.installId, data.equipmentId, data.note?.trim() || null]);
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });

async function replaceSources(sql: Sql, installId: number, equipmentId: number, customer: string): Promise<ReplaceSource[]> {
  const units = await sql.query<{ install_id: number; equipment_id: number; equipment_name: string; catalog_model: string; serial: string | null; core_needed: string | null }>(
    `select u.install_id, u.equipment_id, a.equipment_name, a.catalog_model, a.serial, u.core_needed
       from install_inspection_units u
       join installs i on i.id = u.install_id
       join account_equipment a on a.id = u.equipment_id
      where lower(i.customer) = lower($3)
        and not (u.install_id = $1 and u.equipment_id = $2)
        and exists (select 1 from install_inspection_items t
                     where t.install_id = u.install_id and t.equipment_id = u.equipment_id and t.status <> 'Not inspected')
      order by u.install_id desc, a.id`,
    [installId, equipmentId, customer],
  );
  const out: ReplaceSource[] = [];
  for (const u of units) {
    const items = await sql.query<{ category: string; status: string }>(
      "select category, status from install_inspection_items where install_id = $1 and equipment_id = $2",
      [u.install_id, u.equipment_id],
    );
    const photos = await sql.query<{ n: number }>(
      "select count(*)::int as n from install_inspection_photos where install_id = $1 and equipment_id = $2",
      [u.install_id, u.equipment_id],
    );
    out.push({
      installId: Number(u.install_id),
      equipmentId: Number(u.equipment_id),
      name: u.equipment_name || u.catalog_model,
      serial: u.serial,
      overall: inspectionOverall(items, isCoreHoleAnswer(u.core_needed) ? u.core_needed : null),
      photoCount: Number(photos[0]?.n) || 0,
    });
  }
  return out;
}

/** Existing equipment on this account whose pre-inspection can be copied onto a replacement unit. */
export const listReplaceSources = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof unitInput>) => unitInput.parse(d))
  .handler(async ({ data }): Promise<ReplaceSource[]> => {
    const sql = await ready();
    const install = await requireInstall(sql, data.installId);
    return replaceSources(sql, data.installId, data.equipmentId, install.customer);
  });

const copyFromInput = unitInput.extend({ fromInstallId: z.number().int().positive(), fromEquipmentId: z.number().int().positive() });

/**
 * Replacing existing equipment with the same site requirements: the existing unit's pass/fail, notes,
 * photos and core hole (answer, check and the size already in the counter) are copied onto this unit.
 * Nothing has to be re-shot; any one item can still be changed afterwards.
 */
export const copyInspectionFromExisting = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof copyFromInput>) => copyFromInput.parse(d))
  .handler(async ({ data }): Promise<InspectionView> => {
    const sql = await ready();
    const install = await requireInstall(sql, data.installId);
    await ensureUnits(sql, data.installId);
    await requireUnit(sql, data.installId, data.equipmentId);
    const sources = await replaceSources(sql, data.installId, data.equipmentId, install.customer);
    if (!sources.some((s) => s.installId === data.fromInstallId && s.equipmentId === data.fromEquipmentId)) {
      throw new Error("That unit has no pre-inspection on this account to copy.");
    }
    const from = await sql.query<{ core_needed: string | null; core_model: string | null; catalog_model: string; equipment_name: string }>(
      `select u.core_needed, u.core_model, a.catalog_model, a.equipment_name
         from install_inspection_units u join account_equipment a on a.id = u.equipment_id
        where u.install_id = $1 and u.equipment_id = $2`,
      [data.fromInstallId, data.fromEquipmentId],
    );
    await ensureHead(sql, data.installId);
    await sql.query(
      `insert into install_inspection_items (install_id, equipment_id, category, status, notes)
       select $1, $2, category, status, notes from install_inspection_items
        where install_id = $3 and equipment_id = $4 and status <> 'Not inspected'
       on conflict (install_id, equipment_id, category)
       do update set status = excluded.status, notes = excluded.notes, updated_at = now()`,
      [data.installId, data.equipmentId, data.fromInstallId, data.fromEquipmentId],
    );
    // Photos are copied once per line: a line that already has its own photos keeps them.
    await sql.query(
      `insert into install_inspection_photos (install_id, equipment_id, category, caption, mime, data_url, uploaded_by)
       select $1, $2, p.category, p.caption, p.mime, p.data_url, p.uploaded_by
         from install_inspection_photos p
        where p.install_id = $3 and p.equipment_id = $4
          and not exists (select 1 from install_inspection_photos t
                           where t.install_id = $1 and t.equipment_id = $2 and t.category = p.category)
        order by p.uploaded_at, p.id`,
      [data.installId, data.equipmentId, data.fromInstallId, data.fromEquipmentId],
    );
    const hole = from[0]?.core_needed === "yes" ? from[0].core_model || from[0].catalog_model || from[0].equipment_name : null;
    await sql.query(
      `update install_inspection_units
          set visit_kind = 'replace', reqs_same = true, copied_from_install = $3, copied_from_equipment = $4,
              core_needed = coalesce($5, core_needed), core_model = $6
        where install_id = $1 and equipment_id = $2`,
      [data.installId, data.equipmentId, data.fromInstallId, data.fromEquipmentId, isCoreHoleAnswer(from[0]?.core_needed) ? from[0]!.core_needed : null, hole],
    );
    const view = await readInspection(sql, data.installId);
    if (!view) throw new Error("Install not found");
    return view;
  });
