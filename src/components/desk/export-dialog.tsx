import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Printer, Table2 } from "lucide-react";
import {
  downloadExport,
  previewExport,
  REPORT_LABELS,
  REPORT_TYPES,
  type BuiltReport,
  type ReportType,
} from "@/lib/ops/export-reports";
import { CALL_STATUSES, EQUIP_STATUSES, MODULE_STATUSES, PM_STATUSES, REBUILD_STATUSES } from "@/lib/ops/lookups";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { TechFilter } from "./tech-select";

const PREFS_KEY = "katz-desk-export";

type Saved = {
  type: ReportType;
  format: "xlsx" | "csv";
  dateFrom: string;
  dateTo: string;
  tech: string;
  customer: string;
  status: string;
  ak: boolean;
};


function readSaved(): Partial<Saved> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}") as Partial<Saved>;
  } catch {
    return {};
  }
}

function writeSaved(next: Saved) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
}

function statusesFor(type: ReportType): string[] {
  if (type === "pms") return [...PM_STATUSES];
  if (type === "modules") return [...MODULE_STATUSES];
  if (type === "installs") return [...EQUIP_STATUSES.filter((s) => s !== "Installed"), "Not Ready", "Ready"];
  if (type === "rebuilds") return [...REBUILD_STATUSES];
  return [...CALL_STATUSES];
}

function downloadBase64(filename: string, mime: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function tsvFromReport(report: BuiltReport): string {
  const parts: string[] = [`${report.label}`, `Generated ${report.generated}`, report.filterSummary, ""];
  for (const sheet of report.sheets) {
    if (report.sheets.length > 1) parts.push(sheet.name);
    parts.push(sheet.columns.join("\t"));
    for (const row of sheet.rows) parts.push(row.join("\t"));
    parts.push("");
  }
  return parts.join("\n");
}

function printReport(report: BuiltReport) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) {
    toast.error("Allow pop-ups to print the report.");
    return;
  }
  const tables = report.sheets
    .map((sheet) => {
      const head = sheet.columns.map((c) => `<th>${esc(c)}</th>`).join("");
      const body = sheet.rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("");
      return `<h2>${esc(sheet.name)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");
  w.document.write(`<!doctype html><html><head><title>${esc(report.label)}</title>
    <style>
      body { font: 13px/1.4 system-ui, sans-serif; padding: 24px; color: #1a1612; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      p { color: #5c5348; margin: 0 0 16px; }
      h2 { font-size: 14px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .08em; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d7cfc4; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f4efe8; }
    </style></head><body>
    <h1>${esc(report.label)}</h1>
    <p>${esc(report.generated)} · ${esc(report.filterSummary)}</p>
    ${tables}
    </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function esc(s: string) {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

export function ExportButton({
  defaultType,
  label,
}: {
  defaultType?: ReportType;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Download className="size-4" />
        {label ?? "Export"}
      </Button>
      <ExportDialog open={open} onOpenChange={setOpen} defaultType={defaultType} />
    </>
  );
}

export function ExportDialog({
  open,
  onOpenChange,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType?: ReportType;
}) {
  const saved = useMemo(() => readSaved(), [open]);
  const [type, setType] = useState<ReportType>(defaultType ?? saved.type ?? "pending");
  const [format, setFormat] = useState<"xlsx" | "csv">(saved.format ?? "xlsx");
  const [dateFrom, setDateFrom] = useState(saved.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(saved.dateTo ?? "");
  const [tech, setTech] = useState(saved.tech ?? "");
  const [customer, setCustomer] = useState(saved.customer ?? "");
  const [status, setStatus] = useState(saved.status ?? "");
  const [ak, setAk] = useState(!!saved.ak);
  const [report, setReport] = useState<BuiltReport | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = defaultType ?? readSaved().type ?? "pending";
    if (defaultType) setType(defaultType);
    else setType(next);
  }, [open, defaultType]);

  const filters = {
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    tech: tech || null,
    customer: customer || null,
    status: status || null,
    ak: ak || null,
  };

  function persist() {
    writeSaved({ type, format, dateFrom, dateTo, tech, customer, status, ak });
  }


  const preview = useMutation({
    mutationFn: () => previewExport({ data: { type, format, filters } }),
    onSuccess: (data) => {
      setReport(data);
      persist();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build report"),
  });

  const download = useMutation({
    mutationFn: () => downloadExport({ data: { type, format, filters } }),
    onSuccess: (data) => {
      setReport(data.report);
      persist();
      downloadBase64(data.filename, data.mime, data.base64);
      toast.success(`Saved ${data.filename}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not export"),
  });

  const statuses = [...new Set(statusesFor(type))];
  const last = report;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogTitle>Export</DialogTitle>
        <DialogDescription>
          One file for the weekly update. KatzDesk labels only — nothing is sent to Corrigo, and
          customers are not created.
        </DialogDescription>

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="export-type">Report type</Label>
            <SelectField
              id="export-type"
              className="mt-1"
              value={type}
              onChange={(e) => {
                setType(e.target.value as ReportType);
                setStatus("");
                setReport(null);
              }}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPORT_LABELS[t]}
                </option>
              ))}
            </SelectField>
          </div>
          <div>
            <Label htmlFor="export-format">Format</Label>
            <SelectField
              id="export-format"
              className="mt-1"
              value={format}
              onChange={(e) => setFormat(e.target.value as "xlsx" | "csv")}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
            </SelectField>
          </div>
          <div>
            <Label htmlFor="export-from">From</Label>
            <Input id="export-from" type="date" className="mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="export-to">To</Label>
            <Input id="export-to" type="date" className="mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="min-w-0 sm:col-span-2">
            <Label>{type === "rebuilds" ? "Owner" : "Tech"}</Label>
            <div className="mt-1 max-w-xs">
              <TechFilter value={tech} onChange={setTech} className="w-full" />
            </div>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <Label htmlFor="export-customer">Account</Label>
            <Input
              id="export-customer"
              className="mt-1"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Search account name…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="export-status">Status</Label>
            <SelectField
              id="export-status"
              className="mt-1 max-w-xs"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              allowEmpty
              emptyLabel="Any status"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={ak}
              onChange={(e) => setAk(e.target.checked)}
            />
            AK accounts only
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => download.mutate()} disabled={download.isPending}>
            <Download className="size-4" />
            {download.isPending ? "Building…" : `Download ${format === "xlsx" ? "Excel" : "CSV"}`}
          </Button>
          <Button type="button" variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
            <Table2 className="size-4" />
            {preview.isPending ? "Loading…" : "Preview"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!last}
            onClick={async () => {
              if (!last) return;
              try {
                await navigator.clipboard.writeText(tsvFromReport(last));
                toast.success("Copied as a table");
              } catch {
                toast.error("Could not copy");
              }
            }}
          >
            Copy as table
          </Button>
          <Button type="button" variant="outline" disabled={!last} onClick={() => last && printReport(last)}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>

        {last ? (
          <div className="mt-4">
            <p className="text-sm">
              <span className="font-medium">{last.label}</span>
              <span className="text-muted-foreground"> · {last.generated} · {last.filterSummary}</span>
            </p>
            {last.counts ? (
              <p className="mt-1 text-sm">
                <span className="font-medium">{last.counts.notReady}</span> not ready
                {" · "}
                <span className="font-medium">{last.counts.ready}</span> ready
              </p>
            ) : null}
            <div className="mt-3 space-y-4">
              {last.sheets.map((sheet) => (
                <div key={sheet.name} className="overflow-auto rounded-xl border border-border">
                  {last.sheets.length > 1 ? (
                    <p className="border-b border-border bg-muted/40 px-3 py-2 text-xs tracking-wide text-muted-foreground uppercase">
                      {sheet.name} · {sheet.rows.length}
                    </p>
                  ) : null}
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead className="bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                      <tr>
                        {sheet.columns.map((c) => (
                          <th key={c} className="px-3 py-2 font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.slice(0, 40).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 align-top">
                              {cell || <span className="text-muted-foreground"> </span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {sheet.rows.length === 0 ? (
                        <tr>
                          <td colSpan={sheet.columns.length} className="px-3 py-6 text-muted-foreground">
                            Nothing in this list.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                  {sheet.rows.length > 40 ? (
                    <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                      Showing 40 of {sheet.rows.length}. Download the file for the full list.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
