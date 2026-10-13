/**
 * The Library — Manuals and Parts Diagrams. Files are stored in Postgres (bytea) in ~1 MB pieces.
 * Everyone with Desk access can list, open and share links; only Admin and Sales add or delete.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { cleanMpn, cleanSourceUrl, mpnKey, sameMpn, tieError } from "@/lib/ops/mpn-rules";
import { cleanLegacyNote, legacyMoveError } from "@/lib/ops/legacy-rules";
import { CHUNK_BYTES, copiesToVariations, customFileName, fileError, mainChipFor, type HiddenCopy, makerOf, manualTypeFromName, matchBook, MANUAL_TYPES, variationTitle, mimeFor, shelfFileName, sortByName, type LibrarySection, type ManualType } from "@/lib/ops/library-file-rules";

export type LibraryFile = {
  id: number;
  section: LibrarySection;
  name: string;
  mime: string;
  size: number;
  token: string;
  /** The book (equipment family) this file sits in; null until someone files it. */
  bookId: number | null;
  /** Manual type ("Cleaning Manual" …); null for spec sheets and files stored before types. */
  docType: string | null;
  /** Set when this is the manufacturer's official file for one MPN. Such a file stays on its own variation. */
  mpn: string | null;
  /** The manufacturer page or file the official file came from. */
  sourceUrl: string | null;
  /** Pages of readable text kept for Troubleshoot: null = not read yet, 0 = no readable text. */
  textPages: number | null;
  addedBy: string;
  createdAt: string;
};

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}
async function roleOf(sql: Sql, userId: string) {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  return { canEdit: flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin" || rows[0]?.desk_role === "sales", name: rows[0]?.username || "Teammate" };
}
async function requireEditor(sql: Sql, userId: string) {
  const role = await roleOf(sql, userId);
  if (!role.canEdit) throw new Error("Only Admin and Sales can add or delete Library files.");
  return role;
}
function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const section = z.enum(["spec", "manuals", "parts"]);

export type LibraryBook = {
  id: number;
  title: string;
  manufacturer: string;
  /** The manufacturer part number official files are matched on. Null until someone confirms it. */
  mpn: string | null;
  /** Someone looked and the manufacturer has no file for this exact MPN. */
  noOfficialFile: boolean;
  /** The manufacturer lists this model as discontinued or obsolete: it sits under Legacy, and still opens. */
  legacy: boolean;
  /** The manufacturer page that says so. Always set on a Legacy model. */
  legacySource: string | null;
  /** What was found, for a Legacy model or a Confirm Legacy flag. */
  legacyNote: string | null;
  /** Could not be confirmed as discontinued: stays in the main row, flagged for someone to confirm. */
  confirmLegacy: boolean;
};

type BookRow = {
  id: number;
  title: string;
  manufacturer: string | null;
  mpn: string | null;
  no_official_file: boolean;
  legacy: boolean;
  legacy_source: string | null;
  legacy_note: string | null;
  confirm_legacy: boolean;
};
const BOOK_COLS = "id, title, manufacturer, mpn, no_official_file, legacy, legacy_source, legacy_note, confirm_legacy";
const toBook = (b: BookRow): LibraryBook => ({
  id: Number(b.id),
  title: b.title,
  manufacturer: b.manufacturer ?? "",
  mpn: b.mpn ?? null,
  noOfficialFile: !!b.no_official_file,
  legacy: !!b.legacy,
  legacySource: b.legacy_source ?? null,
  legacyNote: b.legacy_note ?? null,
  confirmLegacy: !!b.confirm_legacy,
});

/**
 * Every spec sheet belongs to a book. Sheets saved before books existed (or just imported) are
 * placed in the book for their family, creating it if needed. Loose files are filed only when
 * their name matches exactly one book.
 */
async function ensureBooks(sql: Sql): Promise<LibraryBook[]> {
  const load = async () =>
    (await sql.query<BookRow>(`select ${BOOK_COLS} from library_books order by lower(title)`)).map(toBook);
  let books = await load();
  // Books made before makers were recorded: take the maker from the spec sheets, else the title.
  if (books.some((b) => !b.manufacturer)) {
    const makers = (await sql.query<{ manufacturer: string }>("select distinct manufacturer from spec_sheets")).map((r) => r.manufacturer);
    for (const b of books.filter((x) => !x.manufacturer)) {
      await sql.query("update library_books set manufacturer = $2 where id = $1 and manufacturer is null", [b.id, makerOf(b.title, makers)]);
    }
    books = await load();
  }
  const bookFor = async (manufacturer: string, model: string): Promise<LibraryBook | null> => {
    const title = variationTitle(manufacturer, model);
    if (!title) return null;
    const have = books.find((b) => b.title.toLowerCase() === title.toLowerCase());
    if (have) return have;
    await sql.query("insert into library_books (title, manufacturer, per_variation) values ($1, $2, true) on conflict (lower(title)) do nothing", [title, manufacturer.trim()]);
    books = await load();
    return books.find((b) => b.title.toLowerCase() === title.toLowerCase()) ?? null;
  };
  const renameFiles = async (bookId: number, title: string, only?: number[]) => {
    const rows = await sql.query<{ id: number; name: string; original_name: string | null; section: LibrarySection; doc_type: string | null }>(
      "select id, name, original_name, section, doc_type from library_files where book_id = $1 order by lower(name), id",
      [bookId],
    );
    const done: Record<string, string[]> = {};
    for (const f of rows) {
      const taken = (done[f.section] ??= rows.filter((r) => r.section === f.section && only && !only.includes(r.id)).map((r) => r.name));
      const name = only && !only.includes(f.id) ? f.name : shelfFileName(title, f.section, f.original_name || f.name, taken, f.doc_type);
      if (!only || only.includes(f.id)) taken.push(name);
      if (name !== f.name) await sql.query("update library_files set name = $2, original_name = coalesce(original_name, $3) where id = $1", [f.id, name, f.name]);
    }
  };

  // One-time: books made when every Axiom shared one book are split so each variation has its own.
  const old = await sql.query<{ id: number; title: string }>("select id, title from library_books where not per_variation order by id");
  for (const b of old) {
    const sheets = await sql.query<{ id: number; manufacturer: string; model: string }>("select id, manufacturer, model from spec_sheets where book_id = $1 order by id", [b.id]);
    if (sheets.length === 1) {
      const title = variationTitle(sheets[0]!.manufacturer, sheets[0]!.model);
      const clash = books.find((x) => x.id !== b.id && x.title.toLowerCase() === title.toLowerCase());
      if (clash) await sql.query("update spec_sheets set book_id = $2 where id = $1", [sheets[0]!.id, clash.id]);
      else if (title && title.toLowerCase() !== b.title.toLowerCase()) {
        // The only variation in the book: the book takes its full name, and its files with it.
        await sql.query("update library_books set title = $2 where id = $1", [b.id, title]);
        await renameFiles(b.id, title);
      }
    } else if (sheets.length > 1) {
      const made: LibraryBook[] = [];
      for (const sheet of sheets) {
        const target = await bookFor(sheet.manufacturer, sheet.model);
        if (!target) continue;
        if (target.id !== b.id) await sql.query("update spec_sheets set book_id = $2 where id = $1", [sheet.id, target.id]);
        made.push(target);
      }
      // Files stay where they were filed unless their name spells out one variation.
      const mine = await sql.query<{ id: number; name: string; original_name: string | null }>("select id, name, original_name from library_files where book_id = $1", [b.id]);
      for (const f of mine) {
        const target = matchBook(f.original_name || f.name, made.filter((m) => m.id !== b.id));
        if (!target) continue;
        await sql.query("update library_files set book_id = $2 where id = $1", [f.id, target.id]);
        await renameFiles(target.id, target.title, [f.id]);
      }
      await sql.query(
        "delete from library_books k where k.id = $1 and not exists (select 1 from library_files f where f.book_id = k.id) and not exists (select 1 from spec_sheets s where s.book_id = k.id)",
        [b.id],
      );
    }
    await sql.query("update library_books set per_variation = true where id = $1", [b.id]);
    books = await load();
  }

  const loose = await sql.query<{ id: number; manufacturer: string; model: string }>(
    "select id, manufacturer, model from spec_sheets where book_id is null order by id",
  );
  for (const sheet of loose) {
    const book = await bookFor(sheet.manufacturer, sheet.model);
    if (book) await sql.query("update spec_sheets set book_id = $2 where id = $1 and book_id is null", [sheet.id, book.id]);
  }
  const files = await sql.query<{ id: number; name: string; section: LibrarySection }>(
    "select id, name, section from library_files where book_id is null and complete and section <> 'training' order by id",
  );
  for (const f of files) {
    const book = matchBook(f.name, books);
    if (!book) continue;
    const taken = await sql.query<{ name: string }>("select name from library_files where book_id = $1 and section = $2", [book.id, f.section]);
    await sql.query("update library_files set book_id = $2, original_name = coalesce(original_name, name), name = $3 where id = $1 and book_id is null", [
      f.id,
      book.id,
      shelfFileName(book.title, f.section, f.name, taken.map((t) => t.name)),
    ]);
  }
  return books;
}

export const listLibraryFiles = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ books: LibraryBook[]; files: LibraryFile[]; sheetBooks: { sheetId: number; bookId: number | null }[]; hidden: HiddenCopy[]; canEdit: boolean }> => {
    const sql = await ready();
    const role = await roleOf(sql, context.userId);
    const books = await ensureBooks(sql);
    const rows = await sql.query<{
      id: number; section: LibrarySection; name: string; mime: string; size: number; token: string; book_id: number | null; doc_type: string | null; text_pages: number | null; added_by_name: string | null; created_at: string | Date; mpn: string | null; source_url: string | null;
    }>("select id, section, name, mime, size, token, book_id, doc_type, text_pages, added_by_name, created_at, mpn, source_url from library_files where complete and section <> 'training' order by lower(name), id");
    const files = rows.map((r) => ({
      id: Number(r.id),
      section: r.section,
      name: r.name,
      mime: r.mime,
      size: Number(r.size),
      token: r.token,
      bookId: r.book_id == null ? null : Number(r.book_id),
      docType: r.doc_type ?? null,
      mpn: r.mpn ?? null,
      sourceUrl: r.source_url ?? null,
      textPages: r.text_pages == null ? null : Number(r.text_pages),
      addedBy: r.added_by_name || "Teammate",
      createdAt: new Date(r.created_at).toISOString(),
    }));
    const sheets = await sql.query<{ id: number; book_id: number | null }>("select id, book_id from spec_sheets");
    return {
      books,
      files: sortByName(files),
      sheetBooks: sheets.map((r) => ({ sheetId: Number(r.id), bookId: r.book_id == null ? null : Number(r.book_id) })),
      // Main-chip manuals a variation removed its copy of.
      hidden: (await sql.query<{ file_id: number; book_id: number }>("select file_id, book_id from library_file_hidden")).map((r) => ({ fileId: Number(r.file_id), bookId: Number(r.book_id) })),
      canEdit: role.canEdit,
    };
  });

const bookParts = { manufacturer: z.string().trim().min(2).max(40), model: z.string().trim().min(1).max(60) };
const tidy = (v: string) => v.replace(/\s+/g, " ").trim();
/** "Bunn" + "Axiom" → "Bunn Axiom"; a model typed with the maker in front isn't doubled. */
function titleOf(manufacturer: string, model: string) {
  const maker = tidy(manufacturer);
  const m = tidy(model);
  return m.toLowerCase().startsWith(maker.toLowerCase() + " ") ? m : `${maker} ${m}`;
}

/** Creates the book, or returns the one that already has that maker and model. */
export const createLibraryBook = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { manufacturer: string; model: string }) => z.object(bookParts).parse(d))
  .handler(async ({ data, context }): Promise<LibraryBook> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const title = titleOf(data.manufacturer, data.model);
    await sql.query("insert into library_books (title, manufacturer, created_by, per_variation) values ($1, $2, $3, true) on conflict (lower(title)) do nothing", [title, tidy(data.manufacturer), context.userId]);
    const rows = await sql.query<BookRow>(`select ${BOOK_COLS} from library_books where lower(title) = lower($1)`, [title]);
    const made = toBook(rows[0]!);
    return { ...made, manufacturer: made.manufacturer || tidy(data.manufacturer) };
  });

export const renameLibraryBook = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; manufacturer: string; model: string }) => z.object({ id: z.number().int().positive(), ...bookParts }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const title = titleOf(data.manufacturer, data.model);
    const clash = await sql.query("select 1 from library_books where lower(title) = lower($1) and id <> $2", [title, data.id]);
    if (clash.length) throw new Error(`${title} is already in The Library.`);
    await sql.query("update library_books set title = $2, manufacturer = $3 where id = $1", [data.id, title, tidy(data.manufacturer)]);
    return { ok: true };
  });

/** Only an empty book can be removed. */
export const deleteLibraryBook = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const rows = await sql.query(
      `delete from library_books b where b.id = $1
          and not exists (select 1 from library_files f where f.book_id = b.id)
          and not exists (select 1 from spec_sheets s where s.book_id = b.id)
        returning b.id`,
      [data.id],
    );
    if (!rows.length) throw new Error("Move or delete everything in this book first.");
    return { ok: true };
  });

async function nameInBook(sql: Sql, bookId: number, sec: LibrarySection, original: string, exceptId?: number, type?: string | null) {
  const book = await sql.query<{ title: string }>("select title from library_books where id = $1", [bookId]);
  if (!book[0]) throw new Error("That book no longer exists. Pick another.");
  const taken = await sql.query<{ name: string }>("select name from library_files where book_id = $1 and section = $2 and id <> $3", [bookId, sec, exceptId ?? 0]);
  return shelfFileName(book[0].title, sec, original, taken.map((t) => t.name), type);
}

export const startLibraryFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { section: LibrarySection; bookId: number; name: string; size: number; docType?: ManualType; customName?: string }) =>
    z.object({ section, bookId: z.number().int().positive(), name: z.string().trim().min(1).max(200), size: z.number().int().positive(), docType: z.enum(MANUAL_TYPES).optional(), customName: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: number; name: string; section: LibrarySection }> => {
    const sql = await ready();
    const role = await requireEditor(sql, context.userId);
    const problem = fileError(data.name, data.size);
    if (problem) throw new Error(problem);
    // Uploads that were abandoned part-way are swept here.
    await sql.query("delete from library_files where not complete and created_at < now() - interval '1 hour'");
    // Stored as "Family - Type"; the name it arrived with is kept alongside.
    // A manual is never filed as a plain "Manual": the type comes from the person, else from an obvious file name.
    const type = data.section === "manuals" ? data.docType ?? manualTypeFromName(data.name) : null;
    if (data.section === "manuals" && !type) throw new Error(`Pick the manual type for ${data.name} first.`);
    const sec = data.section;
    // A name the person typed wins over "Variation - Type".
    let name = await nameInBook(sql, data.bookId, sec, data.name, undefined, type);
    if (data.customName?.trim()) {
      const typed = customFileName(data.customName, data.name);
      if ("error" in typed) throw new Error(typed.error);
      name = typed.name;
    }
    const rows = await sql.query<{ id: number }>(
      `insert into library_files (section, name, original_name, mime, size, token, added_by, added_by_name, book_id, doc_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [sec, name, data.name, mimeFor(data.name), data.size, newToken(), context.userId, role.name, data.bookId, type],
    );
    return { id: Number(rows[0]!.id), name, section: sec };
  });

/** Put a file in a (different) book; it is renamed for that book. */
export const moveLibraryFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; bookId: number }) => z.object({ id: z.number().int().positive(), bookId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; name: string }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const file = await sql.query<{ section: LibrarySection; name: string; original_name: string | null; doc_type: string | null; mpn: string | null }>(
      "select section, name, original_name, doc_type, mpn from library_files where id = $1 and section <> 'training'",
      [data.id],
    );
    if (!file[0]) throw new Error("That file no longer exists.");
    if ((file[0].mpn ?? "").trim()) throw new Error(`This is the official file for MPN ${file[0].mpn}. Untie it from the MPN before moving it.`);
    // A parts file keeps its name wherever it goes; manuals and spec sheets are named for the model they land on.
    const name = file[0].section === "parts" ? file[0].name : await nameInBook(sql, data.bookId, file[0].section, file[0].original_name || file[0].name, data.id, file[0].doc_type);
    await sql.query("update library_files set book_id = $2, name = $3, original_name = coalesce(original_name, $4) where id = $1", [data.id, data.bookId, name, file[0].name]);
    return { ok: true, name };
  });

/** Name a stored manual by its type. Manuals only: parts files stay parts files. */
export const setLibraryFileType = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; docType: ManualType }) => z.object({ id: z.number().int().positive(), docType: z.enum(MANUAL_TYPES) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; name: string; section: LibrarySection }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const file = await sql.query<{ section: LibrarySection; name: string; original_name: string | null; book_id: number | null }>(
      "select section, name, original_name, book_id from library_files where id = $1 and section <> 'training'",
      [data.id],
    );
    if (!file[0]) throw new Error("That file no longer exists.");
    if (file[0].section !== "manuals") throw new Error("Only a manual has a manual type.");
    if (file[0].book_id == null) throw new Error("File it under a model first.");
    const sec: LibrarySection = "manuals";
    const name = await nameInBook(sql, Number(file[0].book_id), sec, file[0].original_name || file[0].name, data.id, data.docType);
    await sql.query("update library_files set section = $2, name = $3, doc_type = $4, original_name = coalesce(original_name, $5) where id = $1", [data.id, sec, name, data.docType, file[0].name]);
    return { ok: true, name, section: sec };
  });

/** Give a stored file a name of your own. The original is untouched; links already sent keep working. */
export const renameLibraryFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; name: string }) => z.object({ id: z.number().int().positive(), name: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; name: string }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    // Training files keep the name they were dropped with.
    const file = await sql.query<{ name: string }>("select name from library_files where id = $1 and section <> 'training'", [data.id]);
    if (!file[0]) throw new Error("That file no longer exists.");
    const typed = customFileName(data.name, file[0].name);
    if ("error" in typed) throw new Error(typed.error);
    await sql.query("update library_files set name = $2, original_name = coalesce(original_name, $3) where id = $1", [data.id, typed.name, file[0].name]);
    return { ok: true, name: typed.name };
  });

const copyInput = z.object({ fileId: z.number().int().positive(), bookId: z.number().int().positive(), show: z.boolean() });

/**
 * A manual or parts file on the main chip is shown on every variation of its parent. This removes that copy from ONE variation
 * (or puts it back). The main file is never deleted here, and the other variations keep theirs.
 */
export const setManualCopy = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof copyInput>) => copyInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const file = await sql.query<{ section: LibrarySection; book_id: number | null; mpn: string | null }>("select section, book_id, mpn from library_files where id = $1 and complete and section <> 'training'", [data.fileId]);
    if (!file[0]) throw new Error("That file no longer exists.");
    if ((file[0].mpn ?? "").trim()) throw new Error("A file tied to one MPN is not copied to other variations.");
    const books = (await sql.query<{ id: number; title: string; manufacturer: string | null }>("select id, title, manufacturer from library_books")).map((b) => ({ id: Number(b.id), title: b.title, manufacturer: b.manufacturer ?? "" }));
    const book = books.find((b) => b.id === data.bookId);
    if (!book) throw new Error("That model is no longer in The Library.");
    const main = mainChipFor(book, books);
    if (!copiesToVariations(file[0].section) || !main || Number(file[0].book_id) !== main.id) {
      throw new Error("Only a manual or parts file copied from the main chip can be removed from one variation. Use Delete on a file added here.");
    }
    if (data.show) await sql.query("delete from library_file_hidden where file_id = $1 and book_id = $2", [data.fileId, data.bookId]);
    else await sql.query("insert into library_file_hidden (file_id, book_id, hidden_by) values ($1, $2, $3) on conflict (file_id, book_id) do nothing", [data.fileId, data.bookId, context.userId]);
    return { ok: true };
  });

/**
 * Set or clear the MPN a variation's official files are matched on. Two variations cannot share one. An MPN that
 * has official files tied to it is not changed here: untie those files first, so no file ends up tied to a number
 * it was not matched to.
 */
export const setBookMpn = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { bookId: number; mpn: string | null }) => z.object({ bookId: z.number().int().positive(), mpn: z.string().max(60).nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<{ mpn: string | null }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const mpn = cleanMpn(data.mpn);
    const book = (await sql.query<{ mpn: string | null }>("select mpn from library_books where id = $1", [data.bookId]))[0];
    if (!book) throw new Error("That model is no longer in The Library.");
    if ((book.mpn ?? "") === (mpn ?? "")) return { mpn };
    if (mpn) {
      const clash = await sql.query<{ title: string }>(
        "select title from library_books where id <> $1 and mpn is not null and upper(regexp_replace(mpn, '[^A-Za-z0-9]+', '', 'g')) = $2 limit 1",
        [data.bookId, mpnKey(mpn)],
      );
      if (clash[0]) throw new Error(`MPN ${mpn} is already on ${clash[0].title}.`);
    }
    if (!sameMpn(book.mpn, mpn)) {
      const tied = await sql.query("select 1 from library_files where book_id = $1 and mpn is not null limit 1", [data.bookId]);
      if (tied.length) throw new Error("Files here are tied to the current MPN. Untie them before changing it.");
    }
    try {
      await sql.query("update library_books set mpn = $2, no_official_file = case when $2::text is null then false else no_official_file end where id = $1", [data.bookId, mpn]);
    } catch (e) {
      if (/unique|duplicate/i.test(String(e))) throw new Error(`MPN ${mpn} is already on another model.`);
      throw e;
    }
    return { mpn };
  });

/** Mark that the manufacturer has no official file for this exact MPN (or clear the mark). */
export const setNoOfficialFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { bookId: number; value: boolean }) => z.object({ bookId: z.number().int().positive(), value: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const book = (await sql.query<{ mpn: string | null }>("select mpn from library_books where id = $1", [data.bookId]))[0];
    if (!book) throw new Error("That model is no longer in The Library.");
    if (data.value && !mpnKey(book.mpn)) throw new Error("Set this variation's MPN first. The flag is about one exact MPN.");
    await sql.query("update library_books set no_official_file = $2 where id = $1", [data.bookId, data.value]);
    return { ok: true };
  });

/**
 * Record a stored file as the manufacturer's official file for its variation's MPN, with where it came from.
 * The file has to be stored on that variation already, and cannot be tied to a different MPN. Tying a spec sheet
 * clears a "no official file" mark made earlier.
 */
export const tieOfficialFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { fileId: number; bookId: number; sourceUrl: string }) =>
    z.object({ fileId: z.number().int().positive(), bookId: z.number().int().positive(), sourceUrl: z.string().max(1000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ mpn: string; sourceUrl: string }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const file = (await sql.query<{ book_id: number | null; mpn: string | null; section: LibrarySection }>(
      "select book_id, mpn, section from library_files where id = $1 and complete and section <> 'training'",
      [data.fileId],
    ))[0];
    if (!file) throw new Error("That file no longer exists.");
    const book = (await sql.query<{ mpn: string | null }>("select mpn from library_books where id = $1", [data.bookId]))[0];
    if (!book) throw new Error("That model is no longer in The Library.");
    const problem = tieError({
      bookMpn: book.mpn,
      fileBookId: file.book_id == null ? null : Number(file.book_id),
      bookId: data.bookId,
      fileMpn: file.mpn,
      sourceUrl: data.sourceUrl,
    });
    if (problem) throw new Error(problem);
    const url = cleanSourceUrl(data.sourceUrl);
    await sql.query("update library_files set mpn = $2, source_url = $3 where id = $1", [data.fileId, book.mpn, url]);
    if (file.section === "spec") await sql.query("update library_books set no_official_file = false where id = $1", [data.bookId]);
    return { mpn: book.mpn!, sourceUrl: url };
  });

/** Remove the MPN tie from a file. The file stays where it is. */
export const untieOfficialFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { fileId: number }) => z.object({ fileId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    await sql.query("update library_files set mpn = null, source_url = null where id = $1", [data.fileId]);
    return { ok: true };
  });

/**
 * Move a model under Legacy for its manufacturer, or back to the main row. Moving it there needs the manufacturer
 * page that lists it as discontinued or obsolete. The model keeps its spec sheet, manuals and parts, still opens,
 * and nothing is deleted or renamed.
 */
export const setBookLegacy = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { bookId: number; legacy: boolean; sourceUrl?: string | null; note?: string | null }) =>
    z
      .object({
        bookId: z.number().int().positive(),
        legacy: z.boolean(),
        sourceUrl: z.string().max(1000).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ legacy: boolean }> => {
    const sql = await ready();
    const role = await requireEditor(sql, context.userId);
    const book = (await sql.query<{ id: number }>("select id from library_books where id = $1", [data.bookId]))[0];
    if (!book) throw new Error("That model is no longer in The Library.");
    if (data.legacy) {
      const problem = legacyMoveError({ sourceUrl: data.sourceUrl });
      if (problem) throw new Error(problem);
      await sql.query(
        `update library_books
            set legacy = true, legacy_source = $2, legacy_note = $3, legacy_by = $4, legacy_at = now(), confirm_legacy = false
          where id = $1`,
        [data.bookId, cleanSourceUrl(data.sourceUrl), cleanLegacyNote(data.note), role.name],
      );
    } else {
      await sql.query(
        "update library_books set legacy = false, legacy_source = null, legacy_note = null, legacy_by = null, legacy_at = null where id = $1",
        [data.bookId],
      );
    }
    return { legacy: data.legacy };
  });

/**
 * Flag a model Confirm Legacy (it could not be confirmed as discontinued), or clear the flag. The model stays in
 * the main row either way. A model already under Legacy needs no flag.
 */
export const setConfirmLegacy = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { bookId: number; value: boolean; note?: string | null }) =>
    z.object({ bookId: z.number().int().positive(), value: z.boolean(), note: z.string().max(2000).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const book = (await sql.query<{ legacy: boolean }>("select legacy from library_books where id = $1", [data.bookId]))[0];
    if (!book) throw new Error("That model is no longer in The Library.");
    if (book.legacy) throw new Error("This model is already under Legacy.");
    await sql.query("update library_books set confirm_legacy = $2, legacy_note = $3 where id = $1", [
      data.bookId,
      data.value,
      data.value ? cleanLegacyNote(data.note) : null,
    ]);
    return { ok: true };
  });

export const moveSpecSheet = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { sheetId: number; bookId: number }) => z.object({ sheetId: z.number().int().positive(), bookId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const rows = await sql.query("update spec_sheets set book_id = $2 where id = $1 and exists (select 1 from library_books where id = $2) returning id", [data.sheetId, data.bookId]);
    if (!rows.length) throw new Error("That book or spec sheet no longer exists.");
    return { ok: true };
  });

export const appendLibraryChunk = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; seq: number; base64: string }) =>
    z.object({
      id: z.number().int().positive(),
      seq: z.number().int().min(0).max(100),
      base64: z.string().min(1).max(Math.ceil((CHUNK_BYTES * 4) / 3) + 16).regex(/^[A-Za-z0-9+/]+=*$/),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const rows = await sql.query<{ file_id: number }>(
      `insert into library_file_chunks (file_id, seq, data)
       select f.id, $2, decode($3, 'base64') from library_files f
        where f.id = $1 and f.added_by = $4 and not f.complete
       on conflict (file_id, seq) do update set data = excluded.data
       returning file_id`,
      [data.id, data.seq, data.base64, context.userId],
    );
    if (!rows[0]) throw new Error("That upload is no longer open. Drop the file again.");
    return { ok: true };
  });

export const finishLibraryFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    // Only counts as stored when every byte arrived.
    const rows = await sql.query<{ id: number }>(
      `update library_files f set complete = true
        where f.id = $1 and f.added_by = $2 and not f.complete
          and f.size = (select coalesce(sum(octet_length(c.data)), 0) from library_file_chunks c where c.file_id = f.id)
        returning f.id`,
      [data.id, context.userId],
    );
    if (!rows[0]) {
      await sql.query("delete from library_files where id = $1 and added_by = $2 and not complete", [data.id, context.userId]);
      throw new Error("The file didn't arrive in full. Drop it again.");
    }
    return { ok: true };
  });

export const deleteLibraryFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    // Training files are deleted from Education And Training (Admin and Sales), not from a model book.
    await sql.query("delete from library_files where id = $1 and section <> 'training'", [data.id]);
    return { ok: true };
  });
