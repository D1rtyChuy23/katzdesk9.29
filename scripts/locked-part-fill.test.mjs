import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Chuy, 11/20: the Equipment import may fill a blank Part # on a locked unit, "if it is updating to correct
// information": the file's Part # must be a live part in the catalog, and a Part # already on the unit stays.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const parts = new Map([
  ["ZZGR100", { sku: "ZZ-GR-100", mpn: "ZZ-GR-100", description: "Zz Grinder" }],
  ["ZZINV9", { sku: "ZZ-INV-9", mpn: "ZZ-INV-9", description: "Zz Brewer" }],
]);

test("lockedPartFill: only a blank Part #, only with a live part, in the catalog's spelling", () => {
  assert.equal(IMP.lockedPartFill(null, "zz gr 100", parts), "ZZ-GR-100");
  assert.equal(IMP.lockedPartFill("  ", "ZZ-GR-100", parts), "ZZ-GR-100");
  assert.equal(IMP.lockedPartFill("OLD-1", "ZZ-GR-100", parts), null, "a Part # already on the unit stays");
  assert.equal(IMP.lockedPartFill(null, "NOT-A-PART", parts), null, "not a live part");
  assert.equal(IMP.lockedPartFill(null, "", parts), null);
  assert.equal(IMP.lockedPartFill(null, null, parts), null);
});

test("the preview offers the fill on a locked unit instead of holding it for review", () => {
  const accounts = [{ id: 1, name: "Zz Cafe", address: null }];
  const existing = [{ id: 5, customer: "Zz Cafe", catalogModel: "Zz Grinder", equipmentName: "Zz Grinder", serial: "SN-1", serialKey: "sn-1", lockedBy: "chuy", partNumber: null }];
  const rec = (partNumber) => ({ customer: "Zz Cafe", equipmentName: "", model: "Zz Grinder", serial: "SN-1", installDate: "", electrical: "", ownership: "", partNumber, condition: "", site: "" });
  const filled = IMP.buildPreviewRow(rec("ZZ-GR-100"), 0, accounts, ["Zz Grinder"], existing, parts);
  assert.equal(filled.action, "update");
  assert.equal(filled.existingId, 5);
  assert.equal(filled.lockedNote, "Locked by chuy: only its blank Part # is filled, with ZZ-GR-100.");
  const unknown = IMP.buildPreviewRow(rec("NOT-A-PART"), 0, accounts, ["Zz Grinder"], existing, parts);
  assert.equal(unknown.action, "review");
  assert.ok(unknown.reviewReasons.some((r) => /Locked by chuy/.test(r)));
  const has = IMP.buildPreviewRow(rec("ZZ-GR-100"), 0, accounts, ["Zz Grinder"], [{ ...existing[0], partNumber: "OLD-1" }], parts);
  assert.equal(has.action, "review");
});

test("the fill writes only the Part #, and only while it is still blank", async () => {
  const pg = new PGlite();
  try {
    const dir = new URL("../migrations/", import.meta.url);
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
    const ins = await pg.query(
      `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, locked_at, locked_by, part_number)
       values ('Zz Cafe', 'Zz Grinder', 'Zz Grinder', 'SN-1', 'sn-1', now(), 'chuy', null),
              ('Zz Cafe', 'Zz Brewer', 'Zz Brewer', 'SN-2', 'sn-2', now(), 'chuy', 'OLD-1') returning id`,
    );
    const [a, b] = ins.rows.map((r) => r.id);
    const before = (await pg.query("select equipment_name, serial, locked_at, locked_by from account_equipment where id = $1", [a])).rows[0];
    assert.equal((await pg.query(IMP.lockedPartFillSql(), [a, "ZZ-GR-100"])).affectedRows, 1);
    assert.equal((await pg.query(IMP.lockedPartFillSql(), [b, "ZZ-INV-9"])).affectedRows, 0);
    const rows = (await pg.query("select id, equipment_name, serial, locked_at, locked_by, part_number from account_equipment order by id")).rows;
    assert.equal(rows[0].part_number, "ZZ-GR-100");
    assert.deepEqual({ equipment_name: rows[0].equipment_name, serial: rows[0].serial, locked_at: rows[0].locked_at, locked_by: rows[0].locked_by }, before);
    assert.equal(rows[1].part_number, "OLD-1");
  } finally {
    await pg.close();
  }
});

test("the apply fills a locked unit's Part # through the guarded update, checked again on the server", () => {
  const f = src("src/lib/ops/account-equip-import.ts");
  const apply = f.slice(f.indexOf("export const applyAccountEquipImport"), f.indexOf("export const listAccountEquipment"));
  assert.match(apply, /const parts = await loadParts\(sql\);/);
  assert.match(apply, /const fill = lockedPartFill\(lockedUnit\.partNumber, row\.partNumber, parts\);/);
  assert.match(apply, /await sql\.query\(lockedPartFillSql\(\), \[lockedUnit\.id, fill\]\)\)\.length/);
});
