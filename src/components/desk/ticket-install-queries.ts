import { useQuery } from "@tanstack/react-query";
import { getTicketInstallMatches, listTicketInstallPairs } from "@/lib/ops/ticket-install-merge";
import type { ServiceJob } from "@/lib/ops/types";

/** The installs this ticket's WO is on, for an Admin (anyone else gets none from the server). */
export function useTicketInstallMatches(job: ServiceJob | null | undefined) {
  return useQuery({
    queryKey: ["ticket-install-matches", job?.id ?? 0, job?.wo ?? ""],
    queryFn: () => getTicketInstallMatches({ data: { jobId: job!.id } }),
    enabled: !!job && !job.duplicateOf && !!job.wo?.trim(),
    staleTime: 30_000,
  });
}

/** The Tickets page's pairs: live tickets whose WO is on an install, and the last merges. Admins only. */
export function useTicketInstallPairs(kind: "service" | "tlc", enabled: boolean) {
  return useQuery({
    // Under "jobs" so a Corrigo import or a merge refreshes it.
    queryKey: ["jobs", "install-pairs", kind],
    queryFn: () => listTicketInstallPairs({ data: { kind } }),
    enabled,
  });
}
