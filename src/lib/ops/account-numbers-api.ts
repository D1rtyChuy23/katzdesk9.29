import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import {
  accountNumberKey,
  cleanAccountNumber,
  importRowsFromMatrix,
  planAccountNumbers,
  type ImportPlanLine,
  type ImportRow,
} from "@/lib/ops/account-numbers";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** Account numbers are set by an Admin (the Admin role or a desk admin). */
async function requireAccountEditor(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can set account numbers.");
}

async function actor(sql: Sql, userId: string) {
  return (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
}

/** Set or clear one account's number. Refused when another account already has it. Nothing else changes. */
export const setAccountNumber = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; accountNumber: string | null }) =>
    z.object({ id: z.number().int().positive(), accountNumber: z.string().max(60).nullable() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: number; accountNumber: string | null }> => {
    const sql = await ready();
    await requireAccountEditor(sql, context.userId);
    const next = cleanAccountNumber(data.accountNumber);
    const cur = (await sql.query<{ id: number; name: string; account_number: string | null }>(
      "select id, name, account_number from directory_customers where id = $1 and archived = false",
      [data.id],
    ))[0];
    if (!cur) throw new Error("That customer is no longer on the list.");
    if (next) {
      const other = await sql.query<{ name: string }>(
        `select name from directory_customers
          where archived = false and id <> $2 and account_number is not null and lower(btrim(account_number)) = $1 limit 1`,
        [accountNumberKey(next), data.id],
      );
      if (other[0]) throw new Error(`Account number ${next} is already on “${other[0].name}”.`);
    }
    try {
      await sql.query("update directory_customers set account_number = $2, updated_at = now() where id = $1", [data.id, next]);
    } catch (e) {
      if (/unique|duplicate/i.test(String(e))) throw new Error(`Account number ${next} is already on another customer.`);
      throw e;
    }
    await sql
      .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, 'updated', $3)", [
        data.id,
        await actor(sql, context.userId),
        next ? `account number ${cur.account_number ? `${cur.account_number} → ` : ""}${next}` : `cleared account number ${cur.account_number ?? ""}`.trim(),
      ])
      .catch(() => undefined);
    return { id: data.id, accountNumber: next };
  });

async function loadAccounts(sql: Sql) {
  const rows = await sql.query<{ id: number; name: string; netsuite_id: string | null; account_number: string | null }>(
    "select id, name, netsuite_id, account_number from directory_customers where archived = false",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, netsuiteId: r.netsuite_id, accountNumber: r.account_number }));
}

export type AccountNumberPreview = {
  rows: ImportRow[];
  lines: ImportPlanLine[];
  counts: { match: number; same: number; conflict: number; unmatched: number };
};

function count(lines: ImportPlanLine[]) {
  return {
    match: lines.filter((l) => l.status === "match").length,
    same: lines.filter((l) => l.status === "same").length,
    conflict: lines.filter((l) => l.status === "conflict").length,
    unmatched: lines.filter((l) => l.status === "unmatched").length,
  };
}

/** Read the CSV (or sheet) and show what would happen. Saves nothing. */
export const previewAccountNumbers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string }) => z.object({ filename: z.string().max(300), base64: z.string().min(4) }).parse(d))
  .handler(async ({ data, context }): Promise<AccountNumberPreview> => {
    const sql = await ready();
    await requireAccountEditor(sql, context.userId);
    if (data.base64.length > 8_000_000) throw new Error("That file is too large.");
    // Read every cell as text so "00123" keeps its leading zeros.
    const wb = XLSX.read(data.base64, { type: "base64", raw: true, cellText: true });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("The file is empty.");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
    const rows = importRowsFromMatrix(matrix);
    if (!rows.length) throw new Error("No rows under the header.");
    if (rows.length > 10_000) throw new Error("Up to 10,000 rows at a time.");
    const lines = planAccountNumbers(rows, await loadAccounts(sql));
    return { rows, lines, counts: count(lines) };
  });

/** Save the matched rows only, after checking them again against the accounts as they are now. */
export const applyAccountNumbers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { rows: ImportRow[] }) =>
    z
      .object({
        rows: z.array(z.object({ line: z.number().int(), customer: z.string().max(300), accountNumber: z.string().max(60) })).max(10_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ saved: number; skipped: number; counts: AccountNumberPreview["counts"] }> => {
    const sql = await ready();
    await requireAccountEditor(sql, context.userId);
    const lines = planAccountNumbers(data.rows, await loadAccounts(sql));
    const who = await actor(sql, context.userId);
    let saved = 0;
    for (const l of lines) {
      if (l.status !== "match" || !l.accountId) continue;
      try {
        await sql.query(
          "update directory_customers set account_number = $2, updated_at = now() where id = $1 and (account_number is null or btrim(account_number) = '')",
          [l.accountId, l.accountNumber],
        );
        saved += 1;
        await sql
          .query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, 'updated', $3)", [
            l.accountId,
            who,
            `account number ${l.accountNumber} (import)`,
          ])
          .catch(() => undefined);
      } catch {
        /* taken by another account in the meantime: left as it was */
      }
    }
    return { saved, skipped: lines.length - saved, counts: count(lines) };
  });
