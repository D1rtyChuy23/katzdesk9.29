import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AnalyticsFilters } from "@/lib/ops/analytics";
import { TEAMS_CHANNEL_LABEL, TEAMS_WEBHOOK_ENV, type TeamsChannel } from "@/lib/ops/teams-message";
import { postMorningReports, postTeamsChannel, teamsChannelStatus, type TeamsChannelState } from "@/lib/ops/teams-reports";

function sayPosted(label: string) {
  toast.success(`${label} posted to Teams`);
}

function sayFailed(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Could not post to Teams");
}

/** One channel. Hidden unless the viewer is an admin — the server checks again. */
export function TeamsPostButton({
  channel,
  enabled,
  filters,
  label,
  testId,
}: {
  channel: TeamsChannel;
  enabled: boolean;
  filters?: AnalyticsFilters;
  label?: string;
  testId?: string;
}) {
  const post = useMutation({
    mutationFn: () => postTeamsChannel({ data: { channel, filters } }),
    onSuccess: (r) => sayPosted(r.label),
    onError: sayFailed,
  });
  if (!enabled) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={post.isPending}
      onClick={() => post.mutate()}
      data-testid={testId ?? `teams-post-${channel}`}
    >
      <Send className="size-4" />
      {post.isPending ? "Posting…" : label ?? `Post to ${TEAMS_CHANNEL_LABEL[channel]}`}
    </Button>
  );
}

/**
 * Morning list: each exception report goes to its own channel.
 * Dispatch, parts, handoff, and this month's analytics counts.
 */
export function TeamsMorningPanel({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["teams-channels"],
    queryFn: () => teamsChannelStatus(),
    enabled,
  });
  const morning = useMutation({
    mutationFn: () => postMorningReports(),
    onSuccess: (r) => {
      const posted = r.results.filter((x) => x.posted);
      const missed = r.results.filter((x) => !x.posted);
      if (posted.length) toast.success(`${posted.map((x) => x.label).join(", ")} posted to Teams`);
      if (missed.length) toast.error(missed.map((x) => x.error).filter(Boolean).join(" "));
      void qc.invalidateQueries({ queryKey: ["teams-channels"] });
    },
    onError: sayFailed,
  });
  const one = useMutation({
    mutationFn: (channel: TeamsChannel) => postTeamsChannel({ data: { channel } }),
    onSuccess: (r) => sayPosted(r.label),
    onError: sayFailed,
  });
  if (!enabled) return null;
  const rows: TeamsChannelState[] =
    status.data ??
    (Object.keys(TEAMS_CHANNEL_LABEL) as TeamsChannel[]).map((channel) => ({
      channel,
      label: TEAMS_CHANNEL_LABEL[channel],
      ready: false,
    }));
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-soft" data-testid="teams-morning">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight">Teams reports</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Dispatch, parts, handoff, and this month's analytics counts. Teams gets the exception list. The record stays in KatzDesk.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={morning.isPending || one.isPending}
          onClick={() => morning.mutate()}
          data-testid="teams-post-morning"
        >
          <Send className="size-4" />
          {morning.isPending ? "Posting…" : "Post all four"}
        </Button>
      </div>
      <ul className="mt-4 divide-y divide-border border-t border-border">
        {rows.map((row) => (
          <li key={row.channel} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">
                {status.isLoading ? "Checking the channel…" : row.ready ? "Connected" : `Needs ${TEAMS_WEBHOOK_ENV[row.channel]}`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={morning.isPending || one.isPending}
              onClick={() => one.mutate(row.channel)}
              data-testid={`teams-post-${row.channel}`}
            >
              {one.isPending && one.variables === row.channel ? "Posting…" : "Post"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
