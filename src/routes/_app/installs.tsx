import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveInstall,
  createInstall,
  listAssets,
  listDirectory,
  listInstalls,
  listRecipes,
  updateInstall,
} from "@/lib/ops/api";
import { catalogModels, dropEquipment, listedEquipment, matchModel, piecesForInstall } from "@/lib/ops/equipment";
import { mergeMachineSpecs, parseMachinesJson, serializeMachines, type MachineSpec } from "@/lib/ops/machines";
import { formatShortDate, todayChicago, isInstalled, isOpenInstall, installedPatch } from "@/lib/ops/clock";
import { canMarkInstalled, saveInspectionMeta } from "@/lib/ops/inspection-api";
import { siteIsReady } from "@/lib/ops/pre-inspection";
import { InspectionBadge, PreInspectionPanel } from "@/components/desk/pre-inspection-panel";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { FlagBadge, StatusBadge } from "@/components/desk/flag-badge";
import { Badge } from "@/components/ui/badge";
import { InstallSheet } from "@/components/desk/entity-sheets";
import { RecipeChip } from "@/components/desk/recipe-sheet";
import type { RecipeDraft } from "@/components/desk/recipe-form";
import { CustomerCombo, EquipmentMultiCombo } from "@/components/desk/directory-fields";
import { MachineFields } from "@/components/desk/machine-fields";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_LIST, equipmentCount, sortDesk, tally } from "@/lib/ops/sort";
import { ActionMenu, FilterChip, StatCard, StatRow } from "@/components/desk/desk-charts";
import { CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Install, Recipe } from "@/lib/ops/types";
import { ExportButton } from "@/components/desk/export-dialog";
import { TechName } from "@/components/desk/tech-select";
import { AkBadge, NoRepFlag } from "@/components/desk/ak-badge";
import { RepFilter, RepName } from "@/components/desk/rep-select";
import { useMyView } from "@/components/desk/my-view-bar";
import { sameRep } from "@/lib/ops/reps";

export const Route = createFileRoute("/_app/installs")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["installs"], queryFn: () => listInstalls() });
  const recs = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes() });
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const directoryEquip = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
  });
  const [q, setQ] = useState("");
  const { filterMine, matchMine } = useMyView();
  const [repFilter, setRepFilter] = useState("");
  const [akOnly, setAkOnly] = useState(false);
  const [lane, setLane] = useState<"prep" | "installed">("prep");
  const [slice, setSlice] = useState<"all" | "ready" | "not-ready">("all");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort("installs", "date-asc");
  const [picked, setPicked] = useState<number[]>([]);
  const [confirmIds, setConfirmIds] = useState<number[] | null>(null);
  const [gate, setGate] = useState<{ ids: number[]; names: string[] } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [inspectId, setInspectId] = useState<number | null>(null);
  const catalog = useMemo(
    () =>
      catalogModels([
        ...(directoryEquip.data ?? []).map((e) => e.name),
        ...(assets.data ?? []).filter((a) => a.kind === "equip").map((a) => a.model),
        ...(recs.data ?? []).map((r) => r.equipmentModel),
      ]),
    [assets.data, recs.data, directoryEquip.data],
  );
  const rows = useMemo(() => {
    let list = data.data ?? [];
    if (lane === "installed") list = list.filter((i) => isInstalled(i));
    else if (slice === "ready") list = list.filter((i) => isOpenInstall(i) && siteIsReady(i.equipStatus, i.inspection?.overall));
    else if (slice === "not-ready") list = list.filter((i) => isOpenInstall(i) && !siteIsReady(i.equipStatus, i.inspection?.overall));
    else list = list.filter((i) => isOpenInstall(i));
    if (filterMine) list = list.filter((i) => matchMine(i.accountRep, i.technician) || i.aviKatz);
    if (repFilter === "__none__") list = list.filter((i) => i.noRep);
    else if (repFilter) list = list.filter((i) => sameRep(i.accountRep, repFilter));
    if (akOnly) list = list.filter((i) => i.aviKatz);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((i) =>
        [i.customer, i.equipment, i.wo, i.technician, i.serial, i.powerVoltage, ...(i.machines ?? []).flatMap((m) => [m.equipment, m.serial, m.powerVoltage])].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return sortDesk(list, sort, {
      date: (i) => i.installDate ?? i.received,
      name: (i) => i.customer,
      equipment: (i) => i.machines?.length || equipmentCount(i.equipment),
      status: (i) => i.equipStatus,
      flagRank: (i) => i.flag?.rank ?? 99,
      tech: (i) => i.technician,
    });
  }, [data.data, q, lane, slice, sort, filterMine, matchMine, repFilter, akOnly]);
  const selectedRow = (data.data ?? []).find((i) => i.id === selected) ?? null;
  const allInstalls = data.data ?? [];
  const atRisk = allInstalls.filter((i) => isOpenInstall(i) && i.flag).length;
  const recipes = recs.data ?? [];
  const readyN = allInstalls.filter((i) => isOpenInstall(i) && siteIsReady(i.equipStatus, i.inspection?.overall)).length;
  const notReadyN = allInstalls.filter((i) => isOpenInstall(i) && !siteIsReady(i.equipStatus, i.inspection?.overall)).length;
  const installedN = allInstalls.filter((i) => isInstalled(i)).length;
  const prepN = allInstalls.filter((i) => isOpenInstall(i)).length;
  const readyByEquip = tally(
    allInstalls
      .filter((i) => isOpenInstall(i) && siteIsReady(i.equipStatus, i.inspection?.overall))
      .flatMap((i) => {
        const listed = listedEquipment(
          (i.machines ?? []).map((m) => m.equipment).join("\n") || i.equipment,
          catalog,
        );
        return listed.length ? listed : [matchModel(i.equipment || "Unspecified", catalog)];
      }),
    (n) => n,
  );


  const openIds = useMemo(
    () => rows.filter((i) => isOpenInstall(i)).map((i) => i.id),
    [rows],
  );
  const pickedOpen = picked.filter((id) => openIds.includes(id));
  const markInstalled = useMutation({
    mutationFn: async (ids: number[]) => {
      const today = todayChicago();
      const source = data.data ?? [];
      await Promise.all(
        ids.map((id) => {
          const row = source.find((i) => i.id === id);
          return updateInstall({ data: { id, ...installedPatch(row, today) } });
        }),
      );
      return ids;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["installs"] });
      const prev = qc.getQueryData<Install[]>(["installs"]);
      const today = todayChicago();
      const idSet = new Set(ids);
      qc.setQueryData<Install[]>(["installs"], (old) =>
        (old ?? []).map((r) => (idSet.has(r.id) ? { ...r, ...installedPatch(r, today) } : r)),
      );
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(["installs"], ctx.prev);
      toast.error(e instanceof Error ? e.message : "Could not mark installed");
    },
    onSuccess: (ids) => {
      toast.success(
        ids.length === 1 ? "Marked installed" : `Marked ${ids.length} installs as installed`,
      );
      setPicked([]);
      setConfirmIds(null);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });

  function togglePicked(id: number, on: boolean) {
    setPicked((cur) => {
      if (on) return cur.includes(id) ? cur : [...cur, id];
      return cur.filter((x) => x !== id);
    });
  }

  function requestMark(ids: number[]) {
    const unique = [...new Set(ids)].filter((id) => {
      const row = (data.data ?? []).find((i) => i.id === id);
      return !!row && isOpenInstall(row);
    });
    if (!unique.length) return;
    const blocked = unique
      .map((id) => (data.data ?? []).find((i) => i.id === id))
      .filter((row): row is Install => !!row && !canMarkInstalled(row.inspection));
    if (blocked.length) {
      setOverrideReason("");
      setGate({ ids: unique, names: blocked.map((r) => r.customer) });
      return;
    }
    if (unique.length > 1) {
      setConfirmIds(unique);
      return;
    }
    markInstalled.mutate(unique);
  }

  async function confirmOverride() {
    const reason = overrideReason.trim();
    if (!reason || !gate) return;
    const blocked = gate.ids.filter((id) => {
      const row = (data.data ?? []).find((i) => i.id === id);
      return !!row && !canMarkInstalled(row.inspection);
    });
    try {
      await Promise.all(
        blocked.map((id) => saveInspectionMeta({ data: { installId: id, overrideReason: reason } })),
      );
      setGate(null);
      markInstalled.mutate(gate.ids);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the override");
    }
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Install Clock</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Prep is what still needs to go out. Installed is the finished list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionMenu label="Export">
            <ExportButton defaultType="installs" label="Export readiness" />
          </ActionMenu>
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New install
          </Button>
        </div>
      </header>
      {atRisk ? <p className="mt-3 text-sm text-muted-foreground">{atRisk} at risk in prep.</p> : null}
      {lane === "prep" ? (
        <StatRow>
          <StatCard
            label="Ready"
            value={readyN}
            hint="Equipment ready and pre-inspection passed"
            breakdown={readyByEquip}
            selected={slice === "ready"}
            onClick={() => setSlice((v) => (v === "ready" ? "all" : "ready"))}
          />
          <StatCard
            label="Not Ready"
            value={notReadyN}
            hint="Prep, failed check, or not inspected"
            selected={slice === "not-ready"}
            onClick={() => setSlice((v) => (v === "not-ready" ? "all" : "not-ready"))}
          />
        </StatRow>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="prep-installed-toggle">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search installs…" className="h-9 w-56 shrink-0" aria-label="Search installs" />
        <FilterChip selected={lane === "prep"} onClick={() => setLane("prep")}>
          Prep ({prepN})
        </FilterChip>
        <FilterChip selected={lane === "installed"} onClick={() => setLane("installed")}>
          Installed ({installedN})
        </FilterChip>
        <RepFilter value={repFilter} onChange={setRepFilter} extraNames={(data.data ?? []).map((i) => i.accountRep)} className="h-9 w-44 shrink-0" />
        <label className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-secondary px-3 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={akOnly} onChange={(e) => setAkOnly(e.target.checked)} />
          AK
        </label>
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} className="shrink-0" />
      </div>
      {pickedOpen.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <p className="text-sm">
            <span className="font-medium">{pickedOpen.length}</span> selected
          </p>
          <Button
            type="button"
            size="sm"
            data-testid="mark-installed-bulk"
            disabled={markInstalled.isPending}
            onClick={() => requestMark(pickedOpen)}
          >
            <CheckCircle2 className="size-3.5" />
            Mark installed
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPicked([])}>
            Clear
          </Button>
        </div>
      ) : null}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((i) => (
          <InstallRow
            key={i.id}
            install={i}
            catalog={catalog}
            recipes={recipes}
            onOpen={() => setSelected(i.id)}
            // The recipe is set in one place: on the machine's block inside the install.
            onRecipe={() => setSelected(i.id)}
            selected={picked.includes(i.id)}
            onToggleSelect={(on) => togglePicked(i.id, on)}
            onMarkInstalled={() => requestMark([i.id])}
            marking={markInstalled.isPending}
            inspecting={inspectId === i.id}
            onToggleInspect={() => setInspectId((cur) => (cur === i.id ? null : i.id))}
          />
        ))}
        {rows.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-sm text-muted-foreground">
              {lane === "installed" ? "No installs marked installed." : "No installs in prep."}
            </p>
            {lane === "prep" && !q.trim() ? (
              <Button type="button" size="sm" className="mt-3" onClick={() => setCreate(true)}>
                <Plus className="size-4" />
                New install
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <InstallSheet row={selectedRow} onClose={() => setSelected(null)} onOpenRelated={(id) => setSelected(id)} />
      <NewInstallDialog
        open={create}
        existing={allInstalls}
        onOpenChange={setCreate}
        onCreated={(id) => setSelected(id)}
        onOpenExisting={(id) => {
          setCreate(false);
          setSelected(id);
        }}
      />
      <Dialog open={!!confirmIds?.length} onOpenChange={(v) => (!v ? setConfirmIds(null) : null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Mark Installed</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Mark {confirmIds?.length ?? 0} install{(confirmIds?.length ?? 0) === 1 ? "" : "s"} as
            installed? They leave the prep queue and show on the Installed list. Serial, configuration,
            and dates stay on the account.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmIds(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="mark-installed-confirm"
              disabled={markInstalled.isPending}
              onClick={() => confirmIds && markInstalled.mutate(confirmIds)}
            >
              {markInstalled.isPending ? "Saving…" : "Mark installed"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!gate} onOpenChange={(v) => (!v ? setGate(null) : null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Pre-Inspection Not Passed</DialogTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {gate?.names.join(", ")} still need a passed site check. Add a reason to mark installed anyway.
          </p>
          <Label htmlFor="install-override" className="mt-3 block">Override reason</Label>
          <Textarea
            id="install-override"
            className="mt-1"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Why this can go out before the site check passes"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setGate(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={!overrideReason.trim() || markInstalled.isPending} onClick={() => void confirmOverride()}>
              {markInstalled.isPending ? "Saving…" : "Override and mark installed"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sameAccount(name: string, rows: Install[], exceptId?: number) {
  const n = name.trim().toLowerCase();
  if (!n) return [];
  return rows.filter((i) => i.customer.trim().toLowerCase() === n && i.id !== exceptId);
}

function NewInstallDialog({
  open,
  existing,
  onOpenChange,
  onCreated,
  onOpenExisting,
}: {
  open: boolean;
  existing: Install[];
  onOpenChange: (v: boolean) => void;
  onCreated: (id: number) => void;
  onOpenExisting: (id: number) => void;
}) {
  const qc = useQueryClient();
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes() });
  const [customer, setCustomer] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [pending, setPending] = useState(false);
  const matches = sameAccount(customer, existing);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setCustomer("");
          setEquipment([]);
          setSpecs([]);
        }
      }}
    >
      <DialogContent className="max-w-4xl">
        <div className="sticky -top-5 z-20 -mx-5 -mt-5 mb-2 border-b border-border bg-card px-4 pt-3 pr-12 pb-2">
          <DialogTitle>New Install</DialogTitle>
          <div className="mt-2 grid min-w-0 gap-2">
            <CustomerCombo
              value={customer}
              onChange={(v) => {
                try {
                  setCustomer(v);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not set customer");
                }
              }}
              required
            />
            {/* Each machine is listed once, on its own row below; the row has the remove button. */}
            <EquipmentMultiCombo
              values={equipment}
              hideChips
              onChange={(next) => {
                setEquipment(next);
                setSpecs(mergeMachineSpecs(next, specs));
              }}
              placeholder="Add another…"
            />
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>2-week lead time to prep equipment between service calls and PMs.</span>
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!customer.trim()) return;
            setPending(true);
            try {
              const packed = serializeMachines(specs.length ? specs : mergeMachineSpecs(equipment, specs));
              const row = await createInstall({
                data: {
                  customer: customer.trim(),
                  equipment: packed.equipment ?? undefined,
                  serial: packed.serial ?? undefined,
                  powerVoltage: packed.powerVoltage ?? undefined,
                  machines: packed.machines,
                },
              });
              void qc.invalidateQueries({ queryKey: ["installs"] });
              void qc.invalidateQueries({ queryKey: ["customers"] });
              if (row.duplicateOf) toast.success("Install added — flagged as a possible duplicate so you can compare.");
              else toast.success("Install added");
              onOpenChange(false);
              onCreated(row.id);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setPending(false);
            }
          }}
        >
          {matches.length ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
              <p className="font-medium text-warning">
                This account already has {matches.length === 1 ? "an install request" : `${matches.length} install requests`}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open the existing one if this is a duplicate, or create a new request — we’ll flag it so you can compare.
              </p>
              <ul className="mt-2 space-y-1">
                {matches.slice(0, 4).map((i) => (
                  <li key={i.id}>
                    <button type="button" className="text-left text-sm hover:underline" onClick={() => onOpenExisting(i.id)}>
                      {i.equipStatus ?? "Open"} · {formatShortDate(i.installDate ?? i.received)} · {i.equipment || "No equipment"}
                      {i.complete ? " (installed)" : ""}
                    </button>
                  </li>
                ))}
              </ul>
              {matches.length > 4 ? <p className="mt-1 text-xs text-muted-foreground">+{matches.length - 4} more</p> : null}
            </div>
          ) : null}
          {specs.length ? (
            <MachineFields
              specs={specs}
              customer={customer}
              recipes={recipes.data ?? []}
              onChange={setSpecs}
              onRemove={(index) => {
                const next = specs.filter((_, i) => i !== index);
                setSpecs(next);
                setEquipment(next.map((s) => s.equipment));
              }}
            />
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !customer.trim()}>
              {matches.length ? "Create new request" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useRemoveEquip(install: Install, catalog: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => {
      const nextEquip = dropEquipment(install.equipment, label, catalog);
      const names = listedEquipment(nextEquip, catalog);
      const packed = serializeMachines(mergeMachineSpecs(names, install.machines ?? []));
      return updateInstall({
        data: {
          id: install.id,
          equipment: packed.equipment,
          serial: packed.serial,
          powerVoltage: packed.powerVoltage,
          machines: packed.machines,
        },
      });
    },
    onMutate: async (label) => {
      await qc.cancelQueries({ queryKey: ["installs"] });
      const prev = qc.getQueryData<Install[]>(["installs"]);
      const nextEquip = dropEquipment(install.equipment, label, catalog);
      const names = listedEquipment(nextEquip, catalog);
      const packed = serializeMachines(mergeMachineSpecs(names, install.machines ?? []));
      qc.setQueryData<Install[]>(["installs"], (old) =>
        (old ?? []).map((r) =>
          r.id === install.id
            ? {
                ...r,
                equipment: packed.equipment,
                serial: packed.serial,
                powerVoltage: packed.powerVoltage,
                machines: packed.machines ? parseMachinesJson(packed.machines) : [],
              }
            : r,
        ),
      );
      return { prev };
    },
    onError: (e, _label, ctx) => {
      if (ctx?.prev) qc.setQueryData(["installs"], ctx.prev);
      toast.error(e instanceof Error ? e.message : "Could not remove");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["inspection", install.id] });
    },
  });
}

function useArchiveInstall(install: Install) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => archiveInstall({ data: { id: install.id } }),
    onSuccess: () => {
      toast.success(`Removed ${install.customer} from the list`);
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
}

function DuplicateBadge({ install }: { install: Install }) {
  if (!install.duplicateOf) return null;
  return <Badge variant="warn">Possible duplicate</Badge>;
}

function OpenInstallSelect({
  customer,
  selected,
  onToggle,
}: {
  customer: string;
  selected?: boolean;
  onToggle?: (on: boolean) => void;
}) {
  if (!onToggle) return null;
  return (
    <input
      type="checkbox"
      className="mt-1 size-4 shrink-0 accent-primary"
      checked={!!selected}
      aria-label={`Select ${customer}`}
      onChange={(e) => {
        e.stopPropagation();
        onToggle(e.target.checked);
      }}
    />
  );
}

function MarkInstalledButton({
  customer,
  onMark,
  marking,
}: {
  customer: string;
  onMark?: () => void;
  marking?: boolean;
}) {
  if (!onMark) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0"
      data-testid="mark-installed"
      disabled={marking}
      aria-label={`Mark ${customer} installed`}
      onClick={(e) => {
        e.stopPropagation();
        onMark();
      }}
    >
      <CheckCircle2 className="size-3.5" />
      <span className="hidden sm:inline">Mark installed</span>
    </Button>
  );
}

function InstallActions({
  install,
  open,
  onMark,
  marking,
  inspecting,
  onToggleInspect,
}: {
  install: Install;
  open: boolean;
  onMark?: () => void;
  marking?: boolean;
  inspecting?: boolean;
  onToggleInspect?: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {open && onToggleInspect ? (
        <Button
          type="button"
          size="sm"
          variant={inspecting ? "default" : "outline"}
          data-testid="open-pre-inspection"
          aria-expanded={!!inspecting}
          onClick={(e) => {
            e.stopPropagation();
            onToggleInspect();
          }}
        >
          Pre-inspection
        </Button>
      ) : null}
      {open ? (
        <MarkInstalledButton customer={install.customer} onMark={onMark} marking={marking} />
      ) : null}
      <RemoveInstallButton install={install} />
    </div>
  );
}

type InstallItemProps = {
  install: Install;
  catalog: string[];
  recipes: Recipe[];
  onOpen: () => void;
  onRecipe: (d: RecipeDraft) => void;
  selected?: boolean;
  onToggleSelect?: (on: boolean) => void;
  onMarkInstalled?: () => void;
  marking?: boolean;
  inspecting?: boolean;
  onToggleInspect?: () => void;
};

function InstallEquipChips({
  install,
  catalog,
  recipes,
  onRecipe,
  empty,
  className,
}: {
  install: Install;
  catalog: string[];
  recipes: Recipe[];
  onRecipe: (d: RecipeDraft) => void;
  empty?: ReactNode;
  className?: string;
}) {
  const pieces = piecesForInstall(install.equipment, install.customer, install.id, catalog, recipes);
  const remove = useRemoveEquip(install, catalog);
  if (!pieces.length) return <>{empty ?? null}</>;
  return (
    <div className={className ?? "mt-2 flex flex-wrap gap-1.5"}>
      {pieces.map((p, idx) => (
        <RecipeChip
          key={`${p.model}-${p.label}-${idx}`}
          piece={p}
          customer={install.customer}
          installId={install.id}
          recipes={recipes}
          recipeId={
            (install.machines ?? []).find((m) => m.equipment.toLowerCase() === p.model.toLowerCase() && m.recipeId)
              ?.recipeId ?? null
          }
          onOpen={onRecipe}
          onRemove={() => remove.mutate(p.label)}
        />
      ))}
    </div>
  );
}

function RemoveInstallButton({ install }: { install: Install }) {
  const remove = useArchiveInstall(install);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0"
      aria-label={`Remove ${install.customer} from the list`}
      data-testid="archive-row"
      disabled={remove.isPending}
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm(`Remove “${install.customer}” from the install list?`)) remove.mutate();
      }}
    >
      <Trash2 className="size-3.5" />
      <span className="hidden sm:inline">Remove</span>
    </Button>
  );
}

function InstallRow({
  install: i,
  catalog,
  recipes,
  onOpen,
  onRecipe,
  selected,
  onToggleSelect,
  onMarkInstalled,
  marking,
  inspecting,
  onToggleInspect,
}: InstallItemProps) {
  const open = isOpenInstall(i);
  return (
    <article className="border-b border-border px-3 py-3 last:border-b-0 md:px-4">
      <div className="flex items-start gap-2">
        {open ? (
          <OpenInstallSelect customer={i.customer} selected={selected} onToggle={onToggleSelect} />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center">
            <button
              type="button"
              onClick={onOpen}
              className="text-left tabular text-sm font-medium hover:underline"
            >
              {i.daysOut == null ? "needs date" : i.daysOut < 0 ? `${i.daysOut}d` : i.daysOut === 0 ? "today" : `${i.daysOut}d`}
            </button>
            <button type="button" onClick={onOpen} className="min-w-0 truncate text-left font-medium hover:underline">
              {i.customer} <AkBadge on={i.aviKatz} className="ml-1 align-middle" />
            </button>
            <div className="flex flex-wrap gap-1">
              <FlagBadge flag={i.flag} />
              <StatusBadge status={i.equipStatus} tight />
              {open ? (
                <InspectionBadge
                  overall={i.inspection?.overall}
                  passed={i.inspection?.passedCount}
                  total={i.inspection?.machineCount}
                />
              ) : null}
              <DuplicateBadge install={i} />
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-0.5 text-left text-sm text-muted-foreground hover:text-foreground sm:pl-20"
          >
            {formatShortDate(i.installDate)} · <TechName name={i.technician} />
            {" · "}
            {i.accountRep ? <RepName name={i.accountRep} /> : <NoRepFlag show />}
          </button>
          {machineNotes(i)}
          <div className="sm:pl-20">
            <InstallEquipChips
              install={i}
              catalog={catalog}
              recipes={recipes}
              onRecipe={onRecipe}
              empty={<span className="mt-2 block text-xs text-muted-foreground">{i.equipment || "No equipment listed"}</span>}
            />
          </div>
        </div>
        <InstallActions
          install={i}
          open={open}
          onMark={onMarkInstalled}
          marking={marking}
          inspecting={inspecting}
          onToggleInspect={onToggleInspect}
        />
      </div>
      {inspecting ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background" data-testid="pre-inspection-inline">
          <PreInspectionPanel installId={i.id} />
        </div>
      ) : null}
    </article>
  );
}

function machineNotes(i: Install, indent = true) {
  const rows = (i.machines ?? []).filter((m) => m.serial || m.powerVoltage);
  if (!rows.length && (i.serial || i.powerVoltage)) {
    return (
      <p className={`mt-1 text-xs text-muted-foreground ${indent ? "md:pl-20" : ""}`}>
        {[i.serial ? `SN ${i.serial}` : null, i.powerVoltage].filter(Boolean).join(" · ")}
      </p>
    );
  }
  if (!rows.length) return null;
  return (
    <ul className={`mt-1 space-y-0.5 text-xs text-muted-foreground ${indent ? "md:pl-20" : ""}`}>
      {rows.map((m, idx) => (
        <li key={`${m.equipment}-${idx}`}>
          <span className="font-medium text-foreground/80">{m.equipment}</span>
          {m.serial ? ` · SN ${m.serial}` : ""}
          {m.powerVoltage ? ` · ${m.powerVoltage}` : ""}
        </li>
      ))}
    </ul>
  );
}
