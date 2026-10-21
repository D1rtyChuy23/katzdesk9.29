import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, X } from "lucide-react";
import { toast } from "sonner";
import { getMyAccess } from "@/lib/ops/access";
import { listInstalls } from "@/lib/ops/api";
import { customersStrictlyMatch } from "@/lib/ops/clean-names";
import { isInstalled } from "@/lib/ops/install-status";
import { mergeInstalls, setInstallCustomerLock } from "@/lib/ops/install-projects";
import { addInstallWorkOrder, removeInstallWorkOrder } from "@/lib/ops/install-work-orders";
import { woBoardName } from "@/lib/ops/wo-search";
import type { Install } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { CustomerCombo, LockedCustomer } from "./directory-fields";
import { CustomerAddress } from "./customer-address";
import { LockBadge } from "./lock-badge";
import { useCanLock } from "./use-can-lock";

function useInstallsChanged() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["installs"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["customer-history"] });
    void qc.invalidateQueries({ queryKey: ["customers"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
  };
}

/**
 * The install's customer. Anyone who edits installs can change it (Save, or closing the window, writes it) unless the
 * owner locked it; the owner's Lock / Unlock sits beside it, the same as the equipment lock.
 */
export function InstallCustomerField({ row, value, onChange }: { row: Install; value: string; onChange: (v: string) => void }) {
  const canLock = useCanLock();
  const changed = useInstallsChanged();
  const locked = !!row.customerLockedAt;
  const toggle = useMutation({
    mutationFn: () => setInstallCustomerLock({ data: { id: row.id, locked: !locked } }),
    onSuccess: () => {
      toast.success(locked ? "Customer unlocked" : "Customer locked");
      changed();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change the lock"),
  });
  return (
    <div className="sm:col-span-2" data-testid="install-customer">
      {locked ? (
        <LockedCustomer name={row.customer} inputName="customer" />
      ) : (
        <CustomerCombo name="customer" value={value} onChange={onChange} required />
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <LockBadge lockedBy={row.customerLockedBy} />
        {canLock ? (
          <Button type="button" size="sm" variant="outline" disabled={toggle.isPending} data-testid="customer-lock-toggle" onClick={() => toggle.mutate()}>
            {locked ? <LockOpen className="mr-1 size-3.5" /> : <Lock className="mr-1 size-3.5" />}
            {locked ? "Unlock" : "Lock"}
          </Button>
        ) : null}
        {!locked && value.trim() && value.trim() !== row.customer ? (
          <span className="text-xs text-muted-foreground">Saves as the install&apos;s customer; its own account units go with it.</span>
        ) : null}
      </div>
      <CustomerAddress customer={locked ? row.customer : value} />
    </div>
  );
}

/** The project's Corrigo work orders: each with Corrigo's status and date, Add WO, and remove. */
export function InstallWorkOrders({ row }: { row: Install }) {
  const changed = useInstallsChanged();
  const [wo, setWo] = useState("");
  const add = useMutation({
    mutationFn: () => addInstallWorkOrder({ data: { installId: row.id, wo } }),
    onSuccess: (res) => {
      setWo("");
      changed();
      const also = res.alsoOn.map((h) => `${woBoardName(h.entityType)} #${h.id}`).join(", ");
      toast.success(also ? `Added · that WO is also on ${also}` : "Added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add that WO"),
  });
  const remove = useMutation({
    mutationFn: (matchKey: string) => removeInstallWorkOrder({ data: { installId: row.id, matchKey } }),
    onSuccess: (res) => {
      changed();
      toast.success(res.primary ? `Removed · first WO: ${res.primary}` : "Removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove that WO"),
  });
  const list = row.workOrders ?? [];
  return (
    <div className="sm:col-span-2" data-testid="install-work-orders">
      <Label>Work orders</Label>
      {list.length ? (
        <ul className="mt-1 divide-y divide-border rounded-md border border-border">
          {list.map((w) => (
            <li key={w.matchKey} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm" data-testid="install-wo">
              <span className="min-w-0">
                <span className="font-medium tabular">{w.wo}</span>
                {w.primary && list.length > 1 ? <span className="ml-1 text-xs text-muted-foreground">(first)</span> : null}
                <span className="ml-2 text-xs text-muted-foreground">
                  {[w.status || "No Corrigo status", w.completedAt].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${w.wo}`}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Take ${w.wo} off this install?`)) remove.mutate(w.matchKey);
                }}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No WO yet.</p>
      )}
      {/* Not a form: this sits inside the details form, whose Enter would save the window. */}
      <div className="mt-2 flex gap-2">
        <Input
          value={wo}
          onChange={(e) => setWo(e.target.value)}
          placeholder="Add WO (e.g. WO-0855)"
          aria-label="Add WO"
          autoComplete="off"
          className="max-w-[14rem]"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (wo.trim()) add.mutate();
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={!wo.trim() || add.isPending} onClick={() => add.mutate()}>
          Add WO
        </Button>
      </div>
    </div>
  );
}

/** Admins (the Admin role or a desk admin): the rule the server checks for a merge. */
function useCanMerge(): boolean {
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  return !!me.data?.approved && (!!me.data.isAdmin || me.data.role === "admin");
}

/** "Merge into install #…": another install of this account keeps everything; this one is archived as its duplicate. */
export function MergeInstall({ row, onMerged }: { row: Install; onMerged: (keepId: number) => void }) {
  const canMerge = useCanMerge();
  const changed = useInstallsChanged();
  const installs = useQuery({ queryKey: ["installs"], queryFn: () => listInstalls(), enabled: canMerge });
  const [keepId, setKeepId] = useState("");
  const others = (installs.data ?? []).filter((i) => i.id !== row.id && customersStrictlyMatch(i.customer, row.customer));
  const merge = useMutation({
    mutationFn: (keep: number) => mergeInstalls({ data: { keepId: keep, dropId: row.id } }),
    onSuccess: (res) => {
      toast.success(
        `Merged into install #${res.keepId} · ${res.workOrders} WO${res.workOrders === 1 ? "" : "s"}, ${res.machines} machine row${res.machines === 1 ? "" : "s"}, ${res.units} visit unit${res.units === 1 ? "" : "s"} moved`,
      );
      changed();
      onMerged(res.keepId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not merge"),
  });
  if (!canMerge || !others.length) return null;
  const label = (i: Install) =>
    `#${i.id} · ${i.customer} · ${isInstalled(i) ? "Installed" : i.equipStatus || "Not Ready"} · ${(i.workOrders ?? []).map((w) => w.wo).join(", ") || "no WO"}`;
  return (
    <div className="sm:col-span-2" data-testid="merge-install">
      <Label htmlFor={`merge-${row.id}`}>Merge into install #…</Label>
      <div className="mt-1 flex flex-wrap gap-2">
        <SelectField id={`merge-${row.id}`} className="min-w-0 flex-1" value={keepId} onChange={(e) => setKeepId(e.target.value)} allowEmpty emptyLabel="Pick an install">
          {others.map((i) => (
            <option key={i.id} value={i.id}>
              {label(i)}
            </option>
          ))}
        </SelectField>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!keepId || merge.isPending}
          onClick={() => {
            const keep = others.find((i) => String(i.id) === keepId);
            if (!keep) return;
            const names = keep.customer === row.customer ? "" : ` (${row.customer} → ${keep.customer})`;
            if (window.confirm(`Merge install #${row.id} into #${keep.id}${names}? Its WOs, machine rows, notes and new units move; this one is archived.`)) {
              merge.mutate(keep.id);
            }
          }}
        >
          Merge
        </Button>
      </div>
    </div>
  );
}
