export const BACK_PALLETS = [
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
  "Q",
] as const;

export const FRONT_PALLETS = ["J", "K", "L", "M", "N", "O", "P", "Q"] as const;

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
  "production": "Production",
  "training": "Training Room",
  "out-of-state": "Out of State",
  "san-antonio": "San Antonio",
  dallas: "Dallas",
  field: "Assigned to install",
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

export const BACK_EQUIP_CAPACITY = 14 * 4 * 12; // B–E + H–Q
export const FRONT_CAPACITY = 8 * 4 * 12;
export const DISPENSER_LINES = 2 * 4 * 12;
export const BARN_EQUIP_CAPACITY = BACK_EQUIP_CAPACITY + FRONT_CAPACITY;

export type Bay = "catering" | "dispenser" | "general";

export function bayFor(site: string, pallet: string | null | undefined): Bay {
  if (site === "barn-back" && pallet) {
    if ("BCDE".includes(pallet)) return "catering";
    if ("FG".includes(pallet)) return "dispenser";
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
