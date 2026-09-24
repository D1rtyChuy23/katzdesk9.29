import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  diffDays,
  formatMonthLabel,
  formatShortDate,
  monthBounds,
  todayChicago,
  weekBounds,
  WEEKDAYS,
} from "@/lib/ops/clock";
import { isClosedCall, isClosedPm } from "@/lib/ops/ticket-status";
import { isInstalled } from "@/lib/ops/install-status";
import { listInstalls, listJobs, listPms, updateInstall, updateJob, updatePm } from "@/lib/ops/api";
import { inspectionGlance } from "@/lib/ops/pre-inspection";
import type { Install, PmJob, ServiceJob } from "@/lib/ops/types";
import { mineByTechnician } from "@/lib/ops/my-view";
import { Button } from "@/components/ui/button";
import { useMyView } from "./my-view-bar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  callId: string | null;
  date: string;
  owner: string | null;
  extra?: string | null;
};

let dragItem: CalItem | null = null;

function ticketNo(it: CalItem): string | null {
  return it.wo || it.callId || null;
}

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
    if (!i.installDate || isInstalled(i)) continue;
    add({
      type: "installs",
      entityType: "install",
      id: i.id,
      account: i.customer,
      wo: i.wo,
      callId: null,
      date: i.installDate,
      owner: i.technician || i.accountRep,
      extra: inspectionGlance(i.inspection),
    });
  }
  for (const p of input.pms) {
    if (!p.projected || isClosedPm(p)) continue;
    add({
      type: "pms",
      entityType: "pm",
      id: p.id,
      account: p.customer,
      wo: p.wo,
      callId: null,
      date: p.projected,
      owner: p.technician,
    });
  }
  for (const j of input.tlcs) {
    if (!j.scheduled || isClosedCall(j)) continue;
    add({
      type: "tlcs",
      entityType: "tlc",
      id: j.id,
      account: j.customer || "Untitled",
      wo: j.wo,
      callId: j.callId,
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
      callId: j.callId,
      date: j.scheduled,
      owner: j.technician,
    });
  }
  return items;
}

export function usePlannerWork() {
  const { matchMine, filterMine, role } = useMyView();
  const installsQ = useQuery({ queryKey: ["installs"], queryFn: () => listInstalls() });
  const pmsQ = useQuery({ queryKey: ["pms"], queryFn: () => listPms() });
  const servicesQ = useQuery({
    queryKey: ["jobs", "service"],
    queryFn: () => listJobs({ data: { kind: "service" } }),
  });
  const tlcsQ = useQuery({
    queryKey: ["jobs", "tlc"],
    queryFn: () => listJobs({ data: { kind: "tlc" } }),
  });
  const installs = useMemo(() => {
    let list = installsQ.data ?? [];
    if (filterMine) list = list.filter((i) => matchMine(i.accountRep, i.technician) || i.aviKatz);
    return list;
  }, [installsQ.data, filterMine, matchMine]);
  const pms = useMemo(
    () => mineByTechnician(pmsQ.data ?? [], { filterMine, role, matchMine }),
    [pmsQ.data, filterMine, matchMine, role],
  );
  const services = useMemo(
    () => mineByTechnician(servicesQ.data ?? [], { filterMine, role, matchMine }),
    [servicesQ.data, filterMine, matchMine, role],
  );
  const tlcs = useMemo(
    () => mineByTechnician(tlcsQ.data ?? [], { filterMine, role, matchMine }),
    [tlcsQ.data, filterMine, matchMine, role],
  );
  return {
    installs,
    pms,
    services,
    tlcs,
    loading: installsQ.isLoading || pmsQ.isLoading || servicesQ.isLoading || tlcsQ.isLoading,
  };
}

function patchDate<T extends { id: number }>(rows: T[] | undefined, id: number, patch: Partial<T>) {
  if (!rows) return rows;
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

async function saveDate(item: CalItem, date: string) {
  if (item.type === "installs") {
    await updateInstall({ data: { id: item.id, installDate: date } });
    return;
  }
  if (item.type === "pms") {
    await updatePm({ data: { id: item.id, projected: date } });
    return;
  }
  await updateJob({ data: { id: item.id, scheduled: date } });
}

export function PlannerCalendar({
  installs,
  pms,
  services,
  tlcs,
  variant = "page",
}: {
  installs: Install[];
  pms: PmJob[];
  services: ServiceJob[];
  tlcs: ServiceJob[];
  variant?: "page" | "pop";
}) {
  const today = todayChicago();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState(() => monthBounds(today).start);
  const [types, setTypes] = useState<Set<CalType>>(() => new Set(ALL_TYPES));
  const [over, setOver] = useState<string | null>(null);
  const dragged = useRef(false);
  const month = monthBounds(anchor);
  const allOn = types.size === ALL_TYPES.length;
  const pop = variant === "pop";

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

  function paint(item: CalItem, date: string) {
    if (item.type === "installs") {
      qc.setQueryData<Install[]>(["installs"], (old) => patchDate(old, item.id, { installDate: date }));
    } else if (item.type === "pms") {
      qc.setQueryData<PmJob[]>(["pms"], (old) => patchDate(old, item.id, { projected: date }));
    } else {
      const kind = item.type === "tlcs" ? "tlc" : "service";
      const apply = (old?: ServiceJob[]) => patchDate(old, item.id, { scheduled: date });
      qc.setQueryData<ServiceJob[]>(["jobs", kind], apply);
      qc.setQueryData<ServiceJob[]>(["jobs"], apply);
    }
  }

  async function reschedule(item: CalItem, date: string) {
    if (item.date === date) return;
    const jump = Math.abs(diffDays(item.date, date));
    if (jump > 14) {
      const ok = window.confirm(
        `Move “${item.account}” from ${formatShortDate(item.date)} to ${formatShortDate(date)}? That’s more than 14 days.`,
      );
      if (!ok) return;
    }
    const from = item.date;
    paint(item, date);
    try {
      await saveDate(item, date);
      toast.success(`${item.account} is now ${formatShortDate(date)}`);
    } catch (err) {
      paint(item, from);
      toast.error(err instanceof Error ? err.message : "Could not reschedule");
    }
    void qc.invalidateQueries({ queryKey: ["installs"] });
    void qc.invalidateQueries({ queryKey: ["pms"] });
    void qc.invalidateQueries({ queryKey: ["jobs"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    void qc.invalidateQueries({ queryKey: ["customer-history"] });
  }

  function openItem(it: CalItem) {
    const to =
      it.entityType === "install"
        ? "/installs"
        : it.entityType === "pm"
          ? "/pms"
          : it.entityType === "tlc"
            ? "/tlc"
            : "/service";
    void navigate({ to, search: { open: it.id } });
  }

  const monthAll = items.filter((it) => it.date >= month.start && it.date <= month.end);
  const typeCount = (t: CalType) => monthAll.filter((it) => it.type === t).length;

  return (
    <section
      className={cn("min-w-0 rounded-xl border border-border bg-card", pop ? "p-3" : "p-4")}
      data-testid={pop ? "pending-calendar" : "planner-calendar"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl leading-tight">{pop ? "Pending" : "Month"}</h2>
          <p className="text-[11px] text-muted-foreground">
            {pop
              ? "Pending work only. Drag a job to another day — it stays on this window."
              : "Pending work only. Drag a job to another day to reschedule. Click to open."}
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
        {formatMonthLabel(anchor)} · {visible.length} pending
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Calendar types">
        <button
          type="button"
          data-testid={pop ? "pop-type-all" : "cal-type-all"}
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
              data-testid={pop ? `pop-type-${t}` : `cal-type-${t}`}
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
        <div className={pop ? "min-w-[22rem]" : "min-w-[44rem]"}>
          <div className="grid grid-cols-7 gap-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            {WEEKDAYS.map((d) => (
              <span key={d} className="px-1">
                {pop ? d.slice(0, 1) : d}
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
                  data-testid={`${pop ? "pop" : "planner"}-day-${d}`}
                  onDragOver={(e) => {
                    if (!dragItem) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (over !== d) setOver(d);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                    if (over === d) setOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const item = dragItem;
                    setOver(null);
                    if (!item) return;
                    void reschedule(item, d);
                  }}
                  className={cn(
                    "rounded-md border border-transparent bg-secondary/40 p-1",
                    pop ? "min-h-[4.5rem]" : "min-h-[6.5rem]",
                    !inMonth && "opacity-40",
                    isToday && "border-primary/40 bg-primary/5",
                    over === d && "border-primary bg-primary/10",
                  )}
                >
                  <p className={cn("px-1 text-[11px] tabular", isToday && "font-semibold text-foreground")}>
                    {pop ? Number(d.slice(8)) : formatShortDate(d)}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {dayItems.map((it) => {
                      const meta = TYPE_META[it.type];
                      const st = ticketNo(it);
                      return (
                        <li key={it.key}>
                          <div
                            role="button"
                            tabIndex={0}
                            draggable
                            data-testid={`${pop ? "pop" : "planner"}-item-${it.key}`}
                            title={`${it.account} · ${meta.short}${st ? ` · ${st}` : ""}${it.owner ? ` · ${it.owner}` : ""}`}
                            onDragStart={(e) => {
                              dragItem = it;
                              dragged.current = true;
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", it.key);
                            }}
                            onDragEnd={() => {
                              dragItem = null;
                              setOver(null);
                            }}
                            onClick={() => {
                              if (dragged.current) {
                                dragged.current = false;
                                return;
                              }
                              if (pop) return;
                              openItem(it);
                            }}
                            onKeyDown={(e) => {
                              if (pop) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openItem(it);
                              }
                            }}
                            className="desk-lift block min-w-0 cursor-grab rounded-sm px-1 py-0.5 text-left active:cursor-grabbing"
                          >
                            <span className={cn("inline-block rounded px-1 text-[9px] font-medium tracking-wide uppercase", meta.className)}>
                              {meta.short}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight">{it.account}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {[st, it.owner].filter(Boolean).join(" · ") || meta.label}
                            </span>
                          </div>
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
