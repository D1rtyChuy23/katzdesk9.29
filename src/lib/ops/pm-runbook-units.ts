/**
 * PM runbook — which units a PM job covers. `pm_jobs.equipment` is free text, one machine per line (see
 * `equipmentCount`), so a unit is a line. Pure: the caller passes the customer's account_equipment rows and a
 * piece matcher, so this runs under node --test with no database.
 */
import { compactEquip, parseSerial, sameCatalogModel, serialKey } from "./account-equip.ts";
import { splitEquipment } from "./equipment.ts";

export type AccountUnitRow = { catalogModel: string; equipmentName: string; serial: string | null };

export type PlannedUnit = {
  /** Stable id for ticks and per-job choices: the serial key, else 'piece:<text>#<n>'. */
  unitKey: string;
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

export function planUnits(equipment: string | null | undefined, accountRows: AccountUnitRow[], match: Matcher): PlannedUnit[] {
  const used = new Set<number>();
  const seen = new Map<string, number>();
  const out: PlannedUnit[] = [];
  for (const piece of splitEquipment(equipment)) {
    const hit = match(piece);
    if (!hit) continue;
    let idx = accountRows.findIndex(
      (r, i) => !used.has(i) && (sameCatalogModel(piece, r.catalogModel) || sameCatalogModel(piece, r.equipmentName)),
    );
    if (idx < 0) {
      // Loose text ("E4X-WIDE"): take an unused account unit the same runbook recognises, model permitting.
      idx = accountRows.findIndex((r, i) => {
        if (used.has(i)) return false;
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
    let unitKey: string;
    if (sk) unitKey = sk;
    else {
      const base = `piece:${compactEquip(piece)}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      unitKey = `${base}#${n}`;
    }
    out.push({ unitKey, piece, serial, serialKey: sk, runbookId: hit.runbookId, model });
  }
  return out;
}
