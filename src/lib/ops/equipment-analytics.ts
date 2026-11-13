/**
 * Assets → Analytics (Chuy, 11/13): fleet counts, service load, ownership, and the machines not serviced in over a
 * year. The machines are the In the Field list; the visits are completed PMs, service and TLC tickets. These rules tie
 * a visit to a machine, date each machine's last service and count the load. Read only.
 *
 * A visit counts for a machine when:
 *  - a PM logged that machine (its runbook unit by serial or account unit, a unit link, or a part logged on it), or
 *  - a ticket at the machine's account writes the machine's serial as its own word (5 characters or more, a digit in it),
 *  - a ticket at the account names the machine's model (its catalog model or its equipment name). When the account has
 *    two or more of that model, the ticket must name it that many times; otherwise it can't say which, so it dates none
 *    of them (the account's load still counts it), or
 *  - a ticket at the account is for all its equipment ("All", "All equipment"): it dates every machine there.
 */
import { compactEquip, serialKey } from "@/lib/ops/account-equip";
import { csvCell } from "@/lib/ops/customer-export";
import { brandOf, type FieldAsset } from "@/lib/ops/field-assets";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";

/** A machine not serviced in this many days is flagged. */
export const OVERDUE_DAYS = 365;

export type VisitKind = "pm" | "service" | "tlc";
export const VISIT_LABEL: Record<VisitKind, string> = { pm: "PM", service: "Service", tlc: "TLC" };

/** One completed visit: a PM or a ticket, with the day it was done. */
export type Visit = {
  kind: VisitKind;
  id: number;
  customer: string;
  /** YYYY-MM-DD. */
  date: string;
  /** What the ticket says the machine is (equipment), for the model match. */
  equipment: string;
  /** Every text the serial may be written in (equipment, work done, the serial note). */
  serialText: string;
  /** A PM stacked on a ticket: the same trip, so the load counts the ticket only. */
  stacked?: boolean;
};

/** A PM tied to one machine by the runbook, a unit link or a logged part. */
export type PmUnitTie = { pmId: number; unitId: number };

export type HowMatched = "pm unit" | "serial" | "model" | "all";
export const HOW_LABEL: Record<HowMatched, string> = { "pm unit": "PM logged on the unit", serial: "Serial on the ticket", model: "Model on the ticket", all: "Ticket for all equipment" };

export type MachineService = {
  /** The newest visit's day, or null when no visit ties to the machine. */
  last: string | null;
  lastKind: VisitKind | null;
  lastId: number | null;
  how: HowMatched | null;
  /** Visits tied to the machine in the year to today. */
  lastYear: number;
};

export type ServiceFlag = "ok" | "overdue" | "never" | "new" | "unknown";
export const FLAG_LABEL: Record<ServiceFlag, string> = {
  ok: "Serviced this year",
  overdue: "Not serviced in over a year",
  never: "No service on record, installed over a year ago",
  new: "Installed this year, no service yet",
  unknown: "No service and no install date on record",
};
/** The flags the "not serviced after a year" list shows. A machine installed this year isn't due yet. */
export const FLAGGED: readonly ServiceFlag[] = ["overdue", "never", "unknown"];

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `from` to `to` (both YYYY-MM-DD); NaN when either isn't a day. */
export function daysBetween(from: string, to: string): number {
  if (!DAY.test(from) || !DAY.test(to)) return Number.NaN;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The account a machine or ticket is at: letters and digits only, so "Joe's Diner" and "Joes Diner" are one. */
const accountKey = (s: string | null | undefined) => normalizeCustomerKey(s);
const MIN_SERIAL = 5;
/** A ticket written for every machine at the account. */
const FOR_ALL = /^(all|all equipment|all machines|all units|everything)$/;

const words = (s: string | null | undefined) => String(s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * True when the text writes the serial as its own word, or as neighbouring words joined ("TB3 55821", "TB3-55821").
 * Never inside a longer word or number, so a date, phone or part number can't pass for it. A serial needs 5 letters or
 * digits and at least one digit.
 */
export function writesSerial(text: string | null | undefined, serial: string | null | undefined): boolean {
  const s = serialKey(serial).replace(/[^a-z0-9]/g, "");
  if (s.length < MIN_SERIAL || !/\d/.test(s)) return false;
  const w = words(text);
  for (let i = 0; i < w.length; i++) {
    let joined = "";
    for (let j = i; j < w.length && joined.length < s.length; j++) {
      joined += w[j];
      if (joined === s) return true;
    }
  }
  return false;
}

/**
 * The ways a ticket may write a model, compacted: the whole name, and the name without its brand when what is left has
 * a number in it ("TB3") or is two words or more ("ITCB DV", "Linea PB").
 */
export function modelForms(name: string): string[] {
  const m = compactEquip(name);
  if (!m) return [];
  const b = compactEquip(brandOf(name));
  const rest = b && m.startsWith(`${b} `) ? m.slice(b.length + 1) : "";
  const restOk = rest.length >= 3 && (/\d/.test(rest) || (rest.includes(" ") && rest.length >= 6));
  return restOk ? [m, rest] : [m];
}

/** True when the ticket names the model, by any of its forms, as whole words. */
export function namesModel(text: string, model: string): boolean {
  const t = ` ${compactEquip(text)} `;
  return modelForms(model).some((f) => t.includes(` ${f} `));
}

/**
 * How many times the ticket names each model group at the account. The longest names are read first and taken out, so
 * "Bunn TB3 DV" isn't also read as "Bunn TB3". A form two groups share names neither.
 */
function mentionsByGroup(text: string, groups: ReadonlyMap<string, readonly FieldAsset[]>): Map<string, number> {
  const owners = new Map<string, Set<string>>();
  for (const [key, ms] of groups) {
    for (const m of ms) for (const name of [m.catalogModel, m.equipmentName]) for (const f of modelForms(name)) owners.set(f, (owners.get(f) ?? new Set()).add(key));
  }
  let t = ` ${compactEquip(text)} `;
  const out = new Map<string, number>();
  for (const f of [...owners.keys()].sort((a, b) => b.length - a.length)) {
    const needle = ` ${f} `;
    let n = 0;
    while (t.includes(needle)) {
      t = t.replace(needle, " | ");
      n += 1;
    }
    const keys = owners.get(f)!;
    if (n && keys.size === 1) {
      const k = [...keys][0]!;
      out.set(k, (out.get(k) ?? 0) + n);
    }
  }
  return out;
}

/**
 * Each machine's service: the newest visit tied to it and how many in the year to `today`. `ties` are the PMs logged
 * on a machine. Every visit is also read for serials, then for "All", then for models, so a PM that logged one unit
 * still dates the other machines it names. A model the account has two of is dated only when the ticket names it as
 * many times. A ticket tied by its model or "All" doesn't date a machine installed after it. A visit counts once per
 * machine.
 */
export function serviceByMachine(
  machines: readonly FieldAsset[],
  visits: readonly Visit[],
  ties: readonly PmUnitTie[],
  today: string,
): Map<number, MachineService> {
  const out = new Map<number, MachineService>();
  for (const m of machines) out.set(m.id, { last: null, lastKind: null, lastId: null, how: null, lastYear: 0 });
  const byAccount = new Map<string, FieldAsset[]>();
  for (const m of machines) {
    const k = accountKey(m.customer);
    if (k) byAccount.set(k, [...(byAccount.get(k) ?? []), m]);
  }
  const pmById = new Map(visits.filter((v) => v.kind === "pm").map((v) => [v.id, v]));
  // One visit counts once per machine, however many ways it ties.
  const seen = new Set<string>();
  const credit = (m: FieldAsset | undefined, v: Visit, how: HowMatched) => {
    const s = m && out.get(m.id);
    if (!m || !s || !DAY.test(v.date) || seen.has(`${m.id}:${v.kind}:${v.id}`)) return;
    // A ticket that only names a model can't be for a machine installed after it.
    if ((how === "model" || how === "all") && m.installDate && DAY.test(m.installDate) && v.date < m.installDate) return;
    seen.add(`${m.id}:${v.kind}:${v.id}`);
    const age = daysBetween(v.date, today);
    if (age >= 0 && age <= OVERDUE_DAYS) s.lastYear += 1;
    if (age < 0) return; // A visit dated after today doesn't date the last service.
    if (!s.last || v.date > s.last) Object.assign(s, { last: v.date, lastKind: v.kind, lastId: v.id, how });
  };
  const byId = new Map(machines.map((m) => [m.id, m]));
  for (const t of ties) {
    const v = pmById.get(t.pmId);
    if (v) credit(byId.get(t.unitId), v, "pm unit");
  }
  for (const v of visits) {
    const key = accountKey(v.customer);
    const here = key ? (byAccount.get(key) ?? []) : [];
    if (!here.length) continue;
    for (const m of here) if (writesSerial(v.serialText, m.serial)) credit(m, v, "serial");
    if (FOR_ALL.test(compactEquip(v.equipment))) {
      for (const m of here) credit(m, v, "all");
      continue;
    }
    const groups = new Map<string, FieldAsset[]>();
    for (const m of here) {
      const k = compactEquip(m.catalogModel);
      if (k) groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    for (const [k, n] of mentionsByGroup(v.equipment, groups)) {
      const group = groups.get(k)!;
      if (n >= group.length) for (const m of group) credit(m, v, "model");
    }
  }
  return out;
}

/** Where a machine stands: serviced this year, overdue, never on record, new, or unknown. */
export function serviceFlag(s: Pick<MachineService, "last">, installDate: string | null, today: string): ServiceFlag {
  if (s.last) return daysBetween(s.last, today) > OVERDUE_DAYS ? "overdue" : "ok";
  if (!installDate || !DAY.test(installDate)) return "unknown";
  return daysBetween(installDate, today) > OVERDUE_DAYS ? "never" : "new";
}

/** The ownership a value means, so "Loaned", "Loaner" and "loan" count together. */
export type OwnershipGroup = "Loaned" | "Leased" | "Owned" | "Other" | "Not set";
export const OWNERSHIP_GROUPS: readonly OwnershipGroup[] = ["Loaned", "Leased", "Owned", "Other", "Not set"];
export function ownershipGroup(raw: string | null | undefined): OwnershipGroup {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "Not set";
  if (/\bloan/.test(v)) return "Loaned";
  if (/\bleas/.test(v)) return "Leased";
  if (/\b(own|purchas|bought|sold)/.test(v)) return "Owned";
  return "Other";
}

export type AccountOwnership = { customer: string; customerId: number | null; total: number } & Record<OwnershipGroup, number>;

/** Each account's machines by ownership, most machines first. */
export function ownershipByAccount(machines: readonly FieldAsset[]): AccountOwnership[] {
  const m = new Map<string, AccountOwnership>();
  for (const r of machines) {
    const k = accountKey(r.customer);
    const cur = m.get(k) ?? { customer: r.customer.trim(), customerId: r.customerId, total: 0, Loaned: 0, Leased: 0, Owned: 0, Other: 0, "Not set": 0 };
    cur.total += 1;
    cur[ownershipGroup(r.ownership)] += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.customer.localeCompare(b.customer));
}

export type AccountLoad = { customer: string; customerId: number | null; machines: number; pm: number; service: number; tlc: number; total: number };

/**
 * The service load by account: completed visits in the year to `today`, every visit at the account whether or not it
 * names a machine, with the machines the account has. A PM stacked on a ticket is the same trip and isn't counted again. Busiest first. Accounts with no machine on the list are left out.
 */
export function loadByAccount(machines: readonly FieldAsset[], visits: readonly Visit[], today: string): AccountLoad[] {
  const m = new Map<string, AccountLoad>();
  for (const r of machines) {
    const k = accountKey(r.customer);
    const cur = m.get(k) ?? { customer: r.customer.trim(), customerId: r.customerId, machines: 0, pm: 0, service: 0, tlc: 0, total: 0 };
    cur.machines += 1;
    m.set(k, cur);
  }
  for (const v of visits) {
    const cur = m.get(accountKey(v.customer));
    const age = daysBetween(v.date, today);
    if (!cur || v.stacked || !(age >= 0 && age <= OVERDUE_DAYS)) continue;
    cur[v.kind] += 1;
    cur.total += 1;
  }
  return [...m.values()].filter((a) => a.total > 0).sort((a, b) => b.total - a.total || a.customer.localeCompare(b.customer));
}

export type ModelLoad = { model: string; machines: number; visits: number; perMachine: number };

/** The service load by model: visits tied to its machines in the year, and per machine. Most visits per machine first. */
export function loadByModel(machines: readonly FieldAsset[], service: ReadonlyMap<number, MachineService>): ModelLoad[] {
  const m = new Map<string, ModelLoad>();
  for (const r of machines) {
    const k = r.catalogModel.trim().toLowerCase();
    if (!k) continue;
    const cur = m.get(k) ?? { model: r.catalogModel.trim(), machines: 0, visits: 0, perMachine: 0 };
    cur.machines += 1;
    cur.visits += service.get(r.id)?.lastYear ?? 0;
    m.set(k, cur);
  }
  return [...m.values()]
    .filter((x) => x.visits > 0)
    .map((x) => ({ ...x, perMachine: Math.round((x.visits / x.machines) * 100) / 100 }))
    .sort((a, b) => b.perMachine - a.perMachine || b.visits - a.visits || a.model.localeCompare(b.model));
}

/** One machine on the "not serviced after a year" list. */
export type FlaggedMachine = FieldAsset & MachineService & { flag: ServiceFlag; daysSince: number | null };

/** The machines not serviced in over a year (or with nothing on record), longest without service first. */
export function flaggedMachines(machines: readonly FieldAsset[], service: ReadonlyMap<number, MachineService>, today: string): FlaggedMachine[] {
  const out: FlaggedMachine[] = [];
  for (const r of machines) {
    const s = service.get(r.id) ?? { last: null, lastKind: null, lastId: null, how: null, lastYear: 0 };
    const flag = serviceFlag(s, r.installDate, today);
    if (!FLAGGED.includes(flag)) continue;
    const since = s.last ?? (r.installDate && DAY.test(r.installDate) ? r.installDate : null);
    out.push({ ...r, ...s, flag, daysSince: since ? daysBetween(since, today) : null });
  }
  // Nothing on record at all first, then the longest since a service or install.
  return out.sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity) || a.customer.localeCompare(b.customer) || a.id - b.id);
}

/** Counts across the fleet: each flag, for the tiles. */
export function flagCounts(machines: readonly FieldAsset[], service: ReadonlyMap<number, MachineService>, today: string): Record<ServiceFlag, number> {
  const out: Record<ServiceFlag, number> = { ok: 0, overdue: 0, never: 0, new: 0, unknown: 0 };
  for (const r of machines) out[serviceFlag(service.get(r.id) ?? { last: null }, r.installDate, today)] += 1;
  return out;
}

const FLAGGED_HEADERS = ["Account", "Brand", "Catalog Model", "Serial", "Ownership", "Install Date", "Last Service", "Last Visit", "Matched By", "Days Since", "Flag"];

/** The flagged list as CSV, cells as the Customers export writes them. */
export function flaggedCsv(rows: readonly FlaggedMachine[]): string {
  const lines = [FLAGGED_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.customer,
        r.brand,
        r.catalogModel,
        r.serial,
        r.ownership,
        r.installDate,
        r.last,
        r.lastKind ? `${VISIT_LABEL[r.lastKind]} #${r.lastId}` : null,
        r.how ? HOW_LABEL[r.how] : null,
        r.daysSince == null ? null : String(r.daysSince),
        FLAG_LABEL[r.flag],
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** What Assets → Analytics shows, worked out on the server so the page gets the counts, not every ticket. */
export type EquipmentAnalytics = {
  today: string;
  machines: number;
  accounts: number;
  flags: Record<ServiceFlag, number>;
  byBrand: [string, number][];
  byModel: [string, number][];
  byCondition: [string, number][];
  byOwnership: [OwnershipGroup, number][];
  ownership: AccountOwnership[];
  accountLoad: AccountLoad[];
  modelLoad: ModelLoad[];
  /** Visits in the year to today, every one at an account with machines. */
  visitsLastYear: Record<VisitKind, number>;
  flagged: FlaggedMachine[];
};

/** Each value and its count, most first, capitals folded as the In the Field counts do. */
function tally(values: readonly (string | null | undefined)[]): [string, number][] {
  const m = new Map<string, [string, number]>();
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    const cur = m.get(v.toLowerCase());
    m.set(v.toLowerCase(), [cur?.[0] ?? v, (cur?.[1] ?? 0) + 1]);
  }
  return [...m.values()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function buildEquipmentAnalytics(machines: readonly FieldAsset[], visits: readonly Visit[], ties: readonly PmUnitTie[], today: string): EquipmentAnalytics {
  const service = serviceByMachine(machines, visits, ties, today);
  const accountLoad = loadByAccount(machines, visits, today);
  const visitsLastYear: Record<VisitKind, number> = { pm: 0, service: 0, tlc: 0 };
  for (const a of accountLoad) for (const k of ["pm", "service", "tlc"] as const) visitsLastYear[k] += a[k];
  const own = new Map<OwnershipGroup, number>();
  for (const r of machines) own.set(ownershipGroup(r.ownership), (own.get(ownershipGroup(r.ownership)) ?? 0) + 1);
  return {
    today,
    machines: machines.length,
    accounts: new Set(machines.map((r) => accountKey(r.customer))).size,
    flags: flagCounts(machines, service, today),
    byBrand: tally(machines.map((r) => r.brand)),
    byModel: tally(machines.map((r) => r.catalogModel)),
    byCondition: tally(machines.map((r) => r.condition)),
    byOwnership: OWNERSHIP_GROUPS.filter((g) => own.get(g)).map((g) => [g, own.get(g)!] as [OwnershipGroup, number]),
    ownership: ownershipByAccount(machines),
    accountLoad,
    modelLoad: loadByModel(machines, service),
    visitsLastYear,
    flagged: flaggedMachines(machines, service, today),
  };
}
