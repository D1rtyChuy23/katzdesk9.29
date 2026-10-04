import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createModule, listModules } from "@/lib/ops/api";
import { MODULE_PLATFORMS, MODULE_TYPES } from "@/lib/ops/lookups";
import { moduleAccount, moduleAvailability, type ModuleAvailability } from "@/lib/ops/eversys";
import { AssignModuleDialog, AssignedLine, ModuleReturnActions } from "@/components/desk/module-assign";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import type { ModuleRow } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/desk/flag-badge";
import { ModuleSheet, SimpleCreateDialog } from "@/components/desk/entity-sheets";
import { ChartCard, SimpleBars, StatCard, StatRow, StatusDonut, toggleChip } from "@/components/desk/desk-charts";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, SORT_EQUIP, SORT_STATUS, SORT_TECH, equipmentCount, sortDesk, tally } from "@/lib/ops/sort";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ExportButton } from "@/components/desk/export-dialog";
import { TechName } from "@/components/desk/tech-select";

export const Route = createFileRoute("/_app/modules")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["modules"], queryFn: () => listModules() });
  const [q, setQ] = useState("");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort("modules", "status");
  const [bubble, setBubble] = useState<"ready" | "shop" | null>(null);
  // Default view is HQ stock: what is here and can go out.
  const [avail, setAvail] = useState<ModuleAvailability | "all">("hq");
  const [platform, setPlatform] = useState("");
  const [account, setAccount] = useState("");
  const [mtype, setMtype] = useState("");
  const [assignFor, setAssignFor] = useState<ModuleRow | null>(null);
  const all = data.data ?? [];
  const hqRows = all.filter((m) => moduleAvailability(m) === "hq");
  const assignedRows = all.filter((m) => moduleAvailability(m) === "assigned");
  const readyRows = hqRows.filter((m) => m.status === "Ready");
  const notReady = hqRows.filter((m) => m.status !== "Ready");
  const availCount = { hq: hqRows.length, assigned: assignedRows.length, all: all.length, away: all.length - hqRows.length - assignedRows.length };
  const accounts = useMemo(
    () => [...new Set(assignedRows.map((m) => moduleAccount(m)).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [assignedRows],
  );
  const platforms = useMemo(
    () => [...new Set([...MODULE_PLATFORMS, ...(all.map((m) => m.platform).filter(Boolean) as string[])])],
    [all],
  );
  const types = useMemo(
    () => [...new Set([...MODULE_TYPES, ...(all.map((m) => m.moduleType).filter(Boolean) as string[])])],
    [all],
  );
  const readyByTypeAll = MODULE_TYPES.map((type) => ({
    name: type,
    count: readyRows.filter((m) => m.moduleType === type).length,
  }));
  const extraTypes = tally(readyRows, (m) => m.moduleType).filter(
    (r) => !MODULE_TYPES.includes(r.name as (typeof MODULE_TYPES)[number]),
  );
  const readyByTypeChart = [...readyByTypeAll, ...extraTypes];
  const statusMix = tally(all, (m) => m.status);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all;
    if (avail !== "all") list = list.filter((m) => moduleAvailability(m) === avail);
    if (bubble === "ready") list = list.filter((m) => moduleAvailability(m) === "hq" && m.status === "Ready");
    if (bubble === "shop") list = list.filter((m) => moduleAvailability(m) === "hq" && m.status !== "Ready");
    if (platform) list = list.filter((m) => (m.platform ?? "") === platform);
    if (account) list = list.filter((m) => moduleAccount(m) === account);
    if (mtype) list = list.filter((m) => (m.moduleType ?? "") === mtype);
    if (needle) {
      list = list.filter((m) =>
        [m.moduleId, m.location, m.moduleType, m.status, m.wo, m.assignedCustomer, m.assignedUnitLabel]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return sortDesk(list, sort, {
      date: (m) => m.dateReady ?? m.dateIn ?? m.updatedAt,
      name: (m) => m.moduleId,
      equipment: (m) => equipmentCount(m.moduleType),
      status: (m) => m.status,
      tech: (m) => m.technician,
    });
  }, [all, q, sort, bubble, avail, platform, account, mtype]);
  const selectedRow = all.find((m) => m.id === selected) ?? null;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Eversys Modules</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One row per module serial. A module is part of an Eversys machine: assign it to the unit on a café, and it
            leaves HQ stock until it comes back.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton defaultType="modules" />
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New Module
          </Button>
        </div>
      </header>
      <StatRow>
        <StatCard
          label="At HQ"
          value={hqRows.length}
          hint="Here and not on a café"
          selected={avail === "hq" && !bubble}
          onClick={() => {
            setAvail("hq");
            setBubble(null);
          }}
        />
        <StatCard
          label="Ready At HQ"
          value={readyRows.length}
          hint={tally(readyRows, (m) => m.platform).map((p) => `${p.count} ${p.name}`).join(" · ") || "Nothing ready"}
          selected={bubble === "ready"}
          onClick={() => {
            setAvail("hq");
            setBubble((v) => toggleChip(v, "ready", null));
          }}
        />
        <StatCard
          label="In Shop"
          value={notReady.length}
          hint="At HQ, not ready yet"
          selected={bubble === "shop"}
          onClick={() => {
            setAvail("hq");
            setBubble((v) => toggleChip(v, "shop", null));
          }}
        />
        <StatCard
          label="Assigned"
          value={assignedRows.length}
          hint="On a café machine"
          selected={avail === "assigned"}
          onClick={() => {
            setAvail("assigned");
            setBubble(null);
          }}
        />
      </StatRow>
      <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="By Status" lede="Where every module sits.">
          {statusMix.length ? <StatusDonut data={statusMix} unit="modules" /> : <p className="text-sm text-muted-foreground">No modules yet.</p>}
        </ChartCard>
        <ChartCard title="Ready At HQ By Type" lede="What can actually ship.">
          {readyRows.length ? (
            <SimpleBars
              data={readyByTypeChart.map((r) => ({ type: r.name.replace(" Module", ""), count: r.count }))}
              xKey="type"
              yKey="count"
              yLabel="Ready"
              horizontal
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing marked Ready at HQ.</p>
          )}
        </ChartCard>
      </section>
      <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search serial, account…" className="h-9 w-56 shrink-0" aria-label="Search modules" />
        <div className="flex shrink-0 overflow-hidden rounded-full border border-border bg-card" role="tablist" aria-label="Where modules are">
          {(
            [
              ["hq", "Available (HQ)"],
              ["assigned", "Assigned"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={avail === id}
              data-testid={`avail-${id}`}
              onClick={() => {
                setAvail(id);
                setBubble(null);
              }}
              className={cn(
                "h-9 px-3 text-xs font-medium tabular",
                avail === id ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label} {availCount[id]}
            </button>
          ))}
        </div>
        <SelectField value={platform} onChange={(e) => setPlatform(e.target.value)} allowEmpty emptyLabel="All Models" className="h-9 w-auto shrink-0" aria-label="Filter by Eversys model">
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <SelectField value={mtype} onChange={(e) => setMtype(e.target.value)} allowEmpty emptyLabel="All Types" className="h-9 w-auto shrink-0" aria-label="Filter by module type">
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </SelectField>
        {accounts.length ? (
          <SelectField value={account} onChange={(e) => setAccount(e.target.value)} allowEmpty emptyLabel="All Accounts" className="h-9 w-auto max-w-56 shrink-0" aria-label="Filter by account">
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </SelectField>
        ) : null}
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[...SORT_STATUS, ...SORT_ALPHA, ...SORT_DATE, ...SORT_EQUIP, ...SORT_TECH]}
          className="shrink-0"
        />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card" data-testid="module-list">
        {rows.map((m) => {
          const where = moduleAvailability(m);
          return (
            <div
              key={m.id}
              data-testid={`module-row-${m.moduleId}`}
              data-avail={where}
              className={cn(
                "grid gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center",
                where !== "hq" && "bg-muted/30",
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(m.id)}
                className={cn(
                  "desk-flat grid min-w-0 gap-1 rounded-md text-left hover:bg-muted/50 md:grid-cols-[8rem_1fr_9rem_7rem] md:items-center",
                  where !== "hq" && "opacity-55 hover:opacity-80",
                )}
              >
                <span className="font-mono text-xs">{m.moduleId}</span>
                <span className="min-w-0">
                  <span className="font-medium">{m.moduleType}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {m.platform}
                    {where === "hq" ? ` · ${m.location && m.location.toUpperCase() !== "SHELF" ? m.location : "At HQ"}` : ""}
                  </span>
                  {where === "assigned" ? <AssignedLine row={m} /> : null}
                </span>
                <StatusBadge status={m.status} />
                <span className="text-sm">
                  <TechName name={m.technician} />
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {where === "hq" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setAssignFor(m)} data-testid={`assign-${m.moduleId}`}>
                    Assign To Account
                  </Button>
                ) : where === "assigned" ? (
                  <ModuleReturnActions row={m} compact />
                ) : null}
              </div>
            </div>
          );
        })}
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            {avail === "hq" ? "No modules at HQ match these filters." : "No modules in this view."}
          </p>
        ) : null}
      </div>
      <ModuleSheet row={selectedRow} onClose={() => setSelected(null)} onAssign={(m) => setAssignFor(m)} />
      <AssignModuleDialog module={assignFor} onOpenChange={(o) => !o && setAssignFor(null)} />
      <SimpleCreateDialog
        title="New Module"
        open={create}
        onOpenChange={setCreate}
        fields={[{ name: "moduleId", label: "Module Serial", required: true }]}
        onSubmit={async (v) => {
          const row = await createModule({ data: { moduleId: v.moduleId } });
          void qc.invalidateQueries({ queryKey: ["modules"] });
          toast.success("Module added");
          setSelected(row.id);
        }}
      />
    </div>
  );
}
