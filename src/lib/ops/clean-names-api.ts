import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware, requireNameReviewer } from "@/lib/ops/access";
import { loadReps } from "@/lib/ops/reps";
import { renameOrMergeCustomer } from "@/lib/ops/customer-identity";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { cleanNameOf, isCimbaliName, isWalkInName, matchCleanList, resolveSalesRep, rowsFromMatrix, tidy, wordsOf, type CleanKind } from "@/lib/ops/clean-names";

export type CleanStatus = "pending" | "apply" | "locked" | "kept" | "skipped" | "removal" | "unlocked" | "removed";
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
  /** ID, address and rep show only once the account is approved (locked from the list). */
  netsuiteId: string | null;
  address: string | null;
  accountRep: string | null;
  /** Why the rep is blank: no sales rep on the list, or one KatzDesk does not have. */
  repFlag: string | null;
  /** The list's Sales Rep column as written (shown on approved lines). */
  salesRep: string | null;
  approved: boolean;
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
  /** Not an Admin: the review is not shown. */
  forbidden: boolean;
  /**
   * The report was read before ID, address and rep were carried, so approved accounts have none yet. Reading the
   * clean list again fills them (and keeps every lock and decision).
   */
  needsReRead: boolean;
  /** Approved accounts on this report still missing the list's ID. */
  missingDetails: number;
  /** The whole list is kept with this report, so any list name can be chosen. False for a list read before that. */
  canSearchList: boolean;
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
  if (!run) return { run: null, items: [], pendingApply: 0, canEdit, forbidden: false, needsReRead: false, missingDetails: 0, canSearchList: false };
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
    sales_rep: string | null;
    address: string | null;
    rep_name: string | null;
    rep_flag: string | null;
    cur_name: string | null;
    name_locked: unknown;
    removal_flag: unknown;
    acct_netsuite: string | null;
    acct_address: string | null;
    acct_rep: string | null;
    acct_rep_flag: string | null;
  }>(
    `select i.*, d.name as cur_name, d.name_locked, d.removal_flag,
            d.netsuite_id as acct_netsuite, d.address as acct_address, d.account_rep as acct_rep, d.rep_flag as acct_rep_flag
       from customer_clean_items i
       left join directory_customers d on d.id = i.customer_id
      where i.run_id = $1 and i.status <> 'removed'
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
    items: rows.map((r) => {
      const approved = (r.status === "locked" && !!r.clean_name) && on(r.name_locked);
      return {
      id: r.id,
      kind: r.kind as CleanKind,
      section: sectionOf(r.kind, r.status),
      customerId: r.customer_id,
      katzName: r.katz_name ?? r.cur_name,
      mergesInto: mergeTarget(r.customer_id, r.clean_name, r.status),
      currentName: r.cur_name && r.cur_name !== r.katz_name && r.cur_name !== tidy(r.clean_name) ? r.cur_name : null,
      cleanName: r.clean_name,
      approved,
      netsuiteId: approved ? r.acct_netsuite : null,
      address: approved ? r.acct_address : null,
      accountRep: approved ? r.acct_rep : null,
      repFlag: approved ? r.acct_rep_flag : null,
      salesRep: approved ? r.sales_rep : null,
      reason: r.reason ?? "",
      status: r.status as CleanStatus,
      note: r.note,
      locked: on(r.name_locked),
      removalFlag: on(r.removal_flag),
      decidedBy: r.decided_by,
    };
    }),
    pendingApply: rows.filter((r) => r.status === "apply").length,
    canEdit,
    forbidden: false,
    needsReRead:
      rows.some((r) => !!r.clean_name) &&
      !rows.some((r) => r.clean_name && (r.address != null || r.sales_rep != null || r.rep_name != null || r.rep_flag != null)),
    missingDetails: rows.filter((r) => r.status === "locked" && !!r.clean_name && on(r.name_locked) && !r.acct_netsuite).length,
    canSearchList: !!(await sql.query("select 1 from customer_clean_rows where run_id = $1 limit 1", [run.id]))[0],
  };
}

export const getCleanReport = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<CleanReport> => {
    const sql = await ready();
    if (!(await canReviewNames(sql, context.userId))) {
      return { run: null, items: [], pendingApply: 0, canEdit: false, forbidden: true, needsReRead: false, missingDetails: 0, canSearchList: false };
    }
    return readReport(sql, true);
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
    await requireNameReviewer(sql, context.userId, "Only an Admin can apply the clean customer list.");
    if (data.base64.length > 20_000_000) throw new Error("That file is too large.");
    const rows = rowsFromMatrix(matrixFrom(data.base64));
    if (!rows.length) throw new Error("No customers on that sheet.");
    const accounts = await sql.query<{ id: number; name: string }>(
      "select id, name from directory_customers where archived = false and coalesce(name, '') <> '' order by id",
    );
    const items = matchCleanList(accounts, rows);
    const roster = await loadReps(sql);
    const who = await actorName(sql, context.userId);
    const prior = (await sql.query<{ id: number }>("select id from customer_clean_runs order by id desc limit 1"))[0];
    const run = (
      await sql.query<{ id: number }>(
        "insert into customer_clean_runs (filename, created_by, row_count) values ($1, $2, $3) returning id",
        [data.filename, who, rows.length],
      )
    )[0]!;
    // Insert in chunks: one statement per 200 lines.
    // Keep every list row, so any name on the list can be chosen on the review.
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const params: unknown[] = [];
      const values = chunk.map((row, j) => {
        const b = j * 7;
        const rep = resolveSalesRep(row.salesRep, roster);
        params.push(run.id, row.internalId || null, cleanNameOf(row), tidy(row.address) || null, tidy(row.salesRep) || null, rep.rep, rep.flag);
        return `(${Array.from({ length: 7 }, (_, k) => `$${b + k + 1}`).join(", ")})`;
      });
      await sql.query(
        `insert into customer_clean_rows (run_id, internal_id, name, address, sales_rep, rep_name, rep_flag) values ${values.join(", ")}`,
        params,
      );
    }
    for (let i = 0; i < items.length; i += 200) {
      const chunk = items.slice(i, i + 200);
      const params: unknown[] = [];
      const values = chunk.map((it, j) => {
        const b = j * 12;
        const rep = it.cleanName ? resolveSalesRep(it.salesRep, roster) : { rep: null, flag: null };
        params.push(
          run.id, it.kind, it.accountId, it.katzName, it.cleanName, it.internalId, it.reason, it.kind === "exact" ? "apply" : "pending",
          it.address, it.salesRep, rep.rep, rep.flag,
        );
        return `(${Array.from({ length: 12 }, (_, k) => `$${b + k + 1}`).join(", ")})`;
      });
      await sql.query(
        `insert into customer_clean_items (run_id, kind, customer_id, katz_name, clean_name, netsuite_id, reason, status, address, sales_rep, rep_name, rep_flag)
         values ${values.join(", ")}`,
        params,
      );
    }
    // Reading the list again keeps what was already decided: skips, removal flags, kept accounts, unlocks, and
    // approvals of similar / Walk-In / Cimbali lines. Locked names stay locked.
    if (prior) {
      await sql.query(
        `update customer_clean_items n
            set status = o.status, note = o.note, decided_by = o.decided_by, decided_at = o.decided_at
           from customer_clean_items o
          where n.run_id = $1 and o.run_id = $2
            and n.customer_id = o.customer_id and coalesce(n.clean_name, '') = coalesce(o.clean_name, '')
            and n.status in ('pending', 'apply')
            and (o.status in ('skipped', 'removal', 'kept', 'unlocked', 'removed') or (o.status = 'locked' and n.kind <> 'exact'))`,
        [run.id, prior.id],
      );
    }
    // Exact matches whose name is already the clean name: lock them all at once, with the list's ID, address and rep.
    await sql.query(
      `update directory_customers d set name_locked = true, locked_at = now(), locked_by = $2, removal_flag = false,
              netsuite_id = i.netsuite_id, address = i.address, account_rep = i.rep_name, rep_flag = i.rep_flag, updated_at = now()
         from customer_clean_items i
        where i.run_id = $1 and i.status = 'apply' and i.customer_id = d.id and d.name = i.clean_name`,
      [run.id, who],
    );
    // Lines approved on an earlier read: the account carries the list's details too.
    await sql.query(
      `update directory_customers d set netsuite_id = i.netsuite_id, address = i.address, account_rep = i.rep_name, rep_flag = i.rep_flag, updated_at = now()
         from customer_clean_items i
        where i.run_id = $1 and i.status = 'locked' and i.clean_name is not null and i.customer_id = d.id and d.name_locked = true`,
      [run.id],
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
    await requireNameReviewer(sql, context.userId, "Only an Admin can apply the clean customer list.");
    const who = await actorName(sql, context.userId);
    const run = (await sql.query<{ id: number }>("select id from customer_clean_runs order by id desc limit 1"))[0];
    if (!run) return readReport(sql, true);
    const batch = await sql.query<LineDetails & { id: number; customer_id: number; clean_name: string }>(
      "select id, customer_id, clean_name, netsuite_id, address, rep_name, rep_flag from customer_clean_items where run_id = $1 and status = 'apply' order by id limit 40",
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
        await lockAccount(sql, cur.id, who, it);
        await sql.query("update customer_clean_items set status = 'locked', decided_by = $2, decided_at = now() where id = $1", [it.id, who]);
      } catch (e) {
        await hold(`Could not apply: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    return readReport(sql, true);
  });

type LineDetails = { netsuite_id: string | null; address: string | null; rep_name: string | null; rep_flag: string | null };

/**
 * Lock the name. With a clean-list line (an approved match), also write the list's ID, address and sales rep onto
 * the account; a blank rep carries its flag. Without one (No Match kept, a Walk-In with no list name), only lock.
 */
async function lockAccount(sql: Sql, id: number, who: string, line?: LineDetails | null) {
  await sql.query(
    `update directory_customers set name_locked = true, locked_at = now(), locked_by = $2, removal_flag = false, updated_at = now()
      where id = $1`,
    [id, who],
  );
  if (line) {
    await sql.query(
      "update directory_customers set netsuite_id = $2, address = $3, account_rep = $4, rep_flag = $5 where id = $1",
      [id, line.netsuite_id, line.address, line.rep_name, line.rep_flag],
    );
  }
}

const decideInput = z.object({
  id: z.number().int().positive(),
  action: z.enum(["approve", "skip", "removal", "unlock", "lock", "drop"]),
  /** Approve with a name you chose: a row picked from the whole clean list. */
  rowId: z.number().int().positive().optional(),
  /** Approve tied to a KatzDesk account picked from the full customer list. */
  accountId: z.number().int().positive().optional(),
  /** Approve keeping the KatzDesk name as it is (locked; no list ID or address). */
  keepName: z.boolean().optional(),
});

export type NameHistoryItem = {
  type: "Service" | "TLC" | "PM" | "Install";
  /** The record, to open it: service | tlc | pm | install and its id. */
  entityType: "service" | "tlc" | "pm" | "install";
  id: number;
  /** Call ID (SC-…) for tickets. */
  ref: string | null;
  wo: string | null;
  date: string | null;
  status: string | null;
  notes: string | null;
};
export type NameHistory = { total: number; items: NameHistoryItem[] };

const dayOf = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);

/**
 * Work already on these names: service and TLC tickets, PMs and installs, newest first (up to 6 per name),
 * matched on the customer name the way the account window matches it.
 */
export const historyForNames = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { names: string[] }) => z.object({ names: z.array(z.string().max(300)).max(120) }).parse(d))
  .handler(async ({ data, context }): Promise<Record<string, NameHistory>> => {
    const sql = await ready();
    await requireNameReviewer(sql, context.userId, "Only an Admin can open the clean-list review.");
    const keys = [...new Set(data.names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
    const out: Record<string, NameHistory> = Object.fromEntries(keys.map((k) => [k, { total: 0, items: [] }]));
    if (!keys.length) return out;
    const rows = await sql.query<{ k: string; type: string; ref: string | null; wo: string | null; day: unknown; status: string | null; notes: string | null; et: string; id: number }>(
      `select lower(customer) as k, case when kind = 'tlc' then 'TLC' else 'Service' end as type, call_id as ref, wo,
              coalesce(scheduled, received) as day, status, coalesce(nullif(notes, ''), issue) as notes,
              case when kind = 'tlc' then 'tlc' else 'service' end as et, id
         from service_jobs where lower(customer) = any($1)
       union all
       select lower(customer), 'PM', null, wo, coalesce(projected, received), status, notes, 'pm', id
         from pm_jobs where lower(customer) = any($1)
       union all
       select lower(customer), 'Install', null, wo, coalesce(install_date, received), equip_status, notes, 'install', id
         from installs where archived = false and lower(customer) = any($1)
       order by 5 desc nulls last`,
      [keys],
    );
    for (const r of rows) {
      const h = out[r.k];
      if (!h) continue;
      h.total += 1;
      if (h.items.length < 6) {
        h.items.push({
          type: r.type as NameHistoryItem["type"],
          entityType: r.et as NameHistoryItem["entityType"],
          id: Number(r.id),
          ref: r.ref,
          wo: r.wo,
          date: dayOf(r.day),
          status: r.status,
          notes: r.notes,
        });
      }
    }
    return out;
  });

export type CleanListRow = {
  id: number;
  name: string;
  internalId: string | null;
  address: string | null;
  salesRep: string | null;
  /** Another KatzDesk account already has this name: choosing it merges into that account. */
  heldBy: string | null;
};

/** Search the last clean list read, by any words in the name. For Choose Name on the review. */
export const searchCleanRows = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { q: string }) => z.object({ q: z.string().max(120) }).parse(d))
  .handler(async ({ data, context }): Promise<CleanListRow[]> => {
    const sql = await ready();
    await requireNameReviewer(sql, context.userId, "Only an Admin can search the clean list.");
    const run = (await sql.query<{ id: number }>("select id from customer_clean_runs order by id desc limit 1"))[0];
    const words = wordsOf(data.q).filter((w) => w.length >= 2).slice(0, 6);
    if (!run || !words.length) return [];
    const params: unknown[] = [run.id];
    const conds = words.map((w) => {
      params.push(`%${w}%`);
      return `regexp_replace(lower(r.name), '[^a-z0-9#]+', ' ', 'g') like $${params.length}`;
    });
    const rows = await sql.query<{ id: number; name: string; internal_id: string | null; address: string | null; sales_rep: string | null; held: string | null }>(
      `select r.id, r.name, r.internal_id, r.address, r.sales_rep,
              (select d.name from directory_customers d where lower(d.name) = lower(r.name) and d.archived = false limit 1) as held
         from customer_clean_rows r
        where r.run_id = $1 and ${conds.join(" and ")}
        order by length(r.name), r.name
        limit 20`,
      params,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, internalId: r.internal_id, address: r.address, salesRep: r.sales_rep, heldBy: r.held }));
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
    await requireNameReviewer(sql, context.userId, "Only an Admin can approve or change clean-list names.");
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
        address: string | null;
        sales_rep: string | null;
        rep_name: string | null;
        rep_flag: string | null;
      }>("select id, run_id, kind, customer_id, clean_name, netsuite_id, status, address, sales_rep, rep_name, rep_flag from customer_clean_items where id = $1", [data.id])
    )[0];
    if (!it) throw new Error("That line is no longer on the report.");
    if (data.action === "approve" && data.accountId && data.accountId !== it.customer_id) {
      const target = (
        await sql.query<{ id: number; name: string; name_locked: unknown; archived: boolean }>(
          "select id, name, name_locked, archived from directory_customers where id = $1",
          [data.accountId],
        )
      )[0];
      if (!target || target.archived) throw new Error("That KatzDesk account is no longer on the list.");
      const targetLocked = target.name_locked === true || target.name_locked === "t" || target.name_locked === "true";
      if (it.clean_name) {
        // This clean-list name belongs to the account you picked: that account takes the name.
        if (targetLocked && target.name !== tidy(it.clean_name)) {
          throw new Error(`“${target.name}” is locked from the clean list. Unlock it on its own line first.`);
        }
        const before = it.customer_id;
        await sql.query("update customer_clean_items set customer_id = $2, katz_name = $3 where id = $1", [it.id, target.id, target.name]);
        it.customer_id = target.id;
        // The account that was on this line stays on the report, so nothing drops off.
        if (before) {
          const still = await sql.query("select 1 from customer_clean_items where run_id = $1 and customer_id = $2 and id <> $3 limit 1", [
            it.run_id,
            before,
            it.id,
          ]);
          const acct = (await sql.query<{ name: string }>("select name from directory_customers where id = $1", [before]))[0];
          if (!still[0] && acct) {
            const kind = isWalkInName(acct.name) ? "walk_in" : isCimbaliName(acct.name) ? "cimbali" : "no_match";
            const why = `Was on the line for “${it.clean_name}” until ${target.name} was chosen`;
            await sql.query(
              "insert into customer_clean_items (run_id, kind, customer_id, katz_name, reason, status) values ($1, $2, $3, $4, $5, 'pending')",
              [it.run_id, kind, before, acct.name, why],
            );
          }
        }
      } else {
        // A KatzDesk name with no list name (No Match, a Walk-In with no match): it is the account you picked.
        if (!it.customer_id) throw new Error("There is no KatzDesk account on this line.");
        const res = await renameOrMergeCustomer(sql, it.customer_id, target.name, { force: true });
        await lockAccount(sql, res.id, who, null);
        await sql.query(
          "update customer_clean_items set status = 'kept', customer_id = $2, note = $3, decided_by = $4, decided_at = now() where id = $1",
          [it.id, res.id, res.merged ? `Merged into “${res.name}”, locked.` : `Named “${res.name}”, locked.`, who],
        );
        return readReport(sql, true);
      }
    }
    if (data.action === "approve" && data.rowId) {
      // The name you chose from the clean list replaces the suggested one on this line, with that row's details.
      const row = (
        await sql.query<{ name: string; internal_id: string | null; address: string | null; sales_rep: string | null; rep_name: string | null; rep_flag: string | null }>(
          "select name, internal_id, address, sales_rep, rep_name, rep_flag from customer_clean_rows where id = $1",
          [data.rowId],
        )
      )[0];
      if (!row) throw new Error("That name is no longer on the clean list. Read the list again.");
      await sql.query(
        `update customer_clean_items set clean_name = $2, netsuite_id = $3, address = $4, sales_rep = $5, rep_name = $6, rep_flag = $7,
                kind = case when kind in ('no_match', 'exact') then 'similar' else kind end, reason = $8
          where id = $1`,
        [it.id, row.name, row.internal_id, row.address, row.sales_rep, row.rep_name, row.rep_flag, `Name chosen from the clean list by ${who}`],
      );
      Object.assign(it, {
        clean_name: row.name,
        netsuite_id: row.internal_id,
        address: row.address,
        sales_rep: row.sales_rep,
        rep_name: row.rep_name,
        rep_flag: row.rep_flag,
        kind: it.kind === "no_match" || it.kind === "exact" ? "similar" : it.kind,
      });
    }
    if (data.action === "approve" && data.keepName) {
      if (!it.customer_id) throw new Error("There is no KatzDesk account on this line.");
      await lockAccount(sql, it.customer_id, who, null);
      await sql.query(
        "update customer_clean_items set status = 'kept', note = 'Kept the KatzDesk name, now locked.', decided_by = $2, decided_at = now() where id = $1",
        [it.id, who],
      );
      await sql.query(
        `update customer_clean_items set status = 'skipped', note = 'The KatzDesk name was kept for this account.', decided_by = $3, decided_at = now()
          where run_id = $1 and customer_id = $2 and id <> $4 and status = 'pending'`,
        [it.run_id, it.customer_id, who, it.id],
      );
      return readReport(sql, true);
    }
    // A line read before ID, address and rep were carried has none of them: lock only, never blank a rep.
    const line: LineDetails | null =
      it.clean_name && (it.address != null || it.sales_rep != null || it.rep_name != null || it.rep_flag != null) ? it : null;
    const mark = (status: CleanStatus, note: string | null = null) =>
      sql.query("update customer_clean_items set status = $2, note = $3, decided_by = $4, decided_at = now() where id = $1", [
        it.id,
        status,
        note,
        who,
      ]);

    if (data.action === "drop") {
      // Remove Name: takes an unmatched name with nothing on it off the review list. The account itself is untouched.
      if (it.status === "locked" || it.status === "kept" || it.status === "apply") {
        throw new Error("A locked match stays on the review. Unlock it first if it is wrong.");
      }
      const name = it.customer_id
        ? (await sql.query<{ name: string }>("select name from directory_customers where id = $1", [it.customer_id]))[0]?.name
        : it.clean_name;
      if (name) {
        const used = await sql.query(
          `select 1 from service_jobs where lower(customer) = lower($1)
           union all select 1 from pm_jobs where lower(customer) = lower($1)
           union all select 1 from installs where archived = false and lower(customer) = lower($1)
           union all select 1 from deals where archived = false and lower(customer) = lower($1)
           limit 1`,
          [name],
        );
        if (used[0]) throw new Error(`“${name}” has tickets, installs or deals on it, so it stays on the review.`);
      }
      await mark("removed", "Removed from the review: no history on this name.");
      return readReport(sql, true);
    }
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
      await lockAccount(sql, it.customer_id, who, line);
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
        await lockAccount(sql, id, who, line);
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
        await lockAccount(sql, id, who, name ? line : null);
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
