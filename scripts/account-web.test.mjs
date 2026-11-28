// Web Check (Chuy, 11/27): each account against the bundled business listings (Overture), closed ones included.
// Accounts here are made up; the listings in the last tests are the real bundled ones.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const web = await import("../src/lib/ops/account-web.ts");
const places = await import("../src/lib/ops/places.ts");
const { webChecksFor } = await import("../src/lib/ops/account-web-api.ts");
const { buildSuggestions } = await import("../src/lib/ops/address-report.ts");

const place = (id, name, lat, lng, extra = {}) => ({
  id, name, category: "restaurant", kind: null, lat, lng, street: null, city: "Houston", zip: "77002", phone: null, website: null, brand: null, confidence: 0.9, closed: false, ...extra,
});
const acct = (name, lat, lng, address = null) => ({ name, lat, lng, address });

test("listed at our pin: same address, or another one", () => {
  const p = place("p1", "Bean There Cafe", 29.7626, -95.3673, { street: "502 Texas Ave" });
  assert.equal(web.webCheck(acct("Bean There Coffee Co.", 29.7627, -95.3674, "502 Texas Avenue, Houston, TX 77002"), [p]).status, "same");
  const moved = web.webCheck(acct("Bean There Coffee Co.", 29.7627, -95.3674, "410 Main St, Houston, TX 77002"), [p]);
  assert.deepEqual([moved.status, moved.place.id, moved.listedAddress], ["different", "p1", "502 Texas Ave, Houston, TX 77002"]);
  assert.equal(web.webCheck(acct("Bean There", 29.7627, -95.3674, null), [p]).status, "same", "no address of ours to compare: the listing stands");
  assert.equal(web.webCheck(acct("Bean There", 29.7627, -95.3674, "410 Main St"), [{ ...p, street: null }]).status, "same", "a listing without a street");
});

test("closed at our pin; moved; a chain; nothing; no pin", () => {
  const closed = place("c1", "Marigold Grill", 29.7, -95.4, { closed: true, street: "1 A St" });
  assert.equal(web.webCheck(acct("Marigold Grill", 29.7001, -95.4001, "1 A St"), [closed]).status, "closed");
  // Closed here, open again 3 miles away: it moved.
  const reopened = place("o1", "Marigold Grill", 29.74, -95.4, { street: "9 B St" });
  const m = web.webCheck(acct("Marigold Grill", 29.7001, -95.4001, "1 A St"), [closed, reopened]);
  assert.deepEqual([m.status, m.place.id], ["elsewhere", "o1"]);
  assert.ok(m.miles > 2.5 && m.miles < 3, `${m.miles} mi`);
  // Our pin has nothing; the only listing under our name is 3 miles off: moved, or our pin is wrong.
  assert.equal(web.webCheck(acct("Marigold Grill", 29.7001, -95.4001, "1 A St"), [reopened]).status, "elsewhere");
  // A chain: three open stores around, none at our pin. Cannot tell which is ours.
  const chain = [0.03, 0.06, 0.09].map((d, i) => place(`s${i}`, "Starbucks", 29.7 + d, -95.4));
  assert.equal(web.webCheck(acct("Starbucks - Main St", 29.7, -95.4, "5 C St"), chain).status, "none");
  assert.equal(web.webCheck(acct("Starbucks - Main St", 29.73, -95.4, "5 C St"), chain).status, "same", "a chain store at our pin is ours");
  // A street pin is trusted more: 3 miles still counts, 15 does not; a ZIP-area pin looks out to 25 miles.
  const fifteen = place("f15", "Marigold Grill", 29.92, -95.4, { street: "9 B St" });
  assert.equal(web.webCheck(acct("Marigold Grill", 29.7, -95.4, "1 A St"), [fifteen]).status, "none");
  assert.equal(web.webCheck({ ...acct("Marigold Grill", 29.7, -95.4, "1 A St"), approx: true }, [fifteen]).status, "elsewhere");
  // Too far (over 25 miles) or another name: nothing.
  assert.equal(web.webCheck(acct("Marigold Grill", 29.7, -95.4), [place("far", "Marigold Grill", 30.2, -95.4)]).status, "none");
  assert.equal(web.webCheck(acct("Panda Express", 29.7, -95.4), [place("x", "Cafe Express", 29.7, -95.4)]).status, "none");
  assert.equal(web.webCheck(acct("Marigold Grill", null, null), [closed]).status, "nopin");
});

test("addresses, the card line and the lookup word", () => {
  assert.equal(web.listedAddress({ street: "502 Texas Ave", city: "Houston", zip: "77002" }), "502 Texas Ave, Houston, TX 77002");
  assert.equal(web.listedAddress({ street: "502 Texas Ave", city: null, zip: null }), null, "no city or ZIP: not offered");
  assert.equal(web.listedAddress({ street: "1432 W 13TH ST", city: "HOUSTON", zip: "77008" }), "1432 W 13th St, Houston, TX 77008");
  assert.equal(web.listedAddress({ street: "1432 W 13th St, Houston, TX 77008-6511, United States", city: "Houston", zip: "77008" }), null, "a street that already holds the city");
  assert.equal(web.listedAddress({ street: "1705 Calle San Javier", city: "San Juan", zip: "00926" }), null, "not a Texas ZIP");
  assert.equal(web.listedAddress({ street: null, city: "Houston", zip: "77002" }), null);
  const p = place("p", "Gone Grill", 29.74, -95.4, { street: "9 B St" });
  assert.equal(web.webCheckLine({ status: "elsewhere", place: p, miles: 2.76, listedAddress: null }), "Listed somewhere else: 9 B St, Houston 77002 (2.8 mi from our pin)");
  assert.equal(web.webCheckLine({ status: "none", place: null, miles: null, listedAddress: null }), "No listing found");
  assert.equal(web.lookupWord("Black Rock - Pearland"), "black");
  assert.equal(web.lookupWord("The Coffee House"), null, "a name of kind words only says nothing about which business: never looked up");
});

test("the Address Report offers a web listing's address, after the others and never twice", () => {
  const s = buildSuggestions({ address: "410 Main St, Houston, TX 77002", geocodeAddress: null, invoices: ["9 Bill St, Houston, TX 77002"], web: "502 Texas Ave, Houston, TX 77002" });
  assert.deepEqual(s.map((x) => x.source), ["Invoice bill-to", "Web listing"]);
  const dup = buildSuggestions({ address: "410 Main St", geocodeAddress: null, cleanList: ["502 Texas Ave, Houston, TX 77002"], web: "502 Texas Ave, Houston, TX 77002" });
  assert.deepEqual(dup.map((x) => x.source), ["Clean list"], "the same address once, under the first source");
  assert.deepEqual(buildSuggestions({ address: "502 Texas Ave, Houston, TX 77002", geocodeAddress: null, web: "502 Texas Ave, Houston, TX 77002" }), [], "ours already");
});

// ---- Real listings

const TILE_DIR = new URL("../src/lib/ops/places-tiles/", import.meta.url);
const readTile = async (key) => {
  try {
    return places.parsePlaceTile(readFileSync(new URL(`${key}.tsv`, TILE_DIR), "utf8"));
  } catch {
    return [];
  }
};

test("real listings: a closed bakery, a restaurant three miles from our pin, a Starbucks at our pin, a made-up name", async () => {
  const input = [
      { id: 1, name: "Allendale Parisian Bakery", address: "5455 Allendale Rd Ste D, Houston, TX 77017", lat: 29.6838, lng: -95.2396, approx: false },
      { id: 2, name: "Hugo's", address: "1600 Westheimer Rd, Houston, TX 77006", lat: 29.77, lng: -95.39, approx: false },
      { id: 3, name: "Starbucks - Richmond Ave", address: "12141 Richmond Ave, Houston, TX 77082", lat: 29.72925, lng: -95.5944, approx: false },
      { id: 4, name: "Zzyzx Made Up Coffee", address: "1 Nowhere Ln", lat: 29.76, lng: -95.37, approx: false },
      { id: 5, name: "No Pin Cafe", address: null, lat: null, lng: null, approx: false },
  ];
  const rows = await webChecksFor(input, readTile);
  const by = new Map(rows.map((r) => [r.id, r.check]));
  assert.equal(by.get(1).status, "closed", "Overture marks it permanently closed");
  assert.equal(by.get(2).status, "elsewhere");
  assert.equal(by.get(2).listedAddress, "1600 Westheimer Rd, Houston, TX 77006");
  assert.ok(by.get(2).miles > 1.5 && by.get(2).miles < 3, `${by.get(2).miles} mi`);
  assert.equal(by.get(3).status, "same");
  assert.match(by.get(3).place.phone ?? "", /\d{10}/, "the listing brings its phone");
  assert.equal(by.get(4).status, "none");
  assert.equal(by.get(5).status, "nopin");
  // One account at a time (an account card) looks through the listings without the index: the same answers.
  for (const a of input) {
    const [one] = await webChecksFor([a], readTile);
    assert.deepEqual([one.check.status, one.check.place?.id], [by.get(a.id).status, by.get(a.id).place?.id], a.name);
  }
});

test("closed places are never prospects", async () => {
  const all = await readTile("29_-96");
  const closed = all.filter((p) => p.closed);
  assert.ok(closed.length > 500, `${closed.length} closed in Houston's square`);
  const { places: shown } = places.placesIn(all, { south: 29, west: -96, north: 30, east: -95 }, places.PLACE_CATEGORIES.map((c) => c.id), 1_000_000);
  assert.equal(shown.filter((p) => p.closed).length, 0);
  assert.equal(shown.length, all.length - closed.length);
});

test("away from our pin, a listing whose name adds words is another business", () => {
  const hugos = [place("h1", "Hugo's", 29.743, -95.3997), place("h2", "Hugo's Cocina", 29.95, -95.33), place("h3", "Hugo's Italian Grill & Pizza", 30.1, -95.54)];
  assert.equal(web.webCheck(acct("Hugo's", 29.77, -95.39), hugos).status, "elsewhere", "only the plain Hugo's counts");
  const br = place("b1", "Black Rock Coffee Bar", 29.6, -95.28);
  assert.equal(web.webCheck(acct("Black Rock - Pearland", 29.56, -95.28), [br]).status, "elsewhere", "our name adds the place; theirs only what it is");
});

test("listed elsewhere at our own address: the pin is off, and no address is offered", () => {
  const h = place("h1", "Hugo's", 29.743, -95.3997, { street: "1600 Westheimer Rd", zip: "77006" });
  const c = web.webCheck(acct("Hugo's", 29.77, -95.39, "1600 Westheimer Road, Houston, TX 77006"), [h]);
  assert.deepEqual([c.status, c.sameAddress], ["elsewhere", true]);
  assert.match(web.webCheckLine(c), /map pin looks off/);
  const d = web.webCheck(acct("Hugo's", 29.77, -95.39, "900 Other St"), [h]);
  assert.deepEqual([d.status, d.sameAddress], ["elsewhere", false]);
});

test("names: our location suffix and generic words aside, every word must match, and one short word is not enough", () => {
  const same = (a, b) => web.sameBusiness(a, b);
  assert.equal(same("Black Rock Coffee Bar", "Black Rock - Pearland"), true);
  assert.equal(same("Starbucks", "Starbucks (Richmond Ave)"), true);
  assert.equal(same("Common Bond Cafe & Bakery", "Common Bond @ Heights"), true);
  assert.equal(same("Common Bond Bistro", "Common Bond @ Heights"), false, "\"Bistro\" is a word of theirs we do not have");
  assert.equal(same("La Bar", "La Sicilia Italian Bakery & Cafe"), false);
  assert.equal(same("Casa", "Casa del Fuego"), false);
  assert.equal(same("Hugo's Cocina", "Hugo's"), false);
  assert.equal(same("R&B Tea", "Tea Top"), false);
  assert.equal(same("El Rey Taqueria", "El Rey"), false, "one word, under five letters");
  assert.equal(same("Atc", "ATC"), false, "one short word");
  assert.equal(same("Urban", "Urban Bricks Pizza"), false);
});

test("streets: house number and street, routes by their number; none without a house number", () => {
  assert.equal(web.streetKey("502 N Texas Avenue, Houston"), web.streetKey("502 Texas Ave"));
  assert.equal(web.streetKey("1234 Farm to Market 1960"), web.streetKey("1234 FM 1960 Rd"));
  assert.notEqual(web.streetKey("1234 FM 1960"), web.streetKey("1234 FM 2920"));
  assert.equal(web.streetKey("502-A Texas Ave"), web.streetKey("502 Texas Ave"));
  for (const no of ["Southwest Fwy", "One University Way", "The Galleria, 5015 Westheimer Rd", "", null]) assert.equal(web.streetKey(no), null, String(no));
  assert.equal(web.sameStreetAddress("Southwest Fwy", "502 Texas Ave"), null);
  assert.equal(web.listedAddress({ street: "Southwest Fwy", city: "Houston", zip: "77002" }), null, "a listing without a house number is never offered");
  // At our pin, a listing without a house number is no evidence of another address.
  const p = place("p1", "Bean There Cafe", 29.7626, -95.3673, { street: "Southwest Fwy" });
  assert.equal(web.webCheck(acct("Bean There", 29.7627, -95.3674, "502 Texas Ave"), [p]).status, "same");
});

test("not listed at our pin: a namesake with one short word is not us; two at the pin, the one on our street wins", () => {
  assert.equal(web.webCheck(acct("Ole", 29.7, -95.4, "1 A St"), [place("o", "Ole", 29.74, -95.4, { street: "9 B St" })]).status, "none");
  const ours = place("a", "Marigold Grill", 29.7003, -95.4, { street: "1 A St" });
  const other = place("b", "Marigold Grill", 29.7001, -95.4, { street: "77 Z St" });
  const c = web.webCheck(acct("Marigold Grill", 29.7, -95.4, "1 A Street, Houston"), [other, ours]);
  assert.deepEqual([c.status, c.place.id, c.sameAddress], ["same", "a", true]);
});

test("a listed address is offered in the form the Address Report approves (tidied), and a 13-column tile still reads", async () => {
  const { tidyAddress } = await import("../src/lib/ops/address-report.ts");
  const a = web.listedAddress({ street: "502 texas avenue", city: "houston", zip: "77002" });
  assert.equal(a, tidyAddress(a), "already tidy: approve compares it as offered");
  const s = buildSuggestions({ address: "410 Main St, Houston, TX 77002", geocodeAddress: null, web: a });
  assert.deepEqual(s.map((x) => x.address), [a]);
  const row13 = ["x1", "Old Row Cafe", "coffee", "", "29.7", "-95.4", "1 A St", "Houston", "77002", "", "", "", "0.9"].join("\t");
  const parsed = places.parsePlaceTile(places.PLACE_TILE_COLUMNS.slice(0, 13).join("\t") + "\n" + row13);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].closed, false);
});

test("second review: different kinds, one-letter words, chains, our own address first, ZIPs, approve wording", () => {
  const same = (a, b) => web.sameBusiness(a, b);
  // Kind words must agree, and one-letter words count.
  for (const [a, b] of [
    ["Edinburg Inn And Suites", "Edinburg H-E-B"],
    ["University Inn", "Texas A&M University - Brayton Fire Training Field"],
    ["Texas de Brazil", "Cafe Brazil"],
    ["Garden Inn", "The Coffee Garden"],
    ["Brownsville Coffee Shop", "Texas Inn Brownsville Hotel"],
    ["Social Cafe", "Social House"],
    ["J O Motors Llc", "C & D Motors"],
    ["G & T Auto Sales", "A&B Auto Sales"],
    ["M & P Motors", "C & D Motors"],
  ])
    assert.equal(same(a, b), false, `${a} / ${b}`);
  assert.equal(same("Katz Coffee", "Katz Coffee - Heights"), true, "one short word with the same kind");
  assert.equal(same("Bean There Cafe", "Bean There Coffee Co."), true, "a café is a coffee shop");
  // A chain: two other stores within 25 miles plus a third, or any store carrying a brand.
  const pin = acct("Domino's", 29.7, -95.4, "943 N Expressway");
  const branded = place("d1", "Domino's", 29.73, -95.4, { brand: "Domino's Pizza", street: "3355 Boca Chica Blvd" });
  assert.equal(web.webCheck(pin, [branded]).status, "none", "a brand");
  const stores = [0.03, 0.2, 0.3].map((d, i) => place(`m${i}`, "Marigold Grill", 29.7 + d, -95.4, { street: `${i + 10} B St` }));
  assert.equal(web.webCheck(acct("Marigold Grill", 29.7, -95.4, "1 A St"), stores).status, "none", "three stores, two of them past the street pin's reach");
  // Our own address 0.3 miles off beats another store a block away (and is our site: "same").
  const near = place("n", "Starbucks", 29.701, -95.4, { street: "822 Town And Country Blvd", zip: "77024" });
  const ours = place("o", "Starbucks", 29.7045, -95.4, { street: "12850 Memorial Dr", zip: "77024" });
  const c = web.webCheck(acct("Starbucks", 29.7, -95.4, "12850 Memorial Dr, Houston, TX 77024"), [near, ours]);
  assert.deepEqual([c.status, c.place.id, c.sameAddress], ["same", "o", true]);
  // Our address a mile off: the pin is off.
  const mileOff = web.webCheck(acct("Starbucks", 29.7, -95.4, "12850 Memorial Dr, Houston, TX 77024"), [near, { ...ours, lat: 29.715 }]);
  assert.deepEqual([mileOff.status, mileOff.place.id, mileOff.sameAddress], ["elsewhere", "o", true]);
  // The same street in another ZIP is another address.
  assert.equal(web.sameStreetAddress("100 N Main St, Conroe, TX 77301", "100 Main St, Willis, TX 77378"), false);
  assert.equal(web.sameStreetAddress("100 N Main St, Conroe, TX 77301", "100 Main Street"), true, "one side without a ZIP");
});

test("streets: lettered and numbered streets, routes", () => {
  const k = web.streetKey;
  assert.notEqual(k("1901 Avenue Q"), k("1901 Avenue K"));
  assert.notEqual(k("1 A St"), k("1 B St"));
  assert.equal(k("1 A St"), "1 a");
  assert.equal(k("502-A Texas Ave"), k("502 Texas Ave"), "a unit letter is still not the street");
  assert.equal(k("100 State St"), "100 state");
  assert.equal(k("1200 TX-6"), k("1200 SH 6"));
  assert.equal(k("1200 State Highway 6"), k("1200 SH 6"));
  assert.equal(k("100 5th St"), k("100 Fifth St"));
  assert.equal(k("8 1/2 Main St"), "8 main");
  assert.notEqual(k("100 N Loop 1604 W"), k("100 Loop 410"));
  assert.equal(k("1834 FM2673"), k("1834 FM 2673"));
  assert.equal(k("1300 IH10 W"), k("1300 Interstate 10"));
});

test("approve takes the web listing's wording when another source offers the same address", () => {
  const webA = web.listedAddress({ street: "502 Texas Ave", city: "Houston", zip: "77002" });
  const s = buildSuggestions({ address: "410 Main St, Houston, TX 77002", geocodeAddress: null, invoices: ["502 TEXAS AVE, HOUSTON, TX 77002"], web: webA });
  assert.equal(s.length, 1);
  assert.notEqual(s[0].address, webA, "the invoice's wording is what the Address Report offers");
});

test("the squares read cover 25 miles at every Texas latitude", async () => {
  const { squaresAround } = await import("../src/lib/ops/account-web-api.ts");
  const { milesBetween } = await import("../src/lib/ops/geo.ts");
  for (let lat = 25.8; lat <= 36.6; lat += 0.2)
    for (const lng of [-106.4, -101.569, -100.01, -97.99, -94.1]) {
      const keys = new Set(squaresAround(lat, lng));
      // Points 25 miles away in eight directions all fall in a square that is read.
      for (let a = 0; a < 360; a += 45) {
        const r = (a * Math.PI) / 180;
        const p = { lat: lat + (24.9 / 69) * Math.cos(r), lng: lng + (24.9 / (69.17 * Math.cos((lat * Math.PI) / 180))) * Math.sin(r) };
        assert.ok(milesBetween({ lat, lng }, p) <= 25.2);
        assert.ok(keys.has(places.placeTileKey(p.lat, p.lng)), `${lat},${lng} → ${p.lat},${p.lng}`);
      }
    }
});

test("spot-check 11/27: a listing that carries our location without a dash; a big site at our address", async () => {
  assert.equal(web.sameBusiness("Tostada Regia Long Point", "Tostada Regia - Long Point"), true);
  assert.equal(web.sameBusiness("Tostada Regia Long Point", "Tostada Regia - Westheimer"), false, "another branch's location");
  assert.equal(web.sameBusiness("Tostada Regia Long Point", "Tostada Regia"), false, "a name without a location is not that branch");
  // Real listings: the Long Point branch at its own spot; the Houstonian 0.2 mi from a geocoded pin at its address.
  const rows = await webChecksFor(
    [
      { id: 1, name: "Tostada Regia - Long Point", address: "10066 Long Point Rd, Houston, TX 77055", lat: 29.79498, lng: -95.54279, approx: false },
      { id: 2, name: "The Houstonian Hotel, Club, and Spa", address: "111 N Post Oak Ln, Houston, TX 77024", lat: 29.76699, lng: -95.45756, approx: false },
    ],
    readTile,
  );
  assert.deepEqual([rows[0].check.status, rows[0].check.place?.name], ["same", "Tostada Regia Long Point"]);
  assert.deepEqual([rows[1].check.status, rows[1].check.sameAddress], ["same", true]);
  assert.match(web.webCheckLine(rows[1].check), /\((\d+ ft|0\.\d mi) from our pin\)$/);
  assert.equal(web.webCheckLine({ status: "same", place: rows[1].check.place, miles: 0.02, listedAddress: null, sameAddress: true }).endsWith("(100 ft from our pin)"), true);
  assert.doesNotMatch(web.webCheckLine(rows[1].check), /pin looks off/);
});

test("report rows and cards say the same distance from our pin", () => {
  assert.equal(web.pinDistance({ status: "same", miles: 0.05 }), "250 ft from our pin");
  assert.equal(web.pinDistance({ status: "same", miles: 0.19 }), "0.2 mi from our pin");
  assert.equal(web.pinDistance({ status: "elsewhere", miles: 2.76 }), "2.8 mi from our pin");
  assert.equal(web.pinDistance({ status: "different", miles: 0.05 }), null);
  assert.equal(web.pinDistance({ status: "none", miles: null }), null);
});

test("possible match: a listing at our pin with a similar name is shown, never offered", async () => {
  const may = web.possibleMatch;
  assert.equal(may("Elio's Osteria e Pizzeria", "Elio's Pizzeria & Bar. (Canyon Lake)"), true, "same first word and \"pizzeria\"");
  assert.equal(may("Niko Niko's Express", "Niko Niko's - Montrose"), true);
  assert.equal(may("Starbucks Reserve", "Starbucks"), true, "one-word name");
  assert.equal(may("Texas Roadhouse", "Texas Children's Hospital"), false, "only the first word in common");
  assert.equal(may("Black Bear Diner", "Black Rock - Pearland"), false);
  assert.equal(may("Ole Mole", "Ole Cafe"), false, "a first word under four letters");
  assert.equal(may("Houston Fire Station 62", "HFD Fire Station 062"), false, "another first word");
  assert.equal(may("Port Lavaca Ford", "Port Lavaca Dodge Chrysler Jeep Ram"), false, "a place name in common is not enough");
  assert.equal(may("West Houston Subaru", "West Houston Volkswagen"), false);
  assert.equal(may("Hampton Inn & Suites by Hilton Port Lavaca", "Hampton Inn & Suites Port Lavaca"), true);
  assert.equal(may("El Todo", "Todo Supermarket"), false, "a one-word name under five letters");
  // At our street pin: "maybe", with the listing's details and no address to offer.
  const elio = place("e1", "Elio's Osteria e Pizzeria", 29.84768, -98.17855, { street: "1834 FM2673", city: "Canyon Lake", zip: "78133" });
  const c = web.webCheck(acct("Elio's Pizzeria & Bar. (Canyon Lake)", 29.848, -98.1786, "1834 FM 2673, Canyon Lake, TX 78133"), [elio]);
  assert.deepEqual([c.status, c.place.id, c.listedAddress, c.sameAddress], ["maybe", "e1", null, true]);
  assert.match(web.webCheckLine(c), /^Possible match: Elio's Osteria e Pizzeria · 1834 FM2673, Canyon Lake 78133 \(\d+ ft from our pin\)\. The name differs from ours/);
  assert.match(web.webCheckLine(c), /Its street address is ours\.$/);
  // Not at our pin, or a ZIP-area pin: nothing.
  assert.equal(web.webCheck(acct("Elio's Pizzeria & Bar.", 29.86, -98.1786), [elio]).status, "none");
  assert.equal(web.webCheck({ ...acct("Elio's Pizzeria & Bar.", 29.848, -98.1786), approx: true }, [elio]).status, "none");
  // A listing under our name still wins over a possible one.
  const ours = place("o1", "Elio's Pizzeria", 29.848, -98.1786);
  assert.deepEqual(web.webCheck(acct("Elio's Pizzeria & Bar.", 29.848, -98.1786), [elio, ours]).place.id, "o1");
  // Real listings, one account at a time and many: the same answer.
  const a = { id: 9, name: "Elio's Pizzeria & Bar. (Canyon Lake)", address: "1834 FM 2673, Canyon Lake, TX 78133", lat: 29.8478, lng: -98.1787, approx: false };
  const [one] = await webChecksFor([a], readTile);
  const many = (await webChecksFor([a, { ...a, id: 10, name: "Zzyzx Made Up Coffee" }], readTile))[0];
  assert.deepEqual([one.check.status, one.check.place?.name], ["maybe", "Elio's Osteria e Pizzeria"]);
  assert.deepEqual([many.check.status, many.check.place?.name], ["maybe", "Elio's Osteria e Pizzeria"]);
});

test("store numbers: \"Boondocks Cafe #2\" is \"Boondocks Cafe\"", () => {
  assert.equal(web.sameBusiness("Boondocks Cafe", "Boondocks Cafe #2"), true);
  assert.equal(web.sameBusiness("Central Market", "Central Market #491"), true);
  assert.equal(web.sameBusiness("HONEY FARMS #858", "Honey Farms #851"), true, "another store number: a namesake, as for any chain");
  assert.equal(web.sameBusiness("Starbucks Coffee #1234", "Starbucks Coffee"), true);
  assert.equal(web.sameBusiness("Houston Fire Station 62", "Fire Station 62"), false, "a plain number is part of the name");
  // At our pin with another street address: listed at another address, and the listing's address is offered.
  const b = place("b1", "Boondocks Cafe", 29.7835, -95.5408, { street: "10999 W IH-10", zip: "77043" });
  const c = web.webCheck(acct("Boondocks Cafe #2", 29.7835, -95.5408, "8200 IH-10 W, Houston, TX 77024"), [b]);
  assert.deepEqual([c.status, c.sameAddress, c.listedAddress], ["different", false, "10999 W IH-10, Houston, TX 77043"]);
  // A possible match whose address differs says so.
  const u2 = place("u2", "Union", 29.7, -95.4, { street: "9 B St", zip: "77002" });
  const m2 = web.webCheck(acct("Union Coffee House Ministry", 29.7, -95.4, "1 A St, Houston, TX 77002"), [u2]);
  assert.deepEqual([m2.status, m2.sameAddress], ["maybe", false]);
  assert.match(web.webCheckLine(m2), /Its street address differs from ours too\.$/);
});

test("a ZIP-only difference is said as one, and offered only at our pin", () => {
  // Bar Loretta: our house number and street, another ZIP.
  const bl = place("bl", "Bar Loretta Restaurant", 29.4, -98.5, { street: "401 S Alamo St", city: "San Antonio", zip: "78204" });
  const at = web.webCheck(acct("Bar Loretta Restaurant", 29.4, -98.5, "401 S Alamo St, San Antonio, TX 78210"), [bl]);
  assert.deepEqual([at.status, at.sameAddress, at.zipOnly], ["different", false, { theirs: "78204", ours: "78210" }]);
  assert.match(web.webCheckLine(at), /Its street is ours, but its ZIP is 78204 \(ours 78210\)\.$/);
  assert.equal(web.offeredAddress(at), "401 S Alamo St, San Antonio, TX 78204", "at our pin: the same place, one ZIP is out of date");
  // As a possible match (the live case: the listing is "Bar Loretta", ours "Bar Loretta Restaurant").
  const blm = place("blm", "Bar Loretta", 29.4, -98.5, { street: "401 S Alamo St", zip: "78204" });
  const may = web.webCheck(acct("Bar Loretta Restaurant", 29.4, -98.5, "401 S Alamo St, San Antonio, TX 78210"), [blm]);
  assert.equal(may.status, "maybe");
  assert.equal(web.maybeAddressNote(may), "Its street is ours, but its ZIP is 78204 (ours 78210).");
  assert.doesNotMatch(web.webCheckLine(may), /differs from ours too/);
  // Somewhere else: our street in another ZIP is another town; nothing offered.
  const far = place("far", "Marigold Grill", 29.5, -95.4, { street: "100 Main St", zip: "77378" });
  const el = web.webCheck(acct("Marigold Grill", 29.4, -95.4, "100 Main St, Conroe, TX 77301"), [far]);
  assert.deepEqual([el.status, el.zipOnly], ["elsewhere", { theirs: "77378", ours: "77301" }]);
  assert.match(web.webCheckLine(el), /Its street is ours, but its ZIP is 77378 \(ours 77301\)\.$/);
  assert.equal(web.offeredAddress(el), null);
  // Another street altogether: as before.
  const other = web.webCheck(acct("Marigold Grill", 29.4, -95.4, "9 Oak St, Conroe, TX 77301"), [far]);
  assert.equal(other.zipOnly, null);
  assert.equal(web.offeredAddress(other), "100 Main St, Houston, TX 77378");
  assert.equal(web.maybeAddressNote({ sameAddress: false, zipOnly: null }), "Its street address differs from ours too.");
  assert.equal(web.maybeAddressNote({ sameAddress: true, zipOnly: null }), "Its street address is ours.");
  assert.equal(web.zipOnlyDifference("401 S Alamo St", "78204", "401 S Alamo St, San Antonio"), null, "no ZIP of ours to compare");
});

test("possible match: a one-word name, and the other name adds at most one word", () => {
  const may = web.possibleMatch;
  assert.equal(may("Popeyes Louisiana Kitchen", "Popeyes"), true, "\"Kitchen\" is a kind word: one word added");
  assert.equal(may("Velocity #5", "Velocity Sim Racing Lounge"), false, "numbered stores of another business");
  assert.equal(may("Cherry Block Smokehouse", "Cherry"), false);
  assert.equal(may("Union", "Union Coffee House Ministry"), true, "one word added (kind words don't count)");
  assert.equal(may("Starbucks Reserve", "Starbucks"), true);
  assert.equal(may("Walmart Grocery Pickup and Delivery", "Walmart"), false);
  assert.equal(may("Elio's Osteria e Pizzeria", "Elio's Pizzeria & Bar. (Canyon Lake)"), true, "two-word names: unchanged");
});

test("our location suffix: a dash with a space on one side, or a job after a colon", () => {
  assert.equal(web.baseName("Belong Kitchen HTX- Kids Meals"), "Belong Kitchen HTX");
  assert.equal(web.baseName("Black Rock -Pearland"), "Black Rock");
  assert.equal(web.baseName("Brevity Coffee Company #15F:Job 1"), "Brevity Coffee Company #15F");
  assert.equal(web.baseName("Bar-B-Que Shack"), "Bar-B-Que Shack", "a dash inside a word stays");
  assert.equal(web.baseName("Chick-fil-A - Westheimer"), "Chick-fil-A");
  assert.equal(web.possibleMatch("Belong Kitchen", "Belong Kitchen HTX- Kids Meals"), true);
  assert.equal(web.sameBusiness("Brevity Coffee", "Brevity Coffee Company #15F:Job 1"), true);
});

test("possible match at our street address: our first name word is enough", () => {
  const christies = place("c1", "Christie's", 29.7, -95.4, { street: "6029 Westheimer Rd", zip: "77057" });
  const ours = acct("Christie's Seafood & Steaks", 29.7003, -95.4, "6029 Westheimer Road, Houston, TX 77057");
  assert.equal(web.possibleMatch("Christie's", "Christie's Seafood & Steaks"), false, "by name alone: too far apart");
  const c = web.webCheck(ours, [christies]);
  assert.deepEqual([c.status, c.place.id, c.sameAddress, c.listedAddress], ["maybe", "c1", true, null]);
  assert.match(web.webCheckLine(c), /Its street address is ours\.$/);
  // Not at our street address: nothing, as before.
  assert.equal(web.webCheck(ours, [{ ...christies, street: "9 Other St" }]).status, "none");
  // Not at our pin: nothing.
  assert.equal(web.webCheck({ ...ours, lat: 29.72 }, [christies]).status, "none");
  // Same first word at our address, but other words (another business in the building): nothing.
  assert.equal(web.webCheck(acct("Taqueria De Jalisco", 29.7, -95.4, "1536 S Cage Blvd, Pharr, TX 77057"), [place("t2", "Taquería La Fe RB", 29.7, -95.4, { street: "1536 S Cage Blvd", zip: "77057" })]).status, "none");
  assert.equal(web.possibleMatch("Laredo Rehabilitation Hospital", "Laredo Specialty Hospital", true), false);
  assert.equal(web.possibleMatch("Valero Corner Store", "Valero", true), true);
  // Another first word at our address (another business in the building): nothing.
  assert.equal(web.webCheck(ours, [{ ...christies, id: "t1", name: "Tribute" }]).status, "none");
  // A first word under four letters: nothing.
  const ole = place("o1", "Ole", 29.7, -95.4, { street: "1 A St", zip: "77057" });
  assert.equal(web.webCheck(acct("Ole Mexican Grill Deluxe Cantina", 29.7, -95.4, "1 A St, Houston, TX 77057"), [ole]).status, "none");
  // Two at our pin: the one at our street address is shown.
  const other = place("c2", "Christie's Seafood Market", 29.70001, -95.4, { street: "77 Z St", zip: "77057" });
  assert.equal(web.webCheck(ours, [other, christies]).place.id, "c1");
});
