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

/** The badge on the install's card, and the review's line on the Handoff page. */
export function dealReviewBadge(kind: DealReview): string {
  return kind === "linked" ? "Deal link to review" : "New install to review";
}

/** What the review says on the install's card (the badge's tooltip) and on the Handoff page. */
export function dealReviewText(kind: DealReview): string {
  return kind === "linked"
    ? "Linked to its deal when the deal was marked complete: the account's newest open install with no deal. An Admin approves the link or unlinks it."
    : "Made for its deal when the deal was marked complete: the account had no open install with no deal. An Admin approves it; if it isn't needed, remove it from the install list.";
}

/** The confirm before Unlink (an install that was linked; one made for the deal isn't unlinked). */
export const DEAL_UNLINK_CONFIRM =
  "Unlink this install from the deal? The install keeps its own work. The deal goes back to the Handoff page's completed deals, and its next handoff won't pick this install again.";

/** The toast after an Admin's review. */
export function dealReviewToast(r: { approved: boolean; kind: DealReview; backOnHandoff: boolean }): string {
  if (r.approved) return r.kind === "made" ? "Install approved for its deal" : "Deal link approved";
  return r.backOnHandoff ? "Unlinked. The deal is back on the Handoff page." : "Unlinked. The deal is still on another install.";
}

/** The Handoff page's toast after Send to installs. */
export function handoffToast(h: { kind: "had" | DealReview; installId: number } | null | undefined): string {
  if (!h) return "That deal isn't on the Pipeline anymore.";
  if (h.kind === "had") return "That deal is on the install board already.";
  return h.kind === "linked"
    ? "Linked to the account's open install, for an Admin to review."
    : "Install made for the deal, for an Admin to review.";
}
