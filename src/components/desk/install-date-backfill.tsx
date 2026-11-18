/**
 * Admin, on the Install Board: fill blank equipment Install dates from installs already done (Chuy, 11/18). The
 * preview lists every unit it would write, with the date and which one of the install's dates it is, and every unit it
 * skips and why. Nothing is written until Write. The rules are in install-date-fill.ts.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";
import { applyInstallDateBackfill, previewInstallDateBackfill, type InstallDateBackfillPreview } from "@/lib/ops/install-date-fill";
import { OpenLink } from "./open-link";

const LINK = "font-medium text-primary underline-offset-2 hover:underline";

export function InstallDateBackfillButton() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const [preview, setPreview] = useState<InstallDateBackfillPreview | null>(null);
  const read = useMutation({
    mutationFn: () => previewInstallDateBackfill(),
    onSuccess: (p) => setPreview(p),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't read the installs"),
  });
  const write = useMutation({
    mutationFn: () => applyInstallDateBackfill({ data: { unitIds: preview!.rows.map((r) => r.unitId) } }),
    onSuccess: (r) => {
      const left = preview!.rows.length - r.written.length;
      toast.success(`Install dates written on ${r.written.length} unit${r.written.length === 1 ? "" : "s"}${left ? `; ${left} changed since the preview and were left` : ""}`);
      setPreview(null);
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't write the install dates"),
  });
  if (!isDeskAdmin(me.data)) return null;
  const p = preview;
  return (
    <>
      <Button type="button" variant="outline" onClick={() => read.mutate()} disabled={read.isPending} data-testid="install-date-backfill">
        <CalendarCheck className="size-4" />
        {read.isPending ? "Reading…" : "Fill install dates…"}
      </Button>
      <Dialog open={!!p} onOpenChange={(o) => !o && !write.isPending && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Fill equipment install dates from installs</DialogTitle>
          <DialogDescription>
            Units an Installed install put on an account, with a blank Install date, take the install's completed date, or its scheduled date when
            that's blank. A date already set and a Locked unit are never changed. Nothing is written until you press Write.
          </DialogDescription>
          {p ? (
            <div className="mt-2 space-y-4 text-sm" data-testid="install-date-preview">
              <section>
                <h3 className="mb-1 font-medium">
                  Will write: {p.rows.length} unit{p.rows.length === 1 ? "" : "s"}
                </h3>
                {p.rows.length ? (
                  <div className="max-h-72 overflow-auto rounded border border-border">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1">Account</th>
                          <th className="px-2 py-1">Unit</th>
                          <th className="px-2 py-1">Install</th>
                          <th className="px-2 py-1">Install date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.rows.map((r) => (
                          <tr key={r.unitId} className="border-t border-border" data-testid="install-date-row">
                            <td className="px-2 py-1">{r.customer}</td>
                            <td className="px-2 py-1">
                              {r.equipment}
                              {r.serial ? <span className="text-muted-foreground"> · {r.serial}</span> : null}
                            </td>
                            <td className="px-2 py-1">
                              <OpenLink entityType="install" id={r.installId} className={LINK}>
                                #{r.installId}
                              </OpenLink>
                              {r.wo ? <span className="text-muted-foreground"> · {r.wo}</span> : null}
                            </td>
                            <td className="px-2 py-1">
                              {r.date} <span className="text-muted-foreground">({r.source === "completed" ? "completed" : "scheduled: no completed date"})</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nothing to write: every unit from an Installed install has its date.</p>
                )}
              </section>
              {p.skipped.length ? (
                <section>
                  <h3 className="mb-1 font-medium">Skipped: {p.skipped.length}</h3>
                  <ul className="max-h-40 overflow-auto rounded border border-border px-2 py-1" data-testid="install-date-skipped">
                    {p.skipped.map((r) => (
                      <li key={r.unitId} className="py-0.5">
                        {r.customer} · {r.equipment}
                        {r.serial ? ` · ${r.serial}` : ""} · install #{r.installId}: <span className="text-muted-foreground">{r.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={write.isPending}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => write.mutate()} disabled={!p.rows.length || write.isPending} data-testid="install-date-write">
                  {write.isPending ? "Writing…" : `Write ${p.rows.length} install date${p.rows.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
