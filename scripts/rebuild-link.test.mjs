// A rebuild linked to a ticket or an install by WO (Chuy, 11/6): "in the rebuild section, in Linked ticket / install,
// allow me to put a work order in to associate the project to" and "upon associating it, link the invoice and all
// other aspects required". His answers: the rebuild's parts and labor go onto the project's invoice (the ticket's
// charges or the install's invoice) and the rebuild's Invoice says it bills there, like a PM stacked on a ticket; any
// service ticket, TLC or install with the WO, open or done, the person picking when several carry it; and the rebuild
// takes the project's account and Customer P.O. All data is made up.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

await register("./node-resolve-hook.mjs", import.meta.url);
process.env.DATABASE_URL ||= "postgres://127.0.0.1:9/katzdesk-test-unused";

const R = await import("../src/lib/ops/rebuild-link.ts");
const L = await import("../src/lib/ops/rebuild-link-api.ts");
const RB = await import("../src/lib/ops/rebuilds.ts");
const I = await import("../src/lib/ops/invoice-api.ts");
const C = await import("../src/lib/ops/charges-api.ts");
const M = await import("../src/lib/ops/ticket-install-merge.ts");
const { invoiceTotals } = await import("../src/lib/ops/invoice.ts");

/** A source key on a project's bill that is one of this rebuild's lines: rb:<rebuild>:<line>. */
const isRebuildLineKey = (key, rebuildId) => {
  const parts = String(key ?? "").split(":");
  return parts[0] === "rb" && parts[1] === String(rebuildId);
};

const MIGRATIONS = new URL("../migrations/", import.meta.url);
const files = readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort();
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const SHOP = "Katz shop / stock";
const CAFE = "Test Bean Cafe - Heights";

// One database at a time: the last test's is closed when the next one starts. Call numbers start over with each.
let last = null;
let calls = 0;
async function fresh() {
  if (last) await last.close().catch(() => {});
  calls = 0;
  const pg = new PGlite();
  last = pg;
  for (const name of files) await pg.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
  await pg.query(
    `insert into desk_accounts (user_id, username, approved, is_admin, desk_role) values
       ('u-owner', 'chuy', true, true, 'admin'),
       ('u-desk', 'dana', true, false, 'service'),
       ('u-wh', 'wes', true, false, 'warehouse'),
       ('u-rep', 'riley', true, false, 'sales')`,
  );
  const query = async (text, params) => (await pg.query(text, params)).rows;
  const sql = Object.assign(async (strings, ...values) => query(strings.reduce((a, s, i) => `${a}$${i}${s}`), values), { query });
  return { pg, sql };
}

const one = async (sql, text, params = []) => (await sql.query(text, params))[0];
const idOf = async (sql, text, params) => Number((await one(sql, text, params)).id);

const rebuild = (sql, o = {}) =>
  idOf(sql, "insert into rebuilds (title, account, po, status) values ($1, $2, $3, $4) returning id", [o.title ?? "Test grinder refurb", o.account ?? SHOP, o.po ?? null, o.status ?? "In progress"]);

/** The rebuild's own invoice: approved (default) or saved for approval by Warehouse, with these lines. */
async function ownInvoice(sql, rb, lines, o = {}) {
  const waiting = o.state === "waiting";
  const inv = await idOf(
    sql,
    `insert into invoices (entity_type, entity_id, customer, total, discount_kind, discount_value, approved_by, approved_at, submitted_by, submitted_at)
     values ('rebuild', $1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [rb, o.customer ?? SHOP, lines.reduce((a, l) => a + l.qty * l.rate, 0), o.discount?.kind ?? null, o.discount?.value ?? null, waiting ? null : "chuy", waiting ? null : "2026-11-01T15:00:00Z", waiting ? "wes" : null, waiting ? "2026-11-01T14:00:00Z" : null],
  );
  for (const [i, l] of lines.entries()) {
    await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, $2, $3, $4, $5, $6, $7)", [inv, l.item, l.description ?? null, l.qty, l.rate, l.kind ?? "part", i + 1]);
  }
  return inv;
}

const ticket = (sql, o = {}) =>
  idOf(
    sql,
    `insert into service_jobs (kind, call_id, customer, wo, status, technician, po, ns_so, received)
     values ($1, $2, $3, $4, $5, 'Test Tech', $6, $7, $8) returning id`,
    [o.kind ?? "service", `SC-RBL-${++calls}`, o.customer ?? CAFE, o.wo ?? null, o.status ?? "Completed", o.po ?? null, o.so ?? null, o.received ?? "2026-10-20"],
  );

async function install(sql, o = {}) {
  const id = await idOf(sql, "insert into installs (customer, wo, complete, equip_status, archived, po) values ($1, $2, $3, $4, $5, $6) returning id", [
    o.customer ?? CAFE,
    o.wo ?? null,
    o.complete ?? false,
    o.status ?? "Not Ready",
    o.archived ?? false,
    o.po ?? null,
  ]);
  for (const wo of o.wos ?? []) await sql.query("insert into install_work_orders (install_id, wo, match_key) values ($1, $2, $3)", [id, wo, wo.replace(/\D+/g, "").replace(/^0+/, "")]);
  return id;
}

const PARTS = [
  { item: "TEST-BURR-64", description: "Test burr set", qty: 2, rate: 45 },
  { item: "Service : SERVICELABOR", description: "Bench labor", qty: 1.5, rate: 150, kind: "labor" },
];

const find = (sql, rb, wo, who = "u-owner") => L.findRebuildLinksFor(sql, { id: rb, wo }, who);
/** Link to the candidate the person picked, sending back what the Find showed. */
const linkTo = (sql, found, cand, who = "u-owner") =>
  L.setRebuildLinkFor(
    sql,
    { id: found.id, expect: { installId: found.installId, jobId: found.jobId }, to: cand.target, seen: { own: found.own.version, current: found.current?.stamp ?? null, target: cand.project.stamp } },
    who,
  );
const unlink = async (sql, rb, who = "u-owner") => {
  const v = await L.getRebuildLinkFor(sql, rb, who);
  return L.setRebuildLinkFor(sql, { id: rb, expect: { installId: v.installId, jobId: v.jobId }, to: null, seen: { own: v.own.version, current: v.current?.stamp ?? null, target: null } }, who);
};
const charges = (sql, job) => sql.query("select item, description, qty::float8 as qty, rate::float8 as rate, kind, source_key, sort from ticket_charges where job_id = $1 order by sort, id", [job]);
const invoiceLines = (sql, type, id) =>
  sql.query(
    `select l.item, l.qty::float8 as qty, l.rate::float8 as rate, l.kind, l.source_key, l.sort from invoices v join invoice_lines l on l.invoice_id = v.id
      where v.entity_type = $1 and v.entity_id = $2 order by l.sort, l.id`,
    [type, id],
  );
const head = (sql, type, id) =>
  one(sql, "select total::float8 as total, approved_by, approved_at is not null as approved, submitted_by, submitted_at is not null as submitted from invoices where entity_type = $1 and entity_id = $2", [type, id]);
const notes = (sql) => sql.query("select entity_type, entity_id, actor_name, action, detail from activity order by id");

/* ------------------------------------------------------------------ the plain rules */

test("what a link does, or why it can't: the rules alone", () => {
  const own = { version: "7:1:", state: "approved", lines: 2, total: 315, discount: null };
  const t = {
    kind: "service",
    id: 5,
    name: "Service ticket SC-1",
    wo: "WO-4321",
    customer: CAFE,
    status: "Completed",
    blocked: null,
    closed: null,
    po: "PO-77",
    discount: null,
    netsuite: null,
    stamp: "s1",
  };
  const r = { account: SHOP, po: "PO-OLD", current: null, own, unitLock: null };
  const plan = R.planLink(r, t);
  assert.deepEqual(plan, {
    ok: true,
    steps: ["link"],
    effects: [
      `Account: ${SHOP} → ${CAFE}.`,
      "Customer P.O.: PO-OLD → PO-77.",
      "Its invoice's 2 lines ($315.00) go on the ticket's charges.",
      // Its own approved invoice may have been billed in NetSuite by hand (11/6 review): KatzDesk can't tell.
      "If its invoice was billed in NetSuite already, don't link it: WO-4321 (Service ticket SC-1) would bill it again.",
    ],
    lines: 2,
    total: 315,
  });
  // One line: the verbs agree.
  assert.equal(R.planLink({ ...r, own: { ...own, lines: 1, total: 45 } }, t).effects[2], "Its invoice's 1 line ($45.00) goes on the ticket's charges.");
  // The project's P.O. even when it has none, and said so.
  assert.equal(R.planLink(r, { ...t, po: null }).effects[1], "Customer P.O.: PO-OLD → none (Service ticket SC-1 has none).");
  // An install's invoice takes them waiting for an Admin; a discount there and NetSuite billing are said.
  const inst = { ...t, kind: "install", name: "Install #9", wo: "WO-5001", discount: { kind: "percent", value: 10 }, netsuite: "INV-T-1" };
  const fresh = { ...own, state: "none" };
  assert.deepEqual(R.planLink({ ...r, account: CAFE, po: "PO-77", own: fresh }, inst).effects, [
    "Its invoice's 2 lines ($315.00) go on the install's invoice, waiting for an Admin to approve it.",
    "Install #9's discount (10% off) applies to them there.",
    "Install #9 is billed in NetSuite already (INV-T-1). NetSuite's invoice won't have these lines.",
  ]);
  // A flat amount off stays one discount on the whole bill.
  assert.equal(
    R.planLink({ ...r, account: CAFE, po: "PO-77", own: fresh }, { ...inst, discount: { kind: "amount", value: 25 }, netsuite: null }).effects[1],
    "Install #9's discount ($25.00 off) stays one discount on its whole bill.",
  );
  // Nothing on its invoice yet: its parts and labor are billed there from now on.
  assert.equal(R.planLink({ ...r, own: { ...own, lines: 0, total: 0 } }, t).effects.at(-1), "It has no invoice lines yet. Its parts and labor are billed on the ticket's charges from now on.");
  // A billed project takes no lines; with none to move, the link stands and says nothing more bills there.
  assert.deepEqual(R.planLink(r, { ...t, closed: "is billed on SO-T-1" }), { ok: false, refusal: "Service ticket SC-1 is billed on SO-T-1, so this rebuild's 2 lines can't go on it." });
  assert.equal(R.planLink({ ...r, own: { ...own, lines: 0, total: 0 } }, { ...t, closed: "is billed on SO-T-1" }).effects.at(-1), "Service ticket SC-1 is billed on SO-T-1, so nothing more can be billed there.");
  // Refused: Walk-In, no account, a blocked project, Warehouse's waiting invoice, a discount, a locked unit.
  assert.equal(R.planLink(r, { ...t, customer: "Walk - In" }).refusal, "Service ticket SC-1 is on Walk-In, which is never a billing account. Give it the real account first.");
  assert.equal(R.planLink(r, { ...t, customer: " " }).refusal, "Service ticket SC-1 has no account. Give it one first.");
  assert.equal(R.planLink(r, { ...t, blocked: "Service ticket SC-1 is cancelled." }).refusal, "Service ticket SC-1 is cancelled.");
  assert.equal(R.planLink({ ...r, own: { ...own, state: "waiting" } }, t).refusal, "This rebuild's invoice is waiting for an Admin to approve it (Warehouse saved it). Approve it first, then link.");
  assert.equal(
    R.planLink({ ...r, own: { ...own, discount: { kind: "amount", value: 20 } } }, t).refusal,
    "This rebuild's invoice has a discount ($20.00 off), which can't go on WO-4321 (Service ticket SC-1)'s bill. Take it off the rebuild's invoice first.",
  );
  assert.equal(R.planLink({ ...r, unitLock: "SN T-1 is locked by chuy, so this rebuild stays on its account while it has it." }, t).refusal, "SN T-1 is locked by chuy, so this rebuild stays on its account while it has it.");
  // The lock only matters when the account would change.
  assert.equal(R.planLink({ ...r, account: CAFE, unitLock: "locked" }, t).ok, true);

  // Linked: Unlink brings the lines back, unless they are billed there or elsewhere.
  const current = { ...t, lines: 2, total: 315, moved: 2, linkedOpen: true, elsewhere: null };
  const linked = { account: CAFE, po: "PO-77", current, own: { version: null, state: "none", lines: 0, total: 0, discount: null }, unitLock: null };
  assert.deepEqual(R.planLink(linked, null), {
    ok: true,
    steps: ["unlink"],
    effects: ["Its 2 lines ($315.00) come off the ticket's charges and back onto its own invoice, approved by you.", `Its account (${CAFE}) and Customer P.O. stay as they are.`],
    lines: 2,
    total: 315,
  });
  assert.equal(R.planLink({ ...linked, current: { ...current, closed: "is billed on SO-T-2" } }, null).refusal, "Service ticket SC-1 is billed on SO-T-2, so this rebuild's 2 lines there stay billed, and it stays linked.");
  assert.equal(R.planLink({ ...linked, current: { ...current, lines: 1, total: 45, closed: "is billed on SO-T-2" } }, null).refusal, "Service ticket SC-1 is billed on SO-T-2, so this rebuild's 1 line there stays billed, and it stays linked.");
  // A bill closed since the link was made keeps it even with none of its lines to be seen (its parts may be there by
  // hand, or NetSuite's lines over them, 11/6 review); a link from before 11/6, or one made onto a bill already
  // closed, put nothing there through the link: it can go, and says what stays billed.
  assert.equal(R.planLink({ ...linked, current: { ...current, lines: 0, closed: "is billed on SO-T-2" } }, null).refusal, "Service ticket SC-1 is billed on SO-T-2, and its link put 2 lines there, so it stays linked: what was billed there stays billed.");
  assert.equal(
    R.planLink({ ...linked, current: { ...current, lines: 0, moved: 0, closed: "is billed on SO-T-2" } }, null).refusal,
    "Service ticket SC-1 is billed on SO-T-2, and it was linked while that bill was open, so it stays linked: anything of it billed there stays billed.",
  );
  const untouched = R.planLink({ ...linked, current: { ...current, lines: 0, moved: 0, linkedOpen: false, closed: "is billed on SO-T-2" } }, null);
  assert.equal(untouched.ok, true);
  assert.equal(untouched.effects[1], "Service ticket SC-1 is billed on SO-T-2: any of its parts added there by hand stay billed there.");
  const approvedInstall = { ...current, kind: "install", name: "Install #9", lines: 0, moved: 0, closed: "has an approved invoice" };
  assert.equal(R.planLink({ ...linked, current: approvedInstall }, null).refusal, "Install #9 has an approved invoice, and it was linked while that bill was open, so it stays linked: anything of it billed there stays billed.");
  assert.equal(R.planLink({ ...linked, current: { ...approvedInstall, linkedOpen: false } }, null).ok, true);
  assert.equal(R.planLink({ ...linked, current: { ...current, elsewhere: "ticket SC-9 (billed on SO-T-3)" } }, null).refusal, "Some of this rebuild's lines are on ticket SC-9 (billed on SO-T-3), so it stays linked.");
  // Linking it again to the same project: only a rebuild linked before 11/6 still has its own lines to move.
  assert.equal(R.planLink(linked, t).refusal, "This rebuild is already linked to WO-4321 (Service ticket SC-1).");
  assert.deepEqual(R.planLink({ ...linked, own }, t).steps, ["link"]);
  // Another project: off the old one first, then onto the new.
  const other = { ...t, kind: "install", id: 9, name: "Install #9", wo: "WO-5001", po: "PO-77" };
  const relink = R.planLink(linked, other);
  assert.deepEqual(relink.steps, ["unlink", "link"]);
  assert.deepEqual(relink.effects, [
    "It leaves WO-4321 (Service ticket SC-1): its 2 lines there come off the ticket's charges.",
    "Its invoice's 2 lines ($315.00) go on the install's invoice, waiting for an Admin to approve it.",
  ]);
  // A move to another WO checks the unlink first: lines billed on the old project stay there.
  assert.equal(
    R.planLink({ ...linked, current: { ...current, closed: "is billed on SO-T-4" } }, other).refusal,
    "Service ticket SC-1 is billed on SO-T-4, so this rebuild's 2 lines there stay billed, and it stays linked.",
  );
  // Linked already, its own invoice is locked: the way out starts with Unlink (11/6 review).
  assert.equal(
    R.planLink({ ...linked, own: { ...linked.own, state: "waiting", lines: 1, total: 5 } }, other).refusal,
    "This rebuild's own invoice is waiting for an Admin to approve it (Warehouse saved it). Unlink it, approve its invoice, then link it again.",
  );
  assert.equal(
    R.planLink({ ...linked, own: { ...own, discount: { kind: "percent", value: 5 } } }, t).refusal,
    "This rebuild's invoice has a discount (5% off), which can't go on WO-4321 (Service ticket SC-1)'s bill. Unlink it, take the discount off its invoice, then link it again.",
  );
  // The keys: the rebuild's id is its own colon-bounded field.
  assert.equal(isRebuildLineKey("rb:12:40", 12), true);
  assert.equal(isRebuildLineKey("rb:120:40", 12), false);
  assert.equal(isRebuildLineKey("pmkit:12:x", 12), false);
  assert.equal(R.rebuildBillsOnLock({ kind: "install", name: "Install #9", wo: "WO-5001" }, 0), "This rebuild bills on WO-5001 (Install #9): its parts and labor go on the install's invoice. Open the install to change them.");
  assert.equal(
    R.rebuildBillsOnLock({ kind: "service", name: "Service ticket SC-1", wo: null }, 1),
    "This rebuild bills on Service ticket SC-1: its parts and labor go on the ticket's charges. Open the ticket to change them. Its own invoice still has 1 line from before it was linked. Link on its Details can move it onto Service ticket SC-1's bill. To change it first, or to bill it on this invoice, Unlink it.",
  );
});

test("migrations 0118 and 0119 only add: a column and an index on invoice lines, four functions, a column on rebuilds; invoice_total works out totals as the app does", async () => {
  const text = src("migrations/0118_rebuild_link_billing.sql") + ";\n" + src("migrations/0119_rebuild_link_lines.sql");
  const statements = text.replace(/--.*$/gm, "").split(/;\s*(?=(?:alter|create)\b)/i).map((s) => s.trim().replace(/;$/, "")).filter(Boolean);
  for (const s of statements) {
    assert.match(
      s,
      /^(alter table invoice_lines add column if not exists source_key text|create index if not exists invoice_lines_source_key_idx|create or replace function (invoice_version|rebuild_lines_on|take_rebuild_lines|invoice_total)\b|alter table rebuilds add column if not exists link_lines int not null default 0)/i,
      s.slice(0, 80),
    );
  }
  const { sql } = await fresh();
  const cases = [
    { lines: [{ qty: 3, rate: 33.33, kind: "part" }], discount: null },
    { lines: [{ qty: 1.5, rate: 0.33, kind: "part" }, { qty: 2, rate: 150, kind: "labor" }], discount: { kind: "percent", value: 12.5 } },
    { lines: [{ qty: 1, rate: 20, kind: "part" }], discount: { kind: "amount", value: 50 } },
    { lines: [{ qty: 4, rate: 12.49, kind: "part" }], discount: { kind: "percent", value: 150 } },
    { lines: [], discount: { kind: "amount", value: 5 } },
  ];
  for (const c of cases) {
    const sub = c.lines.reduce((a, l) => a + Math.round(l.qty * l.rate * 100) / 100, 0);
    const got = Number((await one(sql, "select invoice_total($1::numeric, $2::text, $3::numeric)::text as t", [sub.toFixed(2), c.discount?.kind ?? null, c.discount?.value ?? null])).t);
    assert.equal(got, invoiceTotals(c.lines, c.discount).total, JSON.stringify(c));
  }
});

/* ------------------------------------------------------------------ finding the WO */

test("a WO finds every service ticket, TLC and install carrying it, open or done, and each says what Link does", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql, { po: "PO-OLD" });
  await ownInvoice(sql, rb, PARTS);
  const done = await ticket(sql, { wo: "WO-4321", status: "Completed", po: "PO-T-1" });
  const tlc = await ticket(sql, { kind: "tlc", wo: "wo 04321", status: "Scheduled" });
  await ticket(sql, { wo: "WO-43210" });
  await sql.query("insert into pm_jobs (customer, wo, status) values ($1, 'WO-4321', 'Completed')", [CAFE]);
  const inst = await install(sql, { wo: "WO-5000", wos: ["WO-5000", "WO-4321"] });
  await install(sql, { wo: "WO-4321", archived: true });

  const f = await find(sql, rb, "  4321 ");
  assert.equal(f.key, "4321");
  assert.equal(f.error, null);
  // Tickets newest first, then installs; a PM, another WO and an install off the board are not offered.
  assert.deepEqual(f.candidates.map((c) => [c.target.kind, c.target.id]), [["job", tlc], ["job", done], ["install", inst]]);
  const [t, s, i] = f.candidates;
  assert.equal(t.project.name, `TLC ticket SC-RBL-2`);
  assert.equal(i.project.wo, "WO-4321", "an install is named by the WO that matched");
  assert.deepEqual(s.plan.effects, [
    `Account: ${SHOP} → ${CAFE}.`,
    "Customer P.O.: PO-OLD → PO-T-1.",
    "Its invoice's 2 lines ($315.00) go on the ticket's charges.",
    "If its invoice was billed in NetSuite already, don't link it: WO-4321 (Service ticket SC-RBL-1) would bill it again.",
  ]);
  assert.equal(f.own.lines, 2);
  assert.equal(f.own.total, 315);

  assert.equal((await find(sql, rb, "abc")).error, "Type a WO number, like WO-1234.");
  assert.equal((await find(sql, rb, "WO-9999")).error, "No service ticket, TLC or install has WO-9999.");
  // The open tickets and installs on its account, as the old list had them, to pick with no WO.
  await sql.query("update rebuilds set account = $2 where id = $1", [rb, CAFE]);
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual(v.suggestions.map((x) => [x.target.kind, x.target.id]), [["install", inst], ["job", tlc]]);
  const picked = await L.findRebuildLinksFor(sql, { id: rb, pick: { kind: "install", id: inst } }, "u-owner");
  assert.deepEqual(picked.candidates.map((c) => c.project.name), [`Install #${inst}`]);
  // An install taken off the board can't take it; a done install isn't suggested (it can still be found by its WO).
  const gone = await install(sql, { wo: "WO-4999", archived: true });
  const off = await L.findRebuildLinksFor(sql, { id: rb, pick: { kind: "install", id: gone } }, "u-owner");
  assert.equal(off.candidates[0].plan.refusal, `Install #${gone} was taken off the board.`);
  const finished = await install(sql, { wo: "WO-4998", complete: true, status: "Installed" });
  assert.ok(!(await L.getRebuildLinkFor(sql, rb, "u-owner")).suggestions.some((x) => x.target.kind === "install" && x.target.id === finished));

  // Warehouse links nothing (the billing is an Admin's); Sales can't change rebuilds.
  const wh = await find(sql, rb, "4321", "u-wh");
  assert.equal(wh.error, "Warehouse doesn't link rebuilds to tickets or installs: their billing is an Admin's. Ask an Admin.");
  assert.deepEqual(wh.candidates, []);
  assert.equal((await find(sql, rb, "4321", "u-rep")).error, "Sales can view rebuilds on their accounts. Bench status is service-owned.");
  await assert.rejects(linkTo(sql, f, s, "u-wh"), { message: "Warehouse doesn't link rebuilds to tickets or installs: their billing is an Admin's. Ask an Admin." });
});

/* ------------------------------------------------------------------ linking */

test("linked to a ticket: its invoice's lines go on the ticket's charges, it takes the ticket's account and P.O., and its own invoice says it bills there", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql, { po: "PO-OLD" });
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-4321", po: "PO-T-1", status: "In progress" });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : TRIPCHARGE', 'Trip Charge for Service Call', 1, 150, 'trip', 1)", [job]);

  const f = await find(sql, rb, "WO-4321");
  const out = await linkTo(sql, f, f.candidates[0], "u-desk");
  assert.equal(out.message, "Linked to WO-4321 (Service ticket SC-RBL-1). Its 2 lines went on the ticket's charges.");
  assert.equal(out.row.jobId, job);
  assert.equal(out.row.installId, null);
  assert.equal(out.row.account, CAFE);
  assert.equal(out.row.po, "PO-T-1");
  // After the ticket's own charge, each marked as this rebuild's line.
  const lines = await charges(sql, job);
  assert.deepEqual(
    lines.map((l) => [l.item, l.qty, l.rate, l.kind, l.sort]),
    [["Service : TRIPCHARGE", 1, 150, "trip", 1], ["TEST-BURR-64", 2, 45, "part", 2], ["Service : SERVICELABOR", 1.5, 150, "labor", 3]],
  );
  assert.ok(lines.slice(1).every((l) => isRebuildLineKey(l.source_key, rb)));
  assert.equal(new Set(lines.map((l) => l.source_key)).size, 3, "each key once");
  // Its own invoice is gone: the lines are billed on the ticket now, never twice.
  assert.equal(await head(sql, "rebuild", rb), undefined);
  // History on both.
  assert.deepEqual(
    (await notes(sql)).map((n) => [n.entity_type, n.entity_id, n.actor_name, n.action, n.detail]),
    [
      ["rebuild", rb, "dana", "linked", `Linked to WO-4321 (Service ticket SC-RBL-1), ${CAFE} · account ${SHOP} → ${CAFE} · Customer P.O. PO-T-1 · its invoice's 2 lines ($315.00) went on the ticket's charges`],
      ["service", job, "dana", "updated", "Rebuild #1 (Test grinder refurb) linked · its 2 lines ($315.00) went on this ticket's charges"],
    ],
  );
  // The rebuild's Invoice window is locked, saying where it bills; Approve and Save for Approval are refused.
  const lock = `This rebuild bills on WO-4321 (Service ticket SC-RBL-1): its parts and labor go on the ticket's charges. Open the ticket to change them.`;
  const view = await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner");
  assert.equal(view.locked, lock);
  assert.deepEqual(view.lines, []);
  await assert.rejects(
    I.approveInvoiceFor(sql, { type: "rebuild", id: rb, lines: [{ item: "TEST-BURR-64", description: "", qty: 1, rate: 45 }], lineIds: [], discount: null, seen: null }, "u-owner"),
    { message: lock },
  );
  // The statement itself refuses too (an approve whose check ran before the link committed).
  const raw = await sql.query(I.approveRecordInvoiceSql(), ["rebuild", rb, CAFE, null, null, null, null, null, null, 45, "chuy", null, ["TEST-BURR-64"], [""], [1], [45], ["part"], null, false, [null]]);
  assert.deepEqual(raw, []);
  assert.equal(await head(sql, "rebuild", rb), undefined);
  // What the sheet shows, and the ticket's list of rebuilds billed there.
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual([v.current.name, v.current.lines, v.current.total, v.current.elsewhere], ["Service ticket SC-RBL-1", 2, 315, null]);
  assert.deepEqual(await L.listProjectRebuildsFor(sql, { type: "service", id: job }, "u-owner"), [{ id: rb, title: "Test grinder refurb", status: "In progress", removed: false, lines: 2, total: 315 }]);
  await assert.rejects(L.listProjectRebuildsFor(sql, { type: "service", id: job }, "u-wh"), /Warehouse invoices its refurbs only/);
  // Warehouse sees where it bills, never the customer's lines.
  const wv = await L.getRebuildLinkFor(sql, rb, "u-wh");
  assert.deepEqual([wv.current.lines, wv.current.total, wv.unlink, wv.suggestions], [0, 0, null, []]);
});

test("the ticket's Charges keep the rebuild's lines as its own, and Unlink takes them back onto its invoice, approved, as they are now", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-4321" });
  const stamp = async () => (await one(sql, "select updated_at::text as t from service_jobs where id = $1", [job])).t;
  const before = await stamp();
  const f = await find(sql, rb, "4321");
  await linkTo(sql, f, f.candidates[0]);
  // The link marks the ticket changed, so a Charges save or a merge that read it before (and waited) stops.
  assert.notEqual(await stamp(), before);
  // The Charges panel saves its lines back with their keys (an edited quantity included).
  const loaded = await C.getTicketChargesFor(sql, job, "u-owner");
  const sent = loaded.lines.map((l) => ({ item: l.item, description: l.description, qty: l.item === "TEST-BURR-64" ? 3 : l.qty, rate: l.rate, sourceKey: l.sourceKey }));
  await C.writeTicketCharges(sql, job, "u-owner", { lines: sent, lineIds: loaded.lines.map((l) => l.id) });
  assert.ok((await charges(sql, job)).every((l) => isRebuildLineKey(l.source_key, rb)));
  // A panel opened before the link saves nothing over them.
  await assert.rejects(C.writeTicketCharges(sql, job, "u-owner", { lines: [], lineIds: [] }), { message: "These charges changed since you opened them. Reload and try again." });

  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual(v.unlink.effects, [
    "Its 2 lines ($360.00) come off the ticket's charges and back onto its own invoice, approved by you.",
    `Its account (${CAFE}) and Customer P.O. stay as they are.`,
  ]);
  const linkedStamp = await stamp();
  const out = await unlink(sql, rb, "u-desk");
  assert.equal(out.message, "Unlinked from WO-4321 (Service ticket SC-RBL-1). Its 2 lines ($360.00) are back on its own invoice.");
  assert.notEqual(await stamp(), linkedStamp, "the unlink marks it changed too");
  assert.deepEqual([out.row.jobId, out.row.installId, out.row.account], [null, null, CAFE]);
  assert.deepEqual(await charges(sql, job), []);
  assert.deepEqual(
    (await invoiceLines(sql, "rebuild", rb)).map((l) => [l.item, l.qty, l.rate, l.kind, l.source_key]),
    [["TEST-BURR-64", 3, 45, "part", null], ["Service : SERVICELABOR", 1.5, 150, "labor", null]],
  );
  assert.deepEqual(await head(sql, "rebuild", rb), { total: 360, approved_by: "dana", approved: true, submitted_by: null, submitted: false });
  const n = await notes(sql);
  assert.deepEqual(n.slice(-2).map((x) => [x.entity_type, x.action, x.detail]), [
    ["rebuild", "unlinked", "Unlinked from WO-4321 (Service ticket SC-RBL-1) · its 2 lines ($360.00) came back onto its own invoice"],
    ["service", "updated", "Rebuild #1 (Test grinder refurb) unlinked · its 2 lines ($360.00) went back to the rebuild"],
  ]);
  // Its own invoice opens again.
  assert.equal((await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner")).locked, null);
});

test("linked to an install by its second WO: the lines wait on its invoice for an Admin, keep their keys when it is approved, and stay billed once it is", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql, { account: CAFE });
  await ownInvoice(sql, rb, PARTS, { customer: CAFE });
  const inst = await install(sql, { wo: "WO-5000", wos: ["WO-5000", "WO-5001"], po: "PO-I-1" });
  const installInv = await idOf(sql, "insert into invoices (entity_type, entity_id, customer, total, discount_kind, discount_value) values ('install', $1, $2, 1000, 'percent', 10) returning id", [inst, CAFE]);
  await sql.query("insert into invoice_lines (invoice_id, item, description, qty, rate, kind, sort) values ($1, 'TEST-BREWER', 'Test brewer', 1, 1000, 'equipment', 1)", [installInv]);
  // An Invoice window open on the install before the link.
  const before = await I.getInvoiceFor(sql, { type: "install", id: inst }, "u-owner");

  const f = await find(sql, rb, "wo-5001");
  assert.deepEqual(f.candidates[0].plan.effects, [
    "Customer P.O.: none → PO-I-1.",
    "Its invoice's 2 lines ($315.00) go on the install's invoice, waiting for an Admin to approve it.",
    `If its invoice was billed in NetSuite already, don't link it: WO-5001 (Install #${inst}) would bill it again.`,
    `Install #${inst}'s discount (10% off) applies to them there.`,
  ]);
  const out = await linkTo(sql, f, f.candidates[0], "u-desk");
  assert.equal(out.message, `Linked to WO-5001 (Install #${inst}). Its 2 lines went on the install's invoice.`);
  assert.equal(out.row.installId, inst);
  assert.equal(
    (await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner")).locked,
    `This rebuild bills on WO-5000 (Install #${inst}): its parts and labor go on the install's invoice. Open the install to change them.`,
  );
  assert.deepEqual(
    (await invoiceLines(sql, "install", inst)).map((l) => [l.item, l.sort, isRebuildLineKey(l.source_key, rb)]),
    [["TEST-BREWER", 1, false], ["TEST-BURR-64", 2, true], ["Service : SERVICELABOR", 3, true]],
  );
  // Its total, after its discount, and it waits for an Admin now.
  assert.deepEqual(await head(sql, "install", inst), { total: Math.round((1000 + 315) * 0.9 * 100) / 100, approved_by: null, approved: false, submitted_by: "dana", submitted: true });
  // The window opened before approves nothing over them.
  await assert.rejects(
    I.approveInvoiceFor(sql, { type: "install", id: inst, lines: before.lines.map((l) => ({ item: l.item, description: l.description, qty: l.qty, rate: l.rate })), lineIds: [], discount: before.discount, seen: before.version }, "u-owner"),
    { message: "Lines were saved for approval on this invoice after you opened it (a ticket or another install was merged into this one, or a rebuild was linked to it or unlinked), so nothing was approved. Look over the new lines, then approve." },
  );
  // Office can't approve what waits for an Admin; the Admin approves it as the window has it, keys and all.
  const now = await I.getInvoiceFor(sql, { type: "install", id: inst }, "u-owner");
  await assert.rejects(
    I.approveInvoiceFor(sql, { type: "install", id: inst, lines: now.lines.map((l) => ({ item: l.item, description: l.description, qty: l.qty, rate: l.rate, sourceKey: l.sourceKey ?? null })), lineIds: [], discount: now.discount, seen: now.version }, "u-desk"),
    { message: "This invoice is waiting for an Admin to approve it." },
  );
  assert.equal(now.lines.filter((l) => isRebuildLineKey(l.sourceKey, rb)).length, 2);
  await I.approveInvoiceFor(
    sql,
    { type: "install", id: inst, lines: now.lines.map((l) => ({ item: l.item, description: l.description, qty: l.qty, rate: l.rate, sourceKey: l.sourceKey ?? null })), lineIds: [], discount: now.discount, seen: now.version },
    "u-owner",
  );
  assert.equal((await invoiceLines(sql, "install", inst)).filter((l) => isRebuildLineKey(l.source_key, rb)).length, 2, "approving keeps the keys");
  // Approved, they stay billed there: no unlink.
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.equal(v.unlink.refusal, `Install #${inst} has an approved invoice, so this rebuild's 2 lines there stay billed, and it stays linked.`);
  await assert.rejects(unlink(sql, rb), { message: v.unlink.refusal });
  // Another rebuild with lines can't go on an approved invoice either.
  const rb2 = await rebuild(sql, { title: "Test brewer refurb", account: CAFE });
  await ownInvoice(sql, rb2, [PARTS[0]], { customer: CAFE });
  const f2 = await find(sql, rb2, "5000");
  assert.equal(f2.candidates[0].plan.refusal, `Install #${inst} has an approved invoice, so this rebuild's 1 line can't go on it.`);
});

test("unlinked from an install whose invoice waits: the lines come back, and its invoice's total and stamp move", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql, { account: CAFE });
  await ownInvoice(sql, rb, PARTS, { customer: CAFE });
  const inst = await install(sql, { wo: "WO-5000" });
  const row = async () => (await one(sql, "select updated_at::text as t from installs where id = $1", [inst])).t;
  const r0 = await row();
  const f = await find(sql, rb, "5000");
  await linkTo(sql, f, f.candidates[0]);
  // Link and Unlink mark the install changed: Merge installs confirmed before either stops (11/6 review).
  const r1 = await row();
  assert.notEqual(r1, r0);
  const stamp = (await one(sql, "select invoice_version('install', $1) as v", [inst])).v;
  const out = await unlink(sql, rb, "u-desk");
  assert.notEqual(await row(), r1);
  assert.equal(out.message, `Unlinked from WO-5000 (Install #${inst}). Its 2 lines ($315.00) are back on its own invoice.`);
  assert.deepEqual(await invoiceLines(sql, "install", inst), []);
  const h = await head(sql, "install", inst);
  assert.deepEqual([h.total, h.submitted_by, h.approved], [0, "dana", false]);
  assert.notEqual((await one(sql, "select invoice_version('install', $1) as v", [inst])).v, stamp, "a window opened before approves nothing");
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
});

test("moving to another WO: the lines leave the ticket and go on the install's invoice in one click", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-4321" });
  const inst = await install(sql, { wo: "WO-5000", po: "PO-I-1" });
  const f = await find(sql, rb, "4321");
  await linkTo(sql, f, f.candidates[0]);
  const g = await find(sql, rb, "5000");
  assert.deepEqual(g.candidates[0].plan.effects, [
    "It leaves WO-4321 (Service ticket SC-RBL-1): its 2 lines there come off the ticket's charges.",
    "Customer P.O.: none → PO-I-1.",
    "Its invoice's 2 lines ($315.00) go on the install's invoice, waiting for an Admin to approve it.",
  ]);
  const out = await linkTo(sql, g, g.candidates[0]);
  assert.equal(out.message, `Moved from WO-4321 (Service ticket SC-RBL-1) to WO-5000 (Install #${inst}). Its 2 lines went on the install's invoice.`);
  assert.deepEqual([out.row.jobId, out.row.installId, out.row.po], [null, inst, "PO-I-1"]);
  assert.deepEqual(await charges(sql, job), []);
  assert.equal((await invoiceLines(sql, "install", inst)).filter((l) => isRebuildLineKey(l.source_key, rb)).length, 2);
  assert.equal(await head(sql, "rebuild", rb), undefined, "its own invoice was only a stop on the way");
  assert.deepEqual((await notes(sql)).map((n) => [n.entity_type, n.action]), [
    ["rebuild", "linked"],
    ["service", "updated"],
    ["rebuild", "unlinked"],
    ["service", "updated"],
    ["rebuild", "linked"],
    ["install", "updated"],
  ]);
});

test("refused, saying why: a billed or cancelled or merged ticket, Walk-In, Warehouse's waiting invoice, a discount, and anything changed since the Find", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const billed = await ticket(sql, { wo: "WO-1001", so: "SO-T-1" });
  const invoiced = await ticket(sql, { wo: "WO-1002" });
  await sql.query("insert into ticket_invoices (job_id, ns_invoice, invoice_date, status, total, amount_remaining, source) values ($1, 'INV-T-9', '2026-11-01', 'Open', 10, 10, 'standalone')", [invoiced]);
  const cancelled = await ticket(sql, { wo: "WO-1003", status: "Cancelled" });
  const walk = await ticket(sql, { wo: "WO-1004", customer: "Walk - In" });
  const plan = async (wo) => (await find(sql, rb, wo)).candidates[0].plan.refusal;
  assert.equal(await plan("1001"), "Service ticket SC-RBL-1 is billed on SO-T-1, so this rebuild's 2 lines can't go on it.");
  assert.equal(await plan("1002"), "Service ticket SC-RBL-2 is invoiced in NetSuite on INV-T-9, so this rebuild's 2 lines can't go on it.");
  assert.equal(await plan("1003"), "Service ticket SC-RBL-3 is cancelled.");
  assert.equal(await plan("1004"), "Service ticket SC-RBL-4 is on Walk-In, which is never a billing account. Give it the real account first.");
  for (const [wo, job] of [["1001", billed], ["1002", invoiced], ["1003", cancelled], ["1004", walk]]) {
    const f = await find(sql, rb, wo);
    await assert.rejects(linkTo(sql, f, f.candidates[0]), { message: f.candidates[0].plan.refusal });
    assert.equal((await charges(sql, job)).length, 0);
  }
  // A ticket merged into another one: link that one.
  const keeper = await ticket(sql, { wo: "WO-1005" });
  await ticket(sql, { wo: "WO-1006" }).then((id) => sql.query("update service_jobs set duplicate_of = $2 where id = $1", [id, keeper]));
  assert.equal(await plan("1006"), `Service ticket SC-RBL-6 was merged into ticket #${keeper}. Link that one.`);

  // Warehouse saved its invoice, and an Admin hasn't approved it: approve it first. A discount can't move either.
  const wrb = await rebuild(sql, { title: "Test refurb waiting", account: "Katz Coffee Service Dept." });
  await ownInvoice(sql, wrb, [PARTS[0]], { state: "waiting", customer: "Katz Coffee Service Dept." });
  assert.equal((await find(sql, wrb, "1005")).candidates[0].plan.refusal, "This rebuild's invoice is waiting for an Admin to approve it (Warehouse saved it). Approve it first, then link.");
  const drb = await rebuild(sql, { title: "Test refurb discount" });
  await ownInvoice(sql, drb, [PARTS[0]], { discount: { kind: "percent", value: 15 } });
  assert.equal(
    (await find(sql, drb, "1005")).candidates[0].plan.refusal,
    "This rebuild's invoice has a discount (15% off), which can't go on WO-1005 (Service ticket SC-RBL-5)'s bill. Take it off the rebuild's invoice first.",
  );

  // Changed since the Find: its invoice approved again, the ticket saved, or the link moved.
  const CHANGED = "This rebuild or that project changed since you looked, so nothing was linked. Find the WO again.";
  let f = await find(sql, rb, "1005");
  await sql.query("update invoices set approved_at = approved_at + interval '1 second' where entity_type = 'rebuild' and entity_id = $1", [rb]);
  await assert.rejects(linkTo(sql, f, f.candidates[0]), { message: CHANGED });
  f = await find(sql, rb, "1005");
  await sql.query("update service_jobs set notes = 'Test note', updated_at = now() + interval '1 second' where id = $1", [keeper]);
  await assert.rejects(linkTo(sql, f, f.candidates[0]), { message: CHANGED });
  f = await find(sql, rb, "1005");
  await sql.query("update rebuilds set job_id = $2 where id = $1", [rb, keeper]);
  await assert.rejects(linkTo(sql, f, f.candidates[0]), { message: CHANGED });
  await sql.query("update rebuilds set job_id = null where id = $1", [rb]);
  // An install's account or P.O. changed since the Find (not only its invoice): what the effects said is stale.
  const inst = await install(sql, { wo: "WO-1007", po: "PO-I-OLD" });
  f = await find(sql, rb, "1007");
  await sql.query("update installs set po = 'PO-I-NEW', updated_at = now() + interval '1 second' where id = $1", [inst]);
  await assert.rejects(linkTo(sql, f, f.candidates[0]), { message: CHANGED });
  // The statement checks it too, with the stamp the person saw.
  assert.deepEqual(await sql.query(L.linkRebuildSql(), [rb, null, null, "install", inst, "chuy", f.own.version, f.candidates[0].project.stamp, "x", "y"]), []);
  assert.deepEqual(await charges(sql, keeper), []);
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2, "nothing moved");
});

test("the statement checks again as it writes: a ticket billed or an invoice approved after the plan, and Warehouse's save on a linked rebuild", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-4321" });
  const f = await find(sql, rb, "4321");
  const st = { own: f.own.version, stamp: f.candidates[0].project.stamp };
  // Billed on a Sales Order after the plan, keeping its stamp: the write takes nothing.
  await sql.query("update service_jobs set ns_so = 'SO-T-5' where id = $1", [job]);
  const none = await sql.query(L.linkRebuildSql(), [rb, null, null, "job", job, "chuy", st.own, st.stamp, "x", "y"]);
  assert.deepEqual(none, []);
  assert.deepEqual(await charges(sql, job), []);
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  await sql.query("update service_jobs set ns_so = null where id = $1", [job]);
  // Its own invoice approved again after the plan: the write takes nothing.
  await sql.query("update invoices set approved_at = now() + interval '5 seconds' where entity_type = 'rebuild' and entity_id = $1", [rb]);
  assert.deepEqual(await sql.query(L.linkRebuildSql(), [rb, null, null, "job", job, "chuy", st.own, st.stamp, "x", "y"]), []);
  assert.deepEqual(await charges(sql, job), []);

  // Warehouse's Save for Approval never writes on a linked rebuild, even with its check passed.
  const SD = "Katz Coffee Service Dept.";
  const wrb = await rebuild(sql, { title: "Test refurb linked", account: SD });
  const sdJob = await ticket(sql, { wo: "WO-7001", customer: SD });
  const g = await find(sql, wrb, "7001");
  await linkTo(sql, g, g.candidates[0]);
  const saved = await sql.query(I.saveForApprovalSql(), [wrb, SD, null, null, SD, null, null, null, 45, "wes", ["TEST-BURR-64"], [""], [1], [45], ["part"], ["katzcoffeeservicedept"]]);
  assert.deepEqual(saved, []);
  await assert.rejects(
    I.saveInvoiceForApprovalFor(sql, { type: "rebuild", id: wrb, lines: [{ item: "TEST-BURR-64", description: "", qty: 1, rate: 45 }], discount: null }, "u-wh"),
    /This rebuild bills on WO-7001/,
  );
});

test("every check of the link statement holds on its own, as when the record changes after the plan: what the statement refuses, it refuses", async () => {
  const { sql } = await fresh();
  const STAMP = (table, id) => one(sql, `select (extract(epoch from updated_at) * 1000000)::bigint::text as s from ${table} where id = $1`, [id]).then((r) => r.s);
  const installStamp = (id) => one(sql, "select (extract(epoch from updated_at) * 1000000)::bigint::text || '|' || coalesce(invoice_version('install', id), '') as s from installs where id = $1", [id]).then((r) => r.s);
  const own = (id) => one(sql, "select invoice_version('rebuild', $1) as v", [id]).then((r) => r.v);
  const link = async (rb, kind, id, stamp) => sql.query(L.linkRebuildSql(), [rb, null, null, kind, id, "chuy", await own(rb), stamp, "x", "y"]);
  const job = await ticket(sql, { wo: "WO-6001" });
  // Warehouse's saved invoice, and a discount.
  const waiting = await rebuild(sql, { account: "Katz Coffee Service Dept." });
  await ownInvoice(sql, waiting, [PARTS[0]], { state: "waiting", customer: "Katz Coffee Service Dept." });
  assert.deepEqual(await link(waiting, "job", job, await STAMP("service_jobs", job)), [], "waiting");
  const discounted = await rebuild(sql);
  await ownInvoice(sql, discounted, [PARTS[0]], { discount: { kind: "percent", value: 10 } });
  assert.deepEqual(await link(discounted, "job", job, await STAMP("service_jobs", job)), [], "discount");
  // Walk-In, cancelled, merged, or the ticket changed since it was read.
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, [PARTS[0]]);
  const walk = await ticket(sql, { wo: "WO-6002", customer: "Walk - In" });
  assert.deepEqual(await link(rb, "job", walk, await STAMP("service_jobs", walk)), [], "walk-in");
  const cancelled = await ticket(sql, { wo: "WO-6003", status: "Cancelled" });
  assert.deepEqual(await link(rb, "job", cancelled, await STAMP("service_jobs", cancelled)), [], "cancelled");
  const merged = await ticket(sql, { wo: "WO-6004" });
  await sql.query("update service_jobs set duplicate_of = $2 where id = $1", [merged, job]);
  assert.deepEqual(await link(rb, "job", merged, await STAMP("service_jobs", merged)), [], "merged");
  const before = await STAMP("service_jobs", job);
  await sql.query("update service_jobs set updated_at = now() + interval '3 seconds' where id = $1", [job]);
  assert.deepEqual(await link(rb, "job", job, before), [], "the ticket changed");
  // An install whose invoice is approved, or changed since (a ticket merged into it), or whose row changed.
  const approved = await install(sql, { wo: "WO-6005" });
  await sql.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 0, 'chuy', now())", [approved, CAFE]);
  assert.deepEqual(await link(rb, "install", approved, await installStamp(approved)), [], "approved");
  const open = await install(sql, { wo: "WO-6006" });
  await sql.query("insert into invoices (entity_type, entity_id, customer, total, submitted_by, submitted_at) values ('install', $1, $2, 0, 'chuy', now() - interval '1 day')", [open, CAFE]);
  const seen = await installStamp(open);
  await sql.query("update invoices set submitted_at = now() where entity_type = 'install' and entity_id = $1", [open]);
  assert.deepEqual(await link(rb, "install", open, seen), [], "its invoice changed");
  const row = await installStamp(open);
  await sql.query("update installs set po = 'PO-I-9', updated_at = now() + interval '3 seconds' where id = $1", [open]);
  assert.deepEqual(await link(rb, "install", open, row), [], "the install changed");
  // A locked unit keeps it on its account.
  const held = await rebuild(sql);
  const unit = await idOf(sql, "insert into assets (kind, model, serial, site, status, sold_to, purpose, locked_at, locked_by) values ('equip', 'Test grinder', 'TESTSN-RBL-9', 'field', 'assigned', $1, 'In-house rebuild', now(), 'chuy') returning id", [SHOP]);
  await sql.query("insert into rebuild_machines (rebuild_id, model, serial, asset_id, pulled_at) values ($1, 'Test grinder', 'TESTSN-RBL-9', $2, now())", [held, unit]);
  assert.deepEqual(await link(held, "job", job, await STAMP("service_jobs", job)), [], "locked unit");
  // Nothing moved anywhere.
  assert.deepEqual(await charges(sql, job), []);
  assert.equal((await invoiceLines(sql, "install", open)).length, 0);
  for (const id of [waiting, discounted, rb]) assert.equal((await invoiceLines(sql, "rebuild", id)).length, 1);
});

test("every check of the unlink statement holds on its own, and Warehouse's waiting invoice takes lines back still waiting", async () => {
  const { sql } = await fresh();
  const STAMP = (id) => one(sql, "select (extract(epoch from updated_at) * 1000000)::bigint::text as s from service_jobs where id = $1", [id]).then((r) => r.s);
  const installStamp = (id) => one(sql, "select (extract(epoch from updated_at) * 1000000)::bigint::text || '|' || coalesce(invoice_version('install', id), '') as s from installs where id = $1", [id]).then((r) => r.s);
  const unlinkSql = (rb, inst, job, stamp, count) => sql.query(L.unlinkRebuildSql(), [rb, inst, job, "chuy", stamp, count, null, null, null, null, null, "x", "y"]);
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-6101" });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'Service : TRIPCHARGE', 'Trip Charge for Service Call', 1, 150, 'trip', 1)", [job]);
  const f = await find(sql, rb, "6101");
  await linkTo(sql, f, f.candidates[0]);
  // A count or a stamp other than what was read: nothing.
  assert.deepEqual(await unlinkSql(rb, null, job, await STAMP(job), 1), [], "count");
  assert.deepEqual(await unlinkSql(rb, null, job, "1", 2), [], "stamp");
  // Taken off the board after it was read: nothing (its lines would go to an invoice nobody looks at).
  await sql.query("update rebuilds set archived = true where id = $1", [rb]);
  assert.deepEqual(await unlinkSql(rb, null, job, await STAMP(job), 2), [], "off the board");
  await sql.query("update rebuilds set archived = false where id = $1", [rb]);
  // As read, it unlinks, and the ticket's own charge stays.
  assert.equal((await unlinkSql(rb, null, job, await STAMP(job), 2)).length, 1);
  assert.deepEqual((await charges(sql, job)).map((l) => l.item), ["Service : TRIPCHARGE"]);
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  // An install's approved invoice keeps its lines; an invoice changed since keeps them too.
  const inst = await install(sql, { wo: "WO-6102" });
  const g = await find(sql, rb, "6102");
  await linkTo(sql, g, g.candidates[0]);
  const stamp = await installStamp(inst);
  await sql.query("update invoices set approved_at = now(), approved_by = 'chuy' where entity_type = 'install' and entity_id = $1", [inst]);
  assert.deepEqual(await unlinkSql(rb, inst, null, await installStamp(inst), 2), [], "approved");
  await sql.query("update invoices set approved_at = null, approved_by = null, submitted_at = now() + interval '3 seconds' where entity_type = 'install' and entity_id = $1", [inst]);
  assert.deepEqual(await unlinkSql(rb, inst, null, stamp, 2), [], "its invoice changed");
  assert.equal((await invoiceLines(sql, "install", inst)).length, 2, "nothing came off");
  // Warehouse's saved invoice on a rebuild linked before 11/6 takes the lines back still waiting for an Admin.
  const SD = "Katz Coffee Service Dept.";
  const wrb = await rebuild(sql, { account: SD });
  const sdJob = await ticket(sql, { wo: "WO-6103", customer: SD });
  await ownInvoice(sql, wrb, [PARTS[0]], { state: "waiting", customer: SD });
  await sql.query("update rebuilds set job_id = $2 where id = $1", [wrb, sdJob]);
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, source_key, sort) values ($1, 'TEST-GASKET', 'Test gasket', 1, 12, 'part', $2, 1)", [sdJob, `rb:${wrb}:999`]);
  const v = await L.getRebuildLinkFor(sql, wrb, "u-owner");
  assert.equal(v.unlink.effects[0], "Its 1 line ($12.00) comes off the ticket's charges and back onto its own invoice, which waits for an Admin to approve it.");
  await unlink(sql, wrb);
  assert.deepEqual(await head(sql, "rebuild", wrb), { total: 102, approved_by: null, approved: false, submitted_by: "wes", submitted: true });
  assert.equal((await invoiceLines(sql, "rebuild", wrb)).length, 2);
});

test("unlinking leaves billed lines billed: a billed ticket, or a ticket merged into the install as billed", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-4321" });
  const f = await find(sql, rb, "4321");
  await linkTo(sql, f, f.candidates[0]);
  await sql.query("update service_jobs set ns_so = 'SO-T-8', updated_at = now() where id = $1", [job]);
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.equal(v.unlink.refusal, "Service ticket SC-RBL-1 is billed on SO-T-8, so this rebuild's 2 lines there stay billed, and it stays linked.");
  await assert.rejects(unlink(sql, rb), { message: v.unlink.refusal });
  // The statement refuses as well, its check passed or not.
  assert.deepEqual(await sql.query(L.unlinkRebuildSql(), [rb, null, job, "chuy", v.current.stamp, 2, null, null, null, null, null, "x", "y"]), []);
  assert.equal((await charges(sql, job)).length, 2);
  // The Billing Backfill wrote NetSuite's lines over its charges (no rebuild keys): it still stays linked.
  await sql.query("update ticket_charges set source_key = null where job_id = $1", [job]);
  const nsLines = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.equal(nsLines.current.lines, 0);
  assert.equal(nsLines.unlink.refusal, "Service ticket SC-RBL-1 is billed on SO-T-8, and its link put 2 lines there, so it stays linked: what was billed there stays billed.");
  assert.deepEqual(await sql.query(L.unlinkRebuildSql(), [rb, null, job, "chuy", nsLines.current.stamp, 0, null, null, null, null, null, "x", "y"]), []);
  await sql.query("update ticket_charges set source_key = 'rb:' || $2::text || ':' || id::text where job_id = $1", [job, rb]);
  // A ticket merged into an install as billed keeps its charges; the rebuild went with it to the install, so its
  // lines there stay billed and it stays linked.
  const inst = await install(sql, { wo: "WO-5000" });
  await sql.query("update rebuilds set job_id = null, install_id = $2 where id = $1", [rb, inst]);
  await sql.query("update service_jobs set duplicate_of = id, merged_install_id = $2 where id = $1", [job, inst]);
  await sql.query(`insert into ticket_install_merges (job_id, install_id, merged_by, moved) values ($1, $2, 'chuy', '{"billedSo":"SO-T-8","billedOn":"SO-T-8"}'::jsonb)`, [job, inst]);
  const w = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.equal(w.current.elsewhere, "ticket SC-RBL-1 (billed on SO-T-8)");
  assert.equal(w.unlink.refusal, "Some of this rebuild's lines are on ticket SC-RBL-1 (billed on SO-T-8), so it stays linked.");
});

test("merging the ticket into an install takes the rebuild's lines along, keys and all, so it bills on the install and unlinks from there", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-4321", status: "Scheduled" });
  const inst = await install(sql, { wo: "WO-5000", wos: ["WO-5000", "WO-4321"] });
  const f = await find(sql, rb, "4321");
  await linkTo(sql, f, f.candidates.find((c) => c.target.kind === "job"));
  const p = await M.previewTicketInstallMergeFor(sql, "u-owner", { jobId: job, installId: inst });
  assert.equal(p.refusal ?? null, null);
  await M.mergeTicketIntoInstallFor(sql, "u-owner", { jobId: job, installId: inst, stamps: p.stamps, billedSo: "", billedOn: "" });
  const row = await RB.rebuildRowOut(sql, rb);
  assert.deepEqual([row.installId, row.jobId], [inst, null]);
  assert.equal((await invoiceLines(sql, "install", inst)).filter((l) => isRebuildLineKey(l.source_key, rb)).length, 2);
  // The merged ticket's hidden copy is never billed, so it doesn't hold the rebuild.
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual([v.current.kind, v.current.lines, v.current.elsewhere, v.unlink.ok], ["install", 2, null, true]);
  await unlink(sql, rb);
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  assert.equal((await invoiceLines(sql, "install", inst)).length, 0);
});

test("the plain Save never changes the link, and a linked rebuild's account follows its project", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql, { status: "Queued" });
  const job = await ticket(sql, { wo: "WO-4321" });
  const f = await find(sql, rb, "4321");
  await linkTo(sql, f, f.candidates[0]);
  // A link sent with a save is ignored (the field is gone); the rest saves.
  const saved = await RB.updateRebuildFor(sql, { id: rb, title: "Test grinder refurb 2", installId: 99, jobId: null }, "u-owner");
  assert.deepEqual([saved.title, saved.jobId, saved.installId], ["Test grinder refurb 2", job, null]);
  // A sheet opened before the link would put the old account back: refused.
  await assert.rejects(RB.updateRebuildFor(sql, { id: rb, account: SHOP }, "u-owner"), {
    message: `This rebuild is linked to ticket SC-RBL-1 (WO-4321), so its account follows that one's (${CAFE}). Unlink it on Details to change the account.`,
  });
  // The project's account, however it is spelled, is fine.
  assert.equal((await RB.updateRebuildFor(sql, { id: rb, account: "test bean cafe heights" }, "u-owner")).account, "test bean cafe heights");
  // Made new, a rebuild is never linked.
  const made = await RB.createRebuildFor(sql, { title: "Test new refurb", account: CAFE, installId: 3, jobId: job }, "u-owner");
  assert.deepEqual([made.installId, made.jobId], [null, null]);
});

test("its held units follow it to the project's account, and a unit the owner locked keeps it where it is", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  const held = await idOf(sql, "insert into assets (kind, model, serial, site, status, sold_to, purpose) values ('equip', 'Test grinder', 'TESTSN-RBL-1', 'field', 'assigned', $1, 'In-house rebuild') returning id", [SHOP]);
  await sql.query("insert into rebuild_machines (rebuild_id, model, serial, asset_id, pulled_at, origin) values ($1, 'Test grinder', 'TESTSN-RBL-1', $2, now(), $3::jsonb)", [rb, held, JSON.stringify({ pulled_to: SHOP })]);
  await ticket(sql, { wo: "WO-4321" });
  const f = await find(sql, rb, "4321");
  await linkTo(sql, f, f.candidates[0]);
  assert.equal((await one(sql, "select sold_to from assets where id = $1", [held])).sold_to, CAFE);
  assert.equal((await one(sql, "select origin->>'pulled_to' as p from rebuild_machines where rebuild_id = $1", [rb])).p, CAFE);

  const rb2 = await rebuild(sql, { title: "Test locked refurb" });
  const locked = await idOf(
    sql,
    "insert into assets (kind, model, serial, site, status, sold_to, purpose, locked_at, locked_by) values ('equip', 'Test grinder', 'TESTSN-RBL-2', 'field', 'assigned', $1, 'In-house rebuild', now(), 'chuy') returning id",
    [SHOP],
  );
  await sql.query("insert into rebuild_machines (rebuild_id, model, serial, asset_id, pulled_at) values ($1, 'Test grinder', 'TESTSN-RBL-2', $2, now())", [rb2, locked]);
  const g = await find(sql, rb2, "4321");
  assert.match(g.candidates[0].plan.refusal, /^SN TESTSN-RBL-2 is locked by chuy, so this rebuild stays on its account while it has it\./);
  await assert.rejects(linkTo(sql, g, g.candidates[0]), /SN TESTSN-RBL-2 is locked by chuy/);
  assert.equal((await one(sql, "select sold_to from assets where id = $1", [locked])).sold_to, SHOP);
});

test("what its link put on the bill is kept: set on Link, back to none on Unlink, and a billed ticket keeps a rebuild that put lines there", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, PARTS);
  const job = await ticket(sql, { wo: "WO-4321" });
  const inst = await install(sql, { wo: "WO-5000" });
  const moved = async () => Number((await one(sql, "select link_lines from rebuilds where id = $1", [rb])).link_lines);
  const f = await find(sql, rb, "4321");
  await linkTo(sql, f, f.candidates[0]);
  assert.equal(await moved(), 2);
  const g = await find(sql, rb, "5000");
  await linkTo(sql, g, g.candidates[0]);
  assert.equal(await moved(), 2, "the move to another WO counts what went there");
  await unlink(sql, rb);
  assert.equal(await moved(), 0);
  // Linked with nothing to move while the ticket was open: its parts went on the ticket's Charges by hand, and the ticket
  // was billed. It stays linked, so its own invoice never bills them again (11/6 review, round 2).
  const empty = await rebuild(sql, { title: "Test empty refurb" });
  const h = await find(sql, empty, "4321");
  await linkTo(sql, h, h.candidates[0]);
  assert.deepEqual(await one(sql, "select link_lines, link_open from rebuilds where id = $1", [empty]), { link_lines: 0, link_open: true });
  await sql.query("insert into ticket_charges (job_id, item, description, qty, rate, kind, sort) values ($1, 'TEST-BURR-64', 'Added by hand', 2, 45, 'part', 9)", [job]);
  await sql.query("update service_jobs set ns_so = 'SO-T-11', updated_at = now() where id = $1", [job]);
  const v = await L.getRebuildLinkFor(sql, empty, "u-owner");
  assert.equal(v.unlink.refusal, "Service ticket SC-RBL-1 is billed on SO-T-11, and it was linked while that bill was open, so it stays linked: anything of it billed there stays billed.");
  await assert.rejects(unlink(sql, empty), { message: v.unlink.refusal });
  assert.deepEqual(await sql.query(L.unlinkRebuildSql(), [empty, null, job, "chuy", v.current.stamp, 0, null, null, null, null, null, "x", "y"]), [], "the statement keeps it too");
  // Linked when the ticket was billed already: nothing could go on it through the link, so Unlink lets it go.
  const late = await rebuild(sql, { title: "Test late refurb" });
  const k = await find(sql, late, "4321");
  assert.equal(k.candidates[0].plan.effects.at(-1), "Service ticket SC-RBL-1 is billed on SO-T-11, so nothing more can be billed there.");
  await linkTo(sql, k, k.candidates[0]);
  assert.deepEqual(await one(sql, "select link_lines, link_open from rebuilds where id = $1", [late]), { link_lines: 0, link_open: false });
  const w = await L.getRebuildLinkFor(sql, late, "u-owner");
  assert.equal(w.unlink.ok, true);
  assert.equal(w.unlink.effects[1], "Service ticket SC-RBL-1 is billed on SO-T-11: any of its parts added there by hand stay billed there.");
  await unlink(sql, late);
  assert.deepEqual(await one(sql, "select job_id, link_lines, link_open from rebuilds where id = $1", [late]), { job_id: null, link_lines: 0, link_open: null });
  // The same for an install: its invoice approved since an empty link keeps it.
  const ins2 = await install(sql, { wo: "WO-5500" });
  const e2 = await rebuild(sql, { title: "Test install refurb" });
  const m = await find(sql, e2, "5500");
  await linkTo(sql, m, m.candidates[0]);
  await sql.query("insert into invoices (entity_type, entity_id, customer, total, approved_by, approved_at) values ('install', $1, $2, 90, 'chuy', now())", [ins2, CAFE]);
  assert.match((await L.getRebuildLinkFor(sql, e2, "u-owner")).unlink.refusal, /^Install #\d+ has an approved invoice, and it was linked while that bill was open, so it stays linked/);
});

test("a rebuild linked before 11/6 kept its own invoice: its lock says how to move or change it, and Unlink is the way out, even from a billed ticket", async () => {
  const { sql } = await fresh();
  const job = await ticket(sql, { wo: "WO-4321", po: "PO-T-1" });
  // Linked through the old list: its account and link set, its own invoice approved, with a discount.
  const rb = await rebuild(sql, { account: CAFE });
  await sql.query("update rebuilds set job_id = $2 where id = $1", [rb, job]);
  await ownInvoice(sql, rb, PARTS, { customer: CAFE, discount: { kind: "percent", value: 10 } });
  const view = await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner");
  assert.equal(
    view.locked,
    "This rebuild bills on WO-4321 (Service ticket SC-RBL-1): its parts and labor go on the ticket's charges. Open the ticket to change them. Its own invoice still has 2 lines from before it was linked. Link on its Details can move them onto WO-4321 (Service ticket SC-RBL-1)'s bill. To change them first, or to bill them on this invoice, Unlink it.",
  );
  assert.equal(view.lines.length, 2, "its lines show, read-only");
  const f = await find(sql, rb, "4321");
  assert.equal(f.candidates[0].plan.refusal, "This rebuild's invoice has a discount (10% off), which can't go on WO-4321 (Service ticket SC-RBL-1)'s bill. Unlink it, take the discount off its invoice, then link it again.");
  // The ticket was billed since: its link put nothing there, so Unlink still works, and keeps its own lines.
  await sql.query("update service_jobs set ns_so = 'SO-T-12', updated_at = now() where id = $1", [job]);
  const v = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual([v.current.lines, v.current.moved, v.unlink.ok], [0, 0, true]);
  assert.ok(v.unlink.effects.includes("Its own invoice keeps its 2 lines."));
  await unlink(sql, rb);
  assert.equal((await invoiceLines(sql, "rebuild", rb)).length, 2);
  // Unlinked, its invoice opens: the discount comes off, and it links to an open WO.
  const open = await I.getInvoiceFor(sql, { type: "rebuild", id: rb }, "u-owner");
  assert.equal(open.locked, null);
  await I.approveInvoiceFor(sql, { type: "rebuild", id: rb, lines: open.lines.map((l) => ({ item: l.item, description: l.description, qty: l.qty, rate: l.rate })), lineIds: [], discount: null, seen: open.version }, "u-owner");
  await ticket(sql, { wo: "WO-4400" });
  const g = await find(sql, rb, "4400");
  assert.equal(g.candidates[0].plan.ok, true);
  await linkTo(sql, g, g.candidates[0]);
  assert.equal(await head(sql, "rebuild", rb), undefined);
});

test("Warehouse and Sales see where a rebuild bills, and nothing of its billing or its invoice", async () => {
  const { sql } = await fresh();
  const rb = await rebuild(sql);
  await ownInvoice(sql, rb, [{ item: "TEST-BURR-64", qty: 1, rate: 777 }], { discount: { kind: "amount", value: 7 } });
  const job = await ticket(sql, { wo: "WO-4321", po: "PO-T-9" });
  await sql.query("update rebuilds set job_id = $2, account = $3 where id = $1", [rb, job, CAFE]);
  await sql.query("update service_jobs set ns_so = 'SO-T-9' where id = $1", [job]);
  for (const who of ["u-wh", "u-rep"]) {
    const v = await L.getRebuildLinkFor(sql, rb, who);
    assert.ok(v.refusal, who);
    assert.deepEqual(v.own, { version: null, state: "none", lines: 0, total: 0, discount: null }, who);
    assert.deepEqual(
      [v.current.name, v.current.closed, v.current.po, v.current.discount, v.current.netsuite, v.current.stamp, v.current.lines, v.current.total, v.unlink, v.suggestions],
      ["Service ticket SC-RBL-1", null, null, null, null, "", 0, 0, null, []],
      who,
    );
  }
  // The Admin sees it all.
  const a = await L.getRebuildLinkFor(sql, rb, "u-owner");
  assert.deepEqual([a.own.total, a.current.closed, a.current.po], [777, "is billed on SO-T-9", "PO-T-9"]);
});

/* ------------------------------------------------------------------ the screens */

test("the rebuild sheet: a WO box with Find instead of the old list, its account locked while linked, and Link saving the form first", () => {
  const sheet = src("src/components/desk/rebuild-sheet.tsx");
  assert.ok(!sheet.includes("listRebuildLinks"), "the old same-account list is gone");
  const saveCall = sheet.slice(sheet.indexOf("const save = useMutation({"), sheet.indexOf("onSuccess: (next) => {"));
  assert.match(saveCall, /updateRebuild\(\{/);
  assert.ok(!/installId|jobId/.test(saveCall), "the plain Save sends no link");
  assert.match(sheet, /<RebuildLinkField row=\{row\} canEdit=\{canEdit\} dirty=\{dirty\} saveFirst=\{saveFirst\} key=\{`link-\$\{row\.id\}`\} \/>/);
  assert.match(sheet, /\) : linkedTo \? \(\n\s+\/\/ Linked to a ticket or an install \(11\/6\), it bills there: its account is that project's\./);
  assert.match(sheet, /Follows \{linkedTo\}\. Unlink it below to change the account\./);
  assert.match(sheet, /await save\.mutateAsync\(\);\n\s+return true;/);
  const field = src("src/components/desk/rebuild-link-field.tsx");
  assert.match(field, /if \(dirty && !\(await saveFirst\(q\.to \? "link" : "unlink"\)\)\) return null;/);
  assert.match(sheet, /toast\.error\(linking\.current \? `Nothing was \$\{linking\.current\}ed: your changes on Details didn't save\. \$\{why\}` : why\);/);
  assert.match(field, /if \(e\.key === "Enter"\) \{\n\s+e\.preventDefault\(\);\n\s+runFind\(\);/, "Enter finds the WO and doesn't save the form");
  // Inside the form, no button submits it.
  for (const b of field.match(/<(Button|button)\b[^>]*>/g) ?? []) assert.match(b, /type="button"/, b);
  assert.match(field, /seen: \{ own: q\.base\.own\.version, current: q\.base\.current\?\.stamp \?\? null, target: q\.to \? q\.to\.project\.stamp : null \}/);
  // The ticket (both layouts) and the install show the rebuilds billed there.
  const job = src("src/components/desk/job-sheet.tsx");
  assert.equal(job.match(/<ProjectRebuilds type=\{j\.kind === "tlc" \? "tlc" : "service"\} id=\{j\.id\} key=\{`rebuilds-\$\{j\.id\}`\} \/>/g)?.length, 2);
  assert.match(src("src/components/desk/entity-sheets.tsx"), /<ProjectRebuilds type="install" id=\{row\.id\} inset key=\{`rebuilds-install-\$\{row\.id\}`\} \/>/);
  // Rebuild lines keep their keys through the Charges panel and an install's approve.
  assert.match(src("src/lib/ops/charges-api.ts"), /regex\(\/\^\(pmkit\|mp\|rb\):\/\)/);
  assert.match(src("src/lib/ops/invoice-api.ts"), /regex\(\/\^\(pmkit\|mp\|rb\):\/\)/);
});
