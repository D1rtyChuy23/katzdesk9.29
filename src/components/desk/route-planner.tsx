import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MapPin as MapPinIcon, Navigation, TriangleAlert } from "lucide-react";
import { addDays, todayChicago } from "@/lib/ops/clock";
import { listTechs } from "@/lib/ops/roster";
import { milesLabel, NO_REP_COLOR, type LatLng } from "@/lib/ops/geo";
import {
  APPROX_LABEL,
  collectDayStops,
  colorOfTech,
  crewLabel,
  isApprox,
  jobKey,
  KATZ_SHOP,
  milesNote,
  placeStops,
  planAreas,
  planTechRoutes,
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
  return [n ? `${n}. ${s.customer}` : s.customer, STOP_LABEL[s.type], stopTime(s.time), crewLabel(s), isApprox(s) ? APPROX_LABEL : null].filter(Boolean).join(" · ");
}

/**
 * Planner Routes tab: the day's open work per tech in a suggested stop order (straight-line miles, promised times kept),
 * with Google Maps links, or grouped by area so a dispatcher can spot two techs in one area or unassigned work nearby.
 */
const START_PREF = "katz-desk-route-start";

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
  const geo = useGeoIndex();
  const roster = useQuery({ queryKey: ["roster"], queryFn: () => listTechs() });
  const [day, setDay] = useState(today);
  const [view, setView] = useState<"tech" | "area">("tech");
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  // Where the day starts: the phone's current location (Google Maps decides) or the shop. Remembered on this device.
  const [startFrom, setStartFrom] = useState<"here" | "shop">("here");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(START_PREF) === "shop") setStartFrom("shop");
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);
  const chooseStart = (next: "here" | "shop") => {
    setStartFrom(next);
    try {
      window.localStorage.setItem(START_PREF, next);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  };
  const start: RouteStart | null = startFrom === "shop" ? KATZ_SHOP : null;
  const mapBox = useRef<HTMLDivElement>(null);

  const rosterNames = useMemo(() => (roster.data?.techs ?? []).filter((t) => t.active).map((t) => t.name), [roster.data]);
  const dayStops = useMemo(() => collectDayStops({ installs, pms, services, tlcs }, day), [installs, pms, services, tlcs, day]);
  const { byName } = geo;
  const placed = useMemo(() => placeStops(dayStops, (customer) => byName.get(nameKey(customer))), [dayStops, byName]);
  const routes = useMemo(() => planTechRoutes(placed, rosterNames, start), [placed, rosterNames, start]);
  const colors = useMemo(() => techColors(rosterNames, routes.map((r) => r.tech)), [rosterNames, routes]);
  const areas = useMemo(() => planAreas(placed), [placed]);
  const counts = useMemo(() => typeCounts(dayStops), [dayStops]);
  const colorOf = (tech: string) => colorOfTech(colors, tech);

  const current = view === "tech" ? routes.find((r) => r.tech === selected) ?? null : null;
  const jobs = placed.filter((s) => !s.second);
  const offMap = jobs.filter((s) => s.missing).length;
  const techCount = routes.filter((r) => r.tech !== NO_TECH).length;

  const { pins, route, fitTo } = useMemo(() => {
    const out: MapPin[] = [];
    if (!current) {
      for (const s of placed) {
        if (s.second || !s.point) continue;
        out.push({ id: s.key, lat: s.point.lat, lng: s.point.lng, color: colorOfTech(colors, s.tech), hollow: isApprox(s), title: pinTitle(s) });
      }
      return { pins: out, route: undefined, fitTo: null };
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
        hollow: isApprox(s),
        size: 7,
        label: current.routed ? String(s.n) : undefined,
        title: pinTitle(s, current.routed ? s.n : undefined),
      });
    }
    const points = current.stops.map((s) => s.point);
    // Fit the view to this tech's stops; everyone else's gray dots may sit off screen.
    return { pins: out, route: current.routed && points.length > 1 ? points : undefined, fitTo: points };
  }, [placed, current, colors]);

  const anyApprox = pins.some((p) => p.hollow);
  const legendTechs = [...new Set(jobs.filter((s) => s.point).map((s) => s.tech))].sort(
    (a, b) => Number(a === NO_TECH) - Number(b === NO_TECH) || routes.findIndex((r) => r.tech === a) - routes.findIndex((r) => r.tech === b),
  );

  function open(s: PlacedStop) {
    void navigate({ to: TYPE_META[s.type].to, search: { open: s.id } });
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
            Suggested stop order by straight-line distance. Stops with a set time stay in time order. Click a stop to open it.
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
          <div ref={mapBox} className="min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:order-2 lg:self-start">
            {pins.length ? (
              <>
                <DeskMap
                  pins={pins}
                  route={route}
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
                          Numbered pins are {current.label}&rsquo;s stops in order; the dashed line is the suggested route.
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
                  {anyApprox ? <p>Hollow pins are a ZIP area (approximate), not the street address.</p> : null}
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
                    start={start}
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
  start,
}: {
  route: TechRoute;
  color: string;
  selected: boolean;
  highlight: string | null;
  onToggle: () => void;
  onOpen: (s: PlacedStop) => void;
  start: RouteStart | null;
}) {
  const total = r.stops.length + r.unrouted.length;
  // ZIP-area pins go into the link as the typed address; with no typed address the link can only reach the ZIP area.
  const approxTyped = r.stops.filter((s) => isApprox(s) && s.address).length;
  const approxBare = r.stops.filter((s) => isApprox(s) && !s.address).length;
  return (
    <section
      className={cn("rounded-lg border bg-card p-3", selected ? "border-primary ring-1 ring-primary/40" : "border-border")}
      data-testid="route-tech-card"
      data-tech={r.tech}
      data-routed={r.routed ? "true" : "false"}
      aria-label={r.label}
    >
      <header className="flex items-start gap-2">
        <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className={cn("leading-tight font-medium break-words", r.tech === NO_TECH && "text-muted-foreground")}>{r.label}</h3>
          <p className="tabular text-xs text-muted-foreground">
            {stopCount(total)}
            {r.routed && (r.stops.length > 1 || start) && r.miles > 0 ? ` · ${milesNote(r.miles)}` : ""}
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
          {r.tech === THIRD_PARTY ? "Outside contractor: stops are listed, no route is planned." : "No tech yet. Assign these on the Day tab."}
        </p>
      ) : null}

      {r.stops.length ? (
        <ol className="mt-2 divide-y divide-border" aria-label={r.routed ? `${r.label} stops in suggested order` : `${r.label} stops`}>
          {r.stops.map((s, i) => (
            <li key={s.key} id={`route-stop-${s.key}`} className="scroll-mt-4">
              <button
                type="button"
                onClick={() => onOpen(s)}
                className={cn(
                  "desk-flat flex min-h-12 w-full items-start gap-3 rounded-md px-1.5 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  highlight === s.key && "bg-primary/10",
                )}
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
                {s.legMiles != null ? (
                  <span className="tabular mt-0.5 shrink-0 text-xs text-muted-foreground" title={i === 0 && start ? "Straight-line distance from the shop" : "Straight-line distance from the previous stop"}>
                    {s.legMiles < 0.05 && s.accountId != null && r.stops[i - 1]?.accountId === s.accountId ? (
                      "Same place"
                    ) : (
                      <>
                        {milesLabel(s.legMiles)}
                        <span className="sr-only">{i === 0 && start ? " from the shop" : " from the previous stop"}</span>
                      </>
                    )}
                  </span>
                ) : null}
              </button>
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
            {start ? `Starts from ${start.label.replace(/^The /, "the ")}.` : "Starts from your current location."}
            {r.links.length > 1 ? " Google Maps takes about 10 stops per link, so each leg starts where the last one ended." : ""}
            {approxTyped ? " Stops with only a ZIP area pin go in by their typed address." : ""}
            {approxBare
              ? approxBare === 1
                ? " One stop has only a ZIP area pin and no typed address, so the link only gets you to that ZIP area."
                : ` ${approxBare} stops have only a ZIP area pin and no typed address, so the link only gets you to their ZIP areas.`
              : ""}
          </p>
        </div>
      ) : null}

      {r.unrouted.length ? <NotOnMap stops={r.unrouted} onOpen={onOpen} /> : null}
    </section>
  );
}

function StopText({ stop: s, showCrew }: { stop: PlacedStop; showCrew?: boolean }) {
  const detail = [
    s.city,
    isApprox(s) ? APPROX_LABEL : null,
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

function NotOnMap({
  stops,
  onOpen,
  colorOf,
  className,
}: {
  stops: PlacedStop[];
  onOpen: (s: PlacedStop) => void;
  /** Set in By Area: each row then names its tech. */
  colorOf?: (tech: string) => string;
  className?: string;
}) {
  return (
    <div className={cn("mt-3 rounded-lg border border-dashed border-border p-2.5", className)} data-testid="route-unrouted">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
        Not on the map ({stops.length})
      </p>
      <ul className="mt-1 divide-y divide-border">
        {stops.map((s) => (
          <li key={s.key} id={`route-stop-${s.key}`}>
            <button
              type="button"
              onClick={() => onOpen(s)}
              className="desk-flat flex min-h-11 w-full items-start gap-2 rounded-md px-1.5 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
