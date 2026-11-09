import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Small fixes from the 11/9 check of the app (Chuy). Made-up accounts and machines only.

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const E = await import("../src/lib/ops/account-equip.ts");
const IMP = await import("../src/lib/ops/account-equip-import.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the Equipment import keeps a unit's install date when its file has none", async () => {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  try {
    for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const q = async (text, params) => (await pg.query(text, params)).rows;
    const [{ id }] = await q(
      `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership)
       values ('Test Steakhouse', 'Test Grinder', 'Test Grinder', 'TG-1', 'tg-1', '2025-11-14', '120V', 'Loaned') returning id`,
    );
    const read = async () => (await q("select install_date, electrical, ownership, serial from account_equipment where id = $1", [id]))[0];

    // A file row with no install date, electrical or ownership: all three stay.
    await q(IMP.importUpdateUnitSql(), [id, "Test Grinder", "Test Grinder", "TG-1", "tg-1", null, null, null]);
    assert.deepEqual(await read(), { install_date: "2025-11-14", electrical: "120V", ownership: "Loaned", serial: "TG-1" });

    // A file row with a date still sets it.
    await q(IMP.importUpdateUnitSql(), [id, "Test Grinder", "Test Grinder", "TG-1", "tg-1", "2026-01-05", null, null]);
    assert.equal((await read()).install_date, "2026-01-05");
  } finally {
    await pg.close();
  }
  // The import runs that statement, not one of its own.
  assert.match(src("src/lib/ops/account-equip-import.ts"), /await sql\.query\(importUpdateUnitSql\(\), \[unit\.existingId, catalogModel, equipmentName, serial, key, installDate, electrical, ownership\]\)/);
});

test("Add equipment isn't offered on a walk-in ticket", () => {
  assert.equal(E.canAddEquipmentTo("Test Steakhouse"), true);
  assert.equal(E.canAddEquipmentTo("  "), false);
  assert.equal(E.canAddEquipmentTo(null), false);
  assert.equal(E.canAddEquipmentTo("Walk-in"), false);
  assert.match(src("src/components/desk/account-history.tsx"), /\{canAddEquipmentTo\(customer\) \? \(/);
});

test("the unit form's hint fits its box, and the date message suits a date picker", () => {
  const form = src("src/components/desk/account-unit-form.tsx");
  assert.match(form, /placeholder="Data plate or NetSuite"/);
  assert.deepEqual(E.checkUnitFields({ installDate: "soon" }), { error: "Pick a real install date." });
  assert.deepEqual(E.checkUnitFields({ installDate: "2025-02-31" }), { error: "Pick a real install date." });
});
