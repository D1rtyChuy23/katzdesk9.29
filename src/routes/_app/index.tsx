import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/ops/api";
import { formatLongDate, formatShortDate } from "@/lib/ops/clock";
import { FlagBadge, StatusBadge } from "@/components/desk/flag-badge";
import { Skeleton } from "@/components/ui/separator";
import {
  ChartCard,
  GroupedBars,
  MiniStat,
  SimpleBars,
  StatCard,
} from "@/components/desk/desk-charts";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_DATE, SORT_ALPHA, SORT_FLAG, SORT_STATUS, sortDesk, type DeskSortId } from "@/lib/ops/sort";
import type { ComingDueRow, FlaggedRow } from "@/lib/ops/types";
import { OpenLink } from "@/components/desk/open-link";
import { PingButton } from "@/components/desk/ping-button";

export const Route = createFileRoute("/_app/")({ component: ClockHome });

function ClockHome() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const [dueSort, setDueSort] = useDeskSort("clock-due", "date-asc");
  const d = dash.data;
  if (dash.isError) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-display text-2xl">Couldn’t load the clock</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {dash.error instanceof Error ? dash.error.message : "Try again in a moment."}
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => void dash.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }
  if (dash.isLoading || !d) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const statusChart = d.statusBreakdown
    .filter((s) => s.service + s.tlc > 0)
    .map((s) => ({ status: s.status.replace("Follow-up Needed", "Follow-up"), service: s.service, tlc: s.tlc }));
  const techChart = d.techLoad
    .filter((t) => t.active + t.completed > 0)
    .map((t) => ({ tech: t.tech, active: t.active }));
  const dueChart = groupDueWindows(d.comingDueBuckets ?? []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Operations clock</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Today, {formatLongDate(d.today)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Week {d.weekLabel} · Next {d.nextWeekLabel}
          </p>
        </div>
        <Link
          to="/handoff"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Open handoff feed
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Active calls" value={d.kpis.activeCalls} hint="Service + TLC still open" />
        <MiniStat label="Coming due" value={d.kpis.comingDue} hint="Next 14 days" />
        <MiniStat label="Install queue" value={d.kpis.installQueue} hint={`${d.kpis.installAtRisk} at risk`} />
        <MiniStat label="PMs active" value={d.kpis.pmsActive} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Service flags"
          value={d.kpis.svcFlags}
          tone={d.kpis.svcFlags ? "danger" : "ok"}
          hint="48-hour clock"
        />
        <StatCard
          label="TLC flags"
          value={d.kpis.tlcFlags}
          tone={d.kpis.tlcFlags ? "danger" : "ok"}
          hint="2-week clock"
        />
        <StatCard
          label="PM flags"
          value={d.kpis.pmFlags}
          tone={d.kpis.pmFlags ? "warn" : "ok"}
          hint={`${d.kpis.pmsActive} active PMs`}
        />
        <StatCard
          label="Open asks"
          value={d.kpis.openAsks}
          tone={d.kpis.openAsks ? "warn" : "ok"}
          hint="Handoff waiting on an answer"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="Ready in the barn"
          value={d.kpis.barnReady}
          hint={`${d.kpis.barnOpen} open slots`}
          breakdown={d.barnReadyByModel}
        />
        <StatCard
          label="Ready to install"
          value={d.kpis.installReady}
          hint={`${d.kpis.installQueue} in the queue · ${d.kpis.installAtRisk} at risk`}
          breakdown={d.installReadyByEquip}
        />
        <StatCard
          label="Ready modules"
          value={d.kpis.modulesReady}
          hint="Shop modules marked Ready"
          breakdown={d.modulesReadyByType}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Call mix" lede="Service vs TLC + Factor by status — closed work stays visible so volume is honest.">
          {statusChart.length ? (
            <GroupedBars data={statusChart} xKey="status" aKey="service" bKey="tlc" aLabel="Service" bLabel="TLC" />
          ) : (
            <p className="text-sm text-muted-foreground">No calls loaded.</p>
          )}
        </ChartCard>
        <ChartCard title="Coming due — 14 days" lede="Dated service, TLC, PMs, and installs grouped so the week is readable.">
          <SimpleBars data={dueChart} xKey="window" yKey="count" yLabel="Jobs" />
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <ChartCard title="On the truck" lede="Active calls per technician.">
          {techChart.length ? (
            <SimpleBars data={techChart} xKey="tech" yKey="active" horizontal />
          ) : (
            <p className="text-sm text-muted-foreground">No techs on active calls.</p>
          )}
        </ChartCard>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl">Pipeline snapshot</h2>
            <Link to="/pipeline" className="text-xs text-muted-foreground hover:text-foreground">
              Open pipeline
            </Link>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Snap label="Open deals" value={String(d.pipelineSnap?.openCount ?? 0)} />
            <Snap label="Open $" value={moneyish(d.pipelineSnap?.openValue)} />
            <Snap label="Good to order" value={String(d.pipelineSnap?.goodToOrder ?? 0)} />
            <Snap label="Ordered" value={String(d.pipelineSnap?.ordered ?? 0)} />
            <Snap label="Completed" value={String(d.pipelineSnap?.completeCount ?? 0)} />
            <Snap label="Completed $" value={moneyish(d.pipelineSnap?.completeValue)} />
          </dl>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-3">
        <FlagList
          title="Service — 48-hour clock"
          href="/service"
          rows={d.flagged.service}
          empty="No service flags. The 48-hour clock is clear."
        />
        <FlagList
          title="TLC + Factor — 2-week clock"
          href="/tlc"
          rows={d.flagged.tlc}
          empty="No TLC flags."
        />
        <FlagList
          title="PM tracker"
          href="/pms"
          rows={d.flagged.pm}
          empty="No PM flags."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <DueList rows={d.comingDue} sort={dueSort} onSort={setDueSort} />
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl">Latest handoff</h2>
            <Link to="/handoff" className="text-xs text-muted-foreground hover:text-foreground">
              All notes
            </Link>
          </div>
          {d.recentHandoff.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {d.recentHandoff.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <p className="text-sm">
                    <span className="font-medium">{c.authorName}</span>
                    <span className="text-muted-foreground"> on {c.customer ?? c.entityType}</span>
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          {d.pendingHandoffs.length > 0 ? (
            <p className="mt-3 text-xs text-warning">
              {d.pendingHandoffs.length} completed deal{d.pendingHandoffs.length === 1 ? "" : "s"} waiting on an install row.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function groupDueWindows(buckets: { label: string; day: number; count: number }[]) {
  let today = 0;
  let soon = 0;
  let week = 0;
  let next = 0;
  for (const b of buckets) {
    if (b.day === 0) today += b.count;
    else if (b.day <= 3) soon += b.count;
    else if (b.day <= 7) week += b.count;
    else next += b.count;
  }
  return [
    { window: "Today", count: today },
    { window: "1–3 days", count: soon },
    { window: "This week", count: week },
    { window: "Next week", count: next },
  ];
}

function moneyish(n: number | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function Snap({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg tabular">{value}</dd>
    </div>
  );
}

function FlagList({
  title,
  href,
  rows,
  empty,
}: {
  title: string;
  href: "/service" | "/tlc" | "/pms";
  rows: FlaggedRow[];
  empty: string;
}) {
  const [sort, setSort] = useDeskSort(`clock-flag-${href}`, "flag");
  const shown = useMemo(
    () =>
      sortDesk(rows, sort, {
        date: (r) => r.scheduled ?? r.received,
        name: (r) => r.customer,
        status: (r) => r.status,
        flagRank: (r) => r.flag?.rank ?? 99,
        tech: (r) => r.technician,
        equipment: (r) => (r.detail ? 1 : 0),
      }),
    [rows, sort],
  );
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-balance font-display text-xl leading-snug">{title}</h2>
        <Link to={href} className="mt-1 shrink-0 text-xs text-muted-foreground hover:text-foreground">
          Open
        </Link>
      </div>
      <div className="mt-3 min-w-0">
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[...SORT_FLAG, ...SORT_DATE, ...SORT_ALPHA, ...SORT_STATUS]}
          className="w-full"
        />
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {shown.map((r) => (
            <li key={`${r.entityType}-${r.id}`} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <OpenLink entityType={r.entityType} id={r.id} className="min-w-0 font-medium hover:underline">
                  {r.customer}
                </OpenLink>
                <PingButton
                  size="xs"
                  entityType={r.entityType}
                  entityId={r.id}
                  contextLabel={`${r.customer} · ${title}`}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <FlagBadge flag={r.flag} />
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Rec {formatShortDate(r.received)}
                {r.scheduled ? ` · Sch ${formatShortDate(r.scheduled)}` : ""}
                {r.technician ? ` · ${r.technician}` : ""}
                {r.detail ? ` · ${r.detail}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DueList({
  rows,
  sort,
  onSort,
}: {
  rows: ComingDueRow[];
  sort: DeskSortId;
  onSort: (v: DeskSortId) => void;
}) {
  const shown = useMemo(
    () =>
      sortDesk(rows, sort, {
        date: (r) => r.scheduled,
        name: (r) => r.customer,
        status: (r) => r.status,
        tech: (r) => r.technician,
        equipment: (r) => (r.equipment ? 1 : 0),
      }),
    [rows, sort],
  );
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl">Coming due — 14 days</h2>
          <p className="text-xs text-muted-foreground">Every dated job in the window, sorted how you need it.</p>
        </div>
        <SortSelect value={sort} onChange={onSort} options={[...SORT_DATE, ...SORT_ALPHA, ...SORT_STATUS]} />
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing scheduled in the next two weeks.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {shown.map((row) => (
            <li key={`${row.entityType}-${row.id}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <OpenLink entityType={row.entityType} id={row.id} className="font-medium hover:underline">
                  {row.customer}
                </OpenLink>
                <p className="text-xs text-muted-foreground">
                  {row.source} · {row.equipment ?? "—"} · {row.technician ?? "unassigned"}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-medium">
                  {row.daysOut === 0 ? "Today" : `${row.daysOut}d`}
                </p>
                <p className="text-xs text-muted-foreground">{formatShortDate(row.scheduled)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
