/**
 * The Library — Troubleshoot. One variation, and only the files already stored on it: its spec sheet, its manuals,
 * its parts book, and the fixes saved on it. Never another chip, another variation, or the web.
 * The AI is only handed pages from those files, and every line it returns is checked against the page it cites:
 * a step that is not on that page is dropped, and a part number that is not printed in the parts book is not shown.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { copiedManuals, mainChipFor, modelLabel, shortDocName } from "@/lib/ops/library-file-rules";
import { isGrinder } from "@/lib/ops/spec-defaults";
import { callXai } from "@/lib/ops/spec-library";
import { dropWetSteps, groundedIn, matchingLines, NO_FILE, pageTag, partNumberOnPage, pickPages, similarIssue, type PageText } from "@/lib/ops/troubleshoot-rules";

export const TROUBLESHOOTS_PER_HOUR = 40;
// Kept small on purpose: fewer pages to read means a faster answer. Only the best-matching pages go.
const MANUAL_BUDGET = 20_000;
const PARTS_BUDGET = 10_000;

export type TsSource = {
  id: number;
  /** "Service And Repair Manual", "Parts Book" … */
  label: string;
  section: "spec" | "manuals" | "parts";
  token: string;
  mime: string;
  /** null = not read yet; 0 = no readable text (scanned, Word or a picture). */
  textPages: number | null;
};
export type TsCite = { fileId: number; label: string; page: number; token: string };
export type TsLine = { text: string; cite: TsCite };
export type TsPart = {
  /** The part as the manual names it. */
  name: string;
  /** From this variation's parts book; null = not in this model's parts book. */
  number: string | null;
  /** The part's name as the parts book prints it. */
  bookName: string | null;
  cite: TsCite | null;
};
export type TsFix = { id: number; issue: string; cause: string; checks: string | null; partNumber: string | null; partName: string | null; by: string; at: string };
export type TsResult = {
  status: "ok" | "not-covered" | "no-sources" | "no-ai" | "rate-limit" | "failed";
  message: string | null;
  sources: TsSource[];
  pastFixes: TsFix[];
  causes: TsLine[];
  checks: TsLine[];
  howTo: TsLine[];
  parts: TsPart[];
  /** True when this variation has no readable parts book: every part then reads "Not in this model's parts book". */
  noPartsBook: boolean;
};

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

type Book = { id: number; title: string; manufacturer: string; model: string; grinder: boolean };

async function loadBook(sql: Sql, bookId: number): Promise<Book> {
  const rows = await sql.query<{ id: number; title: string; manufacturer: string | null }>("select id, title, manufacturer from library_books where id = $1", [bookId]);
  if (!rows[0]) throw new Error("That model is no longer in The Library.");
  const manufacturer = rows[0].manufacturer ?? "";
  const model = modelLabel(rows[0].title, manufacturer);
  const cats = await sql.query<{ category: string | null }>("select category from spec_sheets where book_id = $1", [bookId]);
  const grinder = cats.some((c) => isGrinder({ manufacturer, model, category: c.category })) || isGrinder({ manufacturer, model });
  return { id: Number(rows[0].id), title: rows[0].title, manufacturer, model, grinder };
}

/**
 * The files on this variation's chip — never another model's. That is what was added on the variation, plus the
 * manuals copied onto it from its parent's main chip (less any copy this variation removed).
 */
async function loadSources(sql: Sql, book: Book): Promise<TsSource[]> {
  type Row = { id: number; section: "spec" | "manuals" | "parts"; name: string; token: string; mime: string; text_pages: number | null; doc_type: string | null; book_id: number };
  const books = (await sql.query<{ id: number; title: string; manufacturer: string | null }>("select id, title, manufacturer from library_books")).map((b) => ({ id: Number(b.id), title: b.title, manufacturer: b.manufacturer ?? "" }));
  const self = { id: book.id, title: book.title, manufacturer: book.manufacturer };
  const main = mainChipFor(self, books);
  const all = await sql.query<Row>(
    `select id, section, name, token, mime, text_pages, doc_type, book_id from library_files
      where book_id in (${[book.id, ...(main ? [main.id] : [])].join(",")}) and complete
      order by case section when 'spec' then 0 when 'manuals' then 1 else 2 end, lower(name), id`,
  );
  const hidden = (await sql.query<{ file_id: number; book_id: number }>("select file_id, book_id from library_file_hidden where book_id = $1", [book.id])).map((h) => ({ fileId: Number(h.file_id), bookId: Number(h.book_id) }));
  const shaped = all.map((r) => ({ ...r, id: Number(r.id), bookId: Number(r.book_id) }));
  const copies = new Set(copiedManuals(self, books, shaped, hidden).map((f) => f.id));
  const rows = shaped.filter((r) => r.bookId === book.id || copies.has(r.id)).sort((a, b) => ["spec", "manuals", "parts"].indexOf(a.section) - ["spec", "manuals", "parts"].indexOf(b.section));
  const titleOf = (r: (typeof rows)[number]) => (r.bookId === book.id ? book.title : main?.title ?? book.title);
  return rows.map((r) => ({
    id: Number(r.id),
    // A manual is named by its type (Service And Repair Manual …) even when the file itself was renamed.
    label: r.section === "manuals" && r.doc_type ? r.doc_type : r.section === "spec" ? "Spec Sheet" : shortDocName(r.name, titleOf(r)),
    section: r.section,
    token: r.token,
    mime: r.mime,
    textPages: r.text_pages == null ? null : Number(r.text_pages),
  }));
}

async function loadPages(sql: Sql, fileIds: number[]): Promise<PageText[]> {
  if (!fileIds.length) return [];
  const rows = await sql.query<{ file_id: number; page: number; body: string }>(
    `select file_id, page, body from library_file_text where file_id in (${fileIds.map((n) => Number(n)).join(",")}) order by file_id, page`,
  );
  return rows.map((r) => ({ fileId: Number(r.file_id), page: Number(r.page), text: r.body }));
}

async function pastFixes(sql: Sql, bookId: number, issue: string): Promise<TsFix[]> {
  const rows = await sql.query<{ id: number; issue: string; cause: string; checks: string | null; part_number: string | null; part_name: string | null; fixed_by_name: string | null; created_at: string | Date }>(
    "select id, issue, cause, checks, part_number, part_name, fixed_by_name, created_at from library_fixes where book_id = $1 order by created_at desc, id desc limit 200",
    [bookId],
  );
  return rows
    .filter((r) => similarIssue(r.issue, issue))
    .slice(0, 5)
    .map((r) => ({ id: Number(r.id), issue: r.issue, cause: r.cause, checks: r.checks, partNumber: r.part_number, partName: r.part_name, by: r.fixed_by_name || "Teammate", at: new Date(r.created_at).toISOString() }));
}

// ---------------- reading the files ----------------

const bookInput = z.object({ bookId: z.number().int().positive() });

/** The files Troubleshoot would read for this variation, and whether each has been read yet. */
export const troubleshootSources = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof bookInput>) => bookInput.parse(d))
  .handler(async ({ data }): Promise<{ sources: TsSource[]; aiReady: boolean; fixCount: number }> => {
    const sql = await ready();
    const book = await loadBook(sql, data.bookId);
    const n = await sql.query<{ n: number }>("select count(*)::int as n from library_fixes where book_id = $1", [book.id]);
    return { sources: await loadSources(sql, book), aiReady: !!process.env.XAI_API_KEY, fixCount: Number(n[0]?.n) || 0 };
  });

const textInput = z.object({
  fileId: z.number().int().positive(),
  /** Pages in this batch. */
  pages: z.array(z.object({ page: z.number().int().min(1).max(5000), text: z.string().max(40_000) })).max(60),
  /** Sent with the last batch: how many pages the document has. 0 = it could not be read. */
  totalPages: z.number().int().min(0).max(5000).optional(),
});

/** The text of a stored PDF, page by page, read once in the browser and kept so the right page can be found and cited. */
export const saveLibraryFileText = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof textInput>) => textInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; textPages: number | null }> => {
    const sql = await ready();
    const file = await sql.query<{ id: number }>("select id from library_files where id = $1 and complete and book_id is not null", [data.fileId]);
    if (!file[0]) throw new Error("That file is no longer in The Library.");
    for (const p of data.pages) {
      const body = p.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (body.replace(/\s/g, "").length < 20) continue;
      await sql.query("insert into library_file_text (file_id, page, body) values ($1, $2, $3) on conflict (file_id, page) do update set body = excluded.body", [data.fileId, p.page, body]);
    }
    if (data.totalPages === undefined) return { ok: true, textPages: null };
    const n = await sql.query<{ n: number }>("select count(*)::int as n from library_file_text where file_id = $1", [data.fileId]);
    const textPages = Number(n[0]?.n) || 0;
    await sql.query("update library_files set text_pages = $2 where id = $1", [data.fileId, textPages]);
    return { ok: true, textPages };
  });

// ---------------- the answer ----------------

const lineSchema = z.object({ text: z.string().trim().min(3).max(1200), source: z.string(), page: z.coerce.number().int() });
const answerSchema = z.object({
  covered: z.boolean(),
  causes: z.array(lineSchema).max(12).default([]),
  checks: z.array(lineSchema).max(16).default([]),
  howTo: z.array(lineSchema).max(12).default([]),
  parts: z.array(z.object({ name: z.string().trim().min(2).max(120) })).max(10).default([]),
});
const partsSchema = z.object({
  parts: z
    .array(z.object({ name: z.string(), number: z.string().nullable().optional(), partName: z.string().nullable().optional(), source: z.string().nullable().optional(), page: z.coerce.number().int().nullable().optional() }))
    .max(12)
    .default([]),
});

function parseJson<T>(raw: string, schema: z.ZodType<T>): T | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const block = (pages: PageText[]) => pages.map((p) => `[[${pageTag(p)}]]\n${p.text}`).join("\n\n");

function manualPrompt(book: Book, labels: Map<number, string>): string {
  const list = [...labels].map(([id, label]) => `S${id} = ${label}`).join("; ");
  return `You help a service technician with ONE machine: ${book.manufacturer} ${book.model}.
You are given pages from the files stored for that machine (its manuals and spec sheet). Each page starts with a tag like [[S12 p3]] (source 12, page 3). Sources: ${list}.

Answer ONLY from those pages. Return one JSON object:
{
  "covered": boolean,        // false when the pages do not cover this issue
  "causes":  [{"text": string, "source": "S12", "page": 3}],   // possible causes the manual gives for this issue
  "checks":  [{"text": string, "source": "S12", "page": 3}],   // what to check, in the order the manual gives
  "howTo":   [{"text": string, "source": "S12", "page": 3}],   // how to check: the manual's own test, in the manual's words
  "parts":   [{"name": string}]                               // parts the manual calls for, by the manual's name
}

Rules:
- Every item must come from a page you were given, and must name that page's source and page number.
- Use the manual's wording. Do not add a step, a test, a value or a part the pages do not state.
- Do not give part numbers. They come from the parts book, separately.
- If the pages do not cover the issue, return "covered": false with empty lists. Do not fall back on general knowledge, the web, or another model or variation.${
    book.grinder ? "\n- This machine is a grinder: it has no water line and no drain. Do not return water or drain steps." : ""
  }
- JSON only. No markdown.`;
}

function partsPrompt(book: Book): string {
  return `You are given pages from the parts book for ONE machine: ${book.manufacturer} ${book.model}. Each page starts with a tag like [[S12 p3]].
For each part named by the technician's manual, find it in these pages. Return one JSON object:
{"parts": [{"name": string, "number": string|null, "partName": string|null, "source": "S12"|null, "page": number|null}]}
- "name" is the name you were asked about, unchanged.
- "number" is the part number exactly as printed on the page; "partName" is the part's name as printed there.
- If the part is not on these pages, use null for number, partName, source and page. Never guess or build a number.
- JSON only. No markdown.`;
}

const runInput = z.object({ bookId: z.number().int().positive(), issue: z.string().trim().min(3).max(300) });

export type TsQuick = {
  status: "ok" | "not-covered" | "no-sources";
  message: string | null;
  sources: TsSource[];
  pastFixes: TsFix[];
  /** Lines from this variation's own files that hold the issue's words, as written there. */
  lines: TsLine[];
  aiReady: boolean;
};

/**
 * The fast first answer: a plain search of the files stored on this variation — no AI, no other model.
 * Returns the matching lines with their file and page, and this variation's past fixes. When nothing matches,
 * it says so at once and the slower reading step is never started.
 */
export const findTroubleshootLines = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof runInput>) => runInput.parse(d))
  .handler(async ({ data }): Promise<TsQuick> => {
    const sql = await ready();
    const book = await loadBook(sql, data.bookId);
    const sources = await loadSources(sql, book);
    const fixes = await pastFixes(sql, book.id, data.issue);
    const aiReady = !!process.env.XAI_API_KEY;
    const base = { sources, pastFixes: fixes, lines: [] as TsLine[], aiReady };
    if (!sources.some((s) => s.section !== "parts")) return { ...base, status: "no-sources", message: `${NO_FILE} ${book.model} has no manual or spec sheet stored. Nothing is taken from another model.` };
    const readable = sources.filter((s) => (s.textPages ?? 0) > 0);
    if (!readable.some((s) => s.section !== "parts")) return { ...base, status: "no-sources", message: `${NO_FILE} The files stored on ${book.model} have no readable text (scanned pages, Word files or pictures).` };
    const byId = new Map(sources.map((s) => [s.id, s]));
    const found = matchingLines(await loadPages(sql, readable.map((s) => s.id)), data.issue, 8);
    const lines = dropWetSteps(
      found.map((l) => ({ text: l.text, cite: { fileId: l.fileId, label: byId.get(l.fileId)?.label ?? "File", page: l.page, token: byId.get(l.fileId)?.token ?? "" } })),
      book.grinder,
    );
    if (!lines.length) return { ...base, status: "not-covered", message: `${NO_FILE} The files stored on ${book.model} don't mention it. Try the words the manual uses, or the error code on the display.` };
    return { ...base, status: "ok", message: null, lines };
  });

export const runTroubleshoot = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof runInput>) => runInput.parse(d))
  .handler(async ({ data, context }): Promise<TsResult> => {
    const sql = await ready();
    const book = await loadBook(sql, data.bookId);
    const sources = await loadSources(sql, book);
    const fixes = await pastFixes(sql, book.id, data.issue);
    // Steps come from this variation's manuals and spec sheet; part numbers only from its parts book.
    const manuals = sources.filter((s) => s.section !== "parts" && (s.textPages ?? 0) > 0);
    const partsBooks = sources.filter((s) => s.section === "parts" && (s.textPages ?? 0) > 0);
    const base: TsResult = { status: "ok", message: null, sources, pastFixes: fixes, causes: [], checks: [], howTo: [], parts: [], noPartsBook: !partsBooks.length };
    const stop = (status: TsResult["status"], message: string): TsResult => ({ ...base, status, message });

    if (!sources.some((s) => s.section !== "parts")) {
      return stop("no-sources", `${NO_FILE} ${book.model} has no manual or spec sheet stored. Nothing is taken from another model.`);
    }
    if (!manuals.length) {
      return stop("no-sources", `${NO_FILE} The files stored on ${book.model} have no readable text (scanned pages, Word files or pictures).`);
    }
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return stop("no-ai", "Reading the manuals isn't available here yet. Open the manual from the list above.");
    const used = await sql.query<{ n: number }>("select count(*)::int as n from troubleshoot_log where user_id = $1 and created_at > now() - interval '1 hour'", [context.userId]);
    if ((used[0]?.n ?? 0) >= TROUBLESHOOTS_PER_HOUR) return stop("rate-limit", `That's ${TROUBLESHOOTS_PER_HOUR} lookups in the last hour. Try again in a little while, or open the manual from the list above.`);

    const labels = new Map(sources.map((s) => [s.id, s.label]));
    const picked = pickPages(await loadPages(sql, manuals.map((m) => m.id)), data.issue, MANUAL_BUDGET);
    if (!picked.length) return stop("not-covered", `${NO_FILE} The files stored on ${book.model} don't mention it. Try the words the manual uses, or the error code on the display.`);
    await sql.query("insert into troubleshoot_log (user_id) values ($1)", [context.userId]);

    const byTag = new Map(picked.map((p) => [pageTag(p), p]));
    const tokens = new Map(sources.map((s) => [s.id, s.token]));
    const cite = (p: PageText): TsCite => ({ fileId: p.fileId, label: labels.get(p.fileId) ?? "Manual", page: p.page, token: tokens.get(p.fileId) ?? "" });
    // A line is kept only when the page it cites was one we sent, and its words are on that page.
    const keep = (items: z.infer<typeof lineSchema>[]): TsLine[] => {
      const out: TsLine[] = [];
      for (const item of items) {
        const page = byTag.get(`${item.source.trim().toUpperCase().replace(/^S?/, "S")} p${item.page}`);
        if (!page || !groundedIn(item.text, page.text)) continue;
        out.push({ text: item.text, cite: cite(page) });
      }
      return dropWetSteps(out, book.grinder);
    };

    try {
      const raw = await callXai(apiKey, [
        { role: "system", content: manualPrompt(book, new Map(manuals.map((m) => [m.id, m.label]))) },
        { role: "user", content: `Issue, in the technician's words: "${data.issue}"\n\nManual pages:\n\n${block(picked)}` },
      ]);
      const answer = parseJson(raw, answerSchema);
      if (!answer) return stop("failed", "The manuals could not be read cleanly this time. Try again, or open the manual from the list above.");
      const causes = keep(answer.causes);
      const checks = keep(answer.checks);
      const howTo = keep(answer.howTo);
      if (!answer.covered || (!causes.length && !checks.length && !howTo.length)) {
        return stop("not-covered", `${NO_FILE} Nothing is filled in from another model.`);
      }

      // Parts: only what the manual called for, and only numbers printed in this variation's parts book.
      const manualText = picked.map((p) => p.text).join("\n");
      const called = [...new Map(answer.parts.filter((p) => groundedIn(p.name, manualText, 0.75)).map((p) => [p.name.toLowerCase(), p.name])).values()].slice(0, 8);
      const parts: TsPart[] = called.map((name) => ({ name, number: null, bookName: null, cite: null }));
      if (parts.length && partsBooks.length) {
        const partPages = pickPages(await loadPages(sql, partsBooks.map((b) => b.id)), called.join(" "), PARTS_BUDGET);
        if (partPages.length) {
          const partTags = new Map(partPages.map((p) => [pageTag(p), p]));
          const found = parseJson(
            await callXai(apiKey, [
              { role: "system", content: partsPrompt(book) },
              { role: "user", content: `Parts to find: ${called.map((n) => `"${n}"`).join(", ")}\n\nParts book pages:\n\n${block(partPages)}` },
            ]),
            partsSchema,
          );
          for (const hit of found?.parts ?? []) {
            const part = parts.find((p) => p.name.toLowerCase() === hit.name.trim().toLowerCase());
            const page = hit.source && hit.page != null ? partTags.get(`${hit.source.trim().toUpperCase().replace(/^S?/, "S")} p${hit.page}`) : undefined;
            // The number must be printed on the page it cites. Anything else stays "Not in this model's parts book".
            if (!part || !page || !hit.number || !partNumberOnPage(hit.number, page.text)) continue;
            part.number = hit.number.trim();
            part.bookName = hit.partName?.trim().slice(0, 120) || null;
            part.cite = cite(page);
          }
        }
      }
      return { ...base, causes, checks, howTo, parts };
    } catch (e) {
      const why = e instanceof Error ? (e.name === "AbortError" ? "it took too long" : e.message) : "unknown error";
      return stop("failed", `Reading the manuals failed (${why}). Try again, or open the manual from the list above.`);
    }
  });

// ---------------- assist: plain language, still cited ----------------

const explainInput = z.object({
  bookId: z.number().int().positive(),
  issue: z.string().trim().min(3).max(300),
  cites: z.array(z.object({ fileId: z.number().int().positive(), page: z.number().int().min(1) })).min(1).max(20),
});
export type TsExplain = { status: "ok" | "not-covered" | "no-ai" | "failed"; message: string | null; lines: TsLine[] };

/** Explains the manual's steps in plain language. Every line cites the stored manual page it explains. */
export const explainTroubleshoot = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof explainInput>) => explainInput.parse(d))
  .handler(async ({ data }): Promise<TsExplain> => {
    const sql = await ready();
    const book = await loadBook(sql, data.bookId);
    const sources = await loadSources(sql, book);
    const mine = new Set(sources.map((s) => s.id));
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { status: "no-ai", message: "Plain-language help isn't available here yet.", lines: [] };
    const wanted = data.cites.filter((c) => mine.has(c.fileId));
    const all = await loadPages(sql, [...new Set(wanted.map((c) => c.fileId))]);
    const pages = all.filter((p) => wanted.some((c) => c.fileId === p.fileId && c.page === p.page)).map((p) => ({ ...p, text: p.text.slice(0, 6000) }));
    if (!pages.length) return { status: "not-covered", message: NO_FILE, lines: [] };
    const byTag = new Map(pages.map((p) => [pageTag(p), p]));
    try {
      const raw = await callXai(apiKey, [
        {
          role: "system",
          content: `You explain manual pages for ${book.manufacturer} ${book.model} to a service technician in plain language.
Each page starts with a tag like [[S12 p3]]. Return one JSON object: {"covered": boolean, "lines": [{"text": string, "source": "S12", "page": 3}]}.
- Each line explains, in simple words, what one step on its cited page means and what the technician does. Keep the manual's values and order.
- Do not add a fix, a value or a part the page does not state. Do not replace the manual's procedure with a different one.
- If the pages do not cover the issue, return "covered": false and no lines.${book.grinder ? "\n- This machine is a grinder: no water or drain steps." : ""}
- JSON only.`,
        },
        { role: "user", content: `Issue: "${data.issue}"\n\nPages:\n\n${block(pages)}` },
      ]);
      const answer = parseJson(raw, z.object({ covered: z.boolean(), lines: z.array(lineSchema).max(16).default([]) }));
      if (!answer) return { status: "failed", message: "The explanation could not be read cleanly. Try again.", lines: [] };
      const labels = new Map(sources.map((s) => [s.id, s]));
      const lines: TsLine[] = [];
      for (const item of answer.lines) {
        const page = byTag.get(`${item.source.trim().toUpperCase().replace(/^S?/, "S")} p${item.page}`);
        // Plain language uses other words than the manual, so the bar is lower — but it must still be about that page.
        if (!page || !groundedIn(item.text, page.text, 0.3)) continue;
        const src = labels.get(page.fileId);
        lines.push({ text: item.text, cite: { fileId: page.fileId, label: src?.label ?? "Manual", page: page.page, token: src?.token ?? "" } });
      }
      const kept = dropWetSteps(lines, book.grinder);
      if (!answer.covered || !kept.length) return { status: "not-covered", message: NO_FILE, lines: [] };
      return { status: "ok", message: null, lines: kept };
    } catch (e) {
      return { status: "failed", message: `The explanation failed (${e instanceof Error ? e.message : "unknown error"}).`, lines: [] };
    }
  });

// ---------------- resolutions ----------------

const fixInput = z.object({
  bookId: z.number().int().positive(),
  issue: z.string().trim().min(3).max(300),
  cause: z.string().trim().min(2).max(600),
  checks: z.array(z.string().trim().min(1).max(600)).max(20).default([]),
  partNumber: z.string().trim().max(80).nullable().optional(),
  partName: z.string().trim().max(160).nullable().optional(),
});

/** Marked fixed: what worked, on which variation, by whom, when. Shown next time this variation has a similar issue. */
export const saveTroubleshootFix = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof fixInput>) => fixInput.parse(d))
  .handler(async ({ data, context }): Promise<TsFix> => {
    const sql = await ready();
    const book = await loadBook(sql, data.bookId);
    const who = await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [context.userId]);
    const name = who[0]?.username || "Teammate";
    const rows = await sql.query<{ id: number; created_at: string | Date }>(
      `insert into library_fixes (book_id, issue, cause, checks, part_number, part_name, fixed_by, fixed_by_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, created_at`,
      [book.id, data.issue, data.cause, data.checks.length ? data.checks.join("\n") : null, data.partNumber || null, data.partName || null, context.userId, name],
    );
    return {
      id: Number(rows[0]!.id),
      issue: data.issue,
      cause: data.cause,
      checks: data.checks.length ? data.checks.join("\n") : null,
      partNumber: data.partNumber || null,
      partName: data.partName || null,
      by: name,
      at: new Date(rows[0]!.created_at).toISOString(),
    };
  });
