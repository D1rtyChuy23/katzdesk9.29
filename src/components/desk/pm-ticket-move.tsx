/**
 * Move a PM to a service ticket, and back (Chuy, 11/18; WO-1107, a Mazzer hopper repair filed as PM #171). Admins only.
 * On the PM: "Move to service ticket…" with a confirm that says what goes and what stays. On the ticket it made: where
 * it came from, and "Move back to PM…". Nothing is deleted either way.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";
import { formatLongDate } from "@/lib/ops/clock";
import { getPmMoveInfo, movePmToTicket, previewPmMove, undoPmMove, type PmMovePreview } from "@/lib/ops/pm-to-ticket";
import type { ServiceJob } from "@/lib/ops/types";
import { OpenLink } from "./open-link";

const LINK = "text-sm font-medium text-primary underline-offset-2 hover:underline";

function refreshAll(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [["pms"], ["jobs"], ["dashboard"], ["customer-history"], ["customers"], ["pm"], ["job"]]) void qc.invalidateQueries({ queryKey: key });
}

/** On the PM card, for an Admin: the button, and its confirm. What is typed is saved before the confirm reads the PM. */
export function MovePmToTicket({
  pmId,
  movedJobId,
  onSaveFirst,
  onMoved,
}: {
  pmId: number;
  movedJobId?: number | null;
  /** Saves what is typed and resolves false when it couldn't (the confirm then stays shut). */
  onSaveFirst: () => Promise<boolean>;
  onMoved: (jobId: number) => void;
}) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const [preview, setPreview] = useState<PmMovePreview | null>(null);
  const open = useMutation({
    // What is typed is saved first, and the confirm reads the PM after the save has landed (its stamp too).
    mutationFn: async () => ((await onSaveFirst()) ? previewPmMove({ data: { pmId } }) : null),
    onSuccess: (p) => {
      if (p) setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't read the PM"),
  });
  const move = useMutation({
    mutationFn: (p: PmMovePreview) => movePmToTicket({ data: { pmId: p.pmId, stamp: p.stamp } }),
    onSuccess: (r) => {
      toast.success(`Moved to service ticket ${r.callId}`);
      setPreview(null);
      refreshAll(qc);
      onMoved(r.jobId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't move the PM"),
  });
  if (movedJobId) {
    return (
      <p className="mt-2 text-sm" data-testid="pm-moved-to-ticket">
        Moved to a service ticket.{" "}
        <OpenLink entityType="service" id={movedJobId} className={LINK}>
          Open the ticket
        </OpenLink>
      </p>
    );
  }
  if (!isDeskAdmin(me.data)) return null;
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="mt-2" disabled={open.isPending} onClick={() => open.mutate()} data-testid="pm-move-to-ticket">
        Move to service ticket…
      </Button>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogTitle>Move PM #{preview?.pmId} to a service ticket</DialogTitle>
          <DialogDescription>
            A new Field Service ticket on {preview?.customer}
            {preview?.wo ? ` takes ${preview.wo}` : ""}, the tech, the dates, the work done, the notes, the P.O.s, the WO part lines and the Corrigo
            fields. Its status will be {preview?.ticketStatus} (the PM is {preview?.pmStatus}). PMs keep no Corrigo net: the ticket&apos;s comes with the
            next Corrigo import.
          </DialogDescription>
          <div className="mt-3 space-y-2 text-sm">
            <p>The PM stays as a closed record that points at the ticket. Nothing is deleted, and an Admin can move it back from the ticket.</p>
            {preview?.stays.length ? <p className="text-muted-foreground">Stays on the PM: {preview.stays.join(", ")}.</p> : null}
            {preview?.refusal ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2" data-testid="pm-move-refusal">
                {preview.refusal}
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={!!preview?.refusal || move.isPending} onClick={() => preview && move.mutate(preview)} data-testid="pm-move-confirm">
              Move to service ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** On a ticket made from a PM: where it came from, and Move back for an Admin. */
export function MovedFromPmBanner({ job, onMovedBack }: { job: ServiceJob; onMovedBack: () => void }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const info = useQuery({
    queryKey: ["pm-move", job.id],
    queryFn: () => getPmMoveInfo({ data: { jobId: job.id } }),
    enabled: !!job.movedFromPmId,
  });
  const [asking, setAsking] = useState(false);
  const back = useMutation({
    mutationFn: () => undoPmMove({ data: { jobId: job.id, stamp: info.data!.stamp } }),
    onSuccess: (r) => {
      toast.success(`Moved back to PM #${r.pmId}`);
      setAsking(false);
      refreshAll(qc);
      void qc.invalidateQueries({ queryKey: ["pm-move", job.id] });
      onMovedBack();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't move it back"),
  });
  const m = info.data;
  if (!job.movedFromPmId || !m) return null;
  const admin = isDeskAdmin(me.data);
  return (
    <div className="border-b border-border bg-muted/40 px-5 py-3 text-sm" data-testid="moved-from-pm">
      <p>
        Moved from{" "}
        <OpenLink entityType="pm" id={m.pmId} className={LINK}>
          PM #{m.pmId}
        </OpenLink>{" "}
        on {formatLongDate(m.movedAt)}
        {m.movedBy ? ` by ${m.movedBy}` : ""}. Its photos, Ping notes and runbook checks stay on the PM.
      </p>
      {admin ? (
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              // A save in this card since it opened changed the ticket: the stamp is read again before Move back.
              void info.refetch();
              setAsking(true);
            }}
            data-testid="pm-move-back"
          >
            Move back to PM…
          </Button>
        </div>
      ) : null}
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent>
          <DialogTitle>Move back to PM #{m.pmId}</DialogTitle>
          <DialogDescription>
            The PM takes this ticket&apos;s WO, tech, status, dates, work done, notes, P.O.s and Corrigo fields as they are now, and goes back on the PM board.
            This ticket is closed as Cancelled, with a note saying where its work went. Nothing is deleted.
          </DialogDescription>
          {m.refusal ? (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm" data-testid="pm-move-back-refusal">
              {m.refusal}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!!m.refusal || back.isPending || info.isFetching} onClick={() => back.mutate()} data-testid="pm-move-back-confirm">
              Move back to PM
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
