import { Input, Label } from "@/components/ui/input";
import { PO_MAX, poCardLine, saleRefLine } from "@/lib/ops/ticket-po";
import type { InstallSale } from "@/lib/ops/types";
import { cn } from "@/lib/utils";
import { useSyncedPo } from "./po-form";

/**
 * The Customer P.O. and Vendor P.O. boxes on every ticket's Details (Chuy, 11/2): service and TLC tickets, PMs, installs
 * and deals (a rebuild's Details keep their own state). Each box keeps its own state (useSyncedPo) inside the form, and
 * the form sends a box only when it was changed there (poFromForm), so a form that saves as it closes never puts an
 * older P.O. back.
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
  const customer = useSyncedPo(po, idPrefix, !!lock);
  const vendor = useSyncedPo(vendorPo, idPrefix);
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-po`}>Customer P.O.</Label>
        <Input
          id={`${idPrefix}-po`}
          name="po"
          value={customer.value}
          onChange={(e) => customer.set(e.target.value)}
          data-base={customer.base}
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
          value={vendor.value}
          onChange={(e) => vendor.set(e.target.value)}
          data-base={vendor.base}
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
  // A long P.O. with no spaces wraps instead of pushing the card wider than a phone.
  return (
    <span className={cn("mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]", className)} data-testid="card-po">
      {line}
    </span>
  );
}

/**
 * An install's sale on its Details (Chuy, 11/3), read only: the Sale Invoice # or Sales Order # and P.O. of the deal it
 * came from, for reference. The sale's P.O. is for the equipment sale, not the install visit, so it stays on the deal
 * and never goes on the install's invoice. Nothing when the install came from no deal.
 */
export function SaleRef({ sale }: { sale: InstallSale | null | undefined }) {
  if (!sale) return null;
  const line = saleRefLine(sale);
  return (
    <div className="sm:col-span-2" data-testid="install-sale-ref">
      <p className="text-xs font-medium text-muted-foreground">Sale</p>
      <p className="mt-1 text-sm [overflow-wrap:anywhere]" data-testid="install-sale-ref-line">
        {line ?? "The deal has no Sale Invoice/SO # or P.O. yet."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">From the deal these machines came from, for reference. Change them on the deal.</p>
    </div>
  );
}
