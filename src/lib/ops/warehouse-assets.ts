/**
 * Assets → Warehouse (Chuy, 11/12): what the barn has to put out at a customer, what came back from a refurb and waits
 * in staging, and the refurbs still open. Read only: placing and moving a unit stays on the Warehouse page, and each
 * unit here opens there at its rack slot.
 */
import { siteLabel } from "@/lib/ops/warehouse";

/** One unit in the barn or in staging, as the Assets → Warehouse lists show it. */
export type StockUnit = {
  id: number;
  kind: string;
  model: string;
  serial: string | null;
  qty: number;
  site: string;
  pallet: string | null;
  level: number | null;
  lineNo: number | null;
  /** A shop test still to do ("needs-test") or done. */
  shopTest: string | null;
  /** A remove or assign request still waiting for an Admin: the unit isn't free until it's decided. */
  stockHold: string | null;
  stockHoldCustomer: string | null;
  customerOwned: string | null;
};

/** A refurb not yet completed, cancelled or archived, with the machines on it. */
export type OpenRebuild = {
  id: number;
  title: string;
  account: string;
  status: string;
  targetComplete: string | null;
  machines: { model: string; serial: string | null }[];
};

export type WarehouseAssets = { available: StockUnit[]; staging: StockUnit[]; rebuilds: OpenRebuild[] };

/** Where a unit is: "Barn back · C · L3 · #4", or the location's name. */
export function placeLabel(u: Pick<StockUnit, "site" | "pallet" | "level" | "lineNo">): string {
  return [siteLabel(u.site), u.pallet, u.level != null ? `L${u.level}` : null, u.lineNo != null ? `#${u.lineNo}` : null].filter(Boolean).join(" · ");
}

/** Free to put out: no request waiting on it. */
export const isFree = (u: Pick<StockUnit, "stockHold">) => !u.stockHold;

/** The available units by model, most first: how many of each the barn has free, and how many are spoken for. */
export function byModel(units: readonly StockUnit[]): { model: string; free: number; held: number }[] {
  const m = new Map<string, { model: string; free: number; held: number }>();
  for (const u of units) {
    const k = u.model.trim().toLowerCase();
    const cur = m.get(k) ?? { model: u.model.trim(), free: 0, held: 0 };
    if (isFree(u)) cur.free += u.qty || 1;
    else cur.held += u.qty || 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.free - a.free || b.held - a.held || a.model.localeCompare(b.model));
}

/** The units a search and a kind keep. */
export function filterStock(units: readonly StockUnit[], q: string, kind: string): StockUnit[] {
  const needle = q.trim().toLowerCase();
  return units.filter((u) => {
    if (kind && u.kind !== kind) return false;
    if (!needle) return true;
    return [u.model, u.serial, placeLabel(u), u.stockHoldCustomer].some((v) => String(v ?? "").toLowerCase().includes(needle));
  });
}
