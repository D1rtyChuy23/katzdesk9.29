/**
 * PM runbook — server functions. Options live with the unit (keyed by serial, history in `activity`); ticks and
 * the model/interval choice live per PM job and unit. Admin and service write; everyone else reads.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { normalizeCustomerKey } from "@/lib/ops/account-equip";
import { RUNBOOKS, runbookById } from "@/lib/ops/runbooks";
import {
  canEditRunbookDefinitions,
  canWriteRunbook,
  intervalFromStyle,
  nextFromHistory,
  normalizeConfig,
  recommendInterval,
  type RunbookRole,
} from "@/lib/ops/pm-runbook";
import { planUnits } from "@/lib/ops/pm-runbook-units";
import { kitKey, type CatalogKit } from "@/lib/ops/pm-runbook-prices";
import type { RunbookConfig } from "@/lib/ops/pm-runbook-schema";

export type RunbookUnit = {
  unitKey: string;
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
};

export type PmRunbookData = {
  units: RunbookUnit[];
  canWrite: boolean;
  canEditDefinitions: boolean;
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

async function requireWriter(sql: Sql, userId: string) {
  const me = await who(sql, userId);
  if (!me.canWrite) throw new Error("Only Service and Admin can change the runbook.");
  return me;
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
    const empty = { units: [], canWrite: me.canWrite, canEditDefinitions: me.canEditDefinitions };
    const pm = (
      await sql.query<{ customer: string; equipment: string | null; style: string | null }>(
        "select customer, equipment, style from pm_jobs where id = $1",
        [data.pmId],
      )
    )[0];
    if (!pm) return empty;

    const acct = await sql.query<{ id: number; customer: string; catalog_model: string; equipment_name: string; serial: string | null; install_date: string | null }>(
      "select id, customer, catalog_model, equipment_name, serial, install_date::text as install_date from account_equipment where lower(customer) = lower($1) order by id",
      [pm.customer],
    );
    const key = normalizeCustomerKey(pm.customer);
    const rows = acct
      .filter((r) => normalizeCustomerKey(r.customer) === key)
      .map((r) => ({ id: r.id, catalogModel: r.catalog_model, equipmentName: r.equipment_name, serial: r.serial, installDate: r.install_date }));

    const planned = planUnits(pm.equipment, rows, (piece) => {
      for (const rb of RUNBOOKS) {
        const h = rb.matchPiece(piece);
        if (h) return { runbookId: rb.def.id, model: h.model };
      }
      return null;
    });
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

    const saved = await sql.query<{ unit_key: string; model: string | null; interval_mo: string | null; options: unknown }>(
      "select unit_key, model, interval_mo, options from pm_runbook_units where pm_job_id = $1",
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
      ? await sql.query<{ entity_id: number; actor_name: string | null; detail: string | null; created_at: string }>(
          `select entity_id, actor_name, detail, created_at from activity
            where entity_type = 'unit_runbook' and entity_id = any($1::int[]) order by created_at desc, id desc limit 100`,
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
    const pmMatcher = (piece: string) => {
      for (const rb of RUNBOOKS) {
        const h = rb.matchPiece(piece);
        if (h) return { runbookId: rb.def.id, model: h.model };
      }
      return null;
    };
    const fullPms = (u: (typeof planned)[number], def: NonNullable<ReturnType<typeof runbookById>>["def"]) => {
      const out = new Map<number, { pmId: number; interval: string; completedAt: string | null }>();
      for (const d of doneRows) {
        const hit = planUnits(d.equipment, rows, pmMatcher).find((x) => x.unitKey === u.unitKey);
        if (!hit) continue;
        const interval =
          savedIntervals.find((s) => s.pm_job_id === d.id && s.unit_key === u.unitKey)?.interval_mo ?? intervalFromStyle(def, d.style);
        if (interval) out.set(d.id, { pmId: d.id, interval, completedAt: d.completed_at });
      }
      for (const b of bySerial) {
        if (!u.serialKey || b.serial_key !== u.serialKey) continue;
        const interval = b.interval_mo ?? intervalFromStyle(def, b.style);
        if (interval) out.set(b.id, { pmId: b.id, interval, completedAt: b.completed_at });
      }
      return [...out.values()].sort((a, b) => (a.completedAt ?? "9999").localeCompare(b.completedAt ?? "9999") || a.pmId - b.pmId);
    };

    const units: RunbookUnit[] = planned.map((u) => {
      const rb = runbookById(u.runbookId)!;
      const s = saved.find((x) => x.unit_key === u.unitKey);
      const optRow = u.optionsKey ? optRows.find((r) => r.unit_key === u.optionsKey) : undefined;
      const options = optRow ? asJson(optRow.options) : s?.options ? asJson(s.options) : {};
      const rec = recommendInterval(rb.def, u.installDate, now);
      const past = rec ? [] : fullPms(u, rb.def);
      const next = rec ? null : nextFromHistory(rb.def, past.map((p) => p.interval));
      const histNext = next ? { id: next.id, combined: next.combined } : null;
      const config = normalizeConfig(rb.def, {
        ...options,
        model: s?.model ?? u.model ?? undefined,
        pm: s?.interval_mo ?? intervalFromStyle(rb.def, pm.style) ?? rec?.id ?? histNext?.id ?? undefined,
      });
      const ticks: RunbookUnit["checks"] = {};
      for (const c of checks) if (c.unit_key === u.unitKey) ticks[c.key] = { by: c.done_by, at: String(c.done_at) };
      return {
        unitKey: u.unitKey,
        piece: u.piece,
        serial: u.serial,
        optionsKey: u.optionsKey,
        awaitingSerial: !u.serialKey && u.accountId != null,
        runbookId: u.runbookId,
        config,
        checks: ticks,
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
        history: optRow
          ? hist
              .filter((h) => h.entity_id === optRow.id)
              .slice(0, 8)
              .map((h) => ({ who: h.actor_name, at: String(h.created_at), detail: h.detail ?? "" }))
          : [],
      };
    });
    return { units, canWrite: me.canWrite, canEditDefinitions: me.canEditDefinitions };
  });

/** The unit's serial (not 'acct:<id>'), so earlier PMs are found by serial. Null when there is none yet. */
const serialOf = (optionsKey: string | null | undefined) => (optionsKey && !optionsKey.startsWith("acct:") ? optionsKey : null);

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
  key: z.string().regex(/^(kit|step):[A-Za-z0-9._-]{1,80}$/),
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

/**
 * Sell prices for kit numbers from the parts catalog, matched on SKU or manufacturer number (case, spaces and
 * dashes ignored). Read-only. Kits the catalog does not have are simply absent from the result.
 */
export const getKitPrices = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { evs: string[] }) => z.object({ evs: z.array(z.string().min(1).max(40)).max(200) }).parse(d))
  .handler(async ({ data }): Promise<Record<string, CatalogKit>> => {
    const keys = [...new Set(data.evs.map(kitKey).filter(Boolean))];
    if (!keys.length) return {};
    const sql = await ready();
    const rows = await sql.query<{
      sku: string;
      item: string | null;
      mfr_part: string | null;
      rate: string | null;
      active: unknown;
      hidden: unknown;
    }>(
      `select sku, item, mfr_part, rate, active, (hidden_at is not null) as hidden
         from billing_items
        where upper(regexp_replace(sku, '[^A-Za-z0-9]+', '', 'g')) = any($1::text[])
           or upper(regexp_replace(coalesce(mfr_part, ''), '[^A-Za-z0-9]+', '', 'g')) = any($1::text[])
        order by id`,
      [keys],
    );
    const out: Record<string, CatalogKit> = {};
    for (const r of rows) {
      const entry: CatalogKit = {
        sku: r.sku,
        name: r.item,
        rate: r.rate == null ? null : Number(r.rate),
        active: flagOn(r.active),
        hidden: flagOn(r.hidden),
      };
      for (const k of [kitKey(r.sku), kitKey(r.mfr_part)]) {
        if (!keys.includes(k)) continue;
        // Two catalog rows can carry one number: prefer the one that is active, visible and priced.
        const cur = out[k];
        const score = (c: CatalogKit) => (c.active && !c.hidden ? 2 : 0) + (c.rate != null && c.rate > 0 ? 1 : 0);
        if (!cur || score(entry) > score(cur)) out[k] = entry;
      }
    }
    return out;
  });
