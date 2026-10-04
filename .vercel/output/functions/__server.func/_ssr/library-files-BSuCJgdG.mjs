import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, mn as number, sn as _enum, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { b as variationTitle, d as matchBook, f as mimeFor, h as shelfFileName, r as CHUNK_BYTES, s as fileError, u as makerOf, v as sortByName } from "./library-file-rules-C8I0Azqy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/library-files-BSuCJgdG.js
/**
* The Library — Manuals and Parts Diagrams. Files are stored in Postgres (bytea) in ~1 MB pieces.
* Everyone with Desk access can list, open and share links; only Admin and Sales add or delete.
*/
async function ready() {
	const { ensureSeeded } = await import("./seed.server-2-fPCFoA.mjs");
	await ensureSeeded();
	return getSql();
}
async function roleOf(sql, userId) {
	const rows = await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [userId]);
	return {
		canEdit: flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "sales",
		name: rows[0]?.username || "Teammate"
	};
}
async function requireEditor(sql, userId) {
	const role = await roleOf(sql, userId);
	if (!role.canEdit) throw new Error("Only Admin and Sales can add or delete Library files.");
	return role;
}
function newToken() {
	const bytes = /* @__PURE__ */ new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
var section = _enum([
	"spec",
	"manuals",
	"parts"
]);
/**
* Every spec sheet belongs to a book. Sheets saved before books existed (or just imported) are
* placed in the book for their family, creating it if needed. Loose files are filed only when
* their name matches exactly one book.
*/
async function ensureBooks(sql) {
	const load = async () => (await sql.query("select id, title, manufacturer from library_books order by lower(title)")).map((b) => ({
		id: Number(b.id),
		title: b.title,
		manufacturer: b.manufacturer ?? ""
	}));
	let books = await load();
	if (books.some((b) => !b.manufacturer)) {
		const makers = (await sql.query("select distinct manufacturer from spec_sheets")).map((r) => r.manufacturer);
		for (const b of books.filter((x) => !x.manufacturer)) await sql.query("update library_books set manufacturer = $2 where id = $1 and manufacturer is null", [b.id, makerOf(b.title, makers)]);
		books = await load();
	}
	const bookFor = async (manufacturer, model) => {
		const title = variationTitle(manufacturer, model);
		if (!title) return null;
		const have = books.find((b) => b.title.toLowerCase() === title.toLowerCase());
		if (have) return have;
		await sql.query("insert into library_books (title, manufacturer, per_variation) values ($1, $2, true) on conflict (lower(title)) do nothing", [title, manufacturer.trim()]);
		books = await load();
		return books.find((b) => b.title.toLowerCase() === title.toLowerCase()) ?? null;
	};
	const renameFiles = async (bookId, title, only) => {
		const rows = await sql.query("select id, name, original_name, section from library_files where book_id = $1 order by lower(name), id", [bookId]);
		const done = {};
		for (const f of rows) {
			const taken = done[f.section] ??= rows.filter((r) => r.section === f.section && only && !only.includes(r.id)).map((r) => r.name);
			const name = only && !only.includes(f.id) ? f.name : shelfFileName(title, f.section, f.original_name || f.name, taken);
			if (!only || only.includes(f.id)) taken.push(name);
			if (name !== f.name) await sql.query("update library_files set name = $2, original_name = coalesce(original_name, $3) where id = $1", [
				f.id,
				name,
				f.name
			]);
		}
	};
	const old = await sql.query("select id, title from library_books where not per_variation order by id");
	for (const b of old) {
		const sheets = await sql.query("select id, manufacturer, model from spec_sheets where book_id = $1 order by id", [b.id]);
		if (sheets.length === 1) {
			const title = variationTitle(sheets[0].manufacturer, sheets[0].model);
			const clash = books.find((x) => x.id !== b.id && x.title.toLowerCase() === title.toLowerCase());
			if (clash) await sql.query("update spec_sheets set book_id = $2 where id = $1", [sheets[0].id, clash.id]);
			else if (title && title.toLowerCase() !== b.title.toLowerCase()) {
				await sql.query("update library_books set title = $2 where id = $1", [b.id, title]);
				await renameFiles(b.id, title);
			}
		} else if (sheets.length > 1) {
			const made = [];
			for (const sheet of sheets) {
				const target = await bookFor(sheet.manufacturer, sheet.model);
				if (!target) continue;
				if (target.id !== b.id) await sql.query("update spec_sheets set book_id = $2 where id = $1", [sheet.id, target.id]);
				made.push(target);
			}
			const mine = await sql.query("select id, name, original_name from library_files where book_id = $1", [b.id]);
			for (const f of mine) {
				const target = matchBook(f.original_name || f.name, made.filter((m) => m.id !== b.id));
				if (!target) continue;
				await sql.query("update library_files set book_id = $2 where id = $1", [f.id, target.id]);
				await renameFiles(target.id, target.title, [f.id]);
			}
			await sql.query("delete from library_books k where k.id = $1 and not exists (select 1 from library_files f where f.book_id = k.id) and not exists (select 1 from spec_sheets s where s.book_id = k.id)", [b.id]);
		}
		await sql.query("update library_books set per_variation = true where id = $1", [b.id]);
		books = await load();
	}
	const loose = await sql.query("select id, manufacturer, model from spec_sheets where book_id is null order by id");
	for (const sheet of loose) {
		const book = await bookFor(sheet.manufacturer, sheet.model);
		if (book) await sql.query("update spec_sheets set book_id = $2 where id = $1 and book_id is null", [sheet.id, book.id]);
	}
	const files = await sql.query("select id, name, section from library_files where book_id is null and complete order by id");
	for (const f of files) {
		const book = matchBook(f.name, books);
		if (!book) continue;
		const taken = await sql.query("select name from library_files where book_id = $1 and section = $2", [book.id, f.section]);
		await sql.query("update library_files set book_id = $2, original_name = coalesce(original_name, name), name = $3 where id = $1 and book_id is null", [
			f.id,
			book.id,
			shelfFileName(book.title, f.section, f.name, taken.map((t) => t.name))
		]);
	}
	return books;
}
var listLibraryFiles_createServerFn_handler = createServerRpc({
	id: "30c304b391bc6ebc84ad83642b8d054e5d6ea3da8d0ffb04dd4ff79db94f47ce",
	name: "listLibraryFiles",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => listLibraryFiles.__executeServer(opts));
var listLibraryFiles = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listLibraryFiles_createServerFn_handler, async ({ context }) => {
	const sql = await ready();
	const role = await roleOf(sql, context.userId);
	const books = await ensureBooks(sql);
	const files = (await sql.query("select id, section, name, mime, size, token, book_id, added_by_name, created_at from library_files where complete order by lower(name), id")).map((r) => ({
		id: Number(r.id),
		section: r.section,
		name: r.name,
		mime: r.mime,
		size: Number(r.size),
		token: r.token,
		bookId: r.book_id == null ? null : Number(r.book_id),
		addedBy: r.added_by_name || "Teammate",
		createdAt: new Date(r.created_at).toISOString()
	}));
	const sheets = await sql.query("select id, book_id from spec_sheets");
	return {
		books,
		files: sortByName(files),
		sheetBooks: sheets.map((r) => ({
			sheetId: Number(r.id),
			bookId: r.book_id == null ? null : Number(r.book_id)
		})),
		canEdit: role.canEdit
	};
});
var bookParts = {
	manufacturer: string().trim().min(2).max(40),
	model: string().trim().min(1).max(60)
};
var tidy = (v) => v.replace(/\s+/g, " ").trim();
/** "Bunn" + "Axiom" → "Bunn Axiom"; a model typed with the maker in front isn't doubled. */
function titleOf(manufacturer, model) {
	const maker = tidy(manufacturer);
	const m = tidy(model);
	return m.toLowerCase().startsWith(maker.toLowerCase() + " ") ? m : `${maker} ${m}`;
}
/** Creates the book, or returns the one that already has that maker and model. */
var createLibraryBook_createServerFn_handler = createServerRpc({
	id: "d4ab9461d012374d46ecba9be7e158c436bedd8c017539fdd91b43c73ce2b8d7",
	name: "createLibraryBook",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => createLibraryBook.__executeServer(opts));
var createLibraryBook = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object(bookParts).parse(d)).handler(createLibraryBook_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	const title = titleOf(data.manufacturer, data.model);
	await sql.query("insert into library_books (title, manufacturer, created_by, per_variation) values ($1, $2, $3, true) on conflict (lower(title)) do nothing", [
		title,
		tidy(data.manufacturer),
		context.userId
	]);
	const rows = await sql.query("select id, title, manufacturer from library_books where lower(title) = lower($1)", [title]);
	return {
		id: Number(rows[0].id),
		title: rows[0].title,
		manufacturer: rows[0].manufacturer ?? tidy(data.manufacturer)
	};
});
var renameLibraryBook_createServerFn_handler = createServerRpc({
	id: "36a5b8409bc7a33474789e71892092280bbd6e6cffb085fe8a9edc51180d7aee",
	name: "renameLibraryBook",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => renameLibraryBook.__executeServer(opts));
var renameLibraryBook = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number().int().positive(),
	...bookParts
}).parse(d)).handler(renameLibraryBook_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	const title = titleOf(data.manufacturer, data.model);
	if ((await sql.query("select 1 from library_books where lower(title) = lower($1) and id <> $2", [title, data.id])).length) throw new Error(`${title} is already in The Library.`);
	await sql.query("update library_books set title = $2, manufacturer = $3 where id = $1", [
		data.id,
		title,
		tidy(data.manufacturer)
	]);
	return { ok: true };
});
var deleteLibraryBook_createServerFn_handler = createServerRpc({
	id: "ddd97adfd159793caefa8fd7bc9587cd1baf81949be652a5a59f6ba672802db0",
	name: "deleteLibraryBook",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => deleteLibraryBook.__executeServer(opts));
var deleteLibraryBook = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(deleteLibraryBook_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	if (!(await sql.query(`delete from library_books b where b.id = $1
          and not exists (select 1 from library_files f where f.book_id = b.id)
          and not exists (select 1 from spec_sheets s where s.book_id = b.id)
        returning b.id`, [data.id])).length) throw new Error("Move or delete everything in this book first.");
	return { ok: true };
});
async function nameInBook(sql, bookId, sec, original, exceptId) {
	const book = await sql.query("select title from library_books where id = $1", [bookId]);
	if (!book[0]) throw new Error("That book no longer exists. Pick another.");
	const taken = await sql.query("select name from library_files where book_id = $1 and section = $2 and id <> $3", [
		bookId,
		sec,
		exceptId ?? 0
	]);
	return shelfFileName(book[0].title, sec, original, taken.map((t) => t.name));
}
var startLibraryFile_createServerFn_handler = createServerRpc({
	id: "0c92b8356cd8f347c68710f451de25ab912db738351fab72f03b17ec3ccc81f3",
	name: "startLibraryFile",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => startLibraryFile.__executeServer(opts));
var startLibraryFile = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	section,
	bookId: number().int().positive(),
	name: string().trim().min(1).max(200),
	size: number().int().positive()
}).parse(d)).handler(startLibraryFile_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const role = await requireEditor(sql, context.userId);
	const problem = fileError(data.name, data.size);
	if (problem) throw new Error(problem);
	await sql.query("delete from library_files where not complete and created_at < now() - interval '1 hour'");
	const name = await nameInBook(sql, data.bookId, data.section, data.name);
	const rows = await sql.query(`insert into library_files (section, name, original_name, mime, size, token, added_by, added_by_name, book_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`, [
		data.section,
		name,
		data.name,
		mimeFor(data.name),
		data.size,
		newToken(),
		context.userId,
		role.name,
		data.bookId
	]);
	return {
		id: Number(rows[0].id),
		name
	};
});
var moveLibraryFile_createServerFn_handler = createServerRpc({
	id: "dfcb8584ec64ccdff12a65a3dc61f9d1ebde486ae33eb0006314df8ec7a838d3",
	name: "moveLibraryFile",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => moveLibraryFile.__executeServer(opts));
var moveLibraryFile = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number().int().positive(),
	bookId: number().int().positive()
}).parse(d)).handler(moveLibraryFile_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	const file = await sql.query("select section, name, original_name from library_files where id = $1", [data.id]);
	if (!file[0]) throw new Error("That file no longer exists.");
	const name = await nameInBook(sql, data.bookId, file[0].section, file[0].original_name || file[0].name, data.id);
	await sql.query("update library_files set book_id = $2, name = $3, original_name = coalesce(original_name, $4) where id = $1", [
		data.id,
		data.bookId,
		name,
		file[0].name
	]);
	return {
		ok: true,
		name
	};
});
var moveSpecSheet_createServerFn_handler = createServerRpc({
	id: "04e238339bdd6284779590313daa1082566359e6814a8ffa69584b040617cd10",
	name: "moveSpecSheet",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => moveSpecSheet.__executeServer(opts));
var moveSpecSheet = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	sheetId: number().int().positive(),
	bookId: number().int().positive()
}).parse(d)).handler(moveSpecSheet_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	if (!(await sql.query("update spec_sheets set book_id = $2 where id = $1 and exists (select 1 from library_books where id = $2) returning id", [data.sheetId, data.bookId])).length) throw new Error("That book or spec sheet no longer exists.");
	return { ok: true };
});
var appendLibraryChunk_createServerFn_handler = createServerRpc({
	id: "60f742086ad3a23d318abdc75ff0ce97e9ed38c49937da158252459edf6faadf",
	name: "appendLibraryChunk",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => appendLibraryChunk.__executeServer(opts));
var appendLibraryChunk = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number().int().positive(),
	seq: number().int().min(0).max(100),
	base64: string().min(1).max(Math.ceil(CHUNK_BYTES * 4 / 3) + 16).regex(/^[A-Za-z0-9+/]+=*$/)
}).parse(d)).handler(appendLibraryChunk_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	if (!(await sql.query(`insert into library_file_chunks (file_id, seq, data)
       select f.id, $2, decode($3, 'base64') from library_files f
        where f.id = $1 and f.added_by = $4 and not f.complete
       on conflict (file_id, seq) do update set data = excluded.data
       returning file_id`, [
		data.id,
		data.seq,
		data.base64,
		context.userId
	]))[0]) throw new Error("That upload is no longer open. Drop the file again.");
	return { ok: true };
});
var finishLibraryFile_createServerFn_handler = createServerRpc({
	id: "93986fa53442d203e4a12cafc33f34f7bf053f77764431ce3e08439c75080e7c",
	name: "finishLibraryFile",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => finishLibraryFile.__executeServer(opts));
var finishLibraryFile = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(finishLibraryFile_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	if (!(await sql.query(`update library_files f set complete = true
        where f.id = $1 and f.added_by = $2 and not f.complete
          and f.size = (select coalesce(sum(octet_length(c.data)), 0) from library_file_chunks c where c.file_id = f.id)
        returning f.id`, [data.id, context.userId]))[0]) {
		await sql.query("delete from library_files where id = $1 and added_by = $2 and not complete", [data.id, context.userId]);
		throw new Error("The file didn't arrive in full. Drop it again.");
	}
	return { ok: true };
});
var deleteLibraryFile_createServerFn_handler = createServerRpc({
	id: "32e8d75725b7de06e4afa66ecda1208726191f2a0ea8c611a35334596e8df6aa",
	name: "deleteLibraryFile",
	filename: "src/lib/ops/library-files.ts"
}, (opts) => deleteLibraryFile.__executeServer(opts));
var deleteLibraryFile = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(deleteLibraryFile_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	await sql.query("delete from library_files where id = $1", [data.id]);
	return { ok: true };
});
//#endregion
export { appendLibraryChunk_createServerFn_handler, createLibraryBook_createServerFn_handler, deleteLibraryBook_createServerFn_handler, deleteLibraryFile_createServerFn_handler, finishLibraryFile_createServerFn_handler, listLibraryFiles_createServerFn_handler, moveLibraryFile_createServerFn_handler, moveSpecSheet_createServerFn_handler, renameLibraryBook_createServerFn_handler, startLibraryFile_createServerFn_handler };
