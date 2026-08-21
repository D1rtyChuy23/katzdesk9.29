import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { listTeammates, sendPing } from "@/lib/ops/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PingButton({
  entityType,
  entityId,
  contextLabel,
  size = "sm",
  className,
}: {
  entityType?: string | null;
  entityId?: number | null;
  contextLabel: string;
  size?: "sm" | "xs";
  className?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const people = useQuery({ queryKey: ["teammates"], queryFn: () => listTeammates(), enabled: open });
  const ping = useMutation({
    mutationFn: (toUserId: string) => {
      const extra = note.trim();
      return sendPing({
        data: {
          toUserId,
          body: extra ? `${extra} — ${contextLabel}` : `Follow up: ${contextLabel}`,
          entityType: entityType ?? null,
          entityId: entityId ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ping sent — they’ll see it in the bell");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not ping"),
  });

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setNote("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(size === "xs" && "h-8 px-2 text-xs", className)}
        >
          <BellRing className="size-3.5" />
          Ping
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <p className="px-2 py-1 text-xs text-muted-foreground">Send a reminder to…</p>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. need an ETA)"
          className="mb-2 h-9"
        />
        {people.isLoading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading teammates…</p>
        ) : (people.data ?? []).length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No other approved accounts yet. Once a teammate is on the desk, you can ping them here.
          </p>
        ) : (
          <ul>
            {(people.data ?? []).map((p) => (
              <li key={p.userId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  disabled={ping.isPending}
                  onClick={() => ping.mutate(p.userId)}
                >
                  <Bell className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 truncate font-medium">{p.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
