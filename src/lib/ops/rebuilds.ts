import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { serialKey } from "@/lib/ops/serial-pull";
import { loadTechs } from "@/lib/ops/roster";
import { loadAccountMarks, isAviKatz, customerKey, loadReps } from "@/lib/ops/reps";
import {
  CLOSED_REBUILD,
  HEALTH_RANK,
  REBUILD_PRIORITIES,
  REBUILD_STATUSES,
  SHOP_ACCOUNT,
  WAITING_REASONS,
  computeRebuildMetrics,
  isRebuildPriority,
  isRebuildStatus,
  isWaitingReason,
  validateRebuild,
  type RebuildHealth,
  type RebuildMetrics,
  type RebuildPriority,
  type RebuildStatus,
  type WaitingReason,
} from "@/lib/ops/rebuild-model";
import { isoDayOrNull as isoDay } from "@/lib/ops/iso";

export {
  REBUILD_STATUSES,
  WAITING_REASONS,
  REBUILD_PRIORITIES,
  SHOP_ACCOUNT,
  HEALTH_LABEL,
  HEALTH_RANK,
  computeRebuildMetrics,
  validateRebuild,
  priorityLabel,
} from "@/lib/ops/rebuild-model";

export type { RebuildHealth, RebuildMetrics, RebuildPriority, RebuildStatus, WaitingReason };

export type Rebuild = {
  id: number;
  title: string;
  account: string;
  equipment: string | null;
  serial: string | null;
  assetId: number | null;
  owner: string | null;
  status: RebuildStatus;
  reasonCode: string | null;
  reasonDetail: string | null;
  plannedStart: string | null;
  targetComplete: string | null;
  actualStart: string | null;
  actualComplete: string | null;
  priority: RebuildPriority;
  notes: string | null;
  installId: number | null;
  jobId: number | null;
  serialNotice: string | null;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  health: RebuildHealth;
  daysOpen: number;
  daysToTarget: number | null;
  daysInStatus: number;
  daysLateEarly: number | null;
  clockFlag: RebuildMetrics["clockFlag"];
  accountRep: string | null;
  aviKatz: boolean;
};

export type RebuildLink = {
  kind: "install" | "service" | "tlc";
  id: number;
  label: string;
  customer: string;
};

type RebuildRow = {
  id: number;
  title: string;
  account: string;
  equipment: string | null;
  serial: string | null;
  asset_id: number | null;
  owner: string | null;
  status: string;
  reason_code: string | null;
  reason_detail: string | null;
  planned_start: string | null;
  target_complete: string | null;
  actual_start: string | null;
  actual_complete: string | null;
  priority: string;
  notes: string | null;
  install_id: number | null;
  job_id: number | null;
  serial_notice: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
  archived?: boolean;
};

async function readySql() {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

function stamp(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  return String(v);
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function ensureRebuilds(sql: Sql): Promise<void> {
  await sql.query(`
    create table if not exists rebuilds (
      id serial primary key,
      title text not null,
      account text not null,
      equipment text,
      serial text,
      asset_id int,
      owner text,
      status text not null default 'Queued',
      reason_code text,
      reason_detail text,
      planned_start date,
      target_complete date,
      actual_start date,
      actual_complete date,
      priority text not null default 'normal',
      notes text,
      install_id int,
      job_id int,
      serial_notice text,
      status_changed_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
  await sql.query("create index if not exists rebuilds_status_idx on rebuilds (status)");
  await sql.query("create index if not exists rebuilds_owner_idx on rebuilds (owner)");
  await sql.query("create index if not exists rebuilds_account_idx on rebuilds (lower(account))");
  await sql.query("alter table rebuilds add column if not exists archived boolean not null default false");
  await sql.query("create index if not exists rebuilds_archived_idx on rebuilds (archived)");
}

export function mapRebuild(r: RebuildRow, today: string, accountRep: string | null = null, aviKatz = false): Rebuild {
  const status = isRebuildStatus(r.status) ? r.status : "Queued";
  const priority = isRebuildPriority(r.priority) ? r.priority : "normal";
  const metrics = computeRebuildMetrics(
    {
      status,
      owner: r.owner,
      targetComplete: isoDay(r.target_complete),
      actualStart: isoDay(r.actual_start),
      actualComplete: isoDay(r.actual_complete),
      createdAt: stamp(r.created_at),
      statusChangedAt: stamp(r.status_changed_at),
      reasonCode: r.reason_code,
    },
    today,
  );
  return {
    id: Number(r.id),
    title: r.title,
    account: r.account,
    equipment: r.equipment,
    serial: r.serial,
    assetId: num(r.asset_id),
    owner: r.owner,
    status,
    reasonCode: r.reason_code,
    reasonDetail: r.reason_detail,
    plannedStart: isoDay(r.planned_start),
    targetComplete: isoDay(r.target_complete),
    actualStart: isoDay(r.actual_start),
    actualComplete: isoDay(r.actual_complete),
    priority,
    notes: r.notes,
    installId: num(r.install_id),
    jobId: num(r.job_id),
    serialNotice: r.serial_notice,
    statusChangedAt: stamp(r.status_changed_at),
    createdAt: stamp(r.created_at),
    updatedAt: stamp(r.updated_at),
    accountRep,
    aviKatz,
    ...metrics,
  };
}

export async function loadRebuilds(sql: Sql, today = todayChicago()): Promise<Rebuild[]> {
  await ensureRebuilds(sql);
  await seedRebuilds(sql);
  const rows = await sql.query<RebuildRow>(
    "select * from rebuilds where coalesce(archived, false) = false order by id desc",
  );
  const marks = await loadAccountMarks(sql).catch(() => ({ rep: new Map<string, string>(), ak: new Set<string>() }));
  return rows.map((r) =>
    mapRebuild(r, today, marks.rep.get(customerKey(r.account)) ?? null, isAviKatz(marks, r.account)),
  );
}

async function deskUsername(sql: Sql, userId: string): Promise<string> {
  const rows = await sql.query<{ username: string }>(
    "select username from desk_accounts where user_id = $1",
    [userId],
  );
  return rows[0]?.username || "Teammate";
}

async function logActivity(
  sql: Sql,
  userId: string,
  entityId: number,
  action: string,
  detail?: string | null,
) {
  const actor = await deskUsername(sql, userId);
  await sql.query(
    `insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ('rebuild', $1, $2, $3, $4)`,
    [entityId, actor, action, detail ?? null],
  );
}

type AccessLite = { role: "sales" | "service" | null; isAdmin: boolean; username: string };

async function loadAccessLite(sql: Sql, userId: string): Promise<AccessLite> {
  const rows = await sql.query<{ desk_role: string | null; is_admin: boolean; username: string }>(
    "select desk_role, is_admin, username from desk_accounts where user_id = $1",
    [userId],
  );
  const r = rows[0];
  const role = r?.desk_role === "sales" || r?.desk_role === "service" ? r.desk_role : null;
  const isAdmin = !!(r && (r.is_admin === true || String(r.is_admin) === "t" || String(r.is_admin) === "true"));
  return { role, isAdmin, username: r?.username || "Teammate" };
}

function canEditBench(access: AccessLite): boolean {
  if (access.isAdmin) return true;
  return access.role !== "sales";
}

async function requireEditor(sql: Sql, userId: string): Promise<AccessLite> {
  const access = await loadAccessLite(sql, userId);
  if (!canEditBench(access)) {
    throw new Error("Sales can view rebuilds on their accounts. Bench status is service-owned.");
  }
  return access;
}

function emptyToNull(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s || null;
}

const patchSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  account: z.string().optional(),
  equipment: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  status: z.string().optional(),
  reasonCode: z.string().nullable().optional(),
  reasonDetail: z.string().nullable().optional(),
  plannedStart: z.string().nullable().optional(),
  targetComplete: z.string().nullable().optional(),
  actualStart: z.string().nullable().optional(),
  actualComplete: z.string().nullable().optional(),
  priority: z.string().optional(),
  notes: z.string().nullable().optional(),
  installId: z.number().nullable().optional(),
  jobId: z.number().nullable().optional(),
});

export const listRebuilds = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ rows: Rebuild[]; canEdit: boolean }> => {
    const sql = await readySql();
    const access = await loadAccessLite(sql, context.userId);
    return { rows: await loadRebuilds(sql), canEdit: canEditBench(access) };
  });

export const listRebuildOwners = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<string[]> => {
    const sql = await readySql();
    const techs = (await loadTechs(sql)).filter((t) => t.active).map((t) => t.name);
    const reps = (await loadReps(sql)).filter((r) => r.active).map((r) => r.name);
    const users = await sql.query<{ username: string }>(
      "select username from desk_accounts where approved = true and coalesce(username, '') <> '' order by lower(username)",
    );
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...techs, ...reps, ...users.map((u) => u.username)]) {
      const key = n.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(n.trim());
    }
    return out;
  });

export const listRebuildLinks = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { account?: string | null }) => d)
  .handler(async ({ data }): Promise<RebuildLink[]> => {
    const sql = await readySql();
    const account = (data.account ?? "").trim();
    const out: RebuildLink[] = [];
    const inst = account
      ? await sql.query<{ id: number; customer: string; equipment: string | null; wo: string | null }>(
          `select id, customer, equipment, wo from installs
           where archived = false and complete = false
             and ($1 = '' or lower(customer) = lower($1))
           order by id desc limit 40`,
          [account],
        )
      : await sql.query<{ id: number; customer: string; equipment: string | null; wo: string | null }>(
          `select id, customer, equipment, wo from installs
           where archived = false and complete = false
           order by id desc limit 40`,
        );
    for (const r of inst) {
      out.push({
        kind: "install",
        id: Number(r.id),
        customer: r.customer,
        label: `Install · ${r.customer}${r.equipment ? " · " + r.equipment : ""}${r.wo ? " · " + r.wo : ""}`,
      });
    }
    const jobs = account
      ? await sql.query<{ id: number; kind: string; customer: string | null; call_id: string; wo: string | null }>(
          `select id, kind, customer, call_id, wo from service_jobs
           where status not in ('Completed', 'Cancelled', 'Phone Resolved') and done = false
             and ($1 = '' or lower(coalesce(customer,'')) = lower($1))
           order by id desc limit 40`,
          [account],
        )
      : await sql.query<{ id: number; kind: string; customer: string | null; call_id: string; wo: string | null }>(
          `select id, kind, customer, call_id, wo from service_jobs
           where status not in ('Completed', 'Cancelled', 'Phone Resolved') and done = false
           order by id desc limit 40`,
        );
    for (const r of jobs) {
      const kind = r.kind === "tlc" ? "tlc" : "service";
      out.push({
        kind,
        id: Number(r.id),
        customer: r.customer ?? "",
        label: `${kind === "tlc" ? "TLC" : "Service"} · ${r.customer ?? "Untitled"}${r.wo ? " · " + r.wo : " · " + r.call_id}`,
      });
    }
    return out;
  });

const createSchema = z.object({
  title: z.string().min(1),
  account: z.string().min(1),
  equipment: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  status: z.string().optional(),
  reasonCode: z.string().nullable().optional(),
  reasonDetail: z.string().nullable().optional(),
  plannedStart: z.string().nullable().optional(),
  targetComplete: z.string().nullable().optional(),
  actualStart: z.string().nullable().optional(),
  priority: z.string().optional(),
  notes: z.string().nullable().optional(),
  installId: z.number().nullable().optional(),
  jobId: z.number().nullable().optional(),
});

export const createRebuild = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof createSchema>) => createSchema.parse(d))
  .handler(async ({ data, context }): Promise<Rebuild> => {
    const sql = await readySql();
    await requireEditor(sql, context.userId);
    await ensureRebuilds(sql);
    const status = isRebuildStatus(data.status) ? data.status : "Queued";
    const err = validateRebuild({
      title: data.title,
      account: data.account,
      owner: emptyToNull(data.owner),
      status,
      reasonCode: emptyToNull(data.reasonCode),
      reasonDetail: emptyToNull(data.reasonDetail),
      targetComplete: emptyToNull(data.targetComplete),
      prevStatus: "Queued",
    });
    if (err) throw new Error(err);
    const waiting = status === "Waiting";
    const rows = await sql.query<RebuildRow>(
      `insert into rebuilds (
         title, account, equipment, serial, owner, status, reason_code, reason_detail,
         planned_start, target_complete, actual_start, priority, notes, install_id, job_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning *`,
      [
        data.title.trim(),
        data.account.trim() || SHOP_ACCOUNT,
        emptyToNull(data.equipment),
        emptyToNull(data.serial),
        emptyToNull(data.owner),
        status,
        waiting ? emptyToNull(data.reasonCode) : null,
        waiting ? emptyToNull(data.reasonDetail) : null,
        isoDay(data.plannedStart),
        isoDay(data.targetComplete),
        isoDay(data.actualStart) || (status === "In progress" ? todayChicago() : null),
        isRebuildPriority(data.priority) ? data.priority : "normal",
        emptyToNull(data.notes),
        data.installId ?? null,
        data.jobId ?? null,
      ],
    );
    const row = rows[0]!;
    await logActivity(sql, context.userId, Number(row.id), "opened", `${row.title} · ${row.account}`);
    return mapRebuild(row, todayChicago());
  });

function changed(label: string, before: unknown, after: unknown): string | null {
  const a = before == null || before === "" ? "" : String(before);
  const b = after == null || after === "" ? "" : String(after);
  if (a === b) return null;
  if (label === "status") return `${a || "—"} → ${b || "—"}`;
  if (label === "reason") return b ? `reason ${b}` : "cleared reason delayed";
  if (!b) return `cleared ${label}`;
  return `${label}: ${b.slice(0, 80)}`;
}

export const updateRebuild = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof patchSchema>) => patchSchema.parse(d))
  .handler(async ({ data, context }): Promise<Rebuild> => {
    const sql = await readySql();
    await requireEditor(sql, context.userId);
    await ensureRebuilds(sql);
    const cur = (
      await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id])
    )[0];
    if (!cur) throw new Error("Rebuild not found");

    const nextStatus = data.status != null ? data.status : cur.status;
    const nextOwner = data.owner !== undefined ? emptyToNull(data.owner) : cur.owner;
    const nextTarget = data.targetComplete !== undefined ? isoDay(data.targetComplete) : isoDay(cur.target_complete);
    const nextReason = data.reasonCode !== undefined ? emptyToNull(data.reasonCode) : cur.reason_code;
    const nextDetail = data.reasonDetail !== undefined ? emptyToNull(data.reasonDetail) : cur.reason_detail;
    const nextTitle = data.title != null ? data.title.trim() : cur.title;
    const nextAccount = data.account != null ? data.account.trim() : cur.account;

    const err = validateRebuild({
      title: nextTitle,
      account: nextAccount,
      owner: nextOwner,
      status: nextStatus,
      reasonCode: nextReason,
      reasonDetail: nextDetail,
      targetComplete: nextTarget,
      prevStatus: cur.status,
    });
    if (err) throw new Error(err);

    const leavingWaiting = cur.status === "Waiting" && nextStatus !== "Waiting";
    const reasonCode = nextStatus === "Waiting" ? nextReason : leavingWaiting ? null : nextReason;
    const reasonDetail = nextStatus === "Waiting" ? nextDetail : leavingWaiting ? null : nextDetail;

    let actualStart = data.actualStart !== undefined ? isoDay(data.actualStart) : isoDay(cur.actual_start);
    if (!actualStart && nextStatus === "In progress" && cur.status !== "In progress") {
      actualStart = todayChicago();
    }
    let actualComplete = data.actualComplete !== undefined ? isoDay(data.actualComplete) : isoDay(cur.actual_complete);
    if (nextStatus === "Completed" && cur.status !== "Completed" && !actualComplete) {
      actualComplete = todayChicago();
    }
    if (CLOSED_REBUILD.has(nextStatus as RebuildStatus) === false && nextStatus !== "Completed") {
      if (data.actualComplete === null) actualComplete = null;
    }

    const statusChanged = nextStatus !== cur.status;
    const priority = data.priority != null && isRebuildPriority(data.priority) ? data.priority : cur.priority;

    const rows = await sql.query<RebuildRow>(
      `update rebuilds set
         title = $2,
         account = $3,
         equipment = $4,
         serial = $5,
         owner = $6,
         status = $7,
         reason_code = $8,
         reason_detail = $9,
         planned_start = $10,
         target_complete = $11,
         actual_start = $12,
         actual_complete = $13,
         priority = $14,
         notes = $15,
         install_id = $16,
         job_id = $17,
         status_changed_at = case when $18 then now() else status_changed_at end,
         updated_at = now()
       where id = $1
       returning *`,
      [
        data.id,
        nextTitle,
        nextAccount || SHOP_ACCOUNT,
        data.equipment !== undefined ? emptyToNull(data.equipment) : cur.equipment,
        data.serial !== undefined ? emptyToNull(data.serial) : cur.serial,
        nextOwner,
        nextStatus,
        reasonCode,
        reasonDetail,
        data.plannedStart !== undefined ? isoDay(data.plannedStart) : isoDay(cur.planned_start),
        nextTarget,
        actualStart,
        actualComplete,
        priority,
        data.notes !== undefined ? emptyToNull(data.notes) : cur.notes,
        data.installId !== undefined ? data.installId : cur.install_id,
        data.jobId !== undefined ? data.jobId : cur.job_id,
        statusChanged,
      ],
    );
    const row = rows[0]!;
    const parts = [
      changed("status", cur.status, nextStatus),
      leavingWaiting && cur.reason_code ? `kept last reason in history · ${cur.reason_code}` : null,
      changed("reason", cur.reason_code, reasonCode),
      changed("owner", cur.owner, nextOwner),
      changed("target", isoDay(cur.target_complete), nextTarget),
      changed("planned start", isoDay(cur.planned_start), data.plannedStart !== undefined ? isoDay(data.plannedStart) : isoDay(cur.planned_start)),
      changed("actual start", isoDay(cur.actual_start), actualStart),
      changed("actual complete", isoDay(cur.actual_complete), actualComplete),
    ].filter((x): x is string => !!x);
    if (parts.length) {
      const action = statusChanged ? "status" : parts.some((p) => p.startsWith("reason") || p.startsWith("kept")) ? "reason" : "updated";
      await logActivity(sql, context.userId, data.id, action, parts.slice(0, 4).join(" · "));
    }
    return mapRebuild(row, todayChicago());
  });

export const archiveRebuild = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await readySql();
    await requireEditor(sql, context.userId);
    await ensureRebuilds(sql);
    const cur = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0];
    if (!cur) throw new Error("Rebuild not found");
    await sql.query(`update rebuilds set archived = true, updated_at = now() where id = $1`, [data.id]);
    await logActivity(sql, context.userId, data.id, "removed", cur.title);
    return { ok: true };
  });

type SerialHitLite = {
  assetId: number;
  serial: string;
  model: string;
  location: string;
  status: string;
  soldTo: string | null;
  available: boolean;
};

async function findWarehouse(sql: Sql, serial: string): Promise<SerialHitLite | null> {
  const key = serialKey(serial);
  if (!key) return null;
  const rows = await sql.query<{
    id: number;
    model: string;
    serial: string | null;
    status: string;
    site: string;
    pallet: string | null;
    level: number | null;
    sold_to: string | null;
    install_id: number | null;
    job_id: number | null;
  }>(
    `select id, model, serial, status, site, pallet, level, sold_to, install_id, job_id
     from assets where serial is not null and btrim(serial) <> ''`,
  );
  const hit = rows.find((r) => serialKey(r.serial) === key);
  if (!hit) return null;
  const loc = hit.pallet && hit.level != null ? `${hit.pallet}-${hit.level}` : hit.site;
  const allocated = !!(hit.sold_to || hit.install_id || hit.job_id || hit.status === "assigned" || hit.status === "sold");
  return {
    assetId: Number(hit.id),
    serial: hit.serial ?? serial,
    model: hit.model,
    location: loc,
    status: hit.status,
    soldTo: hit.sold_to,
    available: !allocated && hit.status === "ready",
  };
}

export const pullRebuildSerial = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; serial: string; confirmReuse?: boolean }) =>
    z.object({ id: z.number(), serial: z.string(), confirmReuse: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Rebuild> => {
    const sql = await readySql();
    await requireEditor(sql, context.userId);
    const cur = (
      await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id])
    )[0];
    if (!cur) throw new Error("Rebuild not found");
    const serial = data.serial.trim();
    if (!serialKey(serial)) {
      await sql.query(
        `update rebuilds set serial = $2, serial_notice = $3, updated_at = now() where id = $1`,
        [data.id, serial || null, serial ? `Serial ${serial} not found in warehouse.` : null],
      );
      const row = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0]!;
      return mapRebuild(row, todayChicago());
    }
    const hit = await findWarehouse(sql, serial);
    if (!hit) {
      const notice = `Serial ${serial} not found in warehouse.`;
      await sql.query(
        `update rebuilds set serial = $2, asset_id = null, serial_notice = $3, updated_at = now() where id = $1`,
        [data.id, serial, notice],
      );
      await logActivity(sql, context.userId, data.id, "serial-miss", notice);
      const row = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0]!;
      return mapRebuild(row, todayChicago());
    }
    const sameAccount = (hit.soldTo ?? "").trim().toLowerCase() === cur.account.trim().toLowerCase();
    if (!hit.available && !sameAccount && !data.confirmReuse) {
      const who = hit.soldTo || "another account";
      const notice = `Serial ${hit.serial} is already assigned to ${who}.`;
      await sql.query(`update rebuilds set serial_notice = $2, updated_at = now() where id = $1`, [
        data.id,
        notice,
      ]);
      throw new Error(`${notice} Confirm reuse or cancel.`);
    }
    await sql.query(
      `update assets set
         status = 'assigned',
         sold_to = $2,
         purpose = 'In-house rebuild',
         updated_at = now()
       where id = $1`,
      [hit.assetId, cur.account],
    );
    const extra = !hit.available && hit.soldTo && !sameAccount ? ` (was ${hit.soldTo})` : "";
    const notice = `Serial ${hit.serial} pulled from warehouse · ${hit.model} · ${hit.location}${extra}`;
    const equipment = cur.equipment?.trim() ? cur.equipment : hit.model;
    await sql.query(
      `update rebuilds set serial = $2, asset_id = $3, equipment = $4, serial_notice = $5, updated_at = now() where id = $1`,
      [data.id, hit.serial, hit.assetId, equipment, notice],
    );
    await logActivity(sql, context.userId, data.id, "assigned-asset", notice);
    const row = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0]!;
    return mapRebuild(row, todayChicago());
  });

export async function seedRebuilds(sql: Sql): Promise<void> {
  await ensureRebuilds(sql);
  const meta = await sql.query<{ v: string }>("select v from seed_meta where k = 'rebuilds'");
  if (meta[0]?.v === "v1") return;
  const existing = await sql.query<{ c: number }>("select count(*)::int as c from rebuilds");
  if ((existing[0]?.c ?? 0) > 0) {
    await sql.query(
      `insert into seed_meta (k, v) values ('rebuilds', 'v1') on conflict (k) do update set v = 'v1'`,
    );
    return;
  }

  const today = todayChicago();
  const add = (days: number) => {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return dt.toISOString().slice(0, 10);
  };

  type Seed = {
    title: string;
    account: string;
    equipment: string | null;
    serial: string | null;
    owner: string | null;
    status: RebuildStatus;
    reason: string | null;
    detail: string | null;
    planned: string | null;
    target: string | null;
    actualStart: string | null;
    actualComplete: string | null;
    priority: RebuildPriority;
    notes: string | null;
    changedDays: number;
    createdDays: number;
  };

  const rows: Seed[] = [
    {
      title: "Cameo steam block — stock",
      account: SHOP_ACCOUNT,
      equipment: "Eversys Cameo c'2m",
      serial: "0183330226105C0012",
      owner: "Ryan",
      status: "Queued",
      reason: null,
      detail: null,
      planned: add(3),
      target: add(21),
      actualStart: null,
      actualComplete: null,
      priority: "normal",
      notes: "Tear-down when the bench frees. Serial is on the rack.",
      changedDays: -1,
      createdDays: -2,
    },
    {
      title: "Milton's brew group rebuild",
      account: "Milton's",
      equipment: "Eversys Cameo c'2s",
      serial: null,
      owner: "Oliver",
      status: "In progress",
      reason: null,
      detail: null,
      planned: add(-10),
      target: add(2),
      actualStart: add(-8),
      actualComplete: null,
      priority: "high",
      notes: "On the bench. Target this week so we do not miss the reopen.",
      changedDays: -8,
      createdDays: -12,
    },
    {
      title: "Hyde Park ITCB — waiting on steam valve",
      account: "Hyde Park",
      equipment: "Bunn ITCB",
      serial: "ITCB077789",
      owner: "Josh",
      status: "Waiting",
      reason: "Parts on order",
      detail: "Steam valve ETA next Friday from Bunn.",
      planned: add(-20),
      target: add(-4),
      actualStart: add(-18),
      actualComplete: null,
      priority: "committed-to-customer",
      notes: "Do not dispatch until the valve lands. Customer already slipped once.",
      changedDays: -9,
      createdDays: -22,
    },
    {
      title: "Shop e'4s leak — waiting on customer",
      account: SHOP_ACCOUNT,
      equipment: "Eversys e'4s",
      serial: "110700026103E0015",
      owner: "Charles",
      status: "Waiting",
      reason: "Waiting on customer",
      detail: "Need the original water-filter spec before we button it up.",
      planned: add(-6),
      target: add(6),
      actualStart: add(-5),
      actualComplete: null,
      priority: "normal",
      notes: "Internal stock unit. Hold for the spec sheet.",
      changedDays: -6,
      createdDays: -7,
    },
    {
      title: "Tejas 2051e — test stand",
      account: "Tejas Choco & BBQ - Spring",
      equipment: "Fetco 2051e",
      serial: "470102071577",
      owner: "Ryan",
      status: "Testing",
      reason: null,
      detail: null,
      planned: add(-14),
      target: add(4),
      actualStart: add(-12),
      actualComplete: null,
      priority: "high",
      notes: "Brew cycle on the test stand. Confirm spray head before Ready.",
      changedDays: -2,
      createdDays: -16,
    },
    {
      title: "Eurest Axiom — ready to ship",
      account: "Eurest USA",
      equipment: "Bunn Axiom-APS",
      serial: "AXAP048950",
      owner: "Lance",
      status: "Ready",
      reason: null,
      detail: null,
      planned: add(-21),
      target: add(-1),
      actualStart: add(-18),
      actualComplete: null,
      priority: "committed-to-customer",
      notes: "Passed test. Waiting on the truck, not the bench.",
      changedDays: -1,
      createdDays: -24,
    },
    {
      title: "Southern Ice grinder — closed",
      account: "Southern Ice CO",
      equipment: "Bunn G9-2T",
      serial: "G951020201",
      owner: "Jesus",
      status: "Completed",
      reason: null,
      detail: null,
      planned: add(-30),
      target: add(-8),
      actualStart: add(-28),
      actualComplete: add(-9),
      priority: "normal",
      notes: "Finished a day early. Back on the account.",
      changedDays: -9,
      createdDays: -32,
    },
    {
      title: "Cancelled — account bought new",
      account: "The Gathery",
      equipment: "Fetco 51H",
      serial: null,
      owner: "Bill",
      status: "Cancelled",
      reason: null,
      detail: null,
      planned: add(-12),
      target: add(10),
      actualStart: null,
      actualComplete: null,
      priority: "normal",
      notes: "They bought a new 51H. Do not rebuild the old one.",
      changedDays: -3,
      createdDays: -14,
    },
    {
      title: "Cameo steam — no target on the card",
      account: SHOP_ACCOUNT,
      equipment: "Eversys Cameo c'2s",
      serial: null,
      owner: "Jesus",
      status: "In progress",
      reason: null,
      detail: null,
      planned: add(-4),
      target: null,
      actualStart: add(-3),
      actualComplete: null,
      priority: "normal",
      notes: "Already on the bench with no target. Clock should flag No date.",
      changedDays: -3,
      createdDays: -5,
    },
    {
      title: "kol fac Linea — past target",
      account: "kol fac 118",
      equipment: "La Marzocco Linea 2EE",
      serial: "L042403",
      owner: "Bill",
      status: "In progress",
      reason: null,
      detail: null,
      planned: add(-25),
      target: add(-7),
      actualStart: add(-22),
      actualComplete: null,
      priority: "committed-to-customer",
      notes: "Past target. Group heads still leaking after the gasket kit.",
      changedDays: -7,
      createdDays: -26,
    },
  ];

  for (const s of rows) {
    const created = add(s.createdDays);
    const changedAt = add(s.changedDays);
    await sql.query(
      `insert into rebuilds (
         title, account, equipment, serial, owner, status, reason_code, reason_detail,
         planned_start, target_complete, actual_start, actual_complete, priority, notes,
         status_changed_at, created_at, updated_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
         $15::timestamptz, $16::timestamptz, now()
       )`,
      [
        s.title,
        s.account,
        s.equipment,
        s.serial,
        s.owner,
        s.status,
        s.reason,
        s.detail,
        s.planned,
        s.target,
        s.actualStart,
        s.actualComplete,
        s.priority,
        s.notes,
        `${changedAt}T12:00:00-05:00`,
        `${created}T09:00:00-05:00`,
      ],
    );
  }

  await sql.query(
    `insert into seed_meta (k, v) values ('rebuilds', 'v1') on conflict (k) do update set v = 'v1'`,
  );
}

export function sortRebuildsForExport(rows: Rebuild[]): Rebuild[] {
  return [...rows].sort((a, b) => {
    const h = HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
    if (h) return h;
    const ta = a.targetComplete || "9999-12-31";
    const tb = b.targetComplete || "9999-12-31";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.account.localeCompare(b.account, undefined, { sensitivity: "base" });
  });
}
