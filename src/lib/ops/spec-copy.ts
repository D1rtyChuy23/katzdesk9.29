/**
 * The Library — plain-text copy for Outlook/Teams. Pure: no DOM, safe for node --test.
 * Short lines, no markdown tables, so it pastes cleanly into an email or chat.
 */
import type { Dimensions, Drain, Power, Requirements, SpecConfig, SpecSheetDraft, Water } from "./spec-schema.ts";

const has = (v: string | undefined | null): v is string => !!v && !!v.trim();
const join = (parts: (string | undefined | null)[]) => parts.filter(has).map((p) => p.trim()).join(", ");

export function amps(v: string): string {
  return /^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}A` : v;
}
export function phase(v: string): string {
  const t = v.trim();
  if (/^[13]$/.test(t)) return `${t}-phase`;
  if (/^(single|1)\s*(ph|phase)?$/i.test(t)) return "1-phase";
  if (/^(three|3)\s*(ph|phase)?$/i.test(t)) return "3-phase";
  return t;
}
export function hz(v: string): string {
  return /^\d+$/.test(v.trim()) ? `${v.trim()} Hz` : v;
}
export function volts(v: string): string {
  return /^\d+(\s*[-–/]\s*\d+)?$/.test(v.trim()) ? `${v.trim()}V` : v;
}
/** 31.5" + W → 31.5"W; 31.5 → 31.5"W (bare numbers are read as inches). */
function dim(v: string, axis: "W" | "D" | "H"): string {
  const t = v.trim();
  return /^\d+(\.\d+)?$/.test(t) ? `${t}"${axis}` : `${t}${axis}`;
}

export function powerLine(p: Power | undefined): string | null {
  if (!p) return null;
  const breaker = p.breaker?.trim() ? `${p.breaker.trim()} breaker` : "";
  const ampsText = p.amps ? (breaker ? `${amps(p.amps)} (${breaker})` : amps(p.amps)) : breaker;
  const text = join([p.voltage && volts(p.voltage), ampsText, p.phase && phase(p.phase), p.hz && hz(p.hz), p.plug, p.circuit]);
  return text ? `Power: ${text}` : null;
}

export function waterLine(w: Water | undefined): string | null {
  if (!w) return null;
  const inlet = w.inlet && !/inlet|connection|line|fitting|valve|compression/i.test(w.inlet) ? `${w.inlet.trim()} inlet` : w.inlet;
  const text = join([inlet, w.pressure, w.filtration, w.notes]);
  return text ? `Water: ${text}` : null;
}

export function drainLine(d: Drain | undefined): string | null {
  if (!d) return null;
  const text = join([d.size, d.notes]);
  return text ? `Drain: ${text}` : null;
}

export function sizeLines(d: Dimensions | undefined): string[] {
  if (!d) return [];
  const box = [d.width && dim(d.width, "W"), d.depth && dim(d.depth, "D"), d.height && dim(d.height, "H")].filter(has).join(" x ");
  const size = join([box, d.weight && (/^\d+(\.\d+)?$/.test(d.weight.trim()) ? `${d.weight.trim()} lb` : d.weight)]);
  const out: string[] = [];
  if (size) out.push(`Size: ${size}`);
  if (has(d.clearance)) out.push(`Clearance: ${d.clearance.trim()}`);
  return out;
}

export function requirementLines(r: Requirements): string[] {
  const lines = [powerLine(r.power), waterLine(r.water), drainLine(r.drain), ...sizeLines(r.dimensions)].filter(
    (l): l is string => !!l,
  );
  for (const row of r.other ?? []) if (has(row.label) && has(row.value)) lines.push(`${row.label.trim()}: ${row.value.trim()}`);
  return lines;
}

type SheetLike = Pick<SpecSheetDraft, "manufacturer" | "model"> & Partial<Pick<SpecSheetDraft, "mfrNotes" | "configs">>;

function title(sheet: SheetLike): string {
  return [sheet.manufacturer, sheet.model].filter(has).map((s) => s.trim()).join(" ");
}

/** "Copy this configuration". */
export function copyConfig(sheet: SheetLike, config: SpecConfig): string {
  const label = config.label?.trim();
  const head = label && !/^standard$/i.test(label) ? `${title(sheet)} - ${label}` : title(sheet);
  const lines = requirementLines(config.requirements);
  return [head, ...(lines.length ? lines : ["No requirements listed"])].join("\n");
}

/** "Copy all": every configuration, one blank line apart, then US listings and warranty. */
export function copyAll(sheet: SheetLike): string {
  const configs = sheet.configs ?? [];
  const blocks = configs.length ? configs.map((c) => copyConfig(sheet, c)) : [title(sheet)];
  const tail: string[] = [];
  const certs = (sheet.mfrNotes?.certifications ?? []).filter(has);
  if (certs.length) tail.push(`Certifications: ${certs.join(", ")}`);
  if (has(sheet.mfrNotes?.warranty)) tail.push(`Warranty: ${sheet.mfrNotes!.warranty!.trim()}`);
  if (has(sheet.mfrNotes?.usContact)) tail.push(`US contact: ${sheet.mfrNotes!.usContact!.trim()}`);
  return [...blocks, ...(tail.length ? [tail.join("\n")] : [])].join("\n\n");
}
