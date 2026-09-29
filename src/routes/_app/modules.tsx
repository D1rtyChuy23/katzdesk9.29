import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createModule, listModules } from "@/lib/ops/api";
import { MODULE_TYPES } from "@/lib/ops/lookups";
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
  const [bubble, setBubble] = useState<"tracked" | "ready" | "shop" | null>("tracked");
  const all = data.data ?? [];
  const readyRows = all.filter((m) => m.status === "Ready");
  const notReady = all.filter((m) => m.status !== "Ready" && m.status !== "Installed at Account" && m.status !== "Retired / Scrapped");
  const readyByTypeAll = MODULE_TYPES.map((type) => ({
    name: type,
    count: readyRows.filter((m) => m.moduleType === type).length,
  }));
  const extraTypes = tally(readyRows, (m) => m.moduleType).filter(
    (r) => !MODULE_TYPES.includes(r.name as (typeof MODULE_TYPES)[number]),
  );
  const readyByTypeChart = [...readyByTypeAll, ...extraTypes];
  const readyByPlatform = tally(readyRows, (m) => m.platform);
  const statusMix = tally(all, (m) => m.status);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = all;
    if (bubble === "ready") list = list.filter((m) => m.status === "Ready");
    if (bubble === "shop") {
      list = list.filter((m) => m.status !== "Ready" && m.status !== "Installed at Account" && m.status !== "Retired / Scrapped");
    }
    if (needle) {
      list = list.filter((m) =>
        [m.moduleId, m.location, m.moduleType, m.status, m.wo].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return sortDesk(list, sort, {
      date: (m) => m.dateReady ?? m.dateIn ?? m.updatedAt,
      name: (m) => m.moduleId,
      equipment: (m) => equipmentCount(m.moduleType),
      status: (m) => m.status,
      tech: (m) => m.technician,
    });
  }, [all, q, sort, bubble]);
  const selectedRow = all.find((m) => m.id === selected) ?? null;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Eversys modules</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One row per physical module. The Ready count splits by type so you can see what can actually ship.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton defaultType="modules" />
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New module
          </Button>
        </div>
      </header>
      <StatRow>
        <StatCard
          label="Tracked"
          value={all.length}
          hint="Every module on the board"
          selected={bubble === "tracked"}
          onClick={() => setBubble((v) => toggleChip(v, "tracked", null))}
        />
        <StatCard
          label="Ready"
          value={readyRows.length}
          hint={readyByPlatform.map((p) => `${p.count} ${p.name}`).join(" · ") || "Nothing ready"}
          selected={bubble === "ready"}
          onClick={() => setBubble((v) => toggleChip(v, "ready", null))}
        />
        <StatCard
          label="In shop"
          value={notReady.length}
          hint="Not ready, not installed, not retired"
          selected={bubble === "shop"}
          onClick={() => setBubble((v) => toggleChip(v, "shop", null))}
        />
      </StatRow>
      <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="By status" lede="Where the shop floor actually sits.">
          {statusMix.length ? <StatusDonut data={statusMix} unit="modules" /> : <p className="text-sm text-muted-foreground">No modules yet.</p>}
        </ChartCard>
        <ChartCard title="Ready by type" lede="The Ready bubble, unpacked.">
          {readyRows.length ? (
            <SimpleBars
              data={readyByTypeChart.map((r) => ({ type: r.name.replace(" Module", ""), count: r.count }))}
              xKey="type"
              yKey="count"
              yLabel="Ready"
              horizontal
            />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing marked Ready.</p>
          )}
        </ChartCard>
      </section>
      <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter modules…" className="h-9 w-56 shrink-0" aria-label="Filter modules" />
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[...SORT_STATUS, ...SORT_ALPHA, ...SORT_DATE, ...SORT_EQUIP, ...SORT_TECH]}
          className="shrink-0"
        />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelected(m.id)}
            className="desk-lift grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[8rem_1fr_8rem_8rem] md:items-center"
          >
            <span className="font-mono text-xs">{m.moduleId}</span>
            <span>
              <span className="font-medium">{m.moduleType}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {m.platform} · {m.location ?? "—"}
              </span>
            </span>
            <StatusBadge status={m.status} />
            <span className="text-sm">
              <TechName name={m.technician} />
            </span>
          </button>
        ))}
        {rows.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">No modules in this view.</p> : null}
      </div>
      <ModuleSheet row={selectedRow} onClose={() => setSelected(null)} />
      <SimpleCreateDialog
        title="New module"
        open={create}
        onOpenChange={setCreate}
        fields={[{ name: "moduleId", label: "Module ID", required: true }]}
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
