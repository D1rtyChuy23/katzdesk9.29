import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import {
  canEditRunbookDefinitions,
  canWriteRunbook,
  defaultConfig,
  intervalFromStyle,
  kitList,
  kitListText,
  matchE4XWide,
  normalizeConfig,
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

import { optionsKeyFor, planUnits } from "../src/lib/ops/pm-runbook-units.ts";

const matcher = (piece) => {
  const h = matchE4XWide(piece);
  return h ? { runbookId: "eversys-e4-xwide", model: h.model } : null;
};

test("units: one per X-Wide line, serials taken from the account's matching units", () => {
  const rows = [
    { catalogModel: "Eversys Enigma e'4m X-Wide Classic", equipmentName: "Eversys Enigma e'4m X-Wide Classic", serial: "SN 100" },
    { catalogModel: "Eversys Enigma e'4s X-Wide Classic", equipmentName: "Eversys Enigma e'4s X-Wide Classic", serial: "N/A" },
  ];
  const u = planUnits(
    "Eversys Enigma e'4s X-Wide Classic\nEversys Enigma e'4m X-Wide Classic\nGrinder Mazzer",
    rows,
    matcher,
  );
  assert.equal(u.length, 2);
  assert.equal(u[0].model, "4s");
  assert.match(u[0].unitKey, /^piece:.*#1$/);
  assert.equal(u[0].serialKey, null);
  assert.equal(u[1].unitKey, "sn100");
  assert.equal(u[1].serial, "SN 100");
});

test("units: two identical lines get distinct keys", () => {
  const u = planUnits("e'4m X-Wide\ne'4m X-Wide", [], matcher);
  assert.equal(new Set(u.map((x) => x.unitKey)).size, 2);
});

test("units: loose 'E4X-WIDE' text borrows the model from the account's unit", () => {
  const rows = [{ catalogModel: "Eversys Enigma e'4m X-Wide Classic", equipmentName: "e'4m X-Wide", serial: "A1" }];
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
