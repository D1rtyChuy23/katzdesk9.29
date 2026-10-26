/**
 * Clean customer list (NetSuite export) against KatzDesk accounts. Pure: no database here.
 *
 * Exact  — same name once case, spacing and punctuation are ignored. Applied and locked right away.
 * Similar — same words with Inc / LLC / Co, the same name under a NetSuite parent ("Eversys Service:X"),
 *           extra words such as a location, words in another order, or a spelling difference. Held for approval.
 * No Match — a KatzDesk account nothing on the list resembles. Held for approval or removal.
 * Walk-In / Cimbali — always held for review, matched or not.
 */
import { normalizeCustomerKey } from "./customer-key.ts";

export type CleanRow = { internalId: string; entityId: string; name: string; address?: string; salesRep?: string };
export type KatzAccount = { id: number; name: string };
export type CleanKind = "exact" | "similar" | "no_match" | "walk_in" | "cimbali";

export type CleanItem = {
  kind: CleanKind;
  accountId: number | null;
  katzName: string | null;
  cleanName: string | null;
  internalId: string | null;
  reason: string;
  /** Ship-to address and sales rep from the list row. Written onto the account only when it is approved. */
  address: string | null;
  salesRep: string | null;
};

/** The name to apply from a row: Customer Name, else Entity ID. */
export function cleanNameOf(row: Pick<CleanRow, "name" | "entityId">): string {
  return tidy(row.name) || tidy(row.entityId);
}

/** Drops invisible characters (zero-width spaces come through NetSuite exports) and doubled spaces. */
export function tidy(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const isWalkInName = (n: string | null | undefined) => /\bwalk\s*-?\s*ins?\b/i.test(n ?? "");
export const isCimbaliName = (n: string | null | undefined) => /cimbali/i.test(n ?? "");

/** "Eversys Service:Black Rifle Coffee" → "Black Rifle Coffee". */
export function leafOf(name: string): string {
  const i = name.lastIndexOf(":");
  return i >= 0 ? name.slice(i + 1).trim() : name.trim();
}
export function parentOf(name: string): string | null {
  const i = name.lastIndexOf(":");
  return i >= 0 ? name.slice(0, i).trim() || null : null;
}

const SUFFIXES = new Set(["inc", "llc", "ltd", "co", "corp", "corporation", "company", "pllc", "lp", "llp", "the", "dba"]);
// Too common to link two names by themselves.
export const COMMON = new Set([
  "and", "of", "at", "the", "coffee", "cafe", "caf", "house", "bar", "grill", "kitchen", "restaurant", "hotel",
  "church", "tx", "houston", "company", "shop", "bakery", "store", "market", "center", "club", "services", "service",
]);

export function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9#]+/g, " ")
    .replace(/#/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
const coreWords = (name: string) => wordsOf(name).filter((w) => !SUFFIXES.has(w));

// Install matching also drops "Group": "Baldi Management Group Inc." is "Baldi Management".
const LOOSE_SUFFIXES = new Set([...SUFFIXES, "group", "incorporated", "limited"]);

/** A name's words without Inc / LLC / Group / Co / Corp / Company / The: "Baldi Management Group Inc." → baldi, management. */
export const installCore = (name: string | null | undefined) => wordsOf(name ?? "").filter((w) => !LOOSE_SUFFIXES.has(w));

/**
 * Install candidates only (never tickets or PMs): the same account when both names have the same core words —
 * lowercased, punctuation and Inc / LLC / Group / Co / Corp / Company / The dropped ("Baldi Management" and "Baldi
 * Management Group Inc."). The import picks, merges and re-checks on this match.
 */
export function customersStrictlyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (isWalkInName(a) || isWalkInName(b)) return false;
  const ka = normalizeCustomerKey(a);
  const kb = normalizeCustomerKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const wa = installCore(a);
  const wb = installCore(b);
  return wa.length > 0 && wa.length === wb.length && wa.every((w, i) => wb[i] === w);
}

/**
 * A looser relation for the import's install picker to list, never to pick: one name's core words are the first words
 * of the other's ("Federal Grill" and "Federal Grill - Katy" may be another location). One generic word ("Coffee",
 * "Cafe") never links two names.
 */
export function customersLooselyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (customersStrictlyMatch(a, b)) return true;
  if (isWalkInName(a) || isWalkInName(b) || !normalizeCustomerKey(a) || !normalizeCustomerKey(b)) return false;
  const wa = installCore(a);
  const wb = installCore(b);
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  if (!short.length || (short.length === 1 && COMMON.has(short[0]!))) return false;
  return short.every((w, i) => long[i] === w);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

function details(row: CleanRow | undefined): { address: string | null; salesRep: string | null } {
  return { address: tidy(row?.address) || null, salesRep: tidy(row?.salesRep) || null };
}

/** "5740 San Felipe, Unit 130, Houston, TX 77057" from the ship-to columns. */
export function shipToAddress(parts: { line1?: unknown; line2?: unknown; city?: unknown; state?: unknown; zip?: unknown }): string {
  const t = (v: unknown) => tidy(v == null ? "" : String(v)).replace(/,+$/, "");
  const cityLine = [t(parts.city), [t(parts.state), t(parts.zip)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [t(parts.line1), t(parts.line2), cityLine].filter(Boolean).join(", ");
}

type Prepared = { row: CleanRow; clean: string; key: string; leafKey: string; parent: string | null; core: string[]; coreKey: string };

function prepare(rows: CleanRow[]): Prepared[] {
  return rows
    .map((row) => {
      const clean = cleanNameOf(row);
      const leaf = leafOf(clean);
      const core = coreWords(leaf);
      return { row, clean, key: normalizeCustomerKey(clean), leafKey: normalizeCustomerKey(leaf), parent: parentOf(clean), core, coreKey: core.join("") };
    })
    .filter((p) => p.key);
}

type Candidate = { p: Prepared; score: number; reason: string };

function similarity(acct: string, p: Prepared): Candidate | null {
  const aKey = normalizeCustomerKey(acct);
  const aCore = coreWords(acct);
  const aCoreKey = aCore.join("");
  if (!aKey) return null;
  if (p.parent && p.leafKey === aKey) return { p, score: 100, reason: `Same name under the parent “${p.parent}”` };
  const aParent = parentOf(acct);
  if (aParent && normalizeCustomerKey(leafOf(acct)) === (p.parent ? p.leafKey : p.key)) {
    return { p, score: 98, reason: `Same name; the KatzDesk name has the parent “${aParent}”${p.parent ? ` and the list has “${p.parent}”` : " and the list has none"}` };
  }
  if (aCoreKey && aCoreKey === p.coreKey) {
    return { p, score: 95, reason: p.parent ? `Same words under the parent “${p.parent}”; Inc / LLC / punctuation differ` : "Same words; Inc / LLC / Co or punctuation differ" };
  }
  const aSet = new Set(aCore);
  const bSet = new Set(p.core);
  if (aSet.size && aSet.size === bSet.size && [...aSet].every((w) => bSet.has(w))) {
    return { p, score: 92, reason: "Same words in a different order" };
  }
  const [small, big, smallIsAcct] = aSet.size <= bSet.size ? [aSet, bSet, true] : [bSet, aSet, false];
  const smallKey = [...small].join("");
  if (small.size && [...small].every((w) => big.has(w)) && (small.size >= 2 || smallKey.length >= 5)) {
    const extra = [...big].filter((w) => !small.has(w));
    if (extra.length && extra.length <= 3) {
      const whose = smallIsAcct ? "the clean-list name" : "the KatzDesk name";
      return { p, score: 85 - extra.length * 5, reason: `Extra words on ${whose}: “${extra.join(" ")}”` };
    }
  }
  const a = aCoreKey || aKey;
  const b = p.coreKey || p.leafKey;
  if (a.length >= 5 && b.length >= 5 && a[0] === b[0] && Math.abs(a.length - b.length) <= 3) {
    const d = editDistance(a, b);
    const ratio = 1 - d / Math.max(a.length, b.length);
    if (d <= 3 && ratio >= 0.85) return { p, score: Math.round(60 + ratio * 20), reason: `Spelling differs (${d} letter${d === 1 ? "" : "s"})` };
  }
  return null;
}

/** The report: one item per KatzDesk account, plus Walk-In / Cimbali rows on the list with no KatzDesk account. */
export function matchCleanList(accounts: KatzAccount[], rows: CleanRow[], maxCandidates = 3): CleanItem[] {
  const prepared = prepare(rows);
  const byKey = new Map<string, Prepared[]>();
  const byWord = new Map<string, Prepared[]>();
  const byStart = new Map<string, Prepared[]>();
  const byLeaf = new Map<string, Prepared[]>();
  for (const p of prepared) {
    if (p.parent) byLeaf.set(p.leafKey, [...(byLeaf.get(p.leafKey) ?? []), p]);
    byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
    for (const w of new Set(p.core)) {
      if (w.length < 3 || COMMON.has(w)) continue;
      byWord.set(w, [...(byWord.get(w) ?? []), p]);
    }
    const start = (p.coreKey || p.leafKey).slice(0, 3);
    if (start) byStart.set(start, [...(byStart.get(start) ?? []), p]);
  }

  const items: CleanItem[] = [];
  const usedRows = new Set<Prepared>();
  const claimedExact = new Map<Prepared, string>();
  const sorted = [...accounts].sort((a, b) => a.id - b.id);

  for (const acct of sorted) {
    const key = normalizeCustomerKey(acct.name);
    const leafKey = normalizeCustomerKey(leafOf(acct.name));
    const exact = key ? byKey.get(key) ?? [] : [];
    const special = (name: string | null) => (isWalkInName(name) ? "walk_in" : isCimbaliName(name) ? "cimbali" : null);
    let candidates: Candidate[];
    if (exact.length) candidates = exact.map((p) => ({ p, score: 200, reason: "Same name (case, spacing or punctuation may differ)" }));
    else {
      const pool = new Set<Prepared>();
      const core = coreWords(acct.name);
      for (const w of core) if (w.length >= 3 && !COMMON.has(w)) for (const p of byWord.get(w) ?? []) pool.add(p);
      const start = (core.join("") || key).slice(0, 3);
      for (const p of byStart.get(start) ?? []) pool.add(p);
      for (const p of byLeaf.get(key) ?? []) pool.add(p);
      if (leafKey !== key) for (const p of [...(byKey.get(leafKey) ?? []), ...(byLeaf.get(leafKey) ?? [])]) pool.add(p);
      candidates = [...pool]
        .map((p) => similarity(acct.name, p))
        .filter((c): c is Candidate => !!c)
        .sort((x, y) => y.score - x.score || x.p.clean.localeCompare(y.p.clean))
        .slice(0, maxCandidates);
    }
    const kindFromNames = special(acct.name) ?? candidates.map((c) => special(c.p.clean)).find(Boolean) ?? null;
    if (kindFromNames) {
      const best = candidates[0];
      if (best) usedRows.add(best.p);
      items.push({
        kind: kindFromNames,
        accountId: acct.id,
        katzName: acct.name,
        cleanName: best?.p.clean ?? null,
        internalId: best?.p.row.internalId ?? null,
        reason: best ? best.reason : "No clean-list match",
        ...details(best?.p.row),
      });
      continue;
    }
    if (!candidates.length) {
      items.push({ kind: "no_match", accountId: acct.id, katzName: acct.name, cleanName: null, internalId: null, reason: "No clean-list match", ...details(undefined) });
      continue;
    }
    if (exact.length === 1) {
      const p = exact[0]!;
      const first = claimedExact.get(p);
      usedRows.add(p);
      if (first) {
        items.push({ kind: "similar", accountId: acct.id, katzName: acct.name, cleanName: p.clean, internalId: p.row.internalId, reason: `Same clean name as the KatzDesk account “${first}”; approving merges the two`, ...details(p.row) });
      } else {
        claimedExact.set(p, acct.name);
        items.push({ kind: "exact", accountId: acct.id, katzName: acct.name, cleanName: p.clean, internalId: p.row.internalId, reason: candidates[0]!.reason, ...details(p.row) });
      }
      continue;
    }
    for (const c of candidates) {
      usedRows.add(c.p);
      items.push({
        kind: "similar",
        accountId: acct.id,
        katzName: acct.name,
        cleanName: c.p.clean,
        internalId: c.p.row.internalId,
        reason: exact.length > 1 ? `${exact.length} clean-list rows have this name; pick one` : c.reason,
        ...details(c.p.row),
      });
    }
  }

  for (const p of prepared) {
    if (usedRows.has(p)) continue;
    const kind = isWalkInName(p.clean) ? "walk_in" : isCimbaliName(p.clean) ? "cimbali" : null;
    if (!kind) continue;
    items.push({ kind, accountId: null, katzName: null, cleanName: p.clean, internalId: p.row.internalId, reason: "On the clean list; no KatzDesk account", ...details(p.row) });
  }
  return items;
}

/** Pull the Customers rows out of the sheet's header row and cells. Accepts the NetSuite export as-is. */
export function rowsFromMatrix(matrix: unknown[][]): CleanRow[] {
  const headerAt = matrix.findIndex((r) => r.some((c) => /customer name|company name/i.test(String(c ?? ""))));
  if (headerAt < 0) throw new Error("No Customer Name column on that sheet.");
  const head = matrix[headerAt]!.map((c) => String(c ?? "").trim().toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const nameCol = col(/^(customer name|company name)$/);
  const entityCol = col(/^(entity id|name)$/);
  const idCol = col(/^internal id$/);
  const repCol = col(/^sales rep$/);
  const a1 = col(/^ship-?to address 1$/);
  const a2 = col(/^ship-?to address 2$/);
  const city = col(/^ship-?to city$/);
  const state = col(/^ship-?to state$/);
  const zip = col(/^ship-?to zip$/);
  const at = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");
  const out: CleanRow[] = [];
  for (const r of matrix.slice(headerAt + 1)) {
    const name = String(r[nameCol] ?? "").trim();
    const entityId = entityCol >= 0 ? String(r[entityCol] ?? "").trim() : "";
    if (!name && !entityId) continue;
    out.push({
      internalId: idCol >= 0 ? String(r[idCol] ?? "").trim() : "",
      entityId,
      name,
      address: shipToAddress({ line1: at(r, a1), line2: at(r, a2), city: at(r, city), state: at(r, state), zip: at(r, zip) }),
      salesRep: tidy(String(at(r, repCol) ?? "")),
    });
  }
  return out;
}

export type RosterRep = { name: string; initials?: string | null; active?: boolean };

/**
 * The clean list's Sales Rep → a rep on the KatzDesk rep list, by name or initials (a one- or two-letter slip in the
 * name still matches: "Bill McKinsley" is Bill McKinley). No rep on the list, or a rep KatzDesk does not have: blank,
 * with the reason as a flag. A rep is never made up.
 */
export function resolveSalesRep(raw: string | null | undefined, roster: RosterRep[]): { rep: string | null; flag: string | null } {
  const name = tidy(raw);
  if (!name) return { rep: null, flag: "No sales rep on the clean list" };
  const key = (v: string) => v.toLowerCase().replace(/[^a-z]/g, "");
  const active = roster.filter((r) => r.active !== false && tidy(r.name));
  const k = key(name);
  const hit =
    active.find((r) => key(r.name) === k) ??
    active.find((r) => !!r.initials && key(r.initials) === k) ??
    active.find((r) => {
      const a = key(r.name);
      return a[0] === k[0] && Math.abs(a.length - k.length) <= 2 && editDistance(a, k) <= 2;
    });
  if (hit) return { rep: tidy(hit.name), flag: null };
  return { rep: null, flag: `Sales rep “${name}” is not on the KatzDesk rep list` };
}

const DONE_STATUSES = new Set(["apply", "locked", "kept", "skipped", "removal"]);

/**
 * A Clean Names line with nothing left to decide: approved or kept (locked), being applied, skipped, flagged for
 * removal, or its account removed from Customers. Done lines leave their section until Show Done is on (Chuy, 10/26).
 */
export function cleanLineDone(line: { status: string; accountRemoved?: boolean }): boolean {
  return line.accountRemoved === true || DONE_STATUSES.has(line.status);
}
