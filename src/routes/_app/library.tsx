import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookText, FileUp, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { deleteSpecSheet, listSpecSheets, refreshSpecDefaults, setSpecImages } from "@/lib/ops/spec-library";
import { listLibraryFiles } from "@/lib/ops/library-files";
import { pdfImages } from "@/lib/pdf-text";
import { LibraryFileSection } from "@/components/desk/library-files";
import { parseOpenSearch } from "@/lib/ops/search-params";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SpecLibraryList } from "@/components/desk/spec-library";
import { SpecSheetView } from "@/components/desk/spec-sheet";
import { SpecImport } from "@/components/desk/spec-import";

export const Route = createFileRoute("/_app/library")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["spec-library"], queryFn: () => listSpecSheets() });
  const [mode, setMode] = useState<"browse" | "import" | "edit">("browse");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const files = useQuery({ queryKey: ["library-files"], queryFn: () => listLibraryFiles() });
  const manuals = (files.data?.files ?? []).filter((f) => f.section === "manuals");
  const parts = (files.data?.files ?? []).filter((f) => f.section === "parts");
  const filesEdit = !!files.data?.canEdit;
  const rereadInput = useRef<HTMLInputElement>(null);
  const [rereading, setRereading] = useState(false);
  const [found, setFound] = useState<{ image: string | null; dimsImage: string | null; note: string | null; file: string } | null>(null);

  // A file dropped beside a drop zone must not make the browser leave the page to open it.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  async function reread(file: File) {
    setRereading(true);
    try {
      const r = await pdfImages(file);
      setFound({ image: r.image, dimsImage: r.dimsImage, note: r.imageNote, file: file.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that PDF.");
    } finally {
      setRereading(false);
    }
  }
  const sheets = data.data?.sheets ?? [];
  const canEdit = !!data.data?.canEdit;
  const selected = open != null ? sheets.find((s) => s.id === open) ?? null : null;

  function openSheet(id: number | null) {
    void navigate({ to: "/library", search: { open: id ?? undefined } });
  }
  useEffect(() => {
    if (selected) top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useMutation({
    mutationFn: (id: number) => refreshSpecDefaults({ data: { id } }),
    onSuccess: (r) => {
      toast.success(r.changed ? `Updated ${r.changed} configuration${r.changed === 1 ? "" : "s"}: inlet, plug and breaker` : "Already up to date");
      void qc.invalidateQueries({ queryKey: ["spec-library"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not refresh"),
  });
  const applyImages = useMutation({
    mutationFn: (v: { id: number; image: string | null; dimsImage: string | null }) =>
      // No machine photo found → the wrong picture is cleared, never kept. A diagram is only replaced when one was found.
      setSpecImages({ data: { id: v.id, image: v.image, ...(v.dimsImage ? { dimsImage: v.dimsImage } : {}) } }),
    onSuccess: (_r, v) => {
      toast.success(v.image ? "Equipment image updated" : "Image cleared — use Edit to add a photo");
      setFound(null);
      void qc.invalidateQueries({ queryKey: ["spec-library"] });
      void qc.invalidateQueries({ queryKey: ["spec-image"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the image"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteSpecSheet({ data: { id } }),
    onSuccess: () => {
      toast.success("Spec sheet deleted");
      setConfirmDelete(false);
      openSheet(null);
      void qc.invalidateQueries({ queryKey: ["spec-library"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  return (
    <div ref={top} className="scroll-mt-24">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">The Library</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Shop reference in one place: equipment spec sheets, manuals and parts diagrams.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Library sections" data-testid="library-sections">
          {SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              {sec.title}
              <span className="ml-1.5 text-xs tabular text-muted-foreground">{sec.id === "spec-sheets" ? sheets.length : sec.id === "manuals" ? manuals.length : parts.length}</span>
            </a>
          ))}
        </nav>
      </header>

      <section id="spec-sheets" className="mt-8 scroll-mt-24" aria-labelledby="spec-sheets-title" data-testid="section-spec-sheets">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="spec-sheets-title" className="font-display text-2xl font-medium tracking-tight">
              Spec Sheets
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Power, water inlet, drain, plug and size for every configuration, ready to copy into an email or Teams.
            </p>
          </div>
          {canEdit && mode === "browse" ? (
            <Button onClick={() => setMode("import")} data-testid="library-import">
              <FileUp className="size-4" />
              Import Spec Sheet
            </Button>
          ) : null}
        </div>
      <div className="mt-4 grid gap-6">
        {mode === "import" || (mode === "edit" && selected) ? (
          <SpecImport
            key={mode === "edit" ? `edit-${selected?.id}` : "import"}
            editing={mode === "edit" ? selected : null}
            aiReady={!!data.data?.aiReady}
            onCancel={() => setMode("browse")}
            onSaved={(id) => {
              setMode("browse");
              void qc.invalidateQueries({ queryKey: ["spec-library"] });
              openSheet(id);
            }}
          />
        ) : selected ? (
          <div className="grid gap-3">
            <button
              type="button"
              className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => openSheet(null)}
            >
              <ArrowLeft className="size-4" /> All spec sheets
            </button>
            <SpecSheetView sheet={selected} canEdit={canEdit} onEdit={() => setMode("edit")} onDelete={() => setConfirmDelete(true)}
              onRefresh={canEdit ? () => refresh.mutate(selected.id) : undefined}
              refreshing={refresh.isPending}
              onReread={canEdit ? () => rereadInput.current?.click() : undefined}
            />
          </div>
        ) : null}

        {mode === "browse" ? (
          data.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading The Library…</p>
          ) : (
            <SpecLibraryList sheets={sheets} selectedId={selected?.id ?? null} onOpen={(id) => openSheet(id)} />
          )
        ) : null}
      </div>
      </section>

      <input
        ref={rereadInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        data-testid="spec-reread-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void reread(f);
        }}
      />
      <Dialog open={rereading || !!found} onOpenChange={(o) => !o && !rereading && setFound(null)}>
        <DialogContent data-testid="reread-dialog">
          <DialogTitle>Re-Read Image From PDF</DialogTitle>
          {rereading || !found ? (
            <DialogDescription className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Looking for the machine photo…
            </DialogDescription>
          ) : (
            <>
              <DialogDescription>
                {found.image
                  ? `This is the machine photo found in ${found.file}. Warning symbols, logos and barcodes were skipped.`
                  : found.note ?? `No machine photo was found in ${found.file}.`}
              </DialogDescription>
              {found.image ? (
                <img src={found.image} alt="Machine photo found" className="mx-auto mt-3 max-h-64 rounded-lg bg-white object-contain" data-testid="reread-image" />
              ) : null}
              {found.dimsImage ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">Dimensions diagram found</p>
                  <img src={found.dimsImage} alt="Dimensions diagram found" className="mx-auto mt-1 max-h-40 rounded-lg bg-white object-contain" />
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={applyImages.isPending || !selected}
                  data-testid="reread-apply"
                  onClick={() => selected && applyImages.mutate({ id: selected.id, image: found.image, dimsImage: found.dimsImage })}
                >
                  {found.image ? "Use This Image" : "Clear The Current Image"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setFound(null)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <LibraryFileSection
        id="manuals"
        section="manuals"
        title="Manuals"
        blurb="Owner and service manuals. Open one, or send a link by email or text."
        icon={BookText}
        files={manuals}
        canEdit={filesEdit}
        loading={files.isLoading}
      />
      <LibraryFileSection
        id="parts-diagrams"
        section="parts"
        title="Parts Diagrams"
        blurb="Exploded views and parts breakdowns. Open one, or send a link by email or text."
        icon={Wrench}
        files={parts}
        canEdit={filesEdit}
        loading={files.isLoading}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete This Spec Sheet?</DialogTitle>
          <DialogDescription>
            {selected?.manufacturer} {selected?.model} and all of its configurations will be removed from The Library.
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => selected && remove.mutate(selected.id)}>
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep It
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SECTIONS = [
  { id: "spec-sheets", title: "Spec Sheets" },
  { id: "manuals", title: "Manuals" },
  { id: "parts-diagrams", title: "Parts Diagrams" },
] as const;
