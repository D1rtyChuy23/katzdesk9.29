import { useRef, useState } from "react";
import { ArrowRightLeft, FileText, Image as ImageIcon, Loader2, Mail, MessageSquare, Plus, Trash2, Upload, type LucideIcon } from "lucide-react";
import { appendLibraryChunk, finishLibraryFile, startLibraryFile, type LibraryBook, type LibraryFile } from "@/lib/ops/library-files";
import { ACCEPT, ALLOWED_TEXT, CHUNK_BYTES, MAX_FILE_BYTES, emailHref, fileUrl, sizeText, textHref, type LibrarySection } from "@/lib/ops/library-file-rules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Store one file in a book's shelf. Sent in pieces; returns the name it was filed under. */
export async function uploadLibraryFile(file: File, section: LibrarySection, bookId: number, onProgress?: (pct: number) => void): Promise<string> {
  const { id, name } = await startLibraryFile({ data: { section, bookId, name: file.name, size: file.size } });
  const parts = Math.ceil(file.size / CHUNK_BYTES);
  for (let seq = 0; seq < parts; seq++) {
    onProgress?.(Math.round((seq / parts) * 100));
    const bytes = new Uint8Array(await file.slice(seq * CHUNK_BYTES, (seq + 1) * CHUNK_BYTES).arrayBuffer());
    await appendLibraryChunk({ data: { id, seq, base64: toBase64(bytes) } });
  }
  await finishLibraryFile({ data: { id } });
  return name;
}

export const originOf = () => (typeof window === "undefined" ? "" : window.location.origin);

/** Email and Text: both carry a link to the original document, never a copy. */
export function SendButtons({ name, url, className }: { name: string; url: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Button asChild size="sm" variant="outline">
        <a href={emailHref(name, url)} data-testid="library-file-email">
          <Mail className="size-4" /> Email
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={textHref(name, url)} data-testid="library-file-text">
          <MessageSquare className="size-4" /> Text
        </a>
      </Button>
    </span>
  );
}

/** One stored file: the title opens the original in a new tab. */
export function FileRow({
  file,
  canEdit,
  onMove,
  onDelete,
  extra,
}: {
  file: LibraryFile;
  canEdit: boolean;
  onMove: (f: LibraryFile) => void;
  onDelete: (f: LibraryFile) => void;
  extra?: React.ReactNode;
}) {
  const url = fileUrl(originOf(), file.token);
  const TypeIcon = file.mime.startsWith("image/") ? ImageIcon : FileText;
  return (
    <li className="grid gap-2 px-3 py-3" data-testid="library-file">
      <a href={url} target="_blank" rel="noopener" className="group flex min-w-0 items-start gap-2.5" data-testid="library-file-open">
        <TypeIcon className="mt-0.5 size-4 shrink-0 text-copper" />
        <span className="min-w-0">
          <span className="block text-sm font-medium break-words group-hover:underline" data-testid="library-file-name">{file.name}</span>
          <span className="block text-xs text-muted-foreground">
            {sizeText(file.size)} · {file.addedBy} · {new Date(file.createdAt).toLocaleDateString()}
          </span>
        </span>
      </a>
      <div className="flex flex-wrap items-center gap-2">
        <SendButtons name={file.name} url={url} />
        {canEdit ? (
          <>
            <Button type="button" size="sm" variant="ghost" aria-label={`Move ${file.name} to another book`} title="Move to another book" onClick={() => onMove(file)} data-testid="library-file-move">
              <ArrowRightLeft className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label={`Delete ${file.name}`} title="Delete" onClick={() => onDelete(file)} data-testid="library-file-delete">
              <Trash2 className="size-4" />
            </Button>
          </>
        ) : null}
      </div>
      {extra}
    </li>
  );
}

/** A drop zone for one shelf type. Files dropped here go to that shelf only. */
export function ShelfDropZone({
  id,
  title,
  hint,
  icon: Icon,
  busy,
  disabled,
  onFiles,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  busy: string | null;
  disabled: boolean;
  onFiles: (files: File[]) => void;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
        over ? "border-primary bg-primary/10" : "border-border bg-card/60",
      )}
      data-testid={`drop-${id}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {busy ? <Loader2 className="size-5 animate-spin text-copper" /> : <Icon className="size-5 text-copper" />}
      <p className="font-display text-lg font-medium">{title}</p>
      <p className="text-sm text-muted-foreground" data-testid={`busy-${id}`}>{busy ?? hint}</p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
          <Upload className="size-4" /> Choose Files
        </Button>
        {children}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        data-testid={`input-${id}`}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          onFiles(picked);
        }}
      />
    </div>
  );
}

export const DROP_RULES = `${ALLOWED_TEXT}. Up to ${sizeText(MAX_FILE_BYTES)} each.`;

/** "Which book?" — shown when a file's family can't be matched, and for moving things between books. */
export function BookPicker({
  open,
  heading,
  detail,
  books,
  currentId,
  busy,
  cancelLabel = "Cancel",
  onPick,
  onCreate,
  onCancel,
}: {
  open: boolean;
  heading: string;
  detail: string;
  books: LibraryBook[];
  currentId?: number | null;
  busy?: boolean;
  cancelLabel?: string;
  onPick: (book: LibraryBook) => void;
  onCreate: (title: string) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const shown = books.filter((b) => b.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="book-picker">
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription>{detail}</DialogDescription>
        {books.length > 6 ? <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search books" aria-label="Search books" className="mt-3" /> : null}
        <ul className="mt-3 grid max-h-64 gap-1.5 overflow-y-auto" data-testid="book-picker-list">
          {shown.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(b)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm font-medium hover:border-primary/60",
                  b.id === currentId && "border-primary/60",
                )}
              >
                {b.title}
                {b.id === currentId ? <span className="text-xs font-normal text-muted-foreground">Open now</span> : null}
              </button>
            </li>
          ))}
          {!shown.length ? <li className="text-sm text-muted-foreground">No books yet. Create one below.</li> : null}
        </ul>
        <form
          className="mt-4 flex gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim().length >= 2) onCreate(title.trim());
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New book, e.g. Bunn Axiom" aria-label="New book title" data-testid="book-picker-new" />
          <Button type="submit" disabled={busy || title.trim().length < 2} data-testid="book-picker-create">
            <Plus className="size-4" /> Create Book
          </Button>
        </form>
        <Button type="button" variant="ghost" className="mt-2 w-fit" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
