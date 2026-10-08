import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  archiveDeal,
  archiveInstall,
  assignAssetToInstall,
  createDeal,
  createInstall,
  createModule,
  createPm,
  listAssets,
  listDirectory,
  listRecipes,
  unassignAssetFromInstall,
  updateDeal,
  updateInstall,
  updateModule,
  updatePm,
} from "@/lib/ops/api";
import { AnchoredList } from "@/components/ui/anchored-list";
import {
  EQUIP_STATUSES,
  MODULE_PLATFORMS,
  MODULE_STATUSES,
  MODULE_TYPES,
  PARTS_STATUSES,
  PAYMENT_TERMS,
  PM_STATUSES,
  PM_STYLES,
  REQS_READY,
} from "@/lib/ops/lookups";

import { catalogModels, listedEquipment } from "@/lib/ops/equipment";
import { mergeMachineSpecs, serializeMachines, type MachineSpec } from "@/lib/ops/machines";
import type { Asset, Deal, Install, ModuleRow, PmJob } from "@/lib/ops/types";
import { moneyExact } from "@/lib/ops/clock";
import { PreInspectionPanel, InspectionBadge } from "./pre-inspection-panel";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, AutoGrowTextarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FlagBadge, StatusBadge } from "./flag-badge";
import { Badge } from "@/components/ui/badge";
import { Thread } from "./thread";
import { CustomerCombo, EquipmentCombo, EquipmentMultiCombo, LockedCustomer } from "./directory-fields";
import { TechSelect } from "./tech-select";
import { RepSelect } from "./rep-select";
import { AkBadge } from "./ak-badge";

import { MachineFields } from "./machine-fields";
import { SerialNoticeBanner } from "./serial-notice";
import { AssignedLine, ModuleReturnActions } from "./module-assign";
import { moduleAvailability } from "@/lib/ops/eversys";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ChevronsUpDown, Trash2, X } from "lucide-react";

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1"
      />
    </div>
  );
}

function BoundCustomer({
  recordKey,
  defaultValue,
  name = "customer",
  required,
  locked,
}: {
  recordKey: number | string;
  defaultValue: string;
  name?: string;
  required?: boolean;
  locked?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    setValue(defaultValue);
  }, [recordKey, defaultValue]);
  if (locked) return <LockedCustomer name={defaultValue} inputName={name} />;
  return <CustomerCombo name={name} value={value} onChange={setValue} required={required} />;
}

function BoundEquipment({
  recordKey,
  defaultValue,
  name = "equipment",
}: {
  recordKey: number | string;
  defaultValue: string;
  name?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    setValue(defaultValue);
  }, [recordKey, defaultValue]);
  return <EquipmentCombo name={name} value={value} onChange={setValue} />;
}

export function PmSheet({
  pm,
  onClose,
  lockCustomer = false,
}: {
  pm: PmJob | null;
  onClose: () => void;
  lockCustomer?: boolean;
}) {
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const skipToast = useRef(false);
  const save = useMutation({
    mutationFn: (d: Parameters<typeof updatePm>[0]["data"]) => updatePm({ data: d }),
    onSuccess: () => {
      if (!skipToast.current) toast.success("Saved");
      skipToast.current = false;
      void qc.invalidateQueries({ queryKey: ["pms"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  return (
    <Sheet
      open={!!pm}
      onOpenChange={(o) => {
        if (!o) {
          skipToast.current = true;
          formRef.current?.requestSubmit();
          onClose();
        }
      }}
    >
      <SheetContent>
        {pm ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Preventative maintenance</p>
              <SheetTitle>{pm.customer}</SheetTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge status={pm.status} />
                <FlagBadge flag={pm.flag} />
              </div>
            </SheetHeader>
            <SheetBody>
            <form
              ref={formRef}
              className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save.mutate({
                  id: pm.id,
                  customer: String(fd.get("customer")),
                  equipment: String(fd.get("equipment") || "") || null,
                  style: String(fd.get("style") || "") || null,
                  projected: String(fd.get("projected") || "") || null,
                  partsStatus: String(fd.get("partsStatus") || "") || null,
                  status: String(fd.get("status")),
                  technician: String(fd.get("technician") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                  wo: String(fd.get("wo") || "") || null,
                  workDone: String(fd.get("workDone") || "") || null,
                  completedAt: String(fd.get("completedAt") || "") || null,
                });
              }}
            >
              <BoundCustomer recordKey={pm.id} defaultValue={pm.customer} required locked={lockCustomer} />
              <BoundEquipment recordKey={pm.id} defaultValue={pm.equipment ?? ""} />
              <div>
                <Label>PM style</Label>
                <SelectField name="style" className="mt-1" defaultValue={pm.style ?? ""} allowEmpty>
                  {PM_STYLES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <div>
                <Label>Status</Label>
                <SelectField name="status" className="mt-1" defaultValue={pm.status}>
                  {PM_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <Field label="Projected date" name="projected" type="date" defaultValue={pm.projected ?? ""} />
              <div>
                <Label>Parts</Label>
                <SelectField name="partsStatus" className="mt-1" defaultValue={pm.partsStatus ?? ""} allowEmpty>
                  {PARTS_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <div>
                <Label>Tech</Label>
                <TechSelect name="technician" defaultValue={pm.technician ?? ""} />
              </div>
              <Field label="WO #" name="wo" defaultValue={pm.wo ?? ""} />
              <Field label="Date completed" name="completedAt" type="date" defaultValue={pm.completedAt ?? ""} />
              <div className="sm:col-span-2">
                <Label htmlFor={`pm-work-${pm.id}`}>Description of work</Label>
                <AutoGrowTextarea
                  id={`pm-work-${pm.id}`}
                  name="workDone"
                  className="mt-1"
                  defaultValue={pm.workDone ?? ""}
                  placeholder="What was done on site…"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" className="mt-1" defaultValue={pm.notes ?? ""} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>
            <Thread entityType="pm" entityId={pm.id} />
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function InstallSheet({
  row,
  onClose,
  onOpenRelated,
  lockCustomer = false,
}: {
  row: Install | null;
  onClose: () => void;
  onOpenRelated?: (id: number) => void;
  lockCustomer?: boolean;
}) {
  const qc = useQueryClient();
  const recs = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes() });
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const directoryEquip = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
  });
  const [customer, setCustomer] = useState(row?.customer ?? "");
  const [equipPieces, setEquipPieces] = useState<string[]>([]);
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [hydratedId, setHydratedId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const skipToast = useRef(false);
  const catalog = catalogModels([
    ...(directoryEquip.data ?? []).map((e) => e.name),
    ...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
    ...(recs.data ?? []).map((r) => r.equipmentModel),
  ]);
  useEffect(() => {
    setCustomer(row?.customer ?? "");
    const saved = row?.machines ?? [];
    const fromSaved = saved.map((s) => s.equipment).filter(Boolean);
    const names = catalog.length
      ? listedEquipment(fromSaved.join("\n") || row?.equipment, catalog)
      : fromSaved.length
        ? fromSaved
        : (row?.equipment ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    setEquipPieces(names);
    setSpecs(
      mergeMachineSpecs(names, saved, {
        serial: row?.serial,
        powerVoltage: row?.powerVoltage,
      }),
    );
    setHydratedId(row?.id ?? null);
  }, [row?.id, catalog.join("\n")]);
  const save = useMutation({
    mutationFn: (d: Parameters<typeof updateInstall>[0]["data"]) => updateInstall({ data: d }),
    onSuccess: (_row, vars) => {
      const keys = Object.keys(vars).filter((k) => k !== "id");
      const machineOnly = keys.every((k) =>
        ["equipment", "serial", "powerVoltage", "machines"].includes(k),
      );
      if (!machineOnly && !skipToast.current) toast.success("Saved");
      skipToast.current = false;
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["inspection", vars.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const dropInstall = useMutation({
    mutationFn: () => archiveInstall({ data: { id: row!.id } }),
    onSuccess: () => {
      toast.success(`Removed ${row?.customer} from the list`);
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  function persistMachines(next: MachineSpec[]) {
    setSpecs(next);
    setEquipPieces(next.map((s) => s.equipment));
    if (!row) return;
    const packed = serializeMachines(next);
    save.mutate({
      id: row.id,
      equipment: packed.equipment,
      serial: packed.serial,
      powerVoltage: packed.powerVoltage,
      machines: packed.machines,
    });
  }

  return (
    <Sheet
      open={!!row}
      onOpenChange={(o) => {
        if (!o) {
          skipToast.current = true;
          formRef.current?.requestSubmit();
          onClose();
        }
      }}
    >
      <SheetContent className="sm:max-w-4xl">
        {row ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Install</p>
              <SheetTitle>{row.customer}</SheetTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <InspectionBadge
                  overall={row.inspection?.overall}
                  passed={row.inspection?.passedCount}
                  total={row.inspection?.machineCount}
                />
                <StatusBadge tight status={row.equipStatus} />
                <FlagBadge flag={row.flag} />
                {row.duplicateOf ? <Badge variant="warn">Possible duplicate</Badge> : null}
              </div>
              <label className="mt-3 flex w-fit items-center gap-2 text-sm font-medium" data-testid="trf-check-window">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={row.trfIssued}
                  disabled={save.isPending}
                  onChange={(e) => save.mutate({ id: row.id, trfIssued: e.target.checked })}
                />
                Tech Request Form issued
              </label>
            </SheetHeader>
            <SheetBody>
            <PreInspectionPanel installId={row.id} />
            <SerialNoticeBanner notice={row.serialNotice} />
            {row.duplicateOf ? (
              <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm">
                <p className="font-medium">This account already had an install request.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check the earlier one before treating this as a second job — or clear the flag if it’s a new request.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {onOpenRelated ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenRelated(row.duplicateOf!)}>
                      Open earlier request
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => save.mutate({ id: row.id, duplicateOf: null })}
                  >
                    Not a duplicate
                  </Button>
                </div>
              </div>
            ) : null}
            <InstallAssets installId={row.id} />
            <form
              ref={formRef}
              key={row.id}
              className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const packed = serializeMachines(specs);
                save.mutate({
                  id: row.id,
                  customer: String(fd.get("customer") || row.customer),
                  equipment: packed.equipment,
                  equipStatus: String(fd.get("equipStatus") || "") || null,
                  installDate: String(fd.get("installDate") || "") || null,
                  technician: String(fd.get("technician") || "") || null,
                  wo: String(fd.get("wo") || "") || null,
                  reqsReady: String(fd.get("reqsReady") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                  workDone: String(fd.get("workDone") || "") || null,
                  completedAt: String(fd.get("completedAt") || "") || null,
                  accountRep: String(fd.get("accountRep") || "") || null,
                  aviKatz: fd.get("aviKatz") === "on",
                  paymentStatus: String(fd.get("paymentStatus") || "") || null,
                  serial: packed.serial,
                  powerVoltage: packed.powerVoltage,
                  machines: packed.machines,
                });
              }}
            >
              <input type="hidden" name="customer" value={customer || row.customer} />
              <div className="sm:col-span-2">
                <EquipmentMultiCombo
                  values={equipPieces}
                  hideChips
                  placeholder="Add another…"
                  onChange={(next) => {
                    try {
                      persistMachines(mergeMachineSpecs(next, specs));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not update equipment");
                    }
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <MachineFields
                  specs={specs}
                  installId={row.id}
                  customer={row.customer}
                  recipes={recs.data ?? []}
                  onChange={setSpecs}
                  onPulled={(next) => persistMachines(next)}
                  onRecipe={(next) => persistMachines(next)}
                  onRemove={(index) => {
                    try {
                      persistMachines(specs.filter((_, i) => i !== index));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not update equipment");
                    }
                  }}
                />
              </div>
              <div>
                <Label>Equipment status</Label>
                <SelectField name="equipStatus" className="mt-1" defaultValue={row.equipStatus ?? ""} allowEmpty>
                  {EQUIP_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <Field label="Install date" name="installDate" type="date" defaultValue={row.installDate ?? ""} />
              <div>
                <Label>Tech</Label>
                <TechSelect name="technician" defaultValue={row.technician ?? ""} />
              </div>
              <Field label="WO #" name="wo" defaultValue={row.wo ?? ""} />
              <div>
                <Label>Site ready?</Label>
                <SelectField name="reqsReady" className="mt-1" defaultValue={row.reqsReady ?? ""} allowEmpty>
                  {REQS_READY.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <RepSelect name="accountRep" label="Account rep" defaultValue={row.accountRep ?? ""} />
              <label className="flex items-center gap-2 text-sm sm:mt-7">
                <input
                  type="checkbox"
                  name="aviKatz"
                  className="size-4 accent-primary"
                  defaultChecked={row.aviKatz}
                />
                Avi Katz account (AK)
                <AkBadge on={row.aviKatz} />
              </label>

              <div>
                <Label>Payment</Label>
                <SelectField name="paymentStatus" className="mt-1" defaultValue={row.paymentStatus ?? ""} allowEmpty>
                  {PAYMENT_TERMS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <Field label="Date completed" name="completedAt" type="date" defaultValue={row.completedAt ?? ""} />
              <div className="sm:col-span-2">
                <Label htmlFor={`install-work-${row.id}`}>Description of work</Label>
                <AutoGrowTextarea
                  id={`install-work-${row.id}`}
                  name="workDone"
                  className="mt-1"
                  defaultValue={row.workDone ?? ""}
                  placeholder="What was done on site…"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" className="mt-1" defaultValue={row.notes ?? ""} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={dropInstall.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove “${row.customer}” from the install list?`)) dropInstall.mutate();
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Remove from list
                </Button>
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>
            <Thread entityType="install" entityId={row.id} />
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** More than this many machines and the rows fold into one line with a count. */
const DEAL_ROWS_OPEN = 3;

/**
 * Every machine on the deal in one section: Add Equipment puts another row here (model, serial, voltage,
 * location). The account is already open, so no customer is asked for again.
 */
function DealMachines({
  specs,
  onChange,
  onPersist,
}: {
  specs: MachineSpec[];
  onChange: (next: MachineSpec[]) => void;
  onPersist: (next: MachineSpec[]) => void;
}) {
  const [open, setOpen] = useState(specs.length <= DEAL_ROWS_OPEN);
  const [seen, setSeen] = useState(specs.length);
  useEffect(() => {
    // A new row opens the list so it can be filled in; a long list loaded later starts folded.
    if (specs.length > seen) setOpen(true);
    else if (seen === 0 && specs.length > DEAL_ROWS_OPEN) setOpen(false);
    setSeen(specs.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs.length]);
  const many = specs.length > DEAL_ROWS_OPEN;
  const count = `${specs.length} machine${specs.length === 1 ? "" : "s"}`;
  return (
    <section className="rounded-lg border border-border p-3 sm:col-span-2" data-testid="deal-machines" data-open={open ? "true" : "false"}>
      <div className="flex items-center gap-2">
        {many ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex min-h-9 items-center gap-1.5 text-left"
            data-testid="deal-machines-toggle"
          >
            {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            <span className="text-sm font-medium">Equipment</span>
          </button>
        ) : (
          <span className="text-sm font-medium">Equipment</span>
        )}
        <span className="text-xs text-muted-foreground" data-testid="deal-machines-count">{specs.length ? count : "None yet"}</span>
      </div>
      {many && !open ? (
        <p className="mt-1 truncate text-xs text-muted-foreground" data-testid="deal-machines-folded">
          {specs.map((s) => s.equipment).join(" · ")}
        </p>
      ) : (
        <MachineFields
          specs={specs}
          onChange={onChange}
          showRecipe={false}
          where="deal"
          onRemove={(index) => onPersist(specs.filter((_, i) => i !== index))}
        />
      )}
      <div className="mt-2" data-testid="deal-add-equipment">
        <div>
          <EquipmentMultiCombo
            label="Add Equipment"
            name="dealAddModel"
            values={specs.map((s) => s.equipment)}
            hideChips
            placeholder="Pick a model to add a row…"
            onChange={(next) => onPersist(mergeMachineSpecs(next, specs))}
          />
        </div>
      </div>
    </section>
  );
}

export function DealSheet({
  deal,
  onClose,
  lockCustomer = false,
}: {
  deal: Deal | null;
  onClose: () => void;
  lockCustomer?: boolean;
}) {
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const directoryEquip = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
    enabled: !!deal,
  });
  const catalogNames = (directoryEquip.data ?? []).map((e) => e.name);
  // One row per machine. Older deals kept only the equipment text: split it into rows the first time.
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [specsFor, setSpecsFor] = useState<number | null>(null);
  useEffect(() => {
    if (!deal) {
      setSpecsFor(null);
      return;
    }
    if (specsFor === deal.id && specs.length) return;
    setSpecs(deal.machines.length ? deal.machines : mergeMachineSpecs(listedEquipment(deal.equipment, catalogNames), []));
    setSpecsFor(deal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id, deal?.machines.length, catalogNames.length]);
  const skipToast = useRef(false);
  const save = useMutation({
    mutationFn: (d: Parameters<typeof updateDeal>[0]["data"]) => updateDeal({ data: d }),
    onSuccess: () => {
      if (!skipToast.current) toast.success("Saved");
      skipToast.current = false;
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const dropDeal = useMutation({
    mutationFn: () => archiveDeal({ data: { id: deal!.id } }),
    onSuccess: () => {
      toast.success(`Removed ${deal?.customer} from the list`);
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
  return (
    <Sheet
      open={!!deal}
      onOpenChange={(o) => {
        if (!o) {
          skipToast.current = true;
          formRef.current?.requestSubmit();
          onClose();
        }
      }}
    >
      <SheetContent>
        {deal ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Pipeline · {moneyExact(deal.amount)}
              </p>
              <SheetTitle>{deal.customer}</SheetTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge
                  status={
                    deal.completion === "complete"
                      ? "Complete"
                      : deal.completion === "fell"
                        ? "Fell through"
                        : "Open"
                  }
                />
              </div>
            </SheetHeader>
            <SheetBody>
            <form
              ref={formRef}
              className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const amountRaw = String(fd.get("amount") || "").replace(/[$,]/g, "").trim();
                const amountNum = amountRaw ? Number(amountRaw) : NaN;
                save.mutate({
                  id: deal.id,
                  customer: String(fd.get("customer")),
                  producer: String(fd.get("producer") || "") || null,
                  aviKatz: fd.get("aviKatz") === "on",
                  machines: specs,
                  amount: Number.isFinite(amountNum) ? amountNum : null,
                  goodToOrder: fd.get("goodToOrder") === "on" || fd.get("ordered") === "on",
                  ordered: fd.get("ordered") === "on",
                  eta: String(fd.get("eta") || "") || null,
                  terms: String(fd.get("terms") || "") || null,
                  invoice: String(fd.get("invoice") || "") || null,
                  completion: String(fd.get("completion") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                });
              }}
            >
              <BoundCustomer recordKey={deal.id} defaultValue={deal.customer} required locked={lockCustomer} />
              <RepSelect name="producer" label="Rep" defaultValue={deal.producer ?? ""} />
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="aviKatz"
                  className="size-4 accent-primary"
                  defaultChecked={deal.aviKatz}
                />
                Avi Katz account (AK)
                <AkBadge on={deal.aviKatz} />
              </label>

              <DealMachines
                specs={specs}
                onChange={setSpecs}
                onPersist={(next) => {
                  setSpecs(next);
                  skipToast.current = true;
                  save.mutate({ id: deal.id, machines: next });
                }}
              />
              <Field label="Equipment Package Amount" name="amount" defaultValue={deal.amount != null ? String(deal.amount) : ""} />
              <div>
                <Label>Payment terms</Label>
                <SelectField name="terms" className="mt-1" defaultValue={deal.terms ?? ""} allowEmpty>
                  {PAYMENT_TERMS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <Field label="ETA" name="eta" defaultValue={deal.eta ?? ""} />
              <Field label="Sale Invoice # Or Sales Order #" name="invoice" defaultValue={deal.invoice ?? ""} />
              <div>
                <Label>Deal completion</Label>
                <SelectField name="completion" className="mt-1" defaultValue={deal.completion ?? ""} allowEmpty emptyLabel="Still open">
                  <option value="complete">Complete — hand off to service</option>
                  <option value="fell">Fell through</option>
                </SelectField>
              </div>
              <div className="sm:col-span-2 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium">Order steps</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reps mark Good to order. Confirm Ordered and it leaves the Good to order list.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name="goodToOrder" defaultChecked={deal.goodToOrder || deal.ordered} />
                    1. Good to order
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name="ordered" defaultChecked={deal.ordered} />
                    2. Ordered
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" className="mt-1" defaultValue={deal.notes ?? ""} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={dropDeal.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove “${deal.customer}” from the pipeline list?`)) dropDeal.mutate();
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Remove from list
                </Button>
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>
            <Thread entityType="deal" entityId={deal.id} />
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function ModuleSheet({
  row,
  onClose,
  onAssign,
}: {
  row: ModuleRow | null;
  onClose: () => void;
  onAssign?: (row: ModuleRow) => void;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (d: Parameters<typeof updateModule>[0]["data"]) => updateModule({ data: d }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["modules"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {row ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Eversys Module</p>
              <SheetTitle>{row.moduleId}</SheetTitle>
              <div className="mt-2">
                <StatusBadge status={row.status} />
              </div>
            </SheetHeader>
            <SheetBody>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-3" data-testid="module-where">
              {moduleAvailability(row) === "assigned" ? (
                <>
                  <AssignedLine row={row} />
                  <ModuleReturnActions row={row} />
                </>
              ) : moduleAvailability(row) === "hq" ? (
                <>
                  <span className="text-sm font-medium">At HQ · Available</span>
                  {onAssign ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => onAssign(row)}>
                      Assign To Account
                    </Button>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Not at HQ · {row.status}</span>
              )}
            </div>
            <form
              className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save.mutate({
                  id: row.id,
                  platform: String(fd.get("platform") || "") || null,
                  moduleType: String(fd.get("moduleType") || "") || null,
                  status: String(fd.get("status")),
                  wo: String(fd.get("wo") || "") || null,
                  location: String(fd.get("location") || "") || null,
                  dateIn: String(fd.get("dateIn") || "") || null,
                  dateReady: String(fd.get("dateReady") || "") || null,
                  technician: String(fd.get("technician") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                });
              }}
            >
              <div>
                <Label>Platform</Label>
                <SelectField name="platform" className="mt-1" defaultValue={row.platform ?? ""}>
                  {MODULE_PLATFORMS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <div>
                <Label>Type</Label>
                <SelectField name="moduleType" className="mt-1" defaultValue={row.moduleType ?? ""}>
                  {MODULE_TYPES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              {row.assignedCustomer ? (
                <>
                  {/* Assigned modules move through Assign / Return so HQ stock stays right. */}
                  <LockedCustomer name={row.status} label="Status" inputName="status" />
                  <LockedCustomer name={row.location ?? ""} label="Account" inputName="location" />
                </>
              ) : (
                <>
                  <div>
                    <Label>Status</Label>
                    <SelectField name="status" className="mt-1" defaultValue={row.status}>
                      {MODULE_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </SelectField>
                  </div>
                  <Field label="Location / account" name="location" defaultValue={row.location ?? ""} />
                </>
              )}
              <Field label="WO #" name="wo" defaultValue={row.wo ?? ""} />
              <div>
                <Label>Tech</Label>
                <TechSelect name="technician" defaultValue={row.technician ?? ""} />
              </div>
              <Field label="Date in" name="dateIn" type="date" defaultValue={row.dateIn ?? ""} />
              <Field label="Date ready" name="dateReady" type="date" defaultValue={row.dateReady ?? ""} />
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" className="mt-1" defaultValue={row.notes ?? ""} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>
            <Thread entityType="module" entityId={row.id} />
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function InstallAssets({ installId }: { installId: number }) {
  const qc = useQueryClient();
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const [pick, setPick] = useState("");
  const assigned = (assets.data ?? []).filter((a) => a.installId === installId);
  const ready = (assets.data ?? []).filter((a) => a.status === "ready" && a.site.startsWith("barn"));
  const assign = useMutation({
    mutationFn: (assetId: number) => assignAssetToInstall({ data: { assetId, installId } }),
    onSuccess: () => {
      toast.success("Pulled from the barn — off the warehouse board");
      setPick("");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const unassign = useMutation({
    mutationFn: (assetId: number) => unassignAssetFromInstall({ data: { assetId, installId } }),
    onSuccess: () => {
      toast.success("Removed — back on the barn rack");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <div id="warehouse-units" className="border-b border-border bg-muted/40 px-4 py-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Warehouse units</p>
      {assets.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading the barn…</p>
      ) : assigned.length ? (
        <ul className="mt-2 space-y-1">
          {assigned.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {a.model} · {a.serial ?? "no serial"}
                {a.customerOwned ? ` · ${a.customerOwned}` : ""}
              </span>
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Remove ${a.model}`}
                disabled={unassign.isPending}
                onClick={() => unassign.mutate(a.id)}
              >
                <X className="size-3.5" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          None pulled yet. Assigning a unit removes it from the barn rack.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{ready.length} ready on the rack</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <ReadyUnitPicker units={ready} value={pick} onChange={setPick} />
        </div>
        <Button
          size="sm"
          type="button"
          disabled={!pick || assign.isPending}
          onClick={() => assign.mutate(Number(pick))}
        >
          Assign from barn
        </Button>
      </div>
    </div>
  );
}

function filterReadyUnits(ready: Asset[], filter: string) {
  const q = filter.trim().toLowerCase();
  const list = q
    ? ready.filter((a) => `${a.model} ${a.serial ?? ""} ${a.slotLabel}`.toLowerCase().includes(q))
    : ready;
  return [...list].sort((a, b) => a.model.localeCompare(b.model) || a.slotLabel.localeCompare(b.slotLabel));
}

function unitLabel(a: Asset) {
  return `${a.model} · ${a.slotLabel}${a.serial ? ` · ${a.serial}` : ""}`;
}

function ReadyUnitPicker({
  units,
  value,
  onChange,
}: {
  units: Asset[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const query = open ? q : "";
  const matches = useMemo(() => filterReadyUnits(units, query), [units, query]);
  const selected = units.find((a) => String(a.id) === value) ?? null;
  const notFound = query.trim().length >= 2 && matches.length === 0;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (box.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQ("");
    }
    document.addEventListener("mousedown", onDoc);
    function onCloseList() {
      setOpen(false);
      setQ("");
    }
    document.addEventListener("desk-close-combo", onCloseList);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("desk-close-combo", onCloseList);
    };
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <div className="flex min-h-11 w-full items-center gap-2 rounded-full border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
        <input
          value={open ? q : selected ? unitLabel(selected) : ""}
          placeholder="Ready unit on the rack…"
          autoComplete="off"
          aria-label="Ready unit on the rack"
          aria-expanded={open}
          role="combobox"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          // Open on click or typing only — the drawer focuses this field when it opens.
          onFocus={() => setQ("")}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) setOpen(true);
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) pick(String(matches[0].id));
            }
          }}
        />
        {selected && !open ? (
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Clear"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
            }}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {open ? (
        <AnchoredList anchor={box} menuRef={menuRef}>
          {notFound ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No unit on the rack matches that search.</p>
          ) : null}
          <ul className="py-1" role="listbox">
            {matches.map((a) => {
              const active = String(a.id) === value;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={
                      active
                        ? "flex min-h-10 w-full items-center px-2 py-1.5 text-left text-sm bg-muted"
                        : "flex min-h-10 w-full items-center px-2 py-1.5 text-left text-sm hover:bg-muted"
                    }
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(String(a.id));
                    }}
                  >
                    <span className="min-w-0 truncate">{unitLabel(a)}</span>
                  </button>
                </li>
              );
            })}
            {!matches.length && !notFound ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">Nothing ready on the rack.</li>
            ) : null}
          </ul>
        </AnchoredList>
      ) : null}
    </div>
  );
}

export function SimpleCreateDialog({
  title,
  open,
  onOpenChange,
  fields,
  onSubmit,
}: {
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fields: { name: string; label: string; required?: boolean; kind?: "text" | "customer" | "equipment" | "rep" }[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) setValues({});
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const next: Record<string, string> = { ...values };
            for (const [k, v] of fd.entries()) next[k] = String(v);
            setPending(true);
            try {
              await onSubmit(next);
              onOpenChange(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setPending(false);
            }
          }}
        >
          {fields.map((f) => {
            const val = values[f.name] ?? "";
            if (f.kind === "customer") {
              return (
                <CustomerCombo
                  key={f.name}
                  name={f.name}
                  label={f.label}
                  value={val}
                  onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))}
                  required={f.required}
                />
              );
            }
            if (f.kind === "equipment") {
              return (
                <EquipmentCombo
                  key={f.name}
                  name={f.name}
                  label={f.label}
                  value={val}
                  onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))}
                />
              );
            }
            if (f.kind === "rep") {
              return (
                <RepSelect
                  key={f.name}
                  name={f.name}
                  label={f.label}
                  value={val}
                  onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))}
                />
              );
            }
            return (
              <div key={f.name}>
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input id={f.name} name={f.name} className="mt-1" required={f.required} />
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { createPm, createInstall, createDeal, createModule };
