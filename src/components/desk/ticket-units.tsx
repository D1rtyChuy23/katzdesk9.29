import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  confirmTicketUnitSuggestions,
  dismissTicketUnitSuggestions,
  getTicketUnitSuggestions,
  getTicketUnits,
  getUnitServiceHistory,
  setTicketUnits,
  type TicketUnit,
} from "@/lib/ops/ticket-units-api";

const unitText = (u: TicketUnit) => [u.model || u.name, u.serial ? `S/N ${u.serial}` : "no serial"].filter(Boolean).join(" · ");
const idsKey = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");

/**
 * Which of the account's machines this ticket is for (Chuy, 11/21): any number of them, optional. Each one picked lists
 * this ticket in its Service History.
 */
export function TicketUnitsPicker({ jobId }: { jobId: number }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ticket-units", jobId], queryFn: () => getTicketUnits({ data: { jobId } }) });
  const [picked, setPicked] = useState<number[]>([]);
  // Reset to what's saved only when that changes: a refetch on focus keeps unsaved ticks.
  const savedKey = q.data ? idsKey(q.data.linked.map((u) => u.id)) : null;
  useEffect(() => {
    if (q.data) setPicked(q.data.linked.map((u) => u.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, jobId]);
  const save = useMutation({
    mutationFn: () => setTicketUnits({ data: { jobId, unitIds: picked } }),
    onSuccess: (next) => {
      qc.setQueryData(["ticket-units", jobId], next);
      void qc.invalidateQueries({ queryKey: ["unit-service-history"] });
      toast.success(next.linked.length ? `This ticket is for ${next.linked.length} machine${next.linked.length === 1 ? "" : "s"}` : "No machine on this ticket");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const d = q.data;
  if (!d) return null;
  const changed = idsKey(picked) !== idsKey(d.linked.map((u) => u.id));
  // Machines it named that have moved to another account since: listed so they can stay or be unticked.
  const moved = d.linked.filter((u) => u.elsewhere);
  const choices = [...d.options, ...moved.filter((m) => !d.options.some((o) => o.id === m.id))];
  return (
    <section className="border-b border-border p-5" data-testid="ticket-units">
      <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Machines On This Ticket</h3>
      {d.hidden ? <p className="mt-1 text-xs text-muted-foreground">{d.hidden} Its machines are named there.</p> : null}
      {choices.length ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">Tick the machines this visit was for. Each one lists this ticket in its Service History.</p>
          <ul className="mt-3 space-y-1.5">
            {choices.map((u) => (
              <li key={u.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    disabled={!d.canEdit}
                    checked={picked.includes(u.id)}
                    onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, u.id] : cur.filter((x) => x !== u.id)))}
                    data-testid={`ticket-unit-${u.id}`}
                  />
                  {unitText(u)}
                  {u.elsewhere ? <span className="text-xs text-warning">· now on {u.elsewhere}</span> : null}
                </label>
              </li>
            ))}
          </ul>
          {d.canEdit ? (
            <Button type="button" size="sm" className="mt-3" disabled={!changed || save.isPending} onClick={() => save.mutate()} data-testid="ticket-units-save">
              {save.isPending ? "Saving…" : "Save Machines"}
            </Button>
          ) : null}
        </>
      ) : d.hidden ? null : (
        <p className="mt-1 text-xs text-muted-foreground">
          {d.customer ? `${d.customer} has no machines on its Equipment list yet.` : "This ticket has no account, so no machines to name."}
        </p>
      )}
    </section>
  );
}

/** The tickets that name this machine (11/21), newest first. */
export function UnitServiceHistory({ unitId }: { unitId: number }) {
  const q = useQuery({ queryKey: ["unit-service-history", unitId], queryFn: () => getUnitServiceHistory({ data: { unitId } }) });
  const rows = q.data ?? [];
  return (
    <section className="mt-5 border-t border-border pt-4" data-testid="unit-service-history">
      <h3 className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        <Wrench className="size-3.5" aria-hidden />
        Service History
      </h3>
      {q.isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ) : rows.length ? (
        <ul className="mt-2 space-y-2 text-sm">
          {rows.map((v) => (
            <li key={v.jobId} className="rounded-md border border-border px-3 py-2" data-testid="unit-service-visit">
              <span className="font-medium">{v.callId || `#${v.jobId}`}</span>
              <span className="text-muted-foreground">
                {" · "}
                {v.kind === "tlc" ? "TLC" : "Service"} · {v.status ?? "—"} · {v.completed ?? v.received ?? "no date"}
              </span>
              {v.mergedInstall ? <span className="text-xs text-muted-foreground"> · merged into install #{v.mergedInstall}</span> : null}
              {v.workDone || v.issue ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{v.workDone || v.issue}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No ticket names this machine yet. Pick it on a ticket's Equipment tab.</p>
      )}
    </section>
  );
}

/**
 * Suggested machines for older tickets (Chuy, 11/21: "Suggest, you confirm"): a ticket whose text names one of its
 * account's units by serial. Confirm links it; Not this one hides the pair for good. Nothing links by itself.
 */
export function TicketUnitSuggestions() {
  const qc = useQueryClient();
  const [account, setAccount] = useState("");
  const [shown, setShown] = useState(100);
  const filters = { customer: account.trim() || null, limit: shown };
  const q = useQuery({ queryKey: ["ticket-unit-suggestions", filters], queryFn: () => getTicketUnitSuggestions({ data: filters }) });
  const done = () => {
    void qc.invalidateQueries({ queryKey: ["ticket-unit-suggestions"] });
    void qc.invalidateQueries({ queryKey: ["ticket-units"] });
    void qc.invalidateQueries({ queryKey: ["unit-service-history"] });
  };
  const confirm = useMutation({
    mutationFn: (pairs: { jobId: number; unitId: number }[]) => confirmTicketUnitSuggestions({ data: { pairs } }),
    onSuccess: (r) => {
      done();
      toast.success(`${r.linked} linked${r.skipped ? ` · ${r.skipped} skipped: the machine or ticket changed since the list loaded` : ""}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not link"),
  });
  const dismiss = useMutation({
    mutationFn: (pairs: { jobId: number; unitId: number }[]) => dismissTicketUnitSuggestions({ data: { pairs } }),
    onSuccess: () => {
      done();
      toast.success("Won't be suggested again");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const rows = q.data?.rows ?? [];
  const clear = rows.filter((r) => r.others === 0);
  // Warehouse doesn't edit tickets: no section for it.
  if (q.isError && q.error instanceof Error && /Warehouse/.test(q.error.message)) return null;
  const busy = confirm.isPending || dismiss.isPending;
  return (
    <section className="mt-10" data-testid="ticket-unit-suggestions">
      <h2 className="font-display text-xl font-medium tracking-tight">Tickets That Name A Machine</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Older tickets whose equipment, issue or work done names one of the account's machines by serial (5 or more characters). Confirm adds the ticket to
        that machine's Service History; Not this one hides the pair for good. A ticket that names more than one machine says so: check it first.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-64 rounded-full border border-border bg-background px-3 text-sm"
          placeholder="Account (exact name), or all"
          value={account}
          onChange={(e) => {
            setAccount(e.target.value);
            setShown(100);
          }}
          data-testid="ticket-unit-suggestions-account"
        />
        <Button type="button" size="sm" disabled={busy || !clear.length} onClick={() => confirm.mutate(clear.map((r) => ({ jobId: r.jobId, unitId: r.unit.id })))} data-testid="ticket-unit-suggestions-confirm-all">
          Confirm {clear.length} shown that name one machine
        </Button>
        {q.data ? <span className="text-xs text-muted-foreground">{q.data.total} suggested</span> : null}
      </div>
      {q.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : q.isError ? (
        <p className="mt-4 text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Could not load"}</p>
      ) : rows.length ? (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={`${r.jobId}:${r.unit.id}`} className="rounded-lg border border-border px-3 py-2 text-sm" data-testid="ticket-unit-suggestion">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{r.callId || `#${r.jobId}`}</span>
                <span className="text-muted-foreground">
                  {r.kind === "tlc" ? "TLC" : "Service"} · {r.customer} · {r.date ?? "no date"}
                </span>
                <span>→ {unitText(r.unit)}</span>
                {r.others ? <span className="text-xs text-warning">also names {r.others} other machine{r.others === 1 ? "" : "s"}</span> : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.text}</p>
              <div className="mt-1.5 flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => confirm.mutate([{ jobId: r.jobId, unitId: r.unit.id }])} data-testid="ticket-unit-suggestion-confirm">
                  Confirm
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => dismiss.mutate([{ jobId: r.jobId, unitId: r.unit.id }])} data-testid="ticket-unit-suggestion-dismiss">
                  Not this one
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No ticket names an unlinked machine{account.trim() ? " on that account" : ""}.</p>
      )}
      {q.data && q.data.total > rows.length ? (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setShown((n) => n + 100)}>
          Show More ({rows.length} of {q.data.total})
        </Button>
      ) : null}
    </section>
  );
}
