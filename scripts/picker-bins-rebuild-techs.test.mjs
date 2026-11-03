// Two warehouse follow-ups (Chuy, 11/3). All data is made up.
// 1. "in the part search in the invoice section, add the search by bin. It only works in the parts section page." and
//    "I tried putting bin numbers and nothing would populate. tried breaking it done as well": every part picker (the
//    Invoice window, a ticket's Charges, repair quotes, PM machine parts) finds a part by its bin the way Parts does.
// 2. "I need to add Pedro Jr. and Pedro Sr. to the tech list. They only populate in the rebuild section. Not for service
//    calls." ... "Correct. Only rebuilds.": a tech can be on rebuilds only, and the Pedros are.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const { searchItems } = await import("../src/lib/ops/charges.ts");
const { searchBillingItemsFor } = await import("../src/lib/ops/charges-api.ts");
const { listPartsFor } = await import("../src/lib/ops/parts-api.ts");
const R = await import("../src/lib/ops/roster.ts");
const { sameTech } = await import("../src/lib/ops/tech-match.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

async function fresh(upTo = null) {
  const pg = new PGlite();
  for (const name of files.filter((n) => !upTo || n < upTo)) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await pg.query("insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'boss', true, true, 'admin')");
  return { pg, sql };
}
const applyMigration = async (pg, name) => pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));

/* ------------------------------------------------------------------ 1. bins in every part picker */

const it = (item, bin, description = "Test part") => ({ item, description, mfrPart: null, previousNumbers: [], bin });
const BINNED = [
  it("PARTS : TESTA1", { rack: "A", shelf: "03", bin: "12" }, "Test gasket"),
  it("PARTS : TESTA2", { rack: "A", shelf: "03", bin: "7" }, "Test valve"),
  it("PARTS : TESTE4", { rack: null, shelf: null, bin: "E4-2" }, "Test pump"),
  it("PARTS : TESTE43", { rack: null, shelf: null, bin: "E4 3" }, "Test o-ring"),
  it("PARTS : TEST205", { rack: null, shelf: null, bin: "205" }, "Test screen"),
];

test("a part picker finds a part by any piece of its bin, as Parts does: a bin number alone, or a bin broken down", () => {
  const found = (q, list = BINNED) => searchItems(q, list).map((i) => i.item);
  // A bin number alone, or the start of one.
  assert.deepEqual(found("205"), ["PARTS : TEST205"]);
  assert.deepEqual(found("20"), ["PARTS : TEST205"]);
  // A bin stored whole (E4-2), found by a piece of it; one stored with a space (E4 3), typed the same way.
  assert.deepEqual(found("E4"), ["PARTS : TESTE4", "PARTS : TESTE43"]);
  assert.deepEqual(found("e4 3"), ["PARTS : TESTE43"]);
  // A rack, shelf and bin broken down: the shelf and bin, or the bin alone.
  assert.deepEqual(found("03-12"), ["PARTS : TESTA1"]);
  assert.deepEqual(found("03 12"), ["PARTS : TESTA1"]);
  assert.deepEqual(found("12"), ["PARTS : TESTA1"]);
  // Its bin in words, part of it, when there is a digit in it ("03 bin 12"), as the Parts page reads the words.
  assert.deepEqual(found("03 bin 12"), ["PARTS : TESTA1"]);
  // Whole, as before: first, ahead of the parts whose bin only has it in it.
  assert.deepEqual(found("A-03-12"), ["PARTS : TESTA1"]);
  assert.deepEqual(found("E4-2"), ["PARTS : TESTE4"]);
  assert.deepEqual(found("A-03"), ["PARTS : TESTA1", "PARTS : TESTA2"]);
  assert.deepEqual(found("rack a"), ["PARTS : TESTA1", "PARTS : TESTA2"]);
  assert.deepEqual(found("Bin 205"), ["PARTS : TEST205"]);
  // A part whose number or name has what was typed comes before the parts found by a piece of their bin.
  const withNumber = [...BINNED, it("PARTS : TESTX12", null, "Test 12 oz pitcher")];
  assert.deepEqual(found("12", withNumber), ["PARTS : TESTX12", "PARTS : TESTA1"]);
  // A word alone is still a word (11/2): "bin", "rack" or "shelf" find the parts named so, not every part with a bin.
  const named = [...BINNED, it("PARTS : TESTGB", null, "Test grounds bin"), it("PARTS : TESTDR", null, "Test drip tray rack")];
  assert.deepEqual(found("bin", named), ["PARTS : TESTGB"]);
  assert.deepEqual(found("rack", named), ["PARTS : TESTDR"]);
  assert.deepEqual(found("shelf", named), []);
  // Nothing in a bin, nothing found.
  assert.deepEqual(found("C-9-9"), []);
  assert.deepEqual(found("9"), [], "one character isn't searched");
  // "Rack 1" is rack 1, whole words, not Rack 12 (11/2).
  const racks = [it("PARTS : TESTR12", { rack: "12", shelf: null, bin: null }), it("PARTS : TESTR1", { rack: "1", shelf: "2", bin: null })];
  assert.deepEqual(found("rack 1", racks), ["PARTS : TESTR1"]);
  // Whole pieces, or the bin's end, before a piece found inside another: 14-1 puts G14-1 before G14-10.
  // (The G14-10 part's name sorts first, so only the order of the matches puts the G14-1 part ahead.)
  const gs = [it("PARTS : TESTGA", { rack: null, shelf: null, bin: "G14-10" }), it("PARTS : TESTGB", { rack: null, shelf: null, bin: "G14-1" })];
  assert.deepEqual(found("14-1", gs), ["PARTS : TESTGB", "PARTS : TESTGA"]);
  assert.deepEqual(found("G14-1", gs), ["PARTS : TESTGB", "PARTS : TESTGA"]);
  assert.deepEqual(found("4-10", gs), ["PARTS : TESTGA"]);
  // A bin stored with a slash, a space or in words is read as a code, the way a typed one is.
  const stored = [it("PARTS : TESTSL", { rack: null, shelf: null, bin: "E4/2" }), it("PARTS : TESTSP", { rack: null, shelf: null, bin: "E4 3" }), it("PARTS : TESTOC", { rack: null, shelf: null, bin: "Overflow Cage" })];
  assert.deepEqual(found("E4-2", stored), ["PARTS : TESTSL"]);
  assert.deepEqual(found("e4 2", stored), ["PARTS : TESTSL"]);
  assert.deepEqual(found("E4-3", stored), ["PARTS : TESTSP"]);
  assert.deepEqual(found("overflow cage", stored), ["PARTS : TESTOC"]);
});

test("on the server, every part picker reads the same parts by bin as the Parts page does", async () => {
  const { pg, sql } = await fresh();
  try {
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind, bin_rack, bin_shelf, bin_bin) values
         ('TESTW1', 'PARTS', 'PARTS : TESTW1', 'Test gasket', 5, 'part', null, null, 'E4-2'),
         ('TESTW2', 'PARTS', 'PARTS : TESTW2', 'Test valve', 5, 'part', null, null, 'E4 3'),
         ('TESTW3', 'PARTS', 'PARTS : TESTW3', 'Test pump', 5, 'part', null, null, '205'),
         ('TESTW4', 'PARTS', 'PARTS : TESTW4', 'Test o-ring', 5, 'part', 'A', '03', '12'),
         ('TESTW5', 'PARTS', 'PARTS : TESTW5', 'Test screen', 5, 'part', null, null, null)`,
    );
    const picker = async (q) => (await searchBillingItemsFor(sql, q)).map((i) => i.part.sku).sort();
    const parts = async (q) => (await listPartsFor(sql, { q }, "u-owner")).rows.map((p) => p.sku).sort();
    for (const q of ["205", "20", "E4", "E4-2", "e4 2", "E4 3", "A-03-12", "03-12", "03 12", "12", "A-03", "Rack A", "Bin 205", "03 bin 12"]) {
      const want = await parts(q);
      assert.ok(want.length, `the Parts page finds ${q}`);
      assert.deepEqual(await picker(q), want, q);
    }
    assert.deepEqual(await picker("C-9-9"), []);
    // Stored with a slash or in words, found the same way on both (the Parts page reads the stored bin as a code too).
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind, bin_bin) values
         ('TESTSL', 'PARTS', 'PARTS : TESTSL', 'Test filter', 5, 'part', 'F7/2'),
         ('TESTOC', 'PARTS', 'PARTS : TESTOC', 'Test hopper', 5, 'part', 'Overflow Cage')`,
    );
    for (const q of ["F7-2", "f7 2", "overflow cage", "Overflow-Cage"]) {
      const want = await parts(q);
      assert.ok(want.length, `the Parts page finds ${q}`);
      assert.deepEqual(await picker(q), want, q);
    }
    // More parts found by a number made of the same digits than the server reads at once ("1-1" is also "11"): the
    // bins are read on their own, so the part in bin E11-1 still shows.
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind)
       select 'TESTNUM11' || n, 'PARTS', 'PARTS : TESTNUM11' || n, 'Test lookalike', 5, 'part' from generate_series(1, 330) n`,
    );
    await pg.query("insert into billing_items (sku, parent, item, description, rate, kind, bin_bin) values ('TESTE111', 'PARTS', 'PARTS : TESTE111', 'Test dosing valve', 5, 'part', 'E11-1')");
    assert.ok((await picker("1-1")).includes("TESTE111"), "the bin's part is read past 300 number matches");
    // The part whose number is what was typed is read first among the name matches, past 330 others (its name sorts last).
    await pg.query("insert into billing_items (sku, parent, item, description, rate, kind, mfr_part) values ('ZZTESTMFR11', 'PARTS', 'PARTS : ZZTESTMFR11', 'Test exact eleven', 5, 'part', '11')");
    assert.equal((await searchBillingItemsFor(sql, "11"))[0].part.sku, "ZZTESTMFR11");
    // And the bin typed whole is read first among the bins: past 320 parts in bins that only contain it.
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind, bin_bin)
       select 'TESTQ' || n, 'PARTS', 'PARTS : TESTQ' || n, 'Test Q filler', 5, 'part', 'Q4-1' from generate_series(1, 320) n`,
    );
    await pg.query("insert into billing_items (sku, parent, item, description, rate, kind, bin_bin) values ('ZZTESTX41', 'PARTS', 'PARTS : ZZTESTX41', 'Test exact one', 5, 'part', '4-1')");
    assert.equal((await searchBillingItemsFor(sql, "4-1"))[0].part.sku, "ZZTESTX41");
    // With more binned parts than the server reads at once, "bin" alone still finds the parts named bin, and a shelf's
    // pieces never crowd out a part whose number has what was typed.
    await pg.query(
      `insert into billing_items (sku, parent, item, description, rate, kind, bin_rack, bin_shelf, bin_bin)
       select 'TESTSHELF' || n, 'PARTS', 'PARTS : TESTSHELF' || n, 'Test shelf filler', 5, 'part', 'D', '04', n::text from generate_series(1, 320) n`,
    );
    await pg.query("insert into billing_items (sku, parent, item, description, rate, kind) values ('TESTGB', 'PARTS', 'PARTS : TESTGB', 'Test grounds bin', 5, 'part')");
    await pg.query("insert into billing_items (sku, parent, item, description, rate, kind, mfr_part) values ('ZZTESTN', 'PARTS', 'PARTS : ZZTESTN', 'Test exact number', 5, 'part', '04')");
    assert.deepEqual(await picker("bin"), ["TESTGB"]);
    assert.equal((await searchBillingItemsFor(sql, "04"))[0].part.sku, "ZZTESTN", "the part whose number it is first, then that shelf's parts");
    assert.equal((await searchBillingItemsFor(sql, "04")).length, 12);
  } finally {
    await pg.close();
  }
});

test("the server reads a bin's pieces for whatever is typed, and its words when there is a digit", () => {
  const code = src("src/lib/ops/charges-api.ts");
  assert.match(code, /\[`%\$\{code\}%`, looksLikeBinWords\(q\) \|\| \/\\d\/\.test\(q\), `%\$\{q\}%`, code\],/);
  // The stored bin read as a code: a space or slash in it is a dash, on the Parts page too.
  assert.match(src("src/lib/ops/part-bins.ts"), /export const BIN_CODE_SQL = "regexp_replace\(concat_ws\('-', bin_rack, bin_shelf, bin_bin\), '\\\\s\*\[-\/\]\\\\s\*\|\\\\s\+', '-', 'g'\)";/);
  assert.match(src("src/lib/ops/parts-api.ts"), /or \$\{BIN_CODE_SQL\} ilike \$\{binLike\}/);
  assert.match(src("src/components/desk/charges-panel.tsx"), /placeholder="Part number, words or bin…"/);
});

/* ------------------------------------------------------------------ 2. techs on rebuilds only */

test("migration 0113: a roster made before gets the column, and Pedro Jr. and Pedro Sr. on rebuilds only", async () => {
  const { pg, sql } = await fresh("0113");
  try {
    // A roster as the app made it before this change: no rebuilds_only, and one of them already there, inactive.
    await pg.exec(`create table desk_techs (id serial primary key, name text not null, active boolean not null default true,
      sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
    await pg.query("insert into desk_techs (name, active, sort_order) values ('Ryan Gloria', true, 10), ('Charles Foster', true, 20), ('pedro jr', false, 30)");
    await applyMigration(pg, "0113_rebuild_only_techs.sql");
    const rows = (await pg.query("select name, active, rebuilds_only, sort_order from desk_techs order by sort_order, id")).rows;
    assert.deepEqual(rows.map((r) => [r.name, r.active, r.rebuilds_only]), [
      ["Ryan Gloria", true, false],
      ["Charles Foster", true, false],
      ["pedro jr", true, true],
      ["Pedro Sr.", true, true],
    ]);
    assert.ok(rows[3].sort_order > 30, "added after everyone else");
    // Safe to run twice.
    await applyMigration(pg, "0113_rebuild_only_techs.sql");
    assert.equal((await pg.query("select count(*)::int as n from desk_techs")).rows[0].n, 4);
    const techs = await R.loadTechs(sql);
    assert.deepEqual(R.serviceTechs(techs).map((t) => t.name).filter((n) => /pedro/i.test(n)), []);
    assert.deepEqual(techs.filter((t) => t.active && t.rebuildsOnly).map((t) => t.name), ["pedro jr", "Pedro Sr."]);
  } finally {
    await pg.close();
  }
});

test("migration 0113 on a database with no roster yet changes nothing; the app makes the roster with the column", async () => {
  const { pg, sql } = await fresh();
  try {
    assert.equal((await pg.query("select to_regclass('desk_techs') as t")).rows[0].t, null);
    const techs = await R.loadTechs(sql);
    assert.ok(techs.length >= 9);
    assert.ok(techs.every((t) => t.rebuildsOnly === false));
    // A roster an older build made after 0113 ran: the column is added the first time it's read.
    await pg.exec("alter table desk_techs drop column rebuilds_only");
    const again = { query: sql.query };
    assert.ok((await R.loadTechs(Object.assign(async (...a) => sql(...a), again))).every((t) => t.rebuildsOnly === false));
  } finally {
    await pg.close();
  }
});

test("a tech added on rebuilds only, or switched there and back: on rebuild Owner lists only, off every service list", async () => {
  const { pg, sql } = await fresh();
  try {
    await R.addTechFor(sql, { name: "  Test   Shop Tech ", rebuildsOnly: true });
    await R.addTechFor(sql, { name: "Test Field Tech" });
    let techs = await R.loadTechs(sql);
    const shop = techs.find((t) => t.name === "Test Shop Tech");
    assert.equal(shop.rebuildsOnly, true);
    assert.equal(techs.find((t) => t.name === "Test Field Tech").rebuildsOnly, false);
    const service = R.serviceTechs(techs).map((t) => t.name);
    assert.ok(service.includes("Test Field Tech") && service.includes("Ryan Gloria"));
    assert.ok(!service.includes("Test Shop Tech"));
    // A rebuild's Owner list is every active tech: the shop tech too.
    assert.ok(techs.filter((t) => t.active).map((t) => t.name).includes("Test Shop Tech"));
    // Switched to every list, and back; added again by name, it takes what the add says.
    await R.setTechRebuildsOnlyFor(sql, { id: shop.id, rebuildsOnly: false });
    assert.ok(R.serviceTechs(await R.loadTechs(sql)).some((t) => t.name === "Test Shop Tech"));
    await R.addTechFor(sql, { name: "test shop tech", rebuildsOnly: true });
    techs = await R.loadTechs(sql);
    assert.equal(techs.filter((t) => /shop tech/i.test(t.name)).length, 1);
    assert.equal(techs.find((t) => /shop tech/i.test(t.name)).rebuildsOnly, true);
    // The same tech whatever its punctuation: no second row.
    await R.addTechFor(sql, { name: "Test Shop Tech.", rebuildsOnly: true });
    assert.equal((await R.loadTechs(sql)).filter((t) => /shop tech/i.test(t.name)).length, 1);
    await assert.rejects(() => R.setTechRebuildsOnlyFor(sql, { id: 99999, rebuildsOnly: true }), /Technician not found/);
    await assert.rejects(() => R.addTechFor(sql, { name: "   ", rebuildsOnly: true }), /Enter a technician name/);
  } finally {
    await pg.close();
  }
});

test("a name with or without its period is the same tech", () => {
  assert.equal(sameTech("Pedro Jr.", "Pedro Jr"), true);
  assert.equal(sameTech("pedro sr", "Pedro Sr."), true);
  assert.equal(sameTech("Pedro Jr.", "Pedro Sr."), false);
  assert.equal(sameTech("Josh", "Joshua Harper"), true);
});

test("service lists leave out rebuild-only techs; a rebuild's Owner list and every name shown keep them", () => {
  const roster = src("src/lib/ops/roster.ts");
  assert.match(roster, /export function serviceTechs<[^>]+>\(techs: T\[\]\): T\[\] \{\n\s+return techs\.filter\(\(t\) => t\.active && !t\.rebuildsOnly\);/);
  // Only the roster's editor changes it.
  assert.match(roster, /export const setTechRebuildsOnly = [\s\S]{0,400}await requireRosterEditor\(sql, context\.userId\);\n\s+await setTechRebuildsOnlyFor\(sql, data\);/);
  assert.match(roster, /export const addTech = [\s\S]{0,400}await requireRosterEditor\(sql, context\.userId\);\n\s+await addTechFor\(sql, data\);/);
  const select = src("src/components/desk/tech-select.tsx");
  assert.match(select, /export function activeTechNames\(techs\?: DeskTech\[\] \| null\): string\[\] \{\n\s+if \(techs\?\.length\) return serviceTechs\(techs\)\.map/);
  assert.match(select, /export function TechName[\s\S]{0,200}const active = knownTechNames\(roster\.data\?\.techs\);/);
  assert.match(select, /export function TechSelect[\s\S]{0,600}const active = activeTechNames\(techs\);/);
  // A name a service list holds but doesn't offer: "(rebuilds only)" for a rebuild-only tech, not "(inactive)".
  assert.match(select, /function offListLabel\(name: string, techs\?: DeskTech\[\] \| null\): string \{\n\s+const known = \(techs \?\? \[\]\)\.find\(\(t\) => t\.active && t\.rebuildsOnly && sameTech\(t\.name, name\)\);\n\s+if \(known\) return `\$\{known\.name\} \(rebuilds only\)`;/);
  assert.equal((select.match(/\{offListLabel\(n, techs\)\}/g) ?? []).length, 2, "the ticket's select and the boards' filter");
  assert.match(src("src/components/desk/day-board.tsx"), /const names = serviceTechs\(roster\.data\?\.techs \?\? \[\]\)\.map\(\(t\) => t\.name\);/);
  assert.match(src("src/components/desk/route-planner.tsx"), /const rosterNames = useMemo\(\(\) => serviceTechs\(roster\.data\?\.techs \?\? \[\]\)\.map\(\(t\) => t\.name\), \[roster\.data\]\);/);
  assert.match(src("src/components/desk/pre-inspection-panel.tsx"), /inspectorChoices\(reps\.data\?\.reps \?\? \[\], serviceTechs\(techs\.data\?\.techs \?\? \[\]\), inspector\)/);
  assert.match(src("src/lib/ops/api.ts"), /const activeNames = serviceTechs\(roster\)\.map\(\(t\) => t\.name\);/);
  // A rebuild's Owner list: every active tech.
  assert.match(src("src/lib/ops/rebuilds.ts"), /const techs = \(await loadTechs\(sql\)\)\.filter\(\(t\) => t\.active\);/);
  // Settings: the switch on each tech and on Add, and the Owner lists read again after a change.
  const editor = src("src/components/desk/roster-editor.tsx");
  assert.match(editor, /checked=\{t\.rebuildsOnly\}[\s\S]{0,200}onChange=\{\(e\) => scope\.mutate\(\{ id: t\.id, rebuildsOnly: e\.target\.checked, name: t\.name \}\)\}/);
  assert.match(editor, /mutationFn: \(\) => addTech\(\{ data: \{ name, rebuildsOnly \} \}\)/);
  assert.match(editor, /const refreshLists = \(\) => void qc\.invalidateQueries\(\{ queryKey: \["rebuild-owners"\] \}\);/);
  assert.equal((editor.match(/refreshLists\(\);/g) ?? []).length, 3);
  assert.match(editor, /aria-label=\{`\$\{t\.name\}: rebuilds only`\}/);
  assert.match(editor, /\{t\.name\} \(inactive\{t\.rebuildsOnly \? ", rebuilds only" : ""\}\)/);
  assert.match(roster, /where table_schema = current_schema\(\) and table_name = 'desk_techs' and column_name = 'rebuilds_only'/);
});
