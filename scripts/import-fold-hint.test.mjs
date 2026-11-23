// Equipment import: a row that joins an earlier row's unit says what happens to it as the earlier row's tick stands
// (Chuy, 11/23, found live after #188). Display text only: the save is the same either way. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const { addInsteadOffer } = await import("../src/lib/ops/equip-import-offer.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const CAFE = "Zz Dining S0319";
const G = "Zz Swift Grinder";
const accounts = [{ id: 1, name: CAFE, address: null }];
const rec = (equipmentName, serial) => ({ customer: CAFE, equipmentName, model: G, serial: serial ?? "", installDate: "", electrical: "", ownership: "", partNumber: "", condition: "", site: "" });
const draft = { customer: CAFE, catalogModel: G };
const rows = () => IMP.previewRowsInFileOrder([rec("Zz Swift Grinder #5", null), rec("Zz Swift Grinder #5", "C-1")], accounts, [G], []);

test("the joining row reads the fill wording while the earlier row is ticked", () => {
  const r = rows()[1];
  assert.equal(r.foldsInto, "r0");
  const o = addInsteadOffer(r, draft, { earlierRowGoes: true });
  assert.equal(o.offer, true);
  assert.match(o.hint.off, /fills Zz Swift Grinder #5, which has none/);
  // Unchanged when the screen doesn't say (other callers).
  assert.deepEqual(addInsteadOffer(r, draft), o);
});

test("after the earlier row is unticked, the joining row reads the add wording, and the box stays", () => {
  const r = rows()[1];
  const o = addInsteadOffer(r, draft, { earlierRowGoes: false });
  assert.equal(o.offer, true);
  assert.doesNotMatch(o.hint.off, /fills/);
  assert.doesNotMatch(o.hint.on, /fills/);
  assert.match(o.hint.off, /added on its own/);
});

test("the screen passes the earlier row's tick to the hint", () => {
  const ui = src("src/components/desk/account-equip-import.tsx");
  assert.match(ui, /const offer = addInsteadOffer\(r, d, \{ earlierRowGoes: r\.foldsInto \? goes\(rowByKey\.get\(r\.foldsInto\)\) : undefined \}\);/);
});

async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  await pg.query("insert into directory_customers (name) values ($1)", [CAFE]);
  await pg.query("insert into directory_equipment (name) values ($1)", [G]);
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}
const applyRow = (key, equipmentName, serial) => ({ key, fileCustomer: CAFE, customer: CAFE, equipmentName, fileModel: G, catalogModel: G, serial, installDate: null, ownership: null, action: "add", existingId: null });

test("the save is the same as before: both rows give one unit with the serial; the second row alone gives one unit", async () => {
  for (const [sent, want] of [
    [[applyRow("r0", "Zz Swift Grinder #5", null), applyRow("r1", "Zz Swift Grinder #5", "C-1")], [1, 0]],
    [[applyRow("r1", "Zz Swift Grinder #5", "C-1")], [1, 0]],
  ]) {
    const { pg, sql } = await db();
    try {
      const r = await IMP.applyAccountEquipImportFor(sql, { rows: sent });
      assert.deepEqual([r.added, r.updated], want);
      const units = await sql.query("select equipment_name, serial from account_equipment");
      assert.deepEqual(units.map((u) => [u.equipment_name, u.serial]), [["Zz Swift Grinder #5", "C-1"]]);
    } finally {
      await pg.close();
    }
  }
});
