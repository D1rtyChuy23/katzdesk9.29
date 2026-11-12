// Before the asset load (Chuy, 11/9): Remove retires a machine and keeps its record, the Equipment import reads a
// Part # column, and serials on more than one unit are listed. Made-up accounts and machines only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const R = await import("../src/lib/ops/account-equip-retire.ts");
const { renameOrMergeCustomer } = await import("../src/lib/ops/customer-identity.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function fresh() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.exec("create unique index if not exists directory_customers_name_lower_uidx on directory_customers (lower(name))");
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  const account = async (name) => Number((await query("insert into directory_customers (name) values ($1) returning id", [name]))[0].id);
  const unit = async (customer, model, serial, extra = {}) =>
    Number(
      (
        await query(
          "insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, install_date, ownership, part_number) values ($1, $2, $2, $3, $4, $5, $6, $7) returning id",
          [customer, model, serial, serial ? serial.toLowerCase() : null, extra.installDate ?? null, extra.ownership ?? null, extra.partNumber ?? null],
        )
      )[0].id,
    );
  return { pg, sql, query, account, unit };
}
const BY = { userId: "u-owner", name: "boss" };

test("migration 0125 only adds the retired-machines table", () => {
  const text = readFileSync(new URL("0125_account_equipment_retired.sql", MIGRATIONS), "utf8").replace(/--.*$/gm, "");
  const statements = text.split(";").map((s) => s.trim()).filter(Boolean);
  assert.ok(statements.length >= 1);
  for (const s of statements) assert.match(s, /^create (table|index) if not exists account_equipment_retired/, s.slice(0, 60));
});

test("Remove retires a machine: it leaves the account, and its record and inspection history are kept", async () => {
  const { pg, sql, query, account, unit } = await fresh();
  try {
    await account("Test Steakhouse");
    const install = Number((await query("insert into installs (customer, complete) values ('Test Steakhouse', true) returning id"))[0].id);
    const pm = Number((await query("insert into pm_jobs (customer, status) values ('Test Steakhouse', 'Completed') returning id"))[0].id);
    const id = await unit("Test Steakhouse", "Test Grinder", "TG-1", { installDate: "2025-11-14", ownership: "Loaned", partNumber: "33200.0000" });
    const other = await unit("Test Steakhouse", "Test Brewer", "TB-1");
    await query("insert into install_inspection_units (install_id, equipment_id, note) values ($1, $2, 'Test note')", [install, id]);
    await query("insert into install_inspection_items (install_id, equipment_id, category, status, notes) values ($1, $2, 'Water', 'Pass', 'Test water ok')", [install, id]);
    await query("insert into install_inspection_photos (install_id, equipment_id, category, caption, data_url) values ($1, $2, 'Water', 'Test photo', 'data:image/png;base64,AAAA')", [install, id]);
    await query("insert into pm_runbook_unit_links (pm_job_id, piece_key, account_equipment_id) values ($1, 'test-piece', $2)", [pm, id]);

    assert.deepEqual(await IMP.removeEquipmentUnit(sql, id, BY), { id });

    assert.deepEqual((await query("select id from account_equipment order by id")).map((r) => r.id), [other], "off the account, as before");
    assert.equal((await query("select count(*)::int as n from install_inspection_items"))[0].n, 0);
    const retired = await R.listRetiredUnits(sql, "test steakhouse");
    assert.equal(retired.length, 1);
    assert.deepEqual(
      { ...retired[0], id: 0, retiredAt: "" },
      { id: 0, unitId: id, customer: "Test Steakhouse", equipmentName: "Test Grinder", catalogModel: "Test Grinder", serial: "TG-1", partNumber: "33200.0000", ownership: "Loaned", installDate: "2025-11-14", retiredAt: "", retiredName: "boss", records: 4 },
    );
    assert.match(retired[0].retiredAt, /^\d{4}-\d{2}-\d{2}/);
    const kept = (await query("select unit, links from account_equipment_retired"))[0];
    assert.equal(kept.unit.part_number, "33200.0000");
    assert.deepEqual([kept.links.inspection_units.length, kept.links.inspection_items[0].notes, kept.links.inspection_photos[0].caption, kept.links.pm_links[0].piece_key], [1, "Test water ok", "Test photo", "test-piece"]);
    // Another account sees none of it.
    assert.deepEqual(await R.listRetiredUnits(sql, "Test Other Place"), []);

    // A locked unit, and one that isn't there, are refused as before, and nothing is retired.
    await query("update account_equipment set locked_at = now(), locked_by = 'boss' where id = $1", [other]);
    await assert.rejects(() => IMP.removeEquipmentUnit(sql, other, BY), /[Ll]ocked/);
    await assert.rejects(() => IMP.removeEquipmentUnit(sql, 999999, BY), /That unit is not on the account\./);
    assert.equal((await R.listRetiredUnits(sql, "Test Steakhouse")).length, 1);
  } finally {
    await pg.close();
  }
});

test("Put back returns a retired machine to its account with its record and history", async () => {
  const { pg, sql, query, account, unit } = await fresh();
  try {
    await account("Test Steakhouse");
    await account("Test Bean Cafe");
    const install = Number((await query("insert into installs (customer, complete) values ('Test Steakhouse', true) returning id"))[0].id);
    const gone = Number((await query("insert into installs (customer, complete) values ('Test Steakhouse', true) returning id"))[0].id);
    const id = await unit("Test Steakhouse", "Test Grinder", "TG-1", { installDate: "2025-11-14", ownership: "Loaned", partNumber: "33200.0000" });
    for (const i of [install, gone]) {
      await query("insert into install_inspection_units (install_id, equipment_id) values ($1, $2)", [i, id]);
      await query("insert into install_inspection_items (install_id, equipment_id, category, status) values ($1, $2, 'Water', 'Pass')", [i, id]);
    }
    await IMP.removeEquipmentUnit(sql, id, BY);
    const [{ id: retiredId }] = await R.listRetiredUnits(sql, "Test Steakhouse");
    await query("delete from installs where id = $1", [gone]);

    // The serial went onto another account meanwhile: refused, and nothing changes.
    const taken = await unit("Test Bean Cafe", "Test Grinder", "tg-1");
    await assert.rejects(() => R.restoreRetiredUnit(sql, retiredId), /^Error: SN TG-1 is on Test Bean Cafe now\. Remove it there first, or leave this one retired\.$/);
    assert.equal((await R.listRetiredUnits(sql, "Test Steakhouse")).length, 1);
    await query("delete from account_equipment where id = $1", [taken]);

    const back = await R.restoreRetiredUnit(sql, retiredId);
    assert.equal(back.id, id, "the same unit, so its installs and PMs find it again");
    assert.deepEqual((await query("select customer, equipment_name, serial, serial_key, install_date, ownership, part_number, locked_at from account_equipment where id = $1", [id]))[0], {
      customer: "Test Steakhouse", equipment_name: "Test Grinder", serial: "TG-1", serial_key: "tg-1", install_date: "2025-11-14", ownership: "Loaned", part_number: "33200.0000", locked_at: null,
    });
    // History comes back for the install that still exists; the deleted install's is left out.
    assert.deepEqual((await query("select install_id from install_inspection_units where equipment_id = $1", [id])).map((r) => r.install_id), [install]);
    assert.deepEqual((await query("select install_id, status from install_inspection_items where equipment_id = $1", [id])), [{ install_id: install, status: "Pass" }]);
    assert.deepEqual(await R.listRetiredUnits(sql, "Test Steakhouse"), []);
    await assert.rejects(() => R.restoreRetiredUnit(sql, retiredId), /^Error: That machine isn't on the retired list\.$/);

    // An account that is no longer on the list takes nothing back.
    const two = await unit("Test Bean Cafe", "Test Brewer", "TB-2");
    await IMP.removeEquipmentUnit(sql, two, BY);
    await query("update directory_customers set archived = true where name = 'Test Bean Cafe'");
    const [{ id: r2 }] = await R.listRetiredUnits(sql, "Test Bean Cafe");
    await assert.rejects(() => R.restoreRetiredUnit(sql, r2), /^Error: Test Bean Cafe is no longer on the customer list\.$/);
  } finally {
    await pg.close();
  }
});

test("retired machines follow their account through a rename", async () => {
  const { pg, sql, account, unit } = await fresh();
  try {
    const acct = await account("Test Diner - Old");
    const id = await unit("Test Diner - Old", "Test Brewer", "TB-7");
    await IMP.removeEquipmentUnit(sql, id, BY);
    await renameOrMergeCustomer(sql, acct, "Test Diner - New");
    assert.equal((await R.listRetiredUnits(sql, "Test Diner - New")).length, 1);
    const [{ id: retiredId }] = await R.listRetiredUnits(sql, "Test Diner - New");
    assert.equal((await R.restoreRetiredUnit(sql, retiredId)).id, id);
  } finally {
    await pg.close();
  }
});

test("the Equipment import reads a Part # column", async () => {
  const { records } = IMP.parseEquipMatrix([
    ["Customer", "Model", "Serial #", "Part #", "Install Date"],
    ["Test Steakhouse", "Test Grinder", "TG-1", " 33200.0000  ", "11/14/2025"],
    ["Test Steakhouse", "Test Brewer", "TB-1", "", ""],
  ]);
  assert.deepEqual(records.map((r) => r.partNumber), ["33200.0000", ""]);
  for (const header of ["Part Number", "Part No.", "PN", "part num"]) {
    assert.equal(IMP.parseEquipMatrix([["Customer", "Model", "Serial", header], ["Test Steakhouse", "Test Grinder", "TG-1", "X-1"]]).records[0].partNumber, "X-1", header);
  }
  // A file without the column reads as before.
  assert.equal(IMP.parseEquipMatrix([["Customer", "Model", "Serial"], ["Test Steakhouse", "Test Grinder", "TG-1"]]).records[0].partNumber, "");

  const accounts = [{ id: 1, name: "Test Steakhouse" }];
  const row = (partNumber) => IMP.buildPreviewRow({ customer: "Test Steakhouse", equipmentName: "", model: "Test Grinder", serial: "TG-1", installDate: "", electrical: "", ownership: "", partNumber }, 0, accounts, ["Test Grinder"], []);
  assert.equal(row("  PN   123 ").partNumber, "PN 123");
  assert.equal(row("").partNumber, null);
  assert.equal(row("").action, "add");
  const long = row("X".repeat(61));
  assert.deepEqual([long.partNumber, long.action, long.reviewReasons], [null, "review", ["The part number is too long (60 characters at most)."]]);

  const { pg, query, unit } = await fresh();
  try {
    const id = await unit("Test Steakhouse", "Test Grinder", "TG-1", { partNumber: "OLD-1" });
    const read = async (unitId) => (await query("select part_number from account_equipment where id = $1", [unitId]))[0].part_number;
    // No Part # in the file: the unit keeps its own.
    await query(IMP.importUpdateUnitSql(), [id, "Test Grinder", "Test Grinder", "TG-1", "tg-1", null, null, null, null, null]);
    assert.equal(await read(id), "OLD-1");
    await query(IMP.importUpdateUnitSql(), [id, "Test Grinder", "Test Grinder", "TG-1", "tg-1", null, null, null, "NEW-2", null]);
    assert.equal(await read(id), "NEW-2");
    // A new unit from the file takes its Part #.
    await query(IMP.importInsertUnitsSql(2), ["Test Steakhouse", "Test Brewer", "Test Brewer", "TB-1", "tb-1", null, null, null, "B-9", null, "Test Steakhouse", "Test Brewer", "Test Brewer", null, null, null, null, null, null, null]);
    assert.deepEqual((await query("select serial, part_number from account_equipment where catalog_model = 'Test Brewer' order by id")), [{ serial: "TB-1", part_number: "B-9" }, { serial: null, part_number: null }]);
  } finally {
    await pg.close();
  }
  const imp = src("src/lib/ops/account-equip-import.ts");
  assert.match(imp, /await sql\.query\(importUpdateUnitSql\(\), \[unit\.existingId, catalogModel, equipmentName, serial, key, installDate, electrical, ownership, partNumber, condition\]\)/);
  assert.match(imp, /await sql\.query\(importInsertUnitsSql\(slice\.length\), slice\.flat\(\)\)/);
  assert.match(src("src/components/desk/account-equip-import.tsx"), /Part #/);
});

test("serials on more than one unit are listed, with each unit's account", async () => {
  const { pg, sql, account, unit } = await fresh();
  try {
    const steak = await account("Test Steakhouse");
    const cafe = await account("Test Bean Cafe");
    const a = await unit("Test Steakhouse", "Test Grinder", "TG-1");
    const b = await unit("Test Bean Cafe", "Test Grinder", "tg-1");
    const c = await unit("Test Bean Cafe", "Test Grinder FPG", "TG-1");
    await unit("Test Steakhouse", "Test Brewer", "TB-1");
    await unit("Test Steakhouse", "Test Brewer", null);
    await unit("Test Bean Cafe", "Test Brewer", null);
    const found = await R.listDuplicateSerials(sql);
    assert.deepEqual(found, [
      {
        serialKey: "tg-1",
        units: [
          { id: b, customer: "Test Bean Cafe", customerId: cafe, equipmentName: "Test Grinder", serial: "tg-1", installDate: null, locked: false },
          { id: c, customer: "Test Bean Cafe", customerId: cafe, equipmentName: "Test Grinder FPG", serial: "TG-1", installDate: null, locked: false },
          { id: a, customer: "Test Steakhouse", customerId: steak, equipmentName: "Test Grinder", serial: "TG-1", installDate: null, locked: false },
        ],
      },
    ]);
  } finally {
    await pg.close();
  }
});

test("the screens offer the retired list, Put back and the duplicate-serial list", () => {
  const list = src("src/components/desk/account-history.tsx");
  assert.match(list, /data-testid="account-equipment-retired"/);
  assert.match(list, /data-testid="put-back-unit"/);
  // Remove says what it does now.
  assert.match(list, /It moves to this account's Retired list, with its record, and can be put back\./);
  const page = src("src/routes/_app/unit-mismatches.tsx");
  assert.match(page, /data-testid="duplicate-serials"/);
  assert.match(page, /getDuplicateSerials/);
  assert.match(src("src/lib/ops/account-equip-import.ts"), /\.handler\(async \(\{ data, context \}\) => removeEquipmentUnit\(await ready\(\), data\.id, await retiredBy\(await ready\(\), context\.userId\)\)\)/);
});
