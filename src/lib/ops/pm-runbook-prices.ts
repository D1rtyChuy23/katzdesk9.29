/**
 * PM runbook — kit prices from the parts catalog (billing_items). Read-only: shows the sell price (Base Price) of
 * each kit and flags kits the catalog does not have. Pure: the caller passes the matched catalog rows.
 */
import type { KitLine } from "./pm-runbook.ts";

/** Same rule as the parts list: case, spaces and dashes never make a second part number. */
export const kitKey = (raw: string | null | undefined): string => String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");

export type CatalogKit = {
  sku: string;
  name: string | null;
  /** Base Price: what Katz sells it for. */
  rate: number | null;
  active: boolean;
  hidden: boolean;
};

/** A billing_items row as the price lookup reads it. */
export type CatalogRow = CatalogKit & { mfrPart: string | null; description: string | null };

/**
 * Eversys numbers its parts by six digits. The guides write them "EV117077"; NetSuite and the Parts list write the
 * same part "EVER117077", sometimes with the bare "117077" as its manufacturer number. One part, three spellings.
 * La Marzocco parts are filed with an "LM" prefix and no space: F.3.040 is LMF.3.040, 1207 is LM1207.
 */
const eversysDigits = (key: string): string | null => /^EV(?:ER)?(\d{6})$/.exec(key)?.[1] ?? null;

/** Parts-list prefix for a runbook manufacturer. Unknown makers have none, so matching stays as it is today. */
export const MANUFACTURER_PREFIX: Readonly<Record<string, string>> = { "La Marzocco": "LM" };

export function prefixForManufacturer(manufacturer: string | null | undefined): string | undefined {
  if (!manufacturer) return undefined;
  return MANUFACTURER_PREFIX[manufacturer] || undefined;
}

/** Every number a kit can be filed under in the Parts list: its own, the Eversys spellings, and the maker prefix. */
export function catalogKeys(ev: string, prefix?: string | null): string[] {
  const k = kitKey(ev);
  if (!k) return [];
  const d = eversysDigits(k);
  const keys = d ? [k, `EV${d}`, `EVER${d}`, d] : [k];
  const p = prefix ? kitKey(prefix) : "";
  if (p) keys.push(`${p}${k}`);
  return [...new Set(keys)];
}

/**
 * How closely a Parts list row matches a kit: 4 the maker prefix plus the kit number, 3 the same number,
 * 2 the same six Eversys digits (EV / EVER), 1 the bare six digits on a part that is plainly Eversys, 0 not this kit.
 * Bare digits alone never match another maker's part that happens to share them, nor an Eversys part filed under
 * different digits ("EVER109570 … was 108390" is its own part, not kit 108390).
 */
export function matchRank(ev: string, row: Pick<CatalogRow, "sku" | "mfrPart" | "name" | "description">, prefix?: string | null): number {
  const k = kitKey(ev);
  if (!k) return 0;
  const sku = kitKey(row.sku);
  const nums = [sku, kitKey(row.mfrPart)].filter(Boolean);
  const p = prefix ? kitKey(prefix) : "";
  if (p && nums.includes(`${p}${k}`)) return 4;
  if (nums.includes(k)) return 3;
  const d = eversysDigits(k);
  if (!d) return 0;
  if (nums.includes(`EV${d}`) || nums.includes(`EVER${d}`)) return 2;
  if (!nums.includes(d)) return 0;
  const own = eversysDigits(sku);
  if (own && own !== d) return 0;
  // "EVER" then digits is Eversys's NetSuite SKU; an "EVERPURE…" filter is not.
  return /^EVER\d/.test(sku) || /eversys/i.test(`${row.name ?? ""} ${row.description ?? ""}`) ? 1 : 0;
}

/**
 * One Parts list row per kit, keyed by `kitKey` of the kit number. When a row is the maker prefix plus the kit
 * number, bare-number rows are dropped, so another maker's "1207" cannot beat "LM1207". The bare number stays a
 * fallback when no prefixed row is in the pool. Bare six digits are only a fallback, used when no part carries
 * the kit's number or its EV / EVER spelling, and only when exactly one part has them: never a guess between
 * look-alikes such as a 12- and a 24-month version. Among the rest a part that is active, visible and priced
 * wins; among equals the closer number wins, then the first row. Kits with no matching part are absent.
 */
export function pickCatalog(evs: string[], rows: CatalogRow[], prefix?: string | null): Record<string, CatalogKit> {
  const out: Record<string, CatalogKit> = {};
  const p = prefix ? kitKey(prefix) : "";
  for (const ev of evs) {
    const k = kitKey(ev);
    if (!k || out[k]) continue;
    const ranked = rows.map((r) => ({ r, rank: matchRank(ev, r, prefix) })).filter((x) => x.rank > 0);
    let pool = ranked.some((x) => x.rank > 1) ? ranked.filter((x) => x.rank > 1) : ranked;
    if (pool.length > 1 && pool.every((x) => x.rank === 1)) continue;
    const prefixed = p ? `${p}${k}` : "";
    const isPrefixed = (r: CatalogRow) => prefixed !== "" && [kitKey(r.sku), kitKey(r.mfrPart)].includes(prefixed);
    if (prefixed && pool.some((x) => isPrefixed(x.r))) pool = pool.filter((x) => isPrefixed(x.r));
    let pick: CatalogRow | null = null;
    let best = 0;
    for (const { r, rank } of pool) {
      const score = (r.active && !r.hidden ? 20 : 0) + (r.rate != null && r.rate > 0 ? 10 : 0) + rank;
      if (score > best) [pick, best] = [r, score];
    }
    if (pick) out[k] = { sku: pick.sku, name: pick.name, rate: pick.rate, active: pick.active, hidden: pick.hidden };
  }
  return out;
}

export type KitPriceStatus = "priced" | "no-price" | "inactive" | "missing";

export type KitPrice = {
  ev: string;
  /** Kits on the line. */
  q: number;
  status: KitPriceStatus;
  /** The sell price of one kit: on a priced part, and shown (never counted) on an inactive or hidden one. */
  unit: number | null;
  /** unit x quantity, only on a priced line: the lines the total adds up. */
  line: number | null;
  /** The Parts list number the kit matched. */
  sku: string | null;
};

const money = (n: number) => Math.round(n * 100) / 100;

/** `catalog` is keyed by `kitKey` of the kit number, as `pickCatalog` returns it. */
export function priceKits(lines: KitLine[], catalog: Record<string, CatalogKit | undefined>): KitPrice[] {
  return lines.map((k) => {
    const base = { ev: k.ev, q: k.q, unit: null, line: null };
    const hit = catalog[kitKey(k.ev)];
    if (!hit) return { ...base, status: "missing", sku: null };
    const unit = hit.rate != null && hit.rate > 0 ? money(hit.rate) : null;
    // A part the Parts list hides or retired is flagged with its last price, but is not something to sell.
    if (hit.hidden || !hit.active) return { ...base, status: "inactive", unit, sku: hit.sku };
    if (unit == null) return { ...base, status: "no-price", sku: hit.sku };
    return { ...base, status: "priced", unit, line: money(unit * k.q), sku: hit.sku };
  });
}

/** Counted in kits (quantities) throughout, the same unit as "N kits in total". */
export type KitPriceSummary = {
  /** Sum of the priced lines. Inactive or hidden parts are flagged on their row, never counted. */
  total: number;
  /** Kits on the list, and how many of them the total leaves out. */
  kits: number;
  uncounted: number;
  /** Kits the Parts list does not have at all. */
  missing: number;
};

export function summarizePrices(prices: KitPrice[]): KitPriceSummary {
  const kits = (ps: KitPrice[]) => ps.reduce((a, p) => a + p.q, 0);
  return {
    total: money(prices.reduce((a, p) => a + (p.line ?? 0), 0)),
    kits: kits(prices),
    uncounted: kits(prices.filter((p) => p.status !== "priced")),
    missing: kits(prices.filter((p) => p.status === "missing")),
  };
}

/** True when at least one kit matched a part in the Parts list, sellable or not: then there is a total to show. */
export const anyFound = (s: KitPriceSummary): boolean => s.missing < s.kits;

/** "7 of 10 kits not counted": the same words on the sheet and in the copied kit list. Empty when all count. */
export function uncountedNote(s: KitPriceSummary): string {
  return s.uncounted ? `${s.uncounted} of ${s.kits} kit${s.kits === 1 ? "" : "s"} not counted` : "";
}

export const PRICE_NOTE: Record<KitPriceStatus, string> = {
  priced: "",
  "no-price": "No sell price in the catalog",
  inactive: "Inactive or hidden in the catalog",
  missing: "Not in parts catalog",
};

export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One kit's price, as short pieces the sheet joins with " · " and the copied kit list with ", ": the Parts list
 * number when it differs from the kit number (the number to order by), then the price or why there is none.
 */
export function kitPriceParts(p: KitPrice): string[] {
  const part = p.sku && kitKey(p.sku) !== kitKey(p.ev) ? [`Part ${p.sku}`] : [];
  if (p.status === "priced") return [...part, `${usd(p.unit ?? 0)} each`, usd(p.line ?? 0)];
  if (p.status === "inactive") return [...part, PRICE_NOTE.inactive, ...(p.unit != null ? [`${usd(p.unit)} each`] : []), "not counted"];
  return [...part, PRICE_NOTE[p.status]];
}
