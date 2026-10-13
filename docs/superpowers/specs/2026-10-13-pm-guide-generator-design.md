# PM Guide Generator — Design

Date: 2026-10-13
First machine: La Marzocco Linea Classic S (12-month PM)
Reference layout: `Eversys_Legacy_PM_Program_Pricing.pdf` (8 pages, 960×540, 16:9)

## Goal

Produce customer-facing preventive-maintenance (PM) guides with current parts
pricing, PM intervals, and a 75% discount on labor and trip charge, one guide
per machine/model. Adding a machine later should mean adding a data file, not
changing the template.

## Pricing rules (apply to every guide)

- Standard labor rate: **$150.00/hr**. Program labor: **25% of standard = $37.50/hr**
  (75% off).
- Standard trip charge: **$150.00 per visit**. Program trip: **$37.50 per visit**
  (75% off). Trip is **included** in every package and every total (the
  Eversys sample excluded it).
- Labor hours come from the PM spec per visit. Where a source document has no
  hours, the field is left empty and flagged — never guessed.
- Visit total = parts + program labor + program trip.
- Savings shown vs standard = (standard labor + standard trip) − (program labor + program trip).
- Parts prices come from the manufacturer price list supplied with the machine
  (list price). The footer disclaimer "Parts pricing is subject to change…" appears on every page.
- Rates, hours, and the discount percentage are defined once, so changing a
  number updates every page.

## First guide: La Marzocco Linea Classic S

Sources: `Linea S – Linea Classic S 12M PM Checklist.pdf` and
`La Marzocco – LMUSA Parts Pricelist 20260323.xlsx` (price list dated March 23, 2026).

**Structure:** a single annual PM, recommended every year, ~2.0 hrs labor,
1 trip per visit. No multi-year schedule.

**Configurations:** 1, 2, 3 and 4 group. Each configuration page shows the
standard version and the MP version (adds MP valve rebuild per group) side by side.
AV models have extra tests only and no extra parts.

### Parts list

Per group (× group count):

| Part | Part # | Unit |
|---|---|---|
| Group gasket, 8 mm (default) | H.3.001 | $3.58 |
| Diffuser screen | F.3.040 | $20.44 |

Fixed per visit:

| Part | Part # | Qty | Unit |
|---|---|---|---|
| Steam valve rebuild kit | L165/K | 2 (one per wand) | $39.88 |
| Steam valve anti-suction valve | L192 | 2 | $39.47 |
| Steam boiler vacuum breaker | L190 | 1 | $25.33 |
| Pressure safety valve | B.2.024 | 1 | $99.38 |
| Water test kit | F.9.000.01 | 1 | $11.98 |

MP only (× group count): MP valve rebuild kit SA600/K2, $250.55.

Inspect-only items (not in price; listed as "quoted only if replaced"):
auto-fill probe LA052 $52.86; contactor L500 $210.17 (2/3 group) or L510 $428.79
(4 group); pressure-stat L270/UL $358.74 (membrane kit L270/1 $85.82).
Portafilter baskets have no part number on the checklist and are not priced.

### Expected annual totals

Labor 2 hrs × $37.50 = $75.00; trip $37.50; fixed parts $295.39.

| Config | Standard parts | Standard total | MP add-on | MP total |
|---|---|---|---|---|
| 1 group | $319.41 | $431.91 | $250.55 | $682.46 |
| 2 group | $343.43 | $455.93 | $501.10 | $957.03 |
| 3 group | $367.45 | $479.95 | $751.65 | $1,231.60 |
| 4 group | $391.47 | $503.97 | $1,002.20 | $1,506.17 |

Savings per visit vs standard rates: $337.50 ($450.00 standard labor + trip − $112.50).

## Guide layout

Matches the Eversys sample's look and flow, adapted to a single visit:

1. Cover/overview — machine, annual PM, rates (hours, $37.50/hr labor, $37.50 trip, 75% off).
2. PM kit / parts table — module, part #, what it is, interval (every 12 months), unit cost.
3. One page per configuration (1–4 group) — parts list, cost breakdown chart
   (parts / labor / trip), annual total for standard and MP, savings.
4. Summary — annual cost by configuration; "good to know" notes
   (annual PM recommended, inspect-only items quoted if replaced, installation not included).

## Architecture

- **Data file per machine** (JSON): machine name, source docs, visit schedule
  (interval, labor hours), parts (name, part #, unit cost, per-group or fixed
  quantity, variant), configurations, inspect-only items.
- **Shared rates file**: labor rate, trip charge, discount %.
- **Calculator**: pure function from machine data + rates → per-config totals,
  savings.
- **Template + renderer**: HTML/CSS slide pages at 960×540 rendered to PDF with
  the preinstalled Chromium (Playwright).
- **Output**: `pm-guides/<machine>.pdf` (data in `pm-guides/data/`).

## Validation

- Unit tests for the calculator against the table above (every figure must match to the cent).
- Regenerate the Eversys sample from its data and confirm it matches the original, except trip is now
  discounted and included.
- Visual check of each rendered page (text overflow, chart, footer).

## Out of scope

- A UI for editing guides, customer-specific quoting, installation pricing, and
  inspect-only parts in totals.
- Additional machines (added later as data files).

## Open items

- Whether a 12-month visit for other machines uses the same layout (decide per machine).
- Source-sheet prices are list prices; any customer-specific discount on parts is not applied.
