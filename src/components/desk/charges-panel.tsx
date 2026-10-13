import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getTicketCharges, saveTicketCharges, searchBillingItems, setTicketSalesOrder, type TicketCharges } from "@/lib/ops/charges-api";
import {
  BILLING_LABEL,
  LABOR_ITEM,
  TRIP_ITEM,
  chargesTotal,
  kindForItem,
  lineAmount,
  type BillingItem,
  type ChargeLine,
  type PartRef,
} from "@/lib/ops/charges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PartThumb } from "./part-thumb";
import { applyDiscount, cleanDiscount, discountLabel, type DiscountKind } from "@/lib/ops/discount";
import { cn } from "@/lib/utils";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

type DraftLine = { item: string; description: string; qty: string; rate: string; part: PartRef | null };

function toDraft(l: ChargeLine & { part: PartRef | null }): DraftLine {
  return { item: l.item, description: l.description, qty: String(l.qty), rate: l.rate.toFixed(2), part: l.part };
}

/** Trip and labor are services: no photo slot. Parts and equipment get one. */
const isPhysical = (item: string) => {
  const k = kindForItem(item);
  return k !== "trip" && k !== "labor";
};

function draftLines(lines: DraftLine[]): ChargeLine[] {
  return lines.map((l) => ({
    item: l.item,
    description: l.description,
    qty: Number(l.qty) || 0,
    rate: Number(l.rate) || 0,
    kind: kindForItem(l.item),
  }));
}

/**
 * Charges on a ticket: trip, labor and parts, priced from the NetSuite item list. The Sales Order itself is made in
 * NetSuite by the billing script; the number comes back here so the ticket shows Billed.
 */
export function ChargesPanel({ jobId }: { jobId: number }) {
  const qc = useQueryClient();
  const charges = useQuery({ queryKey: ["charges", jobId], queryFn: () => getTicketCharges({ data: { jobId } }) });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [po, setPo] = useState("");
  const [so, setSo] = useState("");
  const [dirty, setDirty] = useState(false);
  const [discKind, setDiscKind] = useState<DiscountKind>("percent");
  const [discValue, setDiscValue] = useState("");

  const c = charges.data;
  useEffect(() => {
    if (!c || c.jobId !== jobId) return;
    setLines(c.lines.map(toDraft));
    setPo(c.po);
    setSo(c.nsSo ?? "");
    setDiscKind(c.discount?.kind ?? "percent");
    setDiscValue(c.discount ? String(c.discount.value) : "");
    setDirty(false);
  }, [c, jobId]);

  const after = (next: TicketCharges, message: string) => {
    qc.setQueryData(["charges", jobId], next);
    void qc.invalidateQueries({ queryKey: ["activity"] });
    void qc.invalidateQueries({ queryKey: ["jobs"] });
    toast.success(message);
  };
  const save = useMutation({
    mutationFn: () => saveTicketCharges({ data: { jobId, po, lines, discount: discValue.trim() ? { kind: discKind, value: discValue } : null } }),
    onSuccess: (next) => after(next, "Charges saved"),
    onError: (e: Error) => toast.error(e.message),
  });
  const bill = useMutation({
    mutationFn: (nsSo: string | null) => setTicketSalesOrder({ data: { jobId, nsSo } }),
    onSuccess: (next) => after(next, next.nsSo ? "Marked billed" : "Sales Order cleared"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!c) return null;
  const billed = c.state === "billed";
  // The discount is always worked out from the lines, never from a total that already has it taken off.
  const typedDiscount = cleanDiscount(discKind, discValue);
  const discount = "error" in typedDiscount ? null : typedDiscount.discount;
  const totals = applyDiscount(chargesTotal(draftLines(lines)), discount);
  const total = totals.total;
  const edit = (i: number, patch: Partial<DraftLine>) => {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const add = (l: DraftLine) => {
    setLines((cur) => [...cur, l]);
    setDirty(true);
  };

  return (
    <section className="border-b border-border p-5" data-testid="charges-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Charges</h3>
        <Badge size="tight" variant={billed ? "success" : c.state === "ready" ? "warn" : "outline"} data-testid="billing-state">
          {BILLING_LABEL[c.state]}
          {billed && c.nsSo ? ` · ${c.nsSo}` : ""}
        </Badge>
        <span className="ml-auto text-sm font-medium tabular" data-testid="charges-header-total">
          {totals.off ? <span className="mr-1.5 text-xs font-normal text-muted-foreground line-through">{money(totals.subtotal)}</span> : null}
          {money(total)}
        </span>
      </div>

      {lines.length ? (
        <ul className="mt-3 space-y-2">
          {lines.map((l, i) => (
            <li key={i} className="rounded-lg border border-border p-2" data-testid="charge-line">
              <div className="flex items-start gap-2">
                {l.part && isPhysical(l.item) ? <PartThumb part={l.part} name={l.item} size="md" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.item}</p>
                  {l.part && isPhysical(l.item) ? (
                    <p className="text-xs text-muted-foreground" data-testid="charge-mpn">
                      MPN {l.part.mpn ? <span className="font-medium text-foreground">{l.part.mpn}</span> : "not set"}
                    </p>
                  ) : null}
                  <Input
                    aria-label="Description"
                    value={l.description}
                    disabled={billed}
                    onChange={(e) => edit(i, { description: e.target.value })}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${l.item}`}
                  disabled={billed}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                  onClick={() => {
                    setLines((cur) => cur.filter((_, idx) => idx !== i));
                    setDirty(true);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px]">Qty</Label>
                  <Input
                    inputMode="decimal"
                    value={l.qty}
                    disabled={billed}
                    onChange={(e) => edit(i, { qty: e.target.value })}
                    className="mt-0.5 h-8"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Rate</Label>
                  <Input
                    inputMode="decimal"
                    value={l.rate}
                    disabled={billed}
                    onChange={(e) => edit(i, { rate: e.target.value })}
                    className="mt-0.5 h-8"
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Amount</Label>
                  <p className="mt-0.5 flex h-8 items-center text-sm tabular">
                    {money(lineAmount({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0 }))}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing on this ticket yet. Add the trip, labor and parts used.</p>
      )}

      {!billed ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => add({ item: TRIP_ITEM, description: "Trip Charge for Service Call", qty: "1", rate: "150.00", part: null })}>
              <Plus className="size-4" />
              Trip Charge
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => add({ item: LABOR_ITEM, description: "Service Labor Hour", qty: "1", rate: "150.00", part: null })}>
              <Plus className="size-4" />
              Labor Hour
            </Button>
          </div>
          <PartPicker
            onPick={(it) =>
              add({ item: it.item, description: it.description ?? "", qty: "1", rate: it.rate != null ? it.rate.toFixed(2) : "0.00", part: it.part ?? null })
            }
          />
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-border p-3" data-testid="charges-discount">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Discount</p>
            <div className="mt-1 flex gap-1.5" role="group" aria-label="Discount type">
              {(["percent", "amount"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={billed}
                  aria-pressed={discKind === k}
                  data-testid={`discount-${k}`}
                  onClick={() => {
                    setDiscKind(k);
                    setDirty(true);
                  }}
                  className={cn("h-9 rounded-full px-3 text-sm font-medium disabled:opacity-60", discKind === k ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground")}
                >
                  {k === "percent" ? "Percent" : "Amount"}
                </button>
              ))}
            </div>
          </div>
          <div className="w-32">
            <Label htmlFor={`charge-discount-${jobId}`}>{discKind === "percent" ? "Percent (%)" : "Amount ($)"}</Label>
            <Input
              id={`charge-discount-${jobId}`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="None"
              value={discValue}
              disabled={billed}
              onChange={(e) => {
                setDiscValue(e.target.value);
                setDirty(true);
              }}
              className="mt-1"
              data-testid="discount-value"
            />
          </div>
          {"error" in typedDiscount ? <p className="pb-2 text-xs text-destructive">{typedDiscount.error}</p> : null}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm" data-testid="charges-totals">
          <div>
            <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Original Total</dt>
            <dd className="tabular font-medium" data-testid="charges-subtotal">{money(totals.subtotal)}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Discount{discount ? ` · ${discountLabel(discount)}` : ""}</dt>
            <dd className="tabular font-medium" data-testid="charges-off">{totals.off ? `−${money(totals.off)}` : money(0)}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">New Total</dt>
            <dd className="tabular font-semibold" data-testid="charges-total">{money(totals.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="charge-po">P.O. #</Label>
          <Input
            id="charge-po"
            value={po}
            disabled={billed}
            autoComplete="off"
            onChange={(e) => {
              setPo(e.target.value);
              setDirty(true);
            }}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="charge-so">NetSuite Sales Order</Label>
          <div className="mt-1 flex gap-2">
            <Input id="charge-so" value={so} placeholder="SO4345" autoComplete="off" onChange={(e) => setSo(e.target.value)} />
            <Button type="button" size="sm" variant="outline" disabled={bill.isPending || so.trim() === (c.nsSo ?? "")} onClick={() => bill.mutate(so.trim() || null)}>
              {so.trim() ? "Mark Billed" : "Clear"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {!lines.length && !billed ? <span className="mr-auto text-xs text-muted-foreground">A finished ticket with no charges is flagged for review.</span> : null}
        <Button type="button" size="sm" disabled={billed || !dirty || save.isPending || "error" in typedDiscount} onClick={() => save.mutate()} data-testid="charges-save">
          {save.isPending ? "Saving…" : "Save Charges"}
        </Button>
      </div>
    </section>
  );
}

/** Type a NetSuite item name, a manufacturer number or words from the description; pick one result. */
export function PartPicker({ onPick, id = "part-search" }: { onPick: (item: BillingItem) => void; id?: string }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const results = useQuery({
    queryKey: ["billing-items", term],
    queryFn: () => searchBillingItems({ data: { q: term } }),
    enabled: term.length >= 2,
  });
  const list = results.data ?? [];
  return (
    <div>
      <Label htmlFor={id}>Add a part</Label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={q}
          autoComplete="off"
          placeholder="Part number or words…"
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>
      {term.length >= 2 ? (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-border" data-testid="part-results">
          {list.map((it) => (
            <li key={it.item} className="flex items-start gap-2 px-2 py-1.5 hover:bg-muted">
              {/* The photo enlarges on its own; choosing the part is the rest of the row. */}
              <PartThumb part={it.part} name={it.item} size="sm" />
              <button
                type="button"
                className="flex min-h-12 min-w-0 flex-1 items-start justify-between gap-3 py-1 text-left text-sm"
                onClick={() => {
                  onPick(it);
                  setQ("");
                  setTerm("");
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{it.item}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    MPN {it.mfrPart ? it.mfrPart : "not set"}
                  </span>
                  {it.description ? <span className="block truncate text-xs text-muted-foreground">{it.description}</span> : null}
                </span>
                <span className="shrink-0 tabular text-xs text-muted-foreground">{it.rate != null ? money(it.rate) : ""}</span>
              </button>
            </li>
          ))}
          {!list.length ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {results.isFetching ? "Searching…" : "No item matches. Import the NetSuite item list if this part is new."}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
