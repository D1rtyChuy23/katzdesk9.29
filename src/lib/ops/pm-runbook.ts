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

export function stepList(def: RunbookDefinition, c: RunbookConfig): StepGroup[] {
  const out: StepGroup[] = [];
  for (const m of def.steps) {
    if (!matches(m.when, c)) continue;
    const items = m.items.filter((s) => matches(s.when, c));
    if (items.length) out.push({ module: m.module, items });
  }
  return out;
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

export function totalKits(lines: KitLine[]): number {
  return lines.reduce((a, k) => a + k.q, 0);
}

/** Step ids that apply to a config, in order; ticks for steps that no longer apply are ignored in progress. */
export function stepIds(groups: StepGroup[]): string[] {
  return groups.flatMap((g) => g.items.map((s) => `step:${s.id}`));
}

/** Plain-text kit list for pasting into an order email or chat. Short lines, no tables. */
export function kitListText(def: RunbookDefinition, c: RunbookConfig, header?: string, prices?: KitPrice[]): string {
  const model = def.models.find((m) => m.id === c.model) ?? def.models[0];
  const interval = def.intervals.find((i) => i.id === c.pm);
  const lines = kitList(def, c);
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
    out.push(`${k.ev} x${k.q}  ${k.name}${split}${price}`);
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

/** A PM style such as "36 month PM" → interval id "36"; null when it names no interval the definition offers. */
export function intervalFromStyle(def: RunbookDefinition, style: string | null | undefined): string | null {
  const m = /(\d+)\s*[- ]?\s*(?:month|mo)/i.exec(style ?? "");
  if (!m) return null;
  return def.intervals.some((i) => i.id === m[1]) ? m[1] : null;
}

/**
 * Eversys PM cycle (all Eversys equipment): year 1 is a 12-month PM, year 2 is a 12-month PM, and year 3 is the
 * 12 and 36-month PMs together, then the cycle repeats. The 36-month list already contains the 12-month kits, so
 * "36" here means both sets. Generic over the definition: the cycle is the longest interval over the shortest.
 *
 * Recommended PM interval from the unit's install date at this location, on each anniversary. Returns null
 * without a usable install date. The tech can always choose otherwise (what the customer wants, or what is
 * recommended): this only sets the default.
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
  const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
  const ids = def.intervals.map((i) => Number(i.id)).filter((n) => n > 0).sort((a, b) => a - b);
  if (!ids.length) return null;
  const unit = ids[0];
  const milestone = Math.max(unit, Math.round(months / unit) * unit);
  const pick = [...ids].reverse().find((n) => milestone % n === 0) ?? unit;
  return { id: String(pick), months, milestone, year: milestone / 12, combined: pick > unit };
}

/**
 * Next interval from a unit's earlier full (completed) PMs, oldest first, for a unit with no install date:
 * after two short PMs in a row the next one is the long (combined) PM, otherwise the short one.
 * Returns null with no earlier PM to go on.
 */
export function nextFromHistory(def: RunbookDefinition, priorIntervals: string[]): { id: string; combined: boolean } | null {
  const ids = def.intervals.map((i) => Number(i.id)).filter((n) => n > 0).sort((a, b) => a - b);
  if (!ids.length || !priorIntervals.length) return null;
  const short = ids[0];
  const long = ids[ids.length - 1];
  const cycle = Math.max(1, Math.round(long / short));
  let run = 0;
  for (const raw of priorIntervals) {
    const n = Number(raw);
    run = n >= long && long > short ? 0 : run + 1;
  }
  const next = long > short && run % cycle === cycle - 1 ? long : short;
  return { id: String(next), combined: next > short };
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
