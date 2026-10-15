import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import {
  BLANK_ADDRESS_PATTERN,
  countGeocodes,
  geoRowsFromMatrix,
  hasLocation,
  isBlankAddress,
  planGeocodes,
  qualityOf,
  reviewCsv,
} from "../src/lib/ops/customer-geocode.ts";

const HEAD = [
  "Internal ID", "Account", "Name", "Shipping Address 1", "Shipping Address 2", "Shipping City", "Shipping State/Province", "Shipping Zip",
  "Geocode Match", "Match Type", "Matched Address", "Latitude", "Longitude",
];
const matrix = [
  HEAD,
  ["1520", "1010736", "Common Bond Tanglewood", "5740 San Felipe, Unit 130", "", "Houston", "TX", "77057", "Match", "Non_Exact", "5740 SAN FELIPE ST, HOUSTON, TX, 77057", "29.750157460211", "-95.478435062514"],
  ["1521", "1012287", "Steak 48 Houston", "4444 Westheimer Rd.", "Suite A100", "Houston", "TX", "77027", "Match", "Exact", "4444 WESTHEIMER RD, HOUSTON, TX, 77027", "29.741468044383", "-95.452041258343"],
  ["1523", "1012362", "Texican Court", "501 W. Las Colinas Blvd.", "", "Irving", "TX", "75039", "No_Match", "", "", "", ""],
  ["1600", "", "Mod Coffeehouse", "", "", "", "", "", "No address", "", "", "", ""],
  ["1700", "", "Brand New Cafe", "1 Main St", "", "Austin", "TX", "78701", "Match", "Exact", "1 MAIN ST, AUSTIN, TX, 78701", "30.1", "-97.7"],
  ["1800", "", "Coco's Katy", "2 Elm", "", "Katy", "TX", "77494", "Match (suite removed)", "Exact", "2 ELM, KATY, TX, 77494", "29.7", "-95.8"],
  ["", "", "", "", "", "", "", "", "", "", "", "", ""],
];

test("rows read from the geocoded export, blanks skipped, coordinates as numbers", () => {
  const rows = geoRowsFromMatrix(matrix);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].line, 2);
  assert.equal(rows[1].address, "4444 Westheimer Rd. Suite A100, Houston, TX 77027");
  assert.equal(rows[0].latitude, 29.750157460211);
  assert.equal(rows[2].latitude, null);
  assert.throws(() => geoRowsFromMatrix([["Name", "Account"]]), /Latitude and Longitude/);
});

test("only Match rows with real coordinates have a location", () => {
  assert.equal(hasLocation({ result: "Match", latitude: 29.7, longitude: -95.4 }), true);
  assert.equal(hasLocation({ result: "Match (suite removed)", latitude: 29.7, longitude: -95.4 }), true);
  assert.equal(hasLocation({ result: "Tie", latitude: 29.7, longitude: -95.4 }), false);
  assert.equal(hasLocation({ result: "Match", latitude: 0, longitude: 0 }), false);
  assert.equal(hasLocation({ result: "Match", latitude: 120, longitude: -95 }), false);
});

const accounts = [
  { id: 1, name: "Common Bond - Tanglewood", accountNumber: "1010736" },
  { id: 2, name: "Steak 48 (Houston)", netsuiteId: "1521" },
  { id: 3, name: "Texican Court" },
  { id: 4, name: "Mod Coffeehouse" },
  { id: 5, name: "Cocos Katy", latitude: 29.7, longitude: -95.8 },
];

test("plan matches by account number, Internal ID, name, then similar name", () => {
  const lines = planGeocodes(geoRowsFromMatrix(matrix), accounts);
  const by = Object.fromEntries(lines.map((l) => [l.name, l]));
  assert.equal(by["Common Bond Tanglewood"].matchedBy, "account number");
  assert.equal(by["Common Bond Tanglewood"].status, "save");
  assert.equal(by["Common Bond Tanglewood"].quality, "close");
  assert.equal(by["Common Bond Tanglewood"].review, true, "close matches are saved and still reviewed");
  assert.equal(by["Steak 48 Houston"].matchedBy, "internal ID");
  assert.equal(by["Steak 48 Houston"].review, false);
  assert.equal(by["Texican Court"].status, "no_location");
  assert.match(by["Texican Court"].reason, /could not find/);
  assert.equal(by["Mod Coffeehouse"].status, "no_location");
  assert.match(by["Mod Coffeehouse"].reason, /No shipping address/);
  assert.equal(by["Brand New Cafe"].status, "unmatched");
  assert.equal(by["Coco's Katy"].matchedBy, "similar name");
  assert.equal(by["Coco's Katy"].status, "same", "re-reading the same file changes nothing");
  assert.deepEqual(countGeocodes(lines), { save: 2, same: 1, no_location: 2, unmatched: 1, conflict: 0, review: 4, addresses: 3 });
});

test("when two rows land on one account the surer link wins; the other is a likely duplicate", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    ["2212", "", "Steak 48 Houston*", "x", "", "Houston", "TX", "77027", "Match", "Exact", "X", "29.8", "-95.4"],
    matrix[2],
  ]);
  const lines = planGeocodes(rows, [{ id: 2, name: "Steak 48 Houston" }]);
  assert.deepEqual(lines.map((l) => [l.matchedBy, l.status]), [["similar name", "unmatched"], ["name", "save"]]);
  assert.match(lines[0].reason, /duplicate/);
  assert.equal(lines[0].review, true);
});

test("an account on two rows at the same strength is a conflict and never saved", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    ["1", "", "Texican Court", "501 W Las Colinas", "", "Irving", "TX", "75039", "Match", "Exact", "A", "32.8", "-96.9"],
    ["2", "", "TEXICAN COURT", "500 W Las Colinas", "", "Irving", "TX", "75039", "Match", "Exact", "B", "32.9", "-96.9"],
  ]);
  const lines = planGeocodes(rows, accounts);
  assert.deepEqual(lines.map((l) => l.status), ["conflict", "conflict"]);
});

test("similar names shared by two accounts stay unmatched", () => {
  const rows = geoRowsFromMatrix([HEAD, ["1", "", "Joe's Cafe", "1 A St", "", "Austin", "TX", "78701", "Match", "Exact", "1 A ST", "30.1", "-97.7"]]);
  const lines = planGeocodes(rows, [{ id: 8, name: "Joes Cafe" }, { id: 9, name: "Joe's-Cafe" }]);
  assert.equal(lines[0].status, "unmatched");
  assert.match(lines[0].reason, /More than one/);
});

test("review CSV lists only rows that need a person, worst first, quoted for Excel", () => {
  const csv = reviewCsv(planGeocodes(geoRowsFromMatrix(matrix), accounts));
  assert.ok(csv.startsWith("﻿Line,Name,"));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 1 + 4);
  assert.match(lines[1], /^4,Texican Court,/);
  assert.match(lines[lines.length - 1], /^2,Common Bond Tanglewood,.*"5740 San Felipe, Unit 130, Houston, TX 77057"/);
  assert.ok(!csv.includes("Steak 48 Houston"));
});

test("ZIP-area pins (Match Type Approximate) save as approx and go on the review list", () => {
  assert.equal(qualityOf("Exact"), "exact");
  assert.equal(qualityOf("Non_Exact"), "close");
  assert.equal(qualityOf("Approximate"), "approx");
  const rows = geoRowsFromMatrix([
    HEAD,
    ["1523", "1012362", "Texican Court", "501 W. Las Colinas Blvd.", "", "Irving", "TX", "75039", "Match (ZIP area)", "Approximate", "Irving, TX, 75039 (ZIP area)", "32.8697", "-96.9389"],
  ]);
  assert.equal(hasLocation(rows[0]), true);
  const [line] = planGeocodes(rows, accounts);
  assert.equal(line.status, "save");
  assert.equal(line.quality, "approx");
  assert.equal(line.review, true);
  assert.match(line.reviewReason, /ZIP code's center/);
});

test("re-import corrects a pin saved with the wrong type at the same point (e.g. ZIP area saved as close)", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    ["1523", "1012362", "Texican Court", "501 W. Las Colinas Blvd.", "", "Irving", "TX", "75039", "Match (ZIP area)", "Approximate", "Irving, TX, 75039 (ZIP area)", "32.8697", "-96.9389"],
  ]);
  const saved = [{ id: 3, name: "Texican Court", latitude: 32.8697, longitude: -96.9389, quality: "close" }];
  const [fix] = planGeocodes(rows, saved);
  assert.equal(fix.status, "save");
  assert.equal(fix.quality, "approx");
  assert.match(fix.reason, /correct the pin type/);
  const [same] = planGeocodes(rows, [{ ...saved[0], quality: "approx" }]);
  assert.equal(same.status, "same");
});

test("Fill Blank Addresses: only accounts with no typed address, only placed rows matched to one account", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    // Typed address already on the account: never filled.
    ["1", "", "Has Address", "9 Oak St", "", "Houston", "TX", "77002", "Match", "Exact", "9 OAK ST", "29.7", "-95.3"],
    // Blank (spaces only) typed address, already pinned at this point: filled even though the pin is unchanged.
    ["2", "", "Blank Address", "10 Pine St", "Suite 4", "Houston", "TX", "77003", "Match", "Exact", "10 PINE ST", "29.71", "-95.31"],
    // No location from the geocoder: never fills, even though the account matched and its address is blank.
    ["3", "", "No Pin Yet", "11 Elm St", "", "Austin", "TX", "78701", "No_Match", "", "", "", ""],
    // No address in the file: nothing to fill.
    ["4", "", "Empty Row", "", "", "", "", "", "No address", "", "", "", ""],
    // Not matched to an account: nothing to fill.
    ["5", "", "Nobody Here", "12 Ash St", "", "Dallas", "TX", "75201", "Match", "Exact", "12 ASH ST", "32.7", "-96.8"],
    // Two rows on one account at the same strength: a conflict, so neither fills.
    ["6", "", "Twice Cafe", "13 Bay St", "", "Waco", "TX", "76701", "Match", "Exact", "A", "31.5", "-97.1"],
    ["7", "", "TWICE CAFE", "14 Bay St", "", "Waco", "TX", "76701", "Match", "Exact", "B", "31.6", "-97.1"],
  ]);
  const lines = planGeocodes(rows, [
    { id: 1, name: "Has Address", address: "9 Oak Street, Houston, TX 77002" },
    { id: 2, name: "Blank Address", address: "   ", latitude: 29.71, longitude: -95.31, quality: "exact" },
    { id: 3, name: "No Pin Yet", address: null },
    { id: 4, name: "Empty Row" },
    { id: 6, name: "Twice Cafe" },
  ]);
  const by = Object.fromEntries(lines.map((l) => [`${l.line}`, l]));
  assert.equal(by["2"].fillsAddress, false, "an account with a typed address is never filled");
  assert.equal(by["3"].status, "same");
  assert.equal(by["3"].fillsAddress, true);
  assert.equal(by["3"].address, "10 Pine St Suite 4, Houston, TX 77003");
  assert.equal(by["4"].status, "no_location");
  assert.equal(by["4"].fillsAddress, false, "rows the geocoder could not place never fill an address");
  assert.equal(by["5"].fillsAddress, false, "no address in the file");
  assert.equal(by["6"].status, "unmatched");
  assert.equal(by["6"].fillsAddress, false);
  assert.deepEqual([by["7"].status, by["8"].status], ["conflict", "conflict"]);
  assert.equal(by["7"].fillsAddress || by["8"].fillsAddress, false);
  assert.equal(countGeocodes(lines).addresses, 1);
});

test("Fill Blank Addresses: junk the geocoder could not place (phone numbers, a UK address) never fills", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    ["886", "", "Irene Guenther", "281.701.5933", "", "", "", "", "No_Match", "", "", "", ""],
    ["1130", "", "The Gumball 3000 Foundation", "303-315 Latimer Road", "London", "W106Ra", "", "", "No_Match", "", "", "", ""],
  ]);
  const lines = planGeocodes(rows, [
    { id: 1, name: "Irene Guenther", address: "" },
    { id: 2, name: "The Gumball 3000 Foundation", address: null },
  ]);
  assert.deepEqual(lines.map((l) => [l.status, l.fillsAddress]), [["no_location", false], ["no_location", false]]);
  assert.equal(countGeocodes(lines).addresses, 0);
});

test("address parts lose a stray comma at either end, so a filled address never reads 'Rd.,, City'", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    ["1", "", "Porsche St. Louis", "17455 N Outer 40 Rd.,", "", "Chesterfield", "MO", "63005", "Match", "Exact", "A", "38.66", "-90.56"],
    ["2", "", "Station 97", " ,14421 Highway 105 E., ", ", Suite 2,", "Conroe,", "TX", "77306-1234", "Match", "Exact", "B", "30.3", "-95.4"],
  ]);
  assert.equal(rows[0].address, "17455 N Outer 40 Rd., Chesterfield, MO 63005");
  assert.equal(rows[1].address, "14421 Highway 105 E. Suite 2, Conroe, TX 77306-1234");
  const lines = planGeocodes(rows, [{ id: 1, name: "Porsche St. Louis" }, { id: 2, name: "Station 97" }]);
  assert.deepEqual(lines.map((l) => l.fillsAddress), [true, true]);
});

test("a placed row whose address is garbled (number in the city, bad ZIP) is not filled and goes on the review list", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    ["1371", "", "Dream Your Cakes", "1530 S Independence Pkwy, Suite 180", "", "Mckinney, Tx 75072Dream Your Ca", "", "", "Match", "Exact", "A", "33.18", "-96.66"],
    ["2", "", "Short Zip Cafe", "1 Main St", "", "Houston", "TX", "1475", "Match", "Exact", "B", "29.7", "-95.4"],
    ["3", "", "No Zip Cafe", "3256 Westheimer Road", "", "Houston", "TX", "", "Match", "Exact", "C", "29.74", "-95.42"],
    ["4", "", "Typed Already", "2 Main St", "", "Houston 2", "TX", "77002", "Match", "Exact", "D", "29.75", "-95.36"],
  ]);
  assert.deepEqual(rows.map((r) => r.addressFillable), [false, false, true, false]);
  const lines = planGeocodes(rows, [
    { id: 1, name: "Dream Your Cakes", latitude: 33.18, longitude: -96.66, quality: "exact" },
    { id: 2, name: "Short Zip Cafe" },
    { id: 3, name: "No Zip Cafe" },
    { id: 4, name: "Typed Already", address: "2 Main St, Houston, TX 77002" },
  ]);
  const [cakes, shortZip, noZip, typed] = lines;
  assert.equal(cakes.status, "same");
  assert.equal(cakes.fillsAddress, false);
  assert.equal(cakes.review, true);
  assert.match(cakes.reviewReason, /garbled.*NetSuite/);
  assert.equal(shortZip.fillsAddress, false);
  assert.equal(shortZip.review, true);
  assert.equal(noZip.fillsAddress, true, "a blank ZIP is allowed");
  assert.equal(noZip.review, false);
  assert.equal(typed.fillsAddress, false);
  assert.equal(typed.review, false, "an account that has an address is not listed for a garbled file address");
  assert.equal(countGeocodes(lines).addresses, 1);
});

const BLANKS = ["", " ", "\t", " \t\r\n ", "\u00a0", "\u00a0 \u3000", "\ufeff", "\u2028\u202f"];
const NOT_BLANK = ["a", " 1 Main St ", "\t9 Oak\n", "\u00a0x", "\u200b"];

test("blank address: tabs, newlines and non-breaking spaces count, the same as trim()", () => {
  for (const v of BLANKS) assert.equal(isBlankAddress(v), true, JSON.stringify(v));
  for (const v of NOT_BLANK) assert.equal(isBlankAddress(v), false, JSON.stringify(v));
  assert.equal(isBlankAddress(null), true);
  for (const v of [...BLANKS, ...NOT_BLANK]) assert.equal(isBlankAddress(v), !v.trim(), JSON.stringify(v));
  const rows = geoRowsFromMatrix([HEAD, ["1", "", "Tab Cafe", "1 Main St", "", "Houston", "TX", "77002", "Match", "Exact", "A", "29.7", "-95.4"]]);
  for (const address of ["\t", "\u00a0", " \n "]) assert.equal(planGeocodes(rows, [{ id: 1, name: "Tab Cafe", address }])[0].fillsAddress, true, JSON.stringify(address));
});

test("blank address: Postgres reads the pattern the same way as the planner (the save statement's re-check)", async () => {
  const pg = new PGlite();
  try {
    for (const v of [...BLANKS, ...NOT_BLANK]) {
      const { rows } = await pg.query("select coalesce($1::text, '') ~ $2::text as blank", [v, BLANK_ADDRESS_PATTERN]);
      assert.equal(rows[0].blank, isBlankAddress(v), JSON.stringify(v));
    }
    const { rows } = await pg.query("select coalesce($1::text, '') ~ $2::text as blank", [null, BLANK_ADDRESS_PATTERN]);
    assert.equal(rows[0].blank, true);
  } finally {
    await pg.close();
  }
});

test("Fill Blank Addresses skips ZIP-area rows: their street was not found", () => {
  const rows = geoRowsFromMatrix([
    HEAD,
    ["1523", "1012362", "Texican Court", "501 W. Las Colinas Blvd.", "", "Irving", "TX", "75039", "Match (ZIP area)", "Approximate", "Irving, TX, 75039 (ZIP area)", "32.8697", "-96.9389"],
    ["1521", "1012287", "Steak 48 Houston", "4444 Westheimer Rd.", "Suite A100", "Houston", "TX", "77027", "Match", "Exact", "4444 WESTHEIMER RD, HOUSTON, TX, 77027", "29.7414", "-95.4520"],
  ]);
  const lines = planGeocodes(rows, [
    { id: 3, name: "Texican Court", address: "" },
    { id: 2, name: "Steak 48 Houston", address: "" },
  ]);
  assert.equal(lines[0].quality, "approx");
  assert.equal(lines[0].fillsAddress, false);
  assert.equal(lines[1].fillsAddress, true);
  assert.equal(countGeocodes(lines).addresses, 1);
});
