/** Terminal service / TLC statuses. */
export const CLOSED_CALL = new Set(["Completed", "Cancelled", "Phone Resolved"]);

/** Terminal PM statuses. */
export const CLOSED_PM = new Set(["Completed", "Cancelled"]);

type TicketState = {
  status?: string | null;
  done?: boolean | null;
  /** A PM moved to a service ticket (11/18): closed, its work is on the ticket. */
  movedJobId?: number | null;
};

export function isClosedCall(row: TicketState): boolean {
  return !!row.done || CLOSED_CALL.has(row.status ?? "");
}

export function isOpenCall(row: TicketState): boolean {
  return !isClosedCall(row);
}

export function isClosedPm(row: TicketState): boolean {
  return !!row.done || CLOSED_PM.has(row.status ?? "") || row.movedJobId != null;
}

export function isOpenPm(row: TicketState): boolean {
  return !isClosedPm(row);
}

/**
 * The open-PM rule in SQL, the same as isOpenPm (11/27): not done, not Completed or Cancelled, and not moved to a
 * service ticket. Every open-PM count uses it (the PMs page, Runbook Readiness, the Map, Link Check); a count that
 * leaves some out on purpose (Walk-In, PMs not on a listed account) says so beside it. `a` is the pm_jobs alias.
 */
export function openPmSql(a: string): string {
  return `not coalesce(${a}.done, false) and coalesce(${a}.status, '') not in ('Completed', 'Cancelled') and ${a}.moved_job_id is null`;
}
