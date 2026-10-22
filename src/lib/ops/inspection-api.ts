import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { matchCatalogModel, sameCatalogModel, serialKey } from "@/lib/ops/account-equip";
import { catalogModels, isTrailingWord, joinEquipment, listedEquipment, matchModel } from "@/lib/ops/equipment";
import { SERIAL_LINE, SUFFIX_ONLY, installMachines, serializeMachines, type MachineSpec } from "@/lib/ops/machines";
import { assertUnlocked, canLockEquipment, lockOwnerName } from "@/lib/ops/equipment-lock";
import { isLocked, lockedBy, lockedMessage } from "@/lib/ops/equipment-lock-rules";
import { readsAsModel } from "@/lib/ops/warehouse-serial";
import { adoptUnitIds } from "@/lib/ops/install-form";
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
  unitCategories,
  unitType,
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

/** The checks this unit uses, read from its catalog model, then its name on the account. */
export function unitChecks(u: { catalog_model?: string | null; equipment_name?: string | null }): InspectionCategory[] {
  const catalog = (u.catalog_model ?? "").trim();
  if (catalog && unitType(catalog) !== "other") return unitCategories(catalog);
  return unitCategories(u.equipment_name || catalog);
}

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
  /** Locked by the owner: Remove is off until it is unlocked. */
  locked: boolean;
  lockedBy: string | null;
  /** On the install's equipment list too. False flags a unit only the pre-inspection has, for review. */
  onList: boolean;
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

/**
 * One machine row with everything it carries (recipe, ownership, plug, water, the deal's tie). Matching reads only
 * the model, serial and voltage; a list written back keeps the rest, or the board and deal ties break.
 */
type Piece = MachineSpec;

/**
 * One piece per machine, the same list the install window shows (installMachines): split catalog-aware, so
 * "Linea / Swift / Axiom-APS" on one line is three machines, and a line that is only a serial ("SN:231515042") is
 * the serial of the machine above it, not a machine. A bare suffix ("-DV") saved as its own machine is dropped.
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
  return installMachines({ ...row, machines: text(row.machines) || null }, catalog).machines;
}

type AcctUnit = {
  id: number;
  catalog_model: string;
  equipment_name: string;
  serial: string | null;
  serial_key: string | null;
  electrical: string | null;
  /** Set when the account record holds an installed unit: a load never rewrites its serial. */
  install_date?: unknown;
  /** Locked by the owner: the load still claims it, but never rewrites or deletes it. */
  locked_at?: unknown;
  locked_by?: string | null;
};

/** The same list the board and the install window read (loadEquipCatalog): directory names and warehouse models. */
export async function catalogNames(sql: Sql): Promise<string[]> {
  const rows = await sql
    .query<{ name: string }>(
      `select name from directory_equipment where archived = false and coalesce(name, '') <> ''
       union select distinct model as name from assets where kind = 'equip' and coalesce(model, '') <> ''`,
    )
    .catch(() => []);
  return catalogModels(rows.map((r) => r.name));
}

/**
 * The account's record goes only when nothing else uses it: no serial or install date, no visit, photo, module,
 * PM runbook link or runbook history ('acct:<id>'), not copied onto another visit, not locked. With `madeBy`, only
 * when that install's load made it: the prune never deletes a unit that was on the account before.
 */
async function dropUnusedUnit(sql: Sql, id: number, opts?: { madeBy?: number }): Promise<void> {
  await sql
    .query(
      `delete from account_equipment a where a.id = $1 and a.install_date is null and coalesce(a.serial_key, '') = ''
          and ($2::int is null or a.created_by_install = $2::int)
          and not exists (select 1 from install_inspection_units u where u.equipment_id = a.id or u.copied_from_equipment = a.id)
          and not exists (select 1 from install_inspection_photos p where p.equipment_id = a.id)
          and not exists (select 1 from modules m where m.assigned_unit_id = a.id)
          and not exists (select 1 from pm_runbook_unit_links l where l.account_equipment_id = a.id)
          and not exists (select 1 from pm_runbook_units r where r.unit_key = 'acct:' || a.id)
          and not exists (select 1 from pm_runbook_checks c where c.unit_key = 'acct:' || a.id)
          and not exists (select 1 from unit_runbook_options o where o.unit_key = 'acct:' || a.id)
          and a.locked_at is null`,
      [id, opts?.madeBy ?? null],
    )
    .catch(() => undefined);
}

async function insertEquipment(
  sql: Sql,
  installId: number,
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
    `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, electrical, created_by_install)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [customer, catalogModel, model.trim() || catalogModel, serial?.trim() || null, key, electrical?.trim() || null, installId],
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
  if (isLocked(hit)) return;
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

function claimUnit(piece: Piece, pools: AcctUnit[][], used: Set<number>, catalog: string[] = []): AcctUnit | undefined {
  // The row's catalog name: a unit added on Pre-inspection under "Eversys Cameo c'2s - 2 Step Classic" is the row "Eversys Cameo c'2s".
  const catalogModel = catalog.length ? matchCatalogModel(piece.equipment, piece.equipment, catalog).catalogModel : null;
  const key = serialKey(piece.serial);
  if (key) {
    for (const pool of pools) {
      const hit = pool.find((a) => !used.has(a.id) && a.serial_key === key);
      if (hit) return hit;
    }
  }
  const power = piece.powerVoltage.trim();
  for (const pool of pools) {
    // The account row keeps the catalog name ("Bunn ITCB-DV, 29\" w/Flip Tray") and the name from the install
    // ("Bunn ITCB"). Either one is the same machine; matching only the catalog name added a new unit on every load.
    const fits = (a: AcctUnit) =>
      !used.has(a.id) &&
      (sameCatalogModel(a.catalog_model, piece.equipment) ||
        sameCatalogModel(a.equipment_name, piece.equipment) ||
        (!!catalogModel && sameCatalogModel(a.catalog_model, catalogModel))) &&
      !serialKey(a.serial);
    // Two machines of one model told apart by voltage: the unit with this row's voltage first.
    const hit = (power && pool.find((a) => fits(a) && (a.electrical ?? "").trim() === power)) || pool.find(fits);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The second pass, for a piece nothing claimed by serial or model: a unit on this visit saved under an earlier
 * spelling of the row ("Fetco 1251" for "Fetco 1251 Plus", before the warehouse models were in the catalog). It runs
 * after every piece had its exact match, so "Acme Brewer Twin" never takes the "Acme Brewer" unit from its own row.
 */
function claimEarlierName(piece: Piece, linked: AcctUnit[], used: Set<number>, catalog: string[]): AcctUnit | undefined {
  return linked.find(
    (a) =>
      !used.has(a.id) &&
      !serialKey(a.serial) &&
      (readsAsModel(a.equipment_name, piece.equipment, catalog) || readsAsModel(a.catalog_model, piece.equipment, catalog)),
  );
}

/**
 * This install's own unit for a piece nothing else claims: the same model, with a serial no piece on the list has any
 * more. The serial was corrected or cleared on the row, or changed on the account; it is still the same machine.
 */
function ownUnit(piece: Piece, pieces: Piece[], linked: AcctUnit[], used: Set<number>): AcctUnit | undefined {
  const keys = new Set(pieces.map((p) => serialKey(p.serial)).filter(Boolean));
  return linked.find(
    (a) =>
      !used.has(a.id) &&
      !!serialKey(a.serial) &&
      !keys.has(serialKey(a.serial)) &&
      (sameCatalogModel(a.catalog_model, piece.equipment) || sameCatalogModel(a.equipment_name, piece.equipment)),
  );
}

/**
 * The rows that name their unit outright: an exact serial first (typing another unit's serial makes the row that unit),
 * then the unit the row already carries by id, so a blank, partial or corrected serial, or a renamed model, keeps the row
 * on its own unit. Fills `hits` from `pools` in order, and answers which rows were claimed by their id.
 */
function claimNamed(pieces: Piece[], hits: (AcctUnit | undefined)[], pools: AcctUnit[][], used: Set<number>): boolean[] {
  const byId = pieces.map(() => false);
  pieces.forEach((piece, i) => {
    const key = serialKey(piece.serial);
    if (hits[i] || !key) return;
    for (const pool of pools) {
      const hit = pool.find((a) => !used.has(a.id) && a.serial_key === key);
      if (!hit) continue;
      hits[i] = hit;
      used.add(hit.id);
      return;
    }
  });
  pieces.forEach((piece, i) => {
    if (hits[i] || !piece.unitId) return;
    for (const pool of pools) {
      const hit = pool.find((a) => a.id === piece.unitId && !used.has(a.id));
      if (!hit) continue;
      hits[i] = hit;
      used.add(hit.id);
      byId[i] = true;
      return;
    }
  });
  return byId;
}

/**
 * Twins: rows of one model and voltage with no serial, on units with no serial, can't be told apart. Among those rows
 * and this model's units no row has, the units go in `priority` order (anything recorded first, then the oldest), so a
 * save that drops one of the rows keeps the inspected unit and the empty twin goes, whichever row was taken off. A
 * locked unit is never moved.
 */
function settleTwins(pieces: Piece[], hits: (AcctUnit | undefined)[], priority: AcctUnit[]): void {
  const rank = new Set(priority.map((a) => a.id));
  const volts = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const plain = (i: number) => {
    const hit = hits[i];
    return !!hit && rank.has(hit.id) && !serialKey(pieces[i]!.serial) && !serialKey(hit.serial);
  };
  const done = new Set<number>();
  for (let i = 0; i < pieces.length; i++) {
    if (done.has(i) || !plain(i)) continue;
    const model = hits[i]!.catalog_model;
    const power = volts(pieces[i]!.powerVoltage);
    const group = pieces
      .map((_, j) => j)
      .filter((j) => !done.has(j) && plain(j) && sameCatalogModel(hits[j]!.catalog_model, model) && volts(pieces[j]!.powerVoltage) === power);
    for (const j of group) done.add(j);
    if (group.some((j) => isLocked(hits[j]))) continue;
    const taken = new Set(hits.filter((h): h is AcctUnit => !!h).map((h) => h.id));
    const own = new Set(group.map((j) => hits[j]!.id));
    const free = (a: AcctUnit) =>
      !taken.has(a.id) && !isLocked(a) && !serialKey(a.serial) && sameCatalogModel(a.catalog_model, model) && (!power || !volts(a.electrical) || volts(a.electrical) === power);
    const pool = priority.filter((a) => own.has(a.id) || free(a)).slice(0, group.length);
    group.forEach((j, n) => {
      hits[j] = pool[n]!;
    });
  }
}

/** Which linked unit each piece is: the matching the load uses (its id or exact serial, then by model). -1 when a piece has none. */
function claimLinked(pieces: Piece[], linked: AcctUnit[], catalog: string[]): number[] {
  const used = new Set<number>();
  const hits: (AcctUnit | undefined)[] = pieces.map(() => undefined);
  claimNamed(pieces, hits, [linked], used);
  pieces.forEach((piece, i) => {
    if (hits[i]) return;
    const hit = claimUnit(piece, [linked], used, catalog);
    if (!hit) return;
    used.add(hit.id);
    hits[i] = hit;
  });
  pieces.forEach((piece, i) => {
    if (hits[i]) return;
    const other = claimEarlierName(piece, linked, used, catalog) ?? ownUnit(piece, pieces, linked, used);
    if (!other) return;
    used.add(other.id);
    hits[i] = other;
  });
  settleTwins(pieces, hits, linked);
  return hits.map((h) => h?.id ?? -1);
}

/** The row a list had for this unit: the one that names it by id, else the one the load gives it. */
function rowOfUnit(pieces: Piece[], linked: AcctUnit[], catalog: string[], equipmentId: number): Piece | null {
  const named = pieces.find((p) => p.unitId === equipmentId);
  if (named) return named;
  const at = claimLinked(pieces, linked, catalog).indexOf(equipmentId);
  return at >= 0 ? pieces[at]! : null;
}

/** Units with a check, note, photo or answer on this visit. */
async function recordedUnits(sql: Sql, installId: number): Promise<Set<number>> {
  const rows = await sql.query<{ equipment_id: number }>(
    `select equipment_id from install_inspection_items where install_id = $1 and (status <> 'Not inspected' or coalesce(notes, '') <> '')
     union select equipment_id from install_inspection_photos where install_id = $1
     union select equipment_id from install_inspection_units where install_id = $1 and (coalesce(note, '') <> '' or coalesce(visit_kind, '') <> '' or coalesce(core_needed, '') <> '')`,
    [installId],
  );
  return new Set(rows.map((r) => r.equipment_id));
}

/** The units on this visit in the order the load claims them: anything recorded first, then oldest. */
async function linkedUnits(sql: Sql, installId: number): Promise<AcctUnit[]> {
  const [linked, recorded] = await Promise.all([
    sql.query<AcctUnit>(
      `select a.id, a.catalog_model, a.equipment_name, a.serial, a.serial_key, a.electrical, a.locked_at, a.locked_by
         from install_inspection_units u join account_equipment a on a.id = u.equipment_id
        where u.install_id = $1 order by a.id`,
      [installId],
    ),
    recordedUnits(sql, installId),
  ]);
  return linked.sort((a, b) => Number(recorded.has(b.id)) - Number(recorded.has(a.id)) || a.id - b.id);
}

/**
 * Where this unit is on the install's list: the piece the load gives it, else the only piece of its model that no other
 * unit on the visit claims. -1 when it is not on the list.
 */
function listIndexOf(pieces: Piece[], linked: AcctUnit[], catalog: string[], equipmentId: number): number {
  const claims = claimLinked(pieces, linked, catalog);
  const at = claims.indexOf(equipmentId);
  if (at >= 0) return at;
  const unit = linked.find((a) => a.id === equipmentId);
  if (!unit) return -1;
  const open = pieces
    .map((piece, i) => ({ piece, i }))
    .filter(({ piece, i }) => {
      if (claims[i]! >= 0) return false;
      const model = catalog.length ? matchCatalogModel(piece.equipment, piece.equipment, catalog).catalogModel : null;
      return (
        sameCatalogModel(unit.catalog_model, piece.equipment) ||
        sameCatalogModel(unit.equipment_name, piece.equipment) ||
        (!!model && sameCatalogModel(unit.catalog_model, model))
      );
    });
  return open.length === 1 ? open[0]!.i : -1;
}

/**
 * Take one unit off a visit: its checks, photos and link. The account's record goes too when nothing else uses it;
 * with `madeBy`, only when that install's load made it.
 */
async function unlinkUnit(sql: Sql, installId: number, equipmentId: number, opts?: { madeBy?: number }): Promise<void> {
  await sql.query("delete from install_inspection_photos where install_id = $1 and equipment_id = $2", [installId, equipmentId]);
  await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, equipmentId]);
  await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, equipmentId]);
  await dropUnusedUnit(sql, equipmentId, opts);
}

/** Write the machine rows back as they are: recipe, ownership, plug, water and the deal's tie included. */
async function writeList(sql: Sql, installId: number, pieces: MachineSpec[]): Promise<void> {
  const packed = serializeMachines(pieces);
  await sql.query("update installs set equipment = $2, machines = $3, serial = $4, power_voltage = $5, updated_at = now() where id = $1", [
    installId,
    packed.equipment,
    packed.machines,
    packed.serial,
    packed.powerVoltage,
  ]);
}

type ListRow = { equipment: string | null; serial: string | null; power_voltage: string | null; machines: string | null; complete?: unknown };

const isComplete = (row: { complete?: unknown }) => row.complete === true || String(row.complete) === "true";

/**
 * The units a new machine list would take off this visit: claimed by the list now, claimed by nothing in the next one.
 * An installed project uses it to refuse a list change its kept pre-inspection would disagree with.
 */
export async function unitsDroppedBy(sql: Sql, installId: number, next: Omit<ListRow, "complete">): Promise<number[]> {
  const row = (await sql.query<ListRow>("select equipment, serial, power_voltage, machines from installs where id = $1", [installId]))[0];
  if (!row) return [];
  const catalog = await catalogNames(sql);
  const linked = await linkedUnits(sql, installId);
  const before = claimLinked(piecesFrom(row, catalog), linked, catalog);
  const after = new Set(claimLinked(piecesFrom(next, catalog), linked, catalog));
  return before.filter((id) => id >= 0 && !after.has(id));
}

/**
 * Take this unit off the install's equipment list on every open install whose visit has it (not installed, not
 * archived), and off those visits, so the next load does not put it back. Used when the unit leaves the account.
 */
export async function takeUnitOffOpenInstalls(sql: Sql, equipmentId: number): Promise<number[]> {
  const installs = await sql.query<ListRow & { id: number }>(
    `select i.id, i.equipment, i.serial, i.power_voltage, i.machines from installs i
      where i.archived = false and coalesce(i.complete, false) = false
        and exists (select 1 from install_inspection_units u where u.install_id = i.id and u.equipment_id = $1)`,
    [equipmentId],
  );
  if (!installs.length) return [];
  const catalog = await catalogNames(sql);
  const touched: number[] = [];
  for (const row of installs) {
    const pieces = piecesFrom(row, catalog);
    const at = listIndexOf(pieces, await linkedUnits(sql, row.id), catalog, equipmentId);
    if (at >= 0) {
      await writeList(sql, row.id, pieces.filter((_, i) => i !== at));
      touched.push(row.id);
    }
    await sql.query("delete from install_inspection_photos where install_id = $1 and equipment_id = $2", [row.id, equipmentId]);
    await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [row.id, equipmentId]);
    await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [row.id, equipmentId]);
  }
  return touched;
}

/**
 * Merge on the account: an open install whose visit has both units lists that machine twice. The dropped unit's row
 * comes off the list (the rows that stay keep everything they carry), or reopening the install makes the unit again.
 */
export async function dropMergedRow(sql: Sql, keepId: number, dropId: number): Promise<number[]> {
  const installs = await sql.query<ListRow & { id: number }>(
    `select i.id, i.equipment, i.serial, i.power_voltage, i.machines from installs i
      where i.archived = false and coalesce(i.complete, false) = false
        and exists (select 1 from install_inspection_units u where u.install_id = i.id and u.equipment_id = $1)
        and exists (select 1 from install_inspection_units u where u.install_id = i.id and u.equipment_id = $2)`,
    [keepId, dropId],
  );
  if (!installs.length) return [];
  const catalog = await catalogNames(sql);
  const touched: number[] = [];
  for (const row of installs) {
    const pieces = piecesFrom(row, catalog);
    const linked = await linkedUnits(sql, row.id);
    // Only a list with a row for each unit: when the kept unit has no row of its own, the row stays (it becomes the
    // kept unit's on the next load).
    if (!claimLinked(pieces, linked, catalog).includes(keepId)) continue;
    const at = listIndexOf(pieces, linked, catalog, dropId);
    if (at < 0) continue;
    await writeList(sql, row.id, pieces.filter((_, i) => i !== at));
    touched.push(row.id);
  }
  return touched;
}

async function unitPassed(sql: Sql, installId: number, equipmentId: number): Promise<boolean> {
  const [items, unit] = await Promise.all([
    sql.query<{ category: string; status: string }>(
      "select category, status from install_inspection_items where install_id = $1 and equipment_id = $2",
      [installId, equipmentId],
    ),
    sql.query<{ core_needed: string | null; visit_kind: string | null; install_date: unknown; catalog_model: string | null; equipment_name: string | null }>(
      `select u.core_needed, u.visit_kind, a.catalog_model, a.equipment_name, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as install_date from install_inspection_units u
         join account_equipment a on a.id = u.equipment_id where u.install_id = $1 and u.equipment_id = $2`,
      [installId, equipmentId],
    ),
  ]);
  if (unit[0] && isPreInspected(unitKind(unit[0].visit_kind, !!unit[0].install_date))) return true;
  return inspectionOverall(items, unit[0]?.core_needed, unit[0] ? unitChecks(unit[0]) : null) === "Passed";
}

/** The row and the unit name one machine: the same catalog model under either name. */
function sameMachine(unit: AcctUnit, piece: Piece, catalog: string[]): boolean {
  if (sameCatalogModel(unit.catalog_model, piece.equipment) || sameCatalogModel(unit.equipment_name, piece.equipment)) return true;
  const model = catalog.length ? matchCatalogModel(piece.equipment, piece.equipment, catalog).catalogModel : null;
  return !!model && (sameCatalogModel(unit.catalog_model, model) || sameCatalogModel(unit.equipment_name, model));
}

/**
 * The install's list and its pre-inspection mirror each other. After a save matched each row to its unit: a row whose
 * model was changed in this save renames its unit; otherwise the row shows its unit's serial, voltage and (when the
 * serial names another model) name. A load (`saved` false) only fills a blank serial or voltage on a row: it never
 * overwrites what a row says, so a window still holding the old list can't save an old serial back over the account's.
 * `before` is the list stored before a window save. Every row is given its unit's id; a list that is only typed text
 * (no stored rows) is not rewritten just for that.
 */
async function mirrorList(
  sql: Sql,
  installId: number,
  pieces: Piece[],
  units: (AcctUnit | undefined)[],
  catalog: string[],
  saved: boolean,
  before: Piece[] | null,
  how: { byId: boolean[]; typed: boolean; adopted?: boolean },
): Promise<void> {
  const modelBefore = new Map((before ?? []).filter((p) => serialKey(p.serial)).map((p) => [serialKey(p.serial), p.equipment]));
  const modelBeforeById = new Map((before ?? []).filter((p) => p.unitId).map((p) => [p.unitId!, p.equipment]));
  let changed = false;
  let ids = !!how.adopted;
  for (const [i, piece] of pieces.entries()) {
    const unit = units[i];
    if (!unit) continue;
    const key = serialKey(piece.serial);
    // The row names this unit by its serial or by its id: a model that differs is a rename in this save, or the unit's.
    const named = (!!key && unit.serial_key === key) || !!how.byId[i];
    const was = !named ? undefined : how.byId[i] && modelBeforeById.has(unit.id) ? modelBeforeById.get(unit.id) : key ? modelBefore.get(key) : undefined;
    if (saved && named && !sameMachine(unit, piece, catalog)) {
      if (was !== undefined && !sameCatalogModel(was, piece.equipment) && !isLocked(unit)) {
        unit.catalog_model = matchCatalogModel(piece.equipment, piece.equipment, catalog).catalogModel || piece.equipment;
        unit.equipment_name = piece.equipment;
        await sql.query("update account_equipment set catalog_model = $2, equipment_name = $3, updated_at = now() where id = $1", [
          unit.id,
          unit.catalog_model,
          unit.equipment_name,
        ]);
      } else {
        pieces[i] = { ...pieces[i]!, equipment: unit.equipment_name || unit.catalog_model };
        changed = true;
      }
    } else if (saved && was !== undefined && was.trim() !== piece.equipment.trim() && unit.equipment_name !== piece.equipment && !isLocked(unit)) {
      // The same machine, written another way in this save ("Linea PB" to its catalog name): the unit shows that name too.
      unit.equipment_name = piece.equipment;
      await sql.query("update account_equipment set equipment_name = $2, updated_at = now() where id = $1", [unit.id, unit.equipment_name]);
    }
    if (unit.serial_key && serialKey(pieces[i]!.serial) !== unit.serial_key && (saved || !key)) {
      pieces[i] = { ...pieces[i]!, serial: unit.serial ?? "" };
      changed = true;
    }
    if (!pieces[i]!.powerVoltage.trim() && unit.electrical?.trim()) {
      pieces[i] = { ...pieces[i]!, powerVoltage: unit.electrical.trim() };
      changed = true;
    }
    if (pieces[i]!.unitId !== unit.id) {
      pieces[i] = { ...pieces[i]!, unitId: unit.id };
      ids = true;
    }
  }
  if (changed) await writeList(sql, installId, pieces);
  // Only the ids are new: the stored rows take them, and nothing else on the install changes (not its updated time).
  else if (ids && !how.typed) await sql.query("update installs set machines = $2 where id = $1", [installId, serializeMachines(pieces).machines]);
}

/**
 * Why a save of this list must not be stored, or null. The list and the pre-inspection mirror each other, so a save is
 * refused rather than leaving them apart: a locked unit's row may not change its serial or model or come off the list,
 * and a serial another account's unit holds can't go on a row.
 */
export async function listEditRefusal(sql: Sql, installId: number, next: Omit<ListRow, "complete">): Promise<string | null> {
  const row = (await sql.query<ListRow & { customer: string }>("select customer, equipment, serial, power_voltage, machines from installs where id = $1", [installId]))[0];
  if (!row) return null;
  const catalog = await catalogNames(sql);
  const linked = await linkedUnits(sql, installId);
  const beforePieces = piecesFrom(row, catalog);
  const nextPieces = piecesFrom(next, catalog);
  const before = claimLinked(beforePieces, linked, catalog);
  const after = claimLinked(nextPieces, linked, catalog);
  for (const unit of linked) {
    if (!isLocked(unit) || !before.includes(unit.id)) continue;
    const label = `${unit.equipment_name || unit.catalog_model}${unit.serial ? ` SN ${unit.serial}` : ""}`;
    const lock = lockedMessage(lockedBy(unit), await lockOwnerName(sql));
    const at = after.indexOf(unit.id);
    if (at < 0) return `${label} can't come off the list. ${lock}`;
    const piece = nextPieces[at]!;
    const key = serialKey(piece.serial);
    const prev = beforePieces[before.indexOf(unit.id)];
    // A row left as it was is never refused, however loosely it names its locked unit.
    if (prev && serialKey(prev.serial) === key && sameCatalogModel(prev.equipment, piece.equipment)) continue;
    const cleared = !key && !!unit.serial_key && serialKey(prev?.serial) === unit.serial_key;
    if ((key && key !== unit.serial_key) || cleared || !sameMachine(unit, piece, catalog)) return `${label} can't be changed. ${lock}`;
  }
  const beforeKeys = new Set(beforePieces.map((p) => serialKey(p.serial)).filter(Boolean));
  for (const piece of nextPieces) {
    const key = serialKey(piece.serial);
    if (!key || beforeKeys.has(key)) continue;
    const other = (
      await sql.query<{ customer: string; name: string | null }>(
        "select customer, coalesce(nullif(equipment_name, ''), catalog_model) as name from account_equipment where serial_key = $1 and lower(customer) <> lower($2) limit 1",
        [key, row.customer],
      )
    )[0];
    if (other) return `SN ${piece.serial.trim()} is already on ${other.customer}${other.name ? ` (${other.name})` : ""}. Fix the serial, or move that unit first.`;
  }
  return null;
}

/**
 * Add install machines to pre-inspection. Prune only when the install equipment list was saved. `before` is the list
 * as it was stored before that save: a serial is written over a unit's serial only when the row's serial changed in
 * this save, never on a load.
 */
export async function syncInstallUnits(
  sql: Sql,
  installId: number,
  opts?: { prune?: boolean; before?: Omit<ListRow, "complete"> | null },
): Promise<void> {
  const install = await sql.query<{
    customer: string;
    equipment: string | null;
    serial: string | null;
    power_voltage: string | null;
    machines: string | null;
    complete: unknown;
  }>("select customer, equipment, serial, power_voltage, machines, complete from installs where id = $1", [installId]);
  const row = install[0];
  if (!row) return;
  const catalog = await catalogNames(sql);
  const listed = installMachines({ ...row, machines: text(row.machines) || null }, catalog);
  /** The list as stored before this save (prune only): what a row was before this save is read from it. */
  const before = opts?.prune && opts.before ? piecesFrom(opts.before, catalog) : null;
  // A window opened before the rows carried their unit ids sends them without: each takes its stored row's id.
  const pieces = before ? adoptUnitIds(listed.machines, before) : listed.machines;
  /** A unit saved under the whole one-line list ("Linea / Swift / Axiom") before machines were split. */
  const combined = (a: AcctUnit) => listedEquipment(a.equipment_name, catalog).length > 1;
  const account = await sql.query<AcctUnit>(
    `select id, catalog_model, equipment_name, serial, serial_key, electrical, install_date, locked_at, locked_by
       from account_equipment where lower(customer) = lower($1) order by id`,
    [row.customer],
  );
  const links = await sql.query<{ equipment_id: number }>(
    "select equipment_id from install_inspection_units where install_id = $1",
    [installId],
  );
  const linkedIds = new Set(links.map((l) => l.equipment_id));
  // A unit with anything recorded on this visit is claimed before an empty twin, so the prune drops the empty one.
  const recorded = await recordedUnits(sql, installId);
  const linkedRows = account
    .filter((a) => linkedIds.has(a.id))
    .sort((a, b) => Number(recorded.has(b.id)) - Number(recorded.has(a.id)) || a.id - b.id);
  const used = new Set<number>();
  const keep = new Set<number>();
  let first: number | null = null;
  // First pass: every piece takes the unit it names (its exact serial, then its own unit id), then by model. Only then
  // do the looser matches run, so one row never takes the unit another row names exactly.
  const hits: (AcctUnit | undefined)[] = pieces.map(() => undefined);
  const byId = claimNamed(pieces, hits, [linkedRows, account], used);
  pieces.forEach((piece, i) => {
    if (hits[i]) return;
    const hit = claimUnit(piece, [linkedRows, account], used, catalog);
    if (!hit) return;
    used.add(hit.id);
    hits[i] = hit;
  });
  // Serials the list had before this save: a row whose serial is not among them was corrected in this save.
  const beforeKeys = before ? new Set(before.map((p) => serialKey(p.serial)).filter(Boolean)) : null;
  for (const [i, piece] of pieces.entries()) {
    if (hits[i]) continue;
    let hit = claimEarlierName(piece, linkedRows, used, catalog);
    if (!hit) {
      // An older combined unit that names this machine becomes this machine: its checks and photos stay with it.
      const old = linkedRows.find(
        (a) => !used.has(a.id) && !isLocked(a) && combined(a) && listedEquipment(a.equipment_name, catalog).some((n) => sameCatalogModel(n, piece.equipment)),
      );
      if (old) {
        const matched = matchCatalogModel(piece.equipment, piece.equipment, catalog);
        old.catalog_model = matched.catalogModel || piece.equipment;
        old.equipment_name = piece.equipment;
        await sql.query("update account_equipment set catalog_model = $2, equipment_name = $3 where id = $1", [old.id, old.catalog_model, old.equipment_name]);
        hit = old;
      }
    }
    if (!hit) {
      // This row's own unit with a serial no row has any more: still this row's machine, not a second one. Its serial
      // is rewritten only when the row's serial was corrected in this save; a load never writes it, so a serial fixed on
      // the account stays (the row takes the unit's serial instead, below). A locked unit or a serial another unit holds
      // is never written; a save that would do either is refused before it is stored (listEditRefusal).
      const own = ownUnit(piece, pieces, linkedRows, used);
      const key = serialKey(piece.serial);
      const corrected = !!own && !!key && !!beforeKeys && !beforeKeys.has(key) && !isLocked(own);
      const clash = corrected ? await sql.query("select 1 from account_equipment where serial_key = $1 and id <> $2 limit 1", [key, own!.id]) : [];
      if (corrected && !clash[0]) {
        await sql.query("update account_equipment set serial = $2, serial_key = $3, updated_at = now() where id = $1", [own!.id, piece.serial.trim(), key]);
        own!.serial = piece.serial.trim();
        own!.serial_key = key;
      }
      // Cleared on the row in this save (the list had the unit's serial and now no row does): cleared on the unit too,
      // so a serial typed on the wrong row can be moved to the right one.
      const cleared = !!own && !key && !!beforeKeys && !!own.serial_key && beforeKeys.has(own.serial_key) && !isLocked(own);
      if (cleared) {
        await sql.query("update account_equipment set serial = null, serial_key = null, updated_at = now() where id = $1", [own!.id]);
        own!.serial = null;
        own!.serial_key = null;
      }
      hit = own;
    }
    if (hit) used.add(hit.id);
    hits[i] = hit;
  }
  settleTwins(pieces, hits, linkedRows);
  // A row that kept its unit by id, with a serial changed or cleared in this save: the unit takes the row's serial, so
  // the mirror below doesn't put the old one back. The same rules as a corrected serial above: never a locked unit, and
  // never a serial another unit holds.
  if (before && beforeKeys) {
    const was = new Map(before.filter((p) => p.unitId).map((p) => [p.unitId!, p]));
    for (const [i, piece] of pieces.entries()) {
      const unit = hits[i];
      if (!unit || !byId[i] || isLocked(unit)) continue;
      const key = serialKey(piece.serial);
      if (key === (unit.serial_key ?? "")) continue;
      const prev = was.get(unit.id);
      const changedHere = prev ? serialKey(prev.serial) !== key : key ? !beforeKeys.has(key) : !!unit.serial_key && beforeKeys.has(unit.serial_key);
      if (!changedHere) continue;
      if (key) {
        const clash = await sql.query("select 1 from account_equipment where serial_key = $1 and id <> $2 limit 1", [key, unit.id]);
        if (clash[0]) continue;
        await sql.query("update account_equipment set serial = $2, serial_key = $3, updated_at = now() where id = $1", [unit.id, piece.serial.trim(), key]);
        unit.serial = piece.serial.trim();
        unit.serial_key = key;
      } else {
        await sql.query("update account_equipment set serial = null, serial_key = null, updated_at = now() where id = $1", [unit.id]);
        unit.serial = null;
        unit.serial_key = null;
      }
    }
  }
  const finalUnits: (AcctUnit | undefined)[] = [];
  for (const [i, piece] of pieces.entries()) {
    let hit = hits[i];
    if (hit && combined(hit) && !isLocked(hit)) {
      // Matched by model but still labelled with the whole list: show just this machine's name.
      hit.equipment_name = piece.equipment;
      await sql.query("update account_equipment set equipment_name = $2 where id = $1", [hit.id, piece.equipment]);
    }
    let id = hit?.id;
    if (!id) {
      id = await insertEquipment(sql, installId, row.customer, piece.equipment, piece.serial || null, piece.powerVoltage || null);
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
    finalUnits[i] = hit;
    if (!first) first = id;
    await linkUnit(sql, installId, id);
  }
  // Ids taken from the stored rows above are not on the rows this save stored yet.
  const adopted = pieces.some((p, i) => p.unitId !== listed.machines[i]?.unitId);
  await mirrorList(sql, installId, pieces, finalUnits, catalog, !!opts?.prune, before, { byId, typed: listed.typed, adopted });
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
    if (keep.has(a.id) || !combined(a) || serialKey(a.serial) || isLocked(a)) continue;
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
  // Copies of a machine already on this visit, made by the old matching, and units an older load made from a serial
  // line or a colour word ("SN:231515042", "BLACK"): no serial, no check, no photo, no note. Unlinked here; the
  // account row goes too when nothing else uses it.
  const keptModels = account.filter((a) => keep.has(a.id));
  for (const a of linkedRows) {
    if (keep.has(a.id) || serialKey(a.serial) || isLocked(a)) continue;
    const junk =
      SUFFIX_ONLY.test((a.equipment_name ?? "").trim()) ||
      SERIAL_LINE.test((a.equipment_name ?? "").trim()) ||
      isTrailingWord(a.equipment_name ?? "");
    const twin =
      junk ||
      keptModels.some(
        (k) => sameCatalogModel(k.catalog_model, a.catalog_model) || sameCatalogModel(k.equipment_name, a.equipment_name),
      );
    if (!twin) continue;
    const touched = await sql.query(
      `select 1 from install_inspection_items where install_id = $2 and equipment_id = $1 and (status <> 'Not inspected' or coalesce(notes, '') <> '')
       union all select 1 from install_inspection_photos where install_id = $2 and equipment_id = $1
       union all select 1 from install_inspection_units where install_id = $2 and equipment_id = $1 and (coalesce(note, '') <> '' or coalesce(visit_kind, '') <> '') limit 1`,
      [a.id, installId],
    );
    if (touched.length) continue;
    await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, a.id]);
    await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, a.id]);
    linkedIds.delete(a.id);
    // A real machine's twin is deleted only when this install's load made it; an imported one stays on the account.
    await dropUnusedUnit(sql, a.id, junk ? undefined : { madeBy: installId });
  }
  if (!opts?.prune) return;
  /** Rows this save left out whose units stay on the visit: they come back, so the two tabs still list the same machines. */
  const back: Piece[] = [];
  for (const id of linkedIds) {
    if (keep.has(id)) continue;
    // A locked unit stays on the visit: only the owner takes it off. A unit that passed stays too; the Equipment tab's
    // Remove (removeInstallRow) is how either comes off, and it takes the unit off first.
    if (isLocked(account.find((a) => a.id === id)) || (await unitPassed(sql, installId, id))) {
      const was = before ? rowOfUnit(before, linkedRows, catalog, id) : null;
      if (was) back.push({ ...was, unitId: id });
      continue;
    }
    await sql.query("delete from install_inspection_photos where install_id = $1 and equipment_id = $2", [installId, id]);
    await sql.query("delete from install_inspection_items where install_id = $1 and equipment_id = $2", [installId, id]);
    await sql.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [installId, id]);
    // The account row goes too only when this install's load made it and nothing else uses it. A unit that was on the
    // account before (imported, added by hand, from another visit) is only taken off this visit.
    await dropUnusedUnit(sql, id, { madeBy: installId });
  }
  if (back.length) await writeList(sql, installId, [...pieces, ...back]);
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
    sql.query<{ install_id: number; equipment_id: number; core_needed: string | null; visit_kind: string | null; install_date: unknown; catalog_model: string | null; equipment_name: string | null }>(
      `select u.install_id, u.equipment_id, u.core_needed, u.visit_kind, a.catalog_model, a.equipment_name, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as install_date
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
  const byInstall = new Map<number, { items: { category: string; status: string }[]; photoCount: number; coreNeeded: string | null; preInspected: boolean; categories: string[] }[]>();
  for (const unit of units) {
    const key = `${unit.install_id}:${unit.equipment_id}`;
    const listItems = (grouped.get(key) ?? []).map((i) => ({ category: i.category, status: i.status }));
    const machines = byInstall.get(unit.install_id) ?? [];
    machines.push({
      items: listItems,
      photoCount: photoByUnit.get(key) ?? 0,
      coreNeeded: isCoreHoleAnswer(unit.core_needed) ? unit.core_needed : null,
      preInspected: isPreInspected(unitKind(unit.visit_kind, !!unit.install_date)),
      categories: unitChecks(unit),
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
    const categories = unitChecks(u);
    const summary = rollupSite([{ items: unitItems, photoCount: photoByUnit.get(key) ?? 0, coreNeeded, preInspected, categories }], null);
    const one = preInspected ? "Passed" : summary.machineCount ? inspectionOverall(unitItems, coreNeeded, categories) : "Not started";
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
  // Which units the equipment list has a row for: a unit it doesn't is flagged for review, never added on a load.
  const listRow = (await sql.query<ListRow>("select equipment, serial, power_voltage, machines from installs where id = $1", [installId]))[0];
  const catalog = await catalogNames(sql);
  const onList = new Set(listRow ? claimLinked(piecesFrom(listRow, catalog), await linkedUnits(sql, installId), catalog) : []);
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
      locked_at: unknown;
      locked_by: string | null;
    }>(
      `select u.equipment_id, a.catalog_model, a.equipment_name, a.serial, a.electrical, u.core_needed, u.note, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as install_date,
              a.locked_at, a.locked_by,
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
    const checks = unitChecks(u);
    const overall = preInspected ? "Passed" : inspectionOverall(inputs, coreNeeded, checks);
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
      failedItems: preInspected ? [] : failedItemLabels(inputs, coreNeeded, checks),
      photoCount: unitPhotos.length,
      thumb: unitPhotos[0]?.dataUrl ?? null,
      visitKind,
      preInspected,
      note: u.note ?? null,
      reqsSame: u.visit_kind === "replace" && u.reqs_same != null ? !!u.reqs_same : null,
      copiedFrom: u.from_name ? [u.from_name, u.from_serial ? `SN ${u.from_serial}` : null].filter(Boolean).join(" · ") : null,
      coreModel: u.core_model ?? null,
      locked: isLocked(u),
      lockedBy: isLocked(u) ? lockedBy(u) || "the owner" : null,
      onList: onList.has(u.equipment_id),
      coreNeeded,
      core: {
        category: CORE_HOLE_CATEGORY,
        label: CORE_HOLE_LABEL,
        hint: categoryHint(CORE_HOLE_CATEGORY, { model, electrical: u.electrical }),
        status: coreStatus,
        notes: coreRow?.notes ?? null,
        photos: unitPhotos.filter((p) => p.category === CORE_HOLE_CATEGORY),
      },
      // Only the checks this model uses. A check saved earlier on a now-hidden line is kept but not shown or counted.
      items: INSPECTION_CATEGORIES.filter((c) => checks.includes(c.key)).map((c) => {
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
      categories: m.items.map((i) => i.category),
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
  /** A machine of this model already on the visit with no serial: the serial goes on it instead of a second machine. */
  fillEquipmentId: z.number().int().positive().optional(),
});

/**
 * Add a machine to this install the same way the Equipment picker does: append it to the install's machine list,
 * then sync pre-inspection from that list. A unit written only onto the visit was dropped — a second machine of
 * the same model with no serial was deleted as a copy, and any other model was pruned the next time the card saved.
 */
export async function addMachineOntoInstall(
  sql: Sql,
  data: z.infer<typeof addEquipInput>,
  actor: string,
  opts?: { owner?: boolean },
): Promise<InspectionView> {
  const install = await sql.query<{
    id: number;
    customer: string;
    equipment: string | null;
    serial: string | null;
    power_voltage: string | null;
    machines: string | null;
  }>(
    "select id, customer, equipment, serial, power_voltage, machines from installs where id = $1 and archived = false",
    [data.installId],
  );
  const row = install[0];
  if (!row) throw new Error("Install not found");
  const model = data.model.trim();
  if (!model) throw new Error("Pick a model");
  if (data.fillEquipmentId) {
    const unit = (await sql.query<AcctUnit>("select id, catalog_model, equipment_name, serial, serial_key, electrical from account_equipment where id = $1", [data.fillEquipmentId]))[0];
    if (unit && serialKey(unit.serial)) throw new Error("That machine already has a serial. Use Edit on it to change it.");
    return editInspectionUnit(sql, {
      installId: data.installId,
      equipmentId: data.fillEquipmentId,
      model: unit ? unit.equipment_name || unit.catalog_model : model,
      serial: data.serial ?? "",
      electrical: data.electrical?.trim() ? data.electrical : (unit?.electrical ?? ""),
    }, actor, opts);
  }
  const serial = (data.serial ?? "").trim();
  const electrical = (data.electrical ?? "").trim();
  const key = serialKey(serial);
  const catalog = await catalogNames(sql);
  const { machines: current, typed } = installMachines(row, catalog);
  if (key && current.some((m) => serialKey(m.serial) === key)) {
    throw new Error("That serial is already on this visit.");
  }
  const equipment = matchModel(model, catalog);
  const packed = serializeMachines([...current, { equipment, serial, powerVoltage: electrical }]);
  // Typed lines stay as typed ("2 x e4s ... SN: ..."); the new machine goes on a line of its own.
  const lines = typed ? joinEquipment([text(row.equipment), equipment]) : packed.equipment;
  await sql.query(
    "update installs set equipment = $2, machines = $3, serial = $4, power_voltage = $5, updated_at = now() where id = $1",
    [data.installId, lines, packed.machines, packed.serial, packed.powerVoltage],
  );
  await syncInstallUnits(sql, data.installId, { prune: true });
  const view = await readInspection(sql, data.installId);
  if (!view) throw new Error("Install not found");
  const expected = current.filter((m) => m.equipment.trim()).length + 1;
  if (view.machineCount < expected) throw new Error("Could not add equipment");
  await sql
    .query(
      "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, 'updated', $3)",
      [data.installId, actor, `added ${equipment}${serial ? ` (SN ${serial})` : ""} to the install`],
    )
    .catch(() => undefined);
  return view;
}

export const addInspectionEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof addEquipInput>) => addEquipInput.parse(d))
  .handler(async ({ data, context }): Promise<InspectionView> => {
    const sql = await ready();
    return addMachineOntoInstall(sql, data, await deskUsername(sql, context.userId), { owner: await canLockEquipment(sql, context.userId) });
  });

const removeInput = z.object({
  installId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
  /** The equipment list was already saved without this unit. Do not write it again. */
  keepList: z.boolean().optional(),
});

/**
 * Take a machine off this install's pre-inspection: its checks, photos and note on this visit go with it. When the
 * machine is on the install's equipment list it comes off that list too, or the next load would put it back. The
 * account's equipment record stays unless nothing else uses it. An installed project is left as it is.
 */
export async function removeInspectionUnit(
  sql: Sql,
  data: z.infer<typeof removeInput>,
  actor: string,
  opts?: { owner?: boolean },
): Promise<InspectionView & { removed: string; fromList: boolean }> {
  await requireInstall(sql, data.installId);
  await requireUnit(sql, data.installId, data.equipmentId);
  const row = (
    await sql.query<{ customer: string; equipment: string | null; serial: string | null; power_voltage: string | null; machines: string | null; complete: boolean }>(
      "select customer, equipment, serial, power_voltage, machines, complete from installs where id = $1",
      [data.installId],
    )
  )[0]!;
  if (isComplete(row) && !opts?.owner) throw new Error(INSTALLED_KEPT);
  const unit = (
    await sql.query<AcctUnit>(
      "select id, catalog_model, equipment_name, serial, serial_key, electrical, locked_at, locked_by from account_equipment where id = $1",
      [data.equipmentId],
    )
  )[0];
  await assertUnlocked(sql, unit);
  const name = unit?.equipment_name || unit?.catalog_model || "Machine";

  // Which machine on the install's list is this unit: the same matching the load uses. A unit the list cannot match
  // takes the only machine of its model that no other unit claims, or the next load would add it back.
  const catalog = await catalogNames(sql);
  const pieces = piecesFrom(row, catalog);
  const at = listIndexOf(pieces, await linkedUnits(sql, data.installId), catalog, data.equipmentId);
  if (!data.keepList && at >= 0) await writeList(sql, data.installId, pieces.filter((_, i) => i !== at));
  await unlinkUnit(sql, data.installId, data.equipmentId);
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, 'updated', $3)", [
      data.installId,
      actor,
      `removed ${name}${unit?.serial ? ` (SN ${unit.serial})` : ""} from the pre-inspection${at >= 0 ? " and the equipment list" : ""}`,
    ])
    .catch(() => undefined);
  const view = await readInspection(sql, data.installId);
  if (!view) throw new Error("Install not found");
  return { ...view, removed: name, fromList: at >= 0 };
}

export const removeInspectionEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof removeInput>) => removeInput.parse(d))
  .handler(async ({ data, context }): Promise<InspectionView & { removed: string; fromList: boolean }> => {
    const sql = await ready();
    return removeInspectionUnit(sql, data, await deskUsername(sql, context.userId), { owner: await canLockEquipment(sql, context.userId) });
  });

/** An installed project's list and pre-inspection are kept as they were; only the owner changes them. */
export const INSTALLED_KEPT = "This install is marked installed. Its equipment list and pre-inspection are kept as they were; only the owner can change them.";

const editUnitInput = z.object({
  installId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
  model: z.string().trim().min(1, "Pick a model").max(200),
  serial: z.string().max(100).nullable().optional(),
  electrical: z.string().max(100).nullable().optional(),
});

/**
 * Edit one machine on Pre-inspection: its model, serial and electrical change on the account's unit and on the install's
 * equipment list together, so the two always match (a unit with no row on the list gets one). A locked unit, or a serial
 * another unit holds, is refused. An installed project is changed only by the owner.
 */
export async function editInspectionUnit(
  sql: Sql,
  data: z.infer<typeof editUnitInput>,
  actor: string,
  opts?: { owner?: boolean },
): Promise<InspectionView> {
  await requireInstall(sql, data.installId);
  await requireUnit(sql, data.installId, data.equipmentId);
  const row = (
    await sql.query<ListRow & { customer: string }>("select customer, equipment, serial, power_voltage, machines, complete from installs where id = $1", [data.installId])
  )[0]!;
  if (isComplete(row) && !opts?.owner) throw new Error(INSTALLED_KEPT);
  const unit = (
    await sql.query<AcctUnit>(
      "select id, catalog_model, equipment_name, serial, serial_key, electrical, locked_at, locked_by from account_equipment where id = $1",
      [data.equipmentId],
    )
  )[0];
  if (!unit) throw new Error("That machine is not on this visit.");
  await assertUnlocked(sql, unit);
  const catalog = await catalogNames(sql);
  const equipment = matchModel(data.model.trim(), catalog);
  const serial = (data.serial ?? "").trim();
  const key = serialKey(serial) || null;
  const electrical = (data.electrical ?? "").trim();
  const pieces = piecesFrom(row, catalog);
  const linked = await linkedUnits(sql, data.installId);
  const at = listIndexOf(pieces, linked, catalog, data.equipmentId);
  if (key) {
    if (pieces.some((p, i) => i !== at && serialKey(p.serial) === key)) throw new Error("That serial is already on this visit.");
    const other = (
      await sql.query<{ customer: string; name: string | null }>(
        "select customer, coalesce(nullif(equipment_name, ''), catalog_model) as name from account_equipment where serial_key = $1 and id <> $2 limit 1",
        [key, unit.id],
      )
    )[0];
    if (other) throw new Error(`SN ${serial} is already on ${other.customer}${other.name ? ` (${other.name})` : ""}.`);
  }
  const catalogModel = matchCatalogModel(equipment, equipment, catalog).catalogModel || equipment;
  await sql.query(
    "update account_equipment set catalog_model = $2, equipment_name = $3, serial = $4, serial_key = $5, electrical = $6, updated_at = now() where id = $1",
    [unit.id, catalogModel, equipment, serial || null, key, electrical || null],
  );
  const piece = { equipment, serial, powerVoltage: electrical, unitId: unit.id };
  const next = at >= 0 ? pieces.map((p, i) => (i === at ? { ...p, ...piece } : p)) : [...pieces, piece];
  await writeList(sql, data.installId, next);
  await syncInstallUnits(sql, data.installId);
  const was = `${unit.equipment_name || unit.catalog_model}${unit.serial ? ` (SN ${unit.serial})` : ""}`;
  const now = `${equipment}${serial ? ` (SN ${serial})` : ""}${electrical ? ` · ${electrical}` : ""}`;
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, 'updated', $3)", [
      data.installId,
      actor,
      `edited ${was} on the pre-inspection and the equipment list: now ${now}`,
    ])
    .catch(() => undefined);
  const view = await readInspection(sql, data.installId);
  if (!view) throw new Error("Install not found");
  return view;
}

export const editInspectionEquipment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof editUnitInput>) => editUnitInput.parse(d))
  .handler(async ({ data, context }): Promise<InspectionView> => {
    const sql = await ready();
    return editInspectionUnit(sql, data, await deskUsername(sql, context.userId), { owner: await canLockEquipment(sql, context.userId) });
  });

const removeRowInput = z.object({
  installId: z.number().int().positive(),
  /** The row's place on the window's list, and what it reads, so a list saved elsewhere meanwhile is not cut wrong. */
  index: z.number().int().min(0),
  equipment: z.string(),
  serial: z.string().nullable().optional(),
  /** The row's pre-inspection unit, when the window has it: the row that names it is the one taken off. */
  unitId: z.number().int().positive().nullable().optional(),
});

/**
 * The Equipment tab's Remove: the row comes off the list and the unit the load gave that row comes off the visit,
 * whatever was recorded on it. Leaving it to the save's prune kept a unit that had passed or was marked existing,
 * so the visit and the account still had a machine the list no longer did. An installed project is refused: its
 * list and its kept pre-inspection must not disagree. A row the server's list does not have (added in the window and
 * not saved yet) removes nothing here.
 */
export async function removeInstallRow(
  sql: Sql,
  data: z.infer<typeof removeRowInput>,
  actor: string,
  opts?: { owner?: boolean },
): Promise<{ removed: string | null }> {
  const row = (
    await sql.query<ListRow>("select equipment, serial, power_voltage, machines, complete from installs where id = $1 and archived = false", [data.installId])
  )[0];
  if (!row) throw new Error("Install not found");
  if (isComplete(row) && !opts?.owner) throw new Error(INSTALLED_KEPT);
  const catalog = await catalogNames(sql);
  const pieces = piecesFrom(row, catalog);
  const key = serialKey(data.serial);
  const same = (p: Piece) =>
    serialKey(p.serial) === key &&
    (sameCatalogModel(p.equipment, data.equipment) || sameCatalogModel(matchModel(p.equipment, catalog), matchModel(data.equipment, catalog)));
  const fits = pieces.map((p, i) => (same(p) ? i : -1)).filter((i) => i >= 0);
  const named = data.unitId ? pieces.findIndex((p) => p.unitId === data.unitId) : -1;
  const at = named >= 0 ? named : fits.includes(data.index) ? data.index : fits.length === 1 ? fits[0]! : -1;
  if (at < 0) return { removed: null };
  const linked = await linkedUnits(sql, data.installId);
  const rest = pieces.filter((_, i) => i !== at);
  const after = new Set(claimLinked(rest, linked, catalog));
  const gone = claimLinked(pieces, linked, catalog).filter((id) => id >= 0 && !after.has(id));
  for (const id of gone) await assertUnlocked(sql, linked.find((a) => a.id === id));
  await writeList(sql, data.installId, rest);
  // Same list edit as a save: a unit the account had before this install stays on the account.
  for (const id of gone) await unlinkUnit(sql, data.installId, id, { madeBy: data.installId });
  const piece = pieces[at]!;
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, 'updated', $3)", [
      data.installId,
      actor,
      `removed ${piece.equipment}${piece.serial ? ` (SN ${piece.serial})` : ""} from the equipment list${gone.length ? " and the pre-inspection" : ""}`,
    ])
    .catch(() => undefined);
  return { removed: piece.equipment };
}

export const removeInstallMachine = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof removeRowInput>) => removeRowInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    return removeInstallRow(sql, data, await deskUsername(sql, context.userId), { owner: await canLockEquipment(sql, context.userId) });
  });

const onListInput = z.object({
  installId: z.number().int().positive(),
  equipmentId: z.number().int().positive(),
});

/**
 * Review: a unit only the pre-inspection has gets its row on the equipment list (its model, serial and voltage, and its
 * id). Someone chooses this for each flagged unit; nothing adds the row on its own. An installed project is changed only
 * by the owner.
 */
export async function addUnitOntoList(
  sql: Sql,
  data: z.infer<typeof onListInput>,
  actor: string,
  opts?: { owner?: boolean },
): Promise<InspectionView> {
  await requireInstall(sql, data.installId);
  await requireUnit(sql, data.installId, data.equipmentId);
  const row = (await sql.query<ListRow>("select equipment, serial, power_voltage, machines, complete from installs where id = $1", [data.installId]))[0]!;
  if (isComplete(row) && !opts?.owner) throw new Error(INSTALLED_KEPT);
  const unit = (
    await sql.query<AcctUnit>("select id, catalog_model, equipment_name, serial, serial_key, electrical, locked_at, locked_by from account_equipment where id = $1", [
      data.equipmentId,
    ])
  )[0];
  if (!unit) throw new Error("That machine is not on this visit.");
  const catalog = await catalogNames(sql);
  const pieces = piecesFrom(row, catalog);
  if (claimLinked(pieces, await linkedUnits(sql, data.installId), catalog).includes(unit.id)) {
    throw new Error("That machine is already on the equipment list.");
  }
  const name = unit.equipment_name || unit.catalog_model;
  await writeList(sql, data.installId, [...pieces, { equipment: name, serial: unit.serial ?? "", powerVoltage: unit.electrical ?? "", unitId: unit.id }]);
  await syncInstallUnits(sql, data.installId);
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, 'updated', $3)", [
      data.installId,
      actor,
      `added ${name}${unit.serial ? ` (SN ${unit.serial})` : ""} to the equipment list from the pre-inspection`,
    ])
    .catch(() => undefined);
  const view = await readInspection(sql, data.installId);
  if (!view) throw new Error("Install not found");
  return view;
}

export const addInspectionUnitToList = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof onListInput>) => onListInput.parse(d))
  .handler(async ({ data, context }): Promise<InspectionView> => {
    const sql = await ready();
    return addUnitOntoList(sql, data, await deskUsername(sql, context.userId), { owner: await canLockEquipment(sql, context.userId) });
  });

/** One install whose equipment list and pre-inspection disagree. */
export type UnitMismatch = {
  installId: number;
  customer: string;
  installed: boolean;
  equipStatus: string | null;
  /** Units on the pre-inspection with no row on the equipment list. */
  onlyOnPreInspection: { equipmentId: number; name: string; serial: string | null; overall: InspectionOverall }[];
  /** Rows on the equipment list with no unit on the pre-inspection yet. */
  onlyOnList: { equipment: string; serial: string }[];
};

/**
 * Every open (not archived) install whose equipment list and pre-inspection disagree, for review. Reads only: it matches
 * rows to units the way a load does, but it never adds a row, makes a unit or links one.
 */
export async function findUnitMismatches(sql: Sql): Promise<UnitMismatch[]> {
  const installs = await sql.query<ListRow & { id: number; customer: string; equip_status: string | null }>(
    "select id, customer, equipment, serial, power_voltage, machines, complete, equip_status from installs where archived = false order by id",
  );
  if (!installs.length) return [];
  const catalog = await catalogNames(sql);
  const [units, items, photos] = await Promise.all([
    sql.query<
      AcctUnit & { install_id: number; visit_kind: string | null; core_needed: string | null; note: string | null; installed: unknown }
    >(
      `select u.install_id, a.id, a.catalog_model, a.equipment_name, a.serial, a.serial_key, a.electrical, a.locked_at, a.locked_by,
              u.visit_kind, u.core_needed, u.note, (a.install_date is not null and coalesce(a.serial_key, '') <> '') as installed
         from install_inspection_units u join account_equipment a on a.id = u.equipment_id
        order by u.install_id, a.id`,
    ),
    sql.query<ItemRow>("select install_id, equipment_id, category, status, notes from install_inspection_items"),
    sql.query<{ install_id: number; equipment_id: number | null }>("select distinct install_id, equipment_id from install_inspection_photos"),
  ]);
  const byInstall = new Map<number, typeof units>();
  for (const u of units) byInstall.set(u.install_id, [...(byInstall.get(u.install_id) ?? []), u]);
  const itemsOf = new Map<string, ItemRow[]>();
  for (const i of items) itemsOf.set(`${i.install_id}:${i.equipment_id}`, [...(itemsOf.get(`${i.install_id}:${i.equipment_id}`) ?? []), i]);
  const shot = new Set(photos.map((p) => `${p.install_id}:${p.equipment_id}`));
  const out: UnitMismatch[] = [];
  for (const row of installs) {
    const linked = byInstall.get(row.id) ?? [];
    const pieces = piecesFrom(row, catalog);
    if (!linked.length && !pieces.length) continue;
    const mine = (u: (typeof linked)[number]) => itemsOf.get(`${row.id}:${u.id}`) ?? [];
    // The order a load claims them in: anything recorded first, then the oldest.
    const recorded = (u: (typeof linked)[number]) =>
      mine(u).some((i) => i.status !== "Not inspected" || !!(i.notes ?? "").trim()) ||
      shot.has(`${row.id}:${u.id}`) ||
      !!(u.note ?? "").trim() ||
      !!(u.visit_kind ?? "").trim() ||
      !!(u.core_needed ?? "").trim();
    const priority = [...linked].sort((a, b) => Number(recorded(b)) - Number(recorded(a)) || a.id - b.id);
    const claims = claimLinked(pieces, priority, catalog);
    const onlyOnPreInspection = priority
      .filter((u) => !claims.includes(u.id))
      .sort((a, b) => a.id - b.id)
      .map((u) => {
        const coreNeeded = isCoreHoleAnswer(u.core_needed) ? u.core_needed : null;
        const kind = unitKind(u.visit_kind, u.installed === true || String(u.installed) === "true");
        const overall: InspectionOverall = isPreInspected(kind)
          ? "Passed"
          : inspectionOverall(mine(u).map((i) => ({ category: i.category, status: i.status })), coreNeeded, unitChecks(u));
        return { equipmentId: u.id, name: u.equipment_name || u.catalog_model, serial: u.serial, overall };
      });
    const onlyOnList = pieces.filter((_, i) => claims[i]! < 0).map((p) => ({ equipment: p.equipment, serial: p.serial }));
    if (!onlyOnPreInspection.length && !onlyOnList.length) continue;
    out.push({ installId: row.id, customer: row.customer, installed: isComplete(row), equipStatus: row.equip_status, onlyOnPreInspection, onlyOnList });
  }
  return out;
}

export const listUnitMismatches = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<UnitMismatch[]> => findUnitMismatches(await ready()));

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
      overall: inspectionOverall(items, isCoreHoleAnswer(u.core_needed) ? u.core_needed : null, unitChecks(u)),
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
