/**
 * What an open install still needs (Chuy, 11/2), for the reps' Teams notes: power and water notes on its machines,
 * and pre-inspection pictures. Pure: no server imports, safe for node --test.
 */
import { ticketLine, type BoardMachine } from "./deal-board.ts";
import { CORE_HOLE_CATEGORY } from "./pre-inspection.ts";

/**
 * The machines whose power notes (volts or plug) are blank, and the machines that take water whose water notes are
 * blank: the install ticket's own rule (a grinder takes no water).
 */
export function machineNotesMissing(machines: BoardMachine[]): { power: string[]; water: string[] } {
  const power: string[] = [];
  const water: string[] = [];
  for (const m of machines) {
    if (!String(m.equipment ?? "").trim()) continue;
    const line = ticketLine(m, null);
    if (line.missing.includes("Volts") || line.missing.includes("Plug")) power.push(line.model);
    if (line.missing.includes("Water")) water.push(line.model);
  }
  return { power, water };
}

/** One unit on an install's pre-inspection. */
export type PictureUnit = {
  model: string;
  /** Existing equipment: already pre-inspected, nothing to shoot. */
  preInspected: boolean;
  /** The checks this unit uses (Power, Water, Drain, Ethernet, Space by model). */
  categories: readonly string[];
  /** "yes" when the counter needs a core hole: that line needs a picture too. */
  coreNeeded: string | null;
  /** Each check's status ("Pass", "N/A", …); a check not in it is Not inspected. */
  statuses: Record<string, string>;
  /** Pictures on each check. */
  photos: Record<string, number>;
};

/**
 * Whether an install still needs pre-inspection pictures, and on which machines. A unit needs them while a check it
 * uses (and the core hole, when it needs one) has no picture, unless that check is N/A: Pass and Fail can't be saved
 * without one. Existing equipment needs none. An install the pre-inspection has no units for yet needs them for all
 * its machines (none named), and one an Admin overrode needs none.
 */
export function picturesNeeded(units: PictureUnit[], opts: { hasMachines: boolean; overridden: boolean }): { needed: boolean; machines: string[] } {
  if (opts.overridden) return { needed: false, machines: [] };
  if (!units.length) return { needed: opts.hasMachines, machines: [] };
  const machines = units
    .filter((u) => {
      if (u.preInspected) return false;
      const checks = [...u.categories, ...(u.coreNeeded === "yes" ? [CORE_HOLE_CATEGORY] : [])];
      return checks.some((c) => (u.statuses[c] ?? "Not inspected") !== "N/A" && !((u.photos[c] ?? 0) > 0));
    })
    .map((u) => u.model);
  return { needed: machines.length > 0, machines };
}
