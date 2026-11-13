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
  const parts = new Map([
    ["444000202", { sku: "BUNNSUREIMMERSION312", mpn: "44400.0202", description: "Sure Immersion 312" }],
    ["357000019", { sku: 'BUNNITCBWFLIP29"', mpn: "35700.0019", description: null }],
    ["522000100", { sku: 'BUNNITCB29"TRAYNEWSTYLE', mpn: "52200.0100", description: null }],
    ["367000009", { sku: "BUNNTB3", mpn: "36700.0009", description: null }],
  ]);
  const pairings = IMP.buildPairings(rows, parts, CATALOG);
  const by = Object.fromEntries(pairings.map((p) => [p.fileModel, p]));
  assert.equal(pairings.length, 4, "ITCB-DV (NS) is its own pairing");
  // The same machine written longer keeps its catalog model, confirmed once.
  assert.deepEqual([by["Bunn ITCB-DV"].rows, by["Bunn ITCB-DV"].catalogModel, by["Bunn ITCB-DV"].suggestNew, by["Bunn ITCB-DV"].needsConfirm, by["Bunn ITCB-DV"].warnings], [2, 'Bunn ITCB-DV, 29" w/Flip Tray', false, true, []]);
  // (NS) is another machine: no near name, the file's model suggested as a new catalog model (11/12 test).
  assert.deepEqual(
    [by["Bunn ITCB-DV (NS)"].catalogModel, by["Bunn ITCB-DV (NS)"].suggestNew, by["Bunn ITCB-DV (NS)"].needsConfirm, by["Bunn ITCB-DV (NS)"].warnings],
    ["Bunn ITCB-DV (NS)", true, true, ['Not suggested: Bunn ITCB-DV, 29" w/Flip Tray. It reads as another machine.']],
  );
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
  assert.match(screen, /selected: row\.holdReasons\?\.length \? d\.selected : rowReady\(row, \{ \.\.\.d, selected: true \}\)/);
  assert.match(screen, /\{ duration: Infinity, closeButton: true \}/);
  assert.match(screen, /Condition: \{r\.condition\}/);
  assert.match(src("src/components/desk/account-history.tsx"), /row\.condition \? `Condition \$\{row\.condition\}` : null/);
});

// Fable review of this change (11/12).
test("a pairing reads every Part # its rows carry; one with several Part #s is confirmed", () => {
  const rows = preview([
    ["Test Bagels - Main", "1025 Test Drive", "Sure", "Bunn Sure Immersion 220", "44400.0200", "S-1", "Loaned", "", "", ""],
    ["Test Bagels - Main", "1025 Test Drive", "Sure", "Bunn Sure Immersion 220", "44400.0200", "S-2", "Loaned", "", "", ""],
    ["Test Bagels - Main", "1025 Test Drive", "Sure", "Bunn Sure Immersion 220", "44400.0202", "S-3", "Loaned", "", "", ""],
    ["Test Bagels - Main", "1025 Test Drive", "TB3", "Bunn TB3", "36700.0009", "S-4", "Loaned", "", "", ""],
  ]);
  const parts = new Map([
    ["444000200", { sku: "BUNNSUREIMMERSION220", mpn: "44400.0200", description: null }],
    ["444000202", { sku: "BUNNSUREIMMERSION312", mpn: "44400.0202", description: null }],
    ["367000009", { sku: "BUNNTB3", mpn: "36700.0009", description: null }],
  ]);
  const by = Object.fromEntries(IMP.buildPairings(rows, parts, CATALOG).map((p) => [p.fileModel, p]));
  assert.equal(by["Bunn Sure Immersion 220"].needsConfirm, true);
  assert.deepEqual(by["Bunn Sure Immersion 220"].warnings, [
    "Part # 44400.0202 is BUNNSUREIMMERSION312, which reads as another model.",
    "Its rows carry 2 Part #s: 44400.0200 (2), 44400.0202 (1).",
  ]);
  assert.equal(by["Bunn TB3"].needsConfirm, false);
});

test("a model number written with V+ is a model, not a voltage", () => {
  assert.equal(IMP.partModelConflict({ sku: "C11520", mpn: null, description: "CBS-1152V+" }, "Fetco CBS-1131V+"), true);
  assert.equal(IMP.partModelConflict({ sku: "C11310", mpn: null, description: "CBS-1131V+" }, "Fetco CBS-1131V+"), false);
  assert.equal(IMP.partModelConflict({ sku: "X", mpn: null, description: "Sego 12 120V" }, "Bravilor Sego 12 120V"), false);
});

test("a pairing whose rows matched differently reads as not matched, with every candidate", () => {
  const rows = [
    { ...preview([["Test Bagels - Main", "1025 Test Drive", "R", "Test Classe 5", "", "S-1", "", "", "", ""]])[0], modelStatus: "unmatched", modelCandidates: [], catalogModel: null, pairKey: "k" },
    { ...preview([["Test Bagels - Main", "1025 Test Drive", "R", "Test Classe 5", "", "S-2", "", "", "", ""]])[0], key: "r1", modelStatus: "ambiguous", modelCandidates: ["A", "B"], catalogModel: null, pairKey: "k" },
  ];
  const [p] = IMP.buildPairings(rows, new Map());
  // No catalog model: the file's model is suggested as a new one, and someone decides (11/12 test).
  assert.deepEqual([p.status, p.candidates, p.catalogModel, p.suggestNew, p.needsConfirm], ["ambiguous", ["A", "B"], "Test Classe 5", true, true]);
});

// Grok's 11/12 test of the live preview.
test("one pairing per file model, even when the rows' names as entered matched different catalog models", () => {
  const rows = preview([
    ["Test Bagels - Main", "1025 Test Drive", "Faema X20", "Faema X20 w/ Autosteam", "", "S-1", "", "", "", ""],
    ["Test Bagels - Main", "1025 Test Drive", "Something else", "Faema X20 w/ Autosteam", "", "S-2", "", "", "", ""],
  ]).map((r, i) => ({ ...r, catalogModel: i === 0 ? "Faema X20 /Turbosteam" : null, modelStatus: i === 0 ? "matched" : "unmatched" }));
  const pairings = IMP.buildPairings(rows, new Map(), ["Faema X20 /Turbosteam"]);
  assert.equal(pairings.length, 1);
  assert.equal(pairings[0].rows, 2);
});

test("no near names: a catalog model is kept only when it's the same machine written longer", () => {
  const same = (f, c) => IMP.sameMachineWritten(f, c);
  // Kept: describing words only.
  assert.equal(same("Bunn ITCB-DV", 'Bunn ITCB-DV, 29" w/Flip Tray'), true);
  assert.equal(same("Bunn G3 HD", "Bunn G3 HD BLK"), true);
  assert.equal(same("Bunn G9-2T HD", "Bunn G9-2T HD Dual Portion Grinder"), true);
  assert.equal(same("Fetco GR2.3", "Fetco GR2.3 Dual Portion Grinders (6 Batch Buttons)"), true);
  assert.equal(same("Bunn H5X Element (120V)", "Bunn H5X Element 120V 1800W"), true);
  assert.equal(same("Fetco CBS-1152 V+", "Fetco CBS-1152V+"), true, "spaces don't count");
  // Not kept: another machine, or maybe one (11/12 review: steps, sizes, groups and one-letter variants count).
  assert.equal(same("Eversys Cameo c'2s", "Eversys Cameo c'2s - 2 Step Classic"), false, "a step count may be a variant");
  assert.equal(same("Eversys Shotmaster M-Pro/ST", "Eversys Shotmaster S-Pro/ST"), false);
  assert.equal(same("Eversys Shotmaster S-Pro/ST", "Eversys Shotmaster M-Pro/ST"), false);
  assert.equal(same("La Marzocco Linea Classic S 2AV", "La Marzocco Linea Classic 2AV"), false);
  assert.equal(same("La Marzocco Linea Classic 2AV", "La Marzocco Linea Classic S 2AV"), false);
  assert.equal(same("Fetco CBS-52H", "Fetco CBS-52H 1.5G"), false, "a size");
  assert.equal(same("Test X", "Test X 2G"), false, "groups");
  assert.equal(same("Test Grinder", "Test Grinder Single Hopper"), false, "single vs dual");
  assert.equal(same("Mazzer Super Jolly Timer", "Mazzer Super Jolly Doser V Up w/ Timer"), false);
  assert.equal(same("Mazzer Super Jolly Electronic", "Mazzer Super Jolly V Up Electronic"), false);
  assert.equal(same("Rancilio Classe 5 USB 2GR", "Rancilio Classe 11 Xcelsius 3 GR"), false);
  assert.equal(same("Bunn ITCB-DV (NS)", 'Bunn ITCB-DV, 29" w/Flip Tray'), false);
  assert.equal(same("Bunn ITCB-DV HV", 'Bunn ITCB-DV, 29" w/Flip Tray'), false);
  assert.equal(same("Bunn H5X Element (208-240V)", "Bunn H5X, Element 240V 4000W"), false);
});

test("a live part's name picks the catalog model; Part #s that differ only in spaces are one; an unknown Part # is flagged", () => {
  const rows = preview([
    ["Test Bagels - Main", "1025 Test Drive", "Linea", "La Marzocco Linea Classic 2AV", "Linea 2 AV", "S-1", "", "", "", ""],
    ["Test Bagels - Main", "1025 Test Drive", "Linea", "La Marzocco Linea Classic 2AV", "Linea 2AV", "S-2", "", "", "", ""],
    ["Test Bagels - Main", "1025 Test Drive", "Cameo", "Eversys Cameo c'2s", "SE-C2S", "S-3", "", "", "", ""],
  ]);
  const parts = new Map([["LINEA2AV", { sku: "LMLINEA2AV", mpn: "Linea 2 AV", description: "La Marzocco Linea Classic 2 Group AV" }]]);
  const catalog = ["La Marzocco Linea Classic 2 Group AV", "Eversys Cameo c'2s - 2 Step Classic"];
  const by = Object.fromEntries(IMP.buildPairings(rows, parts, catalog).map((p) => [p.fileModel, p]));
  // The live part is named as another catalog model: the file's model is kept (as new) and the part's name is warned
  // about, never put in its place (11/12 review).
  assert.deepEqual([by["La Marzocco Linea Classic 2AV"].catalogModel, by["La Marzocco Linea Classic 2AV"].suggestNew], ["La Marzocco Linea Classic 2AV", true]);
  assert.ok(by["La Marzocco Linea Classic 2AV"].warnings.includes("Part # Linea 2 AV is LMLINEA2AV, named as the catalog's La Marzocco Linea Classic 2 Group AV; the file says La Marzocco Linea Classic 2AV."));
  assert.equal(by["La Marzocco Linea Classic 2AV"].warnings.some((w) => w.startsWith("Its rows carry")), false, "one Part #");
  assert.ok(by["Eversys Cameo c'2s"].notes.includes("Part # SE-C2S isn't a live part in Katz Desk; it is saved as written."));
  assert.equal(by["Eversys Cameo c'2s"].warnings.some((w) => w.includes("SE-C2S")), false, "a note, not a reason to hold the pairing");
});

test("a live part never puts its own model in place of the file's: the 220 with the 312 part, TB3 with a TB6 part", () => {
  const rows = preview([
    ["Test Bagels - Main", "1025 Test Drive", "Sure", "Bunn Sure Immersion 220", "44400.0202", "S-1", "", "", "", ""],
    ["Test Bagels - Main", "1025 Test Drive", "TB3", "Bunn TB3", "36700.0300", "S-2", "", "", "", ""],
  ]);
  const parts = new Map([
    ["444000202", { sku: "BUNNSUREIMMERSION312", mpn: "44400.0202", description: null }],
    ["367000300", { sku: "BUNNTB6", mpn: "36700.0300", description: null }],
  ]);
  const catalog = ["Bunn Sure Immersion 220", "Bunn Sure Immersion 312", "Bunn TB3", "Bunn TB6"];
  const by = Object.fromEntries(IMP.buildPairings(rows, parts, catalog).map((p) => [p.fileModel, p]));
  assert.deepEqual([by["Bunn Sure Immersion 220"].catalogModel, by["Bunn Sure Immersion 220"].needsConfirm], ["Bunn Sure Immersion 220", true]);
  assert.ok(by["Bunn Sure Immersion 220"].warnings.some((w) => w.includes("named as the catalog's Bunn Sure Immersion 312")));
  assert.deepEqual([by["Bunn TB3"].catalogModel, by["Bunn TB3"].needsConfirm], ["Bunn TB3", true], "an exact name with another model's part isn't auto-accepted");
  assert.ok(by["Bunn TB3"].warnings.some((w) => w.includes("named as the catalog's Bunn TB6")));
});

test("the dialog: a pairing's Part # goes to all its rows, labels say unticked, and nothing saves before Confirm", () => {
  const screen = src("src/components/desk/account-equip-import.tsx");
  assert.ok(screen.includes("partNumber: d.partNumber ?? row.partNumber,"));
  assert.ok(screen.includes('data-testid="equip-import-pairing-part"'));
  assert.ok(screen.includes("</span> unticked"));
  assert.ok(screen.includes("Nothing is saved until you press Confirm import."));
});
