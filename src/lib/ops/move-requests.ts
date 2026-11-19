/**
 * Moving a unit to another account is an Admin's (Chuy, 11/19). When someone else says yes to "Serial X is on
 * <account>'s inventory. Move it?", the move is asked of an Admin instead, and nothing moves. An Admin confirms it
 * (the same move an Admin's own yes makes: details kept, the old account's Retired list notes it) or declines it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { checked } from "@/lib/ops/checked-input";
import { actorName } from "@/lib/ops/unit-history";

export const MOVE_ADMIN_ONLY = "Only an Admin can confirm or decline a move.";

export type MoveRequest = {
  id: number;
  unitId: number;
  serial: string;
  fromCustomer: string;
  toCustomer: string;
  installId: number | null;
  wo: string | null;
  askedBy: string;
  /** When, in Houston's time: "YYYY-MM-DD HH:MM". */
  askedAt: string;
};

/** Ask an Admin to move this unit onto the install. One open ask per unit and install. */
export async function askMove(
  sql: Sql,
  userId: string,
  ask: { unitId: number; fromCustomer: string; installId: number; serial: string; machineIndex: number | null },
): Promise<void> {
  const to = (await sql.query<{ customer: string }>("select customer from installs where id = $1", [ask.installId]))[0]?.customer ?? "";
  await sql.query(
    `insert into equipment_move_requests (unit_id, from_customer, to_customer, to_install_id, serial, machine_index, asked_by)
     select $1, $2, $3, $4, $5, $6, $7
      where not exists (select 1 from equipment_move_requests where unit_id = $1 and to_install_id = $4 and decided_at is null)`,
    [ask.unitId, ask.fromCustomer, to, ask.installId, ask.serial, ask.machineIndex, await actorName(sql, userId)],
  );
}

/** The open asks, oldest first; for one install, or all of them. */
export async function listMoveRequests(sql: Sql, installId?: number | null): Promise<MoveRequest[]> {
  const rows = await sql.query<{
    id: number;
    unit_id: number;
    serial: string;
    from_customer: string;
    to_customer: string;
    to_install_id: number | null;
    wo: string | null;
    asked_by: string;
    asked_at: string;
  }>(
    `select r.id, r.unit_id, r.serial, r.from_customer, r.to_customer, r.to_install_id, i.wo, r.asked_by,
            to_char(r.asked_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as asked_at
       from equipment_move_requests r left join installs i on i.id = r.to_install_id
      where r.decided_at is null and ($1::int is null or r.to_install_id = $1::int)
      order by r.asked_at, r.id`,
    [installId ?? null],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    unitId: Number(r.unit_id),
    serial: r.serial,
    fromCustomer: r.from_customer,
    toCustomer: r.to_customer,
    installId: r.to_install_id == null ? null : Number(r.to_install_id),
    wo: r.wo,
    askedBy: r.asked_by,
    askedAt: r.asked_at,
  }));
}

/**
 * An Admin's answer. Confirm runs the move an Admin's own yes makes; if it can't (locked, moved since), the ask stays
 * open with the reason. Either way the answer is written once: a second answer finds it decided.
 */
export async function decideMoveRequest(sql: Sql, userId: string, id: number, confirm: boolean): Promise<{ notice: string }> {
  if (!(await canReviewNames(sql, userId))) throw new Error(MOVE_ADMIN_ONLY);
  const r = (
    await sql.query<{ serial: string; from_customer: string; to_install_id: number | null; machine_index: number | null; decided_at: string | null }>(
      "select serial, from_customer, to_install_id, machine_index, decided_at from equipment_move_requests where id = $1",
      [id],
    )
  )[0];
  if (!r) throw new Error("That move request isn't there.");
  if (r.decided_at) throw new Error("That move was already answered.");
  const who = await actorName(sql, userId);
  let notice = "Move declined.";
  if (confirm) {
    if (!r.to_install_id) throw new Error("That move has no install to go to.");
    const { pullSerial } = await import("@/lib/ops/serial-pull");
    const out = await pullSerial(sql, userId, { serial: r.serial, installId: Number(r.to_install_id), machineIndex: r.machine_index, moveFrom: r.from_customer });
    if (out.needsConfirm || out.moveAsked) throw new Error(out.notice || "That serial couldn't be moved.");
    notice = out.notice;
  }
  const done = await sql.query(
    "update equipment_move_requests set decided_at = now(), decided_by = $2, decision = $3 where id = $1 and decided_at is null returning id",
    [id, who, confirm ? "confirmed" : "declined"],
  );
  if (!done.length) throw new Error("That move was already answered.");
  return { notice };
}

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

export const getMoveRequests = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(checked(z.object({ installId: z.number().int().positive().nullable().optional() })))
  .handler(async ({ data }) => listMoveRequests(await ready(), data.installId ?? null));

export const answerMoveRequest = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(checked(z.object({ id: z.number().int().positive(), confirm: z.boolean() })))
  .handler(async ({ data, context }) => decideMoveRequest(await ready(), context.userId, data.id, data.confirm));
