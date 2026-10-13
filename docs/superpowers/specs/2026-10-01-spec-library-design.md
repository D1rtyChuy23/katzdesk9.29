# The Library — Design

Date: 2026-10-01 · Status: **implemented on `main`** (commits 3bfc81c to 4b5a699).
This spec was updated to match what shipped; items marked *(added)* were not in
the original design.

## Goal

Let staff drop a manufacturer spec sheet PDF into KatzDesk and get back a
KatzDesk-styled page for that machine: USA-relevant specs only, selectable
configurations, per-configuration requirements, and a Copy button that gives the
sales team clean text to paste into emails or messages.

## Decisions

- Storage is the app database (Neon on deploy, PGLite in preview). Grok's
  sandbox and Vercel have no persistent disk, so files on disk are not an option.
- Only structured data is saved. The original PDF is **not** kept. *(added)* The
  one exception is a single equipment picture taken from the PDF and stored as a
  small resized image on the sheet.
- PDFs are read with AI extraction (xAI API, `XAI_API_KEY`, model `grok-4.5`)
  followed by a mandatory human review step. Nothing saves before confirmation.
- Non-USA content is removed at import (see Filtering).

## Data (`migrations/0036_spec_library.sql`, `0037_spec_sheet_extras.sql`)

`spec_sheets` — one row per machine
- `id`, `manufacturer`, `model`, `category`, `summary`, `specs` jsonb
  (label/value pairs), `mfr_notes` jsonb (`usContact`, `warranty`,
  `certifications[]`), `created_by`, `created_at`, `updated_at`.
- *(added, 0037)* `image` (resized JPEG data URL, about 100 KB), `core_hole`
  ('yes'/'no'), `core_diameter`.
- Unique on (`manufacturer`, `model`); re-importing the same machine updates it
  after the user confirms the overwrite.

`spec_configs` — one row per configuration
- `id`, `sheet_id` fk (on delete cascade), `label`, `position`, `requirements` jsonb:
  `power` {voltage, amps, **breaker** *(added)*, phase, hz, plug, circuit},
  `water` {inlet, pressure, filtration, notes},
  `drain` {size, notes},
  `dimensions` {width, depth, height, weight, clearance},
  `other` list of {label, value}.
  Every field optional; the UI hides empty ones.

`spec_import_log` *(added)* — one row per AI extraction, for the per-user hourly limit.

## Import flow

1. The Library page has an import drop zone (PDF only, max 10 MB).
2. The browser extracts text from the PDF (`pdfjs-dist`, `src/lib/pdf-text.ts`);
   the server function `extractSpecSheet` receives text, never the file.
   *(added)* The largest picture on the first pages is also taken, resized in the
   browser, and kept as the equipment image.
3. Server calls the xAI chat API (JSON mode); the reply is validated with zod
   (`spec-schema.ts`). Invalid JSON → one retry → error state.
4. Result opens in a review form (same layout as the saved page, all fields
   editable). Items removed by the non-USA filter are listed in a "Removed"
   panel with a restore button.
5. Confirm → `saveSpecSheet` upserts the sheet and replaces its configs in one
   transaction. Saving fills blanks only, so manual edits stick.
6. Fallbacks: no `XAI_API_KEY`, no extractable text (scanned PDF), or extraction
   failure → message plus a blank manual form with the same structure.
7. Guards: admin/sales only, 10 MB cap, per-user import rate limit of 10/hour.

## Filtering (non-USA content)

Done twice: the extraction prompt instructs the model, then a deterministic
pass (`spec-filter.ts`) drops/flags: 220–240 V and 50 Hz values, CE/UKCA/RoHS-only
certification lines, non-US plug types, and metric-only water standards. Values
with both units keep the imperial one. Manufacturer contact info is kept only for
US entities. Anything dropped is reported to the review panel, never silently lost.

## Katz install defaults *(added)* (`spec-defaults.ts`)

- **Water inlet** is always `3/8" compression valve` (also the blank form's start).
- **Plug** is derived from the electrical: 3-phase → "Hardwire only" (no image);
  208/220/240 V single-phase → NEMA L6-20 or L6-30 twist-lock from amps (L6-30
  default, with a visible note, when amps are unknown; 6-50 above 30 A);
  120 V → NEMA 5-15 or 5-20 from amps (twist-lock only if the sheet says so).
- **Breaker** recommendation shown under Amps and in the copy text (3-phase sized
  at 125% of load, 3-pole).
- **Counter core hole** (Space / Core Hole): espresso machines (La Marzocco,
  Eversys, Rancilio, Faema, category espresso) default to Yes, 3"; other
  equipment only when the sheet or pre-inspection says Yes, and a diameter is
  then required before saving. Never invents 3" for non-espresso.
- "Refresh Defaults" on saved sheets and a "Set Plug/Breaker/Inlet" button in the
  editor re-apply these rules.

## UI

- Sidebar item "The Library" (`/library`, `src/routes/_app/library.tsx`), *(changed)*
  placed in the **Shop** group under Warehouse and Rebuilds, and also visible to
  the warehouse role.
- *(added)* The page has three sections: **Spec Sheets** (live), **Manuals** and
  **Parts Diagrams** (shown but empty, ready for uploads later).
- List: searchable cards with manufacturer and category filters.
- Machine page: equipment image *(added)*, specs block, US manufacturer notes,
  configuration chips (single select), requirements cards for the selected
  configuration. *(added)* The Plug cell shows the NEMA plug face from the
  provided chart (`public/nema/*.png`, `plug-face.tsx`), labelled with the NEMA
  number.
- **Copy** buttons: "Copy this configuration" and "Copy all", plain text with
  short lines (`spec-copy.ts`), now including the breaker and core hole lines,
  with a clipboard fallback.
- *(added)* Pre-inspection Space shows the core hole diameter from the matching
  spec sheet (`coreHoleForModels`), with a warning when it isn't set.
- Read: everyone with Desk access. Add/edit/delete: admin and sales via
  `deskMiddleware` and the role checks in `src/lib/ops/access.ts`.

## Code map

- `src/lib/ops/spec-schema.ts` zod shapes; `spec-filter.ts`, `spec-copy.ts`,
  `spec-defaults.ts` pure logic; `spec-library.ts` server functions
  (`listSpecSheets`, `extractSpecSheet`, `saveSpecSheet`, `deleteSpecSheet`,
  `refreshSpecDefaults`, `getSpecImage`, `coreHoleForModels`).
- `src/lib/pdf-text.ts` PDF reading in the browser.
- `src/components/desk/spec-library.tsx`, `spec-sheet.tsx`, `spec-import.tsx`,
  `plug-face.tsx`.

## Out of scope (still)

Linking sheets to customer or equipment records, keeping the original PDF, OCR for
scanned PDFs, multi-language sheets, edit history. Manuals and Parts Diagrams
uploads are not built yet; only the empty sections exist.

## Testing

- `node --test`: `scripts/spec-library.test.mjs`, `scripts/spec-defaults.test.mjs`.
- Manual: import 2–3 real spec sheets; verify review form, non-USA removal,
  configuration selection, plug/breaker defaults, and pasted copy output in
  Outlook/Teams.
- `npm run typecheck`, `npm run lint`, `npm run build` must pass (deploy is Vercel:
  no runtime filesystem writes).

## Risks

- Extraction quality varies by PDF layout; the review step is the safety net.
- xAI key may be absent or out of credits; the manual form is the fallback.
- Images are stored in Postgres as data URLs; keep them resized (about 100 KB).

## Change request: deal equipment block (2026-10-13)

Scope: the equipment rows on a deal only. Do not rebuild the app.
Code: `src/components/desk/machine-fields.tsx`, `new-deal-dialog.tsx`,
`src/lib/ops/machines.ts` (`MachineSpec`), `install-ticket.tsx`.

1. **Sold / Loan / Lease — one selection.** Replace the separate Sold and Loaned
   controls with a single choice per machine: Sold, Loan, or Lease. It is one
   compact control, not three bubbles. `MachineSpec.ownership` accepts
   "Sold" | "Loaned" | "Leased"; existing "Sold" and "Loaned" rows keep working
   and display as Sold and Loan. Update the New Deal dialog, the install ticket
   (column and "not set" warning) and any text that says "Sold or Loaned".
2. **Remove the coffee bubble.** Delete the Coffee input from the equipment row
   and the Coffee column on the install ticket. Recipe is the only field for
   what the customer is serving. Keep `coffee` readable on old data but never
   shown or written.
3. **Recipe in the same window.** Add and remove recipe items in the same
   window as the Recipe field. No navigation to the Recipes page to edit the
   list. Removing an item that is not needed is a first-class action next to
   Add.
4. **No autofill of requirements.** Voltage, plug, water, drain and the other
   requirement fields stay blank until a person types them. Do not fill them
   from the model, the Library spec sheets, the Katz install defaults, or a
   serial-number pull (`onPulled` currently fills `powerVoltage`). A blank
   field is correct. This applies to the deal equipment block only; the
   Library's own spec sheet defaults are unchanged.

Acceptance: Sold / Loan / Lease shows as one selection; no coffee bubble;
recipe items add and remove in place; a newly added machine shows blank
requirement fields.

## Change request: install equipment fields and warehouse serial (2026-10-13)

Scope: the install equipment section and the warehouse-to-install assignment
only. Do not rebuild the app. Do not autofill volts, plug, or water.

1. **Clear placeholder text.** On the install equipment section, Plug and Water
   show text in the field (`placeholder="L6-30P"` and `placeholder='3/8" line'`
   in `src/components/desk/machine-fields.tsx`). Remove those placeholders. The
   field stays visibly empty until someone enters a value. A placeholder is not
   a value, and no plug or water inlet is written by default.
2. **Grinders have no Water field.** `waterNeed()` in
   `src/lib/ops/deal-board.ts` already returns "none" for grinders, but the row
   still shows the "No water or drain" note where the Water field was. Remove
   the Water field entirely for grinders (G9, G9-2T, Mazzer, Mahlkonig, any
   catalog grinder): no input and no note. Power and Space stay. Plug stays
   blank until filled. The install ticket (`install-ticket.tsx`) also stops
   showing a Water line for grinders. `cleanMachine` already drops a stored
   water value for grinders; keep that.
3. **Serial transfers from the warehouse.** `assignAssetToInstall` in
   `src/lib/ops/api.ts` links the asset to the install (`install_id`, `sold_to`)
   but does not write the unit's serial onto the install's machine row
   (`installs.machines`, same shape as `deals.machines`). When a warehouse unit
   with a serial is assigned, set that serial on the matching install machine
   row (match by model; if a row with that model has no serial, fill it; if all
   matching rows have serials, add or leave per the existing add-machine rules).
   The install section must show the serial that was on the warehouse unit. If
   the warehouse unit has a serial, never leave the install serial blank.
   Unassigning clears only a serial that came from that unit.

Acceptance: a grinder row has no Water field; a brewer's Plug and Water are
empty with no ghost text; an install row's serial matches the warehouse unit
just assigned.
