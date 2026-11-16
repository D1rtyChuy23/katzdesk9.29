import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILD } from "@/lib/build-info";
import { getLiveBuild } from "@/lib/ops/build-live";
import { newerBuildLive } from "@/lib/ops/version-notice";

/**
 * "A new version is live" (11/16). A tab open through a publish keeps running the old script, so it asks the server
 * for its commit every five minutes and when the tab comes back into view. It never reloads by itself: someone may be
 * typing. Its own failures stay quiet.
 */
export function VersionNotice() {
  const live = useQuery({
    queryKey: ["live-build"],
    queryFn: () => getLiveBuild(),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    retry: false,
    meta: { quietErrors: true },
  });
  if (!newerBuildLive(BUILD.sha, live.data?.sha)) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm"
      role="status"
      data-testid="version-notice"
    >
      <span>A new version of KatzDesk is live. Save your work, then reload to get it.</span>
      <Button type="button" size="sm" onClick={() => window.location.reload()}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Reload
      </Button>
    </div>
  );
}
