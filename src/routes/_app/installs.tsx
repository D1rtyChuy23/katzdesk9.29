import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveInstall,
  createInstall,
  listAssets,
  listCustomers,
  listDirectory,
  listInstalls,
  listRecipes,
  updateInstall,
} from "@/lib/ops/api";
import { catalogModels, dropEquipment, listedEquipment, matchModel, piecesForInstall } from "@/lib/ops/equipment";
import { mergeMachineSpecs, parseMachinesJson, serializeMachines, type MachineSpec } from "@/lib/ops/machines";
import { formatShortDate, todayChicago, weekBounds, isInstalled, isOpenInstall, installedPatch } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlagBadge, StatusBadge } from "@/components/desk/flag-badge";
import { Badge } from "@/components/ui/badge";
import { InstallSheet } from "@/components/desk/entity-sheets";
import { RecipeChip, RecipeEditorSheet } from "@/components/desk/recipe-sheet";
import type { RecipeDraft } from "@/components/desk/recipe-form";
import { CustomerCombo, EquipmentMultiCombo } from "@/components/desk/directory-fields";
import { MachineFields } from "@/components/desk/machine-fields";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_LIST, equipmentCount, sortDesk, tally } from "@/lib/ops/sort";
import { ChartCard, FilterChip, SimpleBars, StatCard, StatRow, StatusDonut, toggleChip } from "@/components/desk/desk-charts";
import { CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Install, Recipe } from "@/lib/ops/types";
import { ExportButton } from "@/components/desk/export-dialog";
import { TechName } from "@/components/desk/tech-select";
import { AkBadge, NoRepFlag } from "@/components/desk/ak-badge";
import { RepFilter, RepName } from "@/components/desk/rep-select";
import { MyViewBar, useMyView } from "@/components/desk/my-view-bar";
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
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });
  const directoryEquip = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
  });
  const [q, setQ] = useState("");
  const { filterMine, matchMine, board } = useMyView();
  const [repFilter, setRepFilter] = useState("");
  const [akOnly, setAkOnly] = useState(false);
  const [view, setView] = useState<"queue" | "board" | "all" | "ready" | "not-ready" | "installed">(board ? "board" : "queue");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null);
  const [sort, setSort] = useDeskSort("installs", "date-asc");
  const [picked, setPicked] = useState<number[]>([]);
  const [confirmIds, setConfirmIds] = useState<number[] | null>(null);
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
    if (view === "queue") list = list.filter((i) => isOpenInstall(i));
    if (view === "ready") list = list.filter((i) => isOpenInstall(i) && i.equipStatus === "Ready");
    if (view === "not-ready") list = list.filter((i) => isOpenInstall(i) && i.equipStatus !== "Ready");
    if (view === "installed") list = list.filter((i) => isInstalled(i));
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
  }, [data.data, q, view, sort, filterMine, matchMine, repFilter, akOnly]);
  const selectedRow = (data.data ?? []).find((i) => i.id === selected) ?? null;
  const allInstalls = data.data ?? [];
  const atRisk = allInstalls.filter((i) => i.flag).length;
  const recipes = recs.data ?? [];
  const readyN = allInstalls.filter((i) => isOpenInstall(i) && i.equipStatus === "Ready").length;
  const notReadyN = allInstalls.filter((i) => isOpenInstall(i) && i.equipStatus !== "Ready").length;
  const installedN = allInstalls.filter((i) => isInstalled(i)).length;
  const week = weekBounds(todayChicago());
  const openInstalls = allInstalls.filter((i) => isOpenInstall(i));
  const readyOpen = openInstalls.filter((i) => i.equipStatus === "Ready");
  const notReadyOpen = openInstalls.filter((i) => i.equipStatus !== "Ready");
  const datedThisWeek = (list: typeof openInstalls) =>
    list.filter((i) => i.installDate && i.installDate >= week.start && i.installDate <= week.end).length;
  const noDate = (list: typeof openInstalls) => list.filter((i) => !i.installDate).length;
  const readyByEquip = tally(
    allInstalls
      .filter((i) => isOpenInstall(i) && i.equipStatus === "Ready")
      .flatMap((i) => {
        const listed = listedEquipment(
          (i.machines ?? []).map((m) => m.equipment).join("\n") || i.equipment,
          catalog,
        );
        return listed.length ? listed : [matchModel(i.equipment || "Unspecified", catalog)];
      }),
    (n) => n,
  );
  const statusMix = [
    { name: "Not Ready", count: notReadyN },
    { name: "Ready", count: readyN },
    { name: "Installed", count: installedN },
  ].filter((s) => s.count > 0);

  function openRecipe(d: RecipeDraft) {
    setSelected(null);
    setRecipeDraft(d);
  }

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
    if (unique.length > 1) {
      setConfirmIds(unique);
      return;
    }
    markInstalled.mutate(unique);
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Install clock</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Prep queue for every account not yet installed. Each machine on the row carries its own recipe —
            linked to that customer, shared with techs and sales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MyViewBar />
          <ExportButton defaultType="installs" label="Export readiness" />
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New install
          </Button>
        </div>
      </header>
      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
        <p className="flex items-start gap-2 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium">New install requests — </span>
            There is a 2-week lead-time to allow time to prep equipment, including in-between
            service calls and PMs.
          </span>
        </p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{atRisk} at risk this week or next.</p>
      <p className="mt-1 text-sm">
        <span className="font-medium">{notReadyN}</span> not ready
        <span className="text-muted-foreground">
          {" "}
          ({datedThisWeek(notReadyOpen)} this week · {noDate(notReadyOpen)} no date)
        </span>
        {" · "}
        <span className="font-medium">{readyN}</span> ready
        <span className="text-muted-foreground">
          {" "}
          ({datedThisWeek(readyOpen)} this week · {noDate(readyOpen)} no date)
        </span>
        <span className="text-muted-foreground"> — weekly team update</span>
      </p>
      <StatRow>
        <StatCard
          label="Ready"
          value={readyN}
          hint="Cleared to go on site"
          breakdown={readyByEquip}
          selected={view === "ready"}
          onClick={() => setView((v) => toggleChip(v, "ready", "all"))}
        />
        <StatCard
          label="Not ready"
          value={notReadyN}
          hint="Still in prep"
          selected={view === "not-ready"}
          onClick={() => setView((v) => toggleChip(v, "not-ready", "all"))}
        />
        <StatCard
          label="Installed"
          value={installedN}
          selected={view === "installed"}
          onClick={() => setView((v) => toggleChip(v, "installed", "all"))}
        />
      </StatRow>
      {statusMix.length ? (
        <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <ChartCard title="Board mix" lede="Every install, including completed.">
            <StatusDonut data={statusMix} unit="installs" />
          </ChartCard>
          <ChartCard title="Ready machines" lede="What’s actually cleared — one bar per model.">
            {readyByEquip.length ? (
              <SimpleBars
                data={readyByEquip.slice(0, 8).map((r) => ({ model: r.name, count: r.count }))}
                xKey="model"
                yKey="count"
                yLabel="Machines"
                horizontal
              />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing marked Ready.</p>
            )}
          </ChartCard>
        </section>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip selected={view === "queue"} onClick={() => setView("queue")}>
          Queue ({(data.data ?? []).filter((i) => isOpenInstall(i)).length})
        </FilterChip>
        <FilterChip selected={view === "board"} onClick={() => setView("board")}>
          Board
        </FilterChip>
        <FilterChip selected={view === "all"} onClick={() => setView("all")}>
          All installs
        </FilterChip>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="max-w-xs" />
        <RepFilter value={repFilter} onChange={setRepFilter} extraNames={(data.data ?? []).map((i) => i.accountRep)} />
        <label className="flex h-9 items-center gap-2 rounded-full bg-secondary px-3 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={akOnly} onChange={(e) => setAkOnly(e.target.checked)} />
          AK
        </label>
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} />
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
      {view === "board" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(["Not Ready", "Ready", "Installed"] as const).map((col) => {
            const colRows = rows.filter((i) =>
              col === "Installed" ? isInstalled(i) : (i.equipStatus ?? "Not Ready") === col && isOpenInstall(i),
            );
            return (
              <div key={col} className="rounded-xl border border-border bg-card p-3">
                <p className="px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                  {col} · {colRows.length}
                </p>
                <ul className="mt-2 space-y-2">
                  {colRows.map((i) => (
                    <li key={i.id}>
                      <InstallCard
                        install={i}
                        catalog={catalog}
                        recipes={recipes}
                        onOpen={() => setSelected(i.id)}
                        onRecipe={openRecipe}
                        selected={picked.includes(i.id)}
                        onToggleSelect={(on) => togglePicked(i.id, on)}
                        onMarkInstalled={() => requestMark([i.id])}
                        marking={markInstalled.isPending}
                      />
                    </li>
                  ))}
                  {colRows.length === 0 ? (
                    <li className="px-1 py-4 text-xs text-muted-foreground">Empty</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((i) => (
            <InstallRow
              key={i.id}
              install={i}
              catalog={catalog}
              recipes={recipes}
              onOpen={() => setSelected(i.id)}
              onRecipe={openRecipe}
              selected={picked.includes(i.id)}
              onToggleSelect={(on) => togglePicked(i.id, on)}
              onMarkInstalled={() => requestMark([i.id])}
              marking={markInstalled.isPending}
            />
          ))}
          {rows.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">Queue is empty.</p> : null}
        </div>
      )}
      <InstallSheet row={selectedRow} onClose={() => setSelected(null)} onOpenRelated={(id) => setSelected(id)} />
      <RecipeEditorSheet
        draft={recipeDraft}
        models={catalog}
        customers={customers.data ?? []}
        onClose={() => setRecipeDraft(null)}
      />
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
          <DialogTitle>Mark installed</DialogTitle>
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
      <DialogContent className="max-w-2xl">
        <DialogTitle>New install</DialogTitle>
        <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>There is a 2-week lead-time to allow time to prep equipment, including in-between service calls and PMs.</span>
          </p>
        </div>
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
          <div className="grid min-w-0 gap-3">
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
              menuInFlow
            />
            <EquipmentMultiCombo
              values={equipment}
              onChange={(next) => {
                setEquipment(next);
                setSpecs(mergeMachineSpecs(next, specs));
              }}
              placeholder="Search the full equipment list…"
              menuInFlow
            />
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            Open the equipment field to scroll the full list, or type a model and add it if it isn’t there.
          </p>
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
          {customer && specs.length ? <MachineFields specs={specs} onChange={setSpecs} /> : null}
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
}: {
  install: Install;
  open: boolean;
  onMark?: () => void;
  marking?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
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
              <StatusBadge status={i.equipStatus} />
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
        <InstallActions install={i} open={open} onMark={onMarkInstalled} marking={marking} />
      </div>
    </article>
  );
}

function InstallCard({
  install: i,
  catalog,
  recipes,
  onOpen,
  onRecipe,
  selected,
  onToggleSelect,
  onMarkInstalled,
  marking,
}: InstallItemProps) {
  const open = isOpenInstall(i);
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="flex items-start justify-between gap-1">
        {open ? (
          <OpenInstallSelect customer={i.customer} selected={selected} onToggle={onToggleSelect} />
        ) : null}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:underline">
          <p className="font-medium">
            {i.customer} <AkBadge on={i.aviKatz} className="ml-1 align-middle" />
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatShortDate(i.installDate)}</p>
        </button>
        <InstallActions install={i} open={open} onMark={onMarkInstalled} marking={marking} />
      </div>
      {machineNotes(i, false)}
      <div className="mt-1 flex flex-wrap gap-1">
        <FlagBadge flag={i.flag} />
        <DuplicateBadge install={i} />
        {i.noRep ? <NoRepFlag show /> : null}
      </div>
      <InstallEquipChips
        install={i}
        catalog={catalog}
        recipes={recipes}
        onRecipe={onRecipe}
        empty={i.equipment ? <p className="mt-1 text-xs text-muted-foreground">{i.equipment}</p> : null}
      />
    </div>
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
