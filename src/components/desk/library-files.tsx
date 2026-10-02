import { useRef, useState } from "react";
import { ArrowRightLeft, Loader2, Mail, MessageSquare, Plus, Trash2, Upload } from "lucide-react";
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

/** Email and Text: both carry a link to the original document, never a copy. Icon-sized to keep rows to one line. */
export function SendButtons({ name, url }: { name: string; url: string }) {
  return (
    <>
      <Button asChild size="sm" variant="outline" className="size-11 shrink-0 p-0">
        <a href={emailHref(name, url)} aria-label={`Email ${name}`} title="Email a link" data-testid="library-file-email">
          <Mail className="size-4" />
        </a>
      </Button>
      <Button asChild size="sm" variant="outline" className="size-11 shrink-0 p-0">
        <a href={textHref(name, url)} aria-label={`Text ${name}`} title="Text a link" data-testid="library-file-text">
          <MessageSquare className="size-4" />
        </a>
      </Button>
    </>
  );
}

export const DOC_TAG: Record<LibrarySection, string> = { spec: "Spec", manuals: "Manual", parts: "Parts" };

/** One stored file on one line: type, name (opens the original in a new tab), Email, Text. */
export function DocRow({
  file,
  label,
  manage,
  onMove,
  onDelete,
  extra,
}: {
  file: LibraryFile;
  /** Short name shown in the row; the stored file name is what gets sent. */
  label: string;
  manage: boolean;
  onMove: (f: LibraryFile) => void;
  onDelete: (f: LibraryFile) => void;
  extra?: React.ReactNode;
}) {
  const url = fileUrl(originOf(), file.token);
  return (
    <li className="flex min-h-12 items-center gap-2 py-1" data-testid="library-file" data-section={file.section}>
      <span className="w-16 shrink-0 text-[11px] font-semibold tracking-[0.1em] text-copper uppercase">{DOC_TAG[file.section]}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        title={`${file.name} · ${sizeText(file.size)} · added by ${file.addedBy} ${new Date(file.createdAt).toLocaleDateString()}`}
        className="min-w-0 flex-1 py-2 text-sm font-medium break-words hover:underline"
        data-testid="library-file-open"
      >
        <span data-testid="library-file-name">{label}</span>
      </a>
      {extra}
      <SendButtons name={file.name} url={url} />
      {manage ? (
        <>
          <Button type="button" size="sm" variant="ghost" className="size-11 shrink-0 p-0" aria-label={`Move ${file.name}`} title="Move to another model" onClick={() => onMove(file)} data-testid="library-file-move">
            <ArrowRightLeft className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="size-11 shrink-0 p-0" aria-label={`Delete ${file.name}`} title="Delete" onClick={() => onDelete(file)} data-testid="library-file-delete">
            <Trash2 className="size-4" />
          </Button>
        </>
      ) : null}
    </li>
  );
}

/** "+ Manual" — click to choose, or drop files on it. One per document type. */
export function AddTarget({
  id,
  label,
  busy,
  disabled,
  large,
  onFiles,
}: {
  id: string;
  label: string;
  busy: string | null;
  disabled: boolean;
  large?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 text-sm font-medium transition-colors disabled:opacity-60",
          large ? "min-h-20 flex-1 flex-col py-3" : "h-10",
          over ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:border-primary/50",
        )}
        data-testid={`drop-${id}`}
        onClick={() => input.current?.click()}
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
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        <span data-testid={`busy-${id}`}>{busy ?? label}</span>
      </button>
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
    </>
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
  onCreate: (manufacturer: string, model: string) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [maker, setMaker] = useState("");
  const [model, setModel] = useState("");
  const makers = [...new Set(books.map((b) => b.manufacturer).filter(Boolean))];
  const ready = maker.trim().length >= 2 && model.trim().length >= 1;
  const shown = books.filter((b) => b.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="book-picker">
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription>{detail}</DialogDescription>
        {books.length > 6 ? <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models" aria-label="Search models" className="mt-3" /> : null}
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
          {!shown.length ? <li className="text-sm text-muted-foreground">No models yet. Add one below.</li> : null}
        </ul>
        <form
          className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) onCreate(maker.trim(), model.trim());
          }}
        >
          <Input value={maker} onChange={(e) => setMaker(e.target.value)} placeholder="Manufacturer" aria-label="Manufacturer" list="library-makers" data-testid="book-picker-maker" />
          <datalist id="library-makers">
            {makers.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" aria-label="Model" data-testid="book-picker-new" />
          <Button type="submit" disabled={busy || !ready} data-testid="book-picker-create">
            <Plus className="size-4" /> Add Model
          </Button>
        </form>
        <Button type="button" variant="ghost" className="mt-2 w-fit" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
