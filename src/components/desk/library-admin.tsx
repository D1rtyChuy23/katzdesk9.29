import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cleanupLibraryDuplicates, storeLibraryFileOnce, type LibraryBook, type LibraryCleanupReport, type LibraryFile } from "@/lib/ops/library-files";
import { importLibraryBatch, libraryImportLogCsv, resolveImportDuplicates, type ImportDuplicateReport, type LibraryImportReport } from "@/lib/ops/library-import";
import { familyDuplicateGroups, familyOf, isMainChip, nameKey, sizeText, type ShareFile } from "@/lib/ops/library-file-rules";

/** Jesus counted 54 from the dedupe plus #27, #37 and #50. The dialog shows the count actually found. */
const EXPECTED_NAMED = 57;

function bookTitle(books: LibraryBook[], id: number | null): string {
  return books.find((b) => b.id === id)?.title ?? "Unknown model";
}

export function LibraryAdmin({ books, files, onChanged }: { books: LibraryBook[]; files: LibraryFile[]; onChanged: () => void }) {
  const [report, setReport] = useState<LibraryCleanupReport | null>(null);
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
  const review = useMutation({
    mutationFn: (apply: boolean) => cleanupLibraryDuplicates({ data: { apply } }),
    onSuccess: (r) => {
      setReport(r);
      if (r.applied) onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not review the cleanup"),
  });
  const consolidate = useMutation({
    mutationFn: (fileId: number) => storeLibraryFileOnce({ data: { fileId } }),
    onSuccess: (r) => {
      toast.success(r.createdMainChip ? `Added ${r.bookTitle} and stored ${r.name} there.` : `Stored ${r.name} on ${r.bookTitle}. The other copies are still on their models.`);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not store that file once"),
  });
  const removable = (report?.books ?? []).filter((b) => b.action === "remove").length;
  const nothing = !!report && report.named.count + report.abandoned.count + removable === 0;
  const [importReport, setImportReport] = useState<LibraryImportReport | null>(null);
  const importing = useMutation({
    mutationFn: (apply: boolean) => importLibraryBatch({ data: { apply, limit: 15 } }),
    onSuccess: (result, apply) => {
      setImportReport(result);
      if (apply) onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not run the Library import"),
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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not download the log"),
  });
  const changing = (importReport?.rows ?? []).filter((row) => row.action !== "SKIP");
  const [dupes, setDupes] = useState<ImportDuplicateReport | null>(null);
  const [confirmTwins, setConfirmTwins] = useState(false);
  const duplicates = useMutation({
    mutationFn: (apply: boolean) => resolveImportDuplicates({ data: { apply } }),
    onSuccess: (result, apply) => {
      setDupes(result);
      setConfirmTwins(false);
      if (apply) onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not review the import duplicates"),
  });
  const untiedSpecs = books
    .filter((book) => (book.mpn ?? "").trim())
    .flatMap((book) =>
      files
        .filter((file) => file.section === "spec" && file.bookId === book.id && !(file.mpn ?? "").trim())
        .map((file) => ({ book, file })),
    );
  return (
    <section className="mt-8 rounded-xl border border-border bg-card px-4 py-4" data-testid="library-admin">
      <h2 className="font-display text-lg font-medium">Library Admin</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One-time cleanup, and manuals or parts stored more than once in a family. Spec sheets are not part of either.
      </p>

      <div className="mt-4">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Cleanup</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes files whose name contains “Duplicate To Delete”, plus their stored text and pieces, uploads left unfinished for more than an hour, and empty books #34 and #35 when the title matches and they have no files. Nothing else is removed.
        </p>
        <Button type="button" className="mt-2" variant="outline" disabled={review.isPending} onClick={() => review.mutate(false)} data-testid="library-cleanup-review">
          {review.isPending && !report?.applied ? <Loader2 className="size-4 animate-spin" /> : null}
          Review Cleanup
        </Button>
      </div>

      <div className="mt-5">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Same File On Several Models</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Same size and document number, on more than one model in one family. Store once moves one copy onto the main chip and leaves the others until you delete them. A variation that should not show the shared file can use Remove Here.
        </p>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground" data-testid="library-dup-empty">
            No shared manual or parts file is stored on more than one model in the same family.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border" data-testid="library-dup-report">
            {groups.map((g) => {
              const familyBooks = books.filter((b) => b.manufacturer.toLowerCase() === g.manufacturer.toLowerCase() && nameKey(familyOf(b.title, b.manufacturer)) === nameKey(g.family));
              const main = familyBooks.find((b) => isMainChip(b, books)) ?? null;
              const onMain = main ? g.files.find((f) => f.bookId === main.id) : undefined;
              const keep = [...g.files].sort((a, b) => a.id - b.id)[0]!;
              const label = main ? main.title : `${g.manufacturer} ${g.family}`;
              return (
                <li key={`${g.manufacturer}-${g.family}-${g.docNumber}-${g.size}`} className="py-3" data-testid="library-dup-group">
                  <p className="text-sm font-medium">
                    {g.manufacturer} {g.family} · {g.docNumber} · {sizeText(g.size)}
                  </p>
                  <ul className="mt-1 text-sm text-muted-foreground">
                    {g.files.map((f) => (
                      <li key={f.id}>
                        {bookTitle(books, f.bookId)} — {f.name}
                      </li>
                    ))}
                  </ul>
                  {onMain ? (
                    <p className="mt-2 text-xs text-muted-foreground">Already on {main?.title}. Delete the other copies if you do not need them.</p>
                  ) : (
                    <>
                      {!main ? <p className="mt-2 text-xs text-muted-foreground">No main chip yet. This adds {label} and moves one copy there.</p> : null}
                      <Button type="button" size="sm" className="mt-2" variant="outline" disabled={consolidate.isPending} onClick={() => consolidate.mutate(keep.id)} data-testid="library-dup-store-once">
                        Store Once On {label}
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-5" data-testid="library-import">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Library import</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Marks the named duplicates, stores official PDFs (a manual or parts file is put on the family's main chip only when every variation is already targeted; otherwise it stays on the listed model), then sets MPNs and ties official files. Preview changes nothing. Run next 15 downloads at most 15 files. No new books are added.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={importing.isPending} onClick={() => importing.mutate(false)} data-testid="library-import-preview">
            {importing.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Preview
          </Button>
          <Button type="button" variant="outline" disabled={importing.isPending} onClick={() => importing.mutate(true)} data-testid="library-import-run">
            Run next 15
          </Button>
          <Button type="button" variant="link" className="h-10 px-2" disabled={log.isPending} onClick={() => log.mutate()} data-testid="library-import-log">
            Download log
          </Button>
        </div>
        {importReport ? (
          <div className="mt-3 text-sm" data-testid="library-import-result">
            <p data-testid="library-import-left">
              {importReport.applied ? "This run" : "Preview"}: {importReport.counts.OK} to store, {importReport.counts.SKIP} already there, {importReport.counts.FAIL} failed, {importReport.counts.CONFLICT} conflicts. Uploads left: <strong>{importReport.left}</strong>.
            </p>
            {importReport.note ? <p data-testid="library-import-note">{importReport.note}</p> : null}
            {changing.length ? (
              <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border" data-testid="library-import-rows">
                {changing.map((row, index) => (
                  <li key={`${row.action}-${row.fileId ?? ""}-${row.bookId ?? ""}-${index}`} className="px-3 py-2 break-words">
                    <span className="font-medium">{row.action}</span>
                    {row.bookId != null ? ` · book ${row.bookId}` : ""}
                    {row.fileId != null ? ` · file ${row.fileId}` : ""}
                    <span className="block text-muted-foreground">{row.reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">Nothing in this batch would change.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-5" data-testid="library-import-dupes">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Import Duplicates</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A newer import copy and the older file it repeated. Review changes nothing. Fix twins copies the MPN and link onto the older file when that file has no MPN, then renames the newer copy so the cleanup can remove it. Nothing is deleted here.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={duplicates.isPending} onClick={() => duplicates.mutate(false)} data-testid="library-dupe-review">
            {duplicates.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Review
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={duplicates.isPending || !dupes || dupes.twins.length === 0}
            onClick={() => setConfirmTwins(true)}
            data-testid="library-dupe-fix"
          >
            Fix twins
          </Button>
        </div>
        {dupes ? (
          <div className="mt-3 text-sm" data-testid="library-dupe-result">
            <p>
              {dupes.applied ? "Fixed" : "Would fix"} <strong>{dupes.twins.length}</strong> twin{dupes.twins.length === 1 ? "" : "s"}. Same name with a different size, left alone: <strong>{dupes.differentSize.length}</strong>.
            </p>
            {dupes.twins.length ? (
              <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border" data-testid="library-dupe-twins">
                {dupes.twins.map((pair) => (
                  <li key={`${pair.oldId}-${pair.newId}`} className="px-3 py-2 break-words">
                    <span className="font-medium">{pair.bookTitle}</span>
                    <span className="block text-muted-foreground">Old file {pair.oldId}: {pair.oldName}</span>
                    <span className="block text-muted-foreground">New file {pair.newId}: {pair.newName} · {sizeText(pair.size)}{pair.mpn ? ` · MPN ${pair.mpn}` : ""}{pair.sourceUrl ? ` · ${pair.sourceUrl}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {dupes.differentSize.length ? (
              <ul className="mt-2 max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border" data-testid="library-dupe-sizes">
                {dupes.differentSize.map((pair) => (
                  <li key={`${pair.oldId}-${pair.newId}`} className="px-3 py-2 break-words text-muted-foreground">
                    {pair.bookTitle}: file {pair.oldId} ({sizeText(pair.oldSize)}) and file {pair.newId} ({sizeText(pair.newSize)})
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={confirmTwins} onOpenChange={(o) => !o && !duplicates.isPending && setConfirmTwins(false)}>
        <DialogContent data-testid="library-dupe-confirm">
          <DialogTitle>Fix {dupes?.twins.length ?? 0} twin files?</DialogTitle>
          <DialogDescription>
            The older file keeps the newer copy's MPN and link when it has no MPN. The newer copy is renamed Duplicate To Delete. Nothing is deleted.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={duplicates.isPending} onClick={() => duplicates.mutate(true)} data-testid="library-dupe-confirm-fix">
              {duplicates.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Fix {dupes?.twins.length ?? 0} twins
            </Button>
            <Button type="button" variant="outline" disabled={duplicates.isPending} onClick={() => setConfirmTwins(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-5" data-testid="library-untied-specs">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Spec Sheets Not Tied</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Models that have an MPN, and a spec sheet on that model that is not tied to it. This list changes nothing.
        </p>
        {untiedSpecs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Every spec sheet on a model with an MPN is tied.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border" data-testid="library-untied-rows">
            {untiedSpecs.map(({ book, file }) => (
              <li key={file.id} className="py-2 text-sm break-words">
                <span className="font-medium">{book.title}</span>
                <span className="block text-muted-foreground">{file.name} · file {file.id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!report} onOpenChange={(o) => !o && !review.isPending && setReport(null)}>
        <DialogContent data-testid="library-cleanup-dialog">
          <DialogTitle>{report?.applied ? "Cleanup Finished" : "Clean Up These Library Files?"}</DialogTitle>
          {report ? (
            <>
              <DialogDescription>
                {report.applied
                  ? "This is what was removed. Nothing else was touched."
                  : "Nothing is removed until you confirm. Cancel leaves the Library as it is."}
              </DialogDescription>
              <ul className="mt-3 grid gap-2 text-sm">
                <li data-testid="library-cleanup-named">
                  Files named “Duplicate To Delete”: <strong>{report.named.count}</strong> ({sizeText(report.named.bytes)}). Expected about {EXPECTED_NAMED} (54 from the dedupe, plus #27, #37 and #50).
                </li>
                {report.named.files.length ? (
                  <li>
                    <ul className="max-h-36 overflow-y-auto rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground" data-testid="library-cleanup-named-list">
                      {report.named.files.map((f) => (
                        <li key={f.id}>
                          #{f.id} {f.name} ({sizeText(f.size)})
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : null}
                <li data-testid="library-cleanup-abandoned">
                  Unfinished uploads older than 1 hour: <strong>{report.abandoned.count}</strong> ({sizeText(report.abandoned.bytes)}).
                </li>
                {report.books.map((b) => (
                  <li key={b.id}>
                    Book #{b.id} {b.title ?? b.expectedTitle}: {b.reason}
                  </li>
                ))}
                <li>
                  Total size: <strong>{sizeText(report.totalBytes)}</strong>.
                </li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">{report.spaceNote}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {!report.applied && !nothing ? (
                  <Button type="button" variant="destructive" disabled={review.isPending} onClick={() => review.mutate(true)} data-testid="library-cleanup-confirm">
                    {review.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Remove These
                  </Button>
                ) : null}
                <Button type="button" variant="outline" disabled={review.isPending} onClick={() => setReport(null)}>
                  {report.applied || nothing ? "Close" : "Cancel"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
