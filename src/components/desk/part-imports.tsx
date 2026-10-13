import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileUp, Tags } from "lucide-react";
import { toast } from "sonner";
import { importPartPricing, importPartsNetsuite, type PartsPreview, type PricingPreview } from "@/lib/ops/part-pricing-api";
import { PRICE_TARGET_LABEL, type PriceTarget } from "@/lib/ops/part-pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ActionButton } from "./desk-charts";
import { cn } from "@/lib/utils";

const money = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));

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

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["parts", "billing-items", "charges", "parts-profit"]) void qc.invalidateQueries({ queryKey: [key] });
  };
}

/** File picker shared by both imports: Excel only. */
function PickFile({ busy, onFile, testId, label }: { busy: boolean; onFile: (f: File) => void; testId: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        <FileUp className="size-4" />
        {busy ? "Reading…" : label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={testId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </>
  );
}

/** The approval window's head: file name, row count, and the counts of what will change. */
function ApprovalHead({ filename, rowCount, children }: { filename: string; rowCount: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3" data-testid="approval-head">
      <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">File</dt>
        <dd className="font-medium break-all" data-testid="approval-file">
          {filename}
        </dd>
        <dt className="text-muted-foreground">Rows</dt>
        <dd className="font-medium tabular" data-testid="approval-rows">
          {rowCount.toLocaleString()}
        </dd>
        <dt className="text-muted-foreground">What will change</dt>
        <dd className="flex flex-wrap gap-1.5" data-testid="approval-changes">
          {children}
        </dd>
      </dl>
    </div>
  );
}

/** Approve runs the import; Cancel closes the window and nothing is written. */
function ApprovalButtons({ busy, canApprove, onApprove, onCancel, what }: { busy: boolean; canApprove: boolean; onApprove: () => void; onCancel: () => void; what: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
      <span className="mr-auto text-xs text-muted-foreground">Nothing is written until you approve. Cancel changes nothing.</span>
      <Button type="button" variant="outline" disabled={busy} onClick={onCancel} data-testid="approval-cancel">
        Cancel
      </Button>
      <Button type="button" disabled={busy || !canApprove} onClick={onApprove} data-testid="approval-approve">
        {busy ? "Applying…" : `Approve ${what}`}
      </Button>
    </div>
  );
}

const PART_STATUS: Record<PartsPreview["lines"][number]["status"], { label: string; tone: "success" | "warn" | "danger" | "outline" }> = {
  new: { label: "New", tone: "success" },
  update: { label: "Update", tone: "warn" },
  same: { label: "No change", tone: "outline" },
  shared_mpn: { label: "Not applied", tone: "danger" },
  sku_taken: { label: "Not applied", tone: "danger" },
  hidden: { label: "Hidden, skipped", tone: "outline" },
};

/** Import Parts (NetSuite): an Excel export matched on MPN. Opens the approval window; nothing is written before Approve. */
export function ImportPartsButton() {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<PartsPreview | null>(null);
  const close = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
  };
  const read = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return { f: { name: f.name, base64 }, p: await importPartsNetsuite({ data: { filename: f.name, base64, apply: false } }) };
    },
    onSuccess: ({ f, p }) => {
      setFile(f);
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const approve = useMutation({
    mutationFn: () => importPartsNetsuite({ data: { filename: file!.name, base64: file!.base64, apply: true } }),
    onSuccess: (r) => {
      toast.success(`Parts imported: ${r.added} added, ${r.updated} updated`);
      refresh();
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not import"),
  });
  return (
    <>
      <ActionButton icon={FileSpreadsheet} menuLabel="Import Parts (NetSuite)" onClick={() => setOpen(true)} data-testid="parts-import-open">
        Import Parts (NetSuite)
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-3xl" data-testid="parts-import">
          <DialogTitle>Import Parts (NetSuite)</DialogTitle>
          <DialogDescription>
            An Excel export with an <span className="font-medium">MPN</span> column (plus Name, Description, Base Price, Purchase Price if you have them). Matched on
            MPN: an MPN already on a part updates it, a new MPN adds a part. Never a second part for one MPN. A hidden part is skipped and stays hidden. Blank cells change nothing.
          </DialogDescription>
          {!preview ? (
            <div>
              <PickFile busy={read.isPending} onFile={(f) => read.mutate(f)} testId="parts-import-file" label="Pick The Excel File" />
            </div>
          ) : (
            <>
              <ApprovalHead filename={preview.filename} rowCount={preview.rowCount}>
                <Badge variant="success">Add {preview.added}</Badge>
                <Badge variant="warn">Update {preview.updated}</Badge>
                <Badge variant="outline">No change {preview.same}</Badge>
                {preview.notApplied ? <Badge variant="danger">Not applied {preview.notApplied}</Badge> : null}
                {preview.hiddenSkipped ? (
                  <Badge variant="outline" data-testid="import-hidden-skipped">
                    Hidden, skipped {preview.hiddenSkipped}
                  </Badge>
                ) : null}
                {preview.duplicatesInFile ? <Badge variant="outline">Same MPN twice in file {preview.duplicatesInFile}</Badge> : null}
                {preview.skipped ? <Badge variant="outline">No MPN {preview.skipped}</Badge> : null}
              </ApprovalHead>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">MPN</th>
                      <th className="px-2 py-2 font-medium">SKU</th>
                      <th className="px-2 py-2 font-medium">Change</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0 align-top" data-testid="parts-import-line" data-status={l.status}>
                        <td className="px-3 py-1.5 font-medium">{l.mpn}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{l.sku}</td>
                        <td className="px-2 py-1.5 text-xs">{l.reason ?? l.changes.join(" · ")}</td>
                        <td className="px-3 py-1.5">
                          <Badge size="tight" variant={PART_STATUS[l.status].tone}>
                            {PART_STATUS[l.status].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {!preview.lines.length ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-muted-foreground">
                          Every part in the file already matches. Nothing would change.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <ApprovalButtons busy={approve.isPending} canApprove={preview.added + preview.updated > 0} onApprove={() => approve.mutate()} onCancel={close} what="Import" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const PRICE_STATUS: Record<PricingPreview["lines"][number]["status"], { label: string; tone: "success" | "warn" | "danger" | "outline" }> = {
  change: { label: "Change", tone: "warn" },
  same: { label: "No change", tone: "outline" },
  no_match: { label: "No Match", tone: "danger" },
  shared_mpn: { label: "Shared MPN", tone: "danger" },
  hidden: { label: "Hidden, skipped", tone: "outline" },
};

/** Update Part Pricing: an Excel file of MPN and price. Preview MPN, old and new price; Approve writes the prices. */
export function UpdatePricingButton() {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PriceTarget>("list");
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<PricingPreview | null>(null);
  const close = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
  };
  const read = useMutation({
    mutationFn: async (d: { f: { name: string; base64: string }; target: PriceTarget }) => ({
      f: d.f,
      p: await importPartPricing({ data: { filename: d.f.name, base64: d.f.base64, apply: false, target: d.target } }),
    }),
    onSuccess: ({ f, p }) => {
      setFile(f);
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const approve = useMutation({
    mutationFn: () => importPartPricing({ data: { filename: file!.name, base64: file!.base64, apply: true, target } }),
    onSuccess: (r) => {
      toast.success(`${r.changes} price${r.changes === 1 ? "" : "s"} updated (${r.targetLabel}). ${r.noMatch} No Match left out.`);
      refresh();
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update prices"),
  });
  const pickTarget = (t: PriceTarget) => {
    setTarget(t);
    if (file) read.mutate({ f: file, target: t });
  };
  return (
    <>
      <ActionButton icon={Tags} menuLabel="Update Part Pricing" onClick={() => setOpen(true)} data-testid="pricing-import-open">
        Update Part Pricing
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-3xl" data-testid="pricing-import">
          <DialogTitle>Update Part Pricing</DialogTitle>
          <DialogDescription>
            An Excel file with <span className="font-medium">MPN</span> and <span className="font-medium">Price</span> (a New Price column wins). Matched on MPN only.
            Rows with no matching MPN stay in the preview as No Match and are not applied. A hidden part is skipped: its price does not change and it stays hidden.
          </DialogDescription>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">This file's price is</p>
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Which price">
              {(["list", "sell"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={target === t}
                  disabled={read.isPending || approve.isPending}
                  onClick={() => pickTarget(t)}
                  className={cn("h-9 rounded-full px-3 text-sm font-medium disabled:opacity-60", target === t ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground")}
                  data-testid={`pricing-target-${t}`}
                >
                  {PRICE_TARGET_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {!preview ? (
            <div>
              <PickFile busy={read.isPending} onFile={async (f) => read.mutate({ f: { name: f.name, base64: await fileToBase64(f) }, target })} testId="pricing-import-file" label="Pick The Excel File" />
            </div>
          ) : (
            <>
              <ApprovalHead filename={preview.filename} rowCount={preview.rowCount}>
                <Badge variant="warn">
                  {preview.targetLabel} changes {preview.changes}
                </Badge>
                <Badge variant="outline">No change {preview.same}</Badge>
                <Badge variant="danger">No Match {preview.noMatch}</Badge>
                {preview.sharedMpn ? <Badge variant="danger">Shared MPN {preview.sharedMpn}</Badge> : null}
                {preview.hiddenSkipped ? (
                  <Badge variant="outline" data-testid="pricing-hidden-skipped">
                    Hidden, skipped {preview.hiddenSkipped}
                  </Badge>
                ) : null}
                {preview.duplicatesInFile ? <Badge variant="outline">Same MPN twice in file {preview.duplicatesInFile}</Badge> : null}
                {preview.skipped ? <Badge variant="outline">No MPN or price {preview.skipped}</Badge> : null}
              </ApprovalHead>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">MPN</th>
                      <th className="px-2 py-2 font-medium">Part</th>
                      <th className="px-2 py-2 text-right font-medium">Old Price</th>
                      <th className="px-2 py-2 text-right font-medium">New Price</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l, i) => (
                      <tr key={i} className={cn("border-b border-border last:border-b-0", l.status === "no_match" || l.status === "shared_mpn" ? "text-muted-foreground" : "")} data-testid="pricing-line" data-status={l.status}>
                        <td className="px-3 py-1.5 font-medium text-foreground">{l.mpn}</td>
                        <td className="max-w-[14rem] truncate px-2 py-1.5 text-xs">{l.sku ? `${l.sku}${l.description ? ` · ${l.description}` : ""}` : "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular" data-testid="pricing-old">
                          {money(l.oldPrice)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular font-medium" data-testid="pricing-new">
                          {money(l.newPrice)}
                          {l.pct != null && l.status === "change" ? <span className={cn("ml-1 text-[11px]", Math.abs(l.pct) >= 50 ? "text-destructive" : "text-muted-foreground")}>{l.pct > 0 ? `+${l.pct}` : l.pct}%</span> : null}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge size="tight" variant={PRICE_STATUS[l.status].tone}>
                            {PRICE_STATUS[l.status].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ApprovalButtons busy={approve.isPending || read.isPending} canApprove={preview.changes > 0} onApprove={() => approve.mutate()} onCancel={close} what={`${preview.changes} Price${preview.changes === 1 ? "" : "s"}`} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
