import { useEffect, useState } from "react";

export type OpenSearch = { open?: number };

export function parseOpenSearch(s: Record<string, unknown>): OpenSearch {
  const raw = s.open;
  if (typeof raw === "number" && Number.isFinite(raw)) return { open: raw };
  if (typeof raw === "string" && raw && !Number.isNaN(Number(raw))) return { open: Number(raw) };
  return {};
}

/** Customers: `?open=`, plus `from=` when the Map opened the account, so closing it goes back there. */
export type CustomerSearch = OpenSearch & { from?: "map" | "territories" };

export function parseCustomerSearch(s: Record<string, unknown>): CustomerSearch {
  const base = parseOpenSearch(s);
  return s.from === "map" || s.from === "territories" ? { ...base, from: s.from } : base;
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
