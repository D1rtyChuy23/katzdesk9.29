import { useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { parseBillingFilters, type BillingFilters } from "./billing-rules";

/** `?open=` a record, and `from=` the page (path and search) that opened it, so closing the window goes back there. */
export type OpenSearch = { open?: number; from?: string };

/** Only a path in this app: "/map?account=29", never "//host" or a full URL. */
export function parseFrom(raw: unknown): string | undefined {
  return typeof raw === "string" && /^\/(?![/\\])/.test(raw) && raw.length <= 2000
    ? raw
    : undefined;
}

export function parseOpenSearch(s: Record<string, unknown>): OpenSearch {
  const raw = s.open;
  const from = parseFrom(s.from);
  const open =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : typeof raw === "string" && raw && !Number.isNaN(Number(raw))
        ? Number(raw)
        : undefined;
  return { ...(open != null ? { open } : {}), ...(from ? { from } : {}) };
}

/** The page a record opens from (this one): undefined when the record is on this same page. */
export function fromFor(here: { pathname: string; href: string }, to: string): string | undefined {
  return here.pathname === to ? undefined : here.href;
}

export function useFromHere(to: string): string | undefined {
  return fromFor(useLocation(), to);
}

/** Closing a record window: go back to the page that opened it, when one did. Returns whether it went back. */
export function useBackTo(from: string | undefined): () => boolean {
  const router = useRouter();
  return () => {
    if (!from) return false;
    router.history.replace(from);
    return true;
  };
}

export type TicketView = "active" | "flagged" | "unassigned" | "complete" | "all";

const TICKET_VIEWS: TicketView[] = ["active", "flagged", "unassigned", "complete", "all"];

/**
 * Tickets and TLC + Factor: `?open=`, plus `tab=ping` when a ping or note notification opened the ticket. The list's
 * view, urgency and filters ride along too (10/28), so a filtered list can be bookmarked or sent. Active is the
 * default view and is left out.
 */
export type TicketSearch = OpenSearch & { tab?: "ping"; view?: Exclude<TicketView, "active">; urgency?: string } & Omit<BillingFilters, "board">;

export function parseTicketSearch(s: Record<string, unknown>): TicketSearch {
  const base = parseOpenSearch(s);
  const view = typeof s.view === "string" && s.view !== "active" && (TICKET_VIEWS as string[]).includes(s.view) ? (s.view as Exclude<TicketView, "active">) : undefined;
  const urgency = typeof s.urgency === "string" && s.urgency.trim() && s.urgency.length <= 30 ? s.urgency.trim() : undefined;
  // The board is the page itself here.
  const { board: _board, ...filters } = parseBillingFilters(s);
  void _board;
  return {
    ...base,
    ...(s.tab === "ping" ? { tab: "ping" as const } : {}),
    ...(view ? { view } : {}),
    ...(urgency ? { urgency } : {}),
    ...filters,
  };
}

/** The search with one list change applied and every blank left out, so the address bar only carries what is set. */
export function withTicketList(prev: TicketSearch, patch: Partial<TicketSearch>): TicketSearch {
  const next: Record<string, unknown> = { ...prev, ...patch };
  for (const k of Object.keys(next)) {
    const v = next[k];
    if (v === undefined || v === null || v === "" || v === false) delete next[k];
  }
  if (next.view === "active") delete next.view;
  return next as TicketSearch;
}

/** Keep the open sheet in sync when search / pings / deep links change `?open=`. */
export function useOpenRecord(open?: number): [number | null, (v: number | null) => void] {
  const [selected, setSelected] = useState<number | null>(open ?? null);
  useEffect(() => {
    if (open != null && Number.isFinite(open)) setSelected(open);
  }, [open]);
  return [selected, setSelected];
}
