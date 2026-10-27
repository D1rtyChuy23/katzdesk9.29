import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { History, Lock } from "lucide-react";
import { getWoHistory, type WoHistoryDetail, type WoHistorySummary } from "@/lib/ops/wo-history-api";
import { historyDay, historyTitle, isHistoryLabor } from "@/lib/ops/wo-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PartThumb } from "./part-thumb";
import { cn } from "@/lib/utils";

const money = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));
const day = (s: string | null | undefined) => (s ? historyDay(s.slice(0, 10)) : "—");
const qtyText = (n: number | null) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(2));

/** "WO-0211 · Jul 24, 2026". */
const titleOf = (h: Pick<WoHistorySummary, "ref" | "wo" | "completed">) => historyTitle(h, historyDay);

/**
 * One work order from the old ticket system, read-only: the ticket (what was asked, what was done, who did it) and
 * its QuickBooks invoice (lines exactly as billed, one discount, the total). Nothing here can be edited or approved.
 */
export function WoHistoryWindow({ id, initialTab = "ticket", onClose }: { id: number; initialTab?: "ticket" | "invoice"; onClose: () => void }) {
  const q = useQuery({ queryKey: ["wo-history", id], queryFn: () => getWoHistory({ data: { id } }) });
  const [tab, setTab] = useState<"ticket" | "invoice">(initialTab);
  const navigate = useNavigate();
  const h = q.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="wo-history-window">
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <History className="size-5 text-muted-foreground" aria-hidden />
          {h ? titleOf(h) : "Work order history"}
          <Badge size="tight" variant="outline" data-testid="wo-history-badge">
            Historical
          </Badge>
        </DialogTitle>
        <DialogDescription>
          {h ? `${h.customer}${h.ref !== h.wo ? ` · ${h.ref}` : ""}` : "Loading…"}
        </DialogDescription>
        {!h ? (
          <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Loading the work order…"}</p>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm" data-testid="wo-history-locked">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                Imported from QuickBooks. Read-only.
                {h.jobId ? (
                  <>
                    {" "}
                    It's attached to KatzDesk ticket{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => {
                        onClose();
                        void navigate({ to: "/service", search: { open: h.jobId! } });
                      }}
                      data-testid="wo-history-open-ticket"
                    >
                      #{h.jobId}
                      {h.jobCallId ? ` (${h.jobCallId})` : ""}
                    </button>
                    .
                  </>
                ) : null}
              </span>
            </p>
            <div className="flex gap-1.5" role="tablist" aria-label="Work order">
              {(["ticket", "invoice"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn("h-9 rounded-full px-3 text-sm font-medium", tab === t ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground")}
                  data-testid={`wo-history-tab-${t}`}
                >
                  {t === "ticket" ? "Ticket" : h.invoice ? `Invoice · ${money(h.invoice.total)}` : "Invoice"}
                </button>
              ))}
            </div>
            {tab === "ticket" ? <TicketPanel h={h} /> : <InvoicePanel h={h} />}
            <div className="flex justify-end border-t border-border pt-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

function TicketPanel({ h }: { h: WoHistoryDetail }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2" data-testid="wo-history-ticket">
      <Field label="Completed">{h.completed ? `${day(h.completed)} ${h.completed.slice(11, 16)}` : "—"}</Field>
      <Field label="Tech">
        {h.technician ?? "—"}
        {h.techNote ? <span className="block text-xs text-muted-foreground" data-testid="wo-history-tech-note">{h.techNote}</span> : null}
      </Field>
      <Field label="Call">{[h.callCategory, h.serviceType].filter(Boolean).join(" · ") || "—"}</Field>
      <Field label="Location">
        {h.locationNeeded ? (
          <span className="text-warning">Location needed (billed to {h.customer})</span>
        ) : (
          h.serviceLocation ?? h.customer
        )}
        {h.fileCustomer && h.fileCustomer !== h.customer && !h.locationNeeded ? (
          <span className="block text-xs text-muted-foreground">Billed to {h.fileCustomer}</span>
        ) : null}
      </Field>
      <Field label="Problem" wide>
        {h.problem ?? "—"}
      </Field>
      <Field label="Work done" wide>
        {h.workDone ?? "—"}
      </Field>
      <Field label="Parts used" wide>
        {h.partsUsed ?? "—"}
      </Field>
      <Field label="Labor hours">{h.laborHours ?? "—"}</Field>
      <Field label="Trip charges">{h.tripCharges ?? "—"}</Field>
      <Field label="P.O. #">
        {h.po ?? "—"}
        {h.srv ? <span className="block text-xs text-muted-foreground">Cimbali ticket {h.srv}</span> : null}
      </Field>
      <Field label="Invoice total (QuickBooks)">{money(h.invoiceTotal)}</Field>
      {h.reviewFlags ? (
        <Field label="Review flags" wide>
          <span className="text-warning">{h.reviewFlags}</span>
        </Field>
      ) : null}
    </dl>
  );
}

function InvoicePanel({ h }: { h: WoHistoryDetail }) {
  const inv = h.invoice;
  if (!inv)
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground" data-testid="wo-history-no-invoice">
        No invoice lines for this work order in the QuickBooks export
        {h.invoiceTotal ? `. QuickBooks invoice total: ${money(h.invoiceTotal)}.` : "."}
      </p>
    );
  return (
    <section className="space-y-3" data-testid="wo-history-invoice">
      <p className="text-xs text-muted-foreground">
        Billed in QuickBooks{inv.invoiceDate ? ` on ${day(inv.invoiceDate)}` : ""}. Lines are exactly as billed.
      </p>
      <ul className="space-y-2">
        {h.lines.map((l) => {
          const labor = isHistoryLabor(l.kind);
          return (
            <li key={l.id} className="rounded-lg border border-border p-2" data-testid="wo-history-line" data-kind={l.kind}>
              <div className="flex items-start gap-2">
                {labor ? null : <PartThumb part={l.part} name={l.description ?? l.itemCode ?? ""} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                    <span className="min-w-0 break-words">{l.itemCode ?? "—"}</span>
                    <span className="text-[10px] font-semibold tracking-[0.1em] text-copper uppercase" data-testid="wo-history-line-type">
                      {l.lineType}
                    </span>
                  </p>
                  {l.description ? <p className="text-xs text-muted-foreground">{l.description}</p> : null}
                  {!labor && l.part?.mpn ? <p className="text-xs text-muted-foreground">MPN {l.part.mpn}</p> : null}
                </div>
                <div className="grid shrink-0 grid-cols-3 gap-3 text-right text-sm tabular">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{labor ? "Hours" : "Qty"}</p>
                    <p>{qtyText(l.qty)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Price</p>
                    <p>{money(l.unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Amount</p>
                    <p className="font-medium">{money(l.amount)}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-5" data-testid="wo-history-totals">
        {[
          ["Parts", money(inv.parts)],
          ["Labor", money(inv.labor)],
          ["Subtotal", money(inv.subtotal)],
          ["Discount", inv.discount ? `−${money(inv.discount)}` : money(0)],
          ["Total", money(inv.total)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{k}</dt>
            <dd className={cn("tabular", k === "Total" ? "text-base font-semibold" : "font-medium")}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm" data-testid="wo-history-qb-total">
        QuickBooks invoice total: <span className="font-medium tabular">{money(h.invoiceTotal)}</span>
        {inv.differs ? (
          <span className="mt-1 block text-xs text-warning" data-testid="wo-history-differs">
            Differs from the line total by {money(Math.abs((h.invoiceTotal ?? 0) - inv.total))}: usually tax, freight, or a line billed on another invoice.
          </span>
        ) : null}
      </p>
    </section>
  );
}
