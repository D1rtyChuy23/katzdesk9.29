import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, BookOpen, BookText, FileSpreadsheet, FileUp, Loader2, Pencil, Search, Trash2, Wrench, X } from "lucide-react";
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
import { fileError, fileUrl, matchBook, SHELF, type LibrarySection } from "@/lib/ops/library-file-rules";
import { pdfImages } from "@/lib/pdf-text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BookPicker, DROP_RULES, FileRow, originOf, SendButtons, ShelfDropZone, uploadLibraryFile } from "@/components/desk/library-files";
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

const SHELVES: { section: LibrarySection; id: string; icon: typeof BookText; hint: string }[] = [
  { section: "spec", id: "spec-sheet", icon: FileSpreadsheet, hint: "Drop the spec sheet here" },
  { section: "manuals", id: "manuals", icon: BookText, hint: "Drop owner and service manuals here" },
  { section: "parts", id: "parts-diagrams", icon: Wrench, hint: "Drop parts books and exploded views here" },
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
  const [renaming, setRenaming] = useState<string | null>(null);
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

  /** Drop → matching book and shelf. No match → ask; never guess. */
  async function addFiles(section: LibrarySection, list: File[]) {
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
      let target = matchBook(file.name, known);
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
    if (errors.length) toast.error(errors.length === 1 ? errors[0]! : `${errors.length} files were not added — see the list under the drop zones`);
    await reload();
    if (last) go({ book: last.id });
  }

  async function pickForAsk(target: LibraryBook) {
    if (!ask) return;
    if (ask.kind === "file") return ask.resolve(target);
    try {
      if (ask.kind === "move-file") await moveLibraryFile({ data: { id: ask.file.id, bookId: target.id } });
      else await moveSpecSheet({ data: { sheetId: ask.sheet.id, bookId: target.id } });
      toast.success(`Moved to ${target.title}`);
      setAsk(null);
      await reload();
      go(ask.kind === "move-sheet" && selected ? { book: target.id, open: selected.id } : { book: target.id });
    } catch (e) {
      fail(e, "Could not move it");
    }
  }
  async function createForAsk(title: string) {
    try {
      await pickForAsk(await createLibraryBook({ data: { title } }));
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
    mutationFn: (v: { id: number; title: string }) => renameLibraryBook({ data: v }),
    onSuccess: () => {
      toast.success("Book renamed");
      setRenaming(null);
      void reload();
    },
    onError: (e) => fail(e, "Could not rename"),
  });
  const removeBook = useMutation({
    mutationFn: (id: number) => deleteLibraryBook({ data: { id } }),
    onSuccess: () => {
      toast.success("Book removed");
      go({});
      void reload();
    },
    onError: (e) => fail(e, "Could not remove the book"),
  });

  const inBook = (id: number) => ({
    sheets: sheets.filter((s) => sheetBook.get(s.id) === id),
    files: files.filter((f) => f.bookId === id),
  });
  const shownBooks = books.filter((b) => b.title.toLowerCase().includes(q.trim().toLowerCase()));
  const unfiled = files.filter((f) => f.bookId == null);
  const open_ = book ? inBook(book.id) : null;
  const specPdf = open_?.files.find((f) => f.section === "spec") ?? null;
  const loading = data.isLoading || lib.isLoading;

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">The Library</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One book per equipment family. Each book holds its spec sheet, manuals and parts diagrams.
          </p>
        </div>
        <label className="relative block sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search books" aria-label="Search books" className="pl-9" data-testid="book-search" />
        </label>
      </header>

      {/* The map: The Library → books */}
      <section className="mt-6" aria-label="Books" data-testid="library-books">
        <div className="flex flex-col items-center">
          <span className="rounded-full bg-ink px-4 py-1.5 font-display text-sm font-medium text-cream">The Library</span>
          <span className="h-5 w-px bg-border" aria-hidden="true" />
        </div>
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Loading The Library…</p>
        ) : shownBooks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground" data-testid="books-empty">
            {books.length ? "No book matches that search." : "No books yet. Drop a spec sheet, manual or parts diagram below to start the first one."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-9 pt-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shownBooks.map((b) => {
              const c = inBook(b.id);
              return (
                <BookCover
                  key={b.id}
                  book={b}
                  cover={c.sheets.find((s) => s.hasImage) ?? null}
                  counts={{
                    spec: c.sheets.length + c.files.filter((f) => f.section === "spec").length,
                    manuals: c.files.filter((f) => f.section === "manuals").length,
                    parts: c.files.filter((f) => f.section === "parts").length,
                  }}
                  active={book?.id === b.id}
                  onOpen={() => {
                    setMode("browse");
                    go(book?.id === b.id ? {} : { book: b.id });
                  }}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* The open book: three shelves */}
      {book && open_ ? (
        <section ref={bookPanel} className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-card/70 p-4 sm:p-6" aria-labelledby="open-book-title" data-testid="open-book">
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen className="size-5 text-copper" />
            <h2 id="open-book-title" className="font-display text-2xl font-medium tracking-tight" data-testid="open-book-title">
              {book.title}
            </h2>
            <span className="ml-auto flex items-center gap-1">
              {canEdit ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(book.title)} data-testid="book-rename">
                  <Pencil className="size-4" /> Rename
                </Button>
              ) : null}
              {canEdit && !open_.sheets.length && !open_.files.length ? (
                <Button type="button" size="sm" variant="ghost" disabled={removeBook.isPending} onClick={() => removeBook.mutate(book.id)}>
                  <Trash2 className="size-4" /> Remove Empty Book
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" onClick={() => go({})} aria-label="Close book">
                <X className="size-4" /> Close
              </Button>
            </span>
          </div>
          <div className="mx-auto mt-3 h-4 w-px bg-border" aria-hidden="true" />
          <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-3">
            {SHELVES.map((sh) => {
              const shelfFiles = open_.files.filter((f) => f.section === sh.section);
              const shelfSheets = sh.section === "spec" ? open_.sheets : [];
              const Icon = sh.icon;
              return (
                <div key={sh.section} className="rounded-xl border border-border bg-background" data-testid={`shelf-${sh.id}`}>
                  <h3 className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    <Icon className="size-4 text-copper" /> {SHELF[sh.section].title}
                    <span className="ml-auto tabular">{shelfFiles.length + shelfSheets.length}</span>
                  </h3>
                  <ul className="divide-y divide-border">
                    {shelfSheets.map((s) => (
                      <li key={`s${s.id}`} className="flex items-center gap-2 px-3 py-3" data-testid="shelf-specs">
                        <button
                          type="button"
                          className={cn("group flex min-w-0 flex-1 items-start gap-2.5 text-left", selected?.id === s.id && "text-primary")}
                          onClick={() => go({ book: book.id, open: selected?.id === s.id ? undefined : s.id })}
                          data-testid="shelf-specs-open"
                        >
                          <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-copper" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium break-words group-hover:underline">
                              {s.manufacturer} {s.model}
                            </span>
                            <span className="block text-xs text-muted-foreground">Power, water, plug and size · {s.configs.length} configuration{s.configs.length === 1 ? "" : "s"}</span>
                          </span>
                        </button>
                        {canEdit ? (
                          <Button type="button" size="sm" variant="ghost" title="Move to another book" aria-label="Move these specs to another book" onClick={() => setAsk({ kind: "move-sheet", sheet: s })}>
                            <ArrowRightLeft className="size-4" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                    {shelfFiles.map((f) => (
                      <FileRow
                        key={f.id}
                        file={f}
                        canEdit={canEdit}
                        onMove={(file) => setAsk({ kind: "move-file", file })}
                        onDelete={setFileToDelete}
                        extra={
                          sh.section === "spec" && canEdit && !open_.sheets.length && f.mime === "application/pdf" ? (
                            <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => void readSpecsFrom(f)} data-testid="read-specs">
                              <FileUp className="size-4" /> Read Specs From This PDF
                            </Button>
                          ) : null
                        }
                      />
                    ))}
                    {!shelfFiles.length && !shelfSheets.length ? (
                      <li className="px-3 py-4 text-sm text-muted-foreground">Nothing here yet.</li>
                    ) : sh.section === "spec" && !shelfFiles.length ? (
                      <li className="px-3 py-3 text-xs text-muted-foreground" data-testid="spec-no-pdf">
                        The original PDF isn't stored for this spec sheet yet. Drop it on Spec Sheet below to get Email and Text.
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>

          {mode === "edit" && selected ? (
            <div className="mt-6">
              <SpecImport key={`edit-${selected.id}`} editing={selected} aiReady={!!data.data?.aiReady} onCancel={() => setMode("browse")} onSaved={(id) => { setMode("browse"); void reload(); go({ book: book.id, open: id }); }} />
            </div>
          ) : selected && mode === "browse" ? (
            <div className="mt-6 grid gap-3" data-testid="book-spec-sheet">
              {specPdf ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5" data-testid="spec-send">
                  <a href={fileUrl(originOf(), specPdf.token)} target="_blank" rel="noopener" className="min-w-0 flex-1 text-sm font-medium break-words hover:underline" data-testid="spec-send-open">
                    {specPdf.name}
                  </a>
                  <SendButtons name={specPdf.name} url={fileUrl(originOf(), specPdf.token)} />
                </div>
              ) : null}
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
        </section>
      ) : null}

      {mode === "import" ? (
        <section className="mt-8" data-testid="spec-import-panel">
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

      {/* Drop zones stay under the books */}
      {canEdit ? (
        <section className="mt-8" aria-labelledby="add-title" data-testid="library-drops">
          <h2 id="add-title" className="font-display text-xl font-medium tracking-tight">
            Add To The Library
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Drop a file on its type. It goes to the matching book and is renamed Family - Type. {DROP_RULES}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {SHELVES.map((sh) => (
              <ShelfDropZone
                key={sh.section}
                id={sh.id}
                title={SHELF[sh.section].title}
                hint={sh.hint}
                icon={sh.icon}
                busy={busy?.section === sh.section ? busy.text : null}
                disabled={!!busy}
                onFiles={(list) => void addFiles(sh.section, list)}
              >
                {sh.section === "spec" && mode === "browse" ? (
                  <Button type="button" size="sm" onClick={() => { setImportFile(null); setMode("import"); }} data-testid="library-import">
                    <FileUp className="size-4" /> Import And Read Specs
                  </Button>
                ) : null}
              </ShelfDropZone>
            ))}
          </div>
          {problems.length ? (
            <ul className="mt-3 grid gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm" role="alert" data-testid="library-errors">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {unfiled.length ? (
        <section className="mt-8" aria-labelledby="unfiled-title" data-testid="library-unfiled">
          <h2 id="unfiled-title" className="font-display text-xl font-medium tracking-tight">
            Not In A Book Yet
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">These were added before books. {canEdit ? "Use the move button to choose a book for each." : ""}</p>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {unfiled.map((f) => (
              <FileRow key={f.id} file={f} canEdit={canEdit} onMove={(file) => setAsk({ kind: "move-file", file })} onDelete={setFileToDelete} />
            ))}
          </ul>
        </section>
      ) : null}

      <BookPicker
        open={!!ask}
        heading={ask?.kind === "file" ? "Which Book Is This For?" : "Move To Which Book?"}
        detail={
          ask?.kind === "file"
            ? `${ask.fileName} doesn't match a book. Pick the book for this ${SHELF[ask.section].type.toLowerCase()}, or create a new one.`
            : ask?.kind === "move-file"
              ? `${ask.file.name} will be renamed for the book you pick.`
              : ask?.kind === "move-sheet"
                ? `${ask.sheet.manufacturer} ${ask.sheet.model} specs will move to the book you pick.`
                : ""
        }
        books={books}
        currentId={book?.id ?? null}
        cancelLabel={ask?.kind === "file" ? "Skip This File" : "Cancel"}
        onPick={(b) => void pickForAsk(b)}
        onCreate={(t) => void createForAsk(t)}
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
          <DialogTitle>Rename This Book</DialogTitle>
          <DialogDescription>Files already in the book keep their names; new ones use the new title.</DialogDescription>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (book && renaming && renaming.trim().length >= 2) rename.mutate({ id: book.id, title: renaming.trim() });
            }}
          >
            <Input value={renaming ?? ""} onChange={(e) => setRenaming(e.target.value)} aria-label="Book title" />
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

/** A book on the map: spine, title, and the machine photo when the spec sheet has one. */
function BookCover({
  book,
  cover,
  counts,
  active,
  onOpen,
}: {
  book: LibraryBook;
  cover: SavedSpecSheet | null;
  counts: Record<LibrarySection, number>;
  active: boolean;
  onOpen: () => void;
}) {
  const image = useQuery({
    queryKey: ["spec-image", cover?.id, cover?.updatedAt],
    queryFn: () => getSpecImage({ data: { id: cover!.id } }),
    enabled: !!cover,
    staleTime: 5 * 60_000,
  });
  const photo = image.data?.image ?? null;
  return (
    <li className="relative" data-testid="book" data-book={book.title}>
      {/* branch from The Library */}
      <span className="absolute -top-4 left-1/2 h-4 w-px bg-border" aria-hidden="true" />
      <span className="absolute -top-4 -right-2 -left-2 h-px bg-border" aria-hidden="true" />
      <div
        className={cn(
          "flex h-full overflow-hidden rounded-r-xl rounded-l-sm border bg-card shadow-sm transition-shadow hover:shadow-md",
          active ? "border-primary ring-2 ring-primary/30" : "border-border",
        )}
      >
        <span className="w-2.5 shrink-0 bg-ink" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="grid aspect-[4/3] place-items-center border-b border-border bg-white">
            {photo ? (
              <ZoomableImage src={photo} alt={book.title} label={book.title} className="h-full" imgClassName="mx-auto h-full max-h-40 w-full object-contain p-2" testId="book-photo" />
            ) : (
              <BookText className="size-9 text-copper/50" aria-hidden="true" />
            )}
          </div>
          <button type="button" onClick={onOpen} aria-expanded={active} className="flex flex-1 flex-col gap-1 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" data-testid="book-open">
            <span className="font-display text-base leading-tight font-medium break-words">{book.title}</span>
            <span className="text-xs text-muted-foreground">
              {counts.spec} spec · {counts.manuals} manual{counts.manuals === 1 ? "" : "s"} · {counts.parts} parts
            </span>
          </button>
        </div>
      </div>
    </li>
  );
}
