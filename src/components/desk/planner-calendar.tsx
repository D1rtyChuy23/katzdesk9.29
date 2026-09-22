import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatShortDate,
  monthBounds,
  todayChicago,
  weekBounds,
  WEEKDAYS,
} from "@/lib/ops/clock";
import { isClosedCall } from "@/lib/ops/ticket-status";
import type { Install, PmJob, ServiceJob } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { OpenLink } from "./open-link";
import { cn } from "@/lib/utils";

export type CalType = "installs" | "pms" | "tlcs" | "services";

const ALL_TYPES: CalType[] = ["installs", "pms", "tlcs", "services"];

const TYPE_META: Record<CalType, { label: string; short: string; entity: "install" | "pm" | "tlc" | "service"; className: string }> = {
  installs: { label: "Installs", short: "Install", entity: "install", className: "bg-primary/15 text-primary" },
  pms: { label: "PMs", short: "PM", entity: "pm", className: "bg-secondary text-foreground" },
  tlcs: { label: "TLCs", short: "TLC", entity: "tlc", className: "bg-warning/15 text-warning" },
  services: { label: "Services", short: "Service", entity: "service", className: "bg-ink/10 text-ink" },
};

export type CalItem = {
  key: string;
  type: CalType;
  entityType: "install" | "pm" | "tlc" | "service";
  id: number;
  account: string;
  wo: string | null;
  date: string;
  owner: string | null;
};

function collectItems(input: {
  installs: Install[];
  pms: PmJob[];
  services: ServiceJob[];
  tlcs: ServiceJob[];
}): CalItem[] {
  const items: CalItem[] = [];
  const add = (row: Omit<CalItem, "key">) => {
    items.push({ ...row, key: `${row.type}-${row.id}` });
  };
  for (const i of input.installs) {
    if (!i.installDate) continue;
    add({
      type: "installs",
      entityType: "install",
      id: i.id,
      account: i.customer,
      wo: i.wo,
      date: i.installDate,
      owner: i.technician || i.accountRep,
    });
  }
  for (const p of input.pms) {
    if (!p.projected || p.status === "Cancelled") continue;
    add({
      type: "pms",
      entityType: "pm",
      id: p.id,
      account: p.customer,
      wo: p.wo,
      date: p.projected,
      owner: p.technician,
    });
  }
  for (const j of input.tlcs) {
    if (!j.scheduled || j.status === "Cancelled") continue;
    add({
      type: "tlcs",
      entityType: "tlc",
      id: j.id,
      account: j.customer || "Untitled",
      wo: j.wo,
      date: j.scheduled,
      owner: j.technician,
    });
  }
  for (const j of input.services) {
    if (!j.scheduled || isClosedCall(j)) continue;
    add({
      type: "services",
      entityType: "service",
      id: j.id,
      account: j.customer || "Untitled",
      wo: j.wo,
      date: j.scheduled,
      owner: j.technician,
    });
  }
  return items;
}

export function PlannerCalendar({
  installs,
  pms,
  services,
  tlcs,
}: {
  installs: Install[];
  pms: PmJob[];
  services: ServiceJob[];
  tlcs: ServiceJob[];
}) {
  const today = todayChicago();
  const [anchor, setAnchor] = useState(() => monthBounds(today).start);
  const [types, setTypes] = useState<Set<CalType>>(() => new Set(ALL_TYPES));
  const month = monthBounds(anchor);
  const allOn = types.size === ALL_TYPES.length;

  const items = useMemo(
    () => collectItems({ installs, pms, services, tlcs }),
    [installs, pms, services, tlcs],
  );

  const visible = useMemo(() => {
    return items.filter((it) => types.has(it.type) && it.date >= month.start && it.date <= month.end);
  }, [items, types, month.start, month.end]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of visible) {
      const list = map.get(it.date) ?? [];
      list.push(it);
      map.set(it.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.account.localeCompare(b.account) || a.type.localeCompare(b.type));
    }
    return map;
  }, [visible]);

  const gridStart = weekBounds(month.start).start;
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    cells.push(d);
    if (d >= month.end && (i + 1) % 7 === 0) break;
  }

  function toggle(t: CalType | "all") {
    if (t === "all") {
      setTypes(new Set(ALL_TYPES));
      return;
    }
    if (types.size === ALL_TYPES.length) {
      setTypes(new Set([t]));
      return;
    }
    const next = new Set(types);
    if (next.has(t)) {
      next.delete(t);
      setTypes(next.size === 0 ? new Set(ALL_TYPES) : next);
      return;
    }
    next.add(t);
    setTypes(next.size === ALL_TYPES.length ? new Set(ALL_TYPES) : next);
  }

  const monthAll = items.filter((it) => it.date >= month.start && it.date <= month.end);
  const typeCount = (t: CalType) => monthAll.filter((it) => it.type === t).length;

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4" data-testid="planner-calendar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl leading-tight">Month</h2>
          <p className="text-[11px] text-muted-foreground">
            Same dates as the boards and exports. Click a job to open it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setAnchor(addMonths(anchor, -1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAnchor(monthBounds(today).start)}>
            This month
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAnchor(addMonths(anchor, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {formatMonthLabel(anchor)} · {visible.length} scheduled
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Calendar types">
        <button
          type="button"
          data-testid="cal-type-all"
          aria-pressed={allOn}
          onClick={() => toggle("all")}
          className={cn(
            "h-8 rounded-full px-3 text-sm font-medium",
            allOn ? "bg-ink text-ink-foreground" : "bg-secondary",
          )}
        >
          All
        </button>
        {ALL_TYPES.map((t) => {
          const on = types.has(t) && !allOn;
          return (
            <button
              key={t}
              type="button"
              data-testid={`cal-type-${t}`}
              aria-pressed={on || allOn}
              onClick={() => toggle(t)}
              className={cn(
                "h-8 rounded-full px-3 text-sm font-medium",
                on ? "bg-ink text-ink-foreground" : "bg-secondary",
              )}
            >
              {TYPE_META[t].label}
              <span className="ml-1 tabular text-xs opacity-70">{typeCount(t)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-7 gap-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            {WEEKDAYS.map((d) => (
              <span key={d} className="px-1">
                {d}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const inMonth = d >= month.start && d <= month.end;
              const dayItems = inMonth ? (byDay.get(d) ?? []) : [];
              const isToday = d === today;
              return (
                <div
                  key={d}
                  className={cn(
                    "min-h-[6.5rem] rounded-md border border-transparent bg-secondary/40 p-1",
                    !inMonth && "opacity-40",
                    isToday && "border-primary/40 bg-primary/5",
                  )}
                >
                  <p className={cn("px-1 text-[11px] tabular", isToday && "font-semibold text-foreground")}>
                    {formatShortDate(d)}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {dayItems.map((it) => {
                      const meta = TYPE_META[it.type];
                      return (
                        <li key={it.key}>
                          <OpenLink
                            entityType={it.entityType}
                            id={it.id}
                            className="block min-w-0 rounded-sm px-1 py-0.5 hover:bg-card"
                            title={`${it.account} · ${meta.short}${it.wo ? ` · ${it.wo}` : ""}${it.owner ? ` · ${it.owner}` : ""}`}
                          >
                            <span className={cn("inline-block rounded px-1 text-[9px] font-medium tracking-wide uppercase", meta.className)}>
                              {meta.short}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight">{it.account}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {[it.wo, it.owner].filter(Boolean).join(" · ") || meta.label}
                            </span>
                          </OpenLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
