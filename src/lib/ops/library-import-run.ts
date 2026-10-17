/**
 * Runs one Library import batch. The caller has already checked that the person is an admin.
 * apply=false downloads the batch (so a non-PDF can be reported) and writes nothing.
 */
import { CHUNK_BYTES, isMainChip, mimeFor, type LibrarySection } from "./library-file-rules.ts";
import importData from "./library-import-data.json" with { type: "json" };
import {
  alreadyStored,
  duplicateMarkedName,
  importCounts,
  pdfRejectReason,
  planDuplicateMark,
  planMpn,
  publicRow,
  uniqueStoredName,
  uploadDestinations,
  uploadSlice,
  vendorUrlError,
  type ImportAction,
  type ImportBook,
  type LibraryImportReport,
  type LibraryImportRow,
  type PlannedStore,
  type StoredRef,
} from "./library-import-rules.ts";

export type LibraryImportData = {
  markAsDuplicate: number[];
  uploads: { url: string; fileName: string; targets: { bookId: number; section: string; docType: string | null; name: string }[] }[];
  mpns: { bookId: number; title: string; mpn: string | null; productPage: string | null }[];
};

const DATA = importData as LibraryImportData;

type Sql = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ImportRunOptions = {
  userId: string;
  userName: string;
  apply: boolean;
  limit: number;
  data?: LibraryImportData;
  fetch?: FetchLike;
};

type FileRow = {
  id: number;
  name: string;
  original_name: string | null;
  size: number;
  section: LibrarySection;
  book_id: number | null;
  source_url: string | null;
};

function toBook(row: { id: number; title: string; manufacturer: string | null; mpn: string | null }): ImportBook {
  return { id: Number(row.id), title: row.title, manufacturer: row.manufacturer ?? "", mpn: row.mpn };
}

function toStored(row: FileRow): StoredRef {
  return {
    id: Number(row.id),
    name: row.name,
    originalName: row.original_name,
    size: Number(row.size),
    section: row.section,
    bookId: row.book_id == null ? null : Number(row.book_id),
    sourceUrl: row.source_url,
  };
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function readVendorPdf(url: string, fetchImpl: FetchLike): Promise<{ bytes: Uint8Array } | { error: string }> {
  const problem = vendorUrlError(url);
  if (problem) return { error: problem };
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
      headers: { accept: "application/pdf,*/*", "user-agent": "KatzDesk Library Import" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "the download failed";
    return { error: `Could not download the file (${message}).` };
  }
  if (!response.ok) return { error: `Download returned ${response.status}.` };
  if (response.url && vendorUrlError(response.url)) return { error: "The vendor file redirected away from https." };
  const reader = response.body?.getReader();
  if (!reader) return { error: "The vendor file had no body." };
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      total += step.value.byteLength;
      if (total > 20 * 1024 * 1024) {
        await reader.cancel();
        return { error: "File is over 20 MB." };
      }
      parts.push(step.value);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "the download failed";
    return { error: `Could not download the file (${message}).` };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  const header = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
  const rejected = pdfRejectReason(bytes.byteLength, header);
  if (rejected) return { error: rejected };
  return { bytes };
}

async function ensureChip(sql: Sql, userId: string, books: ImportBook[], dest: PlannedStore): Promise<{ bookId: number; title: string } | { error: string }> {
  if (!dest.createMain) return { bookId: dest.bookId, title: dest.bookTitle };
  const { title, manufacturer } = dest.createMain;
  await sql.query(
    "insert into library_books (title, manufacturer, created_by, per_variation) values ($1, $2, $3, true) on conflict (lower(title)) do nothing",
    [title, manufacturer, userId],
  );
  const rows = await sql.query<{ id: number; title: string; manufacturer: string | null; mpn: string | null }>(
    "select id, title, manufacturer, mpn from library_books where lower(title) = lower($1)",
    [title],
  );
  const made = rows[0];
  if (!made) return { error: `Could not add the main chip ${title}.` };
  const book = toBook(made);
  if (!isMainChip({ ...book, manufacturer: book.manufacturer || manufacturer })) return { error: `${book.title} is not the main chip for ${dest.createMain.family}.` };
  if (!books.some((b) => b.id === book.id)) books.push({ ...book, manufacturer: book.manufacturer || manufacturer });
  return { bookId: book.id, title: book.title };
}

async function storePdf(
  sql: Sql,
  file: { section: LibrarySection; name: string; originalName: string; size: number; bookId: number; docType: string | null; sourceUrl: string },
  bytes: Uint8Array,
  user: { userId: string; userName: string },
): Promise<number> {
  const rows = await sql.query<{ id: number }>(
    `insert into library_files (section, name, original_name, mime, size, token, added_by, added_by_name, book_id, doc_type, source_url, complete)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false) returning id`,
    [file.section, file.name, file.originalName, mimeFor(file.originalName) || "application/pdf", file.size, newToken(), user.userId, user.userName, file.bookId, file.docType, file.sourceUrl],
  );
  const id = Number(rows[0]!.id);
  try {
    for (let seq = 0, offset = 0; offset < bytes.byteLength; seq += 1, offset += CHUNK_BYTES) {
      const slice = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.byteLength));
      await sql.query("insert into library_file_chunks (file_id, seq, data) values ($1, $2, decode($3, 'base64'))", [
        id,
        seq,
        Buffer.from(slice).toString("base64"),
      ]);
    }
    const done = await sql.query<{ id: number }>(
      `update library_files f set complete = true
        where f.id = $1
          and f.size = (select coalesce(sum(octet_length(c.data)), 0) from library_file_chunks c where c.file_id = f.id)
        returning f.id`,
      [id],
    );
    if (!done[0]) throw new Error("The stored file did not match the download.");
    return id;
  } catch (err) {
    await sql.query("delete from library_files where id = $1 and complete = false", [id]);
    throw err;
  }
}

function storedReason(match: StoredRef, books: ImportBook[]) {
  if (match.id < 0) return "Already planned earlier in this batch.";
  const home = books.find((b) => b.id === match.bookId);
  return `Already in the Library as #${match.id}${home ? ` on ${home.title}` : ""}.`;
}

function takenNames(files: StoredRef[], bookId: number, section: LibrarySection) {
  return files.filter((f) => f.bookId === bookId && f.section === section).map((f) => f.name);
}

async function logRow(sql: Sql, row: LibraryImportRow) {
  await sql.query("insert into library_import_log (url, book_id, action, reason, file_id) values ($1, $2, $3, $4, $5)", [
    row.url,
    row.bookId,
    row.action,
    row.reason,
    row.fileId,
  ]);
}

export async function runLibraryImport(sql: Sql, options: ImportRunOptions): Promise<LibraryImportReport> {
  const data = options.data ?? DATA;
  const fetchImpl = options.fetch ?? fetch;
  const books = (await sql.query<{ id: number; title: string; manufacturer: string | null; mpn: string | null }>("select id, title, manufacturer, mpn from library_books")).map(toBook);
  const files = (
    await sql.query<FileRow>(
      "select id, name, original_name, size, section, book_id, source_url from library_files where complete and section <> 'training'",
    )
  ).map(toStored);
  const tied = new Set(
    (await sql.query<{ book_id: number }>("select distinct book_id from library_files where mpn is not null and book_id is not null")).map((r) => Number(r.book_id)),
  );
  const logged = await sql.query<{ url: string | null; action: ImportAction }>("select url, action from library_import_log");
  const byFile = new Map(files.map((f) => [f.id, f]));
  const rows: LibraryImportRow[] = [];

  for (const fileId of data.markAsDuplicate) {
    const file = byFile.get(fileId);
    const plan = planDuplicateMark(fileId, file, books, files);
    if (options.apply && plan.action === "OK" && file) {
      const next = duplicateMarkedName(file.name);
      const renamed = await sql.query<{ id: number }>("update library_files set name = $2 where id = $1 and name not like '%Duplicate To Delete%' returning id", [fileId, next]);
      if (!renamed[0]) {
        rows.push({ ...plan, action: "SKIP", reason: "Already marked Duplicate To Delete." });
      } else {
        file.name = next;
        rows.push(plan);
      }
    } else {
      rows.push(plan);
    }
  }

  for (const mpn of data.mpns) {
    const book = books.find((b) => b.id === mpn.bookId);
    const plan = planMpn(mpn, book, books, tied);
    if (options.apply && plan.action === "OK" && plan.mpn && book) {
      try {
        await sql.query("update library_books set mpn = $2 where id = $1", [book.id, plan.mpn]);
        book.mpn = plan.mpn;
        rows.push(publicRow(plan));
      } catch (err) {
        const message = /unique|duplicate/i.test(String(err)) ? `MPN ${plan.mpn} is already on another model.` : "The MPN could not be saved.";
        rows.push({ kind: "mpn", action: "CONFLICT", reason: message, url: null, bookId: book.id, fileId: null });
      }
    } else {
      rows.push(publicRow(plan));
    }
  }

  const batch = uploadSlice(data.uploads, logged, options.limit);
  for (const upload of batch) {
    const urlError = vendorUrlError(upload.url);
    if (urlError) {
      rows.push({ kind: "upload", action: "FAIL", reason: urlError, url: upload.url, bookId: null, fileId: null });
      continue;
    }
    const dests = uploadDestinations(upload.fileName, upload.targets, books);
    const stores = dests.filter((d): d is PlannedStore => d.kind === "store");
    for (const dest of dests) {
      if (dest.kind === "conflict") rows.push({ kind: "upload", action: "CONFLICT", reason: dest.reason, url: upload.url, bookId: dest.bookId, fileId: null });
    }
    if (!stores.length) continue;

    const ready: { dest: PlannedStore; existing: StoredRef | null }[] = [];
    let needsBytes = false;
    for (const dest of stores) {
      const lookupId = dest.createMain ? dest.anchorBookId : dest.bookId;
      const existing = alreadyStored(upload.url, upload.fileName, { bookId: lookupId, section: dest.section }, null, books, files);
      if (existing?.sourceUrl === upload.url) {
        rows.push({
          kind: "upload",
          action: "SKIP",
          reason: storedReason(existing, books),
          url: upload.url,
          bookId: existing.bookId,
          fileId: existing.id > 0 ? existing.id : null,
        });
      } else {
        needsBytes = true;
        ready.push({ dest, existing });
      }
    }
    if (!needsBytes) continue;

    const downloaded = await readVendorPdf(upload.url, fetchImpl);
    if ("error" in downloaded) {
      for (const item of ready) {
        rows.push({ kind: "upload", action: "FAIL", reason: downloaded.error, url: upload.url, bookId: item.dest.bookId || item.dest.anchorBookId, fileId: null });
      }
      continue;
    }

    for (const item of ready) {
      const lookupId = item.dest.createMain ? item.dest.anchorBookId : item.dest.bookId;
      const match = alreadyStored(upload.url, upload.fileName, { bookId: lookupId, section: item.dest.section }, downloaded.bytes.byteLength, books, files);
      if (match) {
        rows.push({
          kind: "upload",
          action: "SKIP",
          reason: storedReason(match, books),
          url: upload.url,
          bookId: match.bookId,
          fileId: match.id > 0 ? match.id : null,
        });
        continue;
      }
      if (!options.apply) {
        const creating = item.dest.createMain ? `Add main chip ${item.dest.createMain.title} and store the file there.` : `Store on ${item.dest.bookTitle}.`;
        rows.push({ kind: "upload", action: "OK", reason: creating, url: upload.url, bookId: item.dest.createMain ? null : item.dest.bookId, fileId: null });
        files.push({
          id: -files.length - 1,
          name: item.dest.name,
          originalName: upload.fileName,
          size: downloaded.bytes.byteLength,
          section: item.dest.section,
          bookId: item.dest.createMain ? item.dest.anchorBookId : item.dest.bookId,
          sourceUrl: upload.url,
        });
        continue;
      }
      let chip: { bookId: number; title: string };
      try {
        const ensured = await ensureChip(sql, options.userId, books, item.dest);
        if ("error" in ensured) {
          rows.push({ kind: "upload", action: "FAIL", reason: ensured.error, url: upload.url, bookId: item.dest.anchorBookId, fileId: null });
          continue;
        }
        chip = ensured;
      } catch (err) {
        const message = err instanceof Error ? err.message : "The main chip could not be added.";
        rows.push({ kind: "upload", action: "FAIL", reason: message, url: upload.url, bookId: item.dest.anchorBookId, fileId: null });
        continue;
      }
      const name = uniqueStoredName(item.dest.name, takenNames(files, chip.bookId, item.dest.section));
      try {
        const fileId = await storePdf(
          sql,
          {
            section: item.dest.section,
            name,
            originalName: upload.fileName,
            size: downloaded.bytes.byteLength,
            bookId: chip.bookId,
            docType: item.dest.docType,
            sourceUrl: upload.url,
          },
          downloaded.bytes,
          options,
        );
        files.push({
          id: fileId,
          name,
          originalName: upload.fileName,
          size: downloaded.bytes.byteLength,
          section: item.dest.section,
          bookId: chip.bookId,
          sourceUrl: upload.url,
        });
        const created = item.dest.createMain ? `Added ${chip.title} and stored the file there.` : `Stored on ${chip.title}.`;
        rows.push({ kind: "upload", action: "OK", reason: created, url: upload.url, bookId: chip.bookId, fileId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "The file could not be stored.";
        rows.push({ kind: "upload", action: "FAIL", reason: message, url: upload.url, bookId: chip.bookId, fileId: null });
      }
    }
  }

  if (options.apply) {
    for (const row of rows) await logRow(sql, row);
  }
  return { applied: options.apply, limit: options.limit, counts: importCounts(rows), rows: rows.map(publicRow) };
}
