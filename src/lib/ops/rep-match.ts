import { normalizeName } from "./norm.ts";

export type CanonicalRep = {
  name: string;
  initials: string;
  first: string;
};

/** Locked sales-rep list. Display as Name (IN). */
export const DEFAULT_REPS: CanonicalRep[] = [
  { name: "Amanda Logg", initials: "AL", first: "Amanda" },
  { name: "Lizbeth Romero", initials: "LR", first: "Lizbeth" },
  { name: "Sean Marshall", initials: "SM", first: "Sean" },
  { name: "Lance Oden", initials: "LO", first: "Lance" },
  { name: "Bill McKinley", initials: "BM", first: "Bill" },
  { name: "Shannon Cafourek", initials: "SC", first: "Shannon" },
  { name: "Jesus Garcia", initials: "JG", first: "Jesus" },
  { name: "Melinda Warden", initials: "MW", first: "Melinda" },
];

export const PRODUCERS = DEFAULT_REPS.map((r) => r.name);

export const PRODUCER_INITIALS: Record<string, string> = Object.fromEntries(
  DEFAULT_REPS.map((r) => [r.name, r.initials]),
);

const ALIASES: Record<string, string> = {};

function addAlias(raw: string, canonical: string) {
  const k = normalizeName(raw);
  if (k) ALIASES[k] = canonical;
}

for (const r of DEFAULT_REPS) {
  addAlias(r.name, r.name);
  addAlias(r.first, r.name);
  addAlias(r.initials, r.name);
  addAlias(`${r.first} ${r.initials}`, r.name);
  addAlias(`${r.name} (${r.initials})`, r.name);
}
addAlias("McKinley", "Bill McKinley");
addAlias("McKinsley", "Bill McKinley");
addAlias("Bill McKinsley", "Bill McKinley");
addAlias("Bill McKinley", "Bill McKinley");
addAlias("Warden", "Melinda Warden");

export function findRep(raw: string | null | undefined): CanonicalRep | null {
  const n = normalizeName(raw);
  if (!n) return null;
  const mapped = ALIASES[n];
  if (mapped) return DEFAULT_REPS.find((r) => r.name === mapped) ?? null;
  const stripped = n.replace(/\s*\([a-z]{2}\)\s*$/, "").trim();
  if (stripped && stripped !== n) {
    const again = ALIASES[stripped];
    if (again) return DEFAULT_REPS.find((r) => r.name === again) ?? null;
  }
  for (const r of DEFAULT_REPS) {
    if (normalizeName(r.name) === n || normalizeName(r.first) === n || r.initials.toLowerCase() === n) return r;
  }
  return null;
}

export function canonicalRepName(raw: string | null | undefined): string | null {
  return findRep(raw)?.name ?? null;
}

export function isKnownRep(raw: string | null | undefined): boolean {
  return !!findRep(raw);
}

export function isNoRep(raw: string | null | undefined): boolean {
  return !findRep(raw);
}

export function formatRep(raw: string | null | undefined): string {
  const r = findRep(raw);
  if (r) return `${r.name} (${r.initials})`;
  const s = (raw ?? "").trim();
  return s || "";
}

export function repInitials(raw: string | null | undefined): string | null {
  return findRep(raw)?.initials ?? null;
}

export function sameRep(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = canonicalRepName(a);
  const right = canonicalRepName(b);
  if (left && right) return left === right;
  return normalizeName(a) !== "" && normalizeName(a) === normalizeName(b);
}
