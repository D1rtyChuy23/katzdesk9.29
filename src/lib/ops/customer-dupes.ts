/**
 * Possible duplicates: for each account an import added, the accounts already in KatzDesk that may be the same place.
 * Pure and read-only: it compares, rates and explains; it never merges or changes an account. Chuy merges by hand.
 *
 * Signs, from strongest:
 * - same site address: street and suite, in the same ZIP (or city when a ZIP is missing);
 * - same phone (last 10 digits, extension ignored) and same email address;
 * - the same name once Inc / LLC / Group / The, punctuation, spacing, dashes and a NetSuite parent ("Espresso Parts
 *   Service:") are set aside;
 * - weaker: a similar name (one begins with the other, or the same words in another order), the same email domain
 *   (never a free one such as gmail.com), the same street with a different suite.
 * A phone, email, domain or street on more than SHARED accounts says nothing about one place (a head office, a mall)
 * and isn't counted.
 *
 * Ratings: High needs the same site address and one more sign, so a name alone is never High.
 */
import { normalizeAddress } from "./address-report.ts";
import { COMMON, installCore, isWalkInName, leafOf, parentOf } from "./clean-names.ts";
import { splitSiteAddress } from "./customer-export.ts";
import { normalizeCustomerKey } from "./customer-key.ts";

export type DupeAccount = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  netsuiteId: string | null;
  accountNumber: string | null;
  inactive: boolean;
  /** Calls, TLCs, PMs, installs and deals on the account. */
  history: number;
};

export type DupeSign = "address" | "phone" | "email" | "name" | "similar" | "domain" | "street";
export type DupeLevel = "high" | "medium" | "low";
export type DupeReason = { sign: DupeSign; text: string };

export type DupePair = {
  /** The account the import added. */
  added: DupeAccount;
  /** The account it may duplicate. */
  other: DupeAccount;
  /** The other account was added by the same import too. */
  otherAdded: boolean;
  level: DupeLevel;
  reasons: DupeReason[];
  /** Which one to keep, if they are one place. Never a Walk-In account; null when both are. */
  keep: { id: number; why: string } | null;
};

export const DUPE_LEVELS: DupeLevel[] = ["high", "medium", "low"];
export const DUPE_LEVEL_LABEL: Record<DupeLevel, string> = { high: "High", medium: "Medium", low: "Low" };

/** A phone, email, domain or street on more accounts than this isn't a sign of one place. */
export const SHARED = 5;

/** Free email services: two accounts with Gmail addresses are not linked by that. */
export const FREE_EMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com", "hotmail.com", "outlook.com", "live.com",
  "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "comcast.net", "att.net", "sbcglobal.net", "bellsouth.net",
  "verizon.net", "charter.net", "cox.net", "earthlink.net", "protonmail.com", "proton.me", "gmx.com", "mail.com",
  "zoho.com", "yandex.com",
]);

/** The last 10 digits of a US phone number, extension dropped. Blank when it isn't one. */
export function phoneKey(raw: string | null | undefined): string {
  const first = String(raw ?? "").split(/\s*(?:[/;,]|\bor\b)\s*/i)[0] ?? "";
  const main = first.replace(/\s*(?:x|ext\.?|extension)\s*\d+\s*$/i, "");
  let digits = main.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

/** The first email address in the cell, lower-cased. Blank when there is none. */
export function emailKey(raw: string | null | undefined): string {
  const first = String(raw ?? "")
    .split(/[\s;,]+/)
    .find((p) => p.includes("@"));
  const e = String(first ?? "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "");
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) ? e : "";
}

export const domainOf = (email: string) => email.slice(email.indexOf("@") + 1);

/** "(713) 555-0199" → "ends 0199". */
export const maskPhone = (key: string) => (key ? `ends ${key.slice(-4)}` : "");

const UNIT_WORDS = new Set(["ste", "unit", "apt", "rm", "room", "bldg", "fl", "spc", "space", "lot", "no"]);

export type Place = { street: string; unit: string; zip: string; city: string };

/**
 * A site address compared by its street and suite, in its ZIP or city. "1200 Smith Street, Suite 1600" and
 * "1200 Smith St #1600" are one place. Null for a blank address, a PO box or a line with no house number.
 */
export function placeOf(raw: string | null | undefined): Place | null {
  const site = splitSiteAddress(raw);
  const hash = (s: string) => s.replace(/#\s*([a-z0-9-]+)/gi, " ste $1");
  let street = normalizeAddress(hash(site.line1));
  let unit = "";
  const inLine = /^(.*?)\s+(?:ste|unit|apt|rm|room|bldg|fl|spc|space)\s+(\S+)$/.exec(street);
  if (inLine) {
    street = inLine[1]!;
    unit = inLine[2]!;
  }
  if (!/^\d+[a-z]?\s+\S/.test(street) || /\bp ?o box\b|\bbox \d/.test(street)) return null;
  const line2 = normalizeAddress(hash(site.line2))
    .split(" ")
    .filter((w) => w && !UNIT_WORDS.has(w))
    .join(" ");
  return { street, unit: [unit, line2].filter(Boolean).join(" "), zip: site.zip.slice(0, 5), city: normalizeAddress(site.city) };
}

type Prepared = {
  a: DupeAccount;
  walkIn: boolean;
  phone: string;
  email: string;
  domain: string;
  place: Place | null;
  /** Street in its ZIP or city, for counting how many accounts share it. */
  streetKey: string;
  core: string[];
  /** The core words, in order and sorted, for quick comparing. */
  coreText: string;
  coreSorted: string;
  key: string;
  parent: string | null;
};

function prepare(a: DupeAccount): Prepared {
  const email = emailKey(a.email);
  const place = placeOf(a.address);
  const leaf = leafOf(a.name);
  const core = installCore(leaf);
  return {
    a,
    walkIn: isWalkInName(a.name),
    phone: phoneKey(a.phone),
    email,
    domain: email ? domainOf(email) : "",
    place,
    streetKey: place ? `${place.street}|${place.zip || place.city}` : "",
    core,
    coreText: core.join(" "),
    coreSorted: [...core].sort().join(" "),
    key: normalizeCustomerKey(leaf),
    parent: parentOf(a.name),
  };
}

/** How the names compare: the same name (once the extras are set aside), similar, or neither. */
function nameSign(x: Prepared, y: Prepared): DupeReason | null {
  // A Walk-In name says nothing about a place.
  if (x.walkIn || y.walkIn || !x.core.length || !y.core.length) return null;
  const parent = x.parent !== y.parent ? (x.parent ?? y.parent) : null;
  if (x.key === y.key || x.coreText === y.coreText) {
    if (x.core.length === 1 && COMMON.has(x.core[0]!)) return null;
    const bits = [x.key === y.key ? null : "Inc / LLC / Co / The", parent ? `the “${parent}:” prefix` : null].filter(Boolean);
    return { sign: "name", text: bits.length ? `Same name apart from ${bits.join(" and ")}` : "Same name apart from punctuation and spacing" };
  }
  const [short, long] = x.core.length <= y.core.length ? [x.core, y.core] : [y.core, x.core];
  if (short.length === 1 && COMMON.has(short[0]!)) return null;
  if (short.every((w, i) => long[i] === w)) return { sign: "similar", text: "Similar name: one begins with the other" };
  if (short.length >= 2 && short.length === long.length && x.coreSorted === y.coreSorted) {
    return { sign: "similar", text: "Similar name: the same words in another order" };
  }
  return null;
}

const unitText = (u: string) => (u ? (/^\d/.test(u) ? `Ste ${u}` : u.toUpperCase()) : "no suite");

function addressSign(x: Prepared, y: Prepared, sharedStreet: (key: string) => boolean): DupeReason | null {
  const p = x.place;
  const q = y.place;
  if (!p || !q || p.street !== q.street) return null;
  const sameArea = p.zip && q.zip ? p.zip === q.zip : p.city && q.city ? p.city === q.city : null;
  if (sameArea === false) return null;
  const units = !p.unit || !q.unit || p.unit === q.unit;
  if (sameArea && units) {
    const one = p.unit !== q.unit ? ` (one lists ${unitText(p.unit || q.unit)})` : "";
    return { sign: "address", text: `Same site address${one}` };
  }
  // A street many accounts share (a mall, an office tower) says nothing about one place.
  if (sharedStreet(x.streetKey)) return null;
  if (sameArea) return { sign: "street", text: `Same street, another suite (${unitText(p.unit)} · ${unitText(q.unit)})` };
  return { sign: "street", text: "Same street, no ZIP or city to compare" };
}

/** High, Medium or Low, from the signs. High always has the same site address and one more sign. */
export function rateSigns(signs: DupeSign[]): DupeLevel {
  const has = (s: DupeSign) => signs.includes(s);
  if (has("address") && signs.length >= 2) return "high";
  if (has("address")) return "medium";
  if ((has("phone") || has("email")) && (has("name") || has("similar") || (has("phone") && has("email")))) return "medium";
  if (has("name") && (has("domain") || has("street"))) return "medium";
  return "low";
}

/**
 * Which account to keep if they are one place: never a Walk-In. The one with more history (calls, PMs, installs) keeps
 * the most in place; on a tie, the one with the NetSuite ID; then the one that was there first.
 */
function keepOf(added: Prepared, other: Prepared, otherAdded: boolean): DupePair["keep"] {
  const ok = [other, added].filter((p) => !p.walkIn);
  if (!ok.length) return null;
  if (ok.length === 1) return { id: ok[0]!.a.id, why: "the other is a Walk-In account" };
  if (added.a.history !== other.a.history) {
    const more = added.a.history > other.a.history ? added : other;
    return { id: more.a.id, why: `more history (${more.a.history} ${more.a.history === 1 ? "record" : "records"})` };
  }
  const ns = (p: Prepared) => !!(p.a.netsuiteId ?? "").trim();
  if (ns(added) !== ns(other)) {
    const withId = ns(added) ? added : other;
    return { id: withId.a.id, why: "it has the NetSuite ID" };
  }
  const first = otherAdded ? (added.a.id < other.a.id ? added : other) : other;
  return { id: first.a.id, why: otherAdded ? "it was added first" : "it was in KatzDesk first" };
}

/**
 * Every possible duplicate of the added accounts, among all the accounts (the added ones included, each pair once).
 * Sorted High first, then by the added account's name.
 */
export function findPossibleDuplicates(addedIds: ReadonlySet<number>, accounts: DupeAccount[]): DupePair[] {
  const all = accounts.map(prepare);
  const count = (key: (p: Prepared) => string) => {
    const n = new Map<string, number>();
    for (const p of all) {
      const k = key(p);
      if (k) n.set(k, (n.get(k) ?? 0) + 1);
    }
    return (k: string) => (n.get(k) ?? 0) > SHARED;
  };
  const sharedPhone = count((p) => p.phone);
  const sharedEmail = count((p) => p.email);
  const sharedDomain = count((p) => (FREE_EMAIL.has(p.domain) ? "" : p.domain));
  const sharedStreet = count((p) => p.streetKey);

  const pairs: DupePair[] = [];
  for (const x of all) {
    if (!addedIds.has(x.a.id)) continue;
    for (const y of all) {
      if (y.a.id === x.a.id) continue;
      const otherAdded = addedIds.has(y.a.id);
      // Two added accounts: the pair once, from the lower id.
      if (otherAdded && y.a.id < x.a.id) continue;
      const reasons: DupeReason[] = [];
      const address = addressSign(x, y, sharedStreet);
      if (address) reasons.push(address);
      if (x.phone && x.phone === y.phone && !sharedPhone(x.phone)) reasons.push({ sign: "phone", text: `Same phone (${maskPhone(x.phone)})` });
      if (x.email && x.email === y.email && !sharedEmail(x.email)) {
        reasons.push({ sign: "email", text: `Same email address (at ${x.domain})` });
      } else if (x.domain && x.domain === y.domain && !FREE_EMAIL.has(x.domain) && !sharedDomain(x.domain)) {
        reasons.push({ sign: "domain", text: `Same email domain (${x.domain})` });
      }
      const name = nameSign(x, y);
      if (name) reasons.push(name);
      if (!reasons.length) continue;
      pairs.push({
        added: x.a,
        other: y.a,
        otherAdded,
        level: rateSigns(reasons.map((r) => r.sign)),
        reasons,
        keep: keepOf(x, y, otherAdded),
      });
    }
  }
  const rank = (l: DupeLevel) => DUPE_LEVELS.indexOf(l);
  return pairs.sort(
    (a, b) =>
      rank(a.level) - rank(b.level) ||
      a.added.name.localeCompare(b.added.name, "en", { sensitivity: "base" }) ||
      a.other.name.localeCompare(b.other.name, "en", { sensitivity: "base" }),
  );
}

/** The report as CSV rows: both names and addresses, the reasons, the rating and the suggestion. Phones never shown. */
export const DUPE_CSV_COLUMNS = [
  "Rating",
  "Added Account",
  "Added Account ID",
  "Added Address",
  "Possible Duplicate",
  "Possible Duplicate ID",
  "Possible Duplicate Address",
  "Also Added By This Import",
  "Reasons",
  "Suggested Keep",
] as const;

export function dupeCsvRows(pairs: DupePair[]): string[][] {
  return pairs.map((p) => [
    DUPE_LEVEL_LABEL[p.level],
    p.added.name,
    String(p.added.id),
    p.added.address ?? "",
    p.other.name,
    String(p.other.id),
    p.other.address ?? "",
    p.otherAdded ? "Yes" : "",
    p.reasons.map((r) => r.text).join("; "),
    p.keep ? `${p.keep.id === p.added.id ? p.added.name : p.other.name} (${p.keep.why})` : "Neither: both are Walk-In accounts",
  ]);
}
