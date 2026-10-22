import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountIsNew,
  applySerialInPlace,
  dedupeMachineSerials,
  foldVisitUnits,
  formDate,
  groupFormRows,
  hasSerial,
  machinesBeforeSave,
  looksLikePlug,
  looksLikeVoltage,
  parseAccountSerialNotice,
  placePower,
  preInstallNotes,
  recipeNote,
  rollChecks,
  visitUnitForRow,
} from "../src/lib/ops/install-form.ts";
import { plugFaceCode, plugImageSrc } from "../src/lib/ops/plug-faces.ts";

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

test("the form groups by model, uppercases the model and serial, keeps notes as typed, and never prints Not set", () => {
  const rows = groupFormRows([
    { model: "Bunn ITCB", serial: "ITCB138003", notes: "3oz portioned pack. 1 gallon", voltage: "220V", plug: "" },
    { model: "Bunn ITCB", serial: "", notes: "", voltage: "", plug: "" },
    { model: "Not set", serial: "undefined", notes: "Not set", voltage: "Not set", plug: "" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].equipment, "BUNN ITCB");
  assert.deepEqual(rows[0].serials, ["ITCB138003"]);
  assert.deepEqual(rows[0].notes, [{ title: "", text: "3oz portioned pack. 1 gallon" }]);
  assert.equal(rows[0].outlet, "220V");
  assert.equal(rows[0].terms, "");
  assert.deepEqual(rows[0].plugs, []);
});

test("terms print as Sold, Loan or Lease, and units of one model on different terms are separate rows", () => {
  const unit = (serial, ownership) => ({ model: "Bunn ITCB", serial, notes: "", voltage: "220V", plug: "", ownership });
  const rows = groupFormRows([unit("A1", "Sold"), unit("B2", "Loaned"), unit("C3", "Loaned"), unit("D4", "Leased"), unit("E5", undefined), unit("F6", "Owned")]);
  assert.deepEqual(
    rows.map((r) => [r.equipment, r.serials.join(","), r.qty, r.terms]),
    [
      ["BUNN ITCB", "A1", 1, "Sold"],
      ["BUNN ITCB", "B2,C3", 2, "Loan"],
      ["BUNN ITCB", "D4", 1, "Lease"],
      ["BUNN ITCB", "E5,F6", 2, ""],
    ],
  );
});

test("a plug picture is found however the plug was typed, and only for codes we have a picture of", () => {
  assert.equal(plugFaceCode("NEMA 5-15P"), "5-15");
  assert.equal(plugFaceCode("5-15"), "5-15");
  assert.equal(plugFaceCode("l6 20p"), "L6-20");
  assert.equal(plugFaceCode("L6-30R"), "L6-30");
  assert.equal(plugFaceCode("L1430"), "L14-30");
  assert.equal(plugFaceCode("NEMA L6-30 twist-lock"), "L6-30");
  assert.equal(plugFaceCode("Hardwired"), null);
  assert.equal(plugFaceCode("120V"), null);
  assert.equal(plugFaceCode("15-20P"), null);
  assert.equal(plugFaceCode(""), null);
  assert.equal(plugImageSrc("L6-30"), "/nema/L6-30P.png");
  const rows = groupFormRows([
    { model: "Fetco CBS-51H", serial: "F1", notes: "", voltage: "120V", plug: "5-15P" },
    { model: "Fetco CBS-51H", serial: "F2", notes: "", voltage: "220V", plug: "L6-30P" },
    { model: "Fetco CBS-51H", serial: "F3", notes: "", voltage: "", plug: "nema 5-15p" },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].plugs, ["5-15", "L6-30"]);
  assert.equal(rows[0].outlet, "120V · 5-15P / 220V · L6-30P / NEMA 5-15P");
  // A voltage typed into the plug box is a voltage: no picture.
  assert.deepEqual(groupFormRows([{ model: "Bunn TB3", serial: "", notes: "", voltage: "", plug: "120v" }])[0].plugs, []);
});

test("a recipe prints its name, each setting as Label: value, then its own notes", () => {
  assert.deepEqual(
    recipeNote({
      name: "Espresso",
      coffee1: "18g in, 36g out\n28 sec",
      milk: "Whole, 140F",
      tea1: "  ",
      notes: "Grind setting: 18 grams\nDose: 18g\n\nCustomer likes it strong",
    }),
    {
      title: "Espresso",
      text: "Coffee 1: 18g in, 36g out; 28 sec · Milk settings: Whole, 140F · Grind setting: 18 grams · Dose: 18g · Customer likes it strong",
    },
  );
  assert.deepEqual(recipeNote({ name: null, coffee1: "1 gallon batch", notes: null }), { title: "Standard", text: "Coffee 1: 1 gallon batch" });
  assert.deepEqual(recipeNote({ name: "House", notes: "Not set" }), { title: "House", text: "" });
  assert.equal(recipeNote(null), null);
});

test("Notes list the pre-inspection note first, then the recipe, each once per row", () => {
  const recipe = { title: "Espresso", text: "Grind setting: 18 grams" };
  const rows = groupFormRows([
    { model: "Mazzer Super Jolly", serial: "M1", notes: "Left of the sink", voltage: "120V", plug: "5-15P", recipe },
    { model: "Mazzer Super Jolly", serial: "M2", notes: "Left of the sink", voltage: "120V", plug: "5-15P", recipe },
    { model: "Bunn G9-2T", serial: "G1", notes: "", voltage: "", plug: "", recipe: null },
  ]);
  assert.deepEqual(rows[0].notes, [{ title: "", text: "Left of the sink" }, recipe]);
  assert.deepEqual(rows[1].notes, []);
});

test("dates print from their own year, month and day, so no time zone moves them", () => {
  const before = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Chicago", "Pacific/Pago_Pago", "Pacific/Kiritimati"]) {
      process.env.TZ = tz;
      assert.equal(formDate("2026-10-20", { weekday: true }), "Tue, Oct 20, 2026", tz);
      assert.equal(formDate("2026-10-20"), "Oct 20, 2026", tz);
      assert.equal(formDate("2026-01-01T00:00:00Z", { weekday: true }), "Thu, Jan 1, 2026", tz);
      assert.equal(formDate("2026-12-31", { weekday: true }), "Thu, Dec 31, 2026", tz);
    }
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
  assert.equal(formDate("2028-02-29", { weekday: true }), "Tue, Feb 29, 2028");
  assert.equal(formDate("2026-02-30"), "");
  assert.equal(formDate("2026-13-01"), "");
  assert.equal(formDate("10/20/2026"), "");
  assert.equal(formDate(""), "");
  assert.equal(formDate(null), "");
});

test("the inspector prints as typed, and checks print YES, NO or PENDING", () => {
  const pre = preInstallNotes({ inspector: " Amanda Logg ", water: ["Pass"], power: ["Pass", "Fail"], space: ["Fail"], photoCount: 2, recipesReady: true, docs: "pending" });
  const at = (label) => pre.find((p) => p.label === label)?.notes;
  assert.equal(at("Account inspected by"), "Amanda Logg");
  assert.equal(at("Cold water source confirmed"), "YES");
  assert.equal(at("Power supply verified"), "PENDING");
  assert.equal(at("Space clearance (H/W/D) checked"), "NO");
  assert.equal(at("Pre-Inspection photos taken"), "YES");
  assert.equal(at("Cleaning/Care sheets & recipe cards ready"), "YES");
  assert.equal(at("Equipment sale/loan docs signed"), "PENDING");
  assert.equal(pre.length, 10);
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

test("when two units could be the removed row, none is picked: the save's prune keeps the one with anything recorded", () => {
  const unit = (equipmentId, overall, photoCount = 0, note = null) => ({ equipmentId, model: "Fetco CBS-51H", name: "Fetco CBS-51H", serial: null, overall, photoCount, note });
  const rows = [row("Fetco CBS-51H"), row("Fetco CBS-51H")];
  for (const index of [0, 1]) {
    assert.equal(visitUnitForRow(rows, index, [unit(1, "Not started"), unit(2, "Failed", 1)]), null);
    assert.equal(visitUnitForRow(rows, index, [unit(1, "Failed", 1), unit(2, "Not started")]), null);
  }
});

test("two identical rows pair at the same place, so the server's change lands on its own row when the other row has an unsaved edit", () => {
  const prev = [row("Fetco CBS-51H", "", "120V"), row("Fetco CBS-51H", "", "120V")];
  const editing = [{ ...prev[0], powerVoltage: "220V" }, { ...prev[1] }];
  const volts = (rows) => rows.map((r) => `${r.powerVoltage} ${r.serial}`.trim());
  // A warehouse serial written on row 1 stays on row 1, not on the edited 220V row.
  assert.deepEqual(volts(machinesBeforeSave(editing, prev, [prev[0], { ...prev[1], serial: "S1" }])), ["220V", "120V S1"]);
  // Row 1 removed on the Pre-inspection tab leaves the window; the edited row 0 stays.
  assert.deepEqual(volts(machinesBeforeSave(editing, prev, [prev[0]])), ["220V"]);
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

test("a serial or model fixed on the Pre-inspection tab shows in the open window, and the window's own edits stay", () => {
  const L = { equipment: "La Marzocco Linea PB 3 Group AV", serial: "L", powerVoltage: "208V", unitId: 189 };
  const M = { equipment: "Mazzer Super Jolly V Up Electronic", serial: "2626066", powerVoltage: "120V", unitId: 186 };
  // Install 135: the partial serial "L" was fixed on the Pre-inspection tab. The window had not touched that row.
  const fixed = machinesBeforeSave([M, L], [M, L], [M, { ...L, serial: "LPB3-50112" }]);
  assert.deepEqual(fixed.map((r) => r.serial), ["2626066", "LPB3-50112"]);
  // The model and electrical edited there too.
  const renamed = machinesBeforeSave([M, L], [M, L], [M, { ...L, equipment: "La Marzocco Linea PB 2 Group AV", powerVoltage: "220V" }]);
  assert.deepEqual(renamed.map((r) => `${r.equipment} ${r.powerVoltage}`), ["Mazzer Super Jolly V Up Electronic 120V", "La Marzocco Linea PB 2 Group AV 220V"]);
  // A serial typed in this window wins over the server's, and only that field: the server's voltage still comes through.
  const both = machinesBeforeSave([M, { ...L, serial: "LTYPED" }], [M, L], [M, { ...L, serial: "LPB3-50112", powerVoltage: "220V" }]);
  assert.deepEqual(both.map((r) => `${r.serial} ${r.powerVoltage}`), ["2626066 120V", "LTYPED 220V"]);
  // A serial moved from one unit's row to another's on the server moves in the window too.
  const A = { ...row("Bunn TB3", "X1"), unitId: 1 };
  const B = { ...row("Bunn TB3"), unitId: 2 };
  assert.deepEqual(shown(machinesBeforeSave([A, B], [A, B], [{ ...A, serial: "" }, { ...B, serial: "X1" }])), ["Bunn TB3", "Bunn TB3 SN X1"]);
  // A serial typed on another row here is never put on a second row by the server's copy.
  assert.deepEqual(shown(machinesBeforeSave([row("Bunn TB3", "W9"), row("Fetco CBS-51H")], [row("Bunn TB3"), row("Fetco CBS-51H")], [row("Bunn TB3"), row("Fetco CBS-51H", "W9")])), [
    "Bunn TB3 SN W9",
    "Fetco CBS-51H",
  ]);
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
