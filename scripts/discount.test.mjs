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

// Chosen lines (Chuy, 11/7): one discount, taken off only the lines picked for it.
const D = await import("../src/lib/ops/discount.ts");
const A = { qty: 2, rate: 45, discountChosen: true };
const B = { qty: 1.5, rate: 150, discountChosen: false };
const pct = { kind: "percent", value: 10, scope: "chosen" };

test("a chosen-lines discount comes off the ticked lines only (11/7)", () => {
  assert.deepEqual(D.billTotals([A, B], pct), { subtotal: 315, off: 9, total: 306 });
  assert.deepEqual(D.billTotals([A, B], { kind: "amount", value: 100, scope: "chosen" }), { subtotal: 315, off: 90, total: 225 });
  assert.deepEqual(D.billTotals([A, B], { kind: "percent", value: 10 }), { subtotal: 315, off: 31.5, total: 283.5 });
  // Nothing ticked: nothing comes off, and it can't be saved that way.
  const none = [{ ...A, discountChosen: false }, B];
  assert.equal(D.billTotals(none, pct).off, 0);
  assert.equal(D.chosenDiscountError(none, pct), "Tick the lines the discount comes off, or make it Whole bill.");
  assert.equal(D.chosenDiscountError([], pct), null);
  assert.equal(D.chosenDiscountError(none, { kind: "percent", value: 10 }), null);
  // The base is what the lines that take it add up to, and never more than the subtotal.
  assert.equal(D.applyDiscount(315, pct, 90).off, 9);
  assert.equal(D.applyDiscount(315, pct, 400).off, 31.5);
  assert.equal(D.applyDiscount(315, { kind: "percent", value: 10 }).total, 283.5);
  assert.equal(D.takesDiscount(B, { kind: "percent", value: 10 }), true);
  assert.equal(D.takesDiscount(B, pct), false);
  assert.equal(D.takesDiscount(A, null), false);
  assert.equal(D.discountOffLabel({ kind: "percent", value: 10 }, [A, B]), "10% off");
  assert.equal(D.discountOffLabel(pct, [A, B]), "10% off 1 of 2 lines");
  assert.equal(D.discountOffLabel({ kind: "amount", value: 20, scope: "chosen" }, [A]), "$20.00 off 1 of 1 line");
  assert.equal(D.discountOffLabel(null, [A]), "");
});

test("typed and stored discounts say Whole bill or Chosen lines (11/7)", () => {
  assert.deepEqual(D.cleanDiscount("percent", "10", "chosen"), { discount: { kind: "percent", value: 10, scope: "chosen" } });
  assert.deepEqual(D.cleanDiscount("percent", "10", "all"), { discount: { kind: "percent", value: 10 } });
  assert.deepEqual(D.cleanDiscount("percent", "10", "bogus"), { error: "Pick Whole bill or Chosen lines." });
  assert.deepEqual(D.cleanDiscount("percent", "", "chosen"), { discount: null });
  assert.deepEqual(D.discountFromRow("percent", "10.00", "chosen"), { kind: "percent", value: 10, scope: "chosen" });
  assert.deepEqual(D.discountFromRow("amount", "5", "all"), { kind: "amount", value: 5 });
  assert.equal(D.discountFromRow(null, null, "chosen"), null);
  assert.equal(D.discountFromRow("percent", "0", "all"), null);
  // The same base in SQL: the lines that take it, each rounded to the cent.
  assert.equal(D.DISCOUNT_BASE_SQL("c", "j.discount_scope"), "coalesce(sum(round(c.qty * c.rate, 2)) filter (where j.discount_scope = 'all' or c.discount_chosen), 0)");
});

test("billing rows: a chosen-lines ticket's header discount is the dollars off its ticked lines (11/7)", () => {
  const rows = D.withHeaderDiscount([{ jobId: 1, ...A }, { jobId: 1, ...B }], new Map([[1, pct]]));
  assert.deepEqual(rows.map((r) => [r.discountItem, r.discountRate, r.discountLabel]), [
    ["CLDSERVICE", "-9.00", "10% off"],
    ["CLDSERVICE", "-9.00", "10% off"],
  ]);
});
