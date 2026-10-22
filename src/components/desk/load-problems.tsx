import { useEffect, useRef, useState } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { describeLoadError, isExpectedRefusal, loadProblemReport, nounForQueryKey, type LoadProblemKind } from "@/lib/ops/load-problem";

type Failed = { hash: string; noun: string; message: string; kind: LoadProblemKind; stale: boolean };

/** Queries on the current page (they have a watcher) whose last load failed. A query can opt out with meta.quietErrors. */
function failedQueries(queries: Query[]): Failed[] {
  const out: Failed[] = [];
  for (const q of queries) {
    if (q.state.status !== "error" || q.getObserversCount() === 0 || q.meta?.quietErrors) continue;
    const { kind, message } = describeLoadError(q.state.error);
    if (isExpectedRefusal(message)) continue;
    out.push({ hash: q.queryHash, noun: nounForQueryKey(q.queryKey), message, kind, stale: q.state.data !== undefined });
  }
  return out;
}

/**
 * The page's data didn't load: say so, with the server's message, Try again and Copy error. Shown above every page in
 * the app layout, so a failed load never reads as an empty list ("Prep (0)" looked like the installs were gone).
 */
export function LoadProblems() {
  const qc = useQueryClient();
  const location = useLocation();
  const [failed, setFailed] = useState<Failed[]>([]);
  const signature = useRef("");
  useEffect(() => {
    const cache = qc.getQueryCache();
    const read = () => {
      const next = failedQueries(cache.getAll());
      const sig = next.map((f) => `${f.hash}|${f.message}|${f.stale}`).join("\n");
      if (sig === signature.current) return;
      signature.current = sig;
      setFailed(next);
    };
    read();
    return cache.subscribe(read);
  }, [qc]);
  if (!failed.length) return null;

  const retry = () => {
    const hashes = new Set(failed.map((f) => f.hash));
    void qc.refetchQueries({ predicate: (q) => hashes.has(q.queryHash) });
  };
  const shown = failed.filter((f, i) => failed.findIndex((g) => g.noun === f.noun && g.message === f.message) === i);
  const copy = async () => {
    const page = `${location.pathname}${location.searchStr ?? ""}`;
    try {
      await navigator.clipboard.writeText(loadProblemReport(page, shown, new Date().toLocaleString()));
      toast.success("Error copied");
    } catch {
      toast.error("Could not copy");
    }
  };
  const nouns = [...new Set(shown.map((f) => f.noun))];
  const list = nouns.length > 2 ? `${nouns.slice(0, -1).join(", ")} and ${nouns.at(-1)}` : nouns.join(" and ");

  let title: string;
  let body: string;
  let action = (
    <Button type="button" size="sm" onClick={retry} data-testid="load-problems-retry">
      Try again
    </Button>
  );
  if (shown.some((f) => f.kind === "signed-out")) {
    title = "You're signed out";
    body = `Sign in again to see ${list}.`;
    action = (
      <Button type="button" size="sm" onClick={() => window.location.assign("/login")} data-testid="load-problems-signin">
        Sign in
      </Button>
    );
  } else if (shown.every((f) => f.kind === "offline")) {
    title = "Can't reach Katz Desk";
    body = "Check your connection, then try again.";
  } else if (shown.every((f) => f.stale)) {
    title = `Couldn't refresh ${list}`;
    body = "Showing what loaded earlier. Nothing was deleted.";
  } else {
    title = `Couldn't load ${list}`;
    body = "Nothing was deleted: the list couldn't be read. Counts show — until it loads.";
  }

  return (
    <div role="alert" className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3" data-testid="load-problems">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
          {shown.some((f) => f.kind === "server") ? (
            <ul className="mt-2 grid gap-1 text-xs break-words text-muted-foreground" data-testid="load-problems-messages">
              {shown
                .filter((f) => f.kind === "server")
                .map((f) => (
                  <li key={`${f.noun}|${f.message}`}>
                    <span className="font-medium text-foreground">{f.noun}:</span> {f.message}
                  </li>
                ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {action}
            <Button type="button" size="sm" variant="outline" onClick={() => void copy()} data-testid="load-problems-copy">
              Copy error
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
