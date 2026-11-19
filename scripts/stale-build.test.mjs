// Site pass #5 (11/19): each page is its own script. A tab still on an older build, after a publish, asks for a page
// script the new build no longer has. It reloads itself once onto the new build instead of hanging on the loading
// clock. A second failure within a minute doesn't loop: the error screen offers Reload.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
const B = await import("../src/lib/ops/stale-build.ts");

test("knows the browsers' messages for a missing page script, and nothing else", () => {
  for (const m of [
    "Failed to fetch dynamically imported module: https://katzdesk.grok.me/assets/pms-Ab12.js",
    "error loading dynamically imported module: https://katzdesk.grok.me/assets/pms-Ab12.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/pms-Ab12.css",
    "'text/html' is not a valid JavaScript MIME type.",
  ])
    assert.equal(B.isStaleBuildError(new Error(m)), true, m);
  for (const m of ["Only an Admin can fill install dates from installs.", "Failed to fetch", "Network error", ""])
    assert.equal(B.isStaleBuildError(new Error(m)), false, m);
  assert.equal(B.isStaleBuildError("Failed to fetch dynamically imported module: x"), true);
  assert.equal(B.isStaleBuildError(null), false);
});

/** A tab: its session storage and a reload that is counted. */
function tab() {
  const store = new Map();
  let t = 5_000_000;
  const s = {
    reloads: 0,
    storage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    now: () => t,
    pass: (ms) => (t += ms),
    reload: () => s.reloads++,
    memo: {},
  };
  return s;
}

test("reloads once; a second miss within a minute doesn't loop; after a minute it may reload again", () => {
  const t = tab();
  assert.equal(B.reloadForNewBuild(t), true);
  assert.equal(t.reloads, 1);
  t.pass(20_000);
  assert.equal(B.reloadForNewBuild(t), false);
  assert.equal(t.reloads, 1);
  t.pass(B.RELOAD_GUARD_MS);
  assert.equal(B.reloadForNewBuild(t), true);
  assert.equal(t.reloads, 2);
});

test("with storage blocked it still reloads, once per page", () => {
  const t = tab();
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  const memo = {};
  assert.equal(B.reloadForNewBuild({ ...t, storage: blocked, memo }), true);
  assert.equal(B.reloadForNewBuild({ ...t, storage: blocked, memo }), false);
  assert.equal(t.reloads, 1);
});

/** A window: listeners by event type, and a way to fire one. */
function win() {
  const on = new Map();
  return {
    addEventListener: (type, fn) => on.set(type, [...(on.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => on.set(type, (on.get(type) ?? []).filter((f) => f !== fn)),
    fire(type, event) {
      for (const fn of on.get(type) ?? []) fn(event);
      return event;
    },
    count: (type) => (on.get(type) ?? []).length,
  };
}

test("installed on the window: Vite's preload error and an unhandled import failure each reload, once", () => {
  const w = win();
  const t = tab();
  const stop = B.installStaleBuildRecovery({ target: w, ...t });
  let prevented = 0;
  w.fire("vite:preloadError", { payload: new Error("Failed to fetch dynamically imported module: /assets/pms-1.js"), preventDefault: () => prevented++ });
  assert.deepEqual([t.reloads, prevented], [1, 1]);
  // Within the guard: not reloaded, and the error is left to show.
  w.fire("vite:preloadError", { payload: new Error("Failed to fetch dynamically imported module: /assets/pms-1.js"), preventDefault: () => prevented++ });
  assert.deepEqual([t.reloads, prevented], [1, 1]);
  t.pass(B.RELOAD_GUARD_MS);
  w.fire("unhandledrejection", { reason: new TypeError("Failed to fetch dynamically imported module: /assets/x.js"), preventDefault: () => prevented++ });
  assert.equal(t.reloads, 2);
  // Any other failure is left alone.
  t.pass(B.RELOAD_GUARD_MS);
  w.fire("unhandledrejection", { reason: new Error("Only an Admin can do that."), preventDefault: () => prevented++ });
  assert.equal(t.reloads, 2);
  stop();
  assert.deepEqual([w.count("vite:preloadError"), w.count("unhandledrejection")], [0, 0]);
});

test("with no window (the server render) it sets nothing up", () => {
  assert.equal(B.installStaleBuildRecovery({ target: undefined }), undefined);
});
