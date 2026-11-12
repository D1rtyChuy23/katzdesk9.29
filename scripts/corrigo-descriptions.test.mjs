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

// Chuy, 11/10 (option 2): a Description of work filled from a cut-off Problem Description takes a later, fuller one.
// Text that says something Corrigo's doesn't (a tech's own words) stays.
test("a fill that was cut off takes Corrigo's fuller text later; a tech's own words stay", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    const pm = async (wo, workDone) => Number((await query("insert into pm_jobs (customer, status, wo, work_done) values ('ZZ Test Diner', 'Scheduled', $1, $2) returning id", [wo, workDone]))[0].id);
    const cut = await pm("WO-3001", "ZZ Test Brewer XL: Clean and replace the System 3 filte");
    const typed = await pm("WO-3002", "Tech: replaced the System 3 filter and the gasket.");
    const same = await pm("WO-3003", "ZZ Test Brewer XL: Clean and replace the System 3 filter");
    const late = await pm("WO-3004", "ZZ Test Brewer XL: Clean and replace the System 3 filte");
    const segs = [
      "ZZ Test Brewer XL:OTHER:Clean/Replac...",
      "ZZ Test Brewer XL:OTHER:Clean and replace the System 3 filter, then test brew volumes",
    ];
    const install = Number((await query("insert into installs (customer, wo, work_done) values ('ZZ Test Cafe', 'WO-3005', $1) returning id", ["ZZ Test Brewer XL: Clean/Replac..."]))[0].id);
    const preview = await previewCorrigoRecords(sql, file([
      ["3001", "Open", "ZZ Test Diner", "PM", segs[1], ""],
      ["3002", "Open", "ZZ Test Diner", "PM", segs[1], ""],
      ["3003", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Clean and replace the System 3 filter", ""],
      ["3004", "Open", "ZZ Test Diner", "PM", segs[1], ""],
      ["3005", "Open", "ZZ Test Cafe", "Request", segs[1], "Install"],
    ]));
    const full = "ZZ Test Brewer XL: Clean and replace the System 3 filter, then test brew volumes";
    assert.equal(one(preview, "WO-3001").workDoneFill, full);
    assert.equal(one(preview, "WO-3001").workDoneFrom, "ZZ Test Brewer XL: Clean and replace the System 3 filte");
    assert.deepEqual(one(preview, "WO-3001").descriptionNotes, [{ text: "Description of work ← Corrigo's fuller Problem Description (55 → 80 characters)", warn: false }]);
    assert.deepEqual([one(preview, "WO-3002").workDoneFill, one(preview, "WO-3002").workDoneFrom], [null, null]);
    assert.deepEqual(one(preview, "WO-3002").descriptionNotes, [{ text: "Description of work kept: it already has text", warn: false }]);
    assert.deepEqual([one(preview, "WO-3003").workDoneFill, one(preview, "WO-3003").descriptionNotes], [null, null]);
    assert.equal(one(preview, "WO-3005").board, "install");
    // "Clean/Replac..." is other wording, not the start of Corrigo's text: it stays (11/12 review).
    assert.equal(one(preview, "WO-3005").workDoneFill, null);
    // Someone edits WO-3004 after the preview: their text stays.
    await query("update pm_jobs set work_done = 'Edited after the preview.' where id = $1", [late]);
    await applyCorrigoRows(sql, preview.rows, "boss");
    const workOf = async (table, id) => (await query(`select work_done from ${table} where id = $1`, [id]))[0].work_done;
    assert.deepEqual(
      [await workOf("pm_jobs", cut), await workOf("pm_jobs", typed), await workOf("pm_jobs", same), await workOf("pm_jobs", late), await workOf("installs", install)],
      [full, "Tech: replaced the System 3 filter and the gasket.", "ZZ Test Brewer XL: Clean and replace the System 3 filter", "Edited after the preview.", "ZZ Test Brewer XL: Clean/Replac..."],
    );
  } finally {
    await pg.close();
  }
});

test("the fuller-text check reads each line as its own segment, so a line cut mid-word above another still matches", () => {
  const saved = "ZZ Test Brewer XL: Replace the filte\nZZ Test Grinder Q: Check the bur";
  const fuller = "ZZ Test Brewer XL: Replace the filter cartridge\nZZ Test Grinder Q: Check the burrs and the chute";
  // Lines already in "Machine: text" form aren't Corrigo's segmented form: they read as they are.
  assert.equal(C.descriptionLines(saved), saved);
  assert.equal(C.addsNothingNew(saved, fuller), true);
  assert.equal(C.addsNothingNew("ZZ Test Brewer XL: Replace the filte\nZZ Test Grinder Q: Check the chute", fuller), true);
  assert.equal(C.addsNothingNew("ZZ Test Brewer XL: Replace the filte\nZZ Test Grinder Q: Check the hopper", fuller), false);
  assert.equal(C.addsNothingNew("ZZ Test Brewer XL: Replace the gasket", fuller), false);
});

test("the preview counts fuller fills apart from blank ones", () => {
  const screen = src("src/components/desk/corrigo-import.tsx");
  assert.match(screen, /const descFuller = applicable\.filter\(\(r\) => !!r\.workDoneFill && !!r\.workDoneFrom\)\.length;/);
  assert.match(screen, /const descFilled = applicable\.filter\(\(r\) => !!r\.workDoneFill && !r\.workDoneFrom\)\.length;/);
  assert.match(screen, /Description\$\{descFuller === 1 \? "" : "s"\} of work replaced with Corrigo's fuller text/);
});

// Review of #128/#129 (11/12): the fuller-text step replaced a tech's own words whenever they appeared somewhere in
// Corrigo's text, in order. It now takes only a saved text that is the start of Corrigo's, line by line.
test("the fuller text takes only a cut-off copy: a tech's own words stay even when Corrigo uses them further on", () => {
  const fuller = "ZZ Test Brewer XL: PM due this week. Tech not available until Friday. Call when done";
  // Cut-off copies of Corrigo's own text.
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM due this wee", fuller), true, "cut mid-word");
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM due this week.", fuller), true, "cut at a word");
  assert.equal(C.isCutCopyOf("zz test brewer xl:  pm DUE this", fuller), true, "spacing and capitals");
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: Clean/Replac...", "ZZ Test Brewer XL: Clean and replace the System 3 filter"), false, "other wording stays");
  // A tech's own words.
  assert.equal(C.isCutCopyOf("PM not done", fuller), false);
  assert.equal(C.isCutCopyOf("Did not replace filter", "ZZ Test Brewer XL: Customer did call, not cooling. Please replace filter"), false);
  assert.equal(C.isCutCopyOf("No", "Notify manager"), false, "one short word is not a cut");
  assert.equal(C.isCutCopyOf("Replace 1", "Replace 12 filters"), false, "a cut word keeps three letters");
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM due next week", fuller), false, "a real edit");
  // Lines: each saved line is the start of the same Corrigo line.
  const two = "ZZ Test Brewer XL: Replace the filter cartridge\nZZ Test Grinder Q: Check the burrs and the chute";
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: Replace the filte\nZZ Test Grinder Q: Check the bur", two), true);
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: Replace the filte", two), true, "the field cut before the second line");
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: Replace the filte\nZZ Test Grinder Q: Check the chute", two), false, "a line that skips words");
  assert.equal(C.isCutCopyOf("ZZ Test Grinder Q: Check the bur", two), false, "the wrong line");
  assert.equal(C.isCutCopyOf("", two), false);
  assert.equal(C.isCutCopyOf(two, ""), false);
});

test("a PM whose Description of work is a tech's note keeps it through an import; a cut-off fill still takes the fuller text", async () => {
  const { pg, sql, query } = await freshDb();
  try {
    const pm = async (wo, workDone) => Number((await query("insert into pm_jobs (customer, status, wo, work_done) values ('ZZ Test Diner', 'Scheduled', $1, $2) returning id", [wo, workDone]))[0].id);
    const note = await pm("WO-3101", "PM not done");
    const short = await pm("WO-3102", "No");
    const cut = await pm("WO-3103", "ZZ Test Brewer XL: PM due this wee");
    const text = "ZZ Test Brewer XL:OTHER:PM due this week. Tech not available until Friday. Call when done";
    const preview = await previewCorrigoRecords(sql, file([
      ["3101", "Open", "ZZ Test Diner", "PM", text, ""],
      ["3102", "Open", "ZZ Test Diner", "PM", "ZZ Test Brewer XL:OTHER:Notify manager. Replace filter", ""],
      ["3103", "Open", "ZZ Test Diner", "PM", text, ""],
    ]));
    for (const wo of ["WO-3101", "WO-3102"]) {
      assert.deepEqual([one(preview, wo).workDoneFill, one(preview, wo).workDoneFrom], [null, null], wo);
      assert.deepEqual(one(preview, wo).descriptionNotes, [{ text: "Description of work kept: it already has text", warn: false }], wo);
    }
    const full = "ZZ Test Brewer XL: PM due this week. Tech not available until Friday. Call when done";
    assert.equal(one(preview, "WO-3103").workDoneFill, full);
    await applyCorrigoRows(sql, preview.rows, "boss");
    const workOf = async (id) => (await query("select work_done from pm_jobs where id = $1", [id]))[0].work_done;
    assert.deepEqual([await workOf(note), await workOf(short), await workOf(cut)], ["PM not done", "No", full]);
  } finally {
    await pg.close();
  }
});

test("second review (11/12): a cut can leave any letters on a long line; a short note or one ending in ... is not a cut copy", () => {
  const fuller = "ZZ Test Brewer XL: PM due this week. Tech not available until Friday. Call when done";
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM due th", fuller), true, "a long line cut after two letters");
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM due this week. T", fuller), true, "a long line cut after one letter");
  // A tech's note that ends in ... or … still starts like Corrigo's line, or it stays.
  assert.equal(C.isCutCopyOf("PM not done...", fuller), false);
  assert.equal(C.isCutCopyOf("Not done…", fuller), false);
  assert.equal(C.isCutCopyOf("PM not done...", "PM due this week. Tech not available until Friday. Call when done"), false, "same first word, then not");
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM Friday...", fuller), false, "words skipped: not a cut copy");
  // Third review (11/12): the machine lead doesn't count as the line's own text.
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM not done...", fuller), false);
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: not done...", fuller), false);
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: No", "ZZ Test Brewer XL: Notify manager. Replace filter"), false);
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM du", fuller), false, "two words of its own: the cut keeps three letters");
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: PM due", fuller), true, "two whole words");
  // The field cut off in the last line, even inside its machine name.
  const two = "ZZ Test Brewer XL: Replace the filter and descale\nZZ Test Grinder Q: Check the burrs";
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: Replace the filter and descale\nZZ Te...", two), true);
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL: Replace the filter and descale\nZZ Te", two), false, "not cut off: a short cut in a name stays");
  // Saved in Corrigo's own segmented form: never one of our fills.
  assert.equal(C.isCutCopyOf("ZZ Test Brewer XL:OTHER:PM due this", fuller), false);
  // One or two words are never a cut copy.
  assert.equal(C.isCutCopyOf("No", "No hot water at the brewer"), false);
  assert.equal(C.isCutCopyOf("PM", "PM due this week"), false);
  assert.equal(C.isCutCopyOf("PM due", "PM due this week"), false);
  assert.equal(C.isCutCopyOf("PM due this", "PM due this week"), true, "three words that start Corrigo's text");
});
