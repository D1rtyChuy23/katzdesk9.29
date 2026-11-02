/**
 * The get-ready list for the techs in Service Monkeys (Chuy, 11/2): each machine on the installs coming up, and what
 * to pull for it from the barn. Pure: no server imports, safe for node --test.
 */
import { serialKey } from "./account-equip.ts";
import { readsAsModel, sameWarehouseModel } from "./warehouse-serial.ts";

/** A warehouse unit: one pulled for an install (`where` is the slot it came from), or one in barn stock. */
export type ReadyUnit = { id: number; model: string; serial: string; where: string; tested: boolean; needsTest: boolean };

export type ReadyInstall = {
  id: number;
  date: string;
  /** "9:30a", or blank. */
  time: string;
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

/** Shop-tested units first, then ones with no test mark, then ones that still need a test; then by slot. */
function pickOrder(a: ReadyUnit, b: ReadyUnit): number {
  const rank = (u: ReadyUnit) => (u.tested ? 0 : u.needsTest ? 2 : 1);
  return rank(a) - rank(b) || a.where.localeCompare(b.where) || a.id - b.id;
}

/**
 * One line per machine, soonest install first. A machine is pulled when a unit pulled for its install has its serial,
 * else is that model. Otherwise it takes a unit from stock: the one with its serial when it has one (a machine with a
 * serial that no stock unit has is "none"), else a unit of that model. Each stock unit goes to one machine only, so
 * two installs never count on the same unit.
 */
export function planGetReady(installs: ReadyInstall[], stock: ReadyUnit[], catalog: string[] = []): GetReadyLine[] {
  const same = (a: string, b: string) => sameWarehouseModel(a, b) || readsAsModel(a, b, catalog);
  const left = [...stock].sort(pickOrder);
  const order = [...installs].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time || "~").localeCompare(b.time || "~") || a.customer.localeCompare(b.customer) || a.id - b.id,
  );
  const out: GetReadyLine[] = [];
  for (const ins of order) {
    const pool = [...ins.pulled];
    for (const m of ins.machines) {
      const model = m.model.trim();
      if (!model) continue;
      const key = serialKey(m.serial);
      const base = { date: ins.date, time: ins.time, customer: ins.customer, model, serial: m.serial.trim() };
      let at = key ? pool.findIndex((u) => serialKey(u.serial) === key) : -1;
      if (at < 0) at = pool.findIndex((u) => same(model, u.model));
      if (at >= 0) {
        const [u] = pool.splice(at, 1);
        out.push({ ...base, serial: base.serial || u!.serial, state: "pulled", where: u!.where, unitSerial: u!.serial, more: 0, needsTest: u!.needsTest });
        continue;
      }
      const pick = key ? left.findIndex((u) => serialKey(u.serial) === key) : left.findIndex((u) => same(model, u.model));
      if (pick < 0) {
        out.push({ ...base, state: "none", where: "", unitSerial: "", more: 0, needsTest: false });
        continue;
      }
      const [u] = left.splice(pick, 1);
      out.push({
        ...base,
        state: "to-pull",
        where: u!.where,
        unitSerial: u!.serial,
        more: left.filter((x) => same(model, x.model)).length,
        needsTest: u!.needsTest,
      });
    }
  }
  return out;
}
