import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { importPartNotes, type NotesPreview } from "@/lib/ops/part-notes-api";
import { NOTE_ROWS_MAX, type NotePlanLine, type NoteStatus } from "@/lib/ops/part-notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { ActionButton } from "./desk-charts";
import { ApprovalButtons, ApprovalHead, PickFile } from "./part-imports";

/*
 * Parts → Import → Import Part Notes (CSV), Admin only (Grok's request through Chuy, 2026-10-29). The preview lists
 * each row's part, its note now, the note the row adds and what happens; nothing is written until Confirm. A note is
 * added on a new line under what the part has, which never changes. The planning is in part-notes.ts, the writing in
 * part-notes-api.ts.
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

const NOTE_STATUS: Record<NoteStatus, { label: string; tone: Tone }> = {
  add: { label: "Add", tone: "success" },
  already: { label: "Already there", tone: "outline" },
  not_found: { label: "Not found", tone: "danger" },
  ambiguous: { label: "Ambiguous", tone: "danger" },
  hidden: { label: "Hidden, skipped", tone: "warn" },
  merged: { label: "Merged away, skipped", tone: "warn" },
  invalid: { label: "Can't read, skipped", tone: "danger" },
  changed: { label: "Changed meanwhile, not added", tone: "warn" },
};

const SHOW_ORDER: NoteStatus[] = ["add", "already", "not_found", "ambiguous", "hidden", "merged", "invalid", "changed"];

const FIRST_LINES = 300;
const NOTE_FILES = ".csv,text/csv";
const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

function NoteBadges({ p }: { p: NotesPreview }) {
  const c = p.counts;
  const badge = (s: NoteStatus, v: number, label = NOTE_STATUS[s].label) => (
    <Badge key={s} variant={NOTE_STATUS[s].tone} data-testid={`notes-count-${s}`}>
      {label} {n(v)}
    </Badge>
  );
  return (
    <>
      {badge("add", c.add, p.applied ? "Added" : "Add")}
      {badge("already", c.already)}
      {badge("not_found", c.notFound)}
      {c.ambiguous ? badge("ambiguous", c.ambiguous) : null}
      {c.hidden ? badge("hidden", c.hidden) : null}
      {c.merged ? badge("merged", c.merged) : null}
      {c.invalid ? badge("invalid", c.invalid) : null}
      {c.changed ? badge("changed", c.changed) : null}
    </>
  );
}

function NoteRow({ l, applied }: { l: NotePlanLine; applied: boolean }) {
  const adds = l.status === "add";
  return (
    <tr className={cn("border-b border-border align-top last:border-b-0", adds ? "" : "text-muted-foreground")} data-testid="notes-line" data-status={l.status}>
      <td className="px-3 py-1.5 text-xs tabular">{l.line}</td>
      <td className="px-2 py-1.5 text-xs">
        {l.part ? (
          <>
            <span className="block font-medium break-words text-foreground">{l.part.name}</span>
            <span className="block whitespace-nowrap">
              SKU {l.part.sku} · id {l.part.id}
            </span>
          </>
        ) : (
          <span className="block break-all">{[l.idRaw ? `id ${l.idRaw}` : "", l.sku ? `SKU ${l.sku}` : ""].filter(Boolean).join(" · ") || "—"}</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-xs break-words whitespace-pre-line">{l.currentNote?.trim() ? l.currentNote : <span className="italic">none</span>}</td>
      <td className={cn("px-2 py-1.5 text-xs break-words", adds ? "font-medium text-foreground" : "")}>{l.note || "—"}</td>
      <td className="px-3 py-1.5">
        <Badge size="tight" variant={NOTE_STATUS[l.status].tone}>
          {adds && applied ? "Added" : NOTE_STATUS[l.status].label}
        </Badge>
        {l.reason ? <span className="mt-0.5 block text-xs">{l.reason}</span> : null}
      </td>
    </tr>
  );
}

/**
 * Import Part Notes (CSV): sku (or id) and note. Each note goes on a new line under the part's note; the part's other
 * fields never change.
 */
export function ImportPartNotesButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<NotesPreview | null>(null);
  const [show, setShow] = useState<NoteStatus | "">("");
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
      return { f: { name: f.name, base64 }, p: await importPartNotes({ data: { filename: f.name, base64, apply: false } }) };
    },
    onSuccess: ({ f, p }) => {
      setFile(f);
      setPreview(p);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not read that file"),
  });
  const save = useMutation({
    // Confirm sends the rows this preview shows as Add: the server writes only those.
    mutationFn: () =>
      importPartNotes({
        data: {
          filename: file!.name,
          base64: file!.base64,
          apply: true,
          expect: (preview?.lines ?? []).filter((l) => l.status === "add" && l.part).map((l) => ({ line: l.line, partId: l.part!.id })),
        },
      }),
    onSuccess: (r) => {
      setPreview(r);
      setShow("");
      setAll(false);
      const added = r.result?.added ?? 0;
      if (added) toast.success(`${plural(added, "note")} added to ${plural(r.result?.parts ?? 0, "part")}`);
      else toast.warning("No notes were added: the parts changed while this ran. Run the file again.");
      void qc.invalidateQueries({ queryKey: ["parts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add the notes"),
  });
  const busy = read.isPending || save.isPending;
  const lines = (preview?.lines ?? []).filter((l) => !show || l.status === show);
  const shown = all ? lines : lines.slice(0, FIRST_LINES);
  const present = SHOW_ORDER.filter((s) => preview?.lines.some((l) => l.status === s));
  return (
    <>
      <ActionButton icon={StickyNote} menuLabel="Import Part Notes (CSV)" onClick={() => setOpen(true)} data-testid="notes-import-open">
        Import Part Notes (CSV)
      </ActionButton>
      {/* The window stays open while a file is read or written, so a late answer can't land in a closed window. */}
      <Dialog open={open} onOpenChange={(o) => !o && !busy && close()}>
        <DialogContent className="sm:max-w-5xl" data-testid="notes-import">
          <DialogTitle>Import Part Notes</DialogTitle>
          <DialogDescription>
            A CSV with <span className="font-medium">sku</span> (or <span className="font-medium">id</span>) and <span className="font-medium">note</span>, up to{" "}
            {n(NOTE_ROWS_MAX)} rows. A row finds its part by id, else by its exact SKU, never by name. Each note goes on a new line under the part&apos;s note, which is never
            changed, and only the note changes; no part is ever created. A note the part already has is skipped, so the same file twice changes nothing. Hidden and
            merged-away parts are skipped and listed.
          </DialogDescription>
          {!preview ? (
            <div className="flex flex-wrap items-center gap-2">
              <PickFile busy={read.isPending} onFile={(f) => read.mutate(f)} testId="notes-import-file" label="Pick The CSV File" accept={NOTE_FILES} />
            </div>
          ) : (
            <>
              <ApprovalHead filename={preview.filename} rowCount={preview.counts.rows}>
                <NoteBadges p={preview} />
              </ApprovalHead>
              {preview.applied && preview.result ? (
                <p className="rounded-lg border border-border p-3 text-sm" data-testid="notes-saved">
                  Done. {plural(preview.result.added, "note")} added to {plural(preview.result.parts, "part")}; {plural(preview.counts.skipped, "row")} skipped,{" "}
                  {plural(preview.counts.notFound, "row")} not found.
                  {preview.result.changed ? ` ${plural(preview.result.changed, "row")} not added: the part changed while this ran. Run the file again for those.` : ""}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SelectField
                  value={show}
                  onChange={(e) => {
                    setShow(e.target.value as NoteStatus | "");
                    setAll(false);
                  }}
                  aria-label="Show"
                  className="h-9 w-auto"
                  allowEmpty
                  emptyLabel="All rows"
                  data-testid="notes-show"
                >
                  {present.map((s) => (
                    <option key={s} value={s}>
                      {NOTE_STATUS[s].label}
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
                      <th className="min-w-[11rem] px-2 py-2 font-medium">Part</th>
                      <th className="min-w-[12rem] px-2 py-2 font-medium">{preview.applied ? "Note before" : "Note now"}</th>
                      <th className="min-w-[12rem] px-2 py-2 font-medium">New note</th>
                      <th className="min-w-[9rem] px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((l, i) => (
                      <NoteRow key={`${i}-${l.line}`} l={l} applied={preview.applied} />
                    ))}
                  </tbody>
                </table>
              </div>
              {lines.length > shown.length ? (
                <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setAll(true)} data-testid="notes-all">
                  Show all {n(lines.length)}
                </Button>
              ) : null}
              {preview.applied ? (
                <div className="flex justify-end border-t border-border pt-3">
                  <Button type="button" onClick={close} data-testid="notes-done">
                    Done
                  </Button>
                </div>
              ) : (
                <ApprovalButtons
                  busy={save.isPending}
                  canApprove={preview.counts.add > 0}
                  onApprove={() => save.mutate()}
                  onCancel={close}
                  verb="Confirm"
                  what={plural(preview.counts.add, "Note")}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
