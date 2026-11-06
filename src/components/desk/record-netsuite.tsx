import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { getRecordBilling, type RecordBillingView, type RecordType } from "@/lib/ops/record-billing-api";
import { invoiceStatusKey } from "@/lib/ops/billing-rules";
import { discountLabel } from "@/lib/ops/discount";
import { cn } from "@/lib/utils";
import { DoubleBillBadge, InvoiceStatusBadge } from "./ticket-invoices";

const money = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));

/** Under "record-billing" so a Billing Backfill write refreshes it. */
function useRecordBilling(type: RecordType, id: number) {
  return useQuery({ queryKey: ["record-billing", type, id], queryFn: () => getRecordBilling({ data: { type, id } }) });
}

/**
 * Read-only, on an install's or a PM's Invoices tab (11/5): NetSuite's invoices on it and the lines NetSuite billed,
 * brought back by Billing Backfill (NetSuite). Those lines are billed already: they aren't on its invoice in KatzDesk
 * and Export Billing never takes them.
 */
export function RecordNetSuitePanel({ type, id }: { type: RecordType; id: number }) {
  const billing = useRecordBilling(type, id);
  const b = billing.data;
  const what = type === "install" ? "install" : "PM";
  return (
    <section className="mt-5 border-t border-border pt-4" data-testid="record-netsuite">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">NetSuite</h3>
        {b ? <DoubleBillBadge on={b.doubleBill} /> : null}
        {b && b.invoices.length ? (
          <span className="ml-auto text-sm font-medium tabular" data-testid="record-netsuite-live-total">
            {money(b.liveTotal)}
          </span>
        ) : null}
      </div>
      {!b ? (
        <p className="mt-2 text-sm text-muted-foreground">{billing.isError ? "Couldn't load NetSuite's billing." : "Loading…"}</p>
      ) : b.stackedOn ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="record-netsuite-stacked">
          This PM is stacked on ticket #{b.stackedOn} and bills on it: its NetSuite invoices are on that ticket.
        </p>
      ) : !b.invoices.length && !b.groups.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No NetSuite invoices on this {what}. They come in with Billing Backfill (Admin, Tickets → Import).
        </p>
      ) : (
        <>
          {b.invoices.length ? (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {b.invoices.map((i) => (
                <li key={i.invoice} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm" data-testid="record-netsuite-invoice">
                  <span className="font-medium">{i.invoice}</span>
                  <InvoiceStatusBadge status={i.status} />
                  <span className="text-xs text-muted-foreground">
                    {i.date ?? "no date"}
                    {i.so ? ` · ${i.so}` : " · standalone"}
                    {i.wo ? ` · ${i.wo}` : ""}
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
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No NetSuite invoices on this {what} yet.</p>
          )}
          {b.groups.map((g) => (
            <BilledLines key={g.wo} g={g} />
          ))}
          <RecordChecks b={b} what={what} />
        </>
      )}
    </section>
  );
}

function BilledLines({ g }: { g: RecordBillingView["groups"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-lg border border-border px-3 py-2 text-sm" data-testid="record-netsuite-lines">
      <button type="button" className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="font-medium">Billed in NetSuite · {g.wo}</span>
        <span className="text-xs text-muted-foreground">
          {[g.so, g.billedOn ? `billed ${g.billedOn}` : null, `${g.lines.length} line${g.lines.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
        </span>
        <span className="ml-auto flex items-center gap-1 tabular">
          {money(g.net)}
          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <ul className="mt-2 space-y-0.5 border-t border-dashed border-border pt-2 text-xs">
          {g.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="min-w-0 break-words">
                {l.item}
                {l.description ? <span className="text-muted-foreground"> · {l.description}</span> : null}
              </span>
              <span className="shrink-0 tabular">
                {l.qty} × {money(l.rate)}
              </span>
            </li>
          ))}
          {!g.lines.length ? <li className="text-muted-foreground">No lines</li> : null}
          {g.discount ? (
            <li className="flex justify-between gap-2 text-muted-foreground">
              <span>NetSuite discount ({discountLabel(g.discount)})</span>
              <span className="shrink-0 tabular">−{money(g.off)}</span>
            </li>
          ) : null}
          <li className="text-[11px] text-muted-foreground">Billed already: not on the invoice in KatzDesk, and never in Export Billing.</li>
        </ul>
      ) : null}
    </div>
  );
}

function RecordChecks({ b, what }: { b: RecordBillingView; what: string }) {
  const lines: { tone: "danger" | "warn"; text: string }[] = [];
  const live = b.invoices.filter((i) => invoiceStatusKey(i.status) !== "voided").length;
  const charges = b.chargeSource === "katzdesk" ? `the ${what}'s own invoice in KatzDesk (${money(b.chargeNet)})` : `the charges (${money(b.chargeNet)})`;
  if (b.doubleBill) lines.push({ tone: "danger", text: `${live} live invoices add up to ${money(b.liveTotal)}, more than ${charges}.` });
  else if (b.mismatch) lines.push({ tone: "warn", text: `NetSuite's live invoices (${money(b.liveTotal)}) don't match ${charges}.` });
  for (const w of b.locationWarnings) lines.push({ tone: "warn", text: w });
  if (!lines.length) {
    return live ? (
      <p className="mt-2 text-xs text-muted-foreground" data-testid="record-netsuite-checks-ok">
        The live invoices match {charges}.
      </p>
    ) : null;
  }
  return (
    <ul className="mt-2 space-y-1" data-testid="record-netsuite-checks">
      {lines.map((l) => (
        <li key={l.text} className={cn("flex items-start gap-1.5 text-xs", l.tone === "danger" ? "text-destructive" : "text-warning")}>
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {l.text}
        </li>
      ))}
    </ul>
  );
}
