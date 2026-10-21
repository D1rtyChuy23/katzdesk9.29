import { useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

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

/** Tickets and TLC + Factor: `?open=`, plus `tab=ping` when a ping or note notification opened the ticket. */
export type TicketSearch = OpenSearch & { tab?: "ping" };

export function parseTicketSearch(s: Record<string, unknown>): TicketSearch {
  const base = parseOpenSearch(s);
  return s.tab === "ping" ? { ...base, tab: "ping" } : base;
}

/** Keep the open sheet in sync when search / pings / deep links change `?open=`. */
export function useOpenRecord(open?: number): [number | null, (v: number | null) => void] {
  const [selected, setSelected] = useState<number | null>(open ?? null);
  useEffect(() => {
    if (open != null && Number.isFinite(open)) setSelected(open);
  }, [open]);
  return [selected, setSelected];
}
