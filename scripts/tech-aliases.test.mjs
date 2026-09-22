import assert from "node:assert/strict";
import { canonicalTechName, sameTech, DEFAULT_TECHS } from "../src/lib/ops/tech-match.ts";

const expected = [
  "Ryan Gloria",
  "Charles Foster",
  "Oliver Garcia",
  "Joshua Harper",
  "Lance Oden",
  "Jesus Garcia",
  "Bill McKinley",
  "Brandon Chappell",
  "3rd Party",
];
assert.deepEqual([...DEFAULT_TECHS], expected);

const cases = [
  ["Ryan", "Ryan Gloria"],
  ["Ryan Gloria", "Ryan Gloria"],
  ["Oliver", "Oliver Garcia"],
  ["Oliver Garcia", "Oliver Garcia"],
  ["Josh", "Joshua Harper"],
  ["Joshua", "Joshua Harper"],
  ["Joshua Harper", "Joshua Harper"],
  ["Charles", "Charles Foster"],
  ["Charles Foster", "Charles Foster"],
  ["Lance", "Lance Oden"],
  ["Lance Oden", "Lance Oden"],
  ["Jesus", "Jesus Garcia"],
  ["Jesus Garcia", "Jesus Garcia"],
  ["Bill", "Bill McKinley"],
  ["McKinley", "Bill McKinley"],
  ["McKinsley", "Bill McKinley"],
  ["Bill McKinsley", "Bill McKinley"],
  ["Bill McKinley", "Bill McKinley"],
  ["Brandon", "Brandon Chappell"],
  ["Brandon Chappell", "Brandon Chappell"],
  ["3rd Party", "3rd Party"],
  ["third party", "3rd Party"],
];

for (const [raw, want] of cases) {
  assert.equal(canonicalTechName(raw), want, raw);
  assert.equal(sameTech(raw, want), true, `${raw} ~ ${want}`);
}

assert.equal(canonicalTechName("Garcia"), null, "Garcia is not unique");
assert.equal(sameTech("Garcia", "Oliver Garcia"), false);
assert.equal(sameTech("Oliver Garcia", "Jesus Garcia"), false);
assert.equal(sameTech("Ryan", "Oliver"), false);
assert.equal(sameTech("", "Ryan Gloria"), false);
assert.equal(canonicalTechName("Elias"), null);

console.log("tech aliases ok");
