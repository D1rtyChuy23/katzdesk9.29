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

/** `catalog` is keyed by `kitKey` of the SKU or manufacturer number, whichever carried the EV number. */
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
