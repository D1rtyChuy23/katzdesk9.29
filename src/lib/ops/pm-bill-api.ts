/**
 * What a stacked PM can add to the ticket it is billed on. Read-only.
 * A PM that is not stacked never comes through here; it keeps its own invoice.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import type { PartRef } from "@/lib/ops/charges";
import { kitListWithAdded, parseAddedKits } from "@/lib/ops/pm-runbook";
import { loadKitSource, loadPmRunbookPlan, loadVisitConfig } from "@/lib/ops/pm-runbook-api";
import { runbookById } from "@/lib/ops/runbooks";
import { suggestBill, type BillCatalogRow, type BillGroup, type BillMachine, type BillPart, type BillPm } from "@/lib/ops/pm-bill";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

const input = z.object({ jobId: z.number().int().positive() });

export type BillSuggestions = { stacked: boolean; groups: BillGroup[] };

/** Kits checked in, and extra parts marked to bill, for the PMs stacked on this ticket. */
export const getBillSuggestions = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof input>) => input.parse(d))
  .handler(async ({ data }): Promise<BillSuggestions> => {
    const sql = await ready();
    const pms = await sql.query<{ id: number; customer: string; equipment: string | null; style: string | null; status: string }>(
      `select id, customer, equipment, style, status from pm_jobs
        where stacked_job_id = $1
        order by id desc
        limit 10`,
      [data.jobId],
    );
    if (!pms.length) return { stacked: false, groups: [] };
    const onBill = await sql.query<{ source_key: string | null }>(
      "select source_key from ticket_charges where job_id = $1 and source_key is not null",
      [data.jobId],
    );
    const built: BillPm[] = [];
    for (const pm of pms) {
      if (pm.status === "Cancelled") {
        built.push({ id: Number(pm.id), status: pm.status, machines: [] });
        continue;
      }
      built.push({ id: Number(pm.id), status: pm.status, machines: await machinesFor(sql, pm) });
    }
    return { stacked: true, groups: suggestBill(built, onBill.map((r) => r.source_key).filter((k): k is string => !!k)).groups };
  });

async function machinesFor(
  sql: Sql,
  pm: { id: number; customer: string; equipment: string | null; style: string | null },
): Promise<BillMachine[]> {
  const plan = await loadPmRunbookPlan(sql, pm.customer, pm.equipment, pm.id);
  const checks = await sql.query<{ unit_key: string; key: string }>(
    "select unit_key, key from pm_runbook_checks where pm_job_id = $1 and key like 'kit:%'",
    [pm.id],
  );
  const saved = await sql.query<{ unit_key: string; added_kits: unknown }>(
    "select unit_key, added_kits from pm_runbook_units where pm_job_id = $1",
    [pm.id],
  );
  const addedByUnit = new Map(saved.map((r) => [r.unit_key, parseAddedKits(r.added_kits)]));
  const partRows = await sql.query<{
    id: number;
    piece_key: string;
    machine_label: string;
    item: string;
    description: string | null;
    qty: string;
    billable: boolean;
    billing_item_id: number | null;
    current_item: string | null;
    rate: string | null;
    active: unknown;
    hidden: unknown;
    sku: string | null;
    mfr_part: string | null;
    has_image: boolean | null;
    image_version: string | null;
  }>(
    `select m.id, m.piece_key, m.machine_label, m.item, m.description, m.qty, m.billable, m.billing_item_id,
            b.item as current_item, b.rate, b.active, (b.hidden_at is not null) as hidden,
            b.sku, b.mfr_part, (b.image is not null) as has_image,
            case when b.image is null then null else extract(epoch from b.image_updated_at)::bigint::text end as image_version
       from machine_parts m
       left join billing_items b on b.id = m.billing_item_id
      where m.pm_job_id = $1 and m.removed_at is null
      order by m.id desc`,
    [pm.id],
  );
  const draft: (BillMachine & { runbookId: string | null })[] = [];
  for (const machine of plan.machines) {
    const rb = machine.runbookId ? runbookById(machine.runbookId) : undefined;
    const unit = rb ? plan.planned.find((u) => u.pieceKey === machine.pieceKey && u.runbookId === machine.runbookId) : undefined;
    let kits: BillMachine["kits"] = [];
    let ticks: string[] = [];
    if (rb && unit) {
      const config = await loadVisitConfig(sql, rb.def, { id: pm.id, customer: pm.customer, style: pm.style }, unit);
      const fromUnit = addedByUnit.get(unit.unitKey) ?? [];
      const fromPiece = unit.unitKey === machine.pieceKey ? [] : (addedByUnit.get(machine.pieceKey) ?? []);
      const added = [...fromUnit];
      for (const ev of fromPiece) if (!added.includes(ev)) added.push(ev);
      kits = kitListWithAdded(rb.def, config, added).map((k) => ({ ev: k.ev, name: k.name, q: k.q }));
      const keys = new Set([unit.unitKey, machine.pieceKey]);
      ticks = checks.filter((c) => keys.has(c.unit_key)).map((c) => c.key);
    }
    draft.push({
      label: machine.piece,
      serial: machine.serial,
      machineKey: machine.key,
      accountId: machine.accountId,
      serialKey: machine.serialKey,
      manufacturer: rb?.def.manufacturer ?? null,
      kits,
      ticks,
      catalog: [],
      parts: partRows.filter((r) => r.piece_key === machine.pieceKey).map(toPart),
      runbookId: machine.runbookId,
      offPm: false,
    });
  }
  const known = new Set(plan.machines.map((m) => m.pieceKey));
  const leftover = new Map<string, typeof partRows>();
  for (const row of partRows) {
    if (known.has(row.piece_key)) continue;
    const bag = leftover.get(row.piece_key) ?? [];
    bag.push(row);
    leftover.set(row.piece_key, bag);
  }
  for (const [pieceKey, rows] of leftover) {
    draft.push({
      label: rows.find((r) => r.machine_label.trim())?.machine_label.trim() || pieceKey,
      serial: null,
      machineKey: pieceKey,
      accountId: null,
      serialKey: null,
      manufacturer: null,
      kits: [],
      ticks: [],
      catalog: [],
      parts: rows.map(toPart),
      runbookId: null,
      offPm: true,
    });
  }
  const evs = new Map<string, Set<string>>();
  for (const m of draft) {
    if (!m.runbookId) continue;
    const set = evs.get(m.runbookId) ?? new Set<string>();
    for (const k of m.kits) set.add(k.ev);
    evs.set(m.runbookId, set);
  }
  const catalogs = new Map<string, BillCatalogRow[]>();
  for (const [runbookId, set] of evs) {
    const { rows } = await loadKitSource(sql, [...set], runbookId);
    catalogs.set(runbookId, rows);
  }
  return draft.map(({ runbookId, ...machine }) => ({ ...machine, catalog: runbookId ? catalogs.get(runbookId) ?? [] : [] }));
}

function toPart(r: {
  id: number;
  item: string;
  description: string | null;
  qty: string;
  billable: boolean;
  billing_item_id: number | null;
  current_item: string | null;
  rate: string | null;
  active: unknown;
  hidden: unknown;
  sku: string | null;
  mfr_part: string | null;
  has_image: boolean | null;
  image_version: string | null;
}): BillPart {
  const part: PartRef | null = r.billing_item_id == null || !r.sku
    ? null
    : { id: Number(r.billing_item_id), sku: r.sku, mpn: r.mfr_part, hasImage: !!r.has_image, imageVersion: r.image_version };
  return {
    id: Number(r.id),
    item: r.item,
    description: r.description,
    qty: Number(r.qty),
    billable: r.billable === true || (r.billable as unknown) === "t",
    billingItemId: r.billing_item_id == null ? null : Number(r.billing_item_id),
    active: flagOn(r.active),
    hidden: flagOn(r.hidden),
    rate: r.rate == null ? null : Number(r.rate),
    currentItem: r.current_item,
    part,
  };
}
