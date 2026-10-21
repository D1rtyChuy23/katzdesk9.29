/**
 * Every machine written on a PM, including lines that have no runbook. Runbook lines stay planUnits.
 * Pure: no database, safe for node --test.
 */
import { compactEquip, parseSerial, sameCatalogModel } from "./account-equip.ts";
import { splitEquipment } from "./equipment.ts";
import { optionsKeyFor, planUnits, type AccountUnitRow, type PlannedUnit, type SerialMatcher } from "./pm-runbook-units.ts";

export type PlannedMachine = {
  /** 'acct:<id>' when the line is matched to an account unit, otherwise the piece key. */
  key: string;
  pieceKey: string;
  accountId: number | null;
  serial: string | null;
  serialKey: string | null;
  piece: string;
  /** Null when this line has no runbook. */
  runbookId: string | null;
  /** The runbook unit's key, or null when there is no runbook. */
  unitKey: string | null;
};

type Matcher = (piece: string) => { runbookId: string; model: string | null } | null;

/**
 * Equipment-text order. Runbook lines are planUnits, unchanged. A line with no runbook is still a machine:
 * its pinned account row, else a sameCatalogModel row no other line took. Never a loose match.
 */
export function planMachines(
  equipment: string | null | undefined,
  rows: AccountUnitRow[],
  match: Matcher,
  pinned?: Readonly<Record<string, number>> | null,
  bySerial?: SerialMatcher,
): PlannedMachine[] {
  const planned = planUnits(equipment, rows, match, pinned, bySerial);
  const queue: PlannedUnit[] = [...planned];
  const used = new Set<number>();
  for (const unit of planned) if (unit.accountId != null) used.add(unit.accountId);
  const reserved = new Map<number, string>();
  for (const [pieceKey, id] of Object.entries(pinned ?? {})) {
    if (rows.some((r) => r.id === id)) reserved.set(id, pieceKey);
  }
  const nonOrd = new Map<string, number>();
  const out: PlannedMachine[] = [];
  for (const piece of splitEquipment(equipment)) {
    if (match(piece)) {
      const unit = queue.shift();
      if (!unit) continue;
      out.push({
        key: unit.unitKey,
        pieceKey: unit.pieceKey,
        accountId: unit.accountId,
        serial: unit.serial,
        serialKey: unit.serialKey,
        piece: unit.piece,
        runbookId: unit.runbookId,
        unitKey: unit.unitKey,
      });
      continue;
    }
    const base = `piece:${compactEquip(piece)}`;
    const n = (nonOrd.get(base) ?? 0) + 1;
    nonOrd.set(base, n);
    const pieceKey = `${base}#${n}`;
    const heldForOther = (id: number) => {
      const owner = reserved.get(id);
      return owner != null && owner !== pieceKey;
    };
    let idx = rows.findIndex((r) => r.id === pinned?.[pieceKey] && !used.has(r.id) && !heldForOther(r.id));
    if (idx < 0) {
      idx = rows.findIndex(
        (r) => !used.has(r.id) && !heldForOther(r.id) && (sameCatalogModel(piece, r.catalogModel) || sameCatalogModel(piece, r.equipmentName)),
      );
    }
    let accountId: number | null = null;
    let serial: string | null = null;
    let serialKey: string | null = null;
    if (idx >= 0) {
      used.add(rows[idx].id);
      accountId = rows[idx].id;
      serial = parseSerial(rows[idx].serial);
      serialKey = optionsKeyFor(serial);
    }
    out.push({
      key: accountId != null ? `acct:${accountId}` : pieceKey,
      pieceKey,
      accountId,
      serial,
      serialKey,
      piece,
      runbookId: null,
      unitKey: null,
    });
  }
  return out;
}

/**
 * Why parts on this PM cannot change. Completed is not a reason: parts stay editable until the bill is final.
 * The first reason wins.
 */
export function partsLockReason(input: {
  pmId: number;
  status: string;
  stackedJobId: number | null;
  ticketSo: string | null;
  pmInvoiceHasLines: boolean;
}): string | null {
  if (input.status === "Cancelled") return `PM #${input.pmId} is cancelled.`;
  const so = String(input.ticketSo ?? "").trim();
  if (input.stackedJobId != null && so) {
    return `Ticket #${input.stackedJobId} is billed (${so}). Clear its Sales Order to change this PM's parts.`;
  }
  if (input.pmInvoiceHasLines) return `PM #${input.pmId} has its own approved invoice, so its parts can't change.`;
  return null;
}
