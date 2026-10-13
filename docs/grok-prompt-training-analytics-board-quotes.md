Add training, analytics, deal-to-board flow, repair quotes, and a department menu. Do not rebuild the app. Do not restyle the desk. Do not move a working page off the menu. Do not change locked customer names. Do not change a business rule that already works. Do not add a library: write the PDF and Word files directly and use the xlsx library already installed.

Put each feature's rules in a pure module with node tests in scripts/. Add migrations as new numbered files. Reuse what the desk already has: the filter chips, the one search-and-filter row, the Export list, the Library's file upload and its Email and Text buttons. If a shared piece named here is not in this app yet, use the closest thing the desk already has and say which one you used.

1. Library — Education And Training

- Add an Education And Training section on The Library page, under the search row and above the model books. It is not a book, a family, or a variation.
- Five topics, in this order, always shown, each with its file count: Water Specs, Coffee 101, Barista 101, Latte Art, Importance Of Cleaning. Click a topic to open its files. Click it again to close it.
- Each topic stores files. Drag and drop onto the open topic, or use an Add Files button. Accept PDF, PNG, JPG, WebP, GIF, DOC, DOCX, PPT, PPTX. 20 MB each. Refuse anything else with a sentence that names the file.
- A file keeps the name it was dropped with. A second file with the same name in the same topic becomes "Name (2).pdf". Never rename a training file after a model.
- Click the name and the file opens in a new tab. Email and Text send a link to the file, the same buttons and link as a manual.
- Admin and Sales add and delete. Everyone on the desk opens and sends. Delete sits behind Manage and asks first.
- Store them in library_files with section 'training', a topic (water-specs, coffee-101, barista-101, latte-art, cleaning) and no book. Add a check constraint: a training row has a topic and no book; every other row has no topic. Reuse the chunk upload and the /api/library-file/$token link.
- This is training material, not a model spec. Do not file these under Axiom or another machine. The model-book file list, the filing of loose files by name, Move, and Set Manual Type must all skip section 'training'. Troubleshoot must not read them.
- Check: drop "Axiom Cleaning Deck.pptx" on a topic, reload, and confirm it is still in that topic and not under any Axiom variation.

2. Menu by department

- Reorder the side menu by how the work flows. Do not hide items. Do not rename a page.
- Coming Due stays at the top, on its own, with no group heading.
- Accounts: Customers, Recipes, Out Of Network, Clean Names.
- Installs: Pipeline, Board, Handoff. Move Handoff under Installs.
- Service: Tickets, PMs, TLC + Factor, Rebuilds, Planner.
- Shop: Warehouse, Modules, The Library, then Parts and Locations.
- Reports: Analytics.
- Admin: Settings, Access.
- Keep who sees what: Clean Names and Access are Admin only. The warehouse role still sees only its pages.

3. Analytics and export

- Add an Analytics page at /analytics, under Reports. It lists installs, service tickets, PMs, TLC tickets and rebuilds as one kind of row.
- Columns: Type, Account, Account #, Date, Status, Rep, Tech / Owner, Reference, Detail.
- Date is the install date, else the completed date, else the scheduled or projected date, else the day it came in. Rep is the rep on the record, else the rep saved on the account. Installed installs read Installed.
- Filters in the one search-and-filter row: search, This Month, Last 90 Days, This Year, All Dates, From and To, rep. Five count cards (Installs, Service, PMs, TLC, Rebuilds) that also switch each type on and off. The cards always count all five for the range.
- Show records by month and by rep. Show the first 100 rows with Show More. An account name opens its record.
- Export is one Export list with PDF, Excel and Word. Same data in each. Build one report from the filters on screen (title, generated time, a line saying what it covers, a summary by type and status, the record rows) and write all three files from that one report. Cut a long Detail at 160 characters before any file is written.
- Excel: a Summary sheet and a Records sheet. Word: landscape, the two tables, header row repeats. PDF: landscape letter, the two tables, header row on every page, long cells wrapped not cut, page numbers.
- File names: KatzDesk-Analytics-YYYY-MM-DD.xlsx, .pdf, .docx.
- Test that the Word rows equal the Excel rows cell for cell and that every cell is in the PDF.

4. Deal → Board → Install ticket

- Each machine row on a deal and on an install carries: Sold or Loaned, serial, voltage, plug, water, coffee, recipe. Keep them in the machine rows already stored on deals and installs. Every read, merge and save must carry them. Do not drop one.
- A grinder has no water or drain. Show "No water or drain" in place of the water field, and never keep a water value on a grinder. A brewer or an espresso machine needs water. Anything else: water only if set.
- Create A New Deal: customer, rep, amount, and more than one machine. Each machine can be marked Sold or Loaned there.
- On the deal, each machine has a Confirm button. A machine must be marked Sold or Loaned first; say so if it is not.
- When a machine is Confirmed it moves to the Board for prep, with everything set on its row. Do not leave those fields blank on the Board if they were set on the deal.
- If no project is open for this deal or this account, the machine starts one. Otherwise ask, in a window titled Add To The Board: Continue Under This Project, or Start A New Project. Same project keeps one board card. New project opens another. Offer only open projects: this deal's, or one on the same account that no deal owns.
- If more machines are added to the deal later, each follows the same path.
- A confirmed machine on the deal is read-only. It says Confirmed · On The Board, which project (Project 1 of 2 when the deal has more than one), where that project stands (In Prep, Ready, Installed), and links to it. From then on it is changed on the Board.
- Tie the deal row to its board row with a hidden id on both. A deal row is on the Board only while its board row exists. Renaming the model on the Board must not lose the tie. Saving a deal from a window opened earlier must not drop a tie.
- Board card: one line per machine with a Sold or Loaned badge, Confirmed, and what was set. Show Project 1 of 2 when a deal has more than one card, and a link back to the deal.
- When the board project is Ready (equipment status Ready and pre-inspection Passed), open the install ticket: a section at the top of the install window, and an Install Ticket button on the Board row. Fill it from that project's machine rows: Sold or Loaned, serial, recipe, configuration (volts, plug, water if required) and coffee selection. Mark a blank that should be filled as Not set. Add Print. Before Ready, show one line saying when it opens.
- Do not change Deal completion. Complete still hands the deal off as it does now. Machines handed off that way read as Confirmed on the deal.

5. Repair quote tied to rebuilds

- Add Repair Quote on the ticket window (service and TLC), under Charges, and on the rebuild window. Collapsed to one line with an Add Repair Quote button until there is one.
- Lines for parts and labor. Parts come from the item list with the same picker as Charges. Labor Hour is one click at $150. Each line has description, qty and rate. Show Parts, Labor and Total. If this app has no item list yet, let a line be typed and marked Part or Labor. Do not invent a part number.
- Status: Draft, Sent, Approved, Declined. An Approved or Declined quote keeps its lines until it is set back to Draft or Sent.
- Rebuild projects use the same quote so cost is on that project. A rebuild linked to a ticket shows that ticket's quote, and the ticket shows the rebuild's. One quote, shown in both places, and each says so with a link to the other. Do not make a second cost sheet.
- Tables: repair_quotes (job, rebuild, status, note) with one quote per ticket and one per rebuild, and repair_quote_lines (item, description, qty, rate, kind).
- Track cost on the rebuild row: "Cost $2,402.76 · Approved" on the board card, the timeline row and the rebuild window's header. "No quote" when there is none. Parts and labor on hover.
- The quote is separate from Charges. Do not copy lines between them.

If a step fails, fix that path before the next one. Do not mark it done unless the click lands.

After building, show Education And Training with the five topics, Handoff under Installs, an Analytics export in Excel, a confirmed sold machine on the Board, and a rebuild row with a repair quote total. List anything that still failed with the exact click that failed.
