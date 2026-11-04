/**
 * Photos on an install, a service or TLC ticket, or a PM (Chuy, 11/4), and the account's install photos. Add from the
 * camera or the library (the browser shrinks each to about 2,000 px and under 0.5 MB first), tap one to see it large,
 * download one under its name, or Download all as a .zip. Whoever added a photo, or an Admin, can remove it.
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Download, ImagePlus, Images, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/separator";
import { ZoomableImage } from "@/components/desk/image-lightbox";
import { cn } from "@/lib/utils";
import { formatLongDate } from "@/lib/ops/clock";
import { addRecordPhoto, listAccountPhotos, removeRecordPhoto, type TicketPhoto } from "@/lib/ops/ticket-photos";
import { photoSrc, useRecordPhotos } from "./photo-queries";
import {
  PHOTO_ADDED_ELSEWHERE,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_NO_MEMORY,
  PHOTO_NOT_JPEG,
  PHOTO_REMOVE_CONFIRM,
  PHOTO_TOO_BIG,
  THUMB_MAX_BYTES,
  THUMB_MAX_EDGE,
  fitWithin,
  photoByline,
  shrinkSteps,
  stopsUploads,
  uniqueNames,
  type PhotoKind,
} from "@/lib/ops/ticket-photo-rules";
import { zipParts } from "@/lib/ops/zip-store";

// ── Shrinking a photo before it's sent ──────────────────────────────────────────────────────────────────────────────

async function loadPicture(file: File): Promise<{ img: HTMLImageElement; done: () => void }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  // Frees the picture: the decoded photo, and its address.
  const done = () => {
    img.removeAttribute("src");
    URL.revokeObjectURL(url);
  };
  try {
    await img.decode();
  } catch {
    done();
    throw new Error(PHOTO_NOT_JPEG);
  }
  return { img, done };
}

/**
 * The picture as a JPEG no longer than maxEdge on its long side and no bigger than maxBytes (shrinkSteps: lower quality
 * first, then smaller), drawn on the one canvas the photo uses. A phone short of memory gives no canvas or no JPEG: that
 * says so, rather than "too large".
 */
async function jpegWithin(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  maxEdge: number,
  maxBytes: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  let drawn = 0;
  let ctx: CanvasRenderingContext2D | null = null;
  let size = { width: 0, height: 0 };
  for (const step of shrinkSteps(maxEdge)) {
    if (step.edge !== drawn) {
      size = fitWithin(img.naturalWidth, img.naturalHeight, step.edge);
      canvas.width = size.width;
      canvas.height = size.height;
      ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(PHOTO_NO_MEMORY);
      // A see-through PNG gets a white backing, as a JPEG has none.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(img, 0, 0, size.width, size.height);
      drawn = step.edge;
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", step.quality));
    if (!blob) throw new Error(PHOTO_NO_MEMORY);
    if (blob.size <= maxBytes) return { blob, ...size };
  }
  throw new Error(PHOTO_TOO_BIG);
}

async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/**
 * A photo from the camera or the library, shrunk for storing, with its preview. One canvas per photo, emptied after,
 * and the decoded photo let go, so a phone adding many at once doesn't run out of memory partway.
 */
async function shrinkPhoto(file: File): Promise<{ photo: string; thumb: string; width: number; height: number }> {
  const { img, done } = await loadPicture(file);
  const canvas = document.createElement("canvas");
  try {
    const full = await jpegWithin(img, canvas, PHOTO_MAX_EDGE, PHOTO_MAX_BYTES);
    const thumb = await jpegWithin(img, canvas, THUMB_MAX_EDGE, THUMB_MAX_BYTES);
    return { photo: await base64Of(full.blob), thumb: await base64Of(thumb.blob), width: full.width, height: full.height };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    done();
  }
}

// ── Download all ────────────────────────────────────────────────────────────────────────────────────────────────────

function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Fetches each photo, then saves them as one .zip under their names. */
async function downloadAll(photos: TicketPhoto[], zipName: string, onProgress: (done: number) => void) {
  const names = uniqueNames(photos.map((p) => p.name));
  const entries = [];
  for (let i = 0; i < photos.length; i += 1) {
    const p = photos[i]!;
    const res = await fetch(photoSrc(p.id), { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Photo ${p.name} couldn't be fetched. Try again.`);
    entries.push({ name: names[i]!, data: new Uint8Array(await res.arrayBuffer()), date: new Date(p.addedAt) });
    onProgress(i + 1);
  }
  // The pieces go into the Blob as they are: the photos aren't copied into one big buffer first.
  saveFile(new Blob(zipParts(entries), { type: "application/zip" }), zipName);
}

function DownloadAllButton({ photos, zipName, testId }: { photos: TicketPhoto[]; zipName: string; testId: string }) {
  const [done, setDone] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="max-sm:h-10"
      disabled={done != null}
      data-testid={testId}
      onClick={async () => {
        setDone(0);
        try {
          await downloadAll(photos, zipName, setDone);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't make the .zip. Try again.");
        } finally {
          setDone(null);
        }
      }}
    >
      <Download className="size-3.5" />
      {done == null ? `Download all (${photos.length})` : `Getting ${done} of ${photos.length}…`}
    </Button>
  );
}

// ── The grid ────────────────────────────────────────────────────────────────────────────────────────────────────────

function PhotoCard({ photo, onRemove, removing }: { photo: TicketPhoto; onRemove?: (p: TicketPhoto) => void; removing?: boolean }) {
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card" data-testid="photo-card">
      <ZoomableImage
        src={photoSrc(photo.id, "thumb")}
        fullSrc={photoSrc(photo.id)}
        downloadHref={photoSrc(photo.id, "download")}
        download={photo.name}
        alt={photo.name}
        label={photo.name}
        className="aspect-[4/3] bg-muted"
        imgClassName="size-full object-cover"
        lazy
        testId="photo-thumb"
      />
      <div className="px-2.5 pt-2 pb-1">
        <p className="line-clamp-2 text-xs font-medium break-words" title={photo.name} data-testid="photo-name">
          {photo.name}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground" data-testid="photo-byline">
          {photoByline(photo.addedByName, photo.addedAt)}
        </p>
      </div>
      <div className="flex items-center gap-1 px-1.5 pb-1.5">
        <a
          href={photoSrc(photo.id, "download")}
          download={photo.name}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium hover:bg-muted sm:h-8"
          data-testid="photo-download"
        >
          <Download className="size-3.5" /> Download
        </a>
        {onRemove && photo.canRemove ? (
          <button
            type="button"
            disabled={removing}
            onClick={() => onRemove(photo)}
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50 sm:size-8"
            aria-label={`Remove ${photo.name}`}
            data-testid="photo-remove"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function PhotoGrid({ photos, onRemove, removing }: { photos: TicketPhoto[]; onRemove?: (p: TicketPhoto) => void; removing?: number | null }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="photo-grid">
      {photos.map((p) => (
        <PhotoCard key={p.id} photo={p} onRemove={onRemove} removing={removing === p.id} />
      ))}
    </ul>
  );
}

// ── Adding photos ───────────────────────────────────────────────────────────────────────────────────────────────────

function AddPhotos({ busy, onFiles }: { busy: string | null; onFiles: (files: File[]) => void }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  // The menu closes on Escape or a tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  const pick = (input: HTMLInputElement | null) => {
    setOpen(false);
    input?.click();
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };
  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        disabled={busy != null}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        data-testid="photos-add"
      >
        <ImagePlus className="size-5" />
        {busy ?? "Add photos"}
      </button>
      <p className="mt-1 hidden text-center text-[11px] text-muted-foreground sm:block">or drag photos from your computer onto this tab</p>
      {open ? (
        <div role="menu" aria-label="Add photos" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-lift)]">
          <button type="button" role="menuitem" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted" onClick={() => pick(cameraRef.current)} data-testid="photos-pick-camera">
            <Camera className="size-4 text-primary" />
            <span>
              <span className="block font-medium">Camera</span>
              <span className="text-xs text-muted-foreground">Take a photo now</span>
            </span>
          </button>
          <button type="button" role="menuitem" className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm hover:bg-muted" onClick={() => pick(libraryRef.current)} data-testid="photos-pick-library">
            <Images className="size-4 text-primary" />
            <span>
              <span className="block font-medium">Choose from library</span>
              <span className="text-xs text-muted-foreground">One or several photos you already took</span>
            </span>
          </button>
        </div>
      ) : null}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={onChange} data-testid="photos-camera" />
      <input ref={libraryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={onChange} data-testid="photos-library" />
    </div>
  );
}

function invalidatePhotos(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["photos"] });
  void qc.invalidateQueries({ queryKey: ["activity"] });
}

/** A record's Photos: its own tab on the install, ticket and PM windows. */
export function RecordPhotosPanel({ kind, id, className }: { kind: PhotoKind; id: number; className?: string }) {
  const qc = useQueryClient();
  const q = useRecordPhotos(kind, id);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const add = useMutation({ mutationFn: (d: Parameters<typeof addRecordPhoto>[0]["data"]) => addRecordPhoto({ data: d }) });
  const remove = useMutation({
    mutationFn: (photoId: number) => removeRecordPhoto({ data: { photoId } }),
    onSuccess: () => {
      toast.success("Photo removed");
      invalidatePhotos(qc);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the photo");
      // It may be gone or moved already: the list as it is now.
      invalidatePhotos(qc);
    },
  });
  const closed = q.data?.closed ?? null;

  async function onFiles(files: File[]) {
    const pictures = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name));
    if (!pictures.length || closed) return;
    if (busy != null) {
      toast.message("Photos are still being added. Add these once they're done.");
      return;
    }
    let added = 0;
    let untried = 0;
    const failed: string[] = [];
    for (let i = 0; i < pictures.length; i += 1) {
      setBusy(pictures.length === 1 ? "Adding the photo…" : `Adding ${i + 1} of ${pictures.length}…`);
      try {
        const shrunk = await shrinkPhoto(pictures[i]!);
        await add.mutateAsync({ kind, id, ...shrunk });
        added += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : "couldn't be added";
        if (message === PHOTO_ADDED_ELSEWHERE) {
          added += 1;
          continue;
        }
        failed.push(`${pictures[i]!.name}: ${message}`);
        // The record is full, gone or merged: the rest wouldn't go either.
        if (stopsUploads(message)) {
          untried = pictures.length - i - 1;
          break;
        }
      }
    }
    setBusy(null);
    invalidatePhotos(qc);
    if (added) toast.success(added === 1 ? "Photo added" : `${added} photos added`);
    if (failed.length) {
      const more = failed.length > 3 ? `\n…and ${failed.length - 3} more` : "";
      const left = untried ? `\n${untried === 1 ? "1 more photo wasn't" : `${untried} more photos weren't`} tried.` : "";
      toast.error(failed.slice(0, 3).join("\n") + more + left);
    }
  }

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const photos = q.data?.photos ?? [];
  return (
    <section
      className={cn("p-5", over && "ring-2 ring-primary ring-inset", className)}
      data-testid="photos-panel"
      onDragEnter={(e) => {
        if (!hasFiles(e) || closed) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e) || closed) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e) || closed) return;
        e.preventDefault();
        setOver(false);
        void onFiles(Array.from(e.dataTransfer.files ?? []));
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Photos</h3>
        {q.data ? <DownloadAllButton photos={photos} zipName={q.data.zipName} testId="photos-download-all" /> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="photos-where">
        {kind === "install"
          ? "Install photos show on the account's Photos tab too. Each is named for the account, the install and its WO."
          : "These photos stay on this ticket. Each is named for the account and the WO."}
      </p>
      {q.isLoading ? (
        <Skeleton className="mt-3 h-32 w-full" />
      ) : !q.data ? (
        <p className="mt-3 text-sm text-muted-foreground">This record&apos;s photos can&apos;t be shown.</p>
      ) : (
        <>
          {closed ? (
            <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm" data-testid="photos-closed">
              {closed}
            </p>
          ) : (
            <div className="mt-3">
              <AddPhotos busy={busy} onFiles={(f) => void onFiles(f)} />
            </div>
          )}
          {photos.length ? (
            <PhotoGrid
              photos={photos}
              removing={remove.isPending ? (remove.variables ?? null) : null}
              onRemove={(p) => {
                if (window.confirm(PHOTO_REMOVE_CONFIRM)) remove.mutate(p.id);
              }}
            />
          ) : closed ? null : (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="photos-empty">
              No photos yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** The account's Photos tab: its installs' photos, by install, newest install first. */
export function AccountPhotosPanel({ customerId }: { customerId: number }) {
  const q = useQuery({
    queryKey: ["photos", "account", customerId],
    queryFn: () => listAccountPhotos({ data: { customerId } }),
  });
  if (q.isLoading) return <Skeleton className="h-32 w-full" />;
  const data = q.data;
  if (!data) return <p className="text-sm text-muted-foreground">This account&apos;s photos can&apos;t be shown.</p>;
  const all = data.groups.flatMap((g) => g.photos);
  return (
    <div data-testid="account-photos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Install Photos</h2>
        <DownloadAllButton photos={all} zipName={data.zipName} testId="account-photos-download-all" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Photos added on an install&apos;s Photos tab show here. A ticket&apos;s or a PM&apos;s photos stay on that ticket.
      </p>
      {data.groups.length ? (
        data.groups.map((g) => (
          <section key={g.installId} className="mt-5" data-testid="account-photos-group">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm">
                <span className="font-medium">Install{g.wo ? ` · ${g.wo}` : ` #${g.installId}`}</span>
                <span className="text-muted-foreground">
                  {[g.date ? formatLongDate(g.date) : null, g.status, g.equipment].filter(Boolean).map((v) => ` · ${v}`).join("")}
                </span>
              </p>
              {/* With one install, the tab's own Download all is the same .zip. */}
              {data.groups.length > 1 && g.photos.length > 1 ? (
                <DownloadAllButton photos={g.photos} zipName={g.zipName} testId="account-photos-group-download" />
              ) : null}
            </div>
            <PhotoGrid photos={g.photos} />
          </section>
        ))
      ) : (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="account-photos-empty">
          No install photos on this account yet.
        </p>
      )}
    </div>
  );
}
