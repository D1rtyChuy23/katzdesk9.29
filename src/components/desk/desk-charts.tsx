import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

const ink = "#1A1612";
const primary = "#2F5D50";
const warning = "#9A5B12";
const muted = "#6F675E";
const cream = "#E7E0D4";
const card = "#FAF7F1";

export const CHART_PALETTE = [primary, ink, warning, muted, cream];

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
}

function useMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function Tip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-soft">
      {label ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground">
          <span className="text-foreground">{p.name}</span>
          <span className="ml-2 tabular">{money ? usd(Number(p.value) || 0) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

function barWidth(n: number, max: number): number {
  if (n <= 0 || max <= 0) return 0;
  return Math.min(100, Math.max(Math.round((n / max) * 100), 6));
}

function BarTrack({
  pct,
  color = primary,
  className,
}: {
  pct: number;
  color?: string;
  className?: string;
}) {
  return (
    <span className={cn("block h-2.5 min-w-0 overflow-hidden rounded-full bg-secondary", className)} aria-hidden>
      <span
        className="block h-full max-w-full rounded-full"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }}
      />
    </span>
  );
}

function BarRow({
  name,
  n,
  pct,
  color,
  label,
}: {
  name: string;
  n: number | string;
  pct: number;
  color?: string;
  label?: string;
}) {
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm leading-snug" title={name}>
          {name}
        </span>
        <span className="shrink-0 tabular text-sm font-medium">{n}</span>
      </div>
      {label ? <p className="text-[11px] text-muted-foreground">{label}</p> : null}
      <BarTrack pct={pct} color={color} className="mt-1" />
    </li>
  );
}

export function ChartKey({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function GroupedBars({
  data,
  aKey,
  bKey,
  aLabel,
  bLabel,
  xKey,
}: {
  data: Record<string, string | number>[];
  aKey: string;
  bKey: string;
  aLabel: string;
  bLabel: string;
  xKey: string;
}) {
  const max = Math.max(
    ...data.flatMap((d) => [Number(d[aKey]) || 0, Number(d[bKey]) || 0]),
    1,
  );
  return (
    <div className="min-w-0">
      <ChartKey
        items={[
          { label: aLabel, color: primary },
          { label: bLabel, color: ink },
        ]}
      />
      <ul className="space-y-4">
        {data.map((row, i) => {
          const name = String(row[xKey] ?? "—");
          const a = Number(row[aKey]) || 0;
          const b = Number(row[bKey]) || 0;
          return (
            <li key={`${name}-${i}`} className="min-w-0">
              <p className="mb-1.5 truncate text-sm font-medium" title={name}>
                {name}
              </p>
              <div className="space-y-1.5">
                <GroupedTrack label={aLabel} n={a} pct={barWidth(a, max)} color={primary} />
                <GroupedTrack label={bLabel} n={b} pct={barWidth(b, max)} color={ink} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GroupedTrack({
  label,
  n,
  pct,
  color,
}: {
  label: string;
  n: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)_1.75rem] items-center gap-2">
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <BarTrack pct={pct} color={color} className="h-2" />
      <span className="tabular text-right text-xs font-medium">{n}</span>
    </div>
  );
}

export function SimpleBars({
  data,
  xKey,
  yKey,
  yLabel,
  color = primary,
  horizontal,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  yLabel?: string;
  color?: string;
  horizontal?: boolean;
}) {
  const narrow = useNarrow();
  const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
  const rows = (
    <ul className="space-y-2.5">
      {data.map((row, i) => {
        const name = String(row[xKey] ?? "—");
        const n = Number(row[yKey]) || 0;
        return <BarRow key={`${name}-${i}`} name={name} n={n} pct={barWidth(n, max)} color={color} />;
      })}
    </ul>
  );

  if (horizontal || narrow || data.length > 8) {
    return (
      <div className="min-w-0">
        {yLabel ? (
          <p className="mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase">{yLabel}</p>
        ) : null}
        {rows}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {yLabel ? (
        <p className="mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase">{yLabel}</p>
      ) : null}
      <div className="flex h-48 min-w-0 items-end gap-1 sm:gap-2">
        {data.map((row, i) => {
          const name = String(row[xKey] ?? "—");
          const n = Number(row[yKey]) || 0;
          const pct = barWidth(n, max);
          return (
            <div key={`${name}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="tabular text-[11px] font-medium">{n}</span>
              <div className="flex h-36 w-full max-w-8 items-end justify-center">
                <span
                  className="block w-full max-w-5 overflow-hidden rounded-t-md"
                  style={{ height: `${pct}%`, background: color, minHeight: n ? "4px" : 0 }}
                  title={`${name}: ${n}`}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground" title={name}>
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StackedMoneyBars({
  data,
  xKey,
  openKey,
  doneKey,
  renderLabel,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  openKey: string;
  doneKey: string;
  /** Optional: make each bar's label a control (e.g. open a rep's deals). */
  renderLabel?: (name: string) => ReactNode;
}) {
  const max = Math.max(
    ...data.map((d) => (Number(d[openKey]) || 0) + (Number(d[doneKey]) || 0)),
    1,
  );
  return (
    <div className="min-w-0">
      <ChartKey
        items={[
          { label: "Open $", color: primary },
          { label: "Completed $", color: ink },
        ]}
      />
      <ul className="space-y-3">
        {data.map((row, i) => {
          const name = String(row[xKey] ?? "—");
          const open = Number(row[openKey]) || 0;
          const done = Number(row[doneKey]) || 0;
          const total = open + done;
          return (
            <li key={`${name}-${i}`} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium" title={name}>
                  {renderLabel ? renderLabel(name) : name}
                </span>
                <span className="shrink-0 tabular text-xs font-medium">{usd(total)}</span>
              </div>
              <span className="mt-1 flex h-2.5 min-w-0 overflow-hidden rounded-full bg-secondary" aria-hidden>
                <span
                  className="h-full max-w-full shrink-0"
                  style={{ width: `${(open / max) * 100}%`, background: primary }}
                />
                <span
                  className="h-full max-w-full shrink-0"
                  style={{ width: `${(done / max) * 100}%`, background: ink }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StatusDonut({
  data,
  unit = "total",
}: {
  data: { name: string; count: number }[];
  unit?: string;
}) {
  const reduce = useMotion();
  const id = useId();
  const total = data.reduce((n, d) => n + d.count, 0);
  return (
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative size-36 shrink-0 sm:size-40">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={40}
              outerRadius={62}
              paddingAngle={2}
              isAnimationActive={!reduce}
              label={false}
            >
              {data.map((entry, i) => (
                <Cell key={`${id}-${entry.name}`} fill={CHART_PALETTE[i % CHART_PALETTE.length]} stroke={card} />
              ))}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-2xl tabular leading-none">{total}</p>
          <p className="text-xs text-muted-foreground">{unit}</p>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 sm:flex-1">
        {data.map((row, i) => (
          <li key={row.name} className="flex min-w-0 items-center gap-2 text-sm">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate leading-snug">{row.name}</span>
            <span className="shrink-0 tabular text-xs text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BreakdownList({
  items,
  empty = "None yet.",
}: {
  items: { name: string; count: number }[];
  empty?: string;
}) {
  if (!items.length) return <p className="mt-2 text-xs text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="mt-3 min-w-0 space-y-2">
      {items.slice(0, 8).map((item) => (
        <BarRow key={item.name} name={item.name} n={item.count} pct={barWidth(item.count, max)} />
      ))}
    </ul>
  );
}

export function toggleChip<T>(current: T, next: T, off: T): T {
  return current === next ? off : next;
}

export function FilterChip({
  selected,
  className,
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        "h-9 rounded-full px-3 text-sm font-medium",
        selected ? "bg-ink text-ink-foreground" : "bg-secondary text-foreground",
        className,
      )}
      aria-pressed={selected}
      {...props}
    >
      {children}
    </button>
  );
}

/** Secondary page actions. Same button styles, one click behind the primary. */
export function ActionMenu({
  label = "More",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div className="absolute right-0 z-30 mt-1 flex min-w-48 flex-col gap-1 rounded-md border border-border bg-card p-1.5 shadow-sm [&_button]:w-full [&_button]:justify-start">
        {children}
      </div>
    </details>
  );
}

export function StatRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-5 flex w-full min-w-0 flex-wrap gap-2", className)} data-stat-row="">
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  breakdown,
  selected,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "danger" | "warn" | "ok";
  breakdown?: { name: string; count: number }[];
  selected?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="flex items-center gap-1.5 truncate text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-primary/50",
            tone === "danger" && "bg-destructive",
            tone === "warn" && "bg-warning",
          )}
        />
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-[2rem] font-medium tabular leading-none tracking-tight",
          tone === "danger" && "text-destructive",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{hint}</p> : null}
      {breakdown?.length ? (
        <div className="mt-1 hidden min-w-0 overflow-hidden @[11rem]:block">
          <BreakdownList items={breakdown.slice(0, 3)} />
        </div>
      ) : null}
    </>
  );
  const cls = cn(
    "@container desk-flat relative min-w-[10rem] flex-1 overflow-hidden rounded-xl border bg-card px-3.5 py-3.5 text-left shadow-[var(--shadow-soft)] sm:px-4",
    selected
      ? "border-primary/60 ring-2 ring-primary/20 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-primary"
      : "border-border",
    onClick && "cursor-pointer transition-colors hover:border-primary/50",
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={!!selected}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function ChartCard({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-display text-xl">{title}</h2>
      {lede ? <p className="mt-0.5 text-xs text-muted-foreground">{lede}</p> : null}
      <div className="mt-3 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function MiniStat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2.5 shadow-[var(--shadow-soft)]">
      <p className="truncate text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-display text-2xl tabular leading-tight">{value}</p>
      {hint ? <p className="line-clamp-2 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
