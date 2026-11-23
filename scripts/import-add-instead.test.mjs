// Equipment import: "Add as new unit instead" (Chuy, 11/23). A file row with a serial no unit has can fill a serial-less
// unit of the same model on that account ("fill-blank"). That stays the default, but the row can be added as its own
// unit instead: SAGE Dining's serial-less "Swift Grinder #2" mustn't take #1's SN 6803. Same-serial matches, the
// "Serial already on X" review, catalog pairing and site holds are unchanged. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const AE = await import("../src/lib/ops/account-equip.ts");
const IMP = await import("../src/lib/ops/account-equip-import.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const CAFE = "Zz Dining at Test Church S0319";
const GRINDER = "Zz Swift Grinder";
const unitOf = (id, name, serial, customer = CAFE) => ({ id, customer, catalogModel: GRINDER, equipmentName: name, serial, serialKey: AE.serialKey(serial) });

test("matchExistingUnit says when an update only fills a blank serial", () => {
  const existing = [unitOf(1, "Zz Swift Grinder #2", null), unitOf(2, "Zz Swift Grinder #3", "SN-777")];
  const fill = AE.matchExistingUnit({ customer: CAFE, catalogModel: GRINDER, equipmentName: "Zz Swift Grinder #1", serial: "6803", existing });
  assert.deepEqual(fill, { action: "update", existingId: 1, foreignAccount: null, matchKind: "fill-blank" });
  const same = AE.matchExistingUnit({ customer: CAFE, catalogModel: GRINDER, equipmentName: "anything", serial: " sn-777 ", existing });
  assert.deepEqual(same, { action: "update", existingId: 2, foreignAccount: null, matchKind: "same-serial" });
  const fresh = AE.matchExistingUnit({ customer: CAFE, catalogModel: GRINDER, equipmentName: "x", serial: "9999", existing: [unitOf(2, "y", "SN-777")] });
  assert.deepEqual(fresh, { action: "add", existingId: null, foreignAccount: null, matchKind: null });
  const foreign = AE.matchExistingUnit({ customer: CAFE, catalogModel: GRINDER, equipmentName: "x", serial: "SN-777", existing: [unitOf(2, "y", "SN-777", "Other Place")] });
  assert.equal(foreign.matchKind, null);
  assert.equal(foreign.action, "review");
});

test("the preview offers Add as new unit instead only on a fill-blank row, naming the unit, off by default", () => {
  const accounts = [{ id: 1, name: CAFE, address: null }];
  const existing = [unitOf(1, "Zz Swift Grinder #2", null), unitOf(2, "Zz Swift Grinder #3", "SN-777")];
  const rec = (equipmentName, serial) => ({ customer: CAFE, equipmentName, model: GRINDER, serial, installDate: "", electrical: "", ownership: "", partNumber: "", condition: "", site: "" });
  const fill = IMP.buildPreviewRow(rec("Zz Swift Grinder #1", "6803"), 0, accounts, [GRINDER], existing);
  assert.equal(fill.action, "update");
  assert.deepEqual(fill.fillBlank, { id: 1, name: "Zz Swift Grinder #2" });
  assert.equal(fill.addInstead, false);
  const same = IMP.buildPreviewRow(rec("Zz Swift Grinder #3", "SN-777"), 1, accounts, [GRINDER], existing);
  assert.equal(same.action, "update");
  assert.equal(same.fillBlank, null, "a same-serial match never offers it");
});

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const n of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(n, dir), "utf8"));
  await pg.query("insert into directory_customers (name) values ($1)", [CAFE]);
  await pg.query("insert into directory_equipment (name) values ($1)", [GRINDER]);
  const blank = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, 'Zz Swift Grinder #2', null, null) returning id", [CAFE, GRINDER])).rows[0].id;
  const sql = { query: async (t, p) => (await pg.query(t, p)).rows };
  return { pg, sql, blank };
}
const applyRow = (o = {}) => ({
  key: "r0",
  fileCustomer: CAFE,
  customer: CAFE,
  equipmentName: "Zz Swift Grinder #1",
  fileModel: GRINDER,
  catalogModel: GRINDER,
  serial: "6803",
  installDate: null,
  ownership: null,
  action: "update",
  existingId: null,
  ...o,
});

test("unchecked: the file row fills the blank unit, as before", async () => {
  const { pg, sql, blank } = await db();
  try {
    const r = await IMP.applyAccountEquipImportFor(sql, { rows: [applyRow()] });
    assert.deepEqual([r.added, r.updated], [0, 1]);
    const rows = await sql.query("select id, equipment_name, serial from account_equipment order by id");
    assert.deepEqual(rows.map((x) => [x.id, x.equipment_name, x.serial]), [[blank, "Zz Swift Grinder #1", "6803"]]);
  } finally {
    await pg.close();
  }
});

test("checked: the file row is added as its own unit and the blank unit is left as it was", async () => {
  const { pg, sql, blank } = await db();
  try {
    const before = (await sql.query("select * from account_equipment where id = $1", [blank]))[0];
    const r = await IMP.applyAccountEquipImportFor(sql, { rows: [applyRow({ addInstead: true })] });
    assert.deepEqual([r.added, r.updated], [1, 0]);
    const rows = await sql.query("select id, equipment_name, serial from account_equipment order by id");
    assert.deepEqual(rows.map((x) => [x.equipment_name, x.serial]), [["Zz Swift Grinder #2", null], ["Zz Swift Grinder #1", "6803"]]);
    assert.deepEqual((await sql.query("select * from account_equipment where id = $1", [blank]))[0], before, "the blank unit is untouched");
  } finally {
    await pg.close();
  }
});

test("the choice only counts on a fill-blank row: a same-serial match still updates, a foreign serial is still skipped", async () => {
  const { pg, sql } = await db();
  try {
    const has = (await sql.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ($1, $2, 'Zz Swift Grinder #4', 'G-44', 'g-44') returning id", [CAFE, GRINDER]))[0].id;
    await sql.query("insert into directory_customers (name) values ('Zz Other Place')");
    await sql.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Zz Other Place', $1, 'Theirs', 'F-1', 'f-1')", [GRINDER]);
    const r = await IMP.applyAccountEquipImportFor(sql, {
      rows: [applyRow({ key: "a", equipmentName: "Zz Swift Grinder #4", serial: "G-44", addInstead: true }), applyRow({ key: "b", serial: "F-1", addInstead: true })],
    });
    assert.deepEqual([r.added, r.updated, r.skipped], [0, 1, 1]);
    assert.equal((await sql.query("select count(*)::int as n from account_equipment where serial_key = 'g-44'"))[0].n, 1);
    assert.equal(Number(has) > 0, true);
  } finally {
    await pg.close();
  }
});

test("the preview screen has the checkbox and sends the choice", () => {
  const ui = src("src/components/desk/account-equip-import.tsx");
  assert.match(ui, /data-testid="equip-add-instead"/);
  assert.match(ui, /Add as new unit instead/);
  assert.match(ui, /addInstead: !!d\.addInstead/);
});
