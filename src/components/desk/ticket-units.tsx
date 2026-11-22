import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getTicketUnits, getUnitServiceHistory, setTicketUnits, type TicketUnit } from "@/lib/ops/ticket-units-api";

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
