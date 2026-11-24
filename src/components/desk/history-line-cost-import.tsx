import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, FileUp } from "lucide-react";
import { toast } from "sonner";
import {
  finishWoHistoryRun,
  listWoHistoryRuns,
  previewHistoryLineCosts,
  saveHistoryCostBatch,
  startHistoryCostRun,
  undoWoHistoryRun,
  type CostSaveRow,
} from "@/lib/ops/wo-history-api";
import {
  COST_BASIS_LABEL,
  HISTORY_COST_NOTE,
  LINE_COST_STATUSES,
  LINE_COST_STATUS_LABEL,
  countLineCostPlan,
  lineCostBatches,
  lineCostSaveable,
  lineCostStartsTicked,
  readHistoryLineCosts,
  type LineCostPlanLine,
  type LineCostRead,
  type LineCostStatus,
} from "@/lib/ops/wo-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ActionButton, FilterChip } from "./desk-charts";
import { ShowMoreButton, useShowMore } from "./show-more";
import { Runs } from "./wo-history-import";

const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
const money = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD" }));
const unitMoney = (v: number | null | undefined) => (v == null ? "—" : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`);
const keyOf = (p: LineCostPlanLine) => `${p.row.ref.toLowerCase()}#${p.row.sort}`;
const VARIANT: Record<LineCostStatus, "success" | "primary" | "outline" | "danger" | "warn"> = {
  fill: "success",
  same: "outline",
  different: "warn",
  mismatch: "danger",
  noHistory: "outline",
  removed: "warn",
};
const PREVIEW_ROWS = 2000;
const SAVE_ROWS = 1000;

type Step = "file" | "preview" | "saving" | "done";

/**
 * Admin-only: Tickets → Import → Update History Line Costs (Jesus, 11/24). QuickBooks purchase cost on saved Work
 * Order History lines, from one CSV keyed by History Ref + Line Sort. Only blank cost is filled; a line that has a
 * cost, or doesn't match the file at that sort, is never written. A run can be undone from Past imports.
 */
export function HistoryLineCostImportButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("file");
  const [file, setFile] = useState<File | null>(null);
  const [read, setRead] = useState<LineCostRead | null>(null);
  const [plan, setPlan] = useState<LineCostPlanLine[] | null>(null);
  const [group, setGroup] = useState<LineCostStatus>("fill");
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<{ filled: number; skipped: number; stopped: string | null } | null>(null);
  const runs = useQuery({ queryKey: ["wo-history-runs"], queryFn: () => listWoHistoryRuns(), enabled: open });
  const pick = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "saving") return;
    const stay = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [step]);

  function reset() {
    setStep("file");
    setFile(null);
    setRead(null);
    setPlan(null);
    setReport(null);
    setProgress(null);
  }

  const preview = useMutation({
    mutationFn: async (f: File) => {
      const r = readHistoryLineCosts(await f.text());
      setRead(r);
      if (r.problems.length) return null;
      const out: LineCostPlanLine[] = [];
      for (let i = 0; i < r.rows.length; i += PREVIEW_ROWS) {
        setProgress(`Checking rows ${n(i + 1)}–${n(Math.min(i + PREVIEW_ROWS, r.rows.length))} of ${n(r.rows.length)}…`);
        out.push(...(await previewHistoryLineCosts({ data: { rows: r.rows.slice(i, i + PREVIEW_ROWS) } })));
      }
      return out;
    },
    onSuccess: (p) => {
      if (!p) return;
      setPlan(p);
      setTicks(new Set(p.filter((l) => lineCostStartsTicked(l.status)).map(keyOf)));
      setGroup(LINE_COST_STATUSES.find((s) => p.some((l) => l.status === s)) ?? "fill");
      setStep("preview");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the file"),
    onSettled: () => setProgress(null),
  });

  const counts = useMemo(() => (plan ? countLineCostPlan(plan) : null), [plan]);
  const groupLines = useMemo(() => (plan ?? []).filter((l) => l.status === group), [plan, group]);
  const paged = useShowMore(groupLines, `${group}|${plan?.length}`, 100);
  const ticked = useMemo(() => (plan ?? []).filter((l) => lineCostSaveable(l.status) && l.lineId != null && ticks.has(keyOf(l))), [plan, ticks]);
  const tickSet = (keys: string[], on: boolean) =>
    setTicks((prev) => {
      const next = new Set(prev);
      for (const k of keys) if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  const save = useMutation({
    mutationFn: async () => {
      const rows: CostSaveRow[] = ticked.map((l) => ({
        lineId: l.lineId!,
        sort: l.row.sort,
        lineType: l.row.lineType,
        itemCode: l.row.itemCode,
        qty: l.row.qty,
        amount: l.row.amount,
        unitCost: l.row.unitCost,
        lineCost: l.row.lineCost,
        costBasis: l.row.costBasis,
        costDate: l.row.costDate,
        costSource: l.row.costSource,
        costFlag: l.row.costFlag,
      }));
      const { runId } = await startHistoryCostRun({ data: { filename: file?.name ?? "line costs", rowCount: read?.rows.length ?? 0, counts: countLineCostPlan(plan ?? []) } });
      setStep("saving");
      const rep = { filled: 0, skipped: 0, stopped: null as string | null };
      const batches = lineCostBatches(rows, SAVE_ROWS);
      for (let i = 0; i < batches.length; i++) {
        setProgress(`Saving batch ${i + 1} of ${batches.length}…`);
        try {
          const r = await saveHistoryCostBatch({ data: { runId, rows: batches[i]! } });
          rep.filled += r.filled;
          rep.skipped += r.skipped;
        } catch (e) {
          rep.stopped = `Batch ${i + 1} of ${batches.length} didn't save, and the import stopped: ${e instanceof Error ? e.message : "unknown error"} Batches before it are saved. Loading the same file again skips them.`;
          break;
        }
      }
      await finishWoHistoryRun({ data: { runId } }).catch(() => undefined);
      return rep;
    },
    onSuccess: (rep) => {
      setReport(rep);
      setStep("done");
      if (rep.stopped) toast.error("The import stopped. See the report.");
      else toast.success(`Cost filled on ${plural(rep.filled, "line")}${rep.skipped ? ` · ${n(rep.skipped)} skipped (changed since the preview)` : ""}`);
    },
    onError: (e) => {
      setStep("preview");
      toast.error(e instanceof Error ? e.message : "Could not start the save");
    },
    onSettled: () => {
      setProgress(null);
      for (const key of ["wo-history-runs", "wo-history-account", "wo-history-job", "wo-history", "profit-report"]) void qc.invalidateQueries({ queryKey: [key] });
    },
  });

  const undo = useMutation({
    mutationFn: (runId: number) => undoWoHistoryRun({ data: { runId } }),
    onSuccess: (r) => {
      if (r.kind === "line_costs") {
        toast.success(`Undone: cost cleared on ${plural(r.cleared, "line")}`);
        if (r.kept) toast.warning(`${plural(r.kept, "line")} kept their cost, because it changed since that run.`);
      } else toast.success("Undone.");
      for (const key of ["wo-history-runs", "wo-history-account", "wo-history-job", "wo-history", "profit-report"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not undo"),
  });

  const busy = preview.isPending || save.isPending || undo.isPending;
  const costRuns = (runs.data ?? []).filter((r) => r.kind === "line_costs");

  function onSave() {
    const removed = ticked.filter((l) => l.status === "removed").length;
    const msg = `Fill the QuickBooks cost on ${plural(ticked.length, "history line")}${removed ? ` (${n(removed)} on removed accounts)` : ""}? Only lines with no cost are written; nothing is overwritten. It saves in batches; keep this page open until it's done.`;
    if (window.confirm(msg)) save.mutate();
  }

  return (
    <>
      <ActionButton icon={Coins} menuLabel="History Line Costs" onClick={() => setOpen(true)} data-testid="history-costs-open">
        Update History Line Costs
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && step === "saving") return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl" data-testid="history-costs-import">
          <div className="space-y-3">
            <DialogTitle>Update History Line Costs</DialogTitle>
            <p className="text-sm text-muted-foreground">
              QuickBooks purchase cost on the part and filter lines of saved Work Order History, from one CSV. Each row is matched by History Ref and Line
              Sort, then checked: the saved line at that sort must have the same line type, item, qty and amount, or it's a Mismatch and isn't written. Only
              lines with no cost are filled; a line that already has a different cost is shown and never overwritten. {HISTORY_COST_NOTE}.
            </p>

            {step === "file" || (read?.problems.length ?? 0) > 0 ? (
              <section className="space-y-2" data-testid="history-costs-file">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" disabled={busy} onClick={() => pick.current?.click()} data-testid="history-costs-pick">
                    <FileUp className="size-4" />
                    {preview.isPending ? "Reading…" : "Pick The Line Costs CSV"}
                  </Button>
                  <span className="text-xs text-muted-foreground">{file ? `${file.name}${progress ? ` · ${progress}` : ""}` : "Not picked"}</span>
                  <input
                    ref={pick}
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    data-testid="history-costs-input"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      setFile(f);
                      preview.mutate(f);
                    }}
                  />
                </div>
                {read?.problems.length ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs" data-testid="history-costs-problems">
                    <p className="font-medium">Fix these in the file and pick it again. Nothing was previewed or saved.</p>
                    <ul className="mt-1 list-disc pl-4">
                      {read.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {(step === "preview" || step === "saving") && plan && counts ? (
              <section className="space-y-2" data-testid="history-costs-preview">
                <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Preview (nothing saved yet)</h3>
                <div className="flex flex-wrap gap-2" data-testid="history-costs-counts">
                  {LINE_COST_STATUSES.map((s) => (
                    <FilterChip key={s} selected={group === s} onClick={() => setGroup(s)} data-testid={`history-costs-${s}`}>
                      {LINE_COST_STATUS_LABEL[s]} {n(counts[s])}
                    </FilterChip>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground" data-testid="history-costs-adds">
                  Will Fill adds {money(counts.fillCost)} of cost on {money(counts.fillSell)} billed: {money(counts.fillProfit)} before discounts. {HISTORY_COST_NOTE}.
                </p>
                {lineCostSaveable(group) && groupLines.length ? (
                  <div className="flex flex-wrap items-center gap-x-3 text-xs">
                    <span className="text-muted-foreground">
                      {n(groupLines.filter((l) => ticks.has(keyOf(l))).length)} of {n(groupLines.length)} ticked
                    </span>
                    <button type="button" className="h-8 font-medium text-primary" onClick={() => tickSet(groupLines.map(keyOf), true)}>
                      Tick all
                    </button>
                    <button type="button" className="h-8 font-medium text-primary" onClick={() => tickSet(groupLines.map(keyOf), false)}>
                      Untick all
                    </button>
                  </div>
                ) : null}
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border sm:max-h-[45vh] sm:overflow-y-auto" data-testid="history-costs-lines">
                  {paged.visible.map((l) => (
                    <li key={keyOf(l)} className="flex gap-3 px-3 py-2 text-sm" data-testid="history-costs-line">
                      {lineCostSaveable(l.status) && l.lineId != null ? (
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-primary"
                          checked={ticks.has(keyOf(l))}
                          disabled={step === "saving"}
                          onChange={(e) => tickSet([keyOf(l)], e.target.checked)}
                          aria-label={`Fill cost on ${l.row.ref} line ${l.row.sort}`}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{l.row.ref}</span>
                          <span className="text-xs text-muted-foreground">
                            Line {l.row.sort} · {l.row.lineType} · {l.row.itemCode || "(no item)"} · qty {l.row.qty ?? "—"} · {money(l.row.amount)}
                          </span>
                          {l.customer ? <span className="text-xs break-words text-muted-foreground">{l.customer}</span> : null}
                        </p>
                        <p className="text-xs break-words text-muted-foreground">
                          <Badge size="tight" variant={VARIANT[l.status]} className="mr-1 align-middle">
                            {LINE_COST_STATUS_LABEL[l.status]}
                          </Badge>
                          File cost {unitMoney(l.row.unitCost)} each · {money(l.row.lineCost)} · {COST_BASIS_LABEL[l.row.costBasis]}
                          {l.row.costDate ? ` (${l.row.costDate})` : ""}
                          {l.row.costFlag ? ` · ${l.row.costFlag}` : ""}
                          {l.saved ? ` · Saved cost ${unitMoney(l.saved.unitCost)} each · ${money(l.saved.lineCost)}${l.saved.costFlag ? ` · ${l.saved.costFlag}` : ""}` : ""}
                          {l.reason ? ` · ${l.reason}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                  {!groupLines.length ? <li className="px-3 py-4 text-sm text-muted-foreground">Nothing here.</li> : null}
                  <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} />
                </ul>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {progress ? <span className="mr-auto text-xs text-muted-foreground">{progress}</span> : null}
                  <Button type="button" size="sm" variant="outline" disabled={busy || !file} onClick={() => file && preview.mutate(file)}>
                    Read Again
                  </Button>
                  <Button type="button" size="sm" disabled={!ticked.length || busy} onClick={onSave} data-testid="history-costs-save">
                    {save.isPending ? "Saving…" : `Fill Cost On ${n(ticked.length)}`}
                  </Button>
                </div>
              </section>
            ) : null}

            {step === "done" && report ? (
              <section className="rounded-lg border border-border bg-card p-3 text-sm" data-testid="history-costs-report">
                <p>
                  Cost filled on {plural(report.filled, "line")}.{report.skipped ? ` ${plural(report.skipped, "line")} skipped: they changed since the preview.` : ""}
                </p>
                {report.stopped ? <p className="mt-1 text-destructive">{report.stopped}</p> : null}
                <Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy || !file} onClick={() => file && preview.mutate(file)}>
                  Preview The File Again
                </Button>
              </section>
            ) : null}

            <Runs
              runs={costRuns}
              busy={busy}
              onUndo={(r) => {
                if (window.confirm(`Undo this line-cost import? The cost it wrote is cleared on ${plural(r.costLines, "line")}, except lines whose cost changed since. Nothing is deleted.`))
                  undo.mutate(r.id);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
