import assert from "node:assert/strict";
import { test } from "node:test";
import { planMachines, partsLockReason } from "../src/lib/ops/pm-machines.ts";
import { planUnits, pmCompletionRefusal } from "../src/lib/ops/pm-runbook-units.ts";
import { matchFaemaX20 } from "../src/lib/ops/runbooks/faema-bravilor-match.ts";
import { matchLmLinea } from "../src/lib/ops/runbooks/la-marzocco-match.ts";

function match(piece) {
  const lm = matchLmLinea(piece);
  if (lm) return { runbookId: "la-marzocco-linea", model: lm.model };
  const fx = matchFaemaX20(piece);
  if (fx) return { runbookId: "faema-x20", model: fx.model };
  if (/e4/i.test(String(piece ?? ""))) return { runbookId: "eversys-cameo", model: null };
  return null;
}

const row = (id, catalogModel, equipmentName, serial = null) => ({ id, catalogModel, equipmentName, serial, installDate: null });

test("Linea PB + Swift is two machines, and Swift has no runbook", () => {
  const machines = planMachines("Linea PB + Swift", [], match);
  assert.equal(machines.length, 2);
  assert.equal(machines[0].pieceKey, "piece:linea pb#1");
  assert.equal(machines[0].runbookId, "la-marzocco-linea");
  assert.equal(machines[0].key, "piece:linea pb#1");
  assert.equal(machines[1].pieceKey, "piece:swift#1");
  assert.equal(machines[1].runbookId, null);
  assert.equal(machines[1].unitKey, null);
});

test("Faema X20 is one machine with the Faema runbook", () => {
  const machines = planMachines("Faema X20", [], match);
  assert.equal(machines.length, 1);
  assert.equal(machines[0].runbookId, "faema-x20");
  assert.equal(machines[0].pieceKey, "piece:faema x20#1");
});

test("machines stay in equipment-text order", () => {
  const machines = planMachines("Mazzer Robur\nLinea PB", [], match);
  assert.deepEqual(machines.map((m) => m.piece), ["Mazzer Robur", "Linea PB"]);
  assert.equal(machines[0].runbookId, null);
  assert.equal(machines[1].runbookId, "la-marzocco-linea");
});

test("the runbook machines equal planUnits, including a pin and a loose E4X-WIDE", () => {
  const cases = [
    ["Linea PB\nLinea PB", [], null],
    ["Linea PB", [row(4, "Widget", "Widget", "ABC")], { "piece:linea pb#1": 4 }],
    ["E4X-WIDE", [row(7, "Cameo", "Eversys Cameo", "SN1")], null],
  ];
  for (const [equipment, rows, pinned] of cases) {
    const units = planUnits(equipment, rows, match, pinned);
    const machines = planMachines(equipment, rows, match, pinned).filter((m) => m.runbookId);
    assert.deepEqual(
      machines.map((m) => [m.pieceKey, m.key, m.accountId, m.runbookId]),
      units.map((u) => [u.pieceKey, u.unitKey, u.accountId, u.runbookId]),
    );
  }
});

test("Swift never takes the Linea PB account row", () => {
  const machines = planMachines("Swift\nLinea PB", [row(9, "Linea PB", "Linea PB", "S9")], match);
  assert.equal(machines[0].pieceKey, "piece:swift#1");
  assert.equal(machines[0].accountId, null);
  assert.equal(machines[0].runbookId, null);
  assert.equal(machines[1].key, "acct:9");
  assert.equal(machines[1].runbookId, "la-marzocco-linea");
});

test("a no-runbook line that is pinned gets that account row", () => {
  const machines = planMachines("Swift", [row(3, "Widget", "Widget", "SW1")], match, { "piece:swift#1": 3 });
  assert.equal(machines.length, 1);
  assert.equal(machines[0].accountId, 3);
  assert.equal(machines[0].key, "acct:3");
  assert.equal(machines[0].runbookId, null);
  assert.equal(machines[0].serial, "SW1");
});

test("an unlogged Swift never blocks completion", () => {
  assert.equal(pmCompletionRefusal(planUnits("Swift", [], match)), null);
  const withLinea = planUnits("Linea PB + Swift", [], match);
  assert.deepEqual(withLinea.map((u) => u.piece), ["Linea PB"]);
  assert.match(pmCompletionRefusal(withLinea), /Linea PB/);
  assert.equal(pmCompletionRefusal([]), null);
});

test("parts lock only for a cancelled PM, a billed stacked ticket, or the PM's own invoice", () => {
  const open = { pmId: 32, status: "Completed", stackedJobId: null, ticketSo: null, pmInvoiceHasLines: false };
  assert.equal(partsLockReason(open), null);
  assert.equal(partsLockReason({ ...open, status: "Cancelled" }), "PM #32 is cancelled.");
  assert.equal(
    partsLockReason({ ...open, status: "Awaiting Parts", stackedJobId: 523, ticketSo: "SO4401" }),
    "Ticket #523 is billed (SO4401). Clear its Sales Order to change this PM's parts.",
  );
  assert.equal(
    partsLockReason({ ...open, pmInvoiceHasLines: true }),
    "PM #32 has its own approved invoice, so its parts can't change.",
  );
  assert.equal(partsLockReason({ ...open, stackedJobId: 523, ticketSo: "  " }), null);
});
