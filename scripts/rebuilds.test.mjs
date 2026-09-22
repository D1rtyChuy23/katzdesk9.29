import assert from "node:assert/strict";
import {
  computeRebuildMetrics,
  validateRebuild,
  HEALTH_RANK,
  SHOP_ACCOUNT,
} from "../src/lib/ops/rebuild-model.ts";

const today = "2026-09-16";

const overdue = computeRebuildMetrics(
  {
    status: "In progress",
    owner: "Bill",
    targetComplete: "2026-09-09",
    actualStart: "2026-08-20",
    actualComplete: null,
    createdAt: "2026-08-18",
    statusChangedAt: "2026-08-25",
    reasonCode: null,
  },
  today,
);
assert.equal(overdue.health, "overdue");
assert.equal(overdue.clockFlag, "overdue");
assert.ok(overdue.daysToTarget < 0);
assert.equal(HEALTH_RANK[overdue.health], 0);

const waiting = computeRebuildMetrics(
  {
    status: "Waiting",
    owner: "Josh",
    targetComplete: "2026-09-22",
    actualStart: "2026-09-01",
    actualComplete: null,
    createdAt: "2026-08-25",
    statusChangedAt: "2026-09-05",
    reasonCode: "Parts on order",
  },
  today,
);
assert.equal(waiting.health, "at-risk");
assert.equal(waiting.clockFlag, "waiting-long");
assert.ok(waiting.daysInStatus > 5);

const noDate = computeRebuildMetrics(
  {
    status: "In progress",
    owner: "Jesus",
    targetComplete: null,
    actualStart: "2026-09-13",
    actualComplete: null,
    createdAt: "2026-09-11",
    statusChangedAt: "2026-09-13",
    reasonCode: null,
  },
  today,
);
assert.equal(noDate.health, "no-date");

const onTrack = computeRebuildMetrics(
  {
    status: "Testing",
    owner: "Ryan",
    targetComplete: "2026-09-24",
    actualStart: "2026-09-04",
    actualComplete: null,
    createdAt: "2026-08-31",
    statusChangedAt: "2026-09-14",
    reasonCode: null,
  },
  today,
);
assert.equal(onTrack.health, "on-track");
assert.equal(onTrack.clockFlag, null);

const done = computeRebuildMetrics(
  {
    status: "Completed",
    owner: "Jesus",
    targetComplete: "2026-09-08",
    actualStart: "2026-08-19",
    actualComplete: "2026-09-07",
    createdAt: "2026-08-15",
    statusChangedAt: "2026-09-07",
    reasonCode: null,
  },
  today,
);
assert.equal(done.health, "done");
assert.equal(done.daysLateEarly, -1);

assert.equal(
  validateRebuild({
    title: "x",
    account: SHOP_ACCOUNT,
    owner: "Ryan",
    status: "Waiting",
    reasonCode: null,
    reasonDetail: null,
    targetComplete: "2026-09-20",
    prevStatus: "In progress",
  }),
  "Waiting needs a reason delayed before save.",
);

assert.equal(
  validateRebuild({
    title: "x",
    account: SHOP_ACCOUNT,
    owner: null,
    status: "In progress",
    reasonCode: null,
    reasonDetail: null,
    targetComplete: "2026-09-20",
    prevStatus: "Queued",
  }),
  "Assign an owner before leaving Queued.",
);

assert.equal(
  validateRebuild({
    title: "Hyde Park ITCB",
    account: "Hyde Park",
    owner: "Josh",
    status: "Waiting",
    reasonCode: "Parts on order",
    reasonDetail: "ETA Friday",
    targetComplete: "2026-09-20",
    prevStatus: "In progress",
  }),
  null,
);

console.log("rebuild model ok");
