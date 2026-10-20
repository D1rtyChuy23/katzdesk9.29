import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const { addMachineOntoInstall, readInspection } = await import("../src/lib/ops/inspection-api.ts");
const { mergeEquipmentUnits, removeEquipmentUnit } = await import("../src/lib/ops/account-equip-import.ts");
const { formMachines } = await import("../src/lib/ops/install-form-api.ts");
const { groupFormRows } = await import("../src/lib/ops/install-form.ts");
const { parseMachinesJson } = await import("../src/lib/ops/machines.ts");

const ITCB_CATALOG = 'Bunn ITCB-DV, 29" w/Flip Tray';

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ($1), ('Bunn G9-2T'), ('Bunn TB3')", [ITCB_CATALOG]);
  const sql = { query: async (text, params) => (await pg.query(text, params)).rows };
  return { pg, sql };
}

async function install(pg, customer, equipment) {
  return (await pg.query("insert into installs (customer, equipment) values ($1, $2) returning id", [customer, equipment])).rows[0].id;
}

/** The body of one component function in a .tsx file, from its signature to the next top-level function. */
function componentSource(file, name) {
  const src = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = src.indexOf(`export function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const end = src.indexOf("\nexport function ", start + 1);
  return src.slice(start, end < 0 ? undefined : end);
}

/** Each useEffect(...) call in the source, parentheses balanced. */
function effects(src) {
  const out = [];
  for (let at = src.indexOf("useEffect("); at >= 0; at = src.indexOf("useEffect(", at + 1)) {
    let depth = 0;
    let i = at + "useEffect".length;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    out.push(src.slice(at, i + 1));
  }
  return out;
}

test("opening an install sheet saves nothing: no effect in InstallSheet writes the machine list", () => {
  const found = effects(componentSource("../src/components/desk/entity-sheets.tsx", "InstallSheet"));
  assert.ok(found.length > 0);
  for (const body of found) {
    assert.doesNotMatch(body, /persistMachines\(|save\.mutate\(|updateInstall\(/, body.slice(0, 200));
  }
});

test("pre-inspection Add equipment keeps the serials typed on the install's lines, and adds the machine once", async () => {
  const { pg, sql } = await fresh();
  try {
    const typed = "Bunn ITCB 120v SN:ITCB064919\nBunn G9-2T SN:G900073972";
    const id = await install(pg, "Tepatitlan Mexican Grill", typed);
    const view = await addMachineOntoInstall(sql, { installId: id, model: "Bunn TB3", serial: null, electrical: null }, "Test");
    assert.equal(view.machineCount, 3);
    const row = (await pg.query("select equipment, machines, serial from installs where id = $1", [id])).rows[0];
    const machines = parseMachinesJson(row.machines);
    assert.deepEqual(
      machines.map((m) => [m.equipment, m.serial]),
      [
        ["Bunn ITCB", "ITCB064919"],
        ["Bunn G9-2T", "G900073972"],
        ["Bunn TB3", ""],
      ],
    );
    assert.equal(row.equipment, `${typed}\nBunn TB3`);
    // The serials reach pre-inspection, and the next load adds nothing.
    const again = await readInspection(sql, id);
    assert.deepEqual(again.machines.map((m) => m.serial ?? "").sort(), ["", "G900073972", "ITCB064919"]);
    const units = (await pg.query("select count(*)::int as n from account_equipment")).rows[0].n;
    assert.equal(units, 3);
  } finally {
    await pg.close();
  }
});

test("Merge into the serial row keeps the pre-inspection result and does not add the unit back", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Cheeks Coffee", "Bunn ITCB");
    const imported = (
      await pg.query(
        "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cheeks Coffee', $1, 'Bunn ITCB-DV', 'ITCB075996', 'itcb075996') returning id",
        [ITCB_CATALOG],
      )
    ).rows[0].id;
    let view = await readInspection(sql, id);
    const unit = view.machines.find((m) => !m.serial);
    for (const item of [...unit.items, unit.core]) {
      await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, $3, 'Pass')", [
        id,
        unit.equipmentId,
        item.category,
      ]);
    }
    await pg.query("update install_inspection_units set core_needed = 'no', note = 'Left of the sink' where install_id = $1", [id]);
    view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => m.overall), ["Passed"]);

    await mergeEquipmentUnits(sql, imported, unit.equipmentId);
    view = await readInspection(sql, id);
    assert.deepEqual(
      view.machines.map((m) => [m.equipmentId, m.serial, m.overall, m.note]),
      [[imported, "ITCB075996", "Passed", "Left of the sink"]],
    );
    assert.equal(view.overall, "Passed");
    const units = (await pg.query("select id from account_equipment where customer = 'Cheeks Coffee'")).rows;
    assert.deepEqual(units.map((u) => u.id), [imported]);
  } finally {
    await pg.close();
  }
});

test("Merge puts the kept serial on the install in place of the dropped one", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (
      await pg.query("insert into installs (customer, equipment, machines) values ('Cheeks Coffee', 'Bunn ITCB', $1) returning id", [
        JSON.stringify([{ equipment: "Bunn ITCB", serial: "L", powerVoltage: "" }]),
      ])
    ).rows[0].id;
    const imported = (
      await pg.query(
        "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Cheeks Coffee', $1, 'Bunn ITCB-DV', 'ITCB075996', 'itcb075996') returning id",
        [ITCB_CATALOG],
      )
    ).rows[0].id;
    const [short] = (await readInspection(sql, id)).machines;
    assert.equal(short.serial, "L");
    await mergeEquipmentUnits(sql, imported, short.equipmentId);
    const view = await readInspection(sql, id);
    assert.deepEqual(view.machines.map((m) => [m.equipmentId, m.serial]), [[imported, "ITCB075996"]]);
    const machines = parseMachinesJson((await pg.query("select machines from installs where id = $1", [id])).rows[0].machines);
    assert.deepEqual(machines.map((m) => m.serial), ["ITCB075996"]);
  } finally {
    await pg.close();
  }
});

test("Merge keeps the dropped unit's note on a visit both units are on", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "Two Bunn Cafe", "Bunn ITCB\nBunn ITCB");
    const view = await readInspection(sql, id);
    const [keep, drop] = view.machines.map((m) => m.equipmentId);
    await pg.query("update install_inspection_units set note = 'Back counter', visit_kind = 'existing' where install_id = $1 and equipment_id = $2", [
      id,
      drop,
    ]);
    await mergeEquipmentUnits(sql, keep, drop);
    const link = (await pg.query("select note, visit_kind from install_inspection_units where install_id = $1 and equipment_id = $2", [id, keep])).rows;
    assert.deepEqual(link, [{ note: "Back counter", visit_kind: "existing" }]);
  } finally {
    await pg.close();
  }
});

async function eversys(pg, serial, moduleId) {
  const id = (
    await pg.query(
      "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Bean Bar', 'Eversys e''4s', 'Eversys e''4s', $1, lower($1)) returning id",
      [serial],
    )
  ).rows[0].id;
  if (moduleId) {
    await pg.query(
      "insert into modules (module_id, status, assigned_customer, assigned_unit_id) values ($1, 'Installed at Account', 'Bean Bar', $2)",
      [moduleId, id],
    );
  }
  return id;
}

test("Merge moves an Eversys module onto the kept unit", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await eversys(pg, "0110710025266E0006");
    const drop = await eversys(pg, "L", "M-1");
    await mergeEquipmentUnits(sql, keep, drop);
    assert.equal((await pg.query("select assigned_unit_id from modules where module_id = 'M-1'")).rows[0].assigned_unit_id, keep);
  } finally {
    await pg.close();
  }
});

test("Remove refuses a unit that still has an Eversys module on it", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await eversys(pg, "0110710025266E0006", "M-1");
    await assert.rejects(() => removeEquipmentUnit(sql, id), /Eversys module M-1 is still on this unit/);
    assert.equal((await pg.query("select count(*)::int as n from account_equipment where id = $1", [id])).rows[0].n, 1);
  } finally {
    await pg.close();
  }
});

test("the printed request form lists a one-ITCB install once", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(pg, "La Michoacana #52", "Bunn ITCB 220V");
    const view = await readInspection(sql, id);
    assert.equal(view.machines.length, 1);
    const row = (await pg.query("select id, equipment, serial, power_voltage, machines from installs where id = $1", [id])).rows[0];
    const folded = await formMachines(sql, row, view);
    const rows = groupFormRows(folded.rows.map((r) => ({ model: r.equipment, serial: r.serial, notes: "", voltage: r.powerVoltage, plug: r.plug ?? "" })));
    assert.deepEqual(
      rows.map((r) => [r.qty, r.equipment, r.outlet]),
      [[1, "BUNN ITCB", "220V"]],
    );
  } finally {
    await pg.close();
  }
});
