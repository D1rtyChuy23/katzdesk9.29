export const REMOVE_REASONS = [
  "Sold / left with customer",
  "Installed",
  "Sent to rebuild",
  "Scrap / beyond repair",
  "Returned to vendor",
  "Duplicate record",
  "Other",
] as const;

export type RemoveReason = (typeof REMOVE_REASONS)[number];

const HOUSE_PLACES = new Set(["barn-back", "barn-front", "staging", "training", "front-lobby"]);

export function isRemoveReason(value: string): value is RemoveReason {
  return (REMOVE_REASONS as readonly string[]).includes(value);
}

export function removeReasonError(reason: string, note: string | null | undefined): string | null {
  if (!isRemoveReason(reason)) return "Pick a reason.";
  if (reason === "Other" && !(note ?? "").trim()) return "Other needs a note.";
  return null;
}

/** Rack, staging, training, or lobby — not a customer site. */
export function isWarehouseStockPlace(site: string | null | undefined): boolean {
  return HOUSE_PLACES.has(site ?? "");
}

export function customerLocationMessage(name: string): string {
  const who = name.trim() || "a customer account";
  return `This serial is still on ${who}. Move it off the account first.`;
}
