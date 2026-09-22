import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import {
  DEFAULT_REPS,
  canonicalRepName,
  type CanonicalRep,
} from "./rep-match";
import { flagOn } from "./flag";
import { normalizeName } from "./norm";

export type DeskRep = {
  id: number;
  name: string;
  initials: string;
  active: boolean;
  sortOrder: number;
};

export type RepsState = {
  reps: DeskRep[];
  canEdit: boolean;
};

export type { CanonicalRep };
export {
  DEFAULT_REPS,
  PRODUCERS,
  PRODUCER_INITIALS,
  findRep,
  canonicalRepName,
  isKnownRep,
  isNoRep,
  formatRep,
  repInitials,
  sameRep,
} from "./rep-match";

export async function ensureReps(sql: Sql): Promise<void> {
  await sql.query(`
    create table if not exists desk_reps (
      id serial primary key,
      name text not null,
      initials text not null,
      active boolean not null default true,
      sort_order int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
  try {
    await sql.query("create unique index if not exists desk_reps_name_lower_uidx on desk_reps (lower(name))");
  } catch {
    /* PGlite may not support expression indexes */
  }
  const existing = await sql.query<{ name: string; initials: string }>("select name, initials from desk_reps");
  if (!existing.length) {
    let order = 10;
    for (const r of DEFAULT_REPS) {
      await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
        r.name,
        r.initials,
        order,
      ]);
      order += 10;
    }
    return;
  }
  for (const r of DEFAULT_REPS) {
    const hit = existing.find((e) => normalizeName(e.name) === normalizeName(r.name) || normalizeName(e.initials) === normalizeName(r.initials));
    if (!hit) {
      const max = await sql.query<{ n: number }>("select coalesce(max(sort_order), 0)::int as n from desk_reps");
      await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
        r.name,
        r.initials,
        (max[0]?.n ?? 0) + 10,
      ]);
    }
  }
}

export async function loadReps(sql: Sql): Promise<DeskRep[]> {
  await ensureReps(sql);
  const rows = await sql.query<{
    id: number;
    name: string;
    initials: string;
    active: boolean;
    sort_order: number;
  }>("select id, name, initials, active, sort_order from desk_reps order by sort_order, id");
  if (!rows.length) {
    return DEFAULT_REPS.map((r, i) => ({
      id: i + 1,
      name: r.name,
      initials: r.initials,
      active: true,
      sortOrder: (i + 1) * 10,
    }));
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    initials: r.initials,
    active: flagOn(r.active),
    sortOrder: r.sort_order,
  }));
}

export async function remapStoredReps(sql: Sql): Promise<{ deals: number; installs: number; customers: number }> {
  await ensureReps(sql);
  const deals = await sql.query<{ id: number; producer: string | null }>("select id, producer from deals");
  let dealN = 0;
  for (const d of deals) {
    const next = canonicalRepName(d.producer);
    if (next && next !== d.producer) {
      await sql.query("update deals set producer = $2, updated_at = now() where id = $1", [d.id, next]);
      dealN += 1;
    }
  }
  const installs = await sql.query<{ id: number; account_rep: string | null }>(
    "select id, account_rep from installs",
  );
  let instN = 0;
  for (const i of installs) {
    const next = canonicalRepName(i.account_rep);
    if (next && next !== i.account_rep) {
      await sql.query("update installs set account_rep = $2, updated_at = now() where id = $1", [i.id, next]);
      instN += 1;
    }
  }
  const customers = await sql.query<{ id: number; account_rep: string | null }>(
    "select id, account_rep from directory_customers",
  );
  let custN = 0;
  for (const c of customers) {
    const next = canonicalRepName(c.account_rep);
    if (next && next !== c.account_rep) {
      await sql.query("update directory_customers set account_rep = $2, updated_at = now() where id = $1", [
        c.id,
        next,
      ]);
      custN += 1;
    }
  }
  return { deals: dealN, installs: instN, customers: custN };
}

export type AccountMarks = {
  ak: Set<string>;
  rep: Map<string, string>;
};

export async function ensureAccountMarks(sql: Sql): Promise<void> {
  await sql.query(
    "alter table directory_customers add column if not exists account_rep text",
  );
  await sql.query(
    "alter table directory_customers add column if not exists avi_katz boolean not null default false",
  );
}

export async function loadAccountMarks(sql: Sql): Promise<AccountMarks> {
  await ensureAccountMarks(sql);
  const rows = await sql.query<{ name: string; avi_katz: boolean; account_rep: string | null }>(
    `select name, avi_katz, account_rep from directory_customers where archived = false`,
  );
  const ak = new Set<string>();
  const rep = new Map<string, string>();
  for (const r of rows) {
    const k = (r.name ?? "").trim().toLowerCase();
    if (!k) continue;
    if (flagOn(r.avi_katz)) ak.add(k);
    if (r.account_rep) rep.set(k, r.account_rep);
  }
  return { ak, rep };
}

export function customerKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

export function isAviKatz(marks: AccountMarks, customer: string | null | undefined): boolean {
  return marks.ak.has(customerKey(customer));
}

export async function upsertAccountMarks(
  sql: Sql,
  customer: string,
  patch: { aviKatz?: boolean; accountRep?: string | null },
): Promise<void> {
  await ensureAccountMarks(sql);
  const name = customer.trim();
  if (!name) return;
  const existing = await sql.query<{ id: number }>(
    "select id from directory_customers where lower(name) = $1 limit 1",
    [name.toLowerCase()],
  );
  const rep = patch.accountRep === undefined ? undefined : canonicalRepName(patch.accountRep);
  if (existing[0]) {
    if (patch.aviKatz !== undefined && patch.accountRep !== undefined) {
      await sql.query(
        `update directory_customers
            set avi_katz = $2, account_rep = $3, updated_at = now()
          where id = $1`,
        [existing[0].id, patch.aviKatz, rep ?? null],
      );
    } else if (patch.aviKatz !== undefined) {
      await sql.query(
        `update directory_customers set avi_katz = $2, updated_at = now() where id = $1`,
        [existing[0].id, patch.aviKatz],
      );
    } else if (patch.accountRep !== undefined) {
      await sql.query(
        `update directory_customers set account_rep = $2, updated_at = now() where id = $1`,
        [existing[0].id, rep ?? null],
      );
    }
    return;
  }
  await sql.query(
    `insert into directory_customers (name, avi_katz, account_rep)
     values ($1, $2, $3)`,
    [name, patch.aviKatz ?? false, patch.accountRep === undefined ? null : (rep ?? null)],
  );
}

export const listReps = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<RepsState> => {
    const sql = await getSql();
    const { canUserEditRoster } = await import("@/lib/ops/roster");
    const reps = await loadReps(sql);
    return { reps, canEdit: await canUserEditRoster(sql, context.userId) };
  });

export const addRep = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { name: string; initials: string }) =>
    z.object({ name: z.string().min(1), initials: z.string().min(1) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<RepsState> => {
    const sql = await getSql();
    const { requireRosterEditor } = await import("@/lib/ops/roster");
    await requireRosterEditor(sql, context.userId);
    const name = data.name.trim().replace(/\s+/g, " ");
    const initials = data.initials.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (name.length < 2) throw new Error("Enter a full name.");
    if (initials.length < 2) throw new Error("Enter initials (two letters).");
    const found = await sql.query<{ id: number }>(
      "select id from desk_reps where lower(name) = $1 or lower(initials) = $2 limit 1",
      [name, initials],
    );
    if (found[0]) {
      await sql.query(
        "update desk_reps set active = true, name = $2, initials = $3, updated_at = now() where id = $1",
        [found[0].id, name, initials],
      );
    } else {
      const max = await sql.query<{ n: number }>("select coalesce(max(sort_order), 0)::int as n from desk_reps");
      await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
        name,
        initials,
        (max[0]?.n ?? 0) + 10,
      ]);
    }
    return { reps: await loadReps(sql), canEdit: true };
  });

export const setRepActive = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; active: boolean }) => d)
  .handler(async ({ context, data }): Promise<RepsState> => {
    const sql = await getSql();
    const { requireRosterEditor } = await import("@/lib/ops/roster");
    await requireRosterEditor(sql, context.userId);
    await sql.query("update desk_reps set active = $2, updated_at = now() where id = $1", [
      data.id,
      data.active,
    ]);
    return { reps: await loadReps(sql), canEdit: true };
  });
