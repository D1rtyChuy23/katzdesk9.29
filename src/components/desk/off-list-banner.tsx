import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addInspectionUnitToList, getInstallInspection, removeInspectionEquipment, type InspectionView } from "@/lib/ops/inspection-api";
import { Button } from "@/components/ui/button";

/**
 * The Equipment tab's review of units only the Pre-inspection has. Each one is added to this list or taken off the
 * pre-inspection by someone choosing to; nothing is added on its own. Reads the same pre-inspection the tab beside it does.
 */
export function OffListBanner({ installId }: { installId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["inspection", installId],
    queryFn: () => getInstallInspection({ data: { installId } }),
  });
  const done = (view: InspectionView, message: string) => {
    qc.setQueryData(["inspection", installId], view);
    void qc.invalidateQueries({ queryKey: ["installs"] });
    void qc.invalidateQueries({ queryKey: ["unit-mismatches"] });
    toast.success(message);
  };
  const add = useMutation({
    mutationFn: (equipmentId: number) => addInspectionUnitToList({ data: { installId, equipmentId } }),
    onSuccess: (view) => done(view, "Added to the equipment list"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add it to the equipment list"),
  });
  const drop = useMutation({
    mutationFn: (equipmentId: number) => removeInspectionEquipment({ data: { installId, equipmentId } }),
    onSuccess: (view) => done(view, `${view.removed} removed from the pre-inspection`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove it"),
  });
  const off = (q.data?.machines ?? []).filter((m) => !m.onList);
  if (!off.length) return null;
  const busy = add.isPending || drop.isPending;
  return (
    <section aria-label="Machines on the pre-inspection only" className="border-b border-border bg-warning/5 px-4 py-3" data-testid="off-list-banner">
      <p className="text-sm font-medium">On the Pre-inspection only</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {off.length === 1 ? "This machine is" : "These machines are"} on this install's pre-inspection but not on its equipment list. Add each
        one here, or take it off the pre-inspection, so both tabs list the same machines.
      </p>
      <ul className="mt-2 grid gap-2">
        {off.map((m) => {
          const label = `${m.name}${m.serial ? ` · SN ${m.serial}` : ""}`;
          return (
            <li
              key={m.equipmentId}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              data-testid={`off-list-row-${m.equipmentId}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium break-words">{m.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[m.serial ? `SN ${m.serial}` : "No serial", m.electrical || null, `Pre-inspection ${m.overall.toLowerCase()}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Button type="button" size="sm" disabled={m.locked || busy} onClick={() => add.mutate(m.equipmentId)} data-testid={`off-list-add-${m.equipmentId}`}>
                Add to this list
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={m.locked || busy}
                onClick={() => {
                  if (!window.confirm(`Take ${label} off the pre-inspection? Its checks and photos for this visit go with it.`)) return;
                  drop.mutate(m.equipmentId);
                }}
                data-testid={`off-list-remove-${m.equipmentId}`}
              >
                Remove from pre-inspection
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
