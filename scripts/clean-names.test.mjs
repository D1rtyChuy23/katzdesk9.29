import { test } from "node:test";
import assert from "node:assert/strict";
import { matchCleanList, cleanNameOf, rowsFromMatrix } from "../src/lib/ops/clean-names.ts";

const row = (name, internalId = String(Math.random()).slice(2, 7)) => ({ internalId, entityId: name, name });
const one = (accounts, rows) => matchCleanList(accounts.map((name, i) => ({ id: i + 1, name })), rows.map((n) => row(n)));

test("exact: same name, case or punctuation only", () => {
  const items = one(["waller county court house", "Common Bond Tanglewood"], ["Waller County Courthouse", "Common Bond Tanglewood"]);
  assert.deepEqual(items.map((i) => [i.kind, i.cleanName]), [["exact", "Waller County Courthouse"], ["exact", "Common Bond Tanglewood"]]);
});

test("zero-width spaces never reach the applied name", () => {
  assert.equal(cleanNameOf({ name: "​Scrambles  Breakfast & Lunch ", entityId: "" }), "Scrambles Breakfast & Lunch");
});

test("similar: Inc vs LLC, extra location, spelling, parent prefix — never exact", () => {
  const items = one(["Monarch Pantry Inc", "Faith Family Church", "Latte Café - La Grange", "Black Rifle Coffee"],
    ["Monarch Pantry LLC", "Faith Family Church - Baytown", "Latte Cafe - La Grange", "Eversys Service:Black Rifle Coffee"]);
  const byName = Object.fromEntries(items.map((i) => [i.katzName, i]));
  assert.equal(byName["Monarch Pantry Inc"].kind, "similar");
  assert.match(byName["Monarch Pantry Inc"].reason, /Inc \/ LLC/);
  assert.match(byName["Faith Family Church"].reason, /Extra words on the clean-list name: “baytown”/);
  assert.match(byName["Latte Café - La Grange"].reason, /Spelling differs/);
  assert.match(byName["Black Rifle Coffee"].reason, /parent “Eversys Service”/);
});

test("two KatzDesk accounts on one clean name: the second waits for approval", () => {
  const items = one(["Gringo's - Sugarland", "gringos sugarland"], ["Gringo's - Sugarland"]);
  assert.deepEqual(items.map((i) => i.kind), ["exact", "similar"]);
  assert.match(items[1].reason, /approving merges/);
});

test("two clean rows with one name: both offered, none applied", () => {
  const items = one(["H.E.B. Bunker Hill #109"], ["H.E.B Bunker Hill #109", "H.E.B. Bunker Hill #109"]);
  assert.deepEqual(items.map((i) => i.kind), ["similar", "similar"]);
});

test("Walk-In and Cimbali are always held, matched or not; leftovers are No Match", () => {
  const items = one(["Walk - In:Black Rock Coffee Bar", "Olive Garden #1074", "HPD Walk-In", "Zebra Lounge"],
    ["Black Rock Coffee Bar", "Cimbali National Accounts:Olive Garden #1074", "HPD Walk-In", "Walk - In:Orange Taco"]);
  const kinds = items.map((i) => `${i.kind}:${i.katzName ?? "-"}:${i.cleanName ?? "-"}`);
  assert.deepEqual(kinds, [
    "walk_in:Walk - In:Black Rock Coffee Bar:Black Rock Coffee Bar",
    "cimbali:Olive Garden #1074:Cimbali National Accounts:Olive Garden #1074",
    "walk_in:HPD Walk-In:HPD Walk-In",
    "no_match:Zebra Lounge:-",
    "walk_in:-:Walk - In:Orange Taco",
  ]);
});

test("reads the NetSuite export's Customers sheet", () => {
  const rows = rowsFromMatrix([["Internal ID", "Entity ID", "Customer Name", "Status"], [1520, "Common Bond Tanglewood", "Common Bond Tanglewood", "x"], [null, null, null]]);
  assert.deepEqual(rows, [{ internalId: "1520", entityId: "Common Bond Tanglewood", name: "Common Bond Tanglewood", address: "", salesRep: "" }]);
});

import { resolveSalesRep, shipToAddress } from "../src/lib/ops/clean-names.ts";
const roster = [
  { name: "Amanda Logg", initials: "AL" }, { name: "Lizbeth Romero", initials: "LR" }, { name: "Sean Marshall", initials: "SM" },
  { name: "Lance Oden", initials: "LO" }, { name: "Bill McKinley", initials: "BM" }, { name: "Shannon Cafourek", initials: "SC" },
  { name: "Jesus Garcia", initials: "JG" },
];

test("sales rep from the list: by name, initials or a small slip; never invented", () => {
  assert.deepEqual(resolveSalesRep("Amanda Logg", roster), { rep: "Amanda Logg", flag: null });
  assert.deepEqual(resolveSalesRep("SC", roster), { rep: "Shannon Cafourek", flag: null });
  assert.deepEqual(resolveSalesRep("Bill McKinsley", roster), { rep: "Bill McKinley", flag: null });
  assert.deepEqual(resolveSalesRep("", roster), { rep: null, flag: "No sales rep on the clean list" });
  assert.deepEqual(resolveSalesRep("Karla Zapata", roster), { rep: null, flag: "Sales rep “Karla Zapata” is not on the KatzDesk rep list" });
});

test("ship-to address from the list columns", () => {
  assert.equal(shipToAddress({ line1: "5740 San Felipe, Unit 130", line2: null, city: "Houston", state: "TX", zip: "77057" }), "5740 San Felipe, Unit 130, Houston, TX 77057");
  assert.equal(shipToAddress({ line1: "17455 N Outer 40 Rd,", city: "Chesterfield", state: "MO", zip: 63005 }), "17455 N Outer 40 Rd, Chesterfield, MO 63005");
  assert.equal(shipToAddress({}), "");
});

test("details ride along on each line", () => {
  const items = matchCleanList([{ id: 1, name: "Common Bond Tanglewood" }], [{ internalId: "1520", entityId: "x", name: "Common Bond Tanglewood", address: "5740 San Felipe, Houston, TX 77057", salesRep: "Amanda Logg" }]);
  assert.equal(items[0].address, "5740 San Felipe, Houston, TX 77057");
  assert.equal(items[0].salesRep, "Amanda Logg");
});
