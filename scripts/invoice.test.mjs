import { test } from "node:test";
import assert from "node:assert/strict";
import { billToGaps, invoiceError, invoiceTotals, isInvoiceTarget, targetTitle, usesTicketCharges } from "../src/lib/ops/invoice.ts";
import { applyDiscount } from "../src/lib/ops/discount.ts";
import { chargesTotal } from "../src/lib/ops/charges.ts";

const lines = [
  { item: "Service : TRIPCHARGE", qty: 1, rate: 150, kind: "trip" },
  { item: "Service : SERVICELABOR", qty: 2, rate: 150, kind: "labor" },
  { item: "PARTS : EVER104120", qty: 2, rate: 24, kind: "part" },
];

test("totals: parts and labor apart, then the same discount math as ticket charges", () => {
  const t = invoiceTotals(lines, { kind: "percent", value: 10 });
  assert.deepEqual(t, { parts: 48, labor: 450, subtotal: 498, off: 49.8, total: 448.2 });
  // Nothing new: subtotal, discount and total are exactly what the Charges panel computes.
  const same = applyDiscount(chargesTotal(lines), { kind: "percent", value: 10 });
  assert.deepEqual([t.subtotal, t.off, t.total], [same.subtotal, same.off, same.total]);
  assert.deepEqual(invoiceTotals(lines, { kind: "amount", value: 600 }).total, 0);
  assert.deepEqual(invoiceTotals([], null), { parts: 0, labor: 0, subtotal: 0, off: 0, total: 0 });
});

test("lines are checked like ticket charges", () => {
  assert.equal(invoiceError(lines), null);
  assert.equal(invoiceError([{ item: "X", qty: "0", rate: 1 }]), "Line 1: Quantity must be more than zero.");
  assert.equal(invoiceError([{ item: "", qty: 1, rate: 1 }]), "Line 1: Pick an item.");
});

test("which records, and where their lines live", () => {
  assert.ok(isInvoiceTarget("install") && isInvoiceTarget("rebuild") && !isInvoiceTarget("module"));
  assert.ok(usesTicketCharges("service") && usesTicketCharges("tlc"));
  assert.ok(!usesTicketCharges("install") && !usesTicketCharges("pm"));
});

test("billing info gaps are named, the customer is never asked for", () => {
  assert.deepEqual(billToGaps({ name: "Mod Coffeehouse", accountNumber: "C-1", address: "1 Main", rep: "Lance Oden", netsuiteId: "77", onList: true }), []);
  assert.deepEqual(billToGaps({ name: "New Cafe", accountNumber: null, address: null, rep: null, netsuiteId: null, onList: false }), [
    "This customer is not on the customer list",
    "No account number",
    "No address",
    "No rep",
  ]);
});

test("record titles", () => {
  assert.equal(targetTitle("service", { id: 1, wo: "WO-9880" }), "Service Ticket WO-9880");
  assert.equal(targetTitle("tlc", { id: 2, wo: "", callId: "TLC-1" }), "TLC Ticket TLC-1");
  assert.equal(targetTitle("install", { id: 45 }), "Install #45");
  assert.equal(targetTitle("rebuild", { id: 3, title: "Linea past target" }), "Rebuild: Linea past target");
  assert.equal(targetTitle("pm", { id: 9, wo: "1234" }), "PM WO 1234");
});
