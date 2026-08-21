import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createJob, getJob, updateJob } from "@/lib/ops/api";
import { CALL_STATUSES, CALL_TYPES, TECHNICIANS, URGENCIES } from "@/lib/ops/lookups";
import { formatLongDate } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { Thread } from "./thread";
import { CustomerCombo, EquipmentCombo } from "./directory-fields";
import { toast } from "sonner";

export function JobSheet({
  id,
  onClose,
}: {
  id: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const job = useQuery({
    queryKey: ["job", id],
    queryFn: () => getJob({ data: { id: id! } }),
    enabled: id != null,
  });
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateJob>[0]["data"]) => updateJob({ data: patch }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["job", id] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const j = job.data;
  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {j ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {j.kind === "tlc" ? "TLC + Factor" : "Service call"} · {j.callId}
              </p>
              <SheetTitle>{j.customer ?? "Untitled account"}</SheetTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <UrgencyBadge urgency={j.urgency} />
                <StatusBadge status={j.status} />
                <FlagBadge flag={j.flag} />
              </div>
            </SheetHeader>
            <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden">
              <form
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
                    callType: String(fd.get("callType") || "") || null,
                    status: String(fd.get("status")),
                    technician: String(fd.get("technician") || "") || null,
                    wo: String(fd.get("wo") || "") || null,
                    scheduled: String(fd.get("scheduled") || "") || null,
                    received: String(fd.get("received") || "") || null,
                    notes: String(fd.get("notes") || "") || null,
                    urgency: String(fd.get("urgency") || "") || "Normal",
                  });
                }}
              >
                <BoundCustomer defaultValue={j.customer ?? ""} recordKey={j.id} />
                <Field label="Contact" name="contact" defaultValue={j.contact ?? ""} />
                <Field label="Phone" name="phone" defaultValue={j.phone ?? ""} />
                <BoundEquipment defaultValue={j.equipment ?? ""} recordKey={j.id} />
                <div className="sm:col-span-2">
                  <Label htmlFor="issue">Issue</Label>
                  <Input id="issue" name="issue" defaultValue={j.issue ?? ""} className="mt-1" />
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
                  <SelectField name="technician" className="mt-1" defaultValue={j.technician ?? ""} allowEmpty>
                    {TECHNICIANS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </SelectField>
                </div>
                <Field label="WO #" name="wo" defaultValue={j.wo ?? ""} />
                <Field label="Received" name="received" type="date" defaultValue={j.received ?? ""} />
                <Field label="Scheduled" name="scheduled" type="date" defaultValue={j.scheduled ?? ""} />
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
              <Thread entityType={j.kind} entityId={j.id} />
            </div>
          </>
        ) : (
          <div className="p-8 text-sm text-muted-foreground">Loading…</div>
        )}
      </SheetContent>
    </Sheet>
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
  const [urgency, setUrgency] = useState("Normal");
  const create = useMutation({
    mutationFn: () =>
      createJob({
        data: { kind, customer, issue, urgency, received: undefined },
      }),
    onSuccess: (job) => {
      toast.success("Call opened");
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
      setCustomer("");
      setIssue("");
      setUrgency("Normal");
      if (job?.id) onCreated(job.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New {kind === "tlc" ? "TLC + Factor" : "service"} call</DialogTitle>
        <DialogDescription>Opens on today’s clock. Fill the rest in the drawer.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (customer.trim()) create.mutate();
          }}
        >
          <div>
            <Label htmlFor="new-cust">Account / customer</Label>
            <div className="mt-1">
              <CustomerCombo
                label=""
                name="new-cust"
                value={customer}
                onChange={setCustomer}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="new-issue">Issue</Label>
            <Input id="new-issue" className="mt-1" value={issue} onChange={(e) => setIssue(e.target.value)} />
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
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    setValue(defaultValue);
  }, [recordKey, defaultValue]);
  return <EquipmentCombo name="equipment" value={value} onChange={setValue} />;
}
