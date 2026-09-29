import { joinEquipment, listedEquipment } from "./equipment";

export type MachineSpec = {
  equipment: string;
  serial: string;
  powerVoltage: string;
  /** Recipe chosen for this unit on the equipment row (house or customer). */
  recipeId?: number | null;
};

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
  const fromJson = parseMachinesJson(machines);
  if (fromJson.length) {
    const names = listedEquipment(fromJson.map((s) => s.equipment).join("\n"), catalog);
    return mergeMachineSpecs(names, fromJson, { serial, powerVoltage });
  }
  const names = listedEquipment(equipment, catalog);
  return mergeMachineSpecs(names, [], { serial, powerVoltage });
}
