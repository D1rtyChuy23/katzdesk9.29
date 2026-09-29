import type { Recipe } from "./types";

export type EquipPiece = {
  label: string;
  model: string;
};

const ALIASES: { test: RegExp; model: string }[] = [
  { test: /c['’]?2m|\bc2m\b|cameo.{0,12}2m/i, model: "Eversys Cameo c'2m" },
  { test: /c['’]?2s|\bc2s\b|cameo.{0,16}2\s*step/i, model: "Eversys Cameo c'2s" },
  { test: /cameo/i, model: "Eversys Cameo c'2s" },
  { test: /e['’]?4m|\be4m\b/i, model: "Eversys e'4m" },
  { test: /e['’]?4s?|\be4\b|enigma/i, model: "Eversys e'4s" },
  { test: /\bitcb\b/i, model: "Bunn ITCB" },
  { test: /\btb3\b/i, model: "Bunn TB3" },
  { test: /axiom/i, model: "Bunn Axiom-APS" },
  { test: /cwtf/i, model: "Bunn CWTF-APS" },
  { test: /\bicb\b/i, model: "Bunn ICB Tall" },
  { test: /\bitb\b/i, model: "Bunn ITB-DD" },
  { test: /2051/i, model: "Fetco 2051e" },
  { test: /\b52h\b/i, model: "Fetco 52H" },
  { test: /sego/i, model: "Bravilor Sego 12" },
  { test: /classe\s*9/i, model: "Rancilio Classe 9" },
  { test: /classe\s*5/i, model: "Rancilio Classe 5 Compact" },
  { test: /strada/i, model: "La Marzocco Strada XT" },
  { test: /linea/i, model: "La Marzocco Linea S" },
  { test: /legacy/i, model: "Eversys Legacy" },
  { test: /\bg9[- ]?2t\b/i, model: "Bunn G9-2T" },
  { test: /\bg9\b/i, model: "Bunn G9" },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function samePiece(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return !!na && !!nb && na === nb;
}

function cleanPiece(raw: string): string | null {
  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(/^\(+/, "").replace(/\)+$/, "").trim();
  t = t.replace(/^(qty\s*)?\d+\s*[x×]\s*/i, "");
  t = t.replace(/\s*[x×]\s*\d+\s*$/i, "");
  t = t.replace(/\bwith\s+[\d.]+\s*wands?\b/i, "");
  t = t.replace(/\b\d+\s*v(olts?)?\b/i, "");
  t = t.replace(/\s+/g, " ").trim();
  if (!t || t.length < 2) return null;
  if (/^\d+$/.test(t)) return null;
  if (
    /^(need a |not here|new in barn|from cafeteria|for the time|po\b|loaner|sn\b)/i.test(
      t,
    )
  ) {
    return null;
  }
  return t;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function catalogPattern(name: string): RegExp | null {
  const parts = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter((p) => p.length > 0)
    .map(escapeRe);
  if (!parts.length) return null;
  return new RegExp(`(?<![a-zA-Z0-9])${parts.join("[^a-zA-Z0-9]+")}(?![a-zA-Z0-9])`, "i");
}

type CatalogHit = { index: number; end: number; name: string };

function nextCatalogHit(text: string, patterns: { name: string; re: RegExp }[]): CatalogHit | null {
  let best: CatalogHit | null = null;
  for (const { name, re } of patterns) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (!m || m.index < 0) continue;
    const end = m.index + m[0].length;
    if (
      !best ||
      m.index < best.index ||
      (m.index === best.index && end - m.index > best.end - best.index)
    ) {
      best = { index: m.index, end, name };
    }
  }
  return best;
}

/** Between-machine separators. Never split GB/5, A/2, 1L/2U. */
const BETWEEN_MACHINES = /\s+(?:&|\+|and)\s+|,\s+|(?<=[A-Za-z]{2,})\s*\/\s*(?=[A-Z][a-zA-Z])/i;

function splitNonCatalog(raw: string, catalog: string[]): string[] {
  const pieces: string[] = [];
  for (const part of raw.split(BETWEEN_MACHINES)) {
    const cleaned = cleanPiece(part);
    if (cleaned) pieces.push(matchModel(cleaned, catalog));
  }
  return pieces;
}

function extractLine(line: string, catalog: string[], catalogKey: Map<string, string>, patterns: { name: string; re: RegExp }[]): string[] {
  const exact = catalogKey.get(normalize(line));
  if (exact) return [exact];
  if (!patterns.length) return splitNonCatalog(line, catalog);

  const out: string[] = [];
  let rest = line;
  let guard = 0;
  while (rest.trim() && guard++ < 40) {
    const hit = nextCatalogHit(rest, patterns);
    if (!hit) {
      out.push(...splitNonCatalog(rest, catalog));
      break;
    }
    const before = rest.slice(0, hit.index).trim();
    if (before) out.push(...splitNonCatalog(before, catalog));
    out.push(hit.name);
    rest = rest.slice(hit.end).replace(/^[\s,;+&]+|^\s*\/\s*|^\s+and\s+/i, "");
  }
  return out.filter(Boolean);
}

/**
 * Read equipment as listed. Catalog names stay one chip even when they contain
 * commas or slashes ("Bunn Axiom-15-3, 1L/2U", "La Marzocco GB/5 S 3 Group AV").
 * Messy one-line blobs still split between machines on " & " / " and " / "," / ".
 */
export function listedEquipment(
  raw: string | null | undefined,
  catalog: string[] = [],
): string[] {
  if (!raw?.trim()) return [];
  const catalogKey = new Map(catalog.map((c) => [normalize(c), c]));
  const patterns = catalog
    .map((name) => {
      const re = catalogPattern(name);
      return re ? { name, re } : null;
    })
    .filter((x): x is { name: string; re: RegExp } => !!x)
    .sort((a, b) => b.name.length - a.name.length);
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const stripped = line.replace(/\bSN\s*:?\s*[A-Z0-9-]+/gi, " ").replace(/\s+/g, " ").trim();
    const pieces = extractLine(stripped || line, catalog, catalogKey, patterns);
    if (pieces.length) out.push(...pieces);
    else out.push(matchModel(line, catalog));
  }
  return rejoinSplitModels(out, catalogKey);
}

/** Split a messy install equipment blob into one piece per machine. */
export function splitEquipment(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const pieces: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const stripped = line.replace(/\bSN\s*:?\s*[A-Z0-9-]+/gi, " ").trim();
    if (!stripped) continue;
    for (const part of stripped.split(BETWEEN_MACHINES)) {
      const cleaned = cleanPiece(part);
      if (cleaned) pieces.push(cleaned);
    }
  }
  return pieces;
}

/** Reassemble equipment chips for storage. Empty list → null (never invented). */
export function joinEquipment(pieces: string[]): string | null {
  const next = pieces.map((p) => p.trim()).filter(Boolean);
  return next.length ? next.join("\n") : null;
}

function rejoinSplitModels(pieces: string[], catalogKey: Map<string, string>): string[] {
  if (pieces.length < 2) return pieces;
  const out: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i]!;
    const b = pieces[i + 1];
    if (b) {
      const slash = catalogKey.get(normalize(`${a}/${b}`));
      const spaced = catalogKey.get(normalize(`${a} ${b}`));
      if (slash || spaced) {
        out.push(slash ?? spaced!);
        i += 1;
        continue;
      }
      if (/^\d/.test(b.trim()) && !/\b(group|grinder|hopper)\b/i.test(a)) {
        out.push(`${a}/${b}`);
        i += 1;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

function tokens(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

/** Score a typed/spreadsheet fragment against an uploaded catalog name. Higher is better. */
export function catalogScore(piece: string, model: string): number {
  const n = normalize(piece);
  const m = normalize(model);
  if (!n || !m) return 0;
  if (n === m) return 10_000 + m.length;
  const pt = tokens(piece);
  const mt = tokens(model);
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

export function matchModel(piece: string, catalog: string[]): string {
  const raw = piece.trim();
  if (!raw) return piece;
  const key = normalize(raw);
  const exact = catalog.find((c) => normalize(c) === key);
  if (exact) return exact;

  const aliasName = aliasCanonical(raw);
  const looksLikeBlob = raw.length > 40 || /\/.+\//.test(raw) || (raw.includes("/") && raw.includes(","));
  if (aliasName && !looksLikeBlob) {
    const aliasExact = catalog.find((c) => normalize(c) === normalize(aliasName));
    if (aliasExact) return aliasExact;
    const unique = catalog.filter((c) => catalogScore(aliasName, c) >= 10_000);
    if (unique.length === 1) return unique[0]!;
    return aliasName;
  }

  if (!catalog.length) return raw;

  let best: { model: string; score: number } | null = null;
  for (const model of catalog) {
    const score = catalogScore(raw, model);
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && model.length > best.model.length)) {
      best = { model, score };
    }
  }
  const pt = tokens(raw);
  const nearBest =
    best &&
    catalog.filter((c) => catalogScore(raw, c) >= (best?.score ?? 0) - 2).length === 1;
  const uniqueEnough = Boolean(best && best.score >= 5_000 && (pt.length > 1 || nearBest));
  if (uniqueEnough && best) return best.model;
  return best && best.score >= 10_000 ? best.model : raw;
}

function aliasCanonical(raw: string): string | null {
  const n = normalize(raw);
  const t = n.split(/\s+/).filter(Boolean);
  if (t.length >= 5) return null;
  if (/\bgroup\b/.test(n)) return null;
  for (const a of ALIASES) {
    if (a.test.test(raw)) return a.model;
  }
  return null;
}

export function parseInstallEquipment(
  raw: string | null | undefined,
  catalog: string[] = [],
): EquipPiece[] {
  return listedEquipment(raw, catalog).map((label) => ({
    label,
    model: matchModel(label, catalog),
  }));
}

/** Drop one machine from an install. Empty list becomes null. */
export function dropEquipment(
  raw: string | null | undefined,
  label: string,
  catalog: string[] = [],
): string | null {
  const pieces = listedEquipment(raw, catalog);
  const model = matchModel(label, catalog);
  const idx = pieces.findIndex(
    (p) =>
      samePiece(p, label) ||
      samePiece(p, model) ||
      samePiece(matchModel(p, catalog), label) ||
      samePiece(matchModel(p, catalog), model),
  );
  if (idx >= 0) {
    const next = pieces.slice();
    next.splice(idx, 1);
    return joinEquipment(next);
  }
  const n = normalize(label);
  const fallbackIdx = pieces.findIndex((p) => {
    const pn = normalize(p);
    return pn === n || pn.includes(n) || n.includes(pn);
  });
  if (fallbackIdx >= 0) {
    const next = pieces.slice();
    next.splice(fallbackIdx, 1);
    return joinEquipment(next);
  }
  return joinEquipment(pieces.filter((p) => p !== label));
}

/** Swap one listed model for another inside a stored equipment blob. */
export function rewriteEquipmentName(
  raw: string | null | undefined,
  from: string,
  to: string,
  catalog: string[] = [],
): string | null {
  if (raw == null) return null;
  if (!raw.trim()) return raw;
  const src = from.trim();
  const dest = to.trim();
  if (!src || !dest) return raw;
  if (samePiece(raw, src)) return dest;
  const cat = catalogModels([...catalog, src, dest]);
  const pieces = listedEquipment(raw, cat);
  let hit = false;
  const next = pieces.map((p) => {
    if (samePiece(p, src)) {
      hit = true;
      return dest;
    }
    return p;
  });
  if (hit) return joinEquipment(next);
  const lines = raw.split(/\r?\n/);
  let lineHit = false;
  const mapped = lines.map((line) => {
    const stripped = line.replace(/\bSN\s*:?\s*[A-Z0-9-]+/gi, " ").replace(/\s+/g, " ").trim();
    if (samePiece(line, src) || samePiece(stripped, src)) {
      lineHit = true;
      return dest;
    }
    return line;
  });
  return lineHit ? mapped.join("\n") : raw;
}

export function catalogModels(models: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const m of models) {
    const t = m.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function findRecipeFor(
  recipes: Recipe[],
  opts: { customer: string; model: string; installId?: number | null; recipeId?: number | null },
): { linked: Recipe | null; house: Recipe | null } {
  const modelKey = opts.model.toLowerCase();
  const custKey = opts.customer.trim().toLowerCase();
  // Unnamed recipes are the defaults; named ones are extra choices picked on the equipment row.
  const byDefault = (a: Recipe, b: Recipe) => Number(!!a.name) - Number(!!b.name);
  const sameModel = recipes.filter((r) => r.equipmentModel.toLowerCase() === modelKey).sort(byDefault);
  const picked = opts.recipeId ? recipes.find((r) => r.id === opts.recipeId) ?? null : null;
  const house = (picked && !picked.customer ? picked : null) ?? sameModel.find((r) => !r.customer) ?? null;
  const linked =
    (picked && picked.customer ? picked : null) ??
    (opts.installId ? sameModel.find((r) => r.installId === opts.installId) : undefined) ??
    sameModel.find((r) => !!r.customer && r.customer.toLowerCase() === custKey) ??
    null;
  return { linked, house };
}

/** "Morning blend", or the model when the recipe has no name of its own. */
export function recipeLabel(r: Recipe, withModel = false): string {
  const base = r.name?.trim() || "Standard";
  return withModel ? `${base} · ${r.equipmentModel}` : base;
}

export function piecesForInstall(
  equipment: string | null | undefined,
  _customer: string,
  _installId: number,
  catalog: string[],
  _recipes?: Recipe[],
): EquipPiece[] {
  return parseInstallEquipment(equipment, catalog);
}

export function shortEquipLabel(label: string, max = 22): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
