import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDiscount, cleanDiscount, discountLabel } from "../src/lib/ops/discount.ts";

test("percent discount: original, off and new total", () => {
  assert.deepEqual(applyDiscount(450, { kind: "percent", value: 10 }), { subtotal: 450, off: 45, total: 405 });
  assert.deepEqual(applyDiscount(333.33, { kind: "percent", value: 15 }), { subtotal: 333.33, off: 50, total: 283.33 });
});

test("amount discount never takes the total below zero", () => {
  assert.deepEqual(applyDiscount(100, { kind: "amount", value: 25 }), { subtotal: 100, off: 25, total: 75 });
  assert.deepEqual(applyDiscount(100, { kind: "amount", value: 250 }), { subtotal: 100, off: 100, total: 0 });
});

test("no discount leaves the total alone", () => {
  assert.deepEqual(applyDiscount(80, null), { subtotal: 80, off: 0, total: 80 });
});

test("the discount is taken off the subtotal once: re-reading a saved ticket gives the same total", () => {
  const d = { kind: "percent", value: 10 };
  const once = applyDiscount(200, d);
  // Opening and saving the ticket again works from the lines, never from the discounted total.
  const again = applyDiscount(once.subtotal, d);
  assert.deepEqual(again, once);
  assert.notEqual(applyDiscount(once.total, d).total, once.total);
});

test("typed values: blank or zero is no discount; bad values say why", () => {
  assert.deepEqual(cleanDiscount("percent", ""), { discount: null });
  assert.deepEqual(cleanDiscount("amount", "0"), { discount: null });
  assert.deepEqual(cleanDiscount("percent", "10%"), { discount: { kind: "percent", value: 10 } });
  assert.deepEqual(cleanDiscount("amount", "$1,250.50"), { discount: { kind: "amount", value: 1250.5 } });
  assert.ok("error" in cleanDiscount("percent", "120"));
  assert.ok("error" in cleanDiscount("amount", "abc"));
  assert.ok("error" in cleanDiscount("other", "5"));
});

test("labels", () => {
  assert.equal(discountLabel({ kind: "percent", value: 12.5 }), "12.5% off");
  assert.equal(discountLabel({ kind: "amount", value: 25 }), "$25.00 off");
  assert.equal(discountLabel(null), "");
});

test("billing rows: the discount is NetSuite's header discount on every row of its ticket, never a discount line", async () => {
  const { withHeaderDiscount } = await import("../src/lib/ops/discount.ts");
  const rows = [
    { jobId: 1, item: "Service : TRIPCHARGE", description: "", qty: 1, rate: 150 },
    { jobId: 1, item: "Service : SERVICELABOR", description: "", qty: 2, rate: 150 },
    { jobId: 2, item: "Service : TRIPCHARGE", description: "", qty: 1, rate: 150 },
  ];
  const out = withHeaderDiscount(rows, new Map([[1, { kind: "percent", value: 10 }]]));
  assert.deepEqual(out.map((r) => [r.jobId, r.item, r.rate, r.discountItem, r.discountRate]), [
    [1, "Service : TRIPCHARGE", 150, "CLDSERVICE", "-45.00"],
    [1, "Service : SERVICELABOR", 150, "CLDSERVICE", "-45.00"],
    [2, "Service : TRIPCHARGE", 150, "", ""],
  ]);
});
