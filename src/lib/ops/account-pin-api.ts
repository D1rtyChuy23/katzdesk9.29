/**
 * Account Details → Map pin: an admin (a desk admin or the Admin role) enters the exact latitude and longitude
 * (account-pin.ts). One statement saves the pin with its source and writes the activity line, so the log always
 * matches what was saved.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware, requireNameReviewer } from "@/lib/ops/access";
import { MANUAL_PIN_MATCH, MANUAL_PIN_SOURCE, parsePinInput, pinText } from "@/lib/ops/account-pin";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

export type SavedPin = { latitude: number; longitude: number; source: string };

export async function setAccountPinFor(sql: Sql, userId: string, data: { id: number; latitude: string; longitude: string }): Promise<SavedPin> {
  await requireNameReviewer(sql, userId, "Only an admin can change an account's map pin.");
  const parsed = parsePinInput(data.latitude, data.longitude);
  if (!parsed.ok) throw new Error(parsed.reason);
  const who = (await sql.query<{ username: string }>("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
  const rows = await sql.query<{ id: number; old_lat: number | null; old_lng: number | null }>(
    `with cur as (
       select id, latitude as old_lat, longitude as old_lng from directory_customers where id = $1 and archived = false for update
     ), upd as (
       update directory_customers d
          set latitude = $2, longitude = $3, geocode_match = $4, geocode_address = $5, geocoded_at = now(), updated_at = now()
         from cur where d.id = cur.id
       returning d.id
     ), log as (
       insert into activity (entity_type, entity_id, actor_name, action, detail)
       select 'customer', upd.id, $6, 'updated', $7 || coalesce(' (was ' || round(cur.old_lat::numeric, 6) || ', ' || round(cur.old_lng::numeric, 6) || ')', ' (no pin before)')
         from upd join cur on cur.id = upd.id
       returning entity_id
     )
     select cur.id, cur.old_lat, cur.old_lng from cur join upd on upd.id = cur.id`,
    [data.id, parsed.lat, parsed.lng, MANUAL_PIN_MATCH, MANUAL_PIN_SOURCE, who, `Map pin entered by hand: ${pinText(parsed.lat, parsed.lng)}`],
  );
  if (!rows[0]) throw new Error("That account isn't on the Customers list. Restore it first.");
  return { latitude: parsed.lat, longitude: parsed.lng, source: MANUAL_PIN_SOURCE };
}

const pinInput = z.object({ id: z.number().int().positive(), latitude: z.string().max(60), longitude: z.string().max(60) });

export const setAccountPin = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof pinInput>) => pinInput.parse(d))
  .handler(async ({ data, context }): Promise<SavedPin> => setAccountPinFor(await ready(), context.userId, data));
