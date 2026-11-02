/**
 * The get-ready list for the techs in Service Monkeys (Chuy, 11/2): each machine on the installs coming up, and what
 * to pull for it from the barn. Pure: no server imports, safe for node --test.
 */
import { serialKey } from "./account-equip.ts";
import { readsAsModel, sameWarehouseModel } from "./warehouse-serial.ts";

/**
 * One warehouse unit: one pulled for an install (`where` is the slot it came from), or one in barn stock. A stock
 * row with a quantity of more than one is that many units.
 */
export type ReadyUnit = { id: number; model: string; serial: string; where: string; tested: boolean; needsTest: boolean };

export type ReadyInstall = {
  id: number;
  date: string;
  /** "9:30a", or blank. */
  time: string;
  /** The same time as "09:30" for sorting, or blank. */
  at: string;
  customer: string;
  machines: { model: string; serial: string }[];
  /** The warehouse units pulled (assigned) for this install. */
  pulled: ReadyUnit[];
};

export type GetReadyLine = {
  date: string;
  time: string;
  customer: string;
  model: string;
  /** The machine's serial, or the pulled unit's. */
  serial: string;
  /** pulled: a unit is pulled for it; to-pull: a unit in stock to pull; none: no unit in stock for it. */
  state: "pulled" | "to-pull" | "none";
  /** The slot it was pulled from, or the slot to pull it from. */
  where: string;
  /** The stock unit's serial, when the machine has none yet. */
  unitSerial: string;
  /** More units of this model left in stock after this one. */
  more: number;
  needsTest: boolean;
};

/** ISO days or times in order, blanks last. */
const blankLast = (a: string, b: string) => (a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? -1 : 1);

/** Shop-tested units first, then ones with no test mark, then ones that still need a test; then by slot. */
function pickOrder(a: ReadyUnit, b: ReadyUnit): number {
  const rank = (u: ReadyUnit) => (u.tested ? 0 : u.needsTest ? 2 : 1);
  return rank(a) - rank(b) || a.where.localeCompare(b.where) || a.id - b.id;
}

/**
 * One line per machine, soonest install first (by date, then time). Serials go first, across every install: a
 * machine with a serial takes the pulled unit with it, else the stock unit with it, and a machine whose serial no
 * unit has is "none". Then each machine with no serial takes a pulled unit of its model, else a stock unit of its
 * model (shop-tested first). Each unit goes to one machine only, so two installs never count on the same unit, and
 * which install is listed first doesn't change what another one gets by serial.
 */
export function planGetReady(installs: ReadyInstall[], stock: ReadyUnit[], catalog: string[] = []): GetReadyLine[] {
  const same = (a: string, b: string) => sameWarehouseModel(a, b) || readsAsModel(a, b, catalog);
  const left = [...stock].sort(pickOrder);
  const order = [...installs].sort(
    (a, b) => blankLast(a.date, b.date) || blankLast(a.at, b.at) || a.customer.localeCompare(b.customer) || a.id - b.id,
  );
  type Slot = { line: GetReadyLine | null; model: string; key: string };
  const plans = order.map((ins) => ({
    ins,
    pool: [...ins.pulled],
    slots: ins.machines.map((m): Slot => ({ line: null, model: m.model.trim(), key: serialKey(m.serial) })).filter((s) => s.model),
    serials: ins.machines.filter((m) => m.model.trim()).map((m) => m.serial.trim()),
  }));
  const base = (ins: ReadyInstall, model: string, serial: string) => ({ date: ins.date, time: ins.time, customer: ins.customer, model, serial });
  const take = (list: ReadyUnit[], test: (u: ReadyUnit) => boolean): ReadyUnit | null => {
    const at = list.findIndex(test);
    return at < 0 ? null : list.splice(at, 1)[0]!;
  };

  // 1. Serials.
  for (const plan of plans) {
    plan.slots.forEach((slot, i) => {
      if (!slot.key) return;
      const serial = plan.serials[i]!;
      const pulled = take(plan.pool, (u) => serialKey(u.serial) === slot.key);
      if (pulled) {
        slot.line = { ...base(plan.ins, slot.model, serial), state: "pulled", where: pulled.where, unitSerial: pulled.serial, more: 0, needsTest: pulled.needsTest };
        return;
      }
      const unit = take(left, (u) => serialKey(u.serial) === slot.key);
      slot.line = unit
        ? { ...base(plan.ins, slot.model, serial), state: "to-pull", where: unit.where, unitSerial: unit.serial, more: 0, needsTest: unit.needsTest }
        : { ...base(plan.ins, slot.model, serial), state: "none", where: "", unitSerial: "", more: 0, needsTest: false };
    });
  }
  // 2. Models, for the machines with no serial.
  for (const plan of plans) {
    for (const slot of plan.slots) {
      if (slot.line) continue;
      const pulled = take(plan.pool, (u) => same(slot.model, u.model));
      if (pulled) {
        slot.line = { ...base(plan.ins, slot.model, pulled.serial), state: "pulled", where: pulled.where, unitSerial: pulled.serial, more: 0, needsTest: pulled.needsTest };
        continue;
      }
      const unit = take(left, (u) => same(slot.model, u.model));
      slot.line = unit
        ? {
            ...base(plan.ins, slot.model, ""),
            state: "to-pull",
            where: unit.where,
            unitSerial: unit.serial,
            more: left.filter((x) => same(slot.model, x.model)).length,
            needsTest: unit.needsTest,
          }
        : { ...base(plan.ins, slot.model, ""), state: "none", where: "", unitSerial: "", more: 0, needsTest: false };
    }
  }
  return plans.flatMap((plan) => plan.slots.map((slot) => slot.line!));
}
