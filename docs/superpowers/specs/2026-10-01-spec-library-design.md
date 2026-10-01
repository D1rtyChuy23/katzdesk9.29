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
