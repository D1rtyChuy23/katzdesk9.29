import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MapPin } from "lucide-react";
import { getTicketBilling, type TicketBillingView } from "@/lib/ops/ticket-billing-api";
import { invoiceStatusKey } from "@/lib/ops/billing-rules";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const money = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));

/** The ticket's NetSuite invoices, lock and checks. Under "ticket-billing" so a backfill or a charges save refreshes it. */
function useTicketBilling(jobId: number | null | undefined) {
  return useQuery({
    queryKey: ["ticket-billing", jobId],
    queryFn: () => getTicketBilling({ data: { jobId: jobId! } }),
    enabled: jobId != null,
  });
}

/** Red: two or more live invoices add up to more than the charges. */
export function DoubleBillBadge({ on, className }: { on: boolean | null | undefined; className?: string }) {
  if (!on) return null;
  return (
    <Badge variant="danger" className={className} data-testid="double-bill-badge">
      Possible double bill
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const key = invoiceStatusKey(status);
  return (
    <Badge
      size="tight"
      variant={key === "paid" ? "success" : key === "open" ? "warn" : "outline"}
      className={cn(key === "voided" && "text-muted-foreground line-through")}
      data-testid="invoice-status"
    >
      {status}
    </Badge>
  );
}

/** The ticket window's header: the double-bill badge, and a Corrigo service location that is another account. */
export function TicketBillingFlags({ jobId }: { jobId: number }) {
  const billing = useTicketBilling(jobId);
  const b = billing.data;
  if (!b) return null;
  return (
    <>
      <DoubleBillBadge on={b.doubleBill} />
      {b.locationAccount ? (
        <span className="flex basis-full items-start gap-1 text-xs text-warning" data-testid="ticket-location-warning">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          Corrigo&apos;s service location is “{b.serviceLocation}”, which is the account {b.locationAccount}, not this ticket&apos;s account.
        </span>
      ) : null}
    </>
  );
}

/** Read-only: every NetSuite invoice on the ticket, what they add up to, and the checks. */
export function TicketInvoicesPanel({ jobId }: { jobId: number }) {
  const billing = useTicketBilling(jobId);
  const b = billing.data;
  return (
    <section className="border-b border-border p-5" data-testid="ticket-netsuite-invoices">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">NetSuite Invoices</h3>
        {b ? <DoubleBillBadge on={b.doubleBill} /> : null}
        {b && b.invoices.length ? (
          <span className="ml-auto text-sm font-medium tabular" data-testid="netsuite-live-total">
            {money(b.liveTotal)}
          </span>
        ) : null}
      </div>
      {!b ? (
        <p className="mt-2 text-sm text-muted-foreground">{billing.isError ? "Couldn't load the invoices." : "Loading…"}</p>
      ) : b.invoices.length ? (
        <>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {b.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm" data-testid="netsuite-invoice">
                <span className="font-medium">{i.invoice}</span>
                <InvoiceStatusBadge status={i.status} />
                <span className="text-xs text-muted-foreground">
                  {i.date ?? "no date"}
                  {i.so ? ` · ${i.so}` : " · standalone"}
                  {i.location ? ` · ${i.location}` : ""}
                </span>
                <span className="ml-auto text-right tabular">
                  {money(i.total)}
                  {i.remaining != null && invoiceStatusKey(i.status) !== "voided" ? (
                    <span className="block text-[11px] text-muted-foreground">{money(i.remaining)} remaining</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <BillingChecks b={b} />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No NetSuite invoices on this ticket. They come in with Billing Backfill (Admin, Tickets → Import).</p>
      )}
    </section>
  );
}

function BillingChecks({ b }: { b: TicketBillingView }) {
  const lines: { tone: "danger" | "warn" | "muted"; text: string }[] = [];
  const live = b.invoices.filter((i) => invoiceStatusKey(i.status) !== "voided").length;
  if (b.doubleBill) {
    lines.push({ tone: "danger", text: `${live} live invoices add up to ${money(b.liveTotal)}, more than the charges (${money(b.chargeNet)}).` });
  } else if (b.mismatch) {
    lines.push({ tone: "warn", text: `NetSuite's live invoices (${money(b.liveTotal)}) don't match the charges after the discount (${money(b.chargeNet)}).` });
  }
  if (b.corrigoNet != null && Math.abs(b.corrigoNet - b.chargeNet) > 0.005) {
    lines.push({ tone: "muted", text: `Corrigo's net is ${money(b.corrigoNet)}; the charges after the discount are ${money(b.chargeNet)}.` });
  }
  for (const w of b.locationWarnings) lines.push({ tone: "warn", text: w });
  if (!lines.length) return <p className="mt-2 text-xs text-muted-foreground">The live invoices match the charges ({money(b.chargeNet)}).</p>;
  return (
    <ul className="mt-2 space-y-1" data-testid="netsuite-checks">
      {lines.map((l) => (
        <li
          key={l.text}
          className={cn("flex items-start gap-1.5 text-xs", l.tone === "danger" ? "text-destructive" : l.tone === "warn" ? "text-warning" : "text-muted-foreground")}
        >
          {l.tone === "muted" ? null : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
          {l.text}
        </li>
      ))}
    </ul>
  );
}
