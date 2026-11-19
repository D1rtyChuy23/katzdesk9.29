import type { ErrorComponentProps } from "@tanstack/react-router";
import { Compass, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { isStaleBuildError, reloadForNewBuild } from "@/lib/ops/stale-build";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const stale = isStaleBuildError(error);
  // A page script from an older build: reload once onto the new one. `reloading` false means it already tried.
  const [reloading, setReloading] = useState(stale);
  useEffect(() => {
    if (stale && !reloadForNewBuild()) setReloading(false);
  }, [stale]);
  if (stale)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground" data-testid="stale-build">
        <span className="text-muted-foreground" aria-hidden="true">
          <RefreshCw className={`size-10 ${reloading ? "animate-spin" : ""}`} strokeWidth={2} />
        </span>
        <h1 className="font-display text-lg font-medium">A New Version Is Out</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {reloading
            ? "The desk was updated since this tab opened. Loading the new version…"
            : "The desk was updated since this tab opened, and this page couldn't load. Reload to get the new version."}
        </p>
        {reloading ? null : (
          <button
            type="button"
            className="mt-2 h-10 rounded-full bg-ink px-4 text-sm font-medium text-ink-foreground"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        )}
      </main>
    );
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <span className="text-destructive" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-lg font-medium">Something Went Wrong</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">
        {(error instanceof Error ? error.message : "") || "An unexpected error occurred. Try reloading the page."}
      </p>
      <button
        type="button"
        className="mt-2 h-10 rounded-full bg-ink px-4 text-sm font-medium text-ink-foreground"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </main>
  );
}

/**
 * A wrong address (11/16): say so, with a way back. A plain link, so it works whatever part of the app failed to match.
 * A block, not a page: under the app's menu it sits inside the page area, and with no menu it fills the window.
 */
export function AppNotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center text-foreground" data-testid="not-found">
      <span className="text-muted-foreground" aria-hidden="true">
        <Compass className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-lg font-medium">Page Not Found</h1>
      <p className="max-w-md text-sm text-muted-foreground">Nothing is at this address. Check the link, or go back to Coming Due and use the menu.</p>
      <a href="/" className="mt-2 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-ink-foreground">
        Go to Coming Due
      </a>
    </div>
  );
}
