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

---

## 5. Phase 2 Result

Answers received: Q1 yes, Q2 yes, Q3 yes, Q4 yes. Q3 was read as "keep" (no change either way).
Q4 was an either/or question, so "yes" does not settle it; item 7 was **not** done.

After the last commit: all 18 routes load with their heading and no page errors; typecheck, lint and build pass; tests are 156 passing, 9 failing (the same 9 as before).

### Corrections to the Phase 1 findings

Two findings in section 2 were wrong. They are left above as written and corrected here.

- **F7 (search list behind the banner) — withdrawn.** The Phase 1 check measured the list's inner content, which scrolls inside the list. Measuring the list box itself: it stays pinned under the search box and on top while the page scrolls. No change made.
- **F10 (ping gaps) — mostly wrong.** Pings already resolve on the server (`notify.ts`): a unit opens in Warehouse or Locations by where it is now, and a removed record falls back to the account with a message. The same rule was missing from the banner **search**, which is what was fixed.

### What was done, in plan order

| # | Area | Result | Commit |
| --- | --- | --- | --- |
| 1 | Banner search list | No change. Not a bug (see correction). | — |
| 2 | Center bubble scroll | No change. Could not reproduce: a bubble taller than the screen scrolled, the side sheet scrolled, and the page scrolled again after closing, at desktop and phone width. Mouse wheel only; touch drag was not tested. | — |
| 3 | Hover lift | Whole rows and cards highlight instead of lifting; small controls still lift. Checked on a ticket row. | `b9e497c` |
| 4 | Pings / search | Search: a unit off the rack opens in Locations. Pings were already correct. Not done: a "not found" message when a stale link names a record that is gone. | `45374f5` |
| 5a | Pre-inspection machines (Q1) | One inspection machine per piece of equipment, split the same way as the install. The test install went from "0/2" with combined names to three named machines. Existing checks, notes and photos stay on the machine they were saved to; an old combined machine with none is taken off that install's inspection. Pass/fail rules untouched. | `9d123fc` |
| 5b | Install bubble duplicates | The Equipment chips above the machine blocks are gone; the add box stays and each block has its own remove button. Left as is: the inspection list's serial line and the Warehouse Units list (see below). | `9825ff2` |
| 6 | Recipes (Q2) | House templates are limited to the machine's model; the customer's own recipes are still offered; a recipe already picked stays listed. The row chip now opens the install instead of a second editor. | `9825ff2`, `24b0bfe` |
| 7 | Warehouse Front rack bays | **Not done — Q4 unanswered.** | — |
| 8 | Library split | Seeded an old-style family book holding two spec sheets and a manual; on load each sheet went to its own model and the manual followed its name. No code change. | — |
| 9 | Modules, spec image | Modules: Available (HQ) / Assigned / All filters present. Assigned-row fading was not looked at in this pass. Spec image: not re-run; unchanged since it was built. | — |
| 10 | Titles | All 18 headings are Title Case. One Katz Desk wordmark shows at a time (side menu on desktop, banner on phone). | — |

### Left unchanged on purpose

- **Warehouse Units and the inspection serial line on the install sheet.** Serial still appears there as well as on the machine block. Removing either changes how a unit is pulled or picked, which is a workflow rule, not a display one.
- **Recipe matching is by exact model name.** A template saved under a slightly different spelling of the model will no longer be offered on that machine.

---

## 6. Follow-Up: Front Rack Bays And Locked Units

Answers received: the Front rack is bays **I–P**. A unit assigned to an account is **locked**: it is an asset at that site or customer.

### Front rack bays (plan item 7) — done

- Every bay picker now offers I–P on the Front rack and A–P on the Back rack: the shared place picker, Return To Barn on a unit, and Add To Rack.
- The server refuses a Front rack bay A–H on every path that places a unit (`rackBayError` in `warehouse.ts`).
- Checked against the running app: adding to Front · A is refused; a unit moved Front · K → Back · B, was refused Back → Front · C, and moved Back → Front · K; a section held 9 units.
- Not changed: any unit already saved on Front · A–H keeps its label but still has no cell on the Front board. None exist in the local data; production was not looked at.

### Locked when assigned — done

- Found: `assignAssetToInstall` let a unit that was already assigned to one account be assigned to another install. The other paths (service, serial pull, place moves) already refused. It now refuses with "already assigned to <account>. Return it to the barn before assigning it again."
- Where a unit's Location is shown, an assigned or sold unit now shows its account with a lock and no picker, instead of a picker that failed on save.
- Returning a unit (Return To Warehouse on the unit, or removing it from the install) still unlocks it. Mark Sold is unchanged.
- Left as is: Rebuilds can reuse a serial assigned elsewhere after an explicit "confirm reuse". That is an existing, deliberate rule.

After this change: all 18 routes load; typecheck, lint and build pass; tests are 156 passing, 9 failing (the same 9).

## 7. Phase 3 Result

Checked in the running app at 1440px and 390px (Playwright, real touch drag for scroll), with a second test teammate so pings could be sent to the test admin.

### Fixed

- **Result lists stranded over a field.** `AnchoredList` only moved on scroll or resize. Picking a machine adds a chip that moves the input, so the equipment list stayed over the field. It now follows its input every frame while open. This is the shared list behind every search and picker, so it applies on every page and in every bubble.
- **New Install bubble.** Equipment was shown twice (chips and rows) and the rows stayed hidden until a customer was picked. Now one compact row per unit (model, serial, voltage, location, recipe, choose or add recipe on that row), shown as soon as a machine is added, with a remove on each row. The customer is picked once and never asked again. The existing-install sheet already had this layout.
- **Row alignment.** Rows are two columns on a phone and one line at 1024px and up. Rack, Bay and Level name themselves in the list instead of repeating captions. Serial uses the same small label as the other fields.
- **Pre-inspection core hole.** The "Primarily needed when utility lines are below the counter." note now shows under the core hole question on the walk, as well as on the spec sheet, the import and the copied configuration.
- **Settings.** The appearance preview card repeated the "Katz Desk" wordmark; it now says "Preview", so each page has one wordmark.

### Verified, no change needed

- Install bubble: "Who changed this" is collapsed; the bubble scrolls by wheel and by touch without moving the page; equipment saved on the bubble shows on that account's pre-inspection (3 machines, serial and electrical carried over).
- Pre-inspection: Add Photo offers Camera and Choose from library (desktop and 390px).
- Spec plug: volts, wire count and model are read first. Axiom 220V 4-wire gives L14-20. A missing wire count leaves Plug unset with "Wire count missing". `spec-defaults.test.mjs` passes 16/16.
- Warehouse: moves go rack, bay, level; Front and Back both work; Front A–H and a missing level are refused; three units were held in one Front section (J, level 2) and the board shows sections holding several serials. Assigned modules show at 55% while available HQ modules are full contrast.
- Pings: the bell has Unread / Read / All with counts. Every type was clicked and lands on its record: ticket, PM, install, deal, rebuild, module, warehouse unit (on a rack), location unit (out at a site), customer, handoff. A ping whose record was removed opens the account with a note. If nothing is left to open (a removed ticket with no account), it says so and stays put. The list refreshes every 8 seconds, so a record removed in the last few seconds can still open once.
- Search lists: the global search list renders on top of the page and banner on all 18 routes at both widths.
- All 18 routes load with a heading and one wordmark and no horizontal overflow. The only console errors are blocked outside hosts in the test sandbox.

### Left as is

- Serial still appears in Warehouse Units and in the inspection list.
- Rebuild "confirm reuse" is unchanged.
- Plug coding above 30A (14-50 / 6-50) is untouched.
- Units saved on Front A–H: none in the local data. Production was not looked at. Any found are to be listed here and not moved silently.
- Hover was spot-checked, not exhaustively re-audited on every page.

Gates: lint 0 errors, typecheck and build pass; tests 156 passing, 9 failing (the same 9 Grok share-card failures).
