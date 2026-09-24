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
import { ActionMenu, StatCard, StatRow, toggleChip } from "@/components/desk/desk-charts";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_LIST, equipmentCount, sortDesk } from "@/lib/ops/sort";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ExportButton } from "@/components/desk/export-dialog";
import { TechName } from "@/components/desk/tech-select";
import { AkBadge } from "@/components/desk/ak-badge";
import { useMyView } from "@/components/desk/my-view-bar";
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
          <ActionMenu label="Export">
            <ExportButton defaultType="pms" />
          </ActionMenu>
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
      <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PMs…" className="h-9 w-56 shrink-0" aria-label="Search PMs" />
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} className="shrink-0" />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className="desk-lift grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.3fr_1fr_8rem_8rem_7rem] md:items-center"
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
        {rows.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-sm text-muted-foreground">
              {q.trim() ? "Nothing matches this search." : "No PMs in this view."}
            </p>
            {!q.trim() && view === "active" ? (
              <Button type="button" size="sm" className="mt-3" onClick={() => setCreate(true)}>
                <Plus className="size-4" />
                New PM
              </Button>
            ) : null}
          </div>
        ) : null}
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
