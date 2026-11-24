// Equipment import: the preview asks the save's own dry run what each ticked row becomes (Chuy, 11/23, review of the
// unticked-earlier-row labels): the dry run writes nothing, and its counts and outcomes are the save's. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const CAFE = "Zz Dining S0319";
const G = "Zz Swift Grinder";
async function db() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(f, dir), "utf8"));
  await pg.query("insert into directory_customers (name) values ($1)", [CAFE]);
  await pg.query("insert into directory_equipment (name) values ($1)", [G]);
  return { pg, sql: { query: async (t, p) => (await pg.query(t, p)).rows } };
}
const row = (key, equipmentName, serial, o = {}) => ({ key, fileCustomer: CAFE, customer: CAFE, equipmentName, fileModel: G, catalogModel: G, serial, installDate: null, ownership: null, action: "add", existingId: null, ...o });
const snapshot = async (sql) => sql.query("select id, equipment_name, serial from account_equipment order by id");

/** The dry run, then the save, on the same rows: the dry run changes nothing and says what the save does. */
async function both(setup, rows) {
  const { pg, sql } = await db();
  try {
    await setup(sql);
    const before = await snapshot(sql);
    const plan = await IMP.applyAccountEquipImportFor(sql, { rows }, { dryRun: true });
    assert.deepEqual(await snapshot(sql), before, "the dry run wrote nothing");
    const real = await IMP.applyAccountEquipImportFor(sql, { rows });
    assert.deepEqual([plan.added, plan.updated, plan.skipped], [real.added, real.updated, real.skipped]);
    return { plan, after: await snapshot(sql) };
  } finally {
    await pg.close();
  }
}
const frontBar = (sql) => sql.query("insert into account_equipment (customer, catalog_model, equipment_name) values ($1, $2, 'Front Bar')", [CAFE, G]);

test("two joining rows, both earlier rows unticked: one fills Front Bar, the other is added", async () => {
  const { plan, after } = await both(frontBar, [row("r1", "G #5", "C-1"), row("r3", "G #6", "C-2")]);
  assert.deepEqual(plan.plan, { r1: { outcome: "update", unit: "Front Bar", fills: true }, r3: { outcome: "add" } });
  assert.equal(after.length, 2);
});

test("a later row whose unit an earlier row now takes is an add", async () => {
  const { plan } = await both(frontBar, [row("r1", "G #5", "C-1"), row("r2", "G #7", "C-9")]);
  assert.deepEqual([plan.plan.r1.outcome, plan.plan.r2.outcome], ["update", "add"]);
});

test("three rows of one name, the first unticked: the third joins the second", async () => {
  const { plan } = await both(frontBar, [row("r1", "G #5", null), row("r2", "G #5", "C-1")]);
  assert.deepEqual(plan.plan, { r1: { outcome: "add" }, r2: { outcome: "join", joins: "r1" } });
});

test("a skipped row and Add as new unit instead are planned as the save does them", async () => {
  const { plan } = await both(frontBar, [row("r1", "G #5", "C-1", { addInstead: true }), row("r2", "G", "C-3", { customer: "" })]);
  assert.deepEqual(plan.plan, { r1: { outcome: "add" }, r2: { outcome: "skip" } });
});

test("the screen asks the dry run for the rows as ticked and uses it for labels and counts", () => {
  const ui = src("src/components/desk/account-equip-import.tsx");
  assert.match(ui, /planAccountEquipImport\(\{ data: \{ rows: sent \} \}\)/);
  assert.match(ui, /const plan = planned && planned\.sig === sentSig \? planned\.data : null;/);
  assert.match(ui, /const selectedAdds = plan\s+\? plan\.added/);
  assert.match(ui, /const selectedUpdates = plan\s+\? plan\.updated/);
  assert.match(ui, /onConfirm\(rowsToSend\(\)\);/);
  const imp = src("src/lib/ops/account-equip-import.ts");
  assert.match(imp, /export const planAccountEquipImport = createServerFn/);
  assert.match(imp, /if \(!dry\) await sql\.query\(importUpdateUnitSql\(\)/);
  assert.match(imp, /if \(dry\) return \{ added, updated, skipped, catalogAdded, partsFilled, plan \};/);
});

test("the dry run doesn't add a new catalog model or fill a locked unit's Part #", async () => {
  const { pg, sql } = await db();
  try {
    const models = async () => (await sql.query("select count(*)::int as n from directory_equipment"))[0].n;
    const n = await models();
    const plan = await IMP.applyAccountEquipImportFor(sql, { rows: [row("r1", "Zz New Brewer", "NB-1", { catalogModel: "Zz New Brewer", addCatalog: true })] }, { dryRun: true });
    assert.deepEqual([plan.added, plan.catalogAdded], [1, 1]);
    assert.equal(await models(), n);
    assert.equal((await sql.query("select count(*)::int as n from account_equipment"))[0].n, 0);
  } finally {
    await pg.close();
  }
});
