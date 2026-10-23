import { Fragment, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  applyNetsuiteCustomers,
  listNetsuiteImportRuns,
  previewNetsuiteCustomers,
  type NetsuiteImportRun,
  type NetsuitePreview,
} from "@/lib/ops/netsuite-customers-api";
import { NS_STATUSES, NS_STATUS_LABEL, netsuitePreviewCsv, type NsPlanLine, type NsStatus } from "@/lib/ops/netsuite-customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ActionButton, FilterChip } from "./desk-charts";
import { ShowMoreButton, useShowMore } from "./show-more";
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

const VARIANT: Record<NsStatus, "success" | "primary" | "outline" | "danger" | "warn"> = {
  create: "success",
  update: "primary",
  same: "outline",
  conflict: "danger",
  skipped: "warn",
};
const MATCHED_BY = { id: "NetSuite ID", number: "account number", name: "name" } as const;

/** Will Create and Will Update lines are the ones a save writes. New Walk-Ins start unticked. */
const savable = (l: NsPlanLine) => l.status === "create" || l.status === "update";
const startsTicked = (l: NsPlanLine) => savable(l) && !(l.status === "create" && l.walkIn);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

/**
 * Admin-only: Customers → Import → NetSuite Customers. Reads a NetSuite customer export, shows every row as Will
 * Create, Will Update, No Change, Conflict or Skipped (updates field by field), and saves only the ticked rows when
 * Import is pressed. Nothing is geocoded here; pins come from the Geocode import.
 */
export function NetsuiteCustomerImportButton() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<NetsuitePreview | null>(null);
  const [group, setGroup] = useState<NsStatus>("create");
  const [included, setIncluded] = useState<Set<number>>(new Set());
  // Phones show the first lines of the description; More opens the rest.
  const [moreInfo, setMoreInfo] = useState(false);
  const runs = useQuery({ queryKey: ["netsuite-import-runs"], queryFn: () => listNetsuiteImportRuns(), enabled: open });

  const show = (p: NetsuitePreview) => {
    setPreview(p);
    setIncluded(new Set(p.lines.filter(startsTicked).map((l) => l.line)));
    setGroup(NS_STATUSES.find((s) => p.counts[s] > 0) ?? "create");
  };
  const read = useMutation({
    mutationFn: async (f: File) => {
      const picked = { name: f.name, base64: await fileToBase64(f) };
      return { picked, p: await previewNetsuiteCustomers({ data: { filename: picked.name, base64: picked.base64 } }) };
    },
    onSuccess: ({ picked, p }) => {
      setFile(picked);
      show(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  // After a save: the same file against the accounts as they are now, so what's left (or nothing) shows.
  const reread = useMutation({
    mutationFn: () => previewNetsuiteCustomers({ data: { filename: file!.name, base64: file!.base64 } }),
    onSuccess: show,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the file again"),
  });
  const save = useMutation({
    mutationFn: () => applyNetsuiteCustomers({ data: { filename: file!.name, base64: file!.base64, include: [...included] } }),
    onSuccess: (r) => {
      toast.success(
        `Added ${plural(r.created, "account")} and updated ${plural(r.updated, "account")}` +
          (r.notSaved ? `. ${plural(r.notSaved, "row")} not saved: changed in KatzDesk meanwhile.` : ""),
      );
      for (const key of ["customers", "directory", "customer-history", "customer-address", "clean-names", "netsuite-import-runs"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      reread.mutate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const lines = useMemo(() => (preview?.lines ?? []).filter((l) => l.status === group), [preview, group]);
  const paged = useShowMore(lines, `${group}|${preview?.filename}|${preview?.rowCount}`, 100);
  const ticked = useMemo(() => (preview?.lines ?? []).filter((l) => savable(l) && included.has(l.line)), [preview, included]);
  const tickedNew = ticked.filter((l) => l.status === "create").length;
  const tickedUpdates = ticked.length - tickedNew;
  const groupSavable = group === "create" || group === "update";
  const groupTicked = groupSavable ? lines.filter((l) => included.has(l.line)).length : 0;
  const busy = read.isPending || reread.isPending || save.isPending;

  const tick = (line: number, on: boolean) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (on) next.add(line);
      else next.delete(line);
      return next;
    });
  const tickGroup = (on: boolean) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      for (const l of lines) if (on) next.add(l.line);
      else next.delete(l.line);
      return next;
    });

  function download() {
    if (!preview) return;
    // The byte-order mark makes Excel read the file as UTF-8, so accented names stay right.
    const blob = new Blob(["\uFEFF" + netsuitePreviewCsv(preview.lines, included)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${preview.filename.replace(/\.[^.]+$/, "") || "netsuite-customers"}-preview.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function onSave() {
    const what = [tickedNew ? `add ${plural(tickedNew, "new account")}` : "", tickedUpdates ? `update ${plural(tickedUpdates, "account")}` : ""].filter(Boolean).join(" and ");
    if (!window.confirm(`Import from ${preview!.filename}: ${what}? Unticked rows, conflicts and skipped rows are left alone.`)) return;
    save.mutate();
  }

  return (
    <>
      <ActionButton icon={Upload} menuLabel="NetSuite Customers" onClick={() => setOpen(true)} data-testid="ns-import-open">
        Import NetSuite Customers
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
        <DialogContent className="sm:max-w-4xl" data-testid="ns-import">
          <div className="space-y-3">
            <DialogTitle>Import NetSuite Customers</DialogTitle>
            <div>
              <p className={cn("text-sm text-muted-foreground", !moreInfo && "max-sm:line-clamp-3")}>
                A NetSuite customer export (CSV or Excel) with Internal ID, Account Number, Company Name, the billing and shipping
                address, Primary Contact, Phone, Email and, if you have it, Inactive. Rows match an account by Internal ID, then
                account number, then exact name, never a close name. The shipping address becomes the site address; nothing is
                renamed, removed or geocoded. Nothing saves until you press Import, and only ticked rows save.
              </p>
              <button type="button" className="h-9 text-sm font-medium text-primary sm:hidden" aria-expanded={moreInfo} onClick={() => setMoreInfo(!moreInfo)}>
                {moreInfo ? "Less" : "More"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={busy} onClick={() => fileRef.current?.click()} data-testid="ns-import-pick">
                <FileUp className="size-4" />
                {read.isPending ? "Reading…" : preview ? "Pick Another File" : "Pick A File"}
              </Button>
              {file ? <span className="min-w-0 text-xs break-all text-muted-foreground">{file.name}</span> : null}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.xlsx,.xls"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                data-testid="ns-import-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) read.mutate(f);
                }}
              />
            </div>

            {preview ? (
              <>
                <p className="text-xs text-muted-foreground" data-testid="ns-import-summary">
                  {plural(preview.rowCount, "row")} read.
                  {preview.columns.missing.length ? ` Not in the file: ${preview.columns.missing.join(", ")}.` : ""}
                  {reread.isPending ? " Reading the file again…" : ""}
                </p>
                {preview.warnings.map((w) => (
                  <p key={w} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                    {w}
                  </p>
                ))}
                <div className="flex flex-wrap gap-2" data-testid="ns-import-counts">
                  {NS_STATUSES.map((s) => (
                    <FilterChip key={s} selected={group === s} onClick={() => setGroup(s)} data-testid={`ns-import-${s}`}>
                      {NS_STATUS_LABEL[s]} {preview.counts[s].toLocaleString("en-US")}
                    </FilterChip>
                  ))}
                </div>
                {groupSavable && lines.length ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="ns-import-group-ticks">
                    <span className="text-muted-foreground">
                      {groupTicked.toLocaleString("en-US")} of {lines.length.toLocaleString("en-US")} ticked
                    </span>
                    <button type="button" className="h-8 font-medium text-primary" onClick={() => tickGroup(true)}>
                      Tick all
                    </button>
                    <button type="button" className="h-8 font-medium text-primary" onClick={() => tickGroup(false)}>
                      Untick all
                    </button>
                  </div>
                ) : null}
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border sm:max-h-[50vh] sm:overflow-y-auto" data-testid="ns-import-lines">
                  {paged.visible.map((l) => (
                    <PlanLine key={l.line} line={l} ticked={included.has(l.line)} onTick={(on) => tick(l.line, on)} />
                  ))}
                  {!lines.length ? <li className="px-3 py-4 text-sm text-muted-foreground">Nothing here.</li> : null}
                  <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} />
                </ul>
                <div className="flex flex-wrap items-center justify-end gap-2 max-sm:sticky max-sm:-bottom-5 max-sm:z-10 max-sm:-mx-5 max-sm:-mb-5 max-sm:border-t max-sm:border-border max-sm:bg-card max-sm:px-5 max-sm:py-3">
                  <Button type="button" variant="outline" size="sm" className="mr-auto" onClick={download} data-testid="ns-import-download">
                    <Download className="size-4" />
                    Download Preview
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                  <Button type="button" size="sm" disabled={!ticked.length || busy} onClick={onSave} data-testid="ns-import-save">
                    {save.isPending ? "Importing…" : `Import ${ticked.length.toLocaleString("en-US")}`}
                  </Button>
                </div>
                {ticked.length ? (
                  <p className="text-right text-xs text-muted-foreground" data-testid="ns-import-ticked">
                    {plural(tickedNew, "new account")} and {plural(tickedUpdates, "update")} ticked
                  </p>
                ) : null}
              </>
            ) : null}

            <RecentRuns runs={runs.data ?? []} loading={runs.isLoading} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One row of the file: the account it matched, and field by field what saving it does. */
function PlanLine({ line: l, ticked, onTick }: { line: NsPlanLine; ticked: boolean; onTick: (on: boolean) => void }) {
  const canTick = savable(l);
  const id = `ns-line-${l.line}`;
  return (
    <li className="flex gap-3 px-3 py-2.5 text-sm" data-testid={`ns-line-${l.line}`}>
      {canTick ? (
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-primary"
          checked={ticked}
          onChange={(e) => onTick(e.target.checked)}
          aria-label={`Import line ${l.line}, ${l.companyName || "no name"}`}
          data-testid={`ns-tick-${l.line}`}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <label htmlFor={canTick ? id : undefined} className="font-medium break-words">
            {l.companyName || <span className="text-muted-foreground">No company name</span>}
          </label>
          {l.walkIn ? (
            <Badge size="tight" variant="warn">
              Walk-In
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground tabular">
            Line {l.line}
            {l.internalId ? ` · ID ${l.internalId}` : ""}
            {l.accountNumber ? ` · Acct ${l.accountNumber}` : ""}
          </span>
        </div>
        {l.accountName ? (
          <p className="text-xs break-words text-muted-foreground">
            KatzDesk: <span className="text-foreground">{l.accountName}</span>
            {l.matchedBy ? ` · matched by ${MATCHED_BY[l.matchedBy]}` : ""}
          </p>
        ) : null}
        {l.changes.length && canTick ? (
          <dl className="mt-1 grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)]" data-testid={`ns-changes-${l.line}`}>
            {l.changes.map((c) => (
              <Fragment key={c.field}>
                <dt className="text-muted-foreground">{c.label}</dt>
                <dd className="min-w-0 break-words max-sm:mb-1">
                  {c.before ? (
                    <>
                      <span className="text-muted-foreground line-through">{c.before}</span>
                      {" → "}
                    </>
                  ) : null}
                  <span className="font-medium">{c.after ?? "—"}</span>
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : null}
        <p className={cn("mt-0.5 text-xs", l.status === "conflict" ? "text-destructive" : "text-muted-foreground")}>
          <Badge size="tight" variant={VARIANT[l.status]} className="mr-1 align-middle">
            {NS_STATUS_LABEL[l.status]}
          </Badge>
          {l.reason}
        </p>
        {l.notes.map((n) => (
          <p key={n} className="text-xs text-muted-foreground">
            {n}
          </p>
        ))}
      </div>
    </li>
  );
}

function RecentRuns({ runs, loading }: { runs: NetsuiteImportRun[]; loading: boolean }) {
  if (loading || !runs.length) return null;
  return (
    <section className="border-t border-border pt-3" data-testid="ns-import-runs">
      <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Past imports</h3>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {runs.map((r) => (
          <li key={r.id} className="break-words">
            <span className="text-foreground">{when(r.createdAt)}</span> · {r.createdBy ?? "Admin"} · {r.filename ?? "file"}: added{" "}
            {r.created.toLocaleString("en-US")}, updated {r.updated.toLocaleString("en-US")} of {plural(r.rowCount, "row")}
            {r.excluded ? ` (${r.excluded.toLocaleString("en-US")} unticked)` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
