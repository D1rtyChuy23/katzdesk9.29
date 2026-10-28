/**
 * The Library — what a spec read pulls off a sheet, and how it compares to the model.
 * Pure: no database, no DOM, safe for node --test.
 *
 * A filled field is never replaced unless the review says so. "Exact" means every
 * extracted value is new (the model was blank) or already the same.
 */
import type { Kv, Requirements, SpecSheetDraft } from "./spec-schema.ts";
import { nemaCode } from "./spec-defaults.ts";
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

function findKv(rows: Kv[] | undefined, re: RegExp, not?: RegExp): string {
  const hit = (rows ?? []).find((r) => re.test(r.label) && !(not && not.test(r.label)) && clean(r.value));
  return hit ? clean(hit.value) : "";
}

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

type LabelField = Exclude<SpecFieldKey, "tank" | "brew" | "mpn">;

/** The labels a spec row can carry a field under ("Voltage", "Amperage", "Net weight"), and labels that only look like it. */
const LABEL_FIELDS: { key: LabelField; re: RegExp; not?: RegExp }[] = [
  { key: "voltage", re: /\bvolt(?:age|s)?\b/i },
  { key: "amps", re: /\b(?:amps?|amperage|current)\b/i },
  { key: "phase", re: /\bphase\b/i },
  { key: "plug", re: /\b(?:plug|cord|nema)\b/i },
  { key: "waterInlet", re: /\b(?:water (?:inlet|connection|supply|line)|inlet)\b/i, not: /pressure|temp|flow/i },
  { key: "drain", re: /\bdrain\b/i },
  { key: "height", re: /\bheight\b/i },
  { key: "width", re: /\bwidth\b/i },
  { key: "depth", re: /\bdepth\b/i },
  { key: "weight", re: /\bweight\b/i },
];

/** One configuration's own fields: power, water, drain and dimensions, and tank and brew from its rows. */
function ownValues(req: Requirements, rows: Kv[]): Omit<SpecValues, "mpn"> {
  const power = req.power ?? {};
  const dims = req.dimensions ?? {};
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
    tank: findKv(rows, TANK_RE),
    brew: findKv(
      rows.filter((r) => !TANK_RE.test(r.label)),
      BREW_RE,
    ),
  };
}

/**
 * Pull the review fields off a sheet (its first configuration) and the model's MPN. A field the configuration leaves
 * blank is filled from a spec row (or one of its own other rows) with that field's label, then from the sheet's other
 * configurations when every one of them that has it agrees. Different values in different configurations stay blank.
 */
export function valuesFromParts(input: {
  requirements?: Requirements | null;
  specs?: Kv[] | null;
  mpn?: string | null;
  /** The sheet's other configurations. */
  others?: (Requirements | null | undefined)[] | null;
}): SpecValues {
  const req = input.requirements ?? {};
  const rows = [...(input.specs ?? []), ...(req.other ?? [])];
  const out: SpecValues = { ...ownValues(req, rows), mpn: clean(input.mpn) || findKv(rows, MPN_RE) };
  for (const f of LABEL_FIELDS) if (!out[f.key]) out[f.key] = findKv(rows, f.re, f.not);
  const others = (input.others ?? []).map((r) => ownValues(r ?? {}, r?.other ?? []));
  for (const key of [...LABEL_FIELDS.map((f) => f.key), "tank", "brew"] as const) {
    if (out[key]) continue;
    const seen = others.map((o) => o[key]).filter(Boolean);
    if (seen.length && seen.every((v) => fold(v) === fold(seen[0]!))) out[key] = seen[0]!;
  }
  return out;
}

export function valuesFromDraft(draft: SpecSheetDraft, mpn?: string | null): SpecValues {
  const config = draft.configs[0];
  return valuesFromParts({
    requirements: config?.requirements,
    specs: draft.specs,
    mpn,
    others: draft.configs.slice(1).map((c) => c.requirements),
  });
}

/** Most text a read sends the AI: the 60,000 characters the spec import has always allowed. */
export const SPEC_TEXT_LIMIT = 60_000;

/** Words that mark a page with specifications, and how much each counts. */
const SPEC_WORDS: [RegExp, number][] = [
  [/\btechnical data\b/gi, 6],
  [/\bspecifications?\b/gi, 4],
  [/\bdimensions?\b/gi, 3],
  [/\bweight\b/gi, 3],
  [/\bvolt(?:s|age)?\b|\b\d{2,3}\s?vac?\b/gi, 2],
  [/\bamp(?:s|erage|eres?)?\b|\b\d+(?:\.\d+)?\s?a\b/gi, 2],
  [/\bhz\b|\bhertz\b/gi, 2],
  [/\bphase\b/gi, 2],
];
const ENGLISH = /\b(?:the|and|with|for|this|that|from|must|should|unit|machine|water|power|only|not)\b/gi;
const OTHER_LANGUAGE = /\b(?:der|die|das|und|mit|nicht|ist|le|les|et|des|une|pour|est|el|los|las|para|con|il|di|che|della|een|het|van|och)\b/gi;

const hits = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

/** How much a page reads like specifications: each word's hits (up to 5) times its weight. */
export function specScore(text: string): number {
  return SPEC_WORDS.reduce((n, [re, weight]) => n + Math.min(hits(text, re), 5) * weight, 0);
}

/** True when the page reads as English: at least as many English words as French, German, Spanish, Italian or Dutch ones. */
export function isEnglishPage(text: string): boolean {
  const en = hits(text, ENGLISH);
  return en > 0 && en >= hits(text, OTHER_LANGUAGE);
}

export type DocPage = { page: number; text: string };

/**
 * The text a read sends the AI, each page marked "[Page n]". A document that fits in the limit goes whole. A longer
 * one sends its first page (it names the machine), then the pages with the most spec words, English first, as many as
 * fit, in page order.
 */
export function pickSpecPages(pages: DocPage[], limit = SPEC_TEXT_LIMIT): { text: string; used: number[]; total: number } {
  const withText = pages.filter((p) => p.text.trim());
  const block = (p: DocPage) => `[Page ${p.page}]\n${p.text.trim()}`;
  const size = (p: DocPage) => block(p).length + 2;
  let chosen: DocPage[];
  if (withText.reduce((n, p) => n + size(p), 0) <= limit) chosen = withText;
  else {
    const scored = withText.map((p) => ({ p, score: specScore(p.text), english: isEnglishPage(p.text) }));
    const ranked = [...scored].sort(
      (a, b) => Number(b.score > 0) - Number(a.score > 0) || Number(b.english) - Number(a.english) || b.score - a.score || a.p.page - b.p.page,
    );
    const order = scored[0] ? [scored[0], ...ranked.filter((s) => s !== scored[0])] : ranked;
    chosen = [];
    let used = 0;
    for (const s of order) {
      if (used + size(s.p) > limit) continue;
      chosen.push(s.p);
      used += size(s.p);
    }
    // A single page longer than the limit: its start.
    if (!chosen.length && ranked[0]) chosen = [{ page: ranked[0].p.page, text: ranked[0].p.text.slice(0, limit - 20) }];
    chosen.sort((a, b) => a.page - b.page);
  }
  return { text: chosen.map(block).join("\n\n"), used: chosen.map((p) => p.page), total: withText.length };
}

/** Characters of text, not counting spaces and line breaks. */
export const textChars = (pages: { text: string }[]) => pages.reduce((n, p) => n + p.text.replace(/\s/g, "").length, 0);

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

/**
 * Blank voltage is filled from the spec. Amps and plug come along only when the unit has no voltage, or it matches.
 * A unit with its own plug that isn't the spec's is on another outlet: it takes neither voltage nor amps from the spec.
 * Plugs are compared by NEMA code ("L6-30P" or "l6 30r" is "NEMA L6-30 twist-lock"), and a spec with no plug clashes with none.
 */
export function withSpecOutlet<T extends { model: string; voltage: string; plug: string; amps?: string }>(unit: T, spec: SpecOutlet | undefined): T {
  if (!spec) return unit;
  const ownVoltage = unit.voltage.trim();
  const ownPlug = unit.plug.trim();
  // "L6-30R", "l6 20p" and "L630" are all L6-30; "Hardwired" is "Hardwire only".
  const plugCode = (p: string) => {
    const t = p.toUpperCase();
    if (/HARD\s*-?\s*WIRE/.test(t)) return "hardwire";
    const m = t.match(/\b(L?)(5|6|14|15)\s*-?\s*(15|20|30|50)\s*[PR]?\b/);
    return m ? `${m[1]}${m[2]}-${m[3]}` : (nemaCode(p) ?? fold(p));
  };
  const plugMatch = !ownPlug || !spec.plug.trim() || fold(ownPlug) === fold(spec.plug) || plugCode(ownPlug) === plugCode(spec.plug);
  const voltsMatch = plugMatch && (!ownVoltage || fold(ownVoltage) === fold(spec.voltage));
  return {
    ...unit,
    voltage: ownVoltage || (plugMatch ? spec.voltage : ""),
    plug: ownPlug || (voltsMatch ? spec.plug : ""),
    amps: (unit.amps ?? "").trim() || (voltsMatch ? spec.amps : ""),
  };
}

export type OutletBits = { voltage: string; amps: string; plug: string };

/** One outlet when every config agrees. Differing configs are skipped so the print does not guess. */
export function outletFromConfigs(
  configs: readonly { voltage?: string | null; amps?: string | null; plug?: string | null }[],
): OutletBits | null {
  if (!configs.length) return null;
  const rows = configs.map((c) => ({ voltage: clean(c.voltage), amps: clean(c.amps), plug: clean(c.plug) }));
  const first = rows[0]!;
  const same = rows.every(
    (r) => fold(r.voltage) === fold(first.voltage) && fold(r.amps) === fold(first.amps) && fold(r.plug) === fold(first.plug),
  );
  return same ? first : null;
}

/** The sheet already tied to this model. A hand entry edits it, so a blank form can't replace it. */
export function tiedSheetId(sheetBooks: readonly { sheetId: number; bookId: number | null }[], bookId: number): number | null {
  return sheetBooks.find((r) => r.bookId === bookId)?.sheetId ?? null;
}

/** Hand entry is only for a sheet the reader could not read, and only when it sits on a model. */
export function handEntryForRow(row: {
  status: string;
  fileId: number;
  bookId: number | null;
}): { kind: "file"; fileId: number; bookId: number } | null {
  if (row.status !== "unreadable" || row.bookId == null) return null;
  return { kind: "file", fileId: row.fileId, bookId: row.bookId };
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
