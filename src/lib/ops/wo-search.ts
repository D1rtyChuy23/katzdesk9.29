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

/**
 * A board's rows for a search: tickets whose WO matches come first and ignore the view, status and other
 * filters; then the rows the view already shows. Without a WO number in the box, `shown` is returned as is.
 */
export function withWoMatches<T extends { id: number; wo?: string | null }>(shown: T[], all: T[], q: string): T[] {
  const key = woSearchKey(q);
  if (!key) return shown;
  const hits = all.filter((row) => woMatchesSearch(row.wo, key));
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

/** SQL: the digits of a stored WO with leading zeros dropped — the same key as woMatchKey for WO-#### values. */
const WO_KEY_SQL = (col: string) => `ltrim(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), '0')`;

/** Every ticket carrying this WO key: service, TLC, PM and install boards, open or closed. */
export async function findWoEverywhere(
  sql: { query: <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]> },
  key: string,
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
  const installs = await sql.query<{ id: number; customer: string | null; wo: string; equip_status: string | null; complete: boolean }>(
    `select id, customer, wo, equip_status, complete from installs where archived = false and ${WO_KEY_SQL("wo")} = $1 order by id`,
    [k],
  );
  const exact = (wo: string) => woMatchKey(wo) === k;
  return [
    ...jobs.filter((r) => exact(r.wo)).map((r) => ({ entityType: (r.kind === "tlc" ? "tlc" : "service") as "service" | "tlc", id: r.id, customer: r.customer, wo: r.wo, status: r.status })),
    ...pms.filter((r) => exact(r.wo)).map((r) => ({ entityType: "pm" as const, id: r.id, customer: r.customer, wo: r.wo, status: r.status })),
    ...installs.filter((r) => exact(r.wo)).map((r) => ({
      entityType: "install" as const,
      id: r.id,
      customer: r.customer,
      wo: r.wo,
      status: isInstalled({ complete: r.complete, equipStatus: r.equip_status }) ? "Installed" : r.equip_status || "Not Ready",
    })),
  ];
}

/** Board name a person sees, for "WO-0859 is on PMs". */
export function woBoardName(entityType: string): string {
  if (entityType === "tlc") return "TLC + Factor";
  if (entityType === "pm") return "PMs";
  if (entityType === "install") return "Installs";
  return "Tickets";
}
