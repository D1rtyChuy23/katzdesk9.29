// Fixes from the 11/12 review of #127 (Chuy): a removed machine stays retired when a completed install that listed it
// is opened again, and the Equipment import keeps a Part # as the file shows it. Made-up accounts and machines only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import * as XLSX from "xlsx";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const R = await import("../src/lib/ops/account-equip-retire.ts");
const INS = await import("../src/lib/ops/inspection-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await query("insert into directory_customers (name) values ('Test Steakhouse')");
  const install = async (complete, equipment, serial) =>
    Number((await query("insert into installs (customer, complete, equipment, serial) values ('Test Steakhouse', $1, $2, $3) returning id", [complete, equipment, serial]))[0].id);
  const unit = async (model, serial) =>
    Number(
      (
        await query(
          "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, install_date) values ('Test Steakhouse', $1, $1, $2, $3, '2025-01-01') returning id",
          [model, serial, serial ? serial.toLowerCase() : null],
        )
      )[0].id,
    );
  return { pg, sql, query, install, unit };
}
const BY = { userId: "u-owner", name: "boss" };
const units = async (query) => query("select id, serial, install_date from account_equipment order by id");

test("a completed install that listed a removed machine doesn't make it again, and Put back still works", async () => {
  const { pg, sql, query, install, unit } = await fresh();
  try {
    const done = await install(true, "Test Grinder", "TG-1");
    const id = await unit("Test Grinder", "TG-1");
    await INS.syncInstallUnits(sql, done);
    await IMP.removeEquipmentUnit(sql, id, BY);
    // Opening the completed install's visit again reads its list: the retired grinder is not made again.
    await INS.readInspection(sql, done);
    await INS.readInspection(sql, done);
    assert.deepEqual(await units(query), []);
    const [{ id: retiredId }] = await query("select id from account_equipment_retired");
    assert.deepEqual(await R.restoreRetiredUnit(sql, retiredId), { id });
    assert.deepEqual(await units(query), [{ id, serial: "TG-1", install_date: "2025-01-01" }]);
    // Back on the account, the completed install finds it as before.
    await INS.readInspection(sql, done);
    assert.deepEqual(await units(query), [{ id, serial: "TG-1", install_date: "2025-01-01" }]);
  } finally {
    await pg.close();
  }
});

test("a machine with no serial stays retired too; another machine on the same completed install is unchanged", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const done = Number(
      (await query("insert into installs (customer, complete, equipment, serial, machines) values ('Test Steakhouse', true, 'Test Grinder / Test Brewer', null, null) returning id"))[0].id,
    );
    await INS.syncInstallUnits(sql, done);
    const before = await query("select id, catalog_model from account_equipment order by id");
    assert.equal(before.length, 2);
    const grinder = before.find((u) => u.catalog_model === "Test Grinder").id;
    await IMP.removeEquipmentUnit(sql, grinder, BY);
    await INS.readInspection(sql, done);
    const after = await query("select id, catalog_model from account_equipment order by id");
    assert.deepEqual(after.map((u) => u.catalog_model), ["Test Brewer"]);
  } finally {
    await pg.close();
  }
});

test("an open install still adds a machine typed onto its list, even one retired from the account", async () => {
  const { pg, sql, query, install, unit } = await fresh();
  try {
    const open = await install(false, "Test Grinder", "TG-1");
    const id = await unit("Test Grinder", "TG-1");
    await INS.syncInstallUnits(sql, open);
    await IMP.removeEquipmentUnit(sql, id, BY);
    // Someone types it back onto the open install's list.
    await query("update installs set equipment = 'Test Grinder', serial = 'TG-1' where id = $1", [open]);
    await INS.syncInstallUnits(sql, open);
    assert.equal((await units(query)).length, 1);
  } finally {
    await pg.close();
  }
});

const asBase64 = (wb) => XLSX.write(wb, { type: "base64", bookType: "xlsx" });

test("the Equipment import keeps a Part # as the file shows it: zeros after the point and before the number", () => {
  const csv = "Customer,Model,Serial,Part #\nTest Steakhouse,Test Grinder,TG-1,33200.0000\nTest Steakhouse,Test Grinder,TG-2,00123\nTest Steakhouse,Test Grinder,TG-3,20201.1000\nTest Steakhouse,Test Grinder,123456789012,X-1\n";
  const { matrix, shown } = IMP.fileToMatrix(Buffer.from(csv).toString("base64"));
  const { records } = IMP.parseEquipMatrix(matrix, shown);
  assert.deepEqual(records.map((r) => r.partNumber), ["33200.0000", "00123", "20201.1000", "X-1"]);
  // A long serial still reads as its digits, not as the "1.23457E+11" a spreadsheet shows.
  assert.equal(records[3].serial, "123456789012");

  const ws = XLSX.utils.aoa_to_sheet([
    ["Customer", "Model", "Serial", "Part #"],
    ["Test Steakhouse", "Test Grinder", "TG-4", 20201.1],
    ["Test Steakhouse", "Test Grinder", "TG-5", "33200.0000"],
    ["Test Steakhouse", "Test Grinder", "TG-6", 123456789012],
  ]);
  ws.D2.z = "0.0000";
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Units");
  const xl = IMP.fileToMatrix(asBase64(wb));
  assert.deepEqual(IMP.parseEquipMatrix(xl.matrix, xl.shown).records.map((r) => r.partNumber), ["20201.1000", "33200.0000", "123456789012"]);
});

// Second review (11/12) of the fix above.
test("a retired machine's row on a completed install doesn't write its serial onto another unit of the same model", async () => {
  const { pg, sql, query, install, unit } = await fresh();
  try {
    const done = await install(true, "Test Grinder", "TG-1");
    const id = await unit("Test Grinder", "TG-1");
    await INS.syncInstallUnits(sql, done);
    await IMP.removeEquipmentUnit(sql, id, BY);
    const other = await unit("Test Grinder", null);
    await INS.readInspection(sql, done);
    assert.deepEqual(await units(query), [{ id: other, serial: null, install_date: "2025-01-01" }]);
    const [{ id: retiredId }] = await query("select id from account_equipment_retired");
    assert.deepEqual(await R.restoreRetiredUnit(sql, retiredId), { id });
  } finally {
    await pg.close();
  }
});

test("a retired machine whose serial was corrected on the account since stays retired on the completed install", async () => {
  const { pg, sql, query, install } = await fresh();
  try {
    const done = await install(true, "Test Grinder", "L");
    await INS.syncInstallUnits(sql, done);
    const [{ id }] = await query("select id from account_equipment");
    await query("update account_equipment set serial = 'TG-100', serial_key = 'tg-100' where id = $1", [id]);
    await IMP.removeEquipmentUnit(sql, id, BY);
    await INS.readInspection(sql, done);
    assert.deepEqual(await units(query), []);
  } finally {
    await pg.close();
  }
});

test("a list save on a completed install keeps its retired row retired and makes a machine typed onto the list", async () => {
  const { pg, sql, query } = await fresh();
  try {
    const done = Number((await query("insert into installs (customer, complete, equipment, serial) values ('Test Steakhouse', true, 'Test Grinder', null) returning id"))[0].id);
    await INS.syncInstallUnits(sql, done);
    const [{ id }] = await query("select id from account_equipment");
    await IMP.removeEquipmentUnit(sql, id, BY);
    // An old list with no unit ids: the stored row is the retired grinder.
    await query("update installs set machines = null where id = $1", [done]);
    const before = { equipment: "Test Grinder", serial: null, power_voltage: null, machines: null };
    await INS.syncInstallUnits(sql, done, { prune: true, before });
    assert.deepEqual(await units(query), [], "the same list saved again");
    await query("update installs set equipment = 'Test Grinder / Test Grinder', machines = null where id = $1", [done]);
    await INS.syncInstallUnits(sql, done, { prune: true, before });
    assert.equal((await units(query)).length, 1, "a second grinder typed onto the list is made");
  } finally {
    await pg.close();
  }
});

test("a Part # shown with commas, a currency or a percent reads as before; one written with its zeros keeps them", () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Customer", "Model", "Serial", "Part #"],
    ["Test Steakhouse", "Test Grinder", "TG-7", 33200],
    ["Test Steakhouse", "Test Grinder", "TG-8", 1234.5],
    ["Test Steakhouse", "Test Grinder", "TG-9", 123],
  ]);
  ws.D2.z = "#,##0";
  ws.D3.z = '"$"#,##0.00';
  ws.D4.z = "00000";
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Units");
  const xl = IMP.fileToMatrix(asBase64(wb));
  assert.deepEqual(IMP.parseEquipMatrix(xl.matrix, xl.shown).records.map((r) => r.partNumber), ["33200", "1234.5", "00123"]);
});
