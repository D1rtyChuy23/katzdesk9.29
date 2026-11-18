/**
 * A unit's Install date from its install (Chuy, 11/18). When an install is Installed (Corrigo completed it, or someone
 * marked it), each unit it put on the account gets the install's completed date, or its scheduled date when the
 * completed one is blank. The install's history says which date was used.
 *
 * What is filled: a unit this install put on the account (its load made it), or one its pre-inspection marks New, whose
 * install date is blank and which isn't Locked. A unit that was on the account before the install (imported, added by
 * hand) is left: its date isn't this install's. A date already set is never changed. Nothing is filled while the
 * install is open: on the account record an install date means "installed", so it waits until the install is done.
 *
 * With no kind chosen, the pre-inspection reads a dated unit with a serial as Existing. So the same statement that dates
 * a unit records it as New on this visit, which is what it read as before: the install's pre-inspection doesn't change.
 *
 * Runs only from saves (the install window, Corrigo, adding or linking a unit, a serial pulled onto the install), never
 * from reading an install. Plus a one-time Admin backfill for installs done before this: a preview of every row it
 * would write and every one it skips, then Write, which writes only the previewed rows that are still blank, unlocked
 * and would take the same date the preview showed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware } from "@/lib/ops/access";
import { checked } from "@/lib/ops/checked-input";

export const ADMIN_ONLY = "Only an Admin can fill install dates from installs.";
export const SKIP_LOCKED = "Locked: left as it is.";
export const SKIP_NO_DATE = "Its install has no completed or scheduled date.";
export const SKIP_NOT_NEW = "Was on the account before this install (not made by it, and not marked New on its pre-inspection).";

export type InstallDateSource = "completed" | "scheduled";

export type InstallDateRow = {
  unitId: number;
  customer: string;
  equipment: string;
  serial: string | null;
  installId: number;
  wo: string | null;
  date: string;
  source: InstallDateSource;
};

export type InstallDateSkip = Omit<InstallDateRow, "date" | "source"> & { reason: string };

/**
 * Each blank-dated unit on an Installed install's visit (chosen New, or no kind chosen), once, with the date it would
 * take and whether this install made it. A unit on two Installed installs goes by its earliest dated one. $1 limits it
 * to one install (null: every install).
 */
const CANDIDATES_SQL = `
  select distinct on (a.id)
         a.id as unit_id, a.customer, coalesce(nullif(btrim(a.equipment_name), ''), a.catalog_model) as equipment, a.serial,
         i.id as install_id, i.wo, a.locked_at is not null as locked,
         (u.visit_kind = 'new' or a.created_by_install = i.id) as made_here,
         to_char(coalesce(i.completed_at, i.install_date), 'YYYY-MM-DD') as fill_date,
         case when i.completed_at is not null then 'completed' else 'scheduled' end as source
    from install_inspection_units u
    join account_equipment a on a.id = u.equipment_id
    join installs i on i.id = u.install_id
   where (i.complete or i.equip_status = 'Installed')
     and coalesce(i.archived, false) = false
     and a.install_date is null
     and (u.visit_kind is null or u.visit_kind = 'new')
     and ($1::int is null or i.id = $1::int)
   order by a.id, (u.visit_kind = 'new' or a.created_by_install = i.id) desc, coalesce(i.completed_at, i.install_date) is null,
            coalesce(i.completed_at, i.install_date), i.id`;

type Cand = {
  unit_id: number;
  customer: string;
  equipment: string;
  serial: string | null;
  install_id: number;
  wo: string | null;
  locked: boolean;
  made_here: boolean;
  fill_date: string | null;
  source: InstallDateSource;
};

const rowOf = (c: Cand): InstallDateRow => ({
  unitId: Number(c.unit_id),
  customer: c.customer,
  equipment: c.equipment,
  serial: c.serial,
  installId: Number(c.install_id),
  wo: c.wo,
  date: String(c.fill_date),
  source: c.source,
});

/**
 * One statement: blank, unlocked units this install made take their date, and the visit records them as New. The
 * `where` re-checks the unit as it is now, so a date or a lock set since the read is kept. With $2/$3 (the backfill's
 * Write), only those units, and only at the date the preview showed them.
 */
const FILL_SQL = `
  with c as (${CANDIDATES_SQL}),
  picked as (select * from unnest($2::int[], $3::text[]) as p(unit_id, fill_date)),
  upd as (
    update account_equipment a
       set install_date = c.fill_date::date, updated_at = now()
      from c
     where a.id = c.unit_id and c.made_here and not c.locked and c.fill_date is not null
       and a.install_date is null and a.locked_at is null
       and ($2::int[] is null or exists (select 1 from picked p where p.unit_id = c.unit_id and p.fill_date = c.fill_date))
    returning a.id as unit_id, c.customer, c.equipment, c.serial, c.install_id, c.wo, c.fill_date, c.source, c.locked, c.made_here
  ),
  pinned as (
    update install_inspection_units u set visit_kind = 'new'
      from upd where u.install_id = upd.install_id and u.equipment_id = upd.unit_id and u.visit_kind is null
    returning u.equipment_id
  )
  select upd.*, (select count(*) from pinned) as pinned from upd`;

const unitLabel = (r: InstallDateRow) => `${r.equipment}${r.serial ? ` ${r.serial}` : ""}`;

export function sourceText(source: InstallDateSource): string {
  return source === "completed" ? "the install's completed date" : "the install's scheduled date: it has no completed date";
}

/** The install's history line: "Install date 2026-11-10 (the install's completed date) set on: Bunn ITCB-DV ITCB187083, …". */
async function logFilled(sql: Sql, actor: string, rows: InstallDateRow[]): Promise<void> {
  const byInstall = new Map<number, InstallDateRow[]>();
  for (const r of rows) byInstall.set(r.installId, [...(byInstall.get(r.installId) ?? []), r]);
  for (const [installId, list] of byInstall) {
    const groups = new Map<string, InstallDateRow[]>();
    for (const r of list) groups.set(`${r.date}|${r.source}`, [...(groups.get(`${r.date}|${r.source}`) ?? []), r]);
    const detail = [...groups.values()]
      .map((g) => `Install date ${g[0].date} (${sourceText(g[0].source)}) set on: ${g.map(unitLabel).join(", ")}`)
      .join(" · ");
    await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ('install', $1, $2, 'install-date', $3)", [
      installId,
      actor,
      detail,
    ]);
  }
}

/**
 * After an install's units are added or the install is saved/imported: fills its units' blank install dates when it is
 * Installed. Returns what it wrote (nothing for an open install). Never throws into the save that called it.
 */
export async function fillInstallDatesFor(sql: Sql, installId: number, actor: string | null): Promise<InstallDateRow[]> {
  try {
    const rows = (await sql.query<Cand>(FILL_SQL, [installId, null, null])).map(rowOf).sort((a, b) => String(a.serial).localeCompare(String(b.serial)));
    if (rows.length) await logFilled(sql, actor || "System", rows);
    return rows;
  } catch (e) {
    console.error("[install-date] fill failed for install", installId, e);
    return [];
  }
}

export type InstallDateBackfillPreview = { rows: InstallDateRow[]; skipped: InstallDateSkip[] };

async function assertAdmin(sql: Sql, userId: string): Promise<void> {
  if (!(await canReviewNames(sql, userId))) throw new Error(ADMIN_ONLY);
}

/** Every row the backfill would write, and every unit it skips and why. Writes nothing. */
export async function previewInstallDateBackfillFor(sql: Sql, userId: string): Promise<InstallDateBackfillPreview> {
  await assertAdmin(sql, userId);
  const cands = await sql.query<Cand>(CANDIDATES_SQL, [null]);
  const order = (a: { customer: string; serial: string | null; unitId: number }, b: typeof a) =>
    a.customer.localeCompare(b.customer) || String(a.serial ?? "").localeCompare(String(b.serial ?? "")) || a.unitId - b.unitId;
  const rows: InstallDateRow[] = [];
  const skipped: InstallDateSkip[] = [];
  for (const c of cands) {
    if (c.locked || !c.fill_date || !c.made_here) {
      const { date: _d, source: _s, ...rest } = rowOf({ ...c, fill_date: c.fill_date ?? "" });
      skipped.push({ ...rest, reason: c.locked ? SKIP_LOCKED : !c.made_here ? SKIP_NOT_NEW : SKIP_NO_DATE });
    } else rows.push(rowOf(c));
  }
  return { rows: rows.sort(order), skipped: skipped.sort(order) };
}

/**
 * Writes the previewed units, each at the date the preview showed, that are still blank and unlocked; a unit whose date
 * would now differ, or that changed since, is left. Logged per install.
 */
export async function applyInstallDateBackfillFor(
  sql: Sql,
  userId: string,
  data: { rows: { unitId: number; date: string }[] },
): Promise<{ written: InstallDateRow[] }> {
  await assertAdmin(sql, userId);
  const seen = new Set<number>();
  const rows = data.rows.filter((r) => Number.isInteger(r.unitId) && r.unitId > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !seen.has(r.unitId) && seen.add(r.unitId));
  if (!rows.length) return { written: [] };
  const actor =
    (await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Admin";
  const written = (await sql.query<Cand>(FILL_SQL, [null, rows.map((r) => r.unitId), rows.map((r) => r.date)]))
    .map(rowOf)
    .sort((a, b) => String(a.serial).localeCompare(String(b.serial)));
  if (written.length) await logFilled(sql, `${actor} (install date backfill)`, written);
  return { written };
}

const applyInput = checked(
  z.object({ rows: z.array(z.object({ unitId: z.number().int().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).max(20_000) }),
);

export const previewInstallDateBackfill = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .handler(async ({ context }) => previewInstallDateBackfillFor(await getSql(), context.userId));
export const applyInstallDateBackfill = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator(applyInput)
  .handler(async ({ data, context }) => applyInstallDateBackfillFor(await getSql(), context.userId, data));
