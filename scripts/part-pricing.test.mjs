import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanRule,
  discountShares,
  lineProfit,
  mpnKey,
  partRowsFromSheets,
  planPartImport,
  planPricing,
  priceRowsFromSheets,
  pricingToApply,
  profitByMpn,
  ruleLabel,
  unitCost,
} from "../src/lib/ops/part-pricing.ts";

const stored = [
  { id: 1, sku: "EVER104120", item: "PARTS : EVER104120", mpn: "104120", description: "Gasket", rate: 12, cost: 5, listPrice: 10 },
  { id: 2, sku: "EVER2000", item: "PARTS : EVER2000", mpn: "2000-A", description: "Valve", rate: 80, cost: null, listPrice: null },
  { id: 3, sku: "DUP1", item: "DUP1", mpn: "X-9", description: "", rate: 1, cost: null, listPrice: null },
  { id: 4, sku: "DUP2", item: "DUP2", mpn: "x9", description: "", rate: 1, cost: null, listPrice: null },
  { id: 5, sku: "NOMPN", item: "NOMPN", mpn: null, description: "", rate: 1, cost: null, listPrice: null },
];

test("MPN match ignores case, spaces and dashes", () => {
  assert.equal(mpnKey(" 2000 a "), "2000A");
  assert.equal(mpnKey("x-9"), mpnKey("X9"));
});

test("parts file: MPN required, the same MPN twice keeps the first", () => {
  const r = partRowsFromSheets([{ name: "Items", matrix: [
    ["Name", "MPN", "Description", "Base Price", "Purchase Price"],
    ["PARTS : EVER104120", "104120", "Gasket kit", "14.00", "6"],
    ["PARTS : EVERNEW", "NEW-1", "New part", "$20", ""],
    ["PARTS : EVERNEW2", "new 1", "Same MPN again", "21", ""],
    ["PARTS : NOMPN", "", "No MPN", "1", ""],
  ] }]);
  assert.equal(r.rows.length, 2);
  assert.equal(r.duplicates, 1);
  assert.equal(r.skipped, 1);
  assert.deepEqual([r.rows[0].sku, r.rows[0].parent, r.rows[0].rate, r.rows[0].cost], ["EVER104120", "PARTS", 14, 6]);
  // No MPN column: Name is the part number (NetSuite item export). Neither column: refused.
  assert.equal(partRowsFromSheets([{ name: "S", matrix: [["Name", "Price"], ["A-1", "1"]] }]).rows[0].mpn, "A-1");
  assert.throws(() => partRowsFromSheets([{ name: "S", matrix: [["Item Description", "Price"], ["A", "1"]] }]), /MPN or Name column/);
});

test("parts plan: existing MPN updates, new MPN adds, never a second part for one MPN", () => {
  const rows = [
    { line: 2, sheet: "S", mpn: "104120", sku: "EVER104120", parent: "PARTS", description: "Gasket kit", rate: 14, cost: null, kind: "part" },
    { line: 3, sheet: "S", mpn: "NEW-1", sku: "EVERNEW", parent: "PARTS", description: "New", rate: 20, cost: null, kind: "part" },
    { line: 4, sheet: "S", mpn: "X9", sku: "Z", parent: null, description: null, rate: null, cost: null, kind: "part" },
    { line: 5, sheet: "S", mpn: "NEW-2", sku: "NOMPN", parent: null, description: null, rate: null, cost: null, kind: "part" },
    { line: 6, sheet: "S", mpn: "2000-A", sku: null, parent: null, description: null, rate: null, cost: null, kind: "part" },
  ];
  const plan = planPartImport(rows, stored);
  assert.deepEqual(plan.map((p) => p.status), ["update", "new", "shared_mpn", "sku_taken", "same"]);
  assert.equal(plan[0].partId, 1);
  assert.deepEqual(plan[0].changes, ["Description → Gasket kit", "Base Price $12.00 → $14.00"]);
});

test("hidden parts are skipped by the parts import and the price import", () => {
  const hidden = stored.map((p, i) => (i === 0 ? { ...p, hidden: true } : p));
  const rows = [
    { line: 2, sheet: "S", mpn: "104120", sku: "EVER104120", parent: "PARTS", description: "Gasket kit", rate: 14, cost: null, kind: "part" },
    { line: 3, sheet: "S", mpn: "NEW-9", sku: "EVER104120", parent: null, description: null, rate: null, cost: null, kind: "part" },
  ];
  const plan = planPartImport(rows, hidden);
  assert.deepEqual(plan.map((p) => p.status), ["hidden", "hidden"]);
  const prices = planPricing([{ line: 2, sheet: "S", mpn: "104120", price: 20 }], hidden, "list");
  assert.equal(prices[0].status, "hidden");
  assert.deepEqual(pricingToApply(prices), []);
});

test("price file: MPN and price, New Price wins, bad rows skipped", () => {
  const r = priceRowsFromSheets([{ name: "2027", matrix: [
    ["MPN", "Old Price", "New Price"],
    ["104120", "10", "11.50"],
    ["NOPE-1", "1", "2"],
    ["2000-A", "", "abc"],
  ] }]);
  assert.deepEqual(r.rows.map((x) => [x.mpn, x.price]), [["104120", 11.5], ["NOPE-1", 2]]);
  assert.equal(r.skipped, 1);
});

test("pricing plan: old and new, No Match stays in the preview and is never applied", () => {
  const rows = [
    { line: 2, sheet: "S", mpn: "104120", price: 11.5 },
    { line: 3, sheet: "S", mpn: "NOPE-1", price: 2 },
    { line: 4, sheet: "S", mpn: "x-9", price: 3 },
    { line: 5, sheet: "S", mpn: "2000a", price: 80 },
  ];
  const list = planPricing(rows, stored, "list");
  assert.deepEqual(list.map((l) => l.status), ["change", "no_match", "shared_mpn", "change"]);
  assert.deepEqual([list[0].oldPrice, list[0].newPrice, list[0].pct], [10, 11.5, 15]);
  const sell = planPricing(rows, stored, "sell");
  assert.equal(sell[3].status, "same");
  assert.deepEqual(pricingToApply(list).map((l) => l.partId), [1, 2]);
});

test("discount rule: percent or fixed off the manufacturer price", () => {
  assert.deepEqual(cleanRule({ mode: "percent", value: "35%" }), { rule: { mode: "percent", value: 35, note: undefined } });
  assert.ok("error" in cleanRule({ mode: "percent", value: 120 }));
  assert.deepEqual(cleanRule({ mode: "fixed", value: "" }), { rule: null });
  assert.equal(ruleLabel({ mode: "percent", value: 35 }), "35% off manufacturer price");
  assert.deepEqual(unitCost({ listPrice: 100, cost: 70 }, { mode: "percent", value: 35 }), { cost: 65, ourDiscount: 35, source: "rule" });
  assert.deepEqual(unitCost({ listPrice: 100, cost: 70 }, { mode: "fixed", value: 12.5 }), { cost: 87.5, ourDiscount: 12.5, source: "rule" });
  assert.deepEqual(unitCost({ listPrice: null, cost: 70 }, { mode: "percent", value: 35 }), { cost: 70, ourDiscount: null, source: "purchase" });
  assert.equal(unitCost({ listPrice: null, cost: null }, null).source, "none");
});

test("line profit: cost, sell, discount and margin, with the ticket discount taken off", () => {
  const p = lineProfit({ qty: 2, rate: 120 }, { listPrice: 100, cost: null }, { mode: "percent", value: 35 }, 24);
  assert.deepEqual([p.cost, p.sell, p.ourDiscount, p.ticketDiscount, p.margin, p.marginPct], [130, 240, 70, 24, 86, 39.81]);
  assert.equal(lineProfit({ qty: 1, rate: 10 }, { listPrice: null, cost: null }, null).margin, null);
});

test("ticket discount shares add back to the discount exactly", () => {
  const s = discountShares([150, 300, 33.33], 48.33);
  assert.equal(Math.round(s.reduce((a, b) => a + b, 0) * 100), 4833);
  assert.deepEqual(discountShares([10, 20], 0), [0, 0]);
});

test("parts profit per MPN", () => {
  const rows = profitByMpn([
    { mpn: "104120", sku: "EVER104120", description: "Gasket", qty: 2, cost: 13, sell: 24, ourDiscount: 7, ticketDiscount: 0, margin: 11 },
    { mpn: "104-120", sku: "EVER104120", description: "Gasket", qty: 1, cost: 6.5, sell: 12, ourDiscount: 3.5, ticketDiscount: 1.2, margin: 4.3 },
    { mpn: "2000-A", sku: "EVER2000", description: "Valve", qty: 1, cost: null, sell: 80, ourDiscount: null, ticketDiscount: 0, margin: null },
  ]);
  assert.deepEqual(rows.map((r) => [r.mpn, r.qty, r.cost, r.sell, r.margin, r.marginPct, r.noCost]), [
    ["104120", 3, 19.5, 36, 15.3, 43.97, 0],
    ["2000-A", 1, 0, 80, 0, null, 1],
  ]);
});

test("NetSuite item export: Name is the part number, Description the part name, Class and Inactive kept", () => {
  const r = partRowsFromSheets([
    { name: "Parts", matrix: [
      ["Name", "Display Name", "Description", "Class", "SubType", "Base Price", "Purchase Price", "Preferred Vendor", "Inactive"],
      ["016-246-6102", "", "246 Series AC PSC 115V/230V (Roaster Gear Motor)", "Equipment : Parts and Filters", "", "696.96", "576.99", "", "No"],
      ["BUNN32400.0003", "", "BUNN TIMER KIT, DGTL-240V", "Equipment : Parts and Filters", "", "120", "80", "BUNN", "Yes"],
    ] },
    { name: "Equipment", matrix: [
      ["Name", "Display Name", "Description", "Class", "SubType", "Base Price", "Purchase Price", "Preferred Vendor", "Inactive"],
      ["AIRPOT2.4LS/SLINER", "", "Airpot 2.4 Liters - w/Stainless Steel Liner", "Equipment : Equipment Sales", "", "52.95", "35.35", "Service Ideas", "No"],
      ["016-246-6102", "", "Same part number again", "Equipment : Parts and Filters", "", "1", "1", "", "No"],
    ] },
  ]);
  assert.equal(r.nameIsMpn, true);
  assert.equal(r.duplicates, 1);
  assert.deepEqual(r.rows.map((x) => [x.mpn, x.sku, x.description, x.cls, x.active, x.kind]), [
    ["016-246-6102", "016-246-6102", "246 Series AC PSC 115V/230V (Roaster Gear Motor)", "Equipment : Parts and Filters", true, "part"],
    ["BUNN32400.0003", "BUNN32400.0003", "BUNN TIMER KIT, DGTL-240V", "Equipment : Parts and Filters", false, "part"],
    ["AIRPOT2.4LS/SLINER", "AIRPOT2.4LS/SLINER", "Airpot 2.4 Liters - w/Stainless Steel Liner", "Equipment : Equipment Sales", true, "equipment"],
  ]);
});

test("a part loaded earlier by its SKU alone is the same part: updated, never added twice", () => {
  const rows = partRowsFromSheets([{ name: "Parts", matrix: [
    ["Name", "Description", "Class", "Base Price"],
    ["BUNN32400.0003", "BUNN TIMER KIT, DGTL-240V", "Equipment : Parts and Filters", "120"],
    ["FETCO52018", "FETCO RELAY", "Equipment : Parts and Filters", "40"],
  ] }]).rows;
  const plan = planPartImport(rows, [
    { id: 9, sku: "BUNN32400.0003", item: "BUNN32400.0003", mpn: null, description: "Timer", rate: 100, cost: null, listPrice: null, itemClass: null, active: true },
    { id: 10, sku: "FETCO52018", item: "FETCO52018", mpn: "52018", description: "Relay", rate: 40, cost: null, listPrice: null, itemClass: null, active: true },
  ]);
  assert.equal(plan[0].status, "update");
  assert.equal(plan[0].partId, 9);
  assert.ok(plan[0].changes.includes("Class → Equipment : Parts and Filters"));
  assert.ok(plan[0].changes.includes("MPN written BUNN32400.0003"));
  // FETCO52018 as a part number differs from the stored MPN 52018, and its SKU belongs to that part: not added twice.
  assert.equal(plan[1].status, "sku_taken");
});
