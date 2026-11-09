# KatzDesk state machines

Written from `src/lib/ops/state-machines.ts` by `npm run docs:states`. Don't edit this file by hand: change the registry and run it again.

Every status below is a pick-list: any state can follow any other. The notes say what the code does when it changes.

## Service ticket / TLC

- **Id:** `ticket`
- **Stored in:** `service_jobs.status`
- **States:** Open · Dispatched · In Progress · Follow-up Needed · Phone Resolved · Completed · Cancelled
- **Starts as:** Open
- **Closed:** Completed · Cancelled · Phone Resolved
- **Defined in:** CALL_STATUSES in lookups.ts; CLOSED_CALL in ticket-status.ts
- **Rules today:**
  - The done flag follows the status: a closed status sets it, and any other status clears it (updateJob in api.ts).
  - A row counts as closed when done is set or its status is closed (isClosedCall in ticket-status.ts).
  - Closed work doesn't move on the day board (boardLocked in day-board.ts).
  - A ticket merged into an install is marked done with its status left as it was (ticket-install-merge.ts). So done can be set on an open status, on purpose; a closed status always means closed.
  - Pull for service attaches the unit to the account's newest ticket that isn't closed (assignAssetToServiceFor in api.ts).

## PM

- **Id:** `pm`
- **Stored in:** `pm_jobs.status`
- **States:** Pending Scheduling · Scheduled · Awaiting Parts · Ready to Dispatch · In Progress · Completed · Cancelled
- **Starts as:** Pending Scheduling
- **Closed:** Completed · Cancelled
- **Defined in:** PM_STATUSES in lookups.ts; CLOSED_PM in ticket-status.ts
- **Rules today:**
  - The done flag follows the status unless a save sets done itself (updatePmFor in api.ts).
  - A row counts as closed when done is set or its status is closed (isClosedPm in ticket-status.ts).
  - Completing a PM runs its completion checks first (updatePmFor in api.ts).

## PM parts

- **Id:** `pm-parts`
- **Stored in:** `pm_jobs.parts_status`
- **States:** Yes - All Available · Partial · No - Awaiting Parts · On Order · TBD / Check Inventory
- **Starts as:** blank
- **Closed:** none
- **Defined in:** PARTS_STATUSES in lookups.ts
- **Rules today:**
  - A label only: no rule reads it.

## Rebuild

- **Id:** `rebuild`
- **Stored in:** `rebuilds.status`
- **States:** Queued · In progress · Waiting · Testing · Ready · Completed · Cancelled
- **Starts as:** Queued
- **Closed:** Completed · Cancelled
- **Defined in:** REBUILD_STATUSES and CLOSED_REBUILD in rebuild-model.ts
- **Rules today:**
  - Entering In progress stamps the actual start, once (rebuilds.ts).
  - Entering Completed stamps the completion date (rebuilds.ts).
  - Leaving Waiting clears the waiting reason (rebuilds.ts).

## Asset (a machine Katz holds or placed)

- **Id:** `asset`
- **Stored in:** `assets.status`
- **States:** ready · deployed · assigned · sold
- **Starts as:** ready
- **Closed:** sold
- **Defined in:** ASSET_STATUSES in lookups.ts
- **Rules today:**
  - Only a ready unit can be pulled for service; the pull makes it assigned (assignAssetToServiceFor in api.ts).
  - Katz stock is a ready or deployed unit with no customer on it (IN_STOCK in account-equip-edit.ts).
  - A sold unit is never pulled again.

## Install equipment

- **Id:** `install-equipment`
- **Stored in:** `installs.equip_status`
- **States:** Ready · Not Ready · Installed
- **Starts as:** blank
- **Closed:** Installed
- **Defined in:** EQUIP_STATUSES in lookups.ts
- **Rules today:**
  - An install is installed when complete is set or this reads Installed (isInstalled in install-status.ts).
  - Marking it installed sets both, with the dates (installedPatch in install-status.ts).

## Eversys module

- **Id:** `module`
- **Stored in:** `modules.status`
- **States:** Not Started · In Progress · Waiting on Parts · Ready · Ship to Eversys (Core Swap) · At Eversys - Awaiting Return · Installed at Account · Retired / Scrapped
- **Starts as:** Not Started
- **Closed:** none
- **Defined in:** MODULE_STATUSES in lookups.ts
- **Rules today:**
  - A pick-list: no transition rule.

## Repair quote

- **Id:** `repair-quote`
- **Stored in:** `repair_quotes.status` (the database checks the word)
- **States:** Draft · Sent · Approved · Declined
- **Starts as:** Draft
- **Closed:** Approved · Declined
- **Defined in:** QUOTE_STATUSES in repair-quote.ts
- **Rules today:**
  - The database refuses any other word.

## Pre-inspection item

- **Id:** `inspection-item`
- **Stored in:** `install_inspection_items.status`
- **States:** Not inspected · Pass · Fail · N/A
- **Starts as:** Not inspected
- **Closed:** none
- **Defined in:** INSPECTION_ITEM_STATUSES in pre-inspection.ts
- **Rules today:**
  - A pick-list: no transition rule.

## Library spec read

- **Id:** `spec-read`
- **Stored in:** `spec_reads.status` (the database checks the word)
- **States:** queued · needs_review · read · unreadable
- **Starts as:** blank
- **Closed:** none
- **Defined in:** the check in migrations (spec_reads); spec-read-api.ts
- **Rules today:**
  - The database refuses any other word.

## Warehouse stock request

- **Id:** `stock-action`
- **Stored in:** `asset_stock_actions.status` (the database checks the word)
- **States:** pending · approved · rejected
- **Starts as:** blank
- **Closed:** approved · rejected
- **Defined in:** the check in migrations (asset_stock_actions)
- **Rules today:**
  - A request waits as pending until an Admin approves or rejects it.

## Not in the registry yet

- Invoices (ticket, install, PM, rebuild, deal): draft, approved and billed are read from timestamps and locks, not one status column.
- Account unit locks: locked_at / locked_by on a unit, not a status.
- NetSuite invoice statuses (ticket_invoices, record_ns_invoices): NetSuite's own words, stored as they arrive.
- Imported work orders (install_work_orders.status): the source system's words.
- Clean Names items (customer_clean_items.status) and desk invites (desk_invites.status): small internal lists, not mapped yet.
- Network providers (network_providers.status): a label.

## Status lists that differ on purpose

These queries list ticket statuses for their own reason, not the closed list:

- `pm-stack-api.ts: Cancelled, Phone Resolved`: A PM can stack on a completed ticket that isn't billed yet, but never on a cancelled or phone-resolved one.
- `teams-reports.ts: Completed, Phone Resolved`: The weekly notes count serviced tickets: completed or phone resolved, never cancelled.
