/**
 * PM runbook — which units a PM job covers. `pm_jobs.equipment` is free text, one machine per line (see
 * `equipmentCount`), so a unit is a line. Pure: the caller passes the customer's account_equipment rows and a
 * piece matcher, so this runs under node --test with no database.
 */
import { compactEquip, parseSerial, sameCatalogModel, serialKey } from "./account-equip.ts";
import { splitEquipment } from "./equipment.ts";

export type AccountUnitRow = {
  id: number;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  installDate?: string | null;
};

export type PlannedUnit = {
  /**
   * Stable id for this PM's ticks and choices. 'acct:<account_equipment id>' when the line matches an account unit
   * (so adding a serial later does not change it), else 'piece:<text>#<n>'.
   */
  unitKey: string;
  /**
   * The key this line has while it matches no account unit ('piece:<text>#<n>', n counting lines of the same text).
   * Ticks and choices saved under it are moved to the account key once the unit is matched.
   */
  pieceKey: string;
  /**
   * Where the unit's options live: the normalised serial when there is one (follows the unit between warehouse and
   * accounts), else 'acct:<id>' (persists across PMs), else null (matched nothing: options stay with this PM).
   */
  optionsKey: string | null;
  /** account_equipment row the line matched, if any. */
  accountId: number | null;
  /** Install date at this location from the matched account unit. */
  installDate: string | null;
  /** The equipment text as written on the PM job. */
  piece: string;
  serial: string | null;
  /** Normalised serial, the key the unit's options are stored under; null when there is no serial. */
  serialKey: string | null;
  runbookId: string;
  /** Model id when the text names it; null when the tech must pick. */
  model: string | null;
};

type Matcher = (piece: string) => { runbookId: string; model: string | null } | null;

/** Key under which a unit's options live. Same value whether the unit sits in `assets` or `account_equipment`. */
export function optionsKeyFor(serial: string | null | undefined): string | null {
  const s = parseSerial(serial);
  const k = s ? serialKey(s) : "";
  return k || null;
}

export function planUnits(
  equipment: string | null | undefined,
  accountRows: AccountUnitRow[],
  match: Matcher,
  pinned?: Readonly<Record<string, number>> | null,
): PlannedUnit[] {
  const used = new Set<number>();
  const seen = new Map<string, number>();
  const ordinals = new Map<string, number>();
  const reserved = new Map<number, string>();
  for (const [pieceKey, id] of Object.entries(pinned ?? {})) {
    if (accountRows.some((r) => r.id === id)) reserved.set(id, pieceKey);
  }
  const out: PlannedUnit[] = [];
  for (const piece of splitEquipment(equipment)) {
    const hit = match(piece);
    if (!hit) continue;
    const pieceBase = `piece:${compactEquip(piece)}`;
    const ord = (ordinals.get(pieceBase) ?? 0) + 1;
    ordinals.set(pieceBase, ord);
    const pieceKey = `${pieceBase}#${ord}`;
    const heldForOther = (id: number) => {
      const owner = reserved.get(id);
      return owner != null && owner !== pieceKey;
    };
    let idx = accountRows.findIndex((r, i) => !used.has(i) && r.id === pinned?.[pieceKey] && !heldForOther(r.id));
    if (idx < 0) {
      idx = accountRows.findIndex(
        (r, i) => !used.has(i) && !heldForOther(r.id) && (sameCatalogModel(piece, r.catalogModel) || sameCatalogModel(piece, r.equipmentName)),
      );
    }
    if (idx < 0) {
      // Loose text ("E4X-WIDE"): take an unused account unit the same runbook recognises, model permitting.
      idx = accountRows.findIndex((r, i) => {
        if (used.has(i) || heldForOther(r.id)) return false;
        const rowHit = match(r.equipmentName) ?? match(r.catalogModel);
        return !!rowHit && rowHit.runbookId === hit.runbookId && (!hit.model || !rowHit.model || rowHit.model === hit.model);
      });
    }
    let serial: string | null = null;
    let model = hit.model;
    if (idx >= 0) {
      used.add(idx);
      serial = parseSerial(accountRows[idx].serial);
      const rowHit = match(accountRows[idx].equipmentName) ?? match(accountRows[idx].catalogModel);
      if (!model && rowHit?.model) model = rowHit.model;
    }
    const sk = optionsKeyFor(serial);
    const accountId = idx >= 0 ? accountRows[idx].id : null;
    let unitKey: string;
    if (accountId != null) unitKey = `acct:${accountId}`;
    else {
      const base = `piece:${compactEquip(piece)}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      unitKey = `${base}#${n}`;
    }
    out.push({
      unitKey,
      pieceKey,
      optionsKey: sk ?? (accountId != null ? `acct:${accountId}` : null),
      accountId,
      installDate: idx >= 0 ? (accountRows[idx].installDate ?? null) : null,
      piece,
      serial,
      serialKey: sk,
      runbookId: hit.runbookId, model });
  }
  return out;
}

/** A runbook line is logged only when it is an account unit that has a serial. Install date is not required. */
export function unloggedUnitLines(units: PlannedUnit[]): string[] {
  return units.filter((u) => u.accountId == null || !u.serialKey).map((u) => u.piece);
}

/** Named error when a PM is being completed with an unlogged runbook unit. Null when completion is allowed. */
export function pmCompletionRefusal(units: PlannedUnit[]): string | null {
  const lines = unloggedUnitLines(units);
  if (!lines.length) return null;
  return `Log these units as assets before completing this PM: ${lines.join("; ")}`;
}
