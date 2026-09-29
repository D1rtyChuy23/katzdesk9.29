import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAssets } from "@/lib/ops/api";
import { SITE_LABEL, isBarn } from "@/lib/ops/warehouse";
import {
  CUSTOMER_SITES,
  HOUSE_LOBBY,
  HOUSE_OTHER,
  HOUSE_STAGING,
  HOUSE_TRAINING,
  lastMoveLine,
  unitPlaceLabel,
} from "@/lib/ops/unit-place-rules";
import {
  addUnitToLocation,
  electricalFrom,
  listBarnAvailable,
  placeAssetsAtLocation,
  setAssetPlace,
} from "@/lib/ops/unit-place";
import { PlacePicker, emptyPlaceDraft, type PlaceDraft } from "@/components/desk/unit-place-field";
import { placeDraftError } from "@/lib/ops/unit-place-rules";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import type { Asset } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { StatusBadge } from "@/components/desk/flag-badge";
import { AssetSheet } from "@/components/desk/asset-sheet";
import { StockActions } from "@/components/desk/stock-actions";
import { getMyAccess } from "@/lib/ops/access";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, SORT_EQUIP, SORT_STATUS, sortDesk } from "@/lib/ops/sort";
import { ChartCard, FilterChip, SimpleBars, StatCard, StatRow, toggleChip } from "@/components/desk/desk-charts";
import { EquipmentCombo } from "@/components/desk/directory-fields";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/locations")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const canStock = !!me.data?.isAdmin || me.data?.role === "warehouse";
  const [tab, setTab] = useState<"deployed" | "field" | "sold" | "all">("deployed");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useOpenRecord(open);
  const [panel, setPanel] = useState<null | { site: string; mode: "barn" | "list" }>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveDraft, setMoveDraft] = useState<PlaceDraft>(emptyPlaceDraft());
  const [sort, setSort] = useDeskSort("locations", "alpha-asc");

  const all = data.data ?? [];
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const match = (a: Asset) => {
      if (!needle) return true;
      const place = unitPlaceLabel({ site: a.site, pallet: a.pallet, level: a.level, status: a.status, soldTo: a.soldTo, purpose: a.purpose });
      return [a.model, a.serial, a.purpose, a.soldTo, place, SITE_LABEL[a.site]].filter(Boolean).some((v) =>
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
    const deployed = all.filter((a) => a.status === "deployed");
    const otherLabels = [...new Set(deployed.filter((a) => a.site === HOUSE_OTHER).map((a) => (a.purpose ?? "").trim() || "Other"))].sort();
    const bases = [
      { key: "training", site: HOUSE_TRAINING, label: "Training", otherLabel: null as string | null },
      { key: "lobby", site: HOUSE_LOBBY, label: "Lobby", otherLabel: null as string | null },
      { key: "staging", site: HOUSE_STAGING, label: "Staging area", otherLabel: null as string | null },
      ...otherLabels.map((label) => ({ key: `other:${label}`, site: HOUSE_OTHER, label, otherLabel: label })),
      ...CUSTOMER_SITES.map((site) => ({ key: site, site, label: SITE_LABEL[site] ?? site, otherLabel: null as string | null })),
    ];
    const placed = bases.map((b) => ({
      ...b,
      rows: sortRows(
        deployed.filter(
          (a) => a.site === b.site && (b.otherLabel == null || ((a.purpose ?? "").trim() || "Other") === b.otherLabel) && match(a),
        ),
      ),
    }));
    if (tab === "sold") return [{ key: "sold", site: "sold", label: SITE_LABEL.sold ?? "Sold", otherLabel: null, rows: sortRows(all.filter((a) => a.status === "sold" && match(a))) }];
    if (tab === "field") return [{ key: "field", site: "field", label: SITE_LABEL.field ?? "Pulled", otherLabel: null, rows: sortRows(all.filter((a) => a.status === "assigned" && match(a))) }];
    if (tab === "all") {
      return [
        ...placed,
        { key: "field", site: "field", label: SITE_LABEL.field ?? "Pulled", otherLabel: null, rows: sortRows(all.filter((a) => a.status === "assigned" && match(a))) },
        { key: "sold", site: "sold", label: SITE_LABEL.sold ?? "Sold", otherLabel: null, rows: sortRows(all.filter((a) => a.status === "sold" && match(a))) },
      ];
    }
    return placed;
  }, [all, tab, needle, sort]);

  const selectedRow = all.find((a) => a.id === selected) ?? null;
  const deployedCount = all.filter((a) => a.status === "deployed").length;
  const fieldCount = all.filter((a) => a.status === "assigned").length;
  const soldCount = all.filter((a) => a.status === "sold").length;
  const bySite = [
    { name: "Training", count: all.filter((a) => a.status === "deployed" && a.site === HOUSE_TRAINING).length },
    { name: "Lobby", count: all.filter((a) => a.status === "deployed" && a.site === HOUSE_LOBBY).length },
    { name: "Staging area", count: all.filter((a) => a.status === "deployed" && a.site === HOUSE_STAGING).length },
    ...CUSTOMER_SITES.map((site) => ({
      name: SITE_LABEL[site] ?? site,
      count: all.filter((a) => a.status === "deployed" && a.site === site).length,
    })),
  ];

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Equipment by location</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Units at a site, not on a barn bay. Add from the barn, or add a unit that is not in the barn. Moving back asks for a bay first.
          </p>
        </div>
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

      <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter…"
          className="h-9 w-56 shrink-0"
          aria-label="Filter equipment"
        />
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
        <SortSelect value={sort} onChange={setSort} options={[...SORT_ALPHA, ...SORT_DATE, ...SORT_EQUIP, ...SORT_STATUS]} className="shrink-0" />
      </div>

      <div className="mt-5 space-y-6">
        {groups.map((g) => (
          <section key={g.key}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl">{g.label}</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{g.rows.reduce((n, a) => n + a.qty, 0)} units</p>
                {g.site !== "field" && g.site !== "sold" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={panel?.site === g.key && panel.mode === "barn" ? "default" : "outline"}
                      data-testid={
                        g.key === "training"
                          ? "add-from-barn-training"
                          : g.key === "lobby"
                            ? "add-from-barn-lobby"
                            : g.key === "staging"
                              ? "add-from-barn-staging"
                              : undefined
                      }
                      onClick={() =>
                        setPanel((cur) => (cur?.site === g.key && cur.mode === "barn" ? null : { site: g.key, mode: "barn" }))
                      }
                    >
                      Add from barn
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={panel?.site === g.key && panel.mode === "list" ? "default" : "outline"}
                      onClick={() =>
                        setPanel((cur) => (cur?.site === g.key && cur.mode === "list" ? null : { site: g.key, mode: "list" }))
                      }
                    >
                      Add to list
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {panel?.site === g.key ? (
              panel.mode === "barn" ? (
                <BarnPick site={g.site} otherLabel={g.otherLabel} onDone={() => setPanel(null)} />
              ) : (
                <ListAdd site={g.site} otherLabel={g.otherLabel} onDone={() => setPanel(null)} />
              )
            ) : null}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {g.rows.map((a) => {
                const electrical = electricalFrom(a.notes) || electricalFrom(a.purpose);
                const moved = lastMoveLine(a.notes);
                const onSite = a.status === "deployed" && !isBarn(a.site);
                return (
                  <div
                    key={a.id}
                    className="grid gap-2 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1.4fr_1fr_auto] md:items-center"
                  >
                    <button type="button" onClick={() => setSelected(a.id)} className="text-left">
                      <span className="font-medium">{a.model}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {[a.serial ? `SN ${a.serial}` : "No serial", electrical, unitPlaceLabel({ site: a.site, pallet: a.pallet, level: a.level, status: a.status, soldTo: a.soldTo, purpose: a.purpose })].filter(Boolean).join(" · ")}
                        {a.qty > 1 ? ` · qty ${a.qty}` : ""}
                      </span>
                      {moved ? <span className="mt-0.5 block text-xs text-muted-foreground">{moved}</span> : null}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {a.purpose ?? a.soldTo ?? "—"}
                      {a.soldAt ? ` · ${a.soldAt}` : ""}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={
                          a.site === HOUSE_STAGING
                            ? "Staging"
                            : a.status === "sold"
                              ? "Sold"
                              : a.status === "assigned"
                                ? a.installId
                                  ? "On an install"
                                  : "On service"
                                : "In use"
                        }
                      />
                      {onSite && !a.stockHold ? (
                        movingId === a.id ? (
                          <span className="flex flex-wrap items-end gap-2">
                            <PlacePicker value={moveDraft} onChange={setMoveDraft} testId="location-move" />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!!placeDraftError(moveDraft)}
                              onClick={async () => {
                                const err = placeDraftError(moveDraft);
                                if (err) {
                                  toast.error(err);
                                  return;
                                }
                                try {
                                  const place = await setAssetPlace({
                                    data: {
                                      id: a.id,
                                      site: moveDraft.site,
                                      pallet: moveDraft.pallet || null,
                                      level: moveDraft.level ? Number(moveDraft.level) : null,
                                      otherLabel: moveDraft.otherLabel || null,
                                    },
                                  });
                                  toast.success(place.place ? `Now at ${place.place}` : "Moved");
                                  setMovingId(null);
                                  void qc.invalidateQueries({ queryKey: ["assets"] });
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Could not move");
                                }
                              }}
                            >
                              Confirm
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setMovingId(null)}>
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMoveDraft(emptyPlaceDraft());
                              setMovingId(a.id);
                            }}
                          >
                            Move
                          </Button>
                        )
                      ) : null}
                      {(a.site === HOUSE_STAGING || a.site === HOUSE_TRAINING || a.site === HOUSE_LOBBY) && (canStock || a.stockHold) ? (
                        <StockActions asset={a} canStock={canStock} isAdmin={!!me.data?.isAdmin} />
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {g.rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Nothing logged here.</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <AssetSheet asset={selectedRow} onClose={() => setSelected(null)} />
    </div>
  );
}

function BarnPick({ site, otherLabel, onDone }: { site: string; otherLabel: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["barn-available"], queryFn: () => listBarnAvailable() });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const needle = q.trim().toLowerCase();
  const rows = (data.data ?? []).filter((a) =>
    [a.model, a.serial, a.place].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)),
  );
  return (
    <div className="mb-3 rounded-xl border border-border bg-card p-3" data-testid="barn-pick">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search model, serial, or name" />
      <ul className="mt-2 max-h-52 overflow-y-auto">
        {rows.map((a) => (
          <li key={a.id}>
            <label className="flex items-center gap-2 px-1 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={picked.includes(a.id)}
                onChange={(e) =>
                  setPicked((cur) => (e.target.checked ? [...cur, a.id] : cur.filter((id) => id !== a.id)))
                }
              />
              <span className="min-w-0 flex-1">
                {a.model}
                <span className="text-muted-foreground">
                  {" "}
                  · {[a.serial ? `SN ${a.serial}` : "No serial", a.place, a.electrical].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          </li>
        ))}
        {!rows.length ? <li className="px-1 py-2 text-sm text-muted-foreground">Nothing available in the barn.</li> : null}
      </ul>
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!picked.length}
          onClick={async () => {
            try {
              const res = await placeAssetsAtLocation({ data: { ids: picked, site, otherLabel } });
              toast.success(res.moved === 1 ? "Added from the barn" : `Added ${res.moved} from the barn`);
              void qc.invalidateQueries({ queryKey: ["assets"] });
              void qc.invalidateQueries({ queryKey: ["barn-available"] });
              onDone();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add");
            }
          }}
        >
          Add selected
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ListAdd({ site, otherLabel, onDone }: { site: string; otherLabel: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [electrical, setElectrical] = useState("");
  return (
    <form
      className="mb-3 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-2"
      data-testid="location-add-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!model.trim()) {
          toast.error("Pick a model");
          return;
        }
        try {
          const res = await addUnitToLocation({
            data: { site, model, serial: serial || null, electrical: electrical || null, otherLabel },
          });
          toast.success(res.pulled ? "Pulled from the barn onto this location" : "Added to this location");
          void qc.invalidateQueries({ queryKey: ["assets"] });
          void qc.invalidateQueries({ queryKey: ["barn-available"] });
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not add");
        }
      }}
    >
      <EquipmentCombo label="Model" value={model} onChange={setModel} menuInFlow required />
      <div>
        <Label htmlFor={`loc-sn-${site}`}>Serial</Label>
        <Input id={`loc-sn-${site}`} className="mt-1" value={serial} onChange={(e) => setSerial(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`loc-el-${site}`}>Electrical</Label>
        <Input
          id={`loc-el-${site}`}
          className="mt-1"
          value={electrical}
          onChange={(e) => setElectrical(e.target.value)}
          placeholder="120V or 220V"
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">
          Add
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
