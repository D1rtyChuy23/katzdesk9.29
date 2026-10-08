import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveDeal, createDeal, listDeals } from "@/lib/ops/api";
import { money } from "@/lib/ops/clock";
import { PRODUCERS, isNoRep } from "@/lib/ops/lookups";
import { sameRep } from "@/lib/ops/reps";
import { RepFilter } from "@/components/desk/rep-select";
import { RepDealsPanel, RepLink } from "@/components/desk/rep-deals-panel";
import { formatRep } from "@/lib/ops/rep-match";
import { AkBadge, NoRepFlag } from "@/components/desk/ak-badge";
import { useMyView } from "@/components/desk/my-view-bar";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/desk/flag-badge";
import { DealSheet, SimpleCreateDialog } from "@/components/desk/entity-sheets";
import { ChartCard, SimpleBars, StackedMoneyBars, StatCard, StatRow, toggleChip } from "@/components/desk/desk-charts";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_DEALS, equipmentCount, sortDesk } from "@/lib/ops/sort";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Deal } from "@/lib/ops/types";

export const Route = createFileRoute("/_app/pipeline")({
  validateSearch: parseOpenSearch,
  component: Page,
});

type DealView = "open" | "complete" | "all" | "gto" | "ordered";

function sum(rows: Deal[]) {
  return rows.reduce((n, d) => n + (d.amount ?? 0), 0);
}

function sizeBucket(amount: number | null | undefined) {
  if (amount == null || amount === 0) return "No amount";
  if (amount < 5000) return "Under $5k";
  if (amount < 15000) return "$5–15k";
  if (amount < 40000) return "$15–40k";
  return "$40k+";
}

function completionLabel(d: Deal) {
  if (d.completion === "complete") return "Complete";
  if (d.completion === "fell") return "Fell through";
  return "Open";
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full px-3 text-sm font-medium ${
        active ? "bg-ink text-ink-foreground" : "bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["deals"], queryFn: () => listDeals() });
  const [q, setQ] = useState("");
  const [view, setView] = useState<DealView>("gto");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const { filterMine, matchMine } = useMyView();
  const [repFilter, setRepFilter] = useState("");
  const [repPanel, setRepPanel] = useState<string | null>(null);
  const [sort, setSort] = useDeskSort("pipeline", "date-desc");


  const all = data.data ?? [];
  const live = all.filter((d) => d.completion !== "fell");
  const active = live.filter((d) => d.completion !== "complete");
  const completed = live.filter((d) => d.completion === "complete");
  const unlisted = live.filter((d) => isNoRep(d.producer));

  const gtoN = active.filter((d) => d.goodToOrder && !d.ordered).length;
  const orderedN = active.filter((d) => d.ordered).length;

  const producerChart = PRODUCERS.map((p) => {
    const mine = live.filter((d) => sameRep(d.producer, p));

    return {
      producer: p,
      open: Math.round(sum(mine.filter((d) => d.completion !== "complete"))),
      done: Math.round(sum(mine.filter((d) => d.completion === "complete"))),
    };
  }).filter((p) => p.open + p.done > 0);

  const funnel = [
    { stage: "Good to order", count: gtoN },
    { stage: "Ordered", count: orderedN },
    { stage: "Complete", count: completed.length },
  ];

  const SIZE_BUCKETS = ["No amount", "Under $5k", "$5–15k", "$15–40k", "$40k+"] as const;
  const sizeChart = SIZE_BUCKETS.map((size) => ({
    size,
    count: live.filter((d) => sizeBucket(d.amount) === size).length,
  }));

  const rows = useMemo(() => {
    let list = all;
    if (view === "open") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell");
    if (view === "complete") list = list.filter((d) => d.completion === "complete");
    if (view === "gto") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell" && d.goodToOrder && !d.ordered);
    if (view === "ordered") list = list.filter((d) => d.completion !== "complete" && d.completion !== "fell" && d.ordered);
    if (filterMine) list = list.filter((d) => matchMine(d.producer) || d.aviKatz);
    if (repFilter === "__none__") list = list.filter((d) => d.noRep);
    else if (repFilter) list = list.filter((d) => sameRep(d.producer, repFilter));
    const needle = q.trim().toLowerCase();

    if (needle) {
      list = list.filter((d) =>
        [d.customer, d.producer, d.equipment, d.invoice, d.terms]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return sortDesk(list, sort, {
      date: (d) => d.dateOfDeal ?? d.updatedAt,
      name: (d) => d.customer,
      equipment: (d) => equipmentCount(d.equipment),
      value: (d) => d.amount,
      status: (d) => completionLabel(d),
    });
  }, [all, q, view, sort, filterMine, matchMine, repFilter]);

  const selectedRow = all.find((d) => d.id === selected) ?? null;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Sales Pipeline</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One row per equipment deal. Step 1 is Good to order (rep). Step 2 is Ordered
            (you confirm it) — confirmed orders leave the Good to order list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New deal
          </Button>
        </div>
      </header>

      <StatRow>
        <StatCard
          label="Active Deals"
          value={active.length}
          selected={view === "open"}
          onClick={() => setView((v) => toggleChip(v, "open", "all"))}
        />
        <StatCard
          label="Active Pipeline"
          value={money(sum(active))}
          selected={view === "open"}
          onClick={() => setView((v) => toggleChip(v, "open", "all"))}
        />
        <StatCard
          label="Completed"
          value={completed.length}
          hint={money(sum(completed))}
          selected={view === "complete"}
          onClick={() => setView((v) => toggleChip(v, "complete", "all"))}
        />
        <StatCard
          label="Total Booked"
          value={money(sum(live))}
          selected={view === "all"}
          onClick={() => setView("all")}
        />
        <StatCard
          label="Good To Order"
          value={gtoN}
          hint="Step 1 — waiting to be ordered"
          selected={view === "gto"}
          onClick={() => setView((v) => toggleChip(v, "gto", "all"))}
        />
        <StatCard
          label="Ordered"
          value={orderedN}
          hint="Step 2 — confirmed ordered"
          selected={view === "ordered"}
          onClick={() => setView((v) => toggleChip(v, "ordered", "all"))}
        />
      </StatRow>

      <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="By Producer" lede="Open dollars stacked under completed. Fell-through deals are left out.">
          {producerChart.length ? (
            <StackedMoneyBars
              data={producerChart}
              xKey="producer"
              openKey="open"
              doneKey="done"
              renderLabel={(name) => <RepLink name={name} onPick={setRepPanel} />}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No live deals yet.</p>
          )}
        </ChartCard>
        <ChartCard title="How Deals Move" lede="Good to order first, then Ordered. Ordered deals drop off step 1.">
          <SimpleBars data={funnel} xKey="stage" yKey="count" yLabel="Deals" horizontal />
        </ChartCard>
        <ChartCard title="Deal Size" lede="Live book by amount, so a few large jobs don’t hide the rest.">
          {sizeChart.length ? (
            <SimpleBars data={sizeChart} xKey="size" yKey="count" yLabel="Deals" horizontal />
          ) : (
            <p className="text-sm text-muted-foreground">No live deals yet.</p>
          )}
        </ChartCard>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-xl">By Producer</h2>
          <p className="text-xs text-muted-foreground">Fell-through deals are excluded. Click a rep to see only their deals.</p>
        </div>
        <div className="overflow-x-auto px-4 py-3">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="pb-2 pr-4 font-medium">Producer</th>
                <th className="pb-2 pr-4 font-medium">Deals</th>
                <th className="pb-2 pr-4 font-medium">Total</th>
                <th className="pb-2 pr-4 font-medium">Completed</th>
                <th className="pb-2 font-medium">Open $</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCERS.map((p) => {
                const mine = live.filter((d) => sameRep(d.producer, p));

                const c = mine.filter((d) => d.completion === "complete");
                const o = mine.filter((d) => d.completion !== "complete");
                return (
                  <tr key={p} className="border-t border-border">
                    <td className="py-2 pr-4">
                      <RepLink name={p} onPick={setRepPanel} className="font-medium">
                        {formatRep(p)}
                      </RepLink>
                    </td>
                    <td className="tabular py-2 pr-4">{mine.length}</td>
                    <td className="tabular py-2 pr-4">{money(sum(mine))}</td>
                    <td className="tabular py-2 pr-4">
                      {c.length} · {money(sum(c))}
                    </td>
                    <td className="tabular py-2">{money(sum(o))}</td>
                  </tr>
                );
              })}
              {unlisted.length ? (
                <tr className="border-t border-border text-muted-foreground">
                  <td className="py-2 pr-4">No rep assigned</td>
                  <td className="tabular py-2 pr-4">{unlisted.length}</td>
                  <td className="tabular py-2 pr-4">{money(sum(unlisted))}</td>
                  <td className="tabular py-2 pr-4">
                    {unlisted.filter((d) => d.completion === "complete").length} ·{" "}
                    {money(sum(unlisted.filter((d) => d.completion === "complete")))}
                  </td>
                  <td className="tabular py-2">
                    {money(sum(unlisted.filter((d) => d.completion !== "complete")))}
                  </td>
                </tr>
              ) : null}
              <tr className="border-t border-border font-medium">
                <td className="py-2 pr-4">TOTAL</td>
                <td className="tabular py-2 pr-4">{live.length}</td>
                <td className="tabular py-2 pr-4">{money(sum(live))}</td>
                <td className="tabular py-2 pr-4">
                  {completed.length} · {money(sum(completed))}
                </td>
                <td className="tabular py-2">{money(sum(active))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-9 w-56 shrink-0" aria-label="Filter deals" />
        <Chip active={view === "gto"} onClick={() => setView("gto")}>
          Good to order ({gtoN})
        </Chip>
        <Chip active={view === "ordered"} onClick={() => setView("ordered")}>
          Ordered ({orderedN})
        </Chip>
        <Chip active={view === "open"} onClick={() => setView("open")}>
          Open ({active.length})
        </Chip>
        <Chip active={view === "complete"} onClick={() => setView("complete")}>
          Complete ({completed.length})
        </Chip>
        <Chip active={view === "all"} onClick={() => setView("all")}>
          All deals
        </Chip>
        <RepFilter value={repFilter} onChange={setRepFilter} extraNames={all.map((d) => d.producer)} className="h-9 w-44 shrink-0" />
        <SortSelect value={sort} onChange={setSort} options={SORT_DEALS} className="shrink-0" />

      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((d) => (
          <DealRow key={d.id} deal={d} onOpen={() => setSelected(d.id)} onRep={setRepPanel} />
        ))}
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            {view === "gto"
              ? "No deals waiting on Good to order. Reps mark step 1; confirmed Ordered deals leave this list."
              : view === "ordered"
                ? "No open deals confirmed as Ordered."
                : "No deals in this view."}
          </p>
        ) : null}
      </div>

      <RepDealsPanel
        rep={repPanel}
        deals={all}
        onClose={() => setRepPanel(null)}
        onOpenDeal={(id) => {
          setRepPanel(null);
          setSelected(id);
        }}
      />
      <DealSheet deal={selectedRow} onClose={() => setSelected(null)} />
      <SimpleCreateDialog
        title="New Deal"
        open={create}
        onOpenChange={setCreate}
        fields={[
          { name: "customer", label: "Customer", required: true, kind: "customer" },
          { name: "producer", label: "Rep", kind: "rep" },
          { name: "equipment", label: "Equipment", kind: "equipment" },
          { name: "amount", label: "Equipment Package Amount ($)" },
        ]}
        onSubmit={async (v) => {
          const amountRaw = v.amount?.replace(/[$,]/g, "").trim();
          const amountNum = amountRaw ? Number(amountRaw) : undefined;
          const row = await createDeal({
            data: {
              customer: v.customer,
              producer: v.producer || undefined,
              equipment: v.equipment || undefined,
              amount: amountNum != null && Number.isFinite(amountNum) ? amountNum : undefined,
            },
          });
          void qc.invalidateQueries({ queryKey: ["deals"] });
          void qc.invalidateQueries({ queryKey: ["dashboard"] });
          toast.success("Deal added");
          setSelected(row.id);
        }}
      />
    </div>
  );
}

function DealRow({ deal: d, onOpen, onRep }: { deal: Deal; onOpen: () => void; onRep: (rep: string) => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => archiveDeal({ data: { id: d.id } }),
    onSuccess: () => {
      toast.success(`Removed ${d.customer} from the list`);
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
    },
    onError: (e) => {
      console.error("archiveDeal failed", e);
      toast.error(e instanceof Error ? e.message : "Could not remove");
    },
  });
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/60 md:px-4">
      {/* A div, not a button, so the rep name inside can be its own control. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="grid min-w-0 flex-1 cursor-pointer gap-1 py-1 text-left md:grid-cols-[1.4fr_7rem_7rem_8rem] md:items-center"
      >
        <span>
          <span className="font-medium">{d.customer}</span>
          <AkBadge on={d.aviKatz} className="ml-1.5 align-middle" />
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {d.producer && !d.noRep ? <RepLink name={d.producer} onPick={onRep} /> : <NoRepFlag show />} ·{" "}
            {d.equipment || "No equipment listed"}
          </span>

        </span>
        <span className="tabular text-sm font-medium">{money(d.amount)}</span>
        <StatusBadge status={completionLabel(d)} />
        <span className="text-xs text-muted-foreground">
          {d.ordered
            ? "Step 2 · Ordered"
            : d.goodToOrder
              ? "Step 1 · Good to order"
              : "Needs good to order"}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        aria-label={`Remove ${d.customer} from the list`}
        data-testid="archive-row"
        disabled={remove.isPending}
        onClick={() => {
          if (window.confirm(`Remove “${d.customer}” from the pipeline list?`)) remove.mutate();
        }}
      >
        <Trash2 className="size-3.5" />
        <span className="hidden sm:inline">Remove</span>
      </Button>
    </div>
  );
}
