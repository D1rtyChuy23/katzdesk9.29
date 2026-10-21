import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AdminSection, resolvedOn } from "@/components/desk/admin-section";
import { SpecReviewPanel } from "@/components/desk/spec-review-panel";
import { cleanupLibraryDuplicates, deleteLibraryFile, setConfirmLegacy, storeLibraryFileOnce, type LibraryBook, type LibraryCleanupReport, type LibraryFile } from "@/lib/ops/library-files";
import { importLibraryBatch, libraryImportLogCsv, libraryImportPending, resolveImportDuplicates } from "@/lib/ops/library-import";
import { familyDuplicateGroups, isMainChip, mainChipFor, sizeText, type ShareFile } from "@/lib/ops/library-file-rules";
import { keepOneLibraryCopy, listLibraryAdminState, listSpecReads, rememberLibraryDone, runSpecReads, setLibraryAdminOpen, tieAndReadSpec } from "@/lib/ops/spec-read-api";
import { adminSummary, clipRows, orderAdminSections } from "@/lib/ops/spec-read";

const EXPECTED_NAMED = 57;
const DUPLICATE_MARKER = "Duplicate To Delete";

function bookTitle(books: LibraryBook[], id: number | null): string {
  return books.find((b) => b.id === id)?.title ?? "Unknown model";
}

type Section = {
  id: string;
  title: string;
  hint: string;
  noun: string;
  openCount: number;
  testId: string;
  body: ReactNode;
};

export function LibraryAdmin({
  books,
  files,
  onChanged,
  onMoveFile,
  onEnterByHand,
  onEnterForModel,
}: {
  books: LibraryBook[];
  files: LibraryFile[];
  onChanged: () => void;
  onMoveFile?: (file: LibraryFile) => void;
  onEnterByHand: (row: { fileId: number; bookId: number | null; status: string }) => void;
  onEnterForModel: (book: { id: number; title: string }) => void;
}) {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["library-admin-state"], queryFn: () => listLibraryAdminState() });
  const reads = useQuery({ queryKey: ["spec-reads"], queryFn: () => listSpecReads() });
  const pending = useQuery({ queryKey: ["library-import-pending"], queryFn: () => libraryImportPending() });
  const twins = useQuery({ queryKey: ["library-import-dupes"], queryFn: () => resolveImportDuplicates({ data: { apply: false } }) });
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [localOpen, setLocalOpen] = useState<Record<string, boolean>>({});
  const [report, setReport] = useState<LibraryCleanupReport | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [confirmTwins, setConfirmTwins] = useState(false);
  const prevCounts = useRef<Record<string, number>>({});

  const reload = () => {
    onChanged();
    void qc.invalidateQueries({ queryKey: ["library-admin-state"] });
    void qc.invalidateQueries({ queryKey: ["spec-reads"] });
    void qc.invalidateQueries({ queryKey: ["spec-read-status"] });
    void qc.invalidateQueries({ queryKey: ["library-import-pending"] });
    void qc.invalidateQueries({ queryKey: ["library-import-dupes"] });
    void qc.invalidateQueries({ queryKey: ["spec-outlets"] });
  };
  const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);
  const done = useMutation({
    mutationFn: (row: { section: string; itemKey: string; label: string; detail?: string }) => rememberLibraryDone({ data: row }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["library-admin-state"] }),
  });
  const setOpen = useMutation({
    mutationFn: (row: { section: string; open: boolean }) => setLibraryAdminOpen({ data: row }),
  });
  const remember = (section: string, itemKey: string, label: string) => done.mutate({ section, itemKey, label });

  const share: ShareFile[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    docName: f.originalName,
    size: f.size,
    section: f.section,
    bookId: f.bookId,
    mpn: f.mpn,
  }));
  const groups = familyDuplicateGroups(books, share);
  const named = files.filter((f) => f.name.includes(DUPLICATE_MARKER));
  const untied = books
    .filter((book) => (book.mpn ?? "").trim())
    .flatMap((book) =>
      files.filter((file) => file.section === "spec" && file.bookId === book.id && !(file.mpn ?? "").trim()).map((file) => ({ book, file })),
    );
  const confirmBooks = books.filter((b) => b.confirmLegacy && !b.legacy);
  const legacyBooks = books.filter((b) => b.legacy);
  const unfiled = files.filter((f) => f.bookId == null);
  const reviews = reads.data?.rows ?? [];
  const reviewOpen = reviews.filter((r) => r.status === "needs_review" || r.status === "unreadable");
  const importRows = pending.data?.rows ?? [];
  const twinRows = twins.data?.twins ?? [];
  const doneRows = state.data?.done ?? [];
  const openKeys = {
    cleanup: new Set(named.map((f) => `file:${f.id}`)),
    duplicates: new Set(groups.map((g) => `dup:${g.manufacturer}|${g.family}|${g.docNumber}|${g.size}`)),
    import: new Set(importRows.map((r) => r.key)),
    "import-dupes": new Set(twinRows.map((p) => `twin:${p.oldId}-${p.newId}`)),
    untied: new Set(untied.map((r) => `file:${r.file.id}`)),
    confirm: new Set(confirmBooks.map((b) => `book:${b.id}`)),
    "spec-review": new Set(reviewOpen.map((r) => `file:${r.fileId}`)),
    unfiled: new Set(unfiled.map((f) => `file:${f.id}`)),
    legacy: new Set<string>(),
  };

  const review = useMutation({
    mutationFn: (apply: boolean) => cleanupLibraryDuplicates({ data: { apply } }),
    onSuccess: (r) => {
      setReport(r);
      if (r.applied) reload();
    },
    onError: (e) => fail(e, "Could not review the cleanup"),
  });
  const removeFile = useMutation({
    mutationFn: (file: LibraryFile) => deleteLibraryFile({ data: { id: file.id } }),
    onSuccess: (_r, file) => {
      toast.success(`Removed ${file.name}`);
      remember("cleanup", `file:${file.id}`, file.name);
      reload();
    },
    onError: (e) => fail(e, "Could not remove that file"),
  });
  const keepOne = useMutation({
    mutationFn: (ids: { keepId: number; removeIds: number[]; key: string; label: string }) => keepOneLibraryCopy({ data: { keepId: ids.keepId, removeIds: ids.removeIds } }),
    onSuccess: (r, ids) => {
      toast.success(`Kept one copy and removed ${r.removed}`);
      remember("duplicates", ids.key, ids.label);
      reload();
    },
    onError: (e) => fail(e, "Could not remove the extra copies"),
  });
  const storeOnce = useMutation({
    mutationFn: (fileId: number) => storeLibraryFileOnce({ data: { fileId } }),
    onSuccess: (r) => {
      toast.success(r.createdMainChip ? `Added ${r.bookTitle} and stored ${r.name} there.` : `Stored ${r.name} on ${r.bookTitle}.`);
      reload();
    },
    onError: (e) => fail(e, "Could not store that file once"),
  });
  const importing = useMutation({
    mutationFn: (apply: boolean) => importLibraryBatch({ data: { apply, limit: 15 } }),
    onSuccess: (result) => {
      setImportNote(`${result.applied ? "This run" : "Preview"}: ${result.left} still waiting.`);
      if (result.applied) {
        for (const row of result.rows) {
          if ((row.action === "OK" || row.action === "SKIP") && row.url && row.bookId != null) {
            remember("import", `${row.url}|${row.bookId}`, row.reason);
          }
        }
        reload();
      }
    },
    onError: (e) => fail(e, "Could not run the Library import"),
  });
  const log = useMutation({
    mutationFn: () => libraryImportLogCsv(),
    onSuccess: (csv) => {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "library-import-log.csv";
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => fail(e, "Could not download the log"),
  });
  const fixTwins = useMutation({
    mutationFn: () => resolveImportDuplicates({ data: { apply: true } }),
    onSuccess: (result) => {
      setConfirmTwins(false);
      for (const pair of twinRows) remember("import-dupes", `twin:${pair.oldId}-${pair.newId}`, pair.bookTitle);
      toast.success(`Kept the older file on ${result.twins.length} twin${result.twins.length === 1 ? "" : "s"}`);
      reload();
    },
    onError: (e) => fail(e, "Could not fix the twins"),
  });
  const tie = useMutation({
    mutationFn: async (fileId: number) => {
      await tieAndReadSpec({ data: { fileId } });
      return runSpecReads({ data: { fileIds: [fileId], limit: 1 } });
    },
    onSuccess: (r, fileId) => {
      const row = untied.find((u) => u.file.id === fileId);
      if (row) remember("untied", `file:${fileId}`, `${row.book.title} · ${row.file.name}`);
      toast.success(r.review ? "Tied and read. It's in Spec Review." : r.unreadable ? "Tied. The sheet could not be read." : "Tied.");
      reload();
    },
    onError: (e) => fail(e, "Could not tie that sheet"),
  });
  const confirm = useMutation({
    mutationFn: (book: LibraryBook) => setConfirmLegacy({ data: { bookId: book.id, value: false } }),
    onSuccess: (_r, book) => {
      remember("confirm", `book:${book.id}`, book.title);
      toast.success(`${book.title} confirmed`);
      reload();
    },
    onError: (e) => fail(e, "Could not confirm that model"),
  });

  const savedOpen = (id: string, count: number) => {
    if (id in localOpen) return localOpen[id]!;
    const saved = state.data?.opens.find((o) => o.section === id);
    if (saved) return saved.open;
    return count > 0;
  };
  const toggle = (id: string, count: number) => {
    const next = !savedOpen(id, count);
    setLocalOpen((m) => ({ ...m, [id]: next }));
    setOpen.mutate({ section: id, open: next });
  };

  const resolvedFor = (id: keyof typeof openKeys) =>
    doneRows
      .filter((r) => r.section === id && !openKeys[id].has(r.itemKey))
      .map((r) => ({ key: r.itemKey, label: r.label, detail: r.detail, resolvedAt: r.resolvedAt }));

  const show = (id: string, rows: { key: string; node: ReactNode }[]) => {
    const clipped = clipRows(rows, !!more[id]);
    return (
      <>
        <ul className="divide-y divide-border">{clipped.rows.map((row) => <li key={row.key} className="py-2">{row.node}</li>)}</ul>
        {clipped.more ? (
          <Button type="button" variant="link" className="h-8 px-0" onClick={() => setMore((m) => ({ ...m, [id]: true }))}>
            Show all {rows.length}
          </Button>
        ) : null}
      </>
    );
  };

  const sections: Section[] = [
    {
      id: "spec-review",
      title: "Spec Review",
      hint: "Reads stored spec sheets and waits for approval. A filled field is not overwritten unless you pick Use new.",
      noun: reviewOpen.length === 1 ? "spec review" : "spec reviews",
      openCount: reviewOpen.length,
      testId: "library-spec-review",
      body: (
        <SpecReviewPanel
          rows={reviews}
          queued={reads.data?.queued ?? 0}
          noSheet={reads.data?.noSheet ?? []}
          onChanged={reload}
          onEnterByHand={onEnterByHand}
          onEnterForModel={onEnterForModel}
        />
      ),
    },
    {
      id: "cleanup",
      title: "Cleanup",
      hint: "Files whose name contains Duplicate To Delete. Remove takes that file out. Nothing else is removed.",
      noun: named.length === 1 ? "file to remove" : "files to remove",
      openCount: named.length,
      testId: "library-cleanup",
      body: named.length ? (
        <div>
          <Button type="button" className="mb-2" variant="outline" disabled={review.isPending} onClick={() => review.mutate(false)} data-testid="library-cleanup-review">
            {review.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Review leftovers
          </Button>
          {show(
            "cleanup",
            named.map((file) => ({
            key: String(file.id),
            node: (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{file.name}</span>
                <Button type="button" size="sm" variant="outline" disabled={removeFile.isPending} onClick={() => removeFile.mutate(file)}>
                  Remove
                </Button>
              </div>
            ),
          })),
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No file is marked Duplicate To Delete.</p>
      ),
    },
    {
      id: "duplicates",
      title: "Same File On Several Models",
      hint: "Same size and document number, on more than one model in one family. Store Once moves one copy onto the main chip. Then Keep one, remove others deletes the extra copies, and every model still shows the file.",
      noun: groups.length === 1 ? "duplicate group" : "duplicate groups",
      openCount: groups.length,
      testId: "library-dup-report",
      body: groups.length ? (
        show(
          "duplicates",
          groups.map((g) => {
            const home = books.find((b) => b.id === g.files[0]!.bookId);
            const main = home ? (isMainChip(home, books) ? home : mainChipFor(home, books)) : null;
            // Only a copy on the main chip reaches every variation, so only that copy can be the keeper.
            const onMain = main ? g.files.find((f) => f.bookId === main.id) : undefined;
            const keep = onMain ?? [...g.files].sort((a, b) => a.id - b.id)[0]!;
            const key = `dup:${g.manufacturer}|${g.family}|${g.docNumber}|${g.size}`;
            const label = `${g.manufacturer} ${g.family} · ${g.docNumber}`;
            return {
              key,
              node: (
                <div data-testid="library-dup-group">
                  <p className="text-sm font-medium">{label} · {sizeText(g.size)}</p>
                  <ul className="mt-1 text-sm text-muted-foreground">
                    {g.files.map((f) => (
                      <li key={f.id}>{bookTitle(books, f.bookId)} — {f.name}{f.id === keep.id ? " · keep" : ""}</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    variant="outline"
                    disabled={keepOne.isPending || storeOnce.isPending}
                    onClick={() => (onMain ? keepOne.mutate({ keepId: keep.id, removeIds: g.files.map((f) => f.id), key, label }) : storeOnce.mutate(keep.id))}
                    data-testid={onMain ? "library-dup-keep" : "library-dup-store-once"}
                  >
                    {onMain ? "Keep one, remove others" : `Store Once On ${main ? main.title : `${g.manufacturer} ${g.family}`}`}
                  </Button>
                </div>
              ),
            };
          }),
        )
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="library-dup-empty">No shared manual or parts file is stored on more than one model in the same family.</p>
      ),
    },
    {
      id: "import",
      title: "Library Import",
      hint: "Official PDFs still waiting to be stored. Run next 15 downloads at most 15 files. No new books are added.",
      noun: "uploads waiting",
      openCount: importRows.length,
      testId: "library-import",
      body: (
        <div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={importing.isPending} onClick={() => importing.mutate(true)} data-testid="library-import-run">
              {importing.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Run next 15
            </Button>
            <Button type="button" variant="link" className="h-10 px-2" disabled={log.isPending} onClick={() => log.mutate()} data-testid="library-import-log">
              Download log
            </Button>
          </div>
          {importNote ? <p className="mt-2 text-sm" data-testid="library-import-left">{importNote}</p> : null}
          {importRows.length ? show("import", importRows.map((row) => ({ key: row.key, node: <span className="text-sm break-words">{row.label}</span> }))) : (
            <p className="mt-2 text-sm text-muted-foreground">No upload is waiting.</p>
          )}
        </div>
      ),
    },
    {
      id: "import-dupes",
      title: "Import Duplicates",
      hint: "A newer import copy and the older file it repeated. Keep one, remove others copies the MPN onto the older file and renames the newer copy so cleanup can remove it.",
      noun: twinRows.length === 1 ? "twin" : "twins",
      openCount: twinRows.length,
      testId: "library-import-dupes",
      body: (
        <div>
          <Button type="button" variant="outline" disabled={fixTwins.isPending || twinRows.length === 0} onClick={() => setConfirmTwins(true)} data-testid="library-dupe-fix">
            Keep one, remove others
          </Button>
          {twinRows.length ? (
            show(
              "import-dupes",
              twinRows.map((pair) => ({
                key: `${pair.oldId}-${pair.newId}`,
                node: (
                  <span className="text-sm">
                    <span className="font-medium">{pair.bookTitle}</span>
                    <span className="block text-muted-foreground">Keep file {pair.oldId}. Newer file {pair.newId}{pair.mpn ? ` · MPN ${pair.mpn}` : ""}</span>
                  </span>
                ),
              })),
            )
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No newer copy is sitting next to an older file.</p>
          )}
          {(twins.data?.differentSize.length ?? 0) > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{twins.data!.differentSize.length} same-name files have a different size and were left alone.</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "untied",
      title: "Spec Sheets Not Tied",
      hint: "A model has an MPN, and a spec sheet on that model is not tied to it. Tie and read copies the MPN onto the sheet and reads it.",
      noun: untied.length === 1 ? "untied sheet" : "untied sheets",
      openCount: untied.length,
      testId: "library-untied-specs",
      body: untied.length ? (
        show(
          "untied",
          untied.map(({ book, file }) => ({
            key: String(file.id),
            node: (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">
                  <span className="font-medium">{book.title}</span>
                  <span className="block text-muted-foreground">{file.name}</span>
                </span>
                <Button type="button" size="sm" variant="outline" disabled={tie.isPending} onClick={() => tie.mutate(file.id)} data-testid="tie-and-read">
                  Tie and read
                </Button>
              </div>
            ),
          })),
        )
      ) : (
        <p className="text-sm text-muted-foreground">Every spec sheet on a model with an MPN is tied.</p>
      ),
    },
    {
      id: "legacy",
      title: "Legacy",
      hint: "Models the manufacturer lists as discontinued or obsolete. They stay in the Library.",
      noun: "legacy",
      openCount: 0,
      testId: "library-legacy-admin",
      body: legacyBooks.length ? (
        show(
          "legacy",
          legacyBooks.map((b) => ({ key: String(b.id), node: <span className="text-sm text-muted-foreground">{b.title}</span> })),
        )
      ) : (
        <p className="text-sm text-muted-foreground">No model is under Legacy.</p>
      ),
    },
    {
      id: "confirm",
      title: "Confirm Legacy",
      hint: "Could not be confirmed as discontinued. Confirm keeps the model in the main row and clears the flag.",
      noun: "legacy",
      openCount: confirmBooks.length,
      testId: "library-confirm-legacy",
      body: confirmBooks.length ? (
        show(
          "confirm",
          confirmBooks.map((book) => ({
            key: String(book.id),
            node: (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">{book.title}</span>
                <Button type="button" size="sm" variant="outline" disabled={confirm.isPending} onClick={() => confirm.mutate(book)} data-testid="confirm-legacy-clear">
                  Confirm
                </Button>
              </div>
            ),
          })),
        )
      ) : (
        <p className="text-sm text-muted-foreground">No model is flagged Confirm Legacy.</p>
      ),
    },
    {
      id: "unfiled",
      title: "Not Filed Yet",
      hint: "Files that are stored but not on a model yet.",
      noun: unfiled.length === 1 ? "unfiled file" : "unfiled files",
      openCount: unfiled.length,
      testId: "library-unfiled-admin",
      body: unfiled.length ? (
        show(
          "unfiled",
          unfiled.map((file) => ({
            key: String(file.id),
            node: (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{file.name}</span>
                {onMoveFile ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => onMoveFile(file)}>
                    File it
                  </Button>
                ) : null}
              </div>
            ),
          })),
        )
      ) : (
        <p className="text-sm text-muted-foreground">Every file is on a model.</p>
      ),
    },
  ];

  const ordered = orderAdminSections(sections);
  const counts = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s.openCount])), [
    reviewOpen.length,
    named.length,
    groups.length,
    importRows.length,
    twinRows.length,
    untied.length,
    confirmBooks.length,
    unfiled.length,
  ]);

  useEffect(() => {
    for (const [id, count] of Object.entries(counts)) {
      const prev = prevCounts.current[id];
      if (prev != null && prev > 0 && count === 0) {
        setLocalOpen((m) => ({ ...m, [id]: false }));
        setOpen.mutate({ section: id, open: false });
      }
      prevCounts.current[id] = count;
    }
  }, [counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = adminSummary(ordered.map((s) => ({ id: s.id, openCount: s.openCount, noun: s.noun })));
  const removable = (report?.books ?? []).filter((b) => b.action === "remove").length;
  const nothing = !!report && report.named.count + report.abandoned.count + removable === 0;

  return (
    <div className="mt-4 grid gap-3" data-testid="library-admin">
      <p className="text-sm" data-testid="library-admin-summary">{summary}</p>
      {ordered.map((section) => (
        <AdminSection
          key={section.id}
          id={section.id}
          title={section.title}
          hint={section.hint}
          openCount={section.openCount}
          lastResolved={resolvedOn(resolvedFor(section.id as keyof typeof openKeys))}
          open={savedOpen(section.id, section.openCount)}
          onOpenChange={() => toggle(section.id, section.openCount)}
          resolved={resolvedFor(section.id as keyof typeof openKeys)}
          testId={section.testId}
        >
          {section.body}
        </AdminSection>
      ))}

      <Dialog open={confirmTwins} onOpenChange={(o) => !o && !fixTwins.isPending && setConfirmTwins(false)}>
        <DialogContent data-testid="library-dupe-confirm">
          <DialogTitle>Keep the older file on {twinRows.length} twin{twinRows.length === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>
            The older file keeps the newer copy's MPN and link when it has no MPN. The newer copy is renamed Duplicate To Delete. Remove it from Cleanup.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={fixTwins.isPending} onClick={() => fixTwins.mutate()} data-testid="library-dupe-confirm-fix">
              {fixTwins.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Keep one, remove others
            </Button>
            <Button type="button" variant="outline" disabled={fixTwins.isPending} onClick={() => setConfirmTwins(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!report} onOpenChange={(o) => !o && !review.isPending && setReport(null)}>
        <DialogContent data-testid="library-cleanup-dialog">
          <DialogTitle>{report?.applied ? "Cleanup Finished" : "Clean Up These Library Files?"}</DialogTitle>
          {report ? (
            <>
              <DialogDescription>
                {report.applied ? "This is what was removed. Nothing else was touched." : "Nothing is removed until you confirm."}
              </DialogDescription>
              <ul className="mt-3 grid gap-2 text-sm">
                <li data-testid="library-cleanup-named">
                  Files named “Duplicate To Delete”: <strong>{report.named.count}</strong> ({sizeText(report.named.bytes)}). Expected about {EXPECTED_NAMED}.
                </li>
                <li>Total size: <strong>{sizeText(report.totalBytes)}</strong>.</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {!report.applied && !nothing ? (
                  <Button type="button" variant="destructive" disabled={review.isPending} onClick={() => review.mutate(true)} data-testid="library-cleanup-confirm">
                    Remove These
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setReport(null)}>Close</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
