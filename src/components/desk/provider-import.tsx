import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { applyProviderImport, previewProviderImport, type ProviderImportPreview } from "@/lib/ops/provider-import-api";
import { PROVIDER_GEO_KEY } from "@/lib/ops/provider-geo-api";
import type { PinPlan, ProviderPlanLine, ProviderPlanStatus } from "@/lib/ops/provider-import";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ActionButton, FilterChip } from "./desk-charts";
import { cn } from "@/lib/utils";

/** The server reads up to about 9 MB (12,000,000 characters of base64). */
const MAX_FILE_BYTES = 9_000_000;

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

type Variant = "success" | "outline" | "warn" | "danger" | "primary";

const GROUPS: { id: ProviderPlanStatus; label: string; badge: string; variant: Variant }[] = [
  { id: "update", label: "Will Update", badge: "Will Update", variant: "success" },
  { id: "merge", label: "Will Merge", badge: "Will Merge", variant: "primary" },
  { id: "new", label: "New", badge: "New", variant: "success" },
  { id: "same", label: "No Change", badge: "No Change", variant: "outline" },
  { id: "unmatched", label: "Unmatched", badge: "Unmatched", variant: "warn" },
  { id: "conflict", label: "Conflicts", badge: "Conflict", variant: "danger" },
];
const BADGE = new Map(GROUPS.map((g) => [g.id, g]));

const PIN_WORD: Record<NonNullable<PinPlan["quality"]>, string> = {
  exact: "Exact pin",
  close: "Close match, check the pin",
  approx: "ZIP area (approximate)",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function firstGroup(p: ProviderImportPreview): ProviderPlanStatus {
  return (["update", "merge", "new", "conflict", "unmatched", "same"] as const).find((g) => p.counts[g] > 0) ?? "same";
}

/**
 * Admin-only load of the cleaned provider list (CSV or Excel): cleaned names, merges of duplicates, contact fields, web
 * site and the geocoded shop address (the map pin). Shows every change before anything is saved; blank cells never
 * clear what KatzDesk has.
 */
export function ProviderImportButton() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ProviderImportPreview | null>(null);
  const [filename, setFilename] = useState("");
  const [group, setGroup] = useState<ProviderPlanStatus>("update");
  const [addNew, setAddNew] = useState(false);
  // Phones show the first lines of the long description; More opens the rest.
  const [moreInfo, setMoreInfo] = useState(false);

  const read = useMutation({
    mutationFn: async (file: File) => previewProviderImport({ data: { filename: file.name, base64: await fileToBase64(file), addNew } }),
    onSuccess: (p) => {
      setPreview(p);
      setGroup(firstGroup(p));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const replan = useMutation({
    mutationFn: (next: boolean) => previewProviderImport({ data: { rows: preview!.rows, addNew: next } }),
    onSuccess: (p, next) => {
      setPreview(p);
      if (next && p.counts.new) setGroup("new");
      else if (!p.counts[group]) setGroup(firstGroup(p));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check the file again"),
  });
  const save = useMutation({
    mutationFn: () => applyProviderImport({ data: { rows: preview!.rows, addNew } }),
    onSuccess: (r) => {
      const bits = [r.updated ? `${plural(r.updated, "provider")} updated` : "", r.merged ? `${plural(r.merged, "duplicate")} merged` : "", r.added ? `${plural(r.added, "provider")} added` : ""].filter(Boolean);
      toast.success(bits.length ? `Saved: ${bits.join(", ")}` : "Nothing needed saving");
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["provider"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
      void qc.invalidateQueries({ queryKey: PROVIDER_GEO_KEY });
      setOpen(false);
      setPreview(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const lines = useMemo(() => (preview?.lines ?? []).filter((l) => l.status === group), [preview, group]);
  const canAddAny = !!preview?.lines.some((l) => l.canAdd);
  const toSave = preview ? preview.counts.update + preview.counts.merge + preview.counts.new : 0;
  const busy = read.isPending || replan.isPending || save.isPending;

  return (
    <>
      <ActionButton icon={Upload} onClick={() => setOpen(true)} data-testid="provider-import-open">
        Import Providers
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl" data-testid="provider-import">
          <div className="max-sm:space-y-3">
            <DialogTitle>Import Providers</DialogTitle>
            <div>
              <p className={cn("text-sm text-muted-foreground", !moreInfo && "max-sm:line-clamp-3")}>
                The cleaned provider list (CSV or Excel) with <span className="font-medium">Provider ID</span>, <span className="font-medium">Current Name</span>,{" "}
                <span className="font-medium">Name</span> and <span className="font-medium">Merge Into</span> columns, the dispatch contacts, web site and the
                geocoded shop address. Rows are matched by Provider ID, then Current Name, then Name. Blank cells keep what is there. A duplicate with Merge Into
                moves its customers, contacts, addresses and coverage to that provider and is archived, never deleted. Nothing saves until you press Save.
              </p>
              <button
                type="button"
                className="h-9 text-sm font-medium text-primary sm:hidden"
                aria-expanded={moreInfo}
                onClick={() => setMoreInfo(!moreInfo)}
              >
                {moreInfo ? "Less" : "More"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant={preview ? "outline" : "default"} disabled={busy} onClick={() => fileRef.current?.click()} data-testid="provider-import-pick">
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
                data-testid="provider-import-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f && f.size > MAX_FILE_BYTES) {
                    toast.error("That file is too large (up to about 9 MB).");
                  } else if (f) {
                    setFilename(f.name);
                    read.mutate(f);
                  }
                }}
              />
            </div>
            {preview ? (
              <>
                <div className="flex flex-wrap gap-2" data-testid="provider-import-counts">
                  {GROUPS.map((g) => (
                    <FilterChip key={g.id} selected={group === g.id} onClick={() => setGroup(g.id)} data-testid={`provider-import-tab-${g.id}`}>
                      {g.label} {preview.counts[g.id]}
                    </FilterChip>
                  ))}
                </div>
                {canAddAny ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={addNew}
                      disabled={busy}
                      data-testid="provider-import-add-new"
                      onChange={(e) => {
                        setAddNew(e.target.checked);
                        replan.mutate(e.target.checked);
                      }}
                    />
                    Add new providers (rows with a Name that are not in KatzDesk yet)
                  </label>
                ) : null}
                <ul className="divide-y divide-border overflow-y-auto rounded-lg border border-border sm:max-h-[22rem]" data-testid="provider-import-lines">
                  {lines.slice(0, 300).map((l) => (
                    <PlanRow key={l.line} line={l} />
                  ))}
                  {lines.length > 300 ? <li className="px-3 py-3 text-xs text-muted-foreground">Showing the first 300 of {lines.length}.</li> : null}
                  {!lines.length ? <li className="px-3 py-4 text-sm text-muted-foreground">Nothing here.</li> : null}
                </ul>
                <div className="flex flex-wrap items-center justify-end gap-2 max-sm:sticky max-sm:-bottom-5 max-sm:z-10 max-sm:-mx-5 max-sm:-mb-5 max-sm:border-t max-sm:border-border max-sm:bg-card max-sm:px-5 max-sm:py-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={!toSave || busy} onClick={() => save.mutate()} data-testid="provider-import-save">
                    {save.isPending ? "Saving…" : `Save ${plural(toSave, "Change")}`}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** One row of the file: what it matched, what changes (old → new), its pin, a merge, and why. */
function PlanRow({ line: l }: { line: ProviderPlanLine }) {
  const g = BADGE.get(l.status)!;
  return (
    <li className="px-3 py-2.5 text-sm" data-testid="provider-import-line" data-status={l.status}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="tabular text-xs text-muted-foreground">Line {l.line}</span>
        <span className="font-medium">{l.fileName || "—"}</span>
        {l.providerName && l.providerName !== l.fileName ? <span className="text-xs text-muted-foreground">in KatzDesk as “{l.providerName}”</span> : null}
        {l.matchedBy ? <span className="text-xs text-muted-foreground">· matched by {l.matchedBy}</span> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <Badge size="tight" variant={g.variant} className="mr-1">
          {g.badge}
        </Badge>
        {l.reason}
      </p>
      {l.changes.length ? (
        <ul className="mt-1.5 space-y-0.5 text-xs" data-testid="provider-import-changes">
          {l.changes.map((c) => (
            <li key={c.field} className="break-words">
              <span className="text-muted-foreground">{c.label}:</span>{" "}
              {c.from ? (
                <>
                  <span className="text-muted-foreground line-through decoration-muted-foreground/60">{c.from}</span> →{" "}
                </>
              ) : null}
              <span className="font-medium">{c.to}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {l.pin ? (
        <p className="mt-1 text-xs break-words" data-testid="provider-import-pin">
          <span className="text-muted-foreground">{l.pin.role === "main" ? "Pin:" : "Another location:"}</span> {l.pin.address || "—"}{" "}
          <span className={cn(l.pin.quality === "close" || !l.pin.quality ? "text-warning" : "text-muted-foreground")}>
            · {l.pin.quality ? PIN_WORD[l.pin.quality] : l.pin.matchType ? `No pin (${l.pin.matchType})` : "No pin"}
          </span>
        </p>
      ) : null}
      {l.merge ? (
        <p className="mt-1 text-xs" data-testid="provider-import-merge">
          <span className="text-muted-foreground">Merge into:</span> <span className="font-medium">{l.merge.keeperName}</span>{" "}
          <span className="text-muted-foreground">
            (line {l.merge.keeperLine}) · moves {plural(l.merge.assignments, "customer assignment")}
            {l.merge.overlapping ? ` (${l.merge.overlapping} already there, the stronger role kept)` : ""}, {plural(l.merge.contacts, "contact")}
            {l.merge.contactDupes ? ` (${l.merge.contactDupes} already there, the copy dropped)` : ""}, {plural(l.merge.addresses, "address", "addresses")}
            {l.merge.addressDupes ? ` (${l.merge.addressDupes} already there, the copy dropped)` : ""}, {plural(l.merge.coverage, "coverage row")}
            {l.merge.fills.length ? ` · fills the blank ${l.merge.fills.join(", ")}` : ""}
          </span>
        </p>
      ) : null}
      {l.verified ? <p className="mt-1 text-[11px] text-muted-foreground">Verified: {l.verified}</p> : null}
      {l.warnings.map((w, i) => (
        <p key={i} className="mt-1 text-[11px] text-warning">
          {w}
        </p>
      ))}
    </li>
  );
}
