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
import { sentPo } from "@/lib/ops/ticket-po";

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
  /** The customer's P.O., which goes on the rebuild's invoice, and a vendor's, for reference only (11/2). */
  po: string | null;
  vendorPo: string | null;
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
  po?: string | null;
  vendor_po?: string | null;
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

/** SQL: a name with letters and digits only, as the account rules match it. */
const NAME_KEY = (col: string) => `regexp_replace(lower(coalesce(${col}, '')), '[^a-z0-9]+', '', 'g')`;

/** SQL: the Warehouse's two refurb accounts as name keys (a fixed list from the code, never input). */
const HOUSE_KEYS = `array[${WAREHOUSE_ACCOUNT_KEYS.map((k) => `'${k.replace(/'/g, "''")}'`).join(", ")}]::text[]`;

/** SQL: two account names are the same account; the Warehouse's two refurb accounts count as one house. */
const SAME_ACCOUNT = (x: string, y: string) =>
  `(${NAME_KEY(x)} = ${NAME_KEY(y)} or (${NAME_KEY(x)} = any(${HOUSE_KEYS}) and ${NAME_KEY(y)} = any(${HOUSE_KEYS})))`;

/** SQL: a serial as serialKey() reads it, which is how account units are keyed too. */
const SERIAL_KEY = (col: string) => `lower(regexp_replace(btrim(coalesce(${col}, '')), '[#[:space:]]', '', 'g'))`;

/**
 * SQL: machine `m` (any row or CTE with the machine's id, asset_id, pulled_at and stocked_at) holds its unit (11/2
 * review): the unit is still as a pull left it (assigned, In-house rebuild, on `acct`, the account of m's rebuild),
 * and no machine pulled it later onto a rebuild on that account. A machine whose unit went somewhere else since (an
 * install, a sale, the rack, another refurb) holds nothing: it stops no pull, and is neither put back nor stocked.
 */
const HOLDS = (m: string, acct: string) => `exists (
    select 1 from assets ha
     where ha.id = ${m}.asset_id and ${m}.stocked_at is null
       and ha.status = 'assigned' and ha.purpose = 'In-house rebuild' and ${SAME_ACCOUNT("ha.sold_to", acct)}
       and not exists (
         select 1 from rebuild_machines hn join rebuilds hr on hr.id = hn.rebuild_id
          where hn.asset_id = ha.id and hn.id <> ${m}.id and hn.stocked_at is null and ${SAME_ACCOUNT("hr.account", "ha.sold_to")}
            and (coalesce(hn.pulled_at, '-infinity'::timestamptz), hn.id) > (coalesce(${m}.pulled_at, '-infinity'::timestamptz), ${m}.id)))`;

/** SQL: nobody locked unit `a`: no lock but an assignment's own (as Return lets through). */
const UNLOCKED = (a: string) => `(${a}.locked_at is null or coalesce(${a}.locked_by, '') like 'System (assigned%')`;

/** SQL: the owner locked unit `a`'s serial on a customer's account, which keeps the unit in its place too. */
const ACCOUNT_LOCKED = (a: string) =>
  `exists (select 1 from account_equipment ae where ${SERIAL_KEY(`${a}.serial`)} <> '' and ae.serial_key = ${SERIAL_KEY(`${a}.serial`)} and ae.locked_at is not null)`;

/** SQL: whoever locked unit `a`, or its serial on an account. */
const LOCKED_BY = (a: string) =>
  `case when not ${UNLOCKED(a)} then ${a}.locked_by
        else (select ae.locked_by from account_equipment ae where ${SERIAL_KEY(`${a}.serial`)} <> '' and ae.serial_key = ${SERIAL_KEY(`${a}.serial`)} and ae.locked_at is not null order by ae.id limit 1) end`;

/** SQL: rack lines in a section, and the place a unit goes when its section is full. */
const RACK_LINES = 12;
const STAGING_SQL = `'${HOUSE_STAGING}'`;
const STAGING_PURPOSE_SQL = `'${(SITE_PURPOSE[HOUSE_STAGING] ?? REFURB_STOCK_PLACE).replace(/'/g, "''")}'`;

/**
 * SQL CTEs that put a machine's unit back as it was before the pull (11/2): its status, account, purpose, install,
 * ticket and lock. `m` is a CTE with the machine's id, rebuild_id, asset_id, origin, pulled_at and stocked_at as they
 * were before the statement; `when` is one more condition. Only while the machine holds the unit and nobody locked it
 * or its serial. A unit going back to a rack line another unit took meanwhile gets a free line in that section, or
 * goes to the Staging area when the section is full. `${name}_chk` says what happened (why: ok, moved, locked,
 * account-locked, gone, kept for a machine from before machines were kept, none, skip; lock_by), and `${name}`
 * returns (id, staged) for the unit put back.
 */
function putBackSql(name: string, m: string, when = "true"): string {
  const taken = (line: string) =>
    `exists (select 1 from assets b where b.id <> p.id and b.site = p.site and upper(b.pallet) = upper(p.pallet) and b.level = p.level
                and b.line_no = ${line} and b.status in ('ready', 'deployed'))`;
  return `${name}_chk as (
       select pm.asset_id, pm.origin,
              case when pm.asset_id is null then 'none'
                   when ua.id is null then 'gone'
                   when pm.origin is null then 'kept'
                   when not ${HOLDS("pm", "(select pr.account from rebuilds pr where pr.id = pm.rebuild_id)")} then 'moved'
                   when not ${UNLOCKED("ua")} then 'locked'
                   when ${ACCOUNT_LOCKED("ua")} then 'account-locked'
                   when not (${when}) then 'skip'
                   else 'ok' end as why,
              ${LOCKED_BY("ua")} as lock_by
         from ${m} pm
         left join assets ua on ua.id = pm.asset_id
     ), ${name}_at as (
       select ua.id, ua.site, ua.pallet, ua.level, ua.line_no, o.status, o.sold_to, o.purpose, o.install_id, o.job_id, o.locked_at, o.locked_by
         from ${name}_chk c
         join assets ua on ua.id = c.asset_id
        cross join lateral jsonb_to_record(c.origin) as o(status text, sold_to text, purpose text, install_id int, job_id int,
                                                          locked_at timestamptz, locked_by text)
        where c.why = 'ok'
     ), ${name}_line as (
       select p.id, q.racked, case when not q.racked or not q.own_taken then p.line_no else q.first_free end as line_no,
              (q.racked and q.own_taken and q.first_free is null) as staged
         from ${name}_at p
        cross join lateral (
          select (p.pallet is not null and p.level is not null and p.line_no is not null and p.status in ('ready', 'deployed')) as racked,
                 ${taken("p.line_no")} as own_taken,
                 (select min(n) from generate_series(1, ${RACK_LINES}) n where not ${taken("n")}) as first_free
        ) q
     ), ${name} as (
       update assets a set
              status = case when l.staged then 'deployed' else p.status end,
              sold_to = p.sold_to,
              purpose = case when l.staged then ${STAGING_PURPOSE_SQL} else p.purpose end,
              install_id = p.install_id, job_id = p.job_id, locked_at = p.locked_at, locked_by = p.locked_by,
              site = case when l.staged then ${STAGING_SQL} else a.site end,
              pallet = case when l.staged then null else a.pallet end,
              level = case when l.staged then null else a.level end,
              line_no = l.line_no,
              updated_at = now()
         from ${name}_at p join ${name}_line l on l.id = p.id
        where a.id = p.id
       returning a.id, l.staged
     )`;
}

/** What putBackSql's statement said about the unit of the machine that changed. */
type PutBack = { old_serial: string | null; why: string | null; staged: boolean | null; lock_by: string | null };

/** The columns a statement with putBackSql returns as PutBack. */
const PUT_BACK_OUT = (name: string, m: string) =>
  `(select serial from ${m} limit 1) as old_serial, (select why from ${name}_chk limit 1) as why,
   (select staged from ${name} limit 1) as staged, (select lock_by from ${name}_chk limit 1) as lock_by`;

/** What the person is told about a machine's unit when the machine is taken off or its serial changes. */
function putBackLine(b: PutBack | undefined): string | null {
  if (!b?.why || b.why === "none" || b.why === "skip") return null;
  const sn = b.old_serial?.trim() ? `SN ${b.old_serial.trim()}` : "Its unit";
  if (b.why === "ok" && b.staged) return `${sn} went to the ${REFURB_STOCK_PLACE}: its rack section filled up while it was pulled.`;
  if (b.why === "ok") return `${sn} is back where it was before it was pulled.`;
  if (b.why === "kept") return `${sn} stays as it is (pulled before machines were kept); move it from the Warehouse page if it isn't on this refurb.`;
  if (b.why === "locked" || b.why === "account-locked") return `${sn} is locked by ${b.lock_by?.trim() || "the owner"}, so it stays where it is.`;
  if (b.why === "gone") return `${sn} is no longer in the warehouse records.`;
  return `${sn} was moved since it was pulled, so it stays where it is now.`;
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
  pulled_at?: string | Date | null;
  migrated?: boolean | null;
  stocked_at: string | Date | null;
};

/** A machine as the board reads it: whether it still holds its unit, and where that unit is. */
type MachineRead = MachineRow & {
  held: boolean | null;
  a_id: number | null;
  a_site: string | null;
  a_pallet: string | null;
  a_level: number | null;
  a_status: string | null;
  a_sold_to: string | null;
  a_purpose: string | null;
  a_install_id: number | null;
  a_job_id: number | null;
  holder: string | null;
};

/** Where a machine's unit is now, when the unit went somewhere else since it was pulled (null while it holds it). */
function movedLine(r: MachineRead): string | null {
  if (r.stocked_at || r.asset_id == null || r.held) return null;
  if (r.a_id == null) return "Its unit is no longer in the warehouse records.";
  if (r.holder) return `Its unit is on rebuild "${r.holder}" now.`;
  const where = unitWhere({
    site: r.a_site ?? "",
    pallet: r.a_pallet,
    level: num(r.a_level),
    status: r.a_status ?? "",
    soldTo: r.a_sold_to,
    purpose: r.a_purpose,
    installId: num(r.a_install_id),
    jobId: num(r.a_job_id),
  });
  return `Its unit isn't on this rebuild now: it's on ${where}.`;
}

function mapMachine(r: MachineRow & Partial<MachineRead>): RebuildMachine {
  return {
    id: Number(r.id),
    model: r.model ?? "",
    serial: r.serial?.trim() || null,
    assetId: num(r.asset_id),
    notice: r.notice?.trim() || null,
    stockedAt: r.stocked_at ? stamp(r.stocked_at) : null,
    moved: r.held === undefined ? null : movedLine(r as MachineRead),
  };
}

/** Each rebuild's machines, oldest first, with where each one's unit is when it isn't on the rebuild any more. */
async function loadMachines(sql: Sql, ids: number[]): Promise<Map<number, RebuildMachine[]>> {
  const out = new Map<number, RebuildMachine[]>();
  if (!ids.length) return out;
  const rows = await sql.query<MachineRead>(
    `select m.*, ${HOLDS("m", "r.account")} as held,
            a.id as a_id, a.site as a_site, a.pallet as a_pallet, a.level as a_level, a.status as a_status,
            a.sold_to as a_sold_to, a.purpose as a_purpose, a.install_id as a_install_id, a.job_id as a_job_id,
            (select r2.title from rebuild_machines o join rebuilds r2 on r2.id = o.rebuild_id
              where m.asset_id is not null and o.asset_id = m.asset_id and o.id <> m.id and ${HOLDS("o", "r2.account")}
              limit 1) as holder
       from rebuild_machines m
       join rebuilds r on r.id = m.rebuild_id
       left join assets a on a.id = m.asset_id
      where m.rebuild_id = any($1::int[])
      order by m.rebuild_id, m.id`,
    [ids],
  );
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

/**
 * The rebuild's one-machine columns become a machine (11/2 review). Migration 0111 copied them into machines and emptied
 * them, so anything in them now was written by the site as it was before machines, while the publish built. A value
 * for a machine it already has (its serial, or its model) fills that machine in; anything else is a new machine. All
 * in one statement, so nothing is emptied without its machine.
 */
const ADOPT_LEGACY = `
  with legacy as (
    select id, coalesce(btrim(equipment), '') as model, nullif(btrim(coalesce(serial, '')), '') as serial, asset_id,
           nullif(btrim(coalesce(serial_notice, '')), '') as notice
      from rebuilds
     where id = $1 and (equipment is not null or serial is not null or asset_id is not null or serial_notice is not null)
     for update
  ), target as (
    select m.id from rebuild_machines m, legacy l
     where m.rebuild_id = l.id and m.stocked_at is null
       and ((l.serial is not null and ${SERIAL_KEY("m.serial")} = ${SERIAL_KEY("l.serial")})
            or (l.serial is null and l.asset_id is null and l.model <> '' and lower(btrim(m.model)) = lower(l.model))
            or (m.serial is null and m.asset_id is null and (l.model = '' or m.model = '' or lower(btrim(m.model)) = lower(l.model))))
     order by (l.serial is not null and ${SERIAL_KEY("m.serial")} = ${SERIAL_KEY("l.serial")}) desc, m.id
     limit 1
  ), merged as (
    update rebuild_machines m set
       model = case when m.model = '' then l.model else m.model end,
       serial = coalesce(m.serial, l.serial),
       asset_id = coalesce(l.asset_id, m.asset_id),
       pulled_at = case when l.asset_id is not null and l.asset_id is distinct from m.asset_id then now() else m.pulled_at end,
       origin = case when l.asset_id is not null and l.asset_id is distinct from m.asset_id then null else m.origin end,
       notice = coalesce(l.notice, m.notice),
       updated_at = now()
      from legacy l
     where m.id = (select id from target)
    returning m.id
  ), added as (
    insert into rebuild_machines (rebuild_id, model, serial, asset_id, notice, pulled_at, migrated)
    select l.id, l.model, l.serial, l.asset_id, l.notice, case when l.asset_id is not null then now() end, true
      from legacy l
     where not exists (select 1 from target) and (l.model <> '' or l.serial is not null or l.asset_id is not null)
    returning id
  )
  update rebuilds r set equipment = null, serial = null, asset_id = null, serial_notice = null
    from legacy l
   where r.id = l.id
  returning r.id`;

/** Picks up what the site before machines wrote on these rebuilds (all of them when `ids` is left out). Never throws. */
async function adoptLegacy(sql: Sql, ids?: number[]): Promise<void> {
  try {
    const rows = await sql.query<{ id: number }>(
      `select id from rebuilds
        where (equipment is not null or serial is not null or asset_id is not null or serial_notice is not null)
          ${ids ? "and id = any($1::int[])" : ""}
        order by id limit 200`,
      ids ? [ids] : [],
    );
    for (const r of rows) await sql.query(ADOPT_LEGACY, [Number(r.id)]);
  } catch (e) {
    console.error("[rebuilds] picking up a rebuild's one-machine columns failed", e);
  }
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
    // The machines are the rebuild's equipment now (11/2); the old one-machine columns were copied into them. A rebuild
    // with none that still has them (written while the publish built, and not picked up yet) shows those.
    equipment: machines.length ? machinesLabel(machines) : r.equipment?.trim() || null,
    serial: machines.length ? machineSerials(machines) : r.serial?.trim() || null,
    assetId: machines.length ? (machines.find((m) => m.assetId != null)?.assetId ?? null) : num(r.asset_id),
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
    po: String(r.po ?? "").trim() || null,
    vendorPo: String(r.vendor_po ?? "").trim() || null,
    installId: num(r.install_id),
    jobId: num(r.job_id),
    serialNotice: machines.length ? (machines[0]?.notice ?? null) : r.serial_notice?.trim() || null,
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
  await adoptLegacy(sql);
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
  /** Sent only when changed on the Details tab (11/2); left out keeps the stored one, blank clears it. */
  po: z.string().max(400).nullable().optional(),
  vendorPo: z.string().max(400).nullable().optional(),
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
  // The equipment picked is its first machine (11/2), not the rebuild's old one-machine column. A serial is pulled onto
  // a machine afterwards, by its own rules.
  const rows = await sql.query<RebuildRow>(
    `with made as (
       insert into rebuilds (
         title, account, owner, status, reason_code, reason_detail,
         planned_start, target_complete, actual_start, priority, notes
       ) values ($1,$2,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *
     ), first as (
       insert into rebuild_machines (rebuild_id, model) select id, $3::text from made where $3::text is not null returning id
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
    ],
  );
  const row = rows[0]!;
  await logActivity(sql, userId, Number(row.id), "opened", `${row.title} · ${row.account}`);
  // A refurb made as Completed puts its machine in stock straight away, as completing it later would (11/2 review).
  const stockNote = row.status === "Completed" && warehouseMayEdit(row.account) ? await stockRefurbMachines(sql, row, userId) : null;
  return { ...(await rebuildOut(sql, row)), stockNote };
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
  const po = sentPo(data.po, "Customer P.O.");
  const vendorPo = sentPo(data.vendorPo, "Vendor P.O.");
  const access = await requireEditor(sql, userId);
  await ensureRebuilds(sql);
  // What the site before machines wrote on it becomes a machine first, so completing it stocks that too.
  await adoptLegacy(sql, [data.id]);
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

  // A unit the owner locked stays on its account, so the rebuild holding it stays there too (11/2 review, round 3).
  const nameKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const accountMoves = nameKey(nextAccount) !== nameKey(cur.account) && !(warehouseMayEdit(nextAccount) && warehouseMayEdit(cur.account));
  const accountLock = accountMoves ? await rebuildHeldLock(sql, data.id) : null;
  if (accountLock) throw await lockedUnitRefusal(sql, accountLock, "this rebuild stays on its account while it has it");
  // Linked to a ticket or an install (11/6), it bills there, so its account is that project's: a save never moves it
  // elsewhere (a sheet opened before the link would put the old one back). Unlink it first.
  if (accountMoves && (cur.install_id != null || cur.job_id != null)) {
    const project = await linkedProjectAccount(sql, cur);
    if (!project || nameKey(project.customer) !== nameKey(nextAccount)) {
      throw new Error(
        `This rebuild is linked to ${project?.label ?? "a ticket or an install"}, so its account follows that one's${project?.customer ? ` (${project.customer})` : ""}. Unlink it on Details to change the account.`,
      );
    }
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

  // The rebuild's old one-machine columns aren't written any more (11/2): its machines are its equipment.
  const rows = await sql.query<RebuildRow>(
    `update rebuilds set
       title = $2,
       account = $3,
       owner = $4,
       status = $5,
       reason_code = $6,
       reason_detail = $7,
       planned_start = $8,
       target_complete = $9,
       actual_start = $10,
       actual_complete = $11,
       priority = $12,
       notes = $13,
       status_changed_at = case when $16 then now() else status_changed_at end,
       -- Only a P.O. the save sent (11/2): one left out stays as the row has it now (the Invoice window may have just set it).
       po = case when $18::boolean then $19::text else po end,
       vendor_po = case when $20::boolean then $21::text else vendor_po end,
       updated_at = now()
     where id = $1 and ${ACCOUNT_STILL("account", "$17")} and not ${LOCKED_UNIT_MOVES("rebuilds", "$3::text")}
       -- Still linked as read: Link and Unlink (rebuild-link-api.ts) are its own writes, never undone by a save.
       and install_id is not distinct from $14::int and job_id is not distinct from $15::int
     returning *`,
    [
      data.id,
      nextTitle,
      nextAccount || SHOP_ACCOUNT,
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
      cur.install_id,
      cur.job_id,
      statusChanged,
      warehouseKeys(access),
      po !== undefined,
      po ?? null,
      vendorPo !== undefined,
      vendorPo ?? null,
    ],
  );
  const row = rows[0];
  if (!row) {
    const now = (await sql.query<{ account: string }>("select account from rebuilds where id = $1", [data.id]))[0];
    const lock = now && accountMoves ? await rebuildHeldLock(sql, data.id) : null;
    if (lock) throw await lockedUnitRefusal(sql, lock, "this rebuild stays on its account while it has it");
    throw await movedRefusal(sql, data.id);
  }
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
  // The P.O.s get a line of their own, so four other changes never crowd them out of the history.
  const poLine = [changed("Customer P.O.", cur.po ?? null, row.po ?? null), changed("Vendor P.O.", cur.vendor_po ?? null, row.vendor_po ?? null)].filter(Boolean).join(" · ");
  const accountNote = changed("account", cur.account, row.account);
  if (accountNote) {
    parts.push(accountNote);
    await moveHeldUnits(sql, data.id, row.account, cur.account);
  }
  if (parts.length) {
    const action = statusChanged ? "status" : parts.some((p) => p.startsWith("reason") || p.startsWith("kept")) ? "reason" : "updated";
    await logActivity(sql, userId, data.id, action, parts.slice(0, 4).join(" · "));
  }
  if (poLine) await logActivity(sql, userId, data.id, "updated", poLine);
  // Completed just now, on a refurb: its machines go into stock at the Staging area.
  const stockNote = row.status === "Completed" && cur.status !== "Completed" && warehouseMayEdit(row.account) ? await stockRefurbMachines(sql, row, userId) : null;
  return { ...(await rebuildOut(sql, row)), stockNote };
}

/**
 * Its pulled units go with the rebuild to its new account (a shop refurb billed to Katz Coffee Service Dept., or a
 * rebuild linked to a customer's ticket or install), and so does each machine's record of whom the pull put the unit
 * on: only units its machines still hold on the old account, and only while the rebuild is still on the new one (an
 * Admin's change since stands).
 */
export async function moveHeldUnits(sql: Sql, rebuildId: number, account: string, previous: string): Promise<void> {
  await sql.query(
    `with moved as (
       update assets a set sold_to = $2, updated_at = now()
         from rebuild_machines m
        where m.rebuild_id = $1 and m.asset_id = a.id and ${HOLDS("m", "$3::text")}
          and exists (select 1 from rebuilds r where r.id = $1 and r.account = $2)
       returning a.id
     )
     update rebuild_machines set origin = jsonb_set(origin, '{pulled_to}', to_jsonb($2::text)), updated_at = now()
      where rebuild_id = $1 and origin is not null and ${NAME_KEY("origin->>'pulled_to'")} = ${NAME_KEY("$3")}
        and exists (select 1 from rebuilds r where r.id = $1 and r.account = $2)`,
    [rebuildId, account, previous],
  );
}

/** The account of the ticket or install a rebuild is linked to, and how to name it; null when it is gone. */
async function linkedProjectAccount(sql: Sql, r: { install_id: number | null; job_id: number | null }): Promise<{ customer: string; label: string } | null> {
  if (r.install_id != null) {
    const i = (await sql.query<{ customer: string | null; wo: string | null }>("select customer, wo from installs where id = $1", [r.install_id]))[0];
    return i ? { customer: String(i.customer ?? "").trim(), label: `install #${r.install_id}${i.wo?.trim() ? ` (${i.wo.trim()})` : ""}` } : null;
  }
  const j = (await sql.query<{ customer: string | null; wo: string | null; call_id: string | null }>("select customer, wo, call_id from service_jobs where id = $1", [r.job_id]))[0];
  return j ? { customer: String(j.customer ?? "").trim(), label: `ticket ${j.call_id?.trim() || `#${r.job_id}`}${j.wo?.trim() ? ` (${j.wo.trim()})` : ""}` } : null;
}

/** For Link (rebuild-link-api.ts): who may link a rebuild, the row as the board maps it, and the unit-lock rules. */
export async function requireRebuildEditor(sql: Sql, userId: string): Promise<{ warehouse: boolean; username: string }> {
  const access = await requireEditor(sql, userId);
  return { warehouse: isWarehouse(access), username: access.username };
}

export async function rebuildRowOut(sql: Sql, id: number): Promise<Rebuild | null> {
  const row = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [id]))[0];
  return row ? rebuildOut(sql, row) : null;
}

/** SQL: rebuild `r` (id and account) holds a unit the owner locked, and `acct` is another account. */
export const lockedUnitMovesSql = (r: string, acct: string) => LOCKED_UNIT_MOVES(r, acct);

/** The sentence a locked unit gives when the rebuild's account would change, or null when none of its units is locked. */
export async function heldUnitLockSentence(sql: Sql, rebuildId: number): Promise<string | null> {
  const lock = await rebuildHeldLock(sql, rebuildId);
  return lock ? (await lockedUnitRefusal(sql, lock, "this rebuild stays on its account while it has it")).message : null;
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
  await adoptLegacy(sql, [data.id]);
  const list = data.machines.map((m) => ({ id: m.id ?? null, model: m.model.trim() }));
  const rows = await sql.query<{ ok: boolean; added: number; changed: number }>(
    `with ok as (select ${OPEN_STILL("$1", "$3")} as ok),
     changed as (
       update rebuild_machines m set model = x.model, migrated = false, updated_at = now()
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

/** The machine (with its rebuild) that holds a unit now, or null: the one place the unit is on a rebuild. */
type Holder = { id: number; rebuild_id: number; title: string; account: string; status: string; archived: boolean; n: number };

async function unitHolder(sql: Sql, assetId: number): Promise<Holder | null> {
  const rows = await sql.query<Holder>(
    `select o.id, o.rebuild_id, r.title, r.account, r.status, coalesce(r.archived, false) as archived,
            (select count(*)::int from rebuild_machines x where x.rebuild_id = o.rebuild_id and x.id <= o.id) as n
       from rebuild_machines o join rebuilds r on r.id = o.rebuild_id
      where o.asset_id = $1 and ${HOLDS("o", "r.account")}
      order by coalesce(o.pulled_at, '-infinity'::timestamptz) desc, o.id desc
      limit 1`,
    [assetId],
  );
  const h = rows[0];
  return h ? { ...h, id: Number(h.id), rebuild_id: Number(h.rebuild_id), n: Number(h.n) } : null;
}

/**
 * Another machine on an open rebuild with this serial typed and no unit pulled (11/2 review: one serial, one machine),
 * or null. A machine with a unit is the holder rules' (unitHolder) instead, so a machine whose unit moved away never
 * keeps the serial from being used.
 */
async function serialTwin(sql: Sql, serial: string, machineId: number | null): Promise<Holder | null> {
  const rows = await sql.query<Holder>(
    `select t.id, t.rebuild_id, t.title, t.account, t.status, false as archived, t.n
       from (select m.id, m.rebuild_id, m.serial, m.asset_id, m.stocked_at, r.title, r.account, r.status,
                    row_number() over (partition by m.rebuild_id order by m.id)::int as n
               from rebuild_machines m join rebuilds r on r.id = m.rebuild_id
              where not coalesce(r.archived, false) and r.status not in ('Completed', 'Cancelled')) t
      where ${SERIAL_KEY("t.serial")} = $1 and t.asset_id is null and t.stocked_at is null and t.id is distinct from $2::int
      order by t.id limit 1`,
    [serialKey(serial), machineId],
  );
  const h = rows[0];
  return h ? { ...h, id: Number(h.id), rebuild_id: Number(h.rebuild_id), n: Number(h.n) } : null;
}

/**
 * "Serial X is on rebuild "T" already. …" for a serial another machine has. Warehouse can't change a customer's
 * rebuild, so it is told who can take the machine off there (11/2 review).
 */
function onAnotherMachine(serial: string, other: Holder, rebuildId: number, warehouse = false): Error {
  if (other.rebuild_id === rebuildId) return new Error(`Serial ${serial} is on machine ${other.n} of this rebuild already.`);
  if (warehouse && !warehouseMayEdit(other.account)) {
    return new Error(`Serial ${serial} is on the customer rebuild "${other.title}" already. An Admin, or the tech on that rebuild, can take it off there.`);
  }
  return new Error(`Serial ${serial} is on rebuild "${other.title}" already. Take it off that rebuild's machines first.`);
}

/** SQL: machine `m` holds its unit and someone locked the unit (a person), or its serial on a customer's account. */
const HELD_LOCKED = (m: string) => `exists (
    select 1 from rebuilds lr join assets la on la.id = ${m}.asset_id
     where lr.id = ${m}.rebuild_id and ${HOLDS(m, "lr.account")} and (not ${UNLOCKED("la")} or ${ACCOUNT_LOCKED("la")}))`;

/** The lock on the unit a machine holds, or null: the unit's serial and who locked it. */
async function heldLock(sql: Sql, machineId: number): Promise<{ serial: string | null; by: string | null } | null> {
  const rows = await sql.query<{ serial: string | null; by: string | null }>(
    `select coalesce(nullif(btrim(la.serial), ''), m.serial) as serial, ${LOCKED_BY("la")} as by
       from rebuild_machines m join rebuilds lr on lr.id = m.rebuild_id join assets la on la.id = m.asset_id
      where m.id = $1 and ${HOLDS("m", "lr.account")} and (not ${UNLOCKED("la")} or ${ACCOUNT_LOCKED("la")})`,
    [machineId],
  );
  return rows[0] ?? null;
}

/**
 * A machine whose unit is locked keeps it (11/2 review): taking the machine off, or giving it another serial, would
 * leave the unit on the rebuild with no machine to bring it back or put it in stock.
 */
async function lockedUnitRefusal(
  sql: Sql,
  lock: { serial: string | null; by: string | null },
  stays = "it stays on this machine",
): Promise<Error> {
  const { lockOwnerName } = await import("@/lib/ops/equipment-lock");
  const owner = (await lockOwnerName(sql).catch(() => null))?.trim() || "the owner";
  const sn = lock.serial?.trim() ? `SN ${lock.serial.trim()}` : "Its unit";
  return new Error(`${sn} is locked by ${lock.by?.trim() || owner}, so ${stays}. Only ${owner} can unlock it.`);
}

/**
 * SQL: rebuild `r` (a rebuilds row) has a machine holding a locked unit, and `acct` is another account (11/2 review,
 * round 3): an account change would hand that unit to the new account. The Warehouse's two refurb accounts are one.
 */
const LOCKED_UNIT_MOVES = (r: string, acct: string) =>
  `(not ${SAME_ACCOUNT(`${r}.account`, acct)} and exists (
     select 1 from rebuild_machines km where km.rebuild_id = ${r}.id and ${HELD_LOCKED("km")}))`;

/** The first locked unit a rebuild's machines hold, or null: its serial and who locked it. */
async function rebuildHeldLock(sql: Sql, rebuildId: number): Promise<{ serial: string | null; by: string | null } | null> {
  const ids = await sql.query<{ id: number }>("select id from rebuild_machines where rebuild_id = $1 and asset_id is not null and stocked_at is null order by id", [rebuildId]);
  for (const m of ids) {
    const lock = await heldLock(sql, Number(m.id));
    if (lock) return lock;
  }
  return null;
}

const pullInput = z.object({
  id: z.number(),
  /** The machine to pull onto; none adds a machine for the serial. */
  machineId: z.number().nullable().optional(),
  serial: z.string(),
  /** The machine's model as the person has it (an edit not saved yet goes with the pull), or a new machine's model. */
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
 * customer's account. A unit another open rebuild holds stays there, and a serial is on one open machine at a time. The
 * machine keeps how the unit was, so taking it off puts the unit back; a machine's old unit is put back when it takes
 * another serial, in the same statement.
 */
export async function pullRebuildMachineFor(sql: Sql, data: z.infer<typeof pullInput>, userId: string): Promise<Rebuild> {
  const access = await requireEditor(sql, userId);
  const cur = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0];
  if (!cur) throw new Error("Rebuild not found");
  requireRowEditor(access, cur.account);
  requireOpen(cur);
  await adoptLegacy(sql, [data.id]);
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
    if (machine) {
      const lock = await heldLock(sql, machine.id);
      if (lock) throw await lockedUnitRefusal(sql, lock);
    }
    const rows = await sql.query<{ id: number } & PutBack>(
      `with mine as (
         select id, rebuild_id, asset_id, origin, serial, pulled_at, stocked_at from rebuild_machines mm
          where id = $1 and rebuild_id = $2 and stocked_at is null and ${OPEN_STILL("$2", "$6")} and not ${HELD_LOCKED("mm")}
          for update
       ), ${putBackSql("back", "mine")}, saved as (
         update rebuild_machines set serial = $3, asset_id = null, origin = null, pulled_at = null, migrated = false, notice = $4,
                model = case when $5 <> '' then $5 else model end, updated_at = now()
          where id = (select id from mine)
         returning id
       ), added as (
         insert into rebuild_machines (rebuild_id, model, serial, notice)
         select $2, $5, $3, $4 where $1::int is null and ${OPEN_STILL("$2", "$6")}
         returning id
       )
       select coalesce((select id from saved), (select id from added)) as id, ${PUT_BACK_OUT("back", "mine")}`,
      [machine?.id ?? null, data.id, serial || null, notice, model, keys],
    );
    if (!rows[0]?.id) {
      const lock = machine ? await heldLock(sql, machine.id) : null;
      if (lock) throw await lockedUnitRefusal(sql, lock);
      throw await machineRefusal(sql, data.id);
    }
    return putBackLine(rows[0]);
  };

  if (!serialKey(serial)) {
    if (!machine && !model) throw new Error("Type the machine's serial, or pick its model.");
    await keepSerial(serial ? `Serial ${serial} isn't a serial a unit can have.` : null);
    return reload();
  }
  // One serial, one machine: another open machine with this serial typed keeps it (a machine's own serial is fine).
  if (!machine || serialKey(machine.serial) !== serialKey(serial)) {
    const twin = await serialTwin(sql, serial, machine?.id ?? null);
    if (twin) throw onAnotherMachine(serial, twin, data.id, isWarehouse(access));
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
  // The one machine holding the unit now, if any. This machine: nothing to pull (and how the unit was before the pull
  // is kept). A machine whose unit went somewhere else since holds nothing, so it never keeps the unit from a pull.
  const holder = await unitHolder(sql, hit.assetId);
  if (machine && holder?.id === machine.id) {
    // Its model as the person has it now goes in all the same.
    if (model && model !== machine.model) {
      await sql.query(
        `update rebuild_machines set model = $3, migrated = false, updated_at = now()
          where id = $1 and rebuild_id = $2 and stocked_at is null and ${OPEN_STILL("$2", "$4")}`,
        [machine.id, data.id, model, keys],
      );
    }
    return reload();
  }
  if (isWarehouse(access) && hit.held) {
    throw new Error(`Serial ${hit.serial} is waiting for an Admin to approve its ${hit.held === "assign" ? "assign to a customer" : "removal"}, so it stays where it is.`);
  }
  if (holder && !holder.archived && !CLOSED_REBUILD.has(holder.status as RebuildStatus)) throw onAnotherMachine(hit.serial, holder, data.id, isWarehouse(access));
  // This machine's own unit, locked: it stays (another serial would leave it on the rebuild with no machine).
  if (machine) {
    const lock = await heldLock(sql, machine.id);
    if (lock) throw await lockedUnitRefusal(sql, lock);
  }
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
  // new machine is added for it), the machine's old unit goes back as it was, or nothing happens. Every pull goes
  // through only while the unit is just as it was read (11/2 review: so two pulls at once can't both take it). A unit
  // from another account leaves the install or ticket it was on. Where the unit goes back to is how it was before
  // this pull, or, when a cancelled or removed rebuild still holds it as its pull left it, how it was before that pull.
  const pulled = await sql.query<{ id: number; old_asset: number | null } & PutBack>(
    `with refurb as (
       select id from rebuilds where id = $5 and status not in ('Completed', 'Cancelled') and ${ACCOUNT_STILL("account", "$4")} for update
     ), mine as (
       select id, rebuild_id, asset_id, origin, serial, pulled_at, stocked_at from rebuild_machines mm
        where id = $12::int and rebuild_id = $5 and stocked_at is null and not ${HELD_LOCKED("mm")} for update
     ), prior as (
       select status, sold_to, purpose, install_id, job_id, locked_at, locked_by, $2::text as pulled_to from assets where id = $1
     ), was as (
       select o.origin from rebuild_machines o join rebuilds r on r.id = o.rebuild_id
        where o.asset_id = $1 and o.id is distinct from $12::int and o.origin is not null
          and (coalesce(r.archived, false) or r.status = 'Cancelled') and ${HOLDS("o", "r.account")}
        order by coalesce(o.pulled_at, '-infinity'::timestamptz) desc, o.id desc limit 1
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
         and ${ASSET_STAMP} = $6
         and not exists (
           select 1 from rebuild_machines o join rebuilds r on r.id = o.rebuild_id
            where o.asset_id = $1 and o.id is distinct from $12::int
              and not coalesce(r.archived, false) and r.status not in ('Completed', 'Cancelled') and ${HOLDS("o", "r.account")})
         and ($4::text[] is null or (
               -- Warehouse: on no hold (a hold doesn't always stamp the unit), and not locked on a customer's account
               -- meanwhile.
               stock_hold is null
               and not exists (select 1 from account_equipment ae where ae.serial_key = $11 and ae.locked_at is not null)
             ))
       returning id
     ), ${putBackSql("back", "mine", "pm.asset_id is distinct from $1 and exists (select 1 from unit)")}, saved as (
       update rebuild_machines set serial = $7, asset_id = $1, notice = $9, pulled_at = now(), migrated = false, updated_at = now(),
              model = case when $13 <> '' then $13 when model = '' then $8 else model end,
              origin = coalesce((select origin || jsonb_build_object('pulled_to', $2::text) from was), (select to_jsonb(p) from prior p))
        where id = $12::int and exists (select 1 from unit)
       returning id
     ), added as (
       insert into rebuild_machines (rebuild_id, model, serial, asset_id, notice, origin, pulled_at)
       select $5, case when $13 <> '' then $13 else $8 end, $7, $1, $9,
              coalesce((select origin || jsonb_build_object('pulled_to', $2::text) from was), (select to_jsonb(p) from prior p)), now()
        where $12::int is null and exists (select 1 from unit)
       returning id
     )
     select coalesce((select id from saved), (select id from added)) as id, (select asset_id from mine) as old_asset,
            ${PUT_BACK_OUT("back", "mine")}`,
    [
      hit.assetId,
      cur.account,
      LOCKED_BY_ASSIGNED,
      keys,
      data.id,
      hit.stamp,
      hit.serial,
      hit.model,
      notice,
      sameAccount,
      serialKey(hit.serial),
      machine?.id ?? null,
      model,
    ],
  );
  if (!pulled[0]?.id) {
    const now = (await sql.query<{ account: string; status: string }>("select account, status from rebuilds where id = $1", [data.id]))[0];
    if (!now) throw new Error("Rebuild not found");
    if (CLOSED_REBUILD.has(now.status as RebuildStatus) || (isWarehouse(access) && !warehouseMayEdit(now.account))) throw await machineRefusal(sql, data.id);
    if (machine && !(await machineRow(sql, data.id, machine.id))) throw new Error("That machine isn't on this rebuild any more. Open the rebuild again.");
    const lock = machine ? await heldLock(sql, machine.id) : null;
    if (lock) throw await lockedUnitRefusal(sql, lock);
    // The unit is gone from the records, or its serial changed: a different answer from one that moved meanwhile.
    const still = (await sql.query<{ serial: string | null }>("select serial from assets where id = $1", [hit.assetId]))[0];
    if (!still || serialKey(still.serial) !== serialKey(hit.serial)) throw new Error(`Serial ${hit.serial} is no longer in the warehouse records, so it wasn't pulled.`);
    throw new Error(
      isWarehouse(access)
        ? `Serial ${hit.serial} was just moved, locked, put on hold or taken by another rebuild, so it wasn't pulled. Pull it again.`
        : `Serial ${hit.serial} was just moved or taken by another rebuild, so it wasn't pulled. Pull it again.`,
    );
  }
  // The machine's old unit, if it had another one, went back as it was.
  const old = pulled[0];
  const back = old.old_asset != null && Number(old.old_asset) !== hit.assetId ? putBackLine(old) : null;
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
  await adoptLegacy(sql, [data.id]);
  const machine = await machineRow(sql, data.id, data.machineId);
  if (!machine) throw new Error("That machine isn't on this rebuild any more. Open the rebuild again.");
  if (machine.stocked_at) throw new Error("That machine is in stock already, so it stays on the rebuild.");
  const lock = await heldLock(sql, machine.id);
  if (lock) throw await lockedUnitRefusal(sql, lock);
  const rows = await sql.query<{ id: number; model: string; asset_id: number | null } & PutBack>(
    `with gone as (
       delete from rebuild_machines m
        where m.id = $1 and m.rebuild_id = $2 and m.stocked_at is null and not ${HELD_LOCKED("m")}
          and exists (select 1 from rebuilds r where r.id = $2 and r.status <> 'Completed' and ${ACCOUNT_STILL("r.account", "$3")})
       returning m.id, m.rebuild_id, m.model, m.serial, m.asset_id, m.origin, m.pulled_at, m.stocked_at
     ), ${putBackSql("back", "gone")}
     select g.id, g.model, g.asset_id, ${PUT_BACK_OUT("back", "gone")} from gone g`,
    [data.machineId, data.id, warehouseKeys(access)],
  );
  const gone = rows[0];
  if (!gone) {
    if (!(await machineRow(sql, data.id, data.machineId))) throw new Error("That machine isn't on this rebuild any more. Open the rebuild again.");
    const locked = await heldLock(sql, data.machineId);
    if (locked) throw await lockedUnitRefusal(sql, locked);
    throw await machineRefusal(sql, data.id);
  }
  const message = gone.asset_id != null ? putBackLine(gone) : null;
  const label = `${gone.model?.trim() || "Machine"}${gone.old_serial?.trim() ? ` SN ${gone.old_serial.trim()}` : ""}`;
  await logActivity(sql, userId, data.id, "updated", [`removed machine ${label}`, message].filter(Boolean).join(" · "));
  const row = (await sql.query<RebuildRow>("select * from rebuilds where id = $1", [data.id]))[0]!;
  return { rebuild: await rebuildOut(sql, row), message };
}

/** SQL: rebuild `id` is a completed refurb (Katz Coffee Service Dept. or Katz shop / stock), still on the board. */
const STOCKS_STILL = (id: string) =>
  `exists (select 1 from rebuilds sr where sr.id = ${id} and sr.status = 'Completed' and not coalesce(sr.archived, false)
             and ${NAME_KEY("sr.account")} = any(${HOUSE_KEYS}))`;

/** Where a unit is now, for a machine that couldn't put it in stock: another rebuild, a lock, or its place. */
async function unitNowLine(sql: Sql, assetId: number, machine: MachineRow, pulled: boolean): Promise<string> {
  const u = (
    await sql.query<{
      site: string;
      pallet: string | null;
      level: number | null;
      status: string;
      sold_to: string | null;
      purpose: string | null;
      install_id: number | null;
      job_id: number | null;
      lock_by: string | null;
      locked: boolean;
      holder: string | null;
      stocked_by: string | null;
      stocked_rebuild: number | null;
    }>(
      `select a.site, a.pallet, a.level, a.status, a.sold_to, a.purpose, a.install_id, a.job_id,
              ${LOCKED_BY("a")} as lock_by, (not ${UNLOCKED("a")} or ${ACCOUNT_LOCKED("a")}) as locked,
              (select r2.title from rebuild_machines o join rebuilds r2 on r2.id = o.rebuild_id
                where o.asset_id = a.id and o.id <> $2 and ${HOLDS("o", "r2.account")} limit 1) as holder,
              sb.title as stocked_by, sb.rebuild_id as stocked_rebuild
         from assets a
         left join lateral (
           select r3.title, n.rebuild_id from rebuild_machines n join rebuilds r3 on r3.id = n.rebuild_id
            where n.asset_id = a.id and n.id <> $2 and n.stocked_at is not null
            order by n.stocked_at desc limit 1
         ) sb on true
        where a.id = $1`,
      [assetId, Number(machine.id)],
    )
  )[0];
  if (!u) return "its unit is no longer on the stock list.";
  if (u.stocked_by && !pulled) {
    return Number(u.stocked_rebuild) === Number(machine.rebuild_id)
      ? "its serial went into stock already with another machine on this refurb."
      : `its serial went into stock already from rebuild "${u.stocked_by}".`;
  }
  if (u.holder) return `its unit is on rebuild "${u.holder}" now.`;
  if (u.locked) return `its unit is locked by ${u.lock_by?.trim() || "the owner"}. Once it's unlocked, set the refurb back to In progress and complete it again.`;
  const where = unitWhere({ site: u.site, pallet: u.pallet, level: num(u.level), status: u.status, soldTo: u.sold_to, purpose: u.purpose, installId: num(u.install_id), jobId: num(u.job_id) });
  return `its unit is on ${where} now.`;
}

/**
 * A completed refurb's machines go into stock at the Staging area (Chuy, 11/2), marked needs shop test, with no Admin
 * review. A machine's pulled unit moves there off the refurb while the machine still holds it; a machine whose serial
 * is on the stock list with nobody's name on it moves that unit; any other machine is added to the stock list. Every
 * statement checks again that the rebuild is a completed refurb, so an Admin's change in between stands. Left alone,
 * with a note: a machine already in stock, a unit someone moved or locked since it was pulled, a unit another machine
 * put in stock already, a machine with no model, and one kept from before machines with nothing but its model (it may be
 * on the stock list already). Returns a line for the person who completed it.
 */
async function stockRefurbMachines(sql: Sql, rebuild: RebuildRow, userId: string): Promise<string | null> {
  await adoptLegacy(sql, [Number(rebuild.id)]);
  const all = await sql.query<MachineRow>("select * from rebuild_machines where rebuild_id = $1 order by id", [rebuild.id]);
  if (!all.some((m) => !m.stocked_at)) return null;
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
  const leave = async (m: MachineRow, why: string) => {
    left.push(why);
    await sql.query("update rebuild_machines set notice = $2, updated_at = now() where id = $1 and stocked_at is null", [m.id, why]).catch(() => undefined);
  };
  for (const [i, m] of all.entries()) {
    if (m.stocked_at) continue;
    const label = `${m.model?.trim() || `Machine ${i + 1}`}${m.serial?.trim() ? ` SN ${m.serial.trim()}` : ""}`;
    try {
      let assetId = num(m.asset_id);
      const pulled = assetId != null;
      if (!pulled && !serialKey(m.serial ?? "")) {
        // Nothing to find it by: it is added to the stock list as its model, so it needs one; one kept from before
        // machines may be on the stock list already.
        if (!m.model.trim()) {
          await leave(m, `${label} wasn't put in stock: it has no model. Set the refurb back to In progress, pick its model, then complete it again.`);
          continue;
        }
        if (m.migrated) {
          await leave(m, `${label} wasn't added to stock: it was on this refurb before machines had serials, so it may be on the stock list already. Check the Warehouse page.`);
          continue;
        }
      }
      if (!pulled && serialKey(m.serial ?? "")) {
        const hit = await findWarehouse(sql, m.serial ?? "");
        if (hit) assetId = hit.assetId;
        else if (!m.model.trim()) {
          await leave(m, `${label} wasn't put in stock: it has no model. Set the refurb back to In progress, pick its model, then complete it again.`);
          continue;
        }
      }
      if (assetId != null) {
        // Its unit: pulled onto this refurb and still held by this machine, or on the stock list with nobody's name on
        // it and not put in stock already by another machine. Nobody's lock on it, nor on its serial on an account.
        const moved = await sql.query<{ id: number }>(
          `with mine as (
             select id, rebuild_id, asset_id, pulled_at, stocked_at from rebuild_machines
              where id = $1 and stocked_at is null and ${STOCKS_STILL("rebuild_id")} for update
           ), unit as (
             update assets a set status = 'deployed', site = $6, pallet = null, level = null, line_no = null, sold_to = null,
                    purpose = $7, install_id = null, job_id = null, locked_at = null, locked_by = null,
                    shop_test = 'needs-test', shop_test_note = null, shop_test_by = $3, shop_test_at = now(),
                    notes = concat_ws(E'\\n', nullif(btrim(coalesce(a.notes, '')), ''), $4::text), updated_at = now()
              from mine pm
              where a.id = $2 and not ${ACCOUNT_LOCKED("a")}
                and (($8 and pm.asset_id = a.id and ${HOLDS("pm", "(select pr.account from rebuilds pr where pr.id = pm.rebuild_id)")} and ${UNLOCKED("a")})
                     or (not $8 and a.status in ('ready', 'deployed') and coalesce(btrim(a.sold_to), '') = '' and a.install_id is null
                         and a.job_id is null and a.stock_hold is null and a.locked_at is null
                         and not exists (select 1 from rebuild_machines n where n.asset_id = a.id and n.id <> pm.id
                                           and n.stocked_at is not null)))
             returning a.id
           )
           update rebuild_machines set asset_id = $2, stocked_at = now(), notice = $5, updated_at = now()
            where id = $1 and exists (select 1 from unit)
           returning id`,
          [m.id, assetId, who, moveLine, inStock, HOUSE_STAGING, purpose, pulled],
        );
        if (moved.length) {
          await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('asset', $1, $2, 'moved', $3)", [assetId, who, moveLine]);
          done.push(label);
          continue;
        }
        if (!(await stillStocks(sql, rebuild.id))) {
          left.push(changedMeanwhile(done.length));
          break;
        }
        await leave(m, `${label} wasn't put in stock: ${await unitNowLine(sql, assetId, m, pulled)}`);
        continue;
      }
      const made = await sql.query<{ asset_id: number }>(
        `with mine as (select id from rebuild_machines where id = $1 and stocked_at is null and ${STOCKS_STILL("rebuild_id")} for update),
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
      } else if (!(await stillStocks(sql, rebuild.id))) {
        left.push(changedMeanwhile(done.length));
        break;
      }
    } catch (e) {
      console.error("[rebuilds] a machine didn't go into stock", e);
      await leave(m, `${label} wasn't put in stock: something went wrong. Set the refurb back to In progress, then complete it again.`);
    }
  }
  if (done.length) await logActivity(sql, userId, Number(rebuild.id), "stocked", `Into stock at the ${REFURB_STOCK_PLACE}: ${done.join(", ")}`.slice(0, 500));
  return stockedLine(done.length, left);
}

/** Said when the rebuild stopped being a completed refurb while its machines were going into stock. */
const changedMeanwhile = (stocked: number) =>
  stocked
    ? "The rest stayed on the rebuild: it changed while they were going into stock."
    : "Nothing went into stock: this rebuild changed while its machines were going in.";

/** Whether the rebuild is still a completed refurb (an Admin may have moved it to a customer, or reopened it). */
async function stillStocks(sql: Sql, id: number): Promise<boolean> {
  return !!(await sql.query<{ ok: boolean }>(`select ${STOCKS_STILL("$1")} as ok`, [id]))[0]?.ok;
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
    // Each sample's machine is on its machine list (11/2), not in the rebuild's old one-machine columns.
    await sql.query(
      `with made as (
         insert into rebuilds (
           title, account, owner, status, reason_code, reason_detail,
           planned_start, target_complete, actual_start, actual_complete, priority, notes,
           status_changed_at, created_at, updated_at
         ) values (
           $1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
           $15::timestamptz, $16::timestamptz, now()
         )
         returning id
       )
       insert into rebuild_machines (rebuild_id, model, serial)
       select id, coalesce($3::text, ''), $4::text from made where $3::text is not null or $4::text is not null`,
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
