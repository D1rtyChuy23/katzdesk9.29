import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInstall,
  listAssets,
  listCustomers,
  listDirectory,
  listInstalls,
  listRecipes,
  updateInstall,
} from "@/lib/ops/api";
import { catalogModels, dropEquipment, listedEquipment, piecesForInstall } from "@/lib/ops/equipment";
import { mergeMachineSpecs, serializeMachines, type MachineSpec } from "@/lib/ops/machines";
import { formatShortDate } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlagBadge, StatusBadge } from "@/components/desk/flag-badge";
import { InstallSheet } from "@/components/desk/entity-sheets";
import { RecipeChip, RecipeEditorSheet } from "@/components/desk/recipe-sheet";
import type { RecipeDraft } from "@/components/desk/recipe-form";
import { CustomerCombo, EquipmentMultiCombo } from "@/components/desk/directory-fields";
import { MachineFields } from "@/components/desk/machine-fields";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_LIST, equipmentCount, sortDesk, tally } from "@/lib/ops/sort";
import { ChartCard, SimpleBars, StatCard, StatusDonut } from "@/components/desk/desk-charts";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Install, Recipe } from "@/lib/ops/types";

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
  const [view, setView] = useState<"queue" | "board" | "all">("queue");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null);
  const [sort, setSort] = useDeskSort("installs", "date-asc");
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
    if (view === "queue") list = list.filter((i) => !i.complete && i.equipStatus !== "Installed");
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
  }, [data.data, q, view, sort]);
  const selectedRow = (data.data ?? []).find((i) => i.id === selected) ?? null;
  const allInstalls = data.data ?? [];
  const atRisk = allInstalls.filter((i) => i.flag).length;
  const recipes = recs.data ?? [];
  const readyN = allInstalls.filter((i) => !i.complete && i.equipStatus === "Ready").length;
  const notReadyN = allInstalls.filter((i) => !i.complete && i.equipStatus !== "Ready" && i.equipStatus !== "Installed").length;
  const installedN = allInstalls.filter((i) => i.complete || i.equipStatus === "Installed").length;
  const readyByEquip = tally(
    allInstalls
      .filter((i) => !i.complete && i.equipStatus === "Ready")
      .flatMap((i) => {
        const names = (i.machines ?? []).map((m) => m.equipment).filter(Boolean);
        if (names.length) return names;
        const listed = listedEquipment(i.equipment, catalog);
        return listed.length ? listed : [i.equipment || "Unspecified"];
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
        <Button onClick={() => setCreate(true)}>
          <Plus className="size-4" />
          New install
        </Button>
      </header>
      <p className="mt-3 text-sm text-muted-foreground">{atRisk} at risk this week or next.</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard label="Ready" value={readyN} hint="Cleared to go on site" breakdown={readyByEquip} />
        <StatCard label="Not ready" value={notReadyN} hint="Still in prep" />
        <StatCard label="Installed" value={installedN} />
      </div>
      {statusMix.length ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-2">
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
        <button type="button" onClick={() => setView("queue")} className={`h-9 rounded-full px-3 text-sm font-medium ${view === "queue" ? "bg-ink text-ink-foreground" : "bg-secondary"}`}>
          Queue ({(data.data ?? []).filter((i) => !i.complete && i.equipStatus !== "Installed").length})
        </button>
        <button type="button" onClick={() => setView("board")} className={`h-9 rounded-full px-3 text-sm font-medium ${view === "board" ? "bg-ink text-ink-foreground" : "bg-secondary"}`}>
          Board
        </button>
        <button type="button" onClick={() => setView("all")} className={`h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`}>
          All installs
        </button>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="max-w-xs" />
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} />
      </div>
      {view === "board" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(["Not Ready", "Ready", "Installed"] as const).map((col) => {
            const colRows = rows.filter((i) =>
              col === "Installed"
                ? i.equipStatus === "Installed" || i.complete
                : (i.equipStatus ?? "Not Ready") === col && !i.complete,
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
          />
        ))}
        {rows.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">Queue is empty.</p> : null}
      </div>
      )}
      <InstallSheet row={selectedRow} onClose={() => setSelected(null)} />
      <RecipeEditorSheet
        draft={recipeDraft}
        models={catalog}
        customers={customers.data ?? []}
        onClose={() => setRecipeDraft(null)}
      />
      <NewInstallDialog open={create} onOpenChange={setCreate} onCreated={(id) => setSelected(id)} />
    </div>
  );
}

function NewInstallDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [specs, setSpecs] = useState<MachineSpec[]>([]);
  const [pending, setPending] = useState(false);
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
              toast.success("Install added");
              onOpenChange(false);
              onCreated(row.id);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <CustomerCombo value={customer} onChange={setCustomer} required />
            <EquipmentMultiCombo
              values={equipment}
              onChange={(next) => {
                setEquipment(next);
                setSpecs(mergeMachineSpecs(next, specs));
              }}
              placeholder="Search the full equipment list…"
            />
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            Open the equipment field to scroll the full list, or type a model and add it if it isn’t there.
          </p>
          {customer && specs.length ? <MachineFields specs={specs} onChange={setSpecs} /> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !customer.trim()}>
              Create
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
                machines: packed.machines ? JSON.parse(packed.machines) : [],
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

function InstallRow({
  install: i,
  catalog,
  recipes,
  onOpen,
  onRecipe,
}: {
  install: Install;
  catalog: string[];
  recipes: Recipe[];
  onOpen: () => void;
  onRecipe: (d: RecipeDraft) => void;
}) {
  const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
  const remove = useRemoveEquip(i, catalog);
  return (
    <article className="border-b border-border px-4 py-3 last:border-b-0">
      <div className="grid grid-cols-1 gap-1 md:grid-cols-[5rem_minmax(0,1fr)_7rem_8rem] md:items-center">
        <button type="button" onClick={onOpen} className="text-left tabular text-sm font-medium hover:underline">
          {i.daysOut == null ? "needs date" : i.daysOut < 0 ? `${i.daysOut}d` : i.daysOut === 0 ? "today" : `${i.daysOut}d`}
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 truncate text-left font-medium hover:underline">
          {i.customer}
        </button>
        <div className="flex flex-wrap gap-1">
          <FlagBadge flag={i.flag} />
          <StatusBadge status={i.equipStatus} />
        </div>
        <button type="button" onClick={onOpen} className="text-left text-sm text-muted-foreground hover:text-foreground">
          {formatShortDate(i.installDate)} · {i.technician ?? "—"}
        </button>
      </div>
      {machineNotes(i)}
      <div className="mt-2 flex flex-wrap gap-1.5 md:pl-20">
        {pieces.length === 0 ? (
          <span className="text-xs text-muted-foreground">{i.equipment || "No equipment listed"}</span>
        ) : (
          pieces.map((p, idx) => (
            <RecipeChip
              key={`${p.model}-${p.label}-${idx}`}
              piece={p}
              customer={i.customer}
              installId={i.id}
              recipes={recipes}
              onOpen={onRecipe}
              onRemove={() => remove.mutate(p.label)}
            />
          ))
        )}
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
}: {
  install: Install;
  catalog: string[];
  recipes: Recipe[];
  onOpen: () => void;
  onRecipe: (d: RecipeDraft) => void;
}) {
  const pieces = piecesForInstall(i.equipment, i.customer, i.id, catalog, recipes);
  const remove = useRemoveEquip(i, catalog);
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <button type="button" onClick={onOpen} className="w-full text-left hover:underline">
        <p className="font-medium">{i.customer}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatShortDate(i.installDate)}</p>
      </button>
      {machineNotes(i, false)}
      <div className="mt-1">
        <FlagBadge flag={i.flag} />
      </div>
      {pieces.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pieces.map((p) => (
            <RecipeChip
              key={`${p.model}-${p.label}`}
              piece={p}
              customer={i.customer}
              installId={i.id}
              recipes={recipes}
              onOpen={onRecipe}
              onRemove={() => remove.mutate(p.label)}
            />
          ))}
        </div>
      ) : i.equipment ? (
        <p className="mt-1 text-xs text-muted-foreground">{i.equipment}</p>
      ) : null}
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
