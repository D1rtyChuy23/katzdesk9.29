import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyDraft, parseExtraction } from "../src/lib/ops/spec-schema.ts";
import { groupFormRows } from "../src/lib/ops/install-form.ts";
import {
  adminSummary,
  applySpecPicks,
  bookSpecStatus,
  clipRows,
  diffSpec,
  isExact,
  orderAdminSections,
  outletForModel,
  outletFromConfigs,
  handEntryForRow,
  tiedSheetId,
  valuesFromParts,
  withSpecOutlet,
  blankSpecValues,
  isEnglishPage,
  pickSpecPages,
  specScore,
  textChars,
  valuesFromDraft,
} from "../src/lib/ops/spec-read.ts";

test("a blank field is a fill, a different filled field is a conflict, and the same value is not a change to save", () => {
  const current = { ...blankSpecValues(), voltage: "220V", plug: "L6-30P" };
  const extracted = { ...blankSpecValues(), voltage: "208-240V", plug: "L6-30P", amps: "30A", mpn: "ABC" };
  const changes = diffSpec(current, extracted);
  assert.equal(changes.find((c) => c.key === "voltage")?.kind, "conflict");
  assert.equal(changes.find((c) => c.key === "plug")?.kind, "same");
  assert.equal(changes.find((c) => c.key === "amps")?.kind, "fill");
  assert.equal(isExact(changes), false);
  assert.equal(isExact(changes.filter((c) => c.kind !== "conflict")), true);
});

test("approve fills a blank and leaves a conflict unless the review picks the new value", () => {
  const draft = emptyDraft();
  draft.manufacturer = "Bunn";
  draft.model = "ITCB";
  draft.configs = [{ label: "Standard", requirements: { power: { voltage: "120V" } } }];
  const extracted = { ...blankSpecValues(), voltage: "220V", amps: "20A", plug: "L6-20P" };
  const kept = applySpecPicks(draft, extracted, "", {});
  assert.equal(kept.draft.configs[0].requirements.power.voltage, "120V");
  assert.equal(kept.draft.configs[0].requirements.power.amps, "20A");
  assert.equal(kept.draft.configs[0].requirements.power.plug, "L6-20P");
  const replaced = applySpecPicks(draft, extracted, "OLD", { voltage: "new", mpn: "new" });
  assert.equal(replaced.draft.configs[0].requirements.power.voltage, "220V");
  assert.equal(replaced.mpn, null);
  const mpn = applySpecPicks(draft, { ...extracted, mpn: "NEW" }, "", {});
  assert.equal(mpn.mpn, "NEW");
  const stuck = applySpecPicks(draft, { ...extracted, mpn: "NEW" }, "OLD", {});
  assert.equal(stuck.mpn, null);
});

test("tank, brew, and dimensions come off the sheet", () => {
  const values = valuesFromParts({
    requirements: {
      power: { voltage: "220V", amps: "30A" },
      dimensions: { height: "32 in", width: "20 in", depth: "18 in", weight: "80 lb" },
      water: { inlet: '3/8"' },
      drain: { size: "1.5 in" },
    },
    specs: [
      { label: "Tank", value: "2 gallon" },
      { label: "Brew capacity", value: "10 gal/hr" },
    ],
    mpn: "ITCB",
  });
  assert.equal(values.tank, "2 gallon");
  assert.equal(values.brew, "10 gal/hr");
  assert.equal(values.height, "32 in");
  assert.equal(values.mpn, "ITCB");
});

test("a brew value gets its own row and never overwrites a tank or boiler capacity", () => {
  const draft = emptyDraft();
  draft.specs = [{ label: "Tank capacity", value: "3 gal" }];
  const filled = applySpecPicks(draft, { ...blankSpecValues(), brew: "3.8 gal/hr" }, "", {});
  assert.deepEqual(filled.draft.specs, [
    { label: "Tank capacity", value: "3 gal" },
    { label: "Brew capacity", value: "3.8 gal/hr" },
  ]);
  const espresso = emptyDraft();
  espresso.specs = [
    { label: "Boiler capacity", value: "11 L" },
    { label: "Brew capacity", value: "2 gal/hr" },
  ];
  const picked = applySpecPicks(espresso, { ...blankSpecValues(), brew: "3 gal/hr" }, "", { brew: "new" });
  assert.deepEqual(picked.draft.specs, [
    { label: "Boiler capacity", value: "11 L" },
    { label: "Brew capacity", value: "3 gal/hr" },
  ]);
});

test("a manufacturer with a bracket in its name does not break the outlet lookup", () => {
  const odd = { model: "G", manufacturer: "Acme (USA", voltage: "120V", amps: "15A", plug: "" };
  assert.equal(outletForModel("BUNN ICB", [odd]), undefined);
  assert.equal(outletForModel("Acme (USA G", [odd])?.voltage, "120V");
});

test("amps and plug come from the spec only when voltage is blank or it matches, and disagreeing configs are skipped", () => {
  const spec = { model: "Bunn ITCB", manufacturer: "Bunn", voltage: "220V", amps: "20A", plug: "L6-20P" };
  assert.equal(outletForModel("Bunn ITCB", [spec])?.amps, "20A");
  const otherVolts = withSpecOutlet({ model: "Bunn ITCB", voltage: "120V", plug: "", amps: "" }, spec);
  assert.equal(otherVolts.voltage, "120V");
  assert.equal(otherVolts.amps, "");
  assert.equal(otherVolts.plug, "");
  const blank = withSpecOutlet({ model: "Bunn ITCB", voltage: "", plug: "", amps: "" }, spec);
  assert.equal(blank.voltage, "220V");
  assert.equal(blank.amps, "20A");
  assert.equal(blank.plug, "L6-20P");
  const same = withSpecOutlet({ model: "Bunn ITCB", voltage: "220 V", plug: "l6 20p", amps: "" }, spec);
  assert.equal(same.voltage, "220 V");
  assert.equal(same.amps, "20A");
  assert.equal(same.plug, "l6 20p");
  assert.equal(outletFromConfigs([
    { voltage: "120V", amps: "15A", plug: "5-15P" },
    { voltage: "220V", amps: "20A", plug: "L6-20P" },
  ]), null);
  assert.equal(outletFromConfigs([
    { voltage: "220V", amps: "20A", plug: "L6-20P" },
    { voltage: "220 V", amps: "20A", plug: "L6-20P" },
  ])?.voltage, "220V");
  assert.equal(handEntryForRow({ status: "unreadable", fileId: 4, bookId: 9 })?.kind, "file");
  assert.equal(handEntryForRow({ status: "needs_review", fileId: 4, bookId: 9 }), null);
  const rows = groupFormRows([
    { model: "Bunn ITCB", serial: "", notes: "", voltage: "220V", plug: "", amps: "20A" },
  ]);
  assert.equal(rows[0].outlet, "220V · 20A");
});

test("a unit with its own plug that isn't the spec's takes neither voltage nor amps from the spec", () => {
  const spec = { model: "X", manufacturer: "Bunn", voltage: "208V", amps: "30A", plug: "NEMA 6-30P" };
  const own = withSpecOutlet({ model: "X", voltage: "", plug: "NEMA 5-15P", amps: "" }, spec);
  assert.deepEqual([own.voltage, own.amps, own.plug], ["", "", "NEMA 5-15P"]);
  const ownVolts = withSpecOutlet({ model: "X", voltage: "208V", plug: "NEMA 5-15P", amps: "" }, spec);
  assert.deepEqual([ownVolts.voltage, ownVolts.amps, ownVolts.plug], ["208V", "", "NEMA 5-15P"]);
  const samePlug = withSpecOutlet({ model: "X", voltage: "", plug: "nema 6-30p", amps: "" }, spec);
  assert.deepEqual([samePlug.voltage, samePlug.amps, samePlug.plug], ["208V", "30A", "nema 6-30p"]);
});

test("plugs are compared by NEMA code, and a spec with no plug clashes with no unit", () => {
  const unit = (plug) => ({ model: "X", voltage: "", plug, amps: "" });
  const bits = (u) => [u.voltage, u.amps, u.plug];
  const twist = { model: "X", manufacturer: "Bunn", voltage: "208V", amps: "30A", plug: "NEMA L6-30 twist-lock" };
  assert.deepEqual(bits(withSpecOutlet(unit("L6-30P"), twist)), ["208V", "30A", "L6-30P"]);
  const twenty = { model: "X", manufacturer: "Bunn", voltage: "120V", amps: "20A", plug: "NEMA 5-20" };
  assert.deepEqual(bits(withSpecOutlet(unit("5-20P"), twenty)), ["120V", "20A", "5-20P"]);
  const noPlug = { model: "X", manufacturer: "Bunn", voltage: "120V", amps: "15A", plug: "" };
  assert.deepEqual(bits(withSpecOutlet(unit("NEMA 5-15P"), noPlug)), ["120V", "15A", "NEMA 5-15P"]);
  const thirty = { model: "X", manufacturer: "Bunn", voltage: "208V", amps: "30A", plug: "6-30P" };
  assert.deepEqual(bits(withSpecOutlet(unit("5-15P"), thirty)), ["", "", "5-15P"]);
  assert.deepEqual(bits(withSpecOutlet(unit("L6-30P"), { ...twist, plug: "NEMA 6-30" })), ["", "", "L6-30P"]);
});

test("plugs typed with an R, a space, no hyphen or hardwire wording still match the spec's plug", () => {
  const unit = (plug) => ({ model: "X", voltage: "", plug, amps: "" });
  const bits = (u) => [u.voltage, u.amps];
  const spec = (plug, voltage, amps) => ({ model: "X", manufacturer: "Bunn", voltage, amps, plug });
  const l630 = spec("NEMA L6-30 twist-lock", "208V", "30A");
  const l620 = spec("NEMA L6-20 twist-lock", "208V", "20A");
  assert.deepEqual(bits(withSpecOutlet(unit("L6-30R"), l630)), ["208V", "30A"]);
  assert.deepEqual(bits(withSpecOutlet(unit("l6 20p"), l620)), ["208V", "20A"]);
  assert.deepEqual(bits(withSpecOutlet(unit("L620P"), l620)), ["208V", "20A"]);
  assert.deepEqual(bits(withSpecOutlet(unit("5-20R"), spec("NEMA 5-20", "120V", "20A"))), ["120V", "20A"]);
  assert.deepEqual(bits(withSpecOutlet(unit("Hardwired"), spec("Hardwire only", "208V 3-phase", "40A"))), ["208V 3-phase", "40A"]);
  assert.deepEqual(bits(withSpecOutlet(unit("Hard wire"), spec("Hardwire only", "208V 3-phase", "40A"))), ["208V 3-phase", "40A"]);
  // A different outlet, however it is spelled, still takes nothing.
  assert.deepEqual(bits(withSpecOutlet(unit("5-15P"), spec("6-30P", "208V", "30A"))), ["", ""]);
  assert.deepEqual(bits(withSpecOutlet(unit("L6-30P"), spec("NEMA 6-30", "208V", "30A"))), ["", ""]);
  assert.deepEqual(bits(withSpecOutlet(unit("L6-30"), spec("NEMA L14-30 twist-lock", "208V", "30A"))), ["", ""]);
  assert.deepEqual(bits(withSpecOutlet(unit("L6-30R"), spec("NEMA L14-30 twist-lock", "208V", "30A"))), ["", ""]);
  assert.deepEqual(bits(withSpecOutlet(unit("Hardwired"), spec("NEMA 5-20", "120V", "20A"))), ["", ""]);
});

test("a hand entry on a model that already has a sheet opens that sheet", () => {
  const sheetBooks = [{ sheetId: 4, bookId: null }, { sheetId: 3, bookId: 9 }];
  assert.equal(tiedSheetId(sheetBooks, 9), 3);
  assert.equal(tiedSheetId(sheetBooks, 8), null);
});

test("opening a tied sheet clears the Library search, so the Edit form isn't filtered out", () => {
  const src = readFileSync(new URL("../src/routes/_app/library.tsx", import.meta.url), "utf8");
  const start = src.indexOf("function editTiedSheet(");
  assert.ok(start >= 0);
  const body = src.slice(start, src.indexOf("\n  }\n", start));
  assert.match(body, /setQ\(""\);/);
  assert.ok(body.indexOf('setQ("")') < body.indexOf("navigate("), "search is cleared before the sheet opens");
});

test("tiles, admin order, and the summary line", () => {
  assert.equal(bookSpecStatus(0, []), "no_sheet");
  assert.equal(bookSpecStatus(1, []), null);
  assert.equal(bookSpecStatus(2, ["read", "needs_review"]), "needs_review");
  assert.equal(bookSpecStatus(1, ["unreadable"]), "unreadable");
  assert.equal(bookSpecStatus(1, ["read"]), "read");
  const ordered = orderAdminSections([
    { id: "clear", openCount: 0 },
    { id: "work", openCount: 2 },
    { id: "also", openCount: 1 },
  ]);
  assert.deepEqual(ordered.map((s) => s.id), ["work", "also", "clear"]);
  assert.equal(
    adminSummary([
      { id: "dup", openCount: 30, noun: "duplicate groups" },
      { id: "tie", openCount: 11, noun: "untied sheets" },
      { id: "leg", openCount: 3, noun: "legacy" },
      { id: "done", openCount: 0, noun: "cleanup" },
    ]),
    "3 sections need action: 30 duplicate groups, 11 untied sheets, 3 legacy.",
  );
  assert.equal(adminSummary([{ id: "a", openCount: 0, noun: "cleanup" }]), "All clear.");
  assert.equal(clipRows([1, 2, 3, 4], false, 2).more, 2);
  assert.equal(clipRows([1, 2], true, 2).rows.length, 2);
});

/* ------------------------------------------------------------------ 10/28: reading manuals and long files */

const filler = (n, seed) => `${seed} ` + "Clean the brew basket with warm water and a soft brush after each use. ".repeat(n);

test("a short file goes to the AI whole, each page marked; blank pages are left out", () => {
  const pick = pickSpecPages([
    { page: 1, text: "ACME X1" },
    { page: 2, text: "  " },
    { page: 3, text: "Voltage 120 V" },
  ]);
  assert.equal(pick.text, "[Page 1]\nACME X1\n\n[Page 3]\nVoltage 120 V");
  assert.deepEqual(pick.used, [1, 3]);
  assert.equal(pick.total, 2);
});

test("a long file sends its first page, then the pages with spec words, English first, as many as fit, in page order", () => {
  const pages = Array.from({ length: 30 }, (_, i) => ({ page: i + 1, text: filler(25, `Page ${i + 1}.`) }));
  pages[0] = { page: 1, text: "ACME X1 Espresso Machine. Installation and Operation Manual for the machine." };
  // The spec pages are as long as the others, so four pages fill the limit.
  pages[16] = { page: 17, text: filler(22, "Technical data and specifications for the machine:") + " Voltage 208-240 V, 30 A, 60 Hz, 1 phase. Weight 120 lb." };
  pages[21] = { page: 22, text: filler(23, "Specifications.") + " Voltage 120 V for the 1 group." };
  pages[24] = { page: 25, text: "Technische Daten: Spannung 230 V, 50 Hz, und die Maschine ist mit der Leistung 3000 W. Gewicht 55 kg. ".repeat(17) };
  // Room for the cover and the three spec pages, and not for one more page.
  const room = [0, 16, 21, 24].reduce((n, i) => n + pages[i].text.length + 14, 0) + 100;
  const pick = pickSpecPages(pages, room);
  assert.deepEqual(pick.used, [1, 17, 22, 25], "the cover, the English spec pages, then the German one");
  assert.match(pick.text, /^\[Page 1\]\nACME X1/);
  assert.ok(pick.text.length <= room);
  assert.equal(pick.total, 30);
  // With room for one more page, the first English page without spec words comes next.
  assert.deepEqual(pickSpecPages(pages, room + pages[1].text.length + 14).used, [1, 2, 17, 22, 25]);
  // With room for only two spec pages: the English ones, not the German one.
  assert.deepEqual(pickSpecPages(pages, room - pages[24].text.length).used, [1, 17, 22]);
  // One page longer than the limit: its start.
  const big = pickSpecPages([{ page: 4, text: "Voltage 120 V. " + "x".repeat(5000) }], 1000);
  assert.deepEqual(big.used, [4]);
  assert.ok(big.text.length <= 1000);
});

test("spec words and the page's language", () => {
  assert.ok(specScore("Technical Data: 120 V, 15 A, 60 Hz, single phase. Weight 40 lb.") > specScore("Weight 40 lb."));
  assert.equal(specScore("Clean the brew basket."), 0);
  assert.equal(isEnglishPage("The machine must be installed with the water line."), true);
  assert.equal(isEnglishPage("Die Maschine ist mit der Wasserleitung und dem Ablauf zu verbinden."), false);
  assert.equal(isEnglishPage("La machine doit être installée et les tuyaux pour l'eau."), false);
  assert.equal(textChars([{ text: " a b \n c " }]), 3);
});

test("a blank field fills from a spec row with its label, then from other configurations that agree", () => {
  const values = valuesFromParts({
    requirements: { power: { amps: "30A" }, dimensions: { height: "32 in" } },
    specs: [
      { label: "Rated voltage", value: "208-240V" },
      { label: "Amperage", value: "40A" },
      { label: "Water inlet pressure", value: "20-80 psi" },
      { label: "Net weight", value: "120 lb" },
    ],
    others: [
      { water: { inlet: '3/8" flare' }, power: { phase: "1-phase", amps: "40A" }, dimensions: { width: "30 in" } },
      { water: { inlet: '3/8" flare' }, power: { phase: "1-phase", amps: "50A" }, dimensions: { width: "37 in" } },
      null,
    ],
  });
  assert.equal(values.voltage, "208-240V", "from the spec row");
  assert.equal(values.amps, "30A", "a filled field is kept");
  assert.equal(values.weight, "120 lb");
  assert.equal(values.waterInlet, '3/8" flare', "not the pressure row: the other configurations agree");
  assert.equal(values.phase, "1-phase");
  assert.equal(values.width, "", "configurations that differ stay blank");
  assert.equal(values.height, "32 in");
  const draft = emptyDraft();
  draft.configs = [
    { label: "2 Group", requirements: { power: { voltage: "208V" } } },
    { label: "3 Group", requirements: { power: { voltage: "208V", plug: "NEMA 6-50P" } } },
  ];
  assert.equal(valuesFromDraft(draft).plug, "NEMA 6-50P", "the draft's other configurations count too");
});

test("the AI's sheet may have no maker or model, and a spec row with no label is dropped, not a failure", () => {
  const parsed = parseExtraction(
    JSON.stringify({
      manufacturer: null,
      specs: [
        { label: "", value: "orphan" },
        { label: "Boilers", value: "2" },
        { value: "no label" },
        { label: 3, value: "groups" },
      ],
      configs: [{ label: "Standard", requirements: { other: [{ label: " ", value: "x" }, { label: "Tank", value: "2 gal" }] } }],
    }),
  );
  assert.equal(parsed.ok, true, parsed.error);
  assert.equal(parsed.data.manufacturer, "");
  assert.equal(parsed.data.model, "");
  assert.deepEqual(parsed.data.specs, [
    { label: "Boilers", value: "2" },
    { label: "3", value: "groups" },
  ]);
  assert.deepEqual(parsed.data.configs[0].requirements.other, [{ label: "Tank", value: "2 gal" }]);
});
