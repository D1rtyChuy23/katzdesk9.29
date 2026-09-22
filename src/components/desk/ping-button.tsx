import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { listTeammates, sendPing } from "@/lib/ops/notify";
import { applyMention, parseMentions } from "@/lib/ops/mentions";
import { formatPingTime } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MentionField } from "./mention-field";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PingButton({
  entityType,
  entityId,
  commentId,
  pingedAt,
  contextLabel,
  defaultNote = "",
  size = "sm",
  className,
}: {
  entityType?: string | null;
  entityId?: number | null;
  commentId?: number | null;
  pingedAt?: string | null;
  contextLabel: string;
  defaultNote?: string;
  size?: "sm" | "xs";
  className?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [doneAt, setDoneAt] = useState<string | null>(pingedAt ?? null);
  const locked = useRef(!!pingedAt);
  useEffect(() => {
    if (pingedAt) {
      setDoneAt(pingedAt);
      locked.current = true;
    }
  }, [pingedAt]);
  const people = useQuery({ queryKey: ["teammates"], queryFn: () => listTeammates(), enabled: open });
  const ping = useMutation({
    mutationFn: (d: { toUserId?: string; usernames?: string[]; body?: string }) => {
      if (commentId && locked.current) {
        return Promise.resolve({ sent: [] as string[], already: true, pingedAt: doneAt });
      }
      if (commentId) locked.current = true;
      const extra = (d.body ?? note).trim();
      const tagged = parseMentions(extra);
      return sendPing({
        data: {
          toUserId: d.toUserId,
          usernames: d.usernames ?? (tagged.length ? tagged : undefined),
          body: extra || `Follow up: ${contextLabel}`,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
          commentId: commentId ?? null,
        },
      });
    },
    onSuccess: (res) => {
      const at = res.pingedAt ?? doneAt ?? new Date().toISOString();
      setDoneAt(at);
      locked.current = true;
      if (res.already) {
        toast.message("Already pinged this note", {
          description: at ? formatPingTime(at) : "Only one ping is sent per note.",
        });
      } else {
        const names = res.sent.map((n) => `@${n}`).join(", ");
        toast.success(`Pinged ${names} · ${formatPingTime(at)}`);
      }
      setNote("");
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["comments"] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      setOpen(false);
    },
    onError: (e) => {
      if (commentId) locked.current = !!doneAt;
      toast.error(e instanceof Error ? e.message : "Could not ping");
    },
  });

  const stamped = commentId ? pingedAt ?? doneAt : null;
  if (stamped) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={cn(size === "xs" && "h-8 px-2 text-xs", className)}
        title={`Pinged ${formatPingTime(stamped)} — only one ping per note`}
      >
        <BellRing className="size-3.5" />
        Pinged
        <time className="font-normal text-muted-foreground" dateTime={stamped}>
          {formatPingTime(stamped)}
        </time>
      </Button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (v) {
          if (locked.current) return;
          const tagged = parseMentions(defaultNote);
          if (tagged.length) {
            ping.mutate({ usernames: tagged, body: defaultNote });
            return;
          }
          setNote(defaultNote || note);
        } else {
          setNote("");
        }
        setOpen(v);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(size === "xs" && "h-8 px-2 text-xs", className)}
          disabled={ping.isPending}
        >
          <BellRing className="size-3.5" />
          Ping
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        <p className="px-2 py-1 text-xs text-muted-foreground">
          Tag someone — e.g. @josh see this and respond asap — then Ping. One ping per note.
        </p>
        <MentionField
          value={note}
          onChange={setNote}
          teammates={people.data ?? []}
          placeholder="@username + a short note"
          className="mb-2 h-9"
        />
        <Button
          type="button"
          size="sm"
          className="mb-2 w-full"
          disabled={ping.isPending || (!parseMentions(note).length && !note.trim())}
          onClick={() => ping.mutate({ usernames: parseMentions(note) })}
        >
          Ping tagged teammates
        </Button>
        {people.isLoading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading teammates…</p>
        ) : (people.data ?? []).length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No other approved accounts yet. Once a teammate is on the desk, tag them with @username.
          </p>
        ) : (
          <ul>
            {(people.data ?? []).map((p) => (
              <li key={p.userId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  disabled={ping.isPending}
                  onClick={() => {
                    if (!parseMentions(note).map((n) => n.toLowerCase()).includes(p.username.toLowerCase())) {
                      setNote(applyMention(note || "", p.username));
                    }
                    ping.mutate({ toUserId: p.userId, usernames: parseMentions(note).concat(p.username) });
                  }}
                >
                  <Bell className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 truncate font-medium">@{p.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
