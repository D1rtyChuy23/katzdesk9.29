/** Who stamps the lock an assignment or a sale puts on by itself. */
export const LOCKED_BY_ASSIGNED = "System (assigned)";
export const LOCKED_BY_SOLD = "System (sold)";

type LockFields = { locked_at?: unknown; lockedAt?: unknown; locked_by?: string | null; lockedBy?: string | null };

export function isLocked(row: LockFields | null | undefined): boolean {
  if (!row) return false;
  const at = row.locked_at ?? row.lockedAt;
  return at != null && at !== "";
}

export function lockedBy(row: LockFields | null | undefined): string | null {
  return (row?.locked_by ?? row?.lockedBy ?? null) || null;
}

/** "Locked by Chuy. Only Chuy can unlock it." */
export function lockedMessage(by: string | null | undefined, owner: string | null | undefined): string {
  return `Locked by ${by?.trim() || "the owner"}. Only ${owner?.trim() || "the owner"} can unlock it.`;
}

/**
 * The lock an assignment puts on comes off when the unit goes back to the barn, so Return, Unassign and marking it
 * sold pass that one. A sold unit, or a lock a person put on, waits for the owner.
 */
export function releasedByReturn(row: { status?: string | null } & LockFields): boolean {
  return row.status === "assigned" && /^System \(assigned/.test(lockedBy(row) ?? "");
}
