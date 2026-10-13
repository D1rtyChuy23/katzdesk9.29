import { test } from "node:test";
import assert from "node:assert/strict";
import { accountsVisited, findModule, moduleSerialKey, searchModules, stopLine, swapCandidates, swapError, trail, workError, workTotals } from "../src/lib/ops/module-history.ts";

const list = [
  { id: 1, moduleId: "BM-1001" },
  { id: 2, moduleId: "bm 1002" },
  { id: 3, moduleId: "SM-77" },
];

test("search before adding: case and spaces never make a second module", () => {
  assert.equal(moduleSerialKey(" bm 1002 "), "BM1002");
  assert.equal(findModule(list, "BM1002")?.id, 2);
  assert.equal(findModule(list, "bm-1001")?.id, 1);
  assert.equal(findModule(list, "BM-1003"), null);
  assert.deepEqual(searchModules(list, "bm").map((m) => m.id), [1, 2]);
  assert.deepEqual(searchModules(list, "SM-77").map((m) => m.id), [3]);
  assert.deepEqual(searchModules(list, "b"), []);
});

const out = { id: 10, moduleId: "BM-OUT", moduleType: "Brew Module", platform: "Cameo", status: "Installed at Account", assignedCustomer: "Cafe A", assignedUnitId: 5 };
const good = { id: 11, moduleId: "BM-IN", moduleType: "Brew Module", platform: "Cameo", status: "Ready", assignedCustomer: null, assignedUnitId: null };

test("swap: same type only, incoming at HQ, outgoing on a unit", () => {
  assert.equal(swapError(out, good, true), null);
  assert.match(swapError(out, { ...good, moduleType: "Steam S Module" }, true), /same type/);
  assert.match(swapError(out, { ...good, platform: "Legacy" }, true), /one platform/);
  assert.equal(swapError(out, { ...good, platform: null }, true), null);
  assert.match(swapError(out, good, false), /not at HQ/);
  assert.match(swapError({ ...out, assignedCustomer: null, assignedUnitId: null }, good, true), /nothing to swap/);
  assert.match(swapError(out, out, true), /different module/);
  assert.match(swapError(out, { ...good, returnPending: true }, true), /return approval/);
});

test("swap candidates: Ready first, wrong type left out", () => {
  const pool = [
    { ...good, id: 20, moduleId: "BM-B", status: "In Progress" },
    { ...good, id: 21, moduleId: "BM-A", status: "Ready" },
    { ...good, id: 22, moduleId: "SM-1", moduleType: "Steam S Module" },
  ];
  assert.deepEqual(swapCandidates(out, pool, () => true).map((m) => m.id), [21, 20]);
});

const stops = [
  { id: 1, kind: "assigned", customer: "Cafe A", unitLabel: "Cameo C'2s · SN 1", otherModule: null, fromPlace: "HQ", toPlace: "Cafe A", happenedAt: "2026-01-02T10:00:00Z", byName: "x", note: null },
  { id: 2, kind: "returned", customer: "Cafe A", unitLabel: null, otherModule: null, fromPlace: "Cafe A", toPlace: "HQ", happenedAt: "2026-03-01T10:00:00Z", byName: "x", note: null },
  { id: 3, kind: "swap_in", customer: "Cafe B", unitLabel: "Cameo C'2s · SN 9", otherModule: "BM-OLD", fromPlace: "HQ", toPlace: "Cafe B", happenedAt: "2026-05-01T10:00:00Z", byName: "x", note: null },
];

test("trail keeps every stop: current is the newest, the last account is never lost", () => {
  const t = trail(stops);
  assert.equal(t.current.id, 3);
  assert.deepEqual(t.past.map((s) => s.id), [2, 1]);
  assert.deepEqual(accountsVisited(stops), ["Cafe A", "Cafe B"]);
});

test("stop lines name the account, the unit and the other module", () => {
  assert.equal(stopLine(stops[2]), "Swapped into Cafe B · went to Cameo C'2s · SN 9 · replacing BM-OLD");
  assert.equal(
    stopLine({ ...stops[2], kind: "swap_out", otherModule: "BM-NEW", unitLabel: "Cameo C'2s · SN 9" }),
    "Swapped out of Cafe B · left Cameo C'2s · SN 9 · replaced by BM-NEW · back to HQ",
  );
  assert.equal(stopLine(stops[1]), "Back to HQ from Cafe A");
});

test("work lines: part or labor, something named, quantity or hours above zero", () => {
  assert.equal(workError({ kind: "part", item: "O-ring kit", qty: "2" }), null);
  assert.equal(workError({ kind: "labor", item: "Rebuild", qty: "1.5", workedOn: "2026-10-13" }), null);
  assert.match(workError({ kind: "x", item: "a", qty: 1 }), /Part or Labor/);
  assert.match(workError({ kind: "labor", item: "Rebuild", qty: "0" }), /Hours/);
  assert.match(workError({ kind: "part", item: " ", qty: 1 }), /which part/);
  assert.deepEqual(workTotals([{ kind: "part", qty: 2 }, { kind: "labor", qty: 1.5 }, { kind: "part", qty: 1 }]), { parts: 3, laborHours: 1.5 });
});
