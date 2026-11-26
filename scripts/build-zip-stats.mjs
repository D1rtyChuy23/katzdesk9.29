#!/usr/bin/env node
/**
 * Builds src/lib/ops/census/zip-stats.txt: one line per ZIP code area (Census ZCTA) for the Map's Population layer.
 * Public U.S. Census Bureau data only, no customer data. Run it again when Census publishes a newer year:
 *
 *   node scripts/build-zip-stats.mjs <folder>
 *
 * where <folder> holds, unzipped, from www2.census.gov:
 *   2023_Gaz_zcta_national.txt  geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip
 *   acsdt5y2023-b01003.dat      programs-surveys/acs/summary_file/2023/table-based-SF/data/5YRData/ (total population)
 *   acsdt5y2023-b19013.dat      the same folder (median household income)
 *   zbp22detail.txt             programs-surveys/cbp/datasets/2022/zbp22detail.zip (businesses by ZIP and NAICS)
 *
 * Columns (tab separated, header first): zip, lat, lng, land square miles, population, median household income
 * (blank when Census has none), then business counts from County Business Patterns: all businesses, coffee and snack
 * bars (NAICS 722515), other restaurants (7225 minus 722515), bars (7224), hotels and motels (7211). County Business
 * Patterns leaves out government places (public colleges, public hospitals), so those come from the Places layer instead.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/build-zip-stats.mjs <folder with the Census files>");
  process.exit(1);
}
const out = new URL("../src/lib/ops/census/zip-stats.txt", import.meta.url);

const lines = (name) => readFileSync(join(dir, name), "utf8").split(/\r?\n/).filter(Boolean);

/** ACS table-based summary file: GEO_ID|estimate|margin. ZCTAs are 860Z200US<zip>. Negative values are Census's "no estimate" codes. */
function acs(name) {
  const m = new Map();
  for (const line of lines(name).slice(1)) {
    const [geo, est] = line.split("|");
    if (!geo?.startsWith("860Z200US")) continue;
    const n = Number(est);
    m.set(geo.slice(9), Number.isFinite(n) && n >= 0 ? n : null);
  }
  return m;
}
const pop = acs("acsdt5y2023-b01003.dat");
const income = acs("acsdt5y2023-b19013.dat");

const NAICS = { all: "------", cafes: "722515", food: "7225//", bars: "7224//", hotels: "7211//" };
const biz = new Map();
/** One CSV line into cells (County Business Patterns quotes every text cell; "CITY, ST" holds a comma). */
const csvCells = (line) => [...line.matchAll(/"([^"]*)"|([^,]+)|(?<=,|^)(?=,|$)/g)].map((m) => m[1] ?? m[2] ?? "");
for (const line of lines("zbp22detail.txt").slice(1)) {
  const [zip, , code, est] = csvCells(line);
  const count = Number(est);
  const key = Object.entries(NAICS).find(([, v]) => v === code)?.[0];
  if (!key || !zip || !Number.isFinite(count)) continue;
  const row = biz.get(zip) ?? {};
  row[key] = count;
  biz.set(zip, row);
}

const rows = ["zip\tlat\tlng\tsqmi\tpop\tincome\tbiz\tcafes\trestaurants\tbars\thotels"];
let kept = 0;
for (const line of lines("2023_Gaz_zcta_national.txt").slice(1)) {
  const c = line.split("\t").map((s) => s.trim());
  const zip = c[0];
  const sqmi = Number(c[3]);
  const lat = Number(c[5]);
  const lng = Number(c[6]);
  const p = pop.get(zip);
  if (!zip || !Number.isFinite(lat) || !Number.isFinite(lng) || p == null) continue;
  const b = biz.get(zip) ?? {};
  const restaurants = b.food != null ? Math.max(0, b.food - (b.cafes ?? 0)) : 0;
  rows.push(
    [zip, lat.toFixed(3), lng.toFixed(3), sqmi.toFixed(1), p, income.get(zip) ?? "", b.all ?? 0, b.cafes ?? 0, restaurants, b.bars ?? 0, b.hotels ?? 0].join("\t"),
  );
  kept++;
}
writeFileSync(out, rows.join("\n") + "\n");
console.log(`${kept} ZIP code areas written to ${out.pathname}`);
