/**
 * Equipment change history (Chuy, 11/19, after Lopez Mexican Restaurant install #191 lost two units with no trace).
 *
 * Triggers in migrations/0130_equipment_history.sql write a row for every create, update, move, retire, put-back and
 * remove of an account unit, and every add or removal of a unit on an install and change to an install's equipment
 * list: who, when, field, old value, new value. No path that writes a unit can skip them. The rows can't be edited or
 * deleted (a trigger refuses).
 *
 * Who: a save names its person by writing through `asActor(sql, name)`, which runs each statement in a transaction
 * that first sets katz.actor (and katz.action for a move, retire or put-back). A write that doesn't is recorded as System.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { checked } from "@/lib/ops/checked-input";

export type HistoryAction = "create" | "update" | "move" | "retire" | "put_back" | "remove" | "add_to_install" | "remove_from_install" | "merge";

export type HistoryEntry = {
  id: number;
  /** When, in Houston's time: "YYYY-MM-DD HH:MM". */
  at: string;
  unitId: number | null;
  installId: number | null;
  customer: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: string;
  note: string | null;
};

/** The same client, naming who writes (and what, for a move, retire or put-back). A client without it writes as before. */
export function asActor(sql: Sql, actor: string | null | undefined, action?: HistoryAction | null): Sql {
  // No name given: the signed-in person of this request (src/lib/request-actor.server.ts), when there is one.
  const store = (globalThis as { __katzRequestActor__?: { getStore(): { actor: string } | undefined } }).__katzRequestActor__;
  const name = (actor ?? "").trim() || store?.getStore()?.actor || "";
  return name && sql.as ? sql.as(name, action ?? null) : sql;
}

/** The desk username for a signed-in user, as history names them. */
export async function actorName(sql: Sql, userId: string | null | undefined): Promise<string> {
  if (!userId) return "System";
  const row = (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0];
  return row?.username || "Teammate";
}

const COLUMNS = `id, to_char(at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as at, unit_id, install_id, customer, action, field, old_value, new_value, actor, note`;

type Row = {
  id: number;
  at: string;
  unit_id: number | null;
  install_id: number | null;
  customer: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string;
  note: string | null;
};
const map = (r: Row): HistoryEntry => ({
  id: Number(r.id),
  at: r.at,
  unitId: r.unit_id == null ? null : Number(r.unit_id),
  installId: r.install_id == null ? null : Number(r.install_id),
  customer: r.customer,
  action: r.action,
  field: r.field,
  oldValue: r.old_value,
  newValue: r.new_value,
  actor: r.actor,
  note: r.note,
});

/** A unit's history, newest first. */
export async function listUnitHistory(sql: Sql, unitId: number, limit = 300): Promise<HistoryEntry[]> {
  return (await sql.query<Row>(`select ${COLUMNS} from equipment_history where unit_id = $1 order by at desc, id desc limit $2`, [unitId, limit])).map(map);
}

/** An install's equipment history, newest first: its list, units added to or taken off it, and those units' own changes. */
export async function listInstallHistory(sql: Sql, installId: number, limit = 400): Promise<HistoryEntry[]> {
  return (
    await sql.query<Row>(
      `select ${COLUMNS} from equipment_history h
        where h.install_id = $1
           or h.unit_id in (select equipment_id from install_inspection_units where install_id = $1
                            union select unit_id from install_units_removed where install_id = $1
                            union select unit_id from equipment_history where install_id = $1 and unit_id is not null)
        order by at desc, id desc limit $2`,
      [installId, limit],
    )
  ).map(map);
}

const FIELD_LABEL: Record<string, string> = {
  customer: "Account",
  catalog_model: "Model",
  equipment_name: "Name",
  serial: "Serial",
  part_number: "Part #",
  ownership: "Ownership",
  install_date: "Install date",
  condition: "Condition",
  electrical: "Electrical",
  locked: "Lock",
  install: "Install",
  visit_kind: "Pre-inspection kind",
  "equipment list": "Equipment list",
};
const ACTION_LABEL: Record<string, string> = {
  create: "Added",
  update: "Changed",
  move: "Moved",
  retire: "Retired",
  put_back: "Put back",
  remove: "Removed",
  add_to_install: "Added to install",
  remove_from_install: "Taken off install",
  merge: "Merged",
};
export const historyFieldLabel = (f: string | null) => (f ? (FIELD_LABEL[f] ?? f) : "");
export const historyActionLabel = (a: string) => ACTION_LABEL[a] ?? a;

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

export const getUnitHistory = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(checked(z.object({ unitId: z.number().int().positive() })))
  .handler(async ({ data }) => listUnitHistory(await ready(), data.unitId));

export const getInstallHistory = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(checked(z.object({ installId: z.number().int().positive() })))
  .handler(async ({ data }) => listInstallHistory(await ready(), data.installId));
