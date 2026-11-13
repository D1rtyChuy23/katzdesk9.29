// Assets → In the Field (Chuy, 11/12): every machine at a customer, filtered, counted, exported and on the map.
// Made-up accounts and machines only.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const F = await import("../src/lib/ops/field-assets.ts");
const { readFieldAssets } = await import("../src/lib/ops/field-assets-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const asset = (id, customer, catalogModel, extra = {}) => ({
  id,
  customer,
  customerId: id,
  accountRemoved: false,
  address: null,
  catalogModel,
  equipmentName: catalogModel,
  brand: F.brandOf(catalogModel),
  serial: null,
  partNumber: null,
  ownership: null,
  installDate: null,
  condition: null,
  ...extra,
});

test("a model's brand is its first word, or two for the brands written that way", () => {
  assert.equal(F.brandOf('Bunn ITCB-DV, 29" w/Flip Tray'), "Bunn");
  assert.equal(F.brandOf("La Marzocco Linea Mini"), "La Marzocco");
  assert.equal(F.brandOf("la marzocco swift"), "la marzocco");
  assert.equal(F.brandOf("Eversys Cameo c'2s"), "Eversys");
  assert.equal(F.brandOf("  "), "");
  assert.equal(F.brandOf(null), "");
});

const ROWS = [
  asset(1, "Test Diner - Main", "Bunn TB3", { serial: "TB-1", ownership: "Loaned", condition: "Good", address: "1 Test St" }),
  asset(2, "Test Diner - Main", "La Marzocco Linea Mini", { serial: "LM-1", ownership: "Owned - Purchased from Katz", condition: "Excellent", partNumber: "LMLINEAMINI" }),
  asset(3, "Test Cafe - North", "Bunn TB3", { serial: "TB-2", ownership: "Lease", condition: "Fair" }),
  asset(4, "Test Cafe - North", "Bunn ITCB-DV", { serial: "IT-1" }),
];
const REPS = { "test diner - main": "Pat Rep", "test cafe - north": null };
const repOf = (c) => REPS[c.toLowerCase()] ?? null;
const ids = (rows) => rows.map((r) => r.id);

test("each filter narrows the list; blank means any", () => {
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, {}, repOf)), [1, 2, 3, 4]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { brand: "bunn" }, repOf)), [1, 3, 4]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { model: "Bunn TB3" }, repOf)), [1, 3]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { ownership: "Loaned" }, repOf)), [1]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { ownership: F.NOT_SET }, repOf)), [4]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { condition: "Fair" }, repOf)), [3]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { condition: F.NOT_SET }, repOf)), [4]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { rep: "Pat Rep" }, repOf)), [1, 2]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { rep: F.NO_REP_FILTER }, repOf)), [3, 4]);
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { q: "lmlineamini" }, repOf)), [2], "Part #");
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { q: "tb-2" }, repOf)), [3], "serial");
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { q: "1 test st" }, repOf)), [1], "address");
  assert.deepEqual(ids(F.filterFieldAssets(ROWS, { brand: "Bunn", ownership: "Lease" }, repOf)), [3], "filters combine");
});

test("counts by value, most first; machines by account for the map", () => {
  assert.deepEqual(F.countBy(ROWS, (r) => r.brand), [["Bunn", 3], ["La Marzocco", 1]]);
  assert.deepEqual(F.countBy(ROWS, (r) => r.condition), [["Excellent", 1], ["Fair", 1], ["Good", 1]]);
  const m = F.byAccount(ROWS);
  assert.deepEqual([...m.keys()], ["test diner - main", "test cafe - north"]);
  assert.deepEqual(ids(m.get("test cafe - north")), [3, 4]);
});

test("the CSV export: one row per machine with the rep; commas quoted; a leading = can't run as a formula", () => {
  const csv = F.fieldAssetsCsv([asset(9, "Test, Diner", "=Bunn TB3", { serial: 'S"1', address: "1 Test St\nSuite 2" })], () => "Pat Rep");
  const [head, row] = csv.split("\r\n");
  assert.equal(head, "Account,Rep,Address,Brand,Catalog Model,Equipment Name,Serial,Part #,Ownership,Install Date,Condition");
  assert.equal(row.startsWith('"Test, Diner",Pat Rep,"1 Test St\nSuite 2",'), true);
  assert.match(row, /,'=Bunn TB3,'=Bunn TB3,"S""1",/);
});

test("every machine with its account: address, removed flag, and none when no account has the name", async () => {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  try {
    for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const query = async (text, params) => (await pg.query(text, params)).rows;
    const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
    await query("insert into directory_customers (name, address) values ('Test Diner - Main', '1 Test St'), ('Test Gone Cafe', '9 Old Rd')");
    await query("update directory_customers set archived = true where name = 'Test Gone Cafe'");
    const unit = (customer, model, extra = "") =>
      query(`insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, ownership, condition, part_number, install_date) values ($1, $2, $2, 'S', 's', 'Loaned', 'Good', '33200.0000', '2025-09-18')${extra}`, [customer, model]);
    await unit("test diner - main", "La Marzocco Linea Mini");
    await unit("Test Gone Cafe", "Bunn TB3");
    await unit("Nobody Has This Name", "Bunn TB3");
    const rows = await readFieldAssets(sql);
    const by = Object.fromEntries(rows.map((r) => [r.customer, r]));
    assert.equal(rows.length, 3);
    assert.deepEqual(
      { ...by["test diner - main"], id: 0, customerId: by["test diner - main"].customerId > 0 },
      {
        id: 0,
        customer: "test diner - main",
        customerId: true,
        accountRemoved: false,
        address: "1 Test St",
        catalogModel: "La Marzocco Linea Mini",
        equipmentName: "La Marzocco Linea Mini",
        brand: "La Marzocco",
        serial: "S",
        partNumber: "33200.0000",
        ownership: "Loaned",
        installDate: "2025-09-18",
        condition: "Good",
      },
    );
    assert.equal(by["Test Gone Cafe"].accountRemoved, true);
    assert.deepEqual([by["Nobody Has This Name"].customerId, by["Nobody Has This Name"].accountRemoved, by["Nobody Has This Name"].address], [null, false, null]);
  } finally {
    await pg.close();
  }
});

test("the side menu has Assets → Equipment; the Warehouse role reaches it too (its Warehouse section)", () => {
  const shell = src("src/components/desk/shell.tsx");
  assert.ok(shell.includes('items: [{ to: "/assets", label: "Equipment", icon: Container }]'));
  assert.ok(shell.includes('const WAREHOUSE_OK: DeskTo[] = ["/warehouse", "/assets", "/rebuilds", "/modules", "/library", "/parts", "/locations"];'));
  assert.match(src("src/routeTree.gen.ts"), /'\/assets': typeof AppAssetsRoute/);
  const page = src("src/routes/_app/assets.tsx");
  assert.match(page, /listFieldAssets\(\)/);
  assert.match(page, /<DeskMap pins=\{pins\}/);
  assert.match(page, /fieldAssetsCsv\(rows, repOf\)/);
});

// Fable review of this page (11/12).
test("a machine is listed once even when two accounts' names differ only in capitals or spaces; the live one wins", async () => {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  try {
    for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const query = async (text, params) => (await pg.query(text, params)).rows;
    const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
    // Without the start-up index that keeps names unique whatever their capitals.
    await query("insert into directory_customers (name, address, archived) values ('ACME', '9 Old Rd', true), ('Acme ', '1 New St', false)");
    await query("insert into account_equipment (customer, catalog_model, equipment_name) values (' acme', 'Bunn TB3', 'Bunn TB3')");
    const rows = await readFieldAssets(sql);
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].address, rows[0].accountRemoved], ["1 New St", false]);
  } finally {
    await pg.close();
  }
});

test("brand counts don't split on capitals; the export keeps a leading minus on a number and adds the byte-order mark", () => {
  const rows = [asset(1, "A", "BUNN Axiom"), asset(2, "B", "Bunn TB3"), asset(3, "C", "Fetco CBS-62H")];
  assert.deepEqual(F.countBy(rows, (r) => r.brand), [["BUNN", 2], ["Fetco", 1]]);
  const csv = F.fieldAssetsCsv([asset(4, "D", "Bunn TB3", { serial: "-12", partNumber: "-abc" })], () => null);
  assert.match(csv.split("\r\n")[1], /,-12,'-abc,/);
  const page = src("src/routes/_app/assets.tsx");
  assert.ok(page.includes("`\\uFEFF${fieldAssetsCsv(rows, repOf)}`"), "the export adds the byte-order mark");
  assert.ok(page.includes("disabled={!rows.length || !geoReady}"));
  assert.ok(page.includes("extraNames={geo.data?.reps}"));
  assert.ok(page.includes("fitKey={JSON.stringify(filters)}"));
});
