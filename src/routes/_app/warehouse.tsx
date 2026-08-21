import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createAsset, listAssets } from "@/lib/ops/api";
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
import { CustomerCombo, EquipmentCombo } from "@/components/desk/directory-fields";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, SORT_EQUIP, SORT_STATUS, sortDesk } from "@/lib/ops/sort";
import { ChartCard, SimpleBars, StatCard } from "@/components/desk/desk-charts";
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
  const [rack, setRack] = useState<Rack>("barn-back");
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<SlotKey | null>(null);
  const [selected, setSelected] = useOpenRecord(open);
  const [create, setCreate] = useState(false);
  const [sort, setSort] = useDeskSort("warehouse", "alpha-asc");

  const all = data.data ?? [];
  const barn = useMemo(
    () => all.filter((a) => a.status === "ready" && (a.site === "barn-back" || a.site === "barn-front")),
    [all],
  );
  const onRack = barn.filter((a) => a.site === rack);
  const pallets = rack === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;

  const fill = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of onRack) {
      if (!a.pallet || !a.level) continue;
      const k = `${a.pallet}-${a.level}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [onRack]);

  const slotUnits = useMemo(() => {
    if (!slot) return [];
    return onRack
      .filter((a) => a.pallet === slot.pallet && a.level === slot.level)
      .sort((a, b) => (a.lineNo ?? 99) - (b.lineNo ?? 99));
  }, [onRack, slot]);

  const needle = q.trim().toLowerCase();
  const list = useMemo(() => {
    let rows = slot
      ? slotUnits
      : onRack.filter((a) => a.kind === "equip" || a.kind === "dispenser");
    if (needle) {
      rows = barn.filter((a) =>
        [a.model, a.serial, a.slotLabel, a.customerOwned].filter(Boolean).some((v) =>
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
  }, [slot, slotUnits, onRack, barn, needle, sort]);

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
            Ready-to-deploy units at HQ. Slot ID is pallet + level — B-L3 is pallet B, third shelf. Pull a unit onto an install and it leaves this board.
          </p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus className="size-4" />
          Add to rack
        </Button>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <StatCard
          label="Ready"
          value={equipReady}
          hint={`${models} models · ${Math.max(0, BARN_EQUIP_CAPACITY - equipLines)} open slots`}
          breakdown={readyByModel}
        />
        <StatCard label="Fill" value={`${Math.round((equipLines / BARN_EQUIP_CAPACITY) * 100)}%`} hint={`${equipLines} lines on the rack`} />
        <StatCard label="Dispensers" value={dispQty} hint="Not counted in Ready" />
        <StatCard
          label="Missing serial"
          value={missing}
          tone={missing ? "warn" : undefined}
          hint={`${owned} customer-owned · ${catering} catering`}
        />
      </section>

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

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setRack("barn-back");
            setSlot(null);
          }}
          className={cn(
            "h-9 rounded-full px-3 text-sm font-medium",
            rack === "barn-back" ? "bg-ink text-ink-foreground" : "bg-secondary",
          )}
        >
          Back rack
        </button>
        <button
          type="button"
          onClick={() => {
            setRack("barn-front");
            setSlot(null);
          }}
          className={cn(
            "h-9 rounded-full px-3 text-sm font-medium",
            rack === "barn-front" ? "bg-ink text-ink-foreground" : "bg-secondary",
          )}
        >
          Front rack
        </button>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find model or serial…"
          className="max-w-xs"
        />
        <SortSelect value={sort} onChange={setSort} options={[...SORT_ALPHA, ...SORT_DATE, ...SORT_EQUIP, ...SORT_STATUS]} />
      </div>

      <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-catering" />Catering B–E</span>
        <span><span className="mr-1 inline-block size-2 rounded-sm bg-dispense" />Dispenser F–G</span>
        <span>Number in a cell is lines used of 12. Capacity this rack: {capacity}.</span>
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
                return (
                  <th
                    key={p}
                    className={cn(
                      "px-0.5 pb-2 text-[11px] font-medium",
                      bay === "catering" && "text-catering",
                      bay === "dispenser" && "text-dispense",
                    )}
                  >
                    {p}
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
                  const n = fill.get(`${p}-${level}`) ?? 0;
                  const bay = bayFor(rack, p);
                  const active = slot?.pallet === p && slot.level === level && slot.rack === rack;
                  return (
                    <td key={p} className="p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSlot(active ? null : { rack, pallet: p, level })
                        }
                        className={cn(
                          "flex h-9 w-full min-w-8 items-center justify-center rounded-sm text-xs tabular transition-colors",
                          n === 0 && "bg-muted text-muted-foreground",
                          n > 0 && n < 12 && "bg-primary/15 text-foreground",
                          n >= 12 && "bg-primary text-primary-foreground",
                          bay === "catering" && n === 0 && "bg-catering/15",
                          bay === "dispenser" && n === 0 && "bg-dispense/15",
                          active && "ring-2 ring-ring",
                        )}
                        aria-label={`${p}-L${level} ${n} of 12`}
                      >
                        {n}
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
        <h2 className="font-display text-xl">
          {needle
            ? "Search"
            : slot
              ? slotId(slot.pallet, slot.level)
              : rack === "barn-back"
                ? "Back rack units"
                : "Front rack units"}
        </h2>
        {slot ? (
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSlot(null)}>
            Clear slot
          </button>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        {list.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelected(a.id)}
            className="grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 md:grid-cols-[7rem_1.4fr_8rem_7rem] md:items-center"
          >
            <span className="font-mono text-xs">{a.slotLabel}</span>
            <span>
              <span className="font-medium">{a.model}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {a.serial ?? "No serial"}
                {a.qty > 1 ? ` · qty ${a.qty}` : ""}
                {a.customerOwned ? ` · ${a.customerOwned}` : ""}
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {a.missingSerial ? <StatusBadge status="Serial missing" /> : null}
              {a.customerOwned ? <StatusBadge status="Customer-owned" /> : null}
              {a.kind === "dispenser" ? <StatusBadge status="Accessory" /> : null}
            </span>
            <span className="text-sm text-muted-foreground">{a.kind === "dispenser" ? `${a.qty} pcs` : "1 unit"}</span>
          </button>
        ))}
        {list.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            {slot ? "Empty slot — add a unit here." : "Nothing on this rack matches."}
          </p>
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
          toast.success("On the rack");
          setSelected(row.id);
        }}
      />
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
  const pallets = (slot?.rack ?? rack) === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
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
                <option value="barn-back">Back</option>
                <option value="barn-front">Front</option>
              </SelectField>
            </div>
            <div>
              <Label>Pallet</Label>
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
          <p className="text-xs text-muted-foreground">Puts the unit on the next open line of that slot (1–12).</p>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>Add</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
