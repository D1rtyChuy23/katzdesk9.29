import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterCertLine,
  filterContact,
  filterElectrical,
  filterHz,
  filterNonUsa,
  filterPlug,
  filterVoltage,
  filterWater,
  restoreRemoved,
} from "../src/lib/ops/spec-filter.ts";
import { copyAll, copyConfig } from "../src/lib/ops/spec-copy.ts";
import { compactDraft, parseExtraction, specSheetSchema } from "../src/lib/ops/spec-schema.ts";

// ---------------- spec-filter ----------------

test("voltage: 220-240V goes, 208-240V and 120V stay", () => {
  assert.deepEqual(filterVoltage("220-240V"), { kept: "", removed: ["220-240V"] });
  assert.deepEqual(filterVoltage("208-240V").removed, []);
  assert.deepEqual(filterVoltage("120V").removed, []);
  assert.deepEqual(filterVoltage("240V").removed, []);
  const mixed = filterVoltage("120V / 230V");
  assert.equal(mixed.kept, "120V");
  assert.deepEqual(mixed.removed, ["230V"]);
  assert.deepEqual(filterVoltage("380-415V 3N").removed, ["380-415V 3N"]);
});

test("electrical lines with Hz and stuck-together slashes", () => {
  assert.deepEqual(filterElectrical("230V 50Hz 1ph"), { kept: "", removed: ["230V 50Hz 1ph"] });
  const both = filterElectrical("120V/60Hz, 230V/50Hz");
  assert.ok(both.kept.includes("120V"));
  assert.ok(!both.kept.includes("230V"));
  assert.ok(both.removed.join(" ").includes("230V"));
  assert.deepEqual(filterElectrical("208-240V, 60Hz").removed, []);
  assert.deepEqual(filterElectrical("220-240V / 50-60 Hz, 120V / 60 Hz"), {
    kept: "120V / 60 Hz",
    removed: ["220-240V / 50-60 Hz"],
  });
});

test("frequency: 50 Hz removed, 50/60 Hz narrowed to 60 Hz", () => {
  assert.deepEqual(filterHz("50 Hz"), { kept: "", removed: ["50 Hz"] });
  assert.deepEqual(filterHz("50/60 Hz"), { kept: "60 Hz", removed: ["50 Hz"] });
  assert.deepEqual(filterHz("60Hz").removed, []);
});

test("plugs: Schuko / BS 1363 / CEE go, NEMA stays", () => {
  assert.equal(filterPlug("Schuko CEE 7/7").kept, "");
  assert.equal(filterPlug("BS 1363 (UK)").kept, "");
  assert.deepEqual(filterPlug("NEMA 6-30P").removed, []);
  assert.deepEqual(filterPlug("NEMA 5-15P, Schuko").removed, ["Schuko"]);
  assert.deepEqual(filterPlug("Hardwired").removed, []);
});

test("certifications: CE/UKCA/RoHS-only marks go, UL/NSF/ETL stay", () => {
  assert.deepEqual(filterCertLine("CE"), { kept: "", removed: ["CE"] });
  assert.deepEqual(filterCertLine("UL, NSF, CE, RoHS"), { kept: "UL, NSF", removed: ["CE", "RoHS"] });
  assert.deepEqual(filterCertLine("ETL Listed").removed, []);
  assert.deepEqual(filterCertLine("UKCA").removed, ["UKCA"]);
  assert.deepEqual(filterCertLine("EN 60335-1").removed, ["EN 60335-1"]);
  assert.deepEqual(filterCertLine("NSF/ANSI 4").removed, []);
  assert.deepEqual(filterCertLine("ETL Listed (UL 197), NSF/ANSI 4, CE, UKCA"), {
    kept: "ETL Listed (UL 197), NSF/ANSI 4",
    removed: ["CE", "UKCA"],
  });
  assert.deepEqual(filterCertLine("CE / UKCA / EAC").kept, "");
});

test("water: BSP/DIN/°dH and bar-only values go, imperial stays", () => {
  assert.deepEqual(filterWater('3/8" NPT').removed, []);
  assert.deepEqual(filterWater("30-60 psi").removed, []);
  assert.equal(filterWater("G 3/8 BSP").kept, "");
  assert.equal(filterWater("2-6 bar").kept, "");
  assert.deepEqual(filterWater("2-6 bar (30-87 psi)").removed, []);
  assert.equal(filterWater("Max hardness 8 °dH").kept, "");
  assert.equal(filterWater("DIN EN 1717 backflow").kept, "");
  assert.equal(filterWater("40 mm").kept, "");
  assert.deepEqual(filterWater('1.5" drain').removed, []);
});

test("contacts: non-US offices go, US office stays", () => {
  const v = "La Marzocco srl, Via La Torre 14, Florence, Italy, +39 055 849191; La Marzocco USA, Seattle, WA 98101, +1 206-706-9104";
  const r = filterContact(v);
  assert.ok(r.kept.includes("Seattle"));
  assert.ok(!r.kept.includes("Italy"));
  assert.equal(r.removed.length, 1);
  assert.deepEqual(filterContact("Bunn-O-Matic, Springfield, IL 62708, 1-800-637-8606").removed, []);
  assert.equal(filterContact("Eversys SA, Sierre, Switzerland, +41 27 455 12 12").kept, "");
});

const sample = {
  manufacturer: "La Marzocco",
  model: "Linea PB",
  category: "Espresso Machine",
  summary: "Multi-boiler espresso machine.",
  specs: [
    { label: "Boilers", value: "Dual" },
    { label: "Electrical", value: "220-240V 50Hz, 208-240V 60Hz" },
    { label: "Approvals", value: "CE, UL, NSF" },
    { label: "Water inlet", value: "G 3/8 BSP" },
  ],
  mfrNotes: {
    usContact: "La Marzocco USA, Seattle, WA 98101; La Marzocco srl, Florence, Italy",
    warranty: "2 years parts",
    certifications: ["UL", "NSF", "CE", "UKCA"],
  },
  configs: [
    {
      label: "2 Group",
      requirements: {
        power: { voltage: "208-240V", amps: "30", phase: "1", hz: "50/60 Hz", plug: "NEMA 6-30P" },
        water: { inlet: '3/8"', pressure: "30-60 psi", filtration: "filtered" },
        drain: { size: '1.5"' },
        dimensions: { width: '31.5"', depth: '23.6"', height: '20.5"', weight: "143 lb" },
      },
    },
    {
      label: "2 Group 230V 50Hz (CE)",
      requirements: { power: { voltage: "230V", hz: "50 Hz", plug: "Schuko" } },
    },
  ],
};

test("filterNonUsa reports every removal and restore puts it back", () => {
  const { draft, removed } = filterNonUsa(specSheetSchema.parse(sample));
  assert.equal(draft.configs.length, 1, "CE/230V configuration removed");
  assert.equal(draft.configs[0].requirements.power.hz, "60 Hz");
  assert.deepEqual(draft.mfrNotes.certifications, ["UL", "NSF"]);
  assert.equal(draft.specs.find((s) => s.label === "Electrical").value, "208-240V 60Hz");
  assert.equal(draft.specs.find((s) => s.label === "Approvals").value, "UL, NSF");
  assert.equal(draft.specs.find((s) => s.label === "Water inlet"), undefined);
  assert.ok(draft.mfrNotes.usContact.includes("Seattle"));
  assert.ok(!draft.mfrNotes.usContact.includes("Italy"));
  const reasons = new Set(removed.map((r) => r.reason));
  for (const r of ["config", "frequency", "certification", "voltage", "water", "contact"]) assert.ok(reasons.has(r), `reports ${r}`);
  assert.ok(removed.every((r) => r.id && r.where && r.removed && r.note), "every removal is described");

  // Restore each one: the value comes back.
  const cfg = removed.find((r) => r.reason === "config");
  assert.equal(restoreRemoved(draft, cfg).configs.length, 2);
  const ce = removed.find((r) => r.path.kind === "cert" && r.original === "CE");
  assert.ok(restoreRemoved(draft, ce).mfrNotes.certifications.includes("CE"));
  const water = removed.find((r) => r.path.kind === "spec" && r.reason === "water");
  assert.equal(restoreRemoved(draft, water).specs.find((s) => s.label === "Water inlet").value, "G 3/8 BSP");
  const hzItem = removed.find((r) => r.path.kind === "field" && r.path.key === "hz");
  assert.equal(restoreRemoved(draft, hzItem).configs[0].requirements.power.hz, "50/60 Hz");
});

test("a US-only sheet comes through untouched", () => {
  const us = specSheetSchema.parse({
    manufacturer: "Bunn",
    model: "ITCB-DV",
    specs: [{ label: "Electrical", value: "120/208-240V, 60Hz" }],
    mfrNotes: { certifications: ["UL", "NSF"], usContact: "Bunn-O-Matic, Springfield, IL 62708" },
    configs: [{ label: "Standard", requirements: { power: { voltage: "120/208-240V", amps: "20", plug: "NEMA L14-20P" } } }],
  });
  const { draft, removed } = filterNonUsa(us);
  assert.equal(removed.length, 0);
  assert.deepEqual(draft, us);
});

// ---------------- spec-copy ----------------

test("copyConfig matches the Outlook/Teams format", () => {
  const sheet = compactDraft(filterNonUsa(specSheetSchema.parse(sample)).draft);
  sheet.configs[0].requirements.power.hz = undefined;
  assert.equal(
    copyConfig(sheet, sheet.configs[0]),
    [
      "La Marzocco Linea PB - 2 Group",
      "Power: 208-240V, 30A, 1-phase, NEMA 6-30P",
      'Water: 3/8" inlet, 30-60 psi, filtered',
      'Drain: 1.5"',
      'Size: 31.5"W x 23.6"D x 20.5"H, 143 lb',
    ].join("\n"),
  );
});

test("copy text has short plain lines and no markdown", () => {
  const sheet = specSheetSchema.parse(sample);
  const all = copyAll(sheet);
  assert.ok(!/[|#*`]/.test(all), "no markdown");
  assert.ok(all.split("\n").every((l) => l.length <= 120), "short lines");
  assert.ok(all.includes("\n\nLa Marzocco Linea PB - 2 Group 230V 50Hz (CE)"), "configs separated by a blank line");
  assert.ok(all.includes("Warranty: 2 years parts"));
  assert.equal(copyConfig(sheet, { label: "Standard", requirements: {} }), "La Marzocco Linea PB\nNo requirements listed");
});

test("bare numbers get units", () => {
  const text = copyConfig(
    { manufacturer: "Bunn", model: "TB3" },
    { label: "Standard", requirements: { power: { voltage: "120", amps: "15", phase: "1", hz: "60" }, dimensions: { width: "10", weight: "20" } } },
  );
  assert.equal(text, 'Bunn TB3\nPower: 120V, 15A, 1-phase, 60 Hz\nSize: 10"W, 20 lb');
});

// ---------------- zod parsing of extraction output ----------------

test("parseExtraction accepts fenced JSON with nulls and numbers", () => {
  const reply = [
    "Here is the data:",
    "```json",
    JSON.stringify({
      manufacturer: "Mahlkönig",
      model: "E65S",
      category: "Grinder",
      summary: null,
      specs: [{ label: "Burr size", value: 65 }],
      mfrNotes: { usContact: null, warranty: "", certifications: "UL, NSF" },
      configs: [{ label: "", requirements: { power: { voltage: "120V", amps: 10, phase: null }, water: null } }],
    }),
    "```",
  ].join("\n");
  const r = parseExtraction(reply);
  assert.equal(r.ok, true);
  assert.equal(r.data.specs[0].value, "65");
  assert.deepEqual(r.data.mfrNotes.certifications, ["UL", "NSF"]);
  assert.equal(r.data.configs[0].label, "Standard");
  assert.equal(r.data.configs[0].requirements.power.amps, "10");
  assert.equal(r.data.configs[0].requirements.power.phase, undefined);
  assert.equal(r.data.summary, undefined);
});

test("parseExtraction rejects broken or mis-shaped output with a readable error", () => {
  const bad = parseExtraction("{ manufacturer: 'x' ");
  assert.equal(bad.ok, false);
  const none = parseExtraction("Sorry, I can't read that.");
  assert.equal(none.ok, false);
  assert.match(none.error, /No JSON/);
  const shape = parseExtraction(JSON.stringify({ manufacturer: "A", model: "B", specs: "nope", configs: [] }));
  assert.equal(shape.ok, false);
  assert.match(shape.error, /specs/);
});

test("compactDraft drops blanks", () => {
  const c = compactDraft(
    specSheetSchema.parse({
      manufacturer: " Bunn ",
      model: "TB3",
      specs: [{ label: "Color", value: " " }],
      mfrNotes: {},
      configs: [{ label: "", requirements: { power: { voltage: "", amps: "15" }, water: {} } }],
    }),
  );
  assert.equal(c.manufacturer, "Bunn");
  assert.deepEqual(c.specs, []);
  assert.deepEqual(c.configs[0].requirements.power, { amps: "15" });
  assert.equal(c.configs[0].requirements.water, undefined);
});
