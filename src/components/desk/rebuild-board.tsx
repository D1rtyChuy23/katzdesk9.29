import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Trash2 } from "lucide-react";
import { archiveRebuild, HEALTH_LABEL, REBUILD_STATUSES, updateRebuild, type Rebuild } from "@/lib/ops/rebuilds";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./flag-badge";
import { formatShortDate } from "@/lib/ops/clock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function HealthBadge({ health }: { health: Rebuild["health"] }) {
  const variant =
    health === "overdue"
      ? "danger"
      : health === "at-risk" || health === "no-date"
        ? "warn"
        : health === "done"
          ? "outline"
          : "success";
  return <Badge variant={variant}>{HEALTH_LABEL[health]}</Badge>;
}

export function RebuildBoard({
  rows,
  canEdit,
  onOpen,
}: {
  rows: Rebuild[];
  canEdit: boolean;
  onOpen: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  const dragged = useRef(false);
  const save = useMutation({
    mutationFn: (d: { id: number; status: string }) => updateRebuild({ data: d }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not move"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => archiveRebuild({ data: { id } }),
    onSuccess: () => {
      toast.success("Rebuild removed from the board");
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  function dropOn(status: string) {
    if (!canEdit || dragId == null) return;
    const row = rows.find((r) => r.id === dragId);
    setDragId(null);
    setOverStatus(null);
    if (!row || row.status === status) return;
    if (status === "Waiting" && !row.reasonCode) {
      toast.message("Waiting needs a reason delayed. Open the card to add one.");
      onOpen(row.id);
      return;
    }
    if (row.status === "Queued" && (!row.owner || !row.targetComplete)) {
      toast.message("Assign an owner and a target complete date before leaving Queued.");
      onOpen(row.id);
      return;
    }
    save.mutate({ id: row.id, status });
  }

  return (
    <div>
      {canEdit ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Drag a project into the next column as work moves. Remove takes it off the board without deleting history.
        </p>
      ) : null}
      <div className="flex min-w-0 gap-3 overflow-x-auto pb-2">
        {REBUILD_STATUSES.map((status) => {
          const cards = rows.filter((r) => r.status === status);
          const hot = overStatus === status && dragId != null;
          return (
            <section
              key={status}
              data-testid={`rebuild-col-${status}`}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-xl border border-border bg-muted/40 transition-colors",
                hot && "border-primary bg-primary/8 ring-2 ring-primary/40",
              )}
              onDragOver={(e) => {
                if (!canEdit || dragId == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStatus !== status) setOverStatus(status);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (overStatus === status) setOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(status);
              }}
            >
              <header className="flex items-baseline justify-between gap-2 px-3 py-2">
                <h3 className="text-sm font-medium">{status}</h3>
                <span className="tabular text-xs text-muted-foreground">{cards.length}</span>
              </header>
              <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {cards.length === 0 ? (
                  <li
                    className={cn(
                      "rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground",
                      hot && "border-primary/50 text-primary",
                    )}
                  >
                    {hot ? "Drop here" : "Empty"}
                  </li>
                ) : (
                  cards.map((r) => (
                    <li key={r.id}>
                      <article
                        draggable={canEdit}
                        onDragStart={(e) => {
                          if (!canEdit) return;
                          dragged.current = true;
                          e.dataTransfer.setData("text/plain", String(r.id));
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(r.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStatus(null);
                          window.setTimeout(() => {
                            dragged.current = false;
                          }, 80);
                        }}
                        onClick={() => {
                          if (dragged.current) return;
                          onOpen(r.id);
                        }}
                        data-testid={`rebuild-card-${r.id}`}
                        className={cn(
                          "w-full select-none rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40",
                          canEdit && "cursor-grab active:cursor-grabbing",
                          r.health === "overdue" && "border-destructive/40",
                          r.health === "at-risk" && "border-warning/40",
                          r.health === "no-date" && "border-warning/30",
                          dragId === r.id && "opacity-40",
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          {canEdit ? (
                            <span className="mt-0.5 text-muted-foreground" aria-hidden>
                              <GripVertical className="size-4" />
                            </span>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug">{r.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {r.equipment || "No equipment"} · {r.account}
                            </p>
                          </div>
                          {canEdit ? (
                            <button
                              type="button"
                              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                              aria-label={`Remove ${r.title}`}
                              data-testid={`rebuild-remove-${r.id}`}
                              disabled={remove.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!window.confirm(`Remove “${r.title}” from rebuilds? It leaves the board. Notes stay in history.`)) {
                                  return;
                                }
                                remove.mutate(r.id);
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <HealthBadge health={r.health} />
                          {r.status === "Waiting" && r.reasonCode ? (
                            <Badge variant="warn">{r.reasonCode}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {r.owner || "No owner"}
                          {r.targetComplete ? ` · target ${formatShortDate(r.targetComplete)}` : " · no target"}
                        </p>
                      </article>
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export { HealthBadge, StatusBadge };
