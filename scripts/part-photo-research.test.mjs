// Import Photo Research (10/28, Grok through Chuy): researched part photos from a CSV, Admin only. Rows are matched to
// a part's MPN or SKU like Parts and the photo route match them; only a part with no research gets a row, research
// already on file is never changed or taken over, and a part's photo is never touched. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const r = await import("../src/lib/ops/part-photo-research.ts");
const { importPhotoResearchFor } = await import("../src/lib/ops/part-photo-research-api.ts");
const { listPartsFor } = await import("../src/lib/ops/parts-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'), ('u-grok', 'grokatron', true, false, 'admin'),
       ('u-sales', 'ana', true, false, 'sales'), ('u-tech', 'melinda', true, false, 'service'), ('u-new', 'pending', false, false, 'admin')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  return { pg, sql: { query } };
}

const csv = (rows) =>
  Buffer.from(
    rows.map((row) => row.map((v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""))).join(",")).join("\r\n") + "\r\n",
    "utf8",
  ).toString("base64");
const HEAD = ["mpn_key", "part_number", "image_url", "source_page", "status", "notes"];
const PT = "https://partstown.sirv.com/products/";

/* ------------------------------------------------------------------ the plain part */

test("the key drops case, spaces and punctuation, as Parts matches it", () => {
  assert.equal(r.mpnKey("BUNN 32400.0003"), "BUNN324000003");
  assert.equal(r.mpnKey("fe-1024.00020.00"), "FE10240002000");
  assert.equal(r.mpnKey(null), "");
});

test("addresses: https on a named public host only", () => {
  assert.equal(r.safeHttpsUrl(`${PT}BU/BU32400.0003.view?w=800`), `${PT}BU/BU32400.0003.view?w=800`);
  assert.equal(r.safeHttpsUrl("  https://www.partstown.com/bunn/bu32400-0003  "), "https://www.partstown.com/bunn/bu32400-0003");
  for (const bad of [
    "http://www.partstown.com/x.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "https://127.0.0.1/x.jpg",
    "https://10.0.0.8/x.jpg",
    "https://[::1]/x.jpg",
    "https://localhost/x.jpg",
    "https://printer.local/x.jpg",
    "https://db.internal/x.jpg",
    "https://intranet/x.jpg",
    "https://user:pw@partstown.com/x.jpg",
    "partstown.com/x.jpg",
    `https://partstown.com/${"a".repeat(2100)}`,
    "",
    null,
  ]) {
    assert.equal(r.safeHttpsUrl(bad), null, String(bad).slice(0, 40));
  }
  assert.equal(r.siteOf("https://www.partstown.com/bunn/x"), "partstown.com");
});

test("the file: the six columns in any order and spelling; the key falls back to part_number; blank rows skipped", () => {
  const sheet = (matrix) => [{ name: "Sheet1", matrix }];
  const { rows } = r.researchRowsFromSheets(
    sheet([
      ["Status", "Image URL", "Part Number", "MPN Key", "Source Page", "Notes"],
      ["Confirmed", `${PT}a.jpg`, "32400.0003", "BUNN32400.0003", "https://www.partstown.com/bunn/bu32400-0003", "3 sites agree"],
      ["", "", "", "", "", ""],
      ["review", "", "05515.0000", "", "", ""],
    ]),
  );
  assert.deepEqual(
    rows.map((x) => [x.line, x.key, x.partNumber, x.verdict, x.notes]),
    [
      [2, "BUNN324000003", "32400.0003", "confirmed", "3 sites agree"],
      [4, "055150000", "05515.0000", "review", null],
    ],
  );
  assert.throws(() => r.researchRowsFromSheets(sheet([["mpn_key", "status"], ["X1", "review"]])), /mpn_key \(or part_number\), image_url and status/);
  assert.throws(() => r.researchRowsFromSheets(sheet([["sku", "price"], ["X1", "3"]])), /needs the columns/);
});

test("the plan: add, duplicate (on file, under the part's other number, or twice), no match, bad URL, bad status, no key", () => {
  const parts = [
    { id: 1, sku: "BUNN32400.0003", description: "Timer kit", mfrPart: "32400.0003", hasPhoto: false, mpnKey: "324000003", skuKey: "BUNN324000003" },
    { id: 2, sku: "324000003", description: "Look-alike by SKU", mfrPart: null, hasPhoto: true, mpnKey: "", skuKey: "324000003" },
    { id: 3, sku: "FETCO52018", description: "Relay", mfrPart: "52018", hasPhoto: true, mpnKey: "52018", skuKey: "FETCO52018" },
    { id: 4, sku: "Q-9", description: "Valve", mfrPart: "MPN9", hasPhoto: false, mpnKey: "MPN9", skuKey: "Q9" },
    { id: 5, sku: "MPN-9", description: "Old valve", mfrPart: "OLD-Q", hasPhoto: false, mpnKey: "OLDQ", skuKey: "MPN9" },
  ];
  const row = (key, verdict, imageUrl, extra = {}) => ({ line: 0, key, partNumber: null, imageUrl, sourcePage: null, verdict, notes: null, ...extra });
  const plan = r.planResearch(
    [
      row("BUNN324000003", "confirmed", `${PT}a.jpg`),
      row("324000003", "confirmed", `${PT}b.jpg`),
      row("FETCO52018", "review", null),
      row("FETCO52018", "review", null),
      row("NOPE1", "confirmed", `${PT}c.jpg`),
      row("52018", "confirmed", "http://partstown.com/d.jpg"),
      row("52018", "confirmed", null),
      row("52018", "review", null, { sourcePage: "javascript:alert(1)" }),
      row("52018", "maybe", `${PT}e.jpg`),
      row("", "confirmed", `${PT}f.jpg`),
      row("OLD1", "confirmed", `${PT}g.jpg`),
      row("52018", "confirmed", `${PT}h.jpg`),
      row("MPN9", "confirmed", `${PT}i.jpg`),
      row("Q9", "review", null),
    ],
    parts,
    new Set(["OLD1", "FETCO52018", "OLDQ"]),
  );
  assert.deepEqual(
    plan.map((l) => [l.key, l.status, l.part?.id ?? null]),
    [
      ["BUNN324000003", "add", 1],
      ["324000003", "duplicate", 1],
      ["FETCO52018", "duplicate", 3],
      ["FETCO52018", "duplicate", 3],
      ["NOPE1", "no_match", null],
      ["52018", "bad_url", 3],
      ["52018", "bad_url", 3],
      ["52018", "bad_url", 3],
      ["52018", "bad_status", 3],
      ["", "no_key", null],
      ["OLD1", "duplicate", null],
      ["52018", "duplicate", 3],
      ["MPN9", "duplicate", 4],
      ["Q9", "add", 4],
    ],
  );
  assert.equal(plan[0].researched, false);
  assert.match(plan[1].reason, /already earlier in the file/, "the timer by its MPN after the timer by its SKU: one row per part");
  assert.equal(plan[2].researched, true, "the relay already has research under its SKU");
  assert.match(plan[2].reason, /Already researched: left/);
  assert.match(plan[3].reason, /Twice in the file/);
  // Parts reads a part's research by its MPN first: a new row under the relay's MPN would take over its SKU's research.
  assert.equal(plan[11].researched, true);
  assert.match(plan[11].reason, /under the part's other number/);
  assert.equal(plan[12].researched, false, "the valve itself has none");
  assert.match(plan[12].reason, /^MPN-9 has this number and research already/);
  assert.deepEqual(r.researchCounts(plan), { add: 2, duplicate: 6, noMatch: 1, badUrl: 3, badStatus: 1, noKey: 1 });
});

/* ------------------------------------------------------------------ the database */

async function parts(pg) {
  const add = (sku, mfr, description, image = null) =>
    pg.query("insert into billing_items (sku, item, description, mfr_part, kind, image, image_updated_at) values ($1, $2, $3, $4, 'part', $5, $6) returning id", [
      sku,
      `PARTS : ${sku}`,
      description,
      mfr,
      image,
      image ? new Date() : null,
    ]);
  await add("BUNN32400.0003", "32400.0003", "Timer kit, digital"); // its SKU key BUNN324000003 is already researched by 0070
  await add("ZT-FLT100", "WF-100", "Water filter cartridge");
  await add("ZT-GSK20", "GH-20", "Group head gasket");
  await add("ZT-PHOTO", "HP-1", "Has a photo already", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await add("ZT-SCR8", "SS-8", "Shower screen");
}

const FILE = [
  HEAD,
  ["WF100", "WF-100", `${PT}WF100.jpg`, "https://www.partstown.com/zt/wf-100", "confirmed", "3 sites agree"],
  ["", "GH-20", `${PT}GH20.jpg`, "", "Confirmed", ""],
  ["HP1", "HP-1", `${PT}HP1.jpg`, "", "confirmed", ""],
  ["SS8", "SS-8", "", "", "review", "Only Parts Town has it"],
  ["BUNN324000003", "32400.0003", `${PT}timer.jpg`, "", "confirmed", "A second try"],
  ["NOPART9", "NOPART-9", `${PT}none.jpg`, "", "confirmed", ""],
  ["WF100", "WF-100", `${PT}again.jpg`, "", "confirmed", ""],
  ["XYZ", "XYZ", "http://partstown.com/x.jpg", "", "confirmed", ""],
];

test("only an Admin (the Admin role or a desk admin, approved) can preview or save", async () => {
  const { pg, sql } = await fresh();
  try {
    await parts(pg);
    const data = { filename: "research.csv", base64: csv(FILE), apply: false };
    for (const who of ["u-sales", "u-tech", "u-new", "u-nobody"]) {
      await assert.rejects(() => importPhotoResearchFor(sql, data, who), /Only an Admin can import photo research/, who);
    }
    assert.equal((await importPhotoResearchFor(sql, data, "u-owner")).rowCount, 8);
    assert.equal((await importPhotoResearchFor(sql, data, "u-grok")).rowCount, 8, "the Admin role without the desk-admin flag");
  } finally {
    await pg.close();
  }
});

test("the preview writes nothing; Save adds only new keys on a part, never changes research on file or a part's photo", async () => {
  const { pg, sql } = await fresh();
  try {
    await parts(pg);
    const count = async () => (await pg.query("select count(*)::int n from part_photo_research")).rows[0].n;
    const before = await count();
    const timerBefore = (await pg.query("select * from part_photo_research where mpn_key = 'BUNN324000003'")).rows[0];
    const preview = await importPhotoResearchFor(sql, { filename: "research.csv", base64: csv(FILE), apply: false }, "u-grok");
    assert.deepEqual(
      [preview.add, preview.duplicate, preview.noMatch, preview.badUrl, preview.badStatus, preview.noKey, preview.applied],
      [4, 2, 1, 1, 0, 0, false],
    );
    assert.equal(await count(), before, "the preview writes nothing");
    const line = (key) => preview.lines.find((l) => l.key === key);
    assert.deepEqual([line("WF100").part.sku, line("WF100").hasPhoto, line("WF100").researched], ["ZT-FLT100", false, false]);
    assert.equal(line("HP1").hasPhoto, true);
    assert.equal(line("GH20").status, "add", "the key comes from part_number when mpn_key is blank");
    assert.equal(line("BUNN324000003").status, "duplicate");
    assert.equal(line("BUNN324000003").part.sku, "BUNN32400.0003");
    assert.equal(preview.lines[0].status, "add", "rows to add first");

    const pullBefore = (await listPartsFor(sql, {}, "u-owner")).readyToPull;
    const saved = await importPhotoResearchFor(sql, { filename: "research.csv", base64: csv(FILE), apply: true }, "u-grok");
    assert.deepEqual([saved.add, saved.duplicate, saved.noMatch, saved.badUrl, saved.applied], [4, 2, 1, 1, true]);
    assert.equal(await count(), before + 4);
    const wf = (await pg.query("select * from part_photo_research where mpn_key = 'WF100'")).rows[0];
    assert.equal(wf.sku, "ZT-FLT100");
    assert.equal(wf.mpn, "WF-100");
    assert.equal(wf.verdict, "confirmed");
    assert.equal(wf.image_url, `${PT}WF100.jpg`);
    assert.equal(wf.reason, "3 sites agree (Imported from research.csv by grokatron.)");
    assert.deepEqual(wf.candidates, [{ imageUrl: `${PT}WF100.jpg`, pageUrl: "https://www.partstown.com/zt/wf-100", site: "partstown.com", mpnShown: "WF-100", watermark: null }]);
    const ss = (await pg.query("select verdict, image_url, candidates from part_photo_research where mpn_key = 'SS8'")).rows[0];
    assert.deepEqual([ss.verdict, ss.image_url, ss.candidates], ["review", null, []], "a review row may have no image");
    assert.deepEqual((await pg.query("select * from part_photo_research where mpn_key = 'BUNN324000003'")).rows[0], timerBefore, "research on file is unchanged");
    assert.equal((await pg.query("select count(*)::int n from billing_items where image is not null")).rows[0].n, 1, "no photo goes on a part");
    // Pull Confirmed Photos counts the confirmed rows whose part has no photo: the filter and the gasket, not HP-1.
    assert.equal((await listPartsFor(sql, {}, "u-owner")).readyToPull, pullBefore + 2);

    // The same file again adds nothing.
    const again = await importPhotoResearchFor(sql, { filename: "research.csv", base64: csv(FILE), apply: true }, "u-grok");
    assert.deepEqual([again.add, again.duplicate], [0, 6]);
  } finally {
    await pg.close();
  }
});

test("a part with research under its other number keeps it, and a part twice in a file gets only its first row", async () => {
  const { pg, sql } = await fresh();
  try {
    await parts(pg);
    const timer = async () => (await listPartsFor(sql, { q: "32400.0003" }, "u-owner")).rows[0].research;
    const before = await timer();
    assert.equal(before.verdict, "confirmed", "0070's research for the timer, under its SKU");
    const file = csv([
      HEAD,
      ["324000003", "32400.0003", `${PT}timer2.jpg`, "", "confirmed", "The timer by its MPN"],
      ["ZTFLT100", "", `${PT}flt-sku.jpg`, "", "confirmed", "The filter by its SKU"],
      ["WF100", "WF-100", `${PT}flt-mpn.jpg`, "", "confirmed", "The filter again, by its MPN"],
    ]);
    const saved = await importPhotoResearchFor(sql, { filename: "b.csv", base64: file, apply: true }, "u-owner");
    assert.deepEqual([saved.add, saved.duplicate], [1, 2]);
    const keys = (await pg.query("select mpn_key from part_photo_research where mpn_key in ('324000003', 'ZTFLT100', 'WF100') order by 1")).rows;
    assert.deepEqual(keys.map((k) => k.mpn_key), ["ZTFLT100"]);
    assert.deepEqual(await timer(), before, "the timer still reads its research on file");
    const filter = (await listPartsFor(sql, { q: "ZT-FLT100" }, "u-owner")).rows[0].research;
    assert.equal(filter.imageUrl, `${PT}flt-sku.jpg`, "the first row for the filter counts");
  } finally {
    await pg.close();
  }
});

test("a key added between the preview and Save counts as a duplicate and stays as it was", async () => {
  const { pg, sql } = await fresh();
  try {
    await parts(pg);
    const file = csv([HEAD, ["WF100", "WF-100", `${PT}WF100.jpg`, "", "confirmed", ""], ["GH20", "GH-20", `${PT}GH20.jpg`, "", "confirmed", ""]]);
    const preview = await importPhotoResearchFor(sql, { filename: "a.csv", base64: file, apply: false }, "u-owner");
    assert.equal(preview.add, 2);
    await pg.query("insert into part_photo_research (mpn_key, sku, verdict, reason) values ('WF100', 'ZT-FLT100', 'review', 'Someone else')");
    const saved = await importPhotoResearchFor(sql, { filename: "a.csv", base64: file, apply: true }, "u-owner");
    assert.deepEqual([saved.add, saved.duplicate], [1, 1]);
    assert.equal((await pg.query("select reason from part_photo_research where mpn_key = 'WF100'")).rows[0].reason, "Someone else");
  } finally {
    await pg.close();
  }
});

test("up to 500 rows a file, and a file without the columns says which it needs", async () => {
  const { pg, sql } = await fresh();
  try {
    await parts(pg);
    const big = [HEAD, ...Array.from({ length: 501 }, (_, i) => [`K${i}`, `K-${i}`, `${PT}${i}.jpg`, "", "confirmed", ""])];
    await assert.rejects(() => importPhotoResearchFor(sql, { filename: "big.csv", base64: csv(big), apply: false }, "u-owner"), /Up to 500 rows at a time; this file has 501/);
    const ok = await importPhotoResearchFor(sql, { filename: "max.csv", base64: csv(big.slice(0, 501)), apply: false }, "u-owner");
    assert.equal(ok.rowCount, 500);
    await assert.rejects(() => importPhotoResearchFor(sql, { filename: "x.csv", base64: csv([["sku", "photo"], ["A", "B"]]), apply: false }, "u-owner"), /needs the columns/);
    await assert.rejects(() => importPhotoResearchFor(sql, { filename: "x.csv", base64: csv([HEAD]), apply: false }, "u-owner"), /No rows under the header/);
  } finally {
    await pg.close();
  }
});
