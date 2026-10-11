import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, requireAdmin } from "@/lib/ops/access";
import { renameOrMergeCustomer } from "@/lib/ops/customer-identity";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { matchCleanList, rowsFromMatrix, tidy, type CleanKind } from "@/lib/ops/clean-names";

export type CleanStatus = "pending" | "apply" | "locked" | "kept" | "skipped" | "removal" | "unlocked";
export type CleanSection = "locked" | "similar" | "no_match" | "walk_in" | "cimbali";

export type CleanReportItem = {
  id: number;
  kind: CleanKind;
  section: CleanSection;
  customerId: number | null;
  /** The KatzDesk name when the list was read. */
  katzName: string | null;
  /** The account's name today, when it differs from both names on the line (a merge, or an edit after unlock). */
  currentName: string | null;
  /** Another KatzDesk account already has the clean-list name: approving merges this account into it. */
  mergesInto: string | null;
  cleanName: string | null;
  netsuiteId: string | null;
  reason: string;
  status: CleanStatus;
  note: string | null;
  locked: boolean;
  removalFlag: boolean;
  decidedBy: string | null;
};

export type CleanReport = {
  run: { id: number; filename: string | null; createdBy: string | null; createdAt: string; rowCount: number } | null;
  items: CleanReportItem[];
  /** Exact matches still waiting to be applied (applied in batches so a long list never times out). */
  pendingApply: number;
  canEdit: boolean;
};

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function actorName(sql: Sql, userId: string): Promise<string> {
  const rows = await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]);
  return rows[0]?.username || "Admin";
}

async function isAdmin(sql: Sql, userId: string): Promise<boolean> {
  const rows = await sql.query<{ is_admin: unknown }>("select is_admin from desk_accounts where user_id = $1", [userId]);
  const v = rows[0]?.is_admin;
  return v === true || v === "true" || v === 1 || v === "t";
}

/** The locked account a typed or imported name belongs to (same name, ignoring case, spacing and punctuation). */
export async function lockedNameFor(sql: Sql, raw: string | null | undefined): Promise<string | null> {
  const key = normalizeCustomerKey(raw);
  if (!key) return null;
  const rows = await sql
    .query<{ name: string }>(
      `select name from directory_customers
        where name_locked = true and archived = false
          and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') = $1
        order by id limit 1`,
      [key],
    )
    .catch(() => [] as { name: string }[]);
  return rows[0]?.name ?? null;
}

function sectionOf(kind: string, status: string): CleanSection {
  if (kind === "walk_in") return "walk_in";
  if (kind === "cimbali") return "cimbali";
  if (kind === "no_match") return "no_match";
  if (kind === "exact" || status === "locked" || status === "unlocked") return "locked";
  return "similar";
}

async function readReport(sql: Sql, canEdit: boolean): Promise<CleanReport> {
  const run = (
    await sql.query<{ id: number; filename: string | null; created_by: string | null; created_at: unknown; row_count: number }>(
      "select id, filename, created_by, created_at, row_count from customer_clean_runs order by id desc limit 1",
    )
  )[0];
  if (!run) return { run: null, items: [], pendingApply: 0, canEdit };
  const rows = await sql.query<{
    id: number;
    kind: string;
    customer_id: number | null;
    katz_name: string | null;
    clean_name: string | null;
    netsuite_id: string | null;
    reason: string | null;
    status: string;
    note: string | null;
    decided_by: string | null;
    cur_name: string | null;
    name_locked: unknown;
    removal_flag: unknown;
  }>(
    `select i.*, d.name as cur_name, d.name_locked, d.removal_flag
       from customer_clean_items i
       left join directory_customers d on d.id = i.customer_id
      where i.run_id = $1
      order by i.id`,
    [run.id],
  );
  const on = (v: unknown) => v === true || v === "true" || v === "t" || v === 1;
  const holders = new Map<string, { id: number; name: string }>();
  for (const a of await sql.query<{ id: number; name: string }>("select id, name from directory_customers where archived = false")) {
    holders.set(a.name.toLowerCase(), a);
  }
  const mergeTarget = (customerId: number | null, clean: string | null, status: string) => {
    if (!customerId || !clean || status === "locked" || status === "kept") return null;
    const hit = holders.get(tidy(clean).toLowerCase());
    return hit && hit.id !== customerId ? hit.name : null;
  };
  return {
    run: {
      id: run.id,
      filename: run.filename,
      createdBy: run.created_by,
      createdAt: run.created_at instanceof Date ? run.created_at.toISOString() : String(run.created_at),
      rowCount: Number(run.row_count) || 0,
    },
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind as CleanKind,
      section: sectionOf(r.kind, r.status),
      customerId: r.customer_id,
      katzName: r.katz_name ?? r.cur_name,
      mergesInto: mergeTarget(r.customer_id, r.clean_name, r.status),
      currentName: r.cur_name && r.cur_name !== r.katz_name && r.cur_name !== tidy(r.clean_name) ? r.cur_name : null,
      cleanName: r.clean_name,
      netsuiteId: r.netsuite_id,
      reason: r.reason ?? "",
      status: r.status as CleanStatus,
      note: r.note,
      locked: on(r.name_locked),
      removalFlag: on(r.removal_flag),
      decidedBy: r.decided_by,
    })),
    pendingApply: rows.filter((r) => r.status === "apply").length,
    canEdit,
  };
}

export const getCleanReport = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<CleanReport> => {
    const sql = await ready();
    return readReport(sql, await isAdmin(sql, context.userId));
  });

function matrixFrom(base64: string): unknown[][] {
  const wb = XLSX.read(base64, { type: "base64", raw: false });
  const name = wb.SheetNames.find((n) => /^customers?$/i.test(n.trim())) ?? wb.SheetNames[0];
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!sheet) throw new Error("The file has no sheets.");
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
}

const fileInput = z.object({ filename: z.string().max(300), base64: z.string().min(8) });

/**
 * Read the clean list and write the report. Exact matches are queued to be applied and locked (see
 * continueCleanList); everything else waits on the review. Nothing is merged and nothing is deleted here.
 */
export const startCleanList = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof fileInput>) => fileInput.parse(d))
  .handler(async ({ data, context }): Promise<CleanReport> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId, "Only an admin can apply the clean customer list.");
    if (data.base64.length > 20_000_000) throw new Error("That file is too large.");
    const rows = rowsFromMatrix(matrixFrom(data.base64));
    if (!rows.length) throw new Error("No customers on that sheet.");
    const accounts = await sql.query<{ id: number; name: string }>(
      "select id, name from directory_customers where archived = false and coalesce(name, '') <> '' order by id",
    );
    const items = matchCleanList(accounts, rows);
    const who = await actorName(sql, context.userId);
    const run = (
      await sql.query<{ id: number }>(
        "insert into customer_clean_runs (filename, created_by, row_count) values ($1, $2, $3) returning id",
        [data.filename, who, rows.length],
      )
    )[0]!;
    // Insert in chunks: one statement per 200 lines.
    for (let i = 0; i < items.length; i += 200) {
      const chunk = items.slice(i, i + 200);
      const params: unknown[] = [];
      const values = chunk.map((it, j) => {
        const b = j * 8;
        params.push(run.id, it.kind, it.accountId, it.katzName, it.cleanName, it.internalId, it.reason, it.kind === "exact" ? "apply" : "pending");
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
      });
      await sql.query(
        `insert into customer_clean_items (run_id, kind, customer_id, katz_name, clean_name, netsuite_id, reason, status) values ${values.join(", ")}`,
        params,
      );
    }
    // Exact matches whose name is already the clean name: lock them all at once.
    await sql.query(
      `update directory_customers d set name_locked = true, locked_at = now(), locked_by = $2, netsuite_id = i.netsuite_id, updated_at = now()
         from customer_clean_items i
        where i.run_id = $1 and i.status = 'apply' and i.customer_id = d.id and d.name = i.clean_name`,
      [run.id, who],
    );
    await sql.query(
      `update customer_clean_items i set status = 'locked', decided_by = $2, decided_at = now()
         from directory_customers d
        where i.run_id = $1 and i.status = 'apply' and i.customer_id = d.id and d.name = i.clean_name`,
      [run.id, who],
    );
    return readReport(sql, true);
  });

/** Apply the next batch of exact matches that change the name. Called until pendingApply is 0. */
export const continueCleanList = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<CleanReport> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId, "Only an admin can apply the clean customer list.");
    const who = await actorName(sql, context.userId);
    const run = (await sql.query<{ id: number }>("select id from customer_clean_runs order by id desc limit 1"))[0];
    if (!run) return readReport(sql, true);
    const batch = await sql.query<{ id: number; customer_id: number; clean_name: string; netsuite_id: string | null }>(
      "select id, customer_id, clean_name, netsuite_id from customer_clean_items where run_id = $1 and status = 'apply' order by id limit 40",
      [run.id],
    );
    for (const it of batch) {
      const cur = (
        await sql.query<{ id: number; name: string; name_locked: unknown; archived: boolean }>(
          "select id, name, name_locked, archived from directory_customers where id = $1",
          [it.customer_id],
        )
      )[0];
      const next = tidy(it.clean_name);
      const hold = async (reason: string) =>
        sql.query("update customer_clean_items set kind = 'similar', status = 'pending', reason = $2 where id = $1", [it.id, reason]);
      if (!cur || cur.archived) {
        await hold("The KatzDesk account was removed before the name could be applied");
        continue;
      }
      if (cur.name_locked === true && cur.name !== next) {
        await hold(`Locked earlier as “${cur.name}”; approving replaces the locked name`);
        continue;
      }
      // Never merge on its own: another account already holding the name waits for approval.
      const other = await sql.query<{ name: string }>(
        "select name from directory_customers where lower(name) = lower($1) and id <> $2 and archived = false limit 1",
        [next, cur.id],
      );
      if (other[0]) {
        await hold(`Another KatzDesk account already has the name “${other[0].name}”; approving merges the two`);
        continue;
      }
      try {
        await renameOrMergeCustomer(sql, cur.id, next, { force: true });
        await lockAccount(sql, cur.id, who, it.netsuite_id);
        await sql.query("update customer_clean_items set status = 'locked', decided_by = $2, decided_at = now() where id = $1", [it.id, who]);
      } catch (e) {
        await hold(`Could not apply: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    return readReport(sql, true);
  });

async function lockAccount(sql: Sql, id: number, who: string, netsuiteId?: string | null) {
  await sql.query(
    `update directory_customers set name_locked = true, locked_at = now(), locked_by = $2,
            netsuite_id = coalesce($3, netsuite_id), removal_flag = false, updated_at = now()
      where id = $1`,
    [id, who, netsuiteId ?? null],
  );
}

const decideInput = z.object({
  id: z.number().int().positive(),
  action: z.enum(["approve", "skip", "removal", "unlock", "lock"]),
});

/**
 * Approve: apply the clean-list name (similar, Walk-In, Cimbali) and lock it; on No Match, keep the account and
 * lock its name. Skip: leave it as is. Removal: flag only. Unlock / Lock: the only way a locked name opens again.
 */
export const decideCleanItem = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof decideInput>) => decideInput.parse(d))
  .handler(async ({ data, context }): Promise<CleanReport> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId, "Only an admin can approve clean-list names.");
    const who = await actorName(sql, context.userId);
    const it = (
      await sql.query<{
        id: number;
        run_id: number;
        kind: string;
        customer_id: number | null;
        clean_name: string | null;
        netsuite_id: string | null;
        status: string;
      }>("select id, run_id, kind, customer_id, clean_name, netsuite_id, status from customer_clean_items where id = $1", [data.id])
    )[0];
    if (!it) throw new Error("That line is no longer on the report.");
    const mark = (status: CleanStatus, note: string | null = null) =>
      sql.query("update customer_clean_items set status = $2, note = $3, decided_by = $4, decided_at = now() where id = $1", [
        it.id,
        status,
        note,
        who,
      ]);

    if (data.action === "skip") {
      if (it.customer_id && it.status === "removal") {
        await sql.query("update directory_customers set removal_flag = false where id = $1", [it.customer_id]);
      }
      await mark("skipped");
    } else if (data.action === "removal") {
      if (!it.customer_id) throw new Error("There is no KatzDesk account on this line to remove.");
      await sql.query("update directory_customers set removal_flag = true, updated_at = now() where id = $1", [it.customer_id]);
      await mark("removal", "Flagged for removal. Nothing is deleted until removal is confirmed.");
    } else if (data.action === "unlock") {
      if (!it.customer_id) throw new Error("There is no KatzDesk account on this line.");
      await sql.query("update directory_customers set name_locked = false, updated_at = now() where id = $1", [it.customer_id]);
      await mark("unlocked", "Unlocked: the name can be edited again.");
    } else if (data.action === "lock") {
      if (!it.customer_id) throw new Error("There is no KatzDesk account on this line.");
      await lockAccount(sql, it.customer_id, who, it.netsuite_id);
      await mark("locked");
    } else {
      // approve
      if (it.kind === "no_match") {
        if (!it.customer_id) throw new Error("There is no KatzDesk account on this line.");
        await lockAccount(sql, it.customer_id, who, null);
        await mark("kept", "Kept with its KatzDesk name, now locked.");
      } else if (!it.customer_id) {
        // Walk-In or Cimbali on the list with no KatzDesk account: add it with the clean name.
        const name = tidy(it.clean_name);
        if (!name) throw new Error("No name on this line.");
        const found = await sql.query<{ id: number }>("select id from directory_customers where lower(name) = lower($1) limit 1", [name]);
        const id =
          found[0]?.id ??
          (await sql.query<{ id: number }>("insert into directory_customers (name) values ($1) returning id", [name]))[0]!.id;
        await sql.query("update directory_customers set archived = false where id = $1", [id]);
        await lockAccount(sql, id, who, it.netsuite_id);
        await sql.query("update customer_clean_items set customer_id = $2 where id = $1", [it.id, id]);
        await mark("locked", "Added from the clean list and locked.");
      } else {
        const name = tidy(it.clean_name);
        let id = it.customer_id;
        if (name) {
          const res = await renameOrMergeCustomer(sql, it.customer_id, name, { force: true });
          id = res.id;
          if (res.id !== it.customer_id) {
            await sql.query("update customer_clean_items set customer_id = $2 where id = $1", [it.id, res.id]);
          }
          await mark("locked", res.merged ? `Merged into “${res.name}” on approval.` : null);
        } else {
          await mark("locked", "Kept with its KatzDesk name, now locked.");
        }
        await lockAccount(sql, id, who, it.netsuite_id);
        // Other names offered for the same account are settled by this approval.
        await sql.query(
          `update customer_clean_items set status = 'skipped', note = 'Another clean-list name was approved for this account.', decided_by = $3, decided_at = now()
            where run_id = $1 and customer_id = $2 and id <> $4 and status = 'pending'`,
          [it.run_id, it.customer_id, who, it.id],
        );
      }
    }
    return readReport(sql, true);
  });
