import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createAsset, listAssets } from "@/lib/ops/api";
import { LOCATION_SITES, SITE_LABEL, SITE_PURPOSE } from "@/lib/ops/warehouse";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import type { Asset } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/desk/flag-badge";
import { AssetSheet } from "@/components/desk/asset-sheet";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, SORT_EQUIP, SORT_STATUS, sortDesk } from "@/lib/ops/sort";
import { ChartCard, FilterChip, SimpleBars, StatCard, StatRow, toggleChip } from "@/components/desk/desk-charts";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/locations")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const [tab, setTab] = useState<"deployed" | "field" | "sold" | "all">("deployed");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort("locations", "alpha-asc");

  const all = data.data ?? [];
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const match = (a: Asset) => {
      if (!needle) return true;
      return [a.model, a.serial, a.purpose, a.soldTo, SITE_LABEL[a.site]].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(needle),
      );
    };
    const sortRows = (rows: Asset[]) =>
      sortDesk(rows, sort, {
        name: (a) => a.model,
        equipment: (a) => a.qty ?? 1,
        status: (a) => a.status,
        date: (a) => a.soldAt ?? a.updatedAt,
      });
    if (tab === "all") {
      return [
        ...LOCATION_SITES.map((site) => ({
          site,
          rows: sortRows(all.filter((a) => a.site === site && a.status === "deployed" && match(a))),
        })),
        { site: "field", rows: sortRows(all.filter((a) => a.status === "assigned" && match(a))) },
        { site: "sold", rows: sortRows(all.filter((a) => a.status === "sold" && match(a))) },
      ];
    }
    if (tab === "sold") return [{ site: "sold", rows: sortRows(all.filter((a) => a.status === "sold" && match(a))) }];
    if (tab === "field") return [{ site: "field", rows: sortRows(all.filter((a) => a.status === "assigned" && match(a))) }];
    return LOCATION_SITES.map((site) => ({
      site,
      rows: sortRows(all.filter((a) => a.site === site && a.status === "deployed" && match(a))),
    }));
  }, [all, tab, needle, sort]);

  const selectedRow = all.find((a) => a.id === selected) ?? null;
  const deployedCount = all.filter((a) => a.status === "deployed").length;
  const fieldCount = all.filter((a) => a.status === "assigned").length;
  const soldCount = all.filter((a) => a.status === "sold").length;
  const bySite = LOCATION_SITES.map((site) => ({
    name: SITE_LABEL[site] ?? site,
    count: all.filter((a) => a.status === "deployed" && a.site === site).length,
  }));

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Equipment by location</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Units not on the barn racks — lobby, service room, training, SATX, and anything currently pulled for an install or a service call. Return a unit to free the slot for the next job.
          </p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus className="size-4" />
          Log at a location
        </Button>
      </header>

      <StatRow>
        <StatCard
          label="On site"
          value={deployedCount}
          selected={tab === "deployed"}
          onClick={() => setTab((t) => toggleChip(t, "deployed", "all"))}
        />
        <StatCard
          label="On an install"
          value={fieldCount}
          selected={tab === "field"}
          onClick={() => setTab((t) => toggleChip(t, "field", "all"))}
        />
        <StatCard
          label="Sold"
          value={soldCount}
          selected={tab === "sold"}
          onClick={() => setTab((t) => toggleChip(t, "sold", "all"))}
        />
      </StatRow>
      {bySite.length ? (
        <section className="mt-5">
          <ChartCard title="Deployed by location" lede="Units sitting at HQ rooms and SATX — not the barn racks.">
            <SimpleBars
              data={bySite.map((s) => ({ site: s.name, count: s.count }))}
              xKey="site"
              yKey="count"
              yLabel="Units"
              horizontal
            />
          </ChartCard>
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ["deployed", `On site (${deployedCount})`],
            ["field", `Pulled (${fieldCount})`],
            ["sold", `Sold (${soldCount})`],
          ] as const
        ).map(([id, label]) => (
          <FilterChip key={id} selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </FilterChip>
        ))}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="max-w-xs" />
        <SortSelect value={sort} onChange={setSort} options={[...SORT_ALPHA, ...SORT_DATE, ...SORT_EQUIP, ...SORT_STATUS]} />
      </div>

      <div className="mt-5 space-y-6">
        {groups.map((g) => (
          <section key={g.site}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-xl">{SITE_LABEL[g.site] ?? g.site}</h2>
              <p className="text-xs text-muted-foreground">{g.rows.reduce((n, a) => n + a.qty, 0)} units</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {g.rows.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[1.4fr_1fr_8rem] md:items-center"
                >
                  <span>
                    <span className="font-medium">{a.model}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {a.serial ?? "No serial"}
                      {a.qty > 1 ? ` · qty ${a.qty}` : ""}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {a.purpose ?? a.soldTo ?? "—"}
                    {a.soldAt ? ` · ${a.soldAt}` : ""}
                  </span>
                  <StatusBadge
                    status={
                      a.status === "sold"
                        ? "Sold"
                        : a.status === "assigned"
                          ? a.installId
                            ? "On an install"
                            : "On service"
                          : "In use"
                    }
                  />
                </button>
              ))}
              {g.rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Nothing logged here.</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <AssetSheet asset={selectedRow} onClose={() => setSelected(null)} />
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent>
          <DialogTitle>Log equipment at a location</DialogTitle>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                const row = await createAsset({
                  data: {
                    model: String(fd.get("model")),
                    serial: String(fd.get("serial") || "") || null,
                    site: String(fd.get("site")),
                    purpose: String(fd.get("purpose") || "") || SITE_PURPOSE[String(fd.get("site"))] || null,
                  },
                });
                void qc.invalidateQueries({ queryKey: ["assets"] });
                toast.success("Logged");
                setCreate(false);
                setSelected(row.id);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <div>
              <Label>Location</Label>
              <SelectField name="site" className="mt-1" defaultValue="front-lobby">
                {LOCATION_SITES.map((s) => (
                  <option key={s} value={s}>
                    {SITE_LABEL[s]}
                  </option>
                ))}
              </SelectField>
            </div>
            <div>
              <Label>Model</Label>
              <Input name="model" className="mt-1" required />
            </div>
            <div>
              <Label>Serial</Label>
              <Input name="serial" className="mt-1" />
            </div>
            <div>
              <Label>Purpose</Label>
              <Input name="purpose" className="mt-1" placeholder="Showroom, training, loaner…" />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Add</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
