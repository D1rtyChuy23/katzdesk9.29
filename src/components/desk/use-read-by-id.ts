import { useQuery } from "@tanstack/react-query";
import { getReadSwitches, type ReadArea } from "@/lib/ops/read-by-id";

/**
 * Whether an area reads by id (phase C5, Link Check → Reading by id), for a screen that picks the account itself. False
 * until it has loaded, so the screen reads by name, as before, in the meantime.
 */
export function useReadsById(area: ReadArea): boolean {
  const q = useQuery({ queryKey: ["read-by-id", "switches"], queryFn: () => getReadSwitches(), staleTime: 5 * 60_000 });
  return q.data?.[area] === true;
}
