import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAccountGeo, type AccountGeo, type AccountGeoData } from "@/lib/ops/geo-api";
import { NO_REP_COLOR, repColors, type LatLng } from "@/lib/ops/geo";

/** Query key for every account's pin + open work. Invalidate it after a location import or an address change. */
export const ACCOUNT_GEO_KEY = ["account-geo"] as const;

/** Every account with pin, rep and open work (one request, shared by the map, Planner routes and Nearby). */
export function useAccountGeo() {
  return useQuery<AccountGeoData>({ queryKey: ACCOUNT_GEO_KEY, queryFn: () => listAccountGeo(), staleTime: 2 * 60_000 });
}

/** The account's pin as a point, or null. */
export function pointOf(a: Pick<AccountGeo, "lat" | "lng"> | null | undefined): LatLng | null {
  return a && a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null;
}

/** Customer name as jobs store it → key used to find the account (same rule as the Customers list: lower-case). */
export const nameKey = (name: string | null | undefined) => String(name ?? "").trim().toLowerCase();

/** Lookups over the account list: by id, by name, and the rep → color map. */
export function useGeoIndex() {
  const q = useAccountGeo();
  const index = useMemo(() => {
    const accounts = q.data?.accounts ?? [];
    const byId = new Map<number, AccountGeo>();
    const byName = new Map<string, AccountGeo>();
    for (const a of accounts) {
      byId.set(a.id, a);
      const k = nameKey(a.name);
      if (k && !byName.has(k)) byName.set(k, a);
    }
    const colors = repColors(q.data?.reps ?? []);
    const colorOf = (rep: string | null | undefined) => (rep ? colors.get(rep) ?? NO_REP_COLOR : NO_REP_COLOR);
    return { accounts, byId, byName, colors, colorOf };
  }, [q.data]);
  return { ...q, ...index };
}

/** Open work on an account (tickets + TLCs + PMs + installs). */
export function openWork(a: AccountGeo): number {
  return a.openCalls + a.openTlcs + a.openPms + a.openInstalls;
}

/** Something a tech or rep should act on: open work, or a PM past due / due soon. */
export function needsAttention(a: AccountGeo): boolean {
  return openWork(a) > 0 || a.pmsPastDue > 0 || a.pmsDueSoon > 0;
}

/**
 * Scrolls `el` to the top of the screen. On a phone the sticky app header can wrap onto two or three rows, so it is
 * measured and `el` lands just under it; on wider screens `el` keeps its own scroll margin (scroll-mt-*), as before.
 */
export function scrollUnderHeader(el: HTMLElement | null) {
  if (!el) return;
  if (window.matchMedia("(max-width: 639px)").matches) {
    let header = 0;
    for (const h of document.querySelectorAll("header")) {
      const s = getComputedStyle(h);
      if (s.position === "sticky" || s.position === "fixed") header = Math.max(header, (parseFloat(s.top) || 0) + h.getBoundingClientRect().height);
    }
    el.style.scrollMarginTop = `${Math.round(header) + 8}px`;
  } else {
    el.style.scrollMarginTop = "";
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
