import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { todayChicago } from "@/lib/ops/clock";
import { serialKey } from "@/lib/ops/serial-pull";
import { LOCKED_BY_ASSIGNED } from "@/lib/ops/equipment-lock-rules";
import { loadTechs } from "@/lib/ops/roster";
import { loadAccountMarks, isAviKatz, accountRepFor } from "@/lib/ops/reps";
import {
  CLOSED_REBUILD,
  HEALTH_RANK,
  REFURB_STOCK_PLACE,
  SHOP_ACCOUNT,
  computeRebuildMetrics,
  isRebuildPriority,
  isRebuildStatus,
  machineSerials,
  machinesLabel,
  refurbCompleteRefusal,
  stockedLine,
  validateRebuild,
  type RebuildHealth,
  type RebuildMachine,
  type RebuildMetrics,
  type RebuildPriority,
  type RebuildStatus,
  type WaitingReason,
} from "@/lib/ops/rebuild-model";
import { isoDayOrNull as isoDay } from "@/lib/ops/iso";
import { loadRebuildCosts } from "@/lib/ops/repair-quote-api";
import type { QuoteCost } from "@/lib/ops/repair-quote";
import {
  SERVICE_DEPT_ACCOUNT,
  SERVICE_DEPT_KEYS,
  WAREHOUSE_ACCOUNT_KEYS,
  warehouseAccountChange,
  warehouseEditRefusal,
  warehouseMayEdit,
} from "@/lib/ops/warehouse-invoice";
import { pullNotice, unitWhere, type PulledUnit } from "@/lib/ops/warehouse-pull";
import { notifyAdminsWarehousePull } from "@/lib/ops/notify";
import { SITE_PURPOSE, siteLabel, slotId } from "@/lib/ops/warehouse";
import { HOUSE_STAGING } from "@/lib/ops/unit-place-rules";

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

export type { RebuildHealth, RebuildMachine, RebuildMetrics, RebuildPriority, RebuildStatus, WaitingReason };

export type Rebuild = {
  id: number;
  title: string;
  account: string;
  /** Its machines' models: "Mazzer Super Jolly ×2, Bunn ITCB-DV" (11/2). */
  equipment: string | null;
  /** Its machines' serials: "SJ-1, SJ-2". */
  serial: string | null;
  /** The first machine's warehouse unit. */
  assetId: number | null;
  /** The machines on it, oldest first (11/2): Warehouse refurbishes several on one rebuild, or just one. */
  machines: RebuildMachine[];
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
  /** Cost from the project's repair quote: parts, labor, total and status. Null when it has no quote. */
  quote: QuoteCost | null;
  /** Its invoice: approved, waiting (Warehouse saved it for an Admin to approve), or null when there is none yet. */
  invoice: "approved" | "waiting" | null;
  /** Whether the person looking may change it (Warehouse: only refurbs for Katz Coffee Service Dept. or Katz shop / stock). */
  editable: boolean;
  /** After a save that completed a refurb: what went into stock, and anything that couldn't. */
  stockNote?: string | null;
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

type MachineRow = {
  id: number;
  rebuild_id: number;
  model: string;
  serial: string | null;
  asset_id: number | null;
  notice: string | null;
  origin: unknown;
  stocked_at: string | Date | null;
};

function mapMachine(r: MachineRow): RebuildMachine {
  return {
    id: Number(r.id),
    model: r.model ?? "",
    serial: r.serial?.trim() || null,
    assetId: num(r.asset_id),
    notice: r.notice?.trim() || null,
    stockedAt: r.stocked_at ? stamp(r.stocked_at) : null,
  };
}

/** Each rebuild's machines, oldest first. */
async function loadMachines(sql: Sql, ids: number[]): Promise<Map<number, RebuildMachine[]>> {
  const out = new Map<number, RebuildMachine[]>();
  if (!ids.length) return out;
  const rows = await sql.query<MachineRow>("select * from rebuild_machines where rebuild_id = any($1::int[]) order by rebuild_id, id", [ids]);
  for (const r of rows) {
    const list = out.get(Number(r.rebuild_id)) ?? [];
    list.push(mapMachine(r));
    out.set(Number(r.rebuild_id), list);
  }
  return out;
}

/** One rebuild as the board has it, with its machines, after a write. */
async function rebuildOut(sql: Sql, row: RebuildRow): Promise<Rebuild> {
  const machines = (await loadMachines(sql, [Number(row.id)])).get(Number(row.id)) ?? [];
  return mapRebuild(row, todayChicago(), null, false, machines);
}

export function mapRebuild(r: RebuildRow, today: string, accountRep: string | null = null, aviKatz = false, machines: RebuildMachine[] = []): Rebuild {
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
    // The machines are the rebuild's equipment now (11/2); the old one-machine columns were copied into them.
    equipment: machinesLabel(machines),
    serial: machineSerials(machines),
    assetId: machines.find((m) => m.assetId != null)?.assetId ?? null,
    machines,
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
    serialNotice: machines[0]?.notice ?? null,
    statusChangedAt: stamp(r.status_changed_at),
    createdAt: stamp(r.created_at),
    updatedAt: stamp(r.updated_at),
    accountRep,
    aviKatz,
    quote: null,
    invoice: null,
    editable: true,
    ...metrics,
  };
}

export async function loadRebuilds(sql: Sql, today = todayChicago()): Promise<Rebuild[]> {
  await ensureRebuilds(sql);
  await seedRebuilds(sql);
  const rows = await sql.query<RebuildRow>(
    "select * from rebuilds where coalesce(archived, false) = false order by id desc",
  );
  const marks = await loadAccountMarks(sql).catch(() => ({ rep: new Map<string, string>(), repLoose: new Map<string, string>(), ak: new Set<string>(), acct: new Map<string, string>() }));
  const machines = await loadMachines(sql, rows.map((r) => Number(r.id)));
  const list = rows.map((r) =>
    mapRebuild(r, today, accountRepFor(marks, r.account), isAviKatz(marks, r.account), machines.get(Number(r.id)) ?? []),
  );
  // The cost on each row is read from the project's one repair quote. Never blocks the list.
  const costs = await loadRebuildCosts(sql, list).catch(() => new Map<number, QuoteCost>());
  for (const r of list) r.quote = costs.get(r.id) ?? null;
  // Where each one's invoice stands, for the board's Invoice Waiting badge. Never blocks the list either.
  const invoices = await sql
    .query<{ entity_id: number; approved: boolean }>("select entity_id, approved_at is not null as approved from invoices where entity_type = 'rebuild' and (approved_at is not null or submitted_at is not null)")
    .catch(() => []);
  const state = new Map(invoices.map((i) => [Number(i.entity_id), i.approved ? ("approved" as const) : ("waiting" as const)]));
  for (const r of list) r.invoice = state.get(r.id) ?? null;
  return list;
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

type AccessLite = { role: "sales" | "service" | "warehouse" | null; isAdmin: boolean; username: string };

async function loadAccessLite(sql: Sql, userId: string): Promise<AccessLite> {
  const rows = await sql.query<{ desk_role: string | null; is_admin: boolean; username: string }>(
    "select desk_role, is_admin, username from desk_accounts where user_id = $1",
    [userId],
  );
  const r = rows[0];
  const role = r?.desk_role === "sales" || r?.desk_role === "service" || r?.desk_role === "warehouse" ? r.desk_role : null;
  const isAdmin = !!(r && (r.is_admin === true || String(r.is_admin) === "t" || String(r.is_admin) === "true"));
  return { role, isAdmin, username: r?.username || "Teammate" };
}

function canEditBench(access: AccessLite): boolean {
  if (access.isAdmin) return true;
  return access.role !== "sales";
}

/** Warehouse (Chuy, 10/29): changes only its refurbs, for Katz Coffee Service Dept. or Katz shop / stock. */
const isWarehouse = (access: AccessLite) => access.role === "warehouse" && !access.isAdmin;

async function requireEditor(sql: Sql, userId: string): Promise<AccessLite> {
  const access = await loadAccessLite(sql, userId);
  if (!canEditBench(access)) {
    throw new Error("Sales can view rebuilds on their accounts. Bench status is service-owned.");
  }
  return access;
}

/** Refuses a warehouse user's change to a rebuild that isn't one of its refurbs. */
function requireRowEditor(access: AccessLite, account: string): void {
  const refusal = isWarehouse(access) ? warehouseEditRefusal(account) : null;
  if (refusal) throw new Error(refusal);
}

/**
 * Warehouse's writes check the rebuild's account again inside the write itself, so an Admin moving it to a customer
 * meanwhile is never undone. `param` is null for everyone else.
 */
const warehouseKeys = (access: AccessLite): string[] | null => (isWarehouse(access) ? [...WAREHOUSE_ACCOUNT_KEYS] : null);
const ACCOUNT_STILL = (col: string, param: string) => `(${param}::text[] is null or regexp_replace(lower(coalesce(${col}, '')), '[^a-z0-9]+', '', 'g') = any(${param}::text[]))`;

/** What Warehouse is told when its write found the rebuild on another account. */
async function movedRefusal(sql: Sql, id: number): Promise<Error> {
  const now = (await sql.query<{ account: string }>("select account from rebuilds where id = $1", [id]))[0];
  return new Error(now ? (warehouseEditRefusal(now.account) ?? "This rebuild changed while you had it open. Open it again.") : "Rebuild not found");
}

/** Katz Coffee Service Dept. as the customer list spells it (so its billing info is found), else the usual spelling. */
export async function serviceDeptName(sql: Sql): Promise<string> {
  const rows = await sql
    .query<{ name: string }>(
      "select name from directory_customers where archived = false and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') = any($1::text[]) order by name_locked desc, id limit 1",
      [[...SERVICE_DEPT_KEYS]],
    )
    .catch(() => []);
  return rows[0]?.name?.trim() || SERVICE_DEPT_ACCOUNT;
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

export type RebuildList = {
  rows: Rebuild[];
  canEdit: boolean;
  /** Warehouse: the account its new refurbs (and their invoices) are for, Katz Coffee Service Dept. Null for everyone else. */
  accountLock: string | null;
};

export const listRebuilds = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<RebuildList> => listRebuildsFor(await readySql(), context.userId));

/** The body of listRebuilds: every rebuild, with which ones this person may change. */
export async function listRebuildsFor(sql: Sql, userId: string): Promise<RebuildList> {
  const access = await loadAccessLite(sql, userId);
  const canEdit = canEditBench(access);
  const accountLock = isWarehouse(access) ? await serviceDeptName(sql) : null;
  const rows = (await loadRebuilds(sql)).map((r) => ({ ...r, editable: canEdit && (!accountLock || warehouseMayEdit(r.account)) }));
  return { rows, canEdit, accountLock };
}

export const listRebuildOwners = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<string[]> => {
    const sql = await readySql();
    const techs = (await loadTechs(sql)).filter((t) => t.active);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of techs) {
      const name = t.name.trim();
      const key = name.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
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
  .handler(async ({ data, context }): Promise<Rebuild> => createRebuildFor(await readySql(), data, context.userId));

/** The body of createRebuild. A warehouse user's new rebuild is always a refurb for Katz Coffee Service Dept. */
export async function createRebuildFor(sql: Sql, data: z.infer<typeof createSchema>, userId: string): Promise<Rebuild> {
  const access = await requireEditor(sql, userId);
  await ensureRebuilds(sql);
  const account = isWarehouse(access) ? await serviceDeptName(sql) : data.account.trim() || SHOP_ACCOUNT;
  const status = isRebuildStatus(data.status) ? data.status : "Queued";
  const err = validateRebuild({
    title: data.title,
    account,
    owner: emptyToNull(data.owner),
    status,
    reasonCode: emptyToNull(data.reasonCode),
    reasonDetail: emptyToNull(data.reasonDetail),
    targetComplete: emptyToNull(data.targetComplete),
    prevStatus: "Queued",
  });
  if (err) throw new Error(err);
  const waiting = status === "Waiting";
  // The equipment picked is its first machine (11/2). A serial is pulled onto a machine afterwards, by its own rules.
  const rows = await sql.query<RebuildRow>(
    `with made as (
       insert into rebuilds (
         title, account, equipment, serial, owner, status, reason_code, reason_detail,
         planned_start, target_complete, actual_start, priority, notes, install_id, job_id
       ) values ($1,$2,$3,null,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning *
     ), first as (
       insert into rebuild_machines (rebuild_id, model) select id, equipment from made where equipment is not null returning id
     )
     select * from made`,
    [
      data.title.trim(),
      account,
      emptyToNull(data.equipment),
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
  await logActivity(sql, userId, Number(row.id), "opened", `${row.title} · ${row.account}`);
  return rebuildOut(sql, row);
}

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
  .handler(async ({ data, context }): Promise<Rebuild> => updateRebuildFor(await readySql(), data, context.userId));

/**
 * The body of updateRebuild. Warehouse changes only its refurbs (Katz Coffee Service Dept. or Katz shop / stock), and
 * can move a Katz shop / stock one to Katz Coffee Service Dept. but never put a rebuild on any other account.
 */
export async function updateRebuildFor(sql: Sql, data: z.infer<typeof patchSchema>, userId: string): Promise<Rebuild> {
  const access = await requireEditor(sql, userId);
  await ensureRebuilds(sql);
  const cur = (
    await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id])
  )[0];
  if (!cur) throw new Error("Rebuild not found");

  let nextAccount = data.account != null ? data.account.trim() : cur.account;
  if (isWarehouse(access)) {
    const move = warehouseAccountChange(cur.account, data.account);
    if (!move.ok) throw new Error(move.error);
    if (move.serviceDept) nextAccount = await serviceDeptName(sql);
  }
  const nextStatus = data.status != null ? data.status : cur.status;
  const nextOwner = data.owner !== undefined ? emptyToNull(data.owner) : cur.owner;
  const nextTarget = data.targetComplete !== undefined ? isoDay(data.targetComplete) : isoDay(cur.target_complete);
  const nextReason = data.reasonCode !== undefined ? emptyToNull(data.reasonCode) : cur.reason_code;
  const nextDetail = data.reasonDetail !== undefined ? emptyToNull(data.reasonDetail) : cur.reason_detail;
  const nextTitle = data.title != null ? data.title.trim() : cur.title;

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

  // A refurb completed puts its machines in stock (11/2), so each one needs the model it goes in as.
  if (nextStatus === "Completed" && cur.status !== "Completed" && warehouseMayEdit(nextAccount || SHOP_ACCOUNT)) {
    const refusal = refurbCompleteRefusal((await loadMachines(sql, [data.id])).get(data.id) ?? []);
    if (refusal) throw new Error(refusal);
  }

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
     where id = $1 and ${ACCOUNT_STILL("account", "$19")}
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
      warehouseKeys(access),
    ],
  );
  const row = rows[0];
  if (!row) throw await movedRefusal(sql, data.id);
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
  const accountNote = changed("account", cur.account, row.account);
  if (accountNote) {
    parts.push(accountNote);
    // Its pulled units go with it to the new account (a shop refurb billed to Katz Coffee Service Dept.), and so does
    // each machine's record of whom the pull put the unit on.
    await sql.query(
      `with moved as (
         update assets a set sold_to = $2, updated_at = now()
           from rebuild_machines m
          where m.rebuild_id = $1 and m.asset_id = a.id and m.stocked_at is null
            and a.status = 'assigned' and a.purpose = 'In-house rebuild' and ${NAME_KEY("a.sold_to")} = ${NAME_KEY("$3")}
         returning a.id
       )
       update rebuild_machines set origin = jsonb_set(origin, '{pulled_to}', to_jsonb($2::text)), updated_at = now()
        where rebuild_id = $1 and origin is not null and ${NAME_KEY("origin->>'pulled_to'")} = ${NAME_KEY("$3")}`,
      [data.id, row.account, cur.account],
    );
  }
  if (parts.length) {
    const action = statusChanged ? "status" : parts.some((p) => p.startsWith("reason") || p.startsWith("kept")) ? "reason" : "updated";
    await logActivity(sql, userId, data.id, action, parts.slice(0, 4).join(" · "));
  }
  // Completed just now, on a refurb: its machines go into stock at the Staging area.
  const stockNote = row.status === "Completed" && cur.status !== "Completed" && warehouseMayEdit(row.account) ? await stockRefurbMachines(sql, row, userId) : null;
  return { ...(await rebuildOut(sql, row)), stockNote };
}

export const archiveRebuild = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => archiveRebuildFor(await readySql(), data, context.userId));

/** The body of archiveRebuild. Warehouse removes only its refurbs. */
export async function archiveRebuildFor(sql: Sql, data: { id: number }, userId: string): Promise<{ ok: true }> {
  const access = await requireEditor(sql, userId);
  await ensureRebuilds(sql);
  const cur = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0];
  if (!cur) throw new Error("Rebuild not found");
  requireRowEditor(access, cur.account);
  const gone = await sql.query<{ id: number }>(`update rebuilds set archived = true, updated_at = now() where id = $1 and ${ACCOUNT_STILL("account", "$2")} returning id`, [
    data.id,
    warehouseKeys(access),
  ]);
  if (!gone.length) throw await movedRefusal(sql, data.id);
  await logActivity(sql, userId, data.id, "removed", cur.title);
  return { ok: true };
}

type SerialHitLite = {
  assetId: number;
  serial: string;
  model: string;
  /** The rack slot (B-L2) or the place (San Antonio), as installs and tickets show it. */
  location: string;
  status: string;
  soldTo: string | null;
  available: boolean;
  /** A Warehouse request waiting for an Admin: "assign" (to a customer) or "remove". */
  held: string | null;
  /** Where the unit is: the confirm question and Warehouse's ping to the Admins say it. */
  place: PulledUnit;
  /** Changes with every write to the unit. Warehouse's pull goes through only while the unit is as it was read. */
  stamp: string;
};

/** An asset's last write, to the microsecond, as text ("" when it has none). */
const ASSET_STAMP = "coalesce((extract(epoch from updated_at) * 1000000)::bigint::text, '')";

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
    stock_hold: string | null;
    purpose: string | null;
    stamp: string | null;
  }>(
    `select id, model, serial, status, site, pallet, level, sold_to, install_id, job_id, stock_hold, purpose, ${ASSET_STAMP} as stamp
     from assets where serial is not null and btrim(serial) <> '' order by id`,
  );
  const hit = rows.find((r) => serialKey(r.serial) === key);
  if (!hit) return null;
  const level = num(hit.level);
  const loc = hit.pallet && level != null ? slotId(hit.pallet, level) : siteLabel(hit.site);
  const allocated = !!(hit.sold_to || hit.install_id || hit.job_id || hit.status === "assigned" || hit.status === "sold");
  return {
    assetId: Number(hit.id),
    serial: hit.serial ?? serial,
    model: hit.model,
    location: loc,
    status: hit.status,
    soldTo: hit.sold_to,
    available: !allocated && hit.status === "ready",
    held: hit.stock_hold?.trim() || null,
    place: {
      site: hit.site,
      pallet: hit.pallet,
      level,
      status: hit.status,
      soldTo: hit.sold_to,
      purpose: hit.purpose,
      installId: num(hit.install_id),
      jobId: num(hit.job_id),
    },
    stamp: hit.stamp ?? "",
  };
}

/** A machine's row on this rebuild, or null. */
async function machineRow(sql: Sql, rebuildId: number, machineId: number): Promise<MachineRow | null> {
  return (await sql.query<MachineRow>("select * from rebuild_machines where id = $1 and rebuild_id = $2", [machineId, rebuildId]))[0] ?? null;
}

/** A rebuild's machines change while it is open: a completed refurb's are in stock, and a cancelled one is over. */
function requireOpen(cur: RebuildRow): void {
  if (CLOSED_REBUILD.has(cur.status as RebuildStatus)) {
    throw new Error(`This rebuild is ${cur.status}, so its machines can't change. Set it back to In progress first.`);
  }
}

/** SQL: rebuild `id` is still open and, for Warehouse (`keys` not null), still one of its refurbs. */
const OPEN_STILL = (id: string, keys: string) =>
  `exists (select 1 from rebuilds r where r.id = ${id} and r.status not in ('Completed', 'Cancelled') and ${ACCOUNT_STILL("r.account", keys)})`;

/** What a machine write that found its rebuild closed, or moved off Warehouse's refurbs, is told. */
async function machineRefusal(sql: Sql, id: number): Promise<Error> {
  const now = (await sql.query<{ account: string; status: string }>("select account, status from rebuilds where id = $1", [id]))[0];
  if (!now) return new Error("Rebuild not found");
  if (CLOSED_REBUILD.has(now.status as RebuildStatus)) return new Error(`This rebuild is ${now.status} now, so its machines can't change.`);
  return new Error(warehouseEditRefusal(now.account) ?? "This rebuild changed while you had it open. Open it again.");
}

/** SQL: a name with letters and digits only, as the account rules match it. */
const NAME_KEY = (col: string) => `regexp_replace(lower(coalesce(${col}, '')), '[^a-z0-9]+', '', 'g')`;

const machinesInput = z.object({
  id: z.number(),
  /** The models: a machine's id with its model, or a new machine (no id) with its model. */
  machines: z.array(z.object({ id: z.number().nullable().optional(), model: z.string().max(200) })).max(100),
});

export const saveRebuildMachines = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof machinesInput>) => machinesInput.parse(d))
  .handler(async ({ data, context }): Promise<Rebuild> => saveRebuildMachinesFor(await readySql(), data, context.userId));

/**
 * The body of saveRebuildMachines: the machines' models, and new machines by model (Chuy, 11/2: Warehouse works on
 * several machines at once, so a rebuild holds as many as it needs, or one). A blank new row is skipped. Machines in
 * stock don't change; a closed rebuild's machines don't either.
 */
export async function saveRebuildMachinesFor(sql: Sql, data: z.infer<typeof machinesInput>, userId: string): Promise<Rebuild> {
  const access = await requireEditor(sql, userId);
  const cur = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0];
  if (!cur) throw new Error("Rebuild not found");
  requireRowEditor(access, cur.account);
  requireOpen(cur);
  const list = data.machines.map((m) => ({ id: m.id ?? null, model: m.model.trim() }));
  const rows = await sql.query<{ ok: boolean; added: number; changed: number }>(
    `with ok as (select ${OPEN_STILL("$1", "$3")} as ok),
     changed as (
       update rebuild_machines m set model = x.model, updated_at = now()
         from jsonb_to_recordset($2::jsonb) as x(id int, model text)
        where x.id is not null and m.id = x.id and m.rebuild_id = $1 and m.stocked_at is null
          and m.model is distinct from x.model and (select ok from ok)
       returning m.id
     ),
     added as (
       insert into rebuild_machines (rebuild_id, model)
       select $1, x.model from jsonb_to_recordset($2::jsonb) as x(id int, model text)
        where x.id is null and x.model <> '' and (select ok from ok)
       returning id
     )
     select (select ok from ok) as ok, (select count(*)::int from added) as added, (select count(*)::int from changed) as changed`,
    [data.id, JSON.stringify(list), warehouseKeys(access)],
  );
  if (!rows[0]?.ok) throw await machineRefusal(sql, data.id);
  const { added, changed: edited } = rows[0];
  if (added || edited) {
    await logActivity(sql, userId, data.id, "updated", [added ? `${added} machine${added === 1 ? "" : "s"} added` : "", edited ? `${edited} model${edited === 1 ? "" : "s"} changed` : ""].filter(Boolean).join(" · "));
  }
  const row = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0]!;
  return rebuildOut(sql, row);
}

/**
 * Puts a machine's unit back as it was before the pull: on its rack slot, account, install or ticket, with its lock.
 * Only while the unit is still as the pull left it (on the refurb's account, In-house rebuild); a unit moved since
 * stays where it is. SQL parameters: $1 the unit, $2 the machine's origin.
 */
const PUT_BACK = `
  update assets a set status = o.status, sold_to = o.sold_to, purpose = o.purpose, install_id = o.install_id, job_id = o.job_id,
         locked_at = o.locked_at, locked_by = o.locked_by, updated_at = now()
    from jsonb_to_record($2::jsonb) as o(status text, sold_to text, purpose text, install_id int, job_id int,
                                          locked_at timestamptz, locked_by text, pulled_to text)
   where a.id = $1 and a.status = 'assigned' and a.purpose = 'In-house rebuild'
     and ${NAME_KEY("a.sold_to")} = ${NAME_KEY("o.pulled_to")}
  returning a.id`;

/** What the person is told about a machine's unit when the machine is taken off or its serial changes. */
function putBackLine(serial: string | null, origin: unknown, back: boolean): string | null {
  const sn = serial?.trim() ? `SN ${serial.trim()}` : "Its unit";
  if (back) return `${sn} is back where it was before it was pulled.`;
  if (!origin) return `${sn} stays as it is (pulled before machines were kept); move it from the Warehouse page if it isn't on this refurb.`;
  return `${sn} was moved since it was pulled, so it stays where it is now.`;
}

const pullInput = z.object({
  id: z.number(),
  /** The machine to pull onto; none adds a machine for the serial. */
  machineId: z.number().nullable().optional(),
  serial: z.string(),
  /** A new machine's model, for a serial that isn't in the warehouse. */
  model: z.string().max(200).nullable().optional(),
  confirmReuse: z.boolean().optional(),
  /** The confirm question the person answered: asked again when the unit has moved since. */
  asked: z.string().max(10000).optional(),
});

export const pullRebuildMachine = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof pullInput>) => pullInput.parse(d))
  .handler(async ({ data, context }): Promise<Rebuild> => pullRebuildMachineFor(await readySql(), data, context.userId));

/**
 * The body of pullRebuildMachine: a serial on one of the rebuild's machines (or a new one). A warehouse unit with that
 * serial is pulled onto the rebuild, as the rebuild's one serial was before (Chuy, 10/29): Warehouse pulls onto its
 * refurbs only, from wherever the unit is, with no Admin's approval, and every Admin gets a ping saying where it came
 * from. A unit waiting for an Admin's decision on a Warehouse request stays put, and so does one the owner locked on a
 * customer's account. A unit on another open rebuild's machines stays there. The machine keeps how the unit was, so
 * taking it off puts the unit back; a machine's old unit is put back when it takes another serial.
 */
export async function pullRebuildMachineFor(sql: Sql, data: z.infer<typeof pullInput>, userId: string): Promise<Rebuild> {
  const access = await requireEditor(sql, userId);
  const cur = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0];
  if (!cur) throw new Error("Rebuild not found");
  requireRowEditor(access, cur.account);
  requireOpen(cur);
  const machine = data.machineId != null ? await machineRow(sql, data.id, data.machineId) : null;
  if (data.machineId != null && !machine) throw new Error("That machine isn't on this rebuild any more. Open the rebuild again.");
  if (machine?.stocked_at) throw new Error("That machine is in stock already, so it can't change.");
  const keys = warehouseKeys(access);
  const refurb = warehouseMayEdit(cur.account);
  const serial = data.serial.trim();
  const model = (data.model ?? "").trim();
  const reload = async (): Promise<Rebuild> => rebuildOut(sql, (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0]!);

  /** The machine takes a serial no unit has (or none): its old unit is put back, and the notice says what's next. */
  const keepSerial = async (notice: string | null): Promise<string | null> => {
    const rows = await sql.query<{ id: number; old_asset: number | null; old_origin: unknown; old_serial: string | null; back: number }>(
      `with mine as (
         select id, asset_id, origin, serial from rebuild_machines
          where id = $1 and rebuild_id = $2 and stocked_at is null and ${OPEN_STILL("$2", "$6")}
          for update
       ), back as (
         ${PUT_BACK.replace("where a.id = $1", "where a.id = (select asset_id from mine)").replace("$2::jsonb", "(select origin from mine)")}
       ), saved as (
         update rebuild_machines set serial = $3, asset_id = null, origin = null, notice = $4,
                model = case when model = '' then $5 else model end, updated_at = now()
          where id = (select id from mine)
         returning id
       ), added as (
         insert into rebuild_machines (rebuild_id, model, serial, notice)
         select $2, $5, $3, $4 where $1::int is null and ${OPEN_STILL("$2", "$6")}
         returning id
       )
       select coalesce((select id from saved), (select id from added)) as id, (select asset_id from mine) as old_asset,
              (select origin from mine) as old_origin, (select serial from mine) as old_serial, (select count(*)::int from back) as back`,
      [machine?.id ?? null, data.id, serial || null, notice, model, keys],
    );
    if (!rows[0]?.id) throw await machineRefusal(sql, data.id);
    const r = rows[0];
    return r.old_asset != null ? putBackLine(r.old_serial, r.old_origin, r.back > 0) : null;
  };

  if (!serialKey(serial)) {
    if (!machine && !model) throw new Error("Type the machine's serial, or pick its model.");
    await keepSerial(serial ? `Serial ${serial} isn't a serial a unit can have.` : null);
    return reload();
  }
  const hit = await findWarehouse(sql, serial);
  if (!hit) {
    const notice = refurb
      ? `Serial ${serial} isn't in the warehouse yet: it goes into stock when this refurb is completed.`
      : `Serial ${serial} not found in warehouse.`;
    const back = await keepSerial(notice);
    await logActivity(sql, userId, data.id, "serial-miss", [notice, back].filter(Boolean).join(" "));
    return reload();
  }
  const sameAccount =
    (hit.soldTo ?? "").trim().toLowerCase() === cur.account.trim().toLowerCase() ||
    // Warehouse: its two refurb accounts are one house (a shop refurb moved to Katz Coffee Service Dept. keeps its
    // unit), so a unit on either is already its own: no confirm, no ping.
    (isWarehouse(access) && warehouseMayEdit(hit.soldTo) && warehouseMayEdit(cur.account));
  // The machine's own unit, still on the rebuild: nothing to pull (and how it was before the pull is kept). One that
  // went somewhere else since is pulled again, with the confirm.
  if (machine && num(machine.asset_id) === hit.assetId && hit.status === "assigned" && hit.place.purpose === "In-house rebuild" && sameAccount) return reload();
  if (isWarehouse(access) && hit.held) {
    throw new Error(`Serial ${hit.serial} is waiting for an Admin to approve its ${hit.held === "assign" ? "assign to a customer" : "removal"}, so it stays where it is.`);
  }
  const elsewhere = (
    await sql.query<{ title: string }>(
      `select r.title from rebuild_machines m join rebuilds r on r.id = m.rebuild_id
        where m.asset_id = $1 and m.stocked_at is null and m.id is distinct from $2::int
          and not coalesce(r.archived, false) and r.status not in ('Completed', 'Cancelled')
        order by m.id limit 1`,
      [hit.assetId, machine?.id ?? null],
    )
  )[0];
  if (elsewhere) throw new Error(`Serial ${hit.serial} is on rebuild "${elsewhere.title}" already. Take it off that rebuild's machines first.`);
  // Locks first, so nobody is asked to confirm a pull that would be refused anyway. A sold unit or one a person locked
  // stays put; an assignment's own lock moves with the unit. Warehouse: a unit the owner locked on a customer's account
  // stays there too, as on the Warehouse page.
  const { assertAssetUnlocked, assertSerialUnlocked } = await import("@/lib/ops/equipment-lock");
  await assertAssetUnlocked(sql, hit.assetId, { release: true });
  if (isWarehouse(access)) await assertSerialUnlocked(sql, hit.serial);
  const where = unitWhere(hit.place);
  const question = `Serial ${hit.serial} is already assigned to ${where}.`;
  // Asked again when the answer was to a different question: the unit moved after the person was asked.
  const askedElse = !!data.confirmReuse && data.asked != null && !data.asked.includes(question);
  if (!hit.available && !sameAccount && (!data.confirmReuse || askedElse)) {
    if (machine) {
      const noted = await sql.query<{ id: number }>(
        `update rebuild_machines set notice = $3, updated_at = now() where id = $1 and rebuild_id = $2 and stocked_at is null and ${OPEN_STILL("$2", "$4")} returning id`,
        [machine.id, data.id, question, keys],
      );
      if (!noted.length) throw await machineRefusal(sql, data.id);
    }
    throw new Error(`${question} Confirm reuse or cancel.`);
  }
  const extra = !hit.available && hit.soldTo && !sameAccount ? ` (was ${hit.soldTo})` : "";
  const notice = `Serial ${hit.serial} pulled from warehouse · ${hit.model} · ${hit.location}${extra}`;
  // One statement: the rebuild and the machine are held, the unit moves onto the rebuild and the machine takes it (a
  // new machine is added for it), or nothing happens. A unit from another account leaves the install or ticket it was
  // on. A closed or removed rebuild's machine that still had the unit lets it go, and its record of how the unit was
  // before is kept.
  const pulled = await sql.query<{ id: number; old_asset: number | null; old_origin: unknown; old_serial: string | null }>(
    `with refurb as (
       select id from rebuilds where id = $5 and status not in ('Completed', 'Cancelled') and ${ACCOUNT_STILL("account", "$4")} for update
     ), mine as (
       select id, asset_id, origin, serial from rebuild_machines where id = $12::int and rebuild_id = $5 and stocked_at is null for update
     ), prior as (
       select status, sold_to, purpose, install_id, job_id, locked_at, locked_by, $2::text as pulled_to from assets where id = $1
     ), was as (
       select o.origin from rebuild_machines o
        where o.asset_id = $1 and o.id is distinct from $12::int and o.stocked_at is null and o.origin is not null
        order by o.id desc limit 1
     ), unit as (
       update assets set
         status = 'assigned',
         sold_to = $2,
         purpose = 'In-house rebuild',
         install_id = case when $10 then install_id else null end,
         job_id = case when $10 then job_id else null end,
         locked_at = now(),
         locked_by = $3,
         updated_at = now()
       where id = $1
         and exists (select 1 from refurb)
         and ($12::int is null or exists (select 1 from mine))
         and not exists (
           select 1 from rebuild_machines o join rebuilds r on r.id = o.rebuild_id
            where o.asset_id = $1 and o.stocked_at is null and o.id is distinct from $12::int
              and not coalesce(r.archived, false) and r.status not in ('Completed', 'Cancelled'))
         and ($4::text[] is null or (
               -- Warehouse: on no hold, just as it was read (so the Admins' ping says where it really came from), and
               -- not locked on a customer's account meanwhile.
               stock_hold is null
               and ${ASSET_STAMP} = $6
               and not exists (select 1 from account_equipment ae where ae.serial_key = $11 and ae.locked_at is not null)
             ))
       returning id
     ), released as (
       update rebuild_machines o set asset_id = null, notice = $13, updated_at = now()
        where o.asset_id = $1 and o.id is distinct from $12::int and o.stocked_at is null and exists (select 1 from unit)
       returning o.id
     ), saved as (
       update rebuild_machines set serial = $7, asset_id = $1, notice = $9, updated_at = now(),
              model = case when model = '' then $8 else model end,
              origin = coalesce((select origin || jsonb_build_object('pulled_to', $2::text) from was), (select to_jsonb(p) from prior p))
        where id = $12::int and exists (select 1 from unit)
       returning id
     ), added as (
       insert into rebuild_machines (rebuild_id, model, serial, asset_id, notice, origin)
       select $5, $8, $7, $1, $9, coalesce((select origin || jsonb_build_object('pulled_to', $2::text) from was), (select to_jsonb(p) from prior p))
        where $12::int is null and exists (select 1 from unit)
       returning id
     )
     select coalesce((select id from saved), (select id from added)) as id,
            (select asset_id from mine) as old_asset, (select origin from mine) as old_origin, (select serial from mine) as old_serial`,
    [
      hit.assetId,
      cur.account,
      LOCKED_BY_ASSIGNED,
      keys,
      data.id,
      hit.stamp,
      hit.serial,
      model || hit.model,
      notice,
      sameAccount,
      serialKey(hit.serial),
      machine?.id ?? null,
      `Serial ${hit.serial} moved to rebuild "${cur.title}".`,
    ],
  );
  if (!pulled[0]?.id) {
    const now = (await sql.query<{ account: string; status: string }>("select account, status from rebuilds where id = $1", [data.id]))[0];
    if (!now) throw new Error("Rebuild not found");
    if (CLOSED_REBUILD.has(now.status as RebuildStatus) || (isWarehouse(access) && !warehouseMayEdit(now.account))) throw await machineRefusal(sql, data.id);
    if (machine && !(await machineRow(sql, data.id, machine.id))) throw new Error("That machine isn't on this rebuild any more. Open the rebuild again.");
    if (!isWarehouse(access)) throw new Error(`Serial ${hit.serial} is no longer in the warehouse records, or another rebuild took it, so it wasn't pulled.`);
    throw new Error(`Serial ${hit.serial} was just moved, locked, put on hold or taken by another rebuild, so it wasn't pulled. Pull it again.`);
  }
  // The machine's old unit, if it had another one, goes back as it was.
  const old = pulled[0];
  let back: string | null = null;
  if (old.old_asset != null && Number(old.old_asset) !== hit.assetId) {
    const done = await sql.query<{ id: number }>(PUT_BACK, [old.old_asset, old.old_origin == null ? null : JSON.stringify(old.old_origin)]);
    back = putBackLine(old.old_serial, old.old_origin, done.length > 0);
  }
  await logActivity(sql, userId, data.id, "assigned-asset", [notice, back].filter(Boolean).join(" "));
  // Warehouse's pull goes through on its own, and every Admin hears where the unit came from. A unit already on the
  // refurb's account (on this refurb, or another of its refurbs) came from no one, so that one doesn't ping.
  if (isWarehouse(access) && !sameAccount) {
    const listed = (
      await sql
        .query<{ customer: string }>(
          `select customer from account_equipment
            where coalesce(nullif(serial_key, ''), lower(regexp_replace(coalesce(serial, ''), '[#[:space:]]', '', 'g'))) = $1
              and lower(btrim(customer)) <> lower(btrim($2))
            order by id limit 1`,
          [serialKey(hit.serial), cur.account],
        )
        .catch(() => [])
    )[0]?.customer;
    await notifyAdminsWarehousePull(sql, userId, {
      rebuildId: data.id,
      account: cur.account,
      body: pullNotice(access.username, { model: hit.model, serial: hit.serial }, where, cur.title, listed ?? null),
    }).catch((e) => console.error("[rebuilds] the Admins' pull ping failed", e));
  }
  return reload();
}

/** A serial on the rebuild's first machine (a new one when it has none), as the one serial a rebuild had before 11/2. */
export async function pullRebuildSerialFor(
  sql: Sql,
  data: { id: number; serial: string; confirmReuse?: boolean; asked?: string },
  userId: string,
): Promise<Rebuild> {
  const first = (await sql.query<{ id: number }>("select id from rebuild_machines where rebuild_id = $1 and stocked_at is null order by id limit 1", [data.id]))[0];
  return pullRebuildMachineFor(sql, { ...data, machineId: first ? Number(first.id) : null }, userId);
}

const removeInput = z.object({ id: z.number(), machineId: z.number() });

export const removeRebuildMachine = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof removeInput>) => removeInput.parse(d))
  .handler(async ({ data, context }): Promise<{ rebuild: Rebuild; message: string | null }> => removeRebuildMachineFor(await readySql(), data, context.userId));

/**
 * The body of removeRebuildMachine: the machine comes off the rebuild, and its unit goes back as it was before the
 * pull, in the same statement (so nobody pulls it in between). A machine in stock stays. A cancelled rebuild's
 * machines can still come off, to put their units back.
 */
export async function removeRebuildMachineFor(sql: Sql, data: z.infer<typeof removeInput>, userId: string): Promise<{ rebuild: Rebuild; message: string | null }> {
  const access = await requireEditor(sql, userId);
  const cur = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0];
  if (!cur) throw new Error("Rebuild not found");
  requireRowEditor(access, cur.account);
  if (cur.status === "Completed") throw new Error("This rebuild is Completed, so its machines can't change. Set it back to In progress first.");
  const machine = await machineRow(sql, data.id, data.machineId);
  if (!machine) throw new Error("That machine isn't on this rebuild any more. Open the rebuild again.");
  if (machine.stocked_at) throw new Error("That machine is in stock already, so it stays on the rebuild.");
  const rows = await sql.query<{ id: number; model: string; serial: string | null; asset_id: number | null; origin: unknown; back: number }>(
    `with gone as (
       delete from rebuild_machines m
        where m.id = $1 and m.rebuild_id = $2 and m.stocked_at is null
          and exists (select 1 from rebuilds r where r.id = $2 and r.status <> 'Completed' and ${ACCOUNT_STILL("r.account", "$3")})
       returning m.id, m.model, m.serial, m.asset_id, m.origin
     ), back as (
       ${PUT_BACK.replace("where a.id = $1", "where a.id = (select asset_id from gone)").replace("$2::jsonb", "(select origin from gone)")}
     )
     select g.id, g.model, g.serial, g.asset_id, g.origin, (select count(*)::int from back) as back from gone g`,
    [data.machineId, data.id, warehouseKeys(access)],
  );
  const gone = rows[0];
  if (!gone) {
    if (!(await machineRow(sql, data.id, data.machineId))) throw new Error("That machine isn't on this rebuild any more. Open the rebuild again.");
    throw await machineRefusal(sql, data.id);
  }
  const message = gone.asset_id != null ? putBackLine(gone.serial, gone.origin, gone.back > 0) : null;
  const label = `${gone.model?.trim() || "Machine"}${gone.serial?.trim() ? ` SN ${gone.serial.trim()}` : ""}`;
  await logActivity(sql, userId, data.id, "updated", [`removed machine ${label}`, message].filter(Boolean).join(" · "));
  const row = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0]!;
  return { rebuild: await rebuildOut(sql, row), message };
}

/**
 * A completed refurb's machines go into stock at the Staging area (Chuy, 11/2), marked needs shop test, with no Admin
 * review. A machine's pulled unit moves there off the refurb; a machine whose serial is on the stock list with
 * nobody's name on it moves that unit; any other machine is added to the stock list. A machine already in stock is
 * left alone, and so is a unit someone moved since it was pulled. Returns a line for the person who completed it.
 */
async function stockRefurbMachines(sql: Sql, rebuild: RebuildRow, userId: string): Promise<string | null> {
  const machines = await sql.query<MachineRow>("select * from rebuild_machines where rebuild_id = $1 and stocked_at is null order by id", [rebuild.id]);
  if (!machines.length) return null;
  const who = await deskUsername(sql, userId);
  const now = new Date();
  const when = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }).format(now);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" }).format(now);
  const inStock = `In stock at the ${REFURB_STOCK_PLACE} since ${day}, needs shop test.`;
  const moveLine = `Moved from rebuild "${rebuild.title}" to ${REFURB_STOCK_PLACE} · ${who} · ${when}`;
  const addLine = `Added to stock from rebuild "${rebuild.title}" at the ${REFURB_STOCK_PLACE} · ${who} · ${when}`;
  const purpose = SITE_PURPOSE[HOUSE_STAGING] ?? REFURB_STOCK_PLACE;
  const done: string[] = [];
  const left: string[] = [];
  for (const m of machines) {
    const label = `${m.model?.trim() || "Machine"}${m.serial?.trim() ? ` SN ${m.serial.trim()}` : ""}`;
    let assetId = num(m.asset_id);
    const pulled = assetId != null;
    if (!pulled && serialKey(m.serial ?? "")) {
      const hit = await findWarehouse(sql, m.serial ?? "");
      if (hit) assetId = hit.assetId;
    }
    if (assetId != null) {
      // Its unit: pulled onto this refurb and still on it, or on the stock list with nobody's name on it.
      const moved = await sql.query<{ id: number }>(
        `with mine as (select id from rebuild_machines where id = $1 and stocked_at is null for update),
         unit as (
           update assets set status = 'deployed', site = $7, pallet = null, level = null, line_no = null, sold_to = null,
                  purpose = $8, install_id = null, job_id = null, locked_at = null, locked_by = null,
                  shop_test = 'needs-test', shop_test_note = null, shop_test_by = $4, shop_test_at = now(),
                  notes = concat_ws(E'\\n', nullif(btrim(coalesce(notes, '')), ''), $5::text), updated_at = now()
            where id = $2 and exists (select 1 from mine)
              and (($9 and status = 'assigned' and purpose = 'In-house rebuild' and ${NAME_KEY("sold_to")} = any($3::text[]))
                   or (not $9 and status in ('ready', 'deployed') and coalesce(btrim(sold_to), '') = '' and install_id is null
                       and job_id is null and stock_hold is null and locked_at is null))
           returning id
         )
         update rebuild_machines set asset_id = $2, stocked_at = now(), notice = $6, updated_at = now()
          where id = $1 and exists (select 1 from unit)
         returning id`,
        [m.id, assetId, [...WAREHOUSE_ACCOUNT_KEYS], who, moveLine, inStock, HOUSE_STAGING, purpose, pulled],
      );
      if (moved.length) {
        await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('asset', $1, $2, 'moved', $3)", [assetId, who, moveLine]);
        done.push(label);
        continue;
      }
      const place = (await sql.query<{ site: string; pallet: string | null; level: number | null; status: string; sold_to: string | null; purpose: string | null; install_id: number | null; job_id: number | null }>(
        "select site, pallet, level, status, sold_to, purpose, install_id, job_id from assets where id = $1",
        [assetId],
      ))[0];
      const why = place
        ? `${label} wasn't put in stock: its unit is on ${unitWhere({ site: place.site, pallet: place.pallet, level: num(place.level), status: place.status, soldTo: place.sold_to, purpose: place.purpose, installId: num(place.install_id), jobId: num(place.job_id) })} now.`
        : `${label} wasn't put in stock: its unit is no longer on the stock list.`;
      left.push(why);
      await sql.query("update rebuild_machines set notice = $2, updated_at = now() where id = $1 and stocked_at is null", [m.id, why]);
      continue;
    }
    const made = await sql.query<{ asset_id: number }>(
      `with mine as (select id from rebuild_machines where id = $1 and stocked_at is null for update),
       unit as (
         insert into assets (kind, model, serial, qty, site, status, purpose, shop_test, shop_test_by, shop_test_at, notes, updated_at)
         select 'equip', $2, $3, 1, $7, 'deployed', $8, 'needs-test', $4, now(), $5, now() from mine
         returning id
       )
       update rebuild_machines set asset_id = (select id from unit), stocked_at = now(), notice = $6, updated_at = now()
        where id = $1 and exists (select 1 from unit)
       returning asset_id`,
      [m.id, m.model.trim(), m.serial?.trim() || null, who, addLine, inStock, HOUSE_STAGING, purpose],
    );
    if (made[0]) {
      await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('asset', $1, $2, 'added', $3)", [made[0].asset_id, who, addLine]);
      done.push(label);
    }
  }
  if (done.length) await logActivity(sql, userId, Number(rebuild.id), "stocked", `Into stock at the ${REFURB_STOCK_PLACE}: ${done.join(", ")}`.slice(0, 500));
  return stockedLine(done.length, left);
}

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
    // Each sample's machine goes on its machine list too (11/2).
    await sql.query(
      `with made as (
         insert into rebuilds (
           title, account, equipment, serial, owner, status, reason_code, reason_detail,
           planned_start, target_complete, actual_start, actual_complete, priority, notes,
           status_changed_at, created_at, updated_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
           $15::timestamptz, $16::timestamptz, now()
         )
         returning id, equipment, serial
       )
       insert into rebuild_machines (rebuild_id, model, serial)
       select id, coalesce(equipment, ''), serial from made where equipment is not null or serial is not null`,
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
