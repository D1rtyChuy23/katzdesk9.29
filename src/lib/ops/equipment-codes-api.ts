import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { codeRowsFromMatrix, planCodes, WILL_WRITE, type CodePlanLine, type CodePlanStatus } from "@/lib/ops/equipment-codes";
import { makerOf } from "@/lib/ops/library-file-rules";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

export type CodesPreview = {
  total: number;
  counts: Record<CodePlanStatus, number>;
  lines: CodePlanLine[];
  /** Variations created and MPNs recorded by an apply; zero on a preview. */
  added: number;
  mpnSet: number;
};

const STATUSES: CodePlanStatus[] = ["new", "new-mpn", "exists", "set-mpn", "same", "needs-mpn", "conflict", "invalid"];

/**
 * Read a worklist (Manufacturer, Model, MPN, optionally Item Code) and add each model to The Library under its
 * manufacturer. An MPN is recorded only when the row has one. No file is attached by this import.
 * Admin and Sales only, like the rest of the Library.
 */
export const importEquipmentCodes = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string; apply: boolean }) =>
    z.object({ filename: z.string().max(300), base64: z.string().min(4), apply: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CodesPreview> => {
    const sql = await ready();
    const who = (await sql.query<{ is_admin: boolean; desk_role: string | null }>("select is_admin, desk_role from desk_accounts where user_id = $1", [context.userId]))[0];
    if (!(flagOn(who?.is_admin) || who?.desk_role === "sales")) throw new Error("Only Admin and Sales can add models to The Library.");
    if (data.base64.length > 8_000_000) throw new Error("That file is too large.");

    const wb = XLSX.read(data.base64, { type: "base64", raw: true, cellText: true });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("The file is empty.");
    const rows = codeRowsFromMatrix(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false }));
    if (!rows.length) throw new Error("No rows under the header.");
    if (rows.length > 2000) throw new Error("Up to 2,000 rows at a time.");

    const books = (await sql.query<{ id: number; title: string; manufacturer: string | null; mpn: string | null }>(
      "select id, title, manufacturer, mpn from library_books",
    )).map((b) => ({ id: Number(b.id), title: b.title, manufacturer: b.manufacturer ?? "", mpn: b.mpn }));
    const lines = planCodes(rows, books);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, lines.filter((l) => l.status === s).length])) as Record<CodePlanStatus, number>;
    const preview: CodesPreview = { total: lines.length, counts, lines, added: 0, mpnSet: 0 };
    if (!data.apply) return preview;

    for (const l of lines) {
      if (!WILL_WRITE.includes(l.status)) continue;
      let id = l.bookId;
      if (id == null) {
        const maker = makerOf(l.title, [l.manufacturer]);
        const made = await sql.query<{ id: number }>(
          `insert into library_books (title, manufacturer, created_by, per_variation) values ($1, $2, $3, true)
           on conflict (lower(title)) do nothing returning id`,
          [l.title, l.manufacturer || maker, context.userId],
        );
        if (made[0]) preview.added += 1;
        id = Number(
          made[0]?.id ?? (await sql.query<{ id: number }>("select id from library_books where lower(title) = lower($1)", [l.title]))[0]?.id,
        );
      }
      if (l.mpn && (l.status === "new-mpn" || l.status === "set-mpn")) {
        try {
          const done = await sql.query("update library_books set mpn = $2 where id = $1 and (mpn is null or btrim(mpn) = '') returning id", [id, l.mpn]);
          if (done.length) preview.mpnSet += 1;
        } catch {
          /* the MPN went to another model in the meantime: left unset */
        }
      }
    }
    return preview;
  });
