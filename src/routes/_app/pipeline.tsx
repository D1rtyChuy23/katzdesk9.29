import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createDeal, listDeals } from "@/lib/ops/api";
import { money } from "@/lib/ops/clock";
import { PRODUCERS } from "@/lib/ops/lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/desk/flag-badge";
import { DealSheet, SimpleCreateDialog } from "@/components/desk/entity-sheets";
import { ChartCard, SimpleBars, StackedMoneyBars, StatCard } from "@/components/desk/desk-charts";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_DEALS, equipmentCount, sortDesk } from "@/lib/ops/sort";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Deal } from "@/lib/ops/types";

export const Route = createFileRoute("/_app/pipeline")({
  validateSearch: parseOpenSearch,
  component: Page,
});

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

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["deals"], queryFn: () => listDeals() });
  const [q, setQ] = useState("");
  const [view, setView] = useState<"open" | "complete" | "all">("open");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort("pipeline", "value-desc");

  const all = data.data ?? [];
  const live = all.filter((d) => d.completion !== "fell");
  const active = live.filter((d) => d.completion !== "complete");
  const completed = live.filter((d) => d.completion === "complete");
  const fell = all.filter((d) => d.completion === "fell");
  const listed = new Set<string>(PRODUCERS);
  const unlisted = live.filter((d) => !d.producer || !listed.has(d.producer));

  const producerChart = PRODUCERS.map((p) => {
    const mine = live.filter((d) => d.producer === p);
    return {
      producer: p,
      open: Math.round(sum(mine.filter((d) => d.completion !== "complete"))),
      done: Math.round(sum(mine.filter((d) => d.completion === "complete"))),
    };
  }).filter((p) => p.open + p.done > 0);

  const funnel = [
    { stage: "Open", count: active.length },
    { stage: "Good to order", count: active.filter((d) => d.goodToOrder).length },
    { stage: "Ordered", count: active.filter((d) => d.ordered).length },
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
  }, [all, q, view, sort]);

  const selectedRow = all.find((d) => d.id === selected) ?? null;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Sales pipeline</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One row per equipment deal. Charts show who is carrying the book and how far deals have moved.
          </p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus className="size-4" />
          New deal
        </Button>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active deals" value={active.length} />
        <StatCard label="Active pipeline" value={money(sum(active))} />
        <StatCard label="Completed" value={completed.length} hint={money(sum(completed))} />
        <StatCard label="Total booked" value={money(sum(live))} />
        <StatCard label="Good to order" value={active.filter((d) => d.goodToOrder).length} hint="Open deals cleared to order" />
        <StatCard
          label="Fell through"
          value={fell.length}
          tone={fell.length ? "danger" : undefined}
        />
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="By producer" lede="Open dollars stacked under completed. Fell-through deals are left out.">
          {producerChart.length ? (
            <StackedMoneyBars data={producerChart} xKey="producer" openKey="open" doneKey="done" />
          ) : (
            <p className="text-sm text-muted-foreground">No live deals yet.</p>
          )}
        </ChartCard>
        <ChartCard title="How deals move" lede="Same open book, four gates. A deal can sit in more than one bar.">
          <SimpleBars data={funnel} xKey="stage" yKey="count" yLabel="Deals" horizontal />
        </ChartCard>
        <ChartCard title="Deal size" lede="Live book by amount, so a few large jobs don’t hide the rest.">
          {sizeChart.length ? (
            <SimpleBars data={sizeChart} xKey="size" yKey="count" yLabel="Deals" horizontal />
          ) : (
            <p className="text-sm text-muted-foreground">No live deals yet.</p>
          )}
        </ChartCard>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-display text-xl">By producer</h2>
          <p className="text-xs text-muted-foreground">Fell-through deals are excluded, matching the old dashboard.</p>
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
                const mine = live.filter((d) => d.producer === p);
                const c = mine.filter((d) => d.completion === "complete");
                const o = mine.filter((d) => d.completion !== "complete");
                return (
                  <tr key={p} className="border-t border-border">
                    <td className="py-2 pr-4">{p}</td>
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
                  <td className="py-2 pr-4">(No producer / not on list)</td>
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

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("open")}
          className={`h-9 rounded-full px-3 text-sm font-medium ${view === "open" ? "bg-ink text-ink-foreground" : "bg-secondary"}`}
        >
          Open ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setView("complete")}
          className={`h-9 rounded-full px-3 text-sm font-medium ${view === "complete" ? "bg-ink text-ink-foreground" : "bg-secondary"}`}
        >
          Complete ({completed.length})
        </button>
        <button
          type="button"
          onClick={() => setView("all")}
          className={`h-9 rounded-full px-3 text-sm font-medium ${view === "all" ? "bg-ink text-ink-foreground" : "bg-secondary"}`}
        >
          All deals
        </button>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="max-w-xs" />
        <SortSelect value={sort} onChange={setSort} options={SORT_DEALS} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelected(d.id)}
            className="grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_7rem_7rem_8rem] md:items-center"
          >
            <span>
              <span className="font-medium">{d.customer}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {d.producer ?? "Unassigned"} · {d.equipment || "No equipment listed"}
              </span>
            </span>
            <span className="tabular text-sm font-medium">{money(d.amount)}</span>
            <StatusBadge status={completionLabel(d)} />
            <span className="text-xs text-muted-foreground">
              {d.goodToOrder ? "Good to order" : "Needs approval"}
              {d.ordered ? " · Ordered" : ""}
            </span>
          </button>
        ))}
        {rows.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">No deals in this view.</p> : null}
      </div>

      <DealSheet deal={selectedRow} onClose={() => setSelected(null)} />
      <SimpleCreateDialog
        title="New deal"
        open={create}
        onOpenChange={setCreate}
        fields={[
          { name: "customer", label: "Customer", required: true, kind: "customer" },
          { name: "producer", label: "Producer" },
          { name: "equipment", label: "Equipment", kind: "equipment" },
          { name: "amount", label: "Deal amount ($)" },
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
