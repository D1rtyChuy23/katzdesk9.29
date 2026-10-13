import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcConfig, discounted, loadRates } from "./pm-guide/calc.mjs";

const load = (id) => JSON.parse(readFileSync(new URL(`../pm-guides/data/${id}.json`, import.meta.url), "utf8"));
const rates = loadRates();
const linea = load("la-marzocco-linea-classic-s");

test("discounted rounds half-up to the cent", () => {
  assert.equal(discounted(15000, 75), 3750);
  assert.equal(discounted(12510, 75), 3128);
});

test("linea totals match the spec table", () => {
  const std = ["g1", "g2", "g3", "g4"].map((c) => calcConfig(linea, rates, c, "standard").totalCents);
  const mp = ["g1", "g2", "g3", "g4"].map((c) => calcConfig(linea, rates, c, "mp").totalCents);
  assert.deepEqual(std, [43191, 45593, 47995, 50397]);
  assert.deepEqual(mp, [68246, 95703, 123160, 150617]);
});

test("linea savings are $337.50 per visit", () => {
  assert.equal(calcConfig(linea, rates, "g1", "standard").savingsCents, 33750);
});

test("linea labor is 2 hrs at $37.50 and trip is $37.50", () => {
  const r = calcConfig(linea, rates, "g1", "standard");
  assert.equal(r.laborCents, 7500);
  assert.equal(r.tripCents, 3750);
});

test("fixed parts are $295.39", () => {
  const r = calcConfig(linea, rates, "g1", "standard");
  assert.equal(r.partsCents - 2402, 29539);
});

test("mp does not change the standard total", () => {
  const before = calcConfig(linea, rates, "g2", "standard").totalCents;
  const noMp = structuredClone(linea);
  noMp.configurations.forEach((c) => (c.variants = c.variants.filter((v) => v.id === "standard")));
  assert.equal(calcConfig(noMp, rates, "g2", "standard").totalCents, before);
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
  assert.throws(() => calcConfig(linea, rates, "g9", "standard"), /g9/);
  assert.throws(() => calcConfig(linea, rates, "g1", "gold"), /gold/);
  const bad = structuredClone(linea);
  bad.configurations[0].variants[1].addParts = ["nope"];
  assert.throws(() => calcConfig(bad, rates, "g1", "mp"), /nope/);
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

test("html has cover + parts + 4 config pages + summary", () => {
  const html = renderGuideHtml(linea, rates);
  assert.equal((html.match(/class="page"/g) ?? []).length, 7);
});

test("html shows every expected annual total", () => {
  const html = renderGuideHtml(linea, rates);
  for (const t of ["$431.91", "$455.93", "$479.95", "$503.97", "$682.46", "$957.03", "$1,231.60", "$1,506.17"]) {
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
  assert.equal(html.split(DISCLAIMER).length - 1, 7);
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

test("cli builds a 7-page pdf for linea", () => {
  execFileSync("node", [cli, "la-marzocco-linea-classic-s", pdfOut]);
  const info = execFileSync("pdfinfo", [pdfOut], { encoding: "utf8" });
  assert.match(info, /Pages:\s+7/);
  assert.match(info, /Page size:\s+720 x 40[45](\.\d+)? pts/);
});

test("pdf text contains each annual total", () => {
  const text = execFileSync("pdftotext", ["-layout", pdfOut, "-"], { encoding: "utf8" });
  for (const t of ["$431.91", "$455.93", "$479.95", "$503.97", "$682.46", "$957.03", "$1,231.60", "$1,506.17"]) {
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
  assert.ok(svg.includes("$0") && svg.includes("$1,000"));
  assert.ok(svg.includes("$431.91") && svg.includes("$682.46"));
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
