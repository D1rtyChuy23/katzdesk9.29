import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { stackPmOnTicket, unstackPm, type StackedPmRow } from "@/lib/ops/pm-stack-api";
import { OpenLink } from "./open-link";
import { StatusBadge } from "./flag-badge";
import { isPmStack, pmStackQuery } from "./pm-stack-shared";

function useStackActions() {
  const qc = useQueryClient();
  const refresh = (pmId: number, jobId: number | null) => {
    void qc.invalidateQueries({ queryKey: ["pms"] });
    void qc.invalidateQueries({ queryKey: ["customer-history"] });
    void qc.invalidateQueries({ queryKey: ["pm-runbook", pmId] });
    void qc.invalidateQueries({ queryKey: ["invoice"] });
    void qc.invalidateQueries({ queryKey: ["charges", jobId] });
    void qc.invalidateQueries({ queryKey: ["jobs"] });
    void qc.invalidateQueries({ queryKey: ["job"] });
    void qc.invalidateQueries({ queryKey: ["pm-stack"] });
    void qc.invalidateQueries({ queryKey: ["pm"] });
  };
  const stack = useMutation({
    mutationFn: (pair: { pmId: number; jobId: number }) => stackPmOnTicket({ data: pair }),
    onSuccess: (_row, pair) => {
      toast.success("PM stacked on the ticket");
      refresh(pair.pmId, pair.jobId);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unstack = useMutation({
    mutationFn: (pair: { pmId: number; jobId: number | null }) => unstackPm({ data: { pmId: pair.pmId } }),
    onSuccess: (_row, pair) => {
      toast.success("PM unstacked");
      refresh(pair.pmId, pair.jobId);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { stack, unstack };
}

function ticketLabel(row: { wo: string | null; callId: string | null }): string {
  return (row.wo ?? "").trim() || (row.callId ?? "").trim();
}

/** Under the PM badges: stack this PM on a ticket, or show the ticket it is already on. */
export function PmStackHeader({
  pmId,
  onSaveFirst,
}: {
  pmId: number;
  onSaveFirst: () => void;
}) {
  const q = useQuery(pmStackQuery(pmId));
  const { stack, unstack } = useStackActions();
  const data = isPmStack(q.data) ? q.data : null;
  if (!data) return null;
  const on = data.stackedOn;
  return (
    <div className="mt-2" data-testid="pm-stack">
      {on ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            On ticket #{on.jobId}
            {ticketLabel(on) ? ` · ${ticketLabel(on)}` : ""}
          </span>
          <OpenLink entityType={on.kind} id={on.jobId} className="text-xs font-medium text-primary hover:underline">
            <span onClick={onSaveFirst}>Open ticket</span>
          </OpenLink>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={unstack.isPending}
            onClick={() => unstack.mutate({ pmId, jobId: on.jobId })}
          >
            Unstack
          </Button>
          {on.customerMatches ? null : (
            <p className="w-full text-xs text-warning">Customer differs from ticket #{on.jobId}</p>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Stack on ticket</p>
          {data.candidates.length ? (
            <ul className="mt-1.5 space-y-1">
              {data.candidates.map((c) => (
                <li key={c.jobId}>
                  <button
                    type="button"
                    className="text-left text-sm text-primary hover:underline disabled:opacity-40"
                    disabled={stack.isPending}
                    onClick={() => stack.mutate({ pmId, jobId: c.jobId })}
                  >
                    Ticket #{c.jobId}
                    {ticketLabel(c) ? ` · ${ticketLabel(c)}` : ""} · {c.status}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No open tickets for this customer.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Schedules tab: PMs already on this ticket, and PMs that can be stacked here. */
export function TicketPmStack({
  jobId,
  stacked,
  candidates,
  onOpenPm,
}: {
  jobId: number;
  stacked: StackedPmRow[];
  candidates: StackedPmRow[];
  onOpenPm: (pmId: number) => void;
}) {
  const { stack, unstack } = useStackActions();
  return (
    <section className="mb-5" data-testid="pm-stack">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">PMs on this ticket</h2>
      {stacked.length ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {stacked.map((p) => (
            <li key={p.pmId} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid="pm-stack-row">
              <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => onOpenPm(p.pmId)}>
                PM #{p.pmId}
              </button>
              <span className="min-w-0 truncate text-sm">{p.customer}</span>
              <StatusBadge status={p.status} />
              {p.customerMatches ? null : (
                <span className="text-xs text-warning">Customer differs from ticket #{jobId}</span>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={unstack.isPending}
                onClick={() => unstack.mutate({ pmId: p.pmId, jobId })}
              >
                Unstack
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No PMs stacked on this ticket.</p>
      )}
      <h2 className="mt-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Stack a PM here</h2>
      {candidates.length ? (
        <ul className="mt-2 space-y-1">
          {candidates.map((p) => (
            <li key={p.pmId} data-testid="pm-stack-row">
              <button
                type="button"
                className="text-left text-sm text-primary hover:underline disabled:opacity-40"
                disabled={stack.isPending}
                onClick={() => stack.mutate({ pmId: p.pmId, jobId })}
              >
                PM #{p.pmId} · {p.customer} · {p.status}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No PMs to stack.</p>
      )}
    </section>
  );
}
