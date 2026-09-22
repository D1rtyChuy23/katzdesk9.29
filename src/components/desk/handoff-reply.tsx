import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addComment } from "@/lib/ops/api";
import { listTeammates } from "@/lib/ops/notify";
import { Button } from "@/components/ui/button";
import { MentionBody, MentionField } from "./mention-field";
import { toast } from "sonner";
import type { Comment } from "@/lib/ops/types";

export function HandoffReply({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<Comment[]>([]);
  const teammates = useQuery({
    queryKey: ["teammates"],
    queryFn: () => listTeammates(),
    enabled: open,
  });
  const send = useMutation({
    mutationFn: () =>
      addComment({
        data: {
          entityType,
          entityId,
          body,
          askTeam: null,
        },
      }),
    onSuccess: (saved) => {
      setBody("");
      setOpen(false);
      setSent((prev) => [...prev, saved]);
      void qc.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
      void qc.invalidateQueries({ queryKey: ["activity", entityType, entityId] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send"),
  });

  return (
    <div className="min-w-0">
      {sent.length ? (
        <ul className="mb-2 space-y-2">
          {sent.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-xs font-medium">
                {c.ownerLabel}
                <span className="ml-1 font-normal text-muted-foreground">replied</span>
              </p>
              <div className="mt-1 text-sm leading-relaxed">
                <MentionBody text={c.body} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate();
          }}
        >
          <MentionField
            multiline
            value={body}
            onChange={setBody}
            teammates={teammates.data ?? []}
            placeholder="Write a reply…"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setBody("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={send.isPending || !body.trim()}>
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          Reply
        </button>
      )}
    </div>
  );
}

