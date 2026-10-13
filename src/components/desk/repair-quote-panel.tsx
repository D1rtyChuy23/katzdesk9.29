import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getRepairQuote, saveRepairQuote, type RepairQuote } from "@/lib/ops/repair-quote-api";
import { QUOTE_STATUSES, isLaborKind, lineKind, money, quoteLocked, quoteTotals, type QuoteStatus } from "@/lib/ops/repair-quote";
import { LABOR_ITEM, lineAmount, type PartRef } from "@/lib/ops/charges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { PartPicker } from "./charges-panel";
import { OpenLink } from "./open-link";
import { PartThumb } from "./part-thumb";

type DraftLine = { item: string; description: string; qty: string; rate: string; part: PartRef | null };

const toDraft = (l: RepairQuote["lines"][number]): DraftLine => ({ item: l.item, description: l.description, qty: String(l.qty), rate: l.rate.toFixed(2), part: l.part });

const statusTone = (s: QuoteStatus) => (s === "Approved" ? "success" : s === "Declined" ? "danger" : s === "Sent" ? "warn" : "outline");

/**
 * Repair Quote on a service ticket or a rebuild project: parts and labor, a total and a status. A rebuild linked
 * to a ticket shows that ticket's quote, so the two never keep separate cost sheets.
 */
export function RepairQuotePanel({ jobId, rebuildId }: { jobId?: number; rebuildId?: number }) {
  const qc = useQueryClient();
  const target = { jobId: jobId ?? null, rebuildId: rebuildId ?? null };
  const key = ["repair-quote", jobId != null ? `job-${jobId}` : `rebuild-${rebuildId}`];
  const quote = useQuery({ queryKey: key, queryFn: () => getRepairQuote({ data: target }) });
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [status, setStatus] = useState<QuoteStatus>("Draft");
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);

  const q = quote.data;
  useEffect(() => {
    if (!q) return;
    setLines(q.lines.map(toDraft));
    setStatus(q.status);
    setNote(q.note);
    setDirty(false);
    if (q.id != null) setOpen(true);
  }, [q]);

  const save = useMutation({
    mutationFn: () => saveRepairQuote({ data: { ...target, status, note, lines } }),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      // The same quote may be open on the linked ticket or rebuild, and the rebuild row shows its total.
      void qc.invalidateQueries({ queryKey: ["repair-quote"] });
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Repair quote saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!q) return null;
  const exists = q.id != null;
  // Lines follow the saved status: an Approved or Declined quote is changed by setting it back first.
  const locked = exists && quoteLocked(q.status);
  const totals = quoteTotals(lines.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, kind: lineKind(l.item) })));
  const edit = (i: number, patch: Partial<DraftLine>) => {
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const add = (l: DraftLine) => {
    setLines((cur) => [...cur, l]);
    setDirty(true);
  };
  const uid = jobId != null ? `job-${jobId}` : `rebuild-${rebuildId}`;

  if (!open) {
    return (
      <section className="flex flex-wrap items-center gap-2 border-b border-border p-5" data-testid="repair-quote" data-state="none">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Repair Quote</h3>
        <span className="text-sm text-muted-foreground">None yet.</span>
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setOpen(true)} data-testid="repair-quote-add">
          <ClipboardList className="size-4" />
          Add Repair Quote
        </Button>
      </section>
    );
  }

  return (
    <section className="border-b border-border p-5" data-testid="repair-quote" data-state={exists ? "saved" : "new"}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Repair Quote</h3>
        <Badge size="tight" variant={statusTone(exists ? q.status : status)} data-testid="repair-quote-status-badge">
          {exists ? q.status : "Not saved"}
        </Badge>
        <span className="ml-auto text-sm font-medium tabular" data-testid="repair-quote-total">
          {money(totals.total)}
        </span>
      </div>
      {q.shared ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="repair-quote-shared">
          {q.shared.kind === "rebuild" ? "Same quote as the rebuild project " : "Same quote as ticket "}
          <OpenLink entityType={q.shared.kind === "rebuild" ? "rebuild" : "service"} id={q.shared.id} className="font-medium text-copper hover:underline">
            {q.shared.label}
          </OpenLink>
          . One sheet for both.
        </p>
      ) : null}

      {lines.length ? (
        <ul className="mt-3 space-y-2">
          {lines.map((l, i) => {
            const labor = isLaborKind(lineKind(l.item));
            return (
              <li key={i} className="rounded-lg border border-border p-2" data-testid="quote-line" data-kind={labor ? "labor" : "part"}>
                <div className="flex items-start gap-2">
                  {l.part && !labor ? <PartThumb part={l.part} name={l.item} size="md" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      <span className="truncate">{l.item}</span>
                      <span className="shrink-0 text-[10px] font-semibold tracking-[0.1em] text-copper uppercase">{labor ? "Labor" : "Part"}</span>
                    </p>
                    <Input aria-label="Description" value={l.description} disabled={locked} onChange={(e) => edit(i, { description: e.target.value })} className="mt-1 h-8 text-xs" />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${l.item}`}
                    disabled={locked}
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
                    <Input inputMode="decimal" value={l.qty} disabled={locked} onChange={(e) => edit(i, { qty: e.target.value })} className="mt-0.5 h-8" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Rate</Label>
                    <Input inputMode="decimal" value={l.rate} disabled={locked} onChange={(e) => edit(i, { rate: e.target.value })} className="mt-0.5 h-8" />
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
        <p className="mt-3 text-sm text-muted-foreground">No lines yet. Add the parts and the labor this repair needs.</p>
      )}

      {locked ? (
        <p className="mt-3 text-xs text-muted-foreground" data-testid="repair-quote-locked">
          This quote is {q.status}. Set the status back to Draft or Sent and save to change a line.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <Button type="button" size="sm" variant="outline" onClick={() => add({ item: LABOR_ITEM, description: "Service Labor Hour", qty: "1", rate: "150.00", part: null })} data-testid="quote-add-labor">
            <Plus className="size-4" />
            Labor Hour
          </Button>
          <PartPicker
            id={`quote-part-${uid}`}
            onPick={(it) => add({ item: it.item, description: it.description ?? "", qty: "1", rate: it.rate != null ? it.rate.toFixed(2) : "0.00", part: it.part ?? null })}
          />
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm" data-testid="repair-quote-totals">
        <div>
          <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Parts</dt>
          <dd className="tabular font-medium" data-testid="quote-parts">{money(totals.parts)}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Labor</dt>
          <dd className="tabular font-medium" data-testid="quote-labor">{money(totals.labor)}</dd>
        </div>
        <div>
          <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Total</dt>
          <dd className="tabular font-medium" data-testid="quote-total">{money(totals.total)}</dd>
        </div>
      </dl>

      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <Label htmlFor={`quote-status-${uid}`}>Status</Label>
          <SelectField
            id={`quote-status-${uid}`}
            className="mt-1"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as QuoteStatus);
              setDirty(true);
            }}
            data-testid="repair-quote-status"
          >
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </div>
        <div>
          <Label htmlFor={`quote-note-${uid}`}>Note</Label>
          <Textarea
            id={`quote-note-${uid}`}
            className="mt-1 min-h-10"
            value={note}
            maxLength={2000}
            placeholder="What the quote covers, or who approved it…"
            onChange={(e) => {
              setNote(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {q.updatedBy && q.updatedAt ? (
          <span className="mr-auto text-xs text-muted-foreground">
            Saved by {q.updatedBy} · {new Date(q.updatedAt).toLocaleDateString()}
          </span>
        ) : null}
        {!exists ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={save.isPending || (!dirty && exists)} onClick={() => save.mutate()} data-testid="repair-quote-save">
          {save.isPending ? "Saving…" : "Save Quote"}
        </Button>
      </div>
    </section>
  );
}
