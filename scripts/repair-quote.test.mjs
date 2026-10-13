import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUOTE_STATUSES,
  costGlance,
  isQuoteStatus,
  lineKind,
  quoteError,
  quoteForJob,
  quoteForRebuild,
  quoteLocked,
  quoteTotals,
} from "../src/lib/ops/repair-quote.ts";

test("a quote adds up parts and labor separately", () => {
  const lines = [
    { item: "Service : SERVICELABOR", qty: 2.5, rate: 150, kind: "labor" },
    { item: "PARTS : EVER104120", qty: 2, rate: 48.33, kind: "part" },
    { item: "EQUIPMENT : G9-2T", qty: 1, rate: 1200, kind: "equipment" },
  ];
  assert.deepEqual(quoteTotals(lines), { parts: 1296.66, labor: 375, total: 1671.66 });
  assert.deepEqual(quoteTotals([]), { parts: 0, labor: 0, total: 0 });
});

test("a line's kind comes from the item, the same way ticket charges read it", () => {
  assert.equal(lineKind("Service : SERVICELABOR"), "labor");
  assert.equal(lineKind("Service : TRIPCHARGE"), "trip");
  assert.equal(lineKind("PARTS : EVER104120"), "part");
  // A quoted trip counts with labor, not with parts.
  assert.deepEqual(quoteTotals([{ item: "Service : TRIPCHARGE", qty: 1, rate: 150, kind: "trip" }]), { parts: 0, labor: 150, total: 150 });
});

test("quote status", () => {
  assert.deepEqual([...QUOTE_STATUSES], ["Draft", "Sent", "Approved", "Declined"]);
  assert.equal(isQuoteStatus("Approved"), true);
  assert.equal(isQuoteStatus("approved"), false);
  assert.equal(quoteLocked("Draft"), false);
  assert.equal(quoteLocked("Sent"), false);
  assert.equal(quoteLocked("Approved"), true);
  assert.equal(quoteLocked("Declined"), true);
});

test("a bad line is named", () => {
  assert.equal(quoteError([{ item: "PARTS : A", qty: 1, rate: 10 }]), null);
  assert.match(quoteError([{ item: "PARTS : A", qty: 1, rate: 10 }, { item: "", qty: 1, rate: 1 }]), /^Line 2: Pick an item/);
  assert.match(quoteError([{ item: "PARTS : A", qty: 0, rate: 10 }]), /Quantity/);
});

const quotes = [
  { id: 1, jobId: 40, rebuildId: null },
  { id: 2, jobId: null, rebuildId: 7 },
  { id: 3, jobId: 55, rebuildId: 9 },
];

test("a rebuild linked to a ticket uses that ticket's quote: one sheet, not two", () => {
  // Rebuild 6 has no quote of its own and is linked to ticket 40.
  assert.equal(quoteForRebuild({ id: 6, jobId: 40 }, quotes).id, 1);
  // Its own quote wins when it has one.
  assert.equal(quoteForRebuild({ id: 7, jobId: 40 }, quotes).id, 2);
  assert.equal(quoteForRebuild({ id: 9, jobId: 55 }, quotes).id, 3);
  // Not linked and no quote: none.
  assert.equal(quoteForRebuild({ id: 6, jobId: null }, quotes), null);
});

test("a ticket linked to a rebuild project uses the project's quote", () => {
  assert.equal(quoteForJob(40, null, quotes).id, 1);
  assert.equal(quoteForJob(41, 7, quotes).id, 2);
  assert.equal(quoteForJob(41, null, quotes), null);
});

test("the rebuild row shows the total and the status", () => {
  assert.equal(costGlance(null), "No quote");
  assert.equal(costGlance({ parts: 890, labor: 350, total: 1240, status: "Approved", lines: 4 }), "$1,240.00 · Approved");
});

test("a typed line keeps the Part or Labor it was marked; a listed item keeps its own kind", async () => {
  const { quoteLineKind } = await import("../src/lib/ops/repair-quote.ts");
  assert.equal(quoteLineKind("Group head gasket", "part", null), "part");
  assert.equal(quoteLineKind("Descale and rebuild boiler", "labor", null), "labor");
  assert.equal(quoteLineKind("Some listed part", "labor", "part"), "part");
  assert.equal(quoteLineKind("Service : SERVICELABOR", null, null), "labor");
  assert.equal(quoteLineKind("Group head gasket", null, null), "part");
});
