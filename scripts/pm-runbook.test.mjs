import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import {
  canEditRunbookDefinitions,
  canWriteRunbook,
  defaultConfig,
  intervalFromStyle,
  nextFromHistory,
  recommendInterval,
  kitList,
  kitListText,
  isPmServiceRecord,
  matchE4XWide,
  moduleAssignmentBlock,
  moduleTypeFit,
  normalizeConfig,
  platformFit,
  pmServiceRecord,
  applicableModules,
  stepList,
  totalKits,
} from "../src/lib/ops/pm-runbook.ts";

const raw = JSON.parse(readFileSync(new URL("../src/lib/ops/runbooks/eversys-e4-xwide.json", import.meta.url), "utf8"));
const def = parseRunbookDefinition(raw);
const cfg = (over) => ({ ...defaultConfig(def), ...over });
const line = (lines, ev) => lines.find((l) => l.ev === ev);

test("E'4S 12-month: 3 kit lines, 4 kits", () => {
  const k = kitList(def, cfg({ model: "4s", pm: "12" }));
  assert.deepEqual(k.map((l) => l.ev), ["EV117077", "EV108389", "EV108354"]);
  assert.equal(totalKits(k), 4);
});

test("E'4MS 12-month one wand: 5 lines, 10 kits, EV108354 x3 made up of wands + milk option", () => {
  const k = kitList(def, cfg({ model: "4ms", pm: "12", wand: "1", steps: "0" }));
  assert.equal(k.length, 5);
  assert.equal(totalKits(k), 10);
  const steam = line(k, "EV108354");
  assert.equal(steam.q, 3);
  assert.deepEqual(steam.parts, [
    { q: 1, label: "steam wand (#1)" },
    { q: 2, label: "milk option (#3/#4)" },
  ]);
});

test("E'4MS 36-month fully optioned: 15 lines, 26 kits, EV108354 x4", () => {
  const k = kitList(def, cfg({ model: "4ms", pm: "36", wand: "2", tea: "auto", choco: "2", amer: "yes", steps: "1" }));
  assert.equal(k.length, 15);
  assert.equal(totalKits(k), 26);
  assert.equal(line(k, "EV108354").q, 4);
});

test("12-month never lists 36-month kits", () => {
  const k = kitList(def, cfg({ model: "4ms", pm: "12", wand: "2", choco: "2", amer: "yes" }));
  assert.ok(k.every((l) => l.interval <= 12));
});

test("steps follow model, interval and options", () => {
  const ids = (c) => stepList(def, c).flatMap((g) => g.items.map((s) => s.id));
  assert.ok(!ids(cfg({ model: "4s", pm: "12" })).includes("milk-kit"));
  assert.ok(ids(cfg({ model: "4ms", pm: "36" })).includes("milk-kit36"));
  assert.ok(ids(cfg({ choco: "1" })).includes("choco-kit"));
  assert.ok(!ids(cfg({ choco: "1", model: "4s" })).includes("choco-2"));
});

test("copy text lists each kit with quantity and the split", () => {
  const t = kitListText(def, cfg({ model: "4ms", pm: "12" }), "Cafe Uno");
  assert.match(t, /^Cafe Uno\nE'4MS X-Wide \(milk\), 12-month PM/);
  assert.match(t, /EV108354 x3 {2}Steam add-on \(ODE valve 32 mm\) \(1 x steam wand \(#1\) \+ 2 x milk option \(#3\/#4\)\)/);
  assert.match(t, /5 kit lines, 10 kits in total/);
});

test("normalizeConfig drops values the definition does not offer", () => {
  const c = normalizeConfig(def, { wand: "2", tea: "bogus", extra: "x" });
  assert.equal(c.wand, "2");
  assert.equal(c.tea, "auto");
  assert.equal(c.extra, undefined);
});

test("schema rejects unknown condition keys, bad values, duplicate step ids", () => {
  const bad = (mut) => {
    const c = structuredClone(raw);
    mut(c);
    assert.throws(() => parseRunbookDefinition(c));
  };
  bad((c) => (c.kits[0].when = { nope: ["1"] }));
  bad((c) => (c.kits[0].when = { model: ["9z"] }));
  bad((c) => (c.steps[0].items[1].id = c.steps[0].items[0].id));
  bad((c) => delete c.kits[0].ev);
  bad((c) => (c.kits[0].qty = { by: "ghost", map: {} }));
});

test("recognises X-Wide spellings", () => {
  assert.deepEqual(matchE4XWide("Eversys Enigma e'4m X-Wide Classic"), { model: "4ms" });
  assert.deepEqual(matchE4XWide("Eversys Enigma e'4s X-Wide Super Traditional"), { model: "4s" });
  assert.deepEqual(matchE4XWide("E4X-WIDE"), { model: null });
  assert.equal(matchE4XWide("Eversys Cameo C'2MS"), null);
  assert.equal(matchE4XWide("Eversys Enigma e'4m Classic"), null);
});

test("interval from PM style", () => {
  assert.equal(intervalFromStyle(def, "36 month PM"), "36");
  assert.equal(intervalFromStyle(def, "12 month PM"), "12");
  assert.equal(intervalFromStyle(def, "6 month PM"), null);
  assert.equal(intervalFromStyle(def, "Grinder PM"), null);
});

test("service and admin write; sales and warehouse read only; definitions admin only", () => {
  assert.equal(canWriteRunbook("service", false), true);
  assert.equal(canWriteRunbook("sales", false), false);
  assert.equal(canWriteRunbook("warehouse", false), false);
  assert.equal(canWriteRunbook(null, true), true);
  assert.equal(canEditRunbookDefinitions("service", false), false);
  assert.equal(canEditRunbookDefinitions("admin", false), true);
});

import { optionsKeyFor, planUnits, pmCompletionRefusal, unloggedUnitLines } from "../src/lib/ops/pm-runbook-units.ts";

const matcher = (piece) => {
  const h = matchE4XWide(piece);
  return h ? { runbookId: "eversys-e4-xwide", model: h.model } : null;
};

test("units: one per X-Wide line, serials taken from the account's matching units", () => {
  const rows = [
    { id: 7, catalogModel: "Eversys Enigma e'4m X-Wide Classic", equipmentName: "Eversys Enigma e'4m X-Wide Classic", serial: "SN 100" },
    { id: 8, catalogModel: "Eversys Enigma e'4s X-Wide Classic", equipmentName: "Eversys Enigma e'4s X-Wide Classic", serial: "N/A" },
  ];
  const u = planUnits(
    "Eversys Enigma e'4s X-Wide Classic\nEversys Enigma e'4m X-Wide Classic\nGrinder Mazzer",
    rows,
    matcher,
  );
  assert.equal(u.length, 2);
  assert.equal(u[0].model, "4s");
  assert.equal(u[0].unitKey, "acct:8");
  assert.equal(u[0].serialKey, null);
  assert.equal(u[0].optionsKey, "acct:8");
  assert.equal(u[1].unitKey, "acct:7");
  assert.equal(u[1].optionsKey, "sn100");
  assert.equal(u[1].serial, "SN 100");
});

test("units: two identical lines get distinct keys", () => {
  const u = planUnits("e'4m X-Wide\ne'4m X-Wide", [], matcher);
  assert.equal(new Set(u.map((x) => x.unitKey)).size, 2);
});

test("units: loose 'E4X-WIDE' text borrows the model from the account's unit", () => {
  const rows = [{ id: 3, catalogModel: "Eversys Enigma e'4m X-Wide Classic", equipmentName: "e'4m X-Wide", serial: "A1" }];
  const [u] = planUnits("E4X-WIDE", rows, matcher);
  assert.equal(u.model, "4ms");
  assert.equal(u.serialKey, "a1");
});

test("options key is the same for a warehouse serial and an account serial", () => {
  assert.equal(optionsKeyFor("  E4-123 456 "), optionsKeyFor("e4-123456"));
  assert.equal(optionsKeyFor("#E4-123456"), "e4-123456");
  assert.equal(optionsKeyFor("N/A"), null);
  assert.equal(optionsKeyFor(""), null);
});

test("units: a line with no account match keeps options with this PM only", () => {
  const [u] = planUnits("e'4s X-Wide", [], matcher);
  assert.match(u.unitKey, /^piece:/);
  assert.equal(u.optionsKey, null);
});

test("units: adding a serial keeps the PM-level key and moves the options key from the account id to the serial", () => {
  const row = { id: 9, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: null };
  const [before] = planUnits("e'4m X-Wide", [row], matcher);
  const [after] = planUnits("e'4m X-Wide", [{ ...row, serial: "E4-777" }], matcher);
  assert.equal(before.unitKey, after.unitKey);
  assert.equal(before.optionsKey, "acct:9");
  assert.equal(after.optionsKey, "e4-777");
});

test("units: same text twice at an account maps to two distinct account units", () => {
  const rows = [
    { id: 1, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: null },
    { id: 2, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: null },
  ];
  const u = planUnits("e'4m X-Wide\ne'4m X-Wide", rows, matcher);
  assert.deepEqual(u.map((x) => x.unitKey), ["acct:1", "acct:2"]);
});

test("recommended interval follows the install anniversary: 12, 12, 36, 12, 12, 36", () => {
  const at = (iso) => recommendInterval(def, "2023-03-10", new Date(iso))?.id;
  assert.equal(at("2024-03-15T00:00:00Z"), "12"); // year 1
  assert.equal(at("2025-03-01T00:00:00Z"), "12"); // year 2
  assert.equal(at("2026-03-20T00:00:00Z"), "36"); // year 3
  assert.equal(at("2027-04-01T00:00:00Z"), "12");
  assert.equal(at("2029-03-01T00:00:00Z"), "36"); // year 6
});

test("recommended interval: no or future install date gives no recommendation", () => {
  assert.equal(recommendInterval(def, null), null);
  assert.equal(recommendInterval(def, "not a date"), null);
  assert.equal(recommendInterval(def, "2030-01-01", new Date("2026-10-15T00:00:00Z")), null);
});

test("planUnits carries the account unit's install date", () => {
  const rows = [{ id: 1, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: null, installDate: "2023-03-10" }];
  assert.equal(planUnits("e'4m X-Wide", rows, matcher)[0].installDate, "2023-03-10");
});

test("Eversys cycle: year 1 and 2 are 12, year 3 is 12 + 36 together", () => {
  const r = (iso) => recommendInterval(def, "2023-03-10", new Date(iso));
  assert.deepEqual([r("2024-03-10T00:00:00Z").year, r("2024-03-10T00:00:00Z").combined], [1, false]);
  assert.equal(r("2025-03-10T00:00:00Z").combined, false);
  assert.deepEqual([r("2026-03-10T00:00:00Z").id, r("2026-03-10T00:00:00Z").combined], ["36", true]);
});

test("no install date: next interval follows the last full PMs", () => {
  const n = (...p) => nextFromHistory(def, p)?.id;
  assert.equal(nextFromHistory(def, []), null);
  assert.equal(n("12"), "12");
  assert.equal(n("12", "12"), "36");
  assert.equal(n("12", "12", "36"), "12");
  assert.equal(n("12", "12", "36", "12"), "12");
  assert.equal(n("12", "12", "36", "12", "12"), "36");
  assert.equal(n("36"), "12");
  assert.equal(nextFromHistory(def, ["12", "12"])?.combined, true);
});

test("units: pieceKey is the key a line had before it matched an account unit", () => {
  const text = "e'4m X-Wide\ne'4s X-Wide\ne'4m X-Wide";
  const before = planUnits(text, [], matcher);
  const rows = [
    { id: 4, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: null },
    { id: 5, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: "S-1" },
  ];
  const after = planUnits(text, rows, matcher);
  assert.deepEqual(after.map((u) => u.pieceKey), before.map((u) => u.unitKey));
  assert.deepEqual(after.map((u) => u.unitKey), ["acct:4", before[1].unitKey, "acct:5"]);
});

test("a PM cannot be completed while a runbook line has no account unit or no serial", () => {
  const none = planUnits("e'4m X-Wide\nLa Marzocco GB5", [], matcher);
  assert.deepEqual(unloggedUnitLines(none), ["e'4m X-Wide"]);
  assert.match(pmCompletionRefusal(none), /e'4m X-Wide/);
  const noSerial = planUnits("e'4s X-Wide", [{ id: 8, catalogModel: "e'4s X-Wide", equipmentName: "e'4s X-Wide", serial: "N/A", installDate: "2024-01-01" }], matcher);
  assert.equal(noSerial[0].accountId, 8);
  assert.match(pmCompletionRefusal(noSerial), /e'4s X-Wide/);
  const logged = planUnits("e'4m X-Wide", [{ id: 7, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: "SN 100" }], matcher);
  assert.equal(pmCompletionRefusal(logged), null);
  assert.equal(pmCompletionRefusal(planUnits("La Marzocco GB5", [], matcher)), null);
});

test("a pinned account unit is used for that line and is not taken by an earlier line", () => {
  const text = "e'4m X-Wide\ne'4s X-Wide";
  const bare = planUnits(text, [], matcher);
  const rows = [
    { id: 1, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: "A" },
    { id: 2, catalogModel: "Other grinder", equipmentName: "Other grinder", serial: "B" },
  ];
  const pinned = { [bare[1].pieceKey]: 1 };
  const units = planUnits(text, rows, matcher, pinned);
  assert.equal(units[0].accountId, null);
  assert.equal(units[1].accountId, 1);
  assert.equal(units[1].serial, "A");
  assert.match(pmCompletionRefusal(units), /e'4m X-Wide/);
  assert.doesNotMatch(pmCompletionRefusal(units) ?? "", /e'4s/);
  assert.equal(units[1].pieceKey, bare[1].pieceKey);
});

test("E'4S has no milk module or milk frame; E'4MS has both", () => {
  const s12 = applicableModules(def, cfg({ model: "4s", pm: "12", choco: "no" }));
  const s36 = applicableModules(def, cfg({ model: "4s", pm: "36", choco: "no" }));
  assert.deepEqual(s12, s36);
  for (const name of ["Brew module", "Hydraulic module", "Steam module", "Grinder module"]) {
    assert.ok(s12.includes(name), name);
  }
  assert.equal(s12.includes("Milk module"), false);
  assert.equal(s12.includes("Milk module V2"), false);
  assert.equal(s12.includes("Frame"), false);
  assert.equal(s12.includes("E'choco"), false);
  const ms = applicableModules(def, cfg({ model: "4ms", pm: "12", choco: "1" }));
  assert.ok(ms.includes("Milk module"));
  assert.ok(ms.includes("Frame"));
  assert.ok(ms.includes("E'choco"));
  assert.equal(moduleTypeFit(def, cfg({ model: "4s" }), "Milk Module").ok, false);
  assert.equal(moduleTypeFit(def, cfg({ model: "4s" }), "Milk Module").reason, "E'4S X-Wide has no milk module");
  assert.equal(moduleTypeFit(def, cfg({ model: "4ms" }), "Milk Module").ok, true);
  assert.equal(moduleTypeFit(def, cfg({ model: "4s" }), "Brew Module").ok, true);
  assert.equal(moduleTypeFit(def, cfg({ model: "4s" }), "Pump Module").ok, true);
  assert.equal(moduleTypeFit(def, cfg({ model: "4s", choco: "no" }), "Powder Module").ok, false);
  assert.match(moduleTypeFit(def, cfg({ model: "4s", choco: "no" }), "Powder Module").reason ?? "", /has no powder module/);
  assert.equal(moduleTypeFit(def, cfg({ model: "4s", choco: "1" }), "Powder Module").ok, true);
  assert.equal(moduleTypeFit(def, cfg({ model: "4ms", choco: "2" }), "Powder Module").ok, true);
  assert.equal(moduleTypeFit(def, cfg({ model: "4ms" }), "Powder Module", []).ok, true);
  assert.equal(moduleTypeFit(def, cfg({ model: "4s" }), "Powder Module", []).ok, true);
  assert.equal(moduleTypeFit(def, cfg({ model: "4s" }), "Milk Module", []).ok, false);
  assert.equal(moduleTypeFit(def, cfg({ model: "4ms", choco: "no" }), "Powder Module", ["choco"]).ok, false);
  assert.equal(moduleTypeFit(def, cfg({ model: "4ms", choco: "no" }), "Powder Module", ["choco"]).reason, "E'4MS X-Wide (milk) has no powder module");
  assert.equal(platformFit(["Enigma / e'Line"], "Enigma / e'Line", "E'4S X-Wide").ok, true);
  assert.equal(platformFit(["Enigma / e'Line"], "Cameo", "E'4S X-Wide").reason, "E'4S X-Wide is Enigma / e'Line, not Cameo.");
  const blocked = moduleAssignmentBlock(def, cfg({ model: "4s" }), "Milk Module", "Cameo", ["Enigma / e'Line"]);
  assert.match(blocked ?? "", /not Cameo/);
  assert.equal(moduleAssignmentBlock(def, cfg({ model: "4ms" }), "Milk Module", "Enigma / e'Line", ["Enigma / e'Line"]), null);
});

test("a completed PM writes one service record and a later edit is not a second copy", () => {
  const text = pmServiceRecord({
    pmId: 12,
    modelLabel: "E'4MS X-Wide",
    intervalLabel: "12-month PM",
    options: [{ label: "Steam wands", value: "1" }],
    kits: [{ ev: "EV117077", q: 2, name: "Brew PM kit" }],
    steps: ["Grease the brew group"],
  });
  assert.match(text, /^PM #12 completed\. E'4MS X-Wide, 12-month PM\./);
  assert.match(text, /Options: Steam wands: 1\./);
  assert.match(text, /Kits: 2 x EV117077 Brew PM kit\./);
  assert.match(text, /Steps done:\n- Grease the brew group$/);
  assert.equal(isPmServiceRecord("pm service", text, 12), true);
  assert.equal(isPmServiceRecord("pm service", text, 123), false);
  assert.equal(isPmServiceRecord("options changed", text, 12), false);
  assert.equal(pmServiceRecord({ pmId: 3, modelLabel: "E'4S X-Wide", intervalLabel: "36-month PM", options: [], kits: [], steps: [] }), "PM #3 completed. E'4S X-Wide, 36-month PM.\nOptions: none.\nKits: none.\nSteps done: none.");
});
