import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { defaultConfig, kitList, stepList, totalKits } from "../src/lib/ops/pm-runbook.ts";
import {
  identifyBySerial,
  matchCameo,
  matchELine,
  matchEnigma,
  matchLegacyPlus,
  matchShotmaster,
} from "../src/lib/ops/pm-runbook-match.ts";
import { planUnits } from "../src/lib/ops/pm-runbook-units.ts";

const load = (name) =>
  parseRunbookDefinition(JSON.parse(readFileSync(new URL(`../src/lib/ops/runbooks/${name}.json`, import.meta.url), "utf8")));
const enigma = load("eversys-enigma");
const shot = load("eversys-shotmaster");
const cameo = load("eversys-cameo");
const legacy = load("eversys-legacy-plus");
const eline = load("eversys-eline");
const xwide = load("eversys-e4-xwide");

const kits = (def, over) => kitList(def, { ...defaultConfig(def), ...over });
const qty = (lines) => Object.fromEntries(lines.map((l) => [l.ev, l.q]));

// ---------------- quantities from the V4.0 manuals ----------------

test("Enigma brew and hydraulic scale with brew units (Manual p.9, p.11)", () => {
  for (const [model, n] of [["2c", 1], ["2s", 1], ["2ms", 1], ["4s", 2], ["4ms", 2], ["6s", 3], ["6ms", 3]]) {
    const q = qty(kits(enigma, { model, pm: "36", amer: "yes", choco: "1" }));
    assert.equal(q.EV117077, n, `brew ${model}`);
    assert.equal(q.EV109586, n, `hydraulic ${model}`);
    assert.equal(q.EV109590, n, `americano ${model}`);
    assert.equal(q.EV102865, n, `choco hydraulic ${model}`);
  }
});

test("Enigma E'2c 36-month: no steam, hot water or milk kits", () => {
  const q = qty(kits(enigma, { model: "2c", pm: "36", tea: "auto", wand: "2" }));
  assert.deepEqual(q, { EV117077: 1, EV109586: 1 });
});

test("Enigma E'6ms 36-month, two wands, auto tea, one 1.5-Step", () => {
  const q = qty(kits(enigma, { model: "6ms", pm: "36", wand: "2", tea: "auto", steps: "1" }));
  assert.equal(q.EV108389, 1);
  assert.equal(q.EV108354, 4); // 2 wands + 2 milk positions (p.14)
  assert.equal(q.EV108391, 2);
  assert.equal(q.EV109568, 1);
  assert.equal(q.EV108312, 2);
  assert.equal(q.EV108339, 2);
  assert.equal(q.EV108340, 2);
  assert.equal(q.EV108351, 1); // one 1.5-Step (p.21)
  assert.equal(q.EV108364, 1);
});

test("Enigma frame add-ons follow the 1.5-Step tables (p.21)", () => {
  assert.equal(qty(kits(enigma, { model: "4ms", pm: "12", steps: "0" })).EV108351, 2);
  assert.equal(qty(kits(enigma, { model: "4ms", pm: "12", steps: "2" })).EV108351, undefined);
  assert.equal(qty(kits(enigma, { model: "4ms", pm: "12", steps: "2" })).EV108364, 2);
  assert.equal(qty(kits(enigma, { model: "2ms", pm: "12", steps: "0" })).EV108351, 1);
  assert.equal(qty(kits(enigma, { model: "2ms", pm: "12", steps: "1" })).EV108351, undefined);
  assert.equal(qty(kits(enigma, { model: "2ms", pm: "12", steps: "1" })).EV108364, 1);
});

test("Enigma 2-outlet E'choco add-on only on E'4ms and E'6 (p.23)", () => {
  assert.equal(qty(kits(enigma, { model: "4s", choco: "2" })).EV111934, undefined);
  assert.equal(qty(kits(enigma, { model: "4ms", choco: "2" })).EV111934, 1);
  assert.equal(qty(kits(enigma, { model: "6s", choco: "2" })).EV111934, 1);
});

test("Shotmaster c 12-month is brew only; s-pro 36 doubles brew and hydraulic", () => {
  assert.deepEqual(qty(kits(shot, { model: "c", pm: "12" })), { EV117077: 2 });
  const q = qty(kits(shot, { model: "spro", pm: "36", choco: "1", amer: "yes" }));
  assert.equal(q.EV117077, 4);
  assert.equal(q.EV109586, 4);
  assert.equal(q.EV109590, 4);
  assert.equal(q.EV102865, 2); // E'choco hydraulic add-on stays x2 on the Pro (p.11)
});

test("Shotmaster ms 36-month milk kits x2", () => {
  const q = qty(kits(shot, { model: "ms", pm: "36" }));
  assert.equal(q.EV108339, 2);
  assert.equal(q.EV108340, 2);
  assert.equal(q.EV108312, 2);
  assert.equal(q.EV108351, 2);
});

test("Cameo C'2c 12-month: brew only", () => {
  assert.deepEqual(qty(kits(cameo, { model: "2c", pm: "12" })), { EV108358: 1 });
});

test("Cameo C'2ms 36-month with wand: steam, milk and frame (Cameo manual p.10-19)", () => {
  const q = qty(kits(cameo, { model: "2ms", pm: "36", wand: "yes", step15: "no" }));
  assert.deepEqual(q, {
    EV108358: 1, EV108304: 1, EV108380: 1, EV108311: 1, EV108354: 2, EV108391: 1, EV108312: 1,
    EV108339: 1, EV108340: 1, EV108359: 1, EV108351: 1,
  });
});

test("Cameo C'2ms without wand takes the banjo plug, not Everfoam", () => {
  const q = qty(kits(cameo, { model: "2ms", pm: "36", wand: "no" }));
  assert.equal(q.EV114733, 1);
  assert.equal(q.EV108391, undefined);
  assert.equal(q.EV108354, 1); // milk position only
});

test("Cameo EV102865 adds up for C'choco and automatic hot cleaning", () => {
  const line = kits(cameo, { model: "2ms", pm: "36", choco: "yes", hotclean: "yes" }).find((l) => l.ev === "EV102865");
  assert.equal(line.q, 2);
  assert.deepEqual(line.parts.map((p) => p.label), ["C'choco", "automatic hot cleaning"]);
});

test("Legacy+ L'2m 36-month, large brew, 3 grinders, powder", () => {
  const q = qty(kits(legacy, { model: "2m", pm: "36", brew: "l", grinders: "3", powder: "yes" }));
  assert.deepEqual(q, {
    EV113706: 3, EV119813: 1, EV113695: 1, EV113696: 1, EV113697: 1, EV113700: 1, EV113701: 1, EV113704: 1,
    EV113942: 1, EV120356: 1,
  });
});

test("Legacy+ L'2c 12-month, medium brew", () => {
  assert.deepEqual(qty(kits(legacy, { model: "2c", pm: "12", brew: "m" })), { EV113692: 1 });
});

test("E'line uses EV118340 brew and EV102824 milk, Enigma kits for the rest", () => {
  const q = qty(kits(eline, { model: "4ms", pm: "12" }));
  assert.equal(q.EV118340, 2);
  assert.equal(q.EV102824, 2);
  assert.equal(q.EV108389, 1);
  assert.equal(q.EV117077, undefined);
  assert.equal(q.EV108339, undefined);
});

test("X-Wide note for EV109706 is the V4.0 O-ring count", () => {
  const line = kits(xwide, { model: "4ms", choco: "1" }).find((l) => l.ev === "EV109706");
  assert.match(line.notes.join(" "), /118259 x2/);
});

test("every definition lists steps for its default setup", () => {
  for (const def of [enigma, shot, cameo, legacy, eline]) {
    assert.ok(stepList(def, defaultConfig(def)).length > 2, def.id);
    assert.ok(totalKits(kits(def, {})) > 0, def.id);
  }
});

// ---------------- recognising units in Katz's text ----------------

test("Shotmaster names", () => {
  assert.deepEqual(matchShotmaster("Eversys Shotmaster CT"), { runbookId: "eversys-shotmaster", model: "c" });
  assert.deepEqual(matchShotmaster("Eversys Shotmaster S/Pro"), { runbookId: "eversys-shotmaster", model: "spro" });
  assert.deepEqual(matchShotmaster("Eversys e'4 Shotmaster Pro (Production)"), { runbookId: "eversys-shotmaster", model: null });
  assert.equal(matchShotmaster("Eversys Cameo c'2s"), null);
});

test("Cameo names", () => {
  assert.equal(matchCameo("Eversys Cameo c'2s").model, "2s");
  assert.equal(matchCameo("Cameo C2's").model, "2s");
  assert.equal(matchCameo("Eversys Cameo c'2m").model, "2ms");
  assert.equal(matchCameo("cameo C2M").model, "2ms");
  assert.equal(matchCameo("Cameo C2'M").model, "2ms");
  assert.equal(matchCameo("Cameo").model, null);
  assert.equal(matchCameo("Bunn C2 Brewer"), null);
});

test("Legacy+ names, never the Legacy Lounge or Legacy Steam", () => {
  assert.deepEqual(matchLegacyPlus("Eversys Legacy"), { runbookId: "eversys-legacy-plus", model: null });
  assert.ok(matchLegacyPlus("Legacy+"));
  assert.equal(matchLegacyPlus("Bunn TB3 #1 (Legacy Lounge) 4th Floor"), null);
  assert.equal(matchLegacyPlus("Eversys Legacy Steam"), null);
  assert.equal(matchLegacyPlus("Legacy L'2m").model, "2m");
});

test("E'line and Enigma names", () => {
  assert.deepEqual(matchELine("Eversys e'4s e'line"), { runbookId: "eversys-eline", model: "4s" });
  assert.equal(matchELine("E'line E6").runbookId, "eversys-eline");
  assert.equal(matchELine("Enigma / e'Line"), null);
  assert.deepEqual(matchEnigma("Eversys Enigma e'4s Classic"), { runbookId: "eversys-enigma", model: "4s" });
  assert.equal(matchEnigma("Eversys e'4m").model, "4ms");
  assert.equal(matchEnigma("e'6s").model, "6s");
  assert.equal(matchEnigma("Eversys e'4s ST X-Wide"), null);
  assert.equal(matchEnigma("E'4s xtrawide"), null);
  assert.equal(matchEnigma("Eversys Enigma e'Fridge ST"), null);
  assert.equal(matchEnigma("Eversys e'4s e'line"), null);
});

// ---------------- serial numbers ----------------

test("serial prefixes name the machine", () => {
  assert.equal(identifyBySerial("0115390026159E0001").model, "c"); // Katz "Shotmaster CT"
  assert.equal(identifyBySerial("0116650021340E0001").model, "spro");
  assert.equal(identifyBySerial("1166500213400").model, "spro"); // leading zero lost in a spreadsheet
  assert.equal(identifyBySerial("0099820025259C0040").runbookId, "eversys-cameo");
  assert.equal(identifyBySerial("0116600000000").runbookId, "eversys-e4-xwide");
  assert.equal(identifyBySerial("0099930000000").runbookId, "eversys-eline");
  assert.equal(identifyBySerial("KB000276"), null);
  assert.equal(identifyBySerial("2109963"), null);
  assert.equal(identifyBySerial(null), null);
});

test("planUnits: the serial picks the model the text left open", () => {
  const match = (piece) => {
    for (const fn of [matchShotmaster, matchCameo, matchLegacyPlus, matchELine, matchEnigma]) {
      const h = fn(piece);
      if (h) return h;
    }
    return null;
  };
  const bySerial = (s) => identifyBySerial(s);
  const rows = [
    { id: 1, catalogModel: "Eversys e'4s", equipmentName: "Eversys e'4 Shotmaster Pro (Production)", serial: "1166500213400" },
    { id: 2, catalogModel: "Eversys Enigma e'4s ST", equipmentName: "Eversys Enigma Shotmaster", serial: "0116560022200000" },
  ];
  const [pro] = planUnits("Eversys e'4 Shotmaster Pro (Production)", rows, match, bySerial);
  assert.equal(pro.runbookId, "eversys-shotmaster");
  assert.equal(pro.model, "spro");
  const [named] = planUnits("Eversys Enigma Shotmaster", rows, match, bySerial);
  assert.equal(named.runbookId, "eversys-enigma"); // the plate says E'4s/ST
  assert.equal(named.model, "4s");
  const [noSerial] = planUnits("Eversys Shotmaster CT", [], match, bySerial);
  assert.equal(noSerial.model, "c");
});

test("X-Wide also recognises Katz's \"xtrawide\" spelling", async () => {
  const { matchE4XWide } = await import("../src/lib/ops/pm-runbook.ts");
  assert.deepEqual(matchE4XWide("E'4s xtrawide"), { model: "4s" });
});
