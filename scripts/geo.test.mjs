import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canDriveTo,
  cityFromAddress,
  compass,
  directionsUrl,
  groupByArea,
  isPoint,
  milesBetween,
  milesLabel,
  nearby,
  orderStops,
  pathMiles,
  placeUrl,
  repColors,
  routeUrls,
  spread,
  suggestRep,
  MAX_WAYPOINTS,
  NO_REP_COLOR,
} from "../src/lib/ops/geo.ts";

// Real Houston-area points (from the geocoded customer list).
const GALLERIA = { lat: 29.741468, lng: -95.452042 }; // 4444 Westheimer
const TANGLEWOOD = { lat: 29.750157, lng: -95.478435 }; // 5740 San Felipe
const MARQE = { lat: 29.784803, lng: -95.467715 }; // 7680 Katy Fwy
const KATY = { lat: 29.7858, lng: -95.8245 };
const SUGAR_LAND = { lat: 29.5994, lng: -95.6142 };
const DALLAS = { lat: 32.7767, lng: -96.797 };

test("points: only real coordinates count", () => {
  assert.equal(isPoint(GALLERIA), true);
  assert.equal(isPoint({ lat: 0, lng: 0 }), false);
  assert.equal(isPoint({ lat: null, lng: -95 }), false);
  assert.equal(isPoint({ lat: 95, lng: -95 }), false);
  assert.equal(isPoint(null), false);
});

test("miles: Galleria to Tanglewood is about 1.7 mi; Houston to Dallas about 225 mi", () => {
  const near = milesBetween(GALLERIA, TANGLEWOOD);
  assert.ok(near > 1.5 && near < 1.9, String(near));
  const far = milesBetween(GALLERIA, DALLAS);
  assert.ok(far > 215 && far < 235, String(far));
  assert.equal(milesBetween(KATY, KATY), 0);
  assert.equal(milesLabel(0.04), "0.0 mi");
  assert.equal(milesLabel(3.25), "3.3 mi");
  assert.equal(milesLabel(18.4), "18 mi");
});

test("only street matches are good enough to drive to", () => {
  assert.equal(canDriveTo("exact"), true);
  assert.equal(canDriveTo("close"), true);
  assert.equal(canDriveTo("approx"), false);
  assert.equal(canDriveTo(null), false);
});

const accts = [
  { id: 1, name: "Steak 48", p: GALLERIA, rep: "Amanda S" },
  { id: 2, name: "Common Bond Tanglewood", p: TANGLEWOOD, rep: "Amanda S" },
  { id: 3, name: "Common Bond MarqE", p: MARQE, rep: "Bob T" },
  { id: 4, name: "Katy Cafe", p: KATY, rep: "Bob T" },
  { id: 5, name: "No Pin Co", p: null, rep: null },
  { id: 6, name: "Dallas Spot", p: DALLAS, rep: null },
];

test("nearby: within radius, nearest first, origin and no-pin accounts left out", () => {
  const rows = nearby(GALLERIA, accts, (a) => a.p, 5, { exclude: (a) => a.id === 1, tieKey: (a) => a.name });
  assert.deepEqual(rows.map((r) => r.item.id), [2, 3]);
  assert.ok(rows[0].miles < rows[1].miles);
  assert.deepEqual(nearby(GALLERIA, accts, (a) => a.p, 50, { limit: 2 }).map((r) => r.item.id), [1, 2]);
});

test("city is read from Census and typed addresses", () => {
  assert.equal(cityFromAddress("4444 WESTHEIMER RD, HOUSTON, TX, 77027"), "Houston");
  assert.equal(cityFromAddress("11920 STATE HWY 6, SUGAR LAND, TX, 77478"), "Sugar Land");
  assert.equal(cityFromAddress("2 W EXPY 83, MCALLEN, TX, 78501"), "McAllen");
  assert.equal(cityFromAddress("5740 San Felipe, Houston, TX 77057"), "Houston");
  assert.equal(cityFromAddress("just a name"), null);
  assert.equal(cityFromAddress(null), null);
});

test("areas: close pins group together and are named by city", () => {
  const items = [
    { id: 1, p: GALLERIA, city: "Houston" },
    { id: 2, p: TANGLEWOOD, city: "Houston" },
    { id: 3, p: MARQE, city: "Houston" },
    { id: 4, p: KATY, city: "Katy" },
    { id: 5, p: { lat: 29.79, lng: -95.82 }, city: "Katy" },
    { id: 6, p: null, city: "Houston" },
  ];
  const { areas, unplaced } = groupByArea(items, (i) => i.p, (i) => i.city, { radiusMiles: 5, tieKey: (i) => String(i.id) });
  assert.deepEqual(unplaced.map((i) => i.id), [6]);
  assert.equal(areas.length, 2);
  const byLabel = Object.fromEntries(areas.map((a) => [a.label, a.items.map((i) => i.id).sort()]));
  assert.deepEqual(byLabel, { Houston: [1, 2, 3], Katy: [4, 5] });
  // deterministic
  assert.deepEqual(groupByArea(items, (i) => i.p, (i) => i.city, { radiusMiles: 5 }).areas.map((a) => a.label), areas.map((a) => a.label));
});

test("areas: two groups in the same city get a compass hint", () => {
  const north = { lat: 29.95, lng: -95.4 };
  const south = { lat: 29.6, lng: -95.4 };
  const items = [{ p: north }, { p: { lat: 29.951, lng: -95.401 } }, { p: south }];
  const { areas } = groupByArea(items, (i) => i.p, () => "Houston", { radiusMiles: 3 });
  assert.deepEqual(areas.map((a) => a.label).sort(), ["Houston · N", "Houston · S"]);
  assert.equal(compass(GALLERIA, KATY), "W");
  assert.equal(compass(GALLERIA, DALLAS), "N");
});

test("stop order: untimed stops slot in where they add the fewest miles; timed stops keep their order", () => {
  const stops = [
    { item: "katy", point: KATY, time: null },
    { item: "galleria", point: GALLERIA, time: "09:00" },
    { item: "marqe", point: MARQE, time: null },
    { item: "sugar", point: SUGAR_LAND, time: "15:00" },
    { item: "nopin", point: null, time: null },
    { item: "tanglewood", point: TANGLEWOOD, time: null },
  ];
  const { ordered, unrouted, miles } = orderStops(stops);
  assert.deepEqual(unrouted.map((s) => s.item), ["nopin"]);
  const names = ordered.map((s) => s.item);
  assert.ok(names.indexOf("galleria") < names.indexOf("sugar"), names.join(","));
  assert.equal(names.length, 5);
  // The greedy order should not be worse than a naive one in input order.
  const naive = pathMiles([KATY, GALLERIA, MARQE, SUGAR_LAND, TANGLEWOOD]);
  assert.ok(miles <= naive + 1e-9, `${miles} vs ${naive}`);
  // Tanglewood and MarqE are next to the Galleria, so they sit between the Galleria and Sugar Land or before; Katy is not between two Houston stops.
  const i = names.indexOf("katy");
  const neighbours = [names[i - 1], names[i + 1]].filter(Boolean);
  assert.ok(!(neighbours.includes("galleria") && neighbours.includes("tanglewood")), names.join(","));
});

test("stop order: a start point changes which stop comes first", () => {
  const stops = [
    { item: "galleria", point: GALLERIA, time: null },
    { item: "katy", point: KATY, time: null },
  ];
  assert.equal(orderStops(stops, { lat: 29.79, lng: -95.85 }).ordered[0].item, "katy");
  assert.equal(orderStops(stops, { lat: 29.74, lng: -95.45 }).ordered[0].item, "galleria");
  assert.deepEqual(orderStops([]), { ordered: [], unrouted: [], miles: 0 });
});

test("directions use the pin only for a street match, else the typed address", () => {
  assert.equal(directionsUrl({ point: GALLERIA, quality: "exact", address: "x" }), "https://www.google.com/maps/dir/?api=1&destination=29.741468,-95.452042");
  assert.equal(directionsUrl({ point: GALLERIA, quality: "approx", address: "4444 Westheimer" }), "https://www.google.com/maps/dir/?api=1&destination=4444%20Westheimer");
  assert.equal(directionsUrl({ point: null, quality: null, address: "" }), null);
  assert.equal(placeUrl({ point: GALLERIA, quality: "approx", address: null }), "https://www.google.com/maps/search/?api=1&query=29.741468,-95.452042");
});

test("route links: up to 9 waypoints per link, legs chain, no origin means current location", () => {
  const pts = Array.from({ length: 23 }, (_, i) => ({ lat: 29.7 + i * 0.01, lng: -95.4 }));
  const urls = routeUrls(pts);
  assert.equal(urls.length, 3); // 10 + 10 + 3
  const q = (u) => new URL(u).searchParams;
  assert.equal(q(urls[0]).get("origin"), null);
  assert.equal(q(urls[0]).get("waypoints").split("|").length, MAX_WAYPOINTS);
  assert.equal(q(urls[1]).get("origin"), q(urls[0]).get("destination"));
  assert.equal(q(urls[2]).get("waypoints").split("|").length, 2);
  assert.equal(routeUrls([GALLERIA])[0], "https://www.google.com/maps/dir/?api=1&destination=29.741468,-95.452042&travelmode=driving");
  assert.deepEqual(routeUrls([]), []);
  // An approximate stop can be sent as its typed address instead of a pin.
  const mixed = new URL(routeUrls([GALLERIA, "5740 San Felipe, Houston, TX 77057", KATY])[0]).searchParams;
  assert.equal(mixed.get("waypoints"), "29.741468,-95.452042|5740 San Felipe, Houston, TX 77057");
  assert.equal(routeUrls(["  ", { lat: 0, lng: 0 }]).length, 0);
});

test("territories: suggest the rep with the most accounts nearby", () => {
  const s = suggestRep(TANGLEWOOD, accts.filter((a) => a.id !== 2), (a) => a.p, (a) => a.rep, 5);
  assert.equal(s.rep, "Amanda S");
  assert.equal(s.count, 1);
  assert.equal(suggestRep(DALLAS, accts.filter((a) => a.id !== 6), (a) => a.p, (a) => a.rep, 5), null);
  const sp = spread([GALLERIA, TANGLEWOOD, MARQE]);
  assert.ok(sp.medianMiles > 0 && sp.medianMiles < 3);
  assert.equal(spread([]), null);
});

test("rep colors are stable and distinct", () => {
  const a = repColors(["Bob T", "Amanda S", "Bob T", ""]);
  const b = repColors(["Amanda S", "Bob T"]);
  assert.deepEqual([...a.entries()], [...b.entries()]);
  assert.notEqual(a.get("Amanda S"), a.get("Bob T"));
  assert.ok(![...a.values()].includes(NO_REP_COLOR));
});
