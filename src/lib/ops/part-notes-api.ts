/**
 * Import Part Notes (CSV): Parts → Import, Admin only (the Admin role or a desk admin), checked here. With apply false
 * nothing is written: that is the preview. Confirm sends the file again with the rows its preview showed as Add, plans
 * it again against the notes stored then, writes only rows that are still an Add for the same part, and writes in one
 * statement: each part's note gets the new lines added, and only while it still reads as it did when planned, so
 * nothing anyone else saved meanwhile is overwritten (that part is listed as changed). Only the note (and
 * the part's updated time) changes; name, description, SKU, MPN, class, photos, bins and hidden are never touched, and
 * no part is ever created (a row that names none is "not found"). Each
 * Confirm is logged in part_import_runs (kind notes) with what it added, skipped and didn't find. The planning is in
 * part-notes.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  NOTE_ROWS_MAX,
  csvTextFromBytes,
  noteCounts,
  noteRowsFromSheets,
  noteWrites,
  planPartNotes,
  skuKey,
  type NoteCounts,
  type NoteFileRow,
  type NotePart,
  type NotePlanLine,
} from "@/lib/ops/part-notes";

type Query = Pick<Sql, "query">;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

/** The Admin's name for the import log, or an error for anyone else. */
async function requireAdmin(sql: Query, userId: string): Promise<string> {
  if (!(await canReviewNames(sql as Sql, userId))) throw new Error("Only an Admin can import part notes.");
  const row = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0];
  return row?.username?.trim() || "Admin";
}

/** The file's sheets: a CSV read as text (UTF-8, else Excel's Windows code page), or an Excel file. */
export function readNoteSheets(base64: string): { name: string; matrix: unknown[][] }[] {
  if (base64.length > 4_000_000) throw new Error("That file is too large.");
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  const excel = bytes[0] === 0x50 && bytes[1] === 0x4b;
  // A CSV is split on commas only (left to guess, a file of notes full of semicolons reads as split on those), and
  // blank lines are kept so each row keeps its line number in the file.
  const wb = excel
    ? XLSX.read(base64, { type: "base64", raw: true, cellText: true })
    : XLSX.read(csvTextFromBytes(bytes), { type: "string", raw: true, FS: "," });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name] ?? {}, { header: 1, defval: "", blankrows: true, raw: false }),
  }));
  if (!sheets.length) throw new Error("The file is empty.");
  return sheets;
}

/** The parts the file names, by id or SKU, and the parts they were merged into (for the reason). */
async function loadNoteParts(sql: Query, rows: NoteFileRow[]): Promise<NotePart[]> {
  const ids = [...new Set(rows.map((r) => r.idRaw).filter((v) => /^\d{1,9}$/.test(v)).map(Number))];
  const skus = [...new Set(rows.map((r) => skuKey(r.sku)).filter(Boolean))];
  const found = await sql.query<Record<string, unknown>>(
    `select b.id, b.sku, b.item, b.description, b.kind, b.note, (b.hidden_at is not null) as hidden, b.merged_into
       from billing_items b
      where b.id = any($1::int[]) or lower(btrim(b.sku)) = any($2::text[])
         or b.id in (select m.merged_into from billing_items m where m.merged_into is not null and (m.id = any($1::int[]) or lower(btrim(m.sku)) = any($2::text[])))`,
    [ids, skus],
  );
  return found.map((r) => ({
    id: Number(r.id),
    sku: String(r.sku ?? ""),
    item: String(r.item ?? ""),
    description: r.description == null ? null : String(r.description),
    kind: String(r.kind ?? ""),
    note: r.note == null ? null : String(r.note),
    hidden: !!r.hidden,
    mergedInto: r.merged_into == null ? null : Number(r.merged_into),
  }));
}

/**
 * One statement: each part's note set to its note after, only while it still reads as planned and the part is still
 * shown and not merged; then the run logged. $1 ids, $2 notes before, $3 notes after, $4 notes per part, $5 file,
 * $6 rows, $7 skipped, $8 not found, $9 who.
 */
export const APPLY_PART_NOTES_SQL = `with plan as (
  select * from unnest($1::int[], $2::text[], $3::text[], $4::int[]) as p(id, before, after, notes)
), written as (
  update billing_items b set note = p.after, updated_at = now()
    from plan p
   where b.id = p.id
     and b.note is not distinct from p.before
     and b.hidden_at is null and b.merged_into is null and b.kind not in ('trip', 'labor')
  returning b.id
), run as (
  insert into part_import_runs (kind, filename, row_count, added, skipped, not_found, approved_by)
  select 'notes', $5, $6,
         coalesce((select sum(p.notes) from plan p where p.id in (select id from written)), 0)::int,
         $7 + coalesce((select sum(p.notes) from plan p where p.id not in (select id from written)), 0)::int,
         $8, $9
  returning id
)
select coalesce(array_agg(w.id), '{}') as written, (select id from run) as run_id from written w`;

export type NotesResult = { added: number; parts: number; changed: number; runId: number | null };

export type NotesPreview = {
  filename: string;
  counts: NoteCounts;
  lines: NotePlanLine[];
  applied: boolean;
  result: NotesResult | null;
};

const input = z
  .object({
    filename: z.string().max(300),
    base64: z.string().min(4),
    apply: z.boolean(),
    /** With Confirm: the rows the preview showed as Add, each with its part. Only those can be written. */
    expect: z
      .array(z.object({ line: z.number().int().positive(), partId: z.number().int().positive() }))
      .max(NOTE_ROWS_MAX)
      .optional(),
  })
  .refine((d) => !d.apply || d.expect != null, { message: "Preview the file first." });

/**
 * Import Part Notes (CSV): sku (or id), note. Confirm sends the file again with the rows its preview showed as Add; the
 * file is planned again then, and a row is written only when it is still an Add for the same part.
 */
export const importPartNotes = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof input>) => input.parse(d))
  .handler(async ({ data, context }): Promise<NotesPreview> => importPartNotesFor(await ready(), data, context.userId));

/** The body of importPartNotes. */
export async function importPartNotesFor(sql: Query, data: z.infer<typeof input>, userId: string): Promise<NotesPreview> {
  const who = await requireAdmin(sql, userId);
  if (data.apply && !data.expect) throw new Error("Preview the file first.");
  const rows = noteRowsFromSheets(readNoteSheets(data.base64));
  if (!rows.length) throw new Error("No rows under the header.");
  if (rows.length > NOTE_ROWS_MAX) throw new Error(`Up to ${NOTE_ROWS_MAX.toLocaleString("en-US")} rows at a time.`);
  const planned = planPartNotes(rows, await loadNoteParts(sql, rows));
  if (!data.apply) return { filename: data.filename, counts: noteCounts(planned), lines: planned, applied: false, result: null };

  // Confirm writes only what its preview showed: a row that is an Add now but wasn't one for this part then (a SKU or
  // a merge changed in between) is left for the next run.
  const shown = new Set((data.expect ?? []).map((e) => `${e.line}:${e.partId}`));
  const lines = planned.map((l): NotePlanLine =>
    l.status === "add" && l.part && !shown.has(`${l.line}:${l.part.id}`)
      ? { ...l, status: "changed", reason: "Not an Add for this part in the preview you confirmed, so nothing was added. Run the file again." }
      : l,
  );
  const writes = noteWrites(lines);
  const before = noteCounts(lines);
  const out = (
    await sql.query<{ written: unknown; run_id: number | null }>(APPLY_PART_NOTES_SQL, [
      writes.map((w) => w.id),
      writes.map((w) => w.before),
      writes.map((w) => w.after),
      writes.map((w) => w.notes),
      data.filename,
      rows.length,
      before.skipped,
      before.notFound,
      who,
    ])
  )[0];
  const written = new Set((Array.isArray(out?.written) ? out.written : []).map(Number));
  // A part whose note changed after it was read (someone saved it meanwhile) got nothing: say so on its rows.
  const done = lines.map((l): NotePlanLine =>
    l.status === "add" && l.part && !written.has(l.part.id) ? { ...l, status: "changed", reason: "The part changed while this ran; nothing was added. Run the file again." } : l,
  );
  const counts = noteCounts(done);
  return {
    filename: data.filename,
    counts,
    lines: done,
    applied: true,
    result: { added: counts.add, parts: counts.parts, changed: counts.changed, runId: out?.run_id == null ? null : Number(out.run_id) },
  };
}
