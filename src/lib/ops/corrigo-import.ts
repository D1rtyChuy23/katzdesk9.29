import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as XLSX from "xlsx";
import { getSql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { CLOSED_CALL, CLOSED_PM } from "@/lib/ops/lookups";
import { todayChicago } from "@/lib/ops/clock";
import {
  deskHasWrapped,
  indexHits,
  isWalkIn,
  parseCorrigoMatrix,
  pickKeeper,
  resolvePreviewRow,
  shouldAttachToHit,
  woMatchKey,
  type CorrigoBoard,
  type CorrigoHit,
  type CorrigoPreviewRow,
} from "@/lib/ops/corrigo";
import { reconcileServiceDuplicates, tryMergeServiceDuplicate } from "@/lib/ops/wo-duplicates";

export type CorrigoPreview = {
  updateCount: number;
  createCount: number;
  skipped: number;
  conflictCount: number;
  wrapCount: number;
  unmapped: string[];
  rows: CorrigoPreviewRow[];
};

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
    reason?: "open" | "wrap";
  }[];
};

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

function stringifyCell(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v)) return String(v);
    const rounded = Math.round(v);
    if (Math.abs(v - rounded) < 1e-6) return String(rounded);
  }
  const s = String(v);
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
  return s;
}

function fileToMatrix(base64: string): string[][] {
  const wb = XLSX.read(base64, { type: "base64", cellDates: true, raw: false });
  const name = wb.SheetNames[0];
  if (!name) throw new Error("The file has no sheets.");
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error("The file has no sheets.");
  const matrix = XLSX.utils.sheet_to_json<(unknown[] | null)[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  return matrix.map((row) => (row ?? []).map(stringifyCell));
}

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
      status: r.status || "Not Ready",
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

function pmStatus(translated: string, current: string | null): string {
  if (translated === "Completed" || translated === "Cancelled" || translated === "In Progress") {
    return translated;
  }
  if (translated === "Dispatched") return "Ready to Dispatch";
  if (translated === "Open") return current || "Pending Scheduling";
  if (translated === "Follow-up Needed") return current || "In Progress";
  return current || "Pending Scheduling";
}

function installStatus(translated: string, current: string | null): string {
  if (translated === "Completed") return "Installed";
  return current || "Not Ready";
}

const fileInput = z.object({
  filename: z.string(),
  base64: z.string().min(8),
});

export const previewCorrigoImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof fileInput>) => fileInput.parse(d))
  .handler(async ({ data }): Promise<CorrigoPreview> => {
    if (data.base64.length > 12_000_000) throw new Error("That file is too large.");
    const matrix = fileToMatrix(data.base64);
    const parsed = parseCorrigoMatrix(matrix);
    const sql = await ready();
    const hits = await loadHits(sql);
    const wrapped = deskHasWrapped(hits);
    const index = indexHits(hits);
    const rows = parsed.records.map((rec) =>
      resolvePreviewRow(rec, index.get(rec.matchKey) ?? { unique: null, conflicts: [] }, { wrapped }),
    );
    const unmapped = [
      ...new Set(rows.map((r) => r.statusUnmapped).filter((s): s is string => !!s)),
    ];
    return {
      updateCount: rows.filter((r) => r.action === "update").length,
      createCount: rows.filter((r) => r.action === "create").length,
      skipped: parsed.skipped + rows.filter((r) => r.action === "skip").length,
      conflictCount: rows.filter((r) => !!r.conflictIds?.length).length,
      wrapCount: rows.filter((r) => r.wrapRepeat).length,
      unmapped,
      rows,
    };
  });

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
  rows: z.array(applyRow),
});

export const applyCorrigoImport = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof applyInput>) => applyInput.parse(d))
  .handler(async ({ data, context }): Promise<CorrigoApplyResult> => {
    const sql = await ready();
    const actorRows = await sql.query<{ username: string }>(
      "select username from desk_accounts where user_id = $1",
      [context.userId],
    );
    const actor = actorRows[0]?.username || "Teammate";
    let updated = 0;
    let created = 0;
    const review: CorrigoApplyResult["review"] = [];

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

    for (const row of data.rows) {
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
      const chosen = (row.customer ?? "").trim() || null;
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
          }>(
            `select id, status, technician, work_done, completed_at, customer from pm_jobs where id = $1`,
            [jobId],
          );
          if (!cur[0]) continue;
          const translated = row.statusUnmapped ? cur[0].status : row.newStatus;
          const status = pmStatus(translated, cur[0].status);
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
            [jobId, technician, completedAt, workDone, status, wo, done, customer],
          );
          await logCorrigo(sql, "pm", jobId, actor, `Corrigo import · ${wo}`);
          updated += 1;
          maybeReview("pm", jobId, wo, customer, status, technician, done);
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
          }>(
            `select id, equip_status, technician, work_done, completed_at, customer
               from installs where id = $1 and archived = false`,
            [jobId],
          );
          if (!cur[0]) continue;
          const translated = row.statusUnmapped ? cur[0].equip_status || "Not Ready" : row.newStatus;
          const equipStatus = installStatus(translated, cur[0].equip_status);
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
            [jobId, technician, completedAt, workDone, equipStatus, wo, complete, customer],
          );
          await logCorrigo(sql, "install", jobId, actor, `Corrigo import · ${wo}`);
          updated += 1;
          maybeReview(
            "install",
            jobId,
            wo,
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
        }>(
          `select id, kind, status, technician, work_done, completed_at, customer
             from service_jobs where id = $1`,
          [jobId],
        );
        if (!cur[0]) continue;
        const status = row.statusUnmapped ? cur[0].status : row.newStatus;
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
          [jobId, technician, completedAt, workDone, status, wo, done, customer],
        );
        await logCorrigo(
          sql,
          jobBoardKind,
          jobId,
          actor,
          status !== cur[0].status ? `${cur[0].status} → ${status} · ${wo}` : `Corrigo import · ${wo}`,
        );
        for (const extra of row.conflictIds ?? []) {
          if (wrapRepeat) break;
          if ((extra.board === "service" || extra.board === "tlc") && extra.id !== jobId) {
            await tryMergeServiceDuplicate(sql, jobId, extra.id, actor);
          }
        }
        updated += 1;
        maybeReview(jobBoardKind, jobId, wo, customer, status, technician, done);
      } else if (action === "create") {
        const received = row.completedAt || todayChicago();
        const translated = row.statusUnmapped ? "Open" : row.newStatus || "Open";
        const customer = chosen;

        if (board === "pm") {
          const status = pmStatus(translated, null);
          const done = CLOSED_PM.has(status);
          const inserted = await sql.query<{ id: number }>(
            `insert into pm_jobs (customer, received, status, technician, wo, work_done, completed_at, style, done)
             values ($1, $2, $3, $4, $5, $6, $7, '12 month PM', $8)
             returning id`,
            [
              customer || "Unknown",
              received,
              status,
              row.technician,
              wo,
              row.workDone,
              row.completedAt,
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
          const equipStatus = installStatus(translated, null);
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
        const status = translated;
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

    await reconcileServiceDuplicates(sql, actor);
    return { updated, created, review };
  });
