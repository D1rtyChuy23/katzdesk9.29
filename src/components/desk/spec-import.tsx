import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileUp, ImagePlus, Loader2, Plus, RotateCcw, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { imageFileToDataUrl, pdfToText, MAX_PDF_BYTES } from "@/lib/pdf-text";
import { restoreRemoved, type RemovedItem } from "@/lib/ops/spec-filter";
import { emptyDraft, type Kv, type SpecSheetDraft } from "@/lib/ops/spec-schema";
import { extractSpecSheet, getSpecImage, saveSpecSheet } from "@/lib/ops/spec-library";
import type { SavedSpecSheet } from "@/lib/ops/spec-schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ConfigChips, EquipmentImage, PlugSection, REQUIREMENT_GROUPS } from "./spec-sheet";
import { applyConfigDefaults, coreHoleInfo, isEspresso } from "@/lib/ops/spec-defaults";

type Stage = "drop" | "reading" | "review";

/** Drop a PDF → AI reads it → review form → save. Also the blank manual form and the edit form. */
export function SpecImport({
  editing,
  aiReady,
  onSaved,
  onCancel,
}: {
  editing?: SavedSpecSheet | null;
  aiReady: boolean;
  onSaved: (id: number) => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<Stage>(editing ? "review" : "drop");
  const [draft, setDraft] = useState<SpecSheetDraft>(() => (editing ? strip(editing) : emptyDraft()));
  const [removed, setRemoved] = useState<RemovedItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [conflict, setConflict] = useState<{ manufacturer: string; model: string } | null>(null);

  async function readFile(file: File) {
    setFileName(file.name);
    setNotice(null);
    setRemoved([]);
    setStage("reading");
    try {
      setStep("Reading the PDF in your browser…");
      const { text, image } = await pdfToText(file);
      if (text.replace(/\s/g, "").length < 40) {
        manual("This PDF has no readable text (it looks scanned). Fill in the form by hand instead.", image);
        return;
      }
      if (!aiReady) {
        manual("AI reading isn't available here yet. Fill in the form by hand instead.", image);
        return;
      }
      setStep("Pulling out the specs…");
      // Only the text goes to the server; the equipment image stays in the browser until you save.
      const res = await extractSpecSheet({ data: { text, fileName: file.name } });
      if (!res.ok) {
        manual(res.message, image);
        return;
      }
      setDraft({ ...res.draft, image: image ?? undefined });
      setRemoved(res.removed);
      setStage("review");
      toast.success(
        res.removed.length
          ? `Read ${file.name}. ${res.removed.length} non-USA item${res.removed.length === 1 ? "" : "s"} removed — check the Removed panel.`
          : `Read ${file.name}. Check everything before saving.`,
      );
    } catch (e) {
      manual(e instanceof Error ? `${e.message} Fill in the form by hand instead.` : "Couldn't read that PDF.");
    }
  }

  function manual(message: string, image?: string | null) {
    setNotice(message || null);
    setDraft({ ...emptyDraft(), image: image ?? undefined });
    setRemoved([]);
    setStage("review");
  }

  const save = useMutation({
    mutationFn: (overwrite: boolean) => saveSpecSheet({ data: { draft, id: editing?.id ?? null, overwrite } }),
    onSuccess: (res) => {
      if (!res.ok) {
        setConflict(res.conflict);
        return;
      }
      setConflict(null);
      toast.success(`${draft.manufacturer} ${draft.model} saved to The Library`);
      onSaved(res.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  if (stage === "drop") {
    return <DropZone onFile={(f) => void readFile(f)} onManual={() => manual("")} onCancel={onCancel} aiReady={aiReady} />;
  }
  if (stage === "reading") {
    return (
      <section className="rounded-xl border border-border bg-card p-8 text-center" data-testid="spec-reading">
        <Loader2 className="mx-auto size-6 animate-spin text-copper" />
        <p className="mt-3 font-medium">{fileName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{step}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4" data-testid="spec-review">
      {notice ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm" role="status" data-testid="spec-notice">
          {notice}
        </p>
      ) : null}
      {removed.length ? (
        <RemovedPanel
          items={removed}
          onRestore={(item) => {
            setDraft((d) => restoreRemoved(d, item));
            setRemoved((list) => list.filter((r) => r.id !== item.id));
          }}
        />
      ) : null}
      <SpecEditor
        draft={draft}
        onChange={setDraft}
        title={editing ? "Edit Spec Sheet" : fileName ? `Review · ${fileName}` : "New Spec Sheet"}
        savedImageId={editing?.hasImage ? editing.id : null}
      />
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur">
        <Button
          type="button"
          disabled={save.isPending || !draft.manufacturer.trim() || !draft.model.trim() || coreHoleInfo(draft).missingDiameter}
          onClick={() => save.mutate(false)}
          data-testid="spec-save"
        >
          {save.isPending ? "Saving…" : editing ? "Save Changes" : "Confirm And Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {!draft.manufacturer.trim() || !draft.model.trim() ? (
          <span className="text-xs text-muted-foreground">Manufacturer and model are required.</span>
        ) : coreHoleInfo(draft).missingDiameter ? (
          <span className="text-xs text-warning">Counter core hole is Yes — add the hole diameter.</span>
        ) : removed.length ? (
          <span className="text-xs text-muted-foreground">{removed.length} removed item(s) stay out unless you restore them.</span>
        ) : null}
      </div>
      <Dialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent data-testid="spec-overwrite">
          <DialogTitle>Replace The Saved Sheet?</DialogTitle>
          <DialogDescription>
            {conflict?.manufacturer} {conflict?.model} is already in The Library. Saving replaces its specs and all of its
            configurations with this version.
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={() => save.mutate(true)} disabled={save.isPending} data-testid="spec-overwrite-yes">
              Replace It
            </Button>
            <Button type="button" variant="outline" onClick={() => setConflict(null)}>
              Keep The Saved One
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function strip(s: SavedSpecSheet): SpecSheetDraft {
  return {
    manufacturer: s.manufacturer,
    model: s.model,
    category: s.category,
    summary: s.summary,
    coreHole: s.coreHole,
    coreDiameter: s.coreDiameter,
    specs: s.specs,
    mfrNotes: { ...s.mfrNotes, certifications: s.mfrNotes.certifications ?? [] },
    configs: s.configs.length ? s.configs : [{ label: "Standard", requirements: {} }],
  };
}

function DropZone({
  onFile,
  onManual,
  onCancel,
  aiReady,
}: {
  onFile: (f: File) => void;
  onManual: () => void;
  onCancel: () => void;
  aiReady: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) {
      toast.error("Only PDF files can be imported.");
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      toast.error("That PDF is over 10 MB.");
      return;
    }
    onFile(f);
  }
  return (
    <section className="rounded-xl border border-border bg-card p-5" data-testid="spec-drop">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          over ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-muted/40",
        )}
      >
        <FileUp className="size-7 text-copper" />
        <span className="font-medium">Drop a manufacturer spec sheet here</span>
        <span className="text-sm text-muted-foreground">PDF only, up to 10 MB. Or tap to pick a file.</span>
        <span className="max-w-md text-xs text-muted-foreground">
          The PDF is read in your browser and is not kept. {aiReady ? "AI fills in the form; you check it before saving." : "AI reading isn't set up here, so you'll fill the form by hand."}
        </span>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          data-testid="spec-file"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onManual}>
          Fill In By Hand
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

function RemovedPanel({ items, onRestore }: { items: RemovedItem[]; onRestore: (item: RemovedItem) => void }) {
  return (
    <section className="rounded-xl border border-warning/40 bg-warning/5 p-4" data-testid="removed-panel">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldAlert className="size-4 text-warning" />
        Removed — Not For The USA ({items.length})
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Nothing is dropped silently. Restore anything that does apply.</p>
      <ul className="mt-3 divide-y divide-border/70">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="removed-item">
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">{r.where}</span>
              <span className="font-medium line-through decoration-warning/70">{r.removed}</span>
              <span className="text-muted-foreground"> — {r.note}</span>
              {r.kept ? <span className="block text-xs text-muted-foreground">Kept: {r.kept}</span> : null}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => onRestore(r)} data-testid={`restore-${r.id}`}>
              <RotateCcw className="size-3.5" /> Restore
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------- the editable form (same layout as the saved page) ----------------

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
  testId,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  testId?: string;
}) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}-${testId ?? ""}`;
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} className="mt-1 h-9" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
    </div>
  );
}

function KvRows({ rows, onChange, addLabel, testId }: { rows: Kv[]; onChange: (rows: Kv[]) => void; addLabel: string; testId: string }) {
  return (
    <div className="grid gap-2" data-testid={testId}>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
          <Input className="h-9" value={r.label} placeholder="Label" aria-label="Label" onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <Input className="h-9" value={r.value} placeholder="Value" aria-label="Value" onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <Button type="button" size="icon" variant="ghost" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <button type="button" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline" onClick={() => onChange([...rows, { label: "", value: "" }])}>
        <Plus className="size-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-border bg-background/60 p-4">
      <legend className="px-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function SpecEditor({
  draft,
  onChange,
  title,
  savedImageId,
}: {
  draft: SpecSheetDraft;
  onChange: (d: SpecSheetDraft) => void;
  title: string;
  /** Editing a saved sheet that already has an image. */
  savedImageId?: number | null;
}) {
  const [sel, setSel] = useState(0);
  const saved = useQuery({
    queryKey: ["spec-image", "edit", savedImageId],
    queryFn: () => getSpecImage({ data: { id: savedImageId! } }),
    enabled: !!savedImageId && draft.image === undefined,
  });
  const shownImage = draft.image === undefined ? saved.data?.image ?? null : draft.image;
  const fileRef = useRef<HTMLInputElement>(null);
  const core = coreHoleInfo(draft);
  const espresso = isEspresso(draft);
  const idx = Math.min(sel, Math.max(0, draft.configs.length - 1));
  const config = draft.configs[idx];
  const set = (patch: Partial<SpecSheetDraft>) => onChange({ ...draft, ...patch });
  const setReq = <K extends "power" | "water" | "drain" | "dimensions">(section: K, key: string, value: string) => {
    const configs = draft.configs.map((c, i) =>
      i === idx ? { ...c, requirements: { ...c.requirements, [section]: { ...(c.requirements[section] ?? {}), [key]: value } } } : c,
    );
    set({ configs });
  };
  const { POWER_FIELDS, WATER_FIELDS, DRAIN_FIELDS, DIM_FIELDS } = REQUIREMENT_GROUPS;

  return (
    <article className="rounded-xl border border-border bg-card p-5 sm:p-6" data-testid="spec-editor">
      <h2 className="font-display text-2xl font-medium tracking-tight">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Manufacturer" value={draft.manufacturer} onChange={(v) => set({ manufacturer: v })} testId="ed-manufacturer" />
        <Field label="Model" value={draft.model} onChange={(v) => set({ model: v })} testId="ed-model" />
        <Field label="Category" value={draft.category} onChange={(v) => set({ category: v })} placeholder="Espresso Machine, Grinder…" testId="ed-category" />
        <div className="sm:col-span-3">
          <Label htmlFor="ed-summary" className="text-xs text-muted-foreground">
            Summary
          </Label>
          <Textarea id="ed-summary" className="mt-1" rows={2} value={draft.summary ?? ""} onChange={(e) => set({ summary: e.target.value })} />
        </div>
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-[minmax(0,15rem)_1fr]">
        <div>
          <EquipmentImage image={shownImage} loading={saved.isLoading && !!savedImageId} manufacturer={draft.manufacturer} model={draft.model} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} data-testid="ed-image-pick">
              <ImagePlus className="size-3.5" /> {shownImage ? "Replace Image" : "Add Image"}
            </Button>
            {shownImage ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => set({ image: null })}>
                Remove
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              data-testid="ed-image-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                void imageFileToDataUrl(f)
                  .then((url) => set({ image: url }))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't use that image"));
              }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Taken from the spec sheet PDF when it has one.</p>
        </div>
        <fieldset className="rounded-lg border border-border bg-background/60 p-4" data-testid="ed-core">
          <legend className="px-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Space / Core Hole</legend>
          <p className="text-sm text-muted-foreground">Utility lines pass through the counter?</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="ed-core-hole" className="text-xs text-muted-foreground">
                Counter Core Hole
              </Label>
              <select
                id="ed-core-hole"
                className="mt-1 h-9 rounded-md border border-input bg-card px-3 text-sm"
                value={draft.coreHole ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  set({ coreHole: v === "yes" || v === "no" ? v : undefined });
                }}
              >
                <option value="">{espresso ? "Yes (espresso default)" : "Not stated"}</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <Field
              label="Hole Diameter"
              value={draft.coreDiameter}
              onChange={(v) => set({ coreDiameter: v })}
              placeholder={espresso ? '3" (default)' : 'e.g. 2"'}
              className="w-40"
              testId="ed-core-diameter"
            />
          </div>
          {core.required ? (
            <p
              className={cn("mt-3 text-sm font-semibold", core.missingDiameter ? "text-warning" : "text-foreground")}
              data-testid="ed-core-label"
            >
              {core.missingDiameter ? "Add the hole diameter — required before this spec is complete." : core.label}
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No counter core hole on this spec.</p>
          )}
        </fieldset>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-background/60 p-4">
          <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Specs</h3>
          <KvRows rows={draft.specs} onChange={(specs) => set({ specs })} addLabel="Add a spec" testId="ed-specs" />
        </div>
        <div className="grid content-start gap-3 rounded-lg border border-border bg-background/60 p-4">
          <h3 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Manufacturer (USA)</h3>
          <Field
            label="Certifications (comma separated)"
            value={(draft.mfrNotes.certifications ?? []).join(", ")}
            onChange={(v) => set({ mfrNotes: { ...draft.mfrNotes, certifications: v.split(",").map((x) => x.trimStart()) } })}
            placeholder="UL, NSF, ETL"
            testId="ed-certs"
          />
          <Field label="Warranty" value={draft.mfrNotes.warranty} onChange={(v) => set({ mfrNotes: { ...draft.mfrNotes, warranty: v } })} testId="ed-warranty" />
          <div>
            <Label htmlFor="ed-contact" className="text-xs text-muted-foreground">
              US Contact
            </Label>
            <Textarea id="ed-contact" className="mt-1" rows={2} value={draft.mfrNotes.usContact ?? ""} onChange={(e) => set({ mfrNotes: { ...draft.mfrNotes, usContact: e.target.value } })} />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Configurations</h3>
        <ConfigChips
          configs={draft.configs}
          selected={idx}
          onSelect={setSel}
          trailing={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                set({ configs: [...draft.configs, { label: `Configuration ${draft.configs.length + 1}`, requirements: {} }] });
                setSel(draft.configs.length);
              }}
              data-testid="ed-add-config"
            >
              <Plus className="size-3.5" /> Add
            </button>
          }
        />
        {config ? (
          <div className="mt-4 grid gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field
                label="Configuration Name"
                value={config.label}
                onChange={(v) => set({ configs: draft.configs.map((c, i) => (i === idx ? { ...c, label: v } : c)) })}
                className="min-w-56 flex-1"
                testId="ed-config-label"
              />
              {draft.configs.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    set({ configs: draft.configs.filter((_, i) => i !== idx) });
                    setSel(0);
                  }}
                >
                  <Trash2 className="size-3.5" /> Remove This Configuration
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Group title="Power">
                {POWER_FIELDS.map(([k, l]) => (
                  <Field key={k} label={l} value={config.requirements.power?.[k]} onChange={(v) => setReq("power", k, v)} testId={`ed-power-${k}`} />
                ))}
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    onClick={() => set({ configs: draft.configs.map((c, i) => (i === idx ? applyConfigDefaults(c, "generate") : c)) })}
                    data-testid="ed-plug-rules"
                  >
                    <RotateCcw className="size-3.5" /> Set Plug, Breaker And Inlet From The Electrical
                  </button>
                  <PlugSection power={config.requirements.power} />
                </div>
              </Group>
              <Group title="Water And Drain">
                {WATER_FIELDS.map(([k, l]) => (
                  <Field key={k} label={l} value={config.requirements.water?.[k]} onChange={(v) => setReq("water", k, v)} testId={`ed-water-${k}`} />
                ))}
                {DRAIN_FIELDS.map(([k, l]) => (
                  <Field key={`d-${k}`} label={l} value={config.requirements.drain?.[k]} onChange={(v) => setReq("drain", k, v)} testId={`ed-drain-${k}`} />
                ))}
              </Group>
              <Group title="Dimensions">
                {DIM_FIELDS.map(([k, l]) => (
                  <Field key={k} label={l} value={config.requirements.dimensions?.[k]} onChange={(v) => setReq("dimensions", k, v)} testId={`ed-dim-${k}`} />
                ))}
              </Group>
              <fieldset className="rounded-lg border border-border bg-background/60 p-4">
                <legend className="px-1 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Other</legend>
                <KvRows
                  rows={config.requirements.other ?? []}
                  onChange={(other) => set({ configs: draft.configs.map((c, i) => (i === idx ? { ...c, requirements: { ...c.requirements, other } } : c)) })}
                  addLabel="Add a requirement"
                  testId="ed-other"
                />
              </fieldset>
            </div>
          </div>
        ) : null}
      </section>
    </article>
  );
}
