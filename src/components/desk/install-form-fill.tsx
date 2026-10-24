import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardPen } from "lucide-react";
import { toast } from "sonner";
import { saveInstallFormEntries, type InstallFormPayload } from "@/lib/ops/install-form-api";
import { formDate, type CheckNote } from "@/lib/ops/install-form";
import {
  NAME_MAX,
  NOTE_MAX,
  TECH_NOTE_MAX,
  TECH_NOTE_SECTIONS,
  emptyEntries,
  entryKey,
  stampText,
  type ChecklistKey,
  type FormEntries,
  type FormPatch,
  type TechNoteKey,
} from "@/lib/ops/install-form-entries";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SaveBar } from "./save-bar";

/** What the pop-up holds while the tech types: the saved entries as editable text. */
type Draft = {
  done: Record<string, boolean>;
  notes: Record<string, string>;
  techNotes: Partial<Record<TechNoteKey, string>>;
  verifiedBy: string;
  verifiedOn: string;
  techName: string;
  completedOn: string;
};

function draftOf(e: FormEntries): Draft {
  return {
    done: { ...e.done },
    notes: { ...e.notes },
    techNotes: { ...e.techNotes },
    verifiedBy: e.verifiedBy ?? "",
    verifiedOn: e.verifiedOn ?? "",
    techName: e.techName ?? "",
    completedOn: e.completedOn ?? "",
  };
}

const tidy = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const tidyBox = (v: string | undefined) => (v ?? "").replace(/\r\n?/g, "\n").trim();

/** Only what changed since the pop-up opened or last saved, so a Save never sends back someone else's entries. */
function patchOf(saved: FormEntries, d: Draft): FormPatch {
  const p: FormPatch = {};
  const done: Record<string, boolean> = {};
  for (const k of new Set([...Object.keys(saved.done), ...Object.keys(d.done)])) {
    if (!!saved.done[k] !== !!d.done[k]) done[k] = !!d.done[k];
  }
  if (Object.keys(done).length) p.done = done;
  const notes: Record<string, string | null> = {};
  for (const k of new Set([...Object.keys(saved.notes), ...Object.keys(d.notes)])) {
    const now = tidy(d.notes[k]);
    if ((saved.notes[k] ?? "") !== now) notes[k] = now || null;
  }
  if (Object.keys(notes).length) p.notes = notes;
  const boxes: Partial<Record<TechNoteKey, string | null>> = {};
  for (const { key } of TECH_NOTE_SECTIONS) {
    const now = tidyBox(d.techNotes[key]);
    if ((saved.techNotes[key] ?? "") !== now) boxes[key] = now || null;
  }
  if (Object.keys(boxes).length) p.techNotes = boxes;
  const scalar = (was: string | null, now: string) => (tidy(now) !== (was ?? "") ? tidy(now) || null : undefined);
  const verifiedBy = scalar(saved.verifiedBy, d.verifiedBy);
  if (verifiedBy !== undefined) p.verifiedBy = verifiedBy;
  const verifiedOn = scalar(saved.verifiedOn, d.verifiedOn);
  if (verifiedOn !== undefined) p.verifiedOn = verifiedOn;
  const techName = scalar(saved.techName, d.techName);
  if (techName !== undefined) p.techName = techName;
  const completedOn = scalar(saved.completedOn, d.completedOn);
  if (completedOn !== undefined) p.completedOn = completedOn;
  return p;
}

/** KatzDesk's own value on a checklist line, in words. */
function katzText(value: string): string {
  if (value === "YES") return "Yes";
  if (value === "NO") return "No";
  if (value === "PENDING") return "Pending";
  return value;
}

/**
 * Fill In Form: the tech's parts of the Equipment Request Form, in a pop-up that works on a phone (Chuy, 10/24). Done
 * ticks and notes on the checklists, Verified by, the Tech notes boxes and the sign-off are saved on the install;
 * customer, contact and equipment stay as the install window has them. Print and the PDF show what's saved.
 */
export function FillInFormButton({ data }: { data: InstallFormPayload }) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const close = () => {
    if (dirty && !window.confirm("Close without saving your changes?")) return;
    setDirty(false);
    setOpen(false);
  };
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)} data-testid="install-form-fill">
        <ClipboardPen className="size-4" />
        Fill In Form
      </Button>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <SheetContent className="sm:max-w-2xl" aria-describedby={undefined} data-testid="form-fill">
          {open ? <FillInPanel data={data} onDirty={setDirty} onClose={close} /> : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FillInPanel({ data, onDirty, onClose }: { data: InstallFormPayload; onDirty: (dirty: boolean) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState<FormEntries>(() => data.entries ?? emptyEntries());
  const [draft, setDraft] = useState<Draft>(() => draftOf(data.entries ?? emptyEntries()));
  const patch = useMemo(() => patchOf(saved, draft), [saved, draft]);
  const changed = Object.keys(patch).length > 0;
  useEffect(() => onDirty(changed), [changed, onDirty]);
  const locked = !!saved.approved;

  const save = useMutation({
    mutationFn: (extra: Pick<FormPatch, "sign" | "approve">) =>
      saveInstallFormEntries({ data: { installId: data.id, patch: { ...patch, ...extra } } }),
    onSuccess: (next, extra) => {
      setSaved(next);
      setDraft(draftOf(next));
      // The sheets behind the pop-up, Print and the PDF pick it up at once.
      qc.setQueryData<InstallFormPayload>(["install-form", data.id], (old) => (old ? { ...old, entries: next } : old));
      toast.success(
        extra.sign === true
          ? "Saved and signed"
          : extra.sign === false
            ? "Signature taken off"
            : extra.approve === true
              ? "Saved and approved"
              : extra.approve === false
                ? "Approval undone"
                : "Saved",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the form"),
  });

  const set = (fn: (d: Draft) => Draft) => setDraft((d) => fn(d));
  const box = (key: TechNoteKey) => (
    <TechNotesBox
      id={`form-fill-technotes-${key}`}
      value={draft.techNotes[key] ?? ""}
      onChange={(v) => set((d) => ({ ...d, techNotes: { ...d.techNotes, [key]: v } }))}
    />
  );
  const list = (key: ChecklistKey, title: string, role: string, rows: CheckNote[], after?: ReactNode) => (
    <Checklist
      list={key}
      title={title}
      role={role}
      rows={rows}
      draft={draft}
      onDone={(k, on) => set((d) => ({ ...d, done: { ...d.done, [k]: on } }))}
      onNote={(k, v) => set((d) => ({ ...d, notes: { ...d.notes, [k]: v } }))}
    >
      {after}
      {box(key)}
    </Checklist>
  );
  const mine = !!saved.signed && saved.signed.by === data.viewer;

  return (
    <>
      <SheetHeader>
        <SheetTitle>Fill in the form</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Install #{data.id}
          {data.customer ? ` · ${data.customer}` : ""}. Done ticks, notes, Tech notes and the sign-off save on this install.
          Customer, contact and equipment come from the install window.
        </p>
        {locked && saved.approved ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm" data-testid="form-fill-locked">
            <span className="min-w-0 flex-1">
              Approved by {stampText(saved.approved)}. The form is final
              {data.canApprove ? ": undo the approval to change it." : "; the owner can undo the approval to change it."}
            </span>
            {data.canApprove ? (
              <Button type="button" size="sm" variant="outline" onClick={() => save.mutate({ approve: false })} disabled={save.isPending} data-testid="form-fill-unapprove">
                Undo approval
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetHeader>
      <SheetBody className="px-4 py-4 sm:px-5">
        <fieldset disabled={locked || save.isPending} className="m-0 min-w-0 space-y-7 border-0 p-0">
          <Section title={TECH_NOTE_SECTIONS[0].title} note="From the install window">
            {box("account")}
          </Section>
          <Section title={TECH_NOTE_SECTIONS[1].title} note="From the install window">
            {box("equipment")}
          </Section>
          {list(
            "pre",
            "Pre-installation checklist",
            "Sales rep · Pre-inspection",
            data.pre,
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="form-fill-verified-by">Verified by</Label>
                <Input
                  id="form-fill-verified-by"
                  className="mt-1"
                  value={draft.verifiedBy}
                  placeholder={data.inspector ? `${data.inspector} (from KatzDesk)` : "Name"}
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  onChange={(e) => set((d) => ({ ...d, verifiedBy: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="form-fill-verified-on">Date</Label>
                <Input
                  id="form-fill-verified-on"
                  type="date"
                  className="mt-1"
                  value={draft.verifiedOn}
                  onChange={(e) => set((d) => ({ ...d, verifiedOn: e.target.value }))}
                />
                {data.inspectedOn && !draft.verifiedOn ? <p className="mt-1 text-xs text-muted-foreground">Blank shows {data.inspectedOn}, the inspection day.</p> : null}
              </div>
            </div>,
          )}
          {list("tasks", "Installation tasks", "Tech on site", data.tasks)}
          {list(
            "corrigo",
            "Corrigo account update tasks",
            "Tech or office",
            data.corrigo,
            <p className="text-sm text-muted-foreground">
              {data.workOrders.length > 1 ? "Corrigo work orders" : "Corrigo work order"}: {data.workOrders.join(", ") || "none yet"}
            </p>,
          )}

          <Section title="Sign-off">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-border p-3" data-testid="form-fill-tech">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Technician · Complete &amp; sign</p>
                <div>
                  <Label htmlFor="form-fill-tech-name">Name</Label>
                  <Input
                    id="form-fill-tech-name"
                    className="mt-1"
                    value={draft.techName}
                    placeholder={data.technician || "Technician"}
                    maxLength={NAME_MAX}
                    autoComplete="off"
                    onChange={(e) => set((d) => ({ ...d, techName: e.target.value }))}
                  />
                </div>
                <p className={saved.signed ? "text-sm font-medium text-primary" : "text-sm text-muted-foreground"} data-testid="form-fill-signed">
                  {saved.signed ? `Signed by ${stampText(saved.signed)}` : "Not signed yet"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!saved.signed || mine || data.canApprove ? (
                    <Button type="button" className="max-sm:h-11" onClick={() => save.mutate({ sign: true })} data-testid="form-fill-sign">
                      {saved.signed ? "Save & Sign Again" : "Save & Sign"}
                    </Button>
                  ) : null}
                  {saved.signed && (mine || data.canApprove) ? (
                    <Button type="button" variant="outline" className="max-sm:h-11" onClick={() => save.mutate({ sign: false })} data-testid="form-fill-unsign">
                      Take Signature Off
                    </Button>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="form-fill-completed">Date completed</Label>
                  <Input
                    id="form-fill-completed"
                    type="date"
                    className="mt-1"
                    value={draft.completedOn}
                    onChange={(e) => set((d) => ({ ...d, completedOn: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border p-3" data-testid="form-fill-owner">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Final approval · Owner</p>
                <p className={saved.approved ? "text-sm font-medium text-primary" : "text-sm text-muted-foreground"} data-testid="form-fill-approved">
                  {saved.approved ? `Approved by ${stampText(saved.approved)}` : "Waiting for approval"}
                </p>
                {data.canApprove ? (
                  <>
                    {!saved.approved ? (
                      <Button type="button" className="max-sm:h-11" onClick={() => save.mutate({ approve: true })} disabled={!saved.signed} data-testid="form-fill-approve">
                        Save &amp; Approve
                      </Button>
                    ) : null}
                    {!saved.signed ? <p className="text-xs text-muted-foreground">The technician signs first.</p> : null}
                    {!saved.approved ? <p className="text-xs text-muted-foreground">Date approved: the day you approve.</p> : null}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Only the owner approves, after the technician signs.</p>
                )}
                {saved.approved ? (
                  <p className="text-sm text-muted-foreground" data-testid="form-fill-approved-on">
                    Date approved: {formDate(saved.approvedOn) || "—"}
                  </p>
                ) : null}
              </div>
            </div>
            {box("signoff")}
          </Section>
        </fieldset>
      </SheetBody>
      <SaveBar
        onClick={() => (changed ? save.mutate({}) : toast.message("Nothing to save yet"))}
        pending={save.isPending}
        testId="form-fill-save-bar"
      >
        <Button type="button" variant="ghost" className="max-sm:h-12" onClick={onClose} data-testid="form-fill-close">
          Close
        </Button>
      </SaveBar>
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-lg font-medium">{title}</h3>
        {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Checklist({
  list,
  title,
  role,
  rows,
  draft,
  onDone,
  onNote,
  children,
}: {
  list: ChecklistKey;
  title: string;
  role: string;
  rows: CheckNote[];
  draft: Draft;
  onDone: (key: string, on: boolean) => void;
  onNote: (key: string, value: string) => void;
  children?: ReactNode;
}) {
  return (
    <Section title={title} note={role}>
      <ul className="divide-y divide-border rounded-lg border border-border" data-testid={`form-fill-${list}`}>
        {rows.map((row) => {
          const key = entryKey(list, row.label);
          const katz = katzText(row.notes);
          return (
            <li key={key} className="flex flex-col gap-2 px-3 py-3" data-testid="form-fill-line" data-key={key}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-6 shrink-0 accent-primary"
                  checked={!!draft.done[key]}
                  onChange={(e) => onDone(key, e.target.checked)}
                  data-testid="form-fill-done"
                />
                <span className="min-w-0 text-sm font-medium">
                  {row.label}
                  <span className="sr-only">: done</span>
                </span>
              </label>
              <div className="pl-9">
                <Input
                  value={draft.notes[key] ?? ""}
                  onChange={(e) => onNote(key, e.target.value)}
                  placeholder={katz ? `${katz} (from KatzDesk)` : "Note"}
                  maxLength={NOTE_MAX}
                  autoComplete="off"
                  aria-label={`${row.label}: note`}
                  data-testid="form-fill-note"
                />
              </div>
            </li>
          );
        })}
      </ul>
      {children}
    </Section>
  );
}

function TechNotesBox({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>Tech notes</Label>
      <Textarea
        id={id}
        className="mt-1 min-h-20"
        value={value}
        maxLength={TECH_NOTE_MAX}
        placeholder="Anything the office should know about this part"
        onChange={(e) => onChange(e.target.value)}
        data-testid={id}
      />
    </div>
  );
}
