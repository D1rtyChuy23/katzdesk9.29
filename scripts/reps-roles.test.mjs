import assert from "node:assert/strict";
import { findRep, canonicalRepName, isNoRep, formatRep } from "../src/lib/ops/rep-match.ts";


const cases = [
  ["Amanda", "Amanda Logg", "AL"],
  ["AL", "Amanda Logg", "AL"],
  ["Amanda Logg", "Amanda Logg", "AL"],
  ["Lizbeth", "Lizbeth Romero", "LR"],
  ["LR", "Lizbeth Romero", "LR"],
  ["Sean", "Sean Marshall", "SM"],
  ["SM", "Sean Marshall", "SM"],
  ["Lance", "Lance Oden", "LO"],
  ["LO", "Lance Oden", "LO"],
  ["Bill", "Bill McKinley", "BM"],
  ["BM", "Bill McKinley", "BM"],
  ["McKinley", "Bill McKinley", "BM"],
  ["McKinsley", "Bill McKinley", "BM"],
  ["Bill McKinsley", "Bill McKinley", "BM"],
  ["Shannon", "Shannon Cafourek", "SC"],
  ["SC", "Shannon Cafourek", "SC"],
  ["Jesus", "Jesus Garcia", "JG"],
  ["JG", "Jesus Garcia", "JG"],
  ["Jesus Garcia (JG)", "Jesus Garcia", "JG"],
  ["Melinda", "Melinda Warden", "MW"],
  ["MW", "Melinda Warden", "MW"],
  ["Melinda Warden", "Melinda Warden", "MW"],
  ["Warden", "Melinda Warden", "MW"],
  ["Melinda Warden (MW)", "Melinda Warden", "MW"],
];

for (const [raw, name, initials] of cases) {
  const hit = findRep(raw);
  assert.ok(hit, `expected ${raw} to match`);
  assert.equal(hit.name, name, raw);
  assert.equal(hit.initials, initials, raw);
  assert.equal(canonicalRepName(raw), name);
  assert.equal(formatRep(raw), `${name} (${initials})`);
  assert.equal(isNoRep(raw), false);
}

assert.equal(isNoRep(""), true);
assert.equal(isNoRep(null), true);
assert.equal(isNoRep("Unknown Person"), true);
assert.equal(isNoRep("ZZ"), true);
assert.equal(findRep("Ryan"), null);

console.log("reps-roles.test.mjs ok", cases.length, "aliases");
