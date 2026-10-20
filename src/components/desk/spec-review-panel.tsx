import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveExactSpecReads, approveSpecRead, runSpecReads, type SpecReadRow } from "@/lib/ops/spec-read-api";
import { clipRows } from "@/lib/ops/spec-read";

/** The review list. Nothing here is saved until Approve. */
export function SpecReviewPanel({
  rows,
  queued,
  noSheet,
  onChanged,
}: {
  rows: SpecReadRow[];
  queued: number;
  noSheet: { id: number; title: string }[];
  onChanged: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showSheets, setShowSheets] = useState(false);
  const [useNew, setUseNew] = useState<Record<string, boolean>>({});
  const waiting = rows.filter((r) => r.status === "needs_review");
  const broken = rows.filter((r) => r.status === "unreadable");
  const exact = waiting.filter((r) => r.exact).length;
  const open = [...waiting, ...broken];
  const clipped = clipRows(open, showAll);

  const run = useMutation({
    mutationFn: (fileIds?: number[]) => runSpecReads({ data: { limit: 15, ...(fileIds ? { fileIds } : {}) } }),
    onSuccess: (r) => {
      const bits = [`${r.review} to review`, `${r.unreadable} unreadable`];
      if (r.left) bits.push(`${r.left} still queued`);
      toast.success(r.note ? `${r.note} ${bits.join(", ")}.` : `Read ${r.read}. ${bits.join(", ")}.`);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the spec sheets"),
  });
  const approve = useMutation({
    mutationFn: (row: SpecReadRow) => {
      const keys = row.changes.filter((c) => c.kind === "conflict" && useNew[`${row.fileId}:${c.key}`]).map((c) => c.key);
      return approveSpecRead({ data: { fileId: row.fileId, useNew: keys } });
    },
    onSuccess: (r) => {
      toast.success(`${r.title} updated`);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve that sheet"),
  });
  const approveAll = useMutation({
    mutationFn: () => approveExactSpecReads(),
    onSuccess: (r) => {
      toast.success(r.approved ? `Approved ${r.approved}` : "Nothing was an exact match");
      if (r.skipped.length) toast.error(`Not approved: ${r.skipped.join(" · ")}`);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve those sheets"),
  });
  const busy = run.isPending || approve.isPending || approveAll.isPending;

  return (
    <div data-testid="spec-review">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => run.mutate(undefined)} data-testid="read-all-specs">
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {queued ? "Read next 15" : "Read All Spec Sheets"}
        </Button>
        <Button type="button" variant="outline" disabled={busy || exact === 0} onClick={() => approveAll.mutate()} data-testid="approve-all-exact">
          Approve all exact{exact ? ` (${exact})` : ""}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {queued ? `${queued} still queued. ` : ""}
        A filled field stays until you pick Use new. Approve all exact only fills blanks.
      </p>
      {clipped.rows.length ? (
        <ul className="mt-3 divide-y divide-border" data-testid="spec-review-rows">
          {clipped.rows.map((row) => (
            <li key={row.fileId} className="py-3" data-testid="spec-review-row">
              <p className="text-sm font-medium">
                {row.bookTitle}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{row.fileName}</span>
              </p>
              {row.status === "unreadable" ? (
                <p className="mt-1 text-sm text-muted-foreground">{row.error || "Unreadable"}</p>
              ) : (
                <>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {row.changes.map((change) => (
                      <li key={change.key} className="grid gap-1 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                        <span className="text-muted-foreground">{change.label}</span>
                        <span>
                          {change.kind === "fill" ? (
                            <span>blank → {change.newValue}</span>
                          ) : change.kind === "same" ? (
                            <span>{change.newValue}</span>
                          ) : (
                            <span>
                              <span className="line-through opacity-60">{change.oldValue || "blank"}</span>
                              {" → "}
                              {change.newValue}
                            </span>
                          )}
                        </span>
                        {change.kind === "conflict" ? (
                          <label className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={!!useNew[`${row.fileId}:${change.key}`]}
                              onChange={(e) => setUseNew((m) => ({ ...m, [`${row.fileId}:${change.key}`]: e.target.checked }))}
                            />
                            Use new
                          </label>
                        ) : (
                          <span />
                        )}
                      </li>
                    ))}
                  </ul>
                  <Button type="button" size="sm" className="mt-2" variant="outline" disabled={busy} onClick={() => approve.mutate(row)} data-testid="spec-review-approve">
                    Approve
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No sheet is waiting for review.</p>
      )}
      {clipped.more ? (
        <Button type="button" variant="link" className="mt-1 h-8 px-0" onClick={() => setShowAll(true)}>
          Show all {open.length}
        </Button>
      ) : null}
      <details className="mt-3" open={showSheets} onToggle={(e) => setShowSheets((e.target as HTMLDetailsElement).open)} data-testid="models-no-sheet">
        <summary className="cursor-pointer text-sm text-muted-foreground">Models with no spec sheet ({noSheet.length})</summary>
        {noSheet.length ? (
          <ul className="mt-2 max-h-48 overflow-y-auto text-sm">
            {(showSheets ? noSheet : noSheet.slice(0, 10)).map((book) => (
              <li key={book.id} className="py-0.5">{book.title}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Every model has a spec sheet.</p>
        )}
      </details>
    </div>
  );
}
