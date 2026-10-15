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
 */
const eversysDigits = (key: string): string | null => /^EV(?:ER)?(\d{6})$/.exec(key)?.[1] ?? null;

/** Every number a kit can be filed under in the Parts list: its own, plus the Eversys spellings of its six digits. */
export function catalogKeys(ev: string): string[] {
  const k = kitKey(ev);
  if (!k) return [];
  const d = eversysDigits(k);
  return d ? [...new Set([k, `EV${d}`, `EVER${d}`, d])] : [k];
}

/**
 * How closely a Parts list row matches a kit: 3 the same number, 2 the same six Eversys digits (EV / EVER),
 * 1 the bare six digits on a part that is plainly Eversys, 0 not this kit. Bare digits alone never match another
 * maker's part that happens to share them, nor an Eversys part filed under different digits ("EVER109570 … was
 * 108390" is its own part, not kit 108390).
 */
export function matchRank(ev: string, row: Pick<CatalogRow, "sku" | "mfrPart" | "name" | "description">): number {
  const k = kitKey(ev);
  if (!k) return 0;
  const sku = kitKey(row.sku);
  const nums = [sku, kitKey(row.mfrPart)].filter(Boolean);
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
 * One Parts list row per kit, keyed by `kitKey` of the kit number. Bare six digits are only a fallback, used when no
 * part carries the kit's number or its EV / EVER spelling, and only when exactly one part has them: never a guess
 * between look-alikes such as a 12- and a 24-month version. Among the rest a part that is active, visible and priced
 * wins; among equals the closer number wins, then the first row. Kits with no matching part are absent.
 */
export function pickCatalog(evs: string[], rows: CatalogRow[]): Record<string, CatalogKit> {
  const out: Record<string, CatalogKit> = {};
  for (const ev of evs) {
    const k = kitKey(ev);
    if (!k || out[k]) continue;
    const ranked = rows.map((r) => ({ r, rank: matchRank(ev, r) })).filter((x) => x.rank > 0);
    const pool = ranked.some((x) => x.rank > 1) ? ranked.filter((x) => x.rank > 1) : ranked;
    if (pool.length > 1 && pool.every((x) => x.rank === 1)) continue;
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
  status: KitPriceStatus;
  /** Present unless the kit is missing or has no price. */
  unit: number | null;
  /** unit x quantity. */
  line: number | null;
  sku: string | null;
};

const money = (n: number) => Math.round(n * 100) / 100;

/** `catalog` is keyed by `kitKey` of the kit number, as `pickCatalog` returns it. */
export function priceKits(lines: KitLine[], catalog: Record<string, CatalogKit | undefined>): KitPrice[] {
  return lines.map((k) => {
    const hit = catalog[kitKey(k.ev)];
    if (!hit) return { ev: k.ev, status: "missing", unit: null, line: null, sku: null };
    if (hit.hidden || !hit.active) {
      const unit = hit.rate != null ? money(hit.rate) : null;
      return { ev: k.ev, status: "inactive", unit, line: unit != null ? money(unit * k.q) : null, sku: hit.sku };
    }
    if (hit.rate == null || !(hit.rate > 0)) return { ev: k.ev, status: "no-price", unit: null, line: null, sku: hit.sku };
    const unit = money(hit.rate);
    return { ev: k.ev, status: "priced", unit, line: money(unit * k.q), sku: hit.sku };
  });
}

export type KitPriceSummary = {
  /** Sum of lines that have a price (inactive kits included at their stored price). */
  total: number;
  priced: number;
  /** Kits not in the catalog at all. */
  missing: number;
  /** In the catalog but with no sell price, or inactive. */
  attention: number;
};

export function summarizePrices(prices: KitPrice[]): KitPriceSummary {
  return {
    total: money(prices.reduce((a, p) => a + (p.line ?? 0), 0)),
    priced: prices.filter((p) => p.status === "priced").length,
    missing: prices.filter((p) => p.status === "missing").length,
    attention: prices.filter((p) => p.status === "no-price" || p.status === "inactive").length,
  };
}

export const PRICE_NOTE: Record<KitPriceStatus, string> = {
  priced: "",
  "no-price": "In the catalog, no sell price",
  inactive: "Inactive or hidden in the catalog",
  missing: "Not in parts catalog",
};

export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
