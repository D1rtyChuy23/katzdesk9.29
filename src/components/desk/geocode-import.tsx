import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, MapPin } from "lucide-react";
import { toast } from "sonner";
import { applyCustomerGeocodes, previewCustomerGeocodes, type GeocodePreview } from "@/lib/ops/customer-geocode-api";
import { reviewCsv, type GeoPlanLine } from "@/lib/ops/customer-geocode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ActionButton, FilterChip } from "./desk-charts";

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
  { id: "save", label: "Will Save", variant: "success" },
  { id: "same", label: "Already Saved", variant: "outline" },
  { id: "review", label: "Needs Review", variant: "warn" },
  { id: "no_location", label: "No Location", variant: "warn" },
  { id: "unmatched", label: "Unmatched", variant: "warn" },
  { id: "conflict", label: "Conflicts", variant: "danger" },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];

const STATUS_LABEL: Record<GeoPlanLine["status"], { label: string; variant: (typeof GROUPS)[number]["variant"] }> = {
  save: { label: "Will Save", variant: "success" },
  same: { label: "Already Saved", variant: "outline" },
  no_location: { label: "No Location", variant: "warn" },
  unmatched: { label: "Unmatched", variant: "warn" },
  conflict: { label: "Conflict", variant: "danger" },
};

function downloadReviewList(lines: GeoPlanLine[], filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "") || "Customer_Locations";
  const blob = new Blob([reviewCsv(lines)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stem}_Review.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Admin-only load of map locations from the Census-geocoded customer list. Shows what will save, what has no
 * location, and what needs a person first; nothing is saved until Save is pressed. The review list downloads as a CSV.
 */
export function GeocodeImportButton() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<GeocodePreview | null>(null);
  const [filename, setFilename] = useState("");
  const [group, setGroup] = useState<GroupId>("save");

  const read = useMutation({
    mutationFn: async (file: File) => previewCustomerGeocodes({ data: { filename: file.name, base64: await fileToBase64(file) } }),
    onSuccess: (p) => {
      setPreview(p);
      setGroup(p.counts.save ? "save" : p.counts.review ? "review" : "same");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const save = useMutation({
    mutationFn: () => applyCustomerGeocodes({ data: { rows: preview!.rows } }),
    onSuccess: (r) => {
      toast.success(`Saved ${r.saved} location${r.saved === 1 ? "" : "s"}`);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-address"] });
      setOpen(false);
      setPreview(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const lines = useMemo(
    () => (preview?.lines ?? []).filter((l) => (group === "review" ? l.review : l.status === group)),
    [preview, group],
  );

  return (
    <>
      <ActionButton icon={MapPin} menuLabel="Locations" onClick={() => setOpen(true)} data-testid="geo-import-open">
        Import Locations
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl" data-testid="geo-import">
          <DialogTitle>Import Locations</DialogTitle>
          <p className="text-sm text-muted-foreground">
            The geocoded customer list (CSV or Excel) with <span className="font-medium">Geocode Match</span>, <span className="font-medium">Latitude</span> and{" "}
            <span className="font-medium">Longitude</span> columns. Rows are matched by account number, then Internal ID, then name. Only the map location is
            saved; names and addresses are not changed. Nothing saves until you press Save.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={read.isPending} onClick={() => fileRef.current?.click()} data-testid="geo-import-pick">
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
              data-testid="geo-import-file"
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
              <div className="flex flex-wrap gap-2" data-testid="geo-import-counts">
                {GROUPS.map((g) => (
                  <FilterChip key={g.id} selected={group === g.id} onClick={() => setGroup(g.id)} data-testid={`geo-import-tab-${g.id}`}>
                    {g.label} {preview.counts[g.id]}
                  </FilterChip>
                ))}
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm" data-testid="geo-import-lines">
                  <thead className="sticky top-0 bg-card text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Line</th>
                      <th className="px-3 py-2 font-medium">In the file</th>
                      <th className="px-3 py-2 font-medium">KatzDesk account</th>
                      <th className="px-3 py-2 font-medium">Geocoder</th>
                      <th className="px-3 py-2 font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.slice(0, 500).map((l) => (
                      <tr key={l.line} className="border-t border-border align-top">
                        <td className="px-3 py-1.5 tabular text-muted-foreground">{l.line}</td>
                        <td className="px-3 py-1.5">
                          {l.name || "—"}
                          {l.address ? <span className="block text-xs text-muted-foreground">{l.address}</span> : null}
                        </td>
                        <td className="px-3 py-1.5">
                          {l.accountName ?? <span className="text-muted-foreground">No match</span>}
                          {l.matchedBy ? <span className="block text-xs text-muted-foreground">by {l.matchedBy}</span> : null}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {l.quality === "exact" ? "Exact" : l.quality === "close" ? "Close" : l.quality === "approx" ? "ZIP area" : l.result || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          <Badge size="tight" variant={STATUS_LABEL[l.status].variant} className="mr-1">
                            {STATUS_LABEL[l.status].label}
                          </Badge>
                          {group === "review" && l.reviewReason ? l.reviewReason : l.reason}
                        </td>
                      </tr>
                    ))}
                    {lines.length > 500 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-xs text-muted-foreground">
                          Showing the first 500 of {lines.length}. The review list download has every row that needs a person.
                        </td>
                      </tr>
                    ) : null}
                    {!lines.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-muted-foreground">Nothing here.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mr-auto"
                  disabled={!preview.counts.review}
                  onClick={() => downloadReviewList(preview.lines, filename)}
                  data-testid="geo-import-review-download"
                >
                  <Download className="size-4" />
                  Download Review List ({preview.counts.review})
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={!preview.counts.save || save.isPending} onClick={() => save.mutate()} data-testid="geo-import-save">
                  {save.isPending ? "Saving…" : `Save ${preview.counts.save} Location${preview.counts.save === 1 ? "" : "s"}`}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
