import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

register(new URL("./ts-alias-hook.mjs", import.meta.url));

// Keep this file off the preview database. db.ts boots PGLite on import when DATABASE_URL is unset.
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const machines = await import("../src/lib/ops/machines.ts");
const { specsFromInstall, installMachines } = machines;
const { catalogModels } = await import("../src/lib/ops/equipment.ts");

const TYPED = "Bunn ITCB 120v SN:ITCB064919\nBunn G9-2T SN:G900073972";

async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query(`insert into directory_equipment (name) values ('Bunn ITCB-DV, 29" w/Flip Tray'), ('Bunn G9-2T'), ('Bunn TB3')`);
  return pg;
}

/** The catalog listInstalls reads the board with (loadEquipCatalog in api.ts). */
async function boardCatalog(pg) {
  const dir = (await pg.query("select name from directory_equipment where archived = false and coalesce(name, '') <> ''")).rows;
  const assets = (await pg.query("select distinct model from assets where kind = 'equip' and coalesce(model, '') <> ''")).rows;
  return catalogModels([...dir.map((r) => r.name), ...assets.map((r) => r.model)]);
}

/** The install row the board and the install window get: mapInstall's machines are specsFromInstall of the row. */
async function boardRow(pg, id) {
  const r = (await pg.query("select * from installs where id = $1", [id])).rows[0];
  return {
    id: r.id,
    equipment: r.equipment,
    serial: r.serial,
    powerVoltage: r.power_voltage,
    machines: specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines, await boardCatalog(pg)),
  };
}

/** updateInstall's machine columns: a field left out of the save keeps what is stored. */
async function applySave(pg, id, d) {
  const c = (await pg.query("select * from installs where id = $1", [id])).rows[0];
  const pick = (key, col) => (d[key] === undefined ? c[col] : d[key]);
  await pg.query("update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5, notes = $6 where id = $1", [
    id,
    pick("equipment", "equipment"),
    pick("serial", "serial"),
    pick("powerVoltage", "power_voltage"),
    pick("machines", "machines"),
    pick("notes", "notes"),
  ]);
}

const stored = async (pg, id) => (await pg.query("select equipment, serial, power_voltage, machines from installs where id = $1", [id])).rows[0];

test("an install with serials typed on its lines loads each serial on its machine", async () => {
  const pg = await fresh();
  try {
    const id = (await pg.query("insert into installs (customer, equipment) values ('Tepatitlan Mexican Grill', $1) returning id", [TYPED])).rows[0].id;
    const row = await boardRow(pg, id);
    assert.deepEqual(
      row.machines.map((m) => [m.equipment, m.serial, m.powerVoltage]),
      [
        ["Bunn ITCB", "ITCB064919", "120v"],
        ["Bunn G9-2T", "G900073972", ""],
      ],
    );
  } finally {
    await pg.close();
  }
});

test("a serial typed on its own line belongs to the machine above it, not a machine named SN", () => {
  const catalog = ['Bunn ITCB-DV, 29" w/Flip Tray', "Bunn Axiom-APS"];
  const one = (list) => list.map((m) => [m.equipment, m.serial, m.powerVoltage]);
  assert.deepEqual(one(specsFromInstall("Bunn ITCB 120V\nSN:ITCB189507", null, null, null, catalog)), [["Bunn ITCB", "ITCB189507", "120V"]]);
  assert.deepEqual(one(installMachines({ equipment: "Bunn ITCB 120V\nSN:ITCB189507" }, catalog).machines), [["Bunn ITCB", "ITCB189507", "120V"]]);
  assert.deepEqual(one(specsFromInstall("Bunn Axiom-APS\nSN :AXAP049095", null, null, null, catalog)), [["Bunn Axiom-APS", "AXAP049095", ""]]);
  // Without a catalog too.
  assert.deepEqual(one(specsFromInstall("Fetco 52H\nSN:231515042", null, null, null)), [["Fetco 52H", "231515042", ""]]);
});

test("closing the install window saves no machine fields when the list is the one it loaded", async () => {
  const pg = await fresh();
  try {
    const id = (await pg.query("insert into installs (customer, equipment) values ('Tepatitlan Mexican Grill', $1) returning id", [TYPED])).rows[0].id;
    const before = await stored(pg, id);
    const row = await boardRow(pg, id);
    // What the window holds once it opens, and what its details form sends when it closes.
    const specs = machines.machinesOnOpen(row, await boardCatalog(pg));
    assert.deepEqual(
      specs.map((m) => m.serial),
      ["ITCB064919", "G900073972"],
    );
    const sent = { id, notes: "Gate code 4411", ...machines.changedMachineFields(specs, specs) };
    assert.deepEqual(Object.keys(sent), ["id", "notes"]);
    await applySave(pg, id, sent);
    assert.deepEqual(await stored(pg, id), before);
    assert.equal((await pg.query("select notes from installs where id = $1", [id])).rows[0].notes, "Gate code 4411");

    // A typed change still saves, with every machine's serial on the saved list.
    const edited = specs.map((m, i) => (i === 1 ? { ...m, powerVoltage: "120V" } : m));
    const changed = machines.changedMachineFields(edited, specs);
    assert.ok(changed.machines);
    await applySave(pg, id, { id, ...changed });
    const saved = machines.parseMachinesJson((await stored(pg, id)).machines);
    assert.deepEqual(
      saved.map((m) => [m.equipment, m.serial, m.powerVoltage]),
      [
        ["Bunn ITCB", "ITCB064919", "120v"],
        ["Bunn G9-2T", "G900073972", "120V"],
      ],
    );
  } finally {
    await pg.close();
  }
});

test("the install window's details form sends the machine list only when it changed", () => {
  const src = readFileSync(new URL("../src/components/desk/entity-sheets.tsx", import.meta.url), "utf8");
  const start = src.indexOf("export function InstallSheet(");
  const sheet = src.slice(start, src.indexOf("\nexport function ", start + 1));
  const submit = sheet.slice(sheet.indexOf("onSubmit={"), sheet.indexOf("<input type=\"hidden\" name=\"customer\""));
  assert.match(submit, /changedMachineFields\(specs, /);
  assert.doesNotMatch(submit, /serializeMachines\(specs\)/);
  assert.match(sheet, /machinesOnOpen\(/);
});
