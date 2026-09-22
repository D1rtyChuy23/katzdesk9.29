# Warehouse layout template

Hand this to a teammate who wants a site that **feels like the barn board**.
The HTML file is a working starter — open it in a browser, no build step.

**Files**
- `warehouse-layout.html` — single-file template (CSS + sample data + interactions)

---

## Layout anatomy (top → bottom)

| Region | What it is | Interaction |
|---|---|---|
| **App shell** | Ink sidebar (shop nav) + cream paper main | Sidebar hides under ~860px |
| **Page header** | Display title, one-line lede, one primary action | “Add to rack” |
| **Stat bubbles** | Ready · Fill · Dispensers · Missing serial · Needs bay | One filter at a time; click again to clear. Counts stay unfiltered totals. |
| **Ready by model** | Horizontal bars | Qty on the rack, not line count |
| **Toolbar** | Back / Front rack pills, search, sort | Rack switch clears the selected slot |
| **Legend** | Catering A–D (warm), Dispenser E–F (violet) | — |
| **Bay grid** | Letters across, levels down | Letter = filter that bay. Cell = filter that slot |
| **Unit list** | Slot · model · serial · flags | Opens a side sheet |
| **Add dialog** | Model, serial, qty, kind, rack / pallet / level | Next open line of that slot (1–12) |

---

## Grid rules (keep these)

- **Back rack:** bays **A–P** (16 columns)
- **Front rack:** bays **I–P** (8 columns)
- **Levels:** **L4 (top) → L1 (floor)**
- **Each cell:** 12 lines. Number in the cell = lines used.
- **Slot ID:** `A-L3` = pallet A, third shelf. With a line: `A-L3 · 4`
- **Catering:** back A–D. **Dispensers:** back E–F. Everything else is general.
- Units with no letter, or a letter after P, belong in **Needs bay** — do not invent a slot.

Cell fill
- `0` empty (muted; catering/dispenser tint if those bays)
- `1–11` in use (soft primary)
- `12` full (solid primary)
- Selected cell: ring

---

## Visual tokens

Copy these if they rebuild in React / Tailwind / whatever.

```
Fonts
  Sans     Figtree
  Display  Fraunces
  Mono     IBM Plex Mono   (slot IDs only)

Colors
  Paper      #f3efe6
  Card       #faf7f1
  Ink        #1a1612   (sidebar + selected pills)
  Primary    #2f5d50   (actions, full cells, bars)
  Border     #ddd4c6
  Muted text #6f675e
  Warning    #9a5b12
  Catering   #b8612a
  Dispense   #5c5368

Radius     8 / 12 / 18px
Pills      fully rounded
Stat cards 18px radius, soft shadow
```

---

## Interaction rules to preserve

1. **Bubbles are filters**, not just numbers. Only one bubble on at a time.
2. Clicking a bubble, a bay letter, or a slot **replaces** the previous filter.
3. Search looks at model, serial, slot, and owner — across both racks.
4. Dispensers are **not** counted in Ready.
5. Missing serial and Needs bay use the warning color, not red-alarm.
6. One primary action per view (Add to rack).

---

## How to restyle for a new product

1. Change the brand in the sidebar (`Barn` / `rack`).
2. Replace the `UNITS` array at the bottom of the HTML with real inventory.
3. Swap the CSS variables at the top (`--primary`, `--ink`, fonts) to rebrand without touching layout.
4. Keep the **region order**. That order is what makes the page feel familiar.

This is a layout starter, not a connected inventory system. Wire the list and grid to your own API when you are ready.
