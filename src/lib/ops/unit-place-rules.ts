import { LOCATION_SITES, SITE_LABEL, rackBayError, siteLabel, slotId } from "./warehouse.ts";

export const HOUSE_TRAINING = "training";
export const HOUSE_LOBBY = "front-lobby";
export const HOUSE_STAGING = "staging";
export const HOUSE_OTHER = "other";

export const CUSTOMER_SITES = LOCATION_SITES.filter((s) => s !== HOUSE_TRAINING && s !== HOUSE_LOBBY);

export const PLACE_CHOICES = [
  { value: "barn-front", label: "Front rack" },
  { value: "barn-back", label: "Back rack" },
  { value: HOUSE_TRAINING, label: "Training" },
  { value: "lobby", label: "Lobby" },
  { value: HOUSE_STAGING, label: "Staging area" },
  { value: HOUSE_OTHER, label: "Other" },
  ...CUSTOMER_SITES.map((s) => ({ value: s, label: SITE_LABEL[s] ?? s })),
] as const;

export function electricalFrom(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/\b(\d{2,3}\s*V(?:\s*\/\s*[^\s,;]+)?(?:\s*\/\s*\d{1,3}A)?)\b/i);
  return m ? m[1]!.replace(/\s+/g, " ") : null;
}

export function resolvePlaceSite(value: string): string {
  if (value === "lobby") return HOUSE_LOBBY;
  return value;
}

export function isRackPlace(site: string | null | undefined): boolean {
  return site === "barn-front" || site === "barn-back";
}

export function unitPlaceLabel(row: {
  site: string;
  pallet?: string | null;
  level?: number | null;
  status?: string | null;
  soldTo?: string | null;
  purpose?: string | null;
}): string {
  const pallet = row.pallet?.trim().toUpperCase();
  const level = row.level == null || Number.isNaN(Number(row.level)) ? null : Number(row.level);
  const rack = row.site === "barn-front" ? "Front" : row.site === "barn-back" ? "Back" : null;
  if (rack && pallet && level) return `${rack} · ${slotId(pallet, level)}`;
  if (rack && pallet) return `${rack} · ${pallet}`;
  if (rack) return rack === "Front" ? "Front rack" : "Back rack";
  if (row.site === HOUSE_TRAINING) return "Training";
  if (row.site === HOUSE_LOBBY) return "Lobby";
  if (row.site === HOUSE_STAGING) return "Staging area";
  if (row.site === HOUSE_OTHER) return (row.purpose ?? "").trim() || "Other";
  if (row.site === "account") return row.soldTo?.trim() ? `On ${row.soldTo.trim()}` : "On the account";
  if (row.site === "removed" || row.status === "removed") return "Removed from stock";
  const site = siteLabel(row.site);
  if (row.soldTo?.trim() && (row.status === "assigned" || row.status === "sold")) {
    return `${row.soldTo.trim()} / ${site}`;
  }
  return site || SITE_LABEL[row.site] || row.site;
}

export function lastMoveLine(notes: string | null | undefined): string | null {
  const lines = (notes ?? "")
    .split(/\n/)
    .map((s) => s.trim())
    .filter((s) => /^Moved from /i.test(s));
  return lines.length ? lines[lines.length - 1]! : null;
}

/**
 * A unit assigned to an account, or sold, is locked: it is an asset at that site or customer.
 * It can't be put on a rack, moved to another place, or given to another account until it is returned.
 */
export function placeMove(existing: { status: string } | null): "create" | "move" | "blocked" {
  if (!existing) return "create";
  if (existing.status === "sold" || existing.status === "assigned") return "blocked";
  return "move";
}

export function placeDraftError(draft: { site: string; pallet?: string | null; level?: string | null; otherLabel?: string | null }): string | null {
  if (!draft.site || draft.site === "barn") return "Pick a rack.";
  if (isRackPlace(draft.site)) {
    const bay = rackBayError(draft.site, draft.pallet);
    if (bay) return bay.endsWith(".") ? bay : `${bay}.`;
  }
  if (isRackPlace(draft.site) && !draft.level) return "Pick a level.";
  if (draft.site === HOUSE_OTHER && !(draft.otherLabel ?? "").trim()) return "Other needs a short label.";
  return null;
}
