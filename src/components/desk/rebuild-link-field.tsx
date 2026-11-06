import { useState } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { OpenLink } from "./open-link";
import {
  findRebuildLinks,
  setRebuildLink,
  type LinkCandidate,
  type LinkTarget,
  type RebuildLinkFind,
  type RebuildLinkView,
} from "@/lib/ops/rebuild-link-api";
import { billName, lineCount, money, projectLabel, type LinkDecision, type LinkProject, type SalesOrderAnswer } from "@/lib/ops/rebuild-link";
import type { Rebuild } from "@/lib/ops/rebuilds";
import { useRebuildLink } from "./rebuild-link-query";


const openType = (p: Pick<LinkProject, "kind">) => (p.kind === "install" ? "install" : p.kind);
const candidateKey = (c: LinkCandidate) => `${c.target.kind}-${c.target.id}`;

/** After a link or unlink: the board's row at once (so the form takes the new account and P.O.), then everything it touched. */
function afterLink(qc: QueryClient, row: Rebuild) {
  const patch = (r: unknown) =>
    r && typeof r === "object" && (r as { id?: unknown }).id === row.id
      ? { ...(r as object), account: row.account, po: row.po, installId: row.installId, jobId: row.jobId, updatedAt: row.updatedAt }
      : r;
  qc.setQueriesData({ queryKey: ["rebuilds"] }, (old: unknown) => {
    const rows = old && typeof old === "object" ? (old as { rows?: unknown }).rows : null;
    return Array.isArray(rows) ? { ...(old as object), rows: rows.map(patch) } : old;
  });
  for (const key of ["rebuilds", "rebuild-link", "invoice", "charges", "account-invoices", "activity", "repair-quote", "dashboard", "assets", "project-rebuilds", "job", "jobs", "installs"]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

function Effects({ lines }: { lines: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

/** What one link does, with its button, or why it can't. */
function Decision({ plan, label, dirty, busy, pending, onGo }: { plan: LinkDecision; label: string; dirty: boolean; busy: boolean; pending: boolean; onGo: () => void }) {
  if (!plan.ok) {
    return (
      <p className="mt-1 text-xs text-destructive" data-testid="rebuild-link-refused">
        {plan.refusal}
      </p>
    );
  }
  // Linked there already: it only notes that its own invoice is on a Sales Order.
  const note = plan.steps.includes("note");
  return (
    <>
      <Effects lines={plan.effects} />
      {dirty ? <p className="mt-1 text-xs text-muted-foreground">Saves your changes on Details first.</p> : null}
      <Button type="button" size="sm" className="mt-2 max-sm:h-10" disabled={busy} onClick={onGo} data-testid="rebuild-link-go">
        {pending ? (note ? "Saving…" : "Linking…") : note ? "Note it's on a Sales Order" : label}
      </Button>
    </>
  );
}

/**
 * Linked ticket / install (Chuy, 11/6): a WO finds every service ticket, TLC and install carrying it, and the one
 * picked takes the rebuild: its account and Customer P.O., and its invoice's lines on the ticket's charges or the
 * install's invoice. Each match says what Link does, or why it can't. Linking saves the form's changes first.
 */
export function RebuildLinkField({
  row,
  canEdit,
  dirty,
  saveFirst,
}: {
  row: Rebuild;
  canEdit: boolean;
  /** The Details form has changes not saved yet. */
  dirty: boolean;
  /** Saves the Details form before a link or an unlink; false when that failed (it says why). */
  saveFirst: (action: "link" | "unlink") => Promise<boolean>;
}) {
  const qc = useQueryClient();
  const view = useRebuildLink(row.id);
  const [wo, setWo] = useState("");
  const [found, setFound] = useState<RebuildLinkFind | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  // Each match's answer to "Is its invoice on a Sales Order in NetSuite yet?" (Chuy, 11/6), once picked.
  const [answers, setAnswers] = useState<Record<string, SalesOrderAnswer>>({});

  const find = useMutation({
    mutationFn: (q: { wo?: string; pick?: LinkTarget }) => findRebuildLinks({ data: { id: row.id, ...q } }),
    onSuccess: (next) => {
      setFound(next);
      setAnswers({});
      setConfirmUnlink(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const go = useMutation({
    mutationFn: async (q: { base: RebuildLinkView; to: LinkCandidate | null; salesOrder?: SalesOrderAnswer }) => {
      if (dirty && !(await saveFirst(q.to ? "link" : "unlink"))) return null;
      return setRebuildLink({
        data: {
          id: row.id,
          expect: { installId: q.base.installId, jobId: q.base.jobId },
          to: q.to ? q.to.target : null,
          seen: { own: q.base.own.version, current: q.base.current?.stamp ?? null, target: q.to ? q.to.project.stamp : null },
          salesOrder: q.salesOrder ?? null,
        },
      });
    },
    onSuccess: (out) => {
      if (!out) return;
      toast.success(out.message || "Saved");
      setFound(null);
      setAnswers({});
      setWo("");
      setConfirmUnlink(false);
      afterLink(qc, out.row);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      // A move to another WO can stop after its unlink: everything reads again, so the sheet shows where it is now.
      for (const key of ["rebuilds", "rebuild-link", "invoice", "charges", "project-rebuilds", "activity"]) void qc.invalidateQueries({ queryKey: [key] });
    },
  });

  const v = view.data;
  const current = v?.current ?? null;
  const refusal = v?.refusal ?? null;
  const writable = canEdit && !!v && !refusal;
  const busy = find.isPending || go.isPending;
  const runFind = () => {
    if (!wo.trim()) return;
    find.mutate({ wo });
  };

  return (
    <div data-testid="rebuild-link">
      <Label htmlFor="rb-link-wo">Linked ticket / install</Label>
      {current ? (
        <div className="mt-1 rounded-xl border border-border bg-muted/40 p-3" data-testid="rebuild-link-current">
          <p className="text-sm font-medium">
            Linked to {projectLabel(current)}
            {current.customer ? <span className="font-normal text-muted-foreground"> · {current.customer}</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {refusal
              ? "It bills there."
              : current.lines > 0
                ? `It bills there: ${lineCount(current.lines)} (${money(current.total)}) on ${billName(current)}.`
                : `It bills there. None of its lines are on ${billName(current)} yet.`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <OpenLink entityType={openType(current)} id={current.id} className="text-xs text-primary hover:underline max-sm:inline-flex max-sm:min-h-10 max-sm:items-center max-sm:text-sm">
              Open {current.kind === "install" ? "install" : "ticket"}
            </OpenLink>
            {writable && v?.unlink ? (
              v.unlink.ok ? (
                <Button type="button" size="sm" variant="outline" className="max-sm:h-10" disabled={busy} onClick={() => setConfirmUnlink((x) => !x)} data-testid="rebuild-link-unlink">
                  Unlink
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground" data-testid="rebuild-link-unlink-refused">
                  {v.unlink.refusal}
                </span>
              )
            ) : null}
          </div>
          {confirmUnlink && v?.unlink?.ok ? (
            <div className="mt-2 rounded-lg border border-border bg-card p-2.5" data-testid="rebuild-link-unlink-confirm">
              <p className="text-xs font-medium">Unlink from {projectLabel(current)}?</p>
              <Effects lines={v.unlink.effects} />
              {dirty ? <p className="mt-1 text-xs text-muted-foreground">Saves your changes on Details first.</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" className="max-sm:h-10" disabled={busy} onClick={() => go.mutate({ base: v, to: null })} data-testid="rebuild-link-unlink-go">
                  {go.isPending ? "Unlinking…" : "Unlink"}
                </Button>
                <Button type="button" size="sm" variant="outline" className="max-sm:h-10" disabled={busy} onClick={() => setConfirmUnlink(false)}>
                  Keep it linked
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground" data-testid="rebuild-link-none">
          Not linked: this is its own project.
        </p>
      )}
      {/* Linked, it says why there's no Unlink here (Warehouse, Sales, or a rebuild off the board). */}
      {refusal && current ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="rebuild-link-refusal">
          {refusal}
        </p>
      ) : null}
      {writable ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              id="rb-link-wo"
              className="w-40 max-sm:flex-1"
              value={wo}
              placeholder={current ? "Another WO #" : "WO #"}
              autoComplete="off"
              maxLength={40}
              onChange={(e) => setWo(e.target.value)}
              onKeyDown={(e) => {
                // Enter finds the WO instead of saving the form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  runFind();
                }
              }}
              data-testid="rebuild-link-wo"
            />
            <Button type="button" variant="outline" disabled={busy || !wo.trim()} onClick={runFind} data-testid="rebuild-link-find">
              {find.isPending ? "Finding…" : "Find"}
            </Button>
          </div>
          {!found && v && v.suggestions.length ? (
            <div className="mt-2" data-testid="rebuild-link-suggestions">
              <p className="text-xs text-muted-foreground">Open on {v.account}:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {v.suggestions.slice(0, 8).map((s) => (
                  <button
                    key={`${s.target.kind}-${s.target.id}`}
                    type="button"
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted max-sm:min-h-10"
                    disabled={busy}
                    onClick={() => find.mutate({ pick: s.target })}
                    data-testid="rebuild-link-suggestion"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {found ? (
            <div className="mt-2 space-y-2" data-testid="rebuild-link-results">
              {found.error ? (
                <p className="text-xs text-muted-foreground" data-testid="rebuild-link-error">
                  {found.error}
                </p>
              ) : found.candidates.length > 1 ? (
                <p className="text-xs text-muted-foreground">{found.candidates.length} records carry this WO. Pick the one this rebuild is for.</p>
              ) : null}
              {found.candidates.map((c) => {
                const key = candidateKey(c);
                const answer = answers[key];
                const label = `Link to ${c.project.wo?.trim() || c.project.name}`;
                return (
                  <div key={key} className="rounded-xl border border-border p-3" data-testid="rebuild-link-candidate">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <p className="text-sm font-medium">{projectLabel(c.project)}</p>
                      <OpenLink entityType={openType(c.project)} id={c.project.id} className="text-xs text-primary hover:underline max-sm:inline-flex max-sm:min-h-10 max-sm:items-center">
                        Open
                      </OpenLink>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.project.customer || "No account"} · {c.project.status}
                      {c.project.po ? ` · P.O. ${c.project.po}` : ""}
                    </p>
                    {c.plan.ok === "ask" ? (
                      // Its invoice is approved, so it may be on a Sales Order already: the person says, then sees what Link does.
                      <div className="mt-2" data-testid="rebuild-link-ask">
                        <p className="text-xs font-medium">{c.plan.question}</p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {(["not", "on"] as const).map((a) => (
                            <Button
                              key={a}
                              type="button"
                              size="sm"
                              variant={answer === a ? "default" : "outline"}
                              aria-pressed={answer === a}
                              className="max-sm:h-10"
                              disabled={busy}
                              onClick={() => setAnswers((x) => ({ ...x, [key]: a }))}
                              data-testid={`rebuild-link-answer-${a}`}
                            >
                              {a === "not" ? "Not yet" : "Yes, it's on one"}
                            </Button>
                          ))}
                        </div>
                        {answer ? (
                          <Decision
                            plan={c.plan[answer]}
                            label={label}
                            dirty={dirty}
                            busy={busy}
                            pending={go.isPending}
                            onGo={() => go.mutate({ base: found, to: c, salesOrder: answer })}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <Decision plan={c.plan} label={label} dirty={dirty} busy={busy} pending={go.isPending} onGo={() => go.mutate({ base: found, to: c })} />
                    )}
                  </div>
                );
              })}
              <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline max-sm:min-h-10" onClick={() => setFound(null)}>
                Clear
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
