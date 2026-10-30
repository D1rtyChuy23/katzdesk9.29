/**
 * Warehouse pulls (Chuy, 2026-10-29): a warehouse user pulls a unit onto one of its refurbs from wherever it is: on an
 * account, an install or a ticket, or at one of our places (the barn racks, the lobby, the service room, production,
 * training, staging, or the San Antonio, Dallas and out-of-state warehouses). No Admin approves it. Every Admin (the
 * owner flag, the same people who get Warehouse's rack and stock pings) gets a ping saying where the unit came from.
 * A unit waiting for an Admin's decision on a Warehouse request stays put, and so does a sold unit or one a person
 * locked, as for everyone.
 * Pure: no server imports, safe for node --test.
 */
import { unitPlaceLabel } from "./unit-place-rules.ts";

/** A unit as the pull read it. */
export type PulledUnit = {
  site: string;
  pallet: string | null;
  level: number | null;
  status: string;
  soldTo: string | null;
  purpose: string | null;
  installId: number | null;
  jobId: number | null;
};

/**
 * Where the unit is, as the words after "assigned to" or "from": "Bean Test Cafe", "a ticket for Bean Test Cafe",
 * "Bean Test Cafe at San Antonio", "San Antonio", "Back · B-L2".
 */
export function unitWhere(u: PulledUnit): string {
  const who = u.soldTo?.trim() || "";
  if (u.installId) return `an install for ${who || "an account"}`;
  if (u.jobId) return `a ticket for ${who || "an account"}`;
  if (u.status === "removed" || u.site === "removed") return "removed stock";
  if (u.status === "sold" || u.site === "sold") return who ? `${who} (sold)` : "sold stock";
  if (u.site === "account" || u.site === "field") return who || "an account";
  const place = unitPlaceLabel({ site: u.site, pallet: u.pallet, level: u.level, purpose: u.purpose });
  return who ? `${who} at ${place}` : place;
}

/**
 * The ping every Admin gets when Warehouse pulls a unit onto a refurb. The bell matches its first words. listedFor: a
 * customer whose Equipment list still has the serial (the pull doesn't change it), so the Admin can take it off.
 */
export function pullNotice(who: string, unit: { model: string; serial: string }, from: string, refurb: string, listedFor: string | null = null): string {
  const model = unit.model.trim() || "A unit";
  const listed = listedFor?.trim() ? ` Customers → ${listedFor.trim()} still lists it under Equipment.` : "";
  return `Unit pulled for a refurb. ${who} pulled ${model} SN ${unit.serial} from ${from} onto ${refurb}.${listed}`;
}

/** True for the ping above. */
export const isPullNotice = (body: string) => body.startsWith("Unit pulled for a refurb.");
