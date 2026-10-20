/**
 * The Coffee Equipment Request Form: which units belong on an install, and how they print.
 * Pure. The print page and the equipment tab both use this.
 */
import { serialKey } from "./account-equip.ts";
import { sameWarehouseModel } from "./warehouse-serial.ts";

export type VisitExtra = { model: string; serial?: string | null; electrical?: string | null };

export type VisitMachine = {
  equipment: string;
  serial: string;
  powerVoltage: string;
  plug?: string;
  ownership?: string;
  water?: string;
  recipeId?: number | null;
};

/** "120V", "220v", "208/240". A plug name does not match. */
export function looksLikeVoltage(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim();
  if (!s || looksLikePlug(s)) return false;
  return /^(?:\d{2,3}\s*v(?:olts?)?|\d{3}\s*\/\s*\d{3}(?:\s*v)?)$/i.test(s);
}

/** "L6-30P", "5-15", "NEMA 5-20R". A bare voltage does not match. */
export function looksLikePlug(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  return /nema|twist|\b[56]\s*-\s*\d{1,2}\s*[pr]?\b|\bl\d{1,2}\s*-?\s*\d{1,2}\s*p?\b/i.test(s);
}

/** Move a voltage typed into Plug, or a plug typed into Voltage, when the other field is empty. */
export function placePower(voltage: string, plug: string): { voltage: string; plug: string; moved: "voltage" | "plug" | null } {
  const v = voltage.trim();
  const p = plug.trim();
  if (looksLikeVoltage(p) && !v) return { voltage: p, plug: "", moved: "voltage" };
  if (looksLikePlug(v) && !p) return { voltage: "", plug: v, moved: "plug" };
  return { voltage: v, plug: p, moved: null };
}

/**
 * Add pre-inspection and warehouse units that are not already an equipment row.
 * A serial already on a row is left alone. A blank row of the same model takes the serial.
 * Calling it again changes nothing.
 */
export function foldVisitUnits<T extends VisitMachine>(rows: T[], extras: VisitExtra[]): { rows: T[]; added: number; changed: boolean } {
  const next = rows.map((r) => ({ ...r }));
  let changed = false;
  for (const row of next) {
    const power = placePower(row.powerVoltage, row.plug ?? "");
    if (power.moved) {
      row.powerVoltage = power.voltage;
      row.plug = power.plug;
      changed = true;
    }
  }
  let added = 0;
  for (const extra of extras) {
    const model = String(extra.model ?? "").trim();
    const serial = String(extra.serial ?? "").trim();
    if (!model && !serial) continue;
    const key = serialKey(serial);
    if (key && next.some((r) => serialKey(r.serial) === key)) continue;
    const blank = model
      ? next.findIndex((r) => sameWarehouseModel(r.equipment, model) && !String(r.serial ?? "").trim())
      : -1;
    if (blank >= 0 && key) {
      const row = next[blank]!;
      const power = placePower(row.powerVoltage, row.plug ?? "");
      const elec = String(extra.electrical ?? "").trim();
      const fromElec = !power.voltage && looksLikeVoltage(elec) ? elec : power.voltage;
      next[blank] = { ...row, serial, powerVoltage: fromElec, plug: power.plug };
      continue;
    }
    if (!key && model && next.some((r) => sameWarehouseModel(r.equipment, model))) continue;
    if (!model) continue;
    const elec = String(extra.electrical ?? "").trim();
    const power = placePower(looksLikeVoltage(elec) ? elec : "", looksLikePlug(elec) ? elec : "");
    next.push({ equipment: model, serial, powerVoltage: power.voltage, plug: power.plug } as T);
    added += 1;
  }
  return { rows: next, added, changed: changed || added > 0 };
}

/**
 * Put a serial on the row the person is editing. Never opens a second row.
 * A serial that is already on a different row is left untouched.
 */
export function applySerialInPlace<T extends VisitMachine>(
  rows: T[],
  machineIndex: number | null,
  serial: string,
): { rows: T[]; status: "updated" | "already" | "duplicate" } {
  const trimmed = serial.trim();
  const key = serialKey(trimmed);
  if (machineIndex != null && rows[machineIndex]) {
    const other = rows.findIndex((row, i) => i !== machineIndex && !!key && serialKey(row.serial) === key);
    if (other >= 0) return { rows, status: "duplicate" };
    const current = rows[machineIndex]!;
    if (serialKey(current.serial) === key) return { rows, status: "already" };
    const next = rows.slice();
    next[machineIndex] = { ...current, serial: trimmed };
    return { rows: next, status: "updated" };
  }
  if (key && rows.some((row) => serialKey(row.serial) === key)) return { rows, status: "already" };
  return { rows, status: "already" };
}

/** One row per serial. A blank serial is kept. The first row with a serial wins. */
export function dedupeMachineSerials<T extends { serial: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = serialKey(row.serial);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(row);
  }
  return out;
}

export function hasSerial<T extends { serial: string }>(rows: T[], serial: string | null | undefined): boolean {
  const key = serialKey(serial);
  return !!key && rows.some((row) => serialKey(row.serial) === key);
}

function rowsMatch(a: { equipment: string; serial: string }, b: { equipment: string; serial: string }): boolean {
  if (!sameWarehouseModel(a.equipment, b.equipment)) return false;
  const ak = serialKey(a.serial);
  const bk = serialKey(b.serial);
  if (ak && bk) return ak === bk;
  return true;
}

/**
 * What to save. The form's rows stay, including a row the form removed.
 * A machine the server added since `previous` is appended, so a pre-inspection add is not dropped.
 * A blank serial takes the serial the server stored on that same row.
 */
export function machinesBeforeSave<T extends VisitMachine>(editing: T[], previous: T[], server: T[]): T[] {
  const next = editing.map((r) => ({ ...r }));
  const have = new Set(next.map((r) => serialKey(r.serial)).filter(Boolean));
  for (const s of server) {
    const key = serialKey(s.serial);
    if (!key || have.has(key)) continue;
    const blank = next.findIndex((r) => sameWarehouseModel(r.equipment, s.equipment) && !String(r.serial ?? "").trim());
    if (blank < 0) continue;
    next[blank] = { ...next[blank]!, serial: String(s.serial).trim() };
    have.add(key);
  }
  const used = new Set<number>();
  for (const s of server) {
    const equipment = String(s.equipment ?? "").trim();
    if (!equipment) continue;
    const idx = previous.findIndex((p, i) => !used.has(i) && rowsMatch(p, s));
    if (idx >= 0) {
      used.add(idx);
      continue;
    }
    const serial = String(s.serial ?? "").trim();
    if (next.some((r) => rowsMatch(r, { equipment, serial }))) continue;
    next.push({ ...s, equipment, serial, powerVoltage: String(s.powerVoltage ?? "").trim() });
  }
  return dedupeMachineSerials(next);
}

export type FormUnit = {
  model: string;
  serial: string;
  notes: string;
  voltage: string;
  plug: string;
  /** From the model spec when the unit itself has no amps. */
  amps?: string;
};

export type FormRow = {
  equipment: string;
  notes: string;
  qty: number;
  outlet: string;
};

const up = (s: string) => s.trim().toUpperCase();

/** Blank when there is nothing to print. Never "Not set" or "undefined". */
export function formText(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s || /^not set$/i.test(s) || /^undefined$/i.test(s) || /^null$/i.test(s)) return "";
  return up(s);
}

/** One printed row per model. Serials sit on the equipment name. Outlet is the shared voltage and plug. */
export function groupFormRows(units: FormUnit[]): FormRow[] {
  const groups: { model: string; count: number; serials: string[]; notes: string[]; outlets: string[] }[] = [];
  for (const unit of units) {
    const model = formText(unit.model);
    if (!model) continue;
    const power = placePower(unit.voltage, unit.plug);
    const outlet = [formText(power.voltage), formText(unit.amps), formText(power.plug)].filter(Boolean).join(" · ");
    let group = groups.find((g) => sameWarehouseModel(g.model, model));
    if (!group) {
      group = { model, count: 0, serials: [], notes: [], outlets: [] };
      groups.push(group);
    }
    group.count += 1;
    const serial = formText(unit.serial);
    if (serial && !group.serials.includes(serial)) group.serials.push(serial);
    const notes = formText(unit.notes);
    if (notes && !group.notes.includes(notes)) group.notes.push(notes);
    if (outlet && !group.outlets.includes(outlet)) group.outlets.push(outlet);
  }
  return groups.map((g) => ({
    equipment: g.serials.length ? `${g.model} · SN ${g.serials.join(", ")}` : g.model,
    notes: g.notes.join(". "),
    qty: g.count,
    outlet: g.outlets.join(" / "),
  }));
}

/** New account when this customer has no other install and no equipment that is not already on this visit. */
export function accountIsNew(priorInstalls: number, priorEquipment: number): boolean {
  return priorInstalls <= 0 && priorEquipment <= 0;
}

export type CheckNote = { label: string; notes: string };

const PRE_LABELS = [
  "Account inspected by",
  "Cold water source confirmed",
  "Power supply verified",
  "Space clearance (H/W/D) checked",
  "Pre-Inspection photos taken",
  "Cleaning/Care sheets & recipe cards ready",
  "Is there an opening order?",
  "Training needs identified",
  "Katz Coffee signage included",
  "Equipment sale/loan docs signed",
] as const;

const TASK_LABELS = [
  "Water filtration (leak-free) Hardness Test/Dated",
  "Equipment calibrated to specs",
  "Test brew completed (coffee/tea) / TDS",
  "Parameters recorded",
  "Photos of equipment/filtration uploaded",
  "QR Code Training",
] as const;

const CORRIGO_LABELS = [
  "Equipment added to profile",
  "Serial numbers logged",
  "Equipment location details",
  "Install date added",
] as const;

/** Pass -> YES, Fail -> NO, a mix -> PENDING. No answer stays blank. */
export function rollChecks(statuses: string[]): string {
  const known = statuses.filter((s) => s === "Pass" || s === "Fail" || s === "N/A");
  if (!known.length) return "";
  if (known.some((s) => s === "Fail")) return known.some((s) => s === "Pass") ? "PENDING" : "NO";
  if (known.some((s) => s === "Pass")) return "YES";
  return "";
}

export function preInstallNotes(input: {
  inspector: string;
  water: string[];
  power: string[];
  space: string[];
  photoCount: number;
  recipesReady: boolean | null;
  docs: "yes" | "pending" | "blank";
}): CheckNote[] {
  const notes = [
    formText(input.inspector),
    rollChecks(input.water),
    rollChecks(input.power),
    rollChecks(input.space),
    input.photoCount > 0 ? "YES" : "",
    input.recipesReady == null ? "" : input.recipesReady ? "YES" : "",
    "",
    "",
    "",
    input.docs === "yes" ? "YES" : input.docs === "pending" ? "PENDING" : "",
  ];
  return PRE_LABELS.map((label, i) => ({ label, notes: notes[i] ?? "" }));
}

export function taskNotes(photoCount: number): CheckNote[] {
  return TASK_LABELS.map((label) => ({
    label,
    notes: label.startsWith("Photos of equipment") && photoCount > 0 ? "YES" : "",
  }));
}

export function corrigoNotes(input: { serialsLogged: boolean; installDate: string }): CheckNote[] {
  return CORRIGO_LABELS.map((label) => ({
    label,
    notes: label === "Serial numbers logged" && input.serialsLogged ? "YES" : label === "Install date added" && input.installDate ? "YES" : "",
  }));
}

/** Notice written when a serial is already on the account: the serial and the model. */
export function parseAccountSerialNotice(notice: string | null | undefined): { serial: string; model: string } | null {
  const m = /^Serial (.+?) is already on this account · (.+)$/.exec(String(notice ?? "").trim());
  if (!m?.[1] || !m[2]) return null;
  return { serial: m[1].trim(), model: m[2].trim() };
}
