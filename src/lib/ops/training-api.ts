/**
 * The Library — Education And Training. Training material is stored like any Library file (in pieces, opened by
 * its link), but under a topic, never in a model book. Everyone on the desk can open and send a file; Admin and
 * Sales add or delete, the same as the rest of The Library.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { sortByName } from "@/lib/ops/library-file-rules";
import { TRAINING_TOPICS, isTrainingTopic, topicLabel, trainingFileError, trainingFileName, trainingMime, type TrainingTopic } from "@/lib/ops/training";

export type TrainingFile = {
  id: number;
  topic: TrainingTopic;
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
  return { canEdit: flagOn(rows[0]?.is_admin) || rows[0]?.desk_role === "admin" || rows[0]?.desk_role === "sales", name: rows[0]?.username || "Teammate" };
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const topicInput = z.enum(TRAINING_TOPICS.map((t) => t.key) as [TrainingTopic, ...TrainingTopic[]]);

export const listTrainingFiles = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ files: TrainingFile[]; canEdit: boolean }> => {
    const sql = await ready();
    const role = await roleOf(sql, context.userId);
    const rows = await sql.query<{ id: number; topic: string; name: string; mime: string; size: number; token: string; added_by_name: string | null; created_at: string | Date }>(
      "select id, topic, name, mime, size, token, added_by_name, created_at from library_files where section = 'training' and complete order by lower(name), id",
    );
    const files = rows
      .filter((r) => isTrainingTopic(r.topic))
      .map((r) => ({
        id: Number(r.id),
        topic: r.topic as TrainingTopic,
        name: r.name,
        mime: r.mime,
        size: Number(r.size),
        token: r.token,
        addedBy: r.added_by_name || "Teammate",
        createdAt: new Date(r.created_at).toISOString(),
      }));
    return { files: sortByName(files), canEdit: role.canEdit };
  });

/**
 * Open an upload under a topic. The pieces and the finish step are the Library's own (appendLibraryChunk,
 * finishLibraryFile). The file keeps the name it was dropped with and is never given a book.
 */
export const startTrainingFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { topic: TrainingTopic; name: string; size: number }) =>
    z.object({ topic: topicInput, name: z.string().trim().min(1).max(200), size: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: number; name: string; topic: TrainingTopic }> => {
    const sql = await ready();
    const role = await roleOf(sql, context.userId);
    if (!role.canEdit) throw new Error("Only Admin and Sales can add training files.");
    const problem = trainingFileError(data.name, data.size);
    if (problem) throw new Error(problem);
    await sql.query("delete from library_files where not complete and created_at < now() - interval '1 hour'");
    const taken = await sql.query<{ name: string }>("select name from library_files where section = 'training' and topic = $1", [data.topic]);
    const name = trainingFileName(data.name, taken.map((t) => t.name));
    const rows = await sql.query<{ id: number }>(
      `insert into library_files (section, topic, name, original_name, mime, size, token, added_by, added_by_name, book_id)
       values ('training', $1, $2, $3, $4, $5, $6, $7, $8, null) returning id`,
      [data.topic, name, data.name, trainingMime(data.name), data.size, newToken(), context.userId, role.name],
    );
    return { id: Number(rows[0]!.id), name, topic: data.topic };
  });

export const deleteTrainingFile = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; topic: string }> => {
    const sql = await ready();
    const role = await roleOf(sql, context.userId);
    if (!role.canEdit) throw new Error("Only Admin and Sales can delete training files.");
    const rows = await sql.query<{ topic: string }>("delete from library_files where id = $1 and section = 'training' returning topic", [data.id]);
    if (!rows[0]) throw new Error("That training file is no longer here.");
    return { ok: true, topic: topicLabel(rows[0].topic) };
  });
