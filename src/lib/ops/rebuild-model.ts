/** Pure rebuild project rules — no server imports. */

import { isoDay, diffDays as daysBetween } from "./iso.ts";

export { daysBetween };

export const REBUILD_STATUSES = [
  "Queued",
  "In progress",
  "Waiting",
  "Testing",
  "Ready",
  "Completed",
  "Cancelled",
] as const;

export type RebuildStatus = (typeof REBUILD_STATUSES)[number];

export const WAITING_REASONS = [
  "Parts on order",
  "Parts not available",
  "Waiting on decision",
  "Waiting on customer",
  "Tech / bench unavailable",
  "Scope changed",
  "Found additional failure",
  "Other",
] as const;

export type WaitingReason = (typeof WAITING_REASONS)[number];

export const REBUILD_PRIORITIES = ["normal", "high", "committed-to-customer"] as const;
export type RebuildPriority = (typeof REBUILD_PRIORITIES)[number];

export const SHOP_ACCOUNT = "Katz shop / stock";

export type RebuildHealth = "on-track" | "at-risk" | "overdue" | "no-date" | "done";

export const HEALTH_RANK: Record<RebuildHealth, number> = {
  overdue: 0,
  "at-risk": 1,
  "no-date": 2,
  "on-track": 3,
  done: 4,
};

export const HEALTH_LABEL: Record<RebuildHealth, string> = {
  overdue: "Overdue",
  "at-risk": "At risk",
  "no-date": "No date",
  "on-track": "On track",
  done: "Done",
};

export const ACTIVE_REBUILD = new Set<RebuildStatus>(["In progress", "Waiting", "Testing"]);
export const CLOSED_REBUILD = new Set<RebuildStatus>(["Completed", "Cancelled"]);
export const NEEDS_TARGET = new Set<RebuildStatus>(["In progress", "Waiting", "Testing"]);

export function isRebuildStatus(v: string | null | undefined): v is RebuildStatus {
  return !!v && (REBUILD_STATUSES as readonly string[]).includes(v);
}

export function isWaitingReason(v: string | null | undefined): v is WaitingReason {
  return !!v && (WAITING_REASONS as readonly string[]).includes(v);
}

export function isRebuildPriority(v: string | null | undefined): v is RebuildPriority {
  return !!v && (REBUILD_PRIORITIES as readonly string[]).includes(v);
}

export type RebuildDates = {
  status: string;
  owner: string | null;
  targetComplete: string | null;
  actualStart: string | null;
  actualComplete: string | null;
  createdAt: string;
  statusChangedAt: string;
  reasonCode: string | null;
};

export type RebuildMetrics = {
  health: RebuildHealth;
  daysOpen: number;
  daysToTarget: number | null;
  daysInStatus: number;
  daysLateEarly: number | null;
  clockFlag: "overdue" | "waiting-long" | null;
};

export function computeRebuildMetrics(row: RebuildDates, today: string): RebuildMetrics {
  const status = isRebuildStatus(row.status) ? row.status : "Queued";
  const created = isoDay(row.createdAt) || today;
  const started = isoDay(row.actualStart) || created;
  const target = isoDay(row.targetComplete);
  const doneOn = isoDay(row.actualComplete);
  const changed = isoDay(row.statusChangedAt) || created;
  const daysOpen = daysBetween(started, today);
  const daysToTarget = target ? daysBetween(today, target) : null;
  const daysInStatus = daysBetween(changed, today);
  const daysLateEarly = doneOn && target ? daysBetween(target, doneOn) : null;

  let health: RebuildHealth = "on-track";
  if (CLOSED_REBUILD.has(status)) {
    health = "done";
  } else if (NEEDS_TARGET.has(status) && !target) {
    health = "no-date";
  } else if (target && target < today) {
    health = "overdue";
  } else if (status === "Waiting") {
    health = "at-risk";
  } else if (target && daysToTarget != null && daysToTarget <= 3) {
    health = "at-risk";
  } else if (target) {
    health = "on-track";
  } else {
    health = "on-track";
  }

  let clockFlag: RebuildMetrics["clockFlag"] = null;
  if (!CLOSED_REBUILD.has(status)) {
    if (health === "overdue") clockFlag = "overdue";
    else if (status === "Waiting" && daysInStatus > 5) clockFlag = "waiting-long";
  }

  return { health, daysOpen, daysToTarget, daysInStatus, daysLateEarly, clockFlag };
}

export type RebuildDraft = {
  title: string;
  account: string;
  owner: string | null;
  status: string;
  reasonCode: string | null;
  reasonDetail: string | null;
  targetComplete: string | null;
  prevStatus?: string | null;
};

export function validateRebuild(draft: RebuildDraft): string | null {
  const title = draft.title.trim();
  if (!title) return "Give the rebuild a project name.";
  if (!draft.account.trim()) return "Pick an account, or Katz shop / stock.";
  if (!isRebuildStatus(draft.status)) return "Pick a status.";
  const status = draft.status;
  if (status === "Waiting") {
    if (!isWaitingReason(draft.reasonCode)) return "Waiting needs a reason delayed before save.";
    if (draft.reasonCode === "Other" && !draft.reasonDetail?.trim()) {
      return "Spell out the other reason.";
    }
  }
  const leavingQueued = (draft.prevStatus ?? "Queued") === "Queued" && status !== "Queued";
  if (leavingQueued) {
    if (!draft.owner?.trim()) return "Assign an owner before leaving Queued.";
    if (!isoDay(draft.targetComplete)) return "Set a target complete date before leaving Queued.";
  }
  if (NEEDS_TARGET.has(status) && !isoDay(draft.targetComplete)) {
    return "In progress, Waiting, and Testing need a target complete date.";
  }
  if (NEEDS_TARGET.has(status) && !draft.owner?.trim() && status === "In progress") {
    return "In progress needs an owner and a target date.";
  }
  return null;
}

export function priorityLabel(p: string | null | undefined): string {
  if (p === "high") return "High";
  if (p === "committed-to-customer") return "Committed to customer";
  return "Normal";
}
