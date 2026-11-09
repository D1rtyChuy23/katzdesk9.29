/**
 * Every status field in KatzDesk, in one place (Chuy, 11/9). Each entry says where the status lives, the states it
 * can hold, which of them are closed, and the rules the code already applies when it changes. Pure: no server imports.
 *
 * This registry describes; it doesn't enforce. A status is still a pick-list, and any state can follow any other,
 * as before. scripts/state-machines.test.mjs keeps it in step with the database and with status lists typed into
 * queries, and docs/state-machines.md is this file written out (npm run docs:states).
 */
import { CALL_STATUSES, PM_STATUSES, PARTS_STATUSES, EQUIP_STATUSES, MODULE_STATUSES, ASSET_STATUSES } from "./lookups.ts";
import { CLOSED_CALL, CLOSED_PM } from "./ticket-status.ts";
import { REBUILD_STATUSES, CLOSED_REBUILD } from "./rebuild-model.ts";
import { QUOTE_STATUSES } from "./repair-quote.ts";
import { INSPECTION_ITEM_STATUSES } from "./pre-inspection.ts";

export type StateMachine = {
  id: string;
  label: string;
  table: string;
  column: string;
  /** The states, in pick-list order. */
  states: readonly string[];
  /** States that end the work. Empty when none does. */
  closed: readonly string[];
  /** The column's default in the database, or null when it has none. */
  initial: string | null;
  /** True when a database check lists the states. */
  dbCheck: boolean;
  /** Where the list of states is defined. */
  source: string;
  /** What the code does today when the status changes, and where. */
  notes: readonly string[];
};

export const STATE_MACHINES: readonly StateMachine[] = [
  {
    id: "ticket",
    label: "Service ticket / TLC",
    table: "service_jobs",
    column: "status",
    states: CALL_STATUSES,
    closed: [...CLOSED_CALL],
    initial: "Open",
    dbCheck: false,
    source: "CALL_STATUSES in lookups.ts; CLOSED_CALL in ticket-status.ts",
    notes: [
      "The done flag follows the status: a closed status sets it, and any other status clears it (updateJob in api.ts).",
      "A row counts as closed when done is set or its status is closed (isClosedCall in ticket-status.ts).",
      "Closed work doesn't move on the day board (boardLocked in day-board.ts).",
      "A ticket merged into an install is marked done with its status left as it was (ticket-install-merge.ts). So done can be set on an open status, on purpose; a closed status always means closed.",
      "Pull for service attaches the unit to the account's newest ticket that isn't closed (assignAssetToServiceFor in api.ts).",
    ],
  },
  {
    id: "pm",
    label: "PM",
    table: "pm_jobs",
    column: "status",
    states: PM_STATUSES,
    closed: [...CLOSED_PM],
    initial: "Pending Scheduling",
    dbCheck: false,
    source: "PM_STATUSES in lookups.ts; CLOSED_PM in ticket-status.ts",
    notes: [
      "The done flag follows the status unless a save sets done itself (updatePmFor in api.ts).",
      "A row counts as closed when done is set or its status is closed (isClosedPm in ticket-status.ts).",
      "Completing a PM runs its completion checks first (updatePmFor in api.ts).",
    ],
  },
  {
    id: "pm-parts",
    label: "PM parts",
    table: "pm_jobs",
    column: "parts_status",
    states: PARTS_STATUSES,
    closed: [],
    initial: null,
    dbCheck: false,
    source: "PARTS_STATUSES in lookups.ts",
    notes: ["A label only: no rule reads it."],
  },
  {
    id: "rebuild",
    label: "Rebuild",
    table: "rebuilds",
    column: "status",
    states: REBUILD_STATUSES,
    closed: [...CLOSED_REBUILD],
    initial: "Queued",
    dbCheck: false,
    source: "REBUILD_STATUSES and CLOSED_REBUILD in rebuild-model.ts",
    notes: [
      "Entering In progress stamps the actual start, once (rebuilds.ts).",
      "Entering Completed stamps the completion date (rebuilds.ts).",
      "Leaving Waiting clears the waiting reason (rebuilds.ts).",
    ],
  },
  {
    id: "asset",
    label: "Asset (a machine Katz holds or placed)",
    table: "assets",
    column: "status",
    states: ASSET_STATUSES,
    closed: ["sold"],
    initial: "ready",
    dbCheck: false,
    source: "ASSET_STATUSES in lookups.ts",
    notes: [
      "Only a ready unit can be pulled for service; the pull makes it assigned (assignAssetToServiceFor in api.ts).",
      "Katz stock is a ready or deployed unit with no customer on it (IN_STOCK in account-equip-edit.ts).",
      "A sold unit is never pulled again.",
    ],
  },
  {
    id: "install-equipment",
    label: "Install equipment",
    table: "installs",
    column: "equip_status",
    states: EQUIP_STATUSES,
    closed: ["Installed"],
    initial: null,
    dbCheck: false,
    source: "EQUIP_STATUSES in lookups.ts",
    notes: [
      "An install is installed when complete is set or this reads Installed (isInstalled in install-status.ts).",
      "Marking it installed sets both, with the dates (installedPatch in install-status.ts).",
    ],
  },
  {
    id: "module",
    label: "Eversys module",
    table: "modules",
    column: "status",
    states: MODULE_STATUSES,
    closed: [],
    initial: "Not Started",
    dbCheck: false,
    source: "MODULE_STATUSES in lookups.ts",
    notes: ["A pick-list: no transition rule."],
  },
  {
    id: "repair-quote",
    label: "Repair quote",
    table: "repair_quotes",
    column: "status",
    states: QUOTE_STATUSES,
    closed: ["Approved", "Declined"],
    initial: "Draft",
    dbCheck: true,
    source: "QUOTE_STATUSES in repair-quote.ts",
    notes: ["The database refuses any other word."],
  },
  {
    id: "inspection-item",
    label: "Pre-inspection item",
    table: "install_inspection_items",
    column: "status",
    states: INSPECTION_ITEM_STATUSES,
    closed: [],
    initial: "Not inspected",
    dbCheck: false,
    source: "INSPECTION_ITEM_STATUSES in pre-inspection.ts",
    notes: ["A pick-list: no transition rule."],
  },
  {
    id: "spec-read",
    label: "Library spec read",
    table: "spec_reads",
    column: "status",
    states: ["queued", "needs_review", "read", "unreadable"],
    closed: [],
    initial: null,
    dbCheck: true,
    source: "the check in migrations (spec_reads); spec-read-api.ts",
    notes: ["The database refuses any other word."],
  },
  {
    id: "stock-action",
    label: "Warehouse stock request",
    table: "asset_stock_actions",
    column: "status",
    states: ["pending", "approved", "rejected"],
    closed: ["approved", "rejected"],
    initial: null,
    dbCheck: true,
    source: "the check in migrations (asset_stock_actions)",
    notes: ["A request waits as pending until an Admin approves or rejects it."],
  },
];

/** Lifecycles that aren't in the registry yet, and why. */
export const NOT_REGISTERED: readonly string[] = [
  "Invoices (ticket, install, PM, rebuild, deal): draft, approved and billed are read from timestamps and locks, not one status column.",
  "Account unit locks: locked_at / locked_by on a unit, not a status.",
  "NetSuite invoice statuses (ticket_invoices, record_ns_invoices): NetSuite's own words, stored as they arrive.",
  "Imported work orders (install_work_orders.status): the source system's words.",
  "Clean Names items (customer_clean_items.status) and desk invites (desk_invites.status): small internal lists, not mapped yet.",
  "Network providers (network_providers.status): a label.",
];

/**
 * Queries that list ticket statuses on purpose, and not the closed list. Each is named here with its reason, so a
 * new list that matches neither a machine nor this fails the test.
 */
export const INTENDED_STATUS_LISTS: readonly { where: string; reason: string }[] = [
  {
    where: "pm-stack-api.ts: Cancelled, Phone Resolved",
    reason: "A PM can stack on a completed ticket that isn't billed yet, but never on a cancelled or phone-resolved one.",
  },
  {
    where: "teams-reports.ts: Completed, Phone Resolved",
    reason: "The weekly notes count serviced tickets: completed or phone resolved, never cancelled.",
  },
];

export function machine(id: string): StateMachine {
  const m = STATE_MACHINES.find((x) => x.id === id);
  if (!m) throw new Error(`No state machine "${id}".`);
  return m;
}

export function isClosed(id: string, status: string | null | undefined): boolean {
  return machine(id).closed.includes(status ?? "");
}

/** A machine's closed states as a SQL list, for `status not in ${closedSql("ticket")}`. The words are constants. */
export function closedSql(id: string): string {
  return `(${machine(id).closed.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ")})`;
}

export function renderStateMachinesDoc(): string {
  const out: string[] = [
    "# KatzDesk state machines",
    "",
    "Written from `src/lib/ops/state-machines.ts` by `npm run docs:states`. Don't edit this file by hand: change the registry and run it again.",
    "",
    "Every status below is a pick-list: any state can follow any other. The notes say what the code does when it changes.",
    "",
  ];
  for (const m of STATE_MACHINES) {
    out.push(`## ${m.label}`, "");
    out.push(`- **Id:** \`${m.id}\``);
    out.push(`- **Stored in:** \`${m.table}.${m.column}\`${m.dbCheck ? " (the database checks the word)" : ""}`);
    out.push(`- **States:** ${m.states.join(" · ")}`);
    out.push(`- **Starts as:** ${m.initial ?? "blank"}`);
    out.push(`- **Closed:** ${m.closed.length ? m.closed.join(" · ") : "none"}`);
    out.push(`- **Defined in:** ${m.source}`);
    out.push("- **Rules today:**");
    for (const n of m.notes) out.push(`  - ${n}`);
    out.push("");
  }
  out.push("## Not in the registry yet", "");
  for (const n of NOT_REGISTERED) out.push(`- ${n}`);
  out.push("", "## Status lists that differ on purpose", "");
  out.push("These queries list ticket statuses for their own reason, not the closed list:", "");
  for (const n of INTENDED_STATUS_LISTS) out.push(`- \`${n.where}\`: ${n.reason}`);
  out.push("");
  return out.join("\n");
}
