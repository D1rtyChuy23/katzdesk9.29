import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Chuy, 11/20: the Equipment import may fill a blank Part # on a locked unit, "if it is updating to correct
// information": the file row names the unit by its serial and its own model, the Part # is one live part in the
// catalog, and a Part # already on the unit stays. Nothing else on a locked unit changes.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const { serialKey } = await import("../src/lib/ops/account-equip.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const parts = new Map([
  ["ZZGR100", { sku: "ZZ-GR-100", mpn: "ZZ-GR-100", description: "Zz Grinder" }],
  ["ZZINV9", { sku: "ZZ-INV-9", mpn: "ZZ-INV-9", description: "Zz Brewer" }],
  ["ZZTWIN", null],
]);
const unit = { partNumber: null, catalogModel: "Zz Grinder", serialKey: serialKey("SN-1") };
const file = (partNumber, extra = {}) => ({ partNumber, catalogModel: "Zz Grinder", serial: "SN-1", ...extra });

async function migrated() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  return pg;
}

test("lockedPartFill: only a blank Part #, the unit's own serial and model, one live part, the catalog's spelling", () => {
  assert.equal(IMP.lockedPartFill(unit, file("zz gr 100"), parts), "ZZ-GR-100");
  assert.equal(IMP.lockedPartFill({ ...unit, partNumber: "  " }, file("ZZ-GR-100"), parts), "ZZ-GR-100");
  assert.equal(IMP.lockedPartFill({ ...unit, partNumber: "OLD-1" }, file("ZZ-GR-100"), parts), null, "a Part # already on the unit stays");
  assert.equal(IMP.lockedPartFill(unit, file("NOT-A-PART"), parts), null, "not a live part");
  assert.equal(IMP.lockedPartFill(unit, file("ZZ TWIN"), parts), null, "a key two parts share says nothing");
  assert.equal(IMP.lockedPartFill(unit, file("ZZ-GR-100", { catalogModel: "Zz Brewer" }), parts), null, "the file's model isn't the unit's");
  assert.equal(IMP.lockedPartFill(unit, file("ZZ-GR-100", { serial: "" }), parts), null, "no serial: model and label alone don't name a locked unit");
  assert.equal(IMP.lockedPartFill(unit, file("ZZ-GR-100", { serial: "SN-2" }), parts), null);
  assert.equal(IMP.lockedPartFill(unit, file("X".repeat(61)), parts), null, "too long");
  assert.equal(IMP.lockedPartFill(unit, file(""), parts), null);
  assert.equal(IMP.lockedPartFill(unit, file(null), parts), null);
});

test("loadFillParts: active, visible, unmerged, not trip or labor; a shared key is refused", async () => {
  const pg = await migrated();
  try {
    const add = (sku, mpn, col, val) =>
      pg.query(`insert into billing_items (sku, item, mfr_part, description${col ? `, ${col}` : ""}) values ($1, $1, $2, 'x'${col ? `, ${val}` : ""})`, [sku, mpn]);
    await add("ZZ-GR-100", "ZZ-GR-100");
    await add("ZZ-OFF-1", "ZZ-OFF-1", "active", "false");
    await add("ZZ-LAB-1", "ZZ-LAB-1", "kind", "'labor'");
    await add("ZZ-HID-1", "ZZ-HID-1", "hidden_at", "now()");
    await add("ZZ-A", "52000.0305");
    await add("ZZ-B", "52000-0305");
    const sql = { query: async (t, p) => (await pg.query(t, p)).rows };
    const m = await IMP.loadFillParts(sql);
    assert.equal(m.get("ZZGR100")?.sku, "ZZ-GR-100");
    assert.equal(m.get("ZZOFF1"), undefined);
    assert.equal(m.get("ZZLAB1"), undefined);
    assert.equal(m.get("ZZHID1"), undefined);
    assert.equal(m.get("520000305"), null, "two parts on one key");
  } finally {
    await pg.close();
  }
});

test("the preview offers the fill on a locked unit, and holds it for review otherwise", () => {
  const accounts = [{ id: 1, name: "Zz Cafe", address: null }];
  const existing = [{ id: 5, customer: "Zz Cafe", catalogModel: "Zz Grinder", equipmentName: "Zz Grinder", serial: "SN-1", serialKey: serialKey("SN-1"), lockedBy: "chuy", partNumber: null }];
  const rec = (partNumber, model = "Zz Grinder") => ({ customer: "Zz Cafe", equipmentName: "", model, serial: "SN-1", installDate: "", electrical: "", ownership: "", partNumber, condition: "", site: "" });
  const catalog = ["Zz Grinder", "Zz Brewer"];
  const filled = IMP.buildPreviewRow(rec("ZZ-GR-100"), 0, accounts, catalog, existing, parts);
  assert.equal(filled.action, "update");
  assert.equal(filled.existingId, 5);
  assert.equal(filled.lockedNote, "Locked by chuy: only its blank Part # is filled, with ZZ-GR-100.");
  const held = [
    IMP.buildPreviewRow(rec("NOT-A-PART"), 0, accounts, catalog, existing, parts),
    IMP.buildPreviewRow(rec("ZZ-GR-100"), 0, accounts, catalog, [{ ...existing[0], partNumber: "OLD-1" }], parts),
    IMP.buildPreviewRow(rec("ZZ-INV-9", "Zz Brewer"), 0, accounts, catalog, existing, parts),
    IMP.buildPreviewRow(rec("ZZ-GR-100" + "0".repeat(60)), 0, accounts, catalog, existing, parts),
  ];
  for (const r of held) {
    assert.equal(r.action, "review", JSON.stringify(r.reviewReasons));
    assert.equal(r.lockedNote, null, "a row held for review says nothing about a fill");
  }
});

test("the fill writes only the Part #, and only while it is still blank", async () => {
  const pg = await migrated();
  try {
    const ins = await pg.query(
      `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by, part_number)
       values ('Zz Cafe', 'Zz Grinder', 'Zz Grinder', 'SN-1', 'sn-1', now(), 'chuy', null),
              ('Zz Cafe', 'Zz Brewer', 'Zz Brewer', 'SN-2', 'sn-2', now(), 'chuy', 'OLD-1'),
              ('Zz Cafe', 'Zz Brewer', 'Zz Brewer', 'SN-3', 'sn-3', now(), 'chuy', E' \\u00a0\\t') returning id`,
    );
    const [a, b, c] = ins.rows.map((r) => r.id);
    const before = (await pg.query("select equipment_name, serial, locked_at, locked_by from account_equipment where id = $1", [a])).rows[0];
    assert.equal((await pg.query(IMP.lockedPartFillSql(), [a, "ZZ-GR-100"])).rows.length, 1);
    assert.equal((await pg.query(IMP.lockedPartFillSql(), [a, "ZZ-INV-9"])).rows.length, 0, "a second row for the same unit doesn't overwrite the first fill");
    assert.equal((await pg.query(IMP.lockedPartFillSql(), [b, "ZZ-INV-9"])).rows.length, 0);
    assert.equal((await pg.query(IMP.lockedPartFillSql(), [c, "ZZ-INV-9"])).rows.length, 1, "spaces, tabs and no-break spaces are blank");
    const rows = (await pg.query("select id, equipment_name, serial, locked_at, locked_by, part_number from account_equipment order by id")).rows;
    assert.equal(rows[0].part_number, "ZZ-GR-100");
    assert.deepEqual({ equipment_name: rows[0].equipment_name, serial: rows[0].serial, locked_at: rows[0].locked_at, locked_by: rows[0].locked_by }, before);
    assert.equal(rows[1].part_number, "OLD-1");
    assert.equal(rows[2].part_number, "ZZ-INV-9");
  } finally {
    await pg.close();
  }
});

test("the apply checks the fill again on the server with the strict parts list; the screen sends the row as previewed", () => {
  const f = src("src/lib/ops/account-equip-import.ts");
  // The apply's body is applyAccountEquipImportFor (11/23), which the server call runs.
  const apply = f.slice(f.indexOf("export async function applyAccountEquipImportFor"), f.indexOf("export const listAccountEquipment"));
  assert.match(apply, /const fillParts = await loadFillParts\(sql\);/);
  assert.match(apply, /const fill = lockedPartFill\(lockedUnit, \{ partNumber: row\.partNumber, catalogModel, serial \}, fillParts\);/);
  assert.match(apply, /await sql\.query\(lockedPartFillSql\(\), \[lockedUnit\.id, fill\]\)\)\.length/);
  const preview = f.slice(f.indexOf("export const previewAccountEquipImport"), f.indexOf("export async function applyAccountEquipImportFor"));
  // The preview takes the file in order (11/23), each row through buildPreviewRow with the fill parts.
  assert.match(preview, /previewRowsInFileOrder\(parsed\.records, accounts, catalog, existing, fillParts\)/);
  assert.match(f, /const row = buildPreviewRow\(rec, i, accounts, catalog, working, fillParts\);/);
  const ui = src("src/components/desk/account-equip-import.tsx");
  assert.match(ui, /const showPickers = !r\.lockedNote && \(needsReview \|\| !!editing\[r\.key\]\);/);
  assert.match(ui, /if \(row\.lockedNote\) return \[\{ \.\.\.row, modelCandidates: \[\], reviewReasons: \[\], action: "update" \} as EquipPreviewRow\];/);
});
