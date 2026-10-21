/**
 * Lines a stacked PM can add to the ticket's bill: ticked kits and billable extra parts.
 * Pure: the caller passes the catalog rows. No database, safe for node --test.
 */
import type { PartRef } from "./charges.ts";
import type { KitLine } from "./pm-runbook.ts";
import {
  kitKey,
  pickCatalog,
  prefixForManufacturer,
  priceKits,
  PRICE_NOTE,
  type CatalogKit,
  type CatalogRow,
} from "./pm-runbook-prices.ts";

export type BillCatalogRow = CatalogRow & { part?: PartRef | null };

export type BillKit = { ev: string; name: string; q: number };

export type BillPart = {
  id: number;
  item: string;
  description: string | null;
  qty: number;
  billable: boolean;
  billingItemId: number | null;
  active: boolean;
  hidden: boolean;
  rate: number | null;
  currentItem: string | null;
  part: PartRef | null;
};

export type BillMachine = {
  label: string;
  serial: string | null;
  /** 'acct:<id>' when the line is matched, otherwise the piece key. */
  machineKey: string;
  accountId: number | null;
  serialKey: string | null;
  manufacturer: string | null;
  kits: BillKit[];
  /** Check keys, `kit:<ev>`, under the unit key or the piece key. */
  ticks: string[];
  catalog: BillCatalogRow[];
  parts: BillPart[];
  /** The equipment line is gone. Billable parts are listed and cannot be added. */
  offPm?: boolean;
};

export type BillPm = { id: number; status: string; machines: BillMachine[] };

export type BillSuggestLine = {
  item: string;
  description: string;
  qty: number;
  rate: number;
  part: PartRef | null;
  sourceKey: string;
  pmId: number;
  machine: string;
  reason: string | null;
  alreadyOn: boolean;
};

export type BillGroup = {
  pmId: number;
  machine: string | null;
  note: string | null;
  lines: BillSuggestLine[];
};

const MAX_LINES = 200;
const MAX_DESC = 500;

export function tripDraftWarning(tripCount: number): string | null {
  return tripCount > 1 ? `This bill has ${tripCount} trip charges.` : null;
}

/** A pmkit key is the same kit on this PM whichever machine key it was saved under. */
export function sourceKeyTaken(keys: readonly string[], sourceKey: string): boolean {
  if (keys.includes(sourceKey)) return true;
  const want = pmKitParts(sourceKey);
  if (!want) return false;
  return keys.some((key) => {
    const got = pmKitParts(key);
    return !!got && got.pmId === want.pmId && got.ev === want.ev;
  });
}

function pmKitParts(key: string): { pmId: string; ev: string } | null {
  if (!key.startsWith("pmkit:")) return null;
  const rest = key.slice("pmkit:".length);
  const cut = rest.indexOf(":");
  if (cut <= 0) return null;
  const pmId = rest.slice(0, cut);
  if (!/^\d+$/.test(pmId)) return null;
  const tail = rest.slice(cut + 1);
  const evAt = tail.lastIndexOf(":");
  if (evAt <= 0) return null;
  const ev = kitKey(tail.slice(evAt + 1));
  return ev ? { pmId, ev } : null;
}

function describe(text: string, machine: string, serial: string | null, pmId: number): string {
  const sn = String(serial ?? "").trim();
  const body = `${text.trim()} — ${machine}${sn ? ` SN ${sn}` : ""} (PM #${pmId})`;
  return body.length > MAX_DESC ? body.slice(0, MAX_DESC) : body;
}

function asKit(k: BillKit): KitLine {
  return { ev: k.ev, name: k.name, module: "", interval: 0, q: k.q, parts: [], notes: [] };
}

function picked(rows: BillCatalogRow[], hit: CatalogKit): BillCatalogRow | undefined {
  return rows.find((r) => r.sku === hit.sku && r.name === hit.name && r.active === hit.active && r.hidden === hit.hidden && r.rate === hit.rate);
}

function sameUnit(a: BillMachine, b: BillMachine): boolean {
  if (a.accountId != null && a.accountId === b.accountId) return true;
  const serial = String(a.serialKey ?? "").trim();
  return serial !== "" && serial === String(b.serialKey ?? "").trim();
}

/**
 * Suggestion lines for stacked PMs, newest first. A cancelled PM contributes its note and no lines.
 * At most 200 lines. A kit already suggested for the same account unit or serial on an earlier PM
 * in this list is unchecked. A line with no account unit is never deduped.
 */
export function suggestBill(pms: readonly BillPm[], onBill: readonly string[]): { groups: BillGroup[] } {
  const groups: BillGroup[] = [];
  let left = MAX_LINES;
  const claimed = new Map<string, { pmId: number; machine: BillMachine; ev: string }>();
  const push = (group: BillGroup, line: BillSuggestLine) => {
    if (left <= 0) return;
    group.lines.push(line);
    left -= 1;
  };
  for (const pm of pms) {
    if (pm.status === "Cancelled") {
      groups.push({ pmId: pm.id, machine: null, note: `PM #${pm.id} is cancelled.`, lines: [] });
      continue;
    }
    for (const machine of pm.machines) {
      const group: BillGroup = { pmId: pm.id, machine: machine.label, note: null, lines: [] };
      if (!machine.offPm) {
        const ticked = new Set(machine.ticks.filter((t) => t.startsWith("kit:")).map((t) => kitKey(t.slice(4))));
        const kits = machine.kits.filter((k) => ticked.has(kitKey(k.ev)) && k.q > 0);
        const prefix = prefixForManufacturer(machine.manufacturer);
        const catalog = pickCatalog(kits.map((k) => k.ev), machine.catalog, prefix);
        const priced = priceKits(kits.map(asKit), catalog);
        kits.forEach((kit, i) => {
          const price = priced[i];
          if (!price) return;
          const hit = catalog[kitKey(kit.ev)];
          const row = hit ? picked(machine.catalog, hit) : undefined;
          const prior = [...claimed.values()].find((c) => c.ev === kitKey(kit.ev) && sameUnit(c.machine, machine));
          const sourceKey = `pmkit:${pm.id}:${machine.machineKey}:${kit.ev}`;
          const reason = prior
            ? `Also on PM #${prior.pmId} for this machine.`
            : price.status === "priced"
              ? null
              : PRICE_NOTE[price.status];
          const text = (row?.description ?? "").trim() || kit.name || kit.ev;
          push(group, {
            item: (price.status === "priced" ? hit?.name : hit?.name || kit.name) || kit.ev,
            description: describe(text, machine.label, machine.serial, pm.id),
            qty: kit.q,
            rate: price.status === "priced" ? (price.unit ?? 0) : 0,
            part: row?.part ?? null,
            sourceKey,
            pmId: pm.id,
            machine: machine.label,
            reason,
            alreadyOn: sourceKeyTaken(onBill, sourceKey),
          });
          if (!prior) claimed.set(`${pm.id}:${machine.machineKey}:${kitKey(kit.ev)}`, { pmId: pm.id, machine, ev: kitKey(kit.ev) });
        });
      }
      for (const part of machine.parts) {
        if (!part.billable || !(part.qty > 0)) continue;
        const gone = part.billingItemId == null;
        const dead = !gone && (part.hidden || !part.active);
        const priced = !gone && !dead && part.rate != null && part.rate > 0;
        const reason = machine.offPm
          ? `This machine is no longer on PM #${pm.id}.`
          : gone
            ? "No longer in the Parts list."
            : dead
              ? PRICE_NOTE.inactive
              : priced
                ? null
                : PRICE_NOTE["no-price"];
        const sourceKey = `mp:${part.id}`;
        push(group, {
          item: (part.currentItem ?? "").trim() || part.item,
          description: describe((part.description ?? "").trim() || part.item, machine.label, machine.serial, pm.id),
          qty: part.qty,
          rate: priced ? part.rate ?? 0 : 0,
          part: gone ? null : part.part,
          sourceKey,
          pmId: pm.id,
          machine: machine.label,
          reason,
          alreadyOn: sourceKeyTaken(onBill, sourceKey),
        });
      }
      if (group.lines.length) groups.push(group);
    }
  }
  return { groups };
}
