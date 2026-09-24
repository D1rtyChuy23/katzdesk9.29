import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/ops/api";
import { formatLongDate, formatShortDate, weekBounds } from "@/lib/ops/clock";
import { FlagBadge, StatusBadge } from "@/components/desk/flag-badge";
import { Skeleton } from "@/components/ui/separator";
import { MiniStat } from "@/components/desk/desk-charts";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_DATE, SORT_ALPHA, SORT_FLAG, SORT_STATUS, sortDesk } from "@/lib/ops/sort";
import type { FlaggedRow } from "@/lib/ops/types";

import { OpenLink } from "@/components/desk/open-link";
import { PingButton } from "@/components/desk/ping-button";
import { ComingDuePanel } from "@/components/desk/coming-due";
import { useMyView } from "@/components/desk/my-view-bar";
import { RebuildAlerts } from "@/components/desk/rebuild-alerts";



export const Route = createFileRoute("/_app/")({ component: ClockHome });

function ClockHome() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { role, filterMine, matchMine, compact } = useMyView();
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

  const dueRows = filterMine
    ? d.comingDue.filter((r) =>
        role === "sales" ? matchMine(r.accountRep) || r.aviKatz : matchMine(r.technician) || !r.technician,
      )
    : d.comingDue;
  const weekEnd = weekBounds(d.today).end;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Operations clock</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Today, {formatLongDate(d.today)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Week {d.weekLabel} · Next {d.nextWeekLabel}
          {role ? ` · ${role === "sales" ? "Sales" : "Service"} view` : ""}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Link to="/service" className="min-w-0">
          <MiniStat label="Active calls" value={d.kpis.activeCalls} hint="Open tickets" />
        </Link>
        <MiniStat label="Coming due" value={d.kpis.comingDue} hint="Overdue, today, this week" />
        <Link to="/installs" className="min-w-0">
          <MiniStat label="Install queue" value={d.kpis.installQueue} hint={`${d.kpis.installAtRisk} at risk`} />
        </Link>
        <Link to="/pms" className="min-w-0">
          <MiniStat label="PMs active" value={d.kpis.pmsActive} hint="Open the PM board" />
        </Link>
        <Link to="/rebuilds" className="min-w-0">
          <MiniStat
            label="Rebuilds"
            value={(d.kpis.rebuildOverdue ?? 0) + (d.kpis.rebuildWaiting ?? 0)}
            hint={`${d.kpis.rebuildOverdue ?? 0} overdue · ${d.kpis.rebuildWaiting ?? 0} waiting`}
          />
        </Link>
      </section>

      <ComingDuePanel rows={dueRows} counts={d.comingDueCounts} weekEnd={weekEnd} compact={compact} />
      <RebuildAlerts rows={d.rebuildAlerts ?? []} />

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

