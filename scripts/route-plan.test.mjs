import { test } from "node:test";
import assert from "node:assert/strict";
import { collectDayStops, colorOfTech, crewLabel, linkStop, milesNote, placeStops, planAreas, planTechRoutes, routeLinks, routeNote, routeStartNote, stopCount, stopTime, techColors, techKey, techOrder, typeCounts, arrangeStops, moveWrites, MISSING_LABEL, NO_TECH, KATZ_SHOP } from "../src/lib/ops/route-plan.ts";
import { NO_REP_COLOR, REP_PALETTE, milesBetween } from "../src/lib/ops/geo.ts";
import { driveBetween, legsFromTable, pointKey } from "../src/lib/ops/drive-route.ts";

const DAY = "2026-10-14";
const OTHER = "2026-10-15";

// Real Houston-area points (same as the geo tests).
const GALLERIA = { lat: 29.741468, lng: -95.452042 };
const TANGLEWOOD = { lat: 29.750157, lng: -95.478435 };
const MARQE = { lat: 29.784803, lng: -95.467715 };
const KATY = { lat: 29.7858, lng: -95.8245 };
const SUGAR_LAND = { lat: 29.5994, lng: -95.6142 };

const ticket = (o) => ({
  id: 1,
  customer: "Steak 48",
  scheduled: DAY,
  scheduledTime: null,
  technician: "Ryan Gloria",
  secondaryTech: null,
  status: "Open",
  done: false,
  duplicateOf: null,
  wo: null,
  callId: "C-1",
  ...o,
});
const pm = (o) => ({ id: 1, customer: "Steak 48", projected: DAY, scheduledTime: null, technician: "Ryan Gloria", status: "Scheduled", done: false, wo: null, ...o });
const install = (o) => ({ id: 1, customer: "Steak 48", installDate: DAY, scheduledTime: null, technician: "Ryan Gloria", complete: false, equipStatus: "Scheduled", wo: null, ...o });
const none = { installs: [], pms: [], services: [], tlcs: [] };

const ACCOUNTS = new Map(
  [
    { id: 11, name: "Steak 48", ...GALLERIA, quality: "exact", address: "4444 Westheimer Rd, Houston, TX 77027", city: "Houston" },
    { id: 12, name: "Common Bond Tanglewood", ...TANGLEWOOD, quality: "close", address: "5740 San Felipe St, Houston, TX 77057", city: "Houston" },
    { id: 13, name: "MARQ*E", ...MARQE, quality: "exact", address: null, city: "Houston" },
    { id: 14, name: "Katy Diner", ...KATY, quality: "close", address: "1 Main St, Katy, TX 77494", city: "Katy" },
    { id: 15, name: "Sugar Land Grill", ...SUGAR_LAND, quality: "approx", address: null, city: "Sugar Land" },
    { id: 16, name: "No Pin Cafe", lat: null, lng: null, quality: null, address: "9 Nowhere Ln, Houston, TX 77002", city: "Houston" },
    // Only the ZIP code's center (the street address was not found), though an address is typed.
    { id: 17, name: "Katy Zip Diner", lat: 29.7858, lng: -95.8245, quality: "approx", address: "2 Main St, Katy, TX 77494", city: "Katy" },
    // A pin whose match was never recorded: not known to be the street address either.
    { id: 18, name: "Unknown Match Bar", lat: 29.76, lng: -95.37, quality: null, address: null, city: "Houston" },
  ].map((a) => [a.name.toLowerCase(), a]),
);
const find = (name) => ACCOUNTS.get(name.trim().toLowerCase());

test("tech names group like the day board", () => {
  assert.equal(techKey("ryan gloria"), "Ryan Gloria");
  assert.equal(techKey("third party"), "3rd Party");
  assert.equal(techKey("  Someone New "), "Someone New");
  assert.equal(techKey("   "), NO_TECH);
  assert.equal(techKey(null), NO_TECH);
});

test("only the day's open work is collected", () => {
  const stops = collectDayStops(
    {
      services: [
        ticket({ id: 1 }),
        ticket({ id: 2, status: "Completed" }),
        ticket({ id: 3, done: true }),
        ticket({ id: 4, scheduled: OTHER }),
        ticket({ id: 5, duplicateOf: 1 }),
        ticket({ id: 6, status: "Phone Resolved" }),
        ticket({ id: 7, scheduled: null }),
      ],
      tlcs: [ticket({ id: 20 }), ticket({ id: 21, status: "Cancelled" })],
      pms: [pm({ id: 30 }), pm({ id: 31, status: "Cancelled" }), pm({ id: 32, done: true }), pm({ id: 33, projected: OTHER })],
      installs: [install({ id: 40 }), install({ id: 41, complete: true }), install({ id: 42, equipStatus: "Installed" }), install({ id: 43, installDate: OTHER })],
    },
    DAY,
  );
  assert.deepEqual(stops.map((s) => s.key).sort(), ["install-40", "pm-30", "service-1", "tlc-20"]);
  const tlc = stops.find((s) => s.key === "tlc-20");
  assert.equal(tlc.type, "tlc");
  assert.equal(tlc.ticket, "C-1");
  assert.deepEqual(typeCounts(stops), { service: 1, tlc: 1, pm: 1, install: 1 });
});

test("a ticket's secondary tech gets the stop too, marked 2nd tech", () => {
  const stops = collectDayStops(
    {
      ...none,
      services: [
        ticket({ id: 1, technician: "Ryan Gloria", secondaryTech: "charles foster" }),
        ticket({ id: 2, technician: "Ryan Gloria", secondaryTech: "ryan gloria" }), // same person: no copy
        ticket({ id: 3, technician: null, secondaryTech: "Oliver Garcia" }),
      ],
    },
    DAY,
  );
  const byKey = new Map(stops.map((s) => [s.key, s]));
  assert.equal(stops.length, 5);
  assert.deepEqual(
    { tech: byKey.get("service-1").tech, partner: byKey.get("service-1").partner, second: byKey.get("service-1").second },
    { tech: "Ryan Gloria", partner: "Charles Foster", second: false },
  );
  assert.deepEqual(
    { tech: byKey.get("service-1-2nd").tech, partner: byKey.get("service-1-2nd").partner, second: byKey.get("service-1-2nd").second, id: byKey.get("service-1-2nd").id },
    { tech: "Charles Foster", partner: "Ryan Gloria", second: true, id: 1 },
  );
  assert.equal(byKey.has("service-2-2nd"), false);
  assert.equal(byKey.get("service-3").tech, NO_TECH);
  assert.equal(byKey.get("service-3-2nd").tech, "Oliver Garcia");
  // Counts count the job once.
  assert.equal(typeCounts(stops).service, 3);
  assert.equal(crewLabel(byKey.get("service-1")), "Ryan Gloria + Charles Foster");
  assert.equal(crewLabel(byKey.get("service-3")), "Unassigned + Oliver Garcia");
});

test("stops find their account pin, or say why they are not on the map", () => {
  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [
          ticket({ id: 1, customer: "steak 48 " }),
          ticket({ id: 2, customer: "No Pin Cafe" }),
          ticket({ id: 3, customer: "Mystery Bar" }),
          ticket({ id: 4, customer: null }),
        ],
      },
      DAY,
    ),
    find,
  );
  const by = new Map(placed.map((s) => [s.id, s]));
  assert.deepEqual(by.get(1).point, GALLERIA);
  assert.equal(by.get(1).accountId, 11);
  assert.equal(by.get(1).missing, null);
  assert.equal(by.get(2).missing, "no-pin");
  assert.equal(by.get(2).point, null);
  assert.equal(by.get(3).missing, "no-account");
  assert.equal(by.get(4).missing, "no-account");
  assert.equal(by.get(4).customer, "Untitled");
  assert.equal(MISSING_LABEL["no-pin"], "No map pin for this account");
  assert.equal(MISSING_LABEL["no-account"], "No account matches this customer name");
});

test("routes: roster order, others by name, Unassigned last; 3rd Party gets no route", () => {
  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [
          ticket({ id: 1, technician: "Zed Temp", customer: "Steak 48" }),
          ticket({ id: 2, technician: null, customer: "MARQ*E" }),
          ticket({ id: 3, technician: "3rd Party", customer: "Common Bond Tanglewood" }),
          ticket({ id: 4, technician: "Charles Foster", customer: "Katy Diner" }),
          ticket({ id: 5, technician: "Ryan Gloria", customer: "Steak 48" }),
          ticket({ id: 6, technician: "Al Extra", customer: "Steak 48" }),
        ],
      },
      DAY,
    ),
    find,
  );
  const routes = planTechRoutes(placed, ["Ryan Gloria", "Charles Foster", "3rd Party"]);
  assert.deepEqual(
    routes.map((r) => r.label),
    ["Ryan Gloria", "Charles Foster", "3rd Party", "Al Extra", "Zed Temp", "Unassigned"],
  );
  const third = routes.find((r) => r.tech === "3rd Party");
  assert.equal(third.routed, false);
  assert.deepEqual(third.links, []);
  assert.equal(third.miles, 0);
  assert.equal(third.stops.length, 1);
  assert.equal(third.stops[0].legMiles, null);
  const unassigned = routes.at(-1);
  assert.equal(unassigned.tech, NO_TECH);
  assert.equal(unassigned.routed, false);
  assert.deepEqual(unassigned.links, []);
  const ryan = routes[0];
  assert.equal(ryan.routed, true);
  assert.equal(ryan.links.length, 1);
  assert.match(ryan.links[0], /destination=29\.741468,-95\.452042/);
  assert.doesNotMatch(ryan.links[0], /origin=/, "no origin: Google starts from the phone's location");
});

test("routes: stops with no pin are listed as not on the map, not routed", () => {
  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [ticket({ id: 1, customer: "Steak 48" }), ticket({ id: 2, customer: "No Pin Cafe" }), ticket({ id: 3, customer: "Mystery Bar" })],
      },
      DAY,
    ),
    find,
  );
  const [ryan] = planTechRoutes(placed, ["Ryan Gloria"]);
  assert.deepEqual(ryan.stops.map((s) => s.id), [1]);
  assert.deepEqual(ryan.unrouted.map((s) => [s.id, s.missing]), [
    [3, "no-account"],
    [2, "no-pin"],
  ]);
  assert.equal(ryan.links.length, 1);
  assert.doesNotMatch(ryan.links[0], /Nowhere/);
});

test("routes: promised times keep their order; untimed stops slot in by distance", () => {
  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [
          ticket({ id: 1, customer: "Katy Diner", scheduledTime: "14:00" }),
          ticket({ id: 2, customer: "Steak 48", scheduledTime: "9:00" }),
          ticket({ id: 3, customer: "Common Bond Tanglewood" }), // untimed, next to the Galleria
          ticket({ id: 4, customer: "MARQ*E", scheduledTime: "11:30" }),
        ],
      },
      DAY,
    ),
    find,
  );
  const [ryan] = planTechRoutes(placed, ["Ryan Gloria"]);
  const timed = ryan.stops.filter((s) => s.time).map((s) => s.time);
  assert.deepEqual(timed, ["09:00", "11:30", "14:00"]);
  assert.deepEqual(ryan.stops.map((s) => s.n), [1, 2, 3, 4]);
  // Tanglewood sits between the Galleria (9a) and MARQ*E (11:30a), not after Katy.
  assert.deepEqual(ryan.stops.map((s) => s.id), [2, 3, 4, 1]);
  assert.equal(ryan.stops[0].legMiles, null);
  assert.ok(ryan.stops[1].legMiles > 1 && ryan.stops[1].legMiles < 2.5, String(ryan.stops[1].legMiles));
  const sum = ryan.stops.reduce((t, s) => t + (s.legMiles ?? 0), 0);
  assert.ok(Math.abs(sum - ryan.miles) < 1e-9);
  assert.equal(stopTime(ryan.stops[0].time), "9a");
  assert.equal(stopTime(ryan.stops[2].time), "11:30a");
});

test("ZIP-area pins are never stop locations: not ordered, not on the line, not in the link; listed as not on the map", () => {
  assert.deepEqual(linkStop({ point: GALLERIA, quality: "exact" }), GALLERIA);
  assert.deepEqual(linkStop({ point: TANGLEWOOD, quality: "close" }), TANGLEWOOD);
  // Neither a ZIP-area pin nor the typed address goes to Google.
  assert.equal(linkStop({ point: KATY, quality: "approx", address: " 2 Main St, Katy, TX 77494 " }), null);
  assert.equal(linkStop({ point: SUGAR_LAND, quality: "approx", address: null }), null);
  assert.equal(linkStop({ point: null, quality: null, address: "9 Nowhere Ln" }), null);
  assert.equal(MISSING_LABEL["zip-area"], "ZIP area only: no pin for the street address");

  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [
          ticket({ id: 1, customer: "Steak 48", scheduledTime: "08:00" }),
          ticket({ id: 2, customer: "Katy Zip Diner", scheduledTime: "10:00" }),
          ticket({ id: 3, customer: "Sugar Land Grill", scheduledTime: "12:00" }),
          ticket({ id: 4, customer: "Unknown Match Bar" }),
          ticket({ id: 5, customer: "Common Bond Tanglewood", technician: null }),
          ticket({ id: 6, customer: "Katy Zip Diner", technician: null }),
        ],
      },
      DAY,
    ),
    find,
  );
  const by = new Map(placed.map((s) => [s.id, s]));
  // The account is still found (for its Address Report link), but the ZIP-area pin is dropped.
  assert.deepEqual([by.get(2).accountId, by.get(2).point, by.get(2).quality, by.get(2).missing], [17, null, "approx", "zip-area"]);
  assert.deepEqual([by.get(3).accountId, by.get(3).point, by.get(3).missing], [15, null, "zip-area"]);
  assert.equal(by.get(4).point, null);
  assert.notEqual(by.get(4).missing, null);

  const [ryan, unassigned] = planTechRoutes(placed, ["Ryan Gloria"]);
  assert.equal(ryan.tech, "Ryan Gloria");
  assert.deepEqual(ryan.stops.map((s) => [s.id, s.n]), [[1, 1]]);
  assert.deepEqual(ryan.unrouted.map((s) => [s.id, s.missing]), [
    [2, "zip-area"],
    [3, "zip-area"],
    [4, by.get(4).missing],
  ]);
  assert.equal(ryan.miles, 0);
  assert.equal(ryan.links.length, 1);
  const url = new URL(ryan.links[0]);
  assert.equal(url.searchParams.get("destination"), "29.741468,-95.452042");
  assert.equal(url.searchParams.get("waypoints"), null);
  assert.doesNotMatch(ryan.links[0], /Main|29\.7858|29\.5994|29\.76,/);
  // Lists that are not routed follow the same rule.
  assert.equal(unassigned.tech, NO_TECH);
  assert.deepEqual(unassigned.stops.map((s) => s.id), [5]);
  assert.deepEqual(unassigned.unrouted.map((s) => [s.id, s.missing]), [[6, "zip-area"]]);
  // By Area: off the map too.
  const { areas, unplaced } = planAreas(placed);
  assert.deepEqual(areas.flatMap((a) => a.stops.map((s) => s.id)).sort(), [1, 5]);
  assert.deepEqual(unplaced.map((s) => s.id).sort(), [2, 3, 4, 6]);
  // A day with only ZIP-area stops gets no link at all.
  const [zipOnly] = planTechRoutes(placed.filter((s) => s.id === 2 || s.id === 3), ["Ryan Gloria"]);
  assert.deepEqual([zipOnly.stops.length, zipOnly.unrouted.length, zipOnly.links.length], [0, 2, 0]);
});

test("route links: two jobs in a row at one place are one stop; long days split into legs", () => {
  const p = { point: GALLERIA, quality: "exact", address: null };
  assert.equal(new URL(routeLinks([p, p])[0]).searchParams.get("waypoints"), null);
  const many = Array.from({ length: 12 }, (_, i) => ({ point: { lat: 29.7 + i * 0.01, lng: -95.4 }, quality: "exact", address: null }));
  const links = routeLinks(many);
  assert.equal(links.length, 2);
  const leg2 = new URL(links[1]);
  assert.equal(leg2.searchParams.get("origin"), new URL(links[0]).searchParams.get("destination"));
  assert.deepEqual(routeLinks([]), []);
});

test("areas: one row per job, biggest area first, with techs and unassigned work", () => {
  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [
          ticket({ id: 1, customer: "Steak 48", technician: "Ryan Gloria", secondaryTech: "Charles Foster" }),
          ticket({ id: 2, customer: "Common Bond Tanglewood", technician: "Oliver Garcia" }),
          ticket({ id: 3, customer: "MARQ*E", technician: null }),
          ticket({ id: 4, customer: "Katy Diner", technician: "Ryan Gloria" }),
          ticket({ id: 5, customer: "No Pin Cafe", technician: null }),
        ],
      },
      DAY,
    ),
    find,
  );
  const { areas, unplaced } = planAreas(placed);
  assert.deepEqual(
    areas.map((a) => [a.label, a.stops.length]),
    [
      ["Houston", 3],
      ["Katy", 1],
    ],
  );
  const houston = areas[0];
  assert.deepEqual(houston.techs, ["Charles Foster", "Oliver Garcia", "Ryan Gloria"]);
  assert.equal(houston.unassigned, 1);
  assert.equal(houston.stops.at(-1).tech, NO_TECH, "unassigned rows last");
  assert.equal(houston.stops.filter((s) => s.id === 1).length, 1, "two-tech ticket shows once");
  assert.deepEqual(unplaced.map((s) => s.id), [5]);
});

test("colors: fixed palette by roster position; unassigned is gray", () => {
  assert.deepEqual(techOrder(["Ryan Gloria", "charles foster"], ["Zed", "Charles Foster", "Al", ""]), ["Ryan Gloria", "Charles Foster", "Al", "Zed"]);
  const colors = techColors(["Ryan Gloria", "Charles Foster"], ["Zed"]);
  assert.equal(colorOfTech(colors, "Ryan Gloria"), REP_PALETTE[0]);
  assert.equal(colorOfTech(colors, "Charles Foster"), REP_PALETTE[1]);
  assert.equal(colorOfTech(colors, "Zed"), REP_PALETTE[2]);
  assert.equal(colorOfTech(colors, NO_TECH), NO_REP_COLOR);
  assert.equal(colorOfTech(colors, "Nobody Known"), NO_REP_COLOR);
});

test("labels", () => {
  assert.equal(stopTime(null), "Any time");
  assert.equal(stopTime("13:30"), "1:30p");
  assert.equal(stopCount(1), "1 stop");
  assert.equal(stopCount(4), "4 stops");
  assert.equal(milesNote(23.4), "about 23 mi straight-line");
});

test("an empty day plans nothing", () => {
  assert.deepEqual(collectDayStops(none, DAY), []);
  assert.deepEqual(planTechRoutes([], ["Ryan Gloria"]), []);
  assert.deepEqual(planAreas([]), { areas: [], unplaced: [] });
});

test("starting from the shop: first leg is measured from the shop, links start there, order can change", () => {
  const services = [
    ticket({ id: 1, customer: "Katy Diner", technician: "Ryan Gloria" }),
    ticket({ id: 2, customer: "Steak 48", technician: "Ryan Gloria" }),
  ];
  const placed = placeStops(collectDayStops({ ...none, services }, DAY), find);
  const here = planTechRoutes(placed, ["Ryan Gloria"])[0];
  const shop = planTechRoutes(placed, ["Ryan Gloria"], KATZ_SHOP)[0];
  assert.equal(here.stops.length, 2);
  assert.equal(shop.stops.length, 2);
  assert.equal(here.stops[0].legMiles, null);
  assert.ok(shop.stops[0].legMiles > 0);
  // The shop (Karbach St) is much closer to the Galleria than to Katy, so the Galleria stop comes first.
  assert.equal(shop.stops[0].customer, "Steak 48");
  assert.ok(shop.miles > 0);
  const q = new URL(shop.links[0]).searchParams;
  assert.equal(q.get("origin"), "29.808821,-95.461210");
  assert.equal(new URL(here.links[0]).searchParams.get("origin"), null);
});

test("drive minutes reorder untimed stops, and a set time keeps its slot", () => {
  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [
          ticket({ id: 1, customer: "Katy Diner", scheduledTime: "14:00" }),
          ticket({ id: 2, customer: "Steak 48", scheduledTime: "9:00" }),
          ticket({ id: 3, customer: "Common Bond Tanglewood" }),
          ticket({ id: 4, customer: "MARQ*E", scheduledTime: "11:30" }),
        ],
      },
      DAY,
    ),
    find,
  );
  const near = (p, q) => Math.abs(p.lat - q.lat) < 0.02 && Math.abs(p.lng - q.lng) < 0.02;
  // Tanglewood is a short hop only from Katy. The timed stops stay a cheap hop from each other,
  // so the untimed stop is added after the 2pm stop instead of beside the Galleria.
  const drive = (a, b) => {
    const katyTangle = (near(a, KATY) && near(b, TANGLEWOOD)) || (near(a, TANGLEWOOD) && near(b, KATY));
    const timedHop =
      [GALLERIA, MARQE, KATY].some((p) => near(a, p)) && [GALLERIA, MARQE, KATY].some((p) => near(b, p));
    if (katyTangle) return { minutes: 4, miles: 12 };
    if (timedHop) return { minutes: 8, miles: 6 };
    return { minutes: 40, miles: 18 };
  };
  const plain = planTechRoutes(placed, ["Ryan Gloria"])[0];
  const ryan = planTechRoutes(placed, ["Ryan Gloria"], null, { drive })[0];
  assert.deepEqual(
    ryan.stops.filter((s) => s.time).map((s) => s.time),
    ["09:00", "11:30", "14:00"],
  );
  assert.deepEqual(ryan.stops.map((s) => s.customer), ["Steak 48", "MARQ*E", "Katy Diner", "Common Bond Tanglewood"]);
  assert.notDeepEqual(
    plain.stops.map((s) => s.id),
    ryan.stops.map((s) => s.id),
  );
  assert.equal(ryan.drive, true);
  assert.equal(ryan.stops.at(-1).legMinutes, 4);
  assert.ok(ryan.minutes > 0);
  assert.equal(routeNote(ryan.minutes, ryan.miles, true).includes("min"), true);
  const missed = planTechRoutes(placed, ["Ryan Gloria"], KATZ_SHOP, { drive: () => null })[0];
  const shop = planTechRoutes(placed, ["Ryan Gloria"], KATZ_SHOP)[0];
  assert.deepEqual(
    missed.stops.map((s) => s.id),
    shop.stops.map((s) => s.id),
  );
  assert.equal(missed.drive, false);
  assert.equal(missed.minutes, null);
  const manual = planTechRoutes(placed, ["Ryan Gloria"], null, { manual: { "Ryan Gloria": ["service-1", "service-2", "service-4", "service-3"] } })[0];
  assert.deepEqual(manual.stops.map((s) => s.id), [1, 2, 4, 3]);
  assert.equal(manual.drive, false);
  assert.deepEqual(arrangeStops([{ key: "b" }, { key: "a" }, { key: "c" }], ["c", "a"]).map((s) => s.key), ["c", "a", "b"]);
  assert.equal(routeLinks(manual.stops).length, 1);
});

test("drive times are used only when every leg is known, otherwise the whole list is straight-line", () => {
  const placed = placeStops(
    collectDayStops(
      {
        ...none,
        services: [
          ticket({ id: 1, customer: "Katy Diner" }),
          ticket({ id: 2, customer: "Steak 48" }),
        ],
      },
      DAY,
    ),
    find,
  );
  const near = (p, q) => Math.abs(p.lat - q.lat) < 0.02 && Math.abs(p.lng - q.lng) < 0.02;
  const partial = (a, b) => {
    if (near(a, KATY) && near(b, GALLERIA)) return null;
    return { minutes: 1, miles: 99 };
  };
  const plain = planTechRoutes(placed, ["Ryan Gloria"])[0];
  const mixed = planTechRoutes(placed, ["Ryan Gloria"], null, { drive: partial })[0];
  assert.deepEqual(
    mixed.stops.map((s) => s.id),
    plain.stops.map((s) => s.id),
  );
  assert.equal(mixed.drive, false);
  assert.equal(mixed.minutes, null);
  assert.ok(mixed.stops.every((s) => s.legMinutes == null));
  assert.equal(mixed.miles, plain.miles);
});

// A drive table built the way route-planner.tsx builds it: one pin per pointKey (5 decimals), the start first.
function tableDrive(placed, start) {
  const pts = [];
  for (const s of placed) if (s.point && !pts.some((p) => pointKey(p) === pointKey(s.point))) pts.push(s.point);
  const points = [start.point, ...pts.filter((p) => pointKey(p) !== pointKey(start.point))];
  const grid = (f) => points.map((a, i) => points.map((b, j) => (i === j ? 0 : f(milesBetween(a, b)))));
  const legs = legsFromTable(points, { seconds: grid((mi) => (mi * 2.5 + 2) * 60), meters: grid((mi) => mi * 1609.344) });
  return (a, b) => driveBetween(legs, a, b);
}

test("two accounts in one building keep drive minutes, and pins that round alike don't break the route", () => {
  const day = (accounts) => {
    const byName = new Map(accounts.map((a, i) => [a.name.toLowerCase(), { id: 900 + i, quality: "exact", address: null, city: "Houston", ...a }]));
    const services = accounts.map((a, i) => ticket({ id: i + 1, customer: a.name }));
    return placeStops(collectDayStops({ ...none, services }, DAY), (n) => byName.get(n.toLowerCase()));
  };
  // Real pins at The Post (401 Franklin): 0.3 m apart, so the drive table keeps only one of them.
  const post = day([
    { name: "Jackson's Brew", lat: 29.765379615726, lng: -95.366225875392 },
    { name: "Shakkar", lat: 29.76537668, lng: -95.36622609 },
    { name: "Steak 48", ...GALLERIA },
    { name: "Katy Diner", ...KATY },
  ]);
  const route = planTechRoutes(post, ["Ryan Gloria"], KATZ_SHOP, { drive: tableDrive(post, KATZ_SHOP) })[0];
  assert.equal(route.drive, true);
  assert.ok(route.stops.every((s) => s.legMinutes != null));
  assert.ok(route.minutes > 0);
  // Aa sorts first. Bb and Cc are each within 1e-7 of Aa but not of each other, and all three share one pointKey.
  const rab = day([
    { name: "Aa", lat: 29.7000001, lng: -95.4 },
    { name: "Bb", lat: 29.70000004, lng: -95.4 },
    { name: "Cc", lat: 29.70000016, lng: -95.4 },
    { name: "Far", lat: 29.8, lng: -95.5 },
  ]);
  assert.doesNotThrow(() => planTechRoutes(rab, ["Ryan Gloria"], KATZ_SHOP, { drive: tableDrive(rab, KATZ_SHOP) }));
});

test("current location orders from the pin but the Maps link leaves the origin off", () => {
  const placed = placeStops(
    collectDayStops({ ...none, services: [ticket({ id: 2, customer: "Steak 48" })] }, DAY),
    find,
  );
  const here = { key: "here", label: "Current location", point: { lat: 29.76, lng: -95.37 } };
  const route = planTechRoutes(placed, ["Ryan Gloria"], here)[0];
  assert.ok(route.stops[0].legMiles > 0);
  assert.equal(new URL(route.links[0]).searchParams.get("origin"), null);
  assert.equal(routeStartNote(here), "Starts from your current location.");
  assert.equal(routeStartNote(KATZ_SHOP), "Starts from the Shop (2400 Karbach St).");
  assert.equal(routeStartNote(null).includes("current location"), true);
});

test("Undo of a Move on a two-tech ticket's main copy puts the 2nd tech back too", () => {
  const [main, second] = collectDayStops({ installs: [], pms: [], services: [ticket({ id: 7, technician: "Ryan Gloria", secondaryTech: "Jose Garcia" })], tlcs: [] }, DAY);
  // Moving Ryan's copy to nobody, or onto Jose, clears or promotes the 2nd tech on the server.
  for (const to of [NO_TECH, "Jose Garcia"]) {
    const w = moveWrites(main, main.tech, to);
    assert.deepEqual(w.forward, { id: 7, technician: to || null });
    assert.deepEqual(w.undo, { id: 7, technician: "Ryan Gloria", secondaryTech: "Jose Garcia" });
  }
  assert.deepEqual(moveWrites(second, second.tech, NO_TECH), { forward: { id: 7, secondaryTech: null }, undo: { id: 7, secondaryTech: "Jose Garcia" } });
  const [solo] = collectDayStops({ installs: [], pms: [], services: [ticket({ id: 8 })], tlcs: [] }, DAY);
  assert.deepEqual(moveWrites(solo, solo.tech, "Jose Garcia").undo, { id: 8, technician: "Ryan Gloria", secondaryTech: null });
  const [visit] = collectDayStops({ installs: [], pms: [pm({ id: 9 })], services: [], tlcs: [] }, DAY);
  assert.deepEqual(moveWrites(visit, visit.tech, NO_TECH), { forward: { id: 9, technician: null }, undo: { id: 9, technician: "Ryan Gloria" } });
});
