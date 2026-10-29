// Parts → Export CSV (Grok's request through Chuy, 2026-10-29): every part on the Parts page, the hidden ones too, one
// row each, Admin only and read only. Filtered only keeps the page's class and search. The rows stream 500 at a time.
// All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const pure = await import("../src/lib/ops/parts-export.ts");
const api = await import("../src/lib/ops/parts-export-api.ts");
const { listPartsFor } = await import("../src/lib/ops/parts-api.ts");
const { partUsageCounts } = await import("../src/lib/ops/part-usage-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const ORIGIN = "https://katzdesk.example.test";

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'),
       ('u-role', 'ana', true, false, 'admin'),
       ('u-sales', 'sam', true, false, 'sales'),
       ('u-tech', 'melinda', true, false, 'service'),
       ('u-waiting', 'newbie', false, true, 'admin')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

/** A small CSV reader: quoted cells may hold commas, quotes and line breaks; lines end CRLF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

/** Run the export the way the address bar asks for it; the file's bytes, its rows as objects, and the result. */
async function exportFile(sql, search = "", userId = "u-owner") {
  const out = await api.partsExportFor(sql, userId, new URLSearchParams(search), ORIGIN, "2026-10-29");
  if (!out.ok) return { out };
  const bytes = new Uint8Array(await new Response(out.body).arrayBuffer());
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
  const [head, ...lines] = parseCsv(text.replace(/^\uFEFF/, ""));
  const rows = lines.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i]])));
  return { out, bytes, text, head, rows };
}

/* ------------------------------------------------------------------ the plain pieces */

test("the columns are Grok's, in his order; the file starts with a byte-order mark and its name has the day", () => {
  assert.deepEqual(
    [...pure.PARTS_EXPORT_COLUMNS],
    ["id", "sku", "name", "description", "manufacturer", "mfr_part_number", "class", "bins", "hidden", "has_photo", "photo_url",
      "merged_into_id", "created", "updated", "wo_part_line_count", "ticket_count", "equipment_link_count"],
  );
  assert.equal(pure.PARTS_EXPORT_HEAD, `\uFEFF${pure.PARTS_EXPORT_COLUMNS.join(",")}\r\n`);
  assert.equal(pure.partsExportFileName("2026-10-29"), "kd-parts-2026-10-29.csv");
});

test("one line: yes/no, a whole photo address, the bin, the merge, and cells a spreadsheet can't run", () => {
  const row = {
    id: 12,
    sku: "EVER104120",
    item: "PARTS : EVER104120",
    description: 'Gasket, 3" "group" seal\nfor the head',
    mfrPart: "=SUM(A1)",
    itemClass: "Parts",
    binRack: "A",
    binShelf: "03",
    binBin: "12",
    hidden: true,
    hasPhoto: true,
    imageVersion: "1730000000",
    mergedInto: 9,
    updatedAt: "2026-10-29T14:03:11Z",
  };
  const cells = parseCsv(`${pure.partExportLine(row, { woPartLines: 2, tickets: 5, equipmentLinks: 1 }, `${ORIGIN}/`)}\r\n`)[0];
  assert.equal(cells.length, 17);
  assert.deepEqual(cells, [
    "12",
    "EVER104120",
    "PARTS : EVER104120",
    'Gasket, 3" "group" seal\nfor the head',
    "",
    "'=SUM(A1)",
    "Parts",
    "Rack A · Shelf 03 · Bin 12",
    "yes",
    "yes",
    `${ORIGIN}/api/part-image/12?v=1730000000`,
    "9",
    "",
    "2026-10-29T14:03:11Z",
    "2",
    "5",
    "1",
  ]);
  const bare = parseCsv(
    `${pure.partExportLine({ ...row, description: null, mfrPart: null, itemClass: null, binRack: null, binShelf: null, binBin: null, hidden: false, hasPhoto: false, imageVersion: null, mergedInto: null, updatedAt: null }, undefined, ORIGIN)}\r\n`,
  )[0];
  assert.deepEqual(bare, ["12", "EVER104120", "PARTS : EVER104120", "", "", "", "", "", "no", "no", "", "", "", "", "0", "0", "0"]);
});

test("the address bar: the whole list unless filtered=1; class and search count only then", () => {
  assert.deepEqual(pure.parsePartsExportQuery(new URLSearchParams("class=Equipment&q=bunn")), { filtered: false, itemClass: "", q: "" });
  assert.deepEqual(pure.parsePartsExportQuery(new URLSearchParams("filtered=1&class=%20Equipment%20&q=%20bunn%20")), { filtered: true, itemClass: "Equipment", q: "bunn" });
  assert.equal(pure.parsePartsExportQuery(new URLSearchParams(`filtered=1&q=${"x".repeat(500)}`)).q.length, 120);
  assert.equal(pure.partsExportHref({ filtered: false, itemClass: "Equipment", q: "bunn" }), "/api/admin/parts-export");
  assert.equal(pure.partsExportHref({ filtered: true, itemClass: "", q: "" }), "/api/admin/parts-export?filtered=1");
  const href = pure.partsExportHref({ filtered: true, itemClass: "Water Filters", q: "A-03 & 12" });
  assert.deepEqual(pure.parsePartsExportQuery(new URL(href, ORIGIN).searchParams), { filtered: true, itemClass: "Water Filters", q: "A-03 & 12" });
});

/* ------------------------------------------------------------------ the database */

const CLASSES = ["Parts", "Water Filters", "Service", "Equipment", "Dispensers"];

/**
 * 1,234 listed parts, 61 hidden ones (6 of them inactive too, as a NetSuite import can leave them) and 25 inactive ones
 * that aren't hidden, so the file takes three pages.
 */
async function bulk(pg) {
  await pg.query(
    `insert into billing_items (sku, item, description, kind, item_class, active, hidden_at, bin_rack, bin_shelf, bin_bin)
     select 'KDT-' || lpad(g::text, 5, '0'), 'PARTS : KDT-' || lpad(g::text, 5, '0'), 'Made-up part ' || g,
            case when g % 10 = 4 then 'equipment' else 'part' end,
            case when g % 13 = 0 then null else ($1::text[])[1 + g % 5] end,
            not (g between 1290 and 1320),
            case when g between 1235 and 1295 then now() - interval '3 days' end,
            case when g % 50 = 0 then 'A' end, case when g % 50 = 0 then '03' end, case when g % 50 = 0 then lpad((g / 50)::text, 2, '0') end
       from generate_series(1, 1320) g`,
    [CLASSES],
  );
}

test("the whole file: every part on the list and under Show Hidden, once each, in id order, three pages streamed", async () => {
  const { pg, sql } = await fresh();
  try {
    await bulk(pg);
    const shown = await listPartsFor(sql, {}, "u-owner");
    assert.equal(shown.total, 1234);
    assert.equal(shown.hiddenCount, 61);
    const f = await exportFile(sql);
    assert.equal(f.out.total, shown.total + shown.hiddenCount, "the page's header plus Show Hidden");
    assert.equal(f.rows.length, 1295);
    assert.deepEqual([...f.bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "UTF-8 with a byte-order mark");
    assert.deepEqual(f.head, [...pure.PARTS_EXPORT_COLUMNS]);
    assert.equal(f.out.fileName, "kd-parts-2026-10-29.csv");
    assert.ok(f.text.endsWith("\r\n") && !/[^\r]\n(?=\d+,KDT-)/.test(f.text), "every line ends CRLF");
    const ids = f.rows.map((r) => Number(r.id));
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "id order");
    assert.equal(new Set(ids).size, ids.length, "no part twice across the pages");
    assert.equal(f.rows.filter((r) => r.hidden === "yes").length, 61);
    assert.deepEqual(
      f.rows.filter((r) => /^KDT-0129[0-5]$/.test(r.sku)).map((r) => r.hidden),
      ["yes", "yes", "yes", "yes", "yes", "yes"],
      "a hidden part that is inactive too is under Show Hidden, so it's in the file",
    );
    assert.ok(!f.rows.some((r) => /^KDT-01(29[6-9]|3[01]\d|320)$/.test(r.sku)), "an inactive part that isn't hidden is on neither list");
    assert.ok(!f.rows.some((r) => ["TRIPCHARGE", "SERVICELABOR"].includes(r.sku)), "trip and labor aren't parts");
    const bin = f.rows.find((r) => r.sku === "KDT-00100");
    assert.equal(bin.bins, "Rack A · Shelf 03 · Bin 02");
    assert.equal(f.rows.find((r) => r.sku === "KDT-01240").hidden, "yes");
    assert.match(f.rows[0].updated, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  } finally {
    await pg.close();
  }
});

test("Filtered only: the Equipment class exports just the Equipment parts, the hidden ones in it too", async () => {
  const { pg, sql } = await fresh();
  try {
    await bulk(pg);
    const listed = await listPartsFor(sql, { itemClass: "Equipment" }, "u-owner");
    const hidden = await listPartsFor(sql, { itemClass: "Equipment", hidden: true }, "u-owner");
    const f = await exportFile(sql, "filtered=1&class=Equipment");
    assert.ok(listed.total > 200 && hidden.total > 5);
    assert.equal(f.rows.length, listed.total + hidden.total);
    assert.equal(f.out.total, f.rows.length);
    assert.ok(f.rows.every((r) => r.class === "Equipment"));
    assert.equal(f.rows.filter((r) => r.hidden === "yes").length, hidden.total);
    // The class and search count only with Filtered only.
    assert.equal((await exportFile(sql, "class=Equipment")).rows.length, 1295);
  } finally {
    await pg.close();
  }
});

test("Filtered only: the list's search, by part number and by bin code", async () => {
  const { pg, sql } = await fresh();
  try {
    await bulk(pg);
    for (const q of ["KDT-0124", "made-up part 7", "A-03-12", "rack a"]) {
      const listed = await listPartsFor(sql, { q }, "u-owner");
      const hidden = await listPartsFor(sql, { q, hidden: true }, "u-owner");
      const f = await exportFile(sql, new URLSearchParams({ filtered: "1", q }).toString());
      assert.equal(f.rows.length, listed.total + hidden.total, q);
      assert.ok(f.rows.length > 0, q);
    }
    const both = await exportFile(sql, "filtered=1&class=Parts&q=KDT-0124");
    assert.ok(both.rows.length > 0 && both.rows.every((r) => r.class === "Parts" && r.sku.startsWith("KDT-0124")));
  } finally {
    await pg.close();
  }
});

/** Five parts and their tickets, WO part lines and PM machine parts. OLDVALVE was merged into VALVE1. */
async function usageSeed(pg) {
  const part = async (sku, extra = {}) =>
    (
      await pg.query("insert into billing_items (sku, item, description, kind, item_class) values ($1, $2, $3, $4, $5) returning id", [
        sku,
        `${extra.kind === "equipment" ? "EQUIPMENT" : "PARTS"} : ${sku}`,
        `${sku} part`,
        extra.kind ?? "part",
        extra.cls ?? "Parts",
      ])
    ).rows[0].id;
  const ids = {
    filter: await part("FLT1", { cls: "Water Filters" }),
    valve: await part("VALVE1"),
    old: await part("OLDVALVE"),
    brewer: await part("BUNNITCB", { kind: "equipment", cls: "Equipment" }),
    never: await part("NEVER1"),
  };
  await pg.query("update billing_items set merged_into = $1, hidden_at = now(), hidden_reason = 'Merged into VALVE1', previous_numbers = '{OLDVALVE}' where id = $2", [ids.valve, ids.old]);
  const job = async (kind, callId, status = "Completed") =>
    (
      await pg.query("insert into service_jobs (kind, call_id, customer, status, wo, completed_at, received) values ($1, $2, 'Alpha Cafe', $3, $4, '2026-10-12', '2026-10-01') returning id", [
        kind,
        callId,
        status,
        `WO-${callId}`,
      ])
    ).rows[0].id;
  const charge = (jobId, item, qty = 1) => pg.query("insert into ticket_charges (job_id, item, qty, rate, kind) values ($1, $2, $3, 10, 'part')", [jobId, item, qty]);
  const t = { a: await job("service", "SC-1"), b: await job("tlc", "TLC-1"), cancelled: await job("service", "SC-2", "Cancelled"), d: await job("service", "SC-3") };
  await charge(t.a, "PARTS : FLT1", 2);
  await charge(t.a, "PARTS : VALVE1");
  await charge(t.a, "OLDVALVE"); // the old number: counts on VALVE1, and ticket A has it once
  await charge(t.b, "VALVE1", 4);
  await charge(t.cancelled, "PARTS : FLT1"); // a cancelled ticket doesn't count
  await charge(t.d, "EQUIPMENT : BUNNITCB");
  // WO part lines, as stored: two for the filter on WO-0101 (Corrigo's and NetSuite's), the old valve number on a WO
  // with no ticket, and one whose part isn't on the list.
  const line = (jobId, wo, sku, source) =>
    pg.query("insert into ticket_part_lines (job_id, wo, item, sku, qty, used_on, source) values ($1, $2, $3, $4, 1, '2026-10-12', $5)", [jobId, wo, `PARTS:${sku}`, sku, source]);
  await line(t.a, "WO-0101", "FLT1", "corrigo");
  await line(t.a, "WO-0101", "FLT1", "netsuite");
  await line(null, "WO-0500", "OLDVALVE", "corrigo");
  await line(null, "WO-0600", "NOPART", "netsuite");
  // PM machine parts. The filter is on account unit U1 (serial u-1) on two PMs, and on serial u-1 alone on a third
  // line: one machine. It is also on serial sn-77, and on a third machine with neither, logged by name. A removed line
  // and a cancelled PM don't count. The old valve number is on serial sn-55: that machine counts on VALVE1.
  const unit = (await pg.query("insert into account_equipment (customer, catalog_model, equipment_name, serial, serial_key) values ('Alpha Cafe', 'Bunn ITCB', 'Bunn ITCB', 'U-1', 'u-1') returning id")).rows[0].id;
  const pm = async (status = "Completed") => (await pg.query("insert into pm_jobs (customer, status, wo, completed_at) values ('Alpha Cafe', $1, 'WO-0200', '2026-08-15') returning id", [status])).rows[0].id;
  const pm1 = await pm();
  const pm2 = await pm();
  const pm3 = await pm("Cancelled");
  const logged = (pmId, pieceKey, { item = "PARTS : FLT1", billingItemId = ids.filter, unitId = null, serialKey = null, removed = false } = {}) =>
    pg.query(
      `insert into machine_parts (pm_job_id, piece_key, machine_label, item, qty, billing_item_id, account_equipment_id, serial_key, removed_at)
       values ($1, $2, 'Brewer', $3, 1, $4, $5, $6, $7)`,
      [pmId, pieceKey, item, billingItemId, unitId, serialKey, removed ? new Date() : null],
    );
  await logged(pm1, "m1", { unitId: unit });
  await logged(pm2, "m1", { unitId: unit });
  await logged(pm2, "m2", { serialKey: "sn-77" });
  await logged(pm2, "m3", { billingItemId: null });
  await logged(pm2, "m6", { serialKey: "u-1" });
  await logged(pm2, "m4", { serialKey: "sn-88", removed: true });
  await logged(pm3, "m1", { serialKey: "sn-99" });
  await logged(pm1, "m5", { item: "PARTS : OLDVALVE", billingItemId: ids.old, serialKey: "sn-55" });
  return { ids, t, pm1, pm2 };
}

test("the counts: WO part lines as stored, the tickets on the part's row, and each machine once; a merged part reads 0", async () => {
  const { pg, sql } = await fresh();
  try {
    const { ids } = await usageSeed(pg);
    const f = await exportFile(sql);
    const by = Object.fromEntries(f.rows.map((r) => [r.sku, r]));
    const counts = (sku) => [by[sku].wo_part_line_count, by[sku].ticket_count, by[sku].equipment_link_count].map(Number);
    // FLT1: 2 lines; tickets A, PM 1 and PM 2; machines U1 (by its unit and by its serial), sn-77 and PM 2's third one.
    assert.deepEqual(counts("FLT1"), [2, 3, 3]);
    // VALVE1: the old number's line; tickets A, B, WO-0500 and PM 1; the machine with serial sn-55.
    assert.deepEqual(counts("VALVE1"), [1, 4, 1]);
    assert.deepEqual(counts("OLDVALVE"), [0, 0, 0]);
    assert.deepEqual(counts("BUNNITCB"), [0, 1, 0]);
    assert.deepEqual(counts("NEVER1"), [0, 0, 0]);
    // The ticket count is the number on the part's row on Parts.
    const usage = await partUsageCounts(sql, Object.values(ids));
    for (const [key, id] of Object.entries(ids)) assert.equal(Number(f.rows.find((r) => Number(r.id) === id).ticket_count), usage[id].tickets, key);
    const old = by.OLDVALVE;
    assert.deepEqual([old.hidden, old.merged_into_id], ["yes", String(ids.valve)]);
    assert.equal(by.VALVE1.merged_into_id, "");
    assert.deepEqual([by.FLT1.manufacturer, by.FLT1.created], ["", ""], "KatzDesk keeps no maker or date added for a part");
  } finally {
    await pg.close();
  }
});

test("a photo: has_photo yes and the address the Parts page shows", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = (await pg.query("insert into billing_items (sku, item, kind, item_class) values ('PIC1', 'PARTS : PIC1', 'part', 'Parts') returning id")).rows[0].id;
    await pg.query("update billing_items set image = '\\x89504e47'::bytea, image_mime = 'image/png', image_updated_at = to_timestamp(1730000000) where id = $1", [id]);
    await pg.query("insert into billing_items (sku, item, kind, item_class) values ('NOPIC1', 'PARTS : NOPIC1', 'part', 'Parts')");
    const f = await exportFile(sql);
    const pic = f.rows.find((r) => r.sku === "PIC1");
    assert.deepEqual([pic.has_photo, pic.photo_url], ["yes", `${ORIGIN}/api/part-image/${id}?v=1730000000`]);
    const none = f.rows.find((r) => r.sku === "NOPIC1");
    assert.deepEqual([none.has_photo, none.photo_url], ["no", ""]);
  } finally {
    await pg.close();
  }
});

test("Admin only: the Admin role or the owner flag; Sales, a tech and an unapproved account are refused before a part is read", async () => {
  const { pg, sql } = await fresh();
  try {
    await bulk(pg);
    for (const userId of ["u-owner", "u-role"]) assert.equal((await exportFile(sql, "", userId)).rows.length, 1295, userId);
    for (const userId of ["u-sales", "u-tech", "u-waiting", "u-nobody"]) {
      const seen = [];
      const spy = Object.assign(async () => assert.fail("tagged query"), { query: async (text, params) => (seen.push(text), sql.query(text, params)) });
      const out = await api.partsExportFor(spy, userId, new URLSearchParams(), ORIGIN);
      assert.deepEqual(out, { ok: false, status: 403, error: "Only an Admin can export the parts." }, userId);
      assert.equal(seen.length, 1, userId);
      assert.match(seen[0], /from desk_accounts where user_id = \$1/);
    }
  } finally {
    await pg.close();
  }
});

/** A GET to the export the way a browser on the Parts page sends it, unless other headers are given. */
const get = (path = "/api/admin/parts-export", headers = { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" }) =>
  new Request(`http://10.0.0.7:3000${path}`, { headers });

test("the address: another site's script 403, signed out 401, not an Admin 403, an Admin the file with its headers", async () => {
  const { pg, sql } = await fresh();
  const logged = console.error;
  console.error = () => {};
  try {
    await bulk(pg);
    let asked = 0;
    const as = (userId) => ({
      session: async () => (asked++, userId ? { user: { id: userId } } : null),
      ready: async () => sql,
      day: "2026-10-29",
    });
    const body = async (res) => [res.status, res.headers.get("content-type"), await res.text()];

    const cross = await api.partsExportResponse(get(undefined, { "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors" }), as("u-owner"));
    assert.deepEqual(await body(cross), [403, "application/json; charset=utf-8", '{"error":"Cross-site request refused."}']);
    assert.equal(asked, 0, "refused before the sign-in is read");
    const embedded = await api.partsExportResponse(get(undefined, { "sec-fetch-site": "cross-site", "sec-fetch-mode": "no-cors" }), as("u-owner"));
    assert.equal(embedded.status, 403, "another site can't pull it in as an image or script");

    assert.deepEqual(await body(await api.partsExportResponse(get(), as(null))), [401, "application/json; charset=utf-8", '{"error":"Sign in first."}']);
    const broken = { ...as("u-owner"), session: async () => { throw new Error("bad cookie"); } };
    assert.equal((await api.partsExportResponse(get(), broken)).status, 401);
    for (const userId of ["u-sales", "u-tech", "u-waiting"]) {
      const res = await api.partsExportResponse(get(), as(userId));
      assert.deepEqual(await body(res), [403, "application/json; charset=utf-8", '{"error":"Only an Admin can export the parts."}'], userId);
      assert.equal(res.headers.get("cache-control"), "no-store");
    }

    const ok = await api.partsExportResponse(get(), as("u-owner"));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(ok.headers.get("content-disposition"), 'attachment; filename="kd-parts-2026-10-29.csv"');
    assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.equal(ok.headers.get("x-parts-count"), "1295");
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await ok.arrayBuffer());
    assert.ok(text.startsWith(`\uFEFF${pure.PARTS_EXPORT_COLUMNS.join(",")}\r\n`));
    assert.equal(parseCsv(text).length, 1 + 1295);

    // Filtered only, from the address the Parts page builds.
    const eq = await api.partsExportResponse(get(pure.partsExportHref({ filtered: true, itemClass: "Equipment" })), as("u-owner"));
    const rows = parseCsv((await eq.text()).replace(/^\uFEFF/, "")).slice(1);
    assert.equal(Number(eq.headers.get("x-parts-count")), rows.length);
    assert.ok(rows.length > 200 && rows.every((r) => r[6] === "Equipment"));

    // A failure before the first byte: a sentence for the Parts page, not half a file.
    const down = await api.partsExportResponse(get(), { ...as("u-owner"), ready: async () => { throw new Error("database asleep"); } });
    assert.deepEqual(await body(down), [500, "application/json; charset=utf-8", '{"error":"Could not build the parts file. Try again."}']);
  } finally {
    console.error = logged;
    await pg.close();
  }
});

test("photo links use the site's public address when it has one, else the request's", async () => {
  assert.equal(api.exportOrigin("http://10.0.0.7:3000/api/admin/parts-export", "https://katzdesk.example.test/"), "https://katzdesk.example.test");
  assert.equal(api.exportOrigin("http://localhost:8080/api/admin/parts-export", undefined), "http://localhost:8080");
  assert.equal(api.exportOrigin("http://localhost:8080/api/admin/parts-export", "  "), "http://localhost:8080");
  assert.equal(api.exportOrigin("http://localhost:8080/x", "not an address"), "http://localhost:8080");
  assert.equal(api.exportOrigin("http://localhost:8080/x", "javascript:alert(1)"), "http://localhost:8080");
  const { pg, sql } = await fresh();
  try {
    const id = (await pg.query("insert into billing_items (sku, item, kind, item_class, image, image_updated_at) values ('PIC2', 'PARTS : PIC2', 'part', 'Parts', '\\x89504e47'::bytea, to_timestamp(1730000000)) returning id")).rows[0].id;
    const res = await api.partsExportResponse(get(), { session: async () => ({ user: { id: "u-owner" } }), ready: async () => sql, publicUrl: "https://katzdesk.example.test" });
    const row = parseCsv((await res.text()).replace(/^\uFEFF/, ""))[1];
    assert.equal(row[10], `https://katzdesk.example.test/api/part-image/${id}?v=1730000000`);
  } finally {
    await pg.close();
  }
});

test("read only: every query the export runs is a read, and nothing in the database changes", async () => {
  const { pg, sql } = await fresh();
  try {
    await bulk(pg);
    await usageSeed(pg);
    const snapshot = async () =>
      (
        await pg.query(
          `select (select md5(string_agg(b::text, '|' order by b.id)) from billing_items b) as parts,
                  (select count(*) from ticket_part_lines) as lines, (select count(*) from machine_parts) as machine_parts,
                  (select md5(string_agg(d::text, '|' order by d.user_id)) from desk_accounts d) as accounts`,
        )
      ).rows[0];
    const before = await snapshot();
    const seen = [];
    const spy = Object.assign(async () => assert.fail("tagged query"), { query: async (text, params) => (seen.push(text), sql.query(text, params)) });
    const out = await api.partsExportFor(spy, "u-owner", new URLSearchParams("filtered=1&class=Parts"), ORIGIN);
    await new Response(out.body).arrayBuffer();
    await exportFile(sql);
    assert.deepEqual(await snapshot(), before);
    assert.ok(seen.length >= 4);
    for (const text of seen) {
      assert.match(text, /^\s*(select|with)\b/i);
      assert.doesNotMatch(text, /\b(insert\s+into|update\s+\w+\s+set|delete\s+from|truncate|alter|drop)\b/i);
    }
  } finally {
    await pg.close();
  }
});

test("a read that fails stops with an error: before the first byte it is an error page, partway the download fails", async () => {
  const { pg, sql } = await fresh();
  const logged = console.error;
  console.error = () => {};
  try {
    await bulk(pg);
    const failing = (when) => {
      let pages = 0;
      return Object.assign(async () => assert.fail("tagged query"), {
        query: async (text, params) => {
          if (when === "counts" && /^\s*with\b/i.test(text)) throw new Error("connection lost");
          if (when === "page 2" && /order by id\s+limit \$6/.test(text) && ++pages === 2) throw new Error("connection lost");
          return sql.query(text, params);
        },
      });
    };
    await assert.rejects(() => api.partsExportFor(failing("counts"), "u-owner", new URLSearchParams(), ORIGIN), /connection lost/);
    const out = await api.partsExportFor(failing("page 2"), "u-owner", new URLSearchParams(), ORIGIN);
    assert.equal(out.ok, true);
    await assert.rejects(() => new Response(out.body).arrayBuffer(), /connection lost/, "never a short file that looks whole");
  } finally {
    console.error = logged;
    await pg.close();
  }
});

test("the route hands the request to the checks, has nothing but GET, and nothing in it writes", () => {
  const route = readFileSync(new URL("../src/routes/api/admin/parts-export.ts", import.meta.url), "utf8");
  assert.match(route, /return partsExportResponse\(request, \{\s*session: \(headers\) => auth\.api\.getSession\(\{ headers \}\),/);
  assert.match(route, /publicUrl: process\.env\.BETTER_AUTH_URL,/);
  assert.doesNotMatch(route, /\b(POST|PUT|PATCH|DELETE):/);
  const lib = readFileSync(new URL("../src/lib/ops/parts-export-api.ts", import.meta.url), "utf8");
  const handler = lib.slice(lib.indexOf("export async function partsExportResponse"));
  const order = ["sameSiteOk(request)", "deps.session(", '"Sign in first."', "deps.ready()", "partsExportFor(sql, userId"].map((t) => handler.indexOf(t));
  assert.ok(order.every((i) => i > 0), "each check is there");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "in that order");
  const exporter = lib.slice(lib.indexOf("export async function partsExportFor"));
  assert.ok(exporter.indexOf("canReviewNames(sql, userId)") < exporter.indexOf("partsExportCounts(sql)"), "the Admin before any part is read");
  assert.doesNotMatch(lib + route, /\b(insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i);
});

test("the Parts page shows Export CSV and Filtered only to an Admin only, on the parts list", () => {
  const page = readFileSync(new URL("../src/routes/_app/parts.tsx", import.meta.url), "utf8");
  assert.match(page, /\{isAdmin && !usageView \? <PartsExportButton itemClass=\{itemClass\} q=\{term\} \/> : null\}/);
  assert.equal(page.match(/<PartsExportButton/g).length, 1);
  const button = readFileSync(new URL("../src/components/desk/parts-export-button.tsx", import.meta.url), "utf8");
  assert.match(button, /fetch\(partsExportHref\(\{ filtered, itemClass, q \}\)/);
  assert.match(button, /useState\(false\)/, "Filtered only starts off: the whole list");
  assert.match(button, /data-testid="parts-export-filtered"/);
  assert.match(button, /data-testid="parts-export-csv"/);
});
