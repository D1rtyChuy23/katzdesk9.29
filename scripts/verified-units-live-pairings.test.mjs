// Grok's 11/13 live preview of the verified units list, and the review of the fix: a row's Part # that is a live part,
// named as a catalog model, suggests that model only when it is strictly the same machine; otherwise the file's model
// stays and the part's model is offered with a Use button, for a person to pick. The Part #s, part SKUs and catalog
// names copy the live preview's own notes. Made-up accounts and serials only.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const { mpnKey } = await import("../src/lib/ops/mpn-rules.ts");

const HEADERS = ["Customer", "Site Address", "Equipment Name as Entered", "Confirmed Model", "Part #", "Serial #", "Ownership", "Install Date", "Electrical", "Condition"];

// file model, Part #, live part SKU, the catalog model that part is named as, and whether it is suggested.
const CASES = [
  // Strictly the same machine: suggested by its Part #, still to confirm.
  ["La Marzocco Linea Classic S 2AV", "Linea S 2AV", "LMLINEAS2AV", "La Marzocco Linea Classic S 2 Group AV", true],
  ["La Marzocco Strada 2AV", "Strada AV 2 Group", "LMSTRADA2AV", "La Marzocco Strada AV 2 Group", true],
  ["Bunn H5X Element (208-240V)", "43600.0003", "BUNNH5X240V", "Bunn H5X, Element 240V 4000W", true],
  ["Bunn CWTF15-3 (3 lower)", "12950.0212", "BUNNCWTF15-3L", "Bunn CWTF15 - 3 Lower Warmers", true],
  // The part's name adds a letter, variant or number, or the file says something else: offered with Use, not suggested.
  ["Bunn CWTF15-APS", "23001.0006", "BUNNCWTF15-APS", "Bunn CWTF15-APS PF", false],
  ["La Marzocco Swift", "Swift Grinder", "LMSWIFTGRIND", "La Marzocco Swift Dual-Hopper Espresso Grinder", false],
  ["Bunn GVH", "55600.0100", "BUNNGVH-1GRINDER", "Bunn GVH-1, 120V Retail Grinder", false],
  ["Faema X20 w/ Autosteam", "Faema X20 TS", "FAX20TS", "Faema X20 /Turbosteam", false],
  ["Bunn CWTF15-3 (2 upper / 1 lower)", "12950.0213", "BUNNCWTF151L2U", "Bunn CWT15 1Lower/2 Upper", false],
  ["Mazzer Super Jolly Timer", "Super Jolly Timer", "MAZZERSJVUPTIMER", "Mazzer Super Jolly Doser V Up w/ Timer", false],
  ["Mazzer Super Jolly Electronic", "Super Jolly Electronic", "MAZZERSJVUPELEC", "Mazzer Super Jolly V Up Electronic", false],
  ["Bunn G2 HD", "22102.0000", "BUNNG92HD", "Bunn G9-2 HD Dual Portion Grinder", false],
  ["Fetco GR2.2", "G02012", "FETCOGR2.3", "Fetco GR2.3 Dual Portion Grinders (6 Batch Buttons)", false],
  ["La Marzocco Linea Classic 2AV", "Linea 2 AV", "LMLINEAS2AV2", "La Marzocco Linea Classic S 2 Group AV 2", false],
];

function build(cases, catalogExtra = []) {
  const rows = cases.map(([model, part], i) => ["Test Bagels - Main", "1025 Test Drive", "As entered", model, part, `S-${i}`, "", "", "", ""]);
  const { records } = IMP.parseEquipMatrix([HEADERS, ...rows]);
  const catalog = [...cases.map((c) => c[3]), ...catalogExtra];
  const previewRows = records.map((rec, i) => IMP.buildPreviewRow(rec, i, [{ id: 1, name: "Test Bagels - Main", address: "1025 Test Drive" }], catalog, []));
  const parts = new Map(cases.map(([, part, sku, name]) => [mpnKey(part), { sku, mpn: part, description: name }]));
  return Object.fromEntries(IMP.buildPairings(previewRows, parts, catalog).map((p) => [p.fileModel, p]));
}

test("a live part's catalog name is suggested only when it is strictly the same machine; else it is offered with Use", () => {
  const by = build(CASES);
  for (const [model, part, sku, name, fits] of CASES) {
    const p = by[model];
    assert.ok(p, model);
    if (fits) {
      assert.deepEqual([p.catalogModel, p.suggestNew, p.needsConfirm], [name, false, true], model);
      assert.ok(p.notes.includes(`Suggested by its Part # ${part} (${sku}).`), model);
      assert.equal(p.warnings.some((w) => w.startsWith("The file says")), false, `${model}: no word warning against its own fit`);
    } else {
      assert.notEqual(p.catalogModel, name, `${model} must not take ${name}`);
      assert.ok(p.warnings.some((w) => w.includes(`named as the catalog's ${name}`)), model);
      assert.ok(p.alternatives.includes(name), `${model}: ${name} is offered`);
    }
  }
});

test("a catalog model that is the same machine written longer comes before the part's: an H5X 120V with the 240V's part", () => {
  const { records } = IMP.parseEquipMatrix([HEADERS, ["Test Bagels - Main", "1025 Test Drive", "H5X", "Bunn H5X Element (120V)", "43600.0003", "S-1", "", "", "", ""]]);
  const catalog = ["Bunn H5X, Element 240V 4000W", "Bunn H5X Element 120V 1800W"];
  // As on the live list: the row's own match is the 120V model.
  const previewRows = records
    .map((rec, i) => IMP.buildPreviewRow(rec, i, [{ id: 1, name: "Test Bagels - Main", address: "1025 Test Drive" }], catalog, []))
    .map((r) => ({ ...r, catalogModel: "Bunn H5X Element 120V 1800W", modelStatus: "matched" }));
  const parts = new Map([[mpnKey("43600.0003"), { sku: "BUNNH5X240V", mpn: "43600.0003", description: "Bunn H5X, Element 240V 4000W" }]]);
  const [p] = IMP.buildPairings(previewRows, parts, catalog);
  assert.equal(p.catalogModel, "Bunn H5X Element 120V 1800W");
  assert.ok(p.warnings.some((w) => w.includes("named as the catalog's Bunn H5X, Element 240V 4000W")));
  assert.ok(p.alternatives.includes("Bunn H5X, Element 240V 4000W"));
});

test("the strict fit: same numbers, overlapping voltages, nothing missing, only describing words added", () => {
  const fits = IMP.partNameFits;
  assert.equal(fits("Bunn Sure Immersion 220", "Bunn Sure Immersion 312"), false);
  assert.equal(fits("Bunn TB3", "Bunn TB6"), false);
  assert.equal(fits("Bunn TB3", "Bunn TB3Q"), false, "an added letter");
  assert.equal(fits("Mahlkonig EK43", "Mahlkonig EK43 S"), false);
  assert.equal(fits("Bunn G2 HD", "Bunn G9-2 HD"), false, "G2 is not G9-2");
  assert.equal(fits("Bunn G9-2 HD", "Bunn G9-2T HD Dual Portion Grinder"), false, "T");
  assert.equal(fits("Bunn GVH", "Bunn GVH-1, 120V Retail Grinder"), false, "an added number");
  assert.equal(fits("Bunn H5X Element (120V)", "Bunn H5X, Element 240V 4000W"), false, "120V is not 240V");
  assert.equal(fits("Bunn H5X Element (208-240V)", "Bunn H5X Element 120V 1800W"), false);
  assert.equal(fits("Bunn H5X Element (208-240V)", "Bunn H5X, Element 240V 4000W"), true);
  assert.equal(fits("Mazzer Super Jolly Timer", "Mazzer Super Jolly Doser V Up w/ Timer"), false, "older Super Jollys aren't V Up");
  assert.equal(fits("Rancilio Classe 5 USB", "Rancilio Classe 5 USB 3 GR"), false);
  assert.equal(fits("Bunn ICB", "Bunn ICB Twin Tall"), false);
  assert.equal(fits("La Marzocco Linea Classic S 2AV", "La Marzocco Linea Classic S 2 Group AV"), true);
  assert.equal(fits("Bunn G9-2T HD", "Bunn G9-2T HD Dual Portion Grinder"), true);
});
