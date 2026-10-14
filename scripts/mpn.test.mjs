import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NO_OFFICIAL_FILE,
  candidateMpn,
  cleanMpn,
  cleanSourceUrl,
  mpnKey,
  mpnMentioned,
  officialStatus,
  sameMpn,
  sourceUrlError,
  tieError,
} from "../src/lib/ops/mpn-rules.ts";
import { MAX_PART_IMAGE_BYTES, partImageError, partImageUrl, slotLabel, sniffImage } from "../src/lib/ops/part-images.ts";
import { codeRowsFromMatrix, planCodes } from "../src/lib/ops/equipment-codes.ts";
import { copiedManuals, removedCopies } from "../src/lib/ops/library-file-rules.ts";

test("MPN is compared without punctuation or case, and shown as typed", () => {
  assert.equal(cleanMpn("  52000.0305  "), "52000.0305");
  assert.equal(cleanMpn("   "), null);
  assert.equal(mpnKey("52000.0305"), "520000305");
  assert.ok(sameMpn("52000.0305", "52000-0305"));
  assert.ok(sameMpn("ab-12", "AB12"));
  assert.ok(!sameMpn("AB12", "AB13"));
  assert.ok(!sameMpn("", ""));
});

test("a source has to be an https web address", () => {
  assert.equal(sourceUrlError("https://www.bunn.com/products/52000.0305"), null);
  assert.match(sourceUrlError(""), /source/i);
  assert.match(sourceUrlError("http://example.com/a.pdf"), /https/);
  assert.match(sourceUrlError("not a url"), /web address/);
  assert.match(sourceUrlError("file:///C:/x.pdf"), /https/);
  assert.equal(cleanSourceUrl(" https://example.com/a.pdf "), "https://example.com/a.pdf");
});

test("a file is tied only on its own variation, to that variation's MPN, with a source", () => {
  const ok = { bookMpn: "52000.0305", fileBookId: 7, bookId: 7, fileMpn: null, sourceUrl: "https://example.com/x.pdf" };
  assert.equal(tieError(ok), null);
  assert.match(tieError({ ...ok, bookMpn: null }), /MPN first/);
  assert.match(tieError({ ...ok, fileBookId: 8 }), /stored on this variation/);
  assert.match(tieError({ ...ok, fileMpn: "OTHER-1" }), /already tied/);
  assert.equal(tieError({ ...ok, fileMpn: "52000-0305" }), null); // same MPN again is fine
  assert.match(tieError({ ...ok, sourceUrl: "" }), /source/i);
});

test("status: official needs a spec sheet tied to this exact MPN; another model's tie does not count", () => {
  const book = { mpn: "AB-12", noOfficialFile: false };
  assert.equal(officialStatus({ mpn: null, noOfficialFile: false }, []).state, "no-mpn");
  assert.equal(officialStatus(book, []).state, "pending");
  assert.equal(officialStatus(book, [{ section: "manuals", mpn: "AB12" }]).state, "pending"); // a manual alone is not a spec sheet
  assert.equal(officialStatus(book, [{ section: "spec", mpn: "AB12" }]).state, "official");
  assert.equal(officialStatus(book, [{ section: "spec", mpn: "AB13" }]).state, "pending"); // similar number, different MPN
  const flagged = officialStatus({ mpn: "AB-12", noOfficialFile: true }, []);
  assert.equal(flagged.state, "flagged");
  assert.equal(flagged.label, "No Official File For This MPN");
  assert.equal(flagged.label, NO_OFFICIAL_FILE);
  // A tied spec sheet outranks an old flag.
  assert.equal(officialStatus({ mpn: "AB-12", noOfficialFile: true }, [{ section: "spec", mpn: "AB12" }]).state, "official");
});

test("MPN mentioned is advisory: name or source containing the number", () => {
  assert.ok(mpnMentioned("52000.0305", "Bunn 52000.0305 spec.pdf"));
  assert.ok(mpnMentioned("52000.0305", "x", "https://x.com/52000-0305"));
  assert.ok(!mpnMentioned("52000.0305", "Axiom spec sheet.pdf"));
  assert.ok(!mpnMentioned(null, "anything"));
});

test("candidate MPN is offered only when the item code spells out a manufacturer number", () => {
  assert.equal(candidateMpn("BUNN52000.0305", "BUNN"), "52000.0305");
  assert.equal(candidateMpn("BUNN12203.0010", null), "12203.0010");
  assert.equal(candidateMpn("BUNNAXIOMAPS", "BUNN"), null);
  assert.equal(candidateMpn("BBESPRECIOUS22", "Bravilor Bonamat"), null);
  assert.equal(candidateMpn("52000.0305", "Fetco"), null); // not a Bunn code: not guessed
});

// ---- photos

test("only real JPG, PNG and WebP bytes are accepted, whatever the file is called", () => {
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  assert.equal(sniffImage(jpg), "image/jpeg");
  assert.equal(sniffImage(png), "image/png");
  assert.equal(sniffImage(webp), "image/webp");
  assert.equal(sniffImage(gif), null);
  assert.equal(sniffImage(html), null);
  assert.equal(partImageError(jpg), null);
  assert.match(partImageError(html), /JPG, PNG or WebP/);
  assert.match(partImageError(new Uint8Array(0)), /empty/);
  const big = new Uint8Array(MAX_PART_IMAGE_BYTES + 1);
  big.set(jpg);
  assert.match(partImageError(big), /too large/);
});

test("the blank slot is labeled with the MPN; with none it says so and never passes the SKU off as the MPN", () => {
  assert.deepEqual(slotLabel({ mpn: "52000.0305", sku: "BUNN52000.0305" }), { main: "52000.0305", sub: "No photo yet" });
  assert.deepEqual(slotLabel({ mpn: null, sku: "EVER104120" }), { main: "MPN not set", sub: "SKU EVER104120" });
  assert.deepEqual(slotLabel({ mpn: "  ", sku: null }), { main: "MPN not set", sub: null });
});

test("the photo address carries a version so a replaced photo is not stale", () => {
  assert.equal(partImageUrl(12, "1760000000"), "/api/part-image/12?v=1760000000");
  assert.equal(partImageUrl(12, null), "/api/part-image/12");
});

// ---- main chip

test("a manual on the main chip still copies to variations; a file tied to one MPN does not", () => {
  const main = { id: 1, title: "Bunn Axiom", manufacturer: "Bunn" };
  const v1 = { id: 2, title: "Bunn Axiom DV-APS", manufacturer: "Bunn" };
  const books = [main, v1];
  const files = [
    { id: 10, section: "manuals", bookId: 1, mpn: null }, // shared manual: copies
    { id: 11, section: "parts", bookId: 1, mpn: null }, // shared parts book: copies
    { id: 12, section: "manuals", bookId: 1, mpn: "AX-1" }, // tied to one MPN: stays on the main chip
    { id: 13, section: "spec", bookId: 1, mpn: null }, // a spec sheet never copies
  ];
  assert.deepEqual(copiedManuals(v1, books, files, []).map((f) => f.id), [10, 11]);
  // A tied file is not listed as a copy that could be "put back" either.
  assert.deepEqual(removedCopies(v1, books, files, [{ fileId: 12, bookId: 2 }, { fileId: 10, bookId: 2 }]).map((f) => f.id), [10]);
});

// ---- equipment codes

const books = [
  { id: 1, title: "Bunn Axiom DV-APS", manufacturer: "Bunn", mpn: "AX-DV-1" },
  { id: 2, title: "Bunn ITB-LP", manufacturer: "Bunn", mpn: null },
];
const plan = (rows) =>
  planCodes(
    rows.map(([itemCode, manufacturer, model, mpn], i) => ({ line: i + 2, itemCode, manufacturer, model, mpn: mpn || null })),
    books,
  );

test("worklist rows are read by their headers", () => {
  const rows = codeRowsFromMatrix([
    ["Item Code", "Manufacturer", "Model", "MPN", "Notes"],
    ["BUNNITBLP", "Bunn", "ITB-LP", "", "x"],
    ["", "", "", "", ""],
    ["BBSEGO12", "Bravilor", "Sego 12", " SEGO-12 ", ""],
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].mpn, "SEGO-12");
  assert.throws(() => codeRowsFromMatrix([["A", "B"], ["1", "2"]]), /Manufacturer and Model/);
});

test("plan: nothing is guessed; MPNs are not overwritten or shared", () => {
  const p = plan([
    ["A", "Bunn", "Axiom DV-APS", ""], // exists, has MPN
    ["B", "Bunn", "ITB-LP", "ITB-9"], // exists, MPN gets set
    ["C", "Bunn", "ITB-LP", "ITB-10"], // same model again in the file
    ["D", "Bravilor", "Sego 12", ""], // new, no MPN
    ["E", "Bravilor", "Esprecious 22", "AX-DV-1"], // MPN already on another model
    ["G", "", "Nothing", ""], // incomplete
    ["H", "Fetco", "CBS-1252", "FET-1"], // new with MPN
  ]);
  assert.deepEqual(
    p.map((l) => l.status),
    ["exists", "set-mpn", "conflict", "needs-mpn", "conflict", "invalid", "new-mpn"],
  );
  assert.match(p[2].reason, /line 3/);
  assert.match(p[4].reason, /already on Bunn Axiom DV-APS/);
  assert.equal(p[0].bookId, 1);
  assert.equal(p[3].bookId, null);
  assert.equal(p[3].title, "Bravilor Sego 12");
});

test("plan: a model that already has a different MPN is left alone", () => {
  const p = plan([["F", "Bunn", "Axiom DV-APS", "OTHER-1"]]);
  assert.equal(p[0].status, "conflict");
  assert.match(p[0].reason, /already has MPN AX-DV-1/);
});

test("plan: the same MPN on two new models in one file is a conflict", () => {
  const p = plan([
    ["A", "Fetco", "CBS-1252", "FET-1"],
    ["B", "Fetco", "CBS-2052", "fet-1"],
  ]);
  assert.deepEqual(p.map((l) => l.status), ["new-mpn", "conflict"]);
});

test("photo treatment: the part is found inside its background border and centered on the square", async () => {
  const { partBox, centerOnSquare, PHOTO_EDGE } = await import("../src/lib/ops/part-images.ts");
  // 10x6 white image with a dark 4x2 part at (5,3).
  const w = 10, h = 6;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 3; y < 5; y++) for (let x = 5; x < 9; x++) { const i = (y * w + x) * 4; data[i] = 40; data[i + 1] = 40; data[i + 2] = 40; }
  assert.deepEqual(partBox(data, w, h), { x: 5, y: 3, w: 4, h: 2 });
  // All background: the whole frame is kept.
  assert.deepEqual(partBox(new Uint8ClampedArray(16).fill(255), 2, 2), { x: 0, y: 0, w: 2, h: 2 });
  const at = centerOnSquare({ w: 4, h: 2 });
  assert.equal(at.w, Math.round(PHOTO_EDGE * 0.84));
  assert.equal(at.x, Math.round((PHOTO_EDGE - at.w) / 2));
  assert.equal(at.y, Math.round((PHOTO_EDGE - at.h) / 2));
  const tall = centerOnSquare({ w: 1, h: 3 });
  assert.equal(tall.h, Math.round(PHOTO_EDGE * 0.84));
});

test("photo treatment: an off-white source background becomes the one white, the part is left alone", async () => {
  const { flattenBackground, PHOTO_BACKGROUND } = await import("../src/lib/ops/part-images.ts");
  assert.equal(PHOTO_BACKGROUND, "#ffffff");
  // off-white, see-through, already white, a dark part pixel
  const data = new Uint8ClampedArray([246, 245, 241, 255, 10, 10, 10, 0, 255, 255, 255, 255, 60, 64, 70, 255]);
  assert.equal(flattenBackground(data), 2);
  assert.deepEqual([...data], [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 60, 64, 70, 255]);
});
