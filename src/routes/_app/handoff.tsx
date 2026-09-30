import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseOpenSearch } from "@/lib/ops/search-params";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getHandoff, handoffDeal, resolveComment, claimComment } from "@/lib/ops/api";
import { namesMatchUser } from "@/lib/ops/lookups";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getMyAccess } from "@/lib/ops/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpenLink } from "@/components/desk/open-link";
import { PingButton } from "@/components/desk/ping-button";
import { HandoffReply } from "@/components/desk/handoff-reply";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, sortDesk } from "@/lib/ops/sort";
import { toast } from "sonner";
import type { HandoffFeed } from "@/lib/ops/types";

export const Route = createFileRoute("/_app/handoff")({ validateSearch: parseOpenSearch, component: Page });

type Scope = "mine" | "all";

function Page() {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const access = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const feed = useQuery({ queryKey: ["handoff"], queryFn: () => getHandoff() });
  const [scope, setScope] = useState<Scope>("mine");
  useEffect(() => {
    try {
      if (window.localStorage.getItem("katz-handoff-view") === "all") setScope("all");
    } catch {
      /* private mode */
    }
  }, []);
  const [sort, setSort] = useDeskSort("handoff", "date-desc");
  // ?open=<note id> from a ping: show everyone's notes, scroll to that thread, and flash it.
  const { open } = Route.useSearch();
  const navigate = useNavigate();
  const [flash, setFlash] = useState<number | null>(null);
  useEffect(() => {
    if (open != null) setScope("all");
  }, [open]);
  useEffect(() => {
    if (open == null || !feed.data) return;
    const all = [...feed.data.asks, ...feed.data.recent];
    const hit = all.find((c) => c.id === open);
    if (!hit) {
      toast.message("That note isn't on the board anymore — nothing left to answer here.");
      void navigate({ to: "/handoff", search: {}, replace: true });
      return;
    }
    const t = window.setTimeout(() => {
      document.getElementById(`handoff-note-${open}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(open);
    }, 60);
    const clear = window.setTimeout(() => setFlash(null), 3200);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(clear);
    };
  }, [open, feed.data, navigate]);
  const resolve = useMutation({
    mutationFn: (id: number) => resolveComment({ data: { id, resolved: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const claim = useMutation({
    mutationFn: (id: number) => claimComment({ data: { id } }),
    onSuccess: () => {
      toast.success("Note is under your name");
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["comments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not claim"),
  });
  const promote = useMutation({
    mutationFn: (dealId: number) => handoffDeal({ data: { dealId } }),
    onSuccess: () => {
      toast.success("Install row created");
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const d = feed.data;
  const filtered = useMemo(
    () => filterHandoff(d, user, access.data?.username ?? null, scope),
    [d, user, access.data?.username, scope],
  );
  const sortedAsks = useMemo(
    () =>
      sortDesk(filtered.asks, sort, {
        date: (c) => c.createdAt,
        name: (c) => c.customer ?? c.ownerLabel,
      }),
    [filtered.asks, sort],
  );
  const sortedRecent = useMemo(
    () =>
      sortDesk(filtered.recent, sort, {
        date: (c) => c.createdAt,
        name: (c) => c.customer ?? c.ownerLabel,
      }),
    [filtered.recent, sort],
  );
  const mineCount = useMemo(() => {
    const mine = filterHandoff(d, user, access.data?.username ?? null, "mine");
    const askIds = new Set(mine.asks.map((c) => c.id));
    return (
      mine.pendingHandoffs.length +
      mine.asks.length +
      mine.recent.filter((c) => !askIds.has(c.id)).length
    );
  }, [d, user, access.data?.username]);

  function setView(next: Scope) {
    setScope(next);
    try {
      window.localStorage.setItem("katz-handoff-view", next);
    } catch {
      /* private mode */
    }
  }

  const emptyMine =
    scope === "mine" &&
    !!d &&
    !filtered.pendingHandoffs.length &&
    !filtered.asks.length &&
    !filtered.recent.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Handoff</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The conversation between sales and service. Mine shows asks, notes, and completed deals that
          belong to you. Notes without a poster show as Service until someone claims them.
        </p>
      </header>

      <div className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 w-fit items-center rounded-full bg-secondary p-1">
          <button
            type="button"
            onClick={() => setView("mine")}
            className={`h-8 rounded-full px-3.5 text-sm font-medium ${
              scope === "mine" ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70"
            }`}
          >
            Mine ({mineCount})
          </button>
          <button
            type="button"
            onClick={() => setView("all")}
            className={`h-8 rounded-full px-3.5 text-sm font-medium ${
              scope === "all" ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70"
            }`}
          >
            All
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SortSelect value={sort} onChange={setSort} options={[...SORT_DATE, ...SORT_ALPHA]} />
          <PingButton contextLabel="Check the handoff board" entityType="handoff" />
        </div>
      </div>

      {feed.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the desk…</p>
      ) : emptyMine ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="font-medium">Nothing of yours is waiting.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mine shows notes you wrote, jobs assigned to you, and deals you produced. Switch to All
            to see the rest of the desk.
          </p>
        </section>
      ) : (
        <>
      {filtered.pendingHandoffs.length ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Completed deals not yet on the install board</h2>
          <ul className="mt-3 divide-y divide-border">
            {filtered.pendingHandoffs.map((p) => (
              <li key={p.dealId} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.producer ?? "—"} · {p.equipment}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PingButton
                      size="xs"
                      entityType="deal"
                      entityId={p.dealId}
                      contextLabel={`${p.customer} deal is complete but not on the install board`}
                    />
                    <Button size="sm" onClick={() => promote.mutate(p.dealId)} disabled={promote.isPending}>
                      Send to installs
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <HandoffReply entityType="deal" entityId={p.dealId} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Open asks</h2>
          {!filtered.asks.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {scope === "mine" ? "No open asks on your work." : "No unanswered asks. Nice."}
            </p>
          ) : (
            <ul className="mt-3 space-y-4">
              {sortedAsks.map((c) => (
                <li
                  key={c.id}
                  id={`handoff-note-${c.id}`}
                  className={cn(
                    "scroll-mt-24 rounded-lg border border-border bg-background p-3 transition-shadow",
                    flash === c.id && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warn">Ask {c.askTeam}</Badge>
                    <OpenLink
                      entityType={c.entityType}
                      id={c.entityId}
                      className="text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {c.customer ?? c.entityType}
                    </OpenLink>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{c.body}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{c.ownerLabel}</p>
                    <div className="flex items-center gap-2">
                      {c.canClaim ? (
                        <button
                          type="button"
                          className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          disabled={claim.isPending}
                          onClick={() => claim.mutate(c.id)}
                        >
                          Claim
                        </button>
                      ) : null}
                      <PingButton
                        size="xs"
                        entityType={c.entityType}
                        entityId={c.entityId}
                        commentId={c.id}
                        pingedAt={c.pingedAt}
                        contextLabel={`${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`}
                        defaultNote={c.body}
                      />
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => resolve.mutate(c.id)}
                      >
                        Mark answered
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <HandoffReply entityType={c.entityType} entityId={c.entityId} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Recent notes</h2>
          {!filtered.recent.length ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {scope === "mine" ? "No recent notes on your work." : "No notes yet."}
            </p>
          ) : (
            <ul className="mt-3 space-y-4">
              {sortedRecent.map((c) => (
                <li
                  key={c.id}
                  id={`handoff-note-${c.id}`}
                  className={cn(
                    "scroll-mt-24 rounded-md transition-shadow",
                    flash === c.id && "ring-2 ring-primary ring-offset-4 ring-offset-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">{c.ownerLabel}</span>
                      <span className="text-muted-foreground"> · {c.customer ?? c.entityType}</span>
                    </p>
                    <div className="flex items-center gap-1">
                      {c.canClaim ? (
                        <button
                          type="button"
                          className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          disabled={claim.isPending}
                          onClick={() => claim.mutate(c.id)}
                        >
                          Claim
                        </button>
                      ) : null}
                      <PingButton
                        size="xs"
                        entityType={c.entityType}
                        entityId={c.entityId}
                        commentId={c.id}
                        pingedAt={c.pingedAt}
                        contextLabel={`${c.customer ?? c.entityType} · ${c.body.slice(0, 80)}`}
                        defaultNote={c.body}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                  <div className="mt-2">
                    <HandoffReply entityType={c.entityType} entityId={c.entityId} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
        </>
      )}
    </div>
  );
}

function filterHandoff(
  d: HandoffFeed | undefined,
  user: { id: string; displayName: string | null; primaryEmail: string | null } | null,
  username: string | null,
  scope: Scope,
): HandoffFeed {
  const empty: HandoffFeed = { asks: [], recent: [], pendingHandoffs: [] };
  if (!d) return empty;
  if (scope === "all") return d;
  const asUser = {
    displayName: [user?.displayName, username].filter(Boolean).join(" ") || user?.displayName || null,
    primaryEmail: user?.primaryEmail ?? null,
  };
  const mine = (c: {
    authorId: string | null;
    authorName: string | null;
    technician?: string | null;
    producer?: string | null;
    accountRep?: string | null;
  }) =>
    (!!user?.id && c.authorId === user.id) ||
    namesMatchUser(asUser, c.authorName, c.technician, c.producer, c.accountRep);
  return {
    pendingHandoffs: d.pendingHandoffs.filter((p) => namesMatchUser(asUser, p.producer)),
    asks: d.asks.filter((c) => mine(c)),
    recent: d.recent.filter((c) => mine(c)),
  };
}
