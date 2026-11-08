import type { DiscountScope } from "@/lib/ops/discount";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What a bill's one discount comes off (Chuy, 11/7): the Whole bill, or the Chosen lines ticked below. Two pills like
 * Percent / Amount, shown once a discount is typed.
 */
export function ScopePicker({ scope, onChange, disabled }: { scope: DiscountScope; onChange: (s: DiscountScope) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="What the discount comes off">
      {(["all", "chosen"] as const).map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          aria-pressed={scope === s}
          data-testid={`discount-scope-${s}`}
          onClick={() => onChange(s)}
          className={cn("h-9 rounded-full px-3 text-sm font-medium disabled:opacity-60 max-sm:h-10", scope === s ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground")}
        >
          {s === "all" ? "Whole bill" : "Chosen lines"}
        </button>
      ))}
    </div>
  );
}

/** On Chosen lines: how many lines the discount comes off, and All / None to tick or untick every one. */
export function ChosenBar({ chosen, lines, onAll, onNone, disabled }: { chosen: number; lines: number; onAll: () => void; onNone: () => void; disabled?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="mr-1 tabular" data-testid="discount-chosen-count">
        Comes off {chosen} of {lines} line{lines === 1 ? "" : "s"}
      </span>
      <Button type="button" size="sm" variant="outline" className="max-sm:h-10" disabled={disabled || !lines || chosen === lines} onClick={onAll} data-testid="discount-chosen-all">
        All
      </Button>
      <Button type="button" size="sm" variant="outline" className="max-sm:h-10" disabled={disabled || !chosen} onClick={onNone} data-testid="discount-chosen-none">
        None
      </Button>
    </div>
  );
}

/** A line's Discount tick, on Chosen lines: the discount comes off it when ticked. Named for its line. */
export function LineTick({ item, checked, onChange, disabled }: { item: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("mt-2 flex w-fit items-center gap-2 text-sm font-medium max-sm:h-10", disabled ? "opacity-60" : "cursor-pointer")}>
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={`Discount ${item}`}
        data-testid="line-discount-tick"
      />
      Discount
    </label>
  );
}
