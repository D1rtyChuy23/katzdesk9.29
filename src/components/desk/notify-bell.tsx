import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationRead } from "@/lib/ops/notify";
import { OpenLink } from "./open-link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatPingTime } from "@/lib/ops/clock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function NotifyBell({ ink }: { ink?: boolean }) {
  const qc = useQueryClient();
  const inbox = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 8_000,
  });
  const mark = useMutation({
    mutationFn: (d: { id?: number; all?: boolean }) => markNotificationRead({ data: d }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
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
      toast.message(`${newest?.fromName ?? "Teammate"} pinged you`, {
        description: [newest?.customer, newest?.body, newest?.createdAt ? formatPingTime(newest.createdAt) : null]
          .filter(Boolean)
          .join(" · "),
      });

    }
    prevUnread.current = unread;
  }, [unread, rows]);

  return (
    <Popover>
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
      <PopoverContent className="w-80 p-0" align="end">
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
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            No pings yet. Teammates can remind you from Handoff or any job note.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {rows.map((n) => (
              <li key={n.id} className={cn("border-b border-border last:border-b-0", !n.read && "bg-primary/6")}>
                <OpenLink
                  entityType={n.entityType ?? "handoff"}
                  id={n.entityId ?? 0}
                  className="block px-3 py-2.5 text-left hover:bg-muted/60"
                >
                  <span
                    role="presentation"
                    onClick={() => {
                      if (!n.read) mark.mutate({ id: n.id });
                    }}
                  >
                    <p className="text-sm">
                      <span className="font-medium">{n.fromName ?? "Teammate"}</span>
                      <span className="text-muted-foreground"> pinged you</span>
                    </p>
                    {n.customer ? (
                      <p className="mt-0.5 truncate text-xs font-medium">{n.customer}</p>
                    ) : null}
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>

                    <time className="mt-1 block text-[11px] text-muted-foreground" dateTime={n.createdAt}>
                      {formatPingTime(n.createdAt)}
                    </time>
                  </span>
                </OpenLink>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
