import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { applyAccountNumbers, previewAccountNumbers, type AccountNumberPreview } from "@/lib/ops/account-numbers-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FilterChip } from "./desk-charts";

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
  { id: "match", label: "Will Save", variant: "success" },
  { id: "same", label: "Already Set", variant: "outline" },
  { id: "conflict", label: "Conflicts", variant: "danger" },
  { id: "unmatched", label: "Unmatched", variant: "warn" },
] as const;

/**
 * Admin-only bulk fill of Account Numbers from a CSV (customer name or ID, account_number). Shows matches,
 * conflicts and unmatched rows first; nothing is saved until Save is pressed, and only matched rows are saved.
 */
export function AccountNumberImportButton() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AccountNumberPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"]>("match");

  const read = useMutation({
    mutationFn: async (file: File) => previewAccountNumbers({ data: { filename: file.name, base64: await fileToBase64(file) } }),
    onSuccess: (p) => {
      setPreview(p);
      setGroup(p.counts.match ? "match" : p.counts.conflict ? "conflict" : p.counts.unmatched ? "unmatched" : "same");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const save = useMutation({
    mutationFn: () => applyAccountNumbers({ data: { rows: preview!.rows } }),
    onSuccess: (r) => {
      toast.success(`Saved ${r.saved} account number${r.saved === 1 ? "" : "s"}`);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["clean-names"] });
      setOpen(false);
      setPreview(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const lines = useMemo(() => (preview?.lines ?? []).filter((l) => l.status === group), [preview, group]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="acct-import-open">
        <FileUp className="size-4" />
        Import Account Numbers
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl" data-testid="acct-import">
          <DialogTitle>Import Account Numbers</DialogTitle>
          <p className="text-sm text-muted-foreground">
            A CSV with a header row: a customer column (customer name or the clean-list ID) and an <span className="font-medium">account_number</span> column.
            Numbers are kept exactly as typed, leading zeros included. Nothing saves until you press Save, and only the rows under Will Save are saved.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={read.isPending} onClick={() => fileRef.current?.click()} data-testid="acct-import-pick">
              <FileUp className="size-4" />
              {read.isPending ? "Reading…" : preview ? "Pick Another File" : "Pick A CSV File"}
            </Button>
            {filename ? <span className="text-xs text-muted-foreground">{filename}</span> : null}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="acct-import-file"
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
              <div className="flex flex-wrap gap-2" data-testid="acct-import-counts">
                {GROUPS.map((g) => (
                  <FilterChip key={g.id} selected={group === g.id} onClick={() => setGroup(g.id)} data-testid={`acct-import-${g.id}`}>
                    {g.label} {preview.counts[g.id]}
                  </FilterChip>
                ))}
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm" data-testid="acct-import-lines">
                  <thead className="sticky top-0 bg-card text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Line</th>
                      <th className="px-3 py-2 font-medium">In the file</th>
                      <th className="px-3 py-2 font-medium">Account #</th>
                      <th className="px-3 py-2 font-medium">KatzDesk account</th>
                      <th className="px-3 py-2 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.line} className="border-t border-border align-top">
                        <td className="px-3 py-1.5 tabular text-muted-foreground">{l.line}</td>
                        <td className="px-3 py-1.5">{l.customer || "—"}</td>
                        <td className="px-3 py-1.5 font-medium tabular">{l.accountNumber || "—"}</td>
                        <td className="px-3 py-1.5">{l.accountName ?? <span className="text-muted-foreground">No match</span>}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          <Badge size="tight" variant={GROUPS.find((g) => g.id === l.status)!.variant} className="mr-1">
                            {GROUPS.find((g) => g.id === l.status)!.label}
                          </Badge>
                          {l.reason}
                        </td>
                      </tr>
                    ))}
                    {!lines.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-muted-foreground">Nothing here.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-xs text-muted-foreground">
                  Conflicts and unmatched rows are not saved. Fix them in the file and read it again.
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={!preview.counts.match || save.isPending} onClick={() => save.mutate()} data-testid="acct-import-save">
                  {save.isPending ? "Saving…" : `Save ${preview.counts.match} Account Number${preview.counts.match === 1 ? "" : "s"}`}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
