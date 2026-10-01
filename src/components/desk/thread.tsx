import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addComment, claimComment, listComments, resolveComment } from "@/lib/ops/api";
import { listTeammates } from "@/lib/ops/notify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PingButton } from "./ping-button";
import { ActivityTrail } from "./activity-trail";
import { MentionBody, MentionField } from "./mention-field";
import { toast } from "sonner";

export function Thread({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [ask, setAsk] = useState<"" | "sales" | "service">("");
  const comments = useQuery({
    queryKey: ["comments", entityType, entityId],
    queryFn: () => listComments({ data: { entityType, entityId } }),
  });
  const teammates = useQuery({ queryKey: ["teammates"], queryFn: () => listTeammates() });
  const add = useMutation({
    mutationFn: () =>
      addComment({
        data: {
          entityType,
          entityId,
          body,
          askTeam: ask || null,
        },
      }),
    onSuccess: () => {
      setBody("");
      setAsk("");
      void qc.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
      void qc.invalidateQueries({ queryKey: ["activity", entityType, entityId] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolve = useMutation({
    mutationFn: (id: number) => resolveComment({ data: { id, resolved: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const claim = useMutation({
    mutationFn: (id: number) => claimComment({ data: { id } }),
    onSuccess: () => {
      toast.success("Note is under your name");
      void qc.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col">
      <ActivityTrail entityType={entityType} entityId={entityId} />
      <h3 className="px-5 pt-4 font-display text-lg font-medium">Handoff Notes</h3>
      <p className="px-5 text-xs text-muted-foreground">
        Tag a teammate with @username. Ping sends them a bell notification.
      </p>
      <div className="space-y-3 px-5 py-4">
        {(comments.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet. Leave the first one.</p>
        ) : (
          comments.data!.map((c) => (
            <article key={c.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.ownerLabel}</p>
                <time className="text-xs text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <MentionBody text={c.body} />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.askTeam && !c.resolved ? <Badge variant="warn">Ask {c.askTeam}</Badge> : null}
                <PingButton
                  size="xs"
                  entityType={entityType}
                  entityId={entityId}
                  commentId={c.id}
                  pingedAt={c.pingedAt}
                  contextLabel={`${entityType} #${entityId} · ${c.body.slice(0, 80)}`}
                  defaultNote={c.body}
                />
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
                {c.askTeam && !c.resolved ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => resolve.mutate(c.id)}
                  >
                    Mark answered
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
      <form
        className="border-t border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.mutate();
        }}
      >
        <MentionField
          multiline
          value={body}
          onChange={setBody}
          teammates={teammates.data ?? []}
          placeholder="Write a note… tag @username to ping them"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {(["", "sales", "service"] as const).map((v) => (
              <button
                key={v || "none"}
                type="button"
                onClick={() => setAsk(v)}
                className={`h-8 rounded-full px-3 text-xs font-medium ${
                  ask === v ? "bg-ink text-ink-foreground" : "bg-muted text-foreground"
                }`}
              >
                {v === "" ? "Note" : v === "sales" ? "Ask sales" : "Ask service"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PingButton
              size="xs"
              entityType={entityType}
              entityId={entityId}
              contextLabel={`Follow up on this ${entityType}`}
              defaultNote={body}
            />
            <Button type="submit" size="sm" disabled={add.isPending || !body.trim()}>
              Post
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
