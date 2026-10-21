// Install equipment: list edits and Merge never delete a unit the account had before, or the install's only row.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
register(new URL("./ts-alias-hook.mjs", import.meta.url));
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";
const { readInspection, syncInstallUnits, removeInstallRow } = await import("../src/lib/ops/inspection-api.ts");
const { mergeEquipmentUnits } = await import("../src/lib/ops/account-equip-import.ts");
const machines = await import("../src/lib/ops/machines.ts");
const { catalogModels, savedMachineName } = await import("../src/lib/ops/equipment.ts");
async function fresh() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Bunn TB3'), ('Fetco 52H')");
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}
const acct = async (pg, c) => (await pg.query("select id, equipment_name, serial, created_by_install from account_equipment where lower(customer)=lower($1) order by id", [c])).rows;
async function saveList(pg, sql, id, specs) {
  const cat = catalogModels((await pg.query("select name from directory_equipment")).rows.map((d) => d.name));
  const before = (await pg.query("select equipment, serial, power_voltage, machines from installs where id=$1", [id])).rows[0];
  const packed = machines.serializeMachines(specs);
  const mj = JSON.stringify(machines.parseMachinesJson(packed.machines).map((s) => ({ ...s, equipment: savedMachineName(s.equipment, cat) })));
  await pg.query("update installs set equipment=$2, serial=$3, power_voltage=$4, machines=$5 where id=$1", [id, packed.equipment, packed.serial, packed.powerVoltage, mj]);
  await syncInstallUnits(sql, id, { prune: true, before });
}
test("a save that drops one of two same-model rows keeps an imported unit on the account", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Two Cafe','Bunn TB3','Bunn TB3'), ('Two Cafe','Bunn TB3','Bunn TB3')");
  const id = (await pg.query("insert into installs (customer, equipment) values ('Two Cafe', $1) returning id", ["Bunn TB3\nBunn TB3"])).rows[0].id;
  await readInspection(sql, id);
  await saveList(pg, sql, id, [{ equipment: "Bunn TB3", serial: "", powerVoltage: "" }]);
  const after = await acct(pg, "Two Cafe");
  assert.equal(after.length, 2, "imported unit (created_by_install null) was deleted from the account");
});
test("Equipment-tab Remove keeps a unit the account had before the install", async () => {
  const { pg, sql } = await fresh();
  await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Rm Cafe','Fetco 52H','Fetco 52H')");
  const id = (await pg.query("insert into installs (customer, equipment) values ('Rm Cafe', $1) returning id", ["Bunn TB3\nFetco 52H"])).rows[0].id;
  await readInspection(sql, id);
  await removeInstallRow(sql, { installId: id, index: 1, equipment: "Fetco 52H", serial: "" }, "t");
  const after = await acct(pg, "Rm Cafe");
  assert.ok(after.some((a) => a.equipment_name === "Fetco 52H"), "imported Fetco 52H deleted by row Remove");
});
test("Merge keeps the install's only row when the kept unit had no row of its own", async () => {
  const { pg, sql } = await fresh();
  const rows = [{ equipment: "Bunn TB3", serial: "TB3-12345", powerVoltage: "120V", recipeId: 7, ownership: "Sold", uid: "u-tb3", confirmedAt: "2026-10-01" }];
  const id = (await pg.query("insert into installs (customer, equipment, machines) values ('Merge Cafe', 'Bunn TB3', $1) returning id", [JSON.stringify(rows)])).rows[0].id;
  await readInspection(sql, id);
  const [d] = await acct(pg, "Merge Cafe");
  // A second, serial-less TB3 on the account with a check recorded on this visit (old matching / added on pre-inspection).
  const k = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Merge Cafe','Bunn TB3','Bunn TB3') returning id")).rows[0].id;
  await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1,$2)", [id, k]);
  await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1,$2,'electrical','Passed')", [id, k]);
  await readInspection(sql, id);
  await mergeEquipmentUnits(sql, k, d.id); // keep the one with the check, drop the duplicate
  const after = (await pg.query("select equipment, machines from installs where id=$1", [id])).rows[0];
  await readInspection(sql, id);
  assert.ok(machines.parseMachinesJson(after.machines).length === 1, "the install lost its only machine row (and its recipe/uid tie)");
});
test("Merge with no serials, both units checked, keeps the install's only row", async () => {
  const { pg, sql } = await fresh();
  const rows = [{ equipment: "Bunn TB3", serial: "", powerVoltage: "120V", recipeId: 7, ownership: "Sold", uid: "u-tb3", confirmedAt: "2026-10-01" }];
  const id = (await pg.query("insert into installs (customer, equipment, machines) values ('Merge Cafe', 'Bunn TB3', $1) returning id", [JSON.stringify(rows)])).rows[0].id;
  await readInspection(sql, id);
  const [d] = await acct(pg, "Merge Cafe");
  await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1,$2,'water','Passed')", [id, d.id]);
  const k = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name) values ('Merge Cafe','Bunn TB3','Bunn TB3') returning id")).rows[0].id;
  await pg.query("insert into install_inspection_units (install_id, equipment_id) values ($1,$2)", [id, k]);
  await pg.query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1,$2,'electrical','Passed')", [id, k]);
  await readInspection(sql, id);
  await mergeEquipmentUnits(sql, k, d.id);
  const after = (await pg.query("select equipment, machines from installs where id=$1", [id])).rows[0];
  await readInspection(sql, id);
  assert.ok(machines.parseMachinesJson(after.machines).length === 1, "the install lost its only machine row (recipe, ownership, uid tie)");
});
