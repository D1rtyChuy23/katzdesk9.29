import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookText, FileUp, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { deleteSpecSheet, listSpecSheets, refreshSpecDefaults } from "@/lib/ops/spec-library";
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
          Shop reference in one place: equipment spec sheets now, manuals and parts diagrams as they're added.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Library sections" data-testid="library-sections">
          {SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              {sec.title}
              <span className="ml-1.5 text-xs tabular text-muted-foreground">{sec.id === "spec-sheets" ? sheets.length : 0}</span>
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

      <EmptySection
        id="manuals"
        title="Manuals"
        icon={BookText}
        text="Owner and service manuals will live here. Nothing has been added yet."
      />
      <EmptySection
        id="parts-diagrams"
        title="Parts Diagrams"
        icon={Wrench}
        text="Exploded views and parts breakdowns will live here. Nothing has been added yet."
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

/** A Library section with nothing in it yet — always shown, ready for uploads later. */
function EmptySection({ id, title, icon: Icon, text }: { id: string; title: string; icon: LucideIcon; text: string }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24" aria-labelledby={`${id}-title`} data-testid={`section-${id}`}>
      <div className="border-b border-border pb-3">
        <h2 id={`${id}-title`} className="font-display text-2xl font-medium tracking-tight">
          {title}
        </h2>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-5 py-6">
        <Icon className="size-5 shrink-0 text-copper" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </section>
  );
}
