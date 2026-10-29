// Import Part Notes (CSV) (Grok's request through Chuy, 2026-10-29): Parts → Import, Admin only. A row adds one note
// to a part, found by id, else exact SKU, never by name. The note goes on a new line; the note already there never
// changes, and nothing else on the part does. A note the part has is skipped, so the same file twice changes nothing.
// Hidden and merged-away parts are skipped and listed. Each Confirm is logged. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const pure = await import("../src/lib/ops/part-notes.ts");
const api = await import("../src/lib/ops/part-notes-api.ts");

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();

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
  const sql = Object.assign(async () => assert.fail("tagged query"), { query });
  return { pg, sql };
}

/** A made-up part; returns its id. */
async function part(pg, sku, extra = {}) {
  return (
    await pg.query(
      `insert into billing_items (sku, item, description, kind, item_class, note, hidden_at, mfr_part, bin_rack, bin_shelf, bin_bin)
       values ($1, $2, $3, $4, 'Parts', $5, $6, $7, 'A', '03', '12') returning id`,
      [sku, `PARTS : ${sku}`, extra.description ?? `${sku} gasket`, extra.kind ?? "part", extra.note ?? null, extra.hidden ? new Date() : null, `MPN-${sku}`],
    )
  ).rows[0].id;
}

const csv = (text, { bom = true } = {}) => Buffer.from(`${bom ? "\uFEFF" : ""}${text}`, "utf8").toString("base64");
/** The window's two steps: the preview, then (apply) Confirm with the rows the preview showed as Add. */
async function run(sql, base64, apply, userId = "u-owner", filename = "notes.csv", confirmWith = sql) {
  const p = await api.importPartNotesFor(sql, { filename, base64, apply: false }, userId);
  if (!apply) return p;
  const expect = p.lines.filter((l) => l.status === "add").map((l) => ({ line: l.line, partId: l.part.id }));
  return api.importPartNotesFor(confirmWith, { filename, base64, apply: true, expect }, userId);
}
const noteOf = async (pg, id) => (await pg.query("select note from billing_items where id = $1", [id])).rows[0].note;
const runs = async (pg) => (await pg.query("select kind, filename, row_count, added, skipped, not_found, updated, not_applied, approved_by from part_import_runs order by id")).rows;

const FITS = "Fits Rancilio: Classe 5 S/21, Classe 7 USB/21 (source: made-up test, 10/29/26)";

/* ------------------------------------------------------------------ reading the file */

test("the file: sku or id and note, any case of header, quoted notes with commas, one line each", () => {
  const sheet = (matrix) => [{ name: "notes", matrix }];
  assert.deepEqual(pure.noteRowsFromSheets(sheet([["SKU", "Notes"], ["  RANC1 ", `  ${FITS}  `], ["", ""], ["RANC2", "two\nlines"]])), [
    { line: 2, idRaw: "", sku: "RANC1", note: FITS },
    { line: 4, idRaw: "", sku: "RANC2", note: "two lines" },
  ]);
  assert.deepEqual(pure.noteRowsFromSheets(sheet([["Part ID", "note"], [" 42 ", "x"]])), [{ line: 2, idRaw: "42", sku: "", note: "x" }]);
  assert.throws(() => pure.noteRowsFromSheets(sheet([["name", "note"], ["RANC1", "x"]])), /Could not find the note column and an id or sku column/, "a name column is never a key");
  assert.throws(() => pure.noteRowsFromSheets(sheet([["sku", "comment"], ["RANC1", "x"]])), /Could not find the note column/);
});

test("the text: UTF-8 with or without a byte-order mark, and Excel's Windows code page", () => {
  const read = (b64) => pure.noteRowsFromSheets(api.readNoteSheets(b64));
  const accents = "Café – Ø58 “group” seal";
  assert.equal(read(csv(`sku,note\r\nRANC1,${accents}\r\n`))[0].note, accents);
  assert.equal(read(csv(`sku,note\nRANC1,${accents}\n`, { bom: false }))[0].note, accents);
  const cp1252 = Buffer.concat([Buffer.from("sku,note\r\nRANC1,Caf"), Buffer.from([0xe9, 0x20, 0x96, 0x20]), Buffer.from("seal\r\n")]).toString("base64");
  assert.equal(read(cp1252)[0].note, "Café – seal");
  assert.equal(read(csv('sku,note\r\n00123,"a, b"\r\n'))[0].sku, "00123", "a SKU stays as typed");
});

/* ------------------------------------------------------------------ the plan and the write */

test("preview writes nothing and logs nothing; Confirm adds the note and logs the run", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1");
    const b = await part(pg, "RANC2");
    const file = csv(`sku,note\r\nRANC1,"${FITS}"\r\nranc2 ,Fits Classe 9\r\n`);
    const p = await run(sql, file, false);
    assert.equal(p.applied, false);
    assert.deepEqual(p.lines.map((l) => [l.sku, l.status, l.part?.id, l.currentNote]), [
      ["RANC1", "add", a, null],
      ["ranc2", "add", b, null],
    ]);
    assert.deepEqual(p.lines[0].part, { id: a, sku: "RANC1", name: "RANC1 gasket" });
    assert.equal(p.counts.add, 2);
    assert.equal(await noteOf(pg, a), null, "the preview wrote nothing");
    assert.deepEqual(await runs(pg), [], "and logged nothing");

    const done = await run(sql, file, true);
    assert.equal(done.applied, true);
    assert.deepEqual(done.result, { added: 2, parts: 2, changed: 0, runId: done.result.runId });
    assert.equal(await noteOf(pg, a), FITS);
    assert.equal(await noteOf(pg, b), "Fits Classe 9");
    assert.deepEqual(await runs(pg), [
      { kind: "notes", filename: "notes.csv", row_count: 2, added: 2, skipped: 0, not_found: 0, updated: 0, not_applied: 0, approved_by: "chuy" },
    ]);
  } finally {
    await pg.close();
  }
});

test("a note goes on a new line under the note the part has, which stays as it was", async () => {
  const { pg, sql } = await fresh();
  try {
    const merged = "Merged OLD1 (old number)\nMerged OLD2  (typo'd catalog)";
    const a = await part(pg, "RANC1", { note: merged });
    const b = await part(pg, "RANC2", { note: "Kept as is\n" });
    const c = await part(pg, "RANC3", { note: "   " });
    await run(sql, csv(`sku,note\r\nRANC1,"${FITS}"\r\nRANC2,Second line\r\nRANC3,Only note\r\nRANC1,Also fits Classe 9\r\n`), true);
    assert.equal(await noteOf(pg, a), `${merged}\n${FITS}\nAlso fits Classe 9`, "two notes for one part, in file order");
    assert.equal(await noteOf(pg, b), "Kept as is\nSecond line", "no blank line when the note ends with a line break");
    assert.equal(await noteOf(pg, c), "Only note", "a note that is only blank space is replaced");
  } finally {
    await pg.close();
  }
});

test("a note the part already has is skipped, so the same file a second time changes nothing", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", { note: `Merged OLD1\n  ${FITS.replace(/ /g, "  ")}  ` });
    const b = await part(pg, "RANC2");
    const file = csv(`sku,note\r\nRANC1,"${FITS}"\r\nRANC2,Fits Classe 9\r\nRANC2,Fits   Classe 9\r\n`);
    const p = await run(sql, file, false);
    assert.deepEqual(p.lines.map((l) => [l.status, l.reason]), [
      ["already", "Already in the part's note"],
      ["add", null],
      ["already", "The same note is on an earlier row"],
    ]);
    await run(sql, file, true);
    const after = [await noteOf(pg, a), await noteOf(pg, b)];
    const updated = (await pg.query("select updated_at from billing_items where id = $1", [b])).rows[0].updated_at;
    const again = await run(sql, file, true);
    assert.equal(again.counts.add, 0);
    assert.ok(again.lines.every((l) => l.status === "already"));
    assert.deepEqual([await noteOf(pg, a), await noteOf(pg, b)], after, "the second run changed nothing");
    assert.deepEqual((await pg.query("select updated_at from billing_items where id = $1", [b])).rows[0].updated_at, updated);
    assert.deepEqual(
      (await runs(pg)).map((r) => [r.added, r.skipped, r.not_found]),
      [
        [1, 2, 0],
        [0, 3, 0],
      ],
    );
  } finally {
    await pg.close();
  }
});

test("matching: id first, then the exact SKU (case and spaces aside), never by name; not found and ambiguous change nothing, and no part is created", async () => {
  const { pg, sql } = await fresh();
  try {
    const partCount = async () => (await pg.query("select count(*)::int as n from billing_items")).rows[0].n;
    const a = await part(pg, "RANC1", { description: "Steam valve" });
    const b = await part(pg, "RANC2");
    const trip = (await pg.query("select id from billing_items where sku = 'TRIPCHARGE'")).rows[0].id;
    const file = csv(
      [
        "id,sku,note",
        `${a},,by id`,
        `${a},ranc1,by id and its SKU`,
        `${a},RANC2,id and SKU disagree`,
        `,RANC2,by SKU`,
        `,Steam valve,a name is not a SKU`,
        `,PARTS : RANC1,the NetSuite name is not a SKU`,
        `99999,,no such id`,
        `,NOPE9,no such SKU`,
        `,TRIPCHARGE,not a part`,
        `${trip},,not a part either`,
        `4x,,bad id`,
        `,,no key`,
        `,RANC2,`,
      ].join("\r\n"),
    );
    const parts = await partCount();
    const p = await run(sql, file, true);
    assert.equal(await partCount(), parts, "a row that names no part never creates one");
    assert.deepEqual(
      p.lines.map((l) => [l.line, l.status, l.part?.id ?? null]),
      [
        [2, "add", a],
        [3, "add", a],
        [4, "ambiguous", a],
        [5, "add", b],
        [6, "not_found", null],
        [7, "not_found", null],
        [8, "not_found", null],
        [9, "not_found", null],
        [10, "not_found", null],
        [11, "not_found", null],
        [12, "invalid", null],
        [13, "invalid", null],
        [14, "invalid", b],
      ],
    );
    assert.equal(p.lines[2].reason, `Id ${a} is SKU RANC1, not RANC2`);
    assert.equal(p.lines[6].reason, "No part has id 99999");
    assert.equal(p.lines[7].reason, "No part has SKU NOPE9");
    assert.equal(await noteOf(pg, a), "by id\nby id and its SKU");
    assert.equal(await noteOf(pg, b), "by SKU");
    assert.equal(await noteOf(pg, trip), null);
    assert.deepEqual((await runs(pg)).map((r) => [r.row_count, r.added, r.skipped, r.not_found]), [[13, 3, 4, 6]]);
  } finally {
    await pg.close();
  }
});

test("hidden and merged-away parts are skipped and listed, and keep their notes", async () => {
  const { pg, sql } = await fresh();
  try {
    const keep = await part(pg, "RANC1");
    const old = await part(pg, "OLD1", { note: "Merged into RANC1", hidden: true });
    await pg.query("update billing_items set merged_into = $1 where id = $2", [keep, old]);
    const hidden = await part(pg, "RANC9", { hidden: true });
    const p = await run(sql, csv(`sku,note\r\nOLD1,x\r\nRANC9,y\r\nRANC1,z\r\n`), true);
    assert.deepEqual(p.lines.map((l) => [l.status, l.reason]), [
      ["merged", "Merged into RANC1"],
      ["hidden", "The part is hidden"],
      ["add", null],
    ]);
    assert.deepEqual(p.counts, { rows: 3, add: 1, parts: 1, already: 0, notFound: 0, ambiguous: 0, hidden: 1, merged: 1, invalid: 0, changed: 0, skipped: 2 });
    assert.equal(await noteOf(pg, old), "Merged into RANC1");
    assert.equal(await noteOf(pg, hidden), null);
    assert.equal(await noteOf(pg, keep), "z");
  } finally {
    await pg.close();
  }
});

test("only the note (and the part's updated time) changes: name, description, SKU, MPN, class, photo, bins and hidden don't", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", { note: "Merged OLD1" });
    await pg.query("update billing_items set image = '\\x89504e47'::bytea, image_mime = 'image/png', image_updated_at = now(), get_later = true where id = $1", [a]);
    const others = await part(pg, "RANC2");
    const snap = async () =>
      (await pg.query("select to_jsonb(b) - 'note' - 'updated_at' as rest, note from billing_items b order by id")).rows;
    const before = await snap();
    await run(sql, csv(`sku,note\r\nRANC1,"${FITS}"\r\n`), true);
    const after = await snap();
    assert.deepEqual(after.map((r) => r.rest), before.map((r) => r.rest), "every other column is as it was, on every part");
    assert.deepEqual(after.filter((r, i) => r.note !== before[i].note).map((r) => r.note), [`Merged OLD1\n${FITS}`]);
    assert.equal(await noteOf(pg, others), null);
  } finally {
    await pg.close();
  }
});

test("a note saved by someone else while Confirm runs is never overwritten: that part is listed as changed", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", { note: "Merged OLD1" });
    const b = await part(pg, "RANC2");
    const racing = Object.assign(async () => assert.fail("tagged query"), {
      query: async (text, params) => {
        if (text.startsWith("with plan as")) await pg.query("update billing_items set note = 'Saved meanwhile' where id = $1", [a]);
        return sql.query(text, params);
      },
    });
    const done = await run(sql, csv(`sku,note\r\nRANC1,one\r\nRANC1,two\r\nRANC2,three\r\n`), true, "u-owner", "notes.csv", racing);
    assert.equal(await noteOf(pg, a), "Saved meanwhile");
    assert.equal(await noteOf(pg, b), "three");
    assert.deepEqual(done.lines.map((l) => l.status), ["changed", "changed", "add"]);
    assert.deepEqual(done.result, { added: 1, parts: 1, changed: 2, runId: done.result.runId });
    assert.deepEqual((await runs(pg)).map((r) => [r.added, r.skipped, r.not_found]), [[1, 2, 0]]);
  } finally {
    await pg.close();
  }
});

test("a part hidden or merged away while Confirm runs gets nothing, and is listed as changed", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1", { note: "Merged OLD1" });
    const b = await part(pg, "RANC2");
    const keep = await part(pg, "RANC3");
    const racing = Object.assign(async () => assert.fail("tagged query"), {
      query: async (text, params) => {
        if (text.startsWith("with plan as")) {
          await pg.query("update billing_items set hidden_at = now() where id = $1", [a]);
          await pg.query("update billing_items set hidden_at = now(), merged_into = $1 where id = $2", [keep, b]);
        }
        return sql.query(text, params);
      },
    });
    const done = await run(sql, csv(`sku,note\r\nRANC1,one\r\nRANC2,two\r\nRANC3,three\r\n`), true, "u-owner", "notes.csv", racing);
    assert.deepEqual(done.lines.map((l) => l.status), ["changed", "changed", "add"]);
    assert.deepEqual([await noteOf(pg, a), await noteOf(pg, b), await noteOf(pg, keep)], ["Merged OLD1", null, "three"]);
  } finally {
    await pg.close();
  }
});

test("Confirm writes only what its preview showed: a row that became an Add in between is left for the next run", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1");
    const file = csv(`sku,note\r\nRANC1,one\r\nRANC5,five\r\n`);
    const p = await run(sql, file, false);
    assert.deepEqual(p.lines.map((l) => l.status), ["add", "not_found"]);
    // RANC5 gets its SKU after the preview (an import fixed it), before Confirm.
    const late = await part(pg, "RANC5");
    const expect = p.lines.filter((l) => l.status === "add").map((l) => ({ line: l.line, partId: l.part.id }));
    const done = await api.importPartNotesFor(sql, { filename: "notes.csv", base64: file, apply: true, expect }, "u-owner");
    assert.deepEqual(done.lines.map((l) => [l.status, l.part?.id]), [
      ["add", a],
      ["changed", late],
    ]);
    assert.match(done.lines[1].reason, /^Not an Add for this part in the preview you confirmed/);
    assert.deepEqual([await noteOf(pg, a), await noteOf(pg, late)], ["one", null]);
    // Confirm without its preview's rows writes nothing.
    await assert.rejects(() => api.importPartNotesFor(sql, { filename: "notes.csv", base64: file, apply: true }, "u-owner"), /^Error: Preview the file first\.$/);
    assert.equal(await noteOf(pg, late), null);
  } finally {
    await pg.close();
  }
});

test("a note with commas but no quotes is caught, not cut short; a file of semicolons still splits on commas; rows keep their line", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1");
    const b = await part(pg, "RANC2");
    const file = csv(["sku,note", "", `RANC1,${FITS}`, "", `RANC2,"Classe 5, Classe 7"`].join("\r\n"));
    const p = await run(sql, file, true);
    assert.deepEqual(p.lines.map((l) => [l.line, l.status]), [
      [3, "invalid"],
      [5, "add"],
    ]);
    assert.equal(p.lines[0].reason, "The row has more cells than the header: a note with commas needs quotes around it");
    assert.equal(await noteOf(pg, a), null, "nothing cut short was written");
    assert.equal(await noteOf(pg, b), "Classe 5, Classe 7");
    // Notes full of semicolons, not in quotes: the file still splits on commas only.
    const semis = await run(sql, csv(["sku,note", "RANC2,Classe 9; Silvia; Silvia Pro; Silvia Pro X", "RANC9,a; b; c; d; e"].join("\r\n")), true);
    assert.deepEqual(semis.lines.map((l) => [l.sku, l.status, l.note]), [
      ["RANC2", "add", "Classe 9; Silvia; Silvia Pro; Silvia Pro X"],
      ["RANC9", "not_found", "a; b; c; d; e"],
    ]);
    assert.equal(await noteOf(pg, b), "Classe 5, Classe 7\nClasse 9; Silvia; Silvia Pro; Silvia Pro X");
    // Extra columns with a header, and empty trailing cells, are fine.
    const wide = await run(sql, csv(`sku,name,note,source\r\nRANC1,Group gasket,"${FITS}",eParts,,\r\n`), true);
    assert.deepEqual(wide.lines.map((l) => l.status), ["add"]);
    assert.equal(await noteOf(pg, a), FITS);
  } finally {
    await pg.close();
  }
});

test("Admin only: Sales, a tech and an unapproved account are refused before the file is read, and nothing is written", async () => {
  const { pg, sql } = await fresh();
  try {
    const a = await part(pg, "RANC1");
    const file = csv(`sku,note\r\nRANC1,x\r\n`);
    for (const userId of ["u-sales", "u-tech", "u-waiting", "u-nobody"]) {
      for (const apply of [false, true]) {
        await assert.rejects(() => run(sql, file, apply, userId), /^Error: Only an Admin can import part notes\.$/, userId);
      }
    }
    await assert.rejects(() => run(sql, "not a file", true, "u-sales"), /^Error: Only an Admin can import part notes\.$/, "refused before the file is read");
    assert.equal(await noteOf(pg, a), null);
    assert.deepEqual(await runs(pg), []);
    assert.equal((await run(sql, file, true, "u-role")).result.added, 1, "the Admin role without the owner flag");
  } finally {
    await pg.close();
  }
});

test("limits: no rows, too many rows, a note longer than 1,000 characters", async () => {
  const { pg, sql } = await fresh();
  try {
    await part(pg, "RANC1");
    await assert.rejects(() => run(sql, csv("sku,note\r\n"), false), /No rows under the header/);
    const many = ["sku,note", ...Array.from({ length: 5001 }, (_, i) => `RANC${i},x`)].join("\r\n");
    await assert.rejects(() => run(sql, csv(many), false), /Up to 5,000 rows at a time/);
    const p = await run(sql, csv(`sku,note\r\nRANC1,${"y".repeat(1001)}\r\n`), true);
    assert.deepEqual([p.lines[0].status, p.lines[0].reason], ["invalid", "The note is longer than 1,000 characters"]);
    assert.equal(p.result.added, 0);
  } finally {
    await pg.close();
  }
});

test("the Parts page offers Import Part Notes to an Admin only, in the Import menu", () => {
  const page = readFileSync(new URL("../src/routes/_app/parts.tsx", import.meta.url), "utf8");
  assert.match(page, /\{isAdmin \? <ImportPartNotesButton \/> : null\}/);
  assert.equal(page.match(/<ImportPartNotesButton/g).length, 1);
  const dialog = readFileSync(new URL("../src/components/desk/part-notes-import.tsx", import.meta.url), "utf8");
  assert.match(dialog, /importPartNotes\(\{ data: \{ filename: f\.name, base64, apply: false \} \}\)/, "picking the file only previews");
  assert.equal(dialog.match(/apply: true/g).length, 1, "Confirm is the only write");
  assert.match(dialog, /apply: true,\s*expect: \(preview\?\.lines \?\? \[\]\)\.filter\(\(l\) => l\.status === "add" && l\.part\)/);
  assert.match(dialog, /onOpenChange=\{\(o\) => !o && !busy && close\(\)\}/, "the window can't close while a file is read or written");
  const lib = readFileSync(new URL("../src/lib/ops/part-notes-api.ts", import.meta.url), "utf8");
  const body = lib.slice(lib.indexOf("export async function importPartNotesFor"));
  assert.ok(body.indexOf("requireAdmin(sql, userId)") < body.indexOf("readNoteSheets("), "the Admin is checked before the file is read");
  assert.match(lib, /update billing_items b set note = p\.after, updated_at = now\(\)/, "the note and its updated time are all it writes");
  assert.doesNotMatch(lib, /\b(delete\s+from|insert\s+into\s+billing_items)\b/i);
});
