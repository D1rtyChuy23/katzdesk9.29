import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { kitKey, priceKits, summarizePrices, uncountedNote } from "../src/lib/ops/pm-runbook-prices.ts";
import {
  canEditRunbookDefinitions,
  canWriteRunbook,
  defaultConfig,
  historyInterval,
  intervalFromStyle,
  milestoneAge,
  nextFromHistory,
  recommendInterval,
  visitCarriesShorter,
  changeAddedKits,
  CHECK_KEY_RE,
  kitList,
  kitListText,
  kitListWithAdded,
  optionalKits,
  optionalKitsLeft,
  addedKitDetail,
  addedKitHistoryLine,
  addedKitSentence,
  addedKitStoredKeys,
  fittingStepKeys,
  kitHistoryMatches,
  stepsForVisit,
  unitHistory,
  visitBanners,
  visitConfig,
  isPmServiceRecord,
  matchE4XWide,
  moduleAssignmentBlock,
  moduleBenchConfig,
  moduleRunbookGroups,
  moduleServiceOptions,
  moduleServiceView,
  moduleServiceWorkLines,
  applySharedTick,
  checksForModuleSheet,
  checkSerialKey,
  MODULE_NOT_ON_PM,
  moduleOnThisPm,
  moduleTypeFit,
  normalizeConfig,
  parseAddedKits,
  platformFit,
  pmServiceRecord,
  applicableModules,
  combinedVisitNotes,
  modulesNotTakenReason,
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
  assert.equal(intervalFromStyle(def, "24 month PM"), "12");
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

test("La Marzocco style, history and combined-visit text", () => {
  const linea = parseRunbookDefinition(JSON.parse(readFileSync(new URL("../src/lib/ops/runbooks/la-marzocco-linea.json", import.meta.url), "utf8")));
  assert.equal(intervalFromStyle(linea, "9 month PM"), "3");
  assert.equal(intervalFromStyle(linea, "3 month PM"), "3");
  assert.equal(intervalFromStyle(linea, "6 month PM"), "6");
  const next = (...prior) => nextFromHistory(linea, prior)?.id;
  assert.equal(next("3"), "6");
  assert.equal(next("3", "6"), "3");
  assert.equal(next("3", "6", "3"), "12");
  assert.equal(next("3", "6", "3", "12"), "3");
  assert.equal(next("6"), "3");
  assert.equal(next("12", "6"), "3");
  assert.equal(next("6", "3"), "12");
  assert.equal(next("12", "6", "3"), "12");
  assert.equal(combinedVisitNotes(def).history, ", the 12 + 36 together visit");
  assert.equal(combinedVisitNotes(def).recommended, " (12 + 36 together)");
  assert.equal(combinedVisitNotes(linea).history, "");
  assert.equal(combinedVisitNotes(linea).recommended, "");
  assert.equal(recommendInterval(linea, "2026-05-18", new Date("2026-10-18T15:00:00Z"))?.combined, false);
  assert.equal(nextFromHistory(linea, ["3"])?.combined, false);
  assert.equal(recommendInterval(def, "2023-03-10", new Date("2026-03-20T00:00:00Z"))?.combined, true);
  assert.equal(nextFromHistory(def, ["12", "12"])?.combined, true);
  const gs3 = parseRunbookDefinition(JSON.parse(readFileSync(new URL("../src/lib/ops/runbooks/la-marzocco-gs3.json", import.meta.url), "utf8")));
  assert.equal(visitCarriesShorter(gs3, "12"), true);
  assert.equal(modulesNotTakenReason(linea, "pb", false), "Linea PB does not take Eversys modules.");
  assert.equal(modulesNotTakenReason(def, "4s", true), null);
});

test("the default 12-month style waits for the install date on La Marzocco", () => {
  const linea = parseRunbookDefinition(JSON.parse(readFileSync(new URL("../src/lib/ops/runbooks/la-marzocco-linea.json", import.meta.url), "utf8")));
  const now = new Date("2026-10-18T15:00:00Z");
  const pm = (install, style, earlier = []) => visitConfig(linea, { style, installDate: install, earlierIntervals: earlier, model: "pb", now }).pm;
  assert.equal(pm("2026-07-18", "12 month PM"), "3");
  assert.equal(pm("2026-04-18", "12 month PM"), "6");
  assert.equal(pm(null, "12 month PM", ["3"]), "6");
  assert.equal(pm(null, "12 month PM", ["3", "6", "3"]), "12");
  assert.equal(historyInterval(linea, null, "12 month PM"), null);
  assert.equal(historyInterval(linea, "6", "12 month PM"), "6");
  assert.equal(historyInterval(def, null, "12 month PM"), "12");
  assert.equal(pm("2026-07-18", "6 month PM"), "6");
  assert.equal(pm(null, "12 month PM"), "12");
  const eversys = (style) => visitConfig(def, { style, installDate: "2023-10-10", model: "4s", now }).pm;
  assert.equal(eversys("12 month PM"), "12");
  assert.equal(eversys("6 month PM"), "36");
  assert.equal(milestoneAge(3), "month 3");
  assert.equal(milestoneAge(36), "year 3");
  assert.equal(recommendInterval(linea, "2026-05-31", new Date("2026-10-01T00:00:00Z"))?.id, "3");
  assert.equal(recommendInterval(linea, "2026-05-01", new Date("2026-09-30T00:00:00Z"))?.id, "6");
  const oldNext = (prior) => {
    const ids = [12, 36];
    const short = 12;
    const long = 36;
    let run = 0;
    for (const raw of prior) {
      const n = Number(raw);
      run = n >= long && long > short ? 0 : run + 1;
    }
    const mark = (run + 1) * short;
    return String([...ids].reverse().find((id) => mark % id === 0) ?? short);
  };
  const sequences = [[]];
  for (let len = 1; len <= 6; len++) {
    const next = [];
    for (const seq of sequences) for (const id of ["12", "36"]) next.push([...seq, id]);
    sequences.push(...next);
  }
  for (const seq of sequences) {
    if (!seq.length) continue;
    assert.equal(nextFromHistory(def, seq)?.id, oldNext(seq), seq.join(","));
  }
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

test("a module runbook is that type's kits and steps, and only the checked kits are logged", () => {
  assert.equal(moduleRunbookGroups(def, "Pump Module"), null);
  assert.equal(moduleServiceView(def, cfg({ model: "4s" }), "Pump Module"), null);
  const brew = moduleServiceView(def, cfg({ model: "4s", pm: "12" }), "Brew Module");
  assert.ok(brew.kits.some((k) => k.module === "Brew module"));
  assert.equal(brew.kits.some((k) => k.module === "Milk module"), false);
  const milk = moduleServiceView(def, moduleBenchConfig(def, "Milk Module", "12", {}), "Milk Module");
  assert.ok(milk.kits.some((k) => k.ev === "EV108339"));
  assert.equal(milk.kits.some((k) => k.module === "Frame"), false);
  assert.equal(moduleServiceView(def, cfg({ model: "4s", choco: "no" }), "Powder Module").kits.length, 0);
  const powder = moduleServiceView(def, cfg({ model: "4s", choco: "1", pm: "12" }), "Powder Module");
  assert.ok(powder.kits.some((k) => k.ev === "EV109706"));
  assert.deepEqual(moduleServiceOptions(def, "Powder Module").map((o) => o.key), ["choco"]);
  const lines = moduleServiceWorkLines(powder.kits, ["kit:EV109706"], { EV109706: "EVER109706" });
  assert.deepEqual(lines.map((l) => l.item), ["EVER109706"]);
  assert.equal(moduleServiceWorkLines(powder.kits, [], {}).length, 0);
  assert.equal(moduleServiceWorkLines(powder.kits, ["kit:EV109706"], {}).map((l) => l.item)[0], "EV109706");
});

test("an on-site module tick is the PM unit's tick, and completion logs only that module", () => {
  const brew = moduleServiceView(def, cfg({ model: "4s", pm: "12" }), "Brew Module");
  const milk = moduleServiceView(def, moduleBenchConfig(def, "Milk Module", "12", {}), "Milk Module");
  const brewKey = `kit:${brew.kits[0].ev}`;
  const milkKey = `kit:${milk.kits[0].ev}`;
  const fromModule = applySharedTick([], brewKey, true, "Ana", "t1");
  assert.deepEqual(checksForModuleSheet("pm", [brewKey], fromModule, []), [{ key: brewKey, who: "Ana", at: "t1" }]);
  const fromUnit = applySharedTick(fromModule, brewKey, true, "Ben", "t2");
  assert.equal(checksForModuleSheet("pm", [brewKey], fromUnit, [])[0].who, "Ana");
  assert.equal(checkSerialKey("SN1"), "SN1");
  assert.equal(checkSerialKey("acct:4"), null);
  const both = [brewKey, milkKey];
  const brewLogged = moduleServiceWorkLines(brew.kits, both, {});
  assert.deepEqual(brewLogged.map((l) => l.item), [brew.kits[0].ev]);
  assert.equal(brewLogged.some((l) => l.item === milk.kits[0].ev), false);
  assert.equal(moduleOnThisPm([10, 11], 11), true);
  assert.equal(moduleOnThisPm([10], 11), false);
  assert.equal(moduleOnThisPm([10], null), false);
  assert.equal(MODULE_NOT_ON_PM, "This module is not on a unit of this PM.");
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

test("optional kits are the 36-month kits missing from this visit", () => {
  const twelve = cfg({ model: "4s", pm: "12", amer: "yes" });
  const opt = optionalKits(def, twelve);
  const amer = opt.find((k) => k.ev === "EV109590");
  assert.ok(amer);
  assert.equal(amer.q, 2);
  assert.equal(optionalKits(def, cfg({ model: "4s", pm: "36", amer: "yes" })).length, 0);
  const added = kitListWithAdded(def, twelve, ["EV109590"]);
  assert.equal(added.find((k) => k.ev === "EV109590")?.added, true);
  assert.ok(added.some((k) => k.ev === "EV117077" && !k.added));
  const priced = priceKits(added, {
    [kitKey("EV109590")]: { sku: "EVER109590", name: null, description: null, mfrPart: null, rate: 5, active: true, hidden: false },
  });
  const summary = summarizePrices(priced);
  assert.equal(summary.total, 10);
  assert.match(uncountedNote(summary), /of \d+ kits not counted/);
  const text = kitListText(def, twelve, undefined, priced, ["EV109590"]);
  assert.match(text, /Hydraulic module\nEV109590 x2 {2}Hydraulic add-on, adjustable Americano \(added\)/);
  assert.match(text, /Total at sell price: \$10\.00/);
  assert.equal(changeAddedKits(def, twelve, [], "NOPE", true).ok, false);
  assert.equal(changeAddedKits(def, twelve, [], "EV117077", true).ok, false);
  const refusedPm = changeAddedKits(def, twelve, [], "EV117077", true);
  assert.equal(refusedPm.ok, false);
  if (!refusedPm.ok) assert.match(refusedPm.reason, /not optional for this PM/);
  const refusedService = changeAddedKits(def, twelve, [], "EV117077", true, undefined, "service");
  assert.equal(refusedService.ok, false);
  if (!refusedService.ok) assert.match(refusedService.reason, /not optional for this service/);
  const on = changeAddedKits(def, twelve, [], "EV109590", true);
  assert.equal(on.ok && on.dropTick, false);
  const off = changeAddedKits(def, twelve, ["EV109590"], "EV109590", false);
  assert.deepEqual(off.ok && off.added, []);
  assert.equal(off.ok && off.dropTick, true);
  const gone = changeAddedKits(def, twelve, [], "EV109590", false);
  assert.equal(gone.ok && gone.changed, false);
  assert.equal(gone.ok && gone.dropTick, false);
  const base = changeAddedKits(def, cfg({ model: "4s", pm: "36", amer: "yes" }), ["EV109586"], "EV109586", false);
  assert.equal(base.ok && base.dropTick, false);
  assert.equal(base.ok && base.changed, true);
  const kept = changeAddedKits(def, cfg({ model: "4s", pm: "12", amer: "no" }), ["EV109590"], "EV109586", true);
  assert.deepEqual(kept.ok && kept.added, ["EV109590", "EV109586"]);
  const ordered = kitListWithAdded(def, twelve, ["EV109586", "EV109590"]).map((k) => k.ev);
  assert.ok(ordered.indexOf("EV117077") < ordered.indexOf("EV109586"));
  assert.ok(ordered.indexOf("EV109586") < ordered.indexOf("EV109590"));
  assert.ok(ordered.indexOf("EV109590") < ordered.indexOf("EV108389"));
  assert.equal(stepsForVisit(def, twelve, []).some((g) => g.items.some((s) => s.id === "hyd-amer")), false);
  const withStep = stepsForVisit(def, twelve, ["EV109590"]);
  assert.ok(withStep.some((g) => g.items.some((s) => s.id === "hyd-amer")));
  const hydraulic = moduleServiceView(def, twelve, "Hydraulic Module", ["EV109590"]);
  assert.ok(hydraulic?.steps.some((g) => g.items.some((s) => s.id === "hyd-amer")));
  assert.match(visitBanners(def, twelve, []).map((b) => b.text).join("\n"), /only 12-month kits are listed/);
  const banner = visitBanners(def, twelve, ["EV109590"]).map((b) => b.text).join("\n");
  assert.match(banner, /12-month kits are listed, plus added kits EV109590/);
  assert.doesNotMatch(banner, /only 12-month kits are listed/);
  const visit = visitConfig(def, { savedInterval: null, style: "36 month PM", model: "4s", options: { amer: "yes" } });
  assert.equal(visit.pm, "36");
  assert.equal(optionalKits(def, visit).length, 0);
  const onSite = moduleServiceView(def, visit, "Hydraulic Module", []);
  assert.equal(optionalKitsLeft(def, visit, [], onSite?.groups).length, 0);
  assert.equal(addedKitSentence(def, "EV109590", true), "Added EV109590 Hydraulic add-on, adjustable Americano (36-month kit)");
  assert.equal(addedKitSentence(def, "EV109590", false), "Removed EV109590 Hydraulic add-on, adjustable Americano (36-month kit)");
  const detail = addedKitDetail(addedKitSentence(def, "EV109590", true), "acct:4", "piece:eversys:1");
  assert.deepEqual(addedKitStoredKeys(detail), ["acct:4", "piece:eversys:1"]);
  assert.equal(addedKitHistoryLine("kit added", detail), "Added EV109590 Hydraulic add-on, adjustable Americano (36-month kit)");
  assert.equal(addedKitHistoryLine("kit removed", "piece:eversys:1: EV109590 Hydraulic add-on"), "Removed EV109590 Hydraulic add-on");
  const brewOnly = changeAddedKits(def, twelve, [], "EV109590", true, ["Brew module"]);
  assert.equal(brewOnly.ok, false);
  const offered = optionalKits(def, cfg({ model: "4s", pm: "12", tea: "auto", wand: "1", amer: "no" }));
  assert.equal(offered.find((k) => k.ev === "EV109586")?.q, 2);
  assert.ok(offered.some((k) => k.ev === "EV108391"));
  assert.ok(offered.some((k) => k.ev === "EV109568"));
});

test("a kit that names its visit is never optional", () => {
  const mini = {
    intervals: [
      { id: "3", label: "3-month PM" },
      { id: "6", label: "6-month PM" },
      { id: "12", label: "12-month PM" },
    ],
    kits: [
      { ev: "K12", name: "Visit kit", module: "Group", interval: 12, qty: 1, when: { pm: ["12"] } },
      { ev: "P", name: "Part", module: "Group", interval: 12, qty: 1 },
    ],
    steps: [],
  };
  assert.deepEqual(optionalKits(mini, { model: "m", pm: "3" }).map((k) => k.ev), ["P"]);
});

test("removing an added kit clears the fitting step it brought, and a base kit clears none", () => {
  const twelve = cfg({ model: "4s", pm: "12", amer: "yes" });
  const thirty = cfg({ model: "4s", pm: "36", amer: "yes" });
  assert.deepEqual(fittingStepKeys(def, twelve, "EV109586"), ["step:hyd-kit"]);
  assert.deepEqual(fittingStepKeys(def, thirty, "EV109586"), []);
});

test("history for a unit is newest first, and one machine does not show the other's kit lines", () => {
  const A = { unitKey: "acct:5", pieceKey: "piece:eversys e4s x wide#1" };
  const B = { unitKey: "piece:eversys e4s x wide#1", pieceKey: "piece:eversys e4s x wide#2" };
  const note = (unit, text, at) => ({ who: "Chuy", action: "kit added", detail: addedKitDetail(text, unit.unitKey, unit.pieceKey), at });
  const mon = new Date("2026-10-12T15:00:00Z");
  const fri = new Date("2026-10-16T15:00:00Z");
  const sat = new Date("2026-10-17T15:00:00Z");
  const days = unitHistory(A, [note(A, "mon", mon), note(A, "sat", sat), note(A, "fri", fri)], []);
  assert.deepEqual(days.map((l) => l.detail), ["Added sat", "Added fri", "Added mon"]);
  assert.ok(days.every((l) => /^\d{4}-\d{2}-\d{2}T/.test(l.at)));
  const older = Array.from({ length: 22 }, (_, i) => note(A, `old ${i}`, new Date(Date.UTC(2026, 0, i + 1))));
  const kept = unitHistory(A, [...older, note(A, "mon", mon), note(A, "fri", fri), note(A, "sat", sat)], []);
  assert.equal(kept.length, 20);
  assert.deepEqual(kept.slice(0, 3).map((l) => l.detail), ["Added sat", "Added fri", "Added mon"]);
  const shared = [note(A, "on A", sat), note(B, "on B", fri)];
  assert.deepEqual(unitHistory(A, shared, []).map((l) => l.detail), ["Added on A"]);
  assert.deepEqual(unitHistory(B, shared, []).map((l) => l.detail), ["Added on B"]);
  assert.equal(kitHistoryMatches(A, `piece:eversys e4s x wide#1: EV109586 name`), false);
  assert.equal(kitHistoryMatches(B, `piece:eversys e4s x wide#1: EV109586 name`), true);
  const busy = [
    ...Array.from({ length: 40 }, (_, i) => note(A, `A ${i}`, new Date(Date.UTC(2026, 9, 18, 0, i)))),
    note(B, "B1", new Date("2026-10-01T00:00:00Z")),
    note(B, "B2", new Date("2026-10-02T00:00:00Z")),
    note(B, "B3", new Date("2026-10-03T00:00:00Z")),
  ];
  assert.deepEqual(unitHistory(B, busy, []).map((l) => l.detail).sort(), ["Added B1", "Added B2", "Added B3"]);
});

test("a kit note made before a twin is logged stays on that machine", () => {
  const text = "e'4m X-Wide\ne'4m X-Wide";
  const before = planUnits(text, [], matcher);
  const note = addedKitDetail("Added EV109586 Hydraulic module Standard (36-month kit)", before[0].unitKey, before[0].pieceKey);
  const after = planUnits(text, [{ id: 5, catalogModel: "e'4m X-Wide", equipmentName: "e'4m X-Wide", serial: "SN5" }], matcher);
  assert.equal(after[0].unitKey, "acct:5");
  const rows = [{ who: "Chuy", action: "kit added", detail: note, at: "2026-10-01T00:00:00Z" }];
  assert.equal(unitHistory(after[0], rows, []).length, 1);
  assert.equal(unitHistory(after[1], rows, []).length, 0);
  assert.equal(kitHistoryMatches({ unitKey: "acct:5", pieceKey: "piece:x#1" }, addedKitDetail("Added EV109586", "piece:x#1", "piece:x#1")), true);
  assert.equal(kitHistoryMatches({ unitKey: before[0].unitKey, pieceKey: after[1].pieceKey }, note), false);
});

test("no step names two kit numbers that are optional on some visit", () => {
  const dir = new URL("../src/lib/ops/runbooks/", import.meta.url);
  const defs = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => parseRunbookDefinition(JSON.parse(readFileSync(new URL(name, dir), "utf8"))));
  const configsOf = (rb) => {
    const axes = [
      ["model", rb.models.map((m) => m.id)],
      ["pm", rb.intervals.map((i) => i.id)],
      ...rb.options.map((o) => [o.key, o.choices.map((c) => c.val)]),
    ];
    const out = [];
    const walk = (i, cur) => {
      if (i === axes.length) {
        out.push(cur);
        return;
      }
      const [key, vals] = axes[i];
      for (const v of vals) walk(i + 1, { ...cur, [key]: v });
    };
    walk(0, {});
    return out;
  };
  for (const rb of defs) {
    const optional = new Set();
    for (const config of configsOf(rb)) for (const kit of optionalKits(rb, config)) optional.add(kit.ev);
    for (const group of rb.steps) {
      for (const step of group.items) {
        const blob = `${step.text} ${step.ref ?? ""}`;
        const named = [...optional].filter((ev) => blob.includes(ev));
        assert.ok(named.length <= 1, `${rb.id} ${step.id} names ${named.join(", ")}`);
      }
    }
  }
});

test("every kit number can be stored and ticked, including a slash", () => {
  const dir = new URL("../src/lib/ops/runbooks/", import.meta.url);
  const defs = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => parseRunbookDefinition(JSON.parse(readFileSync(new URL(name, dir), "utf8"))));
  assert.ok(defs.length >= 6);
  for (const def of defs) {
    for (const kit of def.kits) {
      assert.deepEqual(parseAddedKits([kit.ev]), [kit.ev], `${def.id} ${kit.ev}`);
      assert.equal(CHECK_KEY_RE.test(`kit:${kit.ev}`), true, `${def.id} kit:${kit.ev}`);
    }
  }
});
