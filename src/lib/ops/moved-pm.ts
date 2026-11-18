/**
 * A PM moved to a service ticket (11/18) is off the PM board, but a link to it (the ticket's "Moved from PM #N",
 * history, a bookmark) still opens /pms?open=N. The page then reads it by id and shows it read-only: what it was,
 * and the way to its ticket. Nothing on it can be edited, stacked, invoiced or given parts; the ticket holds the work.
 */
import type { PmJob } from "./types";

export type MovedPmView = {
  /** The PM as it was when it moved (its WO, status and completion went to the ticket). */
  pm: PmJob;
  statusBefore: string | null;
  jobId: number;
  callId: string;
  ticketStatus: string | null;
  movedAt: string | null;
  movedBy: string | null;
};

export type PmDrawer = { kind: "none" } | { kind: "pm"; pm: PmJob } | { kind: "moved"; view: MovedPmView };

/**
 * Which drawer /pms shows for `open`. A PM on the board's list opens as always. One that isn't opens read-only once
 * its moved view has come back (`undefined` while it is being read, `null` when it isn't a moved PM this person may see).
 */
export function pmDrawerFor(list: readonly PmJob[], selected: number | null, moved: MovedPmView | null | undefined): PmDrawer {
  if (selected == null) return { kind: "none" };
  const pm = list.find((p) => p.id === selected);
  if (pm) return { kind: "pm", pm };
  if (moved && moved.pm.id === selected) return { kind: "moved", view: moved };
  return { kind: "none" };
}
