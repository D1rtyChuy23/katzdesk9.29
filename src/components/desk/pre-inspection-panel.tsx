import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, ImagePlus, Images, Trash2 } from "lucide-react";
import {
  addInspectionEquipment,
  addInspectionPhoto,
  copyInspectionNa,
  getInstallInspection,
  removeInspectionPhoto,
  saveInspectionCoreHole,
  saveInspectionItem,
  saveInspectionMeta,
  type InspectionItem,
  type InspectionMachine,
  type InspectionPhoto,
  type InspectionView,
} from "@/lib/ops/inspection-api";
import { formatPingTime } from "@/lib/ops/clock";
import {
  CORE_HOLE_QUESTION,
  INSPECTION_ITEM_STATUSES,
  inspectorChoices,
  itemSaveError,
  showCoreHoleQuestion,
  spacePassError,
  type CoreHoleAnswer,
  type InspectionOverall,
} from "@/lib/ops/pre-inspection";
import { listReps } from "@/lib/ops/reps";
import { listTechs } from "@/lib/ops/roster";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { EquipmentCombo } from "./directory-fields";
import { UnitPlaceField } from "./unit-place-field";
import { toast } from "sonner";

export function InspectionBadge({
  overall,
  passed,
  total,
  className,
}: {
  overall: InspectionOverall | null | undefined;
  passed?: number;
  total?: number;
  className?: string;
}) {
  const label = overall ?? "Not started";
  const count = total && total > 0 ? ` ${passed ?? 0}/${total}` : "";
  const variant =
    label === "Passed" ? "success" : label === "Failed" ? "danger" : label === "In progress" ? "warn" : "outline";
  return (
    <Badge variant={variant} size="tight" className={className} data-testid="inspection-badge">
      Pre-inspection {label}
      {count}
    </Badge>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that photo"));
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

export function PreInspectionPanel({ installId }: { installId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["inspection", installId],
    queryFn: () => getInstallInspection({ data: { installId } }),
  });
  const [equipmentId, setEquipmentId] = useState<number | null>(null);

  function refresh(view?: InspectionView) {
    if (view) qc.setQueryData(["inspection", installId], view);
    void qc.invalidateQueries({ queryKey: ["inspection", installId] });
    void qc.invalidateQueries({ queryKey: ["installs"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["customer-history"] });
    void qc.invalidateQueries({ queryKey: ["account-equipment"] });
  }

  if (q.isLoading) {
    return <p className="px-4 py-4 text-sm text-muted-foreground">Loading machines…</p>;
  }
  if (q.isError || !q.data) {
    return (
      <p className="px-4 py-4 text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : "Could not load pre-inspection."}
      </p>
    );
  }

  const view = q.data;
  const machine = view.machines.find((m) => m.equipmentId === equipmentId) ?? null;

  return (
    <section data-testid="pre-inspection" className="relative">
      <p
        className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 text-base font-medium"
        data-testid="machine-progress"
      >
        {view.machineCount ? `${view.passedCount}/${view.machineCount}` : "0/0"} machines passed
      </p>
      {machine ? (
        <MachineDetail
          view={view}
          machine={machine}
          onBack={() => setEquipmentId(null)}
          onNext={() => {
            const i = view.machines.findIndex((m) => m.equipmentId === machine.equipmentId);
            const next = view.machines[i + 1];
            setEquipmentId(next ? next.equipmentId : null);
          }}
          onSaved={refresh}
        />
      ) : (
        <MachineList view={view} onOpen={setEquipmentId} onSaved={refresh} />
      )}
    </section>
  );
}

function MachineList({
  view,
  onOpen,
  onSaved,
}: {
  view: InspectionView;
  onOpen: (id: number) => void;
  onSaved: (v: InspectionView) => void;
}) {
  return (
    <div data-testid="machine-list">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div>
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Which machine?</h2>
        </div>
        <InspectionBadge overall={view.overall} passed={view.passedCount} total={view.machineCount} />
      </div>
      <p className="px-4 pt-1 text-xs text-muted-foreground">
        Pick the unit you are standing in front of. The others stay untouched.
      </p>
      {view.machines.length ? (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {view.machines.map((m) => (
            <li key={m.equipmentId}>
              <button
                type="button"
                data-testid={`inspect-machine-${m.equipmentId}`}
                onClick={() => onOpen(m.equipmentId)}
                className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-4 text-left active:bg-muted"
              >
                {m.thumb ? (
                  <img src={m.thumb} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] text-muted-foreground">
                    No photo
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[m.serial ? `SN ${m.serial}` : "No serial", m.electrical || "Electrical missing"].join(" · ")}
                  </span>
                </span>
                <InspectionBadge overall={m.overall} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">Add the unit at the site, then inspect only that one.</p>
      )}
      <AddMachine installId={view.installId} onSaved={onSaved} />
      <MetaForm view={view} onSaved={onSaved} />
    </div>
  );
}

function AddMachine({ installId, onSaved }: { installId: number; onSaved: (v: InspectionView) => void }) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [electrical, setElectrical] = useState("");
  const add = useMutation({
    mutationFn: () =>
      addInspectionEquipment({
        data: { installId, model, serial: serial || null, electrical: electrical || null },
      }),
    onSuccess: (view) => {
      toast.success("Equipment added");
      setModel("");
      setSerial("");
      setElectrical("");
      setOpen(false);
      onSaved(view);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add equipment"),
  });

  if (!open) {
    return (
      <div className="px-4 py-3">
        <Button type="button" size="sm" variant="outline" data-testid="add-inspection-equipment" onClick={() => setOpen(true)}>
          Add equipment
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-2 border-t border-border px-4 py-3"
      data-testid="add-equipment-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!model.trim()) {
          toast.error("Pick a model");
          return;
        }
        add.mutate();
      }}
    >
      <EquipmentCombo label="Model" value={model} onChange={setModel} menuInFlow required />
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`sn-${installId}`}>Serial</Label>
          <Input id={`sn-${installId}`} className="mt-1" value={serial} onChange={(e) => setSerial(e.target.value)} data-testid="add-equipment-serial" />
        </div>
        <div>
          <Label htmlFor={`el-${installId}`}>Electrical</Label>
          <Input
            id={`el-${installId}`}
            className="mt-1"
            value={electrical}
            onChange={(e) => setElectrical(e.target.value)}
            placeholder="120V or 220V"
            data-testid="add-equipment-electrical"
          />
        </div>
      </div>
      <UnitPlaceField serial={serial} model={model} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={add.isPending} data-testid="add-equipment-save">
          {add.isPending ? "Adding…" : "Add to this visit"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MetaForm({ view, onSaved }: { view: InspectionView; onSaved: (v: InspectionView) => void }) {
  const [inspector, setInspector] = useState(view.inspector ?? "");
  const [inspectedOn, setInspectedOn] = useState(view.inspectedOn ?? "");
  const [siteContact, setSiteContact] = useState(view.siteContact ?? "");
  const [notes, setNotes] = useState(view.notes ?? "");
  const [overrideReason, setOverrideReason] = useState(view.overrideReason ?? "");
  const reps = useQuery({ queryKey: ["reps"], queryFn: () => listReps() });
  const techs = useQuery({ queryKey: ["roster"], queryFn: () => listTechs() });
  const choices = inspectorChoices(reps.data?.reps ?? [], techs.data?.techs ?? [], inspector);
  const save = useMutation({
    mutationFn: () =>
      saveInspectionMeta({
        data: {
          installId: view.installId,
          inspector,
          inspectedOn: inspectedOn || null,
          siteContact,
          notes,
          overrideReason,
        },
      }),
    onSuccess: (next) => {
      toast.success("Site notes saved");
      onSaved(next);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <form
      className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <Label htmlFor={`insp-${view.installId}`}>Inspector</Label>
        <SelectField
          id={`insp-${view.installId}`}
          className="mt-1"
          data-testid="inspector"
          allowEmpty
          emptyLabel="Choose"
          value={choices.value}
          onChange={(e) => setInspector(e.target.value)}
        >
          {choices.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div>
        <Label htmlFor={`insp-date-${view.installId}`}>Inspection date</Label>
        <Input id={`insp-date-${view.installId}`} type="date" className="mt-1" value={inspectedOn} onChange={(e) => setInspectedOn(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`insp-contact-${view.installId}`}>Site contact</Label>
        <Input id={`insp-contact-${view.installId}`} className="mt-1" value={siteContact} onChange={(e) => setSiteContact(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`insp-notes-${view.installId}`}>Overall notes / blockers</Label>
        <Textarea id={`insp-notes-${view.installId}`} className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {view.overall !== "Passed" ? (
        <div className="sm:col-span-2">
          <Label htmlFor={`insp-over-${view.installId}`}>Override reason</Label>
          <Input
            id={`insp-over-${view.installId}`}
            className="mt-1"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Required only to mark installed before every machine passes"
          />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save site notes"}
        </Button>
      </div>
    </form>
  );
}

function MachineDetail({
  view,
  machine,
  onBack,
  onNext,
  onSaved,
}: {
  view: InspectionView;
  machine: InspectionMachine;
  onBack: () => void;
  onNext: () => void;
  onSaved: (v: InspectionView) => void;
}) {
  const sources = view.machines.filter(
    (m) => m.equipmentId !== machine.equipmentId && m.items.some((i) => i.status === "N/A"),
  );
  const copy = useMutation({
    mutationFn: (fromEquipmentId: number) =>
      copyInspectionNa({
        data: { installId: view.installId, fromEquipmentId, toEquipmentId: machine.equipmentId },
      }),
    onSuccess: (next) => {
      toast.success("Copied N/A notes");
      onSaved(next);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not copy"),
  });

  return (
    <div data-testid="machine-detail">
      <div className="flex items-start gap-2 px-3 pt-3">
        <Button type="button" size="sm" variant="outline" onClick={onBack} data-testid="inspection-back">
          <ChevronLeft className="size-4" />
          Machines
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{machine.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[machine.serial ? `SN ${machine.serial}` : "No serial", machine.electrical || "Electrical missing"].join(" · ")}
          </p>
        </div>
        <InspectionBadge overall={machine.overall} />
      </div>
      {sources.length ? (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {sources.map((m) => (
            <Button
              key={m.equipmentId}
              type="button"
              size="sm"
              variant="outline"
              disabled={copy.isPending}
              onClick={() => copy.mutate(m.equipmentId)}
            >
              Same as {m.name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="space-y-3 px-3 py-3 pb-24">
        {machine.items.map((item) =>
          item.category === "space" ? (
            <SpaceSection
              key={`${machine.equipmentId}-space`}
              view={view}
              machine={machine}
              item={item}
              onSaved={onSaved}
            />
          ) : (
            <ItemRow
              key={`${machine.equipmentId}-${item.category}`}
              installId={view.installId}
              equipmentId={machine.equipmentId}
              item={item}
              onSaved={onSaved}
            />
          ),
        )}
      </div>
      <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-card px-3 py-3">
        <Button type="button" className="h-12 flex-1 text-base" onClick={() => toast.success("Saved")}>
          Save
        </Button>
        <Button type="button" className="h-12 flex-1 text-base" variant="outline" onClick={onNext} data-testid="inspection-next">
          Next machine
        </Button>
      </div>
    </div>
  );
}

function SpaceSection({
  view,
  machine,
  item,
  onSaved,
}: {
  view: InspectionView;
  machine: InspectionMachine;
  item: InspectionItem;
  onSaved: (v: InspectionView) => void;
}) {
  const [spaceStatus, setSpaceStatus] = useState<string>(item.status);
  const show = showCoreHoleQuestion(spaceStatus, machine.coreNeeded);
  return (
    <div className="space-y-3" data-testid="space-core-section">
      <ItemRow
        installId={view.installId}
        equipmentId={machine.equipmentId}
        item={item}
        coreNeeded={machine.coreNeeded}
        onStatusChange={setSpaceStatus}
        onSaved={onSaved}
      />
      {show ? (
        <CoreHoleQuestion
          key={`${machine.equipmentId}-${machine.coreNeeded ?? "unset"}`}
          installId={view.installId}
          equipmentId={machine.equipmentId}
          answer={machine.coreNeeded}
          onSaved={onSaved}
        />
      ) : null}
      {show && machine.coreNeeded === "yes" ? (
        <ItemRow
          key={`${machine.equipmentId}-core`}
          installId={view.installId}
          equipmentId={machine.equipmentId}
          item={machine.core}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}

function CoreHoleQuestion({
  installId,
  equipmentId,
  answer,
  onSaved,
}: {
  installId: number;
  equipmentId: number;
  answer: CoreHoleAnswer | null;
  onSaved: (v: InspectionView) => void;
}) {
  const [picked, setPicked] = useState<CoreHoleAnswer | null>(answer);
  const save = useMutation({
    mutationFn: (next: CoreHoleAnswer) =>
      saveInspectionCoreHole({ data: { installId, equipmentId, answer: next } }),
    onSuccess: (view) => onSaved(view),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  useEffect(() => {
    setPicked(answer);
  }, [answer]);

  function choose(next: CoreHoleAnswer) {
    setPicked(next);
    if (next !== answer) save.mutate(next);
  }

  return (
    <div className="rounded-lg border border-border p-3" data-testid="core-hole-question">
      <p className="font-medium">{CORE_HOLE_QUESTION}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          data-testid="core-hole-yes"
          variant={picked === "yes" ? "default" : "outline"}
          className="h-14 text-base"
          aria-pressed={picked === "yes"}
          disabled={save.isPending}
          onClick={() => choose("yes")}
        >
          Yes
        </Button>
        <Button
          type="button"
          data-testid="core-hole-no"
          variant={picked === "no" ? "default" : "outline"}
          className="h-14 text-base"
          aria-pressed={picked === "no"}
          disabled={save.isPending}
          onClick={() => choose("no")}
        >
          No
        </Button>
      </div>
    </div>
  );
}

function ItemRow({
  installId,
  equipmentId,
  item,
  onSaved,
  coreNeeded,
  onStatusChange,
}: {
  installId: number;
  equipmentId: number;
  item: InspectionItem;
  onSaved: (v: InspectionView) => void;
  coreNeeded?: string | null;
  onStatusChange?: (status: string) => void;
}) {
  const [status, setStatus] = useState<string>(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const coreRef = useRef(coreNeeded);

  const save = useMutation({
    mutationFn: (next: { status: string; notes: string }) =>
      saveInspectionItem({
        data: { installId, equipmentId, category: item.category, status: next.status, notes: next.notes },
      }),
    onSuccess: (view) => onSaved(view),
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Could not save";
      setError(message);
    },
  });

  function check(nextStatus: string, nextNotes: string, photoCount: number) {
    if (coreNeeded !== undefined) {
      return spacePassError({ status: nextStatus, notes: nextNotes, photoCount, coreNeeded });
    }
    return itemSaveError({ status: nextStatus, notes: nextNotes, photoCount });
  }

  function persist(nextStatus: string, nextNotes: string, photoCount = item.photos.length) {
    const err = check(nextStatus, nextNotes, photoCount);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (nextStatus === item.status && nextNotes.trim() === (item.notes ?? "").trim()) return;
    save.mutate({ status: nextStatus, notes: nextNotes });
  }

  useEffect(() => {
    const prev = coreRef.current;
    coreRef.current = coreNeeded;
    if (prev === coreNeeded) return;
    if (coreNeeded !== "yes" && coreNeeded !== "no") return;
    if (status !== "Pass" || item.status === "Pass") return;
    persist(status, notes);
    // Retry Space Pass once Yes/No lands. persist closes over the latest status and notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreNeeded]);

  const remove = useMutation({
    mutationFn: (photoId: number) => removeInspectionPhoto({ data: { installId, photoId } }),
    onSuccess: (view) => onSaved(view),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove photo"),
  });

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const view = await addInspectionPhoto({
        data: { installId, equipmentId, category: item.category, dataUrl, caption: caption || null },
      });
      setCaption("");
      onSaved(view);
      const updated = view.machines
        .find((m) => m.equipmentId === equipmentId)
        ?.items.find((row) => row.category === item.category);
      if (status === "Pass" || status === "Fail") {
        persist(status, notes, updated?.photos.length ?? item.photos.length + 1);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3" data-testid={`inspect-${item.category}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{item.label}</p>
        <p className="text-[11px] text-muted-foreground">{item.photos.length} photo{item.photos.length === 1 ? "" : "s"}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
      <div className="mt-3 grid gap-3">
        <div
          role="group"
          aria-label={`${item.label} status`}
          data-testid={`inspect-status-${item.category}`}
          className="flex flex-wrap gap-1.5"
        >
          {INSPECTION_ITEM_STATUSES.map((s) => {
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                data-testid={`inspect-choice-${item.category}-${s}`}
                className={cn(
                  "h-8 rounded-full px-2.5 text-xs font-medium",
                  on ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground",
                )}
                onClick={() => {
                  setStatus(s);
                  onStatusChange?.(s);
                  persist(s, notes);
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
        <Textarea
          aria-label={`${item.label} notes`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => persist(status, notes)}
          placeholder={status === "N/A" ? "Why N/A — e.g. no drain on this grinder" : "Notes"}
          className="min-h-24 text-base"
        />
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <AddPhotoButton
        category={item.category}
        label={item.label}
        uploading={uploading}
        onFile={(file) => void upload(file)}
      />
      {item.photos.length ? (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {item.photos.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} pending={remove.isPending} onRemove={() => remove.mutate(photo.id)} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">Pass or Fail needs a photo of this machine.</p>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  onRemove,
  pending,
}: {
  photo: InspectionPhoto;
  onRemove: () => void;
  pending?: boolean;
}) {
  return (
    <li className="overflow-hidden rounded-md border border-border">
      <img src={photo.dataUrl} alt={photo.caption || photo.category} className="h-24 w-full object-cover" />
      <div className="flex items-start justify-between gap-1 px-2 py-1.5">
        <p className="min-w-0 text-[11px] text-muted-foreground">
          <span className="block truncate text-foreground">{photo.caption || "Photo"}</span>
          {[photo.uploadedBy, formatPingTime(photo.uploadedAt)].filter(Boolean).join(" · ")}
        </p>
        <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Remove photo" disabled={pending} onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

/**
 * One "Add photo" control per inspection item. Tapping it asks Camera or Library,
 * and the picked photo attaches to this utility on this machine.
 */
function AddPhotoButton({
  category,
  label,
  uploading,
  onFile,
}: {
  category: string;
  label: string;
  uploading: boolean;
  onFile: (file: File | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function away(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  function pick(input: HTMLInputElement | null) {
    setOpen(false);
    input?.click();
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div ref={boxRef} className="relative mt-3">
      <button
        type="button"
        disabled={uploading}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`inspect-add-photo-${category}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        <ImagePlus className="size-5" />
        {uploading ? "Uploading…" : "Add photo"}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`Add a ${label} photo`}
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-lift)]"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted"
            onClick={() => pick(cameraRef.current)}
          >
            <Camera className="size-4 text-primary" />
            <span>
              <span className="block font-medium">Camera</span>
              <span className="text-xs text-muted-foreground">Take a photo now</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm hover:bg-muted"
            onClick={() => pick(libraryRef.current)}
          >
            <Images className="size-4 text-primary" />
            <span>
              <span className="block font-medium">Choose from library</span>
              <span className="text-xs text-muted-foreground">Use a photo you already took</span>
            </span>
          </button>
        </div>
      ) : null}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={`inspect-photo-${category}`}
        onChange={onChange}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={`inspect-library-${category}`}
        onChange={onChange}
      />
    </div>
  );
}
