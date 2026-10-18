/**
 * Module runbook — one service per module, on the bench or during a PM.
 * The lists are the PM runbook's kits and steps for that module type. Completing writes the checked kits
 * onto the module's parts log. Admin and service write; everyone else reads.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { loadPmRunbookPlan, pmIsCompleted, writeUnitAddedKits } from "@/lib/ops/pm-runbook-api";
import {
  canWriteRunbook,
  MODULE_NOT_ON_PM,
  changeAddedKits,
  checkSerialKey,
  checksForModuleSheet,
  moduleBenchConfig,
  moduleKitListText,
  moduleOnThisPm,
  moduleRunbookGroups,
  moduleServiceOptions,
  moduleServiceView,
  moduleServiceWorkLines,
  normalizeConfig,
  optionalKits,
  optionalKitsLeft,
  parseAddedKits,
  type KitLine,
  type RunbookRole,
  type SharedCheck,
  type StepGroup,
} from "@/lib/ops/pm-runbook";
import { catalogKeys, kitKey, pickCatalog } from "@/lib/ops/pm-runbook-prices";
import type { RunbookConfig } from "@/lib/ops/pm-runbook-schema";
import { runbookForPlatform } from "@/lib/ops/runbooks";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const asJson = (v: unknown): Record<string, string> => {
  const x = typeof v === "string" ? JSON.parse(v) : v;
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(x as Record<string, unknown>)) if (typeof val === "string") out[k] = val;
  return out;
};

async function who(sql: Sql, userId: string) {
  const rows = await sql.query<{ is_admin: unknown; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const r = rows[0];
  return {
    name: r?.username || "Teammate",
    canWrite: canWriteRunbook((r?.desk_role ?? null) as RunbookRole, flagOn(r?.is_admin)),
  };
}

type ServiceRow = {
  id: number;
  runbook_id: string;
  interval_mo: string | null;
  options: unknown;
  started_by: string | null;
  started_at: string;
  completed_by: string | null;
  completed_at: string | null;
  added_kits: unknown;
};

const scope = z.object({
  moduleId: z.number().int().positive(),
  context: z.enum(["bench", "pm"]),
  pmId: z.number().int().positive().nullable().optional(),
});

export type ModuleRunbookData = {
  covered: boolean;
  title: string | null;
  serviceId: number | null;
  completed: boolean;
  canWrite: boolean;
  interval: string | null;
  intervals: { id: string; label: string }[];
  options: { key: string; label: string; value: string; choices: { val: string; label: string }[] }[];
  kits: KitLine[];
  /** Longer-interval kits for this module that are not on the list yet. */
  optional: KitLine[];
  steps: StepGroup[];
  checks: Record<string, { who: string | null; at: string }>;
  copyText: string;
  /** Set when the sheet cannot open for a reason other than "no runbook yet". */
  notice: string | null;
  /** The PM itself is completed, so on-site kits stay as they are. */
  pmCompleted: boolean;
};

async function findService(sql: Sql, moduleId: number, context: "bench" | "pm", pmId: number | null): Promise<ServiceRow | null> {
  const open = await sql.query<ServiceRow>(
    context === "bench"
      ? `select id, runbook_id, interval_mo, options, added_kits, started_by, started_at::text as started_at, completed_by, completed_at::text as completed_at
           from module_runbook_services
          where module_id = $1 and context = 'bench' and completed_at is null
          order by id desc limit 1`
      : `select id, runbook_id, interval_mo, options, added_kits, started_by, started_at::text as started_at, completed_by, completed_at::text as completed_at
           from module_runbook_services
          where module_id = $1 and context = 'pm' and pm_job_id = $2 and completed_at is null
          order by id desc limit 1`,
    context === "bench" ? [moduleId] : [moduleId, pmId],
  );
  if (open[0]) return open[0];
  const done = await sql.query<ServiceRow>(
    context === "bench"
      ? `select id, runbook_id, interval_mo, options, added_kits, started_by, started_at::text as started_at, completed_by, completed_at::text as completed_at
           from module_runbook_services where module_id = $1 and context = 'bench' order by id desc limit 1`
      : `select id, runbook_id, interval_mo, options, added_kits, started_by, started_at::text as started_at, completed_by, completed_at::text as completed_at
           from module_runbook_services where module_id = $1 and context = 'pm' and pm_job_id = $2 order by id desc limit 1`,
    context === "bench" ? [moduleId] : [moduleId, pmId],
  );
  return done[0] ?? null;
}

async function ensureService(
  sql: Sql,
  moduleId: number,
  context: "bench" | "pm",
  pmId: number | null,
  runbookId: string,
  actor: string,
): Promise<ServiceRow> {
  const open = await findService(sql, moduleId, context, pmId);
  if (open && !open.completed_at) return open;
  const inserted = await sql.query<ServiceRow>(
    `insert into module_runbook_services (module_id, context, pm_job_id, runbook_id, started_by)
     values ($1, $2, $3, $4, $5)
     returning id, runbook_id, interval_mo, options, added_kits, started_by, started_at::text as started_at, completed_by, completed_at::text as completed_at`,
    [moduleId, context, context === "pm" ? pmId : null, runbookId, actor],
  );
  return inserted[0]!;
}

async function unitOnPm(sql: Sql, pmId: number, assignedUnitId: number | null) {
  if (assignedUnitId == null) return null;
  const pm = (await sql.query<{ customer: string; equipment: string | null }>("select customer, equipment from pm_jobs where id = $1", [pmId]))[0];
  if (!pm) return null;
  const plan = await loadPmRunbookPlan(sql, pm.customer, pm.equipment, pmId);
  if (!moduleOnThisPm(plan.planned.map((u) => u.accountId), assignedUnitId)) return null;
  return plan.planned.find((u) => u.accountId === assignedUnitId) ?? null;
}

async function configFor(
  sql: Sql,
  def: Parameters<typeof moduleBenchConfig>[0],
  moduleType: string,
  service: ServiceRow | null,
  context: "bench" | "pm",
  pmId: number | null,
  pmUnit: Awaited<ReturnType<typeof unitOnPm>>,
): Promise<RunbookConfig> {
  const saved = asJson(service?.options);
  if (context === "pm" && pmId && pmUnit) {
    const job = (
      await sql.query<{ model: string | null; interval_mo: string | null; options: unknown }>(
        "select model, interval_mo, options from pm_runbook_units where pm_job_id = $1 and unit_key = $2",
        [pmId, pmUnit.unitKey],
      )
    )[0];
    const opt = pmUnit.optionsKey
      ? (await sql.query<{ options: unknown }>("select options from unit_runbook_options where unit_key = $1", [pmUnit.optionsKey]))[0]
      : null;
    return normalizeConfig(def, {
      ...asJson(opt?.options ?? job?.options),
      model: job?.model ?? pmUnit.model ?? undefined,
      pm: job?.interval_mo ?? undefined,
    });
  }
  return moduleBenchConfig(def, moduleType, service?.interval_mo, saved);
}

async function viewOf(sql: Sql, data: z.infer<typeof scope>, userId: string): Promise<ModuleRunbookData> {
  const sqlReady = sql;
  const me = await who(sqlReady, userId);
  const mod = (
    await sqlReady.query<{ module_type: string | null; platform: string | null; assigned_unit_id: number | null }>(
      "select module_type, platform, assigned_unit_id from modules where id = $1",
      [data.moduleId],
    )
  )[0];
  const empty: ModuleRunbookData = {
    covered: false,
    title: null,
    serviceId: null,
    completed: false,
    canWrite: me.canWrite,
    interval: null,
    intervals: [],
    options: [],
    kits: [],
    optional: [],
    steps: [],
    checks: {},
    copyText: "",
    notice: null,
    pmCompleted: false,
  };
  if (!mod) return empty;
  const rb = runbookForPlatform(mod.platform);
  if (!rb || !moduleRunbookGroups(rb.def, mod.module_type)) return empty;
  if (data.context === "pm" && !data.pmId) return empty;
  const pmUnit = data.context === "pm" && data.pmId ? await unitOnPm(sqlReady, data.pmId, mod.assigned_unit_id) : null;
  if (data.context === "pm" && !pmUnit) return { ...empty, notice: MODULE_NOT_ON_PM };
  const service = await findService(sqlReady, data.moduleId, data.context, data.pmId ?? null);
  const config = await configFor(sqlReady, rb.def, mod.module_type!, service, data.context, data.pmId ?? null, pmUnit);
  let added: string[] = [];
  if (data.context === "pm" && data.pmId && pmUnit) {
    const row = (
      await sqlReady.query<{ added_kits: unknown }>("select added_kits from pm_runbook_units where pm_job_id = $1 and unit_key = $2", [data.pmId, pmUnit.unitKey])
    )[0];
    added = parseAddedKits(row?.added_kits);
  } else added = parseAddedKits(service?.added_kits);
  const view = moduleServiceView(rb.def, config, mod.module_type, added);
  if (!view) return empty;
  const moduleKeys = [
    ...view.kits.map((k) => `kit:${k.ev}`),
    ...view.steps.flatMap((g) => g.items.map((s) => `step:${s.id}`)),
  ];
  let unitChecks: SharedCheck[] = [];
  let benchChecks: SharedCheck[] = [];
  if (data.context === "pm" && data.pmId && pmUnit) {
    const rows = await sqlReady.query<{ key: string; done_by: string | null; done_at: string }>(
      "select key, done_by, done_at::text as done_at from pm_runbook_checks where pm_job_id = $1 and unit_key = $2",
      [data.pmId, pmUnit.unitKey],
    );
    unitChecks = rows.map((r) => ({ key: r.key, who: r.done_by, at: r.done_at }));
  } else if (service) {
    const rows = await sqlReady.query<{ key: string; done_by: string | null; done_at: string }>(
      "select key, done_by, done_at::text as done_at from module_runbook_checks where service_id = $1",
      [service.id],
    );
    benchChecks = rows.map((r) => ({ key: r.key, who: r.done_by, at: r.done_at }));
  }
  const checks: ModuleRunbookData["checks"] = {};
  for (const r of checksForModuleSheet(data.context, moduleKeys, unitChecks, benchChecks)) checks[r.key] = { who: r.who, at: r.at };
  const interval = rb.def.intervals.find((i) => i.id === config.pm);
  const pmCompleted = data.context === "pm" && data.pmId ? await pmIsCompleted(sqlReady, data.pmId) : false;
  return {
    covered: true,
    title: `${mod.module_type} · ${rb.def.title}`,
    serviceId: service?.id ?? null,
    completed: !!service?.completed_at,
    canWrite: me.canWrite,
    interval: config.pm,
    intervals: rb.def.intervals.map((i) => ({ id: i.id, label: i.label })),
    options: moduleServiceOptions(rb.def, mod.module_type).map((o) => ({
      key: o.key,
      label: o.label,
      value: String(config[o.key] ?? ""),
      choices: o.choices,
    })),
    kits: view.kits,
    optional: optionalKitsLeft(rb.def, config, added, view.groups),
    steps: view.steps,
    checks,
    copyText: moduleKitListText(mod.module_type!, interval?.label ?? `${config.pm}-month PM`, view.kits),
    notice: null,
    pmCompleted,
  };
}

export const getModuleRunbook = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof scope>) => scope.parse(d))
  .handler(async ({ data, context }): Promise<ModuleRunbookData> => viewOf(await ready(), data, context.userId));

const saveInput = scope.extend({
  interval: z.string().max(20).optional(),
  optionKey: z.string().max(40).optional(),
  optionValue: z.string().max(40).optional(),
  checkKey: z.string().max(80).optional(),
  checked: z.boolean().optional(),
  again: z.boolean().optional(),
  addEv: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/).optional(),
  addOn: z.boolean().optional(),
});

export const saveModuleRunbook = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof saveInput>) => saveInput.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const me = await who(sql, context.userId);
    if (!me.canWrite) throw new Error("Only Service and Admin can change the runbook.");
    if (data.context === "pm" && !data.pmId) throw new Error("This service needs a PM.");
    const mod = (
      await sql.query<{ module_type: string | null; platform: string | null; assigned_unit_id: number | null }>(
        "select module_type, platform, assigned_unit_id from modules where id = $1",
        [data.moduleId],
      )
    )[0];
    const rb = mod ? runbookForPlatform(mod.platform) : null;
    if (!mod || !rb || !moduleRunbookGroups(rb.def, mod.module_type)) throw new Error("No runbook for this module type yet.");
    if (data.context === "pm") {
      if (data.interval || data.optionKey || data.optionValue) throw new Error("Interval and options come from the PM.");
      const unit = await unitOnPm(sql, data.pmId!, mod.assigned_unit_id);
      if (!unit) throw new Error(MODULE_NOT_ON_PM);
      const existing = await findService(sql, data.moduleId, data.context, data.pmId ?? null);
      if (existing?.completed_at && !data.again) throw new Error("This service is already completed.");
      if (data.addEv && data.addOn != null) {
        if (await pmIsCompleted(sql, data.pmId!)) throw new Error("This PM is completed.");
        const config = await configFor(sql, rb.def, mod.module_type!, existing, "pm", data.pmId ?? null, unit);
        const groups = moduleRunbookGroups(rb.def, mod.module_type) ?? [];
        const row = (
          await sql.query<{ added_kits: unknown }>("select added_kits from pm_runbook_units where pm_job_id = $1 and unit_key = $2", [data.pmId, unit.unitKey])
        )[0];
        const next = changeAddedKits(rb.def, config, parseAddedKits(row?.added_kits), data.addEv, data.addOn, groups);
        if (!next.ok) throw new Error(next.reason);
        if (next.changed) {
          await writeUnitAddedKits(sql, data.pmId!, unit.unitKey, rb.def.id, unit.optionsKey, next.added, me.name);
          const name = optionalKits(rb.def, config).find((k) => k.ev === data.addEv)?.name ?? data.addEv;
          await sql.query(
            "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('pm', $1, $2, $3, $4)",
            [data.pmId, me.name, data.addOn ? "kit added" : "kit removed", `${unit.unitKey}: ${data.addEv} ${name}`],
          );
        }
        if (next.dropTick) {
          await sql.query("delete from pm_runbook_checks where pm_job_id = $1 and unit_key = $2 and key = $3", [data.pmId, unit.unitKey, `kit:${data.addEv}`]);
        }
      }
      if (data.checkKey && data.checked != null) {
        if (!/^(kit|step):[A-Za-z0-9._-]{1,80}$/.test(data.checkKey)) throw new Error("Unknown check.");
        await ensureService(sql, data.moduleId, data.context, data.pmId ?? null, rb.def.id, me.name);
        if (data.checked) {
          await sql.query(
            `insert into pm_runbook_checks (pm_job_id, unit_key, key, done_by, serial_key) values ($1, $2, $3, $4, $5)
             on conflict (pm_job_id, unit_key, key) do nothing`,
            [data.pmId, unit.unitKey, data.checkKey, me.name, checkSerialKey(unit.optionsKey)],
          );
        } else {
          await sql.query("delete from pm_runbook_checks where pm_job_id = $1 and unit_key = $2 and key = $3", [data.pmId, unit.unitKey, data.checkKey]);
        }
      } else if (data.again) {
        await ensureService(sql, data.moduleId, data.context, data.pmId ?? null, rb.def.id, me.name);
      }
      return viewOf(sql, data, context.userId);
    }
    const existing = await findService(sql, data.moduleId, data.context, data.pmId ?? null);
    if (existing?.completed_at && !data.again) throw new Error("This service is already completed.");
    const service = await ensureService(sql, data.moduleId, data.context, data.pmId ?? null, rb.def.id, me.name);
    if (data.interval) {
      if (!rb.def.intervals.some((i) => i.id === data.interval)) throw new Error("Unknown interval.");
      await sql.query("update module_runbook_services set interval_mo = $2 where id = $1", [service.id, data.interval]);
    }
    if (data.optionKey && data.optionValue != null && data.context === "bench") {
      const opt = moduleServiceOptions(rb.def, mod.module_type).find((o) => o.key === data.optionKey);
      if (!opt || !opt.choices.some((c) => c.val === data.optionValue)) throw new Error("Unknown option.");
      await sql.query("update module_runbook_services set options = options || $2::jsonb where id = $1", [
        service.id,
        JSON.stringify({ [data.optionKey]: data.optionValue }),
      ]);
    }
    if (data.addEv && data.addOn != null) {
      const fresh = (
        await sql.query<ServiceRow>(
          "select id, runbook_id, interval_mo, options, added_kits, started_by, started_at::text as started_at, completed_by, completed_at::text as completed_at from module_runbook_services where id = $1",
          [service.id],
        )
      )[0];
      const config = moduleBenchConfig(rb.def, mod.module_type!, fresh?.interval_mo, asJson(fresh?.options));
      const groups = moduleRunbookGroups(rb.def, mod.module_type) ?? [];
      const next = changeAddedKits(rb.def, config, parseAddedKits(fresh?.added_kits), data.addEv, data.addOn, groups);
      if (!next.ok) throw new Error(next.reason);
      if (next.changed) {
        await sql.query("update module_runbook_services set added_kits = $2::jsonb where id = $1", [service.id, JSON.stringify(next.added)]);
        const name = optionalKits(rb.def, config).find((k) => k.ev === data.addEv)?.name ?? data.addEv;
        await sql.query(
          "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('module', $1, $2, $3, $4)",
          [data.moduleId, me.name, data.addOn ? "kit added" : "kit removed", `${data.addEv} ${name}`],
        );
      }
      if (next.dropTick) {
        await sql.query("delete from module_runbook_checks where service_id = $1 and key = $2", [service.id, `kit:${data.addEv}`]);
      }
    }
    if (data.checkKey && data.checked != null) {
      if (data.checked) {
        await sql.query(
          `insert into module_runbook_checks (service_id, key, done_by) values ($1, $2, $3)
           on conflict (service_id, key) do update set done_by = excluded.done_by, done_at = now()`,
          [service.id, data.checkKey, me.name],
        );
      } else {
        await sql.query("delete from module_runbook_checks where service_id = $1 and key = $2", [service.id, data.checkKey]);
      }
    }
    return viewOf(sql, data, context.userId);
  });

export const completeModuleRunbook = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof scope>) => scope.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const me = await who(sql, context.userId);
    if (!me.canWrite) throw new Error("Only Service and Admin can change the runbook.");
    const mod = (
      await sql.query<{ module_type: string | null; platform: string | null; assigned_unit_id: number | null }>(
        "select module_type, platform, assigned_unit_id from modules where id = $1",
        [data.moduleId],
      )
    )[0];
    const rb = mod ? runbookForPlatform(mod.platform) : null;
    if (!mod || !rb || !moduleRunbookGroups(rb.def, mod.module_type)) throw new Error("No runbook for this module type yet.");
    if (data.context === "pm") {
      if (!data.pmId) throw new Error("This service needs a PM.");
      const unit = await unitOnPm(sql, data.pmId, mod.assigned_unit_id);
      if (!unit) throw new Error(MODULE_NOT_ON_PM);
    }
    const existing = await findService(sql, data.moduleId, data.context, data.pmId ?? null);
    if (existing?.completed_at) throw new Error("This service is already completed.");
    const service = existing ?? (await ensureService(sql, data.moduleId, data.context, data.pmId ?? null, rb.def.id, me.name));
    const done = await sql.query<{ id: number }>(
      "update module_runbook_services set completed_by = $2, completed_at = now() where id = $1 and completed_at is null returning id",
      [service.id, me.name],
    );
    if (done[0]) {
      const fresh = await viewOf(sql, data, context.userId);
      const ticked = Object.keys(fresh.checks);
      const keys = [...new Set(fresh.kits.map((k) => k.ev).flatMap(catalogKeys))];
      const rows = keys.length
        ? await sql.query<{ sku: string; item: string | null; description: string | null; mfr_part: string | null; rate: string | null; active: unknown; hidden: unknown }>(
            `select sku, item, description, mfr_part, rate, active, (hidden_at is not null) as hidden
               from billing_items
              where upper(regexp_replace(sku, '[^A-Za-z0-9]+', '', 'g')) = any($1::text[])
                 or upper(regexp_replace(coalesce(mfr_part, ''), '[^A-Za-z0-9]+', '', 'g')) = any($1::text[])
              order by id`,
            [keys],
          )
        : [];
      const catalog = pickCatalog(
        fresh.kits.map((k) => k.ev),
        rows.map((r) => ({
          sku: r.sku,
          name: r.item,
          description: r.description,
          mfrPart: r.mfr_part,
          rate: r.rate == null ? null : Number(r.rate),
          active: flagOn(r.active),
          hidden: flagOn(r.hidden),
        })),
      );
      const skus: Record<string, string | null> = {};
      for (const k of fresh.kits) skus[k.ev] = catalog[kitKey(k.ev)]?.sku ?? null;
      const lines = moduleServiceWorkLines(fresh.kits, ticked, skus);
      const note = `Runbook service #${service.id}`;
      for (const line of lines) {
        const already = await sql.query<{ id: number }>(
          "select id from module_work where module_id = $1 and kind = 'part' and item = $2 and note = $3 limit 1",
          [data.moduleId, line.item, note],
        );
        if (already[0]) continue;
        await sql.query(
          `insert into module_work (module_id, worked_on, kind, item, description, qty, technician, note, by_name)
           values ($1, current_date, 'part', $2, $3, $4, $5, $6, $5)`,
          [data.moduleId, line.item, line.description, line.qty, me.name, note],
        );
      }
      await sql.query(
        "insert into activity (entity_type, entity_id, actor_name, action, detail) values ('module', $1, $2, 'runbook completed', $3)",
        [data.moduleId, me.name, `${lines.length} kit${lines.length === 1 ? "" : "s"} logged`],
      );
    }
    return viewOf(sql, data, context.userId);
  });
