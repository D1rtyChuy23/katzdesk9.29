import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MapPin, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { approveInvoice, getInvoice, saveInvoiceForApproval, type InvoiceView } from "@/lib/ops/invoice-api";
import { LABOR_ITEM, TRIP_ITEM, kindForItem, lineAmount, type ChargeKind, type PartRef } from "@/lib/ops/charges";
import { cleanDiscount, discountLabel, type DiscountKind } from "@/lib/ops/discount";
import { billToGaps, invoiceError, invoiceTotals, isLaborKind, usesTicketCharges, type BillTo, type InvoiceTarget } from "@/lib/ops/invoice";
import { partsOnlyError } from "@/lib/ops/warehouse-invoice";
import { tripDraftWarning } from "@/lib/ops/pm-bill";
import { canDriveTo, directionsUrl, isPoint } from "@/lib/ops/geo";
import { formatRep } from "@/lib/ops/rep-match";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { PartPicker } from "./charges-panel";
import { AddPmParts } from "./pm-bill-add";
import { PartThumb } from "./part-thumb";
import { cn } from "@/lib/utils";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type Draft = { id?: number; item: string; description: string; qty: string; rate: string; kind: ChargeKind; part: PartRef | null; sourceKey?: string | null };

const toDraft = (l: InvoiceView["lines"][number]): Draft => ({ id: l.id, item: l.item, description: l.description, qty: String(l.qty), rate: l.rate.toFixed(2), kind: l.kind, part: l.part, sourceKey: l.sourceKey ?? null });

/** The account's saved pin as a point, or null. */
const billPin = (b: BillTo) => (b.latitude != null && b.longitude != null ? { lat: b.latitude, lng: b.longitude } : null);

/** Directions to the account: its exact map pin when the street was found, otherwise the typed address. */
const directions = (b: BillTo) => directionsUrl({ point: billPin(b), quality: b.geocodeMatch, address: b.address });

/** True when directions go to the saved map pin rather than the typed address. */
const toPin = (b: BillTo) => isPoint(billPin(b)) && canDriveTo(b.geocodeMatch);

/**
 * Invoice: the same action on every customer record. A button that opens the Invoice window; nothing is a separate
 * page. Shows "Approved" once the record has an approved invoice, and "Waiting" while Warehouse's saved invoice waits
 * for an Admin.
 */
export function InvoiceButton({ type, id, className }: { type: InvoiceTarget; id: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["invoice", type, id], queryFn: () => getInvoice({ data: { type, id } }), staleTime: 30_000 });
  const approved = !!q.data?.approvedAt;
  const waiting = q.data?.state === "waiting";
  return (
    <>
      <Button type="button" size="sm" variant="outline" className={cn("gap-1.5", className)} onClick={() => setOpen(true)} data-testid="invoice-open">
        <Receipt className="size-4" />
        Invoice
        {approved ? (
          <Badge size="tight" variant="success" className="ml-0.5" data-testid="invoice-approved-badge">
            Approved
          </Badge>
        ) : waiting ? (
          <Badge size="tight" variant="warn" className="ml-0.5" data-testid="invoice-waiting-badge">
            Waiting
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
 * Warehouse (a refurb for Katz Coffee Service Dept.) adds parts only and saves them for approval instead; an invoice
 * waiting for approval is approved by an Admin. What this person may do comes with the invoice from the server.
 */
export function InvoiceWindow({ type, id, onClose }: { type: InvoiceTarget; id: number; onClose: () => void }) {
  const qc = useQueryClient();
  // Always read fresh when the window opens, so a cancelled draft never comes back.
  const q = useQuery({ queryKey: ["invoice", type, id], queryFn: () => getInvoice({ data: { type, id } }), refetchOnMount: "always" });
  const [lines, setLines] = useState<Draft[] | null>(null);
  const [loadedIds, setLoadedIds] = useState<number[]>([]);
  const [discKind, setDiscKind] = useState<DiscountKind>("percent");
  const [discValue, setDiscValue] = useState("");
  const [dirty, setDirty] = useState(false);
  // The invoice the lines below started from: its saved-for-approval stamp (Approve sends it, so an Admin never approves
  // over parts Warehouse saved after the window opened) and where it stood.
  const [seen, setSeen] = useState<{ version: string | null; state: InvoiceView["state"] } | null>(null);
  const v = q.data;

  useEffect(() => {
    // Start from the invoice as the server has it now, not a copy cached by the Invoice button.
    if (!v || lines || q.isFetching) return;
    setLines(v.lines.map(toDraft));
    setLoadedIds(v.lines.flatMap((l) => (l.id != null ? [l.id] : [])));
    setDiscKind(v.discount?.kind ?? "percent");
    setDiscValue(v.discount ? String(v.discount.value) : "");
    setSeen({ version: v.version, state: v.state });
  }, [v, lines, q.isFetching]);

  const sentLines = () => (lines ?? []).map((l) => ({ item: l.item, description: l.description, qty: l.qty, rate: l.rate, sourceKey: l.sourceKey ?? null }));
  const sentDiscount = () => (discValue.trim() ? { kind: discKind, value: discValue } : null);
  const refreshAfter = (next: InvoiceView) => {
    qc.setQueryData(["invoice", type, id], next);
    // A ticket's invoice is its Charges: the panel and the billing list read the same lines.
    void qc.invalidateQueries({ queryKey: ["charges", id] });
    void qc.invalidateQueries({ queryKey: ["account-invoices"] });
    void qc.invalidateQueries({ queryKey: ["jobs"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
    void qc.invalidateQueries({ queryKey: ["pm-bill", id] });
    // The rebuild board's Invoice Waiting badge.
    void qc.invalidateQueries({ queryKey: ["rebuilds"] });
  };
  /**
   * After a refused Approve or Save: when the invoice changed under the window (Warehouse saved again, or it was
   * approved), the lines start over from it as it is now. Otherwise the typed lines stay, to fix.
   */
  const refused = async (e: unknown, fallback: string) => {
    toast.error(e instanceof Error ? e.message : fallback);
    const res = await q.refetch();
    // The invoice can't be read any more (the rebuild moved off this person's refurbs, say): nothing here applies.
    if (res.isError || !res.data) {
      onClose();
      return;
    }
    const fresh = res.data;
    if (seen && (fresh.version !== seen.version || fresh.state !== seen.state)) {
      setLines(null);
      setDirty(false);
    }
  };
  const approve = useMutation({
    mutationFn: () =>
      approveInvoice({
        data: { type, id, lines: sentLines(), lineIds: loadedIds, discount: sentDiscount(), seen: seen?.version ?? null },
      }),
    onSuccess: (next) => {
      refreshAfter(next);
      toast.success(`Invoice approved · ${money(next.total)}`);
      onClose();
    },
    onError: (e) => void refused(e, "Could not approve the invoice"),
  });
  const save = useMutation({
    mutationFn: () => saveInvoiceForApproval({ data: { type, id, lines: sentLines(), discount: sentDiscount() } }),
    onSuccess: (next) => {
      refreshAfter(next);
      toast.success(`Saved for approval · ${money(next.total)}. An Admin approves it.`);
      onClose();
    },
    onError: (e) => void refused(e, "Could not save the invoice"),
  });

  const draft = lines ?? [];
  // A billed ticket, or nothing this person may do here (Warehouse after an Admin approved; anyone but an Admin while
  // it waits for one): the lines are read only.
  const locked = !!v?.locked || (!!v && !v.canApprove && !v.canSave);
  const busy = approve.isPending || save.isPending;
  const typed = cleanDiscount(discKind, discValue);
  const discount = "error" in typed ? null : typed.discount;
  const totals = invoiceTotals(
    draft.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, kind: l.kind })),
    discount,
  );
  const problem = !draft.length
    ? v?.canSave
      ? "Add the parts the refurb used."
      : "Add a line to approve."
    : (invoiceError(draft) ?? (v?.partsOnly ? partsOnlyError(draft) : null) ?? ("error" in typed ? typed.error : null));
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
          ) : v?.state === "waiting" ? (
            <Badge size="tight" variant="warn" data-testid="invoice-waiting">
              Waiting For Approval
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
              <dl className="mt-1 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm sm:grid-cols-[7.5rem_1fr] sm:gap-x-4">
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
                    <a
                      href={directions(v.billTo) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-start gap-1 hover:text-primary hover:underline"
                      title={toPin(v.billTo) ? "Directions to the map pin" : "Directions"}
                    >
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
            ) : v.blocked ? (
              <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm" data-testid="invoice-blocked">
                {v.blocked}
              </p>
            ) : v.canSave ? (
              <p className="text-xs text-muted-foreground" data-testid="invoice-warehouse-note">
                Add the parts this refurb used. Save for Approval sends them to an Admin, who approves the invoice.
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
                    {/* Warehouse invoices are parts only: no labor or trip charge. */}
                    {v.partsOnly ? null : (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => add({ item: LABOR_ITEM, description: "Service Labor Hour", qty: "1", rate: "150.00", kind: "labor", part: null, sourceKey: null })} data-testid="invoice-add-labor">
                          <Plus className="size-4" />
                          Labor Hour
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => add({ item: TRIP_ITEM, description: "Trip Charge for Service Call", qty: "1", rate: "150.00", kind: "trip", part: null, sourceKey: null })} data-testid="invoice-add-trip">
                          <Plus className="size-4" />
                          Trip Charge
                        </Button>
                      </>
                    )}
                    {usesTicketCharges(type) ? (
                      <AddPmParts
                        jobId={id}
                        draftKeys={draft.flatMap((l) => (l.sourceKey ? [l.sourceKey] : []))}
                        draftCount={draft.length}
                        onAdd={(rows) => {
                          for (const row of rows) {
                            add({
                              item: row.item,
                              description: row.description,
                              qty: String(row.qty),
                              rate: row.rate.toFixed(2),
                              kind: kindForItem(row.item),
                              part: row.part,
                              sourceKey: row.sourceKey,
                            });
                          }
                        }}
                      />
                    ) : null}
                  </div>
                  {tripDraftWarning(draft.filter((l) => l.kind === "trip").length) ? (
                    <p className="text-xs text-warning" data-testid="trip-warning">
                      {tripDraftWarning(draft.filter((l) => l.kind === "trip").length)}
                    </p>
                  ) : null}
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
                        sourceKey: null,
                      })
                    }
                  />
                </div>
              ) : null}
            </section>

            {/* Discount: percent or amount, one value, taken off the lines once. */}
            <section className="rounded-lg border border-border p-3" data-testid="invoice-discount">
              {v.partsOnly ? (
                // Warehouse saves the parts at their prices; an Admin adds any discount when approving.
                <p className="text-xs text-muted-foreground" data-testid="invoice-no-discount">
                  No discount on a warehouse invoice. An Admin can add one when approving.
                </p>
              ) : (
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
              )}
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
                  : v.state === "waiting"
                    ? `Saved for approval by ${v.submittedBy ?? "Warehouse"}${v.submittedAt ? ` on ${when(v.submittedAt)}` : ""}. ${
                        v.canSave ? "An Admin approves it; saving again replaces it." : v.canApprove ? "Approve it as is, or change the lines first." : "An Admin approves it."
                      }`
                    : v.canSave
                      ? "Not saved yet. Cancel saves nothing."
                      : "Not approved yet. Cancel saves nothing."}
                {v.approvedAt && v.submittedBy ? <span className="block">Saved for approval by {v.submittedBy}{v.submittedAt ? ` on ${when(v.submittedAt)}` : ""}.</span> : null}
                {problem && !locked ? <span className="block text-destructive">{problem}</span> : null}
              </p>
              <Button type="button" variant="outline" onClick={onClose} disabled={busy} data-testid="invoice-cancel">
                Cancel
              </Button>
              {locked ? null : v.canSave ? (
                <Button type="button" onClick={() => save.mutate()} disabled={busy || !!problem || !draft.length} data-testid="invoice-save">
                  {save.isPending ? "Saving…" : "Save for Approval"}
                </Button>
              ) : (
                <Button type="button" onClick={() => approve.mutate()} disabled={busy || !!problem || !draft.length} data-testid="invoice-approve">
                  {approve.isPending ? "Approving…" : "Approve"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
