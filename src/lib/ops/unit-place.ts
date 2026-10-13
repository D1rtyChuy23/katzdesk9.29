import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { serialKey } from "@/lib/ops/account-equip";
import { electricalFrom, placeMove, resolvePlaceSite, unitPlaceLabel } from "@/lib/ops/unit-place-rules";
import { requireStock } from "@/lib/ops/rack-stock";
import {
  LEVELS,
  LOCATION_SITES,
  SITE_PURPOSE,
  isBarn,
  rackBayError,
  sectionFullMessage,
} from "@/lib/ops/warehouse";

export { electricalFrom, lastMoveLine, placeMove, unitPlaceLabel } from "@/lib/ops/unit-place-rules";

function barnRack(site: string): "barn-back" | "barn-front" | null {
  if (site === "barn-back") return "barn-back";
  if (site === "barn-front") return "barn-front";
  return null;
}

function requireLevel(level: number | null | undefined): number {
  const n = Number(level);
  if (!LEVELS.includes(n as (typeof LEVELS)[number])) throw new Error("Pick a level");
  return n;
}

function isLocationSite(site: string): boolean {
  return (LOCATION_SITES as readonly string[]).includes(site) || site === "other" || site === "staging";
}

export type BarnUnit = {
  id: number;
  model: string;
  serial: string | null;
  pallet: string | null;
  electrical: string | null;
  customerOwned: string | null;
  place: string;
};

export type UnitPlace = {
  found: boolean;
  assetId: number | null;
  model: string | null;
  serial: string | null;
  place: string | null;
  site: string | null;
  pallet: string | null;
  electrical: string | null;
  status: string | null;
};

type AssetRow = {
  id: number;
  model: string;
  serial: string | null;
  status: string;
  site: string;
  pallet: string | null;
  level: number | null;
  line_no: number | null;
  notes: string | null;
  purpose: string | null;
  customer_owned: string | null;
  sold_to: string | null;
  install_id: number | null;
  job_id: number | null;
};

const ASSET_COLS = `id, model, serial, status, site, pallet, level, line_no, notes, purpose,
  customer_owned, sold_to, install_id, job_id`;

function withNote(notes: string | null, extra: string | null | undefined): string | null {
  const add = (extra ?? "").trim();
  const base = (notes ?? "").trim();
  if (!add) return base || null;
  if (base.toLowerCase().includes(add.toLowerCase())) return base;
  return [base, add].filter(Boolean).join("\n");
}

async function ready() {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function deskUsername(sql: Sql, userId: string): Promise<string> {
  const row = await sql.query<{ username: string | null }>(
    "select username from desk_accounts where user_id = $1",
    [userId],
  );
  return row[0]?.username || "Teammate";
}

async function logMove(sql: Sql, userId: string, assetId: number, detail: string) {
  await sql.query(
    `insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ('asset', $1, $2, 'moved', $3)`,
    [assetId, await deskUsername(sql, userId), detail],
  );
}

async function bySerial(sql: Sql, serial: string): Promise<AssetRow | null> {
  const key = serialKey(serial);
  if (!key) return null;
  const rows = await sql.query<AssetRow>(
    `select ${ASSET_COLS} from assets where serial is not null and btrim(serial) <> ''`,
  );
  const hits = rows.filter((r) => serialKey(r.serial) === key);
  return hits.find((r) => r.status !== "sold") ?? hits[0] ?? null;
}

async function byId(sql: Sql, id: number): Promise<AssetRow | null> {
  const rows = await sql.query<AssetRow>(`select ${ASSET_COLS} from assets where id = $1`, [id]);
  return rows[0] ?? null;
}

function toPlace(row: AssetRow | null): UnitPlace {
  if (!row) {
    return {
      found: false,
      assetId: null,
      model: null,
      serial: null,
      place: null,
      site: null,
      pallet: null,
      electrical: null,
      status: null,
    };
  }
  return {
    found: true,
    assetId: row.id,
    model: row.model,
    serial: row.serial,
    place: unitPlaceLabel({
      site: row.site,
      pallet: row.pallet,
      level: row.level,
      status: row.status,
      soldTo: row.sold_to,
      purpose: row.purpose,
    }),
    site: row.site,
    pallet: row.pallet,
    electrical: electricalFrom(row.notes) || electricalFrom(row.purpose),
    status: row.status,
  };
}

async function openLine(sql: Sql, site: string, pallet: string, level: number, exceptId?: number): Promise<number> {
  const taken = await sql.query<{ id: number; line_no: number }>(
    `select id, line_no from assets
      where site = $1 and upper(pallet) = $2 and level = $3
        and status in ('ready', 'deployed')
        and line_no is not null`,
    [site, pallet, level],
  );
  const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.line_no));
  for (let line = 1; line <= 12; line++) {
    if (!used.has(line)) return line;
  }
  throw new Error(sectionFullMessage(site, pallet, level));
}

async function parkInBarn(
  sql: Sql,
  userId: string,
  row: AssetRow,
  pallet: string,
  level: number,
  fromLabel: string,
  rack: "barn-back" | "barn-front" = "barn-back",
): Promise<string> {
  if (placeMove(row) === "blocked") {
    throw new Error(`That serial is already allocated${row.sold_to ? ` to ${row.sold_to}` : ""}.`);
  }
  const letter = pallet.trim().toUpperCase();
  const bayErr = rackBayError(rack, letter);
  if (bayErr) throw new Error(bayErr);
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) throw new Error("Pick a level");
  const same =
    row.site === rack &&
    (row.pallet ?? "").toUpperCase() === letter &&
    Number(row.level) === level &&
    row.status === "ready";
  if (same) {
    throw new Error(`Already at ${unitPlaceLabel({ site: rack, pallet: letter, level, status: "ready" })}.`);
  }
  const { assertNotHeld } = await import("@/lib/ops/stock-actions");
  await assertNotHeld(sql, row.id);
  await requireStock(sql, userId);
  const line = await openLine(sql, rack, letter, level, row.id);
  const to = unitPlaceLabel({ site: rack, pallet: letter, level, status: "ready" });
  const notice = await moveNotice(sql, userId, fromLabel, to);
  const notes = withNote(row.notes, notice);
  await sql.query(
    `update assets set
        status = 'ready',
        site = $2,
        pallet = $3,
        level = $4,
        line_no = $5,
        notes = $6,
        updated_at = now()
      where id = $1`,
    [row.id, rack, letter, level, line, notes],
  );
  await logMove(sql, userId, row.id, notice);
  const { flagRackArrival } = await import("@/lib/ops/rack-stock");
  await flagRackArrival(sql, userId, row.id, {
    site: row.site,
    pallet: row.pallet,
    level: row.level,
    line_no: row.line_no,
    status: row.status,
  });
  return notice;
}

async function parkAtLocation(
  sql: Sql,
  userId: string,
  row: AssetRow,
  site: string,
  electrical: string | null,
  otherLabel: string | null,
): Promise<string> {
  const dest = resolvePlaceSite(site);
  if (!isLocationSite(dest)) throw new Error("Pick a location");
  if (placeMove(row) === "blocked") {
    throw new Error(`That serial is already allocated${row.sold_to ? ` to ${row.sold_to}` : ""}.`);
  }
  const label = (otherLabel ?? "").trim();
  if (dest === "other" && !label) throw new Error("Other needs a short label.");
  const { assertNotHeld } = await import("@/lib/ops/stock-actions");
  await assertNotHeld(sql, row.id);
  const from = unitPlaceLabel({
    site: row.site,
    pallet: row.pallet,
    level: row.level,
    status: row.status,
    soldTo: row.sold_to,
    purpose: row.purpose,
  });
  const to = unitPlaceLabel({ site: dest, purpose: dest === "other" ? label : row.purpose, status: "deployed" });
  const notice = await moveNotice(sql, userId, from, to);
  const purpose =
    dest === "other" ? label : row.site === "other" ? (SITE_PURPOSE[dest] ?? null) : row.purpose?.trim() || SITE_PURPOSE[dest] || null;
  const notes = withNote(withNote(row.notes, electrical), notice);
  await sql.query(
    `update assets set
        status = 'deployed',
        site = $2,
        pallet = null,
        level = null,
        line_no = null,
        notes = $3,
        purpose = $4,
        updated_at = now()
      where id = $1`,
    [row.id, dest, notes, purpose],
  );
  await logMove(sql, userId, row.id, notice);
  return notice;
}

async function moveNotice(sql: Sql, userId: string, from: string, to: string): Promise<string> {
  const who = await deskUsername(sql, userId);
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  return `Moved from ${from} to ${to} · ${who} · ${when}`;
}

export const listBarnAvailable = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async (): Promise<BarnUnit[]> => {
    const sql = await ready();
    const rows = await sql.query<AssetRow>(
      `select ${ASSET_COLS} from assets
        where status = 'ready'
          and site in ('barn-back', 'barn-front')
          and install_id is null
          and job_id is null
          and coalesce(sold_to, '') = ''
          and coalesce(stock_hold, '') <> 'assign'
        order by lower(model), serial nulls last, id`,
    );
    return rows.map((r) => ({
      id: r.id,
      model: r.model,
      serial: r.serial,
      pallet: r.pallet,
      electrical: electricalFrom(r.notes) || electricalFrom(r.purpose),
      customerOwned: r.customer_owned,
      place: unitPlaceLabel({ site: r.site, pallet: r.pallet, level: r.level, status: r.status, soldTo: r.sold_to }),
    }));
  });

const placeIdsInput = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  site: z.string(),
  otherLabel: z.string().nullable().optional(),
});

export const placeAssetsAtLocation = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof placeIdsInput>) => placeIdsInput.parse(d))
  .handler(async ({ data, context }): Promise<{ moved: number }> => {
    if (!isLocationSite(resolvePlaceSite(data.site))) throw new Error("Pick a location");
    const sql = await ready();
    const rows = await Promise.all(data.ids.map((id) => byId(sql, id)));
    for (const row of rows) {
      if (!row) throw new Error("That unit is not in the barn");
      if (!isBarn(row.site) || row.status !== "ready") throw new Error(`${row.model} is not available in the barn`);
    }
    for (const row of rows) {
      if (!row) continue;
      await parkAtLocation(sql, context.userId, row, data.site, null, data.otherLabel ?? null);
    }
    return { moved: rows.length };
  });

const addInput = z.object({
  site: z.string(),
  model: z.string().min(1),
  serial: z.string().nullable().optional(),
  electrical: z.string().nullable().optional(),
  otherLabel: z.string().nullable().optional(),
});

export const addUnitToLocation = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof addInput>) => addInput.parse(d))
  .handler(async ({ data, context }): Promise<{ assetId: number; pulled: boolean }> => {
    if (!isLocationSite(resolvePlaceSite(data.site))) throw new Error("Pick a location");
    const sql = await ready();
    const serial = data.serial?.trim() || "";
    const electrical = data.electrical?.trim() || null;
    if (serial) {
      const existing = await bySerial(sql, serial);
      const action = placeMove(existing);
      if (action === "blocked" && existing) {
        throw new Error(`That serial is already allocated${existing.sold_to ? ` to ${existing.sold_to}` : ""}.`);
      }
      if (existing && action === "move") {
        await parkAtLocation(sql, context.userId, existing, data.site, electrical, data.otherLabel ?? null);
        return { assetId: existing.id, pulled: isBarn(existing.site) };
      }
    }
    const dest = resolvePlaceSite(data.site);
    const label = (data.otherLabel ?? "").trim();
    if (dest === "other" && !label) throw new Error("Other needs a short label.");
    const notes = withNote(null, electrical);
    const inserted = await sql.query<{ id: number }>(
      `insert into assets (kind, model, serial, qty, site, purpose, status, notes)
       values ('equip', $1, $2, 1, $3, $4, 'deployed', $5)
       returning id`,
      [
        data.model.trim(),
        serial || null,
        dest,
        dest === "other" ? label : SITE_PURPOSE[dest] ?? null,
        notes,
      ],
    );
    const id = inserted[0]?.id;
    if (!id) throw new Error("Could not add that unit");
    return { assetId: id, pulled: false };
  });

const barnInput = z.object({
  id: z.number().int().positive(),
  pallet: z.string().min(1),
  level: z.number().int(),
});

export const moveUnitToBarn = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof barnInput>) => barnInput.parse(d))
  .handler(async ({ data, context }): Promise<{ place: string; notice: string }> => {
    const sql = await ready();
    const row = await byId(sql, data.id);
    if (!row) throw new Error("Unit not found");
    if (isBarn(row.site) && row.status === "ready") throw new Error("That unit is already in the barn");
    const from = unitPlaceLabel({
      site: row.site,
      pallet: row.pallet,
      level: row.level,
      status: row.status,
      soldTo: row.sold_to,
      purpose: row.purpose,
    });
    const level = requireLevel(data.level);
    const notice = await parkInBarn(sql, context.userId, row, data.pallet, level, from);
    return {
      place: unitPlaceLabel({ site: "barn-back", pallet: data.pallet.trim().toUpperCase(), level, status: "ready" }),
      notice,
    };
  });

const lookupInput = z.object({ serial: z.string() });

export const lookupUnitPlace = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof lookupInput>) => lookupInput.parse(d))
  .handler(async ({ data }): Promise<UnitPlace> => {
    const sql = await ready();
    return toPlace(await bySerial(sql, data.serial));
  });

const setInput = z.object({
  serial: z.string().min(1),
  model: z.string().nullable().optional(),
  site: z.string(),
  pallet: z.string().nullable().optional(),
  level: z.number().int().nullable().optional(),
  otherLabel: z.string().nullable().optional(),
});

export const setUnitPlace = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof setInput>) => setInput.parse(d))
  .handler(async ({ data, context }): Promise<UnitPlace> => {
    const sql = await ready();
    const serial = data.serial.trim();
    if (!serialKey(serial)) throw new Error("Enter a serial so this stays one record.");
    const existing = await bySerial(sql, serial);
    const action = placeMove(existing);
    if (action === "blocked" && existing) {
      throw new Error(`That serial is already allocated${existing.sold_to ? ` to ${existing.sold_to}` : ""}.`);
    }
    if (data.site === "barn") throw new Error("Pick a rack.");
    const rack = barnRack(data.site);
    if (rack) {
      if (!data.pallet?.trim()) throw new Error("Pick a bay A through P");
      const level = requireLevel(data.level);
      if (existing) {
        await parkInBarn(
          sql,
          context.userId,
          existing,
          data.pallet,
          level,
          unitPlaceLabel({
            site: existing.site,
            pallet: existing.pallet,
            level: existing.level,
            status: existing.status,
            soldTo: existing.sold_to,
            purpose: existing.purpose,
          }),
          rack,
        );
        return toPlace(await byId(sql, existing.id));
      }
      const letter = data.pallet.trim().toUpperCase();
      const bayErr = rackBayError(rack, letter);
      if (bayErr) throw new Error(bayErr);
      await requireStock(sql, context.userId);
      const line = await openLine(sql, rack, letter, level);
      const inserted = await sql.query<{ id: number }>(
        `insert into assets (kind, model, serial, qty, site, pallet, level, line_no, status)
         values ('equip', $1, $2, 1, $3, $4, $5, $6, 'ready')
         returning id`,
        [data.model?.trim() || "Equipment", serial, rack, letter, level, line],
      );
      const id = inserted[0]?.id;
      if (!id) throw new Error("Could not add that unit");
      return toPlace(await byId(sql, id));
    }
    if (!isLocationSite(resolvePlaceSite(data.site))) throw new Error("Pick a location");
    if (existing) {
      await parkAtLocation(sql, context.userId, existing, data.site, null, data.otherLabel ?? null);
      return toPlace(await byId(sql, existing.id));
    }
    const dest = resolvePlaceSite(data.site);
    const label = (data.otherLabel ?? "").trim();
    if (dest === "other" && !label) throw new Error("Other needs a short label.");
    const inserted = await sql.query<{ id: number }>(
      `insert into assets (kind, model, serial, qty, site, purpose, status)
       values ('equip', $1, $2, 1, $3, $4, 'deployed')
       returning id`,
      [data.model?.trim() || "Equipment", serial, dest, dest === "other" ? label : SITE_PURPOSE[dest] ?? null],
    );
    const id = inserted[0]?.id;
    if (!id) throw new Error("Could not add that unit");
    return toPlace(await byId(sql, id));
  });

const assetPlaceInput = z.object({
  id: z.number().int().positive(),
  site: z.string(),
  pallet: z.string().nullable().optional(),
  level: z.number().int().nullable().optional(),
  otherLabel: z.string().nullable().optional(),
  swapWithId: z.number().int().positive().nullable().optional(),
});

function statusAt(site: string, previous: string): string {
  if (site === "barn-back" || site === "barn-front") return "ready";
  if (previous === "ready") return "deployed";
  return previous;
}

/** Exchange two units' places. Each serial stays its own record. */
async function swapAssetPlaces(
  sql: Sql,
  userId: string,
  mover: AssetRow,
  otherId: number,
  rack: "barn-back" | "barn-front",
  pallet: string,
  level: number,
): Promise<void> {
  if (mover.id === otherId) throw new Error("Pick a different unit to swap.");
  const other = await byId(sql, otherId);
  const letter = pallet.trim().toUpperCase();
  if (
    !other ||
    other.site !== rack ||
    (other.pallet ?? "").toUpperCase() !== letter ||
    Number(other.level) !== level
  ) {
    throw new Error("That unit is not in this section.");
  }
  if (placeMove(mover) === "blocked") {
    throw new Error(`That serial is already allocated${mover.sold_to ? ` to ${mover.sold_to}` : ""}.`);
  }
  if (placeMove(other) === "blocked") {
    throw new Error(`That serial is already allocated${other.sold_to ? ` to ${other.sold_to}` : ""}.`);
  }
  const { assertNotHeld } = await import("@/lib/ops/stock-actions");
  await assertNotHeld(sql, mover.id);
  await assertNotHeld(sql, other.id);
  await requireStock(sql, userId);
  const moverStatus = statusAt(other.site, other.status);
  const otherStatus = statusAt(mover.site, mover.status);
  await sql.query(
    `update assets set status = $2, site = $3, pallet = $4, level = $5, line_no = $6, updated_at = now() where id = $1`,
    [mover.id, moverStatus, other.site, other.pallet, other.level, other.line_no],
  );
  await sql.query(
    `update assets set status = $2, site = $3, pallet = $4, level = $5, line_no = $6, updated_at = now() where id = $1`,
    [other.id, otherStatus, mover.site, mover.pallet, mover.level, mover.line_no],
  );
  const moverFrom = unitPlaceLabel({
    site: mover.site,
    pallet: mover.pallet,
    level: mover.level,
    status: mover.status,
    soldTo: mover.sold_to,
    purpose: mover.purpose,
  });
  const moverTo = unitPlaceLabel({
    site: other.site,
    pallet: other.pallet,
    level: other.level,
    status: moverStatus,
    soldTo: other.sold_to,
    purpose: other.purpose,
  });
  const otherFrom = moverTo;
  const otherTo = unitPlaceLabel({
    site: mover.site,
    pallet: mover.pallet,
    level: mover.level,
    status: otherStatus,
    soldTo: mover.sold_to,
    purpose: mover.purpose,
  });
  const moverNotice = await moveNotice(sql, userId, moverFrom, `${moverTo} (swapped with ${other.serial || other.model})`);
  const otherNotice = await moveNotice(sql, userId, otherFrom, `${otherTo} (swapped with ${mover.serial || mover.model})`);
  await sql.query("update assets set notes = $2 where id = $1", [mover.id, withNote(mover.notes, moverNotice)]);
  await sql.query("update assets set notes = $2 where id = $1", [other.id, withNote(other.notes, otherNotice)]);
  await logMove(sql, userId, mover.id, moverNotice);
  await logMove(sql, userId, other.id, otherNotice);
  const { flagRackArrival } = await import("@/lib/ops/rack-stock");
  if (isBarn(other.site)) {
    await flagRackArrival(sql, userId, mover.id, {
      site: mover.site,
      pallet: mover.pallet,
      level: mover.level,
      line_no: mover.line_no,
      status: mover.status,
    });
  }
  if (isBarn(mover.site)) {
    await flagRackArrival(sql, userId, other.id, {
      site: other.site,
      pallet: other.pallet,
      level: other.level,
      line_no: other.line_no,
      status: other.status,
    });
  }
}

export const setAssetPlace = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof assetPlaceInput>) => assetPlaceInput.parse(d))
  .handler(async ({ data, context }): Promise<UnitPlace> => {
    const sql = await ready();
    const row = await byId(sql, data.id);
    if (!row) throw new Error("Unit not found");
    if (data.site === "barn") throw new Error("Pick a rack.");
    const rack = barnRack(data.site);
    if (rack) {
      if (!data.pallet?.trim()) throw new Error("Pick a bay A through P");
      const level = requireLevel(data.level);
      if (data.swapWithId) {
        await swapAssetPlaces(sql, context.userId, row, data.swapWithId, rack, data.pallet, level);
        return toPlace(await byId(sql, row.id));
      }
      await parkInBarn(
        sql,
        context.userId,
        row,
        data.pallet,
        level,
        unitPlaceLabel({
          site: row.site,
          pallet: row.pallet,
          level: row.level,
          status: row.status,
          soldTo: row.sold_to,
          purpose: row.purpose,
        }),
        rack,
      );
      return toPlace(await byId(sql, row.id));
    }
    if (data.swapWithId) throw new Error("Replace/Swap is only for a rack section.");
    await parkAtLocation(sql, context.userId, row, data.site, null, data.otherLabel ?? null);
    return toPlace(await byId(sql, row.id));
  });

const assetsPlaceInput = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(60),
  site: z.string(),
  pallet: z.string().nullable().optional(),
  level: z.number().int().nullable().optional(),
  otherLabel: z.string().nullable().optional(),
  /** Units already in the destination section that trade places with the moved units. */
  swapIds: z.array(z.number().int().positive()).max(60).optional(),
});

export type MultiPlaceResult = { moved: number; swapped: number; place: string | null; failed: string[] };

function placeLabelOf(row: AssetRow): string {
  return unitPlaceLabel({
    site: row.site,
    pallet: row.pallet,
    level: row.level,
    status: row.status,
    soldTo: row.sold_to,
    purpose: row.purpose,
  });
}

/**
 * Move several units at once. With swapIds, the chosen units in the destination section
 * go back to where the moved units came from: exact position trades first, then any
 * extras park in the other section.
 */
export const setAssetsPlace = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof assetsPlaceInput>) => assetsPlaceInput.parse(d))
  .handler(async ({ data, context }): Promise<MultiPlaceResult> => {
    const sql = await ready();
    const ids = [...new Set(data.ids)];
    const swapIds = [...new Set(data.swapIds ?? [])].filter((id) => !ids.includes(id));
    const movers: AssetRow[] = [];
    for (const id of ids) {
      const row = await byId(sql, id);
      if (!row) throw new Error("One of the units was not found — refresh and try again.");
      movers.push(row);
    }
    if (data.site === "barn") throw new Error("Pick a rack.");
    const rack = barnRack(data.site);
    const failed: string[] = [];
    const name = (r: AssetRow) => r.serial || r.model;

    if (!rack) {
      if (swapIds.length) throw new Error("Replace/Swap is only for a rack section.");
      let moved = 0;
      for (const row of movers) {
        try {
          await parkAtLocation(sql, context.userId, row, data.site, null, data.otherLabel ?? null);
          moved += 1;
        } catch (e) {
          failed.push(`${name(row)}: ${e instanceof Error ? e.message : "could not move"}`);
        }
      }
      return { moved, swapped: 0, place: null, failed };
    }

    if (!data.pallet?.trim()) throw new Error("Pick a bay A through P");
    const level = requireLevel(data.level);
    const letter = data.pallet.trim().toUpperCase();
    const others: AssetRow[] = [];
    for (const id of swapIds) {
      const row = await byId(sql, id);
      if (
        !row ||
        row.site !== rack ||
        (row.pallet ?? "").toUpperCase() !== letter ||
        Number(row.level) !== level
      ) {
        throw new Error("A unit picked to swap is no longer in that section — refresh and try again.");
      }
      others.push(row);
    }
    if (others.length && !movers.some((m) => m.site === "barn-back" || m.site === "barn-front")) {
      throw new Error("Swapped units need a rack to go back to. Move without Replace/Swap, or pick units that are on a rack.");
    }

    let moved = 0;
    let swapped = 0;
    // 1) Pair up: each moved unit trades exact places with one chosen unit.
    const pairs = Math.min(movers.length, others.length);
    for (let i = 0; i < pairs; i += 1) {
      const mover = movers[i]!;
      const other = others[i]!;
      try {
        if (mover.site !== "barn-back" && mover.site !== "barn-front") {
          // Coming from off the rack: it takes the rack spot, and the other unit goes to the first rack origin below.
          throw new Error("skip-pair");
        }
        await swapAssetPlaces(sql, context.userId, mover, other.id, rack, letter, level);
        moved += 1;
        swapped += 1;
      } catch (e) {
        if (e instanceof Error && e.message === "skip-pair") continue;
        failed.push(`${name(mover)} ↔ ${name(other)}: ${e instanceof Error ? e.message : "could not swap"}`);
      }
    }
    // 2) Extra moved units park in the destination section. If it's full, retry after step 3 frees room.
    const retry: number[] = [];
    const parkMover = async (id: number, lastTry: boolean) => {
      const fresh = await byId(sql, id);
      if (!fresh) return;
      const arrived = fresh.site === rack && (fresh.pallet ?? "").toUpperCase() === letter && Number(fresh.level) === level;
      if (arrived) return;
      try {
        await parkInBarn(sql, context.userId, fresh, letter, level, placeLabelOf(fresh), rack);
        moved += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "could not move";
        if (!lastTry && /full/i.test(msg)) retry.push(id);
        else failed.push(`${name(fresh)}: ${msg}`);
      }
    };
    for (const mover of movers) await parkMover(mover.id, false);
    // 3) Extra chosen units go to the first moved unit's original rack section.
    const home = movers.find((m) => m.site === "barn-back" || m.site === "barn-front");
    for (const other of others) {
      const fresh = await byId(sql, other.id);
      if (!fresh) continue;
      const stillHere = fresh.site === rack && (fresh.pallet ?? "").toUpperCase() === letter && Number(fresh.level) === level;
      if (!stillHere || !home) continue;
      try {
        await parkInBarn(
          sql,
          context.userId,
          fresh,
          home.pallet ?? "",
          Number(home.level),
          placeLabelOf(fresh),
          home.site as "barn-back" | "barn-front",
        );
        swapped += 1;
      } catch (e) {
        failed.push(`${name(fresh)}: ${e instanceof Error ? e.message : "could not swap back"}`);
      }
    }
    for (const id of retry) await parkMover(id, true);
    const place = unitPlaceLabel({ site: rack, pallet: letter, level, status: "ready" });
    return { moved, swapped, place, failed };
  });
