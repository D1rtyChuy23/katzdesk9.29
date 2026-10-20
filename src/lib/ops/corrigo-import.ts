import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { CLOSED_CALL, CLOSED_PM } from "@/lib/ops/lookups";
import { DEFAULT_PM_STYLE } from "@/lib/ops/pm-runbook";
import { todayChicago } from "@/lib/ops/clock";
import {
  boardStatus,
  deskHasWrapped,
  indexHits,
  isWalkIn,
  pickKeeper,
  resolvePreviewRow,
  shouldAttachToHit,
  woMatchKey,
  type CorrigoBoard,
  type CorrigoHit,
  type CorrigoPreviewPart,
  type CorrigoRecord,
} from "@/lib/ops/corrigo";
import { attachHeldReview, reconcileServiceDuplicates, tryMergeServiceDuplicate, type HeldReview } from "@/lib/ops/wo-duplicates";
import { lockedNameFor } from "@/lib/ops/clean-names-api";

export type CorrigoApplyResult = {
  updated: number;
  created: number;
  review: {
    id: number;
    wo: string;
    customer: string | null;
    status: string;
    technician: string | null;
    entityType: CorrigoBoard;
    reason?: "open" | "wrap" | "merge";
    note?: string;
  }[];
};

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

function jobBoard(kind: string | null | undefined): CorrigoBoard {
  return kind === "tlc" ? "tlc" : "service";
}

async function loadHits(sql: Awaited<ReturnType<typeof getSql>>): Promise<CorrigoHit[]> {
  const jobs = await sql.query<{
    id: number;
    wo: string | null;
    status: string;
    customer: string | null;
    kind: string;
    duplicate_of: number | null;
    done: boolean;
  }>(
    `select id, wo, status, customer, kind, duplicate_of, done from service_jobs
      where coalesce(wo, '') <> ''
      order by id asc`,
  );
  const pms = await sql.query<{
    id: number;
    wo: string | null;
    status: string;
    customer: string | null;
    done: boolean;
  }>(
    `select id, wo, status, customer, done from pm_jobs
      where coalesce(wo, '') <> ''
      order by id asc`,
  );
  const installs = await sql.query<{
    id: number;
    wo: string | null;
    status: string | null;
    customer: string;
    complete: boolean;
  }>(
    `select id, wo, equip_status as status, customer, complete from installs
      where archived = false and coalesce(wo, '') <> ''
      order by id asc`,
  );
  return [
    ...jobs.map((r) => ({
      board: jobBoard(r.kind),
      id: r.id,
      status: r.status,
      customer: r.customer,
      wo: r.wo,
      duplicateOf: r.duplicate_of ?? null,
      done: !!r.done,
    })),
    ...pms.map((r) => ({
      board: "pm" as const,
      id: r.id,
      status: r.status,
      customer: r.customer,
      wo: r.wo,
      done: !!r.done,
    })),
    ...installs.map((r) => ({
      board: "install" as const,
      id: r.id,
      status: r.complete ? "Installed" : r.status || "Not Ready",
      customer: r.customer,
      wo: r.wo,
      done: !!r.complete,
    })),
  ];
}

async function findExistingHit(
  sql: Awaited<ReturnType<typeof getSql>>,
  matchKey: string,
  preferredBoard?: CorrigoBoard | null,
  fileCustomer?: string | null,
  wrapped?: boolean,
): Promise<CorrigoHit | null> {
  if (!matchKey) return null;
  const hits = await loadHits(sql);
  const rolled = wrapped ?? deskHasWrapped(hits);
  const match = indexHits(hits).get(matchKey) ?? { unique: null, conflicts: [] };
  const group = [
    ...(match.unique ? [match.unique] : []),
    ...match.conflicts,
  ].filter((h, i, all) => all.findIndex((x) => x.board === h.board && x.id === h.id) === i);
  const attachable = group.filter((h) => shouldAttachToHit(h, fileCustomer, rolled));
  return pickKeeper(attachable, preferredBoard);
}

async function nextCallId(sql: Awaited<ReturnType<typeof getSql>>, received: string) {
  const ym = received.replace(/-/g, "").slice(0, 6);
  const prefix = `SC-${ym}-`;
  const last = await sql.query<{ call_id: string }>(
    `select call_id from service_jobs
      where call_id like $1
      order by call_id desc limit 1`,
    [prefix + "%"],
  );
  let seq = 1;
  if (last[0]) {
    const n = Number(last[0].call_id.slice(-3));
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

async function ensureCustomer(sql: Awaited<ReturnType<typeof getSql>>, name: string) {
  const trimmed = name.trim();
  if (!trimmed || isWalkIn(trimmed)) return;
  const found = await sql.query<{ id: number }>(
    `select id from directory_customers where lower(name) = lower($1) limit 1`,
    [trimmed],
  );
  if (found[0]) {
    await sql.query(
      `update directory_customers set archived = false, updated_at = now() where id = $1`,
      [found[0].id],
    );
    return;
  }
  try {
    await sql.query(`insert into directory_customers (name) values ($1)`, [trimmed]);
  } catch {
    /* unique race */
  }
}

async function logCorrigo(
  sql: Awaited<ReturnType<typeof getSql>>,
  board: CorrigoBoard,
  id: number,
  actor: string,
  detail: string,
) {
  await sql.query(
    `insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ($1, $2, $3, 'corrigo', $4)`,
    [board === "tlc" ? "tlc" : board, id, actor, detail],
  );
}

/** An update keeps the ticket's own spelling (WO-0870) when it is the same number. */
function storedWo(current: string | null, wo: string): string {
  return current && woMatchKey(current) === woMatchKey(wo) ? current : wo;
}

const recordInput = z.object({
  rawWo: z.string(),
  matchKey: z.string().regex(/^\d+$/),
  canonicalWo: z.string(),
  technician: z.string().nullable(),
  completedAt: z.string().nullable(),
  workDone: z.string().nullable(),
  statusRaw: z.string().nullable(),
  issue: z.string().nullable(),
  customer: z.string().nullable(),
  po: z.string().nullable(),
  callType: z.string().nullable(),
});

/** The browser reads the file and sends only these fields, a chunk at a time (Vercel refuses a request over ~4.5 MB). */
const previewInput = z.object({ records: z.array(recordInput).max(2000) });

export async function previewCorrigoRecords(sql: Sql, records: CorrigoRecord[]): Promise<CorrigoPreviewPart> {
  const hits = await loadHits(sql);
  const wrapped = deskHasWrapped(hits);
  const index = indexHits(hits);
  const rows = records.map((rec) =>
    resolvePreviewRow(rec, index.get(rec.matchKey) ?? { unique: null, conflicts: [] }, { wrapped }),
  );
  const unmapped = [
    ...new Set(rows.map((r) => r.statusUnmapped).filter((s): s is string => !!s)),
  ];
  return {
    updateCount: rows.filter((r) => r.action === "update").length,
    createCount: rows.filter((r) => r.action === "create").length,
    skipped: rows.filter((r) => r.action === "skip").length,
    conflictCount: rows.filter((r) => !!r.conflictIds?.length).length,
    wrapCount: rows.filter((r) => r.wrapRepeat).length,
    unmapped,
    rows,
  };
}

export const previewCorrigoImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof previewInput>) => previewInput.parse(d))
  .handler(async ({ data }) => previewCorrigoRecords(await ready(), data.records));

const applyRow = z.object({
  wo: z.string(),
  rawWo: z.string().optional(),
  matchKey: z.string().optional(),
  canonicalWo: z.string().optional(),
  matchNote: z.string().nullable().optional(),
  customer: z.string().nullable(),
  fileCustomer: z.string().nullable().optional(),
  existingCustomer: z.string().nullable().optional(),
  fileWalkIn: z.boolean().optional(),
  action: z.enum(["update", "create", "skip"]),
  board: z.enum(["service", "tlc", "pm", "install"]).optional(),
  boardLabel: z.string().nullable().optional(),
  jobId: z.number().nullable(),
  oldStatus: z.string().nullable(),
  newStatus: z.string(),
  statusUnmapped: z.string().nullable(),
  statusRaw: z.string().nullable(),
  technician: z.string().nullable(),
  completedAt: z.string().nullable(),
  workDone: z.string().nullable(),
  issue: z.string().nullable(),
  wrapRepeat: z.boolean().optional(),
  conflictIds: z
    .array(z.object({ board: z.enum(["service", "tlc", "pm", "install"]), id: z.number() }))
    .nullable()
    .optional(),
});

const applyInput = z.object({
  rows: z.array(applyRow).max(2000),
});

export async function applyCorrigoRows(
  sql: Sql,
  rows: z.infer<typeof applyRow>[],
  actor: string,
): Promise<CorrigoApplyResult> {
  let updated = 0;
  let created = 0;
  const review: CorrigoApplyResult["review"] = [];
  const heldPairs = new Map<string, HeldReview>();
  const holdKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const rememberHold = (keeperId: number, extraId: number, reason: string, perRowExtra: number) => {
    const key = holdKey(keeperId, extraId);
    if (!heldPairs.has(key)) heldPairs.set(key, { keeperId, extraId, reason, perRowExtra });
  };

  const hitsForWrap = await loadHits(sql);
  const wrapped = deskHasWrapped(hitsForWrap);
  let wrapRepeat = false;

  function maybeReview(
    board: CorrigoBoard,
    id: number,
    wo: string,
    customer: string | null,
    status: string,
    technician: string | null,
    closed: boolean,
  ) {
    const reason: "open" | "wrap" = wrapRepeat ? "wrap" : "open";
    if (reason === "open" && closed) return;
    if (review.some((r) => r.entityType === board && r.id === id)) {
      const cur = review.find((r) => r.entityType === board && r.id === id);
      if (cur && reason === "wrap") cur.reason = "wrap";
      return;
    }
    review.push({ id, wo, customer, status, technician, entityType: board, reason });
  }

  for (const row of rows) {
    if (row.action === "skip") continue;
    const wo = row.canonicalWo || row.wo;
    let board = (row.board ?? "service") as CorrigoBoard;
    const matchKey = row.matchKey || woMatchKey(wo);
    let action = row.action;
    let jobId = row.jobId;
    wrapRepeat = !!row.wrapRepeat;
    if (action === "create" || (action === "update" && !jobId)) {
      const hit = await findExistingHit(sql, matchKey, board, row.customer, wrapped);
      if (hit) {
        action = "update";
        jobId = hit.id;
        board = hit.board;
      }
    }
    // A locked clean-list name wins over the spelling in the Corrigo file.
    const typed = (row.customer ?? "").trim() || null;
    const chosen = typed ? (await lockedNameFor(sql, typed)) ?? typed : null;
    if (chosen) await ensureCustomer(sql, chosen);

    if (action === "update" && jobId) {
      if (board === "pm") {
        const cur = await sql.query<{
          id: number;
          status: string;
          technician: string | null;
          work_done: string | null;
          completed_at: string | null;
          customer: string | null;
          wo: string | null;
        }>(
          `select id, status, technician, work_done, completed_at, customer, wo from pm_jobs where id = $1`,
          [jobId],
        );
        if (!cur[0]) continue;
        const keptWo = storedWo(cur[0].wo, wo);
        const status = boardStatus("pm", row.statusRaw, row.completedAt, cur[0].status).status;
        const technician = row.technician || cur[0].technician;
        const workDone = row.workDone || cur[0].work_done;
        const completedAt = row.completedAt || cur[0].completed_at;
        const customer = chosen || cur[0].customer;
        const done = CLOSED_PM.has(status);
        await sql.query(
          `update pm_jobs set
              technician = $2, completed_at = $3, work_done = $4, status = $5,
              wo = $6, done = $7, customer = $8, updated_at = now()
            where id = $1`,
          [jobId, technician, completedAt, workDone, status, keptWo, done, customer],
        );
        await logCorrigo(sql, "pm", jobId, actor, `Corrigo import · ${keptWo}`);
        updated += 1;
        maybeReview("pm", jobId, keptWo, customer, status, technician, done);
        continue;
      }

      if (board === "install") {
        const cur = await sql.query<{
          id: number;
          equip_status: string | null;
          technician: string | null;
          work_done: string | null;
          completed_at: string | null;
          customer: string;
          wo: string | null;
          complete: boolean;
        }>(
          `select id, equip_status, technician, work_done, completed_at, customer, wo, complete
             from installs where id = $1 and archived = false`,
          [jobId],
        );
        if (!cur[0]) continue;
        const keptWo = storedWo(cur[0].wo, wo);
        const current = cur[0].complete ? "Installed" : cur[0].equip_status || "Not Ready";
        const equipStatus = boardStatus("install", row.statusRaw, row.completedAt, current).status;
        const technician = row.technician || cur[0].technician;
        const workDone = row.workDone || cur[0].work_done;
        const completedAt = row.completedAt || cur[0].completed_at;
        const customer = chosen || cur[0].customer;
        const complete = equipStatus === "Installed";
        await sql.query(
          `update installs set
              technician = $2, completed_at = $3, work_done = $4, equip_status = $5,
              wo = $6, complete = $7, customer = $8, updated_at = now()
            where id = $1`,
          [jobId, technician, completedAt, workDone, equipStatus, keptWo, complete, customer],
        );
        await logCorrigo(sql, "install", jobId, actor, `Corrigo import · ${keptWo}`);
        updated += 1;
        maybeReview(
          "install",
          jobId,
          keptWo,
          customer,
          equipStatus,
          technician,
          complete,
        );
        continue;
      }

      const cur = await sql.query<{
        id: number;
        kind: string;
        status: string;
        technician: string | null;
        work_done: string | null;
        completed_at: string | null;
        customer: string | null;
        wo: string | null;
      }>(
        `select id, kind, status, technician, work_done, completed_at, customer, wo
           from service_jobs where id = $1`,
        [jobId],
      );
      if (!cur[0]) continue;
      const keptWo = storedWo(cur[0].wo, wo);
      const status = boardStatus(jobBoard(cur[0].kind), row.statusRaw, row.completedAt, cur[0].status).status;
      const technician = row.technician || cur[0].technician;
      const workDone = row.workDone || cur[0].work_done;
      const completedAt = row.completedAt || cur[0].completed_at;
      const customer = chosen || cur[0].customer;
      const done = CLOSED_CALL.has(status);
      const jobBoardKind = jobBoard(cur[0].kind);
      await sql.query(
        `update service_jobs set
            technician = $2, completed_at = $3, work_done = $4, status = $5,
            wo = $6, done = $7, customer = $8, updated_at = now()
          where id = $1`,
        [jobId, technician, completedAt, workDone, status, keptWo, done, customer],
      );
      await logCorrigo(
        sql,
        jobBoardKind,
        jobId,
        actor,
        status !== cur[0].status ? `${cur[0].status} → ${status} · ${keptWo}` : `Corrigo import · ${keptWo}`,
      );
      for (const extra of row.conflictIds ?? []) {
        if (wrapRepeat) break;
        if ((extra.board === "service" || extra.board === "tlc") && extra.id !== jobId) {
          const outcome = await tryMergeServiceDuplicate(sql, jobId, extra.id, actor);
          if (typeof outcome === "object" && outcome.result === "held") {
            rememberHold(outcome.keeperId, outcome.extraId, outcome.reason, extra.id);
          }
        }
      }
      updated += 1;
      maybeReview(jobBoardKind, jobId, keptWo, customer, status, technician, done);
    } else if (action === "create") {
      const received = row.completedAt || todayChicago();
      const customer = chosen;

      if (board === "pm") {
        const status = boardStatus("pm", row.statusRaw, row.completedAt, null).status;
        const done = CLOSED_PM.has(status);
        const inserted = await sql.query<{ id: number }>(
          `insert into pm_jobs (customer, received, status, technician, wo, work_done, completed_at, style, done)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           returning id`,
          [
            customer || "Unknown",
            received,
            status,
            row.technician,
            wo,
            row.workDone,
            row.completedAt,
            DEFAULT_PM_STYLE,
            done,
          ],
        );
        const id = inserted[0]?.id;
        if (id) {
          await logCorrigo(sql, "pm", id, actor, `Opened from Corrigo · ${wo}`);
          created += 1;
          maybeReview("pm", id, wo, customer, status, row.technician, done);
        }
        continue;
      }

      if (board === "install") {
        const equipStatus = boardStatus("install", row.statusRaw, row.completedAt, null).status;
        const complete = equipStatus === "Installed";
        const inserted = await sql.query<{ id: number }>(
          `insert into installs (received, customer, technician, wo, work_done, completed_at, equip_status, complete)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning id`,
          [
            received,
            customer || "Unknown",
            row.technician,
            wo,
            row.workDone,
            row.completedAt,
            equipStatus,
            complete,
          ],
        );
        const id = inserted[0]?.id;
        if (id) {
          await logCorrigo(sql, "install", id, actor, `Opened from Corrigo · ${wo}`);
          created += 1;
          maybeReview("install", id, wo, customer, equipStatus, row.technician, complete);
        }
        continue;
      }

      const kind = board === "tlc" ? "tlc" : "service";
      const status = boardStatus(board, row.statusRaw, row.completedAt, null).status;
      const done = CLOSED_CALL.has(status);
      const callId = await nextCallId(sql, received);
      const inserted = await sql.query<{ id: number }>(
        `insert into service_jobs
           (kind, call_id, customer, issue, technician, status, wo, work_done, completed_at, received, call_type, urgency, done)
         values
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Normal', $12)
         returning id`,
        [
          kind,
          callId,
          customer,
          row.issue,
          row.technician,
          status,
          wo,
          row.workDone,
          row.completedAt,
          received,
          board === "tlc" ? "Field Service" : "Field Service",
          done,
        ],
      );
      const id = inserted[0]?.id;
      if (id) {
        await logCorrigo(sql, board, id, actor, `Opened from Corrigo · ${wo}`);
        created += 1;
        maybeReview(board, id, wo, customer, status, row.technician, done);
      }
    }
  }

  const reconciled = await reconcileServiceDuplicates(
    sql,
    actor,
    [...heldPairs.values()].map((held) => ({ keeperId: held.keeperId, extraId: held.extraId })),
  );
  for (const held of reconciled.held) rememberHold(held.keeperId, held.extraId, held.reason, held.extraId);
  if (heldPairs.size) {
    const ids = [...new Set([...heldPairs.values()].flatMap((held) => [held.keeperId, held.extraId, held.perRowExtra]))];
    const extras = await sql.query<{
      id: number;
      kind: string;
      wo: string | null;
      customer: string | null;
      status: string;
      technician: string | null;
      duplicate_of: number | null;
    }>("select id, kind, wo, customer, status, technician, duplicate_of from service_jobs where id = any($1::int[])", [ids]);
    return {
      updated,
      created,
      review: attachHeldReview(review, [...heldPairs.values()], extras),
    };
  }
  return { updated, created, review };
}

export const applyCorrigoImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof applyInput>) => applyInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const actorRows = await sql.query<{ username: string }>(
      "select username from desk_accounts where user_id = $1",
      [context.userId],
    );
    return applyCorrigoRows(sql, data.rows, actorRows[0]?.username || "Teammate");
  });
