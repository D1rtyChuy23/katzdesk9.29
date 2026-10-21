/**
 * An install project's Corrigo work orders. installs.wo is the primary (first) WO; install_work_orders holds every WO
 * the install carries, the primary included, with Corrigo's status for each. Lookups read both, so an install whose
 * row is missing is still found by its primary.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { addDays, todayChicago } from "@/lib/ops/clock";
import { WO_WRAP, woCanonical, woMatchKey } from "@/lib/ops/corrigo";
import type { InstallWorkOrder } from "@/lib/ops/types";
import { INSTALL_WOS_SQL, findWoEverywhere, type WoBoardHit } from "@/lib/ops/wo-search";

export { INSTALL_WOS_SQL } from "@/lib/ops/wo-search";

export type { InstallWorkOrder };

type WoRow = {
  install_id: number;
  wo: string;
  match_key: string;
  status: string | null;
  completed_at: string | null;
  received: string | null;
  source: string | null;
  added_by: string | null;
  added_at: unknown;
};

const stamp = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

/** Each install's work orders, the primary first, then in the order they were added. */
export async function loadInstallWos(sql: Sql, ids: number[]): Promise<Map<number, InstallWorkOrder[]>> {
  const out = new Map<number, InstallWorkOrder[]>();
  const list = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (!list.length) return out;
  const [rows, primaries] = await Promise.all([
    sql.query<WoRow>(
      `select install_id, wo, match_key, status, to_char(completed_at, 'YYYY-MM-DD') as completed_at,
              to_char(received, 'YYYY-MM-DD') as received, source, added_by, added_at
         from install_work_orders where install_id = any($1::int[]) order by added_at, id`,
      [list],
    ),
    sql.query<{ id: number; wo: string | null; complete: boolean; completed_at: string | null }>(
      `select id, wo, complete, to_char(completed_at, 'YYYY-MM-DD') as completed_at from installs where id = any($1::int[])`,
      [list],
    ),
  ]);
  for (const p of primaries) {
    const key = woMatchKey(p.wo ?? "");
    const mine = rows
      .filter((r) => r.install_id === p.id)
      .map(
        (r): InstallWorkOrder => ({
          wo: r.wo,
          matchKey: r.match_key,
          status: r.status,
          completedAt: r.completed_at,
          primary: !!key && r.match_key === key,
          received: r.received,
          source: r.source,
          addedBy: r.added_by,
          addedAt: stamp(r.added_at),
        }),
      );
    if (key && !mine.some((w) => w.primary)) {
      // installs.wo with no row yet (written before the table, or by an older window).
      mine.unshift({
        wo: String(p.wo).trim(),
        matchKey: key,
        status: p.complete ? "Completed" : null,
        completedAt: p.complete ? p.completed_at : null,
        primary: true,
        received: null,
        source: null,
        addedBy: null,
        addedAt: null,
      });
    }
    out.set(p.id, [...mine.filter((w) => w.primary), ...mine.filter((w) => !w.primary)]);
  }
  return out;
}

/** Fill each install's workOrders (the board, the window and the account page read them). */
export async function withWorkOrders<T extends { id: number; workOrders?: InstallWorkOrder[] }>(sql: Sql, installs: T[]): Promise<T[]> {
  const wos = await loadInstallWos(sql, installs.map((i) => i.id));
  for (const i of installs) i.workOrders = wos.get(i.id) ?? [];
  return installs;
}

/**
 * Put a WO on an install, or update the one it has with that number: Corrigo's status and completed date (a blank
 * cell keeps what was there). The first WO becomes installs.wo.
 */
export async function recordInstallWo(
  sql: Sql,
  installId: number,
  wo: { wo: string; status?: string | null; completedAt?: string | null; received?: string | null; source: string; addedBy?: string | null },
): Promise<void> {
  const key = woMatchKey(wo.wo);
  const cur = (await sql.query<{ wo: string | null }>("select wo from installs where id = $1", [installId]))[0];
  if (!key || !cur) return;
  const primaryKey = woMatchKey(cur.wo ?? "");
  if (primaryKey && primaryKey !== key) {
    // A primary saved before its row gets one first, so the list keeps it first.
    await sql.query(
      `insert into install_work_orders (install_id, wo, match_key, source) values ($1, $2, $3, 'backfill')
       on conflict (install_id, match_key) do nothing`,
      [installId, String(cur.wo).trim(), primaryKey],
    );
  }
  await sql.query(
    `insert into install_work_orders (install_id, wo, match_key, status, completed_at, received, source, added_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (install_id, match_key) do update
       set status = coalesce(excluded.status, install_work_orders.status),
           completed_at = coalesce(excluded.completed_at, install_work_orders.completed_at)`,
    // A WO is dated the day it came onto the install unless Corrigo's own date is known.
    [installId, wo.wo.trim(), key, wo.status?.trim() || null, wo.completedAt || null, wo.received || todayChicago(), wo.source, wo.addedBy ?? null],
  );
  if (!primaryKey) await sql.query("update installs set wo = $2, updated_at = now() where id = $1", [installId, wo.wo.trim()]);
}

/**
 * Take a WO off an install. The primary's place goes to the next WO (the oldest added); the last one leaves the
 * install with no WO. Returns the install's new primary.
 */
export async function dropInstallWo(sql: Sql, installId: number, matchKey: string, opts?: { primary?: boolean }): Promise<string | null> {
  const cur = await sql.query<{ wo: string | null }>("select wo from installs where id = $1", [installId]);
  if (!cur[0]) throw new Error("Install not found");
  await sql.query("delete from install_work_orders where install_id = $1 and match_key = $2", [installId, matchKey]);
  // `primary`: installs.wo was already cleared (the window's WO # field), so it can't say which one was first.
  if (!(opts?.primary ?? woMatchKey(cur[0].wo ?? "") === matchKey)) return cur[0].wo;
  const next = await sql.query<{ wo: string }>(
    "select wo from install_work_orders where install_id = $1 order by added_at, id limit 1",
    [installId],
  );
  const primary = next[0]?.wo ?? null;
  await sql.query("update installs set wo = $2, updated_at = now() where id = $1", [installId, primary]);
  return primary;
}

/**
 * The install window's WO # field changed the primary: the primary's row takes the new number (a number the install
 * already has becomes the primary), and a blank field takes the primary off.
 */
export async function setPrimaryWo(sql: Sql, installId: number, before: string | null, after: string | null, actor: string): Promise<void> {
  const oldKey = woMatchKey(before ?? "");
  const newKey = woMatchKey(after ?? "");
  if (oldKey === newKey) return;
  if (!newKey) {
    if (oldKey) await dropInstallWo(sql, installId, oldKey, { primary: true });
    return;
  }
  const has = await sql.query("select 1 from install_work_orders where install_id = $1 and match_key = $2", [installId, newKey]);
  if (oldKey && !has[0]) {
    await sql.query("update install_work_orders set wo = $3, match_key = $4 where install_id = $1 and match_key = $2", [
      installId,
      oldKey,
      after!.trim(),
      newKey,
    ]);
  }
  await recordInstallWo(sql, installId, { wo: after!, source: "desk", addedBy: actor });
}

async function actorName(sql: Sql, userId: string): Promise<string> {
  return (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}

async function log(sql: Sql, installId: number, actor: string, detail: string): Promise<void> {
  await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, 'updated', $3)", [
    installId,
    actor,
    detail,
  ]);
}

async function openInstall(sql: Sql, installId: number): Promise<{ id: number; wo: string | null }> {
  const rows = await sql.query<{ id: number; wo: string | null }>("select id, wo from installs where id = $1 and archived = false", [installId]);
  if (!rows[0]) throw new Error("Install not found");
  return rows[0];
}

/** Corrigo's ST# numbers started over after 9999 somewhere on the desk (deskHasWrapped, read in SQL). */
async function deskWrapped(sql: Sql): Promise<boolean> {
  const rows = await sql.query(
    `select 1 from (select wo from service_jobs union all select wo from pm_jobs union all select wo from installs
                    union all select wo from install_work_orders) w
      where ltrim(regexp_replace(coalesce(wo, ''), '[^0-9]', '', 'g'), '0') ~ '^[0-9]{4,}$'
        and ltrim(regexp_replace(wo, '[^0-9]', '', 'g'), '0')::numeric >= ${WO_WRAP}
      limit 1`,
  );
  return rows.length > 0;
}

/**
 * One WO is one install's: two projects with one number are one project. Refuse a WO another open install carries —
 * after the wrap, not a completed install whose WO came in and that was completed over a year ago (a new job's number).
 */
export async function assertWoFree(sql: Sql, installId: number, raw: string): Promise<void> {
  const key = woMatchKey(raw);
  if (!key) return;
  const near = await sql.query<{ id: number; wo: string; complete: boolean; received: string | null; completed_at: string | null }>(
    `select i.id, w.wo, i.complete, to_char(i.completed_at, 'YYYY-MM-DD') as completed_at,
            to_char(coalesce((select x.received from install_work_orders x where x.install_id = i.id and x.wo = w.wo limit 1),
                             i.received, i.completed_at), 'YYYY-MM-DD') as received
       from installs i join ${INSTALL_WOS_SQL} w on w.install_id = i.id
      where i.archived = false and i.id <> $1 and regexp_replace(w.wo, '[^A-Za-z0-9]', '', 'g') ilike '%' || $2 || '%'
      order by i.id`,
    [installId, key],
  );
  const hits = near.filter((r) => woMatchKey(r.wo) === key);
  if (!hits.length) return;
  const n = /^\d+$/.test(key) ? Number(key) : Infinity;
  const cutoff = addDays(todayChicago(), -365);
  const wrapped = n <= WO_WRAP && hits.some((r) => r.complete) ? await deskWrapped(sql) : false;
  // A long project completed recently keeps its number: both its WO and its completion must be over a year old.
  const old = (r: (typeof hits)[number]) => !!r.received && r.received < cutoff && !!r.completed_at && r.completed_at < cutoff;
  const other = hits.find((r) => !(wrapped && r.complete && old(r)));
  if (other) throw new Error(`${/^\d+$/.test(key) ? woCanonical(raw) : raw.trim()} is on install #${other.id}. Merge the installs instead.`);
}

const addInput = z.object({ installId: z.number().int().positive(), wo: z.string().trim().min(1).max(60) });
const removeInput = z.object({ installId: z.number().int().positive(), matchKey: z.string().trim().min(1).max(60) });

export type InstallWoResult = { workOrders: InstallWorkOrder[]; primary: string | null; alsoOn: WoBoardHit[] };

/** Add a WO the install window typed ("855", "WO-0855"). Tickets elsewhere with the number are named, not changed. */
export async function addInstallWorkOrderFor(sql: Sql, userId: string, data: z.infer<typeof addInput>): Promise<InstallWoResult> {
  const install = await openInstall(sql, data.installId);
  const key = woMatchKey(data.wo);
  if (!key) throw new Error("Enter a WO number.");
  const wo = /^\d+$/.test(key) ? woCanonical(data.wo) : data.wo.trim();
  const have = (await loadInstallWos(sql, [install.id])).get(install.id) ?? [];
  if (have.some((w) => w.matchKey === key)) throw new Error(`${wo} is already on this install.`);
  await assertWoFree(sql, install.id, data.wo);
  const actor = await actorName(sql, userId);
  await recordInstallWo(sql, install.id, { wo, source: "desk", addedBy: actor });
  await log(sql, install.id, actor, `added ${wo}`);
  const alsoOn = /^\d+$/.test(key) ? (await findWoEverywhere(sql, key)).filter((h) => !(h.entityType === "install" && h.id === install.id)) : [];
  const workOrders = (await loadInstallWos(sql, [install.id])).get(install.id) ?? [];
  return { workOrders, primary: workOrders.find((w) => w.primary)?.wo ?? null, alsoOn };
}

/** Take one WO off the install; the next WO becomes the primary when the primary goes. */
export async function removeInstallWorkOrderFor(sql: Sql, userId: string, data: z.infer<typeof removeInput>): Promise<InstallWoResult> {
  const install = await openInstall(sql, data.installId);
  const have = (await loadInstallWos(sql, [install.id])).get(install.id) ?? [];
  const gone = have.find((w) => w.matchKey === data.matchKey);
  if (!gone) throw new Error("That WO is not on this install.");
  const primary = await dropInstallWo(sql, install.id, data.matchKey);
  const actor = await actorName(sql, userId);
  await log(sql, install.id, actor, `removed ${gone.wo}${gone.primary && primary ? ` · ${primary} is the first WO now` : ""}`);
  const workOrders = (await loadInstallWos(sql, [install.id])).get(install.id) ?? [];
  return { workOrders, primary, alsoOn: [] };
}

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

export const addInstallWorkOrder = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof addInput>) => addInput.parse(d))
  .handler(async ({ data, context }) => addInstallWorkOrderFor(await ready(), context.userId, data));

export const removeInstallWorkOrder = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof removeInput>) => removeInput.parse(d))
  .handler(async ({ data, context }) => removeInstallWorkOrderFor(await ready(), context.userId, data));
