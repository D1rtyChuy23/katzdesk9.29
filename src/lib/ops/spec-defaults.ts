/**
 * The Library — Katz install defaults for every spec sheet. Pure: safe for node --test.
 *
 * - Water inlet is always 3/8" compression valve.
 * - Plug comes from the electrical configuration:
 *     3-phase                      → Hardwire only (no NEMA plug, no plug image)
 *     208/220/230/240 V 1-phase    → NEMA L6 twist-lock sized from amps (L6-20 / L6-30); amps unknown → L6-30 (marked default)
 *     120 V                        → NEMA 5-15 or 5-20 from amps; amps unknown → 5-15. Twist-lock only if the sheet already says L.
 * - Breaker size recommendation sits under Amps.
 */
import type { Power, SpecConfig, SpecSheetDraft } from "./spec-schema.ts";

export const DEFAULT_INLET = '3/8" compression valve';
export const HARDWIRE_ONLY = "Hardwire only";

export type PlugClass = "three-phase" | "240" | "120" | "unknown";

export type PlugDecision = {
  plug: string | null;
  /** NEMA code for the picture, e.g. "L6-30". Null for hardwire/unknown. */
  nema: string | null;
  breaker: string | null;
  /** Shown next to the plug so a guessed value is obvious and can be changed. */
  note: string | null;
  cls: PlugClass;
};

/** 3-phase from the phase field, or from voltage/plug text ("3ph", "3-phase", "3Ø", "3N~"). */
export function isThreePhase(p: Power | undefined): boolean {
  if (!p) return false;
  const phase = (p.phase ?? "").trim().toLowerCase();
  if (/^(3|three)\b|3\s*-?\s*(ph|phase)|three[\s-]*phase|3\s*ø/.test(phase)) return true;
  const text = `${p.voltage ?? ""} ${p.circuit ?? ""} ${p.plug ?? ""}`.toLowerCase();
  return /\b3\s*-?\s*(ph|phase)\b|three[\s-]*phase|3\s*ø|\b3\s*n\s*~|\b3n\b|\bl15-|\bl21-|\b15-\d\dp?\b/.test(text);
}

export function voltageClass(p: Power | undefined): PlugClass {
  if (isThreePhase(p)) return "three-phase";
  const v = (p?.voltage ?? "").toLowerCase();
  const nums = (v.match(/\d{3}/g) ?? []).map(Number);
  if (nums.some((n) => n >= 200 && n <= 250)) return "240";
  if (nums.some((n) => n >= 100 && n <= 130)) return "120";
  return "unknown";
}

/** Largest amp figure on the spec ("20A / 30A" → 30). Null when there isn't one. */
export function specAmps(p: Power | undefined): number | null {
  const nums = ((p?.amps ?? "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0 && n < 1000);
  return nums.length ? Math.max(...nums) : null;
}

const STANDARD_BREAKERS = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];

/** Next standard breaker at or above 125% of the load (NEC continuous-load sizing). */
export function breakerFor(amps: number): number {
  const need = amps * 1.25;
  return STANDARD_BREAKERS.find((b) => b >= need - 1e-9) ?? Math.ceil(need / 10) * 10;
}

function sheetSaysLocking(plug: string | undefined): string | null {
  const m = (plug ?? "").toUpperCase().match(/\bL(5|6|14)-(15|20|30)P?\b/);
  return m ? `L${m[1]}-${m[2]}` : null;
}

/** Decide plug + breaker for one configuration's power block. */
export function decidePlug(p: Power | undefined): PlugDecision {
  const cls = voltageClass(p);
  const amps = specAmps(p);
  if (cls === "three-phase") {
    const breaker = amps ? `${breakerFor(amps)}A 3-pole` : "3-pole, size from the nameplate";
    return { plug: HARDWIRE_ONLY, nema: null, breaker, note: null, cls };
  }
  if (cls === "240") {
    const already = sheetSaysLocking(p?.plug);
    // Dual-voltage 120/208–240 V units with a neutral already call out L14; keep the sheet's locking plug.
    if (already && (already.startsWith("L14") || already.startsWith("L6"))) {
      const rating = Number(already.split("-")[1]);
      return {
        plug: `NEMA ${already} twist-lock`,
        nema: already,
        breaker: `${rating}A 2-pole`,
        note: null,
        cls,
      };
    }
    if (amps == null) {
      return {
        plug: "NEMA L6-30 twist-lock",
        nema: "L6-30",
        breaker: "30A 2-pole",
        note: "Default — amps aren't on the sheet. Change it if the nameplate says otherwise.",
        cls,
      };
    }
    if (amps <= 20) return { plug: "NEMA L6-20 twist-lock", nema: "L6-20", breaker: "20A 2-pole", note: null, cls };
    if (amps <= 30) return { plug: "NEMA L6-30 twist-lock", nema: "L6-30", breaker: "30A 2-pole", note: null, cls };
    // No standard L6 locking face above 30 A (see the NEMA chart): straight 6-50.
    return {
      plug: "NEMA 6-50",
      nema: "6-50",
      breaker: "50A 2-pole",
      note: amps > 50 ? `Draws ${amps}A — above a 50A plug. Confirm with the electrician; it may need to be hardwired.` : "Above 30A there is no L6 twist-lock; 6-50 straight blade.",
      cls,
    };
  }
  if (cls === "120") {
    const already = sheetSaysLocking(p?.plug);
    if (already?.startsWith("L5")) {
      const rating = Number(already.split("-")[1]);
      return { plug: `NEMA ${already} twist-lock`, nema: already, breaker: `${rating}A 1-pole`, note: null, cls };
    }
    if (amps != null && amps > 15) {
      return {
        plug: "NEMA 5-20",
        nema: "5-20",
        breaker: "20A 1-pole",
        note: amps > 20 ? `Draws ${amps}A — above a 20A plug. Confirm the circuit with the electrician.` : null,
        cls,
      };
    }
    return {
      plug: "NEMA 5-15",
      nema: "5-15",
      breaker: amps == null ? "15A 1-pole" : "15A 1-pole",
      note: amps == null ? "Default — amps aren't on the sheet. Change it if the nameplate says otherwise." : null,
      cls,
    };
  }
  return { plug: p?.plug ?? null, nema: nemaCode(p?.plug), breaker: null, note: null, cls };
}

const DEFAULT_NOTE = "Default — amps aren't on the sheet. Change it if the nameplate says otherwise.";

/** Note to show beside the plug when it's the no-amps default (L6-30 at 220 V, 5-15 at 120 V). */
export function defaultPlugNote(p: Power | undefined): string | null {
  if (!p?.plug || specAmps(p) != null) return null;
  const cls = voltageClass(p);
  const code = nemaCode(p.plug);
  if (cls === "240" && code === "L6-30") return DEFAULT_NOTE;
  if (cls === "120" && code === "5-15") return DEFAULT_NOTE;
  return null;
}

/** "NEMA L6-30 twist-lock" → "L6-30"; "NEMA 5-15P" → "5-15". Null for hardwire or non-NEMA text. */
export function nemaCode(plug: string | null | undefined): string | null {
  const t = (plug ?? "").toUpperCase();
  if (!t || /HARD\s*-?\s*WIRE/.test(t)) return null;
  const m = t.match(/\b(L?)(5|6|14|15)-(15|20|30|50)P?\b/);
  return m ? `${m[1]}${m[2]}-${m[3]}` : null;
}

export type DefaultsMode =
  /** New sheets and refresh: set the inlet and recompute plug/breaker from the electrical. */
  | "generate"
  /** Saving an edited sheet: only fill blanks, so a deliberate change sticks. */
  | "fill";

export function applyConfigDefaults(c: SpecConfig, mode: DefaultsMode): SpecConfig {
  const req = c.requirements ?? {};
  const water = { ...(req.water ?? {}) };
  if (mode === "generate" || !water.inlet?.trim()) water.inlet = DEFAULT_INLET;
  const power = { ...(req.power ?? {}) };
  const d = decidePlug(power);
  if (d.cls !== "unknown") {
    if (mode === "generate" || !power.plug?.trim()) power.plug = d.plug ?? undefined;
    if (mode === "generate" || !power.breaker?.trim()) power.breaker = d.breaker ?? undefined;
  }
  const hasPower = Object.values(power).some((v) => typeof v === "string" && v.trim());
  return { ...c, requirements: { ...req, water, ...(hasPower ? { power } : {}) } };
}

export function applySpecDefaults<T extends SpecSheetDraft>(draft: T, mode: DefaultsMode): T {
  const configs = draft.configs.length ? draft.configs : [{ label: "Standard", requirements: {} }];
  return { ...draft, configs: configs.map((c) => applyConfigDefaults(c, mode)) };
}
