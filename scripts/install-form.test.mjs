import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountIsNew,
  applySerialInPlace,
  dedupeMachineSerials,
  foldVisitUnits,
  groupFormRows,
  hasSerial,
  machinesBeforeSave,
  looksLikePlug,
  looksLikeVoltage,
  parseAccountSerialNotice,
  placePower,
  rollChecks,
  visitUnitForRow,
} from "../src/lib/ops/install-form.ts";

test("a visit unit with its own serial is added, and a second pass does not add it again", () => {
  const start = [
    { equipment: "Mazzer Super Jolly", serial: "2626066", powerVoltage: "" },
    { equipment: "Bunn G9-2T", serial: "G900046833", powerVoltage: "", plug: "120v" },
  ];
  const extras = [
    { model: "La Marzocco Linea PB 3 Group AV", serial: "PB001708", electrical: "220V" },
    { model: "Bunn ITCB-DV", serial: "ITCB138003", electrical: null },
  ];
  const once = foldVisitUnits(start, extras);
  assert.equal(once.added, 2);
  assert.equal(once.rows.length, 4);
  assert.equal(once.rows[2].powerVoltage, "220V");
  const twice = foldVisitUnits(once.rows, extras);
  assert.equal(twice.added, 0);
  assert.equal(twice.rows.length, 4);
});

test("a blank row of the same model takes the serial instead of a second row", () => {
  const folded = foldVisitUnits(
    [{ equipment: "Bunn ITCB-DV", serial: "", powerVoltage: "" }],
    [{ model: "Bunn ITCB-DV", serial: "ITCB138003", electrical: "220V" }],
  );
  assert.equal(folded.added, 0);
  assert.equal(folded.rows.length, 1);
  assert.equal(folded.rows[0].serial, "ITCB138003");
  assert.equal(folded.rows[0].powerVoltage, "220V");
});

test("voltage typed into the plug field moves, and a plug typed into voltage moves", () => {
  assert.equal(looksLikeVoltage("120v"), true);
  assert.equal(looksLikeVoltage("220V"), true);
  assert.equal(looksLikePlug("L6-30P"), true);
  assert.equal(looksLikePlug("120v"), false);
  const moved = placePower("", "120v");
  assert.equal(moved.moved, "voltage");
  assert.equal(moved.voltage, "120v");
  assert.equal(moved.plug, "");
  const plug = placePower("5-15P", "");
  assert.equal(plug.moved, "plug");
  assert.equal(plug.plug, "5-15P");
});

test("the form groups by model, uppercases, and never prints Not set", () => {
  const rows = groupFormRows([
    { model: "Bunn ITCB", serial: "ITCB138003", notes: "3oz portioned pack. 1 gallon", voltage: "220V", plug: "" },
    { model: "Bunn ITCB", serial: "", notes: "", voltage: "", plug: "" },
    { model: "Not set", serial: "undefined", notes: "Not set", voltage: "Not set", plug: "" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].equipment, "BUNN ITCB · SN ITCB138003");
  assert.equal(rows[0].notes, "3OZ PORTIONED PACK. 1 GALLON");
  assert.equal(rows[0].outlet, "220V");
});

test("typing a serial updates that row and a second click does not add one", () => {
  const rows = [
    { equipment: "La Marzocco Linea PB 3 Group AV", serial: "", powerVoltage: "220V" },
    { equipment: "Bunn ITCB-DV", serial: "ITCB138003", powerVoltage: "" },
  ];
  const typed = applySerialInPlace(rows, 0, "PB001708");
  assert.equal(typed.status, "updated");
  assert.equal(typed.rows.length, 2);
  assert.equal(typed.rows[0].serial, "PB001708");
  assert.equal(typed.rows[0].powerVoltage, "220V");
  const again = applySerialInPlace(typed.rows, 0, "PB001708");
  assert.equal(again.status, "already");
  assert.equal(again.rows.length, 2);
  const clash = applySerialInPlace(typed.rows, 0, "ITCB138003");
  assert.equal(clash.status, "duplicate");
  assert.equal(clash.rows[0].serial, "PB001708");
  assert.equal(hasSerial(typed.rows, "PB001708"), true);
  const deduped = dedupeMachineSerials([
    ...typed.rows,
    { equipment: "La Marzocco Linea PB 3 Group AV", serial: "PB001708", powerVoltage: "" },
  ]);
  assert.deepEqual(
    deduped.map((r) => r.serial),
    ["PB001708", "ITCB138003", ""],
  );
});

test("a machine added on the server is kept on save, and a row removed in the form stays removed", () => {
  const previous = [{ equipment: "Bunn ITCB", serial: "", powerVoltage: "" }];
  const editing = [{ equipment: "Bunn ITCB", serial: "ABC", powerVoltage: "" }];
  const server = [
    { equipment: "Bunn ITCB", serial: "", powerVoltage: "" },
    { equipment: "Eversys Enigma", serial: "EV1", powerVoltage: "220V" },
  ];
  const saved = machinesBeforeSave(editing, previous, server);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].serial, "ABC");
  assert.equal(saved[1].equipment, "Eversys Enigma");
  assert.equal(saved[1].serial, "EV1");
  assert.equal(machinesBeforeSave([], previous, previous).length, 0);
  const filled = machinesBeforeSave(previous, previous, [{ equipment: "Bunn ITCB", serial: "SN1", powerVoltage: "" }]);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].serial, "SN1");
});

const row = (equipment, serial = "", powerVoltage = "") => ({ equipment, serial, powerVoltage });
const shown = (rows) => rows.map((r) => r.equipment + (r.serial ? ` SN ${r.serial}` : ""));

test("a second machine of a model already on the install is kept, and a serial added with it stays on its own row", () => {
  const F = row("Fetco CBS-51H");
  assert.deepEqual(shown(machinesBeforeSave([F], [F], [F, F])), ["Fetco CBS-51H", "Fetco CBS-51H"]);
  assert.deepEqual(shown(machinesBeforeSave([F], [F], [F, row("Fetco CBS-51H", "FX100")])), ["Fetco CBS-51H", "Fetco CBS-51H SN FX100"]);
  // Install 54: two ITCBs added on the Pre-inspection tab, the window refreshed once after both or after each.
  const C = row("Eversys Cameo");
  const I = row("Bunn ITCB-DV");
  assert.equal(machinesBeforeSave([C], [C], [C, I, I]).length, 3);
  assert.equal(machinesBeforeSave(machinesBeforeSave([C], [C], [C, I]), [C, I], [C, I, I]).length, 3);
  // A row this window added and saved comes back from the server once, not twice.
  assert.equal(machinesBeforeSave([F, F], [F], [F, F]).length, 2);
});

test("a serial cleared in the window stays cleared, and only a serial new on the server fills a blank row", () => {
  const T = (serial) => row("Bunn TB3", serial);
  assert.deepEqual(shown(machinesBeforeSave([T("")], [T("W1")], [T("W1")])), ["Bunn TB3"]);
  // A warehouse assignment wrote this serial on the server since the window last looked.
  assert.deepEqual(shown(machinesBeforeSave([T("")], [T("")], [T("WH7")])), ["Bunn TB3 SN WH7"]);
});

test("a machine removed on the Pre-inspection tab leaves the window too, unless the window changed that row", () => {
  const T = row("Bunn TB3");
  const F = row("Fetco CBS-51H");
  assert.deepEqual(shown(machinesBeforeSave([T, F], [T, F], [T])), ["Bunn TB3"]);
  assert.deepEqual(shown(machinesBeforeSave([T, { ...F, powerVoltage: "120V" }], [T, F], [T])), ["Bunn TB3", "Fetco CBS-51H"]);
});

test("a serial repeated on a later row is cleared there, and that machine stays", () => {
  assert.deepEqual(shown(dedupeMachineSerials([row("Fetco CBS-51H", "S1"), row("Bunn TB3", "S1")])), ["Fetco CBS-51H SN S1", "Bunn TB3"]);
});

test("removing an equipment row takes a pre-inspection unit only when no other unit or row can be it", () => {
  const unit = (equipmentId, model, serial = null) => ({ equipmentId, model, name: model, serial });
  const units = [unit(1, "Bunn TB3"), unit(2, "Fetco CBS-51H"), unit(3, "Fetco CBS-51H"), unit(4, "Bunn G9-2T", "G9X")];
  const rows = [row("Bunn TB3"), row("Fetco CBS-51H"), row("Fetco CBS-51H"), row("Bunn G9-2T", "G9X")];
  assert.equal(visitUnitForRow(rows, 0, units)?.equipmentId, 1);
  assert.equal(visitUnitForRow(rows, 3, units)?.equipmentId, 4);
  assert.equal(visitUnitForRow(rows, 2, units), null);
  assert.equal(visitUnitForRow(rows.slice(1, 3), 1, [units[1]]), null);
});

test("when two units could be the removed row, the one with nothing recorded on it goes", () => {
  const unit = (equipmentId, overall, photoCount = 0, note = null) => ({ equipmentId, model: "Fetco CBS-51H", name: "Fetco CBS-51H", serial: null, overall, photoCount, note });
  const rows = [row("Fetco CBS-51H"), row("Fetco CBS-51H")];
  // The second unit (a pre-inspection add) holds the check and photo, whichever row is removed.
  for (const index of [0, 1]) assert.equal(visitUnitForRow(rows, index, [unit(1, "Not started"), unit(2, "Failed", 1)])?.equipmentId, 1);
  assert.equal(visitUnitForRow(rows, 0, [unit(1, "Failed", 1), unit(2, "Not started")])?.equipmentId, 2);
  // A note or a photo counts as recorded too. With nothing empty, the save's prune decides.
  assert.equal(visitUnitForRow(rows, 0, [unit(1, "Not started", 0, "Left of the sink"), unit(2, "Not started", 1)]), null);
});

test("two machines of one model with no serial are told apart by voltage and plug when the server's list changes", () => {
  const A = { equipment: "Fetco CBS-51H", serial: "", powerVoltage: "220V", plug: "6-20" };
  const B = { equipment: "Fetco CBS-51H", serial: "", powerVoltage: "120V", plug: "5-15" };
  // The 220V one was removed on the Pre-inspection tab: the 120V one stays.
  assert.deepEqual(machinesBeforeSave([A, B], [A, B], [B]), [B]);
  // Another tab wrote a serial on the 220V row: it lands on that row.
  assert.deepEqual(
    machinesBeforeSave([A, B], [A, B], [{ ...A, serial: "W220" }, B]).map((r) => [r.powerVoltage, r.serial]),
    [
      ["220V", "W220"],
      ["120V", ""],
    ],
  );
});

test("account type and the already-on-this-account notice", () => {
  assert.equal(accountIsNew(0, 0), true);
  assert.equal(accountIsNew(1, 0), false);
  assert.equal(accountIsNew(0, 2), false);
  assert.deepEqual(parseAccountSerialNotice("Serial ITCB138003 is already on this account · Bunn ITCB-DV"), {
    serial: "ITCB138003",
    model: "Bunn ITCB-DV",
  });
  assert.equal(parseAccountSerialNotice("Serial missing from the barn"), null);
  assert.equal(rollChecks(["Pass", "Pass"]), "YES");
  assert.equal(rollChecks(["Fail"]), "NO");
  assert.equal(rollChecks(["Pass", "Fail"]), "PENDING");
  assert.equal(rollChecks(["Not inspected"]), "");
});
