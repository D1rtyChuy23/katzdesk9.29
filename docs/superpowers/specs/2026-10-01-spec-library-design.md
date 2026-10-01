# Spec Library — Design

Date: 2026-10-01 · Status: awaiting review

## Goal

Let staff drop a manufacturer spec sheet PDF into KatzDesk and get back a
KatzDesk-styled page for that machine: USA-relevant specs only, selectable
configurations, per-configuration requirements, and a Copy button that gives the
sales team clean text to paste into emails or messages.

## Decisions already made

- Storage is the app database (Neon on deploy, PGLite in preview). Grok's
  sandbox and Vercel have no persistent disk, so files on disk are not an option.
- Only structured data is saved. The original PDF is **not** kept.
- PDFs are read with AI extraction (xAI API, `XAI_API_KEY`, model `grok-4.5`)
  followed by a mandatory human review step. Nothing saves before confirmation.
- Non-USA content is removed at import (see Filtering).

## Data (migration `migrations/0036_spec_library.sql`)

`spec_sheets` — one row per machine
- `id` serial pk, `manufacturer` text, `model` text, `category` text,
  `summary` text, `specs` jsonb (label/value pairs), `mfr_notes` jsonb
  (USA-relevant manufacturer info: contact, warranty, certifications such as
  UL/NSF), `created_by` text, `created_at`, `updated_at`.
- Unique on (`manufacturer`, `model`) — re-importing the same machine updates it
  after the user confirms the overwrite.

`spec_configs` — one row per configuration
- `id` serial pk, `sheet_id` fk (on delete cascade), `label` text, `position` int,
  `requirements` jsonb:
  `power` {voltage, amps, phase, hz, plug, circuit},
  `water` {inlet, pressure, filtration, notes},
  `drain` {size, notes},
  `dimensions` {width, depth, height, weight, clearance},
  `other` list of {label, value}.
  Every field optional; the UI hides empty ones.

## Import flow

1. `/library` shows a drop zone (PDF only, max 10 MB).
2. The browser extracts text from the PDF client-side; the server function
   `extractSpecSheet` receives text, never the file.
3. Server calls the xAI chat API with a fixed instruction and a JSON schema;
   response is validated with zod. Invalid JSON → one retry → error state.
4. Result opens in a review form (same layout as the saved page, all fields
   editable). Items removed by the non-USA filter are listed in a "Removed"
   panel with a restore button.
5. Confirm → `saveSpecSheet` upserts the sheet and replaces its configs in one
   transaction.
6. Fallbacks: no `XAI_API_KEY`, no extractable text (scanned PDF), or extraction
   failure → message plus a blank manual form with the same structure.
7. Guards: admin/sales only, 10 MB cap, per-user import rate limit (e.g. 10/hour)
   because each import spends the owner's credits.

## Filtering (non-USA content)

Done twice: the extraction prompt instructs the model, then a deterministic
pass (`spec-filter.ts`) drops/flags: 220–240 V and 50 Hz values, CE/UKCA/RoHS-only
certification lines, non-US plug types (Schuko, BS 1363, etc.), and metric-only
water standards. Values with both units keep the imperial one. Manufacturer
contact info is kept only for US entities. Anything dropped is reported to the
review panel, never silently lost.

## UI

- Sidebar item labeled "The Library" (`/library`, `src/routes/_app/library.tsx`) beside
  Recipes; components under `src/components/desk/` (`spec-library.tsx`,
  `spec-sheet.tsx`, `spec-import.tsx`) matching existing Radix/Tailwind patterns.
- List: searchable/filterable cards (manufacturer, category).
- Machine page: specs block, configuration chips (single select), requirements
  cards for the selected configuration.
- **Copy** buttons: "Copy this configuration" and "Copy all". Output is plain
  text, short lines, no markdown tables, e.g.:
  ```
  La Marzocco Linea PB — 2 Group
  Power: 208–240V, 30A, 1-phase, NEMA 6-30P
  Water: 3/8" inlet, 30–60 psi, filtered
  Drain: 1.5"
  Size: 31.5"W x 23.6"D x 20.5"H, 143 lb
  ```
  plus a clipboard fallback (select-and-copy) if the Clipboard API is blocked.
- Read: everyone with Desk access. Add/edit/delete: admin and sales via the
  existing `deskMiddleware` and role checks in `src/lib/ops/access.ts`.

## Server code

`src/lib/ops/spec-library.ts` (queries, server functions, zod schemas),
`src/lib/ops/spec-filter.ts` (pure filter), `src/lib/ops/spec-copy.ts`
(pure copy-text builder). Pure modules are kept free of DB/React for testing.

## Out of scope

Linking to equipment/customer records, keeping the original PDF, OCR for scanned
PDFs, multi-language sheets, versioning/history of edits.

## Testing

- `node --test` unit tests: `spec-filter`, `spec-copy`, and zod schema parsing
  of sample extraction output.
- Manual: import 2–3 real spec sheets in the preview; verify review form,
  non-USA removal, config selection and pasted copy output in Outlook/Teams.
- `npm run typecheck`, `npm run lint`, `npm run build` must pass (deploy is
  Vercel: no runtime filesystem writes).

## Risks

- Extraction quality varies by PDF layout; the review step is the safety net.
- xAI key may be absent or out of credits; manual form is the fallback.
- Client-side PDF text extraction needs a PDF library (e.g. `pdfjs-dist`) added
  to dependencies and checked for a clean Vercel build.
