import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { appendLibraryChunk, finishLibraryFile } from "@/lib/ops/library-files";
import { deleteTrainingFile, listTrainingFiles, startTrainingFile, type TrainingFile } from "@/lib/ops/training-api";
import { CHUNK_BYTES, MAX_FILE_BYTES, fileUrl, sizeText } from "@/lib/ops/library-file-rules";
import { TRAINING_ACCEPT, TRAINING_ALLOWED_TEXT, TRAINING_TITLE, countByTopic, topicLabel, trainingFileError, type TrainingTopic } from "@/lib/ops/training";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FilterChip } from "@/components/desk/desk-charts";
import { AddTarget, SendButtons, originOf } from "@/components/desk/library-files";
import { cn } from "@/lib/utils";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Store one file under a topic, in pieces. It keeps the name it was dropped with and is never put in a model book. */
async function uploadTrainingFile(file: File, topic: TrainingTopic, onProgress: (pct: number) => void): Promise<string> {
  const { id, name } = await startTrainingFile({ data: { topic, name: file.name, size: file.size } });
  const parts = Math.ceil(file.size / CHUNK_BYTES);
  for (let seq = 0; seq < parts; seq++) {
    onProgress(Math.round((seq / parts) * 100));
    const bytes = new Uint8Array(await file.slice(seq * CHUNK_BYTES, (seq + 1) * CHUNK_BYTES).arrayBuffer());
    await appendLibraryChunk({ data: { id, seq, base64: toBase64(bytes) } });
  }
  await finishLibraryFile({ data: { id } });
  return name;
}

/**
 * Education And Training, in The Library but apart from the model books: five topics, each holding files.
 * A file opens from its name; Email and Text send a link to it. Nothing here belongs to a machine.
 */
export function TrainingSection() {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["training-files"], queryFn: () => listTrainingFiles() });
  const [topic, setTopic] = useState<TrainingTopic | null>(null);
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [toDelete, setToDelete] = useState<TrainingFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const files = data.data?.files ?? [];
  const canEdit = !!data.data?.canEdit;
  const counts = countByTopic(files);
  const shown = topic ? files.filter((f) => f.topic === topic) : [];
  const label = topicLabel(topic);

  async function add(picked: File[]) {
    if (!topic || !canEdit || busy || !picked.length) return;
    let stored = 0;
    try {
      for (const file of picked) {
        const problem = trainingFileError(file.name, file.size);
        if (problem) {
          toast.error(problem);
          continue;
        }
        setBusy(`Storing ${file.name}…`);
        await uploadTrainingFile(file, topic, (pct) => setBusy(`Storing ${file.name} ${pct}%`));
        stored += 1;
      }
      if (stored) toast.success(`${stored} file${stored === 1 ? "" : "s"} added to ${label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not store that file");
    } finally {
      setBusy(null);
      await qc.invalidateQueries({ queryKey: ["training-files"] });
    }
  }

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteTrainingFile({ data: { id: toDelete.id } });
      toast.success(`Deleted ${toDelete.name}`);
      setToDelete(null);
      await qc.invalidateQueries({ queryKey: ["training-files"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete it");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4" aria-label={TRAINING_TITLE} data-testid="training-section">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <GraduationCap className="size-5 text-copper" />
          {TRAINING_TITLE}
        </h2>
        <p className="text-xs text-muted-foreground" data-testid="training-note">
          Training material by topic. Not a model spec, and never filed under a machine.
        </p>
        {canEdit && topic ? (
          <Button type="button" size="sm" variant={manage ? "secondary" : "ghost"} className="ml-auto" aria-pressed={manage} onClick={() => setManage(!manage)} data-testid="training-manage">
            <Settings2 className="size-4" /> {manage ? "Done" : "Manage"}
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Training topics" data-testid="training-topics">
        {counts.map((c) => (
          <FilterChip key={c.key} selected={topic === c.key} onClick={() => setTopic(topic === c.key ? null : c.key)} data-testid="training-topic" data-topic={c.key}>
            {c.label}
            <span className="ml-1.5 text-xs opacity-60">{c.count}</span>
          </FilterChip>
        ))}
      </div>

      {topic ? (
        <div
          className={cn("mt-3 rounded-lg border border-transparent border-t-border pt-3", over && "border-primary bg-primary/5")}
          data-testid="training-files"
          data-topic={topic}
          onDragOver={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
          }}
          onDrop={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setOver(false);
            void add(Array.from(e.dataTransfer.files));
          }}
        >
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {label} <span className="font-normal tracking-normal normal-case">· {shown.length} file{shown.length === 1 ? "" : "s"}</span>
          </p>
          {shown.length ? (
            <ul className="mt-1 divide-y divide-border/70">
              {shown.map((f) => {
                const url = fileUrl(originOf(), f.token);
                return (
                  <li key={f.id} className="flex min-h-12 items-center gap-2 py-1" data-testid="training-file">
                    <span className="w-16 shrink-0 text-[11px] font-semibold tracking-[0.1em] text-copper uppercase">Training</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener"
                      title={`${f.name} · ${sizeText(f.size)} · added by ${f.addedBy} ${new Date(f.createdAt).toLocaleDateString()}`}
                      className="min-w-0 flex-1 py-2 text-sm font-medium break-words hover:underline"
                      data-testid="training-file-open"
                    >
                      {f.name}
                    </a>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{sizeText(f.size)}</span>
                    <SendButtons name={f.name} url={url} />
                    {canEdit && manage ? (
                      <Button type="button" size="sm" variant="ghost" className="size-11 shrink-0 p-0" aria-label={`Delete ${f.name}`} title="Delete" onClick={() => setToDelete(f)} data-testid="training-file-delete">
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : !data.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="training-empty">
              Nothing in {label} yet.{canEdit ? " Drop a file here, or use the button below." : ""}
            </p>
          ) : null}
          {canEdit ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AddTarget id="training" label={`Add Files To ${label}`} busy={busy} disabled={!!busy} accept={TRAINING_ACCEPT} onFiles={(list) => void add(list)} />
              <span className="text-xs text-muted-foreground">
                {TRAINING_ALLOWED_TEXT}. Up to {sizeText(MAX_FILE_BYTES)} each.
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Pick a topic to open its files.</p>
      )}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent data-testid="training-delete-dialog">
          <DialogTitle>Delete This Training File?</DialogTitle>
          <DialogDescription>{toDelete?.name} is removed from {topicLabel(toDelete?.topic)}. Links already sent stop working.</DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={deleting} onClick={() => void remove()} data-testid="training-delete-confirm">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
