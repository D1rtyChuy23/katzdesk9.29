import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MapPin, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { approveInvoice, getInvoice, type InvoiceView } from "@/lib/ops/invoice-api";
import { LABOR_ITEM, TRIP_ITEM, kindForItem, lineAmount, type ChargeKind, type PartRef } from "@/lib/ops/charges";
import { cleanDiscount, discountLabel, type DiscountKind } from "@/lib/ops/discount";
import { billToGaps, invoiceError, invoiceTotals, isLaborKind, type InvoiceTarget } from "@/lib/ops/invoice";
import { formatRep } from "@/lib/ops/rep-match";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { PartPicker } from "./charges-panel";
import { PartThumb } from "./part-thumb";
import { cn } from "@/lib/utils";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type Draft = { item: string; description: string; qty: string; rate: string; kind: ChargeKind; part: PartRef | null };

const toDraft = (l: InvoiceView["lines"][number]): Draft => ({ item: l.item, description: l.description, qty: String(l.qty), rate: l.rate.toFixed(2), kind: l.kind, part: l.part });

const directions = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

/**
 * Invoice: the same action on every customer record. A button that opens the Invoice window; nothing is a separate
 * page. Shows "Approved" once the record has an approved invoice.
 */
export function InvoiceButton({ type, id, className }: { type: InvoiceTarget; id: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["invoice", type, id], queryFn: () => getInvoice({ data: { type, id } }), staleTime: 30_000 });
  const approved = !!q.data?.approvedAt;
  return (
    <>
      <Button type="button" size="sm" variant="outline" className={cn("gap-1.5", className)} onClick={() => setOpen(true)} data-testid="invoice-open">
        <Receipt className="size-4" />
        Invoice
        {approved ? (
          <Badge size="tight" variant="success" className="ml-0.5" data-testid="invoice-approved-badge">
            Approved
          </Badge>
        ) : null}
      </Button>
      {open ? <InvoiceWindow type={type} id={id} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * The Invoice window: billing info from the account, the lines (parts with description, MPN, photo, qty and price;
 * labor), one discount, the total. Lines are added and removed here. Approve saves it; Cancel saves nothing.
 */
export function InvoiceWindow({ type, id, onClose }: { type: InvoiceTarget; id: number; onClose: () => void }) {
  const qc = useQueryClient();
  // Always read fresh when the window opens, so a cancelled draft never comes back.
  const q = useQuery({ queryKey: ["invoice", type, id], queryFn: () => getInvoice({ data: { type, id } }), refetchOnMount: "always" });
  const [lines, setLines] = useState<Draft[] | null>(null);
  const [discKind, setDiscKind] = useState<DiscountKind>("percent");
  const [discValue, setDiscValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const v = q.data;

  useEffect(() => {
    if (!v || lines) return;
    setLines(v.lines.map(toDraft));
    setDiscKind(v.discount?.kind ?? "percent");
    setDiscValue(v.discount ? String(v.discount.value) : "");
  }, [v, lines]);

  const approve = useMutation({
    mutationFn: () =>
      approveInvoice({
        data: {
          type,
          id,
          lines: (lines ?? []).map((l) => ({ item: l.item, description: l.description, qty: l.qty, rate: l.rate })),
          discount: discValue.trim() ? { kind: discKind, value: discValue } : null,
        },
      }),
    onSuccess: (next) => {
      qc.setQueryData(["invoice", type, id], next);
      // A ticket's invoice is its Charges: the panel and the billing list read the same lines.
      void qc.invalidateQueries({ queryKey: ["charges", id] });
      void qc.invalidateQueries({ queryKey: ["account-invoices"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      toast.success(`Invoice approved · ${money(next.total)}`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve the invoice"),
  });

  const draft = lines ?? [];
  const locked = !!v?.locked;
  const typed = cleanDiscount(discKind, discValue);
  const discount = "error" in typed ? null : typed.discount;
  const totals = invoiceTotals(
    draft.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, kind: l.kind })),
    discount,
  );
  const problem = !draft.length ? "Add a line to approve." : (invoiceError(draft) ?? ("error" in typed ? typed.error : null));
  const edit = (i: number, patch: Partial<Draft>) => {
    setLines((cur) => (cur ?? []).map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const add = (l: Draft) => {
    setLines((cur) => [...(cur ?? []), l]);
    setDirty(true);
  };
  const remove = (i: number) => {
    setLines((cur) => (cur ?? []).filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const changedSinceApproval = !!v?.approvedAt && v.approvedTotal != null && !dirty && Math.abs(v.approvedTotal - v.total) > 0.004;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" data-testid="invoice-window" data-type={type}>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          Invoice
          {v?.approvedAt ? (
            <Badge size="tight" variant="success">
              <CheckCircle2 className="mr-1 size-3.5" />
              Approved
            </Badge>
          ) : null}
        </DialogTitle>
        <DialogDescription data-testid="invoice-record">{v ? v.title : "Loading…"}</DialogDescription>

        {!v || !lines ? (
          <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Loading the invoice…"}</p>
        ) : (
          <>
            {/* Billing info: from the account, never asked for again. */}
            <section className="rounded-lg border border-border bg-muted/40 p-3" data-testid="invoice-bill-to">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Bill To</p>
                <p className="text-[11px] text-muted-foreground">Filled from the account</p>
              </div>
              <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[7.5rem_1fr]">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium" data-testid="invoice-bill-name">
                  {v.billTo.name}
                </dd>
                <dt className="text-muted-foreground">Account #</dt>
                <dd className="tabular" data-testid="invoice-bill-account">
                  {v.billTo.accountNumber ?? <span className="text-muted-foreground">Not set</span>}
                </dd>
                <dt className="text-muted-foreground">Address</dt>
                <dd data-testid="invoice-bill-address">
                  {v.billTo.address ? (
                    <a href={directions(v.billTo.address)} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 hover:text-primary hover:underline">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      {v.billTo.address}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Rep</dt>
                <dd data-testid="invoice-bill-rep">{v.billTo.rep ? formatRep(v.billTo.rep) || v.billTo.rep : <span className="text-muted-foreground">Not set</span>}</dd>
              </dl>
              {billToGaps(v.billTo).length ? (
                <p className="mt-2 text-xs text-warning" data-testid="invoice-bill-gaps">
                  {billToGaps(v.billTo).join(" · ")}. Fix it on the account; the invoice reads it from there.
                </p>
              ) : null}
            </section>

            {v.locked ? (
              <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm" data-testid="invoice-locked">
                {v.locked}
              </p>
            ) : v.sharedWithCharges ? (
              <p className="text-xs text-muted-foreground">These are this ticket's Charges. Approving saves them there too, so billing reads the same lines.</p>
            ) : null}

            {/* Lines */}
            <section data-testid="invoice-lines">
              {draft.length ? (
                <ul className="space-y-2">
                  {draft.map((l, i) => {
                    const labor = isLaborKind(l.kind);
                    return (
                      <li key={i} className="rounded-lg border border-border p-2" data-testid="invoice-line" data-kind={labor ? "labor" : "part"}>
                        <div className="flex items-start gap-2">
                          {!labor ? <PartThumb part={l.part} name={l.item} size="md" /> : null}
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                              <span className="min-w-0 break-words">{l.item}</span>
                              <span className="text-[10px] font-semibold tracking-[0.1em] text-copper uppercase">{labor ? "Labor" : "Part"}</span>
                            </p>
                            {!labor ? (
                              <p className="text-xs text-muted-foreground" data-testid="invoice-line-mpn">
                                MPN {l.part?.mpn ? <span className="font-medium text-foreground">{l.part.mpn}</span> : "not set"}
                              </p>
                            ) : null}
                            <Input
                              aria-label="Description"
                              value={l.description}
                              disabled={locked}
                              placeholder={labor ? "What the labor was" : ""}
                              onChange={(e) => edit(i, { description: e.target.value })}
                              className="mt-1 h-8 text-xs"
                              data-testid="invoice-line-description"
                            />
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${l.item}`}
                            disabled={locked}
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40"
                            onClick={() => remove(i)}
                            data-testid="invoice-line-remove"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[11px]">{labor ? "Hours" : "Qty"}</Label>
                            <Input inputMode="decimal" value={l.qty} disabled={locked} onChange={(e) => edit(i, { qty: e.target.value })} className="mt-0.5 h-8" data-testid="invoice-line-qty" />
                          </div>
                          <div>
                            <Label className="text-[11px]">Price</Label>
                            <Input inputMode="decimal" value={l.rate} disabled={locked} onChange={(e) => edit(i, { rate: e.target.value })} className="mt-0.5 h-8" data-testid="invoice-line-rate" />
                          </div>
                          <div>
                            <Label className="text-[11px]">Amount</Label>
                            <p className="mt-0.5 flex h-8 items-center text-sm tabular">{money(lineAmount({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0 }))}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No lines yet. Add the parts and the labor.</p>
              )}
              {!locked ? (
                <div className="mt-3 space-y-3" data-testid="invoice-add">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => add({ item: LABOR_ITEM, description: "Service Labor Hour", qty: "1", rate: "150.00", kind: "labor", part: null })} data-testid="invoice-add-labor">
                      <Plus className="size-4" />
                      Labor Hour
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => add({ item: TRIP_ITEM, description: "Trip Charge for Service Call", qty: "1", rate: "150.00", kind: "trip", part: null })} data-testid="invoice-add-trip">
                      <Plus className="size-4" />
                      Trip Charge
                    </Button>
                  </div>
                  <PartPicker
                    id={`invoice-part-${type}-${id}`}
                    onPick={(it) =>
                      add({
                        item: it.item,
                        // The part's stored description, or blank. Never made up.
                        description: it.description ?? "",
                        qty: "1",
                        rate: it.rate != null ? it.rate.toFixed(2) : "0.00",
                        kind: it.kind || kindForItem(it.item),
                        part: it.part ?? null,
                      })
                    }
                  />
                </div>
              ) : null}
            </section>

            {/* Discount: percent or amount, one value, taken off the lines once. */}
            <section className="rounded-lg border border-border p-3" data-testid="invoice-discount">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Discount</p>
                  <div className="mt-1 flex gap-1.5" role="group" aria-label="Discount type">
                    {(["percent", "amount"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        disabled={locked}
                        aria-pressed={discKind === k}
                        onClick={() => {
                          setDiscKind(k);
                          setDirty(true);
                        }}
                        className={cn("h-9 rounded-full px-3 text-sm font-medium disabled:opacity-60", discKind === k ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground")}
                        data-testid={`invoice-discount-${k}`}
                      >
                        {k === "percent" ? "Percent" : "Amount"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-32">
                  <Label htmlFor={`invoice-discount-${type}-${id}`}>{discKind === "percent" ? "Percent (%)" : "Amount ($)"}</Label>
                  <Input
                    id={`invoice-discount-${type}-${id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="None"
                    value={discValue}
                    disabled={locked}
                    onChange={(e) => {
                      setDiscValue(e.target.value);
                      setDirty(true);
                    }}
                    className="mt-1"
                    data-testid="invoice-discount-value"
                  />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-5" data-testid="invoice-totals">
                <div>
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Parts</dt>
                  <dd className="tabular font-medium" data-testid="invoice-parts">{money(totals.parts)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Labor</dt>
                  <dd className="tabular font-medium" data-testid="invoice-labor">{money(totals.labor)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Subtotal</dt>
                  <dd className="tabular font-medium" data-testid="invoice-subtotal">{money(totals.subtotal)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Discount{discount ? ` · ${discountLabel(discount)}` : ""}</dt>
                  <dd className="tabular font-medium" data-testid="invoice-off">{totals.off ? `−${money(totals.off)}` : money(0)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Total</dt>
                  <dd className="tabular text-base font-semibold" data-testid="invoice-total">{money(totals.total)}</dd>
                </div>
              </dl>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
              <p className="mr-auto text-xs text-muted-foreground" data-testid="invoice-status">
                {v.approvedAt
                  ? `Approved by ${v.approvedBy ?? "Desk"} on ${when(v.approvedAt)}${v.approvedTotal != null ? ` at ${money(v.approvedTotal)}` : ""}.${changedSinceApproval ? " The Charges changed since; approve again to match." : ""}`
                  : "Not approved yet. Cancel saves nothing."}
                {problem && !locked ? <span className="block text-destructive">{problem}</span> : null}
              </p>
              <Button type="button" variant="outline" onClick={onClose} disabled={approve.isPending} data-testid="invoice-cancel">
                Cancel
              </Button>
              <Button type="button" onClick={() => approve.mutate()} disabled={locked || approve.isPending || !!problem || !draft.length} data-testid="invoice-approve">
                {approve.isPending ? "Approving…" : "Approve"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
