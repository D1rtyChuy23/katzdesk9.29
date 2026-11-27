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
const { listZipStatsFor, listPlacesFor, canUseMarketLayers, MARKET_REFUSAL } = await import("../src/lib/ops/market-api.ts");

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

test("the prospect list: one row per place with the nearest account and the nearest rep; tidy phone numbers", () => {
  const p = { id: "node/9", name: "=Cafe Formula", category: "coffee", lat: 29.1, lng: -95.1, street: "1 A St", city: "Houston", zip: "77002", phone: "+1-713-555-0101", website: "x.example" };
  const accounts = [
    { id: 1, name: "Next Door", lat: 29.1005, lng: -95.1, address: null, rep: null },
    { id: 2, name: "Up The Road", lat: 29.13, lng: -95.1, address: null, rep: "Rosa" },
  ];
  const rows = places.prospectRows([p], accounts);
  assert.deepEqual(rows[0], ["=Cafe Formula", "Coffee Shops & Cafés", "1 A St", "Houston", "77002", "(713) 555-0101", "https://x.example", "29.100000", "-95.100000", "Next Door", "0.0", "Rosa", "https://www.google.com/search?q=%3DCafe%20Formula%201%20A%20St%20Houston%2077002"]);
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

test("review follow-ups: tenants of one address, one-word names, spreadsheet text", async () => {
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
  // Formula-looking names stay text in the download.
  const row = places.prospectRows([{ id: "node/1", name: "-2+HYPERLINK(\"x\")", category: "coffee", lat: 29, lng: -95, street: "\t=1+1", city: "Houston", zip: null, phone: null, website: null }], [])[0];
  const { toCsv } = await import("../src/lib/ops/customer-export.ts");
  const line = toCsv(places.PROSPECT_COLUMNS, [row]).split("\r\n")[1];
  assert.ok(line.startsWith(`"'-2+HYPERLINK(""x"")",`), line);
  assert.ok(line.includes(",'\t=1+1,"), "a tab then = stays text");
  assert.ok(line.includes(",-95.000000,"), "a negative longitude is a number, left alone");
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

// ---- Prospects from the bundled Overture files (11/27)

const TILE_DIR = new URL("../src/lib/ops/places-tiles/", import.meta.url);
const tileFiles = readdirSync(TILE_DIR).filter((n) => n.endsWith(".tsv"));
const readTile = async (key) => {
  try {
    return places.parsePlaceTile(readFileSync(new URL(`${key}.tsv`, TILE_DIR), "utf8"));
  } catch {
    return [];
  }
};

test("a place file: header, one place per line; a row with no name, an unknown type or bad numbers is skipped", () => {
  const head = places.PLACE_TILE_COLUMNS.join("\t");
  const text = [
    head,
    "abc123\tBean There\tcoffee\tcoffee roastery\t29.76263\t-95.36730\t502 Texas Ave\tHouston\t77002\t+17135550101\tbeanthere.example\t\t0.97",
    "abc124\t\tcoffee\t\t29.7\t-95.3\t\t\t\t\t\t\t0.9",
    "abc125\tMystery\tspaceport\t\t29.7\t-95.3\t\t\t\t\t\t\t0.9",
    "abc126\tNo Spot\tbar\t\tnorth\t-95.3\t\t\t\t\t\t\t0.9",
    "short\trow",
  ].join("\n");
  const rows = places.parsePlaceTile(text);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    id: "abc123", name: "Bean There", category: "coffee", kind: "coffee roastery", lat: 29.76263, lng: -95.3673, street: "502 Texas Ave",
    city: "Houston", zip: "77002", phone: "+17135550101", website: "beanthere.example", brand: null, confidence: 0.97,
  });
  assert.equal(places.formatPhone(rows[0].phone), "(713) 555-0101");
});

test("squares and boxes: the files a box needs, and the places in it, surest first, capped", () => {
  assert.equal(places.placeTileKey(29.76, -95.37), "29_-96");
  assert.equal(places.placeTileKey(30, -95), "30_-95");
  assert.deepEqual(places.placeTilesFor({ south: 29.5, west: -95.5, north: 30.2, east: -94.8 }), { keys: ["29_-96", "29_-95", "30_-96", "30_-95"], capped: false });
  const state = places.placeTilesFor({ south: 25, west: -107, north: 37, east: -93 });
  assert.deepEqual([state.keys.length, state.capped], [places.PLACE_TILES_MAX, true], "a whole-state box is capped, and says so");
  const mk = (id, category, lat, confidence) => ({ id, name: id, category, kind: null, lat, lng: -95.4, street: null, city: null, zip: null, phone: null, website: null, brand: null, confidence });
  const all = [mk("a", "coffee", 29.7, 0.6), mk("b", "coffee", 29.71, 0.99), mk("c", "hotel", 29.72, 0.9), mk("d", "coffee", 31, 0.99)];
  const r = places.placesIn(all, { south: 29.6, west: -95.5, north: 29.8, east: -95.3 }, ["coffee"], 1);
  assert.deepEqual([r.places.map((p) => p.id), r.total], [["b"], 2], "the surest coffee shop in the box; the hotel and the far one left out");
  // Fable review 11/27: ties go by the (random) id, not the name, so a cut-off list is not just the A's.
  const tied = [mk("f3", "coffee", 29.7, 0.9), { ...mk("0a", "coffee", 29.7, 0.9), name: "Zed" }, { ...mk("9c", "coffee", 29.7, 0.9), name: "Aardvark" }];
  assert.deepEqual(places.placesIn(tied, { south: 29, west: -96, north: 30, east: -95 }, ["coffee"]).places.map((p) => p.id), ["0a", "9c", "f3"]);
  // Search: name, brand, kind or street, any case.
  const shop = { ...mk("s1", "coffee", 29.7, 0.9), name: "Joe's", brand: "Starbucks", kind: "coffee roastery", street: "12141 Richmond Ave" };
  for (const q of ["joe", "STARBUCKS", "roastery", "richmond", ""]) assert.ok(places.placeFitsSearch(shop, q), q);
  assert.equal(places.placeFitsSearch(shop, "hilton"), false);
  assert.ok(places.containsBounds({ south: 29, west: -96, north: 30, east: -95 }, { south: 29.2, west: -95.8, north: 29.9, east: -95.1 }));
  assert.equal(places.containsBounds({ south: 29, west: -96, north: 30, east: -95 }, { south: 29.2, west: -95.8, north: 30.1, east: -95.1 }), false);
});

test("the bundled files: every row parses, ids are unique, every place sits in its own square in Texas, every type has places", () => {
  assert.ok(tileFiles.length > 50, `${tileFiles.length} files`);
  const ids = new Set();
  const byType = new Map();
  let total = 0;
  for (const f of tileFiles) {
    const text = readFileSync(new URL(f, TILE_DIR), "utf8");
    assert.equal(text.split("\n")[0], places.PLACE_TILE_COLUMNS.join("\t"), f);
    const lines = text.split("\n").filter(Boolean).length - 1;
    const rows = places.parsePlaceTile(text);
    assert.equal(rows.length, lines, `${f}: every line is a place`);
    const key = f.replace(/\.tsv$/, "");
    for (const p of rows) {
      assert.equal(places.placeTileKey(p.lat, p.lng), key, `${p.id} sits in ${key}`);
      assert.ok(p.lat > 25.8 && p.lat < 36.6 && p.lng > -106.7 && p.lng < -93.4, `${p.id} in Texas`);
      assert.ok(!ids.has(p.id), `${p.id} once`);
      ids.add(p.id);
      byType.set(p.category, (byType.get(p.category) ?? 0) + 1);
      assert.ok(p.confidence >= 0.55 && p.confidence <= 1);
      assert.ok(!/\t|\n/.test(p.name));
    }
    total += rows.length;
  }
  assert.ok(total > 150_000, `${total} places`);
  for (const c of places.PLACE_CATEGORIES) assert.ok((byType.get(c.id) ?? 0) > 100, `${c.label}: ${byType.get(c.id) ?? 0}`);
});

test("the bundled files: big chains are Fast Food, lodge halls are not hotels, doctors are not hospitals, ZIPs are Texas ones", () => {
  const bad = [];
  for (const f of tileFiles) {
    for (const p of places.parsePlaceTile(readFileSync(new URL(f, TILE_DIR), "utf8"))) {
      if (p.category === "restaurant" && /^(subway|mcdonald|burger king|whataburger|taco bell|chick-fil-a)\b/i.test(p.name)) bad.push(`chain as restaurant: ${p.name}`);
      if (p.category === "hotel" && /\b(masonic|elks lodge|a\.?f\.? ?& ?a\.?m)\b/i.test(p.name)) bad.push(`lodge hall as hotel: ${p.name}`);
      if (p.category === "hospital" && /,\s*(md|do|np)\.?$/i.test(p.name)) bad.push(`doctor as hospital: ${p.name}`);
      if (p.zip && !/^(7[5-9]|885|733)/.test(p.zip)) bad.push(`ZIP ${p.zip}: ${p.name}`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test("prospects come from our server, for Admin and Sales only, and downtown Houston has coffee shops and hotels", async () => {
  const pg = new PGlite();
  const MIGRATIONS = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
      ('u-owner', 'chuy', true, true, null), ('u-sales', 'sam', true, false, 'sales'), ('u-tech', 'tom', true, false, 'service'),
      ('u-wh', 'wes', true, false, 'warehouse'), ('u-wait', 'wren', false, false, 'sales')`,
  );
  const sql = Object.assign(async () => [], { query: async (text, params) => (await pg.query(text, params)).rows });
  const downtown = { south: 29.745, west: -95.38, north: 29.77, east: -95.355 };
  const r = await listPlacesFor(sql, "u-sales", { ...downtown, categories: ["coffee", "hotel"] }, readTile);
  assert.ok(r.places.length > 20, `${r.places.length} coffee shops and hotels downtown`);
  assert.ok(r.places.every((p) => (p.category === "coffee" || p.category === "hotel") && market.inBounds(p, downtown)));
  assert.match(r.source, /Overture/);
  const capped = await listPlacesFor(sql, "u-owner", { south: 29.5, west: -95.8, north: 30.1, east: -95.0, categories: ["restaurant"], limit: 50 }, readTile);
  assert.deepEqual([capped.places.length, capped.truncated], [50, true]);
  assert.ok(capped.total > 1000);
  assert.deepEqual((await listPlacesFor(sql, "u-sales", { ...downtown, categories: ["not-a-type"] }, readTile)).places, []);
  for (const who of ["u-tech", "u-wh", "u-wait", "u-nobody"]) await assert.rejects(listPlacesFor(sql, who, { ...downtown, categories: ["coffee"] }, readTile), new RegExp(MARKET_REFUSAL), who);
  // The search is applied before the cap: every Starbucks in the area, not just the ones among the first 50.
  const sb = await listPlacesFor(sql, "u-sales", { south: 29.5, west: -95.8, north: 30.1, east: -95.0, categories: ["coffee"], limit: 50, q: "starbucks" }, readTile);
  assert.ok(sb.places.length > 30 && sb.places.every((p) => places.placeFitsSearch(p, "starbucks")), `${sb.places.length} Starbucks`);
  await assert.rejects(listPlacesFor(sql, "u-sales", { south: 31, west: -95, north: 30, east: -94, categories: ["coffee"] }, readTile), /could not be read/);
});
