import { LOCATION_SITES, SITE_LABEL, isBarn, siteLabel, slotId } from "./warehouse.ts";

export const HOUSE_TRAINING = "training";
export const HOUSE_LOBBY = "front-lobby";
export const HOUSE_STAGING = "staging";
export const HOUSE_OTHER = "other";

export const CUSTOMER_SITES = LOCATION_SITES.filter((s) => s !== HOUSE_TRAINING && s !== HOUSE_LOBBY);

export const PLACE_CHOICES = [
  { value: HOUSE_TRAINING, label: "Training" },
  { value: "lobby", label: "Lobby" },
  { value: HOUSE_STAGING, label: "Staging area" },
  { value: HOUSE_OTHER, label: "Other" },
  { value: "barn", label: "Barn" },
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
  if (isBarn(row.site) && pallet && level) return `Barn · ${slotId(pallet, level)}`;
  if (isBarn(row.site) && pallet) return `Barn · ${pallet}`;
  if (isBarn(row.site)) return "Barn";
  if (row.site === HOUSE_TRAINING) return "Training";
  if (row.site === HOUSE_LOBBY) return "Lobby";
  if (row.site === HOUSE_STAGING) return "Staging area";
  if (row.site === HOUSE_OTHER) return (row.purpose ?? "").trim() || "Other";
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

export function placeMove(existing: { status: string } | null): "create" | "move" | "blocked" {
  if (!existing) return "create";
  if (existing.status === "sold" || existing.status === "assigned") return "blocked";
  return "move";
}

export function placeDraftError(draft: { site: string; pallet?: string | null; level?: string | null; otherLabel?: string | null }): string | null {
  if (!draft.site) return "Pick a location.";
  if (draft.site === "barn" && !(draft.pallet ?? "").trim()) return "Pick a bay A through P.";
  if (draft.site === "barn" && !draft.level) return "Pick a level.";
  if (draft.site === HOUSE_OTHER && !(draft.otherLabel ?? "").trim()) return "Other needs a short label.";
  return null;
}
