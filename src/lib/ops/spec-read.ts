/**
 * The Library — what a spec read pulls off a sheet, and how it compares to the model.
 * Pure: no database, no DOM, safe for node --test.
 *
 * A filled field is never replaced unless the review says so. "Exact" means every
 * extracted value is new (the model was blank) or already the same.
 */
import type { Kv, Requirements, SpecSheetDraft } from "./spec-schema.ts";
import { sameWarehouseModel } from "./warehouse-serial.ts";

export const SPEC_FIELDS = [
  { key: "voltage", label: "Voltage" },
  { key: "amps", label: "Amps" },
  { key: "phase", label: "Phase" },
  { key: "plug", label: "Plug" },
  { key: "waterInlet", label: "Water inlet" },
  { key: "drain", label: "Drain" },
  { key: "height", label: "Height" },
  { key: "width", label: "Width" },
  { key: "depth", label: "Depth" },
  { key: "weight", label: "Weight" },
  { key: "tank", label: "Tank or boiler" },
  { key: "brew", label: "Brew capacity" },
  { key: "mpn", label: "MPN" },
] as const;

export type SpecFieldKey = (typeof SPEC_FIELDS)[number]["key"];
export type SpecValues = Record<SpecFieldKey, string>;

export type FieldChange = {
  key: SpecFieldKey;
  label: string;
  oldValue: string;
  newValue: string;
  kind: "fill" | "same" | "conflict";
};

export type TileStatus = "read" | "needs_review" | "no_sheet" | "unreadable";

export const TILE_LABEL: Record<TileStatus, string> = {
  read: "Read",
  needs_review: "Needs review",
  no_sheet: "No sheet",
  unreadable: "Unreadable",
};

const TANK_RE = /tank|boiler/i;
const BREW_RE = /brew|cups?\s*\/?\s*h|gal(?:lon)?s?\s*\/?\s*h|\bgph\b|\bcapacity\b/i;
const MPN_RE = /^(mpn|model number|part number|p\/n)$/i;

export function blankSpecValues(): SpecValues {
  return {
    voltage: "",
    amps: "",
    phase: "",
    plug: "",
    waterInlet: "",
    drain: "",
    height: "",
    width: "",
    depth: "",
    weight: "",
    tank: "",
    brew: "",
    mpn: "",
  };
}

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

function findKv(rows: Kv[] | undefined, re: RegExp): string {
  const hit = (rows ?? []).find((r) => re.test(r.label) && clean(r.value));
  return hit ? clean(hit.value) : "";
}

/** Pull the review fields off a saved sheet (first configuration) and the model's MPN. */
export function valuesFromParts(input: {
  requirements?: Requirements | null;
  specs?: Kv[] | null;
  mpn?: string | null;
}): SpecValues {
  const req = input.requirements ?? {};
  const power = req.power ?? {};
  const dims = req.dimensions ?? {};
  const rows = [...(input.specs ?? []), ...(req.other ?? [])];
  const tank = findKv(rows, TANK_RE);
  const brew = findKv(
    rows.filter((r) => !TANK_RE.test(r.label)),
    BREW_RE,
  );
  return {
    voltage: clean(power.voltage),
    amps: clean(power.amps),
    phase: clean(power.phase),
    plug: clean(power.plug),
    waterInlet: clean(req.water?.inlet),
    drain: clean(req.drain?.size) || clean(req.drain?.notes),
    height: clean(dims.height),
    width: clean(dims.width),
    depth: clean(dims.depth),
    weight: clean(dims.weight),
    tank,
    brew,
    mpn: clean(input.mpn) || findKv(rows, MPN_RE),
  };
}

export function valuesFromDraft(draft: SpecSheetDraft, mpn?: string | null): SpecValues {
  const config = draft.configs[0];
  return valuesFromParts({
    requirements: config?.requirements,
    specs: draft.specs,
    mpn,
  });
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Extracted fields that have a value, marked fill / same / conflict against the model. */
export function diffSpec(current: SpecValues, extracted: SpecValues): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of SPEC_FIELDS) {
    const next = clean(extracted[field.key]);
    if (!next) continue;
    const prev = clean(current[field.key]);
    const kind = !prev ? "fill" : fold(prev) === fold(next) ? "same" : "conflict";
    out.push({ key: field.key, label: field.label, oldValue: prev, newValue: next, kind });
  }
  return out;
}

/** True when there is something to save and no filled field would change. */
export function isExact(changes: FieldChange[]): boolean {
  return changes.length > 0 && changes.every((c) => c.kind !== "conflict");
}

export type FieldPick = "old" | "new";

/**
 * Write extracted fields onto a draft. A blank field is filled. A conflict stays
 * unless `picks` says "new". The book MPN is separate from the draft: it is
 * returned only when the model has none, or the review picked "new".
 */
export function applySpecPicks(
  draft: SpecSheetDraft,
  extracted: SpecValues,
  bookMpn: string,
  picks: Partial<Record<SpecFieldKey, FieldPick>> = {},
): { draft: SpecSheetDraft; mpn: string | null } {
  const next: SpecSheetDraft = {
    ...draft,
    specs: draft.specs.map((s) => ({ ...s })),
    configs: draft.configs.length
      ? draft.configs.map((c, i) =>
          i === 0
            ? {
                ...c,
                requirements: {
                  ...c.requirements,
                  power: { ...c.requirements.power },
                  water: { ...c.requirements.water },
                  drain: { ...c.requirements.drain },
                  dimensions: { ...c.requirements.dimensions },
                },
              }
            : c,
        )
      : [{ label: "Standard", requirements: {} }],
  };
  const base = valuesFromDraft(draft);
  base.mpn = clean(bookMpn);
  const req = next.configs[0]!.requirements;
  const should = (key: SpecFieldKey): boolean => {
    const value = clean(extracted[key]);
    if (!value) return false;
    const pick = picks[key];
    if (pick === "old") return false;
    if (pick === "new") return true;
    const prev = clean(base[key]);
    if (!prev) return true;
    return false;
  };
  if (should("voltage")) req.power = { ...req.power, voltage: clean(extracted.voltage) };
  if (should("amps")) req.power = { ...req.power, amps: clean(extracted.amps) };
  if (should("phase")) req.power = { ...req.power, phase: clean(extracted.phase) };
  if (should("plug")) req.power = { ...req.power, plug: clean(extracted.plug) };
  if (should("waterInlet")) req.water = { ...req.water, inlet: clean(extracted.waterInlet) };
  if (should("drain")) req.drain = { ...req.drain, size: clean(extracted.drain) };
  if (should("height")) req.dimensions = { ...req.dimensions, height: clean(extracted.height) };
  if (should("width")) req.dimensions = { ...req.dimensions, width: clean(extracted.width) };
  if (should("depth")) req.dimensions = { ...req.dimensions, depth: clean(extracted.depth) };
  if (should("weight")) req.dimensions = { ...req.dimensions, weight: clean(extracted.weight) };
  const upsert = (label: string, value: string, match: (label: string) => boolean) => {
    const idx = next.specs.findIndex((s) => match(s.label));
    if (idx >= 0) next.specs[idx] = { label: next.specs[idx]!.label, value };
    else next.specs.push({ label, value });
  };
  if (should("tank")) upsert("Tank or boiler", clean(extracted.tank), (l) => TANK_RE.test(l));
  // "Tank capacity" also matches the brew pattern. Leave tank and boiler rows out, as valuesFromParts does.
  if (should("brew")) upsert("Brew capacity", clean(extracted.brew), (l) => BREW_RE.test(l) && !TANK_RE.test(l));
  const nextMpn = clean(extracted.mpn);
  const pick = picks.mpn;
  const mpn = nextMpn && (pick === "new" || (pick !== "old" && !clean(bookMpn))) ? nextMpn : null;
  return { draft: next, mpn };
}

export type SpecOutlet = {
  model: string;
  manufacturer: string;
  voltage: string;
  amps: string;
  plug: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function outletForModel(model: string, specs: SpecOutlet[]): SpecOutlet | undefined {
  const name = model.trim();
  if (!name) return undefined;
  return specs.find(
    (s) =>
      sameWarehouseModel(s.model, name) ||
      sameWarehouseModel(`${s.manufacturer} ${s.model}`, name) ||
      sameWarehouseModel(s.model, name.replace(new RegExp(`^${escapeRe(s.manufacturer)}\\s+`, "i"), "")),
  );
}

/** Blank voltage, amps, or plug take the spec. A value already on the unit stays. */
export function withSpecOutlet<T extends { model: string; voltage: string; plug: string; amps?: string }>(unit: T, spec: SpecOutlet | undefined): T {
  if (!spec) return unit;
  return {
    ...unit,
    voltage: unit.voltage.trim() || spec.voltage,
    plug: unit.plug.trim() || spec.plug,
    amps: (unit.amps ?? "").trim() || spec.amps,
  };
}

/** One tile status. A stored sheet that has not been read yet has no chip. */
export function bookSpecStatus(specFiles: number, statuses: string[]): TileStatus | null {
  if (specFiles <= 0) return "no_sheet";
  if (statuses.includes("needs_review")) return "needs_review";
  if (statuses.includes("unreadable")) return "unreadable";
  if (statuses.includes("read")) return "read";
  return null;
}

export type AdminSectionRef = { id: string; openCount: number; noun: string };

/** Sections with open work first. Order inside each group stays as given. */
export function orderAdminSections<T extends { openCount: number }>(sections: T[]): T[] {
  const open: T[] = [];
  const clear: T[] = [];
  for (const section of sections) (section.openCount > 0 ? open : clear).push(section);
  return [...open, ...clear];
}

export function adminSummary(sections: AdminSectionRef[]): string {
  const needing = sections.filter((s) => s.openCount > 0);
  if (!needing.length) return "All clear.";
  const bits = needing.map((s) => `${s.openCount} ${s.noun}`);
  const n = needing.length;
  return `${n} section${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} action: ${bits.join(", ")}.`;
}

export function clipRows<T>(rows: T[], showAll: boolean, limit = 10): { rows: T[]; more: number } {
  if (showAll || rows.length <= limit) return { rows, more: 0 };
  return { rows: rows.slice(0, limit), more: rows.length - limit };
}

export const READ_BATCH = 15;
