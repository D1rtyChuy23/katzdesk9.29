/**
 * Linking a rebuild to a ticket or an install by WO (Chuy, 11/6): find the projects with that WO, see what a link
 * does, and link, relink or unlink. Linking moves the rebuild onto the project's account and Customer P.O. and puts
 * its invoice's lines on the ticket's charges or the install's invoice (rb:<rebuild>:<line>); unlinking takes them
 * back onto its own invoice. Each write is one statement, checked against what the person saw.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, isWarehouseOnly, WAREHOUSE_BILLING_REFUSAL } from "@/lib/ops/access";
import { woMatchKey } from "@/lib/ops/corrigo";
import { isDiscountKind, type Discount } from "@/lib/ops/discount";
import { isInstalled } from "@/lib/ops/install-status";
import { BILLED_ON_INSTALL } from "@/lib/ops/merged-ticket";
import { rebuildBillTo } from "@/lib/ops/invoice-api";
import { heldUnitLockSentence, lockedUnitMovesSql, moveHeldUnits, rebuildRowOut, requireRebuildEditor, type Rebuild } from "@/lib/ops/rebuilds";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { INSTALL_WOS_SQL, WO_KEY_SQL } from "@/lib/ops/wo-search";
import {
  billName,
  lineCount,
  money,
  planLink,
  projectLabel,
  type CurrentLink,
  type LinkPlan,
  type LinkProject,
  type OwnInvoice,
} from "@/lib/ops/rebuild-link";

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

/** A ticket ("job") or an install, as a link names it; `wo`: the one it was found by. */
export type LinkTarget = { kind: "install" | "job"; id: number; wo?: string | null };

export type LinkCandidate = { target: LinkTarget; project: LinkProject; plan: LinkPlan };

export type RebuildLinkView = {
  id: number;
  /** Why this person can't link or unlink this rebuild, or null. */
  refusal: string | null;
  account: string;
  po: string | null;
  installId: number | null;
  jobId: number | null;
  own: OwnInvoice;
  /** The project it is linked to now, with this rebuild's lines on its bill; null when it isn't linked. */
  current: CurrentLink | null;
  /** What Unlink does, or why it can't; null when it isn't linked. */
  unlink: LinkPlan | null;
  /** Open tickets and installs on its account, to pick without typing a WO (as the old list did). */
  suggestions: { target: LinkTarget; label: string }[];
};

export type RebuildLinkFind = RebuildLinkView & {
  /** The WO's match key ("1234"), or null when nothing usable was typed. */
  key: string | null;
  /** Why nothing could be looked up ("Type a WO number…"), or null. */
  error: string | null;
  candidates: LinkCandidate[];
};

const WAREHOUSE_LINKS = "Warehouse doesn't link rebuilds to tickets or installs: their billing is an Admin's. Ask an Admin.";
const CHANGED = "This rebuild or that project changed since you looked, so nothing was linked. Find the WO again.";
const CHANGED_UNLINK = "This rebuild or its project changed since you looked, so nothing was unlinked. Look at it again, then unlink.";

/** Two writes that lock the same rows in another order (a merge and a link): Postgres stops one; it changed meanwhile. */
const isDeadlock = (e: unknown) => {
  const x = e as { code?: unknown; message?: unknown } | null;
  return x?.code === "40P01" || /deadlock detected/i.test(String(x?.message ?? ""));
};

type Viewer = { name: string; refusal: string | null };

async function linkViewer(sql: Sql, userId: string): Promise<Viewer> {
  let access: { warehouse: boolean; username: string };
  try {
    access = await requireRebuildEditor(sql, userId);
  } catch (e) {
    return { name: "Desk", refusal: e instanceof Error ? e.message : String(e) };
  }
  return { name: access.username, refusal: access.warehouse ? WAREHOUSE_LINKS : null };
}

/** SQL: a source key that is one of rebuild `rb`'s lines (rb:<rebuild>:<line>). Not null first, so the partial index serves it. */
const RB_KEY = (col: string, rb: string) =>
  `(${col} is not null and split_part(${col}, ':', 1) = 'rb' and split_part(${col}, ':', 2) = (${rb})::text)`;
const STAMP = (col: string) => `(extract(epoch from ${col}) * 1000000)::bigint::text`;
const toDiscount = (kind: string | null, value: string | null): Discount | null => (isDiscountKind(kind) && Number(value) > 0 ? { kind, value: Number(value) } : null);
const num = (v: unknown) => (v == null ? 0 : Number(v));

type RebuildRead = {
  id: number;
  title: string;
  account: string;
  po: string | null;
  install_id: number | null;
  job_id: number | null;
  archived: boolean;
  link_lines: number;
};

async function readRebuild(sql: Sql, id: number): Promise<RebuildRead | null> {
  const r = (
    await sql.query<RebuildRead>(
      "select id, title, account, po, install_id, job_id, coalesce(archived, false) as archived, coalesce(link_lines, 0) as link_lines from rebuilds where id = $1",
      [id],
    )
  )[0];
  return r
    ? { ...r, id: Number(r.id), install_id: r.install_id == null ? null : Number(r.install_id), job_id: r.job_id == null ? null : Number(r.job_id), link_lines: num(r.link_lines) }
    : null;
}

async function readOwn(sql: Sql, id: number): Promise<OwnInvoice> {
  const h = (
    await sql.query<{ version: string | null; approved: boolean; submitted: boolean; discount_kind: string | null; discount_value: string | null; n: number; total: string }>(
      `select invoice_version('rebuild', v.entity_id) as version, v.approved_at is not null as approved, v.submitted_at is not null as submitted,
              v.discount_kind, v.discount_value::text as discount_value,
              (select count(*)::int from invoice_lines l where l.invoice_id = v.id) as n,
              (select coalesce(sum(round(l.qty * l.rate, 2)), 0)::text from invoice_lines l where l.invoice_id = v.id) as total
         from invoices v where v.entity_type = 'rebuild' and v.entity_id = $1`,
      [id],
    )
  )[0];
  if (!h) return { version: null, state: "none", lines: 0, total: 0, discount: null };
  return {
    version: h.version,
    state: h.approved ? "approved" : h.submitted ? "waiting" : "none",
    lines: num(h.n),
    total: Number(h.total),
    discount: toDiscount(h.discount_kind, h.discount_value),
  };
}

async function readTicket(sql: Sql, jobId: number): Promise<LinkProject | null> {
  const j = (
    await sql.query<{
      id: number;
      kind: string;
      call_id: string | null;
      wo: string | null;
      customer: string | null;
      status: string;
      po: string | null;
      ns_so: string | null;
      duplicate_of: number | null;
      merged_install_id: number | null;
      discount_kind: string | null;
      discount_value: string | null;
      live: string | null;
      stamp: string;
    }>(
      `select j.id, j.kind, j.call_id, j.wo, j.customer, j.status, j.po, j.ns_so, j.duplicate_of, j.merged_install_id,
              j.discount_kind, j.discount_value::text as discount_value, ticket_live_ns_invoices(j.id) as live, ${STAMP("j.updated_at")} as stamp
         from service_jobs j where j.id = $1 and j.kind in ('service', 'tlc')`,
      [jobId],
    )
  )[0];
  if (!j) return null;
  const kind = j.kind === "tlc" ? "tlc" : "service";
  const name = `${kind === "tlc" ? "TLC" : "Service"} ticket ${j.call_id?.trim() || `#${j.id}`}`;
  const so = j.ns_so?.trim() || "";
  return {
    kind,
    id: Number(j.id),
    name,
    wo: j.wo?.trim() || null,
    customer: String(j.customer ?? "").trim(),
    status: j.status,
    blocked:
      j.status === "Cancelled"
        ? `${name} is cancelled.`
        : j.merged_install_id
          ? `${name} was merged into install #${j.merged_install_id}. Link that one.`
          : j.duplicate_of
            ? `${name} was merged into ticket #${j.duplicate_of}. Link that one.`
            : null,
    closed: so ? `is billed on ${so}` : j.live?.trim() ? `is invoiced in NetSuite on ${j.live.trim()}` : null,
    po: j.po?.trim() || null,
    discount: toDiscount(j.discount_kind, j.discount_value),
    netsuite: null,
    stamp: j.stamp,
  };
}

async function readInstall(sql: Sql, installId: number, wo: string | null = null): Promise<LinkProject | null> {
  const i = (
    await sql.query<{
      id: number;
      customer: string | null;
      po: string | null;
      wo: string | null;
      equip_status: string | null;
      complete: boolean | null;
      archived: boolean;
      updated: string;
      version: string | null;
      approved: boolean | null;
      discount_kind: string | null;
      discount_value: string | null;
      netsuite: string | null;
    }>(
      `select i.id, i.customer, i.po, i.wo, i.equip_status, i.complete, coalesce(i.archived, false) as archived,
              ${STAMP("i.updated_at")} as updated, invoice_version('install', i.id) as version, v.approved_at is not null as approved,
              v.discount_kind, v.discount_value::text as discount_value,
              (select string_agg(x.ns_invoice, ', ' order by x.id) from record_ns_invoices x
                where x.install_id = i.id and lower(regexp_replace(x.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')) as netsuite
         from installs i
         left join invoices v on v.entity_type = 'install' and v.entity_id = i.id
        where i.id = $1`,
      [installId],
    )
  )[0];
  if (!i) return null;
  const name = `Install #${i.id}`;
  return {
    kind: "install",
    id: Number(i.id),
    name,
    wo: wo?.trim() || i.wo?.trim() || null,
    customer: String(i.customer ?? "").trim(),
    status: i.archived ? "Off the board" : isInstalled({ complete: i.complete, equipStatus: i.equip_status }) ? "Installed" : i.equip_status || "Not Ready",
    blocked: i.archived ? `${name} was taken off the board.` : null,
    closed: i.approved ? "has an approved invoice" : null,
    po: i.po?.trim() || null,
    discount: toDiscount(i.discount_kind, i.discount_value),
    netsuite: i.netsuite?.trim() || null,
    // The install as the person saw it (its account and P.O.) and its invoice: "row|invoice".
    stamp: `${i.updated}|${i.version ?? ""}`,
  };
}

const readProject = (sql: Sql, t: LinkTarget, wo: string | null = null) => (t.kind === "install" ? readInstall(sql, t.id, wo) : readTicket(sql, t.id));

/** This rebuild's lines on a project's bill: the ticket's charges, or the install's invoice. */
async function linesOn(sql: Sql, rebuildId: number, t: LinkTarget): Promise<{ lines: number; total: number }> {
  const r = (
    await sql.query<{ n: number; total: string }>(
      t.kind === "job"
        ? `select count(*)::int as n, coalesce(sum(round(c.qty * c.rate, 2)), 0)::text as total
             from ticket_charges c where c.job_id = $1 and ${RB_KEY("c.source_key", "$2::int")}`
        : `select count(*)::int as n, coalesce(sum(round(l.qty * l.rate, 2)), 0)::text as total
             from invoices v join invoice_lines l on l.invoice_id = v.id
            where v.entity_type = 'install' and v.entity_id = $1 and ${RB_KEY("l.source_key", "$2::int")}`,
      [t.id, rebuildId],
    )
  )[0];
  return { lines: num(r?.n), total: Number(r?.total ?? 0) };
}

/**
 * This rebuild's lines on any bill but the one it is linked to, as a phrase, or null. A ticket merged into an install
 * keeps a hidden copy of its charges that is never billed, so it counts only when it was merged as billed.
 */
async function linesElsewhere(sql: Sql, rebuildId: number, t: LinkTarget): Promise<string | null> {
  const tickets = await sql.query<{ id: number; call_id: string | null; ns_so: string | null; live: string | null; billed_on: string | null }>(
    `select distinct j.id, j.call_id, j.ns_so, ticket_live_ns_invoices(j.id) as live, ${BILLED_ON_INSTALL("j.id")} as billed_on
       from ticket_charges c join service_jobs j on j.id = c.job_id
      where ${RB_KEY("c.source_key", "$1::int")} and j.id is distinct from $2::int
        and (j.duplicate_of is null or ${BILLED_ON_INSTALL("j.id")} is not null)
      order by j.id limit 1`,
    [rebuildId, t.kind === "job" ? t.id : null],
  );
  const j = tickets[0];
  if (j) {
    const on = j.billed_on?.trim() || j.ns_so?.trim() || j.live?.trim() || "";
    return `ticket ${j.call_id?.trim() || `#${j.id}`}${on ? ` (billed on ${on})` : ""}`;
  }
  const inv = await sql.query<{ entity_type: string; entity_id: number }>(
    `select distinct v.entity_type, v.entity_id
       from invoice_lines l join invoices v on v.id = l.invoice_id
      where ${RB_KEY("l.source_key", "$1::int")} and not (v.entity_type = 'install' and v.entity_id = $2::int)
      order by v.entity_type, v.entity_id limit 1`,
    [rebuildId, t.kind === "install" ? t.id : -1],
  );
  const v = inv[0];
  return v ? `${v.entity_type === "install" ? "install" : v.entity_type} #${v.entity_id}'s invoice` : null;
}

async function readCurrent(sql: Sql, r: RebuildRead): Promise<CurrentLink | null> {
  const t: LinkTarget | null = r.install_id != null ? { kind: "install", id: r.install_id } : r.job_id != null ? { kind: "job", id: r.job_id } : null;
  if (!t) return null;
  const project = await readProject(sql, t);
  if (!project) return null;
  return { ...project, ...(await linesOn(sql, r.id, t)), moved: r.link_lines, elsewhere: await linesElsewhere(sql, r.id, t) };
}

async function suggestionsFor(sql: Sql, account: string): Promise<{ target: LinkTarget; label: string }[]> {
  const name = account.trim();
  if (!name) return [];
  const installs = await sql.query<{ id: number; customer: string; equipment: string | null; wo: string | null }>(
    `select id, customer, equipment, wo from installs
      where archived = false and complete = false and lower(customer) = lower($1)
      order by id desc limit 20`,
    [name],
  );
  const jobs = await sql.query<{ id: number; kind: string; customer: string | null; call_id: string | null; wo: string | null }>(
    `select id, kind, customer, call_id, wo from service_jobs
      where status not in ('Completed', 'Cancelled', 'Phone Resolved') and done = false and kind in ('service', 'tlc')
        and duplicate_of is null and merged_install_id is null and lower(coalesce(customer, '')) = lower($1)
      order by id desc limit 20`,
    [name],
  );
  return [
    ...installs.map((i) => ({
      target: { kind: "install" as const, id: Number(i.id) },
      label: `Install #${i.id}${i.equipment ? ` · ${i.equipment}` : ""}${i.wo?.trim() ? ` · ${i.wo.trim()}` : ""}`,
    })),
    ...jobs.map((j) => ({
      target: { kind: "job" as const, id: Number(j.id) },
      label: `${j.kind === "tlc" ? "TLC" : "Service"} ticket ${j.call_id?.trim() || `#${j.id}`}${j.wo?.trim() ? ` · ${j.wo.trim()}` : ""}`,
    })),
  ];
}

type LinkState = { rebuild: RebuildRead; own: OwnInvoice; current: CurrentLink | null };

async function readState(sql: Sql, id: number): Promise<LinkState | null> {
  const rebuild = await readRebuild(sql, id);
  if (!rebuild) return null;
  return { rebuild, own: await readOwn(sql, id), current: await readCurrent(sql, rebuild) };
}

/** The plan for one project, with the unit-lock rule read only when its account is another one. */
async function planFor(sql: Sql, st: LinkState, project: LinkProject | null): Promise<LinkPlan> {
  const moves = project && normalizeCustomerKey(project.customer) !== normalizeCustomerKey(st.rebuild.account);
  const unitLock = moves ? await heldUnitLockSentence(sql, st.rebuild.id) : null;
  return planLink({ account: st.rebuild.account, po: st.rebuild.po, current: st.current, own: st.own, unitLock }, project);
}

async function viewOf(sql: Sql, st: LinkState, viewer: Viewer): Promise<RebuildLinkView> {
  const refusal = viewer.refusal ?? (st.rebuild.archived ? "This rebuild was removed from the board." : null);
  // Warehouse (and Sales) never see a customer's billing here: where it bills, and nothing of the bill or its invoice.
  const hide = !!viewer.refusal;
  const current: CurrentLink | null =
    st.current && hide
      ? { ...st.current, closed: null, po: null, discount: null, netsuite: null, stamp: "", lines: 0, total: 0, moved: 0, elsewhere: null }
      : st.current;
  return {
    id: st.rebuild.id,
    refusal,
    account: st.rebuild.account,
    po: st.rebuild.po?.trim() || null,
    installId: st.rebuild.install_id,
    jobId: st.rebuild.job_id,
    own: hide ? { version: null, state: "none", lines: 0, total: 0, discount: null } : st.own,
    current,
    unlink: st.current && !refusal ? await planFor(sql, st, null) : null,
    suggestions: refusal ? [] : await suggestionsFor(sql, st.rebuild.account),
  };
}

const idInput = z.object({ id: z.number().int().positive() });

export const getRebuildLink = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof idInput>) => idInput.parse(d))
  .handler(async ({ data, context }): Promise<RebuildLinkView> => getRebuildLinkFor(await ready(), data.id, context.userId));

/** The body of getRebuildLink: what the rebuild is linked to, and what Unlink would do. Reading writes nothing. */
export async function getRebuildLinkFor(sql: Sql, id: number, userId: string): Promise<RebuildLinkView> {
  const st = await readState(sql, id);
  if (!st) throw new Error("That rebuild is no longer on the list.");
  return viewOf(sql, st, await linkViewer(sql, userId));
}

const targetInput = z.object({
  kind: z.enum(["install", "job"]),
  id: z.number().int().positive(),
  /** The WO it was found by (an install has several), for its name in the history and the toast only. */
  wo: z.string().max(80).nullable().optional(),
});
const findInput = z.object({ id: z.number().int().positive(), wo: z.string().max(80).optional(), pick: targetInput.optional() });

export const findRebuildLinks = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof findInput>) => findInput.parse(d))
  .handler(async ({ data, context }): Promise<RebuildLinkFind> => findRebuildLinksFor(await ready(), data, context.userId));

/**
 * The body of findRebuildLinks: every service ticket, TLC and install carrying the WO (an install by any of its work
 * orders), open or done, newest first, each with what linking it does or why it can't. `pick` looks up one project
 * instead (a suggestion). Reading writes nothing.
 */
export async function findRebuildLinksFor(sql: Sql, data: z.output<typeof findInput>, userId: string): Promise<RebuildLinkFind> {
  const st = await readState(sql, data.id);
  if (!st) throw new Error("That rebuild is no longer on the list.");
  const viewer = await linkViewer(sql, userId);
  const view = await viewOf(sql, st, viewer);
  if (view.refusal) return { ...view, key: null, error: view.refusal, candidates: [] };
  let found: { target: LinkTarget; wo: string | null }[] = [];
  let key: string | null = null;
  if (data.pick) {
    found = [{ target: data.pick, wo: null }];
  } else {
    const raw = String(data.wo ?? "").trim();
    key = raw ? woMatchKey(raw) : "";
    if (!key || !/^\d+$/.test(key) || key === "0") {
      return { ...view, key: null, error: "Type a WO number, like WO-1234.", candidates: [] };
    }
    const jobs = await sql.query<{ id: number; wo: string }>(
      `select id, wo from service_jobs where kind in ('service', 'tlc') and ${WO_KEY_SQL("wo")} = $1 order by id desc limit 20`,
      [key],
    );
    const installs = await sql.query<{ install_id: number; wo: string }>(
      `select distinct on (w.install_id) w.install_id, w.wo
         from ${INSTALL_WOS_SQL} w join installs i on i.id = w.install_id
        where i.archived = false and ${WO_KEY_SQL("w.wo")} = $1
        order by w.install_id desc
        limit 20`,
      [key],
    );
    // WO-1234 and WO-01234 are one WO; a stored "1234A" is another, so only exact matches count.
    const exact = (wo: string) => woMatchKey(wo) === key;
    found = [
      ...jobs.filter((j) => exact(j.wo)).map((j) => ({ target: { kind: "job" as const, id: Number(j.id) }, wo: j.wo })),
      ...installs.filter((i) => exact(i.wo)).map((i) => ({ target: { kind: "install" as const, id: Number(i.install_id) }, wo: i.wo })),
    ];
  }
  const candidates: LinkCandidate[] = [];
  for (const f of found) {
    const project = await readProject(sql, f.target, f.wo);
    if (!project) continue;
    candidates.push({ target: { ...f.target, wo: project.wo }, project, plan: await planFor(sql, st, project) });
  }
  const shown = data.pick ? null : `${String(data.wo ?? "").trim()}`;
  return {
    ...view,
    key,
    error: candidates.length ? null : data.pick ? "That ticket or install is no longer there." : `No service ticket, TLC or install has ${shown}.`,
    candidates,
  };
}

const setInput = z.object({
  id: z.number().int().positive(),
  /** The link as the person saw it. */
  expect: z.object({ installId: z.number().int().positive().nullable(), jobId: z.number().int().positive().nullable() }),
  /** The project to link to; null unlinks. */
  to: targetInput.nullable(),
  /** What the person saw: its own invoice's version, the linked project's stamp, the new project's stamp. */
  seen: z.object({ own: z.string().max(80).nullable(), current: z.string().max(80).nullable(), target: z.string().max(80).nullable() }),
});

export type RebuildLinkResult = { row: Rebuild; message: string };

export const setRebuildLink = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof setInput>) => setInput.parse(d))
  .handler(async ({ data, context }): Promise<RebuildLinkResult> => setRebuildLinkFor(await ready(), data, context.userId));

/**
 * Link: the rebuild's invoice lines go on the project's bill (the ticket's charges; the install's invoice, waiting for
 * an Admin), it takes the project's account and Customer P.O., its held units follow the account, and both get a
 * history line. One statement: the rebuild, the project and the bill are locked and checked against what the person
 * saw, read fresh, so nothing written since is lost or billed twice.
 */
export function linkRebuildSql(): string {
  return `with rb as (
       select r.id, r.account
         from rebuilds r
        where r.id = $1::int and coalesce(r.archived, false) = false
          and r.install_id is not distinct from $2::int and r.job_id is not distinct from $3::int
        for update
     ), tj as (
       select j.id, j.kind, btrim(coalesce(j.customer, '')) as customer, nullif(btrim(j.po), '') as po, j.ns_so
         from service_jobs j
        where $4::text = 'job' and j.id = $5::int and j.kind in ('service', 'tlc') and j.status <> 'Cancelled'
          and j.duplicate_of is null and j.merged_install_id is null
          and ${STAMP("j.updated_at")} = $8::text
        for update
     ), ti as (
       -- The install row locked, as the person saw it: approving its invoice, or merging it, waits for this.
       select i.id, btrim(coalesce(i.customer, '')) as customer, nullif(btrim(i.po), '') as po
         from installs i
        where $4::text = 'install' and i.id = $5::int and i.archived = false
          and ${STAMP("i.updated_at")} = split_part($8::text, '|', 1)
        for update
     ), tgt as (
       select 'job'::text as t, tj.id, tj.kind, tj.customer, tj.po, tj.ns_so from tj
       union all
       select 'install', ti.id, 'install', ti.customer, ti.po, null from ti
     ), own as (
       select v.id, v.approved_at, v.submitted_at, v.discount_value from invoices v join rb on v.entity_type = 'rebuild' and v.entity_id = rb.id
     ), own_lines as (
       select l.id, l.item, l.description, l.qty, l.rate, l.kind, l.sort from invoice_lines l join own on l.invoice_id = own.id
     ), ok as (
       select rb.id, rb.account as old_account, tgt.t, tgt.id as target_id, tgt.kind as target_kind, tgt.customer as account, tgt.po,
              (select count(*)::int from own_lines) as n,
              (select coalesce(sum(round(l.qty * l.rate, 2)), 0) from own_lines l) as amount
         from rb cross join tgt
        where regexp_replace(lower(tgt.customer), '[^a-z0-9]+', '', 'g') not in ('', 'walkin')
          -- Its own invoice as the person saw it, read fresh: an approve that committed while this waited counts.
          and invoice_version('rebuild', rb.id) is not distinct from $7::text
          -- Warehouse's saved invoice waits for an Admin; a discount can't ride along.
          and not exists (select 1 from own where own.approved_at is null and own.submitted_at is not null and exists (select 1 from own_lines))
          and not exists (select 1 from own where coalesce(own.discount_value, 0) > 0 and exists (select 1 from own_lines))
          -- Lines go only on an open bill: a ticket not billed (its NetSuite invoices read fresh) ...
          and (tgt.t <> 'job' or not exists (select 1 from own_lines)
               or (nullif(btrim(tgt.ns_so), '') is null and coalesce(ticket_live_ns_invoices(tgt.id), '') = ''))
          -- ... or an install's invoice as the person saw it (fresh), not approved.
          and (tgt.t <> 'install' or (coalesce(invoice_version('install', tgt.id), '') = split_part($8::text, '|', 2)
               and (not exists (select 1 from own_lines)
                    or not exists (select 1 from invoices v where v.entity_type = 'install' and v.entity_id = tgt.id and v.approved_at is not null))))
          -- A unit the owner locked keeps the rebuild on its account.
          and not ${lockedUnitMovesSql("rb", "tgt.customer")}
     ), to_job as (
       insert into ticket_charges (job_id, item, description, qty, rate, kind, source_key, sort)
       select ok.target_id, l.item, l.description, l.qty, l.rate, l.kind, 'rb:' || ok.id::text || ':' || l.id::text,
              coalesce((select max(c.sort) from ticket_charges c where c.job_id = ok.target_id), 0) + row_number() over (order by l.sort, l.id)
         from ok cross join own_lines l
        where ok.t = 'job'
       returning id
     ), head as (
       -- The install's invoice takes them waiting for an Admin to approve it; its saved stamp moves, so an Invoice
       -- window opened before this approves nothing.
       insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at, updated_at)
       select 'install', ok.target_id, ok.account, invoice_total(ok.amount, null, null), $6::text, now(), now()
         from ok where ok.t = 'install' and ok.n > 0
       on conflict (entity_type, entity_id) do update
          set total = invoice_total(
                (select coalesce(sum(round(x.qty * x.rate, 2)), 0) from invoice_lines x where x.invoice_id = invoices.id) + excluded.total,
                invoices.discount_kind, invoices.discount_value),
              submitted_by = excluded.submitted_by, submitted_at = now(), updated_at = now()
        where invoices.approved_at is null
       returning id
     ), to_inst as (
       insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort, source_key)
       select head.id, l.item, l.description, l.qty, l.rate, l.kind,
              coalesce((select max(x.sort) from invoice_lines x where x.invoice_id = head.id), 0) + row_number() over (order by l.sort, l.id),
              'rb:' || ok.id::text || ':' || l.id::text
         from head cross join ok cross join own_lines l
       returning id
     ), done as (
       -- Every line landed: to_job always writes them; to_inst only when head did (an install's invoice approved after
       -- the checks above would take none). Only then is its own invoice gone and the rebuild linked; otherwise its
       -- own lines stay where they are and nothing is linked.
       select ok.* from ok where ok.n = (select count(*)::int from to_job) + (select count(*)::int from to_inst)
     ), own_gone as (
       delete from invoices v using own, done where v.id = own.id returning v.id
     ), upd as (
       update rebuilds r
          set install_id = case when done.t = 'install' then done.target_id end,
              job_id = case when done.t = 'job' then done.target_id end,
              account = done.account, po = done.po, link_lines = done.n, updated_at = now()
         from done
        where r.id = done.id
       returning r.id, r.account, done.old_account
     ), touch as (
       -- The ticket's charges changed: a Charges save or a merge that read it before this (and waited) stops.
       update service_jobs j set updated_at = now() from done join upd on upd.id = done.id where done.t = 'job' and j.id = done.target_id
       returning j.id
     ), touch_install as (
       -- So does Merge installs, which checks the install as it read it (11/6 review): it would leave the rebuild
       -- linked to the install it archives.
       update installs i set updated_at = now() from done join upd on upd.id = done.id where done.t = 'install' and i.id = done.target_id
       returning i.id
     ), act_rb as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'rebuild', upd.id, $6::text, 'linked', $9::text from upd
       returning id
     ), act_target as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select done.target_kind, done.target_id, $6::text, 'updated', $10::text from done join upd on upd.id = done.id
       returning id
     )
     select upd.id, upd.account, upd.old_account, (select count(*)::int from to_job) + (select count(*)::int from to_inst) as moved,
            (select count(*)::int from act_rb) + (select count(*)::int from act_target) as notes
       from upd`;
}

/**
 * Unlink: this rebuild's lines come off the project's bill (read fresh, so a charges save that committed while this
 * waited is what comes back) and back onto its own invoice, approved by the person unlinking (Warehouse's saved one
 * keeps waiting for an Admin). Its account and P.O. stay. One statement, checked against what the person saw.
 */
export function unlinkRebuildSql(): string {
  return `with rb as (
       select r.id, r.account, r.po, r.install_id, r.job_id, coalesce(r.link_lines, 0) as link_lines
         from rebuilds r
        where r.id = $1::int and coalesce(r.archived, false) = false
          and r.install_id is not distinct from $2::int and r.job_id is not distinct from $3::int
          and (r.install_id is not null or r.job_id is not null)
        for update
     ), oj as (
       select j.id, j.kind, j.ns_so, j.duplicate_of, j.merged_install_id, j.updated_at
         from service_jobs j join rb on j.id = rb.job_id
        for update of j
     ), oi as (
       select i.id from installs i join rb on i.id = rb.install_id for update of i
     ), ohead as (
       select v.id, v.approved_at from invoices v join oi on v.entity_type = 'install' and v.entity_id = oi.id
     ), ok as (
       select rb.id, rb.account, rb.po, oj.id as job_id, oj.kind as job_kind, oi.id as install_id, ohead.id as head_id
         from rb
         left join oj on true
         left join oi on true
         left join ohead on true
        where (case when oi.id is not null then coalesce(invoice_version('install', oi.id), '') = split_part($5::text, '|', 2)
                    when oj.id is not null then ${STAMP("oj.updated_at")} = $5::text
                    else true end)
          -- Its lines there as the person saw them, counted fresh; its own invoice too.
          and rebuild_lines_on(rb.id, oj.id, ohead.id) = $6::int
          and invoice_version('rebuild', rb.id) is not distinct from $7::text
          -- Lines come off only an open bill. A billed ticket keeps it too when its link put lines there, though none
          -- can be told apart now (the Billing Backfill writes NetSuite's lines without the keys).
          and (oj.id is null
               or (nullif(btrim(oj.ns_so), '') is null and coalesce(ticket_live_ns_invoices(oj.id), '') = ''
                   and ($6::int = 0 or (oj.duplicate_of is null and oj.merged_install_id is null)))
               or ($6::int = 0 and rb.link_lines = 0))
          and ($6::int = 0 or ohead.id is null or ohead.approved_at is null)
     ), taken as (
       select t.* from ok cross join lateral take_rebuild_lines(ok.id, ok.job_id, ok.head_id) t
     ), back as (
       select count(*)::int as n, coalesce(sum(round(t.qty * t.rate, 2)), 0) as amount from taken t
     ), back_head as (
       insert into invoices (entity_type, entity_id, customer, bill_name, bill_account, bill_address, bill_rep, total, approved_by, approved_at, updated_at, po)
       select 'rebuild', ok.id, ok.account, $8::text, $9::text, $10::text, $11::text, invoice_total(back.amount, null, null), $4::text, now(), now(), ok.po
         from ok cross join back
        where back.n > 0
       on conflict (entity_type, entity_id) do update
          set total = invoice_total(
                (select coalesce(sum(round(x.qty * x.rate, 2)), 0) from invoice_lines x where x.invoice_id = invoices.id) + excluded.total,
                invoices.discount_kind, invoices.discount_value),
              -- Warehouse's saved invoice keeps waiting for an Admin; any other is approved again, by whoever unlinked.
              approved_by = case when invoices.approved_at is null and invoices.submitted_at is not null then invoices.approved_by else excluded.approved_by end,
              approved_at = case when invoices.approved_at is null and invoices.submitted_at is not null then null else now() end,
              updated_at = now()
       returning id
     ), back_lines as (
       insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort)
       select back_head.id, t.item, t.description, t.qty, t.rate, t.line_kind,
              coalesce((select max(x.sort) from invoice_lines x where x.invoice_id = back_head.id), 0) + row_number() over (order by t.sort, t.source_key)
         from back_head cross join taken t
       returning id
     ), old_head as (
       -- The install's invoice changed: its total, and it waits for an Admin again.
       update invoices v
          set total = invoice_total(
                (select coalesce(sum(round(x.qty * x.rate, 2)), 0) from invoice_lines x
                  where x.invoice_id = v.id and not ${RB_KEY("coalesce(x.source_key, '')", "ok.id")}),
                v.discount_kind, v.discount_value),
              submitted_by = $4::text, submitted_at = now(), updated_at = now()
         from ok cross join back
        where v.id = ok.head_id and back.n > 0
       returning v.id
     ), upd as (
       -- back_head always writes (its update has no condition), so every line taken lands on its own invoice; this only
       -- keeps the link if that were ever not so.
       update rebuilds r set install_id = null, job_id = null, link_lines = 0, updated_at = now()
         from ok
        where r.id = ok.id and (select n from back) = (select count(*)::int from back_lines)
       returning r.id
     ), touch as (
       -- The ticket's charges changed: a Charges save that read them before this (and waited for the lock) stops,
       -- rather than putting back the lines this took.
       update service_jobs j set updated_at = now() from ok join upd on upd.id = ok.id where j.id = ok.job_id
       returning j.id
     ), touch_install as (
       -- And Merge installs, which checks the install as it read it.
       update installs i set updated_at = now() from ok join upd on upd.id = ok.id where i.id = ok.install_id
       returning i.id
     ), act_rb as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'rebuild', upd.id, $4::text, 'unlinked', $12::text from upd
       returning id
     ), act_project as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select coalesce(ok.job_kind, 'install'), coalesce(ok.job_id, ok.install_id), $4::text, 'updated', $13::text
         from ok join upd on upd.id = ok.id
        where coalesce(ok.job_id, ok.install_id) is not null
       returning id
     )
     select upd.id, (select n from back) as moved, (select amount::text from back) as amount,
            (select count(*)::int from old_head) as heads, (select count(*)::int from act_rb) + (select count(*)::int from act_project) as notes
       from upd`;
}

const rebuildName = (r: { id: number; title: string }) => `Rebuild #${r.id}${r.title?.trim() ? ` (${r.title.trim()})` : ""}`;

async function unlinkNow(sql: Sql, st: LinkState, who: string): Promise<{ moved: number; amount: number }> {
  const c = st.current!;
  const bill = await rebuildBillTo(sql, st.rebuild.id);
  const lines = c.lines > 0 ? ` · its ${lineCount(c.lines)} (${money(c.total)}) came back onto its own invoice` : "";
  const out = await sql.query<{ id: number; moved: number; amount: string }>(unlinkRebuildSql(), [
    st.rebuild.id,
    st.rebuild.install_id,
    st.rebuild.job_id,
    who,
    c.stamp,
    c.lines,
    st.own.version,
    bill.name,
    bill.accountNumber,
    bill.address,
    bill.rep,
    `Unlinked from ${projectLabel(c)}${lines}`,
    `${rebuildName(st.rebuild)} unlinked${c.lines > 0 ? ` · its ${lineCount(c.lines)} (${money(c.total)}) went back to the rebuild` : ""}`,
  ]).catch((e: unknown) => {
    throw isDeadlock(e) ? new Error(CHANGED_UNLINK) : e;
  });
  if (!out[0]) throw new Error(CHANGED_UNLINK);
  return { moved: num(out[0].moved), amount: Number(out[0].amount ?? 0) };
}

async function linkNow(sql: Sql, st: LinkState, target: LinkTarget, project: LinkProject, who: string): Promise<{ account: string; oldAccount: string; moved: number }> {
  const r = st.rebuild;
  const parts = [
    normalizeCustomerKey(r.account) !== normalizeCustomerKey(project.customer) ? `account ${r.account.trim() || "none"} → ${project.customer}` : null,
    (r.po?.trim() || "") !== (project.po ?? "") ? `Customer P.O. ${project.po ?? "cleared"}` : null,
    st.own.lines > 0 ? `its invoice's ${lineCount(st.own.lines)} (${money(st.own.total)}) went on ${billName(project)}` : null,
  ].filter(Boolean);
  const where = project.kind === "install" ? "this install's invoice, waiting for an Admin to approve it" : "this ticket's charges";
  const out = await sql.query<{ id: number; account: string; old_account: string; moved: number }>(linkRebuildSql(), [
    r.id,
    r.install_id,
    r.job_id,
    target.kind,
    target.id,
    who,
    st.own.version,
    project.stamp,
    `Linked to ${projectLabel(project)}, ${project.customer}${parts.length ? ` · ${parts.join(" · ")}` : ""}`,
    `${rebuildName(r)} linked${st.own.lines > 0 ? ` · its ${lineCount(st.own.lines)} (${money(st.own.total)}) went on ${where}` : ""}`,
  ]).catch((e: unknown) => {
    throw isDeadlock(e) ? new Error(CHANGED) : e;
  });
  if (!out[0]) throw new Error(CHANGED);
  return { account: out[0].account, oldAccount: out[0].old_account, moved: num(out[0].moved) };
}

/**
 * The body of setRebuildLink: link, relink (its lines come off the old project, onto its own invoice, then onto the
 * new one) or unlink. Refused when anything the person saw has changed, or the plan says no; the reason is the plan's.
 */
export async function setRebuildLinkFor(sql: Sql, data: z.output<typeof setInput>, userId: string): Promise<RebuildLinkResult> {
  const viewer = await linkViewer(sql, userId);
  if (viewer.refusal) throw new Error(viewer.refusal);
  let st = await readState(sql, data.id);
  if (!st) throw new Error("That rebuild is no longer on the list.");
  if (st.rebuild.archived) throw new Error("This rebuild was removed from the board.");
  const changed = data.to ? CHANGED : CHANGED_UNLINK;
  if (st.rebuild.install_id !== data.expect.installId || st.rebuild.job_id !== data.expect.jobId) throw new Error(changed);
  const project = data.to ? await readProject(sql, { kind: data.to.kind, id: data.to.id }, data.to.wo ?? null) : null;
  if (data.to && !project) throw new Error("That ticket or install is no longer there.");
  if ((st.own.version ?? null) !== (data.seen.own ?? null)) throw new Error(changed);
  if ((st.current?.stamp ?? null) !== (data.seen.current ?? null)) throw new Error(changed);
  if (project && project.stamp !== (data.seen.target ?? null)) throw new Error(changed);
  const plan = await planFor(sql, st, project);
  if (!plan.ok) throw new Error(plan.refusal);

  let message = "";
  const left = st.current;
  if (plan.steps.includes("unlink")) {
    const back = await unlinkNow(sql, st, viewer.name);
    message =
      back.moved > 0
        ? `Unlinked from ${projectLabel(left!)}. Its ${lineCount(back.moved)} (${money(back.amount)}) are back on its own invoice.`
        : `Unlinked from ${projectLabel(left!)}.`;
  }
  if (plan.steps.includes("link") && project && data.to) {
    // After an unlink its own invoice holds the lines that came back: read it again, as it is now.
    if (plan.steps.includes("unlink")) {
      st = (await readState(sql, data.id))!;
      const again = await planFor(sql, st, project);
      if (!again.ok) throw new Error(`${message} It wasn't linked to ${projectLabel(project)}: ${again.refusal}`);
    }
    let linked: { account: string; oldAccount: string; moved: number };
    try {
      linked = await linkNow(sql, st, data.to, project, viewer.name);
    } catch (e) {
      if (message) throw new Error(`${message} It wasn't linked to ${projectLabel(project)}: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
    // Its held units follow it to the project's account.
    if (normalizeCustomerKey(linked.account) !== normalizeCustomerKey(linked.oldAccount)) await moveHeldUnits(sql, data.id, linked.account, linked.oldAccount);
    const moved = linked.moved > 0 ? ` Its ${lineCount(linked.moved)} went on ${billName(project)}.` : "";
    message = left && plan.steps.includes("unlink") ? `Moved from ${projectLabel(left)} to ${projectLabel(project)}.${moved}` : `Linked to ${projectLabel(project)}.${moved}`;
  }
  const row = await rebuildRowOut(sql, data.id);
  if (!row) throw new Error("That rebuild is no longer on the list.");
  return { row, message };
}

const projectInput = z.object({ type: z.enum(["service", "tlc", "install"]), id: z.number().int().positive() });

export type ProjectRebuild = { id: number; title: string; status: string; removed: boolean; lines: number; total: number };

export const listProjectRebuilds = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof projectInput>) => projectInput.parse(d))
  .handler(async ({ data, context }): Promise<ProjectRebuild[]> => listProjectRebuildsFor(await ready(), data, context.userId));

/** The rebuilds linked to a ticket or an install, with their lines on its bill. Warehouse reads no customer's billing. */
export async function listProjectRebuildsFor(sql: Sql, data: z.output<typeof projectInput>, userId: string): Promise<ProjectRebuild[]> {
  if (await isWarehouseOnly(sql, userId)) throw new Error(WAREHOUSE_BILLING_REFUSAL);
  const install = data.type === "install";
  const rows = await sql.query<{ id: number; title: string; status: string; removed: boolean; n: number; total: string }>(
    install
      ? `select r.id, r.title, r.status, coalesce(r.archived, false) as removed,
                (select count(*)::int from invoices v join invoice_lines l on l.invoice_id = v.id
                  where v.entity_type = 'install' and v.entity_id = $1 and ${RB_KEY("l.source_key", "r.id")}) as n,
                (select coalesce(sum(round(l.qty * l.rate, 2)), 0)::text from invoices v join invoice_lines l on l.invoice_id = v.id
                  where v.entity_type = 'install' and v.entity_id = $1 and ${RB_KEY("l.source_key", "r.id")}) as total
           from rebuilds r where r.install_id = $1 order by r.id`
      : `select r.id, r.title, r.status, coalesce(r.archived, false) as removed,
                (select count(*)::int from ticket_charges c where c.job_id = $1 and ${RB_KEY("c.source_key", "r.id")}) as n,
                (select coalesce(sum(round(c.qty * c.rate, 2)), 0)::text from ticket_charges c where c.job_id = $1 and ${RB_KEY("c.source_key", "r.id")}) as total
           from rebuilds r where r.job_id = $1 order by r.id`,
    [data.id],
  );
  return rows.map((r) => ({ id: Number(r.id), title: r.title, status: r.status, removed: !!r.removed, lines: num(r.n), total: Number(r.total) }));
}
