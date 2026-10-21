/** Finding a ticket by its WO / ST number on every board, in any status. */

import { woMatchKey } from "./corrigo.ts";
import { isInstalled } from "./install-status.ts";

/**
 * The match key when a search box holds a WO number: "WO-0855", "wo855", "ST# 855", "0855", "855".
 * Bare digits need three or more so a short number keeps searching as plain text. Anything else: null.
 */
export function woSearchKey(q: string | null | undefined): string | null {
  const t = String(q ?? "").trim();
  if (!/^(?:(?:work\s*order|w\.?o\.?|s\.?t\.?)[\s#.:-]*\d+|#?\d{3,})$/i.test(t)) return null;
  const key = woMatchKey(t);
  return /^\d+$/.test(key) ? key : null;
}

/** Same ticket number however it is spelled: WO-0855, WO-855, WO855 and 0855 all match key 855. */
export function woMatchesSearch(wo: string | null | undefined, key: string): boolean {
  return !!wo && woMatchKey(wo) === key;
}

/** Every WO a row carries: its own, and an install project's other work orders. */
export function rowWos(row: { wo?: string | null; workOrders?: { wo: string }[] | null }): string[] {
  return [row.wo ?? "", ...(row.workOrders ?? []).map((w) => w.wo)].filter((wo) => wo.trim());
}

/**
 * A board's rows for a search: tickets whose WO matches (any of an install's work orders) come first and ignore the
 * view, status and other filters; then the rows the view already shows. Without a WO number in the box, `shown` is
 * returned as is.
 */
export function withWoMatches<T extends { id: number; wo?: string | null; workOrders?: { wo: string }[] | null }>(
  shown: T[],
  all: T[],
  q: string,
): T[] {
  const key = woSearchKey(q);
  if (!key) return shown;
  const hits = all.filter((row) => rowWos(row).some((wo) => woMatchesSearch(wo, key)));
  const ids = new Set(hits.map((row) => row.id));
  return [...hits, ...shown.filter((row) => !ids.has(row.id))];
}

export type WoBoardHit = {
  entityType: "service" | "tlc" | "pm" | "install";
  id: number;
  customer: string | null;
  wo: string;
  status: string;
};

/** SQL: every (install_id, wo) an install carries — its work-order rows, and installs.wo in case a row is missing. */
export const INSTALL_WOS_SQL = `(select install_id, wo from install_work_orders
   union select id as install_id, btrim(wo) as wo from installs where coalesce(btrim(wo), '') <> '')`;

/** SQL: the digits of a stored WO with leading zeros dropped — the same key as woMatchKey for WO-#### values. */
const WO_KEY_SQL = (col: string) => `ltrim(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), '0')`;

/**
 * Every ticket carrying this WO key: service, TLC, PM and install boards, open or closed. With `inScope` (a sales
 * rep's accounts), tickets, TLCs and PMs on other accounts are left out, as listJobs and listPms do; installs stay.
 */
export async function findWoEverywhere(
  sql: { query: <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]> },
  key: string,
  inScope?: ((customer: string | null) => boolean) | null,
): Promise<WoBoardHit[]> {
  const k = key.replace(/^0+/, "");
  if (!k) return [];
  const jobs = await sql.query<{ id: number; kind: string; customer: string | null; wo: string; status: string }>(
    `select id, kind, customer, wo, status from service_jobs where ${WO_KEY_SQL("wo")} = $1 order by id`,
    [k],
  );
  const pms = await sql.query<{ id: number; customer: string | null; wo: string; status: string }>(
    `select id, customer, wo, status from pm_jobs where ${WO_KEY_SQL("wo")} = $1 order by id`,
    [k],
  );
  // An install is found by any of its work orders; the hit names the WO that matched.
  const installs = await sql.query<{ id: number; customer: string | null; wo: string; equip_status: string | null; complete: boolean }>(
    `select distinct on (i.id) i.id, i.customer, w.wo, i.equip_status, i.complete
       from installs i join ${INSTALL_WOS_SQL} w on w.install_id = i.id
      where i.archived = false and ${WO_KEY_SQL("w.wo")} = $1
      order by i.id`,
    [k],
  );
  const exact = (wo: string) => woMatchKey(wo) === k;
  const shown = (r: { wo: string; customer: string | null }) => exact(r.wo) && (!inScope || inScope(r.customer));
  return [
    ...jobs.filter(shown).map((r) => ({ entityType: (r.kind === "tlc" ? "tlc" : "service") as "service" | "tlc", id: r.id, customer: r.customer, wo: r.wo, status: r.status })),
    ...pms.filter(shown).map((r) => ({ entityType: "pm" as const, id: r.id, customer: r.customer, wo: r.wo, status: r.status })),
    ...installs.filter((r) => exact(r.wo)).map((r) => ({
      entityType: "install" as const,
      id: r.id,
      customer: r.customer,
      wo: r.wo,
      status: isInstalled({ complete: r.complete, equipStatus: r.equip_status }) ? "Installed" : r.equip_status || "Not Ready",
    })),
  ];
}

/**
 * The top search's text matches on tickets/TLCs (newest 8) and PMs (5). With `inScope` (a sales rep's accounts),
 * other accounts' rows are left out before the 8 and 5 are taken, as findWoEverywhere, listJobs and listPms do.
 */
export async function searchTicketText(
  sql: { query: <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]> },
  like: string,
  inScope?: ((customer: string | null) => boolean) | null,
) {
  const jobs = await sql.query<{ id: number; kind: string; customer: string | null; call_id: string; status: string; wo: string | null }>(
    `select id, kind, customer, call_id, status, wo from service_jobs
      where customer ilike $1 or call_id ilike $1 or coalesce(wo,'') ilike $1 or coalesce(issue,'') ilike $1
      order by received desc nulls last${inScope ? "" : " limit 8"}`,
    [like],
  );
  const pms = await sql.query<{ id: number; customer: string; status: string; equipment: string | null; wo: string | null }>(
    `select id, customer, status, equipment, wo from pm_jobs where customer ilike $1 or coalesce(wo,'') ilike $1${inScope ? "" : " limit 5"}`,
    [like],
  );
  const shown = (r: { customer: string | null }) => !inScope || inScope(r.customer);
  return { jobs: jobs.filter(shown).slice(0, 8), pms: pms.filter(shown).slice(0, 5) };
}

/** Board name a person sees, for "WO-0859 is on PMs". */
export function woBoardName(entityType: string): string {
  if (entityType === "tlc") return "TLC + Factor";
  if (entityType === "pm") return "PMs";
  if (entityType === "install") return "Installs";
  return "Tickets";
}
