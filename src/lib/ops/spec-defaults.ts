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
import { isEversysMachine } from "./eversys.ts";

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
  /** Wires value to write on the sheet ("4-wire (2 hots, neutral, ground)"), when known. */
  wires: string | null;
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

/** Sheet identity, for model exceptions (Bunn Axiom at 220 V is 4-wire). */
export type PlugContext = { manufacturer?: string | null; model?: string | null };

export type WireCount = 3 | 4;
export const WIRES_4 = "4-wire (2 hots, neutral, ground)";
export const WIRES_3 = "3-wire (2 hots, ground)";
export const WIRE_MISSING_NOTE = "Wire count missing — confirm 3-wire L6 or 4-wire L14.";

/** Model exceptions: units known to be 4-wire at 208–240 V. */
const FOUR_WIRE_MODELS: RegExp[] = [/\bbunn\b.*\baxiom\b|\baxiom\b.*\bbunn\b|^axiom\b/i];

/** Plug text we wrote ourselves ("NEMA L6-30 twist-lock") is not evidence of the wiring. */
function isOurPlug(plug: string | undefined): boolean {
  return /^NEMA (L?\d+-\d+)( twist-lock)?$/.test((plug ?? "").trim());
}

/**
 * How many wires the 208–240 V supply uses: 4 = two hots + neutral + ground (L14), 3 = two hots + ground (L6).
 * Checked in order: the Wires field, the electrical text, model exceptions, the manufacturer's own plug.
 */
export function wireCount(
  p: Power | undefined,
  ctx?: PlugContext,
): { count: WireCount | null; source: "field" | "text" | "model" | "plug" | null } {
  const field = (p?.wires ?? "").toLowerCase();
  if (/\b4\b|four/.test(field)) return { count: 4, source: "field" };
  if (/\b3\b|three/.test(field)) return { count: 3, source: "field" };
  const text = `${p?.voltage ?? ""} ${p?.circuit ?? ""}`.toLowerCase();
  const plus = text.match(/\b(\d)\s*-?\s*(?:wire|w)\s*(?:\+|plus|&|and|w\/|with)\s*(?:gnd|ground)/);
  if (plus) {
    const n = Number(plus[1]) + 1;
    if (n === 3 || n === 4) return { count: n, source: "text" };
  }
  const bare = text.match(/\b([34])\s*-?\s*(?:wire|conductor)s?\b/);
  if (bare) return { count: Number(bare[1]) as WireCount, source: "text" };
  if (/neutral/.test(text) || /\b(115|120)\s*\/\s*(208|220|230|240)\b/.test(text)) return { count: 4, source: "text" };
  const who = `${ctx?.manufacturer ?? ""} ${ctx?.model ?? ""}`.trim();
  if (who && FOUR_WIRE_MODELS.some((re) => re.test(who))) return { count: 4, source: "model" };
  const plug = p?.plug ?? "";
  if (plug && !isOurPlug(plug)) {
    const code = nemaCode(plug);
    if (code && /^L?14-/.test(code)) return { count: 4, source: "plug" };
    if (code && /^L?6-/.test(code)) return { count: 3, source: "plug" };
  }
  return { count: null, source: null };
}

const DEFAULT_NOTE = "Default — amps aren't on the sheet. Change it if the nameplate says otherwise.";

function over50(amps: number) {
  return `Draws ${amps}A — above a 50A plug. Confirm with the electrician; it may need to be hardwired.`;
}

/** Decide plug + breaker for one configuration's power block: volts, then wire count, then amps. */
export function decidePlug(p: Power | undefined, ctx?: PlugContext): PlugDecision {
  const cls = voltageClass(p);
  const amps = specAmps(p);
  if (cls === "three-phase") {
    const breaker = amps ? `${breakerFor(amps)}A 3-pole` : "3-pole, size from the nameplate";
    return { plug: HARDWIRE_ONLY, nema: null, breaker, note: null, cls, wires: null };
  }
  if (cls === "240") {
    const w = wireCount(p, ctx);
    if (w.count == null) {
      // Don't guess L6: leave the plug unset until someone confirms 3-wire or 4-wire.
      const breaker = amps == null ? null : amps <= 20 ? "20A 2-pole" : amps <= 30 ? "30A 2-pole" : "50A 2-pole";
      return { plug: null, nema: null, breaker, note: WIRE_MISSING_NOTE, cls, wires: null };
    }
    if (w.count === 4) {
      const why = w.source === "model" ? "4-wire unit (model exception: 4-wire at 220V)." : "4-wire unit.";
      if (amps == null) {
        return { plug: "NEMA L14-20 twist-lock", nema: "L14-20", breaker: "20A 2-pole", note: `${why} ${DEFAULT_NOTE}`, cls, wires: WIRES_4 };
      }
      if (amps <= 20) return { plug: "NEMA L14-20 twist-lock", nema: "L14-20", breaker: "20A 2-pole", note: why, cls, wires: WIRES_4 };
      if (amps <= 30) return { plug: "NEMA L14-30 twist-lock", nema: "L14-30", breaker: "30A 2-pole", note: why, cls, wires: WIRES_4 };
      return {
        plug: "NEMA 14-50",
        nema: "14-50",
        breaker: "50A 2-pole",
        note: amps > 50 ? over50(amps) : "4-wire above 30A: no L14 twist-lock face; 14-50 straight blade.",
        cls,
        wires: WIRES_4,
      };
    }
    if (amps == null) return { plug: "NEMA L6-30 twist-lock", nema: "L6-30", breaker: "30A 2-pole", note: DEFAULT_NOTE, cls, wires: WIRES_3 };
    if (amps <= 20) return { plug: "NEMA L6-20 twist-lock", nema: "L6-20", breaker: "20A 2-pole", note: null, cls, wires: WIRES_3 };
    if (amps <= 30) return { plug: "NEMA L6-30 twist-lock", nema: "L6-30", breaker: "30A 2-pole", note: null, cls, wires: WIRES_3 };
    // No standard L6 locking face above 30 A (see the NEMA chart): straight 6-50.
    return {
      plug: "NEMA 6-50",
      nema: "6-50",
      breaker: "50A 2-pole",
      note: amps > 50 ? over50(amps) : "Above 30A there is no L6 twist-lock; 6-50 straight blade.",
      cls,
      wires: WIRES_3,
    };
  }
  if (cls === "120") {
    const already = sheetSaysLocking(p?.plug);
    if (already?.startsWith("L5") && !isOurPlug(p?.plug)) {
      const rating = Number(already.split("-")[1]);
      return { plug: `NEMA ${already} twist-lock`, nema: already, breaker: `${rating}A 1-pole`, note: null, cls, wires: null };
    }
    if (amps != null && amps > 15) {
      return {
        plug: "NEMA 5-20",
        nema: "5-20",
        breaker: "20A 1-pole",
        note: amps > 20 ? `Draws ${amps}A — above a 20A plug. Confirm the circuit with the electrician.` : null,
        cls,
        wires: null,
      };
    }
    return { plug: "NEMA 5-15", nema: "5-15", breaker: "15A 1-pole", note: amps == null ? DEFAULT_NOTE : null, cls, wires: null };
  }
  return { plug: p?.plug ?? null, nema: nemaCode(p?.plug), breaker: null, note: null, cls, wires: null };
}

/** Note beside the plug: the 4-wire reason, the no-amps default, or the missing wire count. */
export function defaultPlugNote(p: Power | undefined, ctx?: PlugContext): string | null {
  const cls = voltageClass(p);
  // 220 V with no confirmed wire count: flag it, even if an older default plug is still filled in.
  if (cls === "240" && wireCount(p, ctx).count == null) return WIRE_MISSING_NOTE;
  if (!p?.plug) return null;
  const code = nemaCode(p.plug);
  const d = decidePlug(p, ctx);
  if (code && d.nema === code) return d.note;
  if (cls === "240" && code && /^L?14-/.test(code)) return "4-wire unit.";
  return null;
}

/** Save-time check: the plug must match volts and wire count (no L6 on 4-wire, no L14 on 3-wire, no L6/L14 on 120 V). */
export function plugWireError(p: Power | undefined, ctx?: PlugContext): string | null {
  const code = nemaCode(p?.plug);
  if (!code) return null;
  const cls = voltageClass(p);
  if (cls === "120" && /^L?(6|14)-/.test(code)) return `NEMA ${code} is a 208–240V plug; this configuration is 120V.`;
  if (cls === "240" && /^L?5-/.test(code)) return `NEMA ${code} is a 120V plug; this configuration is 208–240V.`;
  if (cls !== "240") return null;
  const w = wireCount({ ...p, plug: undefined }, ctx).count;
  if (w === 4 && /^L?6-/.test(code)) return `NEMA ${code} is 3-wire; this unit is 4-wire (needs L14).`;
  if (w === 3 && /^L?14-/.test(code)) return `NEMA ${code} is 4-wire; this unit is 3-wire (needs L6).`;
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

export function applyConfigDefaults(c: SpecConfig, mode: DefaultsMode, ctx?: PlugContext): SpecConfig {
  const req = c.requirements ?? {};
  const water = { ...(req.water ?? {}) };
  if (mode === "generate" || !water.inlet?.trim()) water.inlet = DEFAULT_INLET;
  const power = { ...(req.power ?? {}) };
  const d = decidePlug(power, ctx);
  if (d.cls !== "unknown") {
    if (d.wires && (mode === "generate" || !power.wires?.trim())) power.wires = d.wires;
    // Generate writes the decision; when the wire count is missing on 220 V the plug is left unset (flagged).
    if (mode === "generate" || !power.plug?.trim()) power.plug = d.plug ?? undefined;
    if (mode === "generate" || !power.breaker?.trim()) power.breaker = d.breaker ?? undefined;
  }
  const hasPower = Object.values(power).some((v) => typeof v === "string" && v.trim());
  return { ...c, requirements: { ...req, water, ...(hasPower ? { power } : {}) } };
}

export function applySpecDefaults<T extends SpecSheetDraft>(draft: T, mode: DefaultsMode): T {
  const configs = draft.configs.length ? draft.configs : [{ label: "Standard", requirements: {} }];
  const core = espressoCoreDefaults(draft);
  const ctx = { manufacturer: draft.manufacturer, model: draft.model };
  return { ...draft, ...core, configs: configs.map((c) => applyConfigDefaults(c, mode, ctx)) };
}

// ---------------- counter core hole ----------------

export const DEFAULT_CORE_DIAMETER = '3"';
const ESPRESSO_MAKERS = /\b(la\s*marzocco|eversys|rancilio|faema|slayer|synesso|nuova\s*simonelli|victoria\s*arduino|franke|schaerer|thermoplan|wmf|cimbali)\b/i;

/** Espresso machine: La Marzocco, Eversys, Rancilio, Faema… or a catalog/category marked espresso. Grinders don't count. */
export function isEspresso(sheet: { manufacturer?: string | null; model?: string | null; category?: string | null }): boolean {
  const text = `${sheet.manufacturer ?? ""} ${sheet.model ?? ""}`;
  const cat = sheet.category ?? "";
  if (/grinder|brewer|water|filtration|fridge|refrigerat|blender|dispenser/i.test(cat)) return false;
  if (/espresso/i.test(cat) || /espresso\s*(machine)?\b/i.test(text) && !/grinder/i.test(text)) return true;
  if (/grinder|fridge/i.test(text)) return false;
  return ESPRESSO_MAKERS.test(text) || isEversysMachine(sheet.model) || isEversysMachine(text);
}

/** 3 → 3"; 3 in → 3"; 76 mm stays as typed. */
export function normalizeDiameter(v: string | null | undefined): string | undefined {
  const t = (v ?? "").trim();
  if (!t) return undefined;
  if (/^\d+(\.\d+)?$/.test(t)) return `${t}"`;
  const inch = t.match(/^(\d+(?:\.\d+)?)\s*(in|inch|inches|”|")\.?$/i);
  return inch ? `${inch[1]}"` : t;
}

/** Espresso sheets get core hole Yes and 3" unless the sheet already says otherwise. Never invents 3" for others. */
export function espressoCoreDefaults(sheet: Pick<SpecSheetDraft, "manufacturer" | "model" | "category" | "coreHole" | "coreDiameter">): {
  coreHole: SpecSheetDraft["coreHole"];
  coreDiameter: string | undefined;
} {
  const diameter = normalizeDiameter(sheet.coreDiameter);
  if (isEspresso(sheet)) {
    const hole = sheet.coreHole ?? "yes";
    return { coreHole: hole, coreDiameter: hole === "yes" ? diameter ?? DEFAULT_CORE_DIAMETER : diameter };
  }
  return { coreHole: sheet.coreHole, coreDiameter: diameter };
}

export type CoreHoleInfo = {
  required: boolean;
  diameter: string | null;
  /** "Counter core hole: 3" diameter" — null when no hole is needed. */
  label: string | null;
  /** Required but no diameter stored: the spec isn't complete. */
  missingDiameter: boolean;
};

export function coreHoleInfo(
  sheet: Pick<SpecSheetDraft, "manufacturer" | "model" | "category" | "coreHole" | "coreDiameter">,
  preInspectionSaysYes = false,
): CoreHoleInfo {
  const d = espressoCoreDefaults(sheet);
  const required = d.coreHole === "yes" || preInspectionSaysYes;
  if (!required) return { required: false, diameter: null, label: null, missingDiameter: false };
  const diameter = d.coreDiameter ?? null;
  return {
    required: true,
    diameter,
    label: diameter ? `Counter core hole: ${diameter} diameter` : "Counter core hole: diameter needed",
    missingDiameter: !diameter,
  };
}

/** Blocks saving a spec that needs a core hole but has no diameter. */
export function coreHoleSaveError(sheet: Pick<SpecSheetDraft, "manufacturer" | "model" | "category" | "coreHole" | "coreDiameter">): string | null {
  const info = coreHoleInfo(sheet);
  return info.missingDiameter ? "Counter core hole is Yes — add the hole diameter before saving." : null;
}
