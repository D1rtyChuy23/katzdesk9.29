// Site pass #7 (11/19): lists refresh when you come back to a tab after being away a while. A quick switch away and
// back does nothing, so a list isn't read again on every alt-tab. Then, through the real query library: a list on
// screen is read again on the return, one that is off screen isn't, and one that opted out (the merge preview) isn't.
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
const R = await import("../src/lib/ops/return-refresh.ts");
const { QueryClient, QueryObserver, focusManager } = await import("@tanstack/query-core");

/** A page: its visibility, the window its events reach, and a clock. */
function page() {
  const listeners = new Set();
  const doc = { visibilityState: "visible" };
  const win = {
    addEventListener: (type, fn) => type === "visibilitychange" && listeners.add(fn),
    removeEventListener: (type, fn) => type === "visibilitychange" && listeners.delete(fn),
  };
  let t = 1_000_000;
  const clock = { now: () => t, pass: (ms) => (t += ms) };
  const set = (state) => {
    doc.visibilityState = state;
    for (const fn of [...listeners]) fn();
  };
  return { doc, win, clock, listeners, hide: () => set("hidden"), show: () => set("visible") };
}

test("coming back after 30 seconds or more refreshes; a quick switch away and back does not", () => {
  const p = page();
  const calls = [];
  const stop = R.returnRefreshListener({ doc: p.doc, target: p.win, now: p.clock.now })((focused) => calls.push(focused));
  p.hide();
  p.clock.pass(5_000);
  p.show();
  assert.deepEqual(calls, []);
  p.hide();
  p.clock.pass(R.AWAY_BEFORE_REFRESH_MS);
  p.show();
  assert.equal(calls.length, 1);
  // It tells the query library "focus came back" without claiming the page was ever unfocused, so nothing pauses.
  assert.equal(calls[0], undefined);
  stop();
  assert.equal(p.listeners.size, 0);
});

test("the clock starts at the first hide: hidden events repeated while away don't restart it", () => {
  const p = page();
  const calls = [];
  R.returnRefreshListener({ doc: p.doc, target: p.win, now: p.clock.now })(() => calls.push(1));
  p.hide();
  p.clock.pass(20_000);
  p.hide();
  p.clock.pass(15_000);
  p.show();
  assert.equal(calls.length, 1);
  // A visible event with no hide before it (the page opening) does nothing.
  p.show();
  assert.equal(calls.length, 1);
});

test("a page that opens hidden (a background tab) counts from when it opened", () => {
  const p = page();
  p.doc.visibilityState = "hidden";
  const calls = [];
  R.returnRefreshListener({ doc: p.doc, target: p.win, now: p.clock.now })(() => calls.push(1));
  p.clock.pass(60_000);
  p.show();
  assert.equal(calls.length, 1);
});

test("with no window (the server render) it sets nothing up", () => {
  assert.equal(R.returnRefreshListener({ doc: undefined, target: undefined })(() => {}), undefined);
});

test("through the query library: a list on screen is read again on the return; off screen or opted out, it isn't", async () => {
  const p = page();
  focusManager.setEventListener(R.returnRefreshListener({ doc: p.doc, target: p.win, now: p.clock.now }));
  try {
    const client = new QueryClient({ defaultOptions: { queries: R.QUERY_DEFAULTS } });
    // The app's provider mounts the client; that is what hooks it to focus.
    client.mount();
    const reads = { tickets: 0, offScreen: 0, preview: 0 };
    const watch = (key, extra = {}) => {
      const o = new QueryObserver(client, { queryKey: [key], queryFn: async () => ++reads[key], staleTime: 0, ...extra });
      return o.subscribe(() => {});
    };
    const off1 = watch("tickets");
    const off2 = watch("preview", { refetchOnWindowFocus: false });
    await client.fetchQuery({ queryKey: ["offScreen"], queryFn: async () => ++reads.offScreen, staleTime: 0 });
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(reads, { tickets: 1, offScreen: 1, preview: 1 });
    // A quick switch: nothing is read.
    p.hide();
    p.clock.pass(3_000);
    p.show();
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(reads, { tickets: 1, offScreen: 1, preview: 1 });
    // Away a minute: the list on screen is read again; the off-screen one and the opted-out preview aren't.
    p.hide();
    p.clock.pass(60_000);
    p.show();
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(reads, { tickets: 2, offScreen: 1, preview: 1 });
    off1();
    off2();
    client.unmount();
  } finally {
    focusManager.setEventListener(() => undefined);
  }
});
