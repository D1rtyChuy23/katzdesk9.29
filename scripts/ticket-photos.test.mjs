// Photos on installs, service and TLC tickets, and PMs (Chuy, 11/4): "Lets add a section for customers to store the
// install pictures in the install ticket that will carry under the customer profile. Also allow to store pictures for
// tickets. Anything outside of installs lives in the ticket only it pertains to." Asked, he picked service, TLC and PM
// tickets besides installs; photos shrunk to about 2,000 px; each photo downloadable plus Download all; a photo removed
// by whoever added it or an Admin. Names: "customer name - install - work order #", the others "customer name and work
// order number". All data is made up.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { crc32 as zlibCrc } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const P = await import("../src/lib/ops/ticket-photos.ts");
const R = await import("../src/lib/ops/ticket-photo-rules.ts");
const Z = await import("../src/lib/ops/zip-store.ts");
const { mergeServiceJobs } = await import("../src/lib/ops/wo-duplicates.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const M = await import("../src/lib/ops/ticket-install-merge.ts");
const { todayChicago, addDays } = await import("../src/lib/ops/clock.ts");
const { accountRepFor, accountRepOf, loadAccountMarks } = await import("../src/lib/ops/reps.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const CAFE = "Test Roastery - Midtown";
const OTHER = "Test Bakery - Uptown";
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function wrap(query) {
  return Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
}
async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role, email) values
       ('u-owner', 'boss', true, true, 'admin', null),
       ('u-admin', 'ana', true, false, 'admin', null),
       ('u-tech', 'tess', true, false, 'service', null),
       ('u-tech2', 'theo', true, false, 'service', null),
       ('u-rep', 'riley', true, false, 'sales', 'riley@example.com'),
       ('u-waiting', 'nora', false, false, 'service', null)`,
  );
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ('u-rep', 'Riley Rep', 'riley@example.com', true)`);
  await pg.query("insert into directory_customers (name, account_rep) values ($1, 'Riley Rep'), ($2, 'Someone Else')", [CAFE, OTHER]);
  const sql = wrap(async (text, params) => (await pg.query(text, params)).rows);
  return { pg, sql };
}
/** The same handle, with `action` run once right after the nth query (the first by default) whose text matches `when`. */
function racing(sql, when, action, nth = 1) {
  let seen = 0;
  return wrap(async (text, params) => {
    const rows = await sql.query(text, params);
    if (when.test(text) && ++seen === nth) await action();
    return rows;
  });
}
const one = async (pg, text, params) => (await pg.query(text, params)).rows[0];
const insertRow = async (pg, table, f) => {
  const cols = Object.keys(f);
  return Number((await one(pg, `insert into ${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(f))).id);
};
let n = 0;
const install = (pg, f = {}) => insertRow(pg, "installs", { received: addDays(todayChicago(), -4), customer: CAFE, equip_status: "Not Ready", wo: `WO-${7100 + ++n}`, ...f });
const job = (pg, f = {}) => insertRow(pg, "service_jobs", { kind: "service", call_id: `SC-202611-${String(++n).padStart(4, "0")}`, customer: CAFE, status: "Open", wo: `WO-${8800 + n}`, received: addDays(todayChicago(), -2), ...f });
const pm = (pg, f = {}) => insertRow(pg, "pm_jobs", { customer: CAFE, wo: `WO-${9900 + ++n}`, received: addDays(todayChicago(), -1), ...f });
/** A made-up JPEG: the FF D8 FF start the server checks, then filler. */
function jpeg(fill, size = 600) {
  const b = new Uint8Array(size).fill(fill);
  b.set([0xff, 0xd8, 0xff, 0xe0], 0);
  b.set([0xff, 0xd9], size - 2);
  return b;
}
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const add = (sql, userId, kind, id, fill = 7, f = {}) =>
  P.addRecordPhotoFor(sql, userId, { kind, id, photo: b64(jpeg(fill)), thumb: b64(jpeg(fill + 100, 120)), width: 2048, height: 1536, ...f });
const names = async (sql, kind, id, userId = "u-owner") => (await P.listRecordPhotosFor(sql, userId, { kind, id }))?.photos.map((p) => p.name) ?? null;
/** Photos in a fixed order: the nth oldest, so the numbering is certain. */
const dated = (pg, id, minutesAgo) => pg.query("update ticket_photos set added_at = now() - make_interval(mins => $2) where id = $1", [id, minutesAgo]);

test("names: the account, install and WO; the account and WO; what stands in for a missing WO", () => {
  const rec = (kind, f = {}) => ({ kind, customer: CAFE, wo: "WO-7101", fallback: "#45", ...f });
  assert.equal(R.photoFileName(rec("install"), 2), `${CAFE} - install - WO-7101 (2).jpg`);
  assert.equal(R.photoFileName(rec("job", { wo: "WO-8801" }), 1), `${CAFE} - WO-8801 (1).jpg`);
  assert.equal(R.photoFileName(rec("pm", { wo: " WO-9901 " }), 3), `${CAFE} - WO-9901 (3).jpg`);
  // No WO: the install's number, the ticket's call ID, or the PM's number in its place.
  assert.equal(R.photoFileName(rec("install", { wo: "  " }), 1), `${CAFE} - install - #45 (1).jpg`);
  assert.equal(R.photoFileName(rec("job", { wo: null, fallback: "SC-202611-0042" }), 1), `${CAFE} - SC-202611-0042 (1).jpg`);
  assert.equal(R.photoFileName(rec("pm", { wo: null, fallback: "PM #12" }), 1), `${CAFE} - PM #12 (1).jpg`);
  // A ticket with no account reads as the ticket window does.
  assert.equal(R.photoFileName(rec("job", { customer: null }), 1), "Untitled Account - WO-7101 (1).jpg");
  assert.equal(R.photoFileName(rec("job", { customer: " " }), 1), "Untitled Account - WO-7101 (1).jpg");
  // What a file name can't hold becomes a dash; tabs, line breaks and runs of spaces one space; no trailing dot.
  assert.equal(R.fileSafe('Test "Bean" / Bar: Co?'), "Test -Bean- - Bar- Co-");
  assert.equal(R.fileSafe("Test\tCafe\n  North..."), "Test Cafe North");
  assert.equal(R.fileSafe("Test\u0001Cafe\u007f North"), "Test Cafe North", "control characters");
  // Half an emoji (a lone surrogate) can't be in a name; a whole one can.
  assert.equal(R.fileSafe("Test \ud83d Cafe \u2615"), "Test Cafe \u2615");
  assert.equal(R.fileSafe("Test Cafe \ud83c\udf69"), "Test Cafe \ud83c\udf69");
  assert.equal(R.cutToBytes("abc\ud83c\udf69def", 5), "abc", "never half a character");
  assert.equal(R.cutToBytes("abc\ud83c\udf69def", 7), "abc\ud83c\udf69");
  assert.equal(R.cutToBytes("short", 120), "short");
  assert.equal(R.photoFileName(rec("install", { wo: "WO/77" }), 1), `${CAFE} - install - WO-77 (1).jpg`);
  // A long account name is cut, so the WO and the number stay.
  const long = R.photoFileName(rec("install", { customer: "Test Very Long Account Name ".repeat(6) }), 12);
  assert.match(long, / - install - WO-7101 \(12\)\.jpg$/);
  assert.ok(long.length < 200);
  // Cut at an emoji: the name is still well formed (the address can send it), and a name of many-byte letters stays
  // inside a file name's 255 bytes.
  const emoji = R.photoFileName(rec("install", { customer: `${"Test Cafe ".repeat(11)}\ud83c\udf69\ud83c\udf69` }), 1);
  assert.doesNotThrow(() => encodeURIComponent(emoji));
  const wide = R.photoFileName(rec("job", { customer: "\u6771\u4eac".repeat(80), wo: "WO-".padEnd(90, "9") }), 100);
  assert.ok(new TextEncoder().encode(wide).length <= 255, wide);
  assert.match(wide, / - WO-9{45} \(100\)\.jpg$/, "a long WO is cut to 48 bytes");
  assert.doesNotThrow(() => encodeURIComponent(wide));
  assert.equal(R.recordZipName(rec("install")), `${CAFE} - install - WO-7101.zip`);
  assert.equal(R.recordZipName(rec("job")), `${CAFE} - WO-7101.zip`);
  assert.equal(R.accountZipName(CAFE), `${CAFE} - install photos.zip`);
  assert.ok(new TextEncoder().encode(R.accountZipName("\u6771\u4eac".repeat(80))).length <= 255);
  // In one .zip each name once.
  assert.deepEqual(R.uniqueNames(["a.jpg", "A.jpg", "a.jpg", "b"]), ["a.jpg", "A [2].jpg", "a [3].jpg", "b"]);
  // Whoever added it, or an Admin.
  assert.equal(R.canRemovePhoto({ userId: "u-tech", admin: false }, { addedBy: "u-tech" }), true);
  assert.equal(R.canRemovePhoto({ userId: "u-tech2", admin: false }, { addedBy: "u-tech" }), false);
  assert.equal(R.canRemovePhoto({ userId: "u-admin", admin: true }, { addedBy: "u-tech" }), true);
  assert.equal(R.canRemovePhoto({ userId: "", admin: false }, { addedBy: "" }), false);
  // The shrink keeps the shape and never enlarges.
  assert.deepEqual(R.fitWithin(4032, 3024, 2048), { width: 2048, height: 1536 });
  assert.deepEqual(R.fitWithin(3024, 4032, 2048), { width: 1536, height: 2048 });
  assert.deepEqual(R.fitWithin(800, 600, 2048), { width: 800, height: 600 });
  assert.deepEqual(R.fitWithin(4032, 3024, 360), { width: 360, height: 270 });
  assert.equal(R.isJpeg(jpeg(1)), true);
  assert.equal(R.isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
  assert.equal(R.photoByline(null, "2026-11-04T12:34:00.000Z"), "Teammate · Nov 4, 2026");
  assert.equal(R.photoByline("tess", "2026-11-04T03:00:00.000Z"), "tess · Nov 3, 2026", "a Chicago date");
  // One request carries a photo and its preview, under the Library's 512 KB pieces the site's proxy lets through.
  assert.ok(R.PHOTO_MAX_BYTES + R.THUMB_MAX_BYTES <= 512 * 1024);
  assert.equal(R.PHOTO_MAX_EDGE, 2048);
  // Another site can't pull a photo in; the desk's pages and an address opened straight can.
  const h = (o) => ({ get: (k) => o[k] ?? null });
  assert.equal(R.photoRequestAllowed(h({}), "GET"), true);
  assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "same-origin", "sec-fetch-mode": "no-cors" }), "GET"), true);
  assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "none", "sec-fetch-mode": "navigate" }), "GET"), true);
  assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }), "GET"), true);
  assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors" }), "GET"), false);
  assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "same-site", "sec-fetch-mode": "cors" }), "GET"), false);
  // Another site's page showing it inside an <object> or <embed> is a navigation too, and refused.
  for (const dest of ["object", "embed"]) assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "same-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": dest }), "GET"), false, dest);
  assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }), "GET"), true);
  assert.equal(R.photoRequestAllowed(h({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }), "POST"), false);
});

/** Reads a stored .zip back: its entries as its central directory lists them, each checked against its local header. */
function readZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  const count = v.getUint16(end + 10, true);
  assert.equal(v.getUint16(end + 8, true), count);
  const dirSize = v.getUint32(end + 12, true);
  let at = v.getUint32(end + 16, true);
  assert.equal(at + dirSize, end, "the directory ends where the end record starts");
  const out = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i += 1) {
    assert.equal(v.getUint32(at, true), 0x02014b50);
    assert.equal(v.getUint16(at + 8, true), 0x0800, "UTF-8 names");
    assert.equal(v.getUint16(at + 10, true), 0, "stored");
    const crc = v.getUint32(at + 16, true);
    const size = v.getUint32(at + 20, true);
    assert.equal(v.getUint32(at + 24, true), size);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    assert.equal(v.getUint32(local, true), 0x04034b50);
    assert.equal(v.getUint32(local + 14, true), crc);
    assert.equal(v.getUint16(local + 26, true), nameLen);
    assert.equal(v.getUint16(local + 6, true), 0x0800, "UTF-8 names in the file's own header too");
    assert.equal(v.getUint16(local + 8, true), 0, "stored, in the file's own header");
    assert.deepEqual([v.getUint32(local + 18, true), v.getUint32(local + 22, true)], [size, size], "the sizes in the file's own header");
    assert.deepEqual([v.getUint16(local + 10, true), v.getUint16(local + 12, true)], [v.getUint16(at + 12, true), v.getUint16(at + 14, true)], "one date in both headers");
    assert.equal(dec.decode(bytes.subarray(local + 30, local + 30 + nameLen)), name);
    const data = bytes.subarray(local + 30 + nameLen, local + 30 + nameLen + size);
    assert.equal(zlibCrc(data), crc, "the checksum any unzip tool checks");
    out.push({ name, data: Buffer.from(data), time: v.getUint16(local + 10, true), date: v.getUint16(local + 12, true) });
    at += 46 + nameLen;
  }
  return out;
}

test("Download all's .zip: each photo stored as is under its name, with the checksums unzip checks", () => {
  const a = jpeg(3, 5000);
  const b = jpeg(4, 70_000);
  const zip = Z.zipStore([
    { name: "Test Café - install - WO-7101 (1).jpg", data: a, date: new Date(2026, 10, 4, 6, 34, 10) },
    { name: "Test Café - install - WO-7101 (2).jpg", data: b, date: new Date(2026, 10, 4, 6, 35, 0) },
  ]);
  const back = readZip(zip);
  assert.deepEqual(back.map((e) => e.name), ["Test Café - install - WO-7101 (1).jpg", "Test Café - install - WO-7101 (2).jpg"]);
  assert.ok(back[0].data.equals(Buffer.from(a)) && back[1].data.equals(Buffer.from(b)));
  assert.deepEqual([back[0].time, back[0].date], [(6 << 11) | (34 << 5) | 5, ((2026 - 1980) << 9) | (11 << 5) | 4]);
  // Each name is written twice per file: in its own header and in the directory.
  assert.equal(zip.length, 22 + 2 * (30 + 46) + 4 * new TextEncoder().encode(back[0].name).length + a.length + b.length);
  assert.equal(Z.crc32(a), zlibCrc(a));
  assert.equal(Z.crc32(new Uint8Array()), 0);
  // A date before 1980 (a .zip can't hold one) is stored as Jan 1, 1980.
  assert.deepEqual(Z.dosDateTime(new Date(1975, 5, 1)), { time: 0, date: (1 << 5) | 1 });
  assert.deepEqual(readZip(Z.zipStore([])), []);
  assert.throws(() => Z.zipStore(Array.from({ length: Z.ZIP_MAX_ENTRIES + 1 }, () => ({ name: "x", data: new Uint8Array() }))), /Too many files/);
});

test("an install's photos: added, listed and named in order; removing one renumbers the rest; whoever added it or an Admin removes it", async () => {
  const { pg, sql } = await fresh();
  try {
    const i = await install(pg, { wo: "WO-7101" });
    const first = await add(sql, "u-tech", "install", i, 1);
    const second = await add(sql, "u-tech", "install", i, 2);
    assert.deepEqual([first.n, first.name, first.canRemove, first.addedByName], [1, `${CAFE} - install - WO-7101 (1).jpg`, true, "tess"]);
    assert.equal(second.name, `${CAFE} - install - WO-7101 (2).jpg`);
    // (Postgres breaks its base64 into lines.)
    const stored = await one(pg, "select replace(encode(data, 'base64'), E'\\n', '') as data, replace(encode(thumb, 'base64'), E'\\n', '') as thumb, bytes, width, height, added_by, mime from ticket_photos where id = $1", [first.id]);
    assert.deepEqual(stored, { data: b64(jpeg(1)), thumb: b64(jpeg(101, 120)), bytes: 600, width: 2048, height: 1536, added_by: "u-tech", mime: "image/jpeg" });
    const listed = await P.listRecordPhotosFor(sql, "u-tech2", { kind: "install", id: i });
    assert.deepEqual(listed.photos.map((p) => [p.name, p.canRemove]), [[first.name, false], [second.name, false]], "theo can't remove tess's");
    assert.equal(listed.zipName, `${CAFE} - install - WO-7101.zip`);
    assert.equal(listed.closed, null);
    for (const admin of ["u-admin", "u-owner"]) assert.equal((await P.listRecordPhotosFor(sql, admin, { kind: "install", id: i })).photos[0].canRemove, true);
    await assert.rejects(P.removeRecordPhotoFor(sql, "u-tech2", { photoId: first.id }), { message: R.PHOTO_REMOVE_REFUSED });
    // tess removes her first: the second is (1) now, and the install's activity names what was removed.
    await P.removeRecordPhotoFor(sql, "u-tech", { photoId: first.id });
    assert.deepEqual(await names(sql, "install", i), [`${CAFE} - install - WO-7101 (1).jpg`]);
    const act = await one(pg, "select entity_type, entity_id, actor_name, detail from activity where entity_type = 'install' order by id desc limit 1");
    assert.deepEqual(act, { entity_type: "install", entity_id: i, actor_name: "tess", detail: `photo removed: ${CAFE} - install - WO-7101 (1).jpg (added by tess)` });
    await assert.rejects(P.removeRecordPhotoFor(sql, "u-tech", { photoId: first.id }), { message: "That photo was removed already." });
    // A photo in the middle is named by its place when it's removed.
    const mid = await add(sql, "u-tech", "install", i, 4);
    const last = await add(sql, "u-tech", "install", i, 5);
    await P.removeRecordPhotoFor(sql, "u-owner", { photoId: mid.id });
    assert.equal((await one(pg, "select detail from activity where entity_type = 'install' order by id desc limit 1")).detail, `photo removed: ${CAFE} - install - WO-7101 (2).jpg (added by tess)`);
    await P.removeRecordPhotoFor(sql, "u-tech", { photoId: last.id });
    // An Admin removes anyone's.
    await P.removeRecordPhotoFor(sql, "u-admin", { photoId: second.id });
    assert.deepEqual(await names(sql, "install", i), []);
    // The name follows the account and the WO as they are now.
    const third = await add(sql, "u-tech", "install", i, 3);
    await pg.query("update installs set customer = 'Test Roastery - Midtown Annex', wo = 'WO-7199' where id = $1", [i]);
    assert.deepEqual(await names(sql, "install", i), ["Test Roastery - Midtown Annex - install - WO-7199 (1).jpg"]);
    assert.equal(third.n, 1);
  } finally {
    await pg.close();
  }
});

test("what isn't stored: not a JPEG, too big, too many on one record; and a record that's gone", async () => {
  const { pg, sql } = await fresh();
  try {
    const i = await install(pg);
    const png = b64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]));
    await assert.rejects(add(sql, "u-tech", "install", i, 1, { photo: png }), { message: R.PHOTO_NOT_JPEG });
    await assert.rejects(add(sql, "u-tech", "install", i, 1, { thumb: png }), { message: R.PHOTO_NOT_JPEG });
    await assert.rejects(add(sql, "u-tech", "install", i, 1, { photo: b64(jpeg(1, R.PHOTO_MAX_BYTES + 1)) }), { message: R.PHOTO_TOO_BIG });
    await assert.rejects(add(sql, "u-tech", "install", i, 1, { thumb: b64(jpeg(1, R.THUMB_MAX_BYTES + 1)) }), { message: R.PHOTO_TOO_BIG });
    await assert.rejects(add(sql, "u-tech", "install", i, 1, { width: 2049 }), { message: R.PHOTO_TOO_BIG });
    // At the most a record holds, the next is refused.
    await add(sql, "u-tech", "install", i, 1, { photo: b64(jpeg(1, R.PHOTO_MAX_BYTES)), thumb: b64(jpeg(1, R.THUMB_MAX_BYTES)) });
    await pg.query(
      `insert into ticket_photos (install_id, data, thumb, bytes, width, height, added_by)
       select $1, decode($2, 'base64'), decode($2, 'base64'), 600, 10, 10, 'u-tech' from generate_series(1, $3::int)`,
      [i, b64(jpeg(9)), R.PHOTOS_PER_RECORD - 1],
    );
    await assert.rejects(add(sql, "u-tech", "install", i, 2), { message: R.PHOTO_FULL });
    assert.equal((await one(pg, "select count(*)::int as c from ticket_photos where install_id = $1", [i])).c, R.PHOTOS_PER_RECORD);
    // An install removed from the board: nothing to list or add to.
    const gone = await install(pg, { archived: true });
    assert.equal(await P.listRecordPhotosFor(sql, "u-owner", { kind: "install", id: gone }), null);
    await assert.rejects(add(sql, "u-tech", "install", gone), { message: "That record isn't on the desk anymore." });
    assert.equal(await P.listRecordPhotosFor(sql, "u-owner", { kind: "pm", id: 999999 }), null);
    // Archived while the photo was on its way: the statement that stores it checks again, and nothing is stored.
    const racer = await install(pg);
    const archivedMeanwhile = racing(sql, /^select username from desk_accounts/, () => pg.query("update installs set archived = true where id = $1", [racer]));
    await assert.rejects(add(archivedMeanwhile, "u-tech", "install", racer), { message: "That record isn't on the desk anymore." });
    assert.equal((await one(pg, "select count(*)::int as c from ticket_photos where install_id = $1", [racer])).c, 0);
  } finally {
    await pg.close();
  }
});

test("a ticket's and a PM's photos stay on them; a sales rep sees those on their own accounts only; the account's Photos tab has its installs' photos", async () => {
  const { pg, sql } = await fresh();
  try {
    const j = await job(pg, { wo: "WO-8801" });
    const t = await job(pg, { kind: "tlc", customer: OTHER, wo: null, call_id: "SC-202611-0777" });
    const p = await pm(pg, { wo: "WO-9901" });
    const p2 = await pm(pg, { customer: OTHER, wo: null });
    const old = await install(pg, { wo: "WO-7001", install_date: addDays(todayChicago(), -40) });
    const recent = await install(pg, { wo: "WO-7002", install_date: addDays(todayChicago(), -2) });
    const empty = await install(pg, { wo: "WO-7003" });
    const removed = await install(pg, { wo: "WO-7004" });
    const elsewhere = await install(pg, { customer: OTHER, wo: "WO-7005" });
    assert.equal((await add(sql, "u-tech", "job", j)).name, `${CAFE} - WO-8801 (1).jpg`);
    assert.equal((await add(sql, "u-tech", "job", t)).name, `${OTHER} - SC-202611-0777 (1).jpg`);
    assert.equal((await add(sql, "u-tech", "pm", p)).name, `${CAFE} - WO-9901 (1).jpg`);
    assert.equal((await add(sql, "u-tech", "pm", p2)).name, `${OTHER} - PM #${p2} (1).jpg`);
    const o1 = await add(sql, "u-tech", "install", old);
    const r1 = await add(sql, "u-tech", "install", recent);
    const r2 = await add(sql, "u-tech", "install", recent);
    await add(sql, "u-tech", "install", removed);
    await pg.query("update installs set archived = true where id = $1", [removed]);
    await add(sql, "u-tech", "install", elsewhere);
    // Riley sees her account's ticket and PM, not another rep's; installs aren't split by rep.
    assert.deepEqual(await names(sql, "job", j, "u-rep"), [`${CAFE} - WO-8801 (1).jpg`]);
    assert.deepEqual(await names(sql, "pm", p, "u-rep"), [`${CAFE} - WO-9901 (1).jpg`]);
    assert.equal(await names(sql, "job", t, "u-rep"), null);
    assert.equal(await names(sql, "pm", p2, "u-rep"), null);
    await assert.rejects(add(sql, "u-rep", "pm", p2), { message: "That record isn't on the desk anymore." });
    assert.deepEqual(await names(sql, "install", elsewhere, "u-rep"), [`${OTHER} - install - WO-7005 (1).jpg`]);
    await assert.rejects(P.removeRecordPhotoFor(sql, "u-rep", { photoId: (await P.listRecordPhotosFor(sql, "u-owner", { kind: "pm", id: p2 })).photos[0].id }), {
      message: "That record isn't on the desk anymore.",
    });
    // The account's tab: only its installs' photos, by install, newest install first; none from a ticket or a PM.
    const cafeId = Number((await one(pg, "select id from directory_customers where name = $1", [CAFE])).id);
    const tab = await P.listAccountPhotosFor(sql, "u-tech", { customerId: cafeId });
    assert.equal(tab.customer, CAFE);
    assert.equal(tab.zipName, `${CAFE} - install photos.zip`);
    assert.equal(tab.total, 3);
    assert.deepEqual(
      tab.groups.map((g) => [g.installId, g.wo, g.date, g.status, g.zipName, g.photos.map((x) => [x.id, x.name])]),
      [
        [recent, "WO-7002", addDays(todayChicago(), -2), "Not Ready", `${CAFE} - install - WO-7002.zip`, [[r1.id, `${CAFE} - install - WO-7002 (1).jpg`], [r2.id, `${CAFE} - install - WO-7002 (2).jpg`]]],
        [old, "WO-7001", addDays(todayChicago(), -40), "Not Ready", `${CAFE} - install - WO-7001.zip`, [[o1.id, `${CAFE} - install - WO-7001 (1).jpg`]]],
      ],
    );
    assert.ok(!tab.groups.some((g) => g.installId === empty || g.installId === removed));
    // A finished install says so.
    await pg.query("update installs set complete = true where id = $1", [old]);
    assert.equal((await P.listAccountPhotosFor(sql, "u-tech", { customerId: cafeId })).groups[1].status, "Installed");
    assert.equal(await P.listAccountPhotosFor(sql, "u-tech", { customerId: 999999 }), null);
  } finally {
    await pg.close();
  }
});

test("merges: a ticket merged into another, or into an install, takes no more photos, and its photos go where it went; an install merged into another too", async () => {
  const { pg, sql } = await fresh();
  try {
    // Ticket into ticket: the extra's photos are the keeper's, in the order they were taken.
    const keeper = await job(pg, { wo: "WO-8801" });
    const extra = await job(pg, { wo: "WO-8801" });
    const k1 = await add(sql, "u-tech", "job", keeper, 1);
    const e1 = await add(sql, "u-tech", "job", extra, 2);
    const e2 = await add(sql, "u-tech", "job", extra, 3);
    await dated(pg, e1.id, 30);
    await dated(pg, k1.id, 20);
    await dated(pg, e2.id, 10);
    const outcome = await mergeServiceJobs(sql, keeper, extra, "boss");
    assert.deepEqual(outcome, { keeperId: keeper, extraId: extra });
    const kept = await P.listRecordPhotosFor(sql, "u-tech", { kind: "job", id: keeper });
    assert.deepEqual(kept.photos.map((x) => [x.id, x.name]), [
      [e1.id, `${CAFE} - WO-8801 (1).jpg`],
      [k1.id, `${CAFE} - WO-8801 (2).jpg`],
      [e2.id, `${CAFE} - WO-8801 (3).jpg`],
    ]);
    assert.match((await one(pg, "select detail from activity where entity_id = $1 and action = 'merged'", [keeper])).detail, / · 2 photos$/);
    const merged = await P.listRecordPhotosFor(sql, "u-tech", { kind: "job", id: extra });
    assert.deepEqual([merged.photos, merged.closed], [[], `This ticket was merged into #${keeper}. Its photos are on that ticket.`]);
    await assert.rejects(add(sql, "u-tech", "job", extra), { message: merged.closed });

    // Ticket into install: its photos are the install's, named as install photos, on the account's tab too.
    const target = await install(pg, { wo: "WO-4792", equip_status: "Installed", complete: true, completed_at: addDays(todayChicago(), -3) });
    const t = await job(pg, { wo: "WO-4792" });
    const t1 = await add(sql, "u-tech", "job", t, 4);
    const i1 = await add(sql, "u-tech", "install", target, 5);
    await dated(pg, i1.id, 5);
    const preview = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: t, installId: target });
    assert.equal(preview.refusal, null);
    assert.equal(preview.moves.photos, 1);
    const r = await M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId: t, installId: target, stamps: preview.stamps });
    assert.equal(r.photos, 1);
    assert.deepEqual(await names(sql, "install", target), [`${CAFE} - install - WO-4792 (1).jpg`, `${CAFE} - install - WO-4792 (2).jpg`]);
    assert.equal((await P.listRecordPhotosFor(sql, "u-tech", { kind: "install", id: target })).photos[1].id, t1.id);
    const log = await one(pg, "select moved from ticket_install_merges where job_id = $1", [t]);
    assert.deepEqual(log.moved.photos, [t1.id]);
    assert.match((await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1 and action = 'merged'", [target])).detail, /1 photo/);
    const away = await P.listRecordPhotosFor(sql, "u-tech", { kind: "job", id: t });
    assert.equal(away.closed, `This ticket was merged into install #${target}. Its photos are on that install.`);
    await assert.rejects(add(sql, "u-tech", "job", t), { message: away.closed });
    const cafeId = Number((await one(pg, "select id from directory_customers where name = $1", [CAFE])).id);
    assert.ok((await P.listAccountPhotosFor(sql, "u-tech", { customerId: cafeId })).groups.find((g) => g.installId === target).photos.some((x) => x.id === t1.id));

    // Install into install: the drop's photos are the keeper's, named by the keeper's WO.
    const keep = await install(pg, { wo: "WO-7301" });
    const drop = await install(pg, { wo: "WO-7302" });
    const d1 = await add(sql, "u-tech", "install", drop, 6);
    const res = await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.equal(res.photos, 1);
    assert.deepEqual(await names(sql, "install", keep), [`${CAFE} - install - WO-7301 (1).jpg`]);
    assert.equal((await P.listRecordPhotosFor(sql, "u-tech", { kind: "install", id: keep })).photos[0].id, d1.id);
    assert.equal(await P.listRecordPhotosFor(sql, "u-tech", { kind: "install", id: drop }), null);
    assert.match((await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1 and action = 'merged'", [keep])).detail, / · 1 photo/);
  } finally {
    await pg.close();
  }
});

test("a photo stored just before a merge locked its record still goes where the record went; one on its way after waits and is refused", async () => {
  const { pg, sql } = await fresh();
  try {
    const late = (column, id) =>
      pg.query(`insert into ticket_photos (${column}, data, thumb, bytes, width, height, added_by) values ($1, decode($2, 'base64'), decode($2, 'base64'), 600, 10, 10, 'u-tech')`, [id, b64(jpeg(8))]);
    // Ticket into ticket: one the merge's statement didn't see.
    const keeper = await job(pg, { wo: "WO-8811" });
    const extra = await job(pg, { wo: "WO-8811" });
    const seenLate = racing(sql, /'Merged #' \|\| g\.extra_id/, () => late("job_id", extra));
    await mergeServiceJobs(seenLate, keeper, extra, "boss");
    assert.equal((await one(pg, "select count(*)::int as c from ticket_photos where job_id = $1", [extra])).c, 0);
    assert.equal((await names(sql, "job", keeper)).length, 1);
    assert.equal((await one(pg, "select detail from activity where entity_id = $1 and action = 'merged' order by id desc limit 1", [keeper])).detail, `1 photo added to #${extra} during the merge moved here too`);
    // Install into install.
    const keep = await install(pg);
    const drop = await install(pg);
    const lateDrop = racing(sql, /update installs d set archived = true, duplicate_of = g\.keep_id/, () => late("install_id", drop));
    assert.equal((await mergeInstallsFor(lateDrop, "u-owner", { keepId: keep, dropId: drop })).photos, 1);
    assert.equal((await names(sql, "install", keep)).length, 1);
    assert.equal((await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1 and action = 'merged' order by id desc limit 1", [keep])).detail, `1 photo added to install #${drop} during the merge moved here too`);
    // Ticket into install.
    const target = await install(pg, { wo: "WO-4793", equip_status: "Installed", complete: true, completed_at: addDays(todayChicago(), -3) });
    const t = await job(pg, { wo: "WO-4793" });
    const preview = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: t, installId: target });
    const lateTicket = racing(sql, /insert into ticket_install_merges/, () => late("job_id", t));
    assert.equal((await M.mergeTicketIntoInstallFor(lateTicket, "u-owner", { jobId: t, installId: target, stamps: preview.stamps })).photos, 1);
    assert.equal((await one(pg, "select count(*)::int as c from ticket_photos where job_id = $1", [t])).c, 0);
    assert.equal((await names(sql, "install", target)).length, 1);
    const lateId = (await P.listRecordPhotosFor(sql, "u-owner", { kind: "install", id: target })).photos[0].id;
    assert.deepEqual((await one(pg, "select moved from ticket_install_merges where job_id = $1", [t])).moved.photos, [lateId], "the merge's record names it");
    assert.equal((await one(pg, "select detail from activity where entity_type = 'install' and entity_id = $1 and action = 'merged' order by id desc limit 1", [target])).detail, "1 photo added to the ticket during the merge moved here too");
    // Merged while a photo was on its way: the statement that stores it checks again, and it's refused with where to go.
    const k2 = await job(pg, { wo: "WO-8812" });
    const e2 = await job(pg, { wo: "WO-8812" });
    const mergedMeanwhile = racing(sql, /^select username from desk_accounts/, () => mergeServiceJobs(sql, k2, e2, "boss"));
    await assert.rejects(add(mergedMeanwhile, "u-tech", "job", e2), { message: `This ticket was merged into #${k2}. Its photos are on that ticket.` });
    assert.equal((await one(pg, "select count(*)::int as c from ticket_photos where job_id in ($1, $2)", [k2, e2])).c, 0);
    // The statements lock the record they add to, so a merge waits on them, or they on it (real Postgres; pinned here).
    const server = src("src/lib/ops/ticket-photos.ts");
    assert.match(server, /install: "select id from installs where id = \$1 and archived = false for share"/);
    assert.match(server, /job: "select id from service_jobs where id = \$1 and merged_install_id is null and duplicate_of is null for share"/);
    assert.match(server, /pm: "select id from pm_jobs where id = \$1 for share"/);
    assert.match(server, /with rec as \(\$\{LOCK\[rec\.kind\]\}\)/);
  } finally {
    await pg.close();
  }
});

test("the photo's address: signed in, approved and able to see its record; the photo, its preview, or a download under its name", async () => {
  const { pg, sql } = await fresh();
  try {
    const i = await install(pg, { customer: "Test Café - Midtown", wo: "WO-7101" });
    const photo = await add(sql, "u-tech", "install", i, 11);
    const other = await pm(pg, { customer: OTHER });
    const otherPhoto = await add(sql, "u-tech", "pm", other, 12);
    const mine = await pm(pg, { wo: "WO-9902" });
    const minePhoto = await add(sql, "u-tech", "pm", mine, 13);
    let asked = 0;
    const deps = (userId) => ({
      session: async () => {
        asked += 1;
        return userId ? { user: { id: userId } } : null;
      },
      ready: async () => sql,
    });
    const get = (id, query = "", headers = {}) => [new Request(`http://localhost/api/ticket-photo/${id}${query}`, { headers }), String(id)];
    const call = (args, d) => P.ticketPhotoResponse(args[0], d, args[1]);
    const text = async (res) => [res.status, await res.text()];

    assert.deepEqual(await text(await call(get(photo.id, "", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors" }), deps("u-owner"))), [403, "Cross-site request refused."]);
    assert.equal(asked, 0, "refused before the sign-in is read");
    assert.deepEqual(await text(await call(get(photo.id), deps(null))), [401, "Sign in first."]);
    assert.equal((await call(get(photo.id), { ...deps("u-owner"), session: async () => { throw new Error("bad cookie"); } })).status, 401);
    assert.deepEqual(await text(await call(get(photo.id), deps("u-waiting"))), [403, "This account is waiting for approval."]);
    for (const bad of ["abc", "0", "01", "12345678901", "2147483648", "9999999999"]) assert.equal((await call(get(bad), deps("u-owner"))).status, 404, bad);
    assert.equal((await call(get(999999), deps("u-owner"))).status, 404);
    // A sales rep: a PM on another rep's account isn't there; one on hers is.
    assert.equal((await call(get(otherPhoto.id), deps("u-rep"))).status, 404);
    assert.equal((await call(get(minePhoto.id), deps("u-rep"))).status, 200);

    const ok = await call(get(photo.id, "", { "sec-fetch-site": "same-origin", "sec-fetch-mode": "no-cors" }), deps("u-tech2"));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "image/jpeg");
    assert.equal(ok.headers.get("cache-control"), "private, max-age=3600");
    assert.equal(ok.headers.get("vary"), null, "the sign-in's cookie is reissued every few minutes: varying on it would refetch every photo");
    assert.equal(ok.headers.get("cross-origin-resource-policy"), "same-origin");
    assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
    assert.equal(ok.headers.get("content-length"), "600");
    const name = "Test Café - Midtown - install - WO-7101 (1).jpg";
    assert.equal(ok.headers.get("content-disposition"), `inline; filename="Test Caf_ - Midtown - install - WO-7101 (1).jpg"; filename*=UTF-8''${encodeURIComponent(name)}`);
    assert.ok(Buffer.from(await ok.arrayBuffer()).equals(Buffer.from(jpeg(11))));
    const thumb = await call(get(photo.id, "?size=thumb"), deps("u-tech2"));
    assert.ok(Buffer.from(await thumb.arrayBuffer()).equals(Buffer.from(jpeg(111, 120))));
    const dl = await call(get(photo.id, "?download=1", { "sec-fetch-site": "none", "sec-fetch-mode": "navigate" }), deps("u-tech2"));
    assert.match(dl.headers.get("content-disposition"), /^attachment; filename="Test Caf_ - Midtown - install - WO-7101 \(1\)\.jpg"/);
    assert.equal(dl.headers.get("cache-control"), "private, no-store");
    // Opened from a link on another site (a navigation), it still opens for someone signed in.
    assert.equal((await call(get(photo.id, "", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }), deps("u-tech2"))).status, 200);
    // An install taken off the board: its photos aren't served.
    await pg.query("update installs set archived = true where id = $1", [i]);
    assert.equal((await call(get(photo.id), deps("u-owner"))).status, 404);
    // A failure: a sentence, not half a picture.
    const logged = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await text(await call(get(minePhoto.id), { ...deps("u-owner"), ready: async () => { throw new Error("database asleep"); } })), [500, "Could not load the photo. Try again."]);
    } finally {
      console.error = logged;
    }
  } finally {
    await pg.close();
  }
});

test("the shrink's steps, what stops an upload, and Download all's pieces", () => {
  const steps = R.shrinkSteps(2048);
  assert.deepEqual(steps.slice(0, 6), [
    { edge: 2048, quality: 0.82 }, { edge: 2048, quality: 0.74 }, { edge: 2048, quality: 0.66 }, { edge: 2048, quality: 0.58 }, { edge: 2048, quality: 0.5 }, { edge: 1638, quality: 0.82 },
  ]);
  assert.deepEqual([...new Set(steps.map((s) => s.edge))], [2048, 1638, 1310, 1048]);
  assert.equal(steps.length, 20);
  // What holds for every photo after it stops the rest; one photo's trouble doesn't.
  for (const m of [R.PHOTO_FULL, R.PHOTO_GONE, "This ticket was merged into #12. Its photos are on that ticket.", "This ticket was merged into install #4. Its photos are on that install."]) assert.equal(R.stopsUploads(m), true, m);
  for (const m of [R.PHOTO_TOO_BIG, R.PHOTO_NOT_JPEG, R.PHOTO_NO_MEMORY, R.PHOTO_ADDED_ELSEWHERE, "Failed to fetch"]) assert.equal(R.stopsUploads(m), false, m);
  assert.equal(R.MAX_ID, 2 ** 31 - 1);
  // The pieces are each file's header, the file itself (the same bytes, not a copy), and the directory.
  const a = jpeg(1, 900);
  const b = jpeg(2, 1200);
  const parts = Z.zipParts([{ name: "a.jpg", data: a }, { name: "b.jpg", data: b }]);
  assert.equal(parts.length, 5);
  assert.equal(parts[1], a);
  assert.equal(parts[3], b);
  const fixed = new Date(2026, 10, 4, 8, 0, 0);
  assert.ok(Buffer.concat(Z.zipParts([{ name: "a.jpg", data: a, date: fixed }])).equals(Buffer.from(Z.zipStore([{ name: "a.jpg", data: a, date: fixed }]))));
});

test("a TLC's removals log on the TLC; a rep removes her own photo; a ticket with no account isn't a rep's; a photo moved meanwhile isn't removed", async () => {
  const { pg, sql } = await fresh();
  try {
    const tlc = await job(pg, { kind: "tlc", wo: "WO-8899" });
    const p = await add(sql, "u-tech", "job", tlc);
    await P.removeRecordPhotoFor(sql, "u-tech", { photoId: p.id });
    assert.deepEqual(await one(pg, "select entity_type, entity_id from activity order by id desc limit 1"), { entity_type: "tlc", entity_id: tlc });
    // Riley's own photo on her account's PM: she removes it.
    const mine = await pm(pg, { wo: "WO-9909" });
    const hers = await add(sql, "u-rep", "pm", mine);
    assert.equal(hers.canRemove, true);
    await P.removeRecordPhotoFor(sql, "u-rep", { photoId: hers.id });
    assert.deepEqual(await names(sql, "pm", mine), []);
    // A ticket with no account isn't on her accounts, as the ticket itself isn't.
    const blank = await job(pg, { customer: null, wo: "WO-8898" });
    await add(sql, "u-tech", "job", blank);
    assert.equal(await names(sql, "job", blank, "u-rep"), null);
    assert.deepEqual(await names(sql, "job", blank, "u-tech"), ["Untitled Account - WO-8898 (1).jpg"]);
    // Merged into another ticket between Remove's read and its delete: the photo is the keeper's now, and stays.
    const keeper = await job(pg, { wo: "WO-8897" });
    const extra = await job(pg, { wo: "WO-8897" });
    const moving = await add(sql, "u-tech", "job", extra);
    const mergedMeanwhile = racing(sql, /select count\(\*\)::int as n from ticket_photos p, ticket_photos me/, () => mergeServiceJobs(sql, keeper, extra, "boss"));
    await assert.rejects(P.removeRecordPhotoFor(mergedMeanwhile, "u-tech", { photoId: moving.id }), { message: "That photo was moved or removed meanwhile. Open the record again." });
    assert.deepEqual((await P.listRecordPhotosFor(sql, "u-tech", { kind: "job", id: keeper })).photos.map((x) => x.id), [moving.id]);
    // After a merge and a removal the names are in order again.
    const k2 = await add(sql, "u-tech", "job", keeper);
    const k3 = await add(sql, "u-tech", "job", keeper);
    await P.removeRecordPhotoFor(sql, "u-tech", { photoId: k2.id });
    assert.deepEqual((await P.listRecordPhotosFor(sql, "u-tech", { kind: "job", id: keeper })).photos.map((x) => [x.id, x.n]), [[moving.id, 1], [k3.id, 2]]);
  } finally {
    await pg.close();
  }
});

test("a photo's rep check reads the account's rep as the ticket list does, without the table setup", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query("insert into directory_customers (name, account_rep) values ('Test Coco''s - Kingwood', 'Riley Rep'), ('Test Blank Rep', '')");
    // Two accounts whose names differ only in punctuation, with different reps: each exact name finds its own rep, and
    // a third spelling finds the first one listed, as the ticket list does.
    await pg.query("insert into directory_customers (name, account_rep) values ('Test Twin Cafe', 'First Rep'), ('Test Twin, Cafe', 'Second Rep')");
    // A removed account's rep doesn't count, as in the ticket list.
    await pg.query("insert into directory_customers (name, account_rep, archived) values ('Test Gone Cafe', 'Riley Rep', true)");
    const seen = [];
    const watched = wrap(async (text, params) => {
      seen.push(text);
      return sql.query(text, params);
    });
    const marks = await loadAccountMarks(sql);
    for (const name of [CAFE, ` ${CAFE.toUpperCase()} `, "Test Cocos Kingwood", "Test Blank Rep", "Test Gone Cafe", "Test Twin Cafe", "Test Twin, Cafe", "Test Twin - Cafe", OTHER, "Nobody Here", null]) {
      assert.equal(await accountRepOf(watched, name), accountRepFor(marks, name), String(name));
    }
    assert.ok(!seen.some((q) => /alter table/i.test(q)), "no ALTER TABLE on every photo");
    assert.deepEqual([await accountRepOf(sql, "Test Twin Cafe"), await accountRepOf(sql, "Test Twin, Cafe"), await accountRepOf(sql, "Test Twin - Cafe")], ["First Rep", "Second Rep", "First Rep"]);
  } finally {
    await pg.close();
  }
});

test("0115: one record per photo, a record deleted takes its photos, and running it twice is safe", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.exec(readFileSync(new URL("0115_ticket_photos.sql", MIGRATIONS), "utf8"));
    const i = await install(pg);
    const p = await pm(pg);
    const bytes = b64(jpeg(1));
    const put = (cols, vals) =>
      pg.query(`insert into ticket_photos (${cols}, data, thumb, bytes, width, height, added_by) values (${vals}, decode('${bytes}', 'base64'), decode('${bytes}', 'base64'), 600, 1, 1, 'u-tech')`);
    await assert.rejects(put("install_id, pm_id", `${i}, ${p}`), /check/);
    await assert.rejects(put("added_by_name", "'tess'"), /check/);
    await add(sql, "u-tech", "pm", p);
    await pg.query("delete from pm_jobs where id = $1", [p]);
    assert.equal((await one(pg, "select count(*)::int as c from ticket_photos where pm_id = $1", [p])).c, 0);
    const cols = (await pg.query("select column_name from information_schema.columns where table_name = 'ticket_photos' order by ordinal_position")).rows.map((r) => r.column_name);
    assert.deepEqual(cols, ["id", "install_id", "job_id", "pm_id", "mime", "data", "thumb", "bytes", "width", "height", "added_by", "added_by_name", "added_at"]);
  } finally {
    await pg.close();
  }
});

test("the screens: a Photos tab on the install, ticket and PM windows and on the account; add, enlarge, download, Download all, remove", () => {
  const sheets = src("src/components/desk/entity-sheets.tsx");
  assert.match(sheets, /\{ id: "pre-inspection", label: "Pre-Inspection", short: "Pre-Insp\." \},\n {2}\{ id: "photos", label: "Photos" \},\n {2}\{ id: "ping", label: "Ping" \},/);
  assert.match(sheets, /\{ id: "invoices", label: "Invoices" \},\n {2}\{ id: "photos", label: "Photos" \},\n {2}\{ id: "ping", label: "Ping" \},\n\];\n\ntype InstallTab/);
  assert.match(sheets, /<RecordPhotosPanel kind="install" id=\{row\.id\}/);
  assert.match(sheets, /<RecordPhotosPanel kind="pm" id=\{pm\.id\}/);
  assert.match(sheets, /const showSaveBar = tab !== "ping" && tab !== "photos" &&/);
  assert.match(sheets, /if \(id === "photos"\) return installPhotos\.data\?\.photos\.length \|\| null;/);
  const ticket = src("src/components/desk/job-sheet.tsx");
  assert.match(ticket, /\{ id: "schedules", label: "Schedules" \},\n {2}\{ id: "photos", label: "Photos" \},\n {2}\{ id: "ping", label: "Ping" \},/);
  assert.equal((ticket.match(/<RecordPhotosPanel kind="job" id=\{j\.id\}/g) ?? []).length, 2, "on the tabs, and on a ticket with no account");
  const account = src("src/components/desk/customer-sheet.tsx");
  assert.match(account, /\{ id: "photos", label: "Photos" \},\n\];/);
  assert.match(account, /<AccountPhotosPanel customerId=\{data\.id\} \/>/);
  assert.match(account, /if \(t === "photos"\) return accountPhotos\.data\?\.total \|\| null;/);
  const panel = src("src/components/desk/photos-panel.tsx");
  assert.match(panel, /type="file" accept="image\/\*" capture="environment"/);
  assert.match(panel, /type="file" accept="image\/\*" multiple/);
  assert.match(panel, /if \(window\.confirm\(PHOTO_REMOVE_CONFIRM\)\) remove\.mutate\(p\.id\);/);
  assert.match(panel, /\{onRemove && photo\.canRemove \? \(/);
  assert.match(panel, /const full = await jpegWithin\(img, canvas, PHOTO_MAX_EDGE, PHOTO_MAX_BYTES\);/);
  assert.match(panel, /const thumb = await jpegWithin\(img, canvas, THUMB_MAX_EDGE, THUMB_MAX_BYTES\);/);
  // One canvas per photo, emptied after, and the decoded photo let go (a phone adding many at once).
  assert.match(panel, /\} finally \{\n\s+canvas\.width = 0;\n\s+canvas\.height = 0;\n\s+done\(\);/);
  assert.match(panel, /img\.removeAttribute\("src"\);\n\s+URL\.revokeObjectURL\(url\);/);
  assert.match(panel, /for \(const step of shrinkSteps\(maxEdge\)\)/);
  assert.match(panel, /if \(!ctx\) throw new Error\(PHOTO_NO_MEMORY\);/);
  assert.match(panel, /if \(!blob\) throw new Error\(PHOTO_NO_MEMORY\);/);
  assert.match(panel, /saveFile\(new Blob\(zipParts\(entries\), \{ type: "application\/zip" \}\), zipName\);/);
  // The upload loop stops on what the server says holds for the rest, and counts a photo stored as added.
  assert.match(panel, /if \(stopsUploads\(message\)\) \{/);
  assert.match(panel, /if \(message === PHOTO_ADDED_ELSEWHERE\) \{\n\s+added \+= 1;/);
  assert.match(panel, /toast\.message\("Photos are still being added\. Add these once they're done\."\);/);
  // The Add menu closes on Escape or a tap elsewhere; a Remove that failed shows the list as it is now.
  assert.match(panel, /if \(e\.key === "Escape"\) setOpen\(false\);/);
  // Marked as a picker: Escape closes it, and the window stays (the window closes a picker first, by this mark).
  assert.match(panel, /role="menu"\n\s+aria-label="Add photos"\n\s+data-combo-popover=""/);
  assert.match(panel, /document\.addEventListener\("desk-close-combo", close\);/);
  assert.match(panel, /ctx\.imageSmoothingQuality = "high";\n\s+ctx\.drawImage\(img, 0, 0, size\.width, size\.height\);/);
  assert.match(panel, /if \(!boxRef\.current\?\.contains\(e\.target as Node\)\) setOpen\(false\);/);
  assert.match(panel, /onError: \(e\) => \{\n\s+toast\.error\(e instanceof Error \? e\.message : "Couldn't remove the photo"\);\n\s+\/\/ It may be gone or moved already: the list as it is now\.\n\s+invalidatePhotos\(qc\);/);
  // The grid's previews load as they come near the screen.
  assert.match(panel, /imgClassName="size-full object-cover"\n\s+lazy\n/);
  assert.equal((src("src/components/desk/image-lightbox.tsx").match(/loading=\{lazy \? "lazy" : undefined\}/g) ?? []).length, 2);
  // Merges refresh the photo lists.
  assert.match(src("src/components/desk/install-project-fields.tsx"), /void qc\.invalidateQueries\(\{ queryKey: \["photos"\] \}\);/);
  assert.equal((src("src/components/desk/job-sheet.tsx").match(/"photos"\]/g) ?? []).length, 2);
  assert.match(panel, /const names = uniqueNames\(photos\.map\(\(p\) => p\.name\)\);/);
  assert.match(panel, /href=\{photoSrc\(photo\.id, "download"\)\}\n\s+download=\{photo\.name\}/);
  assert.match(panel, /src=\{photoSrc\(photo\.id, "thumb"\)\}\n\s+fullSrc=\{photoSrc\(photo\.id\)\}/);
  assert.match(src("src/components/desk/photo-queries.ts"), /return as === "thumb" \? `\/api\/ticket-photo\/\$\{id\}\?size=thumb` : as === "download" \? `\/api\/ticket-photo\/\$\{id\}\?download=1` : `\/api\/ticket-photo\/\$\{id\}`;/);
  assert.match(panel, /const res = await fetch\(photoSrc\(p\.id\), \{ credentials: "same-origin" \}\);/, "Download all fetches each photo, not its preview");
  assert.match(panel, /\{data\.groups\.length > 1 && g\.photos\.length > 1 \? \(/, "one install: the tab's Download all only");
  // The account's tab is for looking and downloading: its grids have no Remove.
  assert.match(panel, /<PhotoGrid photos=\{g\.photos\} \/>/);
  const lightbox = src("src/components/desk/image-lightbox.tsx");
  assert.match(lightbox, /src=\{fullSrc \?\? src\}/);
  assert.match(lightbox, /href=\{downloadHref \?\? fullSrc \?\? src\}/);
  assert.ok(existsSync(new URL("../src/routes/api/ticket-photo/$id.ts", import.meta.url)));
  assert.match(src("src/routeTree.gen.ts"), /'\/api\/ticket-photo\/\$id'/);
  assert.match(src("src/components/desk/ticket-install-merge.tsx"), /\{m\.photos \? \(\n\s+<MoveRow label="Photos"/);
});
