// Equipment import: the preview follows the file in order, the way the save does (Chuy, 11/23, quirks from #187's
// review). A serial-less unit one row fills isn't offered to the next row; a row added earlier in the same file is
// filled only by a row with its own name. Made-up data.
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

const CAFE = "Zz Dining S0319";
const G = "Zz Swift Grinder";
const accounts = [{ id: 1, name: CAFE, address: null }];
const rec = (equipmentName, serial) => ({ customer: CAFE, equipmentName, model: G, serial: serial ?? "", installDate: "", electrical: "", ownership: "", partNumber: "", condition: "", site: "" });
const unitOf = (id, name, serial) => ({ id, customer: CAFE, catalogModel: G, equipmentName: name, serial, serialKey: AE.serialKey(serial) });

test("two rows that want the same serial-less unit: the first fills it, the second is an add, and says it fills it if the first is added on its own", () => {
  const rows = IMP.previewRowsInFileOrder([rec("Zz Swift Grinder #1", "6803"), rec("Zz Swift Grinder #3", "6805")], accounts, [G], [unitOf(1, "Zz Swift Grinder #2", null)]);
  assert.deepEqual(rows.map((r) => [r.action, r.existingId, r.fillBlank?.id ?? null]), [
    ["update", 1, 1],
    ["add", null, null],
  ]);
  assert.deepEqual(rows[1].fillBlankIf, { byKey: "r0", id: 1, name: "Zz Swift Grinder #2" });
  assert.equal(rows[0].fillBlankIf ?? null, null);
});

test("a serial-less row then a same-model row with a serial and another name: two units, in the preview and the match", () => {
  const rows = IMP.previewRowsInFileOrder([rec("Zz Swift Grinder #2", null), rec("Zz Swift Grinder #1", "6803")], accounts, [G], []);
  assert.deepEqual(rows.map((r) => r.action), ["add", "add"]);
  // The rule itself: a unit added earlier in the same file (a negative id) is filled only by a row with its own name.
  const temp = { ...unitOf(-1, "Zz Swift Grinder #2", null) };
  assert.equal(AE.matchExistingUnit({ customer: CAFE, catalogModel: G, equipmentName: "Zz Swift Grinder #1", serial: "6803", existing: [temp] }).action, "add");
  assert.deepEqual(AE.matchExistingUnit({ customer: CAFE, catalogModel: G, equipmentName: "Zz Swift Grinder #2", serial: "6803", existing: [temp] }), {
    action: "update",
    existingId: -1,
    foreignAccount: null,
    matchKind: "fill-blank",
  });
});

test("rows the save would skip (review) or that are held don't claim a unit in the preview", () => {
  const blank = unitOf(1, "Zz Swift Grinder #2", null);
  const held = { ...rec("Zz Swift Grinder #1", "6803"), site: "999 Other St" };
  const rows = IMP.previewRowsInFileOrder([held, rec("Zz Swift Grinder #3", "6805")], [{ id: 1, name: CAFE, address: "100 Main St" }], [G], [blank]);
  assert.ok(rows[0].holdReasons.length);
  assert.deepEqual([rows[1].action, rows[1].existingId], ["update", 1], "the held row may not be imported, so the next row is still shown filling the unit");
});

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const n of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(n, dir), "utf8"));
  await pg.query("insert into directory_customers (name) values ($1)", [CAFE]);
  await pg.query("insert into directory_equipment (name) values ($1)", [G]);
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}
const applyRow = (key, equipmentName, serial, o = {}) => ({ key, fileCustomer: CAFE, customer: CAFE, equipmentName, fileModel: G, catalogModel: G, serial, installDate: null, ownership: null, action: "add", existingId: null, ...o });

test("the save keeps a serial-less row and a same-model row with another name as two units", async () => {
  const { pg, sql } = await db();
  try {
    const r = await IMP.applyAccountEquipImportFor(sql, { rows: [applyRow("a", "Zz Swift Grinder #2", null), applyRow("b", "Zz Swift Grinder #1", "6803")] });
    assert.deepEqual([r.added, r.updated], [2, 0]);
    const units = await sql.query("select equipment_name, serial from account_equipment order by id");
    assert.deepEqual(units.map((u) => [u.equipment_name, u.serial]), [["Zz Swift Grinder #2", null], ["Zz Swift Grinder #1", "6803"]]);
  } finally {
    await pg.close();
  }
});

test("the save still folds a row into an earlier one of the same name in the file, and the same serial twice", async () => {
  const { pg, sql } = await db();
  try {
    const r = await IMP.applyAccountEquipImportFor(sql, {
      rows: [applyRow("a", "Zz Swift Grinder #2", null), applyRow("b", "Zz Swift Grinder #2", "6803"), applyRow("c", "Zz Swift Grinder #2 again", "6803")],
    });
    assert.equal((await sql.query("select count(*)::int as n from account_equipment"))[0].n, 1);
    assert.equal(r.added, 1);
  } finally {
    await pg.close();
  }
});

test("the screen shows a row as filling the unit when the row before it is added on its own", () => {
  const ui = src("src/components/desk/account-equip-import.tsx");
  assert.match(ui, /fillBlankIf/);
  assert.match(ui, /effectiveRow\(/);
  const preview = src("src/lib/ops/account-equip-import.ts");
  assert.match(preview, /const rows = previewRowsInFileOrder\(parsed\.records, accounts, catalog, existing, fillParts\);/);
});
