// Reading a stored file for its specs (10/28): every page of the PDF on the server, or Troubleshoot's page text when it
// has read the whole file, never written back; real reasons when a file can't be read; spec sheets and manuals through
// a stand-in AI service. Everything still goes to Spec Review, and Approve only fills blanks. All data is made up and
// the PDFs are made in memory.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { makePdf } from "./pdf-fixture.mjs";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ??= "postgres://127.0.0.1:9/unused";
const { approveOne, fileText, readOneFile, rereadBatch, queueRereads } = await import("../src/lib/ops/spec-read-api.ts");

/* A stand-in for the xAI service: it records each request and answers from the text it was sent. */
const requests = [];
let reply = () => ({ status: 200, content: "{}" });
const ai = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = JSON.parse(body);
    requests.push(json);
    const r = reply(json.messages.at(-1).content, json);
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(r.status === 200 ? JSON.stringify({ choices: [{ message: { content: r.content } }] }) : r.content);
  });
});
before(async () => {
  await new Promise((ok) => ai.listen(0, "127.0.0.1", ok));
  process.env.XAI_BASE_URL = `http://127.0.0.1:${ai.address().port}/v1`;
});
after(() => ai.close());

async function freshDb() {
  const pg = new PGlite();
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(name, dir), "utf8"));
  return { query: async (text, params) => (await pg.query(text, params)).rows };
}

async function book(sql, title, manufacturer, mpn = null) {
  return (await sql.query("insert into library_books (title, manufacturer, mpn) values ($1, $2, $3) returning id", [title, manufacturer, mpn]))[0].id;
}

/** A stored file, its bytes in two chunks the way uploads store them. */
async function stored(sql, bookId, section, name, bytes) {
  const id = (
    await sql.query(
      "insert into library_files (section, name, mime, size, token, complete, book_id) values ($1, $2, 'application/pdf', $3, gen_random_uuid()::text, true, $4) returning id",
      [section, name, bytes?.length ?? 0, bookId],
    )
  )[0].id;
  if (bytes?.length) {
    const half = Math.ceil(bytes.length / 2);
    await sql.query("insert into library_file_chunks (file_id, seq, data) values ($1, 0, $2), ($1, 1, $3)", [id, bytes.slice(0, half), bytes.slice(half)]);
  }
  return id;
}

const pageRows = async (sql, id) => (await sql.query("select page, body from library_file_text where file_id = $1 order by page", [id])).map((r) => [r.page, r.body]);
const textPages = async (sql, id) => (await sql.query("select text_pages from library_files where id = $1", [id]))[0].text_pages;

const SHEET = makePdf([["ACME X1 Brewer", "Spec Sheet"], ["Technical Data", "Voltage 120 V", "Amps 15 A", "Net weight 40 lb"], []]);

test("every page of the stored PDF is read on the server, and nothing is written into Troubleshoot's page text", async () => {
  const sql = await freshDb();
  const id = await stored(sql, await book(sql, "ACME X1", "ACME"), "spec", "Spec.pdf", SHEET);
  const read = await fileText(sql, id);
  assert.equal(read.ok, true, read.error);
  assert.equal(read.from, "pdf");
  assert.equal(read.text, "[Page 1]\nACME X1 Brewer\nSpec Sheet\n\n[Page 2]\nTechnical Data\nVoltage 120 V\nAmps 15 A\nNet weight 40 lb");
  assert.deepEqual([read.pages, read.used], [2, [1, 2]]);
  assert.deepEqual(await pageRows(sql, id), []);
  assert.equal(await textPages(sql, id), null);
});

test("Troubleshoot's page text is used when it read the whole file, and is left exactly as it was", async () => {
  const sql = await freshDb();
  const bookId = await book(sql, "ACME X1", "ACME");
  const id = await stored(sql, bookId, "manuals", "Manual.pdf", null);
  await sql.query("insert into library_file_text (file_id, page, body) values ($1, 1, 'ACME X1 Manual'), ($1, 2, 'Technical data: 208-240 V, 30 A, 60 Hz')", [id]);
  await sql.query("update library_files set text_pages = 2 where id = $1", [id]);
  const read = await fileText(sql, id);
  assert.deepEqual([read.ok, read.from, read.used], [true, "stored", [1, 2]]);
  assert.match(read.text, /\[Page 2\]\nTechnical data: 208-240 V/);
  assert.deepEqual(await pageRows(sql, id), [[1, "ACME X1 Manual"], [2, "Technical data: 208-240 V, 30 A, 60 Hz"]]);
  assert.equal(await textPages(sql, id), 2);
  // Troubleshoot still reading (pages saved, the count not yet): the PDF itself.
  const partial = await stored(sql, bookId, "spec", "Spec.pdf", SHEET);
  await sql.query("insert into library_file_text (file_id, page, body) values ($1, 1, 'ACME X1 Brewer Spec Sheet')", [partial]);
  assert.equal((await fileText(sql, partial)).from, "pdf");
  assert.deepEqual(await pageRows(sql, partial), [[1, "ACME X1 Brewer Spec Sheet"]]);
});

test("a file that can't be read says why: no data, not a PDF, a broken PDF, or no text layer", async () => {
  const sql = await freshDb();
  const bookId = await book(sql, "ACME X1", "ACME");
  const why = async (bytes) => (await fileText(sql, await stored(sql, bookId, "spec", "x.pdf", bytes))).error;
  assert.equal(await why(null), "Couldn't open the PDF: the file has no stored data.");
  assert.equal(await why(new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 0])), "Couldn't open the PDF: it is not a PDF file");
  assert.match(await why(new TextEncoder().encode("%PDF-1.7 a broken file")), /^Couldn't open the PDF: Invalid PDF structure/);
  assert.equal(await why(makePdf([[], ["p 2"]])), "No text layer (scanned): the PDF opened (2 pages) but has under 40 characters of text.");
});

const DRAFT = {
  manufacturer: null,
  model: "X1",
  specs: [
    { label: "", value: "a row with no label" },
    { label: "Net weight", value: "40 lb" },
  ],
  configs: [{ label: "Standard", requirements: { power: { voltage: "120V", amps: "15A" } } }],
};

test("spec sheets and manuals are read through the AI into Spec Review; a failed read or a scanned file says why", async () => {
  const sql = await freshDb();
  const bookId = await book(sql, "ACME X1", "ACME");
  const sheet = await stored(sql, bookId, "spec", "Spec.pdf", SHEET);
  const manual = await stored(sql, bookId, "manuals", "Manual.pdf", makePdf([["ACME X1 Installation Manual"], ["Specifications", "Voltage 120 V", "Amps 15 A"]]));
  const failing = await stored(sql, bookId, "manuals", "Service.pdf", makePdf([["FAIL-ME Service Manual for the ACME X1 brewer, all models"]]));
  const scanned = await stored(sql, bookId, "spec", "Scan.pdf", makePdf([[], []]));
  requests.length = 0;
  reply = (text) => (/FAIL-ME/.test(text) ? { status: 500, content: "upstream down" } : { status: 200, content: JSON.stringify(DRAFT) });
  const ids = await queueRereads(sql, ["never"], ["spec", "manuals"]);
  assert.deepEqual(ids, [sheet, manual, failing, scanned]);
  const batch = await rereadBatch(sql, "test-key", ids);
  assert.deepEqual([batch.read, batch.review, batch.unreadable, batch.left], [4, 2, 2, 0]);
  const outcome = (id) => batch.outcomes.find((o) => o.fileId === id);
  assert.deepEqual([outcome(sheet).status, outcome(manual).status], ["needs_review", "needs_review"]);
  assert.equal(outcome(failing).error, "AI read failed: xAI API error 500: upstream down");
  assert.match(outcome(scanned).error, /^No text layer \(scanned\)/);
  // The AI saw each file's pages, marked; a manual says it is one; the reply has room for 8,000 tokens.
  const userOf = (name) => requests.map((r) => r.messages.at(-1).content).find((c) => c.includes(`"${name}"`));
  assert.match(userOf("Spec.pdf"), /^Spec sheet "Spec.pdf" text:\n\n\[Page 1\]\nACME X1 Brewer/);
  assert.match(userOf("Manual.pdf"), /^Manual \(its pages most likely to hold specifications\) "Manual.pdf" text:/);
  assert.ok(requests.every((r) => r.max_tokens === 8000));
  assert.equal(requests.filter((r) => r.messages.at(-1).content.includes("Scan.pdf")).length, 0, "a scanned file isn't sent to the AI");
  // No maker in the reply and a row with no label: still read, and the weight row fills the blank weight. The plug is
  // the Katz default for 120V 15A, as every read gets it.
  const changes = (await sql.query("select changes from spec_reads where file_id = $1", [sheet]))[0].changes;
  assert.deepEqual(
    changes.map((c) => [c.key, c.kind, c.newValue]),
    [
      ["voltage", "fill", "120V"],
      ["amps", "fill", "15A"],
      ["plug", "fill", "NEMA 5-15"],
      ["weight", "fill", "40 lb"],
    ],
  );
  for (const id of [sheet, manual, failing, scanned]) assert.deepEqual(await pageRows(sql, id), [], "no page text was written");
});

test("a manual's read goes through review, and Approve only fills what is blank", async () => {
  const sql = await freshDb();
  const bookId = await book(sql, "ACME X2", "ACME");
  const sheetId = (await sql.query("insert into spec_sheets (manufacturer, model, specs, book_id) values ('ACME', 'X2', '[]'::jsonb, $1) returning id", [bookId]))[0].id;
  await sql.query(`insert into spec_configs (sheet_id, label, position, requirements) values ($1, 'Standard', 0, '{"power":{"voltage":"208V"}}'::jsonb)`, [sheetId]);
  const manual = await stored(sql, bookId, "manuals", "Manual.pdf", makePdf([["ACME X2 Manual"], ["Specifications", "Voltage 120 V", "Amps 15 A"]]));
  reply = () => ({ status: 200, content: JSON.stringify(DRAFT) });
  await queueRereads(sql, ["never"], ["manuals"]);
  const outcome = await readOneFile(sql, "test-key", { file_id: manual, book_id: bookId, name: "Manual.pdf", section: "manuals" });
  assert.equal(outcome.status, "needs_review");
  const changes = (await sql.query("select changes from spec_reads where file_id = $1", [manual]))[0].changes;
  assert.deepEqual(changes.find((c) => c.key === "voltage"), { key: "voltage", label: "Voltage", oldValue: "208V", newValue: "120V", kind: "conflict" });
  await approveOne(sql, manual, []);
  const req = (await sql.query("select requirements from spec_configs where sheet_id = $1", [sheetId]))[0].requirements;
  assert.equal(req.power.voltage, "208V", "the hand-entered voltage stays");
  assert.equal(req.power.amps, "15A", "a blank is filled");
});
