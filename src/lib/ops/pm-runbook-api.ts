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
  normalizeConfig,
  type RunbookRole,
} from "@/lib/ops/pm-runbook";
import { planUnits } from "@/lib/ops/pm-runbook-units";
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

    const acct = await sql.query<{ id: number; customer: string; catalog_model: string; equipment_name: string; serial: string | null }>(
      "select id, customer, catalog_model, equipment_name, serial from account_equipment where lower(customer) = lower($1) order by id",
      [pm.customer],
    );
    const key = normalizeCustomerKey(pm.customer);
    const rows = acct
      .filter((r) => normalizeCustomerKey(r.customer) === key)
      .map((r) => ({ id: r.id, catalogModel: r.catalog_model, equipmentName: r.equipment_name, serial: r.serial }));

    const planned = planUnits(pm.equipment, rows, (piece) => {
      for (const rb of RUNBOOKS) {
        const h = rb.matchPiece(piece);
        if (h) return { runbookId: rb.def.id, model: h.model };
      }
      return null;
    });
    if (!planned.length) return empty;

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

    const units: RunbookUnit[] = planned.map((u) => {
      const rb = runbookById(u.runbookId)!;
      const s = saved.find((x) => x.unit_key === u.unitKey);
      const optRow = u.optionsKey ? optRows.find((r) => r.unit_key === u.optionsKey) : undefined;
      const options = optRow ? asJson(optRow.options) : s?.options ? asJson(s.options) : {};
      const config = normalizeConfig(rb.def, {
        ...options,
        model: s?.model ?? u.model ?? undefined,
        pm: s?.interval_mo ?? intervalFromStyle(rb.def, pm.style) ?? undefined,
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

const configInput = unitInput.extend({
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
      `insert into pm_runbook_units (pm_job_id, unit_key, runbook_id, model, interval_mo, updated_by)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (pm_job_id, unit_key) do update
         set model = excluded.model, interval_mo = excluded.interval_mo, updated_by = excluded.updated_by, updated_at = now()`,
      [data.pmId, data.unitKey, data.runbookId, data.model, data.interval, me.name],
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
        `insert into pm_runbook_checks (pm_job_id, unit_key, key, done_by) values ($1, $2, $3, $4)
         on conflict (pm_job_id, unit_key, key) do nothing`,
        [data.pmId, data.unitKey, data.key, me.name],
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
