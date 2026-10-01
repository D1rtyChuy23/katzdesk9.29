import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySpecDefaults,
  breakerFor,
  coreHoleInfo,
  coreHoleSaveError,
  isEspresso,
  normalizeDiameter,
  defaultPlugNote,
  decidePlug,
  DEFAULT_INLET,
  HARDWIRE_ONLY,
  isThreePhase,
  nemaCode,
  plugWireError,
  WIRE_MISSING_NOTE,
  WIRES_3,
  WIRES_4,
  wireCount,
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

test("220 V 3-wire → L6 twist-lock sized from amps", () => {
  const w3 = { voltage: "208-240V", wires: "3-wire" };
  assert.equal(decidePlug({ ...w3, amps: "30", phase: "1" }).plug, "NEMA L6-30 twist-lock");
  assert.equal(decidePlug({ ...w3, amps: "30" }).breaker, "30A 2-pole");
  assert.equal(decidePlug({ ...w3, voltage: "240V", amps: "16A" }).plug, "NEMA L6-20 twist-lock");
  assert.equal(decidePlug({ voltage: "220V, 2-wire + ground", amps: "20" }).plug, "NEMA L6-20 twist-lock");
  assert.equal(decidePlug({ ...w3, amps: "24.5" }).plug, "NEMA L6-30 twist-lock");
  assert.equal(decidePlug({ ...w3, amps: "30" }).wires, WIRES_3);
  // The manufacturer's own 3-wire plug counts as evidence; it becomes the L version.
  assert.equal(decidePlug({ voltage: "208-240V", amps: "30", plug: "NEMA 6-30P" }).plug, "NEMA L6-30 twist-lock");
});

test("220 V 4-wire → L14 twist-lock, never the 3-wire L6", () => {
  const w4 = { voltage: "208-240V", wires: "4-wire" };
  assert.equal(decidePlug({ ...w4, amps: "20" }).plug, "NEMA L14-20 twist-lock");
  assert.equal(decidePlug({ ...w4, amps: "30" }).plug, "NEMA L14-30 twist-lock");
  assert.equal(decidePlug({ ...w4, amps: "30" }).nema, "L14-30");
  const unknownAmps = decidePlug(w4);
  assert.equal(unknownAmps.plug, "NEMA L14-20 twist-lock");
  assert.match(unknownAmps.note, /4-wire/);
  assert.match(unknownAmps.note, /Default/);
  // 4-wire from the electrical text: "3-wire + ground" = 2 hots + neutral + ground, or a stated neutral.
  assert.equal(decidePlug({ voltage: "120/208V, 3-wire + ground", amps: "20" }).nema, "L14-20");
  assert.equal(decidePlug({ voltage: "208-240V", circuit: "2 hots, neutral, ground", amps: "30" }).nema, "L14-30");
  assert.equal(decidePlug({ voltage: "120/208-240V", amps: "20A / 30A", plug: "NEMA L14-30P" }).plug, "NEMA L14-30 twist-lock");
});

test("model exception: Bunn Axiom at 220 V is 4-wire → L14-20", () => {
  const ctx = { manufacturer: "Bunn", model: "Axiom 15-3 DV" };
  const d = decidePlug({ voltage: "208-240V" }, ctx);
  assert.equal(d.plug, "NEMA L14-20 twist-lock");
  assert.equal(d.wires, WIRES_4);
  assert.match(d.note, /model exception/);
  assert.equal(wireCount({ voltage: "208-240V" }, ctx).source, "model");
  assert.equal(decidePlug({ voltage: "208-240V", amps: "30" }, ctx).plug, "NEMA L14-30 twist-lock");
  // An explicit Wires field still wins over the exception.
  assert.equal(decidePlug({ voltage: "208-240V", wires: "3-wire", amps: "20" }, ctx).plug, "NEMA L6-20 twist-lock");
});

test("220 V with no wire count: plug left unset and flagged, never a guessed L6", () => {
  const d = decidePlug({ voltage: "208-240V", amps: "30" });
  assert.equal(d.plug, null);
  assert.equal(d.nema, null);
  assert.equal(d.note, WIRE_MISSING_NOTE);
  assert.equal(defaultPlugNote({ voltage: "208-240V" }), WIRE_MISSING_NOTE);
  // An L6 we wrote earlier is not evidence of the wiring.
  assert.equal(defaultPlugNote({ voltage: "208-240V", plug: "NEMA L6-30 twist-lock" }), WIRE_MISSING_NOTE);
  assert.equal(decidePlug({ voltage: "208-240V", amps: "30", plug: "Hardwired" }).plug, null);
});

test("above 30 A there is no locking face: 6-50 / 14-50 with a note", () => {
  const d = decidePlug({ voltage: "208-240V", wires: "3-wire", amps: "40" });
  assert.equal(d.plug, "NEMA 6-50");
  assert.equal(d.breaker, "50A 2-pole");
  assert.ok(d.note);
  assert.equal(decidePlug({ voltage: "208-240V", wires: "4-wire", amps: "40" }).plug, "NEMA 14-50");
});

test("save check: plug must match volts and wire count", () => {
  assert.match(plugWireError({ voltage: "208-240V", wires: "4-wire", plug: "NEMA L6-30 twist-lock" }), /needs L14/);
  assert.match(plugWireError({ voltage: "208-240V", wires: "3-wire", plug: "NEMA L14-20 twist-lock" }), /needs L6/);
  assert.match(plugWireError({ voltage: "120V", plug: "NEMA L6-30 twist-lock" }), /120V/);
  assert.match(plugWireError({ voltage: "208-240V", plug: "NEMA L6-20 twist-lock" }, { manufacturer: "Bunn", model: "Axiom" }), /needs L14/);
  assert.equal(plugWireError({ voltage: "208-240V", wires: "4-wire", plug: "NEMA L14-20 twist-lock" }), null);
  assert.equal(plugWireError({ voltage: "208V", phase: "3", plug: HARDWIRE_ONLY }), null);
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
  assert.equal(g.configs[0].requirements.power.wires, WIRES_3, "wire count written from the sheet's 6-30P");
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
    { manufacturer: "La Marzocco", model: "Linea PB", specs: [], mfrNotes: {}, configs: [{ label: "2 Group", requirements: { power: { voltage: "208-240V", wires: "3-wire", amps: "30", phase: "1" } } }] },
    "generate",
  );
  assert.equal(
    copyConfig(g, g.configs[0]),
    [
      "La Marzocco Linea PB - 2 Group",
      "Power: 208-240V, 3-wire (2 hots, ground), 30A (30A 2-pole breaker), 1-phase, NEMA L6-30 twist-lock",
      'Water: 3/8" compression valve',
      "Utility lines pass through the counter: Yes",
      'Hole diameter: 3"',
      "Note: Primarily needed when utility lines are below the counter.",
    ].join("\n"),
  );
});

test("core hole travels with the copied configuration: 1.5\" set, and No copies No", () => {
  const sheet = { manufacturer: "Bunn", model: "ITCB-DV", category: "Brewer", coreHole: "yes", coreDiameter: '1.5"' };
  const text = copyConfig(sheet, { label: "Standard", requirements: { water: { inlet: DEFAULT_INLET } } });
  assert.ok(text.includes("Utility lines pass through the counter: Yes"));
  assert.ok(text.includes('Hole diameter: 1.5"'));
  assert.equal(text.match(/1\.5"/g).length, 1, "the size is stated once");
  assert.ok(!text.includes("Counter core hole:"));
  assert.ok(text.includes("Primarily needed when utility lines are below the counter."));
  const no = copyConfig({ ...sheet, coreHole: "no", coreDiameter: undefined }, { label: "Standard", requirements: {} });
  assert.ok(no.includes("Utility lines pass through the counter: No"));
  assert.ok(!/Hole diameter|Counter core hole:/.test(no));
});

test("espresso machines default to a 3\" counter core hole", () => {
  assert.ok(isEspresso({ manufacturer: "La Marzocco", model: "Linea PB" }));
  assert.ok(isEspresso({ manufacturer: "Eversys", model: "Cameo C'2s" }));
  assert.ok(isEspresso({ manufacturer: "Rancilio", model: "Classe 11" }));
  assert.ok(isEspresso({ manufacturer: "Faema", model: "E71" }));
  assert.ok(isEspresso({ manufacturer: "Acme", model: "X1", category: "Espresso Machine" }));
  assert.ok(!isEspresso({ manufacturer: "Mahlkönig", model: "E65S", category: "Grinder" }));
  assert.ok(!isEspresso({ manufacturer: "Bunn", model: "ITCB-DV", category: "Brewer" }));
  assert.ok(!isEspresso({ manufacturer: "Eversys", model: "E'Fridge" }));
  const lm = coreHoleInfo({ manufacturer: "La Marzocco", model: "Linea PB" });
  assert.deepEqual(lm, { required: true, diameter: '3"', label: 'Counter core hole: 3" diameter', missingDiameter: false });
  assert.equal(coreHoleInfo({ manufacturer: "La Marzocco", model: "Linea PB", coreDiameter: "2.5" }).label, 'Counter core hole: 2.5" diameter');
  assert.equal(coreHoleInfo({ manufacturer: "La Marzocco", model: "Linea PB", coreHole: "no" }).required, false);
  const g = applySpecDefaults({ manufacturer: "Eversys", model: "Enigma e'4s", specs: [], mfrNotes: {}, configs: [] }, "generate");
  assert.equal(g.coreHole, "yes");
  assert.equal(g.coreDiameter, '3"');
});

test("non-espresso: no invented 3\", diameter required when Yes", () => {
  const brewer = { manufacturer: "Bunn", model: "ITCB-DV", category: "Brewer" };
  assert.equal(coreHoleInfo(brewer).required, false);
  const g = applySpecDefaults({ ...brewer, specs: [], mfrNotes: {}, configs: [] }, "generate");
  assert.equal(g.coreHole, undefined);
  assert.equal(g.coreDiameter, undefined);
  const yes = coreHoleInfo({ ...brewer, coreHole: "yes" });
  assert.equal(yes.missingDiameter, true);
  assert.equal(yes.diameter, null);
  assert.match(coreHoleSaveError({ ...brewer, coreHole: "yes" }), /diameter/);
  assert.equal(coreHoleSaveError({ ...brewer, coreHole: "yes", coreDiameter: "2" }), null);
  assert.equal(coreHoleInfo({ ...brewer, coreHole: "yes", coreDiameter: "2" }).label, 'Counter core hole: 2" diameter');
  // Pre-inspection said Yes on a brewer with nothing stored: blank, needed.
  assert.equal(coreHoleInfo(brewer, true).label, "Counter core hole: diameter needed");
  assert.equal(normalizeDiameter("3 in"), '3"');
  assert.equal(normalizeDiameter("76 mm"), "76 mm");
});
