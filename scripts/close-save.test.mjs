import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

// Closing a ticket, PM, install or deal window saves only what was changed (Chuy, 11/9).

await register("./node-resolve-hook.mjs", import.meta.url);
const { patchKey, closeDecision, CLOSE_UNSAVED } = await import("../src/lib/ops/close-save.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a patch reads the same whatever order its fields come in", () => {
  assert.equal(patchKey({ id: 1, notes: null, status: "Open" }), patchKey({ status: "Open", id: 1, notes: null }));
  assert.notEqual(patchKey({ id: 1, notes: null }), patchKey({ id: 1, notes: "x" }));
  // A field that isn't sent and one sent as undefined are the same save.
  assert.equal(patchKey({ id: 1, po: undefined }), patchKey({ id: 1 }));
  assert.notEqual(patchKey({ id: 1, machines: [{ model: "A", qty: 1 }] }), patchKey({ id: 1, machines: [{ model: "A", qty: 2 }] }));
});

test("closing saves only a changed window, and warns once before leaving a change it can't save", () => {
  const same = patchKey({ id: 1, notes: "a" });
  const other = patchKey({ id: 1, notes: "b" });
  // Nothing typed: just close.
  assert.equal(closeDecision({ baseline: same, now: same, valid: true, warned: false }), "close");
  assert.equal(closeDecision({ baseline: same, now: same, valid: false, warned: false }), "close");
  // Changed and it can save: save, as closing always did.
  assert.equal(closeDecision({ baseline: same, now: other, valid: true, warned: false }), "save");
  // No baseline was read (the form wasn't up yet): save, as closing always did.
  assert.equal(closeDecision({ baseline: null, now: other, valid: true, warned: false }), "save");
  assert.equal(closeDecision({ baseline: null, now: null, valid: true, warned: false }), "save");
  // Changed with a required box empty: stay open and say so, once. The next close leaves it unsaved.
  assert.equal(closeDecision({ baseline: same, now: other, valid: false, warned: false }), "warn");
  assert.equal(closeDecision({ baseline: same, now: other, valid: false, warned: true }), "close");
  assert.equal(closeDecision({ baseline: null, now: other, valid: false, warned: false }), "warn");
  assert.equal(CLOSE_UNSAVED, "Not saved: a required box is empty. Fill it in, or close again to leave your changes unsaved.");
});

test("the ticket, PM, install and deal windows close through that rule", () => {
  const sheets = src("src/components/desk/entity-sheets.tsx");
  const job = src("src/components/desk/job-sheet.tsx");
  // No window submits its form on every close any more.
  for (const text of [sheets, job]) assert.doesNotMatch(text, /if \(!o\) \{\n\s+skipToast\.current = true;\n\s+(flushOnClose\(\);\n\s+)?formRef\.current\?\.requestSubmit\(\);/);
  assert.equal((sheets.match(/closeWindow\(\{/g) ?? []).length, 3);
  assert.equal((job.match(/closeWindow\(\{/g) ?? []).length, 1);
  // Each reads what it would save when it opens, and again after a save.
  assert.match(sheets, /now: \(form\) => patchKey\(pmPatchOf\(form, pm\.id\)\)/);
  assert.match(sheets, /now: \(form\) => patchKey\(dealPatchOf\(form, deal\.id\)\)/);
  assert.match(sheets, /now: \(form\) => installKey\(form\)/);
  assert.match(job, /now: \(form\) => patchKey\(formPatch\(form, j\.id\)\)/);
});
