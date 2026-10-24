// Fill In Form (10/24): the tech's parts of the Equipment Request Form, filled in inside KatzDesk: Done ticks and notes
// on the checklists, Verified by, the six Tech notes boxes and the sign-off. Saved per install, merged field by field,
// logged, shown on the printed page and in the PDF. Only the owner approves; an approved form is final. Made-up data.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const E = await import("../src/lib/ops/install-form-entries.ts");
const { installFormFor, saveFormEntriesFor } = await import("../src/lib/ops/install-form-api.ts");
const { buildInstallFormPdf } = await import("../src/lib/ops/install-form-pdf.ts");
const { mergeInstallsFor } = await import("../src/lib/ops/install-projects.ts");
const { PDFDocument } = await import("pdf-lib");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

async function fresh() {
  const pg = new PGlite();
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query("insert into directory_equipment (name) values ('Bunn ITCB-DV'), ('Bunn G9-2T')");
  await pg.query(
    "insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values ('u-owner', 'chuy', true, true, 'admin'), ('u-tech', 'melinda', true, false, 'tech'), ('u-tech2', 'oliver', true, false, 'tech')",
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}
const install = async (sql, customer, machines = ["Bunn ITCB-DV"]) =>
  (
    await sql.query("insert into installs (customer, equipment, machines, technician) values ($1, $2, $3, 'Oliver Garcia') returning id", [
      customer,
      machines.join("\n"),
      JSON.stringify(machines.map((m) => ({ equipment: m, serial: "", powerVoltage: "" }))),
    ])
  )[0].id;
const history = async (sql, id) =>
  (await sql.query("select actor_name, detail from activity where entity_type = 'install' and entity_id = $1 order by id", [id])).map((r) => `${r.actor_name}: ${r.detail}`);

const NOW = new Date("2026-10-24T15:42:00Z");
const tech = { name: "melinda", owner: false, now: NOW, today: "2026-10-24" };
const other = { name: "oliver", owner: false, now: NOW, today: "2026-10-24" };
const owner = { name: "chuy", owner: true, now: NOW, today: "2026-10-24" };
const TASK = E.entryKey("tasks", "Parameters recorded");
const PRE2 = E.entryKey("pre", "Cold water source confirmed");

test("each checklist line has a steady key, and only the form's own lines are accepted", () => {
  assert.equal(E.lineKey("Space clearance (H/W/D) checked"), "space-clearance-h-w-d-checked");
  assert.equal(TASK, "tasks:parameters-recorded");
  assert.equal(E.isEntryKey(TASK), true);
  assert.equal(E.isEntryKey("tasks:made-up-line"), false);
  assert.equal(E.isEntryKey("pre:parameters-recorded"), false);
  // 10 + 6 + 4 lines on the three checklists, six Tech notes boxes.
  assert.equal(E.CHECKLISTS.length, 3);
  assert.equal(E.TECH_NOTE_SECTIONS.length, 6);
  // What's stored is read leniently: unknown lines, bad dates and broken stamps are left out.
  const read = E.readEntries(
    JSON.stringify({ done: { [TASK]: true, "tasks:nope": true }, notes: { [PRE2]: "Moved to the left wall" }, verifiedOn: "2026-02-31", signed: { by: "x" }, techNotes: { equipment: "ok", bogus: "no" } }),
  );
  assert.deepEqual(read.done, { [TASK]: true });
  assert.deepEqual(read.notes, { [PRE2]: "Moved to the left wall" });
  assert.deepEqual(read.techNotes, { equipment: "ok" });
  assert.equal(read.verifiedOn, null);
  assert.equal(read.signed, null);
});

test("a save ticks, notes and clears field by field, tidies the text and refuses what doesn't fit", () => {
  let e = E.applyFormPatch(E.emptyEntries(), { done: { [TASK]: true }, notes: { [PRE2]: "  Moved   to the left wall " }, techNotes: { equipment: "Grinder\r\n\r\n\r\nneeds a shelf  " } }, tech);
  assert.deepEqual(e.done, { [TASK]: true });
  assert.equal(e.notes[PRE2], "Moved to the left wall");
  assert.equal(e.techNotes.equipment, "Grinder\n\nneeds a shelf");
  // Unticking and a blank note take them off; anything not sent stays.
  e = E.applyFormPatch(e, { done: { [TASK]: false }, notes: { [PRE2]: "" } }, tech);
  assert.deepEqual([e.done, e.notes, e.techNotes.equipment], [{}, {}, "Grinder\n\nneeds a shelf"]);
  assert.throws(() => E.applyFormPatch(e, { done: { "tasks:made-up": true } }, tech), /isn't on the form/);
  assert.throws(() => E.applyFormPatch(e, { notes: { [TASK]: "x".repeat(E.NOTE_MAX + 1) } }, tech), /120 characters at most/);
  assert.throws(() => E.applyFormPatch(e, { techNotes: { account: "x".repeat(E.TECH_NOTE_MAX + 1) } }, tech), /1000 characters at most/);
  assert.throws(() => E.applyFormPatch(e, { techNotes: { nowhere: "x" } }, tech), /isn't on the form/);
  assert.throws(() => E.applyFormPatch(e, { completedOn: "10/24/2026" }, tech), /isn't a date/);
  const v = E.applyFormPatch(e, { verifiedBy: " Oliver  Garcia ", verifiedOn: "2026-10-23", techName: "Oliver Garcia" }, tech);
  assert.deepEqual([v.verifiedBy, v.verifiedOn, v.techName], ["Oliver Garcia", "2026-10-23", "Oliver Garcia"]);
});

test("signing stamps who and when; only the owner approves, after the signature; an approved form is final", () => {
  let e = E.applyFormPatch(E.emptyEntries(), { sign: true }, tech);
  assert.deepEqual(e.signed, { by: "melinda", at: NOW.toISOString() });
  assert.equal(e.completedOn, "2026-10-24", "signing fills Date completed when blank");
  assert.match(E.stampText(e.signed), /^melinda · Oct 24, 2026, 10:42 AM$/);
  // Someone else can't replace or take off melinda's signature; the owner can.
  assert.throws(() => E.applyFormPatch(e, { sign: true }, other), /only melinda or the owner/);
  assert.throws(() => E.applyFormPatch(e, { sign: false }, other), /Only melinda or the owner/);
  assert.equal(E.applyFormPatch(e, { sign: false }, owner).signed, null);

  assert.throws(() => E.applyFormPatch(e, { approve: true }, tech), /Only the owner can approve/);
  assert.throws(() => E.applyFormPatch(E.emptyEntries(), { approve: true }, owner), /technician signs first/);
  assert.throws(() => E.applyFormPatch(e, { approvedOn: "2026-10-24" }, owner), /Approve the form first/);
  e = E.applyFormPatch(e, { approve: true }, owner);
  assert.deepEqual([e.approved?.by, e.approvedOn], ["chuy", "2026-10-24"]);

  // Final: nobody changes it, the owner included, until the owner undoes the approval.
  assert.throws(() => E.applyFormPatch(e, { done: { [TASK]: true } }, tech), /Approved by chuy: the form is final/);
  assert.throws(() => E.applyFormPatch(e, { sign: false }, tech), /the form is final/);
  assert.throws(() => E.applyFormPatch(e, { techNotes: { signoff: "x" } }, owner), /the form is final/);
  assert.throws(() => E.applyFormPatch(e, { approve: false }, tech), /Only the owner can undo the approval/);
  const undone = E.applyFormPatch(e, { approve: false, done: { [TASK]: true } }, owner);
  assert.deepEqual([undone.approved, undone.approvedOn, undone.done[TASK]], [null, null, true]);
  assert.ok(undone.signed, "undoing the approval keeps the technician's signature");
});

test("the history line says what a save changed", () => {
  const a = E.emptyEntries();
  const b = E.applyFormPatch(a, { done: { [TASK]: true, [PRE2]: true }, notes: { [PRE2]: "Left wall" }, techNotes: { signoff: "All good" }, sign: true }, tech);
  assert.equal(E.describeFormChange(a, b), "Equipment form: 2 ticked done · 1 note · Tech notes (Sign-off) · completed 2026-10-24 · signed by melinda");
  assert.equal(E.describeFormChange(b, b), null);
  const c = E.applyFormPatch(b, { approve: true }, owner);
  assert.equal(E.describeFormChange(b, c), "Equipment form: approved by chuy");
});

test("saving stores the entries on the install, merges field by field, logs it, and the form reads them", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Alpha");
    assert.deepEqual((await installFormFor(sql, id)).entries, E.emptyEntries());

    await saveFormEntriesFor(sql, "u-tech", { installId: id, patch: { done: { [TASK]: true }, techNotes: { equipment: "Needs a shelf" } } }, NOW);
    // A second person saves something else: both are kept.
    await saveFormEntriesFor(sql, "u-tech2", { installId: id, patch: { notes: { [PRE2]: "Left wall" } } }, NOW);
    const form = await installFormFor(sql, id);
    assert.deepEqual(form.entries.done, { [TASK]: true });
    assert.equal(form.entries.techNotes.equipment, "Needs a shelf");
    assert.equal(form.entries.notes[PRE2], "Left wall");
    const log = await history(sql, id);
    assert.ok(log.includes("melinda: Equipment form: 1 ticked done · Tech notes (Equipment to install)"), log.join(" | "));
    assert.ok(log.includes("oliver: Equipment form: 1 note"), log.join(" | "));

    // Nothing changed: nothing written, no history line.
    const before = log.length;
    await saveFormEntriesFor(sql, "u-tech", { installId: id, patch: { done: { [TASK]: true } } }, NOW);
    assert.equal((await history(sql, id)).length, before);

    // The signature carries the signed-in account; a tech can't approve; the owner can.
    await saveFormEntriesFor(sql, "u-tech", { installId: id, patch: { sign: true } }, NOW);
    await assert.rejects(() => saveFormEntriesFor(sql, "u-tech", { installId: id, patch: { approve: true } }, NOW), /Only the owner can approve/);
    const approved = await saveFormEntriesFor(sql, "u-owner", { installId: id, patch: { approve: true } }, NOW);
    assert.deepEqual([approved.signed?.by, approved.approved?.by], ["melinda", "chuy"]);
    await assert.rejects(() => saveFormEntriesFor(sql, "u-tech", { installId: id, patch: { techNotes: { account: "late" } } }, NOW), /the form is final/);

    // The install itself is never changed by the form.
    const row = (await sql.query("select customer, technician, site_contact, machines from installs where id = $1", [id]))[0];
    assert.equal(row.technician, "Oliver Garcia");
    await assert.rejects(() => saveFormEntriesFor(sql, "u-tech", { installId: 99999, patch: { sign: true } }, NOW), /Install not found/);
  } finally {
    await pg.close();
  }
});

test("a save that lands while someone else saves reads again and keeps both", async () => {
  const { pg, sql: base } = await fresh();
  try {
    const id = await install(base, "Cafe Bravo");
    await saveFormEntriesFor(base, "u-tech", { installId: id, patch: { notes: { [PRE2]: "First" } } }, NOW);
    // Between this save's read and its write, another save goes in.
    let raced = false;
    const query = async (text, params) => {
      if (!raced && /^\s*update install_form_entries set entries/.test(text)) {
        raced = true;
        await saveFormEntriesFor(base, "u-tech2", { installId: id, patch: { done: { [TASK]: true } } }, NOW);
      }
      return base.query(text, params);
    };
    const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
    const out = await saveFormEntriesFor(sql, "u-tech", { installId: id, patch: { techNotes: { tasks: "Calibrated twice" } } }, NOW);
    assert.equal(raced, true);
    assert.deepEqual([out.notes[PRE2], out.done[TASK], out.techNotes.tasks], ["First", true, "Calibrated twice"]);
    const stored = E.readEntries((await base.query("select entries from install_form_entries where install_id = $1", [id]))[0].entries);
    assert.deepEqual(stored, out);
  } finally {
    await pg.close();
  }
});

test("the PDF carries what was filled in: ticks, notes, Tech notes, Verified by and the stamps", async () => {
  const { pg, sql } = await fresh();
  try {
    const id = await install(sql, "Cafe Charlie");
    await saveFormEntriesFor(
      sql,
      "u-tech",
      {
        installId: id,
        patch: {
          done: { [TASK]: true, [PRE2]: true },
          notes: { [PRE2]: "Left wall" },
          techNotes: { account: "Ask for Maria", signoff: "All good" },
          verifiedBy: "Oliver Garcia",
          verifiedOn: "2026-10-23",
          sign: true,
        },
      },
      NOW,
    );
    await saveFormEntriesFor(sql, "u-owner", { installId: id, patch: { approve: true } }, NOW);
    const form = (await PDFDocument.load(await buildInstallFormPdf(await installFormFor(sql, id), { now: NOW }))).getForm();
    const text = (name) => form.getTextField(name).getText() ?? "";
    assert.equal(form.getCheckBox("tasks_4_done").isChecked(), true, "Parameters recorded is the 4th task");
    assert.equal(form.getCheckBox("pre_2_done").isChecked(), true);
    assert.equal(form.getCheckBox("tasks_1_done").isChecked(), false);
    assert.equal(text("pre_2_notes"), "Left wall");
    assert.equal(text("notes_account"), "Ask for Maria");
    assert.equal(text("notes_signoff"), "All good");
    assert.equal(text("notes_tasks"), "");
    assert.equal(text("pre_verified_by"), "Oliver Garcia");
    assert.equal(text("pre_date"), "Oct 23, 2026");
    assert.equal(text("tech_name"), "Oliver Garcia");
    assert.match(text("tech_signature"), /^melinda · Oct 24, 2026/);
    assert.equal(text("date_completed"), "Oct 24, 2026");
    assert.match(text("owner_signature"), /^chuy · Oct 24, 2026/);
    assert.equal(text("date_approved"), "Oct 24, 2026");
  } finally {
    await pg.close();
  }
});

test("merging two installs keeps the keeper's form, or takes the drop's when the keeper's is empty", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await install(sql, "Cafe Delta");
    const drop = await install(sql, "Cafe Delta", ["Bunn G9-2T"]);
    await saveFormEntriesFor(sql, "u-tech", { installId: drop, patch: { done: { [TASK]: true }, techNotes: { tasks: "From the drop" } } }, NOW);
    await mergeInstallsFor(sql, "u-owner", { keepId: keep, dropId: drop });
    assert.equal((await installFormFor(sql, keep)).entries.techNotes.tasks, "From the drop");

    const keep2 = await install(sql, "Cafe Echo");
    const drop2 = await install(sql, "Cafe Echo", ["Bunn G9-2T"]);
    await saveFormEntriesFor(sql, "u-tech", { installId: keep2, patch: { techNotes: { tasks: "Keeper's" } } }, NOW);
    await saveFormEntriesFor(sql, "u-tech", { installId: drop2, patch: { techNotes: { tasks: "Drop's" } } }, NOW);
    await mergeInstallsFor(sql, "u-owner", { keepId: keep2, dropId: drop2 });
    assert.equal((await installFormFor(sql, keep2)).entries.techNotes.tasks, "Keeper's");
  } finally {
    await pg.close();
  }
});
