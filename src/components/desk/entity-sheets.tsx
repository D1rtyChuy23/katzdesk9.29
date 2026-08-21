import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  assignAssetToInstall,
  copyRecipe,
  createDeal,
  createInstall,
  createModule,
  createPm,
  listAssets,
  listCustomers,
  listDirectory,
  listRecipes,
  unassignAssetFromInstall,
  updateDeal,
  updateInstall,
  updateModule,
  updatePm,
  upsertRecipe,
} from "@/lib/ops/api";
import {
  EQUIP_STATUSES,
  MODULE_PLATFORMS,
  MODULE_STATUSES,
  MODULE_TYPES,
  PARTS_STATUSES,
  PAYMENT_TERMS,
  PM_STATUSES,
  PM_STYLES,
  PRODUCERS,
  REQS_READY,
  TECHNICIANS,
} from "@/lib/ops/lookups";
import { catalogModels, listedEquipment, piecesForInstall } from "@/lib/ops/equipment";
import { mergeMachineSpecs, serializeMachines, type MachineSpec } from "@/lib/ops/machines";
import type { Asset, Deal, Install, ModuleRow, PmJob } from "@/lib/ops/types";
import { moneyExact } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FlagBadge, StatusBadge } from "./flag-badge";
import { Thread } from "./thread";
import { RecipeForm, type RecipeDraft } from "./recipe-form";
import { InstallRecipeList } from "./recipe-sheet";
import { CustomerCombo, EquipmentCombo, EquipmentMultiCombo } from "./directory-fields";
import { MachineFields } from "./machine-fields";
import { toast } from "sonner";
import { X } from "lucide-react";

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
}: {
  recordKey: number | string;
  defaultValue: string;
  name?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    setValue(defaultValue);
  }, [recordKey, defaultValue]);
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

export function PmSheet({ pm, onClose }: { pm: PmJob | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (d: Parameters<typeof updatePm>[0]["data"]) => updatePm({ data: d }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["pms"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  return (
    <Sheet open={!!pm} onOpenChange={(o) => !o && onClose()}>
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
            <form
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
                });
              }}
            >
              <BoundCustomer recordKey={pm.id} defaultValue={pm.customer} required />
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
                <SelectField name="technician" className="mt-1" defaultValue={pm.technician ?? ""} allowEmpty>
                  {TECHNICIANS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
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
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function InstallSheet({
  row,
  onClose,
}: {
  row: Install | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const recs = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes() });
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });
  const directoryEquip = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
  });
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null);
  const [customer, setCustomer] = useState(row?.customer ?? "");
  const [equipPieces, setEquipPieces] = useState<string[]>([]);
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [hydratedId, setHydratedId] = useState<number | null>(null);
  const catalog = catalogModels([
    ...(directoryEquip.data ?? []).map((e) => e.name),
    ...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
    ...(recs.data ?? []).map((r) => r.equipmentModel),
  ]);
  useEffect(() => {
    setRecipeDraft(null);
    setCustomer(row?.customer ?? "");
    const saved = row?.machines ?? [];
    const names = saved.length
      ? saved.map((s) => s.equipment)
      : listedEquipment(row?.equipment, catalog);
    setEquipPieces(names);
    setSpecs(
      saved.length
        ? saved
        : mergeMachineSpecs(names, [], {
            serial: row?.serial,
            powerVoltage: row?.powerVoltage,
          }),
    );
    setHydratedId(row?.id ?? null);
  }, [row?.id]);
  const save = useMutation({
    mutationFn: (d: Parameters<typeof updateInstall>[0]["data"]) => updateInstall({ data: d }),
    onSuccess: (_row, vars) => {
      const keys = Object.keys(vars).filter((k) => k !== "id");
      const machineOnly = keys.every((k) =>
        ["equipment", "serial", "powerVoltage", "machines"].includes(k),
      );
      if (!machineOnly) toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const saveRecipe = useMutation({
    mutationFn: (d: Parameters<typeof upsertRecipe>[0]["data"]) => upsertRecipe({ data: d }),
    onSuccess: (saved) => {
      toast.success(saved.customer ? `Recipe saved for ${saved.customer}` : "House recipe saved");
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setRecipeDraft(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const copy = useMutation({
    mutationFn: (d: Parameters<typeof copyRecipe>[0]["data"]) => copyRecipe({ data: d }),
    onSuccess: (saved) => {
      toast.success(`Copied onto ${saved.customer}`);
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setRecipeDraft(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const pieces = row
    ? piecesForInstall(row.equipment, row.customer, row.id, catalog, recs.data ?? [])
    : [];
  const models = catalog;

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
          if (row && hydratedId === row.id) {
            const packed = serializeMachines(specs);
            save.mutate({
              id: row.id,
              equipment: packed.equipment,
              serial: packed.serial,
              powerVoltage: packed.powerVoltage,
              machines: packed.machines,
            });
          }
          setRecipeDraft(null);
          onClose();
        }
      }}
    >
      <SheetContent>
        {row ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Install</p>
              <SheetTitle>{row.customer}</SheetTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge status={row.equipStatus} />
                <FlagBadge flag={row.flag} />
              </div>
            </SheetHeader>
            <InstallAssets installId={row.id} />
            {recipeDraft ? (
              <div className="border-b border-border p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Recipe</p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRecipeDraft(null)}>
                    Back to machines
                  </Button>
                </div>
                <RecipeForm
                  key={`${recipeDraft.recipe?.id ?? "new"}-${recipeDraft.equipmentModel}`}
                  draft={recipeDraft}
                  models={models}
                  customers={customers.data ?? []}
                  pending={saveRecipe.isPending}
                  copyPending={copy.isPending}
                  onSave={(d) => saveRecipe.mutate(d)}
                  onCopy={recipeDraft.recipe ? (d) => copy.mutate(d) : undefined}
                />
              </div>
            ) : (
              <InstallRecipeList
                customer={row.customer}
                installId={row.id}
                pieces={pieces}
                recipes={recs.data ?? []}
                onOpen={setRecipeDraft}
              />
            )}
            <form
              key={row.id}
              className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const packed = serializeMachines(specs);
                save.mutate({
                  id: row.id,
                  customer: String(fd.get("customer")),
                  equipment: packed.equipment,
                  equipStatus: String(fd.get("equipStatus") || "") || null,
                  installDate: String(fd.get("installDate") || "") || null,
                  technician: String(fd.get("technician") || "") || null,
                  wo: String(fd.get("wo") || "") || null,
                  reqsReady: String(fd.get("reqsReady") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                  accountRep: String(fd.get("accountRep") || "") || null,
                  paymentStatus: String(fd.get("paymentStatus") || "") || null,
                  serial: packed.serial,
                  powerVoltage: packed.powerVoltage,
                  machines: packed.machines,
                });
              }}
            >
              <CustomerCombo name="customer" value={customer} onChange={setCustomer} required />
              <div className="sm:col-span-2">
                <EquipmentMultiCombo
                  values={equipPieces}
                  placeholder="Search the full equipment list…"
                  onChange={(next) => persistMachines(mergeMachineSpecs(next, specs))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Scroll the full list, pick a model, or type a new one to add it.
                </p>
              </div>
              <div className="sm:col-span-2">
                <MachineFields specs={specs} onChange={setSpecs} />
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
                <SelectField name="technician" className="mt-1" defaultValue={row.technician ?? ""} allowEmpty>
                  {TECHNICIANS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
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
              <Field label="Account rep" name="accountRep" defaultValue={row.accountRep ?? ""} />
              <div>
                <Label>Payment</Label>
                <SelectField name="paymentStatus" className="mt-1" defaultValue={row.paymentStatus ?? ""} allowEmpty>
                  {PAYMENT_TERMS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" className="mt-1" defaultValue={row.notes ?? ""} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>
            <Thread entityType="install" entityId={row.id} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function DealSheet({ deal, onClose }: { deal: Deal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (d: Parameters<typeof updateDeal>[0]["data"]) => updateDeal({ data: d }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  return (
    <Sheet open={!!deal} onOpenChange={(o) => !o && onClose()}>
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
            <form
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
                  equipment: String(fd.get("equipment") || "") || null,
                  amount: Number.isFinite(amountNum) ? amountNum : null,
                  goodToOrder: fd.get("goodToOrder") === "on",
                  ordered: fd.get("ordered") === "on",
                  eta: String(fd.get("eta") || "") || null,
                  terms: String(fd.get("terms") || "") || null,
                  invoice: String(fd.get("invoice") || "") || null,
                  completion: String(fd.get("completion") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                });
              }}
            >
              <BoundCustomer recordKey={deal.id} defaultValue={deal.customer} required />
              <div>
                <Label>Producer</Label>
                <SelectField name="producer" className="mt-1" defaultValue={deal.producer ?? ""} allowEmpty>
                  {deal.producer && !PRODUCERS.includes(deal.producer as (typeof PRODUCERS)[number]) ? (
                    <option key={deal.producer}>{deal.producer}</option>
                  ) : null}
                  {PRODUCERS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <div className="sm:col-span-2">
                <BoundEquipment recordKey={deal.id} defaultValue={deal.equipment ?? ""} />
              </div>
              <Field label="Amount" name="amount" defaultValue={deal.amount != null ? String(deal.amount) : ""} />
              <div>
                <Label>Payment terms</Label>
                <SelectField name="terms" className="mt-1" defaultValue={deal.terms ?? ""} allowEmpty>
                  {PAYMENT_TERMS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <Field label="ETA" name="eta" defaultValue={deal.eta ?? ""} />
              <Field label="Invoice #" name="invoice" defaultValue={deal.invoice ?? ""} />
              <div>
                <Label>Deal completion</Label>
                <SelectField name="completion" className="mt-1" defaultValue={deal.completion ?? ""} allowEmpty emptyLabel="Still open">
                  <option value="complete">Complete — hand off to service</option>
                  <option value="fell">Fell through</option>
                </SelectField>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="goodToOrder" defaultChecked={deal.goodToOrder} />
                Good to order
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ordered" defaultChecked={deal.ordered} />
                Equipment ordered
              </label>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea name="notes" className="mt-1" defaultValue={deal.notes ?? ""} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>
            <Thread entityType="deal" entityId={deal.id} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function ModuleSheet({
  row,
  onClose,
}: {
  row: ModuleRow | null;
  onClose: () => void;
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
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Eversys module</p>
              <SheetTitle>{row.moduleId}</SheetTitle>
              <div className="mt-2">
                <StatusBadge status={row.status} />
              </div>
            </SheetHeader>
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
              <div>
                <Label>Status</Label>
                <SelectField name="status" className="mt-1" defaultValue={row.status}>
                  {MODULE_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </div>
              <Field label="Location / account" name="location" defaultValue={row.location ?? ""} />
              <Field label="WO #" name="wo" defaultValue={row.wo ?? ""} />
              <div>
                <Label>Tech</Label>
                <SelectField name="technician" className="mt-1" defaultValue={row.technician ?? ""} allowEmpty>
                  {TECHNICIANS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
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
  const [q, setQ] = useState("");
  const assigned = (assets.data ?? []).filter((a) => a.installId === installId);
  const ready = (assets.data ?? []).filter((a) => a.status === "ready" && a.site.startsWith("barn"));
  const pool = filterReadyUnits(ready, q);
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
    <div id="warehouse-units" className="border-b border-border bg-muted/40 p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Warehouse units</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Assigning a unit takes it off the rack. Serial and voltage on this install stay blank until you type them.
      </p>
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
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by model or serial…"
        className="mt-3"
        aria-label="Filter warehouse units"
      />
      <p className="mt-1.5 text-xs text-muted-foreground">{pool.length} ready on the rack</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <SelectField
          className="flex-1"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          allowEmpty
          emptyLabel="Ready unit on the rack…"
          aria-label="Ready unit on the rack"
        >
          {pool.slice(0, 120).map((a) => (
            <option key={a.id} value={a.id}>
              {a.model} · {a.slotLabel}
              {a.serial ? ` · ${a.serial}` : ""}
            </option>
          ))}
        </SelectField>
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
  fields: { name: string; label: string; required?: boolean; kind?: "text" | "customer" | "equipment" }[];
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
