/**
 * PM runbook — pure logic. Ported unchanged in behavior from the standalone runbook page: a machine
 * definition plus a unit's config in, a kit list and a step list out. No DOM, no database, safe for node --test.
 */
import { anyFound, kitPriceParts, summarizePrices, uncountedNote, usd, type KitPrice } from "./pm-runbook-prices.ts";
import type { RunbookConfig, RunbookDefinition } from "./pm-runbook-schema.ts";

export type KitLine = {
  ev: string;
  name: string;
  module: string;
  interval: number;
  /** Total quantity after merging every rule that shares this kit number. */
  q: number;
  /** The "made up of" split; only meaningful when it has more than one entry. */
  parts: { q: number; label: string }[];
  notes: string[];
  /** True when a tech added this kit from the longer-interval list. It is not part of the visit's own list. */
  added?: boolean;
};

export type StepGroup = { module: string; items: { id: string; text: string; ref?: string }[] };

/** `when`: for each key, the values that make the rule apply. All keys must match. */
export function matches(when: Record<string, string[]> | undefined | null, c: RunbookConfig): boolean {
  if (!when) return true;
  for (const k of Object.keys(when)) {
    if (when[k].indexOf(String(c[k])) === -1) return false;
  }
  return true;
}

/** A quantity or label is either a plain value or `{by, map}` keyed on an option value. Unmapped → 0. */
export function resolve<T extends number | string>(v: T | { by: string; map: Record<string, T> } | null | undefined, c: RunbookConfig): T | 0 | null | undefined {
  if (v == null) return v as null | undefined;
  if (typeof v === "object") {
    const r = v.map[String(c[v.by])];
    return r == null ? 0 : r;
  }
  return v;
}

/** Kit rules that share a kit number are added together, in order of first appearance. */
export function kitList(def: RunbookDefinition, c: RunbookConfig): KitLine[] {
  const order: KitLine[] = [];
  const by: Record<string, KitLine> = {};
  for (const k of def.kits) {
    if (!matches(k.when, c)) continue;
    if (Number(k.interval) > Number(c.pm)) continue;
    const q = Number(resolve(k.qty, c));
    if (!(q > 0)) continue;
    let e = by[k.ev];
    if (!e) {
      e = by[k.ev] = { ev: k.ev, name: k.name, module: k.module, interval: k.interval, q: 0, parts: [], notes: [] };
      order.push(e);
    }
    e.q += q;
    const part = k.part != null ? resolve(k.part, c) : null;
    if (part) e.parts.push({ q, label: String(part) });
    if (k.note && e.notes.indexOf(k.note) === -1) e.notes.push(k.note);
  }
  return order;
}

/** The longest interval in the definition ("36" on the e'4). Optional kits are taken from this list. */
export function longestIntervalId(def: RunbookDefinition): string {
  return def.intervals.reduce((best, i) => (Number(i.id) > Number(best) ? i.id : best), def.intervals[0]?.id ?? "36");
}

/**
 * Kits the longest interval would include that this visit does not already list.
 * A kit whose own rule names a visit (`when.pm`) belongs to that visit only, so it is never optional.
 * The quantity is the longest-interval quantity. A visit already at that interval has none.
 */
export function optionalKits(def: RunbookDefinition, c: RunbookConfig): KitLine[] {
  const longest = longestIntervalId(def);
  if (String(c.pm) === String(longest)) return [];
  const visitOnly = new Set(def.kits.filter((k) => k.when && Object.hasOwn(k.when, "pm")).map((k) => k.ev));
  const current = new Set(kitList(def, c).map((k) => k.ev));
  return kitList(def, { ...c, pm: longest }).filter((k) => !current.has(k.ev) && !visitOnly.has(k.ev));
}

/** The visit's kits, with added kit numbers that are still optional, in definition order. */
export function kitListWithAdded(def: RunbookDefinition, c: RunbookConfig, added: readonly string[]): KitLine[] {
  const base = kitList(def, c).map((k) => ({ ...k, added: false }));
  const have = new Set(base.map((k) => k.ev));
  const optionalByEv = new Map(optionalKits(def, c).map((k) => [k.ev, k]));
  const wanted = new Set(added);
  const moduleOrder: string[] = [];
  for (const k of def.kits) if (!moduleOrder.includes(k.module)) moduleOrder.push(k.module);
  const extras = new Map<string, KitLine[]>();
  const seen = new Set<string>();
  for (const k of def.kits) {
    if (seen.has(k.ev)) continue;
    seen.add(k.ev);
    if (!wanted.has(k.ev) || have.has(k.ev)) continue;
    const kit = optionalByEv.get(k.ev);
    if (!kit) continue;
    have.add(k.ev);
    const list = extras.get(k.module) ?? [];
    list.push({ ...kit, added: true });
    extras.set(k.module, list);
  }
  const baseByModule = new Map<string, KitLine[]>();
  for (const k of base) {
    const list = baseByModule.get(k.module) ?? [];
    list.push(k);
    baseByModule.set(k.module, list);
  }
  const out: KitLine[] = [];
  for (const module of moduleOrder) {
    out.push(...(baseByModule.get(module) ?? []), ...(extras.get(module) ?? []));
  }
  return out;
}

/** Optional kits not yet added. `groups` limits them to one module's runbook groups. */
export function optionalKitsLeft(def: RunbookDefinition, c: RunbookConfig, added: readonly string[], groups?: readonly string[]): KitLine[] {
  const have = new Set(added);
  return optionalKits(def, c).filter((k) => !have.has(k.ev) && (!groups || groups.includes(k.module)));
}

/** Kit numbers such as EV109586, F.3.040 and SA600/K2. */
export const KIT_NUMBER_RE = /^[A-Za-z0-9._/-]{1,40}$/;
/** A tick key: `kit:SA600/K2` or `step:hyd-kit`. */
export const CHECK_KEY_RE = /^(kit|step):[A-Za-z0-9._/-]{1,80}$/;

export function parseAddedKits(v: unknown): string[] {
  const x = typeof v === "string" ? safeJson(v) : v;
  if (!Array.isArray(x)) return [];
  const out: string[] = [];
  for (const n of x) if (typeof n === "string" && KIT_NUMBER_RE.test(n) && !out.includes(n)) out.push(n);
  return out;
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return [];
  }
}

export type AddedChange = { ok: true; added: string[]; dropTick: boolean; changed: boolean } | { ok: false; reason: string };

/**
 * Add or remove one stored kit number. Other stored numbers stay, even when they are not optional right now.
 * The tick is dropped only when a removed kit is not already in this visit's own kit list.
 * Removing a number that is not stored is a no-op.
 */
export function changeAddedKits(
  def: RunbookDefinition,
  c: RunbookConfig,
  current: readonly string[],
  ev: string,
  on: boolean,
  groups?: readonly string[],
  place: "pm" | "service" = "pm",
): AddedChange {
  const reason = place === "service" ? "That kit is not optional for this service." : "That kit is not optional for this PM.";
  const optional = optionalKits(def, c);
  const allowed = groups ? optional.filter((k) => groups.includes(k.module)) : optional;
  const allowedIds = new Set(allowed.map((k) => k.ev));
  if (on) {
    if (!allowedIds.has(ev)) return { ok: false, reason };
    if (current.includes(ev)) return { ok: true, added: [...current], dropTick: false, changed: false };
    return { ok: true, added: [...current, ev], dropTick: false, changed: true };
  }
  if (!current.includes(ev)) return { ok: true, added: [...current], dropTick: false, changed: false };
  if (groups) {
    const module = def.kits.find((k) => k.ev === ev)?.module;
    if (module && !groups.includes(module)) return { ok: false, reason };
  }
  const base = kitList(def, c).some((k) => k.ev === ev);
  return { ok: true, added: current.filter((id) => id !== ev), dropTick: !base, changed: true };
}

/** The sentence stored for an add or a remove. The unit key is not part of it. */
export function addedKitSentence(def: RunbookDefinition, ev: string, on: boolean): string {
  const kit = def.kits.find((k) => k.ev === ev);
  const name = kit?.name ?? ev;
  const interval = kit?.interval ?? Number(longestIntervalId(def));
  return `${on ? "Added" : "Removed"} ${ev} ${name} (${interval}-month kit)`;
}

/** Activity detail: the sentence, then the unit key and the piece key on their own lines. */
export function addedKitDetail(sentence: string, unitKey: string, pieceKey: string): string {
  return `${sentence}\n${unitKey}\n${pieceKey}`;
}

/** The sentence, without the keys stored under it. */
export function addedKitVisible(detail: string | null | undefined): string {
  return String(detail ?? "").split("\n")[0] ?? "";
}

/** Unit keys stored under the sentence, so history still matches after Log the asset moves the key. */
export function addedKitStoredKeys(detail: string | null | undefined): string[] {
  return String(detail ?? "")
    .split("\n")
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The line a person reads. New rows are already "Added …" or "Removed …".
 * Older rows start with the unit key (`piece:…: EV109590 …`); the verb is put back on.
 */
export function addedKitHistoryLine(action: string, detail: string | null | undefined): string {
  const first = addedKitVisible(detail).trim();
  if (/^(Added|Removed)\b/.test(first)) return first;
  const verb = action === "kit removed" ? "Removed" : "Added";
  const rest = first.replace(/^.*: /, "");
  return rest ? `${verb} ${rest}` : verb;
}

export type UnitHistoryLine = { who: string | null; at: string; detail: string };

/** True when this kit note belongs to this unit. New rows store the unit key then the piece key. Old rows start with the unit key. */
export function kitHistoryMatches(unit: { unitKey: string; pieceKey: string }, detail: string | null | undefined): boolean {
  const text = String(detail ?? "");
  const stored = addedKitStoredKeys(text);
  if (stored.length) return (unit.unitKey.startsWith("acct:") && stored[0] === unit.unitKey) || stored[1] === unit.pieceKey;
  return text.startsWith(`${unit.unitKey}: `);
}

function historyIso(at: Date | string): string {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? String(at) : d.toISOString();
}

/**
 * Kit notes and option notes for one unit, newest first, at most 20.
 * `at` is an ISO string. A Date must not be sorted with String(date): that orders by the weekday name.
 */
export function unitHistory(
  unit: { unitKey: string; pieceKey: string },
  kitRows: readonly { who: string | null; action: string; detail: string | null; at: Date | string }[],
  optionRows: readonly { who: string | null; at: Date | string; detail: string | null }[],
): UnitHistoryLine[] {
  const lines: UnitHistoryLine[] = [
    ...kitRows
      .filter((row) => kitHistoryMatches(unit, row.detail))
      .map((row) => ({ who: row.who, at: historyIso(row.at), detail: addedKitHistoryLine(row.action, row.detail) })),
    ...optionRows.map((row) => ({ who: row.who, at: historyIso(row.at), detail: row.detail ?? "" })),
  ];
  return lines.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 20);
}

/**
 * One statement: append the kit if it is not already stored, and write the activity row only when a row changed.
 * $1 pm id, $2 unit key, $3 runbook id, $4 kit number, $5 actor, $6 serial key, $7 detail.
 */
export function pmAddKitSql(): string {
  return `with up as (
    insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, added_kits, updated_by, serial_key)
    values ($1::int, $2::text, $3::text, jsonb_build_array($4::text), $5::text, $6::text)
    on conflict (pm_job_id, unit_key) do update
      set added_kits = coalesce(pm_runbook_units.added_kits, '[]'::jsonb) || jsonb_build_array($4::text),
          updated_by = excluded.updated_by,
          serial_key = coalesce(pm_runbook_units.serial_key, excluded.serial_key),
          updated_at = now()
    where not (coalesce(pm_runbook_units.added_kits, '[]'::jsonb) @> jsonb_build_array($4::text))
    returning pm_job_id
  ), act as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select 'pm', $1::int, $5::text, 'kit added', $7::text from up
    returning id
  )
  select coalesce((select count(*) from up), 0)::int as changed`;
}

/**
 * One statement: take the kit off the stored list and write one activity row when a row changed.
 * Deletes the check keys in $6 (the kit tick and any fitting step) only for that changed row.
 * $1 pm id, $2 unit key, $3 kit number, $4 actor, $5 detail, $6 check keys.
 */
export function pmRemoveKitSql(): string {
  return `with up as (
    update pm_runbook_units
       set added_kits = coalesce(added_kits, '[]'::jsonb) - $3::text,
           updated_by = $4::text,
           updated_at = now()
     where pm_job_id = $1::int and unit_key = $2::text
       and coalesce(added_kits, '[]'::jsonb) @> jsonb_build_array($3::text)
    returning pm_job_id, unit_key
  ), act as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select 'pm', $1::int, $4::text, 'kit removed', $5::text from up
    returning id
  ), tick as (
    delete from pm_runbook_checks c
     using up
     where c.pm_job_id = up.pm_job_id and c.unit_key = up.unit_key and c.key = any($6::text[])
    returning c.key
  )
  select coalesce((select count(*) from up), 0)::int as changed`;
}

/** $1 service id, $2 kit number, $3 module id, $4 actor, $5 detail. */
export function benchAddKitSql(): string {
  return `with up as (
    update module_runbook_services
       set added_kits = coalesce(added_kits, '[]'::jsonb) || jsonb_build_array($2::text)
     where id = $1 and not (coalesce(added_kits, '[]'::jsonb) @> jsonb_build_array($2::text))
    returning id
  ), act as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select 'module', $3::int, $4, 'kit added', $5 from up
    returning id
  )
  select coalesce((select count(*) from up), 0)::int as changed`;
}

/** $1 service id, $2 kit number, $3 module id, $4 actor, $5 detail, $6 check keys. */
export function benchRemoveKitSql(): string {
  return `with up as (
    update module_runbook_services
       set added_kits = coalesce(added_kits, '[]'::jsonb) - $2::text
     where id = $1::int and coalesce(added_kits, '[]'::jsonb) @> jsonb_build_array($2::text)
    returning id
  ), act as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select 'module', $3::int, $4::text, 'kit removed', $5::text from up
    returning id
  ), tick as (
    delete from module_runbook_checks c
     using up
     where c.service_id = up.id and c.key = any($6::text[])
    returning c.key
  )
  select coalesce((select count(*) from up), 0)::int as changed`;
}

export function stepList(def: RunbookDefinition, c: RunbookConfig): StepGroup[] {
  const out: StepGroup[] = [];
  for (const m of def.steps) {
    if (!matches(m.when, c)) continue;
    const items = m.items.filter((s) => matches(s.when, c));
    if (items.length) out.push({ module: m.module, items });
  }
  return out;
}

/** Steps for this visit, plus any step whose text or reference names a kit that was added. */
export function stepsForVisit(def: RunbookDefinition, c: RunbookConfig, added: readonly string[]): StepGroup[] {
  const base = stepList(def, c);
  const shown = new Set(base.flatMap((g) => g.items.map((s) => s.id)));
  const evs = kitListWithAdded(def, c, added)
    .filter((k) => k.added)
    .map((k) => k.ev);
  const extra = new Set<string>();
  if (evs.length) {
    for (const group of def.steps) {
      if (!matches(withoutInterval(group.when), c)) continue;
      for (const s of group.items) {
        if (shown.has(s.id) || !matches(withoutInterval(s.when), c)) continue;
        const blob = `${s.text} ${s.ref ?? ""}`;
        if (evs.some((ev) => blob.includes(ev))) extra.add(s.id);
      }
    }
  }
  const out: StepGroup[] = [];
  for (const group of def.steps) {
    const items = group.items.filter((s) => shown.has(s.id) || extra.has(s.id));
    if (items.length) out.push({ module: group.module, items });
  }
  return out;
}

/** Step keys this one kit adds on top of the visit's own steps. A kit the visit already lists adds none. */
export function fittingStepKeys(def: RunbookDefinition, c: RunbookConfig, ev: string): string[] {
  const base = new Set(stepIds(stepList(def, c)));
  return stepIds(stepsForVisit(def, c, [ev])).filter((id) => !base.has(id));
}

/** Check keys a remove clears: the kit tick only when it was not already on this visit, plus any fitting step it brought. */
export function removedKitCheckKeys(def: RunbookDefinition, c: RunbookConfig, ev: string, dropTick: boolean): string[] {
  const steps = fittingStepKeys(def, c, ev);
  return dropTick ? [`kit:${ev}`, ...steps] : steps;
}

/** Drop the PM interval so a 12-month visit still counts a module the machine has. */
function withoutInterval(when: Record<string, string[]> | undefined | null): Record<string, string[]> | undefined | null {
  if (!when) return when;
  const rest: Record<string, string[]> = {};
  for (const key of Object.keys(when)) {
    if (key === "pm") continue;
    rest[key] = when[key]!;
  }
  return Object.keys(rest).length ? rest : undefined;
}

/**
 * Module groups that have a kit or a step for this model and options.
 * The service interval does not hide a module the machine has. E'4S has no milk module and no milk frame.
 */
export function applicableModules(def: RunbookDefinition, c: RunbookConfig): string[] {
  const names: string[] = [];
  const add = (name: string) => {
    if (!names.includes(name)) names.push(name);
  };
  for (const k of def.kits) {
    if (!matches(withoutInterval(k.when), c)) continue;
    const q = Number(resolve(k.qty, c));
    if (!(q > 0)) continue;
    add(k.module);
  }
  for (const group of def.steps) {
    if (!matches(withoutInterval(group.when), c)) continue;
    const items = group.items.filter((s) => matches(withoutInterval(s.when), c));
    if (items.length) add(group.module);
  }
  return names;
}

/** Desk module type → runbook group names. "Milk module V2" still counts as Milk. */
const MODULE_TYPE_GROUPS: Record<string, string[]> = {
  "Brew Module": ["Brew module"],
  "Medium Brew Module": ["Brew module"],
  "Large Brew Module": ["Brew module"],
  "Steam S Module": ["Steam module"],
  "Steam M Module": ["Steam module"],
  "Hydraulic Module": ["Hydraulic module"],
  "Grinder Module": ["Grinder module"],
  "Milk Module": ["Milk module"],
  "Pump Module": ["Pump module"],
  "Powder Module": ["E'choco"],
};

function groupCovers(group: string, alias: string): boolean {
  const g = group.toLowerCase();
  const a = alias.toLowerCase();
  return g === a || g.startsWith(`${a} `);
}

function moduleNoun(type: string): string {
  return type
    .replace(/\s+[SM]\s+Module$/i, " Module")
    .replace(/^(Medium|Large)\s+/i, "")
    .replace(/\s+Module$/i, "")
    .trim()
    .toLowerCase();
}

export type ModuleTypeFit = { ok: boolean; group: string | null; reason: string | null };

function definedGroups(def: RunbookDefinition): string[] {
  const names: string[] = [];
  for (const k of def.kits) if (!names.includes(k.module)) names.push(k.module);
  for (const g of def.steps) if (!names.includes(g.module)) names.push(g.module);
  return names;
}

function whenKnown(
  when: Record<string, string[]> | undefined | null,
  c: RunbookConfig,
  savedKeys: readonly string[] | null,
): boolean {
  if (!when) return true;
  for (const k of Object.keys(when)) {
    if (k === "pm") continue;
    if (savedKeys && k !== "model" && !savedKeys.includes(k)) continue;
    if ((when[k] ?? []).indexOf(String(c[k] ?? "")) === -1) return false;
  }
  return true;
}

/** The runbook group this type lands on for this config, or null when nothing applies. */
function appliedGroup(def: RunbookDefinition, c: RunbookConfig, alias: string, savedKeys: readonly string[] | null): string | null {
  for (const k of def.kits) {
    if (!groupCovers(k.module, alias) || !whenKnown(k.when, c, savedKeys)) continue;
    if (Number(resolve(k.qty, c)) > 0) return k.module;
  }
  for (const g of def.steps) {
    if (!groupCovers(g.module, alias) || !whenKnown(g.when, c, savedKeys)) continue;
    if (g.items.some((s) => whenKnown(s.when, c, savedKeys))) return g.module;
  }
  return null;
}

/**
 * Whether this desk module type belongs on the unit. A type this runbook never mentions is allowed.
 * `savedKeys` is the option keys actually stored on the unit. Omit it when the config is complete.
 * With an empty list, only the model can exclude a type, so E'choco stays allowed until someone saves choco.
 */
export function moduleTypeFit(
  def: RunbookDefinition,
  c: RunbookConfig,
  moduleType: string,
  savedKeys?: readonly string[] | null,
): ModuleTypeFit {
  const label = def.models.find((m) => m.id === c.model)?.label ?? c.model;
  const aliases = MODULE_TYPE_GROUPS[moduleType] ?? [moduleType];
  const known = definedGroups(def);
  const knownAlias = aliases.find((alias) => known.some((g) => groupCovers(g, alias)));
  if (!knownAlias) return { ok: true, group: null, reason: null };
  const hit = appliedGroup(def, c, knownAlias, savedKeys === undefined ? null : savedKeys);
  if (hit) return { ok: true, group: hit, reason: null };
  return { ok: false, group: null, reason: `${label} has no ${moduleNoun(moduleType)} module` };
}

export function platformFit(
  allowed: readonly string[],
  platform: string,
  machineLabel: string,
): { ok: boolean; reason: string | null } {
  if (allowed.includes(platform)) return { ok: true, reason: null };
  const which = allowed.length ? allowed.join(" or ") : "another platform";
  return { ok: false, reason: `${machineLabel} is ${which}, not ${platform}.` };
}

/** Why this module cannot go on this unit, or null when it can. A blank type or platform is not a reason. */
export function moduleAssignmentBlock(
  def: RunbookDefinition,
  c: RunbookConfig,
  moduleType: string | null | undefined,
  platform: string | null | undefined,
  allowedPlatforms: readonly string[],
  savedKeys?: readonly string[] | null,
): string | null {
  const label = def.models.find((m) => m.id === c.model)?.label ?? c.model;
  if (platform) {
    const platformReason = platformFit(allowedPlatforms, platform, label).reason;
    if (platformReason) return platformReason;
  }
  if (moduleType) {
    const typeReason = moduleTypeFit(def, c, moduleType, savedKeys).reason;
    if (typeReason) return typeReason;
  }
  return null;
}

/** Runbook groups for a desk module type, or null when this definition has none (Pump, or another family). */
export function moduleRunbookGroups(def: RunbookDefinition, moduleType: string | null | undefined): string[] | null {
  if (!moduleType) return null;
  const aliases = MODULE_TYPE_GROUPS[moduleType] ?? [moduleType];
  const names = definedGroups(def).filter((g) => aliases.some((alias) => groupCovers(g, alias)));
  return names.length ? names : null;
}

/** Kits and steps for one module type. Null when the definition has no group for it. */
export function moduleServiceView(
  def: RunbookDefinition,
  c: RunbookConfig,
  moduleType: string | null | undefined,
  added?: readonly string[],
): { groups: string[]; kits: KitLine[]; steps: StepGroup[] } | null {
  const groups = moduleRunbookGroups(def, moduleType);
  if (!groups) return null;
  return {
    groups,
    kits: kitListWithAdded(def, c, added ?? []).filter((k) => groups.includes(k.module)),
    steps: stepsForVisit(def, c, added ?? []).filter((g) => groups.includes(g.module)),
  };
}

/** Options that change this module's kits or steps. Model and interval are not options. */
export function moduleServiceOptions(def: RunbookDefinition, moduleType: string | null | undefined) {
  const groups = moduleRunbookGroups(def, moduleType) ?? [];
  const keys = new Set<string>();
  const take = (when: Record<string, string[]> | undefined | null, qty?: unknown) => {
    if (when) for (const k of Object.keys(when)) if (k !== "pm" && k !== "model") keys.add(k);
    if (qty && typeof qty === "object" && "by" in qty && typeof qty.by === "string") keys.add(qty.by);
  };
  for (const k of def.kits) if (groups.includes(k.module)) take(k.when, k.qty);
  for (const g of def.steps) {
    if (!groups.includes(g.module)) continue;
    take(g.when);
    for (const s of g.items) take(s.when);
  }
  return def.options.filter((o) => keys.has(o.key));
}

/**
 * Bench setup: the interval and options the tech saved, and the first model whose lists are not empty.
 * A milk module therefore uses E'4MS even though the default model is E'4S.
 */
export function moduleBenchConfig(
  def: RunbookDefinition,
  moduleType: string,
  interval: string | null | undefined,
  saved: Record<string, string>,
): RunbookConfig {
  const base = defaultConfig(def);
  if (interval && def.intervals.some((i) => i.id === interval)) base.pm = interval;
  let model = base.model;
  for (const m of def.models) {
    const view = moduleServiceView(def, normalizeConfig(def, { ...base, ...saved, model: m.id }), moduleType);
    if (view && (view.kits.length || view.steps.length)) {
      model = m.id;
      break;
    }
  }
  return normalizeConfig(def, { ...base, ...saved, model, pm: base.pm });
}

/** Checked kits to write onto the module. The Parts list SKU when we have one, otherwise the kit number. */
export function moduleServiceWorkLines(
  kits: KitLine[],
  ticked: readonly string[],
  skus: Readonly<Record<string, string | null | undefined>>,
): { item: string; qty: number; description: string }[] {
  const on = new Set(ticked);
  return kits
    .filter((k) => on.has(`kit:${k.ev}`) && k.q > 0)
    .map((k) => ({ item: skus[k.ev] || k.ev, qty: k.q, description: k.name }));
}

export type SharedCheck = { key: string; who: string | null; at: string };

export const MODULE_NOT_ON_PM = "This module is not on a unit of this PM.";

/** serial_key on a PM check: the unit's serial, never the acct:<id> fallback. */
export function checkSerialKey(optionsKey: string | null | undefined): string | null {
  return optionsKey && !optionsKey.startsWith("acct:") ? optionsKey : null;
}

/** True when this module's account unit is one of the PM's planned units. */
export function moduleOnThisPm(accountIds: readonly (number | null)[], assignedUnitId: number | null): boolean {
  return assignedUnitId != null && accountIds.includes(assignedUnitId);
}

/**
 * Checks the module sheet shows. On site they are the PM unit's checks (same who/when).
 * A second tick of a key already there does not replace who/when — the PM sheet keeps the first stamp.
 */
export function applySharedTick(checks: readonly SharedCheck[], key: string, on: boolean, who: string, at: string): SharedCheck[] {
  if (!on) return checks.filter((c) => c.key !== key);
  if (checks.some((c) => c.key === key)) return [...checks];
  return [...checks, { key, who, at }];
}

export function checksForModuleSheet(
  context: "bench" | "pm",
  moduleKeys: readonly string[],
  unitChecks: readonly SharedCheck[],
  benchChecks: readonly SharedCheck[],
): SharedCheck[] {
  if (context === "bench") return [...benchChecks];
  const want = new Set(moduleKeys);
  return unitChecks.filter((c) => want.has(c.key));
}

/** Plain-text kit list for one module, for pasting into an order. */
export function moduleKitListText(title: string, intervalLabel: string, kits: KitLine[], prices?: KitPrice[]): string {
  const out = [title, intervalLabel, ""];
  for (const k of kits) {
    const p = prices?.find((x) => x.ev === k.ev);
    const price = p ? `  [${kitPriceParts(p).join(", ")}]` : "";
    const mark = k.added ? " (added)" : "";
    out.push(`${k.ev} x${k.q}  ${k.name}${mark}${price}`);
  }
  if (!kits.length) out.push("No kits for this setup.");
  else {
    out.push("");
    out.push(`${kits.length} kit lines, ${totalKits(kits)} kits in total`);
  }
  return out.join("\n");
}

/** First model, first interval, each option at its default (or first choice). */
export function defaultConfig(def: RunbookDefinition): RunbookConfig {
  const d: RunbookConfig = { model: def.models[0].id, pm: def.intervals[0].id };
  for (const o of def.options) d[o.key] = o.default != null ? o.default : o.choices[0].val;
  return d;
}

/** Drop saved values the definition no longer offers, then fill the rest from defaults. */
export function normalizeConfig(def: RunbookDefinition, saved: Record<string, unknown> | null | undefined): RunbookConfig {
  const base = defaultConfig(def);
  const out: RunbookConfig = { ...base };
  const ok: Record<string, Set<string>> = {
    model: new Set(def.models.map((m) => m.id)),
    pm: new Set(def.intervals.map((i) => i.id)),
  };
  for (const o of def.options) ok[o.key] = new Set(o.choices.map((c) => c.val));
  for (const [k, v] of Object.entries(saved ?? {})) {
    if (ok[k] && ok[k].has(String(v))) out[k] = String(v);
  }
  return out;
}

/** The option keys a machine config stores on the asset (everything except model and PM interval). */
export function optionKeys(def: RunbookDefinition): string[] {
  return def.options.map((o) => o.key);
}

/** Options hidden by their own `when` (the 1.5-Step choice on a model without milk) are not shown or counted. */
export function visibleOptions(def: RunbookDefinition, c: RunbookConfig) {
  return def.options.filter((o) => matches(o.when, c));
}

export function banners(def: RunbookDefinition, c: RunbookConfig) {
  return def.banners.filter((b) => matches(b.when, c));
}

/** The 12-month banner names the kits that were added, instead of saying only 12-month kits are listed. */
export function visitBanners(def: RunbookDefinition, c: RunbookConfig, added: readonly string[]) {
  const extras = kitListWithAdded(def, c, added).filter((k) => k.added);
  return banners(def, c).map((b) => {
    if (!extras.length || !/only 12-month kits are listed/i.test(b.text)) return b;
    return { ...b, text: b.text.replace("only 12-month kits are listed", `12-month kits are listed, plus added kits ${extras.map((k) => k.ev).join(", ")}`) };
  });
}

export function totalKits(lines: KitLine[]): number {
  return lines.reduce((a, k) => a + k.q, 0);
}

/** Step ids that apply to a config, in order; ticks for steps that no longer apply are ignored in progress. */
export function stepIds(groups: StepGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((s) => `step:${s.id}`));
}

/** Plain-text kit list for pasting into an order email or chat. Short lines, no tables. */
export function kitListText(def: RunbookDefinition, c: RunbookConfig, header?: string, prices?: KitPrice[], added?: readonly string[]): string {
  const model = def.models.find((m) => m.id === c.model) ?? def.models[0];
  const interval = def.intervals.find((i) => i.id === c.pm);
  const lines = kitListWithAdded(def, c, added ?? []);
  const out: string[] = [];
  if (header) out.push(header);
  out.push(`${model.label}, ${interval?.label ?? `${c.pm}-month PM`}`);
  const opts = visibleOptions(def, c)
    .map((o) => `${o.label}: ${o.choices.find((ch) => ch.val === c[o.key])?.label ?? c[o.key]}`)
    .join("; ");
  if (opts) out.push(opts);
  out.push("");
  let mod = "";
  for (const k of lines) {
    if (k.module !== mod) {
      if (mod) out.push("");
      out.push(k.module);
      mod = k.module;
    }
    const split = k.parts.length > 1 ? ` (${k.parts.map((p) => `${p.q} x ${p.label}`).join(" + ")})` : "";
    const p = prices?.find((x) => x.ev === k.ev);
    const price = p ? `  [${kitPriceParts(p).join(", ")}]` : "";
    const mark = k.added ? " (added)" : "";
    out.push(`${k.ev} x${k.q}  ${k.name}${split}${mark}${price}`);
  }
  if (!lines.length) out.push("No kits for this setup.");
  else {
    out.push("");
    out.push(`${lines.length} kit lines, ${totalKits(lines)} kits in total`);
    if (prices) {
      const s = summarizePrices(prices);
      const note = uncountedNote(s);
      out.push(anyFound(s) ? `Total at sell price: ${usd(s.total)}${note ? ` (${note})` : ""}` : "No kit prices found in the parts catalog yet.");
    }
  }
  return out.join("\n");
}

// ---------------- recognising units ----------------

/**
 * Eversys e'4 X-Wide in free text ("Eversys Enigma e'4m X-Wide Classic", "E4X-WIDE").
 * Returns null when the piece is not an X-Wide e'4. `model` is the definition model id, or null when the
 * text names X-Wide but not the S/MS variant (the tech picks it).
 */
export function matchE4XWide(piece: string | null | undefined): { model: "4s" | "4ms" | null } | null {
  const t = (piece ?? "").trim();
  if (!t) return null;
  if (!/\bx[\s-]?wide\b/i.test(t) && !/\be'?\s?4\s?x[\s-]?wide\b/i.test(t)) return null;
  if (!/\be[’']?\s?4/i.test(t)) return null;
  if (/\be[’']?\s?4\s?ms\b/i.test(t) || /\be[’']?\s?4\s?m\b/i.test(t)) return { model: "4ms" };
  if (/\be[’']?\s?4\s?s\b/i.test(t)) return { model: "4s" };
  return { model: null };
}

/** The style a new PM and the Corrigo import store when nobody has chosen one. */
export const DEFAULT_PM_STYLE = "12 month PM" as const;

export function isDefaultPmStyle(style: string | null | undefined): boolean {
  return String(style ?? "").trim().toLowerCase() === DEFAULT_PM_STYLE.toLowerCase();
}

/** True when this definition should not let the default style hide the install-date cycle. */
function defersDefaultStyle(def: RunbookDefinition, style: string | null | undefined): boolean {
  return !!def.defaultStyleLast && isDefaultPmStyle(style);
}

/** A PM style such as "36 month PM" → that interval id when the definition offers it.
 * Otherwise the largest offered interval that divides the month number ("9 month PM" → "3", "24 month PM" → "12").
 * Null when the style names no month, or no offered interval divides it ("6 month PM" on Eversys, so the install date still wins).
 */
export function intervalFromStyle(def: RunbookDefinition, style: string | null | undefined): string | null {
  const m = /(\d+)\s*[- ]?\s*(?:month|mo)/i.exec(style ?? "");
  if (!m) return null;
  const months = Number(m[1]);
  const ids = def.intervals.map((i) => Number(i.id)).filter((n) => n > 0).sort((a, b) => a - b);
  if (ids.includes(months)) return String(months);
  const fit = [...ids].reverse().find((id) => months % id === 0);
  return fit ? String(fit) : null;
}

/**
 * The interval and options for one unit on one visit. Saved choice wins, then the PM style,
 * then the install-date recommendation, then the earlier-PM history.
 * On a definition with `defaultStyleLast`, the default style waits until after the install date and history.
 * The PM sheet, the on-site module sheet and adding a kit all use this.
 */
export function visitConfig(
  def: RunbookDefinition,
  input: {
    savedInterval?: string | null;
    style?: string | null;
    installDate?: string | null;
    earlierIntervals?: readonly string[];
    model?: string | null;
    options?: Record<string, unknown> | null;
    now?: Date;
  },
): RunbookConfig {
  const recommended = recommendInterval(def, input.installDate, input.now);
  const fromHistory = recommended ? null : nextFromHistory(def, [...(input.earlierIntervals ?? [])]);
  const saved = input.savedInterval && def.intervals.some((i) => i.id === input.savedInterval) ? input.savedInterval : null;
  const fromStyle = intervalFromStyle(def, input.style);
  const pm = defersDefaultStyle(def, input.style)
    ? saved ?? recommended?.id ?? fromHistory?.id ?? fromStyle ?? undefined
    : saved ?? fromStyle ?? recommended?.id ?? fromHistory?.id ?? undefined;
  return normalizeConfig(def, { ...(input.options ?? {}), model: input.model ?? undefined, pm });
}

/**
 * Interval recorded for one completed visit. A saved choice wins. The default style counts as unknown
 * on a `defaultStyleLast` definition, so it does not pretend the visit was a 12-month PM.
 */
export function historyInterval(def: RunbookDefinition, savedInterval: string | null | undefined, style: string | null | undefined): string | null {
  const saved = savedInterval && def.intervals.some((i) => i.id === savedInterval) ? savedInterval : null;
  if (saved) return saved;
  if (defersDefaultStyle(def, style)) return null;
  return intervalFromStyle(def, style);
}

/** True when the equipment text or a saved choice already names a model. False opens on the first model and the tech should pick. */
export function unitModelPicked(savedModel: string | null | undefined, matchedModel: string | null | undefined): boolean {
  return !!(savedModel && String(savedModel).trim()) || !!(matchedModel && String(matchedModel).trim());
}

/** "year 3" when the milestone is a whole number of years, otherwise "month 3". */
export function milestoneAge(milestone: number): string {
  return milestone % 12 === 0 ? `year ${milestone / 12}` : `month ${milestone}`;
}

/** True when this visit's kit list also carries kits from a shorter visit. A kit that names its visit (`when.pm`) does not. */
export function visitCarriesShorter(def: RunbookDefinition, id: string): boolean {
  const n = Number(id);
  return def.kits.some((k) => Number(k.interval) < n && !(k.when && Object.hasOwn(k.when, "pm")));
}

/**
 * Eversys PM cycle (all Eversys equipment): year 1 is a 12-month PM, year 2 is a 12-month PM, and year 3 is the
 * 12 and 36-month PMs together, then the cycle repeats. The 36-month list already contains the 12-month kits, so
 * "36" here means both sets. Generic over the definition: the cycle is the longest interval over the shortest.
 *
 * Recommended PM interval from the unit's install date at this location, on each anniversary. Returns null
 * without a usable install date. The tech can always choose otherwise (what the customer wants, or what is
 * recommended): this only sets the default.
 * When the shortest interval is under 12 months, age is days / 30.4375 so the day of the month counts.
 * Eversys (shortest 12) stays on calendar months.
 */
export function recommendInterval(
  def: RunbookDefinition,
  installDate: string | null | undefined,
  now: Date = new Date(),
): { id: string; months: number; milestone: number; year: number; combined: boolean } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(installDate ?? ""));
  if (!m) return null;
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(start.getTime()) || start.getTime() > now.getTime()) return null;
  const ids = def.intervals.map((i) => Number(i.id)).filter((n) => n > 0).sort((a, b) => a - b);
  if (!ids.length) return null;
  const unit = ids[0];
  const calendar = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
  const months = unit < 12 ? (now.getTime() - start.getTime()) / 86400000 / 30.4375 : calendar;
  const milestone = Math.max(unit, Math.round(months / unit) * unit);
  const pick = [...ids].reverse().find((n) => milestone % n === 0) ?? unit;
  return { id: String(pick), months, milestone, year: milestone / 12, combined: visitCarriesShorter(def, String(pick)) };
}

/**
 * Next interval from a unit's earlier full (completed) PMs, oldest first, for a unit with no install date.
 * `pos` is months since the last longest PM. A longest PM sets it back to 0. Any other visit advances one
 * short step; if that visit was a longer interval than the slot it landed on, `pos` jumps to the next slot
 * whose interval is that visit. The next PM is the largest interval that divides `pos` plus one short step.
 * La Marzocco (3, 6, 12) still goes 3, 6, 3, 12 from a run of shorts, and a lone 6 is followed by a 3.
 * Eversys (12, 36) stays 12, 12, 36. Returns null with no earlier PM to go on.
 */
export function nextFromHistory(def: RunbookDefinition, priorIntervals: string[]): { id: string; combined: boolean } | null {
  const ids = def.intervals.map((i) => Number(i.id)).filter((n) => n > 0).sort((a, b) => a - b);
  if (!ids.length || !priorIntervals.length) return null;
  const short = ids[0];
  const long = ids[ids.length - 1];
  const at = (mark: number) => [...ids].reverse().find((id) => mark % id === 0) ?? short;
  let pos = 0;
  for (const raw of priorIntervals) {
    const v = Number(raw);
    if (v === long) {
      pos = 0;
      continue;
    }
    const slot = pos + short;
    if (ids.includes(v) && v > at(slot)) {
      let found = slot;
      const steps = Math.max(1, Math.ceil(long / short)) * 4;
      for (let step = 1; step <= steps; step++) {
        const candidate = slot + step * short;
        if (at(candidate) === v) {
          found = candidate;
          break;
        }
      }
      pos = found;
    } else {
      pos = slot;
    }
  }
  const next = at(pos + short);
  return { id: String(next), combined: visitCarriesShorter(def, String(next)) };
}

/**
 * The clause shown when a visit already includes the shorter intervals.
 * Empty when the longest visit does not carry shorter kits (La Marzocco: one kit per visit).
 * Plain "N-month PM" labels stay "12 + 36", so the Eversys sentences do not change.
 * Any other label uses the shortest and the longest: "the 3/9-month and 12-month PMs together".
 */
export function combinedVisitNotes(def: RunbookDefinition): { history: string; recommended: string } {
  const intervals = [...def.intervals].sort((a, b) => Number(a.id) - Number(b.id));
  const longest = intervals[intervals.length - 1]?.id;
  if (!longest || !visitCarriesShorter(def, longest)) return { history: "", recommended: "" };
  const plain = intervals.length > 0 && intervals.every((i) => /^\d+-month PM$/.test(i.label));
  if (plain) {
    const nums = intervals.map((i) => i.id).join(" + ");
    return { history: `, the ${nums} together visit`, recommended: ` (${nums} together)` };
  }
  const words = (label: string) => label.replace(/\s*PM\b.*$/, "");
  const short = words(intervals[0]?.label ?? "");
  const long = words(intervals[intervals.length - 1]?.label ?? "");
  const phrase = short && long && short !== long ? `the ${short} and ${long} PMs together` : short;
  return { history: phrase ? `, ${phrase}` : "", recommended: phrase ? ` (${phrase})` : "" };
}

/** Why this machine refuses a swappable module, or null when its runbook takes modules. */
export function modulesNotTakenReason(def: RunbookDefinition, modelId: string | null, takesModules: boolean): string | null {
  if (takesModules) return null;
  const label = def.models.find((m) => m.id === modelId)?.label ?? "This machine";
  return `${label} does not take Eversys modules.`;
}

// ---------------- who may do what ----------------

export type RunbookRole = "admin" | "sales" | "service" | "warehouse" | null;

/** Ticks and options: admin and service. Sales and warehouse (office) see them read-only. */
export function canWriteRunbook(role: RunbookRole, isAdmin: boolean): boolean {
  return isAdmin || role === "admin" || role === "service";
}

/** Machine definitions: admin only for now. Kept separate so it is one line to change. */
export function canEditRunbookDefinitions(role: RunbookRole, isAdmin: boolean): boolean {
  return isAdmin || role === "admin";
}

/** Activity action for the one service record a completed PM writes on a unit. */
export const PM_SERVICE_ACTION = "pm service";

/** Opening of that record. A later save looks for this so it does not write a second one. */
export function pmServicePrefix(pmId: number): string {
  return `PM #${pmId} completed`;
}

export function isPmServiceRecord(action: string, detail: string | null | undefined, pmId: number): boolean {
  return action === PM_SERVICE_ACTION && String(detail ?? "").startsWith(pmServicePrefix(pmId));
}

/**
 * One service record for a completed PM on one unit: the interval, the options, the kit list for that
 * config, and the steps that were ticked. The caller passes only the ticked steps.
 */
export function pmServiceRecord(input: {
  pmId: number;
  modelLabel: string;
  intervalLabel: string;
  options: { label: string; value: string }[];
  kits: { ev: string; q: number; name: string }[];
  steps: string[];
}): string {
  const lines = [`${pmServicePrefix(input.pmId)}. ${input.modelLabel}, ${input.intervalLabel}.`];
  lines.push(input.options.length ? `Options: ${input.options.map((o) => `${o.label}: ${o.value}`).join("; ")}.` : "Options: none.");
  lines.push(input.kits.length ? `Kits: ${input.kits.map((k) => `${k.q} x ${k.ev} ${k.name}`).join("; ")}.` : "Kits: none.");
  if (input.steps.length) {
    lines.push("Steps done:");
    for (const step of input.steps) lines.push(`- ${step}`);
  } else {
    lines.push("Steps done: none.");
  }
  return lines.join("\n");
}
