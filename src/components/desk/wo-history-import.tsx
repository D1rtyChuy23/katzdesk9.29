import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, History, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  applyWoHistoryRenames,
  finishWoHistoryRun,
  listWoHistoryLocationNeeded,
  listWoHistoryRuns,
  previewWoHistoryBatch,
  previewWoHistoryRenames,
  saveWoHistoryBatch,
  setWoHistoryLocation,
  startWoHistoryRun,
  undoWoHistoryRun,
  type RenameResult,
  type SaveBatchResult,
  type WoHistoryRun,
} from "@/lib/ops/wo-history-api";
import {
  WO_STATUS_LABEL,
  countWoPlan,
  isSaveable,
  readWoHistory,
  remappedByTech,
  saveBatches,
  startsTicked,
  unmatchedNames,
  type RenamePlanLine,
  type WoPlanLine,
  type WoRead,
  type WoStatus,
} from "@/lib/ops/wo-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ActionButton, FilterChip } from "./desk-charts";
import { ShowMoreButton, useShowMore } from "./show-more";
import { cn } from "@/lib/utils";

const STATUSES: WoStatus[] = ["create", "attach", "removed", "unmatched", "ambiguous", "same"];
const VARIANT: Record<WoStatus, "success" | "primary" | "outline" | "danger" | "warn"> = {
  create: "success",
  attach: "primary",
  removed: "warn",
  unmatched: "danger",
  ambiguous: "danger",
  same: "outline",
};
const PLAN_BATCH = 1500;
const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

type Step = "files" | "renames" | "preview" | "saving" | "done";
type Report = SaveBatchResult & { batches: number; stopped: string | null; runId: number };

const emptyReport = (runId: number): Report => ({
  created: 0,
  attached: 0,
  filled: 0,
  lines: 0,
  discountLines: 0,
  partLines: 0,
  partMatched: 0,
  notSaved: [],
  alreadySaved: 0,
  batches: 0,
  stopped: null,
  runId,
});

/**
 * Admin-only: Tickets → Import → Work Order History. Two CSVs (work orders and their QuickBooks lines), read and
 * checked in the browser. Then, in order: account renames for Chuy's yes, the import preview, and the save in batches.
 * Past runs can be undone; Location Needed rows can be put on their account later.
 */
export function WoHistoryImportButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("files");
  const [files, setFiles] = useState<{ orders: File | null; items: File | null }>({ orders: null, items: null });
  const [read, setRead] = useState<WoRead | null>(null);
  const [renames, setRenames] = useState<RenamePlanLine[] | null>(null);
  const [renameTicks, setRenameTicks] = useState<Set<number>>(new Set());
  const [renameResult, setRenameResult] = useState<RenameResult | null>(null);
  const [plan, setPlan] = useState<WoPlanLine[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [group, setGroup] = useState<WoStatus>("create");
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<Report | null>(null);
  const runs = useQuery({ queryKey: ["wo-history-runs"], queryFn: () => listWoHistoryRuns(), enabled: open });
  const need = useQuery({ queryKey: ["wo-history-location-needed"], queryFn: () => listWoHistoryLocationNeeded(), enabled: open });

  const locations = useMemo(() => [...new Set((read?.orders ?? []).map((o) => o.serviceLocation).filter(Boolean))], [read]);

  // Saving runs batch by batch from this page: keep it open until it's done.
  useEffect(() => {
    if (step !== "saving") return;
    const stay = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", stay);
    return () => window.removeEventListener("beforeunload", stay);
  }, [step]);

  function reset() {
    setStep("files");
    setFiles({ orders: null, items: null });
    setRead(null);
    setRenames(null);
    setRenameResult(null);
    setPlan(null);
    setReport(null);
    setProgress(null);
  }

  const readFiles = useMutation({
    mutationFn: async () => {
      const r = readWoHistory(await files.orders!.text(), await files.items!.text());
      if (r.problems.length) return { r, renames: null };
      return { r, renames: await previewWoHistoryRenames({ data: { locations: [...new Set(r.orders.map((o) => o.serviceLocation).filter(Boolean))] } }) };
    },
    onSuccess: ({ r, renames: rn }) => {
      setRead(r);
      if (!rn) return;
      setRenames(rn);
      setRenameTicks(new Set(rn.filter((x) => x.status === "ok").map((x) => x.id)));
      setStep("renames");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the files"),
  });

  const preview = useMutation({
    mutationFn: async () => {
      const orders = read!.orders.map(({ ref, wo, completed, customer, serviceLocation, locationSource, tech }) => ({ ref, wo, completed, customer, serviceLocation, locationSource, tech }));
      const out: WoPlanLine[] = [];
      for (let i = 0; i < orders.length; i += PLAN_BATCH) {
        setProgress(`Checking rows ${n(i + 1)}–${n(Math.min(i + PLAN_BATCH, orders.length))} of ${n(orders.length)}…`);
        out.push(...(await previewWoHistoryBatch({ data: { orders: orders.slice(i, i + PLAN_BATCH) } })));
      }
      return out;
    },
    onSuccess: (p) => {
      setPlan(p);
      setTicks(new Set(p.filter((l) => startsTicked(l.status)).map((l) => l.ref)));
      setGroup(STATUSES.find((s) => p.some((l) => l.status === s)) ?? "create");
      setStep("preview");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build the preview"),
    onSettled: () => setProgress(null),
  });

  const applyRenames = useMutation({
    mutationFn: () => applyWoHistoryRenames({ data: { ids: [...renameTicks], locations } }),
    onSuccess: (res) => {
      setRenameResult(res);
      toast.success(`Renamed ${plural(res.renamed.length, "account")}${res.held.length ? ` · ${n(res.held.length)} held` : ""}`);
      for (const key of ["customers", "directory", "customer-history", "jobs", "clean-names"]) void qc.invalidateQueries({ queryKey: [key] });
      preview.mutate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const chosen = new Set([...ticks].map((r) => r.toLowerCase()));
      const orders = read!.orders.filter((o) => chosen.has(o.ref.toLowerCase()));
      const lines = read!.lines.filter((l) => chosen.has(l.ref.toLowerCase()));
      const seen = Object.fromEntries((plan ?? []).filter((l) => l.seen && chosen.has(l.ref.toLowerCase())).map((l) => [l.ref, l.seen!]));
      const filename = `${files.orders?.name ?? "work orders"} + ${files.items?.name ?? "items"}`;
      const { runId } = await startWoHistoryRun({ data: { filename, rowCount: read!.orders.length, counts: countWoPlan(plan ?? []) } });
      const batches = saveBatches(orders, lines);
      const rep = emptyReport(runId);
      setStep("saving");
      for (let i = 0; i < batches.length; i++) {
        const b = batches[i]!;
        setProgress(`Saving batch ${i + 1} of ${batches.length}…`);
        try {
          const r = await saveWoHistoryBatch({
            data: { runId, orders: b.orders, lines: b.lines, include: b.orders.map((o) => o.ref), seen: Object.fromEntries(b.orders.filter((o) => seen[o.ref]).map((o) => [o.ref, seen[o.ref]!])) },
          });
          rep.created += r.created;
          rep.attached += r.attached;
          rep.filled += r.filled;
          rep.lines += r.lines;
          rep.discountLines += r.discountLines;
          rep.partLines += r.partLines;
          rep.partMatched += r.partMatched;
          rep.alreadySaved += r.alreadySaved;
          rep.notSaved.push(...r.notSaved);
          rep.batches++;
        } catch (e) {
          rep.stopped = `Batch ${i + 1} of ${batches.length} (${b.orders[0]?.ref} to ${b.orders[b.orders.length - 1]?.ref}) didn't save, and the import stopped: ${
            e instanceof Error ? e.message : "unknown error"
          } Batches before it are saved. Saving the same files again skips them and picks up from here.`;
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
      else toast.success(`Saved ${plural(rep.created, "work order")} · attached ${n(rep.attached)} to existing tickets`);
    },
    onError: (e) => {
      setStep("preview");
      toast.error(e instanceof Error ? e.message : "Could not start the save");
    },
    onSettled: () => {
      setProgress(null);
      for (const key of ["wo-history-runs", "wo-history-location-needed", "wo-history-account", "wo-history-job", "jobs", "job", "customer-history", "activity"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const undo = useMutation({
    mutationFn: (runId: number) => undoWoHistoryRun({ data: { runId } }),
    onSuccess: (r) => {
      toast.success(`Undone: ${plural(r.removed, "work order")} removed, ${plural(r.restored, "ticket")} cleared`);
      for (const key of ["wo-history-runs", "wo-history-location-needed", "wo-history-account", "wo-history-job", "jobs", "job", "customer-history"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not undo"),
  });

  const busy = readFiles.isPending || preview.isPending || applyRenames.isPending || save.isPending;
  const counts = useMemo(() => (plan ? countWoPlan(plan) : null), [plan]);
  const groupLines = useMemo(() => (plan ?? []).filter((l) => l.status === group), [plan, group]);
  const paged = useShowMore(groupLines, `${group}|${plan?.length}`, 100);
  const tickedLines = useMemo(() => (plan ?? []).filter((l) => isSaveable(l.status) && ticks.has(l.ref)), [plan, ticks]);
  const remapped = useMemo(() => remappedByTech(plan ?? []), [plan]);
  const unmatched = useMemo(() => unmatchedNames(plan ?? []), [plan]);
  const tickSet = (refs: string[], on: boolean) =>
    setTicks((prev) => {
      const next = new Set(prev);
      for (const r of refs) if (on) next.add(r);
      else next.delete(r);
      return next;
    });

  function onSave() {
    const attach = tickedLines.filter((l) => l.status === "attach").length;
    const removed = tickedLines.filter((l) => l.status === "removed").length;
    const msg = `Save ${plural(tickedLines.length - attach, "work order")} as history${attach ? ` and attach ${n(attach)} to existing tickets` : ""}${
      removed ? ` (${n(removed)} on removed accounts)` : ""
    }? It saves in batches; keep this page open until it's done.`;
    if (window.confirm(msg)) save.mutate();
  }

  return (
    <>
      <ActionButton icon={History} menuLabel="Work Order History" onClick={() => setOpen(true)} data-testid="wo-history-open">
        Import Work Order History
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && step === "saving") return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl" data-testid="wo-history-import">
          <div className="space-y-3">
            <DialogTitle>Import Work Order History</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Completed work orders from the old ticket system with their QuickBooks invoice lines: the Work Orders CSV and the Items CSV. Each row goes on the
              account named by its Service Location, exactly (never a close name). Steps: account renames, then the preview, then Save. Nothing saves until you
              say so, and history is read-only: it never changes Charges, invoices or billing.
            </p>

            {step === "files" ? (
              <section className="space-y-2" data-testid="wo-history-files">
                <FilePick label="Work Orders CSV" file={files.orders} onPick={(f) => setFiles((x) => ({ ...x, orders: f }))} testId="wo-history-orders" />
                <FilePick label="Items CSV" file={files.items} onPick={(f) => setFiles((x) => ({ ...x, items: f }))} testId="wo-history-items" />
                <Button type="button" size="sm" disabled={!files.orders || !files.items || busy} onClick={() => readFiles.mutate()} data-testid="wo-history-read">
                  {readFiles.isPending ? "Reading…" : "Read The Files"}
                </Button>
                {read?.problems.length ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs" data-testid="wo-history-problems">
                    <p className="font-medium">Fix these in the files and pick them again. Nothing was previewed or saved.</p>
                    <ul className="mt-1 list-disc pl-4">
                      {read.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {read && !read.problems.length ? (
              <p className="text-xs text-muted-foreground" data-testid="wo-history-read-summary">
                {plural(read.orders.length, "work order")} and {plural(read.lines.length, "item line")} read.
                {progress ? ` ${progress}` : ""}
              </p>
            ) : null}

            {step === "renames" && renames ? (
              <section className="space-y-2" data-testid="wo-history-renames">
                <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Step 1 · Account renames</h3>
                <p className="text-xs text-muted-foreground">
                  Accounts named “Walk - In:…” or “Cimbali National Accounts:…” drop the prefix so the name is the place; they keep the parent and the Walk-In
                  mark. An account that differs from the file's name only in punctuation takes the file's spelling. A name another account already has is held,
                  never merged. Only ticked renames happen.
                </p>
                {renames.length ? (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border sm:max-h-[45vh] sm:overflow-y-auto">
                    {renames.map((r) => (
                      <li key={r.id} className="flex gap-3 px-3 py-2 text-sm" data-testid="wo-history-rename">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-primary"
                          disabled={r.status !== "ok" || busy}
                          checked={renameTicks.has(r.id)}
                          onChange={(e) =>
                            setRenameTicks((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(r.id);
                              else next.delete(r.id);
                              return next;
                            })
                          }
                          aria-label={`Rename ${r.from}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words">
                            <span className="text-muted-foreground line-through">{r.from}</span> → <span className="font-medium">{r.to}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.kind === "prefix" ? `Billed under ${r.parent}${r.walkIn ? " · stays a Walk-In" : ""}` : "Punctuation, to match the file"}
                            {r.locked ? " · name locked on Clean Names (renamed anyway, stays locked)" : ""}
                          </p>
                          {r.reason ? <p className="text-xs text-destructive">{r.reason}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No accounts to rename.</p>
                )}
                {renameResult?.held.length ? (
                  <ul className="text-xs text-destructive">
                    {renameResult.held.map((h) => (
                      <li key={h.from}>
                        Held: {h.from} → {h.to}. {h.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => preview.mutate()} data-testid="wo-history-skip-renames">
                    {preview.isPending && !applyRenames.isPending ? "Building the preview…" : "Continue Without Renaming"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!renameTicks.size || busy}
                    onClick={() => {
                      if (window.confirm(`Rename ${plural(renameTicks.size, "account")}? Their calls, PMs and installs move with the name.`)) applyRenames.mutate();
                    }}
                    data-testid="wo-history-apply-renames"
                  >
                    {applyRenames.isPending ? "Renaming…" : `Rename ${n(renameTicks.size)} And Continue`}
                  </Button>
                </div>
              </section>
            ) : null}

            {(step === "preview" || step === "saving") && plan && counts ? (
              <section className="space-y-2" data-testid="wo-history-preview">
                <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Step 2 · Preview (nothing saved yet)</h3>
                <div className="flex flex-wrap gap-2" data-testid="wo-history-counts">
                  {STATUSES.map((s) => (
                    <FilterChip key={s} selected={group === s} onClick={() => setGroup(s)} data-testid={`wo-history-${s}`}>
                      {WO_STATUS_LABEL[s]} {n(counts[s])}
                    </FilterChip>
                  ))}
                </div>
                <ul className="space-y-0.5 text-xs text-muted-foreground" data-testid="wo-history-notes">
                  <li>
                    Location Needed: {n(counts.locationNeeded)} (no Service Location; saved on Walk - In / Cimbali National Accounts and listed below to fill in
                    later).
                  </li>
                  {remapped.length ? (
                    <li>
                      To Jesus Garcia, with “Done by …”: {remapped.map((r) => `${r.tech} ${n(r.count)}`).join(", ")}.
                    </li>
                  ) : null}
                  {unmatched.length ? (
                    <li>
                      Unmatched names (fix on Clean Names, then read the files again): {unmatched.slice(0, 40).map((u) => `${u.name} (${n(u.count)})`).join(", ")}
                      {unmatched.length > 40 ? ` and ${n(unmatched.length - 40)} more` : ""}.
                    </li>
                  ) : null}
                </ul>
                {isSaveable(group) && groupLines.length ? (
                  <div className="flex flex-wrap items-center gap-x-3 text-xs">
                    <span className="text-muted-foreground">
                      {n(groupLines.filter((l) => ticks.has(l.ref)).length)} of {n(groupLines.length)} ticked
                    </span>
                    <button type="button" className="h-8 font-medium text-primary" onClick={() => tickSet(groupLines.map((l) => l.ref), true)}>
                      Tick all
                    </button>
                    <button type="button" className="h-8 font-medium text-primary" onClick={() => tickSet(groupLines.map((l) => l.ref), false)}>
                      Untick all
                    </button>
                  </div>
                ) : null}
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border sm:max-h-[45vh] sm:overflow-y-auto" data-testid="wo-history-lines">
                  {paged.visible.map((l) => (
                    <li key={l.ref} className="flex gap-3 px-3 py-2 text-sm" data-testid="wo-history-line">
                      {isSaveable(l.status) ? (
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-primary"
                          checked={ticks.has(l.ref)}
                          disabled={step === "saving"}
                          onChange={(e) => tickSet([l.ref], e.target.checked)}
                          aria-label={`Save ${l.ref}`}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{l.ref}</span>
                          <span className="text-xs break-words text-muted-foreground">{l.account ?? l.lookup}</span>
                          {l.locationNeeded ? (
                            <Badge size="tight" variant="warn">
                              Location Needed
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Badge size="tight" variant={VARIANT[l.status]} className="mr-1 align-middle">
                            {WO_STATUS_LABEL[l.status]}
                          </Badge>
                          {l.technician}
                          {l.originalTech ? ` (done by ${l.originalTech})` : ""}
                          {l.reason ? ` · ${l.reason}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                  {!groupLines.length ? <li className="px-3 py-4 text-sm text-muted-foreground">Nothing here.</li> : null}
                  <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} />
                </ul>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {progress ? <span className="mr-auto text-xs text-muted-foreground" data-testid="wo-history-progress">{progress}</span> : null}
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => preview.mutate()}>
                    Read Again
                  </Button>
                  <Button type="button" size="sm" disabled={!tickedLines.length || busy} onClick={onSave} data-testid="wo-history-save">
                    {save.isPending ? "Saving…" : `Save ${n(tickedLines.length)}`}
                  </Button>
                </div>
              </section>
            ) : null}

            {step === "done" && report ? <ReportCard report={report} onAgain={() => preview.mutate()} busy={busy} /> : null}

            <LocationNeeded rows={need.data ?? []} />
            <Runs runs={runs.data ?? []} busy={undo.isPending || save.isPending} onUndo={(r) => {
              if (window.confirm(`Undo the ${when(r.createdAt)} import? ${plural(r.current, "history work order")} and their invoice lines are deleted, and ticket fields it filled are cleared. Account renames stay.`)) undo.mutate(r.id);
            }} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilePick({ label, file, onPick, testId }: { label: string; file: File | null; onPick: (f: File) => void; testId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant={file ? "outline" : "default"} onClick={() => ref.current?.click()} data-testid={`${testId}-pick`}>
        <FileUp className="size-4" />
        {label}
      </Button>
      <span className="min-w-0 text-xs break-all text-muted-foreground">{file ? `${file.name} · ${(file.size / 1_048_576).toFixed(1)} MB` : "Not picked"}</span>
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={testId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
    </div>
  );
}

function ReportCard({ report: r, onAgain, busy }: { report: Report; onAgain: () => void; busy: boolean }) {
  return (
    <section className={cn("space-y-1 rounded-lg border p-3 text-sm", r.stopped ? "border-destructive/50" : "border-border")} data-testid="wo-history-report">
      <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Step 3 · Saved (run #{r.runId})</h3>
      {r.stopped ? <p className="text-destructive" data-testid="wo-history-stopped">{r.stopped}</p> : null}
      <ul className="space-y-0.5">
        <li>Created: {n(r.created)} history work orders</li>
        <li>Attached to existing tickets: {n(r.attached)} ({n(r.filled)} had a blank Work Done or Completed date filled)</li>
        <li>
          Item lines saved: {n(r.lines)}, plus {plural(r.discountLines, "discount line")} (stored, and added up into each invoice's one discount;{" "}
          {plural(r.lines + r.discountLines, "QuickBooks line")} in all). Of {n(r.partLines)} part, filter, equipment and fee lines, {n(r.partMatched)} match the Parts list and{" "}
          {n(r.partLines - r.partMatched)} are kept as text.
        </li>
        <li>Batches saved: {n(r.batches)}</li>
        {r.alreadySaved ? <li>Already saved before (skipped): {n(r.alreadySaved)}</li> : null}
        {r.notSaved.length ? (
          <li className="text-warning">
            Not saved: {n(r.notSaved.length)}
            <ul className="list-disc pl-4 text-xs">
              {r.notSaved.slice(0, 30).map((x) => (
                <li key={x.ref}>
                  {x.ref}: {x.why}
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onAgain}>
        Read The Files Again
      </Button>
    </section>
  );
}

function LocationNeeded({ rows }: { rows: { id: number; ref: string; wo: string | null; completed: string | null; customer: string; po: string | null; srv: string | null; problem: string | null }[] }) {
  const qc = useQueryClient();
  const [shown, setShown] = useState(false);
  const [names, setNames] = useState<Record<number, string>>({});
  const paged = useShowMore(rows, rows.length, 50);
  const set = useMutation({
    mutationFn: (v: { id: number; account: string }) => setWoHistoryLocation({ data: v }),
    onSuccess: (r) => {
      toast.success(`Moved to ${r.account}`);
      for (const key of ["wo-history-location-needed", "wo-history-account"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move it"),
  });
  if (!rows.length) return null;
  return (
    <section className="border-t border-border pt-3" data-testid="wo-history-location-needed">
      <button type="button" className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase" onClick={() => setShown((v) => !v)} aria-expanded={shown}>
        Location needed · {n(rows.length)} {shown ? "▾" : "▸"}
      </button>
      {shown ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {paged.visible.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {r.ref} <span className="text-xs font-normal text-muted-foreground">{r.customer} · {r.completed?.slice(0, 10)}{r.srv ? ` · ${r.srv}` : ""}</span>
                </p>
                {r.problem ? <p className="truncate text-xs text-muted-foreground">{r.problem}</p> : null}
              </div>
              <Input
                className="h-8 w-56"
                placeholder="Exact account name"
                value={names[r.id] ?? ""}
                onChange={(e) => setNames((x) => ({ ...x, [r.id]: e.target.value }))}
                aria-label={`Account for ${r.ref}`}
              />
              <Button type="button" size="sm" variant="outline" disabled={!names[r.id]?.trim() || set.isPending} onClick={() => set.mutate({ id: r.id, account: names[r.id]! })}>
                Move
              </Button>
            </li>
          ))}
          <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} />
        </ul>
      ) : null}
    </section>
  );
}

function Runs({ runs, busy, onUndo }: { runs: WoHistoryRun[]; busy: boolean; onUndo: (r: WoHistoryRun) => void }) {
  if (!runs.length) return null;
  return (
    <section className="border-t border-border pt-3" data-testid="wo-history-runs">
      <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Past imports</h3>
      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
        {runs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 break-words">
            <span>
              <span className="text-foreground">#{r.id} · {when(r.createdAt)}</span> · {r.createdBy ?? "Admin"}: created {n(r.created)}, attached {n(r.attached)},{" "}
              {r.itemLines != null && r.discountLines != null
                ? `${plural(r.itemLines, "item line")} + ${plural(r.discountLines, "discount line")}`
                : `${plural(r.lines, "QuickBooks line")} (discount lines included)`}
              {r.undoneAt ? ` · undone by ${r.undoneBy ?? "Admin"} ${when(r.undoneAt)}` : r.finishedAt ? "" : " · didn't finish"}
            </span>
            {!r.undoneAt ? (
              <Button type="button" size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => onUndo(r)} data-testid={`wo-history-undo-${r.id}`}>
                <Undo2 className="size-3.5" />
                Undo this run
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
