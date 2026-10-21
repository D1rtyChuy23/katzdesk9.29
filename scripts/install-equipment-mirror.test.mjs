import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { addMachineOntoInstall, editInspectionUnit, listEditRefusal, readInspection, removeInspectionUnit, syncInstallUnits } = await import(
  "../src/lib/ops/inspection-api.ts"
);
const machines = await import("../src/lib/ops/machines.ts");
const { catalogModels, savedMachineName } = await import("../src/lib/ops/equipment.ts");

const CAMEO = "Eversys Cameo c'2s - 2 Step Classic";

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Bunn TB3'), ('Fetco 52H'), ($1)", [CAMEO]);
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

const install = async (pg, customer, equipment) =>
  (await pg.query("insert into installs (customer, equipment) values ($1, $2) returning id", [customer, equipment])).rows[0].id;
const catalog = async (pg) => catalogModels((await pg.query("select name from directory_equipment")).rows.map((d) => d.name));
/** The install window's rows. */
const listOf = async (pg, id) => {
  const r = (await pg.query("select * from installs where id = $1", [id])).rows[0];
  return machines.specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, await catalog(pg)).map((s) => [s.equipment, s.serial, s.powerVoltage]);
};
/** Pre-inspection's machines. */
const preOf = async (sql, id) => (await readInspection(sql, id)).machines.map((m) => [m.equipmentId, m.name, m.serial ?? "", m.electrical ?? ""]);
const packed = (specs) => {
  const p = machines.serializeMachines(specs);
  return { equipment: p.equipment, serial: p.serial, power_voltage: p.powerVoltage, machines: p.machines };
};
/** updateInstall's list part: refuse first, then store and sync with the list stored before. */
async function saveList(pg, sql, id, specs) {
  const cat = await catalog(pg);
  const next = packed(specs.map((s) => ({ ...s, equipment: savedMachineName(s.equipment, cat) })));
  const refusal = await listEditRefusal(sql, id, next);
  if (refusal) throw new Error(refusal);
  const before = (await pg.query("select equipment, serial, power_voltage, machines from installs where id = $1", [id])).rows[0];
  await pg.query("update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5 where id = $1", [id, next.equipment, next.serial, next.power_voltage, next.machines]);
  await syncInstallUnits(sql, id, { prune: true, before });
}
const TB3 = (serial = "", powerVoltage = "") => ({ equipment: "Bunn TB3", serial, powerVoltage });

test("Edit on Pre-inspection changes the unit and the list row together: same machine, no new one", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Edit Cafe", "Bunn TB3\nFetco 52H");
    const [tb3] = (await readInspection(sql, id)).machines;
    await editInspectionUnit(sql, { installId: id, equipmentId: tb3.equipmentId, model: "Bunn TB3", serial: "TB-111", electrical: "120V" }, "Chuy");
    assert.deepEqual(await listOf(pg, id), [["Bunn TB3", "TB-111", "120V"], ["Fetco 52H", "", ""]]);
    assert.deepEqual((await preOf(sql, id))[0], [tb3.equipmentId, "Bunn TB3", "TB-111", "120V"]);
    // Change the serial again, then the model: still one unit, and the list follows each time.
    await editInspectionUnit(sql, { installId: id, equipmentId: tb3.equipmentId, model: "Bunn TB3", serial: "TB-222", electrical: "120V" }, "Chuy");
    await editInspectionUnit(sql, { installId: id, equipmentId: tb3.equipmentId, model: CAMEO, serial: "TB-222", electrical: "220V" }, "Chuy");
    assert.deepEqual(await listOf(pg, id), [[CAMEO, "TB-222", "220V"], ["Fetco 52H", "", ""]]);
    assert.deepEqual(await preOf(sql, id), [
      [tb3.equipmentId, CAMEO, "TB-222", "220V"],
      [(await readInspection(sql, id)).machines[1].equipmentId, "Fetco 52H", "", ""],
    ]);
    assert.equal((await pg.query("select count(*)::int n from account_equipment where customer = 'Edit Cafe'")).rows[0].n, 2);
  } finally {
    await pg.close();
  }
});

test("Edit refuses a locked machine, a serial on another row, and a serial another account's unit holds", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Other Cafe', 'Bunn TB3', 'Bunn TB3', 'X-999', 'x-999')");
    const id = await install(pg, "Refuse Cafe", "Bunn TB3\nFetco 52H");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [TB3("TB-111"), { equipment: "Fetco 52H", serial: "F-101", powerVoltage: "" }]);
    const [tb3, fetco] = (await readInspection(sql, id)).machines;
    await assert.rejects(() => editInspectionUnit(sql, { installId: id, equipmentId: fetco.equipmentId, model: "Fetco 52H", serial: "TB-111" }, "T"), /already on this visit/);
    await assert.rejects(() => editInspectionUnit(sql, { installId: id, equipmentId: fetco.equipmentId, model: "Fetco 52H", serial: "X-999" }, "T"), /already on Other Cafe \(Bunn TB3\)/);
    await pg.query("update account_equipment set locked_at = now(), locked_by = 'Chuy' where id = $1", [tb3.equipmentId]);
    await assert.rejects(() => editInspectionUnit(sql, { installId: id, equipmentId: tb3.equipmentId, model: "Bunn TB3", serial: "TB-555" }, "T"), /Locked by Chuy/);
    assert.deepEqual(await listOf(pg, id), [["Bunn TB3", "TB-111", ""], ["Fetco 52H", "F-101", ""]]);
  } finally {
    await pg.close();
  }
});

test("Add with a serial on a model already listed without one fills that machine instead of adding a second", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Fill Cafe", CAMEO);
    const [cameo] = (await readInspection(sql, id)).machines;
    await addMachineOntoInstall(sql, { installId: id, model: CAMEO, serial: "0183130226090C0003", electrical: "", fillEquipmentId: cameo.equipmentId }, "Chuy");
    assert.deepEqual(await listOf(pg, id), [[CAMEO, "0183130226090C0003", ""]]);
    assert.deepEqual(await preOf(sql, id), [[cameo.equipmentId, CAMEO, "0183130226090C0003", ""]]);
    // A machine that already has a serial is edited, not filled; another machine of the model is still an Add.
    await assert.rejects(
      () => addMachineOntoInstall(sql, { installId: id, model: CAMEO, serial: "0183130226112C0010", fillEquipmentId: cameo.equipmentId }, "Chuy"),
      /already has a serial/,
    );
    await addMachineOntoInstall(sql, { installId: id, model: CAMEO, serial: "0183130226112C0010" }, "Chuy");
    assert.equal((await preOf(sql, id)).length, 2);
  } finally {
    await pg.close();
  }
});

test("a window save mirrors: serial, model and clear reach the unit; a load never overwrites a typed serial", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Win Cafe", "Bunn TB3");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [TB3("TB-111")]);
    const unit = (await preOf(sql, id))[0][0];
    // The model changed on the row, the serial kept: the unit is renamed, not replaced.
    await saveList(pg, sql, id, [{ equipment: "Fetco 52H", serial: "TB-111", powerVoltage: "" }]);
    assert.deepEqual(await preOf(sql, id), [[unit, "Fetco 52H", "TB-111", ""]]);
    // A serial changed on the account elsewhere: opening the install leaves the typed row as it is (an old window can't
    // save it back), and the next save shows the account's serial on the row.
    await pg.query("update account_equipment set serial = 'TB-999', serial_key = 'tb-999' where id = $1", [unit]);
    await readInspection(sql, id);
    assert.deepEqual(await listOf(pg, id), [["Fetco 52H", "TB-111", ""]]);
    await saveList(pg, sql, id, [{ equipment: "Fetco 52H", serial: "TB-111", powerVoltage: "120V" }]);
    assert.deepEqual(await listOf(pg, id), [["Fetco 52H", "TB-999", "120V"]]);
    assert.deepEqual(await preOf(sql, id), [[unit, "Fetco 52H", "TB-999", "120V"]]);
    // A blank row is filled from its unit on a load.
    await pg.query("update installs set machines = $2, serial = null where id = $1", [id, JSON.stringify([{ equipment: "Fetco 52H", serial: "", powerVoltage: "" }])]);
    await readInspection(sql, id);
    assert.deepEqual(await listOf(pg, id), [["Fetco 52H", "TB-999", "120V"]]);
  } finally {
    await pg.close();
  }
});

test("a save that would leave the list and the pre-inspection apart is refused before it is stored", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Far Cafe', 'Fetco 52H', 'Fetco 52H', 'F-777', 'f-777')");
    const id = await install(pg, "Lock Cafe", "Bunn TB3\nFetco 52H");
    await readInspection(sql, id);
    await saveList(pg, sql, id, [TB3("TB-111"), { equipment: "Fetco 52H", serial: "", powerVoltage: "" }]);
    await assert.rejects(() => saveList(pg, sql, id, [TB3("TB-111"), { equipment: "Fetco 52H", serial: "F-777", powerVoltage: "" }]), /SN F-777 is already on Far Cafe/);
    await pg.query("update account_equipment set locked_at = now(), locked_by = 'Chuy' where serial_key = 'tb-111'");
    await assert.rejects(() => saveList(pg, sql, id, [TB3("TB-222"), { equipment: "Fetco 52H", serial: "", powerVoltage: "" }]), /can't be changed\. Locked by Chuy/);
    await assert.rejects(() => saveList(pg, sql, id, [TB3(""), { equipment: "Fetco 52H", serial: "", powerVoltage: "" }]), /can't be changed\. Locked by Chuy/);
    await assert.rejects(() => saveList(pg, sql, id, [{ equipment: "Fetco 52H", serial: "", powerVoltage: "" }]), /can't come off the list\. Locked by Chuy/);
    // A locked unit's row named loosely ("TB3" for "Bunn TB3") and left as it was never blocks the save of other rows.
    await pg.query("update account_equipment set equipment_name = 'Bunn TB3 (old)', catalog_model = 'Bunn TB3 (old)' where serial_key = 'tb-111'");
    await saveList(pg, sql, id, [TB3("TB-111"), { equipment: "Fetco 52H", serial: "F-202", powerVoltage: "" }]);
    await pg.query("update account_equipment set equipment_name = 'Bunn TB3', catalog_model = 'Bunn TB3' where serial_key = 'tb-111'");
    // Other rows still save.
    await saveList(pg, sql, id, [TB3("TB-111"), { equipment: "Fetco 52H", serial: "F-101", powerVoltage: "" }]);
    assert.deepEqual((await preOf(sql, id)).map((m) => m[2]), ["TB-111", "F-101"]);
  } finally {
    await pg.close();
  }
});

test("an installed project: only the owner edits or removes its machines", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Done Cafe", "Bunn TB3\nFetco 52H");
    const [tb3, fetco] = (await readInspection(sql, id)).machines;
    await pg.query("update installs set complete = true where id = $1", [id]);
    await assert.rejects(() => editInspectionUnit(sql, { installId: id, equipmentId: tb3.equipmentId, model: "Bunn TB3", serial: "TB-111" }, "Tech"), /only the owner/);
    await assert.rejects(() => removeInspectionUnit(sql, { installId: id, equipmentId: fetco.equipmentId }, "Tech"), /only the owner/);
    await editInspectionUnit(sql, { installId: id, equipmentId: tb3.equipmentId, model: "Bunn TB3", serial: "TB-111" }, "Chuy", { owner: true });
    await removeInspectionUnit(sql, { installId: id, equipmentId: fetco.equipmentId }, "Chuy", { owner: true });
    assert.deepEqual(await listOf(pg, id), [["Bunn TB3", "TB-111", ""]]);
    assert.deepEqual((await preOf(sql, id)).map((m) => [m[1], m[2]]), [["Bunn TB3", "TB-111"]]);
  } finally {
    await pg.close();
  }
});
