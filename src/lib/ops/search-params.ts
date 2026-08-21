import { useEffect, useState } from "react";

export type OpenSearch = { open?: number };

export function parseOpenSearch(s: Record<string, unknown>): OpenSearch {
  const raw = s.open;
  if (typeof raw === "number" && Number.isFinite(raw)) return { open: raw };
  if (typeof raw === "string" && raw && !Number.isNaN(Number(raw))) return { open: Number(raw) };
  return {};
}

/** Keep the open sheet in sync when search / pings / deep links change `?open=`. */
export function useOpenRecord(open?: number): [number | null, (v: number | null) => void] {
  const [selected, setSelected] = useState<number | null>(open ?? null);
  useEffect(() => {
    if (open != null && Number.isFinite(open)) setSelected(open);
  }, [open]);
  return [selected, setSelected];
}
