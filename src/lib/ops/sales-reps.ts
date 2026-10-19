/**
 * NetSuite sales reps on a customer account. The one Primary Sales Rep stays in the existing account_rep column.
 * Pure helpers shared by the import preview and the save.
 */
import { accountNumberKey } from "./account-numbers.ts";
import { canonicalRepName, sameRep } from "./rep-match.ts";
import { normalizeName } from "./norm.ts";

export type SalesRepSlot = {
  name: string;
  role: string;
  pct: number | null;
  primary: boolean;
};

/** One customer in the file, after rows that name the same account are joined. */
export type SalesRepFile = {
  line: number;
  internalId: string;
  accountNumber: string;
  name: string;
  /** The Primary Sales Rep column. Blank when the file doesn't name one. */
  primary: string;
  reps: SalesRepSlot[];
};

export type SalesRepAccount = {
  id: number;
  name: string;
  netsuiteId?: string | null;
  accountNumber?: string | null;
  accountRep?: string | null;
};

/** A person already on Katz Desk: a sales rep, or a desk user. Never invented by the import. */
export type KnownPerson = { name: string; userId?: string | null };

export type SavedSalesRep = {
  name: string;
  role: string | null;
  pct: number | null;
  primary: boolean;
};

export type PlannedRep = SalesRepSlot & { known: boolean; userId: string | null; storedName: string };

export type SalesRepStatus = "update" | "same" | "unmatched" | "unknown";

export type SalesRepPlanLine = {
  line: number;
  name: string;
  accountNumber: string;
  internalId: string;
  status: SalesRepStatus;
  /** Matched, and the primary or the assigned list would change. Unknown reps are still saved as names. */
  willSave: boolean;
  accountId: number | null;
  accountName: string | null;
  matchedBy: "internal ID" | "account number" | "name" | null;
  currentPrimary: string | null;
  nextPrimary: string | null;
  primaryChange: boolean;
  reps: PlannedRep[];
  unknownReps: string[];
  reason: string;
};

export type SalesRepCounts = { update: number; same: number; unmatched: number; unknown: number };

const cell = (r: unknown[], i: number) => (i < 0 ? "" : String(r[i] ?? "").replace(/\s+/g, " ").trim());

function pctOf(raw: string): number | null {
  const s = raw.replace(/%/g, "").replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function flagOn(raw: string): boolean {
  return /^(y|yes|true|1|primary)$/i.test(raw.trim());
}

function headerAt(matrix: unknown[][]): number {
  return matrix.findIndex((r) => {
    const head = r.map((c) => String(c ?? "").trim().toLowerCase());
    const hasWho = head.some((h) => /^(internal id|account number|account #|account_number|customer name|customer|name)$/.test(h));
    const hasRep = head.some((h) => /primary sales rep/.test(h) || /^(sales rep|rep name|rep)(\s*\d+)?$/.test(h));
    return hasWho && hasRep;
  });
}

/** A contribution column for rep slot `n` ("" is the unnumbered column). */
function slotCol(head: string[], label: string, n: string): number {
  const re = new RegExp(`^${label}\\s*${n}$`, "i");
  return head.findIndex((h) => re.test(h));
}

/**
 * CSV or sheet. One row per rep (Sales Rep, Role, %, Primary) or several reps across the row
 * (Sales Rep 1, Role 1, …). Rows that name the same account are one customer.
 */
export function salesRepFilesFromMatrix(matrix: unknown[][]): SalesRepFile[] {
  const at = headerAt(matrix);
  if (at < 0) {
    throw new Error("The file needs a header row with Internal ID, Account Number, or Customer Name, and a sales rep column.");
  }
  const head = matrix[at]!.map((c) => String(c ?? "").trim().toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const idCol = col(/^internal id$/);
  const acctCol = col(/^(account number|account #|account_number|account)$/);
  const nameCol = col(/^(customer name|customer|name|company name)$/);
  const primaryCol = col(/^primary sales rep$/);
  if (nameCol < 0 && acctCol < 0 && idCol < 0) {
    throw new Error("The file needs Internal ID, Account Number, or Customer Name.");
  }
  const slots: { name: number; role: number; pct: number; primary: number }[] = [];
  head.forEach((h, i) => {
    const m = /^(?:sales rep|rep name|rep)(?:\s*(\d+))?$/.exec(h);
    if (!m || /primary/.test(h)) return;
    const n = m[1] ? `\\s*${m[1]}` : "";
    slots.push({
      name: i,
      role: slotCol(head, "role", n),
      pct: head.findIndex((x) => new RegExp(`^(?:contribution\\s*%?|contribution percent|percent|%)${n}$`, "i").test(x)),
      primary: head.findIndex((x) => new RegExp(`^(?:primary|is primary|primary flag)${n}$`, "i").test(x)),
    });
  });
  if (!slots.length && primaryCol < 0) throw new Error("The file needs a Primary Sales Rep or Sales Rep column.");

  const groups = new Map<string, SalesRepFile>();
  matrix.slice(at + 1).forEach((r, i) => {
    const internalId = cell(r, idCol);
    const accountNumber = cell(r, acctCol);
    const name = cell(r, nameCol);
    const primary = cell(r, primaryCol);
    if (!internalId && !accountNumber && !name && !primary) return;
    const key = internalId || accountNumberKey(accountNumber) || name.toLowerCase();
    if (!key) return;
    let file = groups.get(key);
    if (!file) {
      file = { line: at + i + 2, internalId, accountNumber, name, primary, reps: [] };
      groups.set(key, file);
    } else {
      if (!file.internalId && internalId) file.internalId = internalId;
      if (!file.accountNumber && accountNumber) file.accountNumber = accountNumber;
      if (!file.name && name) file.name = name;
      if (!file.primary && primary) file.primary = primary;
    }
    const seen = new Set(file.reps.map((rep) => `${normalizeName(rep.name)}|${normalizeName(rep.role)}|${rep.pct ?? ""}|${rep.primary}`));
    const add = (rep: SalesRepSlot) => {
      if (!rep.name) return;
      const sig = `${normalizeName(rep.name)}|${normalizeName(rep.role)}|${rep.pct ?? ""}|${rep.primary}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      file!.reps.push(rep);
    };
    if (slots.length) {
      for (const slot of slots) {
        add({
          name: cell(r, slot.name),
          role: cell(r, slot.role),
          pct: pctOf(cell(r, slot.pct)),
          primary: flagOn(cell(r, slot.primary)),
        });
      }
    } else if (primary) {
      add({ name: primary, role: "", pct: null, primary: true });
    }
  });

  for (const file of groups.values()) {
    if (!file.reps.length && file.primary) {
      file.reps.push({ name: file.primary, role: "", pct: null, primary: true });
    }
    if (file.primary && !file.reps.some((r) => r.primary)) {
      const hit = file.reps.find((r) => sameRep(r.name, file.primary) || normalizeName(r.name) === normalizeName(file.primary));
      if (hit) hit.primary = true;
    }
  }
  return [...groups.values()];
}

function personName(raw: string, known: KnownPerson[]): { known: boolean; storedName: string; userId: string | null } {
  const canon = canonicalRepName(raw);
  const n = normalizeName(canon ?? raw);
  const hit = known.find((k) => normalizeName(k.name) === n || (!!canon && normalizeName(k.name) === normalizeName(canon)));
  if (canon) return { known: true, storedName: canon, userId: hit?.userId ?? null };
  if (hit) return { known: true, storedName: hit.name, userId: hit.userId ?? null };
  return { known: false, storedName: raw.trim(), userId: null };
}

function listSig(reps: { name: string; role: string | null; pct: number | null; primary: boolean }[]): string {
  return reps
    .map((r) => `${normalizeName(r.name)}|${normalizeName(r.role)}|${r.pct ?? ""}|${r.primary ? "1" : "0"}`)
    .sort()
    .join("\n");
}

/**
 * Match by Internal ID, then Account Number, then exact name (case and punctuation aside, and only when one account has it).
 * A rep who is not already a Katz Desk sales rep or user is listed and never created.
 * Primary Sales Rep changes only when the file names a known rep and the account's rep is blank or different.
 */
export function planSalesReps(
  files: SalesRepFile[],
  accounts: SalesRepAccount[],
  known: KnownPerson[],
  current: { customerId: number; reps: SavedSalesRep[] }[],
): SalesRepPlanLine[] {
  const byNetsuite = new Map<string, SalesRepAccount[]>();
  const byNumber = new Map<string, SalesRepAccount[]>();
  const byExact = new Map<string, SalesRepAccount[]>();
  for (const a of accounts) {
    const id = (a.netsuiteId ?? "").trim();
    if (id) {
      const list = byNetsuite.get(id) ?? [];
      list.push(a);
      byNetsuite.set(id, list);
    }
    const num = accountNumberKey(a.accountNumber);
    if (num) {
      const list = byNumber.get(num) ?? [];
      list.push(a);
      byNumber.set(num, list);
    }
    const name = a.name.trim().toLowerCase();
    if (name) {
      const list = byExact.get(name) ?? [];
      list.push(a);
      byExact.set(name, list);
    }
  }
  const saved = new Map(current.map((c) => [c.customerId, c.reps]));

  return files.map((file) => {
    let account: SalesRepAccount | null = null;
    let matchedBy: SalesRepPlanLine["matchedBy"] = null;
    const idHits = file.internalId ? byNetsuite.get(file.internalId.trim()) ?? [] : [];
    const numHits = file.accountNumber ? byNumber.get(accountNumberKey(file.accountNumber)) ?? [] : [];
    const nameKey = file.name.trim().toLowerCase();
    const nameHits = nameKey ? byExact.get(nameKey) ?? [] : [];
    let blocked: string | null = null;
    if (file.internalId.trim()) {
      if (idHits.length === 1) {
        account = idHits[0]!;
        matchedBy = "internal ID";
      } else if (idHits.length > 1) {
        blocked = "More than one Katz Desk account has this Internal ID. Nothing is saved.";
      }
    }
    if (!account && !blocked && file.accountNumber) {
      if (numHits.length === 1) {
        account = numHits[0]!;
        matchedBy = "account number";
      } else if (numHits.length > 1) {
        blocked = "More than one Katz Desk account has this account number. Nothing is saved.";
      }
    }
    if (!account && !blocked && nameKey) {
      if (nameHits.length === 1) {
        account = nameHits[0]!;
        matchedBy = "name";
      }
    }

    const reps: PlannedRep[] = file.reps.map((r) => {
      const who = personName(r.name, known);
      return { ...r, name: r.name.trim(), known: who.known, storedName: who.storedName, userId: who.userId };
    });
    const unknownReps = [...new Set(reps.filter((r) => !r.known).map((r) => r.storedName))];
    const base = {
      line: file.line,
      name: file.name,
      accountNumber: file.accountNumber,
      internalId: file.internalId,
      reps,
      unknownReps,
      accountId: account?.id ?? null,
      accountName: account?.name ?? null,
      matchedBy,
      currentPrimary: account?.accountRep ?? null,
      nextPrimary: null as string | null,
      primaryChange: false,
    };
    if (!account) {
      const crowded = nameHits.length > 1 && !file.internalId.trim() && !file.accountNumber;
      return {
        ...base,
        status: "unmatched" as const,
        willSave: false,
        reason: blocked ?? (crowded ? "More than one Katz Desk account has this name. Nothing is saved." : "No Katz Desk account matches. Nothing is saved."),
      };
    }

    const filePrimary = file.primary.trim();
    const primaryWho = filePrimary ? personName(filePrimary, known) : null;
    const currentPrimary = (account.accountRep ?? "").trim() || null;
    let nextPrimary: string | null = null;
    let primaryChange = false;
    if (primaryWho?.known && !sameRep(currentPrimary, primaryWho.storedName) && normalizeName(currentPrimary) !== normalizeName(primaryWho.storedName)) {
      nextPrimary = primaryWho.storedName;
      primaryChange = true;
    }
    const have = saved.get(account.id) ?? [];
    const listChanged =
      reps.length > 0 &&
      listSig(have.map((r) => ({ name: r.name, role: r.role, pct: r.pct, primary: r.primary }))) !==
        listSig(reps.map((r) => ({ name: r.storedName, role: r.role, pct: r.pct, primary: r.primary })));
    const willSave = primaryChange || listChanged;
    const parts: string[] = [];
    if (primaryChange) parts.push(`Primary Sales Rep: ${currentPrimary || "blank"} → ${nextPrimary}`);
    else if (filePrimary && primaryWho && !primaryWho.known) parts.push(`Primary Sales Rep stays ${currentPrimary || "blank"}. ${filePrimary} is not a Katz Desk user.`);
    if (listChanged) parts.push("Assigned sales reps will be replaced with this file.");
    if (unknownReps.length) parts.push(`Unknown rep: ${unknownReps.join(", ")}. Not a Katz Desk user, so no user is created.`);
    if (!parts.length) parts.push("Already matches this file.");
    const status: SalesRepStatus = unknownReps.length ? "unknown" : willSave ? "update" : "same";
    return { ...base, status, willSave, nextPrimary, primaryChange, currentPrimary, reason: parts.join(" ") };
  });
}

export function countSalesReps(lines: SalesRepPlanLine[]): SalesRepCounts {
  const counts: SalesRepCounts = { update: 0, same: 0, unmatched: 0, unknown: 0 };
  for (const line of lines) counts[line.status] += 1;
  return counts;
}
