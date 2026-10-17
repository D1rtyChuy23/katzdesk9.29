import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveTeamsChat, teamsChatBoard, type TeamsChatCard } from "@/lib/ops/teams-reports";
import { TEAMS_CHATS, type TeamsChatGroup } from "@/lib/ops/teams-message";

const GROUPS: TeamsChatGroup[] = ["Service", "Orders", "Reps", "Regions", "Leadership", "Techs"];

/**
 * The exact note for each group chat and DM. Approving stores that text.
 * Nothing is posted from here.
 */
export function TeamsMorningPanel({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const board = useQuery({ queryKey: ["teams-chats"], queryFn: () => teamsChatBoard(), enabled });
  const [picked, setPicked] = useState<string>("big-tymers");
  const approve = useMutation({
    mutationFn: (card: TeamsChatCard) => approveTeamsChat({ data: { chat: card.id, text: card.text } }),
    onSuccess: (r) => {
      toast.success(`Approved for ${r.name}. Nothing was posted.`);
      void qc.invalidateQueries({ queryKey: ["teams-chats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });
  if (!enabled) return null;
  const cards = board.data ?? [];
  const current = cards.find((c) => c.id === picked) ?? cards[0];
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-soft" data-testid="teams-chats">
      <h2 className="font-display text-xl font-medium tracking-tight">Teams chats</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Group chats and DMs. Read the exact text, then approve it. KatzDesk does not post. The Teams login sends only the text you approved.
      </p>
      {board.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Reading the desk…</p> : null}
      {board.isError ? (
        <p className="mt-4 text-sm text-destructive">{board.error instanceof Error ? board.error.message : "Could not read the chats."}</p>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</p>
              <ul className="mt-1">
                {TEAMS_CHATS.filter((c) => c.group === group).map((chat) => {
                  const card = cards.find((c) => c.id === chat.id);
                  const on = current?.id === chat.id;
                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(chat.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${on ? "bg-secondary font-medium" : "hover:bg-muted"}`}
                        data-testid={`teams-chat-${chat.id}`}
                      >
                        <span className="truncate">{chat.name}</span>
                        {card?.approved ? <Check className="size-3.5 shrink-0 text-primary" aria-label="Approved" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        {current ? (
          <div>
            <p className="text-sm font-medium">{current.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{current.about}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {current.approved ? `Approved${current.approvedBy ? ` by ${current.approvedBy}` : ""}` : "Not approved"}
            </p>
            <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap" data-testid="teams-chat-text">
              {current.text}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={approve.isPending || current.approved}
                onClick={() => approve.mutate(current)}
                data-testid="teams-approve"
              >
                {current.approved ? "Approved" : approve.isPending ? "Saving…" : "Approve this exact text"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(current.text).then(
                    () => toast.success("Copied"),
                    () => toast.error("Could not copy"),
                  );
                }}
                data-testid="teams-copy"
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
