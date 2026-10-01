import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySpecDefaults,
  breakerFor,
  defaultPlugNote,
  decidePlug,
  DEFAULT_INLET,
  HARDWIRE_ONLY,
  isThreePhase,
  nemaCode,
} from "../src/lib/ops/spec-defaults.ts";
import { copyConfig } from "../src/lib/ops/spec-copy.ts";
import { emptyDraft } from "../src/lib/ops/spec-schema.ts";

test("3-phase is hardwire only, no NEMA", () => {
  const d = decidePlug({ voltage: "208V", phase: "3-phase", amps: "40" });
  assert.equal(d.plug, HARDWIRE_ONLY);
  assert.equal(d.nema, null);
  assert.equal(d.breaker, "50A 3-pole");
  assert.ok(isThreePhase({ voltage: "208-240V 3ph" }));
  assert.ok(isThreePhase({ phase: "3" }));
  assert.ok(isThreePhase({ voltage: "208V 3Ø" }));
  assert.ok(!isThreePhase({ voltage: "208-240V", phase: "1" }));
  assert.equal(decidePlug({ voltage: "480V", phase: "three" }).breaker, "3-pole, size from the nameplate");
});

test("220 V single-phase → L6 twist-lock sized from amps", () => {
  assert.equal(decidePlug({ voltage: "208-240V", amps: "30", phase: "1" }).plug, "NEMA L6-30 twist-lock");
  assert.equal(decidePlug({ voltage: "208-240V", amps: "30" }).breaker, "30A 2-pole");
  assert.equal(decidePlug({ voltage: "240V", amps: "16A" }).plug, "NEMA L6-20 twist-lock");
  assert.equal(decidePlug({ voltage: "220V", amps: "20" }).breaker, "20A 2-pole");
  assert.equal(decidePlug({ voltage: "208-240V", amps: "24.5" }).plug, "NEMA L6-30 twist-lock");
  // Hardwire on a single-phase sheet becomes a NEMA plug.
  assert.equal(decidePlug({ voltage: "208-240V", amps: "30", plug: "Hardwired" }).plug, "NEMA L6-30 twist-lock");
  // Straight blade on the sheet → the L version.
  assert.equal(decidePlug({ voltage: "208-240V", amps: "30", plug: "NEMA 6-30P" }).plug, "NEMA L6-30 twist-lock");
});

test("220 V with unknown amps defaults to L6-30 and says so", () => {
  const d = decidePlug({ voltage: "208-240V" });
  assert.equal(d.plug, "NEMA L6-30 twist-lock");
  assert.equal(d.nema, "L6-30");
  assert.equal(d.breaker, "30A 2-pole");
  assert.match(d.note, /Default/);
  assert.match(defaultPlugNote({ voltage: "208-240V", plug: "NEMA L6-30 twist-lock" }), /Default/);
  assert.equal(defaultPlugNote({ voltage: "208-240V", amps: "30", plug: "NEMA L6-30 twist-lock" }), null);
});

test("above 30 A there is no L6 face: 6-50 with a note", () => {
  const d = decidePlug({ voltage: "208-240V", amps: "40" });
  assert.equal(d.plug, "NEMA 6-50");
  assert.equal(d.breaker, "50A 2-pole");
  assert.ok(d.note);
});

test("120 V → 5-15 or 5-20, twist-lock only if the sheet already says L", () => {
  assert.equal(decidePlug({ voltage: "120V", amps: "15" }).plug, "NEMA 5-15");
  assert.equal(decidePlug({ voltage: "120V", amps: "12" }).breaker, "15A 1-pole");
  assert.equal(decidePlug({ voltage: "120V", amps: "16" }).plug, "NEMA 5-20");
  assert.equal(decidePlug({ voltage: "115V", amps: "20A" }).breaker, "20A 1-pole");
  const unknown = decidePlug({ voltage: "120V" });
  assert.equal(unknown.plug, "NEMA 5-15");
  assert.match(unknown.note, /Default/);
  assert.equal(decidePlug({ voltage: "120V", amps: "20", plug: "NEMA L5-20P" }).plug, "NEMA L5-20 twist-lock");
});

test("dual-voltage with an L14 on the sheet keeps it", () => {
  const d = decidePlug({ voltage: "120/208-240V", amps: "20A / 30A", plug: "NEMA L14-30P" });
  assert.equal(d.plug, "NEMA L14-30 twist-lock");
  assert.equal(d.breaker, "30A 2-pole");
});

test("unknown voltage leaves the plug alone", () => {
  assert.equal(decidePlug({ plug: "NEMA 5-15P" }).plug, "NEMA 5-15P");
  assert.equal(decidePlug({}).plug, null);
});

test("nemaCode and breakerFor", () => {
  assert.equal(nemaCode("NEMA L6-30 twist-lock"), "L6-30");
  assert.equal(nemaCode("NEMA 5-15P"), "5-15");
  assert.equal(nemaCode(HARDWIRE_ONLY), null);
  assert.equal(nemaCode("Hard-wired"), null);
  assert.equal(breakerFor(16), 20);
  assert.equal(breakerFor(24), 30);
  assert.equal(breakerFor(40), 50);
});

test("generate sets the inlet and plug on every configuration; fill keeps edits", () => {
  const draft = {
    manufacturer: "La Marzocco",
    model: "Linea PB",
    specs: [],
    mfrNotes: {},
    configs: [
      { label: "2 Group", requirements: { power: { voltage: "208-240V", amps: "30", phase: "1", plug: "NEMA 6-30P" }, water: { inlet: '1/4" flare' } } },
      { label: "3 Group", requirements: { power: { voltage: "208V", phase: "3-phase", amps: "40" } } },
      { label: "Grinder", requirements: {} },
    ],
  };
  const g = applySpecDefaults(draft, "generate");
  assert.equal(g.configs[0].requirements.water.inlet, DEFAULT_INLET);
  assert.equal(g.configs[0].requirements.power.plug, "NEMA L6-30 twist-lock");
  assert.equal(g.configs[0].requirements.power.breaker, "30A 2-pole");
  assert.equal(g.configs[1].requirements.power.plug, HARDWIRE_ONLY);
  assert.equal(g.configs[2].requirements.water.inlet, DEFAULT_INLET, "never blank");
  assert.equal(g.configs[2].requirements.power, undefined, "no invented power block");

  const edited = structuredClone(g);
  edited.configs[0].requirements.power.plug = "NEMA L14-30 twist-lock";
  edited.configs[0].requirements.water.inlet = '3/8" compression valve w/ shutoff';
  const f = applySpecDefaults(edited, "fill");
  assert.equal(f.configs[0].requirements.power.plug, "NEMA L14-30 twist-lock");
  assert.equal(f.configs[0].requirements.water.inlet, '3/8" compression valve w/ shutoff');

  const blank = structuredClone(g);
  blank.configs[0].requirements.water.inlet = "";
  assert.equal(applySpecDefaults(blank, "fill").configs[0].requirements.water.inlet, DEFAULT_INLET);
});

test("blank manual form starts with the inlet filled", () => {
  assert.equal(emptyDraft().configs[0].requirements.water.inlet, DEFAULT_INLET);
});

test("copy text carries the plug and breaker", () => {
  const g = applySpecDefaults(
    { manufacturer: "La Marzocco", model: "Linea PB", specs: [], mfrNotes: {}, configs: [{ label: "2 Group", requirements: { power: { voltage: "208-240V", amps: "30", phase: "1" } } }] },
    "generate",
  );
  assert.equal(
    copyConfig(g, g.configs[0]),
    'La Marzocco Linea PB - 2 Group\nPower: 208-240V, 30A (30A 2-pole breaker), 1-phase, NEMA L6-30 twist-lock\nWater: 3/8" compression valve',
  );
});
