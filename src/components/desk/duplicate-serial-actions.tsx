import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";
import { canMergeUnits, mergeRefusal } from "@/lib/ops/account-equip";
import { mergeAccountEquipment, removeAccountEquipment } from "@/lib/ops/account-equip-import";
import type { DuplicateSerial } from "@/lib/ops/account-equip-retire";
import { MergeDialog, type UnitRow } from "./account-history";

type Unit = DuplicateSerial["units"][number];

const asRow = (u: Unit): UnitRow => ({
  id: u.id,
  catalogModel: u.catalogModel,
  equipmentName: u.equipmentName,
  serial: u.serial,
  installDate: u.installDate,
  ownership: u.ownership,
  partNumber: u.partNumber,
  condition: u.condition,
  lockedBy: u.lockedBy,
});
const asMerge = (u: Unit) => ({ customer: u.customer, catalogModel: u.catalogModel, equipmentName: u.equipmentName, serial: u.serial, lockedBy: u.lockedBy, locked: u.locked });

/**
 * Clear a duplicate serial from the list (Chuy, 11/23: "lets do duplicates first"), with the account's own Merge and
 * Remove, for an Admin: Merge where Merge's rule allows it (the same machine twice on one account), Remove for the unit
 * that's wrong (it goes to that account's Retired list, where Put back returns it). Each is asked first.
 */
export function DuplicateSerialActions({ group }: { group: DuplicateSerial }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const [merging, setMerging] = useState<{ keep: Unit; drop: Unit } | null>(null);
  const [removing, setRemoving] = useState<Unit | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["duplicate-serials"] });
    void qc.invalidateQueries({ queryKey: ["account-equipment"] });
    void qc.invalidateQueries({ queryKey: ["account-equipment-retired"] });
    void qc.invalidateQueries({ queryKey: ["ticket-units"] });
    void qc.invalidateQueries({ queryKey: ["unit-service-history"] });
    void qc.invalidateQueries({ queryKey: ["ticket-unit-suggestions"] });
    void qc.invalidateQueries({ queryKey: ["inspection"] });
    void qc.invalidateQueries({ queryKey: ["installs"] });
  };
  const merge = useMutation({
    mutationFn: (d: { keepId: number; dropId: number }) => mergeAccountEquipment({ data: d }),
    onSuccess: () => {
      toast.success("Merged into one unit");
      setMerging(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not merge"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => removeAccountEquipment({ data: { id } }),
    onSuccess: () => {
      toast.success("Moved to that account's Retired list");
      setRemoving(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
  if (!isDeskAdmin(me.data)) return null;
  const units = group.units;
  // Each pair Merge allows: the same machine twice on one account. One button per pair, on the unit that would stay.
  const pairs: { keep: Unit; drop: Unit }[] = [];
  for (let i = 0; i < units.length; i++)
    for (let j = i + 1; j < units.length; j++) if (canMergeUnits(asMerge(units[i]!), asMerge(units[j]!))) pairs.push({ keep: units[i]!, drop: units[j]! });
  // Why a same-account pair can't merge (a different model, a lock), so the next step is clear.
  const blocked = [] as string[];
  for (let i = 0; i < units.length; i++)
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i]!;
      const b = units[j]!;
      if (a.customer.trim().toLowerCase() !== b.customer.trim().toLowerCase()) continue;
      const why = mergeRefusal(asMerge(a), asMerge(b));
      if (why) blocked.push(why);
    }
  const label = (u: Unit) => `${u.equipmentName || u.catalogModel} on ${u.customer}`;
  return (
    <div className="mt-3 border-t border-border pt-3" data-testid="duplicate-serial-actions">
      <div className="flex flex-wrap gap-2">
        {pairs.map((p) => (
          <Button
            key={`${p.keep.id}-${p.drop.id}`}
            type="button"
            size="sm"
            variant="outline"
            disabled={merge.isPending}
            onClick={() => setMerging(p)}
            data-testid="duplicate-merge"
            title={`One machine twice on ${p.keep.customer}: keep one, the other goes to Retired`}
          >
            Merge on {p.keep.customer}
          </Button>
        ))}
        {units.map((u) => (
          <Button
            key={u.id}
            type="button"
            size="sm"
            variant="ghost"
            disabled={u.locked || remove.isPending}
            onClick={() => setRemoving(u)}
            data-testid="duplicate-remove"
            title={u.locked ? "Locked: unlock it on the account first" : `Remove ${label(u)}`}
          >
            Remove from {u.customer}
          </Button>
        ))}
      </div>
      {blocked.length ? <p className="mt-2 text-xs text-muted-foreground">{[...new Set(blocked)].join(" ")}</p> : null}
      {merging ? (
        <MergeDialog
          keep={asRow(merging.keep)}
          drop={asRow(merging.drop)}
          busy={merge.isPending}
          onCancel={() => setMerging(null)}
          onMerge={() => merge.mutate({ keepId: merging.keep.id, dropId: merging.drop.id })}
          onSwap={() => setMerging({ keep: merging.drop, drop: merging.keep })}
        />
      ) : null}
      {removing ? (
        <Dialog open onOpenChange={(o) => (o ? null : setRemoving(null))}>
          <DialogContent className="p-4 sm:max-w-md" data-testid="duplicate-remove-confirm">
            <DialogTitle>Remove this unit?</DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              {label(removing)}, SN {removing.serial ?? group.serialKey}, goes to {removing.customer}'s Retired list, with its records. Put back there returns it.
            </DialogDescription>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(removing.id)} data-testid="duplicate-remove-yes">
                {remove.isPending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
