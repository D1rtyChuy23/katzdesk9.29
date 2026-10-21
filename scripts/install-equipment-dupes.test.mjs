import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { addMachineOntoInstall, readInspection, removeInspectionUnit, removeInstallRow, syncInstallUnits, unitsDroppedBy } = await import("../src/lib/ops/inspection-api.ts");
const { mergeEquipmentUnits, removeEquipmentUnit } = await import("../src/lib/ops/account-equip-import.ts");
const machines = await import("../src/lib/ops/machines.ts");
const { catalogModels, listedEquipment, savedMachineName } = await import("../src/lib/ops/equipment.ts");
const { placeWarehouseSerial } = await import("../src/lib/ops/warehouse-serial.ts");
const { matchExistingUnit, sameUnitModel } = await import("../src/lib/ops/account-equip.ts");
const { writeInstallSerial } = await import("../src/lib/ops/serial-pull.ts");

const ITCB_CATALOG = 'Bunn ITCB-DV, 29" w/Flip Tray';

async function fresh(assetModels = []) {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ($1), ('Bunn G9-2T'), ('Bunn TB3'), ('Fetco 52H')", [ITCB_CATALOG]);
  for (const m of assetModels) await pg.query("insert into assets (kind, model, qty, site, status) values ('equip', $1, 1, 'barn-back', 'ready')", [m]);
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

const install = async (pg, customer, equipment) =>
  (await pg.query("insert into installs (customer, equipment) values ($1, $2) returning id", [customer, equipment])).rows[0].id;
const acct = async (pg, customer) =>
  (await pg.query("select id, equipment_name, serial from account_equipment where lower(customer) = lower($1) order by id", [customer])).rows;

/** The list the board and the install window read: directory names and warehouse models (loadEquipCatalog). */
const serverCatalog = async (pg) =>
  catalogModels([
    ...(await pg.query("select name from directory_equipment where archived = false")).rows.map((d) => d.name),
    ...(await pg.query("select distinct model from assets where kind = 'equip'")).rows.map((d) => d.model),
  ]);

/** updateInstall's machine part: savedMachineName on the server catalog, then sync with prune and the list stored before. */
async function saveList(pg, sql, id, specs) {
  const cat = await serverCatalog(pg);
  const before = (await pg.query("select equipment, serial, power_voltage, machines from installs where id = $1", [id])).rows[0];
  const packed = machines.serializeMachines(specs);
  const mj = JSON.stringify(machines.parseMachinesJson(packed.machines).map((s) => ({ ...s, equipment: savedMachineName(s.equipment, cat) })));
  await pg.query("update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5 where id = $1", [id, packed.equipment, packed.serial, packed.powerVoltage, mj]);
  await syncInstallUnits(sql, id, { prune: true, before });
}

/** The install window's rows (mapInstall: specsFromInstall with the server catalog). */
const windowSpecs = async (pg, id) => {
  const r = (await pg.query("select * from installs where id = $1", [id])).rows[0];
  return machines.specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, await serverCatalog(pg));
};

test("a colour or size word after a machine stays on that machine", () => {
  const cat = ["Puqpress Q2 Automatic Tamper", "Mazzer Robur S Electronic", "Bunn G9-2", "Bunn Axiom-APS"];
  assert.deepEqual(listedEquipment("Mazzer Robur S Electronic, Puqpress Q2 Automatic Tamper BLACK, Blendtec Rapid Rinse Station", cat), [
    "Mazzer Robur S Electronic",
    "Puqpress Q2 Automatic Tamper BLACK",
    "Blendtec Rapid Rinse Station",
  ]);
  // Parity #13: the window and the sync both read two machines, and the G9's serial stays on it.
  const text = "Bunn Axiom-APS 120V SN:AXAP049095\nBunn G9-2 Short SN: G900075916";
  assert.deepEqual(listedEquipment(text, cat), ["Bunn Axiom-APS", "Bunn G9-2 Short"]);
  assert.deepEqual(
    machines.specsFromInstall(text, null, null, null, cat).map((s) => [s.equipment, s.serial]),
    [
      ["Bunn Axiom-APS", "AXAP049095"],
      ["Bunn G9-2 Short", "G900075916"],
    ],
  );
  // A word on its own line, or a lone machine, is left as typed.
  assert.deepEqual(listedEquipment("Black", cat), ["Black"]);
});

test("P1: a serial typed on its own line is that machine's serial, on pre-inspection and on the account", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Wildwood", "Fetco 52H\nSN:231515042");
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => [m.name, m.serial]), [["Fetco 52H", "231515042"]]);
    await saveList(pg, sql, id, await windowSpecs(pg, id));
    assert.deepEqual((await acct(pg, "Wildwood")).map((a) => [a.equipment_name, a.serial]), [["Fetco 52H", "231515042"]]);
  } finally {
    await pg.close();
  }
});

test("P1: a unit an older load made from the serial line is folded into the real unit on the next load", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Wildwood", "Fetco 52H\nSN:231515042");
    const real = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Wildwood', 'Fetco 52H', 'Fetco 52H') returning id")).rows[0].id;
    const phantom = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Wildwood', 'SN:231515042', 'SN:231515042') returning id")).rows[0].id;
    await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2), ($1, $3)", [id, real, phantom]);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => [m.equipmentId, m.serial]), [[real, "231515042"]]);
    assert.deepEqual((await acct(pg, "Wildwood")).map((a) => a.id), [real]);
  } finally {
    await pg.close();
  }
});

test("P3: pre-inspection reads warehouse models too, so the window's name matches the unit it made", async () => {
  // Warehouse has "Fetco 1251 Plus"; the directory does not (parity install #4).
  const { pg, sql } = await fresh(["Fetco 1251 Plus"]);
  try {
    const id = await install(pg, "Local Foods", "Bunn TB3 SN:T1\nFetco 1251 SN:12511B");
    const first = await readInspection(sql, id);
    assert.deepEqual(first.machines.map((m) => m.name), ["Bunn TB3", "Fetco 1251 Plus"]);
    const specs = await windowSpecs(pg, id);
    assert.deepEqual(specs.map((s) => s.equipment), ["Bunn TB3", "Fetco 1251 Plus"]);
    await saveList(pg, sql, id, specs);
    assert.deepEqual((await acct(pg, "Local Foods")).map((a) => a.equipment_name), ["Bunn TB3", "Fetco 1251 Plus"]);
  } finally {
    await pg.close();
  }
});

test("P3: a unit saved under the shorter name before warehouse models were read is still that row's machine", async () => {
  const { pg, sql } = await fresh(["Fetco 1251 Plus"]);
  try {
    const id = await install(pg, "Local Foods", "Fetco 1251 SN:12511B");
    const old = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Local Foods', 'Fetco 1251', 'Fetco 1251') returning id")).rows[0].id;
    await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [id, old]);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => [m.equipmentId, m.serial]), [[old, "12511B"]]);
    assert.equal((await acct(pg, "Local Foods")).length, 1);
  } finally {
    await pg.close();
  }
});

test("a machine taken off the list leaves the account too when this visit made it and nothing else uses it", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Prune Cafe", "Bunn TB3\nFetco 52H");
    await readInspection(sql, id);
    assert.equal((await acct(pg, "Prune Cafe")).length, 2);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Prune Cafe")).map((a) => a.equipment_name), ["Bunn TB3"]);
  } finally {
    await pg.close();
  }
});

test("a pruned unit stays on the account when it has an install date, a serial or a module", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Keep Cafe", "Bunn TB3\nFetco 52H\nBunn G9-2T");
    await readInspection(sql, id);
    const rows = await acct(pg, "Keep Cafe");
    await pg.query("update account_equipment set install_date = '2024-01-01' where id = $1", [rows[1].id]);
    await pg.query("insert into modules (module_id, assigned_unit_id) values ('M-1', $1)", [rows[2].id]);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Keep Cafe")).map((a) => a.equipment_name), ["Bunn TB3", "Fetco 52H", "Bunn G9-2T"]);
  } finally {
    await pg.close();
  }
});

test("P2: correcting a serial on a row rewrites that unit; the account keeps one machine", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Fix Cafe", "Bunn TB3");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-111", powerVoltage: "" }]);
    const unit = (await acct(pg, "Fix Cafe"))[0].id;
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-112", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Fix Cafe")).map((a) => [a.id, a.serial]), [[unit, "TB-112"]]);
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.serial), ["TB-112"]);
  } finally {
    await pg.close();
  }
});

test("P2: a serial cleared on a row clears it on the same unit (they mirror) and adds no blank twin", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Clear Cafe", "Bunn TB3");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-111", powerVoltage: "" }]);
    const unit = (await acct(pg, "Clear Cafe"))[0].id;
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Clear Cafe")).map((a) => [a.id, a.serial]), [[unit, null]]);
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => [m.equipmentId, m.serial]), [[unit, null]]);
    assert.deepEqual((await windowSpecs(pg, id)).map((s) => s.serial), [""]);
  } finally {
    await pg.close();
  }
});

test("P2: a passed (existing) unit takes the corrected serial instead of a second machine on the visit", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Pass Cafe", "Bunn TB3");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-111", powerVoltage: "" }]);
    const unit = (await acct(pg, "Pass Cafe"))[0].id;
    await pg.query("update install_inspection_units set visit_kind = 'existing' where install_id = $1 and equipment_id = $2", [id, unit]);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-112", powerVoltage: "" }]);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => [m.equipmentId, m.serial]), [[unit, "TB-112"]]);
  } finally {
    await pg.close();
  }
});

test("P2: a corrected serial another unit already holds is not copied; the row's own unit is left as it was", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Other', 'Bunn TB3', 'Bunn TB3', 'TB-500', 'tb-500')");
    const id = await install(pg, "Clash Cafe", "Bunn TB3");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-111", powerVoltage: "" }]);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-500", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Clash Cafe")).map((a) => a.serial), ["TB-111"]);
  } finally {
    await pg.close();
  }
});

test("P7: a unit whose serial was changed elsewhere is still this row's machine on the next load", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Odd Cafe", "Bunn TB3");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-111", powerVoltage: "" }]);
    const unit = (await acct(pg, "Odd Cafe"))[0].id;
    await pg.query("update account_equipment set serial = 'TB-999', serial_key = 'tb-999' where id = $1", [unit]);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => m.equipmentId), [unit]);
    assert.equal((await acct(pg, "Odd Cafe")).length, 1);
  } finally {
    await pg.close();
  }
});

test("P8: the window reads a saved list as saved: names are not split again and a serial-only row is that row's serial", () => {
  const saved = JSON.stringify([
    { equipment: ITCB_CATALOG, serial: "", powerVoltage: "" },
    { equipment: "Fetco 52H", serial: "", powerVoltage: "" },
    { equipment: "SN:231515042", serial: "", powerVoltage: "" },
  ]);
  assert.deepEqual(
    machines.specsFromInstall(null, null, null, saved).map((s) => [s.equipment, s.serial]),
    [
      [ITCB_CATALOG, ""],
      ["Fetco 52H", "231515042"],
    ],
  );
});

test("P8: a serial looked up on a typed install keeps one machine per line and the serial-line machine's name", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Wildwood", "Fetco 52H\nBunn TB3\nSN:TB0001");
    await readInspection(sql, id);
    const status = await writeInstallSerial(sql, id, "F52NEW", 0, { model: "Fetco 52H", powerVoltage: null });
    assert.equal(status, "updated");
    const r = (await pg.query("select * from installs where id = $1", [id])).rows[0];
    assert.deepEqual(machines.parseMachinesJson(r.machines).map((m) => [m.equipment, m.serial]), [
      ["Fetco 52H", "F52NEW"],
      ["Bunn TB3", "TB0001"],
    ]);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => [m.name, m.serial]), [
      ["Fetco 52H", "F52NEW"],
      ["Bunn TB3", "TB0001"],
    ]);
    assert.equal((await acct(pg, "Wildwood")).length, 2);
  } finally {
    await pg.close();
  }
});

test("P4: a warehouse unit pulled onto a row named by the directory fills that row instead of adding one", async () => {
  const { pg, sql } = await fresh(["Bunn ITCB"]);
  try {
    const id = await install(pg, "Pull Cafe", null);
    await addMachineOntoInstall(sql, { installId: id, model: ITCB_CATALOG, serial: null, electrical: null }, "Test");
    const r = (await pg.query("select * from installs where id = $1", [id])).rows[0];
    // stampWarehouseSerial: specsFromInstall with the equipment catalog, then placeWarehouseSerial.
    const cat = await serverCatalog(pg);
    const specs = machines.specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, cat);
    const placed = placeWarehouseSerial(specs, { model: "Bunn ITCB", serial: "ITCB777" }, { addRow: true, catalog: cat });
    assert.deepEqual(placed.rows.map((m) => [m.equipment, m.serial]), [[ITCB_CATALOG, "ITCB777"]]);
    const packed = machines.serializeMachines(placed.rows);
    await pg.query("update installs set equipment = $2, machines = $3, serial = $4, power_voltage = $5 where id = $1", [id, packed.equipment, packed.machines, packed.serial, packed.powerVoltage]);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => m.serial), ["ITCB777"]);
    assert.equal((await acct(pg, "Pull Cafe")).length, 1);
  } finally {
    await pg.close();
  }
});

test("P4: stampWarehouseSerial and the serial backfill pass the equipment catalog", () => {
  const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
  const stamp = api.slice(api.indexOf("async function stampWarehouseSerial"), api.indexOf("export const assignAssetToInstall"));
  assert.match(stamp, /loadEquipCatalog\(sql\)/);
  assert.doesNotMatch(stamp, /specsFromInstall\([^)]*row\.machines\)/);
  const backfill = readFileSync(new URL("../src/lib/ops/serial-backfill.ts", import.meta.url), "utf8");
  assert.doesNotMatch(backfill, /specsFromInstall\([^)]*\b(null|a\.machines)\)/);
});

test("P9: an import row with a serial fills the account's blank unit of that model; the same serial is an update whatever the model", () => {
  const existing = [
    { id: 1, customer: "Cafe", catalogModel: "Bunn TB3", equipmentName: "Bunn TB3", serial: null, serialKey: null },
    { id: 2, customer: "Cafe", catalogModel: "Fetco 52H", equipmentName: "Fetco 52H", serial: "F-1", serialKey: "f-1" },
  ];
  assert.deepEqual(matchExistingUnit({ customer: "Cafe", catalogModel: "Bunn TB3", equipmentName: "TB3", serial: "TB-1", existing }), {
    action: "update",
    existingId: 1,
    foreignAccount: null,
  });
  assert.deepEqual(matchExistingUnit({ customer: "Cafe", catalogModel: "Fetco 2051e", equipmentName: "Fetco", serial: "F-1", existing }), {
    action: "update",
    existingId: 2,
    foreignAccount: null,
  });
  assert.equal(matchExistingUnit({ customer: "Cafe", catalogModel: "Bunn G9-2T", equipmentName: "G9", serial: "G-1", existing }).action, "add");
});

test("P9: a unit put on an account with a serial fills its blank unit of that model (stock actions, Eversys add)", async () => {
  const { accountUnitWithSerial } = await import("../src/lib/ops/account-unit.ts");
  const { pg, sql } = await fresh();
  try {
    const blank = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Cafe', 'Bunn TB3', 'Bunn TB3') returning id")).rows[0].id;
    const other = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cafe', 'Fetco 52H', 'Fetco 52H', 'F-1', 'f-1') returning id")).rows[0].id;
    assert.equal((await accountUnitWithSerial(sql, "cafe", "Bunn TB3", "TB-9"))?.id, blank);
    assert.equal((await accountUnitWithSerial(sql, "Cafe", "Fetco 2051e", "F-1"))?.id, other);
    assert.equal(await accountUnitWithSerial(sql, "Cafe", "Bunn G9-2T", "G-1"), null);
    assert.equal(await accountUnitWithSerial(sql, "Cafe", "Bunn TB3", null), null);
    for (const file of ["../src/lib/ops/stock-actions.ts", "../src/lib/ops/module-assign.ts"]) {
      assert.match(readFileSync(new URL(file, import.meta.url), "utf8"), /accountUnitWithSerial\(sql, customer, model, serial\)/);
    }
  } finally {
    await pg.close();
  }
});

test("P5: Remove on the account's list takes the machine off an open install's list, so it does not come back", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Back Cafe", "Bunn TB3\nFetco 52H");
    const before = (await readInspection(sql, id)).machines.find((m) => m.name === "Bunn TB3").equipmentId;
    await removeEquipmentUnit(sql, before);
    const after = (await readInspection(sql, id)).machines;
    assert.deepEqual(after.map((m) => m.name), ["Fetco 52H"]);
    const r = (await pg.query("select equipment, machines from installs where id = $1", [id])).rows[0];
    assert.deepEqual(machines.parseMachinesJson(r.machines).map((m) => m.equipment), ["Fetco 52H"]);
    assert.deepEqual((await acct(pg, "Back Cafe")).map((a) => a.equipment_name), ["Fetco 52H"]);
  } finally {
    await pg.close();
  }
});

test("P5: an installed project's list is left as it was when its unit leaves the account", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Done Cafe", "Bunn TB3");
    const unit = (await readInspection(sql, id)).machines[0].equipmentId;
    await pg.query("update installs set complete = true where id = $1", [id]);
    await removeEquipmentUnit(sql, unit);
    assert.equal((await pg.query("select equipment from installs where id = $1", [id])).rows[0].equipment, "Bunn TB3");
  } finally {
    await pg.close();
  }
});

test("Pre-inspection Remove of a unit the list cannot match takes the only unclaimed machine of its model off the list", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Odd Cafe", "Bunn TB3\nFetco 52H");
    await readInspection(sql, id);
    // A unit on the visit under the catalog's longer name, and the list's TB3 unit taken off the visit elsewhere.
    const listed = (await acct(pg, "Odd Cafe")).find((a) => a.equipment_name === "Bunn TB3").id;
    const odd = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Odd Cafe', 'Bunn TB3', 'TB3 tea brewer') returning id")).rows[0].id;
    await pg.query("delete from install_inspection_units where install_id = $1 and equipment_id = $2", [id, listed]);
    await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [id, odd]);
    const view = await removeInspectionUnit(sql, { installId: id, equipmentId: odd }, "Test");
    assert.equal(view.fromList, true);
    assert.deepEqual(view.machines.map((m) => m.name), ["Fetco 52H"]);
  } finally {
    await pg.close();
  }
});

test("the Equipment tab's Remove takes a passed (existing) unit off the visit with its row", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Gone Cafe", "Bunn TB3\nFetco 52H");
    const units = (await readInspection(sql, id)).machines;
    const tb3 = units.find((m) => m.name === "Bunn TB3").equipmentId;
    await pg.query("update install_inspection_units set visit_kind = 'existing' where install_id = $1 and equipment_id = $2", [id, tb3]);
    const out = await removeInstallRow(sql, { installId: id, index: 0, equipment: "Bunn TB3", serial: "" }, "Test");
    assert.equal(out.removed, "Bunn TB3");
    // The window's save follows with the same list.
    await saveList(pg, sql, id, [{ equipment: "Fetco 52H", serial: "", powerVoltage: "" }]);
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.name), ["Fetco 52H"]);
    assert.deepEqual((await acct(pg, "Gone Cafe")).map((a) => a.equipment_name), ["Fetco 52H"]);
  } finally {
    await pg.close();
  }
});

test("the Equipment tab's Remove of one of two identical rows keeps the unit with a check", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Twin Cafe", "Bunn TB3\nBunn TB3");
    const [a, b] = (await readInspection(sql, id)).machines.map((m) => m.equipmentId);
    await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'space', 'Pass')", [id, b]);
    await removeInstallRow(sql, { installId: id, index: 0, equipment: "Bunn TB3", serial: "" }, "Test");
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.equipmentId), [b]);
    assert.ok(!(await acct(pg, "Twin Cafe")).some((u) => u.id === a));
  } finally {
    await pg.close();
  }
});

test("an installed install refuses a list change its kept pre-inspection would disagree with, except from the owner", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Done Cafe", "Bunn TB3\nFetco 52H");
    await readInspection(sql, id);
    await pg.query("update installs set complete = true where id = $1", [id]);
    await assert.rejects(() => removeInstallRow(sql, { installId: id, index: 0, equipment: "Bunn TB3", serial: "" }, "Test"), /marked installed.*only the owner/);
    const tb3 = JSON.stringify([{ equipment: "Bunn TB3", serial: "", powerVoltage: "120V" }]);
    assert.equal((await unitsDroppedBy(sql, id, { equipment: "Bunn TB3", serial: null, power_voltage: null, machines: tb3 })).length, 1);
    const both = JSON.stringify([{ equipment: "Bunn TB3", serial: "", powerVoltage: "120V" }, { equipment: "Fetco 52H", serial: "", powerVoltage: "" }]);
    assert.deepEqual(await unitsDroppedBy(sql, id, { equipment: "Bunn TB3\nFetco 52H", serial: null, power_voltage: null, machines: both }), []);
    const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
    assert.match(api, /if \(wasInstalled && nowInstalled && listEdited && \(await unitsDroppedBy\(sql, data\.id, nextList\)\)\.length && !\(await canLockEquipment\(sql, context\.userId\)\)\)/);
    // The owner can take a machine off an installed project: the row and its unit go together.
    await removeInstallRow(sql, { installId: id, index: 0, equipment: "Bunn TB3", serial: "" }, "Chuy", { owner: true });
    assert.deepEqual((await windowSpecs(pg, id)).map((s) => s.equipment), ["Fetco 52H"]);
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.name), ["Fetco 52H"]);
  } finally {
    await pg.close();
  }
});

test("Merge is offered for account rows that read as the same model", () => {
  assert.equal(sameUnitModel({ catalogModel: ITCB_CATALOG, equipmentName: "Bunn ITCB" }, { catalogModel: "Bunn ITCB", equipmentName: "Bunn ITCB" }), true);
  assert.equal(sameUnitModel({ catalogModel: "Bunn TB3", equipmentName: "TB3" }, { catalogModel: "bunn tb-3", equipmentName: "" }), true);
  assert.equal(sameUnitModel({ catalogModel: "Bunn TB3", equipmentName: "TB3" }, { catalogModel: "BUNN  TB3", equipmentName: "" }), true);
  assert.equal(sameUnitModel({ catalogModel: "Bunn TB3", equipmentName: "TB3" }, { catalogModel: "Fetco 52H", equipmentName: "Fetco 52H" }), false);
  const src = readFileSync(new URL("../src/components/desk/account-history.tsx", import.meta.url), "utf8");
  assert.match(src, /const twins = rows\.filter\(\(other, j\) => j !== i && other\.id && row\.id && sameUnitModel\(other, row\)\);/);
});

test("R1: a serial corrected on the account is not put back by opening the install, open or completed", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Revert Cafe", "Bunn TB3 SN:TB-111");
    await readInspection(sql, id);
    const unit = (await acct(pg, "Revert Cafe"))[0].id;
    // A tech reads the real plate on a PM and corrects the account record.
    await pg.query("update account_equipment set serial = 'TB-1111', serial_key = 'tb-1111' where id = $1", [unit]);
    await readInspection(sql, id);
    assert.deepEqual((await acct(pg, "Revert Cafe")).map((a) => a.serial), ["TB-1111"]);
    await pg.query("update installs set complete = true where id = $1", [id]);
    await readInspection(sql, id);
    assert.deepEqual((await acct(pg, "Revert Cafe")).map((a) => a.serial), ["TB-1111"]);
    // A save that leaves the row's serial as it was does not write it either.
    await pg.query("update installs set complete = false where id = $1", [id]);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-111", powerVoltage: "120V" }]);
    assert.deepEqual((await acct(pg, "Revert Cafe")).map((a) => a.serial), ["TB-1111"]);
  } finally {
    await pg.close();
  }
});

test("R1: a serial corrected on a row is written onto its unit even with an install date or on a completed install (they mirror)", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Dated Cafe", "Bunn TB3");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-111", powerVoltage: "" }]);
    const unit = (await acct(pg, "Dated Cafe"))[0].id;
    await pg.query("update account_equipment set install_date = '2024-01-01' where id = $1", [unit]);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-112", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Dated Cafe")).map((a) => [a.id, a.serial]), [[unit, "TB-112"]]);
    await pg.query("update account_equipment set install_date = null where id = $1", [unit]);
    await pg.query("update installs set complete = true where id = $1", [id]);
    await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "TB-113", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Dated Cafe")).map((a) => [a.id, a.serial]), [[unit, "TB-113"]]);
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.serial), ["TB-113"]);
  } finally {
    await pg.close();
  }
});

test("R2: the prune only unlinks a unit that was on the account before the visit; its runbook history stays", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, electrical, ownership) values ('Old Cafe', 'Bunn TB3', 'Bunn TB3', '120V', 'Sold')");
    const before = (await acct(pg, "Old Cafe"))[0].id;
    await pg.query("insert into unit_runbook_options (unit_key, runbook_id, options) values ($1, 'bunn', '{\"wand\":2}')", [`acct:${before}`]);
    const id = await install(pg, "Old Cafe", "Bunn TB3\nFetco 52H");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [{ equipment: "Fetco 52H", serial: "", powerVoltage: "" }]);
    assert.deepEqual((await acct(pg, "Old Cafe")).map((a) => [a.id, a.equipment_name]).filter(([i]) => i === before), [[before, "Bunn TB3"]]);
    assert.equal((await readInspection(sql, id)).machines.some((m) => m.equipmentId === before), false);
    assert.equal((await pg.query("select count(*)::int n from unit_runbook_options")).rows[0].n, 1);
  } finally {
    await pg.close();
  }
});

test("R2: Remove keeps the account record while runbook history or a copied visit points at it", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Hist Cafe", "Bunn TB3\nFetco 52H");
    const units = (await readInspection(sql, id)).machines;
    const tb3 = units.find((m) => m.name === "Bunn TB3").equipmentId;
    const fetco = units.find((m) => m.name === "Fetco 52H").equipmentId;
    await pg.query("insert into unit_runbook_options (unit_key, runbook_id, options) values ($1, 'bunn', '{}')", [`acct:${tb3}`]);
    const other = await install(pg, "Hist Cafe", null);
    await pg.query("insert into account_equipment (id, customer, catalog_model, equipment_name) values (9001, 'Hist Cafe', 'Fetco 52H', 'Fetco 52H')");
    await pg.query("insert into install_inspection_units (install_id, equipment_id, copied_from_equipment) values ($1, 9001, $2)", [other, fetco]);
    await removeInspectionUnit(sql, { installId: id, equipmentId: tb3 }, "Test");
    await removeInspectionUnit(sql, { installId: id, equipmentId: fetco }, "Test");
    const left = (await acct(pg, "Hist Cafe")).map((a) => a.id);
    assert.ok(left.includes(tb3) && left.includes(fetco));
  } finally {
    await pg.close();
  }
});

test("R3: a new row whose name extends an existing unit's name does not take that unit from its own row", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Steal Cafe", "Acme Brewer");
    await readInspection(sql, id);
    const u1 = (await acct(pg, "Steal Cafe"))[0].id;
    await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'electrical', 'Passed')", [id, u1]);
    await saveList(pg, sql, id, [
      { equipment: "Acme Brewer Twin", serial: "", powerVoltage: "208V" },
      { equipment: "Acme Brewer", serial: "", powerVoltage: "" },
    ]);
    const view = await readInspection(sql, id);
    assert.equal(view.machines.find((m) => m.equipmentId === u1)?.name, "Acme Brewer");
    assert.deepEqual((await acct(pg, "Steal Cafe")).map((a) => a.equipment_name), ["Acme Brewer", "Acme Brewer Twin"]);
    // Remove sees the same claims: the Twin row's unit goes, not the original.
    await removeInstallRow(sql, { installId: id, index: 0, equipment: "Acme Brewer Twin", serial: "" }, "Test");
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.equipmentId), [u1]);
  } finally {
    await pg.close();
  }
});

test("R4: a saved machine called 'Snowball' or 'SNAP' is a machine, not a serial", () => {
  const raw = JSON.stringify([
    { equipment: "Bunn TB3", serial: "", powerVoltage: "" },
    { equipment: "Snowball", serial: "", powerVoltage: "" },
    { equipment: "SNAP", serial: "", powerVoltage: "" },
    { equipment: "SN: 231515042", serial: "", powerVoltage: "" },
  ]);
  assert.deepEqual(machines.storedMachines(raw).map((m) => [m.equipment, m.serial]), [
    ["Bunn TB3", ""],
    ["Snowball", ""],
    ["SNAP", "231515042"],
  ]);
  assert.deepEqual(machines.specsFromInstall("Fetco 52H\nS/N 231515042\nSnowball", null, null, null).map((m) => [m.equipment, m.serial]), [
    ["Fetco 52H", "231515042"],
    ["Snowball", ""],
  ]);
});

test("R5: every Remove keeps recipe, ownership, plug, water and the deal tie on the rows that stay", async () => {
  for (const how of ["preinspection", "account", "row"]) {
    const { pg, sql } = await fresh();
    try {
      const rows = [
        { equipment: "Bunn TB3", serial: "", powerVoltage: "120V", recipeId: 7, ownership: "Sold", plug: "5-15P", water: "1/4in", uid: "u-tb3", confirmedAt: "2026-10-01" },
        { equipment: "Fetco 52H", serial: "", powerVoltage: "208V", recipeId: 9, ownership: "Leased", plug: "L6-30P", water: "3/8in", uid: "u-52h", confirmedAt: "2026-10-01" },
      ];
      const id = (await pg.query("insert into installs (customer, equipment, machines) values ('Tie Cafe', 'Bunn TB3\nFetco 52H', $1) returning id", [JSON.stringify(rows)])).rows[0].id;
      const view = await readInspection(sql, id);
      const tb3 = view.machines.find((m) => m.name === "Bunn TB3").equipmentId;
      if (how === "preinspection") await removeInspectionUnit(sql, { installId: id, equipmentId: tb3 }, "tester");
      else if (how === "account") await removeEquipmentUnit(sql, tb3);
      else await removeInstallRow(sql, { installId: id, index: 0, equipment: "Bunn TB3", serial: "" }, "tester");
      const after = machines.parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines);
      assert.deepEqual(after, [{ ...rows[1], recipeId: 9 }], how);
    } finally {
      await pg.close();
    }
  }
});

test("F2: Merge on the account holds while an open install lists both machines; reopening it does not bring the unit back", async () => {
  const { pg, sql } = await fresh(["Bunn ITCB"]);
  try {
    const id = await install(pg, "Merge Cafe", null);
    const rows = [{ equipment: "Bunn ITCB", serial: "", powerVoltage: "120V", recipeId: 4, ownership: "Sold", uid: "u-itcb", confirmedAt: "2026-10-01" }];
    await pg.query("update installs set equipment = 'Bunn ITCB', machines = $2 where id = $1", [id, JSON.stringify(rows)]);
    await readInspection(sql, id);
    // A second ITCB added on the Pre-inspection tab, then merged into the first on the account.
    await addMachineOntoInstall(sql, { installId: id, model: "Bunn ITCB", serial: null, electrical: null }, "Test");
    const [keep, drop] = (await acct(pg, "Merge Cafe")).map((a) => a.id);
    await mergeEquipmentUnits(sql, keep, drop);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => m.equipmentId), [keep]);
    assert.deepEqual((await acct(pg, "Merge Cafe")).map((a) => a.id), [keep]);
    const left = machines.parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines);
    assert.equal(left.length, 1);
    assert.equal(left[0].uid, "u-itcb");
    assert.equal(left[0].recipeId, 4);
  } finally {
    await pg.close();
  }
});

test("F3: a comma is between machines, so 'fetco, gr2.2' is two machines in the window and on the visit, and the old units are reused", async () => {
  const cat = ["Fetco GR2.2", "Bunn ITCB", "Bunn G9-2T", "Bunn TB3", 'Bunn ITCB-DV, 29" w/Flip Tray'];
  assert.equal(listedEquipment("used cameo 2 step, itcb, g9-2t, fetco, gr2.2, TB3", cat).length, 6);
  assert.deepEqual(listedEquipment("Fetco GR2.2", cat), ["Fetco GR2.2"]);
  assert.deepEqual(listedEquipment('Bunn ITCB-DV, 29" w/Flip Tray', cat), ['Bunn ITCB-DV, 29" w/Flip Tray']);
  const { pg, sql } = await fresh(["Fetco GR2.2"]);
  try {
    const id = await install(pg, "Petro Club", "fetco, gr2.2, TB3");
    const fetco = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Petro Club', 'fetco', 'fetco') returning id")).rows[0].id;
    const gr = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Petro Club', 'Fetco GR2.2 Dual Portion Grinder (4 Batch Buttons)', 'gr2.2') returning id")).rows[0].id;
    await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2), ($1, $3)", [id, fetco, gr]);
    const view = await readInspection(sql, id);
    assert.equal(view.machines.length, (await windowSpecs(pg, id)).length);
    assert.equal(view.machines.length, 3);
    assert.ok([fetco, gr].every((u) => view.machines.some((m) => m.equipmentId === u)));
    assert.equal((await acct(pg, "Petro Club")).length, 3);
  } finally {
    await pg.close();
  }
});

test("F4: a save keeps the name the load reads ('Bunn G9-2 Short' stays, not 'Bunn G9')", async () => {
  const { pg, sql } = await fresh(["Bunn G9-2", "Bunn G9", "Bunn Axiom-APS"]);
  try {
    const cat = await serverCatalog(pg);
    assert.equal(savedMachineName("Bunn G9-2 Short", cat), "Bunn G9-2 Short");
    assert.equal(savedMachineName("TB3", cat), "Bunn TB3");
    const id = await install(pg, "Donut Shop", "Bunn Axiom-APS 120V SN:AXAP049095\nBunn G9-2 Short SN: G900075916");
    await readInspection(sql, id);
    const unit = (await acct(pg, "Donut Shop")).find((a) => a.serial === "G900075916");
    await saveList(pg, sql, id, await windowSpecs(pg, id));
    const r = (await pg.query("select machines from installs where id = $1", [id])).rows[0];
    assert.deepEqual(machines.parseMachinesJson(r.machines).map((m) => m.equipment), ["Bunn Axiom-APS", "Bunn G9-2 Short"]);
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.name), ["Bunn Axiom-APS", "Bunn G9-2 Short"]);
    assert.ok((await acct(pg, "Donut Shop")).some((a) => a.id === unit.id && a.equipment_name === "Bunn G9-2 Short"));
    const api = readFileSync(new URL("../src/lib/ops/api.ts", import.meta.url), "utf8");
    assert.equal((api.match(/equipment: savedMachineName\(s\.equipment, catalog\)/g) ?? []).length, 2);
  } finally {
    await pg.close();
  }
});
