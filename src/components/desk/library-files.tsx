import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Loader2, Mail, MessageSquare, Trash2, Upload, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { appendLibraryChunk, deleteLibraryFile, finishLibraryFile, startLibraryFile, type LibraryFile } from "@/lib/ops/library-files";
import {
  ACCEPT,
  ALLOWED_TEXT,
  CHUNK_BYTES,
  MAX_FILE_BYTES,
  emailHref,
  fileError,
  fileUrl,
  sizeText,
  textHref,
  type LibrarySection,
} from "@/lib/ops/library-file-rules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** One Library section (Manuals or Parts Diagrams). Files dropped here are stored in this section only. */
export function LibraryFileSection({
  id,
  section,
  title,
  blurb,
  icon: Icon,
  files,
  canEdit,
  loading,
}: {
  id: string;
  section: LibrarySection;
  title: string;
  blurb: string;
  icon: LucideIcon;
  files: LibraryFile[];
  canEdit: boolean;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<LibraryFile | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function addFiles(list: File[]) {
    if (!list.length || busy) return;
    const errors: string[] = [];
    let added = 0;
    for (const file of list) {
      const problem = fileError(file.name, file.size);
      if (problem) {
        errors.push(problem);
        continue;
      }
      try {
        const { id: fileId } = await startLibraryFile({ data: { section, name: file.name, size: file.size } });
        const parts = Math.ceil(file.size / CHUNK_BYTES);
        for (let seq = 0; seq < parts; seq++) {
          setBusy(`Adding ${file.name}… ${Math.round((seq / parts) * 100)}%`);
          const bytes = new Uint8Array(await file.slice(seq * CHUNK_BYTES, (seq + 1) * CHUNK_BYTES).arrayBuffer());
          await appendLibraryChunk({ data: { id: fileId, seq, base64: toBase64(bytes) } });
        }
        await finishLibraryFile({ data: { id: fileId } });
        added += 1;
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "could not be added"}`);
      }
    }
    setBusy(null);
    setProblems(errors);
    if (added) toast.success(`${added} file${added === 1 ? "" : "s"} added to ${title}`);
    if (errors.length) toast.error(errors.length === 1 ? errors[0]! : `${errors.length} files were not added — see ${title}`);
    await qc.invalidateQueries({ queryKey: ["library-files"] });
  }

  const remove = useMutation({
    mutationFn: (fileId: number) => deleteLibraryFile({ data: { id: fileId } }),
    onSuccess: () => {
      toast.success("File deleted");
      setToDelete(null);
      void qc.invalidateQueries({ queryKey: ["library-files"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  return (
    <section id={id} className="mt-10 scroll-mt-24" aria-labelledby={`${id}-title`} data-testid={`section-${id}`}>
      <div className="border-b border-border pb-3">
        <h2 id={`${id}-title`} className="font-display text-2xl font-medium tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
      </div>

      {canEdit ? (
        <div
          className={cn(
            "mt-4 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors",
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
            void addFiles(Array.from(e.dataTransfer.files));
          }}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-copper" /> : <Icon className="size-5 text-copper" />}
          <p className="text-sm font-medium" data-testid={`busy-${id}`}>{busy ?? `Drop files here to add them to ${title}`}</p>
          <p className="text-xs text-muted-foreground">
            {ALLOWED_TEXT}. Up to {sizeText(MAX_FILE_BYTES)} each.
          </p>
          <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => input.current?.click()}>
            <Upload className="size-4" /> Choose Files
          </Button>
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
              void addFiles(picked);
            }}
          />
        </div>
      ) : null}

      {problems.length ? (
        <ul className="mt-3 grid gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm" role="alert" data-testid={`errors-${id}`}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid={`empty-${id}`}>
          Nothing in {title} yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card" data-testid={`files-${id}`}>
          {files.map((f) => {
            const url = fileUrl(origin, f.token);
            const TypeIcon = f.mime.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3" data-testid="library-file">
                <a href={url} target="_blank" rel="noopener" className="group flex min-w-0 flex-1 items-center gap-3" data-testid="library-file-open">
                  <TypeIcon className="size-5 shrink-0 text-copper" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">{f.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {sizeText(f.size)} · added by {f.addedBy} · {new Date(f.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </a>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={emailHref(f.name, url)} data-testid="library-file-email">
                      <Mail className="size-4" /> Email
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={textHref(f.name, url)} data-testid="library-file-text">
                      <MessageSquare className="size-4" /> Text
                    </a>
                  </Button>
                  {canEdit ? (
                    <Button type="button" size="sm" variant="ghost" aria-label={`Delete ${f.name}`} onClick={() => setToDelete(f)} data-testid="library-file-delete">
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete This File?</DialogTitle>
          <DialogDescription>
            {toDelete?.name} will be removed from {title}. Links already sent for it will stop working.
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete.id)}>
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => setToDelete(null)}>
              Keep It
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
