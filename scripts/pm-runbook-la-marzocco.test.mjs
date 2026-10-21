import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { defaultConfig, kitList, optionalKits, optionsFromPiece, recommendInterval, startingOptions, stepList, unitModelPicked } from "../src/lib/ops/pm-runbook.ts";
import { planUnits } from "../src/lib/ops/pm-runbook-units.ts";
import { splitEquipment } from "../src/lib/ops/equipment.ts";
import { matchLmGb5, matchLmGs3, matchLmKb90, matchLmLinea, matchLmStrada } from "../src/lib/ops/runbooks/la-marzocco-match.ts";

const load = (id) => parseRunbookDefinition(JSON.parse(readFileSync(new URL(`../src/lib/ops/runbooks/${id}.json`, import.meta.url), "utf8")));
const IDS = ["la-marzocco-linea", "la-marzocco-strada", "la-marzocco-kb90", "la-marzocco-gb5", "la-marzocco-gs3"];
const kits = (def, over) => kitList(def, { ...defaultConfig(def), ...over }).map((k) => `${k.q}x ${k.ev}`);

test("every La Marzocco definition parses and has steps", () => {
  for (const id of IDS) {
    const def = load(id);
    assert.equal(def.id, id);
    assert.equal(def.manufacturer, "La Marzocco");
    assert.ok(def.steps.some((g) => g.items.length), id);
  }
});

test("Linea: one kit per visit and group count, never the earlier visits' kits", () => {
  const def = load("la-marzocco-linea");
  assert.deepEqual(kits(def, { model: "pb", pm: "12", groups: "3" }), ["1x PB.12.3"]);
  assert.deepEqual(kits(def, { model: "classic-s", pm: "6", groups: "1" }), ["1x LCS.6.1"]);
  assert.deepEqual(kits(def, { model: "classic-s", pm: "3", groups: "4" }), ["1x LCS.3.4"]);
  assert.deepEqual(kits(def, { model: "classic", pm: "12", groups: "2", ctrl: "mp" }), ["1x LINEA.12.2", "2x SA600/K2"]);
  assert.deepEqual(kits(def, { model: "classic", pm: "6", groups: "2", ctrl: "mp" }), ["1x LINEA.6.2"]);
  assert.deepEqual(kits(def, { model: "pb", pm: "6", groups: "1" }), [], "no 1-group PB kit");
});

test("Linea: flow meter checks only on AV, steam rebuild on the 6- and 12-month visits", () => {
  const def = load("la-marzocco-linea");
  const ids = (over) => stepList(def, { ...defaultConfig(def), ...over }).flatMap((g) => g.items.map((s) => s.id));
  assert.ok(ids({ model: "classic-s", pm: "3", ctrl: "av" }).includes("li-gh-res"));
  assert.ok(!ids({ model: "classic-s", pm: "3", ctrl: "ee" }).includes("li-gh-res"));
  assert.ok(!ids({ model: "pb", pm: "3" }).includes("li-st-rebuild"));
  assert.ok(ids({ model: "pb", pm: "6" }).includes("li-st-rebuild"));
  assert.ok(ids({ model: "pb", pm: "12" }).includes("li-br-psv"));
});

test("Strada and KB90: loose parts per group at 3/9 months, kits at 6 and 12", () => {
  const strada = load("la-marzocco-strada");
  assert.deepEqual(kits(strada, { model: "s", pm: "3", groups: "3" }), ["3x F.3.040", "3x H.3.001"]);
  assert.deepEqual(kits(strada, { model: "s", pm: "3", groups: "2", gasket: "silicone" }), ["2x F.3.040", "2x H.3.007"]);
  assert.deepEqual(kits(strada, { model: "x", pm: "3", groups: "2" }), ["2x A.5.095", "2x 1207"]);
  assert.deepEqual(kits(strada, { model: "x", pm: "6", groups: "3" }), ["1x STRADA.X.6.3"]);
  assert.deepEqual(kits(strada, { model: "s", pm: "12", groups: "2" }), ["1x STRADA.S.12.2"]);
  const kb = load("la-marzocco-kb90");
  assert.deepEqual(kits(kb, { pm: "3", groups: "3" }), ["3x A.5.095", "3x 1207"]);
  assert.deepEqual(kits(kb, { pm: "12", groups: "2" }), ["1x KB90.12.2"]);
});

test("GB5 and GS3 kits", () => {
  assert.deepEqual(kits(load("la-marzocco-gb5"), { pm: "6", groups: "4" }), ["1x GB5S.6.4"]);
  const gs3 = load("la-marzocco-gs3");
  assert.deepEqual(kits(gs3, { model: "av", pm: "6" }), ["1x H.3.001", "1x F.3.040"]);
  assert.deepEqual(kits(gs3, { model: "mp", pm: "12", gasket: "9" }), ["1x L105/B9", "1x F.3.040", "1x SA/600K", "1x L193", "1x B.2.025"]);
});

test("3/6/12 cycle from install date: 3, 6, 9 (3/9 visit), 12", () => {
  const def = load("la-marzocco-linea");
  const now = new Date("2027-10-20T00:00:00Z");
  assert.equal(recommendInterval(def, "2027-07-15", now)?.id, "3");
  assert.equal(recommendInterval(def, "2027-04-15", now)?.id, "6");
  assert.equal(recommendInterval(def, "2027-01-15", now)?.id, "3");
  assert.equal(recommendInterval(def, "2026-10-15", now)?.id, "12");
});

test("optional kits follow the visit, not a part that belongs to one interval", () => {
  const linea = load("la-marzocco-linea");
  const pb = (pm) => optionalKits(linea, { ...defaultConfig(linea), model: "pb", pm, groups: "3" });
  assert.deepEqual(pb("3"), []);
  assert.deepEqual(pb("6"), []);
  const classic = optionalKits(linea, { ...defaultConfig(linea), model: "classic", pm: "3", groups: "2", ctrl: "mp" });
  assert.equal(classic.find((k) => k.ev === "SA600/K2")?.q, 2);
  const gs3 = load("la-marzocco-gs3");
  const av = optionalKits(gs3, { ...defaultConfig(gs3), model: "av", pm: "6" }).map((k) => k.ev);
  assert.ok(av.includes("L193"));
  assert.ok(av.includes("B.2.025"));
});

test("matchers on real equipment text", () => {
  const cases = [
    ["La Marzocco Linea PB 2AV", matchLmLinea, "pb"],
    ["La Marzocco Linea PB X 3 Group ABR", matchLmLinea, "pb"],
    ["LM Linea S 2AV", matchLmLinea, "classic-s"],
    ["La Marzocco Linea Classic S 2 Group AV", matchLmLinea, "classic-s"],
    ["linea classic", matchLmLinea, "classic"],
    ["Linea 2 EE", matchLmLinea, null],
    ["la marz linea", matchLmLinea, null],
    ["strada s 2 gr", matchLmStrada, "s"],
    ["La Marzocco Strada X 2 Group", matchLmStrada, "x"],
    ["La Marzocco Strada XT 2 Group", matchLmStrada, null],
    ["Strada", matchLmStrada, null],
    ["Kb90 3av", matchLmKb90, "kb90"],
    ["GB5 3av", matchLmGb5, null],
    ["GB5S 2 group", matchLmGb5, "gb5s"],
    ["La Marzocco GB/5 S 2 Group AV", matchLmGb5, "gb5s"],
    ["GB/5", matchLmGb5, null],
    ["La Marz GS3", matchLmGs3, null],
    ["GS/3 MP", matchLmGs3, "mp"],
    ["GS3 AV", matchLmGs3, "av"],
  ];
  for (const [piece, fn, model] of cases) assert.deepEqual(fn(piece), { model }, piece);
  for (const piece of ["Linea Mini", "La Marzocco Linea Mini", "Linea Micra", "Strada AV 3 group", "Strada EE", "La Marzocco Swift Dual-Hopper Espresso Grinder", "Eversys Enigma e'4m X-Wide Classic"]) {
    for (const fn of [matchLmLinea, matchLmStrada, matchLmKb90, matchLmGb5, matchLmGs3]) assert.equal(fn(piece), null, piece);
  }
  for (const piece of ["Strada 3AV", "Strada 2EP", "Strada 2 Group EP", "Strada 3 Group MP", "Strada 3-Group EP", "Strada 3 Groups MP", "Strada 3gr AV", "Strada 2G EP"]) {
    assert.equal(matchLmStrada(piece), null, piece);
  }
  assert.equal(matchLmStrada("La Marzocco Strada S AV 2 Group")?.model, "s");
  assert.equal(matchLmStrada("Strada S AV 2 Group")?.model, "s");
  assert.deepEqual(matchLmStrada("La Marzocco Strada XT 2 Group AV"), { model: null });
  assert.notEqual(matchLmGb5("GB/5"), null);
  assert.equal(matchLmGb5("GB/5")?.model, null);
  assert.equal(unitModelPicked(null, matchLmStrada("La Marzocco Strada XT 2 Group").model), false);
  assert.deepEqual(splitEquipment("Linea PB + Swift").map((p) => matchLmLinea(p)?.model ?? "-"), ["pb", "-"]);
});

test("planUnits uses a model that only the catalog name gives", () => {
  const match = (piece) => {
    const gs3 = matchLmGs3(piece);
    if (gs3) return { runbookId: "la-marzocco-gs3", model: gs3.model };
    const linea = matchLmLinea(piece);
    if (linea) return { runbookId: "la-marzocco-linea", model: linea.model };
    return null;
  };
  const [gs3] = planUnits("La Marzocco GS3", [{ id: 4, equipmentName: "La Marz GS3", catalogModel: "La Marzocco GS3 MP", serial: "GS-1" }], match);
  assert.equal(gs3.model, "mp");
  const rows = [
    { id: 94, equipmentName: "La Marz GS3", catalogModel: "La Marzocco GS3 1 Group AV", serial: "AV-1" },
    { id: 95, equipmentName: "La Marz GS3", catalogModel: "La Marzocco GS3 1 Group MP", serial: "MP-1" },
  ];
  const [mp] = planUnits("La Marzocco GS3 MP", rows, match);
  assert.equal(mp.unitKey, "acct:95");
  assert.equal(mp.model, "mp");
});

test("group count and scales come off the equipment text until the unit has options saved", () => {
  const linea = load("la-marzocco-linea");
  const strada = load("la-marzocco-strada");
  const kb90 = load("la-marzocco-kb90");
  const gb5 = load("la-marzocco-gb5");
  assert.deepEqual(optionsFromPiece(linea, "La Marzocco Linea PB 4 Group AV"), { groups: "4" });
  assert.deepEqual(optionsFromPiece(strada, "La Marzocco Strada S 3AV"), { groups: "3" });
  assert.deepEqual(optionsFromPiece(kb90, "La Marzocco KB90 2AV with Scales"), { groups: "2", abr: "yes" });
  assert.deepEqual(optionsFromPiece(linea, "La Marzocco Linea PB 2 gr"), { groups: "2" });
  assert.deepEqual(optionsFromPiece(linea, "La Marzocco Linea PB 3 Group AV with Scales"), { groups: "3", scales: "yes" });
  assert.equal(optionsFromPiece(gb5, "La Marzocco GB5 S 2 Group ABR").scales, "yes");
  assert.deepEqual(optionsFromPiece(linea, "La Marzocco Linea PB 3EE"), { groups: "3" });
  assert.equal(optionsFromPiece(linea, "Linea PB 3-Group AV").groups, "3");
  assert.equal(optionsFromPiece(linea, "Linea 2 EE").groups, "2");
  assert.equal(optionsFromPiece(linea, "Linea Classic 2MP").groups, "2");
  assert.equal(optionsFromPiece(linea, "Linea PB 3 grp").groups, "3");
  assert.equal(optionsFromPiece(linea, "Linea PB 3G AV").groups, "3");
  assert.equal(optionsFromPiece(linea, "La Marzocco Linea PB 3AV; Fetco CBS-2252 NG Twin 1.5G").groups, "3");
  assert.equal(optionsFromPiece(linea, "Linea PB 2 w/ scales").scales, "yes");
  assert.deepEqual(optionsFromPiece(linea, "Linea PB 9 Group"), {});
  assert.deepEqual(startingOptions(linea, "La Marzocco Linea PB 4 Group AV", { groups: "2" }), { groups: "2" });
  assert.deepEqual(startingOptions(linea, "La Marzocco Linea PB 4 Group AV", {}), { groups: "4" });
});
