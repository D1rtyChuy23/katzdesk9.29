import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canMarkInstalled,
  categoryHint,
  failedItemLabels,
  inspectionOverall,
  itemSaveError,
  photosCell,
  rollupSite,
  showCoreHoleQuestion,
  siteIsReady,
  spacePassError,
  inspectorChoices,
} from "../src/lib/ops/pre-inspection.ts";

const all = ["power", "water", "drain", "ethernet", "space"];
const items = (status) => all.map((category) => ({ category, status }));

assert.equal(inspectionOverall([]), "Not started");
assert.equal(inspectionOverall(items("Not inspected")), "Not started");
assert.equal(inspectionOverall([{ category: "power", status: "Pass" }]), "In progress");
assert.equal(
  inspectionOverall([
    { category: "power", status: "Pass" },
    { category: "drain", status: "Fail" },
  ]),
  "Failed",
);
assert.deepEqual(failedItemLabels([{ category: "drain", status: "Fail" }, { category: "power", status: "Fail" }]), [
  "Power",
  "Drain",
]);
assert.equal(inspectionOverall(items("Pass")), "Passed");
assert.equal(
  inspectionOverall(all.map((category) => ({ category, status: category === "ethernet" ? "N/A" : "Pass" }))),
  "Passed",
);

// N/A needs no note. Notes are optional on every status.
assert.equal(itemSaveError({ status: "N/A", notes: "", photoCount: 0 }), null);
assert.equal(itemSaveError({ status: "N/A", photoCount: 0 }), null);
assert.equal(itemSaveError({ status: "N/A", notes: "no ethernet required", photoCount: 0 }), null);
assert.equal(itemSaveError({ status: "Pass", notes: "", photoCount: 0 }), "Add at least one photo before Pass or Fail.");
assert.equal(itemSaveError({ status: "Fail", notes: "no drain", photoCount: 1 }), null);

assert.equal(canMarkInstalled({ overall: "Not started", overrideReason: null }), false);
assert.equal(canMarkInstalled({ overall: "Failed", overrideReason: null }), false);
assert.equal(canMarkInstalled({ overall: "Failed", overrideReason: "Customer opening Friday" }), true);
assert.equal(canMarkInstalled({ overall: "Passed", overrideReason: null }), true);

assert.equal(siteIsReady("Ready", "Passed"), true);
assert.equal(siteIsReady("Ready", "Failed"), false);
assert.equal(siteIsReady("Ready", "Not started"), false);
assert.equal(siteIsReady("Not Ready", "Passed"), false);
assert.equal(photosCell(0), "No");
assert.equal(photosCell(2), "2");

const passedLines = items("Pass");
assert.equal(inspectionOverall(passedLines, "no"), "Passed");
assert.equal(inspectionOverall([...passedLines, { category: "core", status: "Fail" }], "no"), "Passed");
assert.equal(inspectionOverall(passedLines, "yes"), "In progress");
assert.equal(inspectionOverall([...passedLines, { category: "core", status: "Not inspected" }], "yes"), "In progress");
assert.equal(inspectionOverall([...passedLines, { category: "core", status: "Fail" }], "yes"), "Failed");
assert.equal(inspectionOverall([...passedLines, { category: "core", status: "Pass" }], "yes"), "Passed");
assert.equal(inspectionOverall([...passedLines, { category: "core", status: "N/A" }], "yes"), "Passed");
assert.deepEqual(
  failedItemLabels([...passedLines, { category: "core", status: "Fail" }], "yes"),
  ["Counter core / utility pass-through"],
);
assert.deepEqual(failedItemLabels([{ category: "core", status: "Fail" }], "no"), []);

assert.equal(showCoreHoleQuestion("N/A", null), false);
assert.equal(showCoreHoleQuestion("N/A", "yes"), true);
assert.equal(showCoreHoleQuestion("N/A", "no"), true);
assert.equal(showCoreHoleQuestion("Not inspected", null), true);
assert.equal(showCoreHoleQuestion("Pass", null), true);

assert.equal(
  spacePassError({ status: "Pass", notes: "", photoCount: 1, coreNeeded: null }),
  "Answer Yes or No on the core hole before Space can pass.",
);
assert.equal(spacePassError({ status: "Pass", notes: "", photoCount: 0, coreNeeded: "yes" }), "Add at least one photo before Pass or Fail.");
assert.equal(spacePassError({ status: "Pass", notes: "", photoCount: 1, coreNeeded: "no" }), null);
assert.equal(spacePassError({ status: "N/A", notes: "open counter", photoCount: 0, coreNeeded: null }), null);

const yesBlocked = rollupSite([{ items: passedLines, photoCount: 5, coreNeeded: "yes" }], null);
assert.equal(yesBlocked.overall, "In progress");
assert.equal(yesBlocked.passedCount, 0);
const yesFailed = rollupSite(
  [{ items: [...passedLines, { category: "core", status: "Fail" }], photoCount: 6, coreNeeded: "yes" }],
  null,
);
assert.equal(yesFailed.overall, "Failed");
assert.ok(yesFailed.failedItems.includes("Counter core / utility pass-through"));
const yesOk = rollupSite(
  [{ items: [...passedLines, { category: "core", status: "Pass" }], photoCount: 6, coreNeeded: "yes" }],
  null,
);
assert.equal(yesOk.overall, "Passed");
assert.match(categoryHint("core", { model: "Bunn" }), /Bunn/);

const powerWater = [
  { category: "power", status: "Pass" },
  { category: "water", status: "Pass" },
];
const site = rollupSite(
  [
    { items: powerWater, photoCount: 2 },
    { items: [], photoCount: 0 },
    { items: [{ category: "drain", status: "Fail" }], photoCount: 1 },
  ],
  null,
);
assert.equal(site.overall, "Failed");
assert.equal(site.passedCount, 0);
assert.equal(site.machineCount, 3);
assert.equal(siteIsReady("Ready", site.overall), false);

const partial = rollupSite(
  [
    { items: powerWater, photoCount: 2 },
    { items: [], photoCount: 0 },
  ],
  null,
);
assert.equal(partial.overall, "In progress");
assert.equal(partial.passedCount, 0);
assert.equal(partial.machineCount, 2);

const done = rollupSite(
  all.map((category) => ({ category, status: "Pass" })).reduce(
    (machines, item, idx) => {
      if (idx === 0) machines.push({ items: [item], photoCount: 1 });
      else machines[0].items.push(item);
      return machines;
    },
    [],
  ),
  null,
);
assert.equal(done.overall, "Passed");
assert.equal(done.passedCount, 1);
assert.match(categoryHint("power", { model: "Bunn", electrical: "220V" }), /220V/);
assert.doesNotMatch(categoryHint("drain", { model: "Bunn", electrical: "220V" }), /220V/);

const exportSrc = readFileSync(new URL("../src/lib/ops/export-reports.ts", import.meta.url), "utf8");
assert.match(exportSrc, /Pre-inspection status/);
assert.match(exportSrc, /Failed items/);
assert.match(exportSrc, /Core hole needed/);
assert.match(exportSrc, /Core hole status/);
assert.match(exportSrc, /siteIsReady/);
assert.match(exportSrc, /"Serial number"/);
assert.match(exportSrc, /"Electrical configuration"/);

const reps = [
  { name: "Amanda Logg", initials: "AL", active: true },
  { name: "Lizbeth Romero", initials: "LR", active: true },
  { name: "Sean Marshall", initials: "SM", active: true },
  { name: "Lance Oden", initials: "LO", active: true },
  { name: "Bill McKinley", initials: "BM", active: true },
  { name: "Shannon Cafourek", initials: "SC", active: true },
  { name: "Jesus Garcia", initials: "JG", active: true },
  { name: "Melinda Warden", initials: "MW", active: true },
  { name: "Pat Sales", initials: "PS", active: true },
  { name: "Gone Rep", initials: "GR", active: false },
];
const techs = [
  { name: "Ryan Gloria", active: true },
  { name: "Charles Foster", active: true },
  { name: "Oliver Garcia", active: true },
  { name: "Joshua Harper", active: true },
  { name: "Lance Oden", active: true },
  { name: "Jesus Garcia", active: true },
  { name: "Bill McKinley", active: true },
  { name: "Brandon Chappell", active: true },
  { name: "3rd Party", active: true },
  { name: "New Tech", active: true },
  { name: "Elias", active: false },
];
const picked = inspectorChoices(reps, techs, "");
const labels = picked.options.map((o) => o.label);
assert.deepEqual(
  labels,
  [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
);
assert.ok(labels.includes("Amanda Logg (AL)"));
assert.ok(labels.includes("Pat Sales (PS)"));
assert.ok(labels.includes("Ryan Gloria"));
assert.ok(labels.includes("Brandon Chappell"));
assert.ok(labels.includes("3rd Party"));
assert.ok(labels.includes("New Tech"));
assert.equal(labels.filter((l) => l.startsWith("Lance Oden")).length, 1);
assert.equal(labels.find((l) => l.startsWith("Lance Oden")), "Lance Oden (LO)");
assert.equal(labels.find((l) => l.startsWith("Jesus Garcia")), "Jesus Garcia (JG)");
assert.equal(labels.find((l) => l.startsWith("Bill McKinley")), "Bill McKinley (BM)");
assert.equal(picked.options.find((o) => o.value === "Ryan Gloria")?.label, "Ryan Gloria");
assert.equal(labels.includes("Elias"), false);
assert.equal(labels.includes("Gone Rep (GR)"), false);
assert.equal(labels.some((l) => /pedro/i.test(l)), false);
assert.equal(labels.some((l) => /warehouse|wh\./i.test(l)), false);

const kept = inspectorChoices(reps, techs, "Walk-through guy");
assert.equal(kept.value, "Walk-through guy");
assert.equal(kept.options[0]?.label, "Walk-through guy");
assert.ok(kept.options.some((o) => o.label === "Amanda Logg (AL)"));

const matched = inspectorChoices(reps, techs, "Amanda Logg (AL)");
assert.equal(matched.value, "Amanda Logg");
assert.equal(matched.options.some((o) => o.value === "Amanda Logg (AL)"), false);

console.log("pre-inspection rules ok");

import { showChecklist } from "../src/lib/ops/pre-inspection.ts";

// A replacement unit is asked about site requirements before the form opens.
assert.equal(showChecklist("new", null), true);
assert.equal(showChecklist(null, null), true);
assert.equal(showChecklist("replace", null), false);
assert.equal(showChecklist("replace", true), true);
assert.equal(showChecklist("replace", false), true);

import { isPreInspected, rollupSite as roll, summarizeInspection as sumOne, unitKind } from "../src/lib/ops/pre-inspection.ts";

// Existing equipment on the account is already pre-inspected.
assert.equal(unitKind(null, true), "existing");
assert.equal(unitKind(null, false), "new");
assert.equal(unitKind("new", true), "new");
// Replacing and existing are one choice: a unit saved as "replace" is existing, and Pre-Inspected.
assert.equal(unitKind("replace", true), "existing");
assert.equal(unitKind("replace", false), "existing");
assert.equal(isPreInspected(unitKind("replace", false)), true);
assert.equal(unitKind("existing", false), "existing");
assert.equal(isPreInspected("existing"), true);
assert.equal(isPreInspected("new"), false);
assert.equal(showChecklist("existing", null), false);
assert.equal(sumOne([], 0, null, null, true).overall, "Passed");
assert.equal(sumOne([{ category: "power", status: "Fail" }], 0, null, null, true).failedItems.length, 0);
// A new install is unchanged: nothing inspected is Not started.
assert.equal(sumOne([], 0, null, null, false).overall, "Not started");
// One existing unit and one untouched new install: the site is in progress, 1 of 2 passed.
const mixed = roll([{ items: [], photoCount: 0, preInspected: true }, { items: [], photoCount: 0 }], null);
assert.equal(mixed.overall, "In progress");
assert.equal(mixed.passedCount, 1);
assert.equal(roll([{ items: [], photoCount: 0, preInspected: true }], null).overall, "Passed");

// ---- checks by model type ----
import { unitCategories as checksFor, unitType as typeOf, inspectionOverall as overallOf, rollupSite as rollAll } from "../src/lib/ops/pre-inspection.ts";
for (const g of ["Bunn G9", "Bunn G9-2T HD Stainless", "Mazzer Super Jolly", "Mahlkonig E65S", "Mahlkonig EK43"]) {
  assert.equal(typeOf(g), "grinder", g);
  assert.deepEqual(checksFor(g), ["power", "space"], g);
}
for (const b of ["Fetco CBS-1151V+", "Bunn Axiom 15-3 DV", "Bunn ITCB-DV", "Bunn TB3", "Curtis G4", "Bunn Nitron"]) {
  assert.equal(typeOf(b), "brewer", b);
  assert.deepEqual(checksFor(b), ["power", "water", "space"], b);
}
for (const e of ["La Marzocco Linea PB", "Rancilio Classe 9", "Nuova Simonelli Appia"]) {
  assert.equal(typeOf(e), "espresso", e);
  assert.deepEqual(checksFor(e), ["power", "water", "drain", "space"], e);
}
// Ethernet on Eversys only.
for (const v of ["Eversys Cameo C'2", "Eversys Enigma E'4", "Cameo C'2ms"]) assert.deepEqual(checksFor(v), ["power", "water", "drain", "ethernet", "space"], v);
for (const n of ["La Marzocco Linea PB", "Fetco CBS-1151V+", "Bunn G9"]) assert.ok(!checksFor(n).includes("ethernet"), n);
// A grinder passes on Power and Space alone; a hidden check is never waited on, and an old saved Fail on it is ignored.
const grinderDone = [{ category: "power", status: "Pass" }, { category: "space", status: "N/A" }];
assert.equal(overallOf(grinderDone, "no", checksFor("Bunn G9")), "Passed");
assert.equal(overallOf([...grinderDone, { category: "water", status: "Fail" }], "no", checksFor("Bunn G9")), "Passed");
assert.equal(overallOf([{ category: "power", status: "Pass" }], null, checksFor("Bunn G9")), "In progress");
// A brewer waits on Water but not Drain or Ethernet.
const brewer = checksFor("Bunn ITCB-DV");
assert.equal(overallOf([{ category: "power", status: "Pass" }, { category: "space", status: "Pass" }], "no", brewer), "In progress");
assert.equal(overallOf([{ category: "power", status: "Pass" }, { category: "space", status: "Pass" }, { category: "water", status: "N/A" }], "no", brewer), "Passed");
// Site: 2/2 when both units pass their own checks; existing equipment still counts as passed; any Fail fails.
const two = rollAll([
  { items: grinderDone, photoCount: 1, coreNeeded: "no", categories: checksFor("Bunn G9") },
  { items: [], photoCount: 0, preInspected: true, categories: brewer },
], null);
assert.equal(two.overall, "Passed"); assert.equal(two.passedCount, 2); assert.equal(two.machineCount, 2);
const oneOpen = rollAll([
  { items: grinderDone, photoCount: 1, coreNeeded: "no", categories: checksFor("Bunn G9") },
  { items: [{ category: "power", status: "Pass" }], photoCount: 1, categories: brewer },
], null);
assert.equal(oneOpen.overall, "In progress"); assert.equal(oneOpen.passedCount, 1);
const oneFail = rollAll([
  { items: grinderDone, photoCount: 1, coreNeeded: "no", categories: checksFor("Bunn G9") },
  { items: [{ category: "water", status: "Fail" }], photoCount: 1, categories: brewer },
], null);
assert.equal(oneFail.overall, "Failed");
console.log("pre-inspection by model type: ok");
// Names as they are written on accounts.
assert.equal(typeOf("Bunn LPG-2E, 120V"), "grinder");
assert.equal(typeOf("La Marzocco Swift Dual-Hopper Espresso Grinder"), "grinder");
assert.equal(typeOf("Bravilor Sego 12 120V"), "brewer");
assert.equal(typeOf("SN:AXAP028340"), "brewer");
assert.deepEqual(checksFor("LM Linea S 2AV SN:LS028751"), ["power", "water", "drain", "space"]);
assert.deepEqual(checksFor("Classe 9"), ["power", "water", "drain", "space"]);
assert.deepEqual(checksFor("E4s"), ["power", "water", "drain", "ethernet", "space"]);
assert.deepEqual(checksFor("Bunn ITCB-DV, 29\" w/Flip Tray"), ["power", "water", "space"]);
assert.deepEqual(checksFor("EZRO200-10"), ["power", "space"]);
console.log("account names: ok");
