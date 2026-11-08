/**
 * A rebuild linked to a ticket or an install by its WO (Chuy, 11/6). It bills there: it takes the project's account and
 * Customer P.O., and its invoice's lines go on the ticket's charges or the install's invoice, marked rb:<rebuild>:<line>.
 * Unlinking takes them back onto its own invoice. Pure: what a link or an unlink does, or why it can't. Safe for
 * node --test.
 */
import { isWalkIn, normalizeCustomerKey } from "./customer-key.ts";
import { applyDiscount, discountLabel, type Discount } from "./discount.ts";

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
   * by hand too. Every link is, since only an open bill takes one (11/6 review, round 5); false for one made before
   * 11/6 through the old list.
   */
  linkedOpen: boolean;
  /**
   * It came to the install with a ticket merged in as billed, linked while that ticket was open (rebuilds.link_billed_with,
   * 11/6): "ticket SC-1 (billed on SO-1)". What was billed with that ticket stays billed, so it stays linked, wherever
   * Merge installs takes it. Null otherwise.
   */
  billedVia: string | null;
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
  /** What its lines that take its discount add up to (11/7): all of them on the Whole bill, the ticked ones on Chosen lines. */
  base: number;
  discount: Discount | null;
  /**
   * An Admin said at Link that it's on a Sales Order in NetSuite (Chuy, 11/6), and it hasn't been approved or saved
   * since (rebuild_invoice_on_so, 0122): its lines stay on it, and only the rebuild's later parts and labor go on the
   * project.
   */
  onSalesOrder: boolean;
};

export type LinkRebuild = {
  account: string;
  po: string | null;
  current: CurrentLink | null;
  own: OwnInvoice;
  /** A unit the owner locked, which keeps the rebuild on its account (the sentence), or null. */
  unitLock: string | null;
};

/**
 * unlink: the lines come off the project it is linked to; link: its own invoice's lines go on the new one (or stay on
 * it, on a Sales Order); note: it's linked there already, and its own invoice is noted as on a Sales Order.
 */
export type LinkStep = "unlink" | "link" | "note";

/** The answer to Link's question about an approved invoice of its own (Chuy, 11/6): on a Sales Order in NetSuite yet. */
export type SalesOrderAnswer = "on" | "not";

/** What Link or Unlink does, or why it can't. */
export type LinkDecision =
  | { ok: false; refusal: string }
  | {
      ok: true;
      steps: LinkStep[];
      /** What it does, one sentence each, for the person to read before they click. */
      effects: string[];
      /** The lines that go on the new project's bill (or back on its own invoice, unlinking). */
      lines: number;
      total: number;
      /** Its own invoice's lines stay on it: it's on a Sales Order in NetSuite. */
      keepOwn: boolean;
      /** Link notes on its own invoice that it's on a Sales Order: the person just said so. */
      noteOwn: boolean;
    };

export type LinkPlan =
  | LinkDecision
  /**
   * Its own invoice is approved, so it may be on a Sales Order in NetSuite already (Chuy, 11/6): Link asks first, and
   * says what each answer does. Not yet: its lines move onto the project's bill. Yes: they stay on its own invoice.
   * Asked only when one of them can link.
   */
  | { ok: "ask"; question: string; not: LinkDecision; on: LinkDecision };

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const lineCount = (n: number) => `${n} line${n === 1 ? "" : "s"}`;
/** The verb for that many lines: "goes"/"go", "comes"/"come", "stays"/"stay". */
const verb = (n: number, plural: "go" | "come" | "stay") => (n === 1 ? `${plural}${plural === "go" ? "es" : "s"}` : plural);

const sameProject = (a: { kind: LinkKind; id: number }, b: { kind: LinkKind; id: number }) =>
  a.id === b.id && (a.kind === "install") === (b.kind === "install");

/**
 * SQL: rebuilds linked to a record (`where`, such as "r.job_id = $2::int") while its bill was open and not kept by a
 * billed merge. A merge must not put them on a bill that's closed and takes nothing of theirs: only an open bill takes
 * a link (11/6 review, round 5). One the merge would leave on its own closed bill stays put by that bill's rules.
 */
export const openLinkedRebuildsSql = (where: string) =>
  `select r.id, r.title from rebuilds r
    where ${where} and coalesce(r.archived, false) = false and coalesce(r.link_open, false) and r.link_billed_with is null`;

const rebuildNames = (rebuilds: { id: number; title: string | null }[]) =>
  rebuilds.map((r) => (r.title?.trim() ? `Rebuild #${r.id} (${r.title.trim()})` : `Rebuild #${r.id}`)).join(", ");

/** A merge refused for those rebuilds: "Rebuild #5 is linked to ticket #12, and ticket #11 is billed, so it couldn't bill there. …" */
export function closedBillMergeRefusal(rebuilds: { id: number; title: string | null }[], from: string, closed: string): string {
  const one = rebuilds.length === 1;
  return `${rebuildNames(rebuilds)} ${one ? "is" : "are"} linked to ${from}, and ${closed}, so ${one ? "it" : "they"} couldn't bill there. Unlink ${one ? "it on the rebuild's" : "them on their"} Details first, then merge.`;
}

/**
 * Remove refused on an install that rebuilds are linked to: they bill there, and off the board they'd bill nowhere.
 * `held`: one Unlink refuses (a billed ticket brought it, or the install's approved invoice holds it), so only Merge
 * installs takes it off (11/6 review, round 6).
 */
export function removeLinkedInstallRefusal(installId: number, rebuilds: { id: number; title: string | null; held: boolean }[]): string {
  const one = rebuilds.length === 1;
  const lead = `${rebuildNames(rebuilds)} ${one ? "is" : "are"} linked to install #${installId} and ${one ? "bills" : "bill"} there.`;
  const held = rebuilds.filter((r) => r.held);
  if (held.length) return `${lead} Merge this install into the one to keep instead: ${held.length === rebuilds.length && one ? "it" : rebuildNames(held)} can't be unlinked.`;
  return `${lead} Unlink ${one ? "it on the rebuild's" : "them on their"} Details first, or merge this install into the one to keep.`;
}

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
  // A ticket merged into an install as billed brought it, linked while that ticket was open (rebuilds.link_billed_with):
  // its parts may be billed with that ticket (11/6 review).
  if (c.billedVia) return `This rebuild came over with ${c.billedVia} when that ticket was merged into an install, so it stays linked: what was billed there stays billed.`;
  // A bill closed since the link was made keeps it even when none of its lines can be told apart: its parts may have gone
  // on by hand, and the Billing Backfill writes NetSuite's lines without the rebuild's keys. A link from before 11/6 put
  // nothing there through the link, and can go.
  if (c.closed && c.linkedOpen) {
    return c.moved > 0
      ? `${c.name} ${c.closed}, and its link put ${lineCount(c.moved)} there, so it stays linked: what was billed there stays billed.`
      : `${c.name} ${c.closed}, and it was linked while that bill was open, so it stays linked: anything of it billed there stays billed.`;
  }
  if (c.elsewhere) return `Some of this rebuild's lines are on ${c.elsewhere}, so it stays linked.`;
  return null;
}

/**
 * Parts put on a bill by hand carry no rebuild key: they stay there (11/6 review). On an open bill they bill there, and
 * `then` says how to bill them elsewhere; on a closed one they stay billed; a project off the board bills nothing more.
 */
function handAdded(c: CurrentLink, then: string): string {
  if (c.closed) return `${c.name} ${c.closed}: any of its parts added there by hand stay billed there.`;
  if (c.blocked) return `Any of its parts added on ${billName(c)} by hand stay there.`;
  return `Any of its parts added on ${billName(c)} by hand stay there and bill there. ${then}`;
}

function unlinkEffects(r: LinkRebuild, c: CurrentLink): string[] {
  const out: string[] = [];
  if (c.lines > 0) {
    const back = r.own.state === "waiting" ? "its own invoice, which waits for an Admin to approve it" : "its own invoice, approved by you";
    out.push(`Its ${lineCount(c.lines)} (${money(c.total)}) ${verb(c.lines, "come")} off ${billName(c)} and back onto ${back}.`);
    if (r.own.onSalesOrder) out.push(`${c.lines === 1 ? "It isn't" : "They aren't"} on that invoice's Sales Order: bill ${c.lines === 1 ? "it" : "them"} on a new one.`);
  } else {
    out.push(`None of its lines are on ${projectLabel(c)}'s bill.`);
  }
  out.push(handAdded(c, "To bill them on its own invoice, take them off first."));
  if (r.own.lines > 0) out.push(`Its own invoice keeps its ${lineCount(r.own.lines)}${r.own.onSalesOrder ? ", on its Sales Order" : ""}.`);
  out.push(`Its account (${r.account.trim() || "none"}) and Customer P.O. stay as they are.`);
  return out;
}

/**
 * Linking its own invoice onto `t`: why it can't, given what that invoice holds then. `linked`: it is linked already,
 * so its own invoice is locked, and the way out starts with Unlink. `orYes`: Link asks whether its invoice is on a
 * Sales Order, and Yes can link, so a refusal may point there (11/7).
 */
function linkRefusal(own: OwnInvoice, t: LinkProject, unitLock: string | null, accountMoves: boolean, linked: boolean, orYes = false): string | null {
  const bad = targetRefusal(t);
  if (bad) return bad;
  // A closed bill first: nothing done to its own invoice would let these lines go on it.
  if (own.lines > 0 && t.closed) {
    const them = own.lines === 1 ? "it" : "them";
    // Warehouse's saved invoice still waits after the unlink (11/6 review).
    const way = own.state === "waiting" ? ` Unlink it, then approve its own invoice (it's waiting for an Admin) to bill ${them} there.` : ` Unlink it to bill ${them} on its own invoice.`;
    return `${t.name} ${t.closed}, so this rebuild's ${lineCount(own.lines)} can't go on it.${linked ? way : ""}`;
  }
  // Only an open bill takes a link (11/6 review, round 5). Linked to a closed one, the rebuild could bill nowhere, and
  // its parts could go on that bill by hand once it reopened, with nothing to tell them apart.
  if (t.closed) return `${t.name} ${t.closed}, so nothing more can be billed there. Link it to an open ticket or install.`;
  if (own.lines > 0 && own.state === "waiting") {
    return linked
      ? "This rebuild's own invoice is waiting for an Admin to approve it (Warehouse saved it). Unlink it, approve its invoice, then link it again."
      : "This rebuild's invoice is waiting for an Admin to approve it (Warehouse saved it). Approve it first, then link.";
  }
  if (own.lines > 0 && own.discount) {
    // The project's bill has one discount for all of it: moved there, these lines would lose theirs (Chuy, 11/7: the
    // wording only; what is refused is unchanged).
    const lead = `This rebuild's invoice has a discount (${discountLabel(own.discount)}). ${projectLabel(t)}'s bill can't carry it, so its lines would bill there without it.`;
    // On a Sales Order, Yes keeps the lines on its own invoice, discount and all: said only when Yes can link.
    const yes = orYes ? " If its invoice is on a Sales Order, answer Yes instead." : "";
    return linked
      ? `${lead}${yes} ${orYes ? "Otherwise unlink" : "Unlink"} it, take the discount off its invoice, then link it again.`
      : `${lead}${yes} If the discount shouldn't apply, take it off the rebuild's invoice first.`;
  }
  if (accountMoves && unitLock) return unitLock;
  return null;
}

/** The account and Customer P.O. it takes from the project, when they change. */
function takesFrom(r: LinkRebuild, t: LinkProject): string[] {
  const out: string[] = [];
  const from = r.account.trim();
  const to = t.customer.trim();
  if (normalizeCustomerKey(from) !== normalizeCustomerKey(to)) out.push(`Account: ${from || "none"} → ${to}.`);
  const poFrom = String(r.po ?? "").trim();
  const poTo = String(t.po ?? "").trim();
  if (poFrom !== poTo) out.push(`Customer P.O.: ${poFrom || "none"} → ${poTo || `none (${t.name} has none)`}.`);
  return out;
}

function linkEffects(r: LinkRebuild, own: OwnInvoice, t: LinkProject): string[] {
  const out = takesFrom(r, t);
  const where = t.kind === "install" ? "the install's invoice, waiting for an Admin to approve it" : billName(t);
  if (own.lines > 0) {
    // An approved invoice of its own moves only once the person says it isn't on a Sales Order yet (Chuy, 11/6).
    out.push(`Its invoice's ${lineCount(own.lines)} (${money(own.total)}) ${verb(own.lines, "go")} on ${where}.`);
    if (t.discount) {
      // On Chosen lines (11/7) they come in unticked, as every new line does: its discount stays on what was ticked.
      out.push(
        t.discount.scope === "chosen"
          ? `These come in unticked, so ${t.name}'s discount (${discountLabel(t.discount)} its chosen lines) doesn't come off them.`
          : t.discount.kind === "percent"
            ? `${t.name}'s discount (${discountLabel(t.discount)}) applies to them there.`
            : `${t.name}'s discount (${discountLabel(t.discount)}) stays one discount on its whole bill.`,
      );
    }
    if (t.netsuite) out.push(`${t.name} is billed in NetSuite already (${t.netsuite}). NetSuite's invoice won't have these lines.`);
  } else {
    out.push(`It has no invoice lines yet. Its parts and labor are billed on ${billName(t)} from now on.`);
  }
  return out;
}

/**
 * Its own invoice's amount as a person reads it: what its lines add up to, and with a discount what it bills (Chuy,
 * 11/7: a 100% one bills $0.00, not its lines' total). "$315.00", or "$315.00 before its 100% discount, $0.00 billed".
 * On Chosen lines the discount comes off its ticked lines only (`base`).
 */
export function ownAmount(own: Pick<OwnInvoice, "total" | "base" | "discount">): string {
  const { off, total } = applyDiscount(own.total, own.discount, own.base);
  if (!own.discount || off <= 0) return money(own.total);
  const what = own.discount.kind === "percent" ? `${Number(own.discount.value.toFixed(2))}%` : money(own.discount.value);
  return `${money(own.total)} before its ${what} discount, ${money(total)} billed`;
}

/** "Its invoice's 2 lines ($315.00) stay on it: …": its own invoice, on a Sales Order, keeps them. */
const staysOnSalesOrder = (own: OwnInvoice, lead = "Its invoice's") =>
  `${lead} ${lineCount(own.lines)} (${ownAmount(own)}) ${verb(own.lines, "stay")} on it: it's on a Sales Order in NetSuite.`;

/**
 * Linking with its own invoice on a Sales Order: its lines stay there, so the bill takes nothing now. Only an open bill
 * takes a link still: its later parts and labor go there.
 */
function keepRefusal(t: LinkProject, unitLock: string | null, accountMoves: boolean): string | null {
  const bad = targetRefusal(t);
  if (bad) return bad;
  if (t.closed) return `${t.name} ${t.closed}, so nothing more can be billed there. Link it to an open ticket or install.`;
  if (accountMoves && unitLock) return unitLock;
  return null;
}

function keepEffects(r: LinkRebuild, t: LinkProject): string[] {
  return [...takesFrom(r, t), staysOnSalesOrder(r.own), `Its parts and labor from now on are billed on ${billName(t)}.`];
}

/** Link asks about an approved invoice of its own with lines, unless an Admin already said it's on a Sales Order. */
const asksSalesOrder = (own: OwnInvoice) => own.state === "approved" && own.lines > 0 && !own.onSalesOrder;

/**
 * What linking the rebuild to `target` does, or why it can't; `target` null unlinks it. Linked elsewhere already, the
 * lines come off that project first (unlink, then link). Linked to `target` already, only its own invoice's lines move
 * (a rebuild linked before 11/6 kept its own invoice).
 *
 * An approved invoice of its own may be on a Sales Order in NetSuite already (Chuy, 11/6): with no `answer`, the plan
 * asks ("ask"), with what each answer does. "not": its lines move, as above. "on": they stay on its own invoice, and the
 * link takes only its later parts and labor. Once an Admin has said so, and the invoice hasn't changed since, they stay
 * without asking.
 */
export function planLink(r: LinkRebuild, target: LinkProject | null, answer: SalesOrderAnswer | null = null): LinkPlan {
  if (target && asksSalesOrder(r.own)) {
    const on = decide(r, target, true);
    // Not yet points to Yes only when Yes can link (11/7). The same with the answer given, so both read alike.
    const not = decide(r, target, false, on.ok);
    if (answer) return answer === "on" ? on : not;
    // Neither can link: there's nothing to ask.
    if (!not.ok && !on.ok) return not;
    return { ok: "ask", question: `Its invoice is approved (${lineCount(r.own.lines)}, ${ownAmount(r.own)}). Is it on a Sales Order in NetSuite yet?`, not, on };
  }
  const keep = !!target && r.own.state === "approved" && r.own.lines > 0 && (r.own.onSalesOrder || answer === "on");
  return decide(r, target, keep);
}

/** What Unlink does, or why it can't (planLink with no project: it never asks). */
export const planUnlink = (r: LinkRebuild): LinkDecision => decide(r, null, false);

/** planLink with the question answered: `keep`, its own invoice's lines stay on it. `orYes`: see linkRefusal. */
function decide(r: LinkRebuild, target: LinkProject | null, keep: boolean, orYes = false): LinkDecision {
  const c = r.current;
  // Noted now, unless an Admin said so already.
  const noteOwn = keep && !r.own.onSalesOrder;
  const refuse = (refusal: string): LinkDecision => ({ ok: false, refusal });
  const plan = (steps: LinkStep[], effects: string[], lines: number, total: number): LinkDecision => ({ ok: true, steps, effects, lines, total, keepOwn: keep, noteOwn });
  if (!target) {
    const no = unlinkRefusal(r);
    if (no) return refuse(no);
    return plan(["unlink"], unlinkEffects(r, c!), c!.lines, c!.total);
  }
  const accountMoves = normalizeCustomerKey(r.account) !== normalizeCustomerKey(target.customer);
  if (c && sameProject(c, target)) {
    if (r.own.lines === 0) return refuse(`This rebuild is already linked to ${projectLabel(target)}.`);
    if (keep) {
      if (!noteOwn) return refuse(`This rebuild is already linked to ${projectLabel(target)}. ${staysOnSalesOrder(r.own, "Its own invoice's")}`);
      const bad = targetRefusal(target);
      if (bad) return refuse(bad);
      // Linked already: nothing moves, and its own invoice is noted as on a Sales Order.
      return plan(["note"], [staysOnSalesOrder(r.own, "Its own invoice's"), `Nothing else changes: it stays linked to ${projectLabel(target)}.`], 0, 0);
    }
    const no = linkRefusal(r.own, target, r.unitLock, accountMoves, true, orYes);
    if (no) return refuse(no);
    return plan(["link"], linkEffects(r, r.own, target), r.own.lines, r.own.total);
  }
  if (!c) {
    const no = keep ? keepRefusal(target, r.unitLock, accountMoves) : linkRefusal(r.own, target, r.unitLock, accountMoves, false, orYes);
    if (no) return refuse(no);
    return keep ? plan(["link"], keepEffects(r, target), 0, 0) : plan(["link"], linkEffects(r, r.own, target), r.own.lines, r.own.total);
  }
  // Linked to another project: its lines there come back onto its own invoice first, then go on the new one.
  const out = unlinkRefusal(r);
  if (out) return refuse(out);
  if (keep) {
    // They would come back onto its own invoice, next to the lines on its Sales Order: nothing tells them apart there.
    if (c.lines > 0) {
      return refuse(
        `Its own invoice is on a Sales Order, so its ${lineCount(c.lines)} on ${projectLabel(c)} can't come back onto it on the way to ${projectLabel(target)}. Unlink it, bill ${c.lines === 1 ? "that line" : "those lines"} from its own invoice, then link it to ${projectLabel(target)}.`,
      );
    }
    const no = keepRefusal(target, r.unitLock, accountMoves);
    if (no) return refuse(no);
    return plan(["unlink", "link"], [`It leaves ${projectLabel(c)}.`, handAdded(c, `To bill them on ${projectLabel(target)}, move them there by hand.`), ...keepEffects(r, target)], 0, 0);
  }
  const backTotal = Math.round((r.own.total + c.total) * 100) / 100;
  const after: OwnInvoice = {
    version: r.own.version,
    // Its own invoice takes the lines back approved, unless Warehouse's saved one is still waiting for an Admin.
    state: r.own.state === "waiting" ? "waiting" : r.own.lines + c.lines > 0 ? "approved" : r.own.state,
    lines: r.own.lines + c.lines,
    total: backTotal,
    // They come back unticked (11/7): on Chosen lines its discount stays on what was ticked.
    base: r.own.discount?.scope === "chosen" ? r.own.base : backTotal,
    discount: r.own.discount,
    onSalesOrder: false,
  };
  const no = linkRefusal(after, target, r.unitLock, accountMoves, true, orYes);
  if (no) return refuse(no);
  const effects = [
    c.lines > 0 ? `It leaves ${projectLabel(c)}: its ${lineCount(c.lines)} there ${verb(c.lines, "come")} off ${billName(c)}.` : `It leaves ${projectLabel(c)}.`,
    handAdded(c, `To bill them on ${projectLabel(target)}, move them there by hand.`),
    ...linkEffects(r, after, target),
  ];
  return plan(["unlink", "link"], effects, after.lines, after.total);
}

/**
 * The Invoice window's lock on a linked rebuild: where it bills. `onSalesOrder`: an Admin said at Link that its own
 * invoice is on a Sales Order (0122), so its lines stay on it.
 */
export function rebuildBillsOnLock(p: { kind: LinkKind; name: string; wo: string | null }, ownLines: number, onSalesOrder = false): string {
  const where = p.kind === "install" ? "its parts and labor go on the install's invoice" : "its parts and labor go on the ticket's charges";
  const open = p.kind === "install" ? "Open the install to change them." : "Open the ticket to change them.";
  const them = ownLines === 1 ? "it" : "them";
  const kept =
    ownLines > 0
      ? onSalesOrder
        ? ` Its own invoice's ${lineCount(ownLines)} ${verb(ownLines, "stay")} on it: it's on a Sales Order in NetSuite.`
        : ` Its own invoice still has ${lineCount(ownLines)} from before it was linked. Link on its Details can move ${them} onto ${projectLabel(p)}'s bill. To change ${them} first, or to bill ${them} on this invoice, Unlink it.`
      : "";
  return `This rebuild bills on ${projectLabel(p)}: ${where}. ${open}${kept}`;
}
