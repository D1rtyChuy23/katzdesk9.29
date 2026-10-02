/**
 * The Library — Manuals and Parts Diagrams. Files are stored in Postgres (bytea) in ~1 MB pieces.
 * Everyone with Desk access can list, open and share links; only Admin and Sales add or delete.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { CHUNK_BYTES, fileError, mimeFor, sortByName, type LibrarySection } from "@/lib/ops/library-file-rules";

export type LibraryFile = {
  id: number;
  section: LibrarySection;
  name: string;
  mime: string;
  size: number;
  token: string;
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
  return { canEdit: flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "sales", name: rows[0]?.username || "Teammate" };
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
const section = z.enum(["manuals", "parts"]);

export const listLibraryFiles = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ files: LibraryFile[]; canEdit: boolean }> => {
    const sql = await ready();
    const role = await roleOf(sql, context.userId);
    const rows = await sql.query<{
      id: number; section: LibrarySection; name: string; mime: string; size: number; token: string; added_by_name: string | null; created_at: string | Date;
    }>("select id, section, name, mime, size, token, added_by_name, created_at from library_files where complete order by lower(name), id");
    const files = rows.map((r) => ({
      id: Number(r.id),
      section: r.section,
      name: r.name,
      mime: r.mime,
      size: Number(r.size),
      token: r.token,
      addedBy: r.added_by_name || "Teammate",
      createdAt: new Date(r.created_at).toISOString(),
    }));
    return { files: sortByName(files), canEdit: role.canEdit };
  });

export const startLibraryFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { section: LibrarySection; name: string; size: number }) =>
    z.object({ section, name: z.string().trim().min(1).max(200), size: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: number }> => {
    const sql = await ready();
    const role = await requireEditor(sql, context.userId);
    const problem = fileError(data.name, data.size);
    if (problem) throw new Error(problem);
    // Uploads that were abandoned part-way are swept here.
    await sql.query("delete from library_files where not complete and created_at < now() - interval '1 hour'");
    const rows = await sql.query<{ id: number }>(
      `insert into library_files (section, name, mime, size, token, added_by, added_by_name)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [data.section, data.name, mimeFor(data.name), data.size, newToken(), context.userId, role.name],
    );
    return { id: Number(rows[0]!.id) };
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
    await sql.query("delete from library_files where id = $1", [data.id]);
    return { ok: true };
  });
