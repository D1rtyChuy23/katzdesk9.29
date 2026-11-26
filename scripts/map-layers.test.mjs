// Map layers (Chuy, 11/26): Terrain and elevation for everyone; Population by ZIP and Prospect places for Admin and
// Sales. Places and accounts here are made up; the ZIP rows are the real public Census file the layer ships with.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const market = await import("../src/lib/ops/market-map.ts");
const places = await import("../src/lib/ops/places.ts");
const elevation = await import("../src/lib/ops/elevation.ts");
const { listZipStatsFor, canUseMarketLayers, MARKET_REFUSAL } = await import("../src/lib/ops/market-api.ts");

const ZIP_FILE = readFileSync(new URL("../src/lib/ops/census/zip-stats.txt", import.meta.url), "utf8");
const HOUSTON = { south: 29.6, west: -95.6, north: 29.9, east: -95.2 };

test("the ZIP file parses: every U.S. ZIP area once, with real downtown Houston figures", () => {
  const rows = market.parseZipStats(ZIP_FILE);
  assert.ok(rows.length > 33_000, `${rows.length} ZIP areas`);
  assert.equal(new Set(rows.map((r) => r.zip)).size, rows.length, "no ZIP twice");
  const z = rows.find((r) => r.zip === "77002");
  assert.deepEqual(
    { population: z.population, income: z.income, cafes: z.cafes, restaurants: z.restaurants, hotels: z.hotels },
    { population: 19616, income: 85436, cafes: 24, restaurants: 191, hotels: 18 },
  );
  assert.ok(Math.abs(z.lat - 29.757) < 0.01 && Math.abs(z.lng + 95.366) < 0.01);
  assert.equal(rows.find((r) => r.zip === "77204").income, null, "a campus ZIP with no income estimate reads as none, not 0");
  assert.ok(rows.every((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.population >= 0));
});

test("ZIPs in a box: most people first, capped, empty areas left out; a bad box is refused", () => {
  const rows = market.parseZipStats(ZIP_FILE);
  const { zips, truncated } = market.zipsIn(rows, HOUSTON, 10);
  assert.equal(zips.length, 10);
  assert.equal(truncated, true);
  assert.ok(zips.every((z, i) => i === 0 || zips[i - 1].population >= z.population));
  assert.ok(zips.every((z) => market.inBounds(z, HOUSTON) && z.population > 0));
  assert.equal(market.cleanBounds({ south: 30, west: -95, north: 29, east: -94 }), null, "south above north");
  assert.equal(market.cleanBounds({ south: "29", west: -95, north: 30, east: -94 }), null);
  assert.equal(market.inBounds({ lat: 0, lng: 179.5 }, { south: -1, west: 179, north: 1, east: -179 }), true, "a box across the date line");
});

test("density colors, circle sizes and ZIPs from addresses", () => {
  assert.equal(market.density({ population: 1000, sqmi: 2 }), 500);
  assert.equal(market.density({ population: 900, sqmi: 0.01 }), null, "a one-building ZIP has no density");
  assert.equal(market.densityColor(100), market.DENSITY_STEPS[0].color);
  assert.equal(market.densityColor(12_000), market.DENSITY_STEPS[4].color);
  assert.equal(market.zipRadius(0), 4);
  assert.equal(market.zipRadius(60_000), 22);
  assert.equal(market.zipRadius(500_000), 22, "capped");
  assert.equal(market.zipFromAddress("502 Texas Ave, Houston, TX 77002-1234"), "77002");
  assert.equal(market.zipFromAddress("1 Main St Suite 20000, Houston TX 77010"), "77010", "the last ZIP after a state, not a suite number");
  assert.equal(market.zipFromAddress("12345 Westheimer Rd, Houston"), null, "a street number is not a ZIP");
  assert.equal(market.zipFromAddress("Katy 77494"), "77494");
  assert.equal(market.zipFromAddress(null), null);
});

test("only Admin (or the owner flag) and Sales get the ZIP figures", async () => {
  const pg = new PGlite();
  const MIGRATIONS = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
      ('u-owner', 'chuy', true, true, null), ('u-admin', 'ana', true, false, 'admin'), ('u-sales', 'sam', true, false, 'Sales'),
      ('u-tech', 'tom', true, false, 'service'), ('u-wh', 'wes', true, false, 'warehouse'), ('u-wait', 'wren', false, false, 'sales')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async () => [], { query });
  const all = market.parseZipStats(ZIP_FILE);
  for (const id of ["u-owner", "u-admin", "u-sales"]) {
    assert.equal(await canUseMarketLayers(sql, id), true, id);
    const r = await listZipStatsFor(sql, id, HOUSTON, all);
    assert.ok(r.zips.length > 50 && r.zips.some((z) => z.zip === "77002"), id);
    assert.match(r.source, /Census Bureau/);
  }
  for (const id of ["u-tech", "u-wh", "u-wait", "u-nobody"]) {
    assert.equal(await canUseMarketLayers(sql, id), false, id);
    await assert.rejects(listZipStatsFor(sql, id, HOUSTON, all), new RegExp(MARKET_REFUSAL), id);
  }
  await assert.rejects(listZipStatsFor(sql, "u-sales", { south: 31, west: -95, north: 30, east: -94 }, all), /could not be read/);
});

test("the Overpass query asks only for named places of the picked types in the box", () => {
  const q = places.overpassQuery({ south: 29.74, west: -95.4, north: 29.77, east: -95.36 }, ["coffee", "hotel", "restaurant"], 4000);
  assert.match(q, /^\[out:csv\(/);
  assert.match(q, /nwr\["amenity"~"\^\(cafe\|restaurant\)\$"\]\["name"\]\(29\.7400,-95\.4000,29\.7700,-95\.3600\);/);
  assert.match(q, /nwr\["shop"~"\^\(coffee\)\$"\]/);
  assert.match(q, /nwr\["tourism"~"\^\(hotel\|motel\)\$"\]/);
  assert.match(q, /out center 4000;$/);
  assert.doesNotMatch(q, /hospital|supermarket/);
});

const CSV = [
  "@type|@id|@lat|@lon|name|amenity|shop|tourism|cuisine|brand|addr:housenumber|addr:street|addr:city|addr:postcode|phone|contact:phone|website|contact:website|opening_hours",
  "node|1|29.7626|-95.3673|Bean There Cafe|cafe|||coffee_shop||502|Texas Avenue|Houston|77002|+1-713-555-0101||beanthere.example||Mo-Fr 07:00-15:00",
  "way|2|29.7600|-95.3600|Lone Star Kolaches|fast_food|||kolache;donut|||||77003-1111||+1 713 555 0102||https://kolache.example|",
  "node|3|29.7500|-95.3700|Morning Glory Donuts|fast_food|||burger||||||||||",
  "node|4|29.7550|-95.3650||cafe|||||||||||||",
  "relation|5|29.7210|-95.3430|Example University|university||||||||||||||",
  "node|6|29.7400|-95.3800|Shiny Car Lot||car||||||||||||",
  "node|7|29.7300|-95.3900|Some Office|||||||||||||||",
  "node|1|29.7626|-95.3673|Bean There Cafe|cafe|||||||||||||",
].join("\n");

test("Overpass CSV into places: named, in a category, once each, with tidy fields", () => {
  const rows = places.parseOverpassCsv(CSV);
  assert.deepEqual(
    rows.map((p) => [p.id, p.category]),
    [
      ["node/1", "coffee"],
      ["way/2", "bakery"],
      ["node/3", "fastfood"],
      ["relation/5", "college"],
      ["node/6", "cardealer"],
    ],
    "unnamed (4) and uncategorized (7) are skipped, the repeat of 1 too; a kolache place is a bakery; a burger place is fast food",
  );
  const bean = rows[0];
  assert.equal(bean.street, "502 Texas Avenue");
  assert.equal(places.placeAddress(bean), "502 Texas Avenue, Houston 77002");
  assert.equal(bean.phone, "+1-713-555-0101");
  assert.equal(places.websiteUrl(bean.website), "https://beanthere.example");
  assert.equal(rows[1].phone, "+1 713 555 0102", "contact:phone is used when phone is empty");
  assert.equal(rows[1].zip, "77003");
  assert.equal(places.websiteUrl("javascript:alert(1)"), null);
  assert.equal(places.websiteUrl("ftp://x.example"), null);
  assert.deepEqual(places.parseOverpassCsv("<html>busy</html>"), []);
  assert.equal(places.osmUrl("way/2"), "https://www.openstreetmap.org/way/2");
});

test("a place that is already an account: same name close by, or the same street address", () => {
  const accounts = [
    { id: 10, name: "Bean There Coffee Co.", lat: 29.7627, lng: -95.3675, address: "500 Texas Ave, Houston, TX 77002", rep: "Rosa" },
    { id: 11, name: "Lone Star Holdings LLC", lat: 29.7601, lng: -95.3601, address: "1200 Main St, Houston TX 77003", rep: null },
    { id: 12, name: "Star Cinema Grill - Cypress", lat: 29.9700, lng: -95.6900, address: "9 Cypress Way", rep: "Gabe" },
    { id: 13, name: "Bean There Cafe", lat: 29.80, lng: -95.30, address: "far away", rep: "Rosa" },
  ];
  const list = [
    { id: "node/1", name: "Bean There Cafe", category: "coffee", lat: 29.7626, lng: -95.3673, street: "502 Texas Avenue" },
    { id: "node/2", name: "Kolache Corner", category: "bakery", lat: 29.7600, lng: -95.3600, street: "1200 Main Street" },
    { id: "node/3", name: "Star Cinema Grill", category: "cinema", lat: 29.9702, lng: -95.6901, street: null },
    { id: "node/4", name: "Brand New Bistro", category: "restaurant", lat: 29.7626, lng: -95.3673, street: "77 Other St" },
  ];
  const m = places.matchAccounts(list, accounts);
  assert.deepEqual([m.get("node/1")?.account.id, m.get("node/1")?.how], [10, "name"], "same name words (Coffee Co. and Cafe are generic), 20 m apart; the far Bean There is not it");
  assert.deepEqual([m.get("node/2")?.account.id, m.get("node/2")?.how], [11, "address"], "different names, same street address: flagged, not taken as the account");
  assert.deepEqual([m.get("node/3")?.account.id, m.get("node/3")?.how], [12, "name"], "Star Cinema Grill starts Star Cinema Grill - Cypress");
  assert.equal(m.has("node/4"), false, "a new name next door is a prospect");
  assert.equal(places.sameName("The Coffee House", "Coffee Shop"), false, "names made only of generic words fall back to all words");
  assert.equal(places.sameStreet("502 Texas Avenue", "502 Texas Ave, Houston"), true);
  assert.equal(places.sameStreet("502 N Texas Ave", "502 Texas Ave"), true);
  assert.equal(places.sameStreet("502 Texas Ave", "503 Texas Ave"), false);
  const near = places.nearestRep({ lat: 29.7626, lng: -95.3673 }, accounts);
  assert.equal(near.account.id, 10, "the nearest account with a rep (11 is nearer to some places but has none)");
});

test("which part of the map still needs asking for; the box grows and snaps", () => {
  const view = { south: 29.75, west: -95.4, north: 29.77, east: -95.36 };
  const box = places.padBounds(view);
  assert.ok(box.south < view.south && box.north > view.north && box.west < view.west && box.east > view.east);
  assert.ok([box.south, box.west, box.north, box.east].every((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6), "on a 0.01° grid");
  const done = [{ bounds: box, categories: ["coffee", "hotel"] }];
  assert.deepEqual(places.missingCategories(view, ["coffee", "hotel"], done), []);
  assert.deepEqual(places.missingCategories(view, ["coffee", "college"], done), ["college"], "a newly picked type");
  assert.deepEqual(places.missingCategories({ ...view, east: -95.0 }, ["coffee"], done), ["coffee"], "a part not seen yet");
});

test("the prospect list: one row per place with the nearest account and the nearest rep; tidy phone numbers", () => {
  const p = { id: "node/9", name: "=Cafe Formula", category: "coffee", lat: 29.1, lng: -95.1, street: "1 A St", city: "Houston", zip: "77002", phone: "+1-713-555-0101", website: "x.example" };
  const accounts = [
    { id: 1, name: "Next Door", lat: 29.1005, lng: -95.1, address: null, rep: null },
    { id: 2, name: "Up The Road", lat: 29.13, lng: -95.1, address: null, rep: "Rosa" },
  ];
  const rows = places.prospectRows([p], accounts);
  assert.deepEqual(rows[0], ["=Cafe Formula", "Coffee Shops & Cafés", "1 A St", "Houston", "77002", "(713) 555-0101", "https://x.example", "29.100000", "-95.100000", "Next Door", "0.0", "Rosa", "https://www.openstreetmap.org/node/9"]);
  assert.equal(rows[0].length, places.PROSPECT_COLUMNS.length);
  assert.deepEqual(places.prospectRows([p], [])[0].slice(9, 12), ["", "", ""], "no accounts at all");
  assert.equal(places.formatPhone("+1 832-618-1149"), "(832) 618-1149");
  assert.equal(places.formatPhone("7135550101;+1 713 555 0102"), "(713) 555-0101", "the first of several");
  assert.equal(places.formatPhone("+44 20 7946 0958"), "+44 20 7946 0958", "not U.S.: as listed");
  assert.equal(places.formatPhone(""), null);
});

test("elevation: the right tile and pixel, and terrarium heights", () => {
  const px = elevation.elevationPixel(29.7604, -95.3698, 13);
  assert.deepEqual([px.x, px.y], [1925, 3386], "downtown Houston at zoom 13 (checked with the standard tile formula)");
  assert.ok(px.px >= 0 && px.px < 256 && px.py >= 0 && px.py < 256);
  assert.equal(elevation.decodeTerrarium(128, 0, 0), 0, "sea level");
  assert.equal(elevation.decodeTerrarium(128, 16, 0), 16);
  assert.equal(elevation.decodeTerrarium(132, 116, 128), 1140.5, "about El Paso");
  assert.equal(elevation.elevationLabel(16), "About 52 ft (16 m)");
  assert.equal(elevation.elevationLabel(0.5), "About sea level");
  assert.equal(elevation.elevationLabel(null), "Not available");
  assert.equal(elevation.terrariumUrl(13, 1925, 3386), "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/1925/3386.png");
});

test("the place types: unique ids, the five starting ones, and every tag points back to its type", () => {
  const ids = places.PLACE_CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(places.DEFAULT_PLACE_CATEGORIES, ["coffee", "bakery", "restaurant", "hotel", "college"]);
  for (const c of places.PLACE_CATEGORIES) {
    for (const [key, values] of Object.entries(c.tags)) for (const v of values) assert.equal(places.categoryOf({ [key]: v }), c.id, `${key}=${v}`);
  }
});

test("saved place answers: a week at most, well formed only, newest kept", () => {
  const now = Date.UTC(2026, 10, 26);
  const day = 86_400_000;
  const entry = (at, extra = {}) => ({ bounds: { south: 29, west: -96, north: 30, east: -95 }, categories: ["coffee"], at, places: [], ...extra });
  const raw = JSON.stringify([
    entry(now - 8 * day),
    entry(now - 2 * day),
    entry(now - day, { categories: ["not-a-type"] }),
    entry(now - day, { bounds: { south: 29 } }),
    { junk: true },
    entry(now - 1000),
  ]);
  assert.deepEqual(places.readPlaceCache(raw, now).map((e) => e.at), [now - 2 * day, now - 1000]);
  assert.deepEqual(places.readPlaceCache("not json", now), []);
  assert.deepEqual(places.readPlaceCache(null, now), []);
  const many = JSON.stringify(Array.from({ length: 40 }, (_, i) => entry(now - 40 + i)));
  const kept = places.readPlaceCache(many, now);
  assert.equal(kept.length, places.PLACE_CACHE_MAX);
  assert.equal(kept.at(-1).at, now - 1, "the newest are kept");
});

test("a restaurant that also lists coffee stays a restaurant; a fast-food coffee or donut place does not", () => {
  assert.equal(places.categoryOf({ amenity: "restaurant", cuisine: "french;coffee_shop" }), "restaurant");
  assert.equal(places.categoryOf({ amenity: "fast_food", cuisine: "coffee_shop" }), "coffee");
  assert.equal(places.categoryOf({ amenity: "fast_food", cuisine: "donut" }), "bakery");
  assert.equal(places.categoryOf({ amenity: "fast_food", cuisine: "burger" }), "fastfood");
  assert.equal(places.categoryOf({ amenity: "bench" }), null);
});

test("review follow-ups: tenants of one address, one-word names, donut and coffee fast food, spreadsheet text", () => {
  // Fable review 11/26: a strip center's account must not hide its neighbors.
  const center = [{ id: 20, name: "Nobu", lat: 29.7383, lng: -95.4630, address: "5085 Westheimer Rd Ste 100, Houston, TX 77056", rep: "Rosa" }];
  const tenants = [
    { id: "node/20", name: "Nobu Houston", category: "restaurant", lat: 29.7384, lng: -95.4631, street: "5085 Westheimer Road" },
    { id: "node/21", name: "Shake Shack", category: "fastfood", lat: 29.7385, lng: -95.4629, street: "5085 Westheimer Road" },
  ];
  const m = places.matchAccounts(tenants, center);
  assert.equal(m.get("node/20")?.how, "name");
  assert.equal(m.get("node/21")?.how, "address", "the neighbor is only flagged as the same address, so it stays a prospect");
  // One distinguishing word is not enough unless it starts the other name.
  assert.equal(places.sameName("Cafe Express", "Panda Express"), false);
  assert.equal(places.sameName("Texas A&M", "M Bar"), false);
  assert.equal(places.sameName("Hilton Houston", "Hilton Garden Inn Houston"), false);
  assert.equal(places.sameName("Starbucks", "Starbucks - Heights Blvd"), true);
  assert.equal(places.sameName("Black Rock - Pearland", "Black Rock Coffee Bar"), true);
  // The query asks for what categoryOf files under Coffee and Bakeries.
  const q = places.overpassQuery({ south: 29, west: -96, north: 30, east: -95 }, ["bakery"]);
  assert.match(q, /nwr\["amenity"="fast_food"\]\["cuisine"~"coffee\|donut\|bakery\|kolache",i\]\["name"\]/);
  assert.doesNotMatch(places.overpassQuery({ south: 29, west: -96, north: 30, east: -95 }, ["hotel"]), /fast_food/);
  assert.equal(places.categoryOf({ amenity: "fast_food", cuisine: "donut;coffee_shop" }), "bakery", "a donut shop that sells coffee");
  assert.equal(places.categoryOf({ amenity: "fast_food", cuisine: "coffee_shop;breakfast" }), "coffee");
  // Formula-looking names stay text in the download.
  const row = places.prospectRows([{ id: "node/1", name: "-2+HYPERLINK(\"x\")", category: "coffee", lat: 29, lng: -95, street: "\t=1+1", city: "Houston", zip: null, phone: null, website: null }], [])[0];
  assert.equal(row[0], "'-2+HYPERLINK(\"x\")");
  assert.equal(row[2], "'\t=1+1");
  assert.equal(row[8], "-95.000000", "a negative longitude is a number, left alone");
});

test("ZIP requests by zoom: fewer circles and a coarser box zoomed out; the server keeps the limit in range", async () => {
  assert.deepEqual(market.zipRequest(7), { limit: 600, snap: 1 });
  assert.deepEqual(market.zipRequest(9.5), { limit: 1500, snap: 0.25 });
  assert.deepEqual(market.zipRequest(13), { limit: market.ZIP_LIMIT, snap: 0.02 });
  for (let z = 7; z < 18; z += 0.5) assert.ok(market.zipRequest(z).limit >= market.zipRequest(z - 0.5).limit, "never fewer when zooming in");
  const texas = places.padBounds({ south: 26, west: -106, north: 36, east: -94 }, 0.25, 1);
  assert.deepEqual(texas, { south: 23, west: -109, north: 39, east: -91 }, "a whole-degree grid");
  const all = market.parseZipStats(ZIP_FILE);
  const pg = new PGlite();
  const MIGRATIONS = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-sales', 'sam', true, false, 'sales')");
  const sql = Object.assign(async () => [], { query: async (text, params) => (await pg.query(text, params)).rows });
  const r = await listZipStatsFor(sql, "u-sales", texas, all, 600);
  assert.equal(r.zips.length, 600);
  assert.equal(r.truncated, true);
  assert.equal((await listZipStatsFor(sql, "u-sales", texas, all, 99_999)).zips.length, market.ZIP_LIMIT, "capped");
});
