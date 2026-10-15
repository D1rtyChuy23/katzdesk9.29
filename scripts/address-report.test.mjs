import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSuggestions,
  completeFromZipArea,
  geocoderAddress,
  isStreetAddress,
  isZipAreaMatch,
  likePattern,
  normalizeAddress,
  pageCount,
  parseZipArea,
  sameAddress,
  searchWords,
  tidyAddress,
  MAX_SUGGESTIONS,
} from "../src/lib/ops/address-report.ts";

test("normalize: case, spacing, punctuation, comma spacing and ZIP comma are ignored", () => {
  assert.equal(normalizeAddress("4444 Westheimer Rd., Suite A100,  Houston, TX, 77027"), "4444 westheimer rd ste a100 houston tx 77027");
  assert.ok(sameAddress("4444 WESTHEIMER RD, HOUSTON, TX, 77027", "4444 Westheimer Rd.,Houston,  TX 77027"));
  assert.ok(sameAddress("5740 San Felipe Street, Houston, Texas 77057", "5740 SAN FELIPE ST, HOUSTON, TX 77057"));
  assert.ok(sameAddress("1040 W. Sam Houston Parkway North", "1040 W Sam Houston Pkwy N"));
  assert.ok(sameAddress(null, "  "));
  assert.ok(!sameAddress("1 Main St, Houston, TX 77002", "2 Main St, Houston, TX 77002"));
});

test("tidy: one space, comma spacing, no empty parts; the words are kept as typed", () => {
  assert.equal(tidyAddress("  5740 San Felipe ,Unit 130,, Houston ,TX  77057, "), "5740 San Felipe, Unit 130, Houston, TX 77057");
  assert.equal(tidyAddress(null), "");
});

test("ZIP-area matches are recognised and read", () => {
  assert.ok(isZipAreaMatch("Irving, TX, 75039 (ZIP area)"));
  assert.ok(isZipAreaMatch("Houston, TX, 77043 (zip area)"));
  assert.ok(!isZipAreaMatch("5740 SAN FELIPE ST, HOUSTON, TX, 77057"));
  assert.deepEqual(parseZipArea("Irving, TX, 75039 (ZIP area)"), { city: "Irving", state: "TX", zip: "75039" });
  assert.deepEqual(parseZipArea("TX, 77043 (ZIP area)"), { city: null, state: "TX", zip: "77043" });
  assert.equal(parseZipArea("Irving, TX (ZIP area)"), null);
  assert.equal(parseZipArea("5740 SAN FELIPE ST, HOUSTON, TX, 77057"), null);
});

test("a street address has a house number; a ZIP-area match is not one", () => {
  assert.ok(isStreetAddress("5740 SAN FELIPE ST, HOUSTON, TX, 77057"));
  assert.ok(!isStreetAddress("Irving, TX, 75039 (ZIP area)"));
  assert.ok(!isStreetAddress("NRG Parkway, Houston, TX 77054"));
  assert.ok(!isStreetAddress(""));
  assert.equal(geocoderAddress("5740 SAN FELIPE ST, HOUSTON, TX, 77057"), "5740 SAN FELIPE ST, HOUSTON, TX 77057");
});

test("ZIP-area completion fills in what the typed address is missing", () => {
  const irving = "Irving, TX, 75039 (ZIP area)";
  // Street only.
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd.", irving), "501 W. Las Colinas Blvd., Irving, TX 75039");
  // A suite is not a city.
  assert.equal(completeFromZipArea("1700 City Plaza Dr., Suite 150", "Spring, TX, 77389 (ZIP area)"), "1700 City Plaza Dr., Suite 150, Spring, TX 77389");
  // Same city typed: state and ZIP added.
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., irving", irving), "501 W. Las Colinas Blvd., irving, TX 75039");
  // City and state typed: ZIP added.
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., Irving, TX", irving), "501 W. Las Colinas Blvd., Irving, TX 75039");
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., Irving TX", irving), "501 W. Las Colinas Blvd., Irving, TX 75039");
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., Irving, Texas", irving), "501 W. Las Colinas Blvd., Irving, TX 75039");
  // State typed with no city: the city goes in.
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., TX", irving), "501 W. Las Colinas Blvd., Irving, TX 75039");
  // A street name with two words and no number still counts as a street.
  assert.equal(completeFromZipArea("NRG Parkway", "Houston, TX, 77054 (ZIP area)"), "NRG Parkway, Houston, TX 77054");
});

test("ZIP-area completion stays out of the way when it cannot be sure", () => {
  const irving = "Irving, TX, 75039 (ZIP area)";
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., Irving, TX 75039", irving), null, "already has a ZIP");
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., Dallas", irving), null, "a different city typed");
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd., Dallas, TX", irving), null, "a different city typed with the state");
  assert.equal(completeFromZipArea("Houston", irving), null, "no street");
  assert.equal(completeFromZipArea("", irving), null, "no typed address");
  assert.equal(completeFromZipArea(null, irving), null);
  assert.equal(completeFromZipArea("501 W. Las Colinas Blvd.", "501 W LAS COLINAS BLVD, IRVING, TX, 75039"), null, "not a ZIP-area match");
});

test("ZIP-area completion never adds a second city or state to an address typed without commas", () => {
  const irving = "Irving, TX, 75039 (ZIP area)";
  const houston = "Houston, TX, 77084 (ZIP area)";
  // A different city before the state: a person looks.
  assert.equal(completeFromZipArea("123 Main St Dallas TX", irving), null);
  assert.equal(completeFromZipArea("123 Main St Dallas Texas", irving), null);
  assert.equal(completeFromZipArea("5700 N. Hwy 6, Suite 250 Dallas Texas", houston), null);
  // The same city before the state: only the ZIP is added.
  assert.equal(completeFromZipArea("123 Main St Irving TX", irving), "123 Main St Irving TX 75039");
  assert.equal(completeFromZipArea("5700 N. Hwy 6 Suite 250 Houston Texas", houston), "5700 N. Hwy 6 Suite 250 Houston Texas 77084");
  assert.equal(completeFromZipArea("5700 N. Hwy 6, Suite 250 Houston Texas", houston), "5700 N. Hwy 6, Suite 250 Houston, TX 77084");
  // Only the state, or no city to compare: a person looks.
  assert.equal(completeFromZipArea("123 Main St TX", irving), null);
  assert.equal(completeFromZipArea("123 Main St Irving TX", "TX, 75039 (ZIP area)"), null);
  // A suite number before the state is not a city: the city goes in, as before.
  assert.equal(completeFromZipArea("5700 N. Hwy 6, Suite 250 TX", houston), "5700 N. Hwy 6, Suite 250, Houston, TX 77084");
  // Never offered as a suggestion either.
  assert.deepEqual(buildSuggestions({ address: "123 Main St Dallas TX", geocodeAddress: irving }), []);
});

test("suggestions: geocoder street match, clean list and invoice bill-to, each with its source", () => {
  const out = buildSuggestions({
    address: "4444 Westheimer",
    geocodeAddress: "4444 WESTHEIMER RD, HOUSTON, TX, 77027",
    cleanList: ["4444 Westheimer Rd., Suite A100, Houston, TX 77027"],
    invoices: ["PO Box 12, Houston, TX 77001"],
  });
  assert.deepEqual(out, [
    { address: "4444 WESTHEIMER RD, HOUSTON, TX 77027", source: "Geocoder match" },
    { address: "4444 Westheimer Rd., Suite A100, Houston, TX 77027", source: "Clean list" },
    { address: "PO Box 12, Houston, TX 77001", source: "Invoice bill-to" },
  ]);
});

test("suggestions: a ZIP-area match is never offered as is, but completes a street-only address", () => {
  assert.deepEqual(buildSuggestions({ address: null, geocodeAddress: "Houston, TX, 77043 (ZIP area)" }), []);
  assert.deepEqual(buildSuggestions({ address: "1040 W. Sam Houston Pkwy N.", geocodeAddress: "Houston, TX, 77043 (ZIP area)" }), [
    { address: "1040 W. Sam Houston Pkwy N., Houston, TX 77043", source: "Completed from ZIP area" },
  ]);
  assert.deepEqual(
    buildSuggestions({ address: "1040 W. Sam Houston Pkwy N., Houston, TX 77043", geocodeAddress: "Houston, TX, 77043 (ZIP area)" }),
    [],
    "complete already: nothing to offer",
  );
});

test("suggestions: equal to the current address (any spelling) and repeats are dropped; first source wins", () => {
  const out = buildSuggestions({
    address: "5740 San Felipe, Unit 130, Houston, TX 77057",
    geocodeAddress: null,
    cleanList: ["5740 SAN FELIPE, UNIT 130, HOUSTON, TX, 77057", "  ", null, "5740 San Felipe St, Unit 130, Houston, TX 77057"],
    invoices: ["5740 San Felipe Street, Unit 130, Houston, Texas 77057", "1 Other St, Houston, TX 77002"],
  });
  assert.deepEqual(out, [
    { address: "5740 San Felipe St, Unit 130, Houston, TX 77057", source: "Clean list" },
    { address: "1 Other St, Houston, TX 77002", source: "Invoice bill-to" },
  ]);
});

test("suggestions: a geocoder match that only drops the suite is not offered", () => {
  assert.deepEqual(
    buildSuggestions({ address: "4444 Westheimer Rd, Suite A100, Houston, TX 77027", geocodeAddress: "4444 WESTHEIMER RD, HOUSTON, TX, 77027" }),
    [],
  );
});

test("suggestions are capped", () => {
  const many = Array.from({ length: 12 }, (_, i) => `${i + 1} Main St, Houston, TX 77002`);
  assert.equal(buildSuggestions({ address: null, geocodeAddress: null, cleanList: many }).length, MAX_SUGGESTIONS);
});

test("search words and LIKE patterns", () => {
  assert.deepEqual(searchWords("  steak   48  houston "), ["steak", "48", "houston"]);
  assert.equal(searchWords("a b c d e f g h").length, 6);
  assert.deepEqual(searchWords(""), []);
  assert.equal(likePattern("50%_off\\"), "%50\\%\\_off\\\\%");
});

test("page count is at least one", () => {
  assert.equal(pageCount(0, 25), 1);
  assert.equal(pageCount(25, 25), 1);
  assert.equal(pageCount(26, 25), 2);
  assert.equal(pageCount(805, 25), 33);
});
