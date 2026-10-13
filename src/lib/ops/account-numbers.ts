/**
 * Account Number on a customer: kept as text (leading zeros and dashes stay), unique when filled in.
 * Pure helpers shared by the server and the import preview.
 */
import { normalizeCustomerKey } from "./customer-key.ts";

/** Trim and collapse inside spaces. Blank → null. Nothing else changes: "00123" and "A-01" stay as they are. */
export function cleanAccountNumber(v: unknown): string | null {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s : null;
}

/** Two numbers are the same number when they match ignoring case and outside spaces. */
export const accountNumberKey = (v: unknown) => (cleanAccountNumber(v) ?? "").toLowerCase();

export type ImportAccount = { id: number; name: string; netsuiteId?: string | null; accountNumber?: string | null };
export type ImportRow = { line: number; customer: string; accountNumber: string };

export type ImportPlanLine = {
  line: number;
  customer: string;
  accountNumber: string;
  status: "match" | "same" | "conflict" | "unmatched";
  accountId: number | null;
  accountName: string | null;
  /** The account's number today, when it has one. */
  current: string | null;
  reason: string;
};

/**
 * Preview for the CSV import. Matches a row to an account by exact name (ignoring case), the clean-list ID, then
 * the name ignoring punctuation when only one account has it. Conflicts are never saved: the number is on another
 * account, the number or the account appears twice in the file, or the account already has a different number.
 */
export function planAccountNumbers(rows: ImportRow[], accounts: ImportAccount[]): ImportPlanLine[] {
  const byName = new Map<string, ImportAccount>();
  const byNetsuite = new Map<string, ImportAccount>();
  const byLoose = new Map<string, ImportAccount[]>();
  const byNumber = new Map<string, ImportAccount>();
  for (const a of accounts) {
    byName.set(a.name.trim().toLowerCase(), a);
    if (a.netsuiteId) byNetsuite.set(String(a.netsuiteId).trim(), a);
    const k = normalizeCustomerKey(a.name);
    if (k) byLoose.set(k, [...(byLoose.get(k) ?? []), a]);
    const n = accountNumberKey(a.accountNumber);
    if (n) byNumber.set(n, a);
  }
  const numberCount = new Map<string, number>();
  const accountCount = new Map<number, number>();
  const found = rows.map((r) => {
    const key = r.customer.trim();
    const loose = byLoose.get(normalizeCustomerKey(key)) ?? [];
    const acct = byName.get(key.toLowerCase()) ?? byNetsuite.get(key) ?? (loose.length === 1 ? loose[0] : undefined);
    const num = cleanAccountNumber(r.accountNumber);
    if (num) numberCount.set(accountNumberKey(num), (numberCount.get(accountNumberKey(num)) ?? 0) + 1);
    if (acct) accountCount.set(acct.id, (accountCount.get(acct.id) ?? 0) + 1);
    return { r, acct, num, ambiguous: !acct && loose.length > 1 };
  });
  return found.map(({ r, acct, num, ambiguous }) => {
    const base = { line: r.line, customer: r.customer.trim(), accountNumber: num ?? "", accountId: acct?.id ?? null, accountName: acct?.name ?? null, current: acct ? cleanAccountNumber(acct.accountNumber) : null };
    if (!acct) {
      return { ...base, status: "unmatched" as const, reason: ambiguous ? "More than one account has a name like this; use the exact name or the ID" : "No KatzDesk account with this name or ID" };
    }
    if (!num) return { ...base, status: "conflict" as const, reason: "No account number on this row" };
    const k = accountNumberKey(num);
    if ((numberCount.get(k) ?? 0) > 1) return { ...base, status: "conflict" as const, reason: "This account number is on more than one row in the file" };
    if ((accountCount.get(acct.id) ?? 0) > 1) return { ...base, status: "conflict" as const, reason: "This account is on more than one row in the file" };
    const holder = byNumber.get(k);
    if (holder && holder.id !== acct.id) return { ...base, status: "conflict" as const, reason: `Already the account number of “${holder.name}”` };
    if (base.current && accountNumberKey(base.current) === k) return { ...base, status: "same" as const, reason: "Already set; nothing changes" };
    if (base.current) return { ...base, status: "conflict" as const, reason: `This account already has account number ${base.current}` };
    return { ...base, status: "match" as const, reason: "Will be saved" };
  });
}

/** CSV / sheet cells → rows. Headers: a customer column (name or ID) and an account number column. */
export function importRowsFromMatrix(matrix: unknown[][]): ImportRow[] {
  const headerAt = matrix.findIndex((r) => r.some((c) => /account\s*(number|no\.?|#)|account_number/i.test(String(c ?? ""))));
  if (headerAt < 0) throw new Error("The file needs a header row with a customer column and an account_number column.");
  const head = matrix[headerAt]!.map((c) => String(c ?? "").trim().toLowerCase());
  const numCol = head.findIndex((h) => /account\s*(number|no\.?|#)|account_number/.test(h));
  const custCol = head.findIndex((h, i) => i !== numCol && /customer|account name|name|^id$|internal id|customer id/.test(h));
  if (custCol < 0) throw new Error("The file needs a customer column (customer name or ID).");
  const out: ImportRow[] = [];
  matrix.slice(headerAt + 1).forEach((r, i) => {
    const customer = String(r[custCol] ?? "").trim();
    const accountNumber = String(r[numCol] ?? "").trim();
    if (!customer && !accountNumber) return;
    out.push({ line: headerAt + i + 2, customer, accountNumber });
  });
  return out;
}
