/** Site check before an install. One record per install. */

import { normalizeName } from "./norm.ts";
import { isEspresso, isGrinder } from "./spec-defaults.ts";
import { isEversysMachine } from "./eversys.ts";

export const INSPECTION_CATEGORIES = [
  {
    key: "power",
    label: "Power",
    pass: "Correct voltage/phase/outlet present and reachable for the equipment",
  },
  {
    key: "water",
    label: "Water",
    pass: "Dedicated supply, shutoff, and line ready for the spec",
  },
  {
    key: "drain",
    label: "Drain",
    pass: "Gravity drain or pump plan, correct location",
  },
  {
    key: "ethernet",
    label: "Ethernet",
    pass: "Drop/port present if the machine needs telemetry/network",
  },
  {
    key: "space",
    label: "Space",
    pass: "Clearance, counter depth/height, access for the listed equipment",
  },
] as const;

export type InspectionCategory = (typeof INSPECTION_CATEGORIES)[number]["key"];

/** What kind of unit this is, for which site checks it gets. */
export type UnitType = "grinder" | "brewer" | "espresso" | "other";

// Brewers and tea brewers by maker or model name, when nothing else says otherwise.
const BREWER_NAMES = /\bfetco\b|\bbravilor\b|\bsego\b|\bsn\s*:?\s*(itcb|axap|itb|cwtf|icb)|\bcurtis\b|\bbrew(er|ers|ing)?\b|\btea\b|\burn\b|\baxiom\b|\bitcb\b|\bitb\b|\bicb\b|\bcwtf?\b|\bcbs\b|\bxts\b|\btb[36]q?\b|\binfusion\b|\bnitron\b|\bthermofresh\b|\bsoft\s*heat\b|\bsh\s*dbc\b|\bcrtf\b|\bvpr\b|\bvp17\b/i;

/**
 * Grinder (G9, Mazzer, Mahlkonig…), brewer (Fetco, Bunn Axiom, ITCB, TB3…), espresso (La Marzocco, Rancilio,
 * Eversys…), or other. Read from the model name on the account; grinder is checked first so a Bunn G9 is a grinder.
 */
// Espresso models written without the maker: Linea, Strada, GS3, Classe 9, LM…; Eversys e4 / e4s without the apostrophe.
const ESPRESSO_MODELS = /\blinea\b|\bstrada\b|\bgs3\b|\bclasse\s*\d|\blm\b|\bappia\b|\baurelia\b|\bmirage\b|\bkb90\b/i;
const EVERSYS_SHORT = /\be[2468][ms]?\b/i;

export function unitType(name: string | null | undefined): UnitType {
  const model = (name ?? "").trim();
  if (!model) return "other";
  if (isGrinder({ model })) return "grinder";
  if (isEversysMachine(model) || EVERSYS_SHORT.test(model) || isEspresso({ model }) || ESPRESSO_MODELS.test(model)) return "espresso";
  if (BREWER_NAMES.test(model)) return "brewer";
  return "other";
}

/** Ethernet is only for Eversys. */
export const needsEthernet = (name: string | null | undefined) =>
  unitType(name) === "espresso" && (isEversysMachine(name) || EVERSYS_SHORT.test(name ?? "") || /\beversys\b/i.test(name ?? ""));

/**
 * The site checks this model uses, in form order. Grinder: Power and Space. Brewer: Power, Water and Space.
 * Espresso: Power, Water, Drain and Space, plus Ethernet on Eversys only. Anything else: Power and Space.
 */
export function unitCategories(name: string | null | undefined): InspectionCategory[] {
  const type = unitType(name);
  const keys: InspectionCategory[] =
    type === "espresso" ? ["power", "water", "drain", "space"] : type === "brewer" ? ["power", "water", "space"] : ["power", "space"];
  if (needsEthernet(name)) keys.splice(keys.indexOf("space"), 0, "ethernet");
  return keys;
}

const ALL_KEYS = INSPECTION_CATEGORIES.map((c) => c.key) as InspectionCategory[];
const keysFor = (cats?: readonly string[] | null) => (cats && cats.length ? ALL_KEYS.filter((k) => cats.includes(k)) : ALL_KEYS);

/** Not one of the five lines. Counted only when this machine answered Yes. */
export const CORE_HOLE_CATEGORY = "core" as const;
export const CORE_HOLE_LABEL = "Counter core / utility pass-through";
export const CORE_HOLE_QUESTION =
  "Does the customer need a hole cored in the counter to pass utility lines through?";

export type CoreHoleAnswer = "yes" | "no";

export const INSPECTION_ITEM_STATUSES = ["Not inspected", "Pass", "Fail", "N/A"] as const;
export type InspectionItemStatus = (typeof INSPECTION_ITEM_STATUSES)[number];

export const INSPECTION_OVERALLS = ["Not started", "In progress", "Failed", "Passed"] as const;
export type InspectionOverall = (typeof INSPECTION_OVERALLS)[number];

export type InspectionSummary = {
  overall: InspectionOverall;
  failedItems: string[];
  photoCount: number;
  overrideReason: string | null;
  machineCount: number;
  passedCount: number;
};

export type InspectionItemInput = {
  category: string;
  status: string;
};

export function isInspectionCategory(v: string | null | undefined): v is InspectionCategory {
  return INSPECTION_CATEGORIES.some((c) => c.key === v);
}

export function isCoreHoleAnswer(v: string | null | undefined): v is CoreHoleAnswer {
  return v === "yes" || v === "no";
}

/** The five site lines, plus the core-hole line when that machine needs one. */
export function isSavableCategory(v: string | null | undefined): v is InspectionCategory | typeof CORE_HOLE_CATEGORY {
  return isInspectionCategory(v) || v === CORE_HOLE_CATEGORY;
}

export function isInspectionItemStatus(v: string | null | undefined): v is InspectionItemStatus {
  return (INSPECTION_ITEM_STATUSES as readonly string[]).includes(v ?? "");
}

export function categoryLabel(key: string): string {
  if (key === CORE_HOLE_CATEGORY) return CORE_HOLE_LABEL;
  return INSPECTION_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function emptyInspection(): InspectionSummary {
  return {
    overall: "Not started",
    failedItems: [],
    photoCount: 0,
    overrideReason: null,
    machineCount: 0,
    passedCount: 0,
  };
}

export function failedItemLabels(items: InspectionItemInput[], coreNeeded?: string | null, cats?: readonly string[] | null): string[] {
  const used = keysFor(cats);
  const labels: string[] = INSPECTION_CATEGORIES.filter((c) => used.includes(c.key)).filter((c) =>
    items.some((i) => i.category === c.key && i.status === "Fail"),
  ).map((c) => c.label);
  if (coreNeeded === "yes" && items.some((i) => i.category === CORE_HOLE_CATEGORY && i.status === "Fail")) {
    labels.push(CORE_HOLE_LABEL);
  }
  return labels;
}

/**
 * Not started / in progress / failed / passed. Fail wins. Pass or N/A on every counted line passes.
 * Only the checks this model uses count (cats); a hidden check is never waited on. No cats: all five.
 */
export function inspectionOverall(items: InspectionItemInput[], coreNeeded?: string | null, cats?: readonly string[] | null): InspectionOverall {
  const statuses = keysFor(cats).map((key) => {
    const hit = items.find((i) => i.category === key);
    return hit?.status ?? "Not inspected";
  });
  if (coreNeeded === "yes") {
    const hit = items.find((i) => i.category === CORE_HOLE_CATEGORY);
    statuses.push(hit?.status ?? "Not inspected");
  }
  if (statuses.every((s) => s === "Not inspected")) return "Not started";
  if (statuses.some((s) => s === "Fail")) return "Failed";
  if (statuses.every((s) => s === "Pass" || s === "N/A")) return "Passed";
  return "In progress";
}

export function summarizeInspection(
  items: InspectionItemInput[],
  photoCount: number,
  overrideReason: string | null | undefined,
  coreNeeded?: string | null,
  preInspected?: boolean,
  cats?: readonly string[] | null,
): InspectionSummary {
  // Existing equipment on the account is already pre-inspected: nothing to re-shoot, nothing can fail.
  const overall = preInspected ? "Passed" : inspectionOverall(items, coreNeeded, cats);
  return {
    overall,
    failedItems: preInspected ? [] : failedItemLabels(items, coreNeeded, cats),
    photoCount,
    overrideReason: (overrideReason ?? "").trim() || null,
    machineCount: 1,
    passedCount: overall === "Passed" ? 1 : 0,
  };
}

/** Site rollup. Passed only when every machine is Passed. Any Fail fails the site. */
export function rollupSite(
  machines: { items: InspectionItemInput[]; photoCount: number; coreNeeded?: string | null; preInspected?: boolean; categories?: readonly string[] | null }[],
  overrideReason: string | null | undefined,
): InspectionSummary {
  if (!machines.length) return { ...emptyInspection(), overrideReason: (overrideReason ?? "").trim() || null };
  const each = machines.map((m) => summarizeInspection(m.items, m.photoCount, null, m.coreNeeded, m.preInspected, m.categories));
  const failedLabels = [...INSPECTION_CATEGORIES.map((c) => c.label), CORE_HOLE_LABEL];
  const failedItems = failedLabels.filter((label) => each.some((m) => m.failedItems.includes(label)));
  let overall: InspectionOverall = "In progress";
  if (each.some((m) => m.overall === "Failed")) overall = "Failed";
  else if (each.every((m) => m.overall === "Passed")) overall = "Passed";
  else if (each.every((m) => m.overall === "Not started")) overall = "Not started";
  return {
    overall,
    failedItems,
    photoCount: each.reduce((n, m) => n + m.photoCount, 0),
    overrideReason: (overrideReason ?? "").trim() || null,
    machineCount: each.length,
    passedCount: each.filter((m) => m.overall === "Passed").length,
  };
}

/**
 * Hide the question when Space is N/A, unless Yes or No is already stored.
 * A local status that is not N/A (for example Pass, not saved yet) still shows it.
 */
export function showCoreHoleQuestion(spaceStatus: string | null | undefined, coreNeeded?: string | null): boolean {
  if (isCoreHoleAnswer(coreNeeded)) return true;
  return (spaceStatus ?? "Not inspected") !== "N/A";
}

export function categoryHint(
  category: string,
  unit: { model?: string | null; electrical?: string | null },
): string {
  const model = (unit.model ?? "").trim();
  const electrical = (unit.electrical ?? "").trim();
  if (category === CORE_HOLE_CATEGORY) {
    const base = "Hole through the counter so utility lines can pass";
    return model ? `${base}. For ${model}.` : base;
  }
  const base = INSPECTION_CATEGORIES.find((c) => c.key === category)?.pass ?? "";
  if (category === "power" && electrical) return `${base}. This unit calls for ${electrical}.`;
  if (category === "power" && model) return `${base}. Check the nameplate on ${model}.`;
  if (model) return `${base}. For ${model}.`;
  return base;
}

/** Pass and Fail need a photo. Notes are optional on every status, N/A included. */
export function itemSaveError(input: {
  status: string;
  notes?: string | null;
  photoCount: number;
}): string | null {
  if (!isInspectionItemStatus(input.status)) return "Pick a status.";
  if ((input.status === "Pass" || input.status === "Fail") && input.photoCount < 1) {
    return "Add at least one photo before Pass or Fail.";
  }
  return null;
}

/** Space cannot be saved as Pass until this machine has a Yes or No. */
export function spacePassError(input: {
  status: string;
  notes?: string | null;
  photoCount: number;
  coreNeeded?: string | null;
}): string | null {
  const base = itemSaveError(input);
  if (base) return base;
  if (input.status === "Pass" && !isCoreHoleAnswer(input.coreNeeded)) {
    return "Answer Yes or No on the core hole before Space can pass.";
  }
  return null;
}

export type VisitKind = "new" | "replace" | "existing";
export const isVisitKind = (v: unknown): v is VisitKind => v === "new" || v === "replace" || v === "existing";

/**
 * What a unit on a visit is. Someone's own choice always wins. With no choice made, a unit that already has an
 * install date on the account is existing equipment; anything else is a new install.
 */
export function unitKind(chosen: string | null | undefined, alreadyInstalled: boolean): VisitKind {
  // Replacing existing equipment and existing equipment are one choice now: both are Pre-Inspected.
  if (chosen === "replace") return "existing";
  if (isVisitKind(chosen)) return chosen;
  return alreadyInstalled ? "existing" : "new";
}

/** Existing equipment is already pre-inspected: no Power, Water, Drain, Ethernet or Space to re-shoot. */
export const isPreInspected = (kind: VisitKind | null | undefined) => kind === "existing";

/**
 * A new install gets the full one-machine form. A unit replacing existing equipment is asked first whether
 * the site requirements are the same: same → the existing results are copied and the form opens filled in
 * (any one item can still be changed); different → the normal form.
 */
export function showChecklist(kind: VisitKind | null | undefined, reqsSame: boolean | null | undefined): boolean {
  if (kind === "existing") return false;
  return kind !== "replace" || reqsSame != null;
}

export function canMarkInstalled(
  summary: Pick<InspectionSummary, "overall" | "overrideReason"> | null | undefined,
): boolean {
  if (!summary) return false;
  if (summary.overall === "Passed") return true;
  return !!(summary.overrideReason ?? "").trim();
}

/** Ready to go on site: equipment already Ready and the site check passed. */
export function siteIsReady(
  equipStatus: string | null | undefined,
  overall: InspectionOverall | null | undefined,
): boolean {
  return equipStatus === "Ready" && overall === "Passed";
}

export function photosCell(count: number): string {
  return count > 0 ? String(count) : "No";
}

export function inspectionGlance(summary: InspectionSummary | null | undefined): string {
  const s = summary ?? emptyInspection();
  const count = s.machineCount > 0 ? ` ${s.passedCount}/${s.machineCount}` : "";
  if (s.overall === "Failed" && s.failedItems.length) return `Failed: ${s.failedItems.join(", ")}${count}`;
  return `${s.overall}${count}`;
}

export type InspectorOption = { value: string; label: string };

function personKey(raw: string): string {
  return normalizeName(raw.replace(/\s*\([^)]{1,8}\)\s*$/, ""));
}

/** Active sales reps plus active service techs. One row per person, name order. */
export function inspectorChoices(
  reps: { name: string; initials?: string | null; active?: boolean }[],
  techs: { name: string; active?: boolean }[],
  current?: string | null,
): { options: InspectorOption[]; value: string } {
  const byKey = new Map<string, InspectorOption>();
  for (const rep of reps) {
    if (rep.active === false) continue;
    const name = rep.name.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const initials = (rep.initials ?? "").trim();
    byKey.set(personKey(name), {
      value: name,
      label: initials ? `${name} (${initials})` : name,
    });
  }
  for (const tech of techs) {
    if (tech.active === false) continue;
    const name = tech.name.trim().replace(/\s+/g, " ");
    if (!name || byKey.has(personKey(name))) continue;
    byKey.set(personKey(name), { value: name, label: name });
  }
  const options = [...byKey.values()].sort((a, b) =>
    a.value.localeCompare(b.value, undefined, { sensitivity: "base" }),
  );
  const cur = (current ?? "").trim();
  if (!cur) return { options, value: "" };
  const hit = options.find((o) => personKey(o.value) === personKey(cur) || normalizeName(o.label) === normalizeName(cur));
  if (hit) return { options, value: hit.value };
  return { options: [{ value: cur, label: cur }, ...options], value: cur };
}
