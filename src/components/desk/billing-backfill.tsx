import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileUp, Receipt } from "lucide-react";
import { toast } from "sonner";
import { applyBillingBackfill, previewBillingBackfill, type BackfillFile, type BackfillPreview } from "@/lib/ops/billing-backfill-api";
import { BACKFILL_STATUS_LABEL, type BackfillPlan, type BackfillStatus } from "@/lib/ops/billing-backfill";
import { chargesTotal } from "@/lib/ops/charges";
import { discountLabel } from "@/lib/ops/discount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { ActionButton } from "./desk-charts";
import { OpenLink } from "./open-link";
import { InvoiceStatusBadge } from "./ticket-invoices";
import { ShowMoreButton, useShowMore } from "./show-more";

/*
 * Admin: Billing Backfill (NetSuite), on Tickets → Import (Grok's billing request through Chuy, 10/28). Drop the
 * charges file and/or the invoices file; the preview shows, per ticket, the charges now and from NetSuite, the Sales
 * Order, the invoices and the amount check. Nothing is written until Write; a ticket already invoiced only gets its
 * invoice records. The rules are in billing-backfill.ts.
 */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

const money = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD" }));
const n = (v: number) => v.toLocaleString("en-US");

const STATUS_TONE: Record<BackfillStatus, "success" | "warn" | "outline" | "danger"> = {
  write: "success",
  invoices: "warn",
  same: "outline",
  skip: "danger",
};

type Show = "changes" | "warnings" | "skip" | "same" | "all";

const SHOW_LABEL: Record<Show, string> = {
  changes: "With changes",
  warnings: "With warnings",
  skip: "Skipped",
  same: "No change",
  all: "Every WO",
};

function shown(p: BackfillPlan, show: Show): boolean {
  if (show === "all") return true;
  if (show === "changes") return p.status === "write" || p.status === "invoices";
  if (show === "warnings") return p.warnings.length > 0;
  return p.status === show;
}

export function BillingBackfillButton() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<BackfillFile[]>([]);
  const [preview, setPreview] = useState<BackfillPreview | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [show, setShow] = useState<Show>("changes");

  const read = useMutation({
    mutationFn: async (list: File[]) => {
      const picked = await Promise.all(list.slice(0, 2).map(async (f) => ({ name: f.name, base64: await fileToBase64(f) })));
      return { picked, p: await previewBillingBackfill({ data: { files: picked } }) };
    },
    onSuccess: ({ picked, p }) => {
      setFiles(picked);
      setPreview(p);
      setSkip(new Set());
      setShow(p.counts.write + p.counts.invoices ? "changes" : "all");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the files"),
  });
  const write = useMutation({
    mutationFn: () => applyBillingBackfill({ data: { files, hash: preview!.hash, skip: [...skip] } }),
    onSuccess: (r) => {
      const a = r.applied ?? { tickets: 0, lines: 0, invoices: 0 };
      toast.success(`Billing Backfill saved: ${n(a.tickets)} ticket${a.tickets === 1 ? "" : "s"}, ${n(a.lines)} charge line${a.lines === 1 ? "" : "s"}, ${n(a.invoices)} invoice${a.invoices === 1 ? "" : "s"}`);
      setPreview(r);
      setSkip(new Set());
      setShow("all");
      for (const key of ["jobs", "job", "charges", "ticket-billing", "billing-invoices", "tickets-window", "invoice", "activity", "parts-profit"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const plans = useMemo(() => preview?.plans ?? [], [preview]);
  const list = useMemo(() => plans.filter((p) => shown(p, show)), [plans, show]);
  const paged = useShowMore(list, `${preview?.hash}:${show}`, 60);
  const writable = plans.filter((p) => (p.status === "write" || p.status === "invoices") && !skip.has(p.key));

  function close() {
    setOpen(false);
    setPreview(null);
    setFiles([]);
    setSkip(new Set());
  }

  return (
    <>
      <ActionButton icon={Receipt} menuLabel="Billing Backfill (NetSuite)" onClick={() => setOpen(true)} data-testid="backfill-open">
        Billing Backfill (NetSuite)
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto" data-testid="backfill">
          <DialogTitle>Billing Backfill (NetSuite)</DialogTitle>
          <DialogDescription>
            Drop NetSuite&apos;s charges file, invoices file, or both (CSV or Excel), keyed by WO. A ticket not invoiced yet gets its charges
            (credits netted, the discount as NetSuite&apos;s header discount), then its Sales Order and billed date, then its invoices. A ticket
            already invoiced only gets its invoice records: number, status, total and amount remaining. Merged tickets and Walk-In are skipped.
          </DialogDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={read.isPending || write.isPending} onClick={() => input.current?.click()}>
              <FileUp className="size-4" />
              {read.isPending ? "Reading…" : preview ? "Pick Other Files" : "Pick One Or Two Files"}
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              accept=".csv,text/csv,.xlsx,.xls"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="backfill-file"
              onChange={(e) => {
                const list = [...(e.target.files ?? [])];
                e.target.value = "";
                if (list.length > 2) toast.error("Pick at most two files: charges and invoices.");
                if (list.length) read.mutate(list);
              }}
            />
            {preview ? (
              <span className="text-xs text-muted-foreground" data-testid="backfill-sheets">
                {preview.sheets.map((s) => `${s.file}: ${s.kind}, ${n(s.rows)} rows`).join(" · ")}
                {preview.ignored.length ? ` · not read (no WO column): ${preview.ignored.join(", ")}` : ""}
                {preview.skippedRows ? ` · ${n(preview.skippedRows)} rows without a WO` : ""}
              </span>
            ) : null}
          </div>

          {preview ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5 text-sm" data-testid="backfill-counts">
                <Badge variant="success">Will write {n(preview.counts.write)}</Badge>
                <Badge variant="warn">Invoices only (locked) {n(preview.counts.invoices)}</Badge>
                <Badge variant="outline">No change {n(preview.counts.same)}</Badge>
                {preview.counts.skip ? <Badge variant="danger">Skipped {n(preview.counts.skip)}</Badge> : null}
                {preview.counts.doubleBill ? <Badge variant="danger">Possible double bills {n(preview.counts.doubleBill)}</Badge> : null}
                {preview.counts.nsMismatch ? <Badge variant="warn">NetSuite ≠ charges {n(preview.counts.nsMismatch)}</Badge> : null}
                {preview.counts.corrigoMismatch ? <Badge variant="warn">Corrigo ≠ NetSuite {n(preview.counts.corrigoMismatch)}</Badge> : null}
                {preview.applied ? (
                  <Badge variant="ink" data-testid="backfill-applied">
                    Saved: {n(preview.applied.tickets)} tickets · {n(preview.applied.lines)} lines · {n(preview.applied.invoices)} invoices
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SelectField value={show} onChange={(e) => setShow(e.target.value as Show)} className="h-9 w-48" aria-label="Show" data-testid="backfill-show">
                  {(Object.keys(SHOW_LABEL) as Show[]).map((s) => (
                    <option key={s} value={s}>
                      {SHOW_LABEL[s]}
                    </option>
                  ))}
                </SelectField>
                <span className="text-xs text-muted-foreground">
                  {n(list.length)} of {n(plans.length)} WOs. Untick a ticket to leave it out.
                </span>
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[60rem] text-left text-sm" data-testid="backfill-table">
                  <thead className="bg-card text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="w-8 px-2 py-2" />
                      <th className="px-3 py-2">WO · Ticket</th>
                      <th className="px-3 py-2">Charges (after discount)</th>
                      <th className="px-3 py-2">Sales Order</th>
                      <th className="px-3 py-2">Invoices</th>
                      <th className="px-3 py-2">Amount check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.visible.map((p) => (
                      <PlanRow
                        key={p.key}
                        p={p}
                        on={!skip.has(p.key)}
                        disabled={write.isPending || !!preview.applied}
                        onToggle={(on) =>
                          setSkip((cur) => {
                            const next = new Set(cur);
                            if (on) next.delete(p.key);
                            else next.add(p.key);
                            return next;
                          })
                        }
                      />
                    ))}
                    {!list.length ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                          Nothing in this view.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <ShowMoreButton remaining={paged.remaining} onClick={paged.showMore} label="WOs" />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                <span className="mr-auto text-xs text-muted-foreground">
                  Nothing is written until you press Write. Everything is written in one go, or nothing is.
                </span>
                <Button type="button" variant="outline" disabled={write.isPending} onClick={close} data-testid="backfill-cancel">
                  {preview.applied ? "Close" : "Cancel"}
                </Button>
                {preview.applied ? null : (
                  <Button type="button" disabled={write.isPending || !writable.length} onClick={() => write.mutate()} data-testid="backfill-write">
                    {write.isPending ? "Writing…" : `Write ${n(writable.length)} Ticket${writable.length === 1 ? "" : "s"}`}
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function linesText(lines: { qty: number; rate: number }[] | null, net: number | null) {
  if (!lines) return "—";
  return `${lines.length} line${lines.length === 1 ? "" : "s"} · ${money(net)}`;
}

function PlanRow({ p, on, disabled, onToggle }: { p: BackfillPlan; on: boolean; disabled: boolean; onToggle: (on: boolean) => void }) {
  const [more, setMore] = useState(false);
  const can = p.status === "write" || p.status === "invoices";
  return (
    <>
      <tr className={cn("border-t border-border align-top", p.status === "skip" && "bg-destructive/5", p.amounts.doubleBill && "bg-destructive/10")} data-testid="backfill-row">
        <td className="px-2 py-2">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={can && on}
            disabled={!can || disabled}
            aria-label={`Write ${p.wo}`}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </td>
        <td className="px-3 py-2">
          <span className="font-medium whitespace-nowrap">{p.wo}</span>
          <Badge size="tight" variant={STATUS_TONE[p.status]} className="ml-1.5" data-testid="backfill-status">
            {BACKFILL_STATUS_LABEL[p.status]}
          </Badge>
          {p.jobId ? (
            <OpenLink entityType={p.kind ?? "service"} id={p.jobId} className="mt-0.5 block text-xs text-primary underline-offset-2 hover:underline">
              #{p.jobId} · {p.customer || "no account"}
            </OpenLink>
          ) : null}
          {p.reason ? <span className="mt-0.5 block max-w-xs text-xs text-destructive">{p.reason}</span> : null}
        </td>
        <td className="px-3 py-2 text-xs">
          {p.status === "skip" ? (
            "—"
          ) : (
            <>
              <span className="block">Now: {linesText(p.charges.current, p.charges.currentNet)}</span>
              {p.charges.next ? (
                <span className={cn("block", p.charges.change ? "font-medium text-foreground" : "text-muted-foreground")}>
                  NetSuite: {linesText(p.charges.next, p.charges.nextNet)}
                  {p.charges.nextDiscount ? ` · ${discountLabel(p.charges.nextDiscount)}` : ""}
                  {p.charges.change ? "" : " (same)"}
                </span>
              ) : p.locked ? (
                <span className="block text-muted-foreground">Kept (locked)</span>
              ) : null}
              {p.charges.next || p.charges.current.length ? (
                <button type="button" className="mt-0.5 inline-flex items-center gap-0.5 text-primary" onClick={() => setMore((v) => !v)}>
                  Lines <ChevronDown className={cn("size-3 transition-transform", more && "rotate-180")} />
                </button>
              ) : null}
            </>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {p.status === "skip" ? (
            "—"
          ) : p.so.change ? (
            <span className="font-medium">
              {p.so.current || "none"} → {p.so.next}
              {p.so.billedOn ? <span className="block font-normal whitespace-nowrap text-muted-foreground">billed {p.so.billedOn}</span> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">{p.so.current || "none"}</span>
          )}
          {p.so.note ? <span className="mt-0.5 block text-muted-foreground">{p.so.note}</span> : null}
        </td>
        <td className="px-3 py-2 text-xs">
          <ul className="space-y-1">
            {p.invoices.map((i) => (
              <li key={i.invoice} className="flex flex-wrap items-center gap-1">
                <span className="font-medium">{i.invoice}</span>
                <InvoiceStatusBadge status={i.status} />
                <span className="tabular">{money(i.total)}</span>
                <span className={cn("text-[11px]", i.change === "same" ? "text-muted-foreground" : "font-medium text-primary")}>
                  {i.change === "new" ? "new" : i.change === "updated" ? `was ${i.before?.status}${i.before?.remaining !== i.remaining ? `, ${money(i.before?.remaining)} left` : ""}` : "same"}
                </span>
              </li>
            ))}
            {!p.invoices.length ? <li className="text-muted-foreground">—</li> : null}
          </ul>
        </td>
        <td className="px-3 py-2 text-xs">
          {p.status === "skip" ? null : (
            <span className="block tabular">
              KD {money(p.amounts.kd)} · NS {money(p.amounts.netsuite)}
              {p.amounts.corrigo != null ? ` · Corrigo ${money(p.amounts.corrigo)}` : ""}
            </span>
          )}
          {p.amounts.doubleBill ? <Badge variant="danger" className="mt-1">Possible double bill</Badge> : null}
          {p.warnings.filter((w) => !/^Possible double bill/.test(w)).map((w) => (
            <span key={w} className="mt-0.5 block max-w-xs text-warning">
              {w}
            </span>
          ))}
        </td>
      </tr>
      {more ? (
        <tr className="border-t border-dashed border-border bg-muted/30">
          <td />
          <td colSpan={5} className="px-3 py-2">
            <div className="grid gap-3 text-xs md:grid-cols-2">
              <LineList title="On the ticket now" lines={p.charges.current} />
              {p.charges.next ? <LineList title="From NetSuite" lines={p.charges.next} /> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function LineList({ title, lines }: { title: string; lines: { item: string; description: string; qty: number; rate: number }[] }) {
  return (
    <div>
      <p className="font-medium text-muted-foreground">
        {title} · {money(chargesTotal(lines))} before discount
      </p>
      <ul className="mt-1 space-y-0.5">
        {lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              {l.item}
              {l.description ? <span className="text-muted-foreground"> · {l.description}</span> : null}
            </span>
            <span className="shrink-0 tabular">
              {l.qty} × {money(l.rate)}
            </span>
          </li>
        ))}
        {!lines.length ? <li className="text-muted-foreground">No lines</li> : null}
      </ul>
    </div>
  );
}
