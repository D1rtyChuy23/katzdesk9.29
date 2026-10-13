import { test } from "node:test";
import assert from "node:assert/strict";
import { clearWarehouseSerial, placeWarehouseSerial } from "../src/lib/ops/warehouse-serial.ts";

const g9 = (serial) => ({ equipment: "Bunn G9-2T HD", serial, powerVoltage: "" });
const axiom = (serial) => ({ equipment: "Bunn Axiom Twin APS", serial, powerVoltage: "", plug: "kept" });

test("a warehouse serial fills the matching row that has none", () => {
  const { rows, changed } = placeWarehouseSerial([g9(""), axiom("")], { model: "Bunn G9-2T HD", serial: "G9-100" });
  assert.equal(changed, true);
  assert.equal(rows[0].serial, "G9-100");
  assert.equal(rows[1].serial, "");
  assert.equal(rows[1].plug, "kept");
  assert.equal(rows[0].powerVoltage, "");
});

test("a second unit of the same model gets its own row when the first serial is already set", () => {
  const { rows } = placeWarehouseSerial([g9("G9-100")], { model: "bunn g9-2t hd", serial: "G9-200" }, { addRow: true });
  assert.equal(rows.length, 2);
  assert.equal(rows[1].serial, "G9-200");
  assert.equal(rows[1].powerVoltage, "");
});

test("a model that is not on the install is added only when this is the assignment target", () => {
  const held = placeWarehouseSerial([axiom("")], { model: "Mazzer Robur", serial: "MZ-1" }, { addRow: false });
  assert.equal(held.changed, false);
  assert.equal(held.rows.length, 1);
  const added = placeWarehouseSerial([axiom("")], { model: "Mazzer Robur", serial: "MZ-1" }, { addRow: true });
  assert.equal(added.rows[1].equipment, "Mazzer Robur");
  assert.equal(added.rows[1].serial, "MZ-1");
});

test("unassign clears only the serial that came from the unit", () => {
  const { rows } = clearWarehouseSerial([g9("G9-100"), g9("TYPED-BY-HAND"), axiom("AX-1")], { serial: "G9-100" });
  assert.equal(rows[0].serial, "");
  assert.equal(rows[1].serial, "TYPED-BY-HAND");
  assert.equal(rows[2].serial, "AX-1");
});

test("a blank warehouse serial writes nothing", () => {
  const { changed, rows } = placeWarehouseSerial([g9("")], { model: "Bunn G9-2T HD", serial: "  " });
  assert.equal(changed, false);
  assert.equal(rows[0].serial, "");
});
