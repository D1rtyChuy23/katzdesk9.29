import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcConfig, calcOptionalVisit, calcSchedule, discounted, loadRates } from "./pm-guide/calc.mjs";

const load = (id) => JSON.parse(readFileSync(new URL(`../pm-guides/data/${id}.json`, import.meta.url), "utf8"));
const rates = loadRates();
const linea = load("la-marzocco-linea-classic-s");

test("discounted rounds half-up to the cent", () => {
  assert.equal(discounted(15000, 75), 3750);
  assert.equal(discounted(12510, 75), 3128);
});

test("linea AV totals match the spec table", () => {
  const av = ["g1", "g2", "g3", "g4"].map((c) => calcConfig(linea, rates, c, "av").totalCents);
  assert.deepEqual(av, [43191, 45593, 47995, 50397]);
});

test("linea guide has no MP content in its data", () => {
  assert.equal(JSON.stringify(linea).match(/\bMP\b|mpValve|SA600/i), null);
  assert.ok(linea.configurations.every((c) => c.variants.length === 1 && c.variants[0].id === "av"));
});

test("linea savings are $337.50 per visit", () => {
  assert.equal(calcConfig(linea, rates, "g1", "av").savingsCents, 33750);
});

test("linea labor is 2 hrs at $37.50 and trip is $37.50", () => {
  const r = calcConfig(linea, rates, "g1", "av");
  assert.equal(r.laborCents, 7500);
  assert.equal(r.tripCents, 3750);
});

test("fixed parts are $295.39", () => {
  const r = calcConfig(linea, rates, "g1", "av");
  assert.equal(r.partsCents - 2402, 29539);
});

const mini = (visits) => ({
  id: "mini",
  visits,
  parts: [{ id: "p", name: "P", partNo: "X", unitCents: 1000, visits: visits.map((v) => v.id), qty: { base: 1, perUnit: 0 } }],
  configurations: [{ id: "c", label: "C", units: 1, variants: [{ id: "standard", label: "S", addParts: [] }] }],
});

test("missing hours throws naming the machine and visit", () => {
  const m = mini([{ id: "v1", label: "V", month: 12 }]);
  assert.throws(() => calcConfig(m, rates, "c", "standard"), /mini.*v1|v1.*mini/);
});

test("unknown config, variant or part id throws naming the id", () => {
  assert.throws(() => calcConfig(linea, rates, "g9", "av"), /g9/);
  assert.throws(() => calcConfig(linea, rates, "g1", "gold"), /gold/);
  const bad = structuredClone(linea);
  bad.configurations[0].variants[0].addParts = ["nope"];
  assert.throws(() => calcConfig(bad, rates, "g1", "av"), /nope/);
});

test("trip is charged once per visit", () => {
  const m = mini([{ id: "a", label: "A", month: 12, hours: 1 }, { id: "b", label: "B", month: 24, hours: 1 }]);
  assert.equal(calcConfig(m, rates, "c", "standard").tripCents, 7500);
});

test("eversys data reproduces the original sample (parts + program labor), with trip now discounted and included", () => {
  const ev = load("eversys-legacy-l2");
  const rs = ["base", "g2", "g3", "g4"].map((c) => calcConfig(ev, rates, c, "standard"));
  assert.deepEqual(rs.map((r) => r.partsCents), [227500, 277000, 328900, 378400]);
  assert.ok(rs.every((r) => r.laborCents === 39375));
  assert.deepEqual(rs[0].visits.slice(0, 2).map((v) => v.partsCents), [36000, 36000]);
  assert.deepEqual(rs.map((r) => r.visits[2].partsCents), [155500, 205000, 256900, 306400]);
  assert.ok(rs.every((r) => r.tripCents === 3 * 3750));
  assert.ok(rs.every((r) => r.totalCents === r.partsCents + r.laborCents + 11250));
});

import { renderGuideHtml, formatMoney } from "./pm-guide/render.mjs";
const DISCLAIMER =
  "Parts pricing is subject to change. Parts costs may be updated at any time, and any price update can affect the final price.";

test("formatMoney", () => {
  assert.equal(formatMoney(0), "$0.00");
  assert.equal(formatMoney(150617), "$1,506.17");
});

test("html has cover + parts + 4 config pages + service intervals + summary", () => {
  const html = renderGuideHtml(linea, rates);
  assert.equal((html.match(/class="page"/g) ?? []).length, 8);
});

test("html shows every expected annual total", () => {
  const html = renderGuideHtml(linea, rates);
  for (const t of ["$431.91", "$455.93", "$479.95", "$503.97"]) {
    assert.ok(html.includes(t), `missing ${t}`);
  }
});

test("html shows 75% off, $37.50 labor and $37.50 trip", () => {
  const html = renderGuideHtml(linea, rates);
  assert.ok(html.includes("75%"));
  assert.ok(html.includes("$37.50/hr"));
  assert.ok(html.includes("$37.50 per visit"));
});

test("every page carries the pricing disclaimer", () => {
  const html = renderGuideHtml(linea, rates);
  assert.equal(html.split(DISCLAIMER).length - 1, 8);
});

test("inspect-only items are listed with prices and marked not included", () => {
  const html = renderGuideHtml(linea, rates);
  assert.ok(html.includes("L270/UL") && html.includes("$358.74"));
  assert.ok(/not included/i.test(html));
});

test("table cells wrap long text instead of overflowing", () => {
  assert.ok(renderGuideHtml(linea, rates).includes("overflow-wrap:anywhere"));
});

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderGuidePdf } from "./pm-guide/render.mjs";

const cli = new URL("./pm-guide/cli.mjs", import.meta.url).pathname;
const pdfOut = join(mkdtempSync(join(tmpdir(), "pmg-cli-")), "linea.pdf");

test("cli builds an 8-page pdf for linea", () => {
  execFileSync("node", [cli, "la-marzocco-linea-classic-s", pdfOut]);
  const info = execFileSync("pdfinfo", [pdfOut], { encoding: "utf8" });
  assert.match(info, /Pages:\s+8/);
  assert.match(info, /Page size:\s+720 x 40[45](\.\d+)? pts/);
});

test("pdf text contains each annual total", () => {
  const text = execFileSync("pdftotext", ["-layout", pdfOut, "-"], { encoding: "utf8" });
  for (const t of ["$431.91", "$455.93", "$479.95", "$503.97"]) {
    assert.ok(text.includes(t), `missing ${t}`);
  }
});

test("cli exits non-zero for an unknown machine id", () => {
  const r = spawnSync("node", [cli, "no-such-machine"], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no-such-machine/);
});

test("a 120-character part name is not clipped", async () => {
  const m = structuredClone(linea);
  const long = "Extra long replacement part name ".repeat(4).slice(0, 120).trim();
  m.parts[0].name = long;
  const out = join(mkdtempSync(join(tmpdir(), "pmg-")), "t.pdf");
  await renderGuidePdf(m, rates, out);
  const text = execFileSync("pdftotext", [out, "-"], { encoding: "utf8" }).replace(/\s+/g, " ");
  assert.ok(text.includes("Extra long replacement part name Extra long replacement part name"));
  assert.ok(text.includes(long.slice(-20)));
});

const configPage = (html, n) => html.split('<section class="page">')[2 + n]; // 0 = preamble, 1 = cover, 2 = parts

test("config page has a cost chart with an axis and a total on every bar", () => {
  const page = configPage(renderGuideHtml(linea, rates), 1);
  const svg = page.slice(page.indexOf("<svg"), page.indexOf("</svg>"));
  assert.ok(svg.includes("$0") && svg.includes("$500"));
  assert.ok(svg.includes("$431.91"));
});

test("config page shows how labor and trip are discounted on the right", () => {
  const page = configPage(renderGuideHtml(linea, rates), 1);
  const panel = page.slice(page.indexOf("Labor &amp; trip discount"));
  assert.ok(page.includes("Labor &amp; trip discount"));
  for (const t of ["$300.00", "$75.00", "$225.00", "$150.00", "$37.50", "$112.50", "$337.50", "75% off"]) {
    assert.ok(panel.includes(t), `missing ${t}`);
  }
});

test("every config page has a chart and the discount panel", () => {
  const html = renderGuideHtml(linea, rates);
  for (let n = 1; n <= 4; n++) {
    const page = configPage(html, n);
    assert.ok(page.includes("<svg") && page.includes("Labor &amp; trip discount"), `config ${n}`);
  }
});

test("multi-visit machines chart one column per visit", () => {
  const ev = load("eversys-legacy-l2");
  const page = configPage(renderGuideHtml(ev, rates), 1);
  const svg = page.slice(page.indexOf("<svg"), page.indexOf("</svg>"));
  assert.ok(svg.includes("Month 12") && svg.includes("Month 24") && svg.includes("Month 36"));
});

test("the rendered guide has no MP content anywhere", () => {
  const html = renderGuideHtml(linea, rates);
  assert.equal(html.match(/\bMP\b|SA600|paddle/i), null);
});

test("cover lists the work performed, including the AV model tests", () => {
  const cover = renderGuideHtml(linea, rates).split('<section class="page">')[1];
  for (const t of ["Clean and backflush", "Replace group gaskets", "Test shot volumes", "Test DC voltage", "Test flow meter resistance", "AV"]) {
    assert.ok(cover.includes(t), `cover missing ${t}`);
  }
});

test("each priced part says what work is done with it", () => {
  const parts = renderGuideHtml(linea, rates).split('<section class="page">')[2];
  for (const t of ["Work performed", "Replace diffuser screens", "Rebuild steam valves", "Replace pressure safety valve"]) {
    assert.ok(parts.includes(t), `parts page missing ${t}`);
  }
});

test("every priced part in the linea data has a work description", () => {
  assert.ok(linea.parts.every((p) => typeof p.work === "string" && p.work.length > 0));
  assert.ok(linea.workPerformed.length >= 2);
});

// --- service intervals (3/9, 6 and 12 month) ---

test("6-month and 3/9-month visits are 1 hr labor + trip + the LCS kit", () => {
  const six = ["g1", "g2", "g3", "g4"].map((c) => calcOptionalVisit(linea, rates, "m6", c).totalCents);
  const three = ["g1", "g2", "g3", "g4"].map((c) => calcOptionalVisit(linea, rates, "m3_9", c).totalCents);
  assert.deepEqual(six, [21177, 22956, 25562, 28168]);
  assert.deepEqual(three, [10106, 12712, 15318, 17924]);
  const v = calcOptionalVisit(linea, rates, "m6", "g1");
  assert.equal(v.laborCents, 3750);
  assert.equal(v.tripCents, 3750);
  assert.equal(v.kit.partNo, "LCS.6.1");
  assert.equal(v.kit.unitCents, 13677);
});

test("schedules: annual, 6-month intervals and quarterly totals", () => {
  const t = (s, c) => calcSchedule(linea, rates, s, c).totalCents;
  assert.deepEqual(["annual", "semi", "quarterly"].map((s) => t(s, "g1")), [43191, 64368, 84580]);
  assert.deepEqual(["annual", "semi", "quarterly"].map((s) => t(s, "g4")), [50397, 78565, 114413]);
  assert.equal(calcSchedule(linea, rates, "quarterly", "g1").visitCount, 4);
});

test("the annual schedule is the 12-month total, unchanged", () => {
  assert.equal(calcSchedule(linea, rates, "annual", "g2").totalCents, calcConfig(linea, rates, "g2", "av").totalCents);
});

test("an optional visit with no hours, or a missing kit, throws naming it", () => {
  const bad = structuredClone(linea);
  delete bad.optionalVisits[0].hours;
  assert.throws(() => calcOptionalVisit(bad, rates, "m6", "g1"), /m6/);
  const noKit = structuredClone(linea);
  delete noKit.optionalVisits[0].kits.g3;
  assert.throws(() => calcOptionalVisit(noKit, rates, "m6", "g3"), /g3/);
  assert.throws(() => calcOptionalVisit(linea, rates, "m99", "g1"), /m99/);
  assert.throws(() => calcSchedule(linea, rates, "nope", "g1"), /nope/);
});

const intervalsPage = (html) => html.split('<section class="page">')[7];

test("service intervals page recommends 12-month and 6-month for high volume, with prices", () => {
  const page = intervalsPage(renderGuideHtml(linea, rates));
  for (const t of ["Highly recommended", "Recommended for high volume", "Suggested", "LCS.6.1", "LCS.3.4", "$211.77", "$643.68", "$845.80", "$431.91"]) {
    assert.ok(page.includes(t), `intervals page missing ${t}`);
  }
});

test("service intervals page describes the work for each visit", () => {
  const page = intervalsPage(renderGuideHtml(linea, rates));
  for (const t of ["rebuild", "diffuser screens", "flow meter", "auto-fill probe"]) {
    assert.ok(page.toLowerCase().includes(t.toLowerCase()), `missing ${t}`);
  }
});

test("cover and summary say 12-month is highly recommended and 6-month is for high volume", () => {
  const html = renderGuideHtml(linea, rates);
  const cover = html.split('<section class="page">')[1];
  const summary = html.split('<section class="page">')[8];
  for (const page of [cover, summary]) {
    assert.ok(/highly recommended/i.test(page) && /high[- ]volume/i.test(page));
  }
});
