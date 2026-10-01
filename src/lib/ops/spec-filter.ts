/**
 * The Library — deterministic non-USA pass. Pure: no I/O, safe for node --test.
 *
 * Runs after the AI extraction (which is also told to keep only USA info). Removes or trims
 * 220–240 V / 50 Hz electrical values, CE/UKCA/RoHS-only certification marks, non-US plugs,
 * metric-only water standards and non-US manufacturer contacts. Nothing is dropped silently:
 * every change comes back as a RemovedItem the review screen can restore.
 */
import type { Kv, SpecConfig, SpecSheetDraft } from "./spec-schema.ts";

export type RemovedReason = "voltage" | "frequency" | "certification" | "plug" | "water" | "contact" | "config";

/** Where the value lived, so Restore can put it back. */
export type RemovedPath =
  | { kind: "field"; section: "power" | "water" | "drain" | "dimensions"; key: string; config: string }
  | { kind: "spec"; index: number }
  | { kind: "other"; config: string; index: number }
  | { kind: "cert"; index: number }
  | { kind: "mfr"; key: "usContact" | "warranty" }
  | { kind: "config"; index: number };

export type RemovedItem = {
  id: string;
  /** Human label: "2 Group · Power · Voltage". */
  where: string;
  /** What was taken out. */
  removed: string;
  /** Full original value; Restore puts this back. */
  original: string | Kv | SpecConfig;
  /** What stays after trimming (empty when the whole value went). */
  kept: string;
  reason: RemovedReason;
  note: string;
  path: RemovedPath;
};

// ---------- rules ----------

const US_MARKS = /\b(c?UL|cULus|ETL|c?ETLus|NSF|CSA|ENERGY\s*STAR|Intertek|FCC|NEMA)\b/i;
const NON_US_MARKS = /\b(CE|UKCA|RoHS|WEEE|EAC|CCC|KC|VDE|GS|TÜV|TUV|SAA|RCM|PSE|DVGW|WRAS|KIWA|ÖVGW|SVGW|ACS)\b/i;
const NON_US_MARK_TOKENS = /^(CE|UKCA|RoHS(\s*\d+)?|WEEE|EAC|CCC|KC|VDE|GS|TÜV|TUV|SAA|RCM|PSE|DVGW|WRAS|KIWA|ÖVGW|SVGW|ACS|EN\s?\d[\d\-:. ]*|IEC\s?\d[\d\-:. ]*|2014\/\d+\/EU|20\d\d\/\d+\/EU)( marking| mark| compliant| certified)?$/i;

/** 220–240 V class and European 3-phase (380–415 V, 400 V 3N). 208–240 V and 240 V stay (US). */
const EURO_VOLT = /\b(2[23]0|380|400|415)\s*(?:[-–/]\s*(?:2[34]0|415|400))?\s*V(?:AC|olts?)?\b|\b3\s*N\s*~?\s*400\b/i;
/** A US supply voltage that starts the expression (so the "240" inside "220-240V" doesn't count). */
const US_VOLT = /(?<![\d\-–/]\s?)\b(100|110|115|120|125|200|208|240|277|440|460|480)\s*(?:[-–/]\s*\d{3})?\s*V/i;
const FIFTY_ONLY = /\b50\s*Hz\b/i;
const SIXTY = /\b60\s*Hz\b/i;
const FIFTY_SIXTY = /\b50\s*[/-]\s*60\s*Hz\b/i;

const NON_US_PLUG =
  /\b(schuko|cee\s*7\/?\d*|bs\s*1363|bs\s*546|type\s*[cefgijklm]\b|iec\s*60309|cee\s*form|uk\s*plug|eu(ro)?\s*plug|european\s*plug|as\/nzs\s*3112|si\s*32|gb\s*1002|sev\s*1011|cei\s*23-50|16\s*a\s*cee|32\s*a\s*cee)/i;
const US_PLUG = /\b(nema|l\d+-\d+|\d+-\d+[pr]\b|hardwire|hard-?wired|direct\s*wire|cord\s*and\s*plug)/i;

/** Non-US water standards and fittings — removed even when an inch size is quoted (BSP is not NPT). */
const METRIC_WATER = /(\bbsp[pt]?\b|\bg\s?[1-9]\/[1-9]\b|\bg\s?[1-9]"|\bdin\s?\d+|\ben\s?\d{3,5}\b|\bwras\b|\bkiwa\b|\bdvgw\b|\bacs\b|°\s?[df]h\b)/i;
/** Metric units — only removed when no imperial value sits next to them. */
const METRIC_ONLY_UNIT = /\d(?:[.,]\d+)?\s*(bar|mm|cm|kpa|mpa|l\/min|l\/h|litres?|liters?)\b/i;
const IMPERIAL = /(psi|"|”|\binch|\bin\.?\b|\bnpt\b|\bgpm\b|\bgph\b|\bgal|\bft\b|\blb|\bfl\.?\s?oz)/i;

const NON_US_PHONE = /\+\s?(?!1\b|1[\s\-(])\d{1,3}[\s\-(]/;
const US_PHONE = /(\+\s?1[\s\-(]|\(\d{3}\)\s?\d{3}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b1-8\d{2}-)/;
const NON_US_PLACE =
  /\b(italy|italia|germany|deutschland|united kingdom|\buk\b|england|switzerland|schweiz|suisse|france|netherlands|nederland|spain|españa|sweden|denmark|norway|austria|belgium|portugal|australia|new zealand|china|japan|korea|\.it\b|\.de\b|\.co\.uk\b|\.ch\b|\.fr\b|\.nl\b|\.com\.au\b)/i;
const US_STATE_ZIP = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY),?\s\d{5}(-\d{4})?\b/;

function splitParts(v: string): string[] {
  return v
    .split(/\s*(?:;|,|\bor\b|\s\/\s|(?<=\d\s?V)\s*\/\s*(?=\d)|\|)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Voltage: keep US parts, trim 220–240 V / 400 V parts. */
export function filterVoltage(v: string): { kept: string; removed: string[] } {
  const parts = splitParts(v);
  const removed = parts.filter((p) => EURO_VOLT.test(p) && !US_VOLT.test(p));
  if (!removed.length) return { kept: v, removed: [] };
  const kept = parts.filter((p) => !removed.includes(p));
  return { kept: kept.join(", "), removed };
}

/** Frequency: "50 Hz" goes; "50/60 Hz" becomes "60 Hz". */
export function filterHz(v: string): { kept: string; removed: string[] } {
  if (FIFTY_SIXTY.test(v)) return { kept: v.replace(FIFTY_SIXTY, "60 Hz"), removed: ["50 Hz"] };
  if (FIFTY_ONLY.test(v) && !SIXTY.test(v)) {
    const parts = splitParts(v);
    const removed = parts.filter((p) => FIFTY_ONLY.test(p));
    const kept = parts.filter((p) => !FIFTY_ONLY.test(p));
    return { kept: kept.join(", "), removed: removed.length ? removed : [v] };
  }
  if (FIFTY_ONLY.test(v) && SIXTY.test(v)) {
    const parts = splitParts(v);
    const removed = parts.filter((p) => FIFTY_ONLY.test(p) && !SIXTY.test(p));
    if (removed.length) return { kept: parts.filter((p) => !removed.includes(p)).join(", "), removed };
  }
  return { kept: v, removed: [] };
}

/** An electrical line like "230V 50Hz 1ph" or "120V/60Hz, 230V/50Hz". */
export function filterElectrical(v: string): { kept: string; removed: string[] } {
  // "220-240V / 50-60 Hz" is one supply: keep a volt/Hz pair together; only split bare voltage lists.
  const parts = v
    .split(/\s*(?:;|,|\bor\b|\|)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean)
    .flatMap((c) => (/hz/i.test(c) ? [c] : splitParts(c)));
  const removed: string[] = [];
  const kept: string[] = [];
  for (const p of parts) {
    const euroV = EURO_VOLT.test(p) && !US_VOLT.test(p);
    const fifty = FIFTY_ONLY.test(p) && !SIXTY.test(p) && !FIFTY_SIXTY.test(p);
    if (euroV || fifty) removed.push(p);
    else kept.push(FIFTY_SIXTY.test(p) ? p.replace(FIFTY_SIXTY, "60 Hz") : p);
  }
  if (!removed.length && !FIFTY_SIXTY.test(v)) return { kept: v, removed: [] };
  if (!removed.length) return { kept: kept.join(", "), removed: ["50 Hz"] };
  return { kept: kept.join(", "), removed };
}

export function filterPlug(v: string): { kept: string; removed: string[] } {
  const parts = splitParts(v);
  const removed = parts.filter((p) => NON_US_PLUG.test(p) && !US_PLUG.test(p));
  if (!removed.length) return { kept: v, removed: [] };
  return { kept: parts.filter((p) => !removed.includes(p)).join(", "), removed };
}

/** Certifications line: drop CE/UKCA/RoHS-type marks, keep UL/NSF/ETL/CSA. */
export function filterCertLine(v: string): { kept: string; removed: string[] } {
  // Unspaced slashes stay together ("NSF/ANSI 4", "CE/UKCA" is judged as one mark group).
  const parts = v
    .split(/\s*(?:,|;|\s\/\s|\band\b|&|\+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const removed = parts.filter((p) => !US_MARKS.test(p) && (NON_US_MARK_TOKENS.test(p) || NON_US_MARKS.test(p)));
  if (!removed.length) return { kept: v, removed: [] };
  return { kept: parts.filter((p) => !removed.includes(p)).join(", "), removed };
}

/** Water/drain: metric-only standards and fittings (BSP/G threads, DIN/EN, °dH, bar-only, mm-only). */
export function filterWater(v: string): { kept: string; removed: string[] } {
  const parts = splitParts(v);
  const removed = parts.filter((p) => METRIC_WATER.test(p) || (METRIC_ONLY_UNIT.test(p) && !IMPERIAL.test(p)));
  if (!removed.length) return { kept: v, removed: [] };
  return { kept: parts.filter((p) => !removed.includes(p)).join(", "), removed };
}

/** Contact: drop non-US phone numbers / addresses; keep US ones. */
export function filterContact(v: string): { kept: string; removed: string[] } {
  const lines = v
    .split(/\s*(?:\n|;|\s\|\s)\s*/)
    .map((l) => l.trim())
    .filter(Boolean);
  const removed = lines.filter((l) => {
    const foreignPhone = NON_US_PHONE.test(l);
    const foreign = foreignPhone || NON_US_PLACE.test(l);
    const us =
      /\+\s?1[\s\-(]/.test(l) ||
      US_STATE_ZIP.test(l) ||
      /\b(usa|united states|america)\b/i.test(l) ||
      (!foreignPhone && US_PHONE.test(l));
    return foreign && !us;
  });
  if (!removed.length) return { kept: v, removed: [] };
  return { kept: lines.filter((l) => !removed.includes(l)).join("; "), removed };
}

type Rule = (v: string) => { kept: string; removed: string[] };

const NOTE: Record<RemovedReason, string> = {
  voltage: "220–240 V / 400 V is not a US supply",
  frequency: "50 Hz is not used in the US",
  certification: "CE/UKCA/RoHS-type mark — not a US listing",
  plug: "Non-US plug type",
  water: "Metric-only water standard or fitting",
  contact: "Non-US manufacturer contact",
  config: "Configuration is for a non-US supply",
};

/** Which rule applies to a spec row, by its label. */
function ruleForLabel(label: string): { rule: Rule; reason: RemovedReason } | null {
  const l = label.toLowerCase();
  if (/certif|approval|listing|standard|compliance|marking/.test(l)) return { rule: filterCertLine, reason: "certification" };
  if (/plug|cord|connector/.test(l)) return { rule: filterPlug, reason: "plug" };
  if (/frequen|\bhz\b/.test(l)) return { rule: filterHz, reason: "frequency" };
  if (/volt|electr|power supply|supply|mains|power/.test(l)) return { rule: filterElectrical, reason: "voltage" };
  if (/water|drain|inlet|pressure|hardness|fitting|filtration/.test(l)) return { rule: filterWater, reason: "water" };
  if (/contact|phone|distribut|address|headquart|office|manufacturer/.test(l)) return { rule: filterContact, reason: "contact" };
  return null;
}

const FIELD_RULES: Record<string, Record<string, { rule: Rule; reason: RemovedReason }>> = {
  power: {
    voltage: { rule: filterElectrical, reason: "voltage" },
    hz: { rule: filterHz, reason: "frequency" },
    plug: { rule: filterPlug, reason: "plug" },
    circuit: { rule: filterElectrical, reason: "voltage" },
    amps: { rule: filterElectrical, reason: "voltage" },
  },
  water: {
    inlet: { rule: filterWater, reason: "water" },
    pressure: { rule: filterWater, reason: "water" },
    filtration: { rule: filterWater, reason: "water" },
    notes: { rule: filterWater, reason: "water" },
  },
  drain: { size: { rule: filterWater, reason: "water" }, notes: { rule: filterWater, reason: "water" } },
};

const SECTION_NAME: Record<string, string> = { power: "Power", water: "Water", drain: "Drain", dimensions: "Size" };
const FIELD_NAME: Record<string, string> = {
  voltage: "Voltage",
  amps: "Amps",
  phase: "Phase",
  hz: "Hz",
  plug: "Plug",
  circuit: "Circuit",
  inlet: "Inlet",
  pressure: "Pressure",
  filtration: "Filtration",
  notes: "Notes",
  size: "Size",
};

/** A configuration whose label says it is a European build ("230V 50Hz", "CE version"). */
function nonUsConfigLabel(label: string): boolean {
  const l = label.trim();
  if (!l) return false;
  if (US_VOLT.test(l) || SIXTY.test(l) || /\b(us|usa|ul|nsf|north america)\b/i.test(l)) return false;
  return (EURO_VOLT.test(l) || (FIFTY_ONLY.test(l) && !FIFTY_SIXTY.test(l)) || /\b(ce|uk|eu|europe(an)?|export)\s*(version|model|spec)?\b/i.test(l)) && true;
}

/**
 * Run every rule over a draft. Returns the trimmed draft and the list of removals
 * (in display order). Never throws; values it can't judge are left alone.
 */
export function filterNonUsa(input: SpecSheetDraft): { draft: SpecSheetDraft; removed: RemovedItem[] } {
  const draft: SpecSheetDraft = structuredClone(input);
  const removed: RemovedItem[] = [];
  let seq = 0;
  const add = (item: Omit<RemovedItem, "id" | "note">) =>
    removed.push({ ...item, id: `r${++seq}`, note: NOTE[item.reason] });

  // Whole configurations built for 230 V / 50 Hz / CE markets.
  const keptConfigs: SpecConfig[] = [];
  draft.configs.forEach((c, i) => {
    if (draft.configs.length > 1 && nonUsConfigLabel(c.label)) {
      add({ where: `Configuration · ${c.label}`, removed: c.label, original: c, kept: "", reason: "config", path: { kind: "config", index: i } });
    } else keptConfigs.push(c);
  });
  draft.configs = keptConfigs;

  // Requirement fields per configuration.
  draft.configs.forEach((c) => {
    for (const [section, fields] of Object.entries(FIELD_RULES)) {
      const sec = (c.requirements as Record<string, Record<string, string | undefined> | undefined>)[section];
      if (!sec) continue;
      for (const [key, { rule, reason }] of Object.entries(fields)) {
        const value = sec[key];
        if (!value) continue;
        const res = rule(value);
        if (!res.removed.length) continue;
        sec[key] = res.kept || undefined;
        add({
          where: `${c.label} · ${SECTION_NAME[section]} · ${FIELD_NAME[key] ?? key}`,
          removed: res.removed.join(", "),
          original: value,
          kept: res.kept,
          reason,
          path: { kind: "field", section: section as "power" | "water" | "drain", key, config: c.label },
        });
      }
    }
    // Free-form "other" rows go through the label rules.
    const other = c.requirements.other ?? [];
    const keepOther: Kv[] = [];
    other.forEach((row, oi) => {
      const r = ruleForLabel(row.label);
      const res = r ? r.rule(row.value) : { kept: row.value, removed: [] };
      if (r && res.removed.length) {
        add({
          where: `${c.label} · ${row.label}`,
          removed: res.removed.join(", "),
          original: row,
          kept: res.kept,
          reason: r.reason,
          path: { kind: "other", config: c.label, index: oi },
        });
        if (res.kept) keepOther.push({ ...row, value: res.kept });
      } else keepOther.push(row);
    });
    if (c.requirements.other) c.requirements.other = keepOther;
  });

  // Spec rows.
  const keepSpecs: Kv[] = [];
  draft.specs.forEach((row, i) => {
    const r = ruleForLabel(row.label);
    // Certifications also hide in rows labelled "Electrical", so check marks on every row.
    const res = r ? r.rule(row.value) : { kept: row.value, removed: [] };
    if (r && res.removed.length) {
      add({ where: `Specs · ${row.label}`, removed: res.removed.join(", "), original: row, kept: res.kept, reason: r.reason, path: { kind: "spec", index: i } });
      if (res.kept) keepSpecs.push({ ...row, value: res.kept });
    } else keepSpecs.push(row);
  });
  draft.specs = keepSpecs;

  // Manufacturer notes.
  const certs = draft.mfrNotes.certifications ?? [];
  const keepCerts: string[] = [];
  certs.forEach((cert, i) => {
    const res = filterCertLine(cert);
    if (res.removed.length) {
      add({ where: "Certifications", removed: res.removed.join(", "), original: cert, kept: res.kept, reason: "certification", path: { kind: "cert", index: i } });
      if (res.kept) keepCerts.push(res.kept);
    } else keepCerts.push(cert);
  });
  draft.mfrNotes.certifications = keepCerts;
  if (draft.mfrNotes.usContact) {
    const value = draft.mfrNotes.usContact;
    const res = filterContact(value);
    if (res.removed.length) {
      draft.mfrNotes.usContact = res.kept || undefined;
      add({ where: "US Contact", removed: res.removed.join("; "), original: value, kept: res.kept, reason: "contact", path: { kind: "mfr", key: "usContact" } });
    }
  }
  return { draft, removed };
}

/** Put one removed value back into a draft (the review screen's Restore button). */
export function restoreRemoved(draft: SpecSheetDraft, item: RemovedItem): SpecSheetDraft {
  const next: SpecSheetDraft = structuredClone(draft);
  const p = item.path;
  const at = <T,>(arr: T[], index: number, value: T, replaceWhere?: (x: T) => boolean) => {
    const hit = replaceWhere ? arr.findIndex(replaceWhere) : -1;
    if (hit >= 0) arr[hit] = value;
    else arr.splice(Math.min(index, arr.length), 0, value);
  };
  if (p.kind === "config") {
    at(next.configs, p.index, item.original as SpecConfig);
  } else if (p.kind === "field") {
    const cfg = next.configs.find((c) => c.label === p.config);
    if (cfg) {
      const reqs = cfg.requirements as Record<string, Record<string, string | undefined> | undefined>;
      reqs[p.section] = { ...(reqs[p.section] ?? {}), [p.key]: item.original as string };
    }
  } else if (p.kind === "other") {
    const cfg = next.configs.find((c) => c.label === p.config);
    if (cfg) {
      const row = item.original as Kv;
      cfg.requirements.other = cfg.requirements.other ?? [];
      at(cfg.requirements.other, p.index, row, (x) => x.label === row.label);
    }
  } else if (p.kind === "spec") {
    const row = item.original as Kv;
    at(next.specs, p.index, row, (x) => x.label === row.label);
  } else if (p.kind === "cert") {
    const certs = (next.mfrNotes.certifications = next.mfrNotes.certifications ?? []);
    const hit = item.kept ? certs.indexOf(item.kept) : -1;
    if (hit >= 0) certs[hit] = item.original as string;
    else at(certs, p.index, item.original as string);
  } else if (p.kind === "mfr") {
    next.mfrNotes[p.key] = item.original as string;
  }
  return next;
}
