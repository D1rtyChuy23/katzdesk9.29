/**
 * Unofficial sources on a Library variation: links and notes from the field, kept apart from the manufacturer's
 * files. Anyone with Desk access can add one and remove their own; Admin and Sales can remove any.
 * Troubleshoot does not read these: its steps come only from the files stored on the variation.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { cleanUnofficial } from "@/lib/ops/legacy-rules";

export type UnofficialSource = {
  id: number;
  url: string | null;
  note: string | null;
  by: string;
  at: string;
  /** This person added it, or may remove any (Admin, Sales). */
  canRemove: boolean;
};

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function who(sql: Sql, userId: string) {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  return { editor: flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "sales", name: rows[0]?.username || "Teammate" };
}

async function load(sql: Sql, bookId: number, userId: string): Promise<UnofficialSource[]> {
  const me = await who(sql, userId);
  const rows = await sql.query<{ id: number; url: string | null; note: string | null; added_by: string | null; added_by_name: string | null; created_at: string | Date }>(
    "select id, url, note, added_by, added_by_name, created_at from library_unofficial_sources where book_id = $1 order by created_at desc, id desc",
    [bookId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    url: r.url,
    note: r.note,
    by: r.added_by_name || "Teammate",
    at: new Date(r.created_at).toISOString(),
    canRemove: me.editor || r.added_by === userId,
  }));
}

export const listUnofficialSources = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { bookId: number }) => z.object({ bookId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<UnofficialSource[]> => load(await ready(), data.bookId, context.userId));

export const addUnofficialSource = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { bookId: number; url?: string | null; note?: string | null }) =>
    z.object({ bookId: z.number().int().positive(), url: z.string().max(1000).nullable().optional(), note: z.string().max(4000).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<UnofficialSource[]> => {
    const sql = await ready();
    const clean = cleanUnofficial({ url: data.url, note: data.note });
    if ("error" in clean) throw new Error(clean.error);
    const book = await sql.query("select 1 from library_books where id = $1", [data.bookId]);
    if (!book.length) throw new Error("That model is no longer in The Library.");
    const me = await who(sql, context.userId);
    await sql.query("insert into library_unofficial_sources (book_id, url, note, added_by, added_by_name) values ($1, $2, $3, $4, $5)", [
      data.bookId,
      clean.url,
      clean.note,
      context.userId,
      me.name,
    ]);
    return load(sql, data.bookId, context.userId);
  });

export const removeUnofficialSource = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<UnofficialSource[]> => {
    const sql = await ready();
    const row = (await sql.query<{ book_id: number; added_by: string | null }>("select book_id, added_by from library_unofficial_sources where id = $1", [data.id]))[0];
    if (!row) throw new Error("That entry is already gone.");
    const me = await who(sql, context.userId);
    if (!me.editor && row.added_by !== context.userId) throw new Error("Only the person who added it, or Admin and Sales, can remove it.");
    await sql.query("delete from library_unofficial_sources where id = $1", [data.id]);
    return load(sql, Number(row.book_id), context.userId);
  });
