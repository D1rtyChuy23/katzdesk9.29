/**
 * The Library — read stored spec sheets and PDF manuals in a queue, then wait for approval.
 * Nothing is written onto a model until someone approves it, and a read never writes a file's page text.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { copiesToVariations, isMainChip, mainChipFor, modelLabel, shouldStartDownload, type LibrarySection } from "@/lib/ops/library-file-rules";
import { cleanMpn, sameMpn } from "@/lib/ops/mpn-rules";
import { extractSpecFromText } from "@/lib/ops/spec-library";
import { emptyDraft, type Kv, type Requirements, type SpecSheetDraft } from "@/lib/ops/spec-schema";
import {
  READ_BATCH,
  applySpecPicks,
  blankSpecValues,
  diffSpec,
  isExact,
  outletForModel,
  outletFromConfigs,
  pickSpecPages,
  textChars,
  valuesFromDraft,
  valuesFromParts,
  type DocPage,
  type FieldChange,
  type FieldPick,
  type SpecFieldKey,
  type SpecOutlet,
  type SpecValues,
} from "@/lib/ops/spec-read";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireAdmin(sql: Sql, userId: string) {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null }>(
    "select is_admin, desk_role from desk_accounts where user_id = $1",
    [userId],
  );
  const isAdmin = flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin";
  if (!isAdmin) throw new Error("Only an admin can do that in The Library.");
}

const asJson = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

const changeList = z.array(
  z.object({
    key: z.string(),
    label: z.string(),
    oldValue: z.string(),
    newValue: z.string(),
    kind: z.enum(["fill", "same", "conflict"]),
  }),
);

export type SpecReadRow = {
  fileId: number;
  bookId: number | null;
  bookTitle: string;
  fileName: string;
  /** A spec sheet, or a manual read for its specs. */
  section: "spec" | "manuals";
  status: "queued" | "needs_review" | "read" | "unreadable";
  error: string | null;
  changes: FieldChange[];
  exact: boolean;
};

export type SpecReadBoard = {
  rows: SpecReadRow[];
  queued: number;
  noSheet: { id: number; title: string }[];
};

function asChanges(raw: unknown): FieldChange[] {
  const parsed = changeList.safeParse(asJson(raw) ?? []);
  if (!parsed.success) return [];
  return parsed.data.flatMap((row) => {
    const key = row.key as SpecFieldKey;
    if (!["voltage", "amps", "phase", "plug", "waterInlet", "drain", "height", "width", "depth", "weight", "tank", "brew", "mpn"].includes(key)) return [];
    return [{ ...row, key }];
  });
}

/** Every read, on the model its file is on now, so a moved sheet's tile follows it. */
export async function specReadRows(sql: Sql) {
  return sql.query<{
    file_id: number;
    book_id: number | null;
    status: SpecReadRow["status"];
    error: string | null;
    changes: unknown;
    book_title: string | null;
    file_name: string | null;
    section: string | null;
  }>(
    `select r.file_id, f.book_id, r.status, r.error, r.changes, b.title as book_title, f.name as file_name, f.section
       from spec_reads r
       left join library_files f on f.id = r.file_id
       left join library_books b on b.id = f.book_id
      order by lower(coalesce(b.title, '')), r.file_id`,
  );
}

/** Models with no spec PDF and no sheet tied to them (a hand-entered sheet counts). */
export async function noSheetBooks(sql: Sql): Promise<{ id: number; title: string }[]> {
  const books = await sql.query<{ id: number; title: string }>(
    `select b.id, b.title from library_books b
      where not exists (
        select 1 from library_files f where f.book_id = b.id and f.section = 'spec' and f.complete
      )
        and not exists (select 1 from spec_sheets s where s.book_id = b.id)
      order by lower(b.title)`,
  );
  return books.map((b) => ({ id: Number(b.id), title: b.title }));
}

export const listSpecReads = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<SpecReadBoard> => {
    const sql = await ready();
    const reads = await specReadRows(sql);
    const rows: SpecReadRow[] = reads.map((r) => {
      const changes = asChanges(r.changes);
      return {
        fileId: Number(r.file_id),
        bookId: r.book_id == null ? null : Number(r.book_id),
        bookTitle: r.book_title ?? "Unknown model",
        fileName: r.file_name ?? "Spec sheet",
        section: r.section === "manuals" ? "manuals" : "spec",
        status: r.status,
        error: r.error,
        changes,
        exact: isExact(changes),
      };
    });
    return {
      rows,
      queued: rows.filter((r) => r.status === "queued").length,
      noSheet: await noSheetBooks(sql),
    };
  });

/** Status per stored spec file, for the model tiles. */
export const listSpecReadStatus = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<{ fileId: number; bookId: number | null; status: string }[]> => {
    const sql = await ready();
    const rows = await specReadRows(sql);
    return rows.map((r) => ({ fileId: Number(r.file_id), bookId: r.book_id == null ? null : Number(r.book_id), status: r.status }));
  });

const runInput = z.object({
  fileIds: z.array(z.number().int().positive()).max(40).optional(),
  limit: z.number().int().min(1).max(READ_BATCH).optional(),
});

export type SpecRunReport = {
  read: number;
  review: number;
  unreadable: number;
  left: number;
  note: string | null;
  /** What each file read in this run came to, and why one is unreadable. */
  outcomes?: ReadOutcome[];
};

type Query = Pick<Sql, "query">;

/** A file's text for a read: the pages it sends the AI, or why there is none. */
export type FileTextResult =
  | { ok: true; text: string; pages: number; used: number[]; from: "stored" | "pdf" | "ocr" }
  | { ok: false; error: string };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").trim().slice(0, 300) || "unknown error";

/** The stored bytes of a file, in order. */
async function fileBytes(sql: Query, fileId: number): Promise<Uint8Array> {
  const chunks = await sql.query<{ data: unknown }>("select data from library_file_chunks where file_id = $1 order by seq", [fileId]);
  const parts = chunks.map((c) => asBytes(c.data)).filter((p) => p.length);
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

/**
 * A file's text for a read: Troubleshoot's page text when it has read the whole file, otherwise every page of the PDF
 * itself. A long file sends the pages most likely to hold specifications (pickSpecPages). Nothing is written back:
 * library_file_text and text_pages belong to Troubleshoot.
 */
export async function fileText(sql: Query, fileId: number): Promise<FileTextResult> {
  const file = (await sql.query<{ text_pages: number | null }>("select text_pages from library_files where id = $1", [fileId]))[0];
  if (Number(file?.text_pages) > 0) {
    const stored = await sql.query<{ page: number; body: string }>("select page, body from library_file_text where file_id = $1 order by page", [fileId]);
    const pages: DocPage[] = stored.map((p) => ({ page: Number(p.page), text: p.body }));
    if (textChars(pages) >= 40) {
      const pick = pickSpecPages(pages);
      return { ok: true, text: pick.text, pages: pick.total, used: pick.used, from: "stored" };
    }
  }
  const bytes = await fileBytes(sql, fileId);
  if (!bytes.length) return { ok: false, error: "Couldn't open the PDF: the file has no stored data." };
  const { ocrPdfPages, pdfPages } = await import("@/lib/ops/spec-pdf.server");
  let read: { totalPages: number; pages: string[] };
  try {
    read = await pdfPages(bytes);
  } catch (e) {
    return { ok: false, error: `Couldn't open the PDF: ${errText(e)}` };
  }
  let pages: DocPage[] = read.pages.map((text, i) => ({ page: i + 1, text }));
  let from: "pdf" | "ocr" = "pdf";
  if (textChars(pages) < 40) {
    // TODO(OCR): ocrPdfPages is the hook for scanned files; it returns null until OCR is built.
    const ocr = await ocrPdfPages(bytes);
    const ocrPages = (ocr ?? []).map((text, i) => ({ page: i + 1, text }));
    if (textChars(ocrPages) < 40) {
      const n = read.totalPages;
      return { ok: false, error: `No text layer (scanned): the PDF opened (${n} page${n === 1 ? "" : "s"}) but has under 40 characters of text.` };
    }
    pages = ocrPages;
    from = "ocr";
  }
  const pick = pickSpecPages(pages);
  return { ok: true, text: pick.text, pages: pick.total, used: pick.used, from };
}

function asBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (typeof data === "string") {
    const hex = data.startsWith("\\x") ? data.slice(2) : data;
    if (/^[0-9a-fA-F]*$/.test(hex) && hex.length % 2 === 0 && hex.length > 16) {
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
  }
  return new Uint8Array();
}

/** The files a read takes: spec sheets, and manuals that are PDFs (10/28: manuals are read for their specs too). */
export const READABLE_FILES = `(f.section = 'spec' or (f.section = 'manuals' and f.mime = 'application/pdf'))`;

export async function queueFiles(sql: Query, fileIds: number[] | null, force: boolean) {
  if (fileIds && !fileIds.length) return;
  const params: unknown[] = [];
  const only = fileIds ? `and f.id = any($1::int[])` : "";
  if (fileIds) params.push(fileIds);
  await sql.query(
    `insert into spec_reads (file_id, book_id, status)
     select f.id, f.book_id, 'queued'
       from library_files f
      where f.complete and ${READABLE_FILES} and f.book_id is not null ${only}
     on conflict (file_id) do update
       set book_id = excluded.book_id,
           status = 'queued',
           error = null,
           updated_at = now()
     where ${force ? "true" : "spec_reads.status = 'queued'"}`,
    params,
  );
}

/** The queued sheets a run reads: only the ones asked for when fileIds is set. */
export async function queuedSheets(sql: Query, fileIds: number[] | null) {
  return sql.query<{ file_id: number; book_id: number; name: string; section: string }>(
    `select r.file_id, r.book_id, f.name, f.section
       from spec_reads r
       join library_files f on f.id = r.file_id
      where r.status = 'queued' ${fileIds ? "and r.file_id = any($1::int[])" : ""}
      order by r.file_id
      limit 40`,
    fileIds ? [fileIds] : [],
  );
}

/** What one read did with a file. */
export type ReadOutcome = { fileId: number; name: string; status: "needs_review" | "unreadable"; error: string | null };

/**
 * Read one queued file and store what it found: needs_review with the changes against its model, or unreadable with
 * why (the PDF wouldn't open, it has no text layer, the AI read failed, or no spec field was found).
 */
export async function readOneFile(
  sql: Sql,
  apiKey: string,
  row: { file_id: number; book_id: number; name: string; section: string },
): Promise<ReadOutcome> {
  const fileId = Number(row.file_id);
  const unreadable = async (error: string, extracted: SpecValues | null = null): Promise<ReadOutcome> => {
    await sql.query(
      "update spec_reads set status = 'unreadable', error = $2, changes = '[]'::jsonb, extracted = $3::jsonb, updated_at = now() where file_id = $1",
      [fileId, error, extracted ? JSON.stringify(extracted) : null],
    );
    return { fileId, name: row.name, status: "unreadable", error };
  };
  const text = await fileText(sql, fileId);
  if (!text.ok) return unreadable(text.error);
  const result = await extractSpecFromText(apiKey, text.text, row.name, row.section === "manuals" ? "manual" : "spec");
  if (!result.ok) return unreadable(`AI read failed: ${result.detail ?? result.message}`);
  const book = (
    await sql.query<{ title: string; manufacturer: string | null; mpn: string | null }>("select title, manufacturer, mpn from library_books where id = $1", [
      row.book_id,
    ])
  )[0];
  const current = await currentValues(sql, { id: Number(row.book_id), title: book?.title ?? "", manufacturer: book?.manufacturer ?? null }, book?.mpn ?? "");
  const extracted = valuesFromDraft(result.draft, null);
  // The model's MPN is not inside the draft. Compare it on its own.
  extracted.mpn = extracted.mpn || guessMpn(result.draft);
  const changes = diffSpec({ ...current, mpn: book?.mpn ?? "" }, extracted);
  if (!changes.length) return unreadable("The file was read, but none of the spec fields were found.", extracted);
  await sql.query(
    "update spec_reads set status = 'needs_review', error = null, changes = $2::jsonb, extracted = $3::jsonb, updated_at = now() where file_id = $1",
    [fileId, JSON.stringify(changes), JSON.stringify(extracted)],
  );
  return { fileId, name: row.name, status: "needs_review", error: null };
}

/** Read the queued files given, up to `limit` and the run's time limit. */
async function readQueued(
  sql: Sql,
  apiKey: string,
  queued: { file_id: number; book_id: number; name: string; section: string }[],
  limit: number,
): Promise<{ read: number; review: number; unreadable: number; note: string | null; outcomes: ReadOutcome[] }> {
  const started = Date.now();
  let read = 0;
  let note: string | null = null;
  const outcomes: ReadOutcome[] = [];
  for (const row of queued) {
    if (read >= limit) {
      note = `Read ${limit}. Tap Read next ${READ_BATCH} for the rest.`;
      break;
    }
    if (!shouldStartDownload(Date.now() - started)) {
      note = `Stopped early to stay under the time limit. Tap Read next ${READ_BATCH}.`;
      break;
    }
    read += 1;
    try {
      outcomes.push(await readOneFile(sql, apiKey, row));
    } catch (e) {
      // Something other than the file failed (the database, say): the file stays queued for the next run.
      note = `Stopped at ${row.name}: ${errText(e)}`;
      read -= 1;
      break;
    }
  }
  const review = outcomes.filter((o) => o.status === "needs_review").length;
  return { read, review, unreadable: outcomes.length - review, note, outcomes };
}

/**
 * Queue stored spec sheets (and PDF manuals) and read up to 15 of them. Already-read and unreadable
 * files are left alone unless fileIds is set (a sheet someone just added, Read Specs, or Tie
 * and read); then only those files are read.
 */
export const runSpecReads = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof runInput>) => runInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SpecRunReport> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("AI reading isn't available here yet.");
    await queueFiles(sql, data.fileIds ?? null, !!data.fileIds);
    const queued = await queuedSheets(sql, data.fileIds ?? null);
    const run = await readQueued(sql, apiKey, queued, data.limit ?? READ_BATCH);
    const leftRow = await sql.query<{ n: number }>("select count(*)::int as n from spec_reads where status = 'queued'");
    return { read: run.read, review: run.review, unreadable: run.unreadable, left: leftRow[0]?.n ?? 0, note: run.note, outcomes: run.outcomes };
  });

// ---------------- Re-read spec sheets & manuals (Admin) ----------------

export const REREAD_STATUSES = ["unreadable", "never", "needs_review", "read"] as const;
export type RereadStatus = (typeof REREAD_STATUSES)[number];
export type RereadSection = "spec" | "manuals";

export type RereadCounts = Record<RereadSection, Record<RereadStatus, number>>;

const STATUS_SQL = `case when r.status is null or r.status = 'queued' then 'never' else r.status end`;

/** How many spec sheets and PDF manuals on models there are, by where their read stands: none yet, unreadable, waiting for review, read. */
export async function rereadCounts(sql: Query): Promise<RereadCounts> {
  const rows = await sql.query<{ section: string; status: string; n: number }>(
    `select f.section, ${STATUS_SQL} as status, count(*)::int as n
       from library_files f left join spec_reads r on r.file_id = f.id
      where f.complete and f.book_id is not null and ${READABLE_FILES}
      group by 1, 2`,
  );
  const zero = () => Object.fromEntries(REREAD_STATUSES.map((s) => [s, 0])) as Record<RereadStatus, number>;
  const out: RereadCounts = { spec: zero(), manuals: zero() };
  for (const r of rows) {
    const section = r.section === "manuals" ? "manuals" : "spec";
    if ((REREAD_STATUSES as readonly string[]).includes(r.status)) out[section][r.status as RereadStatus] += Number(r.n);
  }
  return out;
}

/** Put the chosen files back in the queue (whatever their read said) and return them, in the order a run reads them. */
export async function queueRereads(sql: Query, statuses: RereadStatus[], sections: RereadSection[]): Promise<number[]> {
  if (!statuses.length || !sections.length) return [];
  const rows = await sql.query<{ id: number }>(
    `select f.id from library_files f left join spec_reads r on r.file_id = f.id
      where f.complete and f.book_id is not null and ${READABLE_FILES}
        and f.section = any($1::text[]) and ${STATUS_SQL} = any($2::text[])
      order by f.id`,
    [sections, statuses],
  );
  const ids = rows.map((r) => Number(r.id));
  await queueFiles(sql, ids, true);
  return ids;
}

const rereadInput = z.object({
  statuses: z.array(z.enum(REREAD_STATUSES)).min(1).max(REREAD_STATUSES.length),
  sections: z.array(z.enum(["spec", "manuals"])).min(1).max(2),
});

export const getRereadCounts = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<RereadCounts> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    return rereadCounts(sql);
  });

/** Queue the files to re-read. Run again, it queues them again: nothing is written onto a model until Approve. */
export const startSpecRereads = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof rereadInput>) => rereadInput.parse(d))
  .handler(async ({ data, context }): Promise<{ fileIds: number[] }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    if (!process.env.XAI_API_KEY) throw new Error("AI reading isn't available here yet.");
    return { fileIds: await queueRereads(sql, data.statuses, data.sections) };
  });

const batchInput = z.object({ fileIds: z.array(z.number().int().positive()).min(1).max(20_000) });

export type RereadBatch = SpecRunReport & { outcomes: ReadOutcome[] };

/** Read the next batch of 15 among the queued files of a re-read; `left` is how many of them are still queued. */
export const runSpecRereadBatch = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof batchInput>) => batchInput.parse(d))
  .handler(async ({ data, context }): Promise<RereadBatch> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("AI reading isn't available here yet.");
    return rereadBatch(sql, apiKey, data.fileIds);
  });

export async function rereadBatch(sql: Sql, apiKey: string, fileIds: number[]): Promise<RereadBatch> {
  const queued = await queuedSheets(sql, fileIds);
  const run = await readQueued(sql, apiKey, queued, READ_BATCH);
  const left = await sql.query<{ n: number }>("select count(*)::int as n from spec_reads where status = 'queued' and file_id = any($1::int[])", [fileIds]);
  return { read: run.read, review: run.review, unreadable: run.unreadable, left: left[0]?.n ?? 0, note: run.note, outcomes: run.outcomes };
}

function guessMpn(draft: SpecSheetDraft): string {
  return valuesFromDraft(draft).mpn;
}

type BookRef = { id: number; title: string; manufacturer: string | null };
type SheetRow = { id: number; specs: unknown; manufacturer: string; model: string; book_id: number | null };

/**
 * The model's spec sheet: the one tied to it, else an untied sheet with the same maker and model.
 * A sheet under that maker and model that belongs to another model comes back too, so the caller can refuse.
 */
async function sheetForBook(sql: Sql, book: BookRef): Promise<SheetRow | undefined> {
  const manufacturer = (book.manufacturer ?? "").trim();
  const model = manufacturer ? modelLabel(book.title, manufacturer) : "";
  return (
    await sql.query<SheetRow>(
      `select id, specs, manufacturer, model, book_id
         from spec_sheets
        where book_id = $1 or (lower(manufacturer) = lower($2) and lower(model) = lower($3))
        order by case when book_id = $1 then 0 when book_id is null then 1 else 2 end, id
        limit 1`,
      [book.id, manufacturer, model],
    )
  )[0];
}

async function currentValues(sql: Sql, book: BookRef, mpn: string): Promise<SpecValues> {
  const found = await sheetForBook(sql, book);
  const sheet = found && (found.book_id == null || found.book_id === book.id) ? found : undefined;
  if (!sheet) return { ...blankSpecValues(), mpn };
  const configs = await sql.query<{ requirements: unknown }>("select requirements from spec_configs where sheet_id = $1 order by position", [sheet.id]);
  const specs = asJson(sheet.specs);
  return valuesFromParts({
    requirements: (asJson(configs[0]?.requirements) ?? {}) as Requirements,
    specs: Array.isArray(specs) ? (specs as Kv[]) : [],
    mpn,
    // The same blanks filled from the other configurations as the read's draft gets.
    others: configs.slice(1).map((c) => (asJson(c.requirements) ?? {}) as Requirements),
  });
}

const approveInput = z.object({
  fileId: z.number().int().positive(),
  useNew: z.array(z.string()).max(20).optional(),
});

export async function approveOne(sql: Sql, fileId: number, useNew: string[]): Promise<{ title: string }> {
  const row = (
    await sql.query<{ book_id: number | null; read_book_id: number | null; status: string; extracted: unknown }>(
      `select f.book_id, r.book_id as read_book_id, r.status, r.extracted
         from spec_reads r
         join library_files f on f.id = r.file_id
        where r.file_id = $1`,
      [fileId],
    )
  )[0];
  if (!row || row.status !== "needs_review") throw new Error("That sheet is not waiting for review.");
  if (row.book_id == null) throw new Error("That spec sheet is not on a model.");
  // The read compared the sheet with the model it was on then. Moved since, it has to be read again.
  if (Number(row.book_id) !== Number(row.read_book_id)) throw new Error("This sheet was moved to another model. Read it again.");
  const book = (
    await sql.query<{ id: number; title: string; manufacturer: string | null; mpn: string | null }>(
      "select id, title, manufacturer, mpn from library_books where id = $1",
      [row.book_id],
    )
  )[0];
  if (!book) throw new Error("That model is no longer in The Library.");
  const extracted = { ...blankSpecValues(), ...(asJson(row.extracted) as Partial<SpecValues>) };
  const picks: Partial<Record<SpecFieldKey, FieldPick>> = {};
  for (const key of useNew) picks[key as SpecFieldKey] = "new";
  await writeApproved(sql, book, extracted, picks);
  await sql.query(
    "update spec_reads set status = 'read', resolved_at = now(), updated_at = now() where file_id = $1",
    [fileId],
  );
  await sql.query(
    `insert into library_admin_done (section, item_key, label, detail, resolved_at)
     values ('spec-review', $1, $2, 'Approved', now())
     on conflict (section, item_key) do update set label = excluded.label, detail = excluded.detail, resolved_at = now()`,
    [`file:${fileId}`, book.title],
  );
  return { title: book.title };
}

/**
 * Specs typed by hand for a sheet the reader couldn't read: close its Spec Review row, the way an approve does.
 * Only once its model has a tied sheet. False when nothing was closed.
 */
export async function resolveHandEntry(sql: Sql, fileId: number): Promise<boolean> {
  const rows = await sql.query<{ file_id: number }>(
    `with r as (
       update spec_reads r set status = 'read', resolved_at = now(), updated_at = now()
         from library_files f
        where r.file_id = $1 and f.id = r.file_id and r.status = 'unreadable'
          and exists (select 1 from spec_sheets s where s.book_id = f.book_id)
       returning r.file_id, f.book_id, f.name
     ), done as (
       insert into library_admin_done (section, item_key, label, detail, resolved_at)
       select 'spec-review', 'file:' || r.file_id, coalesce(b.title, r.name), 'Entered by hand', now()
         from r left join library_books b on b.id = r.book_id
       on conflict (section, item_key) do update set label = excluded.label, detail = excluded.detail, resolved_at = now()
     )
     select file_id from r`,
    [fileId],
  );
  return rows.length > 0;
}

export const resolveSpecHandEntry = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { fileId: number }) => z.object({ fileId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ resolved: boolean }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    return { resolved: await resolveHandEntry(sql, data.fileId) };
  });

export const approveSpecRead = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof approveInput>) => approveInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    const saved = await approveOne(sql, data.fileId, data.useNew ?? []);
    return { ok: true as const, title: saved.title };
  });

/** Approve every review that only fills blanks or matches what's already saved. */
export const approveExactSpecReads = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ approved: number; skipped: string[] }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    return approveExact(sql);
  });

/** Approve each exact review. One that is refused (moved, tied elsewhere, MPN taken) is skipped and named, and the rest still go. */
export async function approveExact(sql: Sql): Promise<{ approved: number; skipped: string[] }> {
  const rows = await sql.query<{ file_id: number; changes: unknown; name: string }>(
    "select r.file_id, r.changes, f.name from spec_reads r join library_files f on f.id = r.file_id where r.status = 'needs_review' order by r.file_id",
  );
  let approved = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    if (!isExact(asChanges(row.changes))) continue;
    try {
      await approveOne(sql, Number(row.file_id), []);
      approved += 1;
    } catch (e) {
      skipped.push(`${row.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { approved, skipped };
}

/**
 * Copy the model's MPN onto an untied spec sheet, then queue it to read. A PDF manual is only queued: a manual with an
 * MPN stops being shared with the family's other variations, so its MPN is left alone.
 */
export const tieAndReadSpec = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { fileId: number }) => z.object({ fileId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    await tieAndQueue(sql, data.fileId);
    return { ok: true };
  });

export async function tieAndQueue(sql: Query, fileId: number): Promise<void> {
  const file = (
    await sql.query<{ book_id: number | null; mpn: string | null; section: string; mime: string }>(
      "select book_id, mpn, section, mime from library_files where id = $1 and complete",
      [fileId],
    )
  )[0];
  const manual = file?.section === "manuals" && file.mime === "application/pdf";
  if (!file || (file.section !== "spec" && !manual) || file.book_id == null) throw new Error("That spec sheet is not on a model.");
  if (file.section === "spec") {
    const book = (await sql.query<{ mpn: string | null }>("select mpn from library_books where id = $1", [file.book_id]))[0];
    if (!book?.mpn) throw new Error("Set this model's MPN first.");
    if (!file.mpn) await sql.query("update library_files set mpn = $2 where id = $1", [fileId, book.mpn]);
  }
  await queueFiles(sql, [fileId], true);
}

async function writeApproved(
  sql: Sql,
  book: { id: number; title: string; manufacturer: string | null; mpn: string | null },
  extracted: SpecValues,
  picks: Partial<Record<SpecFieldKey, FieldPick>>,
) {
  const manufacturer = (book.manufacturer ?? "").trim();
  const model = modelLabel(book.title, manufacturer);
  if (!manufacturer || !model) throw new Error(`${book.title} has no manufacturer, so the specs can't be saved on it.`);
  const existing = await sheetForBook(sql, book);
  if (existing && existing.book_id != null && existing.book_id !== book.id) {
    throw new Error(`${existing.manufacturer} ${existing.model} already has a spec sheet on another model. Tie it first.`);
  }
  const config = existing
    ? (
        await sql.query<{ id: number; label: string; requirements: unknown }>(
          "select id, label, requirements from spec_configs where sheet_id = $1 order by position limit 1",
          [existing.id],
        )
      )[0]
    : undefined;
  const specs = asJson(existing?.specs);
  const draft: SpecSheetDraft = {
    ...emptyDraft(),
    manufacturer: existing?.manufacturer ?? manufacturer,
    model: existing?.model ?? model,
    specs: Array.isArray(specs) ? (specs as Kv[]) : [],
    configs: [
      {
        label: config?.label || "Standard",
        requirements: ((asJson(config?.requirements) ?? {}) as Requirements),
      },
    ],
  };
  const applied = applySpecPicks(draft, extracted, book.mpn ?? "", picks);
  const requirements = JSON.stringify(applied.draft.configs[0]!.requirements ?? {});
  const specJson = JSON.stringify(applied.draft.specs);
  const cleaned = cleanMpn(applied.mpn);
  const newMpn = cleaned && cleaned !== (book.mpn ?? "") ? cleaned : null;
  if (newMpn) {
    // Same match as library_books_mpn_uidx, checked before anything is written.
    const taken = await sql.query<{ id: number }>(
      `select id from library_books
        where id <> $2 and mpn is not null and btrim(mpn) <> ''
          and upper(regexp_replace(mpn, '[^A-Za-z0-9]+', '', 'g')) = upper(regexp_replace($1, '[^A-Za-z0-9]+', '', 'g'))
        limit 1`,
      [newMpn, book.id],
    );
    if (taken[0]) throw new Error(`MPN ${newMpn} is already on another model. Nothing was saved.`);
    // The same rule as setBookMpn: a file tied to the current MPN would point at a number no model has.
    if (!sameMpn(book.mpn, newMpn)) {
      const tied = await sql.query("select 1 from library_files where book_id = $1 and mpn is not null limit 1", [book.id]);
      if (tied.length) throw new Error("Files here are tied to the current MPN. Untie them before changing it.");
    }
  }
  if (existing && config) {
    await sql.query("update spec_sheets set specs = $2::jsonb, book_id = $3, updated_at = now() where id = $1", [
      existing.id,
      specJson,
      book.id,
    ]);
    await sql.query("update spec_configs set requirements = $2::jsonb where id = $1", [config.id, requirements]);
  } else if (existing) {
    await sql.query("update spec_sheets set specs = $2::jsonb, book_id = $3, updated_at = now() where id = $1", [
      existing.id,
      specJson,
      book.id,
    ]);
    await sql.query(
      "insert into spec_configs (sheet_id, label, position, requirements) values ($1, 'Standard', 0, $2::jsonb)",
      [existing.id, requirements],
    );
  } else {
    const inserted = await sql.query<{ id: number }>(
      `insert into spec_sheets (manufacturer, model, specs, mfr_notes, created_by, book_id)
       values ($1, $2, $3::jsonb, '{}'::jsonb, 'Spec read', $4)
       on conflict (manufacturer, model) do nothing
       returning id`,
      [manufacturer, model, specJson, book.id],
    );
    const id = inserted[0]?.id;
    if (!id) throw new Error(`A spec sheet for ${manufacturer} ${model} was just added. Try again.`);
    const has = await sql.query<{ id: number }>("select id from spec_configs where sheet_id = $1 order by position limit 1", [id]);
    if (has[0]) await sql.query("update spec_configs set requirements = $2::jsonb where id = $1", [has[0].id, requirements]);
    else await sql.query("insert into spec_configs (sheet_id, label, position, requirements) values ($1, 'Standard', 0, $2::jsonb)", [id, requirements]);
  }
  if (newMpn) {
    try {
      await sql.query("update library_books set mpn = $2 where id = $1", [book.id, newMpn]);
    } catch (e) {
      if (/unique|duplicate/i.test(String(e))) throw new Error(`MPN ${newMpn} is already on another model. It was not changed.`);
      throw e;
    }
  }
}

export const listSpecOutlets = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<SpecOutlet[]> => {
    const sql = await ready();
    return loadSpecOutlets(sql);
  });

export async function loadSpecOutlets(sql: Sql): Promise<SpecOutlet[]> {
  const rows = await sql.query<{
    id: number;
    manufacturer: string;
    model: string;
    book_title: string | null;
    book_mfr: string | null;
    mpn: string | null;
    requirements: unknown;
    specs: unknown;
  }>(
    `select s.id, s.manufacturer, s.model, b.title as book_title, b.manufacturer as book_mfr, b.mpn, c.requirements, s.specs
       from spec_sheets s
       left join library_books b on b.id = s.book_id
       left join spec_configs c on c.sheet_id = s.id
      order by s.id, c.position`,
  );
  const groups = new Map<number, typeof rows>();
  for (const row of rows) {
    const id = Number(row.id);
    const list = groups.get(id) ?? [];
    list.push(row);
    groups.set(id, list);
  }
  const out: SpecOutlet[] = [];
  for (const list of groups.values()) {
    const configs = list.map((row) => {
      const specs = asJson(row.specs);
      return valuesFromParts({
        requirements: (asJson(row.requirements) ?? {}) as Requirements,
        specs: Array.isArray(specs) ? (specs as Kv[]) : [],
        mpn: row.mpn,
      });
    });
    const outlet = outletFromConfigs(configs);
    if (!outlet) continue;
    const row = list[0]!;
    out.push({
      model: row.book_title || `${row.manufacturer} ${row.model}`.trim(),
      manufacturer: row.book_mfr || row.manufacturer,
      voltage: outlet.voltage,
      amps: outlet.amps,
      plug: outlet.plug,
    });
  }
  return out;
}

export { outletForModel };

const doneInput = z.object({
  section: z.string().min(1).max(40),
  itemKey: z.string().min(1).max(200),
  label: z.string().min(1).max(300),
  detail: z.string().max(500).optional(),
});

export const rememberLibraryDone = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof doneInput>) => doneInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    await sql.query(
      `insert into library_admin_done (section, item_key, label, detail, resolved_at)
       values ($1, $2, $3, $4, now())
       on conflict (section, item_key) do update set label = excluded.label, detail = excluded.detail, resolved_at = now()`,
      [data.section, data.itemKey, data.label, data.detail ?? null],
    );
    return { ok: true };
  });

export const setLibraryAdminOpen = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { section: string; open: boolean }) => z.object({ section: z.string().min(1).max(40), open: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    await sql.query(
      `insert into library_admin_open (user_id, section, open) values ($1, $2, $3)
       on conflict (user_id, section) do update set open = excluded.open`,
      [context.userId, data.section, data.open],
    );
    return { ok: true };
  });

export type AdminDone = { section: string; itemKey: string; label: string; detail: string | null; resolvedAt: string };
export type AdminOpen = { section: string; open: boolean };

export const listLibraryAdminState = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ opens: AdminOpen[]; done: AdminDone[] }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    const opens = await sql.query<{ section: string; open: boolean }>(
      "select section, open from library_admin_open where user_id = $1",
      [context.userId],
    );
    const done = await sql.query<{ section: string; item_key: string; label: string; detail: string | null; resolved_at: string | Date }>(
      "select section, item_key, label, detail, resolved_at from library_admin_done order by resolved_at desc",
    );
    return {
      opens: opens.map((r) => ({ section: r.section, open: !!r.open })),
      done: done.map((r) => ({
        section: r.section,
        itemKey: r.item_key,
        label: r.label,
        detail: r.detail,
        resolvedAt: String(r.resolved_at),
      })),
    };
  });

/**
 * Keep one copy of a shared file and delete the other copies. The keeper must sit on the family's
 * main chip, and every deleted copy on a model that takes manuals from it, so no model loses the file.
 */
export async function keepOneCopy(sql: Sql, keepId: number, removeIds: number[]): Promise<{ removed: number }> {
  const ids = removeIds.filter((id) => id !== keepId);
  if (!ids.length) return { removed: 0 };
  const books = (await sql.query<{ id: number; title: string; manufacturer: string | null }>("select id, title, manufacturer from library_books")).map(
    (b) => ({ id: Number(b.id), title: b.title, manufacturer: b.manufacturer ?? "" }),
  );
  const files = await sql.query<{ id: number; section: LibrarySection; book_id: number | null; mpn: string | null }>(
    "select id, section, book_id, mpn from library_files where id = any($1::int[])",
    [[keepId, ...ids]],
  );
  const bookOf = (f: { book_id: number | null } | undefined) => books.find((b) => f?.book_id != null && b.id === Number(f.book_id));
  const keep = files.find((f) => Number(f.id) === keepId);
  const main = bookOf(keep);
  // A variation only shows a shared (no MPN) manual or parts file that sits on its main chip.
  const safe =
    !!keep &&
    !!main &&
    isMainChip(main, books) &&
    copiesToVariations(keep.section) &&
    !(keep.mpn ?? "").trim() &&
    files.every((f) => {
      const book = bookOf(f);
      return f === keep || (f.section === keep.section && !!book && (book.id === main.id || mainChipFor(book, books)?.id === main.id));
    });
  if (!safe) throw new Error("Store this file once on the main chip first, so the other models keep it.");
  // A model that had hidden the kept copy (it showed twice) shows it again once its own copy is gone.
  const rows = await sql.query<{ removed: number }>(
    `with gone as (
       delete from library_files where id = any($1::int[]) and id <> $2 and section <> 'training' returning id, book_id
     ), shown as (
       delete from library_file_hidden h using gone where h.file_id = $2 and h.book_id = gone.book_id
     )
     select count(*)::int as removed from gone`,
    [ids, keepId],
  );
  return { removed: rows[0]?.removed ?? 0 };
}

export const keepOneLibraryCopy = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { keepId: number; removeIds: number[] }) =>
    z.object({ keepId: z.number().int().positive(), removeIds: z.array(z.number().int().positive()).min(1).max(40) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ removed: number }> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId);
    return keepOneCopy(sql, data.keepId, data.removeIds);
  });
