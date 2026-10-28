/**
 * Renaming a customer to a name another account already has (in any capitals) merges the two. These are the shapes the
 * server's plan comes back in, and the words the rename window shows before a merge is saved (Grok's report,
 * 2026-10-27: a rename merged silently into an old removed record and dropped the live account's address).
 *
 * Which account is kept:
 * - The other account is off the list (removed, or merged earlier): the account being renamed is kept. It takes the
 *   name exactly as typed and keeps its own details; the old record only fills details it has blank.
 * - The other account is on the list: it is kept, as Possible Duplicates says ("rename the one you don't keep to the
 *   one you keep"). It takes the typed capitals unless its name is locked from the clean list, keeps its own details,
 *   and blanks are filled from the account that goes.
 * A map pin is only copied with the address it goes with. The account that goes is parked off the list as
 * "… · merged <id>", never under Removed.
 *
 * Pure: no server imports, so the rename window and the tests use it too.
 */

/** Records under an account's name that move with a merge. */
export type RenameCounts = {
  calls: number;
  tlcs: number;
  pms: number;
  installs: number;
  deals: number;
  equipment: number;
  woHistory: number;
};

/** The account that already has the typed name. */
export type RenameOther = {
  id: number;
  name: string;
  /** Off the Customers list: removed, or merged earlier. */
  archived: boolean;
  removedAt: string | null;
  removedBy: string | null;
  /** Listed under Customers → Removed, so Restore could bring it back instead. */
  onRemovedList: boolean;
};

export type RenameMergePlan = {
  kind: "merge";
  id: number;
  from: string;
  /** The kept account's name after the merge: as typed, or its locked clean-list name. */
  name: string;
  /** "renamed": the account being renamed is kept. "existing": the account that already has the name is kept. */
  keep: "renamed" | "existing";
  keptId: number;
  droppedId: number;
  other: RenameOther;
  /** The kept account is locked from the clean list and keeps its name as it is. */
  lockedName: boolean;
  /** Details copied onto the kept account from the one that goes, because the kept one has them blank. */
  filled: string[];
  /** Details that aren't copied, and why. */
  notes: string[];
  /** Records under the name of the account that goes. They move to the kept account. */
  moving: RenameCounts;
};

export type RenamePlan =
  | { kind: "same"; id: number; name: string }
  | { kind: "rename"; id: number; from: string; name: string; caseOnly: boolean }
  | RenameMergePlan;

export type RenameResult = {
  id: number;
  name: string;
  merged: boolean;
  /** On a merge: which account was kept. */
  kept?: "renamed" | "existing";
  filled?: string[];
};

/**
 * What the rename window asks before a merge. `token` goes back with the save: which account is kept and which goes,
 * so a yes never carries over to another account or the other direction.
 */
export type RenameConfirm = { title: string; lines: string[]; confirmLabel: string; token: string };

/** The merge a person says yes to: "<kept id>><dropped id>". */
export const mergeToken = (p: Pick<RenameMergePlan, "keptId" | "droppedId">): string => `${p.keptId}>${p.droppedId}`;

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** "3 calls, 1 PM and 2 QuickBooks work orders", or "" when nothing moves. */
export function countsText(c: RenameCounts): string {
  const parts = [
    c.calls ? count(c.calls, "call", "calls") : "",
    c.tlcs ? count(c.tlcs, "TLC", "TLCs") : "",
    c.pms ? count(c.pms, "PM", "PMs") : "",
    c.installs ? count(c.installs, "install", "installs") : "",
    c.deals ? count(c.deals, "deal", "deals") : "",
    c.equipment ? count(c.equipment, "piece of equipment", "pieces of equipment") : "",
    c.woHistory ? count(c.woHistory, "QuickBooks work order", "QuickBooks work orders") : "",
  ].filter(Boolean);
  return listText(parts);
}

/** "a, b and c". */
export function listText(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function defaultDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Where the other account stands, after its quoted name: "is already on the list", "was removed Oct 27, 2026 by chuy", … */
function standing(o: RenameOther, day: (iso: string) => string): string {
  if (!o.archived) return "is already on the list";
  if (o.removedAt) return `was removed ${day(o.removedAt)}${o.removedBy ? ` by ${o.removedBy}` : ""}`;
  return "is an old account that's off the list";
}

/** The merge question for the rename window, or null when saving is a plain rename. */
export function renameConfirm(plan: RenamePlan, day: (iso: string) => string = defaultDay): RenameConfirm | null {
  if (plan.kind !== "merge") return null;
  const o = plan.other;
  const moved = countsText(plan.moving);
  if (plan.keep === "renamed") {
    return {
      title: `Merge the old account “${o.name}” into this one?`,
      lines: [
        `“${o.name}” (#${o.id}) ${standing(o, day)}, and it has the name you typed.`,
        `This account is kept and renamed “${plan.name}”. Its address, pin, sales rep and contacts stay as they are.`,
        plan.filled.length
          ? `Filled in from the old account, only where this one is blank: ${listText(plan.filled)}.`
          : "Nothing is copied from the old account.",
        moved ? `Moving here from the old account: ${moved}.` : "Nothing is under the old account's name.",
        ...plan.notes,
        "The old account stays off the list, and it won't be under Removed.",
        ...(o.onRemovedList ? ["To bring the removed account back instead, choose Back, then use Restore under Removed."] : []),
      ],
      confirmLabel: "Merge",
      token: mergeToken(plan),
    };
  }
  const kept = plan.lockedName
    ? `“${o.name}” is kept with its locked name.`
    : o.name === plan.name
      ? `“${o.name}” is kept.`
      : `“${o.name}” is kept and renamed “${plan.name}”.`;
  return {
    title: `Merge this account into “${o.name}”?`,
    lines: [
      `“${o.name}” (#${o.id}) ${standing(o, day)}.`,
      `${kept} Its details stay as they are${o.archived ? ", and it comes back on the list" : ""}.`,
      plan.filled.length
        ? `Filled in from this account, only where “${o.name}” is blank: ${listText(plan.filled)}.`
        : "Nothing is copied from this account.",
      moved ? `Moving to “${plan.name}”: ${moved}.` : "Nothing is under this account's name.",
      ...plan.notes,
      "This account comes off the list, and it won't be under Removed.",
    ],
    confirmLabel: "Merge",
    token: mergeToken(plan),
  };
}

/** The toast after a rename or merge. */
export function renameToast(r: Pick<RenameResult, "name" | "merged" | "kept">): string {
  if (!r.merged) return `Renamed to “${r.name}”`;
  if (r.kept === "renamed") return `Renamed to “${r.name}”. The old account with that name was merged into it.`;
  return `Merged into “${r.name}”`;
}
