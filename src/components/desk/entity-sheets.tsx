import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InvoiceButton } from "@/components/desk/invoice-window";
import { ModuleRecord } from "@/components/desk/module-record";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  archiveDeal,
  archiveInstall,
  assignAssetToInstall,
  confirmDealMachines,
  createDeal,
  createInstall,
  createModule,
  createPm,
  listAssets,
  listComments,
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
import { appendServerMachines } from "@/lib/ops/warehouse-serial";
import { foldVisitUnits } from "@/lib/ops/install-form";
import { addInspectionEquipment, getInstallInspection } from "@/lib/ops/inspection-api";
import type { Asset, Deal, Install, ModuleRow, PmJob, Recipe } from "@/lib/ops/types";
import { confirmError, isOwnership } from "@/lib/ops/deal-board";
import { moneyExact } from "@/lib/ops/clock";
import { PreInspectionPanel, InspectionBadge } from "./pre-inspection-panel";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, AutoGrowTextarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetTabs } from "./sheet-tabs";
import { FlagBadge, StatusBadge } from "./flag-badge";
import { Badge } from "@/components/ui/badge";
import { Thread } from "./thread";
import { PmRunbook } from "./pm-runbook";
import { CustomerCombo, EquipmentCombo, EquipmentMultiCombo, LockedCustomer } from "./directory-fields";
import { TechSelect } from "./tech-select";
import { RepSelect } from "./rep-select";
import { AkBadge } from "./ak-badge";

import { MachineFields } from "./machine-fields";
import { InstallTicket } from "./install-ticket";
import { OpenLink } from "./open-link";
import { CustomerAddress } from "./customer-address";
import { SerialNoticeBanner } from "./serial-notice";
import { AssignedLine, ModuleReturnActions } from "./module-assign";
import { moduleAvailability } from "@/lib/ops/eversys";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, ChevronRight, ChevronsUpDown, Trash2, X } from "lucide-react";

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
  return (
    <div>
      {locked ? <LockedCustomer name={defaultValue} inputName={name} /> : <CustomerCombo name={name} value={value} onChange={setValue} required={required} />}
      <CustomerAddress customer={locked ? defaultValue : value} />
    </div>
  );
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

/** A panel that stays mounted while another tab is open, so unsaved edits stay and closing still saves. */
const KEEP_MOUNTED = "outline-none data-[state=inactive]:hidden";

type PmTab = "details" | "runbook" | "invoices" | "ping";

/** Same idea as the account window: one tab is one category. A PM opens on Details. */
const PM_TABS: { id: PmTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "runbook", label: "Runbook" },
  { id: "invoices", label: "Invoices" },
  { id: "ping", label: "Ping" },
];

type InstallTab = "details" | "equipment" | "invoices" | "pre-inspection" | "ping";

/** The Board install, including one just created. Five categories, in this order. */
const INSTALL_TABS: { id: InstallTab; label: string; short?: string }[] = [
  { id: "details", label: "Details" },
  { id: "equipment", label: "Equipment" },
  { id: "invoices", label: "Invoices" },
  { id: "pre-inspection", label: "Pre-Inspection", short: "Pre-Insp." },
  { id: "ping", label: "Ping" },
];

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
      if (pm) void qc.invalidateQueries({ queryKey: ["pm-runbook", pm.id] });
      void qc.invalidateQueries({ queryKey: ["module-runbook"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const [tab, setTab] = useState<PmTab>("details");
  useEffect(() => setTab("details"), [pm?.id]);
  const comments = useQuery({
    queryKey: ["comments", "pm", pm?.id],
    queryFn: () => listComments({ data: { entityType: "pm", entityId: pm!.id } }),
    enabled: pm != null,
  });
  const tabCount = (id: PmTab): number | null => (id === "ping" ? comments.data?.length || null : null);
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
              <SheetTabs
                value={tab}
                onValueChange={setTab}
                tabs={PM_TABS.map((t) => ({ ...t, count: tabCount(t.id) }))}
                label="PM sections"
                testId="pm"
              >
                <Tabs.Content value="details" forceMount className={KEEP_MOUNTED} data-testid="pm-panel-details">
                  <form
                    ref={formRef}
                    className="grid gap-3 p-5 sm:grid-cols-2"
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
                </Tabs.Content>
                <Tabs.Content value="runbook" className="outline-none" data-testid="pm-panel-runbook">
                  <PmRunbook pmId={pm.id} customer={pm.customer} />
                </Tabs.Content>
                <Tabs.Content value="invoices" className="p-5 outline-none" data-testid="pm-panel-invoices">
                  <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Invoice</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Parts, labor, and billing info for this PM.</p>
                  <div className="mt-3">
                    <InvoiceButton type="pm" id={pm.id} key={`invoice-pm-${pm.id}`} />
                  </div>
                </Tabs.Content>
                <Tabs.Content value="ping" forceMount className={KEEP_MOUNTED} data-testid="pm-panel-ping">
                  <Thread entityType="pm" entityId={pm.id} />
                </Tabs.Content>
              </SheetTabs>
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
  const serialSig = (row?.machines ?? []).map((m) => `${m.equipment}\t${m.serial}`).join("\n");
  const machineSig = (row?.machines ?? []).map((m) => `${m.equipment}\t${m.serial}\t${m.powerVoltage}`).join("\n");
  useEffect(() => {
    if (!row || hydratedId !== row.id) return;
    const server = row.machines ?? [];
    setSpecs((cur) => appendServerMachines(cur, server));
    setEquipPieces((pieces) => {
      const names = server.map((m) => m.equipment).filter(Boolean);
      return names.length > pieces.length ? names : pieces;
    });
    // A warehouse assignment writes the serial on the server. Pre-inspection can add a machine. Pull both in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id, hydratedId, serialSig, machineSig]);
  const visit = useQuery({
    queryKey: ["inspection", row?.id],
    queryFn: () => getInstallInspection({ data: { installId: row!.id } }),
    enabled: row != null,
  });
  const visitSig = [
    ...(visit.data?.machines ?? []).map((m) => `${m.model}|${m.serial ?? ""}`),
    ...(assets.data ?? []).filter((a) => a.installId === row?.id).map((a) => `${a.model}|${a.serial ?? ""}`),
  ].join("\n");
  const foldedFor = useRef("");
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
  const [tab, setTab] = useState<InstallTab>("details");
  useEffect(() => setTab("details"), [row?.id]);
  const comments = useQuery({
    queryKey: ["comments", "install", row?.id],
    queryFn: () => listComments({ data: { entityType: "install", entityId: row!.id } }),
    enabled: row != null,
  });
  const tabCount = (id: InstallTab): number | null => {
    if (id === "equipment") return specs.length || null;
    if (id === "pre-inspection") return row?.inspection?.machineCount || null;
    if (id === "ping") return comments.data?.length || null;
    return null;
  };

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

  useEffect(() => {
    if (!row || hydratedId !== row.id || !visit.data || visit.data.installId !== row.id) return;
    const extras = [
      ...visit.data.machines.map((m) => ({ model: m.model || m.name, serial: m.serial, electrical: m.electrical })),
      ...(assets.data ?? []).filter((a) => a.installId === row.id).map((a) => ({ model: a.model, serial: a.serial, electrical: null })),
    ];
    const folded = foldVisitUnits(specs, extras);
    const sig = `${row.id}:${visitSig}:${folded.rows.map((r) => `${r.equipment}|${r.serial}|${r.powerVoltage}|${r.plug ?? ""}`).join(";")}`;
    if ((!folded.added && !folded.changed) || foldedFor.current === sig) return;
    foldedFor.current = sig;
    persistMachines(folded.rows);
    // Units already on the visit (pre-inspection or the barn) join the equipment list once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id, hydratedId, visitSig]);

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
            <SheetHeader className="max-sm:py-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Install</p>
              <SheetTitle className="max-sm:text-lg">{row.customer}</SheetTitle>
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
              <CustomerAddress customer={row.customer} className="mt-2" />
            </SheetHeader>
            <SheetBody>
              {/* One tab is one category. A new install opens here on Details. */}
              <SheetTabs
                value={tab}
                onValueChange={setTab}
                tabs={INSTALL_TABS.map((t) => ({ ...t, count: tabCount(t.id) }))}
                label="Install sections"
                testId="install"
              >
                <Tabs.Content value="details" forceMount className={KEEP_MOUNTED} data-testid="install-panel-details">
                  <label className="flex w-fit items-center gap-2 border-b border-border px-5 py-3 text-sm font-medium" data-testid="trf-check-window">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={row.trfIssued}
                      disabled={save.isPending}
                      onChange={(e) => save.mutate({ id: row.id, trfIssued: e.target.checked })}
                    />
                    Tech Request Form issued
                  </label>
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
                  <form
                    ref={formRef}
                    key={row.id}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-2"
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
                </Tabs.Content>

                <Tabs.Content value="equipment" className="outline-none" data-testid="install-panel-equipment">
                  <SerialNoticeBanner
                    notice={row.serialNotice}
                    onAttach={(unit) => {
                      const folded = foldVisitUnits(specs, [unit]);
                      if (folded.added || folded.rows.some((r, i) => r.serial !== specs[i]?.serial)) persistMachines(folded.rows);
                      else toast.message("That unit is already on this install.");
                      void addInspectionEquipment({ data: { installId: row.id, model: unit.model, serial: unit.serial } })
                        .then(() => {
                          void qc.invalidateQueries({ queryKey: ["inspection", row.id] });
                        })
                        .catch((e) => {
                          const message = e instanceof Error ? e.message : "";
                          if (!/already on this visit/i.test(message)) toast.error(message || "Could not attach that unit");
                        });
                    }}
                  />
                  <InstallTicket install={row} machines={specs} recipes={recs.data ?? []} />
                  <div className="grid gap-3 border-b border-border px-4 py-3">
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
                    <MachineFields
                      specs={specs}
                      installId={row.id}
                      customer={row.customer}
                      recipes={recs.data ?? []}
                      onChange={setSpecs}
                      onPulled={(next) => persistMachines(next)}
                      onRecipe={(next) => persistMachines(next)}
                      onCommit={(next) => persistMachines(next)}
                      onRemove={(index) => {
                        try {
                          persistMachines(specs.filter((_, i) => i !== index));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not update equipment");
                        }
                      }}
                    />
                  </div>
                  <InstallAssets installId={row.id} />
                </Tabs.Content>

                <Tabs.Content value="invoices" className="p-5 outline-none" data-testid="install-panel-invoices">
                  <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Invoice</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Parts, labor, and billing info for this install.</p>
                  <div className="mt-3">
                    <InvoiceButton type="install" id={row.id} key={`invoice-install-${row.id}`} />
                  </div>
                </Tabs.Content>

                <Tabs.Content value="pre-inspection" className="outline-none" data-testid="install-panel-pre-inspection">
                  <PreInspectionPanel installId={row.id} />
                </Tabs.Content>

                <Tabs.Content value="ping" forceMount className={KEEP_MOUNTED} data-testid="install-panel-ping">
                  <Thread entityType="install" entityId={row.id} />
                </Tabs.Content>
              </SheetTabs>
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
 * location, Sold, Loan or Lease, configuration). The account is already open, so no customer is asked for again.
 * Confirm sends a machine to the Board for prep. When a project is already open for this deal or account, it
 * asks first: continue under that project (one board card) or start a new project (another card).
 */
function DealMachines({
  deal,
  specs,
  recipes,
  onChange,
  onPersist,
  onConfirmed,
}: {
  deal: Deal;
  specs: MachineSpec[];
  recipes: Recipe[];
  onChange: (next: MachineSpec[]) => void;
  onPersist: (next: MachineSpec[]) => void;
  onConfirmed: (next: MachineSpec[]) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(specs.length <= DEAL_ROWS_OPEN);
  const [seen, setSeen] = useState(specs.length);
  const [asking, setAsking] = useState<number | null>(null);
  useEffect(() => {
    // A new row opens the list so it can be filled in; a long list loaded later starts folded.
    if (specs.length > seen) setOpen(true);
    else if (seen === 0 && specs.length > DEAL_ROWS_OPEN) setOpen(false);
    setSeen(specs.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs.length]);
  const many = specs.length > DEAL_ROWS_OPEN;
  const count = `${specs.length} machine${specs.length === 1 ? "" : "s"}`;
  const onBoard = specs.filter((s) => s.boardId != null).length;
  const openProjects = deal.projects.filter((p) => p.open);

  const confirm = useMutation({
    mutationFn: (d: { index: number; project: { mode: "new" } | { mode: "continue"; installId: number } }) =>
      confirmDealMachines({ data: { dealId: deal.id, machines: specs, indexes: [d.index], project: d.project } }),
    onSuccess: (r, d) => {
      setAsking(null);
      onConfirmed(r.deal.machines);
      toast.success(`${specs[d.index]?.equipment ?? "Machine"} is on the Board for prep`);
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not confirm it"),
  });

  function requestConfirm(index: number) {
    const problem = confirmError(specs[index] ?? { equipment: "", ownership: "" });
    if (problem) {
      toast.error(problem);
      return;
    }
    // Nothing open to continue under: the machine starts the project. Otherwise ask.
    if (!openProjects.length) confirm.mutate({ index, project: { mode: "new" } });
    else setAsking(index);
  }

  const projectFor = (id: number | null | undefined) => deal.projects.find((p) => p.id === id) ?? null;
  const askedFor = asking != null ? specs[asking] : null;

  return (
    <section className="rounded-lg border border-border p-3 sm:col-span-2" data-testid="deal-machines" data-open={open ? "true" : "false"}>
      <div className="flex flex-wrap items-center gap-2">
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
        {specs.length ? (
          <span className="text-xs text-muted-foreground" data-testid="deal-machines-on-board">
            · {onBoard} on the Board
          </span>
        ) : null}
      </div>
      {specs.length ? (
        <p className="mt-1 text-xs text-muted-foreground">Mark each machine Sold, Loan or Lease. Confirm sends it to the Board for prep with everything set here.</p>
      ) : null}
      {many && !open ? (
        <p className="mt-1 truncate text-xs text-muted-foreground" data-testid="deal-machines-folded">
          {specs.map((s) => s.equipment).join(" · ")}
        </p>
      ) : (
        <MachineFields
          specs={specs}
          onChange={onChange}
          showRecipe={false}
          recipeInConfig
          dealId={deal.id}
          customer={deal.customer}
          recipes={recipes}
          where="deal"
          onRemove={(index) => onPersist(specs.filter((_, i) => i !== index))}
          onCommit={onPersist}
          onRecipe={onPersist}
          rowLocked={(s) => s.boardId != null}
          rowFooter={(s, index) => {
            const project = projectFor(s.boardId);
            if (s.boardId != null) {
              return (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" data-testid="machine-on-board">
                  <Badge size="tight" variant="success">
                    <CheckCircle2 className="mr-1 size-3.5" />
                    Confirmed · On The Board
                  </Badge>
                  <span className="text-muted-foreground">
                    {project ? `${project.label} · ${project.status}` : "Board project"}
                  </span>
                  <OpenLink entityType="install" id={s.boardId} className="font-medium text-copper hover:underline">
                    Open On The Board
                  </OpenLink>
                </p>
              );
            }
            return (
              <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="machine-confirm-row">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={confirm.isPending}
                  onClick={() => requestConfirm(index)}
                  data-testid="machine-confirm"
                >
                  <CheckCircle2 className="size-4" />
                  {confirm.isPending && confirm.variables?.index === index ? "Confirming…" : "Confirm"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {isOwnership(s.ownership) ? "Not on the Board yet." : "Mark it Sold, Loan or Lease, then confirm."}
                </span>
              </div>
            );
          }}
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

      <Dialog open={asking != null} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent className="max-w-md" data-testid="project-choice">
          <DialogTitle>Add To The Board</DialogTitle>
          <DialogDescription>
            {askedFor?.equipment} goes to the Board for prep. This {openProjects.some((p) => p.ownDeal) ? "deal" : "account"} already has a project open there.
            Continue under this project, or start a new project?
          </DialogDescription>
          <ul className="mt-3 grid gap-2">
            {openProjects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={confirm.isPending}
                  className="flex w-full flex-col items-start rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:border-primary/60 disabled:opacity-60"
                  onClick={() => asking != null && confirm.mutate({ index: asking, project: { mode: "continue", installId: p.id } })}
                  data-testid="project-continue"
                >
                  <span className="text-sm font-medium">Continue Under This Project</span>
                  <span className="text-xs text-muted-foreground">
                    {p.label} · {p.status} · {p.machineCount} machine{p.machineCount === 1 ? "" : "s"}
                    {p.equipment ? ` · ${p.equipment.split(/\r?\n/).filter(Boolean).join(", ")}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">Same project keeps one board card.</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                disabled={confirm.isPending}
                className="flex w-full flex-col items-start rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:border-primary/60 disabled:opacity-60"
                onClick={() => asking != null && confirm.mutate({ index: asking, project: { mode: "new" } })}
                data-testid="project-new"
              >
                <span className="text-sm font-medium">Start A New Project</span>
                <span className="text-xs text-muted-foreground">Opens another board card for this machine.</span>
              </button>
            </li>
          </ul>
          <Button type="button" variant="ghost" className="mt-2 w-fit" onClick={() => setAsking(null)}>
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
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
  const recs = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes(), enabled: !!deal });
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
  const placed = (deal?.machines ?? []).map((m) => `${m.uid ?? m.equipment}:${m.boardId ?? ""}`).join("|");
  useEffect(() => {
    if (!deal) return;
    setSpecs((cur) =>
      cur.map((s, i) => {
        // A confirmed row is found by its tie; a row not tied yet by its place and model (it may have been
        // confirmed, or handed off with the deal, since this window opened).
        const hit = s.uid ? deal.machines.find((m) => m.uid === s.uid) : deal.machines[i]?.equipment === s.equipment ? deal.machines[i] : undefined;
        const boardId = hit ? (hit.boardId ?? null) : s.uid ? null : (s.boardId ?? null);
        const uid = s.uid ?? hit?.uid;
        if (boardId === (s.boardId ?? null) && uid === s.uid) return s;
        return { ...s, boardId, ...(uid ? { uid, confirmedAt: s.confirmedAt ?? hit?.confirmedAt ?? null } : {}) };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id, placed]);
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
              <div className="mt-2">
                <InvoiceButton type="deal" id={deal.id} key={`invoice-deal-${deal.id}`} />
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
                deal={deal}
                specs={specs}
                recipes={recs.data ?? []}
                onConfirmed={setSpecs}
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
            <ModuleRecord row={row} />
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
