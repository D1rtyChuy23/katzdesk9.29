/**
 * PM runbook readiness — for each PM line the runbook recognises, what is missing before it works fully:
 * an account unit to attach to, a serial (so options and history follow the unit), an install date (so the
 * interval can be recommended). Pure: callers pass the PMs and each customer's account units.
 */
import { normalizeCustomerKey } from "./account-equip.ts";
import { planUnits, type AccountUnitRow } from "./pm-runbook-units.ts";

export type ReadinessPm = { id: number; customer: string; equipment: string | null; status: string };
export type ReadinessAccountUnit = AccountUnitRow & { customer: string };

export type ReadinessGap = "no-account-unit" | "no-serial" | "no-install-date";

export type ReadinessRow = {
  pmId: number;
  customer: string;
  status: string;
  piece: string;
  runbookId: string;
  accountId: number | null;
  serial: string | null;
  installDate: string | null;
  gaps: ReadinessGap[];
};

export const GAP_LABEL: Record<ReadinessGap, string> = {
  "no-account-unit": "No account unit",
  "no-serial": "No serial",
  "no-install-date": "No install date",
};

export function buildReadiness(
  pms: ReadinessPm[],
  units: ReadinessAccountUnit[],
  match: (piece: string) => { runbookId: string; model: string | null } | null,
  bySerial?: (serial: string) => { runbookId: string; model: string | null } | null,
): ReadinessRow[] {
  const byCustomer = new Map<string, AccountUnitRow[]>();
  for (const u of units) {
    const k = normalizeCustomerKey(u.customer);
    const list = byCustomer.get(k) ?? [];
    list.push(u);
    byCustomer.set(k, list);
  }
  const out: ReadinessRow[] = [];
  for (const pm of pms) {
    const rows = byCustomer.get(normalizeCustomerKey(pm.customer)) ?? [];
    for (const u of planUnits(pm.equipment, rows, match, bySerial)) {
      const gaps: ReadinessGap[] = [];
      if (u.accountId == null) gaps.push("no-account-unit");
      else {
        if (!u.serialKey) gaps.push("no-serial");
        if (!u.installDate) gaps.push("no-install-date");
      }
      out.push({
        pmId: pm.id,
        customer: pm.customer,
        status: pm.status,
        piece: u.piece,
        runbookId: u.runbookId,
        accountId: u.accountId,
        serial: u.serial,
        installDate: u.installDate,
        gaps,
      });
    }
  }
  return out;
}

export function readinessSummary(rows: ReadinessRow[]) {
  const count = (g: ReadinessGap) => rows.filter((r) => r.gaps.includes(g)).length;
  return {
    units: rows.length,
    ready: rows.filter((r) => !r.gaps.length).length,
    noAccountUnit: count("no-account-unit"),
    noSerial: count("no-serial"),
    noInstallDate: count("no-install-date"),
  };
}

/** CSV the cleanup can work from: one line per PM unit that still has a gap. */
export function readinessCsv(rows: ReadinessRow[]): string {
  const q = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["PM", "Customer", "Status", "Equipment line", "Missing"].map(q).join(",");
  const lines = rows
    .filter((r) => r.gaps.length)
    .map((r) => [r.pmId, r.customer, r.status, r.piece, r.gaps.map((g) => GAP_LABEL[g]).join("; ")].map(q).join(","));
  return [head, ...lines].join("\n");
}
