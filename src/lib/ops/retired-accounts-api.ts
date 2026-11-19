/** Make an inactive or Retired account active again (Admin only). It's offered in pickers and takes new work again. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";

export const MAKE_ACTIVE_ADMIN_ONLY = "Only an Admin can make an account active again.";

export async function makeAccountActiveFor(sql: Pick<Sql, "query">, input: { id: number; admin: boolean; who: string }): Promise<{ name: string }> {
  if (!input.admin) throw new Error(MAKE_ACTIVE_ADMIN_ONLY);
  const row = (
    await sql.query<{ name: string; retired: boolean }>(
      `with was as (select id, retired_at is not null as retired from directory_customers where id = $1 and archived = false and inactive = true)
       update directory_customers d set inactive = false, retired_at = null, updated_at = now()
         from was where d.id = was.id
       returning d.name, was.retired`,
      [input.id],
    )
  )[0];
  if (!row) throw new Error("That account isn't inactive any more.");
  await sql
    .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, 'updated', $3)", [
      input.id,
      input.who,
      `Made active again (was ${row.retired ? "Retired" : "Inactive"})`,
    ])
    .catch(() => undefined);
  return { name: row.name };
}

export const makeAccountActive = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { ensureSeeded } = await import("./seed.server");
    await ensureSeeded();
    const sql = await getSql();
    const who = (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [context.userId]))[0]?.username || "Admin";
    return makeAccountActiveFor(sql, { id: data.id, admin: await canReviewNames(sql, context.userId), who });
  });
