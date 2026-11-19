/**
 * Below an install's Equipment tab (11/19): what was taken off this install, with Put back; moves asked of an Admin,
 * with Confirm and Decline for an Admin; and the install's equipment history.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";
import { listRemovedInstallUnits, putBackRemovedInstallUnit } from "@/lib/ops/inspection-api";
import { answerMoveRequest, getMoveRequests } from "@/lib/ops/move-requests";
import { EquipmentHistoryList } from "./equipment-history-list";

export function InstallEquipmentRemoved({ installId }: { installId: number }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const admin = isDeskAdmin(me.data);
  const removed = useQuery({ queryKey: ["install-removed", installId], queryFn: () => listRemovedInstallUnits({ data: { installId } }) });
  const moves = useQuery({ queryKey: ["move-requests", installId], queryFn: () => getMoveRequests({ data: { installId } }) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["install-removed", installId] });
    void qc.invalidateQueries({ queryKey: ["move-requests", installId] });
    void qc.invalidateQueries({ queryKey: ["installs"] });
    void qc.invalidateQueries({ queryKey: ["inspection"] });
    void qc.invalidateQueries({ queryKey: ["account-equipment"] });
    void qc.invalidateQueries({ queryKey: ["equipment-history"] });
  };
  const putBack = useMutation({
    mutationFn: (id: number) => putBackRemovedInstallUnit({ data: { id } }),
    onSuccess: () => {
      toast.success("Put back on this install");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not put it back"),
  });
  const answer = useMutation({
    mutationFn: (v: { id: number; confirm: boolean }) => answerMoveRequest({ data: v }),
    onSuccess: (r) => {
      toast.success(r.notice);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not answer that move"),
  });
  return (
    <div className="mt-5 space-y-4" data-testid="install-equipment-extra">
      {moves.data?.length ? (
        <section data-testid="install-move-requests">
          <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Moves asked of an Admin</h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {moves.data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid="install-move-request">
                <span>
                  SN {m.serial} from {m.fromCustomer} to this install
                  <span className="text-muted-foreground">
                    {" "}
                    · asked by {m.askedBy} {m.askedAt}
                  </span>
                </span>
                {admin ? (
                  <span className="flex gap-1">
                    <Button type="button" size="sm" onClick={() => answer.mutate({ id: m.id, confirm: true })} disabled={answer.isPending} data-testid="move-confirm">
                      Move it
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => answer.mutate({ id: m.id, confirm: false })} disabled={answer.isPending} data-testid="move-decline">
                      Decline
                    </Button>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Waiting for an Admin</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {removed.data?.length ? (
        <section data-testid="install-removed">
          <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Removed</h3>
          <p className="mt-1 text-xs text-muted-foreground">Taken off this install. Put back returns the row, and the checks and photos it had here.</p>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {removed.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid="install-removed-row">
                <span>
                  {r.equipment}
                  {r.serial ? ` · SN ${r.serial}` : ""}
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.removedAt}
                    {r.removedBy ? ` by ${r.removedBy}` : ""}
                    {r.records ? ` · ${r.records} record${r.records === 1 ? "" : "s"} kept` : ""}
                  </span>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => putBack.mutate(r.id)} disabled={putBack.isPending} data-testid="install-put-back">
                  Put back
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <EquipmentHistoryList installId={installId} />
    </div>
  );
}
