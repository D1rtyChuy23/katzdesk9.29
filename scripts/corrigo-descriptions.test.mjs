// Corrigo descriptions (Grok's proposal, approved by Chuy 11/10): a cut-off or reformatted description doesn't
// overwrite a fuller one, and installs and PMs take Corrigo's Problem Description as their Description of work when
// it is blank. Made-up accounts and text only; the shapes copy the 11/9 report (WO-1027, WO-1039).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const C = await import("../src/lib/ops/corrigo.ts");
const { applyCorrigoRows, previewCorrigoRecords } = await import("../src/lib/ops/corrigo-import.ts");
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// A stored plain description, and the report's segmented copy of it, cut mid-word at about 105 characters (WO-1039).
const PLAIN = "Replace filtration. Call location prior to visit. Replace parts as needed, descale the boiler and test every group before leaving the site.";
const SEGMENTED = "ZZ Test Brewer XL:OTHER:Replace filtration. Call location prior to visit. Replace parts as;ZZ Test Grinder Q:OTHER:descale the boil";
// A long plain description, and the report's copy cut with "..." at 254 characters (WO-1027).
const LONG =
  "Customer reports the espresso machine trips the breaker when the steam boiler heats. Check the heating element, the pressurestat and the wiring at the terminal block. " +
  "Replace the element if it reads open or shorted to ground. Bring a spare pressurestat and two boiler gaskets. Test steam and brew pressure before closing out the call, and leave the old parts with the manager.";
const CUT = `${LONG.slice(0, 251)}...`;

test("the cut-off test: a trailing ellipsis or the report's 250-character cap", () => {
  assert.equal(CUT.length, 254);
  assert.equal(C.looksCutOff(CUT), true);
  assert.equal(C.looksCutOff("Replace the gasket…"), true);
  assert.equal(C.looksCutOff("x".repeat(250)), true);
  assert.equal(C.looksCutOff("x".repeat(256)), true);
  // A Detail View export runs past the report's cap: whole, not cut.
  assert.equal(C.looksCutOff("x".repeat(257)), false);
  assert.equal(C.looksCutOff("x".repeat(392)), false);
  assert.equal(C.looksCutOff("Replace the gasket."), false);
  assert.equal(C.looksCutOff(""), false);
});

test("Corrigo's text adds nothing new when its words are the stored words, in order, whatever the format", () => {
  assert.equal(C.addsNothingNew(SEGMENTED, PLAIN), true, "WO-1039: segmented and cut mid-word");
  assert.equal(C.addsNothingNew(CUT, LONG), true, "WO-1027: cut with ...");
  assert.equal(C.addsNothingNew("  replace FILTRATION.  call location ", PLAIN), true, "spacing and capitals");
  assert.equal(C.addsNothingNew(PLAIN, PLAIN), true);
  assert.equal(C.addsNothingNew(`${LONG.slice(0, 200)} and bring a ladder...`, LONG), false, "cut, with a new word");
  assert.equal(C.addsNothingNew("Replace filtration. Call the manager first.", PLAIN), false, "a real edit");
  assert.equal(C.addsNothingNew("prior to visit. Call location", PLAIN), false, "the words out of order");
  assert.equal(C.addsNothingNew(PLAIN, ""), false, "nothing stored");
  assert.equal(C.addsNothingNew("", PLAIN), false, "nothing in the file");
  // A description that really ends in "..." goes through when it says something new.
  assert.equal(C.addsNothingNew("Water leak under the cart, see photos...", PLAIN), false);
});

test("Corrigo's segments read one line each, with the machine's name", () => {
  assert.equal(C.descriptionLines(SEGMENTED), "ZZ Test Brewer XL: Replace filtration. Call location prior to visit. Replace parts as\nZZ Test Grinder Q: descale the boil");
  assert.equal(C.descriptionLines("ZZ Test Brewer:OTHER:Set up and test;;"), "ZZ Test Brewer: Set up and test");
  // Plain text is kept as it is, semicolons and colons included.
  assert.equal(C.descriptionLines("Note: call ahead; bring the filter"), "Note: call ahead; bring the filter");
  assert.equal(C.descriptionLines("  "), null);
  assert.equal(C.descriptionLines(null), null);
});

test("what a description update does, with the note the preview shows", () => {
  assert.deepEqual(C.descriptionRefresh("Description", SEGMENTED, PLAIN), {
    change: null,
    note: { text: `Description kept: Corrigo's text adds nothing new (${PLAIN.length} → ${SEGMENTED.length} characters)`, warn: false },
  });
  assert.deepEqual(C.descriptionRefresh("Description", CUT, LONG).change, null);
  const cutAndNew = `${LONG.slice(0, 200)} and bring a ladder...`;
  assert.deepEqual(C.descriptionRefresh("Description", cutAndNew, LONG), {
    change: null,
    note: { text: "Description kept: Corrigo's text is cut off and differs. Check it", warn: true },
  });
  // A full Detail View text with new words, 392 characters: updated, and not taken as cut.
  const detail = `${LONG.slice(0, 340)} Also replace the drip tray sensor and the cup rail.`.slice(0, 392);
  assert.ok(detail.length > 256 && detail.length <= 392, String(detail.length));
  assert.deepEqual(C.descriptionRefresh("Description", detail, LONG.slice(0, 120)), { change: { from: LONG.slice(0, 120), to: detail }, note: null });
  // A real edit that's shorter updates, with a warning.
  assert.deepEqual(C.descriptionRefresh("Description", "Call the manager first.", PLAIN), {
    change: { from: PLAIN, to: "Call the manager first." },
    note: { text: `Description is shorter in Corrigo (${PLAIN.length} → 23 characters)`, warn: true },
  });
  // Nothing stored: the file's text goes in as it is, "..." included.
  assert.deepEqual(C.descriptionRefresh("Description", CUT, null), { change: { from: null, to: CUT }, note: null });
  assert.deepEqual(C.descriptionRefresh("Description", "", PLAIN), { change: null, note: null });
  assert.deepEqual(C.descriptionRefresh("Description", ` ${PLAIN} `, PLAIN), { change: null, note: null });
});

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  await query("insert into directory_customers (name) values ('ZZ Test Diner'), ('ZZ Test Cafe')");
  return { pg, sql, query };
}
const file = (rows) => C.parseCorrigoMatrix([["ST#", "Operational Status", "Customer Name", "Type", "Problem Description", "P.O. #"], ...rows]).records;
const one = (preview, wo) => preview.rows.find((r) => r.canonicalWo === wo);

test("a ticket keeps its fuller description; a cut-off copy that says something new is kept back and flagged", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    const ticket = async (wo, issue) =>
      Number((await query("insert into service_jobs (kind, call_id, customer, wo, status, received, issue) values ('service', $1, 'ZZ Test Diner', $1, 'Open', current_date, $2) returning id", [wo, issue]))[0].id);
    const a = await ticket("WO-1039", PLAIN);
    const b = await ticket("WO-1027", LONG);
    const c = await ticket("WO-1028", LONG);
    const preview = await previewCorrigoRecords(sql, file([
      ["1039", "Open", "ZZ Test Diner", "Request", SEGMENTED, ""],
      ["1027", "Open", "ZZ Test Diner", "Request", CUT, ""],
      ["1028", "Open", "ZZ Test Diner", "Request", `${LONG.slice(0, 200)} and bring a ladder...`, ""],
    ]));
    assert.deepEqual([one(preview, "WO-1039").issueChange, one(preview, "WO-1027").issueChange, one(preview, "WO-1028").issueChange], [null, null, null]);
    assert.deepEqual(one(preview, "WO-1039").descriptionNotes, [{ text: `Description kept: Corrigo's text adds nothing new (${PLAIN.length} → ${SEGMENTED.length} characters)`, warn: false }]);
    assert.deepEqual(one(preview, "WO-1028").descriptionNotes, [{ text: "Description kept: Corrigo's text is cut off and differs. Check it", warn: true }]);
    await applyCorrigoRows(sql, preview.rows, "boss");
    const issueOf = async (id) => (await query("select issue from service_jobs where id = $1", [id]))[0].issue;
    assert.deepEqual([await issueOf(a), await issueOf(b), await issueOf(c)], [PLAIN, LONG, LONG]);
  } finally {
    await pg.close();
  }
});

test("a new PM and a new install take Corrigo's Problem Description as their Description of work, one line per segment", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    const preview = await previewCorrigoRecords(sql, file([
      ["1056", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Quarterly PM;ZZ Test Grinder Q:OTHER:Check burrs", ""],
      ["1054", "Open", "ZZ Test Cafe", "Request", "ZZ Test Brewer XL:OTHER:Install new brewer and test", "Install"],
    ]));
    const pm = one(preview, "WO-1056");
    const inst = one(preview, "WO-1054");
    assert.deepEqual([pm.board, pm.action, inst.board, inst.action], ["pm", "create", "install", "create"]);
    assert.equal(pm.workDoneFill, "ZZ Test Brewer XL: Quarterly PM\nZZ Test Grinder Q: Check burrs");
    assert.deepEqual(pm.descriptionNotes, [{ text: "Description of work ← Corrigo's Problem Description", warn: false }]);
    await applyCorrigoRows(sql, preview.rows, "boss");
    assert.equal((await query("select work_done from pm_jobs where wo = 'WO-1056'"))[0].work_done, "ZZ Test Brewer XL: Quarterly PM\nZZ Test Grinder Q: Check burrs");
    assert.equal((await query("select work_done from installs where wo = 'WO-1054'"))[0].work_done, "ZZ Test Brewer XL: Install new brewer and test");
  } finally {
    await pg.close();
  }
});

test("an existing PM or install takes it only when its Description of work is blank, even if someone types in it after the preview", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    const pm = async (wo, workDone) => Number((await query("insert into pm_jobs (customer, status, wo, work_done) values ('ZZ Test Diner', 'Scheduled', $1, $2) returning id", [wo, workDone]))[0].id);
    const blank = await pm("WO-0896", null);
    const spaces = await pm("WO-6325", "   ");
    const typed = await pm("WO-6441", "Typed by the tech: replaced the gasket.");
    const late = await pm("WO-9916", null);
    const install = Number((await query("insert into installs (customer, wo, work_done) values ('ZZ Test Cafe', 'WO-1055', null) returning id"))[0].id);
    const preview = await previewCorrigoRecords(sql, file([
      ["0896", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Quarterly PM", ""],
      ["6325", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Quarterly PM", ""],
      ["6441", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Quarterly PM", ""],
      ["9916", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Quarterly PM", ""],
      ["1055", "Open", "ZZ Test Cafe", "Request", "Install new brewer", "Install"],
    ]));
    assert.deepEqual(one(preview, "WO-0896").descriptionNotes, [{ text: "Description of work ← Corrigo's Problem Description (blank today)", warn: false }]);
    assert.deepEqual(one(preview, "WO-6441").descriptionNotes, [{ text: "Description of work kept: it already has text", warn: false }]);
    assert.equal(one(preview, "WO-1055").board, "install");
    // Typed after the preview, before Confirm.
    await query("update pm_jobs set work_done = 'Typed after the preview.' where id = $1", [late]);
    await applyCorrigoRows(sql, preview.rows, "boss");
    const workOf = async (table, id) => (await query(`select work_done from ${table} where id = $1`, [id]))[0].work_done;
    assert.deepEqual(
      [await workOf("pm_jobs", blank), await workOf("pm_jobs", spaces), await workOf("pm_jobs", typed), await workOf("pm_jobs", late), await workOf("installs", install)],
      ["ZZ Test Brewer XL: Quarterly PM", "ZZ Test Brewer XL: Quarterly PM", "Typed by the tech: replaced the gasket.", "Typed after the preview.", "Install new brewer"],
    );
  } finally {
    await pg.close();
  }
});

test("Corrigo's Work Done, when a file has it, wins over the Problem Description, and a cut-off copy doesn't overwrite a fuller one", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    await query("insert into service_jobs (kind, call_id, customer, wo, status, received, work_done) values ('service', 'WO-2001', 'ZZ Test Diner', 'WO-2001', 'Open', current_date, $1)", [LONG]);
    const records = C.parseCorrigoMatrix([
      ["ST#", "Operational Status", "Customer Name", "Type", "Problem Description", "Work Done"],
      ["2001", "Open", "ZZ Test Diner", "Request", "Breaker trips", CUT],
      ["2002", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Quarterly PM", "Replaced the gasket."],
    ]).records;
    const preview = await previewCorrigoRecords(sql, records);
    assert.equal(one(preview, "WO-2001").workDone, null);
    assert.deepEqual(one(preview, "WO-2001").descriptionNotes, [{ text: `Description of work kept: Corrigo's text adds nothing new (${LONG.length} → ${CUT.length} characters)`, warn: false }]);
    assert.equal(one(preview, "WO-2002").workDoneFill, null);
    await applyCorrigoRows(sql, preview.rows, "boss");
    assert.equal((await query("select work_done from service_jobs where wo = 'WO-2001'"))[0].work_done, LONG);
    assert.equal((await query("select work_done from pm_jobs where wo = 'WO-2002'"))[0].work_done, "Replaced the gasket.");
  } finally {
    await pg.close();
  }
});

test("the preview shows each note, counts them, and lists the warned ones under Warnings only", () => {
  const screen = src("src/components/desk/corrigo-import.tsx");
  assert.match(screen, /for \(const n of r\.descriptionNotes \?\? \[\]\) items\.push\(\{ text: n\.text, warn: n\.warn \}\);/);
  assert.match(screen, /\|\| !!r\.descriptionNotes\?\.some\(\(n\) => n\.warn\)/);
  assert.match(screen, /data-testid="corrigo-description-notes"/);
});
