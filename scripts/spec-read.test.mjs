import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDraft } from "../src/lib/ops/spec-schema.ts";
import { groupFormRows } from "../src/lib/ops/install-form.ts";
import {
  adminSummary,
  applySpecPicks,
  bookSpecStatus,
  clipRows,
  diffSpec,
  isExact,
  orderAdminSections,
  outletForModel,
  valuesFromParts,
  withSpecOutlet,
  blankSpecValues,
} from "../src/lib/ops/spec-read.ts";

test("a blank field is a fill, a different filled field is a conflict, and the same value is not a change to save", () => {
  const current = { ...blankSpecValues(), voltage: "220V", plug: "L6-30P" };
  const extracted = { ...blankSpecValues(), voltage: "208-240V", plug: "L6-30P", amps: "30A", mpn: "ABC" };
  const changes = diffSpec(current, extracted);
  assert.equal(changes.find((c) => c.key === "voltage")?.kind, "conflict");
  assert.equal(changes.find((c) => c.key === "plug")?.kind, "same");
  assert.equal(changes.find((c) => c.key === "amps")?.kind, "fill");
  assert.equal(isExact(changes), false);
  assert.equal(isExact(changes.filter((c) => c.kind !== "conflict")), true);
});

test("approve fills a blank and leaves a conflict unless the review picks the new value", () => {
  const draft = emptyDraft();
  draft.manufacturer = "Bunn";
  draft.model = "ITCB";
  draft.configs = [{ label: "Standard", requirements: { power: { voltage: "120V" } } }];
  const extracted = { ...blankSpecValues(), voltage: "220V", amps: "20A", plug: "L6-20P" };
  const kept = applySpecPicks(draft, extracted, "", {});
  assert.equal(kept.draft.configs[0].requirements.power.voltage, "120V");
  assert.equal(kept.draft.configs[0].requirements.power.amps, "20A");
  assert.equal(kept.draft.configs[0].requirements.power.plug, "L6-20P");
  const replaced = applySpecPicks(draft, extracted, "OLD", { voltage: "new", mpn: "new" });
  assert.equal(replaced.draft.configs[0].requirements.power.voltage, "220V");
  assert.equal(replaced.mpn, null);
  const mpn = applySpecPicks(draft, { ...extracted, mpn: "NEW" }, "", {});
  assert.equal(mpn.mpn, "NEW");
  const stuck = applySpecPicks(draft, { ...extracted, mpn: "NEW" }, "OLD", {});
  assert.equal(stuck.mpn, null);
});

test("tank, brew, and dimensions come off the sheet", () => {
  const values = valuesFromParts({
    requirements: {
      power: { voltage: "220V", amps: "30A" },
      dimensions: { height: "32 in", width: "20 in", depth: "18 in", weight: "80 lb" },
      water: { inlet: '3/8"' },
      drain: { size: "1.5 in" },
    },
    specs: [
      { label: "Tank", value: "2 gallon" },
      { label: "Brew capacity", value: "10 gal/hr" },
    ],
    mpn: "ITCB",
  });
  assert.equal(values.tank, "2 gallon");
  assert.equal(values.brew, "10 gal/hr");
  assert.equal(values.height, "32 in");
  assert.equal(values.mpn, "ITCB");
});

test("a brew value gets its own row and never overwrites a tank or boiler capacity", () => {
  const draft = emptyDraft();
  draft.specs = [{ label: "Tank capacity", value: "3 gal" }];
  const filled = applySpecPicks(draft, { ...blankSpecValues(), brew: "3.8 gal/hr" }, "", {});
  assert.deepEqual(filled.draft.specs, [
    { label: "Tank capacity", value: "3 gal" },
    { label: "Brew capacity", value: "3.8 gal/hr" },
  ]);
  const espresso = emptyDraft();
  espresso.specs = [
    { label: "Boiler capacity", value: "11 L" },
    { label: "Brew capacity", value: "2 gal/hr" },
  ];
  const picked = applySpecPicks(espresso, { ...blankSpecValues(), brew: "3 gal/hr" }, "", { brew: "new" });
  assert.deepEqual(picked.draft.specs, [
    { label: "Boiler capacity", value: "11 L" },
    { label: "Brew capacity", value: "3 gal/hr" },
  ]);
});

test("a manufacturer with a bracket in its name does not break the outlet lookup", () => {
  const odd = { model: "G", manufacturer: "Acme (USA", voltage: "120V", amps: "15A", plug: "" };
  assert.equal(outletForModel("BUNN ICB", [odd]), undefined);
  assert.equal(outletForModel("Acme (USA G", [odd])?.voltage, "120V");
});

test("a unit keeps its own voltage, and a blank outlet takes the spec including amps", () => {
  const spec = { model: "Bunn ITCB", manufacturer: "Bunn", voltage: "220V", amps: "20A", plug: "L6-20P" };
  assert.equal(outletForModel("Bunn ITCB", [spec])?.amps, "20A");
  const filled = withSpecOutlet({ model: "Bunn ITCB", voltage: "120V", plug: "", amps: "" }, spec);
  assert.equal(filled.voltage, "120V");
  assert.equal(filled.amps, "20A");
  assert.equal(filled.plug, "L6-20P");
  const rows = groupFormRows([
    { model: "Bunn ITCB", serial: "", notes: "", voltage: "220V", plug: "", amps: "20A" },
  ]);
  assert.equal(rows[0].outlet, "220V · 20A");
});

test("tiles, admin order, and the summary line", () => {
  assert.equal(bookSpecStatus(0, []), "no_sheet");
  assert.equal(bookSpecStatus(1, []), null);
  assert.equal(bookSpecStatus(2, ["read", "needs_review"]), "needs_review");
  assert.equal(bookSpecStatus(1, ["unreadable"]), "unreadable");
  assert.equal(bookSpecStatus(1, ["read"]), "read");
  const ordered = orderAdminSections([
    { id: "clear", openCount: 0 },
    { id: "work", openCount: 2 },
    { id: "also", openCount: 1 },
  ]);
  assert.deepEqual(ordered.map((s) => s.id), ["work", "also", "clear"]);
  assert.equal(
    adminSummary([
      { id: "dup", openCount: 30, noun: "duplicate groups" },
      { id: "tie", openCount: 11, noun: "untied sheets" },
      { id: "leg", openCount: 3, noun: "legacy" },
      { id: "done", openCount: 0, noun: "cleanup" },
    ]),
    "3 sections need action: 30 duplicate groups, 11 untied sheets, 3 legacy.",
  );
  assert.equal(adminSummary([{ id: "a", openCount: 0, noun: "cleanup" }]), "All clear.");
  assert.equal(clipRows([1, 2, 3, 4], false, 2).more, 2);
  assert.equal(clipRows([1, 2], true, 2).rows.length, 2);
});
