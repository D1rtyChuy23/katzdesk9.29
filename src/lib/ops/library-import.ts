/**
 * Library import. Admin only. Preview (apply false) changes nothing.
 * A run stores at most `limit` downloaded files, then sets MPNs and ties official files.
 * Manuals and parts move to a main chip only when the upload already covers that whole family.
 * It never creates a book, never deletes a file, and it does not run the cleanup.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import importData from "@/lib/ops/library-import-data.json";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import {
  CHUNK_BYTES,
  MAX_FILE_BYTES,
  collapseImportTargets,
  importFailureSettled,
  importSkipReason,
  isMainChip,
  isManualType,
  shouldStartDownload,
  type CollapsedImportTarget,
  type ImportExistingFile,
  type LibrarySection,
} from "@/lib/ops/library-file-rules";
import { cleanMpn, cleanSourceUrl, mpnKey, sameMpn, tieError } from "@/lib/ops/mpn-rules";

const DUPLICATE_MARKER = "Duplicate To Delete";
const CAMEO_FILE = "5700105620";
const DEFAULT_LIMIT = 15;
const DOWNLOAD_TIMEOUT_MS = 25_000;
export const IMPORT_TIME_NOTE = "Stopped early to stay under the time limit. Tap Run again.";

type ImportJson = {
  markAsDuplicate: number[];
  uploads: {
    url: string;
    fileName: string;
    targets: { bookId: number; section: string; docType: string | null; name: string }[];
  }[];
  mpns: { bookId: number; title: string; mpn: string | null; productPage: string | null }[];
};

const data = importData as ImportJson;

export type LibraryImportAction = "OK" | "SKIP" | "FAIL" | "CONFLICT";

export type LibraryImportRow = {
  action: LibraryImportAction;
  reason: string;
  url: string | null;
  bookId: number | null;
  fileId: number | null;
};

export type LibraryImportReport = {
  applied: boolean;
  counts: Record<LibraryImportAction, number>;
  rows: LibraryImportRow[];
  left: number;
  limit: number;
  note: string | null;
};

type MemFile = ImportExistingFile & { id: number; sourceUrl: string | null };

const emptyCounts = (): Record<LibraryImportAction, number> => ({ OK: 0, SKIP: 0, FAIL: 0, CONFLICT: 0 });

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireLibraryAdmin(sql: Sql, userId: string) {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const isAdmin = flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin";
  if (!isAdmin) throw new Error("Only an admin can do that in The Library.");
  return { name: rows[0]?.username || "Teammate" };
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function markedDuplicateName(name: string): string {
  if (name.includes(DUPLICATE_MARKER)) return name;
  const ext = /(\.[A-Za-z0-9]+)$/.exec(name);
  if (!ext) return `${name} - ${DUPLICATE_MARKER}`;
  return `${name.slice(0, name.length - ext[1]!.length)} - ${DUPLICATE_MARKER}${ext[1]}`;
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sectionOf(value: string): LibrarySection | null {
  return value === "spec" || value === "manuals" || value === "parts" ? value : null;
}

function retryable(reason: string): { error: string } {
  return { error: `${reason} will retry` };
}

async function fetchPdf(url: string): Promise<{ bytes: Uint8Array } | { error: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: { "user-agent": "KatzDesk/library-import" },
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError" || /timeout|aborted/i.test(err.message));
    const detail = err instanceof Error ? err.message : "The download failed.";
    return retryable(timedOut ? "Timed out." : `Could not download. ${detail}`);
  }
  if (!res.ok) {
    const reason = `Download failed (${res.status}).`;
    return importFailureSettled(reason) ? { error: reason } : retryable(reason);
  }
  const reader = res.body?.getReader();
  if (!reader) return retryable("Download failed. The file had no body.");
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > MAX_FILE_BYTES) {
      await reader.cancel();
      return { error: "Larger than 20 MB." };
    }
    parts.push(step.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  const head = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0, bytes[4] ?? 0);
  if (head !== "%PDF-") return { error: "Not a PDF." };
  return { bytes };
}

async function storePdf(
  sql: Sql,
  userId: string,
  userName: string,
  dest: CollapsedImportTarget,
  bookId: number,
  bytes: Uint8Array,
  originalName: string,
): Promise<{ fileId: number } | { error: string; fileId: number | null }> {
  const docType = dest.section === "manuals" && isManualType(dest.docType) ? dest.docType : null;
  const rows = await sql.query<{ id: number }>(
    `insert into library_files (section, name, original_name, mime, size, token, added_by, added_by_name, book_id, doc_type, complete)
     values ($1, $2, $3, 'application/pdf', $4, $5, $6, $7, $8, $9, false)
     returning id`,
    [dest.section, dest.name, originalName, bytes.byteLength, newToken(), userId, userName, bookId, docType],
  );
  const id = Number(rows[0]!.id);
  for (let seq = 0, offset = 0; offset < bytes.byteLength; seq += 1, offset += CHUNK_BYTES) {
    const slice = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.byteLength));
    await sql.query(
      "insert into library_file_chunks (file_id, seq, data) values ($1, $2, decode($3, 'base64'))",
      [id, seq, Buffer.from(slice).toString("base64")],
    );
  }
  const done = await sql.query<{ id: number }>(
    `update library_files f set complete = true
      where f.id = $1
        and f.size = (select coalesce(sum(octet_length(c.data)), 0) from library_file_chunks c where c.file_id = f.id)
      returning f.id`,
    [id],
  );
  if (!done[0]) return { error: "The file did not store in full.", fileId: id };
  return { fileId: id };
}

const input = z.object({
  apply: z.boolean(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const importLibraryBatch = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { apply: boolean; limit?: number }) => input.parse(d))
  .handler(async ({ data: request, context }): Promise<LibraryImportReport> => {
    const sql = await ready();
    const role = await requireLibraryAdmin(sql, context.userId);
    const limit = request.limit ?? DEFAULT_LIMIT;
    const startedAt = Date.now();
    const books = (
      await sql.query<{ id: number; title: string; manufacturer: string | null; mpn: string | null }>(
        "select id, title, manufacturer, mpn from library_books",
      )
    ).map((b) => ({ id: Number(b.id), title: b.title, manufacturer: b.manufacturer ?? "", mpn: b.mpn ?? null }));
    const files: MemFile[] = (
      await sql.query<{
        id: number;
        name: string;
        original_name: string | null;
        size: number;
        section: string;
        book_id: number | null;
        complete: boolean;
        mpn: string | null;
        source_url: string | null;
      }>(
        `select id, name, original_name, size, section, book_id, complete, mpn, source_url
           from library_files where section <> 'training'`,
      )
    ).map((f) => ({
      id: Number(f.id),
      name: f.name,
      docName: f.original_name,
      size: Number(f.size),
      section: (sectionOf(f.section) ?? "manuals") as LibrarySection,
      bookId: f.book_id == null ? null : Number(f.book_id),
      complete: !!f.complete,
      mpn: f.mpn,
      sourceUrl: f.source_url,
    }));
    const logged = await sql.query<{ url: string | null; book_id: number | null; file_id: number | null; action: string; reason: string | null }>(
      `select distinct on (coalesce(url, ''), coalesce(book_id, 0), coalesce(file_id, 0))
              url, book_id, file_id, action, reason
         from library_import_log
        order by coalesce(url, ''), coalesce(book_id, 0), coalesce(file_id, 0), id desc`,
    );
    const settledUpload = new Set(
      logged
        .filter((r) => {
          if (!r.url) return false;
          if (r.action === "OK" || r.action === "SKIP") return true;
          return r.action === "FAIL" && importFailureSettled(r.reason ?? "");
        })
        .map((r) => `${r.url}|${r.book_id ?? ""}`),
    );
    const settledMark = new Set(
      logged.filter((r) => !r.url && r.file_id != null && r.action === "OK").map((r) => Number(r.file_id)),
    );
    const cameoSkipLogged = logged.some((r) => !r.url && Number(r.file_id) === 50 && r.action === "SKIP");
    const mpnConflictLogged = new Set(
      logged.filter((r) => r.action === "CONFLICT" && r.file_id == null && r.book_id != null).map((r) => Number(r.book_id)),
    );

    const rows: LibraryImportRow[] = [];
    const counts = emptyCounts();
    const push = async (row: LibraryImportRow, write = true) => {
      rows.push(row);
      counts[row.action] += 1;
      if (!request.apply || !write) return;
      await sql.query(
        "insert into library_import_log (url, book_id, action, reason, file_id) values ($1, $2, $3, $4, $5)",
        [row.url, row.bookId, row.action, row.reason, row.fileId],
      );
    };

    const cameo = books.find(
      (b) => b.manufacturer.toLowerCase() === "eversys" && b.title.trim().toLowerCase() === "eversys cameo",
    );
    const cameoHasKeeper = !!cameo && files.some((f) => f.bookId === cameo.id && f.name.includes(CAMEO_FILE));

    for (const fileId of data.markAsDuplicate) {
      if (settledMark.has(fileId)) continue;
      const file = files.find((f) => f.id === fileId);
      if (!file) {
        await push({ action: "FAIL", reason: `File #${fileId} is not in The Library.`, url: null, bookId: null, fileId });
        continue;
      }
      if (fileId === 50 && !cameoHasKeeper) {
        await push({
          action: "SKIP",
          reason: "Left as it is. Eversys Cameo does not yet have a file whose name contains 5700105620.",
          url: null,
          bookId: file.bookId,
          fileId,
        }, !cameoSkipLogged);
        continue;
      }
      if (file.name.includes(DUPLICATE_MARKER)) {
        await push({ action: "SKIP", reason: "Already marked Duplicate To Delete.", url: null, bookId: file.bookId, fileId }, false);
        continue;
      }
      const name = markedDuplicateName(file.name);
      if (request.apply) {
        await sql.query("update library_files set name = $2 where id = $1", [fileId, name]);
        file.name = name;
      }
      await push({ action: "OK", reason: `Renamed to "${name}".`, url: null, bookId: file.bookId, fileId });
    }

    const urlByName = new Map<string, string>();
    for (const upload of data.uploads) {
      for (const target of upload.targets) urlByName.set(`${target.bookId}|${target.name.trim().toLowerCase()}`, upload.url);
      for (const dest of collapseImportTargets(
        upload.targets.flatMap((target) => {
          const section = sectionOf(target.section);
          return section ? [{ bookId: target.bookId, section, docType: target.docType, name: target.name }] : [];
        }),
        books,
      )) {
        if (dest.bookId != null) urlByName.set(`${dest.bookId}|${dest.name.trim().toLowerCase()}`, upload.url);
      }
    }

    let fetched = 0;
    let left = 0;
    let stoppedEarly = false;
    for (const upload of data.uploads) {
      const targets = upload.targets.flatMap((target) => {
        const section = sectionOf(target.section);
        return section ? [{ bookId: target.bookId, section, docType: target.docType, name: target.name }] : [];
      });
      const collapsed = collapseImportTargets(targets, books);
      const pending: CollapsedImportTarget[] = [];
      for (const dest of collapsed) {
        if (dest.missingBookId != null) {
          await push({ action: "FAIL", reason: `Book #${dest.missingBookId} is not in The Library. will retry`, url: upload.url, bookId: null, fileId: null });
          continue;
        }
        const settledKey = `${upload.url}|${dest.bookId ?? ""}`;
        if (dest.bookId != null && settledUpload.has(settledKey)) continue;
        if (dest.bookId != null && importSkipReason({ name: dest.name, size: -1, section: dest.section, bookId: dest.bookId }, books, files)) {
          await push({
            action: "SKIP",
            reason: "Already on this book with the same name.",
            url: upload.url,
            bookId: dest.bookId,
            fileId: null,
          });
          if (request.apply) settledUpload.add(settledKey);
          continue;
        }
        pending.push(dest);
      }
      if (!pending.length) continue;
      const overTime = !shouldStartDownload(Date.now() - startedAt);
      if (fetched >= limit || overTime) {
        if (overTime && fetched < limit) stoppedEarly = true;
        left += 1;
        continue;
      }
      fetched += 1;
      const pdf = await fetchPdf(upload.url);
      if ("error" in pdf) {
        for (const dest of pending) {
          await push({ action: "FAIL", reason: pdf.error, url: upload.url, bookId: dest.bookId, fileId: null });
          if (request.apply && importFailureSettled(pdf.error)) settledUpload.add(`${upload.url}|${dest.bookId ?? ""}`);
        }
        continue;
      }
      for (const dest of pending) {
        const bookId = dest.bookId;
        const bookTitle = dest.bookTitle;
        if (bookId == null) {
          await push({ action: "FAIL", reason: `No book for "${bookTitle}". will retry`, url: upload.url, bookId: null, fileId: null });
          continue;
        }
        const skip = importSkipReason(
          { name: dest.name, size: pdf.bytes.byteLength, section: dest.section, bookId },
          books,
          files,
        );
        if (skip) {
          await push({ action: "SKIP", reason: skip, url: upload.url, bookId, fileId: null });
          if (request.apply) settledUpload.add(`${upload.url}|${bookId}`);
          continue;
        }
        if (!request.apply) {
          await push({ action: "OK", reason: `Would store "${dest.name}" on ${bookTitle}.`, url: upload.url, bookId, fileId: null });
          continue;
        }
        const stored = await storePdf(sql, context.userId, role.name, dest, bookId, pdf.bytes, upload.fileName);
        if ("error" in stored) {
          const reason = importFailureSettled(stored.error) ? stored.error : `${stored.error} will retry`;
          await push({ action: "FAIL", reason, url: upload.url, bookId, fileId: stored.fileId });
          continue;
        }
        files.push({
          id: stored.fileId,
          name: dest.name,
          docName: upload.fileName,
          size: pdf.bytes.byteLength,
          section: dest.section,
          bookId,
          complete: true,
          mpn: null,
          sourceUrl: upload.url,
        });
        await push({ action: "OK", reason: `Stored "${dest.name}" on ${bookTitle}.`, url: upload.url, bookId, fileId: stored.fileId });
        settledUpload.add(`${upload.url}|${bookId}`);
      }
    }

    for (const row of data.mpns) {
      const mpn = cleanMpn(row.mpn);
      if (!mpn) continue;
      const book = books.find((b) => b.id === row.bookId);
      if (!book) {
        await push({ action: "FAIL", reason: `Book #${row.bookId} is not in The Library.`, url: row.productPage, bookId: row.bookId, fileId: null });
        continue;
      }
      if (isMainChip(book, books)) {
        await push({ action: "SKIP", reason: "Main chip. The MPN was left blank.", url: row.productPage, bookId: book.id, fileId: null }, false);
        continue;
      }
      if (sameMpn(book.mpn, mpn)) {
        await push({ action: "SKIP", reason: "Already this MPN.", url: row.productPage, bookId: book.id, fileId: null }, false);
        continue;
      }
      if ((book.mpn ?? "").trim()) {
        await push({
          action: "CONFLICT",
          reason: `This book has MPN ${book.mpn}. Left unchanged.`,
          url: row.productPage,
          bookId: book.id,
          fileId: null,
        }, !mpnConflictLogged.has(book.id));
        continue;
      }
      const clash = books.find((b) => b.id !== book.id && sameMpn(b.mpn, mpn));
      if (clash) {
        await push({
          action: "CONFLICT",
          reason: `MPN ${mpn} is already on ${clash.title}. Left unchanged.`,
          url: row.productPage,
          bookId: book.id,
          fileId: null,
        }, !mpnConflictLogged.has(book.id));
        continue;
      }
      if (request.apply) {
        try {
          await sql.query("update library_books set mpn = $2 where id = $1 and mpn is null", [book.id, mpn]);
        } catch (err) {
          const message = /unique|duplicate/i.test(String(err)) ? `MPN ${mpn} is already on another model.` : "The MPN could not be saved.";
          await push({ action: "CONFLICT", reason: message, url: row.productPage, bookId: book.id, fileId: null });
          continue;
        }
        book.mpn = mpn;
      } else {
        book.mpn = mpn;
      }
      await push({ action: "OK", reason: request.apply ? `Set MPN to ${mpn}.` : `Would set MPN to ${mpn}.`, url: row.productPage, bookId: book.id, fileId: null });
    }

    for (const book of books) {
      if (!mpnKey(book.mpn) || isMainChip(book, books)) continue;
      for (const file of files) {
        if (!file.complete || file.bookId !== book.id) continue;
        const url = file.sourceUrl || urlByName.get(`${book.id}|${file.name.trim().toLowerCase()}`) || null;
        if (!url) continue;
        if (file.mpn && sameMpn(file.mpn, book.mpn)) continue;
        const problem = tieError({
          bookMpn: book.mpn,
          fileBookId: file.bookId,
          bookId: book.id,
          fileMpn: file.mpn ?? null,
          sourceUrl: url,
        });
        if (problem) {
          await push({ action: "FAIL", reason: problem, url, bookId: book.id, fileId: file.id });
          continue;
        }
        const sourceUrl = cleanSourceUrl(url);
        if (request.apply) {
          await sql.query("update library_files set mpn = $2, source_url = $3 where id = $1", [file.id, book.mpn, sourceUrl]);
          if (file.section === "spec") await sql.query("update library_books set no_official_file = false where id = $1", [book.id]);
          file.mpn = book.mpn;
          file.sourceUrl = sourceUrl;
        }
        await push({
          action: "OK",
          reason: request.apply ? `Tied to MPN ${book.mpn}.` : `Would tie to MPN ${book.mpn}.`,
          url: sourceUrl,
          bookId: book.id,
          fileId: file.id,
        });
      }
    }

    return { applied: request.apply, counts, rows, left, limit, note: stoppedEarly ? IMPORT_TIME_NOTE : null };
  });

export const libraryImportLogCsv = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<string> => {
    const sql = await ready();
    await requireLibraryAdmin(sql, context.userId);
    const rows = await sql.query<{ id: number; run_at: string; url: string | null; book_id: number | null; action: string; reason: string | null; file_id: number | null }>(
      "select id, run_at, url, book_id, action, reason, file_id from library_import_log order by id",
    );
    const lines = ["id,run_at,url,book_id,action,reason,file_id"];
    for (const row of rows) {
      lines.push([row.id, row.run_at, row.url, row.book_id, row.action, row.reason, row.file_id].map(csvCell).join(","));
    }
    return lines.join("\n");
  });
