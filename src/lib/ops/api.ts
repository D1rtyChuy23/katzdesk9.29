import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { CLOSED_CALL, CLOSED_PM, PRODUCER_INITIALS, TECHNICIANS } from "./lookups";
import {
  addDays,
  diffDays,
  formatWeekLabel,
  installFlag,
  pmFlag,
  serviceFlag,
  todayChicago,
  weekBounds,
} from "./clock";
import type {
  Asset,
  ComingDueRow,
  Comment,
  CommentPreview,
  Dashboard,
  Deal,
  DirectoryEntry,
  DirectoryKind,
  FlaggedRow,
  HandoffFeed,
  HandoffOwners,
  Install,
  ModuleRow,
  PmJob,
  Recipe,
  SearchHit,
  ServiceJob,
} from "./types";
import { specsFromInstall, type MachineSpec } from "./machines";
import { listedEquipment } from "./equipment";
import {
  BACK_PALLETS,
  BARN_EQUIP_CAPACITY,
  FRONT_PALLETS,
  LEVELS,
  bayFor,
  isBarn,
  palletsFor,
  siteLabel,
  slotId,
} from "./warehouse";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") return v.slice(0, 10);
  return String(v).slice(0, 10);
}

type JobRow = {
  id: number;
  kind: "service" | "tlc";
  call_id: string;
  contact: string | null;
  phone: string | null;
  received: string | null;
  customer: string | null;
  equipment: string | null;
  issue: string | null;
  call_type: string | null;
  phone_resolved: boolean;
  status: string;
  technician: string | null;
  wo: string | null;
  scheduled: string | null;
  notes: string | null;
  done: boolean;
  updated_at: string;
  urgency: string;
};

function mapJob(r: JobRow, today: string): ServiceJob {
  const received = isoDate(r.received);
  const scheduled = isoDate(r.scheduled);
  return {
    id: r.id,
    kind: r.kind,
    callId: r.call_id,
    contact: r.contact,
    phone: r.phone,
    received,
    customer: r.customer,
    equipment: r.equipment,
    issue: r.issue,
    callType: r.call_type,
    phoneResolved: !!r.phone_resolved,
    status: r.status,
    technician: r.technician,
    wo: r.wo,
    scheduled,
    notes: r.notes,
    done: !!r.done,
    updatedAt: String(r.updated_at),
    urgency: r.urgency || "Normal",
    flag: serviceFlag(
      { kind: r.kind, status: r.status, done: !!r.done, received, scheduled },
      today,
    ),
    ageDays: received ? diffDays(received, today) : null,
  };
}

type PmRow = {
  id: number;
  customer: string;
  received: string | null;
  equipment: string | null;
  style: string | null;
  projected: string | null;
  parts_status: string | null;
  status: string;
  technician: string | null;
  notes: string | null;
  done: boolean;
  updated_at: string;
};

function mapPm(r: PmRow, today: string): PmJob {
  const projected = isoDate(r.projected);
  return {
    id: r.id,
    customer: r.customer,
    received: isoDate(r.received),
    equipment: r.equipment,
    style: r.style,
    projected,
    partsStatus: r.parts_status,
    status: r.status,
    technician: r.technician,
    notes: r.notes,
    done: !!r.done,
    updatedAt: String(r.updated_at),
    flag: pmFlag({ status: r.status, done: !!r.done, projected }, today),
  };
}

type InstRow = {
  id: number;
  received: string | null;
  customer: string;
  equipment: string | null;
  equip_status: string | null;
  install_date: string | null;
  technician: string | null;
  wo: string | null;
  reqs_ready: string | null;
  notes: string | null;
  account_rep: string | null;
  payment_status: string | null;
  serial: string | null;
  power_voltage: string | null;
  machines: string | null;
  complete: boolean;
  deal_id: number | null;
  updated_at: string;
};

function mapInstall(
  r: InstRow,
  today: string,
  week: ReturnType<typeof weekBounds>,
): Install {
  const installDate = isoDate(r.install_date);
  return {
    id: r.id,
    received: isoDate(r.received),
    customer: r.customer,
    equipment: r.equipment,
    equipStatus: r.equip_status,
    installDate,
    technician: r.technician,
    wo: r.wo,
    reqsReady: r.reqs_ready,
    notes: r.notes,
    accountRep: r.account_rep,
    paymentStatus: r.payment_status,
    serial: r.serial ?? null,
    powerVoltage: r.power_voltage ?? null,
    machines: specsFromInstall(r.equipment, r.serial, r.power_voltage, r.machines),
    complete: !!r.complete,
    dealId: r.deal_id,
    updatedAt: String(r.updated_at),
    flag: installFlag(
      {
        equipStatus: r.equip_status,
        installDate,
        reqsReady: r.reqs_ready,
        complete: !!r.complete,
      },
      today,
      week,
    ),
    daysOut: installDate ? diffDays(today, installDate) : null,
  };
}

function mapDeal(r: Record<string, unknown>): Deal {
  return {
    id: r.id as number,
    customer: String(r.customer),
    producer: (r.producer as string) ?? null,
    accountType: (r.account_type as string) ?? null,
    dateOfDeal: isoDate(r.date_of_deal),
    equipment: (r.equipment as string) ?? null,
    amount: num(r.amount),
    goodToOrder: !!r.good_to_order,
    ordered: !!r.ordered,
    eta: (r.eta as string) ?? null,
    terms: (r.terms as string) ?? null,
    invoice: (r.invoice as string) ?? null,
    completion: (r.completion as string) ?? null,
    notes: (r.notes as string) ?? null,
    updatedAt: String(r.updated_at),
  };
}

function mapModule(r: Record<string, unknown>): ModuleRow {
  return {
    id: r.id as number,
    moduleId: String(r.module_id),
    platform: (r.platform as string) ?? null,
    moduleType: (r.module_type as string) ?? null,
    status: String(r.status),
    wo: (r.wo as string) ?? null,
    location: (r.location as string) ?? null,
    dateIn: isoDate(r.date_in),
    dateReady: isoDate(r.date_ready),
    technician: (r.technician as string) ?? null,
    notes: (r.notes as string) ?? null,
    updatedAt: String(r.updated_at),
  };
}

function mapComment(r: Record<string, unknown>): Comment {
  return {
    id: r.id as number,
    entityType: String(r.entity_type),
    entityId: r.entity_id as number,
    authorId: (r.author_id as string) ?? null,
    authorName: (r.author_name as string) ?? null,
    body: String(r.body),
    askTeam: (r.ask_team as string) ?? null,
    resolved: !!r.resolved,
    createdAt: String(r.created_at),
  };
}

type AssetRow = {
  id: number;
  kind: "equip" | "dispenser" | "module";
  model: string;
  serial: string | null;
  qty: number;
  customer_owned: string | null;
  site: string;
  pallet: string | null;
  level: number | null;
  line_no: number | null;
  purpose: string | null;
  status: string;
  sold_to: string | null;
  sold_at: string | null;
  install_id: number | null;
  notes: string | null;
  updated_at: string;
  origin_site: string | null;
  origin_pallet: string | null;
  origin_level: number | null;
};

function mapAsset(r: AssetRow): Asset {
  const pallet = r.pallet;
  const level = num(r.level);
  const lineNo = num(r.line_no);
  return {
    id: r.id,
    kind: r.kind,
    model: r.model,
    serial: r.serial,
    qty: num(r.qty) ?? 1,
    customerOwned: r.customer_owned,
    site: r.site,
    pallet,
    level,
    lineNo,
    purpose: r.purpose,
    status: r.status,
    soldTo: r.sold_to,
    soldAt: isoDate(r.sold_at),
    installId: r.install_id,
    notes: r.notes,
    updatedAt: String(r.updated_at),
    bay: bayFor(r.site, pallet),
    slotLabel: pallet && level ? slotId(pallet, level, lineNo) : siteLabel(r.site),
    missingSerial: r.kind === "equip" && !r.serial,
  };
}

function mapRecipe(r: Record<string, unknown>): Recipe {
  return {
    id: r.id as number,
    equipmentModel: String(r.equipment_model),
    customer: (r.customer as string) ?? null,
    installId: num(r.install_id),
    copiedFrom: num(r.copied_from),
    isTemplate: Boolean(r.is_template),
    coffee1: (r.coffee_1 as string) ?? null,
    coffee2: (r.coffee_2 as string) ?? null,
    coffee3: (r.coffee_3 as string) ?? null,
    powder1: (r.powder_1 as string) ?? null,
    powder2: (r.powder_2 as string) ?? null,
    powder3: (r.powder_3 as string) ?? null,
    americano1: (r.americano_1 as string) ?? null,
    americano2: (r.americano_2 as string) ?? null,
    americano3: (r.americano_3 as string) ?? null,
    tea1: (r.tea_1 as string) ?? null,
    tea2: (r.tea_2 as string) ?? null,
    milk: (r.milk as string) ?? null,
    notes: (r.notes as string) ?? null,
    updatedAt: String(r.updated_at),
  };
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<Dashboard> => {
    const sql = await ready();
    const today = todayChicago();
    const week = weekBounds(today);
    const jobs = (await sql<JobRow>`select * from service_jobs`).map((r) =>
      mapJob(r, today),
    );
    const pms = (await sql<PmRow>`select * from pm_jobs`).map((r) => mapPm(r, today));
    const installs = (await sql<InstRow>`select * from installs`).map((r) =>
      mapInstall(r, today, week),
    );
    const deals = (await sql<Record<string, unknown>>`select * from deals`).map(mapDeal);

    const svc = jobs.filter((j) => j.kind === "service");
    const tlc = jobs.filter((j) => j.kind === "tlc");
    const svcActive = svc.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
    const tlcActive = tlc.filter((j) => !CLOSED_CALL.has(j.status) && !j.done);
    const pmActive = pms.filter((p) => !CLOSED_PM.has(p.status) && !p.done);

    const flaggedSvc = svc
      .filter((j) => j.flag)
      .sort((a, b) => (a.flag!.rank - b.flag!.rank) || (a.ageDays ?? 0) - (b.ageDays ?? 0) || a.id - b.id);
    const flaggedTlc = tlc
      .filter((j) => j.flag)
      .sort((a, b) => (a.received ?? "").localeCompare(b.received ?? ""));
    const flaggedPm = pms.filter((p) => p.flag);

    const toFlag = (j: ServiceJob, type: string): FlaggedRow => ({
      id: j.id,
      entityType: type,
      customer: j.customer ?? "Untitled",
      flag: j.flag!,
      status: j.status,
      received: j.received,
      scheduled: j.scheduled,
      technician: j.technician,
      detail: j.wo,
      kind: j.kind,
    });

    const comingDue: ComingDueRow[] = [];
    const horizon = addDays(today, 14);
    for (const j of jobs) {
      if (CLOSED_CALL.has(j.status) || j.done || !j.scheduled) continue;
      if (j.scheduled >= today && j.scheduled <= horizon) {
        comingDue.push({
          daysOut: diffDays(today, j.scheduled),
          source: j.kind === "tlc" ? "TLC + Factor" : "Service Tracker",
          customer: j.customer ?? "Untitled",
          equipment: j.equipment,
          status: j.status,
          scheduled: j.scheduled,
          technician: j.technician,
          detail: j.wo,
          entityType: j.kind,
          id: j.id,
        });
      }
    }
    for (const p of pms) {
      if (CLOSED_PM.has(p.status) || p.done || !p.projected) continue;
      if (p.projected >= today && p.projected <= horizon) {
        comingDue.push({
          daysOut: diffDays(today, p.projected),
          source: "PM Tracker",
          customer: p.customer,
          equipment: p.equipment,
          status: p.status,
          scheduled: p.projected,
          technician: p.technician,
          detail: p.style,
          entityType: "pm",
          id: p.id,
        });
      }
    }
    for (const i of installs) {
      if (i.complete || i.equipStatus === "Installed" || !i.installDate) continue;
      if (i.installDate >= today && i.installDate <= horizon) {
        comingDue.push({
          daysOut: diffDays(today, i.installDate),
          source: "Installs",
          customer: i.customer,
          equipment: i.equipment,
          status: i.equipStatus ?? "",
          scheduled: i.installDate,
          technician: i.technician,
          detail: i.wo,
          entityType: "install",
          id: i.id,
        });
      }
    }
    comingDue.sort((a, b) => a.daysOut - b.daysOut || a.customer.localeCompare(b.customer));

    const statuses = [
      "Open",
      "Dispatched",
      "In Progress",
      "Follow-up Needed",
      "Phone Resolved",
      "Completed",
      "Cancelled",
    ];
    const statusBreakdown = statuses.map((status) => ({
      status,
      service: svc.filter((j) => j.status === status).length,
      tlc: tlc.filter((j) => j.status === status).length,
    }));

    const techLoad = TECHNICIANS.map((tech) => {
      const all = jobs.filter((j) => j.technician === tech);
      return {
        tech,
        active: all.filter((j) => !CLOSED_CALL.has(j.status) && !j.done).length,
        completed: all.filter((j) => j.status === "Completed" || j.done).length,
      };
    });

    const comments = await sql<Record<string, unknown>>`
      select * from comments order by created_at desc limit 12`;
    const recentHandoff: CommentPreview[] = [];
    for (const c of comments) {
      const mapped = mapComment(c);
      recentHandoff.push({
        ...mapped,
        customer: await customerFor(sql, mapped.entityType, mapped.entityId),
      });
    }

    const openAsks = await sql<{ c: number }>`
      select count(*)::int as c from comments where ask_team is not null and resolved = false`;

    const installNames = new Set(installs.map((i) => i.customer.trim().toLowerCase()));
    const pendingHandoffs = deals
      .filter((d) => d.completion === "complete")
      .filter((d) => !installNames.has(d.customer.trim().toLowerCase()))
      .map((d) => ({
        dealId: d.id,
        customer: d.customer,
        equipment: d.equipment,
        producer: d.producer,
      }));

    const installQueue = installs.filter((i) => !i.complete && i.equipStatus !== "Installed");
    const installAtRisk = installQueue.filter((i) => i.flag).length;
    const installReadyRows = installQueue.filter((i) => i.equipStatus === "Ready");
    const installReadyByEquip = (() => {
      const map = new Map<string, number>();
      for (const i of installReadyRows) {
        const names = listedEquipment(i.equipment);
        const keys = names.length ? names : ["Unspecified"];
        for (const name of keys) map.set(name, (map.get(name) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 12);
    })();

    const barnReady = await sql<{ c: number }>`
      select coalesce(sum(qty), 0)::int as c from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'`;
    const barnLines = await sql<{ c: number }>`
      select count(*)::int as c from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'`;
    const barnReadyByModel = await sql<{ name: string; count: number }>`
      select model as name, coalesce(sum(qty), 0)::int as count
      from assets
      where status = 'ready' and site in ('barn-back', 'barn-front') and kind = 'equip'
      group by model
      order by count desc, name
      limit 12`;
    const modulesReadyByType = await sql<{ name: string; count: number }>`
      select coalesce(nullif(trim(module_type), ''), 'Unspecified') as name, count(*)::int as count
      from modules
      where status = 'Ready'
      group by 1
      order by count desc, name`;
    const modulesReady = modulesReadyByType.reduce((n, r) => n + Number(r.count), 0);

    const liveDeals = deals.filter((d) => d.completion !== "fell");
    const openDeals = liveDeals.filter((d) => d.completion !== "complete");
    const doneDeals = liveDeals.filter((d) => d.completion === "complete");
    const comingDueBuckets = Array.from({ length: 15 }, (_, day) => ({
      label: day === 0 ? "Today" : `${day}d`,
      day,
      count: comingDue.filter((r) => r.daysOut === day).length,
    }));

    return {
      today,
      weekLabel: formatWeekLabel(week.start, week.end),
      nextWeekLabel: formatWeekLabel(week.nextStart, week.nextEnd),
      kpis: {
        svcFlags: flaggedSvc.length,
        tlcFlags: flaggedTlc.length,
        pmFlags: flaggedPm.length,
        activeCalls: svcActive.length + tlcActive.length,
        pmsActive: pmActive.length,
        comingDue: comingDue.length,
        installQueue: installQueue.length,
        installAtRisk,
        openAsks: openAsks[0]?.c ?? 0,
        barnReady: barnReady[0]?.c ?? 0,
        barnOpen: Math.max(0, BARN_EQUIP_CAPACITY - (barnLines[0]?.c ?? 0)),
        modulesReady,
        installReady: installReadyRows.length,
      },
      statusBreakdown,
      techLoad,
      flagged: {
        service: flaggedSvc.slice(0, 12).map((j) => toFlag(j, "service")),
        tlc: flaggedTlc.slice(0, 12).map((j) => toFlag(j, "tlc")),
        pm: flaggedPm.slice(0, 12).map((p) => ({
          id: p.id,
          entityType: "pm",
          customer: p.customer,
          flag: p.flag!,
          status: p.status,
          received: p.received,
          scheduled: p.projected,
          technician: p.technician,
          detail: p.style,
        })),
      },
      comingDue: comingDue.slice(0, 16),
      comingDueBuckets,
      recentHandoff,
      pendingHandoffs,
      barnReadyByModel,
      modulesReadyByType,
      installReadyByEquip,
      installStatus: [
        { name: "Ready", count: installReadyRows.length },
        { name: "Not ready", count: installQueue.filter((i) => i.equipStatus !== "Ready").length },
        { name: "Installed", count: installs.filter((i) => i.complete || i.equipStatus === "Installed").length },
      ],
      pipelineSnap: {
        openCount: openDeals.length,
        openValue: openDeals.reduce((n, d) => n + (d.amount ?? 0), 0),
        goodToOrder: openDeals.filter((d) => d.goodToOrder).length,
        ordered: openDeals.filter((d) => d.ordered).length,
        completeCount: doneDeals.length,
        completeValue: doneDeals.reduce((n, d) => n + (d.amount ?? 0), 0),
      },
    };
  });

async function customerFor(
  sql: Awaited<ReturnType<typeof getSql>>,
  type: string,
  id: number,
): Promise<string | null> {
  const ctx = await entityContext(sql, type, id);
  return ctx.customer;
}

async function entityContext(
  sql: Awaited<ReturnType<typeof getSql>>,
  type: string,
  id: number,
): Promise<{ customer: string | null } & HandoffOwners> {
  const empty = { customer: null as string | null, technician: null, producer: null, accountRep: null };
  if (type === "service" || type === "tlc") {
    const r = await sql<{ customer: string | null; technician: string | null }>`
      select customer, technician from service_jobs where id = ${id}`;
    return {
      ...empty,
      customer: r[0]?.customer ?? null,
      technician: r[0]?.technician ?? null,
    };
  }
  if (type === "pm") {
    const r = await sql<{ customer: string; technician: string | null }>`
      select customer, technician from pm_jobs where id = ${id}`;
    return {
      ...empty,
      customer: r[0]?.customer ?? null,
      technician: r[0]?.technician ?? null,
    };
  }
  if (type === "install") {
    const r = await sql<{ customer: string; technician: string | null; account_rep: string | null }>`
      select customer, technician, account_rep from installs where id = ${id}`;
    return {
      ...empty,
      customer: r[0]?.customer ?? null,
      technician: r[0]?.technician ?? null,
      accountRep: r[0]?.account_rep ?? null,
    };
  }
  if (type === "deal") {
    const r = await sql<{ customer: string; producer: string | null }>`
      select customer, producer from deals where id = ${id}`;
    return {
      ...empty,
      customer: r[0]?.customer ?? null,
      producer: r[0]?.producer ?? null,
    };
  }
  if (type === "module") {
    const r = await sql<{ location: string | null; module_id: string; technician: string | null }>`
      select location, module_id, technician from modules where id = ${id}`;
    return {
      ...empty,
      customer: r[0]?.location ?? r[0]?.module_id ?? null,
      technician: r[0]?.technician ?? null,
    };
  }
  return empty;
}

export const listJobs = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { kind: "service" | "tlc" }) => d)
  .handler(async ({ data }): Promise<ServiceJob[]> => {
    const sql = await ready();
    const today = todayChicago();
    const rows = await sql<JobRow>`
      select * from service_jobs where kind = ${data.kind} order by received desc nulls last, id desc`;
    return rows.map((r) => mapJob(r, today));
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<ServiceJob | null> => {
    const sql = await ready();
    const rows = await sql<JobRow>`select * from service_jobs where id = ${data.id}`;
    return rows[0] ? mapJob(rows[0], todayChicago()) : null;
  });

const jobPatch = z.object({
  id: z.number(),
  contact: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  received: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  equipment: z.string().nullable().optional(),
  issue: z.string().nullable().optional(),
  callType: z.string().nullable().optional(),
  phoneResolved: z.boolean().optional(),
  status: z.string().optional(),
  technician: z.string().nullable().optional(),
  wo: z.string().nullable().optional(),
  scheduled: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  done: z.boolean().optional(),
  urgency: z.string().optional(),
});

export const updateJob = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof jobPatch>) => jobPatch.parse(d))
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const cur = await sql<JobRow>`select * from service_jobs where id = ${data.id}`;
    if (!cur[0]) throw new Error("Job not found");
    const next = {
      contact: data.contact ?? cur[0].contact,
      phone: data.phone ?? cur[0].phone,
      received: data.received === undefined ? cur[0].received : data.received,
      customer: data.customer ?? cur[0].customer,
      equipment: data.equipment ?? cur[0].equipment,
      issue: data.issue ?? cur[0].issue,
      call_type: data.callType === undefined ? cur[0].call_type : data.callType,
      phone_resolved:
        data.phoneResolved === undefined ? cur[0].phone_resolved : data.phoneResolved,
      status: data.status ?? cur[0].status,
      technician: data.technician === undefined ? cur[0].technician : data.technician,
      wo: data.wo === undefined ? cur[0].wo : data.wo,
      scheduled: data.scheduled === undefined ? cur[0].scheduled : data.scheduled,
      notes: data.notes === undefined ? cur[0].notes : data.notes,
      done: data.done === undefined ? cur[0].done : data.done,
      urgency: data.urgency ?? cur[0].urgency ?? "Normal",
    };
    if (CLOSED_CALL.has(next.status)) next.done = true;
    else if (data.status) next.done = false;
    if (next.status === "Phone Resolved") next.phone_resolved = true;
    else if (data.status && next.status !== "Phone Resolved") next.phone_resolved = false;
    await sql`
      update service_jobs set
        contact = ${next.contact},
        phone = ${next.phone},
        received = ${next.received},
        customer = ${next.customer},
        equipment = ${next.equipment},
        issue = ${next.issue},
        call_type = ${next.call_type},
        phone_resolved = ${next.phone_resolved},
        status = ${next.status},
        technician = ${next.technician},
        wo = ${next.wo},
        scheduled = ${next.scheduled},
        notes = ${next.notes},
        done = ${next.done},
        urgency = ${next.urgency},
        updated_at = now()
      where id = ${data.id}`;
    if (data.status && data.status !== cur[0].status) {
      await sql`
        insert into activity (entity_type, entity_id, actor_name, action, detail)
        values (${cur[0].kind}, ${data.id}, ${context.userId}, ${"status"}, ${`${cur[0].status} → ${data.status}`})`;
    }
    return getJob({ data: { id: data.id } });
  });

export const createJob = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    kind: "service" | "tlc";
    customer: string;
    issue?: string;
    equipment?: string;
    contact?: string;
    phone?: string;
    received?: string;
    callType?: string;
    technician?: string;
    urgency?: string;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const received = data.received || todayChicago();
    const ym = received.replace(/-/g, "").slice(0, 6);
    const prefix = `SC-${ym}-`;
    const last = await sql<{ call_id: string }>`
      select call_id from service_jobs
      where call_id like ${prefix + "%"}
      order by call_id desc limit 1`;
    let seq = 1;
    if (last[0]) {
      const n = Number(last[0].call_id.slice(-3));
      if (Number.isFinite(n)) seq = n + 1;
    }
    const callId = `${prefix}${String(seq).padStart(3, "0")}`;
    const urgency = data.urgency || "Normal";
    const rows = await sql<{ id: number }>`
      insert into service_jobs (kind, call_id, customer, issue, equipment, contact, phone, received, call_type, technician, status, urgency)
      values (${data.kind}, ${callId}, ${data.customer}, ${data.issue ?? null}, ${data.equipment ?? null}, ${data.contact ?? null}, ${data.phone ?? null}, ${received}, ${data.callType ?? "Field Service"}, ${data.technician ?? null}, ${"Open"}, ${urgency})
      returning id`;
    return getJob({ data: { id: rows[0]!.id } });
  });

export const listPms = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<PmJob[]> => {
    const sql = await ready();
    const rows = await sql<PmRow>`select * from pm_jobs order by received desc nulls last, id desc`;
    return rows.map((r) => mapPm(r, todayChicago()));
  });

export const updatePm = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    id: number;
    customer?: string;
    equipment?: string | null;
    style?: string | null;
    projected?: string | null;
    partsStatus?: string | null;
    status?: string;
    technician?: string | null;
    notes?: string | null;
    done?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const cur = await sql<PmRow>`select * from pm_jobs where id = ${data.id}`;
    if (!cur[0]) throw new Error("PM not found");
    const c = cur[0];
    const status = data.status ?? c.status;
    const done =
      data.done === undefined
        ? data.status === undefined
          ? c.done
          : CLOSED_PM.has(status)
        : data.done;
    await sql`
      update pm_jobs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === undefined ? c.equipment : data.equipment},
        style = ${data.style === undefined ? c.style : data.style},
        projected = ${data.projected === undefined ? c.projected : data.projected},
        parts_status = ${data.partsStatus === undefined ? c.parts_status : data.partsStatus},
        status = ${status},
        technician = ${data.technician === undefined ? c.technician : data.technician},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        done = ${done},
        updated_at = now()
      where id = ${data.id}`;
    const rows = await sql<PmRow>`select * from pm_jobs where id = ${data.id}`;
    return mapPm(rows[0]!, todayChicago());
  });

export const createPm = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string; equipment?: string; style?: string }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const rows = await sql<{ id: number }>`
      insert into pm_jobs (customer, equipment, style, received, status)
      values (${data.customer}, ${data.equipment ?? null}, ${data.style ?? "12 month PM"}, ${todayChicago()}, ${"Pending Scheduling"})
      returning id`;
    const all = await sql<PmRow>`select * from pm_jobs where id = ${rows[0]!.id}`;
    return mapPm(all[0]!, todayChicago());
  });

export const listModules = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<ModuleRow[]> => {
    const sql = await ready();
    const rows = await sql<Record<string, unknown>>`select * from modules order by module_id`;
    return rows.map(mapModule);
  });

export const updateModule = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    id: number;
    status?: string;
    wo?: string | null;
    location?: string | null;
    dateIn?: string | null;
    dateReady?: string | null;
    technician?: string | null;
    notes?: string | null;
    platform?: string | null;
    moduleType?: string | null;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const cur = await sql<Record<string, unknown>>`select * from modules where id = ${data.id}`;
    if (!cur[0]) throw new Error("Module not found");
    const c = cur[0];
    await sql`
      update modules set
        status = ${data.status ?? c.status},
        wo = ${data.wo === undefined ? c.wo : data.wo},
        location = ${data.location === undefined ? c.location : data.location},
        date_in = ${data.dateIn === undefined ? c.date_in : data.dateIn},
        date_ready = ${data.dateReady === undefined ? c.date_ready : data.dateReady},
        technician = ${data.technician === undefined ? c.technician : data.technician},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        platform = ${data.platform === undefined ? c.platform : data.platform},
        module_type = ${data.moduleType === undefined ? c.module_type : data.moduleType},
        updated_at = now()
      where id = ${data.id}`;
    const rows = await sql<Record<string, unknown>>`select * from modules where id = ${data.id}`;
    return mapModule(rows[0]!);
  });

export const createModule = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { moduleId: string; platform?: string; moduleType?: string }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const rows = await sql<Record<string, unknown>>`
      insert into modules (module_id, platform, module_type, status, location)
      values (${data.moduleId}, ${data.platform ?? "Cameo"}, ${data.moduleType ?? "Brew Module"}, ${"Not Started"}, ${"SHELF"})
      returning *`;
    return mapModule(rows[0]!);
  });

export const listDeals = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<Deal[]> => {
    const sql = await ready();
    const rows = await sql<Record<string, unknown>>`select * from deals order by id`;
    return rows.map(mapDeal);
  });

export const updateDeal = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    id: number;
    customer?: string;
    producer?: string | null;
    accountType?: string | null;
    equipment?: string | null;
    amount?: number | null;
    goodToOrder?: boolean;
    ordered?: boolean;
    eta?: string | null;
    terms?: string | null;
    invoice?: string | null;
    completion?: string | null;
    notes?: string | null;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const cur = await sql<Record<string, unknown>>`select * from deals where id = ${data.id}`;
    if (!cur[0]) throw new Error("Deal not found");
    const c = cur[0];
    const completion = data.completion === undefined ? c.completion : data.completion;
    await sql`
      update deals set
        customer = ${data.customer ?? c.customer},
        producer = ${data.producer === undefined ? c.producer : data.producer},
        account_type = ${data.accountType === undefined ? c.account_type : data.accountType},
        equipment = ${data.equipment === undefined ? c.equipment : data.equipment},
        amount = ${data.amount === undefined ? c.amount : data.amount},
        good_to_order = ${data.goodToOrder === undefined ? c.good_to_order : data.goodToOrder},
        ordered = ${data.ordered === undefined ? c.ordered : data.ordered},
        eta = ${data.eta === undefined ? c.eta : data.eta},
        terms = ${data.terms === undefined ? c.terms : data.terms},
        invoice = ${data.invoice === undefined ? c.invoice : data.invoice},
        completion = ${completion},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        updated_at = now()
      where id = ${data.id}`;
    if (completion === "complete") {
      await maybeHandoffInstall(sql, data.id);
    }
    const rows = await sql<Record<string, unknown>>`select * from deals where id = ${data.id}`;
    return mapDeal(rows[0]!);
  });

export const createDeal = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { customer: string; producer?: string; equipment?: string; amount?: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const rows = await sql<Record<string, unknown>>`
      insert into deals (customer, producer, equipment, amount, date_of_deal)
      values (${data.customer}, ${data.producer ?? null}, ${data.equipment ?? null}, ${data.amount ?? null}, ${todayChicago()})
      returning *`;
    return mapDeal(rows[0]!);
  });

async function maybeHandoffInstall(sql: Awaited<ReturnType<typeof getSql>>, dealId: number) {
  const deal = (await sql<Record<string, unknown>>`select * from deals where id = ${dealId}`)[0];
  if (!deal) return;
  const name = String(deal.customer).trim().toLowerCase();
  const existing = await sql<{ id: number }>`
    select id from installs where lower(customer) = ${name} limit 1`;
  if (existing[0]) return;
  const initials = PRODUCER_INITIALS[String(deal.producer ?? "")] ?? null;
  await sql`
    insert into installs (received, customer, equipment, account_rep, payment_status, deal_id)
    values (${todayChicago()}, ${deal.customer}, ${deal.equipment ?? null}, ${initials}, ${deal.terms ?? null}, ${dealId})`;
}

export const listInstalls = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<Install[]> => {
    const sql = await ready();
    const today = todayChicago();
    const week = weekBounds(today);
    const rows = await sql<InstRow>`select * from installs order by id`;
    return rows.map((r) => mapInstall(r, today, week));
  });

export const updateInstall = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    id: number;
    customer?: string;
    equipment?: string | null;
    equipStatus?: string | null;
    installDate?: string | null;
    technician?: string | null;
    wo?: string | null;
    reqsReady?: string | null;
    notes?: string | null;
    accountRep?: string | null;
    paymentStatus?: string | null;
    serial?: string | null;
    powerVoltage?: string | null;
    machines?: MachineSpec[] | string | null;
    complete?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const cur = await sql<InstRow>`select * from installs where id = ${data.id}`;
    if (!cur[0]) throw new Error("Install not found");
    const c = cur[0];
    const equipStatus = data.equipStatus === undefined ? c.equip_status : data.equipStatus;
    const complete =
      data.complete === undefined
        ? data.equipStatus === undefined
          ? c.complete
          : equipStatus === "Installed"
        : data.complete;
    const machinesJson =
      data.machines === undefined
        ? c.machines
        : data.machines == null
          ? null
          : typeof data.machines === "string"
            ? data.machines
            : JSON.stringify(data.machines);
    await sql`
      update installs set
        customer = ${data.customer ?? c.customer},
        equipment = ${data.equipment === undefined ? c.equipment : data.equipment},
        equip_status = ${equipStatus},
        install_date = ${data.installDate === undefined ? c.install_date : data.installDate},
        technician = ${data.technician === undefined ? c.technician : data.technician},
        wo = ${data.wo === undefined ? c.wo : data.wo},
        reqs_ready = ${data.reqsReady === undefined ? c.reqs_ready : data.reqsReady},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        account_rep = ${data.accountRep === undefined ? c.account_rep : data.accountRep},
        payment_status = ${data.paymentStatus === undefined ? c.payment_status : data.paymentStatus},
        serial = ${data.serial === undefined ? c.serial : data.serial},
        power_voltage = ${data.powerVoltage === undefined ? c.power_voltage : data.powerVoltage},
        machines = ${machinesJson},
        complete = ${complete},
        updated_at = now()
      where id = ${data.id}`;
    const today = todayChicago();
    const week = weekBounds(today);
    const rows = await sql<InstRow>`select * from installs where id = ${data.id}`;
    return mapInstall(rows[0]!, today, week);
  });

export const createInstall = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    customer: string;
    equipment?: string;
    technician?: string;
    serial?: string;
    powerVoltage?: string;
    machines?: MachineSpec[] | string | null;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const machinesJson =
      data.machines == null
        ? null
        : typeof data.machines === "string"
          ? data.machines
          : JSON.stringify(data.machines);
    const rows = await sql<InstRow>`
      insert into installs (received, customer, equipment, technician, equip_status, serial, power_voltage, machines)
      values (
        ${todayChicago()},
        ${data.customer},
        ${data.equipment ?? null},
        ${data.technician ?? null},
        ${"Not Ready"},
        ${data.serial?.trim() || null},
        ${data.powerVoltage?.trim() || null},
        ${machinesJson}
      )
      returning *`;
    return mapInstall(rows[0]!, todayChicago(), weekBounds(todayChicago()));
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { entityType: string; entityId: number }) => d)
  .handler(async ({ data }): Promise<Comment[]> => {
    const sql = await ready();
    const rows = await sql<Record<string, unknown>>`
      select * from comments
      where entity_type = ${data.entityType} and entity_id = ${data.entityId}
      order by created_at asc`;
    return rows.map(mapComment);
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    entityType: string;
    entityId: number;
    body: string;
    askTeam?: string | null;
    authorName?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const body = data.body.trim();
    if (!body) throw new Error("Message is empty");
    const me = await sql.query<{ username: string | null }>(
      "select username from desk_accounts where user_id = $1",
      [context.userId],
    );
    const authorName = me[0]?.username || data.authorName || "Teammate";
    const rows = await sql<Record<string, unknown>>`
      insert into comments (entity_type, entity_id, author_id, author_name, body, ask_team)
      values (${data.entityType}, ${data.entityId}, ${context.userId}, ${authorName}, ${body}, ${data.askTeam ?? null})
      returning *`;
    return mapComment(rows[0]!);
  });

export const resolveComment = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; resolved: boolean }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    await sql`update comments set resolved = ${data.resolved} where id = ${data.id}`;
    return { ok: true };
  });

export const getHandoff = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<HandoffFeed> => {
    const sql = await ready();
    const askRows = await sql<Record<string, unknown>>`
      select * from comments
      where ask_team is not null and resolved = false
      order by created_at desc`;
    const recentRows = await sql<Record<string, unknown>>`
      select * from comments order by created_at desc limit 30`;
    const asks: HandoffFeed["asks"] = [];
    for (const r of askRows) {
      const c = mapComment(r);
      const ctx = await entityContext(sql, c.entityType, c.entityId);
      asks.push({
        ...c,
        customer: ctx.customer,
        status: c.askTeam,
        technician: ctx.technician,
        producer: ctx.producer,
        accountRep: ctx.accountRep,
      });
    }
    const recent: HandoffFeed["recent"] = [];
    for (const r of recentRows) {
      const c = mapComment(r);
      const ctx = await entityContext(sql, c.entityType, c.entityId);
      recent.push({
        ...c,
        customer: ctx.customer,
        technician: ctx.technician,
        producer: ctx.producer,
        accountRep: ctx.accountRep,
      });
    }
    const deals = (await sql<Record<string, unknown>>`select * from deals`).map(mapDeal);
    const installs = await sql<{ customer: string }>`select customer from installs`;
    const names = new Set(installs.map((i) => i.customer.trim().toLowerCase()));
    const pendingHandoffs = deals
      .filter((d) => d.completion === "complete" && !names.has(d.customer.trim().toLowerCase()))
      .map((d) => ({
        dealId: d.id,
        customer: d.customer,
        equipment: d.equipment,
        producer: d.producer,
      }));
    return { asks, recent, pendingHandoffs };
  });

export const searchAll = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { q: string }) => d)
  .handler(async ({ data }): Promise<SearchHit[]> => {
    const sql = await ready();
    const q = data.q.trim();
    if (q.length < 2) return [];
    const like = `%${q.replace(/%/g, "")}%`;
    const hits: SearchHit[] = [];
    const jobs = await sql<{ id: number; kind: string; customer: string | null; call_id: string; status: string; wo: string | null }>`
      select id, kind, customer, call_id, status, wo from service_jobs
      where customer ilike ${like} or call_id ilike ${like} or coalesce(wo,'') ilike ${like} or coalesce(issue,'') ilike ${like}
      order by received desc nulls last limit 8`;
    for (const j of jobs) {
      hits.push({
        entityType: j.kind,
        id: j.id,
        title: j.customer ?? j.call_id,
        subtitle: `${j.call_id}${j.wo ? " · " + j.wo : ""}`,
        status: j.status,
      });
    }
    const pms = await sql<{ id: number; customer: string; status: string; equipment: string | null }>`
      select id, customer, status, equipment from pm_jobs where customer ilike ${like} limit 5`;
    for (const p of pms) {
      hits.push({ entityType: "pm", id: p.id, title: p.customer, subtitle: p.equipment ?? "PM", status: p.status });
    }
    const ins = await sql<{ id: number; customer: string; equip_status: string | null; wo: string | null }>`
      select id, customer, equip_status, wo from installs where customer ilike ${like} or coalesce(wo,'') ilike ${like} limit 5`;
    for (const i of ins) {
      hits.push({ entityType: "install", id: i.id, title: i.customer, subtitle: i.wo ?? "Install", status: i.equip_status });
    }
    const deals = await sql<{ id: number; customer: string; producer: string | null; completion: string | null }>`
      select id, customer, producer, completion from deals where customer ilike ${like} limit 5`;
    for (const d of deals) {
      hits.push({
        entityType: "deal",
        id: d.id,
        title: d.customer,
        subtitle: d.producer ?? "Deal",
        status: d.completion === "complete" ? "Complete" : d.completion === "fell" ? "Fell through" : "Open",
      });
    }
    const mods = await sql<{ id: number; module_id: string; status: string; location: string | null }>`
      select id, module_id, status, location from modules
      where module_id ilike ${like} or coalesce(location,'') ilike ${like} limit 5`;
    for (const m of mods) {
      hits.push({ entityType: "module", id: m.id, title: m.module_id, subtitle: m.location ?? "Module", status: m.status });
    }
    const assets = await sql<{ id: number; model: string; serial: string | null; site: string; status: string }>`
      select id, model, serial, site, status from assets
      where model ilike ${like} or coalesce(serial,'') ilike ${like} or coalesce(sold_to,'') ilike ${like}
      limit 8`;
    for (const a of assets) {
      hits.push({
        entityType: a.status === "deployed" || a.site === "field" ? "location" : "asset",
        id: a.id,
        title: a.model,
        subtitle: [a.serial, siteLabel(a.site)].filter(Boolean).join(" · "),
        status: a.status,
      });
    }
    const recs = await sql<{
      id: number;
      equipment_model: string;
      customer: string | null;
      is_template: boolean;
    }>`
      select id, equipment_model, customer, is_template from recipes
      where equipment_model ilike ${like} or coalesce(customer, '') ilike ${like}
      limit 8`;
    for (const r of recs) {
      hits.push({
        entityType: "recipe",
        id: r.id,
        title: r.equipment_model,
        subtitle: r.customer ?? (r.is_template ? "House template" : "Recipe"),
        status: r.customer ? "Account" : "House",
      });
    }
    return hits.slice(0, 24);
  });

export const handoffDeal = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { dealId: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    await maybeHandoffInstall(sql, data.dealId);
    return { ok: true };
  });

async function nextLine(
  sql: Awaited<ReturnType<typeof getSql>>,
  site: string,
  pallet: string,
  level: number,
): Promise<number | null> {
  const taken = await sql<{ line_no: number }>`
    select line_no from assets
    where site = ${site} and pallet = ${pallet} and level = ${level}
      and status in ('ready', 'deployed') and line_no is not null`;
  const used = new Set(taken.map((t) => t.line_no));
  for (let n = 1; n <= 12; n++) if (!used.has(n)) return n;
  return null;
}

async function findOpenBarnSlot(
  sql: Awaited<ReturnType<typeof getSql>>,
  preferred?: { site: string | null; pallet: string | null; level: number | null },
): Promise<{ site: "barn-back" | "barn-front"; pallet: string; level: number; line: number }> {
  const taken = await sql<{ site: string; pallet: string; level: number; line_no: number }>`
    select site, pallet, level, line_no from assets
    where status in ('ready', 'deployed')
      and pallet is not null and level is not null and line_no is not null`;
  const used = new Set(
    taken.map((t) => `${t.site}|${t.pallet}|${t.level}|${t.line_no}`),
  );
  const firstLine = (site: string, pallet: string, level: number): number | null => {
    for (let n = 1; n <= 12; n++) {
      if (!used.has(`${site}|${pallet}|${level}|${n}`)) return n;
    }
    return null;
  };
  const tries: { site: "barn-back" | "barn-front"; pallet: string; level: number }[] = [];
  const push = (site: string, pallet: string, level: number) => {
    if (site !== "barn-back" && site !== "barn-front") return;
    tries.push({ site, pallet, level });
  };
  if (preferred?.site && preferred.pallet && preferred.level != null) {
    push(preferred.site, preferred.pallet, preferred.level);
  }
  const siteOrder: ("barn-back" | "barn-front")[] = [];
  if (preferred?.site === "barn-front") siteOrder.push("barn-front", "barn-back");
  else siteOrder.push("barn-back", "barn-front");
  for (const site of siteOrder) {
    const pallets: readonly string[] = site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
    const palletOrder =
      preferred?.pallet && pallets.includes(preferred.pallet)
        ? [preferred.pallet, ...pallets.filter((p) => p !== preferred.pallet)]
        : [...pallets];
    for (const pallet of palletOrder) {
      for (const level of LEVELS) {
        if (
          preferred?.site === site &&
          preferred.pallet === pallet &&
          preferred.level === level
        ) {
          continue;
        }
        push(site, pallet, level);
      }
    }
  }
  for (const t of tries) {
    const line = firstLine(t.site, t.pallet, t.level);
    if (line != null) return { ...t, line };
  }
  throw new Error("Barn is full — return this unit from the warehouse page");
}

export const listAssets = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<Asset[]> => {
    const sql = await ready();
    const rows = await sql<AssetRow>`select * from assets order by id`;
    return rows.map(mapAsset);
  });

export const createAsset = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    kind?: "equip" | "dispenser" | "module";
    model: string;
    serial?: string | null;
    qty?: number;
    customerOwned?: string | null;
    site: string;
    pallet?: string | null;
    level?: number | null;
    purpose?: string | null;
    notes?: string | null;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const kind = data.kind ?? "equip";
    const site = data.site;
    let pallet = data.pallet ?? null;
    let level = data.level ?? null;
    let line: number | null = null;
    const barn = isBarn(site);
    if (barn) {
      if (!pallet || !level) throw new Error("Pick a pallet and level");
      if (!palletsFor(site).includes(pallet)) throw new Error("That pallet is not on this rack");
      line = await nextLine(sql, site, pallet, level);
      if (line == null) throw new Error("That slot is full (12 lines)");
    }
    const status = barn ? "ready" : "deployed";
    const rows = await sql<AssetRow>`
      insert into assets (kind, model, serial, qty, customer_owned, site, pallet, level, line_no, purpose, status, notes)
      values (
        ${kind}, ${data.model}, ${data.serial || null}, ${data.qty ?? 1},
        ${data.customerOwned || null}, ${site}, ${pallet}, ${level}, ${line},
        ${data.purpose || null}, ${status}, ${data.notes || null}
      )
      returning *`;
    return mapAsset(rows[0]!);
  });

export const updateAsset = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: {
    id: number;
    model?: string;
    serial?: string | null;
    qty?: number;
    customerOwned?: string | null;
    purpose?: string | null;
    notes?: string | null;
    pallet?: string | null;
    level?: number | null;
    site?: string;
  }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const cur = await sql<AssetRow>`select * from assets where id = ${data.id}`;
    if (!cur[0]) throw new Error("Asset not found");
    const c = cur[0];
    let pallet = data.pallet === undefined ? c.pallet : data.pallet;
    let level = data.level === undefined ? c.level : data.level;
    let line = c.line_no;
    const site = data.site === undefined ? c.site : data.site;
    if (
      isBarn(site) &&
      (pallet !== c.pallet || level !== c.level || site !== c.site) &&
      pallet &&
      level
    ) {
      line = await nextLine(sql, site, pallet, level);
      if (line == null) throw new Error("That slot is full");
    }
    await sql`
      update assets set
        model = ${data.model ?? c.model},
        serial = ${data.serial === undefined ? c.serial : data.serial},
        qty = ${data.qty === undefined ? c.qty : data.qty},
        customer_owned = ${data.customerOwned === undefined ? c.customer_owned : data.customerOwned},
        purpose = ${data.purpose === undefined ? c.purpose : data.purpose},
        notes = ${data.notes === undefined ? c.notes : data.notes},
        site = ${site},
        pallet = ${pallet},
        level = ${level},
        line_no = ${line},
        updated_at = now()
      where id = ${data.id}`;
    const rows = await sql<AssetRow>`select * from assets where id = ${data.id}`;
    return mapAsset(rows[0]!);
  });

export const assignAssetToInstall = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { assetId: number; installId: number }) => d)
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const asset = (await sql<AssetRow>`select * from assets where id = ${data.assetId}`)[0];
    if (!asset) throw new Error("Asset not found");
    if (asset.status === "sold") throw new Error("Already sold");
    const inst = (await sql<{ id: number; customer: string }>`
      select id, customer from installs where id = ${data.installId}`)[0];
    if (!inst) throw new Error("Install not found");
    const originSite = asset.origin_site ?? asset.site;
    const originPallet = asset.origin_pallet ?? asset.pallet;
    const originLevel = asset.origin_level ?? asset.level;
    await sql`
      update assets set
        status = 'assigned',
        site = 'field',
        pallet = null,
        level = null,
        line_no = null,
        install_id = ${inst.id},
        sold_to = ${inst.customer},
        origin_site = ${originSite},
        origin_pallet = ${originPallet},
        origin_level = ${originLevel},
        purpose = ${asset.customer_owned ? "Customer-owned / loaner" : "Install"},
        updated_at = now()
      where id = ${data.assetId}`;
    const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${asset.pallet ? slotId(asset.pallet, asset.level ?? 0, asset.line_no) : siteLabel(asset.site)}.`;
    await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('install', ${inst.id}, ${context.userId}, 'assigned-asset', ${detail})`;
    const rows = await sql<AssetRow>`select * from assets where id = ${data.assetId}`;
    return mapAsset(rows[0]!);
  });

export const unassignAssetFromInstall = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { assetId: number; installId: number }) => d)
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const asset = (await sql<AssetRow>`select * from assets where id = ${data.assetId}`)[0];
    if (!asset) throw new Error("Asset not found");
    if (asset.install_id !== data.installId) throw new Error("That unit is not on this install");
    const slot = await findOpenBarnSlot(sql, {
      site: asset.origin_site ?? null,
      pallet: asset.origin_pallet ?? null,
      level: num(asset.origin_level),
    });
    await sql`
      update assets set
        status = 'ready',
        site = ${slot.site},
        pallet = ${slot.pallet},
        level = ${slot.level},
        line_no = ${slot.line},
        install_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        updated_at = now()
      where id = ${data.assetId}`;
    await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('install', ${data.installId}, ${context.userId}, 'unassigned-asset', ${asset.model})`;
    const rows = await sql<AssetRow>`select * from assets where id = ${data.assetId}`;
    return mapAsset(rows[0]!);
  });

export const returnAssetToWarehouse = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; site: "barn-back" | "barn-front"; pallet: string; level: number }) => d)
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const cur = (await sql<AssetRow>`select * from assets where id = ${data.id}`)[0];
    if (!cur) throw new Error("Asset not found");
    if (!palletsFor(data.site).includes(data.pallet)) throw new Error("Pallet not on that rack");
    const line = await nextLine(sql, data.site, data.pallet, data.level);
    if (line == null) throw new Error("That slot is full");
    await sql`
      update assets set
        status = 'ready',
        site = ${data.site},
        pallet = ${data.pallet},
        level = ${data.level},
        line_no = ${line},
        install_id = null,
        sold_to = null,
        sold_at = null,
        purpose = null,
        updated_at = now()
      where id = ${data.id}`;
    await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('asset', ${data.id}, ${context.userId}, 'returned', ${`${data.pallet}-L${data.level}`})`;
    const rows = await sql<AssetRow>`select * from assets where id = ${data.id}`;
    return mapAsset(rows[0]!);
  });

export const markAssetSold = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number; soldTo: string }) => d)
  .handler(async ({ data, context }) => {
    const sql = await ready();
    const cur = (await sql<AssetRow>`select * from assets where id = ${data.id}`)[0];
    if (!cur) throw new Error("Asset not found");
    if (cur.customer_owned) throw new Error("Customer-owned unit — return it, don’t sell it");
    await sql`
      update assets set
        status = 'sold',
        site = 'sold',
        pallet = null,
        level = null,
        line_no = null,
        sold_to = ${data.soldTo},
        sold_at = ${todayChicago()},
        updated_at = now()
      where id = ${data.id}`;
    await sql`
      insert into activity (entity_type, entity_id, actor_name, action, detail)
      values ('asset', ${data.id}, ${context.userId}, 'sold', ${data.soldTo})`;
    const rows = await sql<AssetRow>`select * from assets where id = ${data.id}`;
    return mapAsset(rows[0]!);
  });

export const listRecipes = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<Recipe[]> => {
    const sql = await ready();
    const rows = await sql<Record<string, unknown>>`
      select * from recipes
      order by (customer is null) desc, customer, equipment_model`;
    return rows.map(mapRecipe);
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<string[]> => {
    const sql = await ready();
    const rows = await sql<{ customer: string }>`
      select distinct customer from (
        select name as customer from directory_customers
          where archived = false and coalesce(name, '') <> ''
        union
        select customer from installs where coalesce(customer, '') <> ''
        union
        select customer from deals where coalesce(customer, '') <> ''
        union
        select customer from service_jobs where coalesce(customer, '') <> ''
        union
        select customer from pm_jobs where coalesce(customer, '') <> ''
        union
        select customer from recipes where coalesce(customer, '') <> ''
      ) t
      order by customer`;
    return rows.map((r) => r.customer);
  });

function directoryTable(kind: DirectoryKind) {
  if (kind === "customer") return "directory_customers";
  if (kind === "equipment") return "directory_equipment";
  throw new Error("Unknown directory");
}

export type { DirectoryKind, DirectoryEntry };

export const listDirectory = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: { kind: DirectoryKind }) => d)
  .handler(async ({ data }): Promise<DirectoryEntry[]> => {
    const sql = await ready();
    const table = directoryTable(data.kind);
    const rows = await sql.query<{ id: number; name: string }>(
      `select id, name from ${table} where archived = false order by lower(name)`,
    );
    return rows;
  });

export const addDirectoryEntry = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { kind: DirectoryKind; name: string }) => d)
  .handler(async ({ data }): Promise<DirectoryEntry> => {
    const sql = await ready();
    const name = data.name.trim();
    if (!name) throw new Error("Name is empty");
    const table = directoryTable(data.kind);
    const existing = await sql.query<{ id: number; name: string; archived: boolean }>(
      `select id, name, archived from ${table} where lower(name) = $1 limit 1`,
      [name.toLowerCase()],
    );
    if (existing[0]) {
      if (existing[0].archived) {
        await sql.query(`update ${table} set archived = false, updated_at = now() where id = $1`, [
          existing[0].id,
        ]);
      }
      return { id: existing[0].id, name: existing[0].name };
    }
    const rows = await sql.query<{ id: number; name: string }>(
      `insert into ${table} (name) values ($1) returning id, name`,
      [name],
    );
    return rows[0]!;
  });

export const archiveDirectoryEntry = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { kind: DirectoryKind; id: number }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const table = directoryTable(data.kind);
    await sql.query(`update ${table} set archived = true, updated_at = now() where id = $1`, [
      data.id,
    ]);
    return { ok: true };
  });

type RecipeInput = {
  id?: number;
  equipmentModel: string;
  customer?: string | null;
  installId?: number | null;
  copiedFrom?: number | null;
  coffee1?: string | null;
  coffee2?: string | null;
  coffee3?: string | null;
  powder1?: string | null;
  powder2?: string | null;
  powder3?: string | null;
  americano1?: string | null;
  americano2?: string | null;
  americano3?: string | null;
  tea1?: string | null;
  tea2?: string | null;
  milk?: string | null;
  notes?: string | null;
};

async function findRecipeDup(
  sql: Awaited<ReturnType<typeof ready>>,
  model: string,
  customer: string | null,
  exceptId?: number,
) {
  const rows = customer
    ? await sql<{ id: number }>`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and lower(customer) = ${customer.toLowerCase()}`
    : await sql<{ id: number }>`
        select id from recipes
        where lower(equipment_model) = ${model.toLowerCase()}
          and customer is null`;
  const hit = rows[0];
  if (hit && hit.id !== exceptId) return hit;
  return null;
}

export const upsertRecipe = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: RecipeInput) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const model = data.equipmentModel.trim();
    if (!model) throw new Error("Pick an equipment model");
    const customer = data.customer?.trim() || null;
    const isTemplate = !customer;
    let installId = data.installId ?? null;
    if (customer && installId == null) {
      const ins = await sql<{ id: number }>`
        select id from installs where lower(customer) = ${customer.toLowerCase()} limit 2`;
      if (ins.length === 1) installId = ins[0]!.id;
    }
    const dup = await findRecipeDup(sql, model, customer, data.id);
    if (dup) {
      throw new Error(
        customer
          ? `A recipe for ${model} already exists on ${customer}`
          : "A house recipe for that model already exists — open it from the list",
      );
    }
    if (data.id) {
      await sql`
        update recipes set
          equipment_model = ${model},
          customer = ${customer},
          install_id = ${installId},
          copied_from = ${data.copiedFrom ?? null},
          is_template = ${isTemplate},
          coffee_1 = ${data.coffee1 ?? null},
          coffee_2 = ${data.coffee2 ?? null},
          coffee_3 = ${data.coffee3 ?? null},
          powder_1 = ${data.powder1 ?? null},
          powder_2 = ${data.powder2 ?? null},
          powder_3 = ${data.powder3 ?? null},
          americano_1 = ${data.americano1 ?? null},
          americano_2 = ${data.americano2 ?? null},
          americano_3 = ${data.americano3 ?? null},
          tea_1 = ${data.tea1 ?? null},
          tea_2 = ${data.tea2 ?? null},
          milk = ${data.milk ?? null},
          notes = ${data.notes ?? null},
          updated_at = now()
        where id = ${data.id}`;
      const rows = await sql<Record<string, unknown>>`select * from recipes where id = ${data.id}`;
      return mapRecipe(rows[0]!);
    }
    const rows = await sql<Record<string, unknown>>`
      insert into recipes (
        equipment_model, customer, install_id, copied_from, is_template,
        coffee_1, coffee_2, coffee_3,
        powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
        tea_1, tea_2, milk, notes
      ) values (
        ${model}, ${customer}, ${installId}, ${data.copiedFrom ?? null}, ${isTemplate},
        ${data.coffee1 ?? null}, ${data.coffee2 ?? null}, ${data.coffee3 ?? null},
        ${data.powder1 ?? null}, ${data.powder2 ?? null}, ${data.powder3 ?? null},
        ${data.americano1 ?? null}, ${data.americano2 ?? null}, ${data.americano3 ?? null},
        ${data.tea1 ?? null}, ${data.tea2 ?? null},
        ${data.milk ?? null}, ${data.notes ?? null}
      )
      returning *`;
    return mapRecipe(rows[0]!);
  });

export const copyRecipe = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { sourceId: number; customer: string; installId?: number | null }) => d)
  .handler(async ({ data }) => {
    const sql = await ready();
    const customer = data.customer.trim();
    if (!customer) throw new Error("Pick a customer to copy onto");
    const srcRows = await sql<Record<string, unknown>>`select * from recipes where id = ${data.sourceId}`;
    const src = srcRows[0];
    if (!src) throw new Error("Recipe not found");
    const model = String(src.equipment_model);
    const dup = await findRecipeDup(sql, model, customer);
    if (dup) throw new Error(`${customer} already has a ${model} recipe — open it instead`);
    let installId = data.installId ?? null;
    if (installId == null) {
      const ins = await sql<{ id: number }>`
        select id from installs where lower(customer) = ${customer.toLowerCase()} limit 2`;
      if (ins.length === 1) installId = ins[0]!.id;
    }
    const rows = await sql<Record<string, unknown>>`
      insert into recipes (
        equipment_model, customer, install_id, copied_from, is_template,
        coffee_1, coffee_2, coffee_3,
        powder_1, powder_2, powder_3, americano_1, americano_2, americano_3,
        tea_1, tea_2, milk, notes
      ) values (
        ${model}, ${customer}, ${installId}, ${data.sourceId}, false,
        ${src.coffee_1 ?? null}, ${src.coffee_2 ?? null}, ${src.coffee_3 ?? null},
        ${src.powder_1 ?? null}, ${src.powder_2 ?? null}, ${src.powder_3 ?? null},
        ${src.americano_1 ?? null}, ${src.americano_2 ?? null}, ${src.americano_3 ?? null},
        ${src.tea_1 ?? null}, ${src.tea_2 ?? null},
        ${src.milk ?? null}, ${src.notes ?? null}
      )
      returning *`;
    return mapRecipe(rows[0]!);
  });
