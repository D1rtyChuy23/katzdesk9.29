import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// The resolve hook that also takes directory imports (api.ts reaches pm-runbook-api.ts, which imports ./runbooks).
await register("./node-resolve-hook.mjs", import.meta.url);

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const inspection = await import("../src/lib/ops/inspection-api.ts");
const { readInspection, syncInstallUnits, removeInspectionUnit, removeInstallRow, addUnitOntoList, findUnitMismatches } = inspection;
const { parseMachinesJson, serializeMachines } = await import("../src/lib/ops/machines.ts");
const api = await import("../src/lib/ops/api.ts");

const LINEA = "La Marzocco Linea PB 3 Group AV";
const MAZZER = "Mazzer Super Jolly V Up Electronic";
const G9 = "Bunn G9-2T HD Dual Portion Grinder";
const ITCB = 'Bunn ITCB-DV, 29" w/Flip Tray';

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ($1), ($2), ($3), ($4), ('Bunn TB3'), ('Fetco CBS-51H')", [LINEA, MAZZER, G9, ITCB]);
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

async function install(pg, customer, rows) {
  return (
    await pg.query("insert into installs (customer, equipment, machines) values ($1, $2, $3) returning id", [
      customer,
      rows.map((r) => r.equipment).join("\n"),
      JSON.stringify(rows.map((r) => ({ serial: "", powerVoltage: "", ...r }))),
    ])
  ).rows[0].id;
}

const stored = async (pg, id) => parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines);
const visit = async (pg, id) =>
  (
    await pg.query(
      `select a.id, a.equipment_name, a.serial from install_inspection_units u join account_equipment a on a.id = u.equipment_id
        where u.install_id = $1 order by a.id`,
      [id],
    )
  ).rows;

/** The install window's save, as updateInstall runs it: store the list, then sync with prune and the list stored before. */
async function save(pg, sql, id, rows) {
  const before = (await pg.query("select equipment, serial, power_voltage, machines from installs where id = $1", [id])).rows[0];
  const packed = serializeMachines(rows);
  await pg.query("update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5 where id = $1", [
    id,
    packed.equipment,
    packed.serial,
    packed.powerVoltage,
    packed.machines,
  ]);
  await syncInstallUnits(sql, id, { prune: true, before });
}

/** Marks a unit as existing equipment on this visit, which counts as Pre-inspection Passed. */
const pass = (pg, id, equipmentId) =>
  pg.query("update install_inspection_units set visit_kind = 'existing' where install_id = $1 and equipment_id = $2", [id, equipmentId]);

test("every equipment row stores its pre-inspection unit's id, and loading again writes nothing", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Bar By The Wayside", [
      { equipment: MAZZER, serial: "2626066", powerVoltage: "120v" },
      { equipment: G9, serial: "G900046833", powerVoltage: "120v" },
      { equipment: "Bunn TB3" },
    ]);
    const view = await readInspection(sql, id);
    const rows = await stored(pg, id);
    assert.equal(view.machines.length, 3);
    const unitFor = (serial, name) => view.machines.find((m) => (serial ? m.serial === serial : m.name === name)).equipmentId;
    assert.deepEqual(
      rows.map((r) => r.unitId),
      [unitFor("2626066"), unitFor("G900046833"), unitFor(null, "Bunn TB3")],
    );
    assert.ok(view.machines.every((m) => m.onList), "every unit is on the list");
    const json = (await pg.query("select machines, updated_at::text as at from installs where id = $1", [id])).rows[0];
    await readInspection(sql, id);
    assert.deepEqual((await pg.query("select machines, updated_at::text as at from installs where id = $1", [id])).rows[0], json);
  } finally {
    await pg.close();
  }
});

test("a typed equipment list is left as typed: no ids are written into it", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (await pg.query("insert into installs (customer, equipment) values ('Typed Cafe', $1) returning id", ["Bunn TB3 SN:TB3-104\nFetco CBS-51H"])).rows[0].id;
    await readInspection(sql, id);
    const row = (await pg.query("select equipment, machines from installs where id = $1", [id])).rows[0];
    assert.equal(row.equipment, "Bunn TB3 SN:TB3-104\nFetco CBS-51H");
    assert.equal(row.machines, null);
  } finally {
    await pg.close();
  }
});

test("a model renamed on its row keeps its unit: no second unit, and the passed pre-inspection stays with it", async () => {
  // The same machine written out in full, and a wrong model corrected to another one.
  for (const [from, to] of [
    ["La Marzocco Linea PB", LINEA],
    ["Fetco CBS-51H", "Bunn TB3"],
  ]) {
    const { pg, sql } = await fresh();
    try {
      const id = await install(pg, "Rename Cafe", [{ equipment: from, powerVoltage: "208v" }]);
      const [unit] = (await readInspection(sql, id)).machines;
      await pass(pg, id, unit.equipmentId);
      const [row] = await stored(pg, id);
      assert.equal(row.unitId, unit.equipmentId);
      await save(pg, sql, id, [{ ...row, equipment: to }]);
      const units = await visit(pg, id);
      assert.deepEqual(units.map((u) => u.id), [unit.equipmentId], `${to}: the same unit, and only it`);
      assert.equal(units[0].equipment_name, to);
      assert.deepEqual((await stored(pg, id)).map((r) => [r.equipment, r.unitId]), [[to, unit.equipmentId]]);
      assert.equal((await readInspection(sql, id)).overall, "Passed");
    } finally {
      await pg.close();
    }
  }
});

test("a window opened before the rows had ids still keeps a renamed row on its unit", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Old Window Cafe", [{ equipment: "Fetco CBS-51H" }, { equipment: G9, serial: "G9X" }]);
    const fetco = (await readInspection(sql, id)).machines.find((m) => m.name === "Fetco CBS-51H").equipmentId;
    await pass(pg, id, fetco);
    // The window's rows carry no ids: it renames the first row and saves.
    await save(pg, sql, id, [
      { equipment: "Bunn TB3", serial: "", powerVoltage: "" },
      { equipment: G9, serial: "G9X", powerVoltage: "" },
    ]);
    assert.deepEqual((await stored(pg, id)).map((r) => [r.equipment, r.unitId === fetco]), [
      ["Bunn TB3", true],
      [G9, false],
    ]);
    assert.equal((await visit(pg, id)).length, 2);
  } finally {
    await pg.close();
  }
});

test("a row whose text no longer reads as its unit still comes off with it on a Pre-inspection Remove", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Fetco Cafe", [{ equipment: "Fetco CBS-51H" }, { equipment: "Bunn TB3" }]);
    const units = (await readInspection(sql, id)).machines;
    const fetco = units.find((m) => m.name === "Fetco CBS-51H").equipmentId;
    // The row was renamed by an older window ("Fetco 1251"); its id still names the Fetco unit.
    const rows = await stored(pg, id);
    await pg.query("update installs set machines = $2 where id = $1", [id, JSON.stringify(rows.map((r) => (r.unitId === fetco ? { ...r, equipment: "Fetco 1251" } : r)))]);
    assert.deepEqual((await stored(pg, id)).map((r) => r.equipment), ["Fetco 1251", "Bunn TB3"]);
    const view = await removeInspectionUnit(sql, { installId: id, equipmentId: fetco }, "Test");
    assert.equal(view.fromList, true);
    assert.deepEqual((await stored(pg, id)).map((r) => r.equipment), ["Bunn TB3"]);
    assert.deepEqual((await readInspection(sql, id)).machines.map((m) => m.name), ["Bunn TB3"]);
  } finally {
    await pg.close();
  }
});

test("the Equipment tab's Remove takes off the unit its row names by id", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Two TB3 Cafe", [
      { equipment: "Bunn TB3", serial: "T1" },
      { equipment: "Bunn TB3", serial: "T2" },
    ]);
    await readInspection(sql, id);
    const rows = await stored(pg, id);
    // The window's row reads T1; the server's row 0 was given a corrected serial meanwhile. The id still points at it.
    await pg.query("update installs set machines = $2 where id = $1", [id, JSON.stringify([{ ...rows[0], serial: "T1-A" }, rows[1]])]);
    const out = await removeInstallRow(sql, { installId: id, index: 0, equipment: "Bunn TB3", serial: "T1", unitId: rows[0].unitId }, "Test");
    assert.equal(out.removed, "Bunn TB3");
    assert.deepEqual((await stored(pg, id)).map((r) => r.serial), ["T2"]);
    assert.deepEqual((await visit(pg, id)).map((u) => u.id), [rows[1].unitId]);
  } finally {
    await pg.close();
  }
});

test("a save that leaves out a machine whose pre-inspection passed puts its row back, so the two tabs still match", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Kept Cafe", [
      { equipment: MAZZER, serial: "2626066" },
      { equipment: G9, serial: "G900046833" },
    ]);
    const units = (await readInspection(sql, id)).machines;
    const mazzer = units.find((m) => m.serial === "2626066").equipmentId;
    await pass(pg, id, mazzer);
    const rows = await stored(pg, id);
    // A window that never had the Mazzer saves its list.
    await save(pg, sql, id, rows.filter((r) => r.unitId !== mazzer));
    const after = await stored(pg, id);
    assert.deepEqual(after.map((r) => r.serial).sort(), ["2626066", "G900046833"]);
    assert.equal(after.find((r) => r.serial === "2626066").unitId, mazzer);
    assert.equal((await visit(pg, id)).length, 2);
    // A unit that did not pass goes with its row, as before.
    await save(pg, sql, id, after.filter((r) => r.serial !== "G900046833"));
    assert.deepEqual((await stored(pg, id)).map((r) => r.serial), ["2626066"]);
    assert.deepEqual((await visit(pg, id)).map((u) => u.id), [mazzer]);
  } finally {
    await pg.close();
  }
});

/** Install #135 as it is live: three rows, and a fourth unit (serial "L") on the pre-inspection only, passed. */
async function wayside(pg, sql) {
  const id = await install(pg, "Bar By The Wayside", [
    { equipment: MAZZER, serial: "2626066", powerVoltage: "120v" },
    { equipment: G9, serial: "G900046833", powerVoltage: "120v" },
    { equipment: ITCB, serial: "ITCB138003", powerVoltage: "220v" },
  ]);
  await readInspection(sql, id);
  const linea = (
    await pg.query(
      `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, electrical)
       values ('Bar By The Wayside', $1, $1, 'L', 'l', '208v') returning id`,
      [LINEA],
    )
  ).rows[0].id;
  await pg.query("insert into install_inspection_units (install_id, equipment_id, visit_kind) values ($1, $2, 'existing')", [id, linea]);
  return { id, linea };
}

test("a unit only on the pre-inspection is flagged for review, and finding it changes nothing", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea } = await wayside(pg, sql);
    const before = { list: await stored(pg, id), units: await visit(pg, id) };
    const found = await findUnitMismatches(sql);
    assert.deepEqual(found.map((f) => f.installId), [id]);
    assert.deepEqual(
      found[0].onlyOnPreInspection.map((u) => [u.equipmentId, u.name, u.serial, u.overall]),
      [[linea, LINEA, "L", "Passed"]],
    );
    assert.deepEqual(found[0].onlyOnList, []);
    assert.deepEqual({ list: await stored(pg, id), units: await visit(pg, id) }, before, "nothing was created or changed");
    // Loading the install flags it too, and still adds no row.
    const view = await readInspection(sql, id);
    assert.equal(view.machines.find((m) => m.equipmentId === linea).onList, false);
    assert.equal((await stored(pg, id)).length, 3);
    // A save from the window leaves it as it was: only a row the save took off comes back.
    await save(pg, sql, id, await stored(pg, id));
    assert.equal((await stored(pg, id)).length, 3);
    assert.equal((await visit(pg, id)).length, 4);
  } finally {
    await pg.close();
  }
});

test("Add to the equipment list gives the flagged unit its row, with its id, serial and voltage", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea } = await wayside(pg, sql);
    const view = await addUnitOntoList(sql, { installId: id, equipmentId: linea }, "Test");
    assert.ok(view.machines.every((m) => m.onList));
    const rows = await stored(pg, id);
    assert.deepEqual(rows.at(-1), { equipment: LINEA, serial: "L", powerVoltage: "208v", recipeId: null, unitId: linea });
    assert.equal((await visit(pg, id)).length, 4);
    assert.deepEqual(await findUnitMismatches(sql), []);
    await assert.rejects(() => addUnitOntoList(sql, { installId: id, equipmentId: linea }, "Test"), /already on the equipment list/);
  } finally {
    await pg.close();
  }
});

test("a row with no unit yet is flagged as on the equipment list only, without making the unit", async () => {
  const { pg, sql } = await fresh();
  try {
    // Never loaded: no pre-inspection units at all.
    const id = await install(pg, "New Cafe", [{ equipment: "Bunn TB3", serial: "T7" }]);
    const found = await findUnitMismatches(sql);
    assert.deepEqual(found.map((f) => [f.installId, f.onlyOnList.map((r) => [r.equipment, r.serial])]), [[id, [["Bunn TB3", "T7"]]]]);
    assert.equal((await visit(pg, id)).length, 0);
  } finally {
    await pg.close();
  }
});

const { editInspectionUnit, addMachineOntoInstall } = inspection;

/** updateInstallFor's sql: a tagged template as well as .query. */
const tagged = (sql) => Object.assign(async (strings, ...values) => sql.query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query: sql.query });

/** The install window's save as the window sends it: its rows, and the list it last saw on the server. */
async function windowSave(sql, id, rows, seen) {
  const packed = serializeMachines(rows);
  return api.updateInstallFor(tagged(sql), { id, ...packed, machinesBase: JSON.stringify(seen) }, { userId: "u-owner" });
}

async function openedWayside(pg, sql) {
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u-owner', 'chuy', true, true)");
  const id = await install(pg, "Bar By The Wayside", [
    { equipment: MAZZER, serial: "2626066", powerVoltage: "120V" },
    { equipment: G9, serial: "G900046833", powerVoltage: "120V" },
    { equipment: LINEA, serial: "L", powerVoltage: "208V" },
  ]);
  const view = await readInspection(sql, id);
  const unit = (name) => view.machines.find((m) => m.name === name).equipmentId;
  // The window opens on the list as stored, ids and all.
  return { id, opened: await stored(pg, id), linea: unit(LINEA), g9: unit(G9) };
}

test("a window left open saves only what it changed: a serial fixed, a machine added and one removed on the Pre-inspection since stay", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, opened, linea, g9 } = await openedWayside(pg, sql);
    // Elsewhere (the Pre-inspection tab, or another computer) while this window stays open:
    await editInspectionUnit(sql, { installId: id, equipmentId: linea, model: LINEA, serial: "LPB3-50112", electrical: "208V" }, "Tech", { owner: true });
    await removeInspectionUnit(sql, { installId: id, equipmentId: g9 }, "Tech", { owner: true });
    await addMachineOntoInstall(sql, { installId: id, model: "Bunn TB3", serial: "TB300777", electrical: "120V" }, "Tech", { owner: true });
    // The window then sets the Mazzer's plug and saves the list it has.
    await windowSave(sql, id, opened.map((r) => (r.equipment === MAZZER ? { ...r, plug: "5-15P" } : r)), opened);
    const rows = await stored(pg, id);
    assert.deepEqual(
      rows.map((r) => [r.equipment, r.serial, r.plug ?? ""]),
      [
        [MAZZER, "2626066", "5-15P"],
        [LINEA, "LPB3-50112", ""],
        ["Bunn TB3", "TB300777", ""],
      ],
    );
    assert.deepEqual(
      (await visit(pg, id)).map((u) => [u.equipment_name, u.serial]),
      [
        [MAZZER, "2626066"],
        [LINEA, "LPB3-50112"],
        ["Bunn TB3", "TB300777"],
      ],
    );
    assert.deepEqual(await findUnitMismatches(sql), []);
  } finally {
    await pg.close();
  }
});

test("a field the window changed itself still wins, and two saves before the window refreshes add a machine once", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, opened, linea } = await openedWayside(pg, sql);
    await editInspectionUnit(sql, { installId: id, equipmentId: linea, model: LINEA, serial: "LPB3-50112", electrical: "208V" }, "Tech", { owner: true });
    // Typed in the window after the fix elsewhere: the last one typed is the serial.
    await windowSave(sql, id, opened.map((r) => (r.unitId === linea ? { ...r, serial: "LPB3-50999" } : r)), opened);
    assert.equal((await stored(pg, id)).find((r) => r.unitId === linea).serial, "LPB3-50999");
    assert.equal((await visit(pg, id)).find((u) => u.id === linea).serial, "LPB3-50999");

    // The same window adds a machine, then saves again before its list refreshes from the server.
    const seen = await stored(pg, id);
    const added = [...seen, { equipment: "Bunn TB3", serial: "", powerVoltage: "" }];
    await windowSave(sql, id, added, seen);
    await windowSave(sql, id, added.map((r) => (r.equipment === MAZZER ? { ...r, plug: "5-15P" } : r)), seen);
    const rows = await stored(pg, id);
    assert.equal(rows.filter((r) => r.equipment === "Bunn TB3").length, 1);
    assert.equal(rows.find((r) => r.equipment === MAZZER).plug, "5-15P");
    assert.equal((await visit(pg, id)).filter((u) => u.equipment_name === "Bunn TB3").length, 1);
  } finally {
    await pg.close();
  }
});
