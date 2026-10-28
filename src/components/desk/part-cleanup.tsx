import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CopyX, Merge } from "lucide-react";
import { toast } from "sonner";
import { cleanUpImportCopies, importPartMerges, type CopiesPreview, type MergesPreview } from "@/lib/ops/part-merges-api";
import { MERGE_MAX_ROWS, type CopyPlanStatus, type MergePlanLine, type MergePlanStatus, type PartBrief, type PartFill } from "@/lib/ops/part-merges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { ActionButton } from "./desk-charts";
import { ApprovalButtons, ApprovalHead, PickFile } from "./part-imports";

/*
 * Two Admin tools on Parts → Import (10/28): Clean Up Import Copies and Import Part Merges (CSV). Both show what
 * they will do first; nothing is written until Confirm, and nothing is ever deleted. The planning is in
 * part-merges.ts, the writing in part-merges-api.ts.
 */

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

type Tone = "success" | "warn" | "danger" | "outline";

const FIRST_LINES = 300;
const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

/** Every part key the usage and parts screens read: they all change when parts fold together. */
function useRefreshAll() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["parts", "billing-items", "charges", "parts-profit", "part-usage-counts", "part-usage", "part-usage-report"]) void qc.invalidateQueries({ queryKey: [key] });
  };
}

function PartCell({ part, hiddenTag = true }: { part: PartBrief; hiddenTag?: boolean }) {
  return (
    <>
      <span className="block font-medium break-all text-foreground">
        {part.sku}
        {hiddenTag && part.hidden ? <span className="ml-1.5 text-[10px] font-normal tracking-wide text-muted-foreground uppercase">hidden</span> : null}
      </span>
      {part.description ? <span className="block text-xs break-words text-muted-foreground">{part.description}</span> : null}
    </>
  );
}

function Changes({ fills, machineParts, research }: { fills: PartFill[]; machineParts: number; research: boolean }) {
  if (!fills.length && !machineParts && !research) return <span className="text-muted-foreground">Nothing to fill or move</span>;
  return (
    <ul className="space-y-0.5">
      {fills.map((f) => (
        <li key={f.field} className="break-words">
          <span className="text-muted-foreground">{f.label}:</span> {f.value}
        </li>
      ))}
      {machineParts ? <li>{plural(machineParts, "PM machine part")} move</li> : null}
      {research ? <li>Photo research copied</li> : null}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------ Part A

const COPY_STATUS: Record<CopyPlanStatus, { label: string; tone: Tone }> = {
  fold: { label: "Will fold", tone: "success" },
  fix: { label: "Will fix", tone: "warn" },
  ambiguous: { label: "Ambiguous, left", tone: "danger" },
  done: { label: "Already folded", tone: "outline" },
};

function CopyBadges({ p }: { p: CopiesPreview }) {
  const c = p.counts;
  return (
    <>
      <Badge variant="success" data-testid="copies-count-fold">
        Will fold {n(c.fold)}
      </Badge>
      <Badge variant="warn" data-testid="copies-count-fix">
        Will fix {n(c.fix)}
      </Badge>
      <Badge variant="danger" data-testid="copies-count-ambiguous">
        Ambiguous, left {n(c.ambiguous)}
      </Badge>
      <Badge variant="outline" data-testid="copies-count-done">
        Already folded {n(c.done)}
      </Badge>
    </>
  );
}

/**
 * Clean Up Import Copies: the copies a bad NetSuite import made ("PARTS : EVER108340" as SKU and MPN, no class, photo
 * or bin), each folded into its original, fixed, or left when it fits two or more parts.
 */
export function CleanUpImportCopiesButton() {
  const refresh = useRefreshAll();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CopiesPreview | null>(null);
  const [show, setShow] = useState<CopyPlanStatus | "">("");
  const [all, setAll] = useState(false);
  const close = () => {
    setOpen(false);
    setPreview(null);
    setShow("");
    setAll(false);
  };
  const load = useMutation({
    mutationFn: () => cleanUpImportCopies({ data: { apply: false } }),
    onSuccess: setPreview,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read the parts"),
  });
  const save = useMutation({
    mutationFn: () => cleanUpImportCopies({ data: { apply: true } }),
    onSuccess: (r) => {
      setPreview(r);
      setShow("");
      setAll(false);
      toast.success(`${plural(r.result?.folded ?? 0, "import copy", "import copies")} folded, ${n(r.result?.fixed ?? 0)} fixed`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not clean up the copies"),
  });
  const lines = (preview?.lines ?? []).filter((l) => !show || l.status === show);
  const shown = all ? lines : lines.slice(0, FIRST_LINES);
  const todo = (preview?.counts.fold ?? 0) + (preview?.counts.fix ?? 0);
  return (
    <>
      <ActionButton
        icon={CopyX}
        menuLabel="Clean Up Import Copies"
        onClick={() => {
          setOpen(true);
          load.mutate();
        }}
        data-testid="copies-open"
      >
        Clean Up Import Copies
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-5xl" data-testid="copies-cleanup">
          <DialogTitle>Clean Up Import Copies</DialogTitle>
          <DialogDescription>
            A NetSuite import added copies of parts whose SKU and MPN are the whole name, like “PARTS : EVER108340”, with no class, photo or bin. A copy with one
            original is folded into it: the original's blank name and prices come from the copy, its PM machine parts and photo research move over, and the copy is
            hidden, never deleted. A copy with no original stays on the list, with the bare number as its SKU and MPN. A copy that fits two or more parts is left and
            listed. Tickets and invoices keep their text; Parts usage counts it on the original.
          </DialogDescription>
          {!preview ? (
            <p className="text-sm text-muted-foreground" data-testid="copies-loading">
              {load.isPending ? "Finding import copies…" : load.isError ? "Could not read the parts." : ""}
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-muted/40 p-3" data-testid="copies-head">
                <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                  <dt className="text-muted-foreground">Import copies</dt>
                  <dd className="font-medium tabular" data-testid="copies-total">
                    {n(preview.counts.copies)}
                  </dd>
                  <dt className="text-muted-foreground">{preview.applied ? "Now" : "What will change"}</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    <CopyBadges p={preview} />
                  </dd>
                  {!preview.applied && preview.counts.fold ? (
                    <>
                      <dt className="text-muted-foreground">Moving over</dt>
                      <dd data-testid="copies-moving">
                        {plural(preview.counts.filled, "original")} {preview.counts.filled === 1 ? "gets" : "get"} blank fields filled · {plural(preview.counts.machineParts, "PM machine part")} ·{" "}
                        {plural(preview.counts.research, "photo research row")}
                      </dd>
                    </>
                  ) : null}
                </dl>
              </div>
              {preview.applied && preview.result ? (
                <p className="rounded-lg border border-border p-3 text-sm" data-testid="copies-saved">
                  Done. {plural(preview.result.folded, "copy", "copies")} folded and hidden, {n(preview.result.fixed)} fixed,{" "}
                  {plural(preview.result.filled, "original")} filled, {plural(preview.result.moved, "PM machine part")} moved,{" "}
                  {plural(preview.result.research, "photo research row")} copied.
                  {preview.counts.ambiguous ? ` ${plural(preview.counts.ambiguous, "ambiguous copy", "ambiguous copies")} left as they are.` : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SelectField
                  value={show}
                  onChange={(e) => {
                    setShow(e.target.value as CopyPlanStatus | "");
                    setAll(false);
                  }}
                  aria-label="Show"
                  className="h-9 w-auto"
                  allowEmpty
                  emptyLabel="All copies"
                  data-testid="copies-show"
                >
                  {(["fold", "fix", "ambiguous", "done"] as const).map((s) => (
                    <option key={s} value={s}>
                      {COPY_STATUS[s].label}
                    </option>
                  ))}
                </SelectField>
                <span className="text-xs text-muted-foreground">
                  {plural(lines.length, "copy", "copies")}
                  {show === "done" && preview.counts.done > lines.length ? ` (the first ${n(lines.length)})` : ""}
                </span>
              </div>
              <div className="max-h-96 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="min-w-[11rem] px-3 py-2 font-medium">Import copy</th>
                      <th className="min-w-[11rem] px-2 py-2 font-medium">Goes into</th>
                      <th className="min-w-[12rem] px-2 py-2 font-medium">What changes</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((l) => (
                      <tr key={l.copy.id} className={cn("border-b border-border align-top last:border-b-0", l.status === "ambiguous" || l.status === "done" ? "text-muted-foreground" : "")} data-testid="copies-line" data-status={l.status}>
                        <td className="px-3 py-1.5">
                          <PartCell part={l.copy} />
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {l.original ? (
                            <PartCell part={l.original} />
                          ) : l.status === "fix" ? (
                            <span>
                              Stays on the list as <span className="font-medium break-all text-foreground">{l.fixedSku}</span>
                            </span>
                          ) : l.candidates.length ? (
                            <span className="break-words">{l.candidates.map((c) => c.sku).join(", ")}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {l.status === "fold" ? (
                            <Changes fills={l.fills} machineParts={l.machineParts} research={l.research} />
                          ) : l.status === "fix" ? (
                            <span>
                              SKU and MPN → {l.fixedSku}
                              {l.parent ? ` · parent ${l.parent}` : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge size="tight" variant={COPY_STATUS[l.status].tone}>
                            {COPY_STATUS[l.status].label}
                          </Badge>
                          {l.reason ? <span className="mt-0.5 block text-xs">{l.reason}</span> : null}
                        </td>
                      </tr>
                    ))}
                    {!shown.length ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-muted-foreground">
                          No import copies{show ? " like that" : ""}.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {lines.length > shown.length ? (
                <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setAll(true)} data-testid="copies-all">
                  Show all {n(lines.length)}
                </Button>
              ) : null}
              {preview.applied ? (
                <div className="flex justify-end border-t border-border pt-3">
                  <Button type="button" onClick={close} data-testid="copies-done">
                    Done
                  </Button>
                </div>
              ) : (
                <ApprovalButtons busy={save.isPending} canApprove={todo > 0} onApprove={() => save.mutate()} onCancel={close} verb="Clean Up" what={plural(todo, "Copy", "Copies")} />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------------------------------------ Part B

const MERGE_STATUS: Record<MergePlanStatus, { label: string; tone: Tone }> = {
  merge: { label: "Will merge", tone: "success" },
  done: { label: "Already merged", tone: "outline" },
  duplicate: { label: "Same row twice", tone: "outline" },
  error: { label: "Error", tone: "danger" },
};

function MergeBadges({ p }: { p: MergesPreview }) {
  const c = p.counts;
  return (
    <>
      <Badge variant="success" data-testid="merges-count-merge">
        Will merge {n(c.merge)}
      </Badge>
      <Badge variant="outline" data-testid="merges-count-done">
        Already merged {n(c.done)}
      </Badge>
      {c.duplicate ? (
        <Badge variant="outline" data-testid="merges-count-duplicate">
          Same row twice {n(c.duplicate)}
        </Badge>
      ) : null}
      <Badge variant="danger" data-testid="merges-count-errors">
        Errors {n(c.errors)}
      </Badge>
    </>
  );
}

function MergeRow({ l }: { l: MergePlanLine }) {
  return (
    <tr className={cn("border-b border-border align-top last:border-b-0", l.status === "merge" ? "" : "text-muted-foreground")} data-testid="merges-line" data-status={l.status} data-error={l.error ?? ""}>
      <td className="px-3 py-1.5 text-xs tabular">{l.line}</td>
      <td className="px-2 py-1.5 text-xs">{l.old ? <PartCell part={l.old} /> : <span className="break-all">{l.oldSku || "—"}</span>}</td>
      <td className="px-2 py-1.5 text-xs">{l.keeper ? <PartCell part={l.keeper} hiddenTag={false} /> : <span className="break-all">{l.newSku || "—"}</span>}</td>
      <td className="px-2 py-1.5 text-xs">
        {l.status === "merge" ? (
          <>
            <Changes fills={l.fills} machineParts={l.machineParts} research={l.research} />
            {l.note ? <span className="mt-0.5 block break-words">Note: {l.note}</span> : null}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-1.5">
        <Badge size="tight" variant={MERGE_STATUS[l.status].tone}>
          {MERGE_STATUS[l.status].label}
        </Badge>
        {l.reason ? <span className="mt-0.5 block text-xs">{l.reason}</span> : null}
      </td>
    </tr>
  );
}

const MERGE_FILES = ".csv,text/csv";

/**
 * Import Part Merges (CSV): old_sku, new_sku, note. Each old part is folded into the new one, which keeps its own
 * values and only fills blanks; the old number goes on its Previously list so searching it finds the new part.
 */
export function ImportPartMergesButton() {
  const refresh = useRefreshAll();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<MergesPreview | null>(null);
  const [show, setShow] = useState<MergePlanStatus | "">("");
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
      return { f: { name: f.name, base64 }, p: await importPartMerges({ data: { filename: f.name, base64, apply: false } }) };
    },
    onSuccess: ({ f, p }) => {
      setFile(f);
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const save = useMutation({
    mutationFn: () => importPartMerges({ data: { filename: file!.name, base64: file!.base64, apply: true } }),
    onSuccess: (r) => {
      setPreview(r);
      setShow("");
      setAll(false);
      toast.success(`${plural(r.result?.merged ?? 0, "part")} merged`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not merge the parts"),
  });
  const lines = (preview?.lines ?? []).filter((l) => !show || l.status === show);
  const shown = all ? lines : lines.slice(0, FIRST_LINES);
  return (
    <>
      <ActionButton icon={Merge} menuLabel="Import Part Merges (CSV)" onClick={() => setOpen(true)} data-testid="merges-open">
        Import Part Merges (CSV)
      </ActionButton>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-5xl" data-testid="merges-import">
          <DialogTitle>Import Part Merges</DialogTitle>
          <DialogDescription>
            A CSV with <span className="font-medium">old_sku</span>, <span className="font-medium">new_sku</span> and <span className="font-medium">note</span>, up to{" "}
            {n(MERGE_MAX_ROWS)} rows. Each old part is folded into the new one: the new part keeps its own values and only its blank MPN, name, photo, bin and Mfr List
            Price come from the old one; PM machine parts and photo research move over; the old number goes on the new part's Previously list with the note, so
            searching it finds the new part; and the old part is hidden, never deleted. Tickets, invoices, quotes and the QuickBooks history keep their text, and Parts
            usage counts it on the new part. Run Clean Up Import Copies first, so a copy doesn't make a number fit two parts.
          </DialogDescription>
          {!preview ? (
            <div className="flex flex-wrap items-center gap-2">
              <PickFile busy={read.isPending} onFile={(f) => read.mutate(f)} testId="merges-file" label="Pick The CSV File" accept={MERGE_FILES} />
            </div>
          ) : (
            <>
              <ApprovalHead filename={preview.filename} rowCount={preview.counts.rows}>
                <MergeBadges p={preview} />
              </ApprovalHead>
              {!preview.applied && preview.counts.merge ? (
                <p className="text-xs text-muted-foreground" data-testid="merges-moving">
                  {plural(preview.counts.filled, "part")} kept {preview.counts.filled === 1 ? "gets" : "get"} blank fields filled · {plural(preview.counts.machineParts, "PM machine part")}{" "}
                  {preview.counts.machineParts === 1 ? "moves" : "move"} ·{" "}
                  {plural(preview.counts.research, "photo research row")} copied
                </p>
              ) : null}
              {preview.applied && preview.result ? (
                <p className="rounded-lg border border-border p-3 text-sm" data-testid="merges-saved">
                  Done. {plural(preview.result.merged, "part")} merged into {plural(preview.result.keepers, "part")} kept, {plural(preview.result.moved, "PM machine part")}{" "}
                  moved, {plural(preview.result.research, "photo research row")} copied.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SelectField
                  value={show}
                  onChange={(e) => {
                    setShow(e.target.value as MergePlanStatus | "");
                    setAll(false);
                  }}
                  aria-label="Show"
                  className="h-9 w-auto"
                  allowEmpty
                  emptyLabel="All rows"
                  data-testid="merges-show"
                >
                  {(["merge", "done", "duplicate", "error"] as const).map((s) => (
                    <option key={s} value={s}>
                      {MERGE_STATUS[s].label}
                    </option>
                  ))}
                </SelectField>
                <span className="text-xs text-muted-foreground">{plural(lines.length, "row")}</span>
              </div>
              <div className="max-h-96 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="min-w-[10rem] px-2 py-2 font-medium">Old part</th>
                      <th className="min-w-[10rem] px-2 py-2 font-medium">Kept</th>
                      <th className="min-w-[12rem] px-2 py-2 font-medium">What changes</th>
                      <th className="min-w-[10rem] px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((l) => (
                      <MergeRow key={l.line} l={l} />
                    ))}
                  </tbody>
                </table>
              </div>
              {lines.length > shown.length ? (
                <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setAll(true)} data-testid="merges-all">
                  Show all {n(lines.length)}
                </Button>
              ) : null}
              {preview.applied ? (
                <div className="flex justify-end border-t border-border pt-3">
                  <Button type="button" onClick={close} data-testid="merges-done">
                    Done
                  </Button>
                </div>
              ) : (
                <ApprovalButtons
                  busy={save.isPending}
                  canApprove={preview.counts.merge > 0}
                  onApprove={() => save.mutate()}
                  onCancel={close}
                  verb="Merge"
                  what={plural(preview.counts.merge, "Part")}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
