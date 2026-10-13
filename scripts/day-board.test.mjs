import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_HOURS, boardLocked, boardMove, cleanTime, dropTime, hourColumn, hourLabel, timeLabel } from "../src/lib/ops/day-board.ts";

test("times are kept as HH:MM", () => {
  assert.equal(cleanTime("7:30"), "07:30");
  assert.equal(cleanTime("13:00:00"), "13:00");
  assert.equal(cleanTime("25:00"), null);
  assert.equal(cleanTime(""), null);
  assert.equal(cleanTime(null), null);
});

test("labels read like a dispatch board", () => {
  assert.equal(timeLabel("07:00"), "7a");
  assert.equal(timeLabel("12:30"), "12:30p");
  assert.equal(timeLabel("19:00"), "7p");
  assert.equal(hourLabel(7), "7a");
  assert.equal(BOARD_HOURS[0], 7);
  assert.equal(BOARD_HOURS.at(-1), 21);
});

test("a time outside the grid sits at the nearest edge", () => {
  assert.equal(hourColumn("05:15"), 7);
  assert.equal(hourColumn("23:00"), 21);
  assert.equal(hourColumn("10:45"), 10);
  assert.equal(hourColumn(null), null);
});

test("a drop lands on the hour or half past", () => {
  assert.equal(dropTime(9, 0.1), "09:00");
  assert.equal(dropTime(9, 0.7), "09:30");
  assert.equal(dropTime(14, 0.5), "14:30");
});

test("completed and cancelled work does not move", () => {
  assert.equal(boardLocked({ status: "Completed" }), true);
  assert.equal(boardLocked({ status: "Cancelled" }), true);
  assert.equal(boardLocked({ status: "Phone Resolved" }), true);
  assert.equal(boardLocked({ status: "Scheduled", done: true }), true);
  assert.equal(boardLocked({ status: "Scheduled" }), false);
  assert.equal(boardLocked({ status: "Open", done: false }), false);
});

test("a drop in the same place changes nothing", () => {
  const at = { date: "2026-10-05", time: "09:00", technician: "Ryan Gloria" };
  assert.equal(boardMove(at, { ...at, time: "9:00" }), null);
  assert.deepEqual(boardMove(at, { ...at, time: "10:30" }), { date: "2026-10-05", time: "10:30", technician: "Ryan Gloria" });
  assert.deepEqual(boardMove(at, { ...at, technician: "" }), { date: "2026-10-05", time: "09:00", technician: null });
});
