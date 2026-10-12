import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAccountNumber, planAccountNumbers, importRowsFromMatrix } from "../src/lib/ops/account-numbers.ts";

test("account numbers keep leading zeros and dashes", () => {
  assert.equal(cleanAccountNumber(" 00123 "), "00123");
  assert.equal(cleanAccountNumber("A-01  7"), "A-01 7");
  assert.equal(cleanAccountNumber("   "), null);
});

const accounts = [
  { id: 1, name: "Common Bond Tanglewood", netsuiteId: "1520", accountNumber: null },
  { id: 2, name: "Texican Court", netsuiteId: "1523", accountNumber: "00042" },
  { id: 3, name: "Mod Coffeehouse", netsuiteId: "9", accountNumber: null },
  { id: 4, name: "Coco's - Katy", accountNumber: null },
  { id: 5, name: "Cocos Katy", accountNumber: null },
  { id: 6, name: "Holder Cafe", accountNumber: "77" },
];
const plan = (rows) => planAccountNumbers(rows.map(([customer, accountNumber], i) => ({ line: i + 2, customer, accountNumber })), accounts);

test("preview: matches, same, conflicts and unmatched — nothing is guessed", () => {
  const p = plan([
    ["common bond tanglewood", "00777"], // by name → match
    ["1523", "00042"], // by clean-list ID → already set
    ["Mod Coffeehouse", "77"], // number belongs to Holder Cafe
    ["Nowhere Cafe", "1"], // unmatched
    ["cocos katy", "5"], // exact name wins over the loose look-alike
    ["Coco's Katy", "6"], // loose: two accounts look like this → unmatched
  ]);
  assert.deepEqual(p.map((l) => l.status), ["match", "same", "conflict", "unmatched", "match", "unmatched"]);
  assert.match(p[2].reason, /Holder Cafe/);
  assert.match(p[5].reason, /More than one account/);
});

test("preview: duplicates in the file and changing an existing number are conflicts", () => {
  const p = plan([
    ["Common Bond Tanglewood", "A-1"],
    ["Mod Coffeehouse", "a-1"],
    ["Texican Court", "00043"],
  ]);
  assert.deepEqual(p.map((l) => l.status), ["conflict", "conflict", "conflict"]);
  assert.match(p[2].reason, /already has account number 00042/);
});

test("reads a CSV header with customer and account_number", () => {
  const rows = importRowsFromMatrix([["Customer", "account_number"], ["Texican Court", "00042"], ["", ""]]);
  assert.deepEqual(rows, [{ line: 2, customer: "Texican Court", accountNumber: "00042" }]);
  assert.throws(() => importRowsFromMatrix([["Name", "Phone"]]), /account_number/);
});
