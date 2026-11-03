/**
 * A completed deal's link to an install, for an Admin to review (Chuy, 11/3): asked whether a deal marked complete
 * should link only to an open install, "yes link and mark for review to approve", then "Link now, Admin approves".
 * Pure: no server imports, safe for node --test and the screens.
 */

/** How the link was made: to an open install of the account ("linked"), or with a new install made for it ("made"). */
export type DealReview = "linked" | "made";

/** A stored deal_review as a review, or null (no review waiting). */
export function dealReviewOf(v: unknown): DealReview | null {
  return v === "linked" || v === "made" ? v : null;
}

/** The badge on the install's card, and on the review's row on the Handoff page. */
export function dealReviewBadge(kind: DealReview): string {
  return kind === "linked" ? "Deal link to review" : "New install to review";
}

/** What the review says: the badge's tooltip on the card, and the review's line on the Handoff page. */
export function dealReviewText(kind: DealReview): string {
  return kind === "linked"
    ? "Linked to its deal when the deal was marked complete: the account's newest open install with no deal. An Admin approves the link or unlinks it."
    : "Made for its deal when the deal was marked complete: the account had no open install with no deal. An Admin approves it. If it's the same job as another install on the account, merge it into that one (Details, Merge into install); if the deal needs no install, remove it.";
}

/** The buttons a review shows: Approve for an Admin, and Unlink only for an open install that was linked. */
export function dealReviewButtons(kind: DealReview, canReview: boolean): { approve: boolean; unlink: boolean } {
  return { approve: canReview, unlink: canReview && kind === "linked" };
}

/** The confirm before Unlink (an install that was linked; one made for the deal isn't unlinked). */
export const DEAL_UNLINK_CONFIRM =
  "Unlink this install from the deal? The install keeps its own work. The deal goes back to the Handoff page's completed deals, and its next handoff won't pick this install again.";

/** Why an install made for the deal isn't unlinked. */
export const DEAL_MADE_NO_UNLINK =
  "This install was made for the deal, so it isn't unlinked: approve it, merge it into the account's install for the same job, or remove it if the deal needs no install.";

/** The toast after an Admin's review. */
export function dealReviewToast(r: { approved: boolean; kind: DealReview; backOnHandoff: boolean }): string {
  if (r.approved) return r.kind === "made" ? "Install approved for its deal" : "Deal link approved";
  // Under All: Mine lists a completed deal only for its rep.
  return r.backOnHandoff ? "Unlinked. The deal is back on the Handoff page's completed deals, under All." : "Unlinked.";
}

/** The Handoff page's toast after Send to installs. */
export function handoffToast(h: { kind: "had" | DealReview; installId: number | null } | null | undefined): string {
  if (!h) return "That deal isn't on the Pipeline anymore.";
  if (h.kind === "had") return "That deal was sent to installs already.";
  return h.kind === "linked"
    ? "Linked to the account's open install, for an Admin to review."
    : "Install made for the deal, for an Admin to review.";
}
