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

test("a window opened before the rows had ids: a renamed row takes no other machine's unit, and a passed machine keeps its own row", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Old Window Cafe", [{ equipment: "Fetco CBS-51H" }, { equipment: G9, serial: "G9X" }]);
    const fetco = (await readInspection(sql, id)).machines.find((m) => m.name === "Fetco CBS-51H").equipmentId;
    await pass(pg, id, fetco);
    // The window's rows carry no ids: it shows a TB3 where the Fetco is (renamed there, or swapped since elsewhere).
    await save(pg, sql, id, [
      { equipment: "Bunn TB3", serial: "", powerVoltage: "" },
      { equipment: G9, serial: "G9X", powerVoltage: "" },
    ]);
    const rows = await stored(pg, id);
    assert.deepEqual(rows.map((r) => r.equipment), ["Bunn TB3", G9, "Fetco CBS-51H"]);
    assert.notEqual(rows[0].unitId, fetco);
    assert.equal(rows[2].unitId, fetco);
    // The Fetco's unit is still a Fetco: a row only at the same place never renames another machine's unit.
    assert.equal((await visit(pg, id)).find((u) => u.id === fetco).equipment_name, "Fetco CBS-51H");
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

const { linkVisitUnit, linkableSerialOwner, removeInspectionUnit: takeOffVisit } = inspection;
const { machinesBeforeSave } = await import("../src/lib/ops/install-form.ts");
const TB3 = "Bunn TB3";

/** A failed check with a note: something recorded on the unit, not a pass. */
const record = (pg, id, equipmentId) =>
  pg.query("insert into install_inspection_items (install_id, equipment_id, category, status, notes) values ($1, $2, 'water', 'Fail', 'leaks')", [id, equipmentId]);
const ownerOnce = async (pg) => {
  const has = (await pg.query("select 1 from desk_accounts where user_id = 'u-owner'")).rows.length;
  if (!has) await pg.query("insert into desk_accounts (user_id, username, approved, is_admin) values ('u-owner', 'chuy', true, true)");
};

test("a read never moves a row to another unit: a check on the second of two plain TB3s leaves both rows on their own units", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Twin Cafe", [
      { equipment: TB3, ownership: "Sold", recipeId: 1 },
      { equipment: TB3, ownership: "Loaned", recipeId: 2 },
    ]);
    await readInspection(sql, id);
    const opened = await stored(pg, id);
    await record(pg, id, opened[1].unitId);
    await readInspection(sql, id);
    assert.deepEqual((await stored(pg, id)).map((r) => [r.ownership, r.unitId]), opened.map((r) => [r.ownership, r.unitId]));
    // The window that opened before the check sets the Sold row's plug: it lands on the Sold row.
    await ownerOnce(pg);
    const next = opened.map((r, i) => (i === 0 ? { ...r, plug: "5-15P" } : r));
    await windowSave(sql, id, machinesBeforeSave(next, opened, await stored(pg, id)), opened);
    assert.deepEqual((await stored(pg, id)).map((r) => [r.ownership, r.recipeId, r.plug ?? ""]), [
      ["Sold", 1, "5-15P"],
      ["Loaned", 2, ""],
    ]);
    // Remove on the Sold row takes the Sold row off.
    await removeInstallRow(sql, { installId: id, index: 0, equipment: TB3, serial: "", unitId: opened[0].unitId }, "Test", { owner: true });
    assert.deepEqual((await stored(pg, id)).map((r) => r.ownership), ["Loaned"]);
  } finally {
    await pg.close();
  }
});

test("an Equipment-tab Remove of the inspected one of two plain twins keeps its checks on the row that stays, and the window's save agrees", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    // Both TB3s were on the account before this install (imported): taking one off the visit leaves it on the account.
    for (let i = 0; i < 2; i++) await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Acct Cafe', $1, $1)", [TB3]);
    const id = await install(pg, "Acct Cafe", [{ equipment: TB3 }, { equipment: TB3 }]);
    await readInspection(sql, id);
    const opened = await stored(pg, id);
    const [u1, u2] = opened.map((r) => r.unitId);
    await record(pg, id, u1);
    await removeInstallRow(sql, { installId: id, index: 0, equipment: TB3, serial: "", unitId: u1 }, "Test", { owner: true });
    // The window's own save follows in the same queue, with the list it opened on as its base.
    await windowSave(sql, id, opened.slice(1), opened);
    assert.deepEqual((await stored(pg, id)).map((r) => [r.equipment, r.unitId]), [[TB3, u2]]);
    assert.deepEqual((await visit(pg, id)).map((u) => u.id), [u2]);
    const items = (await pg.query("select equipment_id, status, notes from install_inspection_items where install_id = $1 and status <> 'Not inspected'", [id])).rows;
    assert.deepEqual(items, [{ equipment_id: u2, status: "Fail", notes: "leaks" }]);
  } finally {
    await pg.close();
  }
});

test("a unit flagged on the pre-inspection only never takes over a row of its model, on a load or a save", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Flag Cafe", [{ equipment: TB3 }, { equipment: G9, serial: "G9X" }]);
    await readInspection(sql, id);
    const own = (await stored(pg, id))[0].unitId;
    const off = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Flag Cafe', $1, $1) returning id", [TB3])).rows[0].id;
    await pg.query("insert into install_inspection_units (install_id, equipment_id, note) values ($1, $2, 'old unit')", [id, off]);
    await record(pg, id, own);
    const view = await readInspection(sql, id);
    assert.equal((await stored(pg, id))[0].unitId, own);
    assert.deepEqual(view.machines.filter((m) => !m.onList).map((m) => m.equipmentId), [off]);
    const rows = await stored(pg, id);
    await windowSave(sql, id, rows, rows);
    assert.equal((await stored(pg, id))[0].unitId, own);
    assert.equal((await pg.query("select count(*)::int as n from install_inspection_items where install_id = $1 and equipment_id = $2 and status = 'Fail'", [id, own])).rows[0].n, 1);
    assert.ok((await visit(pg, id)).some((u) => u.id === off), "the flagged unit waits for review");
  } finally {
    await pg.close();
  }
});

test("two saves before the window reads back: the second, sent with the first as its base, can put a field back", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Quick Cafe", [{ equipment: TB3, serial: "T1" }]);
    await readInspection(sql, id);
    const seen = await stored(pg, id);
    const first = seen.map((r) => ({ ...r, recipeId: 5, plug: "L6-30P" }));
    await windowSave(sql, id, first, seen);
    await windowSave(sql, id, seen.map((r) => ({ ...r, recipeId: null, plug: "" })), first);
    const [row] = await stored(pg, id);
    assert.equal(row.recipeId ?? null, null);
    assert.equal(row.plug ?? "", "");
  } finally {
    await pg.close();
  }
});

test("taking the last row off in a window keeps a machine added on the Pre-inspection since", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Last Cafe", [{ equipment: TB3, serial: "T1" }]);
    await readInspection(sql, id);
    const seen = await stored(pg, id);
    await addMachineOntoInstall(sql, { installId: id, model: "Fetco CBS-51H", serial: "F1", electrical: "" }, "Tech", { owner: true });
    const fetco = (await visit(pg, id)).find((u) => u.serial === "F1").id;
    await record(pg, id, fetco);
    await removeInstallRow(sql, { installId: id, index: 0, equipment: TB3, serial: "T1", unitId: seen[0].unitId }, "Test", { owner: true });
    await windowSave(sql, id, [], seen);
    assert.deepEqual((await stored(pg, id)).map((r) => r.serial), ["F1"]);
    assert.ok((await visit(pg, id)).some((u) => u.id === fetco));
  } finally {
    await pg.close();
  }
});

test("a window that opened before the ids, saved after a machine was swapped on the Pre-inspection, renames nothing", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Old Cafe", [{ equipment: MAZZER, serial: "M1" }, { equipment: TB3 }]);
    await readInspection(sql, id);
    const tb3 = (await stored(pg, id))[1].unitId;
    await takeOffVisit(sql, { installId: id, equipmentId: tb3 }, "Tech", { owner: true });
    await addMachineOntoInstall(sql, { installId: id, model: "Fetco CBS-51H", serial: "", electrical: "" }, "Tech", { owner: true });
    const fetco = (await stored(pg, id))[1].unitId;
    await record(pg, id, fetco);
    // An old browser: no ids, no base.
    const packed = serializeMachines([
      { equipment: MAZZER, serial: "M1", powerVoltage: "", plug: "5-15P" },
      { equipment: TB3, serial: "", powerVoltage: "" },
    ]);
    await api.updateInstallFor(tagged(sql), { id, ...packed }, { userId: "u-owner" });
    // An old window's list can still drop a machine it never saw (as before ids); it never renames that machine's unit.
    const unit = (await pg.query("select equipment_name from account_equipment where id = $1", [fetco])).rows[0];
    assert.ok(!unit || unit.equipment_name === "Fetco CBS-51H", unit?.equipment_name);
    assert.ok(!(await visit(pg, id)).some((u) => u.id === fetco && u.equipment_name !== "Fetco CBS-51H"));
  } finally {
    await pg.close();
  }
});

test("the install window: its baseline follows every field and id, each save sends the list it was built on, a refused one hands its base on, and a read waits for the window's own saves", () => {
  const src = readFileSync(new URL("../src/components/desk/entity-sheets.tsx", import.meta.url), "utf8");
  const start = src.indexOf("export function InstallSheet(");
  const sheet = src.slice(start, src.indexOf("\nexport function ", start + 1));
  assert.match(sheet, /const machineSig = JSON\.stringify\(row\?\.machines \?\? \[\]\);/);
  assert.match(sheet, /\}, \[row\?\.id, hydratedId, machineSig\]\);/);
  assert.match(sheet, /if \(pending\.current\.get\(row\.id\)\) return;/);
  const send = sheet.slice(sheet.indexOf("function listSend"), sheet.indexOf("function persistMachines"));
  assert.match(send, /const builtOn = knownServer\(id\);/);
  assert.match(send, /sentAhead\.current = true;\s*seenServer\.current = \{ id, rows \};\s*return \{ builtOn, sent: rows \};/);
  const persist = sheet.slice(sheet.indexOf("function persistMachines"), sheet.indexOf("return (", sheet.indexOf("function persistMachines")));
  assert.match(persist, /\.\.\.listSend\(current\.id, next\),/);
  const save = sheet.slice(sheet.indexOf("const save = useMutation("), sheet.indexOf("const canLock"));
  assert.match(save, /machinesBase: JSON\.stringify\(baseOf\(builtOn\)\)/);
  assert.match(save, /refused\.current\.set\(vars\.sent, vars\.builtOn\);/);
  assert.match(save, /onSettled: \(_data, _error, vars\) => \{/);
  // A Remove's follow-up save takes off the row with its unit, or that very row, and never guesses a twin by model.
  const without = src.slice(src.indexOf("function withoutRow("), src.indexOf("\n}\n", src.indexOf("function withoutRow(")));
  assert.doesNotMatch(without, /equipment ===/);
});

// --- Linking a machine to the account's unit it is (Bar By The Wayside: the Linea "L" and the account's PB001708). ---

/** #135 as it is live: the Linea "L" passed on the pre-inspection only, and two records on the account with SN PB001708. */
async function waysideWithCopies(pg, sql, copies = 2) {
  const { id, linea } = await wayside(pg, sql);
  const pb = [];
  for (let i = 0; i < copies; i++) {
    pb.push(
      (
        await pg.query(
          `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Bar By The Wayside', $1, $1, 'PB001708', 'pb001708') returning id`,
          [LINEA],
        )
      ).rows[0].id,
    );
  }
  await pg.query("insert into install_inspection_photos (install_id, equipment_id, category, data_url) values ($1, $2, 'space', 'data:image/png;base64,AA')", [id, linea]);
  return { id, linea, pb };
}

const accountUnits = async (pg, customer) =>
  (await pg.query("select id, equipment_name, serial from account_equipment where lower(customer) = lower($1) order by id", [customer])).rows;

test("the account's copies of PB001708 are offered for the Linea L, on the Equipment tab and in the review, and finding them changes nothing", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea, pb } = await waysideWithCopies(pg, sql);
    const before = await accountUnits(pg, "Bar By The Wayside");
    const view = await readInspection(sql, id);
    assert.deepEqual(view.accountMatches, [{ equipmentId: pb[0], name: LINEA, serial: "PB001708", records: 2, forUnits: [linea] }]);
    const found = await findUnitMismatches(sql);
    assert.deepEqual(found.map((f) => [f.installId, f.onAccount]), [[id, [{ name: LINEA, serial: "PB001708", records: 2, machines: [`${LINEA} SN L`] }]]]);
    assert.deepEqual(await accountUnits(pg, "Bar By The Wayside"), before);
  } finally {
    await pg.close();
  }
});

test("Edit on the Pre-inspection: PB001708 on the Linea L is refused as a copy, then linking makes one Linea PB001708 on both tabs", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea, pb } = await waysideWithCopies(pg, sql);
    const edit = { installId: id, equipmentId: linea, model: LINEA, serial: "PB001708", electrical: "208v" };
    await assert.rejects(() => editInspectionUnit(sql, edit, "Tech", { owner: true }), /SN PB001708 is already on Bar By The Wayside/);
    const owner = await linkableSerialOwner(sql, { installId: id, equipmentId: linea, serial: "PB001708" });
    assert.deepEqual(owner, { equipmentId: pb[0], name: LINEA, serial: "PB001708", records: 2, onVisit: false });
    const view = await linkVisitUnit(sql, { installId: id, fromEquipmentId: linea, toEquipmentId: owner.equipmentId, addRow: true }, "Tech", { owner: true });
    const lin = view.machines.find((m) => m.name === LINEA);
    assert.equal(lin.equipmentId, pb[0]);
    assert.equal(lin.serial, "PB001708");
    assert.equal(lin.overall, "Passed");
    assert.equal(lin.photoCount, 1);
    assert.ok(view.machines.every((m) => m.onList));
    assert.deepEqual((await stored(pg, id)).at(-1), { equipment: LINEA, serial: "PB001708", powerVoltage: "208v", recipeId: null, unitId: pb[0] });
    // One record of the machine on the account: the L and the second copy were merged into it.
    assert.deepEqual((await accountUnits(pg, "Bar By The Wayside")).filter((u) => u.equipment_name === LINEA).map((u) => [u.id, u.serial]), [[pb[0], "PB001708"]]);
    assert.deepEqual(await findUnitMismatches(sql), []);
  } finally {
    await pg.close();
  }
});

test("linking from the Equipment tab: the account's unit takes the visit's checks, and the review then shows it to add to the list", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea, pb } = await waysideWithCopies(pg, sql, 1);
    const view = await linkVisitUnit(sql, { installId: id, fromEquipmentId: linea, toEquipmentId: pb[0] }, "Tech", { owner: true });
    assert.deepEqual(view.machines.filter((m) => !m.onList).map((m) => [m.equipmentId, m.serial, m.overall]), [[pb[0], "PB001708", "Passed"]]);
    assert.deepEqual(view.accountMatches, []);
    const added = await addUnitOntoList(sql, { installId: id, equipmentId: pb[0] }, "Tech");
    assert.ok(added.machines.every((m) => m.onList));
    assert.deepEqual(await findUnitMismatches(sql), []);
  } finally {
    await pg.close();
  }
});

test("a unit another open install's pre-inspection has is not linked from here", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea, pb } = await waysideWithCopies(pg, sql, 1);
    const other = await install(pg, "Bar By The Wayside", [{ equipment: LINEA, serial: "PB001708" }]);
    await readInspection(sql, other);
    assert.ok((await visit(pg, other)).some((u) => u.id === pb[0]));
    assert.equal(await linkableSerialOwner(sql, { installId: id, equipmentId: linea, serial: "PB001708" }), null);
    assert.deepEqual((await readInspection(sql, id)).accountMatches, []);
    await assert.rejects(
      () => linkVisitUnit(sql, { installId: id, fromEquipmentId: linea, toEquipmentId: pb[0] }, "Tech", { owner: true }),
      new RegExp(`on install #${other}'s pre-inspection`),
    );
  } finally {
    await pg.close();
  }
});

test("PB001708 typed on the Linea L's row: the row becomes the account's unit, the L waits on the pre-inspection, and Same machine links them", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const { id, linea, pb } = await waysideWithCopies(pg, sql, 1);
    await addUnitOntoList(sql, { installId: id, equipmentId: linea }, "Tech");
    const seen = await stored(pg, id);
    await windowSave(sql, id, seen.map((r) => (r.unitId === linea ? { ...r, serial: "PB001708" } : r)), seen);
    const rows = await stored(pg, id);
    assert.equal(rows.length, 4, "no second Linea row");
    assert.equal(rows.at(-1).unitId, pb[0]);
    const view = await readInspection(sql, id);
    const l = view.machines.find((m) => m.equipmentId === linea);
    assert.equal(l.onList, false);
    assert.deepEqual(l.sameAs, [{ equipmentId: pb[0], name: LINEA, serial: "PB001708" }]);
    const linked = await linkVisitUnit(sql, { installId: id, fromEquipmentId: linea, toEquipmentId: pb[0] }, "Tech", { owner: true });
    assert.deepEqual(linked.machines.map((m) => [m.name, m.serial, m.onList]), [
      [MAZZER, "2626066", true],
      [G9, "G900046833", true],
      [ITCB, "ITCB138003", true],
      [LINEA, "PB001708", true],
    ]);
    assert.equal(linked.machines.at(-1).overall, "Passed");
    assert.equal((await stored(pg, id)).length, 4);
  } finally {
    await pg.close();
  }
});

test("Remove while a refresh lands: the save that follows is the window's list as it is then, based on what the server last took", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Race Cafe", [{ equipment: MAZZER, serial: "M1" }, { equipment: TB3 }]);
    await readInspection(sql, id);
    const opened = await stored(pg, id);
    // The window adds a Fetco and saves; the server took it, so that list is the next save's base.
    const added = [...opened, { equipment: "Fetco CBS-51H", serial: "", powerVoltage: "" }];
    await windowSave(sql, id, added, opened);
    // The board's refresh lands (the window's rows now carry the Fetco's id), then Remove on the TB3 runs.
    const refreshed = await stored(pg, id);
    await removeInstallRow(sql, { installId: id, index: 1, equipment: TB3, serial: "", unitId: opened[1].unitId }, "Test", { owner: true });
    await windowSave(sql, id, refreshed.filter((r) => r.equipment !== TB3), refreshed);
    assert.deepEqual((await stored(pg, id)).map((r) => r.equipment), [MAZZER, "Fetco CBS-51H"]);
  } finally {
    await pg.close();
  }
});

test("a refused save takes nothing: the corrected save, based on what the server last had, keeps a machine added with it", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    await pg.query(
      "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Other Cafe', 'Fetco CBS-51H', 'Fetco CBS-51H', 'F-OTHER', 'f-other')",
    );
    const id = await install(pg, "Refuse Cafe", [{ equipment: MAZZER, serial: "M1" }]);
    await readInspection(sql, id);
    const opened = await stored(pg, id);
    const tried = [...opened, { equipment: TB3, serial: "", powerVoltage: "" }, { equipment: "Fetco CBS-51H", serial: "F-OTHER", powerVoltage: "" }];
    await assert.rejects(() => windowSave(sql, id, tried, opened), /already on Other Cafe/);
    await windowSave(sql, id, tried.map((r) => (r.serial === "F-OTHER" ? { ...r, serial: "" } : r)), opened);
    assert.deepEqual((await stored(pg, id)).map((r) => r.equipment), [MAZZER, TB3, "Fetco CBS-51H"]);
  } finally {
    await pg.close();
  }
});

test("the real serial typed over L on the Equipment tab keeps the checks recorded on L, and Same machine as moves them over", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Serial Cafe", [{ equipment: LINEA, serial: "L" }]);
    await readInspection(sql, id);
    const pb = (
      await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Serial Cafe', $1, $1, 'PB001708', 'pb001708') returning id", [LINEA])
    ).rows[0].id;
    const seen = await stored(pg, id);
    const l = seen[0].unitId;
    await record(pg, id, l); // a failed check: recorded, not passed
    await windowSave(sql, id, [{ ...seen[0], serial: "PB001708" }], seen);
    assert.deepEqual((await stored(pg, id)).map((r) => [r.serial, r.unitId]), [["PB001708", pb]]);
    const view = await readInspection(sql, id);
    const flagged = view.machines.find((m) => m.equipmentId === l);
    assert.equal(flagged.onList, false);
    assert.deepEqual(flagged.sameAs.map((c) => c.equipmentId), [pb]);
    await linkVisitUnit(sql, { installId: id, fromEquipmentId: l, toEquipmentId: pb }, "Tech", { owner: true });
    const items = (await pg.query("select equipment_id, status from install_inspection_items where install_id = $1 and status <> 'Not inspected'", [id])).rows;
    assert.deepEqual(items, [{ equipment_id: pb, status: "Fail" }]);
    assert.deepEqual((await visit(pg, id)).map((u) => u.id), [pb]);
  } finally {
    await pg.close();
  }
});

test("a link that can't go through changes nothing: a locked machine, or a copy another open install has", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea, pb } = await waysideWithCopies(pg, sql);
    await pg.query("update account_equipment set locked_at = now(), locked_by = 'chuy' where id = $1", [linea]);
    const before = await accountUnits(pg, "Bar By The Wayside");
    await assert.rejects(() => linkVisitUnit(sql, { installId: id, fromEquipmentId: linea, toEquipmentId: pb[0] }, "Tech", { owner: true }), /locked/);
    assert.deepEqual(await accountUnits(pg, "Bar By The Wayside"), before);
    await pg.query("update account_equipment set locked_at = null, locked_by = null where id = $1", [linea]);
    // The second copy is on another open install's pre-inspection.
    const other = await install(pg, "Bar By The Wayside", [{ equipment: MAZZER, serial: "OTHER1" }]);
    await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [other, pb[1]]);
    await assert.rejects(
      () => linkVisitUnit(sql, { installId: id, fromEquipmentId: linea, toEquipmentId: pb[0] }, "Tech", { owner: true }),
      new RegExp(`install #${other}'s pre-inspection`),
    );
    assert.deepEqual(await accountUnits(pg, "Bar By The Wayside"), before);
  } finally {
    await pg.close();
  }
});

test("merging a copy of the serial carries its PM runbook ticks to the record that stays", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea, pb } = await waysideWithCopies(pg, sql);
    const pm = (await pg.query("insert into pm_jobs (customer, equipment, status) values ('Bar By The Wayside', $1, 'Scheduled') returning id", [LINEA])).rows[0].id;
    await pg.query("insert into pm_runbook_checks (pm_job_id, unit_key, key) values ($1, $2, 'step:brew-grease')", [pm, `acct:${pb[1]}`]);
    await linkVisitUnit(sql, { installId: id, fromEquipmentId: linea, toEquipmentId: pb[0] }, "Tech", { owner: true });
    const ticks = (await pg.query("select unit_key, key from pm_runbook_checks where pm_job_id = $1", [pm])).rows;
    assert.deepEqual(ticks, [{ unit_key: `acct:${pb[0]}`, key: "step:brew-grease" }]);
  } finally {
    await pg.close();
  }
});

test("a serial typed by mistake that belongs to another kind of machine on the account is not offered to link", async () => {
  const { pg, sql } = await fresh();
  try {
    const { id, linea } = await waysideWithCopies(pg, sql, 0);
    // 2626066 is the Mazzer's serial: typed on the Linea, it is not that machine.
    assert.equal(await linkableSerialOwner(sql, { installId: id, equipmentId: linea, serial: "2626066" }), null);
    assert.equal(await linkableSerialOwner(sql, { installId: id, equipmentId: linea, serial: "2626066", model: LINEA }), null);
  } finally {
    await pg.close();
  }
});

test("a save built on an older read keeps what a save the server took since changed, and adds its own edit", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Fast Cafe", [{ equipment: MAZZER, serial: "M1" }, { equipment: TB3, serial: "T1" }]);
    await readInspection(sql, id);
    const z = await stored(pg, id);
    // Save A: a recipe on the TB3 and a Fetco added. The server took it.
    await windowSave(sql, id, [...z.map((r) => (r.serial === "T1" ? { ...r, recipeId: 5 } : r)), { equipment: "Fetco CBS-51H", serial: "", powerVoltage: "" }], z);
    // Save B was built on the read from before A (an older list): it only sets the Mazzer's plug.
    await windowSave(sql, id, z.map((r) => (r.serial === "M1" ? { ...r, plug: "5-15P" } : r)), z);
    assert.deepEqual((await stored(pg, id)).map((r) => [r.equipment, r.recipeId ?? null, r.plug ?? ""]), [
      [MAZZER, null, "5-15P"],
      [TB3, 5, ""],
      ["Fetco CBS-51H", null, ""],
    ]);
  } finally {
    await pg.close();
  }
});

test("Remove of one of two twin rows the window holds without ids leaves the other: the follow-up save's merge drops only the removed one", async () => {
  const { pg, sql } = await fresh();
  try {
    await ownerOnce(pg);
    const id = await install(pg, "Twin Rows Cafe", [{ equipment: TB3 }, { equipment: TB3 }]);
    await readInspection(sql, id);
    const windowRows = [
      { equipment: TB3, serial: "", powerVoltage: "" },
      { equipment: TB3, serial: "", powerVoltage: "" },
    ];
    await removeInstallRow(sql, { installId: id, index: 0, equipment: TB3, serial: "" }, "Test", { owner: true });
    // The window couldn't tell which copy it removed, so it sends both, on the list it opened with.
    await windowSave(sql, id, windowRows, windowRows);
    assert.deepEqual((await stored(pg, id)).map((r) => r.equipment), [TB3]);
    assert.equal((await visit(pg, id)).length, 1);
  } finally {
    await pg.close();
  }
});
