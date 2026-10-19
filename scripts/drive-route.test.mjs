import { test } from "node:test";
import assert from "node:assert/strict";
import { legsFromTable, parseOsrmRoute, parseOsrmTable, pointKey } from "../src/lib/ops/drive-route.ts";

test("an OSRM table becomes drive legs, and a bad table is ignored", () => {
  const points = [
    { lat: 29.8, lng: -95.4 },
    { lat: 29.7, lng: -95.5 },
  ];
  const table = parseOsrmTable(
    {
      code: "Ok",
      durations: [
        [0, 600],
        [700, 0],
      ],
      distances: [
        [0, 1609.344],
        [3218.688, 0],
      ],
    },
    2,
  );
  assert.ok(table);
  const legs = legsFromTable(points, table);
  const hop = legs.get(`${pointKey(points[0])}>${pointKey(points[1])}`);
  assert.equal(hop.minutes, 10);
  assert.ok(Math.abs(hop.miles - 1) < 0.001);
  assert.equal(parseOsrmTable({ code: "NoRoute" }, 2), null);
  assert.equal(parseOsrmTable({ durations: [[0]], distances: [[0]] }, 2), null);
});

test("an OSRM route line is lat/lng points", () => {
  const line = parseOsrmRoute({
    routes: [{ geometry: { coordinates: [[-95.4, 29.8], [-95.39, 29.81]] } }],
  });
  assert.deepEqual(line, [
    { lat: 29.8, lng: -95.4 },
    { lat: 29.81, lng: -95.39 },
  ]);
  assert.equal(parseOsrmRoute({ routes: [] }), null);
});
