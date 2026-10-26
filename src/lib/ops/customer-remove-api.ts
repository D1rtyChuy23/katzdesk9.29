/**
 * Customers → Remove, for one account or a selection (Chuy, 2026-10-26: "allow me to remove accounts by adding a remove
 * button to the selection"). Removing takes an account off the Customers list and out of the pickers; nothing is
 * deleted. Its calls, PMs, installs and deals keep the name. Any account can be removed, with or without an Account
 * Number. Customers → Removed lists what was removed, by whom and when, and Restore brings an account back.
 *
 * A merged account is archived too, but never marked removed, so it isn't listed under Removed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, requireAdmin } from "@/lib/ops/access";

/** One Remove or Restore takes at most this many accounts. */
export const CUSTOMER_BATCH_MAX = 5000;

export type RemovedCustomer = {
  id: number;
  name: string;
  accountNumber: string | null;
  removedAt: string;
  removedBy: string | null;
  /** Calls, TLCs, PMs, installs and deals still under the name. */
  history: number;
};

export type RemoveResult = { removed: { id: number; name: string }[] };
export type RestoreResult = { restored: { id: number; name: string }[]; skipped: { id: number; name: string; why: string }[] };

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

async function nameOf(sql: Sql, userId: string): Promise<string> {
  return (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

const cleanIds = (ids: number[]) => [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];

/**
 * Takes the accounts off the Customers list in one statement, with a history line for each. Accounts already removed
 * are left as they are. A removal flag from the Clean Names review is cleared: the account is dealt with.
 */
export async function removeCustomersFor(sql: Sql, userId: string, idsRaw: number[]): Promise<RemoveResult> {
  await requireAdmin(sql, userId, "Only an admin can add or remove customers.");
  const ids = cleanIds(idsRaw);
  if (!ids.length) return { removed: [] };
  if (ids.length > CUSTOMER_BATCH_MAX) throw new Error(`Remove at most ${CUSTOMER_BATCH_MAX.toLocaleString("en-US")} accounts at a time.`);
  const who = await nameOf(sql, userId);
  const rows = await sql.query<{ id: number; name: string }>(
    `with gone as (
       update directory_customers
          set archived = true, removal_flag = false, removed_at = now(), removed_by = $2, updated_at = now()
        where id = any($1::int[]) and archived = false
        returning id, name
     ), log as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'customer', id, $2, 'removed', 'Removed from Customers' from gone
       returning id
     )
     select id, name from gone order by lower(name), id`,
    [ids, who],
  );
  return { removed: rows.map((r) => ({ id: Number(r.id), name: String(r.name) })) };
}

/**
 * Brings removed accounts back onto the list. One is skipped, with the reason, when an account on the list now has
 * its name or its Account Number (both must stay unique on the list).
 */
export async function restoreCustomersFor(sql: Sql, userId: string, idsRaw: number[]): Promise<RestoreResult> {
  await requireAdmin(sql, userId, "Only an admin can add or remove customers.");
  const ids = cleanIds(idsRaw);
  if (!ids.length) return { restored: [], skipped: [] };
  if (ids.length > CUSTOMER_BATCH_MAX) throw new Error(`Restore at most ${CUSTOMER_BATCH_MAX.toLocaleString("en-US")} accounts at a time.`);
  const picks = await sql.query<{ id: number; name: string; account_number: string | null }>(
    `select id, name, account_number from directory_customers
      where id = any($1::int[]) and archived = true and removed_at is not null
      order by lower(name), id`,
    [ids],
  );
  const numberKey = (v: string | null) => String(v ?? "").trim().toLowerCase();
  const names = new Map(
    (
      await sql.query<{ k: string; name: string }>(
        "select lower(name) as k, name from directory_customers where archived = false and lower(name) = any($1::text[])",
        [picks.map((p) => p.name.toLowerCase())],
      )
    ).map((r) => [r.k, r.name]),
  );
  const numbers = new Map(
    (
      await sql.query<{ k: string; name: string }>(
        `select lower(btrim(account_number)) as k, name from directory_customers
          where archived = false and account_number is not null and lower(btrim(account_number)) = any($1::text[])`,
        [picks.map((p) => numberKey(p.account_number)).filter(Boolean)],
      )
    ).map((r) => [r.k, r.name]),
  );
  const ok: number[] = [];
  const skipped: RestoreResult["skipped"] = [];
  for (const p of picks) {
    const holder = names.get(p.name.toLowerCase());
    const num = numberKey(p.account_number);
    const numHolder = num ? numbers.get(num) : undefined;
    if (holder) skipped.push({ id: p.id, name: p.name, why: `“${holder}” is on the list with that name` });
    else if (numHolder) skipped.push({ id: p.id, name: p.name, why: `Account # ${String(p.account_number).trim()} is on “${numHolder}” now` });
    else {
      ok.push(p.id);
      names.set(p.name.toLowerCase(), p.name);
      if (num) numbers.set(num, p.name);
    }
  }
  if (!ok.length) return { restored: [], skipped };
  const who = await nameOf(sql, userId);
  const rows = await sql.query<{ id: number; name: string }>(
    `with back as (
       update directory_customers
          set archived = false, removed_at = null, removed_by = null, updated_at = now()
        where id = any($1::int[]) and archived = true and removed_at is not null
        returning id, name
     ), log as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'customer', id, $2, 'restored', 'Restored to Customers' from back
       returning id
     )
     select id, name from back order by lower(name), id`,
    [ok, who],
  );
  return { restored: rows.map((r) => ({ id: Number(r.id), name: String(r.name) })), skipped };
}

/** Accounts taken off the list with Remove, newest first, with how much history is still under each name. */
export async function listRemovedCustomersFor(sql: Sql): Promise<RemovedCustomer[]> {
  const rows = await sql.query<Record<string, unknown>>(
    `with h as (
       select lower(customer) as k, count(*)::int as n from service_jobs where coalesce(customer, '') <> '' group by 1
       union all
       select lower(customer), count(*)::int from pm_jobs where coalesce(customer, '') <> '' group by 1
       union all
       select lower(customer), count(*)::int from installs where archived = false and coalesce(customer, '') <> '' group by 1
       union all
       select lower(customer), count(*)::int from deals where archived = false and coalesce(customer, '') <> '' group by 1
     ), t as (select k, sum(n)::int as n from h group by k)
     select d.id, d.name, d.account_number, d.removed_at, d.removed_by, coalesce(t.n, 0)::int as history
       from directory_customers d
       left join t on t.k = lower(d.name)
      where d.archived = true and d.removed_at is not null
      order by d.removed_at desc, d.id desc`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    accountNumber: r.account_number == null || String(r.account_number).trim() === "" ? null : String(r.account_number),
    removedAt: r.removed_at instanceof Date ? r.removed_at.toISOString() : String(r.removed_at ?? ""),
    removedBy: r.removed_by == null ? null : String(r.removed_by),
    history: Number(r.history ?? 0),
  }));
}

const idsInput = z.object({ ids: z.array(z.number().int().positive()).min(1).max(CUSTOMER_BATCH_MAX) });

export const removeCustomers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[] }) => idsInput.parse(d))
  .handler(async ({ data, context }): Promise<RemoveResult> => removeCustomersFor(await ready(), context.userId, data.ids));

export const restoreCustomers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { ids: number[] }) => idsInput.parse(d))
  .handler(async ({ data, context }): Promise<RestoreResult> => restoreCustomersFor(await ready(), context.userId, data.ids));

export const listRemovedCustomers = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<RemovedCustomer[]> => {
    const sql = await ready();
    await requireAdmin(sql, context.userId, "Only an admin can see removed customers.");
    return listRemovedCustomersFor(sql);
  });
