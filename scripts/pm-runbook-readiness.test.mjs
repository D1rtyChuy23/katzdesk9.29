import assert from "node:assert/strict";
import { test } from "node:test";
import { matchE4XWide } from "../src/lib/ops/pm-runbook.ts";
import { planUnits } from "../src/lib/ops/pm-runbook-units.ts";
import { buildReadiness, readinessCsv, readinessSummary } from "../src/lib/ops/pm-runbook-readiness.ts";

const match = (piece) => {
  const h = matchE4XWide(piece);
  return h ? { runbookId: "eversys-e4-xwide", model: h.model } : null;
};
const pm = (id, customer, equipment, status = "Pending Scheduling") => ({ id, customer, equipment, status });
const unit = (id, customer, model, serial, installDate) => ({
  id,
  customer,
  catalogModel: model,
  equipmentName: model,
  serial,
  installDate,
});

test("flags a line with no account unit, then missing serial, then missing install date", () => {
  const rows = buildReadiness(
    [
      pm(1, "Cafe Uno", "Eversys Enigma e'4m X-Wide Classic"),
      pm(2, "Cafe Dos", "Eversys Enigma e'4s X-Wide Classic"),
      pm(3, "Cafe Tres", "Eversys Enigma e'4m X-Wide Classic"),
      pm(4, "Cafe Cuatro", "Eversys Enigma e'4m X-Wide Classic"),
    ],
    [
      unit(10, "Cafe Dos", "Eversys Enigma e'4s X-Wide Classic", null, "2024-02-01"),
      unit(11, "Cafe Tres", "Eversys Enigma e'4m X-Wide Classic", "SN 9", null),
      unit(12, "Cafe Cuatro", "Eversys Enigma e'4m X-Wide Classic", "SN 10", "2023-05-05"),
    ],
    match,
  );
  assert.deepEqual(rows.map((r) => r.gaps), [["no-account-unit"], ["no-serial"], ["no-install-date"], []]);
  const s = readinessSummary(rows);
  assert.deepEqual(s, { units: 4, ready: 1, noAccountUnit: 1, noSerial: 1, noInstallDate: 1 });
});

test("lines the runbook does not cover are left out", () => {
  const rows = buildReadiness([pm(1, "Cafe Uno", "La Marzocco GB5\nEversys Cameo C'2MS")], [], match);
  assert.equal(rows.length, 0);
});

test("a PM with two X-Wide lines gives two rows, each matched to its own unit", () => {
  const rows = buildReadiness(
    [pm(1, "Cafe Uno", "e'4m X-Wide\ne'4m X-Wide")],
    [unit(1, "Cafe Uno", "e'4m X-Wide", "A1", "2024-01-01"), unit(2, "Cafe Uno", "e'4m X-Wide", null, null)],
    match,
  );
  assert.deepEqual(rows.map((r) => r.accountId), [1, 2]);
  assert.deepEqual(rows[1].gaps, ["no-serial", "no-install-date"]);
});

test("csv lists only lines with gaps and escapes quotes", () => {
  const rows = buildReadiness([pm(7, 'Cafe "Uno"', "e'4m X-Wide")], [], match);
  const csv = readinessCsv(rows);
  assert.match(csv, /^"PM","Customer","Status","Equipment line","Missing"\n"7","Cafe ""Uno""",/);
  assert.equal(readinessCsv([]).split("\n").length, 1);
});

test("a pin attaches the named account unit even when the text would match a different one", () => {
  const equipment = "e'4s X-Wide";
  const pieceKey = planUnits(equipment, [], match)[0].pieceKey;
  const units = [
    unit(1, "Cafe Uno", "e'4s X-Wide", "SN 100", "2024-01-01"),
    unit(2, "Cafe Uno", "La Marzocco GB5", "SN 200", null),
  ];
  assert.equal(buildReadiness([pm(1, "Cafe Uno", equipment)], units, match)[0].accountId, 1);
  const pinned = buildReadiness([pm(1, "Cafe Uno", equipment)], units, match, { 1: { [pieceKey]: 2 } });
  assert.equal(pinned[0].accountId, 2);
  assert.equal(pinned[0].serial, "SN 200");
});

test("an earlier PM matches a pinned unit the equipment text would miss", () => {
  const equipment = "e'4s X-Wide";
  const pieceKey = planUnits(equipment, [], match)[0].pieceKey;
  const rows = [
    { id: 1, catalogModel: "e'4s X-Wide", equipmentName: "e'4s X-Wide", serial: "SN 100" },
    { id: 2, catalogModel: "La Marzocco GB5", equipmentName: "La Marzocco GB5", serial: "SN 200" },
  ];
  const pinned = planUnits(equipment, rows, match, { [pieceKey]: 2 });
  assert.equal(pinned.find((u) => u.unitKey === "acct:2")?.accountId, 2);
  assert.equal(planUnits(equipment, rows, match).some((u) => u.unitKey === "acct:2"), false);
});
