import { Input, Label } from "@/components/ui/input";
import { PO_MAX, poCardLine } from "@/lib/ops/ticket-po";
import { cn } from "@/lib/utils";

/**
 * The Customer P.O. and Vendor P.O. boxes on every ticket's Details (Chuy, 11/2): service and TLC tickets, PMs, installs
 * and deals (a rebuild's Details keep their own state). Uncontrolled, like the forms they sit in; the form sends a box
 * only when it reads differently from what it was given (poFromForm, in po-form.ts), so a form that saves as it closes
 * never puts an older P.O. back.
 */
export function PoFields({
  idPrefix,
  po,
  vendorPo,
  lock,
  customerNote = "Goes on the invoice.",
}: {
  /** Unique per record ("job-12"), so each label opens its own box when two sheets are open. */
  idPrefix: string;
  po: string | null | undefined;
  vendorPo: string | null | undefined;
  /** Why the Customer P.O. can't change here (a ticket billed or invoiced in NetSuite), or null. */
  lock?: string | null;
  /** What the Customer P.O. box says under it when it isn't locked. */
  customerNote?: string;
}) {
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-po`}>Customer P.O.</Label>
        <Input
          id={`${idPrefix}-po`}
          name="po"
          defaultValue={po ?? ""}
          maxLength={PO_MAX}
          autoComplete="off"
          disabled={!!lock}
          className="mt-1"
          data-testid="po-customer"
        />
        <p className="mt-1 text-xs text-muted-foreground" data-testid="po-customer-note">
          {lock || customerNote}
        </p>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-vendor-po`}>Vendor P.O.</Label>
        <Input
          id={`${idPrefix}-vendor-po`}
          name="vendorPo"
          defaultValue={vendorPo ?? ""}
          maxLength={PO_MAX}
          autoComplete="off"
          className="mt-1"
          data-testid="po-vendor"
        />
        <p className="mt-1 text-xs text-muted-foreground">A vendor&apos;s P.O. number, for reference only.</p>
      </div>
    </>
  );
}

/** The P.O.s on a board card (11/2): "P.O. 4455 · Vendor P.O. TLC-889", or nothing when it has neither. */
export function PoLine({ po, vendorPo, className }: { po?: string | null; vendorPo?: string | null; className?: string }) {
  const line = poCardLine({ po, vendorPo });
  if (!line) return null;
  return (
    <span className={cn("mt-0.5 block text-xs text-muted-foreground", className)} data-testid="card-po">
      {line}
    </span>
  );
}
