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
  assert.equal(web.listedAddress({ street: "502 Texas Ave", city: null, zip: null }), "502 Texas Ave, TX");
  assert.equal(web.listedAddress({ street: null, city: "Houston", zip: "77002" }), null);
  const p = place("p", "Gone Grill", 29.74, -95.4, { street: "9 B St" });
  assert.equal(web.webCheckLine({ status: "elsewhere", place: p, miles: 2.76, listedAddress: null }), "Listed somewhere else: 9 B St, Houston 77002 (2.8 mi from our pin)");
  assert.equal(web.webCheckLine({ status: "none", place: null, miles: null, listedAddress: null }), "No listing found");
  assert.equal(web.lookupWord("Black Rock - Pearland"), "black");
  assert.equal(web.lookupWord("The Coffee House"), "the", "generic-only names fall back to all their words");
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
  const h = place("h1", "Hugo's", 29.743, -95.3997, { street: "1600 Westheimer Rd" });
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
