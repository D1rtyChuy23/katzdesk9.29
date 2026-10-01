/** Eversys machine detection and module availability — shared by server and client. */

const EVERSYS_RE = /\b(eversys|cameo|enigma|legacy|shotmaster)\b|\b[ce]'\s?[2468][ms]?\b|\bl'2[cm]\b/i;

/** True for an Eversys espresso machine (Cameo, Enigma e'4/e'6, Legacy, Shotmaster…). Fridges are accessories, not hosts. */
export function isEversysMachine(model: string | null | undefined): boolean {
  const m = (model ?? "").trim();
  if (!m) return false;
  if (/fridge/i.test(m)) return false;
  return EVERSYS_RE.test(m);
}

/** Map a machine model to the module platform family used on the Modules page. */
export function eversysFamily(model: string | null | undefined): "Cameo" | "Enigma / e'Line" | "Legacy" | "Shotmaster" | null {
  const m = (model ?? "").toLowerCase();
  if (!m) return null;
  if (/cameo|\bc'\s?2/.test(m)) return "Cameo";
  if (/enigma|e'?line|\be'\s?[46]/.test(m)) return "Enigma / e'Line";
  if (/legacy|\bl'2/.test(m)) return "Legacy";
  if (/shotmaster/.test(m)) return "Shotmaster";
  return null;
}

export type ModuleAvailability = "hq" | "assigned" | "away";

const AWAY = new Set(["Ship to Eversys (Core Swap)", "At Eversys - Awaiting Return", "Retired / Scrapped"]);

/**
 * hq = sitting at HQ and usable; assigned = on a café machine; away = at Eversys or retired.
 * Older rows marked "Installed at Account" (before modules attached to units) count as assigned.
 */
export function moduleAvailability(m: { status: string; assignedCustomer?: string | null }): ModuleAvailability {
  if (m.assignedCustomer?.trim()) return "assigned";
  if (m.status === "Installed at Account") return "assigned";
  if (AWAY.has(m.status)) return "away";
  return "hq";
}

/** Account a module sits on (new assignment first, then the legacy location text). */
export function moduleAccount(m: { status: string; assignedCustomer?: string | null; location?: string | null }): string | null {
  if (m.assignedCustomer?.trim()) return m.assignedCustomer.trim();
  if (m.status === "Installed at Account" && m.location?.trim() && m.location.trim().toUpperCase() !== "SHELF") {
    return m.location.trim();
  }
  return null;
}
