import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ExternalLink, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { setBookLegacy, setConfirmLegacy, type LibraryBook } from "@/lib/ops/library-files";
import { CONFIRM_LEGACY, legacyMoveError, legacyState, linkHost } from "@/lib/ops/legacy-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";

const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);

/**
 * Where a model stands: current, under Legacy (the manufacturer lists it as discontinued or obsolete), or flagged
 * Confirm Legacy (could not be confirmed either way, so it stays in the main row). A current, unflagged model
 * shows nothing here unless Manage is open. Moving a model to Legacy always asks for the manufacturer source.
 */
export function LegacyPanel({
  book,
  canEdit,
  manage,
  onChanged,
}: {
  book: LibraryBook;
  canEdit: boolean;
  manage: boolean;
  onChanged: () => void;
}) {
  const [asking, setAsking] = useState<"legacy" | "confirm" | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const state = legacyState(book);

  const close = () => {
    setAsking(null);
    setUrl("");
    setNote("");
  };
  const move = useMutation({
    mutationFn: (legacy: boolean) => setBookLegacy({ data: { bookId: book.id, legacy, sourceUrl: legacy ? url.trim() : null, note: legacy ? note : null } }),
    onSuccess: (r) => {
      toast.success(r.legacy ? "Moved under Legacy. Its spec, manuals and parts stay with it." : "Back in the main row");
      close();
      onChanged();
    },
    onError: (e) => fail(e, "Could not change Legacy"),
  });
  const flag = useMutation({
    mutationFn: (value: boolean) => setConfirmLegacy({ data: { bookId: book.id, value, note: value ? note : null } }),
    onSuccess: (_r, value) => {
      toast.success(value ? `Flagged: ${CONFIRM_LEGACY}` : "Flag cleared");
      close();
      onChanged();
    },
    onError: (e) => fail(e, "Could not change the flag"),
  });

  const editing = canEdit && manage;
  if (state === "current" && !editing) return null;
  const problem = asking === "legacy" && url.trim() ? legacyMoveError({ sourceUrl: url }) : null;

  return (
    <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2.5" data-testid="legacy-panel" data-state={state}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Status</span>
        {state === "legacy" ? (
          <Badge size="tight" variant="warn" data-testid="legacy-badge">
            <Archive className="mr-1 size-3.5" />
            Legacy · Discontinued Or Obsolete
          </Badge>
        ) : state === "confirm" ? (
          <Badge size="tight" variant="danger" data-testid="confirm-legacy-badge">
            <HelpCircle className="mr-1 size-3.5" />
            {CONFIRM_LEGACY}
          </Badge>
        ) : (
          <Badge size="tight" variant="outline">
            Current Model
          </Badge>
        )}
        {state === "legacy" && book.legacySource ? (
          <a
            href={book.legacySource}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-copper hover:underline"
            data-testid="legacy-source"
          >
            Manufacturer source: {linkHost(book.legacySource)} <ExternalLink className="size-3" />
          </a>
        ) : null}
        {editing ? (
          <span className="ml-auto flex flex-wrap gap-2">
            {state === "legacy" ? (
              <Button type="button" size="sm" variant="outline" disabled={move.isPending} onClick={() => move.mutate(false)} data-testid="legacy-undo">
                <ArchiveRestore className="size-4" />
                Move Back To Current
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => setAsking("legacy")} data-testid="legacy-move">
                  <Archive className="size-4" />
                  Move To Legacy
                </Button>
                {state === "confirm" ? (
                  <Button type="button" size="sm" variant="ghost" disabled={flag.isPending} onClick={() => flag.mutate(false)} data-testid="confirm-legacy-clear">
                    Clear Flag
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAsking("confirm")} data-testid="confirm-legacy-set">
                    <HelpCircle className="size-4" />
                    Flag: {CONFIRM_LEGACY}
                  </Button>
                )}
              </>
            )}
          </span>
        ) : null}
      </div>
      {book.legacyNote && state !== "current" ? (
        <p className="mt-1.5 text-xs text-muted-foreground" data-testid="legacy-note">
          {book.legacyNote}
        </p>
      ) : null}
      {state === "legacy" ? (
        <p className="mt-1.5 text-xs text-muted-foreground">This model still opens. Its spec sheet, manuals and parts stay with it; nothing was deleted.</p>
      ) : state === "confirm" ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Not confirmed as discontinued, so it stays in the main row until someone confirms it with the manufacturer.</p>
      ) : null}

      <Dialog open={!!asking} onOpenChange={(o) => !o && close()}>
        <DialogContent data-testid="legacy-dialog">
          <DialogTitle>{asking === "legacy" ? "Move To Legacy" : `Flag: ${CONFIRM_LEGACY}`}</DialogTitle>
          <DialogDescription>
            {asking === "legacy"
              ? `${book.title} moves under Legacy for its manufacturer. It keeps its spec sheet, manuals and parts and still opens. Paste the manufacturer page that lists it as discontinued or obsolete.`
              : `${book.title} stays in the main row, marked for someone to confirm with the manufacturer. Say what was found, if anything.`}
          </DialogDescription>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (asking === "legacy") move.mutate(true);
              else flag.mutate(true);
            }}
          >
            {asking === "legacy" ? (
              <div>
                <Label htmlFor="legacy-url">Manufacturer source (https://…)</Label>
                <Input id="legacy-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoComplete="off" className="mt-1" autoFocus data-testid="legacy-url" />
                {problem ? <p className="mt-1 text-xs text-destructive">{problem}</p> : null}
              </div>
            ) : null}
            <div>
              <Label htmlFor="legacy-note">{asking === "legacy" ? "What the page says (optional)" : "What was found (optional)"}</Label>
              <Textarea id="legacy-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-20" maxLength={600} data-testid="legacy-note-input" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={move.isPending || flag.isPending || (asking === "legacy" && (!url.trim() || !!problem))}
                data-testid="legacy-save"
              >
                {asking === "legacy" ? "Move To Legacy" : "Flag It"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
