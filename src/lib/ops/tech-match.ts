/** Corrigo-spelled service techs. Display names on the roster dropdown. */

import { normalizeName } from "./norm.ts";

export const DEFAULT_TECHS = [
  "Ryan Gloria",
  "Charles Foster",
  "Oliver Garcia",
  "Joshua Harper",
  "Lance Oden",
  "Jesus Garcia",
  "Bill McKinley",
  "Brandon Chappell",
  "3rd Party",
] as const;

export type CanonicalTech = (typeof DEFAULT_TECHS)[number];

const ALIASES: Record<string, string> = {};

function addAlias(raw: string, canonical: string) {
  const k = normalizeName(raw);
  if (k) ALIASES[k] = canonical;
}

const firstCounts = new Map<string, number>();
const lastCounts = new Map<string, number>();
for (const name of DEFAULT_TECHS) {
  if (name === "3rd Party") continue;
  const parts = name.split(/\s+/);
  const first = parts[0]!.toLowerCase();
  const last = parts[parts.length - 1]!.toLowerCase();
  firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  lastCounts.set(last, (lastCounts.get(last) ?? 0) + 1);
}

for (const name of DEFAULT_TECHS) {
  addAlias(name, name);
  if (name === "3rd Party") continue;
  const parts = name.split(/\s+/);
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  if ((firstCounts.get(first.toLowerCase()) ?? 0) === 1) addAlias(first, name);
  if (last !== first && (lastCounts.get(last.toLowerCase()) ?? 0) === 1) addAlias(last, name);
}

addAlias("Josh", "Joshua Harper");
addAlias("Joshua", "Joshua Harper");
addAlias("McKinsley", "Bill McKinley");
addAlias("Bill McKinsley", "Bill McKinley");
addAlias("third party", "3rd Party");
addAlias("3rd", "3rd Party");
addAlias("3rd-party", "3rd Party");

/** Map a stored/typed spelling to the Corrigo roster name when unique. */
export function canonicalTechName(raw: string | null | undefined): string | null {
  const k = normalizeName(raw);
  if (!k) return null;
  return ALIASES[k] ?? null;
}

/** True when two technician strings are the same person (aliases included). */
export function sameTech(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ca = canonicalTechName(a);
  const cb = canonicalTechName(b);
  if (ca && cb) return ca === cb;
  if (ca && normalizeName(ca) === nb) return true;
  if (cb && normalizeName(cb) === na) return true;
  return false;
}
