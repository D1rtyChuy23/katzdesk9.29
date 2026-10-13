import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billingCsv,
  billingState,
  checkCharges,
  chargesTotal,
  cleanQty,
  cleanRate,
  cleanSalesOrder,
  itemRowsFromMatrix,
  itemSku,
  kindForItem,
  lineAmount,
  searchItems,
  LABOR_ITEM,
  TRIP_ITEM,
} from "../src/lib/ops/charges.ts";

test("trip and labor are the fixed NetSuite items", () => {
  assert.equal(TRIP_ITEM, "Service : TRIPCHARGE");
  assert.equal(LABOR_ITEM, "Service : SERVICELABOR");
  assert.equal(kindForItem("service : tripcharge"), "trip");
  assert.equal(kindForItem("Service : SERVICELABOR"), "labor");
  assert.equal(kindForItem("PARTS : EVER104120"), "part");
  assert.equal(kindForItem("Equipment : Bunn Nitron"), "equipment");
});

test("totals match the Corrigo invoice: trip 150 + 2 hours labor 150 = 450", () => {
  const lines = [
    { qty: 1, rate: 150 },
    { qty: 2, rate: 150 },
  ];
  assert.equal(lineAmount(lines[1]), 300);
  assert.equal(chargesTotal(lines), 450);
});

test("cents are rounded, not floated", () => {
  assert.equal(chargesTotal([{ qty: 3, rate: 22.54 }]), 67.62);
  assert.equal(lineAmount({ qty: 0.1, rate: 0.2 }), 0.02);
});

test("quantity and rate cleaning", () => {
  assert.equal(cleanQty("2"), 2);
  assert.equal(cleanQty("1,000"), 1000);
  assert.equal(cleanQty("0"), null);
  assert.equal(cleanQty("-1"), null);
  assert.equal(cleanQty("abc"), null);
  assert.equal(cleanRate("$1,068.14"), 1068.14);
  assert.equal(cleanRate("0"), 0);
  assert.equal(cleanRate("-5"), null);
  assert.equal(cleanRate(""), null);
});

test("itemSku takes the part after the category", () => {
  assert.equal(itemSku("PARTS : EVER104120"), "EVER104120");
  assert.equal(itemSku("LA MARZOCCO PARTS : LM5.127"), "LM5.127");
  assert.equal(itemSku("AIRPOT2.4LS/SLINER"), "AIRPOT2.4LS/SLINER");
});

const items = [
  { item: "PARTS : EVER104120", description: "Eversys Water Pump Head - FOT (G20-9)", mfrPart: "10700937" },
  { item: "PARTS : EVER104345", description: "Eversys Grounds Drawer CPL Cameo..", mfrPart: null },
  { item: "WATER FILTERS : WF4FC5S", description: "Everpure 4FC5-S Cartridge", mfrPart: null },
  { item: "LA MARZOCCO PARTS : LM5.127", description: "La Marzocco Swift Double Basket (s22g)(B11-5)", mfrPart: null },
];

test("search: manufacturer number and NetSuite SKU are exact matches and come first", () => {
  assert.equal(searchItems("10700937", items)[0].item, "PARTS : EVER104120");
  assert.equal(searchItems("ever104345", items)[0].item, "PARTS : EVER104345");
  assert.equal(searchItems("lm5.127", items)[0].item, "LA MARZOCCO PARTS : LM5.127");
});

test("search: words in the description, and nothing for a blank or unknown query", () => {
  assert.deepEqual(searchItems("water pump", items).map((i) => i.item), ["PARTS : EVER104120"]);
  assert.deepEqual(searchItems("", items), []);
  assert.deepEqual(searchItems("zzzzzz", items), []);
});

test("checkCharges flags empty item, zero qty and negative rate", () => {
  const p = checkCharges([
    { item: "Service : TRIPCHARGE", qty: 1, rate: 150 },
    { item: "", qty: 1, rate: 10 },
    { item: "PARTS : X", qty: 0, rate: 10 },
    { item: "PARTS : Y", qty: 1, rate: -1 },
  ]);
  assert.deepEqual(p.map((x) => x.index), [1, 2, 3]);
});

test("billing state: SO number wins, charges are ready, none is flagged", () => {
  assert.equal(billingState({ lineCount: 0, nsSo: null }), "no-charges");
  assert.equal(billingState({ lineCount: 2, nsSo: "" }), "ready");
  assert.equal(billingState({ lineCount: 2, nsSo: "SO4345" }), "billed");
  assert.equal(billingState({ lineCount: 0, nsSo: "SO4345" }), "billed");
  assert.equal(cleanSalesOrder(" so 4345 "), "SO4345");
  assert.equal(cleanSalesOrder("  "), null);
});

test("item import reads a NetSuite export and skips blanks and repeats", () => {
  const { rows, skipped } = itemRowsFromMatrix([
    ["Name", "Description", "Base Price", "Vendor Name/Code"],
    ["PARTS : EVER104120", "Eversys Water Pump Head", "976.38", "10700937"],
    ["Service : TRIPCHARGE", "Trip Charge for Service Call", "150.00", ""],
    ["", "no name", "1", ""],
    ["parts : ever104120", "repeat", "1", ""],
    ["", "", "", ""],
  ]);
  assert.equal(rows.length, 2);
  assert.equal(skipped, 2);
  assert.equal(rows[0].mfrPart, "10700937");
  assert.equal(rows[0].rate, 976.38);
  assert.equal(rows[1].kind, "trip");
});

test("item import with no Name column is refused", () => {
  assert.throws(() => itemRowsFromMatrix([["Foo", "Bar"], ["1", "2"]]), /Name column/);
});

test("billing CSV: one row per line, quoted, formulas defused", () => {
  const csv = billingCsv([
    {
      wo: "WO-0739",
      po: "365377090",
      customer: 'Black Rock, "North Oaks"',
      accountNumber: "00123",
      netsuiteId: "1520",
      technician: "Joshua Harper",
      completed: "2026-10-05",
      item: "Service : TRIPCHARGE",
      description: "Trip Charge for Service Call",
      qty: 1,
      rate: 150,
      workDone: "=HYPERLINK(\"http://x\")",
    },
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^WO,PO,Customer,/);
  assert.match(lines[1], /"Black Rock, ""North Oaks"""/);
  assert.match(lines[1], /,150\.00,150\.00,/);
  assert.match(lines[1], /'=HYPERLINK/);
  assert.match(lines[1], /,00123,/);
});

import { itemRowsFromSheets, kindFromClass, priceChange, splitItemName, itemFullName } from "../src/lib/ops/charges.ts";

test("item names split into parent and SKU", () => {
  assert.deepEqual(splitItemName("PARTS : EVER104120"), { parent: "PARTS", sku: "EVER104120" });
  assert.deepEqual(splitItemName("LA MARZOCCO PARTS : LM5.127"), { parent: "LA MARZOCCO PARTS", sku: "LM5.127" });
  assert.deepEqual(splitItemName("EVER104120"), { parent: null, sku: "EVER104120" });
  assert.equal(itemFullName("EVER104120", "PARTS"), "PARTS : EVER104120");
  assert.equal(itemFullName("EVER104120", null), "EVER104120");
});

test("kind comes from the class, but trip and labor are never overridden", () => {
  assert.equal(kindFromClass("Equipment : Parts and Filters", "EVER104120"), "part");
  assert.equal(kindFromClass("Equipment : Equipment Sales", "BBESPRECIOUS22"), "equipment");
  assert.equal(kindFromClass("Service : Other Service", "BLUE ISLAND CB"), "other");
  assert.equal(kindFromClass("Service : Other Service", "TRIPCHARGE"), "trip");
  assert.equal(kindFromClass("", "SERVICELABOR"), "labor");
  assert.equal(kindFromClass(undefined, "X1"), "part");
});

test("a NetSuite export with several sheets is read as one list", () => {
  const head = ["Name", "Display Name", "Description", "Class", "SubType", "Base Price", "Purchase Price", "Preferred Vendor", "Inactive"];
  const r = itemRowsFromSheets([
    { name: "Parts", matrix: [head, ["EVER104120", "", "Eversys Water Pump Head", "Equipment : Parts and Filters", "", "976.38", "386", "Eversys INC.", "No"]] },
    { name: "Filters", matrix: [head, ["WF4FC5S", "", "Everpure Cartridge", "Equipment : Parts and Filters", "", "71.50", "40", "", "No"]] },
    { name: "Equipment", matrix: [head, ["Airpots", "", "Airpots", "Equipment : Equipment Sales", "", "", "195", "", "Yes"]] },
    { name: "Notes", matrix: [["Something else"], ["hello"]] },
  ]);
  assert.equal(r.rows.length, 3);
  assert.deepEqual(r.ignoredSheets, ["Notes"]);
  assert.equal(r.rows[0].sku, "EVER104120");
  assert.equal(r.rows[0].item, "EVER104120");
  assert.equal(r.rows[0].rate, 976.38);
  assert.equal(r.rows[0].cost, 386);
  assert.equal(r.rows[0].kind, "part");
  assert.equal(r.rows[2].kind, "equipment");
  assert.equal(r.rows[2].rate, null); // blank price stays unknown, not zero
  assert.equal(r.rows[2].active, false); // Inactive = Yes
  assert.equal(r.rows[0].active, true);
  assert.equal(r.columns.rate, true);
  assert.equal(r.columns.cls, true);
});

test("a price-only file says it has no description, class or cost", () => {
  const r = itemRowsFromSheets([{ name: "Prices", matrix: [["Name", "Base Price"], ["EVER104120", "$1,010.00"], ["WF4FC5S", "72"]] }]);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].rate, 1010);
  assert.equal(r.columns.rate, true);
  assert.equal(r.columns.description, false);
  assert.equal(r.columns.cls, false);
  assert.equal(r.columns.cost, false);
  assert.equal(r.rows[0].description, null);
});

test("the same SKU on two sheets is read once", () => {
  const r = itemRowsFromSheets([
    { name: "A", matrix: [["Name", "Base Price"], ["X1", "5"]] },
    { name: "B", matrix: [["Name", "Base Price"], ["x1", "6"], ["X2", "7"]] },
  ]);
  assert.deepEqual(r.rows.map((x) => [x.sku, x.rate]), [["X1", 5], ["X2", 7]]);
  assert.equal(r.skipped, 1);
});

test("price change: same is no change, big swings are flagged, a first price has no percent", () => {
  assert.equal(priceChange(10, 10), null);
  assert.equal(priceChange(10, null), null);
  assert.deepEqual(priceChange(10, 11), { from: 10, to: 11, pct: 10, check: false });
  assert.equal(priceChange(9.95, 995).check, true); // a misplaced decimal
  assert.equal(priceChange(100, 40).check, true);
  assert.equal(priceChange(null, 25).pct, null);
  assert.equal(priceChange(0, 25).pct, null); // no percent from zero
  assert.equal(priceChange(null, 25).check, false);
});

test("billing CSV carries the bare SKU next to the item name", () => {
  const csv = billingCsv([
    { wo: "WO-1", po: "", customer: "A", accountNumber: "", netsuiteId: "", technician: "", completed: "2026-10-01",
      item: "PARTS : EVER104120", description: "Pump", qty: 1, rate: 976.38, workDone: "" },
  ]);
  const [head, row] = csv.trim().split("\r\n");
  assert.match(head, /,Item,SKU,Description,/);
  assert.match(row, /,PARTS : EVER104120,EVER104120,Pump,/);
});
