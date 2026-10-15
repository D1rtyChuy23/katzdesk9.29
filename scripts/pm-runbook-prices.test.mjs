import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { defaultConfig, kitList, kitListText } from "../src/lib/ops/pm-runbook.ts";
import { catalogKeys, kitKey, matchRank, pickCatalog, priceKits, summarizePrices } from "../src/lib/ops/pm-runbook-prices.ts";

const def = parseRunbookDefinition(
  JSON.parse(readFileSync(new URL("../src/lib/ops/runbooks/eversys-e4-xwide.json", import.meta.url), "utf8")),
);
const cfg = { ...defaultConfig(def), model: "4ms", pm: "12", wand: "1", steps: "0" };
const lines = kitList(def, cfg); // EV117077 x2, EV108389 x1, EV108354 x3, EV108339 x2, EV108351 x2

const item = (sku, rate, over = {}) => ({ sku, name: sku, rate, active: true, hidden: false, ...over });

test("kit keys ignore case, spaces and dashes", () => {
  assert.equal(kitKey("ev-117 077"), "EV117077");
  assert.equal(kitKey(null), "");
});

test("prices each kit by quantity and flags what the catalog lacks", () => {
  const catalog = {
    EV117077: item("EV117077", 100),
    EV108389: item("EV108389", 50.5),
    EV108354: item("EV108354", 0), // in the catalog, no sell price
    EV108339: item("EV108339", 30, { hidden: true }),
    // EV108351 is not in the catalog
  };
  const p = priceKits(lines, catalog);
  const by = Object.fromEntries(p.map((x) => [x.ev, x]));
  assert.deepEqual([by.EV117077.status, by.EV117077.unit, by.EV117077.line], ["priced", 100, 200]);
  assert.deepEqual([by.EV108389.status, by.EV108389.line], ["priced", 50.5]);
  assert.deepEqual([by.EV108354.status, by.EV108354.line], ["no-price", null]);
  assert.deepEqual([by.EV108339.status, by.EV108339.line], ["inactive", 60]);
  assert.deepEqual([by.EV108351.status, by.EV108351.sku], ["missing", null]);
  const s = summarizePrices(p);
  assert.deepEqual(s, { total: 310.5, priced: 2, missing: 1, attention: 2 });
});

test("copy text carries prices, the missing flag and a total", () => {
  const p = priceKits(lines, { EV117077: item("EV117077", 100), EV108389: item("EV108389", 50.5) });
  const t = kitListText(def, cfg, "Cafe Uno", p);
  assert.match(t, /EV117077 x2 {2}Brew module Standard {2}\[\$100\.00 each, \$200\.00\]/);
  assert.match(t, /EV108351 x2 {2}Frame add-on, milk {2}\[not in parts catalog\]/);
  assert.match(t, /Total at sell price: \$250\.50 \(3 kits without a price\)/);
});

test("copy text is unchanged without prices", () => {
  const t = kitListText(def, cfg, "Cafe Uno");
  assert.ok(!t.includes("["));
  assert.ok(!t.includes("Total at sell price"));
});

const row = (sku, over = {}) => ({
  sku,
  name: `PARTS : ${sku}`,
  description: null,
  mfrPart: null,
  rate: 100,
  active: true,
  hidden: false,
  ...over,
});

test("an Eversys kit is looked up under its six digits as the Parts list writes them", () => {
  assert.deepEqual(catalogKeys("EV117077"), ["EV117077", "EVER117077", "117077"]);
  assert.deepEqual(catalogKeys("ev-117 077"), ["EV117077", "EVER117077", "117077"]);
  assert.deepEqual(catalogKeys("EVER117077"), ["EVER117077", "EV117077", "117077"]);
  assert.deepEqual(catalogKeys("LMT.1.186"), ["LMT1186"]);
  assert.deepEqual(catalogKeys("EV1170770"), ["EV1170770"]); // seven digits: not an Eversys number
  assert.deepEqual(catalogKeys(" - "), []);
});

test("the guides' EV number finds the part already in the Parts list as EVER", () => {
  const got = pickCatalog(["EV117077", "EV108389"], [row("EVER117077"), row("EVER108389", { rate: 55 })]);
  assert.equal(got.EV117077.sku, "EVER117077");
  assert.equal(got.EV108389.rate, 55);
  assert.deepEqual(
    priceKits([{ ev: "EV117077", q: 2 }], got).map((p) => [p.status, p.sku, p.line]),
    [["priced", "EVER117077", 200]],
  );
});

test("bare six digits only match a part that is plainly Eversys", () => {
  const lm = row("LM-55", { mfrPart: "117077", description: "La Marzocco gasket" });
  const ev = row("KIT-9", { mfrPart: "117 077", description: "Eversys PM Kit - Enigma / Brew" });
  assert.equal(matchRank("EV117077", lm), 0);
  assert.equal(matchRank("EV117077", ev), 1);
  assert.equal(matchRank("EV117077", row("EVER-117077", { mfrPart: "117077" })), 2);
  assert.equal(matchRank("EV117077", row("EVERPURE-4C", { mfrPart: "117077", description: "Everpure filter" })), 0);
  // An Eversys part filed under other digits is its own part, even when its number field mentions this one.
  const was = row("EVER109570", { mfrPart: "108390", description: "Eversys PM KIT-ADD ON (was 108390)" });
  assert.equal(matchRank("EV108390", was), 0);
  assert.equal(matchRank("EV109570", was), 2);
  assert.equal(matchRank("LMT1186", row("X", { mfrPart: "LMT.1.186" })), 3);
  assert.equal(matchRank("117077", lm), 3); // a kit written as bare digits is not read as Eversys
  assert.equal(pickCatalog(["EV117077"], [lm]).EV117077, undefined);
  assert.equal(pickCatalog(["EV117077"], [lm, ev]).EV117077.sku, "KIT-9");
});

test("a usable part wins first, then the closer number, then the first row", () => {
  const exactHidden = row("EV117077", { hidden: true });
  const everActive = row("EVER117077");
  assert.equal(pickCatalog(["EV117077"], [exactHidden, everActive]).EV117077.sku, "EVER117077");
  const exact = row("EV117077");
  assert.equal(pickCatalog(["EV117077"], [everActive, exact]).EV117077.sku, "EV117077");
  assert.equal(pickCatalog(["EV117077"], [row("EVER117077", { rate: 5 }), row("EVER-117077", { rate: 6 })]).EV117077.rate, 5);
  assert.deepEqual(Object.keys(pickCatalog(["EV117077", "ev 117077", "EV999999"], [everActive])), ["EV117077"]);
});

test("bare six digits are only a fallback when no part carries the kit's own number", () => {
  const bundle = row("KIT-9", { mfrPart: "117077", description: "Eversys PM kit bundle", rate: 999 });
  // An unpriced or hidden EV / EVER part still beats a priced bundle that only shares the digits.
  const unpriced = row("EVER117077", { rate: null });
  assert.equal(pickCatalog(["EV117077"], [bundle, unpriced]).EV117077.sku, "EVER117077");
  assert.equal(pickCatalog(["EV117077"], [bundle, row("EVER117077", { hidden: true })]).EV117077.sku, "EVER117077");
  assert.equal(pickCatalog(["EV117077"], [unpriced, row("EV-117077", { rate: 0 }), bundle]).EV117077.sku, "EV-117077");
  // With no such part the bundle is used, but never a guess between look-alikes.
  assert.equal(pickCatalog(["EV117077"], [bundle]).EV117077.sku, "KIT-9");
  const m12 = row("EVER111360-12M", { mfrPart: "111360", rate: 300 });
  const m24 = row("EVER111360-24M", { mfrPart: "111360", rate: 700 });
  assert.equal(pickCatalog(["EV111360"], [m12]).EV111360.sku, "EVER111360-12M");
  assert.equal(pickCatalog(["EV111360"], [m12, m24]).EV111360, undefined);
  assert.equal(pickCatalog(["EV111360"], [m12, m24, row("EVER111360")]).EV111360.sku, "EVER111360");
  // The superseded-part trap: EV108390 never borrows EVER109570's price, whatever state EVER108390 is in.
  const was = row("EVER109570", { mfrPart: "108390", description: "Eversys PM KIT-ADD ON (was 108390)", rate: 631 });
  assert.equal(pickCatalog(["EV108390"], [was, row("EVER108390", { active: false, rate: 180 })]).EV108390.sku, "EVER108390");
  assert.equal(pickCatalog(["EV108390"], [was]).EV108390, undefined);
});

test("copy text names the Parts list number when it differs from the kit number", () => {
  const p = priceKits(lines, {
    EV117077: item("EVER117077", 100),
    EV108389: item("EV108389", 50.5),
    EV108354: item("EVER108354", 0),
  });
  const t = kitListText(def, cfg, "Cafe Uno", p);
  assert.match(t, /EV117077 x2 {2}Brew module Standard {2}\[Part EVER117077, \$100\.00 each, \$200\.00\]/);
  assert.match(t, /EV108389 x1 {2}[^\n]*\[\$50\.50 each, \$50\.50\]/);
  assert.match(t, /EV108354 x3 {2}[^\n]*\[Part EVER108354, no sell price in catalog\]/);
  assert.match(t, /EV108351 x2 {2}[^\n]*\[not in parts catalog\]/);
});

test("against the real Parts list, every runbook kit it has is found under EVER", () => {
  const sql = readFileSync(new URL("../migrations/0077_part_bin_codes.sql", import.meta.url), "utf8");
  const parts = [...sql.matchAll(/\('([^']*)', '([^']*)', '[^']*', '((?:[^']|'')*)'\)/g)].map(([, sku, item, clean]) =>
    row(sku, { name: item, description: clean.replace(/''/g, "'") }),
  );
  assert.ok(parts.length > 1700, `read ${parts.length} parts`);
  const evs = [...new Set(readFileSync(new URL("../src/lib/ops/runbooks/eversys-e4-xwide.json", import.meta.url), "utf8").match(/EV\d{6}/g))];
  const got = pickCatalog(evs, parts);
  for (const [k, hit] of Object.entries(got)) assert.equal(hit.sku, `EVER${k.slice(2)}`);
  const missing = evs.filter((ev) => !got[ev]).sort();
  assert.deepEqual(missing, ["EV108312", "EV108350", "EV108351", "EV109568", "EV109589", "EV109706", "EV111934"]);
  assert.equal(Object.keys(got).length, evs.length - missing.length);
});
