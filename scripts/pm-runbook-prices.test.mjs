import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRunbookDefinition } from "../src/lib/ops/pm-runbook-schema.ts";
import { defaultConfig, kitList, kitListText } from "../src/lib/ops/pm-runbook.ts";
import { kitKey, priceKits, summarizePrices } from "../src/lib/ops/pm-runbook-prices.ts";

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
