import { listStackCandidates, type StackedOn, type StackedPmRow } from "@/lib/ops/pm-stack-api";

type StackData = Awaited<ReturnType<typeof listStackCandidates>>;

export function isPmStack(data: StackData | undefined): data is { stackedOn: StackedOn | null; candidates: StackedOn[] } {
  return !!data && "stackedOn" in data;
}

export function isJobStack(data: StackData | undefined): data is { stacked: StackedPmRow[]; candidates: StackedPmRow[] } {
  return !!data && "stacked" in data;
}

export function pmStackQuery(pmId: number) {
  return {
    queryKey: ["pm-stack", { pmId }] as const,
    queryFn: () => listStackCandidates({ data: { pmId } }),
  };
}

export function jobStackQuery(jobId: number) {
  return {
    queryKey: ["pm-stack", { jobId }] as const,
    queryFn: () => listStackCandidates({ data: { jobId } }),
  };
}

/** Completed ticket, stacked PM still open: a reminder only. It does not block the save. */
export function openPmReminders(ticketStatus: string, stacked: StackedPmRow[]): StackedPmRow[] {
  if (ticketStatus !== "Completed") return [];
  return stacked.filter((p) => p.status !== "Completed" && p.status !== "Cancelled");
}
