/**
 * Duplicate serial numbers across the desk: account units, install equipment lists, warehouse records and modules.
 * Pure: the export loads the rows and hands them here, so tests run without a database.
 *
 * Two serials are the same when they read the same after trimming, spaces and "#" (serialKey, the key the desk matches
 * by). "Near matches" are serials that differ only by dashes, dots, an "SN" prefix or leading zeros: they may be one
 * machine written two ways.
 */
import { parseSerial, serialKey } from "./account-equip.ts";
import { normalizeCustomerKey } from "./customer-key.ts";

export type DupUnit = {
  id: number;
  customer: string;
  name: string;
  serial: string | null;
  installDate: string | null;
  locked: boolean;
};
export type DupInstall = {
  id: number;
  customer: string;
  installed: boolean;
  rows: { equipment: string; serial: string }[];
};
export type DupAsset = {
  id: number;
  model: string;
  serial: string | null;
  status: string;
  site: string | null;
  soldTo: string | null;
};
export type DupModule = {
  id: number;
  moduleId: string;
  platform: string | null;
  type: string | null;
  status: string | null;
  customer: string | null;
};
export type DupSheet = { name: string; columns: string[]; rows: string[][] };

/** The desk's matching key for a serial, or "" when it is blank, "N/A" and the like, or under 3 characters. */
export function dupKey(raw: string | null | undefined): string {
  const key = serialKey(parseSerial(raw));
  return key.length >= 3 ? key : "";
}

/** Letters and digits only, without an "SN" prefix or leading zeros: "SN: 0ITCB-064919" and "itcb064919" match. */
export function looseKey(raw: string | null | undefined): string {
  const s = String(parseSerial(raw) ?? "")
    .toUpperCase()
    .replace(/^(S\/?N|SERIAL(\s*(NO|NUMBER|#))?)\s*[:#.]?\s*/, "")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+/, "");
  return s.length >= 3 ? s : "";
}

const sameAccount = (names: string[]) =>
  new Set(names.map((n) => normalizeCustomerKey(n))).size <= 1;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function groupBy<T>(items: T[], key: (t: T) => string): T[][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return [...map.values()].filter((g) => g.length > 1);
}

export function findDuplicateSerials(
  input: { units: DupUnit[]; installs: DupInstall[]; assets: DupAsset[]; modules: DupModule[] },
  opts?: { customer?: string | null },
): DupSheet[] {
  const needle = normalizeCustomerKey(opts?.customer);
  const keep = (accounts: (string | null)[]) =>
    !needle || accounts.some((a) => normalizeCustomerKey(a).includes(needle));

  // Account units: one serial on two or more units.
  const unitRows: string[][] = [];
  for (const group of groupBy(input.units, (u) => dupKey(u.serial))) {
    if (!keep(group.map((u) => u.customer))) continue;
    const accounts = new Set(group.map((u) => normalizeCustomerKey(u.customer))).size;
    const todo = sameAccount(group.map((u) => u.customer))
      ? "Same machine listed twice on this account: Merge it on the account's Equipment tab."
      : `On ${plural(accounts, "account")}: keep it on the account that has the machine and fix the others.`;
    for (const u of group)
      unitRows.push([
        u.serial ?? "",
        u.customer,
        u.name,
        String(u.id),
        u.installDate ?? "",
        u.locked ? "Yes" : "",
        todo,
      ]);
  }

  // Install equipment lists: one serial on two or more rows (open and installed projects).
  type InstallRow = { install: DupInstall; equipment: string; serial: string };
  const installRows = input.installs.flatMap((i) =>
    i.rows.map((r) => ({ install: i, equipment: r.equipment, serial: r.serial })),
  );
  const listRows: string[][] = [];
  for (const group of groupBy<InstallRow>(installRows, (r) => dupKey(r.serial))) {
    if (!keep(group.map((r) => r.install.customer))) continue;
    const installs = new Set(group.map((r) => r.install.id)).size;
    const todo =
      installs === 1
        ? "Listed twice on this install: remove or fix one row."
        : sameAccount(group.map((r) => r.install.customer))
          ? `On ${plural(installs, "install")} for this account: check it isn't one project split in two.`
          : `On installs for ${plural(new Set(group.map((r) => normalizeCustomerKey(r.install.customer))).size, "account")}: one of them has the wrong serial.`;
    for (const r of group)
      listRows.push([
        r.serial,
        `#${r.install.id}`,
        r.install.customer,
        r.equipment,
        r.install.installed ? "Installed" : "Open",
        todo,
      ]);
  }

  // Warehouse: one serial on two or more records.
  const assetRows: string[][] = [];
  for (const group of groupBy(input.assets, (a) => dupKey(a.serial))) {
    if (!keep(group.map((a) => a.soldTo))) continue;
    const todo = `One serial, ${group.length} warehouse records: keep one and fix or remove the others.`;
    for (const a of group)
      assetRows.push([
        a.serial ?? "",
        String(a.id),
        a.model,
        a.status,
        a.site ?? "",
        a.soldTo ?? "",
        todo,
      ]);
  }

  // Warehouse vs accounts: the barn and an account both claim the machine, or they name different accounts.
  const unitsByKey = new Map<string, DupUnit[]>();
  for (const u of input.units) {
    const k = dupKey(u.serial);
    if (k) unitsByKey.set(k, [...(unitsByKey.get(k) ?? []), u]);
  }
  const crossRows: string[][] = [];
  for (const a of input.assets) {
    const units = unitsByKey.get(dupKey(a.serial)) ?? [];
    for (const u of units) {
      if (!keep([u.customer, a.soldTo])) continue;
      let todo: string | null = null;
      if (a.status === "ready")
        todo = `Ready in the barn and on ${u.customer}'s equipment: take it off the account if it's back, or fix the warehouse record if it's at the account.`;
      else if (
        a.soldTo?.trim() &&
        normalizeCustomerKey(a.soldTo) !== normalizeCustomerKey(u.customer)
      )
        todo = `The warehouse says ${a.soldTo}; the account list says ${u.customer}. Fix whichever is wrong.`;
      if (todo)
        crossRows.push([
          a.serial ?? "",
          u.customer,
          u.name,
          a.model,
          a.status,
          a.site ?? "",
          a.soldTo ?? "",
          todo,
        ]);
    }
  }

  // Modules: one module ID on two or more records.
  const moduleRows: string[][] = [];
  for (const group of groupBy(input.modules, (m) => dupKey(m.moduleId))) {
    if (!keep(group.map((m) => m.customer))) continue;
    const todo = `One module ID, ${group.length} module records: keep one.`;
    for (const m of group)
      moduleRows.push([
        m.moduleId,
        m.platform ?? "",
        m.type ?? "",
        m.status ?? "",
        m.customer ?? "",
        todo,
      ]);
  }

  // Near matches: different keys that read the same apart from dashes, dots, an SN prefix or leading zeros.
  type Seen = { serial: string; where: string; account: string; equipment: string };
  const seen: Seen[] = [
    ...input.units.map((u) => ({
      serial: u.serial ?? "",
      where: `Account unit ${u.id}`,
      account: u.customer,
      equipment: u.name,
    })),
    ...installRows.map((r) => ({
      serial: r.serial,
      where: `Install #${r.install.id}`,
      account: r.install.customer,
      equipment: r.equipment,
    })),
    ...input.assets.map((a) => ({
      serial: a.serial ?? "",
      where: `Warehouse ${a.id}`,
      account: a.soldTo ?? "",
      equipment: a.model,
    })),
  ];
  const nearRows: string[][] = [];
  for (const group of groupBy(seen, (s) => (dupKey(s.serial) ? looseKey(s.serial) : ""))) {
    if (new Set(group.map((s) => dupKey(s.serial))).size < 2) continue;
    if (!keep(group.map((s) => s.account))) continue;
    for (const s of group)
      nearRows.push([
        s.serial,
        s.where,
        s.account,
        s.equipment,
        "Reads as the same serial apart from spaces, dashes or zeros: check whether it's one machine.",
      ]);
  }

  return [
    {
      name: "Account units",
      columns: [
        "Serial",
        "Account",
        "Equipment",
        "Unit ID",
        "Install date",
        "Locked",
        "What to do",
      ],
      rows: unitRows,
    },
    {
      name: "Install lists",
      columns: ["Serial", "Install", "Account", "Equipment", "Install status", "What to do"],
      rows: listRows,
    },
    {
      name: "Warehouse",
      columns: ["Serial", "Warehouse ID", "Model", "Status", "Site", "Sold to", "What to do"],
      rows: assetRows,
    },
    {
      name: "Warehouse vs accounts",
      columns: [
        "Serial",
        "Account",
        "Account equipment",
        "Warehouse model",
        "Warehouse status",
        "Site",
        "Sold to",
        "What to do",
      ],
      rows: crossRows,
    },
    {
      name: "Modules",
      columns: ["Module ID", "Platform", "Type", "Status", "Account", "What to do"],
      rows: moduleRows,
    },
    {
      name: "Near matches",
      columns: ["Serial as written", "Where", "Account", "Equipment", "What to do"],
      rows: nearRows,
    },
  ];
}
