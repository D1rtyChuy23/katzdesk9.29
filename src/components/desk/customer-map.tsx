import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useFromHere } from "@/lib/ops/search-params";
import { useQuery } from "@tanstack/react-query";
import { Globe, MapPinOff, Navigation, RotateCcw, Store, X } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { DeskMap, type MapPin } from "./desk-map";
import { needsAttention, openWork, pointOf, scrollUnderHeader, useGeoIndex } from "./geo-data";
import { FilterChip } from "./desk-charts";
import { ListToolbar, ToolbarSearch, TOOLBAR_SELECT } from "./list-toolbar";
import { RepFilter, RepName } from "./rep-select";
import { AkBadge, NoRepFlag } from "./ak-badge";
import { ShowMoreButton, useShowMore } from "./show-more";
import { useMyView } from "./my-view-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/separator";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPES,
  accountType,
  canDriveTo,
  directionsUrl,
  NO_REP_COLOR,
  type AccountType,
  type LatLng,
  type PinQuality,
} from "@/lib/ops/geo";
import type { AccountGeo } from "@/lib/ops/geo-api";
import { listProviderGeo, MAX_PROVIDER_PINS, PROVIDER_GEO_KEY, type ProviderGeo } from "@/lib/ops/provider-geo-api";
import { firstEmail, statusTone, telHref, websiteHref, websiteLabel } from "@/lib/ops/network";
import { formatLongDate } from "@/lib/ops/clock";
import { cn } from "@/lib/utils";

type ColorBy = "rep" | "work" | "pms" | "type";

const COLOR_BY: { id: ColorBy; label: string }[] = [
  { id: "rep", label: "Rep" },
  { id: "work", label: "Open Work" },
  { id: "pms", label: "PMs Due" },
  { id: "type", label: "Type" },
];

/** What the map shows: account pins, service provider diamonds, or both (the default). */
type MapShow = "customers" | "providers" | "both";

const SHOW_OPTIONS: { id: MapShow; label: string; testId: string }[] = [
  { id: "customers", label: "Customers", testId: "map-show-customers" },
  { id: "providers", label: "Service Providers", testId: "map-providers" },
  { id: "both", label: "Both", testId: "map-show-both" },
];

const isMapShow = (v: unknown): v is MapShow => v === "customers" || v === "providers" || v === "both";

/** The Show choice is remembered per viewer on this device. */
const showKey = (userId: string) => `katz-desk-map-show:${userId}`;

/**
 * Type mode colors, per theme, as CSS variables set on the map's root (TYPE_COLOR_VARS). Light: blue #1d4ed8, gold
 * #a16207, teal #0f766e (5.9, 4.3 and 4.8:1 on the muted map surface #f4f0e9). Dark: #60a5fa, #facc15, #14b8a6
 * (5.7, 9.5 and 5.9:1 on #2e2822). Blue, gold and teal stay apart for red-green color blindness too, none of them
 * reads as the past-due red, and none is the near-black (cream in dark mode) of the service provider diamonds.
 */
const TYPE_COLOR: Record<AccountType, string> = {
  customer: "var(--map-type-customer)",
  oon: "var(--map-type-oon)",
  ak: "var(--map-type-ak)",
};
const TYPE_COLOR_VARS =
  "[--map-type-customer:#1d4ed8] [--map-type-oon:#a16207] [--map-type-ak:#0f766e] dark:[--map-type-customer:#60a5fa] dark:[--map-type-oon:#facc15] dark:[--map-type-ak:#14b8a6]";
/** Type mode draw order: the fewer out-of-network and Avi Katz pins sit on top of the Katz-serviced ones. */
const TYPE_RANK: Record<AccountType, number> = { customer: 0, ak: 1, oon: 2 };

const HOLLOW_KEY: LegendItem = { key: "approx", label: "Hollow: ZIP area (approximate)", color: "var(--color-muted-foreground)", hollow: true };

/** Pin colors for the work and PM modes (rep colors come from the shared palette). */
const RED = "#b3261e";
const AMBER = "#a3580b";
const BLUE = "#2563eb";
const GRAY = "#a8a29e";

const MAP_HEIGHT = "h-[55vh] min-h-72 lg:h-[calc(100vh-14rem)] lg:min-h-[28rem]";
const LIST_STEP = 50;

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** Something on the account is late: a ticket past its date or a PM past due. */
const isPastDue = (a: AccountGeo) => a.pastDueCalls > 0 || a.pmsPastDue > 0;

/** List order: past due first, then anything needing attention, then the rest; by name within each. */
const attentionRank = (a: AccountGeo) => (isPastDue(a) ? 0 : needsAttention(a) ? 1 : 2);

/** Work mode: 2 = past due (red), 1 = open work or PM due soon (amber), 0 = nothing open (gray). */
function workTone(a: AccountGeo): 0 | 1 | 2 {
  if (isPastDue(a)) return 2;
  if (openWork(a) > 0 || a.pmsDueSoon > 0) return 1;
  return 0;
}

/** PM mode: 3 = PM past due, 2 = due soon, 1 = open PM later or with no date, 0 = no open PM. */
function pmTone(a: AccountGeo): 0 | 1 | 2 | 3 {
  if (a.pmsPastDue > 0) return 3;
  if (a.pmsDueSoon > 0) return 2;
  if (a.openPms > 0) return 1;
  return 0;
}

/**
 * Out of Network service providers: diamonds in the page's ink color (near-black, cream in dark mode), a color no rep
 * and no work or PM tone uses.
 */
export const PROVIDER_COLOR = "var(--color-foreground)";

const providerPinId = (addressId: number) => `provider-${addressId}`;

const WORK_COLOR = [GRAY, AMBER, RED] as const;
const PM_COLOR = [GRAY, BLUE, AMBER, RED] as const;

/** Pin color for an account, and a draw rank so the pins that matter sit on top. */
function paint(a: AccountGeo, mode: ColorBy, colorOf: (rep: string | null) => string): { color: string; rank: number } {
  if (mode === "work") {
    const t = workTone(a);
    return { color: WORK_COLOR[t], rank: t };
  }
  if (mode === "pms") {
    const t = pmTone(a);
    return { color: PM_COLOR[t], rank: t };
  }
  if (mode === "type") {
    const t = accountType(a);
    return { color: TYPE_COLOR[t], rank: TYPE_RANK[t] };
  }
  return a.rep ? { color: colorOf(a.rep), rank: 1 } : { color: NO_REP_COLOR, rank: 0 };
}

const KEEP_UPPER = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "FM", "US", "SH", "IH", "CR", "PO"]);

/** The geocoder's upper-case match ("4444 WESTHEIMER RD, HOUSTON, TX, 77027") in normal case. */
function properCase(address: string): string {
  return address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      /^[A-Z]{2}$/.test(part)
        ? part
        : part
            .toLowerCase()
            .replace(/\b[a-z][a-z'’]*/g, (w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
            .replace(/\bMc([a-z])/g, (_, c: string) => `Mc${c.toUpperCase()}`),
    )
    .join(", ");
}

/** The address to show: the typed one, else the geocoder's match. */
function shownAddress(a: AccountGeo): string | null {
  if (a.address) return a.address;
  return a.geocodeAddress ? properCase(a.geocodeAddress) : null;
}

const QUALITY_LABEL: Record<PinQuality, string> = {
  exact: "Exact pin",
  close: "Close match, check the pin",
  approx: "ZIP area (approximate)",
};

/** A legend dot or a list-row dot. Hollow = approximate (ZIP area) pin, like on the map. A diamond marks a provider. */
export function Swatch({ color, hollow, shape, className }: { color: string; hollow?: boolean; shape?: "circle" | "diamond"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", shape === "diamond" ? "mx-px size-2 rotate-45 rounded-[1px]" : "size-2.5 rounded-full", className)}
      style={hollow ? { border: `2px dashed ${color}` } : { backgroundColor: color }}
    />
  );
}

export type LegendItem = { key: string; label: string; color: string; hollow?: boolean; shape?: "circle" | "diamond"; count?: number };

/** The map key: one dot per color in use, with how many pins carry it. */
export function MapLegend({ items, className, testId = "map-legend" }: { items: LegendItem[]; className?: string; testId?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)} aria-label="Map key" data-testid={testId}>
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          <Swatch color={i.color} hollow={i.hollow} shape={i.shape} />
          <span>{i.label}</span>
          {i.count != null ? <span className="tabular font-medium text-foreground">{i.count.toLocaleString("en-US")}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Short work summary for a list row ("2 past due · 5 open"), with its tone. */
function rowWork(a: AccountGeo): { text: string; tone: "danger" | "warn" } | null {
  const late = a.pastDueCalls + a.pmsPastDue;
  const open = openWork(a);
  const bits = [
    late ? `${late} past due` : null,
    a.pmsDueSoon ? plural(a.pmsDueSoon, "PM due soon", "PMs due soon") : null,
    open ? `${open} open` : null,
  ].filter(Boolean);
  if (!bits.length) return null;
  return { text: bits.join(" · "), tone: late ? "danger" : "warn" };
}

/**
 * The Accounts tab of the Map page: every account with a pin, colored by rep, open work, PMs due or account type, and
 * the Out of Network service providers as diamonds (Show: Customers, Service Providers or Both), with a side panel
 * that shows the picked pin and a list of the filtered accounts (needs attention first) or providers (A to Z).
 */
export function CustomerMap({
  accountId = null,
  onSelectAccount,
}: {
  /** From `/map?account=`. A list click must not open Customers. */
  accountId?: number | null;
  onSelectAccount?: (id: number | null) => void;
} = {}) {
  const geo = useGeoIndex();
  const { filterMine, matchMine, role } = useMyView();
  const scoped = filterMine && role === "sales";
  const userId = useCurrentUser()?.id ?? "desk";

  const [q, setQ] = useState("");
  const needle = useDeferredValue(q.trim().toLowerCase());
  const [colorBy, setColorBy] = useState<ColorBy>("rep");
  const [rep, setRep] = useState("");
  const [attention, setAttention] = useState(false);
  const [showApprox, setShowApprox] = useState(true);
  // Both until this viewer's saved choice is read (after mount, so the server render and the first client one match).
  const [show, setShow] = useState<MapShow>("both");
  /** Which list the side panel shows when both layers are on the map. */
  const [listTab, setListTab] = useState<"accounts" | "providers">("accounts");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /** The picked service provider pin (its address id); a provider and an account are never picked together. */
  const [providerPick, setProviderPick] = useState<number | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const panelBox = useRef<HTMLElement>(null);
  const listPane = useRef<HTMLDivElement>(null);
  /** Last account written to the URL, so a list click does not scroll the list again when the URL catches up. */
  const appliedAccount = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(showKey(userId));
      setShow(isMapShow(saved) ? saved : "both");
    } catch {
      /* storage blocked: keep Both */
    }
  }, [userId]);

  function chooseShow(next: MapShow) {
    setShow(next);
    if (next === "customers") setProviderPick(null);
    if (next === "providers") setSelectedId(null);
    try {
      window.localStorage.setItem(showKey(userId), next);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  }

  const showAccounts = show !== "providers";
  const showProviders = show !== "customers";

  const { accounts, byId, colorOf } = geo;
  const data = geo.data;

  // A refresh or Back with `?account=` selects that account without touching filters. A list click sets
  // `appliedAccount` first, so this does not move the list when the URL catches up.
  useEffect(() => {
    if (!data) return;
    if (accountId == null) {
      if (appliedAccount.current != null) {
        appliedAccount.current = null;
        setSelectedId(null);
      }
      return;
    }
    if (appliedAccount.current === accountId) return;
    const a = byId.get(accountId);
    if (!a) return;
    appliedAccount.current = accountId;
    setProviderPick(null);
    setSelectedId(a.id);
    const p = pointOf(a);
    if (p) setFocus({ lat: p.lat, lng: p.lng });
    const row = listPane.current?.querySelector<HTMLElement>(`[data-map-account="${a.id}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [accountId, data, byId]);

  // Out of Network service providers with a pinned address: their own layer. The account filters never touch it; the
  // search box searches it (name or address) only when the map shows service providers alone.
  const providerGeo = useQuery({ queryKey: PROVIDER_GEO_KEY, queryFn: () => listProviderGeo(), staleTime: 2 * 60_000 });
  const providerRows = providerGeo.data?.providers;
  const providerByPin = useMemo(() => new Map((providerRows ?? []).map((p) => [providerPinId(p.addressId), p])), [providerRows]);
  const providerMatches = useMemo(() => {
    if (!providerRows) return [];
    if (show !== "providers" || !needle) return providerRows;
    return providerRows.filter((p) => p.name.toLowerCase().includes(needle) || p.address.toLowerCase().includes(needle));
  }, [providerRows, show, needle]);
  const providerPins = useMemo<MapPin[]>(() => {
    if (!showProviders || !providerRows) return [];
    // "ZIP Area Pins" off hides every ZIP-area pin, providers' too. The picked one always stays, like a picked account.
    const matching = new Set(providerMatches.map((p) => p.addressId));
    const shown = providerRows.filter((p) => p.addressId === providerPick || (matching.has(p.addressId) && (showApprox || p.quality !== "approx")));
    return shown.map((p) => ({
      id: providerPinId(p.addressId),
      lat: p.lat,
      lng: p.lng,
      color: PROVIDER_COLOR,
      shape: "diamond" as const,
      hollow: p.quality === "approx",
      size: 7,
      title: `${p.name} · Service provider${p.quality === "approx" ? " · ZIP area (approximate)" : ""}`,
    }));
  }, [providerRows, providerMatches, showProviders, showApprox, providerPick]);
  // Providers on the map for the counts and the key. providers: a provider with two pinned locations counts once.
  // locations: the diamonds drawn, which the key counts (a picked pin kept on the map only because it is picked does
  // not count, like a picked account). listed / rows: providers and location rows in the side list (one row per
  // pinned location, ZIP area ones included).
  const providerStats = useMemo(() => {
    const shown = showApprox ? providerMatches : providerMatches.filter((p) => p.quality !== "approx");
    return {
      providers: new Set(shown.map((p) => p.providerId)).size,
      locations: shown.length,
      approxHidden: providerMatches.length - shown.length,
      listed: new Set(providerMatches.map((p) => p.providerId)).size,
      rows: providerMatches.length,
    };
  }, [providerMatches, showApprox]);
  const providerCount = providerStats.providers;
  const selectedProvider = showProviders && providerPick != null ? providerByPin.get(providerPinId(providerPick)) ?? null : null;

  // Filters that decide which accounts are in play (the list and the pins). Color mode is not one of them.
  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (scoped && !(a.aviKatz || matchMine(a.rep))) return false;
      if (rep === "__none__" ? !!a.rep : rep && a.rep !== rep) return false;
      if (attention && !needsAttention(a)) return false;
      if (needle && !a.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [accounts, scoped, matchMine, rep, attention, needle]);

  const counts = useMemo(() => {
    let pinned = 0;
    let approx = 0;
    for (const a of filtered) {
      if (a.lat == null || a.lng == null) continue;
      pinned += 1;
      if (a.quality === "approx") approx += 1;
    }
    return { pinned, approx, noPin: filtered.length - pinned };
  }, [filtered]);

  // Pins: rebuilt only when the filtered set, the color mode or the ZIP toggle changes (not on selection).
  const basePins = useMemo(() => {
    const out: (MapPin & { rank: number })[] = [];
    if (!showAccounts) return out;
    for (const a of filtered) {
      const p = pointOf(a);
      if (!p) continue;
      const approx = a.quality === "approx";
      if (approx && !showApprox) continue;
      const { color, rank } = paint(a, colorBy, colorOf);
      out.push({
        id: a.id,
        lat: p.lat,
        lng: p.lng,
        color,
        rank,
        hollow: approx,
        // Nothing open (gray) is drawn a little smaller in the work and PM modes.
        size: rank === 0 && (colorBy === "work" || colorBy === "pms") ? 5 : 6,
        title: `${a.name}${a.city ? ` · ${a.city}` : ""}${colorBy === "type" ? ` · ${ACCOUNT_TYPE_LABEL[accountType(a)]}` : ""}${approx ? " · ZIP area (approximate)" : ""}`,
      });
    }
    // Lower ranks first so red / amber pins draw over gray ones.
    out.sort((x, y) => x.rank - y.rank);
    return out;
  }, [filtered, colorBy, colorOf, showApprox, showAccounts]);

  const selected = showAccounts && selectedId != null ? byId.get(selectedId) ?? null : null;

  // The picked account always shows on the map, even when the ZIP area pins are hidden or a filter left it out.
  const pins = useMemo(() => {
    if (!selected || basePins.some((p) => p.id === selected.id)) return basePins;
    const p = pointOf(selected);
    if (!p) return basePins;
    const { color } = paint(selected, colorBy, colorOf);
    return [...basePins, { id: selected.id, lat: p.lat, lng: p.lng, color, hollow: selected.quality === "approx", title: selected.name }];
  }, [basePins, selected, colorBy, colorOf]);

  // Provider diamonds draw over the account dots. With accounts on the map the view fits the accounts only, so showing
  // both never zooms the map out to every state the providers cover; with no account pins left (a search that matches
  // nothing) it shows the default view. Service Providers alone fits the providers.
  const mapPins = useMemo(() => (providerPins.length ? [...pins, ...providerPins] : pins), [pins, providerPins]);
  const fitTo = useMemo(() => (showAccounts ? pins : providerPins).map((p) => ({ lat: p.lat, lng: p.lng })), [showAccounts, pins, providerPins]);

  const legend = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [];
    if (!basePins.length) return items;
    if (colorBy === "type") {
      const n: Record<AccountType, number> = { customer: 0, oon: 0, ak: 0 };
      for (const p of basePins) {
        const a = byId.get(Number(p.id));
        if (a) n[accountType(a)] += 1;
      }
      // Every type is listed, with 0 when none is on the map, so the key always explains all three colors.
      for (const t of ACCOUNT_TYPES) items.push({ key: `type-${t}`, label: ACCOUNT_TYPE_LABEL[t], color: TYPE_COLOR[t], count: n[t] });
    } else if (colorBy === "rep") {
      const byRep = new Map<string, number>();
      let none = 0;
      for (const p of basePins) {
        const a = byId.get(Number(p.id));
        if (!a) continue;
        if (a.rep) byRep.set(a.rep, (byRep.get(a.rep) ?? 0) + 1);
        else none += 1;
      }
      for (const [name, count] of [...byRep.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
        items.push({ key: `rep-${name}`, label: name, color: colorOf(name), count });
      }
      if (none) items.push({ key: "rep-none", label: "No rep", color: NO_REP_COLOR, count: none });
    } else {
      const tones = colorBy === "work" ? [0, 0, 0] : [0, 0, 0, 0];
      for (const p of basePins) tones[p.rank] = (tones[p.rank] ?? 0) + 1;
      const labels =
        colorBy === "work"
          ? ["Nothing open", "Open work or PM due soon", "Past due"]
          : ["No open PM", "Open PM, later or no date", `PM due within ${data?.dueDays ?? 14} days`, "PM past due"];
      const colors = colorBy === "work" ? WORK_COLOR : PM_COLOR;
      for (let i = labels.length - 1; i >= 0; i--) items.push({ key: `tone-${i}`, label: labels[i]!, color: colors[i]!, count: tones[i] ?? 0 });
    }
    if (showApprox && counts.approx) items.push(HOLLOW_KEY);
    return items;
  }, [basePins, byId, colorBy, colorOf, counts.approx, data?.dueDays, showApprox]);

  const mapLegend = useMemo<LegendItem[]>(() => {
    if (!providerPins.length) return legend;
    // A hollow (ZIP area) provider diamond gets the hollow key even when no account pin is approximate.
    const hollowKey: LegendItem[] = providerPins.some((p) => p.hollow) && !legend.some((i) => i.key === "approx") ? [HOLLOW_KEY] : [];
    // Like every other key entry, the count is the pins drawn: a provider with two pinned locations is two diamonds.
    const multi = providerStats.locations > providerStats.providers;
    const providersKey: LegendItem = {
      key: "providers",
      label: multi ? "Service provider location" : "Service provider",
      color: PROVIDER_COLOR,
      shape: "diamond",
      count: providerStats.locations,
    };
    return show === "providers" ? [providersKey, ...hollowKey] : [...legend, ...hollowKey, providersKey];
  }, [legend, providerPins, providerStats, show]);

  // The list: needs attention first (past due first), then by name.
  const list = useMemo(
    () => [...filtered].sort((a, b) => attentionRank(a) - attentionRank(b) || collator.compare(a.name, b.name) || a.id - b.id),
    [filtered],
  );
  const filterKey = `${needle}|${rep}|${attention}|${scoped}`;
  const paged = useShowMore(list, filterKey, LIST_STEP);
  // Providers are listed A to Z (the server's order), one row per pinned location, whatever the ZIP toggle says.
  const providerPaged = useShowMore(providerMatches, `${show}|${needle}`, LIST_STEP);
  const listKind = show === "both" ? listTab : show === "providers" ? "providers" : "accounts";

  const anyFilter = !!needle || !!rep || attention;
  const clearFilters = () => {
    setQ("");
    setRep("");
    setAttention(false);
  };

  /** On a phone or tablet the list sits under the map: bring the map back into view after a pick from the list. */
  function showMapAfterListPick() {
    if (window.matchMedia("(max-width: 1023px)").matches) scrollUnderHeader(mapBox.current);
  }

  function pick(a: AccountGeo, fromList: boolean) {
    const top = listPane.current?.scrollTop;
    setProviderPick(null);
    setSelectedId(a.id);
    appliedAccount.current = a.id;
    const p = pointOf(a);
    // A new focus object pans the map (and zooms in if the view is wide), including a second tap on the same row.
    if (p) setFocus({ lat: p.lat, lng: p.lng });
    if (fromList) showMapAfterListPick();
    onSelectAccount?.(a.id);
    if (top != null) requestAnimationFrame(() => {
      if (listPane.current) listPane.current.scrollTop = top;
    });
  }

  function pickProvider(p: ProviderGeo, fromList: boolean) {
    setSelectedId(null);
    appliedAccount.current = null;
    onSelectAccount?.(null);
    setProviderPick(p.addressId);
    if (!fromList) return;
    setFocus({ lat: p.lat, lng: p.lng });
    showMapAfterListPick();
  }

  function closeAccount() {
    appliedAccount.current = null;
    setSelectedId(null);
    onSelectAccount?.(null);
  }

  // No data yet: loading (also what the server renders, so the first client render matches it).
  if (!data && !geo.isError) {
    return (
      <div className="mt-5" data-testid="customer-map-loading">
        <p className="text-sm text-muted-foreground">Loading the map…</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row">
          <Skeleton className={cn("min-w-0 lg:flex-1", MAP_HEIGHT)} />
          <Skeleton className="h-64 lg:h-[calc(100vh-14rem)] lg:min-h-[28rem] lg:w-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-5 rounded-lg border border-border bg-card p-4 text-sm" role="alert" data-testid="customer-map-error">
        <p className="font-medium text-destructive">Could not load the map.</p>
        <p className="mt-1 text-muted-foreground">{geo.error instanceof Error ? geo.error.message : "Something went wrong while loading the accounts."}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void geo.refetch()}>
          <RotateCcw />
          Try Again
        </Button>
      </div>
    );
  }

  const nothingPinned = accounts.every((a) => a.lat == null || a.lng == null);
  const importNote = showAccounts && counts.noPin ? "More can be placed by importing the verified locations file (Customers → Import → Locations)." : null;
  const providersReady = !!providerGeo.data;

  // What the map says when it has nothing to draw.
  let mapNote: string | null = null;
  if (show === "providers") {
    if (providerGeo.isError) mapNote = "Could not load the service providers.";
    else if (!providersReady) mapNote = "Loading the service providers…";
    else if (!providerPins.length)
      mapNote = !providerRows?.length
        ? "No service provider has a pinned address yet."
        : !providerMatches.length
          ? "No service providers match this search."
          : "These service providers only have ZIP area pins, which are hidden. Turn on ZIP Area Pins to see them.";
  } else if (basePins.length === 0) {
    mapNote = nothingPinned
      ? "No account has a map pin yet. Import the verified locations file from Customers → Import → Locations."
      : filtered.length === 0
        ? "No accounts match these filters."
        : !showApprox && counts.approx
          ? "These accounts only have ZIP area pins, which are hidden. Turn on ZIP Area Pins to see them."
          : "None of these accounts has a pin to show.";
  }

  return (
    <div className={TYPE_COLOR_VARS} data-testid="customer-map">
      <ListToolbar>
        <ToolbarSearch value={q} onChange={setQ} placeholder={show === "providers" ? "Search service providers…" : "Search accounts…"} testId="map-search" />
        {/* The account filters do nothing to the service providers, so they step aside while only providers show. */}
        {showAccounts ? (
          <>
            <RepFilter value={rep} onChange={setRep} extraNames={data.reps} className={TOOLBAR_SELECT} />
            <FilterChip selected={attention} onClick={() => setAttention((v) => !v)} data-testid="map-attention">
              Needs Attention
            </FilterChip>
          </>
        ) : null}
        <FilterChip
          selected={showApprox}
          onClick={() => setShowApprox((v) => !v)}
          title="Accounts and service providers placed only at the center of their ZIP code, drawn as hollow pins"
          data-testid="map-approx"
        >
          ZIP Area Pins
        </FilterChip>
      </ListToolbar>

      {/* Show comes first so it stays put when Color By steps aside (Service Providers alone have one color). */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full" role="group" aria-label="Show on the map" data-testid="map-show">
          <span className="mr-1 text-xs font-medium text-muted-foreground max-sm:w-full">Show</span>
          <div className="flex h-9 rounded-full bg-secondary p-0.5 max-sm:w-full">
            {SHOW_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={show === o.id}
                onClick={() => chooseShow(o.id)}
                className={cn(
                  "desk-flat h-8 rounded-full px-3 text-sm font-medium whitespace-nowrap max-sm:flex-auto max-sm:px-2",
                  // Same picked look as the chips (lighter on a phone in dark mode, where ink is darker than the track).
                  show === o.id ? "bg-ink text-ink-foreground max-sm:dark:bg-cream max-sm:dark:text-ink" : "text-foreground hover:bg-background/60",
                )}
                data-testid={o.testId}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {showAccounts ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Color by">
            <span className="mr-1 text-xs font-medium text-muted-foreground max-sm:w-full">Color By</span>
            {COLOR_BY.map((c) => (
              <FilterChip key={c.id} selected={colorBy === c.id} onClick={() => setColorBy(c.id)} data-testid={`map-color-${c.id}`}>
                {c.label}
              </FilterChip>
            ))}
          </div>
        ) : null}
      </div>

      {/* Counts and key sit above the map on a wide screen; on a phone the key and the import note move under it. */}
      <div className="mt-4 space-y-2">
        <p className="text-xs text-muted-foreground" data-testid="map-counts">
          {show === "providers" ? (
            providerGeo.isError ? (
              <span className="text-destructive">Could not load the service providers.</span>
            ) : !providersReady ? (
              "Loading the service providers…"
            ) : (
              <>
                <span className="font-medium text-foreground" data-testid="map-provider-count">
                  {plural(providerCount, "service provider")} on the map
                </span>
                {providerStats.locations > providerCount ? ` · ${plural(providerStats.locations, "location")}` : ""}
                {!showApprox && providerStats.approxHidden ? ` · ${plural(providerStats.approxHidden, "ZIP area pin")} hidden` : ""}
                {providerGeo.data?.truncated ? ` · only the first ${MAX_PROVIDER_PINS.toLocaleString("en-US")} locations are shown` : ""}
              </>
            )
          ) : (
            <>
              <span className="font-medium text-foreground">{plural(showApprox ? counts.pinned : counts.pinned - counts.approx, "account")} on the map</span>
              {" · "}
              {counts.noPin.toLocaleString("en-US")} without a pin
              {!showApprox && counts.approx ? ` · ${plural(counts.approx, "ZIP area pin")} hidden` : ""}
              {show === "both" && providersReady ? <span data-testid="map-provider-count"> · {plural(providerCount, "service provider")} on the map</span> : null}
              {importNote ? <span className="hidden lg:inline"> · {importNote}</span> : null}
            </>
          )}
        </p>
        <MapLegend items={mapLegend} className="hidden lg:flex" />
      </div>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row">
        <div ref={mapBox} className="min-w-0 scroll-mt-32 lg:flex-1 lg:scroll-mt-20">
          <DeskMap
            pins={mapPins}
            selectedId={selectedProvider ? providerPinId(selectedProvider.addressId) : (selected?.id ?? null)}
            onPinClick={(pin) => {
              const provider = providerByPin.get(String(pin.id));
              if (provider) {
                pickProvider(provider, false);
                return;
              }
              const a = byId.get(Number(pin.id));
              if (a) pick(a, false);
            }}
            fitKey={show === "providers" ? `providers|${needle}|${providerRows ? providerRows.length : "loading"}` : `${filterKey}|${data.accounts.length}`}
            fitTo={fitTo}
            fitToOnly
            focus={focus}
            className={MAP_HEIGHT}
            label="Customer map"
          >
            {mapNote ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
                <p className="max-w-xs rounded-lg border border-border bg-card/95 px-4 py-3 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]" data-testid="map-note">
                  {mapNote}
                </p>
              </div>
            ) : null}
            {selectedProvider || selected ? (
              // Phone and tablet: the details card is under the map, so say what is picked and offer a way down. On a
              // phone it sits at the top, beside the zoom buttons, clear of the attribution and the tiles note below.
              <div className="absolute right-2 bottom-7 left-2 z-10 flex items-center gap-2 rounded-lg border border-border bg-card/95 py-1.5 pr-1.5 pl-3 shadow-[var(--shadow-soft)] max-sm:top-2 max-sm:bottom-auto max-sm:left-14 lg:hidden">
                <span className="min-w-0 flex-1 truncate text-sm font-medium max-sm:line-clamp-2 max-sm:leading-snug max-sm:break-words max-sm:whitespace-normal">
                  {selectedProvider?.name ?? selected?.name}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={() => scrollUnderHeader(panelBox.current)}
                  data-testid="map-details-jump"
                >
                  Details
                </Button>
              </div>
            ) : null}
          </DeskMap>
          <div className="mt-2 space-y-1.5 lg:hidden">
            <MapLegend items={mapLegend} testId="map-legend-below" />
            {importNote ? <p className="text-xs text-muted-foreground">{importNote}</p> : null}
          </div>
        </div>

        <aside
          ref={panelBox}
          className="flex min-w-0 scroll-mt-32 flex-col overflow-hidden rounded-lg border border-border bg-card lg:h-[calc(100vh-14rem)] lg:min-h-[28rem] lg:w-96 lg:shrink-0 lg:scroll-mt-20"
          aria-label={show === "providers" ? "Service providers on the map" : show === "both" ? "Accounts and service providers on the map" : "Accounts on the map"}
          data-testid="map-panel"
        >
          {selectedProvider ? (
            <ProviderCard provider={selectedProvider} onClose={() => setProviderPick(null)} />
          ) : selected ? (
            <AccountCard account={selected} scoped={data.scoped} type={colorBy === "type" ? accountType(selected) : null} onClose={closeAccount} />
          ) : (
            <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
              {listKind === "providers" ? "Tap a pin or a service provider below to see its details." : "Tap a pin or an account below to see its details."}
            </p>
          )}

          {show === "both" ? (
            <div className="flex items-end gap-1 border-b border-border px-2" role="group" aria-label="List" data-testid="map-list-tabs">
              <ListTab selected={listKind === "accounts"} onClick={() => setListTab("accounts")} count={filtered.length} testId="map-list-accounts">
                Accounts
              </ListTab>
              {/* The count is the rows in the list: one per pinned location, so it says locations when a provider has two. */}
              <ListTab selected={listKind === "providers"} onClick={() => setListTab("providers")} count={providersReady ? providerStats.rows : null} testId="map-list-providers">
                {providersReady && providerStats.rows > providerStats.listed ? "Provider Locations" : "Service Providers"}
              </ListTab>
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
              <h2 className="text-sm font-medium">
                {listKind === "accounts"
                  ? plural(filtered.length, "account")
                  : providersReady
                    ? `${plural(providerStats.listed, "service provider")}${providerStats.rows > providerStats.listed ? ` · ${plural(providerStats.rows, "location")}` : ""}`
                    : "Service providers"}
              </h2>
              <span className="text-[11px] text-muted-foreground">{listKind === "accounts" ? "Needs attention first" : "A to Z"}</span>
            </div>
          )}

          <div ref={listPane} className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {listKind === "providers" ? (
              providerGeo.isError ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground" role="alert" data-testid="map-providers-error">
                  <p>Could not load the service providers.</p>
                  <Button type="button" variant="outline" className="mt-3" onClick={() => void providerGeo.refetch()}>
                    <RotateCcw />
                    Try Again
                  </Button>
                </div>
              ) : !providersReady ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading the service providers…</p>
              ) : providerMatches.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="map-providers-empty">
                  <p>{providerRows?.length ? "No service providers match this search." : "No service provider has a pinned address yet."}</p>
                  {providerRows?.length && needle ? (
                    <Button type="button" variant="outline" className="mt-3" onClick={() => setQ("")}>
                      Clear Search
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul data-testid="map-provider-list">
                  {providerPaged.visible.map((p) => (
                    <ProviderRow key={p.addressId} provider={p} selected={p.addressId === providerPick} onPick={() => pickProvider(p, true)} />
                  ))}
                  <ShowMoreButton as="li" remaining={providerPaged.remaining} onClick={providerPaged.showMore} label="service providers" />
                </ul>
              )
            ) : list.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="map-empty">
                <p>{accounts.length === 0 ? "There are no accounts yet." : "No accounts match these filters."}</p>
                {anyFilter ? (
                  <Button type="button" variant="outline" className="mt-3" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul>
                {paged.visible.map((a) => (
                  <AccountRow key={a.id} account={a} color={paint(a, colorBy, colorOf).color} selected={a.id === selectedId} onPick={() => pick(a, true)} />
                ))}
                <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} label="accounts" />
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** One of the two lists in the side panel when both layers are on the map. */
function ListTab({ selected, onClick, count, testId, children }: { selected: boolean; onClick: () => void; count: number | null; testId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "desk-flat -mb-px flex h-11 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium",
        selected ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
      data-testid={testId}
    >
      {children}
      {count != null ? <span className="tabular text-xs font-normal text-muted-foreground">{count.toLocaleString("en-US")}</span> : null}
    </button>
  );
}

function AccountRow({ account: a, color, selected, onPick }: { account: AccountGeo; color: string; selected: boolean; onPick: () => void }) {
  const hasPin = a.lat != null && a.lng != null;
  const work = rowWork(a);
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onPick();
        }}
        aria-current={selected ? "true" : undefined}
        className={cn("desk-flat flex min-h-11 w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted/60", selected && "bg-muted")}
        data-testid="map-account-row"
        data-map-account={a.id}
      >
        {hasPin ? <Swatch color={color} hollow={a.quality === "approx"} className="mt-1.5" /> : <MapPinOff className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
        {/* On a phone the lines wrap instead of cutting off: the row has the full width there. */}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium break-words sm:truncate">
            {a.name}
            <AkBadge on={a.aviKatz} className="ml-1.5 align-middle" />
          </span>
          <span className="block text-xs text-muted-foreground break-words sm:truncate">
            {a.city ?? "No city"}
            {" · "}
            {a.rep ? <RepName name={a.rep} /> : <NoRepFlag show />}
          </span>
          {work ? <span className={cn("block text-xs break-words sm:truncate", work.tone === "danger" ? "text-destructive" : "text-warning")}>{work.text}</span> : null}
        </span>
        {!hasPin ? (
          <Badge variant="outline" size="tight" className="mt-0.5">
            No pin
          </Badge>
        ) : null}
      </button>
    </li>
  );
}

/** A service provider location in the side panel list: name and status, the address, and the dispatch phone. */
function ProviderRow({ provider: p, selected, onPick }: { provider: ProviderGeo; selected: boolean; onPick: () => void }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        aria-current={selected ? "true" : undefined}
        className={cn("desk-flat flex min-h-11 w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted/60", selected && "bg-muted")}
        data-testid="map-provider-row"
      >
        <Swatch color={PROVIDER_COLOR} shape="diamond" hollow={p.quality === "approx"} className="mt-1.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium break-words">
            {p.name}
            <Badge variant={statusTone(p.status)} size="tight" className="ml-1.5 align-middle">
              {p.status || "Unconfirmed"}
            </Badge>
          </span>
          <span className="block text-xs break-words text-muted-foreground">{p.address || (p.geocodeAddress ? properCase(p.geocodeAddress) : "No address")}</span>
          {p.dispatchPhone ? <span className="block text-xs text-muted-foreground tabular">{p.dispatchPhone}</span> : null}
        </span>
      </button>
    </li>
  );
}

/** The picked account: who, where, how good the pin is, what is open, and the two ways out. */
function AccountCard({ account: a, scoped, type, onClose }: { account: AccountGeo; scoped: boolean; type: AccountType | null; onClose: () => void }) {
  const fromMap = useFromHere("/customers");
  const point = pointOf(a);
  const address = shownAddress(a);
  const url = directionsUrl({ point, quality: a.quality, address: a.address });
  const drivablePin = !!point && canDriveTo(a.quality);
  const directionsNote = !url
    ? a.quality === "approx"
      ? "No directions: there is no street address on file and the pin is only the ZIP area."
      : "No directions: there is no street address on file."
    : !drivablePin && a.quality === "approx"
      ? "Directions use the typed address, not the ZIP area pin."
      : null;
  const lines = workLines(a);
  return (
    <section className="shrink-0 border-b border-border p-4" aria-label={`Selected account: ${a.name}`} data-testid="map-account-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-snug font-medium">
            {a.name}
            <AkBadge on={a.aviKatz} className="ml-1.5 align-middle" />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.rep ? <RepName name={a.rep} /> : <NoRepFlag show />}</p>
          {/* Coloring by Type: say which type the pin's color stands for. */}
          {type ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="map-account-type">
              <Swatch color={TYPE_COLOR[type]} />
              {ACCOUNT_TYPE_LABEL[type]}
            </p>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mt-1.5 -mr-2 size-9" onClick={onClose} aria-label="Close account details">
          <X />
        </Button>
      </div>

      <p className={cn("mt-2 text-sm", !address && "text-muted-foreground")}>{address ?? "No address"}</p>
      <p className={cn("text-xs", a.quality === "close" ? "text-warning" : "text-muted-foreground")} data-testid="map-pin-quality">
        {a.quality ? QUALITY_LABEL[a.quality] : point ? "Pin placed, match not recorded" : "No pin yet"}
      </p>

      <ul className="mt-3 space-y-0.5 text-xs">
        {lines.length ? lines.map((l, i) => <li key={i}>{l}</li>) : <li className="text-muted-foreground">No open work.</li>}
      </ul>
      {scoped ? <p className="mt-1 text-[11px] text-muted-foreground">Work counts cover your own accounts only.</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-9 px-3">
          <Link to="/customers" search={{ open: a.id, from: fromMap }} data-testid="map-open-account">
            <Store />
            Open Account
          </Link>
        </Button>
        {url ? (
          <Button asChild size="sm" variant="outline" className="h-9 px-3">
            <a href={url} target="_blank" rel="noreferrer" data-testid="map-directions">
              <Navigation />
              Directions
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-9 px-3" disabled title={directionsNote ?? undefined} data-testid="map-directions">
            <Navigation />
            Directions
          </Button>
        )}
      </div>
      {directionsNote ? <p className="mt-1.5 text-[11px] text-muted-foreground">{directionsNote}</p> : null}
    </section>
  );
}

/** Phone only: a link in the provider card is a 32px tall tap target (its text stays 12px). */
const PHONE_TAP = "max-sm:inline-block max-sm:py-2";

/**
 * The picked service provider: who, status, how to reach them, what they cover, where the pin is and how good it is,
 * Directions (only to a street match) and a way into the Out of Network page with the provider open.
 */
function ProviderCard({ provider: p, onClose }: { provider: ProviderGeo; onClose: () => void }) {
  const fromMapToNetwork = useFromHere("/network");
  const point = { lat: p.lat, lng: p.lng };
  const drivable = canDriveTo(p.quality);
  const url = drivable ? directionsUrl({ point, quality: p.quality }) : null;
  const address = p.address || (p.geocodeAddress ? properCase(p.geocodeAddress) : null);
  const tel = telHref(p.dispatchPhone);
  const site = websiteHref(p.website);
  // Only the address itself: the field can also hold a portal link, a login or a note, which never go on the card.
  const email = firstEmail(p.dispatchEmail);
  const directionsNote = drivable ? null : "No directions: the pin is only the ZIP area, not the street address.";
  const row = (label: string, value: ReactNode) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
  return (
    <section className="shrink-0 border-b border-border p-4" aria-label={`Selected service provider: ${p.name}`} data-testid="map-provider-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <Swatch color={PROVIDER_COLOR} shape="diamond" />
            Service provider
          </p>
          <h2 className="mt-1 text-base leading-snug font-medium">{p.name}</h2>
          <Badge variant={statusTone(p.status)} size="tight" className="mt-1">
            {p.status || "Unconfirmed"}
          </Badge>
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mt-1.5 -mr-2 size-9" onClick={onClose} aria-label="Close provider details">
          <X />
        </Button>
      </div>

      <p className={cn("mt-2 text-sm", !address && "text-muted-foreground")}>{address ?? "No address"}</p>
      <p className={cn("text-xs", p.quality === "close" ? "text-warning" : "text-muted-foreground")} data-testid="map-provider-pin-quality">
        {p.quality ? QUALITY_LABEL[p.quality] : "Pin placed, match not recorded"}
      </p>

      {/* On a phone the phone, email and website links get a taller tap area; the labels line up with their text. */}
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs max-sm:items-baseline">
        {row(
          "Dispatch",
          p.dispatchPhone ? (
            tel ? (
              <a href={tel} className={cn("font-medium text-primary underline-offset-4 hover:underline", PHONE_TAP)} data-testid="map-provider-phone">
                {p.dispatchPhone}
              </a>
            ) : (
              p.dispatchPhone
            )
          ) : (
            <span className="text-muted-foreground">No phone</span>
          ),
        )}
        {row(
          "Email",
          email ? (
            <a href={`mailto:${email}`} className={cn("text-primary underline-offset-4 hover:underline", PHONE_TAP)} data-testid="map-provider-email">
              {email}
            </a>
          ) : (
            <span className="text-muted-foreground">No email</span>
          ),
        )}
        {row(
          "Website",
          site ? (
            <a href={site} target="_blank" rel="noreferrer" className={cn("text-primary underline-offset-4 hover:underline", PHONE_TAP)} data-testid="map-provider-website">
              {websiteLabel(p.website)}
            </a>
          ) : (
            <span className="text-muted-foreground">No website</span>
          ),
        )}
        {row("Coverage", p.coverage ? <span className="line-clamp-3 whitespace-pre-line">{p.coverage}</span> : <span className="text-muted-foreground">Not listed</span>)}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-9 px-3">
          <Link to="/network" search={{ open: p.providerId, from: fromMapToNetwork }} data-testid="map-open-provider">
            <Globe />
            Open In Out Of Network
          </Link>
        </Button>
        {url ? (
          <Button asChild size="sm" variant="outline" className="h-9 px-3">
            <a href={url} target="_blank" rel="noreferrer" data-testid="map-provider-directions">
              <Navigation />
              Directions
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-9 px-3" disabled title={directionsNote ?? undefined} data-testid="map-provider-directions">
            <Navigation />
            Directions
          </Button>
        )}
      </div>
      {directionsNote ? <p className="mt-1.5 text-[11px] text-muted-foreground">{directionsNote}</p> : null}
    </section>
  );
}

/** Parts of one line, separated by a muted dot. */
function joined(parts: ReactNode[]): ReactNode {
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i ? <span className="text-muted-foreground"> · </span> : null}
      {part}
    </Fragment>
  ));
}

/**
 * One line per kind of open work, with the late and due-soon parts called out. Tickets and TLCs share a line because
 * the past-due count covers both (same rule as the past-due flag on the Tickets and TLC pages).
 */
function workLines(a: AccountGeo): ReactNode[] {
  const out: ReactNode[] = [];
  const late = (n: number) => <span className="font-medium text-destructive">{n} past due</span>;
  const calls: ReactNode[] = [];
  if (a.openCalls) calls.push(plural(a.openCalls, "open ticket"));
  if (a.openTlcs) calls.push(plural(a.openTlcs, "open TLC"));
  if (a.pastDueCalls) calls.push(late(a.pastDueCalls));
  if (calls.length) out.push(joined(calls));
  if (a.openPms) {
    out.push(
      joined(
        [
          plural(a.openPms, "open PM"),
          a.pmsPastDue ? late(a.pmsPastDue) : null,
          a.pmsDueSoon ? <span className="font-medium text-warning">{a.pmsDueSoon} due soon</span> : null,
          a.nextPm ? `next ${formatLongDate(a.nextPm)}` : null,
          a.pmsNoDate ? `${a.pmsNoDate} with no date` : null,
        ].filter((x) => x != null),
      ),
    );
  }
  if (a.openInstalls) {
    out.push(joined([plural(a.openInstalls, "open install"), a.nextInstall ? `next ${formatLongDate(a.nextInstall)}` : null].filter((x) => x != null)));
  }
  return out;
}
