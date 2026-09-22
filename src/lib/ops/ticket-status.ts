/** Terminal service / TLC statuses. */
export const CLOSED_CALL = new Set(["Completed", "Cancelled", "Phone Resolved"]);

/** Terminal PM statuses. */
export const CLOSED_PM = new Set(["Completed", "Cancelled"]);

type TicketState = {
  status?: string | null;
  done?: boolean | null;
};

export function isClosedCall(row: TicketState): boolean {
  return !!row.done || CLOSED_CALL.has(row.status ?? "");
}

export function isOpenCall(row: TicketState): boolean {
  return !isClosedCall(row);
}

export function isClosedPm(row: TicketState): boolean {
  return !!row.done || CLOSED_PM.has(row.status ?? "");
}

export function isOpenPm(row: TicketState): boolean {
  return !isClosedPm(row);
}
