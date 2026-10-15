import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Download, FileSpreadsheet, FileUp, Tags } from "lucide-react";
import { toast } from "sonner";
import { importPartBins, importPartPricing, importPartsNetsuite, partBinTemplate, type BinsPreview, type PartsPreview, type PricingPreview } from "@/lib/ops/part-pricing-api";
import { PRICE_TARGET_LABEL, type PriceTarget } from "@/lib/ops/part-pricing";
import { binText } from "@/lib/ops/part-bins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ActionButton } from "./desk-charts";
import { downloadBase64 } from "./export-dialog";
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

const EXCEL = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

/** File picker shared by the imports: Excel unless `accept` says otherwise (Bin Locations also takes CSV). */
function PickFile({ busy, onFile, testId, label, accept = EXCEL }: { busy: boolean; onFile: (f: File) => void; testId: string; label: string; accept?: string }) {
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
        accept={accept}
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

/** Approve (or Save) runs the import; Cancel closes the window and nothing is written. */
function ApprovalButtons({
  busy,
  canApprove,
  onApprove,
  onCancel,
  what,
  verb = "Approve",
}: {
  busy: boolean;
  canApprove: boolean;
  onApprove: () => void;
  onCancel: () => void;
  what: string;
  verb?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
      <span className="mr-auto text-xs text-muted-foreground">Nothing is written until you {verb.toLowerCase()}. Cancel changes nothing.</span>
      <Button type="button" variant="outline" disabled={busy} onClick={onCancel} data-testid="approval-cancel">
        Cancel
      </Button>
      <Button type="button" disabled={busy || !canApprove} onClick={onApprove} data-testid="approval-approve">
        {busy ? "Applying…" : `${verb} ${what}`}
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
  not_kept: { label: "Class not kept", tone: "outline" },
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
            The NetSuite item export: <span className="font-medium">Name</span> is the part number (MPN), <span className="font-medium">Description</span> is the
            part name (left blank when the file has none), and Base Price, Purchase Price and Inactive are kept. Only five classes are kept: Parts, Water Filters, Service, Equipment and Dispensers. A row in any other class is not added, and a part already listed in one is moved off the active list. A file with its own MPN column uses that column instead.
            Matched on the part number: one already on a part updates it, a new one adds a part. Never a second part for one part number. A hidden part is skipped and stays
            hidden. Blank cells change nothing.
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
                {preview.notKept ? <Badge variant="outline">Class not kept {preview.notKept}</Badge> : null}
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

const BIN_STATUS: Record<BinsPreview["lines"][number]["status"], { label: string; tone: "success" | "warn" | "danger" | "outline" }> = {
  update: { label: "Will Update", tone: "warn" },
  same: { label: "No Change", tone: "outline" },
  unmatched: { label: "Unmatched", tone: "danger" },
  ambiguous: { label: "Ambiguous", tone: "danger" },
  blank: { label: "Blank", tone: "outline" },
  duplicate: { label: "Same part twice", tone: "outline" },
  too_long: { label: "Too long", tone: "danger" },
  date: { label: "Looks like a date", tone: "danger" },
};

const BIN_FILES = `.csv,text/csv,${EXCEL}`;

/**
 * Bin Locations: a CSV or Excel file of part numbers with Rack, Shelf and Bin (or one Bin Location code). The
 * preview shows each row old → new; Save writes them. Download Bin Template gives every part with its bin now, to
 * fill in a spreadsheet and bring back.
 */
export function BinLocationsButton() {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<BinsPreview | null>(null);
  const close = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
  };
  const template = useMutation({
    mutationFn: () => partBinTemplate(),
    onSuccess: (r) => {
      downloadBase64(r.filename, "text/csv;charset=utf-8", r.base64);
      toast.success(
        r.more
          ? `Bin Template downloaded: the first ${r.rows.toLocaleString()} parts by SKU. The Parts list has more; a file with their part numbers still imports.`
          : `Bin Template downloaded: ${r.rows.toLocaleString()} part${r.rows === 1 ? "" : "s"}`,
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build the template"),
  });
  const read = useMutation({
    mutationFn: async (f: File) => {
      // The server takes up to 24,000,000 base64 characters, about 18 MB.
      if (f.size > 18_000_000) throw new Error("That file is too large.");
      const base64 = await fileToBase64(f);
      return { f: { name: f.name, base64 }, p: await importPartBins({ data: { filename: f.name, base64, apply: false } }) };
    },
    onSuccess: ({ f, p }) => {
      setFile(f);
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const save = useMutation({
    mutationFn: () => importPartBins({ data: { filename: file!.name, base64: file!.base64, apply: true } }),
    onSuccess: (r) => {
      toast.success(`${r.update} bin location${r.update === 1 ? "" : "s"} saved`);
      refresh();
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the bin locations"),
  });
  const show = (v: { rack: string | null; shelf: string | null; bin: string | null } | null) => (v ? (binText(v) ?? "Not set") : "—");
  return (
    <>
      <ActionButton icon={Boxes} menuLabel="Bin Locations" onClick={() => setOpen(true)} data-testid="bins-import-open">
        Bin Locations
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-3xl" data-testid="bins-import">
          <DialogTitle>Bin Locations</DialogTitle>
          <DialogDescription>
            A CSV or Excel file with a part number column (<span className="font-medium">MPN</span>, Part #, Mfr Part, or <span className="font-medium">SKU</span>, Name, Item) and{" "}
            <span className="font-medium">Rack</span>, <span className="font-medium">Shelf</span>, <span className="font-medium">Bin</span>. One Bin Location column works too: it is the whole location, so a code like A-03-12 or A/3/12 is split into rack, shelf and bin, and anything else becomes the bin with no rack or shelf.
            Matched on the part number the way the parts import matches. A blank cell keeps what is stored. Only parts on the Parts list are matched.
          </DialogDescription>
          {!preview ? (
            <div className="flex flex-wrap items-center gap-2">
              <PickFile busy={read.isPending} onFile={(f) => read.mutate(f)} testId="bins-import-file" label="Pick The CSV Or Excel File" accept={BIN_FILES} />
              <Button type="button" size="sm" variant="outline" disabled={template.isPending} onClick={() => template.mutate()} data-testid="bins-template">
                <Download className="size-4" />
                {template.isPending ? "Building…" : "Download Bin Template"}
              </Button>
            </div>
          ) : (
            <>
              <ApprovalHead filename={preview.filename} rowCount={preview.rowCount}>
                <Badge variant="warn" data-testid="bins-count-update">
                  Will Update {preview.update}
                </Badge>
                <Badge variant="outline" data-testid="bins-count-same">
                  No Change {preview.same}
                </Badge>
                <Badge variant="danger" data-testid="bins-count-unmatched">
                  Unmatched {preview.unmatched}
                </Badge>
                <Badge variant="danger" data-testid="bins-count-ambiguous">
                  Ambiguous {preview.ambiguous}
                </Badge>
                <Badge variant="outline" data-testid="bins-count-blank">
                  Blank {preview.blank}
                </Badge>
                {preview.duplicates ? <Badge variant="outline">Same part twice in file {preview.duplicates}</Badge> : null}
                {preview.tooLong ? <Badge variant="danger">Too long {preview.tooLong}</Badge> : null}
                {preview.dates ? (
                  <Badge variant="danger" data-testid="bins-count-date">
                    Looks like a date {preview.dates}
                  </Badge>
                ) : null}
                {preview.skipped ? <Badge variant="outline">No part number {preview.skipped}</Badge> : null}
              </ApprovalHead>
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">Part</th>
                      <th className="px-2 py-2 font-medium">Bin Now → New</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l, i) => (
                      <tr key={i} className={cn("border-b border-border align-top last:border-b-0", l.status === "unmatched" || l.status === "ambiguous" ? "text-muted-foreground" : "")} data-testid="bins-line" data-status={l.status}>
                        <td className="px-3 py-1.5">
                          <span className="font-medium break-all text-foreground">{l.ref}</span>
                          {l.description ? <span className="block text-xs break-words text-muted-foreground">{l.description}</span> : null}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {l.reason ? (
                            l.reason
                          ) : (
                            <>
                              <span className="text-muted-foreground" data-testid="bins-old">
                                {show(l.old)}
                              </span>
                              {" → "}
                              <span className="font-medium" data-testid="bins-new">
                                {show(l.next)}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge size="tight" variant={BIN_STATUS[l.status].tone}>
                            {BIN_STATUS[l.status].label}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {!preview.lines.length ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-muted-foreground">
                          Every row in the file is blank. Nothing would change.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <ApprovalButtons
                busy={save.isPending}
                canApprove={preview.update > 0}
                onApprove={() => save.mutate()}
                onCancel={close}
                verb="Save"
                what={`${preview.update} Bin Location${preview.update === 1 ? "" : "s"}`}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
