# KatzDesk Cleanup Plan

Phase 1 output. Read-only audit of `main` at `05afd25` (latest migration `0042_library_book_variation.sql`).
No app code was changed to write this. Phase 2 implements the "Plan" section in the order written, one area per commit.

How each finding was checked is stated on the finding:

- **Seen** — reproduced in the running app (local preview, seed data, admin login).
- **Read** — found by reading the code; not reproduced.
- **Not checked** — could not be checked here; the reason is given.

The local preview has seed data only. It has no rack stock on the Front or Back rack and none of the real spec sheets,
so anything that depends on real stock or real PDFs is marked.

Baseline before any Phase 2 change: all 18 routes load with a heading and no page errors; `npm run typecheck`, `npm run lint`
and `npx vite build` pass; `npm test` has 156 passing and 9 failing (the 9 are the Grok share-card tests, failing before this work).

---

## 1. Route Map

| Route | What the user does | Mounts (src/components/desk) | Rule owner (src/lib/ops) |
| --- | --- | --- | --- |
| `/` index | Sees today's clock: what is coming due, flagged, and rebuild alerts. | coming-due, rebuild-alerts, flag-badge, my-view-bar, open-link, ping-button, sort-bar | clock.ts (due/aging), api.ts (dashboard) |
| `/service` | Works the service ticket list and opens a ticket. | jobs-page → job-sheet, thread | ticket-status.ts, api.ts |
| `/tlc` | Works TLC + Factor jobs; same screen as service with a different kind. | jobs-page → job-sheet, thread | ticket-status.ts, api.ts |
| `/pms` | Tracks preventative maintenance dates and opens a PM. | entity-sheets (PM sheet), desk-charts, export-dialog, tech-select, my-view-bar | clock.ts, ticket-status.ts, my-view.ts |
| `/planner` | Sees pending work on a month calendar and drags a job to another day. | planner-calendar, pending-calendar, install-planner, desk-charts | api.ts, equipment.ts |
| `/handoff` | Reads and replies to the sales ↔ service conversation. | handoff-reply, ping-button, open-link, sort-bar | api.ts, lookups.ts, mentions.ts |
| `/installs` | Preps installs: equipment, pre-inspection, recipes, mark installed. | entity-sheets (install sheet), machine-fields, pre-inspection-panel, recipe-sheet, recipe-form, directory-fields, export-dialog | machines.ts, equipment.ts, pre-inspection.ts, inspection-api.ts, clock.ts |
| `/recipes` | Edits house and customer recipe templates. | recipe-form | equipment.ts (findRecipeFor), recipe-fields.ts, api.ts |
| `/pipeline` | Moves equipment deals through Good To Order → Ordered. | entity-sheets (deal sheet), rep-deals-panel, rep-select, desk-charts | rep-match.ts, reps.ts, clock.ts |
| `/library` | Picks a manufacturer, then a model, and opens or sends its spec, manuals and parts. | library-files, spec-sheet, spec-import, image-lightbox | library-file-rules.ts, library-files.ts, spec-library.ts, spec-defaults.ts, spec-image-pick.ts |
| `/warehouse` | Sees rack stock by bay and level, adds, moves and tests units. | asset-sheet, multi-move, stock-actions, unit-place-field, desk-charts | warehouse.ts, rack-stock.ts, unit-place.ts, unit-place-rules.ts |
| `/rebuilds` | Runs in-house rebuild projects on a board. | rebuild-board, rebuild-planner, rebuild-sheet, owner-select | rebuild-model.ts, rebuilds.ts |
| `/locations` | Sees units that are at a site, not on a rack, and moves them. | asset-sheet, stock-actions, unit-place-field, directory-fields | unit-place.ts, unit-place-rules.ts, warehouse.ts |
| `/modules` | Tracks Eversys modules: at HQ, or assigned to a unit on an account. | module-assign, entity-sheets (module sheet), export-dialog | eversys.ts, api.ts |
| `/customers` | Searches accounts and opens one to see every record on it. | customer-sheet, account-equip-import, rename-dialog, rep-select, show-more | customer-identity.ts, account-equip.ts, api.ts |
| `/network` | Manages third-party service companies and dispatches them. | provider-sheet, provider-dispatch, rename-dialog | network.ts, network-api.ts |
| `/settings` | Sets display preferences, reps, roster, and password. | prefs-provider, reps-editor, roster-editor, theme-toggle | prefs.ts, password-reset.ts |
| `/access` | Admin approves accounts and sets roles. | sort-bar | access.ts, password-reset.ts |

Shared by every route: `shell.tsx` (side menu, banner, single Katz Desk wordmark), `search.tsx` (banner search),
`notify-bell.tsx` (pings), `src/components/ui/dialog.tsx`, `sheet.tsx`, `anchored-list.tsx`, `combo-field.tsx`.

---

## 2. Findings

### F1. Install bubble repeats the same equipment, serial and location — **Seen**

Opened the install sheet for a three-machine install ("Coco Crepes Bellaire"). In one bubble, top to bottom:

1. **Pre-inspection "Which Machine?"** lists machines, each with a "No serial · Electrical missing" line.
2. **Warehouse Units** lists units pulled from the rack (model · serial · slot).
3. **Equipment** chips list the models again.
4. **One block per model** with its own Serial, Voltage, Location/Rack picker and Recipe.

So the model name appears in four places, serial in three (inspection line, warehouse unit, model block), and
location in two (warehouse unit slot, model block Location/Rack).

Files: `entity-sheets.tsx` (InstallSheet, InstallAssets), `machine-fields.tsx`, `pre-inspection-panel.tsx`.

### F2. Pre-inspection does not split the machines the way the install does — **Seen**

Same install: the Equipment section shows three machines, but Pre-inspection shows "0/2 machines" and both entries
are named with the whole string `La Marzocco Linea Classic S 2 Group AV/ La Marzocco Swift Dual-Hopper Espresso Grinder/ Bunn Axiom-APS`.
The install list row shows "0/1" for the same install. Three different machine counts for one install.

Files: `inspection-api.ts` (how inspection machines are created from the install), `machines.ts` / `equipment.ts` (the splitter the install uses).
This touches how inspection rows are created, which is close to the pass/fail rules. See Open Questions Q1.

### F3. Recipes are on the equipment row, and also in two other places — **Seen / Read**

The recipe picker is already on each model block in the install sheet (`machine-fields.tsx`). **Seen.**
The install list row also has a recipe chip per model that opens a separate editor (`RecipeChip`, `RecipeEditorSheet` in `installs.tsx`), and `/recipes` edits templates. **Read.**
So a recipe for one machine can be set from the row chip or from the model block.

Also seen: the recipe list on a La Marzocco block offers "Standard · Bunn Axiom-APS", "Standard · Eversys Cameo…", "Standard · Fetco 2051e" — house templates are not filtered to the model. See Q2.

### F4. Library variations — **done in 0042; one leftover to confirm**

Each spec sheet's full model name is its own selection, and clicking one shows only its documents. Checked with two stand-in Axiom variations. **Seen.**
Not checked: the one-time split of an existing book that holds several spec sheets (the local data had only single-sheet books).
Files left in an old family book after the split stay under a plain "Axiom" selection until moved by hand — by design, so nothing is guessed.

### F5. Spec machine photo and dimension diagram — **done; real PDFs not checked**

The photo picker rejects warning symbols, logos, barcodes and line drawings, saves the photo, and it survives a refresh. The dimension drawing is only ever the secondary image. **Seen with stand-in PDFs.**
`EquipmentImage` in `spec-sheet.tsx` has no fallback to the dimension image. **Read.**
Not checked: the real brewer sheet that showed the warning triangle (not available here).

### F6. Plug rules — **Read; match the stated rules**

`decidePlug` in `spec-defaults.ts`:
- 3-phase → Hardwire only. ✔
- 220V 4-wire → L14-20 (≤20A or amps unknown), L14-30 (≤30A). Bunn Axiom at 220V is a 4-wire model exception → L14-20. ✔
- 220V 3-wire → L6-20 / L6-30. ✔
- 220V with no wire count → plug left unset with "Wire count missing". ✔

No other file decides a plug. Install machines carry a free-text Voltage field only (`machine-fields.tsx`); nothing derives a plug from it.
Two things the stated rules do not cover are already coded: 4-wire above 30A → `NEMA 14-50`, 3-wire above 30A → `NEMA 6-50`. See Q3.

### F7. Banner search list slides behind the banner — **Seen**

Typed in the banner search, then scrolled with the list open. The list is positioned in page coordinates, so it moved up
with the page (its top went from 57px to −335px) and the sticky banner covered it.
File: `src/components/ui/anchored-list.tsx` (`placeNode` sets `position: absolute` and `z-index: 1`); the banner is `z-20`.

The "Add another…" equipment list inside the install sheet painted on top correctly when opened. **Seen.**
Not checked: the same list after scrolling inside the sheet, and the other users of the shared list (`combo-field.tsx`, `mention-field.tsx`).

### F8. Center bubbles and scroll — **Read; not reproduced**

`dialog.tsx` locks the page and gives the bubble its own scroll area (`data-dialog-scroll`, `max-height: calc(100dvh − 5.75rem)`).
Dialogs that open from inside another dialog or sheet (rename, delete confirm, book picker, lightbox) each add their own page lock.
I did not reproduce a locked scroll. The automated check I wrote looked for the wrong element, so this is **unverified**, not passed.

### F9. Hover lifts the whole row — **Read**

`styles.css` lifts every button, link and `.desk-lift` element on hover unless it contains another control.
Eight places make an entire row or card one big button, so the whole row lifts:
`jobs-page.tsx` (ticket row), `pms.tsx` (PM row), `customers.tsx` (account row), `network.tsx` (company row),
`modules.tsx` (module row), `customer-sheet.tsx` (record row), `coming-due.tsx` (due row), `rebuild-board.tsx` (board card),
plus `desk-charts.tsx` (stat tile) and `spec-library.tsx` (now unused).
Rows that contain smaller controls do not lift; only those controls do.

### F10. Pings and the record they name — **Read; two gaps**

`notify-bell.tsx` opens `/<route>?open=<id>` for tickets, PMs, installs, deals, rebuilds, modules, customers, and the handoff comment.
Every one of those routes reads `?open=`. Gaps found by reading:

- **Unit pings** (`asset`) always go to `/warehouse`. That screen only knows units on a rack. A unit that has since moved to a site is on `/locations`, so the ping lands on Warehouse and nothing opens.
- **Record not in the loaded list.** Installs, PMs, deals, modules and rebuilds find the record in the list already on screen. If the record is deleted or not in that list, the page loads and nothing opens, with no message.

Not checked: clicking a real ping of each kind end to end.

### F11. Pre-inspection photos — **done**

Photos enlarge on click or tap and can be downloaded from the enlarged view and from the thumbnail. **Seen** for Power, desktop and phone size. Water, Drain, Ethernet and Space use the same tile.

### F12. Warehouse — **Read; local data has no rack stock**

- **One unit per section:** not the case in code. A section (rack + bay + level) holds up to 12 units (`rack-stock.ts` `nextLine`, `LINES` 1–12); the board says "up to 12".
- **Front rack ↔ Back rack:** the place picker is rack → bay → level and the server accepts either rack (`unit-place-field.tsx`, `unit-place.ts`). Multi-move takes a rack as the destination.
- **Mismatch found:** the picker and the server accept bays **A–P on both racks**, but the Warehouse board draws the Front rack with bays **I–P only** (`FRONT_PALLETS` in `warehouse.ts`, used by `warehouse.tsx` and `api.ts`). A unit placed on Front · A through Front · H is saved but has no cell on the board. Capacity counts assume Front = 8 bays. See Q4.

None of this was exercised in the browser: the local preview has no units on a rack.

### F13. Modules at HQ vs assigned — **Read; done in an earlier change**

`modules.tsx` fades assigned rows (55% opacity, muted background) and shows the unit and account they are on; filters are Available / Assigned / All; HQ rows show "At HQ" or the shelf.
Not re-checked in the browser in this pass.

### Seen while auditing, not on the list (no change planned)

- Install Clock shows "Ready 0" at the top while one row carries a green "Ready" badge. The top count means "equipment ready **and** pre-inspection passed"; the row badge appears to mean equipment only.
- The repository is public and contains customer and service data files.

---

## 3. Plan (Phase 2 order)

One area per commit. After each: the screen loads, typecheck, lint, build, and tests at the same 9 known failures.

1. **Banner search list (F7).** Keep the list pinned under its search box while the page or its container scrolls, and above the banner. Check `combo-field` and `mention-field` the same way, inside a sheet and after scrolling.
2. **Center bubble scroll (F8).** First reproduce on desktop and phone: long bubble, bubble opened from a sheet, lightbox over a bubble. Fix only what reproduces. If nothing reproduces, record that and change nothing.
3. **Hover lift (F9).** Whole-row and whole-card buttons get the background highlight only; lift stays on small controls. CSS-only; no layout or colour change.
4. **Pings (F10).** Unit pings open on Warehouse or Locations, whichever holds the unit now. When a record cannot be found, say so in a toast. Click one ping of each kind.
5. **Install bubble duplicates (F1).** Show each machine once: model, serial, voltage, location, recipe on its own block. Warehouse Units and the inspection list refer to that block instead of repeating serial and location. No field is removed from the data. Depends on Q1 for the inspection list.
6. **Recipes on the equipment row (F3).** Keep the picker on the model block as the one place to set a machine's recipe; the list-row chip becomes a read-only label that opens the block. `/recipes` stays as the template editor. Model filtering only if Q2 is answered.
7. **Warehouse Front rack bays (F12).** Only after Q4. Then test Front → Back and Back → Front moves, and a section holding more than one unit, with real or seeded rack stock.
8. **Library leftovers (F4).** Seed a book with two spec sheets and confirm the split; no code change expected.
9. **Modules (F13) and Spec image (F5).** Re-check in the browser; no code change expected.
10. **Titles.** Confirm every page title is Title Case and the Katz Desk wordmark appears once. All 18 headings were Title Case in this pass.

Not planned: plug rules (F6) and pre-inspection photos (F11) already match.

---

## 4. Open Questions (fields stay unchanged until answered)

- **Q1 — Pre-inspection machines.** Should an install with three pieces of equipment have three inspection machines, one per piece? Existing inspections with photos and pass/fail on a combined machine would need a rule for where those go. Until answered, inspection rows are not changed; only the display in item 5.
- **Q2 — Recipe list.** Should a machine only offer templates for its own model, plus that customer's recipes?
- **Q3 — Plugs above 30A.** 220V 4-wire above 30A is coded as NEMA 14-50 and 3-wire above 30A as NEMA 6-50. Keep, or leave unset for the electrician?
- **Q4 — Front rack bays.** Is the Front rack physically bays I–P (8 bays), or A–P like the Back rack? If I–P, the picker should stop offering A–H on Front. If A–P, the board and the capacity count need the other 8 bays.
