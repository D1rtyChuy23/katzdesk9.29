# PM Guide Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate customer-facing PM program guides (PDF) from one data file per machine, with 75% off labor and trip, starting with La Marzocco Linea Classic S.

**Architecture:** A pure calculator turns machine data + shared rates into per-configuration totals (integer cents). A renderer turns calculator output into 960×540 HTML pages and prints them to PDF with Playwright/Chromium. A CLI wires `pm-guides/data/<machine>.json` to `pm-guides/out/<machine>.pdf`. Adding a machine = adding a JSON file.

**Tech Stack:** Node 22 ESM (`.mjs`), `node:test`, `playwright` (already in package.json), `pdftotext` for PDF assertions. Follows the repo's `scripts/*.test.mjs` pattern so `npm test` picks tests up.

**Spec:** `docs/superpowers/specs/2026-10-13-pm-guide-generator-design.md`

## Global Constraints

- Standard labor rate $150.00/hr; program labor $37.50/hr (75% off). Standard trip $150.00/visit; program trip $37.50/visit (75% off).
- Trip is included in every package and every total, charged once per visit.
- Visit total = parts + program labor + program trip. Savings = (standard labor + standard trip) − (program labor + program trip).
- Hours come from the source PM spec; never guessed. Missing hours = error, not zero.
- All money is integer cents internally; rounding of the discount is half-up to the cent.
- Footer on every page: "Parts pricing is subject to change. Parts costs may be updated at any time, and any price update can affect the final price."
- Rates, hours, discount % are defined once (`pm-guides/rates.json`).
- Page size 960×540 px (16:9) like `Eversys_Legacy_PM_Program_Pricing.pdf`.
- Prices are list prices from `La Marzocco – LMUSA Parts Pricelist 20260323.xlsx`.

## Review Focus

- Visit with `hours: null`/missing → clear error naming machine + visit, never a $0 labor line.
- Odd rates (e.g. labor $125.10, 75%) → discounted rate rounds half-up to the cent, totals stay in whole cents (no float drift like 0.1+0.2).
- Multi-visit machines (Eversys, 3 visits) → trip is charged per visit, not once per guide.
- A configuration/variant id that doesn't exist, or a part id referenced but not defined → throws with the offending id.
- MP variant only adds parts; the standard variant total is unchanged by the MP definition.
- Long part names/many parts rows → text must not overflow or clip on the 960×540 page.

---

## File Structure

- `pm-guides/rates.json` — shared labor/trip/discount rates.
- `pm-guides/data/la-marzocco-linea-classic-s.json` — Linea Classic S machine data.
- `pm-guides/data/eversys-legacy-l2.json` — Eversys sample data (regression only).
- `scripts/pm-guide/calc.mjs` — pure calculator.
- `scripts/pm-guide/render.mjs` — calculator output → HTML pages (string) and PDF.
- `scripts/pm-guide/cli.mjs` — `node scripts/pm-guide/cli.mjs <machine-id>`.
- `scripts/pm-guide.test.mjs` — all tests (calculator, data, render, CLI).
- `pm-guides/out/` — generated PDFs (committed so the user can open them).

### Data model (shared by all tasks)

```json
{
  "id": "la-marzocco-linea-classic-s",
  "name": "La Marzocco Linea Classic S",
  "subtitle": "12-month preventive maintenance",
  "unitLabel": "group",
  "source": ["Linea S – Linea Classic S 12M PM Checklist.pdf", "LMUSA Parts Pricelist 20260323"],
  "visits": [{ "id": "m12", "label": "Annual PM", "month": 12, "hours": 2, "services": "…" }],
  "parts": [{ "id": "gasket8", "name": "…", "partNo": "H.3.001", "unitCents": 358,
              "visits": ["m12"], "qty": { "base": 0, "perUnit": 1 } }],
  "configurations": [{ "id": "g1", "label": "1 Group", "units": 1, "qtyOverrides": {},
     "variants": [{ "id": "standard", "label": "Standard", "addParts": [] },
                  { "id": "mp", "label": "MP", "addParts": ["mpValve"] }] }],
  "inspectOnly": [{ "name": "…", "partNo": "…", "unitCents": 0, "note": "…" }]
}
```

Line quantity = `qtyOverrides[partId] ?? qty.base + qty.perUnit * units`. A part with `"optional": true` (e.g. MP valve) is included only when a variant lists it in `addParts`.

---

### Task 1: Calculator, rates, Linea data

**Files:**
- Create: `pm-guides/rates.json`, `pm-guides/data/la-marzocco-linea-classic-s.json`, `scripts/pm-guide/calc.mjs`
- Test: `scripts/pm-guide.test.mjs`

**Interfaces:**
- Produces: `loadRates(path?: string): Rates` where `Rates = { laborRateCents, tripRateCents, discountPct }`.
- Produces: `calcConfig(machine, rates, configId: string, variantId: string): Result` where `Result = { configId, variantId, visits: Visit[], partsCents, laborCents, tripCents, totalCents, standardLaborCents, standardTripCents, savingsCents }` and `Visit = { id, label, month, hours, lines: {partId, name, partNo, qty, unitCents, extCents}[], partsCents, laborCents, tripCents, totalCents }`.
- Produces: `discounted(standardCents: number, pct: number): number` (half-up).

- [ ] **Step 1: Write the failing tests** in `scripts/pm-guide.test.mjs`: `discounted rounds half-up to the cent` (`discounted(15000,75) === 3750`; `discounted(12510,75) === 3128`); `linea totals match the spec table` — for g1..g4 × standard/mp assert `totalCents` equals `[43191,45593,47995,50397]` and `[68246,95703,123160,150617]`; `linea savings are $337.50 per visit` (`savingsCents === 33750`); `fixed parts are $295.39` (g1 standard parts − per-group parts = 29539); `missing hours throws naming the machine and visit`; `unknown config/variant/part id throws naming the id`; `trip is charged once per visit` using a two-visit inline machine (`tripCents === 7500`); `mp does not change standard total` (compute standard before/after adding the mp variant).
- [ ] **Step 2: Run** `node --test scripts/pm-guide.test.mjs` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `pm-guides/rates.json` as `{ "laborRateCents": 15000, "tripRateCents": 15000, "discountPct": 75 }`; `pm-guides/data/la-marzocco-linea-classic-s.json` per the spec's parts table (H.3.001 $3.58 and F.3.040 $20.44 per group; L165/K $39.88 ×2, L192 $39.47 ×2, L190 $25.33, B.2.024 $99.38, F.9.000.01 $11.98 fixed; SA600/K2 $250.55 per group, `optional`, offered by the `mp` variant; one visit `m12`, `hours: 2`; configs g1–g4; inspect-only items LA052, L500, L510, L270/UL, L270/1 with their prices); and `scripts/pm-guide/calc.mjs` with the signatures above. Do all arithmetic in integer cents; `discounted = Math.round(standard * (100 - pct) / 100)` applied to rate then multiplied by hours (`laborCents = Math.round(discountedRate * hours)`).
- [ ] **Step 4: Run** `node --test scripts/pm-guide.test.mjs` — Expected: all PASS.
- [ ] **Step 5: Commit** `git add pm-guides scripts/pm-guide scripts/pm-guide.test.mjs && git commit -m "Add PM guide calculator and Linea Classic S data"`

### Task 2: Eversys regression data

**Files:**
- Create: `pm-guides/data/eversys-legacy-l2.json`
- Test: `scripts/pm-guide.test.mjs`

**Interfaces:**
- Consumes: `calcConfig`, `loadRates` from Task 1.

- [ ] **Step 1: Write the failing test** `eversys data reproduces the original sample (parts + program labor)`: for configs `base,g2,g3,g4` assert `partsCents` = `[227500,277000,328900,378400]`, `laborCents` = `39375` each (hours 3, 3, 4.5 at $37.50); per-visit parts are `36000` at months 12 and 24 and, at month 36, `155500, 205000, 256900, 306400` (module kits $1,036.00 + burrs $519.00/$1,014.00/$1,533.00/$2,028.00). Also assert `tripCents === 3 * 3750` and `totalCents === partsCents + laborCents + 11250` (trip now discounted and included).
- [ ] **Step 2: Run** the test — Expected: FAIL (file missing).
- [ ] **Step 3: Implement** the Eversys JSON from `Eversys_Legacy_PM_Program_Pricing.pdf`: three visits (m12 3 hrs, m24 3 hrs, m36 4.5 hrs), kits EV113692 $187 & EV113696 $173 at all three visits, EV113697 $146, EV113695 $395, EV113701 $135 at m36 only, regular burrs 113706 $12 and metal burrs 114311 $495 at m36 with `qtyOverrides` per configuration (regular 2/2/4/4, metal 1/2/3/4); one `standard` variant. Note: this is a calculator-level regression; the Eversys PDF page layout is not re-created.
- [ ] **Step 4: Run** the tests — Expected: PASS. If a figure differs from the PDF, fix the data, not the expectation.
- [ ] **Step 5: Commit** `git commit -am "Add Eversys regression data and test"` (after `git add pm-guides/data`).

### Task 3: HTML page renderer

**Files:**
- Create: `scripts/pm-guide/render.mjs`
- Test: `scripts/pm-guide.test.mjs`

**Interfaces:**
- Consumes: `calcConfig`, `Rates`.
- Produces: `renderGuideHtml(machine, rates): string` — a full HTML document of `<section class="page">` elements, each 960×540, order: cover, parts table, one page per configuration, summary.
- Produces: `formatMoney(cents: number): string` → `"$1,506.17"`.

- [ ] **Step 1: Write the failing tests**: `formatMoney` cases (`0 → "$0.00"`, `150617 → "$1,506.17"`); `html has cover + parts + 4 config pages + summary` (count `class="page"` === 7 for Linea); `html shows every expected annual total` (all eight totals from the spec table appear); `html shows 75% off, $37.50 labor and $37.50 trip`; `every page carries the pricing disclaimer` (count of the disclaimer string === page count); `inspect-only items are listed with prices and "not included"`; `long part name does not overflow`: render a machine with a 120-char part name through Task 4's PDF path is covered in Task 4, here assert the table cell uses `overflow-wrap:anywhere` in the CSS.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `renderGuideHtml` and `formatMoney` in `render.mjs`. Layout per spec "Guide layout": cover (machine, subtitle, stat tiles: interval, visits, 75% off, program labor/hr, program trip), parts table (module/part #/what/interval/unit), per-config page (parts list with qty/ext, cost breakdown as a CSS bar chart parts/labor/trip, Standard vs MP totals side by side, savings), summary table + "Good to know". Use inline CSS, system font stack, `@page { size: 960px 540px; margin: 0 }`, tabular figures. No external assets. Use `overflow-wrap:anywhere` on table cells.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git add scripts/pm-guide && git commit -m "Add PM guide HTML renderer"`

### Task 4: PDF output, CLI, and the Linea guide

**Files:**
- Create: `scripts/pm-guide/cli.mjs`, `pm-guides/out/la-marzocco-linea-classic-s.pdf`
- Modify: `package.json` (add script `"pm-guide": "node scripts/pm-guide/cli.mjs"`)
- Test: `scripts/pm-guide.test.mjs`

**Interfaces:**
- Consumes: `renderGuideHtml`, `loadRates`.
- Produces: `renderGuidePdf(machine, rates, outPath: string): Promise<void>` in `render.mjs`; CLI `node scripts/pm-guide/cli.mjs <machine-id>` writes `pm-guides/out/<machine-id>.pdf` and exits non-zero with a message for an unknown machine id.

- [ ] **Step 1: Write the failing tests**: `cli builds a 7-page pdf for linea` (run the CLI via `execFileSync`, then `pdfinfo` reports `Pages: 7` and `Page size: 720 x 405 pts`); `pdf text contains each annual total` (`pdftotext` output includes all eight totals); `cli exits non-zero for an unknown machine id`; `a 120-character part name does not clip` (render a temp machine, `pdftotext` contains the full name).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `renderGuidePdf` with `chromium.launch()` from `playwright`, `page.setContent(html)`, `page.pdf({ width: "960px", height: "540px", printBackground: true })`. If `node_modules` is missing run `npm install` first. Implement the CLI and the `package.json` script.
- [ ] **Step 4: Run** `node --test scripts/pm-guide.test.mjs` and `npm test` — Expected: all PASS.
- [ ] **Step 5: Generate and inspect**: `npm run pm-guide -- la-marzocco-linea-classic-s`; convert each page to PNG (`pdftoppm -r 60 -png`) and view all seven for overflow, clipped text, or an unreadable chart; fix and regenerate until clean.
- [ ] **Step 6: Commit** `git add package.json scripts/pm-guide pm-guides/out && git commit -m "Add PM guide CLI and Linea Classic S guide PDF"` then push to `claude/focused-ptolemy-tnzuxk`.

### Task 5: How to add the next machine

**Files:**
- Create: `pm-guides/README.md`

- [ ] **Step 1:** Write a one-page README: the data model above, how to add a machine (copy the Linea JSON, replace visits/parts/configs, run the CLI), where rates live, and the rule that missing hours are an error.
- [ ] **Step 2:** Verify the instructions by following them with a throwaway copy of the Linea JSON under a new id; confirm a PDF is produced; delete the copy.
- [ ] **Step 3: Commit** `git add pm-guides/README.md && git commit -m "Document adding a PM guide machine"`
