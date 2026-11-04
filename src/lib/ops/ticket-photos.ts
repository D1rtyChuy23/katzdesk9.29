/**
 * Photos on installs, service and TLC tickets, and PMs (Chuy, 11/4; the rules and his answers are in
 * ticket-photo-rules.ts). An install's photos also show on its account's Photos tab; a ticket's or a PM's stay on it.
 * Anyone who can open the record adds photos; whoever added one, or an Admin, removes it. A sales rep sees a ticket's or
 * a PM's photos only on their own accounts, as with the ticket itself. The bodies are exported for the tests.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { canReviewNames, deskMiddleware, salesRepScope } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { accountRepFor, loadAccountMarks } from "@/lib/ops/reps";
import {
  PHOTO_FULL,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_NOT_JPEG,
  PHOTO_REMOVE_REFUSED,
  PHOTO_TOO_BIG,
  PHOTOS_PER_RECORD,
  THUMB_MAX_BYTES,
  accountZipName,
  canRemovePhoto,
  isJpeg,
  photoFileName,
  photoRequestAllowed,
  recordZipName,
  type PhotoKind,
  type PhotoRecordName,
} from "@/lib/ops/ticket-photo-rules";

export type TicketPhoto = {
  id: number;
  /** Its place on the record, oldest first, from 1: the number in its name. */
  n: number;
  /** Its file name, made from the record as it is now: "Test Cafe - install - WO-1234 (2).jpg". */
  name: string;
  width: number;
  height: number;
  bytes: number;
  addedByName: string | null;
  addedAt: string;
  /** The person asking added it, or is an Admin. */
  canRemove: boolean;
};

export type RecordPhotos = {
  kind: PhotoKind;
  id: number;
  /** Download all's file name. */
  zipName: string;
  /** Why photos can't be added here (the ticket was merged into another, or into an install), or null. */
  closed: string | null;
  photos: TicketPhoto[];
};

export type AccountPhotoGroup = {
  installId: number;
  wo: string | null;
  /** The install's date (installed, else received) as YYYY-MM-DD, or null. */
  date: string | null;
  status: string;
  equipment: string | null;
  zipName: string;
  photos: TicketPhoto[];
};

export type AccountPhotos = { customer: string; zipName: string; total: number; groups: AccountPhotoGroup[] };

/** The record as the photos read it. */
type PhotoRecord = PhotoRecordName & {
  id: number;
  /** The activity trail's entity type: install, pm, or the ticket's kind (service or tlc). */
  entityType: string;
  /** Archived (an install removed, or merged into another): not shown at all. */
  gone: boolean;
  closed: string | null;
};

const COLUMN: Record<PhotoKind, "install_id" | "job_id" | "pm_id"> = { install: "install_id", job: "job_id", pm: "pm_id" };

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function deskName(sql: Sql, userId: string): Promise<string> {
  const row = await sql.query<{ username: string | null }>("select username from desk_accounts where user_id = $1", [userId]);
  return row[0]?.username || "Teammate";
}

/** The record a photo is on, or null when there's no such record. */
export async function loadPhotoRecord(sql: Sql, kind: PhotoKind, id: number): Promise<PhotoRecord | null> {
  if (kind === "install") {
    const r = (
      await sql.query<{ id: number; customer: string; wo: string | null; archived: unknown }>(
        "select id, customer, wo, archived from installs where id = $1",
        [id],
      )
    )[0];
    if (!r) return null;
    return { kind, id: Number(r.id), customer: r.customer, wo: r.wo, fallback: `#${r.id}`, entityType: "install", gone: flagOn(r.archived), closed: null };
  }
  if (kind === "job") {
    const r = (
      await sql.query<{ id: number; kind: string; customer: string | null; wo: string | null; call_id: string | null; duplicate_of: number | null; merged_install_id: number | null }>(
        "select id, kind, customer, wo, call_id, duplicate_of, merged_install_id from service_jobs where id = $1",
        [id],
      )
    )[0];
    if (!r) return null;
    // Merged: its photos went with it, and new ones go where it went.
    const closed = r.merged_install_id
      ? `This ticket was merged into install #${r.merged_install_id}. Its photos are on that install.`
      : r.duplicate_of && Number(r.duplicate_of) !== Number(r.id)
        ? `This ticket was merged into #${r.duplicate_of}. Its photos are on that ticket.`
        : null;
    return {
      kind,
      id: Number(r.id),
      customer: r.customer,
      wo: r.wo,
      fallback: r.call_id?.trim() || `#${r.id}`,
      entityType: r.kind === "tlc" ? "tlc" : "service",
      gone: false,
      closed,
    };
  }
  const r = (await sql.query<{ id: number; customer: string; wo: string | null }>("select id, customer, wo from pm_jobs where id = $1", [id]))[0];
  if (!r) return null;
  return { kind, id: Number(r.id), customer: r.customer, wo: r.wo, fallback: `PM #${r.id}`, entityType: "pm", gone: false, closed: null };
}

/** Whether this person can see the record's photos: the record is on the desk, and a sales rep's own account for a ticket or a PM. */
async function canSee(sql: Sql, userId: string, rec: PhotoRecord): Promise<boolean> {
  if (rec.gone) return false;
  if (rec.kind === "install") return true;
  const scope = await salesRepScope(sql, userId);
  if (!scope) return true;
  return scope(accountRepFor(await loadAccountMarks(sql), rec.customer));
}

type PhotoRow = { id: number; width: number; height: number; bytes: number; added_by: string; added_by_name: string | null; added_at: string };

const PHOTO_COLUMNS = `id, width, height, bytes, added_by, added_by_name,
  to_char(added_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as added_at`;

function asPhoto(rec: PhotoRecordName, row: PhotoRow, n: number, viewer: { userId: string; admin: boolean }): TicketPhoto {
  return {
    id: Number(row.id),
    n,
    name: photoFileName(rec, n),
    width: Number(row.width),
    height: Number(row.height),
    bytes: Number(row.bytes),
    addedByName: row.added_by_name,
    addedAt: row.added_at,
    canRemove: canRemovePhoto(viewer, { addedBy: row.added_by }),
  };
}

async function viewerOf(sql: Sql, userId: string) {
  return { userId, admin: await canReviewNames(sql, userId) };
}

const recordInput = z.object({ kind: z.enum(["install", "job", "pm"]), id: z.number().int().positive() });

/** The record's photos, oldest first, or null when this person can't open the record. */
export async function listRecordPhotosFor(sql: Sql, userId: string, data: z.infer<typeof recordInput>): Promise<RecordPhotos | null> {
  const rec = await loadPhotoRecord(sql, data.kind, data.id);
  if (!rec || !(await canSee(sql, userId, rec))) return null;
  const rows = await sql.query<PhotoRow>(`select ${PHOTO_COLUMNS} from ticket_photos where ${COLUMN[rec.kind]} = $1 order by added_at, id`, [rec.id]);
  const viewer = await viewerOf(sql, userId);
  return { kind: rec.kind, id: rec.id, zipName: recordZipName(rec), closed: rec.closed, photos: rows.map((r, i) => asPhoto(rec, r, i + 1, viewer)) };
}

/** Base64 text, at most this many bytes once decoded. */
const base64Of = (maxBytes: number) => z.string().min(16).max(4 * Math.ceil(maxBytes / 3)).regex(/^[A-Za-z0-9+/]+=*$/);

const addInput = recordInput.extend({
  photo: base64Of(PHOTO_MAX_BYTES),
  thumb: base64Of(THUMB_MAX_BYTES),
  width: z.number().int().min(1).max(PHOTO_MAX_EDGE),
  height: z.number().int().min(1).max(PHOTO_MAX_EDGE),
});

/** Locks the record while the photo goes on it, and only while photos can be added (a merge waits, or this does). */
const LOCK: Record<PhotoKind, string> = {
  install: "select id from installs where id = $1 and archived = false for share",
  job: "select id from service_jobs where id = $1 and merged_install_id is null and duplicate_of is null for share",
  pm: "select id from pm_jobs where id = $1 for share",
};

/** Adds one photo (already shrunk by the browser) to the record, after its others. */
export async function addRecordPhotoFor(sql: Sql, userId: string, data: z.infer<typeof addInput>): Promise<TicketPhoto> {
  const rec = await loadPhotoRecord(sql, data.kind, data.id);
  if (!rec || !(await canSee(sql, userId, rec))) throw new Error("That record isn't on the desk anymore.");
  if (rec.closed) throw new Error(rec.closed);
  const photo = Buffer.from(data.photo, "base64");
  const thumb = Buffer.from(data.thumb, "base64");
  if (!isJpeg(photo) || !isJpeg(thumb)) throw new Error(PHOTO_NOT_JPEG);
  if (photo.length > PHOTO_MAX_BYTES || thumb.length > THUMB_MAX_BYTES) throw new Error(PHOTO_TOO_BIG);
  if (Math.max(data.width, data.height) > PHOTO_MAX_EDGE) throw new Error(PHOTO_TOO_BIG);
  const col = COLUMN[rec.kind];
  const rows = await sql.query<{ id: number }>(
    `with rec as (${LOCK[rec.kind]})
     insert into ticket_photos (${col}, mime, data, thumb, bytes, width, height, added_by, added_by_name)
     select rec.id, 'image/jpeg', decode($2, 'base64'), decode($3, 'base64'), $4, $5, $6, $7, $8
       from rec
      where (select count(*) from ticket_photos where ${col} = $1) < $9
     returning id`,
    [rec.id, data.photo, data.thumb, photo.length, data.width, data.height, userId, await deskName(sql, userId), PHOTOS_PER_RECORD],
  );
  if (!rows[0]) {
    const now = await loadPhotoRecord(sql, rec.kind, rec.id);
    if (!now || now.gone) throw new Error("That record isn't on the desk anymore.");
    if (now.closed) throw new Error(now.closed);
    throw new Error(PHOTO_FULL);
  }
  const listed = await listRecordPhotosFor(sql, userId, { kind: rec.kind, id: rec.id });
  const added = listed?.photos.find((p) => p.id === Number(rows[0]!.id));
  if (!added) throw new Error("The photo was added. Open the record again to see it.");
  return added;
}

const removeInput = z.object({ photoId: z.number().int().positive() });

/** Removes a photo: whoever added it, or an Admin. The record's activity names the photo and who added it. */
export async function removeRecordPhotoFor(sql: Sql, userId: string, data: z.infer<typeof removeInput>): Promise<{ removed: true }> {
  const row = (
    await sql.query<{ id: number; install_id: number | null; job_id: number | null; pm_id: number | null; added_by: string; added_by_name: string | null }>(
      "select id, install_id, job_id, pm_id, added_by, added_by_name from ticket_photos where id = $1",
      [data.photoId],
    )
  )[0];
  if (!row) throw new Error("That photo was removed already.");
  const kind: PhotoKind = row.install_id ? "install" : row.job_id ? "job" : "pm";
  const rec = await loadPhotoRecord(sql, kind, Number(row.install_id ?? row.job_id ?? row.pm_id));
  if (!rec || !(await canSee(sql, userId, rec))) throw new Error("That record isn't on the desk anymore.");
  if (!canRemovePhoto(await viewerOf(sql, userId), { addedBy: row.added_by })) throw new Error(PHOTO_REMOVE_REFUSED);
  // Its name as it reads now, for the activity line.
  const place = (
    await sql.query<{ n: number }>(
      `select count(*)::int as n from ticket_photos p, ticket_photos me
        where me.id = $1 and p.${COLUMN[kind]} = $2 and (p.added_at, p.id) <= (me.added_at, me.id)`,
      [row.id, rec.id],
    )
  )[0];
  const gone = await sql.query<{ id: number }>(`delete from ticket_photos where id = $1 and ${COLUMN[kind]} = $2 returning id`, [row.id, rec.id]);
  if (!gone[0]) throw new Error("That photo was moved or removed meanwhile. Open the record again.");
  await sql.query("insert into activity (entity_type, entity_id, actor_name, action, detail) values ($1, $2, $3, 'updated', $4)", [
    rec.entityType,
    rec.id,
    await deskName(sql, userId),
    `photo removed: ${photoFileName(rec, Number(place?.n) || 1)} (added by ${row.added_by_name?.trim() || "a teammate"})`,
  ]);
  return { removed: true };
}

const accountInput = z.object({ customerId: z.number().int().positive() });

/**
 * The account's install photos for its Photos tab, by install, newest install first: the same installs its history
 * lists (on the desk, under the account's name). A ticket's or a PM's photos stay on that ticket (Chuy, 11/4).
 */
export async function listAccountPhotosFor(sql: Sql, userId: string, data: z.infer<typeof accountInput>): Promise<AccountPhotos | null> {
  const account = (await sql.query<{ id: number; name: string }>("select id, name from directory_customers where id = $1 and archived = false", [data.customerId]))[0];
  if (!account) return null;
  const installs = await sql.query<{ id: number; customer: string; wo: string | null; day: string | null; complete: unknown; equip_status: string | null; equipment: string | null }>(
    `select id, customer, wo, to_char(coalesce(install_date, received), 'YYYY-MM-DD') as day, complete, equip_status, equipment
       from installs
      where archived = false and lower(customer) = lower($1)
      order by install_date desc nulls last, id desc`,
    [account.name],
  );
  const ids = installs.map((i) => Number(i.id));
  const photos = ids.length
    ? await sql.query<PhotoRow & { install_id: number }>(
        `select install_id, ${PHOTO_COLUMNS} from ticket_photos where install_id = any($1::int[]) order by added_at, id`,
        [ids],
      )
    : [];
  const viewer = await viewerOf(sql, userId);
  const groups: AccountPhotoGroup[] = [];
  for (const i of installs) {
    const rec: PhotoRecordName = { kind: "install", customer: i.customer, wo: i.wo, fallback: `#${i.id}` };
    const mine = photos.filter((p) => Number(p.install_id) === Number(i.id));
    if (!mine.length) continue;
    const installed = flagOn(i.complete) || i.equip_status === "Installed";
    groups.push({
      installId: Number(i.id),
      wo: i.wo?.trim() || null,
      date: i.day,
      status: installed ? "Installed" : i.equip_status || "Not Ready",
      equipment: i.equipment?.trim() || null,
      zipName: recordZipName(rec),
      photos: mine.map((p, n) => asPhoto(rec, p, n + 1, viewer)),
    });
  }
  return { customer: account.name, zipName: accountZipName(account.name), total: groups.reduce((n, g) => n + g.photos.length, 0), groups };
}

export const listRecordPhotos = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof recordInput>) => recordInput.parse(d))
  .handler(async ({ data, context }) => listRecordPhotosFor(await ready(), context.userId, data));

export const addRecordPhoto = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof addInput>) => addInput.parse(d))
  .handler(async ({ data, context }) => addRecordPhotoFor(await ready(), context.userId, data));

export const removeRecordPhoto = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof removeInput>) => removeInput.parse(d))
  .handler(async ({ data, context }) => removeRecordPhotoFor(await ready(), context.userId, data));

export const listAccountPhotos = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof accountInput>) => accountInput.parse(d))
  .handler(async ({ data, context }) => listAccountPhotosFor(await ready(), context.userId, data));

/** What the photo route needs: the signed-in person, and the database. */
export type PhotoRouteDeps = {
  session: (headers: Headers) => Promise<{ user?: { id?: string } } | null>;
  ready: () => Promise<Sql>;
};

function refuse(status: number, text: string): Response {
  return new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

/**
 * /api/ticket-photo/<id>: the photo for someone signed in and approved who can see its record. ?size=thumb sends the
 * preview; ?download=1 saves it under its name. A photo never changes, so the picture is kept in the browser's cache;
 * a download is fetched fresh, so it takes the record's name as it is now.
 */
export async function ticketPhotoResponse(request: Request, deps: PhotoRouteDeps, photoId: string): Promise<Response> {
  if (!photoRequestAllowed(request.headers, request.method)) return refuse(403, "Cross-site request refused.");
  if (!/^[1-9][0-9]{0,9}$/.test(photoId)) return refuse(404, "No such photo.");
  const session = await deps.session(request.headers).catch(() => null);
  const userId = session?.user?.id;
  if (!userId) return refuse(401, "Sign in first.");
  try {
    const sql = await deps.ready();
    const me = (await sql.query<{ approved: unknown }>("select approved from desk_accounts where user_id = $1", [userId]))[0];
    if (!flagOn(me?.approved)) return refuse(403, "This account is waiting for approval.");
    const url = new URL(request.url);
    const thumb = url.searchParams.get("size") === "thumb";
    const download = url.searchParams.get("download") === "1";
    const row = (
      await sql.query<{ id: number; install_id: number | null; job_id: number | null; pm_id: number | null; b64: string }>(
        `select id, install_id, job_id, pm_id, encode(${thumb ? "thumb" : "data"}, 'base64') as b64 from ticket_photos where id = $1`,
        [Number(photoId)],
      )
    )[0];
    if (!row) return refuse(404, "No such photo.");
    const kind: PhotoKind = row.install_id ? "install" : row.job_id ? "job" : "pm";
    const rec = await loadPhotoRecord(sql, kind, Number(row.install_id ?? row.job_id ?? row.pm_id));
    if (!rec || !(await canSee(sql, userId, rec))) return refuse(404, "No such photo.");
    const place = (
      await sql.query<{ n: number }>(
        `select count(*)::int as n from ticket_photos p, ticket_photos me
          where me.id = $1 and p.${COLUMN[kind]} = $2 and (p.added_at, p.id) <= (me.added_at, me.id)`,
        [row.id, rec.id],
      )
    )[0];
    const name = photoFileName(rec, Number(place?.n) || 1);
    const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "'");
    const bytes = Buffer.from(row.b64.replace(/\s/g, ""), "base64");
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": download ? "private, no-store" : "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("[ticket-photo]", e);
    return refuse(500, "Could not load the photo. Try again.");
  }
}
