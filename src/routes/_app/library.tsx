import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, ChevronDown, ChevronRight, FileUp, Loader2, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
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
  renameLibraryFile,
  setLibraryFileType,
  setManualCopy,
  type LibraryBook,
  type LibraryFile,
} from "@/lib/ops/library-files";
import { chipForDoc, copiedManuals, docVariation, familyOf, fileUrl, isMainChip, mainChipFor, removedCopies, variationsOf, fileError, likelyBooks, manualTypeFromName, matchBook, modelLabel, nameKey, SHELF, shortDocName, type LibrarySection, type ManualType } from "@/lib/ops/library-file-rules";
import { listSpecReadStatus, resolveSpecHandEntry, runSpecReads } from "@/lib/ops/spec-read-api";
import { TILE_LABEL, bookSpecStatus, handEntryForRow, tiedSheetId, type TileStatus } from "@/lib/ops/spec-read";
import { pdfImages } from "@/lib/pdf-text";
import { needsWater } from "@/lib/ops/spec-defaults";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AddTarget, BookPicker, DocRow, DROP_RULES, ManualTypePicker, StoreOnceDialog, originOf, uploadLibraryFile, type StoreOnceChoice } from "@/components/desk/library-files";
import { LibraryAdmin } from "@/components/desk/library-admin";
import type { StoreOnceOffer } from "@/lib/ops/library-files";
import { ZoomableImage } from "@/components/desk/image-lightbox";
import { MpnPanel, OfficialTag } from "@/components/desk/mpn-panel";
import { LegacyPanel } from "@/components/desk/legacy-panel";
import { FilterChip } from "@/components/desk/desk-charts";
import { ListToolbar, ToolbarNote, ToolbarSearch } from "@/components/desk/list-toolbar";
import { splitLegacy } from "@/lib/ops/legacy-rules";
import { EquipmentCodesImport } from "@/components/desk/equipment-codes-import";
import { TrainingSection } from "@/components/desk/training-section";
import { SpecSheetView } from "@/components/desk/spec-sheet";
import { SpecImport } from "@/components/desk/spec-import";
import { TroubleshootPanel } from "@/components/desk/troubleshoot-panel";
import { cn } from "@/lib/utils";
import { notLoadedText } from "@/lib/ops/load-problem";

type Tab = "library" | "training" | "admin";
type Search = { open?: number; book?: number; tab?: Tab };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const tabOf = (v: unknown): Tab | undefined => (v === "training" || v === "admin" ? v : undefined);

export const Route = createFileRoute("/_app/library")({
  validateSearch: (s: Record<string, unknown>): Search => ({ open: num(s.open), book: num(s.book), tab: tabOf(s.tab) }),
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
  const { open, book: bookParam, tab: tabParam } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["spec-library"], queryFn: () => listSpecSheets() });
  const lib = useQuery({ queryKey: ["library-files"], queryFn: () => listLibraryFiles() });
  const specStatus = useQuery({ queryKey: ["spec-read-status"], queryFn: () => listSpecReadStatus() });
  const sheets = data.data?.sheets ?? [];
  const books = lib.data?.books ?? [];
  const files = lib.data?.files ?? [];
  const hidden = lib.data?.hidden ?? [];
  const sheetBook = new Map((lib.data?.sheetBooks ?? []).map((r) => [r.sheetId, r.bookId]));
  const canEdit = !!lib.data?.canEdit || !!data.data?.canEdit;
  const isAdmin = !!lib.data?.isAdmin;
  const tab: Tab = tabParam === "admin" && !isAdmin ? "library" : (tabParam ?? "library");
  const selected = open != null ? sheets.find((s) => s.id === open) ?? null : null;
  const bookId = bookParam ?? (selected ? sheetBook.get(selected.id) ?? null : null);
  const book = bookId != null ? books.find((b) => b.id === bookId) ?? null : null;

  const [mode, setMode] = useState<"browse" | "import" | "edit">("browse");
  const [importFile, setImportFile] = useState<{ file: File | null; bookId: number } | null>(null);
  const [handSeed, setHandSeed] = useState<{ manufacturer: string; model: string } | null>(null);
  // The Spec Review file whose specs are being typed by hand. Saving closes its row.
  const [handFile, setHandFile] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<{ section: LibrarySection; text: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [ask, setAsk] = useState<Ask | null>(null);
  // The document's first word names a model with no chip yet: confirm before a chip is made.
  const [askNew, setAskNew] = useState<{ fileName: string; maker: string; word: string; open: LibraryBook | null; resolve: (r: "create" | "open" | "pick" | null) => void } | null>(null);
  const [askType, setAskType] = useState<{ fileName: string; hint: string; resolve: (t: { type: ManualType; name?: string } | null) => void } | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  const [fileRename, setFileRename] = useState<{ file: LibraryFile; name: string } | null>(null);
  const [typing, setTyping] = useState<LibraryFile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<LibraryFile | null>(null);
  const [renaming, setRenaming] = useState<{ manufacturer: string; model: string } | null>(null);
  const [openMaker, setOpenMaker] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [adding, setAdding] = useState(false);
  const [readOnAdd, setReadOnAdd] = useState(true);
  const [codesOpen, setCodesOpen] = useState(false);
  const [storeOnce, setStoreOnce] = useState<{ offer: StoreOnceOffer; fileName: string; resolve: (choice: StoreOnceChoice) => void } | null>(null);
  const rereadInput = useRef<HTMLInputElement>(null);
  const [rereading, setRereading] = useState(false);
  const [found, setFound] = useState<{ image: string | null; dimsImage: string | null; note: string | null; file: string } | null>(null);
  const bookPanel = useRef<HTMLDivElement>(null);

  const go = (s: Search) => void navigate({ to: "/library", search: { ...s, tab: s.tab ?? (tab === "library" ? undefined : tab) } });
  const reload = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["library-files"] }),
      qc.invalidateQueries({ queryKey: ["spec-library"] }),
      qc.invalidateQueries({ queryKey: ["spec-read-status"] }),
      qc.invalidateQueries({ queryKey: ["spec-reads"] }),
    ]);
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
    const queuedReads: number[] = [];
    let known = books;
    let last: LibraryBook | null = null;
    for (const file of list) {
      const problem = fileError(file.name, file.size);
      if (problem) {
        errors.push(problem);
        continue;
      }
      // A manual is named by its type. An obvious file name decides; otherwise the list is shown and nothing is filed until one is picked.
      let type: ManualType | null = null;
      let customName: string | undefined;
      if (section === "manuals") {
        type = manualTypeFromName(file.name);
        if (!type) {
          const hint = into ? `${modelLabel(into.title, into.manufacturer)} - ` : "";
          const picked = await new Promise<{ type: ManualType; name?: string } | null>((resolve) => setAskType({ fileName: file.name, hint, resolve }));
          type = picked?.type ?? null;
          customName = picked?.name;
        }
        setAskType(null);
        if (!type) {
          errors.push(`${file.name} was skipped — no manual type chosen.`);
          continue;
        }
      }
      const shelf = section;
      // The first word of the document is the model variation. Same name → that chip, whichever model is open.
      // A different name → a new chip (confirmed first), never merged into a nearby model.
      const doc = docVariation(file.name, known.map((b) => b.manufacturer));
      const maker = doc?.maker ?? into?.manufacturer ?? null;
      let target: LibraryBook | null = chipForDoc(file.name, known, maker);
      if (!target && doc?.word && maker) {
        const answer = await new Promise<"create" | "open" | "pick" | null>((resolve) => setAskNew({ fileName: file.name, maker, word: doc.word, open: into ?? null, resolve }));
        setAskNew(null);
        if (answer === null) {
          errors.push(`${file.name} was skipped — no model chosen.`);
          continue;
        }
        if (answer === "create") {
          try {
            target = await createLibraryBook({ data: { manufacturer: maker, model: doc.word } });
            if (!known.some((b) => b.id === target!.id)) known = [...known, target];
          } catch (e) {
            errors.push(`${file.name}: ${e instanceof Error ? e.message : "the model could not be added"}`);
            continue;
          }
        } else if (answer === "open") target = into ?? null;
      } else if (!target) target = into ?? matchBook(file.name, known);
      if (!target) {
        target = await new Promise<LibraryBook | null>((resolve) => setAsk({ kind: "file", fileName: file.name, section: shelf, resolve }));
        setAsk(null);
        if (!target) {
          errors.push(`${file.name} was skipped — no book chosen.`);
          continue;
        }
        if (!known.some((b) => b.id === target!.id)) known = [...known, target];
      }
      try {
        const filed = await uploadLibraryFile(
          file,
          section,
          target.id,
          (pct) => setBusy({ section, text: `Adding ${file.name}… ${pct}%` }),
          type ?? undefined,
          customName,
          (offer) => new Promise((resolve) => setStoreOnce({ offer, fileName: file.name, resolve })),
        );
        setStoreOnce(null);
        if (!filed) {
          errors.push(`${file.name} was skipped.`);
          continue;
        }
        if (section === "spec" && readOnAdd && isAdmin && filed.fileId) queuedReads.push(filed.fileId);
        if (filed.storedOnce) {
          toast.success(`${file.name} was not uploaded. Stored once on ${filed.bookTitle} as ${filed.name}.`);
          const landed = known.find((b) => b.id === filed.bookId) ?? {
            id: filed.bookId,
            title: filed.bookTitle,
            manufacturer: filed.manufacturer,
            mpn: null,
            noOfficialFile: false,
            legacy: false,
            legacySource: null,
            legacyNote: null,
            confirmLegacy: false,
          };
          if (!known.some((b) => b.id === landed.id)) known = [...known, landed];
          last = landed;
        } else {
          toast.success(`Filed in ${target.title} → ${SHELF[filed.section].title} as ${filed.name}`);
          last = target;
        }
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : "could not be added"}`);
      }
    }
    setBusy(null);
    setProblems(errors);
    if (errors.length) toast.error(errors.length === 1 ? errors[0]! : `${errors.length} files were not added — see the list at the top`);
    if (queuedReads.length) {
      try {
        const res = await runSpecReads({ data: { fileIds: queuedReads, limit: 15 } });
        toast.success(res.review ? `${res.review} spec sheet${res.review === 1 ? "" : "s"} ready to review in Library Admin.` : "Spec sheet queued.");
      } catch (e) {
        fail(e, "The file was saved, but the specs could not be read.");
      }
    }
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
      const res = await runSpecReads({ data: { fileIds: [file.id], limit: 1 } });
      toast.success(res.review ? `${file.name} is in Spec Review.` : res.unreadable ? "That sheet could not be read." : `${file.name} is queued.`);
      await qc.invalidateQueries({ queryKey: ["spec-reads"] });
      await qc.invalidateQueries({ queryKey: ["spec-read-status"] });
      if (isAdmin) void navigate({ to: "/library", search: { tab: "admin", book: file.bookId ?? undefined } });
    } catch (e) {
      fail(e, "Couldn't read that file.");
    }
  }

  /** The model already has a sheet: edit it, so a blank form can't replace it. */
  function editTiedSheet(bookId: number): boolean {
    const sheetId = tiedSheetId(lib.data?.sheetBooks ?? [], bookId);
    if (sheetId == null) return false;
    setQ("");
    setOpenMaker(null);
    setMode("edit");
    void navigate({ to: "/library", search: { book: bookId, open: sheetId } });
    return true;
  }

  /** A scanned or unread sheet: open the stored PDF in Spec Import, the way a hand entry used to. */
  async function enterSpecsByHand(row: { status: string; fileId: number; bookId: number | null }) {
    const hand = handEntryForRow(row);
    if (!hand) return;
    setHandFile(hand.fileId);
    if (editTiedSheet(hand.bookId)) return;
    const file = files.find((f) => f.id === hand.fileId);
    if (!file) {
      toast.error("That sheet is not in the library.");
      return;
    }
    try {
      const res = await fetch(fileUrl(originOf(), file.token));
      if (!res.ok) throw new Error("Couldn't open that file.");
      setHandSeed(null);
      setImportFile({ file: new File([await res.blob()], file.name, { type: file.mime || "application/pdf" }), bookId: hand.bookId });
      setMode("import");
      void navigate({ to: "/library", search: { book: hand.bookId } });
    } catch (e) {
      fail(e, "Couldn't open that file.");
    }
  }

  /** A model with no sheet has no PDF. Open a blank form tied to that book. */
  function enterSpecsForModel(book: { id: number; title: string }) {
    setHandFile(null);
    if (editTiedSheet(book.id)) return;
    const full = books.find((b) => b.id === book.id);
    const manufacturer = full?.manufacturer ?? "";
    setHandSeed({ manufacturer, model: modelLabel(book.title, manufacturer) });
    setImportFile({ file: null, bookId: book.id });
    setMode("import");
    void navigate({ to: "/library", search: { book: book.id } });
  }

  /** After the AI read is saved: the sheet joins its book and the original PDF is kept there. */
  async function afterImport(id: number, pdf: File | null) {
    const from = importFile;
    const hand = handFile;
    setOpenMaker(null);
    setMode("browse");
    setImportFile(null);
    setHandSeed(null);
    setHandFile(null);
    try {
      if (from) await moveSpecSheet({ data: { sheetId: id, bookId: from.bookId } });
      if (from && hand != null) await resolveSpecHandEntry({ data: { fileId: hand } });
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

  /** After Edit is saved. Opened from a Spec Review row, it closes that row too. */
  async function afterEdit(id: number, bookId: number) {
    const hand = handFile;
    setMode("browse");
    setHandFile(null);
    try {
      if (hand != null) await resolveSpecHandEntry({ data: { fileId: hand } });
    } catch (e) {
      fail(e, "Saved, but the Spec Review row is still open.");
    }
    void reload();
    go({ book: bookId, open: id });
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
  const retype = useMutation({
    mutationFn: (v: { id: number; docType: ManualType }) => setLibraryFileType({ data: v }),
    onSuccess: (r) => {
      toast.success(`Now ${r.name}`);
      setTyping(null);
      void reload();
    },
    onError: (e) => fail(e, "Could not set the type"),
  });
  const copy = useMutation({
    mutationFn: (v: { fileId: number; bookId: number; show: boolean }) => setManualCopy({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.show ? "Put back on this variation" : "Removed from this variation only. It is still on the main chip and the other variations.");
      void reload();
    },
    onError: (e) => fail(e, "Could not change that copy"),
  });
  const renameFile = useMutation({
    mutationFn: (v: { id: number; name: string }) => renameLibraryFile({ data: v }),
    onSuccess: (r) => {
      toast.success(`Renamed to ${r.name}`);
      setFileRename(null);
      void reload();
    },
    onError: (e) => fail(e, "Could not rename the file"),
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
  const shownBooks = books.filter((b) => b.title.toLowerCase().includes(needle) || b.manufacturer.toLowerCase().includes(needle));
  const makers = [...new Set(shownBooks.map((b) => b.manufacturer))].sort((x, y) => x.localeCompare(y, "en", { sensitivity: "base" }));
  const loading = data.isLoading || lib.isLoading;
  // One maker open at a time: the one clicked, else the one holding the open model, else the only search hit.
  // Nothing is open until a maker is picked (or a search leaves just one).
  const wanted = openMaker ?? book?.manufacturer ?? (needle && makers.length === 1 ? makers[0]! : null);
  const activeMaker = wanted && makers.includes(wanted) ? wanted : null;
  const models = shownBooks.filter((b) => b.manufacturer === activeMaker);
  // Current models stay in the main row (family, then variation). Legacy models sit in their own row under the maker.
  const { current: currentModels, legacy: legacyModels } = splitLegacy(models);
  const current = book && book.manufacturer === activeMaker && models.some((m) => m.id === book.id) ? book : currentModels[0] ?? models[0] ?? null;
  // Maker → family → variation. A word family is the model's first word (Axiom, G9, ITCB). A letter-digit series such as CBS-1252 sits under CBS-125.
  const familyKey = (b: LibraryBook) => nameKey(familyOf(b.title, b.manufacturer));
  const families = [...new Map(currentModels.map((m) => [familyKey(m), familyOf(m.title, m.manufacturer)])).entries()]
    // The main chip (named like the parent) leads its row.
    .map(([key, name]) => ({ key, name, books: currentModels.filter((m) => familyKey(m) === key).sort((x, y) => Number(isMainChip(y, books)) - Number(isMainChip(x, books))) }))
    .sort((x, y) => x.name.localeCompare(y.name, "en", { sensitivity: "base", numeric: true }));
  const family = current && !current.legacy ? families.find((f) => f.key === familyKey(current)) ?? null : null;
  const inside = current ? inBook(current.id) : null;
  // Manuals on the parent's main chip are copied onto every variation; a variation can drop its own copy.
  const mainChip = current ? mainChipFor(current, books) : null;
  const copies = current ? copiedManuals(current, books, files, hidden) : [];
  const dropped = current ? removedCopies(current, books, files, hidden) : [];
  const copyTargets = current && isMainChip(current, books) ? variationsOf(current, books) : [];
  const mainName = mainChip ? modelLabel(mainChip.title, mainChip.manufacturer) : "";
  const statusFor = (bookId: number): TileStatus | null =>
    bookSpecStatus(
      files.filter((f) => f.bookId === bookId && f.section === "spec").length,
      (specStatus.data ?? []).filter((r) => r.bookId === bookId).map((r) => r.status),
    );
  const setTab = (next: Tab) => void navigate({ to: "/library", search: { tab: next === "library" ? undefined : next, book: bookParam, open } });
  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">The Library</h1>
          <div className="mt-2 flex gap-1" role="tablist" aria-label="Library sections">
            <Button type="button" role="tab" aria-selected={tab === "library"} variant={tab === "library" ? "secondary" : "ghost"} onClick={() => setTab("library")} data-testid="library-tab">Library</Button>
            <Button type="button" role="tab" aria-selected={tab === "training"} variant={tab === "training" ? "secondary" : "ghost"} onClick={() => setTab("training")} data-testid="training-tab">Training</Button>
            {isAdmin ? (
              <Button type="button" role="tab" aria-selected={tab === "admin"} variant={tab === "admin" ? "secondary" : "ghost"} onClick={() => setTab("admin")} data-testid="admin-tab">Admin</Button>
            ) : null}
          </div>
        </div>
        {canEdit && tab === "library" ? (
          <Button type="button" className="sm:ml-auto" onClick={() => setAdding(true)} data-testid="library-add">
            <Plus className="size-4" /> Add Files
          </Button>
        ) : null}
      </header>

      {tab === "training" ? <TrainingSection /> : null}
      {tab === "admin" && isAdmin ? (
        <LibraryAdmin
          books={books}
          files={files}
          onChanged={() => void reload()}
          onMoveFile={(file) => setAsk({ kind: "move-file", file })}
          onEnterByHand={(row) => void enterSpecsByHand(row)}
          onEnterForModel={enterSpecsForModel}
        />
      ) : null}

      {tab !== "library" ? null : (
      <>
      <ListToolbar data-testid="library-toolbar">
        <ToolbarSearch
          value={q}
          onChange={(v) => {
            setQ(v);
            setOpenMaker(null);
          }}
          placeholder="Search maker or model…"
          label="Search maker or model"
          testId="book-search"
        />
        <ToolbarNote data-testid="library-count">
          {shownBooks.length} model{shownBooks.length === 1 ? "" : "s"}
        </ToolbarNote>
      </ListToolbar>

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
            key={importFile?.file ? `file-${importFile.bookId}-${importFile.file.name}` : importFile ? `hand-${importFile.bookId}` : "import"}
            aiReady={!!data.data?.aiReady}
            initialFile={importFile?.file ?? null}
            seed={!importFile?.file ? handSeed : null}
            bookId={importFile?.bookId ?? null}
            onCancel={() => {
              setMode("browse");
              setImportFile(null);
              setHandSeed(null);
              setHandFile(null);
            }}
            onSaved={(id, pdf) => void afterImport(id, pdf)}
          />
        </section>
      ) : null}

      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading The Library…</p>
      ) : data.isError || lib.isError ? (
        <p className="mt-5 text-sm text-muted-foreground">{notLoadedText(data.isError ? data : lib, "Library")}</p>
      ) : makers.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground" data-testid="books-empty">
          {!books.length
            ? "Nothing here yet. Use Add Files to add the first spec sheet, manual or parts diagram."
            : "Nothing matches that search."}
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="radiogroup" aria-label="Manufacturer" data-testid="library-makers">
            {makers.map((maker) => {
              const mine = shownBooks.filter((b) => b.manufacturer === maker);
              const count = mine.length;
              const on = maker === activeMaker;
              const sheetCount = mine.reduce((n, b) => n + files.filter((f) => f.bookId === b.id && f.section === "spec").length, 0);
              const readCount = mine.filter((b) => statusFor(b.id) === "read").length;
              const reviewCount = mine.filter((b) => statusFor(b.id) === "needs_review").length;
              return (
                <button
                  key={maker}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={cn(
                    "flex min-h-18 flex-col justify-center rounded-xl border px-4 py-3 text-left transition-colors",
                    on ? "border-ink bg-ink text-cream" : "border-border bg-card hover:border-primary/50",
                  )}
                  data-testid="maker"
                  data-maker={maker}
                  onClick={() => {
                    setMode("browse");
                    setOpenMaker(on ? "" : maker);
                    go(on ? {} : { book: (shownBooks.find((b) => b.manufacturer === maker && !b.legacy) ?? shownBooks.find((b) => b.manufacturer === maker))!.id });
                  }}
                >
                  <span className="font-display text-lg leading-tight font-medium break-words">{maker}</span>
                  <span className="mt-1 flex flex-wrap gap-1 text-[10px] tracking-wide uppercase opacity-80" data-testid="maker-spec-counts">
                    <span className="rounded-full border border-current/30 px-1.5 py-0.5">{count} models</span>
                    <span className="rounded-full border border-current/30 px-1.5 py-0.5">{sheetCount} sheets</span>
                    <span className="rounded-full border border-current/30 px-1.5 py-0.5">{readCount} read</span>
                    <span className="rounded-full border border-current/30 px-1.5 py-0.5">{reviewCount} review</span>
                  </span>
                </button>
              );
            })}
          </div>

          {current && inside ? (
            <section ref={bookPanel} className="mt-4 scroll-mt-24 rounded-xl border border-border bg-card px-4 pb-4" aria-label={current.title} data-testid="open-book">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground hover:underline" onClick={() => { setOpenMaker(""); go({}); }}>
                  The Library
                </button>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-display text-xl font-medium" data-testid="open-family-title">
                  {activeMaker}
                  {family ? ` · ${family.name}` : current.legacy ? " · Legacy" : ""}
                </h2>
                <span className="sr-only" data-testid="open-book-title">{current.title}</span>
                {canEdit ? (
                  <Button type="button" size="sm" variant={manage ? "secondary" : "ghost"} className="ml-auto" aria-pressed={manage} onClick={() => setManage(!manage)} data-testid="manage">
                    <Settings2 className="size-4" /> {manage ? "Done" : "Manage"}
                  </Button>
                ) : null}
              </div>
              {families.length ? (
                <>
                  <p className="mt-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Family</p>
                  <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={`${activeMaker} families`} data-testid="family-chips">
                    {families.map((f) => (
                      <FilterChip
                        key={f.key}
                        role="radio"
                        aria-pressed={undefined}
                        aria-checked={f.key === family?.key}
                        selected={f.key === family?.key}
                        data-testid="family-chip"
                        data-family={f.name}
                        onClick={() => {
                          setMode("browse");
                          go({ book: f.books[0]!.id });
                        }}
                      >
                        {f.name}
                        {f.books.length > 1 ? <span className="ml-1.5 text-xs opacity-60">{f.books.length}</span> : null}
                      </FilterChip>
                    ))}
                  </div>
                </>
              ) : null}
              {family ? (
                <>
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{family.name} Variations</p>
                  <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={`${family.name} variations`} data-testid="model-chips">
                    {family.books.map((m) => (
                      <FilterChip
                        key={m.id}
                        role="radio"
                        aria-pressed={undefined}
                        aria-checked={m.id === current.id}
                        selected={m.id === current.id}
                        data-testid="model-chip"
                        data-confirm-legacy={m.confirmLegacy ? "true" : undefined}
                        onClick={() => {
                          setMode("browse");
                          setOpenMaker(m.manufacturer);
                          go({ book: m.id });
                        }}
                      >
                        {modelLabel(m.title, m.manufacturer)}
                        {statusFor(m.id) ? <span className="ml-1.5 text-[10px] font-semibold tracking-wide uppercase opacity-80" data-testid="model-spec-status">{TILE_LABEL[statusFor(m.id)!]}</span> : null}
                      </FilterChip>
                    ))}
                  </div>
                </>
              ) : null}
              {/* Its own row, named for what it holds, so it is never mistaken for a model family (Eversys makes a machine called Legacy). */}
              {legacyModels.length ? (
                <>
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase" data-testid="legacy-heading" title="Discontinued or obsolete models">
                    Legacy
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label={`${activeMaker} Legacy models`} data-testid="legacy-chips">
                    {legacyModels.map((m) => (
                      <FilterChip
                        key={m.id}
                        role="radio"
                        aria-pressed={undefined}
                        aria-checked={m.id === current.id}
                        selected={m.id === current.id}
                        data-testid="legacy-chip"
                        onClick={() => {
                          setMode("browse");
                          setOpenMaker(m.manufacturer);
                          go({ book: m.id });
                        }}
                      >
                        {modelLabel(m.title, m.manufacturer)}
                      </FilterChip>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="mb-3" />
                    {manage ? <LegacyPanel book={current} canEdit={canEdit} manage={manage} onChanged={() => void reload()} /> : null}
                    {manage ? <MpnPanel book={current} files={inside.files} canEdit={canEdit} onChanged={() => void reload()} /> : null}
                    <div className="flex flex-col gap-4 sm:flex-row">
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
                              {inside.sheets.length > 1 ? `${s.model}: ` : ""}
                              {s.configs.some((c) => needsWater(s, c.requirements)) ? "Power, Water, Plug, Size" : "Power, Plug, Size"}
                            </button>
                            {selected?.id === s.id ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                            {manage ? (
                              <Button type="button" size="sm" variant="ghost" className="size-11 shrink-0 p-0" title="Move to another model" aria-label="Move these specs to another model" onClick={() => setAsk({ kind: "move-sheet", sheet: s })}>
                                <ArrowRightLeft className="size-4" />
                              </Button>
                            ) : null}
                          </li>
                        ))}
                        {TYPES.flatMap((t) => [...inside.files, ...copies].filter((f) => f.section === t.section)).map((f) => (
                          <DocRow
                            key={f.id}
                            file={f}
                            // A parts file shows the name it was dropped with, extension and all.
                            label={f.section === "parts" ? f.name : shortDocName(f.name, f.bookId === current.id ? current.title : mainChip?.title ?? current.title)}
                            copyFrom={f.bookId === current.id ? undefined : mainName}
                            onRemoveCopy={canEdit ? (file) => copy.mutate({ fileId: file.id, bookId: current.id, show: false }) : undefined}
                            manage={manage}
                            onMove={(file) => setAsk({ kind: "move-file", file })}
                            onDelete={setFileToDelete}
                            onType={setTyping}
                            onRename={(file) => setFileRename({ file, name: file.name.replace(/\.[A-Za-z0-9]+$/, "") })}
                            extra={
                              <>
                                {f.section === "spec" && isAdmin && f.mime === "application/pdf" ? (
                                  <Button type="button" size="sm" variant="outline" onClick={() => void readSpecsFrom(f)} data-testid="read-specs">
                                    <FileUp className="size-4" /> Read Specs
                                  </Button>
                                ) : null}
                                <OfficialTag file={f} book={current} canEdit={canEdit} manage={manage} onChanged={() => void reload()} />
                              </>
                            }
                          />
                        ))}
                        {!inside.files.length && !inside.sheets.length && !copies.length ? <li className="py-3 text-sm text-muted-foreground">No documents yet.</li> : null}
                        {manage && dropped.length
                          ? dropped.map((f) => (
                              <li key={`gone-${f.id}`} className="flex min-h-12 items-center gap-2 py-1 text-muted-foreground" data-testid="library-copy-removed">
                                <span className="w-16 shrink-0 text-[11px] font-semibold tracking-[0.06em] uppercase">Off</span>
                                <span className="min-w-0 flex-1 text-sm break-words">
                                  {f.section === "parts" ? f.name : shortDocName(f.name, mainChip?.title ?? "")} <span className="text-xs">from {mainName}, removed from this variation</span>
                                </span>
                                <Button type="button" size="sm" variant="outline" disabled={copy.isPending} onClick={() => copy.mutate({ fileId: f.id, bookId: current.id, show: true })} data-testid="library-copy-restore">
                                  Put Back
                                </Button>
                              </li>
                            ))
                          : null}
                        <li className="flex min-h-12 items-center gap-2 py-1" data-testid="shelf-troubleshoot">
                          <span className="w-16 shrink-0 text-[11px] font-semibold tracking-[0.1em] text-copper uppercase">Fix</span>
                          <button
                            type="button"
                            aria-expanded={fixOpen}
                            className="min-w-0 flex-1 py-2 text-left text-sm font-semibold break-words hover:underline"
                            onClick={() => setFixOpen(!fixOpen)}
                            data-testid="troubleshoot-open"
                          >
                            Troubleshoot <span className="font-normal text-muted-foreground" title="Only from files stored on this model">· from this model's files</span>
                          </button>
                          {fixOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                        </li>
                      </ul>
                    </div>

                    {copyTargets.length ? (
                      <p className="mt-2 text-xs text-muted-foreground" data-testid="main-chip-note" title={`A manual or parts file added on the main chip is copied to every ${family?.name} variation (${copyTargets.length}). Spec sheets stay on this chip.`}>
                        Main chip. Manuals and parts copy to {copyTargets.length} {family?.name} variation{copyTargets.length === 1 ? "" : "s"}.
                      </p>
                    ) : null}
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

                    {fixOpen ? <TroubleshootPanel key={current.id} bookId={current.id} model={modelLabel(current.title, current.manufacturer)} /> : null}

                    {mode === "edit" && selected ? (
                      <div className="mt-4">
                        <SpecImport key={`edit-${selected.id}`} editing={selected} aiReady={!!data.data?.aiReady} onCancel={() => { setMode("browse"); setHandFile(null); }} onSaved={(id) => void afterEdit(id, current.id)} />
                      </div>
                    ) : selected && mode === "browse" && sheetBook.get(selected.id) === current.id ? (
                      <div className="mt-4" data-testid="book-spec-sheet">
                        <SpecSheetView
                          sheet={selected}
                          canEdit={canEdit}
                          onEdit={() => {
                            setHandFile(null);
                            setMode("edit");
                          }}
                          onDelete={() => setConfirmDelete(true)}
                          onRefresh={canEdit ? () => refresh.mutate(selected.id) : undefined}
                          refreshing={refresh.isPending}
                          onReread={canEdit ? () => rereadInput.current?.click() : undefined}
                        />
                      </div>
                    ) : null}
            </section>
          ) : null}
        </>
      )}
      </>
      )}

      <StoreOnceDialog
        offer={storeOnce?.offer ?? null}
        fileName={storeOnce?.fileName ?? ""}
        busy={!!busy}
        onChoose={(choice) => {
          storeOnce?.resolve(choice);
          setStoreOnce(null);
        }}
      />

      <Dialog open={!!askNew} onOpenChange={(o) => !o && askNew?.resolve(null)}>
        <DialogContent data-testid="new-chip-dialog">
          <DialogTitle>
            New Model: {askNew?.maker} · {askNew?.word}
          </DialogTitle>
          <DialogDescription>
            {askNew?.fileName} starts with {askNew?.word}, and {askNew?.maker} has no model with that name. Add it as its own chip, or file this under a model that is already there.
          </DialogDescription>
          <div className="mt-4 grid gap-2">
            <Button type="button" className="h-11 justify-start" onClick={() => askNew?.resolve("create")} data-testid="new-chip-create">
              <Plus className="size-4" /> Add {askNew?.word} As A New Chip
            </Button>
            {askNew?.open ? (
              <Button type="button" variant="outline" className="h-11 justify-start" onClick={() => askNew.resolve("open")} data-testid="new-chip-open">
                File Under {modelLabel(askNew.open.title, askNew.open.manufacturer)} (Open Now)
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="h-11 justify-start" onClick={() => askNew?.resolve("pick")} data-testid="new-chip-pick">
              Pick Another Model
            </Button>
            <Button type="button" variant="ghost" className="w-fit" onClick={() => askNew?.resolve(null)}>
              Skip This File
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adding && !ask && !askType && !askNew && !storeOnce} onOpenChange={(o) => !o && !busy && setAdding(false)}>
        <DialogContent data-testid="add-dialog">
          <DialogTitle>Add Files</DialogTitle>
          <DialogDescription title={`Drop a file on its type, or click to choose. The first word of the file name is the model. ${DROP_RULES}`}>
            Drop a file on its type. The file name picks the model.
          </DialogDescription>
          {isAdmin ? (
            <label className="mt-3 flex items-center gap-2 text-sm" data-testid="read-specs-from-sheet">
              <input type="checkbox" checked={readOnAdd} onChange={(e) => setReadOnAdd(e.target.checked)} />
              Read specs from this sheet
            </label>
          ) : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {TYPES.map((t) => (
              <AddTarget key={t.section} id={t.id} label={t.add} large busy={busy?.section === t.section ? busy.text : null} disabled={!!busy} onFiles={(list) => void addFiles(t.section, list)} />
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-2 w-fit" onClick={() => { setAdding(false); setCodesOpen(true); }} data-testid="codes-import-open">
            <FileUp className="size-4" /> Import Equipment Codes
          </Button>
        </DialogContent>
      </Dialog>
      <EquipmentCodesImport open={codesOpen} onOpenChange={setCodesOpen} onSaved={() => void reload()} />

      <ManualTypePicker open={!!askType} fileName={askType?.fileName ?? ""} nameHint={askType?.hint ?? ""} onPick={(t, name) => askType?.resolve({ type: t, name })} onCancel={() => askType?.resolve(null)} />
      <Dialog open={!!fileRename} onOpenChange={(o) => !o && setFileRename(null)}>
        <DialogContent data-testid="file-rename-dialog">
          <DialogTitle>Rename This File</DialogTitle>
          <DialogDescription>Only the name changes. The file itself and links already sent stay the same.</DialogDescription>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (fileRename) renameFile.mutate({ id: fileRename.file.id, name: fileRename.name });
            }}
          >
            <Input value={fileRename?.name ?? ""} onChange={(e) => fileRename && setFileRename({ ...fileRename, name: e.target.value })} aria-label="File name" autoFocus data-testid="file-rename-input" />
            <Button type="submit" disabled={renameFile.isPending} data-testid="file-rename-save">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <ManualTypePicker
        open={!!typing}
        fileName={typing?.name ?? ""}
        current={typing?.docType}
        busy={retype.isPending}
        cancelLabel="Cancel"
        onPick={(t) => typing && retype.mutate({ id: typing.id, docType: t })}
        onCancel={() => setTyping(null)}
      />
      <BookPicker
        open={!!ask}
        heading={ask?.kind === "file" ? "Which Model Is This For?" : "Move To Which Model?"}
        detail={
          ask?.kind === "file"
            ? `${ask.fileName} doesn't name one model. Pick the model, or add a new one.`
            : ask?.kind === "move-file"
              ? `${ask.file.name} will be renamed for the model you pick.`
              : ask?.kind === "move-sheet"
                ? `${ask.sheet.manufacturer} ${ask.sheet.model} specs will move to the model you pick.`
                : ""
        }
        books={books}
        currentId={book?.id ?? null}
        likelyIds={ask?.kind === "file" ? likelyBooks(ask.fileName, books).map((b) => b.id) : []}
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
          <DialogDescription>
            {fileToDelete?.name} will be removed from The Library. Links already sent for it will stop working.
            {fileToDelete && fileToDelete.section !== "spec" && current && fileToDelete.bookId === current.id && copyTargets.length
              ? ` This is the main chip's file: it will also disappear from all ${copyTargets.length} ${family?.name} variations. To take it off one variation only, open that variation and use Remove Here.`
              : ""}
          </DialogDescription>
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
