/**
 * The Machine page (phase M3 of "One Record Per Machine Plan", Chuy approved 11/24): one machine, everything that names
 * it, newest first. Read-only. A machine is a `machines` row (0143); its records are the account units, retired units and
 * warehouse records with its machine_id, and the rows M2 (0147) gave the machine. History rows with no machine of their
 * own (equipment history, module stops, a retired unit's copy) are read through the machine's units.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { checked } from "@/lib/ops/checked-input";
import { historyActionLabel, historyFieldLabel } from "@/lib/ops/unit-history";

/** The page a timeline line opens: open-link.tsx's kinds. */
export type MachineLinkKind = "service" | "tlc" | "pm" | "install" | "rebuild" | "asset" | "customer" | "module";

export type MachineEvent = {
  /** Houston time, "YYYY-MM-DD HH:MM", or "YYYY-MM-DD" when only the day is known. */
  at: string;
  kind: "history" | "ticket" | "pm" | "install" | "part" | "module" | "rebuild" | "move" | "stock" | "warehouse" | "retired";
  text: string;
  who: string | null;
  link: { kind: MachineLinkKind; id: number } | null;
};

export type MachineRecord =
  | { where: "account"; id: number; customer: string; customerId: number | null; model: string; serial: string | null }
  | { where: "retired"; id: number; unitId: number; customer: string; model: string; serial: string | null; retiredAt: string }
  | { where: "warehouse"; id: number; model: string; serial: string | null; status: string | null; site: string | null; soldTo: string | null };

export type MachinePage = {
  id: number;
  serial: string | null;
  model: string | null;
  /** The machine this one was merged into, when it was (its records all went there). */
  mergedInto: number | null;
  records: MachineRecord[];
  /** Modules on it now. */
  modules: { id: number; moduleId: string }[];
  events: MachineEvent[];
};

export const MACHINE_NOT_FOUND = "That machine isn't in the desk.";

const AT = (col: string) => `to_char(${col} at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI')`;
const DAY = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`;
const str = (v: unknown) => (v == null ? null : String(v));

/** Every machine id that's this one: itself, and the ones merged into it (their rows moved here, their history stays). */
async function machineIds(sql: Sql, id: number): Promise<number[]> {
  const rows = await sql.query<{ id: number }>(
    `with recursive m(id) as (select $1::int union select x.id from machines x join m on x.merged_into = m.id) select id from m`,
    [id],
  );
  return rows.map((r) => Number(r.id));
}

export async function machinePageFor(sql: Sql, id: number): Promise<MachinePage> {
  const [m] = await sql.query<{ id: number; serial: string | null; model: string | null; merged_into: number | null }>(
    "select id, serial, model, merged_into from machines where id = $1",
    [id],
  );
  if (!m) throw new Error(MACHINE_NOT_FOUND);
  const ids = await machineIds(sql, id);

  const account = await sql.query<{ id: number; customer: string; customer_id: number | null; model: string; serial: string | null }>(
    `select id, customer, customer_id, coalesce(nullif(btrim(catalog_model), ''), equipment_name) as model, serial
       from account_equipment where machine_id = any($1::int[]) order by id`,
    [ids],
  );
  const retired = await sql.query<{ id: number; unit_id: number; customer: string; model: string; serial: string | null; at: string; by: string | null }>(
    `select id, unit_id, customer, coalesce(nullif(btrim(catalog_model), ''), equipment_name) as model, serial, ${AT("retired_at")} as at, retired_by as by
       from account_equipment_retired where machine_id = any($1::int[]) order by retired_at desc, id desc`,
    [ids],
  );
  const warehouse = await sql.query<{ id: number; model: string; serial: string | null; status: string | null; site: string | null; sold_to: string | null }>(
    "select id, model, serial, status, site, sold_to from assets where machine_id = any($1::int[]) order by id",
    [ids],
  );
  const records: MachineRecord[] = [
    ...account.map((r) => ({ where: "account" as const, id: Number(r.id), customer: r.customer, customerId: r.customer_id == null ? null : Number(r.customer_id), model: r.model, serial: r.serial })),
    ...warehouse.map((r) => ({ where: "warehouse" as const, id: Number(r.id), model: r.model, serial: r.serial, status: r.status, site: r.site, soldTo: r.sold_to })),
    ...retired.map((r) => ({ where: "retired" as const, id: Number(r.id), unitId: Number(r.unit_id), customer: r.customer, model: r.model, serial: r.serial, retiredAt: r.at })),
  ];
  // The machine's units, now and before (a retired unit's id is the one its history and module stops name).
  const unitIds = [...new Set([...account.map((r) => Number(r.id)), ...retired.map((r) => Number(r.unit_id))])];
  const assetIds = warehouse.map((r) => Number(r.id));

  const events: MachineEvent[] = [];
  const add = (e: MachineEvent) => events.push(e);

  // Its units' equipment history (0130): every add, change, move, retire, put-back and install visit. A unit added
  // writes a line per field; they read as one.
  type H = { unit_id: number; at: string; action: string; field: string | null; old_value: string | null; new_value: string | null; actor: string; customer: string | null; install_id: number | null; note: string | null };
  const history = await sql.query<H>(
    `select unit_id, ${AT("at")} as at, action, field, old_value, new_value, actor, customer, install_id, note
       from equipment_history where unit_id = any($1::int[]) order by at desc, id desc limit 400`,
    [unitIds],
  );
  for (let i = 0; i < history.length; i++) {
    const h = history[i]!;
    if (h.action === "create") {
      const same = [h];
      while (history[i + 1] && history[i + 1]!.action === "create" && history[i + 1]!.at === h.at && history[i + 1]!.unit_id === h.unit_id) same.push(history[++i]!);
      const fields = same
        .filter((x) => x.new_value && x.field !== "customer" && x.field !== "equipment_name")
        .map((x) => `${historyFieldLabel(x.field)} ${x.new_value}`)
        .reverse();
      add({ at: h.at, kind: "history", text: `Added to ${h.customer ?? "an account"}${fields.length ? `: ${fields.join(" · ")}` : ""}`, who: h.actor, link: null });
      continue;
    }
    if (h.action === "add_to_install" || h.action === "remove_from_install") {
      const to = h.action === "add_to_install" ? "Added to" : "Taken off";
      add({ at: h.at, kind: "history", text: `${to} install${h.install_id ? ` #${h.install_id}` : ""}${h.customer ? ` · ${h.customer}` : ""}`, who: h.actor, link: h.install_id ? { kind: "install", id: Number(h.install_id) } : null });
      continue;
    }
    const field = historyFieldLabel(h.field);
    const change = h.old_value || h.new_value ? `${h.old_value || "blank"} → ${h.new_value || "blank"}` : "";
    const text = [historyActionLabel(h.action), field && `${field}${change ? `: ${change}` : ""}`, !field && change, h.action !== "update" && h.customer && `(${h.customer})`, h.note]
      .filter(Boolean)
      .join(" ");
    add({ at: h.at, kind: "history", text, who: h.actor, link: h.install_id ? { kind: "install", id: Number(h.install_id) } : null });
  }

  // What a retired unit of it kept of its links (Retire copies them; account-equip-retire.ts), as ids.
  const KEPT = (key: string, field: string) =>
    `select (x ->> '${field}')::int from account_equipment_retired r, jsonb_array_elements(coalesce(r.links -> '${key}', '[]'::jsonb)) x
      where r.machine_id = any($1::int[]) and coalesce(x ->> '${field}', '') ~ '^[0-9]{1,9}$'`;

  // Tickets and TLCs it was on.
  for (const t of await sql.query<{ id: number; kind: string; call_id: string; status: string; customer: string; at: string | null }>(
    `select j.id, j.kind, j.call_id, j.status, j.customer,
            coalesce(${DAY("j.completed_at")}, ${DAY("j.scheduled")}, ${DAY("j.received")}, ${AT("j.updated_at")}) as at
       from service_jobs j
      where j.id in (select job_id from ticket_units where machine_id = any($1::int[]) union ${KEPT("ticket_links", "job_id")})`,
    [ids],
  )) {
    const tlc = t.kind === "tlc";
    add({ at: t.at ?? "", kind: "ticket", text: `${tlc ? "TLC" : "Ticket"} ${t.call_id} · ${t.status} · ${t.customer}`, who: null, link: { kind: tlc ? "tlc" : "service", id: Number(t.id) } });
  }

  // PMs that covered it (its runbook unit, or a unit link on the PM).
  for (const p of await sql.query<{ id: number; status: string; customer: string; at: string | null }>(
    `select distinct p.id, p.status, p.customer,
            coalesce(${DAY("p.completed_at")}, ${DAY("p.projected")}, ${DAY("p.received")}) as at
       from pm_jobs p
      where p.id in (select pm_job_id from pm_runbook_units where machine_id = any($1::int[])
                     union select pm_job_id from pm_runbook_unit_links where machine_id = any($1::int[])
                     union ${KEPT("pm_links", "pm_job_id")})`,
    [ids],
  )) {
    add({ at: p.at ?? "", kind: "pm", text: `PM · ${p.status} · ${p.customer}`, who: null, link: { kind: "pm", id: Number(p.id) } });
  }

  // Parts a PM put into it.
  for (const p of await sql.query<{ pm_job_id: number; item: string; description: string | null; qty: string; at: string; by: string | null }>(
    `select pm_job_id, item, description, qty::text as qty, ${AT("added_at")} as at, added_by as by
       from machine_parts where machine_id = any($1::int[]) order by added_at desc`,
    [ids],
  )) {
    const qty = Number(p.qty) === 1 ? "" : ` × ${Number(p.qty)}`;
    add({ at: p.at, kind: "part", text: `Part ${p.item}${p.description ? ` (${p.description})` : ""}${qty}`, who: p.by, link: { kind: "pm", id: Number(p.pm_job_id) } });
  }

  // Installs whose machine list had it (the pre-inspection's units).
  for (const i of await sql.query<{ id: number; customer: string; at: string | null; visit_kind: string | null }>(
    `select i.id, i.customer, coalesce(${DAY("i.install_date")}, ${DAY("i.completed_at")}, ${DAY("i.received")}) as at,
            (select u.visit_kind from install_inspection_units u where u.install_id = i.id and u.machine_id = any($1::int[]) limit 1) as visit_kind
       from installs i
      where i.id in (select install_id from install_inspection_units where machine_id = any($1::int[]) union ${KEPT("inspection_units", "install_id")})`,
    [ids],
  )) {
    add({ at: i.at ?? "", kind: "install", text: `On install #${i.id} · ${i.customer}${i.visit_kind ? ` · ${i.visit_kind}` : ""}`, who: null, link: { kind: "install", id: Number(i.id) } });
  }

  // Eversys modules put on or taken off its units.
  for (const s of await sql.query<{ module: number; module_id: string; kind: string; other: string | null; at: string; by: string | null; customer: string | null }>(
    `select s.module_id as module, m.module_id, s.kind, s.other_module as other, ${AT("s.happened_at")} as at, s.by_name as by, s.customer
       from module_stops s join modules m on m.id = s.module_id
      where s.unit_id = any($1::int[]) order by s.happened_at desc`,
    [unitIds],
  )) {
    const what: Record<string, string> = { assigned: "put on", returned: "taken off", swap_out: "swapped out", swap_in: "swapped in", moved: "moved" };
    add({
      at: s.at,
      kind: "module",
      text: `Module ${s.module_id} ${what[s.kind] ?? s.kind}${s.other ? ` (for ${s.other})` : ""}${s.customer ? ` · ${s.customer}` : ""}`,
      who: s.by,
      link: { kind: "module", id: Number(s.module) },
    });
  }

  // Rebuilds it went through.
  for (const r of await sql.query<{ rebuild_id: number; title: string; pulled: string | null; stocked: string | null; created: string }>(
    `select r.id as rebuild_id, r.title, ${AT("rm.pulled_at")} as pulled, ${AT("rm.stocked_at")} as stocked, ${AT("rm.created_at")} as created
       from rebuild_machines rm join rebuilds r on r.id = rm.rebuild_id
      where rm.machine_id = any($1::int[])`,
    [ids],
  )) {
    const link = { kind: "rebuild" as const, id: Number(r.rebuild_id) };
    add({ at: r.pulled ?? r.created, kind: "rebuild", text: `${r.pulled ? "Pulled onto" : "On"} rebuild "${r.title}"`, who: null, link });
    if (r.stocked) add({ at: r.stocked, kind: "rebuild", text: `Into stock from rebuild "${r.title}"`, who: null, link });
  }

  // Moves asked between accounts.
  for (const mv of await sql.query<{ from_customer: string; to_customer: string; asked: string; asked_by: string; decided: string | null; decided_by: string | null; decision: string | null }>(
    `select from_customer, to_customer, ${AT("asked_at")} as asked, asked_by, ${AT("decided_at")} as decided, decided_by, decision
       from equipment_move_requests where machine_id = any($1::int[])`,
    [ids],
  )) {
    add({ at: mv.asked, kind: "move", text: `Move asked: ${mv.from_customer} → ${mv.to_customer}`, who: mv.asked_by, link: null });
    if (mv.decided) add({ at: mv.decided, kind: "move", text: `Move ${mv.decision ?? "decided"}: ${mv.from_customer} → ${mv.to_customer}`, who: mv.decided_by, link: null });
  }

  // Its warehouse records: stock requests and their activity.
  if (assetIds.length) {
    for (const a of await sql.query<{ asset_id: number; kind: string; status: string; customer: string | null; asked: string; asked_by: string; decided: string | null; decided_by: string | null }>(
      `select asset_id, kind, status, customer, ${AT("asked_at")} as asked, asked_by, ${AT("decided_at")} as decided, decided_by
         from asset_stock_actions where asset_id = any($1::int[])`,
      [assetIds],
    )) {
      const what = a.kind === "assign" ? `Asked to send to ${a.customer || "an account"}` : "Asked to take out of stock";
      add({ at: a.asked, kind: "stock", text: what, who: a.asked_by, link: { kind: "asset", id: Number(a.asset_id) } });
      if (a.decided) add({ at: a.decided, kind: "stock", text: `${what}: ${a.status}`, who: a.decided_by, link: { kind: "asset", id: Number(a.asset_id) } });
    }
    for (const a of await sql.query<{ entity_id: number; action: string; detail: string | null; at: string; actor_name: string | null }>(
      `select entity_id, action, detail, ${AT("created_at")} as at, actor_name
         from activity where entity_type = 'asset' and entity_id = any($1::int[]) order by created_at desc limit 200`,
      [assetIds],
    )) {
      add({ at: a.at, kind: "warehouse", text: a.detail || a.action, who: a.actor_name, link: { kind: "asset", id: Number(a.entity_id) } });
    }
  }

  // Retired from an account (the equipment history has the line too when the trigger saw it; this keeps older ones).
  for (const r of retired) {
    if (events.some((e) => e.kind === "history" && e.at === r.at && e.text.startsWith(historyActionLabel("retire")))) continue;
    add({ at: r.at, kind: "retired", text: `Retired from ${r.customer}`, who: r.by, link: null });
  }

  events.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1));
  const modules = await sql.query<{ id: number; module_id: string }>("select id, module_id from modules where machine_id = any($1::int[]) order by module_id", [ids]);
  return {
    id: Number(m.id),
    serial: str(m.serial),
    model: str(m.model),
    mergedInto: m.merged_into == null ? null : Number(m.merged_into),
    records,
    modules: modules.map((x) => ({ id: Number(x.id), moduleId: x.module_id })),
    events,
  };
}

const ready = async () => {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
};

export const getMachinePage = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator(checked(z.object({ id: z.number().int().positive() })))
  .handler(async ({ data }) => machinePageFor(await ready(), data.id));
