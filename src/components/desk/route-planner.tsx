import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MapPin as MapPinIcon, Navigation, TriangleAlert } from "lucide-react";
import { addDays, todayChicago } from "@/lib/ops/clock";
import { listTechs } from "@/lib/ops/roster";
import { updateInstall, updateJob, updatePm } from "@/lib/ops/api";
import { NO_REP_COLOR, type LatLng } from "@/lib/ops/geo";
import { driveBetween, legsFromTable, pointKey, type DriveLeg } from "@/lib/ops/drive-route";
import { driveLine, driveTable } from "@/lib/ops/drive-route-api";
import {
  collectDayStops,
  colorOfTech,
  crewLabel,
  jobKey,
  KATZ_SHOP,
  legNote,
  placeStops,
  planAreas,
  planTechRoutes,
  routable,
  routeNote,
  stopCount,
  stopTime,
  techColors,
  techLabel,
  typeCounts,
  MISSING_LABEL,
  NO_TECH,
  STOP_LABEL,
  STOP_TYPES,
  THIRD_PARTY,
  type AreaGroup,
  type PlacedStop,
  type RouteStart,
  type StopType,
  type TechRoute,
} from "@/lib/ops/route-plan";
import type { Install, PmJob, ServiceJob } from "@/lib/ops/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { FilterChip } from "./desk-charts";
import { DeskMap, type MapPin } from "./desk-map";
import { nameKey, useGeoIndex } from "./geo-data";
import { toast } from "sonner";

/** Same colors and pages as the day board. */
const TYPE_META: Record<StopType, { plural: string; to: "/service" | "/pms" | "/tlc" | "/installs"; chip: string; dot: string }> = {
  service: { plural: "Tickets", to: "/service", chip: "bg-copper/15", dot: "bg-copper" },
  pm: { plural: "PMs", to: "/pms", chip: "bg-secondary", dot: "bg-foreground/50" },
  tlc: { plural: "TLCs", to: "/tlc", chip: "bg-warning/15", dot: "bg-warning" },
  install: { plural: "Installs", to: "/installs", chip: "bg-primary/15", dot: "bg-primary" },
};

function dayTitle(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

/** Scroll motion that respects the system and the desk's own reduced-motion setting. */
function scrollBehavior(): ScrollBehavior {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
  return reduced ? "auto" : "smooth";
}

function TypeBadge({ type }: { type: StopType }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium text-foreground", TYPE_META[type].chip)}>
      <span className={cn("size-1.5 rounded-full", TYPE_META[type].dot)} aria-hidden />
      {STOP_LABEL[type]}
    </span>
  );
}

function pinTitle(s: PlacedStop, n?: number): string {
  return [n ? `${n}. ${s.customer}` : s.customer, STOP_LABEL[s.type], stopTime(s.time), crewLabel(s)].join(" · ");
}

function isFinitePoint(p: LatLng | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/**
 * Planner Routes tab: the day's open work per tech in a suggested stop order (straight-line miles, promised times kept),
 * with Google Maps links, or grouped by area so a dispatcher can spot two techs in one area or unassigned work nearby.
 */
const START_PREF = "katz-desk-route-start";
const orderKey = (day: string) => `katz-desk-route-order:${day}`;

function readOrder(day: string): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(orderKey(day));
    const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function RoutePlanner({
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
  const geo = useGeoIndex();
  const roster = useQuery({ queryKey: ["roster"], queryFn: () => listTechs() });
  const [day, setDay] = useState(today);
  const [view, setView] = useState<"tech" | "area">("tech");
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [startFrom, setStartFrom] = useState<"here" | "shop">("here");
  const [here, setHere] = useState<LatLng | null>(null);
  const [manual, setManual] = useState<Record<string, string[]>>({});
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ stop: PlacedStop; to: string; before?: string } | null>(null);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(START_PREF) === "shop") setStartFrom("shop");
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);
  useEffect(() => {
    setManual(readOrder(day));
    setUndo(null);
    setPendingMove(null);
  }, [day]);
  useEffect(() => {
    if (startFrom !== "here" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setHere(null),
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 8000 },
    );
  }, [startFrom]);
  const chooseStart = (next: "here" | "shop") => {
    setStartFrom(next);
    try {
      window.localStorage.setItem(START_PREF, next);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  };
  const saveManual = (next: Record<string, string[]>) => {
    setManual(next);
    try {
      if (Object.keys(next).length) window.localStorage.setItem(orderKey(day), JSON.stringify(next));
      else window.localStorage.removeItem(orderKey(day));
    } catch {
      /* the order still applies for this visit */
    }
  };
  const origin = startFrom === "shop" ? KATZ_SHOP.point : here;
  const start: RouteStart | null = startFrom === "shop" ? KATZ_SHOP : here ? { key: "here", label: "Current location", point: here } : null;
  const mapBox = useRef<HTMLDivElement>(null);

  const rosterNames = useMemo(() => (roster.data?.techs ?? []).filter((t) => t.active).map((t) => t.name), [roster.data]);
  const dayStops = useMemo(() => collectDayStops({ installs, pms, services, tlcs }, day), [installs, pms, services, tlcs, day]);
  const { byName } = geo;
  const placed = useMemo(() => placeStops(dayStops, (customer) => byName.get(nameKey(customer))), [dayStops, byName]);
  const driveGroups = useMemo(() => {
    const byTech = new Map<string, LatLng[]>();
    for (const s of placed) {
      // A two-tech ticket has a copy on each tech. Each copy belongs in that tech's drive table.
      if (!routable(s.tech)) continue;
      const point = s.point;
      if (!isFinitePoint(point)) continue;
      const list = byTech.get(s.tech) ?? [];
      if (!list.some((p) => pointKey(p) === pointKey(point))) list.push(point);
      byTech.set(s.tech, list);
    }
    const groups: { tech: string; points: LatLng[]; skip: boolean }[] = [];
    for (const [tech, pts] of byTech) {
      const points = origin && isFinitePoint(origin) ? [origin, ...pts.filter((p) => pointKey(p) !== pointKey(origin))] : pts;
      // One matrix per tech so a busy day is not limited by every stop in the shop sharing one request.
      groups.push({ tech, points, skip: points.length < 2 || points.length > 25 });
    }
    return groups;
  }, [placed, origin]);
  const driveAsked = driveGroups.filter((g) => !g.skip);
  const driveQs = useQueries({
    queries: driveAsked.map((g) => ({
      queryKey: ["drive-table", g.tech, g.points.map(pointKey).join("|")],
      queryFn: () => driveTable({ data: { points: g.points } }),
      staleTime: 10 * 60 * 1000,
      retry: 1,
    })),
  });
  const driveStamp = driveAsked.map((g, i) => `${g.tech}:${driveQs[i]?.data ? "ok" : driveQs[i]?.isError ? "err" : "wait"}`).join("|");
  const driveFn = useMemo(() => {
    const legs = new Map<string, DriveLeg>();
    driveAsked.forEach((g, i) => {
      const table = driveQs[i]?.data;
      if (!table) return;
      for (const [k, v] of legsFromTable(g.points, table)) legs.set(k, v);
    });
    if (!legs.size) return null;
    return (a: LatLng, b: LatLng) => driveBetween(legs, a, b);
    // driveStamp tracks which tables have arrived; the maps themselves are read from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveStamp]);
  const driveFailed = driveQs.some((q) => q.isError) || driveGroups.some((g) => g.skip && g.points.length > 25);
  const driveWaiting = driveAsked.length > 0 && driveQs.some((q) => q.isPending);
  const manualOn = Object.keys(manual).length > 0;
  const routes = useMemo(
    () => planTechRoutes(placed, rosterNames, start, { drive: driveFn, manual: manualOn ? manual : null }),
    [placed, rosterNames, start, driveFn, manual, manualOn],
  );
  const colors = useMemo(() => techColors(rosterNames, routes.map((r) => r.tech)), [rosterNames, routes]);
  const areas = useMemo(() => planAreas(placed), [placed]);
  const counts = useMemo(() => typeCounts(dayStops), [dayStops]);
  const colorOf = (tech: string) => colorOfTech(colors, tech);

  const current = view === "tech" ? routes.find((r) => r.tech === selected) ?? null : null;
  const linePoints = useMemo(() => {
    if (!current?.routed) return [] as LatLng[];
    const pts: LatLng[] = [];
    if (origin) pts.push(origin);
    for (const s of current.stops) pts.push(s.point);
    return pts;
  }, [current, origin]);
  const lineQ = useQuery({
    queryKey: ["drive-line", linePoints.map(pointKey).join("|")],
    queryFn: () => driveLine({ data: { points: linePoints } }),
    enabled: linePoints.length >= 2 && linePoints.length <= 25,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const road = lineQ.data?.line ?? null;
  const jobs = placed.filter((s) => !s.second);
  const offMap = jobs.filter((s) => s.missing).length;
  const techCount = routes.filter((r) => r.tech !== NO_TECH).length;

  const { pins, route, fitTo, onRoads } = useMemo(() => {
    const out: MapPin[] = [];
    if (!current) {
      for (const s of placed) {
        if (s.second || !s.point) continue;
        out.push({ id: s.key, lat: s.point.lat, lng: s.point.lng, color: colorOfTech(colors, s.tech), title: pinTitle(s) });
      }
      return { pins: out, route: undefined, onRoads: false, fitTo: null };
    }
    const mine = new Set(current.stops.map(jobKey));
    for (const s of placed) {
      if (s.second || !s.point || mine.has(jobKey(s))) continue;
      out.push({ id: s.key, lat: s.point.lat, lng: s.point.lng, color: NO_REP_COLOR, size: 3.5, title: pinTitle(s) });
    }
    const color = colorOfTech(colors, current.tech);
    for (const s of current.stops) {
      out.push({
        id: s.key,
        lat: s.point.lat,
        lng: s.point.lng,
        color,
        size: 7,
        label: current.routed ? String(s.n) : undefined,
        title: pinTitle(s, current.routed ? s.n : undefined),
      });
    }
    const straight = current.stops.map((s) => s.point);
    const line = road && road.length > 1 ? road : straight;
    return { pins: out, route: current.routed && line.length > 1 ? line : undefined, onRoads: !!(road && road.length > 1), fitTo: straight };
  }, [placed, current, colors, road]);

  const legendTechs = [...new Set(jobs.filter((s) => s.point).map((s) => s.tech))].sort(
    (a, b) => Number(a === NO_TECH) - Number(b === NO_TECH) || routes.findIndex((r) => r.tech === a) - routes.findIndex((r) => r.tech === b),
  );

  function open(s: PlacedStop) {
    void navigate({ to: TYPE_META[s.type].to, search: { open: s.id } });
  }

  const techChoices = useMemo(() => {
    const names = new Set(rosterNames.filter((t) => t && t !== THIRD_PARTY));
    for (const r of routes) if (r.tech && r.tech !== THIRD_PARTY) names.add(r.tech);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [rosterNames, routes]);

  async function writeTech(s: PlacedStop, to: string) {
    const tech = to === NO_TECH ? null : to;
    if (s.type === "pm") await updatePm({ data: { id: s.id, technician: tech } });
    else if (s.type === "install") await updateInstall({ data: { id: s.id, technician: tech } });
    else if (s.second) await updateJob({ data: { id: s.id, secondaryTech: tech } });
    else await updateJob({ data: { id: s.id, technician: tech } });
    void qc.invalidateQueries({ queryKey: ["installs"] });
    void qc.invalidateQueries({ queryKey: ["pms"] });
    void qc.invalidateQueries({ queryKey: ["jobs"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function patchTech(s: PlacedStop, to: string) {
    const tech = to === NO_TECH ? null : to;
    if (s.type === "pm") {
      qc.setQueryData<PmJob[]>(["pms"], (rows) => rows?.map((r) => (r.id === s.id ? { ...r, technician: tech } : r)));
    } else if (s.type === "install") {
      qc.setQueryData<Install[]>(["installs"], (rows) => rows?.map((r) => (r.id === s.id ? { ...r, technician: tech } : r)));
    } else {
      const key = ["jobs", s.type === "tlc" ? "tlc" : "service"] as const;
      qc.setQueryData<ServiceJob[]>(key, (rows) =>
        rows?.map((r) => (r.id === s.id ? (s.second ? { ...r, secondaryTech: tech } : { ...r, technician: tech }) : r)),
      );
    }
  }

  function orderOf(tech: string): string[] {
    return manual[tech] ?? routes.find((r) => r.tech === tech)?.stops.map((s) => s.key) ?? [];
  }

  async function commitMove(s: PlacedStop, toTech: string, before?: string) {
    if (s.tech === toTech && (!before || before === s.key)) return;
    const prevManual = manual;
    const fromTech = s.tech;
    const changedTech = fromTech !== toTech;
    const next: Record<string, string[]> = { ...manual };
    if (changedTech) {
      // A new tech is planned again by drive time. A drag that only reorders one list is kept below.
      delete next[fromTech];
      delete next[toTech];
      for (const [tech, keys] of Object.entries(next)) {
        const filtered = keys.filter((k) => k !== s.key);
        if (filtered.length) next[tech] = filtered;
        else delete next[tech];
      }
    } else {
      const dest = orderOf(toTech).filter((k) => k !== s.key);
      const at = before ? dest.indexOf(before) : -1;
      if (at >= 0) dest.splice(at, 0, s.key);
      else dest.push(s.key);
      next[toTech] = dest;
    }
    if (changedTech) patchTech(s, toTech);
    saveManual(next);
    try {
      if (changedTech) await writeTech(s, toTech);
      setUndo({
        label: changedTech
          ? `Moved ${STOP_LABEL[s.type]} ${s.customer} from ${techLabel(fromTech)} to ${techLabel(toTech)}.`
          : `Reordered ${s.customer} on ${techLabel(fromTech)}.`,
        run: async () => {
          if (changedTech) {
            patchTech(s, fromTech);
            await writeTech(s, fromTech);
          }
          saveManual(prevManual);
          setUndo(null);
        },
      });
    } catch (err) {
      if (changedTech) patchTech(s, fromTech);
      saveManual(prevManual);
      toast.error(err instanceof Error ? err.message : "Could not move that stop");
    }
  }

  function askMove(s: PlacedStop, toTech: string, before?: string) {
    if (s.tech === toTech && (!before || before === s.key)) return;
    if (s.tech !== toTech) {
      setPendingMove({ stop: s, to: toTech, before });
      return;
    }
    void commitMove(s, toTech, before);
  }

  function dropKey(raw: string, toTech: string, before?: string) {
    const s = placed.find((x) => x.key === raw);
    if (!s) return;
    void askMove(s, toTech, before);
  }

  /** On a phone the map sits above the list: bring it back into view when a choice changes what it shows. */
  function revealMap() {
    const el = mapBox.current;
    if (!el || !window.matchMedia("(max-width: 1023px)").matches) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }

  function toggleTech(tech: string) {
    setSelected((cur) => (cur === tech ? null : tech));
    setHighlight(null);
    revealMap();
  }

  function showArea(a: AreaGroup) {
    setFocus({ ...a.center });
    setHighlight(a.key);
    revealMap();
  }

  function onPin(pin: MapPin) {
    const s = placed.find((x) => x.key === pin.id);
    if (!s) return;
    if (view === "tech" && s.tech !== selected) setSelected(s.tech);
    setHighlight(s.key);
    document.getElementById(`route-stop-${s.key}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
  }

  const changeDay = (next: string) => {
    // The date box can hand back "" (cleared) or a half-typed year; keep the current day until it is a real date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setDay(next);
    setHighlight(null);
    setFocus(null);
  };

  const changeView = (next: "tech" | "area") => {
    setView(next);
    setHighlight(null);
    setFocus(null);
  };

  const fitKey = `${view}|${day}|${current?.tech ?? "all"}|${pins.length}`;

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4" data-testid="route-planner" data-day={day} data-view={view}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h2 className="font-display text-xl leading-tight" data-testid="route-day-title">
            {dayTitle(day)}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {manualOn
              ? "Reordered routes stay as you left them. Re-optimize to plan by drive time again."
              : driveWaiting
                ? "Checking drive times…"
                : driveFailed
                  ? "Drive times are unavailable, so this is the straight-line order. Stops with a set time stay in time order."
                  : routes.some((r) => r.drive)
                    ? "Ordered by drive time from the start. Stops with a set time stay in time order."
                    : startFrom === "here" && !here
                      ? "Location isn't available, so the order starts at the first stop. Pick The Shop to start there."
                      : "Suggested stop order by straight-line distance. Stops with a set time stay in time order."}{" "}
            Click a stop to open it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-9 w-9 px-0" onClick={() => changeDay(addDays(day, -1))} aria-label="Previous day" data-testid="route-prev">
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => changeDay(today)} data-testid="route-today">
            Today
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9 w-9 px-0" onClick={() => changeDay(addDays(day, 1))} aria-label="Next day" data-testid="route-next">
            <ChevronRight className="size-4" />
          </Button>
          <Input type="date" value={day} onChange={(e) => changeDay(e.target.value)} aria-label="Pick a day" className="h-9 w-auto" data-testid="route-date" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex gap-1.5" role="group" aria-label="Group stops">
          <FilterChip selected={view === "tech"} onClick={() => changeView("tech")} data-testid="route-view-tech">
            By Tech
          </FilterChip>
          <FilterChip selected={view === "area"} onClick={() => changeView("area")} data-testid="route-view-area">
            By Area
          </FilterChip>
        </div>
        {view === "tech" ? (
          <div className="flex items-center gap-1.5" role="group" aria-label="Start each route from">
            <span className="text-xs text-muted-foreground">Start From</span>
            <FilterChip selected={startFrom === "here"} onClick={() => chooseStart("here")} data-testid="route-start-here">
              Current Location
            </FilterChip>
            <FilterChip selected={startFrom === "shop"} onClick={() => chooseStart("shop")} data-testid="route-start-shop">
              The Shop
            </FilterChip>
            {manualOn ? (
              <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => saveManual({})} data-testid="route-reoptimize">
                Re-optimize
              </Button>
            ) : null}
          </div>
        ) : null}
        {dayStops.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Work this day">
            {STOP_TYPES.filter((t) => counts[t]).map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", TYPE_META[t].dot)} aria-hidden />
                {TYPE_META[t].plural}
                <span className="tabular text-foreground">{counts[t]}</span>
              </li>
            ))}
            <li>
              {techCount} {techCount === 1 ? "tech" : "techs"}
            </li>
            {offMap ? <li className="text-warning">{offMap} not on the map</li> : null}
          </ul>
        ) : null}
      </div>

      {geo.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : geo.isError && !geo.data ? (
        <div className="mt-4 rounded-lg border border-border p-4 text-sm" role="alert">
          {/* Only when nothing has loaded yet: a failed background refresh keeps the plan on screen. */}
          <p className="font-medium">Could not load the map pins.</p>
          <p className="mt-1 text-muted-foreground">{geo.error instanceof Error ? geo.error.message : "Something went wrong."}</p>
          <Button type="button" variant="outline" className="mt-3 h-9" onClick={() => void geo.refetch()}>
            Try Again
          </Button>
        </div>
      ) : !dayStops.length ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center" data-testid="route-empty">
          <p className="font-medium">No open work scheduled for this day</p>
          <p className="mt-1 text-sm text-muted-foreground">Work with no date yet is not shown here, and neither is finished or cancelled work.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {undo ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm lg:col-span-2" data-testid="route-undo">
              <span>{undo.label}</span>
              <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => void undo.run().catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo"))}>
                Undo
              </Button>
            </div>
          ) : null}
          {pendingMove ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm lg:col-span-2" data-testid="route-move-preview">
              <span>
                Move {STOP_LABEL[pendingMove.stop.type]} {pendingMove.stop.customer} from {techLabel(pendingMove.stop.tech)} to {techLabel(pendingMove.to)}?
              </span>
              <Button
                type="button"
                size="sm"
                className="h-9"
                data-testid="route-move-confirm"
                onClick={() => {
                  const move = pendingMove;
                  setPendingMove(null);
                  void commitMove(move.stop, move.to, move.before);
                }}
              >
                Move
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setPendingMove(null)}>
                Cancel
              </Button>
            </div>
          ) : null}
          <div ref={mapBox} className="min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:order-2 lg:self-start">
            {pins.length ? (
              <>
                <DeskMap
                  pins={pins}
                  route={route}
                  routeDashed={!onRoads}
                  selectedId={highlight}
                  onPinClick={onPin}
                  fitKey={fitKey}
                  fitTo={fitTo}
                  focus={view === "area" ? focus : null}
                  className="h-[45vh] min-h-64 lg:h-[60vh]"
                  label={current ? `Route map for ${current.label}` : "Map of the day's stops"}
                />
                <div className="mt-2 space-y-1 text-xs text-muted-foreground" data-testid="route-map-legend">
                  {current ? (
                    <p>
                      {current.routed ? (
                        <>
                          Numbered pins are {current.label}&rsquo;s stops in order;{" "}
                          {lineQ.isFetching && !onRoads
                            ? "checking the roads…"
                            : onRoads
                              ? "the line follows the roads."
                              : "the dashed line is the straight-line order."}
                        </>
                      ) : (
                        <>Pins are {current.tech === NO_TECH ? "unassigned stops" : `${current.label}’s stops`}. No route is planned for them.</>
                      )}{" "}
                      Small gray dots are everyone else&rsquo;s stops.
                    </p>
                  ) : (
                    <>
                      <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Pin colors">
                        {legendTechs.map((t) => (
                          <li key={t || "none"} className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: colorOf(t) }} aria-hidden />
                            {techLabel(t)}
                          </li>
                        ))}
                      </ul>
                      {view === "tech" ? <p>Choose Show On Map on a tech to see their route.</p> : null}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                None of this day&rsquo;s stops have a map pin yet.
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3 lg:order-1">
            {view === "tech"
              ? routes.map((r) => (
                  <TechCard
                    key={r.tech || "none"}
                    route={r}
                    color={colorOf(r.tech)}
                    selected={selected === r.tech}
                    highlight={highlight}
                    onToggle={() => toggleTech(r.tech)}
                    onOpen={open}
                    onMove={(s, to) => askMove(s, to)}
                    onDropKey={dropKey}
                    techs={techChoices}
                    start={start}
                    hold={pendingMove && pendingMove.stop.tech === r.tech ? { key: pendingMove.stop.key, to: pendingMove.to } : null}
                  />
                ))
              : (
                <>
                  {areas.areas.map((a) => (
                    <AreaCard key={a.key} area={a} colorOf={colorOf} highlight={highlight} onShow={() => showArea(a)} onOpen={open} />
                  ))}
                  {areas.unplaced.length ? <NotOnMap stops={areas.unplaced} colorOf={colorOf} onOpen={open} className="mt-0 bg-card p-3" /> : null}
                </>
              )}
          </div>
        </div>
      )}
    </section>
  );
}

function TechCard({
  route: r,
  color,
  selected,
  highlight,
  onToggle,
  onOpen,
  onMove,
  onDropKey,
  techs,
  start,
  hold,
}: {
  route: TechRoute;
  color: string;
  selected: boolean;
  highlight: string | null;
  onToggle: () => void;
  onOpen: (s: PlacedStop) => void;
  onMove: (s: PlacedStop, to: string) => void;
  onDropKey: (key: string, toTech: string, before?: string) => void;
  techs: string[];
  start: RouteStart | null;
  hold: { key: string; to: string } | null;
}) {
  const total = r.stops.length + r.unrouted.length;
  return (
    <section
      className={cn("rounded-lg border bg-card p-3", selected ? "border-primary ring-1 ring-primary/40" : "border-border")}
      data-testid="route-tech-card"
      data-tech={r.tech}
      data-routed={r.routed ? "true" : "false"}
      aria-label={r.label}
      onDragOver={(e) => {
        if (!r.routed && r.tech === THIRD_PARTY) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const key = e.dataTransfer.getData("text/plain");
        if (key) onDropKey(key, r.tech);
      }}
    >
      <header className="flex items-start gap-2">
        <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className={cn("leading-tight font-medium break-words", r.tech === NO_TECH && "text-muted-foreground")}>{r.label}</h3>
          <p className="tabular text-xs text-muted-foreground">
            {stopCount(total)}
            {r.routed && (r.stops.length > 1 || start) && r.miles > 0 ? ` · ${routeNote(r.minutes, r.miles, r.minutes != null)}` : ""}
          </p>
        </div>
        {r.stops.length ? (
          <Button
            type="button"
            size="sm"
            variant={selected ? "ink" : "outline"}
            className="h-9 shrink-0"
            aria-pressed={selected}
            aria-label={`Show On Map: ${r.label}`}
            onClick={onToggle}
            data-testid="route-show-map"
          >
            <MapPinIcon className="size-4" />
            Show On Map
          </Button>
        ) : null}
      </header>

      {!r.routed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {r.tech === THIRD_PARTY
            ? "Outside contractor: stops are listed, no route is planned."
            : "No tech yet. Choose Move to on a stop, or drag it onto a tech."}
        </p>
      ) : null}

      {r.stops.length ? (
        <ol className="mt-2 divide-y divide-border" aria-label={r.routed ? `${r.label} stops in suggested order` : `${r.label} stops`}>
          {r.stops.map((s, i) => (
            <li
              key={s.key}
              id={`route-stop-${s.key}`}
              className="scroll-mt-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const key = e.dataTransfer.getData("text/plain");
                if (key) onDropKey(key, r.tech, s.key);
              }}
            >
              <div className={cn("flex items-start gap-1", highlight === s.key && "rounded-md bg-primary/10")}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", s.key);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onOpen(s)}
                className="desk-flat flex min-h-12 min-w-0 flex-1 items-start gap-3 rounded-md px-1.5 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                data-testid="route-stop"
                data-key={s.key}
              >
                {r.routed ? (
                  <span
                    className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    <span className="sr-only">Stop </span>
                    {s.n}
                  </span>
                ) : (
                  <span className="mt-2 ml-2 size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                )}
                <StopText stop={s} />
                {s.legMiles != null || s.legMinutes != null ? (
                  <span className="tabular mt-0.5 shrink-0 text-xs text-muted-foreground" title={i === 0 && start ? "From the start" : "From the previous stop"}>
                    {s.legMiles != null && s.legMiles < 0.05 && s.accountId != null && r.stops[i - 1]?.accountId === s.accountId ? (
                      "Same place"
                    ) : (
                      <>
                        {legNote(s.legMinutes, s.legMiles)}
                        <span className="sr-only">{i === 0 && start ? " from the start" : " from the previous stop"}</span>
                      </>
                    )}
                  </span>
                ) : null}
              </button>
              <MoveToSelect stop={s} techs={techs} value={hold?.key === s.key ? hold.to : s.tech} onMove={onMove} />
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {r.routed && r.links.length ? (
        <div className="mt-2 border-t border-border pt-3">
          {r.links.length === 1 ? (
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto">
              <a href={r.links[0]} target="_blank" rel="noreferrer" data-testid="route-link">
                <Navigation className="size-4" />
                Open Route In Google Maps
              </a>
            </Button>
          ) : (
            <div>
              <p className="text-sm font-medium">Open Route In Google Maps</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.links.map((url, i) => (
                  <Button key={`leg-${i}`} asChild variant="outline" className="h-10">
                    <a href={url} target="_blank" rel="noreferrer" data-testid="route-link">
                      <Navigation className="size-4" />
                      Leg {i + 1}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {start ? `Starts from ${start.label.replace(/^The /, "the ")}.` : "Opens from the phone's current location. The stop order above starts at the first stop."}
            {r.links.length > 1 ? " Google Maps takes about 10 stops per link, so each leg starts where the last one ended." : ""}
          </p>
        </div>
      ) : null}

      {r.unrouted.length ? (
        <NotOnMap stops={r.unrouted} onOpen={onOpen} onMove={onMove} techs={techs} hold={hold} />
      ) : null}
    </section>
  );
}

function StopText({ stop: s, showCrew }: { stop: PlacedStop; showCrew?: boolean }) {
  const detail = [
    s.city,
    showCrew
      ? null
      : s.second
        ? s.partner
          ? `2nd tech with ${s.partner}`
          : "2nd tech, no main tech assigned yet"
        : s.partner
          ? `With ${s.partner} (2nd tech)`
          : null,
  ].filter(Boolean);
  return (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular text-xs font-semibold">{stopTime(s.time)}</span>
        <TypeBadge type={s.type} />
        {s.second ? (
          <Badge variant="outline" size="tight">
            2nd tech
          </Badge>
        ) : null}
      </span>
      <span className="mt-0.5 block leading-snug font-medium break-words">{s.customer}</span>
      {detail.length ? <span className="block text-xs break-words text-muted-foreground">{detail.join(" · ")}</span> : null}
    </span>
  );
}

function MoveToSelect({
  stop,
  techs,
  value,
  onMove,
}: {
  stop: PlacedStop;
  techs: string[];
  value: string;
  onMove: (s: PlacedStop, to: string) => void;
}) {
  const current = stop.tech;
  return (
    <label className="mt-1.5 flex shrink-0 flex-col items-stretch">
      <span className="px-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Move to</span>
      <select
        className="h-9 max-w-36 rounded-md border border-border bg-card px-1 text-xs"
        value={value}
        aria-label={`Move ${stop.customer} to`}
        data-testid="route-move"
        onChange={(e) => onMove(stop, e.target.value)}
      >
        {current === NO_TECH ? <option value={NO_TECH}>Unassigned</option> : null}
        {techs.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        {current !== NO_TECH ? <option value={NO_TECH}>Unassigned</option> : null}
        {current && current !== NO_TECH && !techs.includes(current) ? <option value={current}>{current}</option> : null}
        {value && value !== current && value !== NO_TECH && !techs.includes(value) ? <option value={value}>{value}</option> : null}
      </select>
    </label>
  );
}

function NotOnMap({
  stops,
  onOpen,
  colorOf,
  className,
  onMove,
  techs,
  hold,
}: {
  stops: PlacedStop[];
  onOpen: (s: PlacedStop) => void;
  /** Set in By Area: each row then names its tech. */
  colorOf?: (tech: string) => string;
  className?: string;
  onMove?: (s: PlacedStop, to: string) => void;
  techs?: string[];
  hold?: { key: string; to: string } | null;
}) {
  return (
    <div className={cn("mt-3 rounded-lg border border-dashed border-border p-2.5", className)} data-testid="route-unrouted">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
        Not on the map ({stops.length})
      </p>
      <ul className="mt-1 divide-y divide-border">
        {stops.map((s) => (
          <li key={s.key} id={`route-stop-${s.key}`} className="flex items-start gap-1">
            <button
              type="button"
              draggable={!!onMove}
              onDragStart={
                onMove
                  ? (e) => {
                      e.dataTransfer.setData("text/plain", s.key);
                      e.dataTransfer.effectAllowed = "move";
                    }
                  : undefined
              }
              onClick={() => onOpen(s)}
              className="desk-flat flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-md px-1.5 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              data-testid="route-unrouted-stop"
              data-key={s.key}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="tabular text-xs font-semibold">{stopTime(s.time)}</span>
                  <TypeBadge type={s.type} />
                  {s.second ? (
                    <Badge variant="outline" size="tight">
                      2nd tech
                    </Badge>
                  ) : null}
                </span>
                <span className="mt-0.5 block leading-snug font-medium break-words">{s.customer}</span>
                <span className="block text-xs break-words text-muted-foreground">
                  {colorOf ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ backgroundColor: colorOf(s.tech) }} aria-hidden />
                        {crewLabel(s)}
                      </span>
                      {" · "}
                    </>
                  ) : null}
                  {s.missing ? MISSING_LABEL[s.missing] : null}
                </span>
              </span>
            </button>
            {onMove && techs ? (
              <MoveToSelect stop={s} techs={techs} value={hold?.key === s.key ? hold.to : s.tech} onMove={onMove} />
            ) : null}
            {/* The account is known but has no street-address pin: its row in the Address Report. No account, no link.
                A new tab, so the Planner stays on Routes and this day while stops are fixed one after another. */}
            {s.accountId != null ? (
              <Link
                to="/address-report"
                search={{ account: s.accountId }}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Fix Address: ${s.customer} in the Address Report (opens in a new tab)`}
                data-testid="route-address-report"
              >
                Fix Address
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AreaCard({
  area: a,
  colorOf,
  highlight,
  onShow,
  onOpen,
}: {
  area: AreaGroup;
  colorOf: (tech: string) => string;
  highlight: string | null;
  onShow: () => void;
  onOpen: (s: PlacedStop) => void;
}) {
  const crowded = a.techs.length > 1;
  return (
    <section
      className={cn("rounded-lg border bg-card p-3", highlight === a.key ? "border-primary ring-1 ring-primary/40" : "border-border")}
      data-testid="route-area-card"
      data-area={a.label}
      aria-label={a.label}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="leading-tight font-medium break-words">{a.label}</h3>
          <p className="tabular text-xs text-muted-foreground">
            {stopCount(a.stops.length)}
            {a.techs.length ? ` · ${a.techs.join(", ")}` : ""}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={onShow} aria-label={`Show On Map: ${a.label}`} data-testid="route-area-show">
          <MapPinIcon className="size-4" />
          Show On Map
        </Button>
      </header>
      {crowded || a.unassigned ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {crowded ? <Badge variant="warn">{a.techs.length} techs in this area</Badge> : null}
          {a.unassigned ? <Badge variant="warn">{a.unassigned} unassigned</Badge> : null}
        </div>
      ) : null}
      <ul className="mt-2 divide-y divide-border">
        {a.stops.map((s) => (
          <li key={s.key} id={`route-stop-${s.key}`} className="scroll-mt-4">
            <button
              type="button"
              onClick={() => onOpen(s)}
              className={cn(
                "desk-flat flex min-h-12 w-full items-start gap-3 rounded-md px-1.5 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                highlight === s.key && "bg-primary/10",
              )}
              data-testid="route-area-stop"
              data-key={s.key}
            >
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(s.tech) }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-xs font-semibold break-words", s.tech === NO_TECH && "text-warning")}>{crewLabel(s)}</span>
                <StopText stop={s} showCrew />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
