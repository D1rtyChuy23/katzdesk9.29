import { useQuery } from "@tanstack/react-query";
import { getRebuildLink } from "@/lib/ops/rebuild-link-api";

export const rebuildLinkKey = (id: number) => ["rebuild-link", id] as const;

/** What a rebuild is linked to (11/6), read fresh each time its sheet opens. */
export function useRebuildLink(id: number, enabled = true) {
  return useQuery({ queryKey: rebuildLinkKey(id), queryFn: () => getRebuildLink({ data: { id } }), staleTime: 0, enabled: enabled && id > 0 });
}
