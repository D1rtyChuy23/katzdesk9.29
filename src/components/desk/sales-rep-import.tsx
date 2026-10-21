import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Users } from "lucide-react";
import { toast } from "sonner";
import { applySalesReps, previewSalesReps, type SalesRepPreview } from "@/lib/ops/sales-reps-api";
import type { SalesRepPlanLine } from "@/lib/ops/sales-reps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ActionButton, FilterChip } from "./desk-charts";
import { cn } from "@/lib/utils";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

const GROUPS = [
  { id: "update", label: "Will Update", variant: "success" },
  { id: "same", label: "No Change", variant: "outline" },
  { id: "unmatched", label: "Unmatched", variant: "warn" },
  { id: "unknown", label: "Unknown Rep", variant: "warn" },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];

const STATUS_LABEL: Record<SalesRepPlanLine["status"], { label: string; variant: (typeof GROUPS)[number]["variant"] }> = {
  update: { label: "Will Update", variant: "success" },
  same: { label: "No Change", variant: "outline" },
  unmatched: { label: "Unmatched", variant: "warn" },
  unknown: { label: "Unknown Rep", variant: "warn" },
};

/** Admin-only load of NetSuite sales reps. Nothing is saved until Save is pressed, and no user is created. */
export function SalesRepImportButton() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SalesRepPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [group, setGroup] = useState<GroupId>("update");

  const read = useMutation({
    mutationFn: async (file: File) => previewSalesReps({ data: { filename: file.name, base64: await fileToBase64(file) } }),
    onSuccess: (p) => {
      setPreview(p);
      setGroup(p.counts.update ? "update" : p.counts.unknown ? "unknown" : p.counts.same ? "same" : "unmatched");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const saving = preview?.lines.filter((l) => l.willSave).length ?? 0;
  const save = useMutation({
    mutationFn: () => applySalesReps({ data: { files: preview!.files } }),
    onSuccess: (r) => {
      toast.success(r.saved ? `Saved sales reps on ${r.saved} account${r.saved === 1 ? "" : "s"}` : "Nothing to save");
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      setOpen(false);
      setPreview(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const lines = useMemo(() => (preview?.lines ?? []).filter((l) => l.status === group), [preview, group]);

  return (
    <>
      <ActionButton icon={Users} menuLabel="Sales Reps" onClick={() => setOpen(true)} data-testid="sales-rep-import-open">
        Import Sales Reps
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl" data-testid="sales-rep-import">
          <DialogTitle>Import Sales Reps</DialogTitle>
          <p className="text-sm text-muted-foreground">
            A NetSuite customer export (CSV or Excel) with <span className="font-medium">Internal ID</span>,{" "}
            <span className="font-medium">Account Number</span>, <span className="font-medium">Customer Name</span>,{" "}
            <span className="font-medium">Primary Sales Rep</span>, and the reps on the account (name, role, %, primary).
            Matched by Internal ID, then account number, then exact name. Primary Sales Rep changes only when the
            account’s rep is blank or the file names a different one. A name that is not a Katz Desk user is listed and
            never turned into a user. Nothing saves until you press Save.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={read.isPending} onClick={() => fileRef.current?.click()} data-testid="sales-rep-import-pick">
              <FileUp className="size-4" />
              {read.isPending ? "Reading…" : preview ? "Pick Another File" : "Pick A File"}
            </Button>
            {filename ? <span className="text-xs text-muted-foreground">{filename}</span> : null}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="sales-rep-import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) {
                  setFilename(f.name);
                  read.mutate(f);
                }
              }}
            />
          </div>
          {preview ? (
            <>
              <div className="flex flex-wrap gap-2" data-testid="sales-rep-import-counts">
                {GROUPS.map((g) => (
                  <FilterChip key={g.id} selected={group === g.id} onClick={() => setGroup(g.id)} data-testid={`sales-rep-import-tab-${g.id}`}>
                    {g.label} {preview.counts[g.id]}
                  </FilterChip>
                ))}
              </div>
              <div className="overflow-y-auto rounded-lg border border-border sm:max-h-80">
                <table className="w-full text-sm max-sm:block" data-testid="sales-rep-import-lines">
                  <thead className="sticky top-0 bg-card text-left text-[11px] tracking-wide text-muted-foreground uppercase max-sm:hidden">
                    <tr>
                      <th className="px-3 py-2 font-medium">Line</th>
                      <th className="px-3 py-2 font-medium">In the file</th>
                      <th className="px-3 py-2 font-medium">KatzDesk account</th>
                      <th className="px-3 py-2 font-medium">Primary</th>
                      <th className="px-3 py-2 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody className="max-sm:block">
                    {lines.slice(0, 500).map((l) => {
                      const tone = STATUS_LABEL[l.status];
                      return (
                        <tr key={`${l.line}-${l.accountId ?? "x"}`} className="border-t border-border align-top max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:px-3 max-sm:py-2.5 max-sm:first:border-t-0">
                          <td className="px-3 py-1.5 tabular text-muted-foreground max-sm:p-0 max-sm:text-xs">{l.line}</td>
                          <td className="px-3 py-1.5 max-sm:p-0 max-sm:break-words">
                            <span className="max-sm:font-medium">{l.name || l.accountNumber || l.internalId || "—"}</span>
                            <span className="block text-xs text-muted-foreground">
                              {l.reps.map((r) => r.storedName).filter(Boolean).join(", ") || "No reps"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 max-sm:p-0">
                            {l.accountName ?? "—"}
                            {l.matchedBy ? <span className="block text-xs text-muted-foreground">by {l.matchedBy}</span> : null}
                          </td>
                          <td className="px-3 py-1.5 max-sm:p-0">
                            <Badge variant={tone.variant} size="tight">{tone.label}</Badge>
                            {l.primaryChange ? (
                              <span className="mt-1 block text-xs">
                                {l.currentPrimary || "blank"} → {l.nextPrimary}
                              </span>
                            ) : (
                              <span className="mt-1 block text-xs text-muted-foreground">{l.currentPrimary || "blank"}</span>
                            )}
                          </td>
                          <td className={cn("px-3 py-1.5 text-xs text-muted-foreground max-sm:p-0", l.status === "unknown" && "text-warning")}>{l.reason}</td>
                        </tr>
                      );
                    })}
                    {!lines.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing in this group.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button type="button" disabled={!saving || save.isPending} onClick={() => save.mutate()} data-testid="sales-rep-import-save">
                  {save.isPending ? "Saving…" : `Save ${saving.toLocaleString()} Account${saving === 1 ? "" : "s"}`}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
