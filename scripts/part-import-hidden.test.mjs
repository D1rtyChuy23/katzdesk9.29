// Import Parts (NetSuite) matches live parts only (Grok for Chuy, 11/10): a hidden or merged part never takes an
// update and never counts toward a shared MPN or SKU. A row that matches only a hidden part is listed and left out.
// Made-up part numbers; the shape copies the report (a hidden duplicate whose SKU carries a prefix, same MPN).
import { test } from "node:test";
import assert from "node:assert/strict";
import { planPartImport } from "../src/lib/ops/part-pricing.ts";

const part = (o) => ({ item: o.sku, description: "Valve", rate: 20, cost: null, listPrice: null, itemClass: "Parts", active: true, ...o });
const row = (o) => ({ line: 2, sheet: "Parts", sku: o.mpn, parent: "PARTS", description: null, rate: 27, cost: null, kind: "part", cls: "Parts", ...o });

test("a live part and a hidden part with the same MPN: the live one is updated", () => {
  const stored = [part({ id: 3127, sku: "LMZZ-M100", mpn: "ZZ-M100", hidden: true }), part({ id: 7242, sku: "ZZ-M100", mpn: "ZZ-M100" })];
  const [line] = planPartImport([row({ mpn: "ZZ-M100" })], stored);
  assert.deepEqual([line.status, line.partId, line.changes, line.reason], ["update", 7242, ["Base Price $20.00 → $27.00"], null]);
  // The hidden one's SKU being the row's name doesn't make it taken either.
  const [byName] = planPartImport([row({ mpn: "ZZ-M100", sku: "LMZZ-M100" })], stored);
  assert.deepEqual([byName.status, byName.partId], ["update", 7242]);
});

test("a part merged into another doesn't count toward a shared MPN either", () => {
  const stored = [part({ id: 1, sku: "OLD-ZZ7", mpn: "ZZ7", hidden: true, mergedIntoSku: "ZZ7" }), part({ id: 2, sku: "ZZ7", mpn: "ZZ7" })];
  const [line] = planPartImport([row({ mpn: "ZZ7" })], stored);
  assert.deepEqual([line.status, line.partId], ["update", 2]);
});

test("a row that matches only a hidden part is listed and not applied: no new part, no update", () => {
  const stored = [part({ id: 3127, sku: "LMZZ-M100", mpn: "ZZ-M100", hidden: true }), part({ id: 50, sku: "ZZ-OTHER", mpn: "ZZ-OTHER" })];
  const [byMpn] = planPartImport([row({ mpn: "ZZ-M100" })], stored);
  assert.deepEqual([byMpn.status, byMpn.partId, byMpn.changes, byMpn.reason], ["hidden", 3127, [], "Matches a hidden part: LMZZ-M100 (id 3127)"]);
  // Two hidden parts with the row's MPN: still only listed, not "shared".
  const two = [...stored, part({ id: 3128, sku: "LMZZ-M100-B", mpn: "ZZ M100", hidden: true })];
  const [both] = planPartImport([row({ mpn: "ZZ-M100" })], two);
  assert.deepEqual([both.status, both.partId, both.reason], ["hidden", 3127, "Matches a hidden part: LMZZ-M100 (id 3127), LMZZ-M100-B (id 3128)"]);
  // A new MPN whose SKU is a hidden part's: listed, not added.
  const [byName] = planPartImport([row({ mpn: "ZZ-NEW1", sku: "LMZZ-M100" })], stored);
  assert.deepEqual([byName.status, byName.partId, byName.reason], ["hidden", 3127, "Matches a hidden part: LMZZ-M100 (id 3127)"]);
});

test("two live parts with the same MPN are still refused, and a hidden third isn't named", () => {
  const stored = [
    part({ id: 1, sku: "ZZ-A1", mpn: "ZZ-A1" }),
    part({ id: 2, sku: "ZZ-A1-DUP", mpn: "zz a1" }),
    part({ id: 3, sku: "LMZZ-A1", mpn: "ZZ-A1", hidden: true }),
  ];
  const [line] = planPartImport([row({ mpn: "ZZ-A1" })], stored);
  assert.deepEqual([line.status, line.partId, line.reason], ["shared_mpn", null, "2 parts already share MPN ZZ-A1 (ZZ-A1, ZZ-A1-DUP). Fix that on Parts first."]);
});
