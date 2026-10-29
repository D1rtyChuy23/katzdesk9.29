// One part for one number (10/28, Grok's request through Chuy): Clean Up Import Copies (Part A) and Import Part
// Merges (Part B). Both previews, fill-blanks-only, PM machine parts moved, photo research copied, usage rolled up to
// the part kept, copies with no original, ambiguous ones left, the pickers and the Parts search finding an old number,
// the NetSuite import never making copies again, and running everything twice. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const merges = await import("../src/lib/ops/part-merges.ts");
const { cleanUpImportCopiesFor, importPartMergesFor } = await import("../src/lib/ops/part-merges-api.ts");
const { listPartsFor, restorePartsFor } = await import("../src/lib/ops/parts-api.ts");
const { loadPartUses } = await import("../src/lib/ops/part-usage-api.ts");
const { searchBillingItemsFor } = await import("../src/lib/ops/charges-api.ts");
const { partRowsFromSheets, planPartImport } = await import("../src/lib/ops/part-pricing.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-sales', 'sam', true, false, 'sales')`,
  );
  return { query: async (text, params) => (await pg.query(text, params)).rows };
}

/** A part. `copy: "PARTS"` makes an import copy of `sku`: SKU and MPN "PARTS : <sku>", no class, photo or bin. */
async function part(sql, sku, o = {}) {
  const full = o.copy ? `${o.copy} : ${sku}` : sku;
  const [rack, shelf, bin] = o.bins ?? [null, null, null];
  return (
    await sql.query(
      `insert into billing_items (sku, item, mfr_part, description, kind, item_class, rate, cost, list_price, image, image_mime, photo_status,
                                  bin_rack, bin_shelf, bin_bin, hidden_at, parent)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) returning id`,
      [
        full,
        o.item ?? (o.copy ? full : `PARTS : ${sku}`),
        o.copy ? full : (o.mpn ?? null),
        o.description ?? null,
        o.kind ?? "part",
        o.copy ? null : (o.cls === undefined ? "Parts" : o.cls),
        o.rate ?? null,
        o.cost ?? null,
        o.list ?? null,
        o.image ? new Uint8Array([0x89, 0x50, 0x4e, 0x47]) : null,
        o.image ? "image/png" : null,
        o.image ? "confirmed" : null,
        rack,
        shelf,
        bin,
        o.hidden ? new Date("2026-10-01T12:00:00Z") : null,
        o.parent ?? null,
      ],
    )
  )[0].id;
}

const row = async (sql, id) => (await sql.query("select * from billing_items where id = $1", [id]))[0];
const csv = (lines) => Buffer.from(lines.join("\r\n") + "\r\n", "utf8").toString("base64");

async function pm(sql) {
  return (await sql.query("insert into pm_jobs (customer, status, completed_at) values ('Alpha Cafe', 'Completed', '2026-10-10') returning id"))[0].id;
}
async function machinePart(sql, pmId, billingItemId, item) {
  await sql.query("insert into machine_parts (pm_job_id, piece_key, machine_label, item, qty, billing_item_id) values ($1, 'm1', 'Brewer', $2, 1, $3)", [pmId, item, billingItemId]);
}
async function ticket(sql, callId, items) {
  const id = (await sql.query("insert into service_jobs (kind, call_id, customer, status, completed_at, received) values ('service', $1, 'Alpha Cafe', 'Completed', '2026-10-12', '2026-10-01') returning id", [callId]))[0].id;
  for (const item of items) await sql.query("insert into ticket_charges (job_id, item, qty, rate, kind) values ($1, $2, 1, 10, 'part')", [id, item]);
  return id;
}

/* ------------------------------------------------------------------ the plain pieces */

test("numbers: the category comes off at the last ' : ', and case and spaces don't count", () => {
  assert.equal(merges.stripCategory("PARTS : EVER108340"), "EVER108340");
  assert.equal(merges.stripCategory("BUNN : PARTS : 01037.0002"), "01037.0002");
  assert.equal(merges.categoryOf("BUNN : PARTS : 01037.0002"), "BUNN : PARTS");
  assert.equal(merges.stripCategory("EVER108340"), "EVER108340");
  assert.equal(merges.categoryOf("EVER108340"), null);
  assert.equal(merges.numberKey("  parts :  ever 108340 "), "EVER108340");
  assert.equal(merges.numberKey("PARTS:EVER1"), "PARTS:EVER1", "no spaces round the colon: not a category");
  const p = (o) => ({ id: 1, sku: "PARTS : EVER1", item: "PARTS : EVER1", mpn: "PARTS : EVER1", description: null, kind: "part", itemClass: null, hasImage: false, binRack: null, binShelf: null, binBin: null, listPrice: null, rate: null, cost: null, hidden: false, mergedInto: null, previousNumbers: [], note: null, ...o });
  assert.equal(merges.isImportCopy(p({})), true);
  assert.equal(merges.isImportCopy(p({ mpn: "parts  :  ever1" })), true, "the same text, case and spacing aside");
  assert.equal(merges.isImportCopy(p({ itemClass: "Parts" })), false);
  assert.equal(merges.isImportCopy(p({ hasImage: true })), false);
  assert.equal(merges.isImportCopy(p({ binBin: "E4-2" })), false);
  assert.equal(merges.isImportCopy(p({ mpn: "EVER1" })), false, "SKU and MPN differ");
  assert.equal(merges.isImportCopy(p({ sku: "EVER1", mpn: "EVER1" })), false, "no category");
  assert.equal(merges.isImportCopy(p({ kind: "trip" })), false);
  assert.deepEqual(merges.textArray('{OLD1,"A, B","C\\"D"}'), ["OLD1", "A, B", 'C"D']);
  assert.deepEqual(merges.textArray(["X"]), ["X"]);
  assert.deepEqual(merges.textArray(null), []);
  assert.deepEqual(merges.noteLinesToAdd(["Superseded", " New  kit  ", "", null, "New kit", "new kit"]), ["Superseded", "New kit", "new kit"]);
  assert.deepEqual(
    merges.previousNumbersAfter({ sku: "NEW1", mpn: "N-1", previousNumbers: ["OLD0"] }, [{ sku: "OLD1", mpn: "OLDM-1", previousNumbers: ["old0", "N1", "OLD-1"] }]),
    ["OLD0", "OLD1", "OLDM-1"],
    "none twice, never the keeper's own number",
  );
});

test("the NetSuite import reads 'PARTS : EVER9' as EVER9, so it updates the part instead of adding a copy, and skips a merged one", () => {
  const read = partRowsFromSheets([{ name: "Parts", matrix: [["Name", "Description"], ["PARTS : EVER9", "Gasket"], ["BUNN PARTS : EVER9", "Twice"], ["EVER10", "Seal"]] }]);
  assert.equal(read.nameIsMpn, true);
  assert.deepEqual(
    read.rows.map((r) => [r.mpn, r.sku, r.parent]),
    [
      ["EVER9", "EVER9", "PARTS"],
      ["EVER10", "EVER10", null],
    ],
  );
  assert.equal(read.duplicates, 1, "the same number under another category is the same part");
  const stored = [
    { id: 1, sku: "EVER9", item: "PARTS : EVER9", mpn: null, description: null, rate: null, cost: null, listPrice: null },
    { id: 2, sku: "PARTS : EVER9", item: "PARTS : EVER9", mpn: "PARTS : EVER9", description: null, rate: null, cost: null, listPrice: null, hidden: true, mergedIntoSku: "EVER9" },
    { id: 3, sku: "EVER10", item: "PARTS : EVER10", mpn: "EVER10", description: null, rate: null, cost: null, listPrice: null, hidden: true, mergedIntoSku: "NEW10" },
    { id: 4, sku: "NEW10", item: "PARTS : NEW10", mpn: "EVER10", description: null, rate: null, cost: null, listPrice: null },
  ];
  const plan = planPartImport(read.rows, stored);
  assert.deepEqual(
    plan.map((p) => [p.row.mpn, p.status, p.partId]),
    [
      ["EVER9", "update", 1],
      ["EVER10", "update", 4],
    ],
    "the part, not the copy; a keeper that took a merged part's MPN is the match, not a shared MPN",
  );
  const onlyMerged = planPartImport(read.rows.slice(1), stored.slice(2, 3));
  assert.deepEqual([onlyMerged[0].status, onlyMerged[0].reason], ["hidden", "Merged into NEW10. Skipped: it stays hidden."]);
});

/* ------------------------------------------------------------------ Part A */

async function copiesWorld(sql) {
  const ids = {
    o1: await part(sql, "EVER1", { rate: 10 }),
    c1: await part(sql, "EVER1", { copy: "PARTS", description: "Gasket", rate: 12, cost: 5, list: 20 }),
    c1b: await part(sql, "EVER1", { copy: "SVC", description: "Another name", cost: 7 }),
    c2: await part(sql, "EVER2", { copy: "PARTS", description: "Screen" }),
    o3a: await part(sql, "EVER3"),
    o3b: await part(sql, "X-3", { item: "BUNN : EVER3" }),
    c3: await part(sql, "EVER3", { copy: "PARTS" }),
    c4a: await part(sql, "EVER4", { copy: "PARTS" }),
    c4b: await part(sql, "EVER4", { copy: "SVC" }),
    oh: await part(sql, "EVER5", { hidden: true }),
    c5: await part(sql, "EVER5", { copy: "PARTS", list: 9 }),
  };
  const pmId = await pm(sql);
  await machinePart(sql, pmId, ids.c1, "PARTS : EVER1");
  await machinePart(sql, pmId, ids.c1, "PARTS : EVER1");
  await sql.query("insert into part_photo_research (mpn_key, sku, mpn, verdict, image_url) values ('PARTSEVER1', 'PARTS : EVER1', 'PARTS : EVER1', 'confirmed', 'https://example.com/e1.jpg')");
  await ticket(sql, "SC-1", ["SVC : EVER1"]);
  return ids;
}

test("Clean Up Import Copies: the preview folds, fixes and lists the ambiguous ones, and writes nothing", async () => {
  const sql = await fresh();
  const ids = await copiesWorld(sql);
  await assert.rejects(() => cleanUpImportCopiesFor(sql, { apply: false }, "u-sales"), /^Error: Only an Admin can clean up import copies\.$/);
  const p = await cleanUpImportCopiesFor(sql, { apply: false }, "u-owner");
  assert.deepEqual(p.counts, { copies: 7, fold: 3, fix: 1, ambiguous: 3, done: 0, filled: 2, machineParts: 2, research: 1 });
  const line = (id) => p.lines.find((l) => l.copy.id === id);
  assert.deepEqual([line(ids.c1).status, line(ids.c1).original.id], ["fold", ids.o1]);
  assert.deepEqual(
    line(ids.c1).fills.map((f) => [f.label, f.value]),
    [
      ["Name", "Gasket"],
      ["Mfr List Price", "$20.00"],
      ["Purchase Price", "$5.00"],
    ],
    "only the blanks: the original keeps its own price",
  );
  assert.deepEqual([line(ids.c1).machineParts, line(ids.c1).research], [2, true]);
  assert.deepEqual([line(ids.c1b).status, line(ids.c1b).fills], ["fold", []], "the first copy filled the blanks already");
  assert.deepEqual([line(ids.c5).status, line(ids.c5).original.id, line(ids.c5).original.hidden], ["fold", ids.oh, true], "a hidden original still counts");
  assert.deepEqual([line(ids.c2).status, line(ids.c2).fixedSku, line(ids.c2).parent], ["fix", "EVER2", "PARTS"]);
  assert.equal(line(ids.c3).status, "ambiguous");
  assert.match(line(ids.c3).reason, /^Fits 2 parts: EVER3, X-3\./);
  assert.deepEqual([line(ids.c4a).status, line(ids.c4b).status], ["ambiguous", "ambiguous"]);
  assert.match(line(ids.c4a).reason, /^2 import copies have this number/);
  assert.equal((await row(sql, ids.c1)).hidden_at, null, "the preview wrote nothing");
});

test("Clean Up Import Copies: Confirm fills only blanks, moves PM machine parts and research, hides the copies, fixes the lonely one; usage moves; a second run changes nothing", async () => {
  const sql = await fresh();
  const ids = await copiesWorld(sql);
  const before = await loadPartUses(sql, { partIds: [ids.c1b, ids.o1] });
  assert.deepEqual(before.map((u) => u.partId), [ids.c1b], "the ticket's line is on the copy before the clean-up");

  const r = await cleanUpImportCopiesFor(sql, { apply: true }, "u-owner");
  assert.deepEqual(r.result, { folded: 3, fixed: 1, filled: 2, moved: 2, research: 1 });
  assert.deepEqual([r.counts.fold, r.counts.fix, r.counts.ambiguous, r.counts.done], [0, 0, 3, 3]);

  const o1 = await row(sql, ids.o1);
  assert.deepEqual([o1.description, Number(o1.rate), Number(o1.cost), Number(o1.list_price), o1.hidden_at], ["Gasket", 10, 5, 20, null]);
  const c1 = await row(sql, ids.c1);
  assert.equal(c1.merged_into, ids.o1);
  assert.ok(c1.hidden_at);
  assert.deepEqual([c1.hidden_by, c1.hidden_reason], ["chuy", "Import copy of PARTS : EVER1"]);
  assert.equal((await row(sql, ids.c1b)).merged_into, ids.o1);
  const oh = await row(sql, ids.oh);
  assert.deepEqual([Number(oh.list_price), oh.hidden_at != null], [9, true], "a hidden original is filled and stays hidden");
  assert.deepEqual(
    (await sql.query("select billing_item_id from machine_parts order by id")).map((m) => m.billing_item_id),
    [ids.o1, ids.o1],
  );
  const research = await sql.query("select mpn_key, sku, image_url from part_photo_research where mpn_key in ('EVER1', 'PARTSEVER1') order by mpn_key");
  assert.deepEqual(research.map((x) => [x.mpn_key, x.sku, x.image_url]), [
    ["EVER1", "EVER1", "https://example.com/e1.jpg"],
    ["PARTSEVER1", "PARTS : EVER1", "https://example.com/e1.jpg"],
  ]);
  const c2 = await row(sql, ids.c2);
  assert.deepEqual([c2.sku, c2.mfr_part, c2.parent, c2.hidden_at, c2.merged_into], ["EVER2", "EVER2", "PARTS", null, null]);
  for (const id of [ids.c3, ids.c4a, ids.c4b]) assert.deepEqual([(await row(sql, id)).hidden_at, (await row(sql, id)).merged_into], [null, null], "ambiguous copies are left");
  const after = await loadPartUses(sql, { partIds: [ids.c1b, ids.o1] });
  assert.deepEqual(
    after.map((u) => [u.partId, u.type, u.label]).sort(),
    [
      [ids.o1, "pm", null],
      [ids.o1, "service", "SC-1"],
    ].sort(),
    "the ticket's line and the PM's machine parts (moved off the copy) count on the original now",
  );

  // Again: nothing to do, nothing changes.
  const snapshot = JSON.stringify(await sql.query("select id, sku, mfr_part, description, list_price, hidden_at, merged_into from billing_items order by id"));
  const again = await cleanUpImportCopiesFor(sql, { apply: true }, "u-owner");
  assert.deepEqual(again.result, { folded: 0, fixed: 0, filled: 0, moved: 0, research: 0 });
  assert.equal(JSON.stringify(await sql.query("select id, sku, mfr_part, description, list_price, hidden_at, merged_into from billing_items order by id")), snapshot);
  // A folded copy stays hidden: Restore says where it went.
  await assert.rejects(() => restorePartsFor(sql, { ids: [ids.c1] }, "u-owner"), /That part was merged into EVER1\. It stays hidden; use EVER1\./);
});

/* ------------------------------------------------------------------ Part B */

async function mergesWorld(sql) {
  const ids = {
    keep: await part(sql, "NEW1"),
    old: await part(sql, "OLD1", { description: "Old gasket", mpn: "OLD-MPN", image: true, bins: ["A", "1", "2"], list: 30 }),
    keep2: await part(sql, "NEW2", { description: "Keep me", mpn: "K2", bins: [null, null, "E4-2"], list: 11 }),
    old2: await part(sql, "OLD2", { description: "Other name", mpn: "O2", bins: ["B", "2", "3"], list: 40, hidden: true }),
    n3: await part(sql, "NEW3"),
    o3: await part(sql, "OLD3"),
    n4: await part(sql, "NEW4"),
    hid: await part(sql, "HID5", { hidden: true }),
    o5: await part(sql, "OLD5"),
    o7: await part(sql, "OLD7"),
    c7: await part(sql, "OLD7", { copy: "PARTS" }),
  };
  const pmId = await pm(sql);
  await machinePart(sql, pmId, ids.old, "PARTS : OLD1");
  await sql.query("insert into part_photo_research (mpn_key, sku, mpn, verdict, image_url) values ('OLDMPN', 'OLD1', 'OLD-MPN', 'confirmed', 'https://example.com/old1.jpg')");
  await ticket(sql, "SC-10", ["PARTS : OLD1"]);
  await ticket(sql, "SC-11", ["PARTS : NEW1", "PARTS : OLD1"]);
  return ids;
}

const MERGE_FILE = csv([
  "old_sku,new_sku,note",
  "PARTS : OLD1,new1,Superseded by NEW1",
  "OLD2,NEW2,",
  "NOPE,NEW1,",
  "NEW1,NEW1,",
  "OLD3,NEW3,",
  "NEW3,NEW4,",
  "OLD5,HID5,",
  "OLD7,NEW4,",
  "OLD1,NEW1,again",
  ",NEW4,",
]);

test("Import Part Merges: the preview shows what fills, moves and fails, and writes nothing", async () => {
  const sql = await fresh();
  const ids = await mergesWorld(sql);
  await assert.rejects(() => importPartMergesFor(sql, { filename: "m.csv", base64: MERGE_FILE, apply: false }, "u-sales"), /^Error: Only an Admin can merge parts\.$/);
  const p = await importPartMergesFor(sql, { filename: "m.csv", base64: MERGE_FILE, apply: false }, "u-owner");
  const by = (line) => p.lines.find((l) => l.line === line);
  assert.deepEqual([by(2).status, by(2).old.id, by(2).keeper.id], ["merge", ids.old, ids.keep], "matched with the category off, any case");
  assert.deepEqual(
    by(2).fills.map((f) => [f.label, f.value]),
    [
      ["MPN", "OLD-MPN"],
      ["Name", "Old gasket"],
      ["Photo", "the old part's photo"],
      ["Bin", "Rack A · Shelf 1 · Bin 2"],
      ["Mfr List Price", "$30.00"],
    ],
  );
  assert.deepEqual([by(2).machineParts, by(2).research], [1, true]);
  assert.deepEqual([by(3).status, by(3).fills, by(3).old.hidden], ["merge", [], true], "the keeper keeps its own values; a hidden old part merges");
  assert.deepEqual(
    [3, 4, 5, 6, 7, 8, 9, 10, 11].map((line) => [line, by(line).status, by(line).error]),
    [
      [4, "error", "not_found"],
      [5, "error", "same"],
      [6, "error", "chained"],
      [7, "error", "chained"],
      [8, "error", "keeper_hidden"],
      [9, "error", "ambiguous"],
      [10, "duplicate", null],
      [11, "error", "invalid"],
      [3, "merge", null],
    ].sort((a, b) => a[0] - b[0]),
  );
  assert.match(by(9).reason, /^2 parts have OLD7: OLD7, PARTS : OLD7\. Run Clean Up Import Copies first\.$/);
  assert.match(by(6).reason, /^NEW3 is folded into another part in row 7\./);
  assert.deepEqual(p.counts, { rows: 10, merge: 2, done: 0, duplicate: 1, errors: 7, filled: 1, machineParts: 1, research: 1 });
  assert.equal((await row(sql, ids.old)).merged_into, null, "the preview wrote nothing");
});

test("Import Part Merges: Confirm fills only blanks, moves machine parts, copies research, keeps the old number and note, hides the old part; usage, the pickers and the search find the keeper; a second run changes nothing", async () => {
  const sql = await fresh();
  const ids = await mergesWorld(sql);
  const r = await importPartMergesFor(sql, { filename: "m.csv", base64: MERGE_FILE, apply: true }, "u-owner");
  assert.deepEqual(r.result, { merged: 2, keepers: 2, moved: 1, research: 1, repointed: 0 });
  assert.deepEqual(
    [2, 3, 10].map((line) => r.lines.find((l) => l.line === line).status),
    ["done", "done", "done"],
    "the file planned again: each merged row reads Already merged",
  );

  const keep = await row(sql, ids.keep);
  assert.deepEqual(
    [keep.mfr_part, keep.description, keep.photo_status, keep.image_mime, keep.bin_rack, keep.bin_shelf, keep.bin_bin, Number(keep.list_price), keep.hidden_at],
    ["OLD-MPN", "Old gasket", "confirmed", "image/png", "A", "1", "2", 30, null],
  );
  assert.ok(keep.image, "the photo came over");
  assert.deepEqual([keep.previous_numbers, keep.note], [["OLD1", "OLD-MPN"], "Superseded by NEW1"]);
  const keep2 = await row(sql, ids.keep2);
  assert.deepEqual(
    [keep2.mfr_part, keep2.description, keep2.bin_rack, keep2.bin_bin, Number(keep2.list_price), keep2.previous_numbers, keep2.note],
    ["K2", "Keep me", null, "E4-2", 11, ["OLD2", "O2"], null],
    "fill-blanks-only: the keeper's own MPN, name, bin and price stay",
  );
  const old = await row(sql, ids.old);
  assert.deepEqual([old.merged_into, old.hidden_reason, old.hidden_by], [ids.keep, "Superseded by NEW1", "chuy"]);
  const old2 = await row(sql, ids.old2);
  assert.deepEqual([old2.merged_into, old2.hidden_reason, old2.hidden_by, old2.hidden_at != null], [ids.keep2, null, null, true], "already hidden: merged, its own hide kept");
  assert.deepEqual((await sql.query("select billing_item_id from machine_parts")).map((m) => m.billing_item_id), [ids.keep]);
  assert.deepEqual(
    (await sql.query("select mpn_key, sku, mpn, image_url from part_photo_research where mpn_key = 'NEW1'")).map((x) => [x.mpn_key, x.sku, x.mpn, x.image_url]),
    [["NEW1", "NEW1", null, "https://example.com/old1.jpg"]],
  );
  for (const id of [ids.n3, ids.o3, ids.n4, ids.o5, ids.o7, ids.c7]) assert.equal((await row(sql, id)).merged_into, null, "rows with errors are left");

  // Usage: both tickets count on the keeper (SC-11 once, though it has both numbers), and so does the PM whose machine
  // part moved over.
  const uses = await loadPartUses(sql, { partIds: [ids.keep, ids.old] });
  assert.deepEqual(
    uses.map((u) => [u.partId, u.type, u.label]).sort(),
    [
      [ids.keep, "pm", null],
      [ids.keep, "service", "SC-10"],
      [ids.keep, "service", "SC-11"],
    ].sort(),
  );
  // The pickers and the Parts search find the keeper by the old number; the old part itself is hidden.
  const picked = await searchBillingItemsFor(sql, "OLD1");
  assert.deepEqual(picked.map((i) => [i.part.id, i.previousNumbers]), [[ids.keep, ["OLD1", "OLD-MPN"]]]);
  assert.deepEqual((await searchBillingItemsFor(sql, "old-mpn")).map((i) => i.part.id), [ids.keep]);
  const listed = await listPartsFor(sql, { q: "OLD1" }, "u-owner");
  assert.deepEqual(listed.rows.map((p) => [p.sku, p.previousNumbers, p.mergeNote]), [["NEW1", ["OLD1", "OLD-MPN"], "Superseded by NEW1"]]);
  const hiddenList = await listPartsFor(sql, { q: "OLD1", hidden: true }, "u-owner");
  assert.deepEqual(hiddenList.rows.map((p) => [p.sku, p.mergedInto]), [["OLD1", { id: ids.keep, sku: "NEW1" }]]);
  await assert.rejects(() => restorePartsFor(sql, { ids: [ids.old] }, "u-owner"), /merged into NEW1/);

  // Again: nothing changes.
  const snapshot = JSON.stringify(await sql.query("select id, mfr_part, description, list_price, hidden_at, merged_into, previous_numbers, note from billing_items order by id"));
  const again = await importPartMergesFor(sql, { filename: "m.csv", base64: MERGE_FILE, apply: true }, "u-owner");
  assert.deepEqual(again.result, { merged: 0, keepers: 0, moved: 0, research: 0, repointed: 0 });
  assert.equal(JSON.stringify(await sql.query("select id, mfr_part, description, list_price, hidden_at, merged_into, previous_numbers, note from billing_items order by id")), snapshot);
});

test("Import Part Merges adds its note under the keeper's note as it is when written: a line saved meanwhile stays, one it has isn't added twice, its own text is kept", async () => {
  const sql = await fresh();
  const keep = await part(sql, "NEW9");
  const keep2 = await part(sql, "NEW10");
  const keep3 = await part(sql, "NEW12");
  for (const sku of ["OLD9", "OLD10", "OLD11", "OLD12"]) await part(sql, sku);
  await sql.query("update billing_items set note = $1 where id = $2", ["Typed  by hand\n", keep]);
  await sql.query("update billing_items set note = $1 where id = $2", ["Fits Classe 9\r\nSuperseded by NEW10", keep2]);
  await sql.query("update billing_items set note = $1 where id = $2", ["   ", keep3]);
  const file = csv([
    "old_sku,new_sku,note",
    "OLD9,NEW9,Superseded by NEW9",
    "OLD10,NEW10,Superseded  by NEW10",
    "OLD11,NEW9,Superseded by NEW9",
    "OLD12,NEW12,Superseded by NEW12",
  ]);
  // Import Part Notes saves a line on NEW9 after the merge read the notes and before it writes.
  const racing = {
    query: async (text, params) => {
      if (/^\s*with pairs as/.test(text)) await sql.query("update billing_items set note = note || $1 where id = $2", ["Fits Classe 5 (source: made-up test)", keep]);
      return sql.query(text, params);
    },
  };
  const r = await importPartMergesFor(racing, { filename: "m.csv", base64: file, apply: true }, "u-owner");
  assert.equal(r.result.merged, 4);
  assert.equal((await row(sql, keep)).note, "Typed  by hand\nFits Classe 5 (source: made-up test)\nSuperseded by NEW9", "the line saved meanwhile stays, the merge's goes under it once");
  assert.equal((await row(sql, keep2)).note, "Fits Classe 9\r\nSuperseded by NEW10", "a line it already has isn't added again");
  assert.equal((await row(sql, keep3)).note, "Superseded by NEW12", "a note of only blank space is replaced");
});

test("Part B after Part A: a folded copy no longer makes a number ambiguous, and copies folded into an old part move to its keeper", async () => {
  const sql = await fresh();
  const keep = await part(sql, "NEW8");
  const old = await part(sql, "OLD8");
  const copy = await part(sql, "OLD8", { copy: "PARTS" });
  const file = csv(["old_sku,new_sku,note", "OLD8,NEW8,Replaced"]);
  const first = await importPartMergesFor(sql, { filename: "m.csv", base64: file, apply: false }, "u-owner");
  assert.deepEqual([first.lines[0].status, first.lines[0].error], ["error", "ambiguous"], "before the clean-up: two parts have OLD8");
  await cleanUpImportCopiesFor(sql, { apply: true }, "u-owner");
  assert.equal((await row(sql, copy)).merged_into, old);
  const r = await importPartMergesFor(sql, { filename: "m.csv", base64: file, apply: true }, "u-owner");
  assert.deepEqual([r.result.merged, r.result.repointed], [1, 1]);
  assert.deepEqual([(await row(sql, old)).merged_into, (await row(sql, copy)).merged_into], [keep, keep], "merged_into never chains");
  await ticket(sql, "SC-20", ["PARTS : OLD8"]);
  assert.deepEqual((await loadPartUses(sql, { partIds: [keep] })).map((u) => u.label), ["SC-20"]);
});
