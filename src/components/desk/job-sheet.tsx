import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createJob, getJob, listAssets, mergeServiceTickets, unassignAssetFromService, updateJob } from "@/lib/ops/api";
import { CALL_STATUSES, CALL_TYPES, URGENCIES } from "@/lib/ops/lookups";
import { formatLongDate } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea, Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DuplicateBadge, FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { Thread } from "./thread";
import { CustomerCombo, EquipmentMultiCombo, useDirectory } from "./directory-fields";
import { ProviderDispatchBlock } from "./provider-dispatch";
import { listedEquipment } from "@/lib/ops/equipment";
import type { ServiceJob } from "@/lib/ops/types";
import { toast } from "sonner";
import { TechSelect } from "./tech-select";
import { SerialNoticeBanner, SerialPullField } from "./serial-notice";

export function JobSheet({
  id,
  onClose,
}: {
  id: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const skipToast = useRef(false);
  const [viewId, setViewId] = useState<number | null>(id);
  useEffect(() => {
    setViewId(id);
  }, [id]);
  const activeId = viewId ?? id;
  const job = useQuery({
    queryKey: ["job", activeId],
    queryFn: () => getJob({ data: { id: activeId! } }),
    enabled: activeId != null,
  });
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateJob>[0]["data"]) => updateJob({ data: patch }),
    onSuccess: () => {
      if (!skipToast.current) toast.success("Saved");
      skipToast.current = false;
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const merge = useMutation({
    mutationFn: (pair: { keeperId: number; extraId: number }) => mergeServiceTickets({ data: pair }),
    onSuccess: (row) => {
      toast.success("Tickets merged");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      void qc.invalidateQueries({ queryKey: ["comments"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      if (row?.id) setViewId(row.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const j = job.data;
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const pulledSerial =
    (assets.data ?? []).find((a) => a.jobId === activeId)?.serial ?? "";
  return (
    <Sheet
      open={id != null}
      onOpenChange={(o) => {
        if (!o) {
          skipToast.current = true;
          formRef.current?.requestSubmit();
          onClose();
        }
      }}
    >
      <SheetContent>
        {j ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {j.kind === "tlc" ? "TLC + Factor" : "Service call"} · {j.callId}
              </p>
              <SheetTitle>{j.customer ?? "Untitled account"}</SheetTitle>
              <div className="mt-2 flex min-h-8 flex-wrap items-center gap-1.5">
                <UrgencyBadge urgency={j.urgency} />
                <StatusBadge status={j.status} />
                <FlagBadge flag={j.flag} />
                <DuplicateBadge duplicateOf={j.duplicateOf} siblingCount={j.siblings?.length ?? 0} />
              </div>
            </SheetHeader>
            <SheetBody>
              <SerialNoticeBanner notice={j.serialNotice} />
              <DuplicateBanner
                job={j}
                pending={merge.isPending}
                onOpen={(nextId) => setViewId(nextId)}
                onMergeIntoThis={(extraId) => merge.mutate({ keeperId: j.id, extraId })}
                onMergeThisInto={(keeperId) => merge.mutate({ keeperId, extraId: j.id })}
              />
              <form
                ref={formRef}
                key={j.id}
                className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  save.mutate({
                    id: j.id,
                    customer: String(fd.get("customer") ?? ""),
                    contact: String(fd.get("contact") || "") || null,
                    phone: String(fd.get("phone") || "") || null,
                    equipment: String(fd.get("equipment") || "") || null,
                    issue: String(fd.get("issue") || "") || null,
                    workDone: String(fd.get("workDone") || "") || null,
                    callType: String(fd.get("callType") || "") || null,
                    status: String(fd.get("status")),
                    technician: String(fd.get("technician") || "") || null,
                    wo: String(fd.get("wo") || "") || null,
                    scheduled: String(fd.get("scheduled") || "") || null,
                    received: String(fd.get("received") || "") || null,
                    completedAt: String(fd.get("completedAt") || "") || null,
                    notes: String(fd.get("notes") || "") || null,
                    urgency: String(fd.get("urgency") || "") || "Normal",
                  });
                }}
              >
                <BoundCustomer defaultValue={j.customer ?? ""} recordKey={j.id} />
                {j.customer ? (
                  <div className="sm:col-span-2">
                    <ProviderDispatchBlock customer={j.customer} />
                  </div>
                ) : null}
                <Field label="Contact" name="contact" defaultValue={j.contact ?? ""} />
                <Field label="Phone" name="phone" defaultValue={j.phone ?? ""} />
                <div className="sm:col-span-2">
                  <BoundEquipment defaultValue={j.equipment ?? ""} recordKey={j.id} />
                </div>
                <div className="sm:col-span-2">
                  <SerialPullField
                    label="Serial number"
                    value={pulledSerial}
                    jobId={j.id}
                    onValue={() => {}}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Type a warehouse serial to pull that unit onto this ticket without opening Warehouse.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="issue">Issue</Label>
                  <AutoGrowTextarea
                    id="issue"
                    name="issue"
                    defaultValue={j.issue ?? ""}
                    className="mt-1"
                    placeholder="What’s going on…"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="workDone">Description of work</Label>
                  <AutoGrowTextarea
                    id="workDone"
                    name="workDone"
                    defaultValue={j.workDone ?? ""}
                    className="mt-1"
                    placeholder="What was done on site…"
                  />
                </div>
                <div>
                  <Label htmlFor="urgency">Urgency</Label>
                  <SelectField id="urgency" name="urgency" className="mt-1" defaultValue={j.urgency || "Normal"}>
                    {URGENCIES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <Label>Status</Label>
                  <SelectField name="status" className="mt-1" defaultValue={j.status}>
                    {CALL_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <Label>Type</Label>
                  <SelectField name="callType" className="mt-1" defaultValue={j.callType ?? ""} allowEmpty>
                    {CALL_TYPES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </SelectField>
                </div>
                <div>
                  <Label>Technician</Label>
                  <TechSelect name="technician" defaultValue={j.technician ?? ""} />
                </div>
                <Field label="WO #" name="wo" defaultValue={j.wo ?? ""} />
                <Field label="Received" name="received" type="date" defaultValue={j.received ?? ""} />
                <Field label="Scheduled" name="scheduled" type="date" defaultValue={j.scheduled ?? ""} />
                <Field
                  label="Date completed"
                  name="completedAt"
                  type="date"
                  defaultValue={j.completedAt ?? ""}
                />
                <div className="sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" className="mt-1" defaultValue={j.notes ?? ""} />
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <p className="text-xs text-muted-foreground">
                    Received {formatLongDate(j.received)}
                    {j.ageDays != null ? ` · ${j.ageDays}d open` : ""}
                  </p>
                  <Button type="submit" size="sm" disabled={save.isPending}>
                    Save
                  </Button>
                </div>
              </form>
              <JobPulledUnits jobId={j.id} />
              <Thread entityType={j.kind} entityId={j.id} />
            </SheetBody>
          </>
        ) : (
          <div className="p-8 text-sm text-muted-foreground">Loading…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DuplicateBanner({
  job,
  pending,
  onOpen,
  onMergeIntoThis,
  onMergeThisInto,
}: {
  job: ServiceJob;
  pending: boolean;
  onOpen: (id: number) => void;
  onMergeIntoThis: (extraId: number) => void;
  onMergeThisInto: (keeperId: number) => void;
}) {
  if (job.duplicateOf) {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm">
        <p className="font-medium">This ticket was merged into another call with the same ST#.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The original keeps the notes, work, and history. Open that ticket to keep working it.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onOpen(job.duplicateOf!)}>
            Open original
          </Button>
        </div>
      </div>
    );
  }
  if (!job.siblings?.length) return null;
  return (
    <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm">
      <p className="font-medium">Same ST# is already on another ticket.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Corrigo uses one work order. Merge if these are the same call, or leave both if they are
        different accounts that reused the number.
      </p>
      <ul className="mt-2 space-y-2">
        {job.siblings.map((s) => (
          <li key={s.id} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="font-medium">{s.customer || "Untitled"}</p>
            <p className="text-xs text-muted-foreground">
              {s.callId}
              {s.wo ? ` · ${s.wo}` : ""}
              {s.kind === "tlc" ? " · TLC / Factor" : ""}
              {` · ${s.status}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onOpen(s.id)}>
                Open
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onMergeIntoThis(s.id)}
              >
                Merge into this
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onMergeThisInto(s.id)}
              >
                Merge this into the other
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete="off"
        className="mt-1"
      />
    </div>
  );
}

function JobPulledUnits({ jobId }: { jobId: number }) {
  const qc = useQueryClient();
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const pulled = (assets.data ?? []).filter((a) => a.jobId === jobId);
  const release = useMutation({
    mutationFn: (assetId: number) => unassignAssetFromService({ data: { assetId } }),
    onSuccess: () => {
      toast.success("Returned to the barn");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not return"),
  });
  if (!pulled.length) return null;
  return (
    <div className="border-b border-border bg-muted/40 p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Pulled from warehouse</p>
      <ul className="mt-2 space-y-1">
        {pulled.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {a.model} · {a.serial ?? "no serial"}
            </span>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
              disabled={release.isPending}
              onClick={() => release.mutate(a.id)}
            >
              Return to barn
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NewJobDialog({
  kind,
  open,
  onOpenChange,
  onCreated,
}: {
  kind: "service" | "tlc";
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [issue, setIssue] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [urgency, setUrgency] = useState("Normal");
  const create = useMutation({
    mutationFn: () =>
      createJob({
        data: {
          kind,
          customer,
          issue,
          urgency,
          equipment: equipment.length ? equipment.join("\n") : undefined,
          received: undefined,
        },
      }),
    onSuccess: (job) => {
      toast.success("Call opened");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
      setCustomer("");
      setIssue("");
      setEquipment([]);
      setUrgency("Normal");
      if (job?.id) onCreated(job.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>New {kind === "tlc" ? "TLC + Factor" : "service"} call</DialogTitle>
        <DialogDescription>Opens on today’s clock. Fill the rest in the drawer.</DialogDescription>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (customer.trim()) create.mutate();
          }}
        >
          <div className="min-w-0">
            <Label htmlFor="new-cust">Account / customer</Label>
            <div className="mt-1 min-w-0">
              <CustomerCombo
                label=""
                name="new-cust"
                value={customer}
                onChange={setCustomer}
                required
                menuInFlow
              />
            </div>
          </div>
          {customer.trim() ? <ProviderDispatchBlock customer={customer} /> : null}
          <div className="min-w-0">
            <EquipmentMultiCombo
              label="Equipment"
              values={equipment}
              onChange={setEquipment}
              placeholder="Search or add a machine…"
              menuInFlow
            />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Each machine is its own chip above the search.
            </p>
          </div>
          <div>
            <Label htmlFor="new-issue">Issue</Label>
            <AutoGrowTextarea
              id="new-issue"
              className="mt-1"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="What’s going on…"
            />
          </div>
          <div>
            <Label htmlFor="new-urgency">Urgency</Label>
            <SelectField
              id="new-urgency"
              className="mt-1"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              {URGENCIES.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </SelectField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || !customer.trim()}>
              Open call
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BoundCustomer({
  recordKey,
  defaultValue,
}: {
  recordKey: number;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    setValue(defaultValue);
  }, [recordKey, defaultValue]);
  return <CustomerCombo name="customer" value={value} onChange={setValue} />;
}

function BoundEquipment({
  recordKey,
  defaultValue,
}: {
  recordKey: number;
  defaultValue: string;
}) {
  const dir = useDirectory("equipment");
  const catalog = dir.items.map((i) => i.name);
  const catalogKey = catalog.join("\n");
  const [values, setValues] = useState(() =>
    catalog.length ? listedEquipment(defaultValue, catalog) : defaultValue.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
  );
  useEffect(() => {
    setValues(
      catalog.length
        ? listedEquipment(defaultValue, catalog)
        : defaultValue.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    );
  }, [recordKey, defaultValue, catalogKey]);
  return (
    <EquipmentMultiCombo
      name="equipment"
      values={values}
      onChange={setValues}
      placeholder="Add one or more machines…"
      menuInFlow
    />
  );
}
