// The verified units list (Chuy, 11/12): the Equipment import reads its headers as they are, keeps each machine's
// condition, holds a row whose site doesn't match its account, and groups rows into model pairings that are confirmed
// once. Made-up accounts and serials only; the models and Part #s copy shapes from the list.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const R = await import("../src/lib/ops/account-equip-retire.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const HEADERS = ["Customer", "Site Address", "Equipment Name as Entered", "Confirmed Model", "Part #", "Serial #", "Ownership", "Install Date", "Electrical", "Condition"];
const CATALOG = ['Bunn ITCB-DV, 29" w/Flip Tray', "Bunn TB3", "Bunn Sure Immersion 220", "Mazzer Super Jolly Doser V Up w/ Timer"];

test("migration 0126 only adds the condition column", () => {
  const sql = src("migrations/0126_account_equipment_condition.sql").replace(/--.*$/gm, "").trim();
  assert.deepEqual(sql.split(";").map((s) => s.trim()).filter(Boolean), [
    "alter table account_equipment add column if not exists condition text",
    "alter table account_equipment_retired add column if not exists condition text",
  ]);
});

test("the verified units list's headers read as they are", () => {
  const { records } = IMP.parseEquipMatrix([
    HEADERS,
    ["Test Bagels - Main", "1025 Test Drive", "Bunn ITCB Combo Brewer", "Bunn ITCB-DV", "35700.0019", "ITCB000001", "Loaned", "2025-09-18", "120V", "Good"],
  ]);
  assert.deepEqual(records[0], {
    customer: "Test Bagels - Main",
    site: "1025 Test Drive",
    equipmentName: "Bunn ITCB Combo Brewer",
    model: "Bunn ITCB-DV",
    partNumber: "35700.0019",
    serial: "ITCB000001",
    ownership: "Loaned",
    installDate: "2025-09-18",
    electrical: "120V",
    condition: "Good",
  });
});

test("condition reads as one of the four, any capitals; other text as it is", () => {
  assert.deepEqual(["excellent", " GOOD ", "Fair", "poor", "", null, "Needs  gasket"].map(IMP.cleanCondition), ["Excellent", "Good", "Fair", "Poor", null, null, "Needs gasket"]);
});

test("a site holds its row only when both start with a street number and the numbers differ", () => {
  assert.equal(IMP.siteMismatch("2450 E. Main St., Suite H", "1335 S Egret Bay Blvd., League City"), true);
  assert.equal(IMP.siteMismatch("4 Test Bagels - Veterans Memorial", "4443 Cypress Creek Pkwy"), true);
  assert.equal(IMP.siteMismatch("1025 University Drive", "1025 University Dr, College Station, TX"), false);
  assert.equal(IMP.siteMismatch("Test Cupcakes - Uptown", "4443 Cypress Creek Pkwy"), false, "a site written as a name isn't checked");
  assert.equal(IMP.siteMismatch("306 Market St.", null), false, "an account with no address isn't checked");
  assert.equal(IMP.siteMismatch("", "214 W. Main St."), false);
});

test("the file's model words the catalog lacks, and a Part # that reads as another model", () => {
  assert.deepEqual(IMP.extraModelWords("Bunn ITCB-DV (NS)", 'Bunn ITCB-DV, 29" w/Flip Tray'), ["ns"]);
  assert.deepEqual(IMP.extraModelWords("Bunn ITCB-DV", 'Bunn ITCB-DV, 29" w/Flip Tray'), []);
  assert.deepEqual(IMP.extraModelWords("Bunn TB3", "Bunn TB3"), []);
  const part = (sku, description = null) => ({ sku, mpn: null, description });
  assert.equal(IMP.partModelConflict(part("BUNNSUREIMMERSION312"), "Bunn Sure Immersion 220"), true, "312 is not 220");
  assert.equal(IMP.partModelConflict(part("BUNNSUREIMMERSION220"), "Bunn Sure Immersion 220"), false);
  assert.equal(IMP.partModelConflict(part('BUNNITCBWFLIP29"'), 'Bunn ITCB-DV, 29" w/Flip Tray'), false);
  assert.equal(IMP.partModelConflict(part("BBSEGO12", "Sego 12 120V"), "Bravilor Sego 12 120V"), false, "a voltage isn't a model number");
  assert.equal(IMP.partModelConflict(part("BUNNTB3"), "Bunn TB3"), false, "no two-digit numbers: no check");
  assert.equal(IMP.partModelConflict(null, "Bunn Sure Immersion 220"), false);
});

const preview = (rows, accounts = [{ id: 1, name: "Test Bagels - Main", address: "1025 Test Drive, Test City" }]) => {
  const { records } = IMP.parseEquipMatrix([HEADERS, ...rows]);
  return records.map((rec, i) => IMP.buildPreviewRow(rec, i, accounts, CATALOG, []));
};

test("model pairings: one per file model and catalog model; names that differ are confirmed once, exact ones aren't", () => {
  const rows = preview([
    ["Test Bagels - Main", "1025 Test Drive", "ITCB", "Bunn ITCB-DV", "35700.0019", "S-1", "Loaned", "", "", "Good"],
    ["Test Bagels - Main", "1025 Test Drive", "ITCB", "Bunn ITCB-DV", "35700.0019", "S-2", "Loaned", "", "", "Good"],
    ["Test Bagels - Main", "1025 Test Drive", "ITCB NS", "Bunn ITCB-DV (NS)", "52200.0100", "S-3", "Loaned", "", "", "Fair"],
    ["Test Bagels - Main", "1025 Test Drive", "TB3", "Bunn TB3", "36700.0009", "S-4", "Lease", "", "", "Excellent"],
    ["Test Bagels - Main", "1025 Test Drive", "Sure", "Bunn Sure Immersion 220", "44400.0202", "S-5", "Loaned", "", "", "Good"],
  ]);
  const parts = new Map([["444000202", { sku: "BUNNSUREIMMERSION312", mpn: "44400.0202", description: "Sure Immersion 312" }]]);
  const pairings = IMP.buildPairings(rows, parts);
  const by = Object.fromEntries(pairings.map((p) => [p.fileModel, p]));
  assert.equal(pairings.length, 4, "ITCB-DV (NS) is its own pairing");
  assert.deepEqual([by["Bunn ITCB-DV"].rows, by["Bunn ITCB-DV"].needsConfirm, by["Bunn ITCB-DV"].warnings], [2, true, []]);
  assert.deepEqual([by["Bunn ITCB-DV (NS)"].needsConfirm, by["Bunn ITCB-DV (NS)"].warnings], [true, ['The file says "ns"; the catalog model doesn\'t.']]);
  assert.deepEqual([by["Bunn TB3"].needsConfirm, by["Bunn TB3"].warnings], [false, []]);
  // Same name, but the Part # is another model.
  assert.equal(by["Bunn Sure Immersion 220"].needsConfirm, true);
  assert.match(by["Bunn Sure Immersion 220"].warnings[0], /Part # 44400\.0202 is BUNNSUREIMMERSION312/);
  assert.equal(by["Bunn Sure Immersion 220"].partSku, "BUNNSUREIMMERSION312");
  // Warnings first, then names that differ, then exact.
  assert.deepEqual(pairings.map((p) => p.fileModel), ["Bunn ITCB-DV (NS)", "Bunn Sure Immersion 220", "Bunn ITCB-DV", "Bunn TB3"]);
  assert.deepEqual(rows.map((r) => r.condition), ["Good", "Good", "Fair", "Excellent", "Good"]);
});

test("a row whose site doesn't match its account is held, with the reason; the others aren't", () => {
  const rows = preview([
    ["Test Bagels - Main", "1025 Test Drive", "TB3", "Bunn TB3", "", "S-1", "Loaned", "", "", ""],
    ["Test Bagels - Main", "4443 Other Pkwy", "TB3", "Bunn TB3", "", "S-2", "Loaned", "", "", ""],
    ["Test Bagels - Main", "Test Bagels - Uptown", "TB3", "Bunn TB3", "", "S-3", "Loaned", "", "", ""],
  ]);
  assert.deepEqual(rows.map((r) => r.holdReasons), [[], ["Site 4443 Other Pkwy doesn't match Test Bagels - Main at 1025 Test Drive, Test City"], []]);
  assert.deepEqual(rows.map((r) => r.action), ["add", "add", "add"], "held, not Review: it can be ticked on its own");
});

test("the import writes the condition, keeps it when a file has none, and Remove and Put back carry it", async () => {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  try {
    for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const query = async (text, params) => (await pg.query(text, params)).rows;
    const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
    await query("insert into directory_customers (name) values ('Test Bagels - Main')");
    await query(IMP.importInsertUnitsSql(1), ["Test Bagels - Main", "Bunn TB3", "Bunn TB3", "S-1", "s-1", null, null, "Loaned", null, "Good"]);
    const [{ id }] = await query("select id from account_equipment");
    const cond = async () => (await query("select condition from account_equipment where id = $1", [id]))[0]?.condition;
    assert.equal(await cond(), "Good");
    await query(IMP.importUpdateUnitSql(), [id, "Bunn TB3", "Bunn TB3", "S-1", "s-1", null, null, null, null, null]);
    assert.equal(await cond(), "Good", "a file with no condition leaves it");
    await query(IMP.importUpdateUnitSql(), [id, "Bunn TB3", "Bunn TB3", "S-1", "s-1", null, null, null, null, "Fair"]);
    assert.equal(await cond(), "Fair");
    assert.equal((await IMP.readAccountUnits(sql, "Test Bagels - Main"))[0].condition, "Fair");
    await IMP.removeEquipmentUnit(sql, id, { userId: "u", name: "boss" });
    const [{ id: retiredId, condition }] = await query("select id, condition from account_equipment_retired");
    assert.equal(condition, "Fair");
    await R.restoreRetiredUnit(sql, retiredId);
    assert.equal(await cond(), "Fair");
  } finally {
    await pg.close();
  }
});

test("the import screen shows model pairings, holds, the condition, and keeps its result on screen", () => {
  const screen = src("src/components/desk/account-equip-import.tsx");
  assert.match(screen, /function PairingsPanel\(/);
  assert.match(screen, /if \(!d\.modelSet && !pairConfirmed\(row\.pairKey\)\) return false;/);
  assert.match(screen, /selected: !row\.holdReasons\?\.length && rowReady\(row, \{ \.\.\.d, selected: true \}\)/);
  assert.match(screen, /\{ duration: Infinity, closeButton: true \}/);
  assert.match(screen, /Condition: \{r\.condition\}/);
  assert.match(src("src/components/desk/account-history.tsx"), /row\.condition \? `Condition \$\{row\.condition\}` : null/);
});
