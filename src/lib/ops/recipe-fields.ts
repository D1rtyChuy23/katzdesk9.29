export const SETTING_FIELDS = [
  { name: "coffee1", label: "Coffee 1" },
  { name: "coffee2", label: "Coffee 2" },
  { name: "coffee3", label: "Coffee 3" },
  { name: "powder1", label: "Powder 1" },
  { name: "powder2", label: "Powder 2" },
  { name: "powder3", label: "Powder 3" },
  { name: "americano1", label: "Americano 1" },
  { name: "americano2", label: "Americano 2" },
  { name: "americano3", label: "Americano 3" },
  { name: "tea1", label: "Tea 1" },
  { name: "tea2", label: "Tea 2" },
  { name: "milk", label: "Milk settings" },
] as const;

export type SettingName = (typeof SETTING_FIELDS)[number]["name"];

/** New recipes start with the first listing in each category. */
export const DEFAULT_SETTING_NAMES: SettingName[] = [
  "coffee1",
  "powder1",
  "americano1",
  "tea1",
  "milk",
];

export type RecipeSettings = Record<SettingName, string | null>;

export const EMPTY_SETTINGS: RecipeSettings = {
  coffee1: null,
  coffee2: null,
  coffee3: null,
  powder1: null,
  powder2: null,
  powder3: null,
  americano1: null,
  americano2: null,
  americano3: null,
  tea1: null,
  tea2: null,
  milk: null,
};

export function settingsFrom(row: Partial<RecipeSettings> | null | undefined): RecipeSettings {
  const next = { ...EMPTY_SETTINGS };
  if (!row) return next;
  for (const f of SETTING_FIELDS) {
    const v = row[f.name];
    next[f.name] = typeof v === "string" && v.trim() ? v : null;
  }
  return next;
}

export function filledSettingNames(row: Partial<RecipeSettings> | null | undefined): SettingName[] {
  if (!row) return [...DEFAULT_SETTING_NAMES];
  const filled = SETTING_FIELDS.filter((f) => (row[f.name] ?? "").trim()).map((f) => f.name);
  return filled.length ? filled : [...DEFAULT_SETTING_NAMES];
}

export function previewSetting(row: Partial<RecipeSettings> | null | undefined): string | null {
  if (!row) return null;
  for (const f of SETTING_FIELDS) {
    const v = (row[f.name] ?? "").trim();
    if (v) return v.split("\n")[0]!.slice(0, 72);
  }
  return null;
}

export type EquipKind = "grinder" | "espresso" | "brewer" | "powder" | "other";

/** Rough machine type from the model name, used to pick sensible starting settings. */
export function equipKind(model: string): EquipKind {
  const m = model.toLowerCase();
  if (/grinder|mahl|mazzer|ditting|\bek ?43\b|\bg9|\bg3\b|\bmdxs?\b|\bsuper jolly/.test(m)) return "grinder";
  if (/powder|imix|i-mix|cappuccino|cappu|frappe|hot choc/.test(m)) return "powder";
  if (/eversys|cameo|e'?4|e'?2|la marzocco|linea|strada|gb5|nuova simonelli|appia|aurelia|faema|e61|franke|schaerer|thermoplan|jura|legacy|kb90/.test(m)) return "espresso";
  if (/bunn|fetco|itcb|tb3|axiom|cbs|brewer|urn|dispenser|curtis/.test(m)) return "brewer";
  return "other";
}

/** Standard settings a new recipe starts with, by machine type. */
export function defaultSettingsFor(model: string): SettingName[] {
  switch (equipKind(model)) {
    case "grinder":
      return [];
    case "espresso":
      return ["coffee1", "americano1", "milk"];
    case "brewer":
      return ["coffee1", "tea1"];
    case "powder":
      return ["powder1", "powder2"];
    default:
      return ["coffee1"];
  }
}

/** Custom settings a new recipe starts with, by machine type (saved into notes as "Label: value"). */
export function defaultCustomFor(model: string): string[] {
  return equipKind(model) === "grinder" ? ["Grind setting", "Dose"] : [];
}

/** Common extras offered in "+ Add setting", beyond the standard recipe fields. */
export const CUSTOM_SUGGESTIONS = [
  "Grind setting",
  "Dose",
  "Yield",
  "Shot time",
  "Water temp",
  "Brew volume",
  "Batch size",
  "Bypass",
  "Pre-infusion",
  "Steam pressure",
] as const;
