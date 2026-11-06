# Billing tables: ticket_charges, invoices / invoice_lines, ticket_invoices, record_ns_*

Written for Grok's billing request through Chuy (item 15, 2026-10-28). Three tables hold billing. They answer three
different questions and none of them copies another. Since 11/5 (Grok through Chuy), installs and PMs have NetSuite's
side too: see "Installs and PMs" below.

| Table | Answers | Rows | Written by | Read by |
| --- | --- | --- | --- | --- |
| `ticket_charges` | What will this service or TLC ticket bill? | One per charge line | Charges panel, the ticket's Invoice window, a PM stacked on the ticket, a rebuild linked to it (11/6), Billing Backfill (NetSuite) | Charges panel, Invoice window, Export Billing, Parts Profit, the double-bill and mismatch checks |
| `invoices` + `invoice_lines` | Who approved the Invoice window, when, for how much, billed to whom? | One `invoices` row per record; lines only for PMs, installs, rebuilds, deals | The Invoice window's Approve (Cancel writes nothing), linking a rebuild (11/6) | The Invoice window, PM stacking, the address report |
| `ticket_invoices` (new, `0103`) | What did NetSuite actually invoice for this ticket? | One per NetSuite invoice | Billing Backfill (NetSuite), Admin only | The ticket's NetSuite Invoices panel, the lock, Invoices page, Tickets list filters, Export Billing |

## ticket_charges: the ticket's own lines

- Service and TLC tickets only (`job_id` → `service_jobs`).
- The rest of a ticket's billing is on the ticket row, not here: discount (`discount_kind`, `discount_value`), P.O.
  (`po`), Sales Order (`ns_so`) and the billed date (`billed_at`).
- The Customer P.O. (`po`) is typed on the ticket's Details since 11/2 (migration `0112`); the Charges show it and change
  it only in an Admin's unlocked save. `vendor_po` is a vendor's P.O. number, for reference only: never billed.
- Cost columns (`mpn`, `list_price`, `unit_cost`, `our_discount`, `ticket_discount`, `margin`, `priced_at`) are filled
  when the ticket is billed, for Parts Profit.
- The ticket's Invoice window shows these same lines (`sharedWithCharges`). Saving there saves here.

## invoices and invoice_lines: the in-app Invoice window

- One `invoices` row per record (`entity_type` + `entity_id` is unique), written only on Approve.
- For a service or TLC ticket the row is the approval only: who, when, the bill-to read from the account, and the
  total at that moment. Its lines stay in `ticket_charges`; `invoice_lines` is never written for a ticket, and the
  ticket's discount stays on the ticket (`invoices.discount_*` is null for tickets).
- For PMs, installs, rebuilds and deals, `invoice_lines` holds the lines and `invoices.discount_*` the discount.
- Every invoice carries its record's Customer P.O. (`po` on `service_jobs`, `pm_jobs`, `installs`, `rebuilds`, `deals`,
  since 11/2), read live. A P.O. changed in the Invoice window is saved on the record when it is approved.
  `invoices.po` keeps the P.O. a PM's, install's, rebuild's or deal's invoice was last approved with; nothing reads it.
- `invoices.total` is a snapshot. A ticket's charges can change after Approve (while it isn't locked); the window
  says so.
- None of this is NetSuite data. Export Billing doesn't read these tables.

## A rebuild linked to a ticket or an install (11/6, migration `0118`)

- A rebuild linked by WO (Linked ticket / install on its Details) bills on that project. Linking moves its own
  invoice's lines onto the ticket's charges (`ticket_charges`) or the install's invoice (`invoice_lines`, saved for an
  Admin to approve) and deletes its own invoice, so the lines are never billed twice. The rebuild takes the project's
  account and Customer P.O.; its own Invoice window is locked while it is linked.
- Each moved line carries `source_key = 'rb:<rebuild id>:<its old line id>'`: `ticket_charges.source_key` (since
  `0092`) or `invoice_lines.source_key` (new in `0118`). The Charges panel, an install's Approve and a ticket merged into
  an install keep the key, so Unlink finds the lines wherever the link went.
- Unlink takes them back onto the rebuild's own invoice, approved by whoever unlinked (Warehouse's saved one keeps
  waiting for an Admin). It is refused while they are billed: a ticket with a Sales Order or a live NetSuite invoice,
  an install whose invoice is approved, or a ticket merged into an install as billed. A bill that closed after the
  link was made keeps the rebuild even when none of its lines can be told apart there (its parts added by hand, or the
  Billing Backfill's NetSuite lines over them): `rebuilds.link_open` (`0120`). A link from before 11/6 can be undone.
  `rebuilds.link_lines` (`0119`) counts what the link moved.
- Only an open bill takes a link: a billed ticket, or an install whose invoice is approved, is refused even for a
  rebuild with nothing to move. Linked there, the rebuild could bill nowhere, and its parts could go on that bill by
  hand once it reopened, with nothing to tell them apart.
- An approved invoice of the rebuild's own may be on a Sales Order in NetSuite already, so Link asks (Chuy, 11/6,
  migration `0122`). Not yet: its lines move, as above. Yes: they stay on its own invoice, which bills on that Sales
  Order, and only its later parts and labor go on the project. The answer is kept on the invoice
  (`invoices.on_sales_order_at`, `_by`, and `_version`, its `invoice_version` then) and counts while the version is
  the same (`rebuild_invoice_on_so`, read fresh): an approve or a save for approval after it changes the version, and
  Link asks again. While it counts, Link keeps the lines without asking, and refuses to move them.
  - A rebuild linked before 11/6, its own invoice still holding lines, gets the same question on its project: yes only
    notes it.
  - Moving to another WO with its own invoice on a Sales Order is refused while its lines are on the old project: they
    would come back onto that invoice, next to the lines on its Sales Order, with nothing to tell them apart.
  - Linked, its own Invoice window shows the account and P.O. it was approved with (`invoices.customer` and `po`), not
    the project's, and says its lines stay on it. The project's list of rebuilds billed there says so too.
- Merges move a linked rebuild with its project:
  - A ticket merged into an install takes the rebuild along. Merged as billed, the ticket keeps its charges, billed:
    a rebuild linked while that ticket was open stays linked, wherever Merge installs takes it after. The merge marks
    it with the ticket's id in `rebuilds.link_billed_with` (`0121`), and Unlink is refused while that is set.
  - A merge that would put a rebuild linked while open on a closed bill that takes nothing of it is refused until the
    rebuild is unlinked: an unbilled ticket into an install whose invoice is approved, a WO duplicate into a billed
    ticket, Merge installs into one whose invoice is approved. A rebuild marked by a billed ticket, or held on the
    drop's own approved invoice, goes along as it is.
  - Remove (taking an install off the board) is refused while a rebuild is linked to it: off the board, the rebuild
    would bill nowhere. Unlink it, or merge the install into the one to keep (the only way for a rebuild that Unlink
    refuses). Remove checks the install row as it read it, so a link or merge that commits while it waits stops it.
  - Merge installs reads both invoices' approval fresh, after its locks: an install's Approve doesn't touch the
    install row the merge checks. Since 11/6 (round 7) it also checks both invoices' versions there against what it
    read before its statement, so its one-invoice rule can't miss a line that an Approve put on the drop's invoice
    while the merge waited.
- Link and Unlink mark the ticket or install changed (`updated_at`), so a Charges save, a merge, Merge installs or a
  Billing Backfill confirm that read it before stops and asks to look again.
- `0118` also adds four functions: `invoice_version` (an invoice's "id:approved:saved" stamp), `rebuild_lines_on`
  and `take_rebuild_lines` (read fresh, so a write that committed while a link waited for its locks is seen), and
  `invoice_total` (the lines less the header discount, as `invoiceTotals` works it out).
- `scripts/rebuild-link-races.mjs` runs each write against the ones it can meet, on a throwaway local Postgres.

## ticket_invoices: NetSuite's invoices (new)

- Invoice number, Sales Order, invoice date, NetSuite's own status word, total (after the header discount), amount
  remaining, location (warehouse), and whether it came from a Sales Order or stands alone.
- Read-only in KatzDesk. Only the Admin's Billing Backfill (NetSuite) writes it, and every refresh goes on the
  ticket's history.
- The status is NetSuite's word ("Open", "Paid In Full", "Voided"). It is never worked out from the amount remaining.
- An invoice that isn't Voided locks the ticket: its charges, P.O., discount and Sales Order. An Admin can unlock it
  for 60 minutes with a reason (logged); saving locks it again. On a locked ticket the backfill refreshes invoice rows
  only. It never touches charges, P.O., discount or SO, and never sets `billed_at`.
- One ticket can have several NetSuite invoices (a re-bill, a Voided one and its replacement).

## How they are compared

- **Charges** = `ticket_charges` added up, less the ticket's discount.
- **Invoiced** = `ticket_invoices` that aren't Voided, added up.
- **Mismatch**: the ticket has live invoices and Charges ≠ Invoiced (to the cent).
- **Possible double bill**: two or more live invoices, and Invoiced > Charges.
- **Corrigo net** (`service_jobs.corrigo_net`, from Corrigo's Total Invoice) is a separate, like-for-like check in the
  backfill preview. It is never written into charges.
- **Billed**: a ticket with a Sales Order or a live invoice. Export Billing leaves billed tickets out unless "Include
  billed tickets" is ticked.

## Installs and PMs: record_ns_billing, record_ns_charges, record_ns_invoices (`0116`, 11/5)

What NetSuite billed an install or a PM, brought back by Billing Backfill (NetSuite), Admin only. Read-only in
KatzDesk: nothing else writes these. Each row is on exactly one install (`install_id`) or one PM (`pm_id`);
`record_key` ("install:12", "pm:7") is generated from them for the unique indexes and the backfill's upserts.

| Table | Answers | Rows |
| --- | --- | --- |
| `record_ns_billing` | One WO's NetSuite billing on the record: Sales Order, billed date, header discount | One per record and WO (an install can carry several WOs) |
| `record_ns_charges` | That WO's lines as NetSuite billed them (credits netted, as on tickets) | One per line |
| `record_ns_invoices` | NetSuite's invoices on the record, as `ticket_invoices` holds a ticket's | One per record and invoice number; `wo_key` is the WO it came in on |
| `billing_backfill_runs` | Each Write of the backfill: who, when, the files, the preview's counts, what was written | One per Write |

- **Matched by WO** the same way as tickets (`woMatchKey`): an install by any of its WOs (`install_work_orders`, or its
  own `wo`), a PM by its `wo`. A WO on more than one record goes by the invoice dates (`invoiceFitsTicket`: from a
  week before it came in to a year after it was done), as two tickets with one WO always have. Beside an install or a
  PM, of the records an invoice fits, one is its billing when it was done at least 45 days closer to the invoice than
  any other (WO numbers started over in July 2026, so a new ticket and an old PM can share one; two jobs in the same
  weeks can't be told apart). Still a tie: skipped, saying why; a ticket and an install of one account get "merge it
  into the install first". No invoice date at all: the record the rows' invoices or SOs are on already keeps it (a
  rerun); otherwise the WO's one live ticket keeps it, as before 11/5, with a warning naming the install or PM that has
  it too, unless that install or PM has NetSuite billing for the WO already (then it's skipped).
  Skipped too: an install taken off the board or merged into another (its WOs went to the one kept), a PM stacked on a
  ticket (it bills on that ticket), Walk-In.
- **Every run that has them** writes the WO's lines, discount, SO and billed date, and its invoices: NetSuite's billing
  on an install or a PM is never locked the way a ticket's charges are, since it's NetSuite's as it stands and never
  exported. A file with only invoices, or only a discount for the WO, leaves the lines alone; the billed date is the
  first the WO was billed on.
- **KatzDesk's own invoice** for the install or PM (`invoices` / `invoice_lines`, the Invoice window) is never written
  by the backfill. It is the record's charges for the checks when it has lines; otherwise NetSuite's lines are.
  Mismatch = live invoices ≠ charges; possible double bill = two or more live invoices over the charges; both after
  the header discount, no tax, and both the record's (all its WOs together). A record with no lines either way has
  nothing to check against: no mismatch, no double bill.
- **Never billed again:** Export Billing reads `ticket_charges` only, so NetSuite's lines on installs and PMs never
  reach it.
- **On the card already:** an invoice already on the record (under any of its WOs) is refreshed where it is, never
  added twice. A ticket merged into the install as billed (10/30) keeps its billing: its Sales Order, invoices and
  lines in the files are listed as on the install's card already and not written there (a row of it that would change
  the ticket stops the WO until it is run on its own). The same invoice on another record, or under another record's
  WO in the same files, is written on both and warned about on both.
- **Merge installs** takes NetSuite's billing along with the WOs: each WO's lines and SO the kept install has none for,
  and each NetSuite invoice it doesn't have. A PM billed in NetSuite (a live invoice, an SO or lines) can't be stacked
  on a ticket: `pm_netsuite_billed` (`0117`) guards the stack.
- **Shown:** the install's and PM's Invoices tab (NetSuite section), the Invoices page (installs on the board, PMs not
  stacked; an installed install counts as Completed), Tickets In Window (each install WO row with its own WO's SO and
  invoices), and Location Check's warehouse rule.

## What is not covered

- NetSuite invoices for rebuilds and deals.
- The Invoice window of an install or a PM isn't locked by a NetSuite invoice the way a ticket's charges are. The
  NetSuite section sits beside it on the same tab.
- Tax: none on these invoices (Chuy, 10/28). Total = lines + header discount.
