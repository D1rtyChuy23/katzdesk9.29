/**
 * Change a unit's model from its Edit form (Chuy, 11/19), Admin only. A unit can be filed under the wrong model (an
 * old-style Bunn ITCB-DV under the 29" w/Flip Tray model when it's the 29" Trunk, with Tray). Before this, the only fix
 * was Remove and add again, which lost the unit's history.
 *
 * What a model change does, where the model is read for an existing unit:
 * - Linked by id, and left as they are: pre-inspection units and their checks, photos and answers
 *   (install_inspection_units.equipment_id), PM runbook unit links (pm_runbook_unit_links.account_equipment_id), PM
 *   runbook units and machine parts (unit_key "acct:<id>"), equipment history, locks, move requests, the removed-unit copies.
 * - Matched by model name, so they follow in the same statement:
 *   - each install whose visit has the unit: its row on the install's list gets the unit's id, and its model text
 *     when it named the old model (a load or a save then finds the unit by id, never drops it);
 *   - each open PM on the account whose plan picks this unit without a pin: the unit is pinned to that line, so the
 *     PM keeps it under the new model.
 * - Read fresh each time, nothing stored to update: the pre-inspection checks (unitChecks reads the model as it is),
 *   the install-date fill, the lock label, field assets, module assignment, export and Teams reports.
 * The serial never changes. equipment_name follows only when it was the old model (a custom title is kept).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";

type Query = Pick<Sql, "query">;

export const MODEL_EDIT_ADMIN_ONLY = "Only an Admin can change a unit's model.";
export const MODEL_NOT_IN_CATALOG = "That model isn't on the equipment list. Add it to the equipment list first.";

/** The equipment list's own name for a model, or null when it isn't on the list. Never adds one. */
export async function catalogModelNamed(sql: Query, typed: string | null | undefined): Promise<string | null> {
  const t = String(typed ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const rows = await sql.query<{ name: string }>(
    "select name from directory_equipment where archived = false and lower(btrim(name)) = lower($1) order by id limit 1",
    [t],
  );
  return rows[0]?.name ?? null;
}

export type ModelChangePlan = {
  installs: Awaited<ReturnType<typeof import("./inspection-api").listRowsForModelChange>>;
  pins: { pm: number; piece_key: string }[];
};

/** What follows the unit when its model changes (see the header). Reads only. */
export async function planModelChange(
  sql: Sql,
  unit: { id: number; customer: string; catalogModel: string },
  newName: string,
): Promise<ModelChangePlan> {
  const { listRowsForModelChange } = await import("./inspection-api");
  const installs = await listRowsForModelChange(sql, unit.id, unit.catalogModel, newName);
  const pms = await sql.query<{ id: number; equipment: string | null }>(
    `select id, equipment from pm_jobs
      where lower(btrim(customer)) = lower(btrim($1)) and moved_job_id is null
        and done = false and completed_at is null and status not in ('Completed', 'Cancelled')`,
    [unit.customer],
  );
  const pins: ModelChangePlan["pins"] = [];
  if (pms.length) {
    const { loadPmRunbookPlan } = await import("./pm-runbook-api");
    for (const pm of pms) {
      const plan = await loadPmRunbookPlan(sql, unit.customer, pm.equipment, pm.id);
      const pinned = await sql.query<{ piece_key: string }>("select piece_key from pm_runbook_unit_links where pm_job_id = $1", [pm.id]);
      const taken = new Set(pinned.map((r) => r.piece_key));
      for (const p of plan.planned) if (p.accountId === unit.id && !taken.has(p.pieceKey)) pins.push({ pm: pm.id, piece_key: p.pieceKey });
    }
  }
  return { installs, pins };
}

/**
 * The edit with a model change, one statement (the plain edit, editUnitSql, is unchanged): the same fields and checks
 * as editUnitSql ($1–$10), plus $11 the new catalog model, $12 the old one as read, $13 the install lists, $14 the PM
 * pins, $15 who, $16 the activity line. Nothing is written on a locked unit, one changed since it was read, one whose
 * model changed meanwhile, or when an install's list changed since it was read.
 */
export function editUnitModelSql(): string {
  return `with x as (
    select * from jsonb_to_recordset($13::jsonb) as t(id int, before text, before_equipment text, equipment text, machines text, serial text, power_voltage text)
  ), u as (
    update account_equipment
       set part_number = $2, ownership = $3, install_date = $4::date,
           condition = case when $6::boolean then $7 else condition end,
           serial = case when $8::boolean then $9 else serial end,
           serial_key = case when $8::boolean then $10 else serial_key end,
           equipment_name = case when equipment_name is not distinct from $12 then $11 else equipment_name end,
           catalog_model = $11,
           updated_at = now()
     where id = $1 and locked_at is null and updated_at::text = $5 and catalog_model = $12
       and (not $8::boolean or $10::text is null or not exists (select 1 from account_equipment e where e.serial_key = $10 and e.id <> $1))
       and not exists (
         select 1 from x join installs i on i.id = x.id
          where i.machines is distinct from x.before or i.equipment is distinct from x.before_equipment)
    returning id, customer, serial
  ), ins as (
    update installs i
       set equipment = x.equipment, machines = x.machines, serial = x.serial, power_voltage = x.power_voltage, updated_at = now()
      from x where i.id = x.id and exists (select 1 from u)
    returning i.id
  ), pins as (
    insert into pm_runbook_unit_links (pm_job_id, piece_key, account_equipment_id)
    select p.pm, p.piece_key, $1 from jsonb_to_recordset($14::jsonb) as p(pm int, piece_key text)
     where exists (select 1 from u)
    on conflict do nothing
    returning pm_job_id
  ), act as (
    insert into activity (entity_type, entity_id, actor_name, action, detail)
    select 'customer', d.id, $15::text, 'updated', $16::text
      from u join lateral (
        select id from directory_customers d where lower(btrim(d.name)) = lower(btrim(u.customer)) order by archived, id limit 1
      ) d on true
    returning id
  )
  select u.id, (select count(*) from ins)::int as installs, (select count(*) from pins)::int as pins, (select count(*) from act)::int as logged
    from u`;
}

/** "Changed model of SN ZZ123 from A to B" (or "of the unit with no serial"). */
export const modelChangeText = (serial: string | null, from: string, to: string) =>
  `Changed model ${serial ? `of SN ${serial}` : "of a unit with no serial"} from ${from} to ${to}`;

/**
 * A model's known Part #: the one Part # the account units of that model carry most (more than any other, and on at
 * least one unit). Null when none, or when two are tied. A suggestion only; nothing is changed.
 */
export async function knownPartNumbers(sql: Query, models: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const m of models) out[m] = null;
  const wanted = [...new Set(models.map((m) => m.trim().toLowerCase()).filter(Boolean))];
  if (!wanted.length) return out;
  const rows = await sql.query<{ model: string; part: string; n: number }>(
    `select lower(btrim(catalog_model)) as model, btrim(part_number) as part, count(*)::int as n from account_equipment
      where lower(btrim(catalog_model)) = any($1::text[]) and coalesce(btrim(part_number), '') <> ''
      group by 1, 2 order by 1, 3 desc, 2`,
    [wanted],
  );
  for (const m of models) {
    const mine = rows.filter((r) => r.model === m.trim().toLowerCase());
    if (mine.length && (mine.length === 1 || Number(mine[0]!.n) > Number(mine[1]!.n))) out[m] = mine[0]!.part;
  }
  return out;
}

/** The Part # to suggest for the new model: its known one, when the unit's is blank or is the old model's known one. */
export function partNumberHint(current: string | null | undefined, oldKnown: string | null, newKnown: string | null): string | null {
  if (!newKnown) return null;
  const cur = String(current ?? "").trim();
  if (cur.toLowerCase() === newKnown.toLowerCase()) return null;
  if (!cur || (oldKnown && cur.toLowerCase() === oldKnown.toLowerCase())) return newKnown;
  return null;
}

export const getModelPartNumbers = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { models: string[] }) => z.object({ models: z.array(z.string().max(300)).max(4) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ensureSeeded } = await import("@/lib/ops/seed.server");
    await ensureSeeded();
    const sql = await getSql();
    if (!(await canReviewNames(sql, context.userId))) throw new Error(MODEL_EDIT_ADMIN_ONLY);
    return knownPartNumbers(sql, data.models);
  });
