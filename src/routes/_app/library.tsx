import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, ChevronDown, ChevronRight, FileUp, Loader2, Pencil, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSpecSheet, getSpecImage, listSpecSheets, refreshSpecDefaults, setSpecImages, type SavedSpecSheet } from "@/lib/ops/spec-library";
import {
  createLibraryBook,
  deleteLibraryBook,
  deleteLibraryFile,
  listLibraryFiles,
  moveLibraryFile,
  moveSpecSheet,
  renameLibraryBook,
  type LibraryBook,
  type LibraryFile,
} from "@/lib/ops/library-files";
import { fileError, fileUrl, matchBook, modelLabel, SHELF, shortDocName, type LibrarySection } from "@/lib/ops/library-file-rules";
import { pdfImages } from "@/lib/pdf-text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AddTarget, BookPicker, DocRow, DROP_RULES, originOf, uploadLibraryFile } from "@/components/desk/library-files";
import { ZoomableImage } from "@/components/desk/image-lightbox";
import { SpecSheetView } from "@/components/desk/spec-sheet";
import { SpecImport } from "@/components/desk/spec-import";
import { cn } from "@/lib/utils";

type Search = { open?: number; book?: number };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

export const Route = createFileRoute("/_app/library")({
  validateSearch: (s: Record<string, unknown>): Search => ({ open: num(s.open), book: num(s.book) }),
  component: Page,
});

const TYPES: { section: LibrarySection; id: string; add: string }[] = [
  { section: "spec", id: "spec-sheet", add: "Spec Sheet" },
  { section: "manuals", id: "manuals", add: "Manual" },
  { section: "parts", id: "parts-diagrams", add: "Parts Diagram" },
];

type Ask =
  | { kind: "file"; fileName: string; section: LibrarySection; resolve: (b: LibraryBook | null) => void }
  | { kind: "move-file"; file: LibraryFile }
  | { kind: "move-sheet"; sheet: SavedSpecSheet };

function Page() {
  const { open, book: bookParam } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["spec-library"], queryFn: () => listSpecSheets() });
  const lib = useQuery({ queryKey: ["library-files"], queryFn: () => listLibraryFiles() });
  const sheets = data.data?.sheets ?? [];
  const books = lib.data?.books ?? [];
  const files = lib.data?.files ?? [];
  const sheetBook = new Map((lib.data?.sheetBooks ?? []).map((r) => [r.sheetId, r.bookId]));
  const canEdit = !!data.data?.canEdit;
  const selected = open != null ? sheets.find((s) => s.id === open) ?? null : null;
  const bookId = bookParam ?? (selected ? sheetBook.get(selected.id) ?? null : null);
  const book = bookId != null ? books.find((b) => b.id === bookId) ?? null : null;

  const [mode, setMode] = useState<"browse" | "import" | "edit">("browse");
  const [importFile, setImportFile] = useState<{ file: File; bookId: number } | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<{ section: LibrarySection; text: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<LibraryFile | null>(null);
  const [renaming, setRenaming] = useState<{ manufacturer: string; model: string } | null>(null);
  const [openMaker, setOpenMaker] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState(false);
  const rereadInput = useRef<HTMLInputElement>(null);
  const [rereading, setRereading] = useState(false);
  const [found, setFound] = useState<{ image: string | null; dimsImage: string | null; note: string | null; file: string } | null>(null);
  const bookPanel = useRef<HTMLDivElement>(null);

  const go = (s: Search) => void navigate({ to: "/library", search: s });
  const reload = () =>
    Promise.all([qc.invalidateQueries({ queryKey: ["library-files"] }), qc.invalidateQueries({ queryKey: ["spec-library"] })]);
  const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);

  useEffect(() => {
    if (book) bookPanel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /** Into the model that's open (`into`), else the model the file name matches. No match → ask; never guess. */
  async function addFiles(section: LibrarySection, list: File[], into?: LibraryBook | null) {
    if (!list.length || busy) return;
    const errors: string[] = [];
    let known = books;
    let last: LibraryBook | null = null;
    for (const file of list) {
      const problem = fileError(file.name, file.size);
      if (problem) {
        errors.push(problem);
        continue;
      }
      let target = into ?? matchBook(file.name, known);
      if (!target) {
        target = await new Promise<LibraryBook | null>((resolve) => setAsk({ kind: "file", fileName: file.name, section, resolve }));
        setAsk(null);
        if (!target) {
          errors.push(`${file.name} was skipped — no book chosen.`);
          continue;
        }
        if (!known.some((b) => b.id === target!.id)) known = [...known, target];
      }
      try {
        const name = await uploadLibraryFile(file, section, target.id, (pct) => setBusy({ section, text: `Adding ${file.name}… ${pct}%` }));
        toast.success(`Filed in ${target.title} → ${SHELF[section].title} as ${name}`);
        last = target;
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "could not be added"}`);
      }
    }
    setBusy(null);
    setProblems(errors);
    if (errors.length) toast.error(errors.length === 1 ? errors[0]! : `${errors.length} files were not added — see the list at the top`);
    await reload();
    if (last) {
      setAdding(false);
      setOpenMaker(last.manufacturer);
      go({ book: last.id });
    }
  }

  async function pickForAsk(target: LibraryBook) {
    if (!ask) return;
    if (ask.kind === "file") return ask.resolve(target);
    try {
      if (ask.kind === "move-file") await moveLibraryFile({ data: { id: ask.file.id, bookId: target.id } });
      else await moveSpecSheet({ data: { sheetId: ask.sheet.id, bookId: target.id } });
      toast.success(`Moved to ${target.title}`);
      setAsk(null);
      setOpenMaker(target.manufacturer);
      await reload();
      go(ask.kind === "move-sheet" && selected ? { book: target.id, open: selected.id } : { book: target.id });
    } catch (e) {
      fail(e, "Could not move it");
    }
  }
  async function createForAsk(manufacturer: string, model: string) {
    try {
      await pickForAsk(await createLibraryBook({ data: { manufacturer, model } }));
    } catch (e) {
      fail(e, "Could not create the book");
    }
  }

  async function readSpecsFrom(file: LibraryFile) {
    try {
      const res = await fetch(fileUrl(originOf(), file.token));
      if (!res.ok) throw new Error("Couldn't open that file.");
      setImportFile({ file: new File([await res.blob()], file.name, { type: file.mime }), bookId: file.bookId! });
      setMode("import");
    } catch (e) {
      fail(e, "Couldn't open that file.");
    }
  }

  /** After the AI read is saved: the sheet joins its book and the original PDF is kept there. */
  async function afterImport(id: number, pdf: File | null) {
    const from = importFile;
    setOpenMaker(null);
    setMode("browse");
    setImportFile(null);
    try {
      if (from) await moveSpecSheet({ data: { sheetId: id, bookId: from.bookId } });
      await reload();
      const fresh = await qc.fetchQuery({ queryKey: ["library-files"], queryFn: () => listLibraryFiles() });
      const target = fresh.sheetBooks.find((r) => r.sheetId === id)?.bookId ?? null;
      if (pdf && target && !from) {
        await uploadLibraryFile(pdf, "spec", target);
        await reload();
      }
      go(target ? { book: target, open: id } : { open: id });
    } catch (e) {
      fail(e, "Saved, but the PDF could not be stored. Drop it on Spec Sheet.");
      go({ open: id });
    }
  }

  async function reread(file: File) {
    setRereading(true);
    try {
      const r = await pdfImages(file);
      setFound({ image: r.image, dimsImage: r.dimsImage, note: r.imageNote, file: file.name });
    } catch (e) {
      fail(e, "Couldn't read that PDF.");
    } finally {
      setRereading(false);
    }
  }

  const refresh = useMutation({
    mutationFn: (id: number) => refreshSpecDefaults({ data: { id } }),
    onSuccess: (r) => {
      toast.success(r.changed ? `Updated ${r.changed} configuration${r.changed === 1 ? "" : "s"}: inlet, plug and breaker` : "Already up to date");
      void reload();
    },
    onError: (e) => fail(e, "Could not refresh"),
  });
  const applyImages = useMutation({
    mutationFn: (v: { id: number; image: string | null; dimsImage: string | null }) =>
      // No machine photo found → the wrong picture is cleared, never kept. A diagram is only replaced when one was found.
      setSpecImages({ data: { id: v.id, image: v.image, ...(v.dimsImage ? { dimsImage: v.dimsImage } : {}) } }),
    onSuccess: (_r, v) => {
      toast.success(v.image ? "Equipment image updated" : "Image cleared — use Edit to add a photo");
      setFound(null);
      void reload();
      void qc.invalidateQueries({ queryKey: ["spec-image"] });
    },
    onError: (e) => fail(e, "Could not save the image"),
  });
  const removeSheet = useMutation({
    mutationFn: (id: number) => deleteSpecSheet({ data: { id } }),
    onSuccess: () => {
      toast.success("Spec sheet deleted");
      setConfirmDelete(false);
      go(book ? { book: book.id } : {});
      void reload();
    },
    onError: (e) => fail(e, "Could not delete"),
  });
  const removeFile = useMutation({
    mutationFn: (id: number) => deleteLibraryFile({ data: { id } }),
    onSuccess: () => {
      toast.success("File deleted");
      setFileToDelete(null);
      void reload();
    },
    onError: (e) => fail(e, "Could not delete"),
  });
  const rename = useMutation({
    mutationFn: (v: { id: number; manufacturer: string; model: string }) => renameLibraryBook({ data: v }),
    onSuccess: () => {
      toast.success("Renamed");
      setRenaming(null);
      void reload();
    },
    onError: (e) => fail(e, "Could not rename"),
  });
  const removeBook = useMutation({
    mutationFn: (id: number) => deleteLibraryBook({ data: { id } }),
    onSuccess: () => {
      toast.success("Model removed");
      go({});
      void reload();
    },
    onError: (e) => fail(e, "Could not remove the book"),
  });

  const inBook = (id: number) => ({
    sheets: sheets.filter((s) => sheetBook.get(s.id) === id),
    files: files.filter((f) => f.bookId === id),
  });
  const needle = q.trim().toLowerCase();
  const shownBooks = books.filter((b) => b.title.toLowerCase().includes(needle));
  const makers = [...new Set(shownBooks.map((b) => b.manufacturer))].sort((x, y) => x.localeCompare(y, "en", { sensitivity: "base" }));
  const unfiled = files.filter((f) => f.bookId == null);
  const loading = data.isLoading || lib.isLoading;
  // One maker open at a time: the one clicked, else the one holding the open model, else the only search hit.
  const wanted = openMaker ?? book?.manufacturer ?? null;
  const activeMaker = wanted && makers.includes(wanted) ? wanted : makers[0] ?? null;
  const models = shownBooks.filter((b) => b.manufacturer === activeMaker);
  const current = book && book.manufacturer === activeMaker && models.some((m) => m.id === book.id) ? book : models[0] ?? null;
  const inside = current ? inBook(current.id) : null;
  // Phone: makers and models are rows of buttons above the documents. Desktop: three columns.
  const pick = (on: boolean) =>
    cn(
      "inline-flex h-11 items-center justify-between gap-3 rounded-full border px-4 text-sm font-medium md:w-full md:rounded-none md:border-0 md:border-t md:border-border md:px-4",
      on ? "border-ink bg-ink text-cream" : "border-border bg-background hover:bg-primary/5 md:bg-transparent",
    );
  const colHead = "px-1 pb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase md:px-4 md:py-3";

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h1 className="font-display text-3xl font-medium tracking-tight">The Library</h1>
        <label className="relative block sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setOpenMaker(null); }} placeholder="Search maker or model" aria-label="Search maker or model" className="pl-9" data-testid="book-search" />
        </label>
        {canEdit ? (
          <Button type="button" onClick={() => setAdding(true)} data-testid="library-add">
            <Plus className="size-4" /> Add Files
          </Button>
        ) : null}
      </header>

      {problems.length ? (
        <ul className="mt-3 grid gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm" role="alert" data-testid="library-errors">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      {mode === "import" ? (
        <section className="mt-5" data-testid="spec-import-panel">
          <SpecImport
            key={importFile ? `file-${importFile.file.name}` : "import"}
            aiReady={!!data.data?.aiReady}
            initialFile={importFile?.file ?? null}
            onCancel={() => {
              setMode("browse");
              setImportFile(null);
            }}
            onSaved={(id, pdf) => void afterImport(id, pdf)}
          />
        </section>
      ) : null}

      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading The Library…</p>
      ) : !current || !inside ? (
        <p className="mt-5 rounded-xl border border-dashed border-border bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground" data-testid="books-empty">
          {books.length ? "Nothing matches that search." : "Nothing here yet. Use Add Files to add the first spec sheet, manual or parts diagram."}
        </p>
      ) : (
        <>
          <section className="mt-5 grid gap-3 md:grid-cols-[200px_200px_minmax(0,1fr)] md:items-start" aria-label="Library" data-testid="library-makers">
            <div className="rounded-xl md:overflow-hidden md:border md:border-border md:bg-card">
              <h2 className={colHead}>Manufacturer</h2>
              <div className="flex flex-wrap gap-2 md:block" role="radiogroup" aria-label="Manufacturer">
                {makers.map((maker) => {
                  const count = shownBooks.filter((b) => b.manufacturer === maker).length;
                  return (
                    <button
                      key={maker}
                      type="button"
                      role="radio"
                      aria-checked={maker === activeMaker}
                      className={pick(maker === activeMaker)}
                      data-testid="maker"
                      data-maker={maker}
                      onClick={() => {
                        setMode("browse");
                        setOpenMaker(maker);
                        go({ book: shownBooks.find((b) => b.manufacturer === maker)!.id });
                      }}
                    >
                      <span className="text-left break-words">{maker}</span>
                      <span className="text-xs tabular opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl md:overflow-hidden md:border md:border-border md:bg-card">
              <h2 className={colHead}>Model</h2>
              <div className="flex flex-wrap gap-2 md:block" role="radiogroup" aria-label={`${activeMaker} models`} data-testid="model-chips">
                {models.map((m) => {
                  const c = inBook(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={m.id === current.id}
                      className={pick(m.id === current.id)}
                      data-testid="model-chip"
                      onClick={() => {
                        setMode("browse");
                        setOpenMaker(m.manufacturer);
                        go({ book: m.id });
                      }}
                    >
                      <span className="text-left break-words">{modelLabel(m.title, m.manufacturer)}</span>
                      <span className="text-xs tabular opacity-70">{c.files.length + c.sheets.length}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={bookPanel} className="scroll-mt-24 rounded-xl border border-border bg-card px-4 pb-4" data-testid="open-book">
              <div className="flex items-center gap-2 pt-1">
                <h2 className="py-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase" data-testid="open-book-title">{current.title}</h2>
                {canEdit ? (
                  <Button type="button" size="sm" variant={manage ? "secondary" : "ghost"} className="ml-auto" aria-pressed={manage} onClick={() => setManage(!manage)} data-testid="manage">
                    <Settings2 className="size-4" /> {manage ? "Done" : "Manage"}
                  </Button>
                ) : null}
              </div>
                    <div className="flex flex-col gap-4 lg:flex-row">
                      <ModelPhoto sheet={inside.sheets.find((s) => s.hasImage) ?? null} title={current.title} />
                      <ul className="min-w-0 flex-1 divide-y divide-border" data-testid="docs">
                        {inside.sheets.map((s) => (
                          <li key={`s${s.id}`} className="flex min-h-12 items-center gap-2 py-1" data-testid="shelf-specs">
                            <span className="w-16 shrink-0 text-[11px] font-semibold tracking-[0.1em] text-copper uppercase">Specs</span>
                            <button
                              type="button"
                              aria-expanded={selected?.id === s.id}
                              className="min-w-0 flex-1 py-2 text-left text-sm font-medium break-words hover:underline"
                              onClick={() => go({ book: current.id, open: selected?.id === s.id ? undefined : s.id })}
                              data-testid="shelf-specs-open"
                            >
                              {inside.sheets.length > 1 ? `${s.model}: ` : ""}Power, Water, Plug, Size
                            </button>
                            {selected?.id === s.id ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                            {manage ? (
                              <Button type="button" size="sm" variant="ghost" className="size-11 shrink-0 p-0" title="Move to another model" aria-label="Move these specs to another model" onClick={() => setAsk({ kind: "move-sheet", sheet: s })}>
                                <ArrowRightLeft className="size-4" />
                              </Button>
                            ) : null}
                          </li>
                        ))}
                        {TYPES.flatMap((t) => inside.files.filter((f) => f.section === t.section)).map((f) => (
                          <DocRow
                            key={f.id}
                            file={f}
                            label={shortDocName(f.name, current.title)}
                            manage={manage}
                            onMove={(file) => setAsk({ kind: "move-file", file })}
                            onDelete={setFileToDelete}
                            extra={
                              f.section === "spec" && canEdit && !inside.sheets.length && f.mime === "application/pdf" ? (
                                <Button type="button" size="sm" variant="outline" onClick={() => void readSpecsFrom(f)} data-testid="read-specs">
                                  <FileUp className="size-4" /> Read Specs
                                </Button>
                              ) : null
                            }
                          />
                        ))}
                        {!inside.files.length && !inside.sheets.length ? <li className="py-3 text-sm text-muted-foreground">No documents yet.</li> : null}
                      </ul>
                    </div>

                    {canEdit ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="model-add">
                        <span className="text-xs text-muted-foreground">Add to {modelLabel(current.title, current.manufacturer)}:</span>
                        {TYPES.map((t) => (
                          <AddTarget
                            key={t.section}
                            id={`here-${t.id}`}
                            label={t.add}
                            busy={busy?.section === t.section ? busy.text : null}
                            disabled={!!busy}
                            onFiles={(list) => void addFiles(t.section, list, current)}
                          />
                        ))}
                        {manage ? (
                          <>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming({ manufacturer: current.manufacturer, model: modelLabel(current.title, current.manufacturer) })} data-testid="book-rename">
                              <Pencil className="size-4" /> Rename
                            </Button>
                            {!inside.sheets.length && !inside.files.length ? (
                              <Button type="button" size="sm" variant="ghost" disabled={removeBook.isPending} onClick={() => removeBook.mutate(current.id)}>
                                <Trash2 className="size-4" /> Remove Model
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}

            </div>
          </section>

                    {mode === "edit" && selected ? (
                      <div className="mt-5">
                        <SpecImport key={`edit-${selected.id}`} editing={selected} aiReady={!!data.data?.aiReady} onCancel={() => setMode("browse")} onSaved={(id) => { setMode("browse"); void reload(); go({ book: current.id, open: id }); }} />
                      </div>
                    ) : selected && mode === "browse" && sheetBook.get(selected.id) === current.id ? (
                      <div className="mt-5" data-testid="book-spec-sheet">
                        <SpecSheetView
                          sheet={selected}
                          canEdit={canEdit}
                          onEdit={() => setMode("edit")}
                          onDelete={() => setConfirmDelete(true)}
                          onRefresh={canEdit ? () => refresh.mutate(selected.id) : undefined}
                          refreshing={refresh.isPending}
                          onReread={canEdit ? () => rereadInput.current?.click() : undefined}
                        />
                      </div>
                    ) : null}
        </>
      )}

      {unfiled.length ? (
        <section className="mt-6 rounded-xl border border-border bg-card px-4 py-3" aria-labelledby="unfiled-title" data-testid="library-unfiled">
          <div className="flex items-center gap-2">
            <h2 id="unfiled-title" className="font-display text-lg font-medium">
              Not Filed Yet
            </h2>
            <span className="text-xs text-muted-foreground">{unfiled.length}</span>
            {canEdit ? (
              <Button type="button" size="sm" variant={manage ? "secondary" : "ghost"} className="ml-auto" onClick={() => setManage(!manage)}>
                <Settings2 className="size-4" /> {manage ? "Done" : "Manage"}
              </Button>
            ) : null}
          </div>
          <ul className="divide-y divide-border">
            {unfiled.map((f) => (
              <DocRow key={f.id} file={f} label={f.name.replace(/\.[A-Za-z0-9]+$/, "")} manage={manage} onMove={(file) => setAsk({ kind: "move-file", file })} onDelete={setFileToDelete} />
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={adding && !ask} onOpenChange={(o) => !o && !busy && setAdding(false)}>
        <DialogContent data-testid="add-dialog">
          <DialogTitle>Add Files</DialogTitle>
          <DialogDescription>
            Drop a file on its type, or click to choose. It is filed under the maker and model in its name; if that isn't clear, you pick. {DROP_RULES}
          </DialogDescription>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {TYPES.map((t) => (
              <AddTarget key={t.section} id={t.id} label={t.add} large busy={busy?.section === t.section ? busy.text : null} disabled={!!busy} onFiles={(list) => void addFiles(t.section, list)} />
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-3 w-fit" onClick={() => { setAdding(false); setImportFile(null); setMode("import"); }} data-testid="library-import">
            <FileUp className="size-4" /> Import A Spec Sheet And Read Its Specs
          </Button>
        </DialogContent>
      </Dialog>

      <BookPicker
        open={!!ask}
        heading={ask?.kind === "file" ? "Which Model Is This For?" : "Move To Which Model?"}
        detail={
          ask?.kind === "file"
            ? `${ask.fileName} doesn't match a model. Pick the model for this ${SHELF[ask.section].type.toLowerCase()}, or add a new one.`
            : ask?.kind === "move-file"
              ? `${ask.file.name} will be renamed for the model you pick.`
              : ask?.kind === "move-sheet"
                ? `${ask.sheet.manufacturer} ${ask.sheet.model} specs will move to the model you pick.`
                : ""
        }
        books={books}
        currentId={book?.id ?? null}
        cancelLabel={ask?.kind === "file" ? "Skip This File" : "Cancel"}
        onPick={(b) => void pickForAsk(b)}
        onCreate={(m, n) => void createForAsk(m, n)}
        onCancel={() => {
          if (ask?.kind === "file") ask.resolve(null);
          else setAsk(null);
        }}
      />

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
              {found.image ? <img src={found.image} alt="Machine photo found" className="mx-auto mt-3 max-h-64 rounded-lg bg-white object-contain" data-testid="reread-image" /> : null}
              {found.dimsImage ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">Dimensions diagram found</p>
                  <img src={found.dimsImage} alt="Dimensions diagram found" className="mx-auto mt-1 max-h-40 rounded-lg bg-white object-contain" />
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" disabled={applyImages.isPending || !selected} data-testid="reread-apply" onClick={() => selected && applyImages.mutate({ id: selected.id, image: found.image, dimsImage: found.dimsImage })}>
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

      <Dialog open={renaming != null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>Files already stored keep their names; new ones use the new name.</DialogDescription>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (book && renaming && renaming.manufacturer.trim().length >= 2 && renaming.model.trim()) {
                setOpenMaker(renaming.manufacturer.trim());
                rename.mutate({ id: book.id, manufacturer: renaming.manufacturer.trim(), model: renaming.model.trim() });
              }
            }}
          >
            <Input value={renaming?.manufacturer ?? ""} onChange={(e) => renaming && setRenaming({ ...renaming, manufacturer: e.target.value })} aria-label="Manufacturer" placeholder="Manufacturer" />
            <Input value={renaming?.model ?? ""} onChange={(e) => renaming && setRenaming({ ...renaming, model: e.target.value })} aria-label="Model" placeholder="Model" />
            <Button type="submit" disabled={rename.isPending}>
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fileToDelete} onOpenChange={(o) => !o && setFileToDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete This File?</DialogTitle>
          <DialogDescription>{fileToDelete?.name} will be removed from The Library. Links already sent for it will stop working.</DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="destructive" disabled={removeFile.isPending} onClick={() => fileToDelete && removeFile.mutate(fileToDelete.id)}>
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={() => setFileToDelete(null)}>
              Keep It
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete This Spec Sheet?</DialogTitle>
          <DialogDescription>
            {selected?.manufacturer} {selected?.model} and all of its configurations will be removed from The Library.
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="destructive" disabled={removeSheet.isPending} onClick={() => selected && removeSheet.mutate(selected.id)}>
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

/** The machine photo for the open model; click to enlarge. Nothing is shown when no photo is saved. */
function ModelPhoto({ sheet, title }: { sheet: SavedSpecSheet | null; title: string }) {
  const image = useQuery({
    queryKey: ["spec-image", sheet?.id, sheet?.updatedAt],
    queryFn: () => getSpecImage({ data: { id: sheet!.id } }),
    enabled: !!sheet,
    staleTime: 5 * 60_000,
  });
  const photo = image.data?.image ?? null;
  if (!photo) return null;
  return (
    <div className="size-36 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
      <ZoomableImage src={photo} alt={title} label={title} className="h-full" imgClassName="h-full w-full object-contain p-1.5" testId="book-photo" />
    </div>
  );
}
