/** The Photos panels' shared reads (11/4): a photo's address, a record's photos, and whether its tab has been opened. */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRecordPhotos } from "@/lib/ops/ticket-photos";
import type { PhotoKind } from "@/lib/ops/ticket-photo-rules";

/** The photo's address: the picture, its preview, or a download under its name. */
export function photoSrc(id: number, as: "full" | "thumb" | "download" = "full"): string {
  return as === "thumb" ? `/api/ticket-photo/${id}?size=thumb` : as === "download" ? `/api/ticket-photo/${id}?download=1` : `/api/ticket-photo/${id}`;
}

/** The record's photos query, shared by its panel and its tab's count. */
export function useRecordPhotos(kind: PhotoKind, id: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["photos", kind, id],
    queryFn: () => listRecordPhotos({ data: { kind, id: id! } }),
    enabled: enabled && id != null,
  });
}

/**
 * True once a window's Photos tab has been opened on this record: the panel then stays mounted while another tab is
 * open, so photos still being added keep their progress, and the pictures load only once someone looks.
 */
export function useSeenTab(active: boolean, recordId: number | null | undefined): boolean {
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    if (active && recordId != null) setSeen(recordId);
  }, [active, recordId]);
  return active || (recordId != null && seen === recordId);
}
