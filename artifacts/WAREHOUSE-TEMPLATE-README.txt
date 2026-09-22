Warehouse board — layout template
=================================

Give this folder to anyone who wants a site that feels like the barn board.
No install. Open warehouse-layout.html in a browser.

Files
-----
  warehouse-layout.html     Working single-file starter (layout + sample data)
  warehouse-layout-notes.md Layout rules, tokens, and interaction contract
  WAREHOUSE-TEMPLATE-README.txt  This file

What the page is
----------------
Ink sidebar + cream paper main.
Page title and one primary action.
Five stat bubbles (Ready, Fill, Dispensers, Missing serial, Needs bay).
Ready-by-model bars.
Back / Front rack pills, search, sort.
Bay grid: letters across, L4 (top) to L1 (floor).
Unit list that opens a side sheet.
Add-to-rack dialog.

Rules to keep so it still feels familiar
----------------------------------------
- Back rack bays A–P. Front rack I–P.
- 4 levels. 12 lines per cell. Number in the cell = lines used.
- Slot ID is pallet + level (A-L3). Line number is extra (A-L3 · 4).
- Catering = back A–D. Dispensers = back E–F.
- Anything without a letter, or a letter after P, is Needs bay. Do not invent a slot.
- Bubbles are filters. One at a time. Click again to clear. Counts stay unfiltered totals.
- Dispensers are not counted in Ready.

How to restyle
--------------
1. Change the brand in the sidebar.
2. Replace the UNITS array at the bottom of the HTML with real inventory.
3. Recolor by editing the CSS variables at the top (--primary, --ink, fonts).
4. Keep the region order. That order is what makes the page feel like KatzDesk.

This is a layout starter, not a live warehouse system.
Wire the list and grid to your own API when you are ready.
