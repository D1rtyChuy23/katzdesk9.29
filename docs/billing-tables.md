# Billing tables: ticket_charges, invoices / invoice_lines, ticket_invoices

Written for Grok's billing request through Chuy (item 15, 2026-10-28). Three tables hold billing. They answer three
different questions and none of them copies another.

| Table | Answers | Rows | Written by | Read by |
| --- | --- | --- | --- | --- |
| `ticket_charges` | What will this service or TLC ticket bill? | One per charge line | Charges panel, the ticket's Invoice window, a PM stacked on the ticket, Billing Backfill (NetSuite) | Charges panel, Invoice window, Export Billing, Parts Profit, the double-bill and mismatch checks |
| `invoices` + `invoice_lines` | Who approved the Invoice window, when, for how much, billed to whom? | One `invoices` row per record; lines only for PMs, installs, rebuilds, deals | The Invoice window's Approve (Cancel writes nothing) | The Invoice window, PM stacking, the address report |
| `ticket_invoices` (new, `0103`) | What did NetSuite actually invoice for this ticket? | One per NetSuite invoice | Billing Backfill (NetSuite), Admin only | The ticket's NetSuite Invoices panel, the lock, Invoices page, Tickets list filters, Export Billing |

## ticket_charges: the ticket's own lines

- Service and TLC tickets only (`job_id` → `service_jobs`).
- The rest of a ticket's billing is on the ticket row, not here: discount (`discount_kind`, `discount_value`), P.O.
  (`po`), Sales Order (`ns_so`) and the billed date (`billed_at`).
- Cost columns (`mpn`, `list_price`, `unit_cost`, `our_discount`, `ticket_discount`, `margin`, `priced_at`) are filled
  when the ticket is billed, for Parts Profit.
- The ticket's Invoice window shows these same lines (`sharedWithCharges`). Saving there saves here.

## invoices and invoice_lines: the in-app Invoice window

- One `invoices` row per record (`entity_type` + `entity_id` is unique), written only on Approve.
- For a service or TLC ticket the row is the approval only: who, when, the bill-to read from the account, and the
  total at that moment. Its lines stay in `ticket_charges`; `invoice_lines` is never written for a ticket, and the
  ticket's discount stays on the ticket (`invoices.discount_*` is null for tickets).
- For PMs, installs, rebuilds and deals, `invoice_lines` holds the lines and `invoices.discount_*` the discount.
- `invoices.total` is a snapshot. A ticket's charges can change after Approve (while it isn't locked); the window
  says so.
- None of this is NetSuite data. Export Billing doesn't read these tables.

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

## What is not covered

- NetSuite invoices for PMs, installs, rebuilds and deals: `ticket_invoices` is for service and TLC tickets only. A PM
  stacked on a ticket bills on that ticket, so its invoice shows there. A table keyed by `(entity_type, entity_id)`
  would be the way to add the others later.
- Tax: none on these invoices (Chuy, 10/28). Total = lines + header discount.
