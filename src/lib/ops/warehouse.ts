export const BACK_PALLETS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
] as const;

export const FRONT_PALLETS = ["I", "J", "K", "L", "M", "N", "O", "P"] as const;

export const LEVELS = [4, 3, 2, 1] as const;
export const LINES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const BARN_SITES = ["barn-back", "barn-front"] as const;

export const LOCATION_SITES = [
  "front-lobby",
  "service-room",
  "production",
  "training",
  "out-of-state",
  "san-antonio",
  "dallas",
] as const;

export const SITE_LABEL: Record<string, string> = {
  "barn-back": "Barn · back rack",
  "barn-front": "Barn · front rack",
  "front-lobby": "Front Lobby",
  "service-room": "Service Room",
  production: "Production",
  training: "Training Room",
  "out-of-state": "Out of State",
  "san-antonio": "San Antonio",
  dallas: "Dallas",
  field: "Pulled from the barn",
  sold: "Sold",
};

export const SITE_PURPOSE: Record<string, string> = {
  "front-lobby": "Front Lobby",
  "service-room": "Service bench",
  production: "Production",
  training: "Training",
  "out-of-state": "Out of state",
  "san-antonio": "SA warehouse",
  dallas: "Dallas warehouse",
};

export const BACK_EQUIP_CAPACITY = 14 * 4 * 12; // A–D + G–P
export const FRONT_CAPACITY = 8 * 4 * 12;
export const DISPENSER_LINES = 2 * 4 * 12;
export const BARN_EQUIP_CAPACITY = BACK_EQUIP_CAPACITY + FRONT_CAPACITY;

export type Bay = "catering" | "dispenser" | "general";

const BAY_LETTERS = "ABCDEFGHIJKLMNOP";

export function isValidBay(pallet: string | null | undefined): boolean {
  if (!pallet) return false;
  const c = pallet.trim().toUpperCase();
  return c.length === 1 && BAY_LETTERS.includes(c);
}

/** B–Q labels shift one letter down to A–P. Anything else is left as-is. */
export function shiftLegacyPallet(letter: string | null | undefined): string | null {
  if (letter == null) return null;
  const c = String(letter).trim().toUpperCase();
  if (!c) return null;
  if (c.length !== 1) return letter;
  const code = c.charCodeAt(0);
  if (code >= 66 && code <= 81) return String.fromCharCode(code - 1);
  return c;
}

export function needsBay(site: string, pallet: string | null | undefined): boolean {
  if (site !== "barn-back" && site !== "barn-front") return false;
  if (!pallet || !pallet.trim()) return true;
  const c = pallet.trim().toUpperCase();
  if (c === "Q" || (c.length === 1 && c > "P")) return true;
  return !isValidBay(c);
}

export function bayFor(site: string, pallet: string | null | undefined): Bay {
  if (site === "barn-back" && pallet) {
    const p = pallet.trim().toUpperCase();
    if ("ABCD".includes(p)) return "catering";
    if ("EF".includes(p)) return "dispenser";
  }
  return "general";
}

export function palletsFor(site: string): readonly string[] {
  return site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
}

export function slotId(pallet: string, level: number, line?: number | null): string {
  return line ? `${pallet}-L${level} · ${line}` : `${pallet}-L${level}`;
}

export function siteLabel(site: string): string {
  return SITE_LABEL[site] ?? site;
}

export function isBarn(site: string): boolean {
  return site === "barn-back" || site === "barn-front";
}
