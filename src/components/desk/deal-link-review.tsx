import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyAccess } from "@/lib/ops/access";
import { reviewDealLink } from "@/lib/ops/api";
import { DEAL_UNLINK_CONFIRM, dealReviewBadge, dealReviewButtons, dealReviewText, dealReviewToast, type DealReview } from "@/lib/ops/deal-review";
import { cn } from "@/lib/utils";

/**
 * A completed deal's link to an install, waiting for an Admin's review (Chuy, 11/3: "yes link and mark for review to
 * approve"): a badge everyone sees, and Approve link for an Admin (the Admin role or a desk admin, the rule the server
 * checks), with Unlink for an open install that was linked (dealReviewButtons). An install made for the deal is approved,
 * merged into the account's install for the same job, or removed. On the install's card and on the Handoff page.
 */
export function DealLinkReview({
  installId,
  kind,
  className,
  badge = true,
}: {
  installId: number;
  kind: DealReview;
  className?: string;
  /** The Handoff page lists the reviews under their own heading, with the text: no badge there. */
  badge?: boolean;
}) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const canReview = !!me.data?.approved && (!!me.data.isAdmin || me.data.role === "admin");
  const buttons = dealReviewButtons(kind, canReview);
  // The badge's text is a tooltip on a computer; a tap shows it on a phone, where there's no hover.
  const [why, setWhy] = useState(false);
  const review = useMutation({
    mutationFn: (approve: boolean) => reviewDealLink({ data: { installId, approve } }),
    onSuccess: (r) => {
      toast.success(dealReviewToast(r));
      for (const key of ["installs", "handoff", "customer-history", "deals", "dashboard"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not review the link"),
  });
  if (!badge && !buttons.approve) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)} data-testid="deal-review">
      {badge ? (
        <button
          type="button"
          className="rounded-full max-sm:py-2"
          aria-expanded={why}
          title={dealReviewText(kind)}
          onClick={(e) => {
            e.stopPropagation();
            setWhy((v) => !v);
          }}
          data-testid="deal-review-why"
        >
          <Badge variant="warn" size="tight" data-testid="deal-review-badge">
            {dealReviewBadge(kind)}
          </Badge>
        </button>
      ) : null}
      {buttons.approve ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 max-sm:h-10"
            disabled={review.isPending}
            onClick={(e) => {
              e.stopPropagation();
              review.mutate(true);
            }}
            data-testid="deal-review-approve"
          >
            Approve link
          </Button>
          {buttons.unlink ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 max-sm:h-10"
              disabled={review.isPending}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(DEAL_UNLINK_CONFIRM)) review.mutate(false);
              }}
              data-testid="deal-review-unlink"
            >
              Unlink
            </Button>
          ) : null}
        </>
      ) : null}
      {badge && why ? (
        <span className="basis-full text-xs text-muted-foreground" data-testid="deal-review-text">
          {dealReviewText(kind)}
        </span>
      ) : null}
    </span>
  );
}
