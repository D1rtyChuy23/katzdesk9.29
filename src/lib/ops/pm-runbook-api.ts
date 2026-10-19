/**
 * PM runbook — server functions. Options live with the unit (keyed by serial, history in `activity`); ticks and
 * the model/interval choice live per PM job and unit. Admin and service write; everyone else reads.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { normalizeCustomerKey, parseSerial, serialKey } from "@/lib/ops/account-equip";
import { RUNBOOKS, runbookById } from "@/lib/ops/runbooks";
import {
  canEditRunbookDefinitions,
  addedKitDetail,
  addedKitSentence,
  canWriteRunbook,
  changeAddedKits,
  CHECK_KEY_RE,
  checkSerialKey,
  historyInterval,
  kitListWithAdded,
  KIT_NUMBER_RE,
  nextFromHistory,
  parseAddedKits,
  pmAddKitSql,
  pmRemoveKitSql,
  PM_SERVICE_ACTION,
  pmServicePrefix,
  pmServiceRecord,
  recommendInterval,
  removedKitCheckKeys,
  stepsForVisit,
  unitHistory,
  unitModelPicked,
  visitConfig,
  visibleOptions,
  type RunbookRole,
} from "@/lib/ops/pm-runbook";
import { planUnits, pmCompletionRefusal, type AccountUnitRow, type PlannedUnit } from "@/lib/ops/pm-runbook-units";
import { catalogKeys, pickCatalog, prefixForManufacturer, type CatalogKit } from "@/lib/ops/pm-runbook-prices";
import type { RunbookConfig, RunbookDefinition } from "@/lib/ops/pm-runbook-schema";

export type RunbookUnit = {
  unitKey: string;
  pieceKey: string;
  accountId: number | null;
  /** True when this line is an account unit with a serial. */
  logged: boolean;
  piece: string;
  serial: string | null;
  /** Where options are stored: the serial, else 'acct:<id>', else null (options then stay with this PM only). */
  optionsKey: string | null;
  /** True when the unit matched an account unit but has no serial yet (options move to the serial once added). */
  awaitingSerial: boolean;
  runbookId: string;
  /** model, pm and every option key. */
  config: RunbookConfig;
  /** Every ticked key with who and when. */
  checks: Record<string, { by: string | null; at: string }>;
  /** Kit numbers added from the longer interval. Clearing ticks does not remove these. */
  addedKits: string[];
  history: { who: string | null; at: string; detail: string }[];
  /** Install date at this location, from the account unit. */
  installDate: string | null;
  /** Interval recommended from the install date; the tech may choose otherwise. */
  recommended: { id: string; label: string; months: number; milestone: number; year: number; combined: boolean } | null;
  /** True when the account unit has no install date, so the interval cannot be worked out from its age. */
  missingInstallDate: boolean;
  /** Suggested from the last full PM on this unit, used when there is no install date. */
  fromHistory: {
    id: string;
    label: string;
    combined: boolean;
    basedOn: { pmId: number; interval: string; completedAt: string | null }[];
  } | null;
  /** Earlier PMs on this unit (by serial, so they follow it between accounts). */
  earlier: { pmId: number; status: string; completedAt: string | null; kits: number; steps: number }[];
  /** False when neither the equipment text nor a saved choice names the model. The sheet still opens on the first model. */
  modelPicked: boolean;
};

export type RunbookAccountUnit = {
  id: number;
  name: string;
  serial: string | null;
  installDate: string | null;
};

export type PmRunbookData = {
  units: RunbookUnit[];
  accountUnits: RunbookAccountUnit[];
  canWrite: boolean;
  canEditDefinitions: boolean;
  /** True when the PM is already completed, so added kits stay as they are. */
  completed: boolean;
};

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const asJson = (v: unknown): Record<string, unknown> => {
  const x = typeof v === "string" ? JSON.parse(v) : v;
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
};

async function who(sql: Sql, userId: string) {
  const rows = await sql.query<{ is_admin: unknown; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const r = rows[0];
  const role = (r?.desk_role ?? null) as RunbookRole;
  const isAdmin = flagOn(r?.is_admin);
  return {
    name: r?.username || "Teammate",
    canWrite: canWriteRunbook(role, isAdmin),
    canEditDefinitions: canEditRunbookDefinitions(role, isAdmin),
  };
}

/**
 * After a PM passes the completion check, write one service record on each unit's existing history
 * (`activity`, entity_type `unit_runbook`). A second completion or a later edit finds that row and does nothing.
 */
export async function recordCompletedRunbook(
  sql: Sql,
  pmId: number,
  userId: string,
  planned: PlannedUnit[],
  style: string | null,
  now: Date = new Date(),
): Promise<void> {
  const me = await who(sql, userId);
  const units = planned.filter((u) => u.optionsKey && runbookById(u.runbookId));
  if (!units.length) return;
  const job = (await sql.query<{ customer: string }>("select customer from pm_jobs where id = $1", [pmId]))[0];
  if (!job) return;
  const saved = await sql.query<{ unit_key: string; model: string | null; interval_mo: string | null; options: unknown; added_kits: unknown }>(
    "select unit_key, model, interval_mo, options, added_kits from pm_runbook_units where pm_job_id = $1",
    [pmId],
  );
  const checks = await sql.query<{ unit_key: string; key: string }>(
    "select unit_key, key from pm_runbook_checks where pm_job_id = $1 and (key like 'step:%' or key like 'kit:%')",
    [pmId],
  );
  const keys = units.map((u) => u.optionsKey).filter((k): k is string => !!k);
  const optRows = await sql.query<{ id: number; unit_key: string; options: unknown }>(
    "select id, unit_key, options from unit_runbook_options where unit_key = any($1::text[])",
    [keys],
  );
  for (const u of units) {
    const rb = runbookById(u.runbookId);
    if (!rb || !u.optionsKey) continue;
    const s = saved.find((x) => x.unit_key === u.unitKey);
    const optRow = optRows.find((r) => r.unit_key === u.optionsKey);
    const options = optRow ? asJson(optRow.options) : s?.options ? asJson(s.options) : {};
    const config = await loadVisitConfig(sql, rb.def, { id: pmId, customer: job.customer, style }, u, now);
    const ticked = new Set(checks.filter((c) => c.unit_key === u.unitKey).map((c) => c.key));
    const detail = pmServiceRecord({
      pmId,
      modelLabel: rb.def.models.find((m) => m.id === config.model)?.label ?? u.piece,
      intervalLabel: rb.def.intervals.find((i) => i.id === config.pm)?.label ?? `${config.pm}-month PM`,
      options: visibleOptions(rb.def, config).map((o) => ({
        label: o.label,
        value: o.choices.find((c) => c.val === config[o.key])?.label ?? String(config[o.key] ?? ""),
      })),
      kits: kitListWithAdded(rb.def, config, parseAddedKits(s?.added_kits))
        .filter((k) => ticked.has(`kit:${k.ev}`))
        .map((k) => ({ ev: k.ev, q: k.q, name: k.added ? `${k.name} (added)` : k.name })),
      steps: stepsForVisit(rb.def, config, parseAddedKits(s?.added_kits))
        .flatMap((g) => g.items)
        .filter((item) => ticked.has(`step:${item.id}`))
        .map((item) => item.text),
    });
    let historyId = optRow?.id ?? null;
    if (historyId == null) {
      const made = await sql.query<{ id: number }>(
        `insert into unit_runbook_options (unit_key, serial_key, runbook_id, options, updated_by)
         values ($1, case when $1 like 'acct:%' then null else $1 end, $2, $3::jsonb, $4)
         on conflict (unit_key) do nothing
         returning id`,
        [u.optionsKey, u.runbookId, JSON.stringify(options), me.name],
      );
      historyId = made[0]?.id ?? (await sql.query<{ id: number }>("select id from unit_runbook_options where unit_key = $1", [u.optionsKey]))[0]?.id ?? null;
    }
    if (historyId == null) continue;
    const already = await sql.query<{ id: number }>(
      `select id from activity
        where entity_type = 'unit_runbook' and entity_id = $1 and action = $2 and detail like $3
        limit 1`,
      [historyId, PM_SERVICE_ACTION, `${pmServicePrefix(pmId)}%`],
    );
    if (already[0]) continue;
    await sql.query(
      `with up as (
         insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, interval_mo, updated_by)
         values ($1::int, $2::text, $3::text, $4::text, $5::text)
         on conflict (pm_job_id, unit_key) do update
           set interval_mo = excluded.interval_mo, updated_by = excluded.updated_by, updated_at = now()
         where pm_runbook_units.interval_mo is null
         returning pm_job_id
       ), act as (
         insert into activity (entity_type, entity_id, actor_name, action, detail)
         values ('unit_runbook', $6::int, $5::text, $7::text, $8::text)
         returning id
       )
       select (select count(*) from up)::int as saved, (select count(*) from act)::int as logged`,
      [pmId, u.unitKey, u.runbookId, config.pm, me.name, historyId, PM_SERVICE_ACTION, detail],
    );
  }
}

async function requireWriter(sql: Sql, userId: string) {
  const me = await who(sql, userId);
  if (!me.canWrite) throw new Error("Only Service and Admin can change the runbook.");
  return me;
}

function pmMatcher(piece: string): { runbookId: string; model: string | null } | null {
  for (const rb of RUNBOOKS) {
    const h = rb.matchPiece(piece);
    if (h) return { runbookId: rb.def.id, model: h.model };
  }
  return null;
}

/** Completed visits on this unit, oldest first. The same list the PM sheet uses for the next interval. */
export function earlierVisitsForUnit(
  def: RunbookDefinition,
  unit: { unitKey: string; serialKey: string | null },
  doneRows: { id: number; equipment: string | null; style: string | null; completed_at: string | null }[],
  savedIntervals: { pm_job_id: number; unit_key: string; interval_mo: string | null }[],
  bySerial: { id: number; style: string | null; completed_at: string | null; unit_key: string; interval_mo: string | null; serial_key: string }[],
  rows: AccountUnitRow[],
  pins: Record<number, Record<string, number>>,
): { pmId: number; interval: string; completedAt: string | null }[] {
  const out = new Map<number, { pmId: number; interval: string; completedAt: string | null }>();
  for (const d of doneRows) {
    const hit = planUnits(d.equipment, rows, pmMatcher, pins[d.id]).find((x) => x.unitKey === unit.unitKey);
    if (!hit) continue;
    const interval = historyInterval(def, savedIntervals.find((s) => s.pm_job_id === d.id && s.unit_key === unit.unitKey)?.interval_mo, d.style);
    if (interval) out.set(d.id, { pmId: d.id, interval, completedAt: d.completed_at });
  }
  for (const b of bySerial) {
    if (!unit.serialKey || b.serial_key !== unit.serialKey) continue;
    const interval = historyInterval(def, b.interval_mo, b.style);
    if (interval) out.set(b.id, { pmId: b.id, interval, completedAt: b.completed_at });
  }
  return [...out.values()].sort((a, b) => (a.completedAt ?? "9999").localeCompare(b.completedAt ?? "9999") || a.pmId - b.pmId);
}

/** Interval and options for one unit, the same way the PM sheet works them out. */
export async function loadVisitConfig(
  sql: Sql,
  def: RunbookDefinition,
  pm: { id: number; customer: string; style: string | null },
  unit: PlannedUnit,
  now = new Date(),
): Promise<RunbookConfig> {
  const saved = (
    await sql.query<{ model: string | null; interval_mo: string | null; options: unknown }>(
      "select model, interval_mo, options from pm_runbook_units where pm_job_id = $1 and unit_key = $2",
      [pm.id, unit.unitKey],
    )
  )[0];
  const opt = unit.optionsKey
    ? (await sql.query<{ options: unknown }>("select options from unit_runbook_options where unit_key = $1", [unit.optionsKey]))[0]
    : null;
  const doneRows = await sql.query<{ id: number; equipment: string | null; style: string | null; completed_at: string | null }>(
    `select id, equipment, style, completed_at::text as completed_at from pm_jobs
      where lower(customer) = lower($1) and id <> $2 and (completed_at is not null or status = 'Completed')`,
    [pm.customer, pm.id],
  );
  const ids = doneRows.map((r) => r.id);
  const savedIntervals = ids.length
    ? await sql.query<{ pm_job_id: number; unit_key: string; interval_mo: string | null }>(
        "select pm_job_id, unit_key, interval_mo from pm_runbook_units where pm_job_id = any($1::int[]) and interval_mo is not null",
        [ids],
      )
    : [];
  const links = ids.length
    ? await sql.query<{ pm_job_id: number; piece_key: string; account_equipment_id: number }>(
        "select pm_job_id, piece_key, account_equipment_id from pm_runbook_unit_links where pm_job_id = any($1::int[])",
        [ids],
      )
    : [];
  const pins: Record<number, Record<string, number>> = {};
  for (const link of links) {
    const bag = pins[link.pm_job_id] ?? (pins[link.pm_job_id] = {});
    bag[link.piece_key] = Number(link.account_equipment_id);
  }
  const acct = await sql.query<{ id: number; catalog_model: string; equipment_name: string; serial: string | null; install_date: string | null }>(
    "select id, catalog_model, equipment_name, serial, install_date::text as install_date from account_equipment where lower(customer) = lower($1) order by id",
    [pm.customer],
  );
  const rows = acct.map((r) => ({
    id: r.id,
    catalogModel: r.catalog_model,
    equipmentName: r.equipment_name,
    serial: r.serial,
    installDate: r.install_date,
  }));
  const bySerial = unit.serialKey
    ? await sql.query<{ id: number; style: string | null; completed_at: string | null; unit_key: string; interval_mo: string | null; serial_key: string }>(
        `select p.id, p.style, p.completed_at::text as completed_at, r.unit_key, r.interval_mo, r.serial_key
           from pm_runbook_units r join pm_jobs p on p.id = r.pm_job_id
          where r.serial_key = $1 and p.id <> $2 and (p.completed_at is not null or p.status = 'Completed')`,
        [unit.serialKey, pm.id],
      )
    : [];
  const earlier = earlierVisitsForUnit(def, unit, doneRows, savedIntervals, bySerial, rows, pins);
  return visitConfig(def, {
    savedInterval: saved?.interval_mo,
    style: pm.style,
    installDate: unit.installDate,
    earlierIntervals: earlier.map((v) => v.interval),
    model: saved?.model ?? unit.model,
    options: asJson(opt?.options ?? saved?.options),
    now,
  });
}

/** Account units and the runbook lines for one PM, including a line pinned to a specific asset. */
export async function loadPmRunbookPlan(
  sql: Sql,
  customer: string,
  equipment: string | null,
  pmId: number,
): Promise<{ planned: PlannedUnit[]; accountUnits: RunbookAccountUnit[]; rows: AccountUnitRow[] }> {
  const acct = await sql.query<{ id: number; customer: string; catalog_model: string; equipment_name: string; serial: string | null; install_date: string | null }>(
    "select id, customer, catalog_model, equipment_name, serial, install_date::text as install_date from account_equipment where lower(customer) = lower($1) order by id",
    [customer],
  );
  const key = normalizeCustomerKey(customer);
  const rows = acct
    .filter((r) => normalizeCustomerKey(r.customer) === key)
    .map((r) => ({ id: r.id, catalogModel: r.catalog_model, equipmentName: r.equipment_name, serial: r.serial, installDate: r.install_date }));
  const links = await sql.query<{ piece_key: string; account_equipment_id: number }>(
    "select piece_key, account_equipment_id from pm_runbook_unit_links where pm_job_id = $1",
    [pmId],
  );
  const pinned: Record<string, number> = {};
  for (const link of links) pinned[link.piece_key] = Number(link.account_equipment_id);
  return {
    planned: planUnits(equipment, rows, pmMatcher, pinned),
    accountUnits: rows.map((r) => ({ id: r.id, name: r.equipmentName || r.catalogModel, serial: r.serial, installDate: r.installDate ?? null })),
    rows,
  };
}

export { pmCompletionRefusal };

/** Option notes for the units on this PM. No global cap: each unit keeps its own rows, and unitHistory shows 20. */
export function optionHistorySql(): string {
  return `select entity_id, actor_name, detail, created_at from activity
    where entity_type = 'unit_runbook' and entity_id = any($1::int[])
    order by created_at desc, id desc`;
}

const unitInput = z.object({
  pmId: z.number().int().positive(),
  unitKey: z.string().min(1).max(300),
});

export const getPmRunbook = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { pmId: number }) => z.object({ pmId: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<PmRunbookData> => {
    const sql = await ready();
    const me = await who(sql, context.userId);
    const empty = { units: [], accountUnits: [], canWrite: me.canWrite, canEditDefinitions: me.canEditDefinitions, completed: false };
    const pm = (
      await sql.query<{ customer: string; equipment: string | null; style: string | null; status: string; completed_at: string | null }>(
        "select customer, equipment, style, status, completed_at::text as completed_at from pm_jobs where id = $1",
        [data.pmId],
      )
    )[0];
    if (!pm) return empty;

    const { planned, accountUnits, rows } = await loadPmRunbookPlan(sql, pm.customer, pm.equipment, data.pmId);
    if (!planned.length) return empty;

    // A line that was ticked before its account unit existed is now matched: move that work to the unit.
    for (const u of planned) {
      if (u.accountId == null || u.pieceKey === u.unitKey) continue;
      const old = (
        await sql.query<{ options: unknown }>("select options from pm_runbook_units where pm_job_id = $1 and unit_key = $2", [
          data.pmId,
          u.pieceKey,
        ])
      )[0];
      const hasChecks = (
        await sql.query<{ n: number }>(
          "select count(*)::int as n from pm_runbook_checks where pm_job_id = $1 and unit_key = $2",
          [data.pmId, u.pieceKey],
        )
      )[0];
      if (!old && !(hasChecks?.n > 0)) continue;
      // Options typed while the unit was unknown become the unit's options, unless it already has some.
      const carried = old?.options ? asJson(old.options) : {};
      if (u.optionsKey && Object.keys(carried).length) {
        const made = await sql.query<{ id: number }>(
          `insert into unit_runbook_options (unit_key, serial_key, runbook_id, options, updated_by)
           values ($1, case when $1 like 'acct:%' then null else $1 end, $2, $3::jsonb, 'PM carry-over')
           on conflict (unit_key) do nothing returning id`,
          [u.optionsKey, u.runbookId, JSON.stringify(carried)],
        );
        if (made[0]) {
          await sql.query(
            "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('unit_runbook', $1, 'PM carry-over', 'options changed', $2)",
            [made[0].id, `Options carried over from PM #${data.pmId} when the unit was added to the account`],
          );
        }
      }
      await sql.query(
        `update pm_runbook_units set unit_key = $3, serial_key = coalesce(serial_key, $4)
          where pm_job_id = $1 and unit_key = $2
            and not exists (select 1 from pm_runbook_units x where x.pm_job_id = $1 and x.unit_key = $3)`,
        [data.pmId, u.pieceKey, u.unitKey, u.serialKey],
      );
      await sql.query(
        `update pm_runbook_checks c set unit_key = $3, serial_key = coalesce(c.serial_key, $4)
          where c.pm_job_id = $1 and c.unit_key = $2
            and not exists (select 1 from pm_runbook_checks x where x.pm_job_id = $1 and x.unit_key = $3 and x.key = c.key)`,
        [data.pmId, u.pieceKey, u.unitKey, u.serialKey],
      );
    }

    const saved = await sql.query<{ unit_key: string; model: string | null; interval_mo: string | null; options: unknown; added_kits: unknown }>(
      "select unit_key, model, interval_mo, options, added_kits from pm_runbook_units where pm_job_id = $1",
      [data.pmId],
    );
    const checks = await sql.query<{ unit_key: string; key: string; done_by: string | null; done_at: string }>(
      "select unit_key, key, done_by, done_at from pm_runbook_checks where pm_job_id = $1",
      [data.pmId],
    );
    // A serial was added to a unit whose options were kept under its account id: move them to the serial.
    for (const u of planned) {
      if (u.serialKey && u.accountId != null) {
        await sql.query(
          `update unit_runbook_options set unit_key = $1, serial_key = $1, updated_at = now()
            where unit_key = $2 and not exists (select 1 from unit_runbook_options where unit_key = $1)`,
          [u.serialKey, `acct:${u.accountId}`],
        );
      }
    }
    // Earlier PMs found these units by account id; now the serial is known, label them so history follows it.
    for (const u of planned) {
      if (u.serialKey && u.accountId != null) {
        for (const t of ["pm_runbook_units", "pm_runbook_checks"]) {
          await sql.query(`update ${t} set serial_key = $1 where unit_key = $2 and serial_key is null`, [
            u.serialKey,
            `acct:${u.accountId}`,
          ]);
        }
      }
    }
    const optionKeys = planned.map((u) => u.optionsKey).filter((k): k is string => !!k);
    const optRows = optionKeys.length
      ? await sql.query<{ id: number; unit_key: string; options: unknown }>(
          "select id, unit_key, options from unit_runbook_options where unit_key = any($1::text[])",
          [optionKeys],
        )
      : [];
    const ids = optRows.map((r) => r.id);
    const hist = ids.length
      ? await sql.query<{ entity_id: number; actor_name: string | null; detail: string | null; created_at: Date }>(
          optionHistorySql(),
          [ids],
        )
      : [];

    const trailKeys = planned.map((u) => u.unitKey);
    const serialKeys = planned.map((u) => u.serialKey).filter((k): k is string => !!k);
    const trail = await sql.query<{
      pm_job_id: number;
      unit_key: string;
      serial_key: string | null;
      status: string;
      completed_at: string | null;
      kits: number;
      steps: number;
    }>(
      `select c.pm_job_id, c.unit_key, c.serial_key, p.status, p.completed_at::text as completed_at,
              (count(*) filter (where c.key like 'kit:%'))::int as kits,
              (count(*) filter (where c.key like 'step:%'))::int as steps
         from pm_runbook_checks c join pm_jobs p on p.id = c.pm_job_id
        where c.pm_job_id <> $1 and (c.serial_key = any($2::text[]) or c.unit_key = any($3::text[]))
        group by c.pm_job_id, c.unit_key, c.serial_key, p.status, p.completed_at
        order by c.pm_job_id desc`,
      [data.pmId, serialKeys, trailKeys],
    );
    const now = new Date();

    // Full (completed) PMs on each unit, oldest first: same account matched by account unit, plus any PM that
    // carries the unit's serial (the unit may have been serviced under another account).
    const doneRows = await sql.query<{ id: number; equipment: string | null; style: string | null; completed_at: string | null }>(
      `select id, equipment, style, completed_at::text as completed_at from pm_jobs
        where lower(customer) = lower($1) and id <> $2 and (completed_at is not null or status = 'Completed')`,
      [pm.customer, data.pmId],
    );
    const bySerial = serialKeys.length
      ? await sql.query<{ id: number; style: string | null; completed_at: string | null; unit_key: string; interval_mo: string | null; serial_key: string }>(
          `select p.id, p.style, p.completed_at::text as completed_at, r.unit_key, r.interval_mo, r.serial_key
             from pm_runbook_units r join pm_jobs p on p.id = r.pm_job_id
            where r.serial_key = any($1::text[]) and p.id <> $2 and (p.completed_at is not null or p.status = 'Completed')`,
          [serialKeys, data.pmId],
        )
      : [];
    const savedIntervals = await sql.query<{ pm_job_id: number; unit_key: string; interval_mo: string | null }>(
      `select pm_job_id, unit_key, interval_mo from pm_runbook_units
        where pm_job_id = any($1::int[]) and interval_mo is not null`,
      [doneRows.map((r) => r.id)],
    );
    const earlierLinks = doneRows.length
      ? await sql.query<{ pm_job_id: number; piece_key: string; account_equipment_id: number }>(
          "select pm_job_id, piece_key, account_equipment_id from pm_runbook_unit_links where pm_job_id = any($1::int[])",
          [doneRows.map((r) => r.id)],
        )
      : [];
    const earlierPins: Record<number, Record<string, number>> = {};
    for (const link of earlierLinks) {
      const bag = earlierPins[link.pm_job_id] ?? (earlierPins[link.pm_job_id] = {});
      bag[link.piece_key] = Number(link.account_equipment_id);
    }
    const fullPms = (u: (typeof planned)[number], def: RunbookDefinition) =>
      earlierVisitsForUnit(def, u, doneRows, savedIntervals, bySerial, rows, earlierPins);

    const kitLog = await sql.query<{ actor_name: string | null; action: string; detail: string | null; created_at: Date }>(
      `select actor_name, action, detail, created_at from activity
        where entity_type = 'pm' and entity_id = $1 and action in ('kit added', 'kit removed')
        order by created_at desc, id desc`,
      [data.pmId],
    );
    const units: RunbookUnit[] = planned.map((u) => {
      const rb = runbookById(u.runbookId)!;
      const s = saved.find((x) => x.unit_key === u.unitKey);
      const optRow = u.optionsKey ? optRows.find((r) => r.unit_key === u.optionsKey) : undefined;
      const options = optRow ? asJson(optRow.options) : s?.options ? asJson(s.options) : {};
      const rec = recommendInterval(rb.def, u.installDate, now);
      const past = rec ? [] : fullPms(u, rb.def);
      const next = rec ? null : nextFromHistory(rb.def, past.map((p) => p.interval));
      const config = visitConfig(rb.def, {
        savedInterval: s?.interval_mo,
        style: pm.style,
        installDate: u.installDate,
        earlierIntervals: past.map((p) => p.interval),
        model: s?.model ?? u.model,
        options,
        now,
      });
      const ticks: RunbookUnit["checks"] = {};
      for (const c of checks) if (c.unit_key === u.unitKey) ticks[c.key] = { by: c.done_by, at: String(c.done_at) };
      const history = unitHistory(
        u,
        kitLog.map((h) => ({ who: h.actor_name, action: h.action, detail: h.detail, at: h.created_at })),
        optRow
          ? hist.filter((h) => h.entity_id === optRow.id).map((h) => ({ who: h.actor_name, at: h.created_at, detail: h.detail }))
          : [],
      );
      return {
        unitKey: u.unitKey,
        pieceKey: u.pieceKey,
        accountId: u.accountId,
        logged: u.accountId != null && !!u.serialKey,
        piece: u.piece,
        serial: u.serial,
        optionsKey: u.optionsKey,
        awaitingSerial: !u.serialKey && u.accountId != null,
        runbookId: u.runbookId,
        config,
        checks: ticks,
        addedKits: parseAddedKits(s?.added_kits),
        installDate: u.installDate,
        recommended: rec
          ? { ...rec, label: rb.def.intervals.find((i) => i.id === rec.id)?.label ?? `${rec.id}-month PM` }
          : null,
        missingInstallDate: !rec,
        fromHistory: next
          ? {
              id: next.id,
              combined: next.combined,
              label: rb.def.intervals.find((i) => i.id === next.id)?.label ?? `${next.id}-month PM`,
              basedOn: past.slice(-3),
            }
          : null,
        earlier: trail
          .filter((t) => (u.serialKey && t.serial_key === u.serialKey) || t.unit_key === u.unitKey)
          .map((t) => ({ pmId: t.pm_job_id, status: t.status, completedAt: t.completed_at, kits: t.kits, steps: t.steps })),
        history,
        modelPicked: unitModelPicked(s?.model, u.model),
      };
    });
    const completed = pm.status === "Completed" || !!pm.completed_at;
    return { units, accountUnits, canWrite: me.canWrite, canEditDefinitions: me.canEditDefinitions, completed };
  });

const logAssetInput = z.object({
  pmId: z.number().int().positive(),
  pieceKey: z.string().min(1).max(300),
  accountId: z.number().int().positive().nullable(),
  serial: z.string().max(80),
  installDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  /** Move the account unit that already has this serial onto this customer, then pin the line. */
  move: z.boolean().optional(),
});

/**
 * Log one runbook line as an account asset: pick a unit on this customer, or add one.
 * The model comes from the runbook. A serial is required. The install date is optional.
 * Ticks already saved under the line's piece key move on the next load, the same way a later match does.
 */
export const logRunbookAsset = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof logAssetInput>) => logAssetInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const me = await requireWriter(sql, context.userId);
    const pm = (
      await sql.query<{ customer: string; equipment: string | null }>("select customer, equipment from pm_jobs where id = $1", [data.pmId])
    )[0];
    if (!pm) throw new Error("PM not found");
    const { planned } = await loadPmRunbookPlan(sql, pm.customer, pm.equipment, data.pmId);
    const line = planned.find((u) => u.pieceKey === data.pieceKey);
    if (!line) throw new Error("That line is not a runbook unit on this PM.");
    const serialText = data.serial.trim();
    const installDate = data.installDate || null;
    let accountId = data.accountId;

    const claimSerial = async (parsed: string, key: string): Promise<number | null> => {
      const dup = (
        await sql.query<{ id: number; customer: string }>("select id, customer from account_equipment where serial_key = $1 limit 1", [key])
      )[0];
      if (!dup) return null;
      if (accountId != null && Number(dup.id) === accountId) return accountId;
      if (normalizeCustomerKey(dup.customer) === normalizeCustomerKey(pm.customer) || !data.move) {
        throw new Error(`Serial ${parsed} is already on ${dup.customer}.`);
      }
      const taken = await sql.query<{ piece_key: string }>(
        "select piece_key from pm_runbook_unit_links where pm_job_id = $1 and account_equipment_id = $2 and piece_key <> $3",
        [data.pmId, dup.id, data.pieceKey],
      );
      if (taken[0]) throw new Error("That unit is already logged on another line of this PM.");
      await sql.query("update account_equipment set customer = $2, updated_at = now() where id = $1", [Number(dup.id), pm.customer]);
      const attached = await sql.query<{ id: number; assigned_unit_label: string | null }>(
        "select id, assigned_unit_label from modules where assigned_unit_id = $1",
        [Number(dup.id)],
      );
      if (attached.length) {
        await sql.query("update modules set assigned_customer = $2, location = $2, updated_at = now() where assigned_unit_id = $1", [
          Number(dup.id),
          pm.customer,
        ]);
        for (const m of attached) {
          await sql.query(
            `insert into module_stops (module_id, kind, customer, unit_id, unit_label, from_place, to_place, by_name)
             values ($1, 'moved', $2, $3, $4, $5, $2, $6)`,
            [m.id, pm.customer, Number(dup.id), m.assigned_unit_label, dup.customer, me.name],
          );
        }
      }
      const detail = `Moved SN ${parsed} from ${dup.customer} to ${pm.customer}.`;
      for (const name of [dup.customer, pm.customer]) {
        const acct = (
          await sql.query<{ id: number }>(
            "select id from directory_customers where archived = false and lower(name) = lower($1) limit 1",
            [name],
          )
        )[0];
        if (!acct) continue;
        await sql.query(
          "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('customer', $1, $2, 'equipment moved', $3)",
          [acct.id, me.name, detail],
        );
      }
      return Number(dup.id);
    };

    if (accountId == null) {
      const parsed = parseSerial(serialText);
      if (!parsed) throw new Error("Enter the serial.");
      const key = serialKey(parsed);
      const moved = await claimSerial(parsed, key);
      if (moved != null) {
        accountId = moved;
      } else {
        const rb = runbookById(line.runbookId);
        const model = rb?.def.models.find((m) => m.id === line.model)?.label ?? line.piece;
        const inserted = await sql.query<{ id: number }>(
          `insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key, install_date)
           values ($1, $2, $2, $3, $4, $5) returning id`,
          [pm.customer, model, parsed, key, installDate],
        );
        if (!inserted[0]) throw new Error("Could not add that unit.");
        accountId = Number(inserted[0].id);
      }
    } else {
      const row = (
        await sql.query<{ id: number; customer: string; serial: string | null; serial_key: string | null; install_date: string | null }>(
          "select id, customer, serial, serial_key, install_date::text as install_date from account_equipment where id = $1",
          [accountId],
        )
      )[0];
      if (!row || normalizeCustomerKey(row.customer) !== normalizeCustomerKey(pm.customer)) {
        throw new Error("That unit is not on this account.");
      }
      const existing = parseSerial(row.serial);
      const parsed = parseSerial(serialText);
      if (!existing && !parsed) throw new Error("Enter the serial.");
      if (!existing && parsed) {
        const key = serialKey(parsed);
        const moved = await claimSerial(parsed, key);
        if (moved != null && moved !== accountId) accountId = moved;
        else if (moved == null) {
          await sql.query(
            `update account_equipment
                set serial = $2, serial_key = $3, install_date = coalesce(install_date, $4), updated_at = now()
              where id = $1`,
            [accountId, parsed, key, installDate],
          );
        }
      } else if (installDate && !row.install_date) {
        await sql.query("update account_equipment set install_date = $2, updated_at = now() where id = $1", [accountId, installDate]);
      }
    }
    const taken = await sql.query<{ piece_key: string }>(
      "select piece_key from pm_runbook_unit_links where pm_job_id = $1 and account_equipment_id = $2 and piece_key <> $3",
      [data.pmId, accountId, data.pieceKey],
    );
    if (taken[0]) throw new Error("That account unit is already logged on another line of this PM.");
    await sql.query(
      `insert into pm_runbook_unit_links (pm_job_id, piece_key, account_equipment_id)
       values ($1, $2, $3)
       on conflict (pm_job_id, piece_key) do update set account_equipment_id = excluded.account_equipment_id`,
      [data.pmId, data.pieceKey, accountId],
    );
    return { ok: true, accountId };
  });

/** The unit's serial (not 'acct:<id>'), so earlier PMs are found by serial. Null when there is none yet. */
const serialOf = (optionsKey: string | null | undefined) => checkSerialKey(optionsKey);

const configInput = unitInput.extend({
  optionsKey: z.string().max(200).nullable().optional(),
  runbookId: z.string(),
  model: z.string(),
  interval: z.string(),
});

/** Model and PM interval for this job and unit. */
export const setRunbookUnitConfig = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof configInput>) => configInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const me = await requireWriter(sql, context.userId);
    const rb = runbookById(data.runbookId);
    if (!rb) throw new Error("Unknown runbook.");
    if (!rb.def.models.some((m) => m.id === data.model)) throw new Error("Unknown model.");
    if (!rb.def.intervals.some((i) => i.id === data.interval)) throw new Error("Unknown interval.");
    await sql.query(
      `insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, model, interval_mo, updated_by, serial_key)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (pm_job_id, unit_key) do update
         set model = excluded.model, interval_mo = excluded.interval_mo, updated_by = excluded.updated_by,
             serial_key = coalesce(excluded.serial_key, pm_runbook_units.serial_key), updated_at = now()`,
      [data.pmId, data.unitKey, data.runbookId, data.model, data.interval, me.name, serialOf(data.optionsKey)],
    );
    return { ok: true };
  });

const optionsInput = unitInput.extend({
  runbookId: z.string(),
  options: z.record(z.string(), z.string()),
  /** Serial or 'acct:<id>' (from getPmRunbook); null keeps the options with this PM only. */
  optionsKey: z.string().max(200).nullable(),
});

/** Machine options. Keyed by serial so they follow the unit between warehouse and accounts; changes go to `activity`. */
export const setRunbookUnitOptions = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof optionsInput>) => optionsInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const me = await requireWriter(sql, context.userId);
    const rb = runbookById(data.runbookId);
    if (!rb) throw new Error("Unknown runbook.");
    const next: Record<string, string> = {};
    for (const o of rb.def.options) {
      const v = data.options[o.key];
      if (v == null) continue;
      if (!o.choices.some((c) => c.val === v)) throw new Error(`'${v}' is not a choice for ${o.label}.`);
      next[o.key] = v;
    }
    const label = (key: string, val: string | undefined) => {
      const o = rb.def.options.find((x) => x.key === key);
      return val == null ? "not set" : (o?.choices.find((c) => c.val === val)?.label ?? val);
    };
    if (!data.optionsKey) {
      await sql.query(
        `insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, options, updated_by)
         values ($1, $2, $3, $4::jsonb, $5)
         on conflict (pm_job_id, unit_key) do update
           set options = excluded.options, updated_by = excluded.updated_by, updated_at = now()`,
        [data.pmId, data.unitKey, data.runbookId, JSON.stringify(next), me.name],
      );
      return { ok: true };
    }
    const cur = (
      await sql.query<{ id: number; options: unknown }>("select id, options from unit_runbook_options where unit_key = $1", [
        data.optionsKey,
      ])
    )[0];
    const before = cur ? asJson(cur.options) : {};
    const row = (
      await sql.query<{ id: number }>(
        `insert into unit_runbook_options (unit_key, serial_key, runbook_id, options, updated_by)
         values ($1, case when $1 like 'acct:%' then null else $1 end, $2, $3::jsonb, $4)
         on conflict (unit_key) do update
           set options = excluded.options, runbook_id = excluded.runbook_id,
               updated_by = excluded.updated_by, updated_at = now()
         returning id`,
        [data.optionsKey, data.runbookId, JSON.stringify(next), me.name],
      )
    )[0];
    const changes: string[] = [];
    for (const o of rb.def.options) {
      const a = typeof before[o.key] === "string" ? (before[o.key] as string) : undefined;
      const b = next[o.key];
      if (a !== b) changes.push(`${o.label}: ${label(o.key, a)} → ${label(o.key, b)}`);
    }
    if (changes.length) {
      await sql.query(
        "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('unit_runbook', $1, $2, 'options changed', $3)",
        [row.id, me.name, changes.join("; ")],
      );
    }
    return { ok: true };
  });

const checkInput = unitInput.extend({
  optionsKey: z.string().max(200).nullable().optional(),
  key: z.string().regex(CHECK_KEY_RE),
  done: z.boolean(),
});

export const setRunbookCheck = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof checkInput>) => checkInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const me = await requireWriter(sql, context.userId);
    if (data.done) {
      await sql.query(
        `insert into pm_runbook_checks (pm_job_id, unit_key, key, done_by, serial_key) values ($1, $2, $3, $4, $5)
         on conflict (pm_job_id, unit_key, key) do nothing`,
        [data.pmId, data.unitKey, data.key, me.name, serialOf(data.optionsKey)],
      );
    } else {
      await sql.query("delete from pm_runbook_checks where pm_job_id = $1 and unit_key = $2 and key = $3", [
        data.pmId,
        data.unitKey,
        data.key,
      ]);
    }
    return { ok: true };
  });

export const clearRunbookChecks = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof unitInput>) => unitInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    await requireWriter(sql, context.userId);
    await sql.query("delete from pm_runbook_checks where pm_job_id = $1 and unit_key = $2", [data.pmId, data.unitKey]);
    return { ok: true };
  });

const addedInput = unitInput.extend({
  runbookId: z.string().max(80),
  ev: z.string().regex(KIT_NUMBER_RE),
  on: z.boolean(),
});

/** Add or remove one optional kit on this PM unit. Adding does not tick it. Removing clears the tick only when the kit is not already on this visit. */
export const setRunbookAddedKit = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof addedInput>) => addedInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const me = await requireWriter(sql, context.userId);
    if (await pmIsCompleted(sql, data.pmId)) throw new Error("This PM is completed.");
    const rb = runbookById(data.runbookId);
    if (!rb) throw new Error("Unknown runbook.");
    const pm = (
      await sql.query<{ customer: string; equipment: string | null; style: string | null }>("select customer, equipment, style from pm_jobs where id = $1", [data.pmId])
    )[0];
    if (!pm) throw new Error("PM not found.");
    const plan = await loadPmRunbookPlan(sql, pm.customer, pm.equipment, data.pmId);
    const unit = plan.planned.find((u) => u.unitKey === data.unitKey && u.runbookId === data.runbookId);
    if (!unit) throw new Error("This unit is not on this PM.");
    const config = await loadVisitConfig(sql, rb.def, { id: data.pmId, customer: pm.customer, style: pm.style }, unit);
    const next = changeAddedKits(rb.def, config, data.on ? [] : [data.ev], data.ev, data.on);
    if (!next.ok) throw new Error(next.reason);
    const detail = addedKitDetail(addedKitSentence(rb.def, data.ev, data.on), unit.unitKey, unit.pieceKey);
    if (data.on) {
      await sql.query(pmAddKitSql(), [data.pmId, unit.unitKey, data.runbookId, data.ev, me.name, serialOf(unit.optionsKey), detail]);
    } else {
      const clear = removedKitCheckKeys(rb.def, config, data.ev, next.dropTick);
      await sql.query(pmRemoveKitSql(), [data.pmId, unit.unitKey, data.ev, me.name, detail, clear]);
    }
    return { ok: true };
  });

export async function pmIsCompleted(sql: Sql, pmId: number): Promise<boolean> {
  const row = (await sql.query<{ status: string; completed_at: string | null }>("select status, completed_at::text as completed_at from pm_jobs where id = $1", [pmId]))[0];
  if (!row) throw new Error("PM not found.");
  return row.status === "Completed" || !!row.completed_at;
}

/**
 * Sell prices for kit numbers from the parts catalog. A kit is matched to the part already in the Parts list by
 * SKU or manufacturer number (case, spaces and dashes ignored), and an Eversys kit by its six digits, so the
 * guides' "EV117077" finds the Parts list's "EVER117077". Read-only. Kits the catalog does not have are absent.
 */
export const getKitPrices = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { evs: string[]; runbookId?: string }) =>
    z.object({ evs: z.array(z.string().min(1).max(40)).max(200), runbookId: z.string().max(80).optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<Record<string, CatalogKit>> => {
    const prefix = prefixForManufacturer(runbookById(data.runbookId ?? "")?.def.manufacturer);
    const keys = [...new Set(data.evs.flatMap((ev) => catalogKeys(ev, prefix)))];
    if (!keys.length) return {};
    const sql = await ready();
    const rows = await sql.query<{
      sku: string;
      item: string | null;
      description: string | null;
      mfr_part: string | null;
      rate: string | null;
      active: unknown;
      hidden: unknown;
    }>(
      `select sku, item, description, mfr_part, rate, active, (hidden_at is not null) as hidden
         from billing_items
        where upper(regexp_replace(sku, '[^A-Za-z0-9]+', '', 'g')) = any($1::text[])
           or upper(regexp_replace(coalesce(mfr_part, ''), '[^A-Za-z0-9]+', '', 'g')) = any($1::text[])
        order by id`,
      [keys],
    );
    return pickCatalog(
      data.evs,
      rows.map((r) => ({
        sku: r.sku,
        name: r.item,
        description: r.description,
        mfrPart: r.mfr_part,
        rate: r.rate == null ? null : Number(r.rate),
        active: flagOn(r.active),
        hidden: flagOn(r.hidden),
      })),
      prefix,
    );
  });
