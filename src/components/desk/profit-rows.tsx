import { costSourceLabel, type BillProfitTotals, type LineProfit } from "@/lib/ops/part-pricing";
import { cn } from "@/lib/utils";

/**
 * Cost and margin under a bill line, and the bill's total, for an Admin or a role ticked in Who Sees Cost and Margin
 * (11/20). Used by the Charges panel (tickets) and the Invoice window (PMs, installs, rebuilds, deals).
 */
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function LineProfitRow({ p, labor }: { p: LineProfit & { stored: boolean }; labor: boolean }) {
  // Labor with no rate is waiting on Settings, not missing a part cost (11/20).
  const source = p.source === "none" ? (labor ? "no Labor Cost Rate (Settings)" : "no cost on file") : costSourceLabel(p.source);
  const service = labor || p.source === "trip";
  return (
    <p
      className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground tabular"
      title={`Cost from ${source}${p.stored ? ", stored when invoiced" : ""}`}
      data-testid="charge-profit"
    >
      <span>
        Cost <span className="font-medium text-foreground">{p.cost == null ? (labor ? "Labor Cost Rate not set" : "Not set") : money(p.cost)}</span>
      </span>
      <span>
        Sell <span className="font-medium text-foreground">{money(p.sell)}</span>
      </span>
      {service || (p.stored && p.ourDiscount == null) ? null : (
        <span>
          Discount <span className="font-medium text-foreground">{p.ourDiscount == null ? "—" : money(p.ourDiscount)}</span>
        </span>
      )}
      {p.ticketDiscount ? <span>Ticket discount −{money(p.ticketDiscount)}</span> : null}
      <span>
        Margin{" "}
        <span className={cn("font-medium", p.margin != null && p.margin < 0 ? "text-destructive" : "text-foreground")}>
          {p.margin == null ? "—" : `${money(p.margin)}${p.marginPct != null ? ` · ${p.marginPct}%` : ""}`}
        </span>
      </span>
      {p.stored ? <span className="text-success">Stored at invoicing</span> : null}
    </p>
  );
}

export function ProfitTotalsRow({ t, testId }: { t: BillProfitTotals; testId: string }) {
  return (
    <p className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground tabular" data-testid={testId}>
      <span className="font-medium text-foreground">Cost and margin{t.laborHidden ? " · parts and trip (labor not shown)" : ""}</span>
      <span>
        Sell <span className="font-medium text-foreground">{money(t.sell)}</span>
      </span>
      {t.ticketDiscount ? (
        <>
          <span>Discount −{money(t.ticketDiscount)}</span>
          <span>
            Net <span className="font-medium text-foreground">{money(t.sell - t.ticketDiscount)}</span>
          </span>
        </>
      ) : null}
      <span>
        {t.noCost ? "Known cost" : "Cost"} <span className="font-medium text-foreground">{money(t.cost)}</span>
      </span>
      <span>
        Margin{" "}
        <span className={cn("font-medium", t.margin != null && t.margin < 0 ? "text-destructive" : "text-foreground")}>
          {t.margin == null ? `— (${t.noCost} line${t.noCost === 1 ? "" : "s"} with no cost)` : `${money(t.margin)}${t.marginPct != null ? ` · ${t.marginPct}%` : ""}`}
        </span>
      </span>
    </p>
  );
}
