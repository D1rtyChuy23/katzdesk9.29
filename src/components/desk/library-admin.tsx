import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cleanupLibraryDuplicates, importLibraryBatch, storeLibraryFileOnce, type LibraryBook, type LibraryCleanupReport, type LibraryFile, type LibraryImportReport } from "@/lib/ops/library-files";
import { Input } from "@/components/ui/input";
import { familyDuplicateGroups, familyOf, isMainChip, nameKey, sizeText, type ShareFile } from "@/lib/ops/library-file-rules";

/** Jesus counted 54 from the dedupe plus #27, #37 and #50. The dialog shows the count actually found. */
const EXPECTED_NAMED = 57;

function bookTitle(books: LibraryBook[], id: number | null): string {
  return books.find((b) => b.id === id)?.title ?? "Unknown model";
}

export function LibraryAdmin({ books, files, onChanged }: { books: LibraryBook[]; files: LibraryFile[]; onChanged: () => void }) {
  const [report, setReport] = useState<LibraryCleanupReport | null>(null);
  const [importLimit, setImportLimit] = useState(10);
  const [importPlan, setImportPlan] = useState<LibraryImportReport | null>(null);
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
  const importer = useMutation({
    mutationFn: (apply: boolean) => importLibraryBatch({ data: { apply, limit: importLimit } }),
    onSuccess: (r) => {
      setImportPlan(r);
      if (r.applied) onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not review the import"),
  });
  const removable = (report?.books ?? []).filter((b) => b.action === "remove").length;
  const nothing = !!report && report.named.count + report.abandoned.count + removable === 0;
  return (
    <section className="mt-8 rounded-xl border border-border bg-card px-4 py-4" data-testid="library-admin">
      <h2 className="font-display text-lg font-medium">Library Admin</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One-time cleanup, the vendor-file import, and manuals or parts stored more than once in a family. Spec sheets are not part of the cleanup or the duplicate report.
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
        <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Import</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Renames #27 and #37 so cleanup can remove them, and renames #50 only after Eversys Cameo already has a file named with 5700105620. Manuals and parts are stored once on the family’s main chip; spec sheets stay on the model. A book MPN is set only when the list has one. Review downloads the next batch and saves nothing.
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm" htmlFor="library-import-limit">
          Files this batch
          <Input
            id="library-import-limit"
            type="number"
            min={0}
            max={386}
            value={importLimit}
            disabled={importer.isPending}
            className="w-24"
            data-testid="library-import-limit"
            onChange={(e) => setImportLimit(Math.max(0, Math.min(386, Number(e.target.value) || 0)))}
          />
        </label>
        <Button type="button" className="mt-2" variant="outline" disabled={importer.isPending} onClick={() => importer.mutate(false)} data-testid="library-import-review">
          {importer.isPending && !importPlan?.applied ? <Loader2 className="size-4 animate-spin" /> : null}
          Review Import
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
              const main = familyBooks.find((b) => isMainChip(b)) ?? null;
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

      <Dialog open={!!importPlan} onOpenChange={(o) => !o && !importer.isPending && setImportPlan(null)}>
        <DialogContent data-testid="library-import-dialog">
          <DialogTitle>{importPlan?.applied ? "Import Batch Finished" : "Apply This Import Batch?"}</DialogTitle>
          {importPlan ? (
            <>
              <DialogDescription>
                {importPlan.applied
                  ? "This is what was saved. Nothing else was changed."
                  : "Nothing is saved until you apply. Apply renames the marked files, stores the OK PDFs, sets the OK MPNs, and writes every row of this batch to the import log."}
              </DialogDescription>
              <ul className="mt-3 grid gap-1 text-sm" data-testid="library-import-counts">
                <li>OK: <strong>{importPlan.counts.OK}</strong></li>
                <li>Skip: <strong>{importPlan.counts.SKIP}</strong></li>
                <li>Fail: <strong>{importPlan.counts.FAIL}</strong></li>
                <li>Conflict: <strong>{importPlan.counts.CONFLICT}</strong></li>
              </ul>
              <ul className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground" data-testid="library-import-rows">
                {importPlan.rows.map((row, i) => (
                  <li key={`${row.kind}-${row.bookId ?? "x"}-${row.fileId ?? "x"}-${i}`}>
                    {row.action} · {row.kind}
                    {row.fileId ? ` #${row.fileId}` : ""}
                    {row.bookId ? ` · book #${row.bookId}` : ""} — {row.reason}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                {!importPlan.applied && importPlan.rows.length > 0 ? (
                  <Button type="button" disabled={importer.isPending} onClick={() => importer.mutate(true)} data-testid="library-import-apply">
                    {importer.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    Apply This Batch
                  </Button>
                ) : null}
                <Button type="button" variant="outline" disabled={importer.isPending} onClick={() => setImportPlan(null)}>
                  {importPlan.applied ? "Close" : "Cancel"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

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
