import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { listAccountWoHistory, listJobWoHistory, type WoHistorySummary } from "@/lib/ops/wo-history-api";
import { historyDay, historyTitle as titleWith, totalsDiffer } from "@/lib/ops/wo-history";
import { Skeleton } from "@/components/ui/separator";
import { WoHistoryWindow } from "./wo-history-window";

const historyTitle = (h: WoHistorySummary) => titleWith(h, historyDay);

const money = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));

/** How many rows show before "Show all". */
const FIRST = 25;

function Row({ h, mode, onOpen }: { h: WoHistorySummary; mode: "tickets" | "invoices"; onOpen: () => void }) {
  const total = mode === "invoices" ? h.linesTotal : h.invoiceTotal;
  const differs = mode === "invoices" && h.linesTotal != null && totalsDiffer(h.linesTotal, h.invoiceTotal);
  return (
    <li>
      <button type="button" onClick={onOpen} className="desk-flat flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60" data-testid="wo-history-row">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{mode === "invoices" ? `Invoice ${historyTitle(h)}` : historyTitle(h)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {mode === "invoices"
              ? `Historical · Billed in QuickBooks${h.invoiceDate ? ` ${historyDay(h.invoiceDate)}` : ""}${h.jobId ? ` · Ticket #${h.jobId}` : ""}${differs ? " · differs from QuickBooks total" : ""}`
              : [h.technician, h.originalTech ? `done by ${h.originalTech}` : null, h.callCategory, h.problem].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium tabular">{money(total)}</span>
      </button>
    </li>
  );
}

/**
 * The account's work orders from the old ticket system (QuickBooks history), read-only.
 * Tickets tab: work orders that aren't already a KatzDesk ticket. Invoices tab: every one with invoice lines.
 */
export function AccountWoHistory({ customer, mode }: { customer: string; mode: "tickets" | "invoices" }) {
  const q = useQuery({ queryKey: ["wo-history-account", customer.toLowerCase()], queryFn: () => listAccountWoHistory({ data: { customer } }) });
  const [open, setOpen] = useState<number | null>(null);
  const [shown, setShown] = useState(mode === "invoices");
  const [all, setAll] = useState(false);
  const rows = (q.data ?? []).filter((h) => (mode === "invoices" ? h.lineCount > 0 : !h.jobId));
  if (q.isLoading) return <Skeleton className="mt-4 h-12 w-full" />;
  if (!rows.length) return null;
  const visible = all ? rows : rows.slice(0, FIRST);
  return (
    <section className="mt-5" data-testid={`wo-history-${mode}`}>
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
        aria-expanded={shown}
      >
        {shown ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        QuickBooks history · {rows.length}
      </button>
      {shown ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "invoices" ? "Invoices billed in QuickBooks, 2024–2026. Read-only." : "Completed work orders from the old ticket system, 2024–2026. Read-only."}
          </p>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {visible.map((h) => (
              <Row key={h.id} h={h} mode={mode} onOpen={() => setOpen(h.id)} />
            ))}
          </ul>
          {rows.length > visible.length ? (
            <button type="button" className="mt-2 text-sm font-medium text-primary hover:underline" onClick={() => setAll(true)}>
              Show all {rows.length}
            </button>
          ) : null}
        </>
      ) : null}
      {open != null ? <WoHistoryWindow id={open} initialTab={mode === "invoices" ? "invoice" : "ticket"} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** On a KatzDesk ticket: the QuickBooks history attached to it, if any. */
export function JobWoHistory({ jobId }: { jobId: number }) {
  const q = useQuery({ queryKey: ["wo-history-job", jobId], queryFn: () => listJobWoHistory({ data: { jobId } }) });
  const [open, setOpen] = useState<number | null>(null);
  const rows = q.data ?? [];
  if (!rows.length) return null;
  return (
    <section className="mt-4 rounded-lg border border-border p-3" data-testid="job-wo-history">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">QuickBooks history</p>
      <ul className="mt-1 space-y-1">
        {rows.map((h) => (
          <li key={h.id}>
            <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setOpen(h.id)}>
              {historyTitle(h)} · {h.lineCount ? `invoice ${money(h.linesTotal)}` : "no invoice lines"}
            </button>
          </li>
        ))}
      </ul>
      {open != null ? <WoHistoryWindow id={open} initialTab="invoice" onClose={() => setOpen(null)} /> : null}
    </section>
  );
}
