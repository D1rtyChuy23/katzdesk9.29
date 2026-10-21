import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { defaultConfig, kitList, kitListText } from "../src/lib/ops/pm-runbook.ts";
import { anyFound, catalogKeys, kitKey, kitPriceParts, matchRank, pickCatalog, priceKits, summarizePrices, uncountedNote } from "../src/lib/ops/pm-runbook-prices.ts";

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
  // Hidden in the Parts list: its last price is shown, but it is not something to sell, so it is not counted.
  assert.deepEqual([by.EV108339.status, by.EV108339.unit, by.EV108339.line], ["inactive", 30, null]);
  assert.deepEqual([by.EV108351.status, by.EV108351.sku], ["missing", null]);
  const s = summarizePrices(p);
  // 10 kits: EV108354 x3, EV108339 x2 and EV108351 x2 are left out of the $250.50.
  // Everything in kits: EV108351 is one line of 2 kits.
  assert.deepEqual(s, { total: 250.5, kits: 10, uncounted: 7, missing: 2 });
  assert.equal(uncountedNote(s), "7 of 10 kits not counted");
  assert.equal(uncountedNote({ ...s, uncounted: 0 }), "");
});

test("an inactive or hidden part keeps its flag and never shows a $0 or negative price", () => {
  const one = (hit) => priceKits([{ ev: "EV108339", q: 2 }], { EV108339: hit })[0];
  assert.deepEqual(kitPriceParts(one(item("EVER108339", null, { active: false }))), [
    "Part EVER108339",
    "Inactive or hidden in the catalog",
    "not counted",
  ]);
  assert.equal(one(item("EVER108339", 0, { hidden: true })).unit, null);
  assert.equal(one(item("EVER108339", -25, { hidden: true })).unit, null);
  assert.deepEqual(kitPriceParts(one(item("EVER108339", 89.9, { hidden: true }))), [
    "Part EVER108339",
    "Inactive or hidden in the catalog",
    "$89.90 each",
    "not counted",
  ]);
  // The same number spelled differently is not a different part.
  assert.deepEqual(kitPriceParts(one(item("ev-108339", 10))), ["$10.00 each", "$20.00"]);
});

test("copy text carries prices, the missing flag and a total", () => {
  const p = priceKits(lines, { EV117077: item("EV117077", 100), EV108389: item("EV108389", 50.5) });
  const t = kitListText(def, cfg, "Cafe Uno", p);
  assert.match(t, /EV117077 x2 {2}Brew module Standard {2}\[\$100\.00 each, \$200\.00\]/);
  assert.match(t, /EV108351 x2 {2}Frame add-on, milk {2}\[Not in parts catalog\]/);
  // Counts kits, the same unit as "10 kits in total" just above it.
  assert.match(t, /10 kits in total\nTotal at sell price: \$250\.50 \(7 of 10 kits not counted\)$/);
});

test("copy text uses the sheet's money format and says when nothing is priced", () => {
  const big = kitListText(def, cfg, "Cafe Uno", priceKits(lines, { EV117077: item("EVER117077", 1234.5) }));
  assert.match(big, /\[Part EVER117077, \$1,234\.50 each, \$2,469\.00\]/);
  assert.match(big, /Total at sell price: \$2,469\.00 \(8 of 10 kits not counted\)$/);
  const none = kitListText(def, cfg, "Cafe Uno", priceKits(lines, {}));
  assert.match(none, /No kit prices found in the parts catalog yet\.$/);
  assert.ok(!none.includes("Total at sell price"));
});

test("parts that are found but none sellable still show a total and say why", () => {
  const hidden = (sku, rate) => item(sku, rate, { hidden: true });
  const p = priceKits(lines, {
    EV117077: hidden("EVER117077", 100),
    EV108389: hidden("EVER108389", 50.5),
    EV108354: item("EVER108354", 0),
    EV108339: item("EVER108339", 30, { active: false }),
  });
  const s = summarizePrices(p);
  assert.deepEqual(s, { total: 0, kits: 10, uncounted: 10, missing: 2 });
  assert.equal(anyFound(s), true);
  const t = kitListText(def, cfg, "Cafe Uno", p);
  assert.match(t, /\[Part EVER117077, Inactive or hidden in the catalog, \$100\.00 each, not counted\]/);
  assert.match(t, /Total at sell price: \$0\.00 \(10 of 10 kits not counted\)$/);
  assert.ok(!t.includes("No kit prices found"));
  assert.equal(anyFound(summarizePrices(priceKits(lines, {}))), false);
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

test("La Marzocco kits match the LM prefix and a bare number cannot beat it", () => {
  const priced = pickCatalog(["F.3.040", "1207", "SA600/K2"], [row("LMF.3.040", { rate: 12 }), row("LM1207", { rate: 8 }), row("LMSA600/K2", { rate: 40 })], "LM");
  assert.equal(priced.F3040.sku, "LMF.3.040");
  assert.equal(priced["1207"].sku, "LM1207");
  assert.equal(priced.SA600K2.sku, "LMSA600/K2");
  assert.ok(catalogKeys("F.3.040", "LM").includes("LMF3040"));
  const guarded = pickCatalog(["1207"], [row("1207", { rate: 99, name: "Other maker 1207" }), row("LM1207", { rate: null })], "LM");
  assert.equal(guarded["1207"].sku, "LM1207");
  assert.equal(pickCatalog(["EV117077"], [row("LM117077", { rate: 50 })]).EV117077, undefined);
  assert.equal(matchRank("EV117077", row("LMEV117077")), 0);
  const bare = [row("F.3.040", { rate: 20 }), row("LMF.3.040", { rate: 10 })];
  assert.equal(pickCatalog(["F.3.040"], bare).F3040.sku, "F.3.040");
  assert.deepEqual(pickCatalog(["F.3.040"], bare), pickCatalog(["F.3.040"], bare, undefined));
  assert.equal(pickCatalog(["EV117077"], [row("EVER117077", { rate: 5 })]).EV117077.sku, "EVER117077");
  assert.equal(pickCatalog(["EV117077"], [row("EVER117077", { rate: 5 })], undefined).EV117077.sku, "EVER117077");
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
  assert.match(t, /EV108354 x3 {2}[^\n]*\[Part EVER108354, No sell price in the catalog\]/);
  assert.match(t, /EV108351 x2 {2}[^\n]*\[Not in parts catalog\]/);
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
