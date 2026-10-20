import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Radix drops a closed tab's contents unless forceMount is set, and it switches on mouse-down, before a box loses
// focus. So every panel in these windows stays mounted: typing is kept and notes that save on blur still save.
const sheets = ["entity-sheets.tsx", "rebuild-sheet.tsx"].map((name) => ({
  name,
  src: readFileSync(new URL(`../src/components/desk/${name}`, import.meta.url), "utf8"),
}));

const panels = (src) => [...src.matchAll(/<Tabs\.Content\b[^>]*>/g)].map((m) => m[0]);
const panel = (src, testId) => panels(src).find((p) => p.includes(`data-testid="${testId}"`));

test("every PM, install and rebuild tab stays mounted while another tab is open", () => {
  for (const { name, src } of sheets) {
    const tags = panels(src);
    assert.ok(tags.length >= 4, `${name} has its tab panels`);
    for (const tag of tags) {
      assert.match(tag, /\bforceMount\b/, `${name}: ${tag}`);
      assert.match(tag, /KEEP_MOUNTED/, `${name}: ${tag}`);
    }
  }
});

test("kept panels keep their padding", () => {
  const [entity, rebuild] = sheets.map((s) => s.src);
  assert.match(panel(entity, "pm-panel-invoices"), /p-5/);
  assert.match(panel(entity, "install-panel-invoices"), /p-5/);
  assert.match(panel(rebuild, "rebuild-panel-equipment"), /space-y-4 px-5 py-4/);
  for (const id of ["pm-panel-runbook", "install-panel-equipment", "install-panel-pre-inspection"]) assert.ok(panel(entity, id), id);
  assert.ok(panel(rebuild, "rebuild-panel-invoices"));
});
