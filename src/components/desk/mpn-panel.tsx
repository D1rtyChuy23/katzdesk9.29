import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, CircleSlash, ExternalLink, Link2, Link2Off, Pencil } from "lucide-react";
import { toast } from "sonner";
import { setBookMpn, setNoOfficialFile, tieOfficialFile, untieOfficialFile, type LibraryBook, type LibraryFile } from "@/lib/ops/library-files";
import { NO_OFFICIAL_FILE, mpnMentioned, officialStatus } from "@/lib/ops/mpn-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";

const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);

/**
 * The variation's MPN and where its official files stand. Official spec sheets and manuals are matched on the
 * MPN, not on a similar model name. When the manufacturer has no file for this exact MPN, that is flagged here
 * and nothing from another model is attached in its place.
 */
export function MpnPanel({
  book,
  files,
  canEdit,
  onChanged,
}: {
  book: LibraryBook;
  /** Files stored on this variation (not copies from the main chip). */
  files: LibraryFile[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [mpn, setMpn] = useState(book.mpn ?? "");
  const status = officialStatus(
    { mpn: book.mpn, noOfficialFile: book.noOfficialFile },
    files.map((f) => ({ section: f.section, mpn: f.mpn })),
  );

  const save = useMutation({
    mutationFn: () => setBookMpn({ data: { bookId: book.id, mpn: mpn.trim() || null } }),
    onSuccess: (r) => {
      toast.success(r.mpn ? `MPN set to ${r.mpn}` : "MPN cleared");
      setEditing(false);
      onChanged();
    },
    onError: (e) => fail(e, "Could not save the MPN"),
  });
  const flag = useMutation({
    mutationFn: (value: boolean) => setNoOfficialFile({ data: { bookId: book.id, value } }),
    onSuccess: (_r, value) => {
      toast.success(value ? NO_OFFICIAL_FILE : "Flag cleared");
      onChanged();
    },
    onError: (e) => fail(e, "Could not change the flag"),
  });

  return (
    <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2.5" data-testid="mpn-panel" data-state={status.state}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">MPN</span>
        {editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Input
              value={mpn}
              onChange={(e) => setMpn(e.target.value)}
              aria-label={`MPN for ${book.title}`}
              placeholder="Manufacturer part number"
              className="h-9 w-56"
              autoFocus
              data-testid="mpn-input"
            />
            <Button type="submit" size="sm" disabled={save.isPending} data-testid="mpn-save">
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <span className="text-sm font-semibold break-all" data-testid="mpn-value">
              {book.mpn ?? <span className="font-normal text-muted-foreground">not set</span>}
            </span>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMpn(book.mpn ?? "");
                  setEditing(true);
                }}
                data-testid="mpn-edit"
              >
                <Pencil className="size-4" />
                {book.mpn ? "Edit" : "Set MPN"}
              </Button>
            ) : null}
          </>
        )}
        <Badge
          size="tight"
          variant={status.state === "official" ? "success" : status.state === "flagged" ? "danger" : "outline"}
          data-testid="mpn-status"
        >
          {status.state === "official" ? <BadgeCheck className="mr-1 size-3.5" /> : status.state === "flagged" ? <CircleSlash className="mr-1 size-3.5" /> : null}
          {status.label}
        </Badge>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {book.mpn
          ? "Official files are matched on this MPN. A file for a similar model name is not attached here."
          : "Set the manufacturer part number first. Official files are matched on it, not on the model name."}
      </p>

      {canEdit && book.mpn && status.state !== "official" ? (
        <div className="mt-2">
          {book.noOfficialFile ? (
            <Button type="button" size="sm" variant="outline" disabled={flag.isPending} onClick={() => flag.mutate(false)} data-testid="mpn-unflag">
              Clear "{NO_OFFICIAL_FILE}"
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={flag.isPending} onClick={() => flag.mutate(true)} data-testid="mpn-flag">
              <CircleSlash className="size-4" />
              Flag: {NO_OFFICIAL_FILE}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shown in a file's row. A tied file says it is the official file for its MPN and links to the source. With
 * Manage open, a file stored on this variation can be tied (with the manufacturer page it came from) or untied.
 */
export function OfficialTag({
  file,
  book,
  canEdit,
  manage,
  onChanged,
}: {
  file: LibraryFile;
  book: LibraryBook;
  canEdit: boolean;
  manage: boolean;
  onChanged: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [url, setUrl] = useState("");
  const tie = useMutation({
    mutationFn: () => tieOfficialFile({ data: { fileId: file.id, bookId: book.id, sourceUrl: url.trim() } }),
    onSuccess: (r) => {
      toast.success(`Tied to MPN ${r.mpn}`);
      setAsking(false);
      setUrl("");
      onChanged();
    },
    onError: (e) => fail(e, "Could not tie the file"),
  });
  const untie = useMutation({
    mutationFn: () => untieOfficialFile({ data: { fileId: file.id } }),
    onSuccess: () => {
      toast.success("No longer tied to the MPN");
      onChanged();
    },
    onError: (e) => fail(e, "Could not untie the file"),
  });

  const mineHere = file.bookId === book.id;
  return (
    <>
      {file.mpn ? (
        <span className="flex shrink-0 items-center gap-1.5" data-testid="official-tag">
          <Badge size="tight" variant="success">
            <BadgeCheck className="mr-1 size-3.5" />
            Official · MPN {file.mpn}
          </Badge>
          {file.sourceUrl ? (
            <a
              href={file.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title={`Source: ${file.sourceUrl}`}
              aria-label={`Open the manufacturer source for ${file.name}`}
              data-testid="official-source"
            >
              <ExternalLink className="size-4" />
            </a>
          ) : null}
          {canEdit && manage ? (
            <Button type="button" size="sm" variant="ghost" className="h-9 px-2 text-xs" disabled={untie.isPending} onClick={() => untie.mutate()} data-testid="official-untie">
              <Link2Off className="size-4" />
              Untie
            </Button>
          ) : null}
        </span>
      ) : canEdit && manage && book.mpn && mineHere ? (
        <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 px-2 text-xs" onClick={() => setAsking(true)} data-testid="official-tie">
          <Link2 className="size-4" />
          Tie To MPN
        </Button>
      ) : null}

      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent data-testid="official-dialog">
          <DialogTitle>Tie To MPN {book.mpn}</DialogTitle>
          <DialogDescription>
            Only the manufacturer's own file for this exact MPN belongs here. Paste the manufacturer page or file address it came from.
          </DialogDescription>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              tie.mutate();
            }}
          >
            <div>
              <Label htmlFor="official-url">Manufacturer source (https://…)</Label>
              <Input id="official-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoComplete="off" className="mt-1" autoFocus />
            </div>
            {url.trim() && !mpnMentioned(book.mpn, file.name, url) ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
                Neither the file name nor the address mentions {book.mpn}. That is common for manufacturer files; confirm on the page that this file
                is for exactly this MPN.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAsking(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!url.trim() || tie.isPending}>
                {tie.isPending ? "Saving…" : "Tie To MPN"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
