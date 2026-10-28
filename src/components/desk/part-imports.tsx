import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, ClipboardList, Download, FileSpreadsheet, FileUp, ImagePlus, Tags } from "lucide-react";
import { toast } from "sonner";
import { importPartBins, importPartPricing, importPartsNetsuite, partBinTemplate, type BinsPreview, type PartsPreview, type PricingPreview } from "@/lib/ops/part-pricing-api";
import { PRICE_TARGET_LABEL, type PriceTarget } from "@/lib/ops/part-pricing";
import { binText } from "@/lib/ops/part-bins";
import { importPhotoResearch, type ResearchPreview } from "@/lib/ops/part-photo-research-api";
import { RESEARCH_MAX_ROWS, type ResearchPlanStatus } from "@/lib/ops/part-photo-research";
import { importWoPartLines, type WoLinesPreview } from "@/lib/ops/wo-part-lines-api";
import { LINE_SOURCE_LABEL, WO_LINES_MAX_ROWS, type WoLineStatus, type WoTicket } from "@/lib/ops/wo-part-lines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
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

const RESEARCH_STATUS: Record<ResearchPlanStatus, { label: string; tone: "success" | "warn" | "danger" | "outline" }> = {
  add: { label: "Will Add", tone: "success" },
  duplicate: { label: "Duplicate, skipped", tone: "outline" },
  no_match: { label: "No match, skipped", tone: "danger" },
  bad_url: { label: "Bad URL, skipped", tone: "danger" },
  bad_status: { label: "Bad status, skipped", tone: "danger" },
  no_key: { label: "No part number, skipped", tone: "danger" },
};

/** The counts, before Save and after it. */
function ResearchCountBadges({ p }: { p: ResearchPreview }) {
  return (
    <>
      <Badge variant="success" data-testid="research-count-add">
        {p.applied ? "Added" : "Will Add"} {p.add}
      </Badge>
      <Badge variant="outline" data-testid="research-count-duplicate">
        Duplicate, skipped {p.duplicate}
      </Badge>
      <Badge variant="danger" data-testid="research-count-nomatch">
        No match, skipped {p.noMatch}
      </Badge>
      <Badge variant="danger" data-testid="research-count-badurl">
        Bad URL, skipped {p.badUrl}
      </Badge>
      {p.badStatus ? (
        <Badge variant="danger" data-testid="research-count-badstatus">
          Bad status, skipped {p.badStatus}
        </Badge>
      ) : null}
      {p.noKey ? (
        <Badge variant="danger" data-testid="research-count-nokey">
          No part number, skipped {p.noKey}
        </Badge>
      ) : null}
    </>
  );
}

const RESEARCH_FILES = ".csv,text/csv";

/**
 * Import Photo Research (CSV), Admin only: researched part photos (mpn_key, part_number, image_url, source_page,
 * status, notes). The preview shows each row's part, whether it has a photo and research already, and what happens to
 * it. Save adds the new research rows only; a part's photo still comes from Pull Confirmed Photos.
 */
export function ImportPhotoResearchButton() {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<ResearchPreview | null>(null);
  const close = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
  };
  const read = useMutation({
    mutationFn: async (f: File) => {
      if (f.size > 3_000_000) throw new Error("That file is too large.");
      const base64 = await fileToBase64(f);
      return { f: { name: f.name, base64 }, p: await importPhotoResearch({ data: { filename: f.name, base64, apply: false } }) };
    },
    onSuccess: ({ f, p }) => {
      setFile(f);
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const save = useMutation({
    mutationFn: () => importPhotoResearch({ data: { filename: file!.name, base64: file!.base64, apply: true } }),
    onSuccess: (r) => {
      setPreview(r);
      toast.success(`${r.add} photo research row${r.add === 1 ? "" : "s"} added`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the photo research"),
  });
  return (
    <>
      <ActionButton icon={ImagePlus} menuLabel="Import Photo Research (CSV)" onClick={() => setOpen(true)} data-testid="research-import-open">
        Import Photo Research (CSV)
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-4xl" data-testid="research-import">
          <DialogTitle>Import Photo Research</DialogTitle>
          <DialogDescription>
            A CSV with <span className="font-medium">mpn_key</span>, <span className="font-medium">part_number</span>, <span className="font-medium">image_url</span>,{" "}
            <span className="font-medium">source_page</span>, <span className="font-medium">status</span> (confirmed or review) and{" "}
            <span className="font-medium">notes</span>, up to {RESEARCH_MAX_ROWS} rows. The key is matched to a part's MPN or SKU with case and punctuation ignored. Only parts with no research
            get a row (the first row for a part counts); research already on file is never changed, and no photo goes on a part here: Pull Confirmed
            Photos does that.
          </DialogDescription>
          {!preview ? (
            <div className="flex flex-wrap items-center gap-2">
              <PickFile busy={read.isPending} onFile={(f) => read.mutate(f)} testId="research-import-file" label="Pick The CSV File" accept={RESEARCH_FILES} />
            </div>
          ) : (
            <>
              <ApprovalHead filename={preview.filename} rowCount={preview.rowCount}>
                <ResearchCountBadges p={preview} />
              </ApprovalHead>
              {preview.applied ? (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3" data-testid="research-saved">
                  <span className="mr-auto text-sm">
                    Saved. {preview.add} row{preview.add === 1 ? "" : "s"} added; a confirmed one shows in Pull Confirmed Photos when its part has no photo.
                  </span>
                  <Button type="button" onClick={close} data-testid="research-done">
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <div className="max-h-96 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground uppercase">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 font-medium">Line · Key</th>
                          <th className="min-w-[13rem] px-2 py-2 font-medium">Part</th>
                          <th className="px-2 py-2 font-medium">Photo</th>
                          <th className="px-2 py-2 font-medium">Research</th>
                          <th className="px-3 py-2 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.lines.map((l) => (
                          <tr key={l.line} className={cn("border-b border-border align-top last:border-b-0", l.status === "add" ? "" : "text-muted-foreground")} data-testid="research-line" data-status={l.status}>
                            <td className="px-3 py-1.5">
                              <span className="text-xs tabular">{l.line}</span> <span className="font-medium break-all text-foreground">{l.key || "—"}</span>
                              <span className="block text-xs">{l.verdict || "no status"}</span>
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              {l.part ? (
                                <>
                                  <span className="block font-medium break-words text-foreground">{l.part.description || "No NetSuite description"}</span>
                                  <span className="block">
                                    <span className="whitespace-nowrap">SKU {l.part.sku}</span> · <span className="whitespace-nowrap">Mfr # {l.part.mfrPart || "not set"}</span>
                                  </span>
                                </>
                              ) : (
                                "No match"
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-xs whitespace-nowrap">{l.part ? (l.hasPhoto ? "Has photo" : "No photo") : "—"}</td>
                            <td className="px-2 py-1.5 text-xs whitespace-nowrap">{l.part ? (l.researched ? "On file" : "None") : "—"}</td>
                            <td className="px-3 py-1.5">
                              <Badge size="tight" variant={RESEARCH_STATUS[l.status].tone}>
                                {RESEARCH_STATUS[l.status].label}
                              </Badge>
                              {l.reason ? <span className="mt-0.5 block text-xs">{l.reason}</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ApprovalButtons
                    busy={save.isPending}
                    canApprove={preview.add > 0}
                    onApprove={() => save.mutate()}
                    onCancel={close}
                    verb="Save"
                    what={`${preview.add} Row${preview.add === 1 ? "" : "s"}`}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const LINE_STATUS: Record<WoLineStatus, { label: string; tone: "success" | "warn" | "danger" | "outline" }> = {
  add: { label: "Will Add", tone: "success" },
  combined: { label: "Added to a line", tone: "outline" },
  duplicate: { label: "Duplicate, skipped", tone: "outline" },
  counted: { label: "Already counted, skipped", tone: "warn" },
  no_part: { label: "No part match, skipped", tone: "danger" },
  no_wo: { label: "No WO, skipped", tone: "danger" },
  invalid: { label: "Can't read, skipped", tone: "danger" },
};

/** The counts, before Save and after it. */
function WoLineCountBadges({ p }: { p: WoLinesPreview }) {
  return (
    <>
      <Badge variant="success" data-testid="wolines-count-add">
        {p.applied ? "Added" : "Will Add"} {p.add}
      </Badge>
      {p.noTicket ? (
        <Badge variant="outline" data-testid="wolines-count-noticket">
          On no ticket, saved by WO {p.noTicket}
        </Badge>
      ) : null}
      <Badge variant="outline" data-testid="wolines-count-duplicate">
        Duplicate, skipped {p.duplicate}
      </Badge>
      <Badge variant="danger" data-testid="wolines-count-nopart">
        No part match, skipped {p.noPart}
      </Badge>
      <Badge variant="danger" data-testid="wolines-count-nowo">
        No WO, skipped {p.noWo}
      </Badge>
      <Badge variant="warn" data-testid="wolines-count-counted">
        Already counted, skipped {p.counted}
      </Badge>
      {p.combined ? (
        <Badge variant="outline" data-testid="wolines-count-combined">
          Added to a line {p.combined}
        </Badge>
      ) : null}
      {p.invalid ? (
        <Badge variant="danger" data-testid="wolines-count-invalid">
          Can't read, skipped {p.invalid}
        </Badge>
      ) : null}
    </>
  );
}

const LINE_FILES = ".csv,text/csv";
const FIRST_LINES = 300;
const BOARD_NAME: Record<WoTicket["board"], string> = { service: "Ticket", tlc: "TLC", pm: "PM", install: "Install" };

/**
 * Import WO Part Lines (CSV), Admin only: the parts each work order used, as Corrigo or NetSuite lists them (wo,
 * used_on, item, qty, source, source_ref). The preview shows each row's part, its ticket (or none: the line is still
 * saved on its WO), its pieces and what happens to it. Save adds the new lines only; Parts usage counts them.
 */
export function ImportWoPartLinesButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<WoLinesPreview | null>(null);
  const [show, setShow] = useState<WoLineStatus | "no_ticket" | "">("");
  const [all, setAll] = useState(false);
  const close = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
    setShow("");
    setAll(false);
  };
  const read = useMutation({
    mutationFn: async (f: File) => {
      if (f.size > 3_000_000) throw new Error("That file is too large.");
      const base64 = await fileToBase64(f);
      return { f: { name: f.name, base64 }, p: await importWoPartLines({ data: { filename: f.name, base64, apply: false } }) };
    },
    onSuccess: ({ f, p }) => {
      setFile(f);
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const save = useMutation({
    mutationFn: () => importWoPartLines({ data: { filename: file!.name, base64: file!.base64, apply: true } }),
    onSuccess: (r) => {
      setPreview(r);
      setShow("");
      toast.success(`${r.add} WO part line${r.add === 1 ? "" : "s"} added`);
      for (const key of ["parts", "part-usage-counts", "part-usage", "part-usage-report"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the WO part lines"),
  });
  const lines = (preview?.lines ?? []).filter((l) => (show === "no_ticket" ? l.status === "add" && !l.ticket : !show || l.status === show));
  const shown = all ? lines : lines.slice(0, FIRST_LINES);
  return (
    <>
      <ActionButton icon={ClipboardList} menuLabel="Import WO Part Lines (CSV)" onClick={() => setOpen(true)} data-testid="wolines-import-open">
        Import WO Part Lines (CSV)
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-5xl" data-testid="wolines-import">
          <DialogTitle>Import WO Part Lines</DialogTitle>
          <DialogDescription>
            A CSV with <span className="font-medium">wo</span>, <span className="font-medium">used_on</span>, <span className="font-medium">item</span>,{" "}
            <span className="font-medium">qty</span>, <span className="font-medium">source</span> (corrigo or netsuite) and <span className="font-medium">source_ref</span>, up to{" "}
            {WO_LINES_MAX_ROWS.toLocaleString("en-US")} rows. A line finds its part by the item after its last colon, and its ticket by the WO (one that came in up to 180
            days before the line's day); with no ticket it is saved on its WO. A WO's part counts once: what Charges or QuickBooks already have, and NetSuite lines that
            Corrigo has, are skipped. A blank qty counts as 1. Only Parts usage reads these lines; Charges, invoices and Pull don't change.
          </DialogDescription>
          {!preview ? (
            <div className="flex flex-wrap items-center gap-2">
              <PickFile busy={read.isPending} onFile={(f) => read.mutate(f)} testId="wolines-import-file" label="Pick The CSV File" accept={LINE_FILES} />
            </div>
          ) : (
            <>
              <ApprovalHead filename={preview.filename} rowCount={preview.rowCount}>
                <WoLineCountBadges p={preview} />
              </ApprovalHead>
              {preview.applied ? (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3" data-testid="wolines-saved">
                  <span className="mr-auto text-sm">
                    Saved. {preview.add} line{preview.add === 1 ? "" : "s"} added; Parts usage counts {preview.add === 1 ? "it" : "them"} now.
                  </span>
                  <Button type="button" onClick={close} data-testid="wolines-done">
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <SelectField
                      value={show}
                      onChange={(e) => {
                        setShow(e.target.value as WoLineStatus | "no_ticket" | "");
                        setAll(false);
                      }}
                      aria-label="Show"
                      className="h-9 w-auto"
                      allowEmpty
                      emptyLabel="All rows"
                      data-testid="wolines-show"
                    >
                      <option value="add">Will add</option>
                      <option value="no_ticket">Will add, on no ticket</option>
                      {(["combined", "duplicate", "counted", "no_part", "no_wo", "invalid"] as const).map((s) => (
                        <option key={s} value={s}>
                          {LINE_STATUS[s].label}
                        </option>
                      ))}
                    </SelectField>
                    <span className="text-xs text-muted-foreground">
                      {lines.length.toLocaleString("en-US")} row{lines.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="max-h-96 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground uppercase">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 font-medium">Line · WO</th>
                          <th className="min-w-[12rem] px-2 py-2 font-medium">Part</th>
                          <th className="min-w-[10rem] px-2 py-2 font-medium">Ticket</th>
                          <th className="px-2 py-2 text-right font-medium">Qty</th>
                          <th className="px-3 py-2 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((l) => (
                          <tr
                            key={l.line}
                            className={cn("border-b border-border align-top last:border-b-0", l.status === "add" ? "" : "text-muted-foreground")}
                            data-testid="wolines-line"
                            data-status={l.status}
                          >
                            <td className="px-3 py-1.5">
                              <span className="text-xs tabular">{l.line}</span> <span className="font-medium whitespace-nowrap text-foreground">{l.wo || l.woRaw || "—"}</span>
                              <span className="block text-xs whitespace-nowrap">
                                {l.usedOn ?? l.usedOnRaw ?? "no date"} · {l.source ? LINE_SOURCE_LABEL[l.source] : (l.sourceRaw ?? "no source")}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              {l.part ? (
                                <>
                                  <span className="block font-medium break-words text-foreground">{l.part.description || l.part.item}</span>
                                  <span className="block whitespace-nowrap">SKU {l.part.sku}</span>
                                </>
                              ) : (
                                <>
                                  <span className="block">No match</span>
                                  <span className="block break-all">{l.item || "no item"}</span>
                                </>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-xs">
                              {l.ticket ? (
                                <>
                                  <span className="block font-medium text-foreground">
                                    {BOARD_NAME[l.ticket.board]} {l.ticket.label}
                                  </span>
                                  <span className="block truncate">{[l.ticket.customer, l.ticket.status].filter(Boolean).join(" · ")}</span>
                                </>
                              ) : l.status === "add" ? (
                                "No ticket"
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right text-xs whitespace-nowrap tabular">
                              {l.status === "add" ? (
                                <span className="font-medium text-foreground">{l.total}</span>
                              ) : l.qty != null ? (
                                l.qty
                              ) : (
                                (l.qtyRaw ?? "—")
                              )}
                              {l.qtyBlank ? <span className="block text-[10px] text-warning">blank: 1</span> : null}
                            </td>
                            <td className="px-3 py-1.5">
                              <Badge size="tight" variant={LINE_STATUS[l.status].tone}>
                                {LINE_STATUS[l.status].label}
                              </Badge>
                              {l.reason ? <span className="mt-0.5 block text-xs">{l.reason}</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {lines.length > shown.length ? (
                    <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setAll(true)} data-testid="wolines-all">
                      Show all {lines.length.toLocaleString("en-US")}
                    </Button>
                  ) : null}
                  <ApprovalButtons
                    busy={save.isPending}
                    canApprove={preview.add > 0}
                    onApprove={() => save.mutate()}
                    onCancel={close}
                    verb="Save"
                    what={`${preview.add.toLocaleString("en-US")} Line${preview.add === 1 ? "" : "s"}`}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
