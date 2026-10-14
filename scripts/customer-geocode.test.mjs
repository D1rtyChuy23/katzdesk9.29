import { test } from "node:test";
import assert from "node:assert/strict";
import { countGeocodes, geoRowsFromMatrix, hasLocation, planGeocodes, qualityOf, reviewCsv } from "../src/lib/ops/customer-geocode.ts";

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
  assert.deepEqual(countGeocodes(lines), { save: 2, same: 1, no_location: 2, unmatched: 1, conflict: 0, review: 4 });
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
