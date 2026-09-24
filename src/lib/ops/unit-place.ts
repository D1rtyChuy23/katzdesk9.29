import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { serialKey } from "@/lib/ops/account-equip";
import { electricalFrom, placeMove, resolvePlaceSite, unitPlaceLabel } from "@/lib/ops/unit-place-rules";
import {
  BACK_PALLETS,
  FRONT_PALLETS,
  LEVELS,
  LOCATION_SITES,
  SITE_PURPOSE,
  isBarn,
  isValidBay,
  slotId,
} from "@/lib/ops/warehouse";

export { electricalFrom, lastMoveLine, placeMove, unitPlaceLabel } from "@/lib/ops/unit-place-rules";

function barnRack(site: string): "barn-back" | "barn-front" | null {
  if (site === "barn" || site === "barn-back") return "barn-back";
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
      where site = $1 and pallet = $2 and level = $3
        and status in ('ready', 'deployed')
        and line_no is not null`,
    [site, pallet, level],
  );
  const used = new Set(taken.filter((t) => t.id !== exceptId).map((t) => t.line_no));
  for (let line = 1; line <= 12; line++) {
    if (!used.has(line)) return line;
  }
  throw new Error(`${slotId(pallet, level)} is full`);
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
  const allowed = rack === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
  if (!isValidBay(letter) || !(allowed as readonly string[]).includes(letter)) {
    throw new Error("Pick a bay A through P");
  }
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) throw new Error("Pick a level");
  const line = await openLine(sql, rack, letter, level, row.id);
  const notice = await moveNotice(sql, userId, fromLabel, `Barn · ${slotId(letter, level)}`);
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
    return { place: `Barn · ${slotId(data.pallet.trim().toUpperCase(), level)}`, notice };
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
});

export const setAssetPlace = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof assetPlaceInput>) => assetPlaceInput.parse(d))
  .handler(async ({ data, context }): Promise<UnitPlace> => {
    const sql = await ready();
    const row = await byId(sql, data.id);
    if (!row) throw new Error("Unit not found");
    const rack = barnRack(data.site);
    if (rack) {
      if (!data.pallet?.trim()) throw new Error("Pick a bay A through P");
      const level = requireLevel(data.level);
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
    await parkAtLocation(sql, context.userId, row, data.site, null, data.otherLabel ?? null);
    return toPlace(await byId(sql, row.id));
  });
