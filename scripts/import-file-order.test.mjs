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

test("two rows that want the same serial-less unit: the first fills it, the second is an add, with a note that it may fill it if the first one is not imported as shown", () => {
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

test("the screen notes a row that may fill an earlier row's unit, and labels a row that folds into an earlier row", () => {
  const ui = src("src/components/desk/account-equip-import.tsx");
  assert.match(ui, /r\.fillBlankIf && !needsReview/);
  assert.doesNotMatch(ui, /effectiveRow/);
  assert.match(ui, /"Same unit as an earlier row"/);
  // A folding row counts as part of its earlier row's add only while that row goes; Confirm counts every ticked row.
  assert.match(ui, /const folds = \(r: EquipPreviewRow\) => !!r\.foldsInto && goes\(rowByKey\.get\(r\.foldsInto\)\) && !asNewRow\(r\);/);
  assert.match(ui, /const selectedCount = preview\.rows\.filter\(\(r\) => goes\(r\)\)\.length;/);
  assert.match(ui, /r\.fillBlankIf && !needsReview && asPreviewed\(r, d\)/);
  const preview = src("src/lib/ops/account-equip-import.ts");
  assert.match(preview, /let rows = previewRowsInFileOrder\(parsed\.records, accounts, catalog, existing, fillParts\);/);
  assert.match(preview, /updateCount: rows\.filter\(\(r\) => r\.action === "update" && \(r\.existingId \?\? 0\) >= 0\)/);
});

test("a row that may fill an earlier row's unit gets its own Add as new unit instead box", async () => {
  const { addInsteadOffer } = await import("../src/lib/ops/equip-import-offer.ts");
  const rows = IMP.previewRowsInFileOrder([rec("Zz Swift Grinder #1", "6803"), rec("Zz Swift Grinder #3", "6805")], accounts, [G], [unitOf(1, "Zz Swift Grinder #2", null)]);
  const d = { customer: CAFE, catalogModel: G };
  const o = addInsteadOffer(rows[1], d);
  assert.equal(o.offer, true);
  assert.match(o.hint.off, /Zz Swift Grinder #2/);
  assert.equal(addInsteadOffer({ ...rows[1], fillBlankIf: null }, d).offer, false);
});

test("serial-less rows #1 and #2 in one file stay two units, in the preview and the save", async () => {
  const rows = IMP.previewRowsInFileOrder([rec("Zz Swift Grinder #1", null), rec("Zz Swift Grinder #2", null)], accounts, [G], []);
  assert.deepEqual(rows.map((r) => r.action), ["add", "add"]);
  const { pg, sql } = await db();
  try {
    const r = await IMP.applyAccountEquipImportFor(sql, { rows: [applyRow("a", "Zz Swift Grinder #1", null), applyRow("b", "Zz Swift Grinder #2", null)] });
    assert.deepEqual([r.added, r.updated], [2, 0]);
  } finally {
    await pg.close();
  }
});

test("names: '#2', '# 2' and 'No. 2' are one name; '#1' and '#2' are two", () => {
  const k = AE.fileNameKey;
  assert.equal(k("Zz Swift Grinder #2"), k("zz swift grinder # 2"));
  assert.equal(k("Zz Swift Grinder #2"), k("Zz Swift Grinder No. 2"));
  assert.equal(k("Zz Swift Grinder #2"), k("Zz  Swift-Grinder #2"));
  assert.notEqual(k("Zz Swift Grinder #1"), k("Zz Swift Grinder #2"));
  const temp = unitOf(-1, "Zz Swift Grinder No. 2", null);
  assert.equal(AE.matchExistingUnit({ customer: CAFE, catalogModel: G, equipmentName: "Zz Swift Grinder # 2", serial: "6803", existing: [temp] }).action, "update");
});

test("a row that folds into an earlier row of the file shows as an update of a temp unit, and isn't a real update", () => {
  const rows = IMP.previewRowsInFileOrder([rec("Zz Swift Grinder #2", null), rec("Zz Swift Grinder #2", "6803")], accounts, [G], []);
  assert.deepEqual(rows.map((r) => r.action), ["add", "update"]);
  assert.ok(rows[1].existingId < 0);
  assert.equal(rows[1].foldsInto, "r0");
  assert.equal(rows[0].foldsInto ?? null, null);
});

test("three rows and one serial-less unit: the first fills it, the next two are adds with the note", () => {
  const rows = IMP.previewRowsInFileOrder(
    [rec("Zz Swift Grinder #1", "6803"), rec("Zz Swift Grinder #3", "6805"), rec("Zz Swift Grinder #4", "6806")],
    accounts,
    [G],
    [unitOf(1, "Zz Swift Grinder #2", null)],
  );
  assert.deepEqual(rows.map((r) => [r.action, r.fillBlankIf?.id ?? null]), [["update", null], ["add", 1], ["add", 1]]);
});

test("the save: the first row unticked, the next row with Add as new unit instead ticked stays its own unit", async () => {
  const { pg, sql } = await db();
  try {
    await sql.query("insert into account_equipment (customer, catalog_model, equipment_name) values ($1, $2, $3)", [CAFE, G, "Zz Swift Grinder #2"]);
    const r = await IMP.applyAccountEquipImportFor(sql, { rows: [applyRow("b", "Zz Swift Grinder #3", "6805", { addInstead: true })] });
    assert.deepEqual([r.added, r.updated], [1, 0]);
    const units = await sql.query("select equipment_name, serial from account_equipment order by id");
    assert.deepEqual(units.map((u) => [u.equipment_name, u.serial]), [["Zz Swift Grinder #2", null], ["Zz Swift Grinder #3", "6805"]]);
  } finally {
    await pg.close();
  }
});

test("review: rows of a pairing still to confirm claim nothing, so the next row fills the unit as the save would", () => {
  const recs = [{ ...rec("Zz Swift Grinder #1", "6803"), model: "Swift Grinder" }, rec("Zz Swift Grinder #3", "6805")];
  const held = new Set([recs[0].model.toLowerCase().replace(/[^a-z0-9+]+/g, "")]);
  const rows = IMP.previewRowsInFileOrder(recs, accounts, [G], [unitOf(1, "Zz Swift Grinder #2", null)], new Map(), held);
  assert.equal(rows[1].action, "update");
  assert.equal(rows[1].existingId, 1);
  assert.equal(rows[1].fillBlankIf ?? null, null);
  const fold = IMP.previewRowsInFileOrder([{ ...rec("Zz Swift Grinder #2", null), model: "Swift Grinder" }, rec("Zz Swift Grinder #2", "6803")], accounts, [G], [], new Map(), held);
  assert.deepEqual(fold.map((r) => [r.action, r.foldsInto ?? null]), [["add", null], ["add", null]]);
});

test("review: the preview server function walks the file again without pairings still to confirm", () => {
  const preview = src("src/lib/ops/account-equip-import.ts");
  assert.match(preview, /if \(toConfirm\.size\) rows = previewRowsInFileOrder\(parsed\.records, accounts, catalog, existing, fillParts, toConfirm\);/);
});

test("review: a big account stays quick once one of its units is taken", () => {
  const blank = unitOf(1, "Zz Swift Grinder #0", null);
  const existing = [blank, ...Array.from({ length: 2999 }, (_, i) => unitOf(i + 2, `Zz Swift Grinder #${i + 1}`, `S${i}`))];
  const recs = Array.from({ length: 600 }, (_, i) => rec(`Zz Swift Grinder #${5000 + i}`, `N${i}`));
  const t = performance.now();
  const rows = IMP.previewRowsInFileOrder(recs, accounts, [G], existing);
  const s = (performance.now() - t) / 1000;
  assert.equal(rows[0].fillBlank?.id, 1);
  assert.equal(rows[1].fillBlankIf?.id, 1);
  assert.ok(s < 12, `took ${s.toFixed(1)} s`);
});
