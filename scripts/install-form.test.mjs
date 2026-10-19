import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountIsNew,
  foldVisitUnits,
  groupFormRows,
  looksLikePlug,
  looksLikeVoltage,
  parseAccountSerialNotice,
  placePower,
  rollChecks,
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
