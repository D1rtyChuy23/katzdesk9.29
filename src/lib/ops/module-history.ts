/**
 * An Eversys module as an asset: its trail (every account and unit it has been on) and the parts and labor logged
 * on it. Swaps trade one module for another of the same type on the same unit, and both sides are recorded.
 * Pure: no server imports, safe for node --test.
 */

/** One serial = one module record: case and spaces never make a second one. */
export function moduleSerialKey(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\s+/g, "").toUpperCase();
}

/** The module already on the list with this serial or ID, if any. */
export function findModule<T extends { moduleId: string }>(list: T[], typed: string): T | null {
  const key = moduleSerialKey(typed);
  if (!key) return null;
  return list.find((m) => moduleSerialKey(m.moduleId) === key) ?? null;
}

/** Modules whose serial starts with or holds what is typed, exact match first. For the search before adding. */
export function searchModules<T extends { moduleId: string }>(list: T[], typed: string, limit = 8): T[] {
  const key = moduleSerialKey(typed);
  if (key.length < 2) return [];
  const hits = list.filter((m) => moduleSerialKey(m.moduleId).includes(key));
  const rank = (m: T) => (moduleSerialKey(m.moduleId) === key ? 0 : moduleSerialKey(m.moduleId).startsWith(key) ? 1 : 2);
  return hits.sort((a, b) => rank(a) - rank(b) || moduleSerialKey(a.moduleId).localeCompare(moduleSerialKey(b.moduleId))).slice(0, limit);
}

export type SwapSide = {
  id: number;
  moduleId: string;
  moduleType: string | null;
  platform: string | null;
  status: string;
  assignedCustomer: string | null;
  assignedUnitId: number | null;
  returnPending?: boolean;
};

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * Why these two cannot be swapped, or null. The outgoing module is on an account's unit; the incoming one is at HQ
 * and not spoken for. Same module type only (and same platform when both are known).
 */
export function swapError(out: SwapSide, incoming: SwapSide, incomingAtHq: boolean): string | null {
  if (out.id === incoming.id) return "Pick a different module to swap in.";
  if (!out.assignedCustomer?.trim() || out.assignedUnitId == null) return `Module ${out.moduleId} is not on an account's unit, so there is nothing to swap.`;
  if (out.returnPending) return `Module ${out.moduleId} is waiting on a return approval.`;
  if (!incomingAtHq || incoming.assignedCustomer?.trim()) return `Module ${incoming.moduleId} is not at HQ. Only a module at HQ can be swapped in.`;
  if (incoming.returnPending) return `Module ${incoming.moduleId} is waiting on a return approval.`;
  if (!out.moduleType?.trim() || !same(out.moduleType, incoming.moduleType)) {
    return `Swap only for the same type: ${out.moduleId} is ${out.moduleType || "not typed"}, ${incoming.moduleId} is ${incoming.moduleType || "not typed"}.`;
  }
  if (out.platform?.trim() && incoming.platform?.trim() && !same(out.platform, incoming.platform)) {
    return `Swap only within one platform: ${out.moduleId} is ${out.platform}, ${incoming.moduleId} is ${incoming.platform}.`;
  }
  return null;
}

/** Modules that can be swapped in for this one: at HQ, same type (and platform when known), Ready first. */
export function swapCandidates<T extends SwapSide>(out: SwapSide, list: T[], atHq: (m: T) => boolean): T[] {
  return list
    .filter((m) => swapError(out, m, atHq(m)) == null)
    .sort((a, b) => Number(b.status === "Ready") - Number(a.status === "Ready") || a.moduleId.localeCompare(b.moduleId));
}

export type StopKind = "assigned" | "returned" | "swap_out" | "swap_in" | "moved";

export type ModuleStop = {
  id: number;
  kind: StopKind;
  customer: string | null;
  unitLabel: string | null;
  otherModule: string | null;
  fromPlace: string | null;
  toPlace: string | null;
  happenedAt: string;
  byName: string | null;
  note: string | null;
};

/** One line for a stop on the trail. */
export function stopLine(s: ModuleStop): string {
  const unit = s.unitLabel ? ` · ${s.unitLabel}` : "";
  switch (s.kind) {
    case "assigned":
      return `Put on ${s.customer ?? "an account"}${unit}`;
    case "returned":
      return `Back to HQ from ${s.customer ?? s.fromPlace ?? "an account"}`;
    case "swap_out":
      return `Swapped out of ${s.customer ?? "an account"}${s.unitLabel ? ` · left ${s.unitLabel}` : ""}${s.otherModule ? ` · replaced by ${s.otherModule}` : ""} · back to HQ`;
    case "swap_in":
      return `Swapped into ${s.customer ?? "an account"}${s.unitLabel ? ` · went to ${s.unitLabel}` : ""}${s.otherModule ? ` · replacing ${s.otherModule}` : ""}`;
    case "moved":
      return `Location ${s.fromPlace ? `${s.fromPlace} → ` : ""}${s.toPlace ?? "cleared"}`;
  }
}

/** Newest first. Every stop is kept; the current place is the newest, the rest are past stops. */
export function trail(stops: ModuleStop[]): { current: ModuleStop | null; past: ModuleStop[] } {
  const sorted = [...stops].sort((a, b) => b.happenedAt.localeCompare(a.happenedAt) || b.id - a.id);
  return { current: sorted[0] ?? null, past: sorted.slice(1) };
}

/** Accounts this module has been on, oldest first, each once. */
export function accountsVisited(stops: ModuleStop[]): string[] {
  const out: string[] = [];
  for (const s of [...stops].sort((a, b) => a.happenedAt.localeCompare(b.happenedAt) || a.id - b.id)) {
    const name = (s.kind === "assigned" || s.kind === "swap_in" ? s.customer : null)?.trim();
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

export type WorkKind = "part" | "labor";
export type ModuleWork = { id: number; workedOn: string; kind: WorkKind; item: string; description: string | null; qty: number; wo: string | null; technician: string | null; note: string | null; byName: string | null };

/** Why a work line cannot be saved, or null. */
export function workError(w: { kind: unknown; item: unknown; qty: unknown; workedOn?: unknown }): string | null {
  if (w.kind !== "part" && w.kind !== "labor") return "Mark the line Part or Labor.";
  if (!String(w.item ?? "").trim()) return w.kind === "part" ? "Say which part was used." : "Say what the labor was.";
  const q = Number(String(w.qty ?? "").trim());
  if (!Number.isFinite(q) || q <= 0) return w.kind === "labor" ? "Hours must be more than zero." : "Quantity must be more than zero.";
  if (w.workedOn != null && w.workedOn !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(String(w.workedOn))) return "Pick the date the work was done.";
  return null;
}

/** Parts count and labor hours logged on the module. */
export function workTotals(list: Pick<ModuleWork, "kind" | "qty">[]): { parts: number; laborHours: number } {
  let parts = 0;
  let laborHours = 0;
  for (const w of list) {
    if (w.kind === "labor") laborHours += Number(w.qty) || 0;
    else parts += Number(w.qty) || 0;
  }
  return { parts: Math.round(parts * 100) / 100, laborHours: Math.round(laborHours * 100) / 100 };
}
