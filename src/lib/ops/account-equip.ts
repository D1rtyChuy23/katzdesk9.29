import { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";

export { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";

export const OWNERSHIP_VALUES = [
  "Loaned",
  "Owned - Purchased from Katz",
  "Owned - Purchased from 3rd Party",
  "Owned",
  "Lease",
] as const;

export type OwnershipValue = (typeof OWNERSHIP_VALUES)[number];

export type AccountHit = {
  id: number;
  name: string;
};

export type AccountMatch = {
  status: "matched" | "walk-in" | "unmatched" | "ambiguous";
  account: AccountHit | null;
  candidates: AccountHit[];
};

export type CatalogMatch = {
  status: "matched" | "unmatched" | "ambiguous";
  catalogModel: string | null;
  candidates: string[];
  reason: string;
};

export type ExistingUnit = {
  id: number;
  customer: string;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  serialKey: string | null;
};

export type UnitMatch = {
  action: "add" | "update" | "review";
  existingId: number | null;
  foreignAccount: string | null;
};

const GENERIC_TOKENS = new Set([
  "bunn",
  "fetco",
  "eversys",
  "rancilio",
  "mazzer",
  "bravilor",
  "wilbur",
  "curtis",
  "ditting",
  "everpure",
  "puqpress",
  "faema",
  "blendtec",
  "mahlkonig",
  "vitrifrigo",
  "modbar",
  "la",
  "marzocco",
  "brewer",
  "combo",
  "grinder",
  "series",
  "dual",
  "portion",
  "coffee",
  "tea",
  "machine",
  "espresso",
  "automatic",
  "electronic",
  "with",
  "shelf",
  "kitchen",
  "front",
  "back",
  "upstairs",
  "downstairs",
  "banquet",
  "restaurant",
  "pour",
  "over",
  "from",
  "the",
  "of",
  "and",
  "w",
  "blk",
  "black",
  "chrome",
  "hot",
  "water",
  "tower",
  "retail",
  "aps",
  "ns",
  "dept",
  "parts",
  "service",
  "showroom",
  "body",
  "shop",
  "used",
  "cars",
  "classic",
  "step",
  "group",
  "av",
  "usb",
  "semi",
  "volumetric",
  "tall",
  "compact",
  "auto",
  "on",
  "demand",
  "french",
  "press",
  "hopper",
  "batch",
  "buttons",
  "element",
  "immersion",
  "dilute",
  "carafe",
  "thermal",
  "specialty",
  "dispenser",
  "filtration",
  "system",
  "reverse",
  "osmosis",
  "owned",
  "purchased",
  "katz",
  "loaned",
  "lease",
  "configuration",
  "electrical",
  "single",
  "twin",
  "lower",
  "upper",
  "warmers",
  "warmer",
  "plus",
  "pro",
  "wide",
  "super",
  "traditional",
  "beside",
  "fridge",
  "enigma",
  "shotmaster",
]);

const EMPTY_SERIAL = /^(n\/?a|na|n a|not available|not avail|none|null|unknown|-|—|–)$/i;

export function serialKey(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/[#\s]/g, "").toLowerCase();
}

export function compactEquip(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/#\s*\d+\b/g, " ")
    .replace(/(\d)[.-](?=\d)/g, "$1")
    .replace(/([a-z])[.-](?=\d)/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripEquipNoise(raw: string): string {
  return String(raw ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/#\s*\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWord(haystack: string, token: string): boolean {
  if (!token) return false;
  return new RegExp(`(?:^| )${escapeRe(token)}(?:$| )`).test(` ${haystack} `);
}

function tokensOf(raw: string): string[] {
  return compactEquip(raw).split(" ").filter(Boolean);
}

function distinctiveTokens(raw: string): string[] {
  return tokensOf(raw).filter((t) => t.length >= 2 && !GENERIC_TOKENS.has(t));
}

function uniqueByDistinctive(query: string, catalog: string[]): string[] {
  const tokens = distinctiveTokens(query);
  if (!tokens.length) return [];
  return catalog.filter((c) => tokens.every((t) => hasWord(compactEquip(c), t)));
}

function uniqueByPrefix(query: string, catalog: string[]): string[] {
  const q = compactEquip(query);
  if (q.length < 8) return [];
  return catalog.filter((c) => {
    const n = compactEquip(c);
    return n === q || n.startsWith(`${q} `);
  });
}

function fitsDistinctive(catalogName: string, query: string): boolean {
  const tokens = distinctiveTokens(query);
  if (!tokens.length) return true;
  return tokens.every((t) => hasWord(compactEquip(catalogName), t));
}

function catalogScore(piece: string, model: string): number {
  const n = compactEquip(piece);
  const m = compactEquip(model);
  if (!n || !m) return 0;
  if (n === m) return 10_000 + m.length;
  const pt = n.split(" ").filter(Boolean);
  const mt = m.split(" ").filter(Boolean);
  if (!pt.length) return 0;
  if (m.startsWith(n) || (n.length >= 6 && n.startsWith(m))) return 5_000 + Math.min(n.length, m.length);
  if (n.length >= 6 && (m.includes(n) || n.includes(m))) {
    return 3_000 + Math.min(n.length, m.length) - Math.abs(m.length - n.length) / 100;
  }
  let hits = 0;
  for (const t of pt) {
    const ok = mt.some((x) => x === t || (t.length >= 3 && x.includes(t)) || (x.length >= 3 && t.includes(x)));
    if (!ok) return 0;
    hits += 1;
  }
  const extra = Math.max(0, mt.length - pt.length);
  return 2_000 + hits * 20 - extra;
}

function uniqueByScore(query: string, catalog: string[]): string[] {
  const q = stripEquipNoise(query);
  if (!q) return [];
  const scored = catalog
    .map((c) => ({ c, score: catalogScore(q, c) }))
    .filter((x) => x.score >= 2000)
    .sort((a, b) => b.score - a.score || b.c.length - a.c.length);
  if (!scored.length) return [];
  const best = scored[0]!.score;
  const top = scored.filter((x) => x.score >= best - 50);
  return top.map((x) => x.c);
}

function catalogHas(name: string, catalog: string[]): string | null {
  const key = compactEquip(name);
  if (!key) return null;
  return catalog.find((c) => compactEquip(c) === key) ?? null;
}

export function sameCatalogModel(a: string, b: string): boolean {
  return compactEquip(a) === compactEquip(b) && !!compactEquip(a);
}

export function matchAccount(name: string, accounts: AccountHit[]): AccountMatch {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { status: "unmatched", account: null, candidates: [] };
  if (isWalkIn(trimmed)) {
    return { status: "walk-in", account: null, candidates: [] };
  }
  const key = normalizeCustomerKey(trimmed);
  if (!key) return { status: "unmatched", account: null, candidates: [] };
  const hits = accounts.filter((a) => normalizeCustomerKey(a.name) === key);
  if (hits.length === 1) return { status: "matched", account: hits[0]!, candidates: hits };
  if (hits.length > 1) return { status: "ambiguous", account: null, candidates: hits };
  return { status: "unmatched", account: null, candidates: [] };
}

export function matchCatalogModel(
  equipmentName: string,
  model: string,
  catalog: string[],
): CatalogMatch {
  const m = stripEquipNoise(model);
  const e = stripEquipNoise(equipmentName);

  if (m) {
    const exact = catalogHas(m, catalog) ?? catalogHas(model, catalog);
    if (exact && fitsDistinctive(exact, e)) {
      return { status: "matched", catalogModel: exact, candidates: [exact], reason: "exact-model" };
    }
  }
  if (e) {
    const exact = catalogHas(e, catalog) ?? catalogHas(equipmentName, catalog);
    if (exact && fitsDistinctive(exact, m)) {
      return { status: "matched", catalogModel: exact, candidates: [exact], reason: "exact-name" };
    }
  }

  const distM = m ? uniqueByDistinctive(m, catalog) : [];
  const distE = e ? uniqueByDistinctive(e, catalog) : [];
  const combined = [e, m].filter(Boolean).join(" ");
  const distC = combined ? uniqueByDistinctive(combined, catalog) : [];

  if (distM.length && distE.length) {
    const inter = distM.filter((x) => distE.includes(x));
    if (inter.length === 1) {
      return { status: "matched", catalogModel: inter[0]!, candidates: inter, reason: "distinctive-agree" };
    }
    if (inter.length === 0) {
      return {
        status: "ambiguous",
        catalogModel: null,
        candidates: uniqueNames([...distE, ...distM]).slice(0, 8),
        reason: "name-model-disagree",
      };
    }
  }
  if (distM.length === 1) {
    return { status: "matched", catalogModel: distM[0]!, candidates: distM, reason: "distinctive-model" };
  }
  if (distE.length === 1) {
    return { status: "matched", catalogModel: distE[0]!, candidates: distE, reason: "distinctive-name" };
  }
  if (distC.length === 1) {
    return { status: "matched", catalogModel: distC[0]!, candidates: distC, reason: "distinctive-combined" };
  }

  const prefixM = m ? uniqueByPrefix(m, catalog).filter((c) => fitsDistinctive(c, e)) : [];
  if (prefixM.length === 1) {
    return { status: "matched", catalogModel: prefixM[0]!, candidates: prefixM, reason: "prefix-model" };
  }
  const prefixE = e ? uniqueByPrefix(e, catalog).filter((c) => fitsDistinctive(c, m)) : [];
  if (prefixE.length === 1) {
    return { status: "matched", catalogModel: prefixE[0]!, candidates: prefixE, reason: "prefix-name" };
  }

  const scoreM = m ? uniqueByScore(m, catalog).filter((c) => fitsDistinctive(c, e)) : [];
  const scoreE = e ? uniqueByScore(e, catalog).filter((c) => fitsDistinctive(c, m)) : [];
  const scoreC = combined ? uniqueByScore(combined, catalog) : [];
  if (scoreM.length === 1) {
    return { status: "matched", catalogModel: scoreM[0]!, candidates: scoreM, reason: "score-model" };
  }
  if (scoreE.length === 1) {
    return { status: "matched", catalogModel: scoreE[0]!, candidates: scoreE, reason: "score-name" };
  }
  if (scoreC.length === 1) {
    return { status: "matched", catalogModel: scoreC[0]!, candidates: scoreC, reason: "score-combined" };
  }

  const candidates = uniqueNames([
    ...prefixM,
    ...prefixE,
    ...distM,
    ...distE,
    ...distC,
    ...scoreM,
    ...scoreE,
    ...scoreC,
  ]);
  return {
    status: candidates.length ? "ambiguous" : "unmatched",
    catalogModel: null,
    candidates: candidates.slice(0, 8),
    reason: candidates.length ? "ambiguous" : "unmatched",
  };
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const k = compactEquip(n);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

export function parseSerial(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  if (EMPTY_SERIAL.test(s)) return null;
  return s;
}

export function parseInstallDate(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s || EMPTY_SERIAL.test(s)) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;
  const us = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    let year = Number(us[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2100) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 90000) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + Math.round(n) * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function mapOwnership(raw: string | null | undefined): {
  value: OwnershipValue | null;
  status: "mapped" | "blank" | "unknown";
  raw: string;
} {
  const original = String(raw ?? "").trim();
  const n = original.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return { value: null, status: "blank", raw: original };
  if (n === "loaned" || n === "loan" || n === "on loan") {
    return { value: "Loaned", status: "mapped", raw: original };
  }
  if (/\bkatz\b/.test(n) && /\b(owned|purchased|bought)\b/.test(n)) {
    return { value: "Owned - Purchased from Katz", status: "mapped", raw: original };
  }
  if (/\b(3rd|third)\b/.test(n) && /\b(owned|purchased|bought|party)\b/.test(n)) {
    return { value: "Owned - Purchased from 3rd Party", status: "mapped", raw: original };
  }
  if (n === "owned" || n === "owner") {
    return { value: "Owned", status: "mapped", raw: original };
  }
  if (n === "lease" || n === "leased" || n === "on lease") {
    return { value: "Lease", status: "mapped", raw: original };
  }
  for (const o of OWNERSHIP_VALUES) {
    const key = o.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    if (key === n) return { value: o, status: "mapped", raw: original };
  }
  return { value: null, status: "unknown", raw: original };
}

export function sameEquipLabel(a: string, b: string): boolean {
  return compactEquip(a) === compactEquip(b) && !!compactEquip(a);
}

export function matchExistingUnit(opts: {
  customer: string;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  existing: ExistingUnit[];
}): UnitMatch {
  const customerKey = normalizeCustomerKey(opts.customer);
  const key = serialKey(opts.serial);
  if (key) {
    const foreign = opts.existing.find(
      (e) => serialKey(e.serial) === key && normalizeCustomerKey(e.customer) !== customerKey,
    );
    if (foreign) {
      return { action: "review", existingId: null, foreignAccount: foreign.customer };
    }
    const same = opts.existing.find(
      (e) =>
        serialKey(e.serial) === key &&
        normalizeCustomerKey(e.customer) === customerKey &&
        sameCatalogModel(e.catalogModel, opts.catalogModel),
    );
    if (same) return { action: "update", existingId: same.id, foreignAccount: null };
    return { action: "add", existingId: null, foreignAccount: null };
  }
  const same = opts.existing.find(
    (e) =>
      normalizeCustomerKey(e.customer) === customerKey &&
      sameCatalogModel(e.catalogModel, opts.catalogModel) &&
      sameEquipLabel(e.equipmentName, opts.equipmentName) &&
      !serialKey(e.serial),
  );
  if (same) return { action: "update", existingId: same.id, foreignAccount: null };
  return { action: "add", existingId: null, foreignAccount: null };
}
