import { serialKey } from "./account-equip.ts";

/** A machine row that can take a warehouse serial. Other fields are left alone. */
export type SerialMachine = {
  equipment: string;
  serial: string;
  powerVoltage: string;
};

function modelKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sameWarehouseModel(a: string, b: string): boolean {
  const ka = modelKey(a);
  const kb = modelKey(b);
  return !!ka && ka === kb;
}

/**
 * Put a warehouse unit's serial on the matching machine row.
 * Fills a row of that model with no serial. If every matching row already has one,
 * or the model is not on the list yet, adds a row when `addRow` is set.
 * Never writes volts, plug, or water.
 */
export function placeWarehouseSerial<T extends SerialMachine>(
  rows: T[],
  unit: { model: string; serial: string | null | undefined },
  opts?: { addRow?: boolean },
): { rows: T[]; changed: boolean } {
  const serial = String(unit.serial ?? "").trim();
  const model = String(unit.model ?? "").trim();
  if (!serial || !model) return { rows, changed: false };
  const key = serialKey(serial);
  if (rows.some((r) => sameWarehouseModel(r.equipment, model) && serialKey(r.serial) === key)) {
    return { rows, changed: false };
  }
  const blank = rows.findIndex((r) => sameWarehouseModel(r.equipment, model) && !String(r.serial ?? "").trim());
  if (blank >= 0) {
    const next = rows.slice();
    next[blank] = { ...next[blank]!, serial };
    return { rows: next, changed: true };
  }
  const addRow = opts?.addRow !== false;
  if (!addRow) return { rows, changed: false };
  const spelled = rows.find((r) => sameWarehouseModel(r.equipment, model))?.equipment ?? model;
  const added = { equipment: spelled, serial, powerVoltage: "" } as T;
  return { rows: [...rows, added], changed: true };
}

/** Clear a serial only when it is the one that came from this warehouse unit. */
export function clearWarehouseSerial<T extends { equipment: string; serial: string }>(
  rows: T[],
  unit: { serial: string | null | undefined },
): { rows: T[]; changed: boolean } {
  const key = serialKey(unit.serial);
  if (!key) return { rows, changed: false };
  let changed = false;
  const next = rows.map((r) => {
    if (serialKey(r.serial) !== key) return r;
    changed = true;
    return { ...r, serial: "" };
  });
  return { rows: changed ? next : rows, changed };
}

/** Copy serials the server just stored onto blank rows the window already has. */
export function absorbWarehouseSerials<T extends SerialMachine>(local: T[], server: T[]): T[] {
  const next = local.map((r) => ({ ...r }));
  const have = new Set(next.map((r) => serialKey(r.serial)).filter(Boolean));
  for (const s of server) {
    const key = serialKey(s.serial);
    if (!key || have.has(key)) continue;
    const blank = next.findIndex((r) => sameWarehouseModel(r.equipment, s.equipment) && !String(r.serial ?? "").trim());
    if (blank >= 0) {
      next[blank] = { ...next[blank]!, serial: s.serial.trim() };
      have.add(key);
      continue;
    }
    next.push({ ...s, serial: s.serial.trim() });
    have.add(key);
  }
  return next;
}

/**
 * Keep the rows already on screen, and append a machine the server added that this window does not have yet.
 * A blank serial counts: pre-inspection can add a model before anyone types a serial.
 */
export function appendServerMachines<T extends SerialMachine>(local: T[], server: T[]): T[] {
  const next = absorbWarehouseSerials(local, server);
  const used = new Set<number>();
  for (const row of next) {
    const idx = server.findIndex((s, i) => {
      if (used.has(i)) return false;
      if (!sameWarehouseModel(row.equipment, s.equipment)) return false;
      const rs = String(row.serial ?? "").trim();
      const ss = String(s.serial ?? "").trim();
      const rk = serialKey(rs);
      const sk = serialKey(ss);
      if (rk && sk) return rk === sk;
      return rs === ss;
    });
    if (idx >= 0) used.add(idx);
  }
  for (let i = 0; i < server.length; i++) {
    if (used.has(i)) continue;
    const s = server[i]!;
    const equipment = String(s.equipment ?? "").trim();
    if (!equipment) continue;
    next.push({ ...s, equipment, serial: String(s.serial ?? "").trim(), powerVoltage: String(s.powerVoltage ?? "").trim() });
  }
  return next;
}
