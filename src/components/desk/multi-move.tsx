import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setAssetsPlace } from "@/lib/ops/unit-place";
import { placeDraftError } from "@/lib/ops/unit-place-rules";
import type { Asset } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlacePicker, emptyPlaceDraft, type PlaceDraft } from "./unit-place-field";

function unitName(u: Asset) {
  return `${u.model}${u.serial ? ` · ${u.serial}` : ""}`;
}

/**
 * Move one or more units to a rack section or location. When the section already has units,
 * tick any number of them under Replace/Swap — they go back to where the moved units came from.
 */
export function MovePanel({
  movers,
  barn,
  onDone,
  onCancel,
  className,
}: {
  movers: Asset[];
  barn: Asset[];
  onDone: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PlaceDraft>(emptyPlaceDraft());
  const [swap, setSwap] = useState<number[]>([]);
  const [block, setBlock] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const moverIds = new Set(movers.map((m) => m.id));
  const destRack = draft.site === "barn-front" || draft.site === "barn-back";
  const mates =
    destRack && draft.pallet && draft.level
      ? barn.filter(
          (u) =>
            !moverIds.has(u.id) &&
            !u.stockHold &&
            u.site === draft.site &&
            (u.pallet ?? "").toUpperCase() === draft.pallet.toUpperCase() &&
            Number(u.level) === Number(draft.level),
        )
      : [];
  const onRack = movers.filter((m) => m.site === "barn-back" || m.site === "barn-front");
  const homes = [...new Set(onRack.map((m) => `${m.site}|${m.pallet}|${m.level}`))];
  const swapHome = onRack[0]
    ? `${onRack[0].pallet}-L${onRack[0].level}${homes.length > 1 ? " and the other sections they came from" : ""}`
    : null;
  const allPicked = mates.length > 0 && mates.every((m) => swap.includes(m.id));

  function toggle(id: number) {
    setSwap((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function confirm() {
    const err = placeDraftError(draft);
    if (err) {
      toast.error(err);
      return;
    }
    setPending(true);
    setBlock(null);
    try {
      const res = await setAssetsPlace({
        data: {
          ids: movers.map((m) => m.id),
          site: draft.site,
          pallet: draft.pallet || null,
          level: draft.level ? Number(draft.level) : null,
          otherLabel: draft.otherLabel || null,
          swapIds: swap,
        },
      });
      const where = res.place ? ` to ${res.place}` : "";
      const parts = [
        `Moved ${res.moved} ${res.moved === 1 ? "unit" : "units"}${where}`,
        res.swapped ? `${res.swapped} swapped back` : null,
      ].filter(Boolean);
      if (res.failed.length) {
        toast.error(`${parts.join(" · ")}. ${res.failed.length} didn't move: ${res.failed.join("; ")}`);
        if (res.failed.some((f) => /full/i.test(f))) setBlock(res.failed.join(" "));
      } else {
        toast.success(parts.join(" · "));
      }
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      if (!res.failed.length) onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not move";
      if (/full/i.test(msg)) setBlock(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("grid gap-3", className)} data-testid="warehouse-move">
      {movers.length > 1 ? (
        <p className="text-sm font-medium">
          Moving {movers.length} units: <span className="font-normal text-muted-foreground">{movers.map(unitName).join(", ")}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <PlacePicker
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setSwap([]);
            setBlock(null);
          }}
        />
      </div>
      {mates.length ? (
        <fieldset className="grid gap-1.5" data-testid="swap-list">
          <legend className="flex w-full flex-wrap items-baseline justify-between gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <span>Replace/Swap — tick any units already here</span>
            <button
              type="button"
              className="normal-case text-primary underline-offset-2 hover:underline"
              onClick={() => setSwap(allPicked ? [] : mates.map((m) => m.id))}
            >
              {allPicked ? "Clear" : `Select all ${mates.length}`}
            </button>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {mates.map((u) => {
              const on = swap.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  data-testid={u.serial ? `swap-pick-${u.serial}` : undefined}
                  onClick={() => toggle(u.id)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm",
                    on ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-sm border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                    )}
                  >
                    {on ? <Check className="size-3" /> : null}
                  </span>
                  {unitName(u)}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {swap.length === 0
              ? "Nothing ticked: the moved units go in beside them."
              : swapHome
                ? `${swap.length} ticked ${swap.length === 1 ? "unit goes" : "units go"} to ${swapHome}.`
                : "Ticked units need a rack to go back to — the moved units aren't on a rack."}
          </p>
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending || !!placeDraftError(draft)} onClick={() => void confirm()}>
          {pending
            ? "Moving…"
            : swap.length
              ? `Confirm swap (${movers.length} ↔ ${swap.length})`
              : movers.length > 1
                ? `Move ${movers.length} units`
                : "Confirm"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {block ? <p className="text-sm text-destructive">{block}</p> : null}
    </div>
  );
}
