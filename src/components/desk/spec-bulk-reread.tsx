import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  REREAD_STATUSES,
  getRereadCounts,
  runSpecRereadBatch,
  startSpecRereads,
  type ReadOutcome,
  type RereadSection,
  type RereadStatus,
} from "@/lib/ops/spec-read-api";

const STATUS_LABEL: Record<RereadStatus, string> = {
  unreadable: "Unreadable",
  never: "Not read yet",
  needs_review: "Waiting for review",
  read: "Read and approved",
};
const SECTION_LABEL: Record<RereadSection, string> = { spec: "Spec sheets", manuals: "Manuals (PDF)" };

type Run = {
  total: number;
  done: number;
  review: number;
  unreadable: number;
  /** Why files stayed unreadable, with how many. */
  reasons: Record<string, number>;
  running: boolean;
  note: string | null;
};

/** "No text layer (scanned): the PDF opened (3 pages) but …" and "(1 page)" are one reason. */
const reasonKey = (error: string | null) => (error ?? "Unreadable").replace(/\s*\(\d+ pages?\)/g, "");

/**
 * Re-read spec sheets & manuals (Admin): pick which files by where their read stands, then they are queued again and
 * read in batches of 15 with the progress shown. Reads only fill Spec Review; nothing is written onto a model until
 * Approve, so running it twice is safe.
 */
export function BulkRereadButton({ onChanged, disabled }: { onChanged: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<Record<RereadStatus, boolean>>({ unreadable: true, never: true, needs_review: false, read: false });
  const [sections, setSections] = useState<Record<RereadSection, boolean>>({ spec: true, manuals: true });
  const [run, setRun] = useState<Run | null>(null);
  const stop = useRef(false);
  const counts = useQuery({ queryKey: ["spec-bulk-reread-counts"], queryFn: () => getRereadCounts(), enabled: open, staleTime: 0 });
  const picked = (Object.keys(sections) as RereadSection[]).filter((s) => sections[s]);
  const pickedStatus = REREAD_STATUSES.filter((s) => statuses[s]);
  const count = (status: RereadStatus) => picked.reduce((n, s) => n + (counts.data?.[s][status] ?? 0), 0);
  const chosen = pickedStatus.reduce((n, s) => n + count(s), 0);

  const close = () => {
    if (run?.running) return;
    setOpen(false);
    setRun(null);
  };

  async function start() {
    stop.current = false;
    let state: Run = { total: 0, done: 0, review: 0, unreadable: 0, reasons: {}, running: true, note: null };
    setRun(state);
    try {
      const { fileIds } = await startSpecRereads({ data: { statuses: pickedStatus, sections: picked } });
      state = { ...state, total: fileIds.length };
      setRun(state);
      let left = fileIds.length;
      while (left > 0 && !stop.current) {
        const batch = await runSpecRereadBatch({ data: { fileIds } });
        const reasons = { ...state.reasons };
        for (const o of batch.outcomes as ReadOutcome[]) if (o.status === "unreadable") reasons[reasonKey(o.error)] = (reasons[reasonKey(o.error)] ?? 0) + 1;
        state = {
          ...state,
          done: state.done + batch.outcomes.length,
          review: state.review + batch.review,
          unreadable: state.unreadable + batch.unreadable,
          reasons,
          note: batch.note,
        };
        setRun(state);
        left = batch.left;
        // Nothing read in a batch: stop rather than ask again (the note says why).
        if (!batch.outcomes.length) break;
      }
      if (stop.current) state = { ...state, note: `Stopped. ${left} still queued: Read next 15 picks them up.` };
      else if (left > 0) state = { ...state, note: `${state.note ?? "Stopped."} ${left} still queued.` };
      else state = { ...state, note: null };
    } catch (e) {
      state = { ...state, note: e instanceof Error ? e.message : "The re-read stopped." };
      toast.error(state.note!);
    } finally {
      setRun({ ...state, running: false });
      onChanged();
      void counts.refetch();
    }
  }

  const reasons = Object.entries(run?.reasons ?? {}).sort((a, b) => b[1] - a[1]);
  const pct = run && run.total ? Math.round((run.done / run.total) * 100) : 0;

  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)} data-testid="bulk-reread-open">
        <RotateCcw className="size-4" />
        Re-read spec sheets &amp; manuals
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-lg" data-testid="bulk-reread">
          <DialogTitle>Re-read spec sheets &amp; manuals</DialogTitle>
          <DialogDescription>
            Pick the files to read again. Each one goes back in the queue and is read 15 at a time. What a read finds waits in Spec Review: Approve still only fills blank
            fields, so nothing typed by hand or approved is changed. Running it again is safe.
          </DialogDescription>
          {!run ? (
            <>
              <div className="grid gap-3 text-sm" data-testid="bulk-reread-choices">
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1 text-xs font-medium text-muted-foreground uppercase">Files</legend>
                  {(Object.keys(SECTION_LABEL) as RereadSection[]).map((s) => (
                    <label key={s} className="flex items-center gap-2">
                      <input type="checkbox" checked={sections[s]} onChange={(e) => setSections((m) => ({ ...m, [s]: e.target.checked }))} data-testid={`bulk-reread-section-${s}`} />
                      {SECTION_LABEL[s]}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1 text-xs font-medium text-muted-foreground uppercase">Where the read stands now</legend>
                  {REREAD_STATUSES.map((s) => (
                    <label key={s} className="flex items-center gap-2">
                      <input type="checkbox" checked={statuses[s]} onChange={(e) => setStatuses((m) => ({ ...m, [s]: e.target.checked }))} data-testid={`bulk-reread-status-${s}`} />
                      <span className="flex-1">{STATUS_LABEL[s]}</span>
                      <span className="tabular text-muted-foreground" data-testid={`bulk-reread-count-${s}`}>
                        {counts.isLoading ? "…" : count(s).toLocaleString("en-US")}
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>
              {counts.isError ? <p className="text-sm text-destructive">{counts.error instanceof Error ? counts.error.message : "Couldn't count the files."}</p> : null}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                <span className="mr-auto text-xs text-muted-foreground">Each file is one AI read.</span>
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="button" disabled={!chosen || counts.isLoading} onClick={() => void start()} data-testid="bulk-reread-start">
                  Re-read {chosen.toLocaleString("en-US")} file{chosen === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          ) : (
            <div className="grid gap-3" data-testid="bulk-reread-run" data-running={run.running ? "yes" : "no"}>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-sm" data-testid="bulk-reread-progress">
                {run.running ? <Loader2 className="mr-1 inline size-4 animate-spin" /> : null}
                {run.running ? "Reading… " : "Done. "}
                Read {run.done.toLocaleString("en-US")} of {run.total.toLocaleString("en-US")}: {run.review.toLocaleString("en-US")} need review,{" "}
                {run.unreadable.toLocaleString("en-US")} still unreadable.
              </p>
              {run.note ? <p className="text-sm text-muted-foreground">{run.note}</p> : null}
              {reasons.length ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Still unreadable, and why</p>
                  <ul className="mt-1 grid gap-1 text-sm" data-testid="bulk-reread-reasons">
                    {reasons.slice(0, 8).map(([reason, n]) => (
                      <li key={reason} className="flex gap-2">
                        <span className="w-10 shrink-0 text-right tabular">{n}</span>
                        <span className="min-w-0 break-words text-muted-foreground">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                {run.running ? (
                  <Button type="button" variant="outline" onClick={() => (stop.current = true)} data-testid="bulk-reread-stop">
                    Stop after this batch
                  </Button>
                ) : (
                  <Button type="button" onClick={close} data-testid="bulk-reread-done">
                    Done
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
