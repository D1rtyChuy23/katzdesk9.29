/**
 * Admin: Normalize serials (11/19). The preview lists every unit whose serial would be stored uppercase and keyed for
 * matching, from what to what, and any other account with the same serial. Nothing is written until Write.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CaseUpper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";
import { applySerialNormalize, previewSerialNormalize, type SerialNormalizeRow } from "@/lib/ops/serial-normalize";

export function SerialNormalizeButton() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const [rows, setRows] = useState<SerialNormalizeRow[] | null>(null);
  const read = useMutation({
    mutationFn: () => previewSerialNormalize(),
    onSuccess: (p) => setRows(p.rows),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't read the serials"),
  });
  const write = useMutation({
    mutationFn: () => applySerialNormalize({ data: { rows: rows!.filter((r) => !r.locked).map((r) => ({ unitId: r.unitId, oldSerial: r.oldSerial })) } }),
    onSuccess: (r) => {
      const asked = rows!.filter((x) => !x.locked).length;
      const changed = asked - r.written.length - r.refused.length;
      toast.success(
        `Serials normalized on ${r.written.length} unit${r.written.length === 1 ? "" : "s"}` +
          (r.refused.length ? `; ${r.refused.length} left because another unit has that serial (Same serial on …)` : "") +
          (changed > 0 ? `; ${changed} changed since the preview and were left` : ""),
      );
      setRows(null);
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't write the serials"),
  });
  if (!isDeskAdmin(me.data)) return null;
  const writable = rows?.filter((r) => !r.locked).length ?? 0;
  return (
    <>
      <Button type="button" variant="outline" onClick={() => read.mutate()} disabled={read.isPending} data-testid="serial-normalize">
        <CaseUpper className="size-4" />
        {read.isPending ? "Reading…" : "Normalize serials…"}
      </Button>
      <Dialog open={!!rows} onOpenChange={(o) => !o && !write.isPending && setRows(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Normalize serials</DialogTitle>
          <DialogDescription>
            Each unit's serial is stored uppercase, and given its matching key where it has none, so a serial matches whatever its case or spacing.
            Locked units are left. Nothing is written until you press Write.
          </DialogDescription>
          {rows ? (
            <div className="mt-2 space-y-3 text-sm" data-testid="serial-normalize-preview">
              {rows.length ? (
                <div className="max-h-80 overflow-auto rounded border border-border">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1">Account</th>
                        <th className="px-2 py-1">Unit</th>
                        <th className="px-2 py-1">Serial</th>
                        <th className="px-2 py-1">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.unitId} className="border-t border-border" data-testid="serial-normalize-row">
                          <td className="px-2 py-1">{r.customer}</td>
                          <td className="px-2 py-1">{r.equipment}</td>
                          <td className="px-2 py-1">
                            {r.oldSerial === r.newSerial ? r.newSerial : `${r.oldSerial} → ${r.newSerial}`}
                            {r.oldKey !== r.newKey && r.oldSerial === r.newSerial ? <span className="text-muted-foreground"> (matching key added)</span> : null}
                          </td>
                          <td className="px-2 py-1 text-xs text-muted-foreground">
                            {[r.locked ? "Locked: left" : null, r.alsoOn.length ? `Same serial on ${r.alsoOn.join(", ")}` : null].filter(Boolean).join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">Every serial is already normalized.</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRows(null)} disabled={write.isPending}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => write.mutate()} disabled={!writable || write.isPending} data-testid="serial-normalize-write">
                  {write.isPending ? "Writing…" : `Write ${writable} serial${writable === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
