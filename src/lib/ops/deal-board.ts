/**
 * Deal -> Board -> install ticket. A machine on a deal is Sold, Loan or Lease; once Confirmed it becomes a row on
 * a board project (one install card), and the install ticket is read from that project.
 * Pure: no server imports, safe for node --test.
 */
import { siteIsReady, unitType, type InspectionOverall } from "./pre-inspection.ts";

/** Stored values. "Loaned" is the older word for Loan and still loads. */
export const OWNERSHIPS = ["Sold", "Loaned", "Leased"] as const;
export type Ownership = (typeof OWNERSHIPS)[number];
export const isOwnership = (v: unknown): v is Ownership => v === "Sold" || v === "Loaned" || v === "Leased";

/** One choice. Labels are Sold, Loan and Lease. Stored values stay Sold, Loaned and Leased. */
export const OWNERSHIP_CHOICES: { value: Ownership; label: string }[] = [
  { value: "Sold", label: "Sold" },
  { value: "Loaned", label: "Loan" },
  { value: "Leased", label: "Lease" },
];

export function ownershipLabel(v: unknown): string {
  return OWNERSHIP_CHOICES.find((c) => c.value === v)?.label ?? "";
}

export const OWNERSHIP_MARK = "Sold, Loan or Lease";

/** The fields a machine row carries on the deal, on the board project and on the install ticket. */
export type BoardMachine = {
  equipment: string;
  serial: string;
  powerVoltage: string;
  recipeId?: number | null;
  /** Sold, loaned (stored "Loaned") or leased (stored "Leased"). Blank until someone marks it. */
  ownership?: string;
  plug?: string;
  water?: string;
  /** Old rows may still carry this. It is never shown and never written back. */
  coffee?: string;
  /** Ties the deal row to the board row it became. Set when the machine is confirmed. */
  uid?: string;
  /** Deal rows: the day the machine was confirmed. */
  confirmedAt?: string | null;
  /** Deal rows: the board project holding this machine now. Worked out when the deal is read, never typed. */
  boardId?: number | null;
};

export type WaterNeed = "none" | "required" | "optional";

/** A grinder has no water line and no drain. A brewer or an espresso machine needs water. Anything else: only if set. */
export function waterNeed(model: string | null | undefined): WaterNeed {
  const t = unitType(model);
  if (t === "grinder") return "none";
  return t === "brewer" || t === "espresso" ? "required" : "optional";
}

export const NO_WATER_NOTE = "No water or drain";

const tidy = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Trimmed fields. A grinder never keeps a water value. Coffee is dropped: recipe is the only serving field. */
export function cleanMachine<T extends BoardMachine>(m: T): T {
  const equipment = tidy(m.equipment);
  const next = {
    ...m,
    equipment,
    serial: tidy(m.serial),
    powerVoltage: tidy(m.powerVoltage),
    ownership: isOwnership(m.ownership) ? m.ownership : "",
    plug: tidy(m.plug),
    water: waterNeed(equipment) === "none" ? "" : tidy(m.water),
  };
  delete next.coffee;
  return next;
}

/** Why this machine cannot be confirmed yet, or null. */
export function confirmError(m: Pick<BoardMachine, "equipment" | "ownership">): string | null {
  if (!tidy(m.equipment)) return "Pick a model first.";
  if (!isOwnership(m.ownership)) return `Mark ${tidy(m.equipment)} ${OWNERSHIP_MARK} before confirming it.`;
  return null;
}

/**
 * The row a confirmed machine becomes on the board project. Everything set on the deal goes with it: Sold, Loan
 * or Lease, serial, volts, plug, water and recipe. Coffee is not copied. The deal's own stamps stay behind.
 */
export function boardRow(m: BoardMachine, uid: string): BoardMachine {
  const c = cleanMachine(m);
  return {
    equipment: c.equipment,
    serial: c.serial,
    powerVoltage: c.powerVoltage,
    recipeId: c.recipeId ?? null,
    ownership: c.ownership,
    plug: c.plug,
    water: c.water,
    uid,
  };
}

export type ProjectRef = {
  id: number;
  dealId: number | null;
  customer: string;
  /** Installed projects are finished: nothing new is added to them. */
  installed: boolean;
  machines: Pick<BoardMachine, "equipment" | "uid">[];
};

const nameKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
const sameAccount = (a: string, b: string) => tidy(a).toLowerCase() === tidy(b).toLowerCase() && !!tidy(a);

/**
 * The board projects a newly confirmed machine may continue under: open cards from this deal, and open cards on
 * the same account that no deal owns yet. None means there is nothing to ask: the machine starts a project.
 */
export function continuable(deal: { id: number; customer: string }, projects: ProjectRef[]): ProjectRef[] {
  return projects
    .filter((p) => !p.installed && (p.dealId === deal.id || (p.dealId == null && sameAccount(p.customer, deal.customer))))
    .sort((a, b) => a.id - b.id);
}

/**
 * Where each deal row sits now: the id of the board project that holds it, or null when it is not on the Board.
 * A confirmed row is found by its tie to the board row, so renaming a model on the Board does not lose it, and a
 * machine taken off the Board reads as not confirmed again. Deals handed off before machines were tracked have no
 * tie: those rows are matched by model against that deal's own projects, one row per machine.
 */
export function placeRows(rows: BoardMachine[], projects: ProjectRef[], deal: { id: number; handedOff: boolean }): (number | null)[] {
  const byUid = new Map<string, number>();
  for (const p of projects) for (const m of p.machines) if (m.uid) byUid.set(m.uid, p.id);
  const out: (number | null)[] = rows.map((r) => (r.uid ? (byUid.get(r.uid) ?? null) : null));
  if (!deal.handedOff) return out;
  const loose = projects
    .filter((p) => p.dealId === deal.id)
    .sort((a, b) => a.id - b.id)
    .flatMap((p) => p.machines.filter((m) => !m.uid).map((m) => ({ id: p.id, key: nameKey(m.equipment), taken: false })));
  rows.forEach((r, i) => {
    if (r.uid || out[i] != null) return;
    const hit = loose.find((l) => !l.taken && l.key === nameKey(r.equipment));
    if (!hit) return;
    hit.taken = true;
    out[i] = hit.id;
  });
  return out;
}

/**
 * Rows as a window sends them, with the ties the stored rows already have. A machine confirmed (or handed off
 * with the deal) after that window was opened is still tied to its board row when the window saves: matched by
 * model, one stored row per incoming row, so nothing is tied twice.
 */
export function keepTies<T extends Pick<BoardMachine, "equipment" | "uid" | "confirmedAt">>(incoming: T[], stored: Pick<BoardMachine, "equipment" | "uid" | "confirmedAt">[]): T[] {
  const pool = stored.filter((s) => s.uid && !incoming.some((m) => m.uid === s.uid));
  return incoming.map((m) => {
    if (m.uid) return m;
    const at = pool.findIndex((s) => nameKey(s.equipment) === nameKey(String(m.equipment ?? "")));
    if (at < 0) return m;
    const [hit] = pool.splice(at, 1);
    return { ...m, uid: hit!.uid, confirmedAt: hit!.confirmedAt ?? null };
  });
}

/**
 * A confirmed machine is changed on the Board, not on the deal. Rows the Board holds (by their tie) are saved as
 * they are stored, whatever a window sends, and a window that leaves one out does not take it off the deal.
 */
export function lockConfirmed<T extends Pick<BoardMachine, "uid">>(incoming: T[], stored: T[], onBoard: Set<string>): T[] {
  const held = (m: T) => !!m.uid && onBoard.has(m.uid);
  const out = incoming.map((m) => (held(m) ? (stored.find((s) => s.uid === m.uid) ?? m) : m));
  for (const s of stored) if (held(s) && !out.some((m) => m.uid === s.uid)) out.push(s);
  return out;
}

export type ProjectStatus = "In Prep" | "Ready" | "Installed";

export function projectStatus(p: { installed: boolean; equipStatus: string | null | undefined; overall: InspectionOverall | null | undefined }): ProjectStatus {
  if (p.installed) return "Installed";
  return siteIsReady(p.equipStatus, p.overall) ? "Ready" : "In Prep";
}

/** "Project 2 of 3" when a deal has more than one board card; a single card needs no number. */
export function projectLabel(n: number, of: number): string {
  return of > 1 ? `Project ${n} of ${of}` : "Project";
}

export type TicketLine = {
  model: string;
  ownership: string;
  serial: string;
  volts: string;
  plug: string;
  /** null when this unit takes no water: a grinder never shows a water or drain field. */
  water: string | null;
  waterNeed: WaterNeed;
  recipe: string;
  /** What is still blank and expected on this unit, by field name. */
  missing: string[];
};

/** One machine on the install ticket, read from its row on the board project. */
export function ticketLine(m: BoardMachine, recipeName: string | null | undefined): TicketLine {
  const c = cleanMachine(m);
  const need = waterNeed(c.equipment);
  const recipe = tidy(recipeName);
  const coffeeUnit = unitType(c.equipment) !== "other";
  const missing: string[] = [];
  if (!c.ownership) missing.push(OWNERSHIP_MARK);
  if (!c.powerVoltage) missing.push("Volts");
  if (!c.plug) missing.push("Plug");
  if (need === "required" && !c.water) missing.push("Water");
  if (coffeeUnit && !recipe) missing.push("Recipe");
  return {
    model: c.equipment,
    ownership: ownershipLabel(c.ownership),
    serial: c.serial,
    volts: c.powerVoltage,
    plug: c.plug ?? "",
    water: need === "none" ? null : (c.water ?? ""),
    waterNeed: need,
    recipe,
    missing,
  };
}

export function ticketLines(machines: BoardMachine[], recipeName: (id: number | null | undefined, m: BoardMachine) => string | null | undefined): TicketLine[] {
  return machines.filter((m) => tidy(m.equipment)).map((m) => ticketLine(m, recipeName(m.recipeId, m)));
}

/** The install ticket opens once the project is Ready: equipment Ready and the pre-inspection passed. */
export const ticketOpen = siteIsReady;

/** One line per machine for a board card: "Linea PB · Sold · SN 123 · 208V · L6-30P". */
export function machineGlance(m: BoardMachine): string {
  const c = cleanMachine(m);
  return [ownershipLabel(c.ownership), c.serial ? `SN ${c.serial}` : "", c.powerVoltage, c.plug, c.water ? `Water ${c.water}` : ""]
    .filter(Boolean)
    .join(" · ");
}
