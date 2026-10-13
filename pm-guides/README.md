# PM guides

One data file per machine in `data/`, shared rates in `rates.json`, PDFs in `out/`.

## Build a guide

    npm run pm-guide -- la-marzocco-linea-classic-s

Writes `pm-guides/out/<machine-id>.pdf`. Run `npm test` to check the totals.

## Rules

- Labor and trip are both discounted by `discountPct` (75%) from the standard rates in `rates.json`.
  The trip is charged once per visit and is included in every total.
- Each visit needs `hours` from the source PM spec. A missing value is an error, never $0.
- Prices are list price, in cents, from the manufacturer price list.

## Add a machine

1. Copy `data/la-marzocco-linea-classic-s.json` to `data/<new-id>.json` and change `id`, `name`, `subtitle`, `unitLabel`, `source`.
2. `visits`: one entry per scheduled PM (`id`, `label`, `month`, `hours`, `services`).
3. `parts`: `partNo`, `unitCents`, the `visits` it is replaced at, and `qty` = `base + perUnit x units`.
   Mark add-on parts (e.g. MP valve) `"optional": true` and list them in a variant's `addParts`.
   Use a configuration's `qtyOverrides` when quantities are not linear (see `eversys-legacy-l2.json`).
4. `configurations`: `units` (e.g. group count) and `variants`.
5. `inspectOnly`: parts checked but not priced into the totals.
6. Build it with the command above and look at every page.
