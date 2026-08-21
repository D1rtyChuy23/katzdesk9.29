import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addComment, listComments, resolveComment } from "@/lib/ops/api";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PingButton } from "./ping-button";
import { toast } from "sonner";

export function Thread({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [ask, setAsk] = useState<"" | "sales" | "service">("");
  const comments = useQuery({
    queryKey: ["comments", entityType, entityId],
    queryFn: () => listComments({ data: { entityType, entityId } }),
  });
  const add = useMutation({
    mutationFn: () =>
      addComment({
        data: {
          entityType,
          entityId,
          body,
          askTeam: ask || null,
          authorName: user?.displayName ?? user?.primaryEmail ?? "Teammate",
        },
      }),
    onSuccess: () => {
      setBody("");
      setAsk("");
      void qc.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
      void qc.invalidateQueries({ queryKey: ["handoff"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="px-5 pt-4 font-display text-lg font-medium">Handoff notes</h3>
      <p className="px-5 text-xs text-muted-foreground">
        Sales and service talk here — no more buried spreadsheet comments.
      </p>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {(comments.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet. Leave the first one.</p>
        ) : (
          comments.data!.map((c) => (
            <article key={c.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{c.authorName ?? "Teammate"}</p>
                <time className="text-xs text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{c.body}</p>
              {c.askTeam && !c.resolved ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="warn">Ask {c.askTeam}</Badge>
                  <PingButton
                    size="xs"
                    entityType={entityType}
                    entityId={entityId}
                    contextLabel={`${entityType} #${entityId} · ${c.body.slice(0, 80)}`}
                  />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => resolve.mutate(c.id)}
                  >
                    Mark answered
                  </button>
                </div>
              ) : null}
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
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note for the other team…"
          rows={3}
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
