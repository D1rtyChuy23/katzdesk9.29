import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createAsset, listAssets } from "@/lib/ops/api";
import { getMyAccess } from "@/lib/ops/access";
import { addToRackSlot, setShopTest } from "@/lib/ops/rack-stock";
import { addUnitToLocation, setAssetPlace, setUnitPlace } from "@/lib/ops/unit-place";
import { placeDraftError, unitPlaceLabel } from "@/lib/ops/unit-place-rules";
import {
  BACK_EQUIP_CAPACITY,
  BACK_PALLETS,
  BARN_EQUIP_CAPACITY,
  FRONT_CAPACITY,
  FRONT_PALLETS,
  LEVELS,
  bayFor,
  slotId,
} from "@/lib/ops/warehouse";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import type { Asset } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/desk/flag-badge";
import { AssetSheet } from "@/components/desk/asset-sheet";
import { StockActions } from "@/components/desk/stock-actions";
import { PlacePicker, emptyPlaceDraft, type PlaceDraft } from "@/components/desk/unit-place-field";
import { CustomerCombo, EquipmentCombo } from "@/components/desk/directory-fields";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, SORT_EQUIP, SORT_STATUS, sortDesk } from "@/lib/ops/sort";
import { ChartCard, FilterChip, SimpleBars, StatCard, StatRow, toggleChip } from "@/components/desk/desk-charts";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/warehouse")({
  validateSearch: parseOpenSearch,
  component: Page,
});

type Rack = "barn-back" | "barn-front";
type SlotKey = { rack: Rack; pallet: string; level: number };

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["assets"], queryFn: () => listAssets() });
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const canStock = !!me.data?.isAdmin || me.data?.role === "warehouse";
  const [rack, setRack] = useState<Rack>("barn-back");
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<SlotKey | null>(null);
  const [selected, setSelected] = useOpenRecord(open);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveDraft, setMoveDraft] = useState<PlaceDraft>(emptyPlaceDraft());
  const [moveBlock, setMoveBlock] = useState<string | null>(null);
  const [swapWith, setSwapWith] = useState("");
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort("warehouse", "alpha-asc");
  const [bubble, setBubble] = useState<"ready" | "fill" | "dispensers" | "missing" | "needs-bay" | "needs-test" | "tested" | "review" | null>(null);
  const [bayLetter, setBayLetter] = useState<string | null>(null);

  const all = data.data ?? [];
  const barn = useMemo(
    () => all.filter((a) => a.status === "ready" && (a.site === "barn-back" || a.site === "barn-front")),
    [all],
  );
  const onRack = barn.filter((a) => a.site === rack);
  const pallets = rack === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;

  const bySlot = useMemo(() => {
    const map = new Map<string, Asset[]>();
    for (const a of onRack) {
      if (!a.pallet || !a.level) continue;
      const k = `${String(a.pallet).toUpperCase()}-${a.level}`;
      const list = map.get(k) ?? [];
      list.push(a);
      map.set(k, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.lineNo ?? 99) - (b.lineNo ?? 99) || a.id - b.id);
    return map;
  }, [onRack]);

  const slotUnits = useMemo(() => {
    if (!slot || slot.rack !== rack) return [];
    return bySlot.get(`${slot.pallet}-${slot.level}`) ?? [];
  }, [bySlot, slot, rack]);

  const needle = q.trim().toLowerCase();
  const stranded = useMemo(() => barn.filter((a) => a.needsBay), [barn]);
  const list = useMemo(() => {
    let rows = slot
      ? slotUnits
      : onRack.filter((a) => a.kind === "equip" || a.kind === "dispenser");
    if (!slot) {
      const ids = new Set(rows.map((a) => a.id));
      for (const a of stranded) {
        if (!ids.has(a.id)) rows = [...rows, a];
      }
    }
    if (bubble === "dispensers") rows = rows.filter((a) => a.kind === "dispenser");
    if (bubble === "missing") rows = rows.filter((a) => a.missingSerial);
    if (bubble === "needs-bay") rows = stranded;
    if (bubble === "needs-test") rows = rows.filter((a) => a.shopTest === "needs-test");
    if (bubble === "tested") rows = rows.filter((a) => a.shopTest === "tested");
    if (bubble === "review") rows = rows.filter((a) => a.reviewStatus === "pending");
    if (bubble === "ready") rows = rows.filter((a) => a.kind === "equip" && a.status === "ready");
    if (bayLetter) {
      rows = barn.filter((a) => (a.pallet ?? "").toUpperCase() === bayLetter);
    }
    if (needle) {
      rows = barn.filter((a) =>
        [a.model, a.serial, a.slotLabel, a.customerOwned, a.pallet].filter(Boolean).some((v) =>
          String(v).toLowerCase().includes(needle),
        ),
      );
    }
    return sortDesk(rows, sort, {
      name: (a) => a.model,
      equipment: (a) => a.qty ?? 1,
      status: (a) => a.status,
      date: (a) => a.updatedAt,
    });
  }, [slot, slotUnits, onRack, barn, needle, sort, bubble, bayLetter, stranded, rack]);

  const equipReady = barn.filter((a) => a.kind === "equip").reduce((n, a) => n + a.qty, 0);
  const equipLines = barn.filter((a) => a.kind === "equip").length;
  const dispQty = barn.filter((a) => a.kind === "dispenser").reduce((n, a) => n + a.qty, 0);
  const missing = barn.filter((a) => a.missingSerial).length;
  const owned = barn.filter((a) => a.customerOwned).length;
  const models = new Set(barn.filter((a) => a.kind === "equip").map((a) => a.model)).size;
  const catering = barn.filter((a) => a.bay === "catering" && a.kind === "equip").length;
  const selectedRow = all.find((a) => a.id === selected) ?? null;
  const capacity = rack === "barn-front" ? FRONT_CAPACITY : BACK_EQUIP_CAPACITY;
  const readyByModel = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of barn) {
      if (a.kind !== "equip") continue;
      map.set(a.model, (map.get(a.model) ?? 0) + a.qty);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [barn]);

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Barn warehouse</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Ready-to-deploy units at HQ. Slot ID is pallet + level — A-L3 is pallet A, third shelf. Pull a unit for an install or a service account and it leaves this board. Bays run A through P.
          </p>
        </div>
        {canStock ? (
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            Add to rack
          </Button>
        ) : null}
      </header>

      <StatRow>
        <StatCard
          label="Ready"
          value={equipReady}
          hint={`${models} models · ${Math.max(0, BARN_EQUIP_CAPACITY - equipLines)} open slots`}
          breakdown={readyByModel}
          selected={bubble === "ready" && !bayLetter}
          onClick={() => {
            setBayLetter(null);
            setSlot(null);
            setBubble((v) => toggleChip(v, "ready", null));
          }}
        />
        <StatCard
          label="Fill"
          value={`${Math.round((equipLines / BARN_EQUIP_CAPACITY) * 100)}%`}
          hint={`${equipLines} lines on the rack`}
          selected={bubble === "fill" && !bayLetter}
          onClick={() => {
            setBayLetter(null);
            setSlot(null);
            setBubble((v) => toggleChip(v, "fill", null));
          }}
        />
        <StatCard
          label="Dispensers"
          value={dispQty}
          hint="Not counted in Ready"
          selected={bubble === "dispensers" && !bayLetter}
          onClick={() => {
            setBayLetter(null);
            setSlot(null);
            setBubble((v) => toggleChip(v, "dispensers", null));
          }}
        />
        <StatCard
          label="Missing serial"
          value={missing}
          tone={missing ? "warn" : undefined}
          hint={`${owned} customer-owned · ${catering} catering`}
          selected={bubble === "missing" && !bayLetter}
          onClick={() => {
            setBayLetter(null);
            setSlot(null);
            setBubble((v) => toggleChip(v, "missing", null));
          }}
        />
        {stranded.length ? (
          <StatCard
            label="Needs bay"
            value={stranded.length}
            tone="warn"
            hint="Letter Q or after P — assign A–P"
            selected={bubble === "needs-bay"}
            onClick={() => {
              setBayLetter(null);
              setSlot(null);
              setBubble((v) => toggleChip(v, "needs-bay", null));
            }}
          />
        ) : null}
      </StatRow>

      {readyByModel.length ? (
        <section className="mt-5">
          <ChartCard title="Ready by model" lede="The Ready bubble, unpacked — qty on the rack, not line count.">
            <SimpleBars
              data={readyByModel.slice(0, 10).map((r) => ({ model: r.name, count: r.count }))}
              xKey="model"
              yKey="count"
              yLabel="Qty"
              horizontal
            />
          </ChartCard>
        </section>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find model or serial…"
          className="h-9 w-56 shrink-0"
          aria-label="Find model or serial"
        />
        <FilterChip
          selected={rack === "barn-back"}
          onClick={() => {
            setRack("barn-back");
            setSlot(null);
          }}
        >
          Back rack
        </FilterChip>
        <FilterChip
          selected={rack === "barn-front"}
          onClick={() => {
            setRack("barn-front");
            setSlot(null);
          }}
        >
          Front rack
        </FilterChip>
        <FilterChip
          selected={bubble === "needs-test"}
          onClick={() => setBubble((v) => toggleChip(v, "needs-test", null))}
        >
          Needs test
        </FilterChip>
        <FilterChip
          selected={bubble === "tested"}
          onClick={() => setBubble((v) => toggleChip(v, "tested", null))}
        >
          Tested
        </FilterChip>
        {canStock ? (
          <FilterChip
            selected={bubble === "review"}
            onClick={() => setBubble((v) => toggleChip(v, "review", null))}
          >
            Pending review
          </FilterChip>
        ) : null}
        <SortSelect value={sort} onChange={setSort} options={[...SORT_ALPHA, ...SORT_DATE, ...SORT_EQUIP, ...SORT_STATUS]} className="shrink-0" />
      </div>

      <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-catering" />Catering A–D</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-dispense" />Dispenser E–F</span>
        <span>Number in a cell is how many units share that section, up to 12. Add stays available when a section already has units. Capacity this rack: {capacity}.</span>
      </p>

      <div className="mt-3 w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card p-3">
        <table className="w-full min-w-[40rem] border-collapse text-center">
          <thead>
            <tr>
              <th className="pb-2 pr-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Level
              </th>
              {pallets.map((p) => {
                const bay = bayFor(rack, p);
                const picked = bayLetter === p;
                return (
                  <th
                    key={p}
                    className={cn(
                      "px-0.5 pb-2 text-[11px] font-medium",
                      bay === "catering" && "text-catering",
                      bay === "dispenser" && "text-dispense",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "inline-flex min-w-8 items-center justify-center rounded-full px-1.5 py-0.5",
                        picked && "bg-primary text-primary-foreground",
                      )}
                      onClick={() => setBayLetter((cur) => (cur === p ? null : p))}
                      aria-pressed={picked}
                    >
                      {p}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((level) => (
              <tr key={level}>
                <th className="py-1 pr-2 text-left text-xs font-medium text-muted-foreground">
                  L{level}
                  {level === 4 ? <span className="ml-1 font-normal">top</span> : null}
                  {level === 1 ? <span className="ml-1 font-normal">floor</span> : null}
                </th>
                {pallets.map((p) => {
                  const units = bySlot.get(`${p}-${level}`) ?? [];
                  const n = units.length;
                  const bay = bayFor(rack, p);
                  const active = slot?.pallet === p && slot.level === level && slot.rack === rack;
                  const names = units.map((u) => `${u.model}${u.serial ? ` ${u.serial}` : ""}`).join(", ");
                  return (
                    <td key={p} className="p-0.5 align-top">
                      <button
                        type="button"
                        onClick={() =>
                          setSlot(active ? null : { rack, pallet: p, level })
                        }
                        className={cn(
                          "flex w-full min-w-14 flex-col items-center justify-center gap-0.5 rounded-sm px-0.5 py-1 text-[10px] leading-tight transition-colors",
                          n === 0 ? "h-9" : "min-h-16",
                          n === 0 && "bg-muted text-muted-foreground",
                          n > 0 && n < 12 && "bg-primary/15 text-foreground",
                          n >= 12 && "bg-primary text-primary-foreground",
                          bay === "catering" && n === 0 && "bg-catering/15",
                          bay === "dispenser" && n === 0 && "bg-dispense/15",
                          active && "ring-2 ring-ring",
                        )}
                        data-testid={`slot-${p}-L${level}`}
                        title={n === 0 ? undefined : names}
                        aria-label={
                          n === 0
                            ? canStock
                              ? `Add to ${p}-L${level}`
                              : `${p}-L${level} empty`
                            : `${p}-L${level}, ${n} ${n === 1 ? "unit" : "units"}: ${names}.${canStock ? " Add another." : ""}`
                        }
                      >
                        {n === 0 ? (
                          canStock ? "Add" : "·"
                        ) : (
                          <>
                            <span className="text-xs font-medium tabular-nums">{n}</span>
                            {units.slice(0, 2).map((u) => (
                              <span key={u.id} className="max-w-full truncate">
                                {u.serial ?? u.model}
                              </span>
                            ))}
                            {n > 2 ? <span>+{n - 2}</span> : null}
                            {canStock ? <span>Add</span> : null}
                          </>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">
            {needle
              ? "Search"
              : slot
                ? `${slot.rack === "barn-front" ? "Front" : "Back"} · ${slotId(slot.pallet, slot.level)}`
                : rack === "barn-back"
                  ? "Back rack units"
                  : "Front rack units"}
          </h2>
          {slot && !needle ? (
            <p className="text-sm text-muted-foreground" data-testid="section-count">
              {slotUnits.length === 0
                ? "Empty section"
                : `${slotUnits.length} ${slotUnits.length === 1 ? "unit" : "units"} in this section`}
            </p>
          ) : null}
        </div>
        {slot ? (
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSlot(null)}>
            Clear slot
          </button>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card" data-testid={slot && !needle ? "section-units" : undefined}>
        {list.map((a) => (
          <div key={a.id} className="border-b border-border last:border-b-0">
            <div className="px-4 py-3" data-testid={a.serial ? `rack-row-${a.serial}` : undefined}>
              <div className="flex flex-wrap items-start gap-3">
              <button type="button" onClick={() => setSelected(a.id)} className="w-36 shrink-0 text-left font-mono text-xs">
                {a.pallet && a.level && (a.site === "barn-back" || a.site === "barn-front")
                  ? unitPlaceLabel({ site: a.site, pallet: a.pallet, level: a.level, status: a.status })
                  : a.slotLabel}
              </button>
              <button type="button" onClick={() => setSelected(a.id)} className="min-w-0 flex-1 text-left">
                <span className="font-medium">{a.model}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {a.serial ?? "No serial"}
                  {a.qty > 1 ? ` · qty ${a.qty}` : ""}
                  {a.customerOwned ? ` · ${a.customerOwned}` : ""}
                </span>
              </button>
              <span className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-36" data-testid="shop-col">
                <span className="flex flex-wrap gap-1">
                {a.needsBay ? <StatusBadge status="Needs bay" /> : null}
                {a.reviewStatus === "pending" ? <StatusBadge status="Pending review" /> : null}
                {a.shopTest === "tested" ? <StatusBadge status="Tested" /> : null}
                {a.shopTest === "needs-test" ? <StatusBadge status="Needs test" /> : null}
                {a.missingSerial ? <StatusBadge status="Serial missing" /> : null}
                {a.customerOwned ? <StatusBadge status="Customer-owned" /> : null}
                {a.kind === "dispenser" ? <StatusBadge status="Accessory" /> : null}
                </span>
                {a.shopTest === "tested" && (a.shopTestBy || a.shopTestNote) ? (
                  <span className="text-[11px] text-muted-foreground">
                    {a.shopTestBy ? `Tested by ${a.shopTestBy}` : "Tested"}
                    {a.shopTestAt ? ` · ${a.shopTestAt.slice(0, 16).replace("T", " ")}` : ""}
                    {a.shopTestNote ? ` · ${a.shopTestNote}` : ""}
                  </span>
                ) : a.shopTestNote ? (
                  <span className="text-[11px] text-muted-foreground">{a.shopTestNote}</span>
                ) : null}
              </span>
              </div>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                {canStock ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={a.shopTest === "needs-test" ? "default" : "outline"}
                      data-testid={a.serial ? `needs-test-${a.serial}` : undefined}
                      onClick={() =>
                        void setShopTest({ data: { id: a.id, shopTest: "needs-test" } })
                          .then(() => {
                            toast.success("Needs test");
                            void qc.invalidateQueries({ queryKey: ["assets"] });
                          })
                          .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update"))
                      }
                    >
                      Needs test
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={a.shopTest === "tested" ? "default" : "outline"}
                      data-testid={a.serial ? `mark-tested-${a.serial}` : undefined}
                      onClick={() =>
                        void setShopTest({ data: { id: a.id, shopTest: "tested" } })
                          .then(() => {
                            toast.success("Tested");
                            void qc.invalidateQueries({ queryKey: ["assets"] });
                          })
                          .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update"))
                      }
                    >
                      Tested
                    </Button>
                  </>
                ) : a.shopTest === "tested" ? (
                  <span className="text-xs text-muted-foreground">
                    Tested{a.shopTestBy ? ` · ${a.shopTestBy}` : ""}
                  </span>
                ) : null}
                {canStock && !a.stockHold ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={movingId === a.id ? "default" : "outline"}
                    data-testid={a.serial ? `move-${a.serial}` : undefined}
                    onClick={() => {
                      setMoveDraft(emptyPlaceDraft());
                      setMoveBlock(null);
                      setSwapWith("");
                      setMovingId((cur) => (cur === a.id ? null : a.id));
                    }}
                  >
                    Move
                  </Button>
                ) : null}
              </span>
              {canStock || a.stockHold ? (
                <div className="mt-2">
                  <StockActions asset={a} canStock={canStock} isAdmin={!!me.data?.isAdmin} />
                </div>
              ) : null}
            </div>
            {movingId === a.id && canStock ? (
              <div className="flex flex-wrap items-end gap-2 px-4 pb-3" data-testid="warehouse-move">
                <PlacePicker value={moveDraft} onChange={(next) => { setMoveDraft(next); setMoveBlock(null); setSwapWith(""); }} />
                {(() => {
                  const destRack = moveDraft.site === "barn-front" || moveDraft.site === "barn-back";
                  const mates =
                    destRack && moveDraft.pallet && moveDraft.level
                      ? barn.filter(
                          (u) =>
                            u.id !== a.id &&
                            !u.stockHold &&
                            u.site === moveDraft.site &&
                            (u.pallet ?? "").toUpperCase() === moveDraft.pallet.toUpperCase() &&
                            Number(u.level) === Number(moveDraft.level),
                        )
                      : [];
                  if (!mates.length) return null;
                  return (
                    <label className="grid gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Replace/Swap
                      <SelectField
                        aria-label="Replace or swap"
                        data-testid={a.serial ? `swap-${a.serial}` : "swap-unit"}
                        className="min-w-56 normal-case"
                        value={swapWith}
                        onChange={(e) => setSwapWith(e.target.value)}
                      >
                        <option value="">Add beside them</option>
                        {mates.map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {u.model}
                            {u.serial ? ` · ${u.serial}` : ""}
                          </option>
                        ))}
                      </SelectField>
                    </label>
                  );
                })()}
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
                          swapWithId: swapWith ? Number(swapWith) : null,
                        },
                      });
                      toast.success(
                        swapWith
                          ? place.place
                            ? `Swapped · now at ${place.place}`
                            : "Swapped"
                          : place.place
                            ? `Now at ${place.place}`
                            : "Moved",
                      );
                      setMovingId(null);
                      setMoveBlock(null);
                      setSwapWith("");
                      void qc.invalidateQueries({ queryKey: ["assets"] });
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Could not move";
                      if (/is full/i.test(msg)) setMoveBlock(msg);
                      toast.error(msg);
                    }
                  }}
                >
                  Confirm
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setMovingId(null); setMoveBlock(null); setSwapWith(""); }}>
                  Cancel
                </Button>
                {moveBlock ? <p className="w-full text-sm text-destructive">{moveBlock}</p> : null}
              </div>
            ) : null}
          </div>
        ))}
        {canStock && slot ? (
          <SlotAdd
            key={`${slot.rack}-${slot.pallet}-${slot.level}`}
            slot={slot}
            occupied={slotUnits.length > 0}
            occupants={barn}
            onPlaced={(id) => {
              void qc.invalidateQueries({ queryKey: ["assets"] });
              void qc.invalidateQueries({ queryKey: ["notifications"] });
              if (id) setSelected(id);
            }}
          />
        ) : null}
        {slot && slotUnits.length === 0 && !needle && !canStock ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">This slot is empty.</p>
        ) : list.length === 0 && !(canStock && slot) ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Nothing on this rack matches.</p>
        ) : null}
      </div>

      <AssetSheet asset={selectedRow} onClose={() => setSelected(null)} />
      <AddDialog
        open={create}
        onOpenChange={setCreate}
        rack={rack}
        slot={slot}
        onCreated={async (row) => {
          void qc.invalidateQueries({ queryKey: ["assets"] });
          void qc.invalidateQueries({ queryKey: ["dashboard"] });
          toast.success(row.reviewStatus === "pending" ? "On the rack · Needs review" : "On the rack");
          setSelected(row.id);
        }}
      />
    </div>
  );
}

function SlotAdd({
  slot,
  occupied,
  occupants,
  onPlaced,
}: {
  slot: SlotKey;
  occupied: boolean;
  occupants: Asset[];
  onPlaced: (id?: number) => void;
}) {
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [electrical, setElectrical] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<{ id: number; place: string } | null>(null);
  const [swapWith, setSwapWith] = useState("");
  const [block, setBlock] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlaceDraft>({
    site: slot.rack,
    pallet: slot.pallet,
    level: String(slot.level),
    otherLabel: "",
  });
  const rackSlot = draft.site === "barn-front" || draft.site === "barn-back";
  const label =
    rackSlot && draft.pallet && draft.level
      ? unitPlaceLabel({ site: draft.site, pallet: draft.pallet, level: Number(draft.level), status: "ready" })
      : slotId(slot.pallet, slot.level);
  const mates =
    confirm && rackSlot && draft.pallet && draft.level
      ? occupants.filter(
          (u) =>
            u.id !== confirm.id &&
            !u.stockHold &&
            u.site === draft.site &&
            (u.pallet ?? "").toUpperCase() === draft.pallet.toUpperCase() &&
            Number(u.level) === Number(draft.level),
        )
      : [];

  async function save(force: boolean) {
    if (!model.trim()) {
      toast.error("Pick a model");
      return;
    }
    const err = placeDraftError(draft);
    if (err) {
      toast.error(err);
      return;
    }
    setPending(true);
    try {
      if (!rackSlot) {
        if (serial.trim()) {
          const place = await setUnitPlace({
            data: {
              serial: serial.trim(),
              model: model.trim(),
              site: draft.site,
              otherLabel: draft.otherLabel || null,
            },
          });
          toast.success(place.place ? `Now at ${place.place}` : "Moved");
        } else {
          await addUnitToLocation({
            data: {
              site: draft.site,
              model: model.trim(),
              serial: null,
              electrical: electrical.trim() || null,
              otherLabel: draft.otherLabel || null,
            },
          });
          toast.success("Added");
        }
        setModel("");
        setSerial("");
        setElectrical("");
        setConfirm(null);
        setSwapWith("");
        setBlock(null);
        onPlaced();
        return;
      }
      if (confirm && swapWith) {
        const place = await setAssetPlace({
          data: {
            id: confirm.id,
            site: draft.site,
            pallet: draft.pallet,
            level: Number(draft.level),
            swapWithId: Number(swapWith),
          },
        });
        toast.success(place.place ? `Swapped · now at ${place.place}` : "Swapped");
        setModel("");
        setSerial("");
        setElectrical("");
        setConfirm(null);
        setSwapWith("");
        setBlock(null);
        onPlaced(confirm.id);
        return;
      }
      const res = await addToRackSlot({
        data: {
          site: draft.site,
          pallet: draft.pallet,
          level: Number(draft.level),
          model: model.trim(),
          serial: serial.trim() || null,
          electrical: electrical.trim() || null,
          confirm: force,
        },
      });
      if (res.needsConfirm) {
        setConfirm({ id: res.id, place: res.currentPlace ?? "another place" });
        setSwapWith("");
        return;
      }
      toast.success(
        res.moved
          ? `Moved into ${label}${res.pendingReview ? " · Needs review" : ""}`
          : `Added to ${label}${res.pendingReview ? " · Needs review" : ""}`,
      );
      setModel("");
      setSerial("");
      setElectrical("");
      setConfirm(null);
      setSwapWith("");
      setBlock(null);
      onPlaced(res.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add";
      if (/is full/i.test(msg)) setBlock(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-b border-border px-4 py-4" data-testid="slot-add">
      <p className="text-sm font-medium">{occupied ? "Add another" : "Add to this section"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick the rack, then the bay, then the level. Adding puts another serial in that section. One serial stays one record. Replace/Swap only if you choose it.
      </p>
      <div className="mt-3">
        <PlacePicker
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setBlock(null);
            setConfirm(null);
            setSwapWith("");
          }}
          testId="slot-place"
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <EquipmentCombo name="slot-model" label="Model" value={model} onChange={setModel} required />
        <div>
          <Label htmlFor="slot-serial">Serial</Label>
          <Input id="slot-serial" className="mt-1" value={serial} onChange={(e) => setSerial(e.target.value)} data-testid="slot-serial" />
        </div>
        <div>
          <Label htmlFor="slot-electrical">Electrical</Label>
          <Input
            id="slot-electrical"
            className="mt-1"
            value={electrical}
            placeholder="Optional, e.g. 120V"
            onChange={(e) => setElectrical(e.target.value)}
          />
        </div>
      </div>
      {confirm ? (
        <p className="mt-3 text-sm">
          {serial || "That serial"} is already at {confirm.place}. Move it into {label}? It is added beside the units already there unless you choose Replace/Swap.
        </p>
      ) : null}
      {confirm && mates.length > 0 ? (
        <label className="mt-3 grid max-w-sm gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Replace/Swap
          <SelectField
            aria-label="Replace or swap"
            data-testid="slot-swap"
            className="normal-case"
            value={swapWith}
            onChange={(e) => setSwapWith(e.target.value)}
          >
            <option value="">Add beside them</option>
            {mates.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.model}
                {u.serial ? ` · ${u.serial}` : ""}
              </option>
            ))}
          </SelectField>
        </label>
      ) : null}
      {block ? <p className="mt-3 text-sm text-destructive">{block}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" disabled={pending || !!placeDraftError(draft)} data-testid="slot-save" onClick={() => void save(!!confirm)}>
          {confirm ? (swapWith ? "Confirm swap" : "Confirm move") : pending ? "Saving…" : occupied ? "Add another" : "Add"}
        </Button>
        {confirm || block ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setConfirm(null);
              setSwapWith("");
              setBlock(null);
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AddDialog({
  open,
  onOpenChange,
  rack,
  slot,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rack: Rack;
  slot: SlotKey | null;
  onCreated: (row: Asset) => Promise<void>;
}) {
  const pallets = BACK_PALLETS;
  const [pending, setPending] = useState(false);
  const [model, setModel] = useState("");
  const [owned, setOwned] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setModel("");
          setOwned("");
        }
      }}
    >
      <DialogContent>
        <DialogTitle>Add to the barn</DialogTitle>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const site = String(fd.get("site")) as Rack;
            const pallet = String(fd.get("pallet"));
            const level = Number(fd.get("level"));
            const qtyRaw = String(fd.get("qty") || "1");
            setPending(true);
            try {
              const row = await createAsset({
                data: {
                  kind: String(fd.get("kind")) === "dispenser" ? "dispenser" : "equip",
                  model,
                  serial: String(fd.get("serial") || "") || null,
                  qty: Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : 1,
                  customerOwned: owned || null,
                  site,
                  pallet,
                  level,
                },
              });
              await onCreated(row);
              onOpenChange(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setPending(false);
            }
          }}
        >
          <EquipmentCombo name="model" label="Model" value={model} onChange={setModel} required placeholder="Search equipment…" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Serial</Label>
              <Input name="serial" className="mt-1" />
            </div>
            <div>
              <Label>Qty</Label>
              <Input name="qty" type="number" min={1} defaultValue="1" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Kind</Label>
            <SelectField name="kind" className="mt-1" defaultValue="equip">
              <option value="equip">Equipment</option>
              <option value="dispenser">Dispenser / accessory</option>
            </SelectField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Rack</Label>
              <SelectField name="site" className="mt-1" defaultValue={slot?.rack ?? rack}>
                <option value="barn-back">Back rack</option>
                <option value="barn-front">Front rack</option>
              </SelectField>
            </div>
            <div>
              <Label>Bay</Label>
              <SelectField name="pallet" className="mt-1" defaultValue={slot?.pallet ?? pallets[0]}>
                {pallets.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </SelectField>
            </div>
            <div>
              <Label>Level</Label>
              <SelectField name="level" className="mt-1" defaultValue={String(slot?.level ?? 1)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    L{l}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
          <CustomerCombo
            name="customerOwned"
            label="Customer-owned (optional)"
            value={owned}
            onChange={setOwned}
            placeholder="Search customers…"
          />
          <p className="text-xs text-muted-foreground">One serial stays one record. Adding to a section that already has units puts this one beside them.</p>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
