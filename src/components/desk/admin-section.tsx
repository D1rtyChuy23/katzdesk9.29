import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function resolvedOn(rows: { resolvedAt: string }[]): string | null {
  const times = rows.map((r) => new Date(r.resolvedAt).getTime()).filter((n) => Number.isFinite(n));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One Library Admin block. Open when there is work, unless this person left it the other way. */
export function AdminSection({
  id,
  title,
  hint,
  openCount,
  lastResolved,
  open,
  onOpenChange,
  resolved,
  testId,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  openCount: number;
  lastResolved: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolved: { key: string; label: string; detail?: string | null }[];
  testId: string;
  children: ReactNode;
}) {
  const clear = openCount === 0;
  return (
    <section className="rounded-xl border border-border bg-card" data-testid={testId} data-open={open ? "true" : "false"} data-section={id}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        data-testid={`${id}-toggle`}
      >
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        {clear ? <Check className="size-4 shrink-0 text-copper" aria-hidden="true" /> : null}
        <span className="font-medium">{title}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
            clear ? "bg-copper/15 text-copper" : "bg-warning/15 text-warning",
          )}
          data-testid={`${id}-chip`}
        >
          {clear ? "All clear" : `Needs action (${openCount})`}
        </span>
        <span className="ml-auto text-xs text-muted-foreground" title={hint}>
          {clear ? `All clear${lastResolved ? `, last resolved ${lastResolved}` : ""}` : "Details"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground" title={hint}>
            {hint.split(". ")[0]}.
          </p>
          <div className="mt-3">{children}</div>
          {resolved.length ? (
            <details className="mt-3" data-testid={`${id}-resolved`}>
              <summary className="cursor-pointer text-sm text-muted-foreground">Resolved ({resolved.length})</summary>
              <ul className="mt-2 divide-y divide-border text-sm text-muted-foreground">
                {resolved.map((row) => (
                  <li key={row.key} className="py-1.5">
                    {row.label}
                    {row.detail ? <span className="block text-xs">{row.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
