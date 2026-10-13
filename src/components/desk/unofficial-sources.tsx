import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addUnofficialSource, listUnofficialSources, removeUnofficialSource, type UnofficialSource } from "@/lib/ops/unofficial-sources";
import { UNOFFICIAL_LABEL, UNOFFICIAL_NOTICE, cleanUnofficial, linkHost } from "@/lib/ops/legacy-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

/**
 * Links and notes from the field for one variation, kept apart from Troubleshoot's official steps and labeled
 * unofficial on every line. Troubleshoot never reads these: nothing here becomes a cause, a check or a part.
 */
export function UnofficialSources({ bookId, model }: { bookId: number; model: string }) {
  const qc = useQueryClient();
  const key = ["unofficial-sources", bookId];
  const list = useQuery({ queryKey: key, queryFn: () => listUnofficialSources({ data: { bookId } }) });
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const items = list.data ?? [];

  const add = useMutation({
    mutationFn: () => addUnofficialSource({ data: { bookId, url: url.trim() || null, note: note.trim() || null } }),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      setUrl("");
      setNote("");
      setAdding(false);
      toast.success("Added as an unofficial source");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add it"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => removeUnofficialSource({ data: { id } }),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      toast.success("Removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove it"),
  });

  const draft = cleanUnofficial({ url, note });
  const draftError = "error" in draft && (url.trim() || note.trim()) ? draft.error : null;

  return (
    <section className="mt-5 rounded-[10px] border border-dashed border-warning/60 bg-warning/[0.06] px-3 py-3" aria-label={`Unofficial sources for ${model}`} data-testid="unofficial-sources">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-display text-[17px] font-medium">Unofficial Sources</h4>
        <Badge size="tight" variant="warn" data-testid="unofficial-badge">
          {UNOFFICIAL_LABEL}
        </Badge>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {list.isLoading ? "Loading…" : `${items.length} on ${model}`}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="unofficial-notice">
        {UNOFFICIAL_NOTICE}
      </p>

      {items.length ? (
        <ul className="mt-2 divide-y divide-border/70" data-testid="unofficial-list">
          {items.map((s: UnofficialSource) => (
            <li key={s.id} className="flex items-start gap-2 py-2 text-sm" data-testid="unofficial-item">
              <Badge size="tight" variant="warn" className="mt-0.5 shrink-0">
                {UNOFFICIAL_LABEL}
              </Badge>
              <div className="min-w-0 flex-1">
                {s.note ? <p className="break-words whitespace-pre-wrap">{s.note}</p> : null}
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex max-w-full items-center gap-1 text-xs break-all text-copper hover:underline"
                    title={s.url}
                    data-testid="unofficial-link"
                  >
                    Outside link: {linkHost(s.url)} <ExternalLink className="size-3 shrink-0" />
                  </a>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {s.by} · {new Date(s.at).toLocaleDateString()}
                </p>
              </div>
              {s.canRemove ? (
                <button
                  type="button"
                  aria-label="Remove this unofficial source"
                  disabled={remove.isPending}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                  onClick={() => remove.mutate(s.id)}
                  data-testid="unofficial-remove"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !list.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground" data-testid="unofficial-empty">
          Nothing added yet.
        </p>
      ) : null}

      {adding ? (
        <form
          className="mt-3 grid gap-2 rounded-lg border border-border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!("error" in draft) && !add.isPending) add.mutate();
          }}
          data-testid="unofficial-form"
        >
          <div>
            <Label htmlFor={`unofficial-note-${bookId}`}>Note</Label>
            <Textarea
              id={`unofficial-note-${bookId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What worked in the field, in your words…"
              className="mt-1 min-h-20"
              maxLength={1500}
              data-testid="unofficial-note"
            />
          </div>
          <div>
            <Label htmlFor={`unofficial-url-${bookId}`}>Link (optional)</Label>
            <Input id={`unofficial-url-${bookId}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoComplete="off" className="mt-1" data-testid="unofficial-url" />
          </div>
          {draftError ? <p className="text-xs text-destructive">{draftError}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={"error" in draft || add.isPending} data-testid="unofficial-save">
              {add.isPending ? "Adding…" : "Add As Unofficial"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <span className="text-xs text-muted-foreground">Shown with your name. It never becomes one of the manual's steps.</span>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setAdding(true)} data-testid="unofficial-add">
          <Plus className="size-4" />
          Add A Link Or Note
        </Button>
      )}
    </section>
  );
}
