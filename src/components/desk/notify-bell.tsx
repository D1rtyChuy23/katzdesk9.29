import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Search } from "lucide-react";
import { listNotifications, markNotificationRead, type DeskNotice, type PingKind } from "@/lib/ops/notify";
import { pathFor } from "./open-link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatPingTime } from "@/lib/ops/clock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ReadFilter = "unread" | "read" | "all";

const KIND_LABEL: Record<PingKind, string> = {
  ticket: "Tickets",
  install: "Installs",
  handoff: "Handoff",
  warehouse: "Warehouse",
  customer: "Customers",
  deal: "Deals",
  rebuild: "Rebuilds",
  other: "Other",
};

const READ_KEY = "katz-pings-filter";

function headline(n: DeskNotice): string {
  if (n.body.startsWith("Needs review")) return "Needs review";
  if (n.body.startsWith("Pending removal")) return "Pending removal";
  if (n.body.startsWith("Pending customer assign")) return "Pending assign";
  if (n.body.startsWith("Pending module return")) return "Pending return";
  return "pinged you";
}

/** Label for the bold line: the account, or the rack slot for warehouse pings. */
function subject(n: DeskNotice): string | null {
  if (!n.customer) return null;
  if (n.kind === "warehouse" && /^[A-P]-L\d/i.test(n.customer)) return `Warehouse · ${n.customer}`;
  return n.customer;
}

export function NotifyBell({ ink }: { ink?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [kind, setKind] = useState<PingKind | "">("");
  const [account, setAccount] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(READ_KEY);
      if (saved === "unread" || saved === "read" || saved === "all") setReadFilter(saved);
    } catch {
      /* private mode */
    }
  }, []);
  function pickRead(v: ReadFilter) {
    setReadFilter(v);
    try {
      window.localStorage.setItem(READ_KEY, v);
    } catch {
      /* private mode */
    }
  }

  const inbox = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 8_000,
  });
  const mark = useMutation({
    mutationFn: (d: { id?: number; all?: boolean }) => markNotificationRead({ data: d }),
    onMutate: async (d) => {
      // Flip it right away so the Unread count and list update without waiting for the refresh.
      await qc.cancelQueries({ queryKey: ["notifications"] });
      qc.setQueryData<DeskNotice[]>(["notifications"], (old) =>
        (old ?? []).map((n) => (d.all || n.id === d.id ? { ...n, read: true } : n)),
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const rows = inbox.data ?? [];
  const unread = rows.filter((n) => !n.read).length;
  const primed = useRef(false);
  const prevUnread = useRef(0);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      prevUnread.current = unread;
      return;
    }
    if (unread > prevUnread.current) {
      const newest = rows.find((n) => !n.read);
      const review = newest?.body?.includes("Needs review");
      toast.message(review ? "Rack needs review" : `${newest?.fromName ?? "Teammate"} pinged you`, {
        description: [newest?.customer, newest?.body, newest?.createdAt ? formatPingTime(newest.createdAt) : null]
          .filter(Boolean)
          .join(" · "),
      });
    }
    prevUnread.current = unread;
  }, [unread, rows]);

  // Type and account filters narrow first; the Unread/Read/All counts then reflect that slice.
  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((n) => {
      if (kind && n.kind !== kind) return false;
      if (account && (n.customer ?? "") !== account) return false;
      if (needle) {
        const hay = [n.fromName, n.customer, n.body].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, kind, account, q]);
  const counts = {
    unread: scoped.filter((n) => !n.read).length,
    read: scoped.filter((n) => n.read).length,
    all: scoped.length,
  };
  const shown = scoped.filter((n) => (readFilter === "all" ? true : readFilter === "unread" ? !n.read : n.read));
  const kinds = useMemo(() => {
    const m = new Map<PingKind, number>();
    for (const n of rows) m.set(n.kind, (m.get(n.kind) ?? 0) + (n.read ? 0 : 1));
    return [...m.entries()];
  }, [rows]);
  const accounts = useMemo(
    () =>
      [...new Set(rows.filter((n) => n.kind !== "warehouse").map((n) => n.customer).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );

  function openPing(n: DeskNotice) {
    if (!n.read) mark.mutate({ id: n.id });
    const t = n.target;
    if (!t) {
      toast.error("That record was removed, so there's nothing to open.");
      return;
    }
    setOpen(false);
    if (t.fallback) {
      toast.message(
        t.type === "customer" ? "That record was removed — opened the account instead." : "That record was removed.",
      );
    }
    const to = pathFor(t.type);
    if (t.id && to !== "/" && t.type !== "handoff") {
      void navigate({ to, search: { open: t.id } });
    } else if (t.type === "handoff" && n.commentId) {
      void navigate({ to: "/handoff", search: { open: n.commentId } });
    } else {
      void navigate({ to });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("relative", ink && "text-cream hover:bg-cream/10 hover:text-cream")}
          aria-label={unread ? `${unread} notifications` : "Notifications"}
        >
          <Bell className="size-5" />
          {unread ? (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,calc(100vw-1.5rem))] p-0" align="end" data-testid="pings-panel">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Pings</p>
          {unread ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => mark.mutate({ all: true })}
            >
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="space-y-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-full border border-border" role="tablist" aria-label="Show pings">
              {(
                [
                  ["unread", "Unread"],
                  ["read", "Read"],
                  ["all", "All"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={readFilter === id}
                  data-testid={`pings-${id}`}
                  onClick={() => pickRead(id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium tabular",
                    readFilter === id ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label} {counts[id]}
                </button>
              ))}
            </div>
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search pings"
                aria-label="Search pings"
                className="h-7 w-full rounded-full border border-border bg-background pr-2 pl-7 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>
          {kinds.length > 1 || accounts.length > 1 ? (
            <div className="flex items-center gap-2">
              {kinds.length > 1 ? (
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as PingKind | "")}
                  aria-label="Filter pings by type"
                  className="h-7 min-w-0 flex-1 rounded-full border border-border bg-background px-2 text-xs"
                >
                  <option value="">All types</option>
                  {kinds.map(([k, n]) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                      {n ? ` (${n} unread)` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              {accounts.length > 1 ? (
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  aria-label="Filter pings by account"
                  className="h-7 min-w-0 flex-1 rounded-full border border-border bg-background px-2 text-xs"
                >
                  <option value="">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            No pings yet. Teammates can remind you from Handoff or any job note.
          </p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground" data-testid="pings-empty">
            {readFilter === "unread" ? "You're all caught up — no unread pings here." : "No pings match these filters."}
          </p>
        ) : (
          <ul className="max-h-[min(24rem,60vh)] overflow-y-auto" data-testid="pings-list">
            {shown.map((n) => (
              <li key={n.id} className={cn("border-b border-border last:border-b-0", !n.read && "bg-primary/6")}>
                <button
                  type="button"
                  onClick={() => openPing(n)}
                  data-testid="ping-row"
                  data-read={n.read ? "1" : "0"}
                  className="relative block w-full px-3 py-2.5 text-left hover:bg-muted/60"
                >
                  {!n.read ? (
                    <span aria-label="Unread" className="absolute top-3.5 left-1 size-1.5 rounded-full bg-primary" />
                  ) : null}
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className={cn(!n.read && "font-semibold", n.read && "font-medium")}>{n.fromName ?? "Teammate"}</span>
                      <span className="text-muted-foreground"> · {headline(n)}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {KIND_LABEL[n.kind]}
                    </span>
                  </p>
                  {subject(n) ? <p className="mt-0.5 truncate text-xs font-medium">{subject(n)}</p> : null}
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <time className="mt-1 block text-[11px] text-muted-foreground" dateTime={n.createdAt}>
                    {formatPingTime(n.createdAt)}
                    {n.target?.fallback ? " · record removed, opens the account" : ""}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
