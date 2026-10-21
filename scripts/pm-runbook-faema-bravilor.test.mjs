import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { defaultConfig, kitList, optionalKits, stepList } from "../src/lib/ops/pm-runbook.ts";
import { matchFaemaX20, matchSego12 } from "../src/lib/ops/runbooks/faema-bravilor-match.ts";

const load = (id) => parseRunbookDefinition(JSON.parse(readFileSync(new URL(`../src/lib/ops/runbooks/${id}.json`, import.meta.url), "utf8")));
const kits = (def, over) => kitList(def, { ...defaultConfig(def), ...over }).map((k) => `${k.q}x ${k.ev}`);
const ids = (def, over) => stepList(def, { ...defaultConfig(def), ...over }).flatMap((g) => g.items.map((s) => s.id));

const B = "FA781739010", E1 = "FA781740010", E2 = "FA781741000", E3 = "FA781742000", M = "FA781743000", EM = "FA966957000", C = "FA781745000";

test("X20 Basic plan follows Faema's table, milk fitted, chocolate fitted", () => {
  const def = load("faema-x20");
  const v = (pm) => kits(def, { plan: "basic", pm, milk: "yes", choco: "yes" });
  assert.deepEqual(v("1"), [`1x ${B}`, `1x ${M}`]);
  assert.deepEqual(v("2"), [`1x ${B}`, `1x ${E1}`, `1x ${M}`, `1x ${C}`]);
  assert.deepEqual(v("3"), [`1x ${B}`, `1x ${E2}`, `1x ${M}`, `1x ${EM}`]);
  assert.deepEqual(v("4"), [`1x ${B}`, `1x ${E1}`, `1x ${E3}`, `1x ${M}`, `1x ${C}`]);
  assert.deepEqual(v("5"), [`1x ${B}`, `1x ${M}`]);
  assert.deepEqual(v("6"), [`1x ${B}`, `1x ${E2}`, `1x ${M}`, `1x ${EM}`]);
  assert.deepEqual(v("7"), []);
});

test("X20 Standard and Business plans", () => {
  const def = load("faema-x20");
  const st = (pm) => kits(def, { plan: "standard", pm, milk: "yes", choco: "yes" });
  assert.deepEqual(st("1"), [`1x ${B}`, `1x ${M}`]);
  assert.deepEqual(st("3"), [`1x ${B}`, `1x ${E1}`, `1x ${M}`, `1x ${EM}`, `1x ${C}`]);
  assert.deepEqual(st("5"), [`1x ${B}`, `1x ${E2}`, `1x ${E3}`, `1x ${M}`]);
  assert.deepEqual(st("13"), [`1x ${B}`, `1x ${M}`]);
  assert.deepEqual(st("14"), []);
  const bu = (pm) => kits(def, { plan: "business", pm, milk: "yes", choco: "yes" });
  assert.deepEqual(bu("2"), [`1x ${B}`, `1x ${M}`, `1x ${C}`]);
  assert.deepEqual(bu("5"), [`1x ${B}`, `1x ${E2}`, `1x ${E3}`, `1x ${M}`, `1x ${C}`]);
  assert.deepEqual(bu("12"), [`1x ${B}`, `1x ${E1}`, `1x ${M}`, `1x ${EM}`]);
  assert.deepEqual(bu("14"), [`1x ${B}`, `1x ${M}`, `1x ${C}`]);
});

test("X20 without milk or chocolate drops those kits and steps; no kit is optional", () => {
  const def = load("faema-x20");
  assert.deepEqual(kits(def, { plan: "standard", pm: "3", milk: "no", choco: "no" }), [`1x ${B}`, `1x ${E1}`]);
  assert.ok(!ids(def, { milk: "no" }).includes("x-mi-kit"));
  assert.deepEqual(optionalKits(def, { ...defaultConfig(def), plan: "standard", pm: "1" }), []);
});

test("X20 yearly checks land once a year", () => {
  const def = load("faema-x20");
  const yearly = (plan, pm) => ids(def, { plan, pm }).includes(`x-hy-pump-${plan}`);
  assert.deepEqual(["1", "2", "3", "4"].map((pm) => yearly("standard", pm)), [false, true, false, true]);
  assert.deepEqual(["1", "2", "3"].map((pm) => yearly("business", pm)), [false, false, true]);
  assert.equal(yearly("basic", "1"), true);
});

test("Sego 12: same PM at 6 and 12 months, burrs only when worn", () => {
  const def = load("bravilor-sego12");
  assert.deepEqual(kits(def, { pm: "6" }), ["1x BB6.980.000.756", "1x BB7.190.103.105"]);
  assert.deepEqual(kits(def, { pm: "12", burrs: "worn" }), ["1x BB6.980.000.756", "1x BB7.190.103.105", "1x BB6.331.433.001"]);
  assert.deepEqual(ids(def, { pm: "6" }), ids(def, { pm: "12" }));
});

test("matchers on real equipment text", () => {
  for (const p of ["X20", "x20", "Faema X20", "Faema X20 /Turbosteam", "PM X20", "Faema S20"]) assert.deepEqual(matchFaemaX20(p), { model: "x20" }, p);
  for (const p of ["Faema X30", "Faema E61 Legend", "Bunn ITCB", "Fetco CBS-2052e"]) assert.equal(matchFaemaX20(p), null, p);
  for (const p of ["Sego12", "Bravilor Sego 12 120V", "sego 12", "Sego -12", "Bravilor Bonamat Sego 12"]) assert.deepEqual(matchSego12(p), { model: "sego12" }, p);
  for (const p of ["Bravilor Iso", "Segafredo"]) assert.equal(matchSego12(p), null, p);
});
