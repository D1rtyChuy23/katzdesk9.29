// Equipment import: "#1" and "#2" are two machines on the account's existing units too (Chuy, 11/23, left over from
// #188): two serial-less rows no longer both land on one unnamed unit. "#02" is "#2", and "No. 2" is "#2". Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const AE = await import("../src/lib/ops/account-equip.ts");
const IMP = await import("../src/lib/ops/account-equip-import.ts");

const CAFE = "Zz Dining S0319";
const G = "Zz Swift Grinder";
const accounts = [{ id: 1, name: CAFE, address: null }];
const rec = (equipmentName, serial) => ({ customer: CAFE, equipmentName, model: G, serial: serial ?? "", installDate: "", electrical: "", ownership: "", partNumber: "", condition: "", site: "" });
const unitOf = (id, name, serial = null) => ({ id, customer: CAFE, catalogModel: G, equipmentName: name, serial, serialKey: AE.serialKey(serial) || null, lockedBy: null });

test("unitNumber reads #n and No. n, without leading zeros; a model's own digits are not a unit number", () => {
  assert.equal(AE.unitNumber("Zz Swift Grinder #2"), "2");
  assert.equal(AE.unitNumber("Zz Swift Grinder # 02"), "2");
  assert.equal(AE.unitNumber("Zz Swift Grinder No. 3"), "3");
  assert.equal(AE.unitNumber("Linea 2AV"), null);
  assert.equal(AE.unitNumber("G9-2T"), null);
  assert.equal(AE.unitNumber("Zz Swift Grinder"), null);
  assert.equal(AE.fileNameKey("Zz Swift Grinder #02"), AE.fileNameKey("Zz Swift Grinder #2"));
});

test("two serial-less rows #1 and #2 and one unnamed unit: #1 takes the unit, #2 is an add, in the preview and the save", async () => {
  const rows = IMP.previewRowsInFileOrder([rec("Zz Swift Grinder #1"), rec("Zz Swift Grinder #2")], accounts, [G], [unitOf(1, G)]);
  assert.deepEqual(rows.map((r) => [r.action, r.existingId]), [["update", 1], ["add", null]]);
  const { pg, sql } = await db();
  try {
    await sql.query("insert into account_equipment (customer, catalog_model, equipment_name) values ($1, $2, $2)", [CAFE, G]);
    const r = await IMP.applyAccountEquipImportFor(sql, { rows: [applyRow("r0", "Zz Swift Grinder #1", null, { action: "update", existingId: 1 }), applyRow("r1", "Zz Swift Grinder #2", null)] });
    assert.deepEqual([r.added, r.updated], [1, 1]);
    assert.deepEqual((await sql.query("select equipment_name from account_equipment order by id")).map((u) => u.equipment_name), ["Zz Swift Grinder #1", "Zz Swift Grinder #2"]);
  } finally {
    await pg.close();
  }
});

test("a row with a serial still fills a serial-less unit with another number, as #187 chose (the box keeps it apart)", () => {
  assert.equal(AE.matchExistingUnit({ customer: CAFE, catalogModel: G, equipmentName: "Zz Swift Grinder #1", serial: "6803", existing: [unitOf(1, "Zz Swift Grinder #2")] }).matchKind, "fill-blank");
});

test("a serial-less row matches a unit by name only when their numbers agree", () => {
  const m = (row, unit) => AE.matchExistingUnit({ customer: CAFE, catalogModel: G, equipmentName: row, serial: null, existing: [unitOf(1, unit)] }).action;
  assert.equal(m("Zz Swift Grinder #1", "Zz Swift Grinder #2"), "add");
  assert.equal(m("Zz Swift Grinder #2", "Zz Swift Grinder No. 2"), "update");
  assert.equal(m("Zz Swift Grinder #1", G), "update");
  assert.equal(m(G, "Zz Swift Grinder #1"), "update");
});

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  await pg.query("insert into directory_customers (name) values ($1)", [CAFE]);
  await pg.query("insert into directory_equipment (name) values ($1)", [G]);
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}
const applyRow = (key, equipmentName, serial, o = {}) => ({ key, fileCustomer: CAFE, customer: CAFE, equipmentName, fileModel: G, catalogModel: G, serial, installDate: null, ownership: null, action: "add", existingId: null, ...o });
