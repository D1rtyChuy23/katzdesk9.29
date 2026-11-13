// Grok's 11/13 live preview of the verified units list: a row's Part # that is a live part, named as a catalog model,
// suggests that model when it fits the file's model; a part that names another model never replaces it. The Part #s,
// part SKUs and catalog names copy the live preview's own notes. Made-up accounts and serials only.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1/katzdesk-test-unused";

const IMP = await import("../src/lib/ops/account-equip-import.ts");
const { mpnKey } = await import("../src/lib/ops/mpn-rules.ts");

const HEADERS = ["Customer", "Site Address", "Equipment Name as Entered", "Confirmed Model", "Part #", "Serial #", "Ownership", "Install Date", "Electrical", "Condition"];

// file model, Part #, live part SKU, the catalog model that part is named as, and whether it should be suggested.
const CASES = [
  ["Bunn CWTF15-APS", "23001.0006", "BUNNCWTF15-APS", "Bunn CWTF15-APS PF", true],
  ["La Marzocco Swift", "Swift Grinder", "LMSWIFTGRIND", "La Marzocco Swift Dual-Hopper Espresso Grinder", true],
  ["La Marzocco Linea Classic S 2AV", "Linea S 2AV", "LMLINEAS2AV", "La Marzocco Linea Classic S 2 Group AV", true],
  ["La Marzocco Strada 2AV", "Strada AV 2 Group", "LMSTRADA2AV", "La Marzocco Strada AV 2 Group", true],
  ["Bunn H5X Element (208-240V)", "43600.0003", "BUNNH5X240V", "Bunn H5X, Element 240V 4000W", true],
  ["Bunn CWTF15-3 (3 lower)", "12950.0212", "BUNNCWTF15-3L", "Bunn CWTF15 - 3 Lower Warmers", true],
  ["Bunn GVH", "55600.0100", "BUNNGVH-1GRINDER", "Bunn GVH-1, 120V Retail Grinder", true],
  // The file says another machine: kept as the file has it, the part's name warned about.
  ["Faema X20 w/ Autosteam", "Faema X20 TS", "FAX20TS", "Faema X20 /Turbosteam", false],
  ["Bunn CWTF15-3 (2 upper / 1 lower)", "12950.0213", "BUNNCWTF151L2U", "Bunn CWT15 1Lower/2 Upper", false],
  ["Bunn Sure Immersion 312 Test", "44400.0220", "BUNNSUREIMMERSION220", "Bunn Sure Immersion 220", false],
  ["Bunn TB3 Test", "36700.0300", "BUNNTB6", "Bunn TB6", false],
];

function build() {
  const rows = CASES.map(([model, part], i) => ["Test Bagels - Main", "1025 Test Drive", "As entered", model, part, `S-${i}`, "", "", "", ""]);
  const { records } = IMP.parseEquipMatrix([HEADERS, ...rows]);
  const catalog = CASES.map((c) => c[3]);
  const previewRows = records.map((rec, i) => IMP.buildPreviewRow(rec, i, [{ id: 1, name: "Test Bagels - Main", address: "1025 Test Drive" }], catalog, []));
  const parts = new Map(CASES.map(([, part, sku, name]) => [mpnKey(part), { sku, mpn: part, description: name }]));
  return Object.fromEntries(IMP.buildPairings(previewRows, parts, catalog).map((p) => [p.fileModel, p]));
}

test("a live part named as a catalog model that fits the file's model is suggested, by its Part #, still to confirm", () => {
  const by = build();
  for (const [model, part, sku, name, fits] of CASES) {
    const p = by[model];
    assert.ok(p, model);
    if (fits) {
      assert.deepEqual([p.catalogModel, p.suggestNew, p.needsConfirm], [name, false, true], model);
      assert.ok(p.notes.includes(`Suggested by its Part # ${part} (${sku}).`), model);
      assert.equal(p.warnings.some((w) => w.startsWith("Not suggested")), false, `${model}: the part's model isn't "not suggested"`);
    } else {
      assert.equal(p.catalogModel === name, false, `${model} must not take ${name}`);
      assert.ok(p.warnings.some((w) => w.includes(`named as the catalog's ${name}`)), model);
    }
  }
});

test("the fit check: numbers must all be there and the file adds no word; voltages and ranges don't count", () => {
  assert.equal(IMP.partNameFits("Bunn Sure Immersion 220", "Bunn Sure Immersion 312"), false);
  assert.equal(IMP.partNameFits("Bunn TB3", "Bunn TB6"), false);
  assert.equal(IMP.partNameFits("Mazzer Super Jolly Timer", "Mazzer Super Jolly Doser V Up w/ Timer"), true, "the part vouches for the words its name adds");
  assert.equal(IMP.partNameFits("Bunn ITCB-DV (NS)", 'Bunn ITCB-DV, 29" w/Flip Tray'), false, "the file says NS");
  assert.equal(IMP.partNameFits("Rancilio Classe 5 USB 2GR", "Rancilio Classe 11 Xcelsius 3 GR"), false);
  assert.equal(IMP.partNameFits("Bunn H5X Element (208-240V)", "Bunn H5X, Element 240V 4000W"), true);
});
