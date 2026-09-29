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

assert.equal(itemSaveError({ status: "N/A", notes: "", photoCount: 0 }), "N/A needs a short note.");
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
