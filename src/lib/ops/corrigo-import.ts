import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { CLOSED_CALL, CLOSED_PM } from "@/lib/ops/lookups";
import { DEFAULT_PM_STYLE } from "@/lib/ops/pm-runbook";
import { todayChicago } from "@/lib/ops/clock";
import {
  attachableHits,
  boardStatus,
  completedOnUpdate,
  corrigoReopens,
  corrigoReviewReason,
  crossCyclePairs,
  deskHasWrapped,
  exactMachines,
  indexHits,
  isWalkIn,
  pickKeeper,
  preferFileCustomerInstalls,
  installStatusFromCorrigo,
  resolvePreviewRow,
  settleInstallRows,
  withSiblingWos,
  woMatchKey,
  type CorrigoBoard,
  type CorrigoHit,
  type CorrigoPreviewPart,
  type CorrigoRecord,
  type OpenInstall,
} from "@/lib/ops/corrigo";
import { installMachines, parseMachinesJson } from "@/lib/ops/machines";
import { INSTALL_WOS_SQL, loadInstallWos, recordInstallWo } from "@/lib/ops/install-work-orders";
import { customersStrictlyMatch } from "@/lib/ops/clean-names";
import { moveInstallUnits } from "@/lib/ops/install-projects";
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
    reason?: "open" | "wrap" | "merge" | "created";
    note?: string;
    /** The import made this ticket. */
    created?: boolean;
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

/**
 * The received date, else the Chicago day of the ticket's first activity entry (the tables keep no created date),
 * else its completed date.
 */
function receivedDateSql(table: string, entityType: string): string {
  return `coalesce(${table}.received,
            (select (min(a.created_at) at time zone 'America/Chicago')::date from activity a
              where a.entity_type = ${entityType} and a.entity_id = ${table}.id),
            ${table}.completed_at)`;
}

function receivedSql(table: string, entityType: string): string {
  return `to_char(${receivedDateSql(table, entityType)}, 'YYYY-MM-DD') as received`;
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
    completed_at: string | null;
    ns_so: string | null;
    has_charges: boolean;
    received: string | null;
  }>(
    `select id, wo, status, customer, kind, duplicate_of, done,
            to_char(completed_at, 'YYYY-MM-DD') as completed_at, ns_so,
            exists (select 1 from ticket_charges c where c.job_id = service_jobs.id) as has_charges,
            ${receivedSql("service_jobs", "service_jobs.kind")}
       from service_jobs
      where coalesce(wo, '') <> ''
      order by id asc`,
  );
  const pms = await sql.query<{
    id: number;
    wo: string | null;
    status: string;
    customer: string | null;
    done: boolean;
    completed_at: string | null;
    received: string | null;
  }>(
    `select id, wo, status, customer, done, to_char(completed_at, 'YYYY-MM-DD') as completed_at,
            ${receivedSql("pm_jobs", "'pm'")}
       from pm_jobs
      where coalesce(wo, '') <> ''
      order by id asc`,
  );
  const installs = await sql.query<{
    id: number;
    wo: string | null;
    status: string | null;
    customer: string;
    complete: boolean;
    completed_at: string | null;
    received: string | null;
  }>(
    // One hit per work order: an install project is found by any of its WOs. Each WO is dated by its own row (the
    // day it came onto the install), else by the install, so after the wrap an old project's WO isn't this cycle's.
    `select i.id, w.wo, i.equip_status as status, i.customer, i.complete, to_char(i.completed_at, 'YYYY-MM-DD') as completed_at,
            to_char(coalesce(
              (select x.received from install_work_orders x where x.install_id = i.id and x.wo = w.wo limit 1),
              ${receivedDateSql("i", "'install'")}), 'YYYY-MM-DD') as received
       from installs i join ${INSTALL_WOS_SQL} w on w.install_id = i.id
      where i.archived = false
      order by i.id asc`,
  );
  const installWos = await loadInstallWos(sql, installs.map((r) => r.id));
  return [
    ...jobs.map((r) => ({
      board: jobBoard(r.kind),
      id: r.id,
      status: r.status,
      customer: r.customer,
      wo: r.wo,
      duplicateOf: r.duplicate_of ?? null,
      done: !!r.done,
      completedAt: r.completed_at,
      billedSo: r.ns_so,
      hasCharges: !!r.has_charges,
      received: r.received,
    })),
    ...pms.map((r) => ({
      board: "pm" as const,
      id: r.id,
      status: r.status,
      customer: r.customer,
      wo: r.wo,
      done: !!r.done,
      completedAt: r.completed_at,
      received: r.received,
    })),
    ...installs.map((r) => ({
      board: "install" as const,
      id: r.id,
      status: r.complete ? "Installed" : r.status || "Not Ready",
      customer: r.customer,
      wo: r.wo,
      done: !!r.complete,
      completedAt: r.completed_at,
      received: r.received,
      wos: installWos.get(r.id) ?? [],
    })),
  ];
}

/**
 * Open installs (not archived, not complete; WOs or not), each with its machine models and work orders, and the
 * equipment catalog they are read with.
 */
async function loadOpenInstalls(sql: Sql): Promise<{ installs: OpenInstall[]; catalog: string[] }> {
  const catalog = (
    await sql.query<{ name: string }>("select name from directory_equipment where archived = false and coalesce(name, '') <> ''")
  ).map((r) => r.name);
  const rows = await sql.query<{
    id: number;
    customer: string;
    equip_status: string | null;
    completed_at: string | null;
    equipment: string | null;
    serial: string | null;
    power_voltage: string | null;
    machines: string | null;
  }>(
    `select id, customer, equip_status, to_char(completed_at, 'YYYY-MM-DD') as completed_at, equipment, serial, power_voltage, machines
       from installs
      where archived = false and complete = false
      order by id`,
  );
  const wos = await loadInstallWos(sql, rows.map((r) => r.id));
  const installs = rows.map((r): OpenInstall => {
    // The saved rows as saved: a row that is only a serial stays a row here (the install window folds it into the row
    // above), so an unknown unit is never guessed into a match.
    const saved = parseMachinesJson(r.machines);
    const { machines, typed } = saved.length ? { machines: saved, typed: false } : installMachines(r, catalog);
    // Each saved machine row names its machine on its own; a row that reads as nothing is an unknown unit.
    const each = machines.map((m) => exactMachines([m.equipment], catalog));
    const exact = typed ? exactMachines([r.equipment ?? ""], catalog) : each.every(Boolean) ? (each as string[][]).flat() : null;
    return {
      board: "install",
      id: r.id,
      status: r.equip_status || "Not Ready",
      customer: r.customer,
      wo: null,
      completedAt: r.completed_at,
      // Read exactly, so "2 x Bunn TB3" counts two and a loose or guessed name ("Cameo", "TB3 / ITCB") counts none.
      machines: exact ?? [],
      summary: machines.map((m) => m.equipment.trim()).filter(Boolean).join(", "),
      wos: wos.get(r.id) ?? [],
    };
  });
  return { installs, catalog };
}

async function findExistingHit(
  sql: Awaited<ReturnType<typeof getSql>>,
  matchKey: string,
  preferredBoard?: CorrigoBoard | null,
  fileCustomer?: string | null,
  wrapped?: boolean,
  today?: string,
  row?: { statusRaw: string | null; completedAt: string | null } | null,
): Promise<CorrigoHit | null> {
  if (!matchKey) return null;
  const hits = await loadHits(sql);
  const rolled = wrapped ?? deskHasWrapped(hits);
  const match = indexHits(hits).get(matchKey) ?? { unique: null, conflicts: [] };
  const group = [
    ...(match.unique ? [match.unique] : []),
    ...match.conflicts,
  ].filter((h, i, all) => all.findIndex((x) => x.board === h.board && x.id === h.id) === i);
  return pickKeeper(preferFileCustomerInstalls(attachableHits(group, fileCustomer, rolled, today, row), fileCustomer), preferredBoard);
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

function completedLog(date: ReturnType<typeof completedOnUpdate>, desk: string | null, file: string | null): string {
  if (date.change === "moved") return ` · completed ${desk} → ${file}`;
  if (date.change === "set") return ` · completed ${file}`;
  if (date.change === "cleared") return ` · completed ${desk} → (cleared, reopened)`;
  if (date.change === "billed") {
    return ` · completed kept ${desk || "no date"} (billed; ${file ? `Corrigo says ${file}` : "Corrigo reopened it"})`;
  }
  return "";
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
  completedRaw: z.string().nullable(),
  workDone: z.string().nullable(),
  statusRaw: z.string().nullable(),
  issue: z.string().nullable(),
  customer: z.string().nullable(),
  po: z.string().nullable(),
  callType: z.string().nullable(),
  equipment: z.string().nullable().optional(),
});

/**
 * The browser reads the file and sends only these fields, a chunk at a time (Vercel refuses a request over ~4.5 MB).
 * It settles the install rows over the whole file again (settleInstallRows), so a later chunk's row sees what an
 * earlier chunk's row puts on an install.
 */
const previewInput = z.object({
  records: z.array(recordInput).max(2000),
});

export async function previewCorrigoRecords(sql: Sql, records: CorrigoRecord[]): Promise<CorrigoPreviewPart> {
  const hits = await loadHits(sql);
  const wrapped = deskHasWrapped(hits);
  const today = todayChicago();
  const index = indexHits(hits);
  const { installs, catalog } = await loadOpenInstalls(sql);
  // Rows are applied in order: a second row for one install adds its WO to the first row's.
  const rows = settleInstallRows(
    records.map((rec) =>
      resolvePreviewRow(rec, index.get(rec.matchKey) ?? { unique: null, conflicts: [] }, { wrapped, today, installs, catalog }),
    ),
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
  completedRaw: z.string().nullable().optional(),
  workDone: z.string().nullable(),
  issue: z.string().nullable(),
  wrapRepeat: z.boolean().optional(),
  shared: z.string().nullable().optional(),
  byEquipment: z.boolean().optional(),
  byAccount: z.boolean().optional(),
  installNewFrom: z.string().regex(/^\d+$/).nullable().optional(),
  installSiblings: z
    .array(z.object({ wo: z.string(), status: z.string().nullable(), completedAt: z.string().nullable() }))
    .max(200)
    .nullable()
    .optional(),
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
  const today = todayChicago();
  let wrapRepeat = false;
  let shared: string | null = null;

  function maybeReview(
    board: CorrigoBoard,
    id: number,
    wo: string,
    customer: string | null,
    status: string,
    technician: string | null,
    closed: boolean,
    created = false,
  ) {
    const reason = corrigoReviewReason({ created, closed, wrapRepeat });
    if (!reason) return;
    const note = reason === "wrap" && shared ? { note: shared } : {};
    const cur = review.find((r) => r.entityType === board && r.id === id);
    if (cur) {
      if (reason === "wrap") Object.assign(cur, { reason, ...note });
      return;
    }
    review.push({ id, wo, customer, status, technician, entityType: board, reason, created, ...note });
  }

  for (const row of rows) {
    if (row.action === "skip") continue;
    const wo = row.canonicalWo || row.wo;
    let board = (row.board ?? "service") as CorrigoBoard;
    const matchKey = row.matchKey || woMatchKey(wo);
    let action = row.action;
    let jobId = row.jobId;
    wrapRepeat = !!row.wrapRepeat;
    shared = row.shared ?? null;
    // The row goes on an open install picked for the account (by equipment or not), not on one with its WO.
    const picked = !!(row.byAccount || row.byEquipment);
    if (action === "update" && !jobId && board === "install" && row.installNewFrom) {
      // The new install an earlier row of this import opened (this chunk or an earlier one): the one with its WO.
      const opened = await sql.query<{ id: number }>(
        `select w.install_id as id from install_work_orders w join installs i on i.id = w.install_id
          where i.archived = false and w.match_key = $1 order by w.install_id desc limit 1`,
        [row.installNewFrom],
      );
      if (opened[0]) jobId = opened[0].id;
      else action = "create";
    }
    if (action === "update" && jobId && board === "install") {
      // A picked install archived, completed or moved to another account since the preview, or a WO taken off its
      // install since: open a new one (or find the WO's install), as a fresh preview would. Another WO added to the
      // picked install since is fine: an install project carries several.
      const now = (
        await sql.query<{ customer: string; archived: boolean; complete: boolean }>("select customer, archived, complete from installs where id = $1", [
          jobId,
        ])
      )[0];
      const sameAccount = (name: string) =>
        customersStrictlyMatch(name, row.fileCustomer ?? row.customer) ||
        (!!row.existingCustomer && name.trim().toLowerCase() === row.existingCustomer.trim().toLowerCase());
      // A project an earlier row of this file installed (the preview showed it Installed) is still the one.
      const gone = picked
        ? !now || now.archived || (now.complete && row.oldStatus !== "Installed") || !sameAccount(now.customer)
        : !((await loadInstallWos(sql, [jobId])).get(jobId) ?? []).some((w) => w.matchKey === matchKey);
      if (gone) {
        action = "create";
        jobId = null;
      }
    }
    if (action === "create" || (action === "update" && !jobId)) {
      const hit = await findExistingHit(sql, matchKey, board, row.customer, wrapped, today, row);
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
          `select id, status, technician, work_done, to_char(completed_at, 'YYYY-MM-DD') as completed_at, customer, wo
             from pm_jobs where id = $1`,
          [jobId],
        );
        if (!cur[0]) continue;
        const keptWo = storedWo(cur[0].wo, wo);
        const status = boardStatus("pm", row.statusRaw, row.completedAt, cur[0].status).status;
        const technician = row.technician || cur[0].technician;
        const workDone = row.workDone || cur[0].work_done;
        const reopened = corrigoReopens("pm", row.statusRaw, row.completedAt, cur[0].status, row.completedRaw);
        const date = completedOnUpdate(row.completedAt, cur[0].completed_at, null, reopened);
        const completedAt = date.value;
        const customer = chosen || cur[0].customer;
        const done = CLOSED_PM.has(status);
        await sql.query(
          `update pm_jobs set
              technician = $2, completed_at = $3, work_done = $4, status = $5,
              wo = $6, done = $7, customer = $8, updated_at = now()
            where id = $1`,
          [jobId, technician, completedAt, workDone, status, keptWo, done, customer],
        );
        await logCorrigo(sql, "pm", jobId, actor, `Corrigo import · ${keptWo}${completedLog(date, cur[0].completed_at, row.completedAt)}`);
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
          customer_locked_at: unknown;
        }>(
          `select id, equip_status, technician, work_done, to_char(completed_at, 'YYYY-MM-DD') as completed_at, customer, wo, complete,
                  customer_locked_at
             from installs where id = $1 and archived = false`,
          [jobId],
        );
        if (!cur[0]) continue;
        const wos = (await loadInstallWos(sql, [jobId])).get(jobId) ?? [];
        const keptWo = wos.find((w) => w.matchKey === matchKey)?.wo ?? storedWo(cur[0].wo, wo);
        const current = cur[0].complete ? "Installed" : cur[0].equip_status || "Not Ready";
        // The same steps as the preview (settleInstallRows): with two or more WOs, the last one completed installs it.
        const next = installStatusFromCorrigo(
          { status: current, completedAt: cur[0].completed_at, wos: withSiblingWos(wos, row.installSiblings, matchKey) },
          { matchKey, canonicalWo: keptWo, statusRaw: row.statusRaw, completedAt: row.completedAt },
        );
        const equipStatus = next.status;
        const technician = row.technician || cur[0].technician;
        const workDone = row.workDone || cur[0].work_done;
        const date = next.date;
        const completedAt = next.completedAt;
        // A customer the owner locked stays as it is.
        const customer = cur[0].customer_locked_at ? cur[0].customer : chosen || cur[0].customer;
        const complete = equipStatus === "Installed";
        // installs.wo stays the project's first WO.
        const primary = cur[0].wo?.trim() || keptWo;
        await sql.query(
          `update installs set
              technician = $2, completed_at = $3, work_done = $4, equip_status = $5,
              wo = $6, complete = $7, customer = $8, updated_at = now()
            where id = $1`,
          [jobId, technician, completedAt, workDone, equipStatus, primary, complete, customer],
        );
        await recordInstallWo(sql, jobId, { wo: keptWo, status: row.statusRaw, completedAt: row.completedAt, source: "corrigo", addedBy: actor });
        // A new customer takes the install's own account units with it, as the install window does.
        const unitsMoved = customer !== cur[0].customer ? await moveInstallUnits(sql, jobId, cur[0].customer, customer) : null;
        const added = !wos.some((w) => w.matchKey === matchKey);
        await logCorrigo(
          sql,
          "install",
          jobId,
          actor,
          `Corrigo import · ${keptWo}${completedLog(date, cur[0].completed_at, row.completedAt)}` +
            (row.byEquipment ? " · matched by account and equipment" : picked ? " · picked by account" : "") +
            (next.wos.length > 1 ? ` · ${next.done} of ${next.wos.length} work orders completed` : "") +
            (unitsMoved?.moved.length ? ` · moved to ${customer}: ${unitsMoved.moved.join(", ")}` : ""),
        );
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
        if (picked) {
          // For Review names the install the row went on, and its other work orders.
          const item = review.find((r) => r.entityType === "install" && r.id === jobId);
          const others = next.wos.filter((w) => woMatchKey(w.wo) !== matchKey).map((w) => w.wo);
          const note = `${keptWo} ${added ? "added to" : "on"} install #${jobId}${others.length ? ` with ${others.join(", ")}` : ""}`;
          if (item && !item.note) item.note = note;
        }
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
        ns_so: string | null;
      }>(
        `select id, kind, status, technician, work_done, to_char(completed_at, 'YYYY-MM-DD') as completed_at, customer, wo, ns_so
           from service_jobs where id = $1`,
        [jobId],
      );
      if (!cur[0]) continue;
      const keptWo = storedWo(cur[0].wo, wo);
      const status = boardStatus(jobBoard(cur[0].kind), row.statusRaw, row.completedAt, cur[0].status).status;
      const technician = row.technician || cur[0].technician;
      const workDone = row.workDone || cur[0].work_done;
      const reopened = corrigoReopens(jobBoard(cur[0].kind), row.statusRaw, row.completedAt, cur[0].status, row.completedRaw);
      const date = completedOnUpdate(row.completedAt, cur[0].completed_at, cur[0].ns_so, reopened);
      const completedAt = date.value;
      const customer = chosen || cur[0].customer;
      const done = CLOSED_CALL.has(status);
      const jobBoardKind = jobBoard(cur[0].kind);
      await sql.query(
        `update service_jobs set
            technician = $2,
            -- An SO saved since the read above keeps its billing date.
            completed_at = case when nullif(btrim(ns_so), '') is null then $3::date else completed_at end,
            work_done = $4, status = $5,
            wo = $6, done = $7, customer = $8, updated_at = now()
          where id = $1`,
        [jobId, technician, completedAt, workDone, status, keptWo, done, customer],
      );
      await logCorrigo(
        sql,
        jobBoardKind,
        jobId,
        actor,
        (status !== cur[0].status ? `${cur[0].status} → ${status} · ${keptWo}` : `Corrigo import · ${keptWo}`) +
          completedLog(date, cur[0].completed_at, row.completedAt),
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
          maybeReview("pm", id, wo, customer, status, row.technician, done, true);
        }
        continue;
      }

      if (board === "install") {
        // A new install later rows of this file go on: its status counts their WOs too, as the preview did.
        const later = row.installSiblings?.length
          ? installStatusFromCorrigo(
              { status: "Not Ready", completedAt: null, wos: withSiblingWos([], row.installSiblings, matchKey) },
              { matchKey, canonicalWo: wo, statusRaw: row.statusRaw, completedAt: row.completedAt },
            )
          : null;
        const equipStatus = later?.status ?? boardStatus("install", row.statusRaw, row.completedAt, null).status;
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
            later ? later.completedAt : row.completedAt,
            equipStatus,
            complete,
          ],
        );
        const id = inserted[0]?.id;
        if (id) {
          await recordInstallWo(sql, id, { wo, status: row.statusRaw, completedAt: row.completedAt, received, source: "corrigo", addedBy: actor });
          await logCorrigo(sql, "install", id, actor, `Opened from Corrigo · ${wo}`);
          created += 1;
          maybeReview("install", id, wo, customer, equipStatus, row.technician, complete, true);
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
        maybeReview(board, id, wo, customer, status, row.technician, done, true);
      }
    }
  }

  // After the wrap, the same number on tickets from two cycles is two jobs: the merge leaves those pairs alone.
  const otherCycle = wrapped ? crossCyclePairs(await loadHits(sql), today) : [];
  const reconciled = await reconcileServiceDuplicates(sql, actor, [
    ...[...heldPairs.values()].map((held) => ({ keeperId: held.keeperId, extraId: held.extraId })),
    ...otherCycle,
  ]);
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
