import { useId, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const ink = "#1A1612";
const primary = "#2F5D50";
const warning = "#9A5B12";
const muted = "#6F675E";
const cream = "#E7E0D4";
const card = "#FAF7F1";
const border = "#DDD4C6";

export const CHART_PALETTE = [primary, ink, warning, muted, cream];

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
    <div>
      <ChartKey
        items={[
          { label: aLabel, color: primary },
          { label: bLabel, color: ink },
        ]}
      />
      <ul className="space-y-3">
        {data.map((row, i) => {
          const name = String(row[xKey] ?? "—");
          const a = Number(row[aKey]) || 0;
          const b = Number(row[bKey]) || 0;
          const aPct = Math.round((a / max) * 100);
          const bPct = Math.round((b / max) * 100);
          return (
            <li key={`${name}-${i}`}>
              <p className="mb-1 truncate text-sm font-medium" title={name}>
                {name}
              </p>
              <div className="space-y-1">
                <GroupedTrack label={aLabel} n={a} pct={aPct} color={primary} />
                <GroupedTrack label={bLabel} n={b} pct={bPct} color={ink} />
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
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.75rem] items-center gap-2">
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <span className="h-2 min-w-0 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <span
          className="block h-full rounded-full"
          style={{ width: `${n === 0 ? 0 : Math.max(pct, 6)}%`, background: color }}
        />
      </span>
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
  const reduce = useMotion();
  if (horizontal) {
    const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
    return (
      <div>
        {yLabel ? (
          <p className="mb-2 text-right text-xs tracking-wide text-muted-foreground uppercase">{yLabel}</p>
        ) : null}
        <ul className="space-y-2.5">
          {data.map((row, i) => {
            const name = String(row[xKey] ?? "—");
            const n = Number(row[yKey]) || 0;
            const pct = Math.round((n / max) * 100);
            return (
              <li key={`${name}-${i}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_2.5rem] items-center gap-3">
                <span className="truncate text-sm" title={name}>
                  {name}
                </span>
                <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${n === 0 ? 0 : Math.max(pct, 4)}%`, background: color }}
                  />
                </span>
                <span className="tabular text-right text-sm font-medium">{n}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={border} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<Tip />} cursor={{ fill: cream }} />
          <Bar
            dataKey={yKey}
            name={yLabel ?? yKey}
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            isAnimationActive={!reduce}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedMoneyBars({
  data,
  xKey,
  openKey,
  doneKey,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  openKey: string;
  doneKey: string;
}) {
  const reduce = useMotion();
  return (
    <div>
      <ChartKey
        items={[
          { label: "Open $", color: primary },
          { label: "Completed $", color: ink },
        ]}
      />
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={border} vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: muted, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<Tip money />} cursor={{ fill: cream }} />
            <Bar dataKey={openKey} name="Open $" stackId="a" fill={primary} radius={[0, 0, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} />
            <Bar dataKey={doneKey} name="Completed $" stackId="a" fill={ink} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
    <div className="grid gap-3 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={2}
              isAnimationActive={!reduce}
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
      <ul className="space-y-1.5">
        {data.map((row, i) => (
          <li key={row.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <span className="tabular text-xs text-muted-foreground">{row.count}</span>
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
    <ul className="mt-3 space-y-1.5">
      {items.slice(0, 8).map((item) => (
        <li key={item.name} className="grid grid-cols-[minmax(0,1fr)_2.5rem_4.5rem] items-center gap-2 text-sm">
          <span className="min-w-0 truncate">{item.name}</span>
          <span className="tabular text-right text-xs text-muted-foreground">{item.count}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  breakdown,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "danger" | "warn" | "ok";
  breakdown?: { name: string; count: number }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-3xl tabular leading-none",
          tone === "danger" && "text-destructive",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      {breakdown?.length ? <BreakdownList items={breakdown} /> : null}
    </div>
  );
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
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">{title}</h2>
      {lede ? <p className="mt-0.5 text-xs text-muted-foreground">{lede}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function MiniStat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/70 px-3 py-2">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-xl tabular leading-tight">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
