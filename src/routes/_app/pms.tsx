import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPm, listPms } from "@/lib/ops/api";
import { isOpenPm } from "@/lib/ops/ticket-status";
import { formatShortDate } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlagBadge, StatusBadge } from "@/components/desk/flag-badge";
import { PmSheet, SimpleCreateDialog } from "@/components/desk/entity-sheets";
import { ChartCard, FilterChip, SimpleBars, StatCard, StatRow, StatusDonut, toggleChip } from "@/components/desk/desk-charts";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_LIST, equipmentCount, sortDesk, tally } from "@/lib/ops/sort";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ExportButton } from "@/components/desk/export-dialog";
import { TechName } from "@/components/desk/tech-select";
import { AkBadge } from "@/components/desk/ak-badge";
import { MyViewBar, useMyView } from "@/components/desk/my-view-bar";
import { mineByTechnician } from "@/lib/ops/my-view";

export const Route = createFileRoute("/_app/pms")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const pms = useQuery({ queryKey: ["pms"], queryFn: () => listPms() });
  const [q, setQ] = useState("");
  const [view, setView] = useState<"active" | "all" | "flagged" | "need-date">("active");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort("pms", "date-asc");
  const { filterMine, matchMine, role } = useMyView();

  const rows = useMemo(() => {
    let list = pms.data ?? [];
    if (view === "active") list = list.filter((p) => isOpenPm(p));
    if (view === "flagged") list = list.filter((p) => p.flag);
    if (view === "need-date") list = list.filter((p) => isOpenPm(p) && !p.projected);
    list = mineByTechnician(list, { filterMine, role, matchMine });
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((p) =>
        [p.customer, p.equipment, p.style, p.technician].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return sortDesk(list, sort, {
      date: (p) => p.projected ?? p.received,
      name: (p) => p.customer,
      equipment: (p) => equipmentCount(p.equipment),
      status: (p) => p.status,
      flagRank: (p) => p.flag?.rank ?? 99,
      tech: (p) => p.technician,
    });
  }, [pms.data, q, view, sort, filterMine, matchMine, role]);
  const selectedRow = (pms.data ?? []).find((p) => p.id === selected) ?? null;
  const all = pms.data ?? [];
  const active = all.filter((p) => isOpenPm(p));
  const flagged = all.filter((p) => p.flag);
  const statusMix = tally(active, (p) => p.status);
  const styleMix = tally(active, (p) => p.style);
  const needDate = active.filter((p) => !p.projected).length;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Preventative maintenance</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Projected dates go amber inside 14 days and red once they slip. Need-a-date PMs sit at the top.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MyViewBar />
          <ExportButton defaultType="pms" />
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New PM
          </Button>
        </div>
      </header>
      <StatRow>
        <StatCard
          label="Active"
          value={active.length}
          hint={`${all.length} in history`}
          selected={view === "active"}
          onClick={() => setView((v) => toggleChip(v, "active", "all"))}
        />
        <StatCard
          label="Flagged"
          value={flagged.length}
          tone={flagged.length ? "warn" : undefined}
          hint="Inside 14 days or slipped"
          selected={view === "flagged"}
          onClick={() => setView((v) => toggleChip(v, "flagged", "all"))}
        />
        <StatCard
          label="Need a date"
          value={needDate}
          tone={needDate ? "warn" : undefined}
          hint="Active PMs with no projected date"
          selected={view === "need-date"}
          onClick={() => setView((v) => toggleChip(v, "need-date", "all"))}
        />
      </StatRow>
      <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="Active by status">
          {statusMix.length ? <StatusDonut data={statusMix} unit="active" /> : <p className="text-sm text-muted-foreground">No active PMs.</p>}
        </ChartCard>
        <ChartCard title="By style" lede="How the remaining book is split.">
          {styleMix.length ? (
            <SimpleBars
              data={styleMix.map((s) => ({ label: s.name, count: s.count }))}
              xKey="label"
              yKey="count"
              yLabel="PMs"
              horizontal
            />
          ) : (
            <p className="text-sm text-muted-foreground">No styles on active PMs.</p>
          )}
        </ChartCard>
      </section>
      <div className="mt-5 flex flex-wrap gap-2">
        <FilterChip selected={view === "active"} onClick={() => setView("active")}>
          Active
        </FilterChip>
        <FilterChip selected={view === "all"} onClick={() => setView("all")}>
          All
        </FilterChip>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="max-w-xs" />
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className="grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.3fr_1fr_8rem_8rem_7rem] md:items-center"
          >
            <span>
              <span className="font-medium">{p.customer}</span>
              <AkBadge on={p.aviKatz} className="ml-1 align-middle" />
              <span className="mt-0.5 block text-xs text-muted-foreground">{p.equipment}</span>
            </span>
            <span className="flex flex-wrap gap-1">
              <FlagBadge flag={p.flag} />
            </span>
            <StatusBadge status={p.status} />
            <span className="tabular text-sm text-muted-foreground">{formatShortDate(p.projected)}</span>
            <span className="text-sm">
              <TechName name={p.technician} />
            </span>
          </button>
        ))}
        {rows.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">No PMs in this view.</p> : null}
      </div>
      <PmSheet pm={selectedRow} onClose={() => setSelected(null)} />
      <SimpleCreateDialog
        title="New PM"
        open={create}
        onOpenChange={setCreate}
        fields={[
          { name: "customer", label: "Customer", required: true, kind: "customer" },
          { name: "equipment", label: "Equipment", kind: "equipment" },
        ]}
        onSubmit={async (v) => {
          const row = await createPm({ data: { customer: v.customer, equipment: v.equipment } });
          void qc.invalidateQueries({ queryKey: ["pms"] });
          toast.success("PM added");
          setSelected(row.id);
        }}
      />
    </div>
  );
}
