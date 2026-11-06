/**
 * A rebuild linked to a ticket or an install by its WO (Chuy, 11/6). It bills there: it takes the project's account and
 * Customer P.O., and its invoice's lines go on the ticket's charges or the install's invoice, marked rb:<rebuild>:<line>.
 * Unlinking takes them back onto its own invoice. Pure: what a link or an unlink does, or why it can't. Safe for
 * node --test.
 */
import { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";
import { discountLabel, type Discount } from "./discount.ts";

export type LinkKind = "install" | "service" | "tlc";

/** A ticket or an install a rebuild can be linked to, as read now. */
export type LinkProject = {
  kind: LinkKind;
  id: number;
  /** "Service ticket SC-202611-55", "TLC ticket #12", "Install #45". */
  name: string;
  /** The WO it was found by (for an install, the work order that matched), else its own. */
  wo: string | null;
  customer: string;
  status: string;
  /**
   * Why nothing can be linked to it, as a sentence: a ticket cancelled or merged into another record ("… Link that
   * one."), an install taken off the board. Null when it can be.
   */
  blocked: string | null;
  /** Why its bill takes no lines and gives none back, after its name: "is billed on SO1234", "has an approved invoice". */
  closed: string | null;
  po: string | null;
  discount: Discount | null;
  /** An install's NetSuite invoices from the Billing Backfill (they won't have the rebuild's lines); null for a ticket. */
  netsuite: string | null;
  /**
   * What the person saw, sent back with a link so nothing newer is written over: an install's invoice version
   * ("id:approved:saved", "" with none), or a ticket's last change.
   */
  stamp: string;
};

/** The project a rebuild is linked to now, with this rebuild's lines on its bill. */
export type CurrentLink = LinkProject & {
  lines: number;
  total: number;
  /** How many lines its link put on this bill (rebuilds.link_lines): 0 for one linked before 11/6, or with nothing. */
  moved: number;
  /**
   * Its link was made while this bill was open (rebuilds.link_open): its parts and labor could go on it from then on,
   * by hand too. False for a link made before 11/6, or onto a bill already closed.
   */
  linkedOpen: boolean;
  /** This rebuild's lines on another record's bill (a ticket merged into the install as billed keeps them), or null. */
  elsewhere: string | null;
};

/** The rebuild's own invoice, as read now. */
export type OwnInvoice = {
  /** InvoiceView.version: "id:approved:saved", or null with no invoice. */
  version: string | null;
  state: "none" | "waiting" | "approved";
  lines: number;
  total: number;
  discount: Discount | null;
};

export type LinkRebuild = {
  account: string;
  po: string | null;
  current: CurrentLink | null;
  own: OwnInvoice;
  /** A unit the owner locked, which keeps the rebuild on its account (the sentence), or null. */
  unitLock: string | null;
};

/** unlink: the lines come off the project it is linked to; link: its own invoice's lines go on the new one. */
export type LinkStep = "unlink" | "link";

export type LinkPlan =
  | { ok: false; refusal: string }
  | {
      ok: true;
      steps: LinkStep[];
      /** What it does, one sentence each, for the person to read before they click. */
      effects: string[];
      /** The lines that go on the new project's bill (or back on its own invoice, unlinking). */
      lines: number;
      total: number;
    };

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const lineCount = (n: number) => `${n} line${n === 1 ? "" : "s"}`;
/** The verb for that many lines: "goes"/"go", "comes"/"come", "stays"/"stay". */
const verb = (n: number, plural: "go" | "come" | "stay") => (n === 1 ? `${plural}${plural === "go" ? "es" : "s"}` : plural);

const sameProject = (a: { kind: LinkKind; id: number }, b: { kind: LinkKind; id: number }) =>
  a.id === b.id && (a.kind === "install") === (b.kind === "install");

/** Where a project's bill is: "the ticket's charges" or "the install's invoice". */
export const billName = (p: { kind: LinkKind }) => (p.kind === "install" ? "the install's invoice" : "the ticket's charges");

/** "WO-1234 (Service ticket SC-202611-55)", or the name alone with no WO. */
export function projectLabel(p: { name: string; wo: string | null }): string {
  const wo = String(p.wo ?? "").trim();
  return wo ? `${wo} (${p.name})` : p.name;
}

/** Why a rebuild can't be linked to this project at all, whatever its invoice holds. Null when it can. */
function targetRefusal(t: LinkProject): string | null {
  if (t.blocked) return t.blocked;
  const name = t.customer.trim();
  if (!name || !normalizeCustomerKey(name)) return `${t.name} has no account. Give it one first.`;
  if (isWalkIn(name)) return `${t.name} is on Walk-In, which is never a billing account. Give it the real account first.`;
  return null;
}

/** Unlinking from the project it is on: why it can't, or null. */
function unlinkRefusal(r: LinkRebuild): string | null {
  const c = r.current;
  if (!c) return "This rebuild isn't linked to a ticket or an install.";
  if (c.lines > 0 && c.closed) return `${c.name} ${c.closed}, so this rebuild's ${lineCount(c.lines)} there ${verb(c.lines, "stay")} billed, and it stays linked.`;
  // A bill closed since the link was made keeps it even when none of its lines can be told apart: its parts may have gone
  // on by hand, and the Billing Backfill writes NetSuite's lines without the rebuild's keys. A link from before 11/6, or
  // one made onto a bill already closed, put nothing there through the link, and can go.
  if (c.closed && c.linkedOpen) {
    return c.moved > 0
      ? `${c.name} ${c.closed}, and its link put ${lineCount(c.moved)} there, so it stays linked: what was billed there stays billed.`
      : `${c.name} ${c.closed}, and it was linked while that bill was open, so it stays linked: anything of it billed there stays billed.`;
  }
  if (c.elsewhere) return `Some of this rebuild's lines are on ${c.elsewhere}, so it stays linked.`;
  return null;
}

function unlinkEffects(r: LinkRebuild, c: CurrentLink): string[] {
  const out: string[] = [];
  if (c.lines > 0) {
    const back = r.own.state === "waiting" ? "its own invoice, which waits for an Admin to approve it" : "its own invoice, approved by you";
    out.push(`Its ${lineCount(c.lines)} (${money(c.total)}) ${verb(c.lines, "come")} off ${billName(c)} and back onto ${back}.`);
  } else {
    out.push(`None of its lines are on ${projectLabel(c)}'s bill.`);
    if (c.closed) out.push(`${c.name} ${c.closed}: any of its parts added there by hand stay billed there.`);
  }
  if (r.own.lines > 0) out.push(`Its own invoice keeps its ${lineCount(r.own.lines)}.`);
  out.push(`Its account (${r.account.trim() || "none"}) and Customer P.O. stay as they are.`);
  return out;
}

/**
 * Linking its own invoice onto `t`: why it can't, given what that invoice holds then. `linked`: it is linked already,
 * so its own invoice is locked, and the way out starts with Unlink.
 */
function linkRefusal(own: OwnInvoice, t: LinkProject, unitLock: string | null, accountMoves: boolean, linked: boolean): string | null {
  const bad = targetRefusal(t);
  if (bad) return bad;
  // A closed bill first: nothing done to its own invoice would let these lines go on it.
  if (own.lines > 0 && t.closed) {
    return `${t.name} ${t.closed}, so this rebuild's ${lineCount(own.lines)} can't go on it.${linked ? ` Unlink it to bill ${own.lines === 1 ? "it" : "them"} on its own invoice.` : ""}`;
  }
  if (own.lines > 0 && own.state === "waiting") {
    return linked
      ? "This rebuild's own invoice is waiting for an Admin to approve it (Warehouse saved it). Unlink it, approve its invoice, then link it again."
      : "This rebuild's invoice is waiting for an Admin to approve it (Warehouse saved it). Approve it first, then link.";
  }
  if (own.lines > 0 && own.discount) {
    const lead = `This rebuild's invoice has a discount (${discountLabel(own.discount)}), which can't go on ${projectLabel(t)}'s bill.`;
    return linked ? `${lead} Unlink it, take the discount off its invoice, then link it again.` : `${lead} Take it off the rebuild's invoice first.`;
  }
  if (accountMoves && unitLock) return unitLock;
  return null;
}

function linkEffects(r: LinkRebuild, own: OwnInvoice, t: LinkProject): string[] {
  const out: string[] = [];
  const from = r.account.trim();
  const to = t.customer.trim();
  if (normalizeCustomerKey(from) !== normalizeCustomerKey(to)) out.push(`Account: ${from || "none"} → ${to}.`);
  const poFrom = String(r.po ?? "").trim();
  const poTo = String(t.po ?? "").trim();
  if (poFrom !== poTo) out.push(`Customer P.O.: ${poFrom || "none"} → ${poTo || `none (${t.name} has none)`}.`);
  const where = t.kind === "install" ? "the install's invoice, waiting for an Admin to approve it" : billName(t);
  if (own.lines > 0) {
    out.push(`Its invoice's ${lineCount(own.lines)} (${money(own.total)}) ${verb(own.lines, "go")} on ${where}.`);
    // An approved invoice of its own may have been billed in NetSuite by hand: KatzDesk can't tell.
    if (own.state === "approved") out.push(`If its invoice was billed in NetSuite already, don't link it: ${projectLabel(t)} would bill it again.`);
    if (t.discount) {
      out.push(
        t.discount.kind === "percent"
          ? `${t.name}'s discount (${discountLabel(t.discount)}) applies to them there.`
          : `${t.name}'s discount (${discountLabel(t.discount)}) stays one discount on its whole bill.`,
      );
    }
    if (t.netsuite) out.push(`${t.name} is billed in NetSuite already (${t.netsuite}). NetSuite's invoice won't have these lines.`);
  } else if (t.closed) {
    out.push(`${t.name} ${t.closed}, so nothing more can be billed there.`);
  } else {
    out.push(`It has no invoice lines yet. Its parts and labor are billed on ${billName(t)} from now on.`);
  }
  return out;
}

/**
 * What linking the rebuild to `target` does, or why it can't; `target` null unlinks it. Linked elsewhere already, the
 * lines come off that project first (unlink, then link). Linked to `target` already, only its own invoice's lines move
 * (a rebuild linked before 11/6 kept its own invoice).
 */
export function planLink(r: LinkRebuild, target: LinkProject | null): LinkPlan {
  const c = r.current;
  if (!target) {
    const no = unlinkRefusal(r);
    if (no) return { ok: false, refusal: no };
    return { ok: true, steps: ["unlink"], effects: unlinkEffects(r, c!), lines: c!.lines, total: c!.total };
  }
  const accountMoves = normalizeCustomerKey(r.account) !== normalizeCustomerKey(target.customer);
  if (c && sameProject(c, target)) {
    if (r.own.lines === 0) return { ok: false, refusal: `This rebuild is already linked to ${projectLabel(target)}.` };
    const no = linkRefusal(r.own, target, r.unitLock, accountMoves, true);
    if (no) return { ok: false, refusal: no };
    return { ok: true, steps: ["link"], effects: linkEffects(r, r.own, target), lines: r.own.lines, total: r.own.total };
  }
  if (!c) {
    const no = linkRefusal(r.own, target, r.unitLock, accountMoves, false);
    if (no) return { ok: false, refusal: no };
    return { ok: true, steps: ["link"], effects: linkEffects(r, r.own, target), lines: r.own.lines, total: r.own.total };
  }
  // Linked to another project: its lines there come back onto its own invoice first, then go on the new one.
  const out = unlinkRefusal(r);
  if (out) return { ok: false, refusal: out };
  const after: OwnInvoice = {
    version: r.own.version,
    // Its own invoice takes the lines back approved, unless Warehouse's saved one is still waiting for an Admin.
    state: r.own.state === "waiting" ? "waiting" : r.own.lines + c.lines > 0 ? "approved" : r.own.state,
    lines: r.own.lines + c.lines,
    total: Math.round((r.own.total + c.total) * 100) / 100,
    discount: r.own.discount,
  };
  const no = linkRefusal(after, target, r.unitLock, accountMoves, true);
  if (no) return { ok: false, refusal: no };
  const effects = [
    c.lines > 0 ? `It leaves ${projectLabel(c)}: its ${lineCount(c.lines)} there ${verb(c.lines, "come")} off ${billName(c)}.` : `It leaves ${projectLabel(c)}.`,
    // The lines that come back were billed on the old project, never by hand in NetSuite: no warning for them.
    ...linkEffects(r, r.own.lines > 0 ? after : { ...after, state: "none" }, target),
  ];
  return { ok: true, steps: ["unlink", "link"], effects, lines: after.lines, total: after.total };
}

/** The Invoice window's lock on a linked rebuild: where it bills. */
export function rebuildBillsOnLock(p: { kind: LinkKind; name: string; wo: string | null }, ownLines: number): string {
  const where = p.kind === "install" ? "its parts and labor go on the install's invoice" : "its parts and labor go on the ticket's charges";
  const open = p.kind === "install" ? "Open the install to change them." : "Open the ticket to change them.";
  const them = ownLines === 1 ? "it" : "them";
  const kept =
    ownLines > 0
      ? ` Its own invoice still has ${lineCount(ownLines)} from before it was linked. Link on its Details can move ${them} onto ${projectLabel(p)}'s bill. To change ${them} first, or to bill ${them} on this invoice, Unlink it.`
      : "";
  return `This rebuild bills on ${projectLabel(p)}: ${where}. ${open}${kept}`;
}
