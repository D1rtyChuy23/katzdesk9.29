import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { loadReps } from "@/lib/ops/reps";
import {
  countSalesReps,
  planSalesReps,
  salesRepFilesFromMatrix,
  type SalesRepCounts,
  type SalesRepFile,
  type SalesRepPlanLine,
} from "@/lib/ops/sales-reps";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function requireEditor(sql: Sql, userId: string) {
  if (!(await canReviewNames(sql, userId))) throw new Error("Only an Admin can import sales reps.");
}

async function loadPlanInputs(sql: Sql) {
  const accounts = await sql.query<{
    id: number;
    name: string;
    account_number: string | null;
    netsuite_id: string | null;
    account_rep: string | null;
  }>(
    "select id, name, account_number, netsuite_id, account_rep from directory_customers where archived = false order by name_locked desc, id",
  );
  const saved = await sql.query<{
    customer_id: number;
    rep_name: string;
    role: string | null;
    contribution_pct: string | number | null;
    is_primary: boolean;
  }>(
    "select customer_id, rep_name, role, contribution_pct, is_primary from customer_sales_reps where source = 'netsuite' order by id",
  );
  const reps = await loadReps(sql);
  const users = await sql.query<{ user_id: string; username: string }>(
    "select user_id, username from desk_accounts where approved = true and denied = false and coalesce(username, '') <> ''",
  );
  const known = [
    ...reps.filter((r) => r.active).map((r) => ({
      name: r.name,
      userId: users.find((u) => u.username.trim().toLowerCase() === r.name.trim().toLowerCase())?.user_id ?? null,
    })),
    ...users
      .filter((u) => !reps.some((r) => r.active && r.name.trim().toLowerCase() === u.username.trim().toLowerCase()))
      .map((u) => ({ name: u.username, userId: u.user_id })),
  ];
  const byCustomer = new Map<number, { name: string; role: string | null; pct: number | null; primary: boolean }[]>();
  for (const row of saved) {
    const pct = row.contribution_pct === null || row.contribution_pct === "" ? null : Number(row.contribution_pct);
    const list = byCustomer.get(row.customer_id) ?? [];
    list.push({
      name: row.rep_name,
      role: row.role,
      pct: pct !== null && Number.isFinite(pct) ? pct : null,
      primary: row.is_primary === true,
    });
    byCustomer.set(row.customer_id, list);
  }
  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      accountNumber: a.account_number,
      netsuiteId: a.netsuite_id,
      accountRep: a.account_rep,
    })),
    known,
    current: [...byCustomer.entries()].map(([customerId, reps]) => ({ customerId, reps })),
  };
}

export type SalesRepPreview = { files: SalesRepFile[]; lines: SalesRepPlanLine[]; counts: SalesRepCounts };

const fileSchema = z.object({
  line: z.number().int(),
  internalId: z.string().max(100),
  accountNumber: z.string().max(100),
  name: z.string().max(300),
  primary: z.string().max(200),
  reps: z.array(
    z.object({
      name: z.string().max(200),
      role: z.string().max(120),
      pct: z.number().nullable(),
      primary: z.boolean(),
    }),
  ).max(40),
});

export const previewSalesReps = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { filename: string; base64: string }) => z.object({ filename: z.string().max(300), base64: z.string().min(4) }).parse(d))
  .handler(async ({ data, context }): Promise<SalesRepPreview> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    if (data.base64.length > 12_000_000) throw new Error("That file is too large.");
    const wb = XLSX.read(data.base64, { type: "base64", raw: true, cellText: true });
    const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
    if (!sheet) throw new Error("The file is empty.");
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
    const files = salesRepFilesFromMatrix(matrix);
    if (!files.length) throw new Error("No rows under the header.");
    if (files.length > 10_000) throw new Error("Up to 10,000 accounts at a time.");
    const input = await loadPlanInputs(sql);
    const lines = planSalesReps(files, input.accounts, input.known, input.current);
    return { files, lines, counts: countSalesReps(lines) };
  });

/** Save rows that would change, planning them again against the accounts as they are now. No users are created. */
export const applySalesReps = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { files: SalesRepFile[] }) => z.object({ files: z.array(fileSchema).max(10_000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ saved: number; counts: SalesRepCounts }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const input = await loadPlanInputs(sql);
    const lines = planSalesReps(data.files, input.accounts, input.known, input.current);
    const save = lines.filter((l) => l.willSave && l.accountId !== null);
    if (!save.length) return { saved: 0, counts: countSalesReps(lines) };
    const primaries = save
      .filter((l) => l.primaryChange && l.nextPrimary)
      .map((l) => ({ id: l.accountId, rep: l.nextPrimary }));
    if (primaries.length) {
      await sql.query(
        `update directory_customers d
            set account_rep = v.rep, updated_at = now()
           from jsonb_to_recordset($1::jsonb) as v(id int, rep text)
          where d.id = v.id and d.archived = false`,
        [JSON.stringify(primaries)],
      );
    }
    const reps = save.flatMap((l) =>
      l.reps.map((r) => ({
        customer_id: l.accountId,
        rep_name: r.storedName,
        rep_user_id: r.userId,
        role: r.role || null,
        contribution_pct: r.pct,
        is_primary: r.primary,
      })),
    );
    if (reps.length) {
      await sql.query(
        `with incoming as (
           select * from jsonb_to_recordset($1::jsonb) as x(
             customer_id int, rep_name text, rep_user_id text, role text, contribution_pct numeric, is_primary boolean
           )
         ), wiped as (
           delete from customer_sales_reps
            where customer_id in (select distinct customer_id from incoming)
              and source = 'netsuite'
         )
         insert into customer_sales_reps (customer_id, rep_name, rep_user_id, role, contribution_pct, is_primary, source)
         select customer_id, rep_name, nullif(rep_user_id, ''), nullif(role, ''), contribution_pct, coalesce(is_primary, false), 'netsuite'
           from incoming
          where coalesce(rep_name, '') <> ''`,
        [JSON.stringify(reps)],
      );
    }
    return { saved: save.length, counts: countSalesReps(lines) };
  });
