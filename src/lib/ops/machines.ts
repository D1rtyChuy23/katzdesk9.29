import { joinEquipment, listedEquipment } from "./equipment";
import { clearTypedDuplicates } from "./install-form";

export type MachineSpec = {
  equipment: string;
  serial: string;
  powerVoltage: string;
  /** Recipe chosen for this unit on the equipment row (house or customer). */
  recipeId?: number | null;
  /** "Sold", "Loaned" or "Leased". Blank until someone marks it. "Loaned" shows as Loan. */
  ownership?: string;
  /** Configuration beside the voltage: the plug, and the water line when the unit takes water. */
  plug?: string;
  water?: string;
  /**
   * Older rows stored a coffee selection. It still parses so the rest of the row loads, and it is never
   * written back. Recipe is the only field for what they are serving.
   */
  coffee?: string;
  /** Ties a deal row to the board row it became when it was confirmed. */
  uid?: string;
  /** Deal rows: the day the machine was confirmed. */
  confirmedAt?: string | null;
  /** Deal rows: the board project holding the machine now. Worked out on read, never stored. */
  boardId?: number | null;
  /**
   * Install rows: the id of this machine's unit on the pre-inspection (account_equipment). The server writes it when it
   * matches the row to its unit; from then on the Equipment and Pre-inspection tabs follow each other by it, so a blank,
   * partial or corrected serial, or a renamed model, does not lose the link.
   */
  unitId?: number | null;
};

/**
 * The fields beyond model, serial, voltage and recipe. Kept on every read, merge and save so none is dropped.
 * boardId is the exception on save: it is worked out when a deal is read, so it is carried through a merge in the
 * window (a confirmed row stays confirmed when another machine is added) but never written.
 */
function extras(rec: Record<string, unknown>, keepBoard = false): Partial<MachineSpec> {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const out: Partial<MachineSpec> = {};
  const ownership = text(rec.ownership);
  if (ownership === "Sold" || ownership === "Loaned" || ownership === "Leased") out.ownership = ownership;
  if (text(rec.plug)) out.plug = text(rec.plug);
  if (text(rec.water)) out.water = text(rec.water);
  // An old coffee value is left behind: the row still loads, and coffee is never written back.
  if (text(rec.uid)) out.uid = text(rec.uid);
  if (/^\d{4}-\d{2}-\d{2}/.test(text(rec.confirmedAt))) out.confirmedAt = text(rec.confirmedAt).slice(0, 10);
  if (keepBoard && typeof rec.boardId === "number" && Number.isFinite(rec.boardId)) out.boardId = rec.boardId;
  const unitId = Number(rec.unitId);
  if (Number.isInteger(unitId) && unitId > 0) out.unitId = unitId;
  return out;
}

export function parseMachinesJson(raw: string | null | undefined): MachineSpec[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: MachineSpec[] = [];
    for (const row of v) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const equipment = String(rec.equipment ?? "").trim();
      if (!equipment) continue;
      const rid = Number(rec.recipeId);
      out.push({
        equipment,
        serial: String(rec.serial ?? "").trim(),
        powerVoltage: String(rec.powerVoltage ?? "").trim(),
        recipeId: Number.isFinite(rid) && rid > 0 ? rid : null,
        ...extras(rec),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function takeSpec(pool: MachineSpec[], equipment: string): MachineSpec | undefined {
  const key = equipment.toLowerCase();
  const idx = pool.findIndex((s) => s.equipment.toLowerCase() === key);
  if (idx < 0) return undefined;
  return pool.splice(idx, 1)[0];
}

export function mergeMachineSpecs(
  names: string[],
  previous: MachineSpec[] = [],
  legacy?: { serial?: string | null; powerVoltage?: string | null; machines?: string | null },
): MachineSpec[] {
  const fromJson = parseMachinesJson(legacy?.machines);
  const prev = [...previous];
  const json = [...fromJson];
  const specs = names.map((equipment) => {
    const hit = takeSpec(prev, equipment) ?? takeSpec(json, equipment);
    return {
      equipment,
      serial: hit?.serial ?? "",
      powerVoltage: hit?.powerVoltage ?? "",
      recipeId: hit?.recipeId ?? null,
      ...(hit ? extras(hit as Record<string, unknown>, true) : {}),
    };
  });
  const jsonHad = fromJson.length > 0;
  if (!jsonHad && specs.length === 1) {
    const only = specs[0]!;
    if (!only.serial && legacy?.serial && !legacy.serial.trim().startsWith("[")) {
      only.serial = legacy.serial.trim();
    }
    if (!only.powerVoltage && legacy?.powerVoltage && !legacy.powerVoltage.trim().startsWith("[")) {
      only.powerVoltage = legacy.powerVoltage.trim();
    }
  }
  return specs;
}

export function serializeMachines(specs: MachineSpec[]): {
  equipment: string | null;
  machines: string | null;
  serial: string | null;
  powerVoltage: string | null;
} {
  const clean = specs
    .map((s) => ({
      equipment: s.equipment.trim(),
      serial: s.serial.trim(),
      powerVoltage: s.powerVoltage.trim(),
      ...(s.recipeId ? { recipeId: s.recipeId } : {}),
      ...extras(s as Record<string, unknown>),
    }))
    .filter((s) => s.equipment);
  if (!clean.length) {
    return { equipment: null, machines: null, serial: null, powerVoltage: null };
  }
  const serials = clean.map((s) => s.serial).filter(Boolean);
  const powers = clean.map((s) => s.powerVoltage).filter(Boolean);
  return {
    equipment: joinEquipment(clean.map((s) => s.equipment)),
    machines: JSON.stringify(clean),
    serial: serials.length ? serials.join(" · ") : null,
    powerVoltage: powers.length ? powers.join(" · ") : null,
  };
}

export function specsFromInstall(
  equipment: string | null | undefined,
  serial: string | null | undefined,
  powerVoltage: string | null | undefined,
  machines: string | null | undefined,
  catalog: string[] = [],
): MachineSpec[] {
  // The saved list is read as saved, the same as pre-inspection reads it. Splitting the names again turned
  // 'Bunn ITCB-DV, 29" w/Flip Tray' into two machines on the window while the visit had one.
  const fromJson = storedMachines(machines);
  if (fromJson.length) return mergeMachineSpecs(fromJson.map((s) => s.equipment), fromJson, { serial, powerVoltage });
  return typedMachines(equipment ?? "", serial, powerVoltage, catalog);
}

/** A serial typed on a machine's line ("Bunn ITCB SN:ITCB064919"): the same shape as SERIAL_LINE, so "Snowball" is not one. */
const SN = /\bS\/?N(?:\s*[:#]\s*|\s+|(?=\d))((?=(?:[a-z-]*\d){3})[a-z0-9-]+)/i;
/**
 * A line that is only a serial ("SN: ITCB189507", "S/N 231515042"), typed under the machine it belongs to. SN is
 * followed by a separator or a digit and the serial has at least three digits, as the Corrigo reader requires, so
 * a machine called "Snowball" or "SNAP" is not read as a serial.
 */
export const SERIAL_LINE = /^S\/?N(?:\s*[:#]\s*|\s+|(?=\d))(?=(?:[a-z-]*\d){3})[a-z0-9-]+$/i;
/** The serial on a SERIAL_LINE line, without the "SN:" in front. */
function serialOfLine(line: string): string {
  return line.replace(/^S\/?N\s*[:#]?\s*/i, "").trim();
}

/** A bare model suffix ("-DV") saved as a machine of its own. */
export const SUFFIX_ONLY = /^[-\u2013][A-Za-z0-9]{1,8}$/;

/**
 * The saved machine list. A row that is only a serial ("SN:231515042") is the serial of the row above it, and a bare
 * suffix ("-DV") is part of the row above it: neither is a machine. Older saves wrote both as rows of their own.
 */
export function storedMachines(raw: string | null | undefined): MachineSpec[] {
  const out: MachineSpec[] = [];
  for (const m of parseMachinesJson(raw)) {
    const name = m.equipment.trim();
    const above = out[out.length - 1];
    if (SERIAL_LINE.test(name) || SUFFIX_ONLY.test(name)) {
      const serial = m.serial || (SERIAL_LINE.test(name) ? serialOfLine(name) : "");
      if (above && !above.serial && serial) above.serial = serial;
      continue;
    }
    if (/\n/.test(name)) {
      // The whole typed text saved as one name by an older serial lookup: one row per machine again.
      const typed = typedMachines(name, null, null, []);
      if (typed.length) {
        out.push({ ...m, equipment: typed[0]!.equipment, serial: m.serial || typed[0]!.serial }, ...typed.slice(1));
        continue;
      }
    }
    out.push(m);
  }
  return out;
}

/**
 * The machines typed in an install's equipment text, with the serial and voltage typed on a machine's line
 * ("Bunn ITCB 120v SN:ITCB064919") kept on that machine. One line can name several machines, each followed by its
 * serial ("Mazzer SJ E SN:2601514, Mazzer Mini E SN:…"), and a line that is only a serial belongs to the machine on
 * the line above it. Reading the names alone dropped every serial, and a serial line read as a machine named "SN:…".
 */
function typedMachines(
  equipment: string,
  serial: string | null | undefined,
  powerVoltage: string | null | undefined,
  catalog: string[],
): MachineSpec[] {
  const lines = equipment.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const named = listedEquipment(lines.filter((l) => !SERIAL_LINE.test(l)).join("\n"), catalog);
  const machines = mergeMachineSpecs(named, [], { serial, powerVoltage });
  const taken = new Set<MachineSpec>();
  let above: MachineSpec | undefined;
  for (const line of lines) {
    if (SERIAL_LINE.test(line)) {
      if (above && !above.serial) above.serial = serialOfLine(line);
      above = undefined;
      continue;
    }
    for (const part of line.split(/(?<=\bSN\s*:?\s*[A-Z0-9-]+)(?![A-Z0-9-])/i)) {
      if (!part.trim()) continue;
      const names = listedEquipment(part, catalog);
      const m = names.length === 1 ? machines.find((s) => !taken.has(s) && s.equipment === names[0]) : undefined;
      above = m;
      if (!m) continue;
      taken.add(m);
      m.serial ||= part.match(SN)?.[1] ?? "";
      m.powerVoltage ||= part.match(/\b\d{3}\s*v(?:olts?)?\b/i)?.[0] ?? "";
    }
  }
  return machines;
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
 * The install's machines, ready to save back: the saved list, or the typed one with each machine's serial and
 * voltage kept (see typedMachines). Saving the typed list without them erased the serial.
 */
export function installMachines(
  row: { equipment?: string | null; serial?: string | null; power_voltage?: string | null; machines?: unknown },
  catalog: string[] = [],
): { machines: MachineSpec[]; typed: boolean } {
  const stored = storedMachines(text(row.machines) || null);
  if (stored.length) return { machines: stored, typed: false };
  return { machines: typedMachines(text(row.equipment), text(row.serial), text(row.power_voltage), catalog), typed: true };
}

/** The list an install window starts from: the machines the board read for the row, serials included. */
export function machinesOnOpen(
  row: { equipment?: string | null; serial?: string | null; powerVoltage?: string | null; machines?: MachineSpec[] },
  catalog: string[] = [],
): MachineSpec[] {
  const saved = row.machines ?? [];
  if (saved.length) return saved.map((s) => ({ ...s }));
  const names = catalog.length
    ? listedEquipment(row.equipment, catalog)
    : (row.equipment ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return mergeMachineSpecs(names, [], { serial: row.serial, powerVoltage: row.powerVoltage });
}

/**
 * The machine fields a details save sends: none while the list is the one the window loaded. Saving it anyway
 * rewrote typed text ("2 x e4s … SN: …") as bare names every time the window closed.
 */
export function changedMachineFields(specs: MachineSpec[], loaded: MachineSpec[]): Partial<ReturnType<typeof serializeMachines>> {
  // A serial typed on a row (Escape before the lookup) that the loaded list has on another row is not sent there.
  const packed = serializeMachines(clearTypedDuplicates(specs, loaded));
  return JSON.stringify(packed) === JSON.stringify(serializeMachines(loaded)) ? {} : packed;
}
