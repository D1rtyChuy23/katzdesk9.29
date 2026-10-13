import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportBilling, importBillingItems, type BillingExport, type ItemImportPreview } from "@/lib/ops/charges-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { ActionButton } from "./desk-charts";

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

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * Admin: drop a NetSuite item export or a price list (CSV or Excel). Shows price changes, new items and anything
 * that did not match first; nothing saves until Save. A file of just Name and Base Price only moves prices.
 */
export function ItemListImportButton() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<ItemImportPreview | null>(null);

  const read = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      const p = await importBillingItems({ data: { filename: f.name, base64, apply: false } });
      return { f, base64, p };
    },
    onSuccess: ({ f, base64, p }) => {
      setFile({ name: f.name, base64 });
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const writes = preview ? preview.added + preview.priceChanged + preview.otherChanged : 0;
  const save = useMutation({
    mutationFn: () => importBillingItems({ data: { filename: file!.name, base64: file!.base64, apply: true } }),
    onSuccess: (r) => {
      toast.success(`Saved: ${r.priceChanged} price change${r.priceChanged === 1 ? "" : "s"}, ${r.added} new, ${r.otherChanged} other`);
      void qc.invalidateQueries({ queryKey: ["billing-items"] });
      setOpen(false);
      setPreview(null);
      setFile(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const statusLabel = { new: "New", price: "Price", other: "Other", missing: "Not found" } as const;

  return (
    <>
      <ActionButton icon={Upload} menuLabel="Items & Prices" onClick={() => setOpen(true)} data-testid="items-import-open">
        Import Items &amp; Prices
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setPreview(null);
            setFile(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl" data-testid="items-import">
          <DialogTitle>Items &amp; Prices</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Drop the NetSuite item export, or a price list with a header row: <span className="font-medium">Name</span> (the SKU) and{" "}
            <span className="font-medium">Base Price</span>. Every sheet is read. Columns the file does not have, and blank cells, never change
            what is saved, so a Name + Base Price file only moves prices. Items are never deleted.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={read.isPending} onClick={() => fileRef.current?.click()}>
              <FileUp className="size-4" />
              {read.isPending ? "Reading…" : preview ? "Pick Another File" : "Pick A CSV Or Excel File"}
            </Button>
            {file ? <span className="text-xs text-muted-foreground">{file.name}</span> : null}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="items-import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) read.mutate(f);
              }}
            />
          </div>
          {preview ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm" data-testid="items-import-counts">
                <Badge variant="warn">Price changes {preview.priceChanged}</Badge>
                <Badge variant="success">New {preview.added}</Badge>
                <Badge variant="outline">Other changes {preview.otherChanged}</Badge>
                <Badge variant="outline">No change {preview.same}</Badge>
                {preview.notFound ? <Badge variant="danger">Not found {preview.notFound}</Badge> : null}
                {preview.skipped ? <Badge variant="outline">Skipped {preview.skipped}</Badge> : null}
              </div>
              {preview.checkCount ? (
                <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                  <span className="font-medium">{preview.checkCount} price{preview.checkCount === 1 ? "" : "s"} move by 50% or more.</span> They
                  are listed first. Look them over before saving, a misplaced decimal is easy to miss.
                </p>
              ) : null}
              {preview.notFound ? (
                <p className="text-xs text-muted-foreground">
                  Not found: these SKUs are not loaded and the file has no Description, so they are not created. Check the spelling, or drop
                  the full item export to add new items.
                </p>
              ) : null}
              {preview.ignoredSheets.length ? (
                <p className="text-xs text-muted-foreground">Left out (no Name column): {preview.ignoredSheets.join(", ")}.</p>
              ) : null}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm" data-testid="items-import-lines">
                  <thead className="sticky top-0 bg-card text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 text-right font-medium">Was</th>
                      <th className="px-3 py-2 text-right font-medium">Now</th>
                      <th className="px-3 py-2 text-right font-medium">Change</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((r) => (
                      <tr key={r.sku} className={`border-t border-border align-top ${r.check ? "bg-warning/10" : ""}`}>
                        <td className="px-3 py-1.5">
                          <span className="font-medium">{r.item}</span>
                          {r.description ? <span className="block max-w-xs truncate text-xs text-muted-foreground">{r.description}</span> : null}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular text-muted-foreground">{r.oldRate != null ? money(r.oldRate) : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular">{r.rate != null ? money(r.rate) : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular text-xs">
                          {r.pct != null ? `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%` : ""}
                        </td>
                        <td className="px-3 py-1.5 text-xs">{statusLabel[r.status]}</td>
                      </tr>
                    ))}
                    {!preview.sample.length ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-muted-foreground">Everything in this file is already up to date.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {preview.priceChanged + preview.added + preview.otherChanged + preview.notFound > preview.sample.length ? (
                <p className="text-xs text-muted-foreground">Showing the first {preview.sample.length}. Every change in the file is saved.</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={!writes || save.isPending} onClick={() => save.mutate()} data-testid="items-import-save">
                  {save.isPending ? "Saving…" : `Save ${writes} Change${writes === 1 ? "" : "s"}`}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function isoDay(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Charges ready for the billing script: completed tickets in a date range that have charges and no Sales Order yet. */
export function BillingExportButton() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(isoDay(weekAgo));
  const [to, setTo] = useState(isoDay(today));
  const [result, setResult] = useState<BillingExport | null>(null);

  const run = useMutation({
    mutationFn: () => exportBilling({ data: { from, to } }),
    onSuccess: (r) => setResult(r),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build the file"),
  });

  const download = () => {
    if (!result) return;
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-${from}_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <ActionButton icon={Download} onClick={() => setOpen(true)} data-testid="billing-export-open">
        Export Billing
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setResult(null);
        }}
      >
        <DialogContent className="sm:max-w-xl" data-testid="billing-export">
          <DialogTitle>Export Billing</DialogTitle>
          <p className="text-sm text-muted-foreground">
            One row per charge line for tickets completed in the range that have charges and no Sales Order yet. Hand the file to the billing
            script, then enter each Sales Order number on its ticket.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bill-from">Completed from</Label>
              <Input id="bill-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="bill-to">To</Label>
              <Input id="bill-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={!from || !to || run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? "Building…" : "Build File"}
            </Button>
          </div>
          {result ? (
            <div className="space-y-3" data-testid="billing-export-result">
              <p className="text-sm">
                <span className="font-medium">{result.tickets}</span> ticket{result.tickets === 1 ? "" : "s"},{" "}
                <span className="font-medium">{result.lines}</span> line{result.lines === 1 ? "" : "s"},{" "}
                <span className="font-medium">{money(result.total)}</span>
              </p>
              {result.noCharges.length ? (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                  <p className="font-medium">
                    {result.noCharges.length} completed ticket{result.noCharges.length === 1 ? "" : "s"} with no charges
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Nothing was billed on these. Check whether a bill was missed.</p>
                  <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs">
                    {result.noCharges.map((t) => (
                      <li key={t.id}>
                        {t.wo ?? `#${t.id}`} · {t.customer ?? "Untitled"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button type="button" size="sm" disabled={!result.lines} onClick={download}>
                  <Download className="size-4" />
                  Download CSV
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
