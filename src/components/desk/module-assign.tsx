import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coffee, Plus } from "lucide-react";
import { toast } from "sonner";
import { getMyAccess } from "@/lib/ops/access";
import { eversysFamily, moduleAccount } from "@/lib/ops/eversys";
import {
  addEversysUnit,
  assignModule,
  decideModuleReturn,
  listEversysModels,
  listEversysUnits,
  returnModule,
} from "@/lib/ops/module-assign";
import type { ModuleRow } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { CustomerCombo } from "./directory-fields";

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["modules"] });
    void qc.invalidateQueries({ queryKey: ["eversys-units"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useModuleRole() {
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const admin = !!me.data?.isAdmin;
  const warehouse = me.data?.role === "warehouse";
  return { admin, warehouse, canReturn: admin || warehouse };
}

/** Account search → Eversys unit on that account → attach. Adds the Eversys unit first when the account has none. */
export function AssignModuleDialog({
  module,
  onOpenChange,
}: {
  module: ModuleRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const refresh = useRefresh();
  const [customer, setCustomer] = useState("");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newModel, setNewModel] = useState("");
  const [newSerial, setNewSerial] = useState("");

  useEffect(() => {
    setCustomer("");
    setUnitId(null);
    setAdding(false);
    setNewModel("");
    setNewSerial("");
  }, [module?.id]);

  const units = useQuery({
    queryKey: ["eversys-units", customer.trim().toLowerCase()],
    queryFn: () => listEversysUnits({ data: { customer: customer.trim() } }),
    enabled: !!module && !!customer.trim(),
  });
  const models = useQuery({
    queryKey: ["eversys-models"],
    queryFn: () => listEversysModels(),
    enabled: !!module && adding,
  });
  const list = units.data ?? [];
  const family = module?.platform ?? null;

  useEffect(() => {
    // One Eversys unit on the account: pick it for them.
    if (list.length === 1 && unitId == null) setUnitId(list[0]!.id);
  }, [list, unitId]);

  const addUnit = useMutation({
    mutationFn: () =>
      addEversysUnit({ data: { customer: customer.trim(), model: newModel, serial: newSerial.trim() || null } }),
    onSuccess: (unit) => {
      toast.success(`Added ${unit.label} to ${unit.customer}`);
      setAdding(false);
      setNewModel("");
      setNewSerial("");
      setUnitId(unit.id);
      void units.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add the unit"),
  });
  const assign = useMutation({
    mutationFn: () => assignModule({ data: { id: module!.id, customer: customer.trim(), unitId: unitId! } }),
    onSuccess: (r) => {
      toast.success(`${module!.moduleId} attached to ${r.unit} · ${r.customer}`);
      refresh();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign"),
  });

  const familyModels = (models.data ?? []).filter((m) => !family || eversysFamily(m) === family);
  const otherModels = (models.data ?? []).filter((m) => family && eversysFamily(m) !== family);

  return (
    <Dialog open={!!module} onOpenChange={onOpenChange}>
      <DialogContent data-testid="assign-module">
        {module ? (
          <>
            <DialogTitle>Assign Module To An Account</DialogTitle>
            <DialogDescription>
              {module.moduleType ?? "Module"} <span className="font-mono">{module.moduleId}</span>
              {module.platform ? ` · ${module.platform}` : ""}. It attaches to an Eversys unit on that account and leaves
              HQ stock.
            </DialogDescription>
            <div className="mt-4 grid gap-4">
              <CustomerCombo
                label="Account"
                value={customer}
                onChange={(v) => {
                  setCustomer(v);
                  setUnitId(null);
                  setAdding(false);
                }}
                allowCreate={false}
                placeholder="Search accounts…"
                menuInFlow
              />
              {customer.trim() ? (
                <fieldset className="grid gap-2" data-testid="eversys-units">
                  <legend className="mb-1 text-sm font-medium">Eversys Unit On {customer.trim()}</legend>
                  {units.isLoading ? <p className="text-sm text-muted-foreground">Looking up the account’s equipment…</p> : null}
                  {!units.isLoading && list.length === 0 ? (
                    <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm" data-testid="no-eversys">
                      {customer.trim()} has no Eversys unit yet. Add the Eversys equipment first, then assign the module.
                    </p>
                  ) : null}
                  {list.map((u) => {
                    const on = unitId === u.id;
                    const mismatch = !!family && !!u.family && u.family !== family;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-testid={`unit-${u.id}`}
                        onClick={() => setUnitId(u.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm",
                          on ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                          )}
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{u.model}</span>
                          <span className="block text-xs text-muted-foreground">
                            {u.serial ? `SN ${u.serial}` : "No serial on file"}
                            {u.modules.length
                              ? ` · ${u.modules.length} module${u.modules.length === 1 ? "" : "s"} on it: ${u.modules.map((m) => m.moduleId).join(", ")}`
                              : ""}
                          </span>
                          {mismatch ? (
                            <span className="mt-0.5 block text-xs text-warning">
                              This unit is {u.family} — the module is listed as {family}.
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                  {adding ? (
                    <div className="grid gap-2 rounded-lg border border-dashed border-border p-3" data-testid="add-eversys">
                      <div>
                        <Label htmlFor="eversys-model">Eversys Model</Label>
                        <SelectField
                          id="eversys-model"
                          className="mt-1"
                          value={newModel}
                          onChange={(e) => setNewModel(e.target.value)}
                          allowEmpty
                          emptyLabel={models.isLoading ? "Loading models…" : "Pick a model"}
                        >
                          {familyModels.length && otherModels.length ? (
                            <>
                              <optgroup label={family ?? "Eversys"}>
                                {familyModels.map((m) => (
                                  <option key={m}>{m}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Other Eversys">
                                {otherModels.map((m) => (
                                  <option key={m}>{m}</option>
                                ))}
                              </optgroup>
                            </>
                          ) : (
                            (models.data ?? []).map((m) => <option key={m}>{m}</option>)
                          )}
                        </SelectField>
                      </div>
                      <div>
                        <Label htmlFor="eversys-serial">Machine Serial (Optional)</Label>
                        <Input
                          id="eversys-serial"
                          className="mt-1"
                          value={newSerial}
                          onChange={(e) => setNewSerial(e.target.value)}
                          placeholder="If you have it"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={!newModel || addUnit.isPending}
                          onClick={() => addUnit.mutate()}
                        >
                          {addUnit.isPending ? "Adding…" : "Add Eversys Unit"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : !units.isLoading ? (
                    <button
                      type="button"
                      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => setAdding(true)}
                      data-testid="add-eversys-open"
                    >
                      <Plus className="size-3.5" /> Add an Eversys unit to {customer.trim()}
                    </button>
                  ) : null}
                </fieldset>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!customer.trim() || unitId == null || assign.isPending}
                  onClick={() => assign.mutate()}
                  data-testid="assign-module-confirm"
                >
                  {assign.isPending ? "Assigning…" : "Attach Module"}
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Return-to-warehouse and approval controls. Admin returns at once; Warehouse asks an admin. */
export function ModuleReturnActions({ row, compact }: { row: ModuleRow; compact?: boolean }) {
  const refresh = useRefresh();
  const role = useModuleRole();
  const back = useMutation({
    mutationFn: () => returnModule({ data: { id: row.id } }),
    onSuccess: (r) => {
      toast.success(r.pending ? `Return requested for ${row.moduleId} — an admin approves it` : `${row.moduleId} is back at HQ`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not return"),
  });
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") => decideModuleReturn({ data: { id: row.id, decision } }),
    onSuccess: (_r, decision) => {
      toast.success(decision === "approve" ? `${row.moduleId} is back at HQ` : "Return rejected — it stays on the account");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const account = moduleAccount(row);
  if (!account && row.status !== "Installed at Account") return null;
  const size = compact ? "sm" : "sm";
  if (row.returnPending) {
    return (
      <span className="flex flex-wrap items-center gap-2" data-testid="return-pending">
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
          Return Pending{row.returnByName ? ` · ${row.returnByName}` : ""}
        </span>
        {role.admin ? (
          <>
            <Button type="button" size={size} disabled={decide.isPending} onClick={() => decide.mutate("approve")} data-testid="return-approve">
              Approve
            </Button>
            <Button type="button" size={size} variant="outline" disabled={decide.isPending} onClick={() => decide.mutate("reject")}>
              Reject
            </Button>
          </>
        ) : null}
      </span>
    );
  }
  if (!role.canReturn) return null;
  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      disabled={back.isPending}
      onClick={() => back.mutate()}
      data-testid={`return-${row.moduleId}`}
    >
      {role.admin ? "Return To Warehouse" : "Ask To Return"}
    </Button>
  );
}

export function AssignedLine({ row }: { row: ModuleRow }) {
  const account = moduleAccount(row);
  if (!account) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-foreground" data-testid="assigned-tag">
      <Coffee className="size-3 shrink-0" />
      <span className="truncate">
        Assigned · {account}
        {row.assignedUnitLabel ? ` · ${row.assignedUnitLabel}` : ""}
      </span>
    </span>
  );
}
