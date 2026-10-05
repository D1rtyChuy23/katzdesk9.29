import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { addDays, formatShortDate, todayChicago, weekBounds, WEEKDAYS } from "@/lib/ops/clock";
import { moveBoardBlock } from "@/lib/ops/api";
import { listTechs } from "@/lib/ops/roster";
import { canonicalTechName } from "@/lib/ops/tech-match";
import { isClosedCall, isClosedPm } from "@/lib/ops/ticket-status";
import { isInstalled } from "@/lib/ops/install-status";
import { BOARD_HOURS, boardMove, dropTime, hourColumn, hourLabel, timeLabel, type BoardType } from "@/lib/ops/day-board";
import type { Install, PmJob, ServiceJob } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { FilterChip } from "./desk-charts";
import { cn } from "@/lib/utils";

type Block = {
  key: string;
  type: BoardType;
  id: number;
  account: string;
  ticket: string | null;
  date: string;
  time: string | null;
  tech: string | null;
  locked: boolean;
  state: string;
  /** Second tech on a ticket. The block is also shown on that tech's row. */
  second?: string | null;
  /** This block is the copy on the secondary tech's row: it opens the ticket but is moved from the primary's row. */
  shadow?: boolean;
};

const TYPES: BoardType[] = ["service", "pm", "tlc", "install"];
const META: Record<BoardType, { label: string; plural: string; to: "/service" | "/pms" | "/tlc" | "/installs"; block: string; dot: string }> = {
  service: { label: "Ticket", plural: "Tickets", to: "/service", block: "border-l-copper bg-copper/15", dot: "bg-copper" },
  pm: { label: "PM", plural: "PMs", to: "/pms", block: "border-l-foreground/50 bg-secondary", dot: "bg-foreground/50" },
  tlc: { label: "TLC", plural: "TLCs", to: "/tlc", block: "border-l-warning bg-warning/15", dot: "bg-warning" },
  install: { label: "Install", plural: "Installs", to: "/installs", block: "border-l-primary bg-primary/15", dot: "bg-primary" },
};

const NO_TECH = "";
const techKey = (name: string | null | undefined) => (name && name.trim() ? canonicalTechName(name) ?? name.trim() : NO_TECH);

function collect(input: { installs: Install[]; pms: PmJob[]; services: ServiceJob[]; tlcs: ServiceJob[] }): Block[] {
  const out: Block[] = [];
  const job = (j: ServiceJob, type: "service" | "tlc") => {
    if (!j.scheduled) return;
    out.push({
      key: `${type}-${j.id}`,
      type,
      id: j.id,
      account: j.customer || "Untitled",
      ticket: j.wo || j.callId || null,
      date: j.scheduled,
      time: j.scheduledTime,
      tech: j.technician,
      locked: isClosedCall(j),
      state: j.status,
      second: j.secondaryTech,
    });
  };
  for (const j of input.services) job(j, "service");
  for (const j of input.tlcs) job(j, "tlc");
  for (const p of input.pms) {
    if (!p.projected) continue;
    out.push({ key: `pm-${p.id}`, type: "pm", id: p.id, account: p.customer, ticket: p.wo, date: p.projected, time: p.scheduledTime, tech: p.technician, locked: isClosedPm(p), state: p.status });
  }
  for (const i of input.installs) {
    if (!i.installDate) continue;
    const done = isInstalled(i);
    out.push({ key: `install-${i.id}`, type: "install", id: i.id, account: i.customer, ticket: i.wo, date: i.installDate, time: i.scheduledTime, tech: i.technician, locked: done, state: done ? "Installed" : i.equipStatus || "Scheduled" });
  }
  return out;
}

function dayTitle(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

type Target = { tech: string; date: string; time: string | null; cell: string };

/**
 * Dispatch board. Day: one row per service tech, one column per hour. Week: one column per day.
 * Drag a block to another time or tech; the drop saves the scheduled time and the assigned tech.
 */
export function DayBoard({
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roster = useQuery({ queryKey: ["roster"], queryFn: () => listTechs() });
  const [day, setDay] = useState(today);
  const [span, setSpan] = useState<"day" | "week">("day");
  const [moved, setMoved] = useState<Record<string, { date: string; time: string | null; tech: string | null }>>({});
  const [ghost, setGhost] = useState<{ block: Block; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const drag = useRef<{ block: Block; x: number; y: number; active: boolean } | null>(null);
  const skipClick = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const edge = useRef<{ timer: number; dx: number; x: number; y: number } | null>(null);

  /** While a block is held near the left or right edge, the hours slide under it — later hours are reachable on a phone. */
  function edgeScroll(x: number, y: number) {
    const box = scroller.current?.getBoundingClientRect();
    if (!box) return;
    const dx = x > box.right - 44 ? 14 : x < box.left + 164 && x > box.left ? -14 : 0;
    if (!dx) return stopEdge();
    if (edge.current) {
      Object.assign(edge.current, { dx, x, y });
      return;
    }
    const timer = window.setInterval(() => {
      const e = edge.current;
      if (!e || !scroller.current) return;
      scroller.current.scrollLeft += e.dx;
      setOver(targetAt(e.x, e.y)?.cell ?? null);
    }, 16);
    edge.current = { timer, dx, x, y };
  }
  function stopEdge() {
    if (edge.current) window.clearInterval(edge.current.timer);
    edge.current = null;
  }

  const week = weekBounds(day);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week.start, i)), [week.start]);

  const blocks = useMemo(
    () =>
      collect({ installs, pms, services, tlcs }).map((b) => {
        const m = moved[b.key];
        return m ? { ...b, date: m.date, time: m.time, tech: m.tech } : b;
      }),
    [installs, pms, services, tlcs, moved],
  );
  const shown = useMemo(
    () => blocks.filter((b) => (span === "day" ? b.date === day : b.date >= week.start && b.date <= week.end)),
    [blocks, span, day, week.start, week.end],
  );

  // Rows: no tech yet, then the active roster in its own order, then anyone else who has work in view.
  const rows = useMemo(() => {
    const names = (roster.data?.techs ?? []).filter((t) => t.active).map((t) => t.name);
    const extra = [...new Set(shown.flatMap((b) => [techKey(b.tech), techKey(b.second)]))].filter((n) => n !== NO_TECH && !names.includes(n)).sort();
    return [NO_TECH, ...names, ...extra];
  }, [roster.data, shown]);

  const cellKey = (tech: string, col: string) => `${tech}|${col}`;
  const byCell = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const b of shown) {
      const col = span === "day" ? String(hourColumn(b.time) ?? "none") : b.date;
      const key = cellKey(techKey(b.tech), col);
      map.set(key, [...(map.get(key) ?? []), b]);
      // A ticket with a secondary tech shows on both rows.
      const second = techKey(b.second);
      if (second !== NO_TECH && second !== techKey(b.tech)) {
        const k2 = cellKey(second, col);
        map.set(k2, [...(map.get(k2) ?? []), { ...b, key: `${b.key}-2nd`, shadow: true }]);
      }
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.account.localeCompare(b.account));
    return map;
  }, [shown, span]);

  function targetAt(x: number, y: number): Target | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-board-cell]");
    if (!el) return null;
    const tech = el.dataset.tech ?? NO_TECH;
    const cell = el.dataset.boardCell!;
    if (el.dataset.date) return { tech, date: el.dataset.date, time: drag.current?.block.time ?? null, cell };
    if (el.dataset.hour === "none") return { tech, date: day, time: null, cell };
    const box = el.getBoundingClientRect();
    return { tech, date: day, time: dropTime(Number(el.dataset.hour), (x - box.left) / box.width), cell };
  }

  async function drop(block: Block, to: Target) {
    const change = boardMove({ date: block.date, time: block.time, technician: techKey(block.tech) || null }, { date: to.date, time: to.time, technician: to.tech || null });
    if (!change) return;
    setMoved((m) => ({ ...m, [block.key]: { date: change.date, time: change.time, tech: change.technician } }));
    try {
      await moveBoardBlock({ data: { type: block.type, id: block.id, date: change.date, time: change.time, technician: change.technician } });
      toast.success(`${block.account}: ${[span === "week" || change.date !== block.date ? formatShortDate(change.date) : "", timeLabel(change.time) || "no time", change.technician ?? "no tech"].filter(Boolean).join(" · ")}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["jobs"] }),
        qc.invalidateQueries({ queryKey: ["pms"] }),
        qc.invalidateQueries({ queryKey: ["installs"] }),
      ]);
      void qc.invalidateQueries({ queryKey: ["job"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move it");
    } finally {
      setMoved((m) => {
        const next = { ...m };
        delete next[block.key];
        return next;
      });
    }
  }

  function endDrag() {
    stopEdge();
    drag.current = null;
    setGhost(null);
    setOver(null);
  }

  function open(b: Block) {
    void navigate({ to: META[b.type].to, search: { open: b.id } });
  }

  const step = span === "day" ? 1 : 7;
  const counts = (t: BoardType) => shown.filter((b) => b.type === t).length;
  const columns = span === "day" ? ["none", ...BOARD_HOURS.map(String)] : days;

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-4" data-testid="day-board" data-span={span} data-day={day}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h2 className="font-display text-xl leading-tight" data-testid="day-board-title">
            {span === "day" ? dayTitle(day) : `Week Of ${formatShortDate(week.start)} – ${formatShortDate(week.end)}`}
          </h2>
          <p className="text-[11px] text-muted-foreground">Drag a block to another time or tech. Click a block to open it. Completed and cancelled work does not move.</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Board span">
          <FilterChip selected={span === "day"} onClick={() => setSpan("day")} data-testid="board-span-day">
            Day
          </FilterChip>
          <FilterChip selected={span === "week"} onClick={() => setSpan("week")} data-testid="board-span-week">
            Week
          </FilterChip>
        </div>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => setDay(addDays(day, -step))} aria-label={span === "day" ? "Previous day" : "Previous week"} data-testid="board-prev">
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDay(today)} data-testid="board-today">
            Today
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDay(addDays(day, step))} aria-label={span === "day" ? "Next day" : "Next week"} data-testid="board-next">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Block colors">
        {TYPES.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", META[t].dot)} aria-hidden />
            {META[t].plural}
            <span className="tabular text-foreground">{counts(t)}</span>
          </li>
        ))}
      </ul>

      <div ref={scroller} className="mt-3 overflow-x-auto rounded-lg border border-border" data-testid="day-board-scroll">
        <div
          className="grid text-sm"
          style={{
            gridTemplateColumns: span === "day" ? `7.5rem 6rem repeat(${BOARD_HOURS.length}, minmax(5rem, 1fr))` : "7.5rem repeat(7, minmax(8rem, 1fr))",
            minWidth: span === "day" ? `${7.5 + 6 + BOARD_HOURS.length * 5}rem` : "63.5rem",
          }}
          role="grid"
          aria-label={span === "day" ? `Schedule for ${dayTitle(day)}` : "Schedule for the week"}
        >
          <div className="sticky left-0 z-10 border-b border-border bg-card px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase" role="columnheader">
            Tech
          </div>
          {columns.map((c, i) => (
            <div
              key={c}
              role="columnheader"
              className={cn(
                "border-b border-l border-border bg-card px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
                span === "week" && c === today && "text-foreground",
              )}
            >
              {span === "day" ? (c === "none" ? "No Time" : hourLabel(Number(c))) : `${WEEKDAYS[i]} ${formatShortDate(c)}`}
            </div>
          ))}

          {rows.map((tech) => (
            <div key={tech || "none"} className="contents" role="row" data-testid="board-row" data-tech={tech}>
              <div className="sticky left-0 z-10 flex min-h-16 items-center border-b border-border bg-card px-2 py-1.5 text-sm font-medium" role="rowheader">
                <span className={cn("min-w-0 break-words", !tech && "text-muted-foreground")}>{tech || "Unassigned"}</span>
              </div>
              {columns.map((c) => {
                const key = cellKey(tech, c);
                const list = byCell.get(key) ?? [];
                return (
                  <div
                    key={c}
                    role="gridcell"
                    data-board-cell={key}
                    data-tech={tech}
                    {...(span === "day" ? { "data-hour": c } : { "data-date": c })}
                    data-testid={`board-cell-${tech || "none"}-${c}`}
                    className={cn(
                      "flex min-h-16 flex-col gap-1 border-b border-l border-border p-1",
                      span === "week" && c === today && "bg-primary/5",
                      span === "day" && c === "none" && "bg-secondary/40",
                      over === key && "bg-primary/15 outline outline-1 -outline-offset-1 outline-primary",
                    )}
                  >
                    {list.map((b) => (
                      <div
                        key={b.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${b.account}, ${META[b.type].label}${b.time ? `, ${timeLabel(b.time)}` : ""}${b.locked ? `, ${b.state}, does not move` : ""}`}
                        title={[b.account, META[b.type].label, b.ticket, timeLabel(b.time), b.state].filter(Boolean).join(" · ")}
                        data-testid={`board-block-${b.key}`}
                        data-locked={b.locked ? "true" : "false"}
                        data-shadow={b.shadow ? "true" : "false"}
                        data-time={b.time ?? ""}
                        className={cn(
                          "desk-flat min-w-0 rounded-md border-l-[3px] px-1.5 py-1 text-left select-none",
                          META[b.type].block,
                          b.shadow && "border border-dashed border-border",
                          b.locked ? "cursor-pointer opacity-55" : b.shadow ? "cursor-pointer" : "cursor-grab touch-none active:cursor-grabbing",
                          ghost?.block.key === b.key && "opacity-40",
                        )}
                        onPointerDown={(e) => {
                          if (b.locked || b.shadow || e.button !== 0) return;
                          drag.current = { block: b, x: e.clientX, y: e.clientY, active: false };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          const d = drag.current;
                          if (!d) return;
                          if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
                          d.active = true;
                          setGhost({ block: d.block, x: e.clientX, y: e.clientY });
                          setOver(targetAt(e.clientX, e.clientY)?.cell ?? null);
                          edgeScroll(e.clientX, e.clientY);
                        }}
                        onPointerUp={(e) => {
                          const d = drag.current;
                          if (!d) return;
                          const to = d.active ? targetAt(e.clientX, e.clientY) : null;
                          skipClick.current = d.active;
                          endDrag();
                          if (to) void drop(d.block, to);
                        }}
                        onPointerCancel={endDrag}
                        onClick={() => {
                          if (skipClick.current) {
                            skipClick.current = false;
                            return;
                          }
                          open(b);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open(b);
                          }
                        }}
                      >
                        <span className="line-clamp-2 text-xs leading-tight font-medium break-words">{b.account}</span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                          {b.locked ? <Lock className="size-3 shrink-0" aria-hidden /> : null}
                          {(b.locked ? [b.state, timeLabel(b.time)] : b.shadow ? [timeLabel(b.time), `2nd with ${b.tech ?? "no primary"}`] : [timeLabel(b.time), META[b.type].label, b.second ? `+ ${b.second}` : b.ticket]).filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!shown.length ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="day-board-empty">
          Nothing is scheduled for {span === "day" ? "this day" : "this week"}.
        </p>
      ) : null}

      {ghost ? (
        <div
          aria-hidden
          className={cn("pointer-events-none fixed z-[2147483000] w-36 rounded-md border-l-[3px] px-1.5 py-1 shadow-[var(--shadow-lift)]", META[ghost.block.type].block, "bg-card")}
          style={{ left: ghost.x + 8, top: ghost.y + 8 }}
        >
          <span className="line-clamp-2 text-xs leading-tight font-medium">{ghost.block.account}</span>
        </div>
      ) : null}
    </section>
  );
}
